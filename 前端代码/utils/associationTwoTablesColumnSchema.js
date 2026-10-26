/**
 * 两表项目关联度 — 结果展示列 schema 与单元格格式化
 */

export const SYSTEM_ITEM_KEYS = new Set([
  'ctid',
  'source_file',
  'match_type',
  '_row_meta',
  '_sourceTable',
  '_rawItem',
  '_pairIndex'
])

/** 旧任务兜底：表一默认源列（非全列目标态） */
export const DEFAULT_ASSOCIATION_TABLE1_SOURCE_COLUMNS = [
  '项目24位码',
  '项目名称',
  '建设规模及内容',
  '详细地址',
  '项目总投资',
  '所属行业代码'
]

/** 旧任务兜底：表二默认源列 */
export const DEFAULT_ASSOCIATION_TABLE2_SOURCE_COLUMNS = [
  '中央项目代码',
  '项目名称',
  '建设规模及内容_其他',
  '建设详细地址',
  '项目总投资_万元',
  '产业大类'
]

/**
 * @param {*} value
 * @returns {string}
 */
export function formatCellValue(value) {
  if (value == null || value === '' || value === 'null') return '-'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (
      value.length > 0 &&
      value.every((item) => item && typeof item === 'object' && ('city' in item || 'district' in item || 'street' in item))
    ) {
      return value
        .map((item) => {
          const city = item.city ?? ''
          const district = item.district ?? ''
          const street = item.street ?? ''
          return `城市:${city}; 街道:${district}; 区划:${street}`
        })
        .join(' | ')
    }
    return value.map((item) => formatCellValue(item)).join(' | ')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k}:${formatCellValue(v)}`)
      .join('; ')
  }
  return String(value)
}

/**
 * @param {object|null|undefined} item
 * @returns {string[]}
 */
export function collectItemBusinessKeys(item) {
  if (!item || typeof item !== 'object') return []
  return Object.keys(item).filter((k) => !SYSTEM_ITEM_KEYS.has(k))
}

/**
 * @param {string[]} t1
 * @param {string[]} t2
 * @returns {string[]}
 */
export function mergeSourceColumnLists(t1, t2) {
  const list1 = Array.isArray(t1) ? t1 : []
  const list2 = Array.isArray(t2) ? t2 : []
  const out = [...list1]
  for (const col of list2) {
    if (col && !out.includes(col)) out.push(col)
  }
  return out
}

/**
 * @param {object|null|undefined} compareResponse
 * @param {object} [fallbackConfig]
 * @returns {object}
 */
export function buildColumnSchema(compareResponse, fallbackConfig) {
  const compare = compareResponse || {}
  const cfg = fallbackConfig || {}

  let table1SourceColumns = Array.isArray(compare.table1_source_columns)
    ? [...compare.table1_source_columns]
    : []
  let table2SourceColumns = Array.isArray(compare.table2_source_columns)
    ? [...compare.table2_source_columns]
    : []

  if (!table1SourceColumns.length) {
    table1SourceColumns = Array.isArray(cfg.table1_source_columns)
      ? [...cfg.table1_source_columns]
      : []
  }
  if (!table2SourceColumns.length) {
    table2SourceColumns = Array.isArray(cfg.table2_source_columns)
      ? [...cfg.table2_source_columns]
      : []
  }

  if (!table1SourceColumns.length || !table2SourceColumns.length) {
    const comparisonResults = Array.isArray(compare.comparison_results)
      ? compare.comparison_results
      : []
    const t1Keys = new Set()
    const t2Keys = new Set()
    for (const row of comparisonResults) {
      collectItemBusinessKeys(row?.table1_item).forEach((k) => t1Keys.add(k))
      collectItemBusinessKeys(row?.table2_item).forEach((k) => t2Keys.add(k))
    }
    const unique1 = Array.isArray(compare.table1_unique_items) ? compare.table1_unique_items : []
    const unique2 = Array.isArray(compare.table2_unique_items) ? compare.table2_unique_items : []
    for (const item of unique1) {
      collectItemBusinessKeys(item).forEach((k) => t1Keys.add(k))
    }
    for (const item of unique2) {
      collectItemBusinessKeys(item).forEach((k) => t2Keys.add(k))
    }
    if (!table1SourceColumns.length && t1Keys.size) {
      table1SourceColumns = [...t1Keys]
    }
    if (!table2SourceColumns.length && t2Keys.size) {
      table2SourceColumns = [...t2Keys]
    }
  }

  if (!table1SourceColumns.length) {
    table1SourceColumns = Array.isArray(cfg.table1_fields) ? [...cfg.table1_fields] : []
  }
  if (!table2SourceColumns.length) {
    table2SourceColumns = Array.isArray(cfg.table2_fields) ? [...cfg.table2_fields] : []
  }

  if (!table1SourceColumns.length) {
    table1SourceColumns = [...DEFAULT_ASSOCIATION_TABLE1_SOURCE_COLUMNS]
  }
  if (!table2SourceColumns.length) {
    table2SourceColumns = [...DEFAULT_ASSOCIATION_TABLE2_SOURCE_COLUMNS]
  }

  const compareUnionColumns = mergeSourceColumnLists(table1SourceColumns, table2SourceColumns)

  return {
    table1SourceColumns,
    table2SourceColumns,
    compareUnionColumns
  }
}

/**
 * @param {object} schema
 * @param {'yz'|'bwqyz'|'ggdyxm'|'tzxmzxsp'} section
 * @returns {string[]}
 */
export function buildExportHeaders(schema, section) {
  const s = schema || {}
  const fixedColumns = new Set(['组序号', '序号', '文件名称', '说明'])
  const dedupeColumns = (cols) => (cols || []).filter((col) => col && !fixedColumns.has(col))
  if (section === 'yz' || section === 'bwqyz') {
    return ['组序号', '序号', '文件名称', ...dedupeColumns(s.compareUnionColumns), '说明']
  }
  if (section === 'ggdyxm') {
    return ['序号', '文件名称', ...dedupeColumns(s.table1SourceColumns)]
  }
  return ['序号', '文件名称', ...dedupeColumns(s.table2SourceColumns)]
}
