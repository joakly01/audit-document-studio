"""Business-level preparation, confirmation and running descriptions stay truthful."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('AUDIT_UI_URL','http://127.0.0.1:8765')
checks=[]
errors=[]
layouts=[]
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce')
    page.set_default_timeout(16000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL+'/#tool/extract',wait_until='load')
    page.wait_for_function("typeof bfCurrentSummary==='function'")
    assert page.evaluate("ws().config.template")==''
    assert page.evaluate("ws().config.fieldDefs.length")==0
    checks.append('信息提取模板和字段默认不选，三栏步骤与原文保留')
    tools=page.evaluate('TOOLS.map(t=>t.id)')
    def ev(code,arg=None): return page.evaluate(code,arg)
    def click(action): page.locator('[data-action="'+action+'"]:visible').last.click()
    def prepare(tid):
        ev("id=>{nav('tool',id);loadSample();if(id==='extract'){openModal('xt-apply',{id:'sys-extract'});xtApply();}render();}",tid)
    def info(): return ev('bfCurrentSummary()')
    def config(): return ev('JSON.stringify(ws().config)')
    for tid in tools:
        prepare(tid)
        assert ev('validate(false)')==[],tid
        if tid!='extract':
            h=page.locator('aside.config h2').last.inner_text()
            expected_step='Step 3' if tid in ['word','theme','timeline','risk','meeting','prepaid'] else 'Step 2'
            assert expected_step in h,(tid,h)
        before=config()
        count=ev('state.tasks.length')
        expected=info()
        click('run')
        assert ev('modal') in ['ew-submit','aw-submit','tw-submit'],tid
        assert page.locator('.bf-submit-summary').count()==1
        text=page.locator('.bf-submit-summary').inner_text()
        assert expected['content'] in text,(tid,text)
        assert expected['out'] in text,(tid,text)
        for label,value in expected['counts']:
            assert label in text and value in text,(tid,label,value,text)
        page.locator('.bf-confirm-details>summary').click()
        detail=page.locator('.bf-confirm-details').inner_text()
        for item in expected['details']:
            assert item['label'] in detail,(tid,item)
            assert item['text'] in detail,(tid,item)
        assert page.locator('#uf-go-task-center').count()==1,tid
        click('close-modal')
        assert ev('state.tasks.length')==count,tid
        assert config()==before,tid
    checks.append('11工具提交前显示真实范围、字段/规则/阶段、文件角色及成果；取消不创建任务或改配置')

    prepare('bidding')
    ev("()=>{ws().modes=['tender','joint'];render()}")
    summary=info()
    assert summary['content']=='招标文件分析、招投标联合分析'
    labels=[d['label'] for d in summary['details']]
    assert '投标文件分析' not in labels and '招标文件分析' in labels
    assert all(n in json.dumps(summary,ensure_ascii=False) for n in ['青禾公司','远川公司','招标文件'])
    prepare('contract')
    ev("()=>{ws().config.checks=ws().config.checks.filter(n=>n!==ws().config.contractRules[0].title);ws().config.autoAnalysis=true;render()}")
    summary=info()
    assert '3 条检查规则' in summary['content']
    assert summary['details'][3]['label']=='补充查找线索'
    assert '已开启' in summary['details'][3]['text']
    assert '合同主体' not in next(i['text'] for i in summary['details'] if i['label']=='检查内容')
    prepare('association')
    summary=info()
    assert summary['counts']==[['对照资料','2 张台账']]
    assert '园区建设项目台账.xlsx' in summary['details'][0]['text']
    assert '年度资金安排表.xlsx' in summary['details'][1]['text']
    checks.append('招投标只摘要本次所选环节并保留项目角色；合同按实际checks排除未选规则且标明补充分析；两表角色独立')

    prepare('extract')
    ev("()=>{ws().config.fieldDefs[0].description='<img src=x onerror=window.bfInjected=1>';render()}")
    # A direct modal is deliberate here: it checks escaping independent of validation.
    ev("openModal('ew-submit',{name:'摘要检查',notes:'',execution:1})")
    page.locator('.bf-confirm-details>summary').click()
    assert '<img src=x onerror=window.bfInjected=1>' in page.locator('.bf-confirm-details').inner_text()
    assert page.locator('.bf-confirm-details img').count()==0
    assert not ev('window.bfInjected')
    click('close-modal')
    checks.append('摘要中的文件和配置按纯文本显示，不执行输入中的HTML')

    for tid,modal_name,execution,confirm in [
        ('extract','ew-submit','ew-execution','ew-submit-confirm'),
        ('word','aw-submit','aw-execution','aw-submit-confirm'),
        ('contract','tw-submit','tw-execution','tw-submit-confirm')]:
        prepare(tid)
        click('run')
        assert ev('modal')==modal_name
        page.locator('.uf-submit-options>summary').click()
        page.locator('#'+execution).select_option('2')
        before=ev('state.tasks.length')
        click(confirm)
        assert ev('state.view')=='tool' and ev('currentTask().executionMode')==2
        assert page.locator('.bf-running-flow').is_visible(),tid
        assert page.locator('.bf-running-flow .done,.bf-running-flow .active,.bf-running-flow input').count()==0
        assert ev("()=>{const t=currentTask(),before=JSON.stringify(t);workbench();return before===JSON.stringify(t)}"),tid
        assert '任务中心' not in page.locator('.ew-progress-meta,.aw-progress-info,.progress-shell').inner_text()
        page.wait_for_function("currentTask()?.status==='completed'")
        assert ev('state.tasks.length')==before+1
        assert ev('currentTask().executionMode')==2
        assert page.locator('.bf-running-flow').count()==0
        assert page.locator('[data-action="export"]:visible').count()==1
    checks.append('三类提交原参数保留，执行方式2仍在工具内；运行描述不改任务数据、不虚构阶段完成')

    for width,height in [(1366,768),(1024,480),(390,600)]:
        page.set_viewport_size({'width':width,'height':height})
        prepare('word')
        click('run')
        page.locator('.bf-confirm-details>summary').click()
        metrics=ev("""()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,
          footer:document.querySelector('#modal-root .modalfoot').getBoundingClientRect().toJSON(),
          dialog:document.querySelector('#modal-root .modal').getBoundingClientRect().toJSON()})""")
        assert metrics['scroll']<=width,metrics
        assert metrics['footer']['bottom']<=height+1,metrics
        assert metrics['dialog']['right']<=width+1,metrics
        layouts.append(metrics)
        page.screenshot(path=str(ROOT/'review'/f'business-flow-confirm-{width}.png'),animations='disabled')
        click('close-modal')
        page.screenshot(path=str(ROOT/'review'/f'business-flow-prepare-{width}.png'),animations='disabled')
    checks.append('1366、1024低高度、390窄屏的摘要滚动和确认页脚可达，页面无横向溢出')
    assert not errors,errors
    browser.close()
report={'checks':checks,'layouts':layouts,'errors':errors}
(ROOT/'review/business-flow-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
