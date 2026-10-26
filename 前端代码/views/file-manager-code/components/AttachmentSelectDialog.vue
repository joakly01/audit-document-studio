<template>
  <el-dialog
    :model-value="visible"
    title="选择附件"
    width="640px"
    :close-on-click-modal="false"
    class="attachment-select-dialog"
    @update:model-value="(val) => $emit('update:visible', val)"
    @closed="handleDialogClosed"
  >
    <div class="attachment-select-hint">
      仅可从已选文件或当前文件夹预览列表中选择作为附件
    </div>

    <div class="attachment-select-toolbar">
      <div class="sd-search-box attachment-select-search">
        <el-icon class="sd-search-icon"><Search /></el-icon>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索文件名"
          class="sd-search-input"
        />
      </div>
      <span class="attachment-select-count">
        已选 {{ selectedFiles.length }} / {{ filteredFiles.length }}
      </span>
    </div>

    <div class="attachment-select-table-wrap">
      <el-table
        ref="tableRef"
        :data="filteredFiles"
        height="360"
        class="sd-table--clean attachment-select-table"
        empty-text="暂无可选文件"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
      >
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column label="文件名" min-width="320">
          <template #default="{ row }">
            <div class="attachment-select-name-cell">
              <el-icon class="attachment-select-file-icon"><Document /></el-icon>
              <el-tooltip :content="row.name" placement="top" :show-after="400">
                <span class="attachment-select-name-text">{{ row.name }}</span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <div class="attachment-select-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :disabled="selectedFiles.length === 0"
          @click="handleConfirm"
        >
          确定{{ selectedFiles.length > 0 ? `（${selectedFiles.length}）` : '' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Search } from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  availableFiles: {
    type: Array,
    default: () => []
  },
  excludeFileIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:visible', 'confirm'])

const tableRef = ref(null)
const selectedFiles = ref([])
const searchKeyword = ref('')

const excludeSet = computed(() => new Set(props.excludeFileIds || []))

/**
 * 可选附件列表（排除已绑定与主文件）
 * @returns {Array<Object>} 候选文件
 */
const baseFiles = computed(() => {
  return (props.availableFiles || []).filter((file) => {
    const fileId = file && file.file_id
    return fileId && !excludeSet.value.has(fileId)
  })
})

/**
 * 按关键字过滤后的候选文件
 * @returns {Array<Object>} 过滤结果
 */
const filteredFiles = computed(() => {
  const keyword = String(searchKeyword.value || '').trim().toLowerCase()
  if (!keyword) {
    return baseFiles.value
  }
  return baseFiles.value.filter((file) => {
    const name = String(file.name || '').toLowerCase()
    return name.includes(keyword)
  })
})

/**
 * 表格勾选变化
 * @param {Array<Object>} selection 当前选中行
 * @returns {void}
 */
const handleSelectionChange = (selection) => {
  selectedFiles.value = Array.isArray(selection) ? selection : []
}

/**
 * 点击行切换勾选（提升交互效率）
 * @param {Object} row 行数据
 * @returns {void}
 */
const handleRowClick = (row) => {
  if (!tableRef.value || !row) {
    return
  }
  tableRef.value.toggleRowSelection(row)
}

/**
 * 确认选择附件
 * @returns {void}
 */
const handleConfirm = () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请至少选择一个文件')
    return
  }
  emit('confirm', selectedFiles.value)
  emit('update:visible', false)
}

/**
 * 关闭弹窗
 * @returns {void}
 */
const handleClose = () => {
  emit('update:visible', false)
}

/**
 * 弹窗关闭后重置状态
 * @returns {void}
 */
const handleDialogClosed = () => {
  searchKeyword.value = ''
  selectedFiles.value = []
  if (tableRef.value) {
    tableRef.value.clearSelection()
  }
}

watch(() => props.visible, async (val) => {
  if (!val) {
    return
  }
  searchKeyword.value = ''
  selectedFiles.value = []
  await nextTick()
  if (tableRef.value) {
    tableRef.value.clearSelection()
  }
})
</script>

<style scoped>
.attachment-select-hint {
  margin-bottom: 12px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #909399;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  box-sizing: border-box;
}

.attachment-select-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.attachment-select-search {
  flex: 1;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 0 10px 0 32px;
  box-sizing: border-box;
}

.attachment-select-search .sd-search-icon {
  left: 10px;
  margin-top: -7px;
  font-size: 14px;
}

.attachment-select-search .sd-search-input {
  height: 30px;
  line-height: 30px;
  font-size: 14px;
}

.attachment-select-count {
  flex-shrink: 0;
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.attachment-select-table-wrap {
  width: 100%;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  box-sizing: border-box;
}

.attachment-select-name-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.attachment-select-name-cell > * + * {
  margin-left: 8px;
}

.attachment-select-file-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--sd-ink-subtle, #8c8c8c);
}

.attachment-select-name-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 13px;
  color: #303133;
}

.attachment-select-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.attachment-select-footer > * + * {
  margin-left: 8px;
}

.attachment-select-table :deep(.el-table__row) {
  cursor: pointer;
}
</style>
