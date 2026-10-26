<template>
  <div class="prepaid-left-sidebar">
    <div class="file-header ocr-column-head file-header--compact">
      <div class="file-header-toolbar">
        <div class="sd-search-box ocr-file-search">
          <el-icon class="sd-search-icon"><component :is="bindings.icons.Search" /></el-icon>
          <input
            :value="bindings.searchKeyword.value"
            type="text"
            placeholder="搜索文件"
            class="sd-search-input"
            @input="handleSearchInput"
          />
        </div>
        <el-tooltip
          :content="bindings.showFilePreview.value ? '隐藏文件预览' : '显示文件预览'"
          placement="bottom"
        >
          <el-button
            :icon="bindings.showFilePreview.value ? bindings.icons.Hide : bindings.icons.View"
            circle
            size="small"
            class="file-preview-toggle-btn"
            @click="bindings.showFilePreview.value = !bindings.showFilePreview.value"
          />
        </el-tooltip>
      </div>
    </div>

    <div class="file-section">
      <div
        v-if="!readonly && displayTreeData.length > 0"
        class="batch-actions-bar"
      >
        <div class="batch-actions-row">
          <el-checkbox
            v-model="bindings.isAllSelected.value"
            @change="bindings.handleSelectAll"
            :indeterminate="bindings.isIndeterminate.value"
          >
            全选
          </el-checkbox>
          <span v-if="bindings.selectedFiles.value.length > 0" class="selected-count">
            已选择 {{ bindings.selectedFiles.value.length }} 个文件
          </span>
        </div>
      </div>

      <div class="file-list">
        <el-auto-resizer v-if="displayTreeData.length > 0">
          <template #default="{ height }">
            <el-tree-v2
              ref="treeRef"
              :key="treeRenderKey"
              :data="displayTreeData"
              :props="bindings.fileTreeProps"
              :height="height"
              :item-size="34"
              :default-expanded-keys="expandedKeys"
            >
              <template #default="{ data }">
                <div
                  :class="[
                    'file-tree-node',
                    { active: data.nodeType === 'file' && bindings.isFileActive(data.sourceFile) }
                  ]"
                  @click="handleTreeNodeClick(data, $event)"
                >
                  <el-checkbox
                    v-if="!readonly && data.nodeType === 'folder'"
                    :model-value="bindings.isFolderChecked(data)"
                    @change="(checked) => bindings.handleFolderCheckChange(data, checked)"
                    @click.stop
                  />
                  <el-checkbox
                    v-if="!readonly && data.nodeType === 'file'"
                    :model-value="bindings.isFileSelected(data.sourceFile)"
                    :disabled="bindings.isFilePendingDelete(data.sourceFile)"
                    @change="(checked) => bindings.handleFileSelect(data.sourceFile, checked)"
                    @click.stop
                  />
                  <el-icon v-if="data.nodeType === 'file'" class="file-icon">
                    <component :is="bindings.icons.Document" />
                  </el-icon>
                  <el-icon v-else class="folder-icon">
                    <component :is="bindings.icons.Folder" />
                  </el-icon>
                  <el-tooltip :content="data.name" placement="top">
                    <span class="file-name">{{ bindings.getTreeNodeDisplayName(data.name) }}</span>
                  </el-tooltip>
                  <el-button
                    v-if="!readonly && data.nodeType === 'file'"
                    type="danger"
                    :icon="bindings.icons.Delete"
                    size="small"
                    text
                    @click.stop="bindings.handleDeleteFile(data.sourceFile)"
                    class="tree-node-delete-btn"
                    title="删除文件"
                  />
                  <el-button
                    v-if="!readonly && data.nodeType === 'folder'"
                    type="danger"
                    :icon="bindings.icons.Delete"
                    size="small"
                    text
                    @click.stop="bindings.handleDeleteFolderNode(data)"
                    class="tree-node-delete-btn"
                    title="删除文件夹"
                  />
                </div>
              </template>
            </el-tree-v2>
          </template>
        </el-auto-resizer>
        <el-empty
          v-if="displayTreeData.length === 0"
          :description="emptyDescription"
          :image-size="60"
          style="padding: 20px 0;"
        />
      </div>

      <div
        v-if="!readonly && bindings.checkedFolderPaths && bindings.checkedFolderPaths.value.length > 0"
        class="folder-selection-bar"
      >
        <span class="selected-count">已勾选 {{ bindings.checkedFolderPaths.value.length }} 个文件夹</span>
        <el-button
          size="small"
          type="danger"
          plain
          @click="bindings.handleDeleteCheckedFolders()"
          class="folder-delete-btn"
        >
          删除勾选文件夹（前端）
        </el-button>
      </div>
    </div>

    <div v-if="!readonly" class="file-actions-bottom ocr-sidebar-footer">
      <div class="file-actions-row">
        <el-button class="ocr-select-files-btn ocr-footer-btn" @click="bindings.handleSelectFile()">
          选择文件
        </el-button>
        <slot name="footer" />
      </div>
    </div>

    <FileSelectDialog
      v-if="!readonly"
      v-model="bindings.fileSelectDialogVisible.value"
      :return-object="true"
      :initial-selected-folders="bindings.fileSelectInitialFolders.value"
      :initial-selected-files="bindings.fileSelectInitialFiles.value"
      :allow-unparsed="fileSelectAllowUnparsed"
      :can-select-file-type="fileSelectCanSelectFileType"
      :show-parse-status="fileSelectShowParseStatus"
      @confirm="handleFileSelectConfirm"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import FileSelectDialog from '@/components/common/FileSelectDialog.vue'

defineOptions({ name: 'PrepaidExpensesLeftSidebar' })

const props = defineProps({
  bindings: {
    type: Object,
    required: true
  },
  readonly: {
    type: Boolean,
    default: false
  },
  emptyDescription: {
    type: String,
    default: '暂无文件，请点击「选择文件」添加'
  },
  /** 点击文件夹时懒加载子文件（由页面注入） */
  onFolderExpand: {
    type: Function,
    default: null
  }
})

const treeRef = ref(null)
const expandedKeys = ref([])

const treeRenderKey = computed(() => props.bindings?.fileTreeRenderKey?.value ?? 0)

const displayTreeData = computed(() => props.bindings?.fileTreeData?.value || [])

const fileSelectAllowUnparsed = computed(() => {
  const fromBinding = props.bindings?.allowUnparsed
  if (fromBinding && typeof fromBinding.value !== 'undefined') {
    return !!fromBinding.value
  }
  return false
})

const fileSelectShowParseStatus = computed(() => {
  const fromBinding = props.bindings?.showParseStatus
  if (fromBinding && typeof fromBinding.value !== 'undefined') {
    return !!fromBinding.value
  }
  return true
})

const fileSelectCanSelectFileType = computed(() => {
  const fromBinding = props.bindings?.canSelectFileType
  if (fromBinding && Array.isArray(fromBinding.value)) {
    return fromBinding.value
  }
  return []
})

/**
 * 搜索框输入同步到 bindings
 * @param {Event} event 输入事件
 * @returns {void}
 */
function handleSearchInput(event) {
  const keyword = event?.target?.value ?? ''
  if (props.bindings?.searchKeyword) {
    props.bindings.searchKeyword.value = keyword
  }
}

/**
 * 同步树展开状态
 * @param {Array<string>} keys 展开节点 key 列表
 * @returns {Promise<void>}
 */
async function syncExpandedKeys(keys) {
  expandedKeys.value = keys
  await nextTick()
  treeRef.value?.setExpandedKeys?.(keys)
}

/**
 * 文件选择弹窗确认
 * @param {Array|Object} payload 选择结果
 * @returns {Promise<void>}
 */
async function handleFileSelectConfirm(payload) {
  const handler = props.bindings?.onFileSelectConfirm
  if (typeof handler === 'function') {
    await handler(payload)
  }
  await syncExpandedKeys([])
}

/**
 * 树节点点击：文件夹在左侧展开/收起并懒加载；文件交由页面预览
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} event 点击事件
 * @returns {Promise<void>}
 */
async function handleTreeNodeClick(treeNode, event) {
  if (!treeNode) return

  if (treeNode.nodeType === 'folder') {
    const wasExpanded = expandedKeys.value.includes(treeNode.treeKey)
    if (!wasExpanded && typeof props.onFolderExpand === 'function') {
      await props.onFolderExpand(treeNode)
      await nextTick()
    }

    const next = new Set(expandedKeys.value)
    if (wasExpanded) {
      next.delete(treeNode.treeKey)
    } else {
      next.add(treeNode.treeKey)
    }
    await syncExpandedKeys(Array.from(next))
    return
  }

  if (typeof props.bindings.handleTreeNodeClick === 'function') {
    props.bindings.handleTreeNodeClick(treeNode, event)
  }
}

watch(
  () => props.bindings.fileTreeRenderKey?.value,
  async () => {
    await syncExpandedKeys([])
  }
)
</script>

<style scoped>
.prepaid-left-sidebar {
  flex: 1;
  min-height: 0;
  width: 100%;
  background: var(--sd-canvas, #ffffff);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ocr-column-head {
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
}

.file-header {
  margin-bottom: 0;
}

.file-header--compact {
  justify-content: flex-start;
}

.file-header-toolbar {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.file-header-toolbar > * + * {
  margin-left: 8px;
}

.file-header-toolbar .ocr-file-search {
  flex: 1;
  min-width: 0;
}

.file-preview-toggle-btn {
  flex-shrink: 0;
}

.file-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
  min-height: 0;
}

.batch-actions-bar {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.batch-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-list {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.selected-count {
  font-size: 12px;
  color: #909399;
}

.file-tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  box-sizing: border-box;
}

.file-tree-node .el-checkbox {
  margin-right: 8px;
}

.file-tree-node.active {
  background: var(--sd-primary-light, #e8f0f8);
  color: var(--sd-primary, #195fb4);
}

.tree-node-delete-btn {
  margin-left: auto;
}

:deep(.el-tree-v2__row:hover) .file-tree-node {
  background: var(--sd-surface-1, #f4f4f4);
}

:deep(.el-tree-v2__node) {
  width: 100%;
}

.file-icon,
.folder-icon {
  margin-right: 8px;
  flex-shrink: 0;
}

.file-icon {
  color: var(--sd-primary, #195fb4);
}

.folder-icon {
  color: #e6a23c;
}

.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.folder-selection-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
}

.folder-selection-bar > * + * {
  margin-left: 8px;
}

.folder-delete-btn {
  flex-shrink: 0;
}

.ocr-sidebar-footer {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
}

.file-actions-bottom {
  width: 100%;
}

.file-actions-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.file-actions-row > * + * {
  margin-left: 8px;
}

.file-actions-row .ocr-footer-btn,
.file-actions-row :deep(.el-button) {
  flex: 1;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  box-sizing: border-box;
}

.ocr-select-files-btn {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--sd-primary, #195fb4);
  border: 1px solid var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
}

.ocr-select-files-btn:hover,
.ocr-select-files-btn:focus {
  color: var(--sd-primary-dark, #0f4a8c);
  border-color: var(--sd-primary-dark, #0f4a8c);
  background: var(--sd-primary-light, #e8f0f8);
}
</style>
