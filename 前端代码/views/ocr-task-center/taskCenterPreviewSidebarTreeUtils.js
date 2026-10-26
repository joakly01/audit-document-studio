/**
 * 任务中心详情：左侧预览模式文件树构建（与 TaskResultViewer 对齐）
 */
import { normalizeFolderPathForTree } from '@/views/file-manager-code/composables/ocrLeftSidebarTreeUtils.js'
import {
  hasSelectionSnapshot,
  buildSourceRefsFromResultList,
  buildFolderNameMapFromSourceRefs,
  pickDisplayFolderName
} from '@/views/ocr-task-center/taskCenterSelectionTreeUtils.js'

/**
 * 将运行时节点状态码转换为预览侧栏可识别状态
 * @param {number|string} status 运行时状态
 * @returns {string} completed/processing/failed/pending
 */
function mapRuntimeStatusToFileStatus(status) {
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
 * 解析任务结果行上的 source_refs
 * @param {Object} file 原始结果行
 * @param {Map<string, Array>} [sourceRefMap] 来源映射
 * @returns {Array} source_refs
 */
function resolveSourceRefsFromResultRow(file, sourceRefMap) {
  const fileUuid = String(file?.file_uuid || file?.FILE_UUID || file?.result_uuid || file?.RESULT_UUID || '')
  if (sourceRefMap && fileUuid && sourceRefMap.has(fileUuid)) {
    return sourceRefMap.get(fileUuid) || []
  }
  let refs = file?.source_refs
  if (!refs && file?.parameter_settings) {
    let settings = file.parameter_settings
    try {
      if (typeof settings === 'string') settings = JSON.parse(settings)
    } catch (_e) {
      // ignore
    }
    refs = settings?.source_refs
  }
  try {
    if (typeof refs === 'string') refs = JSON.parse(refs)
  } catch (_e) {
    // ignore
  }
  return Array.isArray(refs) ? refs : []
}

/**
 * 将 task_schedule_result_list 单行转为预览侧栏文件对象
 * @param {Object} file 原始结果行
 * @param {Map<string, Array>} sourceRefMap 来源映射
 * @returns {Object} 预览文件对象
 */
export function convertTaskResultFileForPreview(file, sourceRefMap) {
  const fileUuid = String(file?.file_uuid || file?.FILE_UUID || file?.result_uuid || file?.RESULT_UUID || '')
  const processingStatus = Number(file?.processing_status ?? file?.PROCESSING_STATUS ?? 0)
  return {
    result_uuid: fileUuid,
    file_uuid: fileUuid,
    file_id: fileUuid,
    file_name: file.file_name || file.FILE_NAME || '未命名文件',
    processing_status: processingStatus,
    status: processingStatus,
    source_refs: resolveSourceRefsFromResultRow(file, sourceRefMap),
    file_type: String(file.file_type || file.FILE_TYPE || '').toLowerCase(),
    file_url: file.file_url || file.FILE_URL || ''
  }
}

/**
 * 批量转换任务结果列表为预览侧栏文件对象
 * @param {Array} resultList task_schedule_result_list
 * @returns {Array<Object>} 预览文件列表
 */
export function convertTaskResultListForPreview(resultList) {
  const sourceRefMap = buildSourceRefsFromResultList(resultList)
  return (resultList || []).map((row) => convertTaskResultFileForPreview(row, sourceRefMap))
}

/**
 * 构建「文件夹ID -> 任务文件状态列表」映射
 * @param {Array} resultList 任务文件结果列表
 * @param {Map<string, Array>} sourceRefMap 文件来源映射
 * @returns {Map<string, Array<number>>} 文件夹状态聚合映射
 */
function buildFolderStatusMap(resultList, sourceRefMap) {
  const folderIdToStatusList = new Map()
  ;(resultList || []).forEach((row) => {
    const fileUuid = String(row.file_uuid || row.FILE_UUID || row.result_uuid || row.RESULT_UUID || '')
    if (!fileUuid) return
    const status = Number(row.processing_status ?? row.PROCESSING_STATUS ?? 0)
    const refs = sourceRefMap.get(fileUuid) || resolveSourceRefsFromResultRow(row, sourceRefMap)
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
function mapSelectionFolderToSidebarNode(folderNode, folderNameMap, folderStatusMap, parentPath = '') {
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
export function mapFileToPreviewSidebarNode(file) {
  const fileId = String(file.result_uuid || file.file_uuid || file.file_id || file.file_name || '')
  return {
    treeKey: `file:${fileId}`,
    name: file.file_name || '未命名文件',
    nodeType: 'file',
    sourceFile: file
  }
}

/**
 * 判断节点是否为「内容提取」步骤节点
 * @param {Object} node 运行时树节点
 * @returns {boolean} 是否为内容提取步骤
 */
function isExtractStepRuntimeNode(node) {
  const key = String(node?.key || node?.step_key || '').toLowerCase()
  const name = String(node?.name || node?.subtask_display_name || '').toLowerCase()
  return key.includes('extract') || name.includes('内容提取') || name.includes('文本提取')
}

/**
 * 在运行时树中查找「内容提取」步骤 children
 * @param {Array} nodes 运行时树节点数组
 * @returns {Array} 子节点数组
 */
function findExtractChildrenFromRuntimeNodes(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return []
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node) continue
    if (isExtractStepRuntimeNode(node) && Array.isArray(node.children) && node.children.length > 0) {
      return node.children
    }
    const sub = findExtractChildrenFromRuntimeNodes(node.children || [])
    if (sub.length > 0) return sub
  }
  return []
}

/**
 * 通过运行时节点 key 定位文件对象
 * @param {Object} runtimeNode 运行时文件节点
 * @param {Array} files 已转换文件列表
 * @returns {Object|null} 匹配文件
 */
function findFileByRuntimeNode(runtimeNode, files) {
  const key = String(runtimeNode?.key || runtimeNode?.id || '').trim()
  if (!key) return null
  return (files || []).find((file) => {
    const uuid1 = String(file.result_uuid || '')
    const uuid2 = String(file.file_uuid || '')
    const uuid3 = String(file.file_id || '')
    return key === uuid1 || key === uuid2 || key === uuid3
  }) || null
}

/**
 * 将运行时子树映射为预览左树节点
 * @param {Object} runtimeNode 运行时子节点
 * @param {Array} files 已转换文件列表
 * @param {string} parentPath 父路径
 * @returns {Object|null} 左树节点
 */
function mapRuntimeExtractNodeToSidebarNode(runtimeNode, files, parentPath = '') {
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
    if (matchedFile) return mapFileToPreviewSidebarNode(matchedFile)
    const key = String(runtimeNode.key || runtimeNode.id || runtimeNode.name || '')
    return {
      treeKey: `file:runtime:${key}`,
      name: runtimeNode.name || '未命名文件',
      nodeType: 'file',
      sourceFile: {
        result_uuid: key,
        file_uuid: key,
        file_id: key,
        file_name: runtimeNode.name || '未命名文件',
        processing_status: Number(runtimeNode.status ?? 1),
        status: Number(runtimeNode.status ?? 1),
        file_type: '',
        file_url: ''
      }
    }
  }
  return null
}

/**
 * 基于运行时树中的「内容提取」节点构建左树兜底数据
 * @param {Object} detail 任务详情对象
 * @param {Array} files 已转换文件列表
 * @returns {Array} 左树节点数组
 */
function buildPreviewSidebarTreeFromRuntimeNodes(detail, files) {
  const runtimeNodes = (Array.isArray(detail?.runtime_nodes) && detail.runtime_nodes.length > 0)
    ? detail.runtime_nodes
    : (Array.isArray(detail?.step_tree) ? detail.step_tree : [])
  const extractChildren = findExtractChildrenFromRuntimeNodes(runtimeNodes)
  if (!extractChildren.length) return []
  return extractChildren
    .map((node) => mapRuntimeExtractNodeToSidebarNode(node, files))
    .filter(Boolean)
}

/**
 * 按任务详情构建左侧「文件夹+文件」预览树
 * @param {Object} detail 任务详情原始对象
 * @param {Array} convertedFiles 已转换文件列表
 * @returns {Array} 左侧树数据
 */
export function buildPreviewSidebarTreeFromDetail(detail, convertedFiles) {
  const files = Array.isArray(convertedFiles) ? convertedFiles : []
  if (!detail) {
    return files.map(mapFileToPreviewSidebarNode)
  }
  if (!hasSelectionSnapshot(detail)) {
    const runtimeFallbackTree = buildPreviewSidebarTreeFromRuntimeNodes(detail, files)
    if (runtimeFallbackTree.length > 0) return runtimeFallbackTree
    return files.map(mapFileToPreviewSidebarNode)
  }
  const sources = detail.selection_summary?.selection_sources || {}
  const selectedFolders = Array.isArray(sources.folders) ? sources.folders : []
  const resultList = detail.task_schedule_result_list || []
  const sourceRefMap = buildSourceRefsFromResultList(resultList)
  const folderNameMap = buildFolderNameMapFromSourceRefs(sourceRefMap)
  const folderStatusMap = buildFolderStatusMap(resultList, sourceRefMap)

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
    const node = mapFileToPreviewSidebarNode(file)
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
 * 解析结果行/文件对象的稳定文件 ID
 * @param {Object} file 文件或结果行
 * @returns {string} 文件 ID
 */
export function resolvePreviewFileId(file) {
  if (!file) return ''
  return String(
    file.result_uuid
    || file.RESULT_UUID
    || file.file_uuid
    || file.FILE_UUID
    || file.file_id
    || file.FILE_ID
    || ''
  )
}

/**
 * 判断已有预览文件列表与新结果列表的文件集合是否一致（仅比 ID，用于决定是否可只 patch 状态）
 * @param {Array<Object>} existingFiles 当前预览文件列表
 * @param {Array<Object>} incomingFiles 新转换/结果文件列表
 * @returns {boolean} 文件集合是否一致
 */
export function isSamePreviewFileIdSet(existingFiles, incomingFiles) {
  const existing = Array.isArray(existingFiles) ? existingFiles : []
  const incoming = Array.isArray(incomingFiles) ? incomingFiles : []
  if (existing.length !== incoming.length) return false
  const existingIds = new Set(existing.map((file) => resolvePreviewFileId(file)).filter(Boolean))
  if (existingIds.size !== existing.length) return false
  for (let i = 0; i < incoming.length; i++) {
    const id = resolvePreviewFileId(incoming[i])
    if (!id || !existingIds.has(id)) return false
  }
  return true
}

/**
 * 将 processing_status 数值映射为预览侧栏 status 字段
 * @param {number|string} processingStatus 处理状态码
 * @returns {string|number} 预览 status
 */
function mapProcessingStatusToPreviewStatus(processingStatus) {
  const n = Number(processingStatus)
  if (n === 2) return 'completed'
  if (n === 3) return 'failed'
  if (n === 1) return 'processing'
  if (n === 0) return 'pending'
  return processingStatus
}

/**
 * 就地更新预览文件列表中的处理状态（不替换数组与对象引用）
 * @param {Array<Object>} existingFiles 当前预览文件列表
 * @param {Array<Object>} resultList 最新 task_schedule_result_list 或已转换文件列表
 * @returns {boolean} 是否至少更新了一条
 */
export function patchPreviewFileListStatusesInPlace(existingFiles, resultList) {
  const files = Array.isArray(existingFiles) ? existingFiles : []
  const rows = Array.isArray(resultList) ? resultList : []
  if (files.length === 0 || rows.length === 0) return false

  const statusById = new Map()
  rows.forEach((row) => {
    const id = resolvePreviewFileId(row)
    if (!id) return
    const processingStatus = Number(row.processing_status ?? row.PROCESSING_STATUS ?? row.status ?? 0)
    statusById.set(id, processingStatus)
  })

  let changed = false
  files.forEach((file) => {
    const id = resolvePreviewFileId(file)
    if (!id || !statusById.has(id)) return
    const processingStatus = statusById.get(id)
    if (Number(file.processing_status) !== processingStatus) {
      file.processing_status = processingStatus
      changed = true
    }
    const nextStatus = mapProcessingStatusToPreviewStatus(processingStatus)
    if (file.status !== nextStatus) {
      file.status = nextStatus
      changed = true
    }
  })
  return changed
}

/**
 * 根据文件列表就地刷新树节点上的文件夹聚合状态（不替换节点引用）
 * @param {Array<Object>} treeNodes 已构建的预览树
 * @param {Array<Object>} files 当前预览文件列表
 * @returns {void}
 */
export function patchPreviewTreeFolderStatusesInPlace(treeNodes, files) {
  /**
   * 递归刷新节点状态
   * @param {Object} node 树节点
   * @returns {string} 该节点聚合状态 completed/failed/processing/pending
   */
  const walk = (node) => {
    if (!node) return 'pending'
    if (node.nodeType === 'file') {
      const src = node.sourceFile || {}
      const raw = src.processing_status ?? src.status
      return mapRuntimeStatusToFileStatus(raw)
    }
    const children = Array.isArray(node.children) ? node.children : []
    const childStatuses = children.map((child) => walk(child))
    const failed = childStatuses.some((s) => s === 'failed')
    const running = childStatuses.some((s) => s === 'processing' || s === 'pending')
    const folderStatus = failed ? 'failed' : (running ? 'processing' : (childStatuses.length > 0 ? 'completed' : 'pending'))
    if (!node.sourceFile) {
      node.sourceFile = { status: folderStatus }
    } else if (node.sourceFile.status !== folderStatus) {
      node.sourceFile.status = folderStatus
    }
    return folderStatus
  }

  ;(treeNodes || []).forEach((node) => walk(node))
  void files
}
