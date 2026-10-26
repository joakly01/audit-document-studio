"""Returned bidding findings remain traceable, filterable and permission aware."""
import json
import os
import tempfile
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765')
checks, errors, layouts = [], [], []
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768}, accept_downloads=True)
    page.set_default_timeout(15000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL + '/#tool/bidding', wait_until='load')
    page.wait_for_function("typeof baBase!=='undefined'")
    if not page.evaluate("typeof buaBase!=='undefined'"):
        page.add_style_tag(url=URL + '/bidding-audit.css')
        page.add_script_tag(url=URL + '/bidding-audit.js')
    page.evaluate('taskDemoReady')

    def ev(code, arg=None):
        return page.evaluate(code, arg)

    def action(name, **data):
        return ev('x=>handleAction(x.name,{dataset:x.data})', {'name': name, 'data': data})

    def click(name):
        page.locator('[data-action="' + name + '"]:visible').last.click()

    def note(text):
        checks.append(text)
        print(text, flush=True)

    task_id = ev("""()=>{
      nav('tool','bidding');loadSample();const w=ws(),t={id:'bua-test-task',toolId:'bidding',
        name:'设备采购检查成果',ids:[...w.ids],successIds:[...w.ids],failedIds:[],
        config:structuredClone(w.config),projects:structuredClone(w.projects),modes:['tender','bid','joint'],
        status:'completed',progress:100,created:'2026-10-23T02:30:00Z',attachments:{},result:[]};
      t.result=[
       {doc:'d7',refs:['d6','d7'],title:'技术响应需补充核对',projectId:t.projects[0].id,
        mode:'joint',ruleId:'t3',ruleName:'技术响应偏离检测',unit:'青禾公司',findingStatus:'review',
        risk_level:'medium',confidence:81,description:'技术响应引用附件，需要结合技术需求表核对。',
        excerpt:'详细技术响应见投标附件。',
        aiAnalysisItems:[{title:'技术参数响应核对',summary:'正文引用技术附件。',
          judgmentBasis:'对照招标技术需求表与投标响应。',reasonableExplanation:'具体参数可能列在附件。',
          inspectionItems:['补充技术响应附件。','核对逐项偏离说明。'],
          keyEvidence:[{unit:'青禾公司',detail:'详细技术响应见投标附件。',location:'投标文件正文'}]}],
        evidenceList:[{unit:'青禾公司',detail:'详细技术响应见投标附件。',location:'正文第二段'}],
        llmEvidence:{cards:[{id:'pair-1',cardType:'similarity',unitA:'青禾公司',unitB:'远川公司',
           fileA:file('d7').name,fileB:file('d8').name,contentA:'承诺60日内交付。',contentB:'承诺60日内交付。'}]}},
       {doc:'d8',refs:['d6','d8'],title:'技术附件未提供',projectId:t.projects[0].id,mode:'joint',
        ruleId:'t3',ruleName:'技术响应偏离检测',unit:'远川公司',findingStatus:'insufficient',
        description:'当前资料未包含所引用的技术附件，不能判断逐项响应是否满足。'},
       {doc:'d6',title:'设备采购项目',unit:'招标方',check:'资格条件与评分',judgment:'待核验',
        detail:'旧记录保留的检查说明。',excerpt:'资格要求：具备履约能力并提供相关证明。'}
      ];
      for(let i=0;i<100;i++)t.result.push({doc:'d7',refs:['d6','d7'],projectId:t.projects[0].id,
        mode:'joint',ruleName:'核查事项 '+i,title:'需核验事项 '+i,description:'第 '+i+' 条实际返回的检查说明。',findingStatus:'review'});
      state.tasks.push(t);openTask(t.id);return t.id;
    }""")
    snapshot = ev('JSON.stringify(currentTask())')
    assert page.locator('.bua-result').is_visible()
    assert not page.locator('.ba-materials').count()
    assert page.locator('.bua-table tbody tr').count() == 20
    assert ev('buaRows(currentTask()).length') == 103
    assert '未返回风险等级' in ev('buaRiskText(currentTask().result[2])')
    assert ev('buaConfidence(currentTask().result[2])') == '未返回'
    assert ev('buaState(currentTask().result[2])') == 'review'
    note('检查成果可搜索、分页，兼容旧泛化记录；未返回风险和置信度时不推断为无风险')

    # Raw APIs may return detail as an object rather than a displayable string.
    ev("""()=>{window.buaOriginalDetailRow=structuredClone(currentTask().result[2]);
      const r=currentTask().result[2];r.detail={summary:'对象形式的检查摘要',description:'备用说明'};
      r.description={invalid:'对象不能直接作为摘要显示'};render();}""")
    assert '对象形式的检查摘要' in page.locator('.bua-table').inner_text()
    assert '[object Object]' not in page.locator('.bua-table').inner_text()
    action('bua-detail', index='2')
    assert '对象形式的检查摘要' in page.locator('.modalbody').inner_text()
    assert '[object Object]' not in page.locator('.modalbody').inner_text()
    page.keyboard.press('Escape')
    ev("currentTask().result[2].detail={description:'对象中的检查说明'};render()")
    assert '对象中的检查说明' in page.locator('.bua-table').inner_text()
    ev("currentTask().result[2].detail={unrelated:{value:'不能猜测的字段'}};render()")
    action('bua-detail', index='2')
    assert '未返回分析说明' in page.locator('.modalbody').inner_text()
    assert '[object Object]' not in page.locator('.modalbody').inner_text()
    page.keyboard.press('Escape')
    ev("currentTask().result[2]=buaOriginalDetailRow;render()")
    assert ev('JSON.stringify(currentTask())') == snapshot
    note('对象形式的detail读取summary或description；没有可用正文时明确未返回，不显示对象字符串')

    page.locator('#bua-query').fill('技术附件未提供')
    assert page.locator('.bua-table tbody tr').count() == 1
    assert '资料不足' in page.locator('.bua-table tbody').inner_text()
    assert ev('JSON.stringify(currentTask())') == snapshot
    action('bua-reset')
    action('bua-detail', index='0')
    text = page.locator('.modalbody').inner_text()
    for expected in ['判断依据', '可能的合理解释', '建议核查事项', '关键证据', '81%']:
        assert expected in text, expected
    assert ev('modal') == 'source' and ev('modalData.ieReview')
    page.locator('#ie-all-evidence>summary').click()
    assert page.locator('.bua-evidence-compare>div').count() == 2
    assert '正文第二段' in page.locator('.modalbody').inner_text()
    sources = page.locator('[data-ie-change="source"] option').evaluate_all('els=>els.map(e=>e.value)')
    assert set(sources) == {'d6','d7','d8'}
    page.locator('[data-ie-change="source"]').select_option('d8')
    assert ev('modal') == 'source' and ev('modalData.id') == 'd8'
    assert '技术参数响应核对' in page.locator('#ie-result-body').inner_text()
    assert page.locator('#ie-all-evidence').get_attribute('open') is not None
    page.keyboard.press('Escape')
    assert ev('modal') is None
    note('详情与原文同屏保留判断依据、合理解释、核查建议及双文件证据，切换来源后一键返回原结果')

    # A secondary evidence source loses access: the whole finding must stop exposing its body.
    ev("""()=>{const d=file('d8');window.buaOldFolder=d.folder;window.buaOldSpace=d.space;
      d.space='公共空间';d.folder='无权查看证据';folderMeta[directoryKey(d.space,d.folder)]={permission:'NONE'};render();}""")
    assert ev('buaRows(currentTask()).length') == 101
    action('bua-detail', index='0')
    assert ev('modal') is None
    assert '技术响应需补充核对' not in page.locator('.bua-table').inner_text()
    ev("const d=file('d8');d.folder=buaOldFolder;d.space=buaOldSpace;render()")
    action('bua-detail', index='0')
    page.keyboard.press('Escape')
    assert ev('JSON.stringify(currentTask())') == snapshot
    note('一条结果的任一关联证据失权时隐藏整条正文；主文件可读也不会泄漏另一文件内容')

    # Filename-only evidence can refer to multiple same-named files in this task.
    ev("""()=>{window.buaBeforeDuplicate=structuredClone(currentTask());
      const t=currentTask(),d=structuredClone(file('d8'));
      d.id='bua-same-name-secondary';d.space='公共空间';d.folder='无权查看同名证据';
      folderMeta[directoryKey(d.space,d.folder)]={permission:'NONE'};state.docs.push(d);
      t.ids.push(d.id);t.successIds.push(d.id);render();}""")
    assert ev("buaSources(currentTask(),currentTask().result[0]).includes('bua-same-name-secondary')")
    assert not ev('buaReadable(currentTask(),currentTask().result[0])')
    assert '技术响应需补充核对' not in page.locator('.bua-table').inner_text()
    action('bua-detail', index='0')
    assert ev('modal') is None
    ev("currentTask().result[0].llmEvidence.cards[0].fileBUuid='d8';render()")
    assert not ev("buaSources(currentTask(),currentTask().result[0]).includes('bua-same-name-secondary')")
    assert ev('buaReadable(currentTask(),currentTask().result[0])')
    assert '技术响应需补充核对' in page.locator('.bua-table').inner_text()
    ev("currentTask().result[0].llmEvidence.cards[0].fileBUuid='not-in-this-task';render()")
    assert not ev('buaReadable(currentTask(),currentTask().result[0])')
    assert '技术响应需补充核对' not in page.locator('.bua-table').inner_text()
    ev("""()=>{const index=state.tasks.findIndex(t=>t.id===buaBeforeDuplicate.id);
      state.tasks[index]=buaBeforeDuplicate;
      state.docs=state.docs.filter(d=>d.id!=='bua-same-name-secondary');render();}""")
    assert ev('JSON.stringify(currentTask())') == snapshot
    note('仅有文件名的证据匹配本任务全部同名文件；UUID优先，失权或任务外UUID均保守隐藏对应正文')

    action('bua-tab', tab='files')
    assert page.locator('.bua-file-table tbody tr').count() == 3
    action('bua-file-info', id='d7')
    assert '未保存单独的结构化提取结果' in page.locator('.modalbody').inner_text()
    click('bua-file-results')
    assert ev('buaView(currentTask()).file') == 'd7'
    assert page.locator('.bua-file-filter').is_visible()
    action('bua-reset')
    action('bua-tab', tab='report')
    assert '招投标审计核查清单' in page.locator('.bua-report-paper').inner_text()
    with page.expect_download() as event:
        click('bua-export-report')
    target = Path(tmp) / event.value.suggested_filename
    event.value.save_as(target)
    report = target.read_text()
    assert '技术响应需补充核对' in report and '<!doctype html>' in report
    note('保留分析资料、提取信息与关联结果入口；报告由实际返回结果整理并可导出')

    action('bua-tab', tab='findings')
    matrix = ev("exportRows(currentTask(),'d6')")
    assert len(matrix) == 104
    assert matrix[0][:3] == ['项目', '分析环节', '涉及单位']
    action('export')
    page.locator('#export-format').select_option('xlsx')
    with page.expect_download() as event:
        click('do-export')
    target = Path(tmp) / 'findings.xlsx'
    event.value.save_as(target)
    with zipfile.ZipFile(target) as archive:
        assert '本次分析配置' in archive.read('xl/workbook.xml').decode()
    assert ev('JSON.stringify(currentTask())') == snapshot
    note('业务表头导出包含项目、环节、规则、核验状态与全部来源，并保留原执行配置工作表')

    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        page.set_viewport_size({'width': width, 'height': height})
        ev('render()')
        metric = ev("""()=>({width:innerWidth,height:innerHeight,
          scroll:document.documentElement.scrollWidth,
          table:document.querySelector('.bua-table-scroll').getBoundingClientRect().toJSON()})""")
        assert metric['scroll'] <= width, metric
        assert metric['table']['height'] >= 80, metric
        layouts.append(metric)
        page.screenshot(path=str(ROOT / 'review' / f'bidding-audit-{width}.png'))
    page.set_viewport_size({'width': 1366, 'height': 768})
    action('new-analysis')
    assert page.locator('.ba-workspace').is_visible()
    assert ev("JSON.stringify(state.tasks.find(t=>t.id==='bua-test-task'))") == snapshot
    assert not errors, errors
    (ROOT / 'review' / 'bidding-audit-checks.json').write_text(json.dumps(
        {'checks': checks, 'layouts': layouts, 'errors': errors}, ensure_ascii=False, indent=2))
    browser.close()
