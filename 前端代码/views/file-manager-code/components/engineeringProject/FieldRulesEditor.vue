<template>
  <div class="field-rules-editor">
    <div class="field-rules-editor__header">
      <span class="field-rules-editor__label">字段评分规则</span>
      <el-button v-if="!readonly" link type="primary" size="small" @click="resetDefaults">恢复默认</el-button>
    </div>
    <el-empty v-if="!fieldKeys.length" description="请先在字段权重中添加字段" :image-size="48" />
    <el-collapse v-else v-model="activeNames" class="field-rules-collapse">
      <el-collapse-item v-for="key in fieldKeys" :key="key" :name="key">
        <template #title>
          <span class="field-rules-item__title">{{ key }}</span>
        </template>
        <el-input
          :model-value="localRules[key]"
          @update:model-value="(v) => updateRule(key, v)"
          type="textarea"
          :rows="4"
          :autosize="{ minRows: 3, maxRows: 10 }"
          :disabled="readonly"
          placeholder="该字段的评分细则，支持换行"
          class="preserve-whitespace"
        />
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getScoredFieldKeys, mergeFieldRulesWithWeights } from './engineeringProjectConstants.js'

const props = defineProps({
  rules: {
    type: Object,
    default: () => ({})
  },
  weights: {
    type: Object,
    default: () => ({})
  },
  templateDefaults: {
    type: Object,
    default: null
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:rules'])

const activeNames = ref([])

const localRules = computed(() => props.rules || {})
const fieldKeys = computed(() => getScoredFieldKeys(props.weights))

/**
 * 只读模式下默认展开全部字段规则
 * @param {boolean} readonly 是否只读
 * @param {string[]} keys 字段键列表
 * @returns {void}
 */
const syncActiveNamesForReadonly = (readonly, keys) => {
  if (readonly && keys.length) {
    activeNames.value = [...keys]
  }
}

watch(
  [() => props.readonly, fieldKeys],
  ([readonly, keys]) => {
    syncActiveNamesForReadonly(readonly, keys)
  },
  { immediate: true }
)

const updateRule = (key, value) => {
  emit('update:rules', {
    ...localRules.value,
    [key]: value ?? ''
  })
}

const resetDefaults = () => {
  const weights = props.weights || {}
  const templateRules = props.templateDefaults?.field_rules
  if (templateRules && Object.keys(templateRules).length) {
    emit('update:rules', mergeFieldRulesWithWeights(weights, templateRules))
    return
  }
  ElMessage.warning('当前模板未配置字段规则，无法恢复默认')
}
</script>

<style scoped>
.field-rules-editor {
  margin: 0 0 16px;
  padding: 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border-radius: 4px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
}

.field-rules-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.field-rules-editor__label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.field-rules-collapse {
  border: none;
}

.field-rules-collapse :deep(.el-collapse-item__header) {
  height: 36px;
  line-height: 36px;
  font-size: 12px;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  margin-bottom: 6px;
  padding: 0 12px;
  box-sizing: border-box;
}

.field-rules-collapse :deep(.el-collapse-item__wrap) {
  border: none;
}

.field-rules-collapse :deep(.el-collapse-item__content) {
  padding: 0 0 8px;
}

.field-rules-item__title {
  color: #303133;
  font-weight: 500;
}

.preserve-whitespace :deep(.el-textarea__inner) {
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>
