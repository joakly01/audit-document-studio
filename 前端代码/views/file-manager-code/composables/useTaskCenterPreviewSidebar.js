import { ref, computed, unref } from 'vue'
import { Search, Document, Folder, View, Hide } from '@element-plus/icons-vue'
import { getTaskSchedulesAPI } from '@/api/task.js'
import {
  filterLeftTreeNodeByKeyword,
  getFileIdentifier
} from './ocrLeftSidebarTreeUtils.js'
import {
  buildPreviewSidebarTreeFromDetail,
  convertTaskResultListForPreview,
  isSamePreviewFileIdSet,
  patchPreviewFileListStatusesInPlace,
  patchPreviewTreeFolderStatusesInPlace
} from '@/views/ocr-task-center/taskCenterPreviewSidebarTreeUtils.js'

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
 * 任务中心详情：左侧预览模式侧栏（对齐文本信息提取 / 会议纪要）
 * @param {Object} options 配置项
 * @param {import('vue').Ref<string>|string|Function} options.taskId 任务 UUID
 * @param {import('vue').Ref<string>|string} [options.taskName] 任务名称
 * @param {import('vue').Ref<boolean>} [options.showFilePreview] 中间预览显隐
 * @param {Function} options.handleTreeNodeClick 树节点点击回调
 * @param {Function} [options.isFileActive] 判断文件是否激活
 * @returns {Object} 状态与方法
 */
export function useTaskCenterPreviewSidebar(options = {}) {
  const rawTaskDetail = ref(null)
  const taskPreviewFileList = ref([])
  /** 稳定的基础树（状态刷新时就地 patch，避免整体替换导致展开收起） */
  const taskPreviewSidebarTreeBase = ref([])
  const taskPreviewSearchKeyword = ref('')
  const taskPreviewTreeRenderKey = ref(0)

  const taskPreviewFileTreeProps = {
    value: 'treeKey',
    label: 'name',
    children: 'children'
  }

  /**
   * 解析 taskId
   * @returns {string} 任务 UUID
   */
  const resolveTaskId = () => {
    const raw = options.taskId
    if (typeof raw === 'function') return String(raw() || '')
    return String(unref(raw) || '')
  }

  const taskPreviewSidebarTree = computed(() => {
    const keyword = String(taskPreviewSearchKeyword.value || '').trim().toLowerCase()
    if (!keyword) return taskPreviewSidebarTreeBase.value
    return taskPreviewSidebarTreeBase.value
      .map((node) => filterLeftTreeNodeByKeyword(node, keyword))
      .filter(Boolean)
  })

  const taskPreviewRuntimeNodes = computed(() => {
    const detail = rawTaskDetail.value || {}
    if (Array.isArray(detail.runtime_nodes) && detail.runtime_nodes.length > 0) {
      return detail.runtime_nodes
    }
    if (Array.isArray(detail.step_tree) && detail.step_tree.length > 0) {
      return detail.step_tree
    }
    return []
  })

  const taskPreviewTaskName = computed(() => {
    const fromOpt = unref(options.taskName)
    if (fromOpt) return fromOpt
    const detail = rawTaskDetail.value || {}
    return detail.task_name || detail.TASK_NAME || '-'
  })

  /**
   * 判断预览侧栏文件是否为当前激活项
   * @param {Object} file 文件对象
   * @returns {boolean} 是否激活
   */
  const isTaskPreviewFileActive = (file) => {
    if (typeof options.isFileActive === 'function') {
      return options.isFileActive(file)
    }
    return false
  }

  /**
   * 解析侧栏树节点对应的源文件
   * @param {Object} treeNode 树节点
   * @returns {Object|null} 文件对象
   */
  const resolveSourceFileFromTreeNode = (treeNode) => {
    const source = treeNode?.sourceFile
    if (!source) return null
    const id = source.result_uuid || source.file_uuid || source.file_id || getFileIdentifier(source)
    if (!id) return source
    return (taskPreviewFileList.value || []).find((file) => {
      const fid = file.result_uuid || file.file_uuid || file.file_id
      return String(fid) === String(id)
    }) || source
  }

  /**
   * 仅更新任务详情中的轻量元数据（不触发整树重建）
   * @param {Object} detailRes 最新任务详情
   * @returns {void}
   */
  const patchRawTaskDetailMeta = (detailRes) => {
    if (!detailRes) return
    if (!rawTaskDetail.value) {
      rawTaskDetail.value = detailRes
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
  }

  /**
   * 写入预览侧栏数据；文件集合未变时仅就地更新状态，避免整树替换
   * @param {Object} detailRes 任务详情接口 data
   * @returns {void}
   */
  const applyTaskDetailToPreviewSidebar = (detailRes) => {
    if (!detailRes) {
      rawTaskDetail.value = null
      taskPreviewFileList.value = []
      taskPreviewSidebarTreeBase.value = []
      return
    }

    const incomingFiles = convertTaskResultListForPreview(
      detailRes.task_schedule_result_list || []
    )
    const canPatchStatusOnly = taskPreviewFileList.value.length > 0
      && taskPreviewSidebarTreeBase.value.length > 0
      && isSamePreviewFileIdSet(taskPreviewFileList.value, incomingFiles)

    if (canPatchStatusOnly) {
      patchPreviewFileListStatusesInPlace(
        taskPreviewFileList.value,
        detailRes.task_schedule_result_list || incomingFiles
      )
      patchPreviewTreeFolderStatusesInPlace(
        taskPreviewSidebarTreeBase.value,
        taskPreviewFileList.value
      )
      patchRawTaskDetailMeta(detailRes)
      return
    }

    rawTaskDetail.value = detailRes
    taskPreviewFileList.value = incomingFiles
    taskPreviewSidebarTreeBase.value = buildPreviewSidebarTreeFromDetail(
      detailRes,
      incomingFiles
    )
    // 仅在文件集合/树结构变化时重挂载；状态轮询不再递增，避免展开态丢失
    taskPreviewTreeRenderKey.value += 1
  }

  /**
   * 从任务中心加载预览侧栏（文件夹树 + 文件执行状态）
   * @param {Object} [cachedDetail] 已拉取的任务详情，避免重复请求
   * @returns {Promise<void>}
   */
  const loadTaskCenterPreviewSidebar = async (cachedDetail) => {
    const id = resolveTaskId()
    if (!id) return
    if (cachedDetail) {
      applyTaskDetailToPreviewSidebar(cachedDetail)
      return
    }
    try {
      const res = await getTaskSchedulesAPI(id, {
        prefer_runtime: true,
        include_results: true,
        include_selection_summary: true
      })
      if (res.code !== 200 || !res.data) return
      applyTaskDetailToPreviewSidebar(res.data)
    } catch (error) {
      console.warn('[任务预览侧栏] 加载失败:', error)
    }
  }

  const taskPreviewSidebarBindings = computed(() => ({
    showFilePreview: options.showFilePreview,
    searchKeyword: taskPreviewSearchKeyword,
    fileTreeData: taskPreviewSidebarTree,
    fileTreeRenderKey: taskPreviewTreeRenderKey,
    fileTreeProps: taskPreviewFileTreeProps,
    isFileActive: isTaskPreviewFileActive,
    handleTreeNodeClick: options.handleTreeNodeClick,
    getTreeNodeDisplayName,
    previewTaskName: taskPreviewTaskName,
    previewRuntimeNodes: taskPreviewRuntimeNodes,
    icons: {
      Hide,
      View,
      Search,
      Document,
      Folder
    }
  }))

  return {
    rawTaskDetail,
    taskPreviewFileList,
    taskPreviewSidebarBindings,
    taskPreviewTaskName,
    loadTaskCenterPreviewSidebar,
    applyTaskDetailToPreviewSidebar,
    resolveSourceFileFromTreeNode
  }
}
