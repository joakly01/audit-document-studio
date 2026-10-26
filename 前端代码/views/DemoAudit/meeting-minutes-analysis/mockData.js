/**
 * 会议纪要分析页面 - 模拟数据生成器
 * 每个上传文件对应一个会议节点卡片
 */

// 聚类主题模板池
const clusterThemePool = [
  {
    name: '资金管理',
    topics: [
      { name: '项目资金拨付情况审议', content: '审议了本项目资金拨付进度及使用情况，截至目前已累计拨付资金，部分子项目存在超预算风险', money: '350' },
      { name: '预算执行偏差分析', content: '对本年度预算执行情况进行分析，发现实际支出与预算存在偏差，需调整下半年预算安排', money: '120' },
      { name: '专项资金使用审查', content: '审查了专项资金的使用合规性，要求各部门严格按照资金使用管理办法执行', money: '85' },
      { name: '工程款结算审批', content: '审批了第三期工程款结算申请，要求提供完整的工程量确认单和验收报告', money: '280' },
      { name: '资金使用效益评估', content: '评估了项目资金使用效益，对投入产出比进行了量化分析', money: '200' },
    ]
  },
  {
    name: '项目进度',
    topics: [
      { name: '工程进度检查通报', content: '通报了各子项目的施工进度情况，部分项目存在滞后，要求制定赶工方案', money: '' },
      { name: '里程碑节点验收', content: '对第二阶段里程碑节点进行了验收评审，基本达到预期目标', money: '' },
      { name: '工期调整方案讨论', content: '因不可抗力因素影响，讨论了工期调整方案，拟延期30个工作日', money: '' },
      { name: '季度进度总结', content: '总结了本季度项目推进情况，明确了下季度重点工作任务', money: '' },
    ]
  },
  {
    name: '风险控制',
    topics: [
      { name: '项目风险评估报告', content: '听取了项目风险评估报告，识别了资金链、工期延误、质量隐患等主要风险点', money: '' },
      { name: '合规性审查结果', content: '汇报了项目合规性审查结果，发现部分合同条款存在法律风险需修订', money: '' },
      { name: '安全生产专项检查', content: '通报了安全生产专项检查情况，要求立即整改发现的安全隐患', money: '' },
      { name: '风险应对措施落实', content: '检查了前期识别风险的应对措施落实情况，部分措施执行不到位', money: '' },
    ]
  },
  {
    name: '人员配置',
    topics: [
      { name: '项目团队调整方案', content: '讨论了项目团队人员调整方案，拟增补技术骨干和管理人员', money: '' },
      { name: '外部专家聘请审批', content: '审批了外部专家聘请方案，拟聘请行业专家参与技术指导和评审', money: '15' },
      { name: '培训计划安排', content: '安排了项目团队专业技能培训计划，提升团队整体能力', money: '8' },
    ]
  },
  {
    name: '制度建设',
    topics: [
      { name: '内部管理制度修订', content: '讨论了内部管理制度修订草案，重点完善了审批流程和权限划分', money: '' },
      { name: '绩效考核方案调整', content: '调整了项目绩效考核方案，增加了质量指标和安全指标的权重', money: '' },
      { name: '档案管理规范制定', content: '制定了项目档案管理规范，明确了归档范围、格式和时限要求', money: '' },
    ]
  },
  {
    name: '工程质量',
    topics: [
      { name: '质量检测报告审议', content: '审议了第三方质量检测报告，部分指标需进一步复检确认', money: '' },
      { name: '材料采购合规审查', content: '审查了材料采购流程的合规性，要求完善供应商资质审核机制', money: '95' },
      { name: '质量整改方案审批', content: '审批了质量问题整改方案，明确了整改措施、责任人和完成时限', money: '45' },
    ]
  },
]

// 参会人员池
const attendeePool = ['示例人员07', '示例人员08', '示例人员10', '示例人员02', '示例人员15', '示例人员12', '示例人员05', '示例人员04', '示例人员03', '示例人员13', '示例人员14', '示例人员01']
// 列席人员池
const observerPool = ['示例人员16', '示例人员17', '示例人员09', '示例人员11', '示例人员06']

// 从数组中随机取 count 个元素
function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, arr.length))
}

// 根据索引生成日期
function generateDate(index) {
  const baseDate = new Date(2026, 0, 5)
  baseDate.setDate(baseDate.getDate() + index * 3)
  const y = baseDate.getFullYear()
  const m = String(baseDate.getMonth() + 1).padStart(2, '0')
  const d = String(baseDate.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

// 从文件名生成会议名称
function generateMeetingName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '')
}

/**
 * 根据上传的文件名列表生成模拟会议数据
 * @param {string[]} fileNames - 上传的文件名列表
 * @param {number} maxClusterSize - 最大聚类数
 * @returns {Array} 会议数据数组
 */
export function generateMockMeetings(fileNames, maxClusterSize = 2) {
  // 选取不超过 maxClusterSize 个聚类主题
  const selectedThemes = pickRandom(clusterThemePool, Math.min(maxClusterSize, clusterThemePool.length))

  const meetings = fileNames.map((fileName, index) => {
    const date = generateDate(index)
    const meetingName = generateMeetingName(fileName)
    const attendees = pickRandom(attendeePool, 3 + Math.floor(Math.random() * 3))
    const observers = pickRandom(observerPool, 1 + Math.floor(Math.random() * 2))

    // 每个会议随机分配 1 ~ maxClusterSize 个聚类主题
    const themesForMeeting = pickRandom(selectedThemes, 1 + Math.floor(Math.random() * selectedThemes.length))

    const fullTopics = []
    const topicList = []

    themesForMeeting.forEach(theme => {
      // 每个主题取 1~3 个议题
      const topicsFromTheme = pickRandom(theme.topics, 1 + Math.floor(Math.random() * 2))

      const details = topicsFromTheme.map(t => `[${theme.name}] ${t.name}`)
      topicList.push({
        title: `${theme.name}相关议题`,
        details
      })

      topicsFromTheme.forEach(t => {
        fullTopics.push({
          topicName: t.name,
          topicContent: t.content,
          clusterName: theme.name,
          money: t.money,
        })
      })
    })

    return {
      date,
      meetingName,
      fileName,
      count: 1,
      topics: fullTopics.length,
      topicList,
      fullTopics,
      attendees,
      observers,
    }
  })

  return meetings
}
