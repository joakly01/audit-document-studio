import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];errors=[];checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce')
 page.on('pageerror',lambda e:errors.append(str(e)))
 for tid in ['word','extract','theme','timeline','risk','meeting','contract','bidding','prepaid','engineering','association']:
  page.goto('http://127.0.0.1:8765/#tool/'+tid,wait_until='networkidle')
  page.locator('[data-action="add-tool-materials"]').click()
  if tid=='association':page.locator('[data-action="pick-table"][data-slot="A"]').last.click()
  assert page.evaluate("modal==='picker'"),tid
  page.keyboard.press('Escape');page.evaluate('loadSample()');page.locator('[data-action="run"]').click()
  page.wait_for_function("currentTask()&&currentTask().status!=='running'")
  original=page.evaluate('structuredClone(currentTask())')
  if tid!='association':assert page.locator('.workset-top [data-action="picker"]').is_visible(),tid
  page.locator('[data-action="full-result"]').click()
  page.locator('[data-action="add-tool-materials"]').click()
  if tid=='association':page.locator('[data-action="pick-table"][data-slot="A"]').last.click()
  assert page.evaluate('modalData.newAnalysisOnConfirm'),tid
  page.keyboard.press('Escape')
  assert page.evaluate('currentTask().id')==original['id'],tid
  assert page.evaluate('currentTask().ids')==original['ids'],tid
  page.locator('[data-action="add-tool-materials"]').click()
  if tid=='association':
   page.locator('[data-action="pick-table"][data-slot="A"]').last.click();page.locator('[data-action="picker-folder"][data-id="项目台账"]').first.click();page.locator('[data-change="picker-check"][data-id="d10"]').check()
  elif tid=='engineering':
   page.locator('[data-action="picker-folder"][data-id="项目台账"]').first.click();page.locator('[data-change="picker-check"][data-id="d11"]').check()
  elif tid=='meeting':
   page.locator('[data-action="picker-folder"][data-id="合同资料"]').first.click();page.locator('[data-change="picker-check"][data-id="d1"]').check()
  elif tid=='bidding':
   page.locator('[data-action="picker-folder"][data-id="合同资料"]').first.click();page.locator('[data-change="picker-check"][data-id="d1"]').check()
  else:
   page.locator('[data-v3-change="picker-scope"]').select_option('recursive');page.locator('#picker-query').fill('设备技术附件');page.locator('[data-change="picker-check"][data-id="d12"]').check()
  page.locator('[data-action="confirm-picker"]').click()
  assert page.evaluate('currentTask()===undefined'),tid
  saved=page.evaluate("state.tasks.find(t=>t.id==='"+original['id']+"')")
  assert saved['ids']==original['ids'] and saved['result']==original['result'],tid
  assert not page.evaluate('fullResult'),tid
  if tid=='association':assert page.evaluate('ws().tableA')=='d10'
  elif tid=='engineering':assert page.evaluate("ws().ids.includes('d11')")
  elif tid in ['meeting','bidding']:assert page.evaluate("ws().ids.includes('d1')")
  else:assert page.evaluate("ws().ids.includes('d12')")
  if tid=='bidding':assert page.evaluate("ws().unassigned.includes('d1')")
  checks.append(tid+'：准备、历史结果、宽屏均能添加；取消保留任务，确认保留历史并准备新分析')
 page.goto('http://127.0.0.1:8765/#tool/word');page.locator('[data-action="run"]').click()
 # Adding while the old task runs must not stop or mutate that task.
 running=page.evaluate('currentTask().id');page.locator('[data-action="add-tool-materials"]').click();page.locator('[data-action="confirm-picker"]').click()
 assert page.evaluate("state.tasks.find(t=>t.id==='"+running+"').status")=='running'
 page.wait_for_function("state.tasks.find(t=>t.id==='"+running+"').status==='completed'")
 checks.append('运行中追加新分析不停止原任务')
 for width,height in [(1366,768),(1024,600),(390,844)]:
  page.set_viewport_size({'width':width,'height':height});page.goto('http://127.0.0.1:8765/#tool/word')
  assert page.locator('[data-action="add-tool-materials"]').is_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.screenshot(path=str(root/('review/add-materials-'+str(width)+'.png')),animations='disabled',full_page=True)
 checks.append('1366/1024/390宽度顶部入口可见，无整页横向溢出')
 b.close()
(root/'review/add-materials-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));assert not errors
