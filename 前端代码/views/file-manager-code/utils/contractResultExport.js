import { ElMessage } from 'element-plus'
import {
  parseContractDisposalResult,
  mergeContractResultsWithRules,
  getInformationExtractionFromSettings,
  parseContractText2Rows
} from '@/utils/contractDisposalParser.js'

/**
 * 解析单条调度结果中的合同分析条目
 * @param {object} resultItem 调度结果
 * @returns {Array}
 */
function parseScheduleItemResults(resultItem) {
  let config = {}
  try {
    config = resultItem.parameter_settings ? JSON.parse(resultItem.parameter_settings) : {}
  } catch {
    config = {}
  }

  const disposalRaw = resultItem.disposal_result
  if (!disposalRaw) return []

  const rules = getInformationExtractionFromSettings(config)
  const parsed = parseContractDisposalResult(disposalRaw)
  const fromText = parsed?.parsedArray?.length
    ? mergeContractResultsWithRules(
      parsed.parsedArray,
      rules,
      parsed.ruleTemplates || []
    )
    : []
  // 与页面展示 / 后端导出一致：规则分析（text）在前，自动分析（text_2）在后
  const { rows: fromText2 } = parseContractText2Rows(disposalRaw, config)
  if (fromText.length && fromText2.length) return [...fromText, ...fromText2]
  if (fromText.length) return fromText
  return fromText2
}

/**
 * 从本地 fileConfigMap 判断是否已有可导出结果
 * @param {Record<string, { result?: Array }>} fileConfigMap 文件结果映射
 * @returns {boolean}
 */
function hasExportableFromConfigMap(fileConfigMap) {
  return Object.values(fileConfigMap || {}).some(
    (entry) => (Array.isArray(entry?.result) && entry.result.length > 0)
      || (Array.isArray(entry?.autoAnalysisResult) && entry.autoAnalysisResult.length > 0)
  )
}

/**
 * 判断任务是否包含可导出的解析结果
 * @param {Array} taskScheduleResultList 任务调度结果列表
 * @param {Record<string, { result?: Array }>} [fileConfigMap] 本地结果映射
 * @returns {boolean}
 */
export function hasExportableContractResults(taskScheduleResultList, fileConfigMap) {
  if (Array.isArray(taskScheduleResultList) && taskScheduleResultList.length) {
    const hasFromTask = taskScheduleResultList.some((item) => {
      const st = Number(item.processing_status ?? item.PROCESSING_STATUS ?? -1)
      return st === 2 && item.disposal_result && parseScheduleItemResults(item).length > 0
    })
    if (hasFromTask) return true
  }
  return hasExportableFromConfigMap(fileConfigMap)
}

/**
 * 从 Content-Disposition 解析下载文件名
 * @param {string} contentDisposition 响应头
 * @returns {string}
 */
function parseDownloadFilename(contentDisposition) {
  if (!contentDisposition) return ''
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      return utf8Match[1].trim()
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(contentDisposition)
  return plainMatch?.[1]?.trim() || ''
}

/**
 * 解析 blob 错误响应中的 message
 * @param {Blob} blob 错误响应体
 * @returns {Promise<string>}
 */
async function parseBlobErrorMessage(blob) {
  try {
    const text = await blob.text()
    const data = JSON.parse(text)
    return data?.detail || data?.message || text
  } catch {
    return ''
  }
}

/**
 * 下载后端导出的 Excel 响应
 * @param {object} response axios 响应
 * @param {{ fallbackName?: string }} [options] 选项
 * @returns {Promise<boolean>} 是否下载成功
 */
export async function downloadContractExportResponse(response, options = {}) {
  const data = response?.data
  const ctype = String(response?.headers?.['content-type'] || '').toLowerCase()
  if (data instanceof Blob && (ctype.includes('application/json') || data.type === 'application/json')) {
    const msg = await parseBlobErrorMessage(data)
    ElMessage.error(msg || '导出失败')
    return false
  }
  if (!(data instanceof Blob) || data.size === 0) {
    ElMessage.error('导出失败：未返回有效文件')
    return false
  }

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = parseDownloadFilename(response?.headers?.['content-disposition'])
    || options.fallbackName
    || `合同分析_导出结果_${Date.now()}.xlsx`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 300)
  return true
}
