import { getDictItemsByCodeAPI } from '@/api/dict.js'
import { ElMessage } from 'element-plus'

/** 数据字典：批量创建任务超时阈值（毫秒） */
export const BATCH_EXECUTE_TIMEOUT_DICT_CODE = 'longtime-count'
export const BATCH_EXECUTE_TIMEOUT_ITEM_KEY = 'ITEM_001'
export const DEFAULT_BATCH_EXECUTE_TIMEOUT_MS = 5000

/**
 * 判断 BatchExecuteByFilter 是否因主动取消而失败
 * @param {Error} error 捕获的异常
 * @returns {boolean} 是否为取消错误
 */
export const isBatchExecuteRequestAborted = (error) => {
  if (!error) return false
  if (error.code === 'ERR_CANCELED' || error.name === 'AbortError' || error.name === 'CanceledError') {
    return true
  }
  return String(error.message || '').toLowerCase().includes('abort')
}

let batchExecuteTimeoutMs = DEFAULT_BATCH_EXECUTE_TIMEOUT_MS
let batchExecuteTimeoutLoaded = false
let batchExecuteTimeoutLoadingPromise = null

/**
 * 规范化字典接口返回的数据项列表
 * @param {Object} response 字典接口响应
 * @returns {Array<Object>} 字典项数组
 */
const normalizeDictItems = (response) => {
  const data = response && response.data
  if (Array.isArray(data)) {
    return data
  }
  if (data && Array.isArray(data.items)) {
    return data.items
  }
  return []
}

/**
 * 从数据字典加载「创建任务超时阈值（毫秒）」，默认 5000
 * @returns {Promise<number>} 毫秒阈值
 */
export const loadBatchExecuteTimeoutMsFromDict = async () => {
  if (batchExecuteTimeoutLoaded) {
    return batchExecuteTimeoutMs
  }
  if (batchExecuteTimeoutLoadingPromise) {
    await batchExecuteTimeoutLoadingPromise
    return batchExecuteTimeoutMs
  }
  batchExecuteTimeoutLoadingPromise = (async () => {
    try {
      const res = await getDictItemsByCodeAPI(BATCH_EXECUTE_TIMEOUT_DICT_CODE, { status: 1 })
      const items = normalizeDictItems(res)
      const targetItem = items.find((item) => (
        String(item?.key_code || item?.key || '') === BATCH_EXECUTE_TIMEOUT_ITEM_KEY
      )) || items[0]
      const parsed = Number(targetItem?.value)
      if (Number.isFinite(parsed) && parsed > 0) {
        batchExecuteTimeoutMs = parsed
      } else {
        batchExecuteTimeoutMs = DEFAULT_BATCH_EXECUTE_TIMEOUT_MS
      }
    } catch (error) {
      console.warn('加载创建任务超时阈值失败，回退默认值:', error)
      batchExecuteTimeoutMs = DEFAULT_BATCH_EXECUTE_TIMEOUT_MS
    } finally {
      batchExecuteTimeoutLoaded = true
      batchExecuteTimeoutLoadingPromise = null
    }
  })()
  await batchExecuteTimeoutLoadingPromise
  return batchExecuteTimeoutMs
}

/**
 * 跳转任务中心列表并附带 refresh_ts 刷新参数
 * @param {Object} router Vue Router 实例
 * @param {Object} homeStore 首页 store
 * @returns {void}
 */
export const openTaskCenterWithRefresh = (router, homeStore) => {
  const basePath = '/task-center'
  const menuItem = homeStore.findMenuItemByPath(basePath)
  const menuId = menuItem && menuItem.id ? String(menuItem.id) : '751'
  const tabPath = `${basePath}?menuId=${menuId}&refresh_ts=${Date.now()}`
  homeStore.addTab({
    id: 'task-center',
    title: '任务中心',
    path: tabPath,
    name: '任务中心',
    meta: { title: '任务中心', keepAlive: true }
  })
  router.push(tabPath)
}

/**
 * 批量执行创建任务：与文件提取一致，字典超时后自动跳转任务中心
 * @param {Object} params 参数
 * @param {string} params.taskName 任务名称（提示文案）
 * @param {Function} params.requestFn 异步请求，返回接口响应
 * @param {Function} params.onResponse 处理响应 (response, { timeoutFallbackTriggered }) => void
 * @param {Function} params.openTaskCenter 跳转任务中心
 * @param {Function} [params.onError] 非超时场景错误回调
 * @returns {Promise<{ timeoutFallbackTriggered: boolean }>}
 */
export const runBatchExecuteWithTimeoutNav = async ({
  taskName,
  requestFn,
  onResponse,
  openTaskCenter,
  onError
}) => {
  const timeoutMs = await loadBatchExecuteTimeoutMsFromDict()
  let timeoutFallbackTriggered = false
  let timeoutId = null

  const requestPromise = (async () => {
    const response = await requestFn()
    if (!timeoutFallbackTriggered) {
      onResponse(response, { timeoutFallbackTriggered: false })
    }
    return { source: 'response' }
  })().catch((error) => {
    if (timeoutFallbackTriggered || isBatchExecuteRequestAborted(error)) {
      if (timeoutFallbackTriggered && !isBatchExecuteRequestAborted(error)) {
        console.error('创建任务接口在超时兜底后返回异常:', error)
      }
      return { source: 'error' }
    }
    console.error('创建任务失败:', error)
    if (typeof onError === 'function') {
      onError(error)
    } else {
      ElMessage.error('创建任务失败: ' + (error.message || '未知错误'))
    }
    return { source: 'error' }
  })

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      timeoutFallbackTriggered = true
      ElMessage.success(`任务"${taskName}"创建成功`)
      openTaskCenter()
      resolve({ source: 'timeout' })
    }, timeoutMs)
  })

  const winner = await Promise.race([requestPromise, timeoutPromise])
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  if (winner && winner.source === 'timeout') {
    void requestPromise
  }
  return { timeoutFallbackTriggered }
}
