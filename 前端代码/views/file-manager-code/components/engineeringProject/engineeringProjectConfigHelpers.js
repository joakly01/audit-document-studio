/**
 * 重复/主子配置归一化与校验（与 qingdao-langgraph / agent-icss 对齐）
 */
import {
  DEFAULT_DUPLICATE_FIELD_WEIGHTS,
  DEFAULT_DUPLICATE_THRESHOLD,
  DEFAULT_PARENT_CHILD_FIELD_WEIGHTS,
  DEFAULT_PARENT_CHILD_THRESHOLD,
  normalizeFieldRuleText
} from './engineeringProjectConstants.js'

export const DEFAULT_DUPLICATE_ROLE_FIELDS = {
  project_name: '项目名称',
  investment: '总投资_万元',
  location: '项目详细建设地点',
  scale: '建设规模及内容_生产能力',
  unit_name: '单位名称',
  plan_start: '计划开工时间',
  plan_end: '计划竣工时间',
  code_field: '项目统一编码24位码'
}

export const DEFAULT_PARENT_CHILD_ROLE_FIELDS = {
  project_name: '项目名称',
  investment: '总投资_万元',
  location: '项目详细建设地点',
  scale: '建设规模及内容_生产能力',
  unit_name: '单位名称',
  code_field: '项目统一编码24位码',
  plan_start: '计划开工时间',
  plan_end: '计划竣工时间'
}

export const DEFAULT_DUPLICATE_SUSPECT_RULES = {
  name_similarity_threshold: 0.8,
  location_similarity_threshold: 0.7,
  scale_similarity_threshold: 0.8,
  investment_diff_ratio: 0.04,
  min_match_count: 2,
  default_similarity_threshold: 0.8
}

export const DEFAULT_DUPLICATE_HARD_RULES = {
  phase_conflict_field: '项目名称',
  continuation_start_field: '计划开工时间',
  continuation_end_field: '计划竣工时间',
  continuation_check: true,
  veto_min_scores: {
    项目详细建设地点: 2.0,
    建设规模及内容_生产能力: 3.0
  }
}

export const DEFAULT_PARENT_CHILD_SUSPECT_RULES = {
  name_similarity_threshold: 0.7,
  location_similarity_threshold: 0.7,
  scale_similarity_threshold: 0.6,
  min_match_count: 2,
  investment_relation: 'parent_gt_child',
  investment_field: '总投资_万元'
}

export const DEFAULT_PARENT_CHILD_HARD_RULES = {
  threshold_strict: true,
  veto_min_scores: { 项目详细建设地点: 1.0 }
}

export const DEFAULT_FIELD_ALIASES = {
  建设规模及内容: '建设规模及内容_生产能力',
  计划开始时间: '计划开工时间'
}

export const DEFAULT_DUPLICATE_AUXILIARY_FIELDS = ['文件名称', 'source_file']
export const DEFAULT_PARENT_CHILD_AUXILIARY_FIELDS = ['文件名称']

const ROLE_FIELDS_IN_WEIGHTS = new Set([
  'project_name',
  'investment',
  'location',
  'scale',
  'unit_name'
])

const AUXILIARY_ROLES = new Set(['code_field', 'plan_start', 'plan_end'])

export const ROLE_FIELD_LABELS = {
  project_name: '项目名称',
  investment: '投资金额',
  location: '建设地点',
  scale: '建设规模',
  unit_name: '单位名称',
  code_field: '统一编码',
  plan_start: '计划开工时间',
  plan_end: '计划竣工时间'
}

function weightsNeedRoleMapping(fieldWeights, defaultRoleFields) {
  for (const role of ROLE_FIELDS_IN_WEIGHTS) {
    const defaultCol = defaultRoleFields[role]
    if (defaultCol && !(defaultCol in fieldWeights)) return true
  }
  return false
}

/**
 * @param {Record<string, number>} fieldWeights
 * @param {Record<string, string>|null|undefined} roleFields
 * @param {Record<string, string>} defaultRoleFields
 * @param {{ requireCodeField?: boolean }} [options]
 */
function migrateRoleFields(fieldWeights, roleFields, defaultRoleFields, options = {}) {
  const { requireCodeField = false } = options
  if (roleFields && Object.keys(roleFields).length > 0) {
    const result = {}
    for (const [role, defaultCol] of Object.entries(defaultRoleFields)) {
      if (!AUXILIARY_ROLES.has(role)) continue
      const explicit = roleFields[role]
      if (explicit != null && String(explicit).trim()) {
        result[role] = String(explicit).trim()
      } else if (requireCodeField && role === 'code_field' && defaultCol) {
        // 主子编码匹配：缺省时回填默认编码列
        result[role] = String(defaultCol).trim()
      }
    }
    for (const role of ROLE_FIELDS_IN_WEIGHTS) {
      if (roleFields[role]) {
        result[role] = String(roleFields[role]).trim()
      } else {
        const defaultCol = defaultRoleFields[role]
        if (defaultCol in fieldWeights) result[role] = defaultCol
      }
    }
    return result
  }
  if (weightsNeedRoleMapping(fieldWeights, defaultRoleFields)) {
    throw new Error('field_weights 已修改列名但未配置 role_fields，请完成语义字段映射')
  }
  const result = {}
  for (const [role, defaultCol] of Object.entries(defaultRoleFields)) {
    if (ROLE_FIELDS_IN_WEIGHTS.has(role) && defaultCol in fieldWeights) {
      result[role] = defaultCol
    } else if (requireCodeField && role === 'code_field' && defaultCol) {
      result[role] = defaultCol
    }
  }
  return result
}

function deriveDuplicateHardRules(roleFields, hardRules, fieldWeights) {
  const hr = { ...DEFAULT_DUPLICATE_HARD_RULES, ...(hardRules || {}) }
  const projectName = roleFields.project_name || DEFAULT_DUPLICATE_ROLE_FIELDS.project_name
  if (hr.phase_conflict_field && hr.phase_conflict_field !== projectName) {
    throw new Error('hard_rules.phase_conflict_field 必须与 role_fields.project_name 一致')
  }
  hr.phase_conflict_field = projectName
  hr.continuation_start_field = hr.continuation_start_field || roleFields.plan_start
  hr.continuation_end_field = hr.continuation_end_field || roleFields.plan_end
  if (!hr.veto_min_scores) {
    hr.veto_min_scores = {}
    const loc = roleFields.location
    const scale = roleFields.scale
    if (loc && loc in fieldWeights) hr.veto_min_scores[loc] = 2.0
    if (scale && scale in fieldWeights) hr.veto_min_scores[scale] = 3.0
  }
  return hr
}

function validateConfig(fieldWeights, roleFields, hardRules, { requireCodeField = false } = {}) {
  if (!roleFields?.project_name?.trim()) {
    throw new Error('role_fields.project_name 为必填项')
  }
  if (requireCodeField && !roleFields?.code_field?.trim()) {
    throw new Error('role_fields.code_field 为必填项（主子编码匹配）')
  }
  for (const role of ROLE_FIELDS_IN_WEIGHTS) {
    const col = roleFields[role]?.trim()
    if (col && !(col in fieldWeights)) {
      throw new Error(`role_fields.${role}（${col}）必须出现在 field_weights 中`)
    }
  }
  const veto = hardRules?.veto_min_scores || {}
  for (const field of Object.keys(veto)) {
    if (!(field in fieldWeights)) {
      throw new Error(`hard_rules.veto_min_scores 的字段 '${field}' 不在 field_weights 中`)
    }
  }
  if (sumFieldWeights(fieldWeights) <= 0) {
    throw new Error('field_weights 权重之和必须大于 0')
  }
}

function sumFieldWeights(weights) {
  if (!weights || typeof weights !== 'object') return 0
  return Object.values(weights).reduce((s, w) => s + (Number(w) || 0), 0)
}

/** @deprecated 请改用 prepareSingleTableConfig + migrateLegacyEngineeringConfig */
export function prepareDuplicateConfig(raw = {}, { validate = true } = {}) {
  const fieldWeights = Object.keys(raw.field_weights || {}).length
    ? { ...raw.field_weights }
    : { ...DEFAULT_DUPLICATE_FIELD_WEIGHTS }

  const roleFields = migrateRoleFields(
    fieldWeights,
    raw.role_fields,
    DEFAULT_DUPLICATE_ROLE_FIELDS,
    { requireCodeField: false }
  )
  const hardRules = deriveDuplicateHardRules(roleFields, raw.hard_rules, fieldWeights)

  const config = {
    threshold: Number(raw.threshold ?? DEFAULT_DUPLICATE_THRESHOLD),
    field_weights: fieldWeights,
    field_rules: { ...(raw.field_rules || {}) },
    prompt: raw.prompt || '',
    role_fields: roleFields,
    auxiliary_fields: [...(raw.auxiliary_fields || DEFAULT_DUPLICATE_AUXILIARY_FIELDS)],
    field_aliases: { ...DEFAULT_FIELD_ALIASES, ...(raw.field_aliases || {}) },
    suspect_rules: { ...DEFAULT_DUPLICATE_SUSPECT_RULES, ...(raw.suspect_rules || {}) },
    hard_rules: hardRules
  }
  if (raw.field_meta) config.field_meta = raw.field_meta

  for (const key of Object.keys(config.field_weights)) {
    config.field_rules[key] = normalizeFieldRuleText(key, config.field_rules[key])
  }

  if (validate) validateConfig(fieldWeights, roleFields, hardRules)
  return config
}

/** @deprecated 请改用 prepareSingleTableConfig + migrateLegacyEngineeringConfig */
export function prepareParentChildConfig(raw = {}, { validate = true } = {}) {
  const fieldWeights = Object.keys(raw.field_weights || {}).length
    ? { ...raw.field_weights }
    : { ...DEFAULT_PARENT_CHILD_FIELD_WEIGHTS }

  const roleFields = migrateRoleFields(
    fieldWeights,
    raw.role_fields,
    DEFAULT_PARENT_CHILD_ROLE_FIELDS,
    { requireCodeField: true }
  )
  const hardRules = { ...DEFAULT_PARENT_CHILD_HARD_RULES, ...(raw.hard_rules || {}) }
  if (hardRules.threshold_strict === undefined) hardRules.threshold_strict = true

  const suspectRules = {
    ...DEFAULT_PARENT_CHILD_SUSPECT_RULES,
    ...(raw.suspect_rules || {}),
    investment_field: roleFields.investment || DEFAULT_PARENT_CHILD_ROLE_FIELDS.investment
  }

  const config = {
    threshold: Number(raw.threshold ?? DEFAULT_PARENT_CHILD_THRESHOLD),
    field_weights: fieldWeights,
    field_rules: { ...(raw.field_rules || {}) },
    prompt: raw.prompt || '',
    role_fields: roleFields,
    auxiliary_fields: [...(raw.auxiliary_fields || DEFAULT_PARENT_CHILD_AUXILIARY_FIELDS)],
    field_aliases: { ...DEFAULT_FIELD_ALIASES, ...(raw.field_aliases || {}) },
    suspect_rules: suspectRules,
    hard_rules: hardRules
  }
  if (raw.field_meta) config.field_meta = raw.field_meta
  if (raw.strict_negative_prompt != null) config.strict_negative_prompt = raw.strict_negative_prompt

  if (validate) validateConfig(fieldWeights, roleFields, hardRules, { requireCodeField: true })
  return config
}

/** 权重键名变更后检查 role_fields 是否仍指向旧列名 */
export function detectStaleRoleMappings(fieldWeights, roleFields, defaultRoleFields) {
  const stale = []
  for (const role of ROLE_FIELDS_IN_WEIGHTS) {
    const col = roleFields?.[role]
    if (!col) continue
    if (!(col in fieldWeights)) stale.push({ role, column: col })
  }
  return stale
}

export function roleFieldOptions(detectionConfig, sourceColumns = []) {
  const weights = Object.keys(detectionConfig?.field_weights || {})
  const aux = detectionConfig?.auxiliary_fields || []
  const roles = Object.values(detectionConfig?.role_fields || {})
  const fromSource = Array.isArray(sourceColumns) ? sourceColumns : []
  return [...new Set([...weights, ...aux, ...roles, ...fromSource])].filter(Boolean)
}
