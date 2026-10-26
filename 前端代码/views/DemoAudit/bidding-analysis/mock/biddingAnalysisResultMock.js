/** 招投标分析结果页 — 原型 Mock 数据 */

import {
  hasBiddingAnalysis,
  hasJointAnalysis,
  hasTenderAnalysis,
  normalizeAnalysisModes,
} from './biddingAnalysisTemplateMock.js'

export const RISK_LEVEL_MAP = {
  high: { label: '高风险', tagType: 'danger', borderColor: '#f56c6c' },
  medium: { label: '中风险', tagType: 'warning', borderColor: '#e6a23c' },
  low: { label: '低风险', tagType: '', borderColor: '#195fb4', customColor: '#e8f0f8' },
  none: { label: '未发现风险', tagType: 'success', borderColor: '#67c23a' },
}

export const CATEGORY_TAG_COLORS = {
  商务: { bg: '#f3e8ff', color: '#7c3aed' },
  报价: { bg: '#fff7ed', color: '#ea580c' },
  文件: { bg: '#eff6ff', color: '#2563eb' },
  元数据: { bg: '#fdf4ff', color: '#a855f7' },
  文本: { bg: '#f0fdf4', color: '#16a34a' },
}

export const mockRiskSummary = {
  high: 2,
  medium: 2,
  low: 2,
  none: 4,
}

/** 各模式规则结果风险统计（与下方 mock 规则条数一致） */
export const mockRiskSummaryByMode = {
  bidding_only: { high: 1, medium: 1, low: 1, none: 1 },
  tender_only: { high: 1, medium: 1, low: 1, none: 3 },
  both: { ...mockRiskSummary },
}

/** 分析结果 — 招投标联合分析（项目级列表 Mock） */
export const mockAnalyzedProjects = [
  {
    id: 1,
    name: '某市政道路工程招标项目',
    status: 'completed',
    analysisMode: 'both',
    analyzedAt: '2026-06-20 15:32',
    biddingFileCount: 1,
    tenderCompanyCount: 2,
    riskSummary: { ...mockRiskSummaryByMode.both },
  },
  {
    id: 2,
    name: '某学校改建工程招标项目',
    status: 'completed',
    analysisMode: 'both',
    analyzedAt: '2026-06-18 09:15',
    biddingFileCount: 1,
    tenderCompanyCount: 1,
    riskSummary: { high: 1, medium: 1, low: 1, none: 2 },
  },
]

/** 分析结果 — 招标文件分析（项目级列表 Mock） */
export const mockAnalyzedBiddingOnlyProjects = [
  {
    id: 'bo-1',
    name: '某市政道路工程招标文件检查',
    status: 'completed',
    analysisMode: 'bidding_only',
    analyzedAt: '2026-06-21 11:08',
    biddingFileCount: 1,
    riskSummary: { ...mockRiskSummaryByMode.bidding_only },
  },
  {
    id: 'bo-2',
    name: '某学校改建工程招标文件检查',
    status: 'completed',
    analysisMode: 'bidding_only',
    analyzedAt: '2026-06-19 16:42',
    biddingFileCount: 1,
    riskSummary: { high: 0, medium: 1, low: 1, none: 2 },
  },
]

/** 分析结果 — 投标文件分析（项目级列表 Mock） */
export const mockAnalyzedTenderOnlyProjects = [
  {
    id: 'to-1',
    name: '某市政道路工程投标文件分析',
    status: 'completed',
    analysisMode: 'tender_only',
    analyzedAt: '2026-06-22 14:20',
    tenderCompanyCount: 6,
    riskSummary: { ...mockRiskSummaryByMode.tender_only },
  },
  {
    id: 'to-2',
    name: '某采购项目投标文件比对分析',
    status: 'completed',
    analysisMode: 'tender_only',
    analyzedAt: '2026-06-17 10:05',
    tenderCompanyCount: 4,
    riskSummary: { high: 2, medium: 0, low: 1, none: 2 },
  },
]

/** 按分析模式获取项目级结果列表 */
export const mockAnalyzedProjectsByMode = {
  bidding_only: mockAnalyzedBiddingOnlyProjects,
  tender_only: mockAnalyzedTenderOnlyProjects,
  both: mockAnalyzedProjects,
}

export const getAnalyzedProjectsByMode = (mode) =>
  mockAnalyzedProjectsByMode[mode] || mockAnalyzedProjectsByMode.both

/** 按已选分析模式获取项目级结果列表（多选） */
export const getAnalyzedProjectsByModes = (modes) => {
  const normalized = normalizeAnalysisModes(modes)
  if (!normalized.length) return []
  if (normalized.length === 1) {
    return getAnalyzedProjectsByMode(normalized[0] === 'joint_only' ? 'both' : normalized[0])
  }
  return mockAnalyzedProjectsByMode.both
}

/** 按分析模式获取规则结果 Mock */
export const getRuleResultsByMode = (mode) => {
  if (mode === 'bidding_only') return [...mockBiddingRuleResults]
  if (mode === 'tender_only') return [...mockTenderRuleResults]
  if (mode === 'joint_only') return [...mockJointRuleResults]
  return [...mockRuleResults]
}

/** 按已选分析模式获取规则结果 Mock（多选合并） */
export const getRuleResultsByModes = (modes) => {
  const normalized = normalizeAnalysisModes(modes)
  const results = []
  if (hasBiddingAnalysis(normalized)) results.push(...mockBiddingRuleResults)
  if (hasTenderAnalysis(normalized)) results.push(...mockTenderRuleResults)
  if (hasJointAnalysis(normalized)) results.push(...mockJointRuleResults)
  return results
}

/** 按分析模式获取文件详情 Mock */
export const getProjectFilesByMode = (mode) => {
  if (mode === 'bidding_only') {
    return {
      biddingFiles: [...mockBiddingFiles],
      tenderFiles: [],
    }
  }
  if (mode === 'tender_only') {
    return {
      biddingFiles: [],
      tenderFiles: [...mockTenderFiles],
    }
  }
  if (mode === 'joint_only') {
    return {
      biddingFiles: [...mockBiddingFiles],
      tenderFiles: mockTenderFiles.slice(0, 4),
    }
  }
  return {
    biddingFiles: [...mockBiddingFiles],
    tenderFiles: mockTenderFiles.slice(0, 4),
  }
}

/** 按已选分析模式获取文件详情 Mock（多选） */
export const getProjectFilesByModes = (modes) => {
  const normalized = normalizeAnalysisModes(modes)
  const showBidding = hasBiddingAnalysis(normalized) || hasJointAnalysis(normalized)
  const showTender = hasTenderAnalysis(normalized) || hasJointAnalysis(normalized)
  return {
    biddingFiles: showBidding ? [...mockBiddingFiles] : [],
    tenderFiles: showTender
      ? hasTenderAnalysis(normalized) && !hasJointAnalysis(normalized)
        ? [...mockTenderFiles]
        : mockTenderFiles.slice(0, 4)
      : [],
  }
}

/** 统计 LLM 证据弹窗中的展示条数（cards + groups） */
export function countLlmEvidenceItems(evidence) {
  if (!evidence) return 0
  const cards = evidence.cards?.length || 0
  const groups = evidence.groups?.length || 0
  return cards + groups
}

/** 规则证据条数：有 llmEvidence 时与「查看证据」弹窗一致，否则取 evidenceList 长度 */
export function getRuleEvidenceCount(rule) {
  if (!rule) return 0
  if (rule.llmEvidence) {
    return countLlmEvidenceItems(rule.llmEvidence)
  }
  return (rule.evidenceList || []).length
}

/** 招标文件分析规则结果 */
export const mockBiddingRuleResults = [
  {
    id: 'b-r1',
    docType: 'bidding',
    riskLevel: 'none',
    categories: ['文件'],
    confidence: 100,
    title: '资格合规性：未发现风险',
    description: '招标文件中投标人资格条件表述完整，未发现与法规明显冲突或歧义条款。',
    ruleName: '资格合规性',
    involvedUnits: ['—'],
    detailDescription: '本规则已完成检查，资格条件章节结构完整，未发现明确合规风险。',
    aiSummary: '大模型分析认为当前内容未发现明显问题',
    aiRiskLevel: 'none',
    evidenceList: [
      { unit: '招标文件', location: '第12页 字符 120-356', detail: '资格条件章节表述完整' },
    ],
    llmEvidence: null,
  },
  {
    id: 'b-r2',
    docType: 'bidding',
    riskLevel: 'medium',
    categories: ['文件'],
    confidence: 72,
    title: '评分标准完整性：存在待完善项',
    description: '评分标准中部分技术分项缺少量化指标，建议补充明确的分值分配说明。',
    ruleName: '评分标准完整性',
    involvedUnits: ['—'],
    detailDescription: '检测到评分标准存在描述性条款过多、可量化指标不足的情况，可能影响评审客观性。',
    aiSummary: '大模型分析认为评分标准部分条款不够明确，建议人工复核并补充量化指标。',
    aiRiskLevel: 'medium',
    aiAnalysisItems: [
      {
        index: 1,
        title: '技术评分缺少量化指标',
        riskLevel: 'medium',
        summary: '施工组织设计评分项仅描述「优/良/一般」等等级，未给出各等级对应的具体分值区间或判定条件。',
        involvedUnits: [],
        judgmentBasis: '对比评分办法中各评分项的可量化程度，检出描述性条款占比超过 40%。',
        reasonableExplanation: '定性评分在复杂工程中较常见，但应辅以明确的等级划分说明。',
        inspectionItems: ['补充评分细则附件', '组织专家预审评分标准可操作性'],
        keyEvidence: [{ unit: '招标文件', detail: '第28页：施工组织设计评分缺少量化细则' }],
      },
    ],
    evidenceList: [
      { unit: '招标文件', location: '第28页 字符 880-1020', detail: '技术评分项缺少量化细则' },
    ],
    llmEvidence: null,
  },
  {
    id: 'b-r3',
    docType: 'bidding',
    riskLevel: 'high',
    categories: ['文件'],
    confidence: 91,
    title: '倾向性条款检测：发现指定品牌及排斥性表述',
    description:
      '招标文件技术参数中存在「必须采用 XX 品牌设备」等指定品牌表述，且部分条款设置明显倾向特定供应商的参数指标，存在限制竞争风险。',
    ruleName: '倾向性条款检测',
    involvedUnits: ['—'],
    detailDescription:
      '检测到 3 处技术参数带有具体品牌指向，2 处资格条件设置与主流产品规格不匹配，可能构成不合理排斥其他投标人。',
    aiSummary: '大模型分析认为存在明显倾向性条款，建议重点复核并依法修改招标文件。',
    aiRiskLevel: 'high',
    aiAnalysisItems: [
      {
        index: 1,
        title: '指定品牌表述',
        riskLevel: 'high',
        summary:
          '技术规格章节出现「监控系统须采用海康威视品牌」等指定品牌要求，违反招标投标法关于不得指定特定品牌的规定。',
        involvedUnits: [],
        judgmentBasis: '比对技术参数文本与《招标投标法实施条例》第三十二条关于限定品牌、型号的禁止性规定。',
        reasonableExplanation: '若为标准写法引用，应改为「相当于或优于」并附参考标准，不应唯一指向单一品牌。',
        inspectionItems: ['核实参数设置是否由特定供应商提供', '修改为标准兼容表述后重新发布'],
        keyEvidence: [
          { unit: '招标文件', detail: '第35页：监控系统须采用海康威视品牌' },
          { unit: '招标文件', detail: '第36页：核心交换机指定运维服务商 CE 系列' },
        ],
      },
    ],
    evidenceList: [
      { unit: '招标文件', location: '第35页 字符 2100-2280', detail: '指定品牌：海康威视' },
      { unit: '招标文件', location: '第36页 字符 890-1020', detail: '指定型号：运维服务商 CE 系列' },
    ],
    llmEvidence: null,
  },
  {
    id: 'b-r4',
    docType: 'bidding',
    riskLevel: 'low',
    categories: ['文件'],
    confidence: 68,
    title: '实质性要求识别：部分否决条款表述不够清晰',
    description:
      '实质性条款整体区分明确，但个别否决性条款缺少量化判定标准，可能导致评审时理解偏差。',
    ruleName: '实质性要求识别',
    involvedUnits: ['—'],
    detailDescription:
      '发现 2 处否决条款使用「严重不符合」等主观表述，未给出可操作的判定依据，风险等级偏低，建议优化措辞。',
    aiSummary: '大模型分析认为整体合规，个别条款建议补充客观判定标准。',
    aiRiskLevel: 'low',
    aiAnalysisItems: [
      {
        index: 1,
        title: '否决条款表述模糊',
        riskLevel: 'low',
        summary: '「施工方案严重不符合招标文件要求」未定义「严重不符合」的具体情形，存在理解偏差可能。',
        involvedUnits: [],
        judgmentBasis: '对比否决条款与评分细则的可量化程度，检出主观表述占比偏高。',
        reasonableExplanation: '此类表述在招标文件中较常见，通过澄清答疑通常可消除歧义。',
        inspectionItems: ['发布澄清公告明确判定标准', '评审前组织专家统一理解口径'],
        keyEvidence: [{ unit: '招标文件', detail: '第18页：严重不符合要求作否决投标处理' }],
      },
    ],
    evidenceList: [
      { unit: '招标文件', location: '第18页 字符 560-680', detail: '「严重不符合」缺少量化标准' },
    ],
    llmEvidence: null,
  },
]

/** 投标文件分析规则结果 */
export const mockTenderRuleResults = [
  {
    id: 'r1',
    docType: 'tender',
    riskLevel: 'low',
    categories: ['元数据'],
    confidence: 30,
    title: '文档元数据异常汇总：6 家投标单位存在文档元数据关联',
    description:
      '检测到 15 组投标单位存在文档元数据关联，涉及 6 家单位。异常类型包括：相同创建软件 15 组。创建时间存在差异，但仍需关注是否存在同一来源制作标书的情况。',
    ruleName: '文档元数据异常检测',
    involvedUnits: ['投标单位1', '投标单位2', '投标单位3', '投标单位4', '+2'],
    detailDescription:
      '6家投标单位（投标单位1至投标单位6）的投标文件均使用相同的创建软件，且所有15组两两配对均显示相同创建软件，但作者、公司、创建者均不相同，创建时间差异较大（从约2小时到5天不等），未发现时间窗口高度接近的情况。',
    aiSummary: '大模型分析认为当前元数据关联存在一定异常特征，风险等级偏低，建议结合其他规则综合研判。',
    aiRiskLevel: 'low',
    aiAnalysisItems: [
      {
        index: 1,
        title: '文档元数据异常',
        riskLevel: 'low',
        summary:
          '6家投标单位（投标单位1至投标单位6）的投标文件均使用相同的创建软件，且所有15组两两配对均显示相同创建软件，但作者、公司、创建者均不相同，创建时间差异较大（从约2小时到5天不等），未发现时间窗口高度接近的情况。',
        involvedUnits: ['投标单位1', '投标单位2', '投标单位3', '投标单位4', '投标单位5', '投标单位6'],
        judgmentBasis:
          '基于文档元数据中创建软件、作者、公司等字段进行两两比对；15组配对均检出相同创建软件，但作者与公司字段不一致，创建时间跨度较大。',
        reasonableExplanation:
          '相同创建软件可能源于使用同一版本办公软件或行业通用模板工具，不一定直接构成围标串标，需结合文本相似度等规则综合判断。',
        inspectionItems: [
          '核查各投标单位标书实际制作人员及制作环境',
          '比对创建时间与投标截止时间的关联性',
          '结合文本相似度规则交叉验证',
        ],
        keyEvidence: [
          { unit: '投标单位1', detail: '元数据：相同创建软件' },
          { unit: '投标单位2', detail: '元数据：相同创建软件' },
          { unit: '投标单位3', detail: '元数据：相同创建软件' },
        ],
      },
    ],
    evidenceList: [
      {
        unit: '投标单位1',
        location: '元数据组 1',
        detail: '投标单位1 vs 投标单位2：相同创建软件；详情：{"same_software": true, "same_creator": false}',
      },
      {
        unit: '投标单位2',
        location: '元数据组 2',
        detail: '投标单位3 vs 投标单位4：相同创建软件；详情：{"same_software": true, "time_diff_seconds": 86400}',
      },
    ],
    llmEvidence: {
      evidenceType: '文档元数据证据',
      sortMethod: 'metadata_pair',
      budget: '不限',
      totalAvailable: 6,
      actualSent: 6,
      ruleName: '文档元数据异常检测',
      summary:
        '检测到 6 条文档元数据关联证据（含 2 组元数据配对、4 条结构/相似度片段），涉及 6 家单位。异常类型包括：相同创建软件。',
      groups: [
        {
          name: '元数据组 1',
          items: ['1. 投标单位1 vs 投标单位2：相同创建软件；'],
          detail: '{"same_author": false, "same_company": false, "same_creator": false, "same_software": true}',
        },
        {
          name: '元数据组 2',
          items: ['2. 投标单位3 vs 投标单位4：相同创建软件；'],
          detail: '{"same_software": true, "same_creation_window": false, "time_diff_seconds": 172800}',
        },
      ],
      cards: [
        {
          id: 'EVID-003',
          cardType: 'document_structure',
          fileName: '投标单位5 示例建设企业戊-商务.pdf',
          metadata: {
            end_pos: 12480,
            start_pos: 12310,
            page_number: 18,
            section_title: '(一) 投标报价表',
          },
          content: '层级2: (一) 投标报价表',
        },
        {
          id: 'EVID-004',
          cardType: 'document_structure',
          fileName: '投标单位2 示例建设企业丙-技术.pdf',
          metadata: {
            end_pos: 8920,
            start_pos: 8750,
            page_number: 12,
            section_title: '二、质量保证措施',
          },
          content: '层级2: 二、质量保证措施',
        },
        {
          id: 'EVID-005',
          cardType: 'similarity',
          similarity: 95,
          similarityLevel: 'high',
          unitA: '投标单位2',
          unitB: '投标单位5',
          fileA: '示例建设企业丙-技术.pdf',
          fileB: '示例建设企业戊-技术.pdf',
          contentA:
            '目录\n一、施工组织总体设想\n二、施工进度计划\n三、质量保证措施\n四、安全文明施工措施\n五、项目管理机构',
          contentB:
            '目录\n一、施工组织总体设想\n二、施工进度计划\n三、质量保证措施\n四、安全文明施工措施\n五、项目管理机构',
        },
        {
          id: 'EVID-006',
          cardType: 'similarity',
          similarity: 100,
          similarityLevel: 'high',
          unitA: '投标单位2',
          unitB: '投标单位5',
          fileA: '示例建设企业丙-商务.pdf',
          fileB: '示例建设企业戊-商务.pdf',
          contentA:
            '项目名称：2022年市南区广州路、龙口路、大学路等道路整治工程\n项目编号：2022-002179\n日期：2022年8月',
          contentB:
            '项目名称：2022年市南区广州路、龙口路、大学路等道路整治工程\n项目编号：2022-002179\n日期：2022年8月',
        },
      ],
    },
  },
  {
    id: 'r2',
    docType: 'tender',
    riskLevel: 'none',
    categories: ['文本'],
    confidence: 100,
    title: '文本结构与编号样式相似度检测：未发现风险',
    description: '大模型基于候选证据判断：未发现明显风险。',
    ruleName: '文本结构与编号样式相似度检测',
    involvedUnits: ['投标单位1', '投标单位2', '投标单位3', '投标单位4', '+2'],
    detailDescription: '本规则已完成检查，未发现明确风险问题。',
    aiSummary: '大模型分析认为当前内容未发现明显问题',
    aiRiskLevel: 'none',
    evidenceList: [],
    llmEvidence: null,
  },
  {
    id: 'r3',
    docType: 'tender',
    riskLevel: 'medium',
    categories: ['商务'],
    confidence: 78,
    title: '人员交叉关联检测：2 家单位存在项目管理人员重叠',
    description:
      '投标单位2与投标单位5的项目经理、技术负责人姓名及身份证号在多家单位投标文件中重复出现，存在人员挂靠或交叉任职嫌疑。',
    ruleName: '人员交叉关联检测',
    involvedUnits: ['投标单位2', '投标单位5'],
    detailDescription:
      '检测到 2 组人员信息交叉：项目经理「示例人员23」同时出现在投标单位2、投标单位5的投标文件中；技术负责人「示例人员24」存在类似交叉。建议进一步核查社保缴纳及劳动关系。',
    aiSummary: '大模型分析认为人员交叉特征明显，风险等级中等，建议启动重点核查程序。',
    aiRiskLevel: 'medium',
    aiAnalysisItems: [
      {
        index: 1,
        title: '项目管理人员交叉',
        riskLevel: 'medium',
        summary:
          '投标单位2与投标单位5的项目经理均为「示例人员23」（身份证号前14位一致），技术负责人「示例人员24」亦存在交叉关联。',
        involvedUnits: ['投标单位2', '投标单位5'],
        judgmentBasis: '基于各投标文件人员登记表提取姓名、身份证号、职务进行跨单位比对。',
        reasonableExplanation: '部分人员可能在集团内部兼职，需结合社保及劳动合同核实是否为合理的人员调配。',
        inspectionItems: ['核查交叉人员近6个月社保缴纳单位', '要求投标人出具人员在职证明'],
        keyEvidence: [
          { unit: '投标单位2', detail: '项目经理：示例人员23，身份证9900**********0001' },
          { unit: '投标单位5', detail: '项目经理：示例人员23，身份证9900**********0001' },
        ],
      },
    ],
    evidenceList: [
      { unit: '投标单位2', location: '第8页 人员表', detail: '项目经理示例人员23' },
      { unit: '投标单位5', location: '第7页 人员表', detail: '项目经理示例人员23（同身份证号）' },
    ],
    llmEvidence: {
      evidenceType: '人员交叉证据',
      sortMethod: 'personnel_cross',
      budget: '不限',
      totalAvailable: 2,
      actualSent: 2,
      ruleName: '人员交叉关联检测',
      summary: '检测到 2 条人员交叉证据：投标单位2与投标单位5的项目经理、技术负责人信息重复。',
      groups: [],
      cards: [
        {
          id: 'EVID-201',
          cardType: 'similarity',
          similarity: 100,
          similarityLevel: 'high',
          unitA: '投标单位2',
          unitB: '投标单位5',
          fileA: '示例建设企业己-商务标.pdf',
          fileB: '投标单位5-商务标.pdf',
          contentA: '项目经理：示例人员23\n身份证号：9900**********0001\n职务：项目负责人',
          contentB: '项目经理：示例人员23\n身份证号：9900**********0001\n职务：项目负责人',
        },
        {
          id: 'EVID-202',
          cardType: 'similarity',
          similarity: 100,
          similarityLevel: 'high',
          unitA: '投标单位2',
          unitB: '投标单位5',
          fileA: '示例建设企业己-商务标.pdf',
          fileB: '投标单位5-商务标.pdf',
          contentA: '技术负责人：示例人员24\n身份证号：9900**********0002\n职务：技术负责人',
          contentB: '技术负责人：示例人员24\n身份证号：9900**********0002\n职务：技术负责人',
        },
      ],
    },
  },
  {
    id: 'r4',
    docType: 'tender',
    riskLevel: 'high',
    categories: ['商务'],
    confidence: 94,
    title: '联系方式与地址关联检测：3 家单位共用同一注册地址及联系电话',
    description:
      '投标单位1、投标单位3、投标单位6的注册地址均为「示例市乙示例区示例路1号示例室」，且预留联系电话均为 0000-0000XXXX，高度疑似关联企业或围标串标。',
    ruleName: '联系方式与地址关联检测',
    involvedUnits: ['投标单位1', '投标单位3', '投标单位6'],
    detailDescription:
      '3 家投标单位注册地址完全一致，联系电话相同，联系人邮箱域名亦存在关联。综合判断存在显著围标串标风险特征。',
    aiSummary: '大模型分析认为联系方式与地址高度重合，风险等级高，建议作为重点线索移交核查。',
    aiRiskLevel: 'high',
    aiAnalysisItems: [
      {
        index: 1,
        title: '注册地址与电话重合',
        riskLevel: 'high',
        summary:
          '投标单位1、3、6注册地址均为「示例市乙示例区示例路1号示例室」，联系电话均为 0000-0000XXXX，邮箱后缀均为 @example.invalid。',
        involvedUnits: ['投标单位1', '投标单位3', '投标单位6'],
        judgmentBasis: '提取各投标文件封面及商务标中的地址、电话、邮箱字段进行精确匹配与模糊聚类。',
        reasonableExplanation: '同一办公园区或代理机构可能导致地址相近，但电话与邮箱同时一致的概率极低，需重点排除。',
        inspectionItems: [
          '工商登记信息比对股东及实际控制人',
          '现场走访注册地址核实实际办公情况',
          '调取通信记录及关联企业图谱',
        ],
        keyEvidence: [
          { unit: '投标单位1', detail: '地址：示例路1号示例室；电话：0000-0000XXXX' },
          { unit: '投标单位3', detail: '地址：示例路1号示例室；电话：0000-0000XXXX' },
          { unit: '投标单位6', detail: '地址：示例路1号示例室；电话：0000-0000XXXX' },
        ],
      },
    ],
    evidenceList: [
      { unit: '投标单位1', location: '商务标封面', detail: '示例路1号示例室' },
      { unit: '投标单位3', location: '商务标封面', detail: '同地址同电话' },
      { unit: '投标单位6', location: '商务标封面', detail: '同地址同电话' },
    ],
    llmEvidence: {
      evidenceType: '联系方式关联证据',
      sortMethod: 'contact_cluster',
      budget: '不限',
      totalAvailable: 3,
      actualSent: 3,
      ruleName: '联系方式与地址关联检测',
      summary: '检测到 3 条联系方式关联证据：3 家投标单位注册地址及联系电话完全一致。',
      groups: [],
      cards: [
        {
          id: 'EVID-101',
          cardType: 'similarity',
          similarity: 100,
          similarityLevel: 'high',
          unitA: '投标单位1',
          unitB: '投标单位3',
          fileA: '投标单位1-商务标.pdf',
          fileB: '投标单位3-商务标.pdf',
          contentA: '地址：示例市乙示例区示例路1号示例室\n电话：0000-0000XXXX\n邮箱：bid1@example.invalid',
          contentB: '地址：示例市乙示例区示例路1号示例室\n电话：0000-0000XXXX\n邮箱：bid3@example.invalid',
        },
        {
          id: 'EVID-102',
          cardType: 'similarity',
          similarity: 100,
          similarityLevel: 'high',
          unitA: '投标单位1',
          unitB: '投标单位6',
          fileA: '投标单位1-商务标.pdf',
          fileB: '投标单位6-商务标.pdf',
          contentA: '地址：示例市乙示例区示例路1号示例室\n电话：0000-0000XXXX\n邮箱：bid1@example.invalid',
          contentB: '地址：示例市乙示例区示例路1号示例室\n电话：0000-0000XXXX\n邮箱：bid6@example.invalid',
        },
        {
          id: 'EVID-103',
          cardType: 'similarity',
          similarity: 100,
          similarityLevel: 'high',
          unitA: '投标单位3',
          unitB: '投标单位6',
          fileA: '投标单位3-商务标.pdf',
          fileB: '投标单位6-商务标.pdf',
          contentA: '地址：示例市乙示例区示例路1号示例室\n电话：0000-0000XXXX\n邮箱：bid3@example.invalid',
          contentB: '地址：示例市乙示例区示例路1号示例室\n电话：0000-0000XXXX\n邮箱：bid6@example.invalid',
        },
      ],
    },
  },
  {
    id: 'r5',
    docType: 'tender',
    riskLevel: 'none',
    categories: ['报价'],
    confidence: 100,
    title: '报价梯度规律性检测：未发现风险',
    description: '本规则已完成检查，未发现明确风险问题。',
    ruleName: '报价梯度规律性检测',
    involvedUnits: ['示例建设企业乙', '示例建设企业己', '示例建设企业丁'],
    detailDescription: '本规则已完成检查，未发现明确风险问题。',
    aiSummary: '大模型分析认为当前内容未发现明显问题',
    aiRiskLevel: 'none',
    evidenceList: [
      { unit: '示例建设企业乙', location: '第4页 字符 944-969', detail: '报价条目数值分布正常' },
    ],
    llmEvidence: null,
  },
  {
    id: 'r6',
    docType: 'tender',
    riskLevel: 'none',
    categories: ['文本'],
    confidence: 100,
    title: '相同错误或异常表述检测：未发现风险',
    description: '大模型基于候选证据判断：未发现明显风险。',
    ruleName: '相同错误或异常表述检测',
    involvedUnits: ['示例建设企业乙', '示例建设企业己'],
    detailDescription: '本规则已完成检查，未发现明确风险问题。',
    aiSummary: '大模型分析认为当前内容未发现明显问题',
    aiRiskLevel: 'none',
    evidenceList: [],
    llmEvidence: null,
  },
]

/** 招投标联合分析规则结果 */
export const mockJointRuleResults = [
  {
    id: 'j-r1',
    docType: 'joint',
    riskLevel: 'high',
    categories: ['文件'],
    confidence: 88,
    title: '投标文件应废未废：1 家投标单位触发废标条款',
    description:
      '比对招标文件废标条款与投标文件响应情况，发现 1 家投标单位在重大偏差项上未响应实质性要求，但评标未予废标，存在应废未废风险。',
    ruleName: '投标文件应废未废',
    involvedUnits: ['示例建设企业乙'],
    detailDescription:
      '招标文件第 12 章列明重大偏差项 6 项；投标单位技术标中存在 2 项实质性未响应条款（关键工艺参数、安全方案完整性），按评标办法应予废标，但当前评审结果显示其仍参与评分排序。',
    aiSummary: '大模型分析认为该投标文件应按招标文件规定予以废标，但当前评标流程未触发废标判定，建议人工复核。',
    aiRiskLevel: 'high',
    aiAnalysisItems: [
      {
        index: 1,
        title: '关键工艺参数未实质性响应',
        riskLevel: 'high',
        summary: '招标文件要求「采用Ⅰ级响应」，投标文件实际为「Ⅱ级响应」，构成重大偏差。',
        involvedUnits: ['示例建设企业乙'],
        judgmentBasis: '对照招标文件中实质性要求与投标响应字段，发现技术参数等级降低。',
        reasonableExplanation: '投标方在澄清文件中未主动说明此偏差，评标流程未触发废标判定。',
        inspectionItems: ['复核评标办法第 8.3 条执行情况', '核实澄清答疑记录'],
        keyEvidence: [
          { unit: '招标文件', detail: '第 45 页：要求Ⅰ级响应' },
          { unit: '投标文件', detail: '第 12 页：实际为Ⅱ级响应' },
        ],
      },
    ],
    evidenceList: [
      { unit: '招标文件', location: '第 45 页 字符 320-512', detail: '实质性要求条款' },
      { unit: '投标文件', location: '第 12 页 字符 88-204', detail: '未响应条款' },
    ],
    llmEvidence: null,
  },
]

export const mockRuleResults = [
  ...mockBiddingRuleResults,
  ...mockTenderRuleResults,
  ...mockJointRuleResults,
]

export const mockBiddingFiles = [
  {
    id: 'bf1',
    name: '某市政工程招标文件.pdf',
    fileType: 'pdf',
    category: '招标文件',
    size: '2.4 MB',
    extractStatus: '已提取',
    metadata: '—',
  },
]

export const mockTenderFiles = [
  {
    id: 'tf1',
    name: '示例建设企业乙-技术.pdf',
    company: '示例建设企业乙',
    fileType: 'pdf',
    category: '技术标',
    categoryType: 'tech',
    size: '1.0 MB',
    extractStatus: '已提取',
    metadata: '—',
  },
  {
    id: 'tf2',
    name: '示例建设企业乙-报价.pdf',
    company: '示例建设企业乙',
    fileType: 'pdf',
    category: '报价标',
    categoryType: 'price',
    size: '227.0 KB',
    extractStatus: '已提取',
    metadata: '—',
  },
  {
    id: 'tf3',
    name: '示例建设企业己-技术标.pdf',
    company: '示例建设企业己',
    fileType: 'pdf',
    category: '技术标',
    categoryType: 'tech',
    size: '1.2 MB',
    extractStatus: '已提取',
    metadata: '—',
  },
  {
    id: 'tf4',
    name: '示例建设企业己-报价标.pdf',
    company: '示例建设企业己',
    fileType: 'pdf',
    category: '报价标',
    categoryType: 'price',
    size: '198.5 KB',
    extractStatus: '已提取',
    metadata: '—',
  },
  {
    id: 'tf5',
    name: '示例建设企业丁-技术.pdf',
    company: '示例建设企业丁',
    fileType: 'pdf',
    category: '技术标',
    categoryType: 'tech',
    size: '956.0 KB',
    extractStatus: '已提取',
    metadata: '—',
  },
  {
    id: 'tf6',
    name: '示例建设企业丁-报价.pdf',
    company: '示例建设企业丁',
    fileType: 'pdf',
    category: '报价标',
    categoryType: 'price',
    size: '210.3 KB',
    extractStatus: '已提取',
    metadata: '—',
  },
]

export const mockFileExtractResult = {
  fileName: '示例建设企业乙-技术.pdf',
  company: '示例建设企业乙',
  category: '技术标',
  extractStatus: '已提取',
  pageCount: 48,
  wordCount: 28560,
  tables: 12,
  images: 6,
  summary: '已完成文本抽取与结构化解析，可用于后续规则分析。',
}

/** 单文件抽取结构化结果（查看信息） */
export const mockFileExtractDetail = {
  warnings: ['已按文件分类过滤禁止抽取类型: pricing, qualifications, certificates'],
  sections: [
    {
      title: '商务条款',
      items: [
        {
          type: '工期',
          value: '根据招标文件及已有的资料要求，合理化安排施工顺序，优化资源配置。',
          confidence: 0.8,
          sectionTitle: '2.1工期部署',
          sourceText: '根据招标文件及已有的资料要求，合理化安排施工顺序，优化资源配置。',
        },
      ],
    },
    {
      title: '技术响应',
      items: [
        {
          type: '技术响应/方案/质量/进度/服务',
          value:
            '本整改工程将按照ISO9001质量标准体系建立项目的质量…保证达到本工程要求的工程质量等级、标准。',
          confidence: 0.8,
          sectionTitle: '二、质量保证措施',
          sourceText:
            '本整改工程将按照ISO9001质量标准体系建立项目的质量…保证达到本工程要求的工程质量等级、标准。',
        },
        {
          type: '技术响应/方案/质量/进度/服务',
          value:
            '工程施工中运用全面质量管理的方法，重点对5M1E(人、机、料、法、环、测)进行质量预控管理，运用PDCA…',
          confidence: 0.8,
          sectionTitle: '(二)、质量管理方法:',
          sourceText:
            '工程施工中运用全面质量管理的方法，重点对5M1E(人、机、料、法、环、测)进行质量预控管理，运用PDCA…',
        },
        {
          type: '技术响应/方案/质量/进度/服务',
          value:
            '想要提高项目上的质量管理，就要建立一套完善的质量管理体系…真正把质量管理这一行之有效的管理模式融入到项目每个员工的思想中去。',
          confidence: 0.8,
          sectionTitle: '(三)、工程质量保证措施',
          sourceText:
            '想要提高项目上的质量管理，就要建立一套完善的质量管理体系…真正把质量管理这一行之有效的管理模式融入到项目每个员工的思想中去。',
        },
      ],
    },
  ],
}

/** 招标文件抽取示例 */
export const mockBiddingFileExtractDetail = {
  warnings: [],
  sections: [
    {
      title: '资格条件',
      items: [
        {
          type: '资质要求',
          value: '投标人须具备市政公用工程施工总承包一级及以上资质，并持有有效的安全生产许可证。',
          confidence: 0.95,
          sectionTitle: '第三章 投标人资格要求',
          sourceText: '投标人须具备市政公用工程施工总承包一级及以上资质…',
        },
      ],
    },
    {
      title: '评分标准',
      items: [
        {
          type: '技术评分',
          value: '施工组织设计 30 分；项目管理机构 10 分；类似业绩 5 分。',
          confidence: 0.88,
          sectionTitle: '第四章 评标办法',
          sourceText: '施工组织设计 30 分；项目管理机构 10 分…',
        },
      ],
    },
  ],
}
