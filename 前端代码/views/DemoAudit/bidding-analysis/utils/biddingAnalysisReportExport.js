/** 招投标分析 — 报告摘要 / HTML 导出 */

import { RISK_LEVEL_MAP } from '../mock/biddingAnalysisResultMock.js'
import { getAnalysisModeLabelText } from '../mock/biddingAnalysisTemplateMock.js'

const RISK_LEVEL_ORDER = { high: 0, medium: 1, low: 2, none: 3 }

const REPORT_SECTION_META = [
  {
    key: 'high',
    order: '二',
    intro: '以下事项存在较高合规或舞弊风险，建议优先组织核查并留存证据。',
  },
  {
    key: 'medium',
    order: '三',
    intro: '以下事项存在一定合规隐患，建议结合招标文件与投标响应进一步复核。',
  },
  {
    key: 'low',
    order: '四',
    intro: '以下事项风险相对较低，可在完成重点核查后一并关注。',
  },
]

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getDocTypeLabel(docType) {
  if (docType === 'bidding') return '招标'
  if (docType === 'tender') return '投标'
  if (docType === 'joint') return '联合'
  return docType || '—'
}

function getRiskLabel(level) {
  return RISK_LEVEL_MAP[level]?.label || level || '—'
}

function getRiskColor(level) {
  return RISK_LEVEL_MAP[level]?.borderColor || '#909399'
}

function sortRuleResults(ruleResults) {
  return [...(ruleResults || [])].sort(
    (a, b) => (RISK_LEVEL_ORDER[a.riskLevel] ?? 99) - (RISK_LEVEL_ORDER[b.riskLevel] ?? 99)
  )
}

function buildRiskSummary(sortedRules) {
  const summary = { high: 0, medium: 0, low: 0, none: 0 }
  sortedRules.forEach((rule) => {
    if (summary[rule.riskLevel] !== undefined) summary[rule.riskLevel] += 1
  })
  return summary
}

function buildOverviewText(total, summary) {
  const { high, medium, low, none } = summary
  if (!total) return '暂无分析结果，无法生成报告摘要。'
  return `本次共完成 ${total} 项规则检查，检出高风险 ${high} 项、中风险 ${medium} 项、低风险 ${low} 项，未发现风险 ${none} 项。${
    high + medium > 0
      ? '建议优先关注高风险及中风险事项，并结合证据材料开展进一步核查。'
      : '整体未发现显著合规风险，建议结合业务实际持续跟踪。'
  }`
}

/** 构建报告数据模型（预览 / 复制 / 导出共用） */
export function buildReportModel(project, ruleResults, analysisModes) {
  const sortedRules = sortRuleResults(ruleResults)
  const riskSummary = buildRiskSummary(sortedRules)
  const total = sortedRules.length
  const projectName = project?.name || '招投标分析项目'
  const reportTime = project?.analyzedAt || '—'
  const analysisModeText = getAnalysisModeLabelText(analysisModes) || '—'

  const riskSections = REPORT_SECTION_META.map((meta) => ({
    ...meta,
    orderTitle: `${meta.order}、${RISK_LEVEL_MAP[meta.key]?.label || meta.key}事项`,
    items: sortedRules.filter((item) => item.riskLevel === meta.key),
  }))

  const noneRiskItems = sortedRules.filter((item) => item.riskLevel === 'none')
  const orderNames = ['', '一', '二', '三', '四', '五', '六']
  const noneSectionOrder = orderNames[REPORT_SECTION_META.length + 1] || String(REPORT_SECTION_META.length + 1)
  const noneSectionTitle = `${noneSectionOrder}、未发现风险事项`

  return {
    projectName,
    reportTime,
    analysisModeText,
    overviewText: buildOverviewText(total, riskSummary),
    summaryCards: [
      { key: 'high', label: '高风险', count: riskSummary.high, color: RISK_LEVEL_MAP.high.borderColor },
      { key: 'medium', label: '中风险', count: riskSummary.medium, color: RISK_LEVEL_MAP.medium.borderColor },
      { key: 'low', label: '低风险', count: riskSummary.low, color: RISK_LEVEL_MAP.low.borderColor },
      { key: 'none', label: '未发现风险', count: riskSummary.none, color: RISK_LEVEL_MAP.none.borderColor },
    ],
    riskSections,
    noneRiskItems,
    noneSectionTitle,
    sortedRules,
  }
}

export function buildReportPlainText(model) {
  const lines = [
    '招投标合规分析报告',
    `项目名称：${model.projectName}`,
    `分析时间：${model.reportTime}`,
    `分析模式：${model.analysisModeText}`,
    '',
    model.overviewText,
    '',
  ]
  model.riskSections.forEach((section) => {
    if (!section.items.length) return
    lines.push(section.orderTitle)
    section.items.forEach((item, index) => {
      lines.push(`${index + 1}. [${getRiskLabel(item.riskLevel)}] ${item.title}`)
      lines.push(
        `   规则：${item.ruleName}；来源：${getDocTypeLabel(item.docType)}；置信度：${item.confidence}%`
      )
      lines.push(`   ${item.description}`)
      if (item.aiSummary && item.aiSummary !== item.description) {
        lines.push(`   智能分析：${item.aiSummary}`)
      }
    })
    lines.push('')
  })
  if (model.noneRiskItems.length) {
    lines.push(model.noneSectionTitle)
    model.noneRiskItems.forEach((item) => {
      lines.push(`- ${item.title}（${item.ruleName}）`)
    })
    lines.push('')
  }
  lines.push('报告说明')
  lines.push(
    '本报告由招投标分析系统自动生成，仅供审计核查参考。高风险及中风险事项建议结合原始文件与证据材料进一步核实；最终结论以人工复核为准。'
  )
  return lines.join('\n')
}

function renderEvidenceBlock(item) {
  const list = Array.isArray(item.evidenceList) ? item.evidenceList : []
  if (!list.length) return ''
  const rows = list
    .map(
      (ev) =>
        `<li><strong>${escapeHtml(ev.unit || '—')}</strong>：${escapeHtml(ev.detail || '')}${
          ev.location ? `（${escapeHtml(ev.location)}）` : ''
        }</li>`
    )
    .join('')
  return `<div class="evidence"><div class="evidence-title">关键证据</div><ul>${rows}</ul></div>`
}

function renderRiskItem(item, index) {
  const involved =
    item.docType === 'bidding'
      ? '—'
      : (item.involvedUnits || []).filter((u) => u && u !== '—').join('、') || '—'
  const aiBlock =
    item.aiSummary && item.aiSummary !== item.description
      ? `<p class="ai"><span class="ai-label">智能分析：</span>${escapeHtml(item.aiSummary)}</p>`
      : ''
  return `
    <div class="risk-item">
      <div class="risk-head">
        <span class="risk-index">${index + 1}.</span>
        <span class="risk-tag" style="background:${getRiskColor(item.riskLevel)}">${escapeHtml(getRiskLabel(item.riskLevel))}</span>
        <span class="risk-title">${escapeHtml(item.title)}</span>
      </div>
      <table class="meta-table">
        <tr><th>规则</th><td>${escapeHtml(item.ruleName)}</td><th>来源</th><td>${escapeHtml(getDocTypeLabel(item.docType))}</td></tr>
        <tr><th>置信度</th><td>${escapeHtml(item.confidence)}%</td><th>涉及单位</th><td>${escapeHtml(involved)}</td></tr>
      </table>
      <p class="desc">${escapeHtml(item.description)}</p>
      ${aiBlock}
      ${renderEvidenceBlock(item)}
    </div>
  `
}

export function buildReportHtml(model) {
  const summaryCardsHtml = model.summaryCards
    .map(
      (card) => `
      <div class="summary-card" style="border-color:${card.color}">
        <div class="summary-value" style="color:${card.color}">${card.count}</div>
        <div class="summary-label">${escapeHtml(card.label)}</div>
      </div>`
    )
    .join('')

  const riskSectionsHtml = model.riskSections
    .map((section) => {
      if (!section.items.length) return ''
      const itemsHtml = section.items.map((item, index) => renderRiskItem(item, index)).join('')
      return `
        <section class="section">
          <h2 class="section-title">${escapeHtml(section.orderTitle)}</h2>
          <p class="section-intro">${escapeHtml(section.intro)}</p>
          ${itemsHtml}
        </section>`
    })
    .join('')

  const noneSectionHtml = model.noneRiskItems.length
    ? `
      <section class="section">
        <h2 class="section-title">${escapeHtml(model.noneSectionTitle)}</h2>
        <p class="section-intro">以下检查项未发现明显风险，可作为合规参考。</p>
        <ul class="none-list">
          ${model.noneRiskItems
            .map(
              (item) =>
                `<li><span class="none-tag">未发现风险</span><span class="none-title">${escapeHtml(item.title)}</span><span class="none-rule">（${escapeHtml(item.ruleName)}）</span></li>`
            )
            .join('')}
        </ul>
      </section>`
    : ''

  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(model.projectName)} - 招投标合规分析报告</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #303133;
      background: #f5f7fa;
    }
    .paper {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 36px 40px;
      background: #fff;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .header {
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 2px solid #303133;
      text-align: center;
    }
    .title { margin: 0 0 12px; font-size: 22px; font-weight: 600; }
    .meta { font-size: 13px; color: #606266; }
    .meta span { display: inline-block; margin: 0 12px 6px; }
    .section { margin-bottom: 28px; }
    .section-title { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
    .section-intro, .overview, .note { margin: 0 0 12px; color: #606266; font-size: 13px; }
    .summary-cards { margin-bottom: 12px; font-size: 0; }
    .summary-card {
      display: inline-block;
      width: 120px;
      margin: 0 12px 12px 0;
      padding: 12px 10px;
      text-align: center;
      border: 1px solid #ebeef5;
      border-radius: 6px;
      background: #fafafa;
      vertical-align: top;
      font-size: 14px;
    }
    .summary-value { font-size: 24px; font-weight: 600; line-height: 1.2; }
    .summary-label { margin-top: 4px; font-size: 12px; color: #909399; }
    .risk-item {
      margin-bottom: 16px;
      padding: 14px 16px;
      border: 1px solid #ebeef5;
      border-radius: 6px;
      background: #fafafa;
    }
    .risk-head { margin-bottom: 10px; }
    .risk-index { font-weight: 600; margin-right: 8px; }
    .risk-tag {
      display: inline-block;
      margin-right: 8px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: #fff;
      vertical-align: middle;
    }
    .risk-title { font-weight: 600; font-size: 14px; }
    .meta-table {
      width: 100%;
      margin-bottom: 10px;
      border-collapse: collapse;
      font-size: 13px;
    }
    .meta-table th,
    .meta-table td {
      border: 1px solid #ebeef5;
      padding: 8px 10px;
      text-align: left;
    }
    .meta-table th { width: 80px; background: #f5f7fa; color: #606266; font-weight: 600; }
    .desc, .ai { margin: 0 0 8px; color: #606266; font-size: 13px; }
    .ai-label { font-weight: 600; color: #303133; }
    .evidence { margin-top: 8px; font-size: 13px; color: #606266; }
    .evidence-title { font-weight: 600; margin-bottom: 4px; color: #303133; }
    .evidence ul { margin: 0; padding-left: 20px; }
    .none-list { margin: 0; padding: 0; list-style: none; }
    .none-list li { margin-bottom: 8px; }
    .none-tag {
      display: inline-block;
      margin-right: 8px;
      padding: 2px 8px;
      border-radius: 4px;
      background: #f0f9eb;
      color: #67c23a;
      font-size: 12px;
    }
    .none-title { color: #303133; }
    .none-rule { color: #909399; }
    .footer-note {
      margin-bottom: 0;
      padding-top: 12px;
      border-top: 1px dashed #dcdfe6;
    }
    .export-info {
      margin-top: 20px;
      font-size: 12px;
      color: #909399;
      text-align: right;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .paper { box-shadow: none; border: none; }
    }
  </style>
</head>
<body>
  <div class="paper">
    <header class="header">
      <h1 class="title">招投标合规分析报告</h1>
      <div class="meta">
        <span>项目名称：${escapeHtml(model.projectName)}</span>
        <span>分析时间：${escapeHtml(model.reportTime)}</span>
        <span>分析模式：${escapeHtml(model.analysisModeText)}</span>
      </div>
    </header>

    <section class="section">
      <h2 class="section-title">一、分析概况</h2>
      <div class="summary-cards">${summaryCardsHtml}</div>
      <p class="overview">${escapeHtml(model.overviewText)}</p>
    </section>

    ${riskSectionsHtml}
    ${noneSectionHtml}

    <section class="section footer-note">
      <h2 class="section-title">报告说明</h2>
      <p class="note">本报告由招投标分析系统自动生成，仅供审计核查参考。高风险及中风险事项建议结合原始文件与证据材料进一步核实；最终结论以人工复核为准。</p>
      <p class="export-info">导出时间：${escapeHtml(generatedAt)}</p>
    </section>
  </div>
</body>
</html>`
}

export function sanitizeReportFilename(name) {
  return String(name || '招投标分析报告')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function downloadReportHtml(html, filename) {
  const blob = new Blob(['\ufeff', html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.html') ? filename : `${filename}.html`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
