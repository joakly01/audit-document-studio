import {describe,it,expect} from 'vitest'
import {safeMeetingRegex,filterMeetingTopics,emptyMeetingFilters,meetingTopics,evidenceOf,numeric} from '../src/components/results/model'
describe('meeting result filters',()=>{
 it('rejects overlapping alternation, bounded and nested repetitions before execution',()=>{
  for(const pattern of ['(a|aa)+$','(a{1,9}){1,9}$','a+a+$','(a|a)(a|a)$','(?=a)','a{999999}','\\1']) expect(()=>safeMeetingRegex(pattern)).toThrow()
  expect(safeMeetingRegex('采购|资金[甲乙]$').test('采购')).toBe(true)
  expect(safeMeetingRegex('金额\\+').test('金额+')).toBe(true)
 })
 it('combines dates, participants, amount, cluster, keyword and preserves unknown amount',()=>{
  const topics=meetingTopics({meetings:[{id:'m',date:'2026/10/20',name:'办公会',participants:['王某'],topics:[{id:'a',title:'采购资金',amount:12,clusterId:'c'},{id:'b',title:'其他'}]}],clusters:[{id:'c',name:'采购'}]})
  const filter={...emptyMeetingFilters(),start:'2026-10-01',end:'2026-10-30',participants:'王某',min:'10',max:'20',cluster:'c',keyword:'资金'}
  expect(filterMeetingTopics(topics,filter).items.map(x=>x.key)).toEqual(['a'])
  expect(topics[1]?.amount).toBeUndefined()
  expect(filterMeetingTopics(topics,{...filter,min:'21'}).error).toContain('最小金额')
  expect(filterMeetingTopics(topics,{...filter,start:'2026-11-01'}).error).toContain('开始日期')
 })
 it('does not invent source pages or file IDs from names',()=>{
  expect(evidenceOf({fileName:'资料.pdf'})).toEqual([])
  expect(evidenceOf({evidence:[{file_id:'f',page:0}]})).toEqual([{fileId:'f',fileName:undefined,page:undefined,quote:undefined,sheet:undefined,row:undefined}])
  expect(numeric(null)).toBeUndefined()
 })
})
