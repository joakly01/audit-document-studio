import {describe,it,expect,vi} from 'vitest'
import {createApiService} from '../src/services/api'
import {createHttp} from '../src/services/http'

describe('目录上传后的连续操作',()=>{
 it.each(['rename','delete','external'] as const)('%s 后再次上传应按当前目录查找，不能继续使用失效路径',async(action)=>{
  let sequence=0
  const children:{id:string;folder_name:string}[]=[]
  const uploaded:string[]=[]
  const request=async(path:string,args?:any):Promise<any>=>{
   if(path.endsWith('/tree'))return[{id:'root',folder_name:'资料',space_type:'PERSONAL'}]
   if(path.endsWith('/children'))return children.map(x=>({...x}))
   if(path.endsWith('/folders')&&args?.method==='POST'){const child={id:`child-${++sequence}`,folder_name:args.body.folder_name};children.push(child);return child}
   if(path.endsWith('/rename')){children[0].folder_name=args.body.folder_name;return}
   if(args?.method==='DELETE'){children.splice(0);return}
   if(path.endsWith('/upload')){const id=args.body.get('folder_id');uploaded.push(id);return{file_id:`file-${uploaded.length}`,folder_id:id,file_name:'合同.pdf'}}
   throw Error('unexpected '+path)
  }
  const api=createApiService({request});await api.listFolders('PERSONAL')
  await api.upload(new File(['a'],'合同.pdf'),'root','附件/合同.pdf')
  if(action==='rename')await api.renameFolder('child-1','旧附件')
  else if(action==='delete')await api.deleteFolder('child-1')
  else children.splice(0) // Another browser removed the directory.
  await api.upload(new File(['b'],'合同.pdf'),'root','附件/合同.pdf')
  expect(uploaded).toEqual(['child-1','child-2'])
  expect(children.find(c=>c.id==='child-2')?.folder_name).toBe('附件')
 })
 it('并发上传同一路径仍只创建一个子目录',async()=>{
  let created=0
  const destinations:string[]=[]
  const request=async(path:string,args?:any):Promise<any>=>{
   if(path.endsWith('/tree'))return[{id:'root',folder_name:'资料',space_type:'PERSONAL'}]
   if(path.endsWith('/children'))return[]
   if(path.endsWith('/folders')){created++;return{id:'child',folder_name:'附件'}}
   if(path.endsWith('/upload')){destinations.push(args.body.get('folder_id'));return{file_id:args.body.get('file').name}}
   throw Error('unexpected '+path)
  }
  const api=createApiService({request});await api.listFolders('PERSONAL')
  await Promise.all(['甲.pdf','乙.pdf'].map(name=>api.upload(new File(['x'],name),'root',`附件/${name}`)))
  expect(created).toBe(1);expect(destinations).toEqual(['child','child'])
 })
})

describe('真实接口错误信息',()=>{
 it('RFC problem 响应即使传输状态为 200 也不能下载成结果文件',async()=>{
  const request=createHttp('',vi.fn().mockResolvedValue(new Response(JSON.stringify({type:'about:blank',title:'结果导出失败',status:403,detail:'当前账号无权导出此任务'}),{headers:{'content-type':'application/problem+json'}})))
  await expect(request('/export',{blob:true})).rejects.toThrow('当前账号无权导出此任务')
 })
 it('参数校验错误展示字段与原因，而不是 [object Object]',async()=>{
  const request=createHttp('',vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:[{type:'missing',loc:['body','file_ids'],msg:'Field required',input:{}}]}),{status:422,headers:{'content-type':'application/json'}})))
  await expect(request('/submit')).rejects.toThrow('file_ids：Field required')
 })
 it('合法 JSON 导出仍可下载',async()=>{
  const body=JSON.stringify({results:[{amount:100}]})
  const request=createHttp('',vi.fn().mockResolvedValue(new Response(body,{headers:{'content-type':'application/json'}})))
  expect(await(await request<Blob>('/export',{blob:true})).text()).toBe(body)
 })
})
