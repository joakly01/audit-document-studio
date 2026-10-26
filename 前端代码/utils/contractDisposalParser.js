/**
 * 工程合同 Dify 回调 disposal_result 解析（outputs.text 内嵌 ```json 块）
 */

export function extractJsonBlocksFromMarkdown(text) {
  if (!text || typeof text !== 'string') return []
  const blocks = []
  const re = /```json\s*([\s\S]*?)\s*```/gi
  let match
  while ((match = re.exec(text)) !== null) {
    const raw = (match[1] || '').trim()
    if (raw) blocks.push(raw)
  }
  return blocks
}

export function parseJsonArrayFromBlock(jsonString) {
  const parsed = JSON.parse(jsonString)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') return [parsed]
  return []
}

/** 是否为合同分析结果条目（含自动分析仅有 title/description 的场景） */
function isContractResultShape(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  return (
    'title' in item
    || 'extracted_value' in item
    || 'laws_and_regulations' in item
    || 'description' in item
    || 'judgment_rule' in item
    || 'analysis' in item
    || 'result' in item
  )
}

function scoreContractResultArray(arr) {
  if (!Array.isArray(arr) || !arr.length) return -1
  const hasOutcome = arr.some((item) => {
    const result = item?.result != null ? String(item.result).trim() : ''
    const analysis = item?.analysis != null ? String(item.analysis).trim() : ''
    return !!result || !!analysis
  })
  if (hasOutcome) return 2
  if (arr.some(isContractResultShape)) return 1
  return 0
}

/** 收集 markdown 块、整段 JSON、文本中嵌套数组等候选串 */
function collectJsonCandidates(text) {
  const raw = (text || '').trim()
  if (!raw) return []
  const candidates = [...extractJsonBlocksFromMarkdown(raw)]
  if (!candidates.includes(raw)) {
    candidates.push(raw)
  }
  if (raw.startsWith('[') || raw.startsWith('{')) {
    return candidates
  }
  const bracketMatch = raw.match(/\[[\s\S]*\]/)
  if (bracketMatch?.[0] && !candidates.includes(bracketMatch[0])) {
    candidates.push(bracketMatch[0])
  }
  return candidates
}

/** 优先取含 result/analysis 的 JSON；否则取含 title/extracted_value 等的数组（text_2 自动分析） */
export function pickBestContractResultArray(text) {
  const candidates = collectJsonCandidates(text)
  if (!candidates.length) return []

  let best = []
  let bestScore = -1
  for (const block of candidates) {
    try {
      const arr = parseJsonArrayFromBlock(block)
      const score = scoreContractResultArray(arr)
      if (score > bestScore) {
        bestScore = score
        best = arr
        if (score >= 2) return arr
      }
    } catch (_) {
      /* 跳过非法块 */
    }
  }
  return best
}

/** 将 disposal_result 规范为对象（兼容双重 JSON 字符串） */
export function normalizeDisposalResultObject(disposalResult) {
  let obj = disposalResult
  if (obj == null) return null
  for (let i = 0; i < 3; i += 1) {
    if (typeof obj !== 'string') break
    try {
      obj = JSON.parse(obj)
    } catch {
      return null
    }
  }
  return obj && typeof obj === 'object' ? obj : null
}

function extractOutputsText(obj) {
  if (!obj || typeof obj !== 'object') return null
  const direct = obj?.data?.outputs?.text
  if (direct != null && direct !== '') return direct
  // 回调/调度偶发把 outputs 放在顶层
  const top = obj?.outputs?.text
  if (top != null && top !== '') return top
  return null
}

/** 将 outputs.text / text_2 规范为可解析的字符串或结构化数组 */
function normalizeContractOutputValue(val) {
  if (val == null || val === '') return null
  if (typeof val === 'string') {
    const trimmed = val.trim()
    return trimmed || null
  }
  if (Array.isArray(val)) {
    if (val.length && typeof val[0] === 'object' && !Array.isArray(val[0])) {
      return val
    }
    const joined = val.map((item) => String(item || '').trim()).filter(Boolean).join('\n')
    return joined || null
  }
  if (typeof val === 'object') {
    return val
  }
  const s = String(val).trim()
  return s || null
}

/** 从 outputs 字段（字符串 / 数组 / 对象）解析结果 bundles */
function resolveContractOutputBundles(outputVal) {
  const normalized = normalizeContractOutputValue(outputVal)
  if (normalized == null) return { items: [], templates: [] }

  if (Array.isArray(normalized)) {
    const score = scoreContractResultArray(normalized)
    if (score >= 0) {
      return { items: normalized, templates: [] }
    }
  } else if (typeof normalized === 'object') {
    return { items: [normalized], templates: [] }
  }

  const bundles = parseContractResultBundles(normalized)
  if (bundles.items.length) return bundles

  // 兜底：整段裸 JSON 数组（无 markdown 包裹）
  try {
    const arr = parseJsonArrayFromBlock(normalized)
    if (arr.length && scoreContractResultArray(arr) >= 0) {
      return { items: arr, templates: [] }
    }
  } catch (_) {
    /* ignore */
  }
  return { items: [], templates: [] }
}

function coalesceText(...values) {
  for (const v of values) {
    if (v == null) continue
    const s = typeof v === 'string' ? v.trim() : String(v).trim()
    if (s) return s
  }
  return ''
}

/** 从 Dify 条目读取字段（兼容中英文 key） */
function getContractResultField(item, ...keys) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return ''
  for (const key of keys) {
    const v = item[key]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  const lowerEntries = Object.entries(item).map(([k, v]) => [k.toLowerCase(), v])
  for (const key of keys) {
    const lk = key.toLowerCase()
    const hit = lowerEntries.find(([k]) => k === lk)
    if (hit && hit[1] != null && String(hit[1]).trim()) return String(hit[1]).trim()
  }
  return ''
}

function findRuleByTitle(item, rules) {
  if (!Array.isArray(rules) || !rules.length) return null
  const title = getContractResultField(item, 'title', '主题')
  if (!title) return null
  return rules.find((r) => getContractResultField(r, 'title', '主题') === title) || null
}

function resolveRuleForMerge(item, idx, informationExtraction, templateRules) {
  const byIndex = informationExtraction[idx] || templateRules[idx] || {}
  const byTitle = findRuleByTitle(item, informationExtraction)
    || findRuleByTitle(item, templateRules)
  return { ...byIndex, ...(byTitle || {}) }
}

/**
 * 从 outputs 文本解析结果条目，并尽量保留同文中的规则模板块（供合规结果补全判断依据等字段）
 */
function parseContractResultBundles(text) {
  const raw = text == null ? '' : (typeof text === 'string' ? text.trim() : String(text).trim())
  if (!raw) return { items: [], templates: [] }

  const candidates = collectJsonCandidates(raw)
  let bestOutcome = []
  let bestOutcomeScore = -1
  let bestTemplate = []
  let bestTemplateScore = -1

  for (const block of candidates) {
    try {
      const arr = parseJsonArrayFromBlock(block)
      const score = scoreContractResultArray(arr)
      if (score >= 2 && score >= bestOutcomeScore) {
        bestOutcomeScore = score
        bestOutcome = arr
      } else if (score === 1 && score >= bestTemplateScore) {
        bestTemplateScore = score
        bestTemplate = arr
      }
    } catch (_) {
      /* 跳过非法块 */
    }
  }

  if (bestOutcome.length) {
    return { items: bestOutcome, templates: bestTemplate }
  }
  return { items: bestTemplate, templates: [] }
}

/** 从 Dify outputs 文本（text / text_2）解析结构化结果行 */
export function parseContractResultFromOutputText(text) {
  return resolveContractOutputBundles(text).items
}

export function parseContractDisposalResult(disposalResult) {
  const obj = normalizeDisposalResultObject(disposalResult)
  if (!obj) return null
  const text = extractOutputsText(obj)
  if (text == null) return null
  const bundles = resolveContractOutputBundles(text)
  if (!bundles.items.length) return null
  const outputs = obj?.data?.outputs || obj?.outputs || {}
  return {
    parsedArray: bundles.items,
    ruleTemplates: bundles.templates,
    category: outputs.category || null,
    raw: obj
  }
}

function extractTitleFromItem(item, ruleTitle) {
  if (ruleTitle) return ruleTitle
  if (item?.title) return item.title
  const ev = item?.extracted_value
  if (ev && typeof ev === 'object' && !Array.isArray(ev)) {
    const keys = Object.keys(ev)
    if (keys.length === 1) return keys[0]
  }
  return item?.index != null ? `字段${item.index}` : '字段'
}

function formatExtractedValue(extractedValue) {
  if (extractedValue == null) return ''
  if (typeof extractedValue === 'string') return extractedValue
  if (typeof extractedValue === 'object') {
    return Object.entries(extractedValue)
      .map(([key, val]) => `${key}: ${val ?? ''}`)
      .join('\n')
  }
  return String(extractedValue)
}

/** 合并规则配置与 Dify 返回项，供合同 ResultTable 使用 */
export function mergeContractResultsWithRules(
  parsedArray,
  informationExtraction = [],
  templateRules = []
) {
  if (!Array.isArray(parsedArray)) return []
  return parsedArray.map((item, idx) => {
    const rule = resolveRuleForMerge(item, idx, informationExtraction, templateRules)
    const itemJudgment = getContractResultField(item, 'judgment_rule', '判断规则', '判断标准')
    const ruleJudgment = getContractResultField(rule, 'judgment_rule', '判断规则', '判断标准')
    const itemDesc = getContractResultField(item, 'description', '描述')
    const ruleDesc = getContractResultField(rule, 'description', '描述')
    return {
      title: extractTitleFromItem(item, rule.title),
      extracted_value: item?.extracted_value ?? rule.extracted_value ?? '',
      judgment_rule: coalesceText(itemJudgment, ruleJudgment),
      // 判断依据：法规依据优先，其次判断标准（text_2 自动分析常仅有 judgment_rule）
      laws_and_regulations: coalesceText(
        getContractResultField(item, 'laws_and_regulations', '判断依据', '法规依据'),
        getContractResultField(rule, 'laws_and_regulations', '判断依据', '法规依据'),
        itemJudgment,
        ruleJudgment
      ),
      // 分析思路：合规分析结论；text_2 无 analysis 时用 description（条款风险说明）
      analysis: coalesceText(
        getContractResultField(item, 'analysis', '分析思路', '具体描述'),
        getContractResultField(rule, 'analysis', '分析思路', '具体描述'),
        itemDesc,
        ruleDesc
      ),
      result: coalesceText(
        getContractResultField(item, 'result', '判断结果'),
        getContractResultField(rule, 'result', '判断结果')
      )
    }
  })
}

/** 转为 TaskResultViewer 提取结果表格行 */
export function mapContractToExtractionResults(parsedArray, informationExtraction = []) {
  const merged = mergeContractResultsWithRules(parsedArray, informationExtraction)
  return merged.map((row, index) => {
    const fieldValue = formatExtractedValue(row.extracted_value)
    const resultStr = String(row.result || '').trim()
    const isCompliant = resultStr === '符合' || resultStr === 'True' || resultStr === 'true'
    const evidenceParts = []
    if (row.analysis) evidenceParts.push(row.analysis)
    if (row.judgment_rule) evidenceParts.push(`判断规则: ${row.judgment_rule}`)
    return {
      id: index + 1,
      fieldName: row.title || `字段${index + 1}`,
      fieldValue,
      confidence: resultStr ? 100 : (fieldValue ? 80 : 0),
      status: resultStr ? (isCompliant ? 'success' : 'warning') : (fieldValue ? 'success' : 'warning'),
      is_found: !!fieldValue,
      evidence: evidenceParts.join('\n\n'),
      chunk_id: '',
      description: row.laws_and_regulations || '',
      notes: resultStr ? `判断结果: ${resultStr}` : '',
      evidence_list: []
    }
  })
}

/** 安全解析 parameter_settings（兼容 JSON 字符串与 object） */
export function parseParameterSettings(raw) {
  if (raw == null) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw }
  if (typeof raw !== 'string') return {}
  const trimmed = raw.trim()
  if (!trimmed) return {}
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** 从 disposal 读取 text_2：可能是 JSON 字符串，或已是对象数组 */
function extractContractText2Raw(disposalResult) {
  const obj = normalizeDisposalResultObject(disposalResult)
  if (!obj) return { text: '', array: null }
  const outputs = obj?.data?.outputs || obj?.outputs || {}
  const val = outputs.text_2
  if (val == null) return { text: '', array: null }
  const normalized = normalizeContractOutputValue(val)
  if (normalized == null) return { text: '', array: null }
  if (Array.isArray(normalized)) {
    return { text: '', array: normalized }
  }
  if (typeof normalized === 'object') {
    return { text: '', array: [normalized] }
  }
  return { text: normalized, array: null }
}

/**
 * 从 disposal_result 提取 Dify outputs.text_2 原始文本（未解析 JSON）
 * @param {*} disposalResult disposal_result 原始值
 * @returns {string} 非空文本或空字符串
 */
export function extractContractText2(disposalResult) {
  const { text, array } = extractContractText2Raw(disposalResult)
  if (array?.length) {
    try {
      return JSON.stringify(array)
    } catch (_) {
      return ''
    }
  }
  return text || ''
}

/**
 * 解析 text_2 为与 text 相同结构的表格行；无法解析 JSON 时返回 fallbackText 供纯文本展示
 * @param {*} disposalResult disposal_result
 * @param {object} [settings] parameter_settings
 * @returns {{ rows: Array, fallbackText: string }}
 */
export function parseContractText2Rows(disposalResult, settings = {}) {
  const { text, array } = extractContractText2Raw(disposalResult)
  let bundles = { items: [], templates: [] }
  if (Array.isArray(array) && array.length) {
    bundles = { items: array, templates: [] }
  } else if (text) {
    bundles = resolveContractOutputBundles(text)
  }
  if (!bundles.items.length) {
    return { rows: [], fallbackText: text || '' }
  }

  const rules = getInformationExtractionFromSettings(settings)
  return {
    rows: mergeContractResultsWithRules(bundles.items, rules, bundles.templates),
    fallbackText: ''
  }
}

/** 从 parameter_settings 解析 information_extraction 列表 */
export function getInformationExtractionFromSettings(settings) {
  if (!settings || typeof settings !== 'object') return []
  if (Array.isArray(settings.information_extraction)) return settings.information_extraction
  const nested = settings.custom_config?.parameter_settings
  if (nested) {
    try {
      const ps = typeof nested === 'string' ? JSON.parse(nested) : nested
      if (Array.isArray(ps?.information_extraction)) return ps.information_extraction
    } catch (_) {
      /* ignore */
    }
  }
  return []
}
