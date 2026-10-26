<template>
  <div
    class="meeting-minutes-analysis-container"
    :class="{ 'meeting-minutes-analysis-container--embedded': isTaskDetailMode }"
    v-loading="initialLoading"
    element-loading-text="加载任务数据中..."
  >
    <!-- 内容区域包装器 -->
    <div class="content-wrapper">
      <!-- 左侧栏 + 拖拽条（无间距，与 OcrViewer / ContractViewer 一致） -->
      <div class="left-sidebar-group">
        <div
          class="left-sidebar-shell meeting-left-sidebar resizable-left-sidebar"
          :style="{ width: leftSidebarWidth + 'px' }"
        >
          <OcrLeftSidebar
          v-if="isTaskDetailMode"
          :bindings="taskPreviewSidebarBindings"
          mode="preview"
          :task-id="props.taskId"
          :readonly="true"
          :allow-mode-switch="false"
          :show-preview-toggle="false"
          :allow-folder-click-in-preview="true"
          :hide-preview-runtime-progress="true"
          compact-file-header
          layout-mode="full"
        />
        <OcrLeftSidebar
          v-else
          :bindings="leftSidebarBindings"
          layout-mode="tree-select"
          compact-file-header
          :readonly="false"
          :show-preview-toggle="false"
          :allow-mode-switch="false"
          mode="edit"
        >
          <template #footer>
            <el-button
              type="primary"
              class="ocr-batch-execute-btn ocr-footer-btn"
              :loading="isAnalyzing"
              @click="openExecuteDialog"
            >
              执行
            </el-button>
          </template>
        </OcrLeftSidebar>
        </div>
        <!-- 左侧与中间区域之间的宽度拖拽条（向右拖加宽左侧，向左拖收窄） -->
        <div
          class="resizer resizer-left"
          @mousedown="startLeftSidebarResize"
          title="拖拽调整宽度"
        >
          <el-icon class="resize-icon">
            <DArrowRight />
          </el-icon>
        </div>
      </div>

      <!-- 中间区域 - Tab 切换 + 内容 -->
      <div class="center-panel">
        <!-- 顶部 Tab 切换区域 -->
        <div class="main-tabs ocr-column-head">
          <div
            class="main-tab"
            :class="{ 'main-tab--active': mainActiveTab === 'regular' }"
            @click="mainActiveTab = 'regular'"
          >
            <el-icon><GridIcon /></el-icon>
            <span>常规分析</span>
          </div>
          <div
            class="main-tab"
            :class="{ 'main-tab--active': mainActiveTab === 'risk' }"
            @click="switchToRiskTab"
          >
            <el-icon><RiskIcon /></el-icon>
            <span>风险分析</span>
          </div>
          <div
            class="main-tab"
            :class="{ 'main-tab--active': mainActiveTab === 'deep' }"
            @click="switchToDeepTab"
          >
            <el-icon><DeepIcon /></el-icon>
            <span>深度问答</span>
          </div>
        </div>

        <!-- 常规分析内容 -->
        <div v-show="mainActiveTab === 'regular'" class="tab-content">
          <TimelineClusterSwitch
            ref="timelineClusterSwitchRef"
            :grouped-meetings="groupedMeetings"
            :selected-meeting-index="selectedMeetingIndex"
            :selected-cluster="selectedCluster"
            :cluster-scroll-tick="clusterScrollTick"
            :clusters="clusters"
            :selected-cluster-index="selectedClusterIndex"
            :detail-table-data="detailTableData"
            :is-analyzing="isAnalyzing"
            :extract-fields="extractFields"
            @select-meeting="handleSelectMeeting"
            @select-cluster="handleSelectCluster"
          />
        </div>

        <!-- 深度分析内容 -->
        <div v-show="mainActiveTab === 'deep'" class="tab-content">
          <DeepAnalysisPanel
            :analysis-id="currentAnalysisId || ''"
            :cluster-version-id="currentClusterVersionId"
            :has-analysis-data="currentAnalysisStatus === 'COMPLETED' && !!currentClusterVersionId"
            @back="mainActiveTab = 'regular'"
          />
        </div>

        <!-- 风险分析内容(SDSSJT-1052:接真实接口) -->
        <div v-show="mainActiveTab === 'risk'" class="tab-content">
          <RiskAnalysisPanel
            :analysis-id="effectiveAnalysisId"
            :risk-report="riskReport"
            :risk-loading="riskLoading"
            :risk-error="riskError"
            :task-detail-mode="isTaskDetailMode"
            @refresh="loadRiskReport"
            @regenerate="regenerateRiskReport"
            @export="handleRiskExport"
          />
        </div>
      </div>

      <!-- 右侧面板 - 解析配置 -->
      <ConfigPanel
        class="right-panel"
        v-model:config="config"
        :filters="filters"
        :readonly="isTaskDetailMode"
        :filters-disabled="!filtersInteractionEnabled"
        @apply-filters="handleApplyFilters"
        @clear-filters="handleClearFilters"
        @export="handleExport"
        @import-result="handleImportResult"
        @view-result="handleViewResult"
      />
    </div>
  </div>

  <!-- 所有议题抽屉（提升到顶层，避免被 v-show 容器影响） -->
  <AllTopicsDrawer
    v-model="allTopicsDrawerVisible"
    :clusters="clusters"
    :extract-fields="extractFields"
  />

  <!-- 分析进度弹窗（独立页 / 任务中心详情；文件管理嵌入时由父级统一遮罩，不重复弹出） -->
  <el-dialog
    v-if="!usesParentProgressOverlay"
    v-model="progressDialogVisible"
    title="分析进度"
    width="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :show-close="true"
    @closed="handleProgressDialogClosed"
  >
    <div class="progress-dialog-body">
      <!-- 失败横幅 -->
      <div v-if="progressAnalysisStatus === 'FAILED'" class="progress-error-banner">
        <el-icon><CircleClose /></el-icon>
        <span>分析失败，请稍后重试</span>
      </div>
      <!-- 初始化中 -->
      <div v-if="!progressRuntimeNodes.length && !progressAnalysisStatus" class="progress-loading-hint">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在初始化分析任务...</span>
      </div>
      <!-- 进度节点树 -->
      <el-scrollbar v-if="progressRuntimeNodes.length" max-height="360px">
        <TaskRuntimeProgressTree :nodes="progressRuntimeNodes" />
      </el-scrollbar>
    </div>

    <template #footer>
      <div class="progress-dialog-footer">
        <template v-if="!progressAnalysisStatus">
          <span class="progress-tip">分析过程中请勿关闭页面</span>
          <el-button @click="handleProgressDismiss">关闭</el-button>
          <el-button type="primary" plain @click="handleProgressReturnToTaskCenter">返回任务中心</el-button>
        </template>
        <el-button
          v-if="progressAnalysisStatus === 'COMPLETED'"
          type="primary"
          @click="handleProgressConfirm"
        >查看结果</el-button>
        <el-button
          v-if="progressAnalysisStatus === 'FAILED'"
          @click="handleProgressClose"
        >关闭</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 分析进度悬浮球：关闭弹窗后持续轮询，点击可重新打开进度 -->
  <div
    v-if="progressFloatingVisible && isAnalyzing"
    class="meeting-progress-floating-ball"
    title="点击查看分析进度"
    @click="showProgressDialogFromFloatingBall"
  >
    <el-icon class="meeting-floating-ball-icon"><Loading /></el-icon>
    <span class="meeting-floating-ball-time">{{ progressElapsedSeconds.toFixed(1) }}s</span>
  </div>

  <!-- 创建分析任务（执行前输入任务名） -->
  <el-dialog
    v-model="taskNameDialogVisible"
    title="创建分析任务"
    width="520px"
    :close-on-click-modal="false"
    class="task-name-dialog"
  >
    <el-form label-width="80px" class="task-form">
      <el-form-item label="任务名称">
        <el-input
          v-model="taskNameInput"
          placeholder="请输入任务名称"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="任务备注">
        <el-input
          v-model="taskRemarkInput"
          type="textarea"
          :rows="3"
          placeholder="请输入任务备注（选填）"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="taskNameDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmBackgroundExecute">确认执行</el-button>
    </template>
  </el-dialog>

  <!-- 任务详情：文件/文件夹预览 -->
  <el-dialog
    v-if="isTaskDetailMode"
    v-model="taskFilePreviewVisible"
    :title="taskFilePreviewTitle"
    width="80%"
    top="5vh"
    destroy-on-close
    append-to-body
    class="meeting-task-file-preview-dialog"
  >
    <div class="meeting-task-preview-host">
      <OcrFolderPreviewPanel
        v-if="taskFolderPreviewActive"
        :folder-name="taskFolderPreviewName"
        :display-total="taskFolderPreviewFiles.length"
        :files="taskFolderPreviewFiles"
        :loading="taskFolderPreviewLoading"
        :is-remote="taskFolderPreviewRemote"
        :total="taskFolderPreviewTotal"
        :page-size="taskFolderPreviewPageSize"
        :current-page="taskFolderPreviewPage"
        @page-change="handleTaskFolderPreviewPageChange"
        @view-file="handleTaskFolderPreviewViewFile"
      />
      <PreviewFile
        v-else-if="taskPreviewCurrentFile"
        :current-file="taskPreviewCurrentFile"
        :current-highlighted-field="null"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHomeStore } from '@/stores/home'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Grid, Box, Connection, CircleClose, Loading, Search, Document, Folder, Delete, View, Hide, Plus, DArrowRight, Warning } from '@element-plus/icons-vue'
import OcrLeftSidebar from '@/views/file-manager-code/components/OcrLeftSidebar.vue'
import OcrFolderPreviewPanel from '@/views/file-manager-code/components/OcrFolderPreviewPanel.vue'
import PreviewFile from '@/views/file-manager-code/components/PreviewFile.vue'
import { useSimpleOcrLeftSidebar } from '@/views/file-manager-code/composables/useSimpleOcrLeftSidebar.js'
import {
  getFileIdentifier,
  normalizeFolderPathForTree,
  buildFolderFileListQueryParams,
  filterLeftTreeNodeByKeyword
} from '@/views/file-manager-code/composables/ocrLeftSidebarTreeUtils.js'
import { normalizeSelectionSummary } from '@/views/ocr-task-center/taskCenterSelectionTreeUtils.js'
import {
  buildPreviewSidebarTreeFromDetail,
  convertTaskResultListForPreview,
  isSamePreviewFileIdSet,
  patchPreviewFileListStatusesInPlace,
  patchPreviewTreeFolderStatusesInPlace
} from '@/views/ocr-task-center/taskCenterPreviewSidebarTreeUtils.js'
import { previewFileAPI, getFileListAPI } from '@/api/fileManager.js'
import TimelineClusterSwitch from './components/TimelineClusterSwitch.vue'
import ConfigPanel from './components/ConfigPanel.vue'
import DeepAnalysisPanel from './components/DeepAnalysisPanel.vue'
import RiskAnalysisPanel from './components/RiskAnalysisPanel.vue'
import { normalizeRiskReport } from './riskLevelUtils.js'
import AllTopicsDrawer from './components/AllTopicsDrawer.vue'
import TaskRuntimeProgressTree from '@/views/file-manager-code/components/contract/TaskRuntimeProgressTree.vue'
import { meetingMinutesBatchExecuteByFilterAPI, getAnalysisDetailAPI, exportAnalysisResultAPI, filterAnalysisResultsAPI, getRiskReportAPI, getRiskReportStatusAPI, triggerRiskAnalysisAPI, exportRiskReportHtmlAPI } from '@/api/meetingMinutesAnalysis.js'
import { getTaskSchedulesAPI } from '@/api/task.js'
import { emitFileManagerProgressStop } from '@/views/file-manager-code/utils/fileManagerTaskProgressEvents.js'
import {
  openTaskCenterWithRefresh,
  runBatchExecuteWithTimeoutNav
} from '@/views/file-manager-code/composables/batchExecuteTimeoutNav.js'

// 图标组件映射
const GridIcon = Grid
const RiskIcon = Warning
const DeepIcon = Connection

defineOptions({
  name: 'MeetingMinutesAnalysis',
})

const router = useRouter()
const homeStore = useHomeStore()

// 定义 props，支持从父组件传递参数
const props = defineProps({
  files: {
    type: String,
    default: ''
  },
  names: {
    type: String,
    default: ''
  },
  isSecondaryExecution: {
    type: Boolean,
    default: false
  },
  eventKey: {
    type: String,
    default: ''
  },
  analysisId: {
    type: String,
    default: ''
  },
  taskId: {
    type: String,
    default: ''
  },
  taskName: {
    type: String,
    default: ''
  },
  taskStatus: {
    type: Number,
    default: null
  },
  toolLabel: {
    type: String,
    default: '会议纪要解析'
  }
})

const emit = defineEmits(['close-dialog'])

/** 是否由文件管理父级展示统一进度遮罩（避免与本页 el-dialog 重复） */
const usesParentProgressOverlay = computed(() => !!String(props.eventKey || '').trim())

// 组件引用
const timelineClusterSwitchRef = ref(null)

// 所有议题抽屉（提升到顶层，避免被 v-show 容器影响渲染）
const allTopicsDrawerVisible = ref(false)

const isTaskDetailMode = computed(() => props.isSecondaryExecution)
/** 任务中心详情：整页加载（侧栏 + 分析结果，对齐信息提取） */
const initialLoading = ref(false)
const initialAnalysisId = computed(() => props.analysisId || null)
const taskName = computed(() => props.taskName || '会议纪要解析结果')

// LocalStorage 键名
const STORAGE_KEY = 'meeting_minutes_analysis_state'

// 会议数据（初始为空，执行分析后生成）
const meetings = ref([])

// 筛选后显示的会议数据
const displayedMeetings = ref([])

// 按日期分组后的会议数据（用于时间轴渲染）
const groupedMeetings = computed(() => {
  if (!displayedMeetings.value.length) return []

  // 按日期分组
  const groupMap = new Map()
  displayedMeetings.value.forEach((meeting, index) => {
    const date = meeting.date || ''
    if (!groupMap.has(date)) {
      groupMap.set(date, [])
    }
    groupMap.get(date).push({
      ...meeting,
      originalIndex: index // 保留原始索引，用于定位
    })
  })

  // 转换为数组并计算每组的会议数量
  return Array.from(groupMap.entries()).map(([date, meetings]) => ({
    date,
    meetings,
    count: meetings.length,
    totalTopics: meetings.reduce((sum, m) => sum + (m.topics || 0), 0)
  }))
})

// 右侧面板宽度
const rightAreaWidth = ref(750)
const rightCenterPanelWidth = ref(400)
const isResizing = ref(false)
const isResizing2 = ref(false)
const startX = ref(0)
const startWidth = ref(0)

/** 左侧边栏允许的最小、最大宽度（像素） */
const LEFT_SIDEBAR_WIDTH_MIN = 200
const LEFT_SIDEBAR_WIDTH_MAX = 560
/** 左侧面板宽度（像素），与文本信息提取/工程合同共用 localStorage 键 */
const savedLeftSidebarWidth = localStorage.getItem('ocr-viewer-left-sidebar-width')
const parsedLeftSidebarW = savedLeftSidebarWidth ? parseInt(savedLeftSidebarWidth, 10) : NaN
const initialLeftSidebarW = Number.isFinite(parsedLeftSidebarW) ? parsedLeftSidebarW : 320
const leftSidebarWidth = ref(
  Math.min(
    LEFT_SIDEBAR_WIDTH_MAX,
    Math.max(LEFT_SIDEBAR_WIDTH_MIN, initialLeftSidebarW)
  )
)
const isResizingLeft = ref(false)
const leftResizeStartX = ref(0)
const leftResizeStartWidth = ref(0)

// 配置项
const config = reactive({
  similarityThreshold: 80,
  minClusterSize: 2,
  maxClusterSize: 2,
  prompt: '',
  promptId: null,
  riskPrompt: '',
  riskPromptId: null,
})

// 筛选条件
const filters = reactive({
  participants: '',
  dateStart: '',
  dateEnd: '',
  amountMin: '',
  amountMax: '',
  keywords: '',
  regularExpression: false
})

// 聚类数据
const clusters = ref([])

// 选中的会议（使用原始索引定位）
const selectedMeetingIndex = ref(null)

// 选中的聚类索引
const selectedClusterIndex = ref(null)

// 详细信息表格数据
const detailTableData = ref([])

// 聚类选中滚动触发计数器（每次聚类被选中时递增，用于重复选同一聚类时也能触发时间轴滚动）
const clusterScrollTick = ref(0)
const isAnalyzing = ref(false)

// 提取字段配置（从后端返回）
const extractFields = ref(null)

// 当前分析ID
const currentAnalysisId = ref(null)
const progressAnalysisId = ref('')

/** 有效分析 ID：兼容任务中心 props.analysisId / 进度弹窗尚未回填 currentAnalysisId 的场景 */
const effectiveAnalysisId = computed(() =>
  currentAnalysisId.value ||
  progressAnalysisId.value ||
  initialAnalysisId.value ||
  ''
)

// 当前分析状态（COMPLETED / FAILED / CANCELLED 等）
const currentAnalysisStatus = ref('')

/** 分析成功后方可使用筛选条件 */
const filtersInteractionEnabled = computed(() => currentAnalysisStatus.value === 'COMPLETED')

// 当前默认聤类版本 ID（深度问答使用）
const currentClusterVersionId = ref('')

// 主 Tab 切换状态（regular=常规分析, risk=风险分析, deep=深度分析）
const mainActiveTab = ref('regular')

// 风险分析(SDSSJT-1052)
const riskReport = ref(null)
const riskLoading = ref(false)
const riskError = ref('')
let riskPollTimer = null

const stopRiskPolling = () => {
  if (riskPollTimer) {
    clearInterval(riskPollTimer)
    riskPollTimer = null
  }
}

/** 分析或风险报告仍在生成时应轮询 status */
const shouldAutoPollRiskReport = (analysisStatus, riskStatus) => {
  const upper = String(analysisStatus || '').toUpperCase()
  if (['CANCELLED', 'CANCELLING', 'FAILED'].includes(upper)) return false
  if (['RUNNING', 'PENDING'].includes(upper)) return true
  const riskUpper = String(riskStatus || '').toUpperCase()
  if (['RUNNING', 'PENDING'].includes(riskUpper)) return true
  // 主分析已完成但风险报告记录尚未就绪
  if (upper === 'COMPLETED' && ['NONE', 'RUNNING', 'PENDING'].includes(riskUpper)) return true
  return false
}

/** 任务详情模式下风险报告轮询中保持 loading，不展示 empty/弹窗 */
const isRiskReportPolling = () => !!riskPollTimer

const handleRiskReportNotReady = (riskStatus) => {
  const shouldPoll = shouldAutoPollRiskReport(currentAnalysisStatus.value, riskStatus)
  if (isTaskDetailMode.value && shouldPoll) {
    riskError.value = ''
    riskLoading.value = true
    startRiskPolling()
    return true
  }
  if (shouldPoll) {
    riskError.value = '风险报告生成中，请稍候...'
    startRiskPolling()
  } else {
    riskError.value = '风险报告尚未生成'
  }
  return false
}

const loadRiskReport = async () => {
  const analysisId = effectiveAnalysisId.value
  if (!analysisId) {
    riskReport.value = null
    if (!isTaskDetailMode.value) {
      riskError.value = '请先完成分析或从任务中心打开分析结果'
    }
    return
  }
  // 手动重生成风险报告时 analysis 可能仍为 FAILED，不应阻止拉取已 SUCCESS 的报告
  if (['CANCELLED', 'CANCELLING'].includes(currentAnalysisStatus.value)) {
    riskReport.value = null
    return
  }
  riskLoading.value = true
  riskError.value = ''
  let keepLoading = false
  try {
    const res = await getRiskReportAPI(analysisId)
    if (res?.code === 0 || res?.code === 200 || !res?.code) {
      const payload = res?.data
      const rawReport =
        payload?.report_data ||
        (payload?.overview ? payload : null) ||
        res?.report_data ||
        null
      riskReport.value = rawReport ? normalizeRiskReport(rawReport) : null
      if (!riskReport.value) {
        const riskStatus = payload?.status || res?.status || null
        keepLoading = handleRiskReportNotReady(riskStatus)
      } else {
        stopRiskPolling()
      }
    } else if (!isTaskDetailMode.value) {
      riskError.value = res?.message || '拉取报告失败'
    } else if (shouldAutoPollRiskReport(currentAnalysisStatus.value, null)) {
      keepLoading = handleRiskReportNotReady(null)
    }
  } catch (err) {
    const status = err?.response?.status || err?.status
    if (status === 404) {
      riskReport.value = null
      let riskStatus = null
      try {
        const statusRes = await getRiskReportStatusAPI(analysisId)
        riskStatus = statusRes?.data?.status || statusRes?.status
      } catch {
        // 忽略 status 查询失败，仍按 analysis 状态决定是否轮询
      }
      keepLoading = handleRiskReportNotReady(riskStatus)
    } else if (!isTaskDetailMode.value) {
      riskError.value = err?.message || '拉取风险报告失败'
    } else if (shouldAutoPollRiskReport(currentAnalysisStatus.value, null)) {
      keepLoading = handleRiskReportNotReady(null)
    }
  } finally {
    if (!keepLoading && !isRiskReportPolling()) {
      riskLoading.value = false
    }
  }
}

const regenerateRiskReport = async () => {
  const analysisId = effectiveAnalysisId.value
  if (!analysisId) {
    ElMessage.warning('请先选择分析批次')
    return
  }
  riskLoading.value = true
  riskError.value = ''
  try {
    const res = await triggerRiskAnalysisAPI(analysisId, {
      risk_prompt_id: config.riskPromptId || '',
      risk_prompt: config.riskPrompt || '',
    })
    if (res?.code === 0 || res?.code === 200 || !res?.code) {
      ElMessage.success('风险分析已触发,正在生成...')
      startRiskPolling()
    } else {
      riskError.value = res?.message || '触发风险分析失败'
      ElMessage.error(riskError.value)
    }
  } catch (err) {
    riskError.value = '触发风险分析失败:后端尚未就绪'
    ElMessage.error(riskError.value)
  } finally {
    riskLoading.value = false
  }
}

const startRiskPolling = () => {
  if (riskPollTimer) return
  if (isTaskDetailMode.value) {
    riskLoading.value = true
    riskError.value = ''
  }
  riskPollTimer = setInterval(async () => {
    const analysisId = effectiveAnalysisId.value
    if (!analysisId) {
      stopRiskPolling()
      riskLoading.value = false
      return
    }
    try {
      const res = await getRiskReportStatusAPI(analysisId)
      const status = res?.data?.status || res?.status
      if (status === 'SUCCESS') {
        stopRiskPolling()
        if (!isTaskDetailMode.value) {
          ElMessage.success('风险分析完成')
        }
        await loadRiskReport()
      } else if (status === 'FAILED') {
        stopRiskPolling()
        riskLoading.value = false
        riskError.value = res?.data?.message || res?.message || '风险分析失败'
        if (!isTaskDetailMode.value) {
          ElMessage.error(riskError.value)
        }
      }
    } catch (err) {
      stopRiskPolling()
      if (isTaskDetailMode.value) {
        riskLoading.value = false
      }
    }
  }, 3000)
}

const handleRiskExport = async () => {
  const analysisId = effectiveAnalysisId.value
  if (!analysisId) {
    ElMessage.warning('无法导出：缺少分析ID')
    return
  }
  if (!riskReport.value) {
    ElMessage.warning('暂无风险报告可导出')
    return
  }
  try {
    const response = await exportRiskReportHtmlAPI(analysisId)
    const blob = response.data || response

    if (!blob || blob.size === 0) {
      ElMessage.error('导出文件为空，请检查数据')
      return
    }

    if (blob.type === 'application/json' || blob.type === 'text/plain') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const errorData = JSON.parse(e.target.result)
          ElMessage.error(errorData.message || '导出失败')
        } catch {
          ElMessage.error('导出失败：' + e.target.result)
        }
      }
      reader.readAsText(blob)
      return
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    const analysisSuffix = analysisId.slice(0, 8)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `风险分析报告_${analysisSuffix}_${dateStr}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success('风险报告已导出为 HTML')
  } catch (err) {
    console.error('风险报告 HTML 导出失败:', err)
    ElMessage.error('导出失败：' + (err.message || '网络错误'))
  }
}

watch(currentAnalysisId, (newId) => {
  riskReport.value = null
  riskError.value = ''
  if (!newId) {
    return
  }
  // 已在风险 Tab 且切换分析批次时，按需刷新
  if (mainActiveTab.value === 'risk') {
    loadRiskReport()
  }
})

watch(mainActiveTab, (tab) => {
  if (tab === 'risk') {
    loadRiskReport()
  } else {
    stopRiskPolling()
    riskLoading.value = false
  }
})

// 分析状态变为终态且停留在风险 Tab 时，刷新报告（含后台风险分析刚完成场景）
watch(currentAnalysisStatus, (status) => {
  if (mainActiveTab.value !== 'risk') return
  const upper = String(status || '').toUpperCase()
  if (upper === 'COMPLETED' || upper === 'RUNNING' || upper === 'PENDING') {
    loadRiskReport()
  }
})

// 切换到风险分析 Tab
const switchToRiskTab = () => {
  mainActiveTab.value = 'risk'
}

// 切换到深度分析 Tab
const switchToDeepTab = () => {
  mainActiveTab.value = 'deep'
}

// 进度弹窗状态
const progressDialogVisible = ref(false)
// 当前分析的最终状态（COMPLETED/FAILED/CANCELLED），用于传递给 FileUploadPanel
const progressAnalysisStatus = ref('')
// 任务中心轮询相关
const progressTaskUuid = ref('')
const progressRuntimeNodes = ref([])
let progressPollTimer = null
const PROGRESS_POLL_INTERVAL = 2000
const MAX_PROGRESS_POLL_MS = 10 * 60 * 1000
let progressPollStart = 0
/** 执行成功后自动跳转任务中心的延迟（毫秒） */
const TASK_CENTER_AUTO_NAV_MS = 5000
/** 进度悬浮球是否展示 */
const progressFloatingVisible = ref(false)
/** 进度悬浮球已运行秒数 */
const progressElapsedSeconds = ref(0)
/** 关闭进度弹窗时是否保持轮询（最小化为悬浮球） */
const progressKeepPollingOnDialogClose = ref(false)
let progressElapsedTimer = null
let taskCenterAutoNavTimer = null

// 当前上传的文件列表（用于恢复）
const uploadedFiles = ref([])

const sidebarCore = useSimpleOcrLeftSidebar({
  files: uploadedFiles,
  canSelectFileType: ['.pdf', '.doc', '.docx', '.wps']
})

const {
  leftSidebarBindings,
  addFilesFromManager,
  clearFiles,
  buildExecutePayload,
  hasExecuteTargets,
  restoreSelectionFromFiles
} = sidebarCore

const taskFilePreviewVisible = ref(false)
const taskFilePreviewTitle = ref('文件预览')
const taskFolderPreviewActive = ref(false)
const taskFolderPreviewName = ref('')
const taskFolderPreviewFiles = ref([])
const taskFolderPreviewLoading = ref(false)
const taskFolderPreviewRemote = ref(false)
const taskFolderPreviewTotal = ref(0)
const taskFolderPreviewPage = ref(1)
const taskFolderPreviewPageSize = ref(100)
const taskFolderPreviewFolderId = ref('')
const taskFolderPreviewPath = ref('')
const taskPreviewCurrentFile = ref(null)

/** 任务详情：预览模式侧栏数据 */
const rawTaskDetail = ref(null)
const taskPreviewFileList = ref([])
const taskPreviewSearchKeyword = ref('')
const taskPreviewTreeRenderKey = ref(0)
const taskPreviewShowFilePreview = ref(false)

const taskPreviewTaskName = computed(() => props.taskName || '会议纪要解析结果')

const taskPreviewFileTreeProps = {
  value: 'treeKey',
  label: 'name',
  children: 'children'
}

/**
 * 预览侧栏基础树（稳定引用；状态刷新时就地 patch）
 */
const taskPreviewSidebarTreeBase = ref([])

/**
 * 根据当前详情重建预览侧栏基础树
 * @returns {void}
 */
const rebuildTaskPreviewSidebarTreeBase = () => {
  taskPreviewSidebarTreeBase.value = buildPreviewSidebarTreeFromDetail(
    rawTaskDetail.value,
    taskPreviewFileList.value
  )
}

/**
 * 写入或就地刷新任务预览侧栏（文件集合未变时只更新状态）
 * @param {Object} detailRes 任务详情
 * @param {boolean} [forceRebuild=false] 是否强制整树重建
 * @returns {void}
 */
const applyTaskDetailToMeetingPreviewSidebar = (detailRes, forceRebuild = false) => {
  if (!detailRes) {
    rawTaskDetail.value = null
    taskPreviewFileList.value = []
    taskPreviewSidebarTreeBase.value = []
    return
  }
  const incomingFiles = convertTaskResultListForPreview(
    detailRes.task_schedule_result_list || []
  )
  const canPatch = !forceRebuild
    && taskPreviewFileList.value.length > 0
    && taskPreviewSidebarTreeBase.value.length > 0
    && isSamePreviewFileIdSet(taskPreviewFileList.value, incomingFiles)

  if (canPatch) {
    patchPreviewFileListStatusesInPlace(
      taskPreviewFileList.value,
      detailRes.task_schedule_result_list || incomingFiles
    )
    patchPreviewTreeFolderStatusesInPlace(
      taskPreviewSidebarTreeBase.value,
      taskPreviewFileList.value
    )
    if (rawTaskDetail.value) {
      ;['task_status', 'task_name', 'runtime_nodes', 'step_tree'].forEach((key) => {
        if (detailRes[key] !== undefined) {
          rawTaskDetail.value[key] = detailRes[key]
        }
      })
    } else {
      rawTaskDetail.value = detailRes
    }
    return
  }

  rawTaskDetail.value = detailRes
  taskPreviewFileList.value = incomingFiles
  rebuildTaskPreviewSidebarTreeBase()
  taskPreviewTreeRenderKey.value += 1
}

/**
 * 预览侧栏展示树（含搜索过滤）
 * @returns {Array} 树节点
 */
const taskPreviewSidebarTree = computed(() => {
  const keyword = String(taskPreviewSearchKeyword.value || '').trim().toLowerCase()
  if (!keyword) return taskPreviewSidebarTreeBase.value
  return taskPreviewSidebarTreeBase.value
    .map((node) => filterLeftTreeNodeByKeyword(node, keyword))
    .filter(Boolean)
})

/**
 * 预览侧栏运行节点（进度树，可选）
 * @returns {Array} 运行节点
 */
const taskPreviewRuntimeNodes = computed(() => {
  const detail = rawTaskDetail.value || {}
  if (Array.isArray(detail.runtime_nodes) && detail.runtime_nodes.length > 0) {
    return detail.runtime_nodes
  }
  if (Array.isArray(detail.step_tree) && detail.step_tree.length > 0) {
    return detail.step_tree
  }
  return []
})

/**
 * 判断预览侧栏文件是否为当前激活项
 * @param {Object} file 文件对象
 * @returns {boolean} 是否激活
 */
const isTaskPreviewFileActive = (file) => {
  if (!file || !taskPreviewCurrentFile.value) return false
  const activeId = taskPreviewCurrentFile.value.fileId
    || taskPreviewCurrentFile.value.file_uuid
    || taskPreviewCurrentFile.value.file_id
  const fileId = file.result_uuid || file.file_uuid || file.file_id || getFileIdentifier(file)
  return activeId && fileId && String(activeId) === String(fileId)
}

/**
 * 任务详情预览侧栏 bindings
 * @returns {Object} 侧栏绑定
 */
const taskPreviewSidebarBindings = computed(() => ({
  showFilePreview: taskPreviewShowFilePreview,
  searchKeyword: taskPreviewSearchKeyword,
  fileTreeData: taskPreviewSidebarTree,
  fileTreeRenderKey: taskPreviewTreeRenderKey,
  fileTreeProps: taskPreviewFileTreeProps,
  isFileActive: isTaskPreviewFileActive,
  handleTreeNodeClick: handleMeetingTaskTreeNodeClick,
  getTreeNodeDisplayName: leftSidebarBindings.getTreeNodeDisplayName,
  previewTaskName: taskPreviewTaskName,
  previewRuntimeNodes: taskPreviewRuntimeNodes,
  icons: {
    Hide,
    View,
    Search,
    Document,
    Folder,
    Delete,
    Plus
  }
}))

/**
 * 从任务中心加载预览侧栏（文件夹树 + 文件执行状态）
 * @returns {Promise<void>}
 */
const loadTaskCenterPreviewSidebar = async () => {
  const id = props.taskId
  if (!id || !isTaskDetailMode.value) return
  try {
    const res = await getTaskSchedulesAPI(id, {
      prefer_runtime: true,
      include_results: true,
      include_selection_summary: true
    })
    if (res.code !== 200 || !res.data) return
    applyTaskDetailToMeetingPreviewSidebar({
      ...res.data,
      selection_summary: normalizeSelectionSummary(res.data)
    })
  } catch (error) {
    console.warn('加载任务预览侧栏失败:', error)
  }
}

/**
 * 解析侧栏树节点对应的源文件
 * @param {Object} treeNode 树节点
 * @returns {Object|null} 文件对象
 */
const resolveSourceFileFromTreeNode = (treeNode) => {
  const source = treeNode?.sourceFile
  if (!source) return null
  const id = source.result_uuid || source.file_uuid || source.file_id || getFileIdentifier(source)
  if (!id) return source
  return (taskPreviewFileList.value || []).find((f) => {
    const fid = f.result_uuid || f.file_uuid || f.file_id
    return String(fid) === String(id)
  }) || source
}

/**
 * 远程文件夹文件行转为预览列表项
 * @param {Object} raw 接口行
 * @param {string} folderPath 文件夹路径
 * @returns {Object} 预览项
 */
const mapTaskFolderPreviewRemoteFileRow = (raw, folderPath) => {
  const fileId = raw.file_id || raw.file_uuid || raw.document_id || ''
  const fileName = raw.file_name || raw.name || '文件'
  return {
    fileId,
    file_uuid: fileId,
    file_name: fileName,
    name: fileName,
    folderPath: folderPath || '',
    folder_path: folderPath || '',
    document_parse_status: raw.document_parse_status || raw.parse_status || 'parsed'
  }
}

/**
 * 按 folder_id 加载文件夹预览列表
 * @param {string} folderId 文件夹 ID
 * @param {string} folderPath 文件夹路径
 * @param {string} folderName 文件夹名称
 * @param {number} page 页码
 * @returns {Promise<void>}
 */
const loadTaskFolderPreviewByFolderId = async (folderId, folderPath, folderName, page) => {
  taskFolderPreviewFolderId.value = folderId
  taskFolderPreviewPath.value = normalizeFolderPathForTree(folderPath || '')
  taskFolderPreviewName.value = folderName || folderPath || '文件夹'
  taskFolderPreviewPage.value = page
  taskFolderPreviewLoading.value = true
  taskFolderPreviewRemote.value = true
  try {
    const res = await getFileListAPI(
      buildFolderFileListQueryParams(
        { folder_id: folderId, page, page_size: taskFolderPreviewPageSize.value },
        { allowUnparsed: false }
      )
    )
    if (res.code === 200 && res.data) {
      const rows = Array.isArray(res.data.items) ? res.data.items : (Array.isArray(res.data) ? res.data : [])
      taskFolderPreviewTotal.value = Number(res.data.total || rows.length)
      taskFolderPreviewFiles.value = rows.map((raw) =>
        mapTaskFolderPreviewRemoteFileRow(raw, taskFolderPreviewPath.value)
      )
    } else {
      taskFolderPreviewTotal.value = 0
      taskFolderPreviewFiles.value = []
    }
  } catch (error) {
    console.error('加载文件夹文件失败:', error)
    taskFolderPreviewTotal.value = 0
    taskFolderPreviewFiles.value = []
  } finally {
    taskFolderPreviewLoading.value = false
  }
}

/**
 * 根据文件名推断预览类型
 * @param {string} fileName 文件名
 * @returns {string} 文件类型
 */
const inferPreviewFileType = (fileName) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  if (ext === 'xlsx' || ext === 'xlsm') return ext
  if (ext === 'xls') return 'xls'
  if (ext === 'csv') return 'csv'
  if (ext === 'txt') return 'txt'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
  return 'pdf'
}

/**
 * 构建任务详情预览文件对象（补全 type 等 PreviewFile 所需字段）
 * @param {Object} source 源文件或列表行
 * @returns {Object} 预览文件对象
 */
const buildTaskPreviewFile = (source) => {
  const fileId = getFileIdentifier(source) || source.fileId || source.file_uuid || source.file_id || ''
  const name = source.name || source.file_name || '文件预览'
  const existingType = source.type && source.type !== '-' ? source.type : ''
  return {
    ...source,
    id: fileId,
    fileId,
    file_uuid: fileId,
    name,
    file_name: name,
    type: existingType || inferPreviewFileType(name)
  }
}

/**
 * 任务详情侧栏树节点点击
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} [event] 点击事件
 * @returns {Promise<void>}
 */
const handleMeetingTaskTreeNodeClick = async (treeNode, event) => {
  void event
  if (!treeNode) return
  if (treeNode.nodeType === 'file') {
    const sourceFile = resolveSourceFileFromTreeNode(treeNode)
    if (!sourceFile) {
      ElMessage.warning('文件信息不完整，无法预览')
      return
    }
    taskFolderPreviewActive.value = false
    taskPreviewCurrentFile.value = buildTaskPreviewFile(sourceFile)
    taskFilePreviewTitle.value = taskPreviewCurrentFile.value.name || '文件预览'
    const fileId = getFileIdentifier(sourceFile)
    if (fileId) {
      try {
        const previewRes = await previewFileAPI(fileId)
        if (previewRes.code === 200 && previewRes.data?.preview_url) {
          taskPreviewCurrentFile.value.previewUrl = previewRes.data.preview_url
        }
      } catch (error) {
        console.warn('获取预览地址失败:', error)
      }
    }
    taskFilePreviewVisible.value = true
    return
  }
  if (treeNode.nodeType === 'folder') {
    taskPreviewCurrentFile.value = null
    taskFolderPreviewActive.value = true
    taskFilePreviewTitle.value = treeNode.name || '文件夹预览'
    const folderId = treeNode.folderId || ''
    const folderPath = treeNode.folderPath || ''
    const folderName = treeNode.name || ''
    if (folderId) {
      await loadTaskFolderPreviewByFolderId(folderId, folderPath, folderName, 1)
      taskFilePreviewVisible.value = true
      return
    }
    const folderPathNorm = normalizeFolderPathForTree(folderPath)
    const localFiles = (taskPreviewFileList.value || []).filter((file) => {
      const refs = Array.isArray(file.source_refs) ? file.source_refs : []
      return refs.some((ref) => {
        const refPath = normalizeFolderPathForTree(ref.folder_path || ref.source_name || '')
        if (!folderPathNorm) return !refPath
        return refPath === folderPathNorm || refPath.startsWith(`${folderPathNorm}/`)
      })
    })
    taskFolderPreviewRemote.value = false
    taskFolderPreviewTotal.value = localFiles.length
    taskFolderPreviewFiles.value = localFiles.map((file) => ({
      fileId: file.file_uuid || file.file_id || file.result_uuid,
      file_uuid: file.file_uuid || file.file_id || file.result_uuid,
      file_name: file.file_name || '文件',
      name: file.file_name || '文件',
      folderPath: folderPathNorm,
      folder_path: folderPathNorm
    }))
    taskFilePreviewVisible.value = true
  }
}

/**
 * 文件夹预览分页切换
 * @param {number} page 页码
 * @returns {Promise<void>}
 */
const handleTaskFolderPreviewPageChange = async (page) => {
  if (!taskFolderPreviewFolderId.value) return
  await loadTaskFolderPreviewByFolderId(
    taskFolderPreviewFolderId.value,
    taskFolderPreviewPath.value,
    taskFolderPreviewName.value,
    page
  )
}

/**
 * 文件夹预览列表中查看文件
 * @param {Object} fileRow 文件行
 * @returns {Promise<void>}
 */
const handleTaskFolderPreviewViewFile = async (fileRow) => {
  const fileId = fileRow?.fileId || fileRow?.file_uuid || fileRow?.file_id
  if (!fileId) return
  taskFolderPreviewActive.value = false
  taskPreviewCurrentFile.value = buildTaskPreviewFile({
    fileId,
    file_uuid: fileId,
    name: fileRow.name || fileRow.file_name || '文件',
    file_name: fileRow.name || fileRow.file_name || '文件'
  })
  taskFilePreviewTitle.value = taskPreviewCurrentFile.value.name
  try {
    const previewRes = await previewFileAPI(fileId)
    if (previewRes.code === 200 && previewRes.data?.preview_url) {
      taskPreviewCurrentFile.value.previewUrl = previewRes.data.preview_url
    }
  } catch (error) {
    console.warn('获取预览地址失败:', error)
  }
}

const taskNameDialogVisible = ref(false)
const taskNameInput = ref('')
const taskRemarkInput = ref('')

/**
 * 生成默认会议纪要任务名称
 * @returns {string} 任务名称
 */
const generateDefaultTaskName = () => {
  const now = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `会议纪要【${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}】`
}

/**
 * 打开执行前任务名弹窗
 * @returns {void}
 */
const openExecuteDialog = () => {
  if (isAnalyzing.value) {
    return
  }
  if (!hasExecuteTargets.value) {
    ElMessage.warning('没有可执行的文件或文件夹')
    return
  }
  taskNameInput.value = generateDefaultTaskName()
  taskRemarkInput.value = ''
  taskNameDialogVisible.value = true
}

/**
 * 确认后台执行分析
 * @returns {void}
 */
const confirmBackgroundExecute = () => {
  if (!hasExecuteTargets.value) {
    ElMessage.warning('没有可执行的文件或文件夹')
    return
  }
  taskNameDialogVisible.value = false
  handleExecute({
    taskName: taskNameInput.value,
    taskRemark: taskRemarkInput.value
  })
}

// 当前选中的聚类对象
const selectedCluster = computed(() => {
  if (selectedClusterIndex.value === null) return null
  return clusters.value[selectedClusterIndex.value]
})

// 保存分析状态到 localStorage（仅保存分析结果，文件缓存由 FileUploadPanel 管理）
const saveAnalysisState = (analysisId, analysisResult = null) => {
  try {
    const stateToSave = {
      analysisId,
      config: { ...config },
      // 保存完整的分析结果数据
      analysisResult: analysisResult ? {
        meetings: analysisResult.meetings || [],
        clusters: analysisResult.clusters || [],
        timeline: analysisResult.timeline || {},
      } : null,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    currentAnalysisId.value = analysisId
    console.log('分析状态已保存到 localStorage（包含完整结果）')
  } catch (error) {
    console.error('保存分析状态失败:', error)
  }
}

// 从 localStorage 恢复分析状态
const loadAnalysisState = async () => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY)
    if (!savedState) return false

    const state = JSON.parse(savedState)

    // 检查数据是否过期（24小时）
    const savedTime = new Date(state.timestamp)
    const now = new Date()
    const hoursDiff = (now - savedTime) / (1000 * 60 * 60)

    if (hoursDiff > 24) {
      console.log('缓存状态已过期，已清除')
      clearAnalysisState()
      return false
    }

    // 恢复配置
    if (state.config) {
      Object.assign(config, state.config)
    }

    // 页面刷新后，清除分析结果
    console.log('页面已刷新，分析结果已清除')
    return false
  } catch (error) {
    console.error('恢复分析状态失败:', error)
    clearAnalysisState()
    return false
  }
}


// 清除存储的分析状态
const clearAnalysisState = () => {
  try {
    // 只清除分析结果，保留配置
    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      const state = JSON.parse(savedState)
      // 保留 config，清除 analysisResult
      const newState = {
        config: state.config || {},
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    }
    currentAnalysisId.value = null
    console.log('已清除分析结果')
  } catch (error) {
    console.error('清除分析状态失败:', error)
  }
}

// 选中会议（仅高亮切换，index 为原始索引）
const handleSelectMeeting = (index) => {
  selectedMeetingIndex.value = selectedMeetingIndex.value === index ? null : index
}

import { eventBus } from '@/utils/eventBus.js'
/**
 * 执行分析：按 BatchExecuteByFilter 提交文件+文件夹
 * @param {Object} params 执行参数
 * @param {string} params.taskName 任务名称
 * @param {string} params.taskRemark 任务备注
 * @returns {Promise<void>}
 */
const handleExecute = async ({ taskName, taskRemark }) => {
  if (!hasExecuteTargets.value) {
    ElMessage.warning('没有可执行的文件或文件夹')
    return
  }

  const payload = buildExecutePayload({
    taskName,
    taskRemark,
    toolLabel: props.toolLabel || '会议纪要分析',
    analysisConfig: {
      similarityThreshold: config.similarityThreshold,
      minClusterSize: config.minClusterSize,
      maxClusterSize: config.maxClusterSize,
      prompt: config.prompt,
      promptId: config.promptId,
      riskPrompt: config.riskPrompt,
      riskPromptId: config.riskPromptId,
    }
  })

  const fileCount = (payload.files || []).length
  const folderCount = (payload.folders || []).length
  console.log(
    `开始执行会议纪要 BatchExecuteByFilter，files: ${fileCount}, folders: ${folderCount}`
  )

  try {
    await runBatchExecuteWithTimeoutNav({
      taskName,
      requestFn: () => meetingMinutesBatchExecuteByFilterAPI(payload),
      openTaskCenter: () => openTaskCenterWithRefresh(router, homeStore),
      onError: (error) => {
        isAnalyzing.value = false
        ElMessage.error(error?.message || '提交会议纪要分析失败，请稍后重试')
      },
      onResponse: (analysisRes, { timeoutFallbackTriggered }) => {
        if (analysisRes?.code !== 200 && analysisRes?.code !== 201) {
          if (!timeoutFallbackTriggered) {
            ElMessage.error(analysisRes?.message || '会议纪要分析任务创建失败')
          } else {
            console.warn('超时兜底已触发，后续接口返回失败:', analysisRes)
          }
          isAnalyzing.value = false
          return
        }

        const analysisId = analysisRes?.data?.analysis_id
        const taskUuid = analysisRes?.data?.task_uuid
        if (!analysisId) {
          if (!timeoutFallbackTriggered) {
            ElMessage.error('会议纪要分析接口返回为空')
          }
          isAnalyzing.value = false
          return
        }

        if (!timeoutFallbackTriggered) {
          ElMessage.success(analysisRes?.message || '会议纪要后台分析任务已创建')
        }

        beginPostExecuteProgressFlow({
          analysisId,
          taskUuid,
          taskName,
          skipAutoNav: !!timeoutFallbackTriggered,
        })
      }
    })
  } catch (error) {
    console.error('提交会议纪要分析失败:', error)
    isAnalyzing.value = false
    ElMessage.error(error?.message || '提交会议纪要分析失败，请稍后重试')
  }
}

/**
 * 启动进度悬浮球计时
 * @returns {void}
 */
const startProgressElapsedTimer = () => {
  stopProgressElapsedTimer()
  progressElapsedSeconds.value = 0
  progressElapsedTimer = setInterval(() => {
    progressElapsedSeconds.value += 0.1
  }, 100)
}

/**
 * 停止进度悬浮球计时
 * @returns {void}
 */
const stopProgressElapsedTimer = () => {
  if (progressElapsedTimer) {
    clearInterval(progressElapsedTimer)
    progressElapsedTimer = null
  }
}

/**
 * 清除自动跳转任务中心定时器
 * @returns {void}
 */
const clearTaskCenterAutoNavTimer = () => {
  if (taskCenterAutoNavTimer) {
    clearTimeout(taskCenterAutoNavTimer)
    taskCenterAutoNavTimer = null
  }
}

/**
 * 进度弹窗最小化为悬浮球（保持轮询）
 * @returns {void}
 */
const minimizeProgressToFloatingBall = () => {
  progressKeepPollingOnDialogClose.value = true
  progressDialogVisible.value = false
  progressFloatingVisible.value = true
}

/**
 * 点击悬浮球重新打开进度弹窗
 * @returns {void}
 */
const showProgressDialogFromFloatingBall = () => {
  progressFloatingVisible.value = false
  progressDialogVisible.value = true
}

/**
 * 安排执行成功后 5 秒跳转任务中心；独立页同时最小化为悬浮球
 * @param {Object} [options] - 配置项
 * @param {boolean} [options.minimizeLocalDialog=true] - 是否在跳转前收起本页进度弹窗
 * @returns {void}
 */
const scheduleAutoNavigateTaskCenter = (options = {}) => {
  const minimizeLocalDialog = options.minimizeLocalDialog !== false
  clearTaskCenterAutoNavTimer()
  if (isTaskDetailMode.value) return

  taskCenterAutoNavTimer = setTimeout(() => {
    taskCenterAutoNavTimer = null
    if (minimizeLocalDialog) {
      minimizeProgressToFloatingBall()
    }
    openTaskCenterWithRefresh(router, homeStore)
    ElMessage.info('任务在后台执行，可在任务中心查看进度')
  }, TASK_CENTER_AUTO_NAV_MS)
}

/**
 * 关闭进度弹窗并最小化为悬浮球（保持轮询）
 * @returns {void}
 */
const handleProgressDismiss = () => {
  minimizeProgressToFloatingBall()
}

/**
 * 任务创建成功后：展示进度弹窗、启动轮询与 5 秒跳转任务中心
 * @param {Object} params 参数
 * @param {string} params.analysisId 分析 ID
 * @param {string} [params.taskUuid] 任务 UUID
 * @param {string} [params.taskName] 任务名称
 * @param {boolean} [params.skipAutoNav] 是否跳过自动跳转（接口超时兜底已跳转时）
 * @returns {void}
 */
const beginPostExecuteProgressFlow = ({ analysisId, taskUuid, taskName, skipAutoNav = false }) => {
  isAnalyzing.value = true
  currentAnalysisStatus.value = ''
  selectedMeetingIndex.value = null
  selectedClusterIndex.value = null
  detailTableData.value = []
  meetings.value = []
  displayedMeetings.value = []
  clusters.value = []
  extractFields.value = null
  progressAnalysisId.value = analysisId
  currentAnalysisId.value = analysisId
  progressAnalysisStatus.value = ''
  progressFloatingVisible.value = false
  progressKeepPollingOnDialogClose.value = false

  const parentOverlay = usesParentProgressOverlay.value

  if (!parentOverlay) {
    progressDialogVisible.value = true
    startProgressTracking(analysisId, taskUuid || '')
    startProgressElapsedTimer()
  }

  if (taskUuid && props.eventKey) {
    eventBus.emit(props.eventKey, {
      taskUuid,
      taskName,
      taskOther: { analysis_id: analysisId }
    })
  } else if (parentOverlay && taskUuid) {
    // 父级遮罩场景理论上必有 eventKey；兜底仍不在本页重复弹窗
  } else if (parentOverlay) {
    startAnalysisStatusPolling(analysisId)
    startProgressElapsedTimer()
  }

  if (!skipAutoNav) {
    scheduleAutoNavigateTaskCenter({ minimizeLocalDialog: !parentOverlay })
  } else if (!parentOverlay) {
    minimizeProgressToFloatingBall()
  }
}

/**
 * 从父级回调或本地状态中解析会议纪要 analysis_id
 * @param {Array} result 任务结果列表
 * @param {Object} [taskOther] 父级透传的上下文
 * @returns {string} 分析 ID
 */
const resolveAnalysisIdFromSetResult = (result, taskOther) => {
  if (taskOther?.analysis_id) {
    return String(taskOther.analysis_id)
  }
  if (progressAnalysisId.value) {
    return progressAnalysisId.value
  }
  if (currentAnalysisId.value) {
    return currentAnalysisId.value
  }
  if (initialAnalysisId.value) {
    return initialAnalysisId.value
  }

  const list = Array.isArray(result) ? result : []
  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i]?.parameter_settings
    if (!raw) continue
    try {
      const settings = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (settings?.analysis_id) {
        return String(settings.analysis_id)
      }
    } catch (error) {
      console.warn('[会议纪要] 解析 parameter_settings 失败:', error)
    }
  }
  return ''
}

/**
 * 父级任务进度遮罩完成后回填结果
 * @param {Array} result 任务结果列表
 * @param {Object} [taskOther] 父级透传的上下文（含 analysis_id）
 * @returns {Promise<void>}
 */
const setResult = async (result, taskOther) => {
  const analysisId = resolveAnalysisIdFromSetResult(result, taskOther)
  if (!analysisId) {
    isAnalyzing.value = false
    ElMessage.warning('任务已完成但未获取到分析ID，无法展示结果')
    return
  }

  progressAnalysisId.value = analysisId
  currentAnalysisId.value = analysisId

  try {
    const res = await getAnalysisDetailAPI(analysisId)
    const data = res?.data
    if (!data) {
      isAnalyzing.value = false
      ElMessage.error('未获取到会议纪要分析结果')
      return
    }

    const status = data.analysis_summary?.status || data.status || ''
    if (TERMINAL_ANALYSIS_STATUSES.has(status)) {
      isAnalyzing.value = false
      await loadAnalysisDetailFromData(analysisId, data)
      ElMessage.success('分析完成')
      return
    }

    // 文件子任务已完成但分析汇总仍进行中：继续轮询详情直至终态
    isAnalyzing.value = true
    startAnalysisStatusPolling(analysisId)
  } catch (error) {
    console.error('[会议纪要] setResult 加载分析详情失败:', error)
    isAnalyzing.value = false
    ElMessage.error('加载会议纪要分析结果失败，请稍后重试')
  }
}

/**
 * 父级任务进度遮罩通知任务失败，仍加载当前可得详情
 * @returns {Promise<void>}
 */
const taskError = async () => {
  isAnalyzing.value = false
  const analysisId =
    progressAnalysisId.value ||
    currentAnalysisId.value ||
    initialAnalysisId.value ||
    ''
  if (analysisId) {
    await loadAnalysisDetail(analysisId)
  }
}

defineExpose({
  setResult,
  taskError
})

/** 进度轮询是否已结束，避免重复触发加载详情 */
let progressPollFinished = false
/** 无 task_uuid 时退化为轮询分析详情接口 */
let analysisStatusPollTimer = null

/**
 * 停止 GetTaskSchedules 任务进度轮询
 * @returns {void}
 */
const stopProgressPolling = () => {
  if (progressPollTimer) {
    clearInterval(progressPollTimer)
    progressPollTimer = null
  }
}

/**
 * 停止分析详情状态轮询（无 task_uuid 时的兜底）
 * @returns {void}
 */
const stopAnalysisStatusPolling = () => {
  if (analysisStatusPollTimer) {
    clearInterval(analysisStatusPollTimer)
    analysisStatusPollTimer = null
  }
}

/**
 * 轮询结束后关闭进度弹窗并加载分析详情（成功/失败均展示当前可得结果）
 * @param {'COMPLETED'|'FAILED'} status 终态
 * @returns {Promise<void>}
 */
const finishProgressAndLoadDetail = async (status) => {
  if (progressPollFinished) return
  progressPollFinished = true
  stopProgressPolling()
  stopAnalysisStatusPolling()
  stopProgressElapsedTimer()
  clearTaskCenterAutoNavTimer()
  progressAnalysisStatus.value = status
  currentAnalysisStatus.value = status
  isAnalyzing.value = false
  progressDialogVisible.value = false
  progressFloatingVisible.value = false
  progressKeepPollingOnDialogClose.value = false

  const analysisId = progressAnalysisId.value
  if (!analysisId) return

  if (isTaskDetailMode.value) {
    initialLoading.value = true
  }
  try {
    await loadAnalysisDetail(analysisId)
    await loadTaskCenterPreviewSidebar()
    if (status === 'COMPLETED') {
      ElMessage.success('分析完成')
    } else {
      ElMessage.error('分析失败，已展示当前任务详情')
    }
  } finally {
    if (isTaskDetailMode.value) {
      initialLoading.value = false
    }
  }
}

/**
 * 单次轮询 GetTaskSchedules 任务进度
 * @param {string} taskUuid 任务 UUID
 * @returns {Promise<void>}
 */
const pollProgressOnce = async (taskUuid) => {
  if (progressPollFinished) return

  if (Date.now() - progressPollStart > MAX_PROGRESS_POLL_MS) {
    await finishProgressAndLoadDetail('FAILED')
    return
  }

  try {
    const res = await getTaskSchedulesAPI(taskUuid, {
      prefer_runtime: true,
      include_results: isTaskDetailMode.value,
      include_selection_summary: isTaskDetailMode.value
    })
    if (progressPollFinished) return
    if (res.code !== 200 || !res.data) return

    const td = res.data
    if (isTaskDetailMode.value) {
      applyTaskDetailToMeetingPreviewSidebar({
        ...td,
        selection_summary: normalizeSelectionSummary(td)
      })
    }
    const nodes =
      Array.isArray(td.runtime_nodes) && td.runtime_nodes.length
        ? td.runtime_nodes
        : Array.isArray(td.step_tree)
          ? td.step_tree
          : []
    progressRuntimeNodes.value = nodes

    if (td.task_status === 2) {
      await finishProgressAndLoadDetail('COMPLETED')
    } else if (td.task_status === 3) {
      await finishProgressAndLoadDetail('FAILED')
    }
  } catch (e) {
    console.error('[进度轮询] 查询失败:', e)
  }
}

/**
 * 启动 GetTaskSchedules 任务进度轮询
 * @param {string} taskUuid 任务 UUID
 * @returns {void}
 */
const startProgressPolling = (taskUuid) => {
  if (!taskUuid) return
  progressPollFinished = false
  stopProgressPolling()
  stopAnalysisStatusPolling()
  progressPollStart = Date.now()
  progressRuntimeNodes.value = []
  progressAnalysisStatus.value = ''
  progressTaskUuid.value = taskUuid
  pollProgressOnce(taskUuid)
  progressPollTimer = setInterval(() => pollProgressOnce(taskUuid), PROGRESS_POLL_INTERVAL)
}

/**
 * 单次轮询分析详情状态（无 task_uuid 时的兜底）
 * @param {string} analysisId 分析 ID
 * @returns {Promise<void>}
 */
const pollAnalysisStatusOnce = async (analysisId) => {
  if (progressPollFinished) return

  if (Date.now() - progressPollStart > MAX_PROGRESS_POLL_MS) {
    await finishProgressAndLoadDetail('FAILED')
    return
  }

  try {
    const res = await getAnalysisDetailAPI(analysisId)
    if (progressPollFinished) return
    const data = res?.data
    if (!data) return

    const status = data.analysis_summary?.status || data.status || ''
    if (status === 'COMPLETED') {
      progressPollFinished = true
      stopAnalysisStatusPolling()
      stopProgressPolling()
      stopProgressElapsedTimer()
      clearTaskCenterAutoNavTimer()
      progressAnalysisStatus.value = 'COMPLETED'
      currentAnalysisStatus.value = 'COMPLETED'
      isAnalyzing.value = false
      progressDialogVisible.value = false
      progressFloatingVisible.value = false
      await loadAnalysisDetailFromData(analysisId, data)
      ElMessage.success('分析完成')
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      await finishProgressAndLoadDetail('FAILED')
    }
  } catch (e) {
    console.error('[分析状态轮询] 查询失败:', e)
  }
}

/**
 * 启动分析详情状态轮询（task_uuid 不可用时兜底）
 * @param {string} analysisId 分析 ID
 * @returns {void}
 */
const startAnalysisStatusPolling = (analysisId) => {
  if (!analysisId) return
  progressPollFinished = false
  stopProgressPolling()
  stopAnalysisStatusPolling()
  progressPollStart = Date.now()
  progressRuntimeNodes.value = []
  progressAnalysisStatus.value = ''
  pollAnalysisStatusOnce(analysisId)
  analysisStatusPollTimer = setInterval(
    () => pollAnalysisStatusOnce(analysisId),
    PROGRESS_POLL_INTERVAL
  )
}

/**
 * 打开进度弹窗后启动轮询（优先 task_uuid，否则退化为分析详情轮询）
 * @param {string} analysisId 分析 ID
 * @param {string} [taskUuid] 任务 UUID
 * @returns {void}
 */
const startProgressTracking = (analysisId, taskUuid) => {
  progressAnalysisId.value = analysisId
  const resolvedTaskUuid = taskUuid || props.taskId || progressTaskUuid.value || ''
  if (resolvedTaskUuid) {
    startProgressPolling(resolvedTaskUuid)
  } else {
    startAnalysisStatusPolling(analysisId)
  }
}

/**
 * 分析进度弹窗：返回任务中心列表（关闭进度弹窗并通知父级关闭任务详情）
 * @returns {void}
 */
const handleProgressReturnToTaskCenter = () => {
  minimizeProgressToFloatingBall()
  if (isTaskDetailMode.value) {
    emit('close-dialog')
    return
  }
  openTaskCenterWithRefresh(router, homeStore)
  ElMessage.info('任务在后台执行，可在任务中心查看进度')
}

/**
 * 手动查看结果：关闭弹窗并加载分析数据
 * @returns {Promise<void>}
 */
const handleProgressConfirm = async () => {
  await finishProgressAndLoadDetail('COMPLETED')
}

/**
 * 进度弹窗关闭时停止全部轮询
 * @returns {void}
 */
const handleProgressDialogClosed = () => {
  if (progressKeepPollingOnDialogClose.value) {
    progressKeepPollingOnDialogClose.value = false
    progressFloatingVisible.value = true
    return
  }

  if (isAnalyzing.value && !progressPollFinished) {
    progressFloatingVisible.value = true
    return
  }

  stopProgressPolling()
  stopAnalysisStatusPolling()
  stopProgressElapsedTimer()
  clearTaskCenterAutoNavTimer()
}

/**
 * 手动关闭进度弹窗（失败场景兜底）
 * @returns {Promise<void>}
 */
const handleProgressClose = async () => {
  await finishProgressAndLoadDetail('FAILED')
}

// 从已有 API 响应数据中渲染分析结果（避免重复请求）
const loadAnalysisDetailFromData = async (analysisId, data) => {
  isAnalyzing.value = true
  selectedMeetingIndex.value = null
  selectedClusterIndex.value = null
  detailTableData.value = []
  meetings.value = []
  displayedMeetings.value = []
  clusters.value = []
  extractFields.value = null

  try {
    const timeline = data.timeline
    const mappedMeetings = buildMeetingsFromTimeline(timeline)

    meetings.value = mappedMeetings
    displayedMeetings.value = mappedMeetings
    generateClustersFromMeetings(mappedMeetings)

    currentAnalysisId.value = analysisId
    // 同步记录状态和默认聤类版本 ID
    if (data.analysis_summary) {
      currentAnalysisStatus.value = data.analysis_summary.status || ''
      currentClusterVersionId.value = data.analysis_summary.default_cluster_version_id || ''
      progressAnalysisId.value = analysisId
      progressAnalysisStatus.value = data.analysis_summary.status || ''
    }

    if (data.analysis_summary && data.analysis_summary.extract_fields) {
      extractFields.value = data.analysis_summary.extract_fields
    }

    if (data.analysis_summary) {
      const summary = data.analysis_summary
      if (summary.similarity_threshold !== null && summary.similarity_threshold !== undefined) {
        config.similarityThreshold = Math.round(summary.similarity_threshold * 100)
      }
      if (summary.min_cluster_size !== null && summary.min_cluster_size !== undefined) {
        config.minClusterSize = summary.min_cluster_size
      }
      if (summary.max_workers !== null && summary.max_workers !== undefined) {
        config.maxClusterSize = summary.max_workers
      }
      if (summary.prompt) config.prompt = summary.prompt
      if (summary.prompt_id) config.promptId = summary.prompt_id
      if (summary.risk_prompt) config.riskPrompt = summary.risk_prompt
      if (summary.risk_prompt_id) config.riskPromptId = summary.risk_prompt_id
    }

    // 回填文件列表（可增删）
    if (data.input_documents && data.input_documents.length > 0) {
      uploadedFiles.value = data.input_documents.map(doc => ({
        name: doc.file_name,
        documentId: doc.document_id,
        uploading: false,
        uploadError: false,
        parseFailed: doc.parse_status === 'FAILED',
        parseStatus: doc.parse_status,
        expired: false,
      }))
      restoreSelectionFromFiles()
    }

    if (mainActiveTab.value === 'risk') {
      await loadRiskReport()
    }
  } finally {
    isAnalyzing.value = false
  }
}

const loadAnalysisDetail = async (analysisId) => {
  if (!analysisId) {
    ElMessage.warning('缺少分析ID，无法加载分析结果')
    return
  }
  try {
    const res = await getAnalysisDetailAPI(analysisId)
    const data = res?.data
    if (!data) {
      ElMessage.error('未获取到会议纪要分析结果')
      return
    }
    await loadAnalysisDetailFromData(analysisId, data)
  } catch (error) {
    console.error('加载会议纪要分析结果失败:', error)
    ElMessage.error('加载会议纪要分析结果失败，请稍后重试')
    isAnalyzing.value = false
  }
}

// 从会议数据中提取聚类结果
const generateClustersFromMeetings = (meetingData) => {
  const clusterColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']
  const clusterMap = new Map()

  meetingData.forEach(meeting => {
    meeting.fullTopics.forEach(topic => {
      if (!clusterMap.has(topic.clusterName)) {
        clusterMap.set(topic.clusterName, [])
      }
      clusterMap.get(topic.clusterName).push({
        ...topic,
        meetingName: meeting.meetingName,
        meetingDate: meeting.date,
        attendees: meeting.attendees,
        observers: meeting.observers,
        fileName: meeting.fileName,
        sourceDocumentId: topic.sourceDocumentId,
      })
    })
  })

  let colorIndex = 0
  clusters.value = Array.from(clusterMap.entries())
    .map(([name, topics]) => ({
      name,
      labels: [name],
      count: topics.length,
      countText: `(${topics.length}个议题)`,
      color: clusterColors[colorIndex++ % clusterColors.length],
      details: topics,
    }))
    .sort((a, b) => b.count - a.count)
}

// 将后端时间轴数据转换为前端会议时间轴结构
const buildMeetingsFromTimeline = (timeline) => {
  if (!timeline || !Array.isArray(timeline.days)) {
    return []
  }

  const result = []

  timeline.days.forEach((day) => {
    const date = day.date || ''
    const meetingsInDay = Array.isArray(day.meetings) ? day.meetings : []

    meetingsInDay.forEach((meeting) => {
      // 解析attendees/observers，支持数组格式和JSON字符串格式，转换为"|"分隔的字符串
      let attendees = ''
      if (Array.isArray(meeting.attendees)) {
        attendees = meeting.attendees.join('|')
      } else if (meeting.attendees) {
        // 尝试解析JSON字符串
        try {
          const parsed = JSON.parse(meeting.attendees)
          attendees = Array.isArray(parsed) ? parsed.join('|') : String(parsed)
        } catch {
          attendees = String(meeting.attendees)
        }
      }

      let observers = ''
      if (Array.isArray(meeting.observers)) {
        observers = meeting.observers.join('|')
      } else if (meeting.observers) {
        // 尝试解析JSON字符串
        try {
          const parsed = JSON.parse(meeting.observers)
          observers = Array.isArray(parsed) ? parsed.join('|') : String(parsed)
        } catch {
          observers = String(meeting.observers)
        }
      }
      const fileName = meeting.source_file_name || ''
      const topics = Array.isArray(meeting.topics) ? meeting.topics : []

      const topicListMap = new Map()
      const fullTopics = []

      topics.forEach((topic) => {
        const clusterName = topic.cluster_name || '未分类'
        const topicName = topic.topic_name || ''
        const detailText = `[${clusterName}] ${topicName}`

        if (!topicListMap.has(clusterName)) {
          topicListMap.set(clusterName, [])
        }
        topicListMap.get(clusterName).push(detailText)

        const fullTopic = {
          topicName,
          topicContent: topic.topic_content || '',
          clusterName,
          money: topic.topic_money || '',
          sourceDocumentId: topic.source_document_id,
          attendees,
          observers,
        }

        // 添加动态字段
        if (topic.extra_fields) {
          fullTopic.extraFields = topic.extra_fields
          Object.keys(topic.extra_fields).forEach(key => {
            if (!fullTopic.hasOwnProperty(key)) {
              fullTopic[key] = topic.extra_fields[key]
            }
          })
        }

        fullTopics.push(fullTopic)
      })

      const topicList = Array.from(topicListMap.entries()).map(([clusterName, details]) => ({
        title: `${clusterName}相关议题`,
        details,
      }))

      result.push({
        date,
        meetingName: meeting.meeting_name || '',
        fileName,
        count: 1,
        topics: fullTopics.length,
        topicList,
        fullTopics,
        attendees,
        observers,
      })
    })
  })

  return result
}
// 选中聚类
const handleSelectCluster = (index) => {
  if (selectedClusterIndex.value === index) {
    selectedClusterIndex.value = null
    detailTableData.value = []
  } else {
    selectedClusterIndex.value = index
    const cluster = clusters.value[index]
    loadClusterDetail(cluster)
    // 每次选中聚类时递增，触发时间轴展开滚动（含重复选同一聚类的情况）
    clusterScrollTick.value++
  }
}

// 加载聚类详情（对齐 carl 字段: 序号/会议名称/会议日期/议题名称/议题内容/涉及金额/参会人员/列席人员/源文件）
const loadClusterDetail = (cluster) => {
  detailTableData.value = cluster.details.map((item, i) => {
    const row = {
      index: i + 1,
      meetingName: item.meetingName,
      meetingDate: item.meetingDate,
      topicName: item.topicName,
      topicContent: item.topicContent,
      money: item.money || '',
      attendees: item.attendees || '',
      observers: item.observers || '',
      sourceFile: item.fileName,
      sourceDocumentId: item.sourceDocumentId,
    }

    // 添加动态字段
    if (item.extraFields) {
      Object.assign(row, item.extraFields)
    }

    return row
  })
}

// 应用筛选
const handleApplyFilters = ({ config: newConfig, filters: newFilters }) => {
  Object.assign(config, newConfig)
  Object.assign(filters, newFilters)
  applyFiltersToData()
}

// 清除筛选（支持从 ConfigPanel 传入已清空的筛选值）
const handleClearFilters = (clearedFilters) => {
  if (clearedFilters && typeof clearedFilters === 'object') {
    // 来自 ConfigPanel 的调用,直接使用传入的清空值
    Object.assign(filters, clearedFilters)
  } else {
    // 来自其他地方的调用,手动清空所有筛选字段
    filters.participants = ''
    filters.dateStart = ''
    filters.dateEnd = ''
    filters.amountMin = ''
    filters.amountMax = ''
    filters.keywords = ''
    filters.regularExpression = false
  }
  applyFiltersToData()
}

// 处理查看结果
const handleViewResult = () => {
  if (!clusters.value || clusters.value.length === 0) {
    ElMessage.warning('暂无分析结果可查看')
    return
  }
  allTopicsDrawerVisible.value = true
}

// 导出分析结果
const handleExport = async (options = {}) => {
  const format = options.format || 'excel'
  const onDone = options.onDone || (() => {})

  if (!meetings.value.length) {
    ElMessage.warning('暂无分析结果可导出')
    onDone()
    return
  }

  // Excel格式导出 - 调用后端API
  if (format === 'excel') {
    console.log('Excel导出：currentAnalysisId =', currentAnalysisId.value)
    if (!currentAnalysisId.value) {
      ElMessage.warning('无法导出：缺少分析ID')
      onDone()
      return
    }

    try {
      const response = await exportAnalysisResultAPI(currentAnalysisId.value, {
        format: 'excel',
        include_documents: true,
        include_clusters: true
      })

      // 从响应中获取文件 - responseType: 'blob' 时，axios 返回完整的 response 对象
      const blob = response.data || response

      // 检查blob是否有效
      if (!blob || blob.size === 0) {
        ElMessage.error('导出文件为空，请检查数据')
        onDone()
        return
      }

      // 检查是否返回了JSON错误（而不是Excel文件）
      if (blob.type === 'application/json' || blob.type === 'text/plain') {
        // 读取blob内容，解析错误信息
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const errorData = JSON.parse(e.target.result)
            ElMessage.error(errorData.message || '导出失败')
          } catch {
            ElMessage.error('导出失败：' + e.target.result)
          }
          onDone()
        }
        reader.readAsText(blob)
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${props.toolLabel}结果_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      ElMessage.success('Excel导出成功')
    } catch (error) {
      console.error('Excel导出失败:', error)
      ElMessage.error('导出失败：' + (error.message || '网络错误'))
    } finally {
      onDone()
    }
    return
  }

  onDone()
}

// 导入分析结果：直接使用后端返回的解析数据
const handleImportResult = ({ analysisId, meetings: importedMeetings, clusters: importedClusters }) => {
  if (!importedMeetings || !Array.isArray(importedMeetings)) {
    ElMessage.error('导入失败：数据格式错误')
    return
  }

  // 设置当前分析ID
  currentAnalysisId.value = analysisId || null

  // 设置分析状态为 COMPLETED（导入的数据是已完成的分析结果）
  currentAnalysisStatus.value = 'COMPLETED'

  // 生成临时的 cluster_version_id（用于显示问答界面）
  // 注意：导入的数据没有 Milvus 向量数据，深度问答功能可能无法正常工作
  currentClusterVersionId.value = analysisId || Date.now().toString()

  // 转换导入的数据为组件内部格式
  meetings.value = importedMeetings.map(m => {
    // 兼容 attendees/observers 为数组或字符串两种格式
    const parseList = (val) => {
      if (Array.isArray(val)) return val
      if (!val) return []
      try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : [String(val)] } catch { return String(val).split(',').map(s => s.trim()).filter(Boolean) }
    }
    const attendeesList = parseList(m.attendees)
    const observersList = parseList(m.observers)
    const attendeesStr = attendeesList.join('|')
    const observersStr = observersList.join('|')

    const fullTopics = (Array.isArray(m.topics) ? m.topics : []).map(t => ({
      topicId: t.topic_id,
      topicName: t.topic_name,
      topicContent: t.topic_content || '',
      money: t.topic_money || '',
      clusterName: '', // 将在聚类匹配中填充
      attendees: attendeesStr,
      observers: observersStr,
      sourceDocumentId: t.source_document_id || m.source_document_id,
    }))

    return {
      meetingId: m.meeting_id,
      meetingName: m.meeting_name,
      date: m.meeting_date,
      attendees: attendeesStr,
      observers: observersStr,
      fileName: m.source_file_name,
      sourceDocumentId: m.source_document_id,
      topics: fullTopics.length,
      topicList: [], // 将在处理聚类后重建
      fullTopics,
    }
  })

  // 处理聚类数据
  if (importedClusters && Array.isArray(importedClusters)) {
    // 构建 topicId -> meetingInfo 的映射，用于填充 details
    const topicMeetingMap = new Map()
    meetings.value.forEach(m => {
      m.fullTopics.forEach(t => {
        topicMeetingMap.set(t.topicId, {
          meetingName: m.meetingName,
          meetingDate: m.date,
          attendees: m.attendees,
          observers: m.observers,
          fileName: m.fileName,
          sourceDocumentId: m.sourceDocumentId,
        })
      })
    })

    clusters.value = importedClusters.map(c => ({
      clusterId: c.cluster_id,
      name: c.cluster_name,  // 使用 name 而非 clusterName，适配 AllTopicsDrawer
      // 构建 details 数组，适配 AllTopicsDrawer 的 tableData 格式
      details: (c.topics || []).map(t => {
        const topicId = t.topic_id
        const meetingInfo = topicMeetingMap.get(topicId) || {}
        return {
          topicId: topicId,
          topicName: t.topic_name,
          topicContent: t.topic_content || '',
          money: t.topic_money || '',
          clusterName: c.cluster_name,
          meetingName: meetingInfo.meetingName || '',
          meetingDate: meetingInfo.meetingDate || '',
          attendees: meetingInfo.attendees || '',
          observers: meetingInfo.observers || '',
          fileName: meetingInfo.fileName || '',
          sourceDocumentId: meetingInfo.sourceDocumentId || '',
        }
      }),
    }))

    // 为 meetings.fullTopics 填充聚类名称
    const topicClusterMap = new Map()
    importedClusters.forEach(c => {
      ;(c.topics || []).forEach(t => {
        topicClusterMap.set(t.topic_id, c.cluster_name)
      })
    })

    meetings.value.forEach(m => {
      m.fullTopics.forEach(t => {
        t.clusterName = topicClusterMap.get(t.topicId) || '未聚类'
      })
      // 重建 topicList（时间轴卡片展开内容）
      const topicListMap = new Map()
      m.fullTopics.forEach(t => {
        const cn = t.clusterName || '未聚类'
        if (!topicListMap.has(cn)) topicListMap.set(cn, [])
        topicListMap.get(cn).push(`[${cn}] ${t.topicName}`)
      })
      m.topicList = Array.from(topicListMap.entries()).map(([cn, details]) => ({ title: `${cn}相关议题`, details }))
    })
  } else {
    clusters.value = []
    // 无聚类数据时，所有议题标记为未聚类
    meetings.value.forEach(m => {
      m.fullTopics.forEach(t => {
        t.clusterName = '未聚类'
      })
      // 重建 topicList
      m.topicList = [{ title: '未聚类相关议题', details: m.fullTopics.map(t => `[未聚类] ${t.topicName}`) }]
    })
  }

  // 清空上传的文件列表（导入模式下不显示文件）
  uploadedFiles.value = []

  // 清除筛选条件，导入后展示全量数据
  filters.participants = ''
  filters.dateStart = ''
  filters.dateEnd = ''
  filters.amountMin = ''
  filters.amountMax = ''
  filters.keywords = ''
  filters.regularExpression = false
  // 直接赋値，不走筛选流程（导入模式下应展示全量数据）
  displayedMeetings.value = meetings.value
  // 重新生成聚类展示
  generateClustersFromMeetings(meetings.value)
  // 重置选中状态
  selectedClusterIndex.value = null
  detailTableData.value = []

  ElMessage.success(`导入成功：共 ${meetings.value.length} 个会议，${meetings.value.reduce((sum, m) => sum + m.fullTopics.length, 0)} 个议题`)
}

// 标记文件为过期状态
// 执行前端本地筛选逻辑（立即执行模式，无analysisId时使用）
const applyLocalFilters = () => {
  if (!meetings.value.length) return

  const { participants, dateStart, dateEnd, amountMin, amountMax, keywords, regularExpression } = filters

  // 筛选后的会议数据
  const filteredMeetings = meetings.value.map(meeting => {
    // 时间范围筛选（会议级别）
    if (dateStart && meeting.date < dateStart) return null
    if (dateEnd && meeting.date > dateEnd) return null

    // 筛选议题（参会人员、金额、关键字）
    const filteredTopics = meeting.fullTopics.filter(topic => {
      // 参会人员筛选 - 从议题级别筛选
      if (participants) {
        const participantList = participants.split('|').map(p => p.trim()).filter(Boolean)
        // 议题的参会人员包含会议的参会人员和列席人员
        const topicAttendees = [
          ...(topic.attendees || meeting.attendees || []),
          ...(topic.observers || meeting.observers || [])
        ]
        const hasParticipant = participantList.some(p =>
          topicAttendees.some(a => a && a.includes(p))
        )
        if (!hasParticipant) return false
      }

      // 金额范围筛选
      if (amountMin || amountMax) {
        const money = parseFloat(topic.money) || 0
        if (amountMin && money < parseFloat(amountMin)) return false
        if (amountMax && money > parseFloat(amountMax)) return false
      }

      // 关键字筛选
      if (keywords) {
        const searchText = `${topic.topicName || ''} ${topic.topicContent || ''} ${topic.clusterName || ''}`
        if (regularExpression) {
          try {
            const regex = new RegExp(keywords, 'i')
            if (!regex.test(searchText)) return false
          } catch {
            return false
          }
        } else {
          if (!searchText.toLowerCase().includes(keywords.toLowerCase())) return false
        }
      }

      return true
    })

    if (filteredTopics.length === 0) return null

    return {
      ...meeting,
      fullTopics: filteredTopics,
      topics: filteredTopics.length
    }
  }).filter(Boolean)

  // 更新显示的会议数据（时间轴）
  displayedMeetings.value = filteredMeetings

  // 重新生成聚类数据（只包含筛选后的会议议题）
  generateClustersFromMeetings(filteredMeetings)

  // 重置选中状态
  selectedClusterIndex.value = null
  detailTableData.value = []

  // 统计匹配的议题数量
  const matchedTopicCount = filteredMeetings.reduce((sum, m) => sum + m.fullTopics.length, 0)
  ElMessage.success(`筛选完成，共 ${filteredMeetings.length} 个会议，${matchedTopicCount} 个议题`)
}

// 执行后端筛选逻辑（任务详情模式，有analysisId时使用）
const applyBackendFilters = async () => {
  const analysisId = currentAnalysisId.value || initialAnalysisId.value
  if (!analysisId) {
    ElMessage.warning('缺少分析ID，无法执行后端筛选')
    return
  }

  isAnalyzing.value = true

  try {
    const params = {
      date_start: filters.dateStart || undefined,
      date_end: filters.dateEnd || undefined,
      participants: filters.participants || undefined,
      amount_min: filters.amountMin || undefined,
      amount_max: filters.amountMax || undefined,
      keywords: filters.keywords || undefined,
      use_regex: filters.regularExpression || false,
    }

    const res = await filterAnalysisResultsAPI(analysisId, params)
    const data = res?.data

    if (!data) {
      ElMessage.warning('筛选结果为空')
      return
    }

    // 将后端返回的数据转换为前端格式
    const convertedMeetings = convertBackendFilterResultToFrontend(data)
    meetings.value = convertedMeetings
    displayedMeetings.value = convertedMeetings

    // 更新聚类数据
    if (data.clusters) {
      clusters.value = data.clusters.map(c => ({
        name: c.cluster_name,
        labels: c.labels,
        count: c.count,
        countText: c.count_text,
        color: c.color,
        details: [], // 详情在点击聚类时通过generateClustersFromMeetings填充
      }))
    }

    // 重新生成聚类详情
    generateClustersFromMeetings(convertedMeetings)

    // 重置选中状态
    selectedClusterIndex.value = null
    detailTableData.value = []

    const summary = data.summary || {}
    ElMessage.success(`筛选完成，共 ${summary.meeting_count || 0} 个会议，${summary.topic_count || 0} 个议题`)
  } catch (error) {
    console.error('后端筛选失败:', error)
    ElMessage.error('筛选失败，请稍后重试')
  } finally {
    isAnalyzing.value = false
  }
}

// 将后端筛选结果转换为前端数据结构
const convertBackendFilterResultToFrontend = (data) => {
  if (!data.days || !Array.isArray(data.days)) return []

  const result = []

  data.days.forEach(day => {
    const date = day.date || ''
    const meetingsInDay = Array.isArray(day.meetings) ? day.meetings : []

    meetingsInDay.forEach(meeting => {
      // 解析参会人员
      let attendees = ''
      if (meeting.attendees) {
        try {
          const parsed = JSON.parse(meeting.attendees)
          attendees = Array.isArray(parsed) ? parsed.join('|') : String(meeting.attendees)
        } catch {
          attendees = String(meeting.attendees)
        }
      }

      let observers = ''
      if (meeting.observers) {
        try {
          const parsed = JSON.parse(meeting.observers)
          observers = Array.isArray(parsed) ? parsed.join('|') : String(meeting.observers)
        } catch {
          observers = String(meeting.observers)
        }
      }

      const fileName = meeting.source_file_name || ''
      const topics = Array.isArray(meeting.topics) ? meeting.topics : []

      const topicListMap = new Map()
      const fullTopics = []

      topics.forEach(topic => {
        const clusterName = topic.cluster_name || '未分类'
        const topicName = topic.topic_name || ''
        const detailText = `[${clusterName}] ${topicName}`

        if (!topicListMap.has(clusterName)) {
          topicListMap.set(clusterName, [])
        }
        topicListMap.get(clusterName).push(detailText)

        const fullTopic = {
          topicName,
          topicContent: topic.topic_content || '',
          clusterName,
          money: topic.topic_money || '',
          sourceDocumentId: topic.source_document_id,
          attendees,
          observers,
        }

        // 添加动态字段
        if (topic.extra_fields) {
          fullTopic.extraFields = topic.extra_fields
          Object.keys(topic.extra_fields).forEach(key => {
            if (!fullTopic.hasOwnProperty(key)) {
              fullTopic[key] = topic.extra_fields[key]
            }
          })
        }

        fullTopics.push(fullTopic)
      })

      const topicList = Array.from(topicListMap.entries()).map(([clusterName, details]) => ({
        title: `${clusterName}相关议题`,
        details,
      }))

      result.push({
        date,
        meetingName: meeting.meeting_name || '',
        fileName,
        count: 1,
        topics: fullTopics.length,
        topicList,
        fullTopics,
        attendees,
        observers,
      })
    })
  })

  return result
}

// 执行筛选逻辑入口（根据是否有analysisId决定使用前端还是后端筛选）
const applyFiltersToData = () => {
  const analysisId = currentAnalysisId.value || initialAnalysisId.value
  if (analysisId) {
    // 有analysisId时使用后端筛选
    applyBackendFilters()
  } else {
    // 无analysisId时使用前端本地筛选（立即执行模式）
    applyLocalFilters()
  }
}

/**
 * 开始拖拽左侧分隔条以调整左侧面板宽度
 * @param {MouseEvent} e 鼠标按下事件，使用 clientX 作为拖拽起点横坐标
 */
const startLeftSidebarResize = (e) => {
  isResizingLeft.value = true
  leftResizeStartX.value = e.clientX
  leftResizeStartWidth.value = leftSidebarWidth.value
  document.addEventListener('mousemove', handleLeftSidebarResize)
  document.addEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.add('resizing')
  e.preventDefault()
}

/**
 * 拖拽过程中更新左侧面板宽度（向右拖加宽、向左拖收窄）
 * @param {MouseEvent} e 鼠标移动事件，通过 clientX 与起点差值计算新宽度
 */
const handleLeftSidebarResize = (e) => {
  if (!isResizingLeft.value) return
  const diff = e.clientX - leftResizeStartX.value
  const newWidth = leftResizeStartWidth.value + diff
  if (newWidth >= LEFT_SIDEBAR_WIDTH_MIN && newWidth <= LEFT_SIDEBAR_WIDTH_MAX) {
    leftSidebarWidth.value = newWidth
  }
}

/**
 * 结束左侧宽度拖拽：移除 document 监听、取消 body 拖拽样式，并将当前宽度写入 localStorage
 */
const stopLeftSidebarResize = () => {
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')
  localStorage.setItem('ocr-viewer-left-sidebar-width', String(leftSidebarWidth.value))
}

// 拖拽调整宽度
const startResize = (e) => {
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = rightAreaWidth.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing.value) return
  const diff = startX.value - e.clientX
  const newWidth = startWidth.value + diff
  // 限制最小和最大宽度
  if (newWidth >= 600 && newWidth <= 1200) {
    rightAreaWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// 拖拽调整第二个分割线宽度
const startResize2 = (e) => {
  isResizing2.value = true
  startX.value = e.clientX
  startWidth.value = rightCenterPanelWidth.value
  document.addEventListener('mousemove', handleResize2)
  document.addEventListener('mouseup', stopResize2)
  e.preventDefault()
}

const handleResize2 = (e) => {
  if (!isResizing2.value) return
  const diff = startX.value - e.clientX
  const newWidth = startWidth.value + diff
  // 限制最小和最大宽度
  const minWidth = 300
  const maxWidth = rightAreaWidth.value - 300
  if (newWidth >= minWidth && newWidth <= maxWidth) {
    rightCenterPanelWidth.value = newWidth
  }
}

const stopResize2 = () => {
  isResizing2.value = false
  document.removeEventListener('mousemove', handleResize2)
  document.removeEventListener('mouseup', stopResize2)
}

// 分析状态集合（已结束的状态）
const TERMINAL_ANALYSIS_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED'])

// 组件挂载时尝试恢复状态
onMounted(async () => {
  if (isTaskDetailMode.value && initialAnalysisId.value) {
    await initTaskDetailMode(initialAnalysisId.value)
  } else if (isTaskDetailMode.value) {
    initialLoading.value = true
    try {
      await loadTaskCenterPreviewSidebar()
    } finally {
      initialLoading.value = false
    }
  } else {
    loadAnalysisState()
  }

  // 处理从文件管理器传递过来的文件（通过 props）
  handleFileManagerFiles()
})

// taskDetail 模式初始化：查询状态后分流
const initTaskDetailMode = async (analysisId) => {
  initialLoading.value = true
  try {
    await loadTaskCenterPreviewSidebar()

    const res = await getAnalysisDetailAPI(analysisId)
    const data = res?.data
    if (!data) {
      ElMessage.error('未获取到分析任务信息')
      return
    }

    const status = data.analysis_summary?.status || data.status || ''
    const taskStatusNum =
      props.taskStatus != null && props.taskStatus !== ''
        ? Number(props.taskStatus)
        : null

    // 任务中心已知任务失败：加载当前可得详情，不弹进度窗
    if (taskStatusNum === 3) {
      await loadAnalysisDetail(analysisId)
      return
    }

    // 与 TimelineAnalysisViewer 对齐：任务中心仍标记未开始/进行中时，优先展示进度遮罩
    const taskStillRunning = taskStatusNum === 0 || taskStatusNum === 1
    const analysisTerminal = TERMINAL_ANALYSIS_STATUSES.has(status)

    if (taskStillRunning) {
      // 聚类等阶段已产出结果时，背景先展示当前可得详情（风险分析等后续步骤仍在跑）
      if (analysisTerminal) {
        await loadAnalysisDetailFromData(analysisId, data)
        isAnalyzing.value = false
      } else {
        isAnalyzing.value = true
      }
      progressAnalysisStatus.value = ''
      progressDialogVisible.value = true
      startProgressTracking(analysisId, props.taskId || data.task_uuid || '')
      return
    }

    if (analysisTerminal) {
      // 已结束：直接展示结果
      await loadAnalysisDetailFromData(analysisId, data)
    } else {
      // 进行中（RUNNING / PENDING / CANCELLING 等）：打开进度弹窗
      progressAnalysisStatus.value = ''
      isAnalyzing.value = true
      progressDialogVisible.value = true
      startProgressTracking(analysisId, props.taskId || data.task_uuid || '')
    }
  } catch (error) {
    console.error('initTaskDetailMode 失败:', error)
    ElMessage.error('加载分析任务信息失败，请稍后重试')
  } finally {
    initialLoading.value = false
  }
}

// 处理从文件管理器传递过来的文件（通过 props）
const handleFileManagerFiles = () => {
  // 从 props 获取文件参数（弹窗方式）
  const filesParam = props.files
  const namesParam = props.names

  if (filesParam && namesParam) {
    // 优先使用 || 分隔符（新格式），兼容旧的逗号分隔格式
    const sep = filesParam.includes('||') ? '||' : ','
    const fileIds = filesParam.split(sep).filter(Boolean)
    const fileNames = namesParam.split(sep).filter(Boolean)

    if (fileIds.length > 0 && fileIds.length === fileNames.length) {
      const filesToAdd = fileIds.map((id, index) => ({
        file_id: id,
        file_name: fileNames[index]
      }))

      // 等待子组件挂载后添加文件
      nextTick(() => {
        addFilesFromManager(filesToAdd)
      })
    }
  }
}

// 监听 props 变化，处理弹窗重新打开的情况
watch(
  () => props.files,
  (newFiles) => {
    if (newFiles && props.names) {
      handleFileManagerFiles()
    }
  }
)

// 组件销毁时清理事件监听和状态
onBeforeUnmount(() => {
  emitFileManagerProgressStop()
  stopProgressPolling()
  stopAnalysisStatusPolling()
  stopProgressElapsedTimer()
  clearTaskCenterAutoNavTimer()
  stopRiskPolling()
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('mousemove', handleResize2)
  document.removeEventListener('mouseup', stopResize2)
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')

  // 非任务详情模式下，退出页面时清空分析结果、选中的文件和提示词（taskDetail 模式退出不清理）
  if (!isTaskDetailMode.value) {
    clearAnalysisResults()
    clearFiles()
    // 清空提示词和配置
    config.prompt = ''
    config.promptId = null
    config.riskPrompt = ''
    config.riskPromptId = null
    config.similarityThreshold = 80
    config.minClusterSize = 2
    config.maxClusterSize = 2
    // 清空 localStorage 中的配置
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('清空配置状态失败:', error)
    }
  }
})

// 清空分析结果（保留配置）
const clearAnalysisResults = () => {
  // 清空会议数据
  meetings.value = []
  displayedMeetings.value = []
  clusters.value = []
  selectedMeetingIndex.value = null
  selectedClusterIndex.value = null
  detailTableData.value = []
  extractFields.value = null
  currentAnalysisId.value = null

  // 清空 localStorage 中的分析结果（保留配置）
  try {
    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      const state = JSON.parse(savedState)
      // 只保留 config，清除 analysisResult
      const newState = {
        config: state.config || {},
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    }
  } catch (error) {
    console.error('清空分析状态失败:', error)
  }
}
</script>

<style scoped lang="scss">
.meeting-minutes-analysis-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 75px);
  background: var(--sd-surface-1, #f4f4f4);
  overflow: hidden;
}

.meeting-minutes-analysis-container--embedded {
  height: 100%;
  min-height: 0;
  position: relative;
}

.ocr-column-head {
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
}

.meeting-minutes-analysis-container :deep(.ocr-sidebar-footer) {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
}

.meeting-minutes-analysis-container :deep(.file-actions-row) {
  display: flex;
  align-items: center;
  width: 100%;
}

.meeting-minutes-analysis-container :deep(.file-actions-row > * + *) {
  margin-left: 8px;
}

.meeting-minutes-analysis-container :deep(.file-actions-row .ocr-footer-btn),
.meeting-minutes-analysis-container :deep(.file-actions-row .el-button) {
  flex: 1;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  box-sizing: border-box;
}

/* 任务详情模式的头部 */
.task-detail-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--sd-canvas, #ffffff);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
}

.task-detail-header > * + * {
  margin-left: 12px;
}

.task-detail-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

/* 内容区域包装器 - 水平布局 */
.content-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  min-height: 0;
}

/* 左侧栏与拖拽条成组，中间无间距 */
.left-sidebar-group {
  display: flex;
  flex-shrink: 0;
  align-self: stretch;
  min-height: 0;
}

/* 主 Tab 切换区域 */
.main-tabs {
  display: flex;
  justify-content: center;
  padding: 0;
}

.main-tabs.ocr-column-head {
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.main-tab {
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 100%;
  cursor: pointer;
  transition: color 0.2s ease;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  box-sizing: border-box;
}

.main-tab > * + * {
  margin-left: 6px;
}

.main-tab .el-icon {
  font-size: 16px;
}

.main-tab:hover {
  color: var(--sd-primary, #195fb4);
}

.main-tab--active {
  color: var(--sd-primary, #195fb4);
  font-weight: 600;
  border-bottom-color: var(--sd-primary, #195fb4);
}

/* Tab 内容区域 */
.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 中间面板 */
.center-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--sd-canvas, #ffffff);
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
  overflow: hidden;
}

/* 左侧公共文件栏 */
.left-sidebar-shell.meeting-left-sidebar {
  align-self: stretch;
  flex-shrink: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: var(--sd-canvas, #ffffff);
  overflow: hidden;
}

.left-sidebar-shell.resizable-left-sidebar {
  transition: width 0s;
}

.meeting-left-sidebar :deep(.left-sidebar) {
  width: 100%;
  height: 100%;
  border-right: none;
  flex: 1;
  min-height: 0;
}

.resizer {
  width: 4px;
  background: var(--sd-hairline, #e0e0e0);
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10;
  flex-shrink: 0;
  align-self: stretch;
}

.resizer-left {
  border-right: 1px solid var(--sd-hairline, #e0e0e0);
}

.resizer:hover {
  background: var(--sd-primary, #195fb4);
}

.resize-icon {
  font-size: 12px;
  color: #909399;
  pointer-events: none;
}

.resizer:hover .resize-icon {
  color: var(--sd-primary, #195fb4);
}

:global(body.resizing) {
  user-select: none;
  cursor: col-resize;
}

:global(body.resizing) .resizer {
  background-color: var(--sd-primary, #195fb4);
  opacity: 1;
}

/* 右侧面板 */
.right-panel {
  width: 320px;
  min-width: 280px;
  max-width: 400px;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
  overflow: hidden;
}

/* 进度弹窗 */
.progress-dialog-body {
  padding: 4px 0;
}
.progress-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
}
.progress-dialog-footer > .progress-tip + .el-button {
  margin-left: 12px;
}
.progress-tip {
  margin-right: auto;
  font-size: 12px;
  color: #909399;
}
.progress-error-banner {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 4px;
  color: #f56c6c;
  margin-bottom: 16px;
  font-size: 14px;
}

.progress-error-banner > * + * {
  margin-left: 8px;
}

.progress-loading-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  color: #909399;
  font-size: 14px;
}

.progress-loading-hint > * + * {
  margin-left: 8px;
}

/* 分析进度悬浮球 */
.meeting-progress-floating-ball {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2999;
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, var(--sd-primary, #195fb4) 0%, #3d7fd4 100%);
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(25, 95, 180, 0.4);
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.meeting-progress-floating-ball > * + * {
  margin-left: 6px;
}

.meeting-progress-floating-ball:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(25, 95, 180, 0.5);
}

.meeting-floating-ball-icon {
  font-size: 18px;
  color: #ffffff;
  animation: meeting-floating-ball-spin 1s linear infinite;
}

.meeting-floating-ball-time {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  min-width: 42px;
}

@keyframes meeting-floating-ball-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

<!-- append-to-body 弹窗须用非 scoped 样式，否则 Chrome 77 下 PDF 高度链失效 -->
<style lang="scss">
.meeting-task-file-preview-dialog.el-dialog {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.meeting-task-file-preview-dialog.el-dialog .el-dialog__body {
  padding: 0;
  flex: 1;
  min-height: 0;
  height: calc(90vh - 54px);
  min-height: calc(90vh - 54px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.meeting-task-file-preview-dialog .meeting-task-preview-host {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: auto;
}

.meeting-task-file-preview-dialog .meeting-task-preview-host .preview-file-wrapper {
  height: 100%;
  min-height: calc(90vh - 120px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.meeting-task-file-preview-dialog .meeting-task-preview-host .document-area {
  flex: 1;
  min-height: 0;
  height: calc(90vh - 170px);
  min-height: calc(90vh - 170px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.meeting-task-file-preview-dialog .meeting-task-preview-host .document-preview {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.meeting-task-file-preview-dialog .meeting-task-preview-host .pdf-container-wrapper {
  width: 100%;
  min-height: calc(90vh - 170px);
  height: auto;
  display: block;
}

.meeting-task-file-preview-dialog .meeting-task-preview-host .pdf-container {
  width: 100%;
  min-height: calc(90vh - 170px);
  height: auto;
  max-height: none;
}

/* Chrome 77 iframe 模式：固定可视高度，滚动在 iframe 内部 */
.meeting-task-file-preview-dialog .meeting-task-preview-host .pdf-container iframe {
  width: 100%;
  min-height: calc(90vh - 170px);
  height: calc(90vh - 170px);
  border: none;
}
</style>
