import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

/** Excel 会将以 = + - @ 开头的输入当作公式；导出前加零宽空格，强制按文本显示 */
export function sanitizeExcelCellText(value) {
  if (value == null || value === '') return ''
  const s = String(value)
  if (/^[=+\-@]/.test(s)) return '\u200B' + s
  return s
}

/**
 * 将结构一致的对象数组导出为 xlsx：首行表头加粗、冻结首行、单元格为文本格式（避免被识别为公式）
 * @param {Record<string, unknown>[]} rows
 * @param {string} sheetName
 * @param {string} fileBaseName 不含扩展名
 * @param {Record<string, number>} [columnWidthByKey] 列宽（Excel 字符宽度），按表头 key
 */
export async function exportObjectsAsStyledXlsx(rows, sheetName, fileBaseName, columnWidthByKey = {}) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }]
  })

  if (!rows.length) {
    const buffer = await wb.xlsx.writeBuffer()
    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      `${fileBaseName}.xlsx`
    )
    return
  }

  const keys = Object.keys(rows[0])
  ws.addRow(keys)
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.numFmt = '@'
  })

  for (const row of rows) {
    const values = keys.map((k) => sanitizeExcelCellText(row[k] ?? ''))
    const r = ws.addRow(values)
    r.eachCell((cell) => {
      cell.numFmt = '@'
    })
  }

  keys.forEach((k, i) => {
    const w = columnWidthByKey[k]
    if (w != null) {
      ws.getColumn(i + 1).width = w
    } else {
      ws.getColumn(i + 1).width = Math.min(Math.max(String(k).length + 2, 12), 42)
    }
  })

  const buffer = await wb.xlsx.writeBuffer()
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }),
    `${fileBaseName}.xlsx`
  )
}

/**
 * 导出多 Sheet Excel
 * @param {Record<string, unknown>[][]} data 每个 sheet 的行数据
 * @param {string[]} sheets sheet 名称
 * @param {string} name 文件名（不含扩展名）
 * @param {Array<Array<{ s: { r: number, c: number }, e: { r: number, c: number } }>|undefined>} [mergesBySheet]
 *   可选：每个 sheet 的合并区域（SheetJS 坐标，含表头行；r/c 从 0 起）
 */
const exportFn = (data, sheets, name, mergesBySheet) => {
  // 创建工作簿
  const wb = XLSX.utils.book_new()
  data.forEach((item, index) => {
    const userSheet = XLSX.utils.json_to_sheet(item)
    // 动态设置列宽
    const cols = Object.keys(item[0] || {}).map((i) => ({ wch: i.length * 3 || 32 }))
    userSheet['!cols'] = cols
    const merges = Array.isArray(mergesBySheet) ? mergesBySheet[index] : null
    if (Array.isArray(merges) && merges.length) {
      userSheet['!merges'] = merges
    }
    XLSX.utils.book_append_sheet(wb, userSheet, sheets[index])
  })

  // 将工作簿保存为文件
  XLSX.writeFile(wb, name + '.xlsx')
}

const importFn = (file, sheetIndex) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    reader.onload = (e) => {
      const data = e.target.result
      const workbook = XLSX.read(data, { type: 'binary', cellDates: true })
      const wsname = workbook.SheetNames[sheetIndex]
      const outdata = XLSX.utils.sheet_to_json(workbook.Sheets[wsname])
      outdata.forEach((item) => {
        Object.keys(item).forEach((key) => {
          item[key] = item[key].toString()
        })
      })
      console.log(outdata)
      resolve(outdata)
    }
  })
}

export { exportFn, importFn }
