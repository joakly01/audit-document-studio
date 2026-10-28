import {chromium, expect} from '@playwright/test'
import {mkdir, writeFile, mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const base=process.env.REVIEW_API_BASE||'http://localhost:5174'
const phase=process.env.REVIEW_PHASE||'after'
await mkdir('review/integration-review',{recursive:true})
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--no-proxy-server']})
const checks=[],errors=[]
const file=(id,folder_id)=>({file_id:id,file_name:id+'.pdf',folder_id,parse_status:2,space_type:'PUBLIC',can_analyze:true,can_download:true,file_size:200})
async function setup(){
 const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message))
 const state={folders:[{id:'a',name:'甲目录',space_type:'PUBLIC'},{id:'b',name:'乙目录',space_type:'PUBLIC'}],created:[],uploads:[],attached:false,holdSave:false,saveWaiting:false,releaseSave:null,holdSubmit:false,submitWaiting:false,releaseSubmit:null,many:false,failB:false,failSpace:false,holdSelection:false,selectionWaiting:false,releaseSelection:null,holdMetadata:false,metadataWaiting:false,releaseMetadata:null}
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,params=url.searchParams
  let data={}
  if(path.endsWith('/folders/tree')){if(state.failSpace&&params.get('space_type')==='PERSONAL'){await route.fulfill({status:403,json:{message:'无个人目录权限'}});return}data=state.folders}
  else if(path.endsWith('/children'))data=state.folders.filter(f=>f.parent_id===path.split('/').at(-2))
  else if(path.endsWith('/folders')&&route.request().method()==='POST'){const body=route.request().postDataJSON();data={id:'new-'+state.created.length,name:body.folder_name,parent_id:body.parent_id,space_type:body.space_type};state.created.push(data);state.folders.push(data)}
  else if(path.endsWith('/files/upload')){state.uploads.push(route.request().postData());data={file_id:'uploaded',file_name:'合同.pdf',parse_status:0}}
  else if(path.endsWith('/files')||path.endsWith('/files/by-space')){
   const folder=params.get('folder_id');if(state.failB&&folder==='b'){await route.fulfill({status:500,json:{message:'乙目录加载失败'}});return}
   if(state.holdSelection&&params.get('page_size')==='100'){state.selectionWaiting=true;await new Promise(r=>state.releaseSelection=r)}
   if(state.holdMetadata&&params.get('page_size')==='100'&&!params.has('parse_status')){state.metadataWaiting=true;await new Promise(r=>state.releaseMetadata=r)}
   const files=state.many?Array.from({length:25},(_,i)=>file('资料'+(i+1),'a')):folder==='a'?[file('甲资料','a')]:folder==='b'?[file('乙资料','b')]:[file('甲资料','a'),file('乙资料','b')];const size=Number(params.get('page_size')||20),page=Number(params.get('page')||1);data={files:files.slice((page-1)*size,page*size).map(f=>state.attached&&f.file_id==='甲资料'?{...f,attachment_ids:['乙资料']}:f),total:files.length}
  }
  else if(path.endsWith('/getDirectoryTree')||path.includes('/getPublicAndPrivateTemplates'))data=[]
  else if(path.endsWith('/content'))data={content:'接口测试原文'}
  else if(path.endsWith('/attachments')){if(route.request().method()==='POST'&&state.holdSave){state.saveWaiting=true;await new Promise(r=>state.releaseSave=r)}data=[]}
  else if(path.endsWith('/BatchExecuteByFilter')){if(state.holdSubmit){state.submitWaiting=true;await new Promise(r=>state.releaseSubmit=r)}data={task_uuid:'created',status:'queued'}}
  await route.fulfill({json:{code:0,data}}).catch(()=>{})
 })
 return{page,state}
}
async function check(name,fn){if(process.env.CHECK_FILTER&&!name.includes(process.env.CHECK_FILTER))return;const ctx=await setup();try{await fn(ctx);checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:String(e)});await ctx.page.screenshot({path:`review/integration-review/${phase}-${checks.length}.png`})}finally{ctx.state.releaseSelection?.();ctx.state.releaseMetadata?.();ctx.state.releaseSave?.();ctx.state.releaseSubmit?.();await ctx.page.close()}}
await check('文件夹上传只建立一次层级，文件写入最终子目录',async({page,state})=>{
 const dir=await mkdtemp(join(tmpdir(),'audit-upload-'));await mkdir(join(dir,'子目录'));await writeFile(join(dir,'子目录','合同.pdf'),'fixture')
 try{await page.goto(base+'/#/library');await page.getByText('甲目录',{exact:true}).click();await page.getByRole('button',{name:'上传',exact:true}).click();const d=page.getByRole('dialog',{name:'上传资料'});await d.locator('input[webkitdirectory]').setInputFiles(dir);await d.getByRole('button',{name:/开始上传/}).click();await expect(d.getByText('上传完成',{exact:true})).toBeVisible();expect(state.created).toHaveLength(2);expect(state.created[0].parent_id).toBe('a');expect(state.created[1].parent_id).toBe(state.created[0].id);expect(state.uploads).toHaveLength(1);expect(state.uploads[0]).toMatch(/name="folder_id"\r\n\r\nnew-1/)}finally{await rm(dir,{recursive:true,force:true})}
})
await check('切换目录加载失败不显示上一个目录的文件',async({page,state})=>{
 await page.goto(base+'/#/library');await page.getByText('甲目录',{exact:true}).click();await expect(page.locator('.library-table')).toContainText('甲资料.pdf');state.failB=true;await page.getByText('乙目录',{exact:true}).click();await expect(page.getByText('乙目录加载失败',{exact:true})).toBeVisible();await expect(page.locator('.library-table')).not.toContainText('甲资料.pdf');await expect(page.getByRole('button',{name:'选择全部页',exact:true})).toBeDisabled()
})
await check('切换空间加载失败不保留原空间目录',async({page,state})=>{
 await page.goto(base+'/#/library');await expect(page.getByText('甲目录',{exact:true})).toBeVisible();state.failSpace=true;await page.locator('.space-select .el-select').click();await page.getByRole('option',{name:'个人空间',exact:true}).click();await expect(page.getByText('无个人目录权限',{exact:true})).toBeVisible();await expect(page.locator('.directory-tree')).not.toContainText('甲目录')
})
await check('选择全部页期间切换目录，旧范围响应不能改变新选择',async({page,state})=>{
 await page.goto(base+'/#/tool/extract');await page.getByRole('button',{name:'添加',exact:true}).click();const d=page.getByRole('dialog',{name:'添加资料'});await d.getByText('甲目录',{exact:true}).click();await expect(d.locator('.picker-table')).toContainText('甲资料.pdf');state.holdSelection=true;await d.getByRole('button',{name:'选择全部页',exact:true}).click();await expect.poll(()=>state.selectionWaiting).toBe(true);await d.getByText('乙目录',{exact:true}).click();await expect(d.locator('.picker-table')).toContainText('乙资料.pdf');state.releaseSelection();await expect(d.locator('.picker-selection strong')).toHaveText('0');await page.waitForTimeout(150);await expect(d.locator('.picker-selection strong')).toHaveText('0')
})
await check('关闭附件确认后，旧响应不修改已选资料的附件',async({page,state})=>{
 await page.goto(base+'/#/tool/extract');await page.getByRole('button',{name:'添加',exact:true}).click();let d=page.getByRole('dialog',{name:'添加资料'});await d.getByRole('checkbox',{name:'选择本页',exact:true}).locator('xpath=ancestor::label').click();await d.getByRole('button',{name:/确认添加/}).click();await expect(page.locator('.selected-file')).toHaveCount(2);await page.getByRole('button',{name:'关联附件 甲资料.pdf',exact:true}).click();d=page.getByRole('dialog',{name:'关联附件'});await d.getByRole('checkbox',{name:'关联 乙资料.pdf',exact:true}).locator('xpath=ancestor::label').click();state.holdMetadata=true;await d.getByRole('button',{name:/确认关联/}).click();await expect.poll(()=>state.metadataWaiting).toBe(true);await d.getByRole('button',{name:'取消',exact:true}).click();state.holdMetadata=false;state.releaseMetadata();await page.waitForTimeout(200);await page.getByRole('button',{name:'关联附件 甲资料.pdf',exact:true}).click();await expect(page.getByRole('dialog',{name:'关联附件'}).getByRole('checkbox',{name:'关联 乙资料.pdf',exact:true})).not.toBeChecked()
})
await check('资料管理全选期间切换目录不会加入旧目录资料',async({page,state})=>{
 await page.goto(base+'/#/library');await page.getByText('甲目录',{exact:true}).click();await expect(page.locator('.library-table')).toContainText('甲资料.pdf');state.holdSelection=true;await page.getByRole('button',{name:'选择全部页',exact:true}).click();await expect.poll(()=>state.selectionWaiting).toBe(true);await page.getByText('乙目录',{exact:true}).click();await expect(page.locator('.library-table')).toContainText('乙资料.pdf');state.releaseSelection();await page.waitForTimeout(200);await expect(page.locator('.scope-selection strong')).toHaveText('0')
})
await check('文件列表可翻到第二页，刷新不重置页码',async({page,state})=>{
 state.many=true;await page.goto(base+'/#/library');await expect(page.locator('.library-table')).toContainText('资料1.pdf');await page.locator('.library-main>.el-pagination .btn-next').click();await expect(page.locator('.library-table')).toContainText('资料21.pdf');await page.getByRole('button',{name:'刷新资料',exact:true}).click();await expect(page.locator('.library-table')).toContainText('资料21.pdf');await expect(page.locator('.library-main>.el-pagination .is-active')).toHaveText('2')
})
async function addBoth(page){await page.goto(base+'/#/tool/extract');await page.getByRole('button',{name:'添加',exact:true}).click();const d=page.getByRole('dialog',{name:'添加资料'});await d.getByRole('checkbox',{name:'选择本页',exact:true}).locator('xpath=ancestor::label').click();await d.getByRole('button',{name:/确认添加/}).click();await expect(page.locator('.selected-file')).toHaveCount(2)}
await check('附件加载中切换工具，不会在新工具重新打开旧弹窗',async({page,state})=>{
 state.attached=true;await addBoth(page);state.holdMetadata=true;await page.getByRole('button',{name:'关联附件 甲资料.pdf',exact:true}).click();await expect.poll(()=>state.metadataWaiting).toBe(true);await page.getByRole('link',{name:'词云分析',exact:true}).click();state.holdMetadata=false;state.releaseMetadata();await page.waitForTimeout(200);await expect(page.getByRole('dialog',{name:'关联附件'})).not.toBeVisible()
})
await check('附件保存中切换工具，成功结果只回写原工具资料',async({page,state})=>{
 await addBoth(page);await page.getByRole('button',{name:'关联附件 甲资料.pdf',exact:true}).click();const d=page.getByRole('dialog',{name:'关联附件'});await d.getByRole('checkbox',{name:'关联 乙资料.pdf',exact:true}).locator('xpath=ancestor::label').click();state.holdSave=true;await d.getByRole('button',{name:/确认关联/}).click();await expect.poll(()=>state.saveWaiting).toBe(true);await expect(page.getByRole('button',{name:'关联附件 甲资料.pdf',exact:true})).toBeDisabled();await page.getByRole('link',{name:'词云分析',exact:true}).click();state.releaseSave();await page.waitForTimeout(200);await page.getByRole('link',{name:'信息提取',exact:true}).click();await expect(page.getByRole('button',{name:'关联附件 甲资料.pdf',exact:true}).locator('sup')).toHaveText('1')
})
await check('提交任务后切换工具，不会被旧任务响应强制跳转',async({page,state})=>{
 await addBoth(page);await page.getByRole('button',{name:'添加字段',exact:true}).click();await page.getByRole('textbox',{name:'字段 1 名称',exact:true}).fill('金额');await page.getByRole('button',{name:'开始提取',exact:true}).click();const d=page.locator('.el-dialog:visible');state.holdSubmit=true;await d.getByRole('button',{name:/确认.*(提取|提交|分析)|提交任务/}).click();await expect.poll(()=>state.submitWaiting).toBe(true);await d.locator('.el-dialog__headerbtn').click();await page.getByRole('link',{name:'词云分析',exact:true}).click();state.releaseSubmit();await page.waitForTimeout(200);await expect(page).toHaveURL(/#\/tool\/word$/)
})
await check('资料库附件旧请求返回，不重开已取消的窗口',async({page,state})=>{
 state.attached=true;await page.goto(base+'/#/library');await expect(page.locator('.library-table')).toContainText('甲资料.pdf');state.holdMetadata=true;await page.getByRole('button',{name:'关联 甲资料.pdf 的附件',exact:true}).click();await expect.poll(()=>state.metadataWaiting).toBe(true);await page.getByRole('button',{name:'关联 乙资料.pdf 的附件',exact:true}).click();const d=page.getByRole('dialog',{name:'关联附件'});await expect(d).toContainText('乙资料.pdf');await d.getByRole('button',{name:'取消',exact:true}).click();state.holdMetadata=false;state.releaseMetadata();await page.waitForTimeout(200);await expect(d).not.toBeVisible()
})
await check('资料库附件保存期间禁止重复编辑同一文件',async({page,state})=>{
 await page.goto(base+'/#/library');await page.getByRole('button',{name:'关联 甲资料.pdf 的附件',exact:true}).click();const d=page.getByRole('dialog',{name:'关联附件'});await d.getByRole('checkbox',{name:'关联 乙资料.pdf',exact:true}).locator('xpath=ancestor::label').click();state.holdSave=true;await d.getByRole('button',{name:/确认关联/}).click();await expect.poll(()=>state.saveWaiting).toBe(true);await expect(page.getByRole('button',{name:'关联 甲资料.pdf 的附件',exact:true})).toBeDisabled();state.releaseSave();await expect(page.getByRole('button',{name:'关联 甲资料.pdf 的附件',exact:true})).toBeEnabled()
})
await writeFile(`review/integration-review/${phase}.json`,JSON.stringify({base,checks,errors,note:'真实页面和 API adapter，HTTP 响应使用夹具；不等同真实服务联调。'},null,2));console.log(JSON.stringify({checks,errors},null,2));await browser.close();if(errors.length||checks.some(c=>!c.passed))process.exitCode=1
