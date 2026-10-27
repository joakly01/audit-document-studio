import {chromium,expect} from '@playwright/test'
import {writeFile,mkdir} from 'node:fs/promises'
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:1440,height:1000}})
const errors=[],results=[];page.on('pageerror',e=>errors.push(e.message))
const routes=[['library','资料管理'],['tool/extract','信息提取'],['tool/word','词云分析'],['tool/theme','主题归纳'],['tool/timeline','时间轴分析'],['tool/meeting','会议纪要分析'],['tool/risk','风险点分析'],['tool/prepaid','待摊费用'],['tool/bidding','招投标分析'],['tool/contract','合同分析'],['tool/engineering','工程项目一致性'],['tool/association','两表项目关联度'],['templates','提取模板'],['prompts','提示词库'],['tasks','任务中心']]
await mkdir('review/routes',{recursive:true})
for(const [route,title] of routes){try{await page.goto('http://localhost:5173/?route-check='+Date.now()+'#/'+route);if(route==='library'){await expect(page.locator('.library-page')).toBeVisible();await expect(page.getByText('当前目录',{exact:true})).toBeVisible()}else await expect(page.getByRole('heading',{name:title,exact:true}).first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);results.push({route,passed:true});await page.screenshot({path:'review/routes/'+route.replaceAll('/','-')+'.png'})}catch(e){results.push({route,passed:false,error:String(e)})}}
await writeFile('review/routes/report.json',JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,results},null,2));await browser.close();if(errors.length||results.some(r=>!r.passed))process.exitCode=1
