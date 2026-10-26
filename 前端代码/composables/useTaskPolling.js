import { ref, onUnmounted } from 'vue'

/**
 * 任务状态轮询组合式函数
 * 用于实时更新任务处理状态
 * 
 * @param {Object} options - 配置选项
 * @param {Function} options.fetchStatus - 获取任务状态的API函数，返回Promise
 * @param {number} [options.interval=3000] - 轮询间隔（毫秒），默认3秒
 * @param {number} [options.maxRetries=3] - 连续失败最大重试次数
 * @param {Function} [options.onStatusChange] - 状态变化时的回调函数 (newStatus, oldStatus) => void
 * @param {Function} [options.onComplete] - 任务完成时的回调函数 (status) => void
 * @param {Function} [options.onError] - 发生错误时的回调函数 (error) => void
 * @param {Function} [options.shouldStop] - 判断是否停止轮询的函数 (status) => boolean
 * 
 * @returns {Object} 轮询控制对象
 */
export function useTaskPolling(options) {
  const {
    fetchStatus,
    interval = 3000,
    maxRetries = 3,
    onStatusChange,
    onComplete,
    onError,
    shouldStop
  } = options

  // 轮询状态
  const isPolling = ref(false)
  const lastStatus = ref(null)
  const retryCount = ref(0)
  let pollTimer = null

  /**
   * 开始轮询
   * @param {string|number} taskId - 任务ID
   */
  const startPolling = async (taskId) => {
    if (isPolling.value || !taskId) return

    isPolling.value = true
    retryCount.value = 0

    // 立即执行一次
    await executePoll(taskId)

    // 设置定时轮询
    pollTimer = setInterval(async () => {
      await executePoll(taskId)
    }, interval)
  }

  /**
   * 执行单次轮询
   */
  const executePoll = async (taskId) => {
    try {
      const response = await fetchStatus(taskId)
      
      if (response && response.code === 200) {
        const status = response.data
        retryCount.value = 0 // 重置重试计数

        // 检查状态是否变化
        const statusChanged = JSON.stringify(lastStatus.value) !== JSON.stringify(status)
        if (statusChanged && lastStatus.value !== null) {
          onStatusChange?.(status, lastStatus.value)
        }
        lastStatus.value = status

        // 检查是否应该停止轮询
        const stopPolling = shouldStop 
          ? shouldStop(status)
          : (status.status === 'completed' || status.status === 'failed' || status.status === 2 || status.status === 3)

        if (stopPolling) {
          stopPollingFn()
          onComplete?.(status)
        }
      } else {
        handleError(new Error(response?.message || '获取状态失败'))
      }
    } catch (error) {
      handleError(error)
    }
  }

  /**
   * 处理错误
   */
  const handleError = (error) => {
    retryCount.value++
    console.error('轮询任务状态失败:', error)
    
    onError?.(error)

    // 超过最大重试次数，停止轮询
    if (retryCount.value >= maxRetries) {
      console.warn(`轮询失败超过${maxRetries}次，停止轮询`)
      stopPollingFn()
    }
  }

  /**
   * 停止轮询
   */
  const stopPollingFn = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    isPolling.value = false
  }

  /**
   * 立即刷新（手动触发一次轮询）
   */
  const refresh = async (taskId) => {
    if (taskId) {
      await executePoll(taskId)
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stopPollingFn()
  })

  return {
    isPolling,
    lastStatus,
    startPolling,
    stopPolling: stopPollingFn,
    refresh
  }
}

/**
 * 批量任务状态轮询组合式函数
 * 用于同时轮询多个任务的状态
 * 
 * @param {Object} options - 配置选项
 * @param {Function} options.fetchStatusList - 获取多个任务状态的API函数
 * @param {number} [options.interval=5000] - 轮询间隔（毫秒），默认5秒
 * @param {Function} [options.onUpdate] - 状态更新时的回调函数 (taskList) => void
 * 
 * @returns {Object} 轮询控制对象
 */
export function useBatchTaskPolling(options) {
  const {
    fetchStatusList,
    interval = 5000,
    onUpdate
  } = options

  const isPolling = ref(false)
  let pollTimer = null
  let activeTaskIds = []
  let isRequesting = false

  /**
   * 开始轮询
   * @param {Array<string|number>} taskIds - 任务ID列表
   */
  const startPolling = (taskIds) => {
    if (!taskIds || taskIds.length === 0) return

    activeTaskIds = [...taskIds]

    if (isPolling.value) return
    
    isPolling.value = true

    // 立即执行一次
    executePoll()

    // 设置定时轮询
    pollTimer = setInterval(executePoll, interval)
  }

  /**
   * 执行单次轮询
   */
  const executePoll = async () => {
    if (isRequesting) return
    isRequesting = true
    try {
      // 过滤掉已完成或失败的任务
      const response = await fetchStatusList(activeTaskIds)
      
      if (response && response.code === 200) {
        const taskList = response.data?.items || response.data || []

        onUpdate?.(taskList)

        // 仅根据「当前页关心的任务 ID」判断是否继续轮询，避免系统里存在其它进行中任务时永远不停请求 PageList
        if (activeTaskIds.length === 0) {
          stopPollingFn()
        } else {
          const stillActive = activeTaskIds.some((id) => {
            const task = taskList.find(
              (t) => String(t.task_uuid || t.TASK_UUID || '') === String(id)
            )
            if (!task) {
              // 请求按「进行中」过滤时，已完成的任务不会出现在列表中 = 可停止对该 id 的轮询
              return false
            }
            const status = task.status ?? task.task_status
            return (
              status === 'processing' ||
              status === 'pending' ||
              status === 0 ||
              status === 1
            )
          })
          if (!stillActive) {
            stopPollingFn()
          }
        }
      }
    } catch (error) {
      console.error('批量轮询任务状态失败:', error)
    } finally {
      isRequesting = false
    }
  }

  /**
   * 更新任务ID列表
   */
  const updateTaskIds = (taskIds) => {
    activeTaskIds = [...taskIds]
    
    // 如果没有活跃任务，停止轮询
    if (activeTaskIds.length === 0 && isPolling.value) {
      stopPollingFn()
    }
  }

  /**
   * 停止轮询
   */
  const stopPollingFn = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    isPolling.value = false
    activeTaskIds = []
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stopPollingFn()
  })

  return {
    isPolling,
    startPolling,
    stopPolling: stopPollingFn,
    updateTaskIds
  }
}

export default useTaskPolling
