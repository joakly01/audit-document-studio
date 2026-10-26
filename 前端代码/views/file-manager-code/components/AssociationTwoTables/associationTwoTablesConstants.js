import { migrateLegacyFieldKeys } from './compareConfigHelpers.js'

export const ASSOCIATION_BIZ_TYPE = 'association_degree_two_tables'
export const ASSOCIATION_TOOL_UUID = 'association-degree-two-tables-tool-uuid'
export const ASSOCIATION_TASK_TYPE = 9
export const ASSOCIATION_PROMPT_FUNCTION_TYPE = 'Two_Table_Compare'

export {
  finalizeCompareConfigForSubmit,
  resolvePerformanceMode,
  ensurePerformanceConfigDefaults,
  buildCompareConfigForApi,
  formatCompareConfigPreviewJson
} from './compareConfigHelpers.js'

/** 配置页初始空状态，等待提示词中心加载 */
export function createEmptyCompareConfig() {
  return {
    table1_fields: [],
    table2_fields: [],
    field_comparison_mapping: {},
    complete_field_mapping: {},
    logical_field_mapping: {},
    code_match_config: {
      table1_code_field: '',
      table2_code_field: '',
      validation_pattern: ''
    },
    llm_config: {
      prompt_template: null,
      additional_prompt: null,
      field_weights: {},
      field_prompt_rules: {},
      hard_rules: [],
      full_match_threshold: 4.5,
      partial_match_threshold: 3.5,
      partial_match_same_industry_threshold: 3.5
    },
    min_match_fields: 2,
    table1_numeric_fields: [],
    table2_numeric_fields: [],
    performance_mode: 'batch',
    max_llm_pairs_per_table1_row: 5,
    max_total_llm_pairs: 10000,
    match_lock_policy: {
      lock_on_full_match: true,
      lock_on_partial_match: false,
      lock_table2_on_full_match: true,
      lock_table1_on_full_match: true
    }
  }
}

export function createEmptyAssociationConfig() {
  return {
    compare_prompt: {
      key: ''
    },
    compare_config: createEmptyCompareConfig()
  }
}

/** 任务回看：将旧版 compare_prompt.prompt 迁移到 llm_config.additional_prompt */
export function migrateLegacyComparePrompt(configSnapshot) {
  if (!configSnapshot || typeof configSnapshot !== 'object') return configSnapshot
  const next = {
    compare_prompt: { key: '', ...(configSnapshot.compare_prompt || {}) },
    compare_config: {
      ...createEmptyCompareConfig(),
      ...(configSnapshot.compare_config || configSnapshot.config || {})
    }
  }
  delete next.compare_prompt.prompt

  const legacyPrompt = String(configSnapshot.compare_prompt?.prompt || '').trim()
  const llm = next.compare_config.llm_config || {}
  if (legacyPrompt && !String(llm.additional_prompt || '').trim()) {
    llm.additional_prompt = legacyPrompt
    next.compare_config.llm_config = llm
  }
  next.compare_config = migrateLegacyFieldKeys(next.compare_config)
  return next
}
