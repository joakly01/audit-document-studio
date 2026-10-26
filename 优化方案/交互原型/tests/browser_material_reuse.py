"""Explicit file reuse stages selections, protects drafts, and keeps business roles."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765')
checks, layouts, errors = [], [], []

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    page.set_default_timeout(15000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL+'/#tool/extract', wait_until='load')
    page.wait_for_function("typeof ufRecords==='function'")
    if not page.evaluate("typeof mrResolve==='function'"):
        page.add_style_tag(path=str(ROOT/'dist/material-reuse.css'))
        page.add_script_tag(path=str(ROOT/'dist/material-reuse.js'))

    def ev(code, arg=None):
        return page.evaluate(code, arg)

    def action(name, **data):
        return ev('x=>handleAction(x.name,{dataset:x.data})', {'name':name,'data':data})

    def click(name):
        page.locator('[data-action="'+name+'"]:visible').last.click()

    def note(text):
        checks.append(text)
        print(text, flush=True)

    def source_snapshot():
        return ev("JSON.stringify(state.tasks.find(t=>t.id==='mr-source'))")

    ev("""()=>{
      nav('tool','extract');loadSample();ws().ids=['d1'];render();
      state.tasks.unshift({id:'mr-source',toolId:'extract',name:'可沿用资料的原分析',
        ids:['d1','d2','d3'],config:structuredClone(ws().config),attachments:{d1:['d12']},
        result:[],status:'completed',successIds:['d1','d2','d3'],failedIds:[],created:'2026-10-24T01:00:00Z'});
    }""")
    original_task=source_snapshot()
    original_ids=ev('JSON.stringify(ws().ids)')
    original_config=ev('JSON.stringify(ws().config)')

    def reuse_files():
        ev('startPicker()')
        assert page.locator('[data-action="mr-open-records"]').is_visible()
        click('mr-open-records')
        assert ev('modal')=='mr-records'
        page.locator('#mr-record-query').fill('可沿用资料的原分析')
        page.locator('[data-action="mr-task"][data-id="mr-source"]').click()
        assert ev('modal')=='mr-files'

    reuse_files()
    click('mr-select-all')
    assert ev('modalData.selected')==['d2','d3']
    click('mr-add')
    assert ev('modal')=='picker'
    assert ev('modalData.selected')==['d1','d2','d3']
    assert ev('JSON.stringify(ws().ids)')==original_ids
    assert ev('JSON.stringify(ws().config)')==original_config
    click('close-modal')
    assert ev('JSON.stringify(ws().ids)')==original_ids
    assert source_snapshot()==original_task
    note('从分析记录选文件仅更新资料选择暂存；取消不改工具资料、配置与历史附件快照')

    reuse_files()
    click('mr-select-all')
    ev("file('d2').can_analyze=false")
    click('mr-add')
    assert ev('modalData.selected')==['d1','d3']
    click('confirm-picker')
    assert ev('ws().ids')==['d1','d3']
    assert source_snapshot()==original_task
    ev("delete file('d2').can_analyze")
    note('加入前重新检查分析权限，失权文件不带入；已有选择去重，原任务保持')

    # Explicit source and canonical permissions are both required.
    ref_result=ev("""()=>{
      const ref={...structuredClone(file('d2')),id:'mr-ref',refSourceId:'d2'};state.docs.push(ref);
      const accepted=mrResolve(ref.id,'extract');file('d2').can_analyze=false;
      const denied=mrResolve(ref.id,'extract');delete file('d2').can_analyze;
      ref.can_analyze=false;const referenceDenied=mrResolve(ref.id,'extract');
      state.docs=state.docs.filter(d=>d.id!==ref.id);
      return{accepted,denied,referenceDenied};
    }""")
    assert ref_result['accepted']['id']=='d2'
    assert ref_result['denied']['id'] is None and ref_result['referenceDenied']['id'] is None
    assert ev("mrResolve('d1','engineering').id") is None
    note('引用文件规范化为源文件，引用与源权限均校验；工具不支持的类型不可沿用')

    # Library handoff must protect an existing preparation draft.
    ev("nav('tool','contract');loadSample();ws().config.taskNotes='原合同准备配置';render()")
    config=ev('JSON.stringify(ws().config)')
    ids=ev('JSON.stringify(ws().ids)')
    ev("nav('library');state.librarySelected=['d3'];handleAction('open-tool',{dataset:{id:'contract'}})")
    assert ev('modal')=='mr-handoff' and ev('state.view')=='library'
    click('close-modal')
    assert ev("JSON.stringify(ws('contract').ids)")==ids
    assert ev("JSON.stringify(ws('contract').config)")==config
    action('open-tool',id='contract')
    assert page.locator('[data-mr-change="handoff-mode"][value="merge"]').is_checked()
    click('mr-handoff-confirm')
    assert ev('state.view')=='tool' and ev('state.toolId')=='contract'
    assert ev('ws().ids')==['d1','d3']
    assert ev('JSON.stringify(ws().config)')==config
    assert ev('state.librarySelected')==['d3']
    note('资料库进入已有准备页先审阅，默认合并；取消不改草稿，确认保留配置与库中选择')

    ev("nav('library');state.librarySelected=['d2'];handleAction('open-tool',{dataset:{id:'contract'}})")
    page.locator('[data-mr-change="handoff-mode"][value="replace"]').check()
    click('mr-handoff-confirm')
    assert ev('ws().ids')==['d2']
    assert ev('JSON.stringify(ws().config)')==config
    note('明确选择替换后只替换当前文件范围，分析设置与源文件保持')

    ev("nav('tool','bidding');loadSample();render()")
    projects=ev('JSON.stringify(ws().projects)')
    ev("nav('library');state.librarySelected=['d1'];handleAction('open-tool',{dataset:{id:'bidding'}})")
    click('mr-handoff-confirm')
    assert ev('JSON.stringify(ws().projects)')==projects
    assert ev('ws().unassigned')==['d1']
    assert ev('ws().ids')==['d6','d7','d8','d1']
    note('招投标合并保留项目、招标文件及投标单位角色，新文件进入待归组')

    # Reuse within a tender role remains single-select and staged.
    ev("startPicker({bid:true,role:'tender',project:ws().projects[0].id,selected:['d6']})")
    click('mr-open-records')
    page.locator('#mr-record-query').fill('可沿用资料的原分析')
    page.locator('[data-action="mr-task"][data-id="mr-source"]').click()
    page.locator('[data-mr-change="file"][value="d2"]').check()
    click('mr-add')
    assert ev('modalData.selected')==['d2']
    assert ev('ws().projects[0].tender')==['d6']
    click('close-modal')
    note('招标文件槽位沿用时只选一份，在最终确认前不改原角色')

    # Association's business roles cannot be inferred from selection order.
    ev("delete state.work.association;nav('library');state.librarySelected=['d10','d11'];handleAction('open-tool',{dataset:{id:'association'}})")
    assert ev('modal')=='mr-handoff'
    assert page.locator('[data-mr-change="slot"][data-slot="A"]').input_value()==''
    assert page.locator('[data-mr-change="slot"][data-slot="B"]').input_value()==''
    click('mr-handoff-confirm')
    assert ev('modal')=='mr-handoff'
    assert '两张不同' in page.locator('#mr-error').inner_text()
    page.locator('[data-mr-change="slot"][data-slot="A"]').select_option('d11')
    page.locator('[data-mr-change="slot"][data-slot="B"]').select_option('d11')
    click('mr-handoff-confirm')
    assert ev('modal')=='mr-handoff'
    page.locator('[data-mr-change="slot"][data-slot="B"]').select_option('d10')
    click('mr-handoff-confirm')
    assert ev('state.toolId')=='association'
    assert ev('ws().tableA')=='d11' and ev('ws().tableB')=='d10'
    assert ev('ws().ids')==['d11','d10']
    note('两表从资料库进入时明确指定表一/表二，未选择或重复台账不确认，不按选择顺序推断')

    ev("nav('tool','extract');startPicker({main:'d1',selected:[]})")
    assert page.locator('[data-action="mr-open-records"]').count()==0
    click('close-modal')
    ev("nav('tool','association');startPicker({table:true,slot:'A',selected:['d11']})")
    assert page.locator('[data-action="mr-open-records"]').count()==0
    click('close-modal')
    note('附件和单表槽位选择不增加混淆的分析记录沿用入口')

    # Many historical tasks and files are navigable without loading an unbounded list.
    ev("""()=>{const base=file('d2'),files=[];for(let i=0;i<75;i++){
      const id='mr-large-file-'+i;state.docs.push({...structuredClone(base),id,name:'批量资料-'+i+'.pdf'});files.push(id);}
      for(let i=0;i<23;i++)state.tasks.unshift({id:'mr-large-task-'+i,toolId:'extract',name:'批量沿用测试 '+i,
        ids:files,status:'completed',result:[],config:{},created:new Date(Date.parse('2026-11-01T00:00:00Z')+i*1000).toISOString()});
      nav('tool','extract');ws().ids=['d1'];render();startPicker();}
    """)
    click('mr-open-records')
    page.locator('#mr-record-query').fill('批量沿用测试')
    first=page.locator('[data-action="mr-task"]').evaluate_all('els=>els.map(e=>e.dataset.id)')
    page.locator('[data-action="mr-page"][data-kind="record"][data-step="1"]').click()
    second=page.locator('[data-action="mr-task"]').evaluate_all('els=>els.map(e=>e.dataset.id)')
    assert set(first).isdisjoint(second)
    page.locator('[data-action="mr-task"]').first.click()
    page.locator('[data-mr-change="file"]').first.check()
    assert page.locator('[data-mr-change="file"]').first.evaluate('el=>el===document.activeElement')
    page.wait_for_function("document.querySelector('[data-mr-change=page]').indeterminate")
    page.locator('[data-action="mr-page"][data-kind="file"][data-step="1"]').click()
    assert len(ev('modalData.selected'))==1
    click('mr-select-all')
    assert len(ev('modalData.selected'))==75
    page.locator('#mr-file-query').fill('批量资料-74.pdf')
    assert page.locator('[data-mr-change="file"]').count()==1
    assert page.locator('#mr-file-query').evaluate('el=>el===document.activeElement')
    click('mr-add')
    assert len(ev('modalData.selected'))==76
    click('close-modal')
    assert ev('ws().ids')==['d1']
    note('23条记录与75份主文件支持分页、跨页保留、本页半选和全部页选择；搜索输入不丢焦点')

    ev("nav('tool','extract');ws().ids=['d1'];render()")
    reuse_files()
    for width,height in [(1366,768),(1024,480),(390,600)]:
        page.set_viewport_size({'width':width,'height':height})
        metric=ev("""()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
          footer:document.querySelector('#modal-root .modalfoot').getBoundingClientRect().toJSON()})""")
        assert metric['scrollWidth']<=width
        assert metric['footer']['bottom']<=height+1,metric
        layouts.append(metric)
        page.screenshot(path=str(ROOT/'review'/f'material-reuse-{width}.png'),animations='disabled')
    page.set_viewport_size({'width':390,'height':600})
    click('mr-records-back')
    metric=ev("({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,footer:document.querySelector('#modal-root .modalfoot').getBoundingClientRect().toJSON()})")
    assert metric['scrollWidth']<=390 and metric['footer']['bottom']<=601,metric
    layouts.append(metric)
    assert not errors,errors
    assert source_snapshot()==original_task
    note('三尺寸沿用文件表独立滚动、页脚可达，所有操作无脚本错误且历史完整保留')
    browser.close()

report={'checks':checks,'layouts':layouts,'errors':errors}
(ROOT/'review/material-reuse-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
