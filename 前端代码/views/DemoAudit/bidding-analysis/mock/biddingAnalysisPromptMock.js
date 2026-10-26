/** 招投标分析 — 规则默认提示词与平台提示词树 Mock（原型） */

const buildDefaultPrompt = (ruleName, focus) =>
  `你是一名招投标合规审计助手。请基于提供的文档内容，执行「${ruleName}」检查。\n\n检查重点：${focus}\n\n输出要求：\n1. 给出风险等级（高/中/低/无）及置信度；\n2. 说明判定依据与关键证据位置；\n3. 若无明显问题，明确写「未发现风险」。`

/** 原型：平台提示词树（后续对接 getPromptTreeByFunctionTypeNewAPI） */
export const mockBiddingPromptTree = [
  {
    id: 'folder-bidding',
    name: '招标文件分析',
    isPrompt: false,
    children: [
      {
        id: 'prompt-b1',
        name: '资格合规性-标准模板',
        isPrompt: true,
        content: buildDefaultPrompt('资格合规性', '核对投标人资质、业绩、人员等条件是否与法规及项目要求一致，识别排斥性或歧视性条款。'),
      },
      {
        id: 'prompt-b5',
        name: '倾向性条款-严格模板',
        isPrompt: true,
        content: buildDefaultPrompt('倾向性条款检测', '重点识别指定品牌、型号、专利壁垒及不合理参数指标，评估是否限制充分竞争。'),
      },
    ],
  },
  {
    id: 'folder-tender',
    name: '投标文件分析',
    isPrompt: false,
    children: [
      {
        id: 'prompt-t5',
        name: '围标串标-关联分析模板',
        isPrompt: true,
        content: buildDefaultPrompt('围标串标风险识别', '比对各投标单位元数据、联系方式、人员、文本相似度等，识别异常关联与串标特征。'),
      },
    ],
  },
  {
    id: 'folder-joint',
    name: '联合分析',
    isPrompt: false,
    children: [
      {
        id: 'prompt-j1',
        name: '应废未废-对照模板',
        isPrompt: true,
        content: buildDefaultPrompt('投标文件应废未废', '对照招标文件实质性要求与废标条款，检查投标文件是否存在应废未废情形。'),
      },
    ],
  },
]

export { buildDefaultPrompt }
