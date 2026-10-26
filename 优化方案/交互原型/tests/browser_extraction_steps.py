"""Extraction steps, scoped attachment association, and ready-only selection."""
import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];errors=[];checks=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle');g.evaluate('libraryStatusDataReady')
 def ev(s,arg=None):return g.evaluate(s,arg)
 def action(a):g.locator('[data-action="'+a+'"]:visible').last.click()
 ev("ws().ids=['d1','d2','d3'];ws().preview='d1';render()")
 assert g.locator('.ef-material-head [data-action=add-tool-materials]').is_visible();assert not g.locator('.ew-material-controls [data-action=add-tool-materials]').count()
 # Add a folder containing both genuine status cases and a failed document with local=false.
 ev("state.docs.push({...structuredClone(file('d1')),id:'ready-failed-persistent',space:'项目空间',folder:'合同资料/资料接收',name:'识别失败但已上传.pdf',local:false,content_status:'failed',parseError:'识别失败'});render()")
 action('add-tool-materials');ev("modalData.space='项目空间';modalData.folder='合同资料/资料接收';modalData.recursive=true;modalData.selected=[];paintModal()")
 assert '仅可选择解析完成' in g.locator('.picker-ready-note').inner_text()
 statuses=ev('pickerItems().filter(i=>i.kind===\'file\').map(i=>libStatus(i.file))');assert '解析完成' in statuses and len(set(statuses))>=4,statuses
 g.locator('[data-change=picker-page]').check();assert ev('modalData.selected.every(id=>libReady(file(id)))')
 action('picker-all');assert ev('modalData.selected.length')==1;assert ev('modalData.selected.every(id=>libReady(file(id)))')
 ev("modalData.selected=['ready-failed-persistent'];paintModal()");action('confirm-picker');assert ev("modal==='picker'");assert ev("ws().ids")==['d1','d2','d3'];assert not ev('modalData.selected.length')
 ev("modalData.selected=[];modalData.page=1;paintModal()");assert g.locator('[data-change=picker-check]:disabled').count()>=4
 g.screenshot(path=str(root/'review/extract-picker-ready-only.png'),animations='disabled');action('picker-all')
 # State changes after selection are checked again at confirmation, preserving main scope.
 selected=ev('modalData.selected[0]');ev("id=>{file(id).content_status='processing';file(id).local=true}",selected);action('confirm-picker');assert ev("modal==='picker'");assert ev('ws().ids')==['d1','d2','d3'];ev("id=>{file(id).content_status='done';file(id).local=false}",selected);g.keyboard.press('Escape')
 checks.append('解析完成提示；上传中/排队/解析中/失败均展示但禁选；单项、本页、全部页、确认与状态变化统一校验，取消不改原范围')
 # Public documents may be used in tool association without receiving directory editing rights.
 public=ev("state.docs.find(d=>d.space==='公共空间'&&libReady(d)&&auditFileAccess(d).analyze&&!auditFileAccess(d).attachments).id")
 ev("id=>{ws().ids=[id,'d1','d2','d3'];ws().preview='d1';file(id).attachments=[];render()}",public)
 link=g.locator('.ef-material-attachments[data-id="'+public+'"]');assert '关联' in link.get_attribute('aria-label');assert not ev('id=>auditFileAccess(file(id)).rename',public)
 link.click();action('pick-attachment');assert ev("modal==='ef-select-attachments'");assert set(ev('eaCandidates().map(d=>d.id)'))=={'d1','d2','d3'}
 g.locator('#ea-query').fill('设备');g.locator('[data-ea-change=file][data-id=d1]').check();g.locator('#ea-query').fill('会议');g.locator('[data-ea-change=file][data-id=d3]').check();assert ev('modalData.selected.length')==2;g.keyboard.press('Escape');assert ev("modal==='attachments'");assert ev('id=>file(id).attachments.length',public)==0
 action('pick-attachment');g.locator('[data-ea-change=file][data-id=d1]').check();g.locator('[data-ea-change=file][data-id=d3]').check();action('ea-confirm');assert ev("modal==='attachments'");assert ev('id=>file(id).attachments',public)==['d1','d3'];assert ev("ws().preview==='d1'");assert not ev('id=>auditFileAccess(file(id)).rename',public);g.keyboard.press('Escape')
 # Already-linked files and the current main file cannot be added again. Explicit permissions rechecked.
 link.click();action('pick-attachment');assert ev('eaCandidates().map(d=>d.id)')==['d2'];g.locator('[data-ea-change=file][data-id=d2]').check();ev('id=>file(id).can_manage_attachments=false',public);action('ea-confirm');assert '权限' in g.locator('#ea-error').inner_text();assert ev('id=>file(id).attachments',public)==['d1','d3'];g.keyboard.press('Escape');g.keyboard.press('Escape');assert '查看' in g.locator('.ef-material-attachments[data-id="'+public+'"]',).get_attribute('aria-label');ev('id=>{delete file(id).can_manage_attachments;render()}',public)
 checks.append('公共资料关联不借用目录编辑权限；候选限已添加资料，排除自身/已关联，中文搜索多选、取消与追加确认；明确禁止权限在提交时复查')
 # Opening a selected folder exposes that folder's candidates as the original UI does.
 ev("efView.attachmentScope={space:'项目空间',path:'合同资料/设备采购/技术附件'};render()")
 g.locator('.ef-material-attachments[data-id=d2]').click();action('pick-attachment');assert 'd12' in ev('eaCandidates().map(d=>d.id)');g.locator('[data-ea-change=file][data-id=d12]').check()
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});r=g.locator('.ea-dialog').bounding_box();assert r['y']>=0 and r['y']+r['height']<=h+1,r;assert g.locator('.ea-table-scroll').bounding_box()['height']>=80;g.screenshot(path=str(root/f'review/extract-associate-{w}.png'),animations='disabled')
 g.keyboard.press('Escape');g.keyboard.press('Escape');ev("ws().ids=['d1','d2','d3'];ws().preview='d1';render()")
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});ev('render()');g.wait_for_timeout(200)
  if w<901:g.locator('[data-action=ef-panel][data-panel=fields]').click()
  assert ev('document.documentElement.scrollWidth')<=w;assert ev('document.documentElement.scrollHeight')==h
  if w>=901:
   for selector in ['.ef-preview-head','.ef-preview-caption','.ef-material-head','.ef-config>.ew-panel-head']:
    r=ev('s=>({w:document.querySelector(s).clientWidth,scroll:document.querySelector(s).scrollWidth,h:document.querySelector(s).clientHeight})',selector);assert r['scroll']<=r['w'],[w,selector,r]
  g.screenshot(path=str(root/f'review/extract-steps-{w}.png'),animations='disabled');layouts.append({'w':w,'h':h})
 checks.append('已打开目录候选、三尺寸关联弹窗、四尺寸Step标题与合并添加入口；独立滚动、无整页/步骤栏横向溢出')
 assert not errors,errors;(root/'review/extract-steps-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
