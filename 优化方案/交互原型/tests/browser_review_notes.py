"""Optional human annotations remain separate from AI results and respect sources."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('AUDIT_UI_URL', 'http://127.0.0.1:8765')
checks, errors = [], []

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1366,'height':768}, accept_downloads=True)
    page.set_default_timeout(18000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL+'/#tasks', wait_until='load')
    page.wait_for_function("typeof qrCollect==='function'")
    page.evaluate('taskDemoReady')

    def ev(js, data=None): return page.evaluate(js, data)
    def action(name, **data): return ev('x=>handleAction(x.name,{dataset:x.data})', {'name':name,'data':data})
    def open_extract():
        ev("id=>openTask(id)", fixture['extract'])
        doc = ev('currentTask().result[0].doc')
        action('ew-review', id=doc)
        page.locator('.qr-note').first.wait_for(state='visible')

    fixture = ev("""()=>{const out={};for(const id of ['extract','contract','meeting']){
      const t=state.tasks.find(t=>tcResolve(t)===id&&t.status==='completed');
      if(!t)throw Error('Missing demo '+id);out[id]=t.id;
    }persist();return out;}""")
    open_extract()
    key = page.locator('.qr-note').first.get_attribute('data-qr-key')
    snapshot = ev('JSON.stringify(currentTask())')
    card = page.locator('.qr-note').first
    card.locator('summary').click()
    card.locator('[data-qr-input="status"]').select_option('question')
    card.locator('textarea').fill('请补充付款凭证核对。<img src=x onerror="window.qrXss=true">')
    card.locator('[data-action="qr-save"]').click()
    assert ev('JSON.stringify(currentTask())') == snapshot
    assert not ev('!!window.qrXss')
    assert ev('key=>qrNotes[key].status', key) == 'question'
    assert ev('key=>qrNotes[key].reviewerId', key) == 'current-user'
    assert page.locator('.qr-note').first.locator('summary').inner_text().endswith('存疑')
    checks.append('提取字段核验意见独立保存、人工标记与原始结果分离，中文及HTML按文本处理')

    with page.expect_download() as download:
        page.locator('.qr-note').first.locator('[data-action="qr-export"]').click()
    output=json.loads(Path(download.value.path()).read_text())
    assert output['review_status']=='存疑' and output['review_note'].startswith('请补充')
    assert output['reviewer']=='当前用户'
    action('close-modal')
    page.reload(wait_until='load')
    page.wait_for_function("typeof qrCollect==='function'")
    ev('taskDemoReady')
    open_extract()
    assert page.locator('.qr-note').first.get_attribute('data-qr-key') == key
    assert page.locator('.qr-note').first.locator('summary').inner_text().endswith('存疑')
    checks.append('刷新后恢复原任务核验记录，可单独导出核验意见')

    # A different returned value receives a different identity, even at the same index.
    ev("""()=>{window.qrOld=structuredClone(currentTask().result[0]);
      currentTask().result[0].items[0].extracted='新的返回内容';paintModal();}""")
    assert page.locator('.qr-note').first.get_attribute('data-qr-key') != key
    assert page.locator('.qr-note').first.locator('summary').inner_text().endswith('选填')
    ev('currentTask().result[0]=qrOld;paintModal()')
    assert page.locator('.qr-note').first.get_attribute('data-qr-key') == key
    ev("state.libraryIdentity={id:'audit-user-lm',name:'李明'};paintModal()")
    assert page.locator('.qr-note').first.locator('summary').inner_text().endswith('选填')
    ev("state.libraryIdentity={id:'current-user',name:'当前用户'};paintModal()")
    checks.append('意见按任务、核验人和结果内容隔离，不用数组下标将旧意见套给新内容')

    # Revocation between opening and saving must not save or export the record.
    card=page.locator('.qr-note').first
    card.locator('summary').click()
    card.locator('textarea').fill('失权后的修改不应保存')
    ev("""()=>{const d=file(modalData.id);window.qrDoc=structuredClone(d);
      d.space='公共空间';d.folder='qr-no-access';folderMeta[directoryKey(d.space,d.folder)]={permission:'NONE'};}""")
    card.locator('[data-action="qr-save"]').click()
    assert ev('key=>qrNotes[key].note', key).startswith('请补充')
    ev("Object.assign(file(qrDoc.id),qrDoc);paintModal()")
    action('close-modal')
    checks.append('保存前重新检查所有来源权限，失权后不改写已有意见')

    open_extract()
    ev("""()=>{window.qrBeforeAttachment=structuredClone(currentTask());
      const t=currentTask(),id=t.result[0].doc;window.qrAttachment=structuredClone(file('d8'));
      t.attachments[id]=['d8'];t.result[0].items[0].source_id='d8';
      t.result[0].items[0].evidence_list=[{text:'附件证据',source_file_id:'d8'}];paintModal();}""")
    assert page.locator('#ew-review-field-0 .qr-note').count()==1
    ev("""()=>{const d=file('d8');d.space='公共空间';d.folder='qr-attachment-denied';
      folderMeta[directoryKey(d.space,d.folder)]={permission:'NONE'};paintModal();}""")
    assert page.locator('#ew-review-field-0 .qr-note').count()==0
    ev("Object.assign(file('d8'),qrAttachment);Object.assign(currentTask(),qrBeforeAttachment);paintModal()")
    action('close-modal')
    checks.append('原始附件证据失权后禁止标记，字段脱敏不会退化成仅检查主文件的核验')

    open_extract()
    ev("""()=>{window.qrBeforeReference=structuredClone(currentTask());
      window.qrDownloadSource=structuredClone(file('d8'));file('d8').can_download=true;
      const ref={...structuredClone(file('d8')),id:'qr-download-reference',refSourceId:'d8'};
      state.docs.push(ref);const t=currentTask(),id=t.result[0].doc;
      t.attachments[id]=[ref.id];t.result[0].items[0].source_id=ref.id;
      t.result[0].items[0].evidence_list=[{text:'引用附件证据',source_file_id:ref.id}];paintModal();}""")
    card=page.locator('#ew-review-field-0 .qr-note')
    card.locator('summary').click()
    card.locator('select').select_option('checked')
    card.locator('textarea').fill('已核对引用附件。')
    card.locator('[data-action="qr-save"]').click()
    reference_key=card.get_attribute('data-qr-key')
    assert card.locator('[data-action="qr-export"]').is_enabled()
    ev("""()=>{window.qrRealDownload=download;window.qrDownloadCalls=0;
      download=()=>{window.qrDownloadCalls++;};file('d8').can_download=false;}""")
    assert ev("auditFileAccess(file('qr-download-reference')).download")
    assert not ev("auditFileAccess(file('d8')).download")
    action('qr-export', key=reference_key)
    assert ev('qrDownloadCalls')==0
    ev('paintModal()')
    assert page.locator('#ew-review-field-0 [data-action="qr-export"]').is_disabled()
    ev("file('d8').can_download=true;paintModal()")
    assert page.locator('#ew-review-field-0 [data-action="qr-export"]').is_enabled()
    ev("""()=>{download=qrRealDownload;Object.assign(file('d8'),qrDownloadSource);
      state.docs=state.docs.filter(d=>d.id!=='qr-download-reference');
      Object.assign(currentTask(),qrBeforeReference);paintModal();}""")
    action('close-modal')
    checks.append('引用源撤销下载权限后，已打开按钮执行与重新渲染均阻止意见导出，不沿用引用的旧权限')

    ev('id=>openTask(id)', fixture['contract'])
    index=ev('cwFiltered(currentTask())[0].index')
    action('cw-result-detail', index=str(index))
    card=page.locator('#ie-result-body .qr-note')
    card.locator('summary').click()
    card.locator('select').select_option('checked')
    card.locator('textarea').fill('已对照合同条款核实。')
    before=ev('JSON.stringify(currentTask())')
    card.locator('[data-action="qr-save"]').click()
    assert ev('JSON.stringify(currentTask())')==before
    for width,height in [(1366,768),(1024,480),(390,600)]:
        page.set_viewport_size({'width':width,'height':height})
        assert ev('document.documentElement.scrollWidth')<=width
        page.screenshot(path=str(ROOT/'review'/f'review-notes-{width}.png'))
    checks.append('合同统一核验视图可选记录意见，原任务不变，三尺寸可用')
    assert not errors, errors
    browser.close()

report={'checks':checks,'errors':errors}
(ROOT/'review/review-notes-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
