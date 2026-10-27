import {describe,it,expect} from 'vitest'
import {sourcePreviewUrl} from '../src/domain/sourcePreview'
describe('原文预览地址',()=>{
 const base='https://audit.example/app/'
 it('允许相对地址和带签名的HTTPS地址，保持签名',()=>{
  expect(sourcePreviewUrl('/files/1?signature=abc',base)).toBe('https://audit.example/files/1?signature=abc')
  expect(sourcePreviewUrl('https://storage.example/a.pdf?token=abc',base)).toBe('https://storage.example/a.pdf?token=abc')
 })
 it('拒绝脚本、内联HTML、带账户密码的URL和无下载权限文件',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,test','https://user:password@audit.example/a','file:///tmp/private'])expect(sourcePreviewUrl(value,base)).toBe('')
  expect(sourcePreviewUrl('/files/1',base,false)).toBe('')
 })
})
