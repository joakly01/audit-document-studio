import type {JsonObject} from './types'
export interface Rule {id:string;label:string;description:string;path:string;raw?:JsonObject}
export function flattenRules(input:unknown,parent=''):Rule[]{
 if(!input)return[];let items:any[]=Array.isArray(input)?input:typeof input==='object'?Object.entries(input).map(([id,value])=>typeof value==='object'?{id,...value}:{id,label:id,description:String(value)}):[]
 return items.flatMap((v,i)=>{if(typeof v==='string')return[{id:v,label:v,description:'',path:parent}];const label=String(v.label||v.name||v.rule_name||v.title||v.id||`规则 ${i+1}`);const path=[parent,label].filter(Boolean).join(' / ');const children=v.children||v.items;return Array.isArray(children)&&children.length?flattenRules(children,path):[{id:String(v.id||v.rule_id||v.key||path),label,description:String(v.description||v.content||v.rule_description||v.prompt||''),path:parent,raw:v}]})
}
export function rulesFromConfig(c:JsonObject={},tool:string,stage:string):Rule[]{
 let source:any
 if(tool==='risk')source=c.risk_points_tree||c.riskPointsTree||c.risk_points||c.riskPoints||c.rules
 else if(tool==='bidding')source=stage==='bidding_only'?(c.biddingRules||c.bidding_rules):stage==='tender_only'?(c.tenderRules||c.tender_rules):(c.jointRules||c.joint_rules)
 else source=c.rules||c.check_rules||c.rule_list||c.compliance_rules
 return flattenRules(source)
}
