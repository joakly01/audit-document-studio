<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, CircleClose } from '@element-plus/icons-vue'
import TaskRuntimeProgressTree from '@/views/file-manager-code/components/contract/TaskRuntimeProgressTree.vue'
import { getTaskSchedulesAPI } from '@/api/task.js'

const PROGRESS_POLL_INTERVAL = 2000
const MAX_PROGRESS_POLL_MS = 10 * 60 * 1000

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  taskUuid: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:visible', 'completed', 'failed', 'return-to-task-center'])

// ============ 内部状态 ============
const analysisStatus = ref('')  // '' | 'COMPLETED' | 'FAILED'
const runtimeNodes = ref([])
let pollTimer = null
let pollStart = 0

// ============ 轮询逻辑 ============
const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const pollOnce = async (taskUuid) => {
  if (Date.now() - pollStart > MAX_PROGRESS_POLL_MS) {
    stopPolling()
    analysisStatus.value = 'FAILED'
    emit('failed')
    return
  }
  try {
    const res = await getTaskSchedulesAPI(taskUuid, { prefer_runtime: true })
    if (res.code !== 200 || !res.data) return
    const td = res.data
    const nodes =
      Array.isArray(td.runtime_nodes) && td.runtime_nodes.length
        ? td.runtime_nodes
        : Array.isArray(td.step_tree)
        ? td.step_tree
        : []
    runtimeNodes.value = nodes
    if (td.task_status === 2) {
      stopPolling()
      analysisStatus.value = 'COMPLETED'
    } else if (td.task_status === 3) {
      stopPolling()
      analysisStatus.value = 'FAILED'
      emit('failed')
    }
  } catch (e) {
    console.error('[时间轴分析] 进度轮询失败:', e)
  }
}

const startPolling = (taskUuid) => {
  stopPolling()
  pollStart = Date.now()
  runtimeNodes.value = []
  analysisStatus.value = ''
  pollOnce(taskUuid)
  pollTimer = setInterval(() => pollOnce(taskUuid), PROGRESS_POLL_INTERVAL)
}

// taskUuid 变化时自动重启轮询
watch(
  () => props.taskUuid,
  (newVal) => {
    if (newVal && props.visible) {
      startPolling(newVal)
    }
  }
)

// visible 打开且有 taskUuid 时启动轮询
watch(
  () => props.visible,
  (val) => {
    if (val && props.taskUuid) {
      startPolling(props.taskUuid)
    } else if (!val) {
      stopPolling()
    }
  }
)

// ============ 操作 ============
const handleConfirm = () => {
  emit('update:visible', false)
  emit('completed', props.taskUuid)
}

const handleClose = () => {
  emit('update:visible', false)
  stopPolling()
  if (analysisStatus.value === 'FAILED') {
    ElMessage.error('分析失败，请稍后重试')
  }
}

/**
 * 返回任务中心列表（关闭进度弹窗，任务继续在后台执行）
 * @returns {void}
 */
const handleReturnToTaskCenter = () => {
  emit('update:visible', false)
  emit('return-to-task-center')
}

const handleDialogClosed = () => {
  stopPolling()
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="分析进度"
    width="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="!!analysisStatus"
    @update:model-value="(val) => emit('update:visible', val)"
    @closed="handleDialogClosed"
  >
    <div class="pd-body">
      <!-- 失败横幅 -->
      <div v-if="analysisStatus === 'FAILED'" class="pd-error-banner">
        <el-icon><CircleClose /></el-icon>
        <span>分析失败，请稍后重试</span>
      </div>
      <!-- 初始化中 -->
      <div v-if="!runtimeNodes.length && !analysisStatus" class="pd-loading-hint">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在初始化分析任务...</span>
      </div>
      <!-- 进度节点树 -->
      <el-scrollbar v-if="runtimeNodes.length" max-height="360px">
        <TaskRuntimeProgressTree :nodes="runtimeNodes" />
      </el-scrollbar>
    </div>

    <template #footer>
      <div class="pd-footer">
        <template v-if="!analysisStatus">
          <span class="pd-tip">分析过程中请勿关闭页面</span>
          <el-button type="primary" plain @click="handleReturnToTaskCenter">返回任务中心</el-button>
        </template>
        <el-button
          v-if="analysisStatus === 'COMPLETED'"
          type="primary"
          @click="handleConfirm"
        >
          查看结果
        </el-button>
        <el-button v-if="analysisStatus === 'FAILED'" @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.pd-body {
  padding: 4px 0;
}

.pd-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
}

.pd-footer > .pd-tip + .el-button {
  margin-left: 12px;
}

.pd-tip {
  margin-right: auto;
  font-size: 12px;
  color: #909399;
}

.pd-error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 6px;
  color: #f56c6c;
  margin-bottom: 16px;
  font-size: 14px;
}

.pd-loading-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
  color: #909399;
  font-size: 14px;
}
</style>
