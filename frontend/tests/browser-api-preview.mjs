import {chromium,expect} from '@playwright/test'
import {writeFile,mkdir} from 'node:fs/promises'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
await mkdir('review/api-preview',{recursive:true})
const zip=new JSZip()
zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>前端预览测试：合同金额壹佰万元。</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>')
const docx=await zip.generateAsync({type:'nodebuffer'})
const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['项目名称','金额'],...Array.from({length:120},(_,i)=>['测试项目'+(i+1),i+100])]),'项目台账');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['核验项目','金额'],...Array.from({length:120},(_,i)=>['核验项目'+(i+1),i+100])]),'核验明细');const xlsx=XLSX.write(wb,{type:'buffer',bookType:'xlsx'})
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(12000)
async function capture(path){await expect(page.locator('.el-loading-mask:visible')).toHaveCount(0);await page.screenshot({path,animations:'disabled'})}
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message))
const files=[{id:'word',file_name:'测试原件.docx',extension:'docx'},{id:'sheet',file_name:'测试台账.xlsx',extension:'xlsx'},{id:'pdf',file_name:'测试PDF.pdf',extension:'pdf'}].map(f=>({...f,folder_id:'f',parse_status:2,space_type:'PUBLIC',can_download:true}))
const bodies={docx,xlsx},downloads={};let failed=false
await page.route('**/fixtures/*',async route=>{const ext=route.request().url().split('.').pop();downloads[ext]=(downloads[ext]||0)+1;await route.fulfill({body:bodies[ext]||Buffer.from('%PDF-1.4\n%%EOF'),contentType:ext==='pdf'?'application/pdf':'application/octet-stream'})})
await page.route('**/api/**',async route=>{
 if(failed){await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:401,message:'登录已过期，请重新登录'})});return}
 const path=new URL(route.request().url()).pathname
 let data={}
 if(path.endsWith('/folders/tree'))data=[{id:'f',name:'验证目录',space_type:'PUBLIC'}]
 else if(path.endsWith('/files/by-space')||path.endsWith('/files'))data={files,total:files.length}
 else if(path.endsWith('/content'))data={content:'接口返回的真实形状测试解析文本'}
 else if(path.endsWith('/column-headers'))data={columns:['项目名称','金额'],sheet_names:['项目台账']}
 else if(path.includes('/preview')){const id=path.split('/')[5];const file=files.find(f=>f.id===id);data={url:'/fixtures/file.'+file.extension,mime_type:file.extension==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':file.extension==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',page_count:1}}
 await route.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data})})
})
try{
 await page.goto('http://localhost:4173/#/library');await expect(page.getByText('测试原件.docx',{exact:true})).toBeVisible();await expect(page.locator('.demo-badge')).toHaveCount(0)
 await page.getByText('测试原件.docx',{exact:true}).click();let dialog=page.getByRole('dialog',{name:'资料预览'});await expect(dialog.locator('.word-preview')).toContainText('合同金额壹佰万元');await expect(dialog.locator('.source-split .parsed-text')).toContainText('接口返回');const raw=await dialog.locator('.original-pane').boundingBox(),parsed=await dialog.locator('.parsed-pane').boundingBox();expect(parsed.x).toBeGreaterThanOrEqual(raw.x+raw.width-1);await capture('review/api-preview/docx.png');checks.push('生产模式DOCX真实字节渲染，原文件和解析文本并排展现');await dialog.locator('.el-dialog__headerbtn').click()
 await page.getByText('测试台账.xlsx',{exact:true}).click();dialog=page.getByRole('dialog',{name:'资料预览'});await expect(dialog.locator('.sheet-preview')).toContainText('121 行');await expect(dialog.locator('.el-table')).toContainText('项目名称');await dialog.locator('.sheet-preview .btn-next').click();await expect(dialog.locator('.el-table')).toContainText('测试项目50');await capture('review/api-preview/xlsx.png');checks.push('XLSX保留表头、解析121行并翻页');await dialog.locator('.sheet-controls .el-select').click();await page.getByRole('option',{name:'核验明细',exact:true}).click();await dialog.locator('.sheet-preview .btn-next').click();await expect(dialog.locator('.el-table')).toContainText('核验项目50');const downloaded=downloads.xlsx;await page.setViewportSize({width:600,height:700});await expect(dialog.locator('.source-tabs')).toBeVisible();await dialog.getByRole('button',{name:'解析文本',exact:true}).click();await expect(dialog.locator('.parsed-text')).toContainText('接口返回');await expect(dialog.locator('.original-pane')).not.toBeVisible();await page.setViewportSize({width:1440,height:1000});await expect(dialog.locator('.sheet-preview')).toContainText('121 行');await expect(dialog.locator('.parsed-text')).toBeVisible();checks.push('窄窗口改为页签，恢复宽屏后仍同时显示原文件与解析文本');await expect(dialog.locator('.sheet-controls .el-select')).toContainText('核验明细');await expect(dialog.locator('.el-table')).toContainText('核验项目50');expect(downloads.xlsx).toBe(downloaded);checks.push('切换窄屏和文本保持当前工作表及第2页，不重复下载原件');await dialog.locator('.el-dialog__headerbtn').click()
 await page.getByText('测试PDF.pdf',{exact:true}).click();dialog=page.getByRole('dialog',{name:'资料预览'});await expect(dialog.locator('iframe')).toHaveAttribute('src',/fixtures\/file.pdf#page=1/);checks.push('PDF预览URL与页码绑定成功（不作浏览器原生PDF渲染验收）');await dialog.locator('.el-dialog__headerbtn').click()
 failed=true;await page.reload();await expect(page.getByText('登录已过期，请重新登录').first()).toBeVisible();await expect(page.getByText('测试原件.docx',{exact:true})).toHaveCount(0);await expect(page.locator('.demo-badge')).toHaveCount(0);await capture('review/api-preview/unauthorized.png');checks.push('401显式错误，无演示数据或静默回退')
}catch(e){errors.push(String(e));await capture('review/api-preview/failure.png')}
await writeFile('review/api-preview/report.json',JSON.stringify({checks,errors,note:'请求使用本地响应夹具；不等同于真实后端、生产权限或CORS联调。'},null,2));console.log(JSON.stringify({checks,errors},null,2));await browser.close();if(errors.length)process.exitCode=1
