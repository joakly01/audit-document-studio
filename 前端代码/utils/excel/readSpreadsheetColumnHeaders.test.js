import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  normalizeHeaderRow,
  parseCsvHeadersFromText,
  parseExcelHeadersFromArrayBuffer,
  extractRealSourceColumns
} from './readSpreadsheetColumnHeadersCore.js'
import {
  DEFAULT_ASSOCIATION_TABLE1_SOURCE_COLUMNS,
  DEFAULT_ASSOCIATION_TABLE2_SOURCE_COLUMNS,
  buildColumnSchema
} from '@/utils/associationTwoTablesColumnSchema.js'

/** 与 CompareFieldMappingEditor 一致：下拉仅用文件表头，不合并映射手改值 */
function fileColumnOptions(fromFile) {
  return [...new Set((fromFile || []).filter(Boolean).map((c) => String(c)))]
}

/** 与 updateEntry 一致的 null 规范 */
function normalizeFieldValue(value) {
  return value == null ? '' : String(value)
}

describe('normalizeHeaderRow', () => {
  it('trims and drops empties and duplicates', () => {
    expect(normalizeHeaderRow([' 名称 ', '', '金额', '名称', null, 12])).toEqual([
      '名称',
      '金额',
      '12'
    ])
  })
})

describe('parseCsvHeadersFromText', () => {
  it('parses first row and drops empty headers', () => {
    const text = '项目名称,,投资额\nA,B,1\n'
    expect(parseCsvHeadersFromText(text)).toEqual(['项目名称', '投资额'])
  })

  it('does not invent Column_N placeholders', () => {
    expect(parseCsvHeadersFromText(',,\n1,2,3\n')).toEqual([])
  })

  it('supports semicolon delimiter', () => {
    expect(parseCsvHeadersFromText('A;B;C\n1;2;3\n')).toEqual(['A', 'B', 'C'])
  })
})

describe('parseExcelHeadersFromArrayBuffer', () => {
  it('reads first sheet first row only', () => {
    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['项目名称', '投资额', ''],
      ['甲', 100],
      ['乙', 200]
    ])
    const ws2 = XLSX.utils.aoa_to_sheet([['不应出现', '列']])
    XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1')
    XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    expect(parseExcelHeadersFromArrayBuffer(buf)).toEqual(['项目名称', '投资额'])
  })
})

describe('extractRealSourceColumns — 禁止 DEFAULT', () => {
  it('returns empty when missing (no DEFAULT)', () => {
    expect(extractRealSourceColumns({})).toEqual({ table1: [], table2: [] })
  })

  it('does not equal buildColumnSchema DEFAULT fallback', () => {
    const schema = buildColumnSchema(null, {})
    const real = extractRealSourceColumns({})
    expect(real.table1).toEqual([])
    expect(real.table2).toEqual([])
    expect(schema.table1SourceColumns).toEqual(DEFAULT_ASSOCIATION_TABLE1_SOURCE_COLUMNS)
    expect(schema.table2SourceColumns).toEqual(DEFAULT_ASSOCIATION_TABLE2_SOURCE_COLUMNS)
    // 配置下拉不得使用 schema 兜底
    expect(real.table1).not.toEqual(schema.table1SourceColumns)
    expect(real.table2).not.toEqual(schema.table2SourceColumns)
  })

  it('reads nested compare_response columns only', () => {
    const r = extractRealSourceColumns({
      compare_response: {
        table1_source_columns: ['A', ' B '],
        table2_source_columns: ['X']
      }
    })
    expect(r.table1).toEqual(['A', 'B'])
    expect(r.table2).toEqual(['X'])
  })
})

describe('column options (仅文件表头，不受映射编辑影响)', () => {
  it('uses file headers only', () => {
    expect(fileColumnOptions(['项目名称', '投资额'])).toEqual(['项目名称', '投资额'])
  })

  it('does not include mapping custom values in dropdown', () => {
    const fileOpts = fileColumnOptions(['项目名称', '投资额'])
    const mappingEdited = '项目名称（改）'
    expect(fileOpts).not.toContain(mappingEdited)
    expect(fileOpts).toEqual(['项目名称', '投资额'])
  })

  it('empty file headers → empty suggestions (手输仍写映射)', () => {
    expect(fileColumnOptions([])).toEqual([])
  })
})

describe('clearable null → empty string', () => {
  it('normalizes null/undefined to empty', () => {
    expect(normalizeFieldValue(null)).toBe('')
    expect(normalizeFieldValue(undefined)).toBe('')
    expect(normalizeFieldValue('项目名称')).toBe('项目名称')
  })
})

describe('race token discard (模拟)', () => {
  it('stale token result is discarded', async () => {
    let token = 0
    let columns = []
    const load = async (id, delay, headers) => {
      token += 1
      const myToken = token
      columns = []
      await new Promise((r) => setTimeout(r, delay))
      if (myToken !== token) return
      columns = headers
    }
    await Promise.all([load('old', 30, ['旧列']), load('new', 5, ['新列'])])
    expect(columns).toEqual(['新列'])
  })
})
