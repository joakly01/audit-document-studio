import { useRequest } from '@/utils/request/useRequest.js'

const { request } = useRequest()

// ==================== 任务相关 API ====================

/**
 * 分页查询任务列表
 * POST /api/v1/task/PageList
 * @param {Object} params
 * @param {number} params.page - 页码，必填，最小值1
 * @param {number} params.size - 每页条数，必填，范围1-100
 * @param {number} [params.processing_status] - 处理状态，可选，值为0-3 (0未开始 1进行中 2已完成 3失败)
 * @param {string} [params.tool_name] - 工具名称，可选，支持模糊匹配
 * @param {string} [params.task_name] - 任务名称，可选，支持模糊匹配
 */
export const getTaskPageListAPI = (params) => {
  return request({
    url: '/api/v1/task/PageList',
    method: 'post',
    data: {
      page: params.page || 1,
      size: params.size || 10,
      processing_status: params.processing_status !== undefined ? params.processing_status : undefined,
      tool_name: params.tool_name || undefined,
      task_name: params.task_name || undefined,
      include_results: params.include_results === true,
      include_selection_summary: params.include_selection_summary === true,
      include_task_steps: params.include_task_steps === true,
      prefer_runtime: params.prefer_runtime === true,
      include_total: params.include_total !== false,
      include_progress_counts: params.include_progress_counts !== false
    }
  })
}

/**
 * 获取任务详情（包含任务结果列表）
 * GET /api/v1/task/GetTaskSchedules/{task_uuid}
 * @param {string} taskUuid - 任务UUID
 * @param {Object} [options]
 * @param {boolean} [options.prefer_runtime] - 是否优先读取 Redis 运行态（与后端 Query 一致）
 */
export const getTaskSchedulesAPI = (taskUuid, options = {}) => {
  const params = {}
  if (options.prefer_runtime === true) {
    params.prefer_runtime = true
  }
  if (options.include_results === true) {
    params.include_results = true
  }
  if (options.include_results === false) {
    params.include_results = false
  }
  if (options.include_result_details === true) {
    params.include_result_details = true
  }
  if (options.include_result_details === false) {
    params.include_result_details = false
  }
  if (options.include_task_steps === true) {
    params.include_task_steps = true
  }
  if (options.include_task_steps === false) {
    params.include_task_steps = false
  }
  if (options.include_step_tree === true) {
    params.include_step_tree = true
  }
  if (options.include_step_tree === false) {
    params.include_step_tree = false
  }
  if (options.include_selection_summary === true) {
    params.include_selection_summary = true
  }
  if (options.include_selection_summary === false) {
    params.include_selection_summary = false
  }
  return request({
    url: `/api/v1/task/GetTaskSchedules/${taskUuid}`,
    method: 'get',
    params: Object.keys(params).length ? params : undefined,
    signal: options.signal
  })
}

/**
 * 获取单条任务结果详情（含 disposal_result/parameter_template 等大字段）
 * GET /api/v1/task/GetTaskResultDetail/{result_uuid}
 * @param {string} resultUuid - 结果UUID
 */
export const getTaskResultDetailAPI = (resultUuid) => {
  return request({
    url: `/api/v1/task/GetTaskResultDetail/${resultUuid}`,
    method: 'get'
  })
}

/**
 * 获取任务运行态（优先 Redis）
 * GET /api/v1/task/runtime/{task_uuid}
 * @param {string} taskUuid - 任务UUID
 */
export const getTaskRuntimeAPI = (taskUuid, options = {}) => {
  const params = {}
  if (options.allow_rebuild === true) {
    params.allow_rebuild = true
  }
  return request({
    url: `/api/v1/task/runtime/${taskUuid}`,
    method: 'get',
    params: Object.keys(params).length ? params : undefined
  })
}

/**
 * 创建任务调度
 * POST /api/v1/task/task-CreateSchedules
 * @param {Object} data
 * @param {string} data.task_name - 任务名称
 * @param {string} data.tool_uuid - 工具uuid
 * @param {string} data.tool_name - 工具名称
 * @param {string} data.file_num - 文件数（选集模式可由后端重写）
 * @param {string} [data.task_notes] - 任务描述
 * @param {Array} [data.task_schedule_results] - 传统模式：逐文件；与 selection_sources 二选一或配合后端展开
 * @param {number} data.task_switch - 1是立即执行，2是进入任务调度器
 * @param {Object} [data.selection_sources] - 目录/文件选集：folders、files、folder_filters、folder_exclusions 等
 * @param {number} [data.max_concurrent] - 单任务最大并发文件数，>=0，0 表示不限
 * @param {string} [data.contract_category] - 合同完备性兼容字段
 */
export const createTaskSchedulesAPI = (data) => {
  const payload = {
    task_name: data.task_name,
    tool_uuid: data.tool_uuid,
    tool_name: data.tool_name,
    file_num: String(data.file_num ?? '0'),
    task_notes: data.task_notes ?? '',
    task_switch: data.task_switch ?? 1,
    task_type: data.task_type ?? 1,
    biz_type: data.biz_type || 'contractCompleteness',
    task_schedule_results: data.task_schedule_results ?? []
  }
  if (data.selection_sources && typeof data.selection_sources === 'object') {
    payload.selection_sources = data.selection_sources
  }
  if (typeof data.max_concurrent === 'number' && !Number.isNaN(data.max_concurrent) && data.max_concurrent >= 0) {
    payload.max_concurrent = data.max_concurrent
  }
  if (data.contract_category != null && data.contract_category !== '') {
    payload.contract_category = data.contract_category
  }
  return request({
    url: '/api/v1/task/task-CreateSchedules',
    method: 'post',
    data: payload
  })
}

/**
 * 按文件/文件夹筛选批量执行
 * POST /api/v1/task/BatchExecuteByFilter
 * @param {Object} data 请求体
 * @param {Object} [options] 可选配置
 * @param {AbortSignal} [options.signal] 取消信号（弹窗关闭时中止长耗时请求）
 */
export const batchExecuteByFilterAPI = (data, options = {}) => {
  return request({
    url: '/api/v1/task/BatchExecuteByFilter',
    method: 'post',
    data,
    signal: options.signal
  })
}

/**
 * 待摊费用：填写计费基数后继续执行（阶段②）
 * POST /api/v1/task/prepaid_expenses_continue
 */
export function prepaidExpensesContinueAPI(data) {
  return request({
    url: '/api/v1/task/prepaid_expenses_continue',
    method: 'post',
    data
  })
}

/**
 * 导出任务执行记录
 * POST /api/v1/task/ExportExecutionRecords
 * @param {Object} data
 * @param {string} data.task_uuid - 任务UUID
 * @param {string} data.export_format - 导出格式，可选值: "excel", "json", "csv", "markdown"
 */
export const exportExecutionRecordsAPI = (data) => {
  return request({
    url: '/api/v1/task/ExportExecutionRecords',
    method: 'post',
    data: {
      task_uuid: data.task_uuid,
      export_format: data.export_format
    },
    responseType: 'blob' // 设置响应类型为 blob，用于下载文件
  })
}

/**
 * 导出工程项目数据一致性分析结果（Excel，两个 Sheet）
 * GET /api/v1/task/ExportEngineeringProjectResults/{task_uuid}
 * @param {string} taskUuid
 */
export const exportEngineeringProjectResultsAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/ExportEngineeringProjectResults/${taskUuid}`,
    method: 'get',
    responseType: 'blob'
  })
}

/**
 * 批量导出工程项目结果（ZIP：每个源文件一个 Excel）
 * GET /api/v1/task/ExportEngineeringProjectResultsZip/{task_uuid}
 * @param {string} taskUuid
 */
export const exportEngineeringProjectResultsZipAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/ExportEngineeringProjectResultsZip/${taskUuid}`,
    method: 'get',
    responseType: 'blob'
  })
}

/**
 * 批量拉取合并导出字段来源（parameter_template / parameter_settings）
 * POST /api/v1/task/MergeExportBatchFieldSources
 * @param {string[]} taskUuids - 源任务 UUID 列表
 */
export const batchMergeExportFieldSourcesAPI = (taskUuids) => {
  return request({
    url: '/api/v1/task/MergeExportBatchFieldSources',
    method: 'post',
    data: { task_uuids: taskUuids }
  })
}

/**
 * 创建合并导出任务（多任务结果合并，后台写入 MinIO）
 * POST /api/v1/task/MergeExportCreate
 * @param {Object} data - 与任务中心「合并导出」弹窗提交体一致（task_name、task_uuids、tool_uuid、export 等）
 */
export const createMergeExportTaskAPI = (data) => {
  return request({
    url: '/api/v1/task/MergeExportCreate',
    method: 'post',
    data
  })
}

/** 刷新合并导出任务的 MinIO 预签名下载链接 */
export const refreshMergeExportUrlsAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/MergeExportRefreshUrls/${taskUuid}`,
    method: 'post'
  })
}

/** 重试失败的合并导出任务 */
export const retryMergeExportAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/MergeExportRetry/${taskUuid}`,
    method: 'post'
  })
}

/**
 * 合并导出任务：打包下载全部结果（ZIP）
 * GET /api/v1/task/MergeExportDownloadZip/{task_uuid}
 * @returns {Promise<import('axios').AxiosResponse<Blob>>} 完整 axios 响应（含 headers）
 */
export const downloadMergeExportZipAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/MergeExportDownloadZip/${taskUuid}`,
    method: 'get',
    responseType: 'blob'
  })
}

/**
 * 删除/终止任务
 * DELETE /api/v1/task/DeleteTaskSchedules/{task_uuid}
 * - 未完成任务视为“终止任务”（不删除本地记录，仅更新为终止态）；
 * - 已完成/失败任务视为“删除任务”（逻辑删除）；
 * - 终止时会继续清理 scheduler 子任务。
 */
export const deleteTaskAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/DeleteTaskSchedules/${taskUuid}`,
    method: 'delete'
  })
}

/**
 * 原任务内重试失败文件
 * POST /api/v1/task/RetryFailedResults/{task_uuid}
 */
export const retryFailedResultsAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/RetryFailedResults/${taskUuid}`,
    method: 'post'
  })
}

/**
 * 按源合同分析任务查询报告状态
 * GET /api/v1/task/ContractReportBySource/{source_task_uuid}
 */
export const getContractReportBySourceAPI = (sourceTaskUuid) => {
  return request({
    url: `/api/v1/task/ContractReportBySource/${sourceTaskUuid}`,
    method: 'get'
  })
}

/**
 * 触发合同分析报告生成（绑定源任务，不创建独立任务）
 * POST /api/v1/task/ContractReportGenerate/{source_task_uuid}
 */
export const generateContractReportAPI = (sourceTaskUuid) => {
  return request({
    url: `/api/v1/task/ContractReportGenerate/${sourceTaskUuid}`,
    method: 'post'
  })
}

/** 刷新合同分析报告 MinIO 预签名下载链接 */
export const refreshContractReportUrlsAPI = (reportTaskUuid) => {
  return request({
    url: `/api/v1/task/ContractReportRefreshUrls/${reportTaskUuid}`,
    method: 'post'
  })
}

/**
 * 导出合同合规性分析结果（Excel：任务内全部合同规则结果）
 * GET /api/v1/task/ExportContractCompletenessResults/{task_uuid}
 * @param {string} taskUuid 任务 UUID
 */
export const exportContractCompletenessResultsAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/ExportContractCompletenessResults/${taskUuid}`,
    method: 'get',
    responseType: 'blob'
  })
}

/**
 * 下载合同分析报告 Word（blob）
 * GET /api/v1/task/ContractReportDownload/{report_task_uuid}
 */
export const downloadContractReportAPI = (reportTaskUuid) => {
  return request({
    url: `/api/v1/task/ContractReportDownload/${reportTaskUuid}`,
    method: 'get',
    responseType: 'blob'
  })
}

/**
 * 获取任务状态（用于轮询）
 * GET /api/v1/task/GetTaskStatus/{task_uuid}
 * @param {string} taskUuid - 任务UUID
 */
export const getTaskStatusAPI = (taskUuid) => {
  return request({
    url: `/api/v1/task/GetTaskStatus/${taskUuid}`,
    method: 'get'
  })
}

/**
 * 查询任务目录下文件分页（后端真分页）
 * GET /api/v1/task/FolderFilesPage
 */
export const getTaskFolderFilesPageAPI = (params) => {
  return request({
    url: '/api/v1/task/FolderFilesPage',
    method: 'get',
    params: {
      task_uuid: params.task_uuid,
      folder_id: params.folder_id,
      page: params.page || 1,
      size: params.size || 10,
      keyword: params.keyword || undefined,
      processing_status: params.processing_status !== undefined ? params.processing_status : undefined,
      include_descendants: params.include_descendants !== false,
      include_total: params.include_total === true
    }
  })
}

/**
 * 任务中心站内通知列表
 * GET /api/v1/task/notices
 */
export const getTaskCenterNotices = (params = {}) => {
  return request({
    url: '/api/v1/task/notices',
    method: 'get',
    params: {
      page: params.page || 1,
      size: params.size || 10,
      keyword: params.keyword || undefined,
      unread_only: params.unread_only === true ? true : undefined
    }
  })
}

/**
 * 任务中心站内通知未读数
 * GET /api/v1/task/notices/unread-count
 */
export const getTaskCenterNoticeUnreadCount = () => {
  return request({
    url: '/api/v1/task/notices/unread-count',
    method: 'get'
  })
}

/**
 * 单条标记已读
 * POST /api/v1/task/notices/{notice_uuid}/read
 */
export const markTaskCenterNoticeRead = (noticeUuid) => {
  return request({
    url: `/api/v1/task/notices/${noticeUuid}/read`,
    method: 'post'
  })
}

/**
 * 批量标记已读
 * POST /api/v1/task/notices/read-batch
 */
/**
 * 两表对比结果二次筛选（LLM 组内判定）
 * POST /api/v1/task/association_degree_two_tables_compare_analyze
 * @param {{ task_uuid: string, prompt: string, options?: object }} data
 */
export const associationCompareAnalyzeAPI = (data) => {
  return request({
    url: '/api/v1/task/association_degree_two_tables_compare_analyze',
    method: 'post',
    data,
    timeout: 3600000
  })
}
