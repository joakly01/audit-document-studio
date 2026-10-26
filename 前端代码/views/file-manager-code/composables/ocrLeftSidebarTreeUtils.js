/**
 * 左侧文件树构建工具（与 OcrViewer 保持一致）
 */

/**
 * 规范化文件夹路径
 * @param {string} path 原始路径
 * @returns {string} 规范化路径
 */
export function normalizeFolderPathForTree(path) {
  return String(path || '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

/**
 * 路径拆分为层级数组
 * @param {string} path 文件夹路径
 * @returns {Array<string>} 目录名数组
 */
export function pathToSegments(path) {
  return normalizeFolderPathForTree(path).split('/').map((s) => s.trim()).filter(Boolean)
}

/**
 * 在弹窗树中按 folder_id 查找节点
 * @param {Array} nodes 树根数组
 * @param {string} folderId 文件夹 id
 * @returns {Object|null} 节点或 null
 */
export function findConvertedTreeNodeByFolderId(nodes, folderId) {
  if (!folderId || !nodes || !nodes.length) return null
  for (const n of nodes) {
    if (n.id === folderId) return n
    const found = findConvertedTreeNodeByFolderId(n.children || [], folderId)
    if (found) return found
  }
  return null
}

/**
 * 为 SELF_AND_DESC 文件夹挂载 treeChildren
 * @param {Array} folders 选中的文件夹
 * @param {Array} treeRoots 弹窗 treeData
 * @returns {Array} 富集后的文件夹列表
 */
export function enrichFileSelectFoldersWithTreeChildren(folders, treeRoots) {
  const roots = Array.isArray(treeRoots) ? treeRoots : []
  return (folders || []).map((f) => {
    const row = { ...f }
    row.treeChildren = []
    if (f.scope === 'SELF_AND_DESC' && roots.length > 0) {
      const node = findConvertedTreeNodeByFolderId(roots, f.folder_id)
      if (node && Array.isArray(node.children) && node.children.length > 0) {
        row.treeChildren = JSON.parse(JSON.stringify(node.children))
      }
    }
    return row
  })
}

/**
 * 弹窗子节点转文件夹树节点
 * @param {Object} dc 弹窗节点
 * @param {string} parentFolderPathNormalized 父路径
 * @returns {Object|null} 树节点
 */
function dialogTreeNodeToOurFolderSubtree(dc, parentFolderPathNormalized) {
  if (!dc) return null
  const name = String(dc.name || '').trim() || '未命名'
  const folderPath = parentFolderPathNormalized
    ? `${parentFolderPathNormalized}/${name}`
    : name
  const normalized = normalizeFolderPathForTree(folderPath)
  const children = []
  for (const ch of dc.children || []) {
    const sub = dialogTreeNodeToOurFolderSubtree(ch, normalized)
    if (sub) children.push(sub)
  }
  return {
    treeKey: `folder:${normalized}`,
    name,
    nodeType: 'folder',
    folderId: dc.id || '',
    folderPath: normalized,
    children
  }
}

/**
 * 合并弹窗子树到文件夹节点
 * @param {Object} folderNode 文件夹节点
 * @param {Array} dialogChildren 子节点
 * @param {string} parentFolderPathNormalized 父路径
 * @returns {void}
 */
export function mergeDialogChildrenIntoFolderNode(folderNode, dialogChildren, parentFolderPathNormalized) {
  if (!folderNode || folderNode.nodeType !== 'folder' || !dialogChildren || !dialogChildren.length) {
    return
  }
  if (!folderNode.children) folderNode.children = []
  const byKey = new Map()
  folderNode.children.forEach((c) => {
    if (c && c.treeKey) byKey.set(c.treeKey, c)
  })
  for (const dc of dialogChildren) {
    const name = String(dc.name || '').trim() || '未命名'
    const childPath = parentFolderPathNormalized
      ? `${parentFolderPathNormalized}/${name}`
      : name
    const normalized = normalizeFolderPathForTree(childPath)
    const treeKey = `folder:${normalized}`
    const existing = byKey.get(treeKey)
    if (!existing) {
      const sub = dialogTreeNodeToOurFolderSubtree(dc, parentFolderPathNormalized)
      if (sub) {
        folderNode.children.push(sub)
        byKey.set(sub.treeKey, sub)
      }
    } else if (existing.nodeType === 'folder' && dc.children && dc.children.length > 0) {
      mergeDialogChildrenIntoFolderNode(existing, dc.children, existing.folderPath)
    }
  }
}

/**
 * 构建左侧平铺树：文件夹 + 文件
 * @param {Array} files 文件列表
 * @param {Array} enrichedFolders 富集文件夹
 * @param {Array<string>} retainedPaths 保留空目录路径
 * @param {Object} [attachmentsMap={}] 文件附件缓存：file_id -> 附件列表
 * @returns {Array} 树根节点
 */
export function buildFlatLeftTreeData(files, enrichedFolders, retainedPaths = [], attachmentsMap = {}) {
  const rootNodes = []
  const seenFolderPaths = new Set()

  ;(enrichedFolders || []).forEach((ef) => {
    const fp = normalizeFolderPathForTree(ef.folder_path || '')
    const folderId = ef.folder_id || fp
    const treeKey = `folder:sel:${folderId}`
    if (fp && seenFolderPaths.has(fp)) return
    if (fp) seenFolderPaths.add(fp)
    const folderNode = {
      treeKey,
      name: ef.folder_name || (pathToSegments(ef.folder_path).pop() || '文件夹'),
      nodeType: 'folder',
      folderId: ef.folder_id || '',
      folderPath: fp,
      children: []
    }
    if (ef.scope === 'SELF_AND_DESC' && ef.treeChildren && ef.treeChildren.length > 0) {
      mergeDialogChildrenIntoFolderNode(folderNode, ef.treeChildren, fp)
    }
    rootNodes.push(folderNode)
  })

  ;(retainedPaths || []).forEach((folderPath) => {
    const fp = normalizeFolderPathForTree(folderPath)
    if (!fp || seenFolderPaths.has(fp)) return
    seenFolderPaths.add(fp)
    const segments = pathToSegments(fp)
    const name = segments.length ? segments[segments.length - 1] : fp
    rootNodes.push({
      treeKey: `folder:retained:${fp}`,
      name,
      nodeType: 'folder',
      folderId: '',
      folderPath: fp,
      children: []
    })
  })

  const looseFileNodes = []
  const folderPathMap = new Map()

  /**
   * 收集树中文件夹节点路径索引
   * @param {Array} nodes 树节点
   * @returns {void}
   */
  const collectFolderPathMap = (nodes) => {
    ;(nodes || []).forEach((node) => {
      if (!node) return
      if (node.nodeType === 'folder') {
        const fp = normalizeFolderPathForTree(node.folderPath || '')
        if (fp) folderPathMap.set(fp, node)
        if (Array.isArray(node.children) && node.children.length > 0) {
          collectFolderPathMap(node.children)
        }
      }
    })
  }
  collectFolderPathMap(rootNodes)

  ;(files || []).forEach((file) => {
    const fileIdentifier = file.documentId || file.file_id || file.fileId || file.id || file.name
    const attachmentFileId = getAttachmentFileId(file)
    const attachments = attachmentFileId ? (attachmentsMap[attachmentFileId] || []) : []
    file.attachmentCount = attachments.length
    file.attachments = attachments
    const fileNode = {
      treeKey: `file:${String(fileIdentifier)}`,
      name: file.name || '未命名文件',
      nodeType: 'file',
      sourceFile: file
    }
    const fp = getFileFolderPath(file)
    if (!fp) {
      looseFileNodes.push(fileNode)
      return
    }
    let bestPath = ''
    folderPathMap.forEach((_node, path) => {
      if (fp === path || fp.startsWith(`${path}/`)) {
        if (path.length > bestPath.length) bestPath = path
      }
    })
    const parentFolder = bestPath ? folderPathMap.get(bestPath) : null
    if (parentFolder) {
      if (!Array.isArray(parentFolder.children)) {
        parentFolder.children = []
      }
      parentFolder.children.push(fileNode)
    } else {
      looseFileNodes.push(fileNode)
    }
  })

  return rootNodes.concat(looseFileNodes)
}

/**
 * 按关键字过滤树节点
 * @param {Object} node 树节点
 * @param {string} keywordLower 小写关键字
 * @returns {Object|null} 过滤后节点
 */
export function filterLeftTreeNodeByKeyword(node, keywordLower) {
  if (!node) return null
  const selfName = String(node.name || '').toLowerCase()
  const selfMatched = selfName.includes(keywordLower)

  if (node.nodeType === 'file') {
    return selfMatched ? { ...node } : null
  }

  const children = Array.isArray(node.children) ? node.children : []
  const filteredChildren = children
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

/**
 * 获取文件所在目录路径
 * @param {Object} file 文件对象
 * @returns {string} 目录路径
 */
export function getFileFolderPath(file) {
  if (!file) return ''
  const rawPath = file.folderPath || file.path || file.directory || file.folder_path || ''
  return normalizeFolderPathForTree(rawPath)
}

/**
 * 获取文件唯一标识
 * @param {Object} file 文件对象
 * @returns {string|number} 标识
 */
export function getFileIdentifier(file) {
  if (!file) return ''
  return file.documentId || file.file_id || file.fileId || file.id || file.name || ''
}

/**
 * 获取文件的后端 file_id，用于附件查询
 * @param {Object} file 文件对象
 * @returns {string|number} 后端文件标识
 */
export function getAttachmentFileId(file) {
  if (!file) return ''
  return file.fileId || file.file_uuid || file.file_id || file.id || ''
}

/**
 * 收集树中全部文件夹路径
 * @param {Array} treeNodes 树根数组
 * @returns {Array<string>} 路径列表
 */
export function collectVisibleFolderPaths(treeNodes) {
  const paths = []
  const travel = (nodes) => {
    ;(nodes || []).forEach((node) => {
      if (!node) return
      if (node.nodeType === 'folder' && node.folderPath) {
        paths.push(node.folderPath)
      }
      if (node.children && node.children.length > 0) {
        travel(node.children)
      }
    })
  }
  travel(treeNodes)
  return paths
}

/**
 * 收集文件夹节点及子文件夹路径
 * @param {Object} treeNode 文件夹节点
 * @returns {Array<string>} 路径列表
 */
export function collectFolderPathsFromNode(treeNode) {
  if (!treeNode || treeNode.nodeType !== 'folder') {
    return []
  }
  const pathList = []
  const travel = (node) => {
    if (!node || node.nodeType !== 'folder') return
    if (node.folderPath) pathList.push(node.folderPath)
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => travel(child))
    }
  }
  travel(treeNode)
  return pathList
}

/**
 * 判断文件是否为已解析（与 FileSelectDialog 一致）
 * @param {Object|null} file 文件对象
 * @returns {boolean} 是否已解析；无状态字段时视为已解析（来自仅已解析选择弹窗）
 */
export function isParsedDocumentFile(file) {
  if (!file) return false
  const status = file.document_parse_status != null
    ? file.document_parse_status
    : file.parse_status
  if (status == null || status === '') return true
  return String(status).toLowerCase() === 'parsed'
}

/**
 * 判断文件名是否匹配允许的后缀列表
 * @param {string} fileName 文件名
 * @param {Array<string>} fileExtensions 允许的后缀（可带点，如 .pdf）
 * @returns {boolean} 是否匹配；extensions 为空时不过滤
 */
export function matchesFileExtension(fileName, fileExtensions) {
  if (!Array.isArray(fileExtensions) || fileExtensions.length === 0) {
    return true
  }
  const name = String(fileName || '')
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  if (!ext) return false
  const allowedSet = new Set(
    fileExtensions
      .map((item) => String(item || '').replace(/^\./, '').toLowerCase())
      .filter(Boolean)
  )
  return allowedSet.has(ext)
}

/**
 * 构建文件夹内文件列表 query（与 FileSelectDialog.serverListFilterQuery 对齐）
 * @param {Object} base 基础参数，如 folder_id、page、page_size
 * @param {Object} [options] 选项
 * @param {boolean} [options.allowUnparsed=false] 为 true 时不限制解析状态
 * @param {Array<string>} [options.fileExtensions] 允许的后缀（可带点）
 * @returns {Object} getFileListAPI 请求参数
 */
export function buildFolderFileListQueryParams(base = {}, options = {}) {
  const params = { ...base }
  if (options.allowUnparsed !== true) {
    params.document_parse_status = 'parsed'
  }
  if (Array.isArray(options.fileExtensions) && options.fileExtensions.length > 0) {
    params.file_extensions = options.fileExtensions
      .map((ext) => String(ext || '').replace(/^\./, ''))
      .filter(Boolean)
      .join(',')
  }
  return params
}

/**
 * 按解析策略过滤文件列表（本地缓存列表用）
 * @param {Array} files 文件数组
 * @param {boolean} [allowUnparsed=false] 是否保留未解析
 * @returns {Array} 过滤后的文件
 */
export function filterFilesByParsePolicy(files, allowUnparsed = false) {
  if (allowUnparsed === true) return files || []
  return (files || []).filter((file) => isParsedDocumentFile(file))
}
