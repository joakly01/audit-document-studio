import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const base=process.env.REVIEW_API_BASE||'http://localhost:5174',phase=process.env.REVIEW_PHASE||'after'
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--no-proxy-server']})
const checks=[],errors=[]
const task=id=>({task_uuid:id,task_name:id==='a'?'合同核查甲':'合同核查乙',tool:'contract',processing_status:2,file_num:1,has_results:true})
async function check(name,run){
 const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message))
 const state={fail:false,hold:false,waiting:false,release:null,finished:false}
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname
  if(path.endsWith('/PageList')){await route.fulfill(state.fail?{status:500,json:{message:'分析记录查询失败'}}:{json:{items:[task('a'),task('b')],total:2}});return}
  if(path.includes('/GetTaskSchedules/')){const id=path.split('/').at(-1);if(id==='a'&&state.hold){state.waiting=true;await new Promise(r=>state.release=r)}await route.fulfill({json:task(id)}).catch(()=>{});if(id==='a')state.finished=true;return}
  await route.fulfill({json:[]})
 })
 try{await page.goto(base+'/#/tasks');await expect(page.locator('.task-name')).toHaveCount(2);await run(page,state);checks.push({name,passed:true})}
 catch(e){checks.push({name,passed:false,error:e.message})}
 finally{state.release?.();await page.close()}
}
await check('查询失败时清理旧分析记录，避免旧列表冒充当前查询',async(page,state)=>{
 state.fail=true;await page.getByRole('textbox',{name:'任务名称',exact:true}).fill('不存在的新任务');await page.getByRole('button',{name:'查询',exact:true}).click();await expect(page.getByText('分析记录查询失败',{exact:true})).toBeVisible();await expect(page.locator('.task-name')).toHaveCount(0)
})
await check('先点甲后点乙，甲的慢响应不能覆盖乙的任务信息',async(page,state)=>{
 state.hold=true;await page.getByRole('button',{name:'任务信息',exact:true}).nth(0).click();await expect.poll(()=>state.waiting).toBe(true);await page.getByRole('button',{name:'任务信息',exact:true}).nth(1).click();const dialog=page.getByRole('dialog',{name:'任务信息',exact:true});await expect(dialog).toContainText('合同核查乙');state.release();await expect.poll(()=>state.finished).toBe(true);await expect(dialog).toContainText('合同核查乙');await expect(dialog).not.toContainText('合同核查甲')
})
await check('关闭乙任务窗口后，甲的慢响应不重新打开窗口',async(page,state)=>{
 state.hold=true;await page.getByRole('button',{name:'任务信息',exact:true}).nth(0).click();await expect.poll(()=>state.waiting).toBe(true);await page.getByRole('button',{name:'任务信息',exact:true}).nth(1).click();const dialog=page.getByRole('dialog',{name:'任务信息',exact:true});await expect(dialog).toContainText('合同核查乙');await dialog.getByRole('button',{name:'关闭',exact:true}).click();state.release();await expect.poll(()=>state.finished).toBe(true);await expect(dialog).not.toBeVisible()
})
await mkdir('review/integration-review',{recursive:true});await writeFile(`review/integration-review/task-boundaries-${phase}.json`,JSON.stringify({base,checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));await browser.close();if(errors.length||checks.some(c=>!c.passed))process.exitCode=1
