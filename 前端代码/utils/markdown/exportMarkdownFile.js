import { saveAs } from 'file-saver'
import { sanitizeFileName } from '@/utils/word/exportPlainTextDocx.js'

/**
 * 将 Markdown 文本直接导出为单个 .md 文件（预览导出为单文件场景，无需打 zip）
 * @param {string} fileName 原文件名（取去扩展名的基础名，清洗非法字符）
 * @param {string} content Markdown 原文
 */
export function exportMarkdownFile(fileName, content) {
  const rawBase = String(fileName || '未命名').replace(/\.[^.]+$/, '') || '未命名'
  const mdName = `${sanitizeFileName(rawBase)}.md`
  // 前置 BOM，保证 Windows 记事本等按 UTF-8 打开不乱码
  const blob = new Blob(['\uFEFF', content ?? ''], { type: 'text/markdown;charset=utf-8' })
  saveAs(blob, mdName)
}
