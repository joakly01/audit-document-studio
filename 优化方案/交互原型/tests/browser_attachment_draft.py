"""Copied analyses keep editable attachment links separate from library and old tasks."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
checks = []
errors = []
records = []
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768}, reduced_motion='reduce')
    page.set_default_timeout(20000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765') + '/#tool/contract', wait_until='load')
    page.wait_for_function("typeof raAttachmentIds === 'function' && typeof pgBase !== 'undefined'")
    page.evaluate('taskDemoReady')

    def ev(source, arg=None):
        return page.evaluate(source, arg)

    def action(name, **data):
        return ev('x => handleAction(x.action, {dataset:x.data})', {'action': name, 'data': data})

    def click(name):
        page.locator('[data-action="' + name + '"]:visible').last.click()

    def submit(tool_id):
        click('run')
        assert ev('modal') == ('ew-submit' if tool_id == 'extract' else 'tw-submit')
        click('ew-submit-confirm' if tool_id == 'extract' else 'tw-submit-confirm')
        page.wait_for_function("currentTask()?.status === 'completed'")

    for tool_id in ['extract', 'contract']:
        ev("""id => {
            nav('tool', id);
            loadSample();
            if(id === 'extract'){
                openModal('xt-apply', {id:'sys-extract'});
                xtApply();
            }
            delete ws().attachmentOverrides;
            ws().ids = ['d1','d2','d3'];
            ws().preview = 'd1';
            ws().config.merge = true;
            file('d1').attachments = ['d2'];
            file('d2').attachments = [];
            file('d3').attachments = [];
            render();
        }""", tool_id)
        assert ev('validate(false)') == [], tool_id
        submit(tool_id)
        original_id = ev('currentTask().id')
        assert ev("currentTask().attachments.d1") == ['d2']

        # Library associations may change after the historical execution.
        ev("file('d1').attachments = ['d4']; render()")
        original_snapshot = ev('JSON.stringify(currentTask())')
        original_count = ev('state.tasks.length')
        assert ev("raSetAttachmentIds(file('d1'), ['d3'])") is False
        assert ev("file('d1').attachments") == ['d4']
        action('new-analysis')
        assert ev('currentTask()') is None
        assert ev('state.tasks.length') == original_count
        assert ev("raAttachmentIds(file('d1'))") == ['d2']
        assert ev("file('d1').attachments") == ['d4']
        # A newly added main file starts with its current links, then edits independently.
        ev("file('d5').attachments=['d4']; ws().ids.push('d5'); render()")
        assert ev("raAttachmentIds(file('d5'))") == ['d4']
        assert ev("raSetAttachmentIds(file('d5'), [])") is True
        assert ev("raAttachmentIds(file('d5'))") == []
        assert ev("file('d5').attachments") == ['d4']
        ev("ws().ids=ws().ids.filter(id=>id!=='d5'); render()")

        action('attachments', id='d1')
        assert ev("modal === 'attachments'")
        assert ev("file('d2').name") in page.locator('#modal-root').inner_text()
        page.locator('[data-action="unlink-attachment"][data-id="d2"]').click()
        assert ev("raAttachmentIds(file('d1'))") == []
        assert ev("file('d1').attachments") == ['d4']
        page.keyboard.press('Escape')
        ev("nav('library')")
        page.locator('#undo-toast').click()
        assert ev("file('d1').attachments") == ['d4']
        ev("id => nav('tool', id)", tool_id)
        assert ev("raAttachmentIds(file('d1'))") == ['d2']
        action('attachments', id='d1')
        page.locator('[data-action="unlink-attachment"][data-id="d2"]').click()
        click('pick-attachment')
        assert ev("modal === 'ef-select-attachments'")
        page.locator('[data-ea-change="file"][data-id="d3"]').check()
        click('ea-confirm')
        assert ev("raAttachmentIds(file('d1'))") == ['d3']
        assert ev("file('d1').attachments") == ['d4']
        page.keyboard.press('Escape')

        # Opening history and returning to the tool retains the new editable draft.
        ev('id => openTask(id)', original_id)
        assert ev("raAttachmentIds(file('d1'))") == ['d2']
        ev("id => nav('tool', id)", tool_id)
        assert ev('currentTask()') is None
        assert ev("raAttachmentIds(file('d1'))") == ['d3']
        assert ev('id => JSON.stringify(state.tasks.find(t => t.id === id))', original_id) == original_snapshot
        assert ev('validate(false)') == []
        submit(tool_id)
        new_id = ev('currentTask().id')
        assert new_id != original_id
        assert ev('state.tasks.length') == original_count + 1
        assert ev('currentTask().attachments.d1') == ['d3']
        assert ev('currentTask().attachments.d2') == []
        assert ev('currentTask().attachments.d3') == []
        assert ev("file('d1').attachments") == ['d4']
        assert ev('id => JSON.stringify(state.tasks.find(t => t.id === id))', original_id) == original_snapshot

        # A library edit still targets library links even with a task selected elsewhere.
        ev("nav('library'); raSetAttachmentIds(file('d1'), ['d2','d4'])")
        assert ev("file('d1').attachments") == ['d2', 'd4']
        assert ev('id => state.tasks.find(t => t.id === id).attachments.d1', new_id) == ['d3']
        records.append({'tool': tool_id, 'originalTask': original_id, 'newTask': new_id})
        checks.append(tool_id + '：历史关联独立复制、移除撤销/新增、草稿回访、提交新快照，原任务和资料库关联保持')
        print(checks[-1], flush=True)

    assert not errors, errors
    browser.close()

report = {'checks': checks, 'records': records, 'errors': errors}
(ROOT / 'review/attachment-draft-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
