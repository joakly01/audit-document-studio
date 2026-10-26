<template>
  <div class="bidding-result-project-list bidding-analysis-result-theme">
    <div class="bidding-result-project-list-header">
      <div class="bidding-result-project-list-header-left">
        <el-button link type="primary" class="bidding-result-project-list-back" @click="$emit('back')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="bidding-result-project-list-title">分析结果</h2>
      </div>
      <span class="bidding-result-project-list-subtitle">
        共 {{ projects.length }} 个项目
        <template v-if="analysisModeLabel"> · {{ analysisModeLabel }}</template>
      </span>
    </div>

    <div v-if="projects.length" class="bidding-result-project-list-body">
      <div
        v-for="project in projects"
        :key="project.id"
        class="bidding-result-project-card"
        @click="$emit('select', project.id)"
      >
        <div class="bidding-result-project-card-top">
          <div class="bidding-result-project-card-title-wrap">
            <span class="bidding-result-project-card-name" :title="project.name">{{ project.name }}</span>
            <el-tag type="success" size="small" class="bidding-result-project-card-status">已完成</el-tag>
          </div>
          <div class="bidding-result-project-card-meta">
            <span v-if="showBiddingMeta">{{ formatBiddingFileLabel(project.biddingFileCount) }}</span>
            <span v-if="showBiddingMeta && showTenderMeta" class="bidding-result-project-card-meta-sep">·</span>
            <span v-if="showTenderMeta">{{ project.tenderCompanyCount }} 投标单位</span>
            <span class="bidding-result-project-card-meta-sep">·</span>
            <span>{{ getRuleResultCount(project) }} 条规则结果</span>
          </div>
        </div>

        <div class="bidding-result-project-card-risk-grid">
          <div class="bidding-result-project-card-risk-item bidding-result-project-card-risk-item--high">
            <span class="bidding-result-project-card-risk-num">{{ project.riskSummary.high }}</span>
            <span class="bidding-result-project-card-risk-label">高风险</span>
          </div>
          <div class="bidding-result-project-card-risk-item bidding-result-project-card-risk-item--medium">
            <span class="bidding-result-project-card-risk-num">{{ project.riskSummary.medium }}</span>
            <span class="bidding-result-project-card-risk-label">中风险</span>
          </div>
          <div class="bidding-result-project-card-risk-item bidding-result-project-card-risk-item--low">
            <span class="bidding-result-project-card-risk-num">{{ project.riskSummary.low }}</span>
            <span class="bidding-result-project-card-risk-label">低风险</span>
          </div>
          <div class="bidding-result-project-card-risk-item bidding-result-project-card-risk-item--none">
            <span class="bidding-result-project-card-risk-num">{{ project.riskSummary.none }}</span>
            <span class="bidding-result-project-card-risk-label">无风险</span>
          </div>
        </div>

        <div class="bidding-result-project-card-focus" :class="getFocusClass(project)">
          {{ getFocusText(project) }}
        </div>

        <div class="bidding-result-project-card-footer">
          <span class="bidding-result-project-card-time">分析时间 {{ project.analyzedAt || '—' }}</span>
          <span class="bidding-result-project-card-action">
            查看详情
            <el-icon><ArrowRight /></el-icon>
          </span>
        </div>
      </div>
    </div>
    <el-empty v-else description="暂无分析结果" :image-size="80" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import {
  getAnalysisModeLabelText,
  needsBiddingFiles,
  needsTenderFiles,
  normalizeAnalysisModes,
} from '../mock/biddingAnalysisTemplateMock.js'

defineOptions({ name: 'BiddingAnalysisResultProjectList' })

const props = defineProps({
  projects: { type: Array, default: () => [] },
  analysisModes: { type: Array, default: () => [] },
})

defineEmits(['back', 'select'])

const normalizedModes = computed(() => normalizeAnalysisModes(props.analysisModes))

const analysisModeLabel = computed(() => getAnalysisModeLabelText(normalizedModes.value))

const showBiddingMeta = computed(() => needsBiddingFiles(normalizedModes.value))

const showTenderMeta = computed(() => needsTenderFiles(normalizedModes.value))

const getRuleResultCount = (project) => {
  if (project.ruleResultCount != null) return project.ruleResultCount
  const summary = project.riskSummary || {}
  return (summary.high || 0) + (summary.medium || 0) + (summary.low || 0) + (summary.none || 0)
}

const formatBiddingFileLabel = (count) => {
  const n = count ?? 0
  if (n === 1) return '1 个招标文件'
  return `${n} 个招标文件`
}

const getFocusText = (project) => {
  const summary = project.riskSummary || {}
  if (summary.high > 0) return `待关注：高风险 ${summary.high} 条，建议优先复核`
  if (summary.medium > 0) return `待关注：中风险 ${summary.medium} 条，建议安排复核`
  if (summary.low > 0) return `提示：低风险 ${summary.low} 条，可按需查看`
  return '未发现明显风险，可按常规流程处理'
}

const getFocusClass = (project) => {
  const summary = project.riskSummary || {}
  if (summary.high > 0) return 'is-high'
  if (summary.medium > 0) return 'is-medium'
  if (summary.low > 0) return 'is-low'
  return 'is-none'
}
</script>

<style scoped>
.bidding-result-project-list {
  height: 100%;
  overflow-y: auto;
  padding: 0 12px 24px;
  background: var(--sd-surface-1, #f4f4f4);
  box-sizing: border-box;
}

.bidding-result-project-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.bidding-result-project-list-header-left {
  display: flex;
  align-items: center;
}

.bidding-result-project-list-header-left > * + * {
  margin-left: 12px;
}

.bidding-result-project-list-back {
  padding-left: 0;
}

.bidding-result-project-list-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--sd-ink, #161616);
}

.bidding-result-project-list-subtitle {
  font-size: 13px;
  color: #909399;
}

.bidding-result-project-list-body {
  display: flex;
  flex-wrap: wrap;
  margin: -10px;
}

.bidding-result-project-card {
  box-sizing: border-box;
  flex: 1 1 300px;
  max-width: calc(50% - 20px);
  min-width: 280px;
  margin: 10px;
  padding: 14px 16px;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.bidding-result-project-card:hover {
  border-color: var(--sd-primary, #195fb4);
  box-shadow: 0 2px 12px rgba(25, 95, 180, 0.12);
}

.bidding-result-project-card-top {
  margin-bottom: 12px;
}

.bidding-result-project-card-title-wrap {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
}

.bidding-result-project-card-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--sd-ink, #161616);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.bidding-result-project-card-status {
  flex-shrink: 0;
  margin-left: 8px;
}

.bidding-result-project-card-meta {
  font-size: 12px;
  line-height: 1.5;
  color: #909399;
}

.bidding-result-project-card-meta-sep {
  margin: 0 4px;
}

.bidding-result-project-card-risk-grid {
  display: flex;
  margin-bottom: 10px;
}

.bidding-result-project-card-risk-grid > * + * {
  margin-left: 8px;
}

.bidding-result-project-card-risk-item {
  flex: 1;
  min-width: 0;
  padding: 8px 4px;
  border-radius: 4px;
  text-align: center;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline-soft, #ebebeb);
}

.bidding-result-project-card-risk-num {
  display: block;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.bidding-result-project-card-risk-label {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.2;
}

.bidding-result-project-card-risk-item--high .bidding-result-project-card-risk-num,
.bidding-result-project-card-risk-item--high .bidding-result-project-card-risk-label {
  color: #f56c6c;
}

.bidding-result-project-card-risk-item--high {
  background: #fef0f0;
  border-color: #fde2e2;
}

.bidding-result-project-card-risk-item--medium .bidding-result-project-card-risk-num,
.bidding-result-project-card-risk-item--medium .bidding-result-project-card-risk-label {
  color: #e6a23c;
}

.bidding-result-project-card-risk-item--medium {
  background: #fdf6ec;
  border-color: #faecd8;
}

.bidding-result-project-card-risk-item--low .bidding-result-project-card-risk-num,
.bidding-result-project-card-risk-item--low .bidding-result-project-card-risk-label {
  color: var(--sd-primary, #195fb4);
}

.bidding-result-project-card-risk-item--low {
  background: var(--sd-primary-light, #e8f0f8);
  border-color: var(--sd-hairline-soft, #ebebeb);
}

.bidding-result-project-card-risk-item--none .bidding-result-project-card-risk-num,
.bidding-result-project-card-risk-item--none .bidding-result-project-card-risk-label {
  color: #67c23a;
}

.bidding-result-project-card-risk-item--none {
  background: #f0f9eb;
  border-color: #e1f3d8;
}

.bidding-result-project-card-focus {
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.45;
  background: var(--sd-surface-1, #f4f4f4);
  color: #606266;
}

.bidding-result-project-card-focus.is-high {
  background: #fef0f0;
  color: #c45656;
}

.bidding-result-project-card-focus.is-medium {
  background: #fdf6ec;
  color: #b88230;
}

.bidding-result-project-card-focus.is-low {
  background: var(--sd-primary-light, #e8f0f8);
  color: var(--sd-primary-dark, #0f4a8c);
}

.bidding-result-project-card-focus.is-none {
  background: #f0f9eb;
  color: #529b2e;
}

.bidding-result-project-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--sd-hairline-soft, #ebebeb);
  font-size: 12px;
}

.bidding-result-project-card-time {
  color: #909399;
}

.bidding-result-project-card-action {
  display: inline-flex;
  align-items: center;
  color: var(--sd-primary, #195fb4);
  font-weight: 500;
}

.bidding-result-project-card-action .el-icon {
  margin-left: 2px;
  font-size: 12px;
}

.bidding-analysis-result-theme :deep(.el-button.is-link),
.bidding-analysis-result-theme :deep(.el-button--primary.is-link) {
  color: var(--sd-primary, #195fb4);
}

.bidding-analysis-result-theme :deep(.el-button.is-link:hover),
.bidding-analysis-result-theme :deep(.el-button--primary.is-link:hover) {
  color: var(--sd-primary-dark, #0f4a8c);
}

@media (min-width: 1200px) {
  .bidding-result-project-card {
    max-width: calc(33.333% - 20px);
  }
}

@media (max-width: 720px) {
  .bidding-result-project-card {
    max-width: calc(100% - 20px);
    flex: 1 1 100%;
  }
}
</style>
