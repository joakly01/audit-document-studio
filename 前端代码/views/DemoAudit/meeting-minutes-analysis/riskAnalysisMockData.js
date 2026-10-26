/**
 * 风险分析报告 - 原型演示数据
 * 结构依据 meeting-minutes-audit SKILL（08-output-report-structure）
 * 注:附录节点已从前端与导出模板同时删除(REPORT_SECTIONS 已废弃,由 RiskAnalysisPanel 内部 sections 替代)
 */

export { ECONOMIC_CATEGORY_MAP } from './topicFieldUtils.js'

export const mockRiskReport = {
  overview: {
    title: '会议纪要经济审计分析报告',
    generatedAt: '2026-06-24 14:30',
    meetingCount: 5,
    dateRange: '2026-01-05 至 2026-01-17',
    meetingTypes: ['党委会', '总经理办公会', '董事会'],
    economicItemCount: 12,
    findingCount: 4,
    riskStats: { levelHigh: 1, levelMedium: 3, levelMediumLow: 0, levelLow: 0, pending: 0 },
    summary:
      '本次共审查 5 份会议纪要，识别经济议题 12 项（土地 2、资产 2、资金 3、项目 3、政策 1、担保/债务 1）。经逐项对照 12 种经济风险模式分析，形成发现 4 条，其中高危 1 条、中危 3 条。主要风险集中在规避招标、资金拨付程序及跨会议金额变动等方面。',
  },
  timeline: [
    { date: '2026-01-05', type: '党委会', topic: '土地出让及配套项目建设', fileName: '2026年第1次党委会纪要.pdf' },
    { date: '2026-01-08', type: '总经理办公会', topic: '第三期工程款结算', fileName: '2026年第2次总经理办公会纪要.docx' },
    { date: '2026-01-11', type: '董事会', topic: '重大资产处置审议', fileName: '2026年第1次董事会纪要.pdf' },
    { date: '2026-01-14', type: '党委会', topic: '专项资金拨付与借款担保', fileName: '2026年第2次党委会纪要.pdf' },
    { date: '2026-01-17', type: '总经理办公会', topic: '信息化采购项目立项', fileName: '2026年第3次总经理办公会纪要.docx' },
  ],
  economicItems: [
    {
      category: 'LAND',
      items: [
        { no: 1, name: '城东地块出让及收储', meetings: 'm001', amount: 12800, counterparty: '某置业有限公司', decision: '同意', riskFlag: '高危' },
        { no: 2, name: '工业用地指标调剂', meetings: 'm001', amount: null, counterparty: '某开发区管委会', decision: '审议', riskFlag: '中危' },
      ],
    },
    {
      category: 'ASSET',
      items: [
        { no: 1, name: '闲置办公楼资产转让', meetings: 'm003', amount: 480, counterparty: '某资产管理公司', decision: '批准', riskFlag: '中危' },
        { no: 2, name: '公务车辆报废处置', meetings: 'm003', amount: 12, counterparty: '某回收公司', decision: '同意', riskFlag: '无风险' },
      ],
    },
    {
      category: 'FUND',
      items: [
        { no: 1, name: '第三期工程款拨付', meetings: 'm002, m004', amount: 350, counterparty: '某建设集团', decision: '同意拨付', riskFlag: '中危' },
        { no: 2, name: '产业扶持专项资金补助', meetings: 'm004', amount: 200, counterparty: '某科技公司', decision: '批准', riskFlag: '无风险' },
        { no: 3, name: '应急周转金借款', meetings: 'm004', amount: 500, counterparty: '某城投平台', decision: '同意', riskFlag: '高危' },
      ],
    },
    {
      category: 'PROJECT',
      items: [
        { no: 1, name: '信息化系统升级改造', meetings: 'm005', amount: 186, counterparty: '某信息科技公司', decision: '同意立项', riskFlag: '中危' },
        { no: 2, name: '园区道路改造工程', meetings: 'm002', amount: 420, counterparty: '某市政工程公司', decision: '直接委托', riskFlag: '中危' },
        { no: 3, name: '监理服务采购', meetings: 'm002', amount: 38, counterparty: '某监理公司', decision: '同意', riskFlag: '无风险' },
      ],
    },
    {
      category: 'POLICY',
      items: [
        { no: 1, name: '国企改革三年行动方案落实', meetings: 'm001', amount: null, counterparty: '-', decision: '审议通过', riskFlag: '无风险' },
      ],
    },
    {
      category: 'GUARANTEE',
      items: [
        { no: 1, name: '为子公司银行贷款提供担保', meetings: 'm004', amount: 3000, counterparty: '某子公司', decision: '同意担保', riskFlag: '无风险' },
      ],
    },
  ],
  findings: [
    {
      id: 'F-PROJ-001',
      topic: '园区道路改造工程',
      category: 'PROJECT',
      amount: 420,
      riskPattern: '模式3：规避招标（化整为零/直接委托）',
      source: '2026年第2次总经理办公会纪要.docx | 2026-01-08 | 总经理办公会 | 议题三',
      quote: '会议同意以直接委托方式，将园区道路改造工程（预算420万元）交由某市政工程公司实施，理由为工期紧迫。',
      facts: '420万元道路改造工程未经公开招标，以"工期紧迫"为由直接委托某市政工程公司实施，未见法定豁免依据材料。',
      analysis:
        '该事项预算420万元，超过施工类招标限额400万元。会议纪要仅载明"工期紧迫"，未引用《招标投标法》第66条规定的法定豁免情形，不符合直接委托条件，存在规避招标风险。',
      regulations: ['《中华人民共和国招标投标法》第3条：必须进行招标的项目范围', '《中华人民共和国招标投标法》第66条：法定招标豁免情形'],
      crossMeeting: '仅在本次会议出现，未见后续招标补办记录。',
      level: '中危',
      levelLabel: '中危',
      levelReason: '420万超施工招标限额400万（5%），且无法定豁免依据。',
      suggestion: '由审计部门30日内复核该工程立项与造价依据，追溯决策审批过程，督促补办招标或说明合法性依据。',
    },
    {
      id: 'F-FUND-001',
      topic: '第三期工程款拨付',
      category: 'FUND',
      amount: 350,
      riskPattern: '模式7：资金挪用/超进度拨付',
      source: '2026年第2次总经理办公会纪要.docx | 2026-01-08 | 总经理办公会 | 议题二',
      quote: '同意拨付第三期工程款350万元，要求财务部门一周内完成支付。',
      facts: '2026年1月8日会议同意拨付350万元，但同项目在前次党委会（1月14日）记录中累计拨付口径存在差异。',
      analysis:
        '跨会议比对发现，同一项目拨付金额由320万元调整为350万元，变动30万元未见补充论证材料。结合工程进度报告缺失，存在超进度拨付及资金管控不严风险。',
      regulations: ['《基本建设财务规则》第23条：工程款支付应与工程进度匹配', '《政府投资条例》第22条：政府投资项目资金拨付程序'],
      crossMeeting: 'm002（350万同意拨付）→ m004（纪要回顾称累计已拨320万），金额口径矛盾。',
      level: '中危',
      levelLabel: '中危',
      levelReason: '跨会议金额表述不一致，且缺乏进度核验材料。',
      suggestion: '由财务与工程管理部门7个工作日内核对拨付台账，补齐工程量确认单，并向审计机关书面说明差异原因。',
    },
    {
      id: 'F-LAND-001',
      topic: '城东地块出让及收储',
      category: 'LAND',
      amount: 12800,
      riskPattern: '模式1：隐性债务（回购/变相融资）',
      source: '2026年第1次党委会纪要.pdf | 2026-01-05 | 党委会 | 议题一',
      quote: '原则同意城东地块出让方案，由平台公司以先摘地、后回购方式推进，回购价格按成本加合理收益确定。',
      facts: '地块出让涉及金额1.28亿元，纪要载明平台公司摘地后由政府关联主体回购，回购价按"成本+合理收益"确定。',
      analysis:
        '“先摘地、后回购”安排如由财政或政府承诺回购，可能构成变相举债，触及隐性债务管控红线。需核查回购主体、资金来源及是否纳入债务预算管理。',
      regulations: ['《国务院关于加强地方政府性债务管理的意见》国发〔2014〕43号', '《财政部关于进一步规范地方政府举债融资行为的通知》财预〔2017〕50号'],
      crossMeeting: '仅在本次会议出现。',
      level: '高危',
      levelLabel: '高危',
      levelReason: '涉及政府回购安排，存在隐性债务认定风险，金额1.28亿元。',
      suggestion: '立即暂停回购条款执行，由法务与财政部门15日内出具合规审查意见，并按程序报上级主管部门备案。',
    },
    {
      id: 'F-PROJ-002',
      topic: '信息化系统升级改造',
      category: 'PROJECT',
      amount: 186,
      riskPattern: '模式9：化整为零（拆分采购）',
      source: '2026年第3次总经理办公会纪要.docx | 2026-01-17 | 总经理办公会 | 议题一',
      quote: '同意信息化系统升级改造分三期实施，首期采购金额86万元，二期、三期另行审议。',
      facts: '同一信息化升级项目拆分为三期，首期86万元单独审议，若二三期同类采购累计可能超过服务类招标限额200万元。',
      analysis:
        '短期内对同一供应商的连续采购如属同一项目拆分，可能构成化整为零规避招标。需核查二三期预算及供应商关联关系。',
      regulations: ['《中华人民共和国招标投标法》第4条：不得化整为零规避招标', '《政府采购法实施条例》第28条：项目拆分适用'],
      crossMeeting: 'm005 首次出现，二三期尚未审议。',
      level: '中危',
      levelLabel: '中危',
      levelReason: '存在拆分采购规避招标嫌疑，需进一步核查累计金额。',
      suggestion: '由采购管理部门10日内提供项目总预算及分期依据，合并测算是否应公开招标。',
    },
  ],
  crossMeetingTracks: [
    {
      itemName: '第三期工程款拨付',
      category: 'FUND',
      chain: [
        { date: '2026-01-08', meeting: '总经理办公会', amount: 350, decision: '同意拨付350万' },
        { date: '2026-01-14', meeting: '党委会', amount: 320, decision: '回顾称累计拨付320万' },
      ],
      issues: ['金额变化：350万 vs 320万口径矛盾', '决策反复：未见金额调整说明'],
    },
    {
      itemName: '园区道路改造工程',
      category: 'PROJECT',
      chain: [
        { date: '2026-01-08', meeting: '总经理办公会', amount: 420, decision: '直接委托实施' },
      ],
      issues: ['仅在单次会议出现，未见招标程序'],
    },
  ],
  riskSummary: [
    { id: 'F-PROJ-001', topic: '园区道路改造工程', category: 'PROJECT', pattern: '规避招标', level: '中危', meeting: '总经理办公会' },
    { id: 'F-FUND-001', topic: '第三期工程款拨付', category: 'FUND', pattern: '资金挪用/超进度拨付', level: '中危', meeting: '总经理办公会' },
    { id: 'F-LAND-001', topic: '城东地块出让及收储', category: 'LAND', pattern: '隐性债务', level: '高危', meeting: '党委会' },
    { id: 'F-PROJ-002', topic: '信息化系统升级改造', category: 'PROJECT', pattern: '化整为零', level: '中危', meeting: '总经理办公会' },
  ],
  conclusion: {
    text: '综合审查，5份会议纪要中共识别经济议题12项，形成审计发现4条。城东地块出让回购安排涉嫌隐性债务（高危），应优先处置；道路工程直接委托、工程款拨付口径矛盾及信息化项目拆分采购等问题需限期整改。建议建立经济议题台账与跨会议追踪机制，重大资金资产事项严格执行招标采购及集体决策程序。',
    suggestions: [
      { findingId: 'F-LAND-001', text: '暂停地块回购条款，15日内完成隐性债务合规审查。' },
      { findingId: 'F-PROJ-001', text: '30日内补办园区道路工程招标或提供合法直接委托依据。' },
      { findingId: 'F-FUND-001', text: '7日内核对工程款拨付台账并书面说明跨会议金额差异。' },
      { findingId: 'F-PROJ-002', text: '10日内提供信息化项目总预算，评估是否应合并招标。' },
    ],
  },
}
