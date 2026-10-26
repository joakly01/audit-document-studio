<template>
  <div class="file-upload-panel">
    <!-- 文件状态标题 -->
    <div class="panel-header">
      <el-icon><Document /></el-icon>
      <span>{{ title || '会议纪要分析' }}</span>
    </div>

    <!-- 文件上传区域 -->
    <div class="file-upload-area">
      <!-- 搜索文件 -->
      <div class="search-wrapper">
        <el-input
          placeholder="搜索文件"
          size="small"
          prefix-icon="Search"
        />
      </div>

      <!-- 选择文件按钮 -->
      <div v-if="!readonly" class="button-group">
        <el-button
          type="primary"
          class="select-file-btn"
          plain
          @click="fileSelectDialogVisible = true"
        >
          选择文件
        </el-button>
      </div>

      <!-- 未上传文件提示 -->
      <div v-if="uploadedFiles.length === 0" class="empty-placeholder">
        <el-icon class="empty-icon"><Files /></el-icon>
        <div class="empty-text">未找到匹配的文件</div>
      </div>

      <!-- 已上传文件列表 -->
      <div v-else class="uploaded-files-list">
        <div
          v-for="(file, index) in uploadedFiles"
          :key="index"
          class="file-item"
          :class="{ 'file-uploading': file.uploading, 'file-error': file.uploadError, 'file-parse-failed': file.parseFailed, 'file-active': file.documentId === activeFileId }"
          @click="handleFileClick(file)"
        >
          <el-icon v-if="file.uploading" class="is-loading"><Loading /></el-icon>
          <el-icon v-else-if="file.uploadError"><CircleClose /></el-icon>
          <el-icon v-else-if="file.parseFailed" style="color:#f56c6c;"><CircleClose /></el-icon>
          <el-icon v-else><Document /></el-icon>

          <span class="file-name" :title="file.name">
            {{ file.name }}
          </span>

          <span v-if="file.parseFailed" class="parse-failed-tag">解析失败</span>
          <span v-else-if="file.parseStatus === 'SUCCESS'" class="parse-success-tag">解析成功</span>
          <el-icon
            class="preview-icon"
            @click.stop="handlePreviewFile(file)"
          ><View /></el-icon>
          <el-icon v-if="!readonly" class="delete-icon" @click.stop="handleRemoveFile(index)"><Close /></el-icon>
        </div>
      </div>
    </div>

    <!-- 文件预览弹窗 -->
    <el-dialog
      v-model="showPreviewDialog"
      width="90%"
      top="5vh"
      destroy-on-close
      class="file-preview-dialog"
    >
      <div class="preview-dialog-content">
        <div v-if="previewFileType === 'image' && previewFileData" class="image-preview-wrapper">
          <el-image
            :src="previewFileData"
            :preview-src-list="[previewFileData]"
            fit="contain"
            style="width: 100%; height: 100%; min-height: 500px;"
            :preview-teleported="true"
          />
        </div>
        <FilePreview
          v-else-if="previewFileType && previewFileData"
          :file-type="previewFileType"
          :file-name="previewFileName"
          :file-data="previewFileData"
        />
        <div v-else-if="previewLoading" style="text-align:center; padding: 60px 0;">
          <el-icon class="is-loading" :size="36"><Loading /></el-icon>
          <p style="margin-top:12px; color:#909399;">加载中...</p>
        </div>
      </div>
    </el-dialog>

    <FileSelectDialog
      v-model="fileSelectDialogVisible"
      :can-select-file-type="['.pdf', '.doc', '.docx']"
      @confirm="handleManagerFileConfirm"
    />

    <!-- 任务名输入对话框 -->
    <el-dialog
      v-if="showTaskNameDialog"
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
        <div class="dialog-footer">
          <el-button @click="taskNameDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmBackgroundExecute">确认执行</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 批量执行按钮 -->
    <div v-if="!readonly && !hideExecute" class="action-footer">
      <el-button
        type="primary"
        class="batch-btn"
        :loading="isAnalyzing"
        @click="openExecuteDialog"
      >
        执行
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { Document, Files, Close, Loading, CircleClose, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import FileSelectDialog from '@/components/common/FileSelectDialog.vue'
import FilePreview from '@/components/FilePreview.vue'
import { previewFileAPI } from '@/api/fileManager.js'

const props = defineProps({
  isAnalyzing: {
    type: Boolean,
    default: false
  },
  restoredFiles: {
    type: Array,
    default: () => []
  },
  readonly: {
    type: Boolean,
    default: false
  },
  // 从任务详情传入的文件列表（用于还原任务状态）
  inputDocuments: {
    type: Array,
    default: () => []
  },
  // 隐藏执行按钮（父组件自有执行弹窗时使用）
  hideExecute: {
    type: Boolean,
    default: false
  },
  // 显示任务名输入弹窗（父组件自有执行弹窗时设为 false）
  showTaskNameDialog: {
    type: Boolean,
    default: true
  },
  // 面板标题，默认为"会议纪要分析"
  title: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['execute', 'fileClick', 'fileDelete'])

const uploadedFiles = ref([])

const fileSelectDialogVisible = ref(false)

// 文件预览相关状态
const showPreviewDialog = ref(false)
const previewFileName = ref('')
const previewFileType = ref('')
const previewFileData = ref('')
const previewLoading = ref(false)

// 获取文件类型
const getPreviewFileType = (fileName) => {
  const ext = (fileName || '').split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  if (['xlsx', 'xlsm'].includes(ext)) return ext
  if (ext === 'xls') return 'xls'
  if (ext === 'csv') return 'csv'
  if (['txt', 'md', 'log'].includes(ext)) return 'txt'
  return null
}

// 查看文件
const handlePreviewFile = async (file) => {
  if (!file.documentId) {
    ElMessage.warning('文件暂无预览')
    return
  }
  const fileType = getPreviewFileType(file.name)
  if (!fileType) {
    ElMessage.info(`文件 "${file.name}" 不支持在线预览，请下载后查看`)
    return
  }
  try {
    previewLoading.value = true
    previewFileName.value = file.name
    previewFileType.value = ''
    previewFileData.value = ''
    showPreviewDialog.value = true
    const res = await previewFileAPI(file.documentId)
    if (res.code !== 200 || !res.data?.preview_url) {
      ElMessage.error(res.msg || '获取预览链接失败')
      showPreviewDialog.value = false
      return
    }
    previewFileType.value = fileType
    previewFileData.value = res.data.preview_url
  } catch (e) {
    console.error('[FileUploadPanel] 预览文件失败', e)
    ElMessage.error('预览文件失败')
    showPreviewDialog.value = false
  } finally {
    previewLoading.value = false
  }
}

// 任务名对话框相关
const taskNameDialogVisible = ref(false)
const taskNameInput = ref('')
const taskRemarkInput = ref('')
// 生成默认任务名：会议纪要【2026-03-09 12:13:32】
const generateDefaultTaskName = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `会议纪要【${year}-${month}-${day} ${hours}:${minutes}:${seconds}】`
}

// 组件加载时恢复文件列表
onMounted(() => {
  // 如果父组件传入了恢复的文件列表，优先使用
  if (props.restoredFiles && props.restoredFiles.length > 0) {
    uploadedFiles.value = props.restoredFiles.map(f => ({
      ...f,
      uploading: false,
      uploadError: f.uploadError || false,
    }))
  } else if (props.inputDocuments && props.inputDocuments.length > 0) {
    // 从任务详情的 input_documents 还原文件列表
    uploadedFiles.value = props.inputDocuments.map(doc => ({
      name: doc.file_name || doc.name || '未知文件',
      documentId: doc.document_id || doc.documentId,
      uploading: false,
      uploadError: false,
      parseFailed: doc.parseFailed === true || doc.parse_status === 'FAILED',
      _isRestored: true,
    }))
  }
})

// 监听 restoredFiles 变化（用于 taskDetail 模式下动态更新）
watch(() => props.restoredFiles, (newFiles) => {
  if (newFiles && newFiles.length > 0) {
    uploadedFiles.value = newFiles.map(f => ({
      ...f,
      uploading: false,
      uploadError: f.uploadError || false,
    }))
  }
}, { deep: true })

// 监听 inputDocuments 变化（用于从任务详情还原文件列表）
watch(() => props.inputDocuments, (newDocs) => {
  if (newDocs && newDocs.length > 0) {
    uploadedFiles.value = newDocs.map(doc => ({
      name: doc.file_name || doc.name || '未知文件',
      documentId: doc.document_id || doc.documentId,
      uploading: false,
      uploadError: false,
      parseFailed: doc.parseFailed === true,
      _isRestored: true,
    }))
  }
}, { deep: true, immediate: true })



// 当前激活的文件ID
const activeFileId = ref('')

// 处理文件点击
const handleFileClick = (file) => {
  activeFileId.value = file.documentId || ''
  emit('fileClick', file)
}

// 处理文件移除
const handleRemoveFile = (index) => {
  const file = uploadedFiles.value[index]
  uploadedFiles.value.splice(index, 1)
  emit('fileDelete', file)
}

const handleManagerFileConfirm = (files) => {
  if (!files || files.length === 0) {
    fileSelectDialogVisible.value = false
    return
  }

  const existingIds = new Set(
    uploadedFiles.value
      .filter((f) => f.documentId)
      .map((f) => f.documentId)
  )

  const newItems = []

  files.forEach((file) => {
    const docId = file.file_id
    const name = file.file_name || ''

    if (!docId || existingIds.has(docId)) {
      return
    }

    existingIds.add(docId)

    newItems.push({
      name,
      size: null,
      documentId: docId,  // 直接使用UUID字符串，不转换为Number
      uploading: false,
      uploadError: false,
      _isRestored: false,
    })
  })

  if (newItems.length === 0) {
    ElMessage.info('没有新增文件')
  } else {
    uploadedFiles.value.push(...newItems)
    ElMessage.success(`已添加 ${newItems.length} 个文件`)
  }

  fileSelectDialogVisible.value = false
}

// 打开执行弹框
const openExecuteDialog = () => {
  // 检查是否有文件正在上传
  const uploading = uploadedFiles.value.some(f => f.uploading)
  if (uploading) {
    ElMessage.warning('文件正在上传中，请稍候...')
    return
  }

  // 检查是否有上传失败的文件（真正的上传失败，非解析失败）
  const hasError = uploadedFiles.value.some(f => f.uploadError)
  if (hasError) {
    ElMessage.warning('存在上传失败的文件，请重试或移除')
    return
  }

  // 获取所有 documentId
  const documentIds = uploadedFiles.value
    .filter(f => f.documentId)
    .map(f => f.documentId)

  if (documentIds.length === 0) {
    ElMessage.warning('没有可用的文件')
    return
  }

  if (props.showTaskNameDialog) {
    // 弹出任务名输入对话框
    taskNameInput.value = generateDefaultTaskName()
    taskRemarkInput.value = ''
    taskNameDialogVisible.value = true
  } else {
    // 直接触发 execute 事件，由父组件控制执行弹窗
    emit('execute', {
      documentIds,
      executeType: 'background',
      taskName: ''
    })
  }
}

// 确认后台执行
const confirmBackgroundExecute = () => {
  // 获取所有 documentId
  const documentIds = uploadedFiles.value
    .filter(f => f.documentId)
    .map(f => f.documentId)

  if (documentIds.length === 0) {
    ElMessage.warning('没有可用的文件')
    return
  }

  taskNameDialogVisible.value = false
  emit('execute', {
    documentIds,
    executeType: 'background',
    taskName: taskNameInput.value,
    taskRemark: taskRemarkInput.value
  })
}

// 标记文件为过期状态（供父组件调用）- 已废弃，不再使用
const markFilesExpired = (expiredDocumentIds) => {
  // 过期检测已移除，能勾选的文件都是有效文件
  console.log('[FileUploadPanel] markFilesExpired 已废弃，不再处理过期文件')
}

// 从文件管理器添加文件（供父组件调用）
const addFilesFromManager = (files) => {
  if (!files || files.length === 0) return

  const existingIds = new Set(
    uploadedFiles.value
      .filter((f) => f.documentId)
      .map((f) => f.documentId)
  )

  const newItems = []

  files.forEach((file) => {
    const docId = file.file_id || file.documentId
    const name = file.file_name || file.name || ''

    if (!docId || existingIds.has(docId)) {
      return
    }

    existingIds.add(docId)

    newItems.push({
      name,
      size: null,
      documentId: docId,
      uploading: false,
      uploadError: false,
      _isRestored: false,
    })
  })

  if (newItems.length === 0) {
    ElMessage.info('没有新增文件')
  } else {
    uploadedFiles.value.push(...newItems)
    ElMessage.success(`已添加 ${newItems.length} 个文件`)
  }
}

// 清空文件列表
const clearFiles = () => {
  uploadedFiles.value = []
}

// 暴露方法给父组件
defineExpose({
  markFilesExpired,
  addFilesFromManager,
  clearFiles,
  uploadedFiles,
  activeFileId,
})
</script>

<style scoped lang="scss">
.file-upload-panel {
  width: 20%;
  background: white;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 12px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
  font-size: 14px;
}

.file-upload-area {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
}

.search-wrapper {
  flex-shrink: 0;
}

.button-group {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.select-file-btn {
  border-color: #409eff;
  color: #409eff;
  width: 100%;
}

.select-file-btn:hover {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.empty-placeholder {
  text-align: center;
  padding: 60px 12px;
  color: #909399;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  font-size: 40px;
  color: #dcdfe6;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 12px;
}

.uploaded-files-list {
  margin-top: 8px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 12px;
  transition: all 0.2s;
}

.file-item.file-uploading {
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
}

.file-item.file-error {
  background: #fef0f0;
  border: 1px solid #fbc4c4;
}

.file-item.file-parse-failed {
  background: #fff8f0;
  border: 1px solid #ffd28a;
}

.file-item.file-parse-success {
  background: #f0f9eb;
  border: 1px solid #b3e19d;
}

.parse-failed-tag {
  flex-shrink: 0;
  font-size: 10px;
  color: #e6760e;
  background: #fff3e0;
  border: 1px solid #ffc97a;
  border-radius: 3px;
  padding: 0 4px;
  line-height: 16px;
  white-space: nowrap;
}

.parse-success-tag {
  flex-shrink: 0;
  font-size: 10px;
  color: #67c23a;
  background: #f0f9eb;
  border: 1px solid #b3e19d;
  border-radius: 3px;
  padding: 0 4px;
  line-height: 16px;
  white-space: nowrap;
}

.file-item.file-active {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
}

.file-name {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.retry-btn {
  font-size: 12px;
  padding: 0 4px;
  color: #409eff;
}

.delete-icon {
  cursor: pointer;
  color: #f56c6c;
  font-size: 14px;
  flex-shrink: 0;
}

.preview-icon {
  cursor: pointer;
  color: #409eff;
  font-size: 14px;
  flex-shrink: 0;

  &:hover {
    color: #66b1ff;
  }
}

.preview-dialog-content {
  height: 75vh;
  overflow: auto;
}

.action-footer {
  padding: 10px 12px;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.action-footer .batch-btn {
  width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  margin-bottom: 8px;
  box-sizing: border-box;
  display: block;
  align-self: stretch;

  &:last-child {
    margin-bottom: 0;
  }
}

// 任务名输入弹窗样式
.task-name-dialog {
  :deep(.el-dialog__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #ebeef5;
    margin-right: 0;
    
    .el-dialog__title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }
  
  :deep(.el-dialog__body) {
    padding: 24px 20px;
  }
  
  :deep(.el-dialog__footer) {
    padding: 12px 20px 16px;
    border-top: 1px solid #ebeef5;
  }
  
  .task-form {
    .el-form-item {
      margin-bottom: 20px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
    
    :deep(.el-form-item__label) {
      font-weight: 500;
      color: #606266;
    }
    
    :deep(.el-input__wrapper) {
      padding: 0 12px;
    }
    
    :deep(.el-input__inner) {
      height: 36px;
      line-height: 36px;
    }
    
    :deep(.el-textarea__inner) {
      padding: 10px 12px;
      line-height: 1.5;
      resize: none;
    }
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    
    .el-button {
      min-width: 88px;
      height: 36px;
      padding: 0 20px;
      font-size: 14px;
      border-radius: 4px;
    }
  }
}
</style>
