<template>
  <div
    class="task-runtime-progress-tree"
    v-loading="isAnyFolderLoading"
    element-loading-text="加载中..."
  >
    <template v-for="(row, idx) in flatRows" :key="stableRowKey(row, idx)">
      <div
        v-if="row.node_type === 'pager_item'"
        class="trpt-row trpt-row--pager"
        :style="{ paddingLeft: (12 + row.depth * 16) + 'px' }"
      >
        <el-input
          class="trpt-pager-search"
          size="small"
          clearable
          placeholder="搜索当前文件夹文件名"
          :model-value="getFolderSearchKeyword(row.parent_key)"
          @update:model-value="(val) => handleFolderSearchChange(row, val)"
        />
        <el-select
          class="trpt-pager-status"
          size="small"
          clearable
          placeholder="状态筛选"
          :model-value="getFolderStatusFilter(row.parent_key)"
          @update:model-value="(val) => handleFolderStatusChange(row, val)"
        >
          <el-option label="全部状态" :value="undefined" />
          <el-option label="待开始" :value="0" />
          <el-option label="进行中" :value="1" />
          <el-option label="已完成" :value="2" />
          <el-option label="失败" :value="3" />
        </el-select>
        <span class="trpt-pager-text">
          文件分页：第 {{ row.page }}/{{ row.total_pages }} 页（共 {{ row.total_files }} 条）
          <span v-if="row.loading">，加载中...</span>
        </span>
        <el-button
          size="small"
          text
          :disabled="row.page <= 1 || row.loading"
          @click.stop="changeFolderPage(row, row.page - 1)"
        >
          上一页
        </el-button>
        <el-button
          size="small"
          text
          :disabled="row.page >= row.total_pages || row.loading"
          @click.stop="changeFolderPage(row, row.page + 1)"
        >
          下一页
        </el-button>
      </div>
      <el-tooltip
        v-else-if="Number(row.status) === 3"
        :content="row.error_message || '失败原因未知'"
        placement="top"
        effect="dark"
      >
        <div
          class="trpt-row"
          :class="[statusRowClass(row.status), rowTypeClass(row)]"
          :style="{ paddingLeft: (12 + row.depth * 16) + 'px' }"
          @click="handleRowClick(row)"
        >
          <span
            class="trpt-toggle"
            :class="{ 'trpt-toggle--expanded': row.expanded, 'trpt-toggle--placeholder': !row.has_children }"
            @click.stop="toggleExpand(row)"
          >
            <el-icon v-if="row.has_children"><ArrowRight /></el-icon>
          </span>
          <el-icon class="trpt-icon" :class="statusIconClass(row.status)">
            <component :is="statusIcon(row.status)" />
          </el-icon>
          <el-icon v-if="nodeTypeIcon(row)" class="trpt-type-icon">
            <component :is="nodeTypeIcon(row)" />
          </el-icon>
          <span class="trpt-label" :title="row.name">{{ row.name }}</span>
          <el-icon v-if="row.loading" class="trpt-inline-loading is-loading"><Loading /></el-icon>
          <span v-if="row.loading" class="trpt-inline-loading-text">加载中...</span>
          <span
            v-if="isDisplayableCount(row.total_count)"
            class="trpt-meta"
          >{{ row.done_count }}/{{ row.total_count }}</span>
          <span class="trpt-status" :class="statusBadgeClass(row.status)">{{ statusLabel(row.status) }}</span>
        </div>
      </el-tooltip>
      <div
        v-else
        class="trpt-row"
        :class="[statusRowClass(row.status), rowTypeClass(row)]"
        :style="{ paddingLeft: (12 + row.depth * 16) + 'px' }"
        @click="handleRowClick(row)"
      >
        <span
          class="trpt-toggle"
          :class="{ 'trpt-toggle--expanded': row.expanded, 'trpt-toggle--placeholder': !row.has_children }"
          @click.stop="toggleExpand(row)"
        >
          <el-icon v-if="row.has_children"><ArrowRight /></el-icon>
        </span>
        <el-icon class="trpt-icon" :class="statusIconClass(row.status)">
          <component :is="statusIcon(row.status)" />
        </el-icon>
        <el-icon v-if="nodeTypeIcon(row)" class="trpt-type-icon">
          <component :is="nodeTypeIcon(row)" />
        </el-icon>
        <span class="trpt-label" :title="row.name">{{ row.name }}</span>
        <el-icon v-if="row.loading" class="trpt-inline-loading is-loading"><Loading /></el-icon>
        <span v-if="row.loading" class="trpt-inline-loading-text">加载中...</span>
        <span
          v-if="isDisplayableCount(row.total_count)"
          class="trpt-meta"
        >{{ row.done_count }}/{{ row.total_count }}</span>
        <span class="trpt-status" :class="statusBadgeClass(row.status)">{{ statusLabel(row.status) }}</span>
      </div>
    </template>
    <el-empty
      v-if="!flatRows.length"
      description="暂无步骤数据，请等待接口返回"
      :image-size="56"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Loading, CircleCheck, Clock, WarningFilled, Folder, Document, ArrowRight } from '@element-plus/icons-vue'
import { formatStepDisplayName } from '@/utils/taskListProgressContext.js'

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  folderFilePageSize: {
    type: Number,
    default: 10
  },
  fetchFolderFiles: {
    type: Function,
    default: null
  }
})
const emit = defineEmits(['node-click'])

function resolveDisplayStatus(node) {
  const raw = Number(node?.status)
  if (raw === 0 || raw === 1 || raw === 2 || raw === 3) return raw
  const total = Number(node?.total_count)
  const done = Number(node?.done_count)
  if (Number.isFinite(total) && total > 0 && Number.isFinite(done)) {
    if (done >= total) return 2
    if (done > 0) return 1
  }
  return 0
}

function flatten(arr, depth, out, expandedKeys, folderFilePageMap, folderFileSearchMap, pageSize, parentRowKey = null) {
  if (!arr || !arr.length) return out
  for (const n of arr) {
    const key = String(n.id || n.key || `${depth}-${out.length}`)
    const remoteState = folderRemoteDataMap.value[key] || {}
    const hasChildren = n?.node_type === 'folder_item'
      ? (typeof props.fetchFolderFiles === 'function' || !!(n.children && n.children.length))
      : !!(n.children && n.children.length)
    const expanded = hasChildren ? expandedKeys.value.has(key) : false
    const normalizedTotalCount = (() => {
      const remoteTotal = Number(remoteState?.total || 0)
      // 远端分页 total 更新更及时，优先使用
      if (remoteTotal > 0) return remoteTotal
      const localTotal = Number(n?.total_count || 0)
      if (localTotal > 0) return localTotal
      return n?.total_count
    })()
    const normalizedDoneCount = (() => {
      const done = Number(n?.done_count)
      if (!Number.isNaN(done) && done >= 0) return done
      // 无完成数时兜底为 0，避免展示 undefined/xx
      return 0
    })()
    const normalizedName = formatNodeName(n, normalizedTotalCount)
    out.push({
      id: n.id,
      key: n.key,
      _row_key: key,
      // 优先 subtask_display_name（如风险点名称），再回退到 formatNodeName
      name: n.subtask_display_name || normalizedName,
      status: resolveDisplayStatus(n),
      done_count: normalizedDoneCount,
      total_count: normalizedTotalCount,
      node_type: n.node_type,
      folder_id: n.folder_id,
      task_uuid: n.task_uuid,
      parent_row_key: parentRowKey,
      parent_key: n.parent_key,
      page: n.page,
      total_pages: n.total_pages,
      total_files: n.total_files,
      has_children: hasChildren,
      expanded,
      depth,
      error_message: n.error_message || null,
      loading: !!folderRemoteDataMap.value[key]?.loading,
    })
    if (hasChildren && expanded) {
      let childrenToRender = n.children
      if (n.node_type === 'folder_item') {
        const allChildren = Array.isArray(n.children) ? n.children : []
        const nonFileChildren = allChildren.filter((c) => c && c.node_type !== 'file_item')
        const state = folderRemoteDataMap.value[key] || {}
        const fileChildren = Array.isArray(state.items)
          ? state.items
          : allChildren.filter((c) => c && c.node_type === 'file_item')
        const totalFiles = Number(state.total || fileChildren.length || 0)
        const safeSize = Math.max(1, Number(pageSize) || 20)
        const totalPages = Math.max(1, Math.ceil(totalFiles / safeSize))
        const currentPage = Math.min(totalPages, Math.max(1, Number(state.page || folderFilePageMap.value[key] || 1)))
        folderFilePageMap.value[key] = currentPage
        childrenToRender = [...nonFileChildren, ...fileChildren]
        const hasFilter = (folderFileSearchMap.value[key] || '').trim().length > 0
          || folderFileStatusMap.value[key] !== undefined
        const shouldShowPager = totalFiles > 0 || state.loading || state.loaded || hasFilter
        if (shouldShowPager) {
          childrenToRender.push({
            id: `pager-${key}`,
            key: `pager-${key}`,
            node_type: 'pager_item',
            status: 0,
            parent_key: key,
            page: currentPage,
            total_pages: totalPages,
            total_files: totalFiles,
            loading: !!state.loading,
          })
        }
      }
      flatten(childrenToRender, depth + 1, out, expandedKeys, folderFilePageMap, folderFileSearchMap, pageSize, key)
    }
  }
  return out
}

function formatNodeName(node, totalCount) {
  const rawName = node?.name || node?.subtask_display_name || node?.filename || '步骤'
  const baseName = formatStepDisplayName(rawName, node?.key || node?.step_key)
  if (node?.node_type !== 'folder_item') return baseName
  const safeTotal = Number(totalCount || 0)
  const cleanName = String(baseName).replace(/\s*\(\d+\)\s*$/, '')
  if (safeTotal <= 0) return cleanName || baseName
  return `${cleanName || baseName} (${safeTotal})`
}

function isDisplayableCount(totalCount) {
  const total = Number(totalCount)
  return !Number.isNaN(total) && total >= 0
}

const expandedKeys = ref(new Set())
const folderFilePageMap = ref({})
const folderFileSearchMap = ref({})
const folderFileStatusMap = ref({})
const folderRemoteDataMap = ref({})

function collectExpandableKeys(arr, setRef, options = {}) {
  const { includeFolderItems = true } = options
  if (!arr || !arr.length) return
  for (const n of arr) {
    const hasChildren = !!(n.children && n.children.length)
    const isFolderItem = n?.node_type === 'folder_item'
    if (hasChildren && (includeFolderItems || !isFolderItem)) {
      setRef.add(String(n.id || n.key))
      collectExpandableKeys(n.children, setRef, options)
    }
  }
}

watch(
  () => props.nodes,
  (nodes) => {
    // 默认展开步骤节点，仅文件夹节点折叠到根目录
    const next = new Set()
    collectExpandableKeys(nodes || [], next, { includeFolderItems: false })
    expandedKeys.value = next
    folderFilePageMap.value = {}
    folderFileSearchMap.value = {}
    folderFileStatusMap.value = {}
    folderRemoteDataMap.value = {}
  },
  { immediate: true, deep: true }
)

const flatRows = computed(() => {
  const out = []
  flatten(props.nodes, 0, out, expandedKeys, folderFilePageMap, folderFileSearchMap, props.folderFilePageSize)
  return out
})

const isAnyFolderLoading = computed(() =>
  Object.values(folderRemoteDataMap.value || {}).some((x) => Boolean(x && x.loading))
)

function stableRowKey(row, idx) {
  return String(row._row_key || row.id || row.key || idx)
}

function statusIcon(s) {
  const v = Number(s)
  if (v === 1) return Loading
  if (v === 2) return CircleCheck
  if (v === 3) return WarningFilled
  return Clock
}

function statusIconClass(s) {
  const v = Number(s)
  if (v === 1) return 'trpt-st-running'
  if (v === 2) return 'trpt-st-done'
  if (v === 3) return 'trpt-st-fail'
  return 'trpt-st-wait'
}

function statusLabel(s) {
  const v = Number(s)
  if (v === 0) return '待开始'
  if (v === 1) return '进行中'
  if (v === 2) return '已完成'
  if (v === 3) return '失败'
  return '—'
}

function statusRowClass(s) {
  const v = Number(s)
  if (v === 1) return 'trpt-row--running'
  if (v === 2) return 'trpt-row--done'
  if (v === 3) return 'trpt-row--failed'
  return 'trpt-row--wait'
}

function statusBadgeClass(s) {
  const v = Number(s)
  if (v === 1) return 'trpt-badge--running'
  if (v === 2) return 'trpt-badge--done'
  if (v === 3) return 'trpt-badge--failed'
  return 'trpt-badge--wait'
}

function nodeTypeIcon(row) {
  if (!row) return null
  if (row.node_type === 'folder_item') return Folder
  if (row.node_type === 'file_item') return Document
  return null
}

function rowTypeClass(row) {
  if (row?.node_type === 'file_item') return 'trpt-row--file-item'
  if (row?.node_type === 'folder_item') return 'trpt-row--folder-item'
  return ''
}

async function toggleExpand(row) {
  if (!row || !row.has_children) return
  const key = String(row._row_key || row.id || row.key)
  if (!key) return
  const next = new Set(expandedKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    // 文件夹采用手风琴模式：同一时刻只展开一个文件夹（保留步骤节点展开态）
    if (row.node_type === 'folder_item') {
      const folderKeys = flatRows.value
        .filter((x) => x && x.node_type === 'folder_item')
        .map((x) => String(x._row_key || x.id || x.key))
      folderKeys.forEach((k) => next.delete(k))

      // 保留当前文件夹的父链，避免子文件夹展开时父级被折叠
      const keepKeys = new Set([key])
      let parentKey = row.parent_row_key
      const rowByKey = new Map(
        flatRows.value.map((x) => [String(x._row_key || x.id || x.key), x])
      )
      while (parentKey) {
        keepKeys.add(parentKey)
        const parentRow = rowByKey.get(parentKey)
        parentKey = parentRow?.parent_row_key || null
      }
      keepKeys.forEach((k) => next.add(k))
    } else {
      next.add(key)
    }
  }
  expandedKeys.value = next
  if (row.node_type === 'folder_item' && next.has(key)) {
    await loadFolderFiles(row, folderFilePageMap.value[key] || 1)
  }
}

function handleRowClick(row) {
  if (row?.node_type === 'pager_item') return
  emit('node-click', row)
}

function changeFolderPage(row, page) {
  const parentKey = row?.parent_key
  if (!parentKey) return
  folderFilePageMap.value = {
    ...folderFilePageMap.value,
    [parentKey]: page
  }
  const folderRow = flatRows.value.find((x) => String(x._row_key || x.id || x.key) === parentKey)
  if (folderRow) {
    loadFolderFiles(folderRow, page)
  }
}

function getFolderSearchKeyword(parentKey) {
  if (!parentKey) return ''
  return folderFileSearchMap.value[parentKey] || ''
}

function getFolderStatusFilter(parentKey) {
  if (!parentKey) return undefined
  return folderFileStatusMap.value[parentKey]
}

function handleFolderSearchChange(row, value) {
  const parentKey = row?.parent_key
  if (!parentKey) return
  folderFileSearchMap.value = {
    ...folderFileSearchMap.value,
    [parentKey]: value || ''
  }
  folderFilePageMap.value = {
    ...folderFilePageMap.value,
    [parentKey]: 1
  }
  const folderRow = flatRows.value.find((x) => String(x._row_key || x.id || x.key) === parentKey)
  if (folderRow) {
    loadFolderFiles(folderRow, 1)
  }
}

function handleFolderStatusChange(row, value) {
  const parentKey = row?.parent_key
  if (!parentKey) return
  const normalized = value === '' || value === null || value === undefined
    ? undefined
    : Number(value)
  folderFileStatusMap.value = {
    ...folderFileStatusMap.value,
    [parentKey]: normalized
  }
  folderFilePageMap.value = {
    ...folderFilePageMap.value,
    [parentKey]: 1
  }
  const folderRow = flatRows.value.find((x) => String(x._row_key || x.id || x.key) === parentKey)
  if (folderRow) {
    loadFolderFiles(folderRow, 1)
  }
}

async function loadFolderFiles(row, page = 1) {
  if (!props.fetchFolderFiles || row?.node_type !== 'folder_item') return
  const rowKey = String(row._row_key || row.id || row.key)
  const folderId = row.folder_id || row.key
  const taskUuid = row.task_uuid
  if (!rowKey || !folderId || !taskUuid) return
  const keyword = getFolderSearchKeyword(rowKey)
  const processingStatus = getFolderStatusFilter(rowKey)
  folderRemoteDataMap.value = {
    ...folderRemoteDataMap.value,
    [rowKey]: {
      ...(folderRemoteDataMap.value[rowKey] || {}),
      loading: true,
      page,
    }
  }
  try {
    const resp = await props.fetchFolderFiles({
      taskUuid,
      folderId,
      page,
      size: props.folderFilePageSize,
      keyword,
      processingStatus
    })
    folderRemoteDataMap.value = {
      ...folderRemoteDataMap.value,
      [rowKey]: {
        items: Array.isArray(resp?.items) ? resp.items : [],
        total: Number(resp?.total || 0),
        page: Number(resp?.page || page),
        loaded: true,
        loading: false,
      }
    }
  } catch {
    folderRemoteDataMap.value = {
      ...folderRemoteDataMap.value,
      [rowKey]: {
        ...(folderRemoteDataMap.value[rowKey] || {}),
        items: [],
        total: 0,
        loaded: true,
        loading: false,
      }
    }
  }
}
</script>

<style scoped>
.task-runtime-progress-tree {
  font-size: 13px;
  flex: 1;
  overflow-y: auto;
  max-height: calc(80vh - 120px);
  min-height: 0;
}

.trpt-row {
  display: flex;
  align-items: center;
  padding: 6px 8px 6px 0;
  border-radius: 4px;
  margin-bottom: 4px;
  background: #fff;
  border: 1px solid #ebeef5;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.trpt-row > * + * {
  margin-left: 8px;
}

.trpt-toggle {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.trpt-toggle--placeholder {
  cursor: default;
}

.trpt-toggle--expanded {
  transform: rotate(90deg);
}

.trpt-icon {
  flex-shrink: 0;
}

.trpt-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.trpt-type-icon {
  color: #e6a23c;
  flex-shrink: 0;
}

.trpt-meta {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}

.trpt-status {
  flex-shrink: 0;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
}

.trpt-icon.trpt-st-wait {
  color: #909399;
}

.trpt-icon.trpt-st-running {
  color: #409eff;
}

.trpt-icon.trpt-st-done {
  color: #67c23a;
}

.trpt-icon.trpt-st-fail {
  color: #f56c6c;
}

.trpt-row--wait {
  background: #f4f4f5;
  border-color: #e4e7ed;
}

.trpt-row--running {
  border-color: rgba(64, 158, 255, 0.35);
  /* 底色保持浅蓝；高光带两端透明，避免动画循环时左右边缘发深 */
  background-color: rgba(64, 158, 255, 0.06);
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(64, 158, 255, 0.14) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: trpt-shimmer 1.6s ease-in-out infinite;
}

.trpt-row--done {
  background: linear-gradient(
    90deg,
    rgba(103, 194, 58, 0.10) 0%,
    rgba(103, 194, 58, 0.22) 50%,
    rgba(103, 194, 58, 0.10) 100%
  );
  border-color: rgba(103, 194, 58, 0.35);
}

.trpt-row--failed {
  background: linear-gradient(
    90deg,
    rgba(245, 108, 108, 0.10) 0%,
    rgba(245, 108, 108, 0.24) 50%,
    rgba(245, 108, 108, 0.10) 100%
  );
  border-color: rgba(245, 108, 108, 0.35);
}

.trpt-row--folder-item {
  border-left: 3px solid #e6a23c;
}

.trpt-row--file-item {
  background: #f7f8fa;
  border: 1px solid #e9edf3;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
}

.trpt-row--pager {
  background: #fff;
  border: 1px dashed #dcdfe6;
}

.trpt-pager-search {
  width: 220px;
}

.trpt-pager-status {
  width: 128px;
}

.trpt-pager-text {
  font-size: 12px;
  color: #606266;
}

.trpt-badge--wait {
  color: #909399;
  border-color: #e4e7ed;
}

.trpt-badge--running {
  color: #409eff;
  border-color: rgba(64, 158, 255, 0.35);
}

.trpt-badge--done {
  color: #67c23a;
  border-color: rgba(103, 194, 58, 0.35);
}

.trpt-badge--failed {
  color: #f56c6c;
  border-color: rgba(245, 108, 108, 0.35);
}

.trpt-inline-loading {
  color: #409eff;
  flex-shrink: 0;
}

.trpt-inline-loading-text {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}

@keyframes trpt-shimmer {
  0% {
    background-position: 150% 0;
  }
  100% {
    background-position: -50% 0;
  }
}
</style>
