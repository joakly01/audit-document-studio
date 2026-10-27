// @ts-nocheck
// Original domain helper, retained verbatim; see docs/API-CONTRACT.md.
/** 仅用于结果展示等场景的兜底（配置页不再使用） */
export const DEFAULT_DUPLICATE_FIELD_WEIGHTS = {
  项目名称: 0.15,
  总投资_万元: 0.3,
  项目详细建设地点: 0.2,
  建设规模及内容_生产能力: 0.2,
  单位名称: 0.15
}

export const DEFAULT_PARENT_CHILD_FIELD_WEIGHTS = {
  项目名称: 0.4,
  总投资_万元: 0,
  项目详细建设地点: 0.15,
  建设规模及内容_生产能力: 0.3,
  单位名称: 0.15
}

export const DEFAULT_DUPLICATE_THRESHOLD = 3.35
export const DEFAULT_PARENT_CHILD_THRESHOLD = 3.4

/** 总投资_万元默认评分规则（与示例市乙侧 DEFAULT_INVESTMENT_FIELD_RULE 一致） */
export const DEFAULT_INVESTMENT_FIELD_RULE = `5分：完全相同（所有项目投资金额完全相等）
4分：0<误差比值≤1%
3分：1%<误差比值≤2%
2分：2%<误差比值≤3%
1分：3%<误差比值≤4%
0分：4%<误差比值`

/** 历史模板中「金额由系统计分」类文案，加载时替换为 DEFAULT_INVESTMENT_FIELD_RULE */
const LEGACY_INVESTMENT_RULE_MARKERS = ['由系统计算评分', '不需要打评分', '你不需要打评分']

/**
 * 是否应将总投资_万元规则视为旧版占位（需替换为默认提示词）
 * @param {string|undefined|null} ruleText
 * @returns {boolean}
 */
export function shouldUseDefaultInvestmentFieldRule(ruleText) {
  const t = ruleText != null ? String(ruleText).trim() : ''
  if (!t) return true
  return LEGACY_INVESTMENT_RULE_MARKERS.some((m) => t.includes(m))
}

/**
 * 规范化单字段评分规则（仅总投资_万元做 legacy 替换）
 * @param {string} fieldKey
 * @param {string|undefined|null} ruleText
 * @returns {string}
 */
export function normalizeFieldRuleText(fieldKey, ruleText, roleFields = null) {
  const investmentKey = roleFields?.investment || '总投资_万元'
  if (fieldKey !== investmentKey) {
    return ruleText != null ? String(ruleText) : ''
  }
  if (shouldUseDefaultInvestmentFieldRule(ruleText)) {
    return DEFAULT_INVESTMENT_FIELD_RULE
  }
  return String(ruleText)
}

/** 配置页初始空状态，等待提示词中心加载 */
export function createEmptyDuplicateDetectionConfig() {
  return {
    threshold: DEFAULT_DUPLICATE_THRESHOLD,
    field_weights: {},
    field_rules: {},
    prompt: '',
    role_fields: {},
    suspect_rules: {},
    hard_rules: {},
    auxiliary_fields: ['文件名称', 'source_file'],
    field_aliases: {
      建设规模及内容: '建设规模及内容_生产能力',
      计划开始时间: '计划开工时间'
    }
  }
}

export function createEmptyParentChildAnalysisConfig() {
  return {
    threshold: DEFAULT_PARENT_CHILD_THRESHOLD,
    field_weights: {},
    field_rules: {},
    prompt: '',
    role_fields: {},
    suspect_rules: {},
    hard_rules: {},
    auxiliary_fields: ['文件名称'],
    field_aliases: {
      建设规模及内容: '建设规模及内容_生产能力',
      计划开始时间: '计划开工时间'
    }
  }
}

/** @deprecated 仅兼容旧引用，新代码请用 createEmpty* + 提示词模板加载 */
export function createDefaultDuplicateDetectionConfig() {
  return createEmptyDuplicateDetectionConfig()
}

/** @deprecated 仅兼容旧引用 */
export function createDefaultParentChildAnalysisConfig() {
  return createEmptyParentChildAnalysisConfig()
}

/** 字段 key → 结果表格行属性（历史别名） */
export const FIELD_ROW_PROP_ALIASES = {
  建设规模及内容_生产能力: '建设规模及内容'
}

/** @param {string} fieldKey */
export function fieldKeyToRowProp(fieldKey) {
  return FIELD_ROW_PROP_ALIASES[fieldKey] || fieldKey
}

/** @param {string} fieldKey */
export function fieldKeyToDisplayLabel(fieldKey) {
  if (fieldKey === '建设规模及内容_生产能力') return '建设规模及内容'
  return fieldKey
}

/**
 * 为 field_weights 中的字段补齐 field_rules（总投资_万元使用默认规则）
 * @param {Record<string, number>|undefined|null} weights
 * @param {Record<string, string>|undefined|null} rules
 */
export function mergeFieldRulesWithWeights(weights, rules) {
  const w = weights && typeof weights === 'object' ? weights : {}
  const r = rules && typeof rules === 'object' ? rules : {}
  const out = {}
  for (const key of Object.keys(w)) {
    out[key] = normalizeFieldRuleText(key, r[key])
  }
  return out
}

/** @param {Record<string, number>|undefined|null} weights */
export function getScoredFieldKeys(weights) {
  if (!weights || typeof weights !== 'object') return []
  return Object.keys(weights)
}

/** @param {Record<string, number>|undefined|null} weights */
export function sumFieldWeights(weights) {
  if (!weights || typeof weights !== 'object') return 0
  return getScoredFieldKeys(weights).reduce((sum, key) => sum + (Number(weights[key]) || 0), 0)
}

/** @param {number} w */
export function formatWeightLabel(w) {
  const n = Number(w)
  if (Number.isNaN(n)) return String(w ?? '')
  return String(Number(n.toFixed(2)))
}

/** @param {string} name @param {Record<string, number>|undefined} weights @param {string} key */
export function columnLabelWithWeight(name, weights, key) {
  const w = weights?.[key]
  if (w == null || w === '') return name
  return `${name}(权重${formatWeightLabel(w)})`
}
