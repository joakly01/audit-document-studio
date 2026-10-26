<template>
  <el-dialog
    v-model="visible"
    title="查看证据（LLM 输入上下文）"
    width="780px"
    destroy-on-close
    class="bidding-evidence-dialog"
    @close="handleClose"
  >
    <template v-if="evidence">
      <div class="bidding-evidence-summary">
        <div class="bidding-evidence-summary-item">
          <span class="bidding-evidence-label">证据类型</span>
          <el-tag size="small" color="#f3e8ff" style="color: #7c3aed; border: none">
            {{ evidence.evidenceType }}
          </el-tag>
        </div>
        <div class="bidding-evidence-summary-item">
          <span class="bidding-evidence-label">排序方式</span>
          <span>{{ evidence.sortMethod }}</span>
        </div>
        <div class="bidding-evidence-summary-item">
          <span class="bidding-evidence-label">LLM 输入预算</span>
          <span>{{ evidence.budget }}</span>
        </div>
        <div class="bidding-evidence-summary-item">
          <span class="bidding-evidence-label">可用总数</span>
          <span>{{ evidence.totalAvailable }}</span>
        </div>
        <div class="bidding-evidence-summary-item">
          <span class="bidding-evidence-label">实际发送数</span>
          <span class="bidding-evidence-highlight">{{ evidence.actualSent }}</span>
        </div>
        <div class="bidding-evidence-summary-item bidding-evidence-summary-item--full">
          <span class="bidding-evidence-label">规则</span>
          <span>{{ evidence.ruleName }}</span>
        </div>
      </div>

      <div class="bidding-evidence-block">
        <div class="bidding-evidence-block-subtitle">异常汇总</div>
        <p class="bidding-evidence-block-text">{{ evidence.summary }}</p>
      </div>

      <!-- 证据卡片列表 -->
      <div v-if="evidenceCards.length" class="bidding-evidence-cards">
        <div
          v-for="card in evidenceCards"
          :key="card.id"
          class="bidding-evidence-card"
        >
          <div class="bidding-evidence-card-head">
            <el-tag size="small" color="#f3e8ff" style="color: #7c3aed; border: none">{{ card.id }}</el-tag>
            <el-tag v-if="card.cardType === 'document_structure'" size="small" type="info" effect="plain">
              document_structure
            </el-tag>
            <template v-if="card.cardType === 'similarity'">
              <el-tag size="small" color="#fff7ed" style="color: #ea580c; border: none">
                相似度 {{ card.similarity }}%
              </el-tag>
              <el-tag size="small" type="danger" effect="plain">高相似</el-tag>
            </template>
          </div>

          <!-- 文档结构类证据 -->
          <template v-if="card.cardType === 'document_structure'">
            <div class="bidding-evidence-card-file">{{ card.fileName }}</div>
            <code class="bidding-evidence-card-meta">{{ formatJson(card.metadata) }}</code>
            <div class="bidding-evidence-card-content">{{ card.content }}</div>
          </template>

          <!-- 相似度对比类证据 -->
          <template v-if="card.cardType === 'similarity'">
            <div class="bidding-evidence-card-vs">
              {{ card.unitA }} vs {{ card.unitB }}
            </div>
            <div class="bidding-evidence-compare">
              <div class="bidding-evidence-compare-col">
                <div class="bidding-evidence-compare-head">{{ card.unitA }}</div>
                <div class="bidding-evidence-compare-file">{{ card.fileA }}</div>
                <pre class="bidding-evidence-compare-text">{{ card.contentA }}</pre>
              </div>
              <div class="bidding-evidence-compare-col">
                <div class="bidding-evidence-compare-head">{{ card.unitB }}</div>
                <div class="bidding-evidence-compare-file">{{ card.fileB }}</div>
                <pre class="bidding-evidence-compare-text">{{ card.contentB }}</pre>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 元数据组（兼容旧格式） -->
      <div
        v-for="(group, index) in evidence.groups || []"
        :key="'group-' + index"
        class="bidding-evidence-group"
      >
        <div class="bidding-evidence-group-name">{{ group.name }}</div>
        <div
          v-for="(item, idx) in group.items"
          :key="idx"
          class="bidding-evidence-group-item"
        >
          {{ item }}
        </div>
        <div class="bidding-evidence-group-detail">
          <span class="bidding-evidence-label">详情：</span>
          <code>{{ group.detail }}</code>
        </div>
      </div>

      <div v-if="displayCount" class="bidding-evidence-count-tip">
        共 {{ displayCount }} 条证据
      </div>
    </template>
    <el-empty v-else description="暂无证据数据" :image-size="80" />

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleClose">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { countLlmEvidenceItems } from '../mock/biddingAnalysisResultMock.js'

defineOptions({ name: 'BiddingAnalysisEvidenceDialog' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  evidence: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const evidenceCards = computed(() => props.evidence?.cards || [])

const displayCount = computed(() => countLlmEvidenceItems(props.evidence))

const formatJson = (obj) => JSON.stringify(obj)

const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
.bidding-evidence-summary {
  display: flex;
  flex-wrap: wrap;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.bidding-evidence-summary-item {
  width: 50%;
  margin-bottom: 8px;
  font-size: 13px;
}

.bidding-evidence-summary-item--full {
  width: 100%;
}

.bidding-evidence-label {
  color: #909399;
  margin-right: 8px;
}

.bidding-evidence-highlight {
  color: #409eff;
  font-weight: 600;
}

.bidding-evidence-block {
  margin-bottom: 16px;
}

.bidding-evidence-block-subtitle {
  font-size: 14px;
  font-weight: 500;
  color: #7c3aed;
  margin-bottom: 8px;
}

.bidding-evidence-block-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0;
}

.bidding-evidence-cards > * + * {
  margin-top: 12px;
}

.bidding-evidence-card {
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}

.bidding-evidence-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 10px;
}

.bidding-evidence-card-head > * {
  margin-right: 8px;
  margin-bottom: 4px;
}

.bidding-evidence-card-file {
  font-size: 13px;
  color: #303133;
  margin-bottom: 8px;
}

.bidding-evidence-card-meta {
  display: block;
  padding: 8px;
  margin-bottom: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 11px;
  word-break: break-all;
}

.bidding-evidence-card-content {
  font-size: 13px;
  color: #606266;
}

.bidding-evidence-card-vs {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.bidding-evidence-compare {
  display: flex;
}

.bidding-evidence-compare-col {
  flex: 1;
  padding: 10px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.bidding-evidence-compare-col + .bidding-evidence-compare-col {
  margin-left: 10px;
}

.bidding-evidence-compare-head {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 4px;
}

.bidding-evidence-compare-file {
  font-size: 11px;
  color: #909399;
  margin-bottom: 8px;
}

.bidding-evidence-compare-text {
  margin: 0;
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
}

.bidding-evidence-group {
  padding: 12px;
  margin-top: 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.bidding-evidence-group-name {
  font-size: 14px;
  font-weight: 600;
  color: #16a34a;
  margin-bottom: 8px;
}

.bidding-evidence-group-item {
  font-size: 13px;
  color: #303133;
  margin-bottom: 6px;
}

.bidding-evidence-group-detail {
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
  word-break: break-all;
}

.bidding-evidence-group-detail code {
  display: block;
  margin-top: 4px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.bidding-evidence-count-tip {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
  font-size: 13px;
  color: #606266;
  text-align: right;
}
</style>
