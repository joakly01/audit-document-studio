"""High-volume, prompt-owned risk selection: scope, draft isolation and execution contracts."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765')
checks, errors, layouts = [], [], []

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768}, reduced_motion='reduce')
    page.set_default_timeout(10000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL + '/#tool/risk', wait_until='load')
    page.wait_for_function("typeof rsBase !== 'undefined'")
    page.evaluate('taskDemoReady')

    def ev(script, arg=None):
        return page.evaluate(script, arg)

    def click(action):
        page.locator('[data-action="' + action + '"]:visible').last.click()

    def note(text):
        checks.append(text)
        print(text, flush=True)

    ev("""()=>{
      nav('tool','risk');loadSample();const c=ws().config;
      c.riskNodes=Array.from({length:1000},(_,i)=>({id:'rs-risk-'+i,
        name:'核查项'+String(i).padStart(4,'0'),
        path:'业务分类'+Math.floor(i/100)+' / 检查环节'+Math.floor(i%100/20),
        description:(i%2?'核对支付审批、合同履约及原文依据。':'核对预算执行、采购程序及原文依据。')+' 资料编号'+i}));
      c.checks=c.riskNodes.filter((_,i)=>i%27===0).map(n=>n.name);
      c.mode='逐文件检查全部关注点';c.failure='none';c.stageFailure='none';
      window.rsOriginal=JSON.stringify(c);render();
    }""")
    assert page.locator('.rs-summary [data-change=risk-check]').count() == 0
    assert page.locator('.rs-category-summary>span').count() <= 4
    assert page.locator('.rs-selected-count strong').inner_text() == '38'
    click('aw-risk-editor')
    assert page.locator('.rs-table tbody tr').count() == 20
    assert page.locator('.rs-dialog input').count() < 40
    assert ev('modalData.nodes.length') == 1000
    assert ev("document.querySelector('[data-rs-change=category]').indeterminate")
    assert ev('ws().config.checks.length') == 38
    click('rs-clear-matches')
    assert ev('rsSelected(modalData.nodes)') == 0
    page.locator('[data-rs-change=page]').check()
    assert ev('rsSelected(modalData.nodes)') == 20
    click('rs-page')
    assert ev('modalData.page') == 2
    assert not page.locator('[data-rs-change=page]').is_checked()
    page.locator('[data-action=rs-category][data-path="业务分类2"]').click()
    assert ev('rsMatches(modalData).length') == 100
    click('rs-select-matches')
    assert ev('rsSelected(modalData.nodes)') == 120
    assert ev("modalData.nodes.filter(n=>rsWithin(n,'业务分类2')).every(n=>n.selected)")
    assert page.locator('[data-rs-change=category][data-path="业务分类2"]').is_checked()
    page.locator('[data-action=rs-category-toggle][data-path="业务分类2"]').click()
    page.locator('[data-rs-change=category][data-path="业务分类2 / 检查环节1"]').uncheck()
    assert ev('rsSelected(modalData.nodes)') == 100
    assert ev("[...document.querySelectorAll('[data-rs-change=category]')].find(n=>n.dataset.path==='业务分类2').indeterminate")
    page.locator('#rs-query').fill('审批')
    assert ev('rsMatches(modalData).length') == 50
    click('rs-clear-matches')
    assert ev('rsSelected(modalData.nodes)') == 60
    assert ev('JSON.stringify(ws().config)===rsOriginal')
    note('1000个风险点分页呈现；本页、全部页及分类含下级选择范围正确，搜索后取消只影响匹配项，未确认不改配置')

    # IME text remains in the same input until composition commits.
    click('rs-reset')
    ev("""()=>{const input=document.getElementById('rs-query');window.rsIME=input;
      input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      input.value='yusuan';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
      if(input!==document.getElementById('rs-query')||modalData.query!=='')throw Error('IME preedit rebuilt');
      input.value='预算';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'预算'}));
    }""")
    page.wait_for_function("modalData.query==='预算'")
    assert ev('rsMatches(modalData).length') == 500
    assert page.locator('#rs-query').evaluate('e=>e===document.activeElement')
    click('close-modal')
    assert ev("modal==='aw-discard'")
    click('aw-continue')
    assert page.locator('#rs-query').input_value() == '预算'
    click('close-modal')
    click('aw-discard')
    assert ev('JSON.stringify(ws().config)===rsOriginal')
    note('中文输入法预编辑不重建输入框；关闭时可继续草稿或放弃，原配置保持不变')

    # Edit a single point without mounting thousands of editable fields.
    click('aw-risk-editor')
    click('rs-clear-matches')
    page.locator('#rs-query').fill('核查项0999')
    assert page.locator('.rs-table tbody tr').count() == 1
    page.locator('[data-rs-change=node]').check()
    page.locator('.rs-table label.rs-point-name').click()
    assert not page.locator('[data-rs-change=node]').is_checked()
    page.locator('[data-rs-change=node]').check()
    click('rs-point-edit')
    assert page.locator('.rs-edit-dialog input').count() == 2
    page.locator('#rs-name').fill('核查项0000')
    click('rs-point-save')
    assert '名称已存在' in page.locator('#rs-edit-error').inner_text()
    page.locator('#rs-name').fill('大额付款审批核查')
    page.locator('#rs-path').fill('资金管理 / 支付审批')
    page.locator('#rs-description').fill('对照付款授权、审批链和原始凭证，检查大额付款审批是否齐全。')
    click('rs-point-save')
    assert ev("modalData.nodes.find(n=>n.id==='rs-risk-999').name") == '大额付款审批核查'
    assert ev('rsSelected(modalData.nodes)') == 1
    click('aw-risk-add')
    assert page.locator('#rs-name').evaluate('e=>e===document.activeElement')
    click('rs-point-save')
    assert '请填写' in page.locator('#rs-edit-error').inner_text()
    page.locator('#rs-name').fill('合同验收核查')
    page.locator('#rs-description').fill('检查合同约定、验收记录与实际支付的对应关系。')
    click('rs-point-save')
    assert ev('modalData.nodes.length') == 1001
    assert ev('rsSelected(modalData.nodes)') == 2
    page.locator('[data-action=rs-view][data-view=selected]').click()
    assert page.locator('.rs-table tbody tr').count() == 2
    click('rs-point-edit')
    click('rs-point-delete')
    assert ev("modal==='rs-point-delete-confirm'")
    click('close-modal')
    assert ev("modal==='rs-point-edit'")
    assert ev('modalData.back.nodes.length') == 1001
    click('rs-point-delete')
    click('rs-point-delete-confirm')
    assert ev('modalData.nodes.length') == 1000
    assert ev('rsSelected(modalData.nodes)') == 1
    click('aw-risk-save')
    assert ev('ws().config.checks') == ['大额付款审批核查']
    assert ev("ws().config.riskNodes.find(n=>n.id==='rs-risk-999').path") == '资金管理 / 支付审批'
    assert ev("ws().config.mode") == '逐文件检查全部关注点'
    assert ev('JSON.stringify(ws().config.stages)===JSON.stringify(JSON.parse(rsOriginal).stages)')
    note('单项新增、编辑、重复校验、删除确认和已选核对；确认后保留风险点ID、层级路径、提示词及检查方式')

    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        page.set_viewport_size({'width': width, 'height': height})
        if width <= 900:
            ev("tv().panel='config';render()")
        click('aw-risk-editor')
        box = page.locator('.rs-dialog').bounding_box()
        foot = page.locator('.rs-dialog .modalfoot').bounding_box()
        scroll = page.locator('.rs-table-scroll').bounding_box()
        assert box['y'] >= 0 and box['y'] + box['height'] <= height + 1, box
        assert foot['y'] + foot['height'] <= height + 1, foot
        assert scroll['height'] >= 65, scroll
        assert ev('document.documentElement.scrollWidth') <= width
        assert page.locator('.rs-table tbody tr').count() == 20
        assert ev("document.querySelector('.rs-dialog').scrollWidth") <= box['width'] + 1
        page.screenshot(path=str(ROOT / f'review/risk-selector-{width}.png'))
        layouts.append({'width': width, 'height': height, 'dialog': box, 'list': scroll})
        click('close-modal')
    note('1366、1024×480和390屏幕：列表独立滚动，选择与确认操作可见，无页面横向溢出')

    page.set_viewport_size({'width': 1366, 'height': 768})
    click('run')
    click('aw-submit-confirm')
    page.wait_for_function("currentTask()?.status==='completed'")
    task_id = ev('currentTask().id')
    original = ev('JSON.stringify(currentTask())')
    request = ev('currentTask().configFragment.custom_config.parameter_settings')
    assert request['mode'] == 'byFile'
    assert request['risk_points'] == [{'id': 'rs-risk-999', 'path': '资金管理 / 支付审批', 'label': '大额付款审批核查'}]
    assert len(ev('currentTask().result')) == len(ev('currentTask().ids'))
    ev("id=>trOpen(state.tasks.find(t=>t.id===id),'config')", task_id)
    click('aw-risk-editor')
    assert ev("modalData.view") == 'selected'
    assert page.locator('.rs-table tbody tr').count() == 1
    assert not page.locator('.rs-dialog input[type=checkbox]').count()
    assert not page.locator('[data-action=aw-risk-save]').count()
    click('rs-point-edit')
    assert page.locator('#rs-description').get_attribute('readonly') is not None
    assert not page.locator('[data-action=rs-point-save]').count()
    click('close-modal')
    click('close-modal')
    assert ev('JSON.stringify(currentTask())') == original
    note('实际提交保留byFile与叶节点ID/路径/名称；历史默认仅查看本次已选项，详情只读且执行快照不变')

    # Empty prompt-driven lists remain empty; adding custom checks is explicit.
    ev("nav('tool','risk');ws().taskId=null;ws().config.riskNodes=[];ws().config.checks=[];render()")
    assert '当前提示词未配置风险点' in page.locator('.rs-summary').inner_text()
    click('aw-risk-editor')
    assert '当前分类没有风险点' in page.locator('.rs-table').inner_text()
    click('aw-risk-save')
    assert '至少选用' in page.locator('#aw-risk-editor-error').inner_text()
    click('close-modal')
    assert not errors, errors
    report = {'checks': checks, 'layouts': layouts, 'errors': errors, 'fixtureRisks': 1000}
    (ROOT / 'review/risk-selection-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False))
    browser.close()
