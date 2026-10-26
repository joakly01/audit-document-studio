"""Contract fees retain both task phases, per-file clauses and source boundaries."""
from pathlib import Path
import json
import os
import tempfile
import traceback
import zipfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765')
checks, failures, errors, layouts = [], [], [], []


class Session:
    def __init__(self, browser):
        self.context = browser.new_context(viewport={'width': 1366, 'height': 768}, accept_downloads=True, reduced_motion='reduce')
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)
        self.page.on('pageerror', lambda e: errors.append(str(e)))
        self.page.goto(URL + '/#tool/prepaid', wait_until='load')
        self.page.wait_for_function("typeof pwBase!=='undefined'")
        self.ev('loadSample()')

    def ev(self, code, arg=None):
        return self.page.evaluate(code, arg)

    def action(self, name, **data):
        return self.ev('x=>handleAction(x.name,{dataset:x.data})', {'name': name, 'data': data})

    def click(self, name):
        self.page.locator('[data-action="' + name + '"]:visible').last.click()

    def execute(self, name='费用两阶段核验'):
        self.click('run')
        assert self.ev('modal') == 'tw-submit'
        self.page.locator('#tw-task-name').fill(name)
        self.click('tw-submit-confirm')
        self.page.wait_for_function("currentTask()?.status==='awaiting'", timeout=25000)

    def calculate(self, amount='1,000,000.00'):
        self.page.locator('#fee-base').fill(amount)
        self.click('calculate-fee')
        self.page.wait_for_function("currentTask()?.status==='completed'&&!currentTask().calculating")

    def close(self):
        self.context.close()


def preparation_and_request(s):
    assert s.page.locator('.tl-grid').is_visible()
    assert s.page.locator('.tl-preview-column>.tw-preview').is_visible()
    assert s.page.locator('.tw-panel-head [data-action="add-tool-materials"]').is_visible()
    assert s.page.locator('.pw-config .pg-stage-card').count() == 2
    assert s.page.locator('[data-config="feeType"] option').count() == 6
    assert s.page.locator('#ef-raw-content').count() == 1
    assert s.page.locator('[data-pg-prompt="agreement"]').input_value() == 'system'
    assert s.page.locator('[data-pg-prompt="calculation"]').input_value() == 'system'
    s.page.locator('[data-config="feeType"]').select_option('工程设计费')
    assert s.ev("Object.values(ws().config.stages).every(s=>s.template.includes('工程设计费')&&s.content.includes('工程设计费'))")
    assert s.page.locator('[data-pg-prompt="agreement"]').input_value() == 'system'
    assert s.page.locator('[data-pg-prompt="calculation"]').input_value() == 'system'
    s.page.locator('[data-config="feeType"]').select_option('工程监理费')
    assert s.ev("pwFormula({fixed:null},100)") == '计费条件未完整返回'
    s.page.locator('.tw-file-name').first.click()
    assert s.ev('modal') is None
    assert s.ev('ws().preview') == s.page.locator('.tw-file-name').first.get_attribute('data-id')
    s.page.locator('.tl-preview-column [data-action="source"]').click()
    assert s.ev('modal') == 'source'
    assert s.page.locator('.file-preview-pane').count() == 2
    s.page.keyboard.press('Escape')
    s.ev("ws().config.stages.agreement.backendId='BILL-1';ws().config.stages.calculation.backendId='CALC-2';render()")
    request = s.ev("configurationFragment('prepaid',ws().config)")
    p = request['custom_config']['parameter_settings']
    assert request['exec_mode'] == 'custom'
    assert p['exec_phase'] == 'extract' and p['billing_base_wan'] is None
    assert p['expense_type'] == 'supervision_engineering'
    assert p['expense_type_label'] == '工程监理费'
    assert p['billing_agreement_prompt_id'] == 'BILL-1'
    assert p['cost_calculation_prompt_id'] == 'CALC-2'
    s.execute()
    assert s.ev('currentTask().configFragment') == request
    task = s.ev('currentTask().id')
    count = s.ev('state.tasks.length')
    for bad in ['0', '-1', '12x', '1.234', '10000000000001', 'Infinity']:
        s.page.locator('#fee-base').fill(bad)
        s.click('calculate-fee')
        assert s.ev('currentTask().status') == 'awaiting'
        assert s.page.locator('#pw-base-error').inner_text()
    s.calculate('1,234,567.89')
    assert s.ev('currentTask().id') == task and s.ev('state.tasks.length') == count
    assert s.ev('currentTask().prepaidContinuation') == {'task_uuid': task, 'billing_base_wan': 1234567.89}
    assert s.ev('currentTask().fee') == 18518.52
    assert s.ev('currentTask().configFragment') == request


def six_types(s):
    for index in range(6):
        s.ev("i=>{nav('tool','prepaid');ws().config.feeType=EXPENSE_TYPES[i];loadSample();render();}", index)
        kind = s.ev('ws().config.feeType')
        s.execute('费用类型核验-' + kind)
        s.calculate('1000000')
        t = s.ev('currentTask()')
        billing = t['billing']
        expected = round(1000000 * billing['rate'], 2) if billing.get('rate') else billing['fixed']
        assert t['fee'] == expected, (kind, t['fee'], expected)
        assert t['prepaidCalculations'][0]['status'] == 'calculated'
        assert '费用计算报告' in s.page.locator('.pw-report').inner_text()


def multiple_contracts(s):
    s.ev("""()=>{const w=ws();w.ids=['d9','fee-design','fee-cost','fee-survey','d1'];w.preview='d9';
      file('fee-design').billing.type=EXPENSE_TYPES[0];file('fee-design').billing.rate=.03;
      file('fee-design').billing.clause='本合同按确认基数的3%计取费用。';
      file('fee-cost').billing.type=EXPENSE_TYPES[0];file('fee-cost').billing.fixed=0;
      file('fee-cost').billing.clause='本合同固定总价为0元。';render();}""")
    s.execute('同一基数下多合同分开测算')
    assert '全部 5 份合同' in s.page.locator('.pw-base-form').inner_text()
    s.ev("file('d9').billing.rate=.9")
    s.calculate()
    records = s.ev('currentTask().prepaidCalculations')
    assert [r['fee'] for r in records[:3]] == [15000, 30000, 0]
    assert all(r['status'] == 'uncomputed' for r in records[3:])
    assert s.ev('currentTask().fee') == 45000
    assert '小计' in s.page.locator('.pw-total').inner_text()
    assert '2 份未计算' in s.page.locator('.pw-report-note').inner_text()
    assert '已完成 3 份费用测算' in s.ev('tcOutput(currentTask()).text')
    assert len(s.ev("exportRows(currentTask(),'all')")) == 6
    rows = s.ev("exportRows(currentTask(),'all')")
    assert rows[3][5] == 0 and rows[4][6] == '未计算'
    snapshot = s.ev('JSON.stringify(currentTask())')
    s.page.locator('.pw-calculation-table [data-action="pw-source"]').first.click()
    assert s.ev('modal') == 'source'
    s.page.keyboard.press('Escape')
    assert s.ev('JSON.stringify(currentTask())') == snapshot
    s.click('pw-download-report')
    with tempfile.TemporaryDirectory() as tmp, s.page.expect_download() as event:
        s.click('pw-download-word')
        target = Path(tmp) / event.value.suggested_filename
        event.value.save_as(target)
        with zipfile.ZipFile(target) as z:
            assert z.testzip() is None
            text = z.read('word/document.xml').decode()
            assert '30,000.00' in text and '固定总价 0.00' in text
            assert '费用类型与本次选择不一致' in text
    s.click('export')
    s.page.locator('#export-format').select_option('json')
    with tempfile.TemporaryDirectory() as tmp, s.page.expect_download() as event:
        s.click('do-export')
        target = Path(tmp) / event.value.suggested_filename
        event.value.save_as(target)
        payload = json.loads(target.read_text(encoding='utf-8-sig'))
        assert len(payload['results']) == 5 and len(payload['calculations']) == 5
        assert payload['continuation']['billing_base_wan'] == 1000000
    assert s.ev('JSON.stringify(currentTask())') == snapshot


def native_report_and_boundaries(s):
    s.execute('原生两阶段输出')
    s.ev("""()=>{const t=currentTask();t.status='completed';t.result=[
      {doc:'d9',disposal_result:JSON.stringify({phase:'extract',text_1:'已提取原始合同计费条件。'})},
      {doc:'d9',disposal_result:{phase:'calculate',calculation_result_text:'# 原生费用报告\\n保留实际返回的计算依据与计算过程。'}}
      ];delete t.prepaidCalculations;t.fee=null;pwView.task=null;render();}""")
    assert len(s.ev('pwRows(currentTask())')) == 1
    assert '原生费用报告' in s.page.locator('.pw-report').inner_text()
    assert '已提取原始合同计费条件' in s.ev('pwReportText(currentTask())')
    s.ev("""()=>{const t=currentTask();t.calculateAgentOutput='AGGREGATED-SECRET';
      t.result[1].refs=['d2'];t.result[1].disposal_result.calculation_result_text='OUTSIDE-SECRET';render();}""")
    assert s.ev('pwRows(currentTask()).length') == 1
    assert not s.ev('pwReadable(pwRows(currentTask())[0])')
    assert 'OUTSIDE-SECRET' not in s.page.locator('.pw-results').inner_text()
    assert 'AGGREGATED-SECRET' not in s.ev('pwReportText(currentTask())')
    assert 'OUTSIDE-SECRET' not in s.ev('pwReportText(currentTask())')
    assert len(s.ev("exportRows(currentTask(),'all')")) == 1
    # A readable but non-downloadable necessary reference cannot leak into reports.
    s.ev("""()=>{const t=currentTask();t.ids.push('d2');t.successIds.push('d2');
      file('d2').can_download=false;render();}""")
    assert s.ev('pwReadable(pwRows(currentTask())[0])')
    assert not s.ev('pwReadable(pwRows(currentTask())[0],true)')
    assert 'OUTSIDE-SECRET' not in s.ev('pwReportText(currentTask())')
    assert 'AGGREGATED-SECRET' not in s.ev('pwReportText(currentTask())')
    assert not s.ev('trCanDownload(currentTask())')
    s.action('pw-source', index='0')
    assert s.ev('modal') == 'pw-sources'
    assert s.page.locator('.pw-source-list [data-action="source"]').count() == 2
    s.page.locator('.pw-source-list [data-action="source"]').last.click()
    assert s.ev('modal') == 'source'
    s.page.keyboard.press('Escape')
    assert s.ev('modal') == 'pw-sources'


def history_and_layout(s):
    s.execute('费用基数等待续填')
    task = s.ev('currentTask().id')
    s.page.locator('#fee-base').fill('2,000,000')
    s.ev("nav('tasks')")
    s.ev('id=>openTask(id)', task)
    assert s.page.locator('#fee-base').input_value() == '2,000,000'
    s.calculate('2,000,000')
    snapshot = s.ev('JSON.stringify(currentTask())')
    s.action('tr-config', id=task)
    assert s.page.locator('[data-config="feeType"]').is_disabled()
    assert all(s.page.locator('[data-pg-prompt]').nth(i).is_disabled() for i in range(2))
    s.action('new-analysis')
    assert s.ev('currentTask()') is None
    assert s.ev('ws().reanalysisFeeBase') == '2000000'
    assert s.ev('id=>JSON.stringify(state.tasks.find(t=>t.id===id))', task) == snapshot
    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        s.page.set_viewport_size({'width': width, 'height': height})
        s.ev('render()')
        if width <= 1100:
            s.action('tl-panel', panel='config')
        assert s.page.locator('.pw-config').is_visible()
        metric = s.ev("""()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
          panel:document.querySelector('.pw-config').getBoundingClientRect().toJSON()})""")
        assert metric['scrollWidth'] <= width, metric
        assert metric['panel']['bottom'] <= height + 1, metric
        layouts.append(metric)
        s.page.screenshot(path=str(ROOT / 'review' / f'prepaid-prepare-{width}.png'), animations='disabled')
    s.page.set_viewport_size({'width': 1366, 'height': 768})
    s.ev('id=>openTask(id)', task)
    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        s.page.set_viewport_size({'width': width, 'height': height})
        s.ev('render()')
        assert s.ev('document.documentElement.scrollWidth') <= width
        s.page.screenshot(path=str(ROOT / 'review' / f'prepaid-report-{width}.png'), animations='disabled')
    assert s.ev('id=>JSON.stringify(state.tasks.find(t=>t.id===id))', task) == snapshot


cases = [
    ('三栏准备、行内原文与双栏展开、两阶段请求与同一任务续算；元单位、千分位、金额校验', preparation_and_request),
    ('六类费用分别使用合同约定，比例和固定价保留', six_types),
    ('多合同共用任务基数但分别按本身约定计算，0元、未知与类型不一致项不丢失，完整报告与导出', multiple_contracts),
    ('原生提取与计算报告合并显示，任务外来源和不可下载证据不会泄漏到报告', native_report_and_boundaries),
    ('任务中心续填、历史配置只读、独立再分析及三种屏幕布局', history_and_layout),
]
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    for label, test in cases:
        session = None
        try:
            session = Session(browser)
            test(session)
            checks.append(label)
            print('PASS ' + label, flush=True)
        except Exception:
            failure = {'case': label, 'error': traceback.format_exc()}
            failures.append(failure)
            print('FAIL ' + label + '\n' + failure['error'], flush=True)
            if session:
                session.page.screenshot(path=str(ROOT / 'review' / ('prepaid-failure-' + str(len(failures)) + '.png')))
        finally:
            if session:
                session.close()
    browser.close()
report = {'checks': checks, 'failures': failures, 'errors': errors, 'layouts': layouts}
(ROOT / 'review' / 'prepaid-workflow-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False))
assert not failures and not errors, report
