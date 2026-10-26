<template>
  <el-drawer
    v-model="visible"
    title="全部议题"
    direction="rtl"
    size="70%"
    :before-close="handleClose"
  >
    <div class="all-topics-drawer-content">
      <!-- 工具栏 -->
      <div class="toolbar">
        <!-- 统计信息 -->
        <div class="stats-bar">
          <span class="stats-item">共 <b>{{ filteredData.length }}</b> 个议题</span>
          <span class="stats-item">{{ clusterCount }} 个聚类</span>
          <span class="stats-item">{{ meetingCount }} 个会议</span>
        </div>
        <!-- 搜索与操作区 -->
        <div class="search-bar">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索议题名称 / 内容 / 会议名称…"
            clearable
            size="small"
            style="width: 240px"
            :prefix-icon="Search"
          />
          <el-select
            v-model="filterCluster"
            placeholder="筛选聚类"
            clearable
            size="small"
            style="width: 150px"
          >
            <el-option
              v-for="name in clusterOptions"
              :key="name"
              :label="name"
              :value="name"
            />
          </el-select>
          <el-select
            v-model="filterMeeting"
            placeholder="筛选会议"
            clearable
            size="small"
            style="width: 160px"
          >
            <el-option
              v-for="name in meetingOptions"
              :key="name"
              :label="name"
              :value="name"
            />
          </el-select>
          <el-button size="small" @click="handleReset">重置</el-button>
          <el-button
            type="success"
            size="small"
            :icon="Download"
            :loading="exporting"
            @click="handleExportExcel"
          >
            导出 Excel
          </el-button>
        </div>
      </div>

      <!-- 表格 -->
      <el-table
        ref="tableRef"
        :data="filteredData"
        border
        style="width: 100%"
        size="small"
        height="calc(100% - 80px)"
        :show-header="true"
        stripe
        highlight-current-row
        @sort-change="handleSortChange"
      >
        <el-table-column type="index" label="序号" width="60" fixed />
        <el-table-column prop="clusterName" label="聚类名称" width="160" show-overflow-tooltip resizable />
        <el-table-column prop="meetingName" label="会议名称" width="160" show-overflow-tooltip resizable />
        <el-table-column prop="meetingDate" label="会议日期" width="120" resizable sortable="custom" />
        <el-table-column prop="topicName" label="议题名称" width="160" show-overflow-tooltip resizable />
        <el-table-column prop="topicContent" label="议题内容" min-width="200" show-overflow-tooltip resizable />
        <el-table-column prop="money" label="涉及金额(万元)" width="140" resizable sortable="custom">
          <template #default="{ row }">
            {{ formatTopicMoney(row.money) }}
          </template>
        </el-table-column>
        <el-table-column prop="attendees" label="参会人员" width="140" show-overflow-tooltip resizable>
          <template #default="{ row }">
            {{ formatAttendees(row.attendees) }}
          </template>
        </el-table-column>
        <el-table-column prop="observers" label="列席人员" width="140" show-overflow-tooltip resizable>
          <template #default="{ row }">
            {{ formatAttendees(row.observers) }}
          </template>
        </el-table-column>
        <!-- 风险分析提取的动态字段列 -->
        <el-table-column
          v-for="field in dynamicTopicColumns"
          :key="field.key"
          :prop="field.key"
          :label="field.label"
          width="120"
          show-overflow-tooltip
          resizable
        >
          <template #default="{ row }">
            {{ formatTopicFieldValue(field.key, row[field.key]) }}
          </template>
        </el-table-column>
        <el-table-column prop="sourceFile" label="源文件" width="160" show-overflow-tooltip resizable />
      </el-table>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Search, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { exportObjectsAsStyledXlsx } from '@/utils/excel/export'
import {
  getDynamicTopicColumns,
  formatTopicFieldValue,
} from '../topicFieldUtils.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  clusters: {
    type: Array,
    default: () => [],
  },
  extractFields: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

const tableRef = ref(null)

// 动态议题字段列（排除默认字段，表头中文化）
const dynamicTopicColumns = computed(() => getDynamicTopicColumns(props.extractFields))

// 双向绑定
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 表格数据：从所有聚类中提取议题
const tableData = computed(() => {
  const data = []
  let index = 1

  props.clusters.forEach((cluster) => {
    const clusterName = cluster.name || ''
    const details = cluster.details || []

    details.forEach((topic) => {
      const row = {
        index: index++,
        clusterName,
        meetingName: topic.meetingName || '',
        meetingDate: topic.meetingDate || '',
        topicName: topic.topicName || '',
        topicContent: topic.topicContent || '',
        money: topic.money || '',
        attendees: topic.attendees || '',
        observers: topic.observers || '',
        sourceFile: topic.fileName || '',
        sourceDocumentId: topic.sourceDocumentId || '',
      }
      if (topic.extraFields) {
        Object.assign(row, topic.extraFields)
      } else {
        dynamicTopicColumns.value.forEach((field) => {
          if (topic[field.key] != null && topic[field.key] !== '') {
            row[field.key] = topic[field.key]
          }
        })
      }
      data.push(row)
    })
  })

  return data
})

// ===== 筛选/排序状态 =====
const searchKeyword = ref('')
const filterCluster = ref('')
const filterMeeting = ref('')
const sortProp = ref('')
const sortOrder = ref('') // 'ascending' | 'descending'

// 聚类选项：若已选会议，只显示该会议下存在的聚类
const clusterOptions = computed(() => {
  const set = new Set()
  tableData.value.forEach((r) => {
    if (!r.clusterName) return
    if (filterMeeting.value && r.meetingName !== filterMeeting.value) return
    set.add(r.clusterName)
  })
  return [...set]
})

// 会议选项：若已选聚类，只显示该聚类下存在的会议
const meetingOptions = computed(() => {
  const set = new Set()
  tableData.value.forEach((r) => {
    if (!r.meetingName) return
    if (filterCluster.value && r.clusterName !== filterCluster.value) return
    set.add(r.meetingName)
  })
  return [...set]
})

// 过滤 + 排序后的数据
const filteredData = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  let result = tableData.value.filter((row) => {
    if (filterCluster.value && row.clusterName !== filterCluster.value) return false
    if (filterMeeting.value && row.meetingName !== filterMeeting.value) return false
    if (kw) {
      const dynamicValues = dynamicTopicColumns.value.map((field) => row[field.key] ?? '')
      const haystack = [
        row.topicName,
        row.topicContent,
        row.meetingName,
        row.clusterName,
        row.sourceFile,
        ...dynamicValues,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(kw)) return false
    }
    return true
  })

  if (sortProp.value && sortOrder.value) {
    result = [...result].sort((a, b) => {
      let va = a[sortProp.value]
      let vb = b[sortProp.value]
      // 金额：取第一个数字进行比较
      if (sortProp.value === 'money') {
        va = parseFloat(String(va).split('|')[0]) || 0
        vb = parseFloat(String(vb).split('|')[0]) || 0
      }
      if (va < vb) return sortOrder.value === 'ascending' ? -1 : 1
      if (va > vb) return sortOrder.value === 'ascending' ? 1 : -1
      return 0
    })
  }

  return result
})

// 聚类变化时，如果当前会议已不在新的会议选项中，自动清除
watch(filterCluster, () => {
  if (filterMeeting.value && !meetingOptions.value.includes(filterMeeting.value)) {
    filterMeeting.value = ''
  }
})

// 会议变化时，如果当前聚类已不在新的聚类选项中，自动清除
watch(filterMeeting, () => {
  if (filterCluster.value && !clusterOptions.value.includes(filterCluster.value)) {
    filterCluster.value = ''
  }
})

const handleSortChange = ({ prop, order }) => {
  sortProp.value = prop || ''
  sortOrder.value = order || ''
}

const handleReset = () => {
  searchKeyword.value = ''
  filterCluster.value = ''
  filterMeeting.value = ''
  sortProp.value = ''
  sortOrder.value = ''
  tableRef.value?.clearSort()
}

// ===== 导出 Excel =====
const exporting = ref(false)

const handleExportExcel = async () => {
  if (!filteredData.value.length) {
    ElMessage.warning('暂无数据可导出')
    return
  }
  exporting.value = true
  try {
    const columnMap = {
      clusterName: '聚类名称',
      meetingName: '会议名称',
      meetingDate: '会议日期',
      topicName: '议题名称',
      topicContent: '议题内容',
      money: '涉及金额(万元)',
      attendees: '参会人员',
      observers: '列席人员',
    }
    dynamicTopicColumns.value.forEach((field) => {
      columnMap[field.key] = field.label
    })
    columnMap.sourceFile = '源文件'

    const colWidths = {
      序号: 6,
      聚类名称: 18,
      会议名称: 20,
      会议日期: 14,
      议题名称: 20,
      议题内容: 40,
      '涉及金额(万元)': 18,
      参会人员: 20,
      列席人员: 20,
      源文件: 22,
    }
    dynamicTopicColumns.value.forEach((field) => {
      colWidths[field.label] = 18
    })

    const rows = filteredData.value.map((row, i) => {
      const obj = { 序号: i + 1 }
      for (const [key, label] of Object.entries(columnMap)) {
        obj[label] =
          key === 'money'
            ? formatTopicMoney(row[key])
            : key === 'attendees' || key === 'observers'
              ? formatAttendees(row[key])
              : formatTopicFieldValue(key, row[key])
      }
      return obj
    })
    const timestamp = new Date().toISOString().slice(0, 10)
    await exportObjectsAsStyledXlsx(rows, '所有议题', `议题列表_${timestamp}`, colWidths)
    ElMessage.success('导出成功')
  } catch (e) {
    console.error(e)
    ElMessage.error('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

// ===== 统计 =====
// 统计：聚类数量
const clusterCount = computed(() => props.clusters.length)

// 统计：会议数量
const meetingCount = computed(() => {
  const meetingSet = new Set()
  props.clusters.forEach((cluster) => {
    const details = cluster.details || []
    details.forEach((topic) => {
      if (topic.meetingName) {
        meetingSet.add(topic.meetingName)
      }
    })
  })
  return meetingSet.size
})

const handleClose = () => {
  visible.value = false
  emit('close')
}

// 格式化金额
const formatTopicMoney = (moneyStr) => {
  if (!moneyStr) return ''

  const parts = String(moneyStr)
    .split('|')
    .map((v) => v.trim())
    .filter((v) => v)

  const amounts = parts
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n))

  if (amounts.length === 0) return ''
  if (amounts.length === 1) return `${amounts[0]}万元`

  const total = amounts.reduce((sum, v) => sum + v, 0)
  return `${total}万元 (${amounts.join('+')})`
}

// 格式化参会人员
const formatAttendees = (attendees) => {
  if (!attendees) return ''
  if (Array.isArray(attendees)) {
    return attendees.length > 0 ? attendees.join('|') : ''
  }
  if (typeof attendees === 'string' && attendees.startsWith('[')) {
    try {
      const parsed = JSON.parse(attendees)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.join('|')
      }
    } catch {
      // 解析失败，继续处理原字符串
    }
  }
  return String(attendees).trim()
}
</script>

<style scoped lang="scss">
.all-topics-drawer-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.stats-bar {
  display: flex;
  align-items: center;
  gap: 24px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stats-item {
  font-size: 13px;
  color: #606266;
}

.stats-item b {
  color: #409eff;
}

.stats-item::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #409eff;
  margin-right: 6px;
}

:deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
}

:deep(.el-drawer__body) {
  padding: 0 20px 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.el-table) {
  background-color: #ffffff;
  flex: 1;
}

:deep(.el-table th.el-table__cell) {
  background-color: #f5f7fa;
  color: #606266;
  font-weight: 600;
  font-size: 12px;
  padding: 0;
  height: 32px;
  white-space: nowrap;
}

:deep(.el-table td.el-table__cell) {
  color: #606266;
  font-size: 12px;
  padding: 8px 0;
}

:deep(.el-table .el-table__row:hover) {
  background-color: #f0f9ff !important;
}
</style>
