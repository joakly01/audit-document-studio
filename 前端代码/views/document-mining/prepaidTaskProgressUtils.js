/**
 * 待摊费用任务进度判定（文件管理 / 任务中心 poll 共用）
 */

export function parsePrepaidDisposal(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch (_e) {
    return { text_1: String(raw), billing_agreement_text: String(raw) }
  }
}

export function hasPrepaidExtractText(resultList) {
  return (resultList || []).some((item) => {
    const disposal = parsePrepaidDisposal(item?.disposal_result || item?.DISPOSAL_RESULT)
    return !!(disposal?.text_1 || disposal?.billing_agreement_text)
  })
}

export function extractCalculateResultText(disposal) {
  if (!disposal || disposal.phase !== 'calculate') return ''
  const direct = disposal.calculation_result_text
  if (direct != null && String(direct).trim()) return String(direct).trim()
  const raw = disposal.raw_dify
  if (!raw || typeof raw !== 'object') return ''
  for (const key of ['output', 'text_1', 'text_2']) {
    const val = raw[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
    if (Array.isArray(val)) {
      const joined = val.map((item) => String(item || '').trim()).filter(Boolean).join('\n')
      if (joined) return joined
    }
  }
  return ''
}

export function hasPrepaidCalculateResults(resultList) {
  return (resultList || []).some((item) => {
    const disposal = parsePrepaidDisposal(item?.disposal_result || item?.DISPOSAL_RESULT)
    if (!disposal || disposal.phase !== 'calculate') return false
    return !!extractCalculateResultText(disposal)
  })
}

export function resolveEffectivePrepaidPhase(phase, resultList) {
  const p = String(phase || '').trim()
  if (p === 'awaiting_billing_base' || p === 'calculating' || p === 'completed' || p === 'failed') {
    return p
  }
  if (hasPrepaidExtractText(resultList) && (p === 'pending_extract' || !p)) {
    return 'awaiting_billing_base'
  }
  return p || 'pending_extract'
}

export function isPrepaidTaskCompleted({ taskStatus, serverPrepaidPhase }) {
  const phase = String(serverPrepaidPhase || '').trim()
  return Number(taskStatus) === 2 || phase === 'completed'
}

export function isPrepaidTaskFailed({ taskStatus, fileStatuses }) {
  const statuses = fileStatuses || []
  return Number(taskStatus) === 3 || statuses.some((s) => Number(s) === 3)
}

export function isPrepaidPhase1ExtractReady({ serverPrepaidPhase, resultList }) {
  const phase = String(serverPrepaidPhase || '').trim()
  if (phase === 'awaiting_billing_base') return true
  if (phase === 'pending_extract' && hasPrepaidExtractText(resultList)) return true
  return false
}

export function shouldContinuePrepaidPhase2Poll(deferFinish, serverPrepaidPhase, taskStatus) {
  const phase = String(serverPrepaidPhase || '').trim()
  if (deferFinish) return true
  if (phase === 'calculating' && Number(taskStatus) !== 2 && phase !== 'completed') return true
  return false
}

/**
 * 纯函数：根据任务详情返回 poll 下一步动作
 * @returns {'fail'|'complete'|'complete_pending_results'|'continue'|'phase1_done'|'phase1_done_continue'|'keep_polling'}
 */
export function resolvePrepaidPollAction(ctx) {
  const {
    taskStatus,
    serverPrepaidPhase,
    resultList,
    deferFinish,
    prepaidProgressLastNotifiedPhase
  } = ctx || {}

  const fileStatuses = (resultList || []).map((r) =>
    Number(r.processing_status ?? r.PROCESSING_STATUS ?? -1)
  )

  if (isPrepaidTaskFailed({ taskStatus, fileStatuses })) {
    return { action: 'fail' }
  }

  if (isPrepaidTaskCompleted({ taskStatus, serverPrepaidPhase })) {
    if (hasPrepaidCalculateResults(resultList)) {
      return { action: 'complete' }
    }
    return { action: 'complete_pending_results' }
  }

  if (shouldContinuePrepaidPhase2Poll(deferFinish, serverPrepaidPhase, taskStatus)) {
    return { action: 'continue' }
  }

  if (isPrepaidPhase1ExtractReady({ serverPrepaidPhase, resultList })) {
    if (deferFinish) {
      return { action: 'phase1_done_continue' }
    }
    if (prepaidProgressLastNotifiedPhase !== 'awaiting_billing_base') {
      return { action: 'phase1_done', notifyPhase1: true }
    }
    return { action: 'phase1_done', notifyPhase1: false }
  }

  return { action: 'keep_polling' }
}

export function collectPrepaidCalculateTexts(resultList) {
  const calcTexts = []
  ;(resultList || []).forEach((item) => {
    const disposal = parsePrepaidDisposal(item.disposal_result || item.DISPOSAL_RESULT)
    if (!disposal || disposal.phase !== 'calculate') return
    const calcText = extractCalculateResultText(disposal)
    if (calcText) calcTexts.push(calcText)
  })
  return calcTexts.join('\n\n---\n\n')
}
