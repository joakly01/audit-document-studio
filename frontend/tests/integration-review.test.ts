import {describe,it,expect,vi} from 'vitest'
import {createApiService} from '../src/services/api'
import {createDemoService} from '../src/services/demo'
import {createHttp} from '../src/services/http'

describe('上传目录契约',()=>{
 it('新建个人目录可立即用于文件夹上传，并保留上传资料的空间',async()=>{
  const request=vi.fn(async(path:string,args?:any):Promise<any>=>{
   if(path.endsWith('/children'))return[]
   if(path.endsWith('/folders'))return{id:args.body.folder_name==='资料'?'root':'child',folder_name:args.body.folder_name}
   if(path.endsWith('/upload'))return{file_id:'saved',file_name:'合同.pdf'}
   throw Error('unexpected '+path)
  })
  const api=createApiService({request});await api.createFolder('资料',undefined,'PERSONAL')
  const saved=await api.upload(new File(['x'],'合同.pdf'),'root','附件/合同.pdf')
  expect(saved).toMatchObject({id:'saved',space:'PERSONAL',folderId:'child'})
  expect(request.mock.calls.find(([p])=>p.endsWith('/upload'))?.[1].body.get('folder_id')).toBe('child')
 })
 it('演示上传与 API 具有相同的相对路径语义，不把子目录文件放到根目录',async()=>{
  const api=createDemoService(),root=await api.createFolder('上传验证',undefined,'PERSONAL')
  const first=await api.upload(new File(['x'],'甲.pdf'),root.id,'资料/合同/甲.pdf')
  const second=await api.upload(new File(['y'],'乙.pdf'),root.id,'资料/合同/乙.pdf')
  expect(first.folderId).not.toBe(root.id);expect(first.folderId).toBe(second.folderId);expect(first.space).toBe('PERSONAL')
  const folders=await api.listFolders('PERSONAL'),r=folders.find(f=>f.id===root.id)!
  expect(r.children).toHaveLength(1);expect(r.children![0].name).toBe('资料');expect(r.children![0].children).toHaveLength(1);expect(r.children![0].children![0].name).toBe('合同')
 })
})
describe('导出错误响应',()=>{
 it('problem+json 错误不能作为导出文件下载',async()=>{
  const request=createHttp('',vi.fn().mockResolvedValue(new Response(JSON.stringify({code:403,message:'无导出权限'}),{headers:{'content-type':'application/problem+json'}})))
  await expect(request('/export',{blob:true})).rejects.toThrow('无导出权限')
 })
 it('HTTP 查询参数不破坏已配置接口自带的参数',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response('{}',{headers:{'content-type':'application/json'}}))
  await createHttp('',fetcher)('/export?format=xlsx',{params:{page:2}})
  expect(fetcher.mock.calls[0][0]).toBe('/export?format=xlsx&page=2')
 })
})
