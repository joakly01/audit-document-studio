/** 招投标分析 — API 结果映射为 UI 组件所需结构 */

function mapAiAnalysisItem(item, index) {
  if (!item || typeof item !== 'object') return null
  const keyEvidence = item.key_evidence || item.keyEvidence || []
  return {
    index: item.index ?? index + 1,
    title: item.title || '',
    riskLevel: item.risk_level || item.riskLevel || 'none',
    summary: item.summary || '',
    involvedUnits: item.involved_units || item.involvedUnits || [],
    judgmentBasis: item.judgment_basis || item.judgmentBasis || '',
    reasonableExplanation: item.reasonable_explanation || item.reasonableExplanation || '',
    inspectionItems: item.inspection_items || item.inspectionItems || [],
    keyEvidence: Array.isArray(keyEvidence)
      ? keyEvidence.map((ev) => ({
          unit: ev?.unit || '',
          detail: ev?.detail || '',
          location: ev?.location || '',
        }))
      : [],
  }
}

function mapEvidenceList(evidence) {
  if (!Array.isArray(evidence)) return []
  return evidence
    .filter((ev) => ev && typeof ev === 'object')
    .map((ev) => ({
      unit: ev.unit || '',
      location: ev.location || '',
      detail: ev.detail || '',
    }))
}

export function mapApiRuleResult(row) {
  const detail = row.detail || {}
  const rawAiItems = detail.ai_analysis_items || row.aiAnalysisItems || []
  const aiItems = Array.isArray(rawAiItems)
    ? rawAiItems.map((item, index) => mapAiAnalysisItem(item, index)).filter(Boolean)
    : []
  const evidenceList = mapEvidenceList(
    Array.isArray(row.evidence) ? row.evidence : row.evidence?.items || []
  )
  const involvedRaw = row.involved_units || row.involvedUnits
  const involvedUnits = Array.isArray(involvedRaw) && involvedRaw.length ? involvedRaw : ['—']
  const firstAi = aiItems[0]
  const llmEvidenceRaw = row.llm_evidence || row.llmEvidence
  const llmEvidence =
    llmEvidenceRaw && (llmEvidenceRaw.cards || llmEvidenceRaw.groups)
      ? llmEvidenceRaw
      : row.evidence?.cards || row.evidence?.groups
        ? row.evidence
        : null

  return {
    id: row.result_id,
    status: row.status || 'SUCCESS',
    docType: row.doc_type,
    riskLevel: row.risk_level || 'none',
    categories: row.categories || [],
    confidence: row.confidence ?? 0,
    title: row.title || row.rule_name || '',
    description: row.description || '',
    ruleName: row.rule_name || '',
    involvedUnits,
    detailDescription: row.description || '',
    aiSummary: firstAi?.summary || row.description || '',
    aiRiskLevel: firstAi?.riskLevel || row.risk_level || 'none',
    aiAnalysisItems: aiItems,
    evidenceList,
    llmEvidence,
  }
}

export function mapApiProjectCard(project, analysis = {}) {
  const risk = project.risk_summary || project.riskSummary || {}
  const modes = analysis.analysis_modes || analysis.analysisModes || []
  return {
    id: project.project_id || project.id,
    projectId: project.project_id || project.id,
    name: project.project_name || project.name || `项目 ${project.sort_order || ''}`,
    status: project.status || 'completed',
    analysisMode: project.analysisMode || modes[0] || 'bidding_only',
    analyzedAt: analysis.completed_at || project.analyzedAt || '',
    biddingFileCount: project.biddingFileCount ?? (project.bidding_document_id ? 1 : 0),
    tenderCompanyCount: project.tenderCompanyCount ?? project.tender_company_count ?? 0,
    riskSummary: {
      high: risk.high || 0,
      medium: risk.medium || 0,
      low: risk.low || 0,
      none: risk.none || 0,
    },
    ruleResultCount: project.ruleResultCount ?? project.rule_result_count ?? 0,
  }
}

export function mapApiProjectForDetail(project, analysis = {}) {
  return {
    ...mapApiProjectCard(project, analysis),
    projectId: project.project_id || project.id,
  }
}
