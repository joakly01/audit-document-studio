<template>
  <div class="bidding-report-panel">
    <div class="bidding-report-toolbar">
      <div class="bidding-report-toolbar-left">
        <span class="bidding-report-toolbar-tip">报告内容根据当前分析结果自动整理</span>
      </div>
      <div class="bidding-report-toolbar-right">
        <el-button size="small" @click="handleCopySummary">复制摘要</el-button>
        <el-button type="primary" size="small" @click="handleExportHtml">导出报告</el-button>
      </div>
    </div>

    <div class="bidding-report-paper">
      <div class="bidding-report-header">
        <h3 class="bidding-report-title">招投标合规分析报告</h3>
        <div class="bidding-report-meta">
          <span>项目名称：{{ projectName }}</span>
          <span>分析时间：{{ reportTime }}</span>
          <span>分析模式：{{ analysisModeText }}</span>
        </div>
      </div>

      <section class="bidding-report-section">
        <div class="bidding-report-section-title">一、分析概况</div>
        <div class="bidding-report-summary-cards">
          <div
            v-for="item in summaryCards"
            :key="item.key"
            class="bidding-report-summary-card"
            :style="{ borderColor: item.color }"
          >
            <div class="bidding-report-summary-value" :style="{ color: item.color }">{{ item.count }}</div>
            <div class="bidding-report-summary-label">{{ item.label }}</div>
          </div>
        </div>
        <p class="bidding-report-overview-text">{{ overviewText }}</p>
      </section>

      <section
        v-for="section in riskSections"
        :key="section.key"
        class="bidding-report-section"
      >
        <div class="bidding-report-section-title">{{ section.orderTitle }}</div>
        <p class="bidding-report-section-intro">{{ section.intro }}</p>
        <el-empty v-if="!section.items.length" description="暂无相关风险项" :image-size="56" />
        <div
          v-for="(item, index) in section.items"
          :key="item.id"
          class="bidding-report-risk-item"
        >
          <div class="bidding-report-risk-head">
            <span class="bidding-report-risk-index">{{ index + 1 }}.</span>
            <el-tag :type="getRiskTagType(item.riskLevel)" size="small" :style="getRiskTagStyle(item.riskLevel)">
              {{ getRiskLabel(item.riskLevel) }}
            </el-tag>
            <span class="bidding-report-risk-title">{{ item.title }}</span>
          </div>
          <el-descriptions :column="2" border size="small" class="bidding-report-risk-meta">
            <el-descriptions-item label="规则">{{ item.ruleName }}</el-descriptions-item>
            <el-descriptions-item label="来源">{{ getDocTypeLabel(item.docType) }}</el-descriptions-item>
            <el-descriptions-item label="置信度">{{ item.confidence }}%</el-descriptions-item>
            <el-descriptions-item label="涉及单位">
              {{ item.docType === 'bidding' ? '—' : item.involvedUnits.join('、') }}
            </el-descriptions-item>
          </el-descriptions>
          <p class="bidding-report-risk-desc">{{ item.description }}</p>
          <p v-if="item.aiSummary && item.aiSummary !== item.description" class="bidding-report-risk-ai">
            <span class="bidding-report-risk-ai-label">智能分析：</span>{{ item.aiSummary }}
          </p>
          <div class="bidding-report-risk-actions">
            <el-button type="primary" link size="small" @click="$emit('view-detail', item)">查看详情</el-button>
            <el-button
              v-if="item.llmEvidence"
              type="primary"
              link
              size="small"
              @click="$emit('view-evidence', item)"
            >
              查看证据
            </el-button>
          </div>
        </div>
      </section>

      <section v-if="noneRiskItems.length" class="bidding-report-section">
        <div class="bidding-report-section-title">{{ noneSectionTitle }}</div>
        <p class="bidding-report-section-intro">以下检查项未发现明显风险，可作为合规参考。</p>
        <ul class="bidding-report-none-list">
          <li v-for="item in noneRiskItems" :key="item.id">
            <el-tag type="success" size="small" effect="plain">未发现风险</el-tag>
            <span class="bidding-report-none-title">{{ item.title }}</span>
            <span class="bidding-report-none-rule">（{{ item.ruleName }}）</span>
          </li>
        </ul>
      </section>

      <section class="bidding-report-section bidding-report-footer-note">
        <div class="bidding-report-section-title">报告说明</div>
        <p class="bidding-report-note-text">
          本报告由招投标分析系统自动生成，仅供审计核查参考。高风险及中风险事项建议结合原始文件与证据材料进一步核实；最终结论以人工复核为准。
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { RISK_LEVEL_MAP } from '../mock/biddingAnalysisResultMock.js'
import {
  buildReportModel,
  buildReportPlainText,
  buildReportHtml,
  downloadReportHtml,
  sanitizeReportFilename,
} from '../utils/biddingAnalysisReportExport.js'

defineOptions({ name: 'BiddingAnalysisReportPanel' })

const props = defineProps({
  project: { type: Object, required: true },
  ruleResults: { type: Array, default: () => [] },
  analysisModes: { type: Array, default: () => [] },
})

defineEmits(['view-detail', 'view-evidence'])

const reportModel = computed(() =>
  buildReportModel(props.project, props.ruleResults, props.analysisModes)
)

const projectName = computed(() => reportModel.value.projectName)

const reportTime = computed(() => reportModel.value.reportTime)

const analysisModeText = computed(() => reportModel.value.analysisModeText)

const sortedRuleResults = computed(() => reportModel.value.sortedRules)

const summaryCards = computed(() => reportModel.value.summaryCards)

const overviewText = computed(() => reportModel.value.overviewText)

const riskSections = computed(() => reportModel.value.riskSections)

const noneRiskItems = computed(() => reportModel.value.noneRiskItems)

const noneSectionTitle = computed(() => reportModel.value.noneSectionTitle)

const getRiskLabel = (level) => RISK_LEVEL_MAP[level]?.label || level
const getRiskTagType = (level) => RISK_LEVEL_MAP[level]?.tagType || 'info'

const getDocTypeLabel = (docType) => {
  if (docType === 'bidding') return '招标'
  if (docType === 'tender') return '投标'
  if (docType === 'joint') return '联合'
  return docType
}

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

const buildPlainTextSummary = () => buildReportPlainText(reportModel.value)

const handleCopySummary = async () => {
  if (!sortedRuleResults.value.length) {
    ElMessage.warning('暂无分析结果，无法复制报告摘要')
    return
  }
  try {
    await navigator.clipboard.writeText(buildPlainTextSummary())
    ElMessage.success('报告摘要已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动选择报告内容复制')
  }
}

const handleExportHtml = () => {
  if (!sortedRuleResults.value.length) {
    ElMessage.warning('暂无分析结果，无法导出报告')
    return
  }
  try {
    const html = buildReportHtml(reportModel.value)
    const filename = `${sanitizeReportFilename(projectName.value)}-招投标合规分析报告`
    downloadReportHtml(html, filename)
    ElMessage.success('报告已导出为 HTML 文件')
  } catch (err) {
    console.error('[BiddingAnalysisReport] export html failed', err)
    ElMessage.error('报告导出失败，请稍后重试')
  }
}
</script>

<style scoped>
.bidding-report-panel {
  padding-bottom: 8px;
}

.bidding-report-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 10px 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
}

.bidding-report-toolbar-left {
  display: flex;
  align-items: center;
}

.bidding-report-toolbar-left > * + * {
  margin-left: 8px;
}

.bidding-report-toolbar-tip {
  font-size: 12px;
  color: #909399;
}

.bidding-report-toolbar-right {
  display: flex;
  align-items: center;
}

.bidding-report-toolbar-right > * + * {
  margin-left: 8px;
}

.bidding-report-paper {
  padding: 24px 28px 32px;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.bidding-report-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--sd-ink, #161616);
  text-align: center;
}

.bidding-report-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 600;
  color: var(--sd-ink, #161616);
}

.bidding-report-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 13px;
  color: #606266;
}

.bidding-report-meta > * + * {
  margin-left: 24px;
}

.bidding-report-section {
  margin-bottom: 28px;
}

.bidding-report-section-title {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  padding-left: 8px;
  border-left: 3px solid var(--sd-primary, #195fb4);
  line-height: 1.4;
}

.bidding-report-section-intro,
.bidding-report-overview-text,
.bidding-report-note-text {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.7;
  color: #606266;
}

.bidding-report-summary-cards {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.bidding-report-summary-cards > * {
  margin-right: 12px;
  margin-bottom: 12px;
}

.bidding-report-summary-card {
  width: 120px;
  padding: 12px 10px;
  text-align: center;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  background: var(--sd-surface-1, #f4f4f4);
}

.bidding-report-summary-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.bidding-report-summary-label {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.bidding-report-risk-item {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  background: var(--sd-surface-1, #f4f4f4);
}

.bidding-report-risk-head {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.bidding-report-risk-head > * + * {
  margin-left: 8px;
}

.bidding-report-risk-index {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.bidding-report-risk-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.bidding-report-risk-meta {
  margin-bottom: 10px;
}

.bidding-report-risk-desc,
.bidding-report-risk-ai {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #606266;
}

.bidding-report-risk-ai-label {
  font-weight: 600;
  color: #303133;
}

.bidding-report-risk-actions > * + * {
  margin-left: 8px;
}

.bidding-report-none-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.bidding-report-none-list > li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.bidding-report-none-list > li > * + * {
  margin-left: 8px;
}

.bidding-report-none-title {
  color: #303133;
}

.bidding-report-none-rule {
  color: #909399;
}

.bidding-report-footer-note {
  margin-bottom: 0;
  padding-top: 8px;
  border-top: 1px dashed #dcdfe6;
}
</style>
