'use strict';
// Tool-local configuration contracts. Backend adapters remain in the original Vue project.
const CONFIG_SCHEMA_VERSION=2;
const PROMPT_STAGES={
 extract:[['extract','提取要求','template-api','通用资料信息提取']],
 word:[],
 theme:[['extract','基础信息提取','Information_Extraction','基础信息提取'],['summarize','主题归纳','Topic_Summarization','审计事项主题归纳']],
 timeline:[['timeline','日期与事项提取','timeline_analysis','事项时间线提取']],
 risk:[['risk','关注点检查','risk-point-analysis','资金与采购关注点']],
 meeting:[['regular','常规分析','meeting_minutes','会议议题提取'],['risk','风险分析','meeting_minutes_risk','会议风险检查']],
 contract:[['compliance','合规性分析','compliance_analysis_prompt','合同合规检查'],['information','信息提取','information_extraction_prompt','合同基础信息提取']],
 bidding:[['tender','招标文件分析','Bidding_Analysis','招标条件与评分检查'],['bid','投标文件分析','Bidding_Analysis','投标响应完整性检查'],['joint','联合分析','Bidding_Analysis','招投标联合对照检查']],
 prepaid:[['agreement','提取计费约定','billing_agreement_prompt','计费约定提取'],['calculation','费用计算','cost_calculation_prompt','费用计算']],
 engineering:[['duplicate','重复项目检测','Engineering_Repeat_Detection','重复项目分析'],['parent','主子项目分析','Engineering_Sub_Project_Detection','主子项目分析']],
 association:[['compare','两表比较','Two_Table_Compare','两表关联比较']]
};
const EXPENSE_TYPES=['工程监理费','工程设计费','代建管理费','造价咨询服务费','勘察费、测绘费','招标代理费'];
const COMPARE_TYPES=[['similarity','相似度'],['investment_diff','金额差异'],['exact','完全相等'],['investment_gt','金额大于']];
const HARD_CONDITIONS=[['match','值相同'],['mismatch','值不同'],['empty','至少一个为空'],['both_empty','都为空'],['any_non_empty','至少一个非空']];
const HARD_RESULTS=[['full_match','完全一致'],['partial_match','不完全一致'],['miss','遗漏']];
function newMappingRows(two=false){return ['项目名称','建设单位','计划投资（万元）'].map((v,i)=>({key:'F'+(i+1),name:['项目名称','建设 / 实施单位','投资金额（万元）'][i],a:v,b:['项目名称','实施单位','安排资金（万元）'][i],type:i===2?'investment_diff':i===1?'exact':'similarity',threshold:i===2?.04:i===1?0:.8,weight:[.6,.3,.1][i],rule:i===2?'比较金额及单位，明确差异；空值不得视为相等。':'按原字段内容评分，保留匹配理由，不能仅凭相近名称确定为同一事项。'}));}
function seedConfig(id,c){
 if(c.schemaVersion===CONFIG_SCHEMA_VERSION)return c;
 c.schemaVersion=CONFIG_SCHEMA_VERSION;c.stages??={};
 (PROMPT_STAGES[id]||[]).forEach(([key,label,type,name],i)=>{c.stages[key]??={template:name,content:i===0?c.prompt:'请依据已提供资料完成'+label+'，说明依据、资料不足与需进一步核验事项，不推断资料外事实。',functionType:type,origin:'system'};});
 c.fieldDefs??=(c.fields||[]).map(name=>({name,description:'提取原文中的'+name+'，保留原始单位及限定条件；无法取得时标注未提取到。'}));
 c.riskNodes??=(tool(id).checks||[]).map((name,i)=>({id:'r'+i,path:'通用关注点 / '+name,name,description:'核对'+name+'相关资料及依据。'}));
 c.contractRules??=(c.checks||[]).map((title,i)=>({title,description:'检查'+title+'是否明确，并摘录对应条款。',laws:'合同正文及技术附件；请补充本项目适用的规范或内部制度。',judgment:'按所选依据和合同原文判断；依据或资料不足时保留为待核验。',format:'compliance',expected:'提取对应条款原文',enabled:true}));
 c.contractType=['自动','施工类合同','非施工类合同'].includes(c.contractType)?c.contractType:'非施工类合同';
 c.feeType=EXPENSE_TYPES.includes(c.feeType)?c.feeType:EXPENSE_TYPES[0];
 c.engineering??={duplicate:{threshold:3.35,rows:newMappingRows(),additional:'',minFields:2},parent:{threshold:3.4,rows:newMappingRows(),additional:'',minFields:2}};
 c.association??={rows:newMappingRows(true),full:4.5,partial:3.5,mode:'batch',perRow:5,total:10000,minFields:2,locks:{full:true,partial:false,table1:true,table2:true},hardRules:[],additional:''};
 c.similarityThreshold??=80;c.minClusterSize??=2;c.taskName??='';c.taskNotes??='';c.auditObjective??='';
 c.lexiconSelection??={stop:null,user:null};
 return c;
}
function configurationIssues(id,c,w){
 const errors=[];
 (PROMPT_STAGES[id]||[]).filter(([key])=>id!=='bidding'||w.modes.includes(key)).forEach(([key,label])=>{if(!c.stages[key]?.content?.trim())errors.push('请填写'+label+'的提示词');});
 if(id==='extract'&&c.fieldDefs.some(f=>!f.description.trim()))errors.push('每个提取字段都需要填写提取说明');
 if(id==='contract'&&c.contractRules.filter(r=>r.enabled).some(r=>[r.title,r.description,r.laws,r.judgment].some(v=>!v?.trim())))errors.push('合同规则的名称、描述、依据和判断标准均需填写');
 if(id==='meeting'&&(!Number.isFinite(+c.similarityThreshold)||+c.similarityThreshold<0||+c.similarityThreshold>100||!Number.isInteger(+c.minClusterSize)||+c.minClusterSize<1||+c.minClusterSize>20))errors.push('会议相似度为0–100%，最小聚类数为1–20的整数');
 const groups=id==='association'?[['两表比较',c.association]]:id==='engineering'?[['重复项目',c.engineering.duplicate],['主子项目',c.engineering.parent]]:[];
 groups.forEach(([label,g])=>{
  if(!g.rows.length)errors.push(label+'至少配置一个比较字段');
  if(new Set(g.rows.map(r=>r.key)).size!==g.rows.length)errors.push(label+'字段标识不能重复');
  if(Math.abs(g.rows.reduce((n,r)=>n+(+r.weight||0),0)-1)>.001)errors.push(label+'的字段权重合计须为1');
  if(g.rows.some(r=>!r.name.trim()||!r.a||r.a==='请选择'||(id==='association'&&(!r.b||r.b==='请选择'))||!r.rule.trim()))errors.push(label+'字段名称、表头和评分规则需填写完整');
  if(g.rows.some(r=>!Number.isFinite(+r.weight)||+r.weight<0||+r.weight>1||!Number.isFinite(+r.threshold)||+r.threshold<0||+r.threshold>(id==='engineering'?1:5)))errors.push(label+'预筛阈值或权重超出允许范围');
  if(!Number.isInteger(+g.minFields)||+g.minFields<1||+g.minFields>g.rows.length)errors.push(label+'最少匹配字段应在当前字段数内');
  if(id==='engineering'&&(+g.threshold<0||+g.threshold>5||!Number.isFinite(+g.threshold)))errors.push(label+'判定阈值应为0–5分');
  const docs=id==='association'?[file(w.tableA),file(w.tableB)]:selectedDocs(w.ids);
  docs.filter(Boolean).forEach((d,index)=>{if(!d.columns||g.rows.some(r=>!d.columns.includes(id==='association'&&index===1?r.b:r.a)))errors.push(label+'：'+d.name+'存在未对应的列');});
 });
 if(id==='association'){
  const g=c.association;
  if(+g.partial>+g.full||+g.full>5||+g.partial<0||![g.full,g.partial].every(x=>Number.isFinite(+x)))errors.push('两表阈值需满足 0 ≤ 部分一致 ≤ 完全一致 ≤ 5');
  if(!Number.isInteger(+g.minFields)||+g.minFields<1||+g.minFields>g.rows.length)errors.push('最少匹配字段数应为1至当前字段数量');
  if(g.mode==='batch'&&(!Number.isInteger(+g.perRow)||+g.perRow<1||+g.perRow>20||+g.total<1000||+g.total>50000))errors.push('批量模式每行对比数应为1–20，全局对比数为1000–50000');
  const keys=g.rows.map(r=>r.key);
  if(g.hardRules.some(r=>!Number.isInteger(+r.priority)||+r.priority<0||+r.priority>999))errors.push('硬规则优先级应为0–999整数');
  if(g.hardRules.some(r=>(r.logic==='and'?r.rules:[r]).some(q=>!keys.includes(q.field))))errors.push('硬规则引用了已删除字段，请调整规则');
 }
 return [...new Set(errors)];
}
// Diagnostic only: no request is sent. Values map to existing frontend payload contracts.
function configurationFragment(id,c){
 const stage=key=>({key:c.stages[key]?.template,prompt:c.stages[key]?.content});
 const single=g=>({threshold:+g.threshold,field_mapping:Object.fromEntries(g.rows.map(r=>[r.key,{excel_column:r.a,compare_type:r.type,threshold:+r.threshold}])),prescreen_config:{min_match_fields:+g.minFields},llm_config:{field_weights:Object.fromEntries(g.rows.map(r=>[r.key,+r.weight])),field_prompt_rules:Object.fromEntries(g.rows.map(r=>[r.key,r.rule])),additional_prompt:g.additional}});
 if(id==='extract')return{fields:c.fieldDefs.map(f=>({name:f.name,description:f.description})),chunk_size:+c.chunk,chunk_overlap:+c.overlap,merge_attachments:c.merge};
 if(id==='theme')return{information_extraction_project:stage('extract'),theme_summarization_project:stage('summarize')};
 if(id==='meeting')return{prompt:c.stages.regular.content,risk_prompt:c.stages.risk.content,similarity_threshold:+c.similarityThreshold/100,min_cluster_size:+c.minClusterSize};
 if(id==='prepaid')return{billing_agreement_prompt:c.stages.agreement.content,cost_calculation_prompt:c.stages.calculation.content,expense_type:c.feeType};
 if(id==='contract')return{compliance_analysis_prompt:c.stages.compliance.content,information_extraction_prompt:c.stages.information.content,rules:c.contractRules.filter(r=>r.enabled).map(r=>({title:r.title,description:r.description,laws_and_regulations:r.laws,judgment_rule:r.judgment,data_format:r.format,extracted_value:r.format==='completeness'?JSON.parse(r.expected||'{}'):r.expected}))};
 if(id==='engineering')return{engineering_repeat_project:stage('duplicate'),engineering_sub_project:stage('parent'),duplicate_detection:single(c.engineering.duplicate),parent_child_analysis:single(c.engineering.parent)};
 if(id==='association'){const g=c.association;return{compare_prompt:{key:c.stages.compare.template},compare_config:{field_comparison_mapping:Object.fromEntries(g.rows.map(r=>[r.key,{table1_field:r.a,table2_field:r.b,compare_type:r.type,threshold:+r.threshold}])),llm_config:{full_match_threshold:+g.full,partial_match_threshold:+g.partial,field_weights:Object.fromEntries(g.rows.map(r=>[r.key,+r.weight])),field_prompt_rules:Object.fromEntries(g.rows.map(r=>[r.key,r.rule])),hard_rules:g.hardRules,additional_prompt:g.additional},performance_mode:g.mode,max_llm_pairs_per_table1_row:+g.perRow,max_total_llm_pairs:+g.total,min_match_fields:+g.minFields,match_lock_policy:{lock_on_full_match:g.locks.full,lock_on_partial_match:g.locks.partial,lock_table1_on_full_match:g.locks.table1,lock_table2_on_full_match:g.locks.table2}}};}
 return{stages:c.stages,checks:c.checks};
}

// Validate imported configuration before it can enter a render or execution path.
function validateImportedConfig(id,c){
 if(c.schemaVersion!==2)throw Error('配置版本不匹配');
 function shape(v,s,path='config'){
  if(s===null)return;
  if(Array.isArray(s)){if(!Array.isArray(v))throw Error(path+' 应为数组');if(s.length)v.forEach((x,i)=>shape(x,s[0],path+'.'+i));return;}
  if(typeof s==='object'){if(!v||typeof v!=='object'||Array.isArray(v))throw Error(path+' 应为对象');Object.keys(s).forEach(k=>shape(v[k],s[k],path+'.'+k));return;}
  if(typeof v!==typeof s)throw Error(path+' 类型不正确');
 }
 const initial={prompt:'',fields:[''],checks:['']};seedConfig(id,initial);
 // Numeric form values can be serialized as strings by the base form layer.
 ['similarityThreshold','minClusterSize'].forEach(k=>{if(!Number.isFinite(+c[k]))throw Error(k+' 应为数字');c[k]=+c[k];});
 shape(c,initial);
 if(c.fieldDefs.some(f=>typeof f.name!=='string'||typeof f.description!=='string'))throw Error('字段配置无效');
 c.contractRules.forEach(r=>{if([r.title,r.description,r.laws,r.judgment,r.expected].some(x=>typeof x!=='string'))throw Error('合同规则结构无效');if(r.format==='completeness'){const x=JSON.parse(r.expected);if(!x||typeof x!=='object'||Array.isArray(x))throw Error('完备性内容须为JSON对象');}});
 c.association.hardRules.forEach(r=>{if(!HARD_RESULTS.some(x=>x[0]===r.result))throw Error('硬规则结果无效');const list=r.logic==='and'?r.rules:[r];if(!Array.isArray(list)||!list.length||list.some(q=>typeof q.field!=='string'||!HARD_CONDITIONS.some(x=>x[0]===q.condition)))throw Error('硬规则条件无效');});
 ['stop','user'].forEach(k=>{const a=c.lexiconSelection[k];if(a!==null&&(!Array.isArray(a)||a.some(x=>typeof x!=='string')))throw Error('词库选择无效');});
 return c;
}
