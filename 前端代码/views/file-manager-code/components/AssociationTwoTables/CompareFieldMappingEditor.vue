<template>
  <div class="compare-mapping-editor">
    <div class="compare-mapping-editor__header">
      <span class="compare-mapping-editor__label">字段对比映射</span>
      <span
        v-if="fieldKeys.length"
        class="compare-mapping-editor__sum"
        :class="{ 'is-error': !isSumValid }"
      >
        权重合计：{{ weightSum.toFixed(2) }}
      </span>
      <el-button v-if="!readonly" link type="primary" size="small" @click="resetDefaults">恢复默认</el-button>
      <el-button v-if="!readonly" link type="primary" size="small" @click="handleAddField">添加字段</el-button>
    </div>

    <el-empty v-if="!fieldKeys.length" description="暂无对比字段，请点击添加字段" :image-size="48" />

    <div v-else class="compare-mapping-list">
      <div v-for="key in fieldKeys" :key="key" class="compare-mapping-card">
        <div class="compare-mapping-card__head">
          <span class="compare-mapping-card__title">{{ fieldKeyToDisplayLabel(key) }}</span>
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
        <div class="compare-mapping-card__field">
          <span class="compare-mapping-card__label">{{ table1Label }}列名</span>
          <span v-if="readonly" class="compare-mapping-card__readonly">
            {{ localMapping[key]?.table1_field || '—' }}
          </span>
          <el-autocomplete
            v-else
            :model-value="localMapping[key]?.table1_field || ''"
            :fetch-suggestions="(q, cb) => queryColumnSuggestions(q, table1ColumnOptions, cb)"
            clearable
            size="small"
            value-key="value"
            :trigger-on-focus="true"
            class="compare-mapping-card__column-select"
            :placeholder="`${table1Label}列名（可选择或直接修改）`"
            @update:model-value="(v) => updateEntry(key, 'table1_field', v)"
            @select="(item) => updateEntry(key, 'table1_field', item?.value)"
          />
        </div>
        <div class="compare-mapping-card__field">
          <span class="compare-mapping-card__label">{{ table2Label }}列名</span>
          <span v-if="readonly" class="compare-mapping-card__readonly">
            {{ localMapping[key]?.table2_field || '—' }}
          </span>
          <el-autocomplete
            v-else
            :model-value="localMapping[key]?.table2_field || ''"
            :fetch-suggestions="(q, cb) => queryColumnSuggestions(q, table2ColumnOptions, cb)"
            clearable
            size="small"
            value-key="value"
            :trigger-on-focus="true"
            class="compare-mapping-card__column-select"
            :placeholder="`${table2Label}列名（可选择或直接修改）`"
            @update:model-value="(v) => updateEntry(key, 'table2_field', v)"
            @select="(item) => updateEntry(key, 'table2_field', item?.value)"
          />
        </div>
        <div class="compare-mapping-card__field compare-mapping-card__field--inline">
          <span class="compare-mapping-card__label">对比类型</span>
          <div class="compare-mapping-card__inline-controls">
            <el-select
              :model-value="localMapping[key]?.compare_type || 'similarity'"
              size="small"
              :disabled="readonly"
              class="compare-mapping-card__compare-type"
              @update:model-value="(v) => onCompareTypeChange(key, v)"
            >
              <el-option
                v-for="opt in COMPARE_TYPE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <div class="compare-mapping-card__inline-item">
              <span class="compare-mapping-card__sublabel">阈值</span>
              <el-input-number
                :model-value="localMapping[key]?.threshold"
                size="small"
                :min="0"
                :max="5"
                :step="0.01"
                :precision="2"
                :disabled="readonly"
                controls-position="right"
                class="compare-mapping-card__number"
                @update:model-value="(v) => updateEntry(key, 'threshold', v)"
              />
            </div>
            <div class="compare-mapping-card__inline-item">
              <span class="compare-mapping-card__sublabel">权重</span>
              <el-input-number
                :model-value="localWeights[key]"
                size="small"
                :min="0"
                :max="1"
                :step="0.05"
                :precision="2"
                :disabled="readonly"
                controls-position="right"
                class="compare-mapping-card__number"
                @update:model-value="(v) => updateWeight(key, v)"
              />
            </div>
          </div>
        </div>
        <div class="compare-mapping-card__field">
          <span class="compare-mapping-card__label">评分规则</span>
          <el-input
            :model-value="localRules[key]"
            type="textarea"
            :rows="3"
            :autosize="{ minRows: 3, maxRows: 8 }"
            :disabled="readonly"
            placeholder="该字段的评分细则，支持换行"
            class="compare-mapping-card__rules preserve-whitespace"
            @update:model-value="(v) => updateRule(key, v)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  COMPARE_TYPE_OPTIONS,
  allocateNextFieldKey,
  createDefaultMappingEntry,
  defaultThresholdForCompareType,
  fieldKeyToDisplayLabel,
  getCompareFieldKeys,
  sumFieldWeights
} from './compareConfigHelpers.js'

const props = defineProps({
  mapping: {
    type: Object,
    default: () => ({})
  },
  weights: {
    type: Object,
    default: () => ({})
  },
  rules: {
    type: Object,
    default: () => ({})
  },
  templateDefaults: {
    type: Object,
    default: null
  },
  table1Label: {
    type: String,
    default: '文件一'
  },
  table2Label: {
    type: String,
    default: '文件二'
  },
  table1Columns: {
    type: Array,
    default: () => []
  },
  table2Columns: {
    type: Array,
    default: () => []
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:mapping', 'update:weights', 'update:rules', 'compare-type-change', 'remove-field'])

const localMapping = computed(() => props.mapping || {})
const localWeights = computed(() => props.weights || {})
const localRules = computed(() => props.rules || {})
const fieldKeys = computed(() => getCompareFieldKeys(localMapping.value))
const weightSum = computed(() => sumFieldWeights(localWeights.value))
const isSumValid = computed(() => Math.abs(weightSum.value - 1) <= 0.02)

/** 下拉候选仅来自文件表头，不随映射输入改动（手输值只写进映射，不污染选项） */
const table1ColumnOptions = computed(() => {
  const fromFile = Array.isArray(props.table1Columns) ? props.table1Columns : []
  return [...new Set(fromFile.filter(Boolean).map((c) => String(c)))]
})

const table2ColumnOptions = computed(() => {
  const fromFile = Array.isArray(props.table2Columns) ? props.table2Columns : []
  return [...new Set(fromFile.filter(Boolean).map((c) => String(c)))]
})

/**
 * 列名自动完成建议：输入框始终展示当前值，可在原列名上直接改字。
 * 空查询或当前值恰为某一候选时展示全部（便于改选）；其余按包含匹配过滤。
 * @param {string} queryString 当前输入
 * @param {string[]} options 候选列名
 * @param {(list: Array<{ value: string }>) => void} cb Element Plus 回调
 * @returns {void}
 */
const queryColumnSuggestions = (queryString, options, cb) => {
  const list = (Array.isArray(options) ? options : []).map((col) => ({ value: String(col) }))
  const raw = queryString == null ? '' : String(queryString)
  const q = raw.trim().toLowerCase()
  const exactHit = list.some((item) => item.value === raw)
  if (!q || exactHit) {
    cb(list)
    return
  }
  cb(list.filter((item) => item.value.toLowerCase().includes(q)))
}

/**
 * 向父组件提交映射更新
 * @param {Object} next 新映射对象
 * @returns {void}
 */
const emitMapping = (next) => {
  emit('update:mapping', next)
}

/**
 * 更新单条映射字段
 * @param {string} key 字段键
 * @param {string} field 属性名
 * @param {*} value 新值
 * @returns {void}
 */
const updateEntry = (key, field, value) => {
  const next = { ...localMapping.value }
  const normalized =
    field === 'table1_field' || field === 'table2_field'
      ? value == null
        ? ''
        : String(value)
      : value
  next[key] = { ...createDefaultMappingEntry(), ...next[key], [field]: normalized }
  emitMapping(next)
}

/**
 * 更新字段权重
 * @param {string} key 字段键
 * @param {number} value 权重值
 * @returns {void}
 */
const updateWeight = (key, value) => {
  emit('update:weights', {
    ...localWeights.value,
    [key]: value ?? 0
  })
}

/**
 * 更新字段评分规则
 * @param {string} key 字段键
 * @param {string} value 规则文本
 * @returns {void}
 */
const updateRule = (key, value) => {
  emit('update:rules', {
    ...localRules.value,
    [key]: value ?? ''
  })
}

/**
 * 对比类型变更时同步阈值并通知父组件
 * @param {string} key 字段键
 * @param {string} compareType 对比类型
 * @returns {void}
 */
const onCompareTypeChange = (key, compareType) => {
  const next = { ...localMapping.value }
  const prev = next[key] || createDefaultMappingEntry()
  const entry = { ...createDefaultMappingEntry(compareType), ...prev, compare_type: compareType }
  entry.threshold = defaultThresholdForCompareType(compareType)
  next[key] = entry
  emitMapping(next)
  emit('compare-type-change', { key, compareType })
}

/**
 * 从模板默认值恢复字段映射
 * @returns {void}
 */
const resetDefaults = () => {
  const cfg = props.templateDefaults?.compare_config || props.templateDefaults
  const mappingSrc = cfg?.field_comparison_mapping
  const llm = cfg?.llm_config
  if (!mappingSrc || !Object.keys(mappingSrc).length) {
    ElMessage.warning('当前模板未配置字段映射，无法恢复默认')
    return
  }
  emitMapping(JSON.parse(JSON.stringify(mappingSrc)))
  if (llm?.field_weights && Object.keys(llm.field_weights).length) {
    emit('update:weights', JSON.parse(JSON.stringify(llm.field_weights)))
  }
  if (llm?.field_prompt_rules && Object.keys(llm.field_prompt_rules).length) {
    emit('update:rules', JSON.parse(JSON.stringify(llm.field_prompt_rules)))
  }
}

/**
 * 添加新的对比字段
 * @returns {void}
 */
const handleAddField = () => {
  const name = allocateNextFieldKey(localMapping.value)
  if (localMapping.value[name] != null) {
    ElMessage.warning('字段序号冲突，请刷新后重试')
    return
  }
  emitMapping({
    ...localMapping.value,
    [name]: createDefaultMappingEntry()
  })
}

/**
 * 删除指定对比字段
 * @param {string} key 字段键
 * @returns {Promise<void>}
 */
const removeField = async (key) => {
  if (fieldKeys.value.length <= 1) return
  try {
    await ElMessageBox.confirm(
      `确定删除对比字段「${fieldKeyToDisplayLabel(key)}」？`,
      '删除字段',
      { type: 'warning' }
    )
    emit('remove-field', key)
  } catch {
    /* cancelled */
  }
}
</script>

<style scoped>
.compare-mapping-editor {
  margin: 0;
  padding: 12px 0 0;
}

.compare-mapping-editor__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.compare-mapping-editor__header > * + * {
  margin-left: 12px;
}

.compare-mapping-editor__label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.compare-mapping-editor__sum {
  font-size: 12px;
  color: #67c23a;
}

.compare-mapping-editor__sum.is-error {
  color: #f56c6c;
}

.compare-mapping-list {
  display: flex;
  flex-direction: column;
}

.compare-mapping-list > * + * {
  margin-top: 12px;
}

.compare-mapping-card {
  padding: 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
}

.compare-mapping-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.compare-mapping-card__title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.compare-mapping-card__field {
  margin-bottom: 12px;
}

.compare-mapping-card__field:last-child {
  margin-bottom: 0;
}

.compare-mapping-card__field > * + * {
  margin-top: 6px;
}

.compare-mapping-card__label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  line-height: 1.4;
}

.compare-mapping-card__sublabel {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.compare-mapping-card__inline-controls {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
}

.compare-mapping-card__inline-controls > * + * {
  margin-left: 12px;
}

.compare-mapping-card__inline-item {
  flex-shrink: 0;
}

.compare-mapping-card__compare-type {
  width: 120px;
  flex-shrink: 0;
}

.compare-mapping-card__number {
  width: 100px;
}

.compare-mapping-card__rules {
  width: 100%;
}

.compare-mapping-card__column-select {
  width: 100%;
}

.compare-mapping-card__readonly {
  display: block;
  font-size: 13px;
  color: #303133;
  line-height: 1.5;
}

.preserve-whitespace :deep(.el-textarea__inner) {
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>
