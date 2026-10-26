<template>
  <div
    class="tla-container"
    :class="{ 'tla-container--embedded': isSecondaryExecution }"
    v-loading="initialLoading"
    element-loading-text="加载任务数据中..."
  >
    <!-- 左侧：公共文件树 + 拖拽条 -->
    <div class="left-sidebar-group">
      <div
        class="left-sidebar-shell resizable-left-sidebar"
        :style="{ width: leftSidebarWidth + 'px' }"
      >
        <OcrLeftSidebar
          v-if="isTaskDetailMode"
          :bindings="taskPreviewSidebarBindings"
          mode="preview"
          :task-id="resolvedTaskId"
          :readonly="true"
          :allow-mode-switch="false"
          :show-preview-toggle="false"
          :allow-folder-click-in-preview="true"
          :hide-preview-runtime-progress="true"
          compact-file-header
          layout-mode="full"
          empty-description="暂无任务文件"
        />
        <OcrLeftSidebar
          v-else
          :bindings="leftSidebarBindings"
          layout-mode="tree-select"
          mode="edit"
          :readonly="false"
          :allow-mode-switch="false"
          :show-preview-toggle="false"
          compact-file-header
          empty-description="暂无文件，请点击「选择文件」添加"
        >
          <template #footer>
            <el-button
              type="primary"
              class="tla-execute-btn ocr-footer-btn"
              :loading="isAnalyzing"
              :disabled="!canAnalyze"
              @click="handleExecuteClick"
            >
              执行
            </el-button>
          </template>
        </OcrLeftSidebar>
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
    </div>

    <!-- 中间：文件夹列表 / 时间轴 -->
    <div class="tla-main-panel">
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
        :readonly="isTaskDetailMode"
        show-back-button
        back-button-text="返回时间轴"
        @back="handleFolderPreviewBack"
        @page-change="handleFolderPreviewPageChange"
        @delete-selected="handleDeleteSelectedFolderPreviewFiles"
        @restore-file="handleRestoreFolderPreviewFile"
        @view-file="handleViewFolderPreviewFile"
      />
      <TimelineDisplay
        v-else
        ref="timelineDisplayRef"
        :timelineData="timelineData"
        :activeFileId="activeFileId"
        :isAnalyzing="isAnalyzing"
        :auto-expand-all="isTaskDetailMode"
        @timelineClick="handleTimelineClick"
      />
    </div>

    <!-- 右侧提示词面板 -->
    <div class="tla-prompt-shell">
      <PromptPanel
        v-model:promptId="promptId"
        v-model:promptText="promptText"
        :initialPrompt="historyPrompt"
        :initialPromptId="historyPromptId"
        :readonly="isTaskDetailMode"
      />
    </div>

    <!-- 创建任务弹窗 -->
    <CreateTaskDialog
      v-model:visible="createTaskDialogVisible"
      :defaultTaskName="defaultTaskName"
      :sidebar-context="getSidebarExecuteContext()"
      :deleted-files="deletedFilesForExecute"
      :promptId="promptId"
      :promptText="promptText"
      :tool-label="props.toolLabel"
      @taskCreated="handleTaskCreated"
    />

    <!-- 进度弹窗：独立页 / 任务中心详情（进行中任务） -->
    <ProgressDialog
      v-if="showSelfProgressDialog"
      v-model:visible="progressDialogVisible"
      :taskUuid="selfManagedTaskUuid"
      @completed="handleProgressCompleted"
      @failed="handleProgressFailed"
      @closed="handleProgressClosed"
      @return-to-task-center="handleProgressReturnToTaskCenter"
    />

    <!-- 文件预览弹窗 -->
    <el-dialog
      v-model="filePreviewVisible"
      width="90%"
      top="5vh"
      destroy-on-close
      append-to-body
      class="tla-file-preview-dialog"
      :title="filePreviewTitle"
    >
      <div class="tla-file-preview-body" v-loading="filePreviewLoading">
        <PreviewFile
          v-if="filePreviewFile && !filePreviewLoading"
          :current-file="filePreviewFile"
          :current-highlighted-field="null"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHomeStore } from '@/stores/home'
import { ElMessage } from 'element-plus'
import { DArrowRight } from '@element-plus/icons-vue'
import { eventBus } from '@/utils/eventBus.js'
import { openTaskCenterWithRefresh } from '@/views/file-manager-code/composables/batchExecuteTimeoutNav.js'
import OcrLeftSidebar from '@/views/file-manager-code/components/OcrLeftSidebar.vue'
import OcrFolderPreviewPanel from '@/views/file-manager-code/components/OcrFolderPreviewPanel.vue'
import PreviewFile from '@/views/file-manager-code/components/PreviewFile.vue'
import { useSimpleOcrLeftSidebar } from '@/views/file-manager-code/composables/useSimpleOcrLeftSidebar.js'
import { useOcrFolderPreview } from '@/views/file-manager-code/composables/useOcrFolderPreview.js'
import { useTaskCenterPreviewSidebar } from '@/views/file-manager-code/composables/useTaskCenterPreviewSidebar.js'
import { getFileIdentifier } from '@/views/file-manager-code/composables/ocrLeftSidebarTreeUtils.js'
import { previewFileAPI } from '@/api/fileManager.js'
import TimelineDisplay from './components/TimelineDisplay.vue'
import CreateTaskDialog from './components/CreateTaskDialog.vue'
import ProgressDialog from './components/ProgressDialog.vue'
import PromptPanel from './components/PromptPanel.vue'
import { getTimelineAnalysisResultAPI } from '@/api/IcssPlatform/timelineAnalysis.js'
import { getTaskSchedulesAPI } from '@/api/task.js'

const route = useRoute()
const router = useRouter()
const homeStore = useHomeStore()

const props = defineProps({
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
    type: [Number, String],
    default: null
  },
  files: {
    type: String,
    default: ''
  },
  names: {
    type: String,
    default: ''
  },
  eventKey: {
    type: String,
    default: ''
  },
  isSecondaryExecution: {
    type: Boolean,
    default: false
  },
  toolLabel: {
    type: String,
    default: '时间轴分析'
  }
})

const emit = defineEmits(['close-dialog'])

/** 任务中心详情 / 路由回看模式 */
const isTaskDetailMode = computed(() => {
  if (props.isSecondaryExecution) return !!(props.taskId || props.analysisId)
  return !!route.query.analysisId
})

/** 解析后的任务 UUID（详情加载用） */
const resolvedTaskId = computed(() => props.taskId || props.analysisId || route.query.analysisId || '')

const timelineData = ref([])
const activeFileId = ref(null)
const isAnalyzing = ref(false)
/** 任务中心详情：整页加载（侧栏 + 时间轴结果，对齐信息提取 TaskResultViewer） */
const initialLoading = ref(false)
/** 中间时间轴组件引用（用于加载后全部展开） */
const timelineDisplayRef = ref(null)

/** 左侧边栏允许的最小、最大宽度（像素） */
const LEFT_SIDEBAR_WIDTH_MIN = 200
const LEFT_SIDEBAR_WIDTH_MAX = 560
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

const uploadedFiles = ref([])

const sidebarCore = useSimpleOcrLeftSidebar({
  files: uploadedFiles,
  canSelectFileType: ['.pdf', '.doc', '.docx', '.wps'],
  toolLabel: props.toolLabel,
  isFileActive: (file) => {
    const fileId = getFileIdentifier(file)
    return fileId && activeFileId.value && String(fileId) === String(activeFileId.value)
  },
  onFileClick: async (sourceFile) => {
    await handleSidebarFileClick(sourceFile)
  }
})

const {
  leftSidebarBindings: sidebarBindingsBase,
  addFilesFromManager,
  getSidebarExecuteContext,
  hasExecuteTargets: canAnalyze,
  allowUnparsed
} = sidebarCore

const folderPreview = useOcrFolderPreview({
  files: uploadedFiles,
  selectedFiles: sidebarBindingsBase.selectedFiles,
  allowUnparsed,
  fileExtensions: ['.pdf', '.doc', '.docx', '.wps'],
  onViewFile: async (rowData) => {
    const sourceFile = rowData?.sourceFile || {
      file_id: rowData?.fileId,
      fileId: rowData?.fileId,
      name: rowData?.name,
      file_name: rowData?.name
    }
    clearFolderPreviewMode()
    await openFilePreview(sourceFile)
  },
  onClearPreview: () => {
    activeFileId.value = null
  },
  isCurrentPreviewFileId: (fileId) =>
    activeFileId.value && String(fileId) === String(activeFileId.value)
})

const {
  pendingDeleteRecords,
  pendingDeleteFileIds,
  currentFolderPreviewName,
  currentFolderPreviewFiles,
  isFolderListPreviewMode,
  folderPreviewDisplayTotal,
  folderPreviewLoading,
  isCurrentFolderPreviewRemote,
  folderPreviewTotal,
  folderPreviewPageSize,
  folderPreviewPage,
  clearFolderPreviewMode,
  handleFolderPreviewPageChange,
  handleDeleteSelectedFolderPreviewFiles,
  handleRestoreFolderPreviewFile,
  handleViewFolderPreviewFile,
  handleFolderTreeNodeClick,
  isFilePendingDelete,
  buildDeletedFilesPayload
} = folderPreview

/** 任务详情预览侧栏：中间预览显隐占位（时间轴无独立预览区开关） */
const taskPreviewShowFilePreview = ref(true)

/**
 * 任务中心详情：预览侧栏树节点点击
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} [event] 点击事件
 * @returns {Promise<void>}
 */
const handleTaskPreviewTreeNodeClick = async (treeNode, event) => {
  if (!treeNode) return
  if (treeNode.nodeType === 'folder') {
    activeFileId.value = null
    await handleFolderTreeNodeClick(treeNode)
    return
  }
  if (treeNode.nodeType !== 'file') return
  clearFolderPreviewMode()
  const sourceFile = taskPreviewCore.resolveSourceFileFromTreeNode(treeNode)
  if (!sourceFile) return
  if (event && event.altKey) {
    await openFilePreview(sourceFile)
    return
  }
  await handleSidebarFileClick(sourceFile)
}

const taskPreviewCore = useTaskCenterPreviewSidebar({
  taskId: resolvedTaskId,
  taskName: computed(() => props.taskName || props.toolLabel),
  showFilePreview: taskPreviewShowFilePreview,
  isFileActive: (file) => {
    const fileId = getFileIdentifier(file) || file.file_uuid || file.file_id || file.result_uuid
    return fileId && activeFileId.value && String(fileId) === String(activeFileId.value)
  },
  handleTreeNodeClick: handleTaskPreviewTreeNodeClick
})

const {
  taskPreviewSidebarBindings,
  loadTaskCenterPreviewSidebar
} = taskPreviewCore

/** 执行时需排除的前端待删文件 */
const deletedFilesForExecute = computed(() => buildDeletedFilesPayload())

/**
 * 左侧公共树 bindings
 * @returns {Object} 侧栏绑定
 */
const leftSidebarBindings = computed(() => ({
  ...sidebarBindingsBase,
  handleTreeNodeClick: handleSidebarTreeNodeClick,
  isFilePendingDelete,
  previewTaskName: props.taskName || props.toolLabel
}))

/**
 * 文件夹列表返回时间轴主视图
 * @returns {void}
 */
const handleFolderPreviewBack = () => {
  clearFolderPreviewMode()
}

/**
 * 侧栏树节点点击（文件夹列表 / 文件高亮 / Alt 预览）
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} [event] 点击事件
 * @returns {Promise<void>}
 */
const handleSidebarTreeNodeClick = async (treeNode, event) => {
  if (!treeNode) return
  if (treeNode.nodeType === 'folder') {
    await handleFolderTreeNodeClick(treeNode)
    return
  }
  if (treeNode.nodeType !== 'file') return
  clearFolderPreviewMode()
  const sourceFile = treeNode.sourceFile
  if (!sourceFile) return
  if (event && event.altKey) {
    await openFilePreview(sourceFile)
    return
  }
  await handleSidebarFileClick(sourceFile)
}

/**
 * 解析侧栏文件 ID（兼容任务预览 file_uuid）
 * @param {Object} sourceFile 源文件
 * @returns {string} 文件 ID
 */
const resolveSidebarFileId = (sourceFile) => {
  if (!sourceFile) return ''
  return String(
    getFileIdentifier(sourceFile)
    || sourceFile.file_uuid
    || sourceFile.result_uuid
    || sourceFile.file_id
    || ''
  )
}

/**
 * 侧栏文件点击：高亮时间轴并滚动
 * @param {Object} sourceFile 源文件
 * @returns {Promise<void>}
 */
const handleSidebarFileClick = async (sourceFile) => {
  const fileId = resolveSidebarFileId(sourceFile)
  if (!fileId) return
  activeFileId.value = String(fileId)
  scrollTimelineToFile(String(fileId))
}

/**
 * 滚动时间轴到指定文件的首个事件
 * @param {string} fileId 文件 ID
 * @returns {void}
 */
const scrollTimelineToFile = (fileId) => {
  const firstEvent = timelineData.value.find((event) => String(event.fileId) === String(fileId))
  if (!firstEvent) return
  nextTick(() => {
    const eventsInDate = timelineData.value.filter((event) => event.date === firstEvent.date)
    const isFirstInDate = eventsInDate[0]?.id === firstEvent.id
    const targetId = isFirstInDate ? `date-group-${firstEvent.date}` : `event-${firstEvent.id}`
    const element = document.getElementById(targetId)
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const createTaskDialogVisible = ref(false)
const defaultTaskName = ref('')

const progressDialogVisible = ref(false)
const selfManagedTaskUuid = ref('')

/** 文件管理新建任务时由父级统一进度，不自管弹窗 */
const showSelfProgressDialog = computed(() => {
  if (props.eventKey === 'file-manager-progress-start' && !isTaskDetailMode.value) {
    return false
  }
  return true
})

const SELF_POLL_INTERVAL = 2000
const MAX_SELF_POLL_MS = 10 * 60 * 1000
let selfPollTimer = null
let selfPollStart = 0

/**
 * 停止后台轮询
 * @returns {void}
 */
const stopSelfPolling = () => {
  if (selfPollTimer) {
    clearInterval(selfPollTimer)
    selfPollTimer = null
  }
}

/**
 * 单次轮询任务状态
 * @param {string} taskUuid 任务 UUID
 * @returns {Promise<void>}
 */
const selfPollOnce = async (taskUuid) => {
  if (Date.now() - selfPollStart > MAX_SELF_POLL_MS) {
    stopSelfPolling()
    isAnalyzing.value = false
    ElMessage.error('分析超时，请稍后在任务中心查看结果')
    return
  }
  try {
    const res = await getTaskSchedulesAPI(taskUuid, { prefer_runtime: true })
    if (res.code !== 200 || !res.data) return
    const status = Number(res.data.task_status)
    if (status === 2) {
      stopSelfPolling()
      progressDialogVisible.value = false
      await loadAnalysisResult(taskUuid)
      isAnalyzing.value = false
      ElMessage.success('分析完成')
    } else if (status === 3) {
      stopSelfPolling()
      progressDialogVisible.value = false
      isAnalyzing.value = false
      ElMessage.error('分析失败，请稍后重试')
    }
  } catch (error) {
    console.error('[时间轴分析] 后台轮询失败:', error)
  }
}

/**
 * 启动后台轮询
 * @param {string} taskUuid 任务 UUID
 * @returns {void}
 */
const startSelfPolling = (taskUuid) => {
  stopSelfPolling()
  selfPollStart = Date.now()
  selfPollOnce(taskUuid)
  selfPollTimer = setInterval(() => selfPollOnce(taskUuid), SELF_POLL_INTERVAL)
}

const promptId = ref(null)
const promptText = ref('')
const historyPrompt = ref('')
const historyPromptId = ref(null)

const filePreviewVisible = ref(false)
const filePreviewLoading = ref(false)
const filePreviewTitle = ref('文件预览')
const filePreviewFile = ref(null)

/**
 * 根据文件名推断预览类型
 * @param {string} fileName 文件名
 * @returns {string} 预览类型
 */
const inferPreviewFileType = (fileName) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
  return 'pdf'
}

/**
 * 打开文件预览弹窗
 * @param {Object} sourceFile 源文件对象
 * @returns {Promise<void>}
 */
const openFilePreview = async (sourceFile) => {
  const fileId = getFileIdentifier(sourceFile)
  if (!fileId) {
    ElMessage.warning('文件暂无预览')
    return
  }
  const fileName = sourceFile.name || sourceFile.file_name || '文件预览'
  filePreviewTitle.value = fileName
  filePreviewLoading.value = true
  filePreviewVisible.value = true
  filePreviewFile.value = null
  try {
    const res = await previewFileAPI(fileId)
    const previewUrl = res?.data?.preview_url || ''
    filePreviewFile.value = {
      id: fileId,
      fileId,
      file_id: fileId,
      name: fileName,
      file_name: fileName,
      type: inferPreviewFileType(fileName),
      previewUrl
    }
  } catch (error) {
    console.error('[时间轴分析] 预览失败:', error)
    ElMessage.error('预览文件失败')
    filePreviewVisible.value = false
  } finally {
    filePreviewLoading.value = false
  }
}

/**
 * 生成默认任务名
 * @returns {string} 任务名称
 */
const generateDefaultTaskName = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `时间轴分析【${year}-${month}-${day} ${hours}:${minutes}:${seconds}】`
}

/**
 * 点击执行：校验左侧树有文件/文件夹后打开创建任务弹窗
 * @returns {void}
 */
const handleExecuteClick = () => {
  if (!canAnalyze.value) {
    ElMessage.warning('请先选择可执行的文件或文件夹')
    return
  }
  defaultTaskName.value = generateDefaultTaskName()
  createTaskDialogVisible.value = true
}

/**
 * 时间轴条目点击：联动左侧高亮
 * @param {string} fileId 文件 ID
 * @returns {void}
 */
const handleTimelineClick = (fileId) => {
  activeFileId.value = fileId
}

/**
 * 任务创建完成
 * @param {string} taskUuid 任务 UUID
 * @param {string} taskName 任务名称
 * @returns {void}
 */
const handleTaskCreated = (taskUuid, taskName) => {
  timelineData.value = []
  isAnalyzing.value = true
  if (props.eventKey) {
    eventBus.emit(props.eventKey, { taskUuid, taskName: taskName || '时间轴分析' })
    return
  }
  selfManagedTaskUuid.value = taskUuid
  progressDialogVisible.value = true
  startSelfPolling(taskUuid)
}

/**
 * 进度弹窗完成
 * @param {string} taskUuid 任务 UUID
 * @returns {Promise<void>}
 */
const handleProgressCompleted = async (taskUuid) => {
  progressDialogVisible.value = false
  stopSelfPolling()
  if (taskUuid) {
    initialLoading.value = true
    try {
      await loadAnalysisResult(taskUuid)
    } finally {
      initialLoading.value = false
    }
  }
  isAnalyzing.value = false
  ElMessage.success('分析完成')
}

/**
 * 进度弹窗失败
 * @returns {void}
 */
const handleProgressFailed = () => {
  progressDialogVisible.value = false
  stopSelfPolling()
  isAnalyzing.value = false
}

/**
 * 进度弹窗关闭（任务仍可能在跑）
 * @returns {void}
 */
const handleProgressClosed = () => {
  if (selfManagedTaskUuid.value && isAnalyzing.value) {
    startSelfPolling(selfManagedTaskUuid.value)
  }
}

/**
 * 分析进度弹窗：返回任务中心列表
 * @returns {void}
 */
const handleProgressReturnToTaskCenter = () => {
  progressDialogVisible.value = false
  if (selfManagedTaskUuid.value && isAnalyzing.value) {
    startSelfPolling(selfManagedTaskUuid.value)
  }
  if (props.isSecondaryExecution) {
    emit('close-dialog')
    return
  }
  openTaskCenterWithRefresh(router, homeStore)
  ElMessage.info('任务在后台执行，可在任务中心查看进度')
}

/**
 * 父容器任务完成回调
 * @param {Array} resultList 任务结果列表
 * @returns {Promise<void>}
 */
const setResult = async (resultList) => {
  isAnalyzing.value = false
  const taskUuid = resultList?.[0]?.task_uuid
  if (taskUuid) {
    await loadAnalysisResult(taskUuid)
  }
  ElMessage.success('分析完成')
}

/**
 * 父容器任务失败回调
 * @returns {void}
 */
const taskError = () => {
  isAnalyzing.value = false
}

defineExpose({ setResult, taskError })

/**
 * 开始拖拽左侧分隔条以调整左侧面板宽度
 * @param {MouseEvent} e 鼠标按下事件
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
 * 拖拽过程中更新左侧面板宽度
 * @param {MouseEvent} e 鼠标移动事件
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
 */
const stopLeftSidebarResize = () => {
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')
  localStorage.setItem('ocr-viewer-left-sidebar-width', String(leftSidebarWidth.value))
}

onBeforeUnmount(() => {
  stopSelfPolling()
  if (isResizingLeft.value) {
    stopLeftSidebarResize()
  }
})

/**
 * 时间轴数据加载完成后，任务中心详情默认全部展开
 * @returns {Promise<void>}
 */
const expandTimelineAfterLoad = async () => {
  if (!isTaskDetailMode.value) return
  await nextTick()
  timelineDisplayRef.value?.expandAll?.()
}

/**
 * 加载分析结果（仅更新中间时间轴与提示词，不重置左侧文件夹树）
 * @param {string} analysisId 分析/任务 UUID
 * @returns {Promise<void>}
 */
const loadAnalysisResult = async (analysisId) => {
  if (!analysisId) return
  try {
    const res = await getTimelineAnalysisResultAPI(analysisId)
    const data = res.data
    if (data && data.events) {
      timelineData.value = data.events
      await expandTimelineAfterLoad()
    }
    if (data && data.prompt) {
      historyPrompt.value = data.prompt
    }
    if (data && data.prompt_id) {
      historyPromptId.value = data.prompt_id
    }
  } catch (error) {
    console.error('[时间轴分析] 加载结果失败:', error)
    ElMessage.error('加载分析结果失败')
  }
}

/**
 * 任务中心详情初始化：加载侧栏 + 结果或进度
 * @returns {Promise<void>}
 */
const initTaskDetailMode = async () => {
  const taskUuid = resolvedTaskId.value
  if (!taskUuid) return

  initialLoading.value = true
  try {
    await loadTaskCenterPreviewSidebar()

    const status = props.taskStatus != null && props.taskStatus !== ''
      ? Number(props.taskStatus)
      : null

    if (status === 3) {
      isAnalyzing.value = false
      await loadAnalysisResult(taskUuid)
      return
    }

    if (status === 0 || status === 1) {
      isAnalyzing.value = true
      selfManagedTaskUuid.value = taskUuid
      progressDialogVisible.value = true
      startSelfPolling(taskUuid)
      return
    }

    await loadAnalysisResult(taskUuid)
  } finally {
    initialLoading.value = false
  }
}

/**
 * 从文件管理器预填文件到左侧树
 * @returns {Promise<void>}
 */
const handleFileManagerFiles = async () => {
  const filesParam = props.files
  const namesParam = props.names
  if (!filesParam || !namesParam) return

  const sep = filesParam.includes('||') ? '||' : ','
  const fileIds = filesParam.split(sep).filter(Boolean)
  const fileNames = namesParam.split(sep).filter(Boolean)
  if (fileIds.length === 0 || fileIds.length !== fileNames.length) return

  const rows = fileIds.map((id, index) => ({
    file_id: id,
    file_name: fileNames[index]
  }))
  await addFilesFromManager(rows, { silent: props.isSecondaryExecution })
}

onMounted(async () => {
  if (isTaskDetailMode.value) {
    await initTaskDetailMode()
    return
  }

  const routeAnalysisId = route.query.analysisId
  if (routeAnalysisId && !props.analysisId) {
    await loadAnalysisResult(routeAnalysisId)
  }

  if (props.files) {
    await handleFileManagerFiles()
  }
})

watch(
  () => props.files,
  async (newFiles) => {
    if (newFiles && props.names && !isTaskDetailMode.value) {
      await handleFileManagerFiles()
    }
  }
)

watch(
  () => [props.analysisId, props.taskId],
  async ([newAnalysisId, newTaskId]) => {
    if (!isTaskDetailMode.value) return
    const id = newTaskId || newAnalysisId
    if (id) {
      await initTaskDetailMode()
    }
  }
)
</script>

<style scoped lang="scss">
.tla-container {
  display: flex;
  align-items: stretch;
  height: calc(100vh - 75px);
  min-height: 0;
  background: var(--sd-surface-1, #f4f4f4);
  overflow: hidden;
  font-size: 13px;
  color: #1e293b;
  box-sizing: border-box;
}

.tla-container--embedded {
  height: 100%;
  min-height: 0;
  position: relative;
}

.tla-container :deep(.ocr-sidebar-footer) {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
}

.tla-container :deep(.file-actions-row) {
  display: flex;
  align-items: center;
  width: 100%;
}

.tla-container :deep(.file-actions-row > * + *) {
  margin-left: 8px;
}

.tla-container :deep(.file-actions-row .ocr-footer-btn),
.tla-container :deep(.file-actions-row .el-button) {
  flex: 1;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  box-sizing: border-box;
}

.tla-container :deep(.ocr-select-files-btn) {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--sd-primary, #195fb4);
  border: 1px solid var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
}

.tla-container :deep(.ocr-select-files-btn:hover),
.tla-container :deep(.ocr-select-files-btn:focus) {
  color: var(--sd-primary-dark, #0f4a8c);
  border-color: var(--sd-primary-dark, #0f4a8c);
  background: var(--sd-primary-light, #e8f0f8);
}

.left-sidebar-group {
  display: flex;
  flex-shrink: 0;
  align-self: stretch;
  min-height: 0;
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
}

.tla-main-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
  border-right: 1px solid var(--sd-hairline, #e0e0e0);
}

.tla-main-panel > * {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.tla-prompt-shell {
  width: 280px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
}

.tla-prompt-shell > * {
  flex: 1;
  min-height: 0;
  width: 100%;
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

.resizer-left:hover {
  background: var(--sd-primary, #195fb4);
}

.resize-icon {
  font-size: 12px;
  color: #909399;
  pointer-events: none;
}

.resizer-left:hover .resize-icon {
  color: var(--sd-primary, #195fb4);
}

:global(body.resizing) {
  user-select: none;
  cursor: col-resize;
}

:global(body.resizing) .resizer-left {
  background-color: var(--sd-primary, #195fb4);
  opacity: 1;
}

.tla-file-preview-body {
  min-height: 60vh;
}
</style>
