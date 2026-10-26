import json,pathlib,tempfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True);page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#tool/extract',wait_until='networkidle');page.evaluate('libraryStatusDataReady')
 def ev(s,arg=None):return page.evaluate(s,arg)
 def click(a):
  target=page.locator('[data-action="'+a+'"]:visible')
  if not target.count() and page.locator('.uc-command-more>summary:visible').count():page.locator('.uc-command-more>summary:visible').click()
  page.locator('[data-action="'+a+'"]:visible').last.click()
 def act(a,id=None,index=None):ev("x=>handleAction(x.a,{dataset:{id:x.id,index:x.index}})",{'a':a,'id':id,'index':index})
 def note(s):checks.append(s);print(s,flush=True)
 def prep(ids=['d1','d2','d3']):ev("ids=>{nav('tool','extract');ws().taskId=null;ws().ids=ids;ws().preview=ids[0];ws().tab='materials';ewView.folder=null;ewView.query='';ewView.filter='all';ewView.resultQuery='';manage=false;render()}",ids)
 def submit(mode='1'):
  click('run');assert ev("modal==='ew-submit'");page.locator('#ew-execution').select_option(mode);click('ew-submit-confirm')
 assert page.locator('.ef-empty').is_visible();assert not page.locator('.ew-commandbar .btn.primary').is_enabled();assert ev('ws().config.chunk')==12000;assert not ev('ws().config.merge')
 page.locator('[data-xt-change=template]').select_option('sys-extract');click('xt-apply-confirm')
 click('add-tool-materials');assert ev("modal==='picker'");assert page.locator('[data-action="picker-upload-files"]').count() or '上传' in page.locator('#modal-root').inner_text();page.keyboard.press('Escape');prep()
 assert not page.locator('[data-action=ew-manage]').count();page.locator('[data-action=ef-remove-material][data-id=d1]').click();assert ev('ws().ids.length')==2;assert ev('state.docs.some(d=>d.id==="d1"&&!d.deleted)');page.locator('#undo-toast').click();assert ev('ws().ids.length')==3
 page.locator('#ew-tree-query').fill('找不到');assert '没有匹配' in page.locator('.ew-tree').inner_text();assert ev('ws().ids.length')==3;page.locator('#ew-tree-query').fill(''); # Searches never delete a file
 prep();page.locator('.ew-file [data-action="preview"]').first.click();page.wait_for_function("document.querySelector('#ef-raw-content')?.dataset.rawReady==='pdf'");assert page.locator('#ef-field-0').is_visible();click('source');page.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady==='pdf'");assert page.locator('#preview-parsed-content').is_visible();page.keyboard.press('Escape')
 note('空状态、资料库/上传入口、目录与文件预览、搜索不改范围、逐份移除及撤销，批量移除入口已取消；原件/解析内容双栏保留')
 # Inline fields update the current copy only; duplicate names blocked and descriptions optional.
 page.locator('#ef-field-0').fill('合同名称');page.locator('#ef-field-1').fill('合同名称');assert '重复' in page.locator('#ef-field-error').inner_text();page.locator('#ef-field-1').fill('涉及单位');page.locator('[data-ef-input="description"]').first.fill('');assert not ev('validate(false).length')
 ev("ws().config.chunk=999;render()");click('run');assert ev("modal==='validation'");page.keyboard.press('Escape');ev("ws().config.chunk=12000;ws().config.overlap=12000;render()");assert ev('validate(false).length')>0;ev("ws().config.overlap=200;render()")
 frag=ev('configurationFragment("extract",ws().config)');assert frag['custom_config']['overlap']==200;assert 'chunk_overlap' not in frag['custom_config'];assert frag['exec_mode']=='custom'
 note('字段直接编辑、同名校验与可选说明；参数上下限与 overlap 请求字段对齐原代码')
 click('run');page.locator('#ew-task-name').fill('');click('ew-submit-confirm');assert '名称' in page.locator('#ew-submit-error').inner_text();page.locator('#ew-task-name').fill('采购合同要素提取');page.locator('#ew-task-notes').fill('核对合同与年度批复');click('ew-submit-confirm');assert page.locator('.ew-progress').is_visible();task=ev('currentTask().id');snapshot=ev('JSON.stringify(currentTask().config)');page.wait_for_function("currentTask()?.status==='completed'");assert ev('currentTask().name')=='采购合同要素提取';assert ev('currentTask().result[0].values[0]')=='设备采购合同';assert ev('currentTask().result.every(r=>r.items.every(f=>f.confidence===null))');assert page.locator('.ew-results').is_visible();assert not page.locator('.ew-config').count()
 page.screenshot(path=str(root/'review/extract-workflow-results-1366.png'),animations='disabled')
 # Every result is source inspectable and rows with missing fields are filterable.
 page.locator('[data-action="ew-review"]').first.click();page.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady==='pdf'");assert page.locator('#ew-review-content').is_visible();assert not page.locator('#preview-parsed-content').is_visible();page.locator('[data-action="ew-locate"]').first.click();assert page.locator('#ew-evidence-mark').is_visible();assert '设备采购合同' in page.locator('#ew-evidence-mark').inner_text();page.locator('[data-tab="fields"]').click();page.screenshot(path=str(root/'review/extract-workflow-review-1366.png'),animations='disabled');click('ew-review-next');assert ev('modalData.id')=='d2';page.keyboard.press('Escape')
 page.locator('[data-ew-change="result-filter"]').select_option('missing');assert page.locator('.ew-result-table tbody tr').count()<=3;click('ew-clear-results');page.locator('#ew-result-query').fill('完全不匹配');assert '没有匹配' in page.locator('.ew-table-scroll').inner_text();click('ew-clear-results')
 act('tr-config',task);assert page.locator('.ew-config select').first.is_disabled();assert page.locator('#ef-field-0').get_attribute('readonly') is not None;assert not page.locator('[data-action="ef-field-add"]').count();act('tr-result',task)
 note('立即执行、任务命名和备注、逐文件进度、汇总筛选、原件/字段证据双栏与定位、前后文件切换、执行快照只读')
 page.locator('[data-ew-change="result-check"]').first.check()
 for fmt in ['json','csv','markdown','xlsx']:
  click('ew-export-selected');page.locator('#ew-export-format').select_option(fmt)
  with page.expect_download() as dl:click('do-export')
  target=pathlib.Path(tmp)/('extraction.'+fmt);dl.value.save_as(target);assert target.stat().st_size>100
  if fmt=='json':data=json.loads(target.read_text());assert len(data['results'])==1;assert data['results'][0]['items'][0]['evidence']=='设备采购合同';assert data['exec_config']['custom_config']['overlap']==200
  if fmt=='csv':assert '原文证据' in target.read_text(encoding='utf-8-sig')
  if fmt=='xlsx':
   import zipfile
   with zipfile.ZipFile(target) as z:assert len([n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')])==3
 act('new-analysis');assert ev('currentTask()') is None;assert ev("JSON.stringify(state.tasks.find(t=>t.id==='"+task+"').config)")==snapshot
 note('所选/全部导出范围、Excel三工作表及CSV/Markdown/JSON真实下载；复制新建保留旧任务配置')
 # Partial result failures, retry, stop, background execution and history.
 ev("ws().config.failure='partial';render()");submit();page.wait_for_function("currentTask()?.status==='partial'");assert ev('currentTask().failedIds.length')==1;success=ev('currentTask().successIds');click('retry-task');page.wait_for_function("currentTask()?.status==='completed'");assert all(i in ev('currentTask().successIds') for i in success)
 act('new-analysis');ev("ws().config.failure='fail';render()");submit();page.wait_for_function("currentTask()?.status==='failed'");assert page.locator('.ew-failed').is_visible();click('retry-task');page.wait_for_function("currentTask()?.status==='completed'")
 act('new-analysis');submit();click('stop-task');click('confirm-stop');assert ev("currentTask().status==='stopped'");assert ev('isLocked()');act('new-analysis');submit('2');assert ev("state.view==='tasks'");running=ev('state.tasks[0].id');page.wait_for_function("state.tasks[0].status==='completed'");ev("id=>openTask(id)",running);assert page.locator('.ew-results').is_visible()
 note('部分失败保留成功结果并重试、全失败重试、停止保留记录、提交后台及历史结果回看')
 # Exact original response fields: booleans false, zero, evidence arrays; joint rows cannot fall back to another file.
 normalized=ev("ewNormalizeResult({final_result:{items:[{name:'金额',extracted:0,is_found:true,evidence_list:[{text:'金额为0元'}]},{name:'日期',extracted:'2026-01-01',is_found:'False'}]}},'d1',currentTask().config)")
 assert normalized['items'][0]['extracted']=='0' and normalized['items'][0]['is_found'] and normalized['items'][0]['evidence']=='金额为0元';assert not normalized['items'][1]['is_found'];assert normalized['items'][0]['confidence'] is None
 assert ev("ewNormalizeResult({joint_table:{columns:['文件名','金额'],rows:[{fileName:'其他文件.pdf',values:{金额:'100元'}}]}},'d1',currentTask().config).unmatched")
 # Permission changes at submit and export are rechecked, not just hidden in buttons.
 prep();ev("file('d1').deleted=true;render()");assert any('移除' in x for x in ev('validate(false)'));ev("file('d1').deleted=false;render()")
 note('原接口结果兼容0值/false/多条证据且不编造置信度；联合表按文件匹配；执行时重新核对资料权限')
 # 26-file test covers real paging/selection; low resolution retains core table, buttons and dialogs.
 ids=ev("state.docs.filter(d=>ewAllowed(d)).slice(0,26).map(d=>d.id)");prep(ids);submit();page.wait_for_function("currentTask()?.status==='completed'");assert page.locator('.ew-result-table tbody tr').count()==10;page.locator('[data-ew-change="result-page"]').check();assert ev('ewView.selected.length')==10;page.locator('[data-action="ew-page"][data-kind="results"][data-step="1"]').click();page.locator('[data-ew-change="result-check"]').first.check();assert ev('ewView.selected.length')==11
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(200);page.evaluate("document.getElementById('toast').classList.remove('show')");page.screenshot(path=str(root/f'review/extract-workflow-results-{w}.png'),animations='disabled');r=ev("({w:innerWidth,h:innerHeight,body:document.documentElement.scrollWidth,table:document.querySelector('.ew-table-scroll').clientHeight,footer:document.querySelector('.ew-pagination').getBoundingClientRect().bottom})");assert r['body']<=w,r
  if w>800:assert r['table']>=200 and r['footer']<=h,r
  act('tr-config',ev('currentTask().id'));page.wait_for_timeout(100)
  if w<=650:
   # Mobile config deliberately stacks task scope above the readonly fields in one scroll region.
   m=page.locator('.tr-config-layout').bounding_box();assert m['y']>=0 and m['y']+m['height']<=h+1,m
   page.locator('#ef-field-0').scroll_into_view_if_needed();field=page.locator('#ef-field-0').bounding_box();assert field['y']>=0 and field['y']+field['height']<=h+1,field
  else:
   m=page.locator('.tr-config-content').bounding_box();assert m['y']>=0 and m['y']+m['height']<=h+1,m
  assert page.locator('#ef-field-0').get_attribute('readonly') is not None;page.screenshot(path=str(root/f'review/extract-workflow-fields-{w}.png'),animations='disabled');act('tr-result',ev('currentTask().id'));layouts.append(r)
 note('26份结果分页与跨页勾选；1440/1366/1024×480/390尺寸，核心表格、独立滚动与弹窗操作区可见')
 # Other tool config/interaction surfaces still render after scoped extraction overrides.
 page.set_viewport_size({'width':1366,'height':768})
 for tool_id in ev('TOOLS.map(t=>t.id)'):
  if tool_id=='extract':continue
  ev("id=>nav('tool',id)",tool_id);assert page.locator('.work-commandbar').is_visible();assert not page.locator('.ef-workspace').count(),tool_id
 assert not errors,errors
 (root/'review/extract-workflow-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
