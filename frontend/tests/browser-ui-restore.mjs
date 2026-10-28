import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const phase=process.env.UI_PHASE||'after',before=phase==='before'
const base=(process.env.UI_BASE_URL||'http://localhost:5173').replace(/\/$/,'')
const dir=`review/ui-restore/${phase}`;await mkdir(dir,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--no-proxy-server']})
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'})
page.setDefaultTimeout(10000)
const checks=[],metrics=[],errors=[];page.on('pageerror',error=>errors.push(error.message))
const tools={extract:'信息提取',word:'词云分析',theme:'主题归纳',timeline:'时间轴分析',meeting:'会议纪要分析',risk:'风险点分析',bidding:'招投标分析',contract:'合同分析',prepaid:'待摊费用',engineering:'工程项目一致性',association:'两表项目关联度'}
async function settled(){await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page.locator('.el-loading-mask:visible')).toHaveCount(0)}
async function visit(route,title){await page.goto(`${base}/?ui_review=${Date.now()}#/${route}`);if(title)await expect(page.getByRole('heading',{name:title,exact:true}).first()).toBeVisible();else await expect(page.locator('.library-page')).toBeVisible();await settled()}
async function check(name,fn){try{await fn();checks.push({name,passed:true})}catch(error){checks.push({name,passed:false,error:String(error)});await page.screenshot({path:`${dir}/failure-${checks.length}.png`,animations:'disabled'});await page.keyboard.press('Escape')}}
async function measure(key){
 const value=await page.evaluate(key=>{
  const rect=selector=>{const e=document.querySelector(selector);return e&&e.getBoundingClientRect().width?e.getBoundingClientRect().toJSON():null}
  const small=[],contrast=[]
  const rgb=value=>{const p=value.match(/[\d.]+/g)?.map(Number);return p?.length>=3?[p[0],p[1],p[2],p[3]??1]:[255,255,255,0]}
  const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]))
  const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
  const background=el=>{let color=[255,255,255];const parents=[];for(let p=el;p;p=p.parentElement)parents.push(p);for(const p of parents.reverse())color=blend(rgb(getComputedStyle(p).backgroundColor),color);return color}
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT)
  for(let node;node=walker.nextNode();){const e=node.parentElement;if(!e||!node.textContent.trim()||e.closest('svg,.sr-only,.word-preview,[aria-hidden="true"]'))continue;const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height||r.bottom<=0||r.top>=innerHeight||s.visibility==='hidden'||parseFloat(s.fontSize)<=0)continue
   if(parseFloat(s.fontSize)<14)small.push({text:node.textContent.trim().slice(0,40),font:s.fontSize,cls:e.className})
   if(!e.closest(':disabled,.is-disabled,[aria-disabled="true"]')){const bg=background(e),fg=blend(rgb(s.color),bg),a=luminance(bg),b=luminance(fg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(ratio<4.5)contrast.push({text:node.textContent.trim().slice(0,40),color:s.color,background:bg.map(Math.round),ratio:Number(ratio.toFixed(3)),cls:e.className})}}
  return{key,viewport:{width:innerWidth,height:innerHeight},navigation:rect('.app-nav'),heading:rect('.page-heading'),workspace:rect('.workspace'),sourceHeader:rect('.source-head'),left:rect('.materials'),right:rect('.configuration'),primaryFont:(()=>{const e=document.querySelector('.page-heading .el-button--primary');return e?getComputedStyle(e).fontSize:null})(),inputFont:(()=>{const e=document.querySelector('input.el-input__inner');return e?getComputedStyle(e).fontSize:null})(),horizontalOverflow:document.documentElement.scrollWidth>innerWidth,small:small.slice(0,12),contrast:contrast.slice(0,12)}
 },key);metrics.push(value);if(!before){expect(value.horizontalOverflow,key).toBe(false);expect(value.small,key+'小字号').toEqual([]);expect(value.contrast,key+'文字对比度').toEqual([]);if(value.primaryFont)expect(value.primaryFont,key+'主按钮字号').toBe('16px');if(key==='library'&&value.viewport.width===390){const tree=await page.locator('.directory-tree .el-scrollbar__wrap').boundingBox();expect(tree.height,'手机目录至少保留两整行').toBeGreaterThanOrEqual(76)}};return value
}
async function dialogMetrics(name,size){
 await settled();const dialog=page.locator('.el-dialog:visible').last();await expect(dialog).toBeVisible()
 const value=await dialog.evaluate((e,{name,size})=>({name,size,rect:e.getBoundingClientRect().toJSON(),body:e.querySelector('.el-dialog__body').getBoundingClientRect().toJSON(),footer:e.querySelector('.el-dialog__footer')?.getBoundingClientRect().toJSON(),textarea:e.querySelector('textarea')?.getBoundingClientRect().toJSON()}),{name,size})
 metrics.push(value);await page.screenshot({path:`${dir}/${name}-${size.width}.png`,animations:'disabled'})
 if(!before){expect(value.rect.top,name).toBeGreaterThanOrEqual(13);expect(value.rect.bottom,name).toBeLessThanOrEqual(size.height-13);expect(value.rect.left,name).toBeGreaterThanOrEqual(13);expect(value.rect.right,name).toBeLessThanOrEqual(size.width-13);if(value.footer)expect(value.footer.bottom,name+'底部操作').toBeLessThanOrEqual(size.height-13);if(name==='prompt')expect(value.textarea.height,name+'正文空间').toBeGreaterThan(size.height<500?220:300);if(name==='picker'&&size.width===390){const tree=await dialog.locator('.directory-tree .el-scrollbar__wrap').boundingBox();expect(tree.height,'手机选择器目录至少保留两整行').toBeGreaterThanOrEqual(76)}}
 return dialog
}
const sizes=before?[{width:1366,height:768},{width:1024,height:480}]:[{width:1366,height:768},{width:1024,height:480},{width:390,height:600}]
for(const size of sizes){
 await page.setViewportSize(size)
 for(const [id,title]of Object.entries(tools))await check(`${size.width}×${size.height} ${title}`,async()=>{
  await visit('tool/'+id,title);const m=await measure('tool/'+id)
  if(!before){expect(m.heading.height).toBeLessThanOrEqual(56);if(size.width===1366){expect(m.navigation.width).toBe(192);expect(m.heading.y).toBe(0);if(m.sourceHeader)expect(m.sourceHeader.height).toBe(44);const footer=await page.locator('.selection-total').boundingBox();expect(footer.y+footer.height).toBeCloseTo(m.workspace.bottom,0)}
   const buttons=page.locator('.page-heading .actions button');for(const button of await buttons.all()){const r=await button.boundingBox();expect(r.x+r.width,title+'主操作可见').toBeLessThanOrEqual(size.width+1)}
  }
  if(size.width===1366||['extract','bidding','risk'].includes(id))await page.screenshot({path:`${dir}/tool-${id}-${size.width}.png`,animations:'disabled'})
 })
 for(const [route,title]of [['library',null],['templates','提取模板'],['prompts','提示词库'],['tasks','任务中心']])await check(`${size.width}×${size.height} ${title||'资料管理'}`,async()=>{await visit(route,title);await measure(route);if(size.width===1366||route==='library')await page.screenshot({path:`${dir}/${route}-${size.width}.png`,animations:'disabled'})})
 await check(`${size.width}×${size.height} 提示词编辑窗口`,async()=>{await visit('tool/theme','主题归纳');if(await page.locator('.panel-tabs').isVisible())await page.locator('.panel-tabs').getByText('设置分析内容',{exact:true}).click();await page.getByRole('button',{name:'查看 / 编辑',exact:true}).first().click();const dialog=await dialogMetrics('prompt',size);await dialog.getByRole('button',{name:'取消',exact:true}).click()})
 await check(`${size.width}×${size.height} 添加资料窗口`,async()=>{await visit('tool/extract','信息提取');await page.getByRole('button',{name:'添加',exact:true}).click();const dialog=await dialogMetrics('picker',size);await dialog.getByRole('button',{name:'取消',exact:true}).click()})
}
if(!before){
 await page.setViewportSize({width:1366,height:768})
 for(const [id,title]of Object.entries(tools))await check(title+'结果版式',async()=>{await visit('tasks/demo-task-'+id,title);await expect(page.locator('.result-body')).toBeVisible();await measure('result/'+id);await page.screenshot({path:`${dir}/result-${id}.png`,animations:'disabled'})})
 await check('资料选择取消不改变原选择',async()=>{await visit('tool/extract','信息提取');await page.getByRole('button',{name:'添加',exact:true}).click();const d=page.locator('.el-dialog:visible');await settled();await d.getByRole('checkbox',{name:'选择 虚构示例合同.pdf',exact:true}).locator('xpath=ancestor::label').click();await d.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.selected-file')).toHaveCount(0)})
 await check('目录与页签切换保留草稿；原文可放大查看',async()=>{
  await visit('tool/extract','信息提取');await page.getByRole('button',{name:'添加',exact:true}).click();const d=page.locator('.el-dialog:visible');await settled();await d.getByRole('checkbox',{name:'选择 虚构示例合同.pdf',exact:true}).locator('xpath=ancestor::label').click();await d.getByRole('button',{name:/确认添加/}).click();await expect(d).not.toBeVisible();await page.getByRole('button',{name:'添加字段',exact:true}).click();await page.getByRole('textbox',{name:'字段 1 名称',exact:true}).fill('核验金额');await page.getByRole('button',{name:'放大查看',exact:true}).click();const enlarged=await page.locator('.source-expanded').boundingBox();expect(enlarged.width).toBeGreaterThan(1000);expect(enlarged.bottom??enlarged.y+enlarged.height).toBeLessThanOrEqual(768);await page.getByRole('button',{name:'退出放大',exact:true}).click()
  await page.setViewportSize({width:1024,height:480});await expect(page.locator('.panel-tabs').getByText('添加资料',{exact:true})).toHaveCount(0);await page.locator('.panel-tabs').getByText('查看原文',{exact:true}).click();await page.locator('.panel-tabs').getByText('设置分析内容',{exact:true}).click();await expect(page.getByRole('textbox',{name:'字段 1 名称',exact:true})).toHaveValue('核验金额')
  await page.setViewportSize({width:390,height:600});await page.locator('.panel-tabs').getByText('添加资料',{exact:true}).click();await expect(page.locator('.selected-file')).toHaveCount(1);await page.locator('.panel-tabs').getByText('设置分析内容',{exact:true}).click();await expect(page.getByRole('textbox',{name:'字段 1 名称',exact:true})).toHaveValue('核验金额')
 })
 await check('模板列表可直接使用，载入字段不清除资料',async()=>{await page.setViewportSize({width:1366,height:768});await visit('tool/extract','信息提取');await page.getByRole('button',{name:'添加',exact:true}).click();const d=page.locator('.el-dialog:visible');await settled();await d.getByRole('checkbox',{name:'选择 虚构示例合同.pdf',exact:true}).locator('xpath=ancestor::label').click();await d.getByRole('button',{name:/确认添加/}).click();await expect(d).not.toBeVisible();await expect(page.locator('.selected-file')).toHaveCount(1);await page.getByRole('button',{name:'添加字段',exact:true}).click();await page.getByRole('textbox',{name:'字段 1 名称',exact:true}).fill('先前字段');await page.getByRole('link',{name:'提取模板',exact:true}).click();await settled();await page.getByRole('button',{name:'使用模板',exact:true}).first().click();const confirm=page.locator('.el-message-box:visible');await expect(confirm).toBeVisible();expect((await confirm.boundingBox()).width).toBeLessThanOrEqual(540);await page.screenshot({path:dir+'/template-confirmation.png',animations:'disabled'});await confirm.getByRole('button',{name:'载入模板',exact:true}).click();await expect(page).toHaveURL(/#\/tool\/extract/);await expect(page.locator('.selected-file')).toHaveCount(1);await expect(page.getByRole('textbox',{name:'字段 1 名称',exact:true})).toBeVisible()})
 await check('导航折叠及恢复',async()=>{await visit('tool/theme','主题归纳');await page.getByRole('button',{name:'折叠菜单',exact:true}).click();expect(await page.locator('.app-nav').evaluate(e=>e.getBoundingClientRect().width)).toBe(64);await page.getByRole('button',{name:'展开菜单',exact:true}).click();expect(await page.locator('.app-nav').evaluate(e=>e.getBoundingClientRect().width)).toBe(192)})
 await check('嵌入模式无应用导航',async()=>{await page.goto(base+'/?embed=1#/tool/theme');await expect(page.getByRole('heading',{name:'主题归纳',exact:true})).toBeVisible();await expect(page.locator('.app-nav')).toHaveCount(0);await measure('embedded/theme')})
}
await writeFile(`review/ui-restore/${phase}.json`,JSON.stringify({phase,base,checks,metrics,errors},null,2));console.log(JSON.stringify({phase,total:checks.length,failed:checks.filter(c=>!c.passed),errors},null,2));await browser.close();if(!before&&(errors.length||checks.some(c=>!c.passed)))process.exitCode=1
