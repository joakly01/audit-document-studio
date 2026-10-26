/**
 * 主题归纳 BatchExecuteByFilter 请求体构建（对齐文本信息提取 / 工程合同）
 */
import { buildToolBatchExecutePayload } from './buildToolBatchExecutePayload.js'

/**
 * 构建主题归纳单文件/文件夹 exec 配置
 * @param {Object} promptConfig 提示词配置
 * @param {Object} [promptConfig.information_extraction_project] 信息提取提示词
 * @param {Object} [promptConfig.theme_summarization_project] 主题归纳提示词
 * @returns {Object} exec_mode + custom_config
 */
export function buildThemeAnalysisExecConfig(promptConfig = {}) {
  const extractionPrompt = String(
    promptConfig.information_extraction_project?.prompt || ''
  ).trim()
  const themePrompt = String(
    promptConfig.theme_summarization_project?.prompt || ''
  ).trim()
  return {
    exec_mode: 'custom',
    custom_config: {
      prompt: extractionPrompt,
      parameter_settings: {
        mode: 'prompt',
        configured: true,
        theme_summarization_prompt: themePrompt
      }
    }
  }
}

/**
 * 构建主题归纳 BatchExecuteByFilter 请求体
 * @param {Object} options 参数
 * @param {string} options.taskName 任务名称
 * @param {string} options.taskRemark 任务备注
 * @param {string} options.toolLabel 工具名称
 * @param {Object} options.sidebarContext 左侧栏上下文
 * @param {Object} options.promptConfig 提示词配置（信息提取 + 主题归纳）
 * @param {number} [options.taskSwitch] 1 立即 2 后台，默认 2
 * @param {Array<Object>} [options.deletedFiles] 前端待删除文件列表
 * @returns {Object} 请求 JSON
 */
export function buildThemeAnalysisBatchExecutePayload(options = {}) {
  const {
    taskName = '',
    taskRemark = '',
    toolLabel = '主题归纳',
    sidebarContext = {},
    promptConfig = {},
    taskSwitch = 2,
    deletedFiles = []
  } = options

  const payload = buildToolBatchExecutePayload({
    taskName,
    taskRemark,
    toolLabel,
    bizType: 'agent_info_extraction_and_topic_summary',
    taskType: 5,
    toolUuid: 'theme-analysis-combined',
    taskSwitch,
    buildExecConfig: () => buildThemeAnalysisExecConfig(promptConfig),
    sidebarContext,
    parseStatus: ['parsed'],
    fileExtensions: ['.pdf', '.doc', '.docx', '.wps']
  })

  if (Array.isArray(deletedFiles) && deletedFiles.length > 0) {
    payload.deleted_files = deletedFiles
  }

  return payload
}
