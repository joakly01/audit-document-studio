import { useRequest } from '@/utils/request/useRequest.js'

const { request } = useRequest()

// ==================== 文件夹相关 API ====================

/**
 * 获取左侧模板目录树
 * GET /api/v1/template/getDirectoryTree
 */
export const getTemplateFoldersAPI = () => {
  return request({
    url: '/api/v1/template/getDirectoryTree',
    method: 'get'
  })
}

/**
 * 创建文件夹
 * POST /api/v1/template/createDirectory
 * @param {Object} data
 * @param {string} data.directory_name - 目录名称
 * @param {string} [data.pid] - 父目录UUID(可选)
 * @param {string} [data.path_uuid] - 路径UUID(可选)
 * @param {string} [data.path_name] - 路径名称(可选)
 */
export const createTemplateFolderAPI = (data) => {
  return request({
    url: '/api/v1/template/createDirectory',
    method: 'post',
    data: {
      directory_name: data.name || data.directory_name,
      pid: data.pid || data.parentId || null,
      path_uuid: data.path_uuid || null,
      path_name: data.path_name || null
    }
  })
}

/**
 * 更新文件夹
 * POST /api/v1/template/updateDirectory
 * @param {Object} data
 * @param {string} data.directory_uuid - 目录UUID
 * @param {string} [data.directory_name] - 目录名称
 * @param {string} [data.pid] - 父目录UUID(可选)
 * @param {string} [data.path_uuid] - 路径UUID(可选)
 * @param {string} [data.path_name] - 路径名称(可选)
 */
export const updateTemplateFolderAPI = (directoryUuid, data) => {
  return request({
    url: '/api/v1/template/updateDirectory',
    method: 'post',
    data: {
      directory_uuid: directoryUuid,
      directory_name: data.name || data.directory_name,
      pid: data.pid || null,
      path_uuid: data.path_uuid || null,
      path_name: data.path_name || null
    }
  })
}

/**
 * 删除文件夹
 * GET /api/v1/template/deleteDirectory/{directory_uuid}
 * @param {string} directoryUuid - 目录UUID
 */
export const deleteTemplateFolderAPI = (directoryUuid) => {
  return request({
    url: `/api/v1/template/deleteDirectory/${directoryUuid}`,
    method: 'get'
  })
}

// ==================== 模板相关 API ====================

/**
 * 查询文件夹下的模板
 * POST /api/v1/template/getTemplatesByDirectory
 * @param {Object} params
 * @param {string} params.directory_uuid - 目录UUID
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.size=15] - 每页数量
 * @param {string} [params.template_name] - 模板名称（用于搜索过滤）
 */
export const getTemplatesByDirectoryAPI = (params) => {
  return request({
    url: '/api/v1/template/getTemplatesByDirectory',
    method: 'post',
    data: {
      directory_uuid: params.directory_uuid || params.folderId || null,
      page: params.page || 1,
      size: params.size || 15,
      template_name: params.template_name || null // 搜索模板名称
    }
  })
}

/**
 * 获取模板详情
 * GET /api/v1/template/getTable/{prompt_uuid}
 * @param {string} promptUuid - 模板UUID
 */
export const getTemplateDetailAPI = (promptUuid) => {
  return request({
    url: `/api/v1/template/getTable/${promptUuid}`,
    method: 'get'
  })
}

/**
 * 创建模板
 * POST /api/v1/template/createTable
 * @param {Object} data
 * @param {string} data.template_name - 模板名称
 * @param {string} [data.template_desc] - 模板描述(可选)
 * @param {string} data.pid - 父目录UUID
 * @param {string} [data.path_uuid] - 路径UUID(可选)
 * @param {string} [data.path_name] - 路径名称(可选)
 * @param {string} [data.prompt] - 提示词(可选)，用于存储字段配置JSON
 * @param {string} [data.template_type] - 模板类型，0或1，默认为"0"
 * @param {string} [data.template_classification] - 模板分类(可选)
 */
export const createTemplateAPI = (data) => {
  // 将字段配置（rules）序列化为JSON存储在prompt字段中
  const prompt = data.rules && data.rules.length > 0 
    ? JSON.stringify(data.rules) 
    : (data.prompt || '')

  return request({
    url: '/api/v1/template/createTable',
    method: 'post',
    data: {
      template_name: data.name || data.template_name,
      template_desc: data.description || data.template_desc || '',
      pid: data.pid || data.folderId || null,
      path_uuid: data.path_uuid || null,
      path_name: data.path_name || null,
      prompt: prompt,
      template_type: data.template_type || '0',
      template_classification: data.template_classification || data.category || ''
    }
  })
}

/**
 * 更新模板
 * POST /api/v1/template/updateTable
 * @param {string} promptUuid - 模板UUID
 * @param {Object} data
 * @param {string} [data.template_name] - 模板名称(可选)
 * @param {string} [data.template_desc] - 模板描述(可选)
 * @param {string} [data.pid] - 父目录UUID(可选)
 * @param {string} [data.path_uuid] - 路径UUID(可选)
 * @param {string} [data.path_name] - 路径名称(可选)
 * @param {string} [data.prompt] - 提示词(可选)，用于存储字段配置JSON
 * @param {number} [data.template_type] - 模板类型，0或1
 * @param {string} [data.template_classification] - 模板分类(可选)
 */
export const updateTemplateAPI = (promptUuid, data) => {
  // 将字段配置（rules）序列化为JSON存储在prompt字段中
  const prompt = data.rules && data.rules.length > 0 
    ? JSON.stringify(data.rules) 
    : (data.prompt || '')

  return request({
    url: '/api/v1/template/updateTable',
    method: 'post',
    data: {
      prompt_uuid: promptUuid,
      template_name: data.name || data.template_name,
      template_desc: data.description || data.template_desc,
      pid: data.pid || data.folderId || null,
      path_uuid: data.path_uuid || null,
      path_name: data.path_name || null,
      prompt: prompt,
      template_type: data.template_type !== undefined ? data.template_type : 1,
      template_classification: data.template_classification || data.category || ''
    }
  })
}

/**
 * 删除模板
 * GET /api/v1/template/deleteTable/{prompt_uuid}
 * @param {string} promptUuid - 模板UUID
 */
export const deleteTemplateAPI = (promptUuid) => {
  return request({
    url: `/api/v1/template/deleteTable/${promptUuid}`,
    method: 'get'
  })
}

/**
 * 导出配置
 * GET /api/v1/template/exportConfig/{prompt_uuid}
 * @param {string} promptUuid - 模板UUID
 */
export const exportTemplateConfigAPI = (promptUuid) => {
  return request({
    url: `/api/v1/template/exportConfig/${promptUuid}`,
    method: 'get',
    responseType: 'blob' // 支持文件流下载
  })
}

// ==================== 兼容性 API（用于向后兼容）====================

/**
 * 获取公共和私有模板列表（用于下拉选择）
 * POST /api/v1/template/getPublicAndPrivateTemplates
 * @param {Object} params
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.size=15] - 每页数量
 */
export const getPublicAndPrivateTemplatesAPI = (params = {}) => {
  return request({
    url: '/api/v1/template/getPublicAndPrivateTemplates',
    method: 'post',
    data: {
      page: params.page || 1,
      size: params.size || 15,
      template_classification: params.template_classification || null
    }
  })
}

/**
 * 获取模板列表（兼容旧接口）
 * 根据参数决定调用哪个接口
 * @param {Object} params
 * @param {string} [params.search] - 搜索关键词
 * @param {string} [params.category] - 分类（public/personal）
 * @param {string} [params.folderId] - 文件夹ID
 */
export const getTemplatesAPI = async (params = {}) => {
  // 如果有 folderId，使用 getTemplatesByDirectoryAPI
  if (params.folderId) {
    const res = await getTemplatesByDirectoryAPI({
      directory_uuid: params.folderId,
      page: params.page || 1,
      size: params.size || 1000 // 默认获取大量数据以支持搜索
    })
    
    // 处理响应数据格式转换
    if (res.code === 200 && res.data) {
      // 后端返回的数据结构：{ items: [], page: 1, size: 1000, total: 2 }
      let templates = []
      if (Array.isArray(res.data)) {
        templates = res.data
      } else if (res.data.items && Array.isArray(res.data.items)) {
        templates = res.data.items
      } else if (res.data.list && Array.isArray(res.data.list)) {
        templates = res.data.list
      } else if (res.data.templates && Array.isArray(res.data.templates)) {
        templates = res.data.templates
      }
      
      // 转换数据格式并解析字段配置
      templates = templates.map(template => {
        let rules = []
        try {
          if (template.prompt) {
            rules = JSON.parse(template.prompt)
          }
        } catch (e) {
          console.warn('解析模板字段配置失败:', e)
        }
        
        return {
          id: template.prompt_uuid,
          name: template.template_name,
          description: template.template_desc,
          category: template.template_classification || 'personal',
          folderId: template.pid,
          rules: rules,
          createdBy: template.create_user_uuid,
          createdAt: template.create_time,
          prompt: template.prompt,
          templateType: template.template_type
        }
      })
      
      // 前端搜索过滤
      if (params.search) {
        const search = params.search.toLowerCase()
        templates = templates.filter(t => 
          t.name.toLowerCase().includes(search) || 
          (t.description && t.description.toLowerCase().includes(search))
        )
      }
      
      return {
        code: 200,
        data: templates,
        message: '获取成功'
      }
    }
    
    return res
  }
  
  // 如果没有 folderId，返回空数组（需要先选择文件夹）
  return {
    code: 200,
    data: [],
    message: '请先选择文件夹'
  }
}
