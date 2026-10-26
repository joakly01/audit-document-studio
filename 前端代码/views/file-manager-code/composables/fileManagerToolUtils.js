/** 文档资料挖掘工具箱：按字典「值」对齐可见工具、图标；分类来自 tool_module 树 */

import associationDegreeTwoTablesIcon from '../iconKey/associationDegreeTwoTables.png'
import biddingAnalysisIcon from '../iconKey/biddingAnalysis.png'
import contractCompletenessIcon from '../iconKey/contractCompleteness.png'
import engineeringProjectIcon from '../iconKey/engineeringProject.png'
import fileToPdfIcon from '../iconKey/fileToPdf.png'
import meetingMinutesIcon from '../iconKey/meetingMinutes.png'
import prepaidExpensesIcon from '../iconKey/prepaidExpenses.png'
import riskPointAnalysisIcon from '../iconKey/riskPointAnalysis.png'
import riskPointCheckIcon from '../iconKey/riskPointCheck.png'
import riskPointLabelIcon from '../iconKey/风险点分析.png'
import riskPointScreeningIcon from '../iconKey/风险点排查.png'
import themeAnalysisIcon from '../iconKey/themeAnalysis.png'
import timelineAnalysisIcon from '../iconKey/timelineAnalysis.png'
import wordCloudIcon from '../iconKey/wordCloud.png'

/**
 * 仅保留与后端 / visible-tools 大小写或历史别名兼容的规范化（不做 tool_module→功能 的业务映射）
 * tool_module 子项「值」应与 file-manager-function「值」一致，由字典维护。
 */
export const FILE_MANAGER_TOOL_VALUE_ALIASES = {
  PrepaidExpenses: 'prepaidExpenses',
  prepaid_expenses: 'prepaidExpenses',
  RiskPointAnalysis: 'riskPointAnalysis',
  risk_point_analysis: 'riskPointAnalysis',
  riskPointCheck: 'riskPointAnalysis',
  risk_point_check: 'riskPointAnalysis',
  riskPointInspection: 'riskPointAnalysis',
  risk_point_inspection: 'riskPointAnalysis',
  风险点分析: 'riskPointAnalysis',
  风险点排查: 'riskPointAnalysis',
}

/** canonical value / 原始 key → 图标 URL */
const TOOL_ICON_MAP = {
  associationDegreeTwoTables: associationDegreeTwoTablesIcon,
  biddingAnalysis: biddingAnalysisIcon,
  contractCompleteness: contractCompletenessIcon,
  engineeringProject: engineeringProjectIcon,
  engineering_project_data_consistency: engineeringProjectIcon,
  fileToPdf: fileToPdfIcon,
  meetingMinutes: meetingMinutesIcon,
  prepaidExpenses: prepaidExpensesIcon,
  riskPointAnalysis: riskPointAnalysisIcon,
  riskPointCheck: riskPointCheckIcon,
  风险点分析: riskPointLabelIcon,
  风险点排查: riskPointScreeningIcon,
  themeAnalysis: themeAnalysisIcon,
  timelineAnalysis: timelineAnalysisIcon,
  wordCloud: wordCloudIcon,
  wordCloudAnalysis: wordCloudIcon,
}

/**
 * 规范化文件管理工具 value（大小写/历史别名；不做分类字典业务映射）
 * @param {string} value 原始 value
 * @param {string} [label] 展示名称（仅用于极端兜底：中文名当 value 时）
 * @returns {string} canonical value
 */
export function normalizeFileManagerToolValue(value, label) {
  const key = String(value || '').trim()
  if (FILE_MANAGER_TOOL_VALUE_ALIASES[key]) {
    return FILE_MANAGER_TOOL_VALUE_ALIASES[key]
  }
  if (TOOL_ICON_MAP[key]) {
    return key
  }
  if (!key && label) {
    const labelKey = String(label || '').trim()
    if (FILE_MANAGER_TOOL_VALUE_ALIASES[labelKey]) {
      return FILE_MANAGER_TOOL_VALUE_ALIASES[labelKey]
    }
  }
  return key
}

/**
 * 从 tool_module 子项取与可见工具对齐的 value（优先字典「值」字段）
 * @param {Object} moduleItem 字典子项
 * @returns {string} canonical value
 */
export function resolveToolModuleChildValue(moduleItem) {
  if (!moduleItem) return ''
  const rawValue = String(moduleItem.value || moduleItem.item_value || '').trim()
  if (rawValue) {
    return normalizeFileManagerToolValue(rawValue)
  }
  // 无 value 时兼容仅填了 key_code 的旧数据（仍按同一套别名规范化，不额外业务映射）
  const keyCode = String(moduleItem.key_code || '').trim()
  if (keyCode) {
    return normalizeFileManagerToolValue(keyCode)
  }
  return ''
}

/**
 * 解析工具图标 key
 * @param {string} toolKey 工具 value
 * @param {string} [label] 展示名称
 * @returns {string} 图标 key
 */
export function resolveFileManagerToolIconKey(toolKey, label) {
  const canonical = normalizeFileManagerToolValue(toolKey, label)
  if (TOOL_ICON_MAP[canonical]) return canonical
  const raw = String(toolKey || '').trim()
  if (raw && TOOL_ICON_MAP[raw]) return raw
  return canonical
}

/**
 * 获取工具图标 URL
 * @param {string} toolKey 工具 value
 * @param {string} [label] 展示名称
 * @returns {string} 图片地址
 */
export function getFileManagerToolIconUrl(toolKey, label) {
  const iconKey = resolveFileManagerToolIconKey(toolKey, label)
  return TOOL_ICON_MAP[iconKey] || TOOL_ICON_MAP[normalizeFileManagerToolValue(toolKey, label)] || ''
}

/**
 * 基于 tool_module 树与可见工具列表构建工具箱分类（无可见工具的分类不返回）
 * 父子结构：父=分类标题，子=工具；子项与可见工具仅按「值」匹配；权限仍以 /visible-tools 为准。
 * @param {Array<{ value: string, label: string }>} visibleTools /visible-tools 结果
 * @param {Array} moduleTree tool_module 树形字典项
 * @returns {Array<{ code: string, label: string, sortOrder: number, tools: Array }>}
 */
export function buildFileManagerToolboxGroups(visibleTools, moduleTree) {
  const tools = Array.isArray(visibleTools) ? visibleTools : []
  const toolByValue = new Map()
  tools.forEach((tool) => {
    if (!tool || !tool.value) return
    toolByValue.set(String(tool.value), tool)
  })

  const assigned = new Set()
  const groups = []
  const categories = Array.isArray(moduleTree) ? moduleTree : []

  /**
   * 按字典子项「值」收集当前用户可见的工具
   * @param {Array<Object>} children tool_module 子项
   * @returns {Array<{ value: string, label: string }>}
   */
  const collectVisibleToolsByValue = (children) => {
    const groupTools = []
    ;(children || []).forEach((child) => {
      if (!child) return
      const canonical = resolveToolModuleChildValue(child)
      if (!canonical || assigned.has(canonical) || !toolByValue.has(canonical)) return
      assigned.add(canonical)
      groupTools.push(toolByValue.get(canonical))
    })
    return groupTools
  }

  categories.forEach((category, index) => {
    if (!category) return
    const children = Array.isArray(category.children) ? category.children : []
    if (children.length === 0) return
    const groupTools = collectVisibleToolsByValue(children)
    if (groupTools.length === 0) return
    groups.push({
      code: String(category.key_code || category.value || `module_${index}`),
      label: String(category.label || category.key_code || '未命名分类').trim() || '未命名分类',
      sortOrder: Number(category.sort_order ?? index),
      tools: groupTools
    })
  })

  groups.sort((a, b) => a.sortOrder - b.sortOrder)

  // 有分类树但未归入任何分类的可见工具：归入「其他」（仍受权限列表约束）
  const leftovers = tools.filter((tool) => tool && tool.value && !assigned.has(tool.value))
  if (groups.length > 0 && leftovers.length > 0) {
    groups.push({
      code: '__other__',
      label: '其他',
      sortOrder: Number.MAX_SAFE_INTEGER,
      tools: leftovers
    })
  }

  return groups
}
