<template>
  <div
    class="ocr-viewer"
    v-loading="resultViewLoading"
    element-loading-text="加载任务结果..."
  >
    <!-- 左侧文件列表（可拖拽调宽） -->
    <div
      class="left-sidebar-shell resizable-left-sidebar"
      :style="{ width: leftSidebarWidth + 'px' }"
    >
    <div class="left-sidebar">
      <div class="left-sidebar-top">
        <span class="file-title">文件</span>
      </div>
      <!-- 文件一 -->
      <div class="file-section">
        <div class="file-header-row">
          <el-input
            v-model="tableLabels.table1"
            class="file-title-input"
            size="small"
            maxlength="20"
            placeholder="文件一"
            :readonly="isResultViewMode"
          />
          <el-button
            v-if="!isResultViewMode"
            class="ocr-select-files-btn"
            size="small"
            @click="handleSelectFile('duplicate')"
          >
            选择文件
          </el-button>
        </div>

        <div class="file-list">
          <div
            v-if="duplicateFile"
            :class="['file-item', { active: isFileActive(duplicateFile) }]"
            @click="selectFile(duplicateFile)"
          >
            <el-icon class="file-icon"><Document /></el-icon>
            <span class="file-name">{{ duplicateFile.name }}</span>
            <!-- 删除按钮 -->
            <el-button
              v-if="!isResultViewMode"
              type="danger"
              :icon="Delete"
              size="small"
              text
              @click.stop="handleDeleteFile('duplicate')"
              style="margin-left: auto;"
              title="删除文件"
            />
          </div>
          <!-- 空状态 -->
          <el-empty
            v-else
            :description="`请选择${table1Label}文件`"
            :image-size="60"
            style="padding: 20px 0;"
          />
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="section-divider"></div>

      <!-- 文件二 -->
      <div class="file-section">
        <div class="file-header-row">
          <el-input
            v-model="tableLabels.table2"
            class="file-title-input"
            size="small"
            maxlength="20"
            placeholder="文件二"
            :readonly="isResultViewMode"
          />
          <el-button
            v-if="!isResultViewMode"
            class="ocr-select-files-btn"
            size="small"
            @click="handleSelectFile('main')"
          >
            选择文件
          </el-button>
        </div>

        <div class="file-list">
          <div
            v-if="mainFile"
            :class="['file-item', { active: isFileActive(mainFile) }]"
            @click="selectFile(mainFile)"
          >
            <el-icon class="file-icon"><Document /></el-icon>
            <span class="file-name">{{ mainFile.name }}</span>
            <!-- 删除按钮 -->
            <el-button
              v-if="!isResultViewMode"
              type="danger"
              :icon="Delete"
              size="small"
              text
              @click.stop="handleDeleteFile('main')"
              style="margin-left: auto;"
              title="删除文件"
            />
          </div>
          <!-- 空状态 -->
          <el-empty
            v-else
            :description="`请选择${table2Label}文件`"
            :image-size="60"
            style="padding: 20px 0;"
          />
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
  
      <!-- 右侧面板（不再提供中间文件预览，避免大表在 Chrome77 整文件解析崩溃） -->
      <div class="right-viewer right-viewer-fullwidth">
        <!-- 标签页 -->
        <div class="sidebar-tabs ocr-column-head">
          <el-tabs v-model="viewerTab" class="sidebar-tabs__nav" @tab-change="handleTabChange">
            <el-tab-pane label="解析结果" name="parse"></el-tab-pane>
            <el-tab-pane label="功能配置" name="extract"></el-tab-pane>
          </el-tabs>
          <el-button
            type="primary"
            :icon="List"
            size="small"
            class="sidebar-tabs__task-btn"
            @click="handleGoToTaskCenter"
          >
            任务中心
          </el-button>
          <el-button
            v-if="!isResultViewMode"
            type="primary"
            size="small"
            class="sidebar-tabs__execute-btn"
            :loading="extracting || backgroundExtracting"
            @click="handleConfigExecute"
          >
            执行
          </el-button>
        </div>
        <!-- 解析结果：有结果或任务回看/执行中时才展示 -->
        <div
          class="right-sidebar"
          v-show="viewerTab === 'parse'"
        >
          <div
            v-if="showResultPanel"
            class="extraction-results"
          >
            <el-alert
              v-if="taskResultLoadError"
              type="error"
              :title="taskResultLoadError"
              show-icon
              :closable="false"
              style="margin-bottom: 12px"
            />
            <el-empty
              v-else-if="isResultViewMode && awaitingTaskResults"
              description="任务执行中，请稍候…"
              :image-size="80"
            />
            <ResultTable
              v-else-if="hasCompareResults || isResultViewMode"
              :allResult="fileConfig.result"
              :table1-label="table1Label"
              :table2-label="table2Label"
              :column-schema="resultColumnSchema"
              :task-id="resolvedTaskId"
            />
            <div v-else-if="awaitingTaskResults" class="result-loading-hint">
              正在对比分析中，请稍候…
            </div>
          </div>
          <el-empty
            v-else
            class="result-empty-placeholder"
            description="请先上传文件并执行对比，完成后在此查看结果"
            :image-size="80"
          />
        </div>
        <!-- 功能配置：显示字段模式配置 -->
        <div
          class="right-sidebar"
          v-show="viewerTab === 'extract'"
        >
            <ConfigPanel
                ref="configPanelRef"
                v-model:prompt="fileConfig.config"
                :table-labels="tableLabels"
                :table1-columns="table1SourceColumns"
                :table2-columns="table2SourceColumns"
                :loading="extracting"
                :no-execute="true"
                :readonly="isResultViewMode"
                @backgroundExecution="backgroundExecution"
            />
        </div>
      </div>
    </div>
    
    <!-- 文件选择对话框 -->
    <FileSelectDialog 
      v-model="fileSelectDialogVisible" 
      @confirm="onFileSelectConfirm"
      :singleSelect="true"
      :can-select-file-type="['.xlsx', '.xls', '.csv']"
    />

    
    <!-- 执行弹框 -->
    <el-dialog
      v-model="backgroundExecutionDialogVisible"
      title="执行"
      width="900px"
      :close-on-click-modal="false"
      class="batch-recognize-dialog"
    >
      <div class="batch-recognize-content">
        <!-- 任务参数输入区域 -->
        <div class="task-params-section" style="margin-bottom: 20px;">
          <el-form label-width="100px">
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
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleBackgroundExecutionCancel">取消</el-button>
          <el-button type="primary" @click="handleBackgroundExecutionConfirm" :loading="backgroundExtracting">
            创建任务
          </el-button>
        </span>
      </template>
    </el-dialog>
</template>
  
<script setup>
  import { ref, onMounted, onUnmounted, onBeforeUnmount, nextTick, reactive, computed, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
  import { useHomeStore } from '@/stores/home'
  import { eventBus } from '@/utils/eventBus.js'
  import { createTaskSchedulesAPI, getTaskSchedulesAPI } from '@/api/task.js'
  import { openTaskCenterWithRefresh } from './composables/batchExecuteTimeoutNav.js'
  import { resolveScheduleTaskFailureMessage } from '@/composables/useScheduleTaskProgress.js'
  
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
    toolLabel: {
      type: String,
      default: '两表项目关联度'
    },
    eventKey: {
      type: String,
      default: 'file-manager-progress-start'
    },
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
  
  // 定义 emits
  // eslint-disable-next-line no-unused-vars
  const emit = defineEmits(['close-dialog'])
  
  import FileSelectDialog from '@/components/common/FileSelectDialog.vue'
  import ConfigPanel from './components/AssociationTwoTables/ConfigPanel.vue'
  import ResultTable from './components/AssociationTwoTables/ResultTable.vue'
  import {
    createEmptyAssociationConfig,
    ASSOCIATION_BIZ_TYPE,
    ASSOCIATION_TOOL_UUID,
    ASSOCIATION_TASK_TYPE,
    buildCompareConfigForApi,
    migrateLegacyComparePrompt
  } from './components/AssociationTwoTables/associationTwoTablesConstants.js'
  import {
    mapAssociationDisposalResult,
    resolveAssociationDisposalFromDetail
  } from '@/utils/associationTwoTablesResultMapper.js'
  import { buildColumnSchema } from '@/utils/associationTwoTablesColumnSchema.js'
  import {
    readSpreadsheetColumnHeaders,
    extractRealSourceColumns
  } from '@/utils/excel/readSpreadsheetColumnHeaders.js'
  import {
    Document,
    // eslint-disable-next-line no-unused-vars
    Crop,
    // eslint-disable-next-line no-unused-vars
    DataLine,
    Delete,
    DArrowRight,
    List
  } from '@element-plus/icons-vue'

  const emptyResult = () => ({ yz: [], bwqyz: [], ggdyxm: [], tzxmzxsp: [] })

  defineOptions({
    name: 'AssociationDegreeTwoTablesViewer',
  })

  const router = useRouter()
  const route = useRoute()
  const homeStore = useHomeStore()

  const resolvedTaskId = computed(() => {
    const fromProp = props.taskId != null && String(props.taskId).trim() !== '' ? String(props.taskId) : ''
    if (fromProp) return fromProp
    const q = route.query?.taskId ?? route.query?.task_id
    return q != null && String(q).trim() !== '' ? String(q) : ''
  })
  const isResultViewMode = computed(() => !!resolvedTaskId.value)
  const isViewerActive = ref(false)
  const awaitingTaskResults = ref(false)
  const taskResultLoadError = ref('')
  const resultViewLoading = ref(false)

  const DEFAULT_TABLE_LABELS = { table1: '文件一', table2: '文件二' }
  const tableLabels = reactive({ ...DEFAULT_TABLE_LABELS })
  const table1Label = computed(
    () => String(tableLabels.table1 || DEFAULT_TABLE_LABELS.table1).trim() || DEFAULT_TABLE_LABELS.table1
  )
  const table2Label = computed(
    () => String(tableLabels.table2 || DEFAULT_TABLE_LABELS.table2).trim() || DEFAULT_TABLE_LABELS.table2
  )

  // 两个独立的文件对象（duplicate=表一，main=表二）
  const duplicateFile = ref(null)
  const mainFile = ref(null)

  // 当前选择区域类型
  const currentSelectType = ref('duplicate') // 'duplicate' | 'main'

  // 识别配置映射表
  const fileConfig = reactive({
    config: createEmptyAssociationConfig(),
    result: emptyResult()
  })

  const resultColumnSchema = ref(buildColumnSchema(null, {}))

  /** 配置下拉用列名（禁止 DEFAULT 兜底） */
  const table1SourceColumns = ref([])
  const table2SourceColumns = ref([])
  const table1ColumnsLoadToken = ref(0)
  const table2ColumnsLoadToken = ref(0)

  /**
   * 异步加载表头到指定槽位；fileId 变化时丢弃过期结果
   * @param {'table1'|'table2'} slot
   * @param {object|null} file
   * @returns {Promise<void>}
   */
  const loadTableSourceColumns = async (slot, file) => {
    const isTable1 = slot === 'table1'
    const columnsRef = isTable1 ? table1SourceColumns : table2SourceColumns
    const tokenRef = isTable1 ? table1ColumnsLoadToken : table2ColumnsLoadToken
    tokenRef.value += 1
    const token = tokenRef.value
    const expectedId = file ? getFileIdentifier(file) : null

    if (!file) {
      columnsRef.value = []
      return
    }

    columnsRef.value = []
    try {
      const result = await readSpreadsheetColumnHeaders(file)
      if (token !== tokenRef.value) return
      const current = isTable1 ? duplicateFile.value : mainFile.value
      if (getFileIdentifier(current) !== expectedId) return
      const headers = Array.isArray(result?.headers) ? result.headers : []
      columnsRef.value = headers
      if (result?.tooLarge) {
        ElMessage.warning(result.message || '文件过大，无法自动读取列名，请手动输入')
      } else if (!headers.length && result?.message) {
        // 不阻断选文件；列名可手输，仅给出中文提示（避免全局「Not Found」）
        ElMessage.warning(result.message)
      }
    } catch (e) {
      console.warn(`[AssociationDegreeTwoTables] 读取${slot}表头失败:`, e)
      if (token === tokenRef.value) columnsRef.value = []
    }
  }

  /**
   * 仅用真实 source_columns 填充配置下拉（禁止 buildColumnSchema / DEFAULT）
   * @param {object|null|undefined} disposalOrCompare
   * @returns {void}
   */
  const applyRealSourceColumnsFromResult = (disposalOrCompare) => {
    const { table1, table2 } = extractRealSourceColumns(disposalOrCompare)
    if (table1.length) table1SourceColumns.value = table1
    if (table2.length) table2SourceColumns.value = table2
  }

  const refreshResultColumnSchema = (compareResponse, configOverride) => {
    const cfg = configOverride || fileConfig.config?.compare_config || {}
    resultColumnSchema.value = buildColumnSchema(compareResponse, cfg)
  }

  const hasCompareResults = computed(() => {
    const r = fileConfig.result
    return [r.yz, r.bwqyz, r.ggdyxm, r.tzxmzxsp].some(
      (arr) => Array.isArray(arr) && arr.length > 0
    )
  })

  const showResultPanel = computed(
    () => hasCompareResults.value || awaitingTaskResults.value || isResultViewMode.value
  )
  
  // 当前文件（用于预览）
  const currentFile = ref(null)

  // 获取文件的唯一标识符（统一函数，确保一致性）
  const getFileIdentifier = (file) => {
    if (!file) return null
    const identifier = file.fileId
    return identifier
  }

  // 删除文件
  const handleDeleteFile = (type) => {
    const file = type === 'duplicate' ? duplicateFile.value : mainFile.value
    const fileName = file ? file.name : '文件'
    const fileLabel = type === 'duplicate' ? table1Label.value : table2Label.value
    
    ElMessageBox.confirm(
      `确定要删除${fileLabel}文件 "${fileName}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => {
      if (type === 'duplicate') {
        duplicateFile.value = null
        table1SourceColumns.value = []
        table1ColumnsLoadToken.value += 1
      } else {
        mainFile.value = null
        table2SourceColumns.value = []
        table2ColumnsLoadToken.value += 1
      }

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

  // 无任务时默认功能配置，有任务回看时默认解析结果
  const viewerTab = ref(resolvedTaskId.value ? 'parse' : 'extract')

  /** 左侧面板宽度约束 */
  const LEFT_SIDEBAR_WIDTH_MIN = 200
  const LEFT_SIDEBAR_WIDTH_MAX = 560
  const savedLeftSidebarWidth = localStorage.getItem('ocr-viewer-left-sidebar-width')
  const parsedLeftSidebarW = savedLeftSidebarWidth ? parseInt(savedLeftSidebarWidth, 10) : NaN
  const initialLeftSidebarW = Number.isFinite(parsedLeftSidebarW) ? parsedLeftSidebarW : 320
  const leftSidebarWidth = ref(
    Math.min(LEFT_SIDEBAR_WIDTH_MAX, Math.max(LEFT_SIDEBAR_WIDTH_MIN, initialLeftSidebarW))
  )
  const isResizingLeft = ref(false)
  const leftResizeStartX = ref(0)
  const leftResizeStartWidth = ref(0)
  const fileSelectDialogVisible = ref(false)

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

  /*
   *右侧配置
  */
  const extracting = ref(false)
  const extractionResults = ref([])
  const backgroundExtracting = ref(false)
  
  // 加载计时器相关
  const loadingElapsedTime = ref(0) // 已经过的秒数
  const loadingText = ref('正在解析中... 0.0s') // 加载文本
  let loadingTimer = null // 定时器引用
  let loadingInstance = null // ElLoading 实例
  
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

  // 选择文件（仅高亮左侧选中态，不再打开前端预览）
  const selectFile = async (file) => {
    if (!file) return
    currentFile.value = file
    extractionResults.value = []
  }

  // 打开文件选择对话框
  const handleSelectFile = (type) => {
    if (isResultViewMode.value) return
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
      // 只取第一个文件
      const item = items[0]
      
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
      
      // 创建文件对象
      const newFile = {
        id: item.file_id || Date.now() + Math.random(),
        name: fileName,
        type: fileType,
        previewUrl: '',
        fileId: item.file_id,
        file_size: item.file_size || 0,
        selected: false
      }

      // 根据选择类型设置文件
      if (currentSelectType.value === 'duplicate') {
        duplicateFile.value = newFile
        await loadTableSourceColumns('table1', newFile)
      } else {
        mainFile.value = newFile
        await loadTableSourceColumns('table2', newFile)
      }

      await selectFile(newFile)

      // 关闭对话框
      fileSelectDialogVisible.value = false
    } catch (error) {
      console.error('添加文件失败:', error)
      ElMessage.error('添加文件失败: ' + (error.message || '未知错误'))
    }
  }

  onUnmounted(() => {
    if (isResizingLeft.value) {
      stopLeftSidebarResize()
    }
  })

  // 标签切换
  const handleTabChange = (tab) => {
    console.log('切换到标签:', tab)
  }
  
  // 处理按钮 - 跳转任务中心（带 refresh_ts，配合任务中心 keepAlive 刷新列表）
  const handleGoToTaskCenter = () => {
    openTaskCenterWithRefresh(router, homeStore)
  }
  
  // eslint-disable-next-line no-unused-vars
  const handleChartRecognition = () => {
    ElMessage.info('图表识别功能（演示模式）')
  }
  
  // eslint-disable-next-line no-unused-vars
  const handleStampRecognition = () => {
    ElMessage.info('印章识别功能（演示模式）')
  }
  
  const validateFilesReady = () => {
    if (!duplicateFile.value || !mainFile.value) {
      ElMessage.warning(`请先选择${table1Label.value}与${table2Label.value}两个文件`)
      return false
    }
    if (configPanelRef.value && !configPanelRef.value.validateRules()) {
      return false
    }
    return true
  }

  const buildDefaultTaskName = () => {
    const t1 = duplicateFile.value?.name?.replace(/\.[^/.]+$/, '') || table1Label.value
    const t2 = mainFile.value?.name?.replace(/\.[^/.]+$/, '') || table2Label.value
    return `两表关联度-${t1}_vs_${t2}`
  }

  const buildFileSlotFromTableRef = (tableRef, fallbackName) => {
    if (!tableRef || typeof tableRef !== 'object') return null
    const fileId = String(tableRef.file_uuid || tableRef.fileUuid || '').trim()
    const name = String(tableRef.filename || tableRef.file_name || fallbackName || '文件')
    if (!fileId && !name) return null
    const parts = name.split('.')
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'xlsx'
    return {
      id: fileId || name,
      name,
      type: ext,
      previewUrl: tableRef.url || tableRef.preview_url || '',
      fileId: fileId || name,
      selected: false
    }
  }

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

  const restoreFilesFromTaskDetail = async (taskDetail) => {
    const resultList = taskDetail?.task_schedule_result_list || []
    const first = resultList[0]
    if (!first) return
    const ps = parseParameterSettings(first.parameter_settings ?? first.PARAMETER_SETTINGS)
    const table1 = ps.table1 || {}
    const table2 = ps.table2 || {}
    if (ps.table_labels && typeof ps.table_labels === 'object') {
      tableLabels.table1 = String(ps.table_labels.table1 || DEFAULT_TABLE_LABELS.table1).trim() || DEFAULT_TABLE_LABELS.table1
      tableLabels.table2 = String(ps.table_labels.table2 || DEFAULT_TABLE_LABELS.table2).trim() || DEFAULT_TABLE_LABELS.table2
    }
    const file1 = buildFileSlotFromTableRef(table1, table1Label.value)
    const file2 = buildFileSlotFromTableRef(table2, table2Label.value)
    if (file1) duplicateFile.value = file1
    if (file2) mainFile.value = file2
    if (ps.config || ps.compare_prompt) {
      fileConfig.config = migrateLegacyComparePrompt({
        compare_prompt: ps.compare_prompt || createEmptyAssociationConfig().compare_prompt,
        compare_config: ps.config || createEmptyAssociationConfig().compare_config
      })
    }
    // 仅真实 source_columns；无则尝试从文件解析（只读下拉可不依赖，但 mapping 回显仍可用）
    const realFromPs = extractRealSourceColumns(ps.config || ps)
    if (realFromPs.table1.length) {
      table1SourceColumns.value = realFromPs.table1
    } else if (file1 && !isResultViewMode.value) {
      await loadTableSourceColumns('table1', file1)
    } else {
      table1SourceColumns.value = []
    }
    if (realFromPs.table2.length) {
      table2SourceColumns.value = realFromPs.table2
    } else if (file2 && !isResultViewMode.value) {
      await loadTableSourceColumns('table2', file2)
    } else {
      table2SourceColumns.value = []
    }
    if (duplicateFile.value) {
      currentFile.value = duplicateFile.value
    }
  }

  const buildTaskScheduleResult = () => {
    const table1Id = getFileIdentifier(duplicateFile.value)
    const table2Id = getFileIdentifier(mainFile.value)
    const mergedConfig = buildCompareConfigForApi(fileConfig.config?.compare_config)
    return {
      file_uuid: table1Id,
      file_name: duplicateFile.value?.name || table1Label.value,
      file_type: duplicateFile.value?.type || 'xlsx',
      file_size: String(duplicateFile.value?.file_size || duplicateFile.value?.size || 0),
      parameter_template: '{}',
      prompt_uuid: 'prompt',
      parameter_settings: {
        table1: {
          file_uuid: table1Id,
          filename: duplicateFile.value?.name || table1Label.value
        },
        table2: {
          file_uuid: table2Id,
          filename: mainFile.value?.name || table2Label.value
        },
        table_labels: {
          table1: table1Label.value,
          table2: table2Label.value
        },
        config: mergedConfig,
        compare_prompt: fileConfig.config?.compare_prompt || {}
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
  const startResultLoading = async () => {
    loadingElapsedTime.value = 0
    loadingText.value = '正在对比分析中... 0.0s'
    extracting.value = true
    awaitingTaskResults.value = true
    viewerTab.value = 'parse'
    await nextTick()
    const targetElement = document.querySelector('.extraction-results')
    if (targetElement) {
      loadingInstance = ElLoading.service({
        target: targetElement,
        text: loadingText.value,
        spinner: 'el-icon-loading'
      })
      loadingTimer = setInterval(() => {
        loadingElapsedTime.value += 0.1
        const newText = `正在对比分析中... ${loadingElapsedTime.value.toFixed(1)}s`
        loadingText.value = newText
        if (loadingInstance && loadingInstance.$el) {
          const textElement = loadingInstance.$el.querySelector('.el-loading-text')
          if (textElement) textElement.textContent = newText
        }
      }, 100)
    }
  }

  const stopResultLoading = () => {
    if (loadingTimer) {
      clearInterval(loadingTimer)
      loadingTimer = null
    }
    if (loadingInstance) {
      loadingInstance.close()
      loadingInstance = null
    }
    extracting.value = false
  }

  const runCreateTask = async (name, remark) => {
    if (!validateFilesReady()) return false
    isViewerActive.value = true
    const taskData = {
      task_name: name || buildDefaultTaskName(),
      tool_uuid: ASSOCIATION_TOOL_UUID,
      tool_name: props.toolLabel || '两表项目关联度',
      file_num: '2',
      task_notes: remark || '',
      task_type: ASSOCIATION_TASK_TYPE,
      task_switch: 2,
      biz_type: ASSOCIATION_BIZ_TYPE,
      task_schedule_results: [buildTaskScheduleResult()]
    }
    const response = await createTaskSchedulesAPI(taskData)
    if (response.code === 200 || response.code === 201) {
      const taskUuid = response?.data?.task_uuid || response?.task_uuid || ''
      const resolvedName = taskData.task_name
      if (taskUuid && props.eventKey && isViewerActive.value) {
        eventBus.emit(props.eventKey, { taskUuid, taskName: resolvedName })
      }
      ElMessage.success(`任务"${resolvedName}"创建成功`)
      return true
    }
    ElMessage.error(response.message || '任务创建失败')
    return false
  }

  const taskName = ref('')
  const taskRemark = ref('')
  const backgroundExecutionDialogVisible = ref(false)

  const backgroundExecution = async () => {
    if (!validateFilesReady()) return
    taskName.value = buildDefaultTaskName()
    backgroundExecutionDialogVisible.value = true
  }

  /**
   * 顶栏「执行」：先校验配置再打开任务弹窗
   * @returns {void}
   */
  const handleConfigExecute = () => {
    if (!configPanelRef.value || typeof configPanelRef.value.validateRules !== 'function') {
      backgroundExecution()
      return
    }
    if (!configPanelRef.value.validateRules()) return
    backgroundExecution()
  }

  const handleBackgroundExecutionCancel = () => {
    backgroundExecutionDialogVisible.value = false
    taskName.value = ''
    taskRemark.value = ''
  }

  const handleBackgroundExecutionConfirm = async () => {
    if (!taskName.value.trim()) {
      ElMessage.warning('请输入任务名称')
      return
    }
    backgroundExtracting.value = true
    try {
      const ok = await runCreateTask(taskName.value.trim(), taskRemark.value)
      if (ok) {
        taskName.value = ''
        taskRemark.value = ''
        backgroundExecutionDialogVisible.value = false
      }
    } catch (error) {
      console.error('创建任务失败:', error)
      ElMessage.error('创建任务失败: ' + (error.message || '未知错误'))
    } finally {
      backgroundExtracting.value = false
    }
  }

  const clearAssociationResults = () => {
    Object.assign(fileConfig.result, emptyResult())
  }

  const buildResultTaskConfig = (disposal) => {
    const baseConfig =
      disposal?.config ||
      fileConfig.config?.compare_config ||
      {}
    return {
      ...baseConfig,
      table_labels: {
        ...(baseConfig.table_labels || {}),
        table1: table1Label.value,
        table2: table2Label.value
      }
    }
  }

  const applyAssociationDisposalResult = (disposal) => {
    const compareResponse = disposal?.compare_response || disposal
    const taskConfig = buildResultTaskConfig(disposal)
    refreshResultColumnSchema(compareResponse, taskConfig)
    applyRealSourceColumnsFromResult(disposal)
    const mapped = mapAssociationDisposalResult(disposal, { config: taskConfig })
    fileConfig.result.yz = mapped.yz
    fileConfig.result.bwqyz = mapped.bwqyz
    fileConfig.result.ggdyxm = mapped.ggdyxm
    fileConfig.result.tzxmzxsp = mapped.tzxmzxsp
    if (mapped.columnSchema) {
      resultColumnSchema.value = mapped.columnSchema
    }
  }

  const setResult = async (detailPayload) => {
    taskResultLoadError.value = ''
    awaitingTaskResults.value = false
    stopResultLoading()
    const disposal = resolveAssociationDisposalFromDetail(detailPayload)
    if (!disposal) {
      clearAssociationResults()
      taskResultLoadError.value = '任务已完成但未解析到结果内容'
      if (!isResultViewMode.value) {
        ElMessage.warning('任务已完成但未解析到结果内容')
      }
      return
    }
    try {
      applyAssociationDisposalResult(disposal)
      viewerTab.value = 'parse'
      if (!isResultViewMode.value) {
        ElMessage.success('两表项目关联度分析完成')
      }
    } catch (e) {
      console.error('解析结果失败:', e)
      clearAssociationResults()
      const detail = e?.message ? String(e.message) : ''
      taskResultLoadError.value = detail ? `解析结果失败：${detail}` : '解析结果失败'
      ElMessage.error(taskResultLoadError.value)
    }
  }

  /**
   * 标记任务执行失败（供外层轮询）
   * @param {string} [message] 具体失败原因（来自 ERROR_MESSAGE）
   */
  const taskError = (message) => {
    awaitingTaskResults.value = false
    stopResultLoading()
    const msg = (message && String(message).trim()) || '任务执行失败'
    taskResultLoadError.value = msg
    if (!isResultViewMode.value) {
      ElMessage.error(msg)
    }
  }

  const loadAssociationTaskById = async () => {
    const id = resolvedTaskId.value
    if (!id) return
    resultViewLoading.value = true
    taskResultLoadError.value = ''
    viewerTab.value = 'parse'
    try {
      const res = await getTaskSchedulesAPI(id, {
        prefer_runtime: true,
        include_results: true
      })
      if (res.code !== 200 || !res.data) {
        taskResultLoadError.value = res.message || '获取任务详情失败'
        return
      }
      const td = res.data
      await restoreFilesFromTaskDetail(td)
      const st = Number(td.task_status)
      const resultList = td.task_schedule_result_list || []
      if (st === 3) {
        awaitingTaskResults.value = false
        stopResultLoading()
        taskResultLoadError.value = resolveScheduleTaskFailureMessage(td)
        clearAssociationResults()
        return
      }
      if (st !== 2) {
        awaitingTaskResults.value = true
        if (props.eventKey && isViewerActive.value && st !== 3) {
          eventBus.emit(props.eventKey, {
            taskUuid: id,
            taskName: td.task_name || td.TASK_NAME || '两表项目关联度'
          })
        }
        return
      }
      awaitingTaskResults.value = false
      await setResult(resultList)
    } catch (e) {
      console.error(e)
      taskResultLoadError.value = e?.message || '加载任务失败'
      clearAssociationResults()
    } finally {
      resultViewLoading.value = false
    }
  }

  watch(resolvedTaskId, async (id, prev) => {
    if (!id || id === prev) return
    await loadAssociationTaskById()
  })

  onBeforeUnmount(() => {
    isViewerActive.value = false
    stopResultLoading()
  })

  defineExpose({
    setResult,
    taskError
  })

  // 初始化
  onMounted(async () => {
    isViewerActive.value = true
    if (resolvedTaskId.value) {
      await loadAssociationTaskById()
      return
    }
    viewerTab.value = 'extract'
    // 优先使用 props 参数，如果没有则使用路由参数
    const fileIds = props.files
    const fileNames = props.names
  
    if (fileIds && fileNames) {
      try {
        const ids = fileIds.split(',')
        const names = decodeURIComponent(fileNames).split(',')
  
        // 只取前两个文件
        const filesToProcess = Math.min(2, ids.length)
        const receivedFiles = []
        
        // 根据接收到的文件信息创建文件列表（最多2个）
        for (let index = 0; index < filesToProcess; index++) {
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
  
          // 创建文件对象
          const newFile = {
            id: id,
            name: fileName,
            type: fileType,
            previewUrl: '',
            fileId: id,
            selected: false
          }

          receivedFiles.push(newFile)
        }

        // 分配文件到两个区域
        if (receivedFiles.length > 0) {
          // 第一个文件放到工改项目区域
          duplicateFile.value = receivedFiles[0]

          // 第二个文件（如果存在）放到投资项目在线审批项目区域
          if (receivedFiles.length > 1) {
            mainFile.value = receivedFiles[1]
          }

          if (duplicateFile.value) {
            await loadTableSourceColumns('table1', duplicateFile.value)
          }
          if (mainFile.value) {
            await loadTableSourceColumns('table2', mainFile.value)
          }

          if (duplicateFile.value) {
            await selectFile(duplicateFile.value)
          }
        }
      } catch (error) {
        console.error('解析文件参数失败:', error)
      }
    }
    
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
  
  /* 左侧边栏 */
  .left-sidebar {
    width: 100%;
    height: 100%;
    background: var(--sd-canvas, #ffffff);
    border-right: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
    min-height: 0;
  }

  .left-sidebar-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 12px 0;
    flex-shrink: 0;
    min-height: 44px;
    box-sizing: border-box;
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
    background: var(--sd-hairline, #e0e0e0);
    margin: 0;
    flex-shrink: 0;
  }
  
  .file-header-row {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    flex-shrink: 0;
    height: 32px;
    min-height: 32px;
  }

  .file-header-row > * + * {
    margin-left: 8px;
  }
  
  .file-title-input {
    flex: 1;
    min-width: 0;
    height: 32px;
  }

  .file-title-input :deep(.el-input) {
    height: 32px;
    line-height: 32px;
  }

  .file-title-input :deep(.el-input__wrapper) {
    height: 32px;
    min-height: 32px;
    max-height: 32px;
    box-sizing: border-box;
    padding-top: 0;
    padding-bottom: 0;
  }

  .file-title-input :deep(.el-input__inner) {
    height: 30px;
    line-height: 30px;
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }

  .file-header-row .ocr-select-files-btn {
    flex-shrink: 0;
    height: 32px;
    min-height: 32px;
    max-height: 32px;
    line-height: 30px;
    padding: 0 10px;
    box-sizing: border-box;
    color: var(--sd-primary, #195fb4);
    border: 1px solid var(--sd-primary, #195fb4);
    background: var(--sd-canvas, #ffffff);
  }

  .file-header-row .ocr-select-files-btn:hover,
  .file-header-row .ocr-select-files-btn:focus {
    color: var(--sd-primary-dark, #0f4a8c);
    border-color: var(--sd-primary-dark, #0f4a8c);
    background: var(--sd-primary-light, #e8f0f8);
  }

  .file-title {
    font-size: 13px;
    font-weight: 500;
    color: #303133;
  }
  
  .file-actions {
    display: flex;
    align-items: center;
  }

  .file-actions > * + * {
    margin-left: 8px;
  }
  
  .search-area {
    margin-bottom: 10px;
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
  }

  .file-item > * + * {
    margin-left: 8px;
  }
  
  .file-item:hover {
    background: #f5f7fa;
  }
  
  .file-item.active {
    background: var(--sd-primary-light, #e8f0f8);
    color: var(--sd-primary, #195fb4);
  }
  
  .batch-actions-bar {
    display: flex;
    flex-direction: column;
  }

  .batch-actions-bar > * + * {
    margin-top: 8px;
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
    padding: 12px;
    border-top: 1px solid var(--sd-hairline, #e0e0e0);
    background: var(--sd-canvas, #ffffff);
    flex-shrink: 0;
  }

  .file-actions-bottom > * + * {
    margin-left: 6px;
  }
  
  .storage-info {
    padding-top: 12px;
    border-top: 1px solid var(--sd-hairline, #e0e0e0);
    display: flex;
    flex-direction: column;
  }

  .storage-info > * + * {
    margin-top: 6px;
  }
  
  .storage-text {
    font-size: 11px;
    color: #909399;
  }
  
  /* 右侧面板标签页（铺满剩余空间，不再挂中间文件预览） */
  .right-viewer{
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 260px;
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
    justify-content: space-between;
  }

  .sidebar-tabs__nav {
    flex: 1;
    min-width: 0;
  }

  .sidebar-tabs.ocr-column-head :deep(.el-tabs__header) {
    margin: 0;
  }

  .sidebar-tabs.ocr-column-head :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  .sidebar-tabs__task-btn,
  .sidebar-tabs__execute-btn {
    flex-shrink: 0;
    margin-left: 8px;
    height: 32px;
    min-height: 32px;
    padding: 0 14px;
    box-sizing: border-box;
  }
  
  /* 右侧配置面板 */
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
  
  /* 分隔线（调整宽度） */
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
  
  /* 拖拽时的样式 */
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
    color: var(--sd-primary, #195fb4);
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
    padding: 10px 16px;
    margin-bottom: 12px;
    background: #f0f9ff;
    border: 1px solid #b3d8ff;
    border-radius: 4px;
    font-size: 13px;
    color: var(--sd-primary, #195fb4);
  }

  .settings-status-banner > * + * {
    margin-left: 8px;
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
  .extraction-results {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .result-empty-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .result-loading-hint {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #909399;
    font-size: 14px;
    min-height: 200px;
  }
  
  .results-header {
    padding: 12px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    flex-direction: column;
    gap: 12px;
    justify-content: flex-start;
    align-items: flex-start;
  }
  
  .results-header .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .results-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: #303133;
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
  @media (max-width: 1400px) {
    .right-sidebar {
      width: 340px;
    }
  }
  
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
  