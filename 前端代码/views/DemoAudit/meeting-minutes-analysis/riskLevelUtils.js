/** 会议纪要风险等级工具(3 档:高危/中危/无风险) */

export const RISK_LEVEL = {
  HIGH: '高危',
  MEDIUM: '中危',
  NONE: '无风险',
}

const LEGACY_LEVEL_MAP = {
  A: RISK_LEVEL.HIGH,
  B: RISK_LEVEL.MEDIUM,
  C: RISK_LEVEL.MEDIUM, // 原 C 级=中低危 → 合并入中危
  D: RISK_LEVEL.NONE,   // 原 D 级=低危 → 合并入无风险
  // 旧 4 档中文 → 3 档
  中低危: RISK_LEVEL.MEDIUM,
  低危: RISK_LEVEL.NONE,
  低微: RISK_LEVEL.NONE,
  中低微: RISK_LEVEL.MEDIUM,
}

export const RISK_LEVEL_STATS = [
  { key: 'levelHigh', legacyKey: 'levelA', label: RISK_LEVEL.HIGH, tagType: 'danger' },
  { key: 'levelMedium', legacyKey: 'levelB', label: RISK_LEVEL.MEDIUM, tagType: 'warning' },
  { key: 'levelNone', legacyKey: null, label: RISK_LEVEL.NONE, tagType: '' },
]

export function normalizeRiskLevel(level) {
  const raw = String(level || '').trim()
  if (Object.values(RISK_LEVEL).includes(raw)) return raw
  const legacy = LEGACY_LEVEL_MAP[raw.toUpperCase()]
  if (legacy) return legacy
  const legacyCn = LEGACY_LEVEL_MAP[raw]
  if (legacyCn) return legacyCn
  return RISK_LEVEL.NONE
}

export function normalizeRiskStats(stats) {
  const source = stats || {}
  const normalized = {}
  RISK_LEVEL_STATS.forEach(({ key, legacyKey }) => {
    normalized[key] = Number(source[key] ?? source[legacyKey] ?? 0)
  })
  return normalized
}

export function getRiskLevelTagType(level) {
  const normalized = normalizeRiskLevel(level)
  if (normalized === RISK_LEVEL.HIGH) return 'danger'
  if (normalized === RISK_LEVEL.MEDIUM) return 'warning'
  if (normalized === RISK_LEVEL.NONE) return 'none'
  return 'info'
}

export function getRiskFlagTagType(flag) {
  const raw = String(flag || '').trim()
  if (raw === '无风险' || raw === '低危' || raw === '低微') return 'none'
  return getRiskLevelTagType(normalizeRiskLevel(raw))
}

function buildFindingLevelsByName(findings) {
  const levelsByName = {}
  ;(findings || []).forEach((finding) => {
    if (!finding || typeof finding !== 'object') return
    const level = normalizeRiskLevel(finding.level)
    const topicText = String(finding.topic || '').split('|')[0].trim()
    if (!topicText) return
    const prev = levelsByName[topicText]
    if (!prev) {
      levelsByName[topicText] = level
      return
    }
    const order = Object.values(RISK_LEVEL)
    levelsByName[topicText] = order.indexOf(level) <= order.indexOf(prev) ? level : prev
  })
  return levelsByName
}

export function resolveEconomicItemRiskLevel(itemName, findings, levelsByName) {
  const name = String(itemName || '').trim()
  if (!name || !Array.isArray(findings) || !findings.length) return ''

  const byName = levelsByName || buildFindingLevelsByName(findings)
  if (byName[name]) return byName[name]
  const matchedKey = Object.keys(byName).find(
    (topicName) => name.includes(topicName) || topicName.includes(name)
  )
  if (matchedKey) return byName[matchedKey]

  for (const finding of findings) {
    if (!finding || typeof finding !== 'object') continue
    const topicText = String(finding.topic || '')
    const topicPrefix = topicText.split('|')[0].trim()
    if (
      name.includes(topicText)
      || name === topicPrefix
      || (topicPrefix && topicPrefix.includes(name))
    ) {
      return normalizeRiskLevel(finding.level)
    }
  }
  return ''
}

export function normalizeEconomicItemsRiskFlags(economicItems, findings) {
  if (!Array.isArray(economicItems) || !economicItems.length) return economicItems
  const levelsByName = buildFindingLevelsByName(findings)
  const legacyFlags = new Set(['已分析', 'A', 'B', 'C', 'D'])

  return economicItems.map((group) => {
    if (!group || typeof group !== 'object') return group
    const items = (group.items || []).map((row) => {
      if (!row || typeof row !== 'object') return row
      const flag = String(row.riskFlag || '').trim()
      if (Object.values(RISK_LEVEL).includes(flag)) {
        return { ...row, riskFlag: normalizeRiskLevel(flag) }
      }
      if (
        legacyFlags.has(flag)
        || /^[ABCD]级/.test(flag)
      ) {
        const resolved = resolveEconomicItemRiskLevel(row.name, findings, levelsByName)
        if (resolved) return { ...row, riskFlag: resolved }
        if (flag === '已分析') return { ...row, riskFlag: '无风险' }
        return { ...row, riskFlag: normalizeRiskLevel(flag) }
      }
      return row
    })
    return { ...group, items }
  })
}

export function getFindingLevelLabel(finding) {
  if (!finding) return ''
  if (finding.levelLabel && !/^[ABCD]级/.test(finding.levelLabel)) {
    return finding.levelLabel
  }
  return normalizeRiskLevel(finding.level)
}

/** 与导出 HTML 模板 risk_report.html 内 sortEconomicItems / sortRiskSummary 对齐 */
export const RISK_LEVEL_RANK = {
  高危: 1,
  中危: 2,
  无风险: 3,
  中低危: 2,
  低危: 3,
  中低微: 2,
  低微: 3,
}

export const CATEGORY_RANK = {
  土地类: 1,
  资产类: 2,
  资金类: 3,
  项目类: 4,
  政策类: 5,
  '担保/债务类': 6,
}

const ECONOMIC_CATEGORY_MAP = {
  LAND: '土地类',
  ASSET: '资产类',
  FUND: '资金类',
  PROJECT: '项目类',
  POLICY: '政策类',
  GUARANTEE: '担保/债务类',
}

export function categoryLabelForSort(category) {
  const code = String(category || '').trim().toUpperCase()
  return ECONOMIC_CATEGORY_MAP[code] || String(category || '').trim() || '—'
}

function getRiskLevelRank(level) {
  return RISK_LEVEL_RANK[normalizeRiskLevel(level)] || 99
}

export function parseAmountWanFromText(text) {
  const m = String(text || '').match(/涉及金额\s*([\d.]+)\s*(万元|亿元)?/)
  if (!m) return 0
  const num = parseFloat(m[1]) || 0
  const unit = m[2] || '万元'
  return unit === '亿元' ? num * 10000 : num
}

export function getAmountInWan(row) {
  if (row && typeof row === 'object' && row.amount != null && row.amount !== '') {
    const num = Number(row.amount)
    return Number.isFinite(num) ? num : 0
  }
  return parseAmountWanFromText(row?.topic || row?.name || '')
}

/** 三、经济议题总清单：组内按风险等级 高→低，同级保留原序号 */
export function sortEconomicItemRows(items) {
  if (!Array.isArray(items) || items.length <= 1) return items || []
  return items.slice().sort((a, b) => {
    const lr = getRiskLevelRank(a?.riskFlag) - getRiskLevelRank(b?.riskFlag)
    if (lr !== 0) return lr
    return (a?.no || 0) - (b?.no || 0)
  })
}

export function sortEconomicItemsSection(economicItems) {
  if (!Array.isArray(economicItems)) return economicItems
  return economicItems.map((group) => {
    if (!group || typeof group !== 'object') return group
    return {
      ...group,
      items: sortEconomicItemRows(group.items || []),
    }
  })
}

/** 六、风险事项总表：等级 → 类别 → 金额降序 → 发现编号 */
export function sortRiskSummaryRows(rows) {
  if (!Array.isArray(rows) || rows.length <= 1) return rows || []
  return rows.slice().sort((a, b) => {
    const lr = getRiskLevelRank(a?.level) - getRiskLevelRank(b?.level)
    if (lr !== 0) return lr
    const cr =
      (CATEGORY_RANK[categoryLabelForSort(a?.category)] || 99) -
      (CATEGORY_RANK[categoryLabelForSort(b?.category)] || 99)
    if (cr !== 0) return cr
    const amountDiff = getAmountInWan(b) - getAmountInWan(a)
    if (Math.abs(amountDiff) > 0.0001) return amountDiff
    return String(a?.id || '').localeCompare(String(b?.id || ''))
  })
}

/** 查看接口返回的 report_data 统一规范为新等级体系 */
export function normalizeRiskReport(report) {
  if (!report || typeof report !== 'object') return report
  const next = { ...report }
  if (next.overview) {
    next.overview = {
      ...next.overview,
      riskStats: normalizeRiskStats(next.overview.riskStats),
    }
  }
  if (Array.isArray(next.findings)) {
    next.findings = next.findings.map((finding) => {
      const level = normalizeRiskLevel(finding?.level)
      return {
        ...finding,
        level,
        levelLabel: getFindingLevelLabel({ ...finding, level }),
      }
    })
  }
  if (Array.isArray(next.riskSummary)) {
    next.riskSummary = next.riskSummary.map((row) => ({
      ...row,
      level: normalizeRiskLevel(row?.level),
    }))
  }
  if (Array.isArray(next.economicItems)) {
    next.economicItems = sortEconomicItemsSection(
      normalizeEconomicItemsRiskFlags(next.economicItems, next.findings || [])
    )
  }
  if (Array.isArray(next.riskSummary)) {
    next.riskSummary = sortRiskSummaryRows(next.riskSummary)
  }
  return next
}
