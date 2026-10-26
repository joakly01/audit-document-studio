import { useRequest } from '@/utils/request/useRequest.js'

const { request } = useRequest()

/** 词云分析：按 file_id 批量分词统计 */
export const analyzeWordCloudByFilesAPI = (data) => {
  return request({
    url: '/api/v1/word-cloud/analyze-by-files',
    method: 'post',
    data
  })
}

/** 创建词云分析任务（任务中心） */
export const createWordCloudTaskAPI = (data) => {
  return request({
    url: '/api/v1/word-cloud/tasks',
    method: 'post',
    data
  })
}

/** 获取词云任务详情（含 step_tree） */
export const getWordCloudTaskAPI = (taskUuid, options = {}) => {
  const params = {}
  if (options.prefer_runtime === true) params.prefer_runtime = true
  return request({
    url: `/api/v1/word-cloud/tasks/${taskUuid}`,
    method: 'get',
    params: Object.keys(params).length ? params : undefined
  })
}

/** 获取词云任务结果 */
export const getWordCloudTaskResultAPI = (taskUuid) => {
  return request({
    url: `/api/v1/word-cloud/tasks/${taskUuid}/result`,
    method: 'get'
  })
}

/** 查询当前用户词云词表；支持分页参数 page、page_size、kind、keyword */
export const getWordCloudLexiconAPI = (params = {}) => {
  return request({
    url: '/api/v1/word-cloud/lexicon',
    method: 'get',
    params
  })
}

/** 任务用：全量 stop_words / user_dict_words 数组 */
export const getWordCloudLexiconWordListsAPI = () => {
  return request({
    url: '/api/v1/word-cloud/lexicon/word-lists',
    method: 'get'
  })
}

/** 全量保存用户词云词表 */
export const saveWordCloudLexiconAPI = (data) => {
  return request({
    url: '/api/v1/word-cloud/lexicon',
    method: 'put',
    data
  })
}

/** 预检：停用词导入（不写库） */
export const previewWordCloudLexiconStopAPI = (formData) => {
  return request({
    url: '/api/v1/word-cloud/lexicon/import/stop/preview',
    method: 'post',
    data: formData
  })
}

/** 预检：用户新词导入（不写库） */
export const previewWordCloudLexiconUserAPI = (formData) => {
  return request({
    url: '/api/v1/word-cloud/lexicon/import/user/preview',
    method: 'post',
    data: formData
  })
}

/** 导入 txt 为停用词（合并入库后返回最新词表）；formData 可含 overwrite_conflicts: 'true'|'false' */
export const importWordCloudLexiconStopAPI = (formData) => {
  return request({
    url: '/api/v1/word-cloud/lexicon/import/stop',
    method: 'post',
    data: formData
  })
}

/** 导入 txt 为用户新词（合并入库后返回最新词表） */
export const importWordCloudLexiconUserAPI = (formData) => {
  return request({
    url: '/api/v1/word-cloud/lexicon/import/user',
    method: 'post',
    data: formData
  })
}
