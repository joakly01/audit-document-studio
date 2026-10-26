<template>
  <el-dialog
    :model-value="visible"
    :title="`查看附件 - ${displayFileName}（共 ${attachmentList.length} 个）`"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="(val) => $emit('update:visible', val)"
    @close="handleClose"
  >
    <div v-if="loading" class="attachment-loading">
      <el-skeleton :rows="3" animated />
    </div>
    <div v-else-if="attachmentList.length === 0" class="attachment-empty">
      <el-empty description="暂无附件" />
    </div>
    <div v-else class="attachment-table-wrap">
      <el-table
        :data="attachmentList"
        border
        stripe
        max-height="400"
        style="width: 100%;"
      >
        <el-table-column label="文件名" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="attachment-name-cell">
              <el-icon class="attachment-icon"><Document /></el-icon>
              <span class="attachment-name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="readonly ? 100 : 160" align="center" fixed="right">
          <template #default="{ row, $index }">
            <el-button
              v-if="row.file_id"
              type="primary"
              link
              size="small"
              @click="handlePreviewAttachment(row)"
            >查看原文</el-button>
            <el-button
              v-if="!readonly"
              type="danger"
              link
              size="small"
              :icon="Delete"
              @click="removeAttachment($index)"
            >移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button v-if="!readonly" type="primary" @click="openSelectDialog">
        <el-icon><Plus /></el-icon>添加附件
      </el-button>
    </template>
  </el-dialog>

  <AttachmentSelectDialog
    v-model:visible="selectDialogVisible"
    :available-files="availableFiles"
    :exclude-file-ids="excludeFileIds"
    @confirm="handleAddAttachments"
  />

  <el-dialog
    v-model="previewDialogVisible"
    :title="previewFileName || '查看原文'"
    width="90%"
    top="5vh"
    destroy-on-close
    append-to-body
    class="attachment-preview-dialog"
    @closed="resetPreviewState"
  >
    <div
      v-loading="previewLoading"
      class="attachment-preview-body"
    >
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
        :show-title="false"
      />
      <el-empty v-else-if="!previewLoading" description="暂无可预览内容" />
    </div>
    <template #footer>
      <el-button @click="previewDialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Delete, Plus } from '@element-plus/icons-vue'
import {
  getFileAttachmentsAPI,
  removeFileAttachmentAPI,
  addFileAttachmentsAPI,
  previewFileAPI,
  convertDocToDocxAPI,
  convertXlsToXlsxAPI
} from '@/api/fileManager.js'
import AttachmentSelectDialog from './AttachmentSelectDialog.vue'
import FilePreview from '@/components/FilePreview.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  fileId: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: '未命名文件'
  },
  /** 可绑定为附件的候选文件（通常为当前已选文件列表） */
  availableFiles: {
    type: Array,
    default: () => []
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'change'])

const attachmentList = ref([])
const loading = ref(false)
const selectDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const previewLoading = ref(false)
const previewFileName = ref('')
const previewFileType = ref('')
const previewFileData = ref('')

/**
 * 从文件名解析扩展名
 * @param {string} fileName 文件名
 * @returns {string} 小写扩展名
 */
const getFileExtension = (fileName) => {
  const name = String(fileName || '')
  const idx = name.lastIndexOf('.')
  if (idx < 0) return ''
  return name.slice(idx + 1).toLowerCase()
}

/**
 * 推断附件预览类型
 * @param {Object} item 附件项
 * @returns {string|null} 预览类型
 */
const getPreviewFileType = (item) => {
  const mimeType = String(item?.mime_type || '')
  const ext = String(item?.file_extension || '').toLowerCase() || getFileExtension(item?.name)

  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return 'image'
  }
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return 'pdf'
  }
  if (mimeType === 'application/msword'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || ['doc', 'docx', 'wps'].includes(ext)) {
    return ext === 'docx' ? 'docx' : (ext === 'doc' || ext === 'wps' ? 'doc' : 'docx')
  }
  if (mimeType === 'application/vnd.ms-excel'
    || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || ['xls', 'xlsx', 'xlsm'].includes(ext)) {
    return ext === 'xls' ? 'xls' : (ext === 'xlsm' ? 'xlsm' : 'xlsx')
  }
  if (ext === 'csv') {
    return 'csv'
  }
  if (mimeType.startsWith('text/') || ['txt', 'md', 'log'].includes(ext)) {
    return 'txt'
  }
  return null
}

/**
 * 重置附件预览状态
 */
const resetPreviewState = () => {
  previewFileName.value = ''
  previewFileType.value = ''
  previewFileData.value = ''
  previewLoading.value = false
}

/**
 * 点击附件卡片，打开原文预览
 * @param {Object} item 附件项
 */
const handlePreviewAttachment = async (item) => {
  if (!item?.file_id) {
    ElMessage.warning('无法获取附件文件ID')
    return
  }
  const fileType = getPreviewFileType(item)
  if (!fileType) {
    ElMessage.info(`附件「${item.name || '未命名'}」暂不支持在线预览`)
    return
  }

  previewFileName.value = item.name || '未命名文件'
  previewFileType.value = ''
  previewFileData.value = ''
  previewDialogVisible.value = true
  previewLoading.value = true

  try {
    const res = await previewFileAPI(item.file_id)
    if (res.code !== 200 || !res.data?.preview_url) {
      ElMessage.error(res.message || res.msg || '获取预览链接失败')
      previewDialogVisible.value = false
      return
    }

    let previewUrl = res.data.preview_url
    let finalFileType = fileType

    if (fileType === 'doc') {
      const convertRes = await convertDocToDocxAPI(null, previewUrl)
      if (convertRes.code === 200 && convertRes.data?.preview_url) {
        previewUrl = convertRes.data.preview_url
        finalFileType = 'docx'
      } else {
        ElMessage.error('文档转换失败，请稍后重试')
        previewDialogVisible.value = false
        return
      }
    }

    if (fileType === 'xls') {
      const convertRes = await convertXlsToXlsxAPI(null, previewUrl)
      if (convertRes.code === 200 && convertRes.data?.preview_url) {
        previewUrl = convertRes.data.preview_url
        finalFileType = 'xlsx'
      } else {
        ElMessage.error('表格转换失败，请稍后重试')
        previewDialogVisible.value = false
        return
      }
    }

    previewFileType.value = finalFileType
    previewFileData.value = previewUrl
  } catch (error) {
    console.error('预览附件失败:', error)
    ElMessage.error('预览附件失败')
    previewDialogVisible.value = false
  } finally {
    previewLoading.value = false
  }
}

const displayFileName = computed(() => props.fileName || '未命名文件')
const excludeFileIds = computed(() => {
  const ids = new Set(attachmentList.value.map(a => a.file_id))
  ids.add(props.fileId)
  return Array.from(ids)
})

const loadAttachmentList = async () => {
  if (!props.fileId) {
    attachmentList.value = []
    return
  }
  loading.value = true
  try {
    const res = await getFileAttachmentsAPI(props.fileId)
    if (res.code === 200) {
      attachmentList.value = (res.data?.list || []).map(item => ({
        attachment_id: item.attachment_id,
        file_id: item.file_id,
        name: item.name || item.file_name || '未命名',
        path: item.path || '',
        mime_type: item.mime_type || '',
        file_extension: item.file_extension || ''
      }))
    } else {
      ElMessage.error(res.message || '加载附件列表失败')
      attachmentList.value = []
    }
  } catch (error) {
    ElMessage.error('加载附件列表失败')
    attachmentList.value = []
    console.error(error)
  } finally {
    loading.value = false
  }
}

const removeAttachment = async (index) => {
  const item = attachmentList.value[index]
  if (!item || !item.attachment_id) return
  try {
    const res = await removeFileAttachmentAPI(props.fileId, item.attachment_id)
    if (res.code === 200) {
      attachmentList.value.splice(index, 1)
      ElMessage.success('附件已移除')
      emit('change')
    } else {
      ElMessage.error(res.message || '移除附件失败')
    }
  } catch (error) {
    ElMessage.error('移除附件失败')
    console.error(error)
  }
}

const openSelectDialog = () => {
  if (!props.availableFiles || props.availableFiles.length === 0) {
    ElMessage.warning('当前没有可绑定的文件，请先在左侧选择文件或打开文件夹')
    return
  }
  selectDialogVisible.value = true
}

const handleAddAttachments = async (selectedFiles) => {
  const files = Array.isArray(selectedFiles) ? selectedFiles : []
  if (files.length === 0) return
  const excludeSet = new Set(excludeFileIds.value)
  const validFiles = files.filter((f) => f?.file_id && !excludeSet.has(f.file_id))
  if (validFiles.length === 0) {
    ElMessage.warning('所选文件无效、已关联或为当前主文件')
    return
  }
  try {
    const data = {
      attachment_file_ids: validFiles.map(f => f.file_id)
    }
    const res = await addFileAttachmentsAPI(props.fileId, data)
    if (res.code === 200) {
      ElMessage.success(`已添加 ${validFiles.length} 个附件`)
      await loadAttachmentList()
      emit('change')
    } else {
      ElMessage.error(res.message || '添加附件失败')
    }
  } catch (error) {
    ElMessage.error('添加附件失败')
    console.error(error)
  }
}

const handleClose = () => {
  emit('update:visible', false)
}

watch(() => props.visible, (val) => {
  if (val) {
    loadAttachmentList()
  }
})
</script>

<style scoped>
.attachment-loading {
  padding: 16px 0;
}
.attachment-empty {
  padding: 24px 0;
}
.attachment-table-wrap {
  width: 100%;
}
.attachment-name-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}
.attachment-name-cell > * + * {
  margin-left: 8px;
}
.attachment-icon {
  font-size: 16px;
  color: #909399;
  flex-shrink: 0;
}
.attachment-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attachment-preview-body {
  min-height: 500px;
}
.image-preview-wrapper {
  min-height: 500px;
}
</style>
