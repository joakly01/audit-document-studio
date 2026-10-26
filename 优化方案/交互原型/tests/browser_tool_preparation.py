"""Readable source/configuration preparation preserves the actual business task."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765')
checks, errors, layouts = [], [], []
TOOLS = ['word', 'theme', 'timeline', 'risk', 'meeting', 'prepaid']

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    page.set_default_timeout(18000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL+'/#tool/word', wait_until='load')
    page.wait_for_function("typeof tlPreparing==='function'")
    page.evaluate('taskDemoReady')

    def ev(code, arg=None):
        return page.evaluate(code, arg)

    def action(name, **data):
        return ev('x=>handleAction(x.name,{dataset:x.data})', {'name':name,'data':data})

    def snapshot():
        return ev("JSON.stringify({ids:ws().ids,config:ws().config,payload:configurationFragment(state.toolId,ws().config)})")

    def visible_action(name, **data):
        selector = '[data-action="'+name+'"]'
        for key, value in data.items():
            selector += '[data-'+key+'="'+str(value)+'"]'
        page.locator(selector+':visible').first.click()

    for tool in TOOLS:
        page.set_viewport_size({'width':1366,'height':768})
        ev("id=>{nav('tool',id);tv().tab='original';loadSample();document.querySelector('#toast').classList.remove('show')}", tool)
        assert page.locator('.tl-grid>.tw-materials').count()==1, tool
        assert page.locator('.tl-grid>.tl-preview-column>.tw-preview').count()==1, tool
        assert page.locator('.tl-grid>.tl-config').count()==1, tool
        assert 'Step 1' in page.locator('.tl-grid>.tw-materials h2').first.inner_text(), tool
        assert 'Step 2' in page.locator('.tl-preview-column h2').first.inner_text(), tool
        assert 'Step 3' in page.locator('.tl-config h2').first.inner_text(), tool
        assert ev('validate(false)')==[], (tool, ev('validate(false)'))
        if tool!='word':
            expected = ev('pgDefs().map(s=>s[0])')
            actual = page.locator('.tl-config [data-pg-prompt]').evaluate_all('els=>els.map(e=>e.dataset.pgPrompt)')
            assert actual==expected, (tool,actual,expected)
        if tool=='prepaid':
            assert page.locator('.tl-config [data-config="feeType"] option').count()==6
            params=ev("configurationFragment('prepaid',ws().config).custom_config.parameter_settings")
            assert params['exec_phase']=='extract' and params['billing_base_wan'] is None
            assert params['billing_agreement_prompt_content'] and params['cost_calculation_prompt_content']

        original=snapshot()
        # Do not build hidden parsed paragraphs for every setting change. A
        # long source is rendered only once its parsed-text tab is requested.
        calls=ev("""()=>{let count=0;const original=previewParsedMarkup;
          previewParsedMarkup=function(...args){count++;return original(...args)};
          try{render();return count}finally{previewParsedMarkup=original}}""")
        assert calls==0, (tool,'original tab eagerly rendered hidden parsed source',calls)
        assert not page.locator('#tw-parsed-content .wn-reader-body').count(), tool
        docs=ev('ws().ids')
        selected=docs[-1]
        page.locator('.tw-file-name[data-id="'+selected+'"]').click()
        assert ev('modal') is None, tool
        assert ev('ws().preview')==selected, tool
        assert selected==ev('activeFilePreview?.id'), tool
        file_name = ev('file(ws().preview).name')
        assert file_name
        assert file_name in page.locator('.tl-preview-column').inner_text(), tool
        outside=ev('state.docs.find(d=>!ws().ids.includes(d.id)&&!d.deleted)?.id')
        if outside:
            action('tw-preview',id=outside)
            assert ev('ws().preview')==selected
        visible_action('tw-preview-tab',tab='parsed')
        assert page.locator('#tw-parsed-content').is_visible(), tool
        assert page.locator('#ef-raw-content').is_hidden(), tool
        assert page.locator('#tw-parsed-content .wn-reader-body').count() or page.locator('#tw-parsed-content').inner_text().strip(), tool
        visible_action('tw-preview-tab',tab='original')
        assert page.locator('#ef-raw-content').is_visible(), tool
        assert snapshot()==original, tool

        # A rerender must preserve the current file's live raw-viewer DOM,
        # zoom and session rather than destroying and fetching it repeatedly.
        page.wait_for_function('activeFilePreview?.loaded')
        ev("""()=>{window.tlQaSession=activeFilePreview;window.tlQaRaw=document.querySelector('#ef-raw-content');
          activeFilePreview.data.rawZoom='1.25';render();}""")
        assert ev('activeFilePreview===tlQaSession&&!tlQaSession.closed'), tool
        assert ev("document.querySelector('#ef-raw-content')===tlQaRaw"), tool
        assert ev("activeFilePreview.data.rawZoom==='1.25'"), tool
        if tool=='word':
            old_top=ev('Number(ws().config.top)')
            chosen_top=50 if old_top!=50 else 30
            visible_action('wc-top',value=str(chosen_top))
            assert ev('Number(ws().config.top)')==chosen_top
            assert ev('activeFilePreview===tlQaSession&&!tlQaSession.closed')
            assert ev("document.querySelector('#ef-raw-content')===tlQaRaw")
            ev('value=>{ws().config.top=value;render()}',old_top)
        assert snapshot()==original, tool

        # Expand uses the established dual-view reader, but clicking a file
        # itself stays inline and never introduces a modal detour.
        before_source_state=ev('({id:activeFilePreview.id,page:activeFilePreview.data.rawPage||1,zoom:activeFilePreview.data.rawZoom||"fit"})')
        page.locator('.tl-preview-column [data-action="source"]:visible').first.click()
        assert ev('modal')=='source' and page.locator('.file-preview-pane').count()==2, tool
        page.keyboard.press('Escape')
        assert ev('modal') is None and snapshot()==original, tool
        page.wait_for_function('id=>activeFilePreview?.data.inline&&activeFilePreview.id===id',arg=selected)
        assert ev('activeFilePreview.data.rawPage||1')==before_source_state['page'], tool
        assert ev('activeFilePreview.data.rawZoom||"fit"')==before_source_state['zoom'], tool

        # Reading remains available; older hidden state and stale collapse actions recover it.
        assert not page.locator('[data-action="tl-toggle-preview"]').count(), tool
        ev("tv().previewHidden=true;render()")
        assert page.locator('.tl-preview-column').is_visible() and not ev('tv().previewHidden'), tool
        action('tl-toggle-preview')
        assert page.locator('.tl-preview-column').is_visible(), tool
        assert not page.locator('[data-action="tl-toggle-preview"]').count(), tool
        assert snapshot()==original, tool
        assert page.locator('.tl-reader-toolbar .ef-preview-caption').count()==1, tool
        for side,panel in [('left','.tw-materials'),('right','.tl-config')]:
            handle=page.locator('[data-tl-resize="'+side+'"]:visible')
            assert handle.count()==1 and handle.get_attribute('role')=='separator', tool
            before=page.locator('.tl-grid>'+panel).evaluate('el=>el.getBoundingClientRect().width')
            handle.focus()
            handle.press('ArrowRight')
            after=page.locator('.tl-grid>'+panel).evaluate('el=>el.getBoundingClientRect().width')
            assert abs(after-before)>1, (tool,side,before,after)
            handle.press('ArrowLeft')
            restored=page.locator('.tl-grid>'+panel).evaluate('el=>el.getBoundingClientRect().width')
            assert abs(restored-before)<1, (tool,side,before,restored)
        assert snapshot()==original, tool

        # Current source permissions are observed on every rerender, including
        # the parsed tab; analysis scope remains independent of optional preview.
        ev("""()=>{const d=file(ws().preview);window.tlQaDoc=structuredClone(d);
          d.can_preview=false;tv().tab='parsed';render();}""")
        assert '无原文预览权限' in page.locator('.tl-preview-column').inner_text(), tool
        assert page.locator('.tl-preview-column .wn-reader-body, .tl-preview-column canvas, .tl-preview-column iframe').count()==0, tool
        ev("{const d=file(tlQaDoc.id);if(!Object.hasOwn(tlQaDoc,'can_preview'))delete d.can_preview;Object.assign(d,tlQaDoc);tv().tab='original';render()}")
        assert snapshot()==original, tool

        # Work area stays legible at laptop width: materials remain alongside
        # one selected pane; mobile can reach each of the three areas.
        for width,height in [(1366,768),(1024,480),(390,600)]:
            page.set_viewport_size({'width':width,'height':height})
            ev('render()')
            if width==1024:
                assert page.locator('.tl-grid>.tw-materials').is_visible(), tool
                visible_action('tl-panel',panel='preview')
                assert page.locator('.tl-preview-column').is_visible(), tool
                visible_action('tl-panel',panel='config')
            if width==390:
                visible_action('tl-panel',panel='materials')
                assert page.locator('.tl-grid>.tw-materials').is_visible(), tool
                visible_action('tl-panel',panel='preview')
                assert page.locator('.tl-preview-column').is_visible(), tool
                visible_action('tl-panel',panel='config')
            assert page.locator('.tl-config').is_visible(), tool
            body=page.locator('.tl-config>.ew-config-body, .tl-config>.pw-config-scroll').first
            metric=ev("""()=>{const panel=document.querySelector('.tl-config'),body=panel.querySelector('.ew-config-body,.pw-config-scroll');return {tool:state.toolId,width:innerWidth,height:innerHeight,
              scrollWidth:document.documentElement.scrollWidth,
              panel:panel.getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON()}}""")
            assert metric['scrollWidth']<=width, metric
            assert metric['panel']['right']<=width+1, metric
            assert metric['body']['height']>85, metric
            assert metric['body']['bottom']<=height+1, metric
            last_control=body.locator('button:visible,select:visible,input:visible,summary:visible').last
            if last_control.count():
                last_control.scroll_into_view_if_needed()
                assert last_control.is_visible(), (tool,width,'last configuration control unreachable')
            body.evaluate('el=>el.scrollTop=0')
            layouts.append(metric)
            page.screenshot(path=str(ROOT/'review'/f'preparation-{tool}-{width}.png'), animations='disabled')
        assert snapshot()==original, tool
        page.set_viewport_size({'width':1366,'height':768})
        ev('render()')
        page.locator('[data-action="run"]:visible').last.click()
        submit='tw-submit' if tool=='prepaid' else 'aw-submit'
        assert ev('modal')==submit, (tool,ev('modal'))
        if tool=='prepaid':
            action('close-modal')
            assert snapshot()==original
            checks.append('prepaid：三栏计费合同核对、两个阶段提示词及真实提取参数保留；费用结果续算由原专项覆盖')
        else:
            request=ev('configurationFragment(state.toolId,ws().config)')
            page.locator('[data-action="aw-submit-confirm"]').click()
            page.wait_for_function("currentTask()?.status==='completed'",timeout=25000)
            assert ev('currentTask().configFragment')==request, tool
            assert not page.locator('.tl-grid').count(), tool
            assert not page.locator('.tw-materials:visible,.ew-materials:visible').count(), tool
            assert page.locator('.ra-result-commandbar').is_visible(), tool
            assert ev('currentTask().result.length')>0, tool
            if tool=='word':
                assert '词频' in page.locator('#app').inner_text()
            if tool=='meeting':
                assert '议题' in page.locator('#app').inner_text()
                assert page.locator('[data-action="aw-risk-prompt"]').count() or '风险' in page.locator('#app').inner_text()
            checks.append(tool+'：三栏准备、行内原文及解析切换、懒加载、会话保持、常驻原文、旧收起状态恢复与键盘调宽、权限、三尺寸及原执行结果均保留')
        print(checks[-1], flush=True)

    ev("nav('tool','extract');loadSample()")
    assert page.locator('.ef-preview').count()==1
    assert not page.locator('.tl-grid').count()
    checks.append('信息提取原有原文与字段同步核对三栏保持；其他业务工具与结果不被通用准备页覆盖')
    assert not errors, errors
    browser.close()

report={'checks':checks,'layouts':layouts,'errors':errors}
(ROOT/'review/tool-preparation-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
