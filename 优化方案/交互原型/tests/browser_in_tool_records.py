"""Tool-local records complete the normal configure/run/review workflow."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765')
checks, errors, layouts = [], [], []


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    page.set_default_timeout(18000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL+'/#tool/word', wait_until='load')
    page.wait_for_function("typeof ufRecords==='function'")
    page.evaluate('taskDemoReady')

    def ev(code, arg=None):
        return page.evaluate(code, arg)

    def action(name, **data):
        return ev('x=>handleAction(x.name,{dataset:x.data})', {'name':name,'data':data})

    def click(name):
        page.locator('[data-action="'+name+'"]:visible').last.click()

    def records(tool_id):
        ev("id=>{nav('tool',id);render()}", tool_id)
        page.locator('[data-action="uf-records"]:visible').first.click()
        assert ev('modal')=='uf-records', tool_id

    def row_ids():
        return page.locator('#modal-root [data-uf-row]').evaluate_all('els=>els.map(e=>e.dataset.ufRow)')

    def snapshot(task_id):
        return ev('id=>JSON.stringify(state.tasks.find(t=>t.id===id))', task_id)

    fixtures=ev("""()=>{
      const result={};for(const meta of TOOLS){
        const original=state.tasks.find(t=>tcResolve(t)===meta.id&&!tcMerge(t)&&
          (meta.id==='prepaid'?t.status==='awaiting':t.status==='completed'));
        if(!original)throw Error('Missing complete sample: '+meta.id);
        const t=structuredClone(original);t.id='uf-case-'+meta.id;
        t.name='本工具记录核验 · '+meta.name;t.created='2026-12-31T12:00:00.000Z';
        state.tasks.unshift(t);result[meta.id]=t.id;
      }
      const legacy=structuredClone(state.tasks.find(t=>t.id===result.prepaid));
      legacy.id='uf-legacy-prepaid-type10';delete legacy.toolId;
      legacy.task_type=10;legacy.biz_type='prepaidExpenses';state.tasks.push(legacy);
      render();return result;
    }""")
    total=ev('state.tasks.length')

    for tool_id,task_id in fixtures.items():
        records(tool_id)
        assert ev('currentTask()') is None, tool_id
        visible=row_ids()
        assert visible and ev('ids=>ids.every(id=>tcResolve(state.tasks.find(t=>t.id===id))===state.toolId)', visible), (tool_id,visible)
        if tool_id=='prepaid':
            assert ev("ufRecords('prepaid').some(t=>t.id==='uf-legacy-prepaid-type10')")
        if tool_id=='bidding':
            assert not ev("ufRecords('bidding').some(t=>t.id==='uf-legacy-prepaid-type10')")
        before=snapshot(task_id)
        page.locator('[data-uf-row="'+task_id+'"] [data-action="uf-open"]').click()
        assert ev('modal') is None, tool_id
        assert ev('state.view')=='tool' and ev('state.toolId')==tool_id
        assert ev('currentTask().id')==task_id
        assert ev('state.tasks.length')==total
        assert snapshot(task_id)==before, tool_id
        assert page.locator('.ra-result-commandbar').is_visible(), tool_id
        assert page.locator('[data-action="uf-records"]:visible').count()==1, tool_id
        assert page.locator('.ra-result-commandbar [data-action="new-analysis"]').count()==1
        assert page.locator('.ra-result-commandbar [data-action="export"]').count()==1
        # Ordinary tool entry remains the preparation draft, with its own way
        # back to this tool's results rather than becoming accidental history.
        ev("nav('library')")
        ev('id=>nav(\'tool\',id)', tool_id)
        assert ev('currentTask()') is None, tool_id
        assert page.locator('[data-action="run"]:visible').count()==1, tool_id
        assert page.locator('[data-action="uf-records"]:visible').count()>=1, tool_id
        assert snapshot(task_id)==before, tool_id
    checks.append('11工具准备入口保留；分析记录按实际工具分类，直接打开对应结果，不创建或修改历史任务')
    print(checks[-1], flush=True)

    # Search/status and pagination must operate in this tool only, without
    # reusing the global task centre's potentially unrelated active filters.
    ev("""()=>{const base=state.tasks.find(t=>t.id==='uf-case-word');
      for(let i=0;i<43;i++){const t=structuredClone(base);t.id='uf-word-page-'+i;
        t.name=i===42?'唯一检索记录A42':'词频分析记录 '+i;
        t.created=new Date(Date.parse('2027-01-01T00:00:00Z')+i*1000).toISOString();
        if(i%7===0){t.status='failed';t.result=[];t.successIds=[];t.failedIds=[...t.ids];}
        state.tasks.unshift(t);}
      state.taskQuery='不应带入工具内的全局查询';state.taskTool='contract';
      state.taskStatus='failed';render();}""")
    records('word')
    initial=row_ids()
    assert initial and len(initial)<ev("ufRecords('word').length")
    page.locator('[data-action="uf-page"][data-step="1"]').click()
    second=row_ids()
    assert second and set(initial).isdisjoint(second), (initial,second)
    page.locator('[data-uf-change="status"]').select_option('completed')
    assert ev('ids=>ids.every(id=>state.tasks.find(t=>t.id===id).status===\'completed\')', row_ids())
    page.locator('[data-uf-change="status"]').select_option('all')
    page.locator('[data-uf-input="query"]').fill('唯一检索记录A42')
    assert row_ids()==['uf-word-page-42']
    assert ev('state.taskQuery')=='不应带入工具内的全局查询'
    page.locator('[data-uf-input="query"]').fill('')
    for width,height in [(1366,768),(1024,480),(390,600)]:
        page.set_viewport_size({'width':width,'height':height})
        metric=ev("""()=>({width:innerWidth,height:innerHeight,
          scrollWidth:document.documentElement.scrollWidth,
          dialog:document.querySelector('#modal-root .modal').getBoundingClientRect().toJSON(),
          footer:document.querySelector('#modal-root .modalfoot').getBoundingClientRect().toJSON()})""")
        assert metric['scrollWidth']<=width, metric
        assert metric['dialog']['right']<=width+1, metric
        assert metric['footer']['bottom']<=height+1, metric
        layouts.append(metric)
        page.screenshot(path=str(ROOT/'review'/f'in-tool-records-{width}.png'), animations='disabled')
    page.set_viewport_size({'width':1366,'height':768})
    click('close-modal')
    checks.append('本工具记录支持状态、检索和跨页浏览；全局任务中心筛选不串入，三尺寸页脚可达')
    print(checks[-1], flush=True)

    # The original task centre still exposes task information/configuration.
    ev("nav('tasks');state.taskQuery='';state.taskTool='all';state.taskStatus='all';render()")
    action('tr-info', id=fixtures['contract'])
    assert ev('modal')=='tc-info'
    assert fixtures['contract'] in page.locator('#modal-root').inner_text()
    action('tc-info-tab', tab='config')
    assert page.locator('[data-action="tr-config"]').is_visible()
    click('close-modal')
    checks.append('任务中心原任务信息与只读执行配置入口保留')
    print(checks[-1], flush=True)

    # A queued record is not complete just because its result array is empty.
    ev("""()=>{const q=structuredClone(state.tasks.find(t=>t.id==='uf-case-contract'));
      q.id='uf-queued-case';q.name='合同排队记录';q.status='queued';q.progress=0;
      q.phase='等待执行资源';q.result=[];q.successIds=[];q.failedIds=[];q.demoSnapshot=true;
      q.queuePosition=3;delete q.completed;state.tasks.unshift(q);}""")
    records('contract')
    page.locator('[data-uf-change="status"]').select_option('queued')
    page.locator('[data-uf-row="uf-queued-case"] [data-action="uf-open"]').click()
    assert page.locator('.uf-queued').is_visible()
    assert ev('currentTask().status')=='queued'
    assert ev('currentTask().result.length')==0
    page.locator('.uf-queued [data-action="tc-stop"]').click()
    assert ev('modal')=='confirm'
    click('tc-stop-confirm')
    assert ev("state.tasks.find(t=>t.id==='uf-queued-case').status")=='stopped'
    assert ev("state.tasks.find(t=>t.id==='uf-queued-case').result.length")==0
    checks.append('排队记录在工具内明确等待状态，不伪造完成；可沿用原确认流程终止')
    print(checks[-1], flush=True)

    # Awaiting fee input is resumed in the same tool and same task.
    records('prepaid')
    page.locator('[data-uf-change="status"]').select_option('awaiting')
    page.locator('[data-uf-row="'+fixtures['prepaid']+'"] [data-action="uf-open"]').click()
    count=ev('state.tasks.length')
    assert page.locator('#fee-base').is_editable()
    page.locator('#fee-base').fill('1,000,000.00')
    click('calculate-fee')
    page.wait_for_function("currentTask()?.status==='completed'")
    assert ev('currentTask().id')==fixtures['prepaid']
    assert ev('state.tasks.length')==count
    assert ev('Number(currentTask().base)')==1000000
    assert '费用计算报告' in page.locator('#app').inner_text()
    checks.append('工具内分析记录直接续填费用基数，沿用同一任务并在当前工具生成报告')
    print(checks[-1], flush=True)

    # Error details are source text, not markup, and each tool family must
    # show the actual failure rather than only a generic retry instruction.
    malicious='<img data-uf-malicious="1" src="missing-uf-asset" onerror="window.ufInjected=true">模型服务超时，请稍后重试'
    for tool_id,error_key in [('extract','error'),('word','errorMessage'),('contract','failureMessage')]:
        task_id='uf-failure-detail-'+tool_id
        ev("""x=>{const t=structuredClone(state.tasks.find(t=>t.id===x.original));
          t.id=x.id;t.name='失败原因核验 '+x.tool;t.created='2029-01-01T12:00:00Z';
          t.status='failed';t.result=[];t.successIds=[];t.failedIds=[...t.ids];
          delete t.error;delete t.errorMessage;delete t.failureMessage;
          t[x.key]=x.reason;state.tasks.unshift(t);}""",
          {'id':task_id,'tool':tool_id,'original':fixtures[tool_id],'key':error_key,'reason':malicious})
        records(tool_id)
        page.locator('[data-uf-input="query"]').fill('失败原因核验 '+tool_id)
        assert malicious in page.locator('[data-uf-row="'+task_id+'"]').inner_text()
        page.locator('[data-uf-row="'+task_id+'"] [data-action="uf-open"]').click()
        assert page.locator('.uf-failure-reason').inner_text()=='失败原因：'+malicious, tool_id
        assert page.locator('[data-uf-malicious]').count()==0
        assert not ev('Boolean(window.ufInjected)')
        ev("id=>{const t=state.tasks.find(t=>t.id===id);delete t.error;delete t.errorMessage;delete t.failureMessage;render()}",task_id)
        assert '服务未返回具体原因' in page.locator('.uf-failure-reason').inner_text(), tool_id
        ev("x=>{state.tasks.find(t=>t.id===x.id).error={message:'对象错误信息：连接超时'};render()}", {'id':task_id})
        assert '对象错误信息：连接超时' in page.locator('.uf-failure-reason').inner_text(), tool_id
    checks.append('提取、词云与合同失败页和记录显示实际错误，兼容对象message及未返回原因；错误HTML作为纯文本不执行')
    print(checks[-1], flush=True)

    # Record polling updates progress/results in place. It must not recreate
    # the search field, steal typing focus, or reset a long list's scroll.
    ev("""()=>{const base=state.tasks.find(t=>t.id==='uf-case-word');
      for(let i=0;i<30;i++){const t=structuredClone(base);t.id='uf-live-'+i;
        t.name='动态核验记录 '+i;t.created=new Date(Date.parse('2030-01-01T00:00:00Z')-i*1000).toISOString();
        t.status=i===0?'running':'completed';t.demoSnapshot=true;
        state.tasks.unshift(t);}}
    """)
    records('word')
    page.locator('[data-uf-change="size"]').select_option('50')
    query=page.locator('[data-uf-input="query"]')
    query.fill('动态核验记录')
    query.evaluate("el=>{el.dataset.qaStable='true';el.focus()}")
    assert '查看进度' in page.locator('[data-uf-row="uf-live-0"]').inner_text()
    scroll=page.locator('.uf-records-scroll')
    scroll.evaluate('el=>el.scrollTop=140')
    scroll_before=scroll.evaluate('el=>el.scrollTop')
    assert scroll_before>0
    ev("()=>{const t=state.tasks.find(t=>t.id==='uf-live-0');t.status='completed';t.progress=100}")
    page.wait_for_function("""document.querySelector('[data-uf-row="uf-live-0"] [data-action="uf-open"]')?.textContent==='查看结果'""")
    assert query.input_value()=='动态核验记录'
    assert query.evaluate("el=>el.dataset.qaStable==='true'&&el===document.activeElement")
    assert abs(scroll.evaluate('el=>el.scrollTop')-scroll_before)<=1
    target=page.locator('[data-uf-row="uf-live-0"] [data-action="uf-open"]')
    target.evaluate('el=>el.focus({preventScroll:true})')
    ev("()=>{state.tasks.find(t=>t.id==='uf-live-0').name+=' 已更新'}")
    page.wait_for_function("""document.querySelector('[data-uf-row="uf-live-0"] strong')?.textContent.endsWith('已更新')""")
    assert ev("document.activeElement?.dataset.action==='uf-open'&&document.activeElement.closest('[data-uf-row]')?.dataset.ufRow==='uf-live-0'")
    assert abs(scroll.evaluate('el=>el.scrollTop')-scroll_before)<=1
    click('close-modal')
    checks.append('分析记录自动更新运行至完成；保留检索输入、输入焦点、列表操作焦点与长列表滚动位置')
    print(checks[-1], flush=True)

    # The execution mode remains a real input. Choosing mode 2 alone must not
    # force navigation; only the separate explicit destination opt-in does.
    for tool_id,modal_name,execution_id,confirm in [
        ('extract','ew-submit','ew-execution','ew-submit-confirm'),
        ('word','aw-submit','aw-execution','aw-submit-confirm'),
        ('contract','tw-submit','tw-execution','tw-submit-confirm'),
    ]:
        ev("""id=>{nav('tool',id);loadSample();if(id==='extract'){
          openModal('xt-apply',{id:'sys-extract'});xtApply();}render();}""", tool_id)
        assert ev('validate(false)')==[], tool_id
        count=ev('state.tasks.length')
        click('run')
        assert ev('modal')==modal_name
        assert not page.locator('#uf-go-task-center').is_checked()
        select=page.locator('#'+execution_id)
        assert select.locator('xpath=ancestor::details').count()==1
        select.locator('xpath=ancestor::details').locator('summary').click()
        select.select_option('2')
        click(confirm)
        assert ev('state.view')=='tool' and ev('state.toolId')==tool_id, tool_id
        assert ev('currentTask().executionMode')==2, tool_id
        assert page.locator('[data-action="uf-records"]:visible').count()==1, tool_id
        page.wait_for_function("currentTask()?.status==='completed'")
        assert ev('state.view')=='tool' and ev('currentTask().result.length')>0, tool_id
        assert page.locator('[data-action="uf-records"]:visible').count()==1, tool_id
        assert ev('state.tasks.length')==count+1, tool_id
        assert ev('Number(currentTask().config.executionMode)')==2, tool_id
        task_id=ev('currentTask().id')
        action('tr-info', id=task_id)
        action('tc-info-tab', tab='config')
        execution_mode=page.locator('#modal-root .tc-config dt').filter(has_text='执行方式').locator('xpath=following-sibling::dd[1]').inner_text()
        assert execution_mode=='排队执行', (tool_id,execution_mode)
        click('close-modal')
        if tool_id=='extract':
            assert ev('ewExecutionPayload(currentTask()).task_switch')==2
    checks.append('三类提交均默认当前页显示进度及结果；选择执行方式2不强制跳转，原参数含义保留')
    print(checks[-1], flush=True)

    # A destination opt-in must not navigate when validation rejects the
    # submission; cancellation must leave the editable draft intact as well.
    for tool_id,modal_name,name_id,confirm,error_id in [
        ('extract','ew-submit','ew-task-name','ew-submit-confirm','ew-submit-error'),
        ('word','aw-submit','aw-task-name','aw-submit-confirm','aw-submit-error'),
        ('contract','tw-submit','tw-task-name','tw-submit-confirm','tw-submit-error'),
    ]:
        ev("id=>{nav('tool',id);render()}", tool_id)
        count=ev('state.tasks.length')
        draft=ev('JSON.stringify(ws().config)')
        click('run')
        page.locator('.uf-submit-options>summary').click()
        page.locator('#uf-go-task-center').check()
        page.locator('#'+name_id).fill('   ')
        click(confirm)
        assert ev('modal')==modal_name, tool_id
        assert ev('state.view')=='tool' and ev('state.toolId')==tool_id, tool_id
        assert ev('state.tasks.length')==count, tool_id
        assert '请填写任务名称' in page.locator('#'+error_id).inner_text(), tool_id
        click('close-modal')
        assert ev('currentTask()') is None, tool_id
        assert ev('state.tasks.length')==count, tool_id
        assert ev('JSON.stringify(ws().config)')==draft, tool_id
    checks.append('三类提交空任务名保持弹窗并明确报错；即使勾选任务中心也不跳转，取消不新建或改写草稿')
    print(checks[-1], flush=True)

    # Configuration and download are subpages of this exact analysis, so the
    # labelled return action must return here, not send the user to history.
    task_id=fixtures['contract']
    before=snapshot(task_id)
    count=ev('state.tasks.length')
    for name,mode in [('tr-config','config'),('tr-download','download')]:
        action(name, id=task_id)
        assert ev('trMode()')==mode
        click('tr-back')
        assert ev('state.view')=='tool' and ev('state.toolId')=='contract'
        assert ev('currentTask().id')==task_id and ev('trMode()')==''
        assert page.locator('.ra-result-commandbar').is_visible()
        assert snapshot(task_id)==before
        assert ev('state.tasks.length')==count
    checks.append('执行配置与导出数据页的分析结果返回同一任务结果，历史不改写且不重复提交')
    print(checks[-1], flush=True)

    ev("nav('tool','contract');loadSample();render()")
    count=ev('state.tasks.length')
    click('run')
    page.locator('.uf-submit-options>summary').click()
    page.locator('#uf-go-task-center').check()
    click('tw-submit-confirm')
    assert ev('state.view')=='tasks'
    assert ev('state.tasks.length')==count+1
    checks.append('显式选择任务中心后才跳转，任务仍可回到本工具查看')
    print(checks[-1], flush=True)
    assert not errors,errors
    browser.close()

report={'checks':checks,'layouts':layouts,'errors':errors}
(ROOT/'review/in-tool-records-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
