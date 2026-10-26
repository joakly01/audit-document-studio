import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];errors=[];checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle');pg.evaluate('libraryStatusDataReady')
 def ev(s,arg=None):return pg.evaluate(s,arg)
 def act(a,id=None):ev("([a,id])=>handleAction(a,{dataset:{id}})",[a,id])
 def click(a):pg.locator('[data-action="'+a+'"]:visible').last.click()
 ev("ws().ids=['d1','d2'];ws().preview='d1';ws().tab='materials';render()")
 act('attachments','d1');assert pg.locator('.ew-attachments-table tbody tr').count()==1;click('source');pg.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady==='pdf'");pg.keyboard.press('Escape');assert ev("modal==='attachments'");assert pg.locator('.ew-attachments-table tbody tr').count()==1;pg.keyboard.press('Escape')
 ev("file('d1').can_analyze=false;render()");assert any('权限' in s for s in ev('validate(false)'));click('run');assert ev("modal==='validation'");pg.keyboard.press('Escape');ev("delete file('d1').can_analyze;ws().config.merge=true;ws().config.fieldDefs.push({name:'验收要求',description:'说明验收记录'});ws().config.fields=ws().config.fieldDefs.map(f=>f.name);render()")
 click('run');click('ew-submit-confirm');pg.wait_for_function("currentTask()?.status==='completed'");task=ev('currentTask().id');snap=ev('JSON.stringify(currentTask().config)')
 ev("file('d1').attachments=[]");act('attachments','d1');assert pg.locator('.ew-attachments-table tbody tr').count()==1;assert not pg.locator('[data-action="pick-attachment"]').count();pg.keyboard.press('Escape')
 # Explicit attachment source access is checked for rendered/ exported field data.
 ev("currentTask().result[0].items[0]={name:'附件事项',extracted:'附件私有内容',is_found:true,source_id:'d12',evidence:'附件私有证据'};folderMeta[directoryKey(file('d12').space,file('d12').folder)]={permission:'NONE'};render()")
 assert not ev('ewItems(currentTask(),currentTask().result[0])[0].is_found');assert '附件私有内容' not in pg.locator('.ew-results').inner_text();ev("delete folderMeta[directoryKey(file('d12').space,file('d12').folder)]")
 ev("file('d1').can_download=false");assert ev("ewExportable(currentTask()).map(r=>r.doc)")==['d2'];act('export');assert '1 份' in pg.locator('#ew-export-scope').inner_text();pg.keyboard.press('Escape');ev("delete file('d1').can_download")
 payload=ev('ewExecutionPayload(currentTask())');assert payload['biz_type']=='fileToPdf' and payload['task_switch']==1 and len(payload['files'])==2;assert payload['files'][0]['custom_config']['overlap']==200
 # A historical task from the old UI retains its 2000-char configuration when reopened.
 ev("currentTask().config.chunk=2000;delete currentTask().config.extractionWorkflowVersion");snap=ev('JSON.stringify(currentTask().config)');ev('render()');assert ev('JSON.stringify(currentTask().config)')==snap
 checks.append('附件预览返回、历史附件快照、提取/下载/证据访问权限复核、原BatchExecuteByFilter形状及旧任务配置不被迁移改写')
 # Four-size preparation, field editor and submission layouts plus actual host-frame embedding.
 click('new-analysis');ev("ws().config.chunk=12000;ws().tab='materials';render()")
 for w,h in [(1366,768),(1024,480),(390,600)]:
  pg.set_viewport_size({'width':w,'height':h});ev('render()');pg.wait_for_timeout(100);assert ev('document.documentElement.scrollWidth')<=w
  pg.screenshot(path=str(root/f'review/extract-workflow-preparation-{w}.png'),animations='disabled');click('run');pg.wait_for_timeout(100);m=pg.locator('.ew-submit-dialog').bounding_box();assert m['y']>=0 and m['y']+m['height']<=h+1,m;assert pg.locator('.ew-submit-dialog .modalfoot').is_visible();pg.screenshot(path=str(root/f'review/extract-workflow-submit-{w}.png'),animations='disabled');pg.keyboard.press('Escape')
 host=b.new_page(viewport={'width':1150,'height':650},reduced_motion='reduce');host.set_content('<div style="height:60px">审计业务平台</div><iframe title="文档挖掘助手" src="http://127.0.0.1:8765/#tool/extract" style="width:1024px;height:480px;border:0"></iframe>');frame=host.frames[-1];frame.wait_for_function("typeof efView!=='undefined'");frame.evaluate('libraryStatusDataReady');frame.evaluate("ws().ids=['d1','d2'];ws().tab='materials';render()");assert frame.evaluate('document.documentElement.scrollHeight')==480;assert frame.evaluate("document.querySelector('.ef-preview-content').clientHeight")>=250;assert frame.evaluate("document.querySelector('.ef-fields-scroll').clientHeight")>=180;host.screenshot(path=str(root/'review/extract-workflow-embedded-1024.png'),animations='disabled');host.close()
 checks.append('三尺寸准备页与执行弹窗、1024×480实际iframe嵌入：无外层页面溢出，原文与字段区可见')
 assert not errors,errors;(root/'review/extract-workflow-edge-checks.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
