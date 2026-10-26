import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];errors=[];checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1280,'height':720})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle')
 page.evaluate('loadSample()')
 payload=page.evaluate("({schemaVersion:2,toolId:'extract',name:'导入验证模板',prompt:ws().config.prompt,config:structuredClone(ws().config)})")
 payload['config']['fieldDefs'][0]['description']='保留完整主题并注明限定词'
 page.goto('http://127.0.0.1:8765/#templates')
 page.locator('.xt-page-more>summary').click();page.locator('[data-action="v2-template-import"]').click()
 bad=json.loads(json.dumps(payload));bad['config']['stages']['extract']['content']=None
 page.locator('#template-import-json').fill(json.dumps(bad,ensure_ascii=False))
 page.locator('[data-action="xt-import-read"]').click()
 assert '导入失败' in page.locator('#xt-import-error').inner_text()
 page.locator('#template-import-json').fill(json.dumps(payload,ensure_ascii=False))
 page.locator('[data-action="xt-import-read"]').click()
 assert page.evaluate("modal==='xt-editor'")
 before=page.evaluate('state.templates.length');page.locator('[data-action="xt-save"]').click();assert page.evaluate('state.templates.length')==before+1
 page.locator('[data-action="xt-use"]').last.click();page.locator('[data-action="xt-apply-confirm"]').click()
 assert page.evaluate('ws().config.fieldDefs[0].description')=='保留完整主题并注明限定词'
 imported=page.evaluate('ws().config.template')
 page.locator('[data-xt-change="template"]').select_option('sys-extract')
 page.locator('[data-action="close-modal"]').first.click()
 assert page.evaluate('ws().config.template')==imported
 page.locator('[data-xt-change="template"]').select_option('sys-extract')
 page.locator('[data-action="xt-apply-confirm"]').click()
 assert page.evaluate('ws().config.template')=='通用资料信息提取'
 checks.append('配置导入验证、完整复用、切换取消及确认')
 assert page.evaluate("document.querySelector('.ew-commandbar').getBoundingClientRect().bottom<=document.querySelector('.ew-grid').getBoundingClientRect().top")
 checks.append('低分辨率步骤条不被工作区遮挡')
 page.goto('http://127.0.0.1:8765/#tool/word')
 page.evaluate('loadSample()')
 page.locator('[data-action="lexicon"]').click()
 page.evaluate("handleAction('aw-lex-import',{dataset:{kind:'stop'}})")
 page.locator('#aw-lex-text').fill('的\n审计资料\n审计资料')
 page.locator('[data-action="aw-lex-preview"]').click()
 assert page.evaluate('modalData.rows.filter(r=>r.issue).length')>=1
 page.locator('[data-action="aw-lex-commit"]').click()
 page.locator('[data-action="aw-lex-save"]').click()
 assert page.evaluate("state.stopwords.filter(x=>x==='审计资料').length")==1
 page.locator('[data-action="lexicon"]').click()
 page.evaluate("handleAction('aw-lex-edit',{dataset:{kind:'stop',index:String(modalData.data.stop.indexOf('的'))}})")
 page.locator('#aw-word-kind').select_option('user')
 page.locator('[data-action="aw-lex-word-save"]').click()
 page.locator('[data-action="aw-lex-save"]').click()
 assert page.evaluate("state.newwords.includes('的')")
 checks.append('词表导入预览、重复项处理与保存')
 page.goto('http://127.0.0.1:8765/#tool/meeting')
 page.evaluate('loadSample()');page.locator('[data-action="run"]').click()
 page.locator('[data-action="aw-submit-confirm"]').click()
 page.wait_for_function("currentTask().status==='completed'")
 page.locator('[data-action="meeting-filter"]').click()
 page.locator('[data-edit="from"]').fill('2026-03-01')
 page.locator('[data-action="v2-save-editor"]').click()
 assert page.locator('[data-action="aw-review"]').count()>0
 assert int(page.locator('[data-action="aw-review"]').first.get_attribute('data-index'))>0
 for btn in page.locator('[data-action="aw-review"]').all():
  idx=int(btn.get_attribute('data-index'));expected=page.evaluate('currentTask().result['+str(idx)+'].excerpt')
  btn.click();assert expected in page.locator('#aw-review-content').inner_text();page.keyboard.press('Escape')
 checks.append('会议筛选后详情保持原始结果对应关系')
 page.goto('http://127.0.0.1:8765/#tool/association')
 page.evaluate('loadSample()');page.locator('[data-action="v2-association"]').first.click()
 page.locator('summary',has_text='硬规则').click();page.locator('[data-action="v2-hard-reset"]').click()
 assert page.get_by_text('当前方案未配置硬规则，无法恢复。',exact=True).is_visible()
 page.locator('[data-action="v2-hard-add"][data-kind="and"]').click()
 assert page.locator('[data-edit="hardRules.0.message"]').is_visible()
 page.locator('[data-edit="hardRules.0.priority"]').fill('1001');page.locator('[data-action="v2-save-editor"]').click()
 assert '优先级' in page.locator('#editor-error').inner_text()
 page.locator('[data-edit="hardRules.0.priority"]').fill('99')
 page.locator('[data-action="v2-save-editor"]').click()
 assert page.evaluate('ws().config.association.hardRules[0].priority')==99
 checks.append('动态硬规则编辑保持展开、优先级校验')
 b.close()
(root/'review/config-regression-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));assert not errors
