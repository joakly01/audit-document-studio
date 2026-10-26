/**
 * 会议纪要 BatchExecuteByFilter 请求体构建
 * POST /api/v3/meeting-minutes/analyses/BatchExecuteByFilter
 */
import {
  normalizeFolderPathForTree,
  pathToSegments,
  getFileFolderPath,
  getFileIdentifier
} from './ocrLeftSidebarTreeUtils.js'

/**
 * 由 folderPath 在已选文件夹列表中查找元信息
 * @param {string} folderPath 文件夹路径
 * @param {Array} initialFolders 弹窗反显文件夹列表
 * @returns {Object|null} 文件夹元信息
 */
function findSelectedFolderMetaByPath(folderPath, initialFolders) {
  const normalized = normalizeFolderPathForTree(folderPath)
  const list = initialFolders || []
  let matched = list.find(
    (f) => normalizeFolderPathForTree(f.folder_path || '') === normalized
  )
  if (!matched) {
    matched = list.find(
      (f) => String(f.folder_name || '') === String(folderPath || '').split('/').pop()
    )
  }
  return matched || null
}

/**
 * 从左侧树按路径查找 folder_id
 * @param {string} folderPath 文件夹路径
 * @param {Array} fileTreeData 左侧树数据
 * @returns {string} folder_id
 */
function findFolderIdByPathFromFileTree(folderPath, fileTreeData) {
  const normalizedTarget = normalizeFolderPathForTree(folderPath)
  if (!normalizedTarget) return ''
  const stack = [...(fileTreeData || [])]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || node.nodeType !== 'folder') continue
    const nodePath = normalizeFolderPathForTree(node.folderPath || '')
    if (nodePath === normalizedTarget && node.folderId) {
      return String(node.folderId)
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children)
    }
  }
  return ''
}

/**
 * 计算批量执行目标文件（勾选文件 + 勾选文件夹下文件）
 * @param {Object} ctx 上下文
 * @param {Array} ctx.files 文件列表 ref 值
 * @param {Array} ctx.selectedFiles 勾选文件 id 列表
 * @param {Array} ctx.checkedFolderPaths 勾选文件夹路径列表
 * @returns {Array} 目标文件对象数组
 */
export function getTargetFilesForExecute(ctx) {
  const fileList = ctx.files || []
  const selectedFileIds = ctx.selectedFiles || []
  const folderPaths = ctx.checkedFolderPaths || []
  const hasExplicitSelection = selectedFileIds.length > 0 || folderPaths.length > 0

  if (!hasExplicitSelection && fileList.length > 0) {
    return [...fileList]
  }

  const targetFiles = []
  const addedIds = new Set()

  fileList.forEach((file) => {
    const fileId = String(getFileIdentifier(file))
    const selectedByFile = selectedFileIds.some((id) => String(id) === fileId)
    const filePath = getFileFolderPath(file)
    const selectedByFolder = folderPaths.some(
      (folderPath) => filePath === folderPath || filePath.startsWith(`${folderPath}/`)
    )
    if ((selectedByFile || selectedByFolder) && !addedIds.has(fileId)) {
      targetFiles.push(file)
      addedIds.add(fileId)
    }
  })

  return targetFiles
}

/**
 * 是否存在可执行目标（文件或文件夹）
 * @param {Object} ctx 上下文
 * @returns {boolean} 是否可执行
 */
export function hasExecuteTargets(ctx) {
  const fileList = ctx.files || []
  const folderPaths = ctx.checkedFolderPaths || []
  const initialFolders = ctx.fileSelectInitialFolders || []
  const hasFolders = folderPaths.length > 0 || initialFolders.length > 0
  const targetFiles = getTargetFilesForExecute(ctx)
  return targetFiles.length > 0 || hasFolders
}

/**
 * 为批量弹框/执行构建「文件夹-文件」树结构
 * @param {Array} files 目标文件列表
 * @param {Object} ctx 上下文
 * @returns {Array} 树形行数据
 */
function buildBatchDialogTreeRows(files, ctx) {
  const roots = []
  const folderMap = new Map()
  const fileKeySet = new Set()
  const checkedFolderPathsNormalized = (ctx.checkedFolderPaths || [])
    .map((p) => normalizeFolderPathForTree(p))
    .filter(Boolean)
  const checkedFolderPathSet = new Set(checkedFolderPathsNormalized)
  const initialFolders = ctx.fileSelectInitialFolders || []

  /**
   * 查找最近已勾选父级路径
   * @param {string} folderPath 文件夹路径
   * @returns {string} 父路径
   */
  const findClosestCheckedAncestorPath = (folderPath) => {
    const normalizedPath = normalizeFolderPathForTree(folderPath)
    if (!normalizedPath) return ''
    const segments = pathToSegments(normalizedPath)
    for (let i = segments.length - 1; i > 0; i--) {
      const candidate = segments.slice(0, i).join('/')
      if (checkedFolderPathSet.has(candidate)) return candidate
    }
    return ''
  }

  checkedFolderPathsNormalized.forEach((folderPath) => {
    const segments = pathToSegments(folderPath)
    const folderName = segments[segments.length - 1] || folderPath
    const folderMeta = findSelectedFolderMetaByPath(folderPath, initialFolders) || {}
    folderMap.set(folderPath, {
      rowKey: `folder:${folderPath}`,
      id: `folder:${folderPath}`,
      treeKey: `folder:${folderPath}`,
      name: folderName,
      type: 'folder',
      nodeType: 'folder',
      typeLabel: '文件夹',
      folderPath,
      folderId: folderMeta.folder_id || findFolderIdByPathFromFileTree(folderPath, ctx.fileTreeData) || '',
      checked: true,
      folderMeta: folderMeta || {},
      children: []
    })
  })

  checkedFolderPathsNormalized.forEach((folderPath) => {
    const node = folderMap.get(folderPath)
    if (!node) return
    const parentPath = findClosestCheckedAncestorPath(folderPath)
    if (parentPath && folderMap.has(parentPath)) {
      folderMap.get(parentPath).children.push(node)
    } else {
      roots.push(node)
    }
  })

  ;(files || []).forEach((file) => {
    const fileId = String(getFileIdentifier(file) || '')
    if (!fileId) return
    const filePath = normalizeFolderPathForTree(getFileFolderPath(file))
    const fileNode = {
      rowKey: `file:${fileId}`,
      id: fileId,
      treeKey: `file:${fileId}`,
      name: file.name || '未知文件',
      type: 'file',
      nodeType: 'file',
      typeLabel: '文件',
      fileId,
      folderPath: filePath,
      sourceFile: file
    }
    if (fileKeySet.has(fileNode.rowKey)) return
    fileKeySet.add(fileNode.rowKey)

    let parentPath = ''
    if (filePath && checkedFolderPathSet.has(filePath)) {
      parentPath = filePath
    } else {
      const matched = checkedFolderPathsNormalized
        .filter((fp) => filePath === fp || filePath.startsWith(`${fp}/`))
        .sort((a, b) => b.length - a.length)
      parentPath = matched[0] || ''
    }
    const parentNode = parentPath ? folderMap.get(parentPath) : null
    if (parentNode) {
      parentNode.children.push(fileNode)
    } else {
      roots.push(fileNode)
    }
  })

  return roots
}

/**
 * 将文件选择器 scope 转为接口 folder_meta（仅 SELF 需显式传参，含子目录为默认）
 * @param {Object} folderMeta 弹窗反显的文件夹元信息
 * @returns {Object|undefined} 接口 folder_meta
 */
function normalizeFolderMetaForApi(folderMeta) {
  const scope = String((folderMeta && folderMeta.scope) || '').trim()
  if (scope === 'SELF') {
    return { scope: 'SELF' }
  }
  return undefined
}

/**
 * 判断文件路径是否落在已勾选文件夹下
 * @param {string} filePath 规范化文件所在目录路径
 * @param {Set<string>} checkedFolderPathSet 已勾选文件夹路径集合
 * @returns {boolean} 是否属于文件夹展开范围
 */
function isFileUnderCheckedFolders(filePath, checkedFolderPathSet) {
  if (!filePath || !checkedFolderPathSet || checkedFolderPathSet.size === 0) {
    return false
  }
  const paths = Array.from(checkedFolderPathSet)
  for (let i = 0; i < paths.length; i++) {
    const fp = paths[i]
    if (filePath === fp || filePath.indexOf(`${fp}/`) === 0) {
      return true
    }
  }
  return false
}

/**
 * 序列化文件夹树节点为 BatchExecuteByFilter FolderRef
 * @param {Object} row 树节点
 * @param {Object} ctx 左侧栏上下文
 * @returns {Object|null} FolderRef
 */
function serializeFolderRowForApi(row, ctx) {
  if (!row || row.nodeType !== 'folder') return null
  const normalizedPath = normalizeFolderPathForTree(row.folderPath || '')
  const folderMeta = findSelectedFolderMetaByPath(
    normalizedPath,
    ctx.fileSelectInitialFolders
  ) || row.folderMeta || {}
  const folderId = row.folderId
    || folderMeta.folder_id
    || findFolderIdByPathFromFileTree(normalizedPath, ctx.fileTreeData)
    || ''
  if (!folderId) return null

  const childFolders = (row.children || [])
    .filter((child) => child && child.nodeType === 'folder')
    .map((child) => serializeFolderRowForApi(child, ctx))
    .filter(Boolean)

  const node = { folder_id: String(folderId) }
  const apiFolderMeta = normalizeFolderMetaForApi(folderMeta)
  if (apiFolderMeta) {
    node.folder_meta = apiFolderMeta
  }
  if (childFolders.length > 0) {
    node.children = childFolders
  }
  return node
}

/**
 * 构建会议纪要 BatchExecuteByFilter 请求体
 * @param {Object} options 参数
 * @param {string} options.taskName 任务名称
 * @param {string} options.taskRemark 任务备注
 * @param {string} options.toolLabel 工具展示名（仅前端展示，不入参）
 * @param {Object} options.analysisConfig 分析配置（similarityThreshold 为百分比整数）
 * @param {Object} options.sidebarContext 左侧栏上下文
 * @returns {Object} 请求 JSON
 */
export function buildMeetingMinutesExecutePayload(options) {
  const {
    taskName = '',
    taskRemark = '',
    analysisConfig = {},
    sidebarContext = {}
  } = options

  const ctx = { ...sidebarContext }
  if ((ctx.checkedFolderPaths || []).length === 0 && (ctx.fileSelectInitialFolders || []).length > 0) {
    ctx.checkedFolderPaths = (ctx.fileSelectInitialFolders || [])
      .map((f) => normalizeFolderPathForTree(f.folder_path || ''))
      .filter(Boolean)
  }

  const targetFiles = getTargetFilesForExecute(ctx)
  const selectedTreeRows = buildBatchDialogTreeRows(targetFiles, ctx)

  const checkedFolderPathSet = new Set(
    (ctx.checkedFolderPaths || [])
      .map((p) => normalizeFolderPathForTree(p))
      .filter(Boolean)
  )
  const selectedFileIdSet = new Set(
    (ctx.selectedFiles || []).map((id) => String(id)).filter(Boolean)
  )
  const fileList = ctx.files || []

  /** 仅提交「单独勾选、且不在已选文件夹下」的文件，文件夹内文件由 folders 展开 */
  const filesPayload = fileList
    .filter((file) => {
      const fileId = String(getFileIdentifier(file) || '')
      if (!fileId || !selectedFileIdSet.has(fileId)) return false
      const filePath = normalizeFolderPathForTree(getFileFolderPath(file))
      return !isFileUnderCheckedFolders(filePath, checkedFolderPathSet)
    })
    .map((file) => ({ file_id: String(getFileIdentifier(file)) }))
    .filter((item) => item.file_id)

  const folderTreePayload = selectedTreeRows
    .filter((row) => row.nodeType === 'folder')
    .map((row) => serializeFolderRowForApi(row, ctx))
    .filter(Boolean)

  return {
    task_name: (taskName || '').trim() || undefined,
    task_notes: (taskRemark || '').trim() || undefined,
    execute_type: 'background',
    prompt: analysisConfig.prompt || undefined,
    prompt_id: analysisConfig.promptId != null && analysisConfig.promptId !== ''
      ? String(analysisConfig.promptId)
      : undefined,
    similarity_threshold: analysisConfig.similarityThreshold != null
      ? Number(analysisConfig.similarityThreshold) / 100
      : undefined,
    min_cluster_size: analysisConfig.minClusterSize,
    risk_prompt: analysisConfig.riskPrompt || undefined,
    risk_prompt_id: analysisConfig.riskPromptId != null && analysisConfig.riskPromptId !== ''
      ? String(analysisConfig.riskPromptId)
      : undefined,
    files: filesPayload.length > 0 ? filesPayload : undefined,
    folders: folderTreePayload.length > 0 ? folderTreePayload : undefined,
    parse_status: ['parsed', 'unparsed', 'parsing'],
    file_extensions: ['.pdf', '.doc', '.docx', '.wps'],
    deleted_files: []
  }
}
