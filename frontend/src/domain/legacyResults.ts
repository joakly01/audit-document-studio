import type {JsonObject,ToolId} from './types'
import {parseContractDisposalResult,parseContractText2Rows,mergeContractResultsWithRules,getInformationExtractionFromSettings} from '@/services/legacy/contractDisposalParser'

const array=(value:any):JsonObject[]=>Array.isArray(value)?value:[]
const parse=(value:any):any=>{for(let i=0;i<3&&typeof value==='string';i++){try{value=JSON.parse(value)}catch{break}}return value}
const source=(row:JsonObject)=>({fileId:row.file_uuid||row.file_id||row.FILE_UUID||row.FILE_ID,fileName:row.file_name||row.FILE_NAME})
function outputText(value:any):string{const v=parse(value);if(typeof v==='string')return v;const text=v?.data?.outputs?.text??v?.outputs?.text??v?.text;return typeof text==='string'?text:JSON.stringify(v??'')}
/** Known source response shapes only. No inferred scores, dates or currency conversions. */
export function legacyResult(tool:ToolId|null,data:JsonObject,record:JsonObject):JsonObject|undefined {
 if(!data||typeof data!=='object'||Array.isArray(data))return
 const origin=source(record),settings=parse(record.parameter_settings||record.PARAMETER_SETTINGS)||{}
 if(tool==='extract'&&Array.isArray(data.final_result?.items)){
  const items=data.final_result.items as JsonObject[]
  return {fields:items.map(i=>i.name||i.fieldName).filter(Boolean),rows:[{...origin,values:Object.fromEntries(items.filter(i=>i.name||i.fieldName).map(i=>[i.name||i.fieldName,i.extracted??i.value??''])),fieldDetails:items,evidence:items.flatMap(i=>array(i.evidence_list).map(e=>({...e,fileId:e.fileId||e.file_id||origin.fileId,fileName:e.fileName||e.file_name||origin.fileName})))}]}
 }
 if(tool==='theme'&&(data.joint_table||data.topic_summary!=null))return{
  ...(data.joint_table?{fields:array(data.joint_table.columns).length?data.joint_table.columns:[],extractions:array(data.joint_table.rows).map(r=>({...r,fileName:r.fileName||r.file_name,values:r.values||{}}))}:{}),
  ...(data.topic_summary!=null?{summary:outputText(data.topic_summary)}:{})
 }
 if(tool==='risk'&&(Array.isArray(data.items)||Array.isArray(data.data?.items)))return{findings:array(data.items||data.data.items).map(r=>({...r,fileId:r.file_id||origin.fileId,fileName:r.file_name||origin.fileName,riskPoint:r.risk_path||r.risk_point,description:r.description,level:r.level,evidence:typeof r.evidence==='string'?[{fileId:r.file_id||origin.fileId,fileName:r.file_name||origin.fileName,quote:r.evidence}]:r.evidence}))}
 if(tool==='contract'){
  const parsed=parseContractDisposalResult(data),auto=parseContractText2Rows(data,settings)
  if(parsed||auto.rows.length||auto.fallbackText)return{findings:[...(parsed?mergeContractResultsWithRules(parsed.parsedArray,getInformationExtractionFromSettings(settings),parsed.ruleTemplates):[]),...auto.rows].map(r=>({...origin,...r})),...(auto.fallbackText?{automaticAnalysis:auto.fallbackText}:{})}
 }
 if(tool==='prepaid'&&(data.text_1!=null||data.billing_agreement_text!=null))return{agreements:[{...origin,content:outputText(data.text_1??data.billing_agreement_text)}],...(data.text_2!=null?{calculations:[{...origin,content:outputText(data.text_2)}]}:{})}
 if(tool==='engineering'&&(data.duplicate_detection||data.parent_child_analysis)){
  const out:JsonObject={}
  for(const [key,block,list]of [['duplicates',data.duplicate_detection,'duplicates'],['parentChildren',data.parent_child_analysis,'results']] as const){if(!block)continue;if(block.status==='failed'){(out.errors||=[]).push(block.error||'此部分分析失败');continue}if(Array.isArray(block[list]))out[key]=block[list].map((r:JsonObject)=>({...origin,...r}))}
  return out
 }
 if(tool==='association'){
  const compared=data.compare_response||data
  if(!Array.isArray(compared.comparison_results)&&!Array.isArray(compared.table1_unique_items)&&!Array.isArray(compared.table2_unique_items))return
  const out:JsonObject={}
  if(Array.isArray(compared.comparison_results))out.matches=compared.comparison_results.map((r:JsonObject)=>({...r,tableA:r.table1_item,tableB:r.table2_item,result:r.match_type,reason:r.reason}))
  if(Array.isArray(compared.table1_unique_items))out.unmatchedA=compared.table1_unique_items
  if(Array.isArray(compared.table2_unique_items))out.unmatchedB=compared.table2_unique_items
  if(Array.isArray(compared.differences))out.differences=compared.differences
  return out
 }
}
export function wordCloudResult(data:JsonObject):JsonObject {
 const merged=new Map<string,JsonObject>()
 for(const file of array(data.files)){if(file.found===false||file.analyze_skipped)continue
  for(const [word,count] of Object.entries(file.word_counts||{})){const n=Number(count);if(!Number.isFinite(n))continue;const entry=merged.get(word)||{word,count:0,evidence:[]};entry.count+=n;if(file.file_id)entry.evidence.push({fileId:String(file.file_id),fileName:file.file_name});merged.set(word,entry)}
 }
 return{words:[...merged.values()].sort((a,b)=>b.count-a.count),files:data.files,raw:data}
}
