<template>
  <el-drawer
    v-model="visible"
    :title="file ? file.name : '查看信息'"
    size="560px"
    destroy-on-close
    class="bidding-file-extract-drawer"
    @close="handleClose"
  >
    <template v-if="file && extractDetail">
      <el-alert
        v-for="(warn, idx) in extractDetail.warnings"
        :key="idx"
        type="warning"
        :closable="false"
        show-icon
        :title="warn"
        class="bidding-file-extract-warn"
      />

      <div
        v-for="section in extractDetail.sections"
        :key="section.title"
        class="bidding-file-extract-section"
      >
        <div class="bidding-file-extract-section-title">{{ section.title }}</div>
        <div
          v-for="(item, index) in section.items"
          :key="index"
          class="bidding-file-extract-item"
        >
          <div class="bidding-file-extract-item-head">
            <el-tag size="small" type="info" effect="plain">{{ item.type }}</el-tag>
            <span class="bidding-file-extract-confidence">
              置信度 {{ Math.round(item.confidence * 100) }}%
            </span>
          </div>
          <div class="bidding-file-extract-item-value">{{ item.value }}</div>
          <div class="bidding-file-extract-item-meta">
            <span class="bidding-file-extract-meta-label">章节：</span>{{ item.sectionTitle }}
          </div>
          <div v-if="showRawJson" class="bidding-file-extract-item-raw">
            <code>{{ formatItemJson(item) }}</code>
          </div>
        </div>
      </div>

      <div class="bidding-file-extract-footer">
        <el-button link type="primary" @click="showRawJson = !showRawJson">
          {{ showRawJson ? '隐藏原始 JSON' : '原始 JSON' }}
        </el-button>
      </div>
    </template>
    <el-empty v-else description="暂无抽取数据" :image-size="80" />

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleClose">确定</el-button>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'BiddingAnalysisFileExtractDrawer' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  file: { type: Object, default: null },
  extractDetail: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const showRawJson = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

watch(visible, (val) => {
  if (!val) showRawJson.value = false
})

const formatItemJson = (item) => JSON.stringify(item, null, 2)

const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
.bidding-file-extract-warn {
  margin-bottom: 12px;
}

.bidding-file-extract-section {
  margin-bottom: 20px;
}

.bidding-file-extract-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.bidding-file-extract-item {
  padding: 12px;
  margin-bottom: 10px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.bidding-file-extract-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.bidding-file-extract-confidence {
  font-size: 12px;
  color: #909399;
}

.bidding-file-extract-item-value {
  font-size: 13px;
  color: #303133;
  line-height: 1.6;
  margin-bottom: 8px;
}

.bidding-file-extract-item-meta {
  font-size: 12px;
  color: #606266;
}

.bidding-file-extract-meta-label {
  color: #909399;
}

.bidding-file-extract-item-raw {
  margin-top: 10px;
}

.bidding-file-extract-item-raw code {
  display: block;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.5;
  word-break: break-all;
  white-space: pre-wrap;
}

.bidding-file-extract-footer {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
}
</style>
