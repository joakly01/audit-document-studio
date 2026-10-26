<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { Document, Search as SearchIcon } from '@element-plus/icons-vue'

const props = defineProps({
  timelineData: {
    type: Array,
    default: () => []
  },
  activeFileId: {
    type: String,
    default: null
  },
  isAnalyzing: {
    type: Boolean,
    default: false
  },
  /** 数据就绪后自动展开全部日期与事件内容 */
  autoExpandAll: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['timelineClick'])

// ============ 内部状态（内聚，不向外暴露） ============
const searchQuery = ref('')
const collapsedDates = ref(new Set())
const expandedEvents = ref(new Set())

const initialDates = computed(() => {
  const dates = props.timelineData.map((e) => e.date)
  return {
    min: dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : '',
    max: dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : ''
  }
})

const startDate = ref('')
const endDate = ref('')

// 获取当天日期字符串（yyyy-MM-dd）
const todayStr = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 获取当天日期中文格式占位（XXXX年XX月XX日）
const todayPlaceholder = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`
})

// ============ 分组过滤 ============
const groupedTimeline = computed(() => {
  const filtered = props.timelineData.filter((event) => {
    const matchesSearch =
      event.fileName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      event.date.includes(searchQuery.value) ||
      event.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      event.sections.some(
        (s) =>
          (s.heading || s.subtitle || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          (s.summary || s.content || '').toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    const matchesDate =
      (!startDate.value || event.date >= startDate.value) &&
      (!endDate.value || event.date <= endDate.value)
    return matchesSearch && matchesDate
  })

  const groups = {}
  filtered.forEach((event) => {
    if (!groups[event.date]) groups[event.date] = []
    groups[event.date].push(event)
  })

  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
})

// ============ 交互 ============
const toggleDate = (date) => {
  if (collapsedDates.value.has(date)) {
    collapsedDates.value.delete(date)
  } else {
    collapsedDates.value.add(date)
  }
}

const toggleEvent = (eventId) => {
  if (expandedEvents.value.has(eventId)) {
    expandedEvents.value.delete(eventId)
  } else {
    expandedEvents.value.add(eventId)
  }
}

/**
 * 收集当前筛选结果中的日期与事件 ID
 * @returns {{ dates: Array<string>, eventIds: Array<string|number> }}
 */
const collectVisibleTimelineKeys = () => {
  const dates = []
  const eventIds = []
  groupedTimeline.value.forEach(([date, events]) => {
    dates.push(date)
    ;(events || []).forEach((event) => {
      if (event && event.id != null) {
        eventIds.push(event.id)
      }
    })
  })
  return { dates, eventIds }
}

/**
 * 全部展开（日期组 + 事件卡片议题两层）
 * @returns {void}
 */
const expandAll = () => {
  collapsedDates.value = new Set()
  const { eventIds } = collectVisibleTimelineKeys()
  expandedEvents.value = new Set(eventIds)
}

/**
 * 全部收起（日期组 + 事件卡片议题两层）
 * @returns {void}
 */
const collapseAll = () => {
  const { dates } = collectVisibleTimelineKeys()
  collapsedDates.value = new Set(dates)
  expandedEvents.value = new Set()
}

// 当数据变化时同步日期范围，任务中心详情默认全部展开
watch(
  () => props.timelineData,
  (val) => {
    nextTick(() => {
      startDate.value = initialDates.value.min || todayStr()
      endDate.value = initialDates.value.max || todayStr()
      if (props.autoExpandAll && Array.isArray(val) && val.length > 0) {
        expandAll()
      }
    })
  },
  { immediate: true }
)

defineExpose({
  expandAll,
  collapseAll
})

const handleTimelineClick = (fileId) => {
  emit('timelineClick', fileId)
}
</script>

<template>
  <div class="tld-wrapper">
    <!-- 筛选栏 -->
    <header class="tld-header ocr-column-head">
      <div class="tld-search-wrap">
        <el-input
          v-model="searchQuery"
          placeholder="搜索文件名/内容/时间"
          :prefix-icon="SearchIcon"
          clearable
        />
      </div>
      <div class="tld-date-range">
        <input type="date" v-model="startDate" class="tld-date-input" :placeholder="todayPlaceholder" />
        <span class="tld-date-sep">至</span>
        <input type="date" v-model="endDate" class="tld-date-input" :placeholder="todayPlaceholder" />
      </div>
      <div class="tld-header-actions">
        <el-button link type="primary" size="small" @click="expandAll">展开</el-button>
        <el-button link type="primary" size="small" @click="collapseAll">收起</el-button>
      </div>
    </header>

    <!-- 时间轴内容 -->
    <div class="tld-timeline-wrap">
      <div class="tld-timeline-inner">
        <!-- 竖线 -->
        <div v-if="timelineData.length > 0" class="tld-timeline-line" />

        <!-- 分析中 loading -->
        <div v-if="isAnalyzing && timelineData.length === 0" class="tld-empty">
          <div class="tld-loading-spinner">
            <span></span><span></span><span></span><span></span>
          </div>
          <span class="tld-loading-text">正在分析中，请稍候…</span>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!isAnalyzing && timelineData.length === 0" class="tld-empty">
          <el-icon class="tld-empty-icon"><Document /></el-icon>
          <span>暂无时间轴数据</span>
        </div>

        <template v-else>
          <template v-if="groupedTimeline.length > 0">
            <div
              v-for="[date, events] in groupedTimeline"
              :key="date"
              :id="`date-group-${date}`"
              class="tld-date-group"
              :class="{ 'tld-date-group--collapsed': collapsedDates.has(date) }"
            >
              <!-- 日期圆点 -->
              <div
                class="tld-date-dot"
                :class="{ 'tld-date-dot--active': events.some((e) => e.fileId === activeFileId) }"
              />

              <!-- 日期行 -->
              <div class="tld-date-row" @click="toggleDate(date)">
                <div class="tld-date-info">
                  <span class="tld-date-label">{{ date }}</span>
                  <span class="tld-date-badge">{{ events.length }}</span>
                </div>
                <el-icon
                  class="tld-date-chevron"
                  :class="{ 'tld-date-chevron--collapsed': collapsedDates.has(date) }"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </el-icon>
              </div>

              <!-- 事件卡片列表 -->
              <Transition name="tld-slide-fade">
                <div v-if="!collapsedDates.has(date)" class="tld-events-list">
                  <div
                    v-for="event in events"
                    :key="event.id"
                    :id="`event-${event.id}`"
                    class="tld-event-card"
                    :class="{ 'tld-event-card--active': activeFileId === event.fileId }"
                    @click="handleTimelineClick(event.fileId)"
                  >
                    <!-- 卡片头部 -->
                    <div class="tld-event-header">
                      <div class="tld-event-title-wrap">
                        <div class="tld-event-icon-wrap">
                          <el-icon><Document /></el-icon>
                        </div>
                        <span class="tld-event-title">{{ event.title }}</span>
                      </div>
                      <div class="tld-event-meta">
                        <el-icon
                          class="tld-event-chevron"
                          :class="{ 'tld-event-chevron--expanded': expandedEvents.has(event.id) }"
                          @click.stop="toggleEvent(event.id)"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </el-icon>
                      </div>
                    </div>

                    <!-- 展开的内容 -->
                    <Transition name="tld-slide-fade">
                      <div v-if="expandedEvents.has(event.id)" class="tld-event-sections">
                        <div class="tld-sections-divider" />
                        <div
                          v-for="(section, sIndex) in event.sections"
                          :key="sIndex"
                          class="tld-section-item"
                        >
                          <div class="tld-section-subtitle">
                            <span class="tld-section-dot" />
                            {{ section.heading || section.subtitle }}
                          </div>
                          <div class="tld-section-content">{{ section.summary || section.content }}</div>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>
              </Transition>
            </div>
          </template>

          <div v-else class="tld-no-match">
            <el-icon class="tld-empty-icon"><SearchIcon /></el-icon>
            <p>未找到匹配的时间轴内容</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tld-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--sd-canvas, #ffffff);
  height: 100%;
}

.tld-header {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
  background: var(--sd-canvas, #ffffff);
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tld-header > * + * {
  margin-left: 12px;
}

.tld-header-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}

.tld-header-actions > * + * {
  margin-left: 4px;
}

.tld-search-wrap {
  flex: 1;
  max-width: 480px;
}

.tld-date-range {
  display: flex;
  align-items: center;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  color: #475569;
  flex-shrink: 0;
}

.tld-date-range > * + * {
  margin-left: 8px;
}

.tld-date-input {
  border: none;
  outline: none;
  font-size: 12px;
  color: #334155;
  background: transparent;
  width: 110px;
  cursor: pointer;

  &::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.6;
  }
}

.tld-date-sep {
  color: #cbd5e1;
}

.tld-timeline-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  min-height: 0;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: var(--sd-hairline, #e0e0e0); border-radius: 4px; }
}

.tld-timeline-inner {
  max-width: 640px;
  margin: 0 auto;
  position: relative;
}

.tld-timeline-line {
  position: absolute;
  left: 7px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--sd-hairline, #e0e0e0);
  z-index: 0;
}

.tld-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 300px;
  color: #94a3b8;
}

.tld-empty > * + * {
  margin-top: 12px;
}

.tld-empty-icon {
  font-size: 40px;
  opacity: 0.3;
}

.tld-no-match {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #94a3b8;
}

.tld-no-match > * + * {
  margin-top: 12px;
}

.tld-date-group {
  position: relative;
  margin-bottom: 24px;

  &:last-child { margin-bottom: 0; }
}

.tld-date-dot {
  position: absolute;
  left: 0;
  top: 12px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
  z-index: 2;
  transition: box-shadow 0.2s;

  &--active {
    border-color: var(--sd-primary-dark, #0f4a8c);
    box-shadow: 0 0 0 4px var(--sd-primary-light, #e8f0f8);
  }
}

.tld-date-row {
  margin-left: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 8px 0;

  &:hover .tld-date-label { color: var(--sd-primary, #195fb4); }
}

.tld-date-info {
  display: flex;
  align-items: center;
}

.tld-date-info > * + * {
  margin-left: 10px;
}

.tld-date-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  transition: color 0.2s;
}

.tld-date-badge {
  font-size: 11px;
  padding: 1px 8px;
  background: #f1f5f9;
  color: #94a3b8;
  border-radius: 999px;
}

.tld-date-chevron {
  color: #cbd5e1;
  font-size: 16px;
  transition: transform 0.3s;
  transform: rotate(90deg);

  &--collapsed {
    transform: rotate(0deg);
  }
}

.tld-events-list {
  margin-left: 28px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tld-events-list > * + * {
  margin-top: 10px;
}

.tld-event-card {
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  background: var(--sd-surface-1, #f4f4f4);

  &:hover {
    border-color: var(--sd-primary, #195fb4);
    background: var(--sd-canvas, #ffffff);
  }

  &--active {
    background: var(--sd-primary-light, #e8f0f8);
    border-color: var(--sd-primary, #195fb4);
    box-shadow: 0 1px 4px rgba(25, 95, 180, 0.08);
  }
}

.tld-event-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.tld-event-title-wrap {
  display: flex;
  align-items: center;
}

.tld-event-title-wrap > * + * {
  margin-left: 12px;
}

.tld-event-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  color: var(--sd-primary, #195fb4);
  flex-shrink: 0;

  .el-icon { font-size: 16px; }
}

.tld-event-title {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

.tld-event-meta {
  display: flex;
  align-items: center;
}

.tld-event-meta > * + * {
  margin-left: 12px;
}

.tld-event-chevron {
  color: #cbd5e1;
  font-size: 14px;
  transition: transform 0.3s;
  cursor: pointer;

  &:hover { color: var(--sd-primary, #195fb4); }

  &--expanded {
    transform: rotate(90deg);
    color: var(--sd-primary, #195fb4);
  }
}

.tld-event-sections {
  padding: 0 16px 16px;
  overflow: hidden;
}

.tld-sections-divider {
  height: 1px;
  background: #f1f5f9;
  margin-bottom: 12px;
}

.tld-section-item {
  margin-bottom: 12px;

  &:last-child { margin-bottom: 0; }
}

.tld-section-subtitle {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
}

.tld-section-subtitle > * + * {
  margin-left: 8px;
}

.tld-section-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sd-primary, #195fb4);
  flex-shrink: 0;
}

.tld-section-content {
  margin-left: 14px;
  padding: 8px 12px;
  background: rgba(241, 245, 249, 0.6);
  border-radius: 6px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}

// loading 动画
.tld-loading-spinner {
  display: flex;
  align-items: flex-end;
  height: 32px;

  span {
    display: block;
    width: 6px;
    border-radius: 3px;
    background: var(--sd-primary, #195fb4);
    animation: tld-bounce 1.1s ease-in-out infinite;

    &:nth-child(1) { height: 16px; animation-delay: 0s; }
    &:nth-child(2) { height: 24px; animation-delay: 0.15s; margin-left: 6px; }
    &:nth-child(3) { height: 32px; animation-delay: 0.3s; margin-left: 6px; }
    &:nth-child(4) { height: 24px; animation-delay: 0.45s; margin-left: 6px; }
  }
}

.tld-loading-text {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
}

@keyframes tld-bounce {
  0%, 100% { transform: scaleY(0.5); opacity: 0.4; }
  50%       { transform: scaleY(1);   opacity: 1; }
}

// 动画
.tld-slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.tld-slide-fade-leave-active {
  transition: all 0.25s cubic-bezier(1, 0.5, 0.8, 1);
}
.tld-slide-fade-enter-from,
.tld-slide-fade-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}
</style>
