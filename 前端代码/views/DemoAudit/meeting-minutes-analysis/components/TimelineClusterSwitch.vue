<template>
  <div class="timeline-cluster-switch-panel">
    <!-- 左右并排布局 -->
    <div class="content-layout">
      <!-- 左侧 - 会议时间轴 -->
      <div class="left-section">
        <div class="section-header">
          <el-icon><Clock /></el-icon>
          <span>会议时间轴</span>
          <div class="section-header-actions">
            <el-button link type="primary" size="small" @click="handleExpandAll">展开</el-button>
            <el-button link type="primary" size="small" @click="handleCollapseAll">收起</el-button>
          </div>
        </div>
        <div class="section-body">
          <MeetingTimeline
            ref="meetingTimelineRef"
            :grouped-meetings="groupedMeetings"
            :selected-meeting-index="selectedMeetingIndex"
            :selected-cluster="selectedCluster"
            :cluster-scroll-tick="clusterScrollTick"
            @select-meeting="$emit('select-meeting', $event)"
            @select-cluster-by-name="handleSelectClusterByName"
          />
        </div>
      </div>

      <!-- 右侧 - 议题聚类 + 聚类详情（使用 ClusterResultPanel） -->
      <div class="right-section">
        <ClusterResultPanel
          ref="clusterResultPanelRef"
          :clusters="clusters"
          :selected-cluster-index="selectedClusterIndex"
          :detail-table-data="detailTableData"
          :is-analyzing="isAnalyzing"
          :extract-fields="extractFields"
          :show-qa-button="false"
          @select-cluster="handleClusterSelect"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Clock } from '@element-plus/icons-vue'
import MeetingTimeline from './MeetingTimeline.vue'
import ClusterResultPanel from './ClusterResultPanel.vue'

const props = defineProps({
  // 时间轴数据
  groupedMeetings: {
    type: Array,
    default: () => []
  },
  selectedMeetingIndex: {
    type: Number,
    default: null
  },
  selectedCluster: {
    type: Object,
    default: null
  },
  // 聚类数据
  clusters: {
    type: Array,
    default: () => []
  },
  selectedClusterIndex: {
    type: Number,
    default: null
  },
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
  },
  clusterScrollTick: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['select-meeting', 'select-cluster'])

// 聚类结果面板引用
const clusterResultPanelRef = ref(null)
// 会议时间轴引用
const meetingTimelineRef = ref(null)

/**
 * 全部展开时间轴（日期组 + 会议卡片两层）
 * @returns {void}
 */
const handleExpandAll = () => {
  meetingTimelineRef.value?.expandAll?.()
}

/**
 * 全部收起时间轴（日期组 + 会议卡片两层）
 * @returns {void}
 */
const handleCollapseAll = () => {
  meetingTimelineRef.value?.collapseAll?.()
}

// 处理聚类选择（来自 ClusterResultPanel）
const handleClusterSelect = (index) => {
  emit('select-cluster', index)
}

// 处理时间轴议题点击：根据 clusterName 找到对应 index 并触发聚类选中
const handleSelectClusterByName = (clusterName) => {
  const index = props.clusters.findIndex(c =>
    c.name === clusterName ||
    (c.labels && c.labels.includes(clusterName))
  )
  if (index !== -1) {
    emit('select-cluster', index)
  }
}
</script>

<style scoped lang="scss">
.timeline-cluster-switch-panel {
  width: 100%;
  height: 100%;
  background: var(--sd-surface-1, #f4f4f4);
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
}

/* 左右布局 */
.content-layout {
  display: flex;
  height: 100%;
}

.content-layout > * + * {
  margin-left: 12px;
}

/* 左侧区域 - 会议时间轴 */
.left-section {
  flex: 1;
  min-width: 0;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .section-header {
    display: flex;
    align-items: center;
    height: 48px;
    min-height: 48px;
    padding: 0 12px;
    border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
    font-size: 14px;
    font-weight: 500;
    color: #303133;
    background: var(--sd-canvas, #ffffff);
    flex-shrink: 0;
    box-sizing: border-box;

    .el-icon {
      font-size: 16px;
      color: var(--sd-primary, #195fb4);
      margin-right: 8px;
    }

    > span {
      flex-shrink: 0;
    }
  }

  .section-header-actions {
    display: flex;
    align-items: center;
    margin-left: auto;
    flex-shrink: 0;
  }

  .section-header-actions > * + * {
    margin-left: 4px;
  }

  .section-body {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
}

/* 右侧区域 - 议题聚类 + 聚类详情 */
.right-section {
  width: 45%;
  min-width: 400px;
  display: flex;
  flex-direction: column;

  > * + * {
    margin-top: 12px;
  }

  :deep(.cluster-result-panel) {
    height: 100%;
    border-radius: 4px;
    box-shadow: none;
    border: 1px solid var(--sd-hairline, #e0e0e0);
  }
}

.timeline-content {
  :deep(.meeting-timeline-panel) {
    width: 100%;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
