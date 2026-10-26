/**
 * 任务中心：selection_summary 文件夹树与运行时步骤树挂载工具
 */
import { normalizeFolderPathForTree } from '@/views/file-manager-code/composables/ocrLeftSidebarTreeUtils.js'

/**
 * 判断字符串是否为 UUID
 * @param {string} value 待检测字符串
 * @returns {boolean} 是否为 UUID
 */
export function isUuidLike(value) {
  if (!value || typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

/**
 * 判断文件夹名称是否有展示意义（非空且非 UUID）
 * @param {string} value 文件夹名称
 * @returns {boolean} 是否可用
 */
export function isMeaningfulFolderName(value) {
  if (!value || typeof value !== 'string') return false
  const name = value.trim()
  if (!name) return false
  if (isUuidLike(name)) return false
  return true
}

/**
 * 解析任务详情中的 selection_summary
 * @param {Object} detail 任务详情
 * @returns {Object|null} selection_summary
 */
export function normalizeSelectionSummary(detail) {
  if (!detail) return null
  if (detail.selection_summary && typeof detail.selection_summary === 'object') {
    return detail.selection_summary
  }
  if (detail.selection_snapshot) {
    try {
      return typeof detail.selection_snapshot === 'string'
        ? JSON.parse(detail.selection_snapshot)
        : detail.selection_snapshot
    } catch (_e) {
      return null
    }
  }
  return null
}

/**
 * 判断任务是否含文件夹/文件选择快照
 * @param {Object} detail 任务或含 selection_summary 的对象
 * @returns {boolean} 是否有快照
 */
export function hasSelectionSnapshot(detail) {
  const summary = normalizeSelectionSummary(detail)
  const sources = summary?.selection_sources
  const folderNodes = sources?.folders
  const fileNodes = sources?.files
  return (Array.isArray(folderNodes) && folderNodes.length > 0)
    || (Array.isArray(fileNodes) && fileNodes.length > 0)
}

/**
 * 从结果列表构建 fileUuid -> source_refs 映射
 * @param {Array} resultList 任务文件结果列表
 * @returns {Map<string, Array>} 来源引用映射
 */
export function buildSourceRefsFromResultList(resultList) {
  const sourceRefMap = new Map()
  ;(resultList || []).forEach((file) => {
    const fileUuid = file?.file_uuid || file?.FILE_UUID || file?.result_uuid || file?.RESULT_UUID
    if (!fileUuid) return
    let refs = file?.source_refs
    if (!refs && file?.parameter_settings) {
      let settings = file.parameter_settings
      try {
        if (typeof settings === 'string') settings = JSON.parse(settings)
      } catch (_e) {}
      refs = settings?.source_refs
    }
    try {
      if (typeof refs === 'string') refs = JSON.parse(refs)
    } catch (_e) {}
    if (Array.isArray(refs)) {
      sourceRefMap.set(fileUuid, refs)
    }
  })
  return sourceRefMap
}

/**
 * 从 source_refs 提取 folderId -> 展示名
 * @param {Map<string, Array>} sourceRefMap 来源引用映射
 * @returns {Map<string, string>} 文件夹名称映射
 */
export function buildFolderNameMapFromSourceRefs(sourceRefMap) {
  const folderNameMap = new Map()
  sourceRefMap.forEach((refs) => {
    ;(refs || []).forEach((ref) => {
      if (!ref || ref.source_type !== 'folder' || !ref.source_id) return
      const folderName = ref.source_name || ref.folder_path
      if (isMeaningfulFolderName(folderName)) {
        folderNameMap.set(ref.source_id, folderName)
      }
    })
  })
  return folderNameMap
}

/**
 * 选取文件夹展示名
 * @param {Object} folderNode 文件夹节点
 * @param {Map<string, string>} folderNameMap 名称映射
 * @returns {string} 展示名
 */
export function pickDisplayFolderName(folderNode, folderNameMap) {
  const folderId = folderNode?.folder_id
  const candidates = [
    folderNode?.name,
    folderNode?.folder_name,
    folderId ? folderNameMap.get(folderId) : '',
    folderNode?.folder_path
  ]
  const picked = candidates.find((item) => isMeaningfulFolderName(item))
  return picked || ''
}

/**
 * 将 selection 文件夹树扁平化为 enrichedFolders（供 buildFlatLeftTreeData）
 * @param {Array} folderNodes 文件夹树根
 * @param {Map<string, string>} folderNameMap 名称映射
 * @param {string} [parentPath] 父路径
 * @returns {Array<Object>} enriched 文件夹列表
 */
export function flattenSelectionFoldersToEnriched(folderNodes, folderNameMap, parentPath = '') {
  const rows = []
  ;(folderNodes || []).forEach((folderNode) => {
    if (!folderNode) return
    const folderId = folderNode.folder_id || ''
    const displayName = pickDisplayFolderName(folderNode, folderNameMap) || '文件夹'
    const folderPath = normalizeFolderPathForTree(
      folderNode.folder_path || (parentPath ? `${parentPath}/${displayName}` : displayName)
    )
    rows.push({
      folder_id: folderId,
      folder_name: displayName,
      folder_path: folderPath,
      scope: folderNode.scope || 'SELF'
    })
    const children = Array.isArray(folderNode.children) ? folderNode.children : []
    if (children.length > 0) {
      rows.push(...flattenSelectionFoldersToEnriched(children, folderNameMap, folderPath))
    }
  })
  return rows
}

/**
 * 解析单条结果的 source_refs
 * @param {Object} resultItem 任务结果行
 * @returns {Array} source_refs
 */
export function parseSourceRefsFromResultItem(resultItem) {
  let refs = resultItem?.source_refs
  if (!refs && resultItem?.parameter_settings) {
    let settings = resultItem.parameter_settings
    try {
      if (typeof settings === 'string') settings = JSON.parse(settings)
    } catch (_e) {}
    refs = settings?.source_refs
  }
  try {
    if (typeof refs === 'string') refs = JSON.parse(refs)
  } catch (_e) {}
  return Array.isArray(refs) ? refs : []
}

/**
 * 从 source_refs 解析文件所属 folderPath
 * @param {Array} sourceRefs 来源引用
 * @param {Map<string, string>} folderNameMap 文件夹名称映射
 * @returns {string} folderPath
 */
export function resolveFolderPathFromSourceRefs(sourceRefs, folderNameMap) {
  const folderRef = (sourceRefs || []).find((ref) => ref && ref.source_type === 'folder' && ref.source_id)
  if (!folderRef) return ''
  if (folderRef.folder_path) {
    return normalizeFolderPathForTree(folderRef.folder_path)
  }
  const name = folderRef.source_name || folderNameMap.get(folderRef.source_id) || ''
  return normalizeFolderPathForTree(name)
}

/**
 * 判断运行时步骤节点是否应挂载 selection 文件夹树
 * @param {Object} node 运行时树节点
 * @param {string} [bizType] 业务类型
 * @returns {boolean} 是否匹配
 */
export function isSelectionAttachStepNode(node, bizType) {
  const key = String(node?.key || node?.step_key || '').toLowerCase()
  const name = String(node?.name || node?.subtask_display_name || '').toLowerCase()
  const bt = String(bizType || '').toLowerCase()

  if (bt.includes('contract') || bt === 'contractcompleteness') {
    return key.includes('contract') || key.includes('analyze') || key.includes('parse')
      || name.includes('合同') || name.includes('完备')
  }
  if (bt.includes('meeting') || bt.includes('meetingminutes')) {
    return key.includes('meeting') || key.includes('cluster') || key.includes('analyze')
      || name.includes('会议') || name.includes('纪要')
  }
  if (bt.includes('engineering')) {
    return key.includes('engineering') || key.includes('analyze') || key.includes('execute')
      || name.includes('工程') || name.includes('项目')
  }
  if (bt.includes('association') || bt.includes('twotable') || bt.includes('associationdegreetwotables')) {
    return key.includes('analyze') || key.includes('detect') || key.includes('execute')
      || name.includes('两表') || name.includes('对比') || name.includes('关联')
  }
  if (bt.includes('wordcloud')) {
    return key.includes('analyze') || name.includes('词云')
  }
  if (bt.includes('riskpoint')) {
    return key.includes('analyze') || name.includes('风险点')
  }
  if (bt === 'prepaidexpenses') {
    return key === 'calculate_expense'
  }
  return key.includes('extract')
    || name.includes('内容提取')
    || name.includes('文本提取')
    || name.includes('文本信息')
}

/**
 * 构建运行时进度树中的文件夹/文件子节点（TaskRuntimeProgressTree 格式）
 * @param {Object} detail 任务详情
 * @returns {Array} 子节点列表
 */
export function buildFolderTreeNodesForSelectionStep(detail) {
  const taskUuid = detail?.task_uuid
  const summary = normalizeSelectionSummary(detail) || {}
  const sources = summary?.selection_sources || {}
  const selectedFolders = Array.isArray(sources.folders) ? sources.folders : []
  const resultList = Array.isArray(detail?.task_schedule_result_list) ? detail.task_schedule_result_list : []
  const sourceRefMap = buildSourceRefsFromResultList(resultList)
  const folderNameMap = buildFolderNameMapFromSourceRefs(sourceRefMap)

  const folderIdToStatusList = new Map()
  const looseFiles = []
  resultList.forEach((r) => {
    const fileUuid = r.file_uuid || r.FILE_UUID || r.result_uuid || r.RESULT_UUID
    const fileName = r.file_name || r.FILE_NAME || '未命名文件'
    const status = Number(r.processing_status)
    const refs = sourceRefMap.get(fileUuid) || []
    const folderRefs = refs.filter((ref) => ref && ref.source_type === 'folder' && ref.source_id)
    if (folderRefs.length > 0) {
      folderRefs.forEach((ref) => {
        const folderId = ref.source_id
        const statusList = folderIdToStatusList.get(folderId) || []
        statusList.push(Number.isNaN(status) ? 0 : status)
        folderIdToStatusList.set(folderId, statusList)
      })
      return
    }
    const safeStatus = Number.isNaN(status) ? 0 : status
    looseFiles.push({
      id: `file-${fileUuid}`,
      key: fileUuid,
      task_uuid: taskUuid,
      name: fileName,
      node_type: 'file_item',
      status: safeStatus,
      total_count: 1,
      done_count: safeStatus === 2 || safeStatus === 3 ? 1 : 0
    })
  })

  const mapFolderNode = (folderNode, parentKey) => {
    const folderId = folderNode?.folder_id || `${parentKey}-unknown-folder`
    const folderName = pickDisplayFolderName(folderNode, folderNameMap) || '文件夹'
    const childFolders = Array.isArray(folderNode?.children)
      ? folderNode.children.map((child, idx) => mapFolderNode(child, `${parentKey}-${idx}`))
      : []
    const ownStatusList = folderIdToStatusList.get(folderId) || []
    const ownTotal = ownStatusList.length
    const ownDone = ownStatusList.filter((s) => Number(s) === 2 || Number(s) === 3).length
    const childTotal = childFolders.reduce((sum, node) => sum + Number(node.total_count || 0), 0)
    const childDone = childFolders.reduce((sum, node) => sum + Number(node.done_count || 0), 0)
    const failed = ownStatusList.some((s) => Number(s) === 3)
      || childFolders.some((n) => Number(n.status) === 3)
    const running = ownStatusList.some((s) => Number(s) === 1)
      || childFolders.some((n) => Number(n.status) === 1)
    const total = ownTotal + childTotal
    const done = ownDone + childDone
    const status = failed ? 3 : (running ? 1 : (total > 0 && done === total ? 2 : 0))
    return {
      id: `folder-${folderId}`,
      key: folderId,
      folder_id: folderId,
      task_uuid: taskUuid,
      name: folderName,
      node_type: 'folder_item',
      status,
      total_count: total,
      done_count: done,
      children: childFolders
    }
  }

  const folderNodes = selectedFolders.map((folder, idx) => mapFolderNode(folder, `root-${idx}`))
  if (looseFiles.length > 0) {
    folderNodes.push(...looseFiles)
  }
  return folderNodes
}

/**
 * 根据任务详情解析 biz_type（供运行时树步骤匹配）
 * @param {Object} detail 任务详情
 * @returns {string} biz_type 提示
 */
export function resolveSelectionBizType(detail) {
  const explicit = detail?.biz_type || detail?.BIZ_TYPE
  if (explicit) return String(explicit)
  const taskType = Number(detail?.task_type ?? detail?.TASK_TYPE)
  if (taskType === 2) return 'contractCompleteness'
  if (taskType === 6) return 'engineeringProject'
  if (taskType === 9) return 'associationDegreeTwoTables'
  if (taskType === 7) return 'meetingMinutes'
  return ''
}

/**
 * 从任务结果列表构建 addFilesFromManager 可用的文件行
 * @param {Object} taskDetail 任务详情
 * @returns {Array<Object>} 文件行
 */
export function buildManagerRowsFromTaskResultList(taskDetail) {
  const resultList = Array.isArray(taskDetail?.task_schedule_result_list)
    ? taskDetail.task_schedule_result_list
    : []
  const sourceRefMap = buildSourceRefsFromResultList(resultList)
  const folderNameMap = buildFolderNameMapFromSourceRefs(sourceRefMap)
  const rows = []
  resultList.forEach((resultItem) => {
    const fileId = resultItem?.file_uuid || resultItem?.FILE_UUID
    if (!fileId) return
    const fileName = resultItem.file_name || resultItem.FILE_NAME || '文件'
    const baseRow = {
      file_id: fileId,
      file_name: fileName,
      folder_path: ''
    }
    const enriched = enrichFileRowWithSourceRefs(baseRow, resultItem, folderNameMap)
    rows.push({
      file_id: fileId,
      file_name: fileName,
      folder_path: enriched.folderPath || enriched.folder_path || ''
    })
  })
  return rows
}

/**
 * 将 selection 文件夹树挂载到运行时步骤树的匹配步骤下
 * @param {Array} nodes 运行时树根
 * @param {Object} detail 任务详情（含 selection_summary、task_schedule_result_list、biz_type）
 * @returns {Array} 挂载后的树
 */
export function attachSelectionTreeToRuntimeNodes(nodes, detail) {
  if (!Array.isArray(nodes) || nodes.length === 0) return nodes
  const normalizedDetail = {
    ...detail,
    selection_summary: normalizeSelectionSummary(detail)
  }
  if (!hasSelectionSnapshot(normalizedDetail)) return nodes

  const selectionChildren = buildFolderTreeNodesForSelectionStep(normalizedDetail)
  if (!selectionChildren.length) return nodes

  const bizType = resolveSelectionBizType(normalizedDetail)
  const replaceChildren = (arr) => arr.map((node) => {
    const next = { ...node }
    next.children = Array.isArray(next.children) ? replaceChildren(next.children) : []
    if (isSelectionAttachStepNode(next, bizType)) {
      next.children = selectionChildren
      next.total_count = selectionChildren.reduce((sum, child) => sum + Number(child.total_count || 0), 0)
      next.done_count = selectionChildren.reduce((sum, child) => sum + Number(child.done_count || 0), 0)
    }
    return next
  })
  return replaceChildren(nodes)
}

/**
 * 将任务 selection_summary 应用到 useSimpleOcrLeftSidebar 实例（详情页左侧树）
 * @param {Object} sidebarCore useSimpleOcrLeftSidebar 返回值
 * @param {Object} taskDetail 任务详情
 * @returns {void}
 */
export function applyTaskSelectionToSidebar(sidebarCore, taskDetail) {
  if (!sidebarCore || !taskDetail) return
  const summary = normalizeSelectionSummary(taskDetail)
  if (!summary) return

  const sources = summary.selection_sources || {}
  const selectedFolders = Array.isArray(sources.folders) ? sources.folders : []
  const resultList = Array.isArray(taskDetail.task_schedule_result_list)
    ? taskDetail.task_schedule_result_list
    : []
  const sourceRefMap = buildSourceRefsFromResultList(resultList)
  const folderNameMap = buildFolderNameMapFromSourceRefs(sourceRefMap)

  if (selectedFolders.length > 0 && sidebarCore.fileSelectEnrichedFolders) {
    const enrichedFolders = flattenSelectionFoldersToEnriched(
      selectedFolders,
      folderNameMap
    )
    sidebarCore.fileSelectEnrichedFolders.value = enrichedFolders

    if (sidebarCore.fileSelectInitialFolders) {
      sidebarCore.fileSelectInitialFolders.value = enrichedFolders.map((folder) => ({
        folder_id: folder.folder_id,
        folder_name: folder.folder_name || '',
        folder_path: folder.folder_path || '',
        scope: folder.scope || 'SELF',
        eligible_count: 0
      }))
    }

    if (sidebarCore.checkedFolderPaths) {
      sidebarCore.checkedFolderPaths.value = enrichedFolders
        .map((folder) => normalizeFolderPathForTree(folder.folder_path || ''))
        .filter(Boolean)
    }
  }

  if (sidebarCore.fileTreeRenderKey) {
    sidebarCore.fileTreeRenderKey.value += 1
  }
}

/**
 * 任务详情反显后恢复左侧栏勾选（文件 + 文件夹），供再次执行组参
 * @param {Object} sidebarCore useSimpleOcrLeftSidebar 返回值
 * @returns {void}
 */
export function restoreSidebarExecuteSelection(sidebarCore) {
  if (!sidebarCore) return
  if (typeof sidebarCore.restoreSelectionFromFiles === 'function') {
    sidebarCore.restoreSelectionFromFiles()
  }
  const folders = sidebarCore.fileSelectInitialFolders?.value || []
  if (sidebarCore.checkedFolderPaths && folders.length > 0) {
    sidebarCore.checkedFolderPaths.value = folders
      .map((folder) => normalizeFolderPathForTree(folder.folder_path || ''))
      .filter(Boolean)
  }
}

/**
 * 为任务结果行补充 folderPath / source_refs（供左侧树挂载文件）
 * @param {Object} fileRow 前端文件对象
 * @param {Object} resultItem 后端结果行
 * @param {Map<string, string>} folderNameMap 文件夹名称映射
 * @returns {Object} 补充后的文件对象
 */
export function enrichFileRowWithSourceRefs(fileRow, resultItem, folderNameMap) {
  const sourceRefs = parseSourceRefsFromResultItem(resultItem)
  const folderPath = resolveFolderPathFromSourceRefs(sourceRefs, folderNameMap)
  return {
    ...fileRow,
    source_refs: sourceRefs,
    folderPath: folderPath || fileRow.folderPath || '',
    folder_path: folderPath || fileRow.folder_path || ''
  }
}

/** biz_type 与 task_type 不一致时（如 BatchExecuteByFilter 默认 task_type=1）仍打开正确详情组件 */
const BIZ_TYPE_TASK_DETAIL_VIEWER = {
  contractCompleteness: 2,
  engineeringProject: 6,
  engineering_project_data_consistency: 6,
  associationDegreeTwoTables: 9,
  association_degree_two_tables: 9,
  wordCloud: 4,
  wordCloudAnalysis: 4,
  meeting_minutes: 7,
  biz_topic_summary: 5,
  agent_info_extraction: 5,
  agent_info_extraction_and_topic_summary: 5,
  themeAnalysisExtract: 5,
  riskPointAnalysis: 8,
  prepaidExpenses: 10,
  timelineAnalysis: 3,
  timeline_analysis: 3,
  biddingAnalysis: 10
}

export function resolveTaskDetailViewerType(task) {
  const biz = String(task?.biz_type || task?.BIZ_TYPE || '').trim()
  if (biz && BIZ_TYPE_TASK_DETAIL_VIEWER[biz] != null) {
    return BIZ_TYPE_TASK_DETAIL_VIEWER[biz]
  }
  const tt = Number(task?.task_type)
  return Number.isFinite(tt) ? tt : 1
}

/** task_type=10 同时对应待摊费用与招投标，须用 biz_type 区分详情组件 */
export function resolveTaskDetailBizType(task) {
  const biz = String(task?.biz_type || task?.BIZ_TYPE || '').trim()
  if (biz) return biz
  if (Number(task?.task_type) === 10) return 'prepaidExpenses'
  return ''
}
