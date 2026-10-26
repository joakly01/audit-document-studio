/**
 * 词云分析：从左侧公共树勾选结果解析待提交的 file_ids
 */
import { getFileListAPI } from '@/api/fileManager.js'
import {
  buildFolderFileListQueryParams,
  normalizeFolderPathForTree,
  getFileIdentifier
} from './ocrLeftSidebarTreeUtils.js'
import {
  getTargetFilesForExecute,
  hasExecuteTargets as checkHasExecuteTargets
} from './buildMeetingMinutesExecutePayload.js'

/**
 * 从左侧树按路径查找 folder_id
 * @param {string} folderPath 文件夹路径
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
 * 分页拉取文件夹下符合词云类型的 file_id
 * @param {string} folderId 文件夹 ID
 * @param {string} scope 选择范围 SELF | SELF_AND_DESC
 * @param {Array<string>} fileExtensions 允许的后缀（带点）
 * @returns {Promise<Array<string>>} file_id 列表
 */
async function fetchFolderFileIds(folderId, scope, fileExtensions) {
  if (!folderId) return []
  const recursive = scope === 'SELF_AND_DESC'
  const pageSize = 100
  let page = 1
  const ids = []
  let hasMore = true

  while (hasMore) {
    const params = buildFolderFileListQueryParams(
      {
        folder_id: folderId,
        page,
        page_size: pageSize,
        recursive
      },
      { allowUnparsed: false }
    )
    if (Array.isArray(fileExtensions) && fileExtensions.length > 0) {
      params.file_extensions = fileExtensions
        .map((ext) => String(ext || '').replace(/^\./, ''))
        .filter(Boolean)
        .join(',')
    }
    const res = await getFileListAPI(params)
    if (!(res?.code === 200 && res?.data)) break
    const rows = Array.isArray(res.data.files)
      ? res.data.files
      : Array.isArray(res.data.items)
        ? res.data.items
        : []
    rows.forEach((row) => {
      const id = row.file_id || row.file_uuid || row.document_id || ''
      if (id) ids.push(String(id))
    })
    const total = Number(res.data.total || 0)
    hasMore = rows.length > 0 && ids.length < total && rows.length >= pageSize
    page += 1
  }

  return ids
}

/**
 * 是否存在可分析目标（勾选文件或文件夹）
 * @param {Object} ctx 左侧栏上下文
 * @returns {boolean} 是否可分析
 */
export function hasWordCloudExecuteTargets(ctx) {
  return checkHasExecuteTargets(ctx)
}

/**
 * 解析词云分析待提交的 file_ids（勾选文件 + 勾选文件夹远程展开）
 * @param {Object} ctx 左侧栏上下文
 * @param {Object} [options] 选项
 * @param {Array<string>} [options.fileExtensions] 允许的后缀
 * @returns {Promise<Array<string>>} 去重后的 file_id 列表
 */
export async function resolveWordCloudExecuteFileIds(ctx, options = {}) {
  const extensions = Array.isArray(options.fileExtensions)
    ? options.fileExtensions
    : ['.pdf', '.doc', '.docx']
  const idSet = new Set()

  getTargetFilesForExecute(ctx).forEach((file) => {
    const fileId = getFileIdentifier(file)
    if (fileId) idSet.add(String(fileId))
  })

  const checkedPaths = (ctx.checkedFolderPaths || [])
    .map((path) => normalizeFolderPathForTree(path))
    .filter(Boolean)
  const initialFolders = ctx.fileSelectInitialFolders || []

  for (const folderPath of checkedPaths) {
    const meta = findSelectedFolderMetaByPath(folderPath, initialFolders) || {}
    const folderId =
      meta.folder_id ||
      findFolderIdByPathFromFileTree(folderPath, ctx.fileTreeData || '') ||
      ''
    if (!folderId) continue
    const scope = meta.scope || 'SELF'
    const remoteIds = await fetchFolderFileIds(folderId, scope, extensions)
    remoteIds.forEach((id) => idSet.add(id))
  }

  return Array.from(idSet)
}
