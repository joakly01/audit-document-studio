import {describe,it,expect,vi} from 'vitest'
import {createApiService} from '../src/services/api'
import {createHttp,ServiceError} from '../src/services/http'
import {normalizeMaterial,resolveTool} from '../src/domain/normalizers'
import {buildSubmitPayload} from '../src/domain/payloads'
import type {ToolDraft} from '../src/domain/types'
const draft=(tool:ToolDraft['tool']):ToolDraft=>({tool,name:'测试',files:[{id:'f1',name:'甲.pdf',folderId:'folder',path:'公共空间/测试',space:'PUBLIC',size:10,extension:'pdf',parseStatus:'parsed'}],attachments:{},prompts:{main:{id:'p1',name:'测试',content:'实际执行正文',originalContent:'原文',customized:true}},config:{fields:[{name:'金额',description:'含税金额'}],chunkSize:4000,overlap:200}})
describe('source compatibility',()=>{
 it('maps numeric file statuses rather than treating parsed files as unparsed',()=>{expect(normalizeMaterial({file_id:'f',parse_status:2}).parseStatus).toBe('parsed')})
 it('does not infer ambiguous task type 10',()=>{expect(resolveTool({task_type:10})).toBeNull();expect(resolveTool({task_type:10,biz_type:'prepaidExpenses'})).toBe('prepaid');expect(resolveTool({task_type:10,biz_type:'bidding_analysis'})).toBe('bidding')})
 it('submits customized extraction fields rather than live template id',()=>{const d=draft('extract');d.config.templateId='old';const p=buildSubmitPayload(d);expect(p.files[0].exec_mode).toBe('custom');expect(p.files[0].custom_config.overlap).toBe(200);expect(p.files[0].custom_config.fields[0].name).toBe('金额')})
 it('preserves a 0–1 meeting similarity and parsed-only policy',()=>{const d=draft('meeting');d.config.similarityThreshold=80;d.config.minClusterSize=2;expect(buildSubmitPayload(d)).toMatchObject({similarity_threshold:0.8,parse_status:['parsed'],prompt:'实际执行正文'})})
 it('uses the actual bidding role shape',()=>{const d=draft('bidding');d.config.projects=[{name:'项目',biddingFiles:d.files,companies:[{name:'单位',files:d.files}]}];d.config.analysisModes=['joint'];d.config.modeRules={joint:[{id:'rule1'}]};expect(buildSubmitPayload(d).projects[0].bidding_file.file_uuid).toBe('f1');expect(buildSubmitPayload(d).mode_configs[0].rule_ids).toEqual(['rule1'])})
})
describe('http boundary',()=>{
 it('rejects business errors even when HTTP status is 200',async()=>{const get=createHttp('',vi.fn().mockResolvedValue(new Response(JSON.stringify({code:403,message:'无权限'}),{headers:{'content-type':'application/json'}})));await expect(get('/x')).rejects.toThrow('无权限')})
 it('never treats a SPA fallback as a backend response',async()=>{const get=createHttp('',vi.fn().mockResolvedValue(new Response('<html/>',{headers:{'content-type':'text/html'}})));await expect(get('/api/x')).rejects.toBeInstanceOf(ServiceError)})
 it('bounds all-pages resolution and fails without partial success',async()=>{const request=vi.fn().mockResolvedValue({files:[{file_id:'f',parse_status:2}],total:10001});const service=createApiService({request});await expect(service.resolveSelection({space:'PUBLIC',folderId:'a',keyword:'',includeDescendants:false,page:1,size:20})).rejects.toThrow('超过')})
 it('refuses bidding execution without verified endpoint',async()=>{const service=createApiService({request:vi.fn()});await expect(service.submitTask(draft('bidding'))).rejects.toThrow('接口')})
})

describe('UI configuration snapshots',()=>{
 it('builds engineering mappings separately for each selected ledger and honors edited thresholds',()=>{const d=draft('engineering');d.files.push({...d.files[0],id:'f2'});d.config={duplicateEnabled:true,parentChildEnabled:false,fieldMappings:{f1:{name:'项目名称'},f2:{name:'工程名称'}},weights:{name:1},fieldRules:{name:'按名称一致程度评分'},duplicateThreshold:4.1,duplicate_detection:{threshold:2}};const p=buildSubmitPayload(d);expect(p.files[0].custom_config.duplicate_detection.field_mapping.F1.excel_column).toBe('项目名称');expect(p.files[1].custom_config.duplicate_detection.field_mapping.F1.excel_column).toBe('工程名称');expect(p.files[0].custom_config.duplicate_detection.threshold).toBe(4.1)})
 it('retains association UI mapping rows, weights, rules and thresholds',()=>{const d=draft('association');d.config={table1:d.files[0],table2:{...d.files[0],id:'f2'},mappingRows:[{left:'甲名称',right:'乙名称',weight:1,rule:'按名称评分'}],fullMatchThreshold:4.6,partialMatchThreshold:3.2,candidateLimit:7,maxTotalPairs:900,hardRules:['须相同'],matchLock:false};const config=buildSubmitPayload(d).task_schedule_results[0].parameter_settings.config;expect(config.field_comparison_mapping.F1).toMatchObject({table1_field:'甲名称',table2_field:'乙名称'});expect(config.llm_config).toMatchObject({field_weights:{F1:1},field_prompt_rules:{F1:'按名称评分'},full_match_threshold:4.6,partial_match_threshold:3.2});expect(config.max_total_llm_pairs).toBe(900);expect(config.match_lock_policy.lock_on_full_match).toBe(false)})
 it('unwraps contract rules without sending UI metadata or stale extracted values',()=>{const d=draft('contract');d.config.contractCategory='construction';d.config.rules=[{id:'r',label:'UI名称',path:'UI路径',raw:{rule_name:'真实规则',extracted_value_compliance:'旧值',data_format:'旧格式'}}];expect(buildSubmitPayload(d).files[0].custom_config.parameter_settings.information_extraction).toEqual([{rule_name:'真实规则'}])})
 it.each(['meeting','timeline'] as const)('requires a configured %s submission URL',async tool=>{const request=vi.fn();await expect(createApiService({request}).submitTask(draft(tool))).rejects.toThrow('接口');expect(request).not.toHaveBeenCalled()})
 it('keeps a saved personal prompt configuration',async()=>{const request=vi.fn().mockResolvedValueOnce([{id:'private',type:'personal'}]).mockResolvedValueOnce({id:'saved'});await createApiService({request}).savePrompt({name:'另存',content:'正文',tool:'contract',config:{rules:[{id:'r'}]}});expect(request.mock.calls[1][1].body.config).toEqual({rules:[{id:'r'}]})})
})

import {createDemoService} from '../src/services/demo'
import {tools} from '../src/domain/tools'
describe('explicit isolated demo provider',()=>{
 it('provides inspectable fictional results for all eleven tools',async()=>{const demo=createDemoService();const tasks=await demo.listTasks({page:1,size:30});expect(tasks.total).toBe(16);for(const tool of tools){const task=tasks.items.find(t=>t.tool===tool.id)!;expect(task.name).toContain('虚构');expect(task.results).toBeDefined();expect(task.hasResults).toBe(true)}expect((await demo.listTemplates()).length).toBeGreaterThan(0);expect((await demo.listPrompts()).length).toBeGreaterThan(0)})
 it('does not share mutations across providers',async()=>{const a=createDemoService(),b=createDemoService();await a.deleteFiles(['demo-file-1']);expect(await a.getMaterials(['demo-file-1'])).toEqual([]);expect(await b.getMaterials(['demo-file-1'])).toHaveLength(1)})
 it('never falls back to demo when an API request fails',async()=>{const api=createApiService({request:vi.fn().mockRejectedValue(new Error('backend down'))});await expect(api.listFolders('PUBLIC')).rejects.toThrow('backend down')})
})

import {demoDraft} from '../src/services/fixtures'
import {validateDraft} from '../src/domain/validation'
it('keeps all demo history snapshots editable and valid for reanalysis',()=>{for(const t of tools)expect(validateDraft(demoDraft(t.id)),t.id).toEqual([])})
it('rejects a static HTML fallback for exports as well',async()=>{const get=createHttp('',vi.fn().mockResolvedValue(new Response('<html/>',{headers:{'content-type':'text/html'}})));await expect(get('/export',{blob:true})).rejects.toBeInstanceOf(ServiceError)})
it('offers a writable personal demo template folder',async()=>{expect((await createDemoService().listTemplateFolders()).some(f=>f.scope==='personal')).toBe(true)})
it('keeps demo prepaid continuation in yuan from input through calculation',async()=>{const service=createDemoService(),task=await service.getTask('demo-task-prepaid');const updated=await service.continueTask(task,'prepaid-continue',{billing_base_wan:10000});expect(updated.results?.calculations[0]).toMatchObject({base:10000,calculatedAmount:100,unit:'元'})})
it('creates upload subfolders in the chosen space instead of the first cached file space',async()=>{
 const request=vi.fn(async(path:string,args?:any):Promise<any>=>{
  if(path.endsWith('/folders/tree'))return[{id:'personal-folder',name:'个人目录',space_type:'PERSONAL'}]
  if(path.endsWith('/files/by-space'))return{files:[{id:'public-file',name:'公共.pdf',folder_id:'public-folder'}],total:1}
  if(path.endsWith('/children'))return[]
  if(path.endsWith('/folders'))return{id:'child',name:args.body.folder_name,space_type:args.body.space_type}
  return{id:'uploaded'}
 })
 const api=createApiService({request})
 await api.listFiles({space:'PUBLIC',page:1,size:20,includeDescendants:false,keyword:''})
 await api.listFolders('PERSONAL')
 await api.upload(new File(['a'],'测试.pdf'),'personal-folder','新目录/测试.pdf')
 expect(request.mock.calls.find(([path])=>path.endsWith('/folders'))?.[1]?.body.space_type).toBe('PERSONAL')
})
it('distinguishes completed from partial results when filtering task history',async()=>{
 const request=vi.fn().mockResolvedValue({items:[{id:'a',status:2,success_count:3,failed_count:1},{id:'b',status:2,success_count:4,failed_count:0}],total:2})
 const result=await createApiService({request}).listTasks({page:1,size:15,status:'partial'})
 expect(result.total).toBe(1);expect(result.items[0].id).toBe('a')
})
it('keeps automatic contract recognition separate from selected rule execution',()=>{
 const d=draft('contract');d.config={contractCategory:'auto',autoAnalysis:true,rules:[{title:'not submitted'}]}
 expect(buildSubmitPayload(d).files[0].custom_config.parameter_settings).toEqual({button:1})
 d.config.contractCategory='construction';d.config.autoAnalysis=false
 expect(buildSubmitPayload(d).files[0].custom_config.parameter_settings.button).toBe(0)
 expect(buildSubmitPayload(d).files[0].custom_config.parameter_settings.information_extraction).toEqual([{title:'not submitted'}])
})
it('preserves arbitrary engineering fields and independent mode mappings',()=>{
 const d=draft('engineering');d.config={duplicateEnabled:true,parentChildEnabled:true,engineeringMappings:{f1:{duplicate:[{key:'F1',column:'工程名称',compare_type:'similarity',threshold:0.8,weight:0.5,rule:'名称评分'},{key:'F7',column:'自定义内容',compare_type:'similarity',threshold:0.7,weight:0.5,rule:'内容评分'}],parentChild:[{key:'F2',column:'主项目编号',compare_type:'exact',threshold:0,weight:1,rule:'核对编号'}]}}}
 const c=buildSubmitPayload(d).files[0].custom_config
 expect(c.duplicate_detection.field_mapping.F7.excel_column).toBe('自定义内容')
 expect(c.parent_child_analysis.field_mapping.F2.excel_column).toBe('主项目编号')
 expect(c.duplicate_detection.llm_config.field_weights.F7).toBe(0.5)
})
it('drops rules referencing removed engineering fields only in the affected ledger',()=>{
 const d=draft('engineering');d.files.push({...d.files[0],id:'f2'})
 const row=(key:string)=>({key,column:key,compare_type:'similarity',weight:1,rule:'比较名称'})
 d.config={duplicateEnabled:true,parentChildEnabled:false,engineeringMappings:{f1:{duplicate:[row('F1')]},f2:{duplicate:[row('F2')]}},duplicate_detection:{llm_config:{hard_rules:[{field:'F2',condition:'match'}],veto_rules:[{logic:'and',rules:[{field:'F1'},{field:'F2'}]}],phase_check_field:'F2'}}}
 const p=buildSubmitPayload(d)
 expect(p.files[0].custom_config.duplicate_detection.llm_config.hard_rules).toEqual([])
 expect(p.files[0].custom_config.duplicate_detection.llm_config.veto_rules).toEqual([])
 expect(p.files[1].custom_config.duplicate_detection.llm_config.hard_rules).toHaveLength(1)
 expect(d.config.duplicate_detection.llm_config.hard_rules).toHaveLength(1)
})
