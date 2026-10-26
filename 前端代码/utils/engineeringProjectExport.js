import { ElMessage } from 'element-plus'
import { exportFn, sanitizeExcelCellText } from '@/utils/excel/export.js'
import {
  DEFAULT_DUPLICATE_FIELD_WEIGHTS,
  DEFAULT_PARENT_CHILD_FIELD_WEIGHTS
} from '@/views/file-manager-code/components/engineeringProject/engineeringProjectConstants.js'
import {
  buildDuplicateColumnSchema,
  buildParentChildColumnSchema
} from '@/views/file-manager-code/components/engineeringProject/engineeringProjectColumnSchema.js'

/** @param {*} value */
function cellValue(value) {
  if (value == null || value === '') return ''
  const s = String(value)
  if (s.toLowerCase() === 'null') return ''
  return sanitizeExcelCellText(s)
}

/** @param {string} name */
function stripFileExtension(name) {
  const raw = String(name || '').trim()
  if (!raw) return ''
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return raw
  return raw.slice(0, dot)
}

/** @param {string} [fileBaseName] */
function buildExportFileBaseName(fileBaseName) {
  const base = stripFileExtension(fileBaseName) || '工程项目分析结果'
  const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  return `${base}_${ts}`
}

/**
 * @param {Record<string, unknown>} row
 * @param {Array<{prop:string,label:string,meta?:boolean}>} columns
 */
function mapRowBySchema(row, columns) {
  const out = {}
  for (const col of columns) {
    out[col.label] = cellValue(row[col.prop] ?? row[col.label])
  }
  return out
}

/**
 * @param {unknown[]} rows
 * @param {'duplicate'|'parent_child'} mode
 * @param {Object} options
 */
function buildSheetRows(rows, mode, options = {}) {
  const {
    fieldWeights = null,
    fieldLabels = null,
    roleFields = null,
    sourceColumns = []
  } = options
  const list = Array.isArray(rows) ? rows : []
  const builder = mode === 'parent_child' ? buildParentChildColumnSchema : buildDuplicateColumnSchema
  const schema = builder({
    fieldWeights,
    fieldLabels,
    roleFields,
    sourceColumns,
    rows: list,
    useDefaultTemplate: !sourceColumns?.length
  })

  if (!list.length) {
    return [{ 提示: mode === 'parent_child' ? '未发现主子项目关系' : '未发现重复项目' }]
  }
  return list.map((row) => mapRowBySchema(row, schema))
}

/**
 * @param {{ model?: { title?: string, rows?: unknown[] }, code?: { title?: string, rows?: unknown[], footnote?: string } }} sections
 * @param {Object} options
 */
function buildParentChildSheetRows(sections, options = {}) {
  const modelRows = sections?.model?.rows || []
  const codeRows = sections?.code?.rows || []
  const out = []

  if (modelRows.length) {
    const titleRow = buildSheetRows([], 'parent_child', options)
    const titleCols = Object.keys(titleRow[0] || {})
    const header = {}
    if (titleCols.length) header[titleCols[0]] = sections.model.title || '通过模型匹配（含得分及原因）'
    out.push(header)
    out.push(...buildSheetRows(modelRows, 'parent_child', options))
  }

  if (codeRows.length) {
    if (out.length) out.push({})
    const titleRow = buildSheetRows([], 'parent_child', options)
    const titleCols = Object.keys(titleRow[0] || {})
    const header = {}
    if (titleCols.length) header[titleCols[0]] = sections.code.title || '通过24位编码匹配（不含得分及原因）'
    out.push(header)
    out.push(...buildSheetRows(codeRows, 'parent_child', options))
    if (sections.code.footnote) {
      const foot = {}
      const schema = buildParentChildColumnSchema({
        ...options,
        useDefaultTemplate: true
      })
      const reasonCol = schema.find((c) => c.prop === '原因')
      if (reasonCol) foot[reasonCol.label] = sections.code.footnote
      else foot['原因'] = sections.code.footnote
      out.push(foot)
    }
  }

  if (!out.length) {
    return [{ 提示: '未发现主子项目关系' }]
  }
  return out
}

/**
 * 导出工程项目分析结果（重复项目 + 主子项目，两个 Sheet）
 * @param {{
 *   duplicateRows?: unknown[],
 *   parentChildSections?: object,
 *   duplicateFieldWeights?: Record<string, number>|null,
 *   parentChildFieldWeights?: Record<string, number>|null,
 *   duplicateFieldLabels?: Record<string, string>|null,
 *   parentChildFieldLabels?: Record<string, string>|null,
 *   duplicateRoleFields?: Record<string, string>|null,
 *   parentChildRoleFields?: Record<string, string>|null,
 *   sourceColumns?: string[],
 *   fileBaseName?: string
 * }} options
 */
export function exportEngineeringResultsXlsx(options = {}) {
  const {
    duplicateRows = [],
    parentChildSections = {},
    duplicateFieldWeights = null,
    parentChildFieldWeights = null,
    duplicateFieldLabels = null,
    parentChildFieldLabels = null,
    duplicateRoleFields = null,
    parentChildRoleFields = null,
    sourceColumns = [],
    fileBaseName = '工程项目分析结果'
  } = options

  const dupSheet = buildSheetRows(duplicateRows, 'duplicate', {
    fieldWeights: duplicateFieldWeights || DEFAULT_DUPLICATE_FIELD_WEIGHTS,
    fieldLabels: duplicateFieldLabels,
    roleFields: duplicateRoleFields,
    sourceColumns
  })
  const pcSheet = buildParentChildSheetRows(parentChildSections, {
    fieldWeights: parentChildFieldWeights || DEFAULT_PARENT_CHILD_FIELD_WEIGHTS,
    fieldLabels: parentChildFieldLabels,
    roleFields: parentChildRoleFields,
    sourceColumns
  })

  const hasDuplicateData = Array.isArray(duplicateRows) && duplicateRows.length > 0
  const hasParentChildData =
    (parentChildSections?.model?.rows?.length || 0) +
      (parentChildSections?.code?.rows?.length || 0) >
    0

  if (!hasDuplicateData && !hasParentChildData) {
    ElMessage.warning('暂无数据可导出')
    return false
  }

  const safeName = String(buildExportFileBaseName(fileBaseName)).replace(/[\\/:*?"<>|]/g, '_')
  exportFn([dupSheet, pcSheet], ['重复项目', '主子项目'], safeName)
  ElMessage.success('Excel 导出成功')
  return true
}
