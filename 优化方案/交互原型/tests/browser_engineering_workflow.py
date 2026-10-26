"""Engineering: independent phases, full field settings and source-backed candidates."""
from pathlib import Path
import json
import os
import tempfile
import traceback
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('AUDIT_UI_URL','http://127.0.0.1:8765')
checks,errors,failures,layouts=[],[],[],[]

class Session:
    def __init__(self,browser):
        self.context=browser.new_context(viewport={'width':1366,'height':768},accept_downloads=True,reduced_motion='reduce')
        self.page=self.context.new_page();self.page.set_default_timeout(15000)
        self.page.on('pageerror',lambda e:errors.append(str(e)))
        self.page.goto(URL+'/#tool/engineering',wait_until='load')
        self.page.wait_for_function("typeof egBase!=='undefined'")
        self.ev("loadSample();render()")
    def ev(self,code,arg=None):return self.page.evaluate(code,arg)
    def action(self,name,**data):return self.ev('x=>handleAction(x.name,{dataset:x.data})',{'name':name,'data':data})
    def click(self,name):self.page.locator('[data-action="'+name+'"]:visible').last.click()
    def execute(self):
        assert self.ev('validate(false)')==[],self.ev('validate(false)')
        self.click('run');assert self.ev('modal')=='tw-submit';self.click('tw-submit-confirm')
        self.page.wait_for_function("currentTask()?.status==='completed'",timeout=25000)
    def close(self):self.context.close()

def phases_and_fields(s):
    assert s.page.locator('.eg-layout').is_visible()
    assert not s.page.locator('#ef-raw-content').count()
    assert s.page.locator('.eg-materials [data-action="add-tool-materials"]').is_visible()
    assert '两类分析同时执行' in s.page.locator('.eg-config').inner_text()
    snapshot=s.ev('JSON.stringify(ws().config.engineering.parent)')
    s.action('eg-field',index='0')
    s.page.locator('[data-eg-edit="name"]').fill('项目名称核对')
    s.page.locator('[data-eg-edit="weight"]').fill('59')
    s.page.locator('[data-eg-edit="rule"]').fill('名称一致为5分，名称不同按实际证据评分。')
    s.click('eg-field-save')
    assert s.ev('ws().config.engineering.duplicate.rows[0].weight')==.59
    assert s.ev('JSON.stringify(ws().config.engineering.parent)')==snapshot
    assert s.ev('validate(false)')==[]
    s.action('eg-field',index='0');s.page.locator('[data-eg-edit="name"]').fill('取消修改')
    s.click('close-modal')
    assert s.ev('ws().config.engineering.duplicate.rows[0].name')=='项目名称核对'
    s.action('eg-stage',stage='parent')
    assert s.page.locator('[data-pg-prompt="parent"]').is_visible()
    assert not s.page.locator('[data-pg-prompt="duplicate"]').count()
    assert s.ev('JSON.stringify(ws().config.engineering.parent)')==snapshot
    s.ev("file('d10').columns=file('d10').columns.filter(x=>x!=='建设单位');render()")
    assert '缺少列' in s.page.locator('.eg-file-status').inner_text()
    assert any('缺少列' in e for e in s.ev('validate(false)'))

def full_request_and_delete(s):
    s.ev("""()=>{const g=ws().config.engineering.duplicate;g.singleTable={
      field_mapping:{F1:{custom_flag:'keep',skip_if_both_empty:true,count_toward_min_match:false,value_normalizer:'string_clean'},F2:{},F3:{}},auxiliary_columns:['项目编码'],column_aliases:{旧名称:'项目名称'},
      llm_config:{phase_check_field:'F3',phase_check_enabled:true,strict_negative_prompt:'保留否定规则',
       hard_rules:[{field:'F2',condition:'match'},{field:'F3',condition:'match'}],veto_rules:[{field:'F3',min_score:1}],arbitration:{enabled:true,prefer:'system'}},
      prescreen_config:{investment_fallback_pairs:true,custom_prescreen:9}};render();}""")
    s.action('eg-field',index='1');s.click('eg-field-delete')
    assert s.ev('modal')=='eg-field-delete-confirm';s.click('close-modal')
    assert s.ev('modal')=='eg-field';s.click('eg-field-delete');s.click('eg-field-delete-confirm')
    assert s.ev('ws().config.engineering.duplicate.rows.map(r=>r.key)')==['F1','F2']
    single=s.ev("egSingle(ws().config.engineering.duplicate,'duplicate')")
    assert single['llm_config']['hard_rules']==[{'field':'F2','condition':'match'}]
    assert single['llm_config']['veto_rules'][0]['field']=='F2'
    assert single['llm_config']['phase_check_field']=='F2'
    assert single['field_mapping']['F1']['custom_flag']=='keep'
    assert single['field_mapping']['F1']['skip_if_both_empty'] is True
    assert single['field_mapping']['F1']['count_toward_min_match'] is False
    assert single['field_mapping']['F1']['value_normalizer']=='string_clean'
    assert single['prescreen_config']['custom_prescreen']==9
    assert single['auxiliary_columns']==['项目编码']
    s.action('eg-options')
    s.page.locator('[data-eg-option="additional"]').fill('只核对本次台账，保留来源行。')
    s.click('eg-options-save')
    payload=s.ev("configurationFragment('engineering',ws().config)")
    assert payload['exec_mode']=='custom'
    cfg=payload['custom_config'];assert cfg['mode']=='engineering_project'
    assert cfg['duplicate_threshold']==3.35 and cfg['parent_child_threshold']==3.4
    assert cfg['duplicate_detection']['llm_config']['threshold_comparison']=='gte'
    assert cfg['duplicate_detection']['logical_field_mapping']['F2']=='计划投资（万元）'
    assert cfg['duplicate_detection']['llm_config']['additional_prompt']=='只核对本次台账，保留来源行。'
    assert cfg['engineering_repeat_project']['prompt']=='只核对本次台账，保留来源行。'
    assert cfg['duplicate_detection']['llm_config']['strict_negative_prompt']=='保留否定规则'
    assert cfg['duplicate_detection']['column_aliases']=={'旧名称':'项目名称'}

def volume(s):
    s.ev("""()=>{const c=ws().config;const rows=Array.from({length:1000},(_,i)=>({key:'F'+(i+1),name:'比较字段'+i,a:'列'+i,type:'similarity',threshold:.8,weight:.001,rule:'评分依据'+i}));c.engineering.duplicate.rows=rows;c.engineering.parent.rows=structuredClone(rows);file('d10').columns=rows.map(r=>r.a);render();}""")
    assert s.page.locator('.eg-table tbody tr').count()==20
    s.click('eg-field-page');assert '比较字段20' in s.page.locator('.eg-table').inner_text()
    s.page.locator('[data-eg-input="fields"]').fill('比较字段999')
    assert s.page.locator('.eg-table tbody tr').count()==1
    assert s.ev('validate(false)')==[]
    payload=s.ev("configurationFragment('engineering',ws().config)")
    assert len(payload['custom_config']['duplicate_detection']['field_mapping'])==1000
    assert len(payload['custom_config']['parent_child_analysis']['field_mapping'])==1000
    s.page.locator('[data-eg-input="fields"]').fill('')
    for width,height in [(1366,768),(1024,480),(390,600)]:
        s.page.set_viewport_size({'width':width,'height':height})
        s.ev("egView.panel='config';render();document.getElementById('toast').classList.remove('show')")
        metric=s.ev("""()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
          table:document.querySelector('.eg-table-scroll').getBoundingClientRect().toJSON(),
          pager:document.querySelector('.eg-pager').getBoundingClientRect().toJSON()})""")
        assert metric['scrollWidth']<=width,metric
        assert metric['table']['height']>=60,metric
        assert metric['pager']['bottom']<=height+1,metric
        layouts.append(metric)
        s.page.screenshot(path=str(ROOT/'review'/f'engineering-prepare-{width}.png'),animations='disabled')

def evidence_and_export(s):
    s.execute()
    s.ev("""()=>{const t=currentTask();t.ids.push('d11');t.successIds.push('d11');t.result=[{doc:'d10',duplicate_detection:{status:'success',field_score_labels:{F1:'事项名称'},field_weights:{F1:1},duplicates:[
      {project1:{事项名称:'园区建设',金额:0},project2:{事项名称:'园区改造',材料齐备:false},weighted_score:0,field_scores:{F1:0},reason:'ZERO-SCORE-KEPT'},
      ...Array.from({length:102},(_,i)=>({project1:{事项名称:'项目'+i},project2:{事项名称:'对照'+i},weighted_score:4.2,reason:'核对'+i}))]},
      parent_child_analysis:{status:'success',config_snapshot:{logical_field_mapping:{F1:'事项名称'}},results:[
       {group_id:'G1',match_type:'model',main_project:{事项名称:'主体工程'},sub_projects:[{project:{事项名称:'配套工程'},weighted_score:4.1,field_scores:{F1:4},reason:'结合范围核验'}]},
       {group_id:'G2',match_type:'code_exact',main_project:{事项名称:'编码主项目'},sub_projects:[{project:{事项名称:'编码子项目'},weighted_score:5}]}]}},
      {doc:'d2',kind:'duplicate',a:'OUTSIDE-SECRET',b:'外部项目',score:5},
      {doc:'d10',refs:['d2'],kind:'duplicate',a:'REF-SECRET',b:'跨任务项目',score:5},
      {doc:'d10',kind:'duplicate',project1:{项目名称:'CROSS-FILE-SECRET',file_uuid:'d10'},project2:{项目名称:'跨表项目',file_uuid:'d11'},score:5}];render();}""")
    assert s.page.locator('.eg-result-table tbody tr').count()==20
    assert 'OUTSIDE-SECRET' not in s.page.locator('.eg-results').inner_text()
    assert s.ev('tcOutput(currentTask()).text')=='重复 103 组 · 主子 2 组'
    assert s.ev("egNormalize(currentTask()).filter(r=>egReadable(currentTask(),r)).some(r=>r.a==='CROSS-FILE-SECRET')") is False
    s.page.locator('[data-eg-input="results"]').fill('ZERO-SCORE-KEPT')
    assert s.page.locator('.eg-result-table tbody tr').count()==1
    assert '0 / 5' in s.page.locator('.eg-result-table').inner_text()
    s.action('eg-result-detail',index='0')
    body=s.page.locator('.eg-evidence-dialog').inner_text()
    assert '事项名称' in body and 'ZERO-SCORE-KEPT' in body and 'false' in body
    s.page.locator('.eg-evidence-dialog [data-action="source"]').click();assert s.ev('modal')=='source'
    s.page.keyboard.press('Escape');assert s.ev('modal')=='eg-result-detail';s.page.keyboard.press('Escape')
    s.action('eg-result-reset');s.action('eg-result-kind',kind='parent')
    assert s.page.locator('.eg-result-table tbody tr').count()==2
    s.page.locator('[data-eg-change="result-method"]').select_option('code')
    assert s.page.locator('.eg-result-table tbody tr').count()==1
    assert '不经模型评分' in s.page.locator('.eg-result-table').inner_text()
    s.action('eg-result-detail',index='104')
    assert '固定值5' in s.page.locator('.eg-evidence-dialog').inner_text()
    s.click('close-modal')
    rows=s.ev("exportRows(currentTask(),'all')")
    assert len(rows)==106
    assert rows[1][5]==0 and 'false' in rows[1][-1]
    assert not any('SECRET' in str(row) for row in rows)
    s.click('export');s.page.locator('#export-format').select_option('json')
    with tempfile.TemporaryDirectory() as tmp,s.page.expect_download() as event:
        s.click('do-export');download=event.value;target=Path(tmp)/download.suggested_filename;download.save_as(target)
        text=target.read_text('utf-8-sig');payload=json.loads(text)
        assert len(payload['results'])==105
        assert 'OUTSIDE-SECRET' not in text and 'REF-SECRET' not in text
        assert 'CROSS-FILE-SECRET' not in text
        assert payload['results'][-1]['matching_method']=='code'
        assert payload['results'][-1]['result']['weighted_score']==5
    s.action('eg-result-reset');s.action('eg-result-kind',kind='duplicate')
    for width,height in [(1366,768),(1024,480),(390,600)]:
        s.page.set_viewport_size({'width':width,'height':height})
        s.ev("render();document.querySelector('#toast').classList.remove('show')")
        metric=s.ev("""()=>({view:'result',width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
          table:document.querySelector('.eg-result-scroll').getBoundingClientRect().toJSON(),
          pager:document.querySelector('.eg-pager').getBoundingClientRect().toJSON()})""")
        assert metric['scrollWidth']<=width,metric
        assert metric['table']['height']>=70,metric
        assert metric['pager']['bottom']<=height+1,metric
        layouts.append(metric)
        s.page.screenshot(path=str(ROOT/'review'/f'engineering-result-{width}.png'),animations='disabled')
    s.page.set_viewport_size({'width':1366,'height':768});s.ev('render()')
    snapshot=s.ev('JSON.stringify(currentTask())');task_id=s.ev('currentTask().id')
    s.action('tr-config',id=task_id)
    assert s.page.locator('[data-eg-config="threshold"]').get_attribute('readonly') is not None
    s.action('eg-field',index='0');assert not s.page.locator('[data-action="eg-field-save"]').count()
    s.click('close-modal');assert s.ev('JSON.stringify(currentTask())')==snapshot
    s.action('new-analysis');assert s.ev('currentTask()') is None
    assert s.ev('id=>JSON.stringify(state.tasks.find(t=>t.id===id))',task_id)==snapshot

cases=[('两类分析独立配置并同时执行；编辑取消/权重0.99与逐文件缺列校验',phases_and_fields),('原始请求结构、派生字段、扩展规则保留及删除字段重编号同步',full_request_and_delete),('1000字段检索分页不裁剪请求，三种屏幕下列表与分页可用',volume),('结果动态列、0/false、字段评分、编码匹配、源行与导出、历史只读和再分析',evidence_and_export)]
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    for label,fn in cases:
        s=None
        try:
            s=Session(browser);fn(s);checks.append(label);print('PASS '+label,flush=True)
        except Exception:
            detail=traceback.format_exc();failures.append({'case':label,'error':detail});print('FAIL '+label+'\n'+detail,flush=True)
            if s:s.page.screenshot(path=str(ROOT/'review'/('engineering-failure-'+str(len(failures))+'.png')))
        finally:
            if s:s.close()
    browser.close()
report={'checks':checks,'failures':failures,'errors':errors,'layouts':layouts}
(ROOT/'review'/'engineering-workflow-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
if failures or errors:raise SystemExit(1)
