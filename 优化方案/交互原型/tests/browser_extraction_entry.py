"""Default extraction entry must stay editable; explicit task links retain immutable history."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle');g.evaluate('libraryStatusDataReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def menu():
  g.wait_for_timeout(100)
  if g.locator('.sidebar [data-action=open-tool][data-id=extract]').is_visible():g.locator('.sidebar [data-action=open-tool][data-id=extract]').click()
  else:
   g.locator('[data-action=mobile-nav]').click();g.locator('#modal-root [data-action=open-tool][data-id=extract]').click()
  g.wait_for_timeout(60)
 def prep():assert ev('currentTask()') is None;assert g.locator('.ef-preparing').is_visible();assert g.locator('.ef-config').is_visible();assert g.locator('[data-action=ef-field-add]').is_visible()
 prep();assert ev('ewConfig().template')=='';assert ev('ewConfig().fieldDefs')==[]
 # Real task + a different unsubmitted draft, then historical result -> menu.
 ev("loadSample();openModal('xt-apply',{id:'sys-extract'});xtApply();run()");g.wait_for_function("currentTask()?.status==='completed'");tid=ev('currentTask().id');snapshot=ev('JSON.stringify(currentTask())')
 ev("newAnalysis();ws().config.fieldDefs=[{name:'付款约定',description:'保留付款条款'}];ws().config.fields=['付款约定'];ws().config.template='';delete ws().config.extractionTemplateId;ws().ids=['d2'];ws().preview='d2';render()");draft=ev('JSON.stringify({ids:ws().ids,config:ws().config})')
 ev('id=>{nav("tasks");openTask(id)}',tid);g.wait_for_timeout(60);assert ev('currentTask().id')==tid;assert g.url.endswith('/'+tid);assert not g.locator('.ef-config').count()
 menu();prep();assert ev('JSON.stringify({ids:ws().ids,config:ws().config})')==draft;assert g.url.endswith('#tool/extract');assert ev('id=>JSON.stringify(state.tasks.find(t=>t.id===id))',tid)==snapshot
 checks.append('已复现的历史结果串入默认入口已修复；默认三栏可编辑，未提交资料/字段与原历史快照均保留')
 g.reload(wait_until='networkidle');ev('libraryStatusDataReady');prep();assert ev('JSON.stringify({ids:ws().ids,config:ws().config})')==draft
 # Explicit history URL refresh/back/forward must still show the requested result.
 ev('id=>{nav("tasks");openTask(id)}',tid);g.wait_for_timeout(60);g.reload(wait_until='networkidle');ev('libraryStatusDataReady');assert ev('currentTask().id')==tid;assert g.locator('.ef-task').is_visible();g.go_back(wait_until='networkidle');assert ev('state.view')=='tasks';g.go_forward(wait_until='networkidle');assert ev('currentTask().id')==tid
 checks.append('默认地址刷新保留草稿；任务结果使用明确任务地址，刷新/后退/前进仍正确回看，不多插入中间页')
 # Library selected files replace the material range only, using the saved preparation configuration.
 ev("nav('library');state.librarySelected=['d1','d3'];render()");menu();prep();assert ev('ws().ids')==['d1','d3'];assert ev('JSON.stringify(ws().config)')==json.dumps(json.loads(draft)['config'],ensure_ascii=False,separators=(',',':'))
 checks.append('从资料管理带入选择时沿用准备配置，不能把历史模板和只读状态带进来')
 # Existing old browser storage can have a historical task with no saved draft.
 ev("id=>{openTask(id);delete ws().preparationDraft;persist();history.replaceState(null,'','#tool/extract')}",tid);g.reload(wait_until='networkidle');ev('libraryStatusDataReady');prep();assert ev('ewConfig().template')=='';assert ev('ewConfig().fieldDefs')==[];assert ev('state.tasks.length')==1
 checks.append('兼容旧浏览器保存的历史 taskId，默认入口恢复空模板准备页，历史任务不删除')
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});ev("nav('tasks')");menu();assert ev('currentTask()') is None;assert ev('document.documentElement.scrollWidth')<=w
  if w>=901:assert g.locator('.ef-config').is_visible();assert g.locator('.ef-preview').is_visible();assert g.locator('.ew-materials').is_visible()
  else:assert ev('efView.panel')=='materials';assert g.locator('.ew-materials').is_visible()
  g.screenshot(path=str(root/f'review/extract-default-restored-{w}.png'),animations='disabled')
 assert not errors,errors;checks.append('1366/1024×480恢复三栏，窄屏从Step 1资料开始，模板继续默认不选')
 (root/'review/extract-entry-checks.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
