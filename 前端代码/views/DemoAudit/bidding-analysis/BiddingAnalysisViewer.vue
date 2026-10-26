<template>
  <div class="ba-viewer" :class="{ 'ba-viewer--embedded': isSecondaryExecution }">
    <div v-if="isSecondaryExecution" class="ba-viewer-toolbar">
      <span class="ba-viewer-title">{{ taskName || '招投标分析' }}</span>
      <el-button link type="primary" @click="$emit('close-dialog')">关闭</el-button>
    </div>

    <div v-if="loading" class="ba-viewer-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <template v-else-if="!isCompleted">
      <div class="ba-viewer-progress">
        <div class="ba-viewer-progress-head">
          <span>规则分析进度</span>
          <span>{{ ruleDone }} / {{ ruleTotal }}</span>
        </div>
        <el-progress :percentage="progressPercent" :stroke-width="10" />
        <p class="ba-viewer-progress-tip">任务进行中，请稍候...</p>
      </div>
    </template>

    <template v-else>
      <BiddingAnalysisResultProjectList
        v-if="!selectedProjectId"
        :projects="projectCards"
        :analysis-modes="analysisModes"
        @back="$emit('close-dialog')"
        @select="selectedProjectId = $event"
      />
      <BiddingAnalysisResultView
        v-else
        :project="selectedProject"
        :analysis-modes="analysisModes"
        :analysis-id="resolvedAnalysisId"
        :use-api="true"
        @back="selectedProjectId = null"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import BiddingAnalysisResultProjectList from './components/BiddingAnalysisResultProjectList.vue'
import BiddingAnalysisResultView from './components/BiddingAnalysisResultView.vue'
import { useBiddingAnalysisResults } from './composables/useBiddingAnalysisResults.js'
import { getBiddingAnalysisAPI } from '@/api/biddingAnalysis.js'

defineOptions({ name: 'BiddingAnalysisViewer' })

const props = defineProps({
  taskId: { type: String, default: '' },
  analysisId: { type: String, default: '' },
  taskName: { type: String, default: '' },
  taskStatus: { type: [Number, String], default: null },
  isSecondaryExecution: { type: Boolean, default: false },
  eventKey: { type: String, default: '' },
})

defineEmits(['close-dialog'])

const runtimeTaskStatus = ref(props.taskStatus)

const resolvedAnalysisId = computed(() => props.analysisId || props.taskId)
const selectedProjectId = ref(null)
const pollTimer = ref(null)

const { loading, analysisDetail, projectCards, loadOverview } = useBiddingAnalysisResults()

const analysisModes = computed(() => analysisDetail.value?.analysis_modes || [])
const ruleTotal = computed(() => Number(analysisDetail.value?.rule_total || 0))
const ruleDone = computed(() => Number(analysisDetail.value?.rule_done || 0))
const progressPercent = computed(() => {
  if (!ruleTotal.value) return 0
  return Math.min(100, Math.round((ruleDone.value / ruleTotal.value) * 100))
})
const isCompleted = computed(() => {
  const st = analysisDetail.value?.status
  if (st === 'SUCCESS' || st === 'FAILED') return true
  const ts = Number(runtimeTaskStatus.value ?? props.taskStatus)
  return ts === 2 || ts === 3
})

const selectedProject = computed(() =>
  projectCards.value.find((p) => p.id === selectedProjectId.value) || null
)

const refreshDetail = async () => {
  if (!resolvedAnalysisId.value) return
  await loadOverview(resolvedAnalysisId.value)
}

const refreshFromTaskDetail = (td) => {
  if (!td || typeof td !== 'object') return
  if (td.task_status != null) {
    runtimeTaskStatus.value = td.task_status
  }
  const merged = {
    ...(analysisDetail.value || {}),
    status: td.ba_status || analysisDetail.value?.status,
    rule_total: td.rule_total ?? analysisDetail.value?.rule_total,
    rule_done: td.rule_done ?? analysisDetail.value?.rule_done,
    project_count: td.project_count ?? analysisDetail.value?.project_count,
  }
  analysisDetail.value = merged
  if (isCompleted.value) {
    loadOverview(resolvedAnalysisId.value)
    stopPoll()
  }
}

defineExpose({
  refreshFromTaskDetail,
})

const startPoll = () => {
  stopPoll()
  if (isCompleted.value) return
  pollTimer.value = setInterval(async () => {
    try {
      const res = await getBiddingAnalysisAPI(resolvedAnalysisId.value)
      analysisDetail.value = res?.data || res
      if (isCompleted.value) {
        await loadOverview(resolvedAnalysisId.value)
        stopPoll()
      }
    } catch {
      /* ignore poll errors */
    }
  }, 2000)
}

const stopPoll = () => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

watch(() => props.taskStatus, (val) => {
  runtimeTaskStatus.value = val
})

watch(isCompleted, (done) => {
  if (done) {
    loadOverview(resolvedAnalysisId.value)
    stopPoll()
  }
})

onMounted(async () => {
  await refreshDetail()
  if (!isCompleted.value) startPoll()
})

onBeforeUnmount(stopPoll)
</script>

<style scoped>
.ba-viewer {
  min-height: 480px;
  background: #fff;
}

.ba-viewer--embedded {
  padding: 12px 16px;
}

.ba-viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.ba-viewer-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.ba-viewer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  color: #909399;
}

.ba-viewer-loading > * + * {
  margin-left: 8px;
}

.ba-viewer-progress {
  max-width: 560px;
  margin: 24px auto;
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.ba-viewer-progress-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
  color: #606266;
}

.ba-viewer-progress-tip {
  margin-top: 12px;
  font-size: 13px;
  color: #909399;
}
</style>
