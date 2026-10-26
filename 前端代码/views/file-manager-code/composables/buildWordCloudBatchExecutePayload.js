/**
 * 词云分析 BatchExecuteByFilter 请求体构建（对齐文本信息提取 / 工程合同）
 */
import { buildToolBatchExecutePayload } from './buildToolBatchExecutePayload.js'

/**
 * 构建词云单文件/文件夹 exec 配置
 * @param {Object} options 词表选项
 * @param {Array<string>} [options.stop_words] 停用词（执行时用户勾选子集）
 * @param {Array<string>} [options.user_dict_words] 用户新词（执行时用户勾选子集）
 * @returns {Object} exec_mode + custom_config
 */
export function buildWordCloudExecConfig(options = {}) {
  const stopWords = Array.isArray(options.stop_words) ? options.stop_words : []
  const userDictWords = Array.isArray(options.user_dict_words) ? options.user_dict_words : []
  return {
    exec_mode: 'custom',
    custom_config: {
      stop_words: stopWords,
      user_dict_words: userDictWords
    }
  }
}

/**
 * 构建词云 BatchExecuteByFilter 请求体
 * @param {Object} options 参数
 * @param {string} options.taskName 任务名称
 * @param {string} options.taskRemark 任务备注
 * @param {string} options.toolLabel 工具名称
 * @param {Object} options.sidebarContext 左侧栏上下文
 * @param {Array<string>} [options.stop_words] 停用词
 * @param {Array<string>} [options.user_dict_words] 用户新词
 * @param {number} [options.taskSwitch] 1 立即 2 后台，默认 2
 * @returns {Object} 请求 JSON
 */
export function buildWordCloudBatchExecutePayload(options = {}) {
  const {
    taskName = '',
    taskRemark = '',
    toolLabel = '词云分析',
    sidebarContext = {},
    stop_words = [],
    user_dict_words = [],
    taskSwitch = 2
  } = options

  const wordListOptions = { stop_words, user_dict_words }

  return buildToolBatchExecutePayload({
    taskName,
    taskRemark,
    toolLabel,
    bizType: 'wordCloud',
    taskType: 4,
    toolUuid: 'wordCloud',
    taskSwitch,
    buildExecConfig: () => buildWordCloudExecConfig(wordListOptions),
    sidebarContext,
    parseStatus: ['parsed'],
    fileExtensions: ['.pdf', '.doc', '.docx']
  })
}
