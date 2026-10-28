import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const base=(process.env.DEPLOY_URL||'http://43.128.232.108').replace(/\/$/,'')
const dir='review/deployment';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--no-proxy-server']})
const page=await browser.newPage({viewport:{width:1440,height:1000}})
page.setDefaultTimeout(12000)
const errors=[],checks=[],failedAssets=[]
page.on('pageerror',error=>errors.push(error.message))
page.on('response',response=>{const url=new URL(response.url());if(response.status()>=400&&url.origin===base&&!url.pathname.startsWith('/api/'))failedAssets.push({path:url.pathname,status:response.status()})})
async function demo(route,title){await page.goto(`${base}/demo/#/${route}`);await expect(page.locator('.demo-badge')).toBeVisible();if(title)await expect(page.getByRole('heading',{name:title,exact:true}).first()).toBeVisible()}
async function pick(name){const dialog=page.locator('.material-picker-dialog');await expect(dialog).toBeVisible();await dialog.getByRole('checkbox',{name:'选择 '+name,exact:true}).locator('xpath=ancestor::label').click();await dialog.getByRole('button',{name:/确认添加/}).click();await expect(dialog).not.toBeVisible()}
const tools={extract:'信息提取',word:'词云分析',theme:'主题归纳',timeline:'时间轴分析',meeting:'会议纪要分析',risk:'风险点分析',bidding:'招投标分析',contract:'合同分析',prepaid:'待摊费用',engineering:'工程项目一致性',association:'两表项目关联度'}
let version
try{
 const health=await page.request.get(base+'/healthz');expect(health.status()).toBe(200);expect((await health.text()).trim()).toBe('ok')
 const result=await page.request.get(base+'/version.json');expect(result.status()).toBe(200);version=await result.json();expect(version.primaryMode).toBe('api');expect(result.headers()['cache-control']).toContain('no-store');checks.push('健康检查与发布版本正确')
 const api=await page.request.get(base+'/api/v1/file-manager/folders/tree?space_type=PUBLIC');expect(api.status()).toBe(503);expect((await api.json()).message).toContain('业务接口尚未配置');checks.push('未接入后端时返回明确 JSON，不以页面或演示数据兜底')
 for(const path of ['/.env','/src/main.ts','/assets/missing.js.map','/demo/assets/missing.js'])expect((await page.request.get(base+path)).status()).toBe(404)
 checks.push('源码、配置与缺失静态资源保持 404')
 await page.goto(base+'/#/tool/extract');await expect(page.getByRole('heading',{name:'信息提取',exact:true})).toBeVisible();await expect(page.locator('.demo-badge')).toHaveCount(0);await expect(page.getByText('业务接口尚未配置',{exact:false}).first()).toBeVisible();await page.getByRole('button',{name:'添加字段',exact:true}).click();await expect(page.getByRole('textbox',{name:'字段 1 名称',exact:true})).toBeVisible();await page.screenshot({path:dir+'/api-mode.png'});checks.push('正式入口运行 API 模式，HTTP 下可添加字段')
 for(const [id,title]of Object.entries(tools)){await demo('tool/'+id,title);checks.push(title+'准备页可访问')}
 for(const [id,title]of Object.entries(tools)){await demo('tasks/demo-task-'+id,title);await expect(page.locator('.result-body')).toBeVisible();await expect(page.locator('.selected-file')).toHaveCount(0);checks.push(title+'结果页可访问')}
 for(const [route,title]of [['templates','提取模板'],['prompts','提示词库'],['tasks','任务中心']]){await demo(route,title);checks.push(title+'可访问')}
 await demo('library');await expect(page.locator('.library-page')).toBeVisible();checks.push('资料管理演示可访问')
 await demo('tool/extract','信息提取');await page.getByRole('button',{name:'添加',exact:true}).click();await pick('虚构示例合同.pdf');await page.getByRole('button',{name:'添加字段',exact:true}).click();await page.getByRole('textbox',{name:'字段 1 名称',exact:true}).fill('合同金额');await page.getByRole('textbox',{name:'字段 1 提取说明'}).fill('保留原文币种与单位');await page.getByRole('button',{name:'开始提取',exact:true}).click();await page.getByRole('button',{name:'确认提交',exact:true}).click();await expect(page).toHaveURL(/#\/tasks\//);await expect(page.locator('.result-page')).toContainText('合同金额');await page.screenshot({path:dir+'/extraction-result.png'});checks.push('公网 HTTP：添加资料与字段、提交演示任务、直接查看结果')
 await demo('tool/bidding','招投标分析');await page.getByRole('button',{name:'添加项目',exact:true}).click();await page.getByRole('textbox',{name:'项目 1 名称'}).fill('HTTP 部署验证项目');await page.getByRole('button',{name:'添加单位',exact:true}).click();await page.getByRole('textbox',{name:'投标单位 1 名称'}).fill('虚构演示单位');checks.push('公网 HTTP：可添加招投标项目与单位')
 await demo('tool/association','两表项目关联度');await page.getByRole('button',{name:'选择台账',exact:true}).first().click();await pick('虚构示例项目台账A.xlsx');await page.getByRole('button',{name:'选择台账',exact:true}).click();await pick('虚构示例项目台账B.xlsx');await page.getByRole('button',{name:'添加字段对应',exact:true}).click();await expect(page.getByRole('combobox',{name:'表A字段 1',exact:true})).toBeVisible();checks.push('公网 HTTP：两表字段对应可添加')
 await demo('tool/contract','合同分析');await page.getByRole('radio',{name:'施工合同',exact:true}).locator('xpath=ancestor::label').click();await page.getByRole('button',{name:'添加检查规则',exact:true}).click();const dialog=page.getByRole('dialog',{name:'添加合同规则'});for(const name of ['检查事项','检查说明','判断依据','判定标准'])await dialog.getByRole('textbox',{name,exact:true}).fill('虚构演示：'+name);await dialog.getByRole('button',{name:'保存并选用',exact:true}).click();await expect(dialog).not.toBeVisible();checks.push('公网 HTTP：合同自定义规则可保存')
 await page.setViewportSize({width:390,height:844});await demo('tool/extract','信息提取');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:dir+'/mobile.png'});checks.push('公网窄屏布局无横向溢出')
 expect(failedAssets).toEqual([])
}catch(error){errors.push(String(error));await page.screenshot({path:dir+'/failure.png'})}
await writeFile(dir+'/report.json',JSON.stringify({url:base,verifiedAt:new Date().toISOString(),version,checks,errors,failedAssets,note:'演示任务和结果为虚构数据；正式业务接口尚未接入。'},null,2))
console.log(JSON.stringify({checks,errors,failedAssets},null,2));await browser.close();if(errors.length||failedAssets.length)process.exitCode=1
