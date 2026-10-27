import {describe,it,expect,vi} from 'vitest'
import {normalizeTask} from '../src/domain/normalizers'
import {createApiService} from '../src/services/api'
const task=(tool:string,data:unknown)=>normalizeTask({task_uuid:'t',tool_name:tool,processing_status:2,task_schedule_result_list:[{file_uuid:'f',file_name:'原件.pdf',DISPOSAL_RESULT:JSON.stringify(data)}]})
describe('result shapes read from the original frontend',()=>{
 it('reads the original task schedule list and final_result.items without losing zero values',()=>{
  const result=task('信息提取',{final_result:{items:[{name:'金额',extracted:0,is_found:true,evidence_list:[{text:'金额为零'}]},{name:'备注',extracted:'',is_found:false}]}})
  expect(result.hasResults).toBe(true);expect(result.results?.rows[0].values).toEqual({金额:0,备注:''})
  expect(result.results?.rows[0].evidence[0].fileId).toBe('f');expect(result.results?.rows[0].evidence[0].page).toBeUndefined()
  expect(result.results?.rows[0].fieldDetails[1].is_found).toBe(false)
 })
 it('keeps joint extraction and topic summary as separate results',()=>{
  const result=task('主题归纳',{joint_table:{columns:['项目'],rows:[{fileName:'甲',values:{项目:'工程'}}]},topic_summary:{data:{outputs:{text:'共同主题'}}}})
  expect(result.results?.summary).toBe('共同主题');expect(result.results?.extractions[0].values.项目).toBe('工程')
 })
 it('maps risk result items and preserves actual source ID and evidence text',()=>{
  const result=task('风险点分析',{items:[{file_id:'actual',risk_path:'支付/审批',level:'待核查',evidence:'原始段落'}]})
  expect(result.results?.findings[0]).toMatchObject({fileId:'actual',riskPoint:'支付/审批',evidence:[{fileId:'actual',quote:'原始段落'}]})
 })
 it('retains rule and automatic contract outputs instead of mapping absent conclusions to compliant',()=>{
  const result=task('合同分析',{data:{outputs:{text:'```json\n[{"title":"金额","extracted_value":100,"result":"无法判定"}]\n```',text_2:[{title:'审批',description:'需要补证'}]}}})
  expect(result.results?.findings).toHaveLength(2);expect(result.results?.findings[0].result).toBe('无法判定');expect(result.results?.findings[1].result).toBe('')
 })
 it('retains explicit empty ledger results, stage failures and both unmatched sets',()=>{
  const engineer=task('工程项目一致性',{duplicate_detection:{status:'failed',error:'缺少列'},parent_child_analysis:{status:'success',results:[]}})
  expect(engineer.results?.errors).toEqual(['缺少列']);expect(engineer.results?.parentChildren).toEqual([])
  const compare=task('两表项目关联度',{compare_response:{comparison_results:[{table1_item:{金额:1},table2_item:{金额:2},match_type:'部分一致'}],table1_unique_items:[{名称:'甲'}],table2_unique_items:[{名称:'乙'}]}})
  expect(compare.results?.matches[0].result).toBe('部分一致');expect(compare.results?.unmatchedB[0].名称).toBe('乙');expect(compare.results?.differences).toBeUndefined()
 })
 it('loads original word result endpoint and aggregates valid file word counts',async()=>{
  const request=vi.fn().mockResolvedValueOnce({task_uuid:'w',tool_name:'词云分析',processing_status:2}).mockResolvedValueOnce({files:[{file_id:'f1',file_name:'甲',found:true,word_counts:{审计:2}},{file_id:'f2',found:true,word_counts:{审计:3}},{file_id:'f3',analyze_skipped:true,word_counts:{审计:99}}]})
  const result=await createApiService({request}).getTask('w')
  expect(result.results?.words[0].count).toBe(5);expect(result.results?.words[0].evidence).toHaveLength(2)
  expect(request.mock.calls[1][0]).toBe('/api/v1/word-cloud/tasks/w/result')
 })
 it('normalizes response aliases to the keys consumed by result pages, including empty results',()=>{
  expect(task('词云分析',{word_frequencies:[{word:'审计',count:2}]}).results?.words).toEqual([{word:'审计',count:2}])
  expect(task('时间轴分析',{timeline:[]}).results?.events).toEqual([])
  expect(task('风险点分析',{risk_points:[{description:'待核查'}]}).results?.findings).toEqual([{description:'待核查'}])
  expect(task('工程项目一致性',{duplicate_results:[],parent_child_results:[]}).results).toMatchObject({duplicates:[],parentChildren:[]})
 })
 it('preserves both legacy and canonical schedule results in a mixed historical task',()=>{
  const result=normalizeTask({tool_name:'信息提取',task_schedule_result_list:[
   {file_uuid:'a',disposal_result:{final_result:{items:[{name:'金额',extracted:0}]}}},
   {file_uuid:'b',disposal_result:{extracted_fields:{项目:'乙'}}},
   {file_uuid:'c',disposal_result:{rows:[{fileId:'c',values:{项目:'丙'}}],fields:['项目']}}
  ]})
  expect(result.results?.rows).toHaveLength(3);expect(result.results?.fields).toEqual(['金额','项目'])
  expect(result.results?.unmapped).toBeUndefined()
 })
 it('keeps unrecognized extraction responses as raw results instead of inventing extracted fields',()=>{
  const result=task('信息提取',{status:'success',message:'返回格式待确认'})
  expect(result.results?.rows).toBeUndefined();expect(result.results?.unmapped).toEqual([{status:'success',message:'返回格式待确认'}])
  expect(task('信息提取',null).results?.unmapped).toEqual([null])
 })
})
