import type {Material,Folder,Task,TaskStatus,ToolId,JsonObject,ExtractionTemplate,TemplateFolder,Prompt,ToolDraft} from './types'
import {functionTypes} from './payloads'
import {legacyResult} from './legacyResults'
export const safeJson=(value:any,fallback:any={})=>{if(typeof value!=='string')return value??fallback;try{return JSON.parse(value)}catch{return fallback}}
export function listOf(raw:any):any[] { return Array.isArray(raw)?raw:Array.isArray(raw?.items)?raw.items:Array.isArray(raw?.list)?raw.list:Array.isArray(raw?.rows)?raw.rows:Array.isArray(raw?.records)?raw.records:[] }
export function normalizeMaterial(raw:JsonObject):Material {const name=String(raw.name||raw.file_name||raw.original_name||'未命名资料'); const s=String(raw.parseStatus??raw.parse_status??raw.document_parse_status??raw.content_status??'unparsed').toLowerCase();return {id:String(raw.id||raw.file_id||raw.file_uuid||''),name,folderId:String(raw.folderId||raw.folder_id||''),path:raw.path||raw.folder_path||'',space:raw.space||raw.space_type||'PUBLIC',size:Number(raw.size||raw.file_size||0),extension:String(raw.extension||raw.file_extension||name.split('.').pop()||'').replace(/^\./,'').toLowerCase(),parseStatus:({'2':'parsed','1':'parsing','3':'failed','0':'unparsed',parsed:'parsed',completed:'parsed',success:'parsed',parsing:'parsing',processing:'parsing',failed:'failed',error:'failed'} as Record<string,Material['parseStatus']>)[s]||'unparsed',owner:raw.owner||raw.owner_name||raw.create_user_name,updatedAt:raw.updatedAt||raw.update_time,canAnalyze:raw.canAnalyze??raw.can_analyze??raw.permissions?.analyze,canDownload:raw.canDownload??raw.can_download??raw.permissions?.download,attachmentIds:raw.attachmentIds||raw.attachment_ids,raw} }
export function normalizeFolder(raw:JsonObject,space='PUBLIC'):Folder {return{id:String(raw.id||raw.folder_id||''),name:raw.name||raw.folder_name||'',parentId:String(raw.parentId||raw.parent_id||''),space:raw.space||raw.space_type||space,path:raw.path||raw.folder_path,canManage:raw.can_manage??raw.permissions?.manage,children:(raw.children||[]).map((r:JsonObject)=>normalizeFolder(r,space)),raw}}
const toolCodes:Record<string,ToolId>={fileToPdf:'extract',wordCloud:'word',agent_info_extraction_and_topic_summary:'theme',timeline:'timeline',timeline_analysis:'timeline',meeting_minutes:'meeting',meeting_minutes_analysis:'meeting',riskPointAnalysis:'risk',bidding_analysis:'bidding',bidding:'bidding',contractCompleteness:'contract',prepaidExpenses:'prepaid',engineering_project_data_consistency:'engineering',association_degree_two_tables:'association','theme-analysis-combined':'theme','risk-point-analysis':'risk','prepaid-expenses':'prepaid','engineering-project-tool-uuid':'engineering','association-degree-two-tables-tool-uuid':'association'}
const names:Record<string,ToolId>={'信息提取':'extract','非结构化信息提取':'extract','词云分析':'word','主题归纳':'theme','时间轴分析':'timeline','会议纪要分析':'meeting','风险点分析':'risk','招投标分析':'bidding','合同分析':'contract','待摊费用':'prepaid','工程项目一致性':'engineering','两表项目关联度':'association'}
export function resolveTool(raw:JsonObject):ToolId|null {if(raw.tool&&Object.values(toolCodes).includes(raw.tool))return raw.tool; for(const key of ['biz_type','tool_uuid'])if(toolCodes[raw[key]])return toolCodes[raw[key]];if(names[raw.tool_name])return names[raw.tool_name];return ({1:'extract',2:'contract',4:'word',5:'theme',6:'engineering',8:'risk',9:'association'} as Record<string,ToolId>)[raw.task_type]||null}
export function normalizeStatus(raw:any):TaskStatus {const s=String(raw).toLowerCase();return ({'0':'queued','1':'running','2':'completed','3':'failed',pending:'queued',queued:'queued',waiting:'queued',running:'running',processing:'running',success:'completed',completed:'completed',partial:'partial',failed:'failed',failure:'failed',stopped:'stopped',cancelled:'stopped',awaiting_billing_base:'awaiting_input',awaiting_input:'awaiting_input'} as Record<string,TaskStatus>)[s]||'unknown'}
export function normalizeTask(raw:JsonObject):Task {
 const schedules=listOf(raw.task_schedule_result_list||raw.task_schedule_results||raw.schedules||raw.results_list)
 const results=raw.results&&typeof raw.results==='object'&&!Array.isArray(raw.results)?raw.results:undefined
 let status=normalizeStatus(raw.status??raw.processing_status)
 const completed=Number(raw.completed??raw.success_count??raw.completed_count??0),failed=Number(raw.failed??raw.failed_count??0)
 if(status==='completed'&&failed>0&&completed>0)status='partial'
 if(raw.exec_phase==='awaiting_billing_base'||raw.phase==='awaiting_billing_base'||raw.prepaid_phase==='awaiting_billing_base'||raw.prepaid_context?.phase==='awaiting_billing_base')status='awaiting_input'
 if(raw.prepaid_phase==='calculating'||raw.prepaid_phase==='pending_extract')status='running'
 const task:Task={id:String(raw.id||raw.task_uuid||raw.analysis_id||''),name:String(raw.name||raw.task_name||'未命名任务'),tool:resolveTool(raw),status,createdAt:String(raw.createdAt||raw.create_time||raw.created_at||''),updatedAt:raw.updatedAt||raw.update_time,stage:raw.stage||raw.prepaid_phase||raw.phase||raw.current_step,total:Number(raw.total??raw.file_num??raw.total_count??schedules.length??0),completed,failed,hasResults:raw.hasResults===true||raw.has_results===true||Boolean(results)||schedules.some((s:any)=>Boolean(s.disposal_result??s.DISPOSAL_RESULT)),progress:typeof raw.progress==='number'?raw.progress:undefined,error:raw.error||raw.error_message,results:results||normalizeScheduleResults(resolveTool(raw),schedules),raw}
 const snapshot=safeJson(raw.draft||raw.configuration_snapshot||raw.input_snapshot,null)
 // Do not manufacture an executable draft from an incomplete historical response.
 if(snapshot?.tool&&Array.isArray(snapshot.files)&&snapshot.config&&snapshot.prompts)task.draft=snapshot as ToolDraft
 return task
}
export function normalizeScheduleResults(tool:ToolId|null,schedules:JsonObject[]):JsonObject|undefined {
 if(!schedules.length)return undefined
 const parts=schedules.map((s):JsonObject=>({...s,disposal_result:s.disposal_result??s.DISPOSAL_RESULT})).filter(s=>s.disposal_result!=null&&s.disposal_result!=='').map(s=>{let data:any=s.disposal_result;for(let i=0;i<3&&typeof data==='string';i++){const parsed=safeJson(data,{text:data});data=parsed}return{source:s,data}})
 if(!parts.length)return undefined
 const raw={schedules:parts.map(p=>p.source)}
 const adapted:JsonObject={raw}
 for(const part of parts){
  const result=legacyResult(tool,part.data,part.source)||canonicalResult(tool,part.data,part.source)
  if(!result){(adapted.unmapped||=[]).push(part.data);continue}
  for(const [key,value]of Object.entries(result)){
   if(Array.isArray(value))adapted[key]=[...(adapted[key]||[]),...value]
   else if(key==='summary'&&adapted.summary&&value)adapted.summary+='\n\n'+value
   else adapted[key]=value
  }
 }
 if(adapted.fields)adapted.fields=[...new Set(adapted.fields)]
 return adapted
}
function canonicalResult(tool:ToolId|null,data:any,source:JsonObject):JsonObject|undefined {
 if(!data||typeof data!=='object'||Array.isArray(data))return
 if(tool==='extract'){
  if(Array.isArray(data.rows))return{rows:data.rows,fields:Array.isArray(data.fields)?data.fields:[...new Set(data.rows.flatMap((row:JsonObject)=>Object.keys(row.values||{})))]}
  const values=data.extracted_fields??data.extraction_result??data.fields
  if(!values||typeof values!=='object'||Array.isArray(values))return
  return{rows:[{id:source.result_uuid,fileId:source.file_uuid||source.file_id||source.FILE_UUID||source.FILE_ID,fileName:source.file_name||source.FILE_NAME,values,evidence:data.evidence||[]}],fields:Object.keys(values)}
 }
 const aliases:Record<string,Record<string,string[]>>={
  word:{words:['words','word_frequencies']},theme:{themes:['themes'],extractions:['extractions'],fields:['fields']},
  timeline:{events:['events','timeline']},meeting:{meetings:['meetings'],clusters:['clusters'],risks:['risks']},
  risk:{findings:['findings','risk_points']},bidding:{findings:['findings'],projects:['projects']},contract:{findings:['findings','rules']},
  prepaid:{agreements:['agreements'],calculations:['calculations']},
  engineering:{duplicates:['duplicates','duplicate_results'],parentChildren:['parentChildren','parent_child_results']},
  association:{matches:['matches'],unmatchedA:['unmatchedA'],unmatchedB:['unmatchedB'],differences:['differences']}
 }
 const result:JsonObject={}
 for(const [target,keys]of Object.entries(aliases[tool||'']||{})){const key=keys.find(k=>Array.isArray(data[k]));if(key)result[target]=data[key]}
 if(tool==='theme'&&typeof data.summary==='string')result.summary=data.summary
 return Object.keys(result).length?result:undefined
}
export function normalizeTemplate(raw:JsonObject):ExtractionTemplate {const fields=safeJson(raw.fields||raw.rules||raw.prompt,[]);return{id:String(raw.id||raw.prompt_uuid||''),name:raw.name||raw.template_name||'',description:raw.description||raw.template_desc||'',folderId:String(raw.folderId||raw.pid||''),scope:raw.scope==='system'||String(raw.template_type)==='0'?'system':'personal',fields:(Array.isArray(fields)?fields:fields.fields||fields.rules||[]).map((f:any,i:number)=>({id:String(f.id||i),name:f.name||f.field_name||'',description:f.description||f.field_description||''})),raw}}
export function normalizeTemplateFolder(raw:JsonObject,parentId?:string,scope:'personal'|'system'='personal'):TemplateFolder {return{id:String(raw.id||raw.directory_uuid||''),name:raw.name||raw.directory_name||'',parentId:raw.pid||parentId,scope:raw.scope==='system'||raw.directory_type===0?'system':scope}}
export function flattenPromptTree(raw:any,tool?:ToolId,stage?:string):Prompt[] {
 const out:Prompt[]=[],def=raw?.defaultPrompt
 function infer(node:any):{tool?:ToolId;stage:string} {
  if(tool)return{tool,stage:stage||'main'}
  const matches=Object.entries(functionTypes).flatMap(([t,stages])=>Object.entries(stages||{}).filter(([,f])=>f===node.function_type).map(([s])=>({tool:t as ToolId,stage:s})))
  return matches.length===1?matches[0]:matches.length>1?{tool:matches[0].tool,stage:'shared'}:{stage:'unknown'}
 }
 const visit=(node:any,scope:Prompt['scope']='public',category:Prompt['category']='system')=>{
  if(!node||typeof node!=='object')return
  const name=String(node.name||node.label||'')
  const type=String(node.scope||node.space_type||node.space?.type||node.type||'').toLowerCase()
  const nextScope=/个人|private|personal/.test(name+' '+type)?'personal':/机构|organization|org/.test(name+' '+type)?'organization':scope
  const nextCategory=/场景|scenario/.test(name)?'scenario':/功能|function/.test(name)?'function':/系统|system/.test(name)?'system':category
  const content=node.content??node.prompt
  if(typeof content==='string'&&(node.id!=null||node.prompt_id!=null||node.prompt_uuid)){
   const id=String(node.id??node.prompt_id??node.prompt_uuid),flag=node.is_default??node.isDefault
   out.push({id,name,content,scope:nextScope,category:node.category||nextCategory,...infer(node),isDefault:flag===true||flag===1||flag==='1'||String(def?.id??def?.prompt_id)===id,config:safeJson(node.config||node.parameter_settings,undefined),raw:node})
  }
  for(const child of node.children||node.prompts||node.categories||[])visit(child,nextScope,nextCategory)
 }
 for(const root of listOf(raw))visit(root)
 return out
}
