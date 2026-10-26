/**
 * 将 compare 接口 / DISPOSAL_RESULT 映射为 ResultTable 四类结构
 */
import {
  buildColumnSchema,
  formatCellValue
} from '@/utils/associationTwoTablesColumnSchema.js'

function isFullMatch(matchType) {
  const t = String(matchType || '').trim()
  // 「不完全一致」含子串「完全一致」，须先排除不完全类再判完全一致
  if (t.includes('不完全') || t.includes('部分一致')) {
    return false
  }
  return (
    t.startsWith('完全一致') ||
    t.startsWith('完全匹配') ||
    t.includes('编码匹配')
  )
}

function isOmissionMatch(matchType) {
  const t = String(matchType || '')
  return t.includes('遗漏')
}

function mapCompareSideRow(base, columnList, item) {
  const row = { ...base }
  for (const col of columnList) {
    row[col] = formatCellValue(item?.[col])
  }
  return row
}

function mapComparePair(compareRow, seq, table1Name, table2Name, schema) {
  const reason = compareRow.reason || compareRow.match_type || ''
  const base = {
    说明: reason,
    _pairIndex: seq - 1
  }
  const t1 = mapCompareSideRow(
    {
      ...base,
      组序号: seq,
      文件名称: table1Name,
      _sourceTable: 'table1',
      _rawItem: compareRow.table1_item
    },
    schema.compareUnionColumns,
    compareRow.table1_item
  )
  const t2 = mapCompareSideRow(
    {
      ...base,
      组序号: seq,
      文件名称: table2Name,
      _sourceTable: 'table2',
      _rawItem: compareRow.table2_item
    },
    schema.compareUnionColumns,
    compareRow.table2_item
  )
  return [t1, t2]
}

function mapUniqueRow(item, fileName, seq, columnList) {
  const row = {
    序号: seq,
    文件名称: fileName,
    _rawItem: item
  }
  for (const col of columnList) {
    row[col] = formatCellValue(item?.[col])
  }
  return row
}

/**
 * @param {object} disposal 解析后的 DISPOSAL_RESULT
 * @param {object} [options]
 * @param {object} [options.config] 旧任务兜底，非展示列主来源
 * @returns {{ yz: array, bwqyz: array, ggdyxm: array, tzxmzxsp: array, columnSchema: object }}
 */
export function mapAssociationDisposalResult(disposal, mapperOptions) {
  const options =
    mapperOptions != null && typeof mapperOptions === 'object' ? mapperOptions : {}
  const empty = { yz: [], bwqyz: [], ggdyxm: [], tzxmzxsp: [], columnSchema: buildColumnSchema(null, {}) }
  if (!disposal || typeof disposal !== 'object') return empty

  const compare = disposal.compare_response || disposal
  const config = options.config || disposal.config || {}
  const compareForSchema = {
    ...compare,
    table1_source_columns:
      compare.table1_source_columns || disposal.table1_source_columns,
    table2_source_columns:
      compare.table2_source_columns || disposal.table2_source_columns
  }
  const schema = buildColumnSchema(compareForSchema, config)

  const tableLabels = config.table_labels || {}
  const table1Name =
    disposal.table1_filename ||
    compare.table1_filename ||
    tableLabels.table1 ||
    '文件一'
  const table2Name =
    disposal.table2_filename ||
    compare.table2_filename ||
    tableLabels.table2 ||
    '文件二'

  const yz = []
  const bwqyz = []
  let yzSeq = 0
  let bwqyzSeq = 0

  const comparisonResults = Array.isArray(compare.comparison_results)
    ? compare.comparison_results
    : []

  comparisonResults.forEach((row) => {
    if (isOmissionMatch(row.match_type)) {
      return
    }
    if (isFullMatch(row.match_type)) {
      yzSeq += 1
      yz.push(...mapComparePair(row, yzSeq, table1Name, table2Name, schema))
    } else {
      bwqyzSeq += 1
      bwqyz.push(...mapComparePair(row, bwqyzSeq, table1Name, table2Name, schema))
    }
  })

  const ggdyxm = (Array.isArray(compare.table1_unique_items) ? compare.table1_unique_items : []).map(
    (item, idx) => mapUniqueRow(item, table1Name, idx + 1, schema.table1SourceColumns)
  )

  const tzxmzxsp = (Array.isArray(compare.table2_unique_items) ? compare.table2_unique_items : []).map(
    (item, idx) => mapUniqueRow(item, table2Name, idx + 1, schema.table2SourceColumns)
  )

  return { yz, bwqyz, ggdyxm, tzxmzxsp, columnSchema: schema }
}

export function pickAssociationDisposalString(detailPayload) {
  const list = Array.isArray(detailPayload) ? detailPayload : [detailPayload]
  for (const row of list) {
    const raw = row?.disposal_result ?? row?.DISPOSAL_RESULT
    if (!raw) continue
    if (typeof raw === 'string' && raw.trim()) return raw
    if (typeof raw === 'object') return JSON.stringify(raw)
  }
  return ''
}

/**
 * 将 DISPOSAL_RESULT 原始值解析为对象（兼容字符串 / 对象）
 * @param {string|object|null|undefined} raw
 * @returns {object|null}
 */
export function parseAssociationDisposalPayload(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * @param {object|array|string|null|undefined} detailPayload
 * @returns {object|null}
 */
export function resolveAssociationDisposalFromDetail(detailPayload) {
  const rawStr = pickAssociationDisposalString(detailPayload)
  if (rawStr) return parseAssociationDisposalPayload(rawStr)
  if (detailPayload && typeof detailPayload === 'object' && !Array.isArray(detailPayload)) {
    if (detailPayload.compare_response || detailPayload.status) {
      return detailPayload
    }
  }
  return null
}
