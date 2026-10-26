<template>
  <div
    class="risk-analysis-panel"
    v-loading="riskLoading"
    :element-loading-text="
      taskDetailMode && !hasRealReport
        ? '风险报告加载中，请稍候...'
        : '风险分析中，请稍候...'
    "
  >
    <div class="panel-card">
      <!-- 工具栏 -->
      <div class="panel-toolbar">
        <div class="toolbar-left">
          <el-icon><Warning /></el-icon>
          <span class="toolbar-title">风险分析报告</span>
          <el-tag v-if="hasRealReport" size="small" type="success">已生成</el-tag>
        </div>
        <div class="toolbar-right">
          <el-button size="small" :loading="riskLoading" @click="handleRegenerate">
            <el-icon><Refresh /></el-icon>
            重新分析
          </el-button>
          <el-button size="small" :disabled="!hasRealReport" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出报告
          </el-button>
        </div>
      </div>

      <div v-if="riskError && !riskLoading" class="error-state">
        <div class="empty-state">{{ riskError }}</div>
      </div>

      <div
        v-else-if="
          analysisId && !hasRealReport && !riskLoading && !report && !taskDetailMode
        "
        class="empty-state"
      >
        风险报告尚未生成，请等待分析完成或点击重新分析
      </div>

      <div
        v-else-if="
          !report &&
          (riskLoading ||
            (taskDetailMode && analysisId && !hasRealReport && !riskError))
        "
        class="risk-report-loading-placeholder"
      />

      <!-- 报告主体：连续滚动布局，与导出报告模板 1:1 对齐 -->
      <div v-else-if="report" class="report-page">
        <!-- 左侧章节导航 -->
        <nav class="report-nav" id="reportNav">
          <a
            v-for="section in sections"
            :key="section.id"
            class="nav-item"
            :class="{ 'nav-item--active': activeSection === section.id }"
            :href="`#${section.id}`"
            :data-section="section.id"
            @click.prevent="scrollToSection(section.id)"
          >
            {{ section.title }}
          </a>
        </nav>

        <!-- 右侧报告内容 -->
        <div class="report-wrapper" ref="wrapperRef">
          <header class="report-header">
            <h1>{{ report.overview?.title || '会议纪要经济审计分析报告' }}</h1>
            <p class="subtitle">
              生成时间：{{ report.overview?.generatedAt || '' }}
              <span v-if="analysisId"
                >　·　报告 ID：<code>{{ analysisId.slice(0, 12) }}</code></span
              >
            </p>
          </header>

          <!-- 一、基本情况 -->
          <section id="overview" class="report-section">
            <h2 class="section-title">
              {{ report.overview?.title || '会议纪要经济审计分析报告' }}
            </h2>
            <div class="meta-row">
              <span>生成时间：{{ report.overview?.generatedAt || '' }}</span>
              <span>会议数量：{{ report.overview?.meetingCount || 0 }} 份</span>
              <span>时间范围：{{ report.overview?.dateRange || '' }}</span>
            </div>
            <table class="info-table">
              <tbody>
                <tr>
                  <th>会议类型</th>
                  <td>{{ (report.overview?.meetingTypes || []).join('、') }}</td>
                  <th>经济议题</th>
                  <td>{{ report.overview?.economicItemCount || 0 }} 项</td>
                </tr>
                <tr>
                  <th>审计发现</th>
                  <td>{{ report.overview?.findingCount || 0 }} 条</td>
                  <th>风险等级分布</th>
                  <td>
                    <!-- 3 档体系(高危/中危/无风险);旧 4 档 key(levelMediumLow/levelLow)自动合并 -->
                    <span class="tag tag--danger"
                      >高危 {{ (report.overview?.riskStats?.levelHigh || 0) + (report.overview?.riskStats?.levelA || 0) }}</span
                    >
                    <span class="tag tag--warning tag-gap"
                      >中危 {{
                        (report.overview?.riskStats?.levelMedium || 0) +
                        (report.overview?.riskStats?.levelB || 0) +
                        (report.overview?.riskStats?.levelMediumLow || 0) +
                        (report.overview?.riskStats?.levelC || 0)
                      }}</span
                    >
                    <span class="tag tag--none tag-gap"
                      >无风险 {{
                        Math.max(
                          0,
                          (report.overview?.economicItemCount || 0) -
                            ((report.overview?.riskStats?.levelHigh || 0) + (report.overview?.riskStats?.levelA || 0)) -
                            ((report.overview?.riskStats?.levelMedium || 0) + (report.overview?.riskStats?.levelB || 0) +
                             (report.overview?.riskStats?.levelMediumLow || 0) + (report.overview?.riskStats?.levelC || 0)) -
                            ((report.overview?.riskStats?.levelLow || 0) + (report.overview?.riskStats?.levelD || 0)),
                        )
                      }}</span
                    >
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="summary-block">
              <div class="block-label">经济议题概览</div>
              <p class="summary-text">{{ report.overview?.summary || '' }}</p>
            </div>
          </section>

          <!-- 二、会议时间线 -->
          <section id="timeline" class="report-section">
            <h2 class="section-title">二、会议时间线</h2>
            <div class="timeline-search">
              <el-input
                v-model="timelineSearchKeyword"
                clearable
                placeholder="搜索会议日期、类型、议题、文件名"
                size="small"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </div>
            <div v-if="filteredTimeline.length === 0" class="empty-state">
              未找到匹配的会议记录
            </div>
            <div v-else class="timeline-list">
              <div
                v-for="(item, idx) in filteredTimeline"
                :key="idx"
                class="timeline-item"
              >
                <div class="timeline-date">{{ item.date }}</div>
                <div class="timeline-card">
                  <div class="timeline-card-header">
                    <span class="tag tag--info">{{ item.type }}</span>
                    <span class="timeline-topic">{{ item.topic }}</span>
                  </div>
                  <div class="timeline-file">
                    <el-icon><Document /></el-icon>{{ item.fileName }}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 三、经济议题总清单 -->
          <section id="economic-items" class="report-section">
            <h2 class="section-title">三、经济议题总清单</h2>
            <p class="section-hint">
              按土地、资产、资金、项目、政策、担保/债务 6 大类分组；点击风险等级可查看对应分析卡片
            </p>
            <div
              v-for="group in report.economicItems || []"
              :key="group.category"
              class="economic-group"
            >
              <h3 class="group-title">
                {{ categoryLabel(group.category) }}（{{ group.items.length }} 项）
              </h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th width="56">序号</th>
                    <th>议题名称</th>
                    <th width="90">涉及会议</th>
                    <th width="100">金额(万元)</th>
                    <th width="130">相对方</th>
                    <th width="90">决策类型</th>
                    <th width="100">风险等级</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, rowIdx) in group.items"
                    :key="`${group.category}-${rowIdx}-${row.no}-${row.name}`"
                  >
                    <td class="cell-center">{{ row.no }}</td>
                    <td>{{ row.name }}</td>
                    <td>{{ row.meetings }}</td>
                    <td class="cell-right">{{ formatAmount(row.amount) }}</td>
                    <td>{{ row.counterparty }}</td>
                    <td>{{ row.decision }}</td>
                    <td class="cell-center">
                      <span
                        class="tag tag--link"
                        :class="getTagClass(row.riskFlag)"
                        :data-level="row.riskFlag"
                        :data-topic="row.name"
                        :data-finding="getFindingIdByTopic(row.name)"
                        @click="openDrawerByData($event)"
                        >{{ row.riskFlag }}</span
                      >
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- 四、风险分析(发现卡片，全部展开 + id 锚点) -->
          <section id="risk-findings" class="report-section">
            <h2 class="section-title">四、经济议题风险分析</h2>
            <p class="section-hint">
              每条发现含原文引用、风险模式匹配、法规依据及审计建议
            </p>
            <div
              v-for="finding in report.findings || []"
              :key="finding.id"
              :id="finding.id"
              class="finding-card-wrap"
            >
              <div class="finding-header">
                <span class="finding-id">{{ finding.id }}</span>
                <span :class="getTagClass(finding.level)">{{
                  finding.levelLabel || finding.level
                }}</span>
                <span class="finding-topic">{{ finding.topic }}</span>
              </div>
              <div class="finding-card">
                <div class="finding-row">
                  <span class="finding-label">经济议题</span>
                  <span
                    >{{ finding.topic }} | {{ categoryLabel(finding.category) }} |
                    {{ formatAmount(finding.amount) }} 万元</span
                  >
                </div>
                <div class="finding-row">
                  <span class="finding-label">匹配风险模式</span>
                  <span>{{ finding.riskPattern }}</span>
                </div>
                <div class="finding-row">
                  <span class="finding-label">来源</span>
                  <span>{{ finding.source }}</span>
                </div>
                <div class="finding-block">
                  <div class="finding-label">原文引用</div>
                  <blockquote class="finding-quote">
                    {{ finding.quote }}
                  </blockquote>
                </div>
                <div class="finding-block">
                  <div class="finding-label">经济事项事实</div>
                  <p>{{ finding.facts }}</p>
                </div>
                <div class="finding-block">
                  <div class="finding-label">风险分析</div>
                  <p>{{ finding.analysis }}</p>
                </div>
                <div class="finding-block">
                  <div class="finding-label">法规依据</div>
                  <ul class="regulation-list">
                    <li
                      v-for="(reg, idx) in finding.regulations || []"
                      :key="idx"
                    >
                      {{ reg }}
                    </li>
                  </ul>
                </div>
                <div class="finding-row">
                  <span class="finding-label">跨会议追踪</span>
                  <span>{{ finding.crossMeeting }}</span>
                </div>
                <div class="finding-row">
                  <span class="finding-label">定级理由</span>
                  <span>{{ finding.levelReason }}</span>
                </div>
                <div class="finding-block finding-suggestion">
                  <div class="finding-label">审计建议</div>
                  <p>{{ finding.suggestion }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- 五、跨会议追踪 -->
          <section id="cross-meeting" class="report-section">
            <h2 class="section-title">五、跨会议经济事项追踪</h2>
            <p class="section-hint">
              追踪金额变化、决策反复、化整为零等跨会议风险
            </p>
            <div v-if="(report.crossMeetingTracks || []).length > 0">
              <div
                v-for="(track, idx) in report.crossMeetingTracks"
                :key="idx"
                class="track-card"
              >
                <div class="track-header">
                  <span class="track-name">{{ track.itemName }}</span>
                  <span class="tag tag--info">{{
                    categoryLabel(track.category)
                  }}</span>
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th width="110">会议日期</th>
                      <th width="120">会议类型</th>
                      <th width="100">金额(万元)</th>
                      <th width="100">决策内容</th>
                      <th>会议纪要原文</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, j) in track.chain || []"
                      :key="j"
                    >
                      <td>{{ row.date }}</td>
                      <td>{{ row.meeting }}</td>
                      <td class="cell-right">
                        {{ formatAmount(row.amount) }}
                      </td>
                      <td>{{ row.decision }}</td>
                      <td class="cell-content">
                        {{ row.topicContent || '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div class="track-issues">
                  <span class="finding-label">追踪疑点</span>
                  <ul>
                    <li
                      v-for="(issue, k) in track.issues || []"
                      :key="k"
                    >
                      {{ issue }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div v-else class="summary-block">
              <p
                class="summary-text"
                style="margin: 0; color: #909399;"
              >
                本报告未识别到跨会议异常追踪项（暂无金额变化、决策反复、化整为零等风险）。
              </p>
            </div>
          </section>

          <!-- 六、风险事项总表(三级排序 + 分组小标题) -->
          <section id="risk-summary" class="report-section">
            <h2 class="section-title">六、风险事项总表</h2>
            <div class="risk-stats">
              <!-- 3 档体系(高危/中危/无风险);旧 4 档 key(levelMediumLow/levelLow)自动合并 -->
              <div class="stat-item stat-item--danger">
                <div class="stat-value">
                  {{ (report.overview?.riskStats?.levelHigh || 0) + (report.overview?.riskStats?.levelA || 0) }}
                </div>
                <div class="stat-label">高危</div>
              </div>
              <div class="stat-item stat-item--warning">
                <div class="stat-value">
                  {{
                    (report.overview?.riskStats?.levelMedium || 0) +
                    (report.overview?.riskStats?.levelB || 0) +
                    (report.overview?.riskStats?.levelMediumLow || 0) +
                    (report.overview?.riskStats?.levelC || 0)
                  }}
                </div>
                <div class="stat-label">中危</div>
              </div>
              <div class="stat-item stat-item--none">
                <div class="stat-value">
                  {{
                    (report.overview?.riskStats?.levelLow || 0) +
                    (report.overview?.riskStats?.levelD || 0) +
                    (report.overview?.riskStats?.levelNone || 0)
                  }}
                </div>
                <div class="stat-label">无风险</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">
                  {{ report.overview?.findingCount || 0 }}
                </div>
                <div class="stat-label">发现合计</div>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th width="110">发现编号</th>
                  <th>经济议题</th>
                  <th width="100">类别</th>
                  <th width="150">风险模式</th>
                  <th width="80">等级</th>
                  <th width="120">来源会议</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIdx) in report.riskSummary || []" :key="row.id || rowIdx">
                  <td>{{ row.id }}</td>
                  <td>{{ row.topic }}</td>
                  <td>{{ categoryLabel(row.category) }}</td>
                  <td>{{ row.pattern }}</td>
                  <td class="cell-center">
                    <span
                      class="tag tag--link"
                      :class="getTagClass(row.level)"
                      :data-level="row.level"
                      :data-topic="row.topic"
                      :data-finding="row.id"
                      @click="openDrawerByData($event)"
                      >{{ row.level }}</span
                    >
                  </td>
                  <td>{{ row.meeting }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- 七、审计结论与建议 -->
          <section id="conclusion" class="report-section">
            <h2 class="section-title">七、审计结论与建议</h2>
            <div class="summary-block">
              <div class="block-label">审计结论</div>
              <p class="summary-text">{{ report.conclusion?.text || '' }}</p>
            </div>
            <h3 class="group-title">分项整改建议</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th width="110">发现编号</th>
                  <th>审计建议</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(s, i) in report.conclusion?.suggestions || []"
                  :key="i"
                >
                  <td>{{ s.findingId }}</td>
                  <td>{{ s.text }}</td>
                </tr>
              </tbody>
            </table>
          </section>
          <!-- 附录节点已删除(后端 /risk-report/export 同步) -->
        </div>
      </div>
    </div>

    <!-- 风险详情抽屉（覆盖在 panel-card 之上） -->
    <div
      id="risk-mask"
      :class="{ 'is-open': drawerOpen }"
      @click="closeDrawer"
    ></div>
    <aside
      id="risk-drawer"
      :class="{ 'is-open': drawerOpen }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-drawer-title"
    >
      <header id="risk-drawer-head">
        <div id="risk-drawer-title">
          <span class="id-badge" :class="drawerBadgeClass">
            {{ drawerFindingId || '—' }}
          </span>
          <span class="topic-text" id="risk-drawer-topic">
            {{ drawerTopic || '风险详情' }}
          </span>
        </div>
        <button
          id="risk-drawer-close"
          type="button"
          aria-label="关闭弹窗"
          @click="closeDrawer"
        >
          ×
        </button>
      </header>
      <div id="risk-drawer-body">
        <!-- 命中 finding → 渲染完整卡片 -->
        <div
          v-if="drawerFinding && drawerFinding.id === drawerFindingId"
          class="finding-card-wrap"
        >
          <div class="finding-header">
            <span class="finding-id">{{ drawerFinding.id }}</span>
            <span :class="getTagClass(drawerFinding.level)">{{
              drawerFinding.levelLabel || drawerFinding.level
            }}</span>
            <span class="finding-topic">{{ drawerFinding.topic }}</span>
          </div>
          <div class="finding-card">
            <div class="finding-row">
              <span class="finding-label">经济议题</span>
              <span
                >{{ drawerFinding.topic }} |
                {{ categoryLabel(drawerFinding.category) }} |
                {{ formatAmount(drawerFinding.amount) }} 万元</span
              >
            </div>
            <div class="finding-row">
              <span class="finding-label">匹配风险模式</span>
              <span>{{ drawerFinding.riskPattern }}</span>
            </div>
            <div class="finding-row">
              <span class="finding-label">来源</span>
              <span>{{ drawerFinding.source }}</span>
            </div>
            <div class="finding-block">
              <div class="finding-label">原文引用</div>
              <blockquote class="finding-quote">
                {{ drawerFinding.quote }}
              </blockquote>
            </div>
            <div class="finding-block">
              <div class="finding-label">经济事项事实</div>
              <p>{{ drawerFinding.facts }}</p>
            </div>
            <div class="finding-block">
              <div class="finding-label">风险分析</div>
              <p>{{ drawerFinding.analysis }}</p>
            </div>
            <div class="finding-block">
              <div class="finding-label">法规依据</div>
              <ul class="regulation-list">
                <li
                  v-for="(reg, idx) in drawerFinding.regulations || []"
                  :key="idx"
                >
                  {{ reg }}
                </li>
              </ul>
            </div>
            <div class="finding-row">
              <span class="finding-label">跨会议追踪</span>
              <span>{{ drawerFinding.crossMeeting }}</span>
            </div>
            <div class="finding-row">
              <span class="finding-label">定级理由</span>
              <span>{{ drawerFinding.levelReason }}</span>
            </div>
            <div class="finding-block finding-suggestion">
              <div class="finding-label">审计建议</div>
              <p>{{ drawerFinding.suggestion }}</p>
            </div>
          </div>
        </div>
        <!-- 未命中 finding → 显示占位说明 -->
        <div
          v-else
          class="no-finding"
          :class="`no-finding--${drawerLevelClass}`"
        >
          <div class="no-finding-icon">{{ drawerIcon }}</div>
          <h4>{{ drawerEmptyTitle }}</h4>
          <p v-html="drawerEmptyDesc"></p>
          <span class="topic-quote">{{ drawerTopic }}</span>
        </div>
      </div>
      <footer id="risk-drawer-foot">
        <a
          v-if="drawerFinding"
          :href="`#${drawerFinding.id}`"
          id="risk-drawer-jump"
          @click.prevent="jumpToFinding"
          >在原页面查看完整风险分析 →</a
        >
        <a v-else style="display: none"></a>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from 'vue'
import {
  Warning,
  Download,
  Document,
  Refresh,
  Search,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ECONOMIC_CATEGORY_MAP, mockRiskReport } from '../riskAnalysisMockData.js'
import {
  normalizeRiskReport,
} from '../riskLevelUtils.js'

const props = defineProps({
  analysisId: { type: String, default: '' },
  riskReport: { type: Object, default: null },
  riskLoading: { type: Boolean, default: false },
  riskError: { type: String, default: '' },
  taskDetailMode: { type: Boolean, default: false },
})

const emit = defineEmits(['refresh', 'regenerate', 'export'])

// 7 章节,附录已按需求删除
const sections = [
  { id: 'overview', title: '一、基本情况' },
  { id: 'timeline', title: '二、会议时间线' },
  { id: 'economic-items', title: '三、经济议题总清单' },
  { id: 'risk-findings', title: '四、风险分析' },
  { id: 'cross-meeting', title: '五、跨会议追踪' },
  { id: 'risk-summary', title: '六、风险事项总表' },
  { id: 'conclusion', title: '七、审计结论与建议' },
]

const wrapperRef = ref(null)
const activeSection = ref('overview')
const timelineSearchKeyword = ref('')

// 抽屉状态
const drawerOpen = ref(false)
const drawerFindingId = ref('')
const drawerTopic = ref('')
const drawerLevel = ref('')

const report = computed(() => {
  if (props.riskReport) return normalizeRiskReport(props.riskReport)
  if (props.analysisId) return null
  return normalizeRiskReport(mockRiskReport)
})

const hasRealReport = computed(() => !!props.riskReport)

// 工具函数
const categoryLabel = (cat) =>
  ECONOMIC_CATEGORY_MAP[(cat || '').toUpperCase()] || cat || '—'

function getTagClass(level) {
  const map = {
    高危: 'tag tag--danger',
    中危: 'tag tag--warning',
    无风险: 'tag tag--none',
    // 旧等级(2026-07 之前)兼容
    中低危: 'tag tag--warning',
    低危: 'tag tag--none',
    中低微: 'tag tag--warning',
    低微: 'tag tag--none',
  }
  return map[level] || 'tag tag--info'
}

function formatAmount(v) {
  if (v == null || v === '') return '—'
  const num = Number(v)
  if (Number.isNaN(num)) return String(v)
  if (Number.isInteger(num)) return num.toLocaleString()
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

// finding 主题前缀 → finding id 的映射,用于点击 economicItems 风险等级弹出抽屉
const findingTopicMap = computed(() => {
  const m = {}
  for (const f of report.value?.findings || []) {
    const topic = String(f.topic || '').split('|')[0].trim()
    if (topic) m[topic] = f.id
  }
  return m
})

function getFindingIdByTopic(topic) {
  return findingTopicMap.value[topic] || ''
}

// 时间线搜索过滤
const filteredTimeline = computed(() => {
  const list = report.value?.timeline || []
  const keyword = timelineSearchKeyword.value.trim().toLowerCase()
  if (!keyword) return list
  return list.filter((item) => {
    const text = [item.date, item.type, item.topic, item.fileName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return text.includes(keyword)
  })
})

// 抽屉关联数据
const drawerFinding = computed(() => {
  if (!report.value?.findings || !drawerFindingId.value) return null
  return report.value.findings.find((f) => f.id === drawerFindingId.value)
})

const drawerBadgeClass = computed(() => {
  const map = {
    高危: 'id-badge id-badge--danger',
    中危: 'id-badge id-badge--warning',
    无风险: 'id-badge id-badge--none',
    // 旧等级兼容(2026-07 之前)
    中低危: 'id-badge id-badge--warning',
    低危: 'id-badge id-badge--none',
    中低微: 'id-badge id-badge--warning',
    低微: 'id-badge id-badge--none',
  }
  return map[drawerLevel.value] || 'id-badge'
})

const drawerLevelClass = computed(() => {
  const map = {
    高危: 'danger',
    中危: 'warning',
    无风险: 'none',
    // 旧等级兼容
    中低危: 'warning',
    低危: 'none',
    中低微: 'warning',
    低微: 'none',
  }
  return map[drawerLevel.value] || 'info'
})

const drawerIcon = computed(() => {
  const map = {
    高危: '!',
    中危: '○',
    无风险: '✓',
    // 旧等级兼容
    中低危: '○',
    低危: '✓',
    中低微: '○',
    低微: '✓',
  }
  return map[drawerLevel.value] || '?'
})

const drawerEmptyTitle = computed(() => {
  const lvl = drawerLevel.value
  const map = {
    高危: '本议题未找到详细分析卡片',
    中危: '本议题未触发详细分析',
    无风险: '本议题无风险',
    // 旧等级兼容
    中低危: '本议题未触发详细分析',
    低危: '本议题无风险',
    中低微: '本议题未触发详细分析',
    低微: '本议题无风险',
  }
  return map[lvl] || '本议题暂无分析记录'
})

const drawerEmptyDesc = computed(() => {
  const lvl = drawerLevel.value
  const map = {
    高危: `该议题被标记为 <b>${lvl}</b>，但未在风险分析章节找到对应记录，请检查数据完整性。`,
    中危: `该议题风险等级为 <b>${lvl}</b>，系统未生成详细风险分析记录（可能因触发规则未命中或未达到分析阈值）。`,
    无风险: `该议题风险等级为 <b>${lvl}</b>，无需展开风险分析。`,
    // 旧等级兼容(2026-07 之前)显示文案统一为新等级
    中低危: `该议题风险等级为 <b>中危</b>，系统未生成详细风险分析记录。`,
    低危: `该议题风险等级为 <b>无风险</b>，无需展开风险分析。`,
    中低微: `该议题风险等级为 <b>中危</b>，系统未生成详细风险分析记录。`,
    低微: `该议题风险等级为 <b>无风险</b>，无需展开风险分析。`,
  }
  return map[lvl] || '该议题未生成详细风险分析记录。'
})

// 滚动联动:IntersectionObserver
let observer = null
function scrollToSection(id) {
  const root = wrapperRef.value
  if (!root) {
    activeSection.value = id
    return
  }
  const el = root.querySelector(`#${id}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeSection.value = id
}

onMounted(() => {
  nextTick(() => {
    const root = wrapperRef.value
    if (!root || typeof IntersectionObserver === 'undefined') return
    const sections = root.querySelectorAll('section.report-section[id]')
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          visible.sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          )
          activeSection.value = visible[0].target.id
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )
    sections.forEach((s) => observer.observe(s))
  })
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  document.removeEventListener('keydown', onKeydown)
})

function onKeydown(e) {
  if (e.key === 'Escape' && drawerOpen.value) closeDrawer()
}

// 抽屉交互
function openDrawerByData(event) {
  const target = event.currentTarget
  if (!target) return
  openDrawer(
    target.getAttribute('data-finding') || '',
    target.getAttribute('data-topic') || '',
    target.getAttribute('data-level') || '',
  )
}

function openDrawer(findingId, topic, level) {
  drawerFindingId.value = findingId || ''
  drawerTopic.value = topic || '风险详情'
  drawerLevel.value = level || ''
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

function jumpToFinding() {
  const findingId = drawerFindingId.value
  closeDrawer()
  if (!findingId) return
  nextTick(() => {
    const root = wrapperRef.value
    if (!root) return
    const el = root.querySelector(`#${CSS.escape(findingId)}`)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 12
    window.scrollTo({ top, behavior: 'smooth' })
  })
}

function handleExport() {
  if (!hasRealReport.value) {
    ElMessage.warning('暂无真实报告可导出,请先生成风险分析')
    return
  }
  emit('export')
}

async function handleRegenerate() {
  if (!props.analysisId) {
    ElMessage.warning('请先选择分析批次')
    return
  }
  try {
    await ElMessageBox.confirm(
      '重新分析将覆盖现有风险报告,是否继续?',
      '确认重新分析',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  emit('regenerate')
}

watch(
  () => props.riskReport,
  () => {
    timelineSearchKeyword.value = ''
    activeSection.value = 'overview'
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.risk-analysis-panel {
  height: 100%;
  padding: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.panel-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.risk-report-loading-placeholder {
  flex: 1;
  min-height: 320px;
}

// ============ 工具栏 ============
.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;

  .el-icon {
    font-size: 16px;
    color: #e6a23c;
  }

  .toolbar-title {
    margin-left: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .el-tag {
    margin-left: 8px;
  }
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
  padding: 48px 16px;
}

.error-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f56c6c;
  padding: 32px 16px;
}

// ============ 报告主体(连续滚动布局,与导出模板 1:1) ============
.report-page {
  flex: 1;
  min-height: 0;
  display: flex;
}

.report-nav {
  width: 168px;
  flex-shrink: 0;
  background: #fafafa;
  border-right: 1px solid #e4e7ed;
  padding: 16px 0;
  overflow-y: auto;

  .nav-item {
    display: block;
    padding: 10px 12px;
    font-size: 12px;
    color: #606266;
    text-decoration: none;
    border-left: 3px solid transparent;
    line-height: 1.4;
    cursor: pointer;

    &:hover {
      color: #409eff;
      background: #f0f7ff;
    }
  }

  .nav-item--active {
    color: #409eff;
    font-weight: 600;
    background: #ecf5ff;
    border-left-color: #409eff;
  }
}

.report-wrapper {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 24px 28px 32px;
  background: #fff;
}

.report-header {
  border-bottom: 2px solid #409eff;
  padding-bottom: 16px;
  margin-bottom: 24px;

  h1 {
    margin: 0 0 8px;
    font-size: 22px;
    color: #303133;
  }

  .subtitle {
    margin: 0;
    font-size: 13px;
    color: #909399;
  }
}

.report-section {
  margin-bottom: 32px;
  scroll-margin-top: 16px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  border-left: 4px solid #409eff;
  padding-left: 10px;
}

.section-hint {
  margin: 0 0 16px;
  font-size: 12px;
  color: #909399;
}

.meta-row {
  margin-bottom: 12px;
  font-size: 12px;
  color: #909399;

  span {
    margin-right: 16px;
  }
}

// ============ 表格 ============
.info-table,
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  font-size: 13px;
}

.info-table th,
.info-table td,
.data-table th,
.data-table td {
  border: 1px solid #ebeef5;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.info-table th,
.data-table th {
  background: #f5f7fa;
  font-weight: 600;
  color: #606266;
}

.cell-center {
  text-align: center;
}

.cell-right {
  text-align: right;
}

// ============ 摘要块 ============
.summary-block {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px 14px;
}

.block-label {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.summary-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
}

// ============ 风险标签(5 档配色,可点击=tag--link) ============
.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
}

.tag-gap {
  margin-left: 6px;
}

.tag--danger {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fbc4c4;
}

.tag--warning {
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #f5dab1;
}

.tag--success {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #c2e7b0;
}

.tag--info {
  background: #f4f4f5;
  color: #909399;
  border: 1px solid #d3d4d6;
}

// 无风险档:浅蓝(3 档体系下,无风险 = 低危 + 原来的"无命中",用主色浅蓝突出"无风险"性质)
.tag--none {
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #d9ecff;
}

.tag--link {
  text-decoration: none;
  cursor: pointer;
  display: inline-block;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  }

  &::after {
    content: ' 🔍';
    font-size: 10px;
    opacity: 0.55;
    margin-left: 2px;
  }
}

// ============ 时间线 ============
.timeline-search {
  margin-bottom: 16px;
  max-width: 420px;

  :deep(.el-input__wrapper) {
    background: #fff;
  }
}

.timeline-list {
  padding-left: 0;
}

.timeline-item {
  display: flex;
  margin-bottom: 16px;
}

.timeline-date {
  width: 100px;
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
  padding-top: 4px;
}

.timeline-card {
  flex: 1;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fafafa;
}

.timeline-card-header {
  margin-bottom: 6px;
}

.timeline-topic {
  margin-left: 8px;
  font-weight: 500;
  font-size: 13px;
}

.timeline-file {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #909399;

  .el-icon {
    margin-right: 4px;
  }
}

// ============ 经济议题分组 ============
.economic-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
}

// ============ 风险发现卡片 ============
.finding-card-wrap {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-bottom: 16px;
  overflow: hidden;
  scroll-margin-top: 16px;
}

.finding-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
}

.finding-id {
  font-family: monospace;
  font-weight: 600;
  color: #409eff;
  margin-right: 8px;
}

.finding-topic {
  margin-left: 8px;
  font-size: 13px;
}

.finding-card {
  padding: 12px 14px;
  font-size: 13px;
}

.finding-row {
  margin-bottom: 10px;
  display: flex;
}

.finding-label {
  flex-shrink: 0;
  width: 100px;
  font-size: 12px;
  font-weight: 600;
  color: #909399;
}

.finding-block {
  margin-bottom: 12px;

  p {
    margin: 4px 0 0;
  }
}

.finding-quote {
  margin: 6px 0 0;
  padding: 10px 12px;
  background: #f5f7fa;
  border-left: 3px solid #e6a23c;
  font-size: 13px;
  color: #606266;
}

.regulation-list {
  margin: 4px 0 0;
  padding-left: 18px;

  li {
    margin-bottom: 4px;
  }
}

.finding-suggestion {
  background: #fdf6ec;
  border-radius: 4px;
  padding: 10px 12px;
}

// ============ 跨会议追踪 ============
.track-card {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.track-header {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

.track-name {
  font-weight: 600;
  font-size: 14px;
  margin-right: 8px;
}

.track-issues {
  ul {
    margin: 4px 0 0;
    padding-left: 18px;
    font-size: 13px;
    color: #e6a23c;
  }
}

// ============ 风险事项总表(统计 + 三级排序 + 分组小标题) ============
.risk-stats {
  display: flex;
  margin-bottom: 16px;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-right: 12px;

  &:last-child {
    margin-right: 0;
  }
}

.stat-item--danger .stat-value {
  color: #f56c6c;
}

.stat-item--warning .stat-value {
  color: #e6a23c;
}

// 3 档体系下的"无风险"stat-item:浅蓝(主色)
.stat-item--none .stat-value {
  color: #409eff;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #409eff;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

// ============ 风险抽屉(与导出模板 1:1) ============
#risk-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 9000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

#risk-mask.is-open {
  opacity: 1;
  pointer-events: auto;
}

#risk-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 640px;
  max-width: 92vw;
  height: 100vh;
  background: #fff;
  z-index: 9100;
  box-shadow: -6px 0 28px rgba(0, 0, 0, 0.15);
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

#risk-drawer.is-open {
  transform: translateX(0);
}

#risk-drawer-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
  background: #fafbfc;
}

#risk-drawer-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.id-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-family: Menlo, Consolas, monospace;
  flex: 0 0 auto;
  background: #ecf5ff;
  color: #409eff;
}

.id-badge--danger {
  background: #fef0f0;
  color: #f56c6c;
}

.id-badge--warning {
  background: #fdf6ec;
  color: #e6a23c;
}

.id-badge--success {
  background: #f0f9eb;
  color: #67c23a;
}

// 3 档体系下的"无风险"id-badge:浅蓝(主色)
.id-badge--none {
  background: #ecf5ff;
  color: #409eff;
}

#risk-drawer-title .topic-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
}

#risk-drawer-close {
  background: none;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  color: #909399;
  font-size: 22px;
  line-height: 1;
  flex: 0 0 auto;
  transition: background 0.15s;

  &:hover {
    background: #f4f4f5;
    color: #303133;
  }
}

#risk-drawer-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

#risk-drawer-foot {
  flex: 0 0 auto;
  padding: 12px 20px;
  border-top: 1px solid #ebeef5;
  background: #fafbfc;
  text-align: right;

  a {
    color: #409eff;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }
}

// 抽屉 body 内嵌的 finding-card-wrap 不要外边距
#risk-drawer-body .finding-card-wrap {
  margin: 0;

  .finding-header {
    margin-top: 0;
  }
}

// 抽屉"无对应分析"占位
.no-finding {
  text-align: center;
  padding: 40px 16px;

  .no-finding-icon {
    width: 56px;
    height: 56px;
    line-height: 56px;
    margin: 0 auto 12px;
    border-radius: 50%;
    font-size: 28px;
    font-weight: 700;
    color: #fff;
  }

  h4 {
    margin: 0 0 6px;
    font-size: 15px;
    color: #303133;
  }

  p {
    margin: 0 0 16px;
    font-size: 13px;
    color: #606266;
    line-height: 1.7;
  }

  .topic-quote {
    display: inline-block;
    padding: 8px 14px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 12px;
    color: #606266;
    max-width: 100%;
    word-break: break-all;
  }

  /* 跨会议追踪表「会议纪要原文」列:长原文自动换行,不撑高表格行 */
  .cell-content {
    word-break: break-all;
    max-width: 480px;
    line-height: 1.6;
    color: #606266;
  }
}

.no-finding--danger .no-finding-icon {
  background: #f56c6c;
}

.no-finding--warning .no-finding-icon {
  background: #e6a23c;
}

.no-finding--success .no-finding-icon {
  background: #67c23a;
}

.no-finding--info .no-finding-icon {
  background: #909399;
}

@media (max-width: 768px) {
  #risk-drawer {
    width: 100vw;
    max-width: 100vw;
  }
}
</style>
