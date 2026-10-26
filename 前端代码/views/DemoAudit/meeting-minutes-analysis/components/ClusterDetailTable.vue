<template>
  <div class="cluster-detail-table">
    <!-- 表格 -->
    <el-table
      ref="tableRef"
      :data="detailTableData"
      border
      style="width: 100%"
      size="small"
      height="100%"
      :show-header="true"
      stripe
      highlight-current-row
      v-loading="isAnalyzing"
      @row-click="handleRowClick"
    >
      <el-table-column type="index" label="序号" width="50" fixed="left" />
      <el-table-column prop="meetingName" label="会议名称" width="140" fixed="left" show-overflow-tooltip resizable>
        <template #default="{ row }">
          <span class="meeting-name-link">{{ row.meetingName }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="meetingDate" label="会议日期" width="110" resizable />
      <el-table-column prop="topicName" label="议题名称" width="140" show-overflow-tooltip resizable />
      <el-table-column prop="topicContent" label="议题内容" width="180" show-overflow-tooltip resizable />
      <el-table-column prop="money" label="涉及金额(万元)" width="120" resizable>
        <template #default="{ row }">
          {{ formatTopicMoney(row.money) }}
        </template>
      </el-table-column>
      <el-table-column prop="attendees" label="参会人员" width="120" show-overflow-tooltip resizable>
        <template #default="{ row }">
          {{ formatAttendees(row.attendees) }}
        </template>
      </el-table-column>
      <el-table-column prop="observers" label="列席人员" width="120" show-overflow-tooltip resizable>
        <template #default="{ row }">
          {{ formatAttendees(row.observers) }}
        </template>
      </el-table-column>
      <!-- 动态字段列 -->
      <el-table-column
        v-for="field in dynamicTopicColumns"
        :key="field.key"
        :prop="field.key"
        :label="field.label"
        width="120"
        show-overflow-tooltip
        resizable
      >
        <template #default="{ row }">
          {{ formatTopicFieldValue(field.key, row[field.key]) }}
        </template>
      </el-table-column>
      <el-table-column prop="sourceFile" label="源文件" width="140" show-overflow-tooltip resizable />
      <template #empty>
        <div class="table-empty">
          <el-icon class="table-empty-icon"><Document /></el-icon>
          <div class="table-empty-text">请选择聚类项查看详情</div>
        </div>
      </template>
    </el-table>

    <!-- 议题详情弹窗 -->
    <TopicDetailDialog
      v-model="dialogVisible"
      :topic-data="currentTopic"
      @close="handleDialogClose"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Document } from '@element-plus/icons-vue'
import TopicDetailDialog from './TopicDetailDialog.vue'
import {
  getDynamicTopicColumns,
  formatTopicFieldValue,
} from '../topicFieldUtils.js'

const props = defineProps({
  detailTableData: {
    type: Array,
    default: () => []
  },
  isAnalyzing: {
    type: Boolean,
    default: false
  },
  extractFields: {
    type: Object,
    default: null
  }
})

const tableRef = ref(null)
const dialogVisible = ref(false)
const currentTopic = ref(null)

// 计算动态议题字段列（排除默认字段，表头中文化）
const dynamicTopicColumns = computed(() => getDynamicTopicColumns(props.extractFields))

const handleRowClick = (row) => {
  currentTopic.value = {
    topicName: row.topicName,
    meetingName: row.meetingName,
    meetingDate: row.meetingDate,
    topicContent: row.topicContent,
    money: row.money,
    attendees: row.attendees,
    observers: row.observers,
    sourceFile: row.sourceFile,
    sourceDocumentId: row.sourceDocumentId,
  }
  dialogVisible.value = true
}

const handleDialogClose = () => {
  dialogVisible.value = false
}

const formatTopicMoney = (moneyStr) => {
  if (!moneyStr) return ''

  const parts = String(moneyStr)
    .split('|')
    .map((v) => v.trim())
    .filter((v) => v)

  const amounts = parts
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n))

  if (amounts.length === 0) return ''
  if (amounts.length === 1) return `${amounts[0]}万元`

  const total = amounts.reduce((sum, v) => sum + v, 0)
  return `${total}万元 (${amounts.join('+')})`
}

const formatAttendees = (attendees) => {
  if (!attendees) return ''
  if (Array.isArray(attendees)) {
    return attendees.length > 0 ? attendees.join('|') : ''
  }
  if (typeof attendees === 'string' && attendees.startsWith('[')) {
    try {
      const parsed = JSON.parse(attendees)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.join('|')
      }
    } catch {
      // 解析失败，继续处理原字符串
    }
  }
  return String(attendees).trim()
}
</script>

<style scoped lang="scss">
.cluster-detail-table {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

:deep(.el-table) {
  background-color: #ffffff;
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.el-table__inner-wrapper) {
  flex: 1;
  min-height: 0;
}

:deep(.el-table__body-wrapper) {
  flex: 1;
  overflow-y: auto !important;
}

:deep(.el-table th.el-table__cell) {
  background-color: #f5f7fa;
  color: #606266;
  font-weight: 600;
  font-size: 12px;
  padding: 0;
  height: 28px;
  white-space: nowrap;
  overflow: hidden;
  border-right: 1px solid #ebeef5;
}

:deep(.el-table th.el-table__cell .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
  line-height: 28px;
}

:deep(.el-table td.el-table__cell) {
  color: #606266;
  font-size: 12px;
  padding: 6px 8px;
  height: 36px;
}

:deep(.el-table td.el-table__cell .cell) {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

:deep(.el-table .el-table__row) {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

:deep(.el-table .el-table__row:hover) {
  background-color: #f0f9ff !important;
}

:deep(.el-table .el-table__row.current-row) {
  background-color: #e6f7ff !important;
}

:deep(.el-table--border .el-table__cell) {
  border-color: #ebeef5;
}

:deep(.el-table__empty-block) {
  background-color: #ffffff;
}

.meeting-name-link {
  color: #409eff;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #909399;
}

.table-empty-icon {
  font-size: 48px;
  color: #dcdfe6;
  margin-bottom: 12px;
}

.table-empty-text {
  font-size: 13px;
  color: #909399;
}
</style>
