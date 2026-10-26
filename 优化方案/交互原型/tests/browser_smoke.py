import json, pathlib, time
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
results=[]; errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8765',wait_until='networkidle')
    page.screenshot(path=str(root/'review/01-资料管理.png'),full_page=True)
    assert page.get_by_role('heading',name='资料管理',exact=True).is_visible()
    for tid in ['extract','word','theme','timeline','risk','meeting','contract','bidding','prepaid','engineering','association']:
        page.goto('http://127.0.0.1:8765/#tool/'+tid)
        page.evaluate('loadSample()')
        if tid in ['extract','bidding','association']:
            page.screenshot(path=str(root/('review/'+tid+'-准备.png')),full_page=True)
        page.locator('[data-action="run"]').click()
        page.wait_for_function("currentTask() && currentTask().status !== 'running'")
        task=page.evaluate("({tool:currentTask().toolId,status:currentTask().status,rows:currentTask().result.length,files:currentTask().successIds.length})")
        assert task['status'] in ['completed','awaiting'],task
        assert task['rows']>0,task
        if tid=='extract':
            page.locator('[data-action="source"]').first.click()
            assert page.get_by_role('dialog').is_visible()
            page.keyboard.press('Escape')
            page.screenshot(path=str(root/'review/02-信息提取结果.png'),full_page=True)
            page.locator('[data-action="export"]').click()
            with page.expect_download() as dl:
                page.locator('[data-action="do-export"]').click()
            dl.value.save_as(str(root/'review/export-result.json'))
        if tid=='meeting':
            page.locator('[data-action="meeting-tab"][data-id="risk"]').click()
            page.locator('[data-action="meeting-risk"]').click()
            page.wait_for_function('currentTask().meetingRisk')
            page.locator('[data-action="meeting-tab"][data-id="qa"]').click()
            page.locator('[data-action="suggest-question"]').nth(1).click()
            assert page.locator('#chat-question').input_value()
            page.locator('[data-action="send-chat"]').click()
            page.wait_for_function('currentTask().chats.length === 1')
            page.screenshot(path=str(root/'review/03-会议问答.png'),full_page=True)
            page.locator('[data-action="meeting-tab"][data-id="regular"]').click()
            page.screenshot(path=str(root/'review/04-会议议题.png'),full_page=True)
        if tid=='contract':
            page.locator('[data-action="contract-report"]').click()
            page.wait_for_selector('[role=dialog]')
            assert page.get_by_role('heading',name='合同条款检查报告').is_visible()
            page.keyboard.press('Escape')
        if tid=='prepaid':
            page.locator('[data-action="nav-tasks"]').first.click()
            page.locator('[data-action="open-task"]').first.click()
            page.locator('#fee-base').fill('1000000')
            page.locator('[data-action="calculate-fee"]').click()
            page.wait_for_function('currentTask().fee===15000')
            page.screenshot(path=str(root/'review/05-费用计算.png'),full_page=True)
        if tid=='engineering':
            page.locator('[data-action="subtab"][data-id="parent"]').click()
            assert page.locator('.table').get_by_text('主子关系候选').is_visible()
        if tid=='association':
            page.locator('[data-action="result-detail"]').first.click()
            assert page.get_by_role('dialog').is_visible()
            page.keyboard.press('Escape')
            page.locator('[data-action="refine"]').click()
            page.wait_for_function('currentTask().refined')
            page.locator('[data-action="restore-candidates"]').click()
            page.screenshot(path=str(root/'review/06-两表关联.png'),full_page=True)
        results.append(task)
    page.goto('http://127.0.0.1:8765/#tasks')
    page.screenshot(path=str(root/'review/07-任务中心.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.goto('http://127.0.0.1:8765/#library')
    page.screenshot(path=str(root/'review/08-移动端资料页.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), 'mobile overflow'
    browser.close()
(root/'review/smoke-results.json').write_text(json.dumps({'tools':results,'browser_errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(results),'errors':errors},ensure_ascii=False))
assert not errors
