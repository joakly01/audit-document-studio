/** 招投标分析进度弹框：按所选模式生成步骤，并映射任务中心 step 状态 */

export const MODE_TO_TASK_STEP_KEY = {
  bidding_only: 'bidding_rule_run',
  tender_only: 'tender_rule_run',
  joint_only: 'joint_rule_run',
}

const STEP_STATUS_UI = {
  0: 'pending',
  1: 'running',
  2: 'done',
  3: 'failed',
}

const STEP_TAG = {
  done: { tagType: 'success', tagText: '已完成' },
  running: { tagType: 'primary', tagText: '进行中' },
  pending: { tagType: 'info', tagText: '等待中' },
  failed: { tagType: 'danger', tagText: '失败' },
}

/**
 * 根据已选分析模式构建进度步骤（prepare → 各模式 → 汇总 → 完成）
 * @param {string[]} modes 已规范化模式列表
 * @param {(mode: string) => string} getModeLabel
 */
export function buildBiddingAnalysisProgressPlan(modes, getModeLabel) {
  const picked = Array.isArray(modes) ? modes.filter(Boolean) : []
  const plan = [
    {
      key: 'prepare',
      backendKey: 'file_prepare',
      label: '准备项目文件',
    },
  ]
  picked.forEach((mode) => {
    const backendKey = MODE_TO_TASK_STEP_KEY[mode]
    if (!backendKey) return
    plan.push({
      key: mode,
      backendKey,
      label: typeof getModeLabel === 'function' ? getModeLabel(mode) : mode,
    })
  })
  plan.push({
    key: 'build_result',
    backendKey: 'build_result',
    label: '汇总分析结果',
  })
  plan.push({
    key: 'complete',
    backendKey: 'complete',
    label: '完成',
  })
  return plan
}

function resolveStepKey(step) {
  if (!step || typeof step !== 'object') return ''
  return String(step.step_key || step.key || step.STEP_KEY || '').trim()
}

function backendStatusToUi(status) {
  return STEP_STATUS_UI[Number(status)] || 'pending'
}

function withTag(step, status) {
  const tag = STEP_TAG[status] || STEP_TAG.pending
  return {
    ...step,
    status,
    tagType: tag.tagType,
    tagText: tag.tagText,
  }
}

/**
 * 将任务中心 task_step_progress 映射为弹框展示步骤
 * @param {ReturnType<typeof buildBiddingAnalysisProgressPlan>} plan
 * @param {Array<{ step_key?: string, key?: string, status?: number }>} taskStepProgress
 */
export function mapBiddingProgressSteps(plan, taskStepProgress) {
  const steps = Array.isArray(plan) ? plan : []
  const byKey = new Map(
    (Array.isArray(taskStepProgress) ? taskStepProgress : []).map((row) => [
      resolveStepKey(row),
      row,
    ])
  )
  const hasBackendSteps = byKey.size > 0

  const mapped = steps.map((step) => {
    const row = byKey.get(step.backendKey)
    let status = 'pending'

    if (row) {
      status = backendStatusToUi(row.status)
    } else if (!hasBackendSteps && step.key === 'prepare') {
      status = 'running'
    }

    return withTag(step, status)
  })

  // 标题已按「首个等待」显示执行中时，行状态也应对齐：无 running 则把首个 pending 提成进行中
  const hasFailed = mapped.some((s) => s.status === 'failed')
  const allTerminal = mapped.every((s) => s.status === 'done' || s.status === 'failed')
  const hasRunning = mapped.some((s) => s.status === 'running')
  if (!hasFailed && !allTerminal && !hasRunning) {
    const idx = mapped.findIndex((s) => s.status === 'pending')
    if (idx >= 0) {
      mapped[idx] = withTag(mapped[idx], 'running')
    }
  }

  return mapped
}
