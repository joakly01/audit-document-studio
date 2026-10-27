import {describe,it,expect} from 'vitest'
import {loadAssociationConfig,selectedRuleCatalog,restoreRuleCatalogs,ruleUsesField} from '../src/domain/configuration'
import {createDraft} from '../src/domain/tools'
import {buildSubmitPayload} from '../src/domain/payloads'
describe('configuration keeps business rules',()=>{
 it('hydrates mapping, limits and hard rules without replacing saved settings with UI defaults',()=>{
  const d=createDraft('association'),c=d.config
  const rule={field:'F4',condition:'mismatch',result:'miss',priority:1}
  loadAssociationConfig(c,{field_comparison_mapping:{F4:{table1_field:'名称',table2_field:'项目',compare_type:'exact',threshold:0}},llm_config:{field_weights:{F4:1},field_prompt_rules:{F4:'核对名称'},hard_rules:[rule],full_match_threshold:4.8,partial_match_threshold:3.2},max_total_llm_pairs:77,max_llm_pairs_per_table1_row:3,match_lock_policy:{lock_on_full_match:false}})
  const payload=buildSubmitPayload(d).task_schedule_results[0].parameter_settings.config
  expect(payload.max_total_llm_pairs).toBe(77)
  expect(payload.match_lock_policy.lock_on_full_match).toBe(false)
  expect(payload.field_comparison_mapping.F4.table1_field).toBe('名称')
  expect(payload.llm_config.hard_rules).toEqual([rule])
  expect(c.mappingRows[0].rule).toBe('核对名称')
 })
 it('shows saved rules even without a fetched catalog',()=>{
  const b=createDraft('bidding');b.config.modeRules={joint:[{id:'r',label:'联合检查'}]}
  expect(selectedRuleCatalog(b,'joint')).toHaveLength(1)
  const c=createDraft('contract');c.config.rules=[{id:'c',label:'合同规则'}];c.config.riskPoints=[]
  expect(selectedRuleCatalog(c)).toHaveLength(1)
  restoreRuleCatalogs(c);expect(c.config.rules).toHaveLength(1)
 })
 it('finds nested references before removing a mapping',()=>expect(ruleUsesField({logic:'and',rules:[{field:'F3'}]},'F3')).toBe(true))
})
