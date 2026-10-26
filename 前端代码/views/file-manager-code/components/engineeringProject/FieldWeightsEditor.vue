<template>
  <div class="field-weights-editor">
    <div class="field-weights-editor__header">
      <span class="field-weights-editor__label">字段权重</span>
      <span class="field-weights-editor__sum" :class="{ 'is-error': !isSumValid }">
        合计：{{ weightSum.toFixed(2) }}
      </span>
      <el-button v-if="!readonly" link type="primary" size="small" @click="resetDefaults">恢复默认</el-button>
      <el-button v-if="!readonly" link type="primary" size="small" @click="handleAddField">添加字段</el-button>
    </div>
    <div class="field-weights-grid">
      <div v-for="key in fieldKeys" :key="key" class="field-weights-item" :class="{ 'field-weights-item--readonly': readonly }">
        <div class="field-weights-item__head">
          <span v-if="readonly" class="field-weights-item__readonly-name">{{ key }}</span>
          <el-input
            v-else
            :model-value="key"
            size="small"
            placeholder="字段名"
            @change="(v) => renameField(key, v)"
          />
          <el-button
            v-if="!readonly && fieldKeys.length > 1"
            link
            type="danger"
            size="small"
            @click="removeField(key)"
          >
            删除
          </el-button>
        </div>
        <div class="field-weights-item__weight-row">
          <span v-if="readonly" class="field-weights-item__readonly-weight">{{ localWeights[key] }}</span>
          <el-input-number
            v-else
            :model-value="localWeights[key]"
            @update:model-value="(v) => updateWeight(key, v)"
            :min="0"
            :max="1"
            :step="0.05"
            :precision="2"
            controls-position="right"
            size="small"
            class="field-weights-item__number"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getScoredFieldKeys, sumFieldWeights } from './engineeringProjectConstants.js'

const props = defineProps({
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

const emit = defineEmits(['update:weights'])

const localWeights = computed(() => props.weights || {})
const fieldKeys = computed(() => getScoredFieldKeys(localWeights.value))
const weightSum = computed(() => sumFieldWeights(localWeights.value))
const isSumValid = computed(() => Math.abs(weightSum.value - 1) <= 0.02)

const emitWeights = (next) => {
  emit('update:weights', next)
}

const updateWeight = (key, value) => {
  emitWeights({
    ...localWeights.value,
    [key]: value ?? 0
  })
}

const resetDefaults = () => {
  const src = props.templateDefaults?.field_weights
  if (src && Object.keys(src).length) {
    emitWeights({ ...src })
    return
  }
  ElMessage.warning('当前模板未配置字段权重，无法恢复默认')
}

const handleAddField = async () => {
  try {
    const { value } = await ElMessageBox.prompt('请输入新字段名称（需与 Excel 列名一致）', '添加字段', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '字段名不能为空'
    })
    const name = String(value).trim()
    if (localWeights.value[name] != null) {
      ElMessage.warning('字段名已存在')
      return
    }
    emitWeights({ ...localWeights.value, [name]: 0 })
  } catch {
    /* cancelled */
  }
}

const removeField = async (key) => {
  if (fieldKeys.value.length <= 1) return
  try {
    await ElMessageBox.confirm(`确定删除字段「${key}」？`, '删除字段', { type: 'warning' })
    const nextWeights = { ...localWeights.value }
    delete nextWeights[key]
    emitWeights(nextWeights)
  } catch {
    /* cancelled */
  }
}

const renameField = (oldKey, newKeyRaw) => {
  const newKey = String(newKeyRaw ?? '').trim()
  if (!newKey || newKey === oldKey) return
  if (localWeights.value[newKey] != null) {
    ElMessage.warning('字段名已存在')
    return
  }
  const nextWeights = { ...localWeights.value }
  nextWeights[newKey] = nextWeights[oldKey]
  delete nextWeights[oldKey]
  emitWeights(nextWeights)
}
</script>

<style scoped>
.field-weights-editor {
  margin: 0 0 16px;
  padding: 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border-radius: 4px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
}

.field-weights-editor__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.field-weights-editor__header > * + * {
  margin-left: 12px;
}

.field-weights-editor__label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.field-weights-editor__sum {
  font-size: 12px;
  color: #67c23a;
}

.field-weights-editor__sum.is-error {
  color: #f56c6c;
}

.field-weights-grid {
  display: flex;
  flex-wrap: wrap;
}

.field-weights-item {
  display: flex;
  flex-direction: column;
  width: calc(50% - 8px);
  min-width: 0;
  box-sizing: border-box;
  padding: 10px;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
}

.field-weights-item:nth-child(odd) {
  margin-right: 16px;
}

.field-weights-item:nth-child(n + 3) {
  margin-top: 8px;
}

.field-weights-item > * + * {
  margin-top: 4px;
}

.field-weights-item__head {
  display: flex;
  align-items: center;
}

.field-weights-item__head > * + * {
  margin-left: 4px;
}

.field-weights-item__weight-row {
  display: flex;
  align-items: center;
}

.field-weights-item__number {
  flex: 1;
  min-width: 0;
}

.field-weights-item--readonly {
  background: var(--sd-surface-1, #f4f4f4);
}

.field-weights-item__readonly-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
  word-break: break-word;
}

.field-weights-item__readonly-weight {
  font-size: 16px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  line-height: 1.2;
}
</style>
