// @ts-nocheck
// Original domain helper, retained verbatim; see docs/API-CONTRACT.md.
import { createEmptyCompareConfig } from './associationTwoTablesConstants.js'
import {
  DEFAULT_INVESTMENT_FIELD_RULE,
  shouldUseDefaultInvestmentFieldRule
} from '../engineeringProject/engineeringProjectConstants.js'

export { DEFAULT_INVESTMENT_FIELD_RULE } from '../engineeringProject/engineeringProjectConstants.js'

export const COMPARE_TYPE_OPTIONS = [
  { label: '相似度', value: 'similarity' },
  { label: '金额差异', value: 'investment_diff' },
  { label: '完全相等', value: 'exact' }
]

const VALID_COMPARE_TYPES = new Set(['similarity', 'investment_diff', 'exact'])

export function cloneCompareConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg || createEmptyCompareConfig()))
}

/** @param {object} mapping */
export function getCompareFieldKeys(mapping) {
  if (!mapping || typeof mapping !== 'object') return []
  const keys = Object.keys(mapping)
  const fKeys = keys.filter((k) => /^F\d+$/i.test(k))
  const otherKeys = keys.filter((k) => !/^F\d+$/i.test(k))
  fKeys.sort((a, b) => parseInt(/^F(\d+)$/i.exec(a)[1], 10) - parseInt(/^F(\d+)$/i.exec(b)[1], 10))
  return [...fKeys, ...otherKeys]
}

/** @param {Record<string, number>|undefined|null} weights */
export function sumFieldWeights(weights) {
  const w = weights && typeof weights === 'object' ? weights : {}
  return Object.values(w).reduce((acc, v) => acc + (Number(v) || 0), 0)
}

export function defaultThresholdForCompareType(compareType) {
  if (compareType === 'investment_diff') return 0.04
  if (compareType === 'exact') return 0
  return 0.8
}

export function createDefaultMappingEntry(compareType = 'similarity') {
  return {
    table1_field: '',
    table2_field: '',
    threshold: defaultThresholdForCompareType(compareType),
    compare_type: compareType
  }
}

export const DEFAULT_SIMILARITY_PROMPT_RULE =
  '5分：完全相同\n4分：主要指标相同，仅表述差异\n3分：核心内容相同且至少一项具体数值相同\n2分：核心内容相同但具体数值不同\n1分：仅部分关键词相同但主题相关\n0分：完全不同'

/** 投资额差异字段：将空值或旧版占位文案规范为完整系统计分规则 */
export function normalizeInvestmentFieldPromptRule(ruleText) {
  if (shouldUseDefaultInvestmentFieldRule(ruleText)) {
    return DEFAULT_INVESTMENT_FIELD_RULE
  }
  return ruleText != null ? String(ruleText) : ''
}

const LEGACY_KEY_TO_F = {
  name: 'F1',
  content: 'F2',
  addr: 'F3',
  invest: 'F4'
}

const LEGACY_KEY_DISPLAY = {
  name: '对比列 1',
  content: '对比列 2',
  addr: '对比列 3',
  invest: '对比列 4'
}

const SYSTEM_KEY_DISPLAY = {
  industry: '行业',
  code: '编码'
}

/** 从 mapping 的 key 解析 F 序号（用于 UI 展示） */
export function fieldKeyToDisplayLabel(key) {
  const k = String(key || '')
  const m = /^F(\d+)$/i.exec(k)
  if (m) return `对比列 ${m[1]}`
  if (LEGACY_KEY_DISPLAY[k]) return LEGACY_KEY_DISPLAY[k]
  if (SYSTEM_KEY_DISPLAY[k]) return SYSTEM_KEY_DISPLAY[k]
  return k
}

/** 分配下一个逻辑 key：F1、F2… */
export function allocateNextFieldKey(mapping) {
  const keys = Object.keys(mapping || {})
  let max = 0
  for (const k of keys) {
    const m = /^F(\d+)$/i.exec(k)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `F${max + 1}`
}

/** 旧版 name/content/addr/invest 逐键迁移为 F1～F4 */
export function migrateLegacyFieldKeys(cfg) {
  const next = cloneCompareConfig(cfg)
  const mapping = next.field_comparison_mapping || {}
  if (mapping.F1 != null) return next

  let result = next
  for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_TO_F)) {
    if (result.field_comparison_mapping?.[oldKey] != null) {
      result = renameCompareField(result, oldKey, newKey)
    }
  }

  const phase = result.llm_config?.phase_check_field
  if (phase && LEGACY_KEY_TO_F[phase] && result.field_comparison_mapping?.[LEGACY_KEY_TO_F[phase]]) {
    result.llm_config.phase_check_field = LEGACY_KEY_TO_F[phase]
  }
  return result
}

export function normalizeCompareTypes(cfg) {
  const mapping = cfg.field_comparison_mapping || {}
  for (const entry of Object.values(mapping)) {
    if (!entry || typeof entry !== 'object') continue
    const ct = entry.compare_type
    if (!ct || ct === 'none' || !VALID_COMPARE_TYPES.has(ct)) {
      entry.compare_type = 'similarity'
    }
  }
  return cfg
}

function similarityKeys(mapping) {
  return Object.entries(mapping || {})
    .filter(([, e]) => e?.compare_type === 'similarity' || !e?.compare_type)
    .map(([k]) => k)
}

function investmentKeys(mapping) {
  return Object.entries(mapping || {})
    .filter(([, e]) => e?.compare_type === 'investment_diff')
    .map(([k]) => k)
}

function exactKeys(mapping) {
  return Object.entries(mapping || {})
    .filter(([, e]) => e?.compare_type === 'exact')
    .map(([k]) => k)
}

function resolveLegacyFieldTarget(legacyField, mapping, exactKey) {
  if (legacyField === 'industry') return null
  if (LEGACY_KEY_TO_F[legacyField] && mapping[LEGACY_KEY_TO_F[legacyField]]) {
    return LEGACY_KEY_TO_F[legacyField]
  }
  const sim = similarityKeys(mapping)
  if (legacyField === 'name' && sim[0]) return sim[0]
  if (legacyField === 'content' && sim[1]) return sim[1]
  if (legacyField === 'addr' && sim[2]) return sim[2]
  if (legacyField === 'invest') {
    const inv = investmentKeys(mapping)
    return inv[0] || null
  }
  if (legacyField === 'code') {
    if (exactKey && mapping[exactKey]) return exactKey
    const ex = exactKeys(mapping)
    return ex[0] || null
  }
  return null
}

function migrateRuleFields(rule, mapping, exactKey) {
  if (!rule || typeof rule !== 'object') return null
  const next = { ...rule }
  if (next.field) {
    if (next.field === 'industry') return null
    const target = resolveLegacyFieldTarget(next.field, mapping, exactKey)
    if (target) next.field = target
    else if (LEGACY_KEY_TO_F[next.field] || next.field === 'code') return null
  }
  if (next.logic === 'and' && Array.isArray(next.rules)) {
    const sub = next.rules.map((r) => migrateRuleFields(r, mapping, exactKey)).filter(Boolean)
    if (!sub.length) return null
    next.rules = sub
  }
  return next
}

export function migrateHardRuleFields(cfg, exactKey = null) {
  const mapping = cfg.field_comparison_mapping || {}
  cfg.llm_config = cfg.llm_config || {}
  const rules = cfg.llm_config.hard_rules
  if (Array.isArray(rules)) {
    cfg.llm_config.hard_rules = rules.map((r) => migrateRuleFields(r, mapping, exactKey)).filter(Boolean)
  }
  const phase = cfg.llm_config.phase_check_field
  if (phase) {
    const target = resolveLegacyFieldTarget(phase, mapping, exactKey)
    if (target) cfg.llm_config.phase_check_field = target
    else if (phase === 'industry' || LEGACY_KEY_TO_F[phase]) {
      const sim = similarityKeys(mapping)
      if (sim[0]) cfg.llm_config.phase_check_field = sim[0]
    }
  }
  return cfg
}

export function migrateCodeMatchToExactField(cfg) {
  const codeCfg = cfg.code_match_config || {}
  const t1 = String(codeCfg.table1_code_field || '').trim()
  const t2 = String(codeCfg.table2_code_field || '').trim()
  if (!t1 || !t2) return { cfg, exactKey: null }

  const mapping = cfg.field_comparison_mapping || {}
  const exists = Object.values(mapping).some(
    (e) => e?.compare_type === 'exact' && e.table1_field === t1 && e.table2_field === t2
  )
  if (exists) return { cfg, exactKey: null }

  const newKey = allocateNextFieldKey(mapping)
  cfg.field_comparison_mapping = {
    ...mapping,
    [newKey]: {
      table1_field: t1,
      table2_field: t2,
      threshold: 0,
      compare_type: 'exact'
    }
  }
  syncLlmFieldsFromMapping(cfg)
  return { cfg, exactKey: newKey }
}

/** mapping 中已无与 code_match_config 对应的 exact 字段时，清空遗留编码配置，避免预览/提交反复注入 */
export function clearStaleCodeMatchConfig(cfg) {
  const codeCfg = cfg.code_match_config || {}
  const t1 = String(codeCfg.table1_code_field || '').trim()
  const t2 = String(codeCfg.table2_code_field || '').trim()
  if (!t1 && !t2) return cfg

  const mapping = cfg.field_comparison_mapping || {}
  const hasExact = Object.values(mapping).some(
    (e) => e?.compare_type === 'exact' && e.table1_field === t1 && e.table2_field === t2
  )
  if (!hasExact) {
    cfg.code_match_config = {
      table1_code_field: '',
      table2_code_field: '',
      validation_pattern: ''
    }
  }
  return cfg
}

export function buildFieldLabelMap(cfg) {
  const mapping = cfg.field_comparison_mapping || {}
  const labels = {}
  for (const [key, entry] of Object.entries(mapping)) {
    const label = String(entry?.label || '').trim()
    labels[key] = label || key
  }
  return labels
}

export function validateCompareConfigReady(cfg) {
  const mapping = cfg?.field_comparison_mapping || {}
  const keys = Object.keys(mapping)
  if (!keys.length) return false
  for (const entry of Object.values(mapping)) {
    if (!String(entry?.table1_field || '').trim() || !String(entry?.table2_field || '').trim()) {
      return false
    }
  }
  const weights = cfg?.llm_config?.field_weights || {}
  if (!Object.keys(weights).length) return false
  return Math.abs(sumFieldWeights(weights) - 1) <= 0.01
}

/** 提示词模板首次加载：含 code_match_config → exact 字段的一次性迁移 */
export function applyCompareConfigMigration(cfg) {
  let next = migrateLegacyFieldKeys(cloneCompareConfig(cfg))
  const { cfg: withExact, exactKey } = migrateCodeMatchToExactField(next)
  next = withExact
  next = migrateHardRuleFields(next, exactKey)
  next = normalizeCompareTypes(next)
  syncCompareDerivedFields(next)
  return next
}

/** 预览/提交：仅同步派生字段，不再从 code_match_config 回填 exact 字段 */
function prepareCompareConfigForSubmit(cfg) {
  let next = migrateLegacyFieldKeys(cloneCompareConfig(cfg))
  next = clearStaleCodeMatchConfig(next)
  next = migrateHardRuleFields(next, null)
  next = normalizeCompareTypes(next)
  syncCompareDerivedFields(next)
  return next
}

function defaultPromptRuleForEntry(entry) {
  if (entry?.compare_type === 'investment_diff') return DEFAULT_INVESTMENT_FIELD_RULE
  return DEFAULT_SIMILARITY_PROMPT_RULE
}

/** 将 mapping 中 investment_diff 字段的旧版占位规则替换为完整计分说明 */
export function normalizeInvestmentFieldPromptRules(cfg) {
  const mapping = cfg.field_comparison_mapping || {}
  cfg.llm_config = cfg.llm_config || {}
  const rules = { ...(cfg.llm_config.field_prompt_rules || {}) }
  for (const [key, entry] of Object.entries(mapping)) {
    if (entry?.compare_type !== 'investment_diff') continue
    rules[key] = normalizeInvestmentFieldPromptRule(rules[key])
  }
  cfg.llm_config.field_prompt_rules = rules
  return cfg
}

/** 合并字段列表，保留原有顺序并追加新列 */
function unionFieldsPreserveOrder(existing, additions) {
  const out = [...(Array.isArray(existing) ? existing : [])]
  for (const field of additions || []) {
    const f = String(field || '').trim()
    if (f && !out.includes(f)) out.push(f)
  }
  return out
}

/** 从 logical_field_mapping 提取表一/表二列名 */
function collectFieldsFromLogical(logical) {
  const t1 = []
  const t2 = []
  if (!logical || typeof logical !== 'object') return { t1, t2 }
  for (const pair of Object.values(logical)) {
    if (!Array.isArray(pair)) continue
    const f1 = String(pair[0] || '').trim()
    const f2 = String(pair[1] || '').trim()
    if (f1 && !t1.includes(f1)) t1.push(f1)
    if (f2 && !t2.includes(f2)) t2.push(f2)
  }
  return { t1, t2 }
}

/**
 * 确保 llm_config 的 weights / rules 与 field_comparison_mapping 键一致
 * @param {object} cfg compare_config
 */
export function syncLlmFieldsFromMapping(cfg) {
  const mapping = cfg.field_comparison_mapping || {}
  const keys = Object.keys(mapping)
  cfg.llm_config = cfg.llm_config || {}
  const weights = { ...(cfg.llm_config.field_weights || {}) }
  const rules = { ...(cfg.llm_config.field_prompt_rules || {}) }

  for (const key of keys) {
    if (weights[key] == null) weights[key] = keys.length === 1 ? 1 : 0
    const entry = mapping[key]
    if (entry?.compare_type === 'investment_diff') {
      rules[key] = normalizeInvestmentFieldPromptRule(rules[key])
    } else if (!String(rules[key] || '').trim()) {
      rules[key] = defaultPromptRuleForEntry(entry)
    }
  }
  for (const key of Object.keys(weights)) {
    if (!(key in mapping)) {
      delete weights[key]
      delete rules[key]
    }
  }
  cfg.llm_config.field_weights = weights
  cfg.llm_config.field_prompt_rules = rules
  return normalizeInvestmentFieldPromptRules(cfg)
}

/**
 * 从 investment_diff 映射汇总数值解析字段
 * @param {object} cfg compare_config
 */
export function syncNumericFieldsFromMapping(cfg) {
  const mapping = cfg.field_comparison_mapping || {}
  const derivedT1 = []
  const derivedT2 = []
  for (const entry of Object.values(mapping)) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.compare_type !== 'investment_diff') continue
    const f1 = String(entry.table1_field || '').trim()
    const f2 = String(entry.table2_field || '').trim()
    if (f1 && !derivedT1.includes(f1)) derivedT1.push(f1)
    if (f2 && !derivedT2.includes(f2)) derivedT2.push(f2)
  }
  cfg.table1_numeric_fields = [...derivedT1]
  cfg.table2_numeric_fields = [...derivedT2]
  return cfg
}

/** 提交前/映射变更后：同步 table fields、logical/complete mapping、numeric fields */
export function syncCompareDerivedFields(cfg) {
  syncTableFieldsFromMapping(cfg)
  return cfg
}

/**
 * 从 mapping 同步派生字段：logical/complete/table fields 均按当前 mapping 重建。
 * table1_fields / table2_fields 仅含 field_comparison_mapping 列名及已配置的编码列，
 * 不包含模板残留的 industry 等系统 logical 列，避免预览与提交出现用户未配置的字段。
 * @param {object} cfg compare_config
 */
export function syncTableFieldsFromMapping(cfg) {
  const mapping = cfg.field_comparison_mapping || {}

  const logicalUpdates = {}
  const mappingT1 = []
  const mappingT2 = []
  const complete = {}

  for (const [key, entry] of Object.entries(mapping)) {
    if (!entry || typeof entry !== 'object') continue
    const f1 = String(entry.table1_field || '').trim()
    const f2 = String(entry.table2_field || '').trim()
    if (f1 && !mappingT1.includes(f1)) mappingT1.push(f1)
    if (f2 && !mappingT2.includes(f2)) mappingT2.push(f2)
    if (f1 || f2) {
      logicalUpdates[key] = [f1, f2]
    }
    if (f1 && f2) {
      complete[f1] = f2
    }
  }

  const logical = { ...logicalUpdates }

  cfg.logical_field_mapping = logical
  cfg.complete_field_mapping = complete

  cfg.table1_fields = unionFieldsPreserveOrder([], mappingT1)
  cfg.table2_fields = unionFieldsPreserveOrder([], mappingT2)

  syncNumericFieldsFromMapping(cfg)
  return cfg
}

/** @param {object} cfg @param {string} logicalKey */
export function addCompareField(cfg, logicalKey, entry) {
  const next = cloneCompareConfig(cfg)
  const key = String(logicalKey || '').trim()
  if (!key) return next
  next.field_comparison_mapping = { ...(next.field_comparison_mapping || {}) }
  next.field_comparison_mapping[key] = entry || createDefaultMappingEntry()
  syncLlmFieldsFromMapping(next)
  syncTableFieldsFromMapping(next)
  return next
}

/** @param {object} cfg @param {string} logicalKey */
export function removeCompareField(cfg, logicalKey) {
  const next = cloneCompareConfig(cfg)
  if (next.field_comparison_mapping) {
    delete next.field_comparison_mapping[logicalKey]
  }
  syncLlmFieldsFromMapping(next)
  clearStaleCodeMatchConfig(next)
  syncTableFieldsFromMapping(next)
  return next
}

function remapHardRuleFieldRefs(hardRules, renameMap, deletedKey, validFKeys) {
  if (!Array.isArray(hardRules)) return hardRules
  const fallbackF = validFKeys[0] || 'F1'
  const isFKey = (k) => /^F\d+$/i.test(String(k || ''))

  const remapField = (field) => {
    const f = String(field || '')
    if (f === 'industry' || f === 'code') return f
    if (f === deletedKey && isFKey(deletedKey)) return fallbackF
    if (renameMap[f]) return renameMap[f]
    return f
  }

  return hardRules.map((rule) => {
    if (!rule || typeof rule !== 'object') return rule
    const next = { ...rule }
    if (next.field) next.field = remapField(next.field)
    if (next.logic === 'and' && Array.isArray(next.rules)) {
      next.rules = next.rules.map((sub) => {
        if (!sub || typeof sub !== 'object') return sub
        return { ...sub, field: sub.field ? remapField(sub.field) : sub.field }
      })
    }
    return next
  })
}

/**
 * 删除对比字段并重排 F 序号；同步 hard_rules 引用
 * @param {object} cfg compare_config
 * @param {string} deletedKey 待删除的逻辑 key
 */
export function removeCompareFieldAndRenumber(cfg, deletedKey) {
  const key = String(deletedKey || '').trim()
  if (!key) return cloneCompareConfig(cfg)

  const next = cloneCompareConfig(cfg)
  const mapping = next.field_comparison_mapping || {}
  if (!(key in mapping)) return next

  if (!/^F\d+$/i.test(key)) {
    const removed = removeCompareField(next, key)
    const validFKeys = getCompareFieldKeys(removed.field_comparison_mapping).filter((k) =>
      /^F\d+$/i.test(k)
    )
    if (Array.isArray(removed.llm_config?.hard_rules)) {
      removed.llm_config.hard_rules = remapHardRuleFieldRefs(
        removed.llm_config.hard_rules,
        {},
        key,
        validFKeys
      )
    }
    return removed
  }

  next.llm_config = next.llm_config || {}
  const weights = { ...(next.llm_config.field_weights || {}) }
  const rules = { ...(next.llm_config.field_prompt_rules || {}) }
  delete next.field_comparison_mapping[key]
  delete weights[key]
  delete rules[key]

  const remainingFKeys = getCompareFieldKeys(next.field_comparison_mapping).filter((k) =>
    /^F\d+$/i.test(k)
  )
  const renameMap = {}
  remainingFKeys.forEach((oldKey, i) => {
    const newKey = `F${i + 1}`
    if (oldKey !== newKey) renameMap[oldKey] = newKey
  })

  const resolveKey = (oldKey) => renameMap[oldKey] || oldKey

  const newMapping = {}
  const newWeights = {}
  const newRules = {}
  for (const oldKey of remainingFKeys) {
    const newKey = resolveKey(oldKey)
    newMapping[newKey] = next.field_comparison_mapping[oldKey]
    if (weights[oldKey] != null) newWeights[newKey] = weights[oldKey]
    if (rules[oldKey] != null) newRules[newKey] = rules[oldKey]
  }
  for (const k of getCompareFieldKeys(next.field_comparison_mapping)) {
    if (/^F\d+$/i.test(k)) continue
    newMapping[k] = next.field_comparison_mapping[k]
    if (weights[k] != null) newWeights[k] = weights[k]
    if (rules[k] != null) newRules[k] = rules[k]
  }

  next.field_comparison_mapping = newMapping
  next.llm_config.field_weights = newWeights
  next.llm_config.field_prompt_rules = newRules

  const validFKeys = remainingFKeys.map((k) => resolveKey(k))
  next.llm_config.hard_rules = remapHardRuleFieldRefs(
    next.llm_config.hard_rules,
    renameMap,
    key,
    validFKeys
  )

  const phase = next.llm_config.phase_check_field
  if (phase === key) {
    next.llm_config.phase_check_field = validFKeys[0] || ''
  } else if (phase && renameMap[phase]) {
    next.llm_config.phase_check_field = renameMap[phase]
  }

  syncLlmFieldsFromMapping(next)
  clearStaleCodeMatchConfig(next)
  syncTableFieldsFromMapping(next)
  return next
}

/** @param {object} cfg @param {string} oldKey @param {string} newKey */
export function renameCompareField(cfg, oldKey, newKey) {
  const next = cloneCompareConfig(cfg)
  const mapping = next.field_comparison_mapping || {}
  if (!mapping[oldKey] || oldKey === newKey) return next
  if (mapping[newKey]) return next
  next.field_comparison_mapping = { ...mapping }
  next.field_comparison_mapping[newKey] = mapping[oldKey]
  delete next.field_comparison_mapping[oldKey]

  const w = next.llm_config?.field_weights || {}
  const r = next.llm_config?.field_prompt_rules || {}
  if (w[oldKey] != null) {
    w[newKey] = w[oldKey]
    delete w[oldKey]
  }
  if (r[oldKey] != null) {
    r[newKey] = r[oldKey]
    delete r[oldKey]
  }

  const logical = next.logical_field_mapping || {}
  if (logical[oldKey] != null) {
    logical[newKey] = logical[oldKey]
    delete logical[oldKey]
  }

  syncTableFieldsFromMapping(next)
  return next
}

/** @param {object} cfg @param {object} mapping */
export function applyMappingUpdate(cfg, mapping) {
  const next = cloneCompareConfig(cfg)
  next.field_comparison_mapping = { ...mapping }
  syncLlmFieldsFromMapping(next)
  clearStaleCodeMatchConfig(next)
  syncTableFieldsFromMapping(next)
  return next
}

const DEFAULT_MATCH_LOCK_POLICY = {
  lock_on_full_match: true,
  lock_on_partial_match: false,
  lock_table2_on_full_match: true,
  lock_table1_on_full_match: true
}

/** 缺省或未识别值 → batch；仅显式 'standard' 为标准模式 */
export function resolvePerformanceMode(cfg) {
  return cfg?.performance_mode === 'standard' ? 'standard' : 'batch'
}

/** 提交前补全性能相关缺省（不覆盖用户已填值） */
export function ensurePerformanceConfigDefaults(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg
  if (cfg.performance_mode !== 'standard' && cfg.performance_mode !== 'batch') {
    cfg.performance_mode = 'batch'
  }
  if (cfg.max_llm_pairs_per_table1_row == null) {
    cfg.max_llm_pairs_per_table1_row = 5
  }
  if (cfg.max_total_llm_pairs == null) {
    cfg.max_total_llm_pairs = 10000
  }
  if (!cfg.match_lock_policy || typeof cfg.match_lock_policy !== 'object') {
    cfg.match_lock_policy = { ...DEFAULT_MATCH_LOCK_POLICY }
  } else {
    cfg.match_lock_policy = { ...DEFAULT_MATCH_LOCK_POLICY, ...cfg.match_lock_policy }
  }
  return cfg
}

/** 提交前移除 field_comparison_mapping 中的 label（prompt/导出统一使用 F1、F2 等逻辑键） */
function stripFieldMappingLabels(cfg) {
  const mapping = cfg.field_comparison_mapping || {}
  for (const key of Object.keys(mapping)) {
    const entry = mapping[key]
    if (entry && typeof entry === 'object' && entry.label != null) {
      const next = { ...entry }
      delete next.label
      mapping[key] = next
    }
  }
}

/**
 * 提交任务前：同步派生字段，并规范化 llm_config.additional_prompt
 * @param {object} compareConfig
 */
export function finalizeCompareConfigForSubmit(compareConfig) {
  let cfg = prepareCompareConfigForSubmit(compareConfig)
  stripFieldMappingLabels(cfg)
  cfg.code_match_config = {
    table1_code_field: '',
    table2_code_field: '',
    validation_pattern: ''
  }
  syncCompareDerivedFields(cfg)
  normalizeInvestmentFieldPromptRules(cfg)
  cfg.llm_config = cfg.llm_config || {}
  const text = String(cfg.llm_config.additional_prompt || '').trim()
  if (text) {
    cfg.llm_config.additional_prompt = text
  } else {
    delete cfg.llm_config.additional_prompt
  }
  return ensurePerformanceConfigDefaults(cfg)
}

/**
 * 构建与任务提交、/compare 请求一致的 config 对象（只读）
 * @param {object} compareConfig 功能配置中的 compare_config
 * @returns {object}
 */
export function buildCompareConfigForApi(compareConfig) {
  return finalizeCompareConfigForSubmit(cloneCompareConfig(compareConfig))
}

/**
 * 格式化为 JSON 预览字符串
 * @param {object} compareConfig
 * @returns {string}
 */
export function formatCompareConfigPreviewJson(compareConfig) {
  return JSON.stringify(buildCompareConfigForApi(compareConfig), null, 2)
}
