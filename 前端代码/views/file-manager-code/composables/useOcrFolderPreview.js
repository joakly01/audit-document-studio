import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getFileListAPI } from '@/api/fileManager.js'
import {
  getFileFolderPath,
  getFileIdentifier,
  normalizeFolderPathForTree,
  buildFolderFileListQueryParams,
  filterFilesByParsePolicy,
  matchesFileExtension
} from './ocrLeftSidebarTreeUtils.js'

/**
 * 根据扩展名推断文件类型
 * @param {string} fileName 文件名
 * @returns {string} 类型标识
 */
function getFileTypeFromExtension(fileName) {
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
 * 文件夹预览与前端待删除记录（对齐 OcrViewer / 工程合同）
 * @param {Object} options 配置项
 * @param {import('vue').Ref<Array>} options.files 侧栏文件列表
 * @param {import('vue').Ref<Array>} [options.selectedFiles] 侧栏勾选文件 ID
 * @param {import('vue').Ref<boolean>|boolean} [options.allowUnparsed] 是否允许未解析文件
 * @param {Array<string>|import('vue').Ref<Array<string>>} [options.fileExtensions] 允许的后缀（可带点）
 * @param {Function} [options.onViewFile] 预览区「查看」回调
 * @param {Function} [options.onClearPreview] 当前预览被删除时的清理回调
 * @param {Function} [options.isCurrentPreviewFileId] 判断是否为当前预览文件 ID
 * @returns {Object} 状态与方法
 */
export function useOcrFolderPreview(options = {}) {
  const files = options.files
  const selectedFiles = options.selectedFiles
  const allowUnparsedRef = options.allowUnparsed
  const fileExtensionsRef = options.fileExtensions

  /**
   * 读取允许的文件后缀列表
   * @returns {Array<string>} 后缀数组
   */
  const resolveFileExtensions = () => {
    const raw = fileExtensionsRef && typeof fileExtensionsRef === 'object' && 'value' in fileExtensionsRef
      ? fileExtensionsRef.value
      : fileExtensionsRef
    return Array.isArray(raw) ? raw : []
  }

  /**
   * 判断文件名是否在允许的后缀范围内
   * @param {string} fileName 文件名
   * @returns {boolean} 是否允许
   */
  const isAllowedFileName = (fileName) => matchesFileExtension(fileName, resolveFileExtensions())

  /** 前端待删除记录（提交批量任务时带给后端） */
  const pendingDeleteRecords = ref({
    files: [],
    folders: []
  })

  const pendingDeleteFileIds = computed(() =>
    (pendingDeleteRecords.value.files || []).map((item) => String(item.fileId))
  )

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

  /**
   * 读取 allowUnparsed 配置
   * @returns {boolean} 是否允许未解析
   */
  const resolveAllowUnparsed = () => {
    if (allowUnparsedRef && typeof allowUnparsedRef === 'object' && 'value' in allowUnparsedRef) {
      return allowUnparsedRef.value === true
    }
    return allowUnparsedRef === true
  }

  const currentFolderPreviewFiles = computed(() => {
    if (!currentFolderPreviewPath.value) {
      return []
    }
    if (isCurrentFolderPreviewRemote.value) {
      return currentFolderPreviewRemoteFiles.value
    }
    return filterFilesByParsePolicy(
      (files.value || []).filter((file) => getFileFolderPath(file) === currentFolderPreviewPath.value),
      resolveAllowUnparsed()
    )
      .filter((file) => isAllowedFileName(file.name || file.file_name || ''))
      .map((file) => ({
        fileId: String(getFileIdentifier(file)),
        name: file.name || '未命名文件',
        type: file.type || getFileTypeFromExtension(file.name),
        folderPath: getFileFolderPath(file) || currentFolderPreviewPath.value,
        sourceFile: file
      }))
  })

  const folderPreviewDisplayTotal = computed(() => {
    if (isCurrentFolderPreviewRemote.value) {
      return Number(folderPreviewTotal.value || 0)
    }
    return currentFolderPreviewFiles.value.length
  })

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
   * 过滤远程文件行（按工具允许的后缀）
   * @param {Array} rawFiles 接口文件列表
   * @returns {Array} 过滤后的原始行
   */
  const filterRemoteRawFiles = (rawFiles) =>
    (rawFiles || []).filter((raw) =>
      isAllowedFileName(raw.file_name || raw.original_name || '')
    )

  /**
   * 按文件夹 ID 拉取文件列表
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
          {
            allowUnparsed: resolveAllowUnparsed(),
            fileExtensions: resolveFileExtensions()
          }
        )
      )
      if (res?.code === 200 && res?.data?.files) {
        const filteredRows = filterRemoteRawFiles(res.data.files)
        folderPreviewTotal.value = Number(res.data.total || filteredRows.length)
        currentFolderPreviewRemoteFiles.value = filteredRows.map((raw) =>
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
   * 记录待删除文件（仅前端）
   * @param {Array} fileRows 文件行
   * @returns {void}
   */
  const recordPendingFileDeletes = (fileRows) => {
    const existingKeys = new Set(
      (pendingDeleteRecords.value.files || []).map((item) => `${item.fileId}|${item.folderPath}`)
    )
    ;(fileRows || []).forEach((file) => {
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
   * 删除后清理选中与预览状态
   * @param {Set<string>} deletedFileIds 已删文件 id 集合
   * @returns {void}
   */
  const cleanupAfterFileDelete = (deletedFileIds) => {
    if (selectedFiles && selectedFiles.value) {
      selectedFiles.value = selectedFiles.value.filter((id) => !deletedFileIds.has(String(id)))
    }
    if (typeof options.isCurrentPreviewFileId === 'function') {
      const shouldClear = Array.from(deletedFileIds).some((id) => options.isCurrentPreviewFileId(id))
      if (shouldClear && typeof options.onClearPreview === 'function') {
        options.onClearPreview()
      }
    }
  }

  /**
   * 判断文件是否已标记待删除
   * @param {Object|string} fileOrId 文件对象或 ID
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
            fileId: item.fileId,
            name: item.name,
            folderPath: item.folderPath || currentFolderPreviewPath.value || '根目录',
            sourceFile: item.sourceFile || null,
            type: item.type || getFileTypeFromExtension(item.name || '')
          }))
        recordPendingFileDeletes(filesToDelete)
        files.value = (files.value || []).filter(
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
   * 文件夹预览列表中查看文件
   * @param {Object} rowData 列表行
   * @returns {Promise<void>}
   */
  const handleViewFolderPreviewFile = async (rowData) => {
    if (typeof options.onViewFile === 'function') {
      await options.onViewFile(rowData)
    }
  }

  /**
   * 侧栏树节点点击：文件夹分支
   * @param {Object} treeNode 树节点
   * @returns {Promise<void>}
   */
  const handleFolderTreeNodeClick = async (treeNode) => {
    if (!treeNode || treeNode.nodeType !== 'folder') return
    currentFolderPreviewPath.value = treeNode.folderPath || ''
    currentFolderPreviewName.value = treeNode.name || ''
    folderPreviewPage.value = 1
    await loadFolderPreviewFilesByFolderId(
      treeNode.folderId || '',
      treeNode.folderPath || '',
      treeNode.name || '',
      1
    )
    if (typeof options.onClearPreview === 'function') {
      options.onClearPreview()
    }
  }

  /**
   * 构建 BatchExecute 用的 deleted_files 数组
   * @returns {Array<{file_id: string, folder_path: string}>} 待排除文件
   */
  const buildDeletedFilesPayload = () =>
    (pendingDeleteRecords.value.files || [])
      .map((item) => ({
        file_id: String(item.fileId || ''),
        folder_path: item.folderPath || ''
      }))
      .filter((item) => item.file_id)

  return {
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
  }
}
