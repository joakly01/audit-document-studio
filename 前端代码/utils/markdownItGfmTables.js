/**
 * markdown-it GFM 管道表插件（精简版）。
 * 默认 markdown-it 不解析 | a | b | 表格，文本检索/解析预览需要显式启用。
 */
function getLine(state, line) {
  const pos = state.bMarks[line] + state.tShift[line]
  const max = state.eMarks[line]
  return state.src.slice(pos, max)
}

function isTableSep(line) {
  const t = String(line || '').trim()
  if (!t.includes('-')) return false
  return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(t)
}

function splitRow(line) {
  let s = String(line || '').trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function markdownItGfmTables(md) {
  md.block.ruler.before(
    'paragraph',
    'gfm_table',
    (state, startLine, endLine, silent) => {
      if (startLine + 1 >= endLine) return false

      const first = getLine(state, startLine)
      const second = getLine(state, startLine + 1)
      if (!first.includes('|') || !isTableSep(second)) return false

      const header = splitRow(first)
      if (!header.length) return false
      const colCount = header.length

      let next = startLine + 2
      const body = []
      while (next < endLine) {
        const line = getLine(state, next)
        if (!line.trim() || !line.includes('|')) break
        if (isTableSep(line)) break
        const cells = splitRow(line)
        while (cells.length < colCount) cells.push('')
        body.push(cells.slice(0, colCount))
        next += 1
      }

      if (silent) return true

      const tokenOpen = state.push('table_open', 'table', 1)
      tokenOpen.map = [startLine, next]

      state.push('thead_open', 'thead', 1)
      state.push('tr_open', 'tr', 1)
      for (const cell of header) {
        state.push('th_open', 'th', 1)
        const inline = state.push('inline', '', 0)
        inline.content = cell
        inline.children = []
        state.push('th_close', 'th', -1)
      }
      state.push('tr_close', 'tr', -1)
      state.push('thead_close', 'thead', -1)

      if (body.length) {
        state.push('tbody_open', 'tbody', 1)
        for (const row of body) {
          state.push('tr_open', 'tr', 1)
          for (const cell of row) {
            state.push('td_open', 'td', 1)
            const inline = state.push('inline', '', 0)
            inline.content = cell
            inline.children = []
            state.push('td_close', 'td', -1)
          }
          state.push('tr_close', 'tr', -1)
        }
        state.push('tbody_close', 'tbody', -1)
      }

      state.push('table_close', 'table', -1)
      state.line = next
      return true
    },
    { alt: ['paragraph', 'reference'] }
  )
}

export default markdownItGfmTables
