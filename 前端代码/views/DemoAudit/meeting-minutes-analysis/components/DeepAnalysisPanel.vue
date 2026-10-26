<template>
  <div class="deep-analysis-panel">
    <!-- 深度问答卡片 -->
    <div class="card qa-card">
      <div class="card-header">
        <el-button type="primary" size="small" @click="saveConversation">保存</el-button>
        <el-button type="primary" size="small" @click="clearConversation">清空</el-button>
      </div>
      <div class="card-body">
        <!-- 有分析数据时显示问答面板 -->
        <div v-if="hasAnalysisData" class="qa-content">
          <MeetingMinutesQAPanel
            ref="qaPanelRef"
            :analysis-id="analysisId || ''"
            :cluster-version-id="clusterVersionId"
          />
        </div>
        <!-- 无分析数据时显示空状态 -->
        <div v-else class="empty-state">
          <div class="empty-icon-wrapper">
            <el-icon class="empty-icon"><ChatDotRound /></el-icon>
          </div>
          <div class="empty-text">请先在「常规分析」中完成会议纪要分析</div>
          <el-button type="primary" size="small" @click="$emit('back')">
            返回常规分析
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ChatDotRound } from '@element-plus/icons-vue'
import MeetingMinutesQAPanel from './MeetingMinutesQAPanel.vue'

const props = defineProps({
  analysisId: {
    type: String,
    default: ''
  },
  clusterVersionId: {
    type: String,
    default: ''
  },
  hasAnalysisData: {
    type: Boolean,
    default: false
  }
})

defineEmits(['back'])

const qaPanelRef = ref(null)

const saveConversation = () => {
  if (qaPanelRef.value) {
    qaPanelRef.value.saveConversation()
  }
}

const clearConversation = () => {
  if (qaPanelRef.value) {
    qaPanelRef.value.clearConversation()
  }
}
</script>

<style scoped lang="scss">
.deep-analysis-panel {
  height: 100%;
  padding: 12px;
  overflow: hidden;
}

.card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 14px;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
  font-size: 13px;
  color: #409eff;
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .el-icon {
    font-size: 14px;
    color: #409eff;
  }
}

.card-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.qa-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  :deep(.qa-panel) {
    height: 100%;
    border-radius: 0;
    box-shadow: none;
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}

.empty-icon-wrapper {
  width: 80px;
  height: 80px;
  background: #f5f7fa;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  font-size: 36px;
  color: #c0c4cc;
}

.empty-text {
  font-size: 14px;
  color: #909399;
  text-align: center;
}
</style>
