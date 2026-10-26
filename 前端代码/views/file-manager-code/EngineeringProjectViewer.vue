<template>
  <div
    class="ocr-viewer"
    :class="{ 'ocr-viewer--embedded': isSecondaryExecution }"
    v-loading="resultViewLoading"
    element-loading-text="加载任务结果..."
  >
    <!-- 左侧：与文本信息提取一致的公共侧边栏 -->
    <div
      class="left-sidebar-shell resizable-left-sidebar"
      :style="{ width: leftSidebarWidth + 'px' }"
    >
      <OcrLeftSidebar
        :bindings="leftSidebarBindings"
        layout-mode="tree-select"
        :mode="leftSidebarMode"
        :task-id="leftSidebarTaskId"
        :allow-mode-switch="!isResultViewMode"
        :readonly="isResultViewMode"
        :hide-batch-execute="isResultViewMode"
        :show-preview-toggle="isResultViewMode"
        compact-file-header
        empty-description="暂无文件，请点击「选择文件」添加"
        @mode-change="handleLeftSidebarModeChange"
      />
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

      <!-- 中间文档查看器（与 OcrViewer 一致：文件夹列表 / 单文件预览） -->
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

      <!-- 可调整宽度的分隔线（两个标签页都显示） -->
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

      <!-- 右侧面板 -->
      <div class="right-viewer"
        :class="{ 'right-viewer-fullwidth': !showFilePreview }"
        :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
      >
        <!-- 顶栏：Tab + 导出 -->
        <div class="right-viewer-head ocr-column-head">
          <div class="sidebar-tabs">
            <el-tabs v-model="viewerTab" @tab-change="handleTabChange">
              <el-tab-pane label="解析结果" name="parse" />
              <el-tab-pane label="功能配置" name="extract" />
            </el-tabs>
          </div>
          <div
            v-if="viewerTab === 'parse' && (hasEngineeringResults || hasEngineeringErrors) && !awaitingTaskResults"
            class="right-viewer-head__actions"
          >
            <el-dropdown trigger="hover" @command="handleExportResults">
              <el-button type="primary" plain size="small">
                导出 Excel
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="excel">导出当前文件</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <!-- 解析结果：显示提取结果和定位 -->
        <div
          class="right-sidebar"
          v-show="viewerTab === 'parse'"
        >
          <!-- 合同完备性分析 -->
          <div class="extraction-results">
            <el-alert
              v-if="taskResultLoadError"
              type="error"
              :title="taskResultLoadError"
              show-icon
              :closable="false"
              class="engineering-alert"
            />
            <el-empty
              v-else-if="isResultViewMode && awaitingTaskResults"
              description="任务执行中，请稍候或由外层查看进度..."
              :image-size="80"
            />
            <template v-else-if="hasEngineeringResults || hasEngineeringErrors">
              <div class="engineering-result-panel">
                <div class="engineering-result-subhead">
                  <el-radio-group
                    v-model="engineeringResultTab"
                    size="small"
                    class="engineering-result-segment"
                  >
                    <el-radio-button value="duplicate">重复项目</el-radio-button>
                    <el-radio-button value="parentChild">主子项目</el-radio-button>
                  </el-radio-group>
                </div>

                <div v-show="engineeringResultTab === 'duplicate'" class="result-card-body">
                  <el-alert
                    v-if="engineeringResult.resultMeta.duplicateError"
                    type="error"
                    :title="engineeringResult.resultMeta.duplicateError"
                    show-icon
                    :closable="false"
                    class="engineering-alert"
                  />
                  <DuplicateResultTable
                    v-if="engineeringResult.duplicateTableRows.length"
                    hide-section-title
                    :rows="engineeringResult.duplicateTableRows"
                    :field-weights="engineeringResult.resultMeta.duplicateFieldWeights"
                    :field-labels="engineeringResult.resultMeta.duplicateFieldLabels"
                    :role-fields="engineeringResult.resultMeta.duplicateRoleFields"
                    :source-columns="engineeringResult.resultMeta.sourceColumns"
                    :threshold="engineeringResult.resultMeta.duplicateThreshold"
                  />
                  <el-empty
                    v-else-if="!engineeringResult.resultMeta.duplicateError"
                    description="未发现重复项目"
                    :image-size="60"
                  />
                </div>

                <div v-show="engineeringResultTab === 'parentChild'" class="result-card-body">
                  <el-alert
                    v-if="engineeringResult.resultMeta.parentChildError"
                    type="error"
                    :title="engineeringResult.resultMeta.parentChildError"
                    show-icon
                    :closable="false"
                    class="engineering-alert"
                  />
                  <ParentChildResultTable
                    v-if="hasParentChildResults"
                    hide-section-title
                    :sections="engineeringResult.parentChildSections"
                    :field-weights="engineeringResult.resultMeta.parentChildFieldWeights"
                    :field-labels="engineeringResult.resultMeta.parentChildFieldLabels"
                    :role-fields="engineeringResult.resultMeta.parentChildRoleFields"
                    :source-columns="engineeringResult.resultMeta.sourceColumns"
                  />
                  <el-empty
                    v-else-if="!engineeringResult.resultMeta.parentChildError"
                    description="未发现主子项目关系"
                    :image-size="60"
                  />
                </div>
              </div>
            </template>
            <el-empty
              v-else-if="isResultViewMode"
              description="暂无解析结果"
              :image-size="80"
            />
            <el-empty
              v-else
              description="请先配置提示词并批量执行，执行完成后可在任务中心查看结果"
              :image-size="80"
            />
          </div>
        </div>
        <!-- 功能配置：显示字段模式配置 -->
        <div
          class="right-sidebar right-sidebar--extract"
          v-show="viewerTab === 'extract'"
        >
          <div class="config-panel-wrap">
            <el-empty
              v-if="isResultViewMode && !hasEngineeringConfigSnapshot"
              description="暂无配置快照"
              :image-size="80"
            />
            <ConfigPanel
              v-else
              ref="configPanelRef"
              v-model:prompt="fileConfig.config"
              :no-execute="true"
              :is-secondary-execution="isResultViewMode"
              :config-ready="isEngineeringConfigReady()"
            />
          </div>
        </div>
      </div>
    </div>
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount, onUnmounted, reactive, computed, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { List, DArrowRight, DArrowLeft, ArrowDown } from '@element-plus/icons-vue'
  import { useHomeStore } from '@/stores/home'
  import { previewFileAPI, getFileListAPI } from '@/api/fileManager.js'
  import { batchExecuteByFilterAPI, getTaskSchedulesAPI, exportEngineeringProjectResultsZipAPI } from '@/api/task.js'
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
  import { useSimpleOcrLeftSidebar } from './composables/useSimpleOcrLeftSidebar.js'
  import {
    openTaskCenterWithRefresh,
    runBatchExecuteWithTimeoutNav
  } from './composables/batchExecuteTimeoutNav.js'
  import OcrLeftSidebar from './components/OcrLeftSidebar.vue'
  import OcrFolderPreviewPanel from './components/OcrFolderPreviewPanel.vue'
  import PreviewFile from './components/PreviewFile.vue'
  import ConfigPanel from './components/engineeringProject/ConfigPanel.vue'
  import DuplicateResultTable from './components/engineeringProject/DuplicateResultTable.vue'
  import ParentChildResultTable from './components/engineeringProject/ParentChildResultTable.vue'
  import { mapEngineeringDisposalResult } from '@/utils/engineeringProjectResultMapper.js'
  import { exportEngineeringResultsXlsx } from '@/utils/engineeringProjectExport.js'
  import { resolveScheduleTaskFailureMessage } from '@/composables/useScheduleTaskProgress.js'
  import {
    createEmptyDuplicateDetectionConfig,
    createEmptyParentChildAnalysisConfig,
    mergeFieldRulesWithWeights
  } from './components/engineeringProject/engineeringProjectConstants.js'
  import {
    prepareSingleTableConfig,
    configToDict,
    ensureSingleTableShape,
    migrateLegacyEngineeringConfig
  } from './components/engineeringProject/engineeringSingleTableConfigHelpers.js'
  import {
    applyTaskSelectionToSidebar,
    buildFolderNameMapFromSourceRefs,
    buildSourceRefsFromResultList,
    enrichFileRowWithSourceRefs
  } from '@/views/ocr-task-center/taskCenterSelectionTreeUtils.js'

  /**
   * 父组件传入参数（文件管理入口）
   */
  const props = defineProps({
    tool: {
      type: String,
      default: ''
    },
    files: {
      type: String,
      default: ''
    },
    names: {
      type: String,
      default: ''
    },
    folder_id: {
      type: String,
      default: ''
    },
    toolLabel: {
      type: String,
      default: '工程项目数据一致性分析'
    },
    eventKey: {
      type: String,
      default: 'file-manager-progress-start'
    },
    /** 任务中心详情：任务 UUID */
    taskId: {
      type: [String, Number],
      default: ''
    },
    fileId: {
      type: [String, Number],
      default: ''
    },
    isSecondaryExecution: {
      type: Boolean,
      default: false
    }
  })

  const emit = defineEmits(['close-dialog'])

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

  defineOptions({
    name: 'EngineeringProjectViewer',
  })

  const router = useRouter()
  const homeStore = useHomeStore()

  const resolvedTaskId = computed(() => {
    const fromProp = props.taskId != null && String(props.taskId).trim()
    if (fromProp) return String(props.taskId).trim()
    return ''
  })

  const isResultViewMode = computed(() => !!resolvedTaskId.value)

  const resultViewLoading = ref(false)
  const taskResultLoadError = ref('')
  const awaitingTaskResults = ref(false)

  const fileList = ref([])
  const currentFile = ref(null)

  /** 左侧面板宽度约束（与 OcrViewer 一致） */
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
  /** 左侧公共组件模式：edit=编辑 preview=预览 */
  const leftSidebarMode = ref('edit')
  const leftSidebarTaskId = ref('')
  /** 任务中心回看：左下角任务名称 */
  const previewTaskName = ref('-')

  // 识别配置映射表
  const fileConfig = reactive({
    config: {
      engineering_repeat_project: {
        key: '',
        prompt: ''
      },
      engineering_sub_project: {
        key: '',
        prompt: ''
      },
      duplicate_detection: createEmptyDuplicateDetectionConfig(),
      parent_child_analysis: createEmptyParentChildAnalysisConfig()
    }
  })

  const createEmptyParentChildSections = () => ({
    model: { key: 'model', title: '通过模型匹配（含得分及原因）', rows: [] },
    code: {
      key: 'code',
      title: '通过24位编码匹配（不含得分及原因）',
      rows: [],
      footnote: '说明：通过24位编码匹配的完全一致项目，不经过模型评分，加权和固定设置为5'
    }
  })

  const engineeringResult = reactive({
    duplicateTableRows: [],
    parentChildSections: createEmptyParentChildSections(),
    resultMeta: {
      duplicateError: '',
      parentChildError: '',
      duplicateFieldWeights: null,
      duplicateFieldLabels: null,
      duplicateRoleFields: null,
      duplicateThreshold: null,
      parentChildFieldWeights: null,
      parentChildFieldLabels: null,
      parentChildRoleFields: null,
      parentChildThreshold: null,
      sourceColumns: [],
      hasDuplicateBlock: false,
      hasParentChildBlock: false
    }
  })

  const cachedScheduleResultList = ref([])

  const hasEngineeringResults = computed(() => {
    const meta = engineeringResult.resultMeta || {}
    return (
      engineeringResult.duplicateTableRows.length > 0 ||
      engineeringResult.parentChildSections.model.rows.length > 0 ||
      engineeringResult.parentChildSections.code.rows.length > 0 ||
      meta.hasDuplicateBlock ||
      meta.hasParentChildBlock
    )
  })

  const hasEngineeringErrors = computed(() => {
    const meta = engineeringResult.resultMeta || {}
    return !!(meta.duplicateError || meta.parentChildError)
  })

  const hasParentChildResults = computed(() => {
    return (
      engineeringResult.parentChildSections.model.rows.length > 0 ||
      engineeringResult.parentChildSections.code.rows.length > 0
    )
  })

  /** 解析结果子 Tab：duplicate=重复项目 parentChild=主子项目 */
  const engineeringResultTab = ref('duplicate')

  const bulkExportLoading = ref(false)

  /**
   * 补齐工程项目配置结构（兼容旧数据或局部 v-model 覆盖）
   * @returns {void}
   */
  const ensureEngineeringConfigShape = () => {
    const cfg = fileConfig.config
    if (!cfg.duplicate_detection) {
      cfg.duplicate_detection = createEmptyDuplicateDetectionConfig()
    }
    if (!cfg.parent_child_analysis) {
      cfg.parent_child_analysis = createEmptyParentChildAnalysisConfig()
    }
  }
  ensureEngineeringConfigShape()

  /**
   * 是否已配置工程项目提示词（无副作用，供左侧 canBatchExecute 使用）
   * @returns {boolean} 是否就绪
   */
  const isEngineeringConfigReady = () => {
    const cfg = fileConfig.config || {}
    return !!(cfg.engineering_repeat_project?.key && cfg.engineering_sub_project?.key)
  }

  /**
   * 校验工程项目提示词配置
   * @returns {boolean} 是否通过
   */
  const validateEngineeringConfig = () => {
    const cfg = fileConfig.config || {}
    if (!cfg.engineering_repeat_project?.key) {
      viewerTab.value = 'extract'
      ElMessage.warning('请在右侧功能配置中选择重复项目提示词')
      return false
    }
    if (!cfg.engineering_sub_project?.key) {
      viewerTab.value = 'extract'
      ElMessage.warning('请在右侧功能配置中选择主子项目提示词')
      return false
    }
    if (configPanelRef.value && typeof configPanelRef.value.validateRules === 'function') {
      if (!configPanelRef.value.validateRules()) {
        viewerTab.value = 'extract'
        return false
      }
    }
    return true
  }

  /**
   * 构建批量弹窗展示用全局 settings 快照
   * @returns {Object|null} settings
   */
  const buildEngineeringGlobalBatchSettings = () => {
    if (!isEngineeringConfigReady()) {
      return null
    }
    const repeat = fileConfig.config.engineering_repeat_project || {}
    const sub = fileConfig.config.engineering_sub_project || {}
    const repeatName =
      (configPanelRef.value && typeof configPanelRef.value.getPromptNameByKey === 'function'
        ? configPanelRef.value.getPromptNameByKey(repeat.key)
        : '') || '重复项目'
    const subName =
      (configPanelRef.value && typeof configPanelRef.value.getPromptNameByKey === 'function'
        ? configPanelRef.value.getPromptNameByKey(sub.key)
        : '') || '主子项目'
    return {
      configured: true,
      mode: 'engineering',
      summaryText: `重复项目：${repeatName}；主子项目：${subName}`,
      engineering_repeat_project: { ...repeat },
      engineering_sub_project: { ...sub }
    }
  }

  /**
   * 打开批量执行弹窗前校验全局配置
   * @returns {Promise<boolean>} 是否允许打开
   */
  const onBeforeOpenBatchDialog = async () => {
    void (await Promise.resolve())
    return validateEngineeringConfig()
  }

  /**
   * 构建批量执行 exec_config
   * @returns {Object} 执行配置
   */
  const buildEngineeringExecConfig = () => {
    ensureEngineeringConfigShape()
    const cfg = fileConfig.config
    const duplicateDetection = configToDict(
      prepareSingleTableConfig(cfg.duplicate_detection || {}, { mode: 'duplicate' })
    )
    const parentChildAnalysis = configToDict(
      prepareSingleTableConfig(cfg.parent_child_analysis || {}, { mode: 'parent_child' })
    )
    const repeatPrompt =
      duplicateDetection.llm_config?.additional_prompt ||
      duplicateDetection.prompt ||
      cfg.engineering_repeat_project?.prompt ||
      ''
    const subPrompt =
      parentChildAnalysis.llm_config?.additional_prompt ||
      parentChildAnalysis.prompt ||
      cfg.engineering_sub_project?.prompt ||
      ''
    if (repeatPrompt) {
      duplicateDetection.prompt = repeatPrompt
      duplicateDetection.llm_config = {
        ...(duplicateDetection.llm_config || {}),
        additional_prompt: repeatPrompt
      }
    }
    if (subPrompt) {
      parentChildAnalysis.prompt = subPrompt
      parentChildAnalysis.llm_config = {
        ...(parentChildAnalysis.llm_config || {}),
        additional_prompt: subPrompt
      }
    }
    return {
      exec_mode: 'custom',
      custom_config: {
        mode: 'engineering_project',
        engineering_repeat_project: {
          ...(cfg.engineering_repeat_project || {}),
          prompt: repeatPrompt
        },
        engineering_sub_project: {
          ...(cfg.engineering_sub_project || {}),
          prompt: subPrompt
        },
        threshold: duplicateDetection.threshold ?? duplicateDetection.llm_config?.threshold,
        duplicate_threshold: duplicateDetection.threshold ?? duplicateDetection.llm_config?.threshold,
        parent_child_threshold: parentChildAnalysis.threshold ?? parentChildAnalysis.llm_config?.threshold,
        duplicate_detection: duplicateDetection,
        parent_child_analysis: parentChildAnalysis
      }
    }
  }

  // ConfigPanel 组件引用
  const configPanelRef = ref(null)

  // PreviewFile 组件引用
  const previewFileRef = ref(null)

  // 中间查看器
  const viewerTab = ref(resolvedTaskId.value ? 'parse' : 'extract') // 'parse' | 'extract'

  // 识别相关
  const currentHighlightedField = ref(null)

  // 右侧面板宽度调整
  // 从本地存储读取保存的宽度，如果没有则使用默认值
  const savedWidth = localStorage.getItem('ocr-viewer-sidebar-width')
  const rightSidebarWidth = ref(savedWidth ? parseInt(savedWidth, 10) : 320) // 右侧面板宽度
  const isResizing = ref(false) // 是否正在调整大小
  const startX = ref(0) // 拖拽开始的X坐标
  const startWidth = ref(0) // 拖拽开始时的宽度

  // 开始调整宽度
  const startResize = (e) => {
    isResizing.value = true
    startX.value = e.clientX
    startWidth.value = rightSidebarWidth.value

    // 添加事件监听
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)

    // 添加禁止选择类
    document.body.classList.add('resizing')
  }

  // 调整宽度过程
  const handleResize = (e) => {
    if (!isResizing.value) return

    const diff = startX.value - e.clientX // 注意：向左拖拽是增加宽度，所以是减法
    const newWidth = startWidth.value + diff

    // 限制最小和最大宽度（最小300px，最大800px）
    if (newWidth >= 300 && newWidth <= 800) {
      rightSidebarWidth.value = newWidth
    }
  }

  // 结束调整宽度
  const stopResize = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.classList.remove('resizing')
  }

  const extractionResults = ref([])

  /** 前端待删除记录（提交批量任务时带给后端） */
  const pendingDeleteRecords = ref({
    files: [],
    folders: []
  })

  const pendingDeleteFileIds = computed(() =>
    (pendingDeleteRecords.value.files || []).map((item) => String(item.fileId))
  )

  /** 当前预览文件 key，用于强制 PreviewFile 重新挂载 */
  const currentPreviewFileKey = ref('')

  /** 文件夹预览：当前路径与名称 */
  const currentFolderPreviewPath = ref('')
  const currentFolderPreviewName = ref('')
  const currentFolderPreviewRemoteFiles = ref([])
  const isCurrentFolderPreviewRemote = ref(false)
  const folderPreviewLoading = ref(false)
  const folderPreviewPage = ref(1)
  const folderPreviewPageSize = ref(100)
  const folderPreviewTotal = ref(0)
  const currentFolderPreviewFolderId = ref('')

  const isFolderListPreviewMode = computed(() => !!currentFolderPreviewPath.value)

  const currentFolderPreviewFiles = computed(() => {
    if (!currentFolderPreviewPath.value) {
      return []
    }
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
    if (isCurrentFolderPreviewRemote.value) {
      return folderPreviewTotal.value
    }
    return currentFolderPreviewFiles.value.length
  })

  /**
   * 根据扩展名推断工程侧文件类型
   * @param {string} fileName 文件名
   * @returns {string} 类型
   */
  const getFileTypeFromExtension = (fileName) => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    if (ext === 'docx') return 'docx'
    if (ext === 'doc') return 'doc'
    if (ext === 'xlsx' || ext === 'xlsm') return ext === 'xlsm' ? 'xlsm' : 'xlsx'
    if (ext === 'xls') return 'xls'
    if (ext === 'csv') return 'csv'
    if (ext === 'txt') return 'txt'
    return ''
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
   * 按文件夹 ID 拉取文件列表（中间区域展示，与 OcrViewer 一致）
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
          {
            folder_id: folderId,
            page,
            page_size: folderPreviewPageSize.value
          },
          { allowUnparsed: sidebarCore.allowUnparsed.value }
        )
      )
      if (res?.code === 200 && res?.data?.files) {
        const rows = (res.data.files || []).filter((raw) => {
          const name = raw.file_name || raw.original_name || ''
          const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
          return ['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)
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
   * 从树节点解析可预览的源文件对象
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
   * 记录待删除文件（仅前端）
   * @param {Array} files 文件行
   * @returns {void}
   */
  const recordPendingFileDeletes = (files) => {
    const existingKeys = new Set(
      (pendingDeleteRecords.value.files || []).map((item) => `${item.fileId}|${item.folderPath}`)
    )
    ;(files || []).forEach((file) => {
      const fileId = String(getFileIdentifier(file) || '')
      if (!fileId) return
      const folderPath = getFileFolderPath(file) || currentFolderPreviewPath.value || '根目录'
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
   * 删除后清理选中与预览状态
   * @param {Set<string>} deletedFileIds 已删文件 id
   * @returns {void}
   */
  const cleanupAfterFileDelete = (deletedFileIds) => {
    if (sidebarCore.leftSidebarBindings.selectedFiles) {
      const sel = sidebarCore.leftSidebarBindings.selectedFiles
      if (sel && sel.value) {
        sel.value = sel.value.filter((id) => !deletedFileIds.has(String(id)))
      }
    }
    if (currentFile.value && deletedFileIds.has(String(getFileIdentifier(currentFile.value)))) {
      currentFile.value = null
      currentPreviewFileKey.value = ''
    }
  }

  /**
   * 判断文件是否已标记待删除
   * @param {string} fileId 文件 id
   * @returns {boolean} 是否待删除
   */
  const isFilePendingDeleteById = (fileId) => {
    const target = String(fileId || '').trim()
    if (!target) return false
    return (pendingDeleteRecords.value.files || []).some(
      (item) => String(item.fileId) === target
    )
  }

  /**
   * 文件夹预览区删除勾选文件（仅前端）
   * @param {Array<string>} selectedFileIds 勾选 id 列表
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
    if (!targetId || !isFilePendingDeleteById(targetId)) {
      return
    }
    pendingDeleteRecords.value.files = (pendingDeleteRecords.value.files || []).filter(
      (item) => String(item.fileId) !== targetId
    )
    ElMessage.success('文件已恢复（仅前端）')
  }

  /**
   * 选择文件并加载预览
   * @param {Object} file 文件对象
   * @returns {Promise<void>}
   */
  const selectFile = async (file) => {
    if (!file) return

    clearFolderPreviewMode()

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

    const shouldLoadPreview = showFilePreview.value
    if (shouldLoadPreview && previewId && !normalized.previewUrl) {
      try {
        const previewRes = await previewFileAPI(previewId)
        if (previewRes.code === 200 && previewRes.data?.preview_url) {
          normalized.previewUrl = previewRes.data.preview_url
          const fileIndex = (fileList.value || []).findIndex(
            (f) => String(getFileIdentifier(f)) === previewId
          )
          if (fileIndex !== -1) {
            fileList.value[fileIndex].previewUrl = previewRes.data.preview_url
          }
        }
      } catch (e) {
        console.warn('获取预览URL失败:', e)
      }
    }

    currentPreviewFileKey.value = shouldLoadPreview ? previewId || fileName : ''
    currentFile.value = normalized
    extractionResults.value = []
    currentHighlightedField.value = null
    if (cachedScheduleResultList.value.length && isResultViewMode.value) {
      syncResultViewForCurrentFile()
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
    let sourceFile = rowData.sourceFile || null
    if (!sourceFile) {
      sourceFile = (fileList.value || []).find(
        (f) => String(getFileIdentifier(f)) === targetId
      ) || null
    }
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

  const sidebarCore = useSimpleOcrLeftSidebar({
    files: fileList,
    toolLabel: props.toolLabel,
    canSelectFileType: ['.xlsx', '.xls', '.csv'],
    allowUnparsed: true,
    onFileClick: (file) => {
      void selectFile(file)
    },
    isFileActive: (file) => {
      if (!currentFile.value || !file) return false
      const curId = getFileIdentifier(currentFile.value)
      const fileId = getFileIdentifier(file)
      return curId && fileId && String(curId) === String(fileId)
    },
    getCanBatchExecute: () => isEngineeringConfigReady() && hasExecuteTargets.value,
    getGlobalBatchSettings: buildEngineeringGlobalBatchSettings,
    onBeforeOpenBatchDialog,
    onBatchExecute: (taskSwitch, name, remark) => runEngineeringBatchExecute(taskSwitch, name, remark),
    /**
     * 侧栏删除文件后同步清空当前预览
     * @param {Array<string>} removedFileIds 已删除文件 id 列表
     * @returns {void}
     */
    onFilesRemoved: (removedFileIds) => {
      const curId = currentFile.value ? getFileIdentifier(currentFile.value) : ''
      if (curId && removedFileIds.includes(String(curId))) {
        currentFile.value = null
        currentPreviewFileKey.value = ''
      }
    },
    /**
     * 选择文件确认后：默认预览首个文件（与 OcrViewer 一致）
     * @param {Object} _payload 选择结果摘要
     * @returns {Promise<void>}
     */
    afterFileSelectConfirm: async () => {
      const list = fileList.value || []
      if (list.length === 0) return
      if (!isResultViewMode.value) {
        showFilePreview.value = false
      }
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

  /** 文档资料挖掘入口：默认不展示中间文件预览，右侧铺满功能配置 */
  showFilePreview.value = false

  watch(showFilePreview, async (visible) => {
    if (!visible || !currentFile.value) return
    const file = currentFile.value
    const previewId = String(getFileIdentifier(file) || '')
    if (!previewId || file.previewUrl) return
    try {
      const previewRes = await previewFileAPI(previewId)
      if (previewRes.code === 200 && previewRes.data?.preview_url) {
        file.previewUrl = previewRes.data.preview_url
        currentFile.value = { ...file, previewUrl: previewRes.data.preview_url }
        currentPreviewFileKey.value = previewId || file.name || ''
      }
    } catch (e) {
      console.warn('获取预览URL失败:', e)
    }
  })

  /**
   * 树节点点击：文件预览；文件夹则预览其下首个已加载文件
   * @param {Object} treeNode 树节点
   * @param {MouseEvent} [event] 点击事件
   * @returns {Promise<void>}
   */
  const handleEngineeringTreeNodeClick = async (treeNode, event) => {
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
      if (!isResultViewMode.value) {
        return
      }
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
   * 左侧 bindings（computed 保持与 OcrViewer 一致的响应式）
   */
  const leftSidebarBindings = computed(() => ({
    ...sidebarCore.leftSidebarBindings,
    handleTreeNodeClick: handleEngineeringTreeNodeClick,
    previewTaskName,
    ...(isResultViewMode.value
      ? {
          handleDownloadAllResults,
          previewDownloadFormats: ['xlsx'],
          bulkExportLoading
        }
      : {})
  }))

  /**
   * 调用 BatchExecuteByFilter 创建任务
   * @param {number} taskSwitch 1 立即执行 2 后台
   * @param {string} name 任务名称
   * @param {string} remark 任务备注
   * @returns {Promise<boolean>} 是否成功
   */
  const runEngineeringBatchExecute = async (taskSwitch, name, remark) => {
    if (!hasExecuteTargets.value) {
      ElMessage.warning('请先在左侧添加文件或文件夹')
      return false
    }
    if (!validateEngineeringConfig()) {
      return false
    }

    const taskData = buildToolBatchExecutePayload({
      taskName: name,
      taskRemark: remark,
      toolLabel: props.toolLabel,
      bizType: 'engineering_project_data_consistency',
      taskType: 6,
      toolUuid: 'engineering-project-tool-uuid',
      taskSwitch,
      buildExecConfig: buildEngineeringExecConfig,
      sidebarContext: getSidebarExecuteContext(),
      parseStatus: ['parsed', 'unparsed', 'parsing'],
      fileExtensions: ['.xlsx', '.xls', '.csv']
    })
    const deletedFiles = (pendingDeleteRecords.value.files || [])
      .map((item) => ({
        file_id: String(item.fileId || ''),
        folder_path: item.folderPath || ''
      }))
      .filter((item) => item.file_id)
    if (deletedFiles.length > 0) {
      taskData.deleted_files = deletedFiles
    }

    batchExecuteAborted = false
    isViewerActive.value = true
    activeBatchExecuteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null

    let succeeded = false
    await runBatchExecuteWithTimeoutNav({
      taskName: name,
      requestFn: () => batchExecuteByFilterAPI(taskData, {
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
            eventBus.emit(props.eventKey, {
              taskUuid,
              taskName: name
            })
          }
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

  // 清除高亮
  const handleClearHighlight = () => {
    // 调用PreviewFile组件的清除高亮方法
    if (previewFileRef.value) {
      previewFileRef.value.clearDocxHighlights()
    }

    currentHighlightedField.value = null
    ElMessage.success('已清除所有定位样式')
  }

  /**
   * 左侧模式切换（编辑 / 预览）
   * @param {string} mode 目标模式
   * @returns {void}
   */
  const handleLeftSidebarModeChange = (mode) => {
    leftSidebarMode.value = mode === 'preview' ? 'preview' : 'edit'
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

  const refresh = () => {
    if (currentFile.value && previewFileRef.value) {
      previewFileRef.value.loadFile(currentFile.value)
      ElMessage.success('已刷新')
    }
  }

  const download = () => {
    ElMessage.info('下载功能（演示模式）')
  }

  // 标签切换
  const handleTabChange = (tab) => {
    console.log('切换到标签:', tab)
  }

  // 处理按钮 - 跳转任务中心
  const handleGoToTaskCenter = () => {
    invalidateBatchExecute()
    emit('close-dialog')
    const basePath = '/task-center'

    // 从 menuTree 中查找 task-center 路由对应的菜单项，获取 menuId
    const menuItem = homeStore.findMenuItemByPath(basePath)
    let menuId = '751' // 默认值，如果查询不到则使用此值

    if (menuItem && menuItem.id) {
      menuId = String(menuItem.id)
    }

    // 构建带参数的路由路径
    const tabPath = `${basePath}?menuId=${menuId}`

    // 添加标签页（如果已存在会自动激活）
    homeStore.addTab({
      id: 'task-center',
      title: '任务中心',
      path: tabPath,
      name: '任务中心',
      meta: { title: '任务中心', keepAlive: true }
    })

    // 路由跳转（与 LeftMenu 中的实现保持一致）
    router.push(tabPath)
  }

  const handleChartRecognition = () => {
    ElMessage.info('图表识别功能（演示模式）')
  }

  const handleStampRecognition = () => {
    ElMessage.info('印章识别功能（演示模式）')
  }

  /**
   * 清空解析结果展示
   * @returns {void}
   */
  const clearEngineeringResults = () => {
    engineeringResult.duplicateTableRows = []
    engineeringResult.parentChildSections = createEmptyParentChildSections()
    engineeringResult.resultMeta = {
      duplicateError: '',
      parentChildError: '',
      duplicateFieldWeights: null,
      duplicateFieldLabels: null,
      duplicateRoleFields: null,
      duplicateThreshold: null,
      parentChildFieldWeights: null,
      parentChildFieldLabels: null,
      parentChildRoleFields: null,
      parentChildThreshold: null,
      sourceColumns: [],
      hasDuplicateBlock: false,
      hasParentChildBlock: false
    }
  }

  /**
   * 当前预览文件名称（供结果映射使用）
   * @returns {string}
   */
  const getCurrentTaskFileName = () => {
    const file = currentFile.value
    return file?.name || file?.file_name || ''
  }

  /**
   * 从任务调度结果行提取 disposal_result 字符串
   * @param {Array|Object} detail 任务结果列表或单项
   * @param {string} [preferFileId] 优先匹配的文件 UUID
   * @returns {string|null} JSON 字符串
   */
  const pickDisposalString = (detail, preferFileId) => {
    const list = Array.isArray(detail) ? detail : detail ? [detail] : []
    if (!list.length) return null

    const pref =
      preferFileId != null && String(preferFileId).trim()
        ? String(preferFileId).trim()
        : props.fileId != null && String(props.fileId).trim()
          ? String(props.fileId).trim()
          : ''

    let row = list[0]
    if (pref) {
      const matched = list.find((item) => {
        const id = item.file_uuid || item.FILE_UUID || item.file_id || item.FILE_ID
        return id != null && String(id) === pref
      })
      if (matched) row = matched
    }

    const dr = row.disposal_result ?? row.DISPOSAL_RESULT
    if (dr == null || dr === '') return null
    return typeof dr === 'string' ? dr : String(dr)
  }

  /**
   * 将解析后的 disposal_result 写入结果表
   * @param {Object} parsed 解析后的结果对象
   * @returns {void}
   */
  const applyEngineeringDisposalResult = (parsed) => {
    const fileId = currentFile.value ? getFileIdentifier(currentFile.value) : ''
    const resultRow = findScheduleResultByFileId(fileId)
    const parameterSettings = parseParameterSettings(
      resultRow?.parameter_settings ?? resultRow?.PARAMETER_SETTINGS
    )
    const mapped = mapEngineeringDisposalResult(parsed, {
      taskFileName: getCurrentTaskFileName(),
      parameterSettings: Object.keys(parameterSettings).length ? parameterSettings : null
    })
    engineeringResult.duplicateTableRows = mapped.duplicateTableRows
    engineeringResult.parentChildSections = mapped.parentChildSections
    engineeringResult.resultMeta = mapped.resultMeta
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
   * 按文件 ID 查找任务结果行
   * @param {string} fileId 文件 UUID
   * @returns {Object|null} 结果行
   */
  const findScheduleResultByFileId = (fileId) => {
    if (!fileId) return null
    const list = cachedScheduleResultList.value || []
    return (
      list.find((item) => {
        const id = item.file_uuid || item.FILE_UUID || item.file_id || item.FILE_ID
        return id != null && String(id) === String(fileId)
      }) || null
    )
  }

  /**
   * 解析任务 schedule 行上的 parameter_settings
   * @param {unknown} raw 原始值
   * @returns {Object}
   */
  const parseParameterSettings = (raw) => {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        return {}
      }
    }
    return {}
  }

  /**
   * 从 schedule 行回填工程项目功能配置
   * @param {Object|null} resultRow 任务结果行
   * @returns {boolean} 是否成功回填
   */
  const applyEngineeringConfigFromScheduleRow = (resultRow) => {
    if (!resultRow) return false
    const ps = parseParameterSettings(resultRow.parameter_settings ?? resultRow.PARAMETER_SETTINGS)
    if (!ps || !Object.keys(ps).length) return false

    const duplicateDetection = ps.duplicate_detection?.field_mapping
      ? ensureSingleTableShape(ps.duplicate_detection, 'duplicate')
      : ensureSingleTableShape(
          migrateLegacyEngineeringConfig(ps.duplicate_detection || {}, 'duplicate'),
          'duplicate'
        )

    const parentChildAnalysis = ps.parent_child_analysis?.field_mapping
      ? ensureSingleTableShape(ps.parent_child_analysis, 'parent_child')
      : ensureSingleTableShape(
          migrateLegacyEngineeringConfig(ps.parent_child_analysis || {}, 'parent_child'),
          'parent_child'
        )

    fileConfig.config.engineering_repeat_project = {
      key: '',
      prompt: '',
      ...(ps.engineering_repeat_project || {})
    }
    fileConfig.config.engineering_sub_project = {
      key: '',
      prompt: '',
      ...(ps.engineering_sub_project || {})
    }
    fileConfig.config.duplicate_detection = duplicateDetection
    fileConfig.config.parent_child_analysis = parentChildAnalysis
    ensureEngineeringConfigShape()
    return !!(
      ps.engineering_repeat_project?.key ||
      ps.engineering_sub_project?.key ||
      ps.duplicate_detection ||
      ps.parent_child_analysis
    )
  }

  /** 当前文件是否存在 parameter_settings 配置快照 */
  const hasEngineeringConfigSnapshot = computed(() => {
    if (!isResultViewMode.value) return true
    const fileId = currentFile.value ? getFileIdentifier(currentFile.value) : ''
    const row = findScheduleResultByFileId(fileId)
    if (!row) return false
    const ps = parseParameterSettings(row.parameter_settings ?? row.PARAMETER_SETTINGS)
    return !!(
      ps.engineering_repeat_project?.key ||
      ps.engineering_sub_project?.key ||
      ps.duplicate_detection ||
      ps.parent_child_analysis
    )
  })

  /**
   * 按当前选中文件刷新解析结果（多文件任务回看）
   * @returns {void}
   */
  const applyResultForCurrentFile = () => {
    taskResultLoadError.value = ''
    const fileId = currentFile.value ? getFileIdentifier(currentFile.value) : ''
    const rawStr = pickDisposalString(cachedScheduleResultList.value, fileId)
    if (!rawStr) {
      clearEngineeringResults()
      return
    }
    try {
      applyEngineeringDisposalResult(JSON.parse(rawStr))
      viewerTab.value = 'parse'
    } catch (e) {
      console.error('解析结果失败:', e)
      clearEngineeringResults()
      taskResultLoadError.value = '解析结果失败'
    }
  }

  /**
   * 任务中心回看：按当前文件 processing_status 同步右侧结果区与等待态
   * @returns {void}
   */
  const syncResultViewForCurrentFile = () => {
    if (!isResultViewMode.value || !cachedScheduleResultList.value.length) return

    const fileId = currentFile.value ? getFileIdentifier(currentFile.value) : ''
    const resultRow = findScheduleResultByFileId(fileId)
    applyEngineeringConfigFromScheduleRow(resultRow)
    const processingStatus = Number(
      resultRow?.processing_status ?? resultRow?.PROCESSING_STATUS ?? NaN
    )

    taskResultLoadError.value = ''

    if (processingStatus === 3) {
      awaitingTaskResults.value = false
      clearEngineeringResults()
      taskResultLoadError.value = resultRow?.error_message || resultRow?.ERROR_MESSAGE || '该文件处理失败'
      return
    }

    if (processingStatus === 2) {
      awaitingTaskResults.value = false
      applyResultForCurrentFile()
      return
    }

    awaitingTaskResults.value = true
    clearEngineeringResults()
  }

  /**
   * 导出当前文件解析结果
   * @param {string} command 导出格式
   * @returns {void}
   */
  const handleExportResults = (command) => {
    if (command !== 'excel') return
    exportEngineeringResultsXlsx({
      duplicateRows: engineeringResult.duplicateTableRows,
      parentChildSections: engineeringResult.parentChildSections,
      duplicateFieldWeights: engineeringResult.resultMeta.duplicateFieldWeights,
      parentChildFieldWeights: engineeringResult.resultMeta.parentChildFieldWeights,
      duplicateFieldLabels: engineeringResult.resultMeta.duplicateFieldLabels,
      parentChildFieldLabels: engineeringResult.resultMeta.parentChildFieldLabels,
      duplicateRoleFields: engineeringResult.resultMeta.duplicateRoleFields,
      parentChildRoleFields: engineeringResult.resultMeta.parentChildRoleFields,
      sourceColumns: engineeringResult.resultMeta.sourceColumns,
      fileBaseName: getCurrentTaskFileName() || props.toolLabel || '工程项目分析结果'
    })
  }

  /**
   * 解析 blob 错误响应体
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  const parseBlobErrorMessage = async (blob) => {
    if (!(blob instanceof Blob)) return ''
    try {
      const text = await blob.text()
      const j = JSON.parse(text)
      return j?.detail || j?.message || text || ''
    } catch {
      return ''
    }
  }

  /**
   * 从 Content-Disposition 解析下载文件名
   * @param {string} contentDisposition
   * @returns {string}
   */
  const parseDownloadFilename = (contentDisposition) => {
    if (!contentDisposition) return ''
    const star = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i)
    if (star?.[1]) return decodeURIComponent(star[1].trim())
    const m = contentDisposition.match(/filename="?([^";\n]+)"?/i)
    return m?.[1] ? decodeURIComponent(m[1].trim()) : ''
  }

  /**
   * 任务中心预览：批量导出全部已完成文件的 Excel（ZIP）
   * @param {string} format 下载格式
   * @returns {Promise<void>}
   */
  const handleDownloadAllResults = async (format) => {
    if (format !== 'xlsx') {
      ElMessage.info('工程项目仅支持 Excel 批量导出')
      return
    }
    const taskId = resolvedTaskId.value
    if (!taskId) {
      ElMessage.warning('未找到任务标识')
      return
    }
    bulkExportLoading.value = true
    try {
      const response = await exportEngineeringProjectResultsZipAPI(taskId)
      const data = response?.data
      const ctype = String(response?.headers?.['content-type'] || '').toLowerCase()
      if (data instanceof Blob && (ctype.includes('application/json') || data.type === 'application/json')) {
        const msg = await parseBlobErrorMessage(data)
        ElMessage.error(msg || '批量导出失败')
        return
      }
      if (!(data instanceof Blob) || data.size === 0) {
        ElMessage.error('批量导出失败：未返回有效文件')
        return
      }
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      const fromHeader = parseDownloadFilename(response?.headers?.['content-disposition'])
      const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const safeLabel = (props.toolLabel || '工程项目数据一致性分析').replace(/[\\/:*?"<>|]/g, '_')
      link.download = fromHeader || `${safeLabel}_${ts}.zip`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 300)
      ElMessage.success('批量导出成功')
    } catch (error) {
      console.error('批量导出失败:', error)
      const errData = error?.response?.data
      let msg = error?.message || '批量导出失败，请稍后重试'
      if (errData instanceof Blob) {
        const parsed = await parseBlobErrorMessage(errData)
        if (parsed) msg = parsed
      }
      ElMessage.error(msg)
    } finally {
      bulkExportLoading.value = false
    }
  }

  /**
   * 从任务结果列表恢复左侧文件并预览
   * @param {Array} list 任务调度结果列表
   * @param {Object} [taskDetail] 任务详情（含 selection_summary 时构建文件夹树）
   * @returns {Promise<void>}
   */
  const hydrateFileFromScheduleList = async (list, taskDetail) => {
    if (!Array.isArray(list) || !list.length) return

    if (taskDetail) {
      applyTaskSelectionToSidebar(sidebarCore, taskDetail)
      const name = taskDetail.task_name || taskDetail.TASK_NAME
      if (name) {
        previewTaskName.value = name
      }

      const sourceRefMap = buildSourceRefsFromResultList(list)
      const folderNameMap = buildFolderNameMapFromSourceRefs(sourceRefMap)
      const receivedFiles = []
      list.forEach((resultItem) => {
        const fileId = resultItem.file_uuid || resultItem.FILE_UUID
        if (!fileId) return
        const fileName = resultItem.file_name || resultItem.FILE_NAME || '文件'
        const processingStatus = Number(
          resultItem.processing_status ?? resultItem.PROCESSING_STATUS ?? 0
        )
        receivedFiles.push(
          enrichFileRowWithSourceRefs(
            {
              id: fileId,
              name: fileName,
              file_name: fileName,
              type: getFileTypeFromExtension(fileName),
              previewUrl: '',
              fileId,
              file_id: fileId,
              processing_status: processingStatus,
              execution_status: processingStatus,
              status: mapProcessingStatus(processingStatus)
            },
            resultItem,
            folderNameMap
          )
        )
      })
      if (receivedFiles.length) {
        fileList.value = receivedFiles
        if (sidebarCore.fileTreeRenderKey) {
          sidebarCore.fileTreeRenderKey.value += 1
        }
      }
    } else {
      const pref =
        props.fileId != null && String(props.fileId).trim()
          ? String(props.fileId).trim()
          : ''
      const row =
        (pref && list.find((r) => (r.file_uuid || r.FILE_UUID) === pref)) || list[0]
      const fileId = row.file_uuid || row.FILE_UUID
      const fileName = row.file_name || row.FILE_NAME || '文件'
      if (!fileId) return

      const exists = (fileList.value || []).some(
        (f) => String(getFileIdentifier(f)) === String(fileId)
      )
      if (!exists) {
        await addFilesFromManager([
          {
            file_id: fileId,
            file_name: fileName,
            folder_path: ''
          }
        ])
      }
    }

    const pref =
      props.fileId != null && String(props.fileId).trim()
        ? String(props.fileId).trim()
        : ''
    const row =
      (pref && list.find((r) => (r.file_uuid || r.FILE_UUID) === pref)) || list[0]
    const fileId = row.file_uuid || row.FILE_UUID
    if (!fileId) return

    let target = (fileList.value || []).find(
      (f) => String(getFileIdentifier(f)) === String(fileId)
    )
    if (!target) return

    const fileName = row.file_name || row.FILE_NAME || '文件'
    if (showFilePreview.value) {
      try {
        const previewRes = await previewFileAPI(fileId)
        if (previewRes.code === 200 && previewRes.data?.preview_url) {
          target.previewUrl = previewRes.data.preview_url
        }
      } catch (e) {
        console.warn(`获取文件 ${fileName} 预览URL失败:`, e)
      }
    }

    showFilePreview.value = false
    await selectFile(target)
  }

  /**
   * 写入任务解析结果（供任务中心或轮询回调）
   * @param {Array|Object} detailPayload 任务结果
   * @param {Object} [taskDetail] 任务详情（含 selection_summary）
   * @returns {Promise<void>}
   */
  const setResult = async (detailPayload, taskDetail) => {
    taskResultLoadError.value = ''
    awaitingTaskResults.value = false
    cachedScheduleResultList.value = Array.isArray(detailPayload) ? detailPayload : []
    const rawStr = pickDisposalString(detailPayload)
    if (!rawStr) {
      clearEngineeringResults()
      if (!isResultViewMode.value) {
        ElMessage.warning('任务已完成但未解析到结果内容')
      }
      return
    }

    try {
      applyEngineeringDisposalResult(JSON.parse(rawStr))
      viewerTab.value = 'parse'
      const list = Array.isArray(detailPayload) ? detailPayload : []
      if (list.length) {
        await hydrateFileFromScheduleList(list, taskDetail)
        if (cachedScheduleResultList.value.length) {
          syncResultViewForCurrentFile()
        }
      }
      if (!isResultViewMode.value) {
        ElMessage.success('工程项目数据一致性分析完成')
      }
    } catch (e) {
      console.error('解析结果失败:', e)
      clearEngineeringResults()
      taskResultLoadError.value = '解析结果失败'
      ElMessage.error('解析结果失败')
    }
  }

  /**
   * 标记任务执行失败（供外层轮询）
   * @param {string} [message] 具体失败原因（来自 ERROR_MESSAGE）
   * @returns {void}
   */
  const taskError = (message) => {
    awaitingTaskResults.value = false
    const msg = (message && String(message).trim()) || '任务执行失败'
    taskResultLoadError.value = msg
    if (!isResultViewMode.value) {
      ElMessage.error(msg)
    }
  }

  /**
   * 按任务 ID 加载工程项目任务详情与结果
   * @returns {Promise<void>}
   */
  const loadEngineeringTaskById = async () => {
    const id = resolvedTaskId.value
    if (!id) return
    resultViewLoading.value = true
    taskResultLoadError.value = ''
    awaitingTaskResults.value = false
    viewerTab.value = 'parse'
    leftSidebarTaskId.value = id
    leftSidebarMode.value = 'preview'
    try {
      const res = await getTaskSchedulesAPI(id, {
        prefer_runtime: true,
        include_results: true,
        include_selection_summary: true
      })
      if (res.code !== 200 || !res.data) {
        taskResultLoadError.value = res.message || '获取任务详情失败'
        return
      }
      const td = res.data
      previewTaskName.value = td.task_name || td.TASK_NAME || '-'
      const st = Number(td.task_status)
      const resultList = td.task_schedule_result_list || []

      if (st === 3) {
        awaitingTaskResults.value = false
        taskResultLoadError.value = resolveScheduleTaskFailureMessage(td)
        clearEngineeringResults()
        return
      }

      cachedScheduleResultList.value = resultList
      await hydrateFileFromScheduleList(resultList, td)

      if (st !== 2) {
        syncResultViewForCurrentFile()
        return
      }

      syncResultViewForCurrentFile()
    } catch (e) {
      console.error(e)
      taskResultLoadError.value = e?.message || '加载任务失败'
      clearEngineeringResults()
    } finally {
      resultViewLoading.value = false
      if (isResultViewMode.value) {
        showFilePreview.value = false
      }
    }
  }

  watch(resolvedTaskId, async (id, prev) => {
    if (!id || id === prev) return
    await loadEngineeringTaskById()
  })

  defineExpose({
    setResult,
    taskError
  })

  /**
   * 从文件管理入口参数初始化列表
   * @returns {Promise<void>}
   */
  const initFilesFromProps = async () => {
    const fileIds = props.files
    const fileNames = props.names
    if (!fileIds || !fileNames) return

    try {
      const ids = fileIds.split(',')
      const names = decodeURIComponent(fileNames).split(',')
      const rows = ids.map((id, index) => {
        const fileName = names[index] || `文件${index + 1}`
        return {
          file_id: id,
          file_name: fileName,
          folder_path: ''
        }
      })
      await addFilesFromManager(rows)
      // afterFileSelectConfirm 内会打开预览并 selectFile(首个文件)
    } catch (error) {
      console.error('解析文件参数失败:', error)
    }
  }

  onBeforeUnmount(() => {
    invalidateBatchExecute()
  })

  onUnmounted(() => {
    if (isResizing.value) {
      stopResize()
    }
    if (isResizingLeft.value) {
      stopLeftSidebarResize()
    }
  })

  onMounted(async () => {
    isViewerActive.value = true
    if (resolvedTaskId.value) {
      await loadEngineeringTaskById()
      return
    }
    clearEngineeringResults()
    viewerTab.value = 'extract'
    showFilePreview.value = false
    await initFilesFromProps()
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

  .ocr-viewer :deep(.file-actions-row) {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .ocr-viewer :deep(.file-actions-row > * + *) {
    margin-left: 8px;
  }

  .ocr-viewer :deep(.file-actions-row .ocr-footer-btn),
  .ocr-viewer :deep(.file-actions-row .el-button) {
    flex: 1;
    min-width: 0;
    height: 32px;
    min-height: 32px;
    padding: 0 10px;
    box-sizing: border-box;
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

  /* 左侧边栏 */
  .left-sidebar {
    width: 240px;
    background: #fff;
    border-right: 1px solid #e4e7ed;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ocr-left-sidebar-host {
    flex: 1;
    min-height: 0;
    align-self: stretch;
  }

  .ocr-left-sidebar-host :deep(.left-sidebar) {
    width: 100%;
    height: 100%;
    border-right: none;
    flex: 1;
    min-height: 0;
  }

  .config-panel-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background: var(--sd-canvas, #ffffff);
  }

  .center-viewer {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--sd-canvas, #ffffff);
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

  .right-viewer-head__actions {
    flex-shrink: 0;
    margin-left: 12px;
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

  .engineering-result-subhead {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
    background: var(--sd-canvas, #ffffff);
  }

  .engineering-result-segment :deep(.el-radio-button__inner) {
    background-color: var(--sd-canvas, #ffffff);
    border-color: var(--sd-primary, #195fb4);
    color: var(--sd-primary, #195fb4);
    padding: 6px 14px;
    box-shadow: none;
  }

  .engineering-result-segment :deep(.el-radio-button:not(.is-active) .el-radio-button__inner:hover) {
    background-color: var(--sd-primary-light, #e8f0f8);
    color: var(--sd-primary, #195fb4);
    border-color: var(--sd-primary, #195fb4);
  }

  .engineering-result-segment :deep(.el-radio-button:first-child .el-radio-button__inner) {
    border-radius: 4px 0 0 4px;
  }

  .engineering-result-segment :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 0 4px 4px 0;
  }

  .engineering-result-segment :deep(.el-radio-button.is-active .el-radio-button__inner),
  .engineering-result-segment :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: var(--sd-primary, #195fb4);
    border-color: var(--sd-primary, #195fb4);
    color: #ffffff;
    box-shadow: -1px 0 0 0 var(--sd-primary, #195fb4);
  }

  .engineering-alert {
    margin: 12px 12px 0;
  }

  .engineering-result-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background: var(--sd-canvas, #ffffff);
  }

  .result-card-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    padding: 0 12px 12px;
  }

  .right-sidebar--extract .config-panel-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .right-sidebar {
    flex: 1;
    width: 100%;
    min-height: 0;
    background: var(--sd-canvas, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
  }

  .extraction-results {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0;
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

  :global(body.resizing) .resize-icon {
    color: #fff;
  }

  .file-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px;
    overflow-y: auto;
    min-height: 0;
  }

  /* 区域分隔线 */
  .section-divider {
    height: 1px;
    background: #e4e7ed;
    margin: 0 12px;
    flex-shrink: 0;
  }

  .file-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .file-title {
    font-size: 13px;
    font-weight: 500;
    color: #303133;
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-area {
    margin-bottom: 10px;
    padding: 0;
  }

  .upload-area {
    margin-bottom: 12px;
    padding: 0;
  }

  .file-list {
    position: relative;
    flex: 1;
    overflow-y: auto;
    margin-bottom: 12px;
  }

  .select-all-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    margin-bottom: 8px;
    border-bottom: 1px solid #e4e7ed;
    background: #fafafa;
    border-radius: 4px;
  }

  .selected-count {
    font-size: 12px;
    color: #909399;
  }

  .file-item {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    margin-bottom: 3px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
    gap: 8px;
  }

  .file-item:hover {
    background: #f5f7fa;
  }

  .file-item.active {
    background: #ecf5ff;
    color: #409EFF;
  }

  .batch-actions-bar {
    display: flex;
    flex-direction: column;
    /* padding: 10px 12px; */
    /* background: #f5f7fa; */
    /* border-bottom: 1px solid #e4e7ed; */
    gap: 8px;
  }

  .file-icon {
    margin-right: 6px;
    font-size: 16px;
  }

  .file-name {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .settings-badge {
    margin-left: auto;
  }

  .file-actions-bottom {
    display: flex;
    gap: 6px;
    padding: 12px;
    border-top: 1px solid #e4e7ed;
    background: #fff;
    flex-shrink: 0;
  }

  .storage-info {
    padding-top: 12px;
    border-top: 1px solid #e4e7ed;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .storage-text {
    font-size: 11px;
    color: #909399;
  }

  .center-viewer :deep(.folder-list-content) {
    flex: 1;
    min-height: 0;
  }

  .config-header {
    padding: 12px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .config-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: #303133;
  }

  .edit-icon {
    cursor: pointer;
    color: #909399;
    font-size: 16px;
  }

  .edit-icon:hover {
    color: #409EFF;
  }

  .config-tabs {
    padding: 6px;
    border-bottom: 1px solid #e4e7ed;
  }

  .config-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px;
    overflow-y: auto;
  }

  /* 字段模式样式 */
  .settings-status-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    margin-bottom: 12px;
    background: #f0f9ff;
    border: 1px solid #b3d8ff;
    border-radius: 4px;
    font-size: 13px;
    color: #409eff;
  }

  .settings-status-banner .status-icon {
    font-size: 16px;
    color: #67c23a;
  }

  .settings-status-banner .status-text {
    flex: 1;
    font-weight: 500;
  }

  .settings-status-banner .status-time {
    font-size: 12px;
    color: #909399;
  }

  .field-mode-header {
    padding: 10px 12px;
    border-bottom: 1px solid #e4e7ed;
    background: #f5f7fa;
  }

  /* 模板选择下拉框样式 */
  :deep(.template-select-dropdown) .el-select-dropdown__list {
      padding-bottom: 50px; /* 为浮动选项留出空间 */
  }

  /* 新增模板选项样式 - 浮动显示 */
  :deep(.floating-add-option) {
    position: sticky !important;
    bottom: 0 !important;
    z-index: 10 !important;
    background: #fff !important;
    border-top: 1px solid #e4e7ed !important;
    margin-top: 4px !important;
    padding-top: 8px !important;
    color: #409EFF !important;
    font-weight: 500 !important;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1) !important;
  }

  :deep(.floating-add-option:hover) {
    background-color: #ecf5ff !important;
  }

  .mode-tabs {
    display: flex;
    gap: 0;
    align-items: center;
    background: #f5f7fa;
    border-radius: 4px;
  }

  .mode-label {
    padding: 6px 12px;
    font-size: 13px;
    color: #606266;
    font-weight: 500;
  }

  .mode-tab {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    color: #606266;
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.3s;
  }

  .mode-tab:hover {
    color: #409EFF;
  }

  .mode-tab.active {
    background: #fff;
    color: #303133;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
  }

  .mode-tab.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }


  .config-content-prompt {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px;
    overflow-y: auto;
    min-height: 0;
  }

  .config-content-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px;
    overflow-y: auto;
    background: #f9fafb;
    min-height: 0;
  }


  .field-config-header {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    margin-bottom: 0;
    padding: 0;
    background: #fff;
    border-radius: 4px;
    gap: 12px;
  }

  .field-config-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .field-config-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    font-size: 13px;
    color: #303133;
  }

  .field-config-actions {
    display: flex;
    justify-content: space-between;
    gap: 5px;
    width: 100%;
  }

  .field-config-desc {
    font-size: 11px;
    color: #909399;
    margin-bottom: 12px;
    line-height: 1.5;
    padding: 0 4px;
  }

  .field-definition-list {
    /* margin-top: 12px; */
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-item {
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    background: #fff;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: all 0.2s;
  }

  .field-item:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
  }

  .field-item-new {
    border-style: dashed;
    background: #fafbfc;
  }

  .field-item-new:hover {
    border-color: #409eff;
    background: #f0f7ff;
  }

  .field-item-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-row {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 10px;
    align-items: center;
  }

  .field-label {
    font-size: 12px;
    font-weight: 500;
    color: #606266;
    text-align: right;
    white-space: nowrap;
  }

  .field-input {
    width: 100%;
  }

  .field-item-action {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid #f0f2f5;
    margin-top: 4px;
  }

  .add-field-button {
    display: flex;
    justify-content: center;
    padding: 12px 0;
    margin-top: 8px;
  }

  .config-desc {
    font-size: 12px;
    color: #909399;
    margin-bottom: 12px;
    line-height: 1.6;
  }

  .config-editor {
    margin-bottom: 12px;
  }

  .config-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .template-selector {
    margin-bottom: 16px;
  }

  .extract-button {
    margin-bottom: 16px;
  }

  /* 抽取结果展示 */
  .result-card-body :deep(.result-table-container) {
    flex: 1;
    min-height: 0;
  }

  .results-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .result-item {
    margin-bottom: 10px;
    padding: 12px;
    background: #f9fafb;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .result-item:hover {
    background: #f5f7fa;
    border-color: #409EFF;
  }

  .result-item.highlighted {
    background: #ecf5ff;
    border-color: #409EFF;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
  }

  .result-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .result-field-name {
    font-size: 13px;
    font-weight: 500;
    color: #303133;
  }

  .result-value {
    font-size: 12px;
    color: #606266;
    line-height: 1.5;
    word-break: break-word;
  }

  .result-metrics {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .result-confidence {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .result-confidence-text {
    font-size: 11px;
    color: #909399;
    min-width: 35px;
  }

  .hidden-upload {
    display: none;
  }

  /* 模板分配弹框样式 */
  .template-assign-content {
    padding: 0;
  }

  .assign-tip {
    margin-bottom: 0;
  }

  /* 响应式调整 */
  /* @media (max-width: 1400px) {
    .right-sidebar {
      width: 340px;
    }
  } */

  /* 批量执行弹框样式 */
  .batch-recognize-dialog .el-dialog__body {
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
  }


  .batch-recognize-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
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

  .batch-mode-header {
    border-bottom: 1px solid #e4e7ed;
    padding-bottom: 12px;
  }

  .batch-config-prompt,
  .batch-config-field {
    padding: 12px 0;
  }

  .batch-config-prompt .config-desc {
    font-size: 12px;
    color: #909399;
    margin-bottom: 12px;
    line-height: 1.5;
    padding: 0 4px;
  }

  .batch-config-prompt .config-editor {
    margin-top: 12px;
  }

  .batch-config-field .field-config-desc {
    font-size: 12px;
    color: #909399;
    margin-bottom: 12px;
    line-height: 1.5;
    padding: 0 4px;
  }

  /* 文件选择对话框样式 */
  .file-select-dialog .el-dialog__body {
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
  }

  .file-select-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .file-select-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .file-select-list {
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    padding: 12px;
    background: #fafbfc;
  }

  .file-select-pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }


  .contract-completeness-tabs :deep(.el-tabs__nav) {
    width: 100%;
  }
  .contract-completeness-tabs :deep(.el-tabs__nav .el-tabs__item) {
    width: 100%;
  }

  /* 提取结果容器样式 */

  /* 分析结果表格样式 */
  .result-table-container {
    height: calc(100vh - 185px);
  }

  </style>
