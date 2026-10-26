<template>
  <div class="meeting-timeline-panel">
    <!-- 时间轴内容 -->
    <div ref="timelineContent" class="timeline-content">
      <el-timeline v-if="groupedMeetings.length > 0">
        <el-timeline-item
          v-for="(group, groupIndex) in groupedMeetings"
          :key="group.date"
          placement="top"
        >
          <!-- 自定义时间节点头部（可折叠） -->
          <template #dot>
            <div
              class="timeline-dot"
              :class="{ 'timeline-dot-collapsed': collapsedGroups.has(group.date) }"
              @click.stop="toggleGroup(group.date)"
            ></div>
          </template>

          <!-- 时间节点标题行（可点击折叠） -->
          <div
            class="group-header"
            @click="toggleGroup(group.date)"
          >
            <span class="group-date">{{ group.date }}</span>
            <span v-if="group.count > 1" class="group-count">{{ group.count }}个会议</span>
            <el-icon
              class="group-collapse-icon"
              :class="{ 'is-collapsed': collapsedGroups.has(group.date) }"
            >
              <ArrowDown />
            </el-icon>
          </div>

          <!-- 该日期下的多个会议卡片，可整组折叠 -->
          <div
            class="group-cards-wrapper"
            :class="{ 'group-cards-collapsed': collapsedGroups.has(group.date) }"
          >
            <div
              v-for="(meeting, meetingIndex) in group.meetings"
              :key="meeting.originalIndex"
              :ref="el => setCardRef(el, meeting.originalIndex)"
              class="meeting-card"
              :class="{ 'meeting-card-active': selectedMeetingIndex === meeting.originalIndex }"
            >
              <!-- 卡片头部：点击整行同时触发选中 + 折叠/展开 -->
              <div
                class="meeting-header"
                @click="handleMeetingClick(meeting.originalIndex); toggleCard(meeting.originalIndex)"
              >
                <el-icon class="header-calendar-icon"><Calendar /></el-icon>
                <span class="meeting-name">{{ meeting.meetingName || '会议' }}</span>
                <span class="topic-badge">{{ meeting.topics }}个议题</span>
                <el-icon
                  class="card-collapse-icon"
                  :class="{ 'is-collapsed': collapsedCards.has(meeting.originalIndex) }"
                >
                  <ArrowDown />
                </el-icon>
              </div>

              <!-- 卡片内容：可折叠 -->
              <div
                class="meeting-body"
                :class="{ 'meeting-body-collapsed': collapsedCards.has(meeting.originalIndex) }"
              >
                <div
                  v-for="(topic, tIndex) in meeting.topicList"
                  :key="tIndex"
                  class="topic-item"
                >
                  <div class="topic-title">{{ topic.title }}</div>
                  <ul class="topic-details">
                    <li
                      v-for="(detail, dIndex) in topic.details"
                      :key="dIndex"
                      :class="{ 'topic-detail-highlight': isTopicHighlighted(detail) }"
                      @click.stop="handleDetailClick(detail)"
                    >
                      {{ detail }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <div v-else class="empty-state">
        <div class="empty-text">请上传文件并点击「立即执行」生成时间轴</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { ArrowDown, Calendar } from '@element-plus/icons-vue'

const props = defineProps({
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
  // 每次聚类被选中时递增，用于重复选中同一聚类时也能触发滚动
  clusterScrollTick: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['select-meeting', 'select-cluster-by-name'])

// 时间轴内容区域引用
const timelineContent = ref(null)

// 卡片 DOM 引用映射（用于滚动定位）
const cardRefs = ref({})

// 已折叠的日期组（Set 存储 date 字符串）
const collapsedGroups = ref(new Set())

// 已折叠的会议卡片（Set 存储 originalIndex）
const collapsedCards = ref(new Set())

// 初始化默认折叠状态：数据加载后所有日期组和所有卡片默认收起
const initCollapsedState = (meetings) => {
  const groups = new Set()
  const cards = new Set()
  for (const group of meetings) {
    groups.add(group.date)
    for (const meeting of group.meetings) {
      cards.add(meeting.originalIndex)
    }
  }
  collapsedGroups.value = groups
  collapsedCards.value = cards
}

/**
 * 全部展开（日期组 + 会议卡片两层）
 * @returns {void}
 */
const expandAll = () => {
  collapsedGroups.value = new Set()
  collapsedCards.value = new Set()
}

/**
 * 全部收起（日期组 + 会议卡片两层）
 * @returns {void}
 */
const collapseAll = () => {
  if (props.groupedMeetings && props.groupedMeetings.length > 0) {
    initCollapsedState(props.groupedMeetings)
  }
}

defineExpose({
  expandAll,
  collapseAll
})

// 监听数据变化，重新初始化折叠状态
watch(() => props.groupedMeetings, (newVal) => {
  if (newVal && newVal.length > 0) {
    initCollapsedState(newVal)
  } else {
    collapsedGroups.value = new Set()
    collapsedCards.value = new Set()
  }
}, { immediate: true })

// 设置卡片引用
const setCardRef = (el, index) => {
  if (el) {
    cardRefs.value[index] = el
  }
}

// 折叠/展开日期组
const toggleGroup = (date) => {
  const next = new Set(collapsedGroups.value)
  if (next.has(date)) {
    next.delete(date)
  } else {
    next.add(date)
  }
  collapsedGroups.value = next
}

// 折叠/展开单张会议卡片
const toggleCard = (index) => {
  const next = new Set(collapsedCards.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  collapsedCards.value = next
}

// 点击会议卡片头部选中会议
const handleMeetingClick = (index) => {
  emit('select-meeting', index)
}

// 点击议题条目：解析 clusterName 并触发聚类过滤
// detail 格式为 "[clusterName] topicName"
const handleDetailClick = (detail) => {
  const match = detail.match(/^\[(.+?)\]/)
  if (match) {
    emit('select-cluster-by-name', match[1])
  }
}

// 判断议题是否应该高亮
const isTopicHighlighted = (detail) => {
  if (!props.selectedCluster) return false
  // 支持聚类包含多个原始标签的情况
  if (props.selectedCluster.labels && props.selectedCluster.labels.length > 0) {
    return props.selectedCluster.labels.some(label => detail.startsWith(`[${label}]`))
  }
  return detail.startsWith(`[${props.selectedCluster.name}]`)
}

// 监听选中的聚类变化（或重复点击同一聚类），展开所有含该聚类的卡片并滚动到第一个
watch([() => props.selectedCluster, () => props.clusterScrollTick], ([newCluster]) => {
  if (!newCluster || !timelineContent.value) return

  nextTick(() => {
    const nextGroups = new Set(collapsedGroups.value)
    const nextCards = new Set(collapsedCards.value)
    let firstMatchIndex = null  // 第一个匹配的 originalIndex

    for (const group of props.groupedMeetings) {
      for (const meeting of group.meetings) {
        const hasCluster = meeting.fullTopics?.some(topic => {
          if (newCluster.labels?.length > 0) {
            return newCluster.labels.includes(topic.clusterName)
          }
          return topic.clusterName === newCluster.name
        })

        if (hasCluster) {
          // 展开所在日期组和卡片
          nextGroups.delete(group.date)
          nextCards.delete(meeting.originalIndex)
          // 记录第一个匹配的卡片
          if (firstMatchIndex === null) {
            firstMatchIndex = meeting.originalIndex
          }
        }
      }
    }

    collapsedGroups.value = nextGroups
    collapsedCards.value = nextCards

    // 等待 max-height 过渡动画结束（300ms）再滚动，确保 offsetTop 已稳定
    if (firstMatchIndex !== null) {
      setTimeout(() => {
        const cardEl = cardRefs.value[firstMatchIndex]
        if (cardEl && timelineContent.value) {
          // 计算元素相对于滚动容器的实际偏移量
          let offsetTop = 0
          let currentEl = cardEl
          while (currentEl && currentEl !== timelineContent.value) {
            offsetTop += currentEl.offsetTop
            currentEl = currentEl.offsetParent
          }
          timelineContent.value.scrollTo({
            top: offsetTop - 200,
            behavior: 'smooth'
          })
        }
      }, 320)
    }
  })
})
</script>

<style scoped lang="scss">
.meeting-timeline-panel {
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.timeline-content {
  flex: 1;
  padding: 24px 20px;
  overflow-y: auto;
}

.timeline-content :deep(.el-timeline-item__timestamp.is-top) {
  display: none;
}

/* Element Plus Timeline 样式覆盖 */
:deep(.el-timeline) {
  padding: 0;
}

:deep(.el-timeline-item__wrapper) {
  padding-left: 12px;
}

:deep(.el-timeline-item__timestamp) {
  color: #909399;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
}

:deep(.el-timeline-item__node) {
  width: 14px;
  height: 14px;
  left: -7px;
  border-width: 2px;
  background-color: #fff;
}

:deep(.el-timeline-item__tail) {
  left: 0px;
  border-left: 2px solid #e4e7ed;
}

/* 自定义时间节点圆点 */
.timeline-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: #fff;
  border: 2px solid var(--sd-primary, #195fb4);
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;
  position: relative;
  left: -6.5px;
  &:hover {
    background-color: var(--sd-primary, #195fb4);
    transform: scale(1.2);
  }

  &.timeline-dot-collapsed {
    background-color: var(--sd-primary, #195fb4);
  }
}

/* 日期组标题行 */
.group-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  cursor: pointer;
  user-select: none;
  padding: 4px 2px;
  border-radius: 4px;
  transition: background 0.15s ease;
  position: relative;
  top: -4px;
  &:hover {
    background: #f5f7fa;
  }
}

.group-header > * + * {
  margin-left: 8px;
}

.group-date {
  color: #606266;
  font-size: 13px;
  font-weight: 500;
}

.group-count {
  font-size: 11px;
  color: #909399;
  background: #f0f2f5;
  padding: 1px 7px;
  border-radius: 9px;
}

.group-collapse-icon {
  margin-left: auto;
  color: #c0c4cc;
  font-size: 13px;
  transition: transform 0.25s ease;

  &.is-collapsed {
    transform: rotate(-90deg);
  }
}

/* 日期组卡片容器折叠 */
.group-cards-wrapper {
  overflow: hidden;
  max-height: 9999px;
  transition: max-height 0.3s ease, opacity 0.25s ease;
  opacity: 1;

  &.group-cards-collapsed {
    max-height: 0;
    opacity: 0;
  }
}

.meeting-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 10px;
  padding: 18px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid #e4e7ed;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.meeting-card:hover {
  background: linear-gradient(135deg, #f0f2f5 0%, #fafbfc 100%);
  // transform: translateY(-3px) translateX(2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
  border-color: #d4d7de;
}

.meeting-card-active {
  background: linear-gradient(135deg, #e6f4ff 0%, #f0f8ff 100%) !important;
  border-color: var(--sd-primary, #195fb4) !important;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15), 0 0 0 3px rgba(64, 158, 255, 0.1) !important;
  // transform: translateX(4px);
}

.meeting-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-weight: 600;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
}

/* 卡片内容无 margin 时去掉 header 下边距 */
.meeting-body-collapsed + .meeting-header,
.meeting-card:has(.meeting-body-collapsed) .meeting-header {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.header-calendar-icon {
  color: var(--sd-primary, #195fb4);
  font-size: 15px;
  flex-shrink: 0;
}

.meeting-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 卡片折叠图标 */
.card-collapse-icon {
  flex-shrink: 0;
  color: #c0c4cc;
  font-size: 13px;
  transition: transform 0.25s ease;
  padding: 2px;
  border-radius: 3px;

  &:hover {
    color: #909399;
    background: rgba(0, 0, 0, 0.05);
  }

  &.is-collapsed {
    transform: rotate(-90deg);
  }
}

.topic-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: #909399;
  background: #f0f2f5;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.meeting-card-active .topic-badge {
  background: rgba(64, 158, 255, 0.1);
  color: var(--sd-primary, #195fb4);
}

.meeting-card-active .meeting-header {
  border-bottom-color: rgba(64, 158, 255, 0.2);
}

.meeting-card-active .header-calendar-icon {
  color: var(--sd-primary, #195fb4);
}

/* 卡片内容折叠动画 */
.meeting-body {
  overflow: hidden;
  max-height: 9999px;
  transition: max-height 0.3s ease, opacity 0.25s ease;
  opacity: 1;

  &.meeting-body-collapsed {
    max-height: 0;
    opacity: 0;
    pointer-events: none;
  }
}

/* 卡片内容折叠时移除 header 下边距 */
.meeting-card:has(.meeting-body-collapsed) .meeting-header {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom-color: transparent;
}

.topic-item {
  margin-bottom: 14px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.topic-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #303133;
  font-size: 14px;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 6px;
}

.topic-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 4px;
  background: var(--sd-primary, #195fb4);
  border-radius: 50%;
  flex-shrink: 0;
}

.topic-details {
  padding-left: 14px;
  margin: 0;
  list-style: none;
}

.topic-details li {
  margin-bottom: 4px;
  color: #606266;
  font-size: 12px;
  line-height: 1.4;
  padding: 5px 10px;
  border-radius: 6px;
  transition: all 0.2s ease;
  background: rgba(0, 0, 0, 0.02);
  border-left: 2px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  &:hover {
    background: rgba(64, 158, 255, 0.06);
    border-left-color: var(--sd-primary, #195fb4);
    color: var(--sd-primary, #195fb4);
  }
}

.topic-detail-highlight {
  background: linear-gradient(90deg, #e6f4ff 0%, #f0f8ff 100%) !important;
  color: var(--sd-primary, #195fb4) !important;
  font-weight: 600;
  border-left-color: var(--sd-primary, #195fb4) !important;
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.1);
}

.empty-state {
  text-align: center;
  padding: 100px 20px;
  color: #909399;
  font-size: 14px;
}

/* 滚动条美化 */
.timeline-content::-webkit-scrollbar {
  width: 6px;
}

.timeline-content::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}

.timeline-content::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
  transition: background 0.2s;
}

.timeline-content::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}
</style>
