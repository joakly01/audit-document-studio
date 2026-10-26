<template>
  <el-table
    :data="rows"
    border
    stripe
    class="sd-table--clean"
    style="width: 100%"
    :height="height"
    :span-method="spanMethod"
    :row-class-name="rowClassName"
  >
    <el-table-column prop="序号" label="序号" width="70" align="center" />
    <el-table-column prop="文件名称" label="文件名称" width="120" show-overflow-tooltip />
    <el-table-column prop="主子项目" label="主子项目" width="90" align="center" />
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
</template>

<script setup>
import { computed } from 'vue'
import {
  DEFAULT_PARENT_CHILD_FIELD_WEIGHTS
} from './engineeringProjectConstants.js'
import { buildParentChildColumnSchema } from './engineeringProjectColumnSchema.js'

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  height: {
    type: [Number, String],
    default: undefined
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
  }
})

const effectiveWeights = computed(
  () => props.fieldWeights || DEFAULT_PARENT_CHILD_FIELD_WEIGHTS
)

const businessColumns = computed(() => {
  if (props.columnSchema?.length) {
    return props.columnSchema.filter((c) => !c.meta)
  }
  const schema = buildParentChildColumnSchema({
    fieldWeights: effectiveWeights.value,
    fieldLabels: props.fieldLabels,
    roleFields: props.roleFields,
    sourceColumns: props.sourceColumns,
    rows: props.rows,
    useDefaultTemplate: !props.sourceColumns?.length
  })
  return schema.filter((c) => !c.meta)
})

const spanMethod = ({ row, column, rowIndex }) => {
  if (column.property !== '序号') {
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
  if (row._rowType === 'weight' || row._rowType === 'score') return 'meta-row'
  return ''
}
</script>

<style scoped>
:deep(.el-table th) {
  background: #f5f7fa !important;
  font-weight: 600;
}

:deep(.meta-row) {
  background: #f5f7fa;
  color: #606266;
  font-style: italic;
}
</style>
