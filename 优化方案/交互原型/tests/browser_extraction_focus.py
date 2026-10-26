"""Audit preparation: original and editable rules remain visible together."""
import json,pathlib,tempfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];errors=[];checks=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1440,'height':900},accept_downloads=True,reduced_motion='reduce');pg.set_default_timeout(10000);pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle');pg.evaluate('libraryStatusDataReady')
 def ev(s,arg=None):return pg.evaluate(s,arg)
 def click(a):
  target=pg.locator('[data-action="'+a+'"]:visible')
  if not target.count() and pg.locator('.uc-command-more>summary:visible').count():pg.locator('.uc-command-more>summary:visible').click()
  pg.locator('[data-action="'+a+'"]:visible').last.click()
 def ready(kind):pg.wait_for_function("kind=>document.querySelector('#ef-raw-content')?.dataset.rawReady===kind",arg=kind)
 assert pg.locator('.ef-empty').is_visible();assert not pg.locator('[data-action="run"]').is_enabled()
 assert pg.locator('[data-xt-change=template]').input_value()=='';assert ev('ewConfig().fieldDefs.length')==0
 pg.locator('[data-xt-change=template]').select_option('sys-extract');click('xt-apply-confirm')
 click('add-tool-materials');assert ev("modal==='picker'");ev("modalData.space=file('d1').space;modalData.folder=file('d1').folder;paintModal()");click('audit-picker-upload');assert pg.locator('#folder-input').get_attribute('webkitdirectory') is not None;assert pg.locator('#upload-input').count();pg.keyboard.press('Escape');pg.keyboard.press('Escape')
 ev("ws().ids=['d1','d2','d3'];ws().preview='d1';render()");ready('pdf');assert not ev('modal');assert pg.locator('#ef-field-0').is_visible()
 ev("ws().config.backendTemplateId='mapped-template';ws().config.backendTemplateFields=JSON.stringify(ws().config.fieldDefs);efCommit()");assert ev('ewExecConfig(ws().config).exec_mode')=='template'
 ev("window.savedCanvas=document.querySelector('#ef-raw-content canvas');window.savedPDF=activeFilePreview.pdf;document.querySelector('#ef-raw-content').scrollTop=75")
 pg.locator('#ef-field-0').fill('合同名称');pg.locator('[data-ef-input="description"]').first.fill('提取合同完整名称');assert ev('savedCanvas===document.querySelector("#ef-raw-content canvas")');assert ev('savedPDF===activeFilePreview.pdf');assert ev('ws().config.fieldDefs[0].name')=='合同名称'
 assert not pg.locator('.ef-config input[type=checkbox][data-ef-change]').count();assert ev('configurationFragment("extract",ws().config).custom_config.fields.length')==4;ev("ws().config.extractionFieldChoices={fingerprint:JSON.stringify(ws().config.fieldDefs),fields:[...ws().config.fieldDefs,{name:'旧未勾选字段',description:'',enabled:false}]};render()");assert ev('efChoices().length')==4
 pg.reload(wait_until='networkidle');ev('libraryStatusDataReady');ready('pdf');assert pg.locator('#ef-field-0').input_value()=='合同名称'
 pg.locator('[data-action=ef-remove-material][data-id=d2]').click();assert ev('ws().ids')==['d1','d3'];assert not ev("file('d2').deleted===true");pg.locator('#undo-toast').click();assert ev('ws().ids.length')==3
 assert not pg.locator('[data-action=ew-manage],[data-ew-change=work-check]').count()
 assert pg.locator('.ew-panel-head h2').all_text_contents()==['Step 1添加资料','Step 2查看原文','Step 3设置提取字段']
 pg.locator('[data-action=ef-remove-material][data-id=d3]').click();assert ev('ws().ids.length')==2;assert ev("file('d3').deleted") is not True;pg.locator('#undo-toast').click();assert ev('ws().ids.length')==3
 pg.locator('#ef-field-1').fill('合同名称');assert '重复' in pg.locator('#ef-field-error').inner_text();click('run');assert ev("modal==='validation'");pg.keyboard.press('Escape');assert pg.locator('#ef-field-0').evaluate('(el)=>el===document.activeElement');pg.locator('#ef-field-1').fill('涉及单位')
 click('ef-field-add');pg.locator('#ef-field-4').fill('验收要求');pg.locator('[data-ef-input="description"]').last.fill('提取验收条款');pg.locator('.ef-field-menu>summary').last.click();click('ef-field-up');assert ev('ws().config.fields[3]')=='验收要求';pg.locator('.ef-field-menu>summary').last.click();click('ef-field-remove');assert ev('efChoices().length')==4;pg.locator('#undo-toast').click();assert ev('efChoices().length')==5
 checks.append('默认原件与字段同屏；输入不重载PDF；取消字段勾选，字段名称校验/增删/排序/撤销/刷新持久化；全部当前字段进入原请求结构')
 # Source modal still has both original and parsed columns; attachment return chain survives.
 click('source');pg.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady==='pdf'");assert pg.locator('#preview-parsed-content').is_visible();pg.keyboard.press('Escape');ready('pdf');assert pg.locator('#ef-field-0').is_visible()
 pg.locator('.ef-material-attachments[data-id=d1]').click();assert ev("modal==='attachments'&&modalData.id==='d1'");assert pg.locator('[aria-label="提取时包含附件内容"]').is_visible();click('source');pg.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady==='pdf'");pg.keyboard.press('Escape');assert ev("modal==='attachments'");pg.keyboard.press('Escape');ready('pdf')
 # Link attachments from a non-previewed file. Confirming saves the association, not a new main file.
 before_ids=ev('JSON.stringify(ws().ids)');before_links=ev("JSON.stringify(file('d2').attachments||[])")
 pg.locator('.ef-material-attachments[data-id=d2]').click();assert ev("modalData.id==='d2'&&ws().preview==='d1'");click('pick-attachment');assert ev("modal==='ef-select-attachments'&&modalData.id==='d2'")
 pg.locator('[data-ea-change=file][data-id=d3]').check();click('ea-confirm');assert ev("file('d2').attachments")==['d3'];assert ev('JSON.stringify(ws().ids)')==before_ids;assert ev("ws().preview==='d1'")
 pg.locator('[aria-label="提取时包含附件内容"]').check();assert ev('ws().config.merge');assert '本次全部资料' in pg.locator('.ef-attachment-option').inner_text();click('unlink-attachment');assert not ev("file('d2').attachments.length");assert not ev("file('d3').deleted");pg.keyboard.press('Escape');ready('pdf')
 ev("links=>{file('d2').attachments=JSON.parse(links);persist();render()}",before_links)
 checks.append('三栏操作指引；去掉批量移除和加入目录；逐份资料可关联附件，附件不混入主文件范围，合并设置明确适用于全部资料，解除不删原件')
 # Original Word, spreadsheet and text use actual bytes, not parsed placeholders.
 for ext,kind in [('docx','docx'),('xlsx','table'),('txt','text')]:
  fid=ev("ext=>Object.keys(AUDIT_SOURCE_ASSETS).find(id=>file(id)&&AUDIT_SOURCE_ASSETS[id].path.endsWith('.'+ext)&&auditFileAccess(file(id)).preview)",ext);assert fid
  ev("id=>{ws().ids=[...new Set([...ws().ids,id])];ws().preview=id;render()}",fid);ready(kind)
  if ext=='docx':assert pg.locator('#ef-raw-content iframe').get_attribute('sandbox')=='allow-scripts'
 ev("ws().preview='d1';render()");ready('pdf');pg.locator('[data-action="ef-preview-tab"][data-tab="parsed"]').click();assert pg.locator('#ef-parsed-content').is_visible();assert pg.locator('#ef-raw-content').is_hidden();pg.locator('[data-action="ef-preview-tab"][data-tab="original"]').click();ready('pdf')
 pg.locator('.ef-preview-menu>summary').click()
 with pg.expect_download() as dl:click('ef-download-original')
 assert dl.value.suggested_filename=='设备采购合同.pdf'
 pg.locator('.ef-preview-menu>summary').click();click('ef-refresh-original');ready('pdf')
 assert not pg.locator('.ef-config [data-action="v2-export-config"],.ef-config [data-action="xt-export"],.ef-config [data-action="ew-import"],.ef-config [data-action="xt-delete"]').count()
 pg.locator('.ef-settings>summary').click();pg.locator('[data-config="merge"]').check();assert ev('ws().config.merge');assert pg.locator('[aria-label="切片字数"]').is_visible();pg.locator('[data-config="chunk"]').fill('12000');pg.locator('[data-config="chunk"]').press('Tab');pg.locator('.ef-settings>summary').click()
 checks.append('真实PDF/Word/Excel/文本内嵌预览、原件/解析切换、双栏放大核对、关联附件预览返回、合并及原分段参数；模板管理操作已归位')
 # Saving many adjusted fields is a compact personal save-as, preserving the original.
 original=ev('JSON.stringify(xtFind(ws().config.extractionTemplateId)||xtAll().find(t=>t.name===ws().config.template))');rules=ev('JSON.stringify(ws().config.fieldDefs)');count=ev('xtAll().length')
 click('ef-save-template');assert ev("modal==='ef-save-template'");assert not pg.locator('.xt-editor-table-scroll').count();pg.locator('#xt-template-name').fill('');click('ef-confirm-save-template');assert '名称' in pg.locator('#xt-editor-error').inner_text();pg.locator('#xt-template-name').fill('合同审计常用要素');pg.locator('[data-ef-save=description]').fill('合同名称、参与单位与验收口径');click('ef-confirm-save-template');assert not ev('modal');assert ev('xtAll().length')==count+1;assert ev("JSON.stringify(xtFind(ws().config.extractionTemplateId).rules)")==rules;assert not ev('xtFind(ws().config.extractionTemplateId).system')
 saved=ev('ws().config.extractionTemplateId');click('ef-save-template');pg.locator('#xt-template-name').fill('合同审计常用要素');click('ef-confirm-save-template');assert '同名' in pg.locator('#xt-editor-error').inner_text();pg.keyboard.press('Escape');assert ev('xtAll().length')==count+1;pg.reload(wait_until='networkidle');ev('libraryStatusDataReady');assert ev('id=>!!xtFind(id)',saved);assert ev('JSON.stringify(ws().config.fieldDefs)')==rules;ready('pdf')
 checks.append('另存个人模板常驻可见；只填写名称/分类/描述，保留全部字段及说明；必填/同名校验、取消不写入、保存后选择和刷新复用')
 # Template change is explicit and cancel preserves local edits.
 before=ev('JSON.stringify(ws().config.fieldDefs)');pg.locator('[data-xt-change="template"]').select_option('xt-sys-invoice');assert ev("modal==='xt-apply'");pg.keyboard.press('Escape');assert ev('JSON.stringify(ws().config.fieldDefs)')==before
 expected=ev("xtAppliedFields(xtFind('xt-sys-invoice')).length");pg.locator('[data-xt-change="template"]').select_option('xt-sys-invoice');click('xt-apply-confirm');assert ev('ws().config.fieldDefs.length')==expected;assert ev('efChoices().length')==expected;assert ev("document.querySelector('.ef-fields-scroll').scrollTop")==0
 c=ev('JSON.stringify(ws().config.fieldDefs)');ev("file('d1').can_preview=false;render()");assert not pg.locator('#ef-raw-content canvas').count();assert '权限' in pg.locator('#ef-raw-content').inner_text();ev("delete file('d1').can_preview;render()");ready('pdf')
 # Dense layouts retain independent scrolling and visible execution. Mobile uses three explicit panels.
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  pg.set_viewport_size({'width':w,'height':h});ev('render()');pg.wait_for_timeout(150)
  if w<901:click('ef-panel') # last is fields
  r=ev("({left:document.querySelector('.ew-materials').clientWidth,right:document.querySelector('.ef-config').clientWidth,width:innerWidth,scroll:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,fields:document.querySelector('.ef-fields-scroll').clientHeight,preview:document.querySelector('.ef-preview-content').clientHeight,run:document.querySelector('[data-action=run]').getBoundingClientRect().toJSON()})");assert r['scroll']<=w and r['height']==h,r;assert r['run']['bottom']<=h;r['font']=ev("getComputedStyle(document.querySelector('#ef-field-0')).fontSize");assert r['font']=='16px'
  if w>=901:assert r['preview']>=250 and r['fields']>=180 and abs(r['left']-r['right'])<=1,r
  pg.screenshot(path=str(root/f'review/extract-focus-{w}.png'),animations='disabled');layouts.append(r)
  if w<901:
   pg.locator('[data-action="ef-panel"][data-panel="preview"]').click();assert pg.locator('.ef-preview').is_visible();pg.locator('[data-action="ef-panel"][data-panel="materials"]').click();assert pg.locator('.ew-materials').is_visible();pg.locator('[data-action="ef-panel"][data-panel="fields"]').click()
 pg.set_viewport_size({'width':1366,'height':768});ev('render()');assert not pg.locator('[data-action=ew-manage]').count();click('run');assert ev("modal==='ew-submit'");click('ew-submit-confirm');pg.wait_for_function("currentTask()?.status==='completed'");assert not pg.locator('.ew-managebar,[data-ew-change=work-check]').count();assert not ev('manage');assert ev('JSON.stringify(currentTask().config.fieldDefs)')==c;assert ev('currentTask().result.every(r=>r.items.length===currentTask().config.fieldDefs.length)');snap=ev('JSON.stringify(currentTask().config)');click('ew-config');assert pg.locator('#ef-field-0').get_attribute('readonly') is not None;assert not pg.locator('[data-action=ef-save-template]').count();ev('render()');assert ev('JSON.stringify(currentTask().config)')==snap
 click('export');pg.locator('#ew-export-format').select_option('json')
 with pg.expect_download() as dl:click('do-export')
 with tempfile.TemporaryDirectory() as tmp:
  f=pathlib.Path(tmp)/'result.json';dl.value.save_as(f);assert len(json.loads(f.read_text())['config']['fieldDefs'])==expected
 checks.append('模板切换取消/确认、预览权限动态撤销、四尺寸独立滚动及移动端面板、按全部字段批量执行、结果导出与只读历史快照')
 assert not errors,errors;(root/'review/extract-focus-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False));b.close()
