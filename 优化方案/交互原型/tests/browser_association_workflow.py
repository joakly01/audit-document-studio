"""Two-table setup, original four-section results, group filtering and exports."""
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
checks=[]
errors=[]
layouts=[]
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce')
    page.set_default_timeout(12000)
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(os.environ.get('AUDIT_UI_URL','http://127.0.0.1:8765')+'/#tool/association',wait_until='load')
    page.wait_for_function("typeof pgBase!=='undefined'")
    if not page.evaluate("typeof aswActive==='function'"):
        page.add_style_tag(url='/association-workflow.css')
        page.add_script_tag(url='/association-workflow.js')
    ev=page.evaluate
    def action(name,**kwargs):
        ev('x=>handleAction(x.name,{dataset:x.data})',{'name':name,'data':kwargs})
    def click(name):
        page.locator('[data-action="'+name+'"]:visible').last.click()
    def note(text):
        checks.append(text)
        print('PASS '+text,flush=True)
    ev('loadSample();render()')
    assert page.locator('.asw-source-card').count()==2
    assert not page.locator('.asw-layout #ef-raw-content').count()
    assert page.locator('[data-pg-prompt="compare"]').is_visible()
    assert ev('validate(false)')==[]
    page.locator('[data-work="tableAName"]').fill('待查建设台账')
    page.locator('[data-work="tableBName"]').fill('资金安排台账')
    assert ev('ws().tableAName')=='待查建设台账'
    assert ev('ws().tableBName')=='资金安排台账'
    # Selection remains single-slot and cancellation leaves both roles intact.
    before=ev('JSON.stringify({a:ws().tableA,b:ws().tableB,ids:ws().ids})')
    action('pick-table',slot='A')
    assert ev('modal')=='picker'
    page.keyboard.press('Escape')
    assert ev('JSON.stringify({a:ws().tableA,b:ws().tableB,ids:ws().ids})')==before
    note('两张台账角色与业务名称清楚，单槽选择取消不串表，原文按需查看')

    original=ev('JSON.stringify(ws().config.association)')
    click('v2-association')
    assert page.locator('.asw-editor-dialog').is_visible()
    click('asw-edit-field')
    page.locator('[data-asw-edit="name"]').fill('临时修改后取消')
    click('asw-field-cancel')
    assert ev("editorDraft.rows.some(r=>r.name==='临时修改后取消')") is False
    click('asw-add-field')
    page.locator('[data-asw-edit="name"]').fill('新增列')
    page.locator('[data-asw-edit="a"]').select_option('项目名称')
    page.locator('[data-asw-edit="b"]').select_option('项目名称')
    page.locator('[data-asw-edit="rule"]').fill('按名称比较并说明依据')
    click('asw-field-save')
    assert ev('editorDraft.rows.length')==4
    # Remove in the draft, then abandon the whole editor: configuration untouched.
    page.locator('[data-action="asw-edit-field"][data-index="3"]').click()
    click('asw-field-delete')
    assert ev('editorDraft.rows.length')==3
    action('asw-editor-tab',tab='decision')
    page.locator('[data-edit="mode"]').select_option('standard')
    page.wait_for_function("editorDraft.mode==='standard'")
    assert not page.locator('[data-edit="perRow"]').count()
    page.locator('[data-edit="locks.partial"]').check()
    assert ev('editorDraft.locks.partial') is True
    page.keyboard.press('Escape')
    assert ev('JSON.stringify(ws().config.association)')==original
    note('分区编辑保留增删字段、评分、四项锁定及模式边界，取消整份草稿不改配置')

    click('v2-association')
    action('asw-editor-tab',tab='hard')
    action('v2-hard-add',kind='and')
    assert ev('editorDraft.hardRules[0].rules.length')==2
    action('v2-hard-sub',index='0')
    assert ev('editorDraft.hardRules[0].rules.length')==3
    action('v2-hard-delete',index='0')
    action('asw-editor-tab',tab='decision')
    page.locator('[data-edit="mode"]').select_option('batch')
    page.locator('[data-edit="perRow"]').fill('7')
    page.locator('[data-edit="total"]').fill('12000')
    page.locator('[data-edit="full"]').fill('4.6')
    page.locator('[data-edit="partial"]').fill('3.4')
    click('v2-save-editor')
    assert ev('modal') is None
    fragment=ev("configurationFragment('association',ws().config)")
    g=fragment['compare_config']
    assert g['max_llm_pairs_per_table1_row']==7
    assert g['max_total_llm_pairs']==12000
    assert g['llm_config']['full_match_threshold']==4.6
    assert g['llm_config']['partial_match_threshold']==3.4
    assert g['logical_field_mapping']['F1']==['项目名称','项目名称']
    assert g['complete_field_mapping']['计划投资（万元）']=='安排资金（万元）'
    assert g['table1_numeric_fields']==['计划投资（万元）']
    assert g['table2_numeric_fields']==['安排资金（万元）']
    assert fragment['table1']['file_uuid']=='d10' and fragment['table2']['file_uuid']=='d11'
    assert ev('validate(false)')==[]
    note('单项与组合硬规则可维护，批量每行/全局上限、判定阈值及原派生映射完整保存')

    # High-volume mapping remains paged with all fields preserved in execution.
    ev("""()=>{ws().config.association.rows=Array.from({length:1000},(_,i)=>({key:'F'+(i+1),name:'核对字段'+i,a:'项目名称',b:'项目名称',type:'similarity',threshold:.8,weight:.001,rule:'按名称原文核验'}));render()}""")
    assert page.locator('.asw-field-table tbody tr').count()==20
    page.locator('[data-asw-input="fields"]').fill('核对字段999')
    assert page.locator('.asw-field-table tbody tr').count()==1
    assert len(ev("configurationFragment('association',ws().config).compare_config.table1_fields"))==1
    assert len(ev("Object.keys(configurationFragment('association',ws().config).compare_config.field_comparison_mapping)"))==1000
    page.locator('[data-asw-input="fields"]').fill('')
    for width,height in [(1366,768),(1024,480),(390,600)]:
        page.set_viewport_size({'width':width,'height':height})
        if width<=800: action('asw-panel',panel='config')
        ev("render();document.getElementById('toast').classList.remove('show')")
        metric=ev("""()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,table:document.querySelector('.asw-field-list .asw-table-scroll').getBoundingClientRect().toJSON(),pager:document.querySelector('.asw-field-list .asw-pager').getBoundingClientRect().toJSON()})""")
        assert metric['scrollWidth']<=width,metric
        assert metric['table']['height']>=60,metric
        assert metric['pager']['bottom']<=height+1,metric
        layouts.append(metric)
        page.screenshot(path=str(ROOT/'review'/f'association-setup-{width}.png'),animations='disabled')
    note('1000个映射分页检索不截断执行字段，三种尺寸下清单滚动与分页可达')
    page.set_viewport_size({'width':1366,'height':768})
    ev('ws().config.association='+original+';render()')
    click('run')
    click('tw-submit-confirm')
    page.wait_for_function("currentTask()?.status==='completed'")
    ev("""()=>{currentTask().associationResult={compare_response:{comparison_results:[
      {table1_item:{项目名称:'项目甲',预算:0,已批:false,额外字段:{原值:0}},table2_item:{项目名称:'项目甲',预算:0,已批:false},match_type:'完全一致',weighted_score:5,reason:'编码与名称相同，待核验'},
      {table1_item:{项目名称:'项目乙',预算:30},table2_item:{项目名称:'项目乙变更',预算:40},match_type:'不完全一致',weighted_score:4.2,reason:'预算存在差异'},
      {table1_item:{项目名称:'项目丙',预算:20},table2_item:{项目名称:'项目丙续建',预算:22},match_type:'不完全一致',weighted_score:3.6,reason:'需核对是否为续建'}
    ],table1_unique_items:[{项目名称:'原始独有甲',预算:0}],table2_unique_items:[{项目名称:'原始独有乙',已批:false}]}};render();}""")
    assert len(ev('aswNormalize(currentTask())'))==5
    assert ev("aswNormalize(currentTask()).map(r=>r.category)")==['full','partial','partial','uniqueA','uniqueB']
    # The original ResultTable four-section shape and historical single-side rows
    # are accepted without fabricating the missing counterpart.
    legacy=ev("""()=>{const t={...currentTask(),associationResult:null,result:{yz:[
      {组序号:1,_sourceTable:'table1',_rawItem:{项目:'甲',金额:0},说明:'原分区说明'},
      {组序号:1,_sourceTable:'table2',_rawItem:{项目:'甲',已批:false}}],bwqyz:[],
      ggdyxm:[{_rawItem:{项目:'表一独有'}}],tzxmzxsp:[{_rawItem:{项目:'表二独有'}}]}};
      return {rows:aswNormalize(t).map(r=>({category:r.category,doc:r.doc,other:r.other,a:r.a,b:r.b})),download:trCanDownload(t)};}""")
    assert [r['category'] for r in legacy['rows']]==['full','uniqueA','uniqueB']
    assert legacy['rows'][2]['doc']=='d11' and legacy['rows'][2]['other'] is None
    assert legacy['rows'][2]['a']=={} and legacy['rows'][2]['b']=={'项目':'表二独有'}
    assert legacy['download'] is True
    old_side=ev("""()=>{const t={...currentTask(),associationResult:null,result:[{category:'uniqueB',doc:'d11',b:{项目:'旧记录独有',金额:0}}]};
      const r=aswNormalize(t)[0];return {category:r.category,readable:aswReadable(t,r),other:r.other,a:r.a,b:r.b};}""")
    assert old_side['category']=='uniqueB' and old_side['other'] is None and old_side['a']=={} and old_side['readable']
    snapshot=ev('JSON.stringify(currentTask())')
    action('asw-result-detail',key='pair:0')
    detail=page.locator('.asw-evidence-dialog').inner_text()
    assert '0' in detail and 'false' in detail and '额外字段' in detail and '原值' in detail
    page.keyboard.press('Escape')
    # Original API decisions are group-level and scoped per consistency section.
    ev("window.auditAssociationRefine=async args=>{window.aswRequest=args;return {status:'success',decisions:{yz:[{group_key:1,keep:true,filter_reason:'保留完全一致'}],bwqyz:[{group_key:1,keep:false},{group_key:2,keep:true,filter_reason:'预算续建核验'}]}}}")
    click('refine')
    page.locator('#asw-refine-prompt').fill('只保留本次需要核验的配对组')
    click('asw-refine-apply')
    page.wait_for_function("modal===null")
    assert ev('aswRequest.task_uuid')==ev('currentTask().id')
    assert ev('aswRequest.prompt')=='只保留本次需要核验的配对组'
    assert ev("aswVisible(currentTask()).map(r=>r.key)")==['pair:0','pair:2','uniqueA:0','uniqueB:0']
    assert ev('JSON.stringify(currentTask())')==snapshot
    matrix=ev("exportRows(currentTask(),'all')")
    assert len(matrix)==5
    assert any('额外字段' in x for x in matrix[0])
    assert 'false' in json.dumps(matrix,ensure_ascii=False)
    click('export')
    page.locator('#export-format').select_option('json')
    with TemporaryDirectory() as tmp,page.expect_download() as event:
        click('do-export')
        d=event.value
        target=Path(tmp)/d.suggested_filename
        d.save_as(target)
        data=json.loads(target.read_text('utf-8-sig'))
        assert len(data['results'])==4
        assert [x['category'] for x in data['results']][-2:]==['uniqueA','uniqueB']
        assert data['results'][0]['result']['table1_item']['已批'] is False
        assert data['filter']['prompt']=='只保留本次需要核验的配对组'
    click('restore-candidates')
    assert len(ev('aswVisible(currentTask())'))==5
    assert ev('JSON.stringify(currentTask())')==snapshot
    note('原四区结果与额外源列完整，二次筛选按组保留独有区，导出当前四区且可无损恢复')

    # Local demo accepts only its declared score/keyword conditions, never fake AI decisions.
    ev('delete window.auditAssociationRefine')
    click('refine')
    page.locator('#asw-refine-prompt').fill('保留评分不低于4分的配对。')
    click('asw-refine-apply')
    assert len(ev('aswVisible(currentTask())'))==4
    click('restore-candidates')
    # Explicit task-external or unreadable refs cannot be replaced by the visible pair IDs.
    ev("currentTask().associationResult.compare_response.comparison_results[0].refs=['d1'];render()")
    assert ev("aswNormalize(currentTask()).filter(r=>aswReadable(currentTask(),r)).length")==4
    assert '项目甲' not in page.locator('.asw-results').inner_text()
    action('asw-result-detail',key='pair:0')
    assert '无法查看来源' in page.locator('#modal-root').inner_text()
    page.keyboard.press('Escape')
    assert len(ev("exportRows(currentTask(),'all')"))==5
    ev("delete currentTask().associationResult.compare_response.comparison_results[0].refs;render()")
    # Losing either paired source suppresses the whole pair, while a real
    # one-sided record with its own readable source remains visible.
    old_location=ev("({space:file('d11').space,folder:file('d11').folder})")
    ev("""()=>{const d=file('d11');d.space='公共空间';d.folder='两表证据无权限';folderMeta[directoryKey(d.space,d.folder)]={permission:'NONE'};render();}""")
    assert ev("aswVisible(currentTask()).map(r=>r.category)")==['uniqueA']
    assert ev('trCanDownload(currentTask())') is False
    ev("loc=>{Object.assign(file('d11'),loc);render()}",old_location)
    snapshot=ev('JSON.stringify(currentTask())')
    task_id=ev('currentTask().id')
    action('tr-config',id=task_id)
    click('v2-association')
    assert not page.locator('[data-action="asw-add-field"]').count()
    action('asw-editor-tab',tab='decision')
    assert page.locator('[data-edit="mode"]').is_disabled()
    assert page.locator('[data-edit="full"]').is_disabled()
    page.keyboard.press('Escape')
    action('tr-result',id=task_id)
    click('new-analysis')
    assert ev('currentTask()') is None
    assert ev('id=>JSON.stringify(state.tasks.find(t=>t.id===id))',task_id)==snapshot
    note('显式任务外来源在列表/详情/导出均隔离，历史只读与再次分析保留原任务')
    assert not errors,errors
    browser.close()
report={'checks':checks,'errors':errors,'layouts':layouts}
(ROOT/'review'/'association-workflow-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
