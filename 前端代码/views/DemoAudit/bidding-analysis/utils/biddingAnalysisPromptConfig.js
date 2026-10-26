/** 招投标分析 — 提示词中心对接（function_type=Bidding_Analysis） */

import {
  getRuleMetaById,
  listRulesFromTemplate as listRulesFromMockTemplate,
} from '../mock/biddingAnalysisTemplateMock.js'

export const BIDDING_PROMPT_FUNCTION_TYPE = 'Bidding_Analysis'

/** 分析模式 → 提示词分类文件夹名称 */
export const MODE_CATEGORY_NAMES = {
  bidding_only: '招标文件分析',
  tender_only: '投标文件分析',
  joint_only: '联合分析',
}

const TAG_TYPE_BY_DOC = {
  bidding: 'success',
  tender: 'primary',
  joint: 'warning',
}

/** @param {unknown} raw */
export function parseBiddingPromptConfig(raw) {
  if (raw == null || raw === '') return null
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || typeof obj !== 'object') return null
    const cfg =
      obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)
        ? obj.config
        : obj
    return {
      template_id: cfg.template_id || '',
      analysis_mode: cfg.analysis_mode || '',
      description: cfg.description || '',
      biddingRules: Array.isArray(cfg.bidding_rules) ? [...cfg.bidding_rules] : [],
      tenderRules: Array.isArray(cfg.tender_rules) ? [...cfg.tender_rules] : [],
      jointRules: Array.isArray(cfg.joint_rules) ? [...cfg.joint_rules] : [],
      rules: Array.isArray(cfg.rules) ? cfg.rules : [],
    }
  } catch {
    return null
  }
}

/** @param {object|null|undefined} node */
export function promptNodeToTemplate(node) {
  if (!node) return null
  const cfg = parseBiddingPromptConfig(node.config)
  if (!cfg) return null
  return {
    id: cfg.template_id || String(node.id),
    promptId: node.id,
    name: node.name || '',
    description: cfg.description || node.description || '',
    defaultPrompt: node.content || '',
    analysisMode: cfg.analysis_mode || '',
    isDefault: Number(node.isDefault ?? node.is_default) === 1,
    biddingRules: cfg.biddingRules,
    tenderRules: cfg.tenderRules,
    jointRules: cfg.jointRules,
    rulesMeta: cfg.rules,
  }
}

/** @param {Array} nodes @param {string|number} id */
export function findPromptInTree(nodes, id) {
  if (!nodes || id === null || id === undefined) return null
  const strId = String(id)
  for (const node of nodes) {
    if (String(node.id) === strId && node.isPrompt) return node
    if (node.children?.length) {
      const found = findPromptInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

/** 扁平化树中全部提示词节点 */
export function flattenPromptNodes(nodes, acc = []) {
  if (!Array.isArray(nodes)) return acc
  nodes.forEach((node) => {
    if (node.isPrompt) acc.push(node)
    if (node.children?.length) flattenPromptNodes(node.children, acc)
  })
  return acc
}

/** 按分类文件夹名称收集该分类下的提示词 */
export function collectPromptsByCategoryName(treeItems, categoryName) {
  const result = []
  const walk = (nodes, inTarget = false) => {
    if (!Array.isArray(nodes)) return
    nodes.forEach((node) => {
      if (node.isPrompt) {
        if (inTarget) result.push(node)
        return
      }
      const isFolder = node.name === categoryName
      if (node.children?.length) {
        walk(node.children, inTarget || isFolder)
      }
    })
  }
  walk(treeItems, false)
  return result
}

/** @param {Array} treeItems @param {string} mode */
export function getPromptOptionsForMode(treeItems, mode) {
  const categoryName = MODE_CATEGORY_NAMES[mode]
  if (!categoryName) return []
  const prompts = collectPromptsByCategoryName(treeItems, categoryName)
  return prompts.map((node) => promptNodeToTemplate(node)).filter(Boolean)
}

/** @param {Array} options @param {string} mode */
function pickDefaultTemplateOption(options, mode) {
  if (!options.length) return null
  const modeMatched = options.find((item) => item.analysisMode === mode)
  const defaulted = options.find((item) => item.isDefault)
  return defaulted || modeMatched || options[0]
}

/** @param {Array} treeItems @param {string} mode */
export function getDefaultPromptIdForMode(treeItems, mode) {
  const options = getPromptOptionsForMode(treeItems, mode)
  return pickDefaultTemplateOption(options, mode)?.promptId ?? null
}

/** @param {Array} treeItems @param {string} mode @param {string|number|null} promptId */
export function resolveTemplateForMode(treeItems, mode, promptId) {
  const options = getPromptOptionsForMode(treeItems, mode)
  if (promptId != null) {
    const node = findPromptInTree(treeItems, promptId)
    const fromNode = promptNodeToTemplate(node)
    if (fromNode) return fromNode
    const matched = options.find((item) => String(item.promptId) === String(promptId))
    if (matched) return matched
  }
  return pickDefaultTemplateOption(options, mode)
}

/** @param {string[]} modes @param {Record<string, string|number|null>} modePromptIds @param {Array} treeItems */
export function buildMergedTemplateFromPrompts(modes, modePromptIds, treeItems) {
  const normalized = modes || []
  if (!normalized.length) return null
  if (normalized.length === 1) {
    const mode = normalized[0]
    return resolveTemplateForMode(treeItems, mode, modePromptIds[mode])
  }

  const parts = normalized
    .map((mode) => resolveTemplateForMode(treeItems, mode, modePromptIds[mode]))
    .filter(Boolean)
  if (!parts.length) return null

  const biddingRules = []
  const tenderRules = []
  const jointRules = []
  parts.forEach((tpl) => {
    biddingRules.push(...(tpl.biddingRules || []))
    tenderRules.push(...(tpl.tenderRules || []))
    jointRules.push(...(tpl.jointRules || []))
  })

  const labelParts = parts.map((item) => item.name).filter(Boolean)
  const mergedName = labelParts.join(' + ') || '组合分析'

  return {
    id: `merged-${normalized.join('-')}`,
    promptId: null,
    name: mergedName,
    description: parts.map((item) => item.description).filter(Boolean).join(' '),
    defaultPrompt: parts
      .map((item) => item.defaultPrompt)
      .filter(Boolean)
      .join('\n\n---\n\n'),
    biddingRules: [...new Set(biddingRules)],
    tenderRules: [...new Set(tenderRules)],
    jointRules: [...new Set(jointRules)],
    rulesMeta: parts.flatMap((item) => item.rulesMeta || []),
  }
}

/** 将模板内规则展开为标签展示列表（优先 config.rules，兜底 rule_meta） */
export function listRulesFromTemplate(template) {
  if (!template) return []
  if (Array.isArray(template.rulesMeta) && template.rulesMeta.length) {
    const ruleIdSet = new Set([
      ...(template.biddingRules || []),
      ...(template.tenderRules || []),
      ...(template.jointRules || []),
    ])
    return template.rulesMeta
      .filter((rule) => ruleIdSet.has(rule.id))
      .map((rule) => ({
        id: rule.id,
        name: rule.name || rule.id,
        docType: rule.docType || rule.doc_type || 'bidding',
        tagType: TAG_TYPE_BY_DOC[rule.docType || rule.doc_type] || 'info',
      }))
  }
  return listRulesFromMockTemplate(template)
}

export function getTemplateDefaultPrompt(template) {
  return template?.defaultPrompt || ''
}

export function getRuleNameById(ruleId, template) {
  const fromConfig = template?.rulesMeta?.find((r) => r.id === ruleId)
  if (fromConfig?.name) return fromConfig.name
  return getRuleMetaById(ruleId)?.name || ruleId
}

/** 统计提示词树中招投标分析预置条数（用于加载后校验） */
export function countBiddingPromptTemplates(treeItems) {
  return DEFAULT_ANALYSIS_MODES.reduce(
    (sum, mode) => sum + getPromptOptionsForMode(treeItems, mode).length,
    0
  )
}

const DEFAULT_ANALYSIS_MODES = ['bidding_only', 'tender_only', 'joint_only']
