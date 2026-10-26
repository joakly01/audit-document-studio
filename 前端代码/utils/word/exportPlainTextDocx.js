import { Document, Packer, Paragraph, TextRun } from 'docx'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g
const MAX_FILENAME_LENGTH = 180

/**
 * 将 zip 二进制转为 Blob 供 file-saver 下载（低版本浏览器 generateAsync blob 可能不可用）
 * @param {Blob|ArrayBuffer|Uint8Array} zipData
 * @returns {Blob}
 */
function toDownloadBlob(zipData) {
  if (zipData instanceof Blob) {
    return zipData
  }
  const buffer = zipData instanceof ArrayBuffer ? zipData : zipData.buffer
  const bytes = zipData instanceof Uint8Array ? zipData : new Uint8Array(buffer)
  return new Blob([bytes], { type: 'application/zip' })
}

/**
 * 清理 Windows 非法文件名字符
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFileName(name) {
  const cleaned = String(name || '未命名')
    .replace(INVALID_FILENAME_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || '未命名'
}

/**
 * 截断过长文件名，保留 .docx 后缀
 * @param {string} name
 * @returns {string}
 */
function truncateFileName(name) {
  if (name.length <= MAX_FILENAME_LENGTH) {
    return name
  }
  const ext = '.docx'
  const baseMax = MAX_FILENAME_LENGTH - ext.length
  return `${name.slice(0, baseMax)}${ext}`
}

/**
 * 生成批次内唯一的 docx 文件名；重名时使用 folderPath 区分
 * @param {string} fileName
 * @param {string} folderPath
 * @param {Set<string>} usedNames 小写文件名集合
 * @returns {string}
 */
export function buildUniqueDocxFileName(fileName, folderPath, usedNames) {
  const rawBase = String(fileName || '未命名').replace(/\.[^.]+$/, '') || '未命名'
  const base = sanitizeFileName(rawBase)

  const tryName = (candidate) => {
    const normalized = candidate.toLowerCase()
    if (!usedNames.has(normalized)) {
      usedNames.add(normalized)
      return truncateFileName(candidate)
    }
    return null
  }

  let result = tryName(`${base}.docx`)
  if (result) {
    return result
  }

  const pathPart = sanitizeFileName(String(folderPath || '').replace(/\\/g, '/'))
  if (pathPart) {
    result = tryName(`${base}_${pathPart}.docx`)
    if (result) {
      return result
    }
    let pathIndex = 2
    while (pathIndex < 1000) {
      result = tryName(`${base}_${pathPart}_${pathIndex}.docx`)
      if (result) {
        return result
      }
      pathIndex += 1
    }
  }

  let index = 1
  while (index < 1000) {
    result = tryName(`${base}_${index}.docx`)
    if (result) {
      return result
    }
    index += 1
  }

  const fallback = truncateFileName(`${base}_${Date.now()}.docx`)
  usedNames.add(fallback.toLowerCase())
  return fallback
}

/**
 * 纯文本生成 docx 文档对象
 * @param {string} content - 文件正文
 * @returns {Document}
 */
function buildPlainTextDocument(content) {
  const text = content != null ? content : ''
  const lines = text.split(/\r?\n/)
  const children =
    lines.length > 0
      ? lines.map((line) => new Paragraph({ children: [new TextRun(line)] }))
      : [new Paragraph({ text: '' })]

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })
}

/**
 * 纯文本生成 docx ArrayBuffer（直接导出，避免 Blob.prototype.arrayBuffer 兼容问题）
 * @param {string} content - 文件正文
 * @returns {Promise<ArrayBuffer>}
 */
export async function buildDocxArrayBufferFromPlainText(content) {
  const doc = buildPlainTextDocument(content)
  return Packer.toArrayBuffer(doc)
}

/**
 * 纯文本生成 docx Blob
 * @param {string} content - 文件正文
 * @returns {Promise<Blob>}
 */
export async function buildDocxBlobFromPlainText(content) {
  const doc = buildPlainTextDocument(content)
  const arrayBuffer = await Packer.toArrayBuffer(doc)
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

/**
 * 纯文本直接导出单个 docx 文件（预览导出等单文件场景，无需打 zip）
 * @param {string} fileName 原文件名（取去扩展名的基础名，清洗非法字符）
 * @param {string} content 文件正文
 * @returns {Promise<void>}
 */
export async function exportPlainTextDocxFile(fileName, content) {
  const blob = await buildDocxBlobFromPlainText(content)
  const rawBase = String(fileName || '未命名').replace(/\.[^.]+$/, '') || '未命名'
  saveAs(blob, truncateFileName(`${sanitizeFileName(rawBase)}.docx`))
}

/**
 * 将多个文件内容导出为 zip（每个文件一个 docx）
 * @param {{ fileName: string, folderPath?: string, content?: string }[]} items
 * @param {string} zipFileName
 * @returns {Promise<void>}
 */
export async function exportTextSearchResultsAsZip(items, zipFileName) {
  const zip = new JSZip()
  const usedNames = new Set()

  for (const item of items) {
    const docxName = buildUniqueDocxFileName(item.fileName, item.folderPath, usedNames)
    const arrayBuffer = await buildDocxArrayBufferFromPlainText(item.content)
    zip.file(docxName, arrayBuffer)
  }

  const zipName = zipFileName.endsWith('.zip') ? zipFileName : `${zipFileName}.zip`
  let zipData
  try {
    zipData = await zip.generateAsync({ type: 'blob' })
  } catch {
    zipData = await zip.generateAsync({ type: 'uint8array' })
  }
  saveAs(toDownloadBlob(zipData), zipName)
}
