import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const dir='review/workspace';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:1440,height:1000}})
page.setDefaultTimeout(12000)
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message))
const base=process.env.BASE_URL||'http://localhost:5173'
async function visit(route,title){await page.goto(base+'/?verification='+Date.now()+'#/'+route);await expect(page.getByRole('heading',{name:title,exact:true}).first()).toBeVisible()}
async function check(name,fn){try{await fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:String(e)});await page.screenshot({path:dir+'/failure-'+checks.length+'.png'});await page.reload()}}
async function pick(names){const d=page.locator('.material-picker-dialog');await expect(d).toBeVisible();for(const name of names)await d.getByRole('checkbox',{name:'选择 '+name,exact:true}).locator('xpath=ancestor::label').click();await d.getByRole('button',{name:/确认添加/}).click();await expect(d).not.toBeVisible()}
async function submit(action){await page.getByRole('button',{name:action,exact:true}).click();await page.getByRole('button',{name:'确认提交',exact:true}).click();await expect(page).toHaveURL(/#\/tasks\//);await expect(page.getByRole('button',{name:'再次分析',exact:true})).toBeVisible()}
await check('提取默认无模板、添加字段、保存个人模板、提交后直接查看结果',async()=>{
 await visit('tool/extract','信息提取');await expect(page.locator('.empty-fields')).toBeVisible()
 await page.getByRole('button',{name:'添加',exact:true}).click();await pick(['虚构示例合同.pdf','虚构示例会议纪要.docx'])
 await expect(page.locator('.selected-file')).toHaveCount(2)
 await page.getByRole('button',{name:'添加字段',exact:true}).click();await page.getByRole('textbox',{name:'字段 1 名称',exact:true}).fill('计费金额');await page.getByRole('textbox',{name:'字段 1 提取说明'}).fill('保留币种和单位')
 await page.getByRole('button',{name:'另存为个人模板',exact:true}).click();await page.locator('.el-message-box input').fill('浏览器验证模板');await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByText('已保存到个人模板',{exact:true})).toBeVisible()
 await expect(page.locator('.el-message-box')).not.toBeVisible();await page.screenshot({path:dir+'/extraction.png'});await submit('开始提取');await expect(page.locator('.result-page')).toContainText('计费金额')
})
await check('提示词大窗编辑、取消和应用、本次修改保存为个人提示词',async()=>{
 await visit('tool/theme','主题归纳');await expect(page.locator('.prompt-summary').first()).toContainText('已载入')
 await page.getByRole('button',{name:'查看 / 编辑',exact:true}).first().click();let d=page.getByRole('dialog',{name:'资料要点提取提示词 · 编辑提示词'});const text=d.getByRole('textbox',{name:'提示词正文'});const original=await text.inputValue();await text.fill('不保存的文字');await d.getByRole('button',{name:'取消',exact:true}).click()
 await page.getByRole('button',{name:'查看 / 编辑',exact:true}).first().click();await expect(text).toHaveValue(original);await text.fill(original+'\n额外核对付款条件');await d.getByRole('button',{name:'另存为个人提示词',exact:true}).click();await page.locator('.el-message-box input').fill('浏览器个人提示词');await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByText('已保存到个人提示词',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'添加',exact:true}).click();await pick(['虚构示例合同.pdf']);await submit('开始归纳')
})
await check('招投标多方式默认载入提示词和规则，项目单位资料提交',async()=>{
 await visit('tool/bidding','招投标分析');await page.getByRole('button',{name:'添加项目',exact:true}).click();await page.getByRole('textbox',{name:'项目 1 名称'}).fill('测试招标项目')
 await page.getByRole('button',{name:'添加文件',exact:true}).click();await pick(['虚构示例招标文件.pdf'])
 await page.getByRole('button',{name:'添加单位',exact:true}).click();await page.getByRole('textbox',{name:'投标单位 1 名称'}).fill('示例投标单位')
 await page.getByRole('button',{name:'添加投标文件',exact:true}).click();await pick(['虚构示例投标文件.pdf'])
 await page.getByRole('checkbox',{name:'招投标联合分析',exact:true}).locator('xpath=ancestor::label').click();await expect(page.locator('.prompt-panel').filter({visible:true}).first()).toContainText('已载入')
 await expect(page.getByRole('checkbox',{name:'招投标联合分析',exact:true})).toBeChecked();await page.screenshot({path:dir+'/bidding.png'});await submit('开始分析')
})
await check('待摊费用按类型默认选择匹配提示词，进入分步结果',async()=>{
 await visit('tool/prepaid','待摊费用');await page.locator('.form-section .el-select').first().click();await page.getByRole('option',{name:'工程设计费',exact:true}).click()
 await expect(page.locator('.prompt-panel').first()).toContainText('已载入');await page.locator('.prompt-panel .el-select').first().click();await expect(page.getByRole('option',{name:/工程监理费/})).toHaveCount(0);await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'添加',exact:true}).click();await pick(['虚构示例合同.pdf']);await submit('提取计费约定');await expect(page.locator('.result-page')).toContainText('计费基数')
})
await check('两表对应字段与优先判断规则可编辑并提交',async()=>{
 await visit('tool/association','两表项目关联度');await page.getByRole('button',{name:'选择台账',exact:true}).first().click();await pick(['虚构示例项目台账A.xlsx']);await page.getByRole('button',{name:'选择台账',exact:true}).click();await pick(['虚构示例项目台账B.xlsx'])
 await page.getByRole('button',{name:'添加字段对应',exact:true}).click();await page.getByRole('combobox',{name:'表A字段 1',exact:true}).click();await page.getByRole('option',{name:'项目名称',exact:true}).last().click();await page.getByRole('combobox',{name:'表B字段 1',exact:true}).click();await page.getByRole('option',{name:'项目名称',exact:true}).last().click()
 await page.getByText('字段评分与高级设置',{exact:true}).click();await page.getByRole('button',{name:'添加组合规则',exact:true}).click();await expect(page.locator('.hard-rule')).toHaveCount(1);await page.screenshot({path:dir+'/association.png'});await submit('开始分析')
})
await check('词库维护、选用、手工词不丢失并提交统计',async()=>{
 await visit('tool/word','词云分析')
 await page.locator('.word-setting').filter({hasText:'停用词'}).getByRole('button',{name:'设置',exact:true}).click()
 let d=page.getByRole('dialog',{name:'设置停用词'});await d.getByRole('textbox',{name:'停用词列表'}).fill('手工排除词');await d.getByRole('button',{name:'应用',exact:true}).click()
 await page.getByRole('button',{name:'从我的词库选用'}).click();d=page.getByRole('dialog',{name:'我的词库'});await expect(d.getByText('政府采购',{exact:true})).toBeVisible()
 await d.getByRole('textbox',{name:'新增词条'}).fill('测试新增词');await d.getByRole('button',{name:'添加',exact:true}).click();await d.getByRole('button',{name:'保存词库',exact:true}).click();await expect(page.getByText('词库已保存',{exact:true})).toBeVisible()
 await d.getByRole('checkbox',{name:'选用 政府采购',exact:true}).locator('xpath=ancestor::label').click();await d.getByRole('button',{name:'添加到本次词表',exact:true}).click();await expect(d).not.toBeVisible()
 await expect(page.locator('.word-setting').filter({hasText:'停用词'})).toContainText('1');await expect(page.locator('.word-setting').filter({hasText:'新词'})).toContainText('1')
 await page.getByRole('button',{name:'添加',exact:true}).click();await pick(['虚构示例合同.pdf']);await submit('开始统计')
})
for(const [tool,title] of [['timeline','时间轴分析'],['meeting','会议纪要分析'],['risk','风险点分析']])await check(title+'默认提示词、添加资料和结果直达',async()=>{
 await visit('tool/'+tool,title);await expect(page.locator('.prompt-summary').first()).toContainText('已载入')
 await page.getByRole('button',{name:'添加',exact:true}).click();await pick(['虚构示例会议纪要.docx'])
 if(tool==='risk'){await expect(page.locator('.rule-picker .rule-row').first()).toBeVisible();await page.getByRole('textbox',{name:'查找风险点'}).fill('不存在风险');await expect(page.getByText('没有符合条件的风险点',{exact:true})).toBeVisible();await page.getByRole('textbox',{name:'查找风险点'}).fill('')}
 await submit('开始分析')
})
await check('合同自动识别与指定类别、规则编辑分别执行',async()=>{
 await visit('tool/contract','合同分析');await expect(page.locator('.prompt-panel')).toHaveCount(0)
 await page.getByRole('button',{name:'添加',exact:true}).click();await pick(['虚构示例合同.pdf']);await submit('开始分析')
 await visit('tool/contract','合同分析');await page.getByRole('radio',{name:'施工合同',exact:true}).locator('xpath=ancestor::label').click();await expect(page.locator('.prompt-summary').first()).toContainText('已载入')
 await page.getByRole('button',{name:'编辑规则',exact:true}).first().click();const d=page.getByRole('dialog',{name:'编辑合同规则'});await d.getByRole('textbox',{name:'判定标准',exact:true}).fill('检查审批记录是否与合同约定一致，引用原文。');await d.getByRole('button',{name:'保存并选用'}).click()
 await page.getByRole('button',{name:'添加',exact:true}).click();await pick(['虚构示例合同.pdf']);await page.screenshot({path:dir+'/contract.png'});await submit('开始分析')
})
await check('工程台账两类分析分别配置任意比较字段、权重并提交',async()=>{
 await visit('tool/engineering','工程项目一致性');await expect(page.locator('.prompt-summary').first()).toContainText('已载入');await page.getByRole('button',{name:'添加',exact:true}).click();await pick(['虚构示例项目台账A.xlsx'])
 const modes=page.locator('.engineering-mode');await expect(modes).toHaveCount(2)
 for(let i=0;i<2;i++){const mode=modes.nth(i);await mode.getByRole('button',{name:'添加比较字段',exact:true}).click();await mode.getByRole('button',{name:'添加比较字段',exact:true}).click();for(const [n,name] of ['项目名称','金额'].entries()){await mode.locator('.engineering-field').nth(n).locator('.el-select').first().click();await page.getByRole('option',{name,exact:true}).last().click()}await mode.getByRole('button',{name:'均分权重',exact:true}).click()}
 await page.screenshot({path:dir+'/engineering.png'});await submit('开始分析')
})
await check('模板管理复制、字段编辑和删除',async()=>{
 await visit('templates','提取模板');await page.getByRole('button',{name:'复制模板',exact:true}).first().click();const d=page.getByRole('dialog',{name:'新增提取模板'});await d.locator('.el-input input').first().fill('复制模板浏览器检查');await d.getByRole('button',{name:'保存模板'}).click();await expect(page.getByText('复制模板浏览器检查',{exact:true})).toBeVisible();const row=page.locator('.el-table__body tr').filter({hasText:'复制模板浏览器检查'});await row.getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('button',{name:'删除',exact:true}).last().click();await expect(page.getByText('复制模板浏览器检查',{exact:true})).toHaveCount(0)
})
await check('提示词库新建风险提示词保存到正确阶段',async()=>{
 await visit('prompts','提示词库');await page.locator('.toolbar .el-select').first().click();await page.getByRole('option',{name:'风险点分析',exact:true}).click();await page.getByRole('button',{name:'新增个人提示词'}).click();const d=page.getByRole('dialog',{name:'编辑个人提示词'});await expect(d.locator('.prompt-meta')).toContainText('风险分析');await d.getByRole('textbox',{name:'提示词名称'}).fill('风险测试提示词');await d.getByRole('textbox',{name:'提示词正文'}).fill('核对审批程序并引用原文');await d.getByRole('button',{name:'保存个人提示词'}).click();await expect(page.getByText('风险测试提示词',{exact:true})).toBeVisible()
})
await check('窄屏工具无横向溢出、三步骤可切换',async()=>{
 await page.setViewportSize({width:390,height:844});await visit('tool/extract','信息提取');for(const title of ['查看原文','设置分析内容','添加资料'])await page.locator('.panel-tabs').getByText(title,{exact:true}).click();await page.screenshot({path:dir+'/mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
await writeFile(dir+'/report.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));await browser.close();if(errors.length||checks.some(c=>!c.passed))process.exitCode=1
