<template>
  <div class="task-result-viewer" v-loading="initialLoading" element-loading-text="加载任务数据中...">
    <!-- 左侧文件列表 -->
    <div class="left-sidebar">
      <div class="file-section">
        <div class="file-header">
          <span class="file-title">文件</span>
        </div>
        
        <!-- 搜索框 -->
        <div class="search-area">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索文件"
            size="small"
            clearable
            :prefix-icon="Search"
          />
        </div>
        
        <div class="download-area">
          <div class="download-area-content">
            <!-- 第一行：共X个 + 下载按钮 -->
            <div class="download-area-row-first">
              <!-- 显示全部按钮 -->
              <div 
                class="stat-item stat-item-all"
                :class="{ 'stat-item-selected': selectedStatusFilters.length === 0 }"
                @click="handleShowAll"
                :title="`显示全部文件`"
              >
                <span class="stat-text">共{{ fileList.length || 0 }}个</span>
              </div>
              <!-- 下载按钮 -->
              <div class="download-button-wrapper">
                <el-popover
                  v-if="taskData && taskData.status === 'failed' && failedFiles.length > 0"
                  placement="top"
                  :width="300"
                  trigger="hover"
                >
                  <template #reference>
                    <el-button 
                      type="danger" 
                      :icon="Refresh" 
                      circle 
                      size="small" 
                      @click="handleRetryTask"
                      style="margin-right: 8px;"
                      title="失败重试"
                    />
                  </template>
                  <div class="failed-files-popover">
                    <div class="popover-title">失败文件列表</div>
                    <div class="failed-files-list">
                      <div 
                        v-for="file in failedFiles" 
                        :key="file.file_id"
                        class="failed-file-item"
                      >
                        <el-icon class="failed-icon"><Close /></el-icon>
                        <span class="failed-file-name">{{ file.file_name }}</span>
                      </div>
                    </div>
                  </div>
                </el-popover>
                <el-dropdown @command="handleDownloadAllResults" trigger="click">
                  <el-button 
                    type="primary" 
                    size="small" 
                    :icon="Download"
                    circle
                    title="下载全部结果（ZIP压缩包）"
                  />
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="json">下载为JSON (ZIP)</el-dropdown-item>
                      <el-dropdown-item command="markdown">下载为Markdown (ZIP)</el-dropdown-item>
                      <el-dropdown-item command="xlsx">下载为Excel (ZIP)</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
            <!-- 第二行：状态筛选按钮 -->
            <div class="file-stats">
              <div 
                class="stat-item"
                :class="{ 'stat-item-selected': isStatusFilterSelected('完成') }"
                @click="handleStatusFilterClick('完成')"
                title="完成"
              >
                <el-icon class="stat-icon success"><Check /></el-icon>
                <span class="stat-text">{{ fileStats.completed }}</span>
              </div>
              <div 
                class="stat-item"
                :class="{ 'stat-item-selected': isStatusFilterSelected('失败') }"
                @click="handleStatusFilterClick('失败')"
                title="失败"
              >
                <el-icon class="stat-icon failed"><Close /></el-icon>
                <span class="stat-text">{{ fileStats.failed }}</span>
              </div>
              <div 
                class="stat-item"
                :class="{ 'stat-item-selected': isStatusFilterSelected('未完成') }"
                @click="handleStatusFilterClick('未完成')"
                title="未完成"
              >
                <el-icon class="stat-icon pending"><Clock /></el-icon>
                <span class="stat-text">{{ fileStats.pending }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="file-list">
          <div 
            v-for="file in filteredFileList" 
            :key="file.file_uuid || file.file_name"
            :class="['file-item', { active: isFileActive(file) }]"
            @click="handleFileItemClick(file)"
          >
            <el-icon class="file-icon"><Document /></el-icon>
            <span class="file-name">{{ file.file_name }}</span>
            <!-- 文件状态标识 -->
            <span v-if="file.status" class="file-status-badge">
              <el-tag 
                :type="'success'" 
                size="small"
                effect="plain"
              >
                {{ '自动' }}
              </el-tag>
            </span>
            <!-- 是否调整过标识 -->
            <el-icon
              v-if="fileConfigMap && fileConfigMap[getFileIdentifier(file)] && fileConfigMap[getFileIdentifier(file)].configured"
              class="edit-icon"
            ><Edit /></el-icon>
          </div>
          <!-- 空状态 -->
          <el-empty
            v-if="filteredFileList.length === 0"
            description="未找到匹配的文件"
            :image-size="80"
            style="padding: 20px 0;"
          />
        </div>
        
        <!-- 批量执行 -->
        <div class="batch-execute-area">
          <el-button 
            type="primary" 
            style="width: 100%;" 
            @click="handleBatchExecute"
            :disabled="filteredFileList.length === 0"
          >
            批量执行
          </el-button>
        </div>

        <div class="storage-info">
          <div class="task-info-item">
            <div class="task-info-label">任务名称：</div>
            <div class="task-info-value">{{ taskData?.task_name || '-' }}</div>
          </div>
          <div class="task-info-item" v-if="taskData?.task_remark">
            <div class="task-info-label">任务备注：</div>
            <div class="task-info-value">{{ taskData.task_remark }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 中间文档查看器 -->
    <div class="center-viewer">
      <!-- 顶部导航栏 -->
      <div class="viewer-header">
        <div class="page-controls">
          <!-- <el-button :icon="ArrowLeft" circle size="small" @click="prevPage" :disabled="currentPage <= 1" />
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <el-button :icon="ArrowRight" circle size="small" @click="nextPage" :disabled="currentPage >= totalPages" /> -->
          <el-button :icon="ZoomOut" circle size="small" @click="zoomOut" title="缩小" :disabled="pdfScale <= 0.5" />
          <el-button :icon="ZoomIn" circle size="small" @click="zoomIn" title="放大" :disabled="pdfScale >= 3" />
          <el-button :icon="FullScreen" circle size="small" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'" />
          <el-button :icon="Refresh" circle size="small" @click="refresh" />
          <el-button :icon="Download" circle size="small" @click="download" />
        </div>
        <!-- 处理按钮 -->
        <div class="process-buttons">
          <el-button type="primary" :icon="List" size="small" @click="handleGoToTaskCenter">任务中心</el-button>
        </div>
      </div>
      
      <!-- 文档预览区域 -->
      <div class="document-area">
        <!-- PDF文档预览 -->
        <div class="document-preview" ref="previewRef">
            <div v-if="currentFile && currentFile.file_type === 'pdf'" class="pdf-container-wrapper" ref="pdfContainerWrapperRef">
              <!-- Chrome 77 兼容模式：使用 iframe 预览 -->
              <div v-if="isOldChrome && pdfSource" class="pdf-container" style="width: 100%; height: 100%;">
                <iframe
                  :src="pdfSource"
                  style="width: 100%; height: 100%; border: none;"
                  frameborder="0"
                  @load="handlePdfRendered"
                  @error="handlePdfError"
                />
              </div>
              <!-- 正常模式：使用 vue-office-pdf -->
              <div v-else v-loading="pdfLoading" class="pdf-container" :style="{ transform: `scale(${pdfScale})`, transformOrigin: 'top center' }" style="width:100%">
                <vue-office-pdf
                  v-if="pdfSource"
                  :key="`pdf-${pdfSource}-${currentFile?.file_uuid || currentFile?.file_id || ''}`"
                  ref="pdfViewerRef"
                  :src="pdfSource"
                  @rendered="handlePdfRendered"
                  style="height: 100%; width: 100%"
                  @error="handlePdfError"
                />
                <div v-else-if="pdfLoading" class="loading-container">
                  <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                  <p>正在加载PDF文档...</p>
                </div>
                <div v-else class="empty-container">
                  <el-empty description="请选择PDF文件" />
                </div>
              </div>
            </div>
          <div v-else-if="currentFile && (currentFile.file_type === 'docx' || currentFile.file_type === 'doc')" class="docx-container-wrapper">
            <div v-loading="docxLoading" class="docx-container">
              <!-- DOCX文件或DOC转换后的文件使用vue-office-docx -->
              <vue-office-docx
                v-if="docxSource && (currentFile.file_type === 'docx' || (currentFile.file_type === 'doc' && docxSource))"
                :src="docxSource"
                style="width: 100%; height: 100%;"
                @error="handleDocxError"
              />
              <!-- DOC文件使用Microsoft Office Online Viewer -->
              <iframe
                v-else-if="currentFile.file_type === 'doc' && docPreviewUrl && !docxSource"
                :src="docPreviewUrl"
                class="doc-preview-iframe"
                style="width: 100%; height: 100%; border: none;"
                frameborder="0"
              />
              <div
                v-else-if="currentFile.file_type === 'doc' && !docPreviewUrl && !docxSource"
                ref="docPreviewContainerRef"
                class="docx-preview-container"
                style="width: 100%; height: 100%; overflow: auto; padding: 20px; background: #fff;"
              />
              <div v-else-if="docxLoading" class="loading-container">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <p>正在加载Word文档...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="请选择Word文件" />
              </div>
            </div>
          </div>
          <!-- Excel文档预览 -->
          <div v-else-if="currentFile && (currentFile.file_type === 'xlsx' || currentFile.file_type === 'xlsm' || currentFile.file_type === 'xls')" class="excel-container-wrapper">
            <div v-loading="excelLoading" class="excel-container">
              <vue-office-excel
                v-if="excelSource"
                :src="excelSource"
                style="width: 100%; height: 100%;"
                :options="{ xls: true }"
                @error="handleExcelError"
              />
              <div v-else-if="excelLoading" class="loading-container">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <p>正在加载Excel文档...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="请选择Excel文件" />
              </div>
            </div>
          </div>
          <div v-else class="empty-preview">
            <el-empty description="请选择文件进行预览">
              <el-icon class="empty-icon" :size="80" color="#c0c4cc"><Document /></el-icon>
            </el-empty>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 右侧面板 -->
    <div
      class="right-sidebar resizable-sidebar" 
      :style="{ width: rightSidebarWidth + 'px' }"
    >
      <!-- 标签页 -->
      <div class="sidebar-tabs">
        <el-tabs v-model="viewerTab" @tab-change="handleTabChange">
          <el-tab-pane label="解析结果" name="parse"></el-tab-pane>
          <el-tab-pane label="智能抽取" name="extract"></el-tab-pane>
        </el-tabs>
      </div>
      
      <!-- 解析结果：显示提取结果 -->
      <div
        class="extraction-results"
        v-if="viewerTab === 'parse'"
      >
        <ResultTable
          v-if="fileConfigMap && fileConfigMap[getFileIdentifier(currentFile)]"
          :result-list="fileConfigMap[getFileIdentifier(currentFile)]?.result || []"
        />
      </div>
      <!-- 功能配置：显示字段模式配置 -->
      <div
        class="readonly-extract-config"
        v-if="viewerTab === 'extract'"
      >
        <ConfigPanel
          v-if="fileConfigMap && fileConfigMap[getFileIdentifier(currentFile)]"
          v-model:template="fileConfigMap[getFileIdentifier(currentFile)].config.template"
          v-model:rule-list="fileConfigMap[getFileIdentifier(currentFile)].config.ruleList"
          v-model:prompt="fileConfigMap[getFileIdentifier(currentFile)].config.prompt"
          :key="`config-panel-${getFileIdentifier(currentFile)}`"
          :noExecute="true"
          :templateRuleList="templateRuleList"
          :loading="false"
          @update:template="handleConfigChange"
          @update:rule-list="handleConfigChange"
          @update:prompt="handleConfigChange"
        />
      </div>
    </div>
    
    <!-- 批量执行弹窗 -->
    <el-dialog
      v-model="batchExecuteDialogVisible"
      title="批量执行"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="batch-execute-dialog">
        <!-- 文件选择穿梭框 -->
        <el-transfer
          v-model="selectedExecuteFiles"
          :data="transferData"
          :titles="['可选文件', '待执行文件']"
          :button-texts="['移除', '添加']"
          :props="{
            key: 'file_uuid',
            label: 'file_name'
          }"
          filterable
          :filter-method="filterMethod"
          filter-placeholder="搜索文件名"
        >
          <template #default="{ option }">
            <div class="transfer-item">
              <span class="transfer-item-name">{{ option.file_name }}</span>
              <el-tag 
                v-if="option.isEdit" 
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
            @click="handleOpenTaskParamsDialog"
            :disabled="selectedExecuteFiles.length === 0"
          >
            创建任务 ({{ selectedExecuteFiles.length }})
          </el-button>
        </span>
      </template>
    </el-dialog>
    
    <!-- 任务参数配置子弹窗 -->
    <el-dialog
      v-model="taskParamsDialogVisible"
      title="配置任务参数"
      width="600px"
      :close-on-click-modal="false"
      append-to-body
    >
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
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="taskParamsDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="handleConfirmCreateTask"
            :loading="batchExtracting"
          >
            确认创建
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import VueOfficePdf from '@vue-office/pdf'
import VueOfficeDocx from '@vue-office/docx'
import VueOfficeExcel from '@vue-office/excel'
import { convertDocToDocxAPI, getPreviewFileAPI } from '@/api/fileManager.js'
import ResultTable from '@/views/file-manager-code/components/contract/ResultTable.vue'
import ConfigPanel from '@/views/file-manager-code/components/contract/ConfigPanel.vue'
import {
  Search,
  Document,
  ZoomIn,
  ZoomOut,
  FullScreen,
  Refresh,
  Download,
  Loading,
  List,
  Check,
  Close,
  Clock,
  Edit
} from '@element-plus/icons-vue'
import { mockTasks } from './mockTasks.js'
import { getTaskSchedulesAPI, exportExecutionRecordsAPI, createTaskSchedulesAPI } from '@/api/task.js'
import { getPublicAndPrivateTemplatesAPI } from '@/api/template.js'

defineOptions({
  name: 'TaskResultViewer',
})

// 定义 props
const props = defineProps({
  taskId: {
    type: String,
    default: ''
  },
  fileId: {
    type: String,
    default: ''
  }
})

// 定义 emits
const emit = defineEmits(['close'])

const route = useRoute()
const router = useRouter()

// 路由参数（优先使用 props，如果没有则从路由获取）
const taskId = ref(props.taskId || route.query.taskId || '')
const fileId = ref(props.fileId || route.query.fileId || '')

// 搜索关键词
const searchKeyword = ref('')

// 状态筛选
const selectedStatusFilters = ref([]) // 存储选中的筛选标签，如 ['失败', '完成']

// 状态筛选配置
const statusFilters = [
  { label: '失败', type: 'danger', statuses: ['failed'] },
  { label: '完成', type: 'success', statuses: ['completed'] },
  { label: '未完成', type: 'warning', statuses: ['processing', 'pending'] }
]

// 任务数据
const taskData = ref(null)

// 文件列表（从任务数据中获取）
const fileList = ref([])

// 文件配置映射表
const fileConfigMap = reactive({})

// 当前选中的文件
const currentFile = ref(null)

// 过滤后的文件列表
const filteredFileList = computed(() => {
  let filtered = fileList.value
  
  // 状态筛选
  if (selectedStatusFilters.value.length > 0) {
    const selectedStatuses = new Set()
    selectedStatusFilters.value.forEach(filterLabel => {
      const filter = statusFilters.find(f => f.label === filterLabel)
      if (filter) {
        filter.statuses.forEach(status => selectedStatuses.add(status))
      }
    })
    
    filtered = filtered.filter(file => {
      return selectedStatuses.has(file.status)
    })
  }
  
  // 搜索关键词筛选
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.trim().toLowerCase()
    filtered = filtered.filter(file => 
      file.file_name.toLowerCase().includes(keyword)
    )
  }
  
  // 排序：失败 > 完成 > 未完成
  const statusPriority = {
    'failed': 1,      // 失败 - 最高优先级
    'completed': 2,   // 完成 - 中等优先级
    'processing': 3,  // 进行中 - 低优先级
    'pending': 3      // 未开始 - 低优先级
  }
  
  filtered.sort((a, b) => {
    const priorityA = statusPriority[a.status] || 999
    const priorityB = statusPriority[b.status] || 999
    return priorityA - priorityB
  })
  
  return filtered
})

// 文件统计信息
const fileStats = computed(() => {
  const stats = {
    completed: 0,
    failed: 0,
    pending: 0
  }
  
  fileList.value.forEach(file => {
    if (file.status === 'completed') {
      stats.completed++
    } else if (file.status === 'failed') {
      stats.failed++
    } else {
      stats.pending++
    }
  })
  
  return stats
})

// 失败文件列表
const failedFiles = computed(() => {
  return fileList.value.filter(file => file.status === 'failed')
})

// 穿梭框数据（根据筛选条件）
const transferData = computed(() => {
  let data = filteredFileList.value
  
  // 如果勾选了"仅显示已调整"，则只显示已调整的文件
  if (filterEditedOnly.value) {
    data = data.filter(file => fileConfigMap[getFileIdentifier(file)].configured)
  }
  
  return data
})

// 中间查看器
const viewerTab = ref('parse') // 'parse' | 'extract'

const totalPages = ref(1)

// 批量执行相关
const batchExecuteDialogVisible = ref(false)
const taskParamsDialogVisible = ref(false) // 任务参数配置子弹窗
const selectedExecuteFiles = ref([])
const filterEditedOnly = ref(false)
const batchExtracting = ref(false) // 批量执行加载状态
const taskName = ref('') // 任务名称
const taskRemark = ref('') // 任务备注

// PDF相关
const pdfSource = ref(null)
const pdfLoading = ref(false)
const pdfScale = ref(1)
const isFullscreen = ref(false)
const pdfContainerWrapperRef = ref(null) // PDF容器wrapper ref
const pdfViewerRef = ref(null) // PDF查看器ref

// 检测浏览器版本（Chrome 77 及以下需要禁用 Worker）
const getChromeVersion = () => {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/)
  return match ? parseInt(match[1]) : null
}

const chromeVersion = getChromeVersion()
const isOldChrome = chromeVersion && chromeVersion <= 77

// 注意：vue-office-pdf 不支持 useWorker 选项，Worker 已在 main.js 中全局禁用
// 对于 Chrome 77，依赖全局配置即可，无需在此处设置选项

// DOCX/DOC相关
const docxSource = ref(null)
const docxLoading = ref(false)
const docPreviewUrl = ref(null)
const docPreviewContainerRef = ref(null)

// Excel相关
const excelSource = ref(null)
const excelLoading = ref(false)

// 右侧面板宽度
const rightSidebarWidth = ref(400)

// 提取结果
const extractionResults = ref([])

// 模板规则列表
const templateRuleList = ref({
  'auto': [],
  'construction': [],
  'non_construction': []
})

// 模板加载状态
const templateLoading = ref(false)
const templatePageSize = ref(15) // 每页数量

// 初始化加载状态
const initialLoading = ref(true)

// 获取文件的唯一标识符（统一函数，确保一致性）
const getFileIdentifier = (file) => {
  if (!file) return null
  const identifier = file.file_uuid
  return identifier
}

// 状态映射：后端状态码 -> 前端状态字符串
const statusMap = {
  0: 'pending',      // 未开始
  1: 'processing',   // 进行中
  2: 'completed',    // 已完成
  3: 'failed'        // 失败
}

// 获取进度文本
const getProgressText = (status) => {
  const textMap = {
    0: '未开始',
    1: '进行中',
    2: '已完成',
    3: '失败'
  }
  return textMap[status] || '未知'
}

// 转换后端任务数据为前端格式
const convertTaskData = (task) => {
  // 转换任务关联的文件列表（task_schedule_result_list）
  let files = []
  if (task.task_schedule_result_list && Array.isArray(task.task_schedule_result_list)) {
    files = task.task_schedule_result_list
  }
  
  return {
    task_id: task.task_uuid,
    task_name: task.task_name || '',
    agent_id: task.tool_uuid || '',
    agent_name: task.tool_name || '',
    status: statusMap[task.task_status] || 'pending',
    task_status: task.task_status,
    current_progress: getProgressText(task.task_status),
    file_count: task.file_num || '0',
    created_at: task.create_time || '',
    task_remark: task.task_notes || '',
    create_user_uuid: task.create_user_uuid || '',
    create_user_name: task.create_user_name || '',
    files: files
  }
}


// 模板选择相关
const templateMap = ref({
  'auto': '自动',
  'construction': '施工类',
  'non_construction': '非施工类',
  '非施工合同': 'non_construction',
  '施工合同': 'construction'
})

// 加载任务数据
const loadTaskData = async () => {
  initialLoading.value = true
  try {
    if (!taskId.value) {
      ElMessage.warning('缺少任务ID参数')
      return
    }
  
    // 调用API获取任务详情
    const res = await getTaskSchedulesAPI(taskId.value)
 
    if (res.code === 200 && res.data) {
      // 转换任务数据
      const convertedTask = convertTaskData(res.data)
  
      taskData.value = convertedTask
      fileList.value = convertedTask.files || []
      
      // 初始化 fileConfigMap
      fileList.value.forEach(file => {
        const fileId = getFileIdentifier(file)
        if (fileId && !fileConfigMap[fileId]) {
          // 判断是否加载中
          const isLoading = file.processing_status !== 2
          // 入参配置
          let config = JSON.parse(file.parameter_settings)
          // 大模型识别结果
          let result = file.disposal_result ? JSON.parse(file.disposal_result) : null
          // 展示给用户的列表
          let parsedArray = []

          if (!isLoading && result) {
            const jsonMatch = result.data.outputs.text.match(/```json\s*([\s\S]*?)\s*```/)
            if (jsonMatch && jsonMatch[1]) {
              const jsonString = jsonMatch[1].trim()
              parsedArray = JSON.parse(jsonString)
              if (parsedArray && !parsedArray.length) {
                parsedArray = [parsedArray]
              }
              console.log('提取的数组:', parsedArray)
            } else {
              ElMessage.warning('返回数据格式不正确')
            }
          }

          const template = result ? templateMap.value[result?.data?.outputs?.category] : config?.contract_category || 'auto'

          const ruleList = config?.information_extraction ? JSON.parse(JSON.stringify(config?.information_extraction)) : JSON.parse(JSON.stringify(templateRuleList.value[template||'auto']))

          const prompt = {
            compliance_analysis_prompt: config?.compliance_analysis_prompt,
            information_extraction_prompt: config?.information_extraction_prompt
          }

          if (ruleList && ruleList.length > 0) {
           ruleList.forEach((rule, ruleIndex) => {
              if (parsedArray[ruleIndex] && parsedArray[ruleIndex].extracted_value) {
                rule.extracted_value = parsedArray[ruleIndex].extracted_value
              }
            })
          }

          fileConfigMap[fileId] = {
            configured: false,
            config: { 
              template: template,
              ruleList: ruleList,
              prompt: {
                compliance_analysis_prompt: prompt?.compliance_analysis_prompt,
                information_extraction_prompt: prompt?.information_extraction_prompt
              }
            },
            isLoading: isLoading,
            result: parsedArray ? parsedArray : []
          }

        }
      })
  
      if (fileId.value && fileList.value.length > 0) {
        const file = fileList.value.find(f => 
          f.file_uuid === fileId.value || 
          f.file_id === fileId.value
        )
        if (file) {
          selectFile(file)
        } else {
          // 如果没有找到，选中第一个文件
          selectFile(fileList.value[0])
        }
      } else if (fileList.value.length > 0) {
        // 默认选中第一个文件进行预览
        selectFile(fileList.value[0])
      }
    } else {
      ElMessage.error(res.message || '获取任务详情失败')
      // 如果API失败，尝试从mock数据中查找（兼容旧逻辑）
      const task = mockTasks.find(t => t.task_id === taskId.value)
      if (task) {
        taskData.value = task
        fileList.value = task.files || []
        
        // 初始化 fileConfigMap
        fileList.value.forEach(file => {
          const fileId = getFileIdentifier(file)
          if (fileId && !fileConfigMap[fileId]) {
            fileConfigMap[fileId] = {
              configured: false,
              config: {
                template: file.parameter_template || 'auto',
                ruleList: file.rule_list || [],
                prompt: {
                  compliance_analysis_prompt: null,
                  information_extraction_prompt: null
                }
              },
              result: file.task_result || []
            }
          }
        })
        
        if (fileList.value.length > 0) {
          selectFile(fileList.value[0])
        }
      }
    }
  } catch (error) {
    console.error('加载任务详情失败:', error)
    ElMessage.error(error.message || '加载任务详情失败')
    // 如果API失败，尝试从mock数据中查找（兼容旧逻辑）
    const task = mockTasks.find(t => t.task_id === taskId.value)
    if (task) {
      taskData.value = task
      fileList.value = task.files || []
      
      // 初始化 fileConfigMap
      fileList.value.forEach(file => {
        const fileId = getFileIdentifier(file)
        if (fileId && !fileConfigMap[fileId]) {
          fileConfigMap[fileId] = {
            configured: false,
            config: {
              template: file.parameter_template || 'auto',
              ruleList: file.rule_list || [],
              prompt: {
                compliance_analysis_prompt: null,
                information_extraction_prompt: null
              }
            },
            result: file.task_result || []
          }
        }
      })
      
      if (fileList.value.length > 0) {
        selectFile(fileList.value[0])
      }
    }
  } finally {
    initialLoading.value = false
  }
}

// 选择文件
const selectFile = (file) => {
  if (!file) {
    console.warn('selectFile: 文件对象为空')
    return
  }
  
  // 设置当前文件
  currentFile.value = file
  // currentPage.value = 1
  
  // 重置PDF和DOCX源
  pdfSource.value = null
  docxSource.value = null
  docPreviewUrl.value = null
  excelSource.value = null
  
  // 加载提取结果
  loadExtractionResults(file)
  
  // 根据文件类型加载预览
  if (file.file_type === 'pdf') {
    loadPdfPreview(file)
  } else if (file.file_type === 'docx' || file.file_type === 'doc') {
    loadDocxPreview(file)
  } else if (file.file_type === 'xlsx' || file.file_type === 'xlsm' || file.file_type === 'xls') {
    loadExcelPreview(file)
  }
}


// 加载PDF预览
const loadPdfPreview = async (file) => {
  // 先清空，强制组件重新渲染
  pdfSource.value = null
  pdfLoading.value = true
  
  // 等待 DOM 更新，确保组件已卸载
  await nextTick()
  // 额外等待一小段时间，确保组件完全卸载
  await new Promise(resolve => setTimeout(resolve, 50))
  
  try {
    // 直接使用接口返回的 file_url（从详情接口返回）
    if (file.file_url) {
      // 再次等待 DOM 更新
      await nextTick()
      
      // 使用 Object.assign 或直接赋值来强制触发响应式更新
      // 创建一个新的字符串引用，确保 Vue 检测到变化
      const newSource = String(file.file_url)
      pdfSource.value = newSource
      
      // 注意：totalPages 需要从PDF加载后获取，这里先设置为1
      totalPages.value = 1
      
      // 再次等待多个 tick，确保组件完全接收到新的 src 并开始渲染
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
    } else {
      pdfSource.value = null
    }
  } catch (error) {
    console.error('加载PDF失败:', error)
    // 即使加载失败，也尝试继续显示（可能是 Worker 相关警告）
    const errorMessage = error?.message || error?.toString() || ''
    const isWorkerError = errorMessage.includes('Worker') || errorMessage.includes('setup') || errorMessage.includes('polyfill')
    
    if (!isWorkerError) {
      // 只有非 Worker 相关错误才显示错误消息
      ElMessage.warning('PDF文件加载遇到问题，但将继续尝试显示')
    }
    // 不阻止预览，让组件继续尝试渲染
    // 不设置 pdfSource 为 null，保留 URL 让组件继续尝试
  } finally {
    pdfLoading.value = false
  }
}

// 加载DOCX/DOC预览
const loadDocxPreview = async (file) => {
  docxLoading.value = true
  try {
    if (file.file_type === 'docx') {
      // DOCX文件使用vue-office-docx
      // 直接使用接口返回的 file_url（从详情接口返回）
      if (file.file_url) {
        docxSource.value = file.file_url
      } else {
        docxSource.value = null
      }
    } else if (file.file_type === 'doc') {
      // DOC文件使用后端转换服务转换为DOCX
      docxSource.value = null
      docPreviewUrl.value = null

      try {
        ElMessage.info('正在转换 DOC 文件...')

        // 调用后端转换API（使用详情接口返回的 file_url）
        const convertResponse = await convertDocToDocxAPI(null, file.file_url)

        if (convertResponse.code === 200 && convertResponse.data) {
          const { file_id, preview_url } = convertResponse.data
          // 优先使用 preview_url，如果没有则通过 getPreviewFileAPI 获取
          docxSource.value = preview_url || getPreviewFileAPI(file_id)
          ElMessage.success('DOC 文件转换成功')
        } else {
          throw new Error(convertResponse.message || '转换失败')
        }
      } catch (docError) {
        console.error('DOC文件转换失败:', docError)
        docxSource.value = null
        docPreviewUrl.value = null
        ElMessage.error('DOC文件转换失败: ' + ((docError && docError.message) || '未知错误'))
      }
    }
  } catch (error) {
    console.error('加载Word文件失败:', error)
    ElMessage.error('Word文件加载失败')
  } finally {
    docxLoading.value = false
  }
}

// 加载Excel预览
const loadExcelPreview = async (file) => {
  excelLoading.value = true
  try {
    // 直接使用接口返回的 file_url（从详情接口返回）
    if (file.file_url) {
      excelSource.value = file.file_url
    } else {
      excelSource.value = null
    }
  } catch (error) {
    console.error('加载Excel失败:', error)
    ElMessage.error('Excel文件加载失败')
    excelSource.value = null
  } finally {
    excelLoading.value = false
  }
}

// DOCX错误处理
const handleDocxError = () => {
  docxLoading.value = false
  ElMessage.error('Word文档加载失败')
}

// Excel错误处理
const handleExcelError = () => {
  excelLoading.value = false
  ElMessage.error('Excel文档加载失败')
}

// 加载提取结果
const loadExtractionResults = (file) => {
  extractionResults.value = []
  console.log(file)
}

// 文件点击
const handleFileItemClick = (file) => {
  selectFile(file)
}

// 判断文件是否激活
const isFileActive = (file) => {
  if (!currentFile.value) {
    return false
  }
  const currentId = currentFile.value.file_uuid || currentFile.value.file_id
  const fileId = file.file_uuid || file.file_id
  return currentId && fileId && currentId === fileId
}

// PDF相关方法
const handlePdfRendered = () => {
  pdfLoading.value = false
}

const handlePdfError = (error) => {
  console.error('PDF加载错误:', error)
  // 不阻止预览继续，只记录错误
  // 对于 Chrome 77 的 Worker 警告，这是预期的，不需要显示错误消息
  const errorMessage = error?.message || error?.toString() || ''
  const isWorkerError = errorMessage.includes('Worker') || errorMessage.includes('setup') || errorMessage.includes('polyfill')
  
  if (!isWorkerError) {
    // 只有非 Worker 相关错误才显示错误消息
    ElMessage.warning('PDF文档加载可能存在问题，但将继续尝试显示')
  }
  
  // 即使有错误，也允许继续尝试显示
  pdfLoading.value = false
  // 不设置 pdfSource 为 null，让组件继续尝试渲染
}


const zoomIn = () => {
  if (pdfScale.value < 3) {
    pdfScale.value = Math.min(pdfScale.value + 0.1, 3)
  }
}

const zoomOut = () => {
  if (pdfScale.value > 0.5) {
    pdfScale.value = Math.max(pdfScale.value - 0.1, 0.5)
  }
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

const refresh = () => {
  if (currentFile.value) {
    loadPdfPreview(currentFile.value)
  }
}

const download = () => {
  ElMessage.info('下载功能（演示模式）')
}

// 下载结果
// 下载全部结果为ZIP压缩包
const handleDownloadAllResults = async (format) => {
  if (!taskData.value) {
    ElMessage.warning('任务数据不存在')
    return
  }
  
  if (!format) {
    ElMessage.warning('请选择下载格式')
    return
  }
  
  // 格式映射：将前端格式映射到后端格式
  const formatMap = {
    'json': 'json',
    'markdown': 'markdown',
    'xlsx': 'excel',
    'excel': 'excel',
    'csv': 'csv'
  }
  
  const exportFormat = formatMap[format] || format
  
  try {
    // 调用后端导出接口
    const response = await exportExecutionRecordsAPI({
      task_uuid: taskData.value.task_id,
      export_format: exportFormat
    })
    
    // 处理文件下载
    const blob = new Blob([response.data], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    const formatNames = {
      json: 'JSON',
      markdown: 'Markdown',
      excel: 'Excel',
      xlsx: 'Excel',
      csv: 'CSV'
    }
    
    // 根据格式设置文件扩展名
    const fileExtensions = {
      json: 'zip',
      markdown: 'zip',
      excel: 'xlsx',
      xlsx: 'xlsx',
      csv: 'zip'
    }
    
    const extension = fileExtensions[format] || 'zip'
    link.download = `任务结果-${taskData.value.task_id}-${formatNames[format] || format}-${Date.now()}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    ElMessage.success(`已下载全部结果（${formatNames[format] || format}格式）`)
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error(error.message || '下载失败，请稍后重试')
  }
}

// 生成单个文件的Markdown格式
// 已废弃，功能已封装在 ResultTable 组件中
/*
const generateFileMarkdown = (fileData) => {
  let markdown = `# 文件提取结果\n\n`
  markdown += `**文件名**: ${fileData.file_name}\n\n`
  markdown += `**文件ID**: ${fileData.file_id}\n\n`
  markdown += `**状态**: ${fileData.status}\n\n`
  
  if (fileData.settings) {
    markdown += `## 参数设置\n\n`
    markdown += `- **模式**: ${fileData.settings.mode === 'prompt' ? 'Prompt模式' : (fileData.settings.field_type === 'custom' ? '自定义模式' : '字段模式')}\n`
    if (fileData.settings.mode === 'prompt' && fileData.settings.prompt) {
      markdown += `- **Prompt**: ${fileData.settings.prompt}\n`
    }
    if (fileData.settings.mode === 'field' && fileData.settings.template) {
      markdown += `- **模板**: ${fileData.settings.template}\n`
    }
    markdown += `\n`
  }
  
  if (fileData.result && fileData.result.length > 0) {
    markdown += `## 提取结果\n\n`
    fileData.result.forEach(item => {
      markdown += `### ${item.fieldName || item.field_name || '未知字段'}\n\n`
      markdown += `- **值**: ${item.fieldValue || item.field_value || '-'}\n`
      if (item.confidence !== undefined) {
        markdown += `- **置信度**: ${item.confidence}%\n`
      }
      if (item.status) {
        markdown += `- **状态**: ${item.status}\n`
      }
      markdown += `\n`
    })
  } else {
    markdown += `## 提取结果\n\n暂无提取结果\n\n`
  }
  
  return markdown
}
*/

// 导出结果（已废弃，功能已封装在 ResultTable 组件中）
/*
const handleExportResults = (format) => {
  if (!currentFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  if (!extractionResults.value || extractionResults.value.length === 0) {
    ElMessage.warning('当前文件没有提取结果')
    return
  }
  
  try {
    const fileData = {
      file_id: currentFile.value.file_id,
      file_name: currentFile.value.file_name,
      status: currentFile.value.status,
      settings: currentFile.value.settings,
      result: extractionResults.value
    }
    
    if (format === 'excel' || format === 'xlsx') {
      // Excel格式
      import('xlsx').then(XLSX => {
        const worksheetData = []
        
        // 添加文件信息行
        worksheetData.push(['文件ID', fileData.file_id])
        worksheetData.push(['文件名', fileData.file_name])
        worksheetData.push(['状态', fileData.status])
        worksheetData.push([]) // 空行
        
        // 添加提取结果表头
        worksheetData.push(['字段名称', '字段值', '是否找到', '置信度', '状态', '证据链'])
        fileData.result.forEach(item => {
          worksheetData.push([
            item.fieldName || '',
            item.fieldValue || '',
            item.is_found !== false ? '是' : '否',
            item.confidence || 0,
            item.status || '',
            item.evidence || ''
          ])
        })
        
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, '提取结果')
        
        // 生成Excel文件的二进制数据
        const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${fileData.file_name.replace(/\.[^/.]+$/, '')}_结果.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        ElMessage.success('导出成功')
      })
    } else if (format === 'csv') {
      // CSV格式
      let csvContent = '字段名称,字段值,是否找到,置信度,状态,证据链\n'
      fileData.result.forEach(item => {
        const row = [
          item.fieldName || '',
          `"${(item.fieldValue || '').replace(/"/g, '""')}"`,
          item.is_found !== false ? '是' : '否',
          item.confidence || 0,
          item.status || '',
          `"${(item.evidence || '').replace(/"/g, '""')}"`
        ]
        csvContent += row.join(',') + '\n'
      })
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileData.file_name.replace(/\.[^/.]+$/, '')}_结果.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      ElMessage.success('导出成功')
    } else if (format === 'markdown') {
      // Markdown格式
      const markdown = generateFileMarkdown(fileData)
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileData.file_name.replace(/\.[^/.]+$/, '')}_结果.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      ElMessage.success('导出成功')
    } else if (format === 'json') {
      // JSON格式
      const jsonContent = JSON.stringify(fileData, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileData.file_name.replace(/\.[^/.]+$/, '')}_结果.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      ElMessage.success('导出成功')
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请稍后重试')
  }
}
*/

// 配置变化处理：标记文件为已配置
const handleConfigChange = () => {
  if (currentFile.value) {
    const fileId = getFileIdentifier(currentFile.value)
    if (fileId && fileConfigMap[fileId]) {
      fileConfigMap[fileId].configured = true
    }
  }
}

// 标签切换
const handleTabChange = (tab) => {
  console.log('切换到标签:', tab)
}

// 跳转到任务中心（如果在弹窗中则关闭弹窗，否则跳转路由）
const handleGoToTaskCenter = () => {
  if (props.taskId) {
    // 如果是通过 props 传入的，说明在弹窗中，触发关闭事件
    emit('close')
  } else {
    // 否则是独立页面，跳转路由
    router.push({ name: 'OcrTaskCenter' })
  }
}

// 失败重试
const handleRetryTask = async () => {
  if (!taskData.value) {
    ElMessage.warning('任务数据不存在')
    return
  }
  
  if (taskData.value.status !== 'failed') {
    ElMessage.warning('只有失败的任务才能重试')
    return
  }
  
  try {
    // 显示确认对话框
    await ElMessageBox.confirm(
      '确定要重试该失败任务吗？',
      '重试确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 这里应该调用API重试任务
    // 目前是原型阶段，只显示提示
    ElMessage.success('任务重试请求已提交，正在处理中...')
    
    // 模拟重试：更新任务状态为进行中
    taskData.value.status = 'processing'
    taskData.value.current_progress = '进行中'
    taskData.value.current_node = '正在重新处理'
    
    // 更新所有失败文件的状态为进行中
    if (taskData.value.files) {
      taskData.value.files.forEach(file => {
        if (file.status === 'failed') {
          file.status = 'processing'
          file.progress = '进行中'
          file.error_message = null
        }
      })
    }
    
    // 重新加载文件列表
    fileList.value = taskData.value.files || []
    
  } catch (error) {
    // 用户取消
    if (error !== 'cancel') {
      console.error('重试失败:', error)
      ElMessage.error('重试失败，请稍后重试')
    }
  }
}

// 判断状态筛选标签是否被选中
const isStatusFilterSelected = (filterLabel) => {
  return selectedStatusFilters.value.includes(filterLabel)
}

// 处理显示全部
const handleShowAll = () => {
  selectedStatusFilters.value = []
}

// 处理状态筛选标签点击
const handleStatusFilterClick = (filterLabel) => {
  const index = selectedStatusFilters.value.indexOf(filterLabel)
  if (index > -1) {
    // 如果已选中，取消选中
    selectedStatusFilters.value.splice(index, 1)
  } else {
    // 如果未选中，添加到选中列表
    selectedStatusFilters.value.push(filterLabel)
  }
}

// 获取状态标签类型（保留用于可能的后续使用）
// const getStatusTagType = (status) => {
//   if (status === 'success') return 'success'
//   if (status === 'warning') return 'warning'
//   if (status === 'error') return 'danger'
//   return 'info'
// }

// 获取状态文本（保留用于可能的后续使用）
// const getStatusText = (status) => {
//   const textMap = {
//     success: '准确',
//     warning: '警告',
//     error: '错误'
//   }
//   return textMap[status] || status
// }

// 获取置信度颜色（保留用于可能的后续使用）
// const getConfidenceColor = (confidence) => {
//   if (confidence >= 90) return '#67c23a'
//   if (confidence >= 70) return '#e6a23c'
//   return '#f56c6c'
// }

// 获取表格行类名（用于高亮选中行）（已废弃，功能已封装在 ResultTable 组件中）
/*
const getRowClassName = () => {
  return ''
}
*/

// 加载模板列表
const loadTemplates = async (page = 1) => {
  if (templateLoading.value) return

  templateLoading.value = true
  try {
    const response = await getPublicAndPrivateTemplatesAPI({
      page: page,
      size: templatePageSize.value,
      template_classification: 'contract'
    })

    if (response.code === 200 && response.data) {
      response.data.items.forEach(item => {
        if (item.template_name === '施工类合同') {
          templateRuleList.value['construction'] = []
          let list = JSON.parse(item.prompt)
          list.forEach(childItem => {
            try {
              // 清理描述字段
              let cleanedDescription = childItem.description
              // 去除外层可能存在的单引号
              if (cleanedDescription.startsWith("'") && cleanedDescription.endsWith("'")) {
                cleanedDescription = cleanedDescription.slice(1, -1)
              }
              templateRuleList.value['construction'].push(JSON.parse(cleanedDescription))
            } catch (error) {
              console.error('解析 description 失败:', error)
              console.error('原始内容:', childItem.description)
            }
          })
        }
        if (item.template_name === '非施工类合同') {
          templateRuleList.value['non_construction'] = []
          let list = JSON.parse(item.prompt)
          list.forEach(childItem => {
            try {
              // 清理描述字段
              let cleanedDescription = childItem.description
              // 去除外层可能存在的单引号
              if (cleanedDescription.startsWith("'") && cleanedDescription.endsWith("'")) {
                cleanedDescription = cleanedDescription.slice(1, -1)
              }
              templateRuleList.value['non_construction'].push(JSON.parse(cleanedDescription))
            } catch (error) {
              console.error('解析 description 失败:', error)
              console.error('原始内容:', childItem.description)
            }
          })
        }
      })
    } else {
      console.warn('加载模板列表失败:', response.message || '未知错误')
      if (response.message) {
        ElMessage.warning(response.message)
      }
    }
  } catch (error) {
    console.error('加载模板列表失败:', error)
    ElMessage.error('加载模板列表失败: ' + (error.message || '未知错误'))
  } finally {
    templateLoading.value = false
  }
}

// 监听 pdfSource 的变化，强制触发组件更新
watch(
  () => pdfSource.value,
  (newVal, oldVal) => {
    // 当 pdfSource 从 null 变为有效值，或值发生变化时
    if (newVal && newVal !== oldVal) {
      // 使用 nextTick 确保组件接收到新的值
      nextTick(() => {
        // 强制触发响应式更新
        if (pdfViewerRef.value) {
          // 如果组件实例存在，可以尝试重新加载
          console.log('PDF源已更新:', newVal)
        }
      })
    }
  },
  { immediate: false }
)

// 监听 props 变化，重新加载数据
watch(
  () => [props.taskId, props.fileId],
  ([newTaskId, newFileId]) => {
    if (newTaskId) {
      taskId.value = newTaskId
      fileId.value = newFileId || ''
      loadTaskData()
    }
  },
  { immediate: false }
)

// 添加规则（已废弃，功能已封装在 ConfigPanel 组件中）
/*
const handleAddRule = () => {
  ruleList.value.push({
    ruleName: '',
    ruleDescription: '',
    legalBasis: '',
    judgmentCriteria: '',
    extractionResult: ''
  })
}

// 删除规则（已废弃，功能已封装在 ConfigPanel 组件中）
const handleDeleteRule = (index) => {
  ElMessageBox.confirm(
    '确定要删除这条规则吗？',
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    ruleList.value.splice(index, 1)
    ElMessage.success('删除成功')
  }).catch(() => {
    // 用户取消删除
  })
}
*/

// 打开批量执行弹窗
const handleBatchExecute = () => {
  selectedExecuteFiles.value = []
  filterEditedOnly.value = false
  
  batchExecuteDialogVisible.value = true
}

// 穿梭框筛选方法
const filterMethod = (query, item) => {
  return item.file_name.toLowerCase().includes(query.toLowerCase())
}

// 处理筛选条件变化
const handleFilterChange = () => {
  // 筛选条件变化时，清空已选择的文件（避免选中了不在当前筛选结果中的文件）
  const currentTransferIds = new Set(transferData.value.map(item => item.file_uuid))
  selectedExecuteFiles.value = selectedExecuteFiles.value.filter(id => currentTransferIds.has(id))
}

// 构建文件配置数据
const getFileConfig = (file) => {
  // 获取文件的唯一标识符
  const fileUuid = getFileIdentifier(file) || file.file_uuid
  
  // 获取文件类型
  const fileType = file.file_type || 'pdf'
  
  // 获取文件大小（字符串格式）
  const fileSize = String(file.file_size || file.size || 0)
  
  // 当前文件配置
  const currentFileConfig = fileConfigMap[getFileIdentifier(file)]
  
  // 构建 task_schedule_results
  const taskScheduleResult = {
    file_uuid: fileUuid,
    file_name: file.file_name || '未知文件',
    file_type: fileType,
    file_size: fileSize,
    parameter_template: "{\"rules\": []}",
    prompt_uuid: "prompt",
    contract_category: currentFileConfig?.config?.template || 'auto',
    parameter_settings: currentFileConfig?.config?.template !== 'auto' ? {
      information_extraction: (currentFileConfig?.config?.ruleList || []).map((item) => {
        const copy = { ...item }
        delete copy.extracted_value_completeness
        delete copy.extracted_value_compliance
        delete copy.data_format
        return copy
      }),
      compliance_analysis_prompt: currentFileConfig?.config?.prompt?.compliance_analysis_prompt,
      information_extraction_prompt: currentFileConfig?.config?.prompt?.information_extraction_prompt
    } : null
  }
  
  return taskScheduleResult
}

// 校验批量文件配置
const validateBatchFileSettings = () => {
  // 存储校验失败的文件信息
  const invalidFiles = []
  
  // 遍历选中的文件
  for (const fileId of selectedExecuteFiles.value) {
    const file = fileList.value.find(f => getFileIdentifier(f) === fileId)
    if (!file) continue
    
    const fileConfig = fileConfigMap[fileId]

    console.log('fileConfig', fileConfig)
    if (!fileConfig) {
      invalidFiles.push({
        fileName: file.file_name,
        reason: '缺少配置信息'
      })
      continue
    }
    
    const { template, ruleList } = fileConfig.config
    
    // 如果选择了非自动模板，需要检查规则列表
    if (template !== 'auto') {
      if (!ruleList || ruleList.length === 0) {
        invalidFiles.push({
          fileName: file.file_name,
          reason: '未配置提取规则'
        })
        continue
      }
      
      // 检查每条规则的完整性
      for (let i = 0; i < ruleList.length; i++) {
        const rule = ruleList[i]
        if (!rule.title || !rule.title.trim()) {
          invalidFiles.push({
            fileName: file.file_name,
            reason: `规则${i + 1}缺少规则名称`
          })
          break
        }
        if (!rule.description || !rule.description.trim()) {
          invalidFiles.push({
            fileName: file.file_name,
            reason: `规则${i + 1}缺少规则描述`
          })
          break
        }
        if (!rule.laws_and_regulations || !rule.laws_and_regulations.trim()) {
          invalidFiles.push({
            fileName: file.file_name,
            reason: `规则${i + 1}缺少法规依据`
          })
          break
        }
        if (!rule.judgment_rule || !rule.judgment_rule.trim()) {
          invalidFiles.push({
            fileName: file.file_name,
            reason: `规则${i + 1}缺少判断标准`
          })
          break
        }
      }
    }
  }
  
  // 如果有校验失败的文件，显示错误信息
  if (invalidFiles.length > 0) {
    const errorMsg = invalidFiles.map(item => 
      `${item.fileName}: ${item.reason}`
    ).join('\n')
    
    ElMessage.error({
      message: `以下文件配置不完整，请检查：\n${errorMsg}`,
      duration: 5000,
      dangerouslyUseHTMLString: false
    })
    
    return false
  }
  
  return true
}

// 打开任务参数配置对话框
const handleOpenTaskParamsDialog = () => {
  if (selectedExecuteFiles.value.length === 0) {
    ElMessage.warning('请选择要执行的文件')
    return
  }
  
  // 校验所有文件的配置完整性
  if (!validateBatchFileSettings()) {
    return
  }
  
  // 初始化任务参数
  taskName.value = ''
  taskRemark.value = ''
  
  // 打开子弹窗
  taskParamsDialogVisible.value = true
}

// 确认创建任务
const handleConfirmCreateTask = async () => {
  // 验证任务名称
  if (!taskName.value.trim()) {
    ElMessage.warning('请输入任务名称')
    return
  }
  
  // 获取选中的文件信息
  const selectedFiles = fileList.value.filter(file => 
    selectedExecuteFiles.value.includes(getFileIdentifier(file))
  )
  console.log('selectedFiles', selectedFiles)
  batchExtracting.value = true
  
  try {
    // 构建请求数据
    const taskData = {
      task_name: taskName.value,
      tool_uuid: 'contractCompleteness-tool-uuid',
      tool_name: '合同完备性分析',
      file_num: String(selectedFiles.length),
      task_notes: taskRemark.value,
      task_type: 2,
      task_switch: 2, // 1是立即执行，2是进入任务调度器
      biz_type: "contractCompleteness",
      task_schedule_results: selectedFiles.map(file => getFileConfig(file)),
    }
    
    // 调用创建任务接口
    const response = await createTaskSchedulesAPI(taskData)
    
    if (response.code === 200) {
      ElMessage.success(`任务"${taskName.value}"创建成功`)
      
      // 清空任务参数
      taskName.value = ''
      taskRemark.value = ''
      
      // 关闭所有对话框
      taskParamsDialogVisible.value = false
      batchExecuteDialogVisible.value = false
    } else {
      ElMessage.error(response.message || '任务创建失败')
    }
  } catch (error) {
    console.error('创建任务失败:', error)
    ElMessage.error('创建任务失败: ' + (error.message || '未知错误'))
  } finally {
    batchExtracting.value = false
  }
}

onMounted(async () => {
  await loadTemplates() // 加载模板列表用于显示模板名称
  loadTaskData()
})
</script>

<style scoped lang="scss">
.task-result-viewer {
  height: calc(100vh - 75px);
  display: flex;
  overflow: hidden;
  background: #f5f5f5;
}

.left-sidebar {
  width: 280px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
}

.file-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.file-header {
  margin-bottom: 16px;
}

.file-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.search-area {
  margin-bottom: 12px;
}

.download-area {
  margin-bottom: 16px;
}

.download-area-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.download-area-row-first {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.file-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid #e4e7ed;
  background: #fff;
  user-select: none;
}

.stat-item-all {
  padding: 6px 14px;
  font-weight: 500;
  min-width: 80px;
  justify-content: center;
}

.stat-item-all .stat-text {
  font-size: 13px;
  font-weight: 500;
}

.stat-item:hover {
  background: #f5f7fa;
  border-color: #c0c4cc;
}

.stat-item.stat-item-selected {
  background: #ecf5ff;
  border-color: #409eff;
}

.stat-icon {
  font-size: 16px;
}

.stat-icon.success {
  color: #67c23a;
}

.stat-icon.failed {
  color: #f56c6c;
}

.stat-icon.pending {
  color: #e6a23c;
}

.stat-icon.all {
  color: #409eff;
}

.stat-text {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.download-button-wrapper {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
}

.failed-files-popover {
  max-height: 300px;
  overflow-y: auto;
}

.popover-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.failed-files-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.failed-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}

.failed-icon {
  color: #f56c6c;
  font-size: 14px;
  flex-shrink: 0;
}

.failed-file-name {
  color: #606266;
  word-break: break-all;
  line-height: 1.5;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
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

.file-status-badge {
  margin-left: auto;
}

.storage-info {
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.task-info-item {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.task-info-item:last-child {
  margin-bottom: 0;
}

.task-info-label {
  color: #909399;
  margin-bottom: 2px;
  font-weight: 500;
}

.task-info-value {
  color: #303133;
  word-break: break-word;
  white-space: pre-wrap;
}

.center-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-info {
  margin: 0 8px;
  font-size: 14px;
  color: #606266;
}

.process-buttons {
  display: flex;
  gap: 8px;
}

.document-area {
  flex: 1;
  overflow: auto;
  padding: 20px;
  background: #f5f5f5;
}

.document-preview {
  height: 100%;
  overflow: auto;
}

.pdf-container-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100%;
  padding: 20px;
}

.pdf-container {
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.loading-container,
.empty-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 400px;
  color: #909399;
}

.empty-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.right-sidebar {
  width: 400px;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-tabs {
  padding: 0 16px;
  border-bottom: 1px solid #e4e7ed;
}

.extraction-results,
.readonly-extract-config {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.results-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  background: #fff;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-field-name {
  font-weight: 500;
  color: #303133;
}

.result-value {
  color: #606266;
  word-break: break-word;
}

.result-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-confidence {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.result-confidence-text {
  font-size: 12px;
  color: #909399;
  min-width: 40px;
}

.config-header h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.mode-display {
  margin-bottom: 16px;
}

.config-label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 8px;
}

.config-value.readonly {
  padding: 12px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-word;
}

.prompt-content {
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.6;
}

.empty-prompt {
  padding: 20px;
  text-align: center;
}

.error-display {
  margin-bottom: 16px;
}

.error-display .el-alert {
  border-radius: 4px;
}

.field-definitions {
  margin-top: 16px;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-item-readonly {
  padding: 12px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.field-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.field-type {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.field-desc {
  font-size: 13px;
  color: #606266;
}

.no-config {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

/* 规则配置样式 */
.rule-config {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.rule-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.rule-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.rule-item {
  border-radius: 4px;
  margin-bottom: 12px;
  overflow: hidden;
}

.rule-item:last-child {
  margin-bottom: 0;
}

.rule-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background: #f5f7fa;
  border-radius: 5px;
}

.rule-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.rule-item-content {
  padding: 5px;
}

.rule-item-content .el-form-item {
  margin-bottom: 5px;
}

.rule-item-content .el-form-item :deep(.el-form-item__label) {
  margin-bottom: 0;
}

.rule-item-content .el-form-item:last-child {
  margin-bottom: 0;
}

/* 批量执行区域样式 */
.batch-execute-area {
  padding: 12px 0;
  border-top: 1px solid #e4e7ed;
}

/* 批量执行弹窗样式 */
.batch-execute-dialog {
  padding: 20px 0;
}

.batch-execute-dialog :deep(.el-transfer) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.batch-execute-dialog :deep(.el-transfer-panel) {
  width: 45%;
}

.batch-execute-dialog :deep(.el-transfer__buttons) {
  display: flex;
}

.batch-execute-dialog :deep(.el-transfer) {
  height: 50vh;
}

.batch-execute-dialog :deep(.el-transfer-panel) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.batch-execute-dialog :deep(.el-transfer-panel__body) {
  height: 100%;
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

/* 编辑图标样式 */
.edit-icon {
  color: #E6A23C;
  font-size: 16px;
  margin-left: 4px;
}
</style>

