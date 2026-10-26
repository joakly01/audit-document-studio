/**
 * 工具批量执行请求体（对齐 OcrViewer BatchExecuteByFilter）
 */
import {
  normalizeFolderPathForTree,
  pathToSegments,
  getFileFolderPath,
  getFileIdentifier
} from './ocrLeftSidebarTreeUtils.js'

/**
 * 收集左侧树内全部文件夹路径（不依赖勾选）
 * @param {Object} ctx 左侧栏上下文
 * @returns {Array<string>} 文件夹路径列表
 */
export function getAllFolderPathsFromContext(ctx) {
  const pathSet = new Set()
  const walk = (nodes) => {
    ;(nodes || []).forEach((node) => {
      if (node && node.nodeType === 'folder') {
        const fp = normalizeFolderPathForTree(node.folderPath || '')
        if (fp) pathSet.add(fp)
      }
      if (node && Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children)
      }
    })
  }
  walk(ctx.fileTreeData || [])
  ;(ctx.fileSelectInitialFolders || []).forEach((f) => {
    const fp = normalizeFolderPathForTree(f.folder_path || '')
    if (fp) pathSet.add(fp)
  })
  ;(ctx.fileSelectEnrichedFolders || []).forEach((f) => {
    const fp = normalizeFolderPathForTree(f.folder_path || '')
    if (fp) pathSet.add(fp)
  })
  return Array.from(pathSet)
}

/**
 * 批量执行目标文件：左侧树中的全部文件（与勾选无关）
 * @param {Object} ctx 左侧栏上下文
 * @returns {Array} 目标文件列表
 */
export function getTargetFilesForExecute(ctx) {
  return [...(ctx.files || [])]
}

/**
 * 是否存在可执行目标（树中有文件或文件夹即可）
 * @param {Object} ctx 上下文
 * @returns {boolean} 是否可执行
 */
export function hasExecuteTargets(ctx) {
  const hasFiles = (ctx.files || []).length > 0
  const hasFolders = getAllFolderPathsFromContext(ctx).length > 0
  return hasFiles || hasFolders
}

/**
 * 由 folderPath 查找文件夹元信息
 * @param {string} folderPath 路径
 * @param {Array} initialFolders 初始文件夹
 * @returns {Object|null} 元信息
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
 * @param {string} folderPath 路径
 * @param {Array} fileTreeData 树数据
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
 * 构建批量弹框树结构
 * @param {Array} files 目标文件
 * @param {Object} ctx 上下文
 * @returns {Array} 树行
 */
export function buildBatchDialogTreeRows(files, ctx) {
  const roots = []
  const folderMap = new Map()
  const fileKeySet = new Set()
  const checkedFolderPathsNormalized = getAllFolderPathsFromContext(ctx)
  const checkedFolderPathSet = new Set(checkedFolderPathsNormalized)
  const initialFolders = ctx.fileSelectInitialFolders || []

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
 * 构建 BatchExecuteByFilter 请求体
 * @param {Object} options 参数
 * @param {string} options.taskName 任务名称
 * @param {string} options.taskRemark 任务备注
 * @param {string} options.toolLabel 工具名称
 * @param {string} options.bizType 业务类型
 * @param {number} [options.taskType] 任务类型（工程项目为 6）
 * @param {string} [options.toolUuid] 工具 uuid
 * @param {number} options.taskSwitch 1立即 2调度
 * @param {Function} options.buildExecConfig 构建 exec 配置 (file) => { exec_mode, custom_config }
 * @param {Object} options.sidebarContext 左侧栏上下文
 * @param {Array<string>} options.parseStatus 解析状态筛选
 * @param {Array<string>} options.fileExtensions 后缀筛选
 * @param {number} [options.taskType] 任务类型（工程合同=2、工程项目=6 等）
 * @returns {Object} 请求 JSON
 */
export function buildToolBatchExecutePayload(options) {
  const {
    taskName = '',
    taskRemark = '',
    toolLabel = '',
    bizType = '',
    taskType,
    toolUuid,
    taskSwitch = 2,
    buildExecConfig,
    sidebarContext = {},
    parseStatus = ['parsed'],
    fileExtensions = ['.xlsx', '.xls', '.csv']
  } = options

  const ctx = { ...sidebarContext }

  const execCfgBuilder = typeof buildExecConfig === 'function'
    ? buildExecConfig
    : () => ({ exec_mode: 'custom', custom_config: {} })

  const targetFiles = getTargetFilesForExecute(ctx)
  const selectedTreeRows = buildBatchDialogTreeRows(targetFiles, ctx)

  const filesPayload = targetFiles.map((file) => ({
    file_id: String(getFileIdentifier(file)),
    ...execCfgBuilder(file)
  }))

  const serializeTreeRowForBackend = (row) => {
    if (!row) return null
    const children = (row.children || [])
      .map((child) => serializeTreeRowForBackend(child))
      .filter(Boolean)
    const execCfg = execCfgBuilder(row.sourceFile || row)

    if (row.nodeType === 'folder') {
      const normalizedPath = normalizeFolderPathForTree(row.folderPath || '')
      const folderMeta = findSelectedFolderMetaByPath(normalizedPath, ctx.fileSelectInitialFolders)
        || row.folderMeta
        || {}
      const folderId = row.folderId
        || folderMeta.folder_id
        || findFolderIdByPathFromFileTree(normalizedPath, ctx.fileTreeData)
        || ''
      return {
        row_key: row.rowKey || '',
        tree_key: row.treeKey || '',
        node_type: 'folder',
        type: row.type || 'folder',
        type_label: row.typeLabel || '文件夹',
        name: row.name || '',
        checked: !!row.checked,
        folder_path: normalizedPath,
        folder_id: String(folderId || ''),
        exec_config: execCfg,
        folder_meta: folderMeta || {},
        children
      }
    }

    const fileId = String(row.fileId || row.id || '')
    return {
      row_key: row.rowKey || '',
      tree_key: row.treeKey || '',
      node_type: 'file',
      type: row.type || 'file',
      type_label: row.typeLabel || '文件',
      name: row.name || '',
      checked: true,
      file_id: fileId,
      folder_path: normalizeFolderPathForTree(row.folderPath || ''),
      exec_config: execCfg,
      children
    }
  }

  const checkedTreePayload = selectedTreeRows
    .map((row) => serializeTreeRowForBackend(row))
    .filter(Boolean)
  const folderTreePayload = checkedTreePayload.filter((node) => node.node_type === 'folder')

  const payload = {
    task_name: (taskName || '').trim(),
    tool_name: toolLabel,
    task_notes: (taskRemark || '').trim() || '',
    task_switch: taskSwitch,
    biz_type: bizType,
    files: filesPayload.length > 0 ? filesPayload : undefined,
    folders: folderTreePayload.length > 0 ? folderTreePayload : undefined,
    checked_tree: checkedTreePayload.length > 0 ? checkedTreePayload : undefined,
    parse_status: parseStatus,
    file_extensions: fileExtensions,
    deleted_files: []
  }
  if (taskType != null && taskType !== '') {
    payload.task_type = taskType
  }
  if (toolUuid) {
    payload.tool_uuid = toolUuid
  }
  if (taskType != null && Number.isFinite(Number(taskType))) {
    payload.task_type = Number(taskType)
  }
  return payload
}
