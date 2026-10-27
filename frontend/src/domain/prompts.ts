import type {Prompt, ToolId} from './types'
import {toolMap} from './tools'

export const feeOptions = [
 {value:'supervision_engineering',label:'工程监理费'},
 {value:'design',label:'工程设计费'},
 {value:'agency_management',label:'代建管理费'},
 {value:'cost_consulting',label:'造价咨询服务费'},
 {value:'survey_mapping',label:'勘察费、测绘费'},
 {value:'bidding_agency',label:'招标代理费'}
]
const expenseKeywords:Record<string,string[]> = {
 supervision_engineering:['监理'],design:['设计'],agency_management:['代建'],
 cost_consulting:['造价咨询'],survey_mapping:['勘察','测绘'],bidding_agency:['招标代理']
}
export function promptExpenseType(prompt:Prompt):string|undefined {
 if(prompt.config?.expense_type)return String(prompt.config.expense_type)
 return Object.entries(expenseKeywords).find(([,words])=>words.some(word=>prompt.name.includes(word)))?.[0]
}
export function matchesExpense(prompt:Prompt, expenseType?:string):boolean {
 if(!expenseType)return true
 const known=promptExpenseType(prompt)
 return !known || known===expenseType
}
export function newPersonalPrompt(tool:ToolId='theme'):Prompt {
 return {id:'',name:'',content:'',scope:'personal',tool,stage:toolMap[tool].promptStages[0]?.key||'main'}
}
export function validPromptStage(prompt:Prompt):boolean {
 if(prompt.tool==='bidding'&&prompt.stage==='shared')return true
 return !!prompt.tool&&toolMap[prompt.tool].promptStages.some(s=>s.key===prompt.stage)
}
