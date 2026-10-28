import {afterEach,describe,it,expect,vi} from 'vitest'
import {createId} from '../src/domain/ids'
afterEach(()=>vi.unstubAllGlobals())
describe('draft IDs on HTTPS and IP/HTTP',()=>{
 it('uses the native UUID provider when available',()=>{
  const randomUUID=vi.fn(()=> 'a191617e-2c3b-407a-9487-15ba4beee3fe'),getRandomValues=vi.fn()
  vi.stubGlobal('crypto',{randomUUID,getRandomValues})
  expect(createId()).toBe('a191617e-2c3b-407a-9487-15ba4beee3fe');expect(randomUUID).toHaveBeenCalledOnce();expect(getRandomValues).not.toHaveBeenCalled()
 })
 it('creates a valid version-4 UUID from browser randomness when HTTP hides randomUUID',()=>{
  vi.stubGlobal('crypto',{getRandomValues:(bytes:Uint8Array)=>{bytes.forEach((_,index)=>bytes[index]=index);return bytes}})
  expect(createId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
 })
 it('reports an unsupported browser instead of using predictable fallback IDs',()=>{
  vi.stubGlobal('crypto',undefined);expect(createId).toThrow('当前浏览器不支持')
 })
})
