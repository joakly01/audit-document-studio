import { createEmptyCompareConfig } from './associationTwoTablesConstants.js'
import {
  normalizeInvestmentFieldPromptRules,
  applyCompareConfigMigration,
  validateCompareConfigReady
} from './compareConfigHelpers.js'
import {
  findPromptInTree,
  getPromptNodeConfigRaw,
  resolveInitialPromptNode
} from '../engineeringProject/engineeringPromptConfig.js'

export { findPromptInTree, resolveInitialPromptNode }

/** @param {unknown} raw */
export function parseComparePromptConfig(raw) {
  const empty = createEmptyCompareConfig()
  if (raw == null || raw === '') return empty

  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || typeof obj !== 'object') return empty

    const cfg =
      obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)
        ? obj.config
        : obj

    return applyCompareConfigMigration(normalizeCompareConfig(cfg))
  } catch {
    return empty
  }
}

/** @param {object} cfg */
function normalizeCompareConfig(cfg) {
  const base = createEmptyCompareConfig()
  const llm = cfg.llm_config && typeof cfg.llm_config === 'object' ? cfg.llm_config : {}

  const normalized = {
    ...base,
    table1_fields: Array.isArray(cfg.table1_fields) ? [...cfg.table1_fields] : [],
    table2_fields: Array.isArray(cfg.table2_fields) ? [...cfg.table2_fields] : [],
    field_comparison_mapping:
      cfg.field_comparison_mapping && typeof cfg.field_comparison_mapping === 'object'
        ? JSON.parse(JSON.stringify(cfg.field_comparison_mapping))
        : {},
    complete_field_mapping:
      cfg.complete_field_mapping && typeof cfg.complete_field_mapping === 'object'
        ? { ...cfg.complete_field_mapping }
        : {},
    logical_field_mapping:
      cfg.logical_field_mapping && typeof cfg.logical_field_mapping === 'object'
        ? JSON.parse(JSON.stringify(cfg.logical_field_mapping))
        : {},
    code_match_config: {
      ...base.code_match_config,
      ...(cfg.code_match_config && typeof cfg.code_match_config === 'object'
        ? cfg.code_match_config
        : {})
    },
    llm_config: {
      ...base.llm_config,
      ...llm,
      field_weights:
        llm.field_weights && typeof llm.field_weights === 'object'
          ? { ...llm.field_weights }
          : {},
      field_prompt_rules:
        llm.field_prompt_rules && typeof llm.field_prompt_rules === 'object'
          ? { ...llm.field_prompt_rules }
          : {},
      hard_rules: Array.isArray(llm.hard_rules)
        ? JSON.parse(JSON.stringify(llm.hard_rules))
        : []
    },
    min_match_fields:
      cfg.min_match_fields != null ? cfg.min_match_fields : base.min_match_fields,
    table1_numeric_fields: Array.isArray(cfg.table1_numeric_fields)
      ? [...cfg.table1_numeric_fields]
      : [],
    table2_numeric_fields: Array.isArray(cfg.table2_numeric_fields)
      ? [...cfg.table2_numeric_fields]
      : [],
    performance_mode: cfg.performance_mode ?? base.performance_mode,
    max_llm_pairs_per_table1_row:
      cfg.max_llm_pairs_per_table1_row ?? base.max_llm_pairs_per_table1_row,
    max_total_llm_pairs: cfg.max_total_llm_pairs ?? base.max_total_llm_pairs,
    match_lock_policy: {
      ...base.match_lock_policy,
      ...(cfg.match_lock_policy && typeof cfg.match_lock_policy === 'object'
        ? cfg.match_lock_policy
        : {})
    }
  }
  return normalizeInvestmentFieldPromptRules(normalized)
}

/** UI 展示 / JSON 预览：将用户 config 与空配置默认值深度合并（避免浅合并残留旧模板字段） */
export function mergeCompareConfigForDisplay(compareConfig) {
  return normalizeCompareConfig(compareConfig || {})
}

/**
 * @param {object|null|undefined} node
 * @param {object|null|undefined} defaultPrompt
 */
export function buildCompareFromPromptNode(node, defaultPrompt) {
  if (!node) {
    return {
      compare_prompt: { key: '' },
      compare_config: createEmptyCompareConfig()
    }
  }

  const rawConfig =
    getPromptNodeConfigRaw(node) ||
    (defaultPrompt && String(defaultPrompt.id) === String(node.id)
      ? getPromptNodeConfigRaw(defaultPrompt)
      : null) ||
    getPromptNodeConfigRaw(defaultPrompt)

  const compare_config = parseComparePromptConfig(rawConfig)

  return {
    compare_prompt: {
      key: node.id ?? ''
    },
    compare_config
  }
}

/** @param {object} compareConfig */
export function isCompareConfigReady(compareConfig) {
  return validateCompareConfigReady(compareConfig)
}
