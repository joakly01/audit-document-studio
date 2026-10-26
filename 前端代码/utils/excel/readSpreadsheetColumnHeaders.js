/**
 * 读取 Excel/CSV 首行表头，供两表相似度等配置下拉使用。
 * 有 fileId 时走后端 column-headers，避免浏览器整文件下载解析。
 * 纯解析见 readSpreadsheetColumnHeadersCore.js
 */
import { getSpreadsheetColumnHeadersAPI } from '@/api/fileManager.js'
import {
  decodeBufferToText,
  parseCsvHeadersFromText,
  parseExcelHeadersFromArrayBuffer,
  stripBomAndNormalize
} from './readSpreadsheetColumnHeadersCore.js'

export {
  normalizeHeaderCell,
  normalizeHeaderRow,
  detectDelimiter,
  parseCsvHeadersFromText,
  parseExcelHeadersFromArrayBuffer,
  extractRealSourceColumns
} from './readSpreadsheetColumnHeadersCore.js'

/**
 * @param {object} fileMeta
 * @returns {string}
 */
function resolveFileType(fileMeta) {
  const t = String(fileMeta?.type || '').toLowerCase()
  if (t) return t
  const name = String(fileMeta?.name || fileMeta?.file_name || '')
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  return ext || ''
}

/**
 * @param {object|null|undefined} fileMeta
 * @returns {string|null}
 */
function resolveFileId(fileMeta) {
  if (!fileMeta) return null
  const id = fileMeta.fileId || fileMeta.id || fileMeta.file_id
  return id != null && String(id).trim() !== '' ? String(id) : null
}

/**
 * 读取表格文件首行列名。
 * @param {object|null|undefined} fileMeta { fileId, type, name, raw? }
 * @returns {Promise<{ headers: string[], tooLarge?: boolean, message?: string }>}
 */
export async function readSpreadsheetColumnHeaders(fileMeta) {
  if (!fileMeta) return { headers: [] }

  const fileId = resolveFileId(fileMeta)
  if (fileId) {
    try {
      const res = await getSpreadsheetColumnHeadersAPI(fileId)
      if (res?.code === 200 && res.data) {
        const headers = Array.isArray(res.data.headers) ? res.data.headers : []
        const tooLarge = !!res.data.too_large
        return {
          headers,
          tooLarge,
          message: tooLarge
            ? (res.message || '文件过大，无法自动读取列名，请手动输入')
            : (res.message || undefined)
        }
      }
      console.warn('[readSpreadsheetColumnHeaders] 后端返回异常:', res)
      return {
        headers: [],
        message: res?.message || '读取列名失败，请手动输入或检查文件是否存在'
      }
    } catch (e) {
      const status = e?.response?.status
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        ''
      console.warn('[readSpreadsheetColumnHeaders] 后端接口失败:', status, detail, e)
      let message = '读取列名失败，请手动输入列名'
      if (status === 404) {
        message =
          detail && detail !== 'Not Found'
            ? String(detail)
            : '读取列名接口不可用（404），请确认后端已部署 column-headers 并重启服务；亦可手动输入列名'
      } else if (status === 403) {
        message = '无权限读取该文件列名，请手动输入或更换有权限的文件'
      } else if (detail && detail !== 'Not Found') {
        message = `读取列名失败：${detail}`
      }
      return { headers: [], message }
    }
  }

  // 仅本地 raw、无 fileId：本地解析兜底
  try {
    if (!fileMeta.raw) {
      console.warn('[readSpreadsheetColumnHeaders] 无 fileId 且无 raw')
      return { headers: [] }
    }
    const fileType = resolveFileType(fileMeta)
    const buf = await fileMeta.raw.arrayBuffer()
    if (fileType === 'csv') {
      return {
        headers: parseCsvHeadersFromText(stripBomAndNormalize(decodeBufferToText(buf)))
      }
    }
    return { headers: parseExcelHeadersFromArrayBuffer(buf) }
  } catch (e) {
    console.warn('[readSpreadsheetColumnHeaders] 本地解析失败:', e)
    return { headers: [] }
  }
}
