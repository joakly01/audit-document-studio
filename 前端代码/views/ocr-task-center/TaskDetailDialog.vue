<template>
  <el-dialog
    v-model="dialogVisible"
    title="任务详情"
    width="800px"
    :close-on-click-modal="true"
    @close="handleClose"
  >
    <div v-if="task" class="task-detail-content">
      <!-- 基本信息 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span>基本信息</span>
          </div>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="任务ID">{{ task.task_id }}</el-descriptions-item>
          <el-descriptions-item label="任务名称">{{ task.task_name }}</el-descriptions-item>
          <el-descriptions-item label="文件个数">{{ task.file_count }} 个</el-descriptions-item>
          <el-descriptions-item label="调用工具">{{ task.agent_name }}</el-descriptions-item>
          <el-descriptions-item label="调用模式">
            <el-tag v-if="task.input_params.mode === 'agent'" size="small" type="info">智能体调用</el-tag>
            <el-tag v-else-if="task.input_params.mode === 'prompt'" size="small" type="primary">Prompt模式</el-tag>
            <el-tag v-else-if="task.input_params.mode === 'field'" size="small" type="success">字段模式</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="输入参数">
            <div v-if="task.input_params.mode === 'agent'">{{ task.input_params.content }}</div>
            <div v-else-if="task.input_params.mode === 'prompt'" class="input-params-display">
              {{ task.input_params.content }}
            </div>
            <div v-else-if="task.input_params.mode === 'field'">{{ task.input_params.content }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(task.status)" size="small">
              {{ getTaskStatusText(task.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="任务状态">
            <div class="progress-info">
              <el-icon v-if="task.status === 'processing'" class="is-loading loading-icon">
                <Loading />
              </el-icon>
              <el-tag :type="getStatusType(task.status)" size="small">
                {{ getTaskStatusText(task.status) }}
              </el-tag>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ task.created_at }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ task.updated_at }}</el-descriptions-item>
          <el-descriptions-item v-if="task.started_at" label="开始时间">{{ task.started_at }}</el-descriptions-item>
          <el-descriptions-item v-if="task.completed_at" label="完成时间">{{ task.completed_at }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 文件列表 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span>文件列表</span>
          </div>
        </template>
        <el-table :data="task.files || []" border size="small" style="width: 100%">
          <el-table-column prop="file_name" label="文件名" min-width="200" />
          <el-table-column prop="file_type" label="文件类型" width="100">
            <template #default="scope">
              <el-tag :type="getFileTypeTagType(scope.row.file_type)" size="small">
                {{ scope.row.file_type.toUpperCase() }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="file_size" label="文件大小" width="120">
            <template #default="scope">
              {{ formatFileSize(scope.row.file_size) }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="处理状态" width="100">
            <template #default="scope">
              <el-tag :type="getFileStatusType(scope.row.status)" size="small">
                {{ getFileStatusText(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="progress" label="进度" width="100" />
        </el-table>
      </el-card>

      <!-- 错误信息（仅失败任务显示） -->
      <el-card v-if="task.status === 'failed' && task.error_message" shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span>错误信息</span>
          </div>
        </template>
        <el-alert
          :title="task.error_message"
          type="error"
          :closable="false"
          show-icon
        />
        <div class="error-actions" style="margin-top: 16px">
          <el-button type="warning" size="small" @click="handleRetry">重试任务</el-button>
        </div>
      </el-card>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { getStatusType, formatFileSize } from './mockTasks.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  task: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'refresh'])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 文件类型标签类型
const getFileTypeTagType = (fileType) => {
  const typeMap = {
    pdf: 'danger',
    docx: 'primary',
    doc: 'primary',
    xlsx: 'success',
    xls: 'success',
    pptx: 'warning',
    ppt: 'warning',
    txt: 'info',
    md: 'info'
  }
  return typeMap[fileType] || 'info'
}


// 文件状态类型
const getFileStatusType = (status) => {
  const typeMap = {
    completed: 'success',
    processing: 'primary',
    pending: 'info',
    failed: 'danger'
  }
  return typeMap[status] || 'info'
}

// 文件状态文本
const getFileStatusText = (status) => {
  const textMap = {
    completed: '已完成',
    processing: '进行中',
    pending: '未开始',
    failed: '失败'
  }
  return textMap[status] || status
}

// 任务状态文本（四个状态：等待中、进行中、已完成、失败）
const getTaskStatusText = (status) => {
  const textMap = {
    pending: '等待中',
    processing: '进行中',
    completed: '已完成',
    failed: '失败'
  }
  return textMap[status] || status
}

// 方法
const handleClose = () => {
  dialogVisible.value = false
}

const handleRetry = () => {
  ElMessage.info('重试任务功能（演示）')
  emit('refresh')
}
</script>

<style scoped lang="scss">
.task-detail-content {
  .info-card {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    .card-header {
      font-weight: 600;
      font-size: 16px;
    }
  }

  .progress-info {
    display: flex;
    align-items: center;
    gap: 8px;

    .loading-icon {
      font-size: 16px;
      color: #409eff;
    }
  }


  .error-actions {
    margin-top: 16px;
  }

  .input-params-display {
    word-break: break-word;
    white-space: pre-wrap;
    max-height: 100px;
    overflow-y: auto;
  }
}

.dialog-footer {
  text-align: right;
}
</style>


