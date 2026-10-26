import json,pathlib,re,zipfile,io
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];errors=[];checks=[];banned=re.compile('演示|虚构|原型|示例|模拟|未接入|未连接')
def check_copy(page,label):
 text=page.locator('body').inner_text();bad=banned.search(text);assert not bad,(label,text[max(0,bad.start()-60):bad.end()+100] if bad else '')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle')
 check_copy(page,'initial')
 assert page.locator('.shell.nav-expanded').count()==1
 page.locator('[data-action="toggle-sidebar"]').click();assert page.locator('.shell.nav-collapsed').count()==1
 assert page.locator('[data-action="toggle-sidebar"]').get_attribute('aria-expanded')=='false'
 assert page.locator('.sidebar').bounding_box()['width']==64
 page.goto('http://127.0.0.1:8765/#templates');assert page.locator('.shell.nav-collapsed').count()==1
 page.reload();assert page.locator('.shell.nav-collapsed').count()==1
 page.locator('[data-action="toggle-sidebar"]').click();assert page.locator('.sidebar').bounding_box()['width']==192
 checks.append('菜单展开/折叠、图标提示、跨页面与刷新保存状态')
 page.goto('http://127.0.0.1:8765/#library');page.locator('[data-action="folder"][data-id="合同资料"]').first.click();page.locator('[data-action="upload"]').click()
 content='工程验收记录\n2026年10月18日完成设备验收，合同金额128万元。\n应补充验收签字记录。'
 page.locator('#upload-input').set_input_files({'name':'上传验收记录.txt','mimeType':'text/plain','buffer':content.encode()})
 page.wait_for_function("state.uploads[0].status==='可分析'")
 assert page.evaluate("state.docs.find(d=>d.name==='上传验收记录.txt').text")==content
 check_copy(page,'upload complete');page.keyboard.press('Escape')
 page.goto('http://127.0.0.1:8765/#tool/extract');page.locator('.workset-top [data-action="picker"]').click()
 page.locator('[data-v3-change="picker-scope"]').select_option('recursive');page.locator('#picker-query').fill('上传验收记录');page.locator('[data-change="picker-check"]').check();page.locator('[data-action="confirm-picker"]').click()
 assert page.locator('.document').get_by_text('应补充验收签字记录。',exact=True).is_visible()
 page.locator('[data-action="run"]').click();page.wait_for_function("currentTask().status==='completed'")
 assert page.evaluate('currentTask().successIds.length')==1
 checks.append('实际文本上传、解析、选择、原文与分析流程衔接')
 # Parse a real text PDF without installing a Python PDF library.
 stream=b'BT /F1 12 Tf 72 720 Td (Audit acceptance record) Tj ET'
 objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream']
 pdf=b'%PDF-1.4\n';offsets=[0]
 for i,obj in enumerate(objects,1):offsets.append(len(pdf));pdf+=str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
 start=len(pdf);pdf+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join((str(n).zfill(10)+' 00000 n \n').encode() for n in offsets[1:])+b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+str(start).encode()+b'\n%%EOF'
 page.goto('http://127.0.0.1:8765/#library');page.locator('[data-action="folder"][data-id="合同资料"]').first.click();page.locator('[data-action="upload"]').click();page.locator('#upload-input').set_input_files({'name':'acceptance.pdf','mimeType':'application/pdf','buffer':pdf})
 page.wait_for_function("state.uploads[0].status==='可分析'")
 assert 'Audit acceptance record' in page.evaluate("state.docs.find(d=>d.name==='acceptance.pdf').text")
 page.keyboard.press('Escape');checks.append('文本PDF逐页解析与来源保留')
 # Local DOCX and XLSX parsers use actual generated files.
 docx=io.BytesIO()
 with zipfile.ZipFile(docx,'w') as z:z.writestr('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>验收记录归档完成</w:t></w:r></w:p></w:body></w:document>')
 page.goto('http://127.0.0.1:8765/#library');page.locator('[data-action="folder"][data-id="合同资料"]').first.click();page.locator('[data-action="upload"]').click();page.locator('#upload-input').set_input_files({'name':'验收文档.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':docx.getvalue()})
 page.wait_for_function("state.uploads[0].status!=='正在解析'&&state.uploads[0].progress===100")
 assert page.evaluate("state.docs.find(d=>d.name==='验收文档.docx').text")=='验收记录归档完成'
 xbytes=page.evaluate("()=>{const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['项目名称','投资金额'],['设备采购',128]]),'台账');return [...new Uint8Array(XLSX.write(w,{bookType:'xlsx',type:'array'}))];}")
 page.locator('#upload-input').set_input_files({'name':'上传台账.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':bytes(xbytes)})
 page.wait_for_function("state.uploads[0].status==='可分析'")
 assert page.evaluate("state.docs.find(d=>d.name==='上传台账.xlsx').columns")==['项目名称','投资金额']
 assert page.evaluate("state.docs.find(d=>d.name==='上传台账.xlsx').rows[0]")==['设备采购','128']
 page.keyboard.press('Escape');checks.append('Word与Excel真实内容解析、表头与源行保留')
 for tid in ['extract','word','theme','timeline','risk','meeting','contract','bidding','prepaid','engineering','association']:
  page.goto('http://127.0.0.1:8765/#tool/'+tid)
  if page.locator('[data-action="new-analysis"]').count():page.locator('[data-action="new-analysis"]').click()
  page.evaluate('loadSample()');check_copy(page,tid+' ready')
  if tid!='word':
   page.locator('[data-action="prompt"]').first.click();check_copy(page,tid+' prompt');page.keyboard.press('Escape')
  if tid=='extract':
   page.locator('[data-action="edit-fields"]').click();assert page.locator('[data-edit="0.description"]').is_visible();check_copy(page,'fields');page.keyboard.press('Escape')
  if tid in ['contract','risk']:
   page.locator('[data-action="v2-rules"]').click();check_copy(page,tid+' rules');page.keyboard.press('Escape')
  if tid=='engineering':
   for kind in ['duplicate','parent']:
    page.locator('[data-action="v2-engineering"][data-kind="'+kind+'"]').click();assert page.locator('[data-edit="threshold"]').count()==1;assert page.locator('[data-edit="additional"]').count()==1;check_copy(page,kind);page.keyboard.press('Escape')
  if tid=='association':
   page.locator('[data-action="v2-association"]').first.click();assert page.locator('[data-action="v4-reset-mapping"]').is_visible();assert page.locator('[data-edit^="locks."]').count()==4;check_copy(page,'association config');page.keyboard.press('Escape')
  page.locator('[data-action="run"]').click();page.wait_for_function("currentTask().status!=='running'");check_copy(page,tid+' result')
  assert page.evaluate("currentTask().status") in ['completed','awaiting']
  if tid=='meeting':
   page.locator('[data-action="export"]').click();page.locator('#export-format').select_option('xlsx')
   with page.expect_download() as d:page.locator('[data-action="do-export"]').click()
   xf=root/'review/v4-meeting-results.xlsx';d.value.save_as(str(xf));assert zipfile.is_zipfile(xf)
   page.locator('[data-action="new-analysis"]').click();page.locator('[data-action="v3-meeting-import"]').click();page.locator('#meeting-import-file').set_input_files(str(xf));page.wait_for_function("document.querySelector('#meeting-import-preview').textContent.includes('校验通过')")
   page.locator('[data-action="v3-meeting-import-save"]').click();assert page.evaluate('currentTask().result.length')==6
   imported=page.evaluate('currentTask().id');page.goto('http://127.0.0.1:8765/#tasks');page.locator('[data-action="open-task"][data-id="'+imported+'"]').first.click();page.locator('[data-action="new-analysis"]').click();check_copy(page,'imported task restore')
 checks.append('11工具配置与结果文案、字段/规则/阶段/锁定保留，Excel导入导出及导入任务恢复')
 for idx,expected in enumerate([15000,18000,8000,120000,85000,48000]):
  page.goto('http://127.0.0.1:8765/#tool/prepaid')
  if page.locator('[data-action="new-analysis"]').count():page.locator('[data-action="new-analysis"]').click()
  page.locator('[data-config="feeType"]').select_option(index=idx);page.evaluate('loadSample()');page.locator('[data-action="run"]').click();page.wait_for_function("currentTask().status==='awaiting'")
  page.locator('#fee-base').fill('1000000');page.locator('[data-action="calculate-fee"]').click();page.wait_for_function("currentTask().status==='completed'")
  assert page.evaluate('currentTask().fee')==expected,(idx,page.evaluate('currentTask().fee'))
  check_copy(page,'fee'+str(idx));assert str(expected) in page.evaluate("reportText(currentTask(),'费用计算报告')")
 checks.append('六类费用分别依据合同百分比/固定总价计算，计算报告保留对应约定')
 for width,height in [(1366,768),(1024,600),(390,844)]:
  page.set_viewport_size({'width':width,'height':height})
  for route in ['library','tasks','templates','tool/extract','tool/bidding','tool/association']:
   page.goto('http://127.0.0.1:8765/#'+route);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route);check_copy(page,(width,route))
  if width>540:
   page.locator('[data-action="toggle-sidebar"]').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(root/f'review/v4-collapsed-{width}.png'),animations='disabled');page.locator('[data-action="toggle-sidebar"]').click()
 page.set_viewport_size({'width':1366,'height':768});page.goto('http://127.0.0.1:8765/#tool/extract');page.screenshot(path=str(root/'review/v4-01-信息提取.png'),animations='disabled')
 page.goto('http://127.0.0.1:8765/#library');page.screenshot(path=str(root/'review/v4-02-资料管理.png'),animations='disabled');page.locator('[data-action="help"]').first.click();check_copy(page,'help')
 checks.append('桌面、1024低分辨率与手机无整页溢出，展开/折叠布局稳定')
 page.keyboard.press('Escape');page.goto('http://127.0.0.1:8765/#tool/prepaid');page.locator('[data-action="new-analysis"]').click();page.locator('[data-config="feeType"]').select_option('工程设计费')
 assert page.evaluate('ws().config.stages.agreement.template').startswith('工程设计费')
 page.locator('[data-action="v2-stage"][data-stage="agreement"]').click();page.locator('#prompt-editor').fill('保留自定义设计费提取要求');page.locator('[data-action="v2-save-editor"]').click();page.locator('[data-config="feeType"]').select_option('招标代理费')
 assert page.evaluate('ws().config.stages.agreement.content')=='保留自定义设计费提取要求'
 checks.append('费用类型自动选择阶段提示词，手工修改内容在切换费用类型后保留')
 b.close()
(root/'review/product-v4-results.json').write_text(json.dumps({'checks':checks,'browser_errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'browser_errors':errors},ensure_ascii=False));assert not errors
