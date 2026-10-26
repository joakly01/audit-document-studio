<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { timelineBatchExecuteByFilterAPI } from '@/api/IcssPlatform/timelineAnalysis.js'
import { buildTimelineBatchExecutePayload } from '@/views/file-manager-code/composables/buildTimelineBatchExecutePayload.js'
import {
  runBatchExecuteWithTimeoutNav,
  isBatchExecuteRequestAborted
} from '@/views/file-manager-code/composables/batchExecuteTimeoutNav.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  defaultTaskName: {
    type: String,
    default: ''
  },
  /** 左侧栏执行上下文（含 files / folders 树） */
  sidebarContext: {
    type: Object,
    default: () => ({})
  },
  promptId: {
    type: [Number, String],
    default: null
  },
  promptText: {
    type: String,
    default: ''
  },
  toolLabel: {
    type: String,
    default: '时间轴分析'
  },
  /** 执行时需排除的前端待删文件 */
  deletedFiles: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:visible', 'taskCreated'])

const taskNameInput = ref('')
const taskRemarkInput = ref('')
const isTaskCreating = ref(false)
/** 批量创建取消控制器 */
let activeBatchExecuteAbortController = null

watch(
  () => props.visible,
  (val) => {
    if (val) {
      taskNameInput.value = props.defaultTaskName || ''
      taskRemarkInput.value = ''
    } else if (activeBatchExecuteAbortController) {
      try {
        activeBatchExecuteAbortController.abort()
      } catch (error) {
        console.warn('[时间轴分析] 关闭弹窗取消 BatchExecute 失败:', error)
      }
      activeBatchExecuteAbortController = null
    }
  }
)

/**
 * 确认创建：调用 BatchExecuteByFilter（文件+文件夹混合提交）
 * @returns {Promise<void>}
 */
const handleConfirm = async () => {
  if (!taskNameInput.value.trim()) {
    ElMessage.warning('请输入任务名称')
    return
  }

  isTaskCreating.value = true
  activeBatchExecuteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null

  const taskName = taskNameInput.value.trim()
  const taskRemark = taskRemarkInput.value.trim()

  try {
    const taskData = buildTimelineBatchExecutePayload({
      taskName,
      taskRemark,
      sidebarContext: props.sidebarContext || {},
      prompt: props.promptText || null,
      promptId: props.promptId,
      deletedFiles: Array.isArray(props.deletedFiles) ? props.deletedFiles : []
    })

    await runBatchExecuteWithTimeoutNav({
      taskName,
      requestFn: () => timelineBatchExecuteByFilterAPI(taskData, {
        signal: activeBatchExecuteAbortController ? activeBatchExecuteAbortController.signal : undefined
      }),
      openTaskCenter: () => {
        emit('update:visible', false)
      },
      onError: (error) => {
        if (isBatchExecuteRequestAborted(error)) return
        ElMessage.error(error?.message || '任务创建失败，请重试')
      },
      onResponse: (response, { timeoutFallbackTriggered }) => {
        if (response?.code !== 200 && response?.code !== 201) {
          if (!timeoutFallbackTriggered) {
            ElMessage.error(response?.message || '任务创建失败，请重试')
          }
          return
        }

        const taskUuid =
          response?.data?.analysis_id ||
          response?.data?.task_uuid ||
          response?.analysis_id ||
          response?.task_uuid ||
          ''
        if (!taskUuid) {
          if (!timeoutFallbackTriggered) {
            ElMessage.error('创建任务成功但未返回 analysis_id / task_uuid')
          }
          return
        }

        emit('update:visible', false)
        emit('taskCreated', taskUuid, taskName)
      }
    })
  } catch (error) {
    if (!isBatchExecuteRequestAborted(error)) {
      console.error('[时间轴分析] BatchExecute 失败:', error)
      ElMessage.error(error?.message || '任务创建失败，请重试')
    }
  } finally {
    isTaskCreating.value = false
    activeBatchExecuteAbortController = null
  }
}

/**
 * 取消创建任务弹窗
 * @returns {void}
 */
const handleCancel = () => {
  emit('update:visible', false)
}
</script>

<template>
  <!-- 创建任务弹窗 -->
  <el-dialog
    :model-value="visible"
    title="创建分析任务"
    width="480px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(val) => emit('update:visible', val)"
  >
    <el-form label-width="80px">
      <el-form-item label="任务名称">
        <el-input
          v-model="taskNameInput"
          placeholder="请输入任务名称"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="任务描述">
        <el-input
          v-model="taskRemarkInput"
          type="textarea"
          :rows="3"
          placeholder="请输入任务描述（可选）"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="isTaskCreating" @click="handleConfirm">
        创建并执行
      </el-button>
    </template>
  </el-dialog>
</template>
