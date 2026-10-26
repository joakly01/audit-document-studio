import { useRequest } from '@/utils/request/useRequest.js'

const { request } = useRequest()

/**
 * Prompt 管理相关接口（重构版）
 * 引入空间（Space）概念，替代原有 source 字段方案
 * 后端统一返回结构：{ code, message, data }
 */

// ============ 健康检查 ============
export const getPromptHealthAPI = () => {
  return request({ url: '/api/v3/prompts/health', method: 'get' })
}

// ============ 空间接口 ============

/**
 * 获取当前用户可见的空间列表（后端按权限过滤）
 */
export const getPromptSpacesAPI = () => {
  return request({ url: '/api/v3/prompt-spaces', method: 'get' })
}

/**
 * 获取当前用户可见的空间树（树形结构）
 */
export const getPromptSpaceTreeAPI = () => {
  return request({ url: '/api/v3/prompt-spaces/tree', method: 'get' })
}

/**
 * 获取单个空间详情
 * @param {number} spaceId - 空间ID
 */
export const getPromptSpaceDetailAPI = (spaceId) => {
  return request({ url: `/api/v3/prompt-spaces/${spaceId}`, method: 'get' })
}

/**
 * 空间排序（拖拽后批量更新）
 * @param {Object} data
 * @param {number[]} data.space_ids - 空间ID列表，按新顺序排列
 */
export const sortPromptSpacesAPI = (data) => {
  return request({ url: '/api/v3/prompt-spaces/sort', method: 'post', data })
}

/**
 * 创建空间（仅 PromptKeeper）
 * @param {Object} data
 * @param {string} data.name - 空间名称
 * @param {'public'|'org'} data.type - 空间类型
 * @param {string} [data.orguuid] - 机构UUID（org类型必填）
 * @param {string} [data.description] - 描述
 * @param {number} [data.parent_id] - 父空间ID
 */
export const createPromptSpaceAPI = (data) => {
  return request({ url: '/api/v3/prompt-spaces', method: 'post', data })
}

/**
 * 更新空间
 * @param {number} id - 空间ID
 * @param {Object} data
 */
export const updatePromptSpaceAPI = (id, data) => {
  return request({ url: `/api/v3/prompt-spaces/${id}`, method: 'patch', data })
}

/**
 * 删除空间（软删除，有提示词时拒绝）
 * @param {number} id - 空间ID
 */
export const deletePromptSpaceAPI = (id) => {
  return request({ url: `/api/v3/prompt-spaces/${id}`, method: 'delete' })
}

/**
 * 获取空间管理员列表
 * @param {number} spaceId - 空间ID
 */
export const getSpaceAdminsAPI = (spaceId) => {
  return request({ url: `/api/v3/prompt-spaces/${spaceId}/admins`, method: 'get' })
}

/**
 * 添加空间管理员
 * @param {number} spaceId - 空间ID
 * @param {Object} data
 * @param {string} data.personuuid - 管理员personuuid
 * @param {string} [data.admin_name] - 管理员姓名（可选，用于展示）
 */
export const addSpaceAdminAPI = (spaceId, data) => {
  return request({ url: `/api/v3/prompt-spaces/${spaceId}/admins`, method: 'post', data })
}

/**
 * 移除空间管理员
 * @param {number} spaceId - 空间ID
 * @param {number} adminId - 管理员记录ID（PROMPT_SPACE_ADMINS.ID）
 */
export const removeSpaceAdminAPI = (spaceId, adminId) => {
  return request({ url: `/api/v3/prompt-spaces/${spaceId}/admins/${adminId}`, method: 'delete' })
}

/**
 * 批量创建子空间
 * @param {Object} data
 * @param {number} data.parent_id - 父空间ID
 * @param {string[]} data.names - 子空间名称列表
 * @param {string} [data.description] - 空间描述（可选）
 * @param {string} [data.type] - 空间类型（可选，不传则继承父空间类型）
 */
export const batchCreatePromptSpacesAPI = (data) => {
  return request({ url: '/api/v3/prompt-spaces/batch-create', method: 'post', data })
}

// ============ 分类接口 ============

/**
 * 获取指定空间的分类树
 * @param {Object} params
 * @param {number} params.space_id - 空间ID
 * @param {string} [params.keyword] - 分类名称关键词，支持模糊搜索
 */
export const getPromptCategoriesAPI = (params) => {
  return request({ url: '/api/v3/prompt-categories', method: 'get', params })
}

/**
 * 新增分类
 * @param {Object} data
 * @param {string} data.name - 分类名称
 * @param {number} data.space_id - 所属空间ID
 * @param {number} [data.parent_id] - 父分类ID
 * @param {string} [data.description] - 描述
 * @param {string} [data.icon] - 图标
 * @param {number} [data.sort_order] - 排序
 */
export const createPromptCategoryAPI = (data) => {
  return request({ url: '/api/v3/prompt-categories', method: 'post', data })
}

/**
 * 更新分类
 * @param {number} id - 分类ID
 * @param {Object} data
 */
export const updatePromptCategoryAPI = (id, data) => {
  return request({ url: `/api/v3/prompt-categories/${id}`, method: 'patch', data })
}

/**
 * 删除分类
 * @param {number} id - 分类ID
 */
export const deletePromptCategoryAPI = (id) => {
  return request({ url: `/api/v3/prompt-categories/${id}`, method: 'delete' })
}

/**
 * 分类排序（拖拽后批量更新）
 * @param {Object} data
 * @param {number} spaceId - 空间ID（Query 参数）
 * @param {Array<{id: number, sort_order: number}>} data.items - 有序分类 ID+排序值数组
 */
export const sortPromptCategoriesAPI = (spaceId, data) => {
  return request({ url: '/api/v3/prompt-categories/sort', method: 'put', params: { space_id: spaceId }, data })
}

// ============ 提示词接口 ============

/**
 * 查询提示词列表
 * @param {Object} data
 * @param {number} [data.space_id] - 空间ID
 * @param {number} [data.category_id] - 分类ID
 * @param {string} [data.name] - 名称模糊搜索
 * @param {'enabled'|'disabled'} [data.status] - 状态筛选
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页条数
 */
export const getPromptListAPI = (data) => {
  return request({ url: '/api/v3/prompts/list', method: 'post', data })
}

/**
 * 获取提示词树（按功能类型过滤）
 * 用于合同审查等模块获取特定功能的提示词列表
 * @param {string} functionType - 功能类型，如 'compliance_analysis_prompt', 'information_extraction_prompt'
 */
export const getPromptTreeAPI = (functionType) => {
  return request({ url: '/api/v3/prompts/all', method: 'get', params: { functionType } })
}

/**
 * 新增提示词
 * @param {Object} data
 * @param {string} data.name - 名称
 * @param {string} data.content - 内容
 * @param {number} data.space_id - 所属空间ID
 * @param {number[]} [data.category_ids] - 所属分类ID数组
 * @param {'enabled'|'disabled'} [data.status] - 状态，默认 enabled
 * @param {0|1} [data.is_default] - 是否默认
 * @param {string} [data.description] - 描述
 * @param {string} [data.function_type] - 所属功能类型
 */
export const createPromptAPI = (data) => {
  return request({ url: '/api/v3/prompts', method: 'post', data })
}

/**
 * 获取提示词详情
 * @param {number} id - 提示词ID
 */
export const getPromptDetailAPI = (id) => {
  return request({ url: `/api/v3/prompts/${id}`, method: 'get' })
}

/**
 * 更新提示词（部分字段）
 * @param {number} id - 提示词ID
 * @param {Object} data - 同新增，允许部分字段
 */
export const updatePromptAPI = (id, data) => {
  return request({ url: `/api/v3/prompts/${id}`, method: 'put', data })
}

/**
 * 删除提示词（软删除）
 * @param {number} id - 提示词ID
 */
export const deletePromptAPI = (id) => {
  return request({ url: `/api/v3/prompts/${id}`, method: 'delete' })
}

/**
 * 切换提示词状态
 * @param {number} id - 提示词ID
 * @param {Object} data
 * @param {'enabled'|'disabled'} data.status - 新状态
 */
export const togglePromptStatusAPI = (id, data) => {
  return request({ url: `/api/v3/prompts/${id}/status`, method: 'patch', data })
}


/**
 * 获取默认提示词
 * @param {string} functionType - 功能类型
 */
export const getDefaultPromptAPI = (functionType) => {
  return request({ url: '/api/v3/prompts/default', method: 'get', params: { functionType } })
}

/**
 * 获取新架构提示词树（按空间+功能类型）
 * 用于合同审查等模块获取特定功能的提示词列表（新架构）
 * @param {Object} params
 * @param {string} params.functionType - 功能类型，如 'compliance_analysis_prompt', 'information_extraction_prompt'
 * @param {number} [params.page] - 页码
 * @param {number} [params.size] - 每页条数
 */
export const getPromptTreeByFunctionTypeAPI = (params) => {
  return request({ url: '/api/v3/prompts', method: 'get', params })
}

/**
 * 一次性获取完整提示词树（空间 -> 分类 -> 提示词）
 * 减少前端多次请求，后端直接返回可渲染的树结构
 * @param {string} functionType - 功能类型，如 'meeting_minutes', 'compliance_analysis_prompt'
 * @returns {Promise<{items: Array, total: number, defaultPrompt: Object|null}>}
 */
export const getPromptTreeByFunctionTypeNewAPI = (functionType) => {
  return request({
    url: '/api/v3/prompts/tree-by-function-type',
    method: 'get',
    params: { functionType }
  })
}

// ============ 权限接口 ============

/**
 * 获取提示词权限列表
 * @param {Object} params
 * @param {number} params.prompt_id - 提示词ID
 */
export const getPromptPermissionsAPI = (params) => {
  return request({ url: '/api/v3/prompt-permissions', method: 'get', params })
}

/**
 * 添加权限
 * @param {Object} data
 * @param {number} data.prompt_id - 提示词ID
 * @param {string} [data.personuuid] - 用户级权限
 * @param {string} [data.user_name] - 用户名
 * @param {string} [data.orguuid] - 机构级权限
 * @param {string} [data.org_name] - 机构名
 * @param {'USE'|'EDIT'} data.permission_type - 权限类型
 */
export const addPromptPermissionAPI = (data) => {
  return request({ url: '/api/v3/prompt-permissions', method: 'post', data })
}

/**
 * 删除权限
 * @param {number} id - 权限记录ID
 */
export const deletePromptPermissionAPI = (id) => {
  return request({ url: `/api/v3/prompt-permissions/${id}`, method: 'delete' })
}

// ============ 导入导出接口 ============

/**
 * 导出提示词（按指定ID列表，下载JSON文件）
 * @param {number[]} promptIds - 要导出的提示词 ID 列表
 * @returns {Promise<Blob>} 文件 Blob
 */
export const exportPromptsAPI = (promptIds) => {
  return request({
    url: '/api/v3/prompts/export',
    method: 'post',
    data: { prompt_ids: promptIds },
    responseType: 'blob',
  })
}

/**
 * 导入提示词（从JSON文件）
 * @param {File} file - JSON 文件对象
 * @param {number} spaceId - 目标空间 ID
 * @param {number|null} categoryId - 目标分类 ID（可选）
 * @returns {Promise<Object>} 导入结果 { total, success, failed, errors }
 */
export const importPromptsAPI = (file, spaceId, categoryId) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('space_id', spaceId)
  if (categoryId != null) {
    formData.append('category_id', categoryId)
  }
  return request({
    url: '/api/v3/prompts/import',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
