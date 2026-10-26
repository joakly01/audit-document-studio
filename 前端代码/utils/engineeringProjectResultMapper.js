import {
  DEFAULT_DUPLICATE_FIELD_WEIGHTS,
  fieldKeyToRowProp,
  getScoredFieldKeys
} from '@/views/file-manager-code/components/engineeringProject/engineeringProjectConstants.js'
import {
  ensureSingleTableShape,
  getFieldScoreLabels
} from '@/views/file-manager-code/components/engineeringProject/engineeringSingleTableConfigHelpers.js'

const F_KEY_RE = /^F\d+$/i

/** @param {string} key */
export function isEngineeringFKey(key) {
  return F_KEY_RE.test(String(key || ''))
}

/** 从响应块解析 field_weights（兼容顶层 / llm_config / config_snapshot） */
export function resolveExportFieldWeights(block) {
  if (!block || typeof block !== 'object') return null
  const snap = block.config_snapshot
  return (
    block.field_weights ||
    block.llm_config?.field_weights ||
    snap?.llm_config?.field_weights ||
    null
  )
}

function labelsFromFieldMapping(fieldMapping) {
  const labels = {}
  for (const [fkey, entry] of Object.entries(fieldMapping || {})) {
    const col = entry?.excel_column != null ? String(entry.excel_column).trim() : ''
    if (col) labels[fkey] = col
  }
  return labels
}

function identityLabelsForColumnWeights(weights) {
  const labels = {}
  for (const key of Object.keys(weights || {})) {
    if (!isEngineeringFKey(key)) labels[key] = key
  }
  return labels
}

function hasCompleteFKeyLabels(labels, weights) {
  const keys = Object.keys(weights || {}).filter((k) => isEngineeringFKey(k))
  if (!keys.length) return true
  return keys.every((k) => labels?.[k])
}

/** 从 parameter_settings 回填 F 键 → Excel 列名 */
export function mergeLabelsFromParameterSettings(parameterSettings, mode, existing = {}) {
  if (!parameterSettings || typeof parameterSettings !== 'object') return { ...existing }
  const settingsKey = mode === 'parent_child' ? 'parent_child_analysis' : 'duplicate_detection'
  const block = parameterSettings[settingsKey]
  if (!block) return { ...existing }
  const prepared = ensureSingleTableShape(block, mode)
  const derived = getFieldScoreLabels(prepared)
  return { ...derived, ...existing }
}

/** 从 config_snapshot / field_score_labels 解析 F 键 → 列名 */
export function resolveExportFieldLabels(block, mode = 'duplicate') {
  if (!block || typeof block !== 'object') return {}
  const snap = block.config_snapshot
  let labels = {}

  if (snap?.logical_field_mapping && typeof snap.logical_field_mapping === 'object') {
    labels = { ...snap.logical_field_mapping }
  } else if (snap?.field_mapping) {
    labels = labelsFromFieldMapping(snap.field_mapping)
  } else if (block.field_score_labels && typeof block.field_score_labels === 'object') {
    labels = { ...block.field_score_labels }
  } else if (snap) {
    labels = getFieldScoreLabels(snap)
  }

  const weights = resolveExportFieldWeights(block)
  if (weights && Object.keys(weights).length) {
    const columnIdentity = identityLabelsForColumnWeights(weights)
    labels = { ...columnIdentity, ...labels }
  }

  return labels
}

/** 解析 role_fields（兼容 config_snapshot.auxiliary_columns） */
export function resolveExportRoleFields(block, mode = 'duplicate') {
  if (!block || typeof block !== 'object') return null
  const direct = block.role_fields || block.llm_config?.role_fields
  if (direct && Object.keys(direct).length) return { ...direct }

  const snap = block.config_snapshot || {}
  const aux = [
    ...(snap.auxiliary_columns || []),
    ...(block.auxiliary_columns || [])
  ]
  const auxSet = new Set(aux.map((c) => String(c || '').trim()).filter(Boolean))
  const roles = {}
  if (auxSet.has('项目统一编码24位码')) roles.code_field = '项目统一编码24位码'
  if (auxSet.has('计划开工时间')) roles.plan_start = '计划开工时间'
  if (auxSet.has('计划竣工时间')) roles.plan_end = '计划竣工时间'
  return Object.keys(roles).length ? roles : null
}

function resolveSourceColumns(parsed, ddBlock, pcBlock) {
  const top = parsed?.source_columns
  if (Array.isArray(top) && top.length) return top
  for (const block of [ddBlock, pcBlock]) {
    const cols = block?.source_columns
    if (Array.isArray(cols) && cols.length) return cols
    const snapCols = block?.config_snapshot?.columns_to_read
    if (Array.isArray(snapCols) && snapCols.length) return snapCols
  }
  return []
}

/** @param {Record<string, unknown>} fieldScores @param {Record<string, string>|null} fieldLabels */
function formatFieldScoresForDisplay(fieldScores, fieldLabels) {
  if (!fieldScores || typeof fieldScores !== 'object') return ''
  return Object.entries(fieldScores)
    .map(([k, v]) => {
      const label = fieldLabels?.[k] || k
      return `${label}: ${v}`
    })
    .join('；')
}

/** @deprecated 内部别名 */
function resolveFieldLabels(resultMeta, mode = 'duplicate') {
  return resolveExportFieldLabels(resultMeta, mode)
}

const EMPTY_MARKS = new Set(['null', 'undefined', 'none', ''])

/** @param {*} value */
export function normalizeCell(value) {
  if (value == null) return ''
  const s = String(value).trim()
  if (!s || EMPTY_MARKS.has(s.toLowerCase())) return ''
  return s
}

const LEGACY_ROLE_DEFAULTS = {
  duplicate: {
    project_name: '项目名称',
    investment: '总投资_万元',
    location: '项目详细建设地点',
    scale: '建设规模及内容_生产能力',
    unit_name: '单位名称',
    code_field: '项目统一编码24位码',
    plan_start: '计划开工时间',
    plan_end: '计划竣工时间'
  },
  parent_child: {
    project_name: '项目名称',
    investment: '总投资_万元',
    location: '项目详细建设地点',
    scale: '建设规模及内容_生产能力',
    unit_name: '单位名称',
    code_field: '项目统一编码24位码',
    plan_start: '计划开工时间',
    plan_end: '计划竣工时间'
  }
}

/** 辅助列仅在配置显式提供时写入结果，禁止用默认名顶列 */
const AUXILIARY_ROLE_KEYS = new Set(['code_field', 'plan_start', 'plan_end'])

function resolveRoles(roleFields, mode = 'duplicate') {
  const defaults = LEGACY_ROLE_DEFAULTS[mode] || {}
  const scoredDefaults = {}
  for (const [key, value] of Object.entries(defaults)) {
    if (!AUXILIARY_ROLE_KEYS.has(key)) scoredDefaults[key] = value
  }
  const merged = { ...scoredDefaults, ...(roleFields || {}) }
  for (const key of AUXILIARY_ROLE_KEYS) {
    const explicit = roleFields?.[key]
    if (explicit != null && String(explicit).trim()) {
      merged[key] = String(explicit).trim()
    } else {
      delete merged[key]
    }
  }
  return merged
}

/** @param {Record<string, unknown>|undefined} project @param {string} [fallback] */
function pickFileName(project, fallback = '') {
  return (
    normalizeCell(project?.['文件名称']) ||
    normalizeCell(project?.['文件类型']) ||
    normalizeCell(project?.source_file) ||
    fallback
  )
}

/** @param {Record<string, unknown>|undefined} project @param {string[]} fieldKeys @param {string} [investmentKey] @param {Record<string,string>|null} [fieldLabels] */
function pickScoredFields(project, fieldKeys, investmentKey = '总投资_万元', fieldLabels = null) {
  const p = project || {}
  const out = {}
  for (const key of fieldKeys) {
    const columnKey = fieldLabels?.[key] || key
    const prop = fieldKeyToRowProp(columnKey)
    const raw = p[columnKey] ?? p[key] ?? p[prop]
    const investCol = fieldLabels?.investment || investmentKey
    if (columnKey === investCol || key === investCol) {
      out[prop] = raw ?? ''
    } else {
      out[prop] = normalizeCell(raw)
    }
  }
  return out
}

/**
 * @param {Record<string, unknown>|undefined} project
 * @param {string[]} [fieldKeys]
 * @param {Record<string, string>|null} [roleFields]
 * @param {'duplicate'|'parent_child'} [mode]
 * @param {Record<string, unknown>} [extras]
 */
function pickProjectFields(
  project,
  fieldKeys = getScoredFieldKeys(DEFAULT_DUPLICATE_FIELD_WEIGHTS),
  roleFields = null,
  mode = 'duplicate',
  extras = {},
  fieldLabels = null
) {
  const roles = resolveRoles(roleFields, mode)
  const p = project || {}
  const codeCol = roles.code_field
  const planStart = roles.plan_start
  const planEnd = roles.plan_end
  const out = {
    ...pickScoredFields(p, fieldKeys, roles.investment, fieldLabels)
  }
  if (codeCol) {
    out[fieldKeyToRowProp(codeCol)] = normalizeCell(p[codeCol])
  }
  if (mode === 'duplicate') {
    const planStartDisplay = '计划开始时间'
    if (planStart) {
      out[planStartDisplay] = normalizeCell(p[planStartDisplay] || p[planStart])
    }
    if (planEnd) {
      out[fieldKeyToRowProp(planEnd)] = normalizeCell(p[planEnd])
    }
  }
  return { ...out, ...extras }
}

/** @param {Record<string, number|string>} item @param {Record<string, string>|null} [fieldLabels] */
export function formatDuplicateReason(item, fieldLabels = null) {
  const parts = []
  if (item.reason) parts.push(String(item.reason))
  const scoreText = formatFieldScoresForDisplay(item.field_scores, fieldLabels)
  if (scoreText) parts.push(scoreText)
  return parts.join('\n')
}

/**
 * @param {Record<string, number|string|null|undefined>} dataMap
 * @param {string[]} keys
 * @param {string} [investmentKey]
 */
function metaCell(dataMap, keys, investmentKey = '总投资_万元') {
  const map = dataMap || {}
  for (const key of keys) {
    const raw = map[key]
    if (raw === 0 || raw === '0') return '0'
    if (raw != null && raw !== '') {
      if (key === investmentKey && Number(raw) === 0) return '\\'
      return String(raw)
    }
  }
  return '\\'
}

/**
 * @param {'weight'|'score'} rowType
 * @param {Record<string, number|string>} dataMap
 * @param {string[]} fieldKeys
 * @param {Record<string, string>|null} roleFields
 * @param {number|string} [weightedScore]
 */
function buildMetaRow(rowType, dataMap, fieldKeys, roleFields, weightedScore = '', fieldLabels = null) {
  const roles = resolveRoles(roleFields, 'parent_child')
  const codeCol = roles.code_field
  const row = {
    _rowType: rowType,
    _groupKey: '',
    序号: '',
    文件名称: '',
    主子项目: rowType === 'weight' ? '权重' : '得分',
    项目关系: '',
    加权和: weightedScore !== '' && weightedScore != null ? weightedScore : '',
    原因: ''
  }
  if (codeCol) {
    row[fieldKeyToRowProp(codeCol)] = '\\'
  }
  for (const key of fieldKeys) {
    const columnKey = fieldLabels?.[key] || key
    const prop = fieldKeyToRowProp(columnKey)
    row[prop] = metaCell(dataMap, [key, columnKey, prop], roles.investment)
  }
  return row
}

/**
 * @param {Array<Record<string, unknown>>} duplicates
 * @param {{ taskFileName?: string, fieldWeights?: object, roleFields?: object }} [options]
 */
export function buildDuplicateTableRows(duplicates, options = {}) {
  const fallbackFileName = options.taskFileName || ''
  const fieldWeights = options.fieldWeights || DEFAULT_DUPLICATE_FIELD_WEIGHTS
  const fieldKeys = getScoredFieldKeys(fieldWeights)
  const fieldLabels = options.fieldLabels || null
  const roleFields = options.roleFields || null
  const rows = []

  for (let i = 0; i < (duplicates || []).length; i++) {
    const item = duplicates[i]
    const seq = item.seq ?? i + 1
    const reason = formatDuplicateReason(item, fieldLabels)
    const score = item.weighted_score ?? ''

    rows.push({
      _rowType: 'data',
      _groupKey: seq,
      序号: seq,
      文件名称: pickFileName(item.project1, fallbackFileName),
      重复项目: '项目1',
      项目关系: '重复项目',
      ...pickProjectFields(item.project1, fieldKeys, roleFields, 'duplicate', {}, fieldLabels),
      加权和: '',
      原因: reason
    })

    rows.push({
      _rowType: 'data',
      _groupKey: seq,
      序号: seq,
      文件名称: pickFileName(item.project2, fallbackFileName),
      重复项目: '项目2',
      项目关系: '重复项目',
      ...pickProjectFields(item.project2, fieldKeys, roleFields, 'duplicate', {}, fieldLabels),
      加权和: score !== '' && score != null ? score : '',
      原因: ''
    })
  }

  return rows
}

/**
 * @param {Record<string, unknown>} group
 * @param {Record<string, unknown>|null|undefined} llmConfig
 * @param {string} fallbackFileName
 * @param {boolean} isCode
 */
function buildGroupRows(group, llmConfig, fallbackFileName, isCode, fieldLabels = null, fieldWeights = null) {
  const groupId = group.group_id
  const rows = []
  const main = group.main_project || {}
  const subs = group.sub_projects || []
  const fieldWeightsResolved =
    fieldWeights || llmConfig?.field_weights || DEFAULT_DUPLICATE_FIELD_WEIGHTS
  const fieldKeys = getScoredFieldKeys(fieldWeightsResolved)
  const roleFields = llmConfig?.role_fields || null
  if (!subs.length) return rows

  rows.push({
    _rowType: 'main',
    _groupKey: groupId,
    序号: groupId,
    文件名称: pickFileName(main, fallbackFileName),
    主子项目: '项目1',
    项目关系: normalizeCell(main.project_role) || '主项目',
    ...pickProjectFields(main, fieldKeys, roleFields, 'parent_child', {}, fieldLabels),
    加权和: '',
    原因: ''
  })

  if (!isCode) {
    const weightSource = subs[0]?.weight_row || fieldWeightsResolved || {}
    rows.push({
      ...buildMetaRow('weight', weightSource, fieldKeys, roleFields, '', fieldLabels),
      _groupKey: groupId
    })

    for (const sub of subs) {
      const subProj = sub.project || {}
      const projectLabel = sub.project_index ? `项目${sub.project_index}` : '项目2'
      rows.push({
        _rowType: 'sub',
        _groupKey: groupId,
        序号: groupId,
        文件名称: pickFileName(subProj, fallbackFileName),
        主子项目: projectLabel,
        项目关系: normalizeCell(subProj.project_role) || '子项目',
        ...pickProjectFields(subProj, fieldKeys, roleFields, 'parent_child', {}, fieldLabels),
        加权和: '',
        原因: sub.reason || ''
      })
      rows.push({
        ...buildMetaRow('score', sub.field_scores || {}, fieldKeys, roleFields, sub.weighted_score ?? '', fieldLabels),
        _groupKey: groupId
      })
    }
  } else {
    for (const sub of subs) {
      const subProj = sub.project || {}
      const projectLabel = sub.project_index ? `项目${sub.project_index}` : '项目2'
      rows.push({
        _rowType: 'sub-code',
        _groupKey: groupId,
        序号: groupId,
        文件名称: pickFileName(subProj, fallbackFileName),
        主子项目: projectLabel,
        项目关系: normalizeCell(subProj.project_role) || '子项目',
        ...pickProjectFields(subProj, fieldKeys, roleFields, 'parent_child', {}, fieldLabels),
        加权和: sub.weighted_score ?? 5,
        原因: sub.reason || group.group_reason || ''
      })
    }
  }

  return rows
}

/**
 * @param {Array<Record<string, unknown>>} results
 * @param {Record<string, unknown>|null|undefined} llmConfig
 * @param {{ taskFileName?: string }} [options]
 */
export function buildParentChildSections(results, llmConfig, options = {}) {
  const fallbackFileName = options.taskFileName || ''
  const fieldLabels = options.fieldLabels || null
  const fieldWeights = options.fieldWeights || null
  const modelRows = []
  const codeRows = []

  for (const group of results || []) {
    const isCode = group.match_type === 'code_exact'
    const groupRows = buildGroupRows(
      group,
      llmConfig,
      fallbackFileName,
      isCode,
      fieldLabels,
      fieldWeights
    )
    if (isCode) codeRows.push(...groupRows)
    else modelRows.push(...groupRows)
  }

  return {
    model: {
      key: 'model',
      title: '通过模型匹配（含得分及原因）',
      rows: modelRows
    },
    code: {
      key: 'code',
      title: '通过24位编码匹配（不含得分及原因）',
      rows: codeRows,
      footnote: '说明：通过24位编码匹配的完全一致项目，不经过模型评分，加权和固定设置为5'
    }
  }
}

/**
 * @param {Record<string, unknown>} parsed
 * @param {{ taskFileName?: string }} [options]
 */
export function mapEngineeringDisposalResult(parsed, options = {}) {
  const duplicateTableRows = []
  const parentChildSections = {
    model: { key: 'model', title: '通过模型匹配（含得分及原因）', rows: [] },
    code: {
      key: 'code',
      title: '通过24位编码匹配（不含得分及原因）',
      rows: [],
      footnote: '说明：通过24位编码匹配的完全一致项目，不经过模型评分，加权和固定设置为5'
    }
  }
  const parameterSettings = options.parameterSettings || null
  let ddBlock = parsed.duplicate_detection
  const pcBlockEarly = parsed.parent_child_analysis
  const resultMeta = {
    duplicateError: '',
    parentChildError: '',
    sourceColumns: resolveSourceColumns(parsed, ddBlock, pcBlockEarly),
    hasDuplicateBlock: false,
    hasParentChildBlock: false
  }

  if (!ddBlock && Array.isArray(parsed.duplicates)) {
    ddBlock = { status: 'success', duplicates: parsed.duplicates }
  }
  if (ddBlock) {
    resultMeta.hasDuplicateBlock = true
    if (ddBlock.status === 'failed') {
      resultMeta.duplicateError = ddBlock.error || '重复项目检测失败'
    } else {
      const duplicateFieldWeights = resolveExportFieldWeights(ddBlock)
      let duplicateFieldLabels = resolveExportFieldLabels(ddBlock, 'duplicate')
      if (
        duplicateFieldWeights &&
        !hasCompleteFKeyLabels(duplicateFieldLabels, duplicateFieldWeights)
      ) {
        duplicateFieldLabels = mergeLabelsFromParameterSettings(
          parameterSettings,
          'duplicate',
          duplicateFieldLabels
        )
      }
      const duplicateRoleFields = resolveExportRoleFields(ddBlock, 'duplicate')
      duplicateTableRows.push(
        ...buildDuplicateTableRows(ddBlock.duplicates || [], {
          ...options,
          fieldWeights: duplicateFieldWeights,
          fieldLabels: Object.keys(duplicateFieldLabels).length ? duplicateFieldLabels : null,
          roleFields: duplicateRoleFields
        })
      )
      resultMeta.duplicateFieldWeights = duplicateFieldWeights
      resultMeta.duplicateFieldLabels = duplicateFieldLabels
      resultMeta.duplicateRoleFields = duplicateRoleFields
      resultMeta.duplicateConfigSnapshot = ddBlock.config_snapshot || null
      resultMeta.duplicateThreshold = ddBlock.threshold ?? parsed.duplicate_threshold ?? parsed.threshold ?? null
    }
  }

  const pcBlock = parsed.parent_child_analysis
  if (pcBlock) {
    resultMeta.hasParentChildBlock = true
    if (pcBlock.status === 'failed') {
      resultMeta.parentChildError = pcBlock.error || '主子项目分析失败'
    } else {
      const parentChildFieldWeights = resolveExportFieldWeights(pcBlock) || pcBlock.llm_config?.field_weights || null
      let parentChildFieldLabels = resolveExportFieldLabels(pcBlock, 'parent_child')
      if (
        parentChildFieldWeights &&
        !hasCompleteFKeyLabels(parentChildFieldLabels, parentChildFieldWeights)
      ) {
        parentChildFieldLabels = mergeLabelsFromParameterSettings(
          parameterSettings,
          'parent_child',
          parentChildFieldLabels
        )
      }
      const parentChildRoleFields = resolveExportRoleFields(pcBlock, 'parent_child') || pcBlock.llm_config?.role_fields || null
      const sections = buildParentChildSections(
        pcBlock.results || [],
        pcBlock.llm_config,
        {
          ...options,
          fieldWeights: parentChildFieldWeights,
          fieldLabels: Object.keys(parentChildFieldLabels).length ? parentChildFieldLabels : null
        }
      )
      parentChildSections.model = sections.model
      parentChildSections.code = sections.code
      resultMeta.parentChildFieldWeights = parentChildFieldWeights
      resultMeta.parentChildFieldLabels = parentChildFieldLabels
      resultMeta.parentChildRoleFields = parentChildRoleFields
      resultMeta.parentChildConfigSnapshot = pcBlock.config_snapshot || null
      resultMeta.parentChildThreshold =
        pcBlock.llm_config?.threshold ?? parsed.parent_child_threshold ?? null
    }
  }

  return { duplicateTableRows, parentChildSections, resultMeta }
}

/**
 * @param {{ model: { rows: unknown[] }, code: { rows: unknown[] } }} sections
 */
export function countParentChildGroups(sections) {
  const keys = new Set()
  for (const block of [sections?.model, sections?.code]) {
    for (const row of block?.rows || []) {
      if (row._rowType === 'main' && row._groupKey != null) {
        keys.add(row._groupKey)
      }
    }
  }
  return keys.size
}
