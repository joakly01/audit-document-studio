<template>
  <div class="single-table-field-editor">
    <div class="editor-toolbar">
      <el-button v-if="!readonly" type="primary" size="small" @click="addField">新增字段</el-button>
      <span class="weight-sum">权重合计：{{ weightSum.toFixed(2) }}</span>
    </div>
    <el-table :data="rows" border size="small" class="mapping-table" :row-key="(row) => row.fkey">
      <el-table-column label="Excel列" min-width="140">
        <template #default="{ row }">
          <el-select
            v-if="!readonly"
            v-model="row.excel_column"
            filterable
            allow-create
            default-first-option
            placeholder="选择列名"
            @change="emitUpdate"
          >
            <el-option v-for="col in columnOptions" :key="col" :label="col" :value="col" />
          </el-select>
          <span v-else>{{ row.excel_column }}</span>
        </template>
      </el-table-column>
      <el-table-column label="预筛类型" width="120">
        <template #default="{ row }">
          <el-select
            v-model="row.compare_type"
            size="small"
            :disabled="readonly"
            @change="emitUpdate"
          >
            <el-option
              v-for="opt in compareTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              :disabled="mode === 'duplicate' && opt.value === 'investment_gt'"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="阈值" width="90">
        <template #default="{ row }">
          <el-input-number
            v-if="!readonly"
            v-model="row.threshold"
            :min="0"
            :max="1"
            :step="0.01"
            size="small"
            controls-position="right"
            @change="emitUpdate"
          />
          <span v-else>{{ row.threshold }}</span>
        </template>
      </el-table-column>
      <el-table-column label="权重" width="90">
        <template #default="{ row }">
          <el-input-number
            v-if="!readonly"
            v-model="row.weight"
            :min="0"
            :max="1"
            :step="0.05"
            size="small"
            controls-position="right"
            @change="emitUpdate"
          />
          <span v-else>{{ row.weight }}</span>
        </template>
      </el-table-column>
      <el-table-column label="评分规则" min-width="180">
        <template #default="{ row }">
          <el-input
            v-if="!readonly"
            v-model="row.prompt_rule"
            type="textarea"
            :rows="2"
            @change="emitUpdate"
          />
          <span v-else class="rule-preview">{{ row.prompt_rule }}</span>
        </template>
      </el-table-column>
      <el-table-column v-if="!readonly" label="操作" width="70">
        <template #default="{ row }">
          <el-button type="danger" link size="small" @click="removeField(row.fkey)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  SINGLE_TABLE_COMPARE_TYPES,
  getFieldKeys,
  allocateNextFieldKey,
  syncDerivedFields,
  compactSingleTableFKeys,
  removeSingleTableFieldAndRenumber,
  countFKeys,
  sumFieldWeights
} from './engineeringSingleTableConfigHelpers.js'

const props = defineProps({
  config: { type: Object, required: true },
  mode: { type: String, default: 'duplicate' },
  sourceColumns: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits(['update:config'])

const localConfig = ref(syncDerivedFields(props.config || {}))

watch(
  () => props.config,
  (v) => {
    localConfig.value = syncDerivedFields(v || {})
  },
  { deep: true }
)

const compareTypeOptions = SINGLE_TABLE_COMPARE_TYPES

const columnOptions = computed(() => {
  const fromMapping = Object.values(localConfig.value.field_mapping || {})
    .map((e) => e.excel_column)
    .filter(Boolean)
  return [...new Set([...(props.sourceColumns || []), ...fromMapping])]
})

const rows = computed(() => {
  const mapping = localConfig.value.field_mapping || {}
  const weights = localConfig.value.llm_config?.field_weights || {}
  const rules = localConfig.value.llm_config?.field_prompt_rules || {}
  return getFieldKeys(mapping).map((fkey) => ({
    fkey,
    excel_column: mapping[fkey]?.excel_column || '',
    compare_type: mapping[fkey]?.compare_type || 'similarity',
    threshold: mapping[fkey]?.threshold ?? 0.8,
    weight: weights[fkey] ?? 0,
    prompt_rule: rules[fkey] || ''
  }))
})

const weightSum = computed(() =>
  rows.value.reduce((acc, r) => acc + (Number(r.weight) > 0 ? Number(r.weight) : 0), 0)
)

function buildFromRows() {
  const field_mapping = {}
  const field_weights = {}
  const field_prompt_rules = {}
  for (const row of rows.value) {
    field_mapping[row.fkey] = {
      excel_column: row.excel_column,
      compare_type: row.compare_type,
      threshold: row.threshold,
      skip_if_both_empty: false,
      count_toward_min_match: true,
      value_normalizer: row.compare_type.startsWith('investment') ? 'float' : 'none'
    }
    field_weights[row.fkey] = Number(row.weight) || 0
    field_prompt_rules[row.fkey] = row.prompt_rule || ''
  }
  return syncDerivedFields({
    ...localConfig.value,
    field_mapping,
    llm_config: {
      ...localConfig.value.llm_config,
      field_weights,
      field_prompt_rules
    }
  })
}

function emitUpdate() {
  const next = buildFromRows()
  localConfig.value = next
  emit('update:config', next)
}

function addField() {
  let cfg = compactSingleTableFKeys(localConfig.value)
  const fkey = allocateNextFieldKey(cfg.field_mapping || {})
  const next = syncDerivedFields({
    ...cfg,
    field_mapping: {
      ...(cfg.field_mapping || {}),
      [fkey]: {
        excel_column: '',
        compare_type: 'similarity',
        threshold: 0.8,
        skip_if_both_empty: false,
        count_toward_min_match: true,
        value_normalizer: 'none'
      }
    },
    llm_config: {
      ...(cfg.llm_config || {}),
      field_weights: {
        ...(cfg.llm_config?.field_weights || {}),
        [fkey]: 0
      },
      field_prompt_rules: {
        ...(cfg.llm_config?.field_prompt_rules || {}),
        [fkey]: ''
      }
    }
  })
  localConfig.value = next
  emit('update:config', next)
}

function removeField(fkey) {
  if (countFKeys(localConfig.value) <= 1) {
    ElMessage.warning('至少保留一个字段')
    return
  }
  const next = removeSingleTableFieldAndRenumber(localConfig.value, fkey)
  localConfig.value = next
  emit('update:config', next)
  if (Math.abs(sumFieldWeights(next.llm_config?.field_weights) - 1) > 0.02) {
    ElMessage.warning('字段已删除并重编号，请将权重合计调整为 1')
  }
}
</script>

<style scoped>
.single-table-field-editor {
  margin-top: 8px;
}
.editor-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.editor-toolbar > * + * {
  margin-left: 12px;
}
.weight-sum {
  color: #606266;
  font-size: 12px;
}
.rule-preview {
  white-space: pre-wrap;
  font-size: 12px;
}
</style>
