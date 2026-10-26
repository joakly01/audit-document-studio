"""Contract and bidding findings support continuous source review without task edits."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('AUDIT_UI_URL','http://127.0.0.1:8765')
checks,errors,layouts=[],[],[]
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce')
    page.set_default_timeout(18000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL+'/#tool/contract',wait_until='load')
    page.wait_for_function("typeof ufRecords==='function'")
    if not page.evaluate("typeof ieOpen==='function'"):
        page.add_style_tag(url=URL+'/integrated-evidence.css')
        page.add_script_tag(url=URL+'/integrated-evidence.js')
    def ev(code,arg=None):return page.evaluate(code,arg)
    def action(name,**data):return ev('x=>handleAction(x.name,{dataset:x.data})',{'name':name,'data':data})
    def click(name):page.locator('[data-action="'+name+'"]:visible').last.click()
    def note(text):checks.append(text);print(text,flush=True)
    ev('taskDemoReady')
    ev("""()=>{nav('tool','contract');loadSample();const w=ws();
      const ids=[...new Set([...w.ids,'d2'])],t={id:'ie-contract',toolId:'contract',name:'付款条款核验',ids:[...ids],
        successIds:[...ids],failedIds:[],status:'completed',progress:100,created:new Date().toISOString(),
        config:structuredClone(w.config),attachments:{},result:[]};
      for(let i=0;i<36;i++)t.result.push({doc:ids[i%ids.length],refs:[...ids.slice(0,2)],
        check:(i%2?'付款凭证':'其他事项')+' '+i,extracted_value:{付款比例:'30%',付款条件:'验收后付款'},
        judgment:i%2?'待核验':'符合',laws_and_regulations:'本次提供的合同约定与内部付款制度',
        judgment_rule:'按合同约定核对付款凭证',analysis:'核对付款资料及验收依据 '+i,
        advice:'补充验收记录后核对。'});
      state.tasks.push(t);openTask(t.id);cwView.resultQuery='付款凭证';cwView.resultPage=2;render();
    }""")
    snapshot=ev('JSON.stringify(currentTask())')
    page.locator('.cw-result-table-scroll').evaluate('el=>el.scrollTop=80')
    before=ev("({page:cwView.resultPage,q:cwView.resultQuery,scroll:document.querySelector('.cw-result-table-scroll').scrollTop})")
    indices=ev('cwFiltered(currentTask()).map(r=>r.index)')
    index=indices[-2]
    action('cw-result-detail',index=str(index))
    assert ev('modal')=='source' and ev('modalData.ieReview')
    assert page.locator('.ie-review-dialog').is_visible()
    text=page.locator('#ie-result-body').inner_text()
    for term in ['付款比例','30%','付款条件','验收后付款','判断依据','判定标准','核对付款资料','补充验收']:
        assert term in text,term
    assert ev('ieSession.indices')==indices
    assert page.locator('[data-ie-change="source"] option').count()==2
    page.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady||document.querySelector('#preview-raw-content .preview-empty h3')?.textContent==='原始文件暂不可用'")
    previous_source=ev('modalData.id')
    options=page.locator('[data-ie-change="source"] option').evaluate_all('es=>es.map(e=>e.value)')
    other=next(x for x in options if x!=previous_source)
    page.locator('[data-ie-change="source"]').select_option(other)
    assert ev('modalData.id')==other and ev('ieSession.index')==index
    page.locator('[data-action="ie-content"][data-tab="parsed"]').click()
    assert page.locator('#preview-parsed-content').is_visible()
    page.locator('[data-action="ie-content"][data-tab="finding"]').click()
    click('ie-next')
    assert ev('ieSession.index')==indices[-1]
    assert page.locator('[data-action="ie-next"]').is_disabled()
    click('ie-prev')
    assert ev('ieSession.index')==index
    page.keyboard.press('Escape')
    assert ev('modal') is None
    page.wait_for_timeout(100)
    assert ev('cwView.resultPage')==before['page'] and ev('cwView.resultQuery')==before['q']
    assert ev("document.querySelector('.cw-result-table-scroll').scrollTop")==before['scroll']
    assert ev('JSON.stringify(currentTask())')==snapshot
    note('合同直接原文/完整依据双栏核验，按筛选跨页前后切换、来源与解析切换，关闭保持原列表和历史快照')

    # Readable findings can still be reviewed when original-file preview is denied.
    ev("currentTask().ids.forEach(id=>file(id).can_preview=false)")
    action('cw-result-detail',index=str(index))
    assert '暂无可预览的原文件' in page.locator('.ie-review-dialog').inner_text()
    assert '核对付款资料' in page.locator('#ie-result-body').inner_text()
    assert page.locator('[data-ie-change="source"]').is_disabled()
    page.keyboard.press('Escape')
    ev("currentTask().ids.forEach(id=>delete file(id).can_preview)")

    # Every source controls the entire returned finding, including async raw preview.
    action('cw-result-detail',index=str(index))
    ev("""()=>{const id=cwNormalize(currentTask()).find(r=>r.index===ieSession.index).refs[1],d=file(id);
      window.ieRestricted={id,space:d.space,folder:d.folder};d.space='公共空间';d.folder='ie-no-access';
      folderMeta[directoryKey(d.space,d.folder)]={permission:'NONE'};}""")
    action('preview-refresh-parsed')
    assert '关联资料不可查看' in page.locator('.modal').inner_text()
    assert '核对付款资料' not in page.locator('.modal').inner_text()
    assert not page.locator('#preview-raw-content canvas').count()
    page.keyboard.press('Escape')
    ev("const d=file(ieRestricted.id);d.space=ieRestricted.space;d.folder=ieRestricted.folder;render()")
    note('原文件仅无预览权时可查看允许的分析内容；任一关联资料失去阅读权时整条分析和原件均隐藏')
    # A report can link outside the table's active filter. Review just that
    # finding and label the scope truthfully without clearing the filter.
    action('cw-result-detail',index='0')
    assert ev('ieSession.indices')==[0]
    assert '本条结果' in page.locator('.ie-position').inner_text()
    assert page.locator('[data-action="ie-next"]').is_disabled()
    page.keyboard.press('Escape')
    assert ev('cwView.resultQuery')=='付款凭证'

    # Bidding must preserve all multi-file evidence, not just one quote.
    ev("""()=>{nav('tool','bidding');loadSample();const w=ws(),t={id:'ie-bidding',toolId:'bidding',
      name:'投标响应核验',ids:[...w.ids],successIds:[...w.ids],failedIds:[],status:'completed',progress:100,
      created:new Date().toISOString(),config:structuredClone(w.config),projects:structuredClone(w.projects),
      modes:['joint'],attachments:{},result:[]};
      for(let i=0;i<25;i++)t.result.push({doc:'d7',refs:['d6','d7','d8'],projectId:'p1',mode:'joint',
        title:'技术响应核验 '+i,ruleName:'技术响应偏离检测',unit:'青禾公司',findingStatus:'review',
        risk_level:'medium',confidence:81,description:'对照采购要求核对响应 '+i,excerpt:'正文引用附件。',
        aiAnalysisItems:[{title:'完整技术参数',summary:'需要附件补充。',judgmentBasis:'以本次招标文件为准',
          reasonableExplanation:'响应可能列在附件中',inspectionItems:['核对偏离表','补充技术附件'],
          keyEvidence:[{unit:'青禾公司',detail:'附件含完整参数',location:'正文第二节'}]}],
        evidenceList:[{file_uuid:'d7',detail:'列表中的原文证据',location:'正文第二段'}],
        llmEvidence:{summary:'本次联合核验依据',cards:[{cardType:'similarity',unitA:'青禾公司',unitB:'远川公司',
          fileA:'d7',fileB:'d8',fileAUuid:'d7',fileBUuid:'d8',contentA:'甲方承诺60日交付',contentB:'乙方承诺90日交付'}]}});
      state.tasks.push(t);openTask(t.id);buaView(t).page=2;render();}""")
    snapshot=ev('JSON.stringify(currentTask())')
    action('bua-evidence',index='21')
    assert ev('modal')=='source' and ev('modalData.ieReview')
    assert page.locator('.ie-review-dialog').is_visible()
    assert page.locator('#ie-all-evidence').get_attribute('open') is not None
    text=page.locator('#ie-result-body').inner_text()
    for term in ['判断依据','可能的合理解释','建议核查事项','关键证据','81%','正文第二段','甲方承诺60日交付','乙方承诺90日交付']:
        assert term in text,term
    page.locator('#ie-all-evidence .bua-evidence-context>summary').click()
    assert '本次联合核验依据' in page.locator('#ie-result-body').inner_text()
    assert page.locator('.bua-evidence-compare>div').count()==2
    assert page.locator('[data-ie-change="source"] option').count()==3
    click('ie-next')
    assert ev('ieSession.index')==22
    assert ev('JSON.stringify(currentTask())')==snapshot
    note('招投标详情与全部证据集中核验，保留多文件对比、合理解释、建议和证据范围，支持连续核验')

    page.wait_for_timeout(2600)
    for width,height in [(1366,768),(1024,480),(390,600)]:
        page.set_viewport_size({'width':width,'height':height})
        ev('paintModal()')
        if width>=650:
            page.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady||!document.querySelector('#preview-raw-content .preview-empty h3')?.textContent.includes('正在')")
        metric=ev("""()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,
          dialog:document.querySelector('.ie-review-dialog').getBoundingClientRect().toJSON(),
          footer:document.querySelector('.ie-review-footer').getBoundingClientRect().toJSON(),
          body:document.querySelector('.ie-result-body').getBoundingClientRect().toJSON()})""")
        assert metric['scroll']<=width,metric
        assert metric['footer']['bottom']<=height+1,metric
        assert metric['body']['height']>=100,metric
        if width<650:
            assert not page.locator('.ie-original-pane').is_visible()
            page.locator('[data-action="ie-mobile"][data-tab="original"]').click()
            assert page.locator('.ie-original-pane').is_visible()
            page.locator('[data-action="ie-mobile"][data-tab="finding"]').click()
        layouts.append(metric)
        page.screenshot(path=str(ROOT/'review'/f'integrated-evidence-{width}.png'),animations='disabled')
    page.set_viewport_size({'width':1366,'height':768})
    page.keyboard.press('Escape')
    assert ev('buaView(currentTask()).page')==2
    assert ev('JSON.stringify(currentTask())')==snapshot
    # No changes to the ordinary file/source preview or extracted information entry.
    action('bua-file-info',id='d7')
    assert ev('modal')=='bua-file-info'
    page.keyboard.press('Escape')
    action('bua-source',id='d7')
    assert ev('modal')=='source' and not ev('modalData.ieReview||false')
    assert not page.locator('.ie-review-dialog').count()
    page.keyboard.press('Escape')
    note('三尺寸核验视图和页脚可达；普通文件预览及文件提取信息入口保留')
    assert not errors,errors
    browser.close()
(ROOT/'review/integrated-evidence-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False))
