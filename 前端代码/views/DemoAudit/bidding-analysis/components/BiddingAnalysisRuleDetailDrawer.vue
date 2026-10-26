<template>
  <el-drawer
    v-model="visible"
    :title="ruleItem ? ruleItem.ruleName : '规则详情'"
    size="560px"
    destroy-on-close
    class="bidding-rule-detail-drawer"
    @close="handleClose"
  >
    <template v-if="ruleItem">
      <div class="bidding-detail-tags">
        <el-tag :type="riskMeta.tagType" size="small" :style="riskTagStyle">
          {{ riskMeta.label }}
        </el-tag>
        <el-tag
          v-for="cat in ruleItem.categories"
          :key="cat"
          size="small"
          :style="getCategoryStyle(cat)"
        >
          {{ cat }}
        </el-tag>
        <span class="bidding-detail-confidence">{{ ruleItem.confidence }}% 置信度</span>
      </div>

      <h3 class="bidding-detail-title">{{ ruleItem.title }}</h3>
      <div class="bidding-detail-subtitle">{{ ruleItem.ruleName }}</div>

      <div class="bidding-detail-metrics">
        <div class="bidding-detail-metric">
          <div class="bidding-detail-metric-label">风险等级</div>
          <div class="bidding-detail-metric-value">{{ riskMeta.label }}</div>
        </div>
        <div class="bidding-detail-metric">
          <div class="bidding-detail-metric-label">结果分类</div>
          <div class="bidding-detail-metric-value">{{ ruleItem.categories.join('、') }}</div>
        </div>
        <div class="bidding-detail-metric">
          <div class="bidding-detail-metric-label">涉及单位</div>
          <div class="bidding-detail-metric-value">{{ involvedUnitCount }}</div>
        </div>
        <div class="bidding-detail-metric">
          <div class="bidding-detail-metric-label">原文证据</div>
          <div class="bidding-detail-metric-value">{{ getRuleEvidenceCount(ruleItem) }}</div>
        </div>
      </div>

      <div class="bidding-detail-section">
        <div class="bidding-detail-section-title">结果描述</div>
        <p class="bidding-detail-section-text">{{ ruleItem.detailDescription }}</p>
      </div>

      <div class="bidding-detail-section">
        <div class="bidding-detail-section-title">智能分析结果</div>
        <div
          class="bidding-detail-ai-banner"
          :class="`bidding-detail-ai-banner--${ruleItem.aiRiskLevel}`"
        >
          风险等级 {{ aiRiskLabel }}
        </div>

        <div
          v-for="item in aiAnalysisItems"
          :key="item.index"
          class="bidding-detail-ai-item"
        >
          <div class="bidding-detail-ai-item-head">
            <span class="bidding-detail-ai-index">{{ item.index }}</span>
            <el-tag :type="getRiskTagType(item.riskLevel)" size="small" :style="getRiskTagStyle(item.riskLevel)">
              {{ getRiskLabel(item.riskLevel) }}
            </el-tag>
            <span class="bidding-detail-ai-item-title">{{ item.title }}</span>
          </div>
          <p class="bidding-detail-ai-item-summary">{{ item.summary }}</p>

          <div v-if="item.involvedUnits && item.involvedUnits.length" class="bidding-detail-ai-block">
            <div class="bidding-detail-ai-block-label">涉及单位</div>
            <div class="bidding-detail-ai-tags">
              <el-tag
                v-for="unit in item.involvedUnits"
                :key="unit"
                size="small"
                type="info"
                effect="plain"
              >
                {{ unit }}
              </el-tag>
            </div>
          </div>

          <div v-if="item.judgmentBasis" class="bidding-detail-ai-block">
            <div class="bidding-detail-ai-block-label">判断依据</div>
            <p class="bidding-detail-ai-block-text">{{ item.judgmentBasis }}</p>
          </div>

          <div v-if="item.reasonableExplanation" class="bidding-detail-ai-block">
            <div class="bidding-detail-ai-block-label">可能的合理解释</div>
            <p class="bidding-detail-ai-block-text">{{ item.reasonableExplanation }}</p>
          </div>

          <div v-if="item.inspectionItems && item.inspectionItems.length" class="bidding-detail-ai-block">
            <div class="bidding-detail-ai-block-label">建议核查事项</div>
            <ul class="bidding-detail-ai-list">
              <li v-for="(text, idx) in item.inspectionItems" :key="idx">{{ text }}</li>
            </ul>
          </div>

          <div v-if="item.keyEvidence && item.keyEvidence.length" class="bidding-detail-ai-block">
            <div class="bidding-detail-ai-block-label">关键证据</div>
            <div
              v-for="(ev, idx) in item.keyEvidence"
              :key="idx"
              class="bidding-detail-key-evidence"
            >
              <el-tag size="small" type="primary" effect="plain">{{ ev.unit }}</el-tag>
              <span class="bidding-detail-key-evidence-text">{{ ev.detail }}</span>
            </div>
          </div>
        </div>

        <div v-if="!aiAnalysisItems.length" class="bidding-detail-ai-fallback">
          <div class="bidding-detail-ai-body">
            <el-icon
              v-if="ruleItem.aiRiskLevel === 'none'"
              class="bidding-detail-ai-icon bidding-detail-ai-icon--success"
            >
              <CircleCheck />
            </el-icon>
            <el-icon v-else class="bidding-detail-ai-icon bidding-detail-ai-icon--warn">
              <Warning />
            </el-icon>
            <div class="bidding-detail-ai-text">
              <div class="bidding-detail-ai-main">
                {{ ruleItem.aiRiskLevel === 'none' ? '未发现异常' : '存在需关注项' }}
              </div>
              <div class="bidding-detail-ai-sub">{{ ruleItem.aiSummary }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="ruleItem.evidenceList && ruleItem.evidenceList.length" class="bidding-detail-section">
        <div class="bidding-detail-section-title">原文溯源</div>
        <p class="bidding-detail-section-tip">
          下列证据按证据片段分组展示，可用于定位相同或高度相似内容在两份文件中的位置。
        </p>
        <div
          v-for="(ev, index) in ruleItem.evidenceList"
          :key="index"
          class="bidding-detail-evidence-item"
        >
          <el-tag size="small" type="primary" effect="plain">{{ ev.unit }}</el-tag>
          <span class="bidding-detail-evidence-loc">{{ ev.location }}</span>
          <p v-if="ev.detail" class="bidding-detail-evidence-detail">{{ ev.detail }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleClose">确定</el-button>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { CircleCheck, Warning } from '@element-plus/icons-vue'
import { RISK_LEVEL_MAP, CATEGORY_TAG_COLORS, getRuleEvidenceCount } from '../mock/biddingAnalysisResultMock.js'

defineOptions({ name: 'BiddingAnalysisRuleDetailDrawer' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  ruleItem: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const riskMeta = computed(() => {
  if (!props.ruleItem) return RISK_LEVEL_MAP.none
  return RISK_LEVEL_MAP[props.ruleItem.riskLevel] || RISK_LEVEL_MAP.none
})

const aiRiskLabel = computed(() => {
  if (!props.ruleItem) return ''
  return RISK_LEVEL_MAP[props.ruleItem.aiRiskLevel]?.label || ''
})

const aiAnalysisItems = computed(() => props.ruleItem?.aiAnalysisItems || [])

const involvedUnitCount = computed(() => {
  if (!props.ruleItem?.involvedUnits) return 0
  return props.ruleItem.involvedUnits.filter((u) => !String(u).startsWith('+')).length
})

const riskTagStyle = computed(() => {
  if (props.ruleItem?.riskLevel === 'low') {
    return { background: '#ecf5ff', color: '#409eff', border: 'none' }
  }
  return {}
})

const getCategoryStyle = (cat) => {
  const colors = CATEGORY_TAG_COLORS[cat] || { bg: '#f5f7fa', color: '#606266' }
  return { background: colors.bg, color: colors.color, border: 'none' }
}

const getRiskLabel = (level) => RISK_LEVEL_MAP[level]?.label || level
const getRiskTagType = (level) => RISK_LEVEL_MAP[level]?.tagType || 'info'

const getRiskTagStyle = (level) => {
  if (level === 'low') return { background: '#ecf5ff', color: '#409eff', border: 'none' }
  return {}
}

const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
.bidding-detail-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 12px;
}

.bidding-detail-tags > * + * {
  margin-left: 8px;
}

.bidding-detail-confidence {
  margin-left: auto;
  font-size: 13px;
  color: #909399;
}

.bidding-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 6px;
  line-height: 1.5;
}

.bidding-detail-subtitle {
  font-size: 13px;
  color: #909399;
  margin-bottom: 16px;
}

.bidding-detail-metrics {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.bidding-detail-metric {
  width: 50%;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #f5f7fa;
  border-radius: 6px;
  box-sizing: border-box;
}

.bidding-detail-metric:nth-child(odd) {
  padding-right: 6px;
}

.bidding-detail-metric:nth-child(even) {
  padding-left: 6px;
}

.bidding-detail-metric-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.bidding-detail-metric-value {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.bidding-detail-section {
  margin-bottom: 20px;
}

.bidding-detail-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.bidding-detail-section-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0;
}

.bidding-detail-section-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin: 0 0 10px;
}

.bidding-detail-ai-banner {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
}

.bidding-detail-ai-banner--none {
  background: #f0f9eb;
  color: #67c23a;
}

.bidding-detail-ai-banner--low {
  background: #f0f9eb;
  color: #67c23a;
  border-left: 4px solid #67c23a;
}

.bidding-detail-ai-banner--high {
  background: #fef0f0;
  color: #f56c6c;
  border-left: 4px solid #f56c6c;
}

.bidding-detail-ai-banner--medium {
  background: #fdf6ec;
  color: #e6a23c;
  border-left: 4px solid #e6a23c;
}

.bidding-detail-ai-item {
  padding: 14px;
  margin-bottom: 12px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.bidding-detail-ai-item-head {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.bidding-detail-ai-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-right: 8px;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 50%;
}

.bidding-detail-ai-item-title {
  margin-left: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.bidding-detail-ai-item-summary {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0 0 12px;
}

.bidding-detail-ai-block {
  margin-top: 10px;
}

.bidding-detail-ai-block-label {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 6px;
}

.bidding-detail-ai-block-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0;
}

.bidding-detail-ai-tags > .el-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.bidding-detail-ai-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.bidding-detail-key-evidence {
  display: flex;
  align-items: flex-start;
  margin-bottom: 6px;
}

.bidding-detail-key-evidence-text {
  margin-left: 8px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.bidding-detail-ai-fallback {
  margin-top: 4px;
}

.bidding-detail-ai-body {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.bidding-detail-ai-icon {
  font-size: 36px;
  flex-shrink: 0;
}

.bidding-detail-ai-icon--success {
  color: #67c23a;
}

.bidding-detail-ai-icon--warn {
  color: #e6a23c;
}

.bidding-detail-ai-text {
  margin-left: 12px;
}

.bidding-detail-ai-main {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.bidding-detail-ai-sub {
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
}

.bidding-detail-evidence-item {
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.bidding-detail-evidence-loc {
  margin-left: 8px;
  font-size: 13px;
  color: #606266;
}

.bidding-detail-evidence-detail {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
}
</style>
