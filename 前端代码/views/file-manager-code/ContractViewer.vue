<template>
  <div
    class="ocr-viewer"
    :class="{ 'ocr-viewer--embedded': isSecondaryExecution }"
    v-loading="resultViewLoading"
    element-loading-text="加载任务结果..."
  >
    <!-- 左侧：公共侧边栏 -->
    <div
      class="left-sidebar-shell resizable-left-sidebar"
      :style="{ width: leftSidebarWidth + 'px' }"
    >
      <OcrLeftSidebar
        :bindings="leftSidebarBindings"
        layout-mode="tree-select"
        :mode="leftSidebarMode"
        :task-id="leftSidebarTaskId"
        :allow-mode-switch="false"
        :readonly="isSecondaryExecution"
        :hide-batch-execute="isSecondaryExecution"
        :show-preview-toggle="true"
        compact-file-header
        empty-description="暂无文件，请点击「选择文件」添加"
      />
      <div v-if="showSecondaryBatchExecute" class="secondary-batch-area">
        <el-button
          type="primary"
          style="width: calc(100% - 24px); margin: 0 12px 12px;"
          @click="handleBatchExecute"
          :disabled="fileList.length === 0"
        >
          批量执行
        </el-button>
      </div>
    </div>
    <div
      class="resizer resizer-left"
      @mousedown="startLeftSidebarResize"
      title="拖拽调整宽度"
    >
      <el-icon class="resize-icon">
        <DArrowRight />
      </el-icon>
    </div>

    <!-- 中间文档查看器 -->
    <div v-show="showFilePreview" class="center-viewer">
      <OcrFolderPreviewPanel
        v-if="isFolderListPreviewMode"
        :folder-name="currentFolderPreviewName"
        :display-total="folderPreviewDisplayTotal"
        :deleted-file-count="pendingDeleteRecords.files.length"
        :deleted-folder-count="pendingDeleteRecords.folders.length"
        :files="currentFolderPreviewFiles"
        :loading="folderPreviewLoading"
        :is-remote="isCurrentFolderPreviewRemote"
        :total="folderPreviewTotal"
        :page-size="folderPreviewPageSize"
        :current-page="folderPreviewPage"
        :pending-delete-file-ids="pendingDeleteFileIds"
        @page-change="handleFolderPreviewPageChange"
        @delete-selected="handleDeleteSelectedFolderPreviewFiles"
        @restore-file="handleRestoreFolderPreviewFile"
        @view-file="handleViewFolderPreviewFile"
      />
      <PreviewFile
        v-else
        ref="previewFileRef"
        :key="currentPreviewFileKey"
        :current-file="currentFile"
        :current-highlighted-field="currentHighlightedField"
        @refresh="refresh"
        @download="download"
        @clear-highlight="handleClearHighlight"
      >
        <template #headerActions>
          <template v-if="!isSecondaryExecution">
            <el-button type="primary" :icon="List" size="small" @click="handleGoToTaskCenter">任务中心</el-button>
          </template>
        </template>
      </PreviewFile>
    </div>

    <!-- 可调整宽度的分隔线 -->
    <div
      v-show="showFilePreview"
      class="resizer"
      @mousedown="startResize"
      title="拖拽调整宽度"
    >
      <el-icon class="resize-icon">
        <DArrowLeft />
      </el-icon>
    </div>

    <!-- 右侧面板：解析结果 + 功能配置 -->
    <div
      class="right-viewer"
      :class="{ 'right-viewer-fullwidth': !showFilePreview }"
      :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
    >
      <div class="right-viewer-head ocr-column-head">
        <div class="sidebar-tabs">
          <el-tabs v-model="viewerTab" @tab-change="handleTabChange">
            <el-tab-pane
              label="解析结果"
              name="parse"
            />
            <el-tab-pane label="功能配置" name="extract" />
          </el-tabs>
        </div>
        <div class="contract-report-toolbar">
          <el-tooltip
            :disabled="!reportButtonDisabled || reportGenerating"
            :content="reportButtonTooltip"
            placement="top"
          >
            <span class="contract-report-toolbar__btn-wrap">
              <el-button
                type="primary"
                size="small"
                :loading="reportGenerating"
                :disabled="reportButtonDisabled"
                @click="handleReportButtonClick"
              >
                {{ reportButtonLabel }}
              </el-button>
            </span>
          </el-tooltip>
          <el-button
            type="success"
            size="small"
            :icon="Download"
            class="contract-report-toolbar__export-btn"
            :loading="exportResultsLoading"
            :disabled="!canExportAllResults || exportResultsLoading"
            @click="handleExportAllResults"
          >
            导出结果
          </el-button>
        </div>
      </div>

      <div v-show="viewerTab === 'parse'" class="right-sidebar">
        <div class="extraction-results">
          <div v-if="currentFileDisplayResult.length > 0" class="contract-result-section">
            <ResultTable :result-list="currentFileDisplayResult" />
          </div>
          <el-alert
            v-else-if="currentFileAutoAnalysisText"
            class="contract-auto-analysis-alert"
            type="info"
            :closable="false"
            show-icon
            title="自动分析说明"
          >
            <div class="contract-auto-analysis-text">{{ currentFileAutoAnalysisText }}</div>
          </el-alert>
          <el-empty
            v-if="!hasParseTabContent"
            description="暂无解析结果"
            :image-size="80"
          />
        </div>
      </div>

      <div v-show="viewerTab === 'extract'" class="right-sidebar right-sidebar--extract">
        <div class="field-mode-header">
          <el-select
            v-if="!isSecondaryExecution"
            v-model="contractGlobalConfig.template"
            placeholder="选择分析模板"
            size="default"
            style="width: 100%;"
            :disabled="extracting"
            @change="handleContractTemplateChange"
          >
            <el-option label="自动" value="auto" />
            <el-option label="施工类合同" value="construction" />
            <el-option label="非施工类合同" value="non_construction" />
          </el-select>
          <el-select
            v-else-if="currentFileConfigEntry"
            v-model="currentFileConfigEntry.config.template"
            placeholder="选择分析模板"
            size="default"
            style="width: 100%;"
            disabled
          >
            <el-option label="自动" value="auto" />
            <el-option label="施工类合同" value="construction" />
            <el-option label="非施工类合同" value="non_construction" />
          </el-select>
          <div
            v-if="!isSecondaryExecution"
            class="auto-analysis-row"
          >
            <span class="auto-analysis-label">自动分析</span>
            <el-switch
              v-model="autoAnalysisEnabled"
              :active-value="1"
              :inactive-value="0"
              :disabled="extracting"
            />
          </div>
        </div>

        <div class="config-panel-wrap">
          <template v-if="!isSecondaryExecution">
            <div
              v-if="configStatusBanner"
              class="settings-status-banner"
              :class="{ 'settings-status-banner--hint': configStatusBanner.type === 'hint' }"
            >
              <div class="settings-status-banner__left">
                <el-icon class="status-icon"><Check /></el-icon>
                <span class="status-text">{{ configStatusBanner.text }}</span>
              </div>
            </div>
            <ConfigPanel
              ref="configPanelRef"
              v-model:template="contractGlobalConfig.template"
              v-model:rule-list="contractGlobalConfig.ruleList"
              v-model:prompt="contractGlobalConfig.prompt"
              :templateRuleList="templateRuleList"
              :loading="extracting"
              :no-execute="true"
              :show-template-select="false"
              @update:template="handleGlobalConfigChange"
              @update:rule-list="handleGlobalConfigChange"
            />
          </template>
          <ConfigPanel
            v-else-if="currentFileConfigEntry"
            ref="configPanelRef"
            v-model:template="currentFileConfigEntry.config.template"
            v-model:rule-list="currentFileConfigEntry.config.ruleList"
            v-model:prompt="currentFileConfigEntry.config.prompt"
            :is-secondary-execution="true"
            :readonly="true"
            :templateRuleList="templateRuleList"
            :loading="extracting"
            :no-execute="true"
            :show-template-select="false"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- 二次执行：批量执行穿梭框 -->
  <el-dialog
    v-if="isSecondaryExecution"
    v-model="batchExecuteDialogVisible"
    title="批量执行"
    width="800px"
    :close-on-click-modal="false"
  >
    <div class="batch-execute-dialog">
      <el-transfer
        v-model="selectedExecuteFiles"
        :data="transferData"
        :titles="['可选文件', '待执行文件']"
        :button-texts="['移除', '添加']"
        :props="{ key: 'fileId', label: 'name' }"
        filterable
        :filter-method="filterMethod"
        filter-placeholder="搜索文件名"
      >
        <template #default="{ option }">
          <div class="transfer-item">
            <span class="transfer-item-name">{{ option.name }}</span>
            <el-tag
              v-if="fileConfigMap[option.fileId] && fileConfigMap[option.fileId].configured"
              type="warning"
              size="small"
              effect="plain"
              style="margin-left: 8px;"
            >
              已调整
            </el-tag>
          </div>
        </template>
        <template #left-footer>
          <el-checkbox
            v-model="filterEditedOnly"
            @change="handleFilterChange"
            style="margin-left: 10px;"
          >
            仅显示已调整
          </el-checkbox>
        </template>
      </el-transfer>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="batchExecuteDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleReRecognize(false)"
          :disabled="selectedExecuteFiles.length === 0"
        >
          创建任务 ({{ selectedExecuteFiles.length }})
        </el-button>
      </span>
    </template>
  </el-dialog>

  <!-- 二次执行：任务名称弹窗 -->
  <el-dialog
    v-if="isSecondaryExecution"
    v-model="batchRecognizeDialogVisible"
    title="批量执行"
    width="900px"
    :close-on-click-modal="false"
    class="batch-recognize-dialog"
  >
    <div class="batch-recognize-content">
      <div class="task-params-section" style="margin-bottom: 20px;">
        <el-form :model="secondaryTaskParams" label-width="100px">
          <el-form-item label="任务名称" required>
            <el-input
              v-model="taskName"
              placeholder="请输入任务名称"
              maxlength="100"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="任务备注">
            <el-input
              v-model="taskRemark"
              type="textarea"
              :rows="3"
              placeholder="请输入任务备注（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>
      <div class="batch-file-list">
        <div class="batch-file-header">
          <span class="file-count" v-if="isAloneFile">共 1 个文件</span>
          <span class="file-count" v-else>共 {{ selectedExecuteFiles.length }} 个文件</span>
        </div>
        <el-table :data="secondaryBatchFileList" border max-height="300" style="margin-top: 10px;">
          <el-table-column prop="fileName" label="文件名" min-width="250" />
          <el-table-column label="设置模式" width="120">
            <template #default="{ row }">
              <span>{{ templateMap[row.template] || '自动' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleBatchRecognizeCancel">取消</el-button>
        <el-button type="primary" @click="handleBatchRecognizeConfirm">创建任务</el-button>
      </span>
    </template>
  </el-dialog>

  <!-- 报告生成进度（独立轮询，不走 eventBus） -->
  <el-dialog
    v-model="reportProgressVisible"
    title="合同分析报告生成"
    width="520px"
    :close-on-click-modal="false"
    :show-close="!reportGenerating"
    append-to-body
    destroy-on-close
  >
    <div v-if="reportProgressError" class="contract-report-progress-error">
      {{ reportProgressError }}
    </div>
    <p v-else class="contract-report-progress-hint">{{ reportProgressHint }}</p>
    <template #footer>
      <el-button v-if="!reportGenerating" @click="reportProgressVisible = false">关闭</el-button>
      <el-button v-else @click="reportProgressVisible = false">后台继续</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onUnmounted, computed, reactive, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, ArrowLeft, List, DArrowRight, DArrowLeft, Download } from '@element-plus/icons-vue'
import { useHomeStore } from '@/stores/home'
import { previewFileAPI, getFileListAPI } from '@/api/fileManager.js'
import { getPublicAndPrivateTemplatesAPI } from '@/api/template.js'
import { createTaskSchedulesAPI, getTaskSchedulesAPI, batchExecuteByFilterAPI, exportContractCompletenessResultsAPI } from '@/api/task.js'
import { eventBus } from '@/utils/eventBus.js'
import { emitFileManagerProgressStop } from '@/views/file-manager-code/utils/fileManagerTaskProgressEvents.js'
import {
  getFileIdentifier,
  getFileFolderPath,
  normalizeFolderPathForTree,
  buildFolderFileListQueryParams,
  filterFilesByParsePolicy
} from './composables/ocrLeftSidebarTreeUtils.js'
import { buildToolBatchExecutePayload } from './composables/buildToolBatchExecutePayload.js'
import {
  parseContractDisposalResult,
  mergeContractResultsWithRules,
  getInformationExtractionFromSettings,
  parseContractText2Rows,
  parseParameterSettings,
  normalizeDisposalResultObject
} from '@/utils/contractDisposalParser.js'
import { useSimpleOcrLeftSidebar } from './composables/useSimpleOcrLeftSidebar.js'
import {
  openTaskCenterWithRefresh,
  runBatchExecuteWithTimeoutNav
} from './composables/batchExecuteTimeoutNav.js'
import OcrLeftSidebar from './components/OcrLeftSidebar.vue'
import OcrFolderPreviewPanel from './components/OcrFolderPreviewPanel.vue'
import ResultTable from './components/contract/ResultTable.vue'
import ConfigPanel from './components/contract/ConfigPanel.vue'
import PreviewFile from './components/PreviewFile.vue'
import { useContractReport } from './composables/useContractReport.js'
import {
  hasExportableContractResults,
  downloadContractExportResponse
} from './utils/contractResultExport.js'
import {
  applyTaskSelectionToSidebar,
  buildFolderNameMapFromSourceRefs,
  buildSourceRefsFromResultList,
  enrichFileRowWithSourceRefs
} from '@/views/ocr-task-center/taskCenterSelectionTreeUtils.js'

const props = defineProps({
  files: { type: String, default: '' },
  names: { type: String, default: '' },
  isSecondaryExecution: { type: Boolean, default: false },
  /** 嵌入预览场景隐藏左侧「批量执行」（如消息通知查看详情） */
  hideSecondaryBatchExecute: { type: Boolean, default: false },
  taskId: { type: String, default: '' },
  /** 父级传入的当前合同分析 task_uuid（文档资料挖掘批量执行后） */
  analysisTaskId: { type: String, default: '' },
  fileId: { type: String, default: '' },
  eventKey: { type: String, default: '' },
  toolLabel: { type: String, default: '合同合规性核查' }
})

const emit = defineEmits(['close-dialog'])

/**
 * 是否展示任务中心二次执行用的左侧「批量执行」按钮
 * @returns {boolean} 展示时为 true
 */
const showSecondaryBatchExecute = computed(
  () => props.isSecondaryExecution && !props.hideSecondaryBatchExecute
)

/** 组件是否仍挂载（关闭弹窗后迟到的批量创建响应不再触发父级轮询） */
const isViewerActive = ref(false)
/** 批量创建请求是否已作废 */
let batchExecuteAborted = false
/** 当前进行中的 BatchExecuteByFilter 取消控制器 */
let activeBatchExecuteAbortController = null

/**
 * 作废进行中的 BatchExecuteByFilter 并通知父级停止轮询
 * @returns {void}
 */
const invalidateBatchExecute = () => {
  batchExecuteAborted = true
  isViewerActive.value = false
  if (activeBatchExecuteAbortController) {
    try {
      activeBatchExecuteAbortController.abort()
    } catch (e) {
      /* ignore */
    }
    activeBatchExecuteAbortController = null
  }
  emitFileManagerProgressStop()
}

defineOptions({ name: 'ContractViewer' })

const router = useRouter()
const homeStore = useHomeStore()

const CONTRACT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.wps']
const CONTRACT_EXT_SET = new Set(['pdf', 'doc', 'docx', 'wps'])

const fileList = ref([])
const currentFile = ref(null)
const fileConfigMap = reactive({})
const taskData = ref(null)
const previewTaskName = ref('-')
const resultViewLoading = ref(false)
const extracting = ref(false)

const {
  reportGenerating,
  reportProgressVisible,
  reportProgressHint,
  reportProgressError,
  reportButtonLabel,
  reportButtonDisabled,
  setAnalysisTaskUuid,
  setAnalysisContext,
  refreshReportBySource,
  handleReportButtonClick,
  disposeReport
} = useContractReport({
  getAnalysisTaskUuid: () => {
    if (props.isSecondaryExecution && props.taskId) return props.taskId
    return props.analysisTaskId || ''
  },
  getTaskData: () => taskData.value,
  getTaskName: () => taskData.value?.task_name || previewTaskName.value,
  setTaskData: (td) => {
    if (td) taskData.value = td
  }
})

const reportButtonTooltip = computed(() => {
  if (reportButtonDisabled.value && !reportGenerating.value) {
    if (!props.taskId && !props.analysisTaskId) {
      return '请先完成合同分析任务'
    }
    return '请待分析任务处理完成后再生成报告'
  }
  return ''
})

const exportResultsLoading = ref(false)

const resolveExportTaskUuid = () => {
  if (props.isSecondaryExecution && props.taskId) return String(props.taskId).trim()
  return String(props.analysisTaskId || '').trim()
}

const canExportAllResults = computed(() => {
  if (resolveExportTaskUuid()) {
    return hasExportableContractResults(
      taskData.value?.task_schedule_result_list,
      fileConfigMap
    )
  }
  return false
})

/**
 * 调用后端接口导出任务内全部合同解析结果（Excel）
 * @returns {Promise<void>}
 */
const handleExportAllResults = async () => {
  if (exportResultsLoading.value) return
  const taskUuid = resolveExportTaskUuid()
  if (!taskUuid) {
    ElMessage.warning('未找到任务标识，无法导出')
    return
  }
  exportResultsLoading.value = true
  try {
    const response = await exportContractCompletenessResultsAPI(taskUuid)
    const taskName = (taskData.value?.task_name || previewTaskName.value || '合同分析')
      .replace(/[\\/:*?"<>|]/g, '_')
    const ok = await downloadContractExportResponse(response, {
      fallbackName: `${taskName}_导出结果.xlsx`
    })
    if (ok) {
      ElMessage.success('导出成功')
    }
  } catch (error) {
    console.error('导出合同分析结果失败:', error)
    const errData = error?.response?.data
    let msg = error?.message || '导出失败，请稍后重试'
    if (errData instanceof Blob) {
      try {
        const text = await errData.text()
        const parsed = JSON.parse(text)
        msg = parsed?.detail || parsed?.message || msg
      } catch {
        /* ignore */
      }
    }
    ElMessage.error(msg)
  } finally {
    exportResultsLoading.value = false
  }
}

/** 全局合同分析配置（正常模式） */
const contractGlobalConfig = reactive({
  template: 'auto',
  ruleList: [],
  prompt: {
    compliance_analysis_prompt: null,
    information_extraction_prompt: null
  }
})
const contractGlobalConfigured = ref(false)
/** 自动分析开关：0 关闭，1 开启（批量执行时传入 Dify button 入参） */
const autoAnalysisEnabled = ref(0)
const configPanelRef = ref(null)
/** 与 ConfigPanel 子组件规则变更同步，驱动批量按钮/蓝框 computed 刷新 */
const configPanelSyncKey = ref(0)

watch(
  () => contractGlobalConfig.ruleList,
  () => {
    configPanelSyncKey.value += 1
  },
  { deep: true }
)

watch(autoAnalysisEnabled, () => {
  configPanelSyncKey.value += 1
})

const templateMap = {
  auto: '自动',
  construction: '施工类',
  non_construction: '非施工类',
  非施工合同: 'non_construction',
  施工合同: 'construction'
}
const templateRuleList = ref({
  auto: [],
  construction: [],
  non_construction: []
})

const previewFileRef = ref(null)
const viewerTab = ref(props.isSecondaryExecution ? 'parse' : 'extract')
const currentHighlightedField = ref(null)
const currentPreviewFileKey = ref('')

const LEFT_SIDEBAR_WIDTH_MIN = 200
const LEFT_SIDEBAR_WIDTH_MAX = 560
const SIDEBAR_DEFAULT_WIDTH = 320
const LEFT_SIDEBAR_LEGACY_DEFAULT_WIDTH = 240

/**
 * 解析侧栏宽度 localStorage 值
 * @param {string|null|undefined} raw 原始存储值
 * @returns {number|null} 有效像素宽度
 */
const parseSidebarWidth = (raw) => {
  if (raw == null || raw === '') return null
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 夹紧左侧侧栏宽度
 * @param {number} width 目标宽度
 * @returns {number} 合法宽度
 */
const clampLeftSidebarWidth = (width) =>
  Math.min(LEFT_SIDEBAR_WIDTH_MAX, Math.max(LEFT_SIDEBAR_WIDTH_MIN, width))

const savedRightWidth = parseSidebarWidth(localStorage.getItem('ocr-viewer-sidebar-width'))
const rightSidebarWidth = ref(savedRightWidth ?? SIDEBAR_DEFAULT_WIDTH)

const savedLeftWidth = parseSidebarWidth(localStorage.getItem('ocr-viewer-left-sidebar-width'))
let resolvedLeftWidth = savedLeftWidth ?? rightSidebarWidth.value
if (savedLeftWidth === LEFT_SIDEBAR_LEGACY_DEFAULT_WIDTH && rightSidebarWidth.value !== savedLeftWidth) {
  resolvedLeftWidth = rightSidebarWidth.value
  localStorage.setItem('ocr-viewer-left-sidebar-width', String(resolvedLeftWidth))
}
const leftSidebarWidth = ref(clampLeftSidebarWidth(resolvedLeftWidth))
const isResizingLeft = ref(false)
const leftResizeStartX = ref(0)
const leftResizeStartWidth = ref(0)
const leftSidebarMode = ref(props.isSecondaryExecution ? 'preview' : 'edit')
const leftSidebarTaskId = ref(props.isSecondaryExecution ? String(props.taskId || '') : '')
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)

const currentFolderPreviewPath = ref('')
const currentFolderPreviewName = ref('')
const currentFolderPreviewRemoteFiles = ref([])
const isCurrentFolderPreviewRemote = ref(false)
const folderPreviewLoading = ref(false)
const folderPreviewPage = ref(1)
const folderPreviewPageSize = ref(100)
const folderPreviewTotal = ref(0)
const currentFolderPreviewFolderId = ref('')

/** 前端待删除记录（批量执行时通过 deleted_files 排除） */
const pendingDeleteRecords = ref({
  files: [],
  folders: []
})

const pendingDeleteFileIds = computed(() =>
  (pendingDeleteRecords.value.files || []).map((item) => String(item.fileId))
)

const isFolderListPreviewMode = computed(() => !!currentFolderPreviewPath.value)

const currentFileConfigEntry = computed(() => {
  if (!currentFile.value) return null
  const id = String(getFileIdentifier(currentFile.value))
  return fileConfigMap[id] || null
})

const currentFileResult = computed(() => currentFileConfigEntry.value?.result || null)

const currentFileAutoAnalysisResult = computed(
  () => currentFileConfigEntry.value?.autoAnalysisResult || null
)

/** 解析结果 Tab：合并 text 规则分析与 text_2 自动分析，统一一张表展示（规则在前） */
const currentFileDisplayResult = computed(() => {
  const autoRows = Array.isArray(currentFileAutoAnalysisResult.value)
    ? currentFileAutoAnalysisResult.value
    : []
  const ruleRows = Array.isArray(currentFileResult.value) ? currentFileResult.value : []
  if (!autoRows.length) return ruleRows
  if (!ruleRows.length) return autoRows
  return [...ruleRows, ...autoRows]
})

const currentFileAutoAnalysisText = computed(
  () => String(currentFileConfigEntry.value?.autoAnalysisText || '').trim()
)

const hasParseTabContent = computed(() => {
  return currentFileDisplayResult.value.length > 0 || !!currentFileAutoAnalysisText.value
})

/**
 * 创建 fileConfigMap 默认条目
 * @returns {Object} 默认配置条目
 */
const createDefaultFileConfigEntry = () => ({
  configured: false,
  config: {
    template: 'auto',
    ruleList: [],
    prompt: {
      compliance_analysis_prompt: null,
      information_extraction_prompt: null
    },
    button: 0
  },
  result: [],
  autoAnalysisResult: [],
  autoAnalysisText: ''
})

/**
 * 解析合同自动分析 button 值（0/1）
 * @param {*} raw 原始值
 * @returns {number} 0 或 1
 */
const normalizeContractButtonValue = (raw) => {
  if (raw === true || raw === 1 || raw === '1') return 1
  return 0
}

/**
 * 解析当前应传入任务的 button 值
 * @param {Object|null} fileConfig 文件级配置
 * @returns {number} 0 或 1
 */
const resolveContractButtonValue = (fileConfig) => {
  if (fileConfig?.config && fileConfig.config.button != null) {
    return normalizeContractButtonValue(fileConfig.config.button)
  }
  if (!props.isSecondaryExecution) {
    return normalizeContractButtonValue(autoAnalysisEnabled.value)
  }
  return 0
}

/**
 * 根据扩展名推断合同文件类型
 * @param {string} fileName 文件名
 * @returns {string} 类型
 */
const getFileTypeFromExtension = (fileName) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  if (ext === 'wps') return 'doc'
  if (ext === 'txt') return 'txt'
  return 'text'
}

/**
 * 映射任务 processing_status 为侧栏预览状态
 * @param {number|string} processingStatus 处理状态
 * @returns {string} 状态键
 */
const mapProcessingStatus = (processingStatus) => {
  const n = Number(processingStatus)
  if (n === 2) return 'completed'
  if (n === 3) return 'failed'
  return 'processing'
}

/**
 * 是否开启自动分析（Dify button=1）
 * @returns {boolean}
 */
const isAutoAnalysisEnabled = () => normalizeContractButtonValue(autoAnalysisEnabled.value) === 1

/**
 * 单条规则四字段是否完整（父组件回退校验）
 * @param {Object} rule 规则条目
 * @returns {boolean}
 */
const isRuleEntryFieldsComplete = (rule) => {
  if (!rule || typeof rule !== 'object') return false
  const fields = ['title', 'description', 'laws_and_regulations', 'judgment_rule']
  return fields.every((field) => {
    const value = rule[field]
    return value != null && (typeof value !== 'string' || !!value.trim())
  })
}

/**
 * 规则列表是否字段完整（父组件回退校验）
 * @param {Array} rules 规则列表
 * @returns {boolean}
 */
const isRuleListFieldsComplete = (rules) => {
  if (!Array.isArray(rules) || !rules.length) return false
  return rules.every(isRuleEntryFieldsComplete)
}

/**
 * 优先读 ConfigPanel 实时规则，回退父级 ruleList
 * @returns {Array}
 */
const getEffectiveRuleList = () => {
  const fromPanel = configPanelRef.value?.getRuleList?.()
  if (Array.isArray(fromPanel)) return fromPanel
  return Array.isArray(contractGlobalConfig.ruleList) ? contractGlobalConfig.ruleList : []
}

/**
 * 提交任务前剥离规则内部 UI 字段
 * @param {Object} item 规则条目
 * @returns {Object}
 */
const stripRuleForSubmit = (item) => {
  const copy = { ...item }
  delete copy.extracted_value_completeness
  delete copy.extracted_value_compliance
  delete copy.data_format
  return copy
}

/**
 * 是否允许批量执行（左侧按钮）
 */
const contractBatchExecuteReady = computed(() => {
  if (contractGlobalConfig.template === 'auto') return true
  void configPanelSyncKey.value
  void autoAnalysisEnabled.value
  const rules = getEffectiveRuleList()
  if (rules.length === 0) {
    return isAutoAnalysisEnabled()
  }
  return configPanelRef.value?.areRulesComplete?.() ?? isRuleListFieldsComplete(rules)
})

/**
 * 功能配置区状态横幅（与批量按钮解耦）
 */
const configStatusBanner = computed(() => {
  if (props.isSecondaryExecution) return null
  if (contractGlobalConfig.template === 'auto') return null
  void configPanelSyncKey.value
  void autoAnalysisEnabled.value
  const rules = getEffectiveRuleList()
  if (rules.length === 0) {
    if (isAutoAnalysisEnabled()) {
      return {
        type: 'hint',
        text: '已开启自动分析，将使用大模型原生能力'
      }
    }
    return null
  }
  const complete = configPanelRef.value?.areRulesComplete?.()
    ?? isRuleListFieldsComplete(rules)
  if (complete) {
    return {
      type: 'ready',
      text: '分析模板配置已就绪（适用于全部文件与文件夹）'
    }
  }
  return null
})

/**
 * 是否已就绪全局合同配置（兼容旧调用）
 * @returns {boolean}
 */
const isContractConfigReady = () => contractBatchExecuteReady.value

/**
 * 校验全局合同配置
 * @returns {boolean} 是否通过
 */
const validateContractConfig = () => {
  if (contractGlobalConfig.template === 'auto') return true
  void configPanelSyncKey.value
  const rules = getEffectiveRuleList()
  if (rules.length === 0) {
    if (isAutoAnalysisEnabled()) return true
    viewerTab.value = 'extract'
    ElMessage.warning('请至少添加一条规则')
    return false
  }
  viewerTab.value = 'extract'
  if (configPanelRef.value?.validateRules) {
    return configPanelRef.value.validateRules()
  }
  if (!isRuleListFieldsComplete(rules)) {
    ElMessage.warning('存在未填写完整的规则')
    return false
  }
  return true
}

/**
 * 构建批量弹窗展示用全局 settings 快照
 * @returns {Object|null} settings
 */
const buildContractGlobalBatchSettings = () => {
  if (!isContractConfigReady()) return null
  return {
    configured: true,
    mode: 'field',
    template: contractGlobalConfig.template
  }
}

/**
 * 打开批量执行弹窗前校验全局配置
 * @returns {Promise<boolean>} 是否允许打开
 */
const onBeforeOpenBatchDialog = async () => {
  void (await Promise.resolve())
  return validateContractConfig()
}

/**
 * 构建合同 exec_config（对齐 getFileTaskConfig）
 * @returns {Object} exec_config
 */
const buildContractExecConfig = () => {
  const template = contractGlobalConfig.template || 'auto'
  const buttonVal = resolveContractButtonValue(null)
  const customConfig = {
    contract_category: template,
    parameter_template: '{"rules": []}',
    prompt_uuid: 'prompt',
    button: buttonVal
  }
  if (template !== 'auto') {
    const rules = getEffectiveRuleList().map(stripRuleForSubmit)
    customConfig.parameter_settings = {
      information_extraction: rules,
      compliance_analysis_prompt: contractGlobalConfig.prompt?.compliance_analysis_prompt,
      information_extraction_prompt: contractGlobalConfig.prompt?.information_extraction_prompt,
      button: buttonVal
    }
  } else {
    customConfig.parameter_settings = { button: buttonVal }
  }
  return {
    exec_mode: 'custom',
    custom_config: customConfig
  }
}

/**
 * 退出文件夹列表预览模式
 * @returns {void}
 */
const clearFolderPreviewMode = () => {
  currentFolderPreviewPath.value = ''
  currentFolderPreviewName.value = ''
  isCurrentFolderPreviewRemote.value = false
  currentFolderPreviewRemoteFiles.value = []
  folderPreviewTotal.value = 0
  folderPreviewPage.value = 1
  currentFolderPreviewFolderId.value = ''
}

const currentFolderPreviewFiles = computed(() => {
  if (!currentFolderPreviewPath.value) return []
  if (isCurrentFolderPreviewRemote.value) {
    return currentFolderPreviewRemoteFiles.value
  }
  return filterFilesByParsePolicy(
    (fileList.value || []).filter((file) => getFileFolderPath(file) === currentFolderPreviewPath.value),
    sidebarCore.allowUnparsed.value
  ).map((file) => ({
    fileId: String(getFileIdentifier(file)),
    name: file.name || '未命名文件',
    type: file.type || getFileTypeFromExtension(file.name),
    folderPath: getFileFolderPath(file) || currentFolderPreviewPath.value,
    sourceFile: file
  }))
})

const folderPreviewDisplayTotal = computed(() => {
  if (isCurrentFolderPreviewRemote.value) return folderPreviewTotal.value
  return currentFolderPreviewFiles.value.length
})

/**
 * 将接口文件行映射为文件夹预览列表项
 * @param {Object} rawFile 接口文件
 * @param {string} folderPath 文件夹路径
 * @returns {Object} 列表行
 */
const mapFolderPreviewRemoteFileRow = (rawFile, folderPath) => {
  const fileName = rawFile.file_name || rawFile.original_name || '未命名文件'
  const fileId = String(rawFile.file_id || '')
  const inferredType = getFileTypeFromExtension(fileName)
  return {
    fileId,
    name: fileName,
    type: inferredType,
    folderPath: folderPath || currentFolderPreviewPath.value || '',
    sourceFile: {
      id: fileId,
      fileId,
      file_id: fileId,
      name: fileName,
      type: inferredType,
      folderPath: normalizeFolderPathForTree(folderPath || ''),
      folder_path: folderPath || ''
    }
  }
}

/**
 * 按文件夹 ID 拉取合同文件列表
 * @param {string} folderId 文件夹 ID
 * @param {string} folderPath 文件夹路径
 * @param {string} folderName 文件夹名称
 * @param {number} [page] 页码
 * @returns {Promise<void>}
 */
const loadFolderPreviewFilesByFolderId = async (folderId, folderPath, folderName, page = 1) => {
  if (!folderId) {
    clearFolderPreviewMode()
    return
  }
  currentFolderPreviewFolderId.value = folderId
  currentFolderPreviewPath.value = normalizeFolderPathForTree(folderPath || '')
  currentFolderPreviewName.value = folderName || folderPath || '文件夹'
  folderPreviewPage.value = page
  folderPreviewLoading.value = true
  try {
    const res = await getFileListAPI(
      buildFolderFileListQueryParams(
        { folder_id: folderId, page, page_size: folderPreviewPageSize.value },
        { allowUnparsed: sidebarCore.allowUnparsed.value }
      )
    )
    if (res?.code === 200 && res?.data?.files) {
      const rows = (res.data.files || []).filter((raw) => {
        const name = raw.file_name || raw.original_name || ''
        const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
        return CONTRACT_EXT_SET.has(ext)
      })
      folderPreviewTotal.value = Number(res.data.total || rows.length)
      currentFolderPreviewRemoteFiles.value = rows.map((raw) =>
        mapFolderPreviewRemoteFileRow(raw, currentFolderPreviewPath.value)
      )
    } else {
      folderPreviewTotal.value = 0
      currentFolderPreviewRemoteFiles.value = []
    }
    isCurrentFolderPreviewRemote.value = true
  } catch (error) {
    console.error('文件夹列表加载失败:', error)
    folderPreviewTotal.value = 0
    currentFolderPreviewRemoteFiles.value = []
    isCurrentFolderPreviewRemote.value = true
    ElMessage.error('文件夹列表加载失败')
  } finally {
    folderPreviewLoading.value = false
  }
}

/**
 * 文件夹列表翻页
 * @param {number} page 页码
 * @returns {Promise<void>}
 */
const handleFolderPreviewPageChange = async (page) => {
  if (!currentFolderPreviewFolderId.value) return
  await loadFolderPreviewFilesByFolderId(
    currentFolderPreviewFolderId.value,
    currentFolderPreviewPath.value,
    currentFolderPreviewName.value,
    page
  )
}

/**
 * 记录待删除文件（仅前端，批量执行时写入 deleted_files）
 * @param {Array} files 文件对象数组
 * @returns {void}
 */
const recordPendingFileDeletes = (files) => {
  const existingKeys = new Set(
    (pendingDeleteRecords.value.files || []).map((item) => `${item.fileId}|${item.folderPath}`)
  )
  ;(files || []).forEach((file) => {
    const fileId = String(getFileIdentifier(file) || file.fileId || '')
    if (!fileId) return
    const folderPath = getFileFolderPath(file) || file.folderPath || currentFolderPreviewPath.value || '根目录'
    const itemKey = `${fileId}|${folderPath}`
    if (existingKeys.has(itemKey)) return
    const snapshot = file.sourceFile
      ? JSON.parse(JSON.stringify(file.sourceFile))
      : JSON.parse(JSON.stringify(file))
    pendingDeleteRecords.value.files.push({
      fileId,
      fileName: file.name || file.file_name || '未命名文件',
      folderPath,
      sourceFileSnapshot: snapshot
    })
    existingKeys.add(itemKey)
  })
}

/**
 * 记录待删除文件夹（仅前端）
 * @param {Array} folderList 文件夹列表
 * @returns {void}
 */
const recordPendingFolderDeletes = (folderList) => {
  const existingPaths = new Set(
    (pendingDeleteRecords.value.folders || []).map((item) => item.folderPath)
  )
  ;(folderList || []).forEach((folder) => {
    const folderPath = folder.folderPath || ''
    if (folderPath && !existingPaths.has(folderPath)) {
      pendingDeleteRecords.value.folders.push({
        folderPath,
        folderName: folder.name || folderPath
      })
      existingPaths.add(folderPath)
    }
  })
}

/**
 * 删除文件后清理选中与预览状态
 * @param {Set<string>} deletedFileIds 已删文件 ID 集合
 * @returns {void}
 */
const cleanupAfterFileDelete = (deletedFileIds) => {
  const sel = sidebarCore.leftSidebarBindings.selectedFiles
  if (sel && sel.value) {
    sel.value = sel.value.filter((id) => !deletedFileIds.has(String(id)))
  }
  if (currentFile.value && deletedFileIds.has(String(getFileIdentifier(currentFile.value)))) {
    currentFile.value = null
    currentPreviewFileKey.value = ''
  }
}

/**
 * 判断文件是否已标记待删除
 * @param {Object|string} fileOrId 文件或 ID
 * @returns {boolean} 是否待删除
 */
const isFilePendingDelete = (fileOrId) => {
  const target = typeof fileOrId === 'string' || typeof fileOrId === 'number'
    ? String(fileOrId || '').trim()
    : String(getFileIdentifier(fileOrId) || '')
  if (!target) return false
  return (pendingDeleteRecords.value.files || []).some(
    (item) => String(item.fileId) === target
  )
}

/**
 * 按文件夹路径删除本地文件（仅前端）
 * @param {Array<string>} folderPaths 文件夹路径列表
 * @returns {void}
 */
const deleteFilesByFolderPaths = (folderPaths) => {
  const normalizedPaths = (folderPaths || []).filter(Boolean)
  if (normalizedPaths.length === 0) return
  const filesToDelete = (fileList.value || []).filter((file) => {
    const path = getFileFolderPath(file)
    return normalizedPaths.some(
      (folderPath) => path === folderPath || path.startsWith(`${folderPath}/`)
    )
  })
  const deletedIdSet = new Set(filesToDelete.map((file) => String(getFileIdentifier(file))))
  recordPendingFileDeletes(filesToDelete)
  fileList.value = (fileList.value || []).filter(
    (file) => !deletedIdSet.has(String(getFileIdentifier(file)))
  )
  cleanupAfterFileDelete(deletedIdSet)
}

/**
 * 文件夹预览区删除勾选文件（仅前端）
 * @param {Array<string>} selectedFileIds 勾选文件 ID 列表
 * @returns {void}
 */
const handleDeleteSelectedFolderPreviewFiles = (selectedFileIds = []) => {
  const normalizedSelectedIds = (selectedFileIds || []).map((id) => String(id)).filter(Boolean)
  if (normalizedSelectedIds.length === 0) {
    ElMessage.warning('请先勾选要删除的文件')
    return
  }
  ElMessageBox.confirm(
    `确定删除已勾选的 ${normalizedSelectedIds.length} 个文件吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      const selectedIdSet = new Set(normalizedSelectedIds)
      const filesToDelete = currentFolderPreviewFiles.value
        .filter((item) => selectedIdSet.has(String(item.fileId)))
        .map((item) => ({
          id: item.fileId,
          fileId: item.fileId,
          name: item.name,
          folderPath: item.folderPath || currentFolderPreviewPath.value || '根目录',
          sourceFile: item.sourceFile || null,
          type: item.type || getFileTypeFromExtension(item.name || '')
        }))
      recordPendingFileDeletes(filesToDelete)
      fileList.value = (fileList.value || []).filter(
        (f) => !selectedIdSet.has(String(getFileIdentifier(f)))
      )
      cleanupAfterFileDelete(selectedIdSet)
      ElMessage.success('已删除勾选文件（仅前端）')
    })
    .catch(() => {})
}

/**
 * 恢复文件夹预览区已删除文件（仅前端，仅从剔除数据中移除，不重复写回 fileList）
 * @param {Object} rowData 列表行
 * @returns {void}
 */
const handleRestoreFolderPreviewFile = (rowData) => {
  const targetId = String((rowData && rowData.fileId) || '')
  if (!targetId || !isFilePendingDelete(targetId)) {
    return
  }
  pendingDeleteRecords.value.files = (pendingDeleteRecords.value.files || []).filter(
    (item) => String(item.fileId) !== targetId
  )
  ElMessage.success('文件已恢复（仅前端）')
}

/**
 * 删除单个文件夹节点（仅前端）
 * @param {Object} treeNode 树节点
 * @returns {void}
 */
const handleDeleteFolderNode = (treeNode) => {
  if (!treeNode || treeNode.nodeType !== 'folder') return
  const folderPath = treeNode.folderPath || ''
  if (!folderPath) return
  ElMessageBox.confirm(
    `确定删除文件夹 "${treeNode.name}" 及其下文件吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      recordPendingFolderDeletes([{ folderPath, name: treeNode.name }])
      deleteFilesByFolderPaths([folderPath])
      sidebarCore.checkedFolderPaths.value = sidebarCore.checkedFolderPaths.value.filter(
        (path) => path !== folderPath && !path.startsWith(`${folderPath}/`)
      )
      if (
        currentFolderPreviewPath.value === folderPath
        || currentFolderPreviewPath.value.startsWith(`${folderPath}/`)
      ) {
        clearFolderPreviewMode()
      }
      sidebarCore.leftSidebarBindings.fileTreeRenderKey.value += 1
      ElMessage.success('文件夹已删除（仅前端）')
    })
    .catch(() => {})
}

/**
 * 删除勾选文件夹（仅前端）
 * @returns {void}
 */
const handleDeleteCheckedFolders = () => {
  const paths = sidebarCore.checkedFolderPaths.value || []
  if (paths.length === 0) {
    ElMessage.warning('请先勾选文件夹')
    return
  }
  ElMessageBox.confirm(
    `确定删除已勾选的 ${paths.length} 个文件夹及其下文件吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      const pathsToDelete = [...paths]
      recordPendingFolderDeletes(
        pathsToDelete.map((path) => ({
          folderPath: path,
          name: path.split('/').pop() || path
        }))
      )
      deleteFilesByFolderPaths(pathsToDelete)
      if (
        currentFolderPreviewPath.value
        && pathsToDelete.some(
          (path) =>
            currentFolderPreviewPath.value === path
            || currentFolderPreviewPath.value.startsWith(`${path}/`)
        )
      ) {
        clearFolderPreviewMode()
      }
      sidebarCore.checkedFolderPaths.value = []
      sidebarCore.leftSidebarBindings.fileTreeRenderKey.value += 1
      ElMessage.success('已删除勾选文件夹（仅前端）')
    })
    .catch(() => {})
}

/**
 * 构建批量执行 deleted_files 排除项
 * @returns {Array<{file_id: string, folder_path: string}>} 待排除文件
 */
const buildDeletedFilesPayload = () =>
  (pendingDeleteRecords.value.files || [])
    .map((item) => ({
      file_id: String(item.fileId || ''),
      folder_path: item.folderPath || ''
    }))
    .filter((item) => item.file_id)

/**
 * 从树节点解析源文件
 * @param {Object} treeNode 树节点
 * @returns {Object|null} 文件对象
 */
const resolveSourceFileFromTreeNode = (treeNode) => {
  if (!treeNode) return null
  if (treeNode.sourceFile) return treeNode.sourceFile
  if (treeNode.nodeType !== 'file') return null
  const id = String(treeNode.treeKey || '').replace(/^file:/, '')
  if (!id) return null
  return (fileList.value || []).find((f) => String(getFileIdentifier(f)) === id) || null
}

/**
 * 选择文件并加载预览
 * @param {Object} file 文件对象
 * @returns {Promise<void>}
 */
const selectFile = async (file) => {
  if (!file) return
  clearFolderPreviewMode()
  showFilePreview.value = true

  const previewId = String(getFileIdentifier(file) || '')
  const fileName = file.name || file.file_name || '未命名文件'
  const fileType = getFileTypeFromExtension(fileName) || file.type || 'text'
  const normalized = {
    ...file,
    id: file.id || previewId,
    fileId: file.fileId || file.file_id || previewId,
    file_id: file.file_id || file.fileId || previewId,
    name: fileName,
    type: fileType,
    previewUrl: file.previewUrl || ''
  }

  if (previewId && !normalized.previewUrl) {
    try {
      const previewRes = await previewFileAPI(previewId)
      if (previewRes.code === 200 && previewRes.data?.preview_url) {
        normalized.previewUrl = previewRes.data.preview_url
      }
    } catch (e) {
      console.warn('获取预览URL失败:', e)
    }
  }

  if (!fileConfigMap[previewId]) {
    fileConfigMap[previewId] = createDefaultFileConfigEntry()
  }

  currentPreviewFileKey.value = previewId || fileName
  currentFile.value = normalized
  currentHighlightedField.value = null
  const entry = fileConfigMap[previewId]
  if (entry?.result?.length > 0
    || entry?.autoAnalysisResult?.length > 0
    || String(entry?.autoAnalysisText || '').trim()) {
    viewerTab.value = 'parse'
  }
}

/**
 * 文件夹预览列表中查看文件
 * @param {Object} rowData 列表行
 * @returns {Promise<void>}
 */
const handleViewFolderPreviewFile = async (rowData) => {
  const targetId = String((rowData && rowData.fileId) || '')
  if (!targetId) {
    ElMessage.warning('文件信息不完整，无法查看')
    return
  }
  let sourceFile = rowData.sourceFile || (fileList.value || []).find(
    (f) => String(getFileIdentifier(f)) === targetId
  ) || null
  if (!sourceFile && rowData.name) {
    sourceFile = {
      id: targetId,
      fileId: targetId,
      file_id: targetId,
      name: rowData.name,
      type: rowData.type || getFileTypeFromExtension(rowData.name),
      folderPath: rowData.folderPath || currentFolderPreviewPath.value || ''
    }
  }
  if (!sourceFile) {
    ElMessage.warning('文件信息不完整，无法查看')
    return
  }
  await selectFile(sourceFile)
}

/**
 * 调用 BatchExecuteByFilter 创建合同分析任务
 * @param {number} taskSwitch 任务开关
 * @param {string} name 任务名称
 * @param {string} remark 任务备注
 * @returns {Promise<boolean>} 是否成功
 */
const runContractBatchExecute = async (taskSwitch, name, remark) => {
  if (!hasExecuteTargets.value) {
    ElMessage.warning('请先在左侧添加文件或文件夹')
    return false
  }
  if (!validateContractConfig()) return false

  const taskDataPayload = buildToolBatchExecutePayload({
    taskName: name,
    taskRemark: remark,
    toolLabel: props.toolLabel,
    bizType: 'contractCompleteness',
    taskType: 2,
    taskSwitch,
    buildExecConfig: buildContractExecConfig,
    sidebarContext: getSidebarExecuteContext(),
    parseStatus: ['parsed'],
    fileExtensions: CONTRACT_EXTENSIONS
  })
  const deletedFiles = buildDeletedFilesPayload()
  if (deletedFiles.length > 0) {
    taskDataPayload.deleted_files = deletedFiles
  }

  batchExecuteAborted = false
  isViewerActive.value = true
  activeBatchExecuteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null

  let succeeded = false
  await runBatchExecuteWithTimeoutNav({
    taskName: name,
    requestFn: () => batchExecuteByFilterAPI(taskDataPayload, {
      signal: activeBatchExecuteAbortController ? activeBatchExecuteAbortController.signal : undefined
    }),
    openTaskCenter: () => {
      invalidateBatchExecute()
      emit('close-dialog')
      openTaskCenterWithRefresh(router, homeStore)
    },
    onError: (error) => {
      ElMessage.error('创建任务失败: ' + (error.message || '未知错误'))
    },
    onResponse: (response, { timeoutFallbackTriggered }) => {
      if (response.code === 200 || response.code === 201) {
        const taskUuid = response?.data?.task_uuid || response?.task_uuid || ''
        if (
          taskUuid &&
          props.eventKey &&
          !batchExecuteAborted &&
          isViewerActive.value &&
          !timeoutFallbackTriggered
        ) {
          setAnalysisTaskUuid(taskUuid)
          eventBus.emit(props.eventKey, { taskUuid, taskName: name })
        }
        extracting.value = true
        if (!timeoutFallbackTriggered) {
          ElMessage.success(`任务"${name}"创建成功`)
        }
        succeeded = true
        return
      }
      if (!timeoutFallbackTriggered) {
        ElMessage.error(response.message || '任务创建失败')
      } else {
        console.warn('超时兜底已触发，后续接口返回失败:', response)
      }
    }
  })
  return succeeded
}

const sidebarCore = useSimpleOcrLeftSidebar({
  files: fileList,
  toolLabel: props.toolLabel,
  canSelectFileType: CONTRACT_EXTENSIONS,
  onFileClick: (file) => { void selectFile(file) },
  isFileActive: (file) => {
    if (!currentFile.value || !file) return false
    return String(getFileIdentifier(currentFile.value)) === String(getFileIdentifier(file))
  },
  getCanBatchExecute: () => !props.isSecondaryExecution
    && contractBatchExecuteReady.value
    && hasExecuteTargets.value,
  getGlobalBatchSettings: buildContractGlobalBatchSettings,
  onBeforeOpenBatchDialog,
  onBatchExecute: (taskSwitch, name, remark) => runContractBatchExecute(taskSwitch, name, remark),
  onFilesRemoved: (removedFileIds) => {
    const curId = currentFile.value ? String(getFileIdentifier(currentFile.value)) : ''
    if (curId && removedFileIds.includes(curId)) {
      currentFile.value = null
      currentPreviewFileKey.value = ''
    }
  },
  afterFileSelectConfirm: async () => {
    const list = fileList.value || []
    if (list.length === 0) return
    showFilePreview.value = true
    const curId = currentFile.value ? String(getFileIdentifier(currentFile.value)) : ''
    const stillExists = curId && list.some((f) => String(getFileIdentifier(f)) === curId)
    await selectFile(stillExists ? currentFile.value : list[0])
  }
})

const {
  addFilesFromManager,
  getSidebarExecuteContext,
  hasExecuteTargets,
  showFilePreview
} = sidebarCore

/**
 * 侧栏树节点点击
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} [event] 点击事件
 * @returns {Promise<void>}
 */
const handleContractTreeNodeClick = async (treeNode, event) => {
  void event
  if (!treeNode) return
  if (treeNode.nodeType === 'file') {
    const sourceFile = resolveSourceFileFromTreeNode(treeNode)
    if (!sourceFile) {
      ElMessage.warning('文件信息不完整，无法预览')
      return
    }
    await selectFile(sourceFile)
    return
  }
  if (treeNode.nodeType === 'folder') {
    showFilePreview.value = true
    currentFile.value = null
    const folderId = treeNode.folderId || ''
    const folderPath = treeNode.folderPath || ''
    const folderName = treeNode.name || ''
    if (folderId) {
      await loadFolderPreviewFilesByFolderId(folderId, folderPath, folderName, 1)
      return
    }
    const folderPathNorm = normalizeFolderPathForTree(folderPath)
    const localFiles = filterFilesByParsePolicy(
      (fileList.value || []).filter((f) => {
        const fp = getFileFolderPath(f)
        if (!folderPathNorm) return !fp
        return fp === folderPathNorm || fp.startsWith(`${folderPathNorm}/`)
      }),
      sidebarCore.allowUnparsed.value
    )
    if (localFiles.length > 0) {
      isCurrentFolderPreviewRemote.value = false
      currentFolderPreviewPath.value = folderPathNorm
      currentFolderPreviewName.value = folderName
      folderPreviewTotal.value = localFiles.length
      return
    }
    ElMessage.info('该文件夹暂无文件或缺少 folder_id，请重新通过「选择文件」添加')
  }
}

/**
 * 下载全部结果（预览模式占位）
 * @param {string} format 格式
 * @returns {void}
 */
const handleDownloadAllResults = (format) => {
  ElMessage.info(`下载${format}格式功能开发中...`)
}

const leftSidebarBindings = computed(() => ({
  ...sidebarCore.leftSidebarBindings,
  handleTreeNodeClick: handleContractTreeNodeClick,
  isFilePendingDelete,
  handleDeleteFolderNode,
  handleDeleteCheckedFolders,
  getTemplateName: (t) => templateMap[t] || t || '自动',
  previewTaskName,
  handleDownloadAllResults: props.isSecondaryExecution ? handleDownloadAllResults : undefined
}))

const startResize = (e) => {
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = rightSidebarWidth.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.classList.add('resizing')
}

const handleResize = (e) => {
  if (!isResizing.value) return
  const diff = startX.value - e.clientX
  const newWidth = startWidth.value + diff
  if (newWidth >= 300 && newWidth <= 800) {
    rightSidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.classList.remove('resizing')
  localStorage.setItem('ocr-viewer-sidebar-width', String(rightSidebarWidth.value))
}

/**
 * 开始拖拽左侧分隔条
 * @param {MouseEvent} e 鼠标事件
 * @returns {void}
 */
const startLeftSidebarResize = (e) => {
  isResizingLeft.value = true
  leftResizeStartX.value = e.clientX
  leftResizeStartWidth.value = leftSidebarWidth.value
  document.addEventListener('mousemove', handleLeftSidebarResize)
  document.addEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.add('resizing')
}

/**
 * 拖拽中更新左侧宽度
 * @param {MouseEvent} e 鼠标事件
 * @returns {void}
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
 * 结束左侧宽度拖拽并持久化
 * @returns {void}
 */
const stopLeftSidebarResize = () => {
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')
  localStorage.setItem('ocr-viewer-left-sidebar-width', String(leftSidebarWidth.value))
}

/**
 * 加载合同分析模板规则
 * @returns {Promise<void>}
 */
const loadTemplates = async () => {
  try {
    const response = await getPublicAndPrivateTemplatesAPI({
      page: 1,
      size: 15,
      template_classification: 'contract'
    })
    if (response.code === 200 && response.data) {
      response.data.items.forEach((item) => {
        if (item.template_name === '施工类合同') {
          templateRuleList.value.construction = []
          JSON.parse(item.prompt).forEach((childItem) => {
            try {
              let cleanedDescription = childItem.description
              if (cleanedDescription.startsWith("'") && cleanedDescription.endsWith("'")) {
                cleanedDescription = cleanedDescription.slice(1, -1)
              }
              templateRuleList.value.construction.push(JSON.parse(cleanedDescription))
            } catch (error) {
              console.error('解析 description 失败:', error)
            }
          })
        }
        if (item.template_name === '非施工类合同') {
          templateRuleList.value.non_construction = []
          JSON.parse(item.prompt).forEach((childItem) => {
            try {
              let cleanedDescription = childItem.description
              if (cleanedDescription.startsWith("'") && cleanedDescription.endsWith("'")) {
                cleanedDescription = cleanedDescription.slice(1, -1)
              }
              templateRuleList.value.non_construction.push(JSON.parse(cleanedDescription))
            } catch (error) {
              console.error('解析 description 失败:', error)
            }
          })
        }
      })
    }
  } catch (error) {
    console.error('加载模板列表失败:', error)
  }
}

/**
 * 全局配置变更
 * @returns {void}
 */
const handleGlobalConfigChange = () => {
  contractGlobalConfigured.value = true
  configPanelSyncKey.value += 1
}

/**
 * 顶栏分析模板切换：同步规则列表
 * @returns {void}
 */
const handleContractTemplateChange = () => {
  if (!props.isSecondaryExecution) {
    handleGlobalConfigChange()
  } else {
    handleConfigChange()
  }
  nextTick(() => {
    configPanelRef.value?.handleTemplateChange?.()
    configPanelSyncKey.value += 1
  })
}

/**
 * 单文件配置变更（二次执行）
 * @returns {void}
 */
const handleConfigChange = () => {
  if (!currentFile.value) return
  const fileId = String(getFileIdentifier(currentFile.value))
  if (fileId && fileConfigMap[fileId]) {
    fileConfigMap[fileId].configured = true
  }
}

const refresh = () => {
  if (currentFile.value && previewFileRef.value) {
    previewFileRef.value.loadFile(currentFile.value)
    ElMessage.success('已刷新')
  }
}

const download = () => {
  ElMessage.info('下载功能（演示模式）')
}

const handleClearHighlight = () => {
  if (previewFileRef.value) previewFileRef.value.clearDocxHighlights()
  currentHighlightedField.value = null
  ElMessage.success('已清除所有定位样式')
}

const handleTabChange = () => {}

const handleGoToTaskCenter = () => {
  invalidateBatchExecute()
  emit('close-dialog')
  openTaskCenterWithRefresh(router, homeStore)
}

const batchExecuteDialogVisible = ref(false)
const batchRecognizeDialogVisible = ref(false)
const selectedExecuteFiles = ref([])
const filterEditedOnly = ref(false)
const taskName = ref('')
const taskRemark = ref('')
const isAloneFile = ref(false)
const selectFilesMap = reactive({})
const secondaryTaskParams = reactive({})

const transferData = computed(() => {
  if (!props.isSecondaryExecution) return []
  let data = fileList.value || []
  if (filterEditedOnly.value) {
    data = data.filter((file) => {
      const fileId = String(getFileIdentifier(file))
      return fileConfigMap[fileId] && fileConfigMap[fileId].configured
    })
  }
  return data.map((file) => ({
    fileId: String(getFileIdentifier(file)),
    name: file.name || file.file_name || '未知文件',
    file_uuid: String(getFileIdentifier(file))
  }))
})

const secondaryBatchFileList = computed(() => {
  if (isAloneFile.value && currentFile.value) {
    const id = String(getFileIdentifier(currentFile.value))
    return [{
      fileId: id,
      fileName: currentFile.value.name,
      template: fileConfigMap[id]?.config?.template || 'auto'
    }]
  }
  return selectedExecuteFiles.value.map((id) => {
    const file = selectFilesMap[id]
    return {
      fileId: id,
      fileName: file ? file.name : '未知文件',
      template: fileConfigMap[id]?.config?.template || 'auto'
    }
  })
})

/**
 * 构建单文件任务配置（二次执行 createTaskSchedulesAPI）
 * @param {Object} file 文件对象
 * @returns {Object} task_schedule_result 行
 */
const getFileTaskConfig = (file) => {
  const fileUuid = String(getFileIdentifier(file) || file.file_uuid || file.id)
  const fileType = file.file_type || file.type || 'pdf'
  const fileSize = String(file.file_size || file.size || 0)
  const fileName = file.file_name || file.name || '未知文件'
  const currentFileConfig = fileConfigMap[fileUuid]
  const buttonVal = resolveContractButtonValue(currentFileConfig)
  const template = currentFileConfig?.config?.template || 'auto'
  const parameterSettings = { button: buttonVal }
  if (template !== 'auto') {
    Object.assign(parameterSettings, {
      information_extraction: (currentFileConfig?.config?.ruleList || []).map((item) => {
        const copy = { ...item }
        delete copy.extracted_value_completeness
        delete copy.extracted_value_compliance
        delete copy.data_format
        return copy
      }),
      compliance_analysis_prompt: currentFileConfig?.config?.prompt?.compliance_analysis_prompt,
      information_extraction_prompt: currentFileConfig?.config?.prompt?.information_extraction_prompt
    })
  }
  return {
    file_uuid: fileUuid,
    file_name: fileName,
    file_type: fileType,
    file_size: fileSize,
    parameter_template: '{"rules": []}',
    prompt_uuid: 'prompt',
    contract_category: template,
    parameter_settings: parameterSettings
  }
}

/**
 * 创建任务调度（二次执行）
 * @param {Object} params 参数
 * @returns {Promise<Object>} 接口响应
 */
const createTaskRequest = async ({ taskName: name, taskRemark = '', files, taskSwitch }) => {
  const payload = {
    task_name: name,
    tool_uuid: 'contractCompleteness-tool-uuid',
    tool_name: props.toolLabel,
    file_num: String(files.length),
    task_notes: taskRemark,
    task_type: 2,
    task_switch: taskSwitch,
    biz_type: 'contractCompleteness',
    task_schedule_results: files.map((file) => getFileTaskConfig(file))
  }
  return createTaskSchedulesAPI(payload)
}

const handleBatchExecute = () => {
  selectedExecuteFiles.value = []
  filterEditedOnly.value = false
  batchExecuteDialogVisible.value = true
}

const filterMethod = (query, item) => {
  return String(item.name || '').toLowerCase().includes(query.toLowerCase())
}

const handleFilterChange = () => {
  const currentTransferIds = new Set(transferData.value.map((item) => item.file_uuid))
  selectedExecuteFiles.value = selectedExecuteFiles.value.filter((id) => currentTransferIds.has(id))
}

/**
 * 校验二次执行文件配置
 * @param {Array} files 文件列表
 * @returns {boolean} 是否通过
 */
const validateSecondaryFileSettings = (files) => {
  const invalidFiles = []
  ;(files || []).forEach((file) => {
    const fileId = String(getFileIdentifier(file))
    const fileConfig = fileConfigMap[fileId]
    if (!fileConfig) return
    const { template, ruleList } = fileConfig.config || {}
    if (template === 'auto') return
    if (!fileConfig.configured) {
      invalidFiles.push({ fileName: file.name, error: '尚未设置' })
      return
    }
    if (!ruleList || ruleList.length === 0) {
      invalidFiles.push({ fileName: file.name, error: '请至少添加一条规则' })
    }
  })
  if (invalidFiles.length > 0) {
    ElMessage.error(`以下文件的配置不完整：${invalidFiles.map((f) => `${f.fileName}(${f.error})`).join('、')}`)
    return false
  }
  return true
}

const handleReRecognize = (isAlone) => {
  isAloneFile.value = isAlone
  if ((fileList.value || []).length === 0) {
    ElMessage.warning('没有文件可执行')
    return
  }
  if (isAlone && currentFile.value) {
    const id = String(getFileIdentifier(currentFile.value))
    selectedExecuteFiles.value = [id]
  }
  openSecondaryBatchDialog()
}

/**
 * 打开二次执行任务名称弹窗
 * @returns {void}
 */
const openSecondaryBatchDialog = () => {
  const pad2 = (n) => String(n).padStart(2, '0')
  const now = new Date()
  taskName.value = `${props.toolLabel} (${now.getFullYear()}年${pad2(now.getMonth() + 1)}月${pad2(now.getDate())}日 ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())})`
  taskRemark.value = ''
  batchExecuteDialogVisible.value = false
  batchRecognizeDialogVisible.value = true
}

const handleBatchRecognizeCancel = () => {
  batchRecognizeDialogVisible.value = false
  taskName.value = ''
  taskRemark.value = ''
}

const handleBatchRecognizeConfirm = async () => {
  if (!taskName.value.trim()) {
    ElMessage.warning('请输入任务名称')
    return
  }
  const selectFileRows = selectedExecuteFiles.value.map((id) => selectFilesMap[id]).filter(Boolean)
  let executeFiles = []
  if (isAloneFile.value) {
    executeFiles = currentFile.value ? [currentFile.value] : []
  } else {
    executeFiles = selectFileRows
  }
  if (!validateSecondaryFileSettings(executeFiles)) return
  await executeSecondaryFiles(executeFiles)
}

/**
 * 二次执行创建任务
 * @param {Array} files 待执行文件
 * @returns {Promise<void>}
 */
const executeSecondaryFiles = async (files) => {
  try {
    const response = await createTaskRequest({
      taskName: taskName.value,
      taskRemark: taskRemark.value,
      files,
      taskSwitch: 2
    })
    const taskOther = files.map((file) => getFileTaskConfig(file))
    if (response.code === 200) {
      if (response.task_uuid && !batchExecuteAborted && isViewerActive.value) {
        eventBus.emit(props.eventKey, {
          taskUuid: response.task_uuid,
          taskName: taskName.value,
          taskOther
        })
        extracting.value = true
        ElMessage.success('任务已创建，正在执行中...')
        taskName.value = ''
        taskRemark.value = ''
        batchRecognizeDialogVisible.value = false
        return
      }
    }
    ElMessage.error(response.message || '任务创建失败')
  } catch (error) {
    console.error('创建任务失败:', error)
    ElMessage.error('创建任务失败: ' + (error.message || '未知错误'))
  }
}

const applyContractDisposalToConfig = (disposalRaw, config) => {
  let parsedArray = []
  // 有 disposal_result 即尝试解析（步骤聚合可能导致 processing_status 滞后，但结果已落库）
  if (disposalRaw) {
    const parsed = parseContractDisposalResult(disposalRaw)
    if (parsed?.parsedArray?.length) {
      const rules = getInformationExtractionFromSettings(config)
      parsedArray = mergeContractResultsWithRules(
        parsed.parsedArray,
        rules,
        parsed.ruleTemplates || []
      )
      if (rules.length > 0) {
        rules.forEach((rule, ruleIndex) => {
          if (parsedArray[ruleIndex]?.extracted_value != null) {
            rule.extracted_value = parsedArray[ruleIndex].extracted_value
          }
        })
      }
    }
  }
  return parsedArray
}

/**
 * 将 disposal_result 灌入 fileConfigMap 条目（解析表 + text_2）
 * @param {Object} entry fileConfigMap 条目
 * @param {*} disposalRaw disposal_result
 * @param {Object} config parameter_settings 或等价配置
 * @param {Object} [taskMeta] 任务行元数据（contract_category 等）
 * @returns {boolean} 是否写入了解析内容或 text_2
 */
const hydrateContractEntryFromDisposal = (entry, disposalRaw, config, taskMeta = {}) => {
  if (!entry) return false
  const disposalObj = normalizeDisposalResultObject(disposalRaw)

  const hydrateConfig = {
    ...(config && typeof config === 'object' ? config : {}),
    information_extraction: (config && config.information_extraction)
      || entry.config?.ruleList
      || []
  }

  const { rows: text2Rows, fallbackText: text2Fallback } = parseContractText2Rows(
    disposalRaw,
    hydrateConfig
  )
  entry.autoAnalysisResult = text2Rows
  entry.autoAnalysisText = text2Fallback

  const parsedArray = applyContractDisposalToConfig(disposalRaw, hydrateConfig)
  if (parsedArray.length > 0) {
    entry.result = parsedArray
    const outputs = disposalObj?.data?.outputs || disposalObj?.outputs || {}
    const categoryFromOutput = outputs.category
    const categoryKey = taskMeta.contract_category || config?.contract_category
    if ((categoryKey === 'auto' || !categoryKey) && categoryFromOutput) {
      const mappedTemplate = templateMap[categoryFromOutput] || categoryFromOutput
      entry.config.template = mappedTemplate
      entry.config.ruleList = JSON.parse(
        JSON.stringify(templateRuleList.value[mappedTemplate] || [])
      )
    }
    const ruleList = entry.config.ruleList
    if (ruleList && ruleList.length > 0) {
      ruleList.forEach((rule, ruleIndex) => {
        if (parsedArray[ruleIndex] && parsedArray[ruleIndex].extracted_value != null) {
          rule.extracted_value = parsedArray[ruleIndex].extracted_value
          if (typeof rule.extracted_value === 'string') {
            rule.extracted_value_compliance = rule.extracted_value
          }
          if (typeof rule.extracted_value === 'object') {
            rule.extracted_value_completeness = rule.extracted_value
          }
        }
      })
    }
  }

  return parsedArray.length > 0 || text2Rows.length > 0 || !!text2Fallback
}

/**
 * 确保 fileConfigMap 存在指定文件条目
 * @param {string} fileUuid 文件 UUID
 * @returns {Object} 条目
 */
const ensureFileConfigEntry = (fileUuid) => {
  const id = String(fileUuid || '')
  if (!id) return null
  if (!fileConfigMap[id]) {
    fileConfigMap[id] = createDefaultFileConfigEntry()
  }
  if (!Array.isArray(fileConfigMap[id].result)) {
    fileConfigMap[id].result = []
  }
  if (!Array.isArray(fileConfigMap[id].autoAnalysisResult)) {
    fileConfigMap[id].autoAnalysisResult = []
  }
  if (fileConfigMap[id].autoAnalysisText == null) {
    fileConfigMap[id].autoAnalysisText = ''
  }
  return fileConfigMap[id]
}

/**
 * 写入轮询/回调结果到 fileConfigMap
 * @param {Array} result 结果列表
 * @param {Array} taskOther 任务附加信息
 * @returns {void}
 */
const setResult = (result, taskOther) => {
  const map = {}
  ;(taskOther || []).forEach((item) => { map[item.file_uuid] = item })
  let anyHydrated = false
  ;(result || []).forEach((item) => {
    const fileUuid = String(item.file_uuid || item.FILE_UUID || '')
    if (!fileUuid) return
    const entry = ensureFileConfigEntry(fileUuid)
    if (!entry) return

    const config = parseParameterSettings(item.parameter_settings)
    const taskMeta = map[fileUuid] || {}
    const hasContent = hydrateContractEntryFromDisposal(
      entry,
      item.disposal_result,
      config,
      taskMeta
    )
    if (hasContent) anyHydrated = true
  })
  if (anyHydrated) {
    viewerTab.value = 'parse'
    const activeId = currentFile.value ? String(getFileIdentifier(currentFile.value)) : ''
    if (activeId && fileConfigMap[activeId]) {
      // 当前文件已有结果时保持选中；否则切到首个有内容的文件
      const activeEntry = fileConfigMap[activeId]
      const activeHasContent = activeEntry?.result?.length > 0
        || activeEntry?.autoAnalysisResult?.length > 0
        || String(activeEntry?.autoAnalysisText || '').trim()
      if (!activeHasContent) {
        const hit = (result || []).find((item) => {
          const id = String(item.file_uuid || item.FILE_UUID || '')
          const e = fileConfigMap[id]
          return e && (
            e.result?.length > 0
            || e.autoAnalysisResult?.length > 0
            || String(e.autoAnalysisText || '').trim()
          )
        })
        if (hit) {
          const targetId = String(hit.file_uuid || hit.FILE_UUID || '')
          const targetFile = (fileList.value || []).find(
            (f) => String(getFileIdentifier(f)) === targetId
          )
          if (targetFile) {
            void selectFile(targetFile)
          }
        }
      }
    }
  }
  extracting.value = false
}

/**
 * 标记任务失败
 * @returns {void}
 */
const taskError = () => {
  extracting.value = false
}

defineExpose({ setResult, taskError, setAnalysisContext })

/**
 * 加载分析任务详情（供报告状态恢复，文件管理入口无 taskId 时使用）
 * @param {string} taskUuid 任务 UUID
 * @returns {Promise<void>}
 */
const loadAnalysisTaskDetail = async (taskUuid) => {
  const id = String(taskUuid || '').trim()
  if (!id) return
  try {
    const res = await getTaskSchedulesAPI(id, {
      prefer_runtime: false,
      include_results: true,
      include_selection_summary: true
    })
    if (res.code === 200 && res.data) {
      taskData.value = res.data
      previewTaskName.value = res.data.task_name || '-'
      const resultList = res.data.task_schedule_result_list || []
      let anyHydrated = false
      resultList.forEach((resultItem) => {
        const fileId = resultItem.file_uuid
        if (!fileId) return
        const config = parseParameterSettings(resultItem.parameter_settings)
        const entry = ensureFileConfigEntry(fileId)
        entry.config.button = normalizeContractButtonValue(config.button)
        const template = config.contract_category || entry.config.template || 'auto'
        entry.config.template = template
        if (config.information_extraction) {
          entry.config.ruleList = JSON.parse(JSON.stringify(config.information_extraction))
        }
        entry.config.prompt = {
          compliance_analysis_prompt: config.compliance_analysis_prompt,
          information_extraction_prompt: config.information_extraction_prompt
        }
        if (hydrateContractEntryFromDisposal(
          entry,
          resultItem.disposal_result,
          config,
          { contract_category: config.contract_category }
        )) {
          anyHydrated = true
        }
      })
      if (anyHydrated && !props.isSecondaryExecution) {
        viewerTab.value = 'parse'
      }
    }
  } catch (error) {
    console.warn('加载分析任务详情失败:', error)
  }
}

/**
 * 从任务中心加载二次执行任务文件
 * @returns {Promise<void>}
 */
const loadSecondaryTaskFiles = async () => {
  if (!props.taskId) return
  resultViewLoading.value = true
  try {
    const res = await getTaskSchedulesAPI(props.taskId, {
      prefer_runtime: false,
      include_results: true,
      include_selection_summary: true
    })
    if (res.code !== 200 || !res.data?.task_schedule_result_list) return
    taskData.value = res.data
    previewTaskName.value = res.data.task_name || '-'
    applyTaskSelectionToSidebar(sidebarCore, res.data)

    const sourceRefMap = buildSourceRefsFromResultList(res.data.task_schedule_result_list)
    const folderNameMap = buildFolderNameMapFromSourceRefs(sourceRefMap)
    const receivedFiles = []
    res.data.task_schedule_result_list.forEach((resultItem) => {
      const fileId = resultItem.file_uuid
      if (!fileId) return

      const config = parseParameterSettings(resultItem.parameter_settings)
      const disposalObj = normalizeDisposalResultObject(resultItem.disposal_result)
      const template = disposalObj
        ? templateMap[disposalObj?.data?.outputs?.category || disposalObj?.outputs?.category]
        : config?.contract_category || 'auto'
      const ruleList = config?.information_extraction
        ? JSON.parse(JSON.stringify(config.information_extraction))
        : JSON.parse(JSON.stringify(templateRuleList.value[template || 'auto'] || []))
      const prompt = {
        compliance_analysis_prompt: config?.compliance_analysis_prompt,
        information_extraction_prompt: config?.information_extraction_prompt
      }
      const isLoading = resultItem.processing_status !== 2

      const entry = {
        configured: false,
        config: {
          template: template || config?.contract_category || 'auto',
          ruleList,
          prompt,
          button: normalizeContractButtonValue(config?.button)
        },
        isLoading,
        result: [],
        autoAnalysisResult: [],
        autoAnalysisText: ''
      }
      hydrateContractEntryFromDisposal(
        entry,
        resultItem.disposal_result,
        config,
        { contract_category: config?.contract_category }
      )
      fileConfigMap[fileId] = entry

      const fileName = resultItem.file_name || '文件'
      const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
      const newFile = enrichFileRowWithSourceRefs({
        id: fileId,
        name: fileName,
        file_name: fileName,
        type: getFileTypeFromExtension(fileName),
        previewUrl: '',
        fileId,
        file_uuid: fileId,
        status: mapProcessingStatus(resultItem.processing_status),
        processing_status: resultItem.processing_status
      }, resultItem, folderNameMap)
      selectFilesMap[fileId] = { ...newFile }
      receivedFiles.push(newFile)
    })

    fileList.value = receivedFiles
    sidebarCore.leftSidebarBindings.fileTreeRenderKey.value += 1

    if (receivedFiles.length > 0) {
      const pref = props.fileId ? String(props.fileId) : ''
      const target = pref
        ? receivedFiles.find((f) => String(getFileIdentifier(f)) === pref) || receivedFiles[0]
        : receivedFiles[0]
      const targetId = String(getFileIdentifier(target))
      if (
        fileConfigMap[targetId]?.result?.length > 0
        || fileConfigMap[targetId]?.autoAnalysisResult?.length > 0
        || String(fileConfigMap[targetId]?.autoAnalysisText || '').trim()
      ) {
        viewerTab.value = 'parse'
      }
      await selectFile(target)
    }
  } catch (error) {
    console.error('加载任务文件失败:', error)
  } finally {
    resultViewLoading.value = false
  }
}

/**
 * 从文件管理入口初始化文件
 * @returns {Promise<void>}
 */
const initFilesFromProps = async () => {
  if (props.isSecondaryExecution) return
  const fileIds = props.files
  const fileNames = props.names
  if (!fileIds || !fileNames) return
  const ids = fileIds.split(',')
  const names = decodeURIComponent(fileNames).split(',')
  addFilesFromManager(ids.map((id, index) => ({
    file_id: id,
    file_name: names[index] || `文件${index + 1}`,
    folder_path: ''
  })))
  await nextTick()
  if (fileList.value.length > 0) {
    await selectFile(fileList.value[0])
  }
}

onMounted(async () => {
  isViewerActive.value = true
  await loadTemplates()
  if (props.isSecondaryExecution) {
    await loadSecondaryTaskFiles()
    if (props.taskId) {
      setAnalysisTaskUuid(props.taskId)
      await refreshReportBySource()
    }
  } else {
    await initFilesFromProps()
    if (props.analysisTaskId) {
      setAnalysisTaskUuid(props.analysisTaskId)
      await loadAnalysisTaskDetail(props.analysisTaskId)
      await refreshReportBySource()
    }
  }
})

onBeforeUnmount(() => {
  invalidateBatchExecute()
  disposeReport()
})

onUnmounted(() => {
  if (isResizing.value) stopResize()
  if (isResizingLeft.value) stopLeftSidebarResize()
})
</script>

<style scoped>
.ocr-viewer {
  display: flex;
  align-items: stretch;
  height: calc(100vh - 75px);
  overflow: hidden;
  background: var(--sd-surface-1, #f4f4f4);
}

.ocr-viewer :deep(.ocr-sidebar-footer) {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
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

.field-mode-header.ocr-column-head {
  justify-content: flex-start;
}

.ocr-select-files-btn {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--sd-primary, #195fb4);
  border: 1px solid var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
}

.ocr-select-files-btn:hover,
.ocr-select-files-btn:focus {
  color: var(--sd-primary-dark, #0f4a8c);
  border-color: var(--sd-primary-dark, #0f4a8c);
  background: var(--sd-primary-light, #e8f0f8);
}

.ocr-footer-btn {
  width: 100%;
  height: 32px;
  min-height: 32px;
}

.left-sidebar-shell {
  align-self: stretch;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  background: var(--sd-canvas, #ffffff);
}

.left-sidebar-shell.resizable-left-sidebar {
  transition: width 0s;
}

.left-sidebar-shell :deep(.left-sidebar) {
  width: 100%;
  height: 100%;
  border-right: none;
  flex: 1;
  min-height: 0;
}

.ocr-viewer--embedded {
  height: 100%;
  flex: 1;
  min-height: 0;
}

.secondary-batch-area {
  flex-shrink: 0;
  padding-bottom: 4px;
}

.center-viewer {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.center-viewer :deep(.preview-file-wrapper) {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.center-viewer :deep(.viewer-header.ocr-column-head) {
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.right-viewer {
  display: flex;
  flex-direction: column;
  min-width: 260px;
  max-width: 700px;
  transition: width 0s;
  flex-shrink: 0;
  align-self: stretch;
  min-height: 0;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
}

.right-viewer-fullwidth {
  flex: 1;
  max-width: none !important;
  min-width: 0 !important;
}

.right-viewer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 0 12px;
  box-sizing: border-box;
}

.right-viewer-head .sidebar-tabs {
  flex: 1;
  min-width: 0;
}

.sidebar-tabs {
  flex-shrink: 0;
}

.sidebar-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.sidebar-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.right-sidebar {
  flex: 1;
  width: 100%;
  min-height: 0;
  background: var(--sd-canvas, #ffffff);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 12px;
}

.right-sidebar--extract {
  padding: 0;
}

.right-sidebar--extract .field-mode-header {
  flex-shrink: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.right-sidebar--extract .config-panel-wrap {
  flex: 1;
  min-height: 0;
}

.extraction-results {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.config-panel-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
}

.settings-status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  margin: 12px 12px 0;
  background: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  font-size: 13px;
  color: #409eff;
}

.settings-status-banner__left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.auto-analysis-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 10px;
}

.auto-analysis-label {
  margin-right: 8px;
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.contract-result-section {
  display: flex;
  flex-direction: column;
  min-height: 240px;
}

.contract-auto-analysis-alert {
  margin: 0 0 12px;
}

.contract-auto-analysis-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.settings-status-banner--hint {
  background: #fdf6ec;
  border-color: #f5dab1;
  color: #e6a23c;
}

:deep(.batch-recognize-dialog) .el-dialog__header,
:deep(.batch-settings-dialog) .el-dialog__header {
  padding-bottom: 0;
}

.settings-status-banner .status-icon {
  font-size: 16px;
  color: #67c23a;
  margin-right: 8px;
}

.resizer {
  width: 4px;
  background: #e4e7ed;
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10;
  flex-shrink: 0;
}

.resizer-left {
  border-right: 1px solid #e4e7ed;
}

.resizer:hover {
  background: #409eff;
}

.resize-icon {
  font-size: 12px;
  color: #909399;
  pointer-events: none;
}

.resizer:hover .resize-icon {
  color: #409eff;
}

:global(body.resizing) {
  user-select: none;
  cursor: col-resize;
}

:global(body.resizing) .resizer {
  background-color: #409eff;
  opacity: 1;
}

.batch-recognize-content {
  display: flex;
  flex-direction: column;
}

.contract-report-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  margin-left: 12px;
  padding: 0;
}

.contract-report-toolbar__btn-wrap {
  display: inline-block;
}

.contract-report-toolbar__export-btn {
  margin-left: 8px;
}

.contract-report-progress-hint {
  margin: 0 0 12px;
  color: #606266;
  font-size: 13px;
}

.contract-report-progress-error {
  margin: 0 0 12px;
  color: #f56c6c;
  font-size: 13px;
}

.contract-report-progress-tree {
  max-height: 360px;
  overflow: auto;
}

.batch-recognize-content > * + * {
  margin-top: 20px;
}

.batch-file-list {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  background: #fafbfc;
}

.batch-file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.file-count {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.batch-execute-dialog :deep(.el-transfer) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50vh;
}

.batch-execute-dialog :deep(.el-transfer-panel) {
  width: 45%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.batch-execute-dialog :deep(.el-transfer__buttons) {
  display: flex;
}

.transfer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.transfer-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
