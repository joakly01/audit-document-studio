<template>
  <div class="cluster-result-panel">
    <!-- 议题聚类卡片 -->
    <div class="cluster-card">
      <div class="cluster-card-header">
        <div class="header-left">
          <el-icon><Calendar /></el-icon>
          <span>议题聚类</span>
        </div>
        <div class="header-center">
          <el-button
            v-if="showQaButton"
            type="primary"
            size="small"
            class="qa-header-btn"
            @click.stop="emit('open-qa')"
          >
            深度问答
          </el-button>
        </div>
        <el-button
          link
          size="small"
          class="sort-btn"
          @click.stop="toggleSort"
        >
          <el-icon><Sort /></el-icon>
          {{ sortOrder === 'desc' ? '数量↓' : '数量↑' }}
        </el-button>
      </div>
      <div class="cluster-card-body">
        <!-- 分析中状态 -->
        <div v-if="isAnalyzing" class="analyzing-state">
          <el-icon class="analyzing-icon is-loading"><Loading /></el-icon>
          <div class="analyzing-text">正在分析会议纪要...</div>
        </div>
        <!-- 聚类列表 -->
        <div v-else-if="clusters.length > 0" class="cluster-list" ref="clusterListRef">
          <div
            v-for="item in sortedClusters"
            :key="item.originalIndex"
            :ref="el => setClusterItemRef(el, item.originalIndex)"
            :class="['cluster-item', { 'cluster-item-active': selectedClusterIndex === item.originalIndex }]"
            @click="handleClusterClick(item.originalIndex)"
          >
            <div class="cluster-icon" :style="{ backgroundColor: item.color }"></div>
            <div class="cluster-content">
              <div class="cluster-name">{{ item.name }}</div>
              <div class="cluster-count">{{ item.countText }}</div>
            </div>
            <el-icon class="expand-icon"><Right /></el-icon>
          </div>
        </div>
        <div v-else class="empty-cluster">
          <el-icon class="empty-cluster-icon"><Document /></el-icon>
          <div class="empty-cluster-text">请上传文件并点击「立即执行」开始分析</div>
        </div>
      </div>
    </div>

    <!-- 聚类详情卡片 -->
    <div class="detail-card">
      <div class="detail-card-header">
        <el-icon><Document /></el-icon>
        <span>聚类详情</span>
      </div>
      <div class="detail-card-body">
        <!-- 表格卡片 -->
        <div class="table-card">
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
            <el-table-column type="index" label="序号" width="30" fixed="left"/>
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
        </div>
      </div>
    </div>
  </div>

  <TopicDetailDialog
    v-model="dialogVisible"
    :topic-data="currentTopic"
    @close="handleDialogClose"
  />
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Calendar, Right, Document, Loading, Sort } from '@element-plus/icons-vue'
import TopicDetailDialog from './TopicDetailDialog.vue'
import {
  getDynamicTopicColumns,
  formatTopicFieldValue,
} from '../topicFieldUtils.js'

const props = defineProps({
  clusters: {
    type: Array,
    default: () => [],
  },
  selectedClusterIndex: {
    type: Number,
    default: null,
  },
  detailTableData: {
    type: Array,
    default: () => [],
  },
  isAnalyzing: {
    type: Boolean,
    default: false,
  },
  extractFields: {
    type: Object,
    default: null,
  },
  showQaButton: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select-cluster', 'open-qa'])

// 排序方向：desc=议题数量从多到少（默认），asc=从少到多
const sortOrder = ref('desc')

const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
}

// 带原始 index 的排序后聚类列表
const sortedClusters = computed(() => {
  const withIndex = props.clusters.map((c, i) => ({ ...c, originalIndex: i }))
  return withIndex.sort((a, b) =>
    sortOrder.value === 'desc' ? b.count - a.count : a.count - b.count
  )
})

const tableRef = ref(null)
const selectedRow = ref(null)
const dialogVisible = ref(false)
const currentTopic = ref(null)

// 聚类列表容器引用
const clusterListRef = ref(null)
// 聚类条目 DOM 引用映射（key = originalIndex）
const clusterItemRefs = ref({})

const setClusterItemRef = (el, originalIndex) => {
  if (el) {
    clusterItemRefs.value[originalIndex] = el
  }
}

// 监听选中聚类变化，自动滚动到选中项
watch(() => props.selectedClusterIndex, (newIndex) => {
  if (newIndex === null || newIndex === undefined) return
  nextTick(() => {
    const listEl = clusterListRef.value
    const itemEl = clusterItemRefs.value[newIndex]
    if (listEl && itemEl) {
      // 计算 item 相对于可滚动容器顶部的偏移
      const listRect = listEl.getBoundingClientRect()
      const itemRect = itemEl.getBoundingClientRect()
      const scrollTarget = listEl.scrollTop + (itemRect.top - listRect.top) - 8
      listEl.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth'
      })
    }
  })
})

// 计算动态议题字段列（排除默认字段，表头中文化）
const dynamicTopicColumns = computed(() => getDynamicTopicColumns(props.extractFields))

const handleClusterClick = (index) => {
  emit('select-cluster', index)
}

const handleRowClick = (row) => {
  selectedRow.value = row
  if (tableRef.value && typeof tableRef.value.setCurrentRow === 'function') {
    tableRef.value.setCurrentRow(row)
  }
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
  // 处理空值
  if (!attendees) return ''
  // 处理数组格式（兼容旧数据）
  if (Array.isArray(attendees)) {
    return attendees.length > 0 ? attendees.join('|') : ''
  }
  // 尝试解析JSON字符串格式
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
  // 处理普通字符串格式（已转换好的"|"分隔格式）
  return String(attendees).trim()
}
</script>

<style scoped lang="scss">
.cluster-result-panel {
  width: 100%;
  background: var(--sd-canvas, #ffffff);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
  padding: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.cluster-result-panel > * + * {
  margin-top: 12px;
}

/* 议题聚类卡片 */
.cluster-card {
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 50%;
}

.cluster-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
  font-size: 13px;
  color: var(--sd-primary, #195fb4);
}

.cluster-card-header .header-left {
  display: flex;
  align-items: center;
}

.cluster-card-header .header-left > * + * {
  margin-left: 6px;
}

.cluster-card-header .header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.qa-header-btn {
  padding: 4px 10px;
  font-size: 12px;
  height: 26px;
}

.cluster-card-header .el-icon {
  font-size: 14px;
  color: var(--sd-primary, #195fb4);
}

.sort-btn {
  font-size: 12px;
  color: #606266;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  height: auto;
  &:hover {
    color: var(--sd-primary, #195fb4);
  }
  .el-icon {
    font-size: 13px;
    color: inherit;
    margin-left: 2px;
  }
}

.cluster-card-body {
  padding: 14px;
  background: #ffffff;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.result-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.result-card-header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--sd-canvas, #ffffff);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  font-weight: 600;
  font-size: 13px;
  color: var(--sd-primary, #195fb4);
  flex-shrink: 0;
}

.result-card-header > * + * {
  margin-left: 6px;
}

.result-card-header .el-icon {
  font-size: 14px;
  color: var(--sd-primary, #195fb4);
}

.result-card-body {
  padding: 14px;
  background: #ffffff;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cluster-list-wrapper {
  flex-shrink: 0;
  margin-bottom: 24px;
}

.cluster-list {
  flex: 1;
  overflow-y: auto;
}

.cluster-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.cluster-item > * + * {
  margin-left: 8px;
}

.cluster-item:hover {
  background: #e4e7ed;
}

.cluster-item-active {
  background: #ecf5ff !important;
  border-color: #b3d8ff !important;
}

.cluster-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cluster-content {
  flex: 1;
  min-width: 0;
}

.cluster-name {
  font-size: 12px;
  color: #303133;
  margin-bottom: 2px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cluster-count {
  font-size: 11px;
  color: #909399;
}

.expand-icon {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}

.empty-cluster {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-cluster-icon {
  font-size: 48px;
  color: #dcdfe6;
}

.empty-cluster-text {
  font-size: 13px;
  color: #909399;
}

.analyzing-state {
  text-align: center;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.analyzing-icon {
  font-size: 32px;
  color: var(--sd-primary, #195fb4);
}

.analyzing-text {
  font-size: 13px;
  color: #909399;
}

.detail-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid #e4e7ed;
  padding: 0;
  margin-top: 24px;
}

.detail-divider {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  margin: 0;
  background: #f0f2f5;
  border-top: 1px solid #e4e7ed;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
  font-size: 12px;
  color: #606266;
  flex-shrink: 0;
}

.detail-divider .el-icon {
  font-size: 13px;
  color: #909399;
}

.detail-content {
  flex: 1;
  min-height: 0;
  padding: 0;
  margin: 0;
}

/* 聚类详情卡片 */
.detail-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 50%;
}

.detail-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
  font-size: 13px;
  color: var(--sd-primary, #195fb4);
  flex-shrink: 0;
}

.detail-card-header .el-icon {
  font-size: 14px;
  color: var(--sd-primary, #195fb4);
}

.detail-card-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 1px;
}

/* 表格卡片 */
.table-card {
  background: #ffffff;
  border: none;
  border-radius: 0;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
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
  padding: 0 1px;
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
  color: var(--sd-primary, #195fb4);
  cursor: pointer;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
}
</style>
