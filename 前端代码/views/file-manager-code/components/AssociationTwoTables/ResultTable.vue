<template>
  <div class="result-table-container" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="action-bar">
      <el-button
        type="primary"
        :icon="FullScreen"
        @click="toggleFullscreen"
        size="small"
      >
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </el-button>
      <el-dropdown trigger="hover" @command="handleExport">
        <el-button type="success" :icon="Download" size="small">
          导出
          <el-icon class="el-icon--right">
            <arrow-down />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="markdown">
              <el-icon><Document /></el-icon>
              导出为 Markdown
            </el-dropdown-item>
            <el-dropdown-item command="excel">
              <el-icon><Download /></el-icon>
              导出为 Excel
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-tag v-if="isFiltered" type="warning" size="small" class="filter-status-tag" effect="plain">
        已筛选
      </el-tag>
    </div>

    <div class="filter-prompt-bar">
      <el-input
        v-model="filterPrompt"
        type="textarea"
        :rows="2"
        resize="none"
        placeholder="请输入筛选提示词，例如：筛选组内两侧「2022年预算」差额大于 10 的配对（仅筛选一致/不完全一致，独有区保持不变）"
        class="filter-prompt-input"
        :disabled="filtering"
      />
      <div class="filter-prompt-actions">
        <el-button
          type="primary"
          size="small"
          :loading="filtering"
          :disabled="!canStartFilter"
          @click="runFilter"
        >
          {{ filtering ? '筛选中…' : '开始筛选' }}
        </el-button>
        <el-button
          type="info"
          size="small"
          :disabled="!isFiltered || filtering"
          @click="cancelFilter"
        >
          取消筛选
        </el-button>
      </div>
    </div>

    <div class="table-wrapper">
      <el-collapse v-model="activeNames" class="result-collapse">
        <el-collapse-item
          v-for="section in sectionDefs"
          :key="section.key"
          :name="section.key"
        >
          <template #title>
            <div class="collapse-title">
              <span class="title-text">{{ section.title }}</span>
              <el-tag :type="section.tagType" size="small">
                {{ sectionRows(section.key).length }} 条
              </el-tag>
            </div>
          </template>
          <el-table
            :data="sectionRows(section.key)"
            border
            stripe
            :span-method="(params) => spanMethod(params, section)"
            style="width: 100%"
          >
            <el-table-column
              v-if="section.showGroupSeqColumn"
              prop="组序号"
              label="组序号"
              width="80"
              align="center"
            />
            <el-table-column prop="序号" label="序号" width="80" align="center" />
            <el-table-column
              prop="文件名称"
              label="文件名称"
              width="180"
              show-overflow-tooltip
            />
            <el-table-column
              v-for="col in dynamicColumnsForSection(section.key)"
              :key="col"
              :prop="col"
              :label="col"
              min-width="160"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <div class="extracted-value-cell">{{ formatCellValue(row[col]) }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="section.showReasonColumn"
              prop="说明"
              label="说明"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isFiltered"
              prop="筛选原因"
              label="筛选原因"
              min-width="220"
              show-overflow-tooltip
            />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { FullScreen, Document, Download, ArrowDown } from '@element-plus/icons-vue'
import { exportFn, sanitizeExcelCellText } from '@/utils/excel/export.js'
import {
  buildColumnSchema,
  buildExportHeaders,
  formatCellValue
} from '@/utils/associationTwoTablesColumnSchema.js'
import { associationCompareAnalyzeAPI } from '@/api/task.js'

const props = defineProps({
  table1Label: {
    type: String,
    default: '文件一'
  },
  table2Label: {
    type: String,
    default: '文件二'
  },
  allResult: {
    type: Object,
    required: true,
    default: () => ({
      yz: [],
      bwqyz: [],
      ggdyxm: [],
      tzxmzxsp: []
    })
  },
  columnSchema: {
    type: Object,
    default: null
  },
  /** 任务 UUID；无任务时无法调用二次筛选 */
  taskId: {
    type: String,
    default: ''
  }
})

const isFullscreen = ref(false)
const activeNames = ref(['yz', 'bwqyz', 'ggdyxm', 'tzxmzxsp'])
const filterPrompt = ref('')
const filtering = ref(false)
/** 开始筛选后自动应用到下方表格 */
const appliedFilterResult = ref(null)

const isFiltered = computed(() => !!appliedFilterResult.value)
const resolvedTaskId = computed(() => String(props.taskId || '').trim())
const canStartFilter = computed(
  () => String(filterPrompt.value || '').trim().length > 0 && !!resolvedTaskId.value
)

const displayResult = computed(() => appliedFilterResult.value || props.allResult || {})

watch(
  () => props.allResult,
  () => {
    appliedFilterResult.value = null
  }
)

const effectiveSchema = computed(() => {
  if (props.columnSchema) return props.columnSchema
  return buildColumnSchema(null, {})
})

const sectionDefs = computed(() => [
  { key: 'yz', title: '一致', tagType: 'success', showReasonColumn: true, showGroupSeqColumn: true },
  {
    key: 'bwqyz',
    title: '不完全一致',
    tagType: 'warning',
    showReasonColumn: true,
    showGroupSeqColumn: true
  },
  {
    key: 'ggdyxm',
    title: `${props.table1Label}独有项目`,
    tagType: 'info',
    showReasonColumn: false,
    showGroupSeqColumn: false
  },
  {
    key: 'tzxmzxsp',
    title: `${props.table2Label}独有项目`,
    tagType: 'danger',
    showReasonColumn: false,
    showGroupSeqColumn: false
  }
])

function sectionRows(key) {
  return displayResult.value?.[key] || []
}

function cancelFilter() {
  if (!appliedFilterResult.value) {
    ElMessage.warning('当前没有筛选结果')
    return
  }
  appliedFilterResult.value = null
  ElMessage.success('已取消筛选，已还原为原始结果')
}

function dynamicColumnsForSection(sectionKey) {
  const schema = effectiveSchema.value
  const fixedColumns = new Set(['组序号', '序号', '文件名称', '说明', '筛选原因'])
  let columns = []
  if (sectionKey === 'yz' || sectionKey === 'bwqyz') {
    columns = schema.compareUnionColumns || []
  } else if (sectionKey === 'ggdyxm') {
    columns = schema.table1SourceColumns || []
  } else {
    columns = schema.table2SourceColumns || []
  }
  return columns.filter((col) => col && !fixedColumns.has(col))
}

function mergeColumnProps(section) {
  const propsSet = new Set()
  if (section.showGroupSeqColumn) {
    propsSet.add('组序号')
  }
  if (section.showReasonColumn) {
    propsSet.add('说明')
  }
  if (isFiltered.value) {
    propsSet.add('筛选原因')
  }
  return propsSet
}

function withFilterReason(rows, reason) {
  return (rows || []).map((row) => ({
    ...row,
    筛选原因: reason
  }))
}

function exportHeadersForSection(section) {
  const headers = buildExportHeaders(effectiveSchema.value, section)
  if (isFiltered.value && !headers.includes('筛选原因')) {
    return [...headers, '筛选原因']
  }
  return headers
}

const spanMethod = ({ row, column, rowIndex }, section) => {
  const prop = column.property
  const mergeProps = mergeColumnProps(section)
  if (!mergeProps.has(prop)) {
    return { rowspan: 1, colspan: 1 }
  }

  const tableData = sectionRows(section.key)
  if (rowIndex > 0) {
    const prevRow = tableData[rowIndex - 1]
    if (prevRow && row.组序号 === prevRow.组序号) {
      return { rowspan: 0, colspan: 0 }
    }
  }

  let rowspan = 1
  for (let i = rowIndex + 1; i < tableData.length; i++) {
    if (tableData[i].组序号 === row.组序号) {
      rowspan++
    } else {
      break
    }
  }
  return { rowspan, colspan: 1 }
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) {
    ElMessage.success('已进入全屏模式，按 ESC 或点击按钮退出')
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

const handleExport = (command) => {
  if (command === 'markdown') {
    exportToMarkdown()
  } else if (command === 'excel') {
    exportToExcel()
  }
}

function cell(value) {
  if (value == null || value === '') return ''
  return sanitizeExcelCellText(String(value))
}

function getTotalRowCount(result) {
  const r = result || {}
  return (
    (r.yz?.length || 0) +
    (r.bwqyz?.length || 0) +
    (r.ggdyxm?.length || 0) +
    (r.tzxmzxsp?.length || 0)
  )
}

function groupPairs(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const key = row.组序号
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return [...map.values()]
}

/**
 * 按组级 decisions 过滤配对区；独有区原样保留。
 * @param {object} source
 * @param {{ yz?: array, bwqyz?: array }} decisions
 */
function applyDecisionsToResult(source, decisions) {
  const src = source || {}
  const dec = decisions || {}

  function filterPaired(rows, sectionDecisions) {
    const keepMap = new Map()
    for (const d of sectionDecisions || []) {
      if (d == null) continue
      const key = Number(d.group_key)
      if (Number.isNaN(key)) continue
      keepMap.set(key, d)
    }
    const kept = []
    for (const pair of groupPairs(rows)) {
      const gk = Number(pair[0]?.组序号)
      const decision = keepMap.get(gk)
      if (!decision || !decision.keep) continue
      const reason = String(decision.filter_reason || '').trim() || '符合提示词'
      kept.push(...withFilterReason(pair, reason))
    }
    return kept
  }

  return {
    yz: filterPaired(src.yz, dec.yz),
    bwqyz: filterPaired(src.bwqyz, dec.bwqyz),
    ggdyxm: Array.isArray(src.ggdyxm) ? src.ggdyxm.map((r) => ({ ...r })) : [],
    tzxmzxsp: Array.isArray(src.tzxmzxsp) ? src.tzxmzxsp.map((r) => ({ ...r })) : []
  }
}

async function runFilter() {
  const prompt = String(filterPrompt.value || '').trim()
  if (!prompt) {
    ElMessage.warning('请先填写筛选提示词')
    return
  }
  const taskUuid = resolvedTaskId.value
  if (!taskUuid) {
    ElMessage.warning('请先打开对比任务详情后再筛选')
    return
  }

  const source = props.allResult || {}
  if (getTotalRowCount(source) === 0) {
    ElMessage.warning('当前没有可筛选的结果数据')
    return
  }

    filtering.value = true
  try {
    const resp = await associationCompareAnalyzeAPI({
      task_uuid: taskUuid,
      prompt
    })
    if (!(resp?.code === 200 || resp?.code === 201)) {
      ElMessage.error(resp?.message || '筛选失败')
      return
    }
    const payload = resp?.data && typeof resp.data === 'object' ? resp.data : {}
    if (payload.status && payload.status !== 'success') {
      ElMessage.error(payload.message || '筛选失败')
      return
    }
    const decisions = payload.decisions || {}
    appliedFilterResult.value = applyDecisionsToResult(source, decisions)
    const kept =
      (appliedFilterResult.value.yz?.length || 0) +
      (appliedFilterResult.value.bwqyz?.length || 0)
    ElMessage.success(kept > 0 ? '筛选完成' : '筛选完成（无配对组命中，独有区已保留）')
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.message || e?.response?.data?.detail || '筛选请求失败')
  } finally {
    filtering.value = false
  }
}

function headerToRowKey(header) {
  return header
}

function rowToExportRecord(row, headers, schema) {
  const rec = {}
  for (const h of headers) {
    const key = headerToRowKey(h)
    rec[h] = cell(formatCellValue(row[key]))
  }
  return rec
}

function buildSheetRows(rows, headers, schema) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return [{ 提示: '无数据' }]
  return list.map((row) => rowToExportRecord(row, headers, schema))
}

/**
 * 按组序号生成 Excel 纵向合并区域（与页面 span-method 一致）
 * SheetJS 坐标：第 0 行为表头，数据从第 1 行起
 * @param {object[]} rows 原始结果行
 * @param {string[]} headers 导出表头
 * @param {string[]} mergeProps 需要合并的列名
 * @returns {Array<{ s: { r: number, c: number }, e: { r: number, c: number } }>}
 */
function buildGroupMerges(rows, headers, mergeProps) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length || !Array.isArray(headers) || !headers.length) return []

  const colIndexes = mergeProps
    .map((prop) => headers.indexOf(prop))
    .filter((idx) => idx >= 0)
  if (!colIndexes.length) return []

  const merges = []
  let i = 0
  while (i < list.length) {
    const groupKey = list[i]?.组序号
    let j = i + 1
    while (j < list.length && list[j]?.组序号 === groupKey) {
      j++
    }
    const rowspan = j - i
    if (rowspan > 1 && groupKey != null && groupKey !== '') {
      const startRow = i + 1
      const endRow = j
      for (const c of colIndexes) {
        merges.push({
          s: { r: startRow, c },
          e: { r: endRow, c }
        })
      }
    }
    i = j
  }
  return merges
}

function escapeMdCell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function appendMarkdownSection(lines, title, headers, rows, schema) {
  lines.push(`## ${title}\n`)
  lines.push(`| ${headers.join(' | ')} |`)
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`)
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) {
    lines.push(`| ${headers.map((_, i) => (i === 0 ? '无数据' : '')).join(' | ')} |`)
  } else {
    list.forEach((row) => {
      const mapped = rowToExportRecord(row, headers, schema)
      lines.push(`| ${headers.map((h) => escapeMdCell(mapped[h])).join(' | ')} |`)
    })
  }
  lines.push('')
}

const exportToMarkdown = () => {
  const r = displayResult.value || {}
  if (getTotalRowCount(r) === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const schema = effectiveSchema.value
  const suffix = isFiltered.value ? '_筛选' : ''
  const lines = [`# 两表项目关联度分析结果${isFiltered.value ? '（筛选后）' : ''}\n`]
  appendMarkdownSection(lines, '一致', exportHeadersForSection('yz'), r.yz, schema)
  appendMarkdownSection(lines, '不完全一致', exportHeadersForSection('bwqyz'), r.bwqyz, schema)
  appendMarkdownSection(
    lines,
    `${props.table1Label}独有项目`,
    exportHeadersForSection('ggdyxm'),
    r.ggdyxm,
    schema
  )
  appendMarkdownSection(
    lines,
    `${props.table2Label}独有项目`,
    exportHeadersForSection('tzxmzxsp'),
    r.tzxmzxsp,
    schema
  )

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `两表项目关联度${suffix}_${Date.now()}.md`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success('Markdown 文件导出成功')
}

const exportToExcel = () => {
  const r = displayResult.value || {}
  if (getTotalRowCount(r) === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const schema = effectiveSchema.value
  const suffix = isFiltered.value ? '_筛选' : ''
  const yzHeaders = exportHeadersForSection('yz')
  const bwqyzHeaders = exportHeadersForSection('bwqyz')
  const pairMergeProps = ['组序号', '说明']
  if (isFiltered.value) {
    pairMergeProps.push('筛选原因')
  }
  const sheets = [
    buildSheetRows(r.yz, yzHeaders, schema),
    buildSheetRows(r.bwqyz, bwqyzHeaders, schema),
    buildSheetRows(r.ggdyxm, exportHeadersForSection('ggdyxm'), schema),
    buildSheetRows(r.tzxmzxsp, exportHeadersForSection('tzxmzxsp'), schema)
  ]
  const sheetNames = ['一致', '不完全一致', `${props.table1Label}独有`, `${props.table2Label}独有`]
  const mergesBySheet = [
    buildGroupMerges(r.yz, yzHeaders, pairMergeProps),
    buildGroupMerges(r.bwqyz, bwqyzHeaders, pairMergeProps),
    [],
    []
  ]
  exportFn(sheets, sheetNames, `两表项目关联度${suffix}_${Date.now()}`, mergesBySheet)
  ElMessage.success('Excel 文件导出成功')
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: #fff;
  padding: 20px;
  height: 100%;
}

.action-bar {
  display: flex;
  padding: 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.action-bar > * + * {
  margin-left: 10px;
}

.filter-status-tag {
  align-self: center;
}

.filter-prompt-bar {
  display: flex;
  align-items: stretch;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.filter-prompt-input {
  flex: 1;
  min-width: 0;
}

.filter-prompt-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-left: 12px;
  flex-shrink: 0;
}

.filter-prompt-actions > * + * {
  margin-top: 8px;
  margin-left: 0;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.result-collapse {
  border: none;
}

.result-collapse :deep(.el-collapse-item) {
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
}

.result-collapse :deep(.el-collapse-item__header) {
  background: #f5f7fa;
  padding: 0 20px;
  height: 50px;
  line-height: 50px;
  font-size: 15px;
  border: none;
}

.result-collapse :deep(.el-collapse-item__wrap) {
  border: none;
}

.result-collapse :deep(.el-collapse-item__content) {
  padding: 5px 1px;
  background: #fff;
}

.collapse-title {
  display: flex;
  align-items: center;
  width: 100%;
}

.collapse-title > * + * {
  margin-left: 12px;
}

.title-text {
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}

.table-wrapper :deep(.el-table) {
  font-size: 13px;
}

.table-wrapper :deep(.el-table th) {
  background: #f5f7fa !important;
  color: #303133;
  font-weight: 600;
}

.table-wrapper :deep(.el-table td),
.table-wrapper :deep(.el-table th) {
  padding: 12px 0;
}

.table-wrapper :deep(.el-table--border td),
.table-wrapper :deep(.el-table--border th) {
  border-color: #e4e7ed;
}

.table-wrapper :deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: #fafafa;
}

.extracted-value-cell {
  padding: 4px 0;
  line-height: 1.6;
}
</style>
