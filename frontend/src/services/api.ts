import {wordCloudResult} from '@/domain/legacyResults'
import {lexiconSignature,type LexiconEntry} from '@/domain/lexicon'
import type {StudioService} from './contract'
import type {Task,Material,FileQuery,ToolDraft,ToolId,JsonObject,Prompt,TemplateFolder} from '@/domain/types'
import {createHttp,unavailable,ServiceError,type Requester} from './http'
import {normalizeMaterial,normalizeFolder,normalizeTask,normalizeTemplate,normalizeTemplateFolder,flattenPromptTree,listOf,safeJson} from '@/domain/normalizers'
import {buildSubmitPayload,functionTypes,toolMeta} from '@/domain/payloads'
export interface ApiOptions {request?:Requester;baseUrl?:string;endpoints?:Record<string,string>;prepaidUnitConfirmed?:boolean;maxSelection?:number}
const enc=encodeURIComponent
const arrayOf=(data:any)=>Array.isArray(data)?data:listOf(data?.files||data?.folders||data?.templates||data)
export function createApiService(options:ApiOptions={}):StudioService {
 const request=options.request||createHttp(options.baseUrl||'')
 const endpoints=options.endpoints||{}
 // The old DELETE route deletes history if a task finishes between read and write.
 // Expose stop only after the host supplies an atomic, cancellation-only route.
 const stopEndpoint=endpoints.taskStop&&!/DeleteTaskSchedules/i.test(endpoints.taskStop)?endpoints.taskStop:undefined
 const files=new Map<string,Material>(),submitted=new Map<string,ToolDraft>()
 const maxSelection=options.maxSelection||5000
 // Share only in-flight lookups; settled paths may be renamed/deleted by another session.
 const folderCreation=new Map<string,Promise<string>>()
 const folderSpaces=new Map<string,string>()
 const requireEndpoint=(key:string,label:string)=>endpoints[key]||unavailable(label)
 const api:StudioService={
 capabilities:{demo:false,taskStop:!!stopEndpoint,taskRetry:true,personalPrompts:true,templateFolders:true,meetingFollowup:!!endpoints.meetingRisk&&!!endpoints.meetingQuestion,reviewPersistence:false,taskAttachmentOverrides:!!endpoints.taskAttachmentOverrides,prepaidUnitConfirmed:options.prepaidUnitConfirmed===true},
 async loadLexicon(){const rows:LexiconEntry[]=[];for(let page=1;page<=50;page++){const data=await request('/api/v1/word-cloud/lexicon',{params:{page,page_size:200}});if(!Number.isFinite(Number(data?.total)))throw new ServiceError('词库接口未返回总数，暂不能确认完整范围。');const next=listOf(data).map(r=>({word:String(r.word||'').trim(),kind:r.kind==='user'?'user' as const:'stop' as const,source:r.source||'manual'}));rows.push(...next);if(new Set(rows.map(r=>r.word)).size!==rows.length)throw new ServiceError('词库返回重复词条，请刷新后重试。');if(rows.length>=Number(data.total??rows.length))return rows;if(!next.length)throw new ServiceError('词库返回不完整，暂不能保存。')}throw new ServiceError('词库超过 10000 条，请使用原词库管理按范围维护。')},
 async saveLexicon(rows,expected){const current=await api.loadLexicon();if(lexiconSignature(current)!==lexiconSignature(expected))throw new ServiceError('词库已在其他页面发生变化，请重新打开后修改。');await request('/api/v1/word-cloud/lexicon',{method:'PUT',body:{items:rows.map(r=>({word:r.word,kind:r.kind,source:r.source||'manual'}))}})},
 async listFolders(space){const data=await request('/api/v1/file-manager/folders/tree',{params:{space_type:space}});const result=arrayOf(data).map(f=>normalizeFolder(f,space));const remember=(rows:typeof result)=>rows.forEach(f=>{folderSpaces.set(f.id,f.space);remember(f.children||[])});remember(result);return result},
 async listFiles(q,signal){
  // Original by-space only supports PUBLIC/PERSONAL. A project requires a selected project directory.
  if(q.space==='PROJECT'&&!q.folderId)return{items:[],total:0,page:q.page,size:q.size}
  const data=await request(q.folderId?'/api/v1/file-manager/files':'/api/v1/file-manager/files/by-space',{params:{folder_id:q.folderId,space_type:q.folderId?undefined:q.space,page:q.page,page_size:q.size,recursive:q.includeDescendants,search:q.keyword||undefined,parse_status:q.parseStatus?({unparsed:0,parsing:1,parsed:2,failed:3})[q.parseStatus]:undefined,file_extensions:q.extensions?.map(e=>e.startsWith('.')?e:'.'+e).join(',')},signal})
  const items=arrayOf(data).map(raw=>normalizeMaterial({...raw,space:q.space}));items.forEach(f=>files.set(f.id,f))
  if(!Number.isFinite(Number(data?.total)))throw new ServiceError('文件接口缺少完整范围的总数，暂不能确认分页范围。')
  return{items,total:Number(data.total),page:q.page,size:q.size}
 },
 async resolveSelection(q,signal){
  const first=await api.listFiles({...q,page:1,size:100},signal)
  if(first.total>maxSelection)throw new ServiceError(`当前范围超过 ${maxSelection} 份，请缩小范围后选择；更大规模需接入服务端选择快照。`)
  const result=new Map(first.items.map(f=>[f.id,f]))
  for(let page=2;result.size<first.total&&page<=Math.ceil(first.total/100);page++){
   const next=await api.listFiles({...q,page,size:100},signal)
   if(next.total!==first.total)throw new ServiceError('目录内容已变化，请刷新列表后重新选择全部页。')
   next.items.forEach(f=>result.set(f.id,f))
  }
  if(result.size!==first.total)throw new ServiceError('未能完整读取全部页，请刷新后重试；尚未改变当前选择。')
  return [...result.values()]
 },
 async getMaterials(ids){
  if(!ids.length)return[]
  if(endpoints.materials){const data=await request(endpoints.materials,{method:'POST',body:{file_ids:ids}});return arrayOf(data).map(normalizeMaterial)}
  const known=ids.map(id=>files.get(id));if(known.some(f=>!f))throw new ServiceError('部分资料信息尚未载入，请在资料目录重新选择；跨会话查看历史来源需接入文件元数据接口。')
  // The supplied source has no metadata-by-ID endpoint. Revalidate visible metadata by directory.
  const groups=new Map<string,Material[]>()
  for(const f of known as Material[]){const key=f.space+':'+f.folderId;groups.set(key,[...(groups.get(key)||[]),f])}
  const refreshed=new Map<string,Material>()
  for(const group of groups.values()){const f=group[0];const rows=await api.resolveSelection({space:f.space,folderId:f.folderId||undefined,keyword:'',includeDescendants:false,page:1,size:100});rows.forEach(x=>refreshed.set(x.id,x))}
  return ids.map(id=>refreshed.get(id)).filter((f):f is Material=>!!f)
 },
 async getSource(file,signal){
  const spreadsheet=['xlsx','xls','csv'].includes(file.extension)
  const [preview,content,columns]=await Promise.allSettled([
   request(`/api/v1/file-manager/files/${enc(file.id)}/${spreadsheet?'preview-pdf':'preview'}`,{signal}),
   request(`/api/v1/file-manager/files/${enc(file.id)}/content`,{signal}),
   spreadsheet?request(`/api/v1/file-manager/files/${enc(file.id)}/column-headers`,{signal}):Promise.resolve(null)
  ])
  if(signal?.aborted)throw new DOMException('Aborted','AbortError')
  if(preview.status==='rejected'&&content.status==='rejected')throw preview.reason
  const p=preview.status==='fulfilled'?preview.value:{},c=content.status==='fulfilled'?content.value:{},h=columns.status==='fulfilled'?columns.value:null
  const url=typeof p==='string'?p:p?.url||p?.preview_url||p?.file_url||p?.pdf_url
  if(url&&!/^(https?:|\/|blob:)/i.test(url))throw new ServiceError('服务返回了不支持的原文地址。')
  return{url,text:typeof c==='string'?c:c?.file_content??c?.content??c?.text,mimeType:p?.mime_type||p?.content_type||(spreadsheet?'application/pdf':undefined),totalPages:p?.page_count,columns:h?.columns||h?.headers||[],sheetNames:h?.sheet_names||[]}
 },
 async upload(file,folderId,relativePath){
  let target=folderId
  const parts=(relativePath||'').split('/').filter(Boolean);parts.pop();const space=folderSpaces.get(folderId);if(parts.length&&!space)throw new ServiceError('上传目标目录信息已失效，请刷新目录后重试。')
  for(const part of parts){if(part==='.'||part==='..')throw new ServiceError('文件路径不合法');const key=target+'/'+part;let work=folderCreation.get(key);if(!work){work=(async()=>{const rows=arrayOf(await request(`/api/v1/file-manager/folders/${enc(target)}/children`));const existing=rows.find(x=>(x.folder_name||x.name)===part);if(existing)return String(existing.folder_id||existing.id);return(await api.createFolder(part,target,space!)).id})().finally(()=>{if(folderCreation.get(key)===work)folderCreation.delete(key)});folderCreation.set(key,work)}target=await work}
  const data=new FormData();data.append('file',file);data.append('folder_id',target)
  const raw=await request('/api/v1/file-manager/files/upload',{method:'POST',body:data})
  const material=normalizeMaterial({...raw,space:raw.space||raw.space_type||space,folder_id:raw.folder_id||target,file_name:raw.file_name||file.name,file_size:raw.file_size||file.size});files.set(material.id,material);return material
 },
 async createFolder(name,parentId,space){const folder=normalizeFolder(await request('/api/v1/file-manager/folders',{method:'POST',body:{folder_name:name,parent_id:parentId||null,space_type:space}}),space);folderSpaces.set(folder.id,folder.space);return folder},
 async renameFolder(id,name){await request(`/api/v1/file-manager/folders/${enc(id)}/rename`,{method:'PUT',body:{folder_name:name}})},
 async deleteFolder(id){await request(`/api/v1/file-manager/folders/${enc(id)}`,{method:'DELETE'})},
 async deleteFiles(ids){for(const id of ids)await request(`/api/v1/file-manager/files/${enc(id)}`,{method:'DELETE'})},
 async parseFiles(ids){await request('/api/v1/file-manager/content-progress/requeue-by-ids',{method:'POST',body:{file_ids:ids}})},
 async saveAttachments(fileId,ids){
  if(ids.includes(fileId))throw new ServiceError('资料不能关联自身为附件。')
  const existing=arrayOf(await request(`/api/v1/file-manager/files/${enc(fileId)}/attachments`));const target=new Set(ids)
  const current=new Set(existing.map(x=>String(x.attachment_file_id||x.file_id||x.attachment_id||x.id)))
  const add=ids.filter(id=>!current.has(id));if(add.length)await request(`/api/v1/file-manager/files/${enc(fileId)}/attachments`,{method:'POST',body:{attachment_file_ids:add}})
  for(const old of existing){const id=String(old.attachment_file_id||old.file_id||old.id);if(!target.has(id))await request(`/api/v1/file-manager/files/${enc(fileId)}/attachments/${enc(String(old.attachment_id||old.id||id))}`,{method:'DELETE'})}
 },
 async listPrompts(tool,stage){
  if(!tool){const prompts:Prompt[]=[];const ids=new Set<string>();for(let page=1;page<=50;page++){const data=await request('/api/v3/prompts/list',{method:'POST',body:{page,size:100,status:'enabled'}});const rows=flattenPromptTree(data);if(rows.some(p=>ids.has(p.id)))throw new ServiceError('提示词分页返回重复数据，请刷新后重试。');rows.forEach(p=>ids.add(p.id));prompts.push(...rows);const total=Number(data?.total??prompts.length);if(prompts.length>=total)return prompts;if(!rows.length)throw new ServiceError('提示词列表返回不完整，请稍后重试。')}throw new ServiceError('提示词数量超过当前加载上限，请按工具查询。')}
  const stages=stage?[stage]:Object.keys(functionTypes[tool]||{})
  const result:Prompt[]=[]
  for(const key of stages){const fn=functionTypes[tool]?.[key];if(!fn)continue;const data=await request('/api/v3/prompts/tree-by-function-type',{params:{functionType:fn}});result.push(...flattenPromptTree(data,tool,key))}
  return result
 },
 async savePrompt(p){
  if(p.id&&p.scope&&p.scope!=='personal')throw new ServiceError('只能编辑个人提示词，请先另存。')
  let spaceId=p.id&&p.scope==='personal'?p.raw?.space_id:undefined
  if(!spaceId){const spaces=arrayOf(await request('/api/v3/prompt-spaces'));const personal=spaces.find(s=>['personal','private'].includes(s.type)||/个人/.test(s.name));spaceId=personal?.id}
  if(!spaceId)throw new ServiceError('未找到可写的个人提示词空间，请在提示词管理中确认权限。')
  const raw=await request(p.id?`/api/v3/prompts/${enc(p.id)}`:'/api/v3/prompts',{method:p.id?'PUT':'POST',body:{name:p.name,content:p.content,space_id:spaceId,category_ids:p.id?p.raw?.category_ids||[]:[],status:'enabled',is_default:0,config:p.config||{},function_type:(p.tool?functionTypes[p.tool]?.[p.stage||'main']:undefined)||p.raw?.function_type}})
  return{...p,id:String(raw?.id||p.id||''),scope:'personal',stage:p.stage||'main',raw} as Prompt
 },
 async deletePrompt(id){await request(`/api/v3/prompts/${enc(id)}`,{method:'DELETE'})},
 async listTemplates(){const items:any[]=[];for(let page=1;page<=50;page++){const data=await request('/api/v1/template/getPublicAndPrivateTemplates',{method:'POST',body:{page,size:100}});const rows=arrayOf(data);items.push(...rows);if(items.length>=Number(data?.total??rows.length)||rows.length===0)break;if(page===50)throw new ServiceError('模板数量超过当前加载上限，请按目录查询。')}return items.map(normalizeTemplate)},
 async saveTemplate(t){const update=!!t.id;const raw=await request(`/api/v1/template/${update?'updateTable':'createTable'}`,{method:'POST',body:{prompt_uuid:update?t.id:undefined,template_name:t.name,template_desc:t.description,pid:t.folderId||null,prompt:JSON.stringify(t.fields.map(f=>({name:f.name,description:f.description}))),template_type:t.scope==='system'?'0':'1'}});return normalizeTemplate({...t,...raw,id:raw?.prompt_uuid||raw?.id||t.id})},
 async deleteTemplate(id){await request(`/api/v1/template/deleteTable/${enc(id)}`)},
 async listTemplateFolders(){const data=await request('/api/v1/template/getDirectoryTree');const out:TemplateFolder[]=[];const visit=(row:any,parentId?:string,scope:'personal'|'system'='personal')=>{const folder=normalizeTemplateFolder(row,parentId,scope);out.push(folder);(row.children||[]).forEach((c:any)=>visit(c,folder.id,folder.scope))};arrayOf(data).forEach(r=>visit(r));return out},
 async saveTemplateFolder(f){const raw=await request(`/api/v1/template/${f.id?'updateDirectory':'createDirectory'}`,{method:'POST',body:{directory_uuid:f.id||undefined,directory_name:f.name,pid:f.parentId||null}});return normalizeTemplateFolder({...f,...raw},f.parentId,f.scope)},
 async deleteTemplateFolder(id){await request(`/api/v1/template/deleteDirectory/${enc(id)}`)},
 async listTasks(q,signal){
  const codes:Record<string,number>={queued:0,running:1,completed:2,failed:3}
  const fetchPage=async(page:number,size:number)=>request('/api/v1/task/PageList',{method:'POST',body:{page,size,tool_name:q.tool?toolMeta[q.tool].name:undefined,task_name:q.keyword||undefined,processing_status:q.status?codes[q.status]:undefined,include_results:false,include_selection_summary:false,include_task_steps:false,prefer_runtime:true,include_total:true,include_progress_counts:true},signal})
  const derived=!!q.status&&!['queued','running','failed'].includes(q.status)
  if(!derived){const data=await fetchPage(q.page,q.size);return{items:listOf(data).map(normalizeTask),total:Number(data.total||0),page:q.page,size:q.size}}
  const matching:Task[]=[],seen=new Set<string>();let total=0
  for(let page=1;page<=50;page++){
   const data=await fetchPage(page,100),rows=listOf(data).map(normalizeTask)
   if(page===1){total=Number(data.total||0);if(total>5000)throw new ServiceError('当前状态筛选范围超过 5000 条，请先选择工具或输入任务名称。')}
   else if(Number(data.total)!==total)throw new ServiceError('任务列表已变化，请刷新后重新筛选。')
   for(const row of rows){if(seen.has(row.id))throw new ServiceError('任务分页返回重复记录，请刷新后重试。');seen.add(row.id);if(row.status===q.status)matching.push(row)}
   if(seen.size>=total)return{items:matching.slice((q.page-1)*q.size,q.page*q.size),total:matching.length,page:q.page,size:q.size}
   if(!rows.length)throw new ServiceError('任务列表返回不完整，请稍后重试。')
  }
  throw new ServiceError('任务筛选范围过大，请缩小查询范围。')
 },
 async getTask(id,signal){const raw=await request(`/api/v1/task/GetTaskSchedules/${enc(id)}`,{params:{prefer_runtime:true,include_results:true,include_result_details:true,include_task_steps:true,include_selection_summary:true},signal});const task=normalizeTask({...raw,task_uuid:raw.task_uuid||id});if(task.tool==='word'&&['completed','partial'].includes(task.status)&&!Array.isArray(task.results?.words)){const result=await request(`/api/v1/word-cloud/tasks/${enc(id)}/result`,{signal});if(!Array.isArray(result?.files))throw new ServiceError('词云接口未返回文件词频结果。');task.results=wordCloudResult(result);task.hasResults=true}const snapshot=submitted.get(id);if(snapshot&&!task.draft)task.draft=JSON.parse(JSON.stringify(snapshot));return task},
 async submitTask(draft){
  let path='/api/v1/task/BatchExecuteByFilter'
  if(draft.tool==='bidding')path=requireEndpoint('biddingSubmit','招投标任务创建')
  if(draft.tool==='meeting')path=requireEndpoint('meetingSubmit','会议纪要任务创建')
  if(draft.tool==='timeline')path=requireEndpoint('timelineSubmit','时间轴任务创建')
  if(draft.tool==='association')path='/api/v1/task/task-CreateSchedules'
  // A task-local attachment override is not in the supplied API. Do not mutate library relations here.
  if(Object.keys(draft.attachments).length&&!endpoints.taskAttachmentOverrides){
   for(const [fileId,attachments]of Object.entries(draft.attachments)){const saved=arrayOf(await request(`/api/v1/file-manager/files/${enc(fileId)}/attachments`));const actual=saved.map(x=>String(x.attachment_file_id||x.file_id||x.id)).sort();const desired=attachments.map(f=>f.id).sort();if(JSON.stringify(actual)!==JSON.stringify(desired))throw new ServiceError('本次附件与资料库关联不一致。请先保存资料关联；任务独立附件需接入附件快照接口。')}
  }
  const payload=buildSubmitPayload(draft)
  if(endpoints.taskAttachmentOverrides)payload.attachment_overrides=Object.fromEntries(Object.entries(draft.attachments).map(([id,rows])=>[id,rows.map(f=>f.id)]))
  const raw=await request(path,{method:'POST',body:payload});const id=String(raw?.task_uuid||raw?.analysis_id||raw?.id||'');if(!id)throw new ServiceError('服务已响应，但没有返回任务 ID。请在任务中心确认提交情况，勿重复提交。')
  const copy=JSON.parse(JSON.stringify(draft));submitted.set(id,copy)
  return normalizeTask({...raw,task_uuid:id,task_name:draft.name,tool:draft.tool,draft:copy,file_num:draft.files.length,status:raw.status??'queued'})
 },
 async exportTask(task,format){if(!task.hasResults)throw new ServiceError('任务尚无可导出的结果。');if(task.tool==='engineering')return request(`/api/v1/task/ExportEngineeringProjectResultsZip/${enc(task.id)}`,{blob:true});if(task.tool==='contract')return request(`/api/v1/task/ExportContractCompletenessResults/${enc(task.id)}`,{blob:true});return request('/api/v1/task/ExportExecutionRecords',{method:'POST',body:{task_uuid:task.id,export_format:format},blob:true})},
 async retryTask(id){await request(`/api/v1/task/RetryFailedResults/${enc(id)}`,{method:'POST'})},
 async stopTask(id){if(!stopEndpoint)unavailable('停止任务');const current=await api.getTask(id);if(!['queued','running'].includes(current.status))throw new ServiceError('任务已结束，不能再停止。');await request(stopEndpoint.replace('{id}',enc(id)),{method:'POST',body:{task_uuid:id}})},
 async getContractReport(taskId,signal){const raw=await request(`/api/v1/task/ContractReportBySource/${enc(taskId)}`,{signal});const status=raw?.status||'idle';return{status:['idle','running','success','failed'].includes(status)?status:'unknown',filename:raw?.report_file?.filename,error:raw?.error}},
 async generateContractReport(taskId){const current=await api.getTask(taskId);if(!current.hasResults||!['completed','partial'].includes(current.status))throw new ServiceError('请等待合同分析结束后再生成报告。');await request(`/api/v1/task/ContractReportGenerate/${enc(taskId)}`,{method:'POST'})},
 async downloadContractReport(taskId){return request(`/api/v1/task/ContractReportDownload/${enc(taskId)}`,{blob:true})},
 async continueTask(task,action,payload){
  if(task.tool==='prepaid'){if(!api.capabilities.prepaidUnitConfirmed)throw new ServiceError('计费基数单位尚待后端确认，确认元与 billing_base_wan 的映射后才能提交。');await request('/api/v1/task/prepaid_expenses_continue',{method:'POST',body:{task_uuid:task.id,billing_base_wan:payload.billingBase??payload.billing_base_wan}})}
  else if(task.tool==='association'&&action==='association-compare')await request('/api/v1/task/association_degree_two_tables_compare_analyze',{method:'POST',body:{task_uuid:task.id,...payload}})
  else if(task.tool==='contract'&&action==='contract-report')await api.generateContractReport(task.id)
  else if(task.tool==='meeting'&&['meeting-risk','meeting-question'].includes(action)){const endpoint=requireEndpoint(action==='meeting-risk'?'meetingRisk':'meetingQuestion','会议后续分析');await request(endpoint.replace('{id}',enc(task.id)),{method:'POST',body:payload})}
  else throw new ServiceError('当前工具不支持此后续操作。')
  return api.getTask(task.id)
 }
 }
 return api
}
