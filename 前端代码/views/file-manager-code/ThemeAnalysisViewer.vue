<template>
    <div class="ocr-viewer" :class="{ 'ocr-viewer--embedded': isResultViewMode }" v-loading="resultViewLoading">
      <div
        class="left-sidebar-shell resizable-left-sidebar"
        :style="{ width: leftSidebarWidth + 'px' }"
      >
        <OcrLeftSidebar
          v-if="isResultViewMode"
          :bindings="taskPreviewSidebarBindings"
          mode="preview"
          :task-id="resolvedTaskId"
          :readonly="true"
          :allow-mode-switch="false"
          :hide-batch-execute="true"
          :show-preview-toggle="true"
          compact-file-header
          layout-mode="full"
          empty-description="暂无任务文件"
        />
        <div v-else class="left-sidebar">
          <div v-if="!isResultViewMode" class="file-header ocr-column-head">
            <div class="file-header-toolbar">
              <div class="sd-search-box ocr-file-search">
                <el-icon class="sd-search-icon"><Search /></el-icon>
                <input
                  v-model="fileSearchKeyword"
                  type="text"
                  placeholder="搜索文件"
                  class="sd-search-input"
                />
              </div>
              <el-tooltip :content="showFilePreview ? '隐藏文件预览' : '显示文件预览'" placement="bottom">
                <el-button
                  :icon="showFilePreview ? Hide : View"
                  circle
                  size="small"
                  class="file-preview-toggle-btn"
                  @click="showFilePreview = !showFilePreview"
                />
              </el-tooltip>
            </div>
          </div>

          <div class="file-section">
            <div class="file-list">
              <div
                v-for="(file, index) in filteredDuplicateFiles"
                :key="file.fileId || file.id"
                :class="['file-item', { active: isFileActive(file) }]"
                @click="selectFile(file)"
              >
                <el-icon class="file-icon"><Document /></el-icon>
                <span class="file-name">{{ file.name }}</span>
                <el-button
                  v-if="!isResultViewMode"
                  type="danger"
                  :icon="Delete"
                  size="small"
                  text
                  @click.stop="handleDeleteFile(getDuplicateFileIndex(file))"
                  style="margin-left: auto;"
                  title="删除文件"
                />
              </div>
              <el-empty
                v-if="filteredDuplicateFiles.length === 0"
                :description="isResultViewMode ? '该任务暂无文件记录' : '请选择待定名称项目文件'"
                :image-size="60"
                style="padding: 20px 0;"
              />
            </div>
          </div>

          <div v-if="!isResultViewMode" class="file-actions-bottom ocr-sidebar-footer">
            <div class="file-actions-row">
              <el-button class="ocr-select-files-btn ocr-footer-btn" @click="handleSelectFile('duplicate')">
                选择文件
              </el-button>
              <el-button
                type="primary"
                class="ocr-footer-btn"
                :loading="extracting || topicSummarizing"
                :disabled="extracting || topicSummarizing"
                @click="handleLeftExecute"
              >
                执行
              </el-button>
            </div>
          </div>
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
          <PreviewFile
            ref="previewFileRef"
            :current-file="currentFile"
            :current-highlighted-field="currentHighlightedField"
            @refresh="refresh"
            @download="download"
            @clear-highlight="handleClearHighlight"
          >
            <template #headerActions>
              <template v-if="!isResultViewMode">
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

        <!-- 右侧面板：任务中心预览（信息提取 / 主题归纳） -->
        <div
          v-if="isResultViewMode"
          class="right-viewer"
          :class="{ 'right-viewer-fullwidth': !showFilePreview }"
          :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
        >
          <div class="right-viewer-head ocr-column-head">
            <div class="sidebar-tabs">
              <el-tabs v-model="resultSubTab">
                <el-tab-pane label="信息提取" name="table" />
                <el-tab-pane label="主题归纳" name="markdown" />
              </el-tabs>
            </div>
            <div class="right-viewer-head__actions">
              <el-button type="primary" plain size="small" @click="handleResultFullscreen">
                {{ resultFullscreenActive ? '退出全屏' : '全屏' }}
              </el-button>
            </div>
          </div>
          <div class="right-sidebar">
            <div
              class="extraction-results"
              :class="{ 'is-executing': extracting || topicSummarizing }"
            >
              <div
                v-show="extracting || topicSummarizing"
                class="task-runtime-execute-panel"
              >
                <div class="task-runtime-elapsed">
                  <el-icon class="task-runtime-spin is-loading" :size="18">
                    <Loading />
                  </el-icon>
                  <span>{{ loadingText }}</span>
                </div>
                <TaskRuntimeProgressTree :nodes="taskRuntimeNodes" />
              </div>
              <div
                v-show="!extracting && !topicSummarizing"
                class="extraction-results-table-wrap"
              >
                <ResultTable
                  ref="resultTableRef"
                  v-model:active-tab="resultSubTab"
                  :hide-tab-header="true"
                  :columns="fileConfig.extractionColumns"
                  :rows="fileConfig.extractionRows"
                  :theme-summary-text="themeSummaryText"
                  @fullscreen-change="onResultFullscreenChange"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧面板：工具页（解析结果 / 功能配置） -->
        <div
          v-if="!isResultViewMode"
          class="right-viewer"
          :class="{ 'right-viewer-fullwidth': !showFilePreview }"
          v-show="viewerTab === 'parse'"
          :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
        >
          <div class="sidebar-tabs ocr-column-head">
            <el-tabs v-model="viewerTab" @tab-change="handleTabChange">
              <el-tab-pane v-if="isLoadResult" label="解析结果" name="parse" />
              <el-tab-pane label="功能配置" name="extract" />
            </el-tabs>
          </div>
          <div class="right-sidebar">
            <div
              class="extraction-results"
              :class="{ 'is-executing': extracting || topicSummarizing }"
            >
              <div
                v-show="extracting || topicSummarizing"
                class="task-runtime-execute-panel"
              >
                <div class="task-runtime-elapsed">
                  <el-icon class="task-runtime-spin is-loading" :size="18">
                    <Loading />
                  </el-icon>
                  <span>{{ loadingText }}</span>
                </div>
                <TaskRuntimeProgressTree :nodes="taskRuntimeNodes" />
              </div>
              <div
                v-show="!extracting && !topicSummarizing"
                class="extraction-results-table-wrap"
              >
                <ResultTable
                  ref="resultTableRef"
                  :columns="fileConfig.extractionColumns"
                  :rows="fileConfig.extractionRows"
                  :theme-summary-text="themeSummaryText"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧面板：功能配置（工具页） -->
        <div
          v-if="!isResultViewMode"
          class="right-viewer"
          :class="{ 'right-viewer-fullwidth': !showFilePreview }"
          v-show="viewerTab === 'extract'"
          :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
        >
          <div class="field-mode-header ocr-column-head">
            <span class="config-head-title">选择提示词</span>
          </div>
          <div class="config-panel-wrap">
            <ConfigPanel
              ref="configPanelRef"
              v-model:prompt="fileConfig.config"
              :loading="extracting || topicSummarizing"
              :no-execute="true"
              :show-section-header="false"
            />
          </div>
        </div>

      <!-- 文件选择对话框 -->
      <FileSelectDialog
        v-model="fileSelectDialogVisible"
        @confirm="onFileSelectConfirm"
      />

      <el-dialog
        v-model="taskMetaDialogVisible"
        title="任务信息"
        width="480px"
        align-center
        append-to-body
        destroy-on-close
        @closed="onTaskMetaDialogClosed"
      >
        <el-form label-width="88px" label-position="right" size="default">
          <el-form-item label="任务名称" required>
            <el-input
              v-model="taskMetaForm.taskName"
              placeholder="请输入任务名称"
              maxlength="120"
              show-word-limit
              clearable
            />
          </el-form-item>
          <el-form-item label="任务备注">
            <el-input
              v-model="taskMetaForm.taskNotes"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="选填"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="taskMetaDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmTaskMetaAndRun">确定</el-button>
        </template>
      </el-dialog>
    </div>
  </template>

  <script setup>
    import { ref, computed, onMounted, onUnmounted, nextTick, reactive, watch } from 'vue'
    import { useRouter, useRoute } from 'vue-router'
    import { ElMessage, ElMessageBox } from 'element-plus'
    import { Loading } from '@element-plus/icons-vue'
    import { useHomeStore } from '@/stores/home'
    import {
      Document,
      View,
      Hide,
      DArrowLeft,
      DArrowRight,
      Delete,
      Search,
      List
    } from '@element-plus/icons-vue'
    // 定义 props，支持从父组件传递参数
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
      /** 任务中心 / 结果页：按任务 UUID 加载结果 */
      taskId: {
        type: String,
        default: ''
      },
      fileId: {
        type: String,
        default: ''
      },
      eventKey: {
        type: String,
        default: ''
      },
      toolLabel: {
        type: String,
        default: '主题归纳'
      }
    })

    // 定义 emits
    const emit = defineEmits(['close-dialog'])

    import { previewFileAPI } from '@/api/fileManager.js'
    import { createTaskSchedulesAPI, getTaskSchedulesAPI } from '@/api/task.js'
    import FileSelectDialog from '@/components/common/FileSelectDialog.vue'
    import PreviewFile from '@/views/file-manager-code/components/PreviewFile.vue'
    import OcrLeftSidebar from '@/views/file-manager-code/components/OcrLeftSidebar.vue'
    import { useTaskCenterPreviewSidebar } from '@/views/file-manager-code/composables/useTaskCenterPreviewSidebar.js'
    import ConfigPanel from './components/ThemeAnalysis/ConfigPanel.vue'
    import ResultTable from './components/ThemeAnalysis/ResultTable.vue'
    import TaskRuntimeProgressTree from './components/contract/TaskRuntimeProgressTree.vue'

    defineOptions({
      name: 'ThemeAnalysisViewer',
    })

    const router = useRouter()
    const route = useRoute()
    const homeStore = useHomeStore()

    const resolvedTaskId = computed(() => {
      const a = props.taskId && String(props.taskId).trim()
      if (a) return a
      const b = route.query.taskId && String(route.query.taskId).trim()
      return b || ''
    })

    /** 专用结果页：按 taskId 加载，只读展示，隐藏选择与配置 */
    const isResultViewMode = computed(() => !!resolvedTaskId.value)

    /** 任务中心预览：信息提取 / 主题归纳子 Tab */
    const resultSubTab = ref('table')
    const resultFullscreenActive = ref(false)

    const isLoadResult = ref(false)
    const resultViewLoading = ref(false)

    // 控制文件预览显隐
    const showFilePreview = ref(true)

    // 文件列表数组
    const duplicateFiles = ref([]) // 信息提取文件列表
    const fileSearchKeyword = ref('')

    /**
     * 按关键词过滤左侧文件列表
     * @returns {Array} 过滤后的文件列表
     */
    const filteredDuplicateFiles = computed(() => {
      const keyword = (fileSearchKeyword.value || '').trim().toLowerCase()
      if (!keyword) return duplicateFiles.value
      return duplicateFiles.value.filter((file) =>
        String(file.name || '').toLowerCase().includes(keyword)
      )
    })

    /**
     * 根据文件对象获取在 duplicateFiles 中的索引
     * @param {Object} file 文件对象
     * @returns {number} 索引，未找到为 -1
     */
    const getDuplicateFileIndex = (file) => {
      const id = file?.fileId || file?.id
      return duplicateFiles.value.findIndex((f) => (f.fileId || f.id) === id)
    }

    /**
     * 左侧底栏「执行」：提取并主题归纳
     * @returns {void}
     */
    const handleLeftExecute = () => {
      handleExecute({ mode: 'extractAndSummarize' })
    }

    // 当前选择区域类型
    const currentSelectType = ref('duplicate') // 'duplicate' | 'main'

    /** 弹框默认任务名：主题归纳 + 本地时间戳 yyyymmddHHmmss */
    const buildDefaultThemeTaskName = () => {
      const d = new Date()
      const p = (n) => String(n).padStart(2, '0')
      return `${props.toolLabel}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    }

    const taskMetaDialogVisible = ref(false)
    const taskMetaForm = reactive({
      taskName: '',
      taskNotes: ''
    })
    const pendingExecuteMode = ref(null)

    const onTaskMetaDialogClosed = () => {
      pendingExecuteMode.value = null
    }

    // 信息提取第一步 biz_type：默认走 Dify（agent_info_extraction）。后端仍保留 themeAnalysisExtract 旧版；对比或回滚时改为 'themeAnalysisExtract'。旧版删除待新链路调通后统一处理。
    const THEME_INFO_EXTRACTION_BIZ_TYPE = 'agent_info_extraction'
    /** 信息提取 + 主题归纳单任务（后端串联，仅一次 CreateSchedules） */
    const THEME_EXTRACT_AND_TOPIC_BIZ_TYPE = 'agent_info_extraction_and_topic_summary'

    const THEME_TASK_POLL_MS = 5000
    const THEME_TASK_MAX_WAIT_MS = 45 * 60 * 1000

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    /** 与 ContractViewer 一致：优先 task_status，其次以各文件 processing_status 为准（任务聚合可能滞后仍为「未开始」） */
    const pollThemeTaskUntilTerminal = async (taskUuid, options = {}) => {
      const { onProgress } = options
      const start = Date.now()
      while (Date.now() - start < THEME_TASK_MAX_WAIT_MS) {
        const res = await getTaskSchedulesAPI(taskUuid, { prefer_runtime: true })
        if (res.code === 200 && res.data) {
          const td = res.data
          if (typeof onProgress === 'function') {
            onProgress(td)
          }
          const st = Number(td.task_status)
          if (st === 2) return { ok: true, status: st, detail: td }
          if (st === 3) return { ok: false, status: st, detail: td }

          const list = td.task_schedule_result_list || []
          if (list.length > 0) {
            const statuses = list.map((r) =>
              Number(r.processing_status ?? r.PROCESSING_STATUS ?? -1)
            )
            if (statuses.some((s) => s === 3)) {
              return { ok: false, status: 3, detail: td }
            }
            if (statuses.every((s) => s === 2)) {
              return { ok: true, status: 2, detail: td }
            }
          }
        }
        await sleep(THEME_TASK_POLL_MS)
      }
      return { ok: false, timeout: true }
    }

    const getRuntimeNodesFromDetail = (td) =>
      Array.isArray(td?.runtime_nodes) && td.runtime_nodes.length
        ? td.runtime_nodes
        : Array.isArray(td?.step_tree)
          ? td.step_tree
          : []

    /** 与 ContractViewer 一致：步骤树节点合并错误信息供 TaskRuntimeProgressTree 展示 */
    const mergeRuntimeNodesWithErrors = (detail, nodes) => {
      const taskStepProgress = Array.isArray(detail?.task_step_progress)
        ? detail.task_step_progress
        : []
      const taskStepByKey = new Map(
        taskStepProgress.map((s) => [s.step_key || s.key, s])
      )

      const resultList = Array.isArray(detail?.task_schedule_result_list)
        ? detail.task_schedule_result_list
        : []
      const resultByUuid = new Map(
        resultList.map((r) => [r.result_uuid || r.RESULT_UUID || r.id, r])
      )

      const findFirstFailedError = (arr) => {
        if (!Array.isArray(arr)) return null
        for (const n of arr) {
          const err = n ? (n.error_message || n.ERROR_MESSAGE || null) : null
          if (Number(n.status) === 3 && err) return err
          const sub = findFirstFailedError(n && n.children)
          if (sub) return sub
        }
        return null
      }

      const applyNode = (node) => {
        const merged = { ...node }
        merged.children = Array.isArray(merged.children) ? merged.children.map(applyNode) : []

        const nodeStatus = Number(merged.status)

        if (merged && merged.node_type === 'task_group') {
          const stepKey = merged.key || merged.step_key
          const step = taskStepByKey.get(stepKey)
          let err = step ? (step.error_message || step.ERROR_MESSAGE || null) : null

          if (nodeStatus === 3 && !err) {
            err = findFirstFailedError(merged.children)
          }
          if (nodeStatus === 3) merged.error_message = err
        } else if (merged && merged.node_type === 'file_item') {
          const uuid = merged.key || merged.id
          const res = resultByUuid.get(uuid)
          if (res) {
            const ps = Number(res.processing_status)
            let err = res.error_message || res.ERROR_MESSAGE || null
            if (!err) {
              const fps = Array.isArray(res.file_step_progress) ? res.file_step_progress : []
              const failedStep = fps.find((x) => Number(x.status) === 3)
              if (failedStep) {
                err = failedStep.error_message || failedStep.ERROR_MESSAGE || null
              }
            }
            if (ps === 3) merged.error_message = err
          }
        }

        return merged
      }

      return Array.isArray(nodes) ? nodes.map(applyNode) : []
    }

    const taskRuntimeNodes = ref([])

    const applyTaskProgressFromDetail = (td) => {
      const raw = getRuntimeNodesFromDetail(td)
      taskRuntimeNodes.value = mergeRuntimeNodesWithErrors(td, raw)
    }

    const resolveCreateTaskUuid = (response) =>
      response?.task_uuid || response?.data?.task_uuid || null

    const pickFirstDisposalString = (detail) => {
      const list = detail?.task_schedule_result_list || []
      const first = list[0]
      if (!first) return null
      const dr = first.disposal_result ?? first.DISPOSAL_RESULT
      if (dr == null || dr === '') return null
      return typeof dr === 'string' ? dr : String(dr)
    }

    // 识别配置 + 信息提取表格数据
    const fileConfig = reactive({
      config: {
        information_extraction_project: {
          key: '',
          prompt: ''
        },
        theme_summarization_project: {
          key: '',
          prompt: ''
        }
      },
      extractionColumns: [],
      extractionRows: []
    })

    // 当前文件（用于预览）
    const currentFile = ref(null)

    // 获取文件的唯一标识符（统一函数，确保一致性）
    const getFileIdentifier = (file) => {
      if (!file) return null
      const identifier = file.fileId
      return identifier
    }

    // 删除文件
    const handleDeleteFile = (index) => {
      const file = duplicateFiles.value[index]
      const fileName = file ? file.name : '文件'
      const fileLabel = '待定名称项目'

      ElMessageBox.confirm(
        `确定要删除${fileLabel}文件 "${fileName}" 吗？`,
        '删除确认',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        // 从数组中移除文件
        duplicateFiles.value.splice(index, 1)

        // 如果删除的是当前文件，清除当前文件选择
        if (currentFile.value && file && getFileIdentifier(currentFile.value) === getFileIdentifier(file)) {
          currentFile.value = null
          extractionResults.value = []
        }

        ElMessage.success(`${fileLabel}文件已删除`)
      }).catch(() => {
        // 用户取消
      })
    }

    // ConfigPanel 组件引用
    const configPanelRef = ref(null)
    const resultTableRef = ref(null)

    // PreviewFile 组件引用
    const previewFileRef = ref(null)

    // 中间查看器
    const viewerTab = ref('extract') // 'parse' | 'extract'

    // 识别相关
    const currentHighlightedField = ref(null)

    // 右侧面板宽度调整
    const SIDEBAR_DEFAULT_WIDTH = 320
    const LEFT_SIDEBAR_WIDTH_MIN = 200
    const LEFT_SIDEBAR_WIDTH_MAX = 560
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

    const isResizing = ref(false) // 是否正在调整大小
    const startX = ref(0) // 拖拽开始的X坐标
    const fileSelectDialogVisible = ref(false) // 文件选择对话框显示状态
    const startWidth = ref(0) // 拖拽开始时的宽度

    /**
     * 开始拖拽左侧分隔条
     * @param {MouseEvent} e 鼠标事件
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
     * 拖拽左侧分隔条过程
     * @param {MouseEvent} e 鼠标事件
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
     * 结束左侧宽度拖拽
     */
    const stopLeftSidebarResize = () => {
      isResizingLeft.value = false
      document.removeEventListener('mousemove', handleLeftSidebarResize)
      document.removeEventListener('mouseup', stopLeftSidebarResize)
      document.body.classList.remove('resizing')
      localStorage.setItem('ocr-viewer-left-sidebar-width', String(leftSidebarWidth.value))
    }

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
      localStorage.setItem('ocr-viewer-sidebar-width', String(rightSidebarWidth.value))
    }

    /*
     *右侧配置
    */
    const extracting = ref(false)
    const extractionResults = ref([])
    /** 主题归纳 Dify 结果展示 */
    const themeSummaryText = ref('')
    const topicSummarizing = ref(false)

    // 加载计时器相关
    const loadingElapsedTime = ref(0) // 已经过的秒数
    const loadingText = ref('正在解析中... 0.0s') // 加载文本
    let loadingTimer = null // 定时器引用

    // 判断文件是否激活
    const isFileActive = (file) => {
      if (!currentFile.value || !file) {
        return false
      }
      // 优先使用 fileId 判断
      if (currentFile.value.fileId && file.fileId) {
        return currentFile.value.fileId === file.fileId
      }
      return currentFile.value.name === file.name
    }

    // 选择文件
    const selectFile = async (file, options = {}) => {
      const { silent = false } = options
      if (!file) return

      // 设置当前文件为选中状态
      currentFile.value = file
      extractionResults.value = []
      currentHighlightedField.value = null

      // 如果文件有 fileId 但没有 previewUrl，先获取预览URL
      if (file.fileId && !file.previewUrl) {
        try {
          const previewRes = await previewFileAPI(file.fileId)
          if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
            file.previewUrl = previewRes.data.preview_url
            // 更新对应数组中的文件
            const fileInArray = duplicateFiles.value.find(f => f.fileId === file.fileId)
            if (fileInArray) {
              fileInArray.previewUrl = previewRes.data.preview_url
            }
          }
        } catch (e) {
          console.warn('获取预览URL失败:', e)
        }
      }

      if (!silent) {
        // ElMessage.success('已选择文件: ' + file.name)
      }
    }

    /**
     * 任务中心预览侧栏树节点点击：切换文件预览
     * @param {Object} treeNode 树节点
     * @returns {Promise<void>}
     */
    const handleTaskPreviewTreeNodeClick = async (treeNode) => {
      if (!treeNode || treeNode.nodeType !== 'file') return
      const source = treeNode.sourceFile || resolveSourceFileFromTreeNode(treeNode)
      if (!source) return
      const fileId = String(
        source.file_uuid || source.file_id || source.result_uuid || ''
      ).trim()
      if (!fileId) return
      const fileName = source.file_name || source.name || '文件'
      await selectFile(
        {
          id: fileId,
          fileId,
          name: fileName,
          type: inferFileTypeFromFileName(fileName),
          previewUrl: ''
        },
        { silent: true }
      )
    }

    const {
      taskPreviewSidebarBindings,
      loadTaskCenterPreviewSidebar,
      resolveSourceFileFromTreeNode
    } = useTaskCenterPreviewSidebar({
      taskId: () => resolvedTaskId.value,
      showFilePreview,
      handleTreeNodeClick: handleTaskPreviewTreeNodeClick,
      isFileActive: (file) => {
        if (!currentFile.value || !file) return false
        const fid = file.file_uuid || file.file_id || file.result_uuid
        return String(currentFile.value.fileId) === String(fid)
      }
    })

    /**
     * 切换结果区全屏
     * @returns {void}
     */
    const handleResultFullscreen = () => {
      resultTableRef.value?.toggleFullscreen?.()
    }

    /**
     * 同步结果区全屏状态
     * @param {boolean} active 是否全屏
     * @returns {void}
     */
    const onResultFullscreenChange = (active) => {
      resultFullscreenActive.value = !!active
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

    // 打开文件选择对话框
    const handleSelectFile = (type) => {
      currentSelectType.value = type
      fileSelectDialogVisible.value = true
    }

    // 处理文件选择确认
    const onFileSelectConfirm = async (items) => {
      console.log('预览参数', items)
      // items 格式: [{ file_id: string, file_name: string }, ...]
      if (!items || items.length === 0) {
        return
      }

      try {
        // 处理所有选中的文件
        const newFiles = []

        for (const item of items) {
          // 根据文件名推断文件类型
          const fileName = item.file_name || ''
          const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''

          let fileType = 'text'
          if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
            fileType = 'image'
          } else if (ext === 'pdf') {
            fileType = 'pdf'
          } else if (ext === 'docx') {
            fileType = 'docx'
          } else if (ext === 'doc') {
            fileType = 'doc'
          } else if (ext === 'xlsx' || ext === 'xlsm') {
            fileType = ext === 'xlsm' ? 'xlsm' : 'xlsx'
          } else if (ext === 'xls') {
            fileType = 'xls'
          } else if (ext === 'csv') {
            fileType = 'csv'
          } else if (ext === 'txt') {
            fileType = 'txt'
          }

          // 创建文件对象（预览URL延迟到点击文件时按需获取）
          const newFile = {
            id: item.file_id || Date.now() + Math.random(),
            name: fileName,
            type: fileType,
            previewUrl: '',
            fileId: item.file_id,
            selected: false
          }

          newFiles.push(newFile)
        }

        // 根据选择类型设置文件
        if (currentSelectType.value === 'duplicate') {
          // 添加到现有文件列表中
          duplicateFiles.value.push(...newFiles)
        }

        // 自动选择并预览第一个新添加的文件
        if (newFiles.length > 0) {
          await selectFile(newFiles[0])
        }

        // 关闭对话框
        fileSelectDialogVisible.value = false
      } catch (error) {
        console.error('添加文件失败:', error)
        ElMessage.error('添加文件失败: ' + (error.message || '未知错误'))
      }
    }

    onUnmounted(() => {
      if (isResizing.value) {
        stopResize()
      }
      if (isResizingLeft.value) {
        stopLeftSidebarResize()
      }
    })

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
      // 使用 homeStore 添加标签页并跳转（参考 LeftMenu 的实现方式）
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

    const applyJointTableFromContent = (rawContent) => {
      if (typeof rawContent === 'string') {
        try {
          obj = JSON.parse(rawContent)
        } catch {
          ElMessage.error('返回内容不是合法 JSON')
          return
        }
      }
      const jt = obj?.joint_table
      if (!jt) {
        ElMessage.warning('未返回 joint_table 结构')
        return
      }
      fileConfig.extractionColumns = Array.isArray(jt.columns) ? [...jt.columns] : ['文件名']
      fileConfig.extractionRows = (jt.rows || []).map((r) => ({
        fileName: r.fileName || '',
        values: r.values && typeof r.values === 'object' ? { ...r.values } : {}
      }))
    }

    /** 从 Dify workflow 返回中抽取可读文本 */
    const formatTopicSummaryFromDifyContent = (content) => {
      if (content == null) return ''
      let obj = content
      if (typeof content === 'string') {
        try {
          obj = JSON.parse(content)
        } catch {
          return content
        }
      }
      const data = obj?.data ?? obj
      const outputs = data?.outputs ?? obj?.outputs
      if (outputs && typeof outputs === 'object') {
        const t =
          outputs.text ??
          outputs.result ??
          outputs.output ??
          outputs.answer ??
          outputs.summary
        if (t != null && String(t).trim()) return String(t)
        return JSON.stringify(outputs, null, 2)
      }
      return typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj)
    }

    const inferFileTypeFromFileName = (fileName) => {
      const parts = (fileName || '').split('.')
      const ext = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : ''
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
      if (ext === 'pdf') return 'pdf'
      if (ext === 'doc') return 'doc'
      if (ext === 'docx') return 'docx'
      if (ext === 'xlsx' || ext === 'xlsm') return ext === 'xlsm' ? 'xlsm' : 'xlsx'
      if (ext === 'xls') return 'xls'
      if (ext === 'csv') return 'csv'
      if (ext === 'txt') return 'txt'
      return 'text'
    }

    const tryParseDisposal = (dr) => {
      if (dr == null || dr === '') return null
      if (typeof dr === 'object' && dr !== null) return dr
      if (typeof dr === 'string') {
        const s = dr.trim()
        if (!s) return null
        try {
          return JSON.parse(s)
        } catch {
          return null
        }
      }
      return null
    }

    /** 从任务详情恢复左侧文件列表与右侧表格 / 主题归纳文案（任务中心结果页） */
    const loadThemeTaskFromScheduleDetail = async (detail) => {
      const list = detail?.task_schedule_result_list || []
      themeSummaryText.value = ''
      fileConfig.extractionColumns = []
      fileConfig.extractionRows = []

      if (!list.length) {
        duplicateFiles.value = []
        return
      }

      duplicateFiles.value = list.map((r, idx) => {
        const fileName = r.file_name || r.FILE_NAME || `文件${idx + 1}`
        const fid =
          r.file_uuid || r.FILE_UUID || r.result_uuid || r.RESULT_UUID || `row-${idx}`
        const rawFt = r.file_type || r.FILE_TYPE || ''
        const ft = String(rawFt || inferFileTypeFromFileName(fileName)).toLowerCase()
        return {
          id: fid,
          name: fileName,
          type: ft,
          fileId: fid,
          previewUrl: '',
          selected: false
        }
      })

      let jointFound = false
      for (const r of list) {
        const dr = r.disposal_result ?? r.DISPOSAL_RESULT
        const p = tryParseDisposal(dr)
        const jt = p?.joint_table
        if (jt && Array.isArray(jt.columns)) {
          fileConfig.extractionColumns = [...jt.columns]
          fileConfig.extractionRows = (jt.rows || []).map((row) => ({
            fileName: row.fileName || row.file_name || '',
            values: row.values && typeof row.values === 'object' ? { ...row.values } : {}
          }))
          jointFound = true
          break
        }
      }

      // 单任务合并结果：disposal 内 topic_summary（Dify 原始 JSON）
      for (const r of list) {
        const dr = r.disposal_result ?? r.DISPOSAL_RESULT
        const p = tryParseDisposal(dr)
        if (p?.topic_summary != null) {
          const line = formatTopicSummaryFromDifyContent(p.topic_summary)
          if (line && String(line).trim()) {
            themeSummaryText.value = line
            break
          }
        }
      }

      if (!jointFound) {
        for (const r of list) {
          const dr = r.disposal_result ?? r.DISPOSAL_RESULT
          if (dr == null || dr === '') continue
          const p = tryParseDisposal(dr)
          if (p?.topic_summary != null) continue
          const line =
            p != null
              ? formatTopicSummaryFromDifyContent(p)
              : formatTopicSummaryFromDifyContent(typeof dr === 'string' ? dr : String(dr))
          if (line && String(line).trim()) {
            themeSummaryText.value = line
          }
        }
      }

      const pref =
        (props.fileId && String(props.fileId).trim()) ||
        (route.query.fileId && String(route.query.fileId).trim())
      if (pref && duplicateFiles.value.length) {
        const hit = duplicateFiles.value.find((f) => f.fileId === pref || f.id === pref)
        if (hit) await selectFile(hit, { silent: true })
        else await selectFile(duplicateFiles.value[0], { silent: true })
      } else if (duplicateFiles.value.length) {
        await selectFile(duplicateFiles.value[0], { silent: true })
      }

      viewerTab.value = 'parse'
      if (isResultViewMode.value) {
        resultSubTab.value =
          themeSummaryText.value && String(themeSummaryText.value).trim()
            ? 'markdown'
            : 'table'
      } else {
        await nextTick()
        if (
          themeSummaryText.value &&
          String(themeSummaryText.value).trim() &&
          resultTableRef.value?.showThemeTab
        ) {
          resultTableRef.value.showThemeTab()
        }
      }
    }

    const loadThemeTaskById = async () => {
      const id = resolvedTaskId.value
      if (!id) return
      resultViewLoading.value = true
      try {
        const res = await getTaskSchedulesAPI(id, { prefer_runtime: true })
        if (res.code !== 200 || !res.data) {
          ElMessage.error(res.message || '获取主题归纳任务详情失败')
          return
        }
        taskRuntimeNodes.value = []
        await loadTaskCenterPreviewSidebar(res.data)
        await loadThemeTaskFromScheduleDetail(res.data)
      } catch (e) {
        console.error(e)
        ElMessage.error(e?.message || '加载任务失败')
      } finally {
        resultViewLoading.value = false
      }
    }

    /** 流水线内可变的加载文案前缀（与 loadingTimer 闭包同步） */
    let pipelineLoadingPrefix = '正在执行信息提取...'

    const updateParseLoadingText = () => {
      loadingText.value = `${pipelineLoadingPrefix} ${loadingElapsedTime.value.toFixed(1)}s`
    }

    const stopThemeLoadingUi = () => {
      if (loadingTimer) {
        clearInterval(loadingTimer)
        loadingTimer = null
      }
      loadingText.value = ''
    }

    /**
     * 主题归纳第二步（biz_topic_summary）
     * @param {{ skipStandaloneLoading?: boolean, requireTable?: boolean, task_name?: string, task_notes?: string, taskCenterListAllFiles?: boolean }} opts
     * taskCenterListAllFiles：仅一键全流程第二步建议 true，任务中心按多文件展示；单独主题归纳为 false（实际入参为第一步联合表，一条子结果即可）
     * @returns {Promise<boolean>} 是否成功
     */
    const runTopicSummaryCore = async (opts = {}) => {
      const {
        skipStandaloneLoading = false,
        requireTable = true,
        task_name: topicTaskNameOpt,
        task_notes: topicTaskNotesOpt,
        taskCenterListAllFiles = false
      } = opts
      if (!duplicateFiles.value.length) {
        ElMessage.warning('请先添加文件')
        return false
      }
      const topicPrompt = (fileConfig.config.theme_summarization_project.prompt || '').trim()
      if (!topicPrompt) {
        ElMessage.warning('请填写主题归纳提示词（功能配置）')
        return false
      }
      if (requireTable) {
        const hasTable =
          (fileConfig.extractionRows && fileConfig.extractionRows.length > 0) ||
          (fileConfig.extractionColumns && fileConfig.extractionColumns.length > 0)
        if (!hasTable) {
          ElMessage.warning('请先在「功能配置」执行信息提取，生成表格后再运行主题归纳')
          return false
        }
      }

      const joint_table = {
        columns:
          Array.isArray(fileConfig.extractionColumns) && fileConfig.extractionColumns.length
            ? [...fileConfig.extractionColumns]
            : ['文件名'],
        rows: (fileConfig.extractionRows || []).map((r) => ({
          fileName: r.fileName || '',
          values: r.values && typeof r.values === 'object' ? { ...r.values } : {}
        }))
      }

      const buildTopicResultRow = (file) => {
        const fileUuid = getFileIdentifier(file) || file.id || file.file_uuid
        const fileType = file.type || 'pdf'
        const fileSize = String(file.file_size || file.size || 0)
        return {
          file_uuid: fileUuid,
          file_name: file.name || '未知',
          file_type: fileType,
          file_size: fileSize,
          parameter_template: topicPrompt,
          prompt_uuid: 'prompt',
          parameter_settings: {
            joint_table,
            topic_summary_prompt: topicPrompt
          }
        }
      }

      // 单独主题归纳：一条子结果（与「联合表单入参」一致）；一键全流程：多条，避免任务中心看起来像只处理了一个文件
      const topicScheduleResults = taskCenterListAllFiles
        ? duplicateFiles.value.map((file) => buildTopicResultRow(file))
        : [buildTopicResultRow(duplicateFiles.value[0])]
      if (topicScheduleResults.some((r) => !r.file_uuid)) {
        ElMessage.warning('无法解析部分文件的 ID')
        return false
      }

      const topicTaskName =
        (topicTaskNameOpt && String(topicTaskNameOpt).trim()) ||
        `主题归纳-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`
      const topicTaskNotes =
        topicTaskNotesOpt !== undefined && topicTaskNotesOpt !== null
          ? String(topicTaskNotesOpt)
          : ''

      if (!skipStandaloneLoading) {
        taskRuntimeNodes.value = []
        topicSummarizing.value = true
        loadingElapsedTime.value = 0
        pipelineLoadingPrefix = `${topicTaskName}执行中...`
        loadingText.value = `${pipelineLoadingPrefix} 0.0s`
        await nextTick()
        loadingTimer = setInterval(() => {
          loadingElapsedTime.value += 0.1
          updateParseLoadingText()
        }, 100)
      }
      viewerTab.value = 'parse'
      try {
        const taskData = {
          task_name: topicTaskName,
          tool_uuid: 'theme-analysis-topic-summary',
          tool_name: '主题归纳',
          file_num: String(topicScheduleResults.length),
          task_notes: topicTaskNotes,
          task_type: 5,
          task_switch: 2,
          biz_type: 'biz_topic_summary',
          task_schedule_results: topicScheduleResults
        }
        const response = await createTaskSchedulesAPI(taskData)
        if (response.code !== 200) {
          ElMessage.error(response.message || '主题归纳任务创建失败')
          return false
        }
        const taskUuid = resolveCreateTaskUuid(response)
        if (!taskUuid) {
          ElMessage.error('创建任务未返回 task_uuid')
          return false
        }
        // 先立即查一次并显示，避免空白等待
        const initialRes = await getTaskSchedulesAPI(taskUuid, { prefer_runtime: true })
        if (initialRes.code === 200 && initialRes.data) {
          applyTaskProgressFromDetail(initialRes.data)
        }
        const pr = await pollThemeTaskUntilTerminal(taskUuid, {
          onProgress: applyTaskProgressFromDetail
        })
        if (pr.timeout) {
          ElMessage.warning('等待主题归纳超时，请在任务中心查看进度')
          return false
        }
        if (!pr.ok) {
          ElMessage.error('主题归纳失败')
          return false
        }
        const detailPayload =
          pr.detail || (await getTaskSchedulesAPI(taskUuid, { prefer_runtime: true })).data
        const rawStr = pickFirstDisposalString(detailPayload)
        if (rawStr) {
          try {
            const parsed = JSON.parse(rawStr)
            themeSummaryText.value = formatTopicSummaryFromDifyContent(parsed)
          } catch {
            themeSummaryText.value = formatTopicSummaryFromDifyContent(rawStr)
          }
        }
        if (!skipStandaloneLoading) {
          ElMessage.success('主题归纳完成')
        }
        await nextTick()
        resultTableRef.value?.showThemeTab?.()
        return true
      } catch (error) {
        console.error('主题归纳失败:', error)
        ElMessage.error('主题归纳失败: ' + (error.message || '未知错误'))
        return false
      } finally {
        if (!skipStandaloneLoading) {
          stopThemeLoadingUi()
          topicSummarizing.value = false
        }
      }
    }

    /** 解析结果区单独点击「运行主题归纳」 */
    const executeTopicSummary = async () => {
      await runTopicSummaryCore({ skipStandaloneLoading: false, requireTable: true })
    }

    import { eventBus } from '@/utils/eventBus.js'
    /**
     * 信息提取（及可选连续主题归纳）实际执行逻辑，在任务信息弹框确认后调用
     * @param {'extractOnly' | 'extractAndSummarize'} mode
     * @param {string} taskName
     * @param {string} taskNotes
     */
    const runThemeExtractPipeline = async (mode, taskName, taskNotes) => {
      const extractionPrompt = (fileConfig.config.information_extraction_project.prompt || '').trim()
      const themePrompt = (fileConfig.config.theme_summarization_project.prompt || '').trim()

      // loadingElapsedTime.value = 0
      // pipelineLoadingPrefix =
      //   mode === 'extractAndSummarize'
      //     ? `${taskName} · 信息提取与主题归纳...`
      //     : `${taskName}执行中...`
      // loadingText.value = `${pipelineLoadingPrefix} 0.0s`
      // taskRuntimeNodes.value = []

      // extracting.value = true
      // viewerTab.value = 'parse'

      await nextTick()

      loadingTimer = setInterval(() => {
        loadingElapsedTime.value += 0.1
        updateParseLoadingText()
      }, 100)

      const taskScheduleResults = duplicateFiles.value.map((file) => {
        const fileUuid = getFileIdentifier(file) || file.id || file.file_uuid
        const fileType = file.type || 'pdf'
        const fileSize = String(file.file_size || file.size || 0)
        return {
          file_uuid: fileUuid,
          file_name: file.name || '未知文件',
          file_type: fileType,
          file_size: fileSize,
          parameter_template: extractionPrompt,
          prompt_uuid: 'prompt',
          parameter_settings: {
            mode: 'prompt',
            configured: true,
            theme_summarization_prompt: themePrompt
          }
        }
      })

      let extractOk = false

      try {
        const useCombinedPipeline = mode === 'extractAndSummarize'
        const taskData = {
          task_name: taskName,
          tool_uuid: useCombinedPipeline ? 'theme-analysis-combined' : 'theme-analysis-joint',
          tool_name: props.toolLabel,
          file_num: String(taskScheduleResults.length),
          task_notes: taskNotes,
          task_type: 5,
          task_switch: 2,
          biz_type: useCombinedPipeline
            ? THEME_EXTRACT_AND_TOPIC_BIZ_TYPE
            : THEME_INFO_EXTRACTION_BIZ_TYPE,
          task_schedule_results: taskScheduleResults
        }

        extracting.value = true
        const response = await createTaskSchedulesAPI(taskData)
        const createdUuid = resolveCreateTaskUuid(response)

        if (response.code === 200 && createdUuid) {
          if (createdUuid) {
            // 异步任务：通知父组件开始轮询
            eventBus.emit(props.eventKey, {
              taskUuid: createdUuid,
              taskName: taskName,
              taskOther: {
                mode: mode,
                taskName: taskName,
                taskNotes: taskNotes
              }
            })
            return
          }
          // 先立即查一次并显示，避免空白等待
          const initialRes = await getTaskSchedulesAPI(createdUuid, { prefer_runtime: true })
          if (initialRes.code === 200 && initialRes.data) {
            applyTaskProgressFromDetail(initialRes.data)
          }
          const pr = await pollThemeTaskUntilTerminal(createdUuid, {
            onProgress: applyTaskProgressFromDetail
          })
          if (pr.timeout) {
            ElMessage.warning(
              useCombinedPipeline
                ? '等待任务超时，请在任务中心查看进度'
                : '等待信息提取超时，请在任务中心查看进度'
            )
          } else if (!pr.ok) {
            ElMessage.error(useCombinedPipeline ? '信息提取或主题归纳失败' : '信息提取失败')
          } else {
            const detailPayload =
              pr.detail || (await getTaskSchedulesAPI(createdUuid, { prefer_runtime: true })).data
            const rawStr = pickFirstDisposalString(detailPayload)
            if (rawStr) {
              try {
                const parsed = JSON.parse(rawStr)
                if (parsed?.joint_table) {
                  applyJointTableFromContent(parsed)
                }
                if (parsed?.topic_summary != null) {
                  themeSummaryText.value = formatTopicSummaryFromDifyContent(parsed.topic_summary)
                }
              } catch {
                applyJointTableFromContent(rawStr)
              }
              extractOk = true
              if (mode === 'extractOnly') {
                ElMessage.success('信息提取完成')
              } else {
                ElMessage.success('信息提取与主题归纳已完成')
              }
              await nextTick()
              if (themeSummaryText.value?.trim() && resultTableRef.value?.showThemeTab) {
                resultTableRef.value.showThemeTab()
              }
            } else {
              ElMessage.warning('任务已完成但未解析到结果内容')
            }
          }
        } else {
          ElMessage.error(response.message || '任务创建失败')
        }
      } catch (error) {
        console.error('主题归纳信息提取失败:', error)
        ElMessage.error('执行失败: ' + (error.message || '未知错误'))
        extracting.value = false
      }

      stopThemeLoadingUi()
      extracting.value = false
    }

    const pickDisposalString = (detail) => {
      const list = detail || []
      const first = list[0]
      if (!first) return null
      const dr = first.disposal_result ?? first.DISPOSAL_RESULT
      if (dr == null || dr === '') return null
      return typeof dr === 'string' ? dr : String(dr)
    }

    const setResult = async(detailPayload, taskOther) => {
      const rawStr = pickDisposalString(detailPayload)
      if (rawStr) {
        try {
          const parsed = JSON.parse(rawStr)
          if (parsed?.joint_table) {
            applyJointTableFromContent(parsed)
          }
          if (parsed?.topic_summary != null) {
            themeSummaryText.value = formatTopicSummaryFromDifyContent(parsed.topic_summary)
          }
        } catch {
          applyJointTableFromContent(rawStr)
        }
        if (taskOther.mode === 'extractOnly') {
          ElMessage.success('信息提取完成')
        } else {
          ElMessage.success('信息提取与主题归纳已完成')
        }
        extracting.value = false
        viewerTab.value = 'parse'
        isLoadResult.value = true
        await nextTick()
        if (themeSummaryText.value?.trim() && resultTableRef.value?.showThemeTab) {
          resultTableRef.value.showThemeTab()
        }
      } else {
        ElMessage.warning('任务已完成但未解析到结果内容')
        extracting.value = false
        isLoadResult.value = false
      }
    }

    const taskError = () => {
      extracting.value = false
    }
    defineExpose({
      setResult,
      taskError
    })

    const confirmTaskMetaAndRun = async () => {
      const name = (taskMetaForm.taskName || '').trim()
      if (!name) {
        ElMessage.warning('请输入任务名称')
        return
      }
      const notes = (taskMetaForm.taskNotes || '').trim()
      const mode = pendingExecuteMode.value
      if (!mode) return
      pendingExecuteMode.value = null
      taskMetaDialogVisible.value = false
      await runThemeExtractPipeline(mode, name, notes)
    }

    /**
     * 统一执行入口：校验后弹出任务名称 / 备注，再执行
     * @param {{ mode: 'extractOnly' | 'extractAndSummarize' }} payload
     */
    const handleExecute = async (payload) => {
      // 无 mode 时与 ConfigPanel 单按钮一致：走「提取并主题归纳（至完成）」
      const mode = payload?.mode ?? 'extractAndSummarize'
      if (!duplicateFiles.value.length) {
        ElMessage.warning('请先添加至少一个文件')
        return
      }
      if (configPanelRef.value && !configPanelRef.value.validateRules()) {
        return
      }
      const extractionPrompt = (fileConfig.config.information_extraction_project.prompt || '').trim()
      if (!extractionPrompt) {
        ElMessage.warning('请填写信息提取提示词')
        return
      }
      if (mode === 'extractAndSummarize') {
        const themePrompt = (fileConfig.config.theme_summarization_project.prompt || '').trim()
        if (!themePrompt) {
          ElMessage.warning('「提取并主题归纳」需填写主题归纳提示词')
          return
        }
      }
      if (mode !== 'extractOnly' && mode !== 'extractAndSummarize') {
        return
      }

      pendingExecuteMode.value = mode
      taskMetaForm.taskName = buildDefaultThemeTaskName()
      taskMetaForm.taskNotes = ''
      taskMetaDialogVisible.value = true
    }

    // 初始化
    onMounted(async () => {
      if (resolvedTaskId.value) {
        await loadThemeTaskById()
        return
      }

      // 优先使用 props 参数，如果没有则使用路由参数
      const fileIds = props.files
      const fileNames = props.names

      if (fileIds && fileNames) {
        try {
          const ids = fileIds.split(',')
          const names = decodeURIComponent(fileNames).split(',')

          // 处理所有接收到的文件
          const receivedFiles = []

          // 根据接收到的文件信息创建文件列表
          for (let index = 0; index < ids.length; index++) {
            const id = ids[index]
            const fileName = names[index] || '文件' + (index + 1)
            const parts = fileName.split('.')
            const ext = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : ''
            let fileType = 'text'
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].indexOf(ext) !== -1) {
              fileType = 'image'
            } else if (ext === 'pdf') {
              fileType = 'pdf'
            } else if (ext === 'doc') {
              fileType = 'doc'
            } else if (ext === 'docx') {
              fileType = 'docx'
            } else if (ext === 'xlsx' || ext === 'xlsm') {
              fileType = ext === 'xlsm' ? 'xlsm' : 'xlsx'
            } else if (ext === 'xls') {
              fileType = 'xls'
            } else if (ext === 'csv') {
              fileType = 'csv'
            } else if (ext === 'txt') {
              fileType = 'txt'
            }

            // 创建文件对象（预览URL稍后通过API获取）
            const newFile = {
              id: id,
              name: fileName,
              type: fileType,
              previewUrl: '', // 初始为空，稍后通过API获取
              fileId: id,
              selected: false
            }

            receivedFiles.push(newFile)
          }

          // 将所有文件添加到文件列表
          if (receivedFiles.length > 0) {
            duplicateFiles.value = receivedFiles

            // 仅自动选择并预览第一个文件，其余文件在点击时按需获取预览URL
            if (duplicateFiles.value.length > 0) {
              await selectFile(duplicateFiles.value[0])
            }
          }
        } catch (error) {
          console.error('解析文件参数失败:', error)
        }
      }

    })

    watch(
      resolvedTaskId,
      async (id, prev) => {
        if (!id || id === prev) return
        await loadThemeTaskById()
      }
    )

  </script>

  <style scoped>
    .ocr-viewer {
      display: flex;
      align-items: stretch;
      height: calc(100vh - 75px);
      overflow: hidden;
      background: var(--sd-surface-1, #f4f4f4);
    }

    .ocr-viewer--embedded {
      height: 100%;
      flex: 1;
      min-height: 0;
    }

    .left-sidebar-shell :deep(.left-sidebar) {
      width: 100%;
      height: 100%;
      border-right: none;
      flex: 1;
      min-height: 0;
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

    .right-viewer-head .sidebar-tabs :deep(.el-tabs__header) {
      margin: 0;
    }

    .right-viewer-head .sidebar-tabs :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }

    .right-viewer-head__actions {
      flex-shrink: 0;
      margin-left: 12px;
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

    .ocr-viewer :deep(.ocr-sidebar-footer) > * + * {
      margin-left: 8px;
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

    .config-head-title {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
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

    .left-sidebar {
      width: 100%;
      height: 100%;
      background: var(--sd-canvas, #ffffff);
      border-right: 1px solid var(--sd-hairline, #e0e0e0);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 1;
      min-height: 0;
    }

    .file-header {
      margin-bottom: 0;
      justify-content: flex-start;
    }

    .file-header-toolbar {
      display: flex;
      align-items: center;
      width: 100%;
      min-width: 0;
    }

    .file-header-toolbar > * + * {
      margin-left: 8px;
    }

    .file-header-toolbar .ocr-file-search {
      flex: 1;
      min-width: 0;
    }

    .file-preview-toggle-btn {
      flex-shrink: 0;
    }

    .file-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 12px;
      overflow-y: auto;
      min-height: 0;
    }

    .file-list {
      position: relative;
      flex: 1;
      overflow-y: auto;
    }

    .file-item {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      margin-bottom: 3px;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s;
    }

    .file-item:hover {
      background: var(--sd-primary-light, #e8f0f8);
      color: var(--sd-primary, #195fb4);
    }

    .file-item.active {
      background: var(--sd-primary-light, #e8f0f8);
      color: var(--sd-primary, #195fb4);
    }

    .file-icon {
      margin-right: 6px;
      font-size: 16px;
      flex-shrink: 0;
    }

    .file-name {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .file-actions-bottom {
      flex-shrink: 0;
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

    .sidebar-tabs {
      flex-shrink: 0;
    }

    .sidebar-tabs.ocr-column-head {
      padding: 0 12px;
    }

    .sidebar-tabs.ocr-column-head :deep(.el-tabs__header) {
      margin: 0;
    }

    .sidebar-tabs.ocr-column-head :deep(.el-tabs__nav-wrap::after) {
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

    .config-panel-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      background: var(--sd-canvas, #ffffff);
    }

    /* 分隔线（调整宽度） */
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

    /* 拖拽时的样式 */
    :global(body.resizing) {
      user-select: none;
      cursor: col-resize;
    }

    :global(body.resizing) .resizer {
      background-color: #409eff;
      opacity: 1;
    }

    :global(body.resizing) .resize-icon {
      color: #fff;
    }

    :deep(.el-dialog__header) {
      padding-bottom: 0;
    }

    .field-mode-header {
      background: var(--sd-canvas, #ffffff);
    }
    .extraction-results {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .task-runtime-execute-panel {
      flex-shrink: 0;
      max-height: 45%;
      overflow-y: auto;
      padding: 12px;
      border-bottom: 1px solid #ebeef5;
    }

    .extraction-results.is-executing .task-runtime-execute-panel {
      flex: 1;
      max-height: none;
      border-bottom: none;
    }

    .task-runtime-elapsed {
      display: flex;
      align-items: center;
      font-size: 13px;
      color: #606266;
      margin-bottom: 12px;
    }

    .task-runtime-elapsed > * + * {
      margin-left: 8px;
    }

    .task-runtime-spin {
      color: #409eff;
      flex-shrink: 0;
    }

    .extraction-results-table-wrap {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .topic-summary-toolbar {
      flex-shrink: 0;
      padding-bottom: 10px;
    }

    .result-table-container {
      height: calc(100vh - 185px);
    }
  </style>
