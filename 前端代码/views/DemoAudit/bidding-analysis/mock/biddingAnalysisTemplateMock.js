/** 招投标分析 — 模式与分析模板 Mock */

import { buildDefaultPrompt } from './biddingAnalysisPromptMock.js'

export { buildDefaultPrompt }

export const ANALYSIS_MODES = [
  { value: 'bidding_only', label: '招标文件分析' },
  { value: 'tender_only', label: '投标文件分析' },
  { value: 'joint_only', label: '招投标联合分析' },
]

export const DEFAULT_ANALYSIS_MODES = ANALYSIS_MODES.map((item) => item.value)

/** 规范化分析模式数组（去重、过滤非法值、保持选项顺序） */
export const normalizeAnalysisModes = (modes) => {
  if (!Array.isArray(modes)) return []
  const picked = new Set()
  DEFAULT_ANALYSIS_MODES.forEach((value) => {
    if (modes.includes(value)) picked.add(value)
  })
  return DEFAULT_ANALYSIS_MODES.filter((value) => picked.has(value))
}

export const hasBiddingAnalysis = (modes) => normalizeAnalysisModes(modes).includes('bidding_only')

export const hasTenderAnalysis = (modes) => normalizeAnalysisModes(modes).includes('tender_only')

export const hasJointAnalysis = (modes) => normalizeAnalysisModes(modes).includes('joint_only')

export const needsBiddingFiles = (modes) => hasBiddingAnalysis(modes) || hasJointAnalysis(modes)

export const needsTenderFiles = (modes) => hasTenderAnalysis(modes) || hasJointAnalysis(modes)

export const getAnalysisModeLabels = (modes) =>
  ANALYSIS_MODES.filter((item) => normalizeAnalysisModes(modes).includes(item.value)).map(
    (item) => item.label
  )

export const getAnalysisModeLabelText = (modes) => getAnalysisModeLabels(modes).join('、')

/** 招标文件分析规则 */
export const BIDDING_RULE_META = [
  {
    id: 'b1',
    name: '资格合规性',
    defaultPrompt: buildDefaultPrompt('资格合规性', '核对投标人资质、业绩、人员等条件是否与法规及项目要求一致。'),
  },
  {
    id: 'b2',
    name: '评分标准完整性',
    defaultPrompt: buildDefaultPrompt('评分标准完整性', '检查评分办法是否完整、量化指标是否清晰、分值分配是否合理。'),
  },
  {
    id: 'b3',
    name: '招标条款一致性',
    defaultPrompt: buildDefaultPrompt('招标条款一致性', '识别招标文件前后条款、附件与正文之间是否存在矛盾或不一致。'),
  },
  {
    id: 'b4',
    name: '实质性要求识别',
    defaultPrompt: buildDefaultPrompt('实质性要求识别', '提取并标注实质性条款，识别表述模糊或缺少客观判定标准的否决项。'),
  },
  {
    id: 'b5',
    name: '条款歧视性识别',
    defaultPrompt: buildDefaultPrompt('条款歧视性识别', '识别指定品牌、不合理资质门槛、地域限制等可能构成歧视的条款。'),
  },
  {
    id: 'b6',
    name: '不合理的资质与加分项',
    defaultPrompt: buildDefaultPrompt('不合理的资质与加分项', '评估资质条件与项目匹配度，识别过高门槛或不合理加分设置。'),
  },
  {
    id: 'b7',
    name: '评审办法中的"主观分"陷阱',
    defaultPrompt: buildDefaultPrompt('评审办法中的主观分陷阱', '识别主观评分占比过高、缺少可操作判定标准的情形。'),
  },
]

/** 投标文件分析规则（仅围标串标相关） */
export const TENDER_RULE_META = [
  {
    id: 't5',
    name: '围标串标风险识别',
    defaultPrompt: buildDefaultPrompt('围标串标风险识别', '比对元数据、联系方式、人员交叉、文本相似度等串标关联特征。'),
  },
]

/** 招投标联合分析规则 */
export const JOINT_RULE_META = [
  {
    id: 'j1',
    name: '投标文件应废未废',
    defaultPrompt: buildDefaultPrompt('投标文件应废未废', '对照招标废标条款与实质性要求，判断是否存在应废未废风险。'),
  },
  {
    id: 't1',
    name: '投标文件格式合规',
    defaultPrompt: buildDefaultPrompt('投标文件格式合规', '检查投标文件目录、签章、有效期、保证金等格式性要求是否满足。'),
  },
  {
    id: 't2',
    name: '报价合理性识别',
    defaultPrompt: buildDefaultPrompt('报价合理性识别', '分析报价构成、单价合理性及是否存在异常低价或报价规律。'),
  },
  {
    id: 't3',
    name: '技术响应偏离检测',
    defaultPrompt: buildDefaultPrompt('技术响应偏离检测', '对照招标技术要求，识别负偏离、未响应及关键参数不满足项。'),
  },
  {
    id: 't4',
    name: '资质证书有效性识别',
    defaultPrompt: buildDefaultPrompt('资质证书有效性识别', '核验资质证书类型、等级、有效期及人员证书匹配情况。'),
  },
  {
    id: 't6',
    name: '投标文件错同样的地方',
    defaultPrompt: buildDefaultPrompt('投标文件错同样的地方', '识别不同投标文件中相同错误、相同异常表述等可疑一致性。'),
  },
  {
    id: 't7',
    name: '低于成本价竞标的分析',
    defaultPrompt: buildDefaultPrompt('低于成本价竞标的分析', '结合报价与成本要素，识别疑似低于成本价竞标的情形。'),
  },
]

const ALL_BIDDING_RULE_IDS = BIDDING_RULE_META.map((r) => r.id)
const ALL_TENDER_RULE_IDS = TENDER_RULE_META.map((r) => r.id)
const ALL_JOINT_RULE_IDS = JOINT_RULE_META.map((r) => r.id)

/** 按模式分组的分析模板 */
export const ANALYSIS_TEMPLATES = {
  bidding_only: [
    {
      id: 'bidding-std',
      name: '标准招标文件合规分析',
      description:
        '覆盖资格合规性、评分标准、条款一致性、实质性要求、歧视性条款、不合理资质加分及主观分陷阱等招标文件合规检查项。',
      defaultPrompt: buildDefaultPrompt(
        '标准招标文件合规分析',
        '对招标文件执行合规检查，覆盖资格条件、评分标准、条款一致性、实质性要求、歧视性条款、不合理资质加分及主观分陷阱等检查项。'
      ),
      biddingRules: ALL_BIDDING_RULE_IDS,
      tenderRules: [],
      jointRules: [],
    },
  ],
  tender_only: [
    {
      id: 'tender-std',
      name: '标准投标文件合规分析',
      description: '聚焦围标串标风险识别，比对元数据、联系方式、人员交叉、文本相似度等串标关联特征。',
      defaultPrompt: buildDefaultPrompt(
        '标准投标文件合规分析',
        '对各投标单位投标文件执行围标串标风险识别，比对元数据、联系方式、人员交叉、文本相似度等串标关联特征。'
      ),
      biddingRules: [],
      tenderRules: ALL_TENDER_RULE_IDS,
      jointRules: [],
    },
  ],
  both: [
    {
      id: 'joint-std',
      name: '招投标联合分析',
      description:
        '执行联合分析规则，覆盖应废未废、格式合规、报价合理性、技术响应偏离、资质有效性、相同错误及低于成本价竞标等跨文档检查项。',
      defaultPrompt: buildDefaultPrompt(
        '招投标联合分析',
        '对照招标与投标文件执行联合分析，覆盖应废未废、格式合规、报价合理性、技术响应偏离、资质有效性、相同错误及低于成本价竞标等检查项。'
      ),
      biddingRules: [],
      tenderRules: [],
      jointRules: ALL_JOINT_RULE_IDS,
    },
  ],
}

/** joint_only 与历史 both 共用联合分析模板 */
ANALYSIS_TEMPLATES.joint_only = ANALYSIS_TEMPLATES.both

export const TEMPLATE_FIELD_LABELS = {
  bidding_only: '选择分析模板',
  tender_only: '选择分析模板',
  both: '选择分析模板',
}

export const getDefaultTemplateId = (mode) => ANALYSIS_TEMPLATES[mode]?.[0]?.id || ''

export const findTemplate = (mode, templateId) =>
  (ANALYSIS_TEMPLATES[mode] || []).find((item) => item.id === templateId) || null

const uniqueRuleIds = (ids) => [...new Set(ids || [])]

/** 按已选分析模式合并标准模板规则 */
export const buildMergedTemplate = (modes) => {
  const normalized = normalizeAnalysisModes(modes)
  if (!normalized.length) return null

  const biddingRules = []
  const tenderRules = []
  const jointRules = []
  const labelParts = []
  const descParts = []

  if (hasBiddingAnalysis(normalized)) {
    const template = ANALYSIS_TEMPLATES.bidding_only?.[0]
    if (template) {
      biddingRules.push(...(template.biddingRules || []))
      labelParts.push('招标文件分析')
      descParts.push(template.description)
    }
  }
  if (hasTenderAnalysis(normalized)) {
    const template = ANALYSIS_TEMPLATES.tender_only?.[0]
    if (template) {
      tenderRules.push(...(template.tenderRules || []))
      labelParts.push('投标文件分析')
      descParts.push(template.description)
    }
  }
  if (hasJointAnalysis(normalized)) {
    const template = ANALYSIS_TEMPLATES.joint_only?.[0]
    if (template) {
      jointRules.push(...(template.jointRules || []))
      labelParts.push('招投标联合分析')
      descParts.push(template.description)
    }
  }

  const mergedName = labelParts.join(' + ') || '组合分析'
  return {
    id: `merged-${normalized.join('-')}`,
    name: mergedName,
    description: descParts.join(' '),
    defaultPrompt: buildDefaultPrompt(
      mergedName,
      `本次分析包含：${labelParts.join('、')}。请按所选类型分别执行对应规则检查。`
    ),
    biddingRules: uniqueRuleIds(biddingRules),
    tenderRules: uniqueRuleIds(tenderRules),
    jointRules: uniqueRuleIds(jointRules),
  }
}

export const ALL_RULE_META = [...BIDDING_RULE_META, ...TENDER_RULE_META, ...JOINT_RULE_META]

export const getRuleMetaById = (ruleId) =>
  ALL_RULE_META.find((item) => item.id === ruleId) || null

export const getRuleDefaultPrompt = (ruleId) =>
  getRuleMetaById(ruleId)?.defaultPrompt || ''

export const getTemplateDefaultPrompt = (template) => template?.defaultPrompt || ''

/** 将模板内规则展开为标签展示列表 */
export const listRulesFromTemplate = (template) => {
  if (!template) return []
  const appendRules = (ruleIds, docType, tagType) =>
    (ruleIds || []).map((ruleId) => {
      const meta = getRuleMetaById(ruleId)
      return {
        id: ruleId,
        name: meta?.name || ruleId,
        docType,
        tagType,
      }
    })

  return [
    ...appendRules(template.biddingRules, 'bidding', 'success'),
    ...appendRules(template.tenderRules, 'tender', 'primary'),
    ...appendRules(template.jointRules, 'joint', 'warning'),
  ]
}
