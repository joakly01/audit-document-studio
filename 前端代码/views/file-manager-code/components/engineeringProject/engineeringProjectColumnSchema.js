/**
 * 工程项目结果表列 schema（展示与导出同源）
 */
import {
  DEFAULT_DUPLICATE_FIELD_WEIGHTS,
  columnLabelWithWeight,
  fieldKeyToDisplayLabel,
  fieldKeyToRowProp
} from './engineeringProjectConstants.js'

const META_COLUMNS_DUPLICATE = [
  { prop: '序号', label: '序号', width: 70, align: 'center', meta: true },
  { prop: '文件名称', label: '文件名称', width: 120, meta: true },
  { prop: '重复项目', label: '重复项目', width: 90, align: 'center', meta: true },
  { prop: '项目关系', label: '项目关系', width: 100, align: 'center', meta: true }
]

const META_COLUMNS_PARENT_CHILD = [
  { prop: '序号', label: '序号', width: 70, align: 'center', meta: true },
  { prop: '文件名称', label: '文件名称', width: 120, meta: true },
  { prop: '项目关系', label: '项目关系', width: 100, align: 'center', meta: true },
  { prop: '匹配方式', label: '匹配方式', width: 100, align: 'center', meta: true }
]

const TAIL_COLUMNS_DUPLICATE = [
  { prop: '加权和', label: '加权和', width: 90, align: 'center', meta: true },
  { prop: '原因', label: '原因', minWidth: 220, meta: true }
]

const TAIL_COLUMNS_PARENT_CHILD = [
  { prop: '加权和', label: '加权和', width: 90, align: 'center', meta: true },
  { prop: '原因', label: '原因', minWidth: 220, meta: true }
]

function collectKeysFromRows(rows) {
  const keys = new Set()
  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue
    Object.keys(row).forEach((k) => keys.add(k))
  }
  return keys
}

function trimRoleCol(roleFields, role) {
  const val = roleFields?.[role]
  if (val == null) return ''
  const s = String(val).trim()
  return s
}

/**
 * @param {'duplicate'|'parent_child'} mode
 * @param {Object} options
 */
export function buildEngineeringColumnSchema(mode, options = {}) {
  const {
    fieldWeights = null,
    fieldLabels = null,
    roleFields = null,
    sourceColumns = [],
    rows = [],
    useDefaultTemplate = false
  } = options

  const weights =
    fieldWeights ||
    (mode === 'parent_child' ? {} : DEFAULT_DUPLICATE_FIELD_WEIGHTS)

  // 辅助列仅认显式 roleFields，禁止 DEFAULT / useDefaultTemplate 顶出编码与计划列
  const codeCol = trimRoleCol(roleFields, 'code_field')
  const planStartCol = trimRoleCol(roleFields, 'plan_start')
  const planEndCol = trimRoleCol(roleFields, 'plan_end')

  const rowKeys = collectKeysFromRows(rows)
  const sourceSet = new Set(sourceColumns || [])
  rowKeys.forEach((k) => sourceSet.add(k))

  const businessCols = []
  const seen = new Set()

  const pushCol = (prop, label, extra = {}) => {
    if (!prop) return
    const rowProp = fieldKeyToRowProp(prop)
    if (seen.has(rowProp)) return
    seen.add(rowProp)
    businessCols.push({
      prop: rowProp,
      label: label || fieldKeyToDisplayLabel(prop),
      minWidth: 140,
      ...extra
    })
  }

  if (codeCol) {
    pushCol(codeCol, codeCol, { minWidth: 200 })
  }

  const weightKeys = Object.keys(weights)
  for (const fkey of weightKeys) {
    const column = fieldLabels?.[fkey] || fkey
    const rowProp = fieldKeyToRowProp(column)
    if (
      sourceSet.size === 0 ||
      sourceSet.has(column) ||
      rowKeys.has(rowProp) ||
      rowKeys.has(fkey) ||
      useDefaultTemplate
    ) {
      pushCol(column, columnLabelWithWeight(fieldKeyToDisplayLabel(column), weights, fkey))
    }
  }

  if (mode === 'duplicate') {
    // 与 pickProjectFields 写入键一致：计划开始用展示名，竣工用源列名
    const planStartDisplay = '计划开始时间'
    if (planStartCol) {
      pushCol(planStartDisplay, planStartDisplay, { width: 160 })
    }
    if (planEndCol) {
      pushCol(planEndCol, planEndCol, { width: 160 })
    }
  }

  // 兜底仅补 scored 权重列，绝不硬塞编码/计划列
  if (businessCols.length === 0 && useDefaultTemplate) {
    for (const fkey of weightKeys) {
      const column = fieldLabels?.[fkey] || fkey
      pushCol(column, columnLabelWithWeight(fieldKeyToDisplayLabel(column), weights, fkey))
    }
  }

  const meta =
    mode === 'parent_child' ? META_COLUMNS_PARENT_CHILD : META_COLUMNS_DUPLICATE
  const tail =
    mode === 'parent_child' ? TAIL_COLUMNS_PARENT_CHILD : TAIL_COLUMNS_DUPLICATE

  return [...meta, ...businessCols, ...tail]
}

export function buildDuplicateColumnSchema(options = {}) {
  return buildEngineeringColumnSchema('duplicate', options)
}

export function buildParentChildColumnSchema(options = {}) {
  return buildEngineeringColumnSchema('parent_child', options)
}
