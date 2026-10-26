import {
  createEmptyDuplicateDetectionConfig,
  createEmptyParentChildAnalysisConfig,
  DEFAULT_DUPLICATE_THRESHOLD,
  DEFAULT_PARENT_CHILD_THRESHOLD,
  mergeFieldRulesWithWeights
} from './engineeringProjectConstants.js'
import {
  prepareSingleTableConfig,
  migrateLegacyEngineeringConfig
} from './engineeringSingleTableConfigHelpers.js'

/** @param {unknown} node */
export function getPromptNodeConfigRaw(node) {
  if (!node || typeof node !== 'object') return null
  const candidates = [node.config, node.prompt_config, node.promptConfig]
  for (const item of candidates) {
    if (item != null && String(item).trim() !== '') return item
  }
  return null
}

/** @param {unknown[]|undefined|null} nodes @param {string|number} id */
export function findPromptInTree(nodes, id) {
  if (!nodes || !Array.isArray(nodes) || id == null || id === '') return null
  for (const node of nodes) {
    if (node.isPrompt && (node.id === id || String(node.id) === String(id))) return node
    if (node.children?.length) {
      const found = findPromptInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

/** 先序遍历第一个 isPrompt 节点 */
export function findFirstPromptInTree(nodes) {
  if (!nodes || !Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (node.isPrompt) return node
    if (node.children?.length) {
      const found = findFirstPromptInTree(node.children)
      if (found) return found
    }
  }
  return null
}

/**
 * 解析初始提示词：优先 defaultPrompt（且在树中或可直用），否则取树中第一条
 * @param {unknown[]|undefined|null} tree
 * @param {object|null|undefined} defaultPrompt
 */
export function resolveInitialPromptNode(tree, defaultPrompt) {
  if (defaultPrompt?.id != null) {
    const inTree = findPromptInTree(tree, defaultPrompt.id)
    return inTree || defaultPrompt
  }
  return findFirstPromptInTree(tree)
}

/**
 * 解析提示词中心 JSON：优先 F 键 field_mapping，否则 legacy field_weights 迁移
 * @param {unknown} raw
 * @param {'duplicate'|'parent_child'} module
 */
export function parseEngineeringPromptConfig(raw, module = 'duplicate') {
  const defaultThreshold =
    module === 'duplicate' ? DEFAULT_DUPLICATE_THRESHOLD : DEFAULT_PARENT_CHILD_THRESHOLD
  const emptyBase =
    module === 'duplicate'
      ? createEmptyDuplicateDetectionConfig()
      : createEmptyParentChildAnalysisConfig()

  if (raw == null || raw === '') {
    return { ...emptyBase, threshold: defaultThreshold }
  }

  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || typeof obj !== 'object') throw new Error('invalid config')

    if (obj.field_mapping && typeof obj.field_mapping === 'object') {
      const prepared = prepareSingleTableConfig(obj, { mode: module, validate: false })
      return {
        ...prepared,
        threshold:
          obj.threshold ??
          prepared.llm_config?.threshold ??
          defaultThreshold,
        prompt: prepared.llm_config?.additional_prompt || obj.prompt || ''
      }
    }

    if (obj.field_weights && typeof obj.field_weights === 'object') {
      const migrated = migrateLegacyEngineeringConfig(
        {
          threshold: obj.threshold ?? obj.llm_config?.threshold ?? defaultThreshold,
          field_weights: { ...obj.field_weights },
          field_rules: obj.field_rules || {},
          prompt: obj.prompt || '',
          role_fields: obj.role_fields,
          suspect_rules: obj.suspect_rules,
          hard_rules: obj.hard_rules,
          auxiliary_fields: obj.auxiliary_fields,
          field_aliases: obj.field_aliases,
          strict_negative_prompt: obj.strict_negative_prompt
        },
        module
      )
      return prepareSingleTableConfig(migrated, { mode: module, validate: false })
    }

    return { ...emptyBase, threshold: obj.threshold ?? defaultThreshold }
  } catch {
    return { ...emptyBase, threshold: defaultThreshold }
  }
}

/**
 * @param {object|null|undefined} node
 * @param {object|null|undefined} defaultPrompt
 * @param {'duplicate'|'parent_child'} module
 */
export function buildDetectionFromPromptNode(node, defaultPrompt, module) {
  if (!node) {
    return module === 'duplicate'
      ? createEmptyDuplicateDetectionConfig()
      : createEmptyParentChildAnalysisConfig()
  }

  const rawConfig =
    getPromptNodeConfigRaw(node) ||
    (defaultPrompt && String(defaultPrompt.id) === String(node.id)
      ? getPromptNodeConfigRaw(defaultPrompt)
      : null) ||
    getPromptNodeConfigRaw(defaultPrompt)

  const parsed = parseEngineeringPromptConfig(rawConfig, module)

  const textFromNode = node.content != null ? String(node.content) : ''
  const textFromDefault =
    defaultPrompt?.content != null &&
    (String(defaultPrompt.id) === String(node.id) || !textFromNode)
      ? String(defaultPrompt.content)
      : ''

  const appendPrompt = textFromNode || textFromDefault || parsed.prompt || ''
  const llm = { ...(parsed.llm_config || {}) }
  if (appendPrompt) {
    llm.additional_prompt = appendPrompt
  }

  return {
    ...parsed,
    llm_config: llm,
    prompt: appendPrompt,
    threshold: parsed.threshold ?? llm.threshold
  }
}

/** @param {Record<string, number>} oldWeights @param {Record<string, number>} newWeights @param {Record<string, string>} oldRules */
export function migrateRulesOnWeightChange(oldWeights, newWeights, oldRules) {
  const oldKeys = Object.keys(oldWeights || {})
  const newKeys = Object.keys(newWeights || {})
  const rules = oldRules || {}
  const next = {}

  for (const key of newKeys) {
    if (rules[key] != null) next[key] = rules[key]
  }

  const removed = oldKeys.filter((k) => !(k in newWeights))
  const added = newKeys.filter((k) => !(k in oldWeights))
  if (removed.length === 1 && added.length === 1 && next[added[0]] == null) {
    next[added[0]] = rules[removed[0]] ?? ''
  }

  return mergeFieldRulesWithWeights(newWeights, next)
}

/** @param {'duplicate'|'parent_child'} module */
export function createEmptyDetectionConfig(module) {
  return module === 'duplicate'
    ? createEmptyDuplicateDetectionConfig()
    : createEmptyParentChildAnalysisConfig()
}
