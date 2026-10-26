import { eventBus } from '@/utils/eventBus.js'

/** 文件管理功能弹窗内任务开始轮询（Index 监听） */
export const FILE_MANAGER_PROGRESS_START = 'file-manager-progress-start'

/** 文件管理功能弹窗关闭时停止轮询（Index 监听） */
export const FILE_MANAGER_PROGRESS_STOP = 'file-manager-progress-stop'

/**
 * 通知文件管理页停止 GetTaskSchedules 轮询
 * @returns {void}
 */
export function emitFileManagerProgressStop() {
  eventBus.emit(FILE_MANAGER_PROGRESS_STOP)
}
