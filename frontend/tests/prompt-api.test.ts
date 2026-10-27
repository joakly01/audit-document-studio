import {describe,it,expect,vi} from 'vitest'
import {flattenPromptTree} from '../src/domain/normalizers'
import {createApiService} from '../src/services/api'
describe('prompt source compatibility',()=>{
 it.each([['meeting_minutes','meeting','main'],['Information_Extraction','theme','extract'],['cost_calculation_prompt','prepaid','calculate'],['engineering_sub_project','engineering','parentChild'],['compliance_analysis_prompt','contract','main'],['Bidding_Analysis','bidding','shared']])('retains %s applicability',(function_type,tool,stage)=>{
  const [p]=flattenPromptTree([{id:'p',name:'示例',content:'正文',function_type,is_default:'0'}])
  expect(p).toMatchObject({tool,stage,isDefault:false})
 })
 it('keeps an unknown function unmapped and restores stage from a tool-specific tree',()=>{
  expect(flattenPromptTree([{id:'x',content:'x',function_type:'unknown'}])[0].tool).toBeUndefined()
  expect(flattenPromptTree([{id:'x',content:'x',function_type:'Bidding_Analysis'}],'bidding','joint')[0].stage).toBe('joint')
 })
 it('copies a public prompt into personal space without public category assignments',async()=>{
  const request=vi.fn().mockResolvedValueOnce([{id:'private',type:'personal'}]).mockResolvedValueOnce({id:'new'})
  await createApiService({request}).savePrompt({name:'复制',content:'正文',scope:'personal',tool:'risk',stage:'main',raw:{space_id:'public',category_ids:['system']}})
  expect(request.mock.calls[1][1].body).toMatchObject({space_id:'private',category_ids:[],function_type:'risk-point-analysis'})
 })
 it('loads every list page instead of silently truncating prompt library',async()=>{
  const request=vi.fn().mockResolvedValueOnce({items:[{id:'a',content:'a'}],total:2}).mockResolvedValueOnce({items:[{id:'b',content:'b'}],total:2})
  expect(await createApiService({request}).listPrompts()).toHaveLength(2)
  expect(request.mock.calls[1][1].body.page).toBe(2)
 })
})
