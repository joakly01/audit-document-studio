"""Explicit template choice, custom fields, and conservative legacy migration."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle');g.evaluate('libraryStatusDataReady')
 def ev(s,arg=None):return g.evaluate(s,arg)
 def act(a):g.locator('[data-action="'+a+'"]:visible').last.click()
 assert ev("ws().config.template")=='';assert ev('ewConfig().fieldDefs')==[];assert g.locator('[data-xt-change=template]').input_value()=='';assert g.locator('#ef-field-error').inner_text()==''
 assert g.locator('.ef-template-header [data-action=ef-save-template]').is_disabled();assert not g.locator('.ef-fields-head [data-action=ef-save-template]').count();assert g.locator('.ef-fields-head [data-action=ef-field-add]').is_visible()
 ev("ws().ids=['d1'];ws().preview='d1';render()");assert g.locator('[data-action=run]').is_disabled()
 g.locator('[data-xt-change=template]').select_option('sys-extract');assert ev("modal==='xt-apply'");g.keyboard.press('Escape');assert ev('ewConfig().fieldDefs')==[];assert g.locator('[data-xt-change=template]').input_value()==''
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});ev('render()')
  if w<901:g.locator('[data-action=ef-panel][data-panel=fields]').click()
  assert ev('document.documentElement.scrollWidth')<=w;assert ev('document.documentElement.scrollHeight')==h
  assert g.locator('[data-action=ef-save-template]').is_visible();assert g.locator('[data-action=ef-field-add]').is_visible()
  if w>=901:assert g.locator('.ef-fields-scroll').bounding_box()['height']>=180
  g.screenshot(path=str(root/f'review/extract-no-template-{w}.png'),animations='disabled')
 checks.append('新任务无默认模板或字段；选模板取消保持空白，空配置不允许开始；模板保存与字段添加分区，四尺寸可见且无外层溢出')
 g.set_viewport_size({'width':1366,'height':768});ev('render()');act('ef-field-add');assert g.locator('#ef-field-0').evaluate('e=>e===document.activeElement');g.locator('#ef-field-0').fill('合同金额');g.locator('[data-ef-input=description]').fill('保留合同金额原始单位');assert ev("ws().config.template")=='';assert not g.locator('[data-action=ef-save-template]').is_disabled();assert not g.locator('[data-action=run]').is_disabled()
 assert ev('ewExecConfig(ewConfig()).exec_mode')=='custom';rules=ev('JSON.stringify(ewConfig().fieldDefs)');g.screenshot(path=str(root/'review/extract-custom-fields-1366.png'),animations='disabled')
 act('ef-save-template');g.locator('#xt-template-name').fill('自定义合同金额提取');act('ef-confirm-save-template');saved=ev('ws().config.extractionTemplateId');assert ev('id=>JSON.stringify(xtFind(id).rules)',saved)==rules;g.reload(wait_until='networkidle');ev('libraryStatusDataReady');assert ev('ws().config.extractionTemplateId')==saved;assert ev('JSON.stringify(ewConfig().fieldDefs)')==rules
 act('run');assert ev("modal==='ew-submit'");act('ew-submit-confirm');g.wait_for_function("currentTask()?.status==='completed'");snapshot=ev('JSON.stringify(currentTask().config)');act('new-analysis');assert ev('JSON.stringify(ws().config.fieldDefs)')==rules;assert ev('state.tasks.length')==1;assert ev('JSON.stringify(state.tasks[0].config)')==snapshot
 checks.append('无需模板即可添加字段，添加后自动聚焦；自定义请求结构、另存个人模板、刷新复用及执行/复制新建保留原任务快照')
 # Only the exact old automatic preset is retired; an edited or explicitly selected draft survives.
 ev("ws().taskId=null;window.legacy=structuredClone(ws().config);legacy.template=tool('extract').template;legacy.fields=[...tool('extract').fields];legacy.fieldDefs=legacy.fields.map(name=>({name,description:'提取原文中的'+name+'，保留原始单位及限定条件；无法取得时标注未提取到。'}));delete legacy.extractionTemplateId;delete legacy.backendTemplateId;delete legacy.extractionTemplateChoiceVersion;ws().config=structuredClone(legacy);render()")
 assert ev('ewConfig().fieldDefs.length')==0;assert g.locator('[data-xt-change=template]').input_value()==''
 ev("ws().config=structuredClone(legacy);ws().config.fieldDefs[0].description='已经调整过的提取口径';render()");assert ev('ewConfig().fieldDefs.length')==4;assert ev("ewConfig().fieldDefs[0].description")=='已经调整过的提取口径'
 ev("ws().config=structuredClone(legacy);ws().config.extractionTemplateId='sys-extract';render()");assert ev('ewConfig().fieldDefs.length')==4;assert g.locator('[data-xt-change=template]').input_value()=='sys-extract'
 ev("const task=state.tasks[0];task.config=structuredClone(legacy);ws().taskId=task.id;render()");old=ev('JSON.stringify(currentTask().config)');ev('render()');assert ev('JSON.stringify(currentTask().config)')==old;act('new-analysis');assert ev('ws().config.fieldDefs.length')==4
 checks.append('仅清理旧版未改动的自动预设；自定义口径、明确选择的模板、历史任务和旧任务复制均保留')
 assert not errors,errors;(root/'review/extract-template-choice-checks.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
