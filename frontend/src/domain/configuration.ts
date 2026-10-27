import type {JsonObject,ToolDraft} from './types'
import {cloneDraft} from './validation'
import {rulesFromConfig} from './rules'
import {applyCompareConfigMigration} from '@/services/legacy/AssociationTwoTables/compareConfigHelpers'

export function loadAssociationConfig(c:JsonObject, source:JsonObject) {
 const config=applyCompareConfigMigration(source.compare_config||source)
 c.compare_config=cloneDraft(config)
 const llm=config.llm_config||{}
 c.mappingRows=Object.entries(config.field_comparison_mapping||{}).map(([key,raw])=>{
  const entry=raw as JsonObject
  return {id:key,key,left:entry.table1_field,right:entry.table2_field,compare_type:entry.compare_type||'similarity',threshold:entry.threshold??0.8,weight:llm.field_weights?.[key]??0,rule:llm.field_prompt_rules?.[key]||''}
 })
 c.hardRules=cloneDraft(llm.hard_rules||[])
 c.fullMatchThreshold=llm.full_match_threshold??4.5
 c.partialMatchThreshold=llm.partial_match_threshold??3.5
 c.candidateLimit=config.max_llm_pairs_per_table1_row??5
 c.maxTotalPairs=config.max_total_llm_pairs??10000
 c.matchLock=config.match_lock_policy?.lock_on_full_match!==false
}
export function restoreRuleCatalogs(draft:ToolDraft) {
 const c=draft.config
 c.ruleCatalogs ||= {}
 for(const [stage,config] of Object.entries(c.promptConfigs||{})){
  if(!c.ruleCatalogs[stage]?.length)c.ruleCatalogs[stage]=rulesFromConfig(config as JsonObject,draft.tool,stage)
 }
}
export function selectedRuleCatalog(draft:ToolDraft, stage='main') {
 const c=draft.config, catalog=c.ruleCatalogs?.[stage]
 if(catalog?.length)return catalog
 if(draft.tool==='bidding')return c.modeRules?.[stage]||[]
 return draft.tool==='risk'?c.riskPoints||[]:c.rules||[]
}
export function ruleUsesField(rule:JsonObject,key:string):boolean {
 return rule.field===key||(Array.isArray(rule.rules)&&rule.rules.some((r:JsonObject)=>ruleUsesField(r,key)))
}
