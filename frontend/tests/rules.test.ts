import {describe,it,expect} from 'vitest'
import {flattenRules,rulesFromConfig} from '../src/domain/rules'
describe('business rule catalogs',()=>{
 it('flattens nested categories without dropping identifiers or content',()=>{const out=flattenRules([{name:'项目管理',children:[{id:'r7',name:'资金用途',description:'核对用途与约定'}]}]);expect(out).toEqual([{id:'r7',label:'资金用途',description:'核对用途与约定',path:'项目管理',raw:{id:'r7',name:'资金用途',description:'核对用途与约定'}}])})
 it('keeps bidding modes separate',()=>{const c={biddingRules:[{id:'b',name:'招标'}],tenderRules:[{id:'t',name:'投标'}],jointRules:[{id:'j',name:'联合'}]};expect(rulesFromConfig(c,'bidding','joint').map(x=>x.id)).toEqual(['j']);expect(rulesFromConfig(c,'bidding','bidding_only').map(x=>x.id)).toEqual(['b'])})
 it('does not manufacture rules for missing configurations',()=>{expect(rulesFromConfig({},'risk','main')).toEqual([])})
})
