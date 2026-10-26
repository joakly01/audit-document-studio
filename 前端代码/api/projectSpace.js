import { useRequest } from '@/utils/request/useRequest.js'

const { request } = useRequest()

// ==================== 项目空间接口 ====================

/**
 * 获取项目空间树结构
 * GET /api/v1/project-space/tree
 * @param {Object} [params] 查询参数，如 { refresh: true } 强制绕过 Redis 缓存
 */
export const getProjectSpaceTreeAPI = (params) => {
  return request({
    url: '/api/v1/project-space/tree',
    method: 'get',
    params
  })
}

/**
 * 获取当前用户在指定项目下的角色与权限
 * GET /api/v1/project-space/roles/me?project_id=xxx
 */
export const getUserProjectRoleAPI = (params) => {
  return request({
    url: '/api/v1/project-space/roles/me',
    method: 'get',
    params
  })
}

/**
 * 批量获取当前用户在多个项目下的角色与权限
 * POST /api/v1/project-space/roles/me/batch
 */
export const getUserProjectRoleBatchAPI = (data) => {
  return request({
    url: '/api/v1/project-space/roles/me/batch',
    method: 'post',
    data
  })
}

/**
 * 获取项目下的审计小组信息
 * GET /api/v1/project-space/groups?project_id=xxx
 */
export const getProjectGroupsAPI = (params) => {
  return request({
    url: '/api/v1/project-space/groups',
    method: 'get',
    params
  })
}

/**
 * 引入公共空间文件夹到项目空间
 * POST /api/v1/project-space/folder-references
 */
export const importFolderAPI = (data) => {
  return request({
    url: '/api/v1/project-space/folder-references',
    method: 'post',
    data
  })
}

/**
 * 取消引入（移除引用文件夹）
 * DELETE /api/v1/project-space/folder-references/{ref_id}
 */
export const removeFolderReferenceAPI = (refId) => {
  return request({
    url: `/api/v1/project-space/folder-references/${refId}`,
    method: 'delete'
  })
}
