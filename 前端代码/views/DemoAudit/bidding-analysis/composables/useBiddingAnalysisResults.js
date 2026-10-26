import { ref } from 'vue'
import {
  getBiddingAnalysisAPI,
  getBiddingAnalysisProjectsAPI,
  getBiddingAnalysisResultOverviewAPI,
  getBiddingAnalysisRuleResultsAPI,
  unwrapBiddingApiData,
} from '@/api/biddingAnalysis.js'
import {
  mapApiProjectCard,
  mapApiRuleResult,
} from '../utils/biddingAnalysisResultMapper.js'

export function useBiddingAnalysisResults() {
  const loading = ref(false)
  const analysisDetail = ref(null)
  const projectCards = ref([])

  const loadOverview = async (analysisId) => {
    if (!analysisId) return null
    loading.value = true
    try {
      const res = await getBiddingAnalysisResultOverviewAPI(analysisId)
      const payload = unwrapBiddingApiData(res)
      analysisDetail.value = payload?.analysis || null
      projectCards.value = (payload?.projects || []).map((p) =>
        mapApiProjectCard(p, payload?.analysis)
      )
      return payload
    } catch {
      try {
        const [detailRes, projectsRes] = await Promise.all([
          getBiddingAnalysisAPI(analysisId),
          getBiddingAnalysisProjectsAPI(analysisId),
        ])
        const detail = unwrapBiddingApiData(detailRes)
        const projectsRaw = unwrapBiddingApiData(projectsRes)
        const projects = Array.isArray(projectsRaw) ? projectsRaw : []
        analysisDetail.value = detail
        projectCards.value = projects.map((p) => mapApiProjectCard(p, detail))
        return { analysis: detail, projects }
      } catch {
        analysisDetail.value = null
        projectCards.value = []
        return { analysis: null, projects: [] }
      }
    } finally {
      loading.value = false
    }
  }

  const loadRuleResults = async (analysisId, projectId) => {
    const res = await getBiddingAnalysisRuleResultsAPI(analysisId, projectId)
    const rows = unwrapBiddingApiData(res)
    const list = Array.isArray(rows) ? rows : []
    return list.map(mapApiRuleResult)
  }

  return {
    loading,
    analysisDetail,
    projectCards,
    loadOverview,
    loadRuleResults,
  }
}
