"""Run the five native tool lifecycles after loading the prompt guidance module."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
CHECKS = []
ERRORS = []
RESULTS = []
URL = os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765')


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768}, reduced_motion='reduce')
    page.set_default_timeout(20000)
    page.on('pageerror', lambda error: ERRORS.append(str(error)))
    page.goto(URL + '/#tool/contract', wait_until='load')
    page.wait_for_function("typeof pgBase !== 'undefined'")
    page.evaluate('taskDemoReady')

    for tool_id in ['contract', 'prepaid', 'bidding', 'engineering', 'association']:
        before = page.evaluate("""id => {
            nav('tool', id);
            loadSample();
            return {
                issues: validate(false),
                ids: [...ws().ids],
                stages: structuredClone(ws().config.stages),
                fragment: structuredClone(configurationFragment(id, ws().config)),
                contractRules: structuredClone(ws().config.contractRules),
                contractType: ws().config.contractType,
                feeType: ws().config.feeType,
                engineering: structuredClone(ws().config.engineering),
                association: structuredClone(ws().config.association),
                checks: [...ws().config.checks],
                modes: [...ws().modes],
                projects: structuredClone(ws().projects),
                tableA: ws().tableA,
                tableB: ws().tableB
            };
        }""", tool_id)
        assert not before['issues'], (tool_id, 'sample validation', before['issues'])
        assert before['ids'] and before['stages'], (tool_id, 'missing sample or prompt stages')
        assert all(stage['content'].strip() for stage in before['stages'].values()), tool_id

        page.locator('[data-action="run"]:visible').last.click()
        assert page.evaluate("modal === 'tw-submit'"), (tool_id, 'native confirmation not opened')
        page.locator('#tw-task-name').fill('提示词回归 · ' + tool_id)
        page.locator('[data-action="tw-submit-confirm"]:visible').click()
        page.wait_for_function("currentTask() && currentTask().status !== 'running'")
        initial_status = page.evaluate('currentTask().status')

        if tool_id == 'prepaid':
            assert initial_status == 'awaiting', initial_status
            assert page.locator('#fee-base').is_visible()
            page.locator('#fee-base').fill('1000000')
            page.locator('[data-action="calculate-fee"]:visible').click()
            page.wait_for_function("currentTask()?.status === 'completed' && !currentTask().calculating")
            fee = page.evaluate("({base: Number(currentTask().base), fee: currentTask().fee, billing: currentTask().billing})")
            assert fee['base'] == 1000000 and fee['billing']['type'] == before['feeType'], fee
            expected_fee = round(1000000 * fee['billing']['rate'], 2) if fee['billing'].get('rate') else fee['billing']['fixed']
            assert fee['fee'] == expected_fee, fee
            assert '费用计算报告' in page.locator('.workarea').inner_text()
        else:
            assert initial_status == 'completed', (tool_id, initial_status)

        after = page.evaluate("""() => {
            const task = currentTask();
            return {
                id: task.id, status: task.status, ids: task.ids,
                stages: task.config.stages, fragment: task.configFragment,
                contractRules: task.config.contractRules,
                contractType: task.config.contractType, feeType: task.config.feeType,
                engineering: task.config.engineering, association: task.config.association,
                checks: task.config.checks, modes: task.modes, projects: task.projects,
                tableA: task.tableA, tableB: task.tableB,
                rows: task.result.length,
                sampleRow: task.result[0],
                visibleText: document.querySelector('.workarea')?.innerText || '',
                sourceActions: [...document.querySelectorAll('.workarea [data-action]')]
                    .filter(el => /source|detail|evidence|review/.test(el.dataset.action)).length
            };
        }""")
        assert after['stages'] == before['stages'], (tool_id, 'prompt stage snapshot changed')
        assert after['fragment'] == before['fragment'], (tool_id, 'request snapshot changed')
        assert after['ids'] == before['ids'], (tool_id, 'materials changed')
        assert after['status'] == 'completed' and after['rows'] > 0, (tool_id, 'missing results')
        assert len(after['visibleText']) > 80, (tool_id, 'unreadable result page')
        assert after['sourceActions'] > 0, (tool_id, 'source/detail entry missing')
        assert 'undefined' not in after['visibleText'] and 'NaN' not in after['visibleText'], tool_id

        core_keys = {
            'contract': ['contractRules', 'contractType', 'checks'],
            'prepaid': ['feeType'],
            'bidding': ['modes', 'projects', 'checks'],
            'engineering': ['engineering'],
            'association': ['association', 'tableA', 'tableB']
        }[tool_id]
        for key in core_keys:
            assert after[key] == before[key], (tool_id, key, 'core configuration changed')

        RESULTS.append({
            'tool': tool_id, 'taskId': after['id'], 'initialStatus': initial_status,
            'status': after['status'], 'sampleValidation': before['issues'],
            'stageKeys': list(before['stages']), 'rows': after['rows'],
            'sourceOrDetailActions': after['sourceActions'], 'preservedFields': core_keys,
            'resultPreview': after['visibleText'][:400],
        })
        CHECKS.append(tool_id + '：默认样本校验、页面提交、阶段提示词及执行参数快照、核心业务设置和结果来源入口')
        print(CHECKS[-1], flush=True)

    assert not ERRORS, ERRORS
    browser.close()

report = {'checks': CHECKS, 'tools': RESULTS, 'errors': ERRORS}
(ROOT / 'review/prompt-tool-execution-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
