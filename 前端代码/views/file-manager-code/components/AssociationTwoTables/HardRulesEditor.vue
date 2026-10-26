<template>
  <div class="hard-rules-editor">
    <div class="hard-rules-editor__header">
      <span class="hard-rules-editor__label">硬规则</span>
      <el-button v-if="!readonly" link type="primary" size="small" @click="resetDefaults">恢复默认</el-button>
      <el-button v-if="!readonly" link type="primary" size="small" @click="addSingleRule">添加单字段规则</el-button>
      <el-button v-if="!readonly" link type="primary" size="small" @click="addComboRule">添加组合规则</el-button>
    </div>

    <el-empty
      v-if="!localRules.length"
      description="暂无硬规则，可从提示词模板加载或手动添加"
      :image-size="48"
    />

    <div v-else class="hard-rules-list">
      <div v-for="(rule, index) in localRules" :key="index" class="hard-rule-card">
        <div class="hard-rule-card__head">
          <el-tag size="small" :type="isComboRule(rule) ? 'warning' : 'info'">
            {{ isComboRule(rule) ? '组合规则 AND' : '单字段规则' }}
          </el-tag>
          <el-button v-if="!readonly" link type="danger" size="small" @click="removeRule(index)">删除</el-button>
        </div>

        <template v-if="isComboRule(rule)">
          <div
            v-for="(sub, subIdx) in rule.rules"
            :key="subIdx"
            class="hard-rule-card__row hard-rule-card__row--combo"
          >
            <el-select
              :model-value="sub.field"
              size="small"
              placeholder="字段"
              :disabled="readonly"
              style="width: 100px"
              @update:model-value="(v) => updateComboSubRule(index, subIdx, 'field', v)"
            >
              <el-option
                v-for="f in fieldOptions"
                :key="f"
                :label="fieldKeyToDisplayLabel(f)"
                :value="f"
              />
            </el-select>
            <el-select
              :model-value="sub.condition"
              size="small"
              placeholder="条件"
              :disabled="readonly"
              style="width: 120px"
              @update:model-value="(v) => updateComboSubRule(index, subIdx, 'condition', v)"
            >
              <el-option
                v-for="opt in CONDITION_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-button
              v-if="!readonly && rule.rules.length > 1"
              link
              type="danger"
              size="small"
              @click="removeComboSubRule(index, subIdx)"
            >
              移除
            </el-button>
          </div>
          <el-button v-if="!readonly" link type="primary" size="small" @click="addComboSubRule(index)">
            添加子条件
          </el-button>
        </template>

        <template v-else>
          <div class="hard-rule-card__row">
            <span class="hard-rule-card__label">字段</span>
            <el-select
              :model-value="rule.field"
              size="small"
              :disabled="readonly"
              style="width: 120px"
              @update:model-value="(v) => updateRule(index, 'field', v)"
            >
              <el-option
                v-for="f in fieldOptions"
                :key="f"
                :label="fieldKeyToDisplayLabel(f)"
                :value="f"
              />
            </el-select>
            <span class="hard-rule-card__label">条件</span>
            <el-select
              :model-value="rule.condition"
              size="small"
              :disabled="readonly"
              style="width: 130px"
              @update:model-value="(v) => updateRule(index, 'condition', v)"
            >
              <el-option
                v-for="opt in CONDITION_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </template>

        <div class="hard-rule-card__row">
          <span class="hard-rule-card__label">判定结果</span>
          <el-select
            :model-value="rule.result"
            size="small"
            :disabled="readonly"
            style="width: 140px"
            @update:model-value="(v) => updateRule(index, 'result', v)"
          >
            <el-option
              v-for="opt in RESULT_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <span class="hard-rule-card__label">优先级</span>
          <el-input-number
            :model-value="rule.priority ?? 0"
            size="small"
            :min="0"
            :max="999"
            :disabled="readonly"
            controls-position="right"
            style="width: 100px"
            @update:model-value="(v) => updateRule(index, 'priority', v)"
          />
        </div>
        <div class="hard-rule-card__row">
          <span class="hard-rule-card__label">说明</span>
          <el-input
            :model-value="rule.message"
            size="small"
            :disabled="readonly"
            placeholder="触发原因说明"
            @update:model-value="(v) => updateRule(index, 'message', v)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { fieldKeyToDisplayLabel } from './compareConfigHelpers.js'

const DEFAULT_LOGICAL_FIELDS = ['name', 'content', 'addr', 'invest']

const CONDITION_OPTIONS = [
  { label: '值相同', value: 'match' },
  { label: '值不同', value: 'mismatch' },
  { label: '至少一个为空', value: 'empty' },
  { label: '都为空', value: 'both_empty' },
  { label: '至少一个非空', value: 'any_non_empty' }
]

const RESULT_OPTIONS = [
  { label: '完全一致', value: 'full_match' },
  { label: '不完全一致', value: 'partial_match' },
  { label: '遗漏', value: 'miss' }
]

const props = defineProps({
  rules: {
    type: Array,
    default: () => []
  },
  mappingKeys: {
    type: Array,
    default: () => []
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

const localRules = computed(() => (Array.isArray(props.rules) ? props.rules : []))

const fieldOptions = computed(() => {
  const fromMapping = Array.isArray(props.mappingKeys) ? props.mappingKeys.filter(Boolean) : []
  const hasFKeys = fromMapping.some((k) => /^F\d+$/i.test(k))
  if (hasFKeys) {
    return [...new Set(fromMapping.filter((k) => k !== 'industry' && k !== 'code'))]
  }
  return [...new Set([...DEFAULT_LOGICAL_FIELDS, ...fromMapping].filter((k) => k !== 'industry' && k !== 'code'))]
})

const defaultRuleField = () => fieldOptions.value[0] || 'F1'

const isComboRule = (rule) => rule?.logic === 'and' && Array.isArray(rule.rules)

const emitRules = (next) => {
  emit('update:rules', next.map(stripComment))
}

const stripComment = (rule) => {
  if (!rule || typeof rule !== 'object') return rule
  const copy = { ...rule }
  delete copy._comment
  if (Array.isArray(copy.rules)) {
    copy.rules = copy.rules.map((r) => ({ ...r }))
  }
  return copy
}

const cloneRules = () => JSON.parse(JSON.stringify(localRules.value))

const updateRule = (index, field, value) => {
  const next = cloneRules()
  if (!next[index]) return
  next[index] = { ...next[index], [field]: value }
  emitRules(next)
}

const updateComboSubRule = (index, subIdx, field, value) => {
  const next = cloneRules()
  const rule = next[index]
  if (!rule?.rules?.[subIdx]) return
  rule.rules = [...rule.rules]
  rule.rules[subIdx] = { ...rule.rules[subIdx], [field]: value }
  emitRules(next)
}

const addComboSubRule = (index) => {
  const next = cloneRules()
  const rule = next[index]
  if (!rule?.rules) return
  rule.rules = [...rule.rules, { field: defaultRuleField(), condition: 'match' }]
  emitRules(next)
}

const removeComboSubRule = (index, subIdx) => {
  const next = cloneRules()
  const rule = next[index]
  if (!rule?.rules || rule.rules.length <= 1) return
  rule.rules = rule.rules.filter((_, i) => i !== subIdx)
  emitRules(next)
}

const removeRule = (index) => {
  emitRules(cloneRules().filter((_, i) => i !== index))
}

const createSingleRule = () => ({
  field: defaultRuleField(),
  condition: 'mismatch',
  result: 'miss',
  priority: 0,
  message: ''
})

const createComboRule = () => ({
  logic: 'and',
  rules: [
    { field: defaultRuleField(), condition: 'match' }
  ],
  result: 'full_match',
  priority: 0,
  message: ''
})

const addSingleRule = () => {
  emitRules([...cloneRules(), createSingleRule()])
}

const addComboRule = () => {
  emitRules([...cloneRules(), createComboRule()])
}

const resetDefaults = () => {
  const src =
    props.templateDefaults?.hard_rules ||
    props.templateDefaults?.compare_config?.llm_config?.hard_rules
  if (Array.isArray(src) && src.length) {
    emitRules(JSON.parse(JSON.stringify(src)))
    return
  }
  ElMessage.warning('当前模板未配置硬规则，无法恢复默认')
}
</script>

<style scoped>
.hard-rules-editor {
  margin: 0 0 12px 0;
  padding: 10px 12px;
  background: #f9fafc;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}

.hard-rules-editor__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.hard-rules-editor__header > * + * {
  margin-left: 12px;
  margin-top: 8px;
}

.hard-rules-editor__label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.hard-rules-list {
  display: flex;
  flex-direction: column;
}

.hard-rules-list > * + * {
  margin-top: 10px;
}

.hard-rule-card {
  padding: 10px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
}

.hard-rule-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.hard-rule-card__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.hard-rule-card__row > * + * {
  margin-left: 8px;
}

.hard-rule-card__row--combo {
  padding-left: 4px;
  border-left: 2px solid #e6a23c;
}

.hard-rule-card__label {
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
}

.hard-rule-card__row .el-input {
  flex: 1;
  min-width: 160px;
}
</style>
