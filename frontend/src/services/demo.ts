import {lexiconSignature,type LexiconEntry} from '@/domain/lexicon'
import type {StudioService} from './contract'
import type {Material,Folder,Prompt,ExtractionTemplate,Task,TemplateFolder} from '@/domain/types'
import {demoFolders,demoMaterials,demoPrompts,demoTemplates,demoTasks,demoResult} from './fixtures'
import {ServiceError} from './http'
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v))
/** All state is isolated per provider and lost on refresh. Every source is fictional. */
export function createDemoService():StudioService {
 let files=copy(demoMaterials),folders=copy(demoFolders),prompts=copy(demoPrompts),templates=copy(demoTemplates),tasks=copy(demoTasks)
 let templateFolders:TemplateFolder[]=[{id:'demo-template-folder',name:'虚构示例模板',scope:'system'},{id:'demo-template-personal',name:'我的模板',scope:'personal'}]
 const reports=new Set<string>()
 let lexicon:LexiconEntry[]=[{word:'的',kind:'stop'},{word:'以及',kind:'stop'},{word:'专项资金',kind:'user'},{word:'政府采购',kind:'user'}]
 const id=()=>`demo-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
 const requireTask=(taskId:string)=>{const t=tasks.find(t=>t.id===taskId);if(!t)throw new ServiceError('演示任务不存在');return t}
 const allFolders=():Folder[]=>{const result:Folder[]=[];const visit=(rows:Folder[])=>rows.forEach(r=>{result.push(r);visit(r.children||[])});visit(folders);return result}
 const service:StudioService={
 capabilities:{demo:true,taskStop:true,taskRetry:true,personalPrompts:true,templateFolders:true,meetingFollowup:true,reviewPersistence:false,taskAttachmentOverrides:true,prepaidUnitConfirmed:true},
 async loadLexicon(){return copy(lexicon)},
 async saveLexicon(rows,expected){if(lexiconSignature(lexicon)!==lexiconSignature(expected))throw new ServiceError('词库已变化，请重新打开。');lexicon=copy(rows)},
 async listFolders(space){return copy(folders.filter(f=>f.space===space))},
 async listFiles(q,signal){if(signal?.aborted)throw new DOMException('Aborted','AbortError');const ids=new Set<string>();if(q.folderId){ids.add(q.folderId);if(q.includeDescendants){const visit=(parent:string)=>allFolders().filter(f=>f.parentId===parent).forEach(f=>{ids.add(f.id);visit(f.id)});visit(q.folderId)}}const rows=files.filter(f=>f.space===q.space&&(!q.folderId||ids.has(f.folderId))&&(!q.keyword||f.name.includes(q.keyword))&&(!q.parseStatus||f.parseStatus===q.parseStatus)&&(!q.extensions?.length||q.extensions.map(x=>x.replace(/^\./,'')).includes(f.extension)));return{items:copy(rows.slice((q.page-1)*q.size,q.page*q.size)),total:rows.length,page:q.page,size:q.size}},
 async resolveSelection(q,signal){return(await service.listFiles({...q,page:1,size:100000},signal)).items},
 async getMaterials(ids){return copy(ids.map(id=>files.find(f=>f.id===id)).filter((f):f is Material=>!!f))},
 async getSource(file){if(!files.some(f=>f.id===file.id))throw new ServiceError('演示资料不存在');return{text:`【虚构演示资料，无真实业务含义】\n${file.name}\n\n示例项目于2026年1月15日讨论实施计划，合同金额120万元。项目应完成审批并按合同约定支付费用。所有单位、人员、事件及金额均为虚构，仅供界面演示。`,mimeType:'text/plain',columns:['项目名称','地点','金额'],sheetNames:['虚构示例台账']}},
 async upload(file,folderId){const folder=allFolders().find(f=>f.id===folderId);if(!folder)throw new ServiceError('请选择演示目录');const f:Material={id:id(),name:file.name,folderId,path:folder.name,space:folder.space,size:file.size,extension:file.name.split('.').pop()||'',parseStatus:'unparsed',canAnalyze:true,canDownload:true};files.push(f);return copy(f)},
 async createFolder(name,parentId,space){const f:Folder={id:id(),name,parentId,space,children:[],canManage:true};const parent=allFolders().find(f=>f.id===parentId);if(parent)(parent.children ||= []).push(f);else folders.push(f);return copy(f)},
 async renameFolder(folderId,name){const f=allFolders().find(f=>f.id===folderId);if(!f)throw new ServiceError('目录不存在');f.name=name},
 async deleteFolder(folderId){if(files.some(f=>f.folderId===folderId)||allFolders().some(f=>f.parentId===folderId))throw new ServiceError('目录非空，不能删除');const remove=(rows:Folder[]):Folder[]=>rows.filter(f=>f.id!==folderId).map(f=>({...f,children:remove(f.children||[])}));folders=remove(folders)},
 async deleteFiles(ids){files=files.filter(f=>!ids.includes(f.id))},
 async parseFiles(ids){files.filter(f=>ids.includes(f.id)).forEach(f=>f.parseStatus='parsed')},
 async saveAttachments(fileId,ids){const f=files.find(f=>f.id===fileId);if(!f)throw new ServiceError('资料不存在');if(ids.includes(fileId))throw new ServiceError('资料不能关联自身');f.attachmentIds=[...ids]},
 async listPrompts(tool,stage){return copy(prompts.filter(p=>(!tool||p.tool===tool)&&(!stage||p.stage===stage)))},
 async savePrompt(p){const saved:Prompt={id:p.id||id(),name:p.name||'个人演示提示词',content:p.content||'',scope:'personal',stage:p.stage||'main',tool:p.tool,category:p.category,config:copy(p.config||{})};prompts=prompts.filter(p=>p.id!==saved.id);prompts.push(saved);return copy(saved)},
 async deletePrompt(promptId){prompts=prompts.filter(p=>p.id!==promptId)},
 async listTemplates(){return copy(templates)},
 async saveTemplate(t){const saved:ExtractionTemplate={...copy(t),id:t.id||id()};templates=templates.filter(t=>t.id!==saved.id);templates.push(saved);return copy(saved)},
 async deleteTemplate(templateId){templates=templates.filter(t=>t.id!==templateId)},
 async listTemplateFolders(){return copy(templateFolders)},
 async saveTemplateFolder(f){const saved={...f,id:f.id||id()};templateFolders=templateFolders.filter(f=>f.id!==saved.id);templateFolders.push(saved);return copy(saved)},
 async deleteTemplateFolder(folderId){if(templates.some(t=>t.folderId===folderId)||templateFolders.some(f=>f.parentId===folderId))throw new ServiceError('模板目录非空');templateFolders=templateFolders.filter(f=>f.id!==folderId)},
 async listTasks(q){const rows=tasks.filter(t=>(!q.tool||t.tool===q.tool)&&(!q.keyword||t.name.includes(q.keyword))&&(!q.status||t.status===q.status));return{items:copy(rows.slice((q.page-1)*q.size,q.page*q.size)),total:rows.length,page:q.page,size:q.size}},
 async getTask(taskId){return copy(requireTask(taskId))},
 async submitTask(draft){const results=demoResult(draft.tool,draft.files);if(draft.tool==='extract'){results.fields=(draft.config.fields||[]).map((f:any)=>f.name);results.rows=draft.files.map(file=>({fileName:file.name,values:Object.fromEntries((draft.config.fields||[]).map((f:any)=>[f.name,`虚构示例：${f.name}`])),evidence:[{fileId:file.id,fileName:file.name,page:1,quote:'虚构演示内容，仅用于界面演示'}]}))}const task:Task={id:id(),name:draft.name,tool:draft.tool,status:draft.tool==='prepaid'?'awaiting_input':'completed',createdAt:new Date().toISOString(),total:draft.files.length,completed:draft.files.length,failed:0,hasResults:true,progress:100,draft:copy(draft),results};tasks.unshift(task);return copy(task)},
 async exportTask(task,format){if(!task.hasResults)throw new ServiceError('任务无结果');if(format==='excel'){const XLSX=await import('xlsx');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['声明','虚构演示数据，仅用于界面验证'],['任务',task.name]]),'说明');for(const [key,value]of Object.entries(task.results||{})){const rows=(Array.isArray(value)?value:[value]).map(row=>{const record=typeof row==='object'&&row!==null?row:{内容:row};return Object.fromEntries(Object.entries(record).map(([key,val])=>[key,typeof val==='object'?JSON.stringify(val):val]))});if(rows.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),key.replace(/[\\/?:*\[\]]/g,'_').slice(0,31))}return new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})};if(format==='csv'){const quote=(v:unknown)=>'"'+String(typeof v==='object'?JSON.stringify(v):v??'').replaceAll('"','""')+'"';const rows=Object.entries(task.results||{}).flatMap(([section,value])=>(Array.isArray(value)?value:[value]).map(row=>({section,data:row})));return new Blob(['\uFEFF'+[['声明','结果分组','内容'].map(quote).join(','),...rows.map(row=>['虚构演示数据',row.section,row.data].map(quote).join(','))].join('\r\n')],{type:'text/csv;charset=utf-8'})}return new Blob([format==='json'?JSON.stringify({notice:'虚构演示数据',task},null,2):`# 虚构演示数据\n\n## ${task.name}\n\n\`\`\`json\n${JSON.stringify(task.results,null,2)}\n\`\`\``],{type:format==='json'?'application/json':'text/markdown;charset=utf-8'})},
 async retryTask(taskId){const t=requireTask(taskId);t.status='completed';t.failed=0;t.completed=t.total},
 async stopTask(taskId){const t=requireTask(taskId);if(!['queued','running'].includes(t.status))throw new ServiceError('任务已结束，不能再停止');t.status='stopped'},
 async getContractReport(taskId){requireTask(taskId);return{status:reports.has(taskId)?'success':'idle',filename:'虚构示例合同报告.txt'}},
 async generateContractReport(taskId){const task=requireTask(taskId);if(!task.hasResults||!['completed','partial'].includes(task.status))throw new ServiceError('分析尚未结束');reports.add(taskId)},
 async downloadContractReport(taskId){const task=requireTask(taskId);if(!reports.has(taskId))throw new ServiceError('请先生成报告');return new Blob(['虚构演示报告，仅用于前端交互验证。\n'+task.name+'\n\n'+JSON.stringify(task.results,null,2)],{type:'text/plain;charset=utf-8'})},
 async continueTask(task,action,payload){const t=requireTask(task.id);if(!t.results)throw new ServiceError('演示任务无结果');if(t.tool==='prepaid'){const base=Number(payload.billing_base_wan??payload.billingBase);if(!Number.isFinite(base)||base<0)throw new ServiceError('请输入有效计费基数');t.results.calculations=[{feeType:'虚构示例服务费',base,rate:'1%',calculatedAmount:base*0.01,unit:'元',formula:'基数 × 1%（虚构示例）'}];t.status='completed'}else if(action==='meeting-question')t.results.answers=`【虚构演示回答】问题：${payload.question}。此处展示问答交互，实际结论须由真实分析服务生成。`;else if(action==='meeting-risk')t.results.risks=demoResult('meeting').risks;else if(action==='association-compare')t.results.comparison='虚构示例：请核验两侧金额差异。';else if(action!=='contract-report')throw new ServiceError('不支持此演示操作');return copy(t)}
 };return service
}
