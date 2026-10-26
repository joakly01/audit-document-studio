/**
 * 任务中心列表「文件处理进度」列：根据行数据构造展示上下文（阶段标题、整体进度等）。
 * 与后端 task_step_progress（任务级步骤）及文件聚合计数配合使用。
 */

const STEP_KEY_LABELS = {
  create: '创建任务',
  dispatch: '入队分发',
  cluster: '议题聚类',
  risk_analysis: '风险分析',
  detect_sync: '检测分析',
  dify_extract: '智能提取',
  parse_result: '结果解析',
  prepare_files: '文件准备',
  file_parse: '文件解析',
  file_prepare: '文件清单确认',
  bidding_rule_run: '招标规则分析',
  tender_rule_run: '投标规则分析',
  joint_rule_run: '联合规则分析',
  build_result: '构建结果',
  complete: '完成',
  analyze_root: '分析执行',
  prepare_inputs: '准备与上传',
  prepare_inputs_extract: '准备与上传（信息提取）',
  prepare_topic_inputs: '准备与上传（主题归纳）',
  execute_root: '文件处理',
  invoke_agent: '工作流执行',
  invoke_info_extraction: '信息提取',
  invoke_topic_summary: '主题归纳',
  finalize: '结果写入',
  extract: '文本提取',
  extract_billing: '提取计费约定',
  await_user_input: '等待填写计费基数',
  calculate_expense: '费用计算',
  extract_billing_file: '提取计费约定',
  calculate_expense_file: '费用计算',
  parse: 'LLM解析',
  langgraph_run: 'Dify 执行',
  format: '格式化结果',
  process: '文件处理',
  extract_theme: '信息提取',
  topic_summary: '主题归纳'
}

/** 规范 step_key（兼容大小写、空格写法） */
function normalizeStepKey(stepKey) {
  if (stepKey == null || stepKey === '') return ''
  return String(stepKey).trim().toLowerCase().replace(/\s+/g, '_')
}

/** 从步骤行对象解析 step_key（兼容 step_key / key / STEP_KEY） */
function resolveStepKey(step) {
  if (!step || typeof step !== 'object') return ''
  return normalizeStepKey(step.step_key || step.key || step.STEP_KEY || '')
}

/** 是否为未翻译的英文 step 标识（如 risk_analysis、risk analysis） */
function isLikelyRawStepKey(text) {
  const s = String(text || '').trim()
  if (!s) return true
  if (/[\u4e00-\u9fff]/.test(s)) return false
  return /^[a-z0-9_\s-]+$/i.test(s)
}

function labelForStepKey(stepKey) {
  const normalized = normalizeStepKey(stepKey)
  if (!normalized) return ''
  if (STEP_KEY_LABELS[normalized]) return STEP_KEY_LABELS[normalized]
  console.warn('[taskListProgressContext] 未配置 step_key 翻译:', stepKey)
  return `[${String(stepKey).trim()}]`
}

/**
 * 步骤展示名：优先后端中文 step_name，否则按 step_key 映射为中文。
 * @param {{ step_key?: string, key?: string, step_name?: string, name?: string }} step
 */
function resolveStepLabel(step) {
  if (!step || typeof step !== 'object') return '整体进度'
  const name = String(step.step_name || step.name || '').trim()
  if (name && !isLikelyRawStepKey(name)) return name
  const fromKey = labelForStepKey(resolveStepKey(step) || name)
  if (fromKey && !fromKey.startsWith('[')) return fromKey
  return fromKey || '整体进度'
}

/** 供进度树等组件复用：将节点 name/key 转为中文展示 */
export function formatStepDisplayName(nameOrKey, fallbackKey) {
  const name = String(nameOrKey || '').trim()
  const key = resolveStepKey({ step_key: fallbackKey, key: fallbackKey }) || normalizeStepKey(name)
  if (name && !isLikelyRawStepKey(name)) return name
  const labeled = labelForStepKey(key || name)
  if (labeled && !labeled.startsWith('[')) return labeled
  return name || labeled || '步骤'
}

/** 与后端 get_task_tree 挂文件规则对齐：仅这些 step_key 在对应 biz 下展示文件类进度 */
const TASK_STEP_KEYS_MOUNTING_FILES = {
  contractCompleteness: new Set(['analyze_root']),
  wordCloud: new Set(['analyze_root']),
  riskPointAnalysis: new Set(['analyze_root']),
  prepaidExpenses: new Set(['calculate_expense']),
  meeting_minutes: new Set(['cluster']),
  timeline_analysis: new Set(['file_parse']),
  biddingAnalysis: new Set(['file_prepare']),
  fileToPdf: new Set(['execute_root']),
  agent_info_extraction: new Set(['execute_root']),
  biz_topic_summary: new Set(['execute_root']),
  agent_info_extraction_and_topic_summary: new Set(['execute_root'])
}

const GENERIC_FILE_STEP_KEYS = new Set(['execute_root', 'analyze_root', 'cluster', 'build_result'])

/**
 * @param {string} bizType
 * @param {string} [stepKey]
 */
function stepKeyMountsFiles(bizType, stepKey) {
  const key = String(stepKey || '')
  const set = TASK_STEP_KEYS_MOUNTING_FILES[bizType]
  if (set) return set.has(key)
  return GENERIC_FILE_STEP_KEYS.has(key)
}

/**
 * @param {Array<{ step_order?: number, status?: number }>} steps
 */
function sortSteps(steps) {
  return [...steps].sort((a, b) => Number(a.step_order || 0) - Number(b.step_order || 0))
}

/**
 * 当前聚焦的任务级步骤：优先进行中，其次未开始，再次失败，最后取末步。
 */
function pickCurrentTaskStep(stepsSorted) {
  if (!stepsSorted.length) return null
  const running = stepsSorted.find((s) => Number(s.status) === 1)
  if (running) return running
  const pending = stepsSorted.find((s) => Number(s.status) === 0)
  if (pending) return pending
  const failed = stepsSorted.find((s) => Number(s.status) === 3)
  if (failed) return failed
  return stepsSorted[stepsSorted.length - 1]
}

function isTaskRowTerminated(row) {
  return Boolean(row.is_terminated || row.status === 'terminated')
}

function isTaskRowTerminal(row) {
  if (isTaskRowTerminated(row)) return true
  const taskStatus = Number(row.task_status)
  if (taskStatus === 2 || taskStatus === 3) return true
  if (row.status === 'completed' || row.status === 'failed') return true
  return false
}

/** 步骤是否仍算「进行中」（已终止/失败等终态下，步骤 status=1 多为未回写，不应再转圈） */
function isStepActivelyRunning(row, stepStatus) {
  if (Number(stepStatus) !== 1) return false
  if (isTaskRowTerminal(row) && areFilesQuiescent(row)) return false
  return true
}

function areFilesQuiescent(row) {
  const processing = Number(row.file_processing_count) || 0
  const pending = Number(row.file_pending_count) || 0
  return processing === 0 && pending === 0
}

function computeOverallProgressPercent(row, stepsSorted) {
  const bizType = String(row.biz_type || '')
  const prepaidPhase = String(row.prepaid_phase || '')

  if (bizType === 'biddingAnalysis') {
    const ruleTotal = Number(row.rule_total) || 0
    const ruleDone = Number(row.rule_done) || 0
    if (Number(row.task_status) === 2 || String(row.ba_status || '') === 'SUCCESS') {
      return 100
    }
    if (Number(row.task_status) === 3 || String(row.ba_status || '') === 'FAILED') {
      return ruleTotal > 0 ? Math.min(100, Math.round((ruleDone / ruleTotal) * 100)) : 0
    }
    if (ruleTotal > 0) {
      return Math.min(99, Math.max(1, Math.round((ruleDone / ruleTotal) * 100)))
    }
    return 0
  }

  if (bizType === 'prepaidExpenses') {
    if (prepaidPhase === 'pending_extract' || prepaidPhase === 'awaiting_billing_base') {
      return 0
    }
    if (prepaidPhase === 'completed' || Number(row.task_status) === 2) {
      return 100
    }
    if (prepaidPhase === 'calculating') {
      const calcStep = stepsSorted.find((s) => s.step_key === 'calculate_expense')
      const fp = Math.max(0, Math.min(100, Number(row.file_progress_percent) || 0))
      if (calcStep && Number(calcStep.status) === 1) {
        return Math.max(1, Math.min(99, fp || 1))
      }
      if (fp > 0 && fp < 100) {
        return Math.max(1, Math.min(99, fp))
      }
      return fp >= 100 ? 100 : 1
    }
    if (Number(row.task_status) === 3) {
      return Math.max(0, Math.min(100, Number(row.file_progress_percent) || 0))
    }
    return 0
  }

  const fp = Math.max(0, Math.min(100, Number(row.file_progress_percent) || 0))
  const n = stepsSorted.length
  if (!n) return fp

  const completed = stepsSorted.filter((s) => Number(s.status) === 2).length
  const failedSteps = stepsSorted.filter((s) => Number(s.status) === 3).length
  const hasRunning = stepsSorted.some((s) => Number(s.status) === 1)
  const hasFailed = failedSteps > 0
  const filesTerminal = areFilesQuiescent(row)
  const taskTerminal = isTaskRowTerminal(row)

  // 词云等：文件已全部成功但任务级步骤/主状态滞后时，整体进度与文件对齐
  if (
    (row.biz_type === 'wordCloud'
      || row.biz_type === 'riskPointAnalysis'
      || row.biz_type === 'contractCompleteness') &&
    filesTerminal &&
    fp >= 100 &&
    Number(row.file_failed_count) === 0 &&
    Number(row.file_total_count) > 0 &&
    !hasFailed &&
    !taskTerminal
  ) {
    return 100
  }

  if (taskTerminal && filesTerminal) {
    const runningSteps = stepsSorted.filter((s) => Number(s.status) === 1).length
    const endedCount = completed + failedSteps + (taskTerminal ? runningSteps : 0)
    const bySteps = Math.round((endedCount / n) * 100)
    return Math.min(100, Math.max(bySteps, fp))
  }

  if (hasFailed && !hasRunning && filesTerminal) {
    return Math.min(100, Math.max(Math.round(((completed + failedSteps) / n) * 100), fp))
  }

  if (hasFailed) {
    return Math.min(100, Math.round((completed / n) * 100))
  }
  if (!hasRunning && completed >= n) {
    return 100
  }
  if (hasRunning) {
    return Math.min(100, Math.round(((completed + fp / 100) / n) * 100))
  }
  return Math.min(100, Math.round((completed / n) * 100))
}

/**
 * @param {Record<string, any>} row
 * @param {{ step_key?: string, status?: number } | null} current
 * @param {boolean} showFileBreakdown
 * @param {number} stageProgressPercent
 */
function stageEndedLooksFailed(row, fileFailed) {
  if (fileFailed > 0) return true
  if (row.status === 'failed') return true
  if (isTaskRowTerminated(row)) return true
  const taskStatus = Number(row.task_status)
  return taskStatus === 3 && row.status !== 'completed'
}

function resolveStageIconKind(row, current, showFileBreakdown, stageProgressPercent) {
  const fileProcessing = Number(row.file_processing_count) || 0
  const fileFailed = Number(row.file_failed_count) || 0
  const filesTerminal = areFilesQuiescent(row)
  const pct = Math.max(0, Math.min(100, Number(stageProgressPercent) || 0))
  const stepStatus = current ? Number(current.status) : null
  const stageAtFullPct = pct >= 100

  if (fileProcessing > 0) {
    return 'running'
  }

  if (showFileBreakdown && filesTerminal && stageAtFullPct) {
    return stageEndedLooksFailed(row, fileFailed) ? 'failed' : 'success'
  }

  if (!current) {
    if (filesTerminal && stageAtFullPct) {
      return stageEndedLooksFailed(row, fileFailed) ? 'failed' : 'success'
    }
    return 'running'
  }

  if (Number(stepStatus) === 3) {
    return 'failed'
  }

  if (Number(stepStatus) === 2) {
    return 'success'
  }

  if (isStepActivelyRunning(row, stepStatus)) {
    return 'running'
  }

  if (filesTerminal && stageAtFullPct) {
    return stageEndedLooksFailed(row, fileFailed) ? 'failed' : 'success'
  }

  return 'running'
}

const EMPTY_PROGRESS_CONTEXT = {
  stageTitle: '整体进度',
  currentStageCompleted: false,
  stageIconKind: 'running',
  showFileBreakdown: false,
  overallProgressPercent: 0,
  stageProgressPercent: 0,
  file_progress_percent: 0,
  file_completed_count: 0,
  file_total_count: 0,
  file_success_count: 0,
  file_processing_count: 0,
  file_failed_count: 0,
  file_pending_count: 0
}

/**
 * @param {Record<string, any>} row transformTaskRowToListItem 之后的行
 */
export function buildTaskListProgressContext(row) {
  if (!row || typeof row !== 'object') {
    return { ...EMPTY_PROGRESS_CONTEXT }
  }

  const fileTotal = Number(row.file_total_count) || 0
  const stepsRaw = Array.isArray(row.task_step_progress) ? row.task_step_progress : []
  const stepsSorted = sortSteps(stepsRaw)
  const current = pickCurrentTaskStep(stepsSorted)
  const currentStepKey = current ? resolveStepKey(current) : ''

  const stageTitle = (() => {
    if (String(row.biz_type || '') === 'biddingAnalysis') {
      const ruleTotal = Number(row.rule_total) || 0
      const ruleDone = Number(row.rule_done) || 0
      const baStatus = String(row.ba_status || '')
      const taskStatus = Number(row.task_status)
      if (taskStatus === 2 || baStatus === 'SUCCESS') {
        return ruleTotal > 0 ? `完成 (${ruleDone}/${ruleTotal})` : '完成'
      }
      if (taskStatus === 3 || baStatus === 'FAILED') {
        return ruleTotal > 0 ? `失败 (${ruleDone}/${ruleTotal})` : '失败'
      }
      if (ruleTotal > 0) {
        return `规则分析中 (${ruleDone}/${ruleTotal})`
      }
      return '规则分析中'
    }
    if (String(row.biz_type || '') === 'prepaidExpenses') {
      const phase = String(row.prepaid_phase || '')
      if (phase === 'awaiting_billing_base') return '等待填写计费基数'
      if (phase === 'calculating') return '费用计算中'
      if (phase === 'pending_extract') return '提取计费约定'
    }
    return current ? resolveStepLabel(current) : '整体进度'
  })()

  /** 无步骤数据时沿用旧行为：有文件则展示文件区（无法判定当前阶段） */
  const mountsFiles = current
    ? stepKeyMountsFiles(String(row.biz_type || ''), currentStepKey)
    : fileTotal > 0
  const showFileBreakdown = Boolean(mountsFiles && fileTotal > 0)

  const rowFilePct = Math.max(0, Math.min(100, Number(row.file_progress_percent) || 0))
  const stepStatusCompleted = current ? Number(current.status) === 2 : false
  let stageProgressPercent = 0
  if (stepStatusCompleted) {
    stageProgressPercent = 100
  } else if (showFileBreakdown) {
    stageProgressPercent = rowFilePct
  } else {
    stageProgressPercent = 0
  }

  let stageIconKind = resolveStageIconKind(row, current, showFileBreakdown, stageProgressPercent)

  // 招投标：进度/图标与 ba_status、task_status 对齐（不依赖文件区步骤）
  if (String(row.biz_type || '') === 'biddingAnalysis') {
    const baStatus = String(row.ba_status || '')
    const taskStatus = Number(row.task_status)
    const ruleTotal = Number(row.rule_total) || 0
    const ruleDone = Number(row.rule_done) || 0
    if (taskStatus === 2 || baStatus === 'SUCCESS') {
      stageProgressPercent = 100
      stageIconKind = 'success'
    } else if (taskStatus === 3 || baStatus === 'FAILED') {
      stageProgressPercent = ruleTotal > 0
        ? Math.min(100, Math.round((ruleDone / ruleTotal) * 100))
        : 0
      stageIconKind = 'failed'
    } else if (ruleTotal > 0) {
      stageProgressPercent = Math.min(99, Math.max(1, Math.round((ruleDone / ruleTotal) * 100)))
      stageIconKind = 'running'
    }
  }

  const currentStageCompleted = stageIconKind === 'success'
  const overallProgressPercent = computeOverallProgressPercent(row, stepsSorted)

  return {
    stageTitle,
    currentStageCompleted,
    stageIconKind,
    showFileBreakdown,
    overallProgressPercent,
    stageProgressPercent,
    file_progress_percent: rowFilePct,
    file_completed_count: Number(row.file_completed_count) || 0,
    file_total_count: fileTotal,
    file_success_count: Number(row.file_success_count) || 0,
    file_processing_count: Number(row.file_processing_count) || 0,
    file_failed_count: Number(row.file_failed_count) || 0,
    file_pending_count: Number(row.file_pending_count) || 0
  }
}
