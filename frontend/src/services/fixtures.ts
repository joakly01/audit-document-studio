import {tools,createDraft} from '@/domain/tools'
import type {Material,Folder,Prompt,ExtractionTemplate,Task,ToolId,JsonObject,ToolDraft} from '@/domain/types'
export const demoFolders:Folder[]=[{id:'demo-public',name:'虚构示例资料',space:'PUBLIC',children:[{id:'demo-contracts',name:'合同与会议',space:'PUBLIC',parentId:'demo-public'}]},{id:'demo-personal',name:'个人示例资料',space:'PERSONAL'},{id:'demo-project',name:'虚构示例项目',space:'PROJECT'}]
export const demoMaterials:Material[]=['虚构示例合同.pdf','虚构示例会议纪要.docx','虚构示例项目台账A.xlsx','虚构示例项目台账B.xlsx','虚构示例招标文件.pdf','虚构示例投标文件.pdf'].map((name,i)=>({id:`demo-file-${i+1}`,name,folderId:i<2?'demo-contracts':'demo-public',path:i<2?'虚构示例资料/合同与会议':'虚构示例资料',space:'PUBLIC',size:12000+i*1600,extension:name.split('.').pop()!,parseStatus:'parsed',owner:'虚构演示用户',canAnalyze:true,canDownload:true,attachmentIds:[],updatedAt:'2026-01-15 09:30:00'}))
// Additional fictional files exercise pagination, parse-status filters and all spaces.
for(let i=7;i<=78;i++) {const space=i<=54?'PUBLIC':i<=66?'PERSONAL':'PROJECT';demoMaterials.push({id:`demo-file-${i}`,name:`虚构示例资料${String(i).padStart(2,'0')}.${i%3===0?'xlsx':'pdf'}`,folderId:space==='PUBLIC'?'demo-public':space==='PERSONAL'?'demo-personal':'demo-project',path:'虚构示例资料',space,size:10000+i*100,extension:i%3===0?'xlsx':'pdf',parseStatus:(['parsed','unparsed','parsing','failed'] as const)[i%4],canAnalyze:true,canDownload:true,attachmentIds:[],owner:'虚构演示用户'})}
export const demoPrompts:Prompt[]=tools.flatMap(t=>t.promptStages.map(s=>({id:`demo-${t.id}-${s.key}`,name:`虚构示例 · ${s.label}`,content:`本提示词仅用于虚构演示。请按原文分析${s.label}，标明来源；无法确认的内容应标记待核验。`,scope:'public' as const,category:'system' as const,tool:t.id,stage:s.key,isDefault:true,config:t.id==='engineering'?{threshold:s.key==='duplicate'?3.35:3.4,llm_config:{field_weights:{F1:1},field_prompt_rules:{F1:'按项目名称一致程度评分，0–5分'},hard_rules:[],veto_rules:[]}}:t.id==='contract'?{rules:[{id:'demo-rule-contract',title:'付款条款完整性',description:'核验付款条件、节点及依据',laws_and_regulations:'以本次合同约定及提供的依据为准（虚构示例）',judgment_rule:'付款节点、条件与依据是否明确',selected:true}]}:t.id==='bidding'?{[s.key==='bidding_only'?'biddingRules':s.key==='tender_only'?'tenderRules':'jointRules']:[{id:`demo-rule-${s.key}`,name:'资格条件一致性',description:'核验文件之间的资格条件',selected:true}]}:t.id==='risk'?{risk_points:[{id:'demo-risk',label:'审批程序完整性',path:'审批程序完整性'}]}:undefined})))
const feeTypes=['supervision_engineering','design','agency_management','cost_consulting','survey_mapping','bidding_agency']
const prepaidBase=demoPrompts.filter(p=>p.tool==='prepaid')
for(const p of prepaidBase)demoPrompts.splice(demoPrompts.indexOf(p),1)
for(const expense_type of feeTypes)for(const p of prepaidBase)demoPrompts.push({...p,id:`${p.id}-${expense_type}`,name:`${p.name} · ${({supervision_engineering:'工程监理费',design:'工程设计费',agency_management:'代建管理费',cost_consulting:'造价咨询服务费',survey_mapping:'勘察费、测绘费',bidding_agency:'招标代理费'} as Record<string,string>)[expense_type]}`,config:{expense_type}})
export const demoTemplates:ExtractionTemplate[]=[{id:'demo-template-contract',name:'虚构示例 · 合同要素',description:'仅用于演示，资料与金额均为虚构。',folderId:'demo-template-folder',scope:'system',fields:[{id:'party',name:'合同相对方',description:'合同签约单位'},{id:'amount',name:'合同金额',description:'保留原文币种与单位'}]}]
export function demoResult(tool:ToolId,files:Material[]=demoMaterials):JsonObject {
 const file=files[0]||demoMaterials[0],evidence=[{fileId:file.id,fileName:file.name,page:1,quote:'【虚构演示原文】示例项目应完成审批并按约定支付费用。'}]
 const finding={id:'demo-finding',title:'虚构示例：审批依据待补充',rule:'审批程序完整性',riskLevel:'中',conclusion:'需人工核验',reason:'演示资料未列明完整审批依据',suggestion:'核对审批记录与附件',evidence}
 switch(tool){
 case'extract':return{fields:['合同相对方','合同金额'],rows:[{fileName:file.name,values:{合同相对方:'虚构示例服务有限公司',合同金额:'120 万元（虚构）'},evidence}]}
 case'word':return{words:['项目','审批','合同','费用','验收','付款','台账','预算','会议','采购','进度','管理'].map((word,i)=>({word,count:36-i*2,evidence}))}
 case'theme':return{themes:[{name:'虚构示例：项目审批与履约',summary:'演示资料涉及审批、采购及合同付款等事项，建议结合原文核验。',evidence}],fields:['要点'],extractions:[{fileName:file.name,values:{要点:'虚构示例项目按合同开展履约管理'},evidence}]}
 case'timeline':return{events:[{id:'demo-event',date:'2026-01-15',title:'虚构示例项目启动',description:'讨论项目实施与审批安排',participants:['虚构示例人员甲'],evidence}]}
 case'meeting':return{meetings:[{id:'demo-meeting',name:'虚构示例项目专题会',date:'2026-01-15',participants:['虚构人员甲','虚构人员乙'],evidence,topics:[{id:'demo-topic',title:'项目实施计划',summary:'虚构示例：讨论项目预算及后续审批安排。',clusterId:'demo-cluster',amount:120,unit:'万元',evidence}]}],clusters:[{id:'demo-cluster',name:'虚构示例项目实施',topicIds:['demo-topic']}],risks:[finding]}
 case'risk':case'bidding':case'contract':return{findings:[finding]}
 case'prepaid':return{agreements:[{feeType:'虚构示例服务费',basis:'合同约定',rate:'1%',unit:'元',formula:'计费基数 × 1%（虚构示例）',evidence}],calculations:[]}
 case'engineering':return{duplicates:[{projectName:'虚构项目甲 / 虚构项目甲一期',score:4.1,sourceRow:'2 / 4',reason:'名称及地点相近，仅为演示候选关系',evidence}],parentChildren:[{parent:'虚构项目甲',child:'虚构项目甲一期',score:4.2,reason:'虚构示例主子项目关系',evidence}]}
 case'association':return{matches:[{tableA:'虚构项目甲',tableB:'虚构项目甲一期',score:4.3,reason:'虚构示例候选关联',evidence}],differences:[{projectName:'虚构项目甲',amountA:120,amountB:125,difference:5,unit:'万元',evidence}],unmatchedA:[{projectName:'虚构项目乙',reason:'表 B 无对应演示记录',evidence}],unmatchedB:[{projectName:'虚构项目丙',reason:'表 A 无对应演示记录',evidence}]}
 }
}
export function demoDraft(tool:ToolId):ToolDraft {
 const d=createDraft(tool);d.name=`虚构示例 · ${tools.find(t=>t.id===tool)!.name}`;d.files=[demoMaterials[0]];d.config.fields=demoTemplates[0].fields
 for(const p of demoPrompts.filter(p=>p.tool===tool&&(tool!=='prepaid'||p.config?.expense_type==='design')))d.prompts[p.stage]={id:p.id,name:p.name,content:p.content,originalContent:p.content,customized:false}
 const rule={id:'demo-rule',label:'虚构示例审批程序',description:'核对审批程序',path:'虚构示例',raw:{id:'demo-rule',name:'审批程序完整性',description:'核对审批程序'}}
 if(tool==='bidding'){d.config.analysisModes=['joint'];d.config.projects=[{id:'demo-project-role',name:'虚构示例项目',biddingFiles:[demoMaterials[4]],companies:[{id:'demo-company',name:'虚构示例投标单位',files:[demoMaterials[5]]}]}];d.config.modeRules={joint:[rule]};d.files=[demoMaterials[4],demoMaterials[5]]}
 if(tool==='association'){d.config.table1=demoMaterials[2];d.config.table2=demoMaterials[3];d.config.mappingRows=[{id:'demo-map',left:'项目名称',right:'项目名称',weight:1,rule:'按项目名称评分'}];d.files=[demoMaterials[2],demoMaterials[3]]}
 if(tool==='engineering'){d.files=[demoMaterials[2]];d.config.fieldMappings={[demoMaterials[2].id]:{name:'项目名称'}};d.config.weights={name:1};d.config.fieldRules={name:'按项目名称一致程度评分'}}
 if(tool==='contract'){d.config.contractCategory='construction';d.config.rules=[{...rule,raw:{title:'审批程序完整性',description:'核对审批程序',laws_and_regulations:'合同提供的审批约定（虚构）',judgment_rule:'是否有审批依据'}}]}
 if(tool==='risk')d.config.riskPoints=[rule]
 if(tool==='prepaid')d.config.feeTypes=['design']
 return d
}
export const demoTasks:Task[]=tools.map((t,i)=>({id:`demo-task-${t.id}`,name:`虚构示例 · ${t.name}`,tool:t.id,status:t.id==='prepaid'?'awaiting_input':'completed',createdAt:`2026-01-${String(15+i).padStart(2,'0')} 10:00:00`,total:demoDraft(t.id).files.length,completed:demoDraft(t.id).files.length,failed:0,hasResults:true,progress:100,draft:demoDraft(t.id),results:demoResult(t.id,demoDraft(t.id).files)}))

for(const [i,status] of (['queued','running','partial','failed','stopped'] as const).entries()) {
 const draft=demoDraft(i%2?'meeting':'extract')
 demoTasks.push({id:'demo-state-'+status,name:'虚构状态演示 · '+({queued:'等待分析',running:'分析中',partial:'部分完成',failed:'分析失败',stopped:'已停止'})[status],tool:draft.tool,status,createdAt:'2026-02-01 10:00:00',total:12,completed:status==='partial'?9:status==='running'?4:0,failed:status==='partial'?3:status==='failed'?12:0,progress:status==='running'?33:status==='partial'?100:0,hasResults:status==='partial',draft,results:status==='partial'?demoResult(draft.tool,draft.files):undefined,error:status==='failed'?'演示：部分资料解析结果不可用，请检查后重试。':undefined})
}
