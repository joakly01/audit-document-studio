import { ref, computed, unref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Document, Folder, Delete, View, Hide, Plus } from '@element-plus/icons-vue'
import { getTaskSchedulesAPI } from '@/api/task.js'
import { normalizeSelectionSummary } from '@/views/ocr-task-center/taskCenterSelectionTreeUtils.js'
import {
  buildPreviewSidebarTreeFromDetail,
  convertTaskResultListForPreview,
  isSamePreviewFileIdSet,
  patchPreviewFileListStatusesInPlace,
  patchPreviewTreeFolderStatusesInPlace
} from '@/views/ocr-task-center/taskCenterPreviewSidebarTreeUtils.js'
import {
  filterLeftTreeNodeByKeyword,
  getFileIdentifier,
  normalizeFolderPathForTree
} from '@/views/file-manager-code/composables/ocrLeftSidebarTreeUtils.js'

const TREE_NAME_MAX_LENGTH = 24

/**
 * 树节点名称截断展示
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
 * 任务中心/消息通知详情：OcrLeftSidebar 预览模式侧栏（与合同分析对齐）
 * @param {Object} options 配置项
 * @param {import('vue').Ref<boolean>|import('vue').ComputedRef<boolean>|boolean} options.enabled 是否启用预览侧栏
 * @param {import('vue').Ref<string>|import('vue').ComputedRef<string>|(() => string)} options.getTaskId 获取任务 ID
 * @param {import('vue').Ref<string>|import('vue').ComputedRef<string>|(() => string)} [options.getTaskName] 获取任务名称（接口未返回时兜底）
 * @param {(file: Object) => void|Promise<void>} options.onFileSelect 点击文件节点回调
 * @param {(folderCtx: { folderPath: string, folderName: string, files: Array }) => void|Promise<void>} [options.onFolderSelect] 点击文件夹节点回调
 * @returns {Object} 侧栏状态、bindings 与加载方法
 */
export function useTaskCenterPreviewSidebar(options = {}) {
  const rawTaskDetail = ref(null)
  const taskPreviewFileList = ref([])
  /** 稳定的基础树（状态刷新时就地 patch，避免整体替换导致展开收起） */
  const taskPreviewSidebarTreeBase = ref([])
  const taskPreviewSearchKeyword = ref('')
  const taskPreviewTreeRenderKey = ref(0)
  const taskPreviewShowFilePreview = ref(true)
  const taskPreviewActiveFileId = ref('')
  const previewTaskNameFromApi = ref('')

  const taskPreviewFileTreeProps = {
    value: 'treeKey',
    label: 'name',
    children: 'children'
  }

  /**
   * 预览侧栏展示用任务名称
   * @returns {string} 任务名称
   */
  const resolvedPreviewTaskName = computed(() => {
    const fromApi = String(previewTaskNameFromApi.value || '').trim()
    if (fromApi) return fromApi
    const fromOpt = typeof options.getTaskName === 'function'
      ? String(options.getTaskName() || '').trim()
      : String(unref(options.getTaskName) || '').trim()
    return fromOpt || '-'
  })

  const taskPreviewSidebarTree = computed(() => {
    const keyword = String(taskPreviewSearchKeyword.value || '').trim().toLowerCase()
    if (!keyword) return taskPreviewSidebarTreeBase.value
    return taskPreviewSidebarTreeBase.value
      .map((node) => filterLeftTreeNodeByKeyword(node, keyword))
      .filter(Boolean)
  })

  /**
   * 解析树节点对应的源文件对象
   * @param {Object} treeNode 树节点
   * @returns {Object|null} 文件对象
   */
  const resolveSourceFileFromTreeNode = (treeNode) => {
    const source = treeNode?.sourceFile
    if (!source) return null
    const id = source.result_uuid || source.file_uuid || source.file_id || getFileIdentifier(source)
    if (!id) return source
    return (taskPreviewFileList.value || []).find((f) => {
      const fid = f.result_uuid || f.file_uuid || f.file_id
      return String(fid) === String(id)
    }) || source
  }

  /**
   * 判断预览侧栏文件是否为当前激活项
   * @param {Object} file 文件对象
   * @returns {boolean} 是否激活
   */
  const isTaskPreviewFileActive = (file) => {
    if (!file || !taskPreviewActiveFileId.value) return false
    const fileId = file.result_uuid || file.file_uuid || file.file_id || getFileIdentifier(file)
    return fileId && String(fileId) === String(taskPreviewActiveFileId.value)
  }

  /**
   * 预览侧栏树节点点击
   * @param {Object} treeNode 树节点
   * @param {MouseEvent} [event] 点击事件
   * @returns {Promise<void>}
   */
  const handleTaskPreviewTreeNodeClick = async (treeNode, event) => {
    void event
    if (!treeNode) return
    if (treeNode.nodeType === 'file') {
      const sourceFile = resolveSourceFileFromTreeNode(treeNode)
      if (!sourceFile) {
        ElMessage.warning('文件信息不完整，无法预览')
        return
      }
      const fileId = getFileIdentifier(sourceFile) || sourceFile.file_uuid || sourceFile.file_id || ''
      taskPreviewActiveFileId.value = String(fileId || '')
      if (typeof options.onFileSelect === 'function') {
        await options.onFileSelect(sourceFile)
      }
      return
    }
    if (treeNode.nodeType === 'folder' && typeof options.onFolderSelect === 'function') {
      const folderPath = normalizeFolderPathForTree(treeNode.folderPath || '')
      const folderName = treeNode.name || ''
      const localFiles = (taskPreviewFileList.value || []).filter((file) => {
        const refs = Array.isArray(file.source_refs) ? file.source_refs : []
        return refs.some((ref) => {
          const refPath = normalizeFolderPathForTree(ref.folder_path || ref.source_name || '')
          if (!folderPath) return !refPath
          return refPath === folderPath || refPath.startsWith(`${folderPath}/`)
        })
      })
      await options.onFolderSelect({
        folderPath,
        folderName,
        files: localFiles
      })
    }
  }

  /**
   * 仅更新任务详情中的轻量元数据（不触发整树重建）
   * @param {Object} detailRes 最新任务详情
   * @returns {void}
   */
  const patchRawTaskDetailMeta = (detailRes) => {
    if (!detailRes) return
    if (!rawTaskDetail.value) {
      rawTaskDetail.value = {
        ...detailRes,
        selection_summary: normalizeSelectionSummary(detailRes)
      }
      return
    }
    const target = rawTaskDetail.value
    const metaKeys = [
      'task_status',
      'task_name',
      'TASK_NAME',
      'task_notes',
      'prepaid_phase',
      'ba_status',
      'rule_total',
      'rule_done',
      'runtime_nodes',
      'step_tree',
      'file_success_count',
      'file_failed_count',
      'file_processing_count',
      'file_pending_count'
    ]
    metaKeys.forEach((key) => {
      if (detailRes[key] !== undefined) {
        target[key] = detailRes[key]
      }
    })
    previewTaskNameFromApi.value = String(detailRes.task_name || previewTaskNameFromApi.value || '').trim()
  }

  /**
   * 从任务中心接口加载预览侧栏（文件树 + 成功/失败/执行中筛选）
   * 文件集合未变时仅就地更新状态，避免整树替换导致展开文件夹收起
   * @returns {Promise<void>}
   */
  const loadTaskCenterPreviewSidebar = async () => {
    const enabled = unref(options.enabled)
    const taskId = typeof options.getTaskId === 'function'
      ? String(options.getTaskId() || '').trim()
      : String(unref(options.getTaskId) || '').trim()
    if (!enabled || !taskId) return
    try {
      const res = await getTaskSchedulesAPI(taskId, {
        prefer_runtime: true,
        include_results: true,
        include_selection_summary: true
      })
      if (res.code !== 200 || !res.data) return

      const detailRes = {
        ...res.data,
        selection_summary: normalizeSelectionSummary(res.data)
      }
      const incomingFiles = convertTaskResultListForPreview(
        res.data.task_schedule_result_list || []
      )
      const canPatchStatusOnly = taskPreviewFileList.value.length > 0
        && taskPreviewSidebarTreeBase.value.length > 0
        && isSamePreviewFileIdSet(taskPreviewFileList.value, incomingFiles)

      if (canPatchStatusOnly) {
        patchPreviewFileListStatusesInPlace(
          taskPreviewFileList.value,
          res.data.task_schedule_result_list || incomingFiles
        )
        patchPreviewTreeFolderStatusesInPlace(
          taskPreviewSidebarTreeBase.value,
          taskPreviewFileList.value
        )
        patchRawTaskDetailMeta(detailRes)
        return
      }

      rawTaskDetail.value = detailRes
      previewTaskNameFromApi.value = String(res.data.task_name || '').trim()
      taskPreviewFileList.value = incomingFiles
      taskPreviewSidebarTreeBase.value = buildPreviewSidebarTreeFromDetail(
        detailRes,
        incomingFiles
      )
      taskPreviewTreeRenderKey.value += 1
    } catch (error) {
      console.warn('加载任务预览侧栏失败:', error)
    }
  }

  const taskPreviewSidebarBindings = computed(() => ({
    showFilePreview: taskPreviewShowFilePreview,
    searchKeyword: taskPreviewSearchKeyword,
    fileTreeData: taskPreviewSidebarTree,
    fileTreeRenderKey: taskPreviewTreeRenderKey,
    fileTreeProps: taskPreviewFileTreeProps,
    isFileActive: isTaskPreviewFileActive,
    handleTreeNodeClick: handleTaskPreviewTreeNodeClick,
    getTreeNodeDisplayName,
    previewTaskName: resolvedPreviewTaskName,
    icons: {
      Hide,
      View,
      Search,
      Document,
      Folder,
      Delete,
      Plus
    }
  }))

  return {
    rawTaskDetail,
    taskPreviewFileList,
    taskPreviewShowFilePreview,
    taskPreviewActiveFileId,
    taskPreviewSidebarBindings,
    loadTaskCenterPreviewSidebar,
    resolveSourceFileFromTreeNode
  }
}
