import { ref, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Document,
  Folder,
  Delete,
  View,
  Hide,
  Plus
} from '@element-plus/icons-vue'
import {
  buildFlatLeftTreeData,
  enrichFileSelectFoldersWithTreeChildren,
  filterLeftTreeNodeByKeyword,
  getFileFolderPath,
  getFileIdentifier,
  collectVisibleFolderPaths,
  collectFolderPathsFromNode,
  normalizeFolderPathForTree
} from './ocrLeftSidebarTreeUtils.js'
import {
  hasExecuteTargets as checkHasExecuteTargets,
  getTargetFilesForExecute,
  buildBatchDialogTreeRows
} from './buildToolBatchExecutePayload.js'
import { buildMeetingMinutesExecutePayload } from './buildMeetingMinutesExecutePayload.js'

const TREE_NAME_MAX_LENGTH = 24

/**
 * 树节点名称截断
 * @param {string} nodeName 原始名称
 * @returns {string} 展示名称
 */
function getTreeNodeDisplayName(nodeName) {
  const safeName = String(nodeName || '')
  if (safeName.length <= TREE_NAME_MAX_LENGTH) {
    return safeName
  }
  return `...${safeName.slice(-(TREE_NAME_MAX_LENGTH - 3))}`
}

/**
 * 简化左侧栏 bindings（OcrLeftSidebar layoutMode=tree-select）
 * @param {Object} options 配置
 * @param {import('vue').Ref<Array>} options.files 文件列表
 * @param {Array<string>} [options.canSelectFileType] 可选后缀
 * @returns {Object} 状态与方法
 */
/**
 * 格式化为「yyyy年MM月dd日 HH:mm:ss」
 * @param {Date} [date] 日期对象
 * @returns {string} 格式化字符串
 */
function formatDateTimeYMDHMS(date = new Date()) {
  const pad2 = (n) => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const MM = pad2(date.getMonth() + 1)
  const dd = pad2(date.getDate())
  const HH = pad2(date.getHours())
  const mm = pad2(date.getMinutes())
  const ss = pad2(date.getSeconds())
  return `${yyyy}年${MM}月${dd}日 ${HH}:${mm}:${ss}`
}

export function useSimpleOcrLeftSidebar(options = {}) {
  const files = options.files
  const canSelectFileType = ref(
    Array.isArray(options.canSelectFileType)
      ? options.canSelectFileType
      : ['.pdf', '.doc', '.docx', '.wps']
  )

  const searchKeyword = ref('')
  const showFilePreview = ref(true)
  const fileSelectDialogVisible = ref(false)
  const fileSelectInitialFolders = ref([])
  const fileSelectInitialFiles = ref([])
  const fileSelectEnrichedFolders = ref([])
  const fileTreeRenderKey = ref(0)
  const allowUnparsed = ref(options.allowUnparsed === true)
  const showParseStatus = ref(options.showParseStatus !== false)

  const selectedFiles = ref([])
  const checkedFolderPaths = ref([])

  const fileTreeProps = {
    value: 'treeKey',
    label: 'name',
    children: 'children'
  }

  const fileTreeData = computed(() => {
    const baseTree = buildFlatLeftTreeData(
      files.value || [],
      fileSelectEnrichedFolders.value,
      []
    )
    const keyword = String(searchKeyword.value || '').trim().toLowerCase()
    if (!keyword) return baseTree
    return baseTree
      .map((node) => filterLeftTreeNodeByKeyword(node, keyword))
      .filter(Boolean)
  })

  const visibleFolderPaths = computed(() => collectVisibleFolderPaths(fileTreeData.value))

  /**
   * 获取执行载荷构建上下文
   * @returns {Object} 上下文快照
   */
  const getSidebarExecuteContext = () => ({
    files: files.value || [],
    selectedFiles: selectedFiles.value || [],
    checkedFolderPaths: checkedFolderPaths.value || [],
    fileSelectInitialFolders: fileSelectInitialFolders.value || [],
    fileSelectEnrichedFolders: fileSelectEnrichedFolders.value || [],
    fileTreeData: fileTreeData.value || []
  })

  const hasExecuteTargets = computed(() => checkHasExecuteTargets(getSidebarExecuteContext()))

  const canBatchExecute = typeof options.getCanBatchExecute === 'function'
    ? computed(() => !!options.getCanBatchExecute())
    : hasExecuteTargets

  const isAllSelected = computed(() => {
    const list = files.value || []
    if (list.length === 0 && visibleFolderPaths.value.length === 0) {
      return false
    }
    const allFilesSelected = list.length === 0
      || list.every((file) => selectedFiles.value.includes(getFileIdentifier(file)))
    const allFoldersSelected = visibleFolderPaths.value.length === 0
      || visibleFolderPaths.value.every((path) => checkedFolderPaths.value.includes(path))
    return allFilesSelected && allFoldersSelected
  })

  const isIndeterminate = computed(() => {
    const hasFileSelection = selectedFiles.value.length > 0
    const hasFolderSelection = checkedFolderPaths.value.length > 0
    if (!hasFileSelection && !hasFolderSelection) return false
    return !isAllSelected.value
  })

  /**
   * 打开文件选择弹窗
   * @returns {void}
   */
  const handleSelectFile = () => {
    fileSelectDialogVisible.value = true
  }

  /**
   * 树节点点击（由页面处理预览）
   * @param {Object} treeNode 树节点
   * @param {Function} onFileClick 文件点击回调
   * @returns {void}
   */
  const handleTreeNodeClick = (treeNode, onFileClick) => {
    if (!treeNode || treeNode.nodeType !== 'file') return
    if (typeof onFileClick === 'function') {
      onFileClick(treeNode.sourceFile)
    }
  }

  /**
   * 判断文件是否为当前预览项
   * @param {Object} file 文件对象
   * @returns {boolean} 是否激活
   */
  const isFileActive = (file) => {
    if (typeof options.isFileActive === 'function') {
      return options.isFileActive(file)
    }
    return false
  }

  /**
   * 判断文件是否位于指定文件夹路径下（含子目录）
   * @param {Object} file 文件对象
   * @param {Array<string>} folderPaths 文件夹路径列表
   * @returns {boolean} 是否命中
   */
  const isFileUnderFolderPaths = (file, folderPaths) => {
    const path = getFileFolderPath(file)
    return (folderPaths || []).some((folderPath) => {
      const fp = normalizeFolderPathForTree(folderPath)
      if (!fp) return false
      return path === fp || path.startsWith(`${fp}/`)
    })
  }

  /**
   * 判断路径是否属于待删除文件夹（自身或子路径）
   * @param {string} path 待检测路径
   * @param {Array<string>} pathsToDelete 已规范化删除路径列表
   * @returns {boolean} 是否应删除
   */
  const isPathUnderDeletedFolders = (path, pathsToDelete) => {
    const fp = normalizeFolderPathForTree(path)
    if (!fp) return false
    return pathsToDelete.some((p) => fp === p || fp.startsWith(`${p}/`))
  }

  /**
   * 从侧栏移除文件夹及其下文件（仅前端）
   * @param {Array<string>} folderPaths 文件夹路径
   * @returns {void}
   */
  const removeFoldersFromSidebarState = (folderPaths) => {
    const pathsToDelete = (folderPaths || [])
      .map((p) => normalizeFolderPathForTree(p))
      .filter(Boolean)
    if (pathsToDelete.length === 0) return

    const deletedFileIds = []
    ;(files.value || []).forEach((file) => {
      if (isFileUnderFolderPaths(file, pathsToDelete)) {
        const id = getFileIdentifier(file)
        if (id) deletedFileIds.push(String(id))
      }
    })

    files.value = (files.value || []).filter((file) => !isFileUnderFolderPaths(file, pathsToDelete))
    const deletedIdSet = new Set(deletedFileIds)
    selectedFiles.value = selectedFiles.value.filter((id) => !deletedIdSet.has(String(id)))
    checkedFolderPaths.value = checkedFolderPaths.value.filter(
      (path) => !isPathUnderDeletedFolders(path, pathsToDelete)
    )
    fileSelectEnrichedFolders.value = (fileSelectEnrichedFolders.value || []).filter(
      (f) => !isPathUnderDeletedFolders(f.folder_path || '', pathsToDelete)
    )
    fileSelectInitialFolders.value = (fileSelectInitialFolders.value || []).filter(
      (f) => !isPathUnderDeletedFolders(f.folder_path || '', pathsToDelete)
    )
    syncInitialFilesFromList()
    fileTreeRenderKey.value += 1

    if (typeof options.onFilesRemoved === 'function' && deletedFileIds.length > 0) {
      options.onFilesRemoved(deletedFileIds)
    }
  }

  /**
   * 删除勾选文件夹（仅前端）
   * @returns {void}
   */
  const handleDeleteCheckedFolders = () => {
    if (checkedFolderPaths.value.length === 0) {
      ElMessage.warning('请先勾选文件夹')
      return
    }
    const count = checkedFolderPaths.value.length
    ElMessageBox.confirm(
      `确定删除已勾选的 ${count} 个文件夹及其下文件吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
      .then(() => {
        const pathsToDelete = [...checkedFolderPaths.value]
        removeFoldersFromSidebarState(pathsToDelete)
        checkedFolderPaths.value = []
        ElMessage.success('已删除勾选文件夹（仅前端）')
      })
      .catch(() => {})
  }

  /**
   * 删除单个文件夹节点（仅前端）
   * @param {Object} treeNode 树节点
   * @returns {void}
   */
  const handleDeleteFolderNode = (treeNode) => {
    if (!treeNode || treeNode.nodeType !== 'folder') return
    const folderPath = treeNode.folderPath || ''
    if (!folderPath) return
    ElMessageBox.confirm(
      `确定删除文件夹 "${treeNode.name}" 及其下文件吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
      .then(() => {
        removeFoldersFromSidebarState([folderPath])
        ElMessage.success('文件夹已删除（仅前端）')
      })
      .catch(() => {})
  }

  /**
   * 删除文件（仅前端，带确认）
   * @param {Object} sourceFile 源文件
   * @returns {void}
   */
  const handleDeleteFile = (sourceFile) => {
    if (!sourceFile) return
    const docId = String(getFileIdentifier(sourceFile) || '')
    const fileName = sourceFile.name || '该文件'
    ElMessageBox.confirm(
      `确定要删除文件 "${fileName}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
      .then(() => {
        const idx = (files.value || []).findIndex((f) => String(getFileIdentifier(f)) === docId)
        if (idx >= 0) {
          files.value.splice(idx, 1)
        }
        const selIdx = selectedFiles.value.indexOf(docId)
        if (selIdx > -1) {
          selectedFiles.value.splice(selIdx, 1)
        }
        syncInitialFilesFromList()
        fileTreeRenderKey.value += 1
        if (typeof options.onFilesRemoved === 'function' && docId) {
          options.onFilesRemoved([docId])
        }
        ElMessage.success('文件已删除（仅前端）')
      })
      .catch(() => {})
  }

  /**
   * 文件夹是否勾选
   * @param {Object} treeNode 树节点
   * @returns {boolean}
   */
  const isFolderChecked = (treeNode) => {
    if (!treeNode || treeNode.nodeType !== 'folder') return false
    return checkedFolderPaths.value.includes(treeNode.folderPath || '')
  }

  /**
   * 文件夹勾选变更
   * @param {Object} treeNode 树节点
   * @param {boolean} checked 是否选中
   * @returns {void}
   */
  const handleFolderCheckChange = (treeNode, checked) => {
    const allFolderPaths = collectFolderPathsFromNode(treeNode)
    if (allFolderPaths.length === 0) return
    if (checked) {
      const folderSet = new Set(checkedFolderPaths.value)
      allFolderPaths.forEach((path) => folderSet.add(path))
      checkedFolderPaths.value = Array.from(folderSet)
    } else {
      const removeSet = new Set(allFolderPaths)
      checkedFolderPaths.value = checkedFolderPaths.value.filter((path) => !removeSet.has(path))
    }
  }

  /**
   * 文件是否勾选
   * @param {Object} file 文件对象
   * @returns {boolean}
   */
  const isFileSelected = (file) => selectedFiles.value.includes(getFileIdentifier(file))

  const isFilePendingDelete = () => false

  /**
   * 单文件勾选
   * @param {Object} file 文件对象
   * @param {boolean} checked 是否选中
   * @returns {void}
   */
  const handleFileSelect = (file, checked) => {
    const fileId = getFileIdentifier(file)
    if (checked) {
      if (!selectedFiles.value.includes(fileId)) {
        selectedFiles.value.push(fileId)
      }
    } else {
      const index = selectedFiles.value.indexOf(fileId)
      if (index > -1) selectedFiles.value.splice(index, 1)
    }
  }

  /**
   * 全选/取消全选
   * @param {boolean} checked 是否全选
   * @returns {void}
   */
  const handleSelectAll = (checked) => {
    if (checked) {
      ;(files.value || []).forEach((file) => {
        const fileId = getFileIdentifier(file)
        if (!selectedFiles.value.includes(fileId)) {
          selectedFiles.value.push(fileId)
        }
      })
      const folderSet = new Set(checkedFolderPaths.value)
      visibleFolderPaths.value.forEach((path) => folderSet.add(path))
      checkedFolderPaths.value = Array.from(folderSet)
    } else {
      const filteredIds = (files.value || []).map((file) => getFileIdentifier(file))
      selectedFiles.value = selectedFiles.value.filter((id) => !filteredIds.includes(id))
      const visiblePathSet = new Set(visibleFolderPaths.value)
      checkedFolderPaths.value = checkedFolderPaths.value.filter((path) => !visiblePathSet.has(path))
    }
  }

  /**
   * 同步弹窗反显文件列表
   * @returns {void}
   */
  const syncInitialFilesFromList = () => {
    fileSelectInitialFiles.value = (files.value || []).map((f) => ({
      file_id: f.documentId || f.file_id || f.fileId,
      file_name: f.name || '',
      folder_path: getFileFolderPath(f) || ''
    }))
  }

  /**
   * 合并选中文件到列表
   * @param {Array} fileItems 文件行
   * @returns {number} 新增数量
   */
  const mergeFileItemsIntoList = (fileItems) => {
    const existingIds = new Set(
      (files.value || []).map((f) => getFileIdentifier(f)).filter(Boolean)
    )
    const newItems = []
    ;(fileItems || []).forEach((file) => {
      const docId = file.file_id
      const name = file.file_name || ''
      if (!docId || existingIds.has(docId)) return
      existingIds.add(docId)
      const row = {
        id: docId,
        name,
        documentId: docId,
        fileId: docId,
        file_id: docId,
        folderPath: file.folder_path || '',
        folder_path: file.folder_path || '',
        file_size: file.file_size,
        size: file.file_size,
        document_parse_status: file.document_parse_status || file.parse_status || 'parsed',
        parse_status: file.parse_status || file.document_parse_status || 'parsed',
        type: inferFileTypeFromName(name)
      }
      newItems.push(row)
      if (!selectedFiles.value.includes(docId)) {
        selectedFiles.value.push(docId)
      }
    })
    if (newItems.length > 0) {
      files.value.push(...newItems)
    }
    return newItems.length
  }

  /**
   * 根据文件名推断类型
   * @param {string} fileName 文件名
   * @returns {string} 文件类型
   */
  const inferFileTypeFromName = (fileName) => {
    const ext = (fileName || '').split('.').pop().toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    if (ext === 'docx') return 'docx'
    if (ext === 'doc') return 'doc'
    if (ext === 'xlsx' || ext === 'xlsm') return ext === 'xlsm' ? 'xlsm' : 'xlsx'
    if (ext === 'xls') return 'xls'
    if (ext === 'csv') return 'csv'
    if (ext === 'txt') return 'txt'
    return 'text'
  }

  /**
   * 文件选择确认（先关弹窗再更新树，避免与 el-tree-v2 挂载同周期 patch 报错）
   * @param {Array|Object} payload 选择结果
   * @param {Object} [confirmOptions] 确认选项
   * @param {boolean} [confirmOptions.silent] 为 true 时不弹出「已选择」提示
   * @returns {Promise<void>}
   */
  const defaultOnFileSelectConfirm = async (payload, confirmOptions = {}) => {
    const folders = Array.isArray(payload) ? [] : (payload && payload.folders) ? payload.folders : []
    const fileItems = Array.isArray(payload) ? payload : (payload && payload.files) ? payload.files : []
    const treeRoots = Array.isArray(payload) ? null : (payload && payload.treeData != null ? payload.treeData : null)

    if (folders.length === 0 && fileItems.length === 0) {
      fileSelectDialogVisible.value = false
      return
    }

    fileSelectDialogVisible.value = false
    await nextTick()

    // 用户手动「选择文件」确认：以本次结果覆盖左侧树（任务详情反显后重选亦同），silent 反显仍走追加/保留文件夹逻辑
    if (!confirmOptions.silent) {
      clearFiles()
    }

    // 仅追加文件时保留已有 enriched 文件夹（避免任务详情反显后被异步清空）
    if (folders.length > 0) {
      fileSelectEnrichedFolders.value = enrichFileSelectFoldersWithTreeChildren(
        folders,
        Array.isArray(treeRoots) ? treeRoots : []
      )

      fileSelectInitialFolders.value = folders.map((f) => ({
        folder_id: f.folder_id,
        folder_name: f.folder_name || '',
        folder_path: f.folder_path || '',
        scope: f.scope || 'SELF',
        eligible_count: f.eligible_count != null ? f.eligible_count : 0
      }))
    }

    const nextInitialFiles = fileItems.length > 0 ? fileItems : fileSelectInitialFiles.value
    fileSelectInitialFiles.value = nextInitialFiles.map((f) => ({
      file_id: f.file_id,
      file_name: f.file_name || '',
      folder_path: f.folder_path || ''
    }))

    const addedCount = mergeFileItemsIntoList(fileItems)

    folders.forEach((f) => {
      const fp = normalizeFolderPathForTree(f.folder_path || '')
      if (fp && !checkedFolderPaths.value.includes(fp)) {
        checkedFolderPaths.value.push(fp)
      }
    })

    syncInitialFilesFromList()
    fileTreeRenderKey.value += 1
    await nextTick()

    // 弹窗 confirm 后触发一次"全选"：把当前可见的文件夹 + 文件全部默认勾上，
    // 避免用户从弹窗选完目录/文件回到侧栏后还要手动逐个勾选。
    if (!confirmOptions.silent) {
      handleSelectAll(true)
    }

    if (!confirmOptions.silent) {
      const msgParts = []
      if (folders.length > 0) msgParts.push(`${folders.length} 个文件夹`)
      if (addedCount > 0) msgParts.push(`${addedCount} 个文件`)
      if (msgParts.length > 0) {
        ElMessage.success(`已选择：${msgParts.join('，')}`)
      } else if (folders.length > 0) {
        ElMessage.success(`已选择 ${folders.length} 个文件夹`)
      } else {
        ElMessage.info('所选文件已存在于列表中')
      }
    }

    if (typeof options.afterFileSelectConfirm === 'function') {
      await options.afterFileSelectConfirm({
        addedCount,
        folders,
        fileItems
      })
    }
  }

  const batchRecognizeDialogVisible = ref(false)
  const batchFileList = ref([])
  const batchTaskName = ref('')
  const batchTaskRemark = ref('')
  const batchExtracting = ref(false)
  const previewTaskName = ref('-')

  /**
   * 为批量弹窗树节点递归附加全局 settings（供弹窗「设置模式/设置内容」展示）
   * @param {Array} nodes 树节点列表
   * @param {Object|null} settings 全局配置快照
   * @returns {void}
   */
  const attachSettingsToBatchTree = (nodes, settings) => {
    if (!settings || settings.configured !== true) return
    const cloned = JSON.parse(JSON.stringify(settings))
    ;(nodes || []).forEach((node) => {
      node.settings = cloned
      if (Array.isArray(node.children) && node.children.length > 0) {
        attachSettingsToBatchTree(node.children, settings)
      }
    })
  }

  /**
   * 刷新批量执行弹窗中的文件列表
   * @returns {void}
   */
  const refreshBatchDialogFileList = () => {
    const ctx = getSidebarExecuteContext()
    const targetFiles = getTargetFilesForExecute(ctx)
    const rows = buildBatchDialogTreeRows(targetFiles, ctx)
    if (typeof options.getGlobalBatchSettings === 'function') {
      const settings = options.getGlobalBatchSettings()
      attachSettingsToBatchTree(rows, settings)
    }
    batchFileList.value = rows
  }

  /**
   * 生成默认任务名称
   * @returns {string} 任务名称
   */
  const buildDefaultTaskName = () => {
    const label = options.toolLabel || '任务'
    return `${label} (${formatDateTimeYMDHMS()})`
  }

  /**
   * 打开左侧「批量执行」弹窗
   * @returns {Promise<void>}
   */
  const handleExecuteDialog = async () => {
    if (!hasExecuteTargets.value) {
      ElMessage.warning('请先在左侧添加文件或文件夹')
      return
    }
    if (typeof options.onBeforeOpenBatchDialog === 'function') {
      const canOpen = await options.onBeforeOpenBatchDialog()
      if (!canOpen) return
    }
    batchTaskName.value = buildDefaultTaskName()
    batchTaskRemark.value = ''
    refreshBatchDialogFileList()
    batchRecognizeDialogVisible.value = true
  }

  /**
   * 关闭批量执行弹窗并重置任务参数
   * @returns {void}
   */
  const handleBatchRecognizeCancel = () => {
    batchRecognizeDialogVisible.value = false
    batchTaskName.value = ''
    batchTaskRemark.value = ''
  }

  /**
   * 批量执行弹窗确认：调用页面注入的 onBatchExecute
   * @returns {Promise<void>}
   */
  const executeSwitch = async () => {
    if (!batchTaskName.value.trim()) {
      ElMessage.warning('请输入任务名称')
      throw new Error('task_name_required')
    }
    if (typeof options.onBatchExecute !== 'function') {
      ElMessage.warning('未配置批量执行')
      return
    }
    batchExtracting.value = true
    try {
      const ok = await options.onBatchExecute(
        2,
        batchTaskName.value.trim(),
        batchTaskRemark.value
      )
      if (ok) {
        handleBatchRecognizeCancel()
      }
    } finally {
      batchExtracting.value = false
    }
  }

  const leftSidebarBindings = {
    showFilePreview,
    searchKeyword,
    fileTreeData,
    fileTreeRenderKey,
    fileTreeProps,
    handleSelectFile,
    handleSelectAll,
    isFileActive,
    handleTreeNodeClick: (treeNode, event) => {
      void event
      handleTreeNodeClick(treeNode, options.onFileClick)
    },
    isFolderChecked,
    handleFolderCheckChange,
    isFileSelected,
    isFilePendingDelete,
    handleFileSelect,
    getTreeNodeDisplayName,
    handleDeleteFile,
    setPreviewFileTreeData: () => {},

    selectedFiles,
    checkedFolderPaths,
    isAllSelected,
    isIndeterminate,
    canBatchExecute,
    handleDeleteFolderNode,
    handleDeleteCheckedFolders,
    handleExecuteDialog,

    fileSelectDialogVisible,
    fileSelectInitialFolders,
    fileSelectInitialFiles,
    allowUnparsed,
    canSelectFileType,
    showParseStatus,
    onFileSelectConfirm: defaultOnFileSelectConfirm,

    batchRecognizeDialogVisible,
    batchFileList,
    taskName: batchTaskName,
    taskRemark: batchTaskRemark,
    handleBatchRecognizeCancel,
    executeSwitch,
    batchExtracting,

    previewTaskName,

    icons: {
      Hide,
      View,
      Search,
      Document,
      Folder,
      Delete,
      Plus
    }
  }

  /**
   * 从文件管理器添加文件
   * @param {Array} managerFiles 文件行
   * @param {Object} [confirmOptions] 确认选项
   * @param {boolean} [confirmOptions.silent] 为 true 时不弹出「已选择」提示
   * @returns {Promise<void>}
   */
  const addFilesFromManager = async (managerFiles, confirmOptions = {}) => {
    if (!managerFiles || managerFiles.length === 0) return
    await defaultOnFileSelectConfirm({
      folders: [],
      files: managerFiles.map((f) => ({
        file_id: f.file_id || f.documentId || f.fileId,
        file_name: f.file_name || f.name || '',
        folder_path: f.folder_path || '',
        file_size: f.file_size,
        parse_status: f.parse_status
      })),
      treeData: []
    }, confirmOptions)
  }

  /**
   * 清空文件与选择状态
   * @returns {void}
   */
  const clearFiles = () => {
    files.value = []
    selectedFiles.value = []
    checkedFolderPaths.value = []
    fileSelectEnrichedFolders.value = []
    fileSelectInitialFolders.value = []
    fileSelectInitialFiles.value = []
  }

  /**
   * 恢复选择与反显
   * @returns {void}
   */
  const restoreSelectionFromFiles = () => {
    syncInitialFilesFromList()
    selectedFiles.value = (files.value || [])
      .map((f) => getFileIdentifier(f))
      .filter(Boolean)
  }

  /**
   * 构建会议纪要 BatchExecuteByFilter 请求体
   * @param {Object} params 执行参数
   * @param {string} params.taskName 任务名称
   * @param {string} params.taskRemark 任务备注
   * @param {string} params.toolLabel 工具名称
   * @param {Object} params.analysisConfig 分析配置
   * @returns {Object} 请求体
   */
  const buildExecutePayload = ({
    taskName,
    taskRemark,
    toolLabel,
    analysisConfig
  }) => buildMeetingMinutesExecutePayload({
    taskName,
    taskRemark,
    toolLabel,
    analysisConfig,
    sidebarContext: getSidebarExecuteContext()
  })

  return {
    leftSidebarBindings,
    addFilesFromManager,
    clearFiles,
    getSidebarExecuteContext,
    hasExecuteTargets,
    buildExecutePayload,
    getTargetFilesForExecute: () => getTargetFilesForExecute(getSidebarExecuteContext()),
    restoreSelectionFromFiles,
    showFilePreview,
    allowUnparsed,
    showParseStatus,
    fileSelectEnrichedFolders,
    fileTreeRenderKey,
    fileSelectInitialFolders,
    checkedFolderPaths,
    previewTaskName
  }
}
