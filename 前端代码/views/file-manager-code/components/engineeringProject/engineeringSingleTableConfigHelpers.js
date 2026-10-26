/** 单表 F 键配置 helpers（与 qingdao graphs/single_table 对齐） */

export const SINGLE_TABLE_COMPARE_TYPES = [
  { label: '相似度', value: 'similarity' },
  { label: '金额差异', value: 'investment_diff' },
  { label: '金额大于', value: 'investment_gt' },
  { label: '完全相等', value: 'exact' }
]

export const VALUE_NORMALIZER_OPTIONS = [
  { label: '无', value: 'none' },
  { label: '浮点数', value: 'float' },
  { label: '字符串清洗', value: 'string_clean' },
  { label: '日期', value: 'date' },
  { label: '文件名年份前缀', value: 'filename_year_prefix' }
]

export function cloneSingleTableConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg || createEmptySingleTableConfig('duplicate')))
}

export function createEmptySingleTableConfig(mode = 'duplicate') {
  // 判定阈值仅顶层透传，analyze 前由 syncDerivedFields 写入 llm_config
  const threshold = mode === 'parent_child' ? 3.4 : 3.35
  return {
    threshold,
    field_mapping: {},
    llm_config: {
      field_weights: {},
      field_prompt_rules: {},
      hard_rules: [],
      veto_rules: [],
      phase_check_field: 'F1',
      phase_check_enabled: mode === 'duplicate',
      additional_prompt: '',
      strict_negative_prompt: '',
      output_schema: mode === 'parent_child' ? 'parent_child_v1' : 'duplicate_v1',
      threshold_comparison: 'gte',
      arbitration: { enabled: false, lower_delta: 0.25, upper_delta: 0.2, prefer: 'system' },
      system_rules: {}
    },
    prescreen_config: {
      min_match_fields: 2,
      investment_gt_direction: mode === 'parent_child' ? 'current_gt_other' : 'bidirectional',
      investment_fallback_pairs: false
    },
    auxiliary_columns: ['文件名称', 'source_file'],
    column_aliases: {}
  }
}

export function getFieldKeys(mapping) {
  if (!mapping || typeof mapping !== 'object') return []
  const keys = Object.keys(mapping)
  const fKeys = keys.filter((k) => /^F\d+$/i.test(k))
  const other = keys.filter((k) => !/^F\d+$/i.test(k))
  fKeys.sort((a, b) => parseInt(/^F(\d+)$/i.exec(a)[1], 10) - parseInt(/^F(\d+)$/i.exec(b)[1], 10))
  return [...fKeys, ...other]
}

export function allocateNextFieldKey(mapping) {
  let max = 0
  for (const k of Object.keys(mapping || {})) {
    const m = /^F(\d+)$/i.exec(k)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `F${max + 1}`
}

const isFKey = (k) => /^F\d+$/i.test(String(k || ''))

/**
 * 引用已删 F 的规则丢弃；存活 F 走 renameMap；and 子规则删光则丢整组
 * @param {unknown[]} rules
 * @param {Record<string, string>} renameMap
 * @param {string} [deletedKey]
 */
function remapOrDropFieldRefRules(rules, renameMap, deletedKey = '') {
  if (!Array.isArray(rules)) return []
  const out = []
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue
    if (rule.logic === 'and' && Array.isArray(rule.rules)) {
      const remappedSubs = []
      let dropGroup = false
      for (const sub of rule.rules) {
        if (!sub || typeof sub !== 'object') continue
        const f = String(sub.field || '')
        if (deletedKey && f === deletedKey) {
          dropGroup = true
          break
        }
        remappedSubs.push({
          ...sub,
          field: renameMap[f] || f
        })
      }
      if (!dropGroup && remappedSubs.length) {
        out.push({ ...rule, rules: remappedSubs })
      }
      continue
    }
    const f = String(rule.field || '')
    if (deletedKey && f === deletedKey) continue
    out.push({
      ...rule,
      field: f ? renameMap[f] || f : rule.field
    })
  }
  return out
}

function stripLegacyTopLevelKeys(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg
  if (!cfg.field_mapping || typeof cfg.field_mapping !== 'object') return cfg
  delete cfg.field_weights
  delete cfg.field_rules
  delete cfg.field_meta
  return cfg
}

/**
 * 将 F* 压成连续 F1…Fn，同步 weights/rules/veto/hard/phase，并清顶层遗留键
 * @param {object} cfg
 * @param {{ deletedKey?: string }} [options]
 */
export function compactSingleTableFKeys(cfg, options = {}) {
  const deletedKey = String(options.deletedKey || '').trim()
  const next = cloneSingleTableConfig(cfg)
  next.llm_config = next.llm_config || {}
  const mapping = next.field_mapping || {}
  const weights = { ...(next.llm_config.field_weights || {}) }
  const rules = { ...(next.llm_config.field_prompt_rules || {}) }

  if (deletedKey) {
    delete mapping[deletedKey]
    delete weights[deletedKey]
    delete rules[deletedKey]
  }

  const remainingFKeys = getFieldKeys(mapping).filter(isFKey)
  const renameMap = {}
  remainingFKeys.forEach((oldKey, i) => {
    const newKey = `F${i + 1}`
    if (oldKey !== newKey) renameMap[oldKey] = newKey
  })

  const needsRename = Object.keys(renameMap).length > 0
  if (!needsRename && !deletedKey) {
    next.field_mapping = mapping
    next.llm_config.field_weights = weights
    next.llm_config.field_prompt_rules = rules
    stripLegacyTopLevelKeys(next)
    return syncDerivedFields(next)
  }

  const resolveKey = (oldKey) => renameMap[oldKey] || oldKey
  const newMapping = {}
  const newWeights = {}
  const newRules = {}
  for (const oldKey of remainingFKeys) {
    const newKey = resolveKey(oldKey)
    newMapping[newKey] = mapping[oldKey]
    if (weights[oldKey] != null) newWeights[newKey] = weights[oldKey]
    if (rules[oldKey] != null) newRules[newKey] = rules[oldKey]
  }
  for (const k of getFieldKeys(mapping)) {
    if (isFKey(k)) continue
    newMapping[k] = mapping[k]
    if (weights[k] != null) newWeights[k] = weights[k]
    if (rules[k] != null) newRules[k] = rules[k]
  }

  next.field_mapping = newMapping
  next.llm_config.field_weights = newWeights
  next.llm_config.field_prompt_rules = newRules

  next.llm_config.veto_rules = remapOrDropFieldRefRules(
    next.llm_config.veto_rules,
    renameMap,
    deletedKey
  )
  next.llm_config.hard_rules = remapOrDropFieldRefRules(
    next.llm_config.hard_rules,
    renameMap,
    deletedKey
  )

  const validFKeys = remainingFKeys.map((k) => resolveKey(k))
  const phase = next.llm_config.phase_check_field
  if (deletedKey && phase === deletedKey) {
    next.llm_config.phase_check_field = validFKeys[0] || ''
  } else if (phase && renameMap[phase]) {
    next.llm_config.phase_check_field = renameMap[phase]
  }

  stripLegacyTopLevelKeys(next)
  return syncDerivedFields(next)
}

/**
 * 删除字段并重排 F 序号；同步 veto/hard/phase；清顶层遗留键
 * @param {object} cfg
 * @param {string} deletedKey
 */
export function removeSingleTableFieldAndRenumber(cfg, deletedKey) {
  const key = String(deletedKey || '').trim()
  if (!key) return cloneSingleTableConfig(cfg)

  const next = cloneSingleTableConfig(cfg)
  const mapping = next.field_mapping || {}
  if (!(key in mapping)) return syncDerivedFields(stripLegacyTopLevelKeys(next))

  if (!isFKey(key)) {
    delete mapping[key]
    next.field_mapping = mapping
    if (next.llm_config?.field_weights) delete next.llm_config.field_weights[key]
    if (next.llm_config?.field_prompt_rules) delete next.llm_config.field_prompt_rules[key]
    next.llm_config = next.llm_config || {}
    next.llm_config.veto_rules = remapOrDropFieldRefRules(next.llm_config.veto_rules, {}, key)
    next.llm_config.hard_rules = remapOrDropFieldRefRules(next.llm_config.hard_rules, {}, key)
    stripLegacyTopLevelKeys(next)
    return syncDerivedFields(next)
  }

  return compactSingleTableFKeys(next, { deletedKey: key })
}

/** @param {object} cfg */
export function countFKeys(cfg) {
  return getFieldKeys(cfg?.field_mapping || {}).filter(isFKey).length
}

export function syncDerivedFields(cfg) {
  const result = cloneSingleTableConfig()
  Object.assign(result, cloneSingleTableConfig())
  Object.assign(result, JSON.parse(JSON.stringify(cfg || {})))
  const mapping = result.field_mapping || {}
  const llm = result.llm_config || {}
  const weights = llm.field_weights || {}
  const rules = llm.field_prompt_rules || {}
  const logical = {}
  const columns = []
  const seen = new Set()
  for (const fkey of getFieldKeys(mapping)) {
    const entry = mapping[fkey] || {}
    const col = String(entry.excel_column || '').trim()
    logical[fkey] = col
    if (col && !seen.has(col)) {
      seen.add(col)
      columns.push(col)
    }
  }
  for (const col of result.auxiliary_columns || []) {
    const c = String(col).trim()
    if (c && !seen.has(c)) {
      seen.add(c)
      columns.push(c)
    }
  }
  for (const fkey of Object.keys(weights)) {
    if (!(fkey in mapping)) delete weights[fkey]
  }
  for (const fkey of Object.keys(rules)) {
    if (!(fkey in mapping)) delete rules[fkey]
  }
  result.logical_field_mapping = logical
  result.columns_to_read = columns
  if (!result.llm_config) result.llm_config = {}
  // 判定阈值统一为大于等于
  result.llm_config.threshold_comparison = 'gte'
  // 顶层 threshold（配置页「判定阈值」）与 llm_config.threshold 对齐
  if (result.threshold != null && result.threshold !== '') {
    result.llm_config.threshold = Number(result.threshold)
  } else if (result.llm_config.threshold != null && result.llm_config.threshold !== '') {
    result.threshold = Number(result.llm_config.threshold)
  }
  return result
}

export function migrateLegacyEngineeringConfig(raw, mode = 'duplicate') {
  const src = JSON.parse(JSON.stringify(raw || {}))
  if (src.field_mapping) return src
  if (!src.field_weights) return src

  const fieldMapping = {}
  const llmWeights = {}
  const llmRules = {}
  let idx = 1
  for (const [col, weight] of Object.entries(src.field_weights || {})) {
    const fkey = `F${idx++}`
    fieldMapping[fkey] = {
      excel_column: col,
      compare_type: col.includes('投资') ? (mode === 'parent_child' ? 'investment_gt' : 'investment_diff') : 'similarity',
      threshold: col.includes('投资') ? 0.04 : 0.8,
      skip_if_both_empty: false,
      count_toward_min_match: true,
      value_normalizer: col.includes('投资') ? 'float' : 'none'
    }
    llmWeights[fkey] = Number(weight)
    llmRules[fkey] = (src.field_rules || {})[col] || ''
  }

  const vetoRules = []
  for (const [col, minScore] of Object.entries((src.hard_rules || {}).veto_min_scores || {})) {
    const fkey = Object.entries(fieldMapping).find(([, e]) => e.excel_column === col)?.[0]
    if (fkey) vetoRules.push({ field: fkey, min_score: minScore, message: `${col}评分过低` })
  }

  return syncDerivedFields({
    threshold: src.threshold ?? (mode === 'parent_child' ? 3.4 : 3.35),
    field_mapping: fieldMapping,
    llm_config: {
      field_weights: llmWeights,
      field_prompt_rules: llmRules,
      hard_rules: [],
      veto_rules: vetoRules,
      phase_check_field: 'F1',
      phase_check_enabled: mode === 'duplicate',
      additional_prompt: src.prompt || '',
      strict_negative_prompt: src.strict_negative_prompt || '',
      output_schema: mode === 'parent_child' ? 'parent_child_v1' : 'duplicate_v1',
      threshold_comparison: 'gte',
      arbitration: { enabled: mode === 'parent_child', lower_delta: 0.25, upper_delta: 0.2, prefer: 'system' },
      system_rules: mode === 'duplicate' ? { phase_keywords: ['一期', '二期', '1期', '2期'] } : {}
    },
    prescreen_config: {
      min_match_fields: (src.suspect_rules || {}).min_match_count ?? 2,
      investment_gt_direction: mode === 'parent_child' ? 'current_gt_other' : 'bidirectional',
      investment_fallback_pairs: false
    },
    auxiliary_columns: src.auxiliary_fields || ['文件名称', 'source_file'],
    column_aliases: src.field_aliases || {},
    _migrated_from_legacy: true
  })
}

export function validateSingleTableConfig(cfg, mode = 'duplicate') {
  const mapping = cfg?.field_mapping || {}
  if (!Object.keys(mapping).length) {
    throw new Error('field_mapping 不能为空，请先选择提示词模板')
  }
  const llm = cfg.llm_config || {}
  const weights = llm.field_weights || {}
  const posSum = Object.values(weights).reduce((a, w) => a + (Number(w) > 0 ? Number(w) : 0), 0)
  if (posSum <= 0) throw new Error('field_weights 正权重之和必须大于 0')
  if (Math.abs(posSum - 1) > 0.02) throw new Error(`field_weights 正权重之和应为 1，当前为 ${posSum.toFixed(4)}`)
  for (const [fkey, entry] of Object.entries(mapping)) {
    const ct = entry.compare_type || 'similarity'
    if (mode === 'duplicate' && ct === 'investment_gt') {
      throw new Error('重复检测不允许 compare_type=investment_gt')
    }
    if (Number(weights[fkey]) > 0 && !String((llm.field_prompt_rules || {})[fkey] || '').trim()) {
      throw new Error(`权重>0 的字段 ${fkey} 必须配置 field_prompt_rules`)
    }
  }
}

export function prepareSingleTableConfig(raw, { mode = 'duplicate', validate = true } = {}) {
  let src = JSON.parse(JSON.stringify(raw || {}))
  if (src.field_weights && !src.field_mapping) {
    src = migrateLegacyEngineeringConfig(src, mode)
  }
  const synced = syncDerivedFields(src)
  if (validate) validateSingleTableConfig(synced, mode)
  return synced
}

export function getFieldScoreLabels(cfg) {
  return { ...(cfg.logical_field_mapping || {}) }
}

export function configToDict(cfg) {
  return JSON.parse(JSON.stringify(cfg))
}

export function ensureSingleTableShape(block, mode = 'duplicate') {
  if (!block) return createEmptySingleTableConfig(mode)
  if (block.field_mapping) return prepareSingleTableConfig(block, { mode, validate: false })
  return prepareSingleTableConfig(block, { mode, validate: false })
}

export function sumFieldWeights(weights) {
  const w = weights && typeof weights === 'object' ? weights : {}
  return Object.values(w).reduce((acc, v) => acc + (Number(v) > 0 ? Number(v) : 0), 0)
}
