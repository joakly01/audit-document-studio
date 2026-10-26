<template>
  <div class="config-container">
    <div class="config-body">
      <div class="config-scroll">
        <div v-if="showSectionHeader" class="rule-header rule-header--section">
          <span class="rule-title">选择提示词</span>
        </div>

        <div
          class="prompt-form-loading-wrap"
          v-loading="promptTreeLoading"
          element-loading-text="正在加载提示词..."
        >
          <div class="prompt-config">
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
                <span class="field-label-text">信息提取</span>
              </div>
              <el-tree-select
                :model-value="prompt.information_extraction_project.key"
                class="field-input-full"
                @update:model-value="updateEngineeringRepeatProjectKey"
                :data="engineeringRepeatProjectList"
                placeholder="请选择提示词"
                :props="treeProps"
                :render-after-expand="false"
                check-strictly
                :check-on-click-node="true"
              >
                <template #default="{ data }">
                  <span :class="getNodeClass(data)">{{ data.name }}</span>
                </template>
              </el-tree-select>
            </div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
                <span class="field-label-text">提示词内容</span>
              </div>
              <el-input
                :model-value="prompt.information_extraction_project.prompt"
                @update:model-value="updateEngineeringRepeatProjectPrompt"
                type="textarea"
                :rows="5"
                :autosize="{ minRows: 5, maxRows: 15 }"
                placeholder="请输入或修改提示词内容"
                class="preserve-whitespace field-input-full"
              />
            </div>

            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
                <span class="field-label-text">主题归纳</span>
              </div>
              <el-tree-select
                :model-value="prompt.theme_summarization_project.key"
                class="field-input-full"
                @update:model-value="updateEngineeringSubProjectKey"
                :data="engineeringSubProjectList"
                placeholder="请选择提示词"
                :props="treeProps"
                :render-after-expand="false"
                check-strictly
                :check-on-click-node="true"
              >
                <template #default="{ data }">
                  <span :class="getNodeClass(data)">{{ data.name }}</span>
                </template>
              </el-tree-select>
            </div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
                <span class="field-label-text">提示词内容</span>
              </div>
              <el-input
                :model-value="prompt.theme_summarization_project.prompt"
                @update:model-value="updateEngineeringSubProjectPrompt"
                type="textarea"
                :rows="5"
                :autosize="{ minRows: 5, maxRows: 15 }"
                placeholder="请输入或修改提示词内容"
                class="preserve-whitespace field-input-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="config-actions-bottom ocr-sidebar-footer" v-if="!noExecute">
      <el-button
        type="primary"
        class="ocr-footer-btn"
        :loading="loading"
        :disabled="loading"
        @click="handleExecuteCommand(EXECUTE_MODE_EXTRACT_AND_SUMMARIZE)"
      >
        执行
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { getPromptTreeByFunctionTypeNewAPI } from '@/api/IcssPlatform/promptManagement.js'

/** 与原下拉项「提取并主题归纳（至完成）」相同，mode 传给父组件 ThemeAnalysisViewer */
const EXECUTE_MODE_EXTRACT_AND_SUMMARIZE = 'extractAndSummarize'

const props = defineProps({
  prompt: {
    type: Object,
    default: () => {
      return {
        information_extraction_project: {
          key: '',
          prompt: ''
        },
        theme_summarization_project: {
          key: '',
          prompt: ''
        },
      }
    }
  },
  loading: {
    type: Boolean,
    default: false
  },
  noExecute: {
    type: Boolean,
    default: false
  },
  /** 是否展示「选择提示词」区块标题（顶栏已展示时传 false） */
  showSectionHeader: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:prompt', 'execute'])

const engineeringRepeatProjectList = ref([])
const engineeringSubProjectList = ref([])
const promptTreeLoading = ref(false)

// 树形选择器配置
const treeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data) => {
    // 只有 prompt 项（isPrompt: true）可以选择
    // 文件夹和普通节点都不可选择
    return !data.isPrompt
  }
}

/**
 * 获取树节点样式类
 * @param {Object} data 树节点数据
 * @returns {string} 样式类名
 */
const getNodeClass = (data) => {
  if (data.isPrompt) {
    return 'tree-node-prompt'
  }
  if (data.children && data.children.length > 0) {
    return 'tree-node-folder'
  }
  return 'tree-node-disabled'
}

/**
 * 在提示词树中按 id 查找节点
 * @param {Array} nodes 树节点列表
 * @param {string} id 节点 id
 * @returns {Object|null} 匹配节点
 */
const findPromptInTree = (nodes, id) => {
  if (!nodes || !Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (node.id === id && node.isPrompt) {
      return node
    }
    if (node.children && node.children.length > 0) {
      const found = findPromptInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

/**
 * 拉取信息提取与主题归纳提示词树
 * @returns {Promise<void>}
 */
const getPromptTree = async () => {
  promptTreeLoading.value = true
  try {
    const [infoRes, topicRes] = await Promise.all([
      getPromptTreeByFunctionTypeNewAPI('Information_Extraction'),
      getPromptTreeByFunctionTypeNewAPI('Topic_Summarization')
    ])

    const infoData = infoRes?.data
    const topicData = topicRes?.data

    engineeringRepeatProjectList.value = Array.isArray(infoData?.items)
      ? infoData.items
      : []
    engineeringSubProjectList.value = Array.isArray(topicData?.items)
      ? topicData.items
      : []

    const updates = { ...props.prompt }
    let changed = false

    if (
      infoData?.defaultPrompt &&
      !props.prompt.information_extraction_project?.prompt
    ) {
      await nextTick()
      updates.information_extraction_project = {
        key: infoData.defaultPrompt.id,
        prompt: infoData.defaultPrompt.content || ''
      }
      changed = true
    }

    if (
      topicData?.defaultPrompt &&
      !props.prompt.theme_summarization_project?.prompt
    ) {
      await nextTick()
      updates.theme_summarization_project = {
        key: topicData.defaultPrompt.id,
        prompt: topicData.defaultPrompt.content || ''
      }
      changed = true
    }

    if (changed) {
      emit('update:prompt', updates)
    }
  } catch (error) {
    console.error('加载提示词树失败:', error)
    ElMessage.error('加载提示词失败')
  } finally {
    promptTreeLoading.value = false
  }
}

/**
 * 校验提示词是否已填写
 * @returns {boolean} 是否通过
 */
const validateRules = () => {
  const extractionPrompt = (props.prompt.information_extraction_project?.prompt || '').trim()
  const themePrompt = (props.prompt.theme_summarization_project?.prompt || '').trim()
  if (!extractionPrompt) {
    ElMessage.warning('请填写信息提取提示词')
    return false
  }
  if (!themePrompt) {
    ElMessage.warning('请填写主题归纳提示词')
    return false
  }
  return true
}

/**
 * 更新信息提取提示词 key
 * @param {string} value 选中的提示词 id
 */
const updateEngineeringRepeatProjectKey = (value) => {
  if (!value) {
    emit('update:prompt', {
      ...props.prompt,
      information_extraction_project: { key: '', prompt: '' }
    })
    return
  }
  const promptNode = findPromptInTree(engineeringRepeatProjectList.value, value)
  emit('update:prompt', {
    ...props.prompt,
    information_extraction_project: {
      key: value,
      prompt: promptNode?.content || ''
    }
  })
}

/**
 * 更新信息提取提示词内容
 * @param {string} value 提示词文本
 */
const updateEngineeringRepeatProjectPrompt = (value) => {
  emit('update:prompt', {
    ...props.prompt,
    information_extraction_project: {
      ...props.prompt.information_extraction_project,
      prompt: value
    }
  })
}

/**
 * 更新主题归纳提示词 key
 * @param {string} value 选中的提示词 id
 */
const updateEngineeringSubProjectKey = (value) => {
  if (!value) {
    emit('update:prompt', {
      ...props.prompt,
      theme_summarization_project: { key: '', prompt: '' }
    })
    return
  }
  const promptNode = findPromptInTree(engineeringSubProjectList.value, value)
  emit('update:prompt', {
    ...props.prompt,
    theme_summarization_project: {
      key: value,
      prompt: promptNode?.content || ''
    }
  })
}

/**
 * 更新主题归纳提示词内容
 * @param {string} value 提示词文本
 */
const updateEngineeringSubProjectPrompt = (value) => {
  emit('update:prompt', {
    ...props.prompt,
    theme_summarization_project: {
      ...props.prompt.theme_summarization_project,
      prompt: value
    }
  })
}

/**
 * 触发执行
 * @param {'extractOnly'|'extractAndSummarize'} mode 执行模式
 */
const handleExecuteCommand = (mode) => {
  emit('execute', { mode })
}

onMounted(() => {
  getPromptTree()
})

defineExpose({
  validateRules
})
</script>

<style scoped>
.config-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.config-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.config-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0 12px 12px;
}

.config-actions-bottom {
  width: 100%;
}

.prompt-config {
  margin-bottom: 8px;
}

.prompt-config > .field-block + .field-block {
  margin-top: 4px;
}

.field-block {
  margin-bottom: 16px;
}

.field-block:last-child {
  margin-bottom: 0;
}

.field-block > * + * {
  margin-top: 8px;
}

.field-label-col--block {
  display: flex;
  align-items: center;
  width: auto;
  padding-right: 0;
}

.field-label-text {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  line-height: 1.4;
}

.field-required-mark {
  flex-shrink: 0;
  width: 8px;
  margin-right: 2px;
  font-size: 12px;
  line-height: 1;
  color: #f56c6c;
  text-align: center;
}

.field-required-mark--empty {
  visibility: hidden;
}

.field-input-full {
  width: 100%;
}

.ocr-sidebar-footer {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
}

.ocr-footer-btn {
  width: 100%;
  height: 32px;
  min-height: 32px;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.rule-header--section {
  margin-top: 8px;
}

.rule-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.prompt-form-loading-wrap {
  position: relative;
  min-height: 200px;
}

.preserve-whitespace :deep(textarea) {
  white-space: pre-wrap;
}

.tree-node-prompt {
  color: #303133;
}

.tree-node-folder {
  color: #909399;
  font-weight: 500;
}

.tree-node-disabled {
  color: #c0c4cc;
}
</style>
