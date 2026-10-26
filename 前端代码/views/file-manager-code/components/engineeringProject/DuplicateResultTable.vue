<template>
  <Teleport to="body" :disabled="!isFullscreen">
    <div class="result-table-container" :class="{ 'is-fullscreen': isFullscreen }">
      <div class="action-bar sd-toolbar-row sd-toolbar-row--medium">
        <el-button type="primary" plain :icon="FullScreen" size="small" @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
        <span v-if="threshold != null" class="threshold-hint">判定阈值：{{ threshold }}</span>
      </div>

      <div class="table-wrapper">
        <div class="section-title" v-if="!hideSectionTitle">重复项目</div>
        <el-collapse v-model="activeNames" class="result-collapse">
          <el-collapse-item name="model">
            <template #title>
              <div class="collapse-title">
                <span class="title-text">通过模型匹配（含得分及原因）</span>
                <el-tag type="info" size="small">{{ groupCount }} 组</el-tag>
              </div>
            </template>
            <el-table
              :data="rows"
              border
              stripe
              class="sd-table--clean"
              style="width: 100%"
              :height="tableHeight"
              :span-method="spanMethod"
              :row-class-name="rowClassName"
              empty-text="未发现重复项目"
            >
              <el-table-column prop="序号" label="序号" width="70" align="center" />
              <el-table-column prop="文件名称" label="文件名称" width="120" show-overflow-tooltip />
              <el-table-column prop="重复项目" label="重复项目" width="90" align="center" />
              <el-table-column prop="项目关系" label="项目关系" width="100" align="center" />
              <el-table-column
                v-for="col in businessColumns"
                :key="col.prop"
                :prop="col.prop"
                :label="col.label"
                :min-width="col.minWidth"
                :width="col.width"
                :align="col.align"
                show-overflow-tooltip
              />
              <el-table-column prop="加权和" label="加权和" width="90" align="center" />
              <el-table-column prop="原因" label="原因" min-width="220" show-overflow-tooltip />
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { FullScreen } from '@element-plus/icons-vue'
import { useResultTableFullscreen } from './useResultTableFullscreen.js'
import {
  DEFAULT_DUPLICATE_FIELD_WEIGHTS,
  columnLabelWithWeight,
  fieldKeyToDisplayLabel,
  fieldKeyToRowProp,
  getScoredFieldKeys
} from './engineeringProjectConstants.js'

import { buildDuplicateColumnSchema } from './engineeringProjectColumnSchema.js'

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  fieldWeights: {
    type: Object,
    default: null
  },
  fieldLabels: {
    type: Object,
    default: null
  },
  roleFields: {
    type: Object,
    default: null
  },
  sourceColumns: {
    type: Array,
    default: () => []
  },
  columnSchema: {
    type: Array,
    default: null
  },
  threshold: {
    type: [Number, String],
    default: null
  },
  hideSectionTitle: {
    type: Boolean,
    default: false
  }
})

const { isFullscreen, tableHeight, toggleFullscreen } = useResultTableFullscreen()
const activeNames = ref(['model'])

const effectiveWeights = computed(
  () => props.fieldWeights || DEFAULT_DUPLICATE_FIELD_WEIGHTS
)

const businessColumns = computed(() => {
  if (props.columnSchema?.length) {
    return props.columnSchema.filter((c) => !c.meta)
  }
  const schema = buildDuplicateColumnSchema({
    fieldWeights: effectiveWeights.value,
    fieldLabels: props.fieldLabels,
    roleFields: props.roleFields,
    sourceColumns: props.sourceColumns,
    rows: props.rows,
    useDefaultTemplate: !props.sourceColumns?.length
  })
  return schema.filter((c) => !c.meta)
})

const groupCount = computed(() => {
  const keys = new Set()
  for (const row of props.rows || []) {
    if (row._groupKey != null) keys.add(row._groupKey)
  }
  return keys.size
})

const mergeColumns = new Set(['序号', '原因'])

const spanMethod = ({ row, column, rowIndex }) => {
  const prop = column.property
  if (!mergeColumns.has(prop)) {
    return { rowspan: 1, colspan: 1 }
  }

  const tableData = props.rows || []
  if (rowIndex > 0 && row._groupKey === tableData[rowIndex - 1]._groupKey) {
    return { rowspan: 0, colspan: 0 }
  }

  let rowspan = 1
  for (let i = rowIndex + 1; i < tableData.length; i++) {
    if (tableData[i]._groupKey === row._groupKey) rowspan++
    else break
  }
  return { rowspan, colspan: 1 }
}

const rowClassName = ({ row }) => {
  return row._rowType === 'data' ? '' : 'meta-row'
}
</script>

<style scoped>
.result-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.result-table-container.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 5000;
  width: 100vw;
  height: 100vh;
  background: #fff;
  padding: 20px;
  box-sizing: border-box;
}

.action-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
}

.action-bar > * + * {
  margin-left: 12px;
}

.threshold-hint {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 0 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.result-collapse {
  border: none;
}

.result-collapse :deep(.el-collapse-item) {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.result-collapse :deep(.el-collapse-item__header) {
  background: var(--sd-surface-1, #f4f4f4);
  padding: 0 16px;
  height: 46px;
  border: none;
}

.result-collapse :deep(.el-collapse-item__content) {
  padding: 8px 0;
}

.collapse-title {
  display: flex;
  align-items: center;
}

.collapse-title > * + * {
  margin-left: 10px;
}

.title-text {
  font-weight: 600;
  color: #303133;
}

.table-wrapper :deep(.el-table th) {
  background: #f5f7fa !important;
  font-weight: 600;
}

.table-wrapper :deep(.meta-row) {
  background: #fafafa;
}
</style>
