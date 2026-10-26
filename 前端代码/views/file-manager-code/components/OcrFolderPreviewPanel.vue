<template>
  <div class="folder-list-preview">
    <div class="folder-list-header">
      <div class="folder-list-header-row">
        <el-button
          v-if="showBackButton"
          link
          type="primary"
          :icon="ArrowLeft"
          class="folder-list-back-btn"
          @click="handleBackClick"
        >
          {{ backButtonText }}
        </el-button>
        <div class="folder-list-title-wrap">
          <el-icon class="folder-icon"><Folder /></el-icon>
          <span class="folder-list-title">{{ folderName || '文件夹' }}</span>
          <span class="folder-list-count">共 {{ displayTotal }} 个文件</span>
        </div>
      </div>
      <div class="folder-list-delete-hint">
        已记录待删除：文件 {{ deletedFileCount }}，文件夹 {{ deletedFolderCount }}
      </div>
    </div>

    <div class="folder-list-content" v-loading="loading">
    <div v-if="!readonly && files.length > 0" class="folder-list-toolbar">
      <el-checkbox
        :model-value="isAllSelected"
        :indeterminate="isIndeterminate"
        @change="handleSelectAllChange"
      >
        全选
      </el-checkbox>
      <el-button
        size="small"
        type="danger"
        plain
        :disabled="selectedFileIds.length === 0"
        @click="handleDeleteSelected"
      >
        删除勾选文件（前端）
      </el-button>
    </div>
    <el-empty
      v-if="files.length === 0"
      description="当前文件夹暂无文件"
      :image-size="80"
    />
    <template v-else>
      <div class="folder-list-table-wrap">
        <el-auto-resizer>
          <template #default="{ height, width }">
            <el-table-v2
              class="folder-preview-table-v2"
              :columns="effectiveColumns"
              :data="files"
              :width="width"
              :height="height"
              :row-height="44"
              fixed
            />
          </template>
        </el-auto-resizer>
      </div>
      <div v-if="isRemote && total > pageSize" class="folder-list-pagination">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          @current-change="(page) => emit('page-change', page)"
        />
      </div>
    </template>
    </div>
  </div>
</template>

<script setup>
import { computed, h, ref, watch } from 'vue'
import { ElButton, ElCheckbox, ElTooltip } from 'element-plus'
import { Folder, ArrowLeft } from '@element-plus/icons-vue'

const props = defineProps({
  folderName: { type: String, default: '' },
  displayTotal: { type: Number, default: 0 },
  deletedFileCount: { type: Number, default: 0 },
  deletedFolderCount: { type: Number, default: 0 },
  files: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  isRemote: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 100 },
  currentPage: { type: Number, default: 1 },
  pendingDeleteFileIds: { type: Array, default: () => [] },
  /** 是否只读预览模式（true 时隐藏勾选/删除，操作列仅保留“查看”） */
  readonly: { type: Boolean, default: false },
  /** 是否显示返回按钮 */
  showBackButton: { type: Boolean, default: false },
  /** 返回按钮文案 */
  backButtonText: { type: String, default: '返回' }
})

const emit = defineEmits(['delete-selected', 'restore-file', 'view-file', 'view-attachments', 'page-change', 'back'])

/**
 * 点击返回按钮
 * @returns {void}
 */
const handleBackClick = () => {
  emit('back')
}

const selectedFileIds = ref([])

const pendingSet = computed(() => new Set((props.pendingDeleteFileIds || []).map((id) => String(id))))

watch(
  () => props.files,
  (rows) => {
    const visibleIdSet = new Set((rows || []).map((row) => String(row.fileId || '')))
    selectedFileIds.value = selectedFileIds.value.filter((id) => visibleIdSet.has(id))
  },
  { deep: true }
)

watch(
  () => props.pendingDeleteFileIds,
  (ids) => {
    const deletedSet = new Set((ids || []).map((id) => String(id)))
    selectedFileIds.value = selectedFileIds.value.filter((id) => !deletedSet.has(id))
  },
  { deep: true }
)

const isAllSelected = computed(() => {
  if (!props.files || props.files.length === 0) return false
  const selectableIds = props.files
    .filter((row) => !pendingSet.value.has(String(row.fileId || '')))
    .map((row) => String(row.fileId || ''))
  if (selectableIds.length === 0) return false
  return selectableIds.every((id) => selectedFileIds.value.includes(id))
})

const isIndeterminate = computed(() => {
  if (!props.files || props.files.length === 0) return false
  const selectableIds = props.files
    .filter((row) => !pendingSet.value.has(String(row.fileId || '')))
    .map((row) => String(row.fileId || ''))
  const selectedCount = selectableIds.filter((id) => selectedFileIds.value.includes(id)).length
  return selectedCount > 0 && selectedCount < selectableIds.length
})

/**
 * 处理单行勾选
 * @param {Object} rowData 行对象
 * @param {boolean} checked 勾选状态
 */
const handleSelectRow = (rowData, checked) => {
  const targetId = String((rowData && rowData.fileId) || '')
  if (!targetId || pendingSet.value.has(targetId)) {
    return
  }
  if (checked) {
    if (!selectedFileIds.value.includes(targetId)) {
      selectedFileIds.value.push(targetId)
    }
  } else {
    selectedFileIds.value = selectedFileIds.value.filter((id) => id !== targetId)
  }
}

/**
 * 处理全选切换
 * @param {boolean} checked 全选状态
 */
const handleSelectAllChange = (checked) => {
  if (checked) {
    selectedFileIds.value = (props.files || [])
      .filter((row) => !pendingSet.value.has(String(row.fileId || '')))
      .map((row) => String(row.fileId || ''))
  } else {
    selectedFileIds.value = []
  }
}

const handleDeleteSelected = () => {
  if (props.readonly) {
    return
  }
  emit('delete-selected', [...selectedFileIds.value])
}

/**
 * 单行省略样式（cellRenderer 内联，避免 scoped 样式无法作用于 h() 节点）
 * @returns {Object} CSS 样式对象
 */
const getEllipsisInlineStyle = () => ({
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box'
})

/**
 * 渲染带省略与 tooltip 的文本单元格（等效 el-table-column show-overflow-tooltip）
 * @param {string} text 单元格文本
 * @param {string} textClass 文本节点 class
 * @returns {VNode} 单元格节点
 */
const renderOverflowTooltipCell = (text, textClass) => {
  const content = String(text || '')
  return h(
    'div',
    {
      class: 'folder-overflow-cell',
      style: {
        width: '100%',
        minWidth: 0,
        overflow: 'hidden'
      }
    },
    h(
      ElTooltip,
      {
        content,
        placement: 'top',
        showAfter: 300,
        disabled: !content
      },
      {
        default: () => h('span', { class: textClass, style: getEllipsisInlineStyle() }, content)
      }
    )
  )
}

/**
 * 渲染文件名列
 * @param {Object} cellData 单元格上下文对象，包含 rowData 行数据
 * @returns {VNode} 文件名单元格节点
 */
const renderFolderFileNameCell = ({ rowData }) => {
  return renderOverflowTooltipCell(rowData?.name, 'folder-file-name')
}

/**
 * 渲染表头全选框
 * @param {void} _ 占位参数，无实际意义
 * @returns {VNode} 表头勾选框节点
 */
const renderFolderSelectionHeaderCell = () => {
  return h(ElCheckbox, {
    modelValue: isAllSelected.value,
    indeterminate: isIndeterminate.value,
    onChange: handleSelectAllChange
  })
}

/**
 * 渲染行勾选框
 * @param {Object} cellData 单元格上下文对象，包含 rowData 行数据
 * @returns {VNode} 行勾选框节点
 */
const renderFolderSelectionCell = ({ rowData }) => {
  const targetId = String((rowData && rowData.fileId) || '')
  const disabled = pendingSet.value.has(targetId)
  return h(ElCheckbox, {
    disabled,
    modelValue: selectedFileIds.value.includes(targetId),
    onChange: (checked) => handleSelectRow(rowData, checked)
  })
}

/**
 * 渲染操作列（附件/恢复/查看）
 * @param {Object} cellData 单元格上下文对象，包含 rowData 行数据
 * @returns {VNode} 操作列节点
 */
const renderFolderActionCell = ({ rowData }) => {
  const canRestore = pendingSet.value.has(String((rowData && rowData.fileId) || ''))
  const attachmentCount = Number(rowData.attachmentCount || 0)
  const attachmentLabel = attachmentCount > 0 ? `附件(${attachmentCount})` : '附件'
  const attachmentTitle = attachmentCount > 0
    ? `附件 ${attachmentCount} 个，点击查看/管理`
    : '绑定附件'
  if (props.readonly) {
    return h('div', { class: 'folder-action-cell' }, [
      h(
        ElButton,
        {
          size: 'small',
          type: 'primary',
          text: true,
          title: attachmentTitle,
          onClick: () => emit('view-attachments', rowData)
        },
        () => attachmentLabel
      ),
      h(
        ElButton,
        {
          size: 'small',
          type: 'primary',
          text: true,
          onClick: () => emit('view-file', rowData)
        },
        () => '查看'
      )
    ])
  }
  return h('div', { class: 'folder-action-cell' }, [
    h(
      ElButton,
      {
        size: 'small',
        type: 'primary',
        text: true,
        title: attachmentTitle,
        onClick: () => emit('view-attachments', rowData)
      },
      () => attachmentLabel
    ),
    h(
      ElButton,
      {
        size: 'small',
        type: 'success',
        text: true,
        disabled: !canRestore,
        onClick: () => emit('restore-file', rowData)
      },
      () => '恢复'
    ),
    h(
      ElButton,
      {
        size: 'small',
        type: 'primary',
        text: true,
        onClick: () => emit('view-file', rowData)
      },
      () => '查看'
    )
  ])
}

const columns = computed(() => ([
  {
    key: 'name',
    dataKey: 'name',
    title: '文件名',
    width: 460,
    cellRenderer: renderFolderFileNameCell
  },
  {
    key: 'type',
    dataKey: 'type',
    title: '类型',
    width: 120,
    cellRenderer: ({ rowData }) => renderOverflowTooltipCell(rowData?.typeLabel || rowData?.type, 'folder-type-text')
  },
  {
    key: 'folderPath',
    dataKey: 'folderPath',
    title: '所在目录',
    width: 420,
    cellRenderer: ({ rowData }) => renderOverflowTooltipCell(rowData?.folderPath, 'folder-path-text')
  },
  {
    key: 'actions',
    dataKey: 'actions',
    title: '操作',
    width: 240,
    cellRenderer: renderFolderActionCell
  }
]))

/**
 * 根据只读模式动态裁剪表格列
 * @param {void} _ 占位参数，无实际意义
 * @returns {Array} 最终渲染列数组
 */
const effectiveColumns = computed(() => {
  if (props.readonly) {
    return columns.value
  }
  return [{
    key: 'selection',
    dataKey: 'selection',
    title: '',
    width: 58,
    headerCellRenderer: renderFolderSelectionHeaderCell,
    cellRenderer: renderFolderSelectionCell
  }, ...columns.value]
})
</script>

<style scoped>
.folder-list-preview {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.folder-list-header {
  padding: 10px 12px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
  flex-shrink: 0;
}

.folder-list-header-row {
  display: flex;
  align-items: center;
}

.folder-list-back-btn + .folder-list-title-wrap {
  margin-left: 8px;
}

.folder-list-title-wrap {
  display: flex;
  align-items: center;
}

.folder-icon {
  margin-right: 6px;
  font-size: 16px;
  color: #409eff;
}

.folder-list-title {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.folder-list-count {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.folder-list-delete-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.folder-list-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.folder-list-table-wrap {
  flex: 1;
  min-height: 0;
}

.folder-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.folder-list-pagination {
  margin-top: 10px;
  text-align: right;
}

.folder-file-name-cell {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.folder-attachment-badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 8px;
  padding: 0 6px;
  height: 20px;
  border-radius: 10px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 12px;
}

.folder-action-cell {
  display: flex;
  align-items: center;
}

.folder-action-cell > * + * {
  margin-left: 8px;
}
</style>

<!-- el-table-v2 单元格由 render 函数生成，须非 scoped 才能强制单行省略 -->
<style lang="scss">
.folder-list-table-wrap .folder-preview-table-v2 .el-table-v2__row-cell {
  overflow: hidden !important;
  align-items: center;
}

.folder-list-table-wrap .folder-overflow-cell {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.folder-list-table-wrap .folder-overflow-cell .el-tooltip__trigger {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-list-table-wrap .folder-file-name,
.folder-list-table-wrap .folder-path-text,
.folder-list-table-wrap .folder-type-text {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
