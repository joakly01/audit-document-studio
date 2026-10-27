import type {ToolDraft,JsonObject,ToolId,Material} from './types'
import {prepareSingleTableConfig} from '@/services/legacy/engineeringProject/engineeringSingleTableConfigHelpers'
import {buildCompareConfigForApi} from '@/services/legacy/AssociationTwoTables/compareConfigHelpers'
export const functionTypes:Partial<Record<ToolId,Record<string,string>>>={theme:{extract:'Information_Extraction',summary:'Topic_Summarization'},timeline:{main:'timeline_analysis'},meeting:{main:'meeting_minutes',risk:'meeting_minutes_risk'},risk:{main:'risk-point-analysis'},bidding:{bidding_only:'Bidding_Analysis',tender_only:'Bidding_Analysis',joint:'Bidding_Analysis'},contract:{main:'compliance_analysis_prompt',extract:'information_extraction_prompt'},prepaid:{extract:'billing_agreement_prompt',calculate:'cost_calculation_prompt'},engineering:{duplicate:'engineering_repeat_project',parentChild:'engineering_sub_project'},association:{main:'Two_Table_Compare'}}
const meta:Record<ToolId,{biz:string;uuid:string;type:number;name:string}>={extract:{biz:'fileToPdf',uuid:'fileToPdf',type:1,name:'信息提取'},word:{biz:'wordCloud',uuid:'wordCloud',type:4,name:'词云分析'},theme:{biz:'agent_info_extraction_and_topic_summary',uuid:'theme-analysis-combined',type:5,name:'主题归纳'},timeline:{biz:'timeline_analysis',uuid:'timeline-analysis',type:7,name:'时间轴分析'},meeting:{biz:'meeting_minutes',uuid:'meeting-minutes-analysis',type:3,name:'会议纪要分析'},risk:{biz:'riskPointAnalysis',uuid:'risk-point-analysis',type:8,name:'风险点分析'},bidding:{biz:'bidding_analysis',uuid:'bidding-analysis',type:10,name:'招投标分析'},contract:{biz:'contractCompleteness',uuid:'contract-completeness',type:2,name:'合同分析'},prepaid:{biz:'prepaidExpenses',uuid:'prepaid-expenses',type:10,name:'待摊费用'},engineering:{biz:'engineering_project_data_consistency',uuid:'engineering-project-tool-uuid',type:6,name:'工程项目一致性'},association:{biz:'association_degree_two_tables',uuid:'association-degree-two-tables-tool-uuid',type:9,name:'两表项目关联度'}}
export const toolMeta=meta
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v))
const prompt=(d:ToolDraft,k='main')=>d.prompts[k]?.content||''
const pid=(d:ToolDraft,k='main')=>d.prompts[k]?.id||null
export function stripRuleForSubmit(rule:JsonObject):JsonObject{const r={...(rule.raw||rule)};for(const k of ['extracted_value_completeness','extracted_value_compliance','data_format','selected','expanded','_key'])delete r[k];return r}
function mappings(config:JsonObject,side?:'table1'|'table2'):JsonObject{if(!Array.isArray(config.fieldMappings))return config.fieldMappings||{};return Object.fromEntries(config.fieldMappings.map((m:JsonObject,i:number)=>[`F${i+1}`,side?{table1_field:m.table1_field||m.table1||m.left,table2_field:m.table2_field||m.table2||m.right,compare_type:m.compare_type||m.type||'similarity',threshold:m.threshold??0.8}:{column:m.column||m.field||m.name,compare_type:m.compare_type||m.type||'similarity',threshold:m.threshold??0.8}]))}
const roleKeys=['name','investment','location','content','unit']
function engineeringConfig(d:ToolDraft,mode:'duplicate'|'parent_child',file?:Material):JsonObject {
 const c=d.config,key=mode==='duplicate'?'duplicate_detection':'parent_child_analysis',current=clone(c[key]||{})
 const dynamic=c.engineeringMappings?.[file?.id||'']?.[mode==='duplicate'?'duplicate':'parentChild'] as JsonObject[]|undefined
 const selected=c.fieldMappings?.[file?.id||'']
 const roles=selected?roleKeys.filter(role=>selected[role]):[]
 if(dynamic)current.field_mapping=Object.fromEntries(dynamic.map(row=>[row.key,{excel_column:row.column,compare_type:row.compare_type,threshold:row.threshold}]))
 else if(selected)current.field_mapping=Object.fromEntries(roles.map((role,i)=>[`F${i+1}`,{excel_column:selected[role],compare_type:role==='investment'?(mode==='parent_child'?'investment_gt':'investment_diff'):'similarity',threshold:role==='investment'?0.04:0.8}]))
 else current.field_mapping ||= mappings(c)
 current.threshold=(mode==='duplicate'?c.duplicateThreshold:c.parentChildThreshold)??current.threshold
 const llm=current.llm_config||{}
 const weights=dynamic?Object.fromEntries(dynamic.map(row=>[row.key,row.weight])):roles.length?Object.fromEntries(roles.map((role,i)=>[`F${i+1}`,c.weights?.[role]??llm.field_weights?.[`F${i+1}`]??1/roles.length])):llm.field_weights||c.weights||{}
 const rules=dynamic?Object.fromEntries(dynamic.map(row=>[row.key,row.rule])):roles.length?Object.fromEntries(roles.map((role,i)=>[`F${i+1}`,c.fieldRules?.[role]??llm.field_prompt_rules?.[`F${i+1}`]??''])):llm.field_prompt_rules||c.fieldRules||{}
 current.llm_config={...llm,field_weights:weights,field_prompt_rules:rules,hard_rules:llm.hard_rules||c.hardRules||[],veto_rules:llm.veto_rules||c.vetoRules||[],additional_prompt:prompt(d,mode==='duplicate'?'duplicate':'parentChild')}
 // Removing a field must also remove complete rules that depend on it, per file.
 const validFields=new Set(Object.keys(current.field_mapping))
 const missingField=(rule:JsonObject):boolean=>(/^F\d+$/i.test(String(rule.field||''))&&!validFields.has(rule.field))||(Array.isArray(rule.rules)&&rule.rules.some(missingField))
 for(const list of ['hard_rules','veto_rules'])current.llm_config[list]=current.llm_config[list].filter((rule:JsonObject)=>!missingField(rule))
 if(current.llm_config.phase_check_field&&!validFields.has(current.llm_config.phase_check_field))current.llm_config.phase_check_field=[...validFields][0]||''
 current.prescreen_config={...current.prescreen_config,min_match_fields:c.minMatchFields??current.prescreen_config?.min_match_fields??2}
 const enabled=mode==='duplicate'?c.duplicateEnabled!==false:c.parentChildEnabled!==false
 const normalized=prepareSingleTableConfig(current,{mode,validate:enabled})
 return {...normalized,prompt:current.llm_config.additional_prompt,enabled}
}
export function buildExecutionConfig(d:ToolDraft,file?:Material):JsonObject {
 const c=d.config; const extras={merge_attachments:c.mergeAttachments===true,chunk_size:Number(c.chunkSize??12000),overlap:Number(c.overlap??200)}
 switch(d.tool){
 case'extract':return{exec_mode:'custom',custom_config:{mode:'field',fields:(c.fields||[]).map((f:JsonObject)=>({name:f.name.trim(),description:f.description||''})),...extras}}
 case'word':return{exec_mode:'custom',custom_config:{stop_words:[...(c.stopWords||[])],user_dict_words:[...(c.newWords||[])]}}
 case'theme':return{exec_mode:'custom',custom_config:{prompt:prompt(d,'extract'),parameter_settings:{mode:'prompt',configured:true,theme_summarization_prompt:prompt(d,'summary')}}}
 case'risk':return{exec_mode:'custom',custom_config:{parameter_settings:{mode:c.riskMode==='by_risk'||c.riskMode==='byRisk'?'byRisk':'byFile',risk_points:(c.riskPoints||[]).map((r:JsonObject|string)=>typeof r==='string'?{id:r,path:r,label:r}:{id:r.id,path:r.path||r.label||r.name,label:r.label||r.name||r.path}),prompt:prompt(d),selected_prompt_id:pid(d),selected_prompt_name:d.prompts.main?.name||'',prompt_function_type:'risk-point-analysis'},parameter_template:'',prompt_uuid:'prompt'}}
 case'contract': {const category=c.contractCategory||'auto',button=c.autoAnalysis==null?Number(c.button||0):c.autoAnalysis?1:0;const settings:JsonObject={button};if(category!=='auto')Object.assign(settings,{information_extraction:(c.rules||[]).filter((r:JsonObject)=>r.selected!==false).map(stripRuleForSubmit),compliance_analysis_prompt:{key:pid(d),prompt:prompt(d)},information_extraction_prompt:{key:pid(d,'extract'),prompt:prompt(d,'extract')}});return{exec_mode:'custom',custom_config:{contract_category:category,button,parameter_template:'{"rules":[]}',prompt_uuid:'prompt',parameter_settings:settings}}}
 case'prepaid':return{exec_mode:'custom',custom_config:{parameter_settings:{exec_phase:'extract',expense_type:c.feeType||c.expenseType||c.feeTypes?.[0],expense_type_label:c.feeTypeLabel||'',billing_agreement_prompt_id:pid(d,'extract'),billing_agreement_prompt_content:prompt(d,'extract'),cost_calculation_prompt_id:pid(d,'calculate'),cost_calculation_prompt_content:prompt(d,'calculate'),billing_base_wan:null},parameter_template:'',prompt_uuid:'prompt'}}
 case'engineering': {const duplicate=engineeringConfig(d,'duplicate',file),parent=engineeringConfig(d,'parent_child',file);return{exec_mode:'custom',custom_config:{mode:'engineering_project',engineering_repeat_project:{prompt:prompt(d,'duplicate')},engineering_sub_project:{prompt:prompt(d,'parentChild')},threshold:duplicate.threshold,duplicate_threshold:duplicate.threshold,parent_child_threshold:parent.threshold,duplicate_detection:duplicate,parent_child_analysis:parent}}}
 default:return{exec_mode:'custom',custom_config:clone(c)}
 }
}
export function buildSubmitPayload(d:ToolDraft):JsonObject {
 const m=meta[d.tool],c=d.config
 if(d.tool==='bidding')return{analysis_modes:[...(c.analysisModes||[])],mode_configs:(c.analysisModes||[]).map((mode:string)=>({mode,template_id:c.modeConfigs?.[mode]?.templateId||pid(d,mode)||'',prompt_id:pid(d,mode),prompt_text:prompt(d,mode),prompt_customized:d.prompts[mode]?.customized===true,rule_ids:(c.modeConfigs?.[mode]?.ruleIds||c.modeRules?.[mode]?.map((r:JsonObject)=>r.id)||c.rules?.filter((r:JsonObject)=>!r.mode||r.mode===mode).map((r:JsonObject)=>r.id)||[])})),projects:(c.projects||[]).map((p:JsonObject,i:number)=>({sort_order:i+1,project_name:p.name||p.projectName||'',bidding_file:(p.biddingFile||p.biddingFiles?.[0])?{file_uuid:(p.biddingFile||p.biddingFiles[0]).id,file_name:(p.biddingFile||p.biddingFiles[0]).name}:null,tender_companies:(p.companies||p.tenderCompanies||[]).map((company:JsonObject,n:number)=>({sort_order:n+1,company_name:company.name,files:(company.files||[]).map((f:Material)=>({file_uuid:f.id,file_name:f.name}))}))}))}
 const base={task_name:d.name.trim(),task_notes:c.notes||'',task_switch:2,biz_type:m.biz,tool_uuid:m.uuid,tool_name:m.name,task_type:m.type}
 if(d.tool==='meeting'||d.tool==='timeline'){const data:JsonObject={task_name:d.name.trim(),task_notes:c.notes||'',execute_type:'background',prompt:prompt(d),prompt_id:pid(d),files:d.files.map(f=>({file_id:f.id})),folders:[],parse_status:['parsed'],file_extensions:[],deleted_files:[]};if(d.tool==='meeting')Object.assign(data,{risk_prompt:prompt(d,'risk'),risk_prompt_id:pid(d,'risk'),similarity_threshold:Number(c.similarityThreshold)/100,min_cluster_size:Number(c.minClusterSize)});else data.delete_files=[];return data}
 if(d.tool==='association'){
 const a=c.table1 as Material,b=c.table2 as Material;const config=clone(c.compare_config||{});const rows=c.mappingRows as JsonObject[]|undefined
 config.field_comparison_mapping=rows?Object.fromEntries(rows.map((row,i)=>[row.key||`F${i+1}`,{table1_field:row.left,table2_field:row.right,compare_type:row.compare_type||'similarity',threshold:row.threshold??0.8}])):config.field_comparison_mapping||mappings(c,'table1')
 config.llm_config={...config.llm_config,field_weights:rows?Object.fromEntries(rows.map((row,i)=>[row.key||`F${i+1}`,row.weight??1])):config.llm_config?.field_weights||c.weights||{},field_prompt_rules:rows?Object.fromEntries(rows.map((row,i)=>[row.key||`F${i+1}`,row.rule||''])):config.llm_config?.field_prompt_rules||{},hard_rules:c.hardRules??config.llm_config?.hard_rules??[],additional_prompt:prompt(d),full_match_threshold:c.fullMatchThreshold??config.llm_config?.full_match_threshold,partial_match_threshold:c.partialMatchThreshold??config.llm_config?.partial_match_threshold}
 config.max_llm_pairs_per_table1_row=c.candidateLimit??config.max_llm_pairs_per_table1_row
 config.max_total_llm_pairs=c.maxTotalPairs??config.max_total_llm_pairs
 config.match_lock_policy={...config.match_lock_policy,lock_on_full_match:c.matchLock!==false}

 return{...base,file_num:'2',task_schedule_results:[{file_uuid:a?.id,file_name:a?.name,file_type:a?.extension,file_size:String(a?.size||0),parameter_template:'{}',prompt_uuid:'prompt',parameter_settings:{table1:{file_uuid:a?.id,filename:a?.name},table2:{file_uuid:b?.id,filename:b?.name},table_labels:{table1:c.table1Label||'对照表 A',table2:c.table2Label||'对照表 B'},config:buildCompareConfigForApi(config),compare_prompt:{key:pid(d),prompt:prompt(d)}}}]}
 }
 const configs=d.files.map(file=>({file,exec:buildExecutionConfig(d,file)}))
 return{...base,files:configs.map(({file,exec})=>({file_id:file.id,...clone(exec)})),checked_tree:configs.map(({file,exec})=>({node_type:'file',name:file.name,checked:true,file_id:file.id,folder_path:file.path,exec_config:clone(exec),children:[]})),parse_status:['parsed'],file_extensions:[],deleted_files:[]}
}
