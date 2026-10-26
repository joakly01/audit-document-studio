import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getTaskSchedulesAPI,
  getContractReportBySourceAPI,
  generateContractReportAPI,
  downloadContractReportAPI,
  refreshContractReportUrlsAPI
} from '@/api/task.js'

const REPORT_POLL_MS = 2000

function parseUtcExpiryMs(exp) {
  const s = String(exp || '').trim()
  if (!s) return null
  try {
    const iso = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)
      ? s.replace('Z', '+00:00')
      : `${s}+00:00`
    const t = new Date(iso).getTime()
    return Number.isNaN(t) ? null : t
  } catch {
    return null
  }
}

function isReportLinkValid(reportFile) {
  if (!reportFile?.download_url) return false
  const exp = reportFile.presigned_expires_at
  if (!exp) return true
  const t = parseUtcExpiryMs(exp)
  if (t == null) return true
  return t > Date.now()
}

function hasReportFileContent(reportFile) {
  if (!reportFile || typeof reportFile !== 'object') return false
  return !!(
    reportFile.object_name ||
    reportFile.filename ||
    reportFile.download_url
  )
}

function taskResultRows(taskData) {
  const list = taskData?.task_schedule_result_list
  return Array.isArray(list) ? list : []
}

function canGenerateReportFromTaskData(taskData) {
  if (!taskData) return false
  const rows = taskResultRows(taskData)
  if (!rows.length) return false
  const hasRunning = rows.some((r) => {
    const st = Number(r.processing_status ?? r.PROCESSING_STATUS ?? -1)
    return st === 0 || st === 1
  })
  if (hasRunning) return false
  return rows.some((r) => {
    const st = Number(r.processing_status ?? r.PROCESSING_STATUS ?? -1)
    return st === 2 && r.disposal_result
  })
}

/**
 * 合同分析任务级「生成报告」状态与交互（绑定源任务，不创建独立报告任务）
 */
export function useContractReport(options) {
  const getAnalysisTaskUuid = options.getAnalysisTaskUuid
  const getTaskData = options.getTaskData

  const persistedAnalysisTaskUuid = ref('')
  const reportTaskUuid = ref('')
  const reportFileMeta = ref(null)
  const reportStatus = ref('idle')
  const reportError = ref('')
  const reportGenerating = ref(false)
  const reportProgressVisible = ref(false)
  const reportProgressHint = ref('报告生成中…')
  const reportProgressError = ref('')

  let reportPollTimer = null
  let reportPollAbort = false
  /** 本轮是否由用户主动点击「生成报告」触发（用于轮询完成后是否自动下载） */
  let reportPollAutoDownload = false

  const effectiveAnalysisTaskUuid = computed(() => {
    return (
      persistedAnalysisTaskUuid.value ||
      getAnalysisTaskUuid?.() ||
      ''
    ).trim()
  })

  const canGenerateReport = computed(() => {
    if (!effectiveAnalysisTaskUuid.value) return false
    if (reportGenerating.value) return false
    return canGenerateReportFromTaskData(getTaskData?.())
  })

  const hasValidReport = computed(() => isReportLinkValid(reportFileMeta.value))

  const hasReportReady = computed(() => {
    return reportStatus.value === 'success' && hasReportFileContent(reportFileMeta.value)
  })

  const reportButtonLabel = computed(() => {
    if (reportGenerating.value || reportStatus.value === 'running') return '报告生成中…'
    if (hasReportReady.value) return '下载报告'
    if (reportStatus.value === 'failed') return '重新生成报告'
    return '生成报告'
  })

  const reportButtonDisabled = computed(() => {
    if (reportGenerating.value || reportStatus.value === 'running') return true
    if (hasReportReady.value) return false
    return !canGenerateReport.value
  })

  const stopReportPoll = () => {
    reportPollAbort = true
    reportPollAutoDownload = false
    if (reportPollTimer) {
      clearTimeout(reportPollTimer)
      reportPollTimer = null
    }
  }

  const downloadTaskId = () => {
    return String(
      effectiveAnalysisTaskUuid.value ||
      reportTaskUuid.value ||
      ''
    ).trim()
  }

  const triggerReportDownload = async (taskUuid, filename) => {
    const id = String(taskUuid || downloadTaskId()).trim()
    if (!id) return
    try {
      const response = await downloadContractReportAPI(id)
      const blob =
        response && response.data !== undefined ? response.data : response
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('未返回有效报告文件')
      }
      const name = filename || reportFileMeta.value?.filename || '合同分析报告.docx'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', name)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      ElMessage.error(e?.message || '报告下载失败')
      throw e
    }
  }

  const applyReportLookup = (data, { restartPollIfRunning = false } = {}) => {
    if (!data) {
      reportTaskUuid.value = ''
      reportFileMeta.value = null
      reportStatus.value = 'idle'
      reportError.value = ''
      return
    }
    reportTaskUuid.value = data.report_task_uuid || ''
    reportFileMeta.value = data.report_file || null
    reportStatus.value = String(data.status || 'idle')
    reportError.value = String(data.error || '').trim()

    if (reportStatus.value === 'running') {
      reportGenerating.value = true
      if (restartPollIfRunning) {
        reportProgressVisible.value = true
        reportProgressError.value = ''
        reportProgressHint.value = '报告生成中…'
        pollReportBySource({ autoDownloadOnSuccess: false })
      }
      return
    }

    reportGenerating.value = false
    if (reportStatus.value === 'failed') {
      reportProgressError.value = reportError.value || '报告生成失败'
      reportProgressHint.value = reportProgressError.value
    }
  }

  const refreshReportBySource = async () => {
    const src = effectiveAnalysisTaskUuid.value
    if (!src) {
      applyReportLookup(null)
      return
    }
    try {
      const res = await getContractReportBySourceAPI(src)
      if (res.code === 200 && res.data) {
        applyReportLookup(res.data, { restartPollIfRunning: true })
      }
    } catch (e) {
      console.warn('查询报告状态失败', e)
    }
  }

  const setAnalysisTaskUuid = (uuid) => {
    const id = String(uuid || '').trim()
    if (id) persistedAnalysisTaskUuid.value = id
  }

  const setAnalysisContext = async ({ taskUuid, taskData: td } = {}) => {
    if (taskUuid) setAnalysisTaskUuid(taskUuid)
    if (td && options.setTaskData) {
      options.setTaskData(td)
    }
    await refreshReportBySource()
  }

  const pollReportBySource = ({ autoDownloadOnSuccess = false } = {}) => {
    stopReportPoll()
    reportPollAbort = false
    reportPollAutoDownload = autoDownloadOnSuccess
    const src = effectiveAnalysisTaskUuid.value
    if (!src) return

    const tick = async () => {
      if (reportPollAbort) return
      try {
        const res = await getContractReportBySourceAPI(src)
        if (reportPollAbort) return
        if (res.code !== 200 || !res.data) {
          reportPollTimer = setTimeout(tick, REPORT_POLL_MS)
          return
        }
        const data = res.data
        applyReportLookup(data)

        if (data.status === 'failed') {
          reportGenerating.value = false
          reportProgressError.value = data.error || '报告生成失败'
          reportProgressHint.value = reportProgressError.value
          reportPollAutoDownload = false
          return
        }

        if (data.status === 'success' && data.report_file) {
          reportGenerating.value = false
          reportProgressVisible.value = false
          reportProgressError.value = ''
          const shouldAutoDownload = reportPollAutoDownload
          reportPollAutoDownload = false
          if (shouldAutoDownload) {
            try {
              await triggerReportDownload(src, data.report_file?.filename)
              ElMessage.success('报告已生成并开始下载')
            } catch {
              /* 已在 triggerReportDownload 提示 */
            }
          }
          return
        }

        if (data.status === 'running') {
          reportProgressHint.value = '报告生成中…'
          reportPollTimer = setTimeout(tick, REPORT_POLL_MS)
          return
        }

        reportPollTimer = setTimeout(tick, REPORT_POLL_MS)
      } catch (e) {
        if (reportPollAbort) return
        console.error('轮询报告状态失败', e)
        reportPollTimer = setTimeout(tick, REPORT_POLL_MS)
      }
    }

    reportPollTimer = setTimeout(tick, REPORT_POLL_MS)
  }

  const handleReportButtonClick = async () => {
    if (hasReportReady.value) {
      try {
        const id = downloadTaskId()
        if (!isReportLinkValid(reportFileMeta.value) && id) {
          await refreshContractReportUrlsAPI(id)
          await refreshReportBySource()
        }
        await triggerReportDownload()
      } catch {
        ElMessage.warning('报告下载失败，请稍后重试')
      }
      return
    }

    const analysisUuid = effectiveAnalysisTaskUuid.value
    if (!analysisUuid) {
      ElMessage.warning('未找到合同分析任务，请先完成分析')
      return
    }

    try {
      const detailRes = await getTaskSchedulesAPI(analysisUuid, {
        include_results: true
      })
      if (detailRes.code !== 200 || !detailRes.data) {
        ElMessage.error(detailRes.message || '无法读取分析任务')
        return
      }
      if (!canGenerateReportFromTaskData(detailRes.data)) {
        ElMessage.warning('分析任务尚未就绪，请待处理完成后再生成报告')
        return
      }

      reportGenerating.value = true
      reportProgressVisible.value = true
      reportProgressError.value = ''
      reportProgressHint.value = '报告生成中…'

      const genRes = await generateContractReportAPI(analysisUuid)
      if (genRes.code !== 200 && genRes.code !== 201) {
        reportGenerating.value = false
        reportProgressVisible.value = false
        ElMessage.error(genRes.message || '启动报告生成失败')
        return
      }

      reportStatus.value = 'running'
      pollReportBySource({ autoDownloadOnSuccess: true })
    } catch (e) {
      reportGenerating.value = false
      reportProgressVisible.value = false
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        '生成报告失败'
      ElMessage.error(msg)
    }
  }

  const disposeReport = () => {
    stopReportPoll()
  }

  return {
    persistedAnalysisTaskUuid,
    reportTaskUuid,
    reportFileMeta,
    reportGenerating,
    reportProgressVisible,
    reportProgressHint,
    reportProgressError,
    effectiveAnalysisTaskUuid,
    canGenerateReport,
    hasValidReport,
    hasReportReady,
    reportButtonLabel,
    reportButtonDisabled,
    setAnalysisTaskUuid,
    setAnalysisContext,
    refreshReportBySource,
    handleReportButtonClick,
    stopReportPoll,
    disposeReport
  }
}
