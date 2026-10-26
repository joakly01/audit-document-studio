import { useRequest } from '@/utils/request/useRequest.js'

const { request } = useRequest()

// 字典类型 - 列表（分页/搜索/状态）
export const getDictTypesAPI = (params) => {
  return request({
    url: '/api/v1/dict-types',
    method: 'get',
    params
  })
}

// 字典类型 - 创建
export const createDictTypeAPI = (data) => {
  return request({
    url: '/api/v1/dict-types',
    method: 'post',
    data
  })
}

// 字典类型 - 更新
export const updateDictTypeAPI = (id, data) => {
  return request({
    url: `/api/v1/dict-types/${id}`,
    method: 'put',
    data
  })
}

// 字典类型 - 删除
export const deleteDictTypeAPI = (id) => {
  return request({
    url: `/api/v1/dict-types/${id}`,
    method: 'delete'
  })
}

// 字典项 - 列表（分页/搜索/状态）
export const getDictItemsAPI = (params) => {
  return request({
    url: '/api/v1/dict-items',
    method: 'get',
    params
  })
}

// 按类型ID获取字典项（支持树/平铺）
export const getDictItemsByTypeAPI = (typeId, params) => {
  return request({
    url: `/api/v1/dict-types/${typeId}/items`,
    method: 'get',
    params
  })
}

// 按类型编码获取字典项（支持树/平铺）
export const getDictItemsByCodeAPI = (typeCode, params) => {
  return request({
    url: `/api/v1/dict-types/code/${typeCode}/items`,
    method: 'get',
    params
  })
}

// 懒加载获取子字典项
export const getDictItemChildrenAPI = (typeId, params) => {
  return request({
    url: `/api/v1/dict-types/${typeId}/children`,
    method: 'get',
    params
  })
}

// 字典项 - 创建
export const createDictItemAPI = (data) => {
  return request({
    url: '/api/v1/dict-items',
    method: 'post',
    data
  })
}

// 字典项 - 更新
export const updateDictItemAPI = (id, data) => {
  return request({
    url: `/api/v1/dict-items/${id}`,
    method: 'put',
    data
  })
}

// 字典项 - 删除
export const deleteDictItemAPI = (id) => {
  return request({
    url: `/api/v1/dict-items/${id}`,
    method: 'delete'
  })
}

// 字典项 - 批量删除
export const batchDeleteDictItemsAPI = (itemIds) => {
  return request({
    url: '/api/v1/dict-items/batch-delete',
    method: 'post',
    data: { item_ids: itemIds }
  })
}

// 数据字典 - 导出
export const exportDictAPI = (typeIds) => {
  const params = typeIds && typeIds.length > 0 ? { type_ids: typeIds.join(',') } : {}
  return request({
    url: '/api/v1/dict-types/export',
    method: 'get',
    params
  })
}

// 数据字典 - 导入
export const importDictAPI = (formData) => {
  return request({
    url: '/api/v1/dict-types/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
