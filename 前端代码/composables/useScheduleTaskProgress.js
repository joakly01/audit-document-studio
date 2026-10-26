import { getTaskSchedulesAPI } from '@/api/task.js'
import {
  attachSelectionTreeToRuntimeNodes,
  normalizeSelectionSummary
} from '@/views/ocr-task-center/taskCenterSelectionTreeUtils.js'

/** 与 ThemeAnalysisViewer / ContractViewer 一致的任务调度轮询与步骤树解析 */

export const SCHEDULE_TASK_POLL_MS = 2000
export const SCHEDULE_TASK_MAX_WAIT_MS = 45 * 60 * 1000

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 优先 task_status，其次以各文件 processing_status 为准（任务聚合可能滞后仍为「未开始」）
 * @param {string} taskUuid
 * @param {{ onProgress?: (detail: object) => void, pollMs?: number, maxWaitMs?: number, verbosePollLog?: boolean, signal?: AbortSignal, prefer_runtime?: boolean, include_step_tree?: boolean, include_task_steps?: boolean }} [options]
 */
export async function pollScheduleTaskUntilTerminal(taskUuid, options = {}) {
  const {
    onProgress,
    pollMs = SCHEDULE_TASK_POLL_MS,
    maxWaitMs = SCHEDULE_TASK_MAX_WAIT_MS,
    verbosePollLog = false,
    shouldAbort,
    signal,
    prefer_runtime = true,
    include_step_tree = false,
    include_task_steps = false
  } = options
  const pollQuery = {
    prefer_runtime,
    include_step_tree,
    include_task_steps,
  }
  const start = Date.now()
  let tick = 0
  while (Date.now() - start < maxWaitMs) {
    if (signal?.aborted) {
      return { ok: false, aborted: true }
    }
    if (typeof shouldAbort === 'function' && shouldAbort()) {
      return { ok: false, aborted: true }
    }
    tick += 1
    const pollAt = Date.now()
    let res
    try {
      res = await getTaskSchedulesAPI(taskUuid, { ...pollQuery, signal })
    } catch (e) {
      /** 与 HTTP 非 200 区分：仅网络/代码异常时重试，避免单次抖动误判终态 */
      if (verbosePollLog) {
        console.warn('[scheduleTaskProgress] 轮询请求异常', {
          taskUuid,
          tick,
          error: e?.message || String(e)
        })
      }
      if (signal?.aborted) {
        return { ok: false, aborted: true }
      }
      if (typeof shouldAbort === 'function' && shouldAbort()) {
        return { ok: false, aborted: true }
      }
      await sleep(pollMs)
      if (signal?.aborted) {
        return { ok: false, aborted: true }
      }
      continue
    }
    if (signal?.aborted) {
      return { ok: false, aborted: true }
    }
    const pollElapsed = Date.now() - pollAt
    const totalElapsed = Date.now() - start
    if (res.code === 200 && res.data) {
      const td = res.data
      const list = td.task_schedule_result_list || []
      const statuses = list.map((r) =>
        Number(r.processing_status ?? r.PROCESSING_STATUS ?? -1)
      )
      if (verbosePollLog) {
        const fileBrief = list.map((r) => ({
          id: (r.result_uuid || r.RESULT_UUID || '').slice(0, 8),
          ps: Number(r.processing_status ?? r.PROCESSING_STATUS ?? -1)
        }))
        // 排查「界面一直转圈」：对照后端 task_status / 各文件 processing_status / 单次查询耗时
        console.info('[scheduleTaskProgress]', {
          taskUuid,
          tick,
          pollMs,
          totalElapsedMs: totalElapsed,
          getTaskSchedulesMs: pollElapsed,
          task_status: td.task_status,
          fileCount: list.length,
          fileStatuses: statuses,
          fileBrief,
          runtimeNodeCount: Array.isArray(td.runtime_nodes) ? td.runtime_nodes.length : 0,
          stepTreeCount: Array.isArray(td.step_tree) ? td.step_tree.length : 0
        })
      }
      if (typeof onProgress === 'function') {
        onProgress(td)
      }
      const st = Number(td.task_status)
      if (st === 2) return { ok: true, status: st, detail: td }
      if (st === 3) return { ok: false, status: st, detail: td }

      if (list.length > 0) {
        if (statuses.some((s) => s === 3)) {
          return { ok: false, status: 3, detail: td }
        }
        if (statuses.every((s) => s === 2)) {
          return { ok: true, status: 2, detail: td }
        }
      }
    } else if (verbosePollLog) {
      console.warn('[scheduleTaskProgress] 轮询非 200 或无 data', {
        taskUuid,
        tick,
        totalElapsedMs: totalElapsed,
        code: res?.code,
        message: res?.message
      })
    }
    if (signal?.aborted) {
      return { ok: false, aborted: true }
    }
    if (typeof shouldAbort === 'function' && shouldAbort()) {
      return { ok: false, aborted: true }
    }
    await sleep(pollMs)
    if (signal?.aborted) {
      return { ok: false, aborted: true }
    }
  }
  if (verbosePollLog) {
    console.warn('[scheduleTaskProgress] 轮询超时', {
      taskUuid,
      tick,
      maxWaitMs,
      elapsedMs: Date.now() - start
    })
  }
  return { ok: false, timeout: true }
}

function _nodesAllTaskStepsPending(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) return false
  const groups = nodes.filter((n) => n?.node_type === 'task_group')
  if (!groups.length) return false
  return groups.every((n) => Number(n?.status ?? 0) === 0)
}

export function getRuntimeNodesFromDetail(td) {
  const runtime =
    Array.isArray(td?.runtime_nodes) && td.runtime_nodes.length ? td.runtime_nodes : null
  const stepTree =
    Array.isArray(td?.step_tree) && td.step_tree.length ? td.step_tree : null
  const taskRunning = Number(td?.task_status) === 1
  const fileRunning = (td?.task_schedule_result_list || []).some(
    (r) => Number(r.processing_status ?? r.PROCESSING_STATUS) === 1,
  )
  const fileDone = (td?.task_schedule_result_list || []).some(
    (r) => Number(r.processing_status ?? r.PROCESSING_STATUS) === 2,
  )

  if (runtime && stepTree && _nodesAllTaskStepsPending(runtime) && (taskRunning || fileRunning || fileDone)) {
    return stepTree
  }
  if (runtime) {
    return runtime
  }
  if (stepTree) {
    return stepTree
  }
  return []
}

/** 步骤树节点合并错误信息供 TaskRuntimeProgressTree 展示 */
export function mergeRuntimeNodesWithErrors(detail, nodes) {
  const bizType = String(detail?.biz_type || detail?.BIZ_TYPE || '')
  const taskStepProgress = Array.isArray(detail?.task_step_progress)
    ? detail.task_step_progress
    : []
  const taskStepByKey = new Map(
    taskStepProgress.map((s) => [s.step_key || s.key, s])
  )

  const resultList = Array.isArray(detail?.task_schedule_result_list)
    ? detail.task_schedule_result_list
    : []
  const resultByUuid = new Map(
    resultList.map((r) => [r.result_uuid || r.RESULT_UUID || r.id, r])
  )
  const resultByFileId = new Map()
  for (const r of resultList) {
    const fid = r.file_uuid ?? r.FILE_UUID
    if (fid != null && String(fid).trim()) {
      resultByFileId.set(String(fid).trim(), r)
    }
  }

  const resolveResultRowForFileNode = (node) => {
    const key = String(node?.key ?? node?.id ?? '').trim()
    if (!key) return null
    return resultByUuid.get(key) || resultByFileId.get(key) || null
  }

  const aggregateStatusFromChildren = (statuses) => {
    if (!statuses.length) return 0
    if (statuses.some((s) => s === 3)) return 3
    if (statuses.every((s) => s === 2)) return 2
    if (statuses.some((s) => s === 1)) return 1
    return 0
  }

  const collectFileItemStatuses = (nodes) => {
    const out = []
    if (!Array.isArray(nodes)) return out
    for (const n of nodes) {
      if (!n) continue
      if (n.node_type === 'file_item') {
        out.push(Number(n.status))
      } else if (Array.isArray(n.children) && n.children.length) {
        out.push(...collectFileItemStatuses(n.children))
      }
    }
    return out
  }

  const reaggregateParentsFromChildren = (node) => {
    if (!node || !Array.isArray(node.children) || !node.children.length) {
      return node
    }
    node.children = node.children.map(reaggregateParentsFromChildren)
    const childFileStatuses = []
    for (const c of node.children) {
      if (c?.node_type === 'file_item') {
        childFileStatuses.push(Number(c.status))
      } else if (Array.isArray(c.children) && c.children.length) {
        const nested = collectFileItemStatuses(c.children)
        if (nested.length) childFileStatuses.push(...nested)
      }
    }
    if (
      node.node_type === 'task_group' &&
      (node.key === 'analyze_root' ||
        node.key === 'cluster' ||
        node.key === 'theme_root' ||
        node.key === 'extract_root') &&
      childFileStatuses.length
    ) {
      node.status = aggregateStatusFromChildren(childFileStatuses)
      node.done_count = childFileStatuses.filter((s) => s === 2).length
      node.total_count = childFileStatuses.length
    }
    return node
  }

  const findFirstFailedError = (arr) => {
    if (!Array.isArray(arr)) return null
    for (const n of arr) {
      const err = n ? (n.error_message || n.ERROR_MESSAGE || null) : null
      if (Number(n.status) === 3 && err) return err
      const sub = findFirstFailedError(n && n.children)
      if (sub) return sub
    }
    return null
  }

  const applyNode = (node, parentStepKey = null) => {
    const merged = { ...node }
    const currentStepKey = merged.node_type === 'task_group'
      ? (merged.key || merged.step_key)
      : parentStepKey
    merged.children = Array.isArray(merged.children)
      ? merged.children.map((child) => applyNode(child, currentStepKey))
      : []

    const nodeStatus = Number(merged.status)

    if (merged && merged.node_type === 'task_group') {
      const stepKey = merged.key || merged.step_key
      const step = taskStepByKey.get(stepKey)
      let err = step ? (step.error_message || step.ERROR_MESSAGE || null) : null

      if (nodeStatus === 3 && !err) {
        err = findFirstFailedError(merged.children)
      }
      if (nodeStatus === 3) merged.error_message = err
      const fileSts = collectFileItemStatuses(merged.children)
      const anyDone = fileSts.some((s) => s === 2)
      const anyRealFail = fileSts.some((s) => s === 3)
      if (
        nodeStatus === 3 &&
        !err &&
        fileSts.length > 0 &&
        !anyRealFail &&
        !anyDone
      ) {
        merged.status = 0
        merged.error_message = null
      }
    } else if (merged && merged.node_type === 'file_item') {
      const skipProcessingStatusSync =
        bizType === 'prepaidExpenses' && parentStepKey === 'extract_billing'
      const res = resolveResultRowForFileNode(merged)
      if (res) {
        const ps = Number(res.processing_status ?? res.PROCESSING_STATUS)
        if (!skipProcessingStatusSync && !Number.isNaN(ps)) {
          if (ps === 2 || ps === 3) {
            merged.status = ps
          } else if (ps === 1) {
            merged.status = 1
          } else if ((ps === 0 || ps === 1) && nodeStatus === 3) {
            merged.status = ps
          }
        }
        let err = res.error_message || res.ERROR_MESSAGE || null
        if (!err) {
          const fps = Array.isArray(res.file_step_progress) ? res.file_step_progress : []
          const failedStep = fps.find((x) => Number(x.status) === 3)
          if (failedStep) {
            err = failedStep.error_message || failedStep.ERROR_MESSAGE || null
          }
        }
        if (!skipProcessingStatusSync && ps === 3) merged.error_message = err
      }
    }

    return merged
  }

  const mergedNodes = Array.isArray(nodes) ? nodes.map((n) => applyNode(n, null)) : []
  return mergedNodes.map(reaggregateParentsFromChildren)
}

/**
 * 合并运行态错误信息，并按 selection_summary 挂载文件夹树（任务中心 / 页内进度弹框共用）
 * @param {Object} detail 任务详情
 * @param {Array} [nodes] 运行态树；省略时从 detail 解析
 * @returns {Array} TaskRuntimeProgressTree 节点
 */
export function buildTaskRuntimeNodesDisplay(detail, nodes) {
  const rawNodes = nodes ?? getRuntimeNodesFromDetail(detail)
  const merged = mergeRuntimeNodesWithErrors(detail, rawNodes)
  return attachSelectionTreeToRuntimeNodes(merged, {
    task_uuid: detail?.task_uuid || detail?.TASK_UUID,
    biz_type: detail?.biz_type || detail?.BIZ_TYPE,
    task_type: detail?.task_type ?? detail?.TASK_TYPE,
    selection_summary: normalizeSelectionSummary(detail),
    task_schedule_result_list: detail?.task_schedule_result_list || []
  })
}

export function resolveCreateTaskUuid(response) {
  return response?.task_uuid || response?.data?.task_uuid || null
}

/**
 * 任务失败时的错误文案：优先取失败文件/任务步骤上的 error_message。
 * 不可使用 task_notes：该字段对应库表 TASK_NOTES，是用户填写的「任务备注」，不是系统失败原因。
 */
export function resolveScheduleTaskFailureMessage(td) {
  if (!td || typeof td !== 'object') return '任务处理失败'
  const list = Array.isArray(td.task_schedule_result_list) ? td.task_schedule_result_list : []
  for (const r of list) {
    const ps = Number(r.processing_status ?? r.PROCESSING_STATUS)
    if (ps === 3) {
      const em = r.error_message || r.ERROR_MESSAGE
      if (em != null && String(em).trim()) return String(em).trim()
    }
  }
  // 兜底：任意结果行上的 error_message（有的缓存未带 processing_status=3）
  for (const r of list) {
    const em = r.error_message || r.ERROR_MESSAGE
    if (em != null && String(em).trim()) return String(em).trim()
  }
  const steps = Array.isArray(td.task_step_progress) ? td.task_step_progress : []
  for (const s of steps) {
    const st = Number(s.status ?? s.STATUS)
    if (st === 3) {
      const em = s.error_message || s.ERROR_MESSAGE
      if (em != null && String(em).trim()) return String(em).trim()
    }
  }
  for (const s of steps) {
    const em = s.error_message || s.ERROR_MESSAGE
    if (em != null && String(em).trim()) return String(em).trim()
  }
  return '任务处理失败'
}
