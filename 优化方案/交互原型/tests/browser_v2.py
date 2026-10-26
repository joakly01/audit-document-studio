import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
checks=[];errors=[];metrics=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1366,'height':768},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle')
 page.evaluate('loadSample()')
 page.screenshot(path=str(root/'review/v2-01-信息提取-1366x768.png'),full_page=True)
 metrics.append(page.evaluate("({width:innerWidth,height:innerHeight,workTop:document.querySelector('.workbench').getBoundingClientRect().top,runBottom:document.querySelector('[data-action=run]').getBoundingClientRect().bottom,configHeight:document.querySelector('.config').clientHeight})"))
 assert metrics[-1]['workTop']<=135
 assert metrics[-1]['runBottom']<=768
 page.locator('[data-action="edit-fields"]').click()
 page.locator('[data-edit="0.description"]').fill('提取资料主题，保留完整表述')
 page.locator('[data-action="v2-save-editor"]').click()
 assert page.evaluate("ws().config.fieldDefs[0].description")=='提取资料主题，保留完整表述'
 checks.append('字段名称+说明可编辑并保存')
 page.locator('[data-action="prompt"]').click()
 page.locator('#prompt-editor').fill('核对原文，输出字段与来源')
 page.locator('[data-action="v2-save-stage-template"]').click()
 page.locator('[data-action="v2-save-editor"]').click()
 assert page.evaluate("ws().config.stages.extract.content")=='核对原文，输出字段与来源'
 checks.append('提示词本次应用与个人复用')
 page.locator('[data-action="run"]').click()
 page.wait_for_function("currentTask().status==='completed'")
 with page.expect_download() as dl:
  page.locator('[data-action="toggle-config"]').click()
  page.locator('[data-action="v2-export-config"]').click()
 dl.value.save_as(str(root/'review/v2-export-config.json'))
 checks.append('完整配置可导出')
 for tid in ['word','theme','timeline','risk','meeting','contract','bidding','prepaid','engineering','association']:
  page.goto('http://127.0.0.1:8765/#tool/'+tid)
  page.evaluate('loadSample()')
  if tid=='word':
   page.locator('[data-action="v2-word-selection"]').click()
   page.locator('[data-action="v2-word-none"]').first.click()
   page.locator('[data-action="v2-save-editor"]').click()
   assert page.evaluate('ws().config.lexiconSelection.stop.length')==0
  if tid=='theme':
   page.locator('[data-action="v2-stage"][data-stage="summarize"]').click()
   page.locator('#prompt-editor').fill('仅归纳设备采购相关的事项，注明来源。')
   page.locator('[data-action="v2-save-editor"]').click()
   assert page.evaluate("ws().config.stages.summarize.content")!=''
  if tid=='risk':
   page.locator('[data-action="v2-rules"]').click()
   page.locator('[data-action="v2-add-rule"]').click()
   page.locator('[data-edit="4.name"]').fill('验收记录')
   page.locator('[data-edit="4.description"]').fill('检查验收记录及其日期')
   page.locator('[data-action="v2-save-editor"]').click()
   assert page.evaluate("ws().config.checks.includes('验收记录')")
  if tid=='contract':
   page.locator('[data-action="v2-rules"]').click()
   page.locator('[data-edit="0.laws"]').fill('本合同约定及项目内部采购制度')
   page.locator('[data-edit="0.judgment"]').fill('合同主体是否与审批主体一致')
   page.locator('[data-action="v2-save-editor"]').click()
   assert page.evaluate("ws().config.contractRules[0].judgment")=='合同主体是否与审批主体一致'
  if tid=='bidding':
   page.locator('[data-action="v2-stage"]').first.click()
   assert page.locator('#prompt-editor').is_editable()
   page.locator('#prompt-editor').fill('针对所选项目逐项核对技术响应，不跨项目比较。')
   page.locator('[data-action="v2-save-editor"]').click()
  if tid=='prepaid':
   assert page.locator('[data-config="feeType"] option').count()==6
   page.locator('[data-action="v2-stage"][data-stage="calculation"]').click()
   page.locator('#prompt-editor').fill('根据已提取约定和基数计算，列出公式和单位。')
   page.locator('[data-action="v2-save-editor"]').click()
  if tid=='engineering':
   page.locator('[data-action="v2-engineering"][data-kind="parent"]').click()
   page.locator('[data-edit="threshold"]').fill('3.8')
   page.locator('[data-edit="additional"]').fill('区分配套设备与重复立项')
   page.locator('[data-action="v2-save-editor"]').click()
   assert page.evaluate("ws().config.engineering.parent.threshold") ==3.8
   assert page.evaluate("ws().config.engineering.duplicate.threshold")==3.35
  if tid=='association':
   page.locator('[data-action="v2-association"]').first.click()
   page.locator('summary',has_text='硬规则').click()
   page.locator('[data-action="v2-hard-add"][data-kind="and"]').click()
   page.locator('[data-edit="hardRules.0.message"]').fill('满足组合条件时优先判定')
   page.locator('[data-action="v2-save-editor"]').click()
   assert page.evaluate('ws().config.association.hardRules.length')==1
   page.screenshot(path=str(root/'review/v2-02-两表关联-1366x768.png'),full_page=True)
  page.locator('[data-action="run"]').click()
  if page.get_by_role('dialog').count():
   print(page.get_by_role('dialog').inner_text())
  page.wait_for_function("currentTask()&&currentTask().status!=='running'")
  assert page.evaluate('currentTask().status') in ['completed','awaiting'],tid
  if tid=='meeting':
   page.locator('[data-action="meeting-filter"]').click()
   page.locator('[data-edit="min"]').fill('125')
   page.locator('[data-action="v2-save-editor"]').click()
   assert page.get_by_text('会议筛选已应用',exact=False).is_visible()
   page.screenshot(path=str(root/'review/v2-03-会议筛选-1366x768.png'),full_page=True)
  if tid=='prepaid':
   page.locator('#fee-base').fill('1000000')
   page.locator('[data-action="calculate-fee"]').click()
   page.wait_for_function('currentTask().fee===15000')
  checks.append(tid+' 核心流程与配置')
 for size in [(1280,720),(1024,768),(390,844)]:
  page.set_viewport_size({'width':size[0],'height':size[1]})
  page.goto('http://127.0.0.1:8765/#tool/extract')
  if page.locator('[data-action="new-analysis"]').count():page.locator('[data-action="new-analysis"]').click()
  if not page.locator('[data-action="run"]').count():page.evaluate('loadSample()')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),size
  if size[0]>800:
   m=page.evaluate("({width:innerWidth,height:innerHeight,workTop:document.querySelector('.workbench').getBoundingClientRect().top,runBottom:document.querySelector('[data-action=run]').getBoundingClientRect().bottom})")
   metrics.append(m)
   assert m['runBottom']<=size[1],m
  page.screenshot(path=str(root/('review/v2-extract-'+str(size[0])+'.png')),full_page=True)
 checks.append('1366/1280/1024主操作可见，390无整页横向溢出')
 b.close()
(root/'review/v2-test-results.json').write_text(json.dumps({'checks':checks,'layout':metrics,'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'checks':checks,'layout':metrics,'errors':errors},ensure_ascii=False))
assert not errors
