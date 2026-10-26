import { batchGetFileAttachmentsAPI } from '@/api/fileManager.js'

/** 批量附件查询单次上限（与后端 BATCH_ATTACHMENT_LIMIT 一致） */
export const BATCH_ATTACHMENT_FETCH_LIMIT = 20

/**
 * 将接口返回的附件项转为前端树/角标使用的精简结构
 * @param {Array<Object>} list 原始附件列表
 * @returns {Array<Object>}
 */
export const normalizeAttachmentList = (list) => {
  return (list || []).map((item) => ({
    attachment_id: item.attachment_id,
    file_id: item.file_id,
    name: item.name || item.file_name || '未命名',
    path: item.path || ''
  }))
}

/**
 * 按 chunk 批量拉取主文件附件并合并到 map
 * @param {Array<string>} fileIds 待查询主文件 ID
 * @param {Object<string, Array>} existingMap 已有缓存
 * @returns {Promise<Object<string, Array>>}
 */
export const batchLoadFileAttachmentsMap = async (fileIds, existingMap = {}) => {
  const idsToFetch = [...new Set(
    (fileIds || []).map((id) => String(id)).filter(Boolean)
  )].filter((id) => !Object.prototype.hasOwnProperty.call(existingMap, id))

  if (idsToFetch.length === 0) {
    return existingMap
  }

  const nextMap = { ...existingMap }

  for (let i = 0; i < idsToFetch.length; i += BATCH_ATTACHMENT_FETCH_LIMIT) {
    const chunk = idsToFetch.slice(i, i + BATCH_ATTACHMENT_FETCH_LIMIT)
    try {
      const res = await batchGetFileAttachmentsAPI(chunk)
      if (res.code === 200) {
        const byFile = res.data?.attachments_by_file || {}
        chunk.forEach((fileId) => {
          nextMap[fileId] = normalizeAttachmentList(byFile[fileId] || [])
        })
      } else {
        chunk.forEach((fileId) => {
          nextMap[fileId] = []
        })
      }
    } catch (error) {
      console.warn('批量加载文件附件失败:', error)
      chunk.forEach((fileId) => {
        nextMap[fileId] = []
      })
    }
  }

  return nextMap
}
