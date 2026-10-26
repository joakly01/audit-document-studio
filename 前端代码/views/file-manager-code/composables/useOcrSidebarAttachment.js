import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getFileAttachmentsAPI,
  removeFileAttachmentAPI,
  addFileAttachmentsAPI,
  previewFileAPI,
  convertDocToDocxAPI,
  convertXlsToXlsxAPI
} from '@/api/fileManager.js'

/**
 * 左侧栏内置附件管理（列表 / 选择 / 预览）
 * @param {Object} options 配置项
 * @param {import('vue').Ref<boolean>} options.visible 弹窗可见性
 * @param {import('vue').Ref<string>} options.fileId 主文件 ID
 * @param {import('vue').Ref<string>} options.fileName 主文件名称
 * @param {import('vue').ComputedRef<Array>} options.availableFiles 可绑定候选文件
 * @param {import('vue').ComputedRef<boolean>} options.readonly 是否只读
 * @param {(fileId: string) => void} options.onChange 附件变更回调
 * @returns {Object} 附件管理状态与方法
 */
export function useOcrSidebarAttachment(options) {
  const attachmentList = ref([])
  const loading = ref(false)
  const selectDialogVisible = ref(false)
  const previewDialogVisible = ref(false)
  const previewLoading = ref(false)
  const previewFileName = ref('')
  const previewFileType = ref('')
  const previewFileData = ref('')

  const displayFileName = computed(() => options.fileName.value || '未命名文件')

  const excludeFileIds = computed(() => {
    const ids = new Set(attachmentList.value.map((item) => item.file_id))
    if (options.fileId.value) {
      ids.add(options.fileId.value)
    }
    return Array.from(ids)
  })

  /**
   * 从文件名解析扩展名
   * @param {string} fileName 文件名
   * @returns {string} 小写扩展名
   */
  function getFileExtension(fileName) {
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
  function getPreviewFileType(item) {
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
   * @returns {void}
   */
  function resetPreviewState() {
    previewFileName.value = ''
    previewFileType.value = ''
    previewFileData.value = ''
    previewLoading.value = false
  }

  /**
   * 加载主文件附件列表
   * @returns {Promise<void>}
   */
  async function loadAttachmentList() {
    if (!options.fileId.value) {
      attachmentList.value = []
      return
    }
    loading.value = true
    try {
      const res = await getFileAttachmentsAPI(options.fileId.value)
      if (res.code === 200) {
        attachmentList.value = (res.data?.list || []).map((item) => ({
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

  /**
   * 打开附件原文预览
   * @param {Object} item 附件项
   * @returns {Promise<void>}
   */
  async function handlePreviewAttachment(item) {
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

  /**
   * 移除附件
   * @param {number} index 列表索引
   * @returns {Promise<void>}
   */
  async function removeAttachment(index) {
    const item = attachmentList.value[index]
    if (!item || !item.attachment_id) return
    try {
      const res = await removeFileAttachmentAPI(options.fileId.value, item.attachment_id)
      if (res.code === 200) {
        attachmentList.value.splice(index, 1)
        ElMessage.success('附件已移除')
        if (typeof options.onChange === 'function') {
          options.onChange(options.fileId.value)
        }
      } else {
        ElMessage.error(res.message || '移除附件失败')
      }
    } catch (error) {
      ElMessage.error('移除附件失败')
      console.error(error)
    }
  }

  /**
   * 打开选择附件弹窗
   * @returns {void}
   */
  function openSelectDialog() {
    const candidates = options.availableFiles.value || []
    if (!candidates.length) {
      ElMessage.warning('当前没有可绑定的文件，请先在左侧选择文件或打开文件夹')
      return
    }
    selectDialogVisible.value = true
  }

  /**
   * 确认添加附件
   * @param {Array<Object>} selectedFiles 选中文件
   * @returns {Promise<void>}
   */
  async function handleAddAttachments(selectedFiles) {
    const files = Array.isArray(selectedFiles) ? selectedFiles : []
    if (files.length === 0) return
    const excludeSet = new Set(excludeFileIds.value)
    const validFiles = files.filter((file) => file?.file_id && !excludeSet.has(file.file_id))
    if (validFiles.length === 0) {
      ElMessage.warning('所选文件无效、已关联或为当前主文件')
      return
    }
    try {
      const res = await addFileAttachmentsAPI(options.fileId.value, {
        attachment_file_ids: validFiles.map((file) => file.file_id)
      })
      if (res.code === 200) {
        ElMessage.success(`已添加 ${validFiles.length} 个附件`)
        await loadAttachmentList()
        if (typeof options.onChange === 'function') {
          options.onChange(options.fileId.value)
        }
      } else {
        ElMessage.error(res.message || '添加附件失败')
      }
    } catch (error) {
      ElMessage.error('添加附件失败')
      console.error(error)
    }
  }

  /**
   * 关闭附件管理弹窗
   * @returns {void}
   */
  function closeAttachmentDialog() {
    options.visible.value = false
  }

  watch(() => options.visible.value, (val) => {
    if (val) {
      loadAttachmentList()
    }
  })

  return {
    attachmentList,
    loading,
    selectDialogVisible,
    previewDialogVisible,
    previewLoading,
    previewFileName,
    previewFileType,
    previewFileData,
    displayFileName,
    excludeFileIds,
    loadAttachmentList,
    handlePreviewAttachment,
    removeAttachment,
    openSelectDialog,
    handleAddAttachments,
    closeAttachmentDialog,
    resetPreviewState
  }
}
