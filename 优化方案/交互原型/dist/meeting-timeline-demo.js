'use strict';
// Isolated, deterministic examples. Their DOCX sources reproduce every displayed excerpt.
const MEETING_TIMELINE_DEMO_VERSION=1;
const MEETING_TIMELINE_DEMO_TASK_ID='demo-meeting-timeline-v1';
const MEETING_TIMELINE_DEMO_MARKER='audit-meeting-timeline-demo-version';
const MEETING_TIMELINE_DEMO_SOURCES=Object.freeze({
  "meeting-timeline-demo-doc-v1-01": {
    "id": "meeting-timeline-demo-doc-v1-01",
    "name": "01-第1次园区改造项目专题会纪要.docx",
    "path": "source-files/meeting-timeline/01.docx",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 2537,
    "sha256": "0e248f573784483d90f0aa67a47a0cb60d558ebab735d62ba51b8ebd150649d1",
    "title": "01-第1次园区改造项目专题会纪要",
    "text": "01-第1次园区改造项目专题会纪要\n演示资料：以下内容为虚构的园区改造项目会议纪要，仅用于体验会议时间轴、同类议题追踪和原文核对功能，不构成实际审计事实。\n\n第1次园区改造项目专题会\n会议日期：2026-01-08\n参会人员：张华、李宁、王敏\n列席人员：赵磊、陈静\n议题1：年度资金计划与支付前提\n同类事项：预算调整与资金支付\n会议审议年度设备采购资金安排，暂按120万元控制。财务部门应核对预算批复，合同签订及验收手续齐全后方可申请支付。\n涉及金额（万元）：120\n责任部门：财务部；要求时限：2026-01-20；办理阶段：拟定方案\n议题2：设备采购需求论证\n同类事项：设备采购与验收\n会议要求采购部补充设备型号、数量及需求依据，组织使用部门论证后启动采购。采购预算暂按120万元控制。\n涉及金额（万元）：120\n责任部门：采购部；要求时限：2026-01-20；办理阶段：需求论证\n议题3：施工准备与场地移交\n同类事项：改造工程进度\n会议要求项目部完成施工场地移交和管线核查，形成施工准备清单；尚未明确的交付时间应在下次会议报告。\n涉及金额（万元）：未载明\n责任部门：项目部；要求时限：2026-01-22；办理阶段：施工准备",
    "meetingIds": [
      "demo-meeting-v1-01"
    ]
  },
  "meeting-timeline-demo-doc-v1-02": {
    "id": "meeting-timeline-demo-doc-v1-02",
    "name": "02-第2次园区改造项目专题会纪要.docx",
    "path": "source-files/meeting-timeline/02.docx",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 2531,
    "sha256": "8307a75263fac7254d70e30ccba5be441efb7f99eee845bc5317061f6efb2133",
    "title": "02-第2次园区改造项目专题会纪要",
    "text": "02-第2次园区改造项目专题会纪要\n演示资料：以下内容为虚构的园区改造项目会议纪要，仅用于体验会议时间轴、同类议题追踪和原文核对功能，不构成实际审计事实。\n\n第2次园区改造项目专题会\n会议日期：2026-01-22\n参会人员：张华、李宁、王敏\n列席人员：陈静、周涛\n议题1：新增设备需求与预算调整\n同类事项：预算调整与资金支付\n会议听取新增备用设备需求说明，预计总额由120万元调整为128万元。会议要求先取得预算调整批复，未批复前不得按增加额签约。\n涉及金额（万元）：128\n责任部门：财务部；要求时限：2026-02-05；办理阶段：申请调整\n议题2：采购方案与评审要求\n同类事项：设备采购与验收\n会议审议设备采购方案，要求在预算调整批复后组织采购，并完整记录评审过程及供应商响应情况。\n涉及金额（万元）：128\n责任部门：采购部；要求时限：2026-02-05；办理阶段：采购准备\n议题3：采购资料归档责任\n同类事项：整改与责任落实\n会议要求采购部建立归档清单，项目部和财务部按职责提供需求论证、预算批复和审批记录，由陈静每月核对缺项。\n涉及金额（万元）：未载明\n责任部门：综合部；要求时限：2026-02-05；办理阶段：明确责任",
    "meetingIds": [
      "demo-meeting-v1-02"
    ]
  },
  "meeting-timeline-demo-doc-v1-03": {
    "id": "meeting-timeline-demo-doc-v1-03",
    "name": "03-2026年2月5日专题会与采购协调会纪要.docx",
    "path": "source-files/meeting-timeline/03.docx",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 2979,
    "sha256": "508df5f552a6b0ea23d73b6771c3a69fe47ec7ca6742e95ee40ad2798ccbfc76",
    "title": "03-2026年2月5日专题会与采购协调会纪要",
    "text": "03-2026年2月5日专题会与采购协调会纪要\n演示资料：以下内容为虚构的园区改造项目会议纪要，仅用于体验会议时间轴、同类议题追踪和原文核对功能，不构成实际审计事实。\n\n第3次园区改造项目专题会（上午）\n会议日期：2026-02-05\n参会人员：张华、李宁、赵磊\n列席人员：王敏、陈静\n议题1：预算调整批复及合同控制价\n同类事项：预算调整与资金支付\n会议确认已收到预算调整批复，总额128万元。采购合同金额不得超过批复，付款申请须附合同、预算批复及审批记录。\n涉及金额（万元）：128\n责任部门：财务部；要求时限：2026-02-12；办理阶段：批复确认\n议题2：施工计划与交付节点\n同类事项：改造工程进度\n会议确认施工场地已移交，要求项目部提交分区施工计划，优先完成设备安装区域，并按周报告影响工期的事项。\n涉及金额（万元）：未载明\n责任部门：项目部；要求时限：2026-02-12；办理阶段：排定节点\n议题3：首次归档核对与缺项补充\n同类事项：整改与责任落实\n会议听取首次归档核对，现有目录缺少两份需求论证签字页。要求采购部补齐并提交综合部核对，不以扫描汇总件替代应有审批记录。\n涉及金额（万元）：未载明\n责任部门：采购部；要求时限：2026-02-12；办理阶段：补充资料\n\n第1次设备采购协调会（下午）\n会议日期：2026-02-05\n参会人员：王敏、周涛、陈静\n列席人员：李宁\n议题1：采购合同验收条款核对\n同类事项：设备采购与验收\n协调会要求合同明确到货清单、安装调试、质量检验及验收记录要求，验收由使用部门、项目部共同签字，合同控制价128万元。\n涉及金额（万元）：128\n责任部门：采购部；要求时限：2026-02-12；办理阶段：核对条款\n议题2：设备安装区域交付安排\n同类事项：改造工程进度\n协调会要求项目部先行交付设备安装区域，施工单位应列明电源、承重和通风条件，条件未确认前不安排集中到货。\n涉及金额（万元）：未载明\n责任部门：项目部；要求时限：2026-02-18；办理阶段：协调安装\n议题3：联合验收职责分工\n同类事项：整改与责任落实\n协调会明确由项目部组织联合验收，采购部核对供货清单，使用部门确认功能，财务部核对付款材料；发现差异应形成书面记录。\n涉及金额（万元）：未载明\n责任部门：项目部；要求时限：2026-03-03；办理阶段：落实分工",
    "meetingIds": [
      "demo-meeting-v1-03",
      "demo-meeting-v1-04"
    ]
  },
  "meeting-timeline-demo-doc-v1-04": {
    "id": "meeting-timeline-demo-doc-v1-04",
    "name": "04-第4次园区改造项目专题会纪要.docx",
    "path": "source-files/meeting-timeline/04.docx",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 2594,
    "sha256": "23bb14dc881fa526195782554d4dc84120e1f2f0433d704a5e4c774dec8e4aa9",
    "title": "04-第4次园区改造项目专题会纪要",
    "text": "04-第4次园区改造项目专题会纪要\n演示资料：以下内容为虚构的园区改造项目会议纪要，仅用于体验会议时间轴、同类议题追踪和原文核对功能，不构成实际审计事实。\n\n第4次园区改造项目专题会\n会议日期：2026-03-03\n参会人员：张华、王敏、赵磊\n列席人员：李宁、周涛\n议题1：设备到货与首期付款申请\n同类事项：预算调整与资金支付\n会议听取设备分批到货情况，供应商申请首期付款64万元。会议要求财务部逐项核对合同付款节点和到货签收记录，资料不齐的不予提交支付。\n涉及金额（万元）：64\n责任部门：财务部；要求时限：2026-03-10；办理阶段：核对支付条件\n议题2：到货清单与功能测试差异\n同类事项：设备采购与验收\n会议听取到货核对，供货清单与合同数量一致，但两台备用设备尚未完成连续运行测试。要求保留测试记录，验收结论不得提前签署。\n涉及金额（万元）：128\n责任部门：项目部；要求时限：2026-03-18；办理阶段：到货核对\n议题3：安装区域延期与赶工计划\n同类事项：改造工程进度\n会议听取安装区域部分管线改造延后情况，要求施工单位提交赶工计划。涉及合同工期调整的，应单独履行审批程序并记录原因。\n涉及金额（万元）：未载明\n责任部门：项目部；要求时限：2026-03-10；办理阶段：调整进度",
    "meetingIds": [
      "demo-meeting-v1-05"
    ]
  },
  "meeting-timeline-demo-doc-v1-05": {
    "id": "meeting-timeline-demo-doc-v1-05",
    "name": "05-第5次园区改造项目专题会纪要.docx",
    "path": "source-files/meeting-timeline/05.docx",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 2590,
    "sha256": "930b20de9e895717ef4064e91cab89851fcd622b91c8421b3d4cb86ea8f0efd1",
    "title": "05-第5次园区改造项目专题会纪要",
    "text": "05-第5次园区改造项目专题会纪要\n演示资料：以下内容为虚构的园区改造项目会议纪要，仅用于体验会议时间轴、同类议题追踪和原文核对功能，不构成实际审计事实。\n\n第5次园区改造项目专题会\n会议日期：2026-03-24\n参会人员：张华、李宁、王敏\n列席人员：赵磊、陈静\n议题1：首期支付结果与余款审核\n同类事项：预算调整与资金支付\n会议确认首期款64万元已按审批手续支付。后续余款应与联合验收结果相衔接，财务部核对合同约定后再提出支付意见。\n涉及金额（万元）：64\n责任部门：财务部；要求时限：2026-04-16；办理阶段：支付后跟踪\n议题2：联合验收结论与待办事项\n同类事项：设备采购与验收\n会议确认备用设备连续运行测试完成，联合验收记录已签署。设备培训签到和操作手册移交仍需补齐，采购部应逐项跟踪关闭。\n涉及金额（万元）：128\n责任部门：采购部；要求时限：2026-04-05；办理阶段：完成联合验收\n议题3：需求签字页整改核对\n同类事项：整改与责任落实\n会议听取需求论证签字页已补齐的情况，要求综合部核对原件与归档件一致性，并对验收培训资料缺项继续建立整改台账。\n涉及金额（万元）：未载明\n责任部门：综合部；要求时限：2026-04-05；办理阶段：跟踪整改",
    "meetingIds": [
      "demo-meeting-v1-06"
    ]
  },
  "meeting-timeline-demo-doc-v1-06": {
    "id": "meeting-timeline-demo-doc-v1-06",
    "name": "06-第6次园区改造项目专题会纪要.docx",
    "path": "source-files/meeting-timeline/06.docx",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 2588,
    "sha256": "72838d404cea7207a49ed9d6608de50705eb10753012a539b0c80665d87f6f4d",
    "title": "06-第6次园区改造项目专题会纪要",
    "text": "06-第6次园区改造项目专题会纪要\n演示资料：以下内容为虚构的园区改造项目会议纪要，仅用于体验会议时间轴、同类议题追踪和原文核对功能，不构成实际审计事实。\n\n第6次园区改造项目专题会\n会议日期：2026-04-16\n参会人员：张华、李宁、赵磊\n列席人员：王敏、陈静\n议题1：累计支付与质保金安排\n同类事项：预算调整与资金支付\n会议听取设备采购累计支付115.2万元，合同金额128万元，剩余12.8万元按合同约定保留。会议要求核对质保金释放条件和到期提醒，不将剩余款自动视为可支付金额。\n涉及金额（万元）：115.2\n责任部门：财务部；要求时限：2026-04-30；办理阶段：核对剩余款\n议题2：改造项目交付与遗留事项\n同类事项：改造工程进度\n会议听取改造区域已投入使用，要求项目部完成竣工资料核对和遗留事项交接。未完成事项继续登记责任人及办结期限。\n涉及金额（万元）：未载明\n责任部门：项目部；要求时限：2026-04-30；办理阶段：交付跟踪\n议题3：整改台账阶段核对\n同类事项：整改与责任落实\n会议确认培训签到、操作手册和需求签字页已完成归档。综合部应保留核对记录，尚未到期的质保和维护事项转入后续跟踪清单。\n涉及金额（万元）：未载明\n责任部门：综合部；要求时限：2026-04-30；办理阶段：阶段核对",
    "meetingIds": [
      "demo-meeting-v1-07"
    ]
  },
  "meeting-timeline-demo-doc-v1-07": {
    "id": "meeting-timeline-demo-doc-v1-07",
    "name": "07-设备运维补充协调会纪要-日期待核对.docx",
    "path": "source-files/meeting-timeline/07.docx",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 2563,
    "sha256": "eb16f55e63ae761404bcdd3a893272cae7f688250ec1f64f2284bad448a73461",
    "title": "07-设备运维补充协调会纪要-日期待核对",
    "text": "07-设备运维补充协调会纪要-日期待核对\n演示资料：以下内容为虚构的园区改造项目会议纪要，仅用于体验会议时间轴、同类议题追踪和原文核对功能，不构成实际审计事实。\n\n设备运维补充协调会（原件未载明日期）\n会议日期：原件未载明，待核对\n参会人员：王敏、赵磊\n列席人员：陈静、周涛\n议题1：运维交接与备用设备记录\n同类事项：设备采购与验收\n补充协调会讨论备用设备运维交接，要求核对设备序列号、保修范围和操作手册版本。纪要原件未载明会议日期，无法据此判断与其他会议的先后关系。\n涉及金额（万元）：未载明\n责任部门：采购部；要求时限：未载明；办理阶段：运维核对\n议题2：配套区域后续维护安排\n同类事项：改造工程进度\n补充协调会要求项目部整理配套区域维护联系表，列明报修渠道、职责和交接材料。原件未载明会议日期及维护费用，不据此推定工期或金额。\n涉及金额（万元）：未载明\n责任部门：项目部；要求时限：未载明；办理阶段：维护安排\n议题3：补充纪要日期与附件核对\n同类事项：整改与责任落实\n补充协调会纪要缺少会议日期及部分附件编号。要求资料提供方核对原件、补充说明并保留更正记录，核实前不补写日期。\n涉及金额（万元）：未载明\n责任部门：综合部；要求时限：未载明；办理阶段：待补充说明",
    "meetingIds": [
      "demo-meeting-v1-08"
    ]
  }
});
const MEETING_TIMELINE_DEMO_ROWS=Object.freeze([
  {
    "doc": "meeting-timeline-demo-doc-v1-01",
    "meetingId": "demo-meeting-v1-01",
    "title": "第1次园区改造项目专题会",
    "date": "2026-01-08",
    "topic": "预算调整与资金支付",
    "topicName": "年度资金计划与支付前提",
    "amount": "120",
    "unit": "财务部",
    "excerpt": "会议审议年度设备采购资金安排，暂按120万元控制。财务部门应核对预算批复，合同签订及验收手续齐全后方可申请支付。",
    "participants": "张华、李宁、王敏",
    "observers": "赵磊、陈静",
    "agenda": 1,
    "rowId": "demo-meeting-v1-01-agenda-1",
    "extraFields": {
      "责任部门": "财务部",
      "要求时限": "2026-01-20",
      "办理阶段": "拟定方案"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-01",
    "meetingId": "demo-meeting-v1-01",
    "title": "第1次园区改造项目专题会",
    "date": "2026-01-08",
    "topic": "设备采购与验收",
    "topicName": "设备采购需求论证",
    "amount": "120",
    "unit": "采购部",
    "excerpt": "会议要求采购部补充设备型号、数量及需求依据，组织使用部门论证后启动采购。采购预算暂按120万元控制。",
    "participants": "张华、李宁、王敏",
    "observers": "赵磊、陈静",
    "agenda": 2,
    "rowId": "demo-meeting-v1-01-agenda-2",
    "extraFields": {
      "责任部门": "采购部",
      "要求时限": "2026-01-20",
      "办理阶段": "需求论证"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-01",
    "meetingId": "demo-meeting-v1-01",
    "title": "第1次园区改造项目专题会",
    "date": "2026-01-08",
    "topic": "改造工程进度",
    "topicName": "施工准备与场地移交",
    "amount": "",
    "unit": "项目部",
    "excerpt": "会议要求项目部完成施工场地移交和管线核查，形成施工准备清单；尚未明确的交付时间应在下次会议报告。",
    "participants": "张华、李宁、王敏",
    "observers": "赵磊、陈静",
    "agenda": 3,
    "rowId": "demo-meeting-v1-01-agenda-3",
    "extraFields": {
      "责任部门": "项目部",
      "要求时限": "2026-01-22",
      "办理阶段": "施工准备"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-02",
    "meetingId": "demo-meeting-v1-02",
    "title": "第2次园区改造项目专题会",
    "date": "2026-01-22",
    "topic": "预算调整与资金支付",
    "topicName": "新增设备需求与预算调整",
    "amount": "128",
    "unit": "财务部",
    "excerpt": "会议听取新增备用设备需求说明，预计总额由120万元调整为128万元。会议要求先取得预算调整批复，未批复前不得按增加额签约。",
    "participants": "张华、李宁、王敏",
    "observers": "陈静、周涛",
    "agenda": 1,
    "rowId": "demo-meeting-v1-02-agenda-1",
    "extraFields": {
      "责任部门": "财务部",
      "要求时限": "2026-02-05",
      "办理阶段": "申请调整"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-02",
    "meetingId": "demo-meeting-v1-02",
    "title": "第2次园区改造项目专题会",
    "date": "2026-01-22",
    "topic": "设备采购与验收",
    "topicName": "采购方案与评审要求",
    "amount": "128",
    "unit": "采购部",
    "excerpt": "会议审议设备采购方案，要求在预算调整批复后组织采购，并完整记录评审过程及供应商响应情况。",
    "participants": "张华、李宁、王敏",
    "observers": "陈静、周涛",
    "agenda": 2,
    "rowId": "demo-meeting-v1-02-agenda-2",
    "extraFields": {
      "责任部门": "采购部",
      "要求时限": "2026-02-05",
      "办理阶段": "采购准备"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-02",
    "meetingId": "demo-meeting-v1-02",
    "title": "第2次园区改造项目专题会",
    "date": "2026-01-22",
    "topic": "整改与责任落实",
    "topicName": "采购资料归档责任",
    "amount": "",
    "unit": "综合部",
    "excerpt": "会议要求采购部建立归档清单，项目部和财务部按职责提供需求论证、预算批复和审批记录，由陈静每月核对缺项。",
    "participants": "张华、李宁、王敏",
    "observers": "陈静、周涛",
    "agenda": 3,
    "rowId": "demo-meeting-v1-02-agenda-3",
    "extraFields": {
      "责任部门": "综合部",
      "要求时限": "2026-02-05",
      "办理阶段": "明确责任"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-03",
    "meetingId": "demo-meeting-v1-03",
    "title": "第3次园区改造项目专题会（上午）",
    "date": "2026-02-05",
    "topic": "预算调整与资金支付",
    "topicName": "预算调整批复及合同控制价",
    "amount": "128",
    "unit": "财务部",
    "excerpt": "会议确认已收到预算调整批复，总额128万元。采购合同金额不得超过批复，付款申请须附合同、预算批复及审批记录。",
    "participants": "张华、李宁、赵磊",
    "observers": "王敏、陈静",
    "agenda": 1,
    "rowId": "demo-meeting-v1-03-agenda-1",
    "extraFields": {
      "责任部门": "财务部",
      "要求时限": "2026-02-12",
      "办理阶段": "批复确认"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-03",
    "meetingId": "demo-meeting-v1-03",
    "title": "第3次园区改造项目专题会（上午）",
    "date": "2026-02-05",
    "topic": "改造工程进度",
    "topicName": "施工计划与交付节点",
    "amount": "",
    "unit": "项目部",
    "excerpt": "会议确认施工场地已移交，要求项目部提交分区施工计划，优先完成设备安装区域，并按周报告影响工期的事项。",
    "participants": "张华、李宁、赵磊",
    "observers": "王敏、陈静",
    "agenda": 2,
    "rowId": "demo-meeting-v1-03-agenda-2",
    "extraFields": {
      "责任部门": "项目部",
      "要求时限": "2026-02-12",
      "办理阶段": "排定节点"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-03",
    "meetingId": "demo-meeting-v1-03",
    "title": "第3次园区改造项目专题会（上午）",
    "date": "2026-02-05",
    "topic": "整改与责任落实",
    "topicName": "首次归档核对与缺项补充",
    "amount": "",
    "unit": "采购部",
    "excerpt": "会议听取首次归档核对，现有目录缺少两份需求论证签字页。要求采购部补齐并提交综合部核对，不以扫描汇总件替代应有审批记录。",
    "participants": "张华、李宁、赵磊",
    "observers": "王敏、陈静",
    "agenda": 3,
    "rowId": "demo-meeting-v1-03-agenda-3",
    "extraFields": {
      "责任部门": "采购部",
      "要求时限": "2026-02-12",
      "办理阶段": "补充资料"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-03",
    "meetingId": "demo-meeting-v1-04",
    "title": "第1次设备采购协调会（下午）",
    "date": "2026-02-05",
    "topic": "设备采购与验收",
    "topicName": "采购合同验收条款核对",
    "amount": "128",
    "unit": "采购部",
    "excerpt": "协调会要求合同明确到货清单、安装调试、质量检验及验收记录要求，验收由使用部门、项目部共同签字，合同控制价128万元。",
    "participants": "王敏、周涛、陈静",
    "observers": "李宁",
    "agenda": 1,
    "rowId": "demo-meeting-v1-04-agenda-1",
    "extraFields": {
      "责任部门": "采购部",
      "要求时限": "2026-02-12",
      "办理阶段": "核对条款"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-03",
    "meetingId": "demo-meeting-v1-04",
    "title": "第1次设备采购协调会（下午）",
    "date": "2026-02-05",
    "topic": "改造工程进度",
    "topicName": "设备安装区域交付安排",
    "amount": "",
    "unit": "项目部",
    "excerpt": "协调会要求项目部先行交付设备安装区域，施工单位应列明电源、承重和通风条件，条件未确认前不安排集中到货。",
    "participants": "王敏、周涛、陈静",
    "observers": "李宁",
    "agenda": 2,
    "rowId": "demo-meeting-v1-04-agenda-2",
    "extraFields": {
      "责任部门": "项目部",
      "要求时限": "2026-02-18",
      "办理阶段": "协调安装"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-03",
    "meetingId": "demo-meeting-v1-04",
    "title": "第1次设备采购协调会（下午）",
    "date": "2026-02-05",
    "topic": "整改与责任落实",
    "topicName": "联合验收职责分工",
    "amount": "",
    "unit": "项目部",
    "excerpt": "协调会明确由项目部组织联合验收，采购部核对供货清单，使用部门确认功能，财务部核对付款材料；发现差异应形成书面记录。",
    "participants": "王敏、周涛、陈静",
    "observers": "李宁",
    "agenda": 3,
    "rowId": "demo-meeting-v1-04-agenda-3",
    "extraFields": {
      "责任部门": "项目部",
      "要求时限": "2026-03-03",
      "办理阶段": "落实分工"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-04",
    "meetingId": "demo-meeting-v1-05",
    "title": "第4次园区改造项目专题会",
    "date": "2026-03-03",
    "topic": "预算调整与资金支付",
    "topicName": "设备到货与首期付款申请",
    "amount": "64",
    "unit": "财务部",
    "excerpt": "会议听取设备分批到货情况，供应商申请首期付款64万元。会议要求财务部逐项核对合同付款节点和到货签收记录，资料不齐的不予提交支付。",
    "participants": "张华、王敏、赵磊",
    "observers": "李宁、周涛",
    "agenda": 1,
    "rowId": "demo-meeting-v1-05-agenda-1",
    "extraFields": {
      "责任部门": "财务部",
      "要求时限": "2026-03-10",
      "办理阶段": "核对支付条件"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-04",
    "meetingId": "demo-meeting-v1-05",
    "title": "第4次园区改造项目专题会",
    "date": "2026-03-03",
    "topic": "设备采购与验收",
    "topicName": "到货清单与功能测试差异",
    "amount": "128",
    "unit": "项目部",
    "excerpt": "会议听取到货核对，供货清单与合同数量一致，但两台备用设备尚未完成连续运行测试。要求保留测试记录，验收结论不得提前签署。",
    "participants": "张华、王敏、赵磊",
    "observers": "李宁、周涛",
    "agenda": 2,
    "rowId": "demo-meeting-v1-05-agenda-2",
    "extraFields": {
      "责任部门": "项目部",
      "要求时限": "2026-03-18",
      "办理阶段": "到货核对"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-04",
    "meetingId": "demo-meeting-v1-05",
    "title": "第4次园区改造项目专题会",
    "date": "2026-03-03",
    "topic": "改造工程进度",
    "topicName": "安装区域延期与赶工计划",
    "amount": "",
    "unit": "项目部",
    "excerpt": "会议听取安装区域部分管线改造延后情况，要求施工单位提交赶工计划。涉及合同工期调整的，应单独履行审批程序并记录原因。",
    "participants": "张华、王敏、赵磊",
    "observers": "李宁、周涛",
    "agenda": 3,
    "rowId": "demo-meeting-v1-05-agenda-3",
    "extraFields": {
      "责任部门": "项目部",
      "要求时限": "2026-03-10",
      "办理阶段": "调整进度"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-05",
    "meetingId": "demo-meeting-v1-06",
    "title": "第5次园区改造项目专题会",
    "date": "2026-03-24",
    "topic": "预算调整与资金支付",
    "topicName": "首期支付结果与余款审核",
    "amount": "64",
    "unit": "财务部",
    "excerpt": "会议确认首期款64万元已按审批手续支付。后续余款应与联合验收结果相衔接，财务部核对合同约定后再提出支付意见。",
    "participants": "张华、李宁、王敏",
    "observers": "赵磊、陈静",
    "agenda": 1,
    "rowId": "demo-meeting-v1-06-agenda-1",
    "extraFields": {
      "责任部门": "财务部",
      "要求时限": "2026-04-16",
      "办理阶段": "支付后跟踪"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-05",
    "meetingId": "demo-meeting-v1-06",
    "title": "第5次园区改造项目专题会",
    "date": "2026-03-24",
    "topic": "设备采购与验收",
    "topicName": "联合验收结论与待办事项",
    "amount": "128",
    "unit": "采购部",
    "excerpt": "会议确认备用设备连续运行测试完成，联合验收记录已签署。设备培训签到和操作手册移交仍需补齐，采购部应逐项跟踪关闭。",
    "participants": "张华、李宁、王敏",
    "observers": "赵磊、陈静",
    "agenda": 2,
    "rowId": "demo-meeting-v1-06-agenda-2",
    "extraFields": {
      "责任部门": "采购部",
      "要求时限": "2026-04-05",
      "办理阶段": "完成联合验收"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-05",
    "meetingId": "demo-meeting-v1-06",
    "title": "第5次园区改造项目专题会",
    "date": "2026-03-24",
    "topic": "整改与责任落实",
    "topicName": "需求签字页整改核对",
    "amount": "",
    "unit": "综合部",
    "excerpt": "会议听取需求论证签字页已补齐的情况，要求综合部核对原件与归档件一致性，并对验收培训资料缺项继续建立整改台账。",
    "participants": "张华、李宁、王敏",
    "observers": "赵磊、陈静",
    "agenda": 3,
    "rowId": "demo-meeting-v1-06-agenda-3",
    "extraFields": {
      "责任部门": "综合部",
      "要求时限": "2026-04-05",
      "办理阶段": "跟踪整改"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-06",
    "meetingId": "demo-meeting-v1-07",
    "title": "第6次园区改造项目专题会",
    "date": "2026-04-16",
    "topic": "预算调整与资金支付",
    "topicName": "累计支付与质保金安排",
    "amount": "115.2",
    "unit": "财务部",
    "excerpt": "会议听取设备采购累计支付115.2万元，合同金额128万元，剩余12.8万元按合同约定保留。会议要求核对质保金释放条件和到期提醒，不将剩余款自动视为可支付金额。",
    "participants": "张华、李宁、赵磊",
    "observers": "王敏、陈静",
    "agenda": 1,
    "rowId": "demo-meeting-v1-07-agenda-1",
    "extraFields": {
      "责任部门": "财务部",
      "要求时限": "2026-04-30",
      "办理阶段": "核对剩余款"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-06",
    "meetingId": "demo-meeting-v1-07",
    "title": "第6次园区改造项目专题会",
    "date": "2026-04-16",
    "topic": "改造工程进度",
    "topicName": "改造项目交付与遗留事项",
    "amount": "",
    "unit": "项目部",
    "excerpt": "会议听取改造区域已投入使用，要求项目部完成竣工资料核对和遗留事项交接。未完成事项继续登记责任人及办结期限。",
    "participants": "张华、李宁、赵磊",
    "observers": "王敏、陈静",
    "agenda": 2,
    "rowId": "demo-meeting-v1-07-agenda-2",
    "extraFields": {
      "责任部门": "项目部",
      "要求时限": "2026-04-30",
      "办理阶段": "交付跟踪"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-06",
    "meetingId": "demo-meeting-v1-07",
    "title": "第6次园区改造项目专题会",
    "date": "2026-04-16",
    "topic": "整改与责任落实",
    "topicName": "整改台账阶段核对",
    "amount": "",
    "unit": "综合部",
    "excerpt": "会议确认培训签到、操作手册和需求签字页已完成归档。综合部应保留核对记录，尚未到期的质保和维护事项转入后续跟踪清单。",
    "participants": "张华、李宁、赵磊",
    "observers": "王敏、陈静",
    "agenda": 3,
    "rowId": "demo-meeting-v1-07-agenda-3",
    "extraFields": {
      "责任部门": "综合部",
      "要求时限": "2026-04-30",
      "办理阶段": "阶段核对"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-07",
    "meetingId": "demo-meeting-v1-08",
    "title": "设备运维补充协调会（原件未载明日期）",
    "date": "",
    "topic": "设备采购与验收",
    "topicName": "运维交接与备用设备记录",
    "amount": "",
    "unit": "采购部",
    "excerpt": "补充协调会讨论备用设备运维交接，要求核对设备序列号、保修范围和操作手册版本。纪要原件未载明会议日期，无法据此判断与其他会议的先后关系。",
    "participants": "王敏、赵磊",
    "observers": "陈静、周涛",
    "agenda": 1,
    "rowId": "demo-meeting-v1-08-agenda-1",
    "extraFields": {
      "责任部门": "采购部",
      "要求时限": "未载明",
      "办理阶段": "运维核对"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-07",
    "meetingId": "demo-meeting-v1-08",
    "title": "设备运维补充协调会（原件未载明日期）",
    "date": "",
    "topic": "改造工程进度",
    "topicName": "配套区域后续维护安排",
    "amount": "",
    "unit": "项目部",
    "excerpt": "补充协调会要求项目部整理配套区域维护联系表，列明报修渠道、职责和交接材料。原件未载明会议日期及维护费用，不据此推定工期或金额。",
    "participants": "王敏、赵磊",
    "observers": "陈静、周涛",
    "agenda": 2,
    "rowId": "demo-meeting-v1-08-agenda-2",
    "extraFields": {
      "责任部门": "项目部",
      "要求时限": "未载明",
      "办理阶段": "维护安排"
    }
  },
  {
    "doc": "meeting-timeline-demo-doc-v1-07",
    "meetingId": "demo-meeting-v1-08",
    "title": "设备运维补充协调会（原件未载明日期）",
    "date": "",
    "topic": "整改与责任落实",
    "topicName": "补充纪要日期与附件核对",
    "amount": "",
    "unit": "综合部",
    "excerpt": "补充协调会纪要缺少会议日期及部分附件编号。要求资料提供方核对原件、补充说明并保留更正记录，核实前不补写日期。",
    "participants": "王敏、赵磊",
    "observers": "陈静、周涛",
    "agenda": 3,
    "rowId": "demo-meeting-v1-08-agenda-3",
    "extraFields": {
      "责任部门": "综合部",
      "要求时限": "未载明",
      "办理阶段": "待补充说明"
    }
  }
]);
const mtDemoGetFileBase=libGetFile;
// Keep the existing upload/IndexedDB/static-source chain unchanged for all other files.
libGetFile=async function(id){
 const asset=MEETING_TIMELINE_DEMO_SOURCES[id];
 if(!asset)return mtDemoGetFileBase(id);
 if(uploadSources.has(id))return uploadSources.get(id);
 try{
  const response=await fetch(new URL(asset.path,document.baseURI));if(!response.ok)return null;
  const raw=new File([await response.blob()],asset.name,{type:asset.mime});
  uploadSources.set(id,raw);return raw;
 }catch{return null;}
};
function meetingTimelineDemoTask(){return state.tasks.find(t=>t.id===MEETING_TIMELINE_DEMO_TASK_ID)||null;}
const meetingTimelineDemoReady=(async function(){
 await taskDemoReady;
 let marked=false;try{marked=Number(localStorage.getItem(MEETING_TIMELINE_DEMO_MARKER)||0)>=MEETING_TIMELINE_DEMO_VERSION;}catch{}
 const existing=meetingTimelineDemoTask();
 // Once seeded, editing/deleting examples is respected; refreshing never restores them.
 if(marked||existing){if(existing&&!marked)try{localStorage.setItem(MEETING_TIMELINE_DEMO_MARKER,String(MEETING_TIMELINE_DEMO_VERSION));}catch{}return{seeded:false,taskId:MEETING_TIMELINE_DEMO_TASK_ID};}
 const folder='会议纪要/时间轴演示',space='项目空间',created='2026-10-23T09:00:00+08:00',ids=Object.keys(MEETING_TIMELINE_DEMO_SOURCES),template=DOCS.find(d=>d.id==='d3')||{};
 for(const asset of Object.values(MEETING_TIMELINE_DEMO_SOURCES)){
  if(file(asset.id))continue;
  const doc={...structuredClone(template),id:asset.id,name:asset.name,type:'DOCX',space,folder,path:space+' / '+folder+' / '+asset.name,size:(asset.size/1024).toFixed(1)+' KB',byteSize:asset.size,date:'2026-10-23',uploadedAt:created,title:asset.title,topic:'会议决策与落实',unit:'园区建设中心',amount:'',owner:'当前用户',uploader_id:'current-user',text:asset.text,source:'LOCAL',content_status:'done',local:false,deleted:false,importedOnly:false,attachments:[],demo:true,meetingTimelineDemoVersion:MEETING_TIMELINE_DEMO_VERSION};
  for(const key of ['refSourceId','reference','parseError','parseStatus','parse_status','rows','columns','can_preview','can_download','can_analyze','can_rename','can_delete','can_move','can_manage_attachments','can_reparse'])delete doc[key];
  state.docs.push(doc);
 }
 state.directoryNodes??=[];
 for(const path of ['会议纪要',folder])if(!state.directoryNodes.some(n=>n.space===space&&n.path===path))state.directoryNodes.push({space,path});
 const regular=awDefaults.meeting.regular.content,risk=awDefaults.meeting.risk.content;
 const config={template:tool('meeting').template,prompt:regular,fields:[],checks:[],merge:false,top:30,mode:'file',failure:'none',stageFailure:'none',similarityThreshold:80,minClusterSize:2,threshold:4,matchMode:'standard',cap:20,chunk:2000,overlap:200};
 seedConfig('meeting',config);config.stages.regular.content=regular;config.stages.risk.content=risk;
 const task={id:MEETING_TIMELINE_DEMO_TASK_ID,demo:true,meetingTimelineDemoVersion:MEETING_TIMELINE_DEMO_VERSION,name:'园区改造会议决策与落实追踪',notes:'演示：8场会议、24项议题、4类事项；同日两场会议合并于一份纪要，另有一场原件未载明日期。所有内容均为虚构。',toolId:'meeting',ids,config,status:'completed',progress:100,phase:'分析完成',created,startedAt:'2026-10-23T09:00:10+08:00',completed:'2026-10-23T09:03:00+08:00',lastProgressAt:'2026-10-23T09:03:00+08:00',successIds:[...ids],failedIds:[],attachments:Object.fromEntries(ids.map(id=>[id,[]])),stopwords:['的','以及'],newwords:[],chats:[],projects:[],modes:['joint'],meetingRisk:false,result:structuredClone(MEETING_TIMELINE_DEMO_ROWS)};
 ensureTaskStructure(task);task.configFragment=configurationFragment('meeting',structuredClone(config));
 state.tasks.unshift(task);persist();
 try{localStorage.setItem(MEETING_TIMELINE_DEMO_MARKER,String(MEETING_TIMELINE_DEMO_VERSION));}catch{}
 if(state.view==='tasks'||state.view==='library'||state.view==='tool'&&state.toolId==='meeting')render();
 return{seeded:true,taskId:task.id,documents:ids.length,meetings:8,topics:task.result.length};
})();
