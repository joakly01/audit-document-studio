import {describe,it,expect} from 'vitest'
import {newPersonalPrompt,validPromptStage,matchesExpense,promptExpenseType} from '../src/domain/prompts'
import {tools} from '../src/domain/tools'
describe('personal prompt applicability',()=>{
 it('starts with a valid stage for every supported tool',()=>{
  for(const t of tools.filter(t=>t.promptStages.length))expect(validPromptStage(newPersonalPrompt(t.id))).toBe(true)
 })
 it('rejects another tool stage',()=>expect(validPromptStage({...newPersonalPrompt('risk'),stage:'extract'})).toBe(false))
 it('filters different fee types and retains generic personal prompts',()=>{
  const p={...newPersonalPrompt('prepaid'),config:{expense_type:'design'}}
  expect(matchesExpense(p,'supervision_engineering')).toBe(false)
  expect(matchesExpense(p,'design')).toBe(true)
  expect(matchesExpense(newPersonalPrompt('prepaid'),'design')).toBe(true)
  expect(promptExpenseType({...p,config:undefined,name:'工程监理费提取'})).toBe('supervision_engineering')
 })
})
