import { useRequest } from '@/utils/request/useRequest.js'
import { getToken } from '@/utils/request/token.js'

const { request } = useRequest()

// ==================== 文件夹管理接口 ====================

// 获取文件夹树
export const getFolderTreeAPI = (params) => {
  return request({
    url: '/api/v1/file-manager/folders/tree',
    method: 'get',
    params
  })
}

/** 文档资料挖掘：按当前用户机构返回可见工具列表 */
export const getVisibleFileManagerToolsAPI = () => {
  return request({
    url: '/api/v1/file-manager/visible-tools',
    method: 'get'
  })
}

// 获取指定文件夹下的子文件夹列表
export const getFolderChildrenAPI = (folder_id) => {
  return request({
    url: `/api/v1/file-manager/folders/${folder_id}/children`,
    method: 'get'
  })
}

// 获取文件空间类型（从数据字典 file_space_type 读取）
// 后端接口：/api/v1/dict-types/code/file_space_type/items
// 说明：
// - 通过数据字典驱动空间类型，支持后续新增第三、第四个空间
// - 字段含义：
//   - key_code: 空间编码（如 PUBLIC、PERSONAL、ARCHIVE）
//   - label:   空间显示名称（如 公共空间、个人空间）
//   - sort_order: 排序号（可选）
export const getFileSpaceTypesAPI = () => {
  return request({
    url: '/api/v1/dict-types/code/file_space_type/items',
    method: 'get',
    params: {
      status: 1, // 只取启用项
      tree: false
    }
  })
}

// 获取文件夹及子文件夹文件统计信息
export const getFolderFileStatsAPI = (folderId) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/file-stats`,
    method: 'get'
  })
}

// 创建文件夹
export const createFolderAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/folders',
    method: 'post',
    data
  })
}

// 批量创建嵌套文件夹
export const batchCreateFoldersAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/folders/batch-create',
    method: 'post',
    data
  })
}

// 批量检测文件夹上传同名冲突（一次请求检测多个目标文件夹）
export const batchCheckUploadConflictsAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/folders/check-upload-conflicts',
    method: 'post',
    data
  })
}

// 创建文件夹上传会话（Redis）
export const createFolderUploadSessionAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/folder-upload/sessions',
    method: 'post',
    data
  })
}

// 查询未完成的文件夹上传会话列表
export const listFolderUploadSessionsAPI = () => {
  return request({
    url: '/api/v1/file-manager/folder-upload/sessions',
    method: 'get'
  })
}

// 查询文件夹上传会话详情
export const getFolderUploadSessionAPI = (sessionId) => {
  return request({
    url: `/api/v1/file-manager/folder-upload/sessions/${sessionId}`,
    method: 'get'
  })
}

// 更新文件夹上传会话中单文件状态
export const updateFolderUploadFileStatusAPI = (sessionId, data) => {
  return request({
    url: `/api/v1/file-manager/folder-upload/sessions/${sessionId}/files`,
    method: 'patch',
    data
  })
}

// 批量更新文件夹上传会话中多个文件状态
export const batchUpdateFolderUploadFileStatusAPI = (sessionId, data) => {
  return request({
    url: `/api/v1/file-manager/folder-upload/sessions/${sessionId}/files/batch`,
    method: 'patch',
    data
  })
}

// 删除文件夹上传会话
export const deleteFolderUploadSessionAPI = (sessionId) => {
  return request({
    url: `/api/v1/file-manager/folder-upload/sessions/${sessionId}`,
    method: 'delete'
  })
}

// 删除当前用户全部未完成文件夹上传会话
export const deleteAllFolderUploadSessionsAPI = () => {
  return request({
    url: '/api/v1/file-manager/folder-upload/sessions',
    method: 'delete'
  })
}

// 删除文件夹
export const deleteFolderAPI = (folderId) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}`,
    method: 'delete'
  })
}

// 重命名文件夹
export const renameFolderAPI = (folderId, data) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/rename`,
    method: 'put',
    data
  })
}

// 移动文件夹
export const moveFolderAPI = (folderId, data) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/move`,
    method: 'put',
    data
  })
}

// 绑定/解绑项目
export const bindProjectAPI = (folderId, data) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/bind-project`,
    method: 'put',
    data
  })
}

/** 绑定/解绑机构（仅超级文件管理员）；body: { bound_org_uuid?, grant_read_to_org?, grant_read_include_descendants? } */
export const bindOrgAPI = (folderId, data) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/bind-org`,
    method: 'put',
    data
  })
}

// 更新文件夹排序（仅超级文件管理员）
export const updateFolderOrderAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/folders/order',
    method: 'put',
    data
  })
}

// 根据机构UUID查询用户列表
export const getUsersByOrgAPI = (orgUuid) => {
  return request({
    url: '/api/v1/users-by-org',
    method: 'get',
    params: { org_uuid: orgUuid }
  })
}

// ==================== 文件管理接口 ====================

// 获取文件列表（分页）
export const getFileListAPI = (params) => {
  return request({
    url: '/api/v1/file-manager/files',
    method: 'get',
    params
  })
}

export const initChunkUploadAPI = (data) => request({ url: '/api/v1/file-manager/files/upload/init', method: 'post', data })
export const uploadChunkAPI = (formData, onUploadProgress, signal) => request({ url: '/api/v1/file-manager/files/upload/chunk', method: 'post', data: formData, headersType: 'multipart/form-data', onUploadProgress, signal })
export const completeChunkUploadAPI = (data) => request({ url: '/api/v1/file-manager/files/upload/complete', method: 'post', data })
export const getChunkUploadStatusAPI = (uploadId) => request({ url: '/api/v1/file-manager/files/upload/status', method: 'get', params: { upload_id: uploadId } })

// 上传文件；options.overwrite 为 true 时覆盖同名文件（后端删除旧记录后新 file_id）
export const uploadFileAPI = (formData, onUploadProgress, options = {}) => {
  const { overwrite = false } = options
  if (overwrite) {
    formData.append('overwrite', 'true')
  }
  return request({
    url: '/api/v1/file-manager/files/upload',
    method: 'post',
    data: formData,
    headersType: 'multipart/form-data',
    onUploadProgress: onUploadProgress
  })
}

// 获取文件内容长文本（FILE_CONTENT）
export const getFileContentAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/content`,
    method: 'get'
  })
}

// 批量获取文件 OCR/文本内容（与单文件 content 同源，顺序与 file_ids 一致）
export const getFilesContentBatchAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/files/batch-content',
    method: 'post',
    data
  })
}

// 全文识别进度
export const getContentProgressSummaryAPI = (params) => {
  return request({
    url: '/api/v1/file-manager/content-progress/summary',
    method: 'get',
    params
  })
}

export const getContentProgressFilesAPI = (params) => {
  return request({
    url: '/api/v1/file-manager/content-progress/files',
    method: 'get',
    params
  })
}

export const getOcrConcurrencyAPI = () => {
  return request({
    url: '/api/v1/file-manager/content-progress/ocr-concurrency',
    method: 'get'
  })
}

export const putOcrConcurrencyAPI = (concurrency_local, concurrency_oss) => {
  return request({
    url: '/api/v1/file-manager/content-progress/ocr-concurrency',
    method: 'put',
    data: { concurrency_local, concurrency_oss }
  })
}

/** 清空 Redis OCR 队列（仅超级文件管理员）；未消费任务会丢失 */
export const postOcrQueueClearAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/content-progress/ocr-queue/clear',
    method: 'post',
    data
  })
}

/** 对本空间内有权限且全文为空的本地上传文件重新入队 OCR */
export const postRequeueLocalEmptyAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/content-progress/requeue-local-empty',
    method: 'post',
    data
  })
}

/** 按 file_id 将 Redis 失败队列中的任务重新入队 OCR */
export const postRequeueByFileIdsAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/content-progress/requeue-by-ids',
    method: 'post',
    data
  })
}

// ==================== OSS 接口 ====================

// 获取 OSS 文件夹树（内网）
export const getOssFolderTreeAPI = (params) => {
  return request({
    url: '/api/v1/oss/folder-tree',
    method: 'get',
    params
  })
}

// 同步 OSS 文件夹到数据库
export const syncOssFoldersAPI = (data) => {
  return request({
    url: '/api/v1/oss/sync-folders',
    method: 'post',
    data
  })
}

// 从 OSS 实时拉取目录树并同步文件夹（定时任务一键调用，无需 body）
export const syncOssFoldersFromOssAPI = (params) => {
  return request({
    url: '/api/v1/oss/sync-folders-from-oss',
    method: 'post',
    params: params || {}
  })
}

// 同步 OSS 文件到 WJGL_FILE_METADATA_OSS
export const syncOssFilesAPI = () => {
  return request({
    url: '/api/v1/oss/sync-files',
    method: 'post'
  })
}

// 批量更新 OSS 文件的 file_content（OCR）
export const refreshOssFileContentAPI = () => {
  return request({
    url: '/api/v1/oss/refresh-file-content',
    method: 'post'
  })
}

// 文本检索 - 预匹配文件列表（后端按正则筛选出至少有一处匹配的文件）
export const textSearchCheckFilesAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/files/text-search/check',
    method: 'post',
    data
  })
}

// 下载文件（获取预签名URL）
export const downloadFileAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/download`,
    method: 'get'
  })
}

// 预览文件（获取预签名URL）
export const previewFileAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/preview`,
    method: 'get'
  })
}

/** 查询表格文件 PDF 预览链接（Excel/CSV 转 PDF） */
export const getFilePreviewPdfAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/preview-pdf`,
    method: 'get'
  })
}

/** 查询表格文件首行列名（服务端解析，避免前端整文件下载） */
export const getSpreadsheetColumnHeadersAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/column-headers`,
    method: 'get',
    // 列名仅为配置下拉辅助；失败时由调用方兜底，勿弹全局「Not Found」
    silentError: true
  })
}

// 删除文件
export const deleteFileAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}`,
    method: 'delete'
  })
}

// 重命名文件
export const renameFileAPI = (fileId, data) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/rename`,
    method: 'put',
    data
  })
}

// 移动文件
export const moveFileAPI = (fileId, data) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/move`,
    method: 'put',
    data
  })
}

// ==================== 文件标签接口 ====================

// 获取文件标签列表
export const getFileTagsAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/tags`,
    method: 'get'
  })
}

// 通过大模型生成文件标签（当前后端为桩实现）
export const generateFileTagsAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/tags/generate`,
    method: 'post'
  })
}

// 手动添加文件标签
export const addFileTagAPI = (fileId, data) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/tags`,
    method: 'post',
    data
  })
}

// 删除文件标签
export const deleteFileTagAPI = (fileId, tagId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/tags/${tagId}`,
    method: 'delete'
  })
}

// ==================== 文件附件接口 ====================

// 获取文件附件列表
export const getFileAttachmentsAPI = (fileId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/attachments`,
    method: 'get'
  })
}

// 批量获取主文件附件列表（单次请求，避免 N 个主文件并发打满连接）
export const batchGetFileAttachmentsAPI = (fileIds) => {
  return request({
    url: '/api/v1/file-manager/files/attachments/batch',
    method: 'post',
    data: { file_ids: fileIds }
  })
}

// 添加文件附件
export const addFileAttachmentsAPI = (fileId, data) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/attachments`,
    method: 'post',
    data
  })
}

// 移除文件附件（仅删除关联）
export const removeFileAttachmentAPI = (fileId, attachmentId) => {
  return request({
    url: `/api/v1/file-manager/files/${fileId}/attachments/${attachmentId}`,
    method: 'delete'
  })
}

// ==================== 标签定义管理接口 ====================

// 获取标签定义列表（分页）
export const getTagDefinitionsAPI = (params) => {
  return request({
    url: '/api/v1/file-manager/tags',
    method: 'get',
    params
  })
}

// 获取所有启用的标签定义（下拉用）
export const getAllEnabledTagsAPI = () => {
  return request({
    url: '/api/v1/file-manager/tags/all-enabled',
    method: 'get'
  })
}

// 创建标签定义
export const createTagDefinitionAPI = (data) => {
  return request({
    url: '/api/v1/file-manager/tags',
    method: 'post',
    data
  })
}

// 更新标签定义
export const updateTagDefinitionAPI = (tagDefId, data) => {
  return request({
    url: `/api/v1/file-manager/tags/${tagDefId}`,
    method: 'put',
    data
  })
}

// 删除标签定义
export const deleteTagDefinitionAPI = (tagDefId) => {
  return request({
    url: `/api/v1/file-manager/tags/${tagDefId}`,
    method: 'delete'
  })
}

// ==================== 权限管理接口 ====================

// 获取文件夹权限列表
export const getFolderPermissionsAPI = (folderId) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/permissions`,
    method: 'get'
  })
}

// 授权文件夹权限
export const grantPermissionAPI = (folderId, data) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/permissions`,
    method: 'post',
    data
  })
}

// 撤销文件夹权限
export const revokePermissionAPI = (folderId, permissionId) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/permissions/${permissionId}`,
    method: 'delete'
  })
}

// 查询我的权限
export const getMyPermissionAPI = (folderId) => {
  return request({
    url: `/api/v1/file-manager/folders/${folderId}/my-permission`,
    method: 'get'
  })
}

// ==================== 项目关联接口 ====================

// 获取项目列表（用于文件夹绑定项目，支持分页/搜索）
export const getProjectsAPI = (params) => {
  return request({
    url: '/api/v1/file-manager/projects',
    method: 'get',
    params
  })
}

// ==================== 旧接口（保留兼容性） ====================

// 文件 - 批量上传（旧接口，保留兼容）
export const batchUploadFileAPI = (formData, onUploadProgress) => {
  return request({
    url: '/api/v1/publicfiles/batchUpload',
    method: 'post',
    data: formData,
    headersType: 'multipart/form-data',
    onUploadProgress: onUploadProgress
  })
}

// 文件 - 预览（旧接口，保留兼容）
export const previewFileAPIOld = (fileId) => {
  return request({
    url: `/api/v1/publicfiles/preview/${fileId}`,
    method: 'get'
  })
}

// DOC 文件转换 - 转换为 DOCX
export const convertDocToDocxAPI = (file, fileUrl) => {
  const formData = new FormData()
  if (file) {
    formData.append('file', file)
  }
  if (fileUrl) {
    formData.append('file_url', fileUrl)
  }
  return request({
    url: '/api/v1/files/preview/doc-to-docx',
    method: 'post',
    data: formData,
    headersType: 'multipart/form-data'
  })
}

// XLS 文件转换 - 转换为 XLSX
export const convertXlsToXlsxAPI = (file, fileUrl) => {
  const formData = new FormData()
  if (file) {
    formData.append('file', file)
  }
  if (fileUrl) {
    formData.append('file_url', fileUrl)
  }
  return request({
    url: '/api/v1/files/preview/xls-to-xlsx',
    method: 'post',
    data: formData,
    headersType: 'multipart/form-data'
  })
}

// 获取转换后的 DOCX 文件预览 URL
export const getPreviewFileAPI = (fileId) => {
  // 获取认证 token
  const token = getToken()
  if (!token) {
    console.warn('未找到认证 token，预览可能失败')
    return `/api/v1/files/preview/${fileId}`
  }

  // 将 token 作为查询参数添加到 URL，因为 VueOfficeDocx 组件可能无法设置 Header
  // 使用 encodeURIComponent 确保特殊字符被正确编码
  const encodedToken = encodeURIComponent(token)
  return `/api/v1/files/preview/${fileId}?token=${encodedToken}`
}

// 获取个人空间存储信息
export const getPersonalStorageInfoAPI = () => {
  return request({
    url: '/api/v1/file-manager/storage/personal',
    method: 'get'
  })
}

// 获取公共空间存储统计
export const getPublicSpaceStatsAPI = () => {
  return request({
    url: '/api/v1/file-manager/storage/public-space-stats',
    method: 'get'
  })
}

// 获取所有用户存储信息
export const getAllUsersStorageInfoAPI = () => {
  return request({
    url: '/api/v1/file-manager/storage/users',
    method: 'get'
  })
}

// 设置用户存储额度
export const setUserStorageQuotaAPI = (userId, limitGb) => {
  return request({
    url: `/api/v1/file-manager/storage/users/${userId}/quota`,
    method: 'put',
    params: {
      limit_gb: limitGb
    }
  })
}

// 批量设置用户存储额度
export const batchSetUserStorageQuotaAPI = (quotas) => {
  return request({
    url: '/api/v1/file-manager/storage/users/quota/batch',
    method: 'post',
    data: quotas
  })
}
