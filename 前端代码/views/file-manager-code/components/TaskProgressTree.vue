<template>
  <div class="task-progress-tree">
    <div class="progress-header">
      <div class="progress-title">
        <el-icon class="loading-icon" v-if="showCancel"><Loading /></el-icon>
        <span>{{ title }}</span>
      </div>
      <div class="progress-time">{{ elapsedTime }}</div>
    </div>
    
    <div class="progress-content">
      <el-tree
        :data="treeData"
        :props="treeProps"
        default-expand-all
        :expand-on-click-node="false"
        node-key="id"
      >
        <template #default="{ data }">
          <div class="tree-node-wrapper">
            <div class="node-content">
              <el-icon class="node-icon" :class="getNodeIconClass(data)">
                <component :is="getNodeIcon(data)" />
              </el-icon>
              <span class="node-label">{{ data.label }}</span>
              <el-tag 
                :type="getStatusTagType(data.status)" 
                size="small"
                class="node-status-tag"
              >
                {{ getStatusText(data.status) }}
              </el-tag>
            </div>
            <div 
              v-if="data.error_message" 
              class="node-error"
              :title="data.error_message"
            >
              <el-icon><WarningFilled /></el-icon>
              <span>{{ data.error_message }}</span>
            </div>
          </div>
        </template>
      </el-tree>
    </div>

    <el-tooltip content="后续可在任务中心查看进度" position="bottom">
      <el-button v-if="showCancel" type="primary" @click="handleCancel">关闭</el-button>
    </el-tooltip>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Loading, Document, FolderOpened, SuccessFilled, Loading as LoadingIcon, WarningFilled, CircleCloseFilled, Clock } from '@element-plus/icons-vue'

const props = defineProps({
  title: {
    type: String,
    default: '任务执行中...'
  },
  elapsedTime: {
    type: String,
    default: '0.0s'
  },
  runtimeNodes: {
    type: Array,
    default: () => []
  },
  showCancel: {
    type: Boolean,
    default: true
  }
})

const treeProps = {
  children: 'children',
  label: 'label'
}

// 将后端的 runtime_nodes 转换为树形数据
const treeData = computed(() => {
  if (!props.runtimeNodes || props.runtimeNodes.length === 0) {
    return [{
      id: 'loading',
      label: '正在初始化任务...',
      status: 1,
      node_type: 'loading'
    }]
  }
  
  return convertNodes(props.runtimeNodes)
})

// 递归转换节点
const convertNodes = (nodes) => {
  if (!Array.isArray(nodes)) return []
  
  return nodes.map((node, index) => {
    const converted = {
      id: node.key || node.id || `node-${index}`,
      label: node.name || node.label || node.step_name || '未命名节点',
      status: node.status || 1,
      node_type: node.node_type || 'unknown',
      error_message: node.error_message || node.ERROR_MESSAGE || null,
      children: node.children ? convertNodes(node.children) : []
    }
    return converted
  })
}

// 获取节点图标
const getNodeIcon = (data) => {
  if (data.node_type === 'loading') return LoadingIcon
  if (data.node_type === 'task_group') return FolderOpened
  if (data.node_type === 'file_item') return Document
  
  const status = Number(data.status)
  if (status === 0) return Clock
  if (status === 2) return SuccessFilled
  if (status === 3) return CircleCloseFilled
  return LoadingIcon
}

// 获取节点图标类名
const getNodeIconClass = (data) => {
  const status = Number(data.status)
  if (status === 0) return 'icon-pending'
  if (status === 1) return 'icon-processing'
  if (status === 2) return 'icon-success'
  if (status === 3) return 'icon-error'
  return ''
}

// 获取状态标签类型
const getStatusTagType = (status) => {
  const s = Number(status)
  if (s === 0) return 'info'
  if (s === 1) return 'warning'
  if (s === 2) return 'success'
  if (s === 3) return 'danger'
  return 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const s = Number(status)
  if (s === 0) return '待开始'
  if (s === 1) return '进行中'
  if (s === 2) return '已完成'
  if (s === 3) return '失败'
  return '未知'
}

const emit = defineEmits(['cancel'])

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.task-progress-tree {
  width: 100%;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
  background: #f5f7fa;
}

.progress-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.loading-icon {
  animation: rotate 1s linear infinite;
  color: #409eff;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.progress-time {
  font-size: 14px;
  color: #606266;
  font-family: monospace;
}

.progress-content {
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.tree-node-wrapper {
  flex: 1;
  width: 100%;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.node-icon {
  font-size: 16px;
}

.icon-pending {
  color: #909399;
}

.icon-processing {
  color: #e6a23c;
  animation: pulse 1.5s ease-in-out infinite;
}

.icon-success {
  color: #67c23a;
}

.icon-error {
  color: #f56c6c;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.node-label {
  flex: 1;
  font-size: 14px;
  color: #303133;
}

.node-status-tag {
  margin-left: 8px;
}

.node-error {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 4px 8px;
  background: #fef0f0;
  border-left: 3px solid #f56c6c;
  font-size: 12px;
  color: #f56c6c;
  border-radius: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-error .el-icon {
  flex-shrink: 0;
}

.node-error span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-tree-node__content) {
  height: auto;
  min-height: 32px;
  padding: 4px 0;
}

:deep(.el-tree-node__children) {
  overflow: visible;
}
</style>
