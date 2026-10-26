import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

/**
 * 解析 Markdown 文本并导出为 Word 文档（保留表格和样式）
 * @param {string} markdownText - Markdown 文本
 * @param {string} fileName - 文件名（不含扩展名）
 */
const exportMarkdownToWord = async (markdownText, fileName = 'document') => {
  try {
    const elements = parseMarkdownToElements(markdownText);
    const children = [];

    for (const element of elements) {
      const items = await createDocxElement(element);
      children.push(...items);
    }

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children.length > 0 ? children : [new Paragraph({ text: '' })],
        },
      ],
    });

    // 生成 Blob 并下载
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${fileName}.docx`);
    
    return { success: true, message: '导出成功' };
  } catch (error) {
    console.error('导出 Word 失败:', error);
    return { success: false, message: error.message };
  }
};

/**
 * 解析 Markdown 文本为结构化元素
 */
function parseMarkdownToElements(markdown) {
  const lines = markdown.split('\n');
  const elements = [];
  let tableLines = [];
  let codeBlockLines = [];
  let inCodeBlock = false;
  let codeLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 代码块开始/结束
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        // 代码块开始
        inCodeBlock = true;
        codeLanguage = trimmedLine.slice(3).trim();
        codeBlockLines = [];
      } else {
        // 代码块结束
        inCodeBlock = false;
        elements.push({
          type: 'code',
          language: codeLanguage,
          content: codeBlockLines.join('\n'),
        });
        codeBlockLines = [];
        codeLanguage = '';
      }
      continue;
    }

    // 代码块内容
    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // 表格行
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      tableLines.push(line);
      continue;
    } else if (tableLines.length > 0) {
      // 表格结束
      elements.push({
        type: 'table',
        lines: tableLines,
      });
      tableLines = [];
    }

    // 标题
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      elements.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      continue;
    }

    // 无序列表
    if (trimmedLine.match(/^[-*+]\s+(.+)$/)) {
      const content = trimmedLine.replace(/^[-*+]\s+/, '');
      elements.push({
        type: 'list-item',
        content: content,
      });
      continue;
    }

    // 有序列表
    if (trimmedLine.match(/^\d+\.\s+(.+)$/)) {
      const content = trimmedLine.replace(/^\d+\.\s+/, '');
      elements.push({
        type: 'ordered-list-item',
        content: content,
      });
      continue;
    }

    // 引用
    if (trimmedLine.startsWith('>')) {
      const content = trimmedLine.replace(/^>\s*/, '');
      elements.push({
        type: 'quote',
        content: content,
      });
      continue;
    }

    // 分隔线
    if (trimmedLine.match(/^[-*_]{3,}$/)) {
      elements.push({
        type: 'horizontal-rule',
      });
      continue;
    }

    // 空行
    if (trimmedLine === '') {
      elements.push({
        type: 'empty',
      });
      continue;
    }

    // 普通段落
    elements.push({
      type: 'paragraph',
      content: line,
    });
  }

  // 处理剩余的表格
  if (tableLines.length > 0) {
    elements.push({
      type: 'table',
      lines: tableLines,
    });
  }

  return elements;
}

/**
 * 创建 docx 元素
 */
async function createDocxElement(element) {
  const result = [];

  switch (element.type) {
    case 'heading': {
      const levelMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      const runs = parseInlineMarkdown(element.content);
      result.push(
        new Paragraph({
          heading: levelMap[element.level] || HeadingLevel.HEADING_1,
          children: runs,
        })
      );
      break;
    }

    case 'paragraph': {
      const runs = parseInlineMarkdown(element.content);
      result.push(
        new Paragraph({
          children: runs,
        })
      );
      break;
    }

    case 'list-item': {
      const runs = parseInlineMarkdown(element.content);
      result.push(
        new Paragraph({
          children: runs,
          bullet: { level: 0 },
        })
      );
      break;
    }

    case 'ordered-list-item': {
      const runs = parseInlineMarkdown(element.content);
      result.push(
        new Paragraph({
          children: runs,
          numbering: { reference: 'default-numbering', level: 0 },
        })
      );
      break;
    }

    case 'quote': {
      const runs = parseInlineMarkdown(element.content);
      result.push(
        new Paragraph({
          children: runs,
          italics: true,
          indent: { left: 720 }, // 0.5 inch
        })
      );
      break;
    }

    case 'code': {
      result.push(
        new Paragraph({
          children: [
            new TextRun({
              text: element.content,
              font: 'Consolas',
              size: 20,
            }),
          ],
          shading: {
            fill: 'F5F5F5',
          },
        })
      );
      break;
    }

    case 'table': {
      const table = parseMarkdownTable(element.lines);
      if (table) {
        result.push(table);
      }
      break;
    }

    case 'horizontal-rule': {
      result.push(
        new Paragraph({
          text: '_______________________________________________',
          alignment: 'center',
        })
      );
      break;
    }

    case 'empty': {
      result.push(new Paragraph({ text: '' }));
      break;
    }

    default:
      result.push(new Paragraph({ text: element.content || '' }));
  }

  return result;
}

/**
 * 解析行内 Markdown 样式（加粗、斜体、代码等）
 */
function parseInlineMarkdown(text) {
  const runs = [];

  // 匹配行内样式的正则表达式
  const patterns = [
    { regex: /\*\*\*(.+?)\*\*\*/g, bold: true, italics: true }, // 加粗+斜体
    { regex: /\*\*(.+?)\*\*/g, bold: true }, // 加粗
    { regex: /\*(.+?)\*/g, italics: true }, // 斜体
    { regex: /`(.+?)`/g, code: true }, // 行内代码
    { regex: /\[(.+?)\]\((.+?)\)/g, link: true }, // 链接
  ];

  // 找出所有匹配的位置
  const matches = [];
  patterns.forEach((pattern) => {
    const regex = new RegExp(pattern.regex);
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: regex.lastIndex,
        text: match[1],
        url: match[2], // 对于链接
        ...pattern,
      });
    }
  });

  // 按开始位置排序
  matches.sort((a, b) => a.start - b.start);

  // 处理非重叠的匹配
  let lastEnd = 0;
  for (const match of matches) {
    // 如果与前一个匹配重叠，跳过
    if (match.start < lastEnd) continue;

    // 添加之前的普通文本
    if (match.start > lastEnd) {
      const plainText = text.slice(lastEnd, match.start);
      if (plainText) {
        runs.push(new TextRun({ text: plainText }));
      }
    }

    // 添加样式文本
    const runOptions = { text: match.text };
    if (match.bold) runOptions.bold = true;
    if (match.italics) runOptions.italics = true;
    if (match.code) {
      runOptions.font = 'Consolas';
      runOptions.shading = { fill: 'F5F5F5' };
    }
    runs.push(new TextRun(runOptions));

    lastEnd = match.end;
  }

  // 添加剩余的普通文本
  if (lastEnd < text.length) {
    const plainText = text.slice(lastEnd);
    if (plainText) {
      runs.push(new TextRun({ text: plainText }));
    }
  }

  // 如果没有任何样式，返回纯文本
  if (runs.length === 0) {
    runs.push(new TextRun({ text: text }));
  }

  return runs;
}

/**
 * 解析 Markdown 表格为 docx Table
 */
function parseMarkdownTable(lines) {
  if (!lines || lines.length < 2) return null;

  const rows = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;

    // 解析单元格
    const cells = line
      .slice(1, -1) // 移除首尾的 |
      .split('|')
      .map((cell) => cell.trim());

    // 跳过分隔行（包含 --- 的行）
    if (cells[0] && cells[0].match(/^[-:]+$/)) continue;

    rows.push(cells);
  }

  if (rows.length === 0) return null;

  // 创建表格
  const tableRows = rows.map((rowCells, rowIndex) => {
    const cells = rowCells.map((cellText) => {
      return new TableCell({
        children: [
          new Paragraph({
            children: parseInlineMarkdown(cellText),
          }),
        ],
        shading: rowIndex === 0 ? { fill: 'E7E6E6' } : undefined, // 表头背景色
        width: {
          size: 100 / rowCells.length,
          type: WidthType.PERCENTAGE,
        },
      });
    });

    return new TableRow({
      children: cells,
    });
  });

  return new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
}

export { exportMarkdownToWord };

