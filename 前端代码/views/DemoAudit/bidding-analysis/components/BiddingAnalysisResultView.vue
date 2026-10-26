<template>
  <div class="bidding-result-view bidding-analysis-result-theme">
    <!-- 页头 -->
    <div class="bidding-result-header">
      <div class="bidding-result-header-left">
        <el-button link type="primary" class="bidding-result-back" @click="$emit('back')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="bidding-result-title">{{ pageTitle }}</h2>
        <el-tag type="success" size="small">已完成</el-tag>
      </div>
      <div class="bidding-result-header-actions">
        <el-button size="small" :loading="ruleTableLoading" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- Tab 区域 -->
    <el-tabs v-model="activeTab" class="bidding-result-tabs">
      <!-- 分析结果 -->
      <el-tab-pane label="分析结果" name="rules">
        <div class="bidding-result-doc-scope-tabs">
          <el-radio-group v-model="docScopeFilter" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button v-if="showBiddingScope" label="bidding">招标</el-radio-button>
            <el-radio-button v-if="showTenderScope" label="tender">投标</el-radio-button>
          </el-radio-group>
          <span class="bidding-result-doc-scope-count">共 {{ filteredRuleResults.length }} 条</span>
        </div>

        <div class="bidding-result-rules-layout">
          <div ref="riskChartRef" class="bidding-result-rules-chart" />
          <div class="bidding-result-rules-table-wrap">
            <div class="bidding-result-toolbar bidding-result-toolbar--compact">
              <div class="bidding-result-filter-tabs">
                <el-radio-group v-model="riskFilter" size="small">
                  <el-radio-button label="all">全部结果</el-radio-button>
                  <el-radio-button label="high">高风险</el-radio-button>
                  <el-radio-button label="medium">中风险</el-radio-button>
                  <el-radio-button label="low">低风险</el-radio-button>
                  <el-radio-button label="none">未发现风险</el-radio-button>
                </el-radio-group>
              </div>
              <div class="bidding-result-toolbar-right sd-toolbar-row sd-toolbar-row--medium">
                <el-input
                  v-model="searchKeyword"
                  placeholder="搜索标题、描述或涉及单位"
                  clearable
                  style="width: 220px"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
                <el-select v-model="categoryFilter" placeholder="结果分类" clearable style="width: 110px">
                  <el-option label="商务" value="商务" />
                  <el-option label="报价" value="报价" />
                  <el-option label="文件" value="文件" />
                  <el-option label="元数据" value="元数据" />
                  <el-option label="文本" value="文本" />
                </el-select>
                <el-button @click="resetFilters">重置</el-button>
              </div>
            </div>

            <div class="bidding-result-rules-table-box">
              <el-table
                v-loading="ruleTableLoading"
                :data="pagedRuleResults"
                border
                stripe
                size="small"
                class="sd-table--clean"
                style="width: 100%"
              >
                <el-table-column label="风险等级" width="110">
                  <template #default="{ row }">
                    <el-tag :type="getRiskTagType(row.riskLevel)" size="small" :style="getRiskTagStyle(row.riskLevel)">
                      {{ getRiskLabel(row.riskLevel) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="title" label="结果标题" min-width="220" show-overflow-tooltip />
                <el-table-column prop="ruleName" label="规则" width="140" show-overflow-tooltip />
                <el-table-column label="来源" width="80">
                  <template #default="{ row }">
                    {{ getDocTypeLabel(row.docType) }}
                  </template>
                </el-table-column>
                <el-table-column label="置信度" width="90">
                  <template #default="{ row }">{{ row.confidence }}%</template>
                </el-table-column>
                <el-table-column label="涉及单位" min-width="140" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span v-if="row.docType === 'bidding'">—</span>
                    <span v-else>{{ row.involvedUnits.join('、') }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="180" fixed="right">
                  <template #default="{ row }">
                    <div class="sd-table-op-cell">
                      <el-button
                        v-if="row.llmEvidence"
                        type="primary"
                        plain
                        size="small"
                        class="sd-table-op-btn"
                        @click="openEvidence(row)"
                      >
                        查看证据
                      </el-button>
                      <el-button
                        type="primary"
                        size="small"
                        class="sd-table-op-btn"
                        @click="openDetail(row)"
                      >
                        查看详情
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="filteredRuleResults.length" class="sd-table-pagination">
                <el-pagination
                  v-model:current-page="ruleTablePage"
                  v-model:page-size="ruleTablePageSize"
                  :total="filteredRuleResults.length"
                  :page-sizes="[10, 20, 50]"
                  layout="total, sizes, prev, pager, next"
                  background
                  @size-change="resetRuleTablePagination"
                />
              </div>
              <div v-else class="bidding-result-table-load-tip">暂无匹配结果</div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 文件详情 -->
      <el-tab-pane label="文件详情" name="files">
        <div class="bidding-result-doc-scope-tabs">
          <el-radio-group v-model="fileScopeFilter" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button v-if="showBiddingScope" label="bidding">招标</el-radio-button>
            <el-radio-button v-if="showTenderScope" label="tender">投标</el-radio-button>
          </el-radio-group>
          <span class="bidding-result-doc-scope-count">共 {{ filteredProjectFiles.length }} 个文件</span>
        </div>
        <div class="bidding-result-files-table-box">
          <el-table
            :data="filteredProjectFiles"
            border
            stripe
            size="small"
            class="sd-table--clean"
            style="width: 100%"
          >
          <el-table-column label="文件类型" width="90">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.fileKind === 'bidding' ? 'success' : 'primary'"
                effect="plain"
              >
                {{ getFileKindLabel(row.fileKind) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="文件名" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ 'bidding-result-file-link': row.fileKind === 'tender' }">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="company" label="投标单位" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.fileKind === 'tender' ? row.company : '—' }}
            </template>
          </el-table-column>
          <el-table-column prop="fileType" label="文件格式" width="90" />
          <el-table-column label="类别" width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.fileKind === 'tender'"
                size="small"
                :type="row.categoryType === 'tech' ? 'success' : 'warning'"
                effect="plain"
              >
                {{ row.category }}
              </el-tag>
              <span v-else>{{ row.category }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="size" label="文件大小" width="100" />
          <el-table-column prop="extractStatus" label="提取状态" width="100">
            <template #default="{ row }">
              <span class="bidding-result-status-ok">{{ row.extractStatus }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="metadata" label="元数据" width="80" />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <div class="sd-table-op-cell">
                <el-button
                  type="primary"
                  size="small"
                  class="sd-table-op-btn"
                  @click="openFileInfo(row)"
                >
                  查看信息
                </el-button>
                <el-button
                  v-if="row.fileKind === 'tender'"
                  type="primary"
                  plain
                  size="small"
                  class="sd-table-op-btn"
                  @click="openFileResult(row)"
                >
                  查看结果
                </el-button>
              </div>
            </template>
          </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 生成报告 -->
      <el-tab-pane label="生成报告" name="report">
        <BiddingAnalysisReportPanel
          :project="project"
          :rule-results="ruleResults"
          :analysis-modes="analysisModes"
          @view-detail="openDetail"
          @view-evidence="openEvidence"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 规则详情抽屉 -->
    <BiddingAnalysisRuleDetailDrawer v-model="detailDrawerVisible" :rule-item="currentRule" />

    <!-- 证据弹窗 -->
    <BiddingAnalysisEvidenceDialog v-model="evidenceDialogVisible" :evidence="currentEvidence" />

    <!-- 文件抽取信息抽屉 -->
    <BiddingAnalysisFileExtractDrawer
      v-model="fileInfoDrawerVisible"
      :file="currentFile"
      :extract-detail="currentExtractDetail"
    />

    <!-- 单文件结果抽屉 -->
    <el-drawer
      v-model="fileResultDrawerVisible"
      :title="currentFile ? `${currentFile.name} — 抽取结果` : '查看结果'"
      size="480px"
      destroy-on-close
    >
      <template v-if="currentFile">
        <el-alert type="success" :closable="false" show-icon title="文件已完成抽取，可参与规则分析" />
        <div class="bidding-result-file-result-block">
          <div class="bidding-result-file-result-title">基本信息</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="投标单位">{{ currentFile.company }}</el-descriptions-item>
            <el-descriptions-item label="标书分类">{{ currentFile.category }}</el-descriptions-item>
            <el-descriptions-item label="提取状态">{{ currentFile.extractStatus }}</el-descriptions-item>
          </el-descriptions>
        </div>
        <div class="bidding-result-file-result-block">
          <div class="bidding-result-file-result-title">关联规则结果</div>
          <div
            v-for="rule in relatedRulesForFile"
            :key="rule.id"
            class="bidding-result-file-rule-item"
            @click="openDetail(rule)"
          >
            <el-tag :type="getRiskTagType(rule.riskLevel)" size="small" :style="getRiskTagStyle(rule.riskLevel)">
              {{ getRiskLabel(rule.riskLevel) }}
            </el-tag>
            <span class="bidding-result-file-rule-name">{{ rule.ruleName }}</span>
            <el-icon class="bidding-result-file-rule-arrow"><ArrowRight /></el-icon>
          </div>
          <el-empty v-if="!relatedRulesForFile.length" description="暂无关联规则结果" :image-size="60" />
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { SD_THEME_DEFAULT_PRIMARY, getSavedSdThemeColor } from '@/utils/sdThemeColor.js'
import { ArrowLeft, ArrowRight, Search } from '@element-plus/icons-vue'
import BiddingAnalysisRuleDetailDrawer from './BiddingAnalysisRuleDetailDrawer.vue'
import BiddingAnalysisEvidenceDialog from './BiddingAnalysisEvidenceDialog.vue'
import BiddingAnalysisFileExtractDrawer from './BiddingAnalysisFileExtractDrawer.vue'
import BiddingAnalysisReportPanel from './BiddingAnalysisReportPanel.vue'
import { useBiddingAnalysisResults } from '../composables/useBiddingAnalysisResults.js'
import {
  getBiddingAnalysisFilesAPI,
  unwrapBiddingApiData,
} from '@/api/biddingAnalysis.js'
import {
  RISK_LEVEL_MAP,
  getRuleResultsByModes,
  getProjectFilesByModes,
  mockFileExtractDetail,
  mockBiddingFileExtractDetail,
} from '../mock/biddingAnalysisResultMock.js'
import {
  hasBiddingAnalysis,
  hasJointAnalysis,
  hasTenderAnalysis,
  normalizeAnalysisModes,
} from '../mock/biddingAnalysisTemplateMock.js'

defineOptions({ name: 'BiddingAnalysisResultView' })

const props = defineProps({
  project: { type: Object, required: true },
  analysisModes: { type: Array, default: () => [] },
  analysisId: { type: String, default: '' },
  useApi: { type: Boolean, default: false },
})

const { loadRuleResults } = useBiddingAnalysisResults()

defineEmits(['back'])

const normalizedModes = computed(() => normalizeAnalysisModes(props.analysisModes))

const showBiddingScope = computed(
  () => hasBiddingAnalysis(normalizedModes.value) || hasJointAnalysis(normalizedModes.value)
)
const showTenderScope = computed(
  () => hasTenderAnalysis(normalizedModes.value) || hasJointAnalysis(normalizedModes.value)
)

const getDefaultDocScopeFilter = (modes) => {
  const normalized = normalizeAnalysisModes(modes)
  const showBidding = hasBiddingAnalysis(normalized) || hasJointAnalysis(normalized)
  const showTender = hasTenderAnalysis(normalized) || hasJointAnalysis(normalized)
  if (showBidding && !showTender) return 'bidding'
  if (showTender && !showBidding) return 'tender'
  return 'all'
}

const getDefaultFileScopeFilter = (modes) => getDefaultDocScopeFilter(modes)

const activeTab = ref('rules')
const docScopeFilter = ref(getDefaultDocScopeFilter(props.analysisModes))
const fileScopeFilter = ref(getDefaultFileScopeFilter(props.analysisModes))
const riskFilter = ref('all')
const categoryFilter = ref('')
const searchKeyword = ref('')
const riskChartRef = ref(null)
let riskChart = null
let chartEventsBound = false

const RULE_TABLE_PAGE_SIZE_DEFAULT = 10
const ruleTablePage = ref(1)
const ruleTablePageSize = ref(RULE_TABLE_PAGE_SIZE_DEFAULT)
const ruleTableLoading = ref(false)

/**
 * 读取当前主题主色（图表与标签低风险色）
 * @returns {string} 主题主色十六进制值
 */
const resolveSdPrimaryColor = () => {
  if (typeof window !== 'undefined') {
    const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--sd-primary').trim()
    if (cssVar) return cssVar
  }
  return getSavedSdThemeColor() || SD_THEME_DEFAULT_PRIMARY
}

const riskChartItems = computed(() => [
  { key: 'high', label: '高风险', color: RISK_LEVEL_MAP.high.borderColor },
  { key: 'medium', label: '中风险', color: RISK_LEVEL_MAP.medium.borderColor },
  { key: 'low', label: '低风险', color: resolveSdPrimaryColor() },
  { key: 'none', label: '未发现风险', color: RISK_LEVEL_MAP.none.borderColor },
])

const RISK_LEVEL_ORDER = { high: 0, medium: 1, low: 2, none: 3 }

const pageTitle = computed(() => props.project.name || '招投标分析')

const detailDrawerVisible = ref(false)
const evidenceDialogVisible = ref(false)
const fileInfoDrawerVisible = ref(false)
const fileResultDrawerVisible = ref(false)

const currentRule = ref(null)
const currentEvidence = ref(null)
const currentFile = ref(null)
const currentExtractDetail = ref(null)

const assignProjectMeta = (items) =>
  items.map((item) => ({
    ...item,
    projectId: props.project.id,
    projectName: props.project.name,
  }))

const loadProjectMockData = () => {
  const fileData = getProjectFilesByModes(normalizedModes.value)
  ruleResults.value = assignProjectMeta(getRuleResultsByModes(normalizedModes.value))
  biddingFiles.value = assignProjectMeta(fileData.biddingFiles)
  tenderFiles.value = assignProjectMeta(fileData.tenderFiles)
  docScopeFilter.value = getDefaultDocScopeFilter(normalizedModes.value)
  fileScopeFilter.value = getDefaultFileScopeFilter(normalizedModes.value)
  resetRuleTablePagination()
}

const mapApiFilesForProject = (rows, projectId) => {
  const list = Array.isArray(rows) ? rows : []
  const projectRows = list.filter((row) => row.project_id === projectId)
  const biddingFiles = projectRows
    .filter((row) => row.file_role === 'bidding')
    .map((row) => ({
      id: row.document_id || row.file_uuid,
      name: row.file_name || '',
      fileType: 'pdf',
      category: '招标文件',
      size: row.file_size || '—',
      extractStatus: row.content_status === 'READY' ? '已提取' : '待提取',
      metadata: '—',
    }))
  const tenderFiles = projectRows
    .filter((row) => row.file_role === 'tender')
    .map((row) => ({
      id: row.document_id || row.file_uuid,
      name: row.file_name || '',
      company: row.company_name || '—',
      fileType: 'pdf',
      category: '投标文件',
      categoryType: 'tech',
      size: row.file_size || '—',
      extractStatus: row.content_status === 'READY' ? '已提取' : '待提取',
      metadata: '—',
    }))
  return { biddingFiles, tenderFiles }
}

const loadProjectApiData = async () => {
  ruleTableLoading.value = true
  try {
    const projectId = props.project.projectId || props.project.id
    const rows = await loadRuleResults(props.analysisId, projectId)
    ruleResults.value = assignProjectMeta(rows)

    let fileData = { biddingFiles: [], tenderFiles: [] }
    try {
      const filesRes = await getBiddingAnalysisFilesAPI(props.analysisId)
      fileData = mapApiFilesForProject(unwrapBiddingApiData(filesRes), projectId)
    } catch {
      fileData = { biddingFiles: [], tenderFiles: [] }
    }
    biddingFiles.value = assignProjectMeta(fileData.biddingFiles)
    tenderFiles.value = assignProjectMeta(fileData.tenderFiles)
    docScopeFilter.value = getDefaultDocScopeFilter(normalizedModes.value)
    fileScopeFilter.value = getDefaultFileScopeFilter(normalizedModes.value)
    resetRuleTablePagination()
  } finally {
    ruleTableLoading.value = false
  }
}

const loadProjectData = () => {
  if (props.analysisId) {
    loadProjectApiData()
    return
  }
  if (props.useApi) {
    ruleResults.value = []
    biddingFiles.value = []
    tenderFiles.value = []
    return
  }
  loadProjectMockData()
}

const handleRefresh = async () => {
  if (!props.analysisId) return
  await loadProjectApiData()
}

const ruleResults = ref([])
const biddingFiles = ref([])
const tenderFiles = ref([])

const projectFiles = computed(() => [
  ...biddingFiles.value.map((file) => ({
    ...file,
    fileKind: 'bidding',
    company: '—',
  })),
  ...tenderFiles.value.map((file) => ({
    ...file,
    fileKind: 'tender',
  })),
])

const filteredProjectFiles = computed(() => {
  if (fileScopeFilter.value === 'all') return projectFiles.value
  return projectFiles.value.filter((file) => file.fileKind === fileScopeFilter.value)
})

const scopedRuleResults = computed(() => {
  if (docScopeFilter.value === 'all') return ruleResults.value
  if (docScopeFilter.value === 'bidding') {
    return ruleResults.value.filter((r) => r.docType === 'bidding' || r.docType === 'joint')
  }
  return ruleResults.value.filter((r) => r.docType === 'tender')
})

const filteredRuleResults = computed(() => {
  let list = [...scopedRuleResults.value]
  if (riskFilter.value !== 'all') {
    list = list.filter((r) => r.riskLevel === riskFilter.value)
  }
  if (categoryFilter.value) {
    list = list.filter((r) => r.categories.includes(categoryFilter.value))
  }
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(kw) ||
        r.description.toLowerCase().includes(kw) ||
        r.involvedUnits.some((u) => u.toLowerCase().includes(kw))
    )
  }
  return list.sort(
    (a, b) => (RISK_LEVEL_ORDER[a.riskLevel] ?? 99) - (RISK_LEVEL_ORDER[b.riskLevel] ?? 99)
  )
})

const pagedRuleResults = computed(() => {
  const list = filteredRuleResults.value
  const start = (ruleTablePage.value - 1) * ruleTablePageSize.value
  return list.slice(start, start + ruleTablePageSize.value)
})

const resetRuleTablePagination = () => {
  ruleTablePage.value = 1
}

loadProjectData()
resetRuleTablePagination()

watch(
  () => [props.project.id, normalizedModes.value.join(','), props.analysisId, props.useApi],
  () => {
    loadProjectData()
    resetRuleTablePagination()
  }
)

watch([docScopeFilter, riskFilter, categoryFilter, searchKeyword], () => {
  resetRuleTablePagination()
})

const chartRiskData = computed(() => {
  const summary = { high: 0, medium: 0, low: 0, none: 0 }
  scopedRuleResults.value.forEach((rule) => {
    if (summary[rule.riskLevel] !== undefined) {
      summary[rule.riskLevel] += 1
    }
  })
  return summary
})

const getLegendName = (item, summary) => `${item.label} ${summary[item.key] || 0}`

const findRiskLevelByLegendName = (name) => {
  const item = riskChartItems.value.find((entry) => name.startsWith(entry.label))
  return item?.key || null
}

const toggleRiskFilter = (level) => {
  riskFilter.value = riskFilter.value === level ? 'all' : level
}

const buildPieSeriesData = (summary) =>
  riskChartItems.value.map((item) => {
    const count = summary[item.key] || 0
    const isSelected = riskFilter.value === item.key
    const isDimmed = riskFilter.value !== 'all' && !isSelected
    return {
      name: getLegendName(item, summary),
      value: count,
      riskLevel: item.key,
      selected: isSelected,
      itemStyle: {
        color: item.color,
        opacity: isDimmed ? 0.28 : 1,
      },
    }
  }).filter((item) => item.value > 0)

const buildLegendSelected = (summary) =>
  riskChartItems.value.reduce((acc, item) => {
    acc[getLegendName(item, summary)] = riskFilter.value === 'all' || riskFilter.value === item.key
    return acc
  }, {})

const bindChartEvents = () => {
  if (!riskChart || chartEventsBound) return
  chartEventsBound = true

  riskChart.on('click', (params) => {
    if (params.componentType === 'legend') {
      const level = findRiskLevelByLegendName(params.name)
      if (level) toggleRiskFilter(level)
      return
    }
    if (params.seriesType === 'pie' && params.data?.riskLevel) {
      toggleRiskFilter(params.data.riskLevel)
    }
  })
}

const renderRiskChart = () => {
  if (!riskChartRef.value) return
  if (!riskChart) {
    riskChart = echarts.init(riskChartRef.value)
    bindChartEvents()
  }

  const summary = chartRiskData.value
  const legendData = riskChartItems.value.map((item) => getLegendName(item, summary))

  riskChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      orient: 'vertical',
      right: 8,
      bottom: 8,
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 6,
      textStyle: { fontSize: 10, color: '#606266' },
      triggerEvent: true,
      selectedMode: false,
      data: legendData,
      selected: buildLegendSelected(summary),
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['38%', '46%'],
        selectedMode: 'single',
        selectedOffset: 8,
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
        },
        data: buildPieSeriesData(summary),
      },
    ],
  })
}

onMounted(() => {
  nextTick(renderRiskChart)
})

watch([chartRiskData, docScopeFilter, riskFilter], () => {
  nextTick(renderRiskChart)
})

onBeforeUnmount(() => {
  if (riskChart) {
    riskChart.off('click')
    riskChart.dispose()
    riskChart = null
    chartEventsBound = false
  }
})

const relatedRulesForFile = computed(() =>
  ruleResults.value.filter((r) => r.docType === 'tender').slice(0, 3)
)

const getRiskLabel = (level) => RISK_LEVEL_MAP[level]?.label || level
const getRiskTagType = (level) => RISK_LEVEL_MAP[level]?.tagType || 'info'

const getDocTypeLabel = (docType) => {
  if (docType === 'bidding') return '招标'
  if (docType === 'tender') return '投标'
  if (docType === 'joint') return '联合'
  return docType
}

const getFileKindLabel = (fileKind) => (fileKind === 'bidding' ? '招标' : '投标')

const getRiskTagStyle = (level) => {
  if (level === 'low') {
    return {
      background: 'var(--sd-primary-light, #e8f0f8)',
      color: 'var(--sd-primary, #195fb4)',
      border: 'none',
    }
  }
  return {}
}

const resetFilters = () => {
  riskFilter.value = 'all'
  categoryFilter.value = ''
  searchKeyword.value = ''
}

const openDetail = (rule) => {
  currentRule.value = rule
  detailDrawerVisible.value = true
}

const openEvidence = (rule) => {
  currentEvidence.value = rule.llmEvidence
  evidenceDialogVisible.value = true
}

const openFileInfo = (file) => {
  currentFile.value = file
  if (props.analysisId) {
    currentExtractDetail.value = {
      fileName: file.name,
      fileType: file.fileType || '—',
      category: file.category || '—',
      size: file.size || '—',
      extractStatus: file.extractStatus || '—',
      sections: [],
    }
  } else {
    currentExtractDetail.value = file.fileKind === 'tender'
      ? mockFileExtractDetail
      : mockBiddingFileExtractDetail
  }
  fileInfoDrawerVisible.value = true
}

const openFileResult = (file) => {
  currentFile.value = file
  fileResultDrawerVisible.value = true
}
</script>

<style scoped>
.bidding-result-view {
  height: 100%;
  overflow-y: auto;
  padding: 0 12px 24px;
  background: var(--sd-surface-1, #f4f4f4);
  box-sizing: border-box;
}

.bidding-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.bidding-result-header-left {
  display: flex;
  align-items: center;
}

.bidding-result-header-left > * + * {
  margin-left: 12px;
}

.bidding-result-back {
  padding-left: 0;
}

.bidding-result-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--sd-ink, #161616);
}

.bidding-result-header-actions > * + * {
  margin-left: 8px;
}

.bidding-result-doc-scope-tabs {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.bidding-result-doc-scope-count {
  margin-left: 12px;
  font-size: 13px;
  color: #909399;
}

.bidding-result-rules-layout {
  display: flex;
  align-items: flex-start;
}

.bidding-result-rules-chart {
  flex-shrink: 0;
  width: 280px;
  height: 300px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  background: var(--sd-canvas, #ffffff);
}

.bidding-result-rules-table-wrap {
  flex: 1;
  min-width: 0;
  margin-left: 16px;
}

.bidding-result-rules-table-box,
.bidding-result-files-table-box {
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
}

.bidding-result-rules-table-box .sd-table-pagination {
  margin-top: 0;
  padding: 12px;
  background: var(--sd-surface-1, #f4f4f4);
}

.bidding-result-table-load-tip {
  padding: 10px 12px;
  text-align: center;
  font-size: 12px;
  color: #909399;
  background: var(--sd-surface-1, #f4f4f4);
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
}

.bidding-result-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.bidding-result-toolbar--compact {
  margin-bottom: 12px;
}

.bidding-result-filter-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.bidding-result-toolbar-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.bidding-result-toolbar-right > * + * {
  margin-left: 8px;
}

.bidding-result-status-ok {
  color: #67c23a;
  font-size: 13px;
}

.bidding-result-file-link {
  color: var(--sd-primary, #195fb4);
  cursor: pointer;
}

.bidding-result-file-result-block {
  margin-top: 16px;
}

.bidding-result-file-result-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--sd-ink, #161616);
  margin-bottom: 10px;
}

.bidding-result-file-rule-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.bidding-result-file-rule-item:hover {
  background: var(--sd-primary-light, #e8f0f8);
}

.bidding-result-file-rule-name {
  flex: 1;
  margin-left: 10px;
  font-size: 13px;
  color: var(--sd-ink, #161616);
}

.bidding-result-file-rule-arrow {
  color: #909399;
}

.bidding-analysis-result-theme :deep(.el-button.is-link),
.bidding-analysis-result-theme :deep(.el-button--primary.is-link) {
  color: var(--sd-primary, #195fb4);
}

.bidding-analysis-result-theme :deep(.el-button.is-link:hover),
.bidding-analysis-result-theme :deep(.el-button--primary.is-link:hover) {
  color: var(--sd-primary-dark, #0f4a8c);
}

.bidding-analysis-result-theme :deep(.el-tabs__item.is-active),
.bidding-analysis-result-theme :deep(.el-tabs__item:hover) {
  color: var(--sd-primary, #195fb4);
}

.bidding-analysis-result-theme :deep(.el-tabs__active-bar) {
  background-color: var(--sd-primary, #195fb4);
}

.bidding-analysis-result-theme :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: var(--sd-primary, #195fb4);
  border-color: var(--sd-primary, #195fb4);
  box-shadow: -1px 0 0 0 var(--sd-primary, #195fb4);
}

.bidding-analysis-result-theme :deep(.el-radio-button__inner:hover) {
  color: var(--sd-primary, #195fb4);
}

.bidding-analysis-result-theme :deep(.el-button--primary:not(.is-link):not(.is-plain)) {
  background-color: var(--sd-primary, #195fb4);
  border-color: var(--sd-primary, #195fb4);
}

.bidding-analysis-result-theme :deep(.el-button--primary:not(.is-link):not(.is-plain):hover),
.bidding-analysis-result-theme :deep(.el-button--primary:not(.is-link):not(.is-plain):focus) {
  background-color: var(--sd-primary-dark, #0f4a8c);
  border-color: var(--sd-primary-dark, #0f4a8c);
}
</style>
