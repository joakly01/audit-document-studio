<template>
  <div class="config-container">
    <div class="rule-config">
      <div class="rule-header" style="border: none">
        <span class="rule-title">对比参数配置</span>
      </div>
      <div v-loading="promptTreeLoading" class="rule-config-body">
        <el-form label-position="top" size="small">
          <div class="field-block">
            <div class="field-label-col field-label-col--block">
              <span class="field-label-text">提示词模板</span>
            </div>
            <el-tree-select
              :model-value="normalizedPrompt.compare_prompt.key"
              @update:model-value="updateComparePromptKey"
              :data="comparePromptList"
              placeholder="请选择提示词模板"
              :props="treeProps"
              :render-after-expand="false"
              check-strictly
              :check-on-click-node="true"
              :disabled="readonly"
              class="field-input-full"
            >
              <template #default="{ data }">
                <span :class="getNodeClass(data)">{{ data.name }}</span>
              </template>
            </el-tree-select>
            <div
              v-if="isConfigReady && !readonly"
              class="config-status-hint config-status-hint--ok"
            >
              提示词配置已就绪
            </div>
            <div v-else-if="!readonly" class="config-status-hint config-status-hint--hint">
              请在下方选择两表对比提示词模板，配置将从提示词 config 字段加载
            </div>
            <div v-else-if="readonly" class="config-status-hint config-status-hint--readonly">
              以下为任务执行时的对比参数配置（只读）
            </div>
          </div>

          <div v-if="normalizedPrompt.compare_prompt.key" class="config-block">
            <CompareFieldMappingEditor
              :mapping="normalizedPrompt.compare_config.field_comparison_mapping"
              :weights="normalizedPrompt.compare_config.llm_config.field_weights"
              :rules="normalizedPrompt.compare_config.llm_config.field_prompt_rules"
              :template-defaults="compareTemplateDefaults"
              :table1-label="table1Label"
              :table2-label="table2Label"
              :table1-columns="table1Columns"
              :table2-columns="table2Columns"
              :readonly="readonly"
              @update:mapping="onMappingUpdate"
              @update:weights="onWeightsUpdate"
              @update:rules="onRulesUpdate"
              @compare-type-change="onCompareTypeChange"
              @remove-field="onRemoveField"
            />
          </div>

          <div
            v-if="normalizedPrompt.compare_prompt.key && fieldKeys.length"
            class="config-block config-block--spaced"
          >
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">完全一致阈值</span>
              </div>
              <div class="field-inline-row">
                <el-input-number
                  :model-value="normalizedPrompt.compare_config.llm_config.full_match_threshold"
                  @update:model-value="updateFullMatchThreshold"
                  :min="0"
                  :max="5"
                  :step="0.1"
                  :precision="1"
                  :disabled="readonly"
                  controls-position="right"
                  style="width: 160px"
                />
                <span class="config-field-hint">加权总分严格大于此值时，判为完全一致</span>
              </div>
            </div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">部分一致阈值</span>
              </div>
              <div class="field-inline-row">
                <el-input-number
                  :model-value="normalizedPrompt.compare_config.llm_config.partial_match_threshold"
                  @update:model-value="updatePartialMatchThreshold"
                  :min="0"
                  :max="5"
                  :step="0.1"
                  :precision="1"
                  :disabled="readonly"
                  controls-position="right"
                  style="width: 160px"
                />
                <span class="config-field-hint">加权总分 ≥ 此值且未达完全一致时，判为不完全一致</span>
              </div>
            </div>
          </div>

          <div
            v-if="normalizedPrompt.compare_prompt.key"
            class="config-block config-block--spaced"
          >
            <div class="config-block__title">高级配置</div>
            <el-form-item label="分析模式" class="performance-mode-item">
              <el-switch
                :model-value="resolvePerformanceMode(normalizedPrompt.compare_config) === 'batch'"
                @update:model-value="updatePerformanceMode"
                active-text="批量模式"
                inactive-text="标准模式"
                :disabled="readonly"
              />
              <el-tooltip placement="top">
                <template #content>
                  <div class="performance-mode-tooltip">
                    <p><strong>批量模式：</strong>全表预筛 + 并发 LLM，适合大数据量</p>
                    <p><strong>标准模式：</strong>逐行串行处理，适合小数据量精确对比</p>
                    <p>批量模式可能因 Top-N 截断与标准模式结果略有差异</p>
                  </div>
                </template>
                <el-icon class="performance-mode-info"><InfoFilled /></el-icon>
              </el-tooltip>
            </el-form-item>
            <template v-if="resolvePerformanceMode(normalizedPrompt.compare_config) === 'batch'">
              <el-form-item label="每行最大对比数">
                <el-input-number
                  :model-value="normalizedPrompt.compare_config.max_llm_pairs_per_table1_row"
                  @update:model-value="(v) => patchPerformanceField('max_llm_pairs_per_table1_row', v)"
                  :min="1"
                  :max="20"
                  :disabled="readonly"
                  controls-position="right"
                  style="width: 160px"
                />
                <span class="config-field-hint">表一每行最多送入 LLM 的候选对数（Top-N）</span>
              </el-form-item>
              <el-form-item label="全局最大对比数">
                <el-input-number
                  :model-value="normalizedPrompt.compare_config.max_total_llm_pairs"
                  @update:model-value="(v) => patchPerformanceField('max_total_llm_pairs', v)"
                  :min="1000"
                  :max="50000"
                  :step="1000"
                  :disabled="readonly"
                  controls-position="right"
                  style="width: 160px"
                />
                <span class="config-field-hint">全表预筛后送入 LLM 的总对数上限</span>
              </el-form-item>
            </template>
            <el-form-item label="完全一致时锁定">
              <el-switch
                :model-value="normalizedPrompt.compare_config.match_lock_policy?.lock_on_full_match !== false"
                @update:model-value="(v) => patchMatchLockPolicy('lock_on_full_match', v)"
                :disabled="readonly"
              />
            </el-form-item>
            <el-form-item label="不完全一致锁定">
              <el-switch
                :model-value="normalizedPrompt.compare_config.match_lock_policy?.lock_on_partial_match === true"
                @update:model-value="(v) => patchMatchLockPolicy('lock_on_partial_match', v)"
                :disabled="readonly"
              />
            </el-form-item>
            <el-form-item label="表一完全一致锁定">
              <el-switch
                :model-value="normalizedPrompt.compare_config.match_lock_policy?.lock_table1_on_full_match !== false"
                @update:model-value="(v) => patchMatchLockPolicy('lock_table1_on_full_match', v)"
                :disabled="readonly"
              />
            </el-form-item>
            <el-form-item label="表二完全一致锁定">
              <el-switch
                :model-value="normalizedPrompt.compare_config.match_lock_policy?.lock_table2_on_full_match !== false"
                @update:model-value="(v) => patchMatchLockPolicy('lock_table2_on_full_match', v)"
                :disabled="readonly"
              />
            </el-form-item>
            <el-form-item label="最少匹配字段">
              <el-input-number
                :model-value="normalizedPrompt.compare_config.min_match_fields"
                @update:model-value="updateMinMatchFields"
                :min="1"
                :max="20"
                :step="1"
                :disabled="readonly"
                controls-position="right"
                style="width: 160px"
              />
              <span class="config-field-hint">预筛选至少几个字段满足阈值才进入 LLM 判定</span>
            </el-form-item>
          </div>

          <div
            v-if="normalizedPrompt.compare_prompt.key"
            class="config-block config-block--spaced"
          >
            <HardRulesEditor
              :rules="normalizedPrompt.compare_config.llm_config.hard_rules"
              :mapping-keys="hardRuleFieldKeys"
              :template-defaults="compareTemplateDefaults"
              :readonly="readonly"
              @update:rules="onHardRulesUpdate"
            />
          </div>

          <el-form-item v-if="normalizedPrompt.compare_prompt.key" class="field-block-form-item">
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">补充提示词</span>
              </div>
              <el-input
                :model-value="normalizedPrompt.compare_config.llm_config.additional_prompt || ''"
                @update:model-value="updateAdditionalPrompt"
                type="textarea"
                :rows="4"
                :autosize="{ minRows: 3, maxRows: 10 }"
                :disabled="readonly"
                placeholder="可选。对应 llm_config.additional_prompt，追加在系统提示词末尾"
                class="preserve-whitespace field-input-full"
              />
            </div>
          </el-form-item>

          <el-collapse
            v-if="normalizedPrompt.compare_prompt.key"
            class="config-json-collapse"
          >
            <el-collapse-item
              title="config预览（JSON）"
              name="json"
            >
              <el-alert
                v-if="!isConfigReady"
                type="info"
                :closable="false"
                show-icon
                class="config-preview-alert"
                title="配置未完成，以下为当前已填内容经提交规范化后的预览，执行前须完成字段映射。"
              />
              <div class="config-preview-hint">
                与任务 parameter_settings.config 一致；修改上方任意配置项后将实时更新。
                含系统派生字段（table1_fields、logical_field_mapping 等）。
              </div>
              <pre :key="compareConfigPreviewKey" class="json-preview">{{ compareConfigPreview }}</pre>
            </el-collapse-item>
          </el-collapse>
        </el-form>
      </div>
    </div>

    <div class="config-actions-bottom" v-if="!noExecute && !readonly">
      <el-button type="primary" @click="backgroundExecution" :loading="loading">
        执行
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { getPromptTreeByFunctionTypeNewAPI } from '@/api/IcssPlatform/promptManagement.js'
import {
  ASSOCIATION_PROMPT_FUNCTION_TYPE,
  createEmptyAssociationConfig,
  createEmptyCompareConfig
} from './associationTwoTablesConstants.js'
import CompareFieldMappingEditor from './CompareFieldMappingEditor.vue'
import HardRulesEditor from './HardRulesEditor.vue'
import {
  buildCompareFromPromptNode,
  findPromptInTree,
  isCompareConfigReady,
  mergeCompareConfigForDisplay,
  resolveInitialPromptNode
} from './associationPromptConfig.js'
import {
  applyMappingUpdate,
  cloneCompareConfig,
  createDefaultMappingEntry,
  DEFAULT_SIMILARITY_PROMPT_RULE,
  DEFAULT_INVESTMENT_FIELD_RULE,
  fieldKeyToDisplayLabel,
  getCompareFieldKeys,
  removeCompareFieldAndRenumber,
  resolvePerformanceMode,
  syncCompareDerivedFields,
  syncLlmFieldsFromMapping,
  formatCompareConfigPreviewJson
} from './compareConfigHelpers.js'

const props = defineProps({
  prompt: {
    type: Object,
    default: () => createEmptyAssociationConfig()
  },
  tableLabels: {
    type: Object,
    default: () => ({ table1: '文件一', table2: '文件二' })
  },
  table1Columns: {
    type: Array,
    default: () => []
  },
  table2Columns: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  noExecute: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const table1Label = computed(() => String(props.tableLabels?.table1 || '文件一').trim() || '文件一')
const table2Label = computed(() => String(props.tableLabels?.table2 || '文件二').trim() || '文件二')

const emit = defineEmits(['backgroundExecution', 'update:prompt'])

const comparePromptList = ref([])
const defaultPrompt = ref(null)
const compareTemplateDefaults = ref(null)
const promptTreeLoading = ref(false)

const treeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data) => !data.isPrompt
}

const normalizedPrompt = computed(() => ({
  compare_prompt: {
    key: '',
    ...(props.prompt?.compare_prompt || {})
  },
  compare_config: mergeCompareConfigForDisplay(props.prompt?.compare_config)
}))

const isConfigReady = computed(() =>
  isCompareConfigReady(normalizedPrompt.value.compare_config)
)

const fieldKeys = computed(() =>
  getCompareFieldKeys(normalizedPrompt.value.compare_config.field_comparison_mapping)
)

const hardRuleFieldKeys = computed(() => fieldKeys.value)

const compareConfigPreview = computed(() => {
  const cfg = props.prompt?.compare_config
  return formatCompareConfigPreviewJson(cfg)
})

const compareConfigPreviewKey = computed(() => compareConfigPreview.value)

const getNodeClass = (data) => {
  if (data.isPrompt) return 'tree-node-prompt'
  if (data.children?.length) return 'tree-node-folder'
  return 'tree-node-disabled'
}

const patchPrompt = (partial) => {
  const next = {
    compare_prompt: {
      ...normalizedPrompt.value.compare_prompt,
      ...(partial.compare_prompt || {})
    },
    compare_config: cloneCompareConfig(
      partial.compare_config != null
        ? partial.compare_config
        : normalizedPrompt.value.compare_config
    )
  }
  emit('update:prompt', next)
}

const storeTemplateDefaults = (snapshot) => {
  compareTemplateDefaults.value = snapshot
}

const applyPromptTemplate = (node, defaultPromptNode, { force = false } = {}) => {
  const built = buildCompareFromPromptNode(node, defaultPromptNode)
  storeTemplateDefaults({
    compare_config: JSON.parse(JSON.stringify(built.compare_config)),
    compare_prompt: { key: built.compare_prompt.key }
  })
  return built
}

const commitPromptTemplate = (node, defaultPromptNode, options = {}) => {
  patchPrompt(applyPromptTemplate(node, defaultPromptNode, options))
  if (options.force) ElMessage.success('已加载提示词模板配置')
}

const confirmAndApplyTemplate = async (node, defaultPromptNode, previousKey) => {
  if (!node) return
  try {
    await ElMessageBox.confirm(
      '切换模板将覆盖当前对比参数（含补充提示词），是否继续？',
      '切换提示词模板',
      { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
    )
    commitPromptTemplate(node, defaultPromptNode, { force: true })
  } catch {
    patchPrompt({
      compare_prompt: {
        ...props.prompt?.compare_prompt,
        key: previousKey
      }
    })
  }
}

const bootstrapFromTree = (tree, defaultPromptNode, existingKey) => {
  const key = existingKey != null && existingKey !== '' ? existingKey : null
  const node = key
    ? findPromptInTree(tree, key) || resolveInitialPromptNode(tree, defaultPromptNode)
    : resolveInitialPromptNode(tree, defaultPromptNode)
  if (!node) return null
  return applyPromptTemplate(node, defaultPromptNode)
}

const getPromptTree = async () => {
  promptTreeLoading.value = true
  try {
    const res = await getPromptTreeByFunctionTypeNewAPI(ASSOCIATION_PROMPT_FUNCTION_TYPE)
    const data = res?.data
    comparePromptList.value = Array.isArray(data?.items) ? data.items : []
    defaultPrompt.value = data?.defaultPrompt ?? null

    await nextTick()

    if (!props.readonly) {
      const existingKey = props.prompt?.compare_prompt?.key
      const hasReadyConfig = isCompareConfigReady(props.prompt?.compare_config)
      if (hasReadyConfig && existingKey) {
        const node = findPromptInTree(comparePromptList.value, existingKey)
        if (node) {
          storeTemplateDefaults(applyPromptTemplate(node, defaultPrompt.value))
        }
      } else {
        const partial = bootstrapFromTree(
          comparePromptList.value,
          defaultPrompt.value,
          existingKey
        )
        if (partial) {
          if (!hasReadyConfig) {
            patchPrompt(partial)
          } else if (partial.compare_prompt?.key && !existingKey) {
            patchPrompt({ compare_prompt: partial.compare_prompt })
          }
        }
      }
    }
  } catch (e) {
    console.error(e)
    comparePromptList.value = []
    ElMessage.error('加载两表对比提示词失败')
  } finally {
    promptTreeLoading.value = false
  }
}

const updateComparePromptKey = (value) => {
  if (value == null || value === '') {
    patchPrompt({
      compare_prompt: { key: '' },
      compare_config: createEmptyCompareConfig()
    })
    compareTemplateDefaults.value = null
    return
  }
  const node = findPromptInTree(comparePromptList.value, value)
  const previousKey = props.prompt?.compare_prompt?.key
  confirmAndApplyTemplate(node, defaultPrompt.value, previousKey)
}

const patchCompareConfig = (mutator) => {
  const cfg = cloneCompareConfig(normalizedPrompt.value.compare_config)
  mutator(cfg)
  patchPrompt({ compare_config: cfg })
}

const updateAdditionalPrompt = (value) => {
  patchCompareConfig((cfg) => {
    cfg.llm_config = cfg.llm_config || {}
    cfg.llm_config.additional_prompt = value
  })
}

const onMappingUpdate = (mapping) => {
  const cfg = applyMappingUpdate(normalizedPrompt.value.compare_config, mapping)
  patchPrompt({ compare_config: cfg })
}

const onRemoveField = (deletedKey) => {
  const cfg = removeCompareFieldAndRenumber(normalizedPrompt.value.compare_config, deletedKey)
  patchPrompt({ compare_config: cfg })
}

const updatePerformanceMode = (isBatch) => {
  patchCompareConfig((cfg) => {
    cfg.performance_mode = isBatch ? 'batch' : 'standard'
  })
}

const patchPerformanceField = (field, value) => {
  patchCompareConfig((cfg) => {
    cfg[field] = value
  })
}

const patchMatchLockPolicy = (field, value) => {
  patchCompareConfig((cfg) => {
    cfg.match_lock_policy = { ...(cfg.match_lock_policy || {}), [field]: value }
  })
}

const updateMinMatchFields = (value) => {
  patchCompareConfig((cfg) => {
    cfg.min_match_fields = value
  })
}

const onCompareTypeChange = ({ key, compareType }) => {
  const cfg = cloneCompareConfig(normalizedPrompt.value.compare_config)
  cfg.llm_config = cfg.llm_config || {}
  const rules = { ...(cfg.llm_config.field_prompt_rules || {}) }
  rules[key] =
    compareType === 'investment_diff' ? DEFAULT_INVESTMENT_FIELD_RULE : DEFAULT_SIMILARITY_PROMPT_RULE
  cfg.llm_config.field_prompt_rules = rules
  syncCompareDerivedFields(cfg)
  patchPrompt({ compare_config: cfg })
}

const onWeightsUpdate = (weights) => {
  let cfg = cloneCompareConfig(normalizedPrompt.value.compare_config)
  const mapping = { ...(cfg.field_comparison_mapping || {}) }
  for (const key of Object.keys(weights)) {
    if (!mapping[key]) {
      mapping[key] = createDefaultMappingEntry()
    }
  }
  for (const key of Object.keys(mapping)) {
    if (!(key in weights)) {
      delete mapping[key]
    }
  }
  cfg.field_comparison_mapping = mapping
  cfg.llm_config = cfg.llm_config || {}
  cfg.llm_config.field_weights = { ...weights }
  syncLlmFieldsFromMapping(cfg)
  syncCompareDerivedFields(cfg)
  patchPrompt({ compare_config: cfg })
}

const onRulesUpdate = (rules) => {
  const cfg = cloneCompareConfig(normalizedPrompt.value.compare_config)
  cfg.llm_config = cfg.llm_config || {}
  cfg.llm_config.field_prompt_rules = { ...rules }
  syncCompareDerivedFields(cfg)
  patchPrompt({ compare_config: cfg })
}

const onHardRulesUpdate = (rules) => {
  const cfg = cloneCompareConfig(normalizedPrompt.value.compare_config)
  cfg.llm_config = cfg.llm_config || {}
  cfg.llm_config.hard_rules = Array.isArray(rules) ? rules : []
  patchPrompt({ compare_config: cfg })
}

const updateFullMatchThreshold = (value) => {
  patchCompareConfig((cfg) => {
    cfg.llm_config = cfg.llm_config || {}
    cfg.llm_config.full_match_threshold = value
  })
}

const updatePartialMatchThreshold = (value) => {
  patchCompareConfig((cfg) => {
    cfg.llm_config = cfg.llm_config || {}
    cfg.llm_config.partial_match_threshold = value
  })
}

const validateRules = () => {
  if (!props.prompt?.compare_prompt?.key) {
    ElMessage.warning('请选择两表对比提示词模板')
    return false
  }
  const cfg = props.prompt?.compare_config
  if (!isCompareConfigReady(cfg)) {
    ElMessage.warning('请至少添加一个对比字段并完成映射配置')
    return false
  }
  const mapping = cfg.field_comparison_mapping || {}
  for (const [key, entry] of Object.entries(mapping)) {
    if (!String(entry?.table1_field || '').trim() || !String(entry?.table2_field || '').trim()) {
      ElMessage.warning(
        `字段「${fieldKeyToDisplayLabel(key)}」的${table1Label.value}列名与${table2Label.value}列名不能为空`
      )
      return false
    }
  }
  return true
}

const backgroundExecution = () => {
  if (!validateRules()) return
  emit('backgroundExecution')
}

onMounted(() => {
  getPromptTree()
})

defineExpose({ validateRules })
</script>

<style scoped>
.config-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.config-actions-bottom {
  padding: 12px 16px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  display: flex;
  flex-shrink: 0;
  margin-top: auto;
}

.rule-config {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.rule-config-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 16px;
  min-height: 0;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 8px;
  background: var(--sd-canvas, #ffffff);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
}

.rule-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.field-block {
  margin-bottom: 16px;
}

.field-block:last-child {
  margin-bottom: 0;
}

.field-block > * + * {
  margin-top: 8px;
}

.field-label-col--block {
  display: flex;
  align-items: center;
  width: auto;
}

.field-label-text {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  line-height: 1.4;
}

.field-input-full {
  width: 100%;
}

.field-inline-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.field-inline-row > * + * {
  margin-left: 8px;
}

.config-status-hint {
  font-size: 12px;
  line-height: 1.5;
  padding: 4px 0 0;
}

.config-status-hint--ok {
  color: #67c23a;
}

.config-status-hint--hint {
  color: #e6a23c;
}

.config-status-hint--readonly {
  color: #909399;
}

.field-block-form-item {
  margin-bottom: 0;
}

.field-block-form-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.config-block {
  margin-top: 8px;
  padding: 8px 0;
  border-top: 1px dashed #e4e7ed;
}

.config-block--spaced {
  margin-top: 4px;
}

.config-block__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--sd-primary, #195fb4);
}

.config-field-hint {
  font-size: 12px;
  color: #909399;
}

.performance-mode-item :deep(.el-form-item__content) {
  display: flex;
  align-items: center;
}

.performance-mode-info {
  margin-left: 8px;
  font-size: 16px;
  color: #909399;
  vertical-align: middle;
}

.performance-mode-tooltip p {
  margin: 0;
  line-height: 1.5;
}

.performance-mode-tooltip p + p {
  margin-top: 6px;
}

.numeric-fields-preview {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.numeric-fields-preview > * + * {
  margin-top: 6px;
}

.numeric-fields-preview__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.numeric-fields-preview__row > * + * {
  margin-left: 6px;
}

.numeric-fields-preview__label {
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
  min-width: 72px;
}

.config-json-collapse {
  margin-top: 12px;
  border: none;
}

.config-preview-alert {
  margin-bottom: 8px;
}

.config-preview-hint {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #909399;
}

.json-preview {
  margin: 0;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.5;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.preserve-whitespace :deep(.el-textarea__inner) {
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.6;
}

:deep(.tree-node-folder) {
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
}

:deep(.tree-node-prompt) {
  color: #67c23a;
  font-size: 13px;
}

:deep(.tree-node-prompt)::before {
  content: '📄';
  margin-right: 4px;
}

:deep(.tree-node-disabled) {
  color: #c0c4cc;
}
</style>
