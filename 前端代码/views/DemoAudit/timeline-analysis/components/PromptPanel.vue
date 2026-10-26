<script setup>
import { ref, nextTick, onMounted, watch } from 'vue'
import { EditPen } from '@element-plus/icons-vue'
import { getPromptTreeByFunctionTypeNewAPI } from '@/api/IcssPlatform/promptManagement.js'

const FUNCTION_TYPE = 'timeline_analysis'

const props = defineProps({
  // 外部回填提示词（任务详情模式：传入历史任务使用的提示词内容）
  initialPrompt: {
    type: String,
    default: ''
  },
  // 外部回填提示词ID（任务详情模式：用于在下拉树中选中对应节点）
  initialPromptId: {
    type: [String, Number],
    default: null
  },
  /** 任务详情只读：禁止修改提示词 */
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:promptId', 'update:promptText'])
const selectedPromptId = ref(null)
const selectedPromptText = ref('')
const promptTreeData = ref([])


// ============ 树配置（el-tree-select 用） ============
const treeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data) => !data.isPrompt
}

const getNodeClass = (data) => {
  if (data.isPrompt) return 'pp-tree-node-prompt'
  if (data.children && data.children.length > 0) return 'pp-tree-node-folder'
  return 'pp-tree-node-disabled'
}

const filterPromptNode = (value, data) => {
  if (!value) return true
  return data.name && data.name.toLowerCase().includes(value.toLowerCase())
}

// ============ 查找提示词 ============
const findPromptInTree = (nodes, id) => {
  if (!nodes || id === null || id === undefined) return null
  const strId = String(id)
  for (const node of nodes) {
    if (String(node.id) === strId && node.isPrompt) return node
    if (node.children && node.children.length > 0) {
      const found = findPromptInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

// ============ 加载提示词树 ============
const getPromptTree = async () => {
  try {
    const res = await getPromptTreeByFunctionTypeNewAPI(FUNCTION_TYPE)
    const data = res.data
    if (!data || !data.items) {
      promptTreeData.value = []
      return
    }
    promptTreeData.value = data.items
    await nextTick()
    // 若外部已回填历史提示词，不进行默认提示词回填
    if (props.initialPrompt || props.initialPromptId) return
    // 自动回填默认提示词
    if (data.defaultPrompt) {
      selectedPromptId.value = data.defaultPrompt.id
      selectedPromptText.value = data.defaultPrompt.content || ''
      emit('update:promptId', data.defaultPrompt.id)
      emit('update:promptText', data.defaultPrompt.content)
    }
  } catch (error) {
    console.error('[时间轴分析] 获取提示词树失败:', error)
    promptTreeData.value = []
  }
}

// 监听外部传入的历史提示词，回填到面板
watch(
  () => props.initialPromptId,
  (id) => {
    if (id === null || id === undefined) return
    // 等待提示词树加载后再尝试选中
    const trySelect = () => {
      const prompt = findPromptInTree(promptTreeData.value, id)
      if (prompt) {
        selectedPromptId.value = prompt.id
        selectedPromptText.value = prompt.content || ''
        emit('update:promptId', prompt.id)
        emit('update:promptText', prompt.content)
      } else if (props.initialPrompt) {
        // 树中找不到对应节点（提示词已被删除等情况），降级为文本回填
        selectedPromptId.value = null
        selectedPromptText.value = props.initialPrompt
        emit('update:promptId', null)
        emit('update:promptText', props.initialPrompt)
      }
    }
    if (promptTreeData.value.length > 0) {
      trySelect()
    } else {
      // 树还未加载，等树加载完毕后选中
      const stop = watch(promptTreeData, (val) => {
        if (val.length > 0) {
          trySelect()
          stop()
        }
      })
    }
  },
  { immediate: true }
)

// 监听外部传入的历史提示词，回填到面板（无 id 时的兜底）
watch(
  () => props.initialPrompt,
  (val) => {
    // 有 id 时由 initialPromptId 的 watch 处理，此处仅处理纯文本情况
    if (props.initialPromptId) return
    if (val) {
      selectedPromptId.value = null
      selectedPromptText.value = val
      emit('update:promptId', null)
      emit('update:promptText', val)
    }
  },
  { immediate: true }
)

// ============ 下拉树选中 ============
const handlePromptSelect = (value) => {
  if (!value) {
    selectedPromptText.value = ''
    emit('update:promptId', null)
    emit('update:promptText', '')
    return
  }
  const prompt = findPromptInTree(promptTreeData.value, value)
  if (prompt && prompt.content) {
    selectedPromptText.value = prompt.content
    emit('update:promptId', value)
    emit('update:promptText', prompt.content)
  }
}

// ============ 提示词文本手动输入 ============
const handlePromptTextInput = (val) => {
  // 用户手动修改文本时，清除选中的提示词 ID（因为内容已与模板不一致）
  selectedPromptId.value = null
  emit('update:promptId', null)
  emit('update:promptText', val)
}

// ============ 编辑弹窗 ============
const viewDialogVisible = ref(false)
const editingText = ref('')

const handleView = () => {
  editingText.value = selectedPromptText.value
  viewDialogVisible.value = true
}

const handleEditConfirm = () => {
  selectedPromptId.value = null
  selectedPromptText.value = editingText.value
  emit('update:promptId', null)
  emit('update:promptText', editingText.value)
  viewDialogVisible.value = false
}


onMounted(() => {
  getPromptTree()
})
</script>

<template>
  <aside class="pp-panel">
    <div class="pp-header ocr-column-head">
      <el-icon><EditPen /></el-icon>
      <span class="pp-header-title">提示词</span>
    </div>
    <div class="pp-body">
      <!-- 提示词模板选择 -->
      <div class="pp-select-row">
        <el-tree-select
          v-model="selectedPromptId"
          @change="handlePromptSelect"
          :data="promptTreeData"
          placeholder="选择模板"
          :props="treeProps"
          :render-after-expand="false"
          check-strictly
          :check-on-click-node="true"
          filterable
          :filter-node-method="filterPromptNode"
          :disabled="readonly"
          class="pp-tree-select"
          size="small"
        >
          <template #default="{ data }">
            <span :class="getNodeClass(data)">{{ data.name }}</span>
          </template>
        </el-tree-select>
      </div>
      <!-- 提示词内容（可编辑） -->
      <div class="pp-preview-wrapper">
        <el-input
          v-model="selectedPromptText"
          type="textarea"
          placeholder="未设置提示词"
          resize="none"
          class="pp-textarea"
          :readonly="readonly"
          @input="handlePromptTextInput"
        />
        <el-button
          v-if="!readonly"
          type="primary"
          size="small"
          class="pp-view-btn"
          :disabled="!selectedPromptText"
          @click="handleView"
        >编辑</el-button>
      </div>
    </div>
  </aside>

  <!-- 编辑提示词弹窗 -->
  <el-dialog
    v-model="viewDialogVisible"
    title="编辑提示词"
    width="640px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-input
      v-model="editingText"
      type="textarea"
      :rows="16"
      resize="none"
      placeholder="请输入提示词内容"
      class="pp-edit-textarea"
    />
    <template #footer>
      <el-button @click="viewDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleEditConfirm">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.pp-panel {
  width: 100%;
  flex-shrink: 0;
  background: var(--sd-canvas, #ffffff);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.pp-header {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  flex-shrink: 0;
  background: var(--sd-canvas, #ffffff);
}

.pp-header > * + * {
  margin-left: 6px;
}

.pp-header-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.pp-header .el-icon {
  font-size: 14px;
  color: var(--sd-primary, #195fb4);
}

.pp-body {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.pp-body > * + * {
  margin-top: 10px;
}

.pp-select-row {
  flex-shrink: 0;
}

.pp-tree-select {
  width: 100%;
}

/* 提示词内容区 */
.pp-preview-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.pp-textarea {
  flex: 1;
  min-height: 0;
}

.pp-view-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  z-index: 1;
}

.pp-textarea :deep(.el-textarea) {
  height: 100%;
}

.pp-textarea :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 200px;
  box-sizing: border-box;
  padding-bottom: 36px;
  font-size: 12px;
  line-height: 1.5;
  color: #606266;
  font-family: inherit;
  resize: none;
  border-radius: 4px;
  overflow-x: hidden;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-word;
}

:deep(.pp-tree-node-folder) {
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
}

:deep(.pp-tree-node-prompt) {
  color: #67c23a;
  font-size: 12px;
  padding-left: 4px;
}

:deep(.pp-tree-node-prompt)::before {
  content: '📄';
  margin-right: 4px;
}

:deep(.pp-tree-node-disabled) {
  color: #c0c4cc;
}

/* 编辑弹窗 */
.pp-edit-textarea :deep(.el-textarea__inner) {
  font-size: 13px;
  line-height: 1.6;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #303133;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-word;
}
</style>
