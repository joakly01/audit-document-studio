<template>
  <div
    class="task-result-viewer"
    :class="{ 'task-result-viewer--embedded': isSecondaryExecution }"
    v-loading="initialLoading"
    element-loading-text="加载任务数据中..."
  >
    <!-- 左侧文件树（复用 OcrLeftSidebar 预览模式） -->
    <div
      class="task-left-sidebar-wrap left-sidebar-shell"
      :class="{ 'resizable-left-sidebar': isSecondaryExecution }"
      :style="isSecondaryExecution ? { width: leftSidebarWidth + 'px' } : undefined"
    >
      <OcrLeftSidebar
        :bindings="leftSidebarBindings"
        mode="preview"
        :task-id="taskId"
        :allow-mode-switch="false"
        :allow-folder-click-in-preview="false"
        :hide-preview-runtime-progress="true"
        :compact-file-header="isSecondaryExecution"
        layout-mode="full"
        enable-file-attachment
        merge-attachment-action
        truncate-file-name-by-css
      />
    </div>

    <!-- 左侧与中间区域之间的宽度拖拽条 -->
    <div
      v-if="isSecondaryExecution"
      v-show="showFilePreview"
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
      <!-- 顶部导航栏 -->
      <div
        v-if="!isFolderListPreviewMode"
        class="viewer-header"
        :class="{ 'ocr-column-head': isSecondaryExecution }"
      >
        <div class="page-controls">
          <el-button :icon="ZoomOut" circle size="small" @click="zoomOut" title="缩小" :disabled="pdfScale <= 0.5" />
          <el-button :icon="ZoomIn" circle size="small" @click="zoomIn" title="放大" :disabled="pdfScale >= 3" />
          <el-button :icon="Refresh" circle size="small" @click="refresh" />
        </div>
        <!-- 处理按钮 -->
        <div class="process-buttons">
          <el-button type="primary" :icon="List" size="small" @click="handleGoToTaskCenter">任务中心</el-button>
          <el-button
            v-if="!isSecondaryExecution && taskData"
            type="danger"
            plain
            size="small"
            @click="handleDeleteFromDetail"
          >
            {{ taskData.task_status === 0 || taskData.task_status === 1 ? '终止任务' : '删除' }}
          </el-button>
        </div>
      </div>

      <!-- 文档预览区域 -->
      <div
        class="document-area"
        v-loading="!isFolderListPreviewMode && previewRequestLoading"
        element-loading-text="文档加载中..."
      >
        <OcrFolderPreviewPanel
          v-if="isFolderListPreviewMode"
          :folder-name="currentFolderPreviewName"
          :display-total="folderPreviewDisplayTotal"
          :deleted-file-count="0"
          :deleted-folder-count="0"
          :files="currentFolderPreviewFiles"
          :loading="folderPreviewLoading"
          :is-remote="isCurrentFolderPreviewRemote"
          :total="folderPreviewTotal"
          :page-size="folderPreviewPageSize"
          :current-page="folderPreviewPage"
          :pending-delete-file-ids="[]"
          :readonly="true"
          @page-change="handleFolderPreviewPageChange"
          @view-file="handleViewFolderPreviewFile"
        />
        <!-- PDF文档预览 -->
        <div v-else class="document-preview" ref="previewRef">
            <div v-if="previewLoadFailed && !previewRequestLoading" class="preview-load-failed-wrap">
              <el-empty description="文档加载失败，请稍后重试" />
            </div>
            <template v-else>
            <div v-if="currentFile && currentFile.file_type === 'pdf'" class="pdf-container-wrapper" ref="pdfContainerWrapperRef">
              <!-- Chrome 77 兼容模式：使用 iframe 预览 -->
              <div v-if="isOldChrome && pdfSource" class="pdf-container pdf-iframe-container">
                <iframe
                  :src="pdfSource"
                  class="pdf-preview-iframe"
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
                style="width: 100%;"
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
                style="width: 100%;"
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
          <!-- 文本原文预览（MinIO 原文件，不含附件拼接内容） -->
          <div v-else-if="currentFile && isTextPreviewFile(currentFile)" class="txt-container-wrapper">
            <div v-loading="txtLoading" class="txt-container">
              <pre v-if="txtContent" class="text-preview">{{ txtContent }}</pre>
              <div v-else-if="txtLoading" class="loading-container">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <p>正在加载文本原文...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="暂无文本内容" />
              </div>
            </div>
          </div>
          <!-- 图片预览 -->
          <div v-else-if="currentFile && isImagePreviewFile(currentFile)" class="image-preview-wrapper">
            <el-image
              v-if="imagePreviewUrl"
              :src="imagePreviewUrl"
              :preview-src-list="[imagePreviewUrl]"
              fit="contain"
              style="width: 100%; height: 100%;"
              :preview-teleported="true"
            />
            <div v-else class="empty-container">
              <el-empty description="图片加载失败" />
            </div>
          </div>
          <div v-else class="empty-preview">
            <el-empty description="请选择文件进行预览">
              <el-icon class="empty-icon" :size="80" color="#c0c4cc"><Document /></el-icon>
            </el-empty>
          </div>
          </template>
        </div>
      </div>
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

    <!-- 右侧面板 - 只读模式显示 -->
    <div
      class="right-sidebar resizable-sidebar"
      :class="{ 'right-sidebar-fullwidth': !showFilePreview }"
      :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
    >
      <!-- 标签页 -->
      <div class="sidebar-tabs" :class="{ 'ocr-column-head': isSecondaryExecution }">
        <el-tabs v-model="viewerTab" @tab-change="handleTabChange">
          <el-tab-pane label="解析结果" name="parse"></el-tab-pane>
          <el-tab-pane label="智能抽取" name="extract"></el-tab-pane>
        </el-tabs>
      </div>

      <!-- 解析结果：显示提取结果 -->
      <div v-if="viewerTab === 'parse'" class="extraction-results">
        <div class="results-header">
          <h3>提取结果 ({{ currentFile && currentFile.status === 'failed' ? 0 : extractionResults.length }}项)</h3>
          <div class="header-actions">
            <el-dropdown
              v-if="extractionResults && extractionResults.length > 0 && currentFile && currentFile.status !== 'failed'"
              @command="handleExportResults"
            >
              <el-button size="small" type="primary" :icon="Download">
                导出结果
                <el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="excel">导出为Excel</el-dropdown-item>
                  <el-dropdown-item command="csv">导出为CSV</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <div class="results-list">
          <!-- 失败状态：显示失败原因 -->
          <div v-if="currentFile && currentFile.status === 'failed'" class="error-display">
            <el-alert
              type="error"
              :title="currentFile.error_message || taskData?.error_message || '处理失败'"
              :description="currentFile.error_message || taskData?.error_message || '处理过程中发生错误，请检查文件格式或联系管理员'"
              :closable="false"
              show-icon
            />
          </div>

          <!-- 成功状态：显示提取结果（表格形式） -->
          <template v-else>
            <el-table
              :data="extractionResults"
              stripe
              border
              style="width: 100%;height: 100%;"
              :row-class-name="getRowClassName"
            >
              <!-- 与导出 Excel 结构保持一致：字段名称 / 字段值 / 是否找到 / 置信度 / 状态 / 证据链 -->
              <el-table-column prop="fieldName" label="字段名称" min-width="180" />
              <el-table-column prop="fieldValue" label="字段值" min-width="320">
                <template #default="{ row }">
                  <div style="word-break: break-word; white-space: pre-wrap;">
                    {{ row.fieldValue || row.description || '暂无' }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="是否找到" width="90">
                <template #default="{ row }">
                  {{ row.is_found !== false ? '是' : '否' }}
                </template>
              </el-table-column>
              <el-table-column prop="confidence" label="置信度" width="90" />
              <el-table-column prop="status" label="状态" width="90">
                <template #default="{ row }">
                  {{ row.status || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="evidence" label="证据链" min-width="220">
                <template #default="{ row }">
                  <div style="word-break: break-word; white-space: pre-wrap;">
                    {{ row.evidence || '' }}
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <el-empty
              v-if="extractionResults.length === 0"
              description="暂无提取结果"
              :image-size="100"
            />
          </template>
        </div>
      </div>

      <!-- 智能抽取：显示只读的设置信息 -->
      <div v-if="viewerTab === 'extract'" class="readonly-extract-config">
        <div class="config-header">
          <h3>参数设置（只读）</h3>
        </div>

        <div v-if="currentFile && currentFile.settings && currentFile.settings.configured" class="config-content">
          <!-- 高级配置：与创建页样式一致，只读反显 -->
          <div class="config-section-block extract-advanced-config-wrapper">
            <div class="config-section-title">高级配置</div>
            <div class="extract-advanced-config">
              <el-form label-position="top" size="small" class="extract-advanced-form">
                <el-form-item label="附件内容合并到主文件" class="extract-advanced-form-item">
                  <el-switch
                    :model-value="displayMergeAttachments"
                    active-text="是"
                    inactive-text="否"
                    disabled
                  />
                  <div class="config-hint">
                    开启后，信息提取时将主文件与所有附件内容合并成一个整体进行抽取
                  </div>
                </el-form-item>

                <el-form-item label="切片字数" class="extract-advanced-form-item">
                  <el-input-number
                    :model-value="displayChunkSize"
                    :min="1000"
                    :max="50000"
                    :step="1000"
                    disabled
                    class="extract-advanced-number"
                  />
                  <div class="config-hint">建议 10000 ~ 30000</div>
                </el-form-item>

                <el-form-item label="冗余字数" class="extract-advanced-form-item">
                  <el-input-number
                    :model-value="displayChunkOverlap"
                    :min="0"
                    :max="5000"
                    :step="100"
                    disabled
                    class="extract-advanced-number"
                  />
                  <div class="config-hint">相邻切片间的重叠字数</div>
                </el-form-item>
              </el-form>
            </div>
          </div>

          <!-- 模式显示 -->
          <div class="mode-display" v-if="currentFile.settings.mode" style="margin-top: 20px;">
            <div class="config-label" style="margin-bottom: 8px;">模式：</div>
            <el-tag
              :type="currentFile.settings.mode === 'prompt' ? 'primary' : (currentFile.settings.field_type === 'custom' ? 'warning' : 'success')"
              size="large"
            >
              {{ currentFile.settings.mode === 'prompt' ? 'Prompt模式' : (currentFile.settings.field_type === 'custom' ? '自定义模式' : '字段模式') }}
            </el-tag>
          </div>

          <!-- Prompt模式显示 -->
          <div v-if="currentFile.settings.mode === 'prompt'" class="prompt-display" style="margin-top: 20px;">
            <div class="config-label">Prompt内容：</div>
            <div v-if="currentFile.settings.prompt && currentFile.settings.prompt.trim()" class="config-value readonly prompt-content">
              {{ currentFile.settings.prompt }}
            </div>
            <div v-else class="config-value readonly empty-prompt">
              <span style="color: #909399;">该文件未配置提示词</span>
            </div>
          </div>

          <!-- 字段模式显示 -->
          <div v-if="currentFile.settings.mode === 'field'" class="field-display" style="margin-top: 20px;">
            <!-- 模板信息显示（在字段定义之前） -->
            <div v-if="currentFile.settings.template" class="template-display" style="margin-bottom: 20px;">
              <div class="config-label" style="margin-bottom: 8px;">模板：</div>
              <div class="config-value readonly template-name" style="padding: 8px 12px;">
                {{ getTemplateDisplayName(currentFile.settings.template) }}
              </div>
            </div>

            <!-- 字段详情 -->
            <div v-if="displayFieldDefinitions && displayFieldDefinitions.length > 0" class="field-definitions">
              <div class="config-label" style="margin-bottom: 12px;">抽取配置</div>
              <div class="field-definition-list">
                <div
                  v-for="(field, index) in displayFieldDefinitions"
                  :key="field.id || index"
                  class="field-item"
                  style="margin-bottom: 12px; padding: 12px; background: #f5f7fa; border-radius: 4px;"
                >
                  <div class="field-item-content">
                    <div class="field-row" style="margin-bottom: 12px;">
                      <div class="field-label" style="font-size: 12px; color: #606266; margin-bottom: 4px;">字段名称 *</div>
                      <el-input
                        :model-value="field.name"
                        placeholder="字段名称"
                        size="small"
                        class="field-input"
                        disabled
                        readonly
                      />
                    </div>
                    <div class="field-row">
                      <div class="field-label" style="font-size: 12px; color: #606266; margin-bottom: 4px;">字段描述</div>
                      <el-input
                        :model-value="field.description || ''"
                        placeholder="对要抽取的字段进行描述"
                        size="small"
                        class="field-input"
                        type="textarea"
                        :rows="2"
                        disabled
                        readonly
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="no-field-definitions" style="margin-top: 16px;">
              <el-empty description="该文件未配置字段定义" :image-size="80" />
            </div>
          </div>
        </div>
        <div v-else class="no-config">
          <el-empty description="该文件未配置设置" :image-size="100" />
        </div>
      </div>
    </div>

    <!-- 文件数超过字典阈值：走任务中心异步导出（待后端联调） -->
    <el-dialog
      v-model="exportLargeDialogVisible"
      title="大量文件导出"
      width="480px"
      destroy-on-close
    >
      <p class="export-large-hint">
        当前任务文件数为 <strong>{{ fileList.length }}</strong>，已超过同步导出上限（<strong>{{ exportSyncMaxFiles }}</strong>，来自数据字典，失败则按 100）。
        将按下列「每批条数」拆分为多份，提交后请在 <strong>任务中心</strong> 与首页消息中查看并下载（接口联调后生效）。
      </p>
      <el-form label-width="140px" size="default">
        <el-form-item label="每批条数（行数）">
          <el-input-number
            v-model="exportLargeRowsPerChunk"
            :min="1"
            :max="Math.max(1, fileList.length)"
            style="width: 100%"
          />
          <div class="form-tip">默认等于本任务全部文件数（整批一次）。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exportLargeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="exportLargeSubmitting" @click="submitLargeExportQueue">
          提交导出
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import {
  isSamePreviewFileIdSet,
  patchPreviewFileListStatusesInPlace,
  patchPreviewTreeFolderStatusesInPlace,
  resolvePreviewFileId
} from '@/views/ocr-task-center/taskCenterPreviewSidebarTreeUtils.js'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import VueOfficePdf from '@vue-office/pdf'
import VueOfficeDocx from '@vue-office/docx'
import VueOfficeExcel from '@vue-office/excel'
import { convertDocToDocxAPI, previewFileAPI } from '@/api/fileManager.js'
import { batchLoadFileAttachmentsMap } from '@/views/file-manager-code/composables/batchLoadFileAttachments.js'
import OcrLeftSidebar from '@/views/file-manager-code/components/OcrLeftSidebar.vue'
import OcrFolderPreviewPanel from '@/views/file-manager-code/components/OcrFolderPreviewPanel.vue'
import {
  Search,
  Document,
  Folder,
  Delete,
  Plus,
  Hide,
  View,
  ArrowDown,
  ZoomIn,
  ZoomOut,
  Refresh,
  Download,
  Loading,
  List,
  DArrowLeft,
  DArrowRight,
} from '@element-plus/icons-vue'
import { mockTasks } from './mockTasks.js'
import { failedTaskExample } from './failedTaskExample.js'
import { getTaskSchedulesAPI, exportExecutionRecordsAPI, deleteTaskAPI, getTaskFolderFilesPageAPI, getTaskResultDetailAPI } from '@/api/task.js'
import { getPublicAndPrivateTemplatesAPI, getTemplateDetailAPI } from '@/api/template.js'
import { getDictItemsByCodeAPI } from '@/api/dict.js'
import {
  parseContractDisposalResult,
  mapContractToExtractionResults,
  getInformationExtractionFromSettings
} from '@/utils/contractDisposalParser.js'

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
  },
  /** 是否为任务中心等二次执行/嵌入场景 */
  isSecondaryExecution: {
    type: Boolean,
    default: false
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

/** 是否显示中间预览区域（供左侧公共组件切换） */
const showFilePreview = ref(true)

// 任务数据
const taskData = ref(null)
/** 任务详情原始对象（保留 selection_summary/runtime_nodes 等字段） */
const rawTaskDetail = ref(null)

// 文件列表（从任务数据中获取）
const fileList = ref([])

/** 任务文件附件映射：file_uuid -> 附件列表 */
const fileAttachmentsMap = ref({})

/**
 * 解析文件管理主文件 ID（附件绑定使用 file_uuid）
 * @param {Object} file 文件对象
 * @returns {string} 主文件 ID
 */
const resolveAttachmentFileId = (file) => {
  if (!file) return ''
  return String(file.file_uuid || file.fileId || file.file_id || '').trim()
}

/**
 * 将已缓存的附件元数据写入文件对象（不发起请求）
 * @param {Object|null} file 文件对象
 * @returns {Object|null} 写入后的文件对象
 */
const enrichFileWithAttachmentMeta = (file) => {
  if (!file) return file
  const fileId = resolveAttachmentFileId(file)
  if (!fileId) return file
  const cached = fileAttachmentsMap.value[fileId]
  if (!Array.isArray(cached)) return file
  file.attachmentCount = cached.length
  file.attachments = cached
  return file
}

/**
 * 为 fileList 中每个文件回填附件数量（来自 fileAttachmentsMap 缓存）
 * @returns {void}
 */
const applyAttachmentCountsToFileList = () => {
  ;(fileList.value || []).forEach((file) => {
    enrichFileWithAttachmentMeta(file)
  })
}

/**
 * 为任务文件列表加载附件并写入 attachmentCount（仅请求未缓存的主文件）
 * @returns {Promise<void>}
 */
const refreshTaskFileAttachments = async () => {
  const fileIds = [...new Set(
    (fileList.value || []).map(resolveAttachmentFileId).filter(Boolean)
  )]
  if (fileIds.length === 0) {
    applyAttachmentCountsToFileList()
    return
  }

  fileAttachmentsMap.value = await batchLoadFileAttachmentsMap(
    fileIds,
    fileAttachmentsMap.value
  )

  applyAttachmentCountsToFileList()
}

// 当前选中的文件
const currentFile = ref(null)

/** 文件树字段映射（供 OcrLeftSidebar el-tree-v2 使用） */
const fileTreeProps = {
  value: 'treeKey',
  label: 'name',
  children: 'children'
}

/** 左树点击文件夹后，中间切换为文件夹列表模式 */
const currentFolderPreviewPath = ref('')
/** 当前文件夹显示名 */
const currentFolderPreviewName = ref('')
/** 文件夹分页数据（接口返回） */
const currentFolderPreviewRemoteFiles = ref([])
/** 文件夹分页数据来源：是否来自接口 */
const isCurrentFolderPreviewRemote = ref(false)
/** 文件夹列表加载中 */
const folderPreviewLoading = ref(false)
/** 文件夹分页：当前页 */
const folderPreviewPage = ref(1)
/** 文件夹分页：每页条数 */
const folderPreviewPageSize = ref(100)
/** 文件夹分页：总条数 */
const folderPreviewTotal = ref(0)
/** 当前点击的文件夹 ID（用于翻页请求） */
const currentFolderPreviewFolderId = ref('')

// 中间查看器
const viewerTab = ref('parse') // 'parse' | 'extract'

// PDF相关
const pdfSource = ref(null)
const pdfLoading = ref(false)
const pdfScale = ref(1)
const pdfContainerWrapperRef = ref(null) // PDF容器wrapper ref
const pdfViewerRef = ref(null) // PDF查看器ref
const previewRequestLoading = ref(false)
const previewLoadFailed = ref(false)
const previewRequestToken = ref(0)

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

// 文本原文预览（主文件 MinIO 原文件，非附件合并内容）
const txtContent = ref('')
const txtLoading = ref(false)
const imagePreviewUrl = ref(null)

const TEXT_PREVIEW_TYPES = new Set(['txt', 'md', 'log', 'csv'])
const IMAGE_PREVIEW_TYPES = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'image'])

/**
 * 解析任务文件在文件管理中的 file_id（预览/附件 API 使用 file_uuid）
 * @param {Object} file 文件对象
 * @returns {string} 文件管理 file_id
 */
const resolveWjglFileId = (file) => {
  if (!file) return ''
  return String(file.file_uuid || file.file_id || '').trim()
}

/**
 * 归一化任务文件类型（优先 file_type，否则从文件名推断）
 * @param {Object} file 文件对象
 * @returns {string} 小写文件类型
 */
const normalizeTaskFileType = (file) => {
  const fromField = String(file?.file_type || '').toLowerCase()
  if (fromField) return fromField
  const name = String(file?.file_name || '')
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return name.slice(dot + 1).toLowerCase()
}

/** 是否为文本类预览文件 */
const isTextPreviewFile = (file) => TEXT_PREVIEW_TYPES.has(normalizeTaskFileType(file))

/** 是否为图片预览文件 */
const isImagePreviewFile = (file) => {
  const ft = normalizeTaskFileType(file)
  return IMAGE_PREVIEW_TYPES.has(ft) || ft.startsWith('image')
}

// 右侧面板宽度
const rightSidebarWidth = ref(400)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)

/** 左侧面板宽度缓存键（与信息提取工具页共用） */
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'ocr-viewer-left-sidebar-width'
/** 左侧面板最小宽度（px，与信息提取工具页一致） */
const LEFT_SIDEBAR_WIDTH_MIN = 260
/** 左侧面板最大宽度（px） */
const LEFT_SIDEBAR_WIDTH_MAX = 560
/** 历史默认左栏宽度（px） */
const LEFT_SIDEBAR_LEGACY_DEFAULT_WIDTH = 240

/**
 * 解析侧栏宽度 localStorage 值
 * @param {string|null} raw 原始字符串
 * @returns {number|null} 有效宽度或 null
 */
const parseSidebarWidth = (raw) => {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * 将左栏宽度限制在允许范围内
 * @param {number} width 目标宽度
 * @returns {number} 钳制后的宽度
 */
const clampLeftSidebarWidth = (width) =>
  Math.min(LEFT_SIDEBAR_WIDTH_MAX, Math.max(LEFT_SIDEBAR_WIDTH_MIN, width))

const leftSidebarWidth = ref(320)
const isResizingLeft = ref(false)
const leftResizeStartX = ref(0)
const leftResizeStartWidth = ref(0)

// 提取结果
const extractionResults = ref([])

// 模板选项列表（用于显示模板名称）
const templateOptions = ref([])

// 初始化加载状态
const initialLoading = ref(true)

/** 同步导出允许的最大任务文件数（数据字典 `text-extract-export-max-sync-files`，缺省 100） */
const exportSyncMaxFiles = ref(100)
const exportLargeDialogVisible = ref(false)
const exportLargeRowsPerChunk = ref(1)
const exportLargeSubmitting = ref(false)

// 当前文件的模板字段定义（用于显示）
const currentFileTemplateFields = ref([])

// 计算属性：获取要显示的字段定义（优先使用 settings 中的，如果没有则从模板加载）
const displayFieldDefinitions = computed(() => {
  if (!currentFile.value || !currentFile.value.settings) {
    return []
  }

  // 如果有 fieldDefinitions，直接使用
  if (currentFile.value.settings.fieldDefinitions && currentFile.value.settings.fieldDefinitions.length > 0) {
    return currentFile.value.settings.fieldDefinitions
  }

  // 如果没有 fieldDefinitions 但有模板，从模板中加载
  if (currentFile.value.settings.template && currentFileTemplateFields.value.length > 0) {
    return currentFileTemplateFields.value
  }

  return []
})

/** 智能抽取高级配置：附件合并（兼容 snake_case / camelCase，缺省 false） */
const displayMergeAttachments = computed(() => {
  const s = currentFile.value?.settings
  if (!s) return false
  if (typeof s.merge_attachments === 'boolean') return s.merge_attachments
  if (typeof s.mergeAttachments === 'boolean') return s.mergeAttachments
  return false
})

/** 智能抽取高级配置：切片字数（兼容 snake_case / camelCase，缺省 12000） */
const displayChunkSize = computed(() => {
  const s = currentFile.value?.settings
  if (!s) return 12000
  const n = typeof s.chunk_size === 'number' ? s.chunk_size
    : (typeof s.chunkSize === 'number' ? s.chunkSize : null)
  return Number.isFinite(n) ? n : 12000
})

/** 智能抽取高级配置：冗余字数（兼容 overlap / chunkOverlap，缺省 200） */
const displayChunkOverlap = computed(() => {
  const s = currentFile.value?.settings
  if (!s) return 200
  const n = typeof s.overlap === 'number' ? s.overlap
    : (typeof s.chunkOverlap === 'number' ? s.chunkOverlap : null)
  return Number.isFinite(n) ? n : 200
})

// 状态映射：后端状态码 -> 前端状态字符串
const statusMap = {
  0: 'pending',      // 未开始
  1: 'processing',   // 进行中
  2: 'completed',    // 已完成
  3: 'failed'        // 失败
}

const isUserTerminatedTask = (taskLike) => {
  const taskStatus = Number(taskLike?.task_status)
  if (taskStatus !== 3) return false
  const notes = String(taskLike?.task_notes || taskLike?.task_remark || '')
  return notes.includes('用户终止任务')
}

/**
 * 判断字符串是否形如 UUID
 * @param {string} value 待判断字符串
 * @returns {boolean} true 表示是 UUID 风格
 */
const isUuidLike = (value) => {
  if (!value || typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

/**
 * 判断是否为可展示的文件夹名称（过滤空串/纯 UUID）
 * @param {string} value 文件夹名称候选值
 * @returns {boolean} true 表示可展示
 */
const isMeaningfulFolderName = (value) => {
  if (!value || typeof value !== 'string') return false
  const name = value.trim()
  if (!name) return false
  if (isUuidLike(name)) return false
  return true
}

/**
 * 从文件 source_refs 构建 file_uuid -> refs 映射
 * @param {Array} resultList task_schedule_result_list 原始数组
 * @returns {Map<string, Array>} 文件到来源引用的映射
 */
const buildSourceRefsFromResultList = (resultList) => {
  const sourceRefMap = new Map()
  ;(resultList || []).forEach((file) => {
    const fileUuid = file?.file_uuid || file?.FILE_UUID || file?.result_uuid || file?.RESULT_UUID
    if (!fileUuid) return
    let refs = file?.source_refs
    if (!refs && file?.parameter_settings) {
      let settings = file.parameter_settings
      try {
        if (typeof settings === 'string') settings = JSON.parse(settings)
      } catch {
        // 忽略 parameter_settings 解析异常，保持原始 refs 流程
      }
      refs = settings?.source_refs
    }
    try {
      if (typeof refs === 'string') refs = JSON.parse(refs)
    } catch {
      // 忽略 source_refs 字符串解析异常
    }
    if (Array.isArray(refs)) {
      sourceRefMap.set(String(fileUuid), refs)
    }
  })
  return sourceRefMap
}

/**
 * 从 source_refs 中提取 folder_id -> folderName 映射
 * @param {Map<string, Array>} sourceRefMap 文件到来源引用映射
 * @returns {Map<string, string>} 文件夹ID到名称映射
 */
const buildFolderNameMapFromSourceRefs = (sourceRefMap) => {
  const folderNameMap = new Map()
  sourceRefMap.forEach((refs) => {
    ;(refs || []).forEach((ref) => {
      if (!ref || ref.source_type !== 'folder' || !ref.source_id) return
      const folderName = ref.source_name || ref.folder_path
      if (isMeaningfulFolderName(folderName)) {
        folderNameMap.set(String(ref.source_id), folderName)
      }
    })
  })
  return folderNameMap
}

/**
 * 规范化文件夹路径字符串
 * @param {string} path 原始路径
 * @returns {string} 规范化路径
 */
const normalizeFolderPathForTree = (path) => {
  return String(path || '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

/**
 * 从文件夹节点中挑选展示名称
 * @param {Object} folderNode 文件夹节点对象
 * @param {Map<string, string>} folderNameMap 文件夹ID到名称映射
 * @returns {string} 最终展示名称
 */
const pickDisplayFolderName = (folderNode, folderNameMap) => {
  const folderId = folderNode?.folder_id
  const candidates = [
    folderNode?.name,
    folderNode?.folder_name,
    folderId ? folderNameMap.get(String(folderId)) : '',
    folderNode?.folder_path
  ]
  const picked = candidates.find((item) => isMeaningfulFolderName(item))
  return picked || ''
}

// 转换后端文件数据为前端格式
const convertFileData = (file) => {
  // 解析参数设置（parameter_template 可能是字符串或对象）
  let settings = null
  try {
    if (file.parameter_settings) {
      const paramSettings = typeof file.parameter_settings === 'string'
        ? JSON.parse(file.parameter_settings)
        : file.parameter_settings
      settings = paramSettings
      // 确保有 configured、mode、field_type 标志
      if (!settings.configured) settings.configured = true
      if (!settings.mode) settings.mode = 'field'
      if (settings.mode === 'field' && !settings.field_type) {
        settings.field_type = (settings.template && String(settings.template).trim()) ? 'template' : 'custom'
      }
    } else if (file.parameter_template !== undefined && file.parameter_template !== null) {
      // 如果有 prompt_uuid 或 PROMPT_UUID，说明使用的是模板（字段模式）
      // 优先检查 PROMPT_UUID（大写），然后检查 prompt_uuid（小写）
      const promptUuid = file.PROMPT_UUID || file.prompt_uuid
      if (promptUuid) {
        settings = {
          mode: 'field',
          field_type: 'template',
          template: promptUuid,
          fieldDefinitions: [],
          configured: true
        }
        // 如果 parameter_template 是数组，解析字段定义
        if (Array.isArray(file.parameter_template) && file.parameter_template.length > 0) {
          settings.fieldDefinitions = file.parameter_template.map(field => ({
            name: field.name || field.fieldName || '',
            description: field.description || field.fieldDescription || ''
          }))
        } else if (typeof file.parameter_template === 'string') {
          try {
            const parsed = JSON.parse(file.parameter_template)
            if (Array.isArray(parsed) && parsed.length > 0) {
              settings.fieldDefinitions = parsed.map(field => ({
                name: field.name || field.fieldName || '',
                description: field.description || field.fieldDescription || ''
              }))
            }
          } catch {
            // 解析失败，保持空数组（有模板就是字段模式）
          }
        }
      } else {
        // 没有 prompt_uuid，根据 parameter_template 的类型判断
        if (typeof file.parameter_template === 'string') {
          try {
            const parsed = JSON.parse(file.parameter_template)
            // 如果是数组，说明是字段模式
            if (Array.isArray(parsed)) {
              settings = {
                mode: 'field',
                field_type: 'custom',
                fieldDefinitions: parsed.map(field => ({
                  name: field.name || field.fieldName || '',
                  description: field.description || field.fieldDescription || ''
                })),
                configured: true
              }
            } else {
              // 如果是对象，可能包含mode等信息
              settings = {
                ...parsed,
                configured: true
              }
              // 如果没有 mode，根据其他字段推断
              if (!settings.mode) {
                // 优先检查是否有模板，有模板就是字段模式
                if (settings.template) {
                  settings.mode = 'field'
                } else if (settings.fieldDefinitions && settings.fieldDefinitions.length > 0) {
                  // 如果有字段定义，判断为字段模式
                  settings.mode = 'field'
                } else if (settings.prompt && settings.prompt.trim()) {
                  // 如果有 prompt 内容，判断为 prompt 模式
                  settings.mode = 'prompt'
                }
                // 如果都没有，不设置 mode，让前端根据实际情况显示
              }
            }
          } catch {
            // 如果不是JSON字符串，检查是否有其他字段表明是字段模式
            // 如果有 template 相关字段，判断为字段模式，否则才是 prompt 模式
            if (file.template || file.template_uuid) {
              settings = {
                mode: 'field',
                template: file.template || file.template_uuid,
                fieldDefinitions: [],
                configured: true
              }
            } else {
              // 没有任何模板标识，才判断为 prompt 模式
              settings = {
                mode: 'prompt',
                prompt: file.parameter_template,
                configured: true
              }
            }
          }
        } else if (Array.isArray(file.parameter_template)) {
          // 如果是数组，说明是字段模式（无 prompt_uuid 时推断为自定义）
          settings = {
            mode: 'field',
            field_type: 'custom',
            fieldDefinitions: file.parameter_template.map(field => ({
              name: field.name || field.fieldName || '',
              description: field.description || field.fieldDescription || ''
            })),
            configured: true
          }
        }
      }
    }
  } catch (e) {
    console.warn('解析参数设置失败:', e)
  }

  // 解析 disposal_result（包含 final_result）
  // disposal_result 是字符串，需要转换为对象
  let disposalResult = null
  let finalResult = null
  try {
    if (file.disposal_result) {
      // 如果已经是对象，直接使用
      if (typeof file.disposal_result === 'object' && file.disposal_result !== null) {
        disposalResult = file.disposal_result
        finalResult = disposalResult.final_result
          || (disposalResult.data && disposalResult.data.final_result)
          || (disposalResult.result && disposalResult.result.final_result)
      } else if (typeof file.disposal_result === 'string') {
        const disposalStr = file.disposal_result.trim()

        // 先尝试标准 JSON 解析
        try {
          disposalResult = JSON.parse(disposalStr)
          finalResult = disposalResult && (
            disposalResult.final_result
            || (disposalResult.data && disposalResult.data.final_result)
            || (disposalResult.result && disposalResult.result.final_result)
          )
        } catch (jsonError) {
          // 如果标准 JSON 解析失败，可能是 Python 字典格式（单引号、True/False/None）
          // 使用更安全的方式转换 Python 字典格式为 JSON 格式
          try {
            // 创建一个转换函数，将 Python 字典字符串转换为 JSON 字符串
            // 使用更完善的转换逻辑，按顺序处理
            let jsonStr = disposalStr
              // 1. 先处理布尔值和 None（必须在替换引号之前）
              .replace(/:\s*True\b/g, ': true')
              .replace(/:\s*False\b/g, ': false')
              .replace(/:\s*None\b/g, ': null')
              .replace(/,\s*True\b/g, ', true')
              .replace(/,\s*False\b/g, ', false')
              .replace(/,\s*None\b/g, ', null')
              // 2. 处理键名：将 'key': 转换为 "key":（必须在处理值之前）
              .replace(/'([^']+)'\s*:/g, '"$1":')
              // 3. 处理冒号后的字符串值：将 : 'value' 转换为 : "value"
              .replace(/:\s*'([^']*)'(\s*[,}])/g, ': "$1"$2')
              // 4. 处理数组中的字符串
              .replace(/\[\s*'([^']+)'\s*\]/g, '["$1"]')
              // 5. 处理对象中剩余的字符串值（在逗号或大括号后的值）
              .replace(/([{,]\s*)'([^']*)'(\s*[,}])/g, '$1"$2"$3')
              // 6. 最后处理所有剩余的单引号字符串（但不在键名位置）
              .replace(/([^:])\s*'([^']*)'(\s*[,}])/g, '$1 "$2"$3')

            disposalResult = JSON.parse(jsonStr)
            if (disposalResult) {
              finalResult = disposalResult.final_result
                || (disposalResult.data && disposalResult.data.final_result)
                || (disposalResult.result && disposalResult.result.final_result)
            }
          } catch (pythonError) {
            console.warn('标准 JSON 解析失败:', jsonError)
            console.warn('Python 格式转换也失败:', pythonError)
            console.warn('原始 disposal_result (前500字符):', disposalStr.substring(0, 500))

            // 最后尝试：使用更完善的 Python 字典转 JSON 转换
            try {
              // 更完善的 Python 字典转 JSON 转换函数
              let jsonStr = disposalStr

              // 1. 先处理布尔值和 None（必须在替换引号之前）
              jsonStr = jsonStr
                .replace(/:\s*True\b/g, ': true')
                .replace(/:\s*False\b/g, ': false')
                .replace(/:\s*None\b/g, ': null')
                .replace(/,\s*True\b/g, ', true')
                .replace(/,\s*False\b/g, ', false')
                .replace(/,\s*None\b/g, ', null')

              // 2. 处理键名：将 'key': 转换为 "key":（使用更精确的正则，避免匹配值）
              jsonStr = jsonStr.replace(/'([^']+)'\s*:/g, '"$1":')

              // 3. 处理字符串值：将冒号后的 'value' 转换为 "value"
              // 匹配 : 'value' 或 : 'value', 或 : 'value'}
              jsonStr = jsonStr.replace(/:\s*'([^']*)'(\s*[,}])/g, ': "$1"$2')

              // 4. 处理数组中的字符串
              jsonStr = jsonStr.replace(/\[\s*'([^']+)'\s*\]/g, '["$1"]')

              // 5. 处理剩余的字符串值（在逗号或大括号后的值）
              jsonStr = jsonStr.replace(/([{,]\s*)'([^']*)'(\s*[,}])/g, '$1"$2"$3')

              // 6. 最后处理所有剩余的单引号字符串（但不在键名位置）
              // 使用更安全的方法：只替换不在冒号前的单引号
              jsonStr = jsonStr.replace(/([^:])\s*'([^']*)'(\s*[,}])/g, '$1 "$2"$3')

              // 尝试解析整个字符串
              disposalResult = JSON.parse(jsonStr)
              if (disposalResult) {
                finalResult = disposalResult.final_result
                  || (disposalResult.data && disposalResult.data.final_result)
                  || (disposalResult.result && disposalResult.result.final_result)
              }
              if (!finalResult) {
                // 如果整个字符串解析失败，尝试只提取 final_result 部分
                const finalResultMatch = jsonStr.match(/"final_result"\s*:\s*({.+?})(?=,\s*["']|$)/s)
                if (finalResultMatch && finalResultMatch[1]) {
                  try {
                    finalResult = JSON.parse(finalResultMatch[1])
                  } catch (e) {
                    console.warn('解析 final_result 部分失败:', e)
                  }
                }
              }
            } catch (manualError) {
              console.warn('手动解析 disposal_result 失败:', manualError)
              // 不抛出错误，静默失败，避免影响其他功能
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('处理 disposal_result 失败:', e)
    if (file.disposal_result) {
      console.warn('disposal_result 类型:', typeof file.disposal_result)
      console.warn('disposal_result 原始值 (前500字符):',
        typeof file.disposal_result === 'string'
          ? file.disposal_result.substring(0, 500)
          : JSON.stringify(file.disposal_result).substring(0, 500))
    }
  }

  let sourceFolderPaths = []
  let sourceRefs = []
  try {
    let parsedSourceRefs = file.source_refs
    if (!parsedSourceRefs && file.parameter_settings) {
      let paramSettings = file.parameter_settings
      if (typeof paramSettings === 'string') {
        paramSettings = JSON.parse(paramSettings)
      }
      parsedSourceRefs = paramSettings?.source_refs
    }
    if (typeof parsedSourceRefs === 'string') {
      parsedSourceRefs = JSON.parse(parsedSourceRefs)
    }
    if (Array.isArray(parsedSourceRefs)) {
      sourceRefs = parsedSourceRefs
      sourceFolderPaths = parsedSourceRefs
        .filter(ref => ref && (ref.source_type === 'folder' || ref.folder_path || ref.source_name))
        .map(ref => ref.folder_path || ref.source_name || '')
        .filter(Boolean)
    }
  } catch (e) {
    console.warn('解析 source_refs 失败:', e)
  }

  return {
    file_id: file.file_uuid || file.result_uuid || '', // 兼容字段，用于向后兼容
    file_uuid: file.file_uuid || file.FILE_UUID || '', // 文件UUID
    result_uuid: file.result_uuid || file.RESULT_UUID || '', // 结果UUID（主要标识符，用于高亮匹配）
    file_name: file.file_name || '',
    file_type: (file.file_type || '').toLowerCase(),
    file_size: file.file_size || '0',
    status: statusMap[file.processing_status] || 'pending',
    processing_status: file.processing_status,
    error_message: file.error_message || file.ERROR_MESSAGE || '',
    file_url: file.file_url || file.FILE_URL || '',
    settings: settings,
    parameter_settings: file.parameter_settings || file.PARAMETER_SETTINGS || '',
    progress: getProgressText(file.processing_status),
    disposal_result: file.disposal_result || file.DISPOSAL_RESULT || '',
    disposal_result_parsed: disposalResult, // 解析后的 disposal_result
    final_result: finalResult, // 提取的 final_result
    prompt_uuid: file.prompt_uuid || file.PROMPT_UUID || '', // 模板UUID
    source_folder_paths: sourceFolderPaths,
    source_refs: sourceRefs
  }
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
    files = task.task_schedule_result_list.map(convertFileData)
  }

  const isTerminated = isUserTerminatedTask(task)
  return {
    task_id: task.task_uuid,
    task_name: task.task_name || '',
    agent_id: task.tool_uuid || '',
    agent_name: task.tool_name || '',
    status: isTerminated ? 'terminated' : (statusMap[task.task_status] || 'pending'),
    task_status: task.task_status,
    current_progress: isTerminated ? '已终止' : getProgressText(task.task_status),
    file_count: task.file_num || '0',
    created_at: task.create_time || '',
    task_remark: task.task_notes || '',
    create_user_uuid: task.create_user_uuid || '',
    create_user_name: task.create_user_name || '',
    files: files,
    is_terminated: isTerminated
  }
}

/**
 * 判断任务详情是否包含 selection 快照
 * @param {Object} detail 任务详情对象
 * @returns {boolean} true 表示含有文件或文件夹选择快照
 */
const hasSelectionSnapshot = (detail) => {
  const sources = detail?.selection_summary?.selection_sources
  const folderNodes = sources?.folders
  const fileNodes = sources?.files
  return (Array.isArray(folderNodes) && folderNodes.length > 0)
    || (Array.isArray(fileNodes) && fileNodes.length > 0)
}

/**
 * 构建“文件夹ID -> 任务文件状态列表”映射（用于显示文件夹状态）
 * @param {Array} resultList 任务文件结果列表
 * @param {Map<string, Array>} sourceRefMap 文件来源映射
 * @returns {Map<string, Array<number>>} 文件夹状态聚合映射
 */
const buildFolderStatusMap = (resultList, sourceRefMap) => {
  const folderIdToStatusList = new Map()
  ;(resultList || []).forEach((r) => {
    const fileUuid = String(r.file_uuid || r.FILE_UUID || r.result_uuid || r.RESULT_UUID || '')
    if (!fileUuid) return
    const status = Number(r.processing_status)
    const refs = sourceRefMap.get(fileUuid) || []
    const folderRefs = refs.filter((ref) => ref && ref.source_type === 'folder' && ref.source_id)
    folderRefs.forEach((ref) => {
      const folderId = String(ref.source_id)
      const statusList = folderIdToStatusList.get(folderId) || []
      statusList.push(Number.isNaN(status) ? 0 : status)
      folderIdToStatusList.set(folderId, statusList)
    })
  })
  return folderIdToStatusList
}

/**
 * 将 selection_summary.folders 转换为左侧树文件夹节点
 * @param {Object} folderNode 原始文件夹节点
 * @param {Map<string, string>} folderNameMap 文件夹名称映射
 * @param {Map<string, Array<number>>} folderStatusMap 文件夹状态映射
 * @param {string} parentPath 父路径
 * @returns {Object} 左侧树文件夹节点
 */
const mapSelectionFolderToSidebarNode = (folderNode, folderNameMap, folderStatusMap, parentPath = '') => {
  const folderId = String(folderNode?.folder_id || '')
  const displayName = pickDisplayFolderName(folderNode, folderNameMap) || '文件夹'
  const folderPath = normalizeFolderPathForTree(parentPath ? `${parentPath}/${displayName}` : displayName)
  const ownStatusList = folderStatusMap.get(folderId) || []
  const childNodes = Array.isArray(folderNode?.children)
    ? folderNode.children.map((child) => mapSelectionFolderToSidebarNode(child, folderNameMap, folderStatusMap, folderPath))
    : []
  const failed = ownStatusList.some((s) => Number(s) === 3) || childNodes.some((n) => String(n.sourceFile?.status || '') === 'failed')
  const running = ownStatusList.some((s) => Number(s) === 1) || childNodes.some((n) => {
    const st = String(n.sourceFile?.status || '')
    return st === 'processing' || st === 'pending'
  })
  const folderStatus = failed ? 'failed' : (running ? 'processing' : (ownStatusList.length > 0 ? 'completed' : 'pending'))
  return {
    treeKey: `folder:${folderId || folderPath || Math.random()}`,
    name: displayName,
    nodeType: 'folder',
    folderId,
    folderPath,
    sourceFile: {
      status: folderStatus
    },
    children: childNodes
  }
}

/**
 * 将文件结果行转换为左树文件节点
 * @param {Object} file 文件结果对象（已转换）
 * @returns {Object} 左树文件节点
 */
const mapFileToSidebarNode = (file) => {
  enrichFileWithAttachmentMeta(file)
  const fileId = String(file.result_uuid || file.file_uuid || file.file_id || file.file_name || '')
  return {
    treeKey: `file:${fileId}`,
    name: file.file_name || '未命名文件',
    nodeType: 'file',
    sourceFile: file
  }
}

/**
 * 按任务详情构建左侧“文件夹+文件”树（预览模式）
 * @param {Object} detail 任务详情原始对象
 * @param {Array} convertedFiles 已转换文件列表
 * @returns {Array} 左侧树数据
 */
const buildPreviewSidebarTreeFromDetail = (detail, convertedFiles) => {
  const files = Array.isArray(convertedFiles) ? convertedFiles : []
  if (!detail) {
    return files.map(mapFileToSidebarNode)
  }
  if (!hasSelectionSnapshot(detail)) {
    const runtimeFallbackTree = buildPreviewSidebarTreeFromRuntimeNodes(detail, files)
    if (runtimeFallbackTree.length > 0) {
      return runtimeFallbackTree
    }
    return files.map(mapFileToSidebarNode)
  }
  const sources = detail.selection_summary?.selection_sources || {}
  const selectedFolders = Array.isArray(sources.folders) ? sources.folders : []
  const sourceRefMap = buildSourceRefsFromResultList(detail.task_schedule_result_list || [])
  const folderNameMap = buildFolderNameMapFromSourceRefs(sourceRefMap)
  const folderStatusMap = buildFolderStatusMap(detail.task_schedule_result_list || [], sourceRefMap)

  const folderNodes = selectedFolders.map((folder) => mapSelectionFolderToSidebarNode(folder, folderNameMap, folderStatusMap))
  const folderIdMap = new Map()
  const collectFolder = (nodes) => {
    ;(nodes || []).forEach((node) => {
      if (node.nodeType === 'folder' && node.folderId) {
        folderIdMap.set(String(node.folderId), node)
      }
      collectFolder(node.children || [])
    })
  }
  collectFolder(folderNodes)

  const rootFileNodes = []
  files.forEach((file) => {
    const node = mapFileToSidebarNode(file)
    const refs = Array.isArray(file.source_refs) ? file.source_refs : []
    const folderRef = refs.find((ref) => ref && ref.source_type === 'folder' && ref.source_id && folderIdMap.has(String(ref.source_id)))
    if (folderRef) {
      folderIdMap.get(String(folderRef.source_id)).children.push(node)
    } else {
      rootFileNodes.push(node)
    }
  })
  return [...folderNodes, ...rootFileNodes]
}

/**
 * 将运行时节点状态码转换为预览侧栏可识别状态
 * @param {number|string} status 运行时状态（0/1/2/3 或文本）
 * @returns {string} completed/processing/failed/pending
 */
const mapRuntimeStatusToFileStatus = (status) => {
  const n = Number(status)
  if (n === 2) return 'completed'
  if (n === 3) return 'failed'
  if (n === 1) return 'processing'
  if (n === 0) return 'pending'
  const text = String(status || '').toLowerCase()
  if (text === 'completed' || text === 'success') return 'completed'
  if (text === 'failed' || text === 'error') return 'failed'
  if (text === 'processing' || text === 'running') return 'processing'
  return 'pending'
}

/**
 * 判断节点是否为“内容提取”步骤节点
 * @param {Object} node 运行时树节点
 * @returns {boolean} true 表示是内容提取步骤
 */
const isExtractStepRuntimeNode = (node) => {
  const key = String(node?.key || node?.step_key || '').toLowerCase()
  const name = String(node?.name || node?.subtask_display_name || '').toLowerCase()
  return key.includes('extract') || name.includes('内容提取') || name.includes('文本提取')
}

/**
 * 在运行时树中查找“内容提取”步骤并返回其 children
 * @param {Array} nodes 运行时树节点数组
 * @returns {Array} 内容提取步骤下的子节点数组
 */
const findExtractChildrenFromRuntimeNodes = (nodes) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return []
  }
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node) continue
    if (isExtractStepRuntimeNode(node) && Array.isArray(node.children) && node.children.length > 0) {
      return node.children
    }
    const sub = findExtractChildrenFromRuntimeNodes(node.children || [])
    if (sub.length > 0) {
      return sub
    }
  }
  return []
}

/**
 * 通过运行时节点中的 key 定位 fileList 里的文件对象
 * @param {Object} runtimeNode 运行时文件节点
 * @param {Array} files 已转换文件列表
 * @returns {Object|null} 匹配文件对象
 */
const findFileByRuntimeNode = (runtimeNode, files) => {
  const key = String(runtimeNode?.key || runtimeNode?.id || '').trim()
  if (!key) return null
  const list = Array.isArray(files) ? files : []
  return list.find((file) => {
    const uuid1 = String(file.result_uuid || '')
    const uuid2 = String(file.file_uuid || '')
    const uuid3 = String(file.file_id || '')
    return key === uuid1 || key === uuid2 || key === uuid3
  }) || null
}

/**
 * 将“内容提取”运行时子树映射为 TaskResultViewer 左树节点
 * @param {Object} runtimeNode 运行时子节点（folder_item/file_item）
 * @param {Array} files 已转换文件列表
 * @param {string} parentPath 父级路径
 * @returns {Object|null} 左树节点
 */
const mapRuntimeExtractNodeToSidebarNode = (runtimeNode, files, parentPath = '') => {
  if (!runtimeNode) return null
  const nodeType = String(runtimeNode.node_type || '')
  if (nodeType === 'folder_item') {
    const folderId = String(runtimeNode.folder_id || runtimeNode.key || runtimeNode.id || '')
    const rawName = String(runtimeNode.name || '文件夹')
    const folderName = rawName.replace(/\s*\(\d+\)\s*$/, '')
    const folderPath = normalizeFolderPathForTree(parentPath ? `${parentPath}/${folderName}` : folderName)
    const children = (runtimeNode.children || [])
      .map((child) => mapRuntimeExtractNodeToSidebarNode(child, files, folderPath))
      .filter(Boolean)
    return {
      treeKey: `folder:runtime:${folderId || folderPath || Math.random()}`,
      name: folderName || rawName || '文件夹',
      nodeType: 'folder',
      folderId,
      folderPath,
      sourceFile: {
        status: mapRuntimeStatusToFileStatus(runtimeNode.status)
      },
      children
    }
  }
  if (nodeType === 'file_item') {
    const matchedFile = findFileByRuntimeNode(runtimeNode, files)
    if (matchedFile) {
      return mapFileToSidebarNode(matchedFile)
    }
    const key = String(runtimeNode.key || runtimeNode.id || runtimeNode.name || '')
    const fallbackSourceFile = enrichFileWithAttachmentMeta({
      result_uuid: key,
      file_uuid: key,
      file_id: key,
      file_name: runtimeNode.name || '未命名文件',
      status: mapRuntimeStatusToFileStatus(runtimeNode.status),
      file_type: '',
      file_url: ''
    })
    return {
      treeKey: `file:runtime:${key}`,
      name: runtimeNode.name || '未命名文件',
      nodeType: 'file',
      sourceFile: fallbackSourceFile
    }
  }
  return null
}

/**
 * 基于运行时树中的“内容提取”节点构建左树兜底数据
 * @param {Object} detail 任务详情对象
 * @param {Array} files 已转换文件列表
 * @returns {Array} 左树节点数组
 */
const buildPreviewSidebarTreeFromRuntimeNodes = (detail, files) => {
  const runtimeNodes = (Array.isArray(detail?.runtime_nodes) && detail.runtime_nodes.length > 0)
    ? detail.runtime_nodes
    : (Array.isArray(detail?.step_tree) ? detail.step_tree : [])
  const extractChildren = findExtractChildrenFromRuntimeNodes(runtimeNodes)
  if (!extractChildren.length) {
    return []
  }
  const mapped = extractChildren
    .map((node) => mapRuntimeExtractNodeToSidebarNode(node, files))
    .filter(Boolean)
  return mapped
}

/**
 * 按关键字递归过滤左侧树节点（文件与文件夹均参与匹配）
 * @param {Object} node 左侧树节点
 * @param {string} keywordLower 小写关键字
 * @returns {Object|null} 命中节点返回节点，否则返回 null
 */
const filterLeftTreeNodeByKeyword = (node, keywordLower) => {
  if (!node) return null
  const selfMatched = String(node.name || '').toLowerCase().includes(keywordLower)
  if (node.nodeType === 'file') {
    return selfMatched ? { ...node } : null
  }
  const filteredChildren = (node.children || [])
    .map((child) => filterLeftTreeNodeByKeyword(child, keywordLower))
    .filter(Boolean)
  if (!selfMatched && filteredChildren.length === 0) {
    return null
  }
  return {
    ...node,
    children: filteredChildren
  }
}

/** 左侧基础树（稳定引用；状态轮询仅就地 patch，避免整树替换导致展开收起） */
const sidebarBaseTreeData = ref([])

/**
 * 根据当前 rawTaskDetail + fileList 重建左侧基础树
 * @returns {void}
 */
const rebuildSidebarBaseTree = () => {
  sidebarBaseTreeData.value = buildPreviewSidebarTreeFromDetail(
    rawTaskDetail.value,
    fileList.value
  )
}

/** 左侧展示树（含关键词过滤） */
const fileTreeData = computed(() => {
  const keyword = String(searchKeyword.value || '').trim().toLowerCase()
  if (!keyword) return sidebarBaseTreeData.value
  return sidebarBaseTreeData.value
    .map((node) => filterLeftTreeNodeByKeyword(node, keyword))
    .filter(Boolean)
})

/**
 * 轮询/刷新任务详情时：仅就地更新文件状态，不整体替换树数据
 * @param {Object} detail 最新任务详情
 * @param {Array} [resultList] 可选结果列表（缺省取 detail.task_schedule_result_list）
 * @returns {void}
 */
const refreshFromTaskDetail = (detail, resultList) => {
  if (!detail) return
  const rows = Array.isArray(resultList)
    ? resultList
    : (detail.task_schedule_result_list || [])
  const incomingLite = (rows || []).map((row) => ({
    result_uuid: resolvePreviewFileId(row),
    file_uuid: resolvePreviewFileId(row),
    file_id: resolvePreviewFileId(row),
    processing_status: Number(row.processing_status ?? row.PROCESSING_STATUS ?? 0),
    status: Number(row.processing_status ?? row.PROCESSING_STATUS ?? 0)
  }))
  const canPatch = fileList.value.length > 0
    && sidebarBaseTreeData.value.length > 0
    && isSamePreviewFileIdSet(fileList.value, incomingLite)

  if (canPatch) {
    patchPreviewFileListStatusesInPlace(fileList.value, rows)
    patchPreviewTreeFolderStatusesInPlace(sidebarBaseTreeData.value, fileList.value)
    if (rawTaskDetail.value) {
      const metaKeys = [
        'task_status', 'task_name', 'task_notes', 'runtime_nodes', 'step_tree',
        'file_success_count', 'file_failed_count', 'file_processing_count', 'file_pending_count'
      ]
      metaKeys.forEach((key) => {
        if (detail[key] !== undefined) {
          rawTaskDetail.value[key] = detail[key]
        }
      })
    }
    if (taskData.value && detail.task_status !== undefined) {
      taskData.value.task_status = detail.task_status
    }
    return
  }

  // 文件集合变化：整树重建
  rawTaskDetail.value = detail
  if (rows.length > 0) {
    fileList.value = rows.map(convertFileData)
    applyAttachmentCountsToFileList()
  }
  rebuildSidebarBaseTree()
}

/** 当前是否在“文件夹列表预览模式” */
const isFolderListPreviewMode = computed(() => !!currentFolderPreviewPath.value)

/** 当前文件夹列表数据（中间区域） */
const currentFolderPreviewFiles = computed(() => {
  if (!currentFolderPreviewPath.value) {
    return []
  }
  if (isCurrentFolderPreviewRemote.value) {
    return currentFolderPreviewRemoteFiles.value
  }
  return fileList.value
    .filter((file) => {
      const byPath = (file.source_folder_paths || []).includes(currentFolderPreviewPath.value)
      if (byPath) return true
      const refs = Array.isArray(file.source_refs) ? file.source_refs : []
      return refs.some((ref) => String(ref?.source_id || '') === String(currentFolderPreviewFolderId.value || ''))
    })
    .map((file) => ({
      fileId: String(file.result_uuid || file.file_uuid || file.file_id || ''),
      name: file.file_name || '未命名文件',
      type: file.file_type || '-',
      folderPath: currentFolderPreviewPath.value || '根目录',
      sourceFile: file
    }))
})

/**
 * 文件夹列表头展示总数：接口模式取后端 total，本地模式取当前列表长度
 * @param {void} _ 占位参数，无实际意义
 * @returns {number} 文件总数
 */
const folderPreviewDisplayTotal = computed(() => {
  if (isCurrentFolderPreviewRemote.value) {
    return Number(folderPreviewTotal.value || 0)
  }
  return currentFolderPreviewFiles.value.length
})

/**
 * 构建中间文件夹列表行对象
 * @param {Object} rawFile 接口返回文件对象
 * @param {string} folderPath 文件夹路径文案
 * @returns {Object} 中间列表行
 */
const mapFolderPreviewRemoteFileRow = (rawFile, folderPath) => {
  const fileId = String(rawFile.file_uuid || rawFile.result_uuid || rawFile.file_id || '')
  const sourceFile = fileList.value.find((item) => (
    String(item.file_uuid || '') === fileId
    || String(item.result_uuid || '') === fileId
    || String(item.file_id || '') === fileId
  )) || null
  const fileName = rawFile.file_name || sourceFile?.file_name || '未命名文件'
  return {
    fileId,
    name: fileName,
    type: (rawFile.file_type || sourceFile?.file_type || '').toLowerCase() || '-',
    folderPath: folderPath || '根目录',
    sourceFile
  }
}

/**
 * 按文件夹 ID 拉取分页文件列表
 * @param {string} folderId 文件夹ID
 * @param {string} folderPath 文件夹路径文案
 * @param {number} page 页码（从1开始）
 * @returns {Promise<void>} 异步完成
 */
const loadFolderPreviewFilesByFolderId = async (folderId, folderPath, page = 1) => {
  if (!folderId || !taskId.value) {
    isCurrentFolderPreviewRemote.value = false
    currentFolderPreviewRemoteFiles.value = []
    folderPreviewTotal.value = 0
    folderPreviewPage.value = 1
    currentFolderPreviewFolderId.value = ''
    return
  }
  currentFolderPreviewFolderId.value = folderId
  folderPreviewPage.value = page
  folderPreviewLoading.value = true
  try {
    const res = await getTaskFolderFilesPageAPI({
      task_uuid: taskId.value,
      folder_id: folderId,
      page,
      size: folderPreviewPageSize.value,
      keyword: '',
      include_descendants: false
    })
    if (res?.code === 200 && res?.data) {
      folderPreviewTotal.value = Number(res.data.total || 0)
      currentFolderPreviewRemoteFiles.value = (res.data.items || [])
        .map((raw) => mapFolderPreviewRemoteFileRow(raw, folderPath))
      isCurrentFolderPreviewRemote.value = true
    } else {
      folderPreviewTotal.value = 0
      currentFolderPreviewRemoteFiles.value = []
      isCurrentFolderPreviewRemote.value = false
    }
  } catch (error) {
    console.error('加载任务文件夹分页失败:', error)
    folderPreviewTotal.value = 0
    currentFolderPreviewRemoteFiles.value = []
    isCurrentFolderPreviewRemote.value = false
    ElMessage.error('加载文件夹列表失败')
  } finally {
    folderPreviewLoading.value = false
  }
}

/**
 * 处理文件夹分页切换
 * @param {number} page 新页码（从1开始）
 */
const handleFolderPreviewPageChange = async (page) => {
  if (!currentFolderPreviewFolderId.value) {
    return
  }
  await loadFolderPreviewFilesByFolderId(
    currentFolderPreviewFolderId.value,
    currentFolderPreviewPath.value,
    page
  )
}

/**
 * 递归获取左侧树中的第一个文件节点
 * @param {Array} treeNodes 左侧树节点数组
 * @returns {Object|null} 首个文件节点；未命中返回 null
 */
const getFirstFileNodeFromTree = (treeNodes) => {
  const nodes = Array.isArray(treeNodes) ? treeNodes : []
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node) continue
    if (node.nodeType === 'file') {
      return node
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      const childMatched = getFirstFileNodeFromTree(node.children)
      if (childMatched) {
        return childMatched
      }
    }
  }
  return null
}

/**
 * 按 sourceFile 标识在 fileList 中回查完整文件对象
 * @param {Object} sourceFile 左侧树节点携带的 sourceFile
 * @returns {Object|null} 匹配到的完整文件对象；未命中返回 null
 */
const resolveSourceFileFromList = (sourceFile) => {
  if (!sourceFile) {
    return null
  }
  const targetIdList = [
    String(sourceFile.result_uuid || ''),
    String(sourceFile.file_uuid || ''),
    String(sourceFile.file_id || '')
  ].filter(Boolean)
  if (targetIdList.length === 0) {
    return null
  }
  return fileList.value.find((item) => {
    const currentIdList = [
      String(item.result_uuid || ''),
      String(item.file_uuid || ''),
      String(item.file_id || '')
    ]
    return targetIdList.some((id) => currentIdList.includes(id))
  }) || null
}

/**
 * 任务详情加载完成后自动选中初始文件（优先 fileId，其次左树第一个文件）
 * @param {void} _ 占位参数，无实际意义
 * @returns {void}
 */
const applyInitialPreviewFileSelection = () => {
  if (!fileList.value.length && !fileTreeData.value.length) {
    return
  }

  // 1) 优先按入参 fileId 定位
  if (fileId.value) {
    const id = String(fileId.value)
    const matchedFile = fileList.value.find((f) => {
      return String(f.result_uuid || '') === id
        || String(f.file_uuid || '') === id
        || String(f.file_id || '') === id
    })
    if (matchedFile) {
      handleTreeNodeClick({ nodeType: 'file', sourceFile: matchedFile })
      return
    }
  }

  // 2) 优先选中左侧树中的第一个文件节点
  const firstTreeFileNode = getFirstFileNodeFromTree(fileTreeData.value)
  if (firstTreeFileNode && firstTreeFileNode.sourceFile) {
    const resolvedFile = resolveSourceFileFromList(firstTreeFileNode.sourceFile) || firstTreeFileNode.sourceFile
    handleTreeNodeClick({ nodeType: 'file', sourceFile: resolvedFile })
    return
  }

  // 3) 兜底：使用 fileList 首个文件
  if (fileList.value.length > 0) {
    handleTreeNodeClick({ nodeType: 'file', sourceFile: fileList.value[0] })
  }
}

// 加载任务数据
const loadTaskData = async () => {
  initialLoading.value = true
  try {
    if (!taskId.value) {
      ElMessage.warning('缺少任务ID参数')
      return
    }

  // 如果 taskId 是 'task-000999'，使用失败任务示例数据（用于测试）
  if (taskId.value === 'task-000999') {
    taskData.value = failedTaskExample
    fileList.value = failedTaskExample.files || []
    rawTaskDetail.value = null
    applyAttachmentCountsToFileList()
    rebuildSidebarBaseTree()
    applyInitialPreviewFileSelection()
    initialLoading.value = false
    return
  }

    // 调用API获取任务详情（优先 Redis 运行态树，轻量模式不加载 result 大字段）
    const res = await getTaskSchedulesAPI(taskId.value, { prefer_runtime: true, include_result_details: false })

    if (res.code === 200 && res.data) {
      let normalizedDetail = res.data
      if (!normalizedDetail.selection_summary && normalizedDetail.selection_snapshot) {
        try {
          normalizedDetail = {
            ...normalizedDetail,
            selection_summary: typeof normalizedDetail.selection_snapshot === 'string'
              ? JSON.parse(normalizedDetail.selection_snapshot)
              : normalizedDetail.selection_snapshot
          }
        } catch {
          // 忽略 selection_snapshot 解析异常，按无快照处理
        }
      }
      rawTaskDetail.value = normalizedDetail
      // 转换任务数据
      const convertedTask = convertTaskData(normalizedDetail)

      // 确保文件列表已加载
      if (!convertedTask.files || convertedTask.files.length === 0) {
        // 尝试从不同的数据结构中提取文件列表
        let files = []
        if (Array.isArray(res.data)) {
          files = res.data.map(convertFileData)
        } else if (res.data.files && Array.isArray(res.data.files)) {
          files = res.data.files.map(convertFileData)
        } else if (res.data.items && Array.isArray(res.data.items)) {
          files = res.data.items.map(convertFileData)
        } else if (res.data.task_schedule_result_list && Array.isArray(res.data.task_schedule_result_list)) {
          files = res.data.task_schedule_result_list.map(convertFileData)
        }
        convertedTask.files = files
  }

      taskData.value = convertedTask
      fileList.value = convertedTask.files || []
      applyAttachmentCountsToFileList()
      rebuildSidebarBaseTree()
      applyInitialPreviewFileSelection()
    } else {
      ElMessage.error(res.message || '获取任务详情失败')
      // 如果API失败，尝试从mock数据中查找（兼容旧逻辑）
      const task = mockTasks.find(t => t.task_id === taskId.value)
      if (task) {
        taskData.value = task
        fileList.value = task.files || []
        rawTaskDetail.value = null
        applyAttachmentCountsToFileList()
        rebuildSidebarBaseTree()
        applyInitialPreviewFileSelection()
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
      rawTaskDetail.value = null
      applyAttachmentCountsToFileList()
      rebuildSidebarBaseTree()
      applyInitialPreviewFileSelection()
    }
  } finally {
    initialLoading.value = false
  }
}

/**
 * 按需加载单条任务结果的完整详情（含 disposal_result/parameter_template 等大字段）。
 * 用于首屏轻量加载后，点击文件或默认选中第一个文件时补充完整数据。
 * @param {Object} file 当前文件对象
 * @returns {Promise<void>}
 */
const loadResultDetailForFile = async (file) => {
  if (!file || !file.result_uuid) return
  // 如果已有完整数据，跳过
  const hasDetail = file.disposal_result || file.parameter_template || file.parameter_settings
  if (hasDetail) return

  try {
    const res = await getTaskResultDetailAPI(file.result_uuid)
    if (res.code === 200 && res.data) {
      const updatedFile = convertFileData(res.data)
      // 更新 fileList 中对应文件
      const idx = fileList.value.findIndex(
        (f) => f.result_uuid === file.result_uuid || f.file_uuid === file.file_uuid
      )
      if (idx !== -1) {
        const previousFile = fileList.value[idx]
        enrichFileWithAttachmentMeta(updatedFile)
        if (updatedFile.attachmentCount == null && previousFile) {
          updatedFile.attachmentCount = previousFile.attachmentCount || 0
          updatedFile.attachments = previousFile.attachments || []
        }
        // 就地合并，保持树节点 sourceFile 引用不变，避免左侧树整体重建导致展开收起
        Object.assign(previousFile, updatedFile)
      }
      // 如果当前选中的文件就是该文件，更新 currentFile 并重新加载提取结果
      if (
        currentFile.value &&
        (currentFile.value.result_uuid === file.result_uuid || currentFile.value.file_uuid === file.file_uuid)
      ) {
        const mergedFile = idx !== -1 ? fileList.value[idx] : updatedFile
        currentFile.value = mergedFile
        loadExtractionResults(mergedFile)
        if (
          mergedFile.settings &&
          mergedFile.settings.template &&
          (!mergedFile.settings.fieldDefinitions || mergedFile.settings.fieldDefinitions.length === 0)
        ) {
          loadTemplateFields(mergedFile.settings.template)
        }
      }
    }
  } catch (error) {
    console.error('加载文件详情失败:', error)
  }
}

/**
 * 选择文件并触发中间预览区域加载。
 * @param {Object} file 当前点击的文件对象，包含 file_type/file_url 等字段。
 * @returns {Promise<void>} 异步完成预览加载流程。
 */
const selectFile = async (file) => {
  if (!file) {
    console.warn('selectFile: 文件对象为空')
    return
  }

  // 设置当前文件
  currentFile.value = file

  // 重置PDF和DOCX源
  pdfSource.value = null
  docxSource.value = null
  docPreviewUrl.value = null
  excelSource.value = null
  txtContent.value = ''
  imagePreviewUrl.value = null

  // 加载提取结果
  loadExtractionResults(file)

  // 如果有模板但没有字段定义，加载模板的字段定义
  if (file.settings && file.settings.template && (!file.settings.fieldDefinitions || file.settings.fieldDefinitions.length === 0)) {
    loadTemplateFields(file.settings.template)
  } else {
    currentFileTemplateFields.value = []
  }

  // 如果文件缺少完整详情（轻量模式下 disposal_result/parameter_template 为空），按需加载
  if (!file.disposal_result && !file.parameter_template) {
    loadResultDetailForFile(file)
  }

  // 根据文件类型加载预览
  const token = Date.now()
  previewRequestToken.value = token
  previewRequestLoading.value = true
  previewLoadFailed.value = false

  try {
    const fileType = normalizeTaskFileType(file)
    if (fileType === 'pdf') {
      await loadPdfPreview(file)
    } else if (fileType === 'docx' || fileType === 'doc') {
      await loadDocxPreview(file)
    } else if (fileType === 'xlsx' || fileType === 'xlsm' || fileType === 'xls') {
      await loadExcelPreview(file)
    } else if (isTextPreviewFile(file)) {
      await loadTxtPreview(file)
    } else if (isImagePreviewFile(file)) {
      await loadImagePreview(file)
    } else {
      previewLoadFailed.value = true
    }
  } catch (error) {
    console.error('加载文件预览失败:', error)
    previewLoadFailed.value = true
    ElMessage.error('文档加载失败')
  } finally {
    if (previewRequestToken.value === token) {
      previewRequestLoading.value = false
    }
  }
}

// 加载模板的字段定义
const loadTemplateFields = async (templateValue) => {
  currentFileTemplateFields.value = []

  if (!templateValue) {
    return
  }

  // 如果是默认模板名称，不需要加载（默认模板没有字段定义）
  const defaultTemplates = ['default', 'contract', 'audit', 'invoice', 'construction', 'non-construction']
  if (defaultTemplates.includes(templateValue)) {
    return
  }

  // 优先从模板选项中查找
  const templateOption = templateOptions.value.find(opt => opt.value === templateValue)
  if (templateOption && templateOption.originalData && templateOption.originalData.prompt) {
    try {
      const template = templateOption.originalData
      let rules = []
      try {
        if (template.prompt) {
          const cleanedPrompt = template.prompt.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
          rules = JSON.parse(cleanedPrompt)
        }
      } catch {
        try {
          rules = JSON.parse(template.prompt)
        } catch (e2) {
          console.error('解析模板字段配置失败:', e2)
        }
      }

      if (Array.isArray(rules) && rules.length > 0) {
        currentFileTemplateFields.value = rules.map((rule, index) => ({
          id: rule.id || Date.now() + index,
          name: rule.name || '',
          description: rule.description || ''
        }))
      }
      return
    } catch (error) {
      console.warn('从模板选项加载字段定义失败:', error)
    }
  }

  // 如果模板选项中没有，从 API 加载
  try {
    const response = await getTemplateDetailAPI(templateValue)
    if (response.code === 200 && response.data) {
      const template = response.data
      let rules = []
      try {
        if (template.prompt) {
          const cleanedPrompt = template.prompt.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
          rules = JSON.parse(cleanedPrompt)
        }
      } catch {
        try {
          rules = JSON.parse(template.prompt)
        } catch (e2) {
          console.error('解析模板字段配置失败:', e2)
        }
      }

      if (Array.isArray(rules) && rules.length > 0) {
        currentFileTemplateFields.value = rules.map((rule, index) => ({
          id: rule.id || Date.now() + index,
          name: rule.name || '',
          description: rule.description || ''
        }))
      }
    }
  } catch (error) {
    console.warn('加载模板字段定义失败:', error)
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
    // 优先使用接口返回的 file_url，为空时调用 previewFileAPI 获取真实预览 URL
    let previewUrl = file.file_url
    if (!previewUrl && file.file_uuid) {
      try {
        const res = await previewFileAPI(file.file_uuid)
        if (res.code === 200 && res.data?.preview_url) {
          previewUrl = res.data.preview_url
        }
      } catch (e) {
        console.warn('获取PDF预览URL失败:', e)
      }
    }
    if (previewUrl) {
      // 再次等待 DOM 更新
      await nextTick()

      // 使用 Object.assign 或直接赋值来强制触发响应式更新
      // 创建一个新的字符串引用，确保 Vue 检测到变化
      const newSource = String(previewUrl)
      pdfSource.value = newSource

      // 再次等待多个 tick，确保组件完全接收到新的 src 并开始渲染
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
    } else {
      pdfSource.value = null
      throw new Error('PDF文件地址为空')
    }
  } catch (error) {
    console.error('加载PDF失败:', error)
    pdfSource.value = null
    throw error
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
      // 优先使用接口返回的 file_url，为空时调用 previewFileAPI 获取真实预览 URL
      let previewUrl = file.file_url
      if (!previewUrl && file.file_uuid) {
        try {
          const res = await previewFileAPI(file.file_uuid)
          if (res.code === 200 && res.data?.preview_url) {
            previewUrl = res.data.preview_url
          }
        } catch (e) {
          console.warn('获取DOCX预览URL失败:', e)
        }
      }
      if (previewUrl) {
        docxSource.value = previewUrl
      } else {
        docxSource.value = null
        throw new Error('DOCX文件地址为空')
      }
    } else if (file.file_type === 'doc') {
      // DOC文件使用后端转换服务转换为DOCX
      docxSource.value = null
      docPreviewUrl.value = null

      try {
        // 调用后端转换API（优先使用 file_url，为空时调用 previewFileAPI 获取）
        let fileUrl = file.file_url
        if (!fileUrl && file.file_uuid) {
          try {
            const res = await previewFileAPI(file.file_uuid)
            if (res.code === 200 && res.data?.preview_url) {
              fileUrl = res.data.preview_url
            }
          } catch (e) {
            console.warn('获取DOC预览URL失败:', e)
          }
        }
        const convertResponse = await convertDocToDocxAPI(null, fileUrl)

        if (convertResponse.code === 200 && convertResponse.data) {
          const { file_id, preview_url } = convertResponse.data
          // 优先使用 preview_url，如果没有则调用 previewFileAPI 获取
          let finalPreviewUrl = preview_url
          if (!finalPreviewUrl && file_id) {
            try {
              const res = await previewFileAPI(file_id)
              if (res.code === 200 && res.data?.preview_url) {
                finalPreviewUrl = res.data.preview_url
              }
            } catch (e) {
              console.warn('获取转换后DOCX预览URL失败:', e)
            }
          }
          docxSource.value = finalPreviewUrl
          if (!docxSource.value) {
            throw new Error('DOC文件转换后未返回可预览地址')
          }
        } else {
          throw new Error(convertResponse.message || '转换失败')
        }
      } catch (docError) {
        console.error('DOC文件转换失败:', docError)
        docxSource.value = null
        docPreviewUrl.value = null
        throw docError
      }
    }
  } catch (error) {
    console.error('加载Word文件失败:', error)
    docxSource.value = null
    docPreviewUrl.value = null
    throw error
  } finally {
    docxLoading.value = false
  }
}

// 加载Excel预览
const loadExcelPreview = async (file) => {
  excelLoading.value = true
  try {
    // 优先使用接口返回的 file_url，为空时调用 previewFileAPI 获取真实预览 URL
    let previewUrl = file.file_url
    if (!previewUrl && file.file_uuid) {
      try {
        const res = await previewFileAPI(file.file_uuid)
        if (res.code === 200 && res.data?.preview_url) {
          previewUrl = res.data.preview_url
        }
      } catch (e) {
        console.warn('获取Excel预览URL失败:', e)
      }
    }
    if (previewUrl) {
      excelSource.value = previewUrl
    } else {
      excelSource.value = null
      throw new Error('Excel文件地址为空')
    }
  } catch (error) {
    console.error('加载Excel失败:', error)
    excelSource.value = null
    throw error
  } finally {
    excelLoading.value = false
  }
}

/**
 * 加载文本类主文件原文（MinIO 原文件 URL，不含 merge_attachments 拼接内容）
 * @param {Object} file 任务文件对象
 * @returns {Promise<void>}
 */
const loadTxtPreview = async (file) => {
  txtLoading.value = true
  txtContent.value = ''
  try {
    const fileId = resolveWjglFileId(file)
    if (!fileId) {
      throw new Error('无法获取主文件ID')
    }
    let previewUrl = file.file_url
    if (!previewUrl) {
      const res = await previewFileAPI(fileId)
      if (res.code !== 200 || !res.data?.preview_url) {
        throw new Error(res.message || res.msg || '获取预览链接失败')
      }
      previewUrl = res.data.preview_url
    }
    const response = await fetch(previewUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    txtContent.value = await response.text()
    if (!txtContent.value) {
      throw new Error('文本内容为空')
    }
  } catch (error) {
    console.error('加载文本原文失败:', error)
    txtContent.value = ''
    throw error
  } finally {
    txtLoading.value = false
  }
}

/**
 * 加载图片主文件原文预览
 * @param {Object} file 任务文件对象
 * @returns {Promise<void>}
 */
const loadImagePreview = async (file) => {
  imagePreviewUrl.value = null
  try {
    const fileId = resolveWjglFileId(file)
    if (!fileId) {
      throw new Error('无法获取主文件ID')
    }
    let previewUrl = file.file_url
    if (!previewUrl) {
      const res = await previewFileAPI(fileId)
      if (res.code !== 200 || !res.data?.preview_url) {
        throw new Error(res.message || res.msg || '获取预览链接失败')
      }
      previewUrl = res.data.preview_url
    }
    imagePreviewUrl.value = previewUrl
  } catch (error) {
    console.error('加载图片预览失败:', error)
    imagePreviewUrl.value = null
    throw error
  }
}

// DOCX错误处理
const handleDocxError = () => {
  docxLoading.value = false
  previewLoadFailed.value = true
  ElMessage.error('Word文档加载失败')
}

// Excel错误处理
const handleExcelError = () => {
  excelLoading.value = false
  previewLoadFailed.value = true
  ElMessage.error('Excel文档加载失败')
}

/** 主题归纳/信息提取：多文件联合结果仅在首条子结果的 disposal_result 中带 joint_table */
const resolveJointTableForFile = (file, allFiles) => {
  const p = file?.disposal_result_parsed
  if (p?.joint_table && Array.isArray(p.joint_table.columns) && Array.isArray(p.joint_table.rows)) {
    return p.joint_table
  }
  const first = allFiles?.[0]
  const p0 = first?.disposal_result_parsed
  if (p0?.joint_table && Array.isArray(p0.joint_table.columns) && Array.isArray(p0.joint_table.rows)) {
    return p0.joint_table
  }
  return null
}

// 加载提取结果
const loadExtractionResults = (file) => {
  extractionResults.value = []

  // 如果文件处理失败，不显示提取结果
  if (file.status === 'failed') {
    return
  }

  const joint = resolveJointTableForFile(file, fileList.value)
  if (joint && joint.columns.length && joint.rows.length) {
    const nameMatch = (a, b) => String(a || '').trim() === String(b || '').trim()
    let row = joint.rows.find((r) => nameMatch(r.fileName || r.file_name, file.file_name))
    if (!row) row = joint.rows[0]
    const values = row.values && typeof row.values === 'object' ? row.values : {}
    extractionResults.value = joint.columns.map((colName, index) => {
      const label = colName || `列${index + 1}`
      let fieldValue = ''
      if (index === 0 || label === '文件名' || label === 'fileName') {
        fieldValue = String(row.fileName || row.file_name || values[label] || '')
      } else {
        fieldValue = values[label] != null ? String(values[label]) : ''
      }
      return {
        id: index + 1,
        fieldName: label,
        fieldValue,
        confidence: 100,
        status: 'success',
        is_found: true,
        evidence: '',
        chunk_id: '',
        description: '',
        evidence_list: []
      }
    })
    return
  }

  // 工程合同 Dify 回调：outputs.text 内嵌 json（非 final_result.items）
  const contractParsed = parseContractDisposalResult(
    file.disposal_result_parsed || file.disposal_result
  )
  if (contractParsed?.parsedArray?.length) {
    let infoRules = []
    try {
      infoRules = getInformationExtractionFromSettings(file.settings || {})
      if (!infoRules.length) {
        const ps = file.parameter_settings
        if (ps) {
          const parsed = typeof ps === 'string' ? JSON.parse(ps) : ps
          infoRules = getInformationExtractionFromSettings(parsed)
        }
      }
    } catch (_) {
      infoRules = []
    }
    extractionResults.value = mapContractToExtractionResults(
      contractParsed.parsedArray,
      infoRules
    )
    return
  }

  // 优先从 disposal_result_parsed.final_result.items 中获取提取结果（从 disposal_result 解析得到）
  if (file.disposal_result_parsed && file.disposal_result_parsed.final_result) {
    const finalResult = file.disposal_result_parsed.final_result
    if (finalResult.items && Array.isArray(finalResult.items)) {
      extractionResults.value = finalResult.items.map((item, index) => {
        return {
          id: index + 1,
          fieldName: item.name || item.fieldName || `字段${index + 1}`,
          fieldValue: item.extracted !== undefined ? item.extracted : (item.value || ''),
          confidence: item.confidence !== undefined ? item.confidence : (item.is_found ? 100 : 0),
          status: item.is_found === false || item.is_found === 'False' ? 'warning' : 'success',
          is_found: item.is_found !== false && item.is_found !== 'False',
          evidence: item.evidence || '',
          chunk_id: item.chunk_id || '',
          description: item.description || item.fieldDescription || '',
          notes: item.notes || '',
          evidence_list: item.evidence_list || []
        }
      })
      return
    }
  }

  // 其次从 final_result 中获取提取结果
  if (file.final_result && file.final_result.items && Array.isArray(file.final_result.items)) {
    extractionResults.value = file.final_result.items.map((item, index) => {
      return {
        id: index + 1,
        fieldName: item.name || item.fieldName || `字段${index + 1}`,
        fieldValue: item.extracted !== undefined ? item.extracted : (item.value || ''),
        confidence: item.confidence !== undefined ? item.confidence : (item.is_found ? 100 : 0),
        status: item.is_found === false || item.is_found === 'False' ? 'warning' : 'success',
        is_found: item.is_found !== false && item.is_found !== 'False',
        evidence: item.evidence || '',
        chunk_id: item.chunk_id || '',
        description: item.description || item.fieldDescription || '',
        notes: item.notes || '',
        evidence_list: item.evidence_list || []
      }
    })
    return
  }

  // 如果都没有，但有 settings 和 fieldDefinitions，显示字段列表但值为空
  if (file.settings && file.settings.configured && file.settings.fieldDefinitions) {
    extractionResults.value = file.settings.fieldDefinitions.map((field, index) => ({
      id: index + 1,
      fieldName: field.name,
      fieldValue: '',
      confidence: 0,
      status: 'warning',
      is_found: false,
      evidence: '',
      chunk_id: '',
      description: field.description || '',
      evidence_list: []
    }))
  }
}

/**
 * 左侧树点击处理：文件夹进入中间列表，文件进入预览
 * @param {Object} treeNode 左侧树节点对象
 * @param {MouseEvent} event 点击事件对象（预留）
 * @returns {Promise<void>} 异步完成
 */
const handleTreeNodeClick = async (treeNode, event) => {
  void event
  if (!treeNode) return
  if (treeNode.nodeType === 'folder') {
    currentFolderPreviewPath.value = treeNode.folderPath || treeNode.name || ''
    currentFolderPreviewName.value = treeNode.name || ''
    folderPreviewPage.value = 1
    await loadFolderPreviewFilesByFolderId(
      String(treeNode.folderId || ''),
      currentFolderPreviewPath.value || '',
      1
    )
    currentFile.value = null
    return
  }
  if (treeNode.nodeType === 'file' && treeNode.sourceFile) {
    currentFolderPreviewPath.value = ''
    currentFolderPreviewName.value = ''
    currentFolderPreviewRemoteFiles.value = []
    folderPreviewTotal.value = 0
    folderPreviewPage.value = 1
    currentFolderPreviewFolderId.value = ''
    isCurrentFolderPreviewRemote.value = false
    await selectFile(treeNode.sourceFile)
  }
}

/**
 * 中间文件夹列表点击“查看”
 * @param {Object} rowData 列表行对象，需包含 sourceFile/fileId
 */
const handleViewFolderPreviewFile = (rowData) => {
  const sourceFile = rowData?.sourceFile || fileList.value.find((item) => {
    const currentId = String(item.result_uuid || item.file_uuid || item.file_id || '')
    return currentId === String(rowData?.fileId || '')
  })
  if (!sourceFile) {
    ElMessage.warning('未找到文件数据，无法查看')
    return
  }
  handleTreeNodeClick({
    nodeType: 'file',
    sourceFile
  })
}

// 判断文件是否激活（根据后端数据结构，优先使用 result_uuid）
const isFileActive = (file) => {
  if (!currentFile.value) {
    return false
  }
  // 优先使用 result_uuid（后端返回的主要标识符），其次使用 file_uuid 或 file_id
  const currentId = currentFile.value.result_uuid || currentFile.value.file_uuid || currentFile.value.file_id
  const fileId = file.result_uuid || file.file_uuid || file.file_id
  return currentId && fileId && currentId === fileId
}

/** 左侧预览模式任务名称 */
const previewTaskName = computed(() => taskData.value?.task_name || '-')
/** 左侧预览模式运行节点（优先 runtime_nodes） */
const previewRuntimeNodes = computed(() => {
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
 * 左侧公共组件绑定对象（仅预览模式所需字段）
 * @param {void} _ 占位参数，无实际意义
 * @returns {Object} 左侧组件绑定对象
 */
const leftSidebarBindings = computed(() => ({
  showFilePreview,
  searchKeyword,
  fileTreeData,
  fileTreeProps,
  isFileActive,
  handleTreeNodeClick,
  previewTaskName,
  previewRuntimeNodes,
  handleDownloadAllResults,
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

// PDF相关方法
const handlePdfRendered = () => {
  pdfLoading.value = false
}

const handlePdfError = (error) => {
  console.error('PDF加载错误:', error)
  previewLoadFailed.value = true
  pdfLoading.value = false
  ElMessage.error('PDF文档加载失败')
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

const refresh = () => {
  if (currentFile.value) {
    loadPdfPreview(currentFile.value)
  }
}

const download = async () => {
  if (!currentFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  // 优先使用 file_url，为空时调用 previewFileAPI 获取真实下载地址
  let url = currentFile.value.file_url
  if (!url && currentFile.value.file_uuid) {
    try {
      const res = await previewFileAPI(currentFile.value.file_uuid)
      if (res.code === 200 && res.data?.preview_url) {
        url = res.data.preview_url
      }
    } catch (e) {
      console.warn('获取下载地址失败:', e)
    }
  }
  if (!url) {
    ElMessage.warning('该文件暂无可下载地址')
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = currentFile.value.file_name || 'download'
  a.rel = 'noopener'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * 下载任务下全部结果（ZIP）
 * @param {string} format 导出格式，支持 json/markdown/xlsx
 * @returns {Promise<void>} 异步完成
 */
const handleDownloadAllResults = async (format) => {
  if (!taskData.value) {
    ElMessage.warning('任务数据不存在')
    return
  }
  if (!format) {
    ElMessage.warning('请选择下载格式')
    return
  }
  const formatMap = {
    json: 'json',
    markdown: 'markdown',
    xlsx: 'excel',
    excel: 'excel',
    csv: 'csv'
  }
  const exportFormat = formatMap[format] || format
  try {
    const response = await exportExecutionRecordsAPI({
      task_uuid: taskData.value.task_id,
      export_format: exportFormat
    })
    const data = response && (response.data !== undefined ? response.data : response)
    if (!(data instanceof Blob) || data.size === 0) {
      ElMessage.error('导出失败：未返回有效文件')
      return
    }
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    const contentDisposition = response?.headers?.['content-disposition']
    let downloadFilename = ''
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
      if (match && match[1]) {
        downloadFilename = decodeURIComponent(match[1].trim())
      }
    }
    const formatNames = {
      json: 'JSON',
      markdown: 'Markdown',
      excel: 'Excel',
      xlsx: 'Excel',
      csv: 'CSV'
    }
    link.download = downloadFilename || `任务结果-${taskData.value.task_id}-${formatNames[format] || format}-${Date.now()}.zip`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 300)
    ElMessage.success(`已下载全部结果（${formatNames[format] || format}）`)
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '下载失败，请稍后重试')
  }
}

// 生成单个文件的 Markdown 文本（供导出等场景复用）
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

  const rows = fileData.result
  if (Array.isArray(rows) && rows.length > 0) {
    markdown += `## 提取结果\n\n`
    rows.forEach((item) => {
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

const loadExportSyncMaxFiles = async () => {
  try {
    const res = await getDictItemsByCodeAPI('text-extract-export-max-sync-files')
    const items = res?.data
    if (Array.isArray(items) && items.length > 0) {
      const raw = items[0].value ?? items[0].item_value ?? items[0].key_code
      const n = Number(String(raw).trim())
      if (!Number.isNaN(n) && n > 0) {
        exportSyncMaxFiles.value = n
        return
      }
    }
  } catch (_) {
    // 字典未配置
  }
  exportSyncMaxFiles.value = 100
}

const submitLargeExportQueue = async () => {
  exportLargeSubmitting.value = true
  try {
    await new Promise((r) => setTimeout(r, 280))
    ElNotification({
      title: '导出任务已记录',
      message: `任务 ${String(taskId.value || '')} 已按每批 ${exportLargeRowsPerChunk.value} 条配置提交异步导出（待后端接口与首页消息联调）。请稍后在「任务中心」或首页通知中下载压缩包。`,
      duration: 0,
      type: 'info'
    })
    exportLargeDialogVisible.value = false
  } finally {
    exportLargeSubmitting.value = false
  }
}

// 导出结果
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
      const taskFileCount = fileList.value.length
      if (taskFileCount > exportSyncMaxFiles.value) {
        exportLargeRowsPerChunk.value = Math.max(1, taskFileCount)
        exportLargeDialogVisible.value = true
        return
      }
      // Excel格式（单文件结果，小任务量时前端直出）
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
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请稍后重试')
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

// 获取表格行类名（用于高亮选中行）
const getRowClassName = () => {
  return ''
}

// 获取模板的中文名称
const getTemplateName = (templateValue) => {
  const templateMap = {
    'default': '默认模板',
    'contract': '合同提取模板',
    'invoice': '发票提取模板',
    'audit': '审计报告模板',
    'construction': '施工合同提取模板',
    'non-construction': '非施工合同提取模板'
  }
  return templateMap[templateValue] || templateValue || '默认模板'
}

// 获取模板显示名称（优先从模板选项中查找，否则使用默认映射）
const getTemplateDisplayName = (templateValue) => {
  if (!templateValue) return '默认模板'

  // 如果是默认模板名称，直接返回映射
  const defaultTemplates = ['default', 'contract', 'audit', 'invoice', 'construction', 'non-construction']
  if (defaultTemplates.includes(templateValue)) {
    return getTemplateName(templateValue)
  }

  // 如果是 UUID，从模板选项中查找
  const templateOption = templateOptions.value.find(opt => opt.value === templateValue)
  if (templateOption) {
    return templateOption.label || templateOption.name || templateValue
  }

  // 如果找不到，返回原始值或默认模板
  return templateValue || '默认模板'
}

// 加载模板列表（用于显示模板名称）
const loadTemplates = async () => {
  try {
    const response = await getPublicAndPrivateTemplatesAPI({
      page: 1,
      size: 100 // 加载足够多的模板
    })

    if (response.code === 200 && response.data) {
      let templates = []

      if (response.data.items && Array.isArray(response.data.items)) {
        templates = response.data.items
      } else if (Array.isArray(response.data)) {
        templates = response.data
      } else if (response.data.list && Array.isArray(response.data.list)) {
        templates = response.data.list
      }

      templateOptions.value = templates
        .filter(template => template.del_flag !== 1 && template.del_flag !== '1')
        .map(template => ({
          label: template.template_name || template.name || '未命名模板',
          value: template.prompt_uuid || template.id || template.uuid || '',
          name: template.template_name || template.name || '未命名模板',
          originalData: template // 保存原始数据，用于加载字段定义
        }))
    }
  } catch (error) {
    console.warn('加载模板列表失败:', error)
    // 静默失败，不影响主要功能
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

// 任务文件列表变化时加载附件数量；列表引用变化时先用缓存回填角标
watch(
  fileList,
  () => {
    applyAttachmentCountsToFileList()
    refreshTaskFileAttachments()
  },
  { immediate: true, deep: false }
)

/**
 * 开始拖拽左侧分隔条以调整左侧面板宽度
 * @param {MouseEvent} e 鼠标按下事件
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
 * 拖拽过程中更新左侧面板宽度
 * @param {MouseEvent} e 鼠标移动事件
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
 * 结束左侧宽度拖拽并写入 localStorage
 * @returns {void}
 */
const stopLeftSidebarResize = () => {
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')
  localStorage.setItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, String(leftSidebarWidth.value))
}

/**
 * 开始拖拽右侧分隔条调整宽度
 * @param {MouseEvent} e 鼠标按下事件
 * @returns {void}
 */
const startResize = (e) => {
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = rightSidebarWidth.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.classList.add('resizing')
}

/**
 * 拖拽中更新右侧面板宽度
 * @param {MouseEvent} e 鼠标移动事件
 * @returns {void}
 */
const handleResize = (e) => {
  if (!isResizing.value) return
  const diff = startX.value - e.clientX
  const newWidth = startWidth.value + diff
  if (newWidth >= 300 && newWidth <= 800) {
    rightSidebarWidth.value = newWidth
  }
}

/**
 * 结束右侧分隔条拖拽
 * @returns {void}
 */
const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.classList.remove('resizing')
  localStorage.setItem('task-result-viewer-sidebar-width', String(rightSidebarWidth.value))
}

onMounted(() => {
  if (props.isSecondaryExecution) {
    const savedLeftWidth = parseSidebarWidth(localStorage.getItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY))
    let resolvedLeftWidth = savedLeftWidth ?? 320
    if (savedLeftWidth === LEFT_SIDEBAR_LEGACY_DEFAULT_WIDTH) {
      resolvedLeftWidth = 320
      localStorage.setItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, String(resolvedLeftWidth))
    }
    leftSidebarWidth.value = clampLeftSidebarWidth(resolvedLeftWidth)
  }

  const savedWidth = localStorage.getItem('task-result-viewer-sidebar-width')
  if (savedWidth) {
    const width = parseInt(savedWidth, 10)
    if (width >= 300 && width <= 800) {
      rightSidebarWidth.value = width
    }
  }
  loadTaskData()
  loadTemplates() // 加载模板列表用于显示模板名称
  loadExportSyncMaxFiles()
})

onUnmounted(() => {
  if (isResizingLeft.value) {
    stopLeftSidebarResize()
  }
  if (isResizing.value) {
    stopResize()
  }
})

// 从详情页删除/终止任务
const handleDeleteFromDetail = async () => {
  if (!taskData.value || !taskData.value.task_id) {
    ElMessage.warning('未获取到任务信息，无法删除')
    return
  }
  const isRunning = taskData.value.task_status === 0 || taskData.value.task_status === 1
  const title = isRunning ? '终止任务确认' : '删除任务确认'
  const message = isRunning
    ? '终止后任务将不再继续执行，并从任务中心列表中隐藏。是否确认终止该任务？'
    : '删除后任务将从任务中心列表中移除。是否确认删除该任务？'

  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: isRunning ? '确认终止' : '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteTaskAPI(taskData.value.task_id)
    if (res.code === 200) {
      ElMessage.success(res.message || (isRunning ? '终止任务成功' : '删除任务成功'))
      if (isRunning) {
        const currentNotes = String(taskData.value.task_remark || '')
        taskData.value.task_status = 3
        taskData.value.status = 'terminated'
        taskData.value.current_progress = '已终止'
        taskData.value.is_terminated = true
        if (!currentNotes.includes('用户终止任务')) {
          taskData.value.task_remark = `${currentNotes}（用户终止任务）`.trim()
        }
        loadTaskData()
      } else {
        // 删除后返回任务中心
        handleGoToTaskCenter()
      }
    } else {
      ElMessage.error(res.message || (isRunning ? '终止任务失败' : '删除任务失败'))
    }
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      console.error('删除/终止任务失败:', err)
      ElMessage.error(err?.message || (isRunning ? '终止任务失败' : '删除任务失败'))
    }
  }
}

defineExpose({
  refreshFromTaskDetail
})
</script>

<style scoped lang="scss">
.task-result-viewer {
  height: calc(100vh - 75px);
  display: flex;
  overflow: hidden;
  background: #f5f5f5;
  min-height: 0;
}

.task-result-viewer--embedded {
  height: 100%;
  flex: 1;
  min-height: 0;
  background: var(--sd-surface-1, #f4f4f4);
}

.task-left-sidebar-wrap {
  width: 280px;
  min-width: 260px;
  border-right: 1px solid #e4e7ed;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-result-viewer--embedded .task-left-sidebar-wrap {
  width: auto;
  border-right: none;
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

.task-left-sidebar-wrap :deep(.left-sidebar) {
  width: 100%;
  border-right: none;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.task-left-sidebar-wrap :deep(.file-section) {
  min-height: 0;
}

.task-left-sidebar-wrap :deep(.file-list) {
  min-height: 180px;
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

.step-progress-collapse {
  margin-top: 12px;
  width: 100%;
}

.step-progress-collapse :deep(.el-tree-node__label) {
  font-size: 12px;
  white-space: normal;
  word-break: break-word;
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
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.task-result-viewer--embedded .center-viewer {
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.task-result-viewer--embedded .ocr-column-head {
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

.task-result-viewer--embedded .viewer-header.ocr-column-head {
  justify-content: space-between;
}

.page-controls {
  display: flex;
  align-items: center;
}

.page-controls > * + * {
  margin-left: 8px;
}

.page-info {
  margin: 0 8px;
  font-size: 14px;
  color: #606266;
}

.process-buttons {
  display: flex;
  align-items: center;
}

.process-buttons > * + * {
  margin-left: 8px;
}

.document-area {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  padding: 20px;
  background: #f5f5f5;
  box-sizing: border-box;
}

.document-preview {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.docx-container-wrapper {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.docx-container {
  width: 100%;
  padding: 20px;
  background: #fff;
  box-sizing: border-box;
}

.docx-container :deep(.vue-office-docx) {
  width: 100%;
}

.doc-preview-iframe {
  width: 100%;
  min-height: 600px;
  border: none;
  display: block;
}

.excel-container-wrapper {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.excel-container {
  width: 100%;
  min-height: 100%;
}

.excel-container :deep(.vue-office-excel) {
  width: 100%;
  min-height: 100%;
}

.preview-load-failed-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-container-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: stretch;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.pdf-container {
  width: 100%;
  height: 100%;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.pdf-iframe-container {
  min-height: 0;
}

.pdf-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
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

.txt-container-wrapper {
  height: 100%;
  min-height: 0;
  padding: 20px;
  box-sizing: border-box;
}

.txt-container {
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 16px;
  box-sizing: border-box;
}

.text-preview {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
}

.image-preview-wrapper {
  height: 100%;
  min-height: 0;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.right-sidebar {
  background: #fff;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  flex-shrink: 0;
  min-width: 260px;
  max-width: 700px;
}

.right-sidebar.resizable-sidebar {
  transition: width 0s;
}

.right-sidebar-fullwidth {
  flex: 1;
  max-width: none !important;
  min-width: 0 !important;
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

.resizer:hover {
  background: var(--sd-primary, #195fb4);
}

.resizer-left {
  flex-shrink: 0;
}

.resize-icon {
  font-size: 12px;
  color: #909399;
}

.resizer:hover .resize-icon {
  color: var(--sd-primary, #195fb4);
}

.sidebar-tabs {
  padding: 0 16px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.task-result-viewer--embedded .sidebar-tabs.ocr-column-head {
  padding: 0 12px;
}

.task-result-viewer--embedded .sidebar-tabs.ocr-column-head :deep(.el-tabs__header) {
  margin: 0;
}

.task-result-viewer--embedded .sidebar-tabs.ocr-column-head :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.extraction-results,
.readonly-extract-config {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
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

.config-section-block {
  margin-bottom: 12px;
}

.config-section-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  padding-left: 8px;
  border-left: 3px solid var(--sd-primary, #195fb4);
  line-height: 1.4;
  box-sizing: border-box;
}

.config-section-block .extract-advanced-config {
  width: 100%;
  box-sizing: border-box;
}

.extract-advanced-config {
  padding: 12px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  background: var(--sd-surface-1, #f4f4f4);
}

.extract-advanced-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.extract-advanced-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.extract-advanced-form :deep(.el-form-item__label) {
  padding-bottom: 4px;
  line-height: 1.4;
  white-space: normal;
  word-break: break-all;
}

.extract-advanced-form-item :deep(.el-form-item__content) {
  line-height: 1.4;
}

.extract-advanced-number {
  width: 100%;
  max-width: 180px;
}

.extract-advanced-config .config-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  line-height: 1.5;
  word-break: break-all;
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

.export-large-hint {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}
</style>

