/** 议题动态字段中文标签与取值格式化 */

export const ECONOMIC_CATEGORY_MAP = {
  LAND: '土地类',
  ASSET: '资产类',
  FUND: '资金类',
  PROJECT: '项目类',
  POLICY: '政策类',
  GUARANTEE: '担保/债务类',
}

export const TOPIC_FIELD_LABEL_MAP = {
  topic_quote: '原文摘录',
  topic_position: '原文位置',
  category: '经济分类',
  counterparty: '相对方',
  decision: '决策类型',
  procurement_method: '采购方式',
  funding_source: '资金来源',
  meeting_type: '会议类型',
}

/** 表头：优先按字段 key 映射中文，兼容后端已存的英文 label */
export function formatTopicFieldLabel(key, fallbackLabel = '') {
  if (key && TOPIC_FIELD_LABEL_MAP[key]) {
    return TOPIC_FIELD_LABEL_MAP[key]
  }
  return fallbackLabel || key || ''
}

/** 单元格取值：category 等枚举字段转中文 */
export function formatTopicFieldValue(key, value) {
  if (value == null || value === '') return ''
  const str = String(value).trim()
  if (key === 'category') {
    return formatCategoryValue(str)
  }
  return str
}

export function formatCategoryValue(value) {
  if (!value) return ''
  const str = String(value).trim()
  const upper = str.toUpperCase()
  if (ECONOMIC_CATEGORY_MAP[upper]) {
    return ECONOMIC_CATEGORY_MAP[upper]
  }
  const codeMatch = str.match(/^([A-Za-z_]+)/)
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase()
    if (ECONOMIC_CATEGORY_MAP[code]) {
      return ECONOMIC_CATEGORY_MAP[code]
    }
  }
  return str
}

/** 从 extractFields 获取非默认动态列，label 已中文化 */
export function getDynamicTopicColumns(extractFields) {
  if (!extractFields || !extractFields.topic_fields) {
    return []
  }
  return extractFields.topic_fields
    .filter((field) => !field.default)
    .map((field) => ({
      ...field,
      label: formatTopicFieldLabel(field.key, field.label),
    }))
}
