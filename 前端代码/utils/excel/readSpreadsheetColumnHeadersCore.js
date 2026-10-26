/**
 * 表格首行表头解析（纯函数，无网络依赖）
 * - Excel：仅第一个工作表，且 sheetRows:1
 * - CSV：对齐 PreviewFile 分隔符探测；空表头丢弃（不生成 Column_N）
 */
import * as XLSX from 'xlsx'

/**
 * @param {*} cell
 * @returns {string}
 */
export function normalizeHeaderCell(cell) {
  if (cell == null) return ''
  if (typeof cell === 'string') return cell.trim()
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell).trim()
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

/**
 * @param {unknown[]} row
 * @returns {string[]}
 */
export function normalizeHeaderRow(row) {
  if (!Array.isArray(row)) return []
  const out = []
  const seen = new Set()
  for (const cell of row) {
    const h = normalizeHeaderCell(cell)
    if (!h || seen.has(h)) continue
    seen.add(h)
    out.push(h)
  }
  return out
}

export function decodeBufferToText(buffer) {
  const decoders = ['utf-8', 'gb18030', 'gbk']
  const looksGarbled = (text) => {
    if (text.indexOf('\uFFFD') !== -1) return true
    // eslint-disable-next-line no-control-regex
    const nonPrintable = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length
    return nonPrintable > Math.max(5, text.length * 0.01)
  }
  for (let i = 0; i < decoders.length; i++) {
    try {
      const text = new TextDecoder(decoders[i], { fatal: false }).decode(buffer)
      if (!looksGarbled(text)) return text
    } catch {
      /* try next */
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch {
    return ''
  }
}

export function stripBomAndNormalize(text) {
  if (text && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** @param {string} text */
export function detectDelimiter(text) {
  const candidates = [',', ';', '\t', '|']
  const sampleLines = text.split('\n').slice(0, 10)
  let best = { delim: ',', score: -1 }
  for (let i = 0; i < candidates.length; i++) {
    const delim = candidates[i]
    const counts = sampleLines
      .map((l) => (l === '' ? 0 : l.split(delim).length))
      .filter((c) => c > 1)
    if (counts.length === 0) continue
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length
    const score = counts.length * avg - variance
    if (score > best.score) best = { delim: delim, score }
  }
  return best.delim
}

/**
 * 仅解析 CSV 首行表头（丢弃空串，不生成 Column_N）
 * @param {string} csvText
 * @returns {string[]}
 */
export function parseCsvHeadersFromText(csvText) {
  if (!csvText) return []
  const delimiter = detectDelimiter(csvText)
  let currentField = ''
  let currentRecord = []
  let inQuotes = false
  let headerRow = null

  const pushField = () => {
    let value = currentField
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
      value = value.slice(1, -1)
    }
    value = value.replace(/""/g, '"')
    currentRecord.push(value)
    currentField = ''
  }
  const finishHeaderRow = () => {
    if (headerRow != null) return
    headerRow = currentRecord
    currentRecord = []
  }

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]
    const next = i + 1 < csvText.length ? csvText[i + 1] : ''
    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === delimiter) {
      pushField()
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      pushField()
      finishHeaderRow()
      if (ch === '\r' && next === '\n') i++
      break
    }
    currentField += ch
  }
  if (headerRow == null) {
    pushField()
    finishHeaderRow()
  }
  if (!headerRow || !headerRow.length) return []
  return normalizeHeaderRow(headerRow)
}

/**
 * 从 ArrayBuffer 解析 Excel 首 sheet 首行（sheetRows:1）
 * @param {ArrayBuffer} buffer
 * @returns {string[]}
 */
export function parseExcelHeadersFromArrayBuffer(buffer) {
  if (!buffer) return []
  const workbook = XLSX.read(buffer, { type: 'array', sheetRows: 1 })
  const sheetName = workbook.SheetNames && workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  if (!Array.isArray(rows) || !rows.length) return []
  return normalizeHeaderRow(rows[0])
}

/**
 * 从 compare 结果 / disposal 中提取真实源列（禁止 DEFAULT 兜底）
 * @param {object|null|undefined} compareOrDisposal
 * @returns {{ table1: string[], table2: string[] }}
 */
export function extractRealSourceColumns(compareOrDisposal) {
  const src = compareOrDisposal || {}
  const compare = src.compare_response || src
  const t1 =
    (Array.isArray(compare.table1_source_columns) && compare.table1_source_columns) ||
    (Array.isArray(src.table1_source_columns) && src.table1_source_columns) ||
    []
  const t2 =
    (Array.isArray(compare.table2_source_columns) && compare.table2_source_columns) ||
    (Array.isArray(src.table2_source_columns) && src.table2_source_columns) ||
    []
  return {
    table1: normalizeHeaderRow(t1),
    table2: normalizeHeaderRow(t2)
  }
}
