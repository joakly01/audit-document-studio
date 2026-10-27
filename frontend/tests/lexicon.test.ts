import {describe,it,expect,vi} from 'vitest'
import {addSelectedWords,mergeLexicon,uniqueWords,type LexiconEntry} from '../src/domain/lexicon'
import {createApiService} from '../src/services/api'
import {createDemoService} from '../src/services/demo'
describe('user lexicon and task word lists',()=>{
 it('deduplicates pasted words and preserves the existing type unless explicitly changed',()=>{
  const old:LexiconEntry[]=[{word:'专项资金',kind:'user'}]
  expect(uniqueWords('专项资金，项目\n项目；')).toEqual(['专项资金','项目'])
  expect(mergeLexicon(old,['专项资金','项目'],'stop')).toEqual([{word:'专项资金',kind:'user'},{word:'项目',kind:'stop',source:'manual'}])
  expect(mergeLexicon(old,['专项资金'],'stop',true)[0].kind).toBe('stop')
  expect(old[0].kind).toBe('user')
 })
 it('keeps manually entered task words while adding saved words without cross-type duplicates',()=>{
  expect(addSelectedWords(['自定义停用词','专项资金'],['原有新词'],[{word:'专项资金',kind:'user'}])).toEqual({stopWords:['自定义停用词'],newWords:['原有新词','专项资金']})
 })
 it('loads all pages before allowing full-list replacement',async()=>{
  const request=vi.fn().mockResolvedValueOnce({total:2,items:[{word:'项目',kind:'user'}]}).mockResolvedValueOnce({total:2,items:[{word:'以及',kind:'stop'}]})
  expect(await createApiService({request}).loadLexicon()).toHaveLength(2)
  expect(request.mock.calls[1][1].params.page).toBe(2)
 })
 it('rejects incomplete lists rather than saving a partial library',async()=>{
  const request=vi.fn().mockResolvedValue({items:[{word:'词',kind:'user'}]})
  await expect(createApiService({request}).loadLexicon()).rejects.toThrow('总数')
 })
 it('refuses to replace a library changed after the editor opened',async()=>{
  const request=vi.fn().mockResolvedValue({total:1,items:[{word:'别处新增',kind:'user'}]})
  await expect(createApiService({request}).saveLexicon([],[])).rejects.toThrow('其他页面')
  expect(request).toHaveBeenCalledTimes(1)
 })
 it('persists demo library edits without altering earlier task snapshots',async()=>{
  const service=createDemoService(),before=await service.getTask('demo-task-word'),old=await service.loadLexicon()
  await service.saveLexicon([...old,{word:'新增审计词',kind:'user'}],old)
  expect((await service.loadLexicon()).some(r=>r.word==='新增审计词')).toBe(true)
  expect((await service.getTask('demo-task-word')).draft).toEqual(before.draft)
 })
})
