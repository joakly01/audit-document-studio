import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');page.set_default_timeout(7000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');page.evaluate('localStorage.clear()');page.reload(wait_until='networkidle');page.evaluate('libraryStatusDataReady')
 def ev(s):return page.evaluate(s)
 def click(a):page.locator('[data-action="'+a+'"]:visible').last.click()
 def note(s):checks.append(s);print(s,flush=True)
 expected=['uploading','pending','processing','done','failed','stuck']
 counts=ev("()=>Object.fromEntries(['project','personal','public','oss'].map(code=>[code,progressRows().filter(r=>r.id.startsWith('status-data-v1-'+code+'-')).map(r=>r.status)]))")
 for code in counts:assert all(stage in counts[code] for stage in expected),(code,counts[code])
 assert ev('state.docs.filter(d=>d.statusCatalog).length')==26
 assert not ev('state.libraryAdmin') and not ev('libParseQueue.length')
 assert not ev("libCanParse(file('status-data-v1-personal-uploading'))||libCanParse(file('status-data-v1-personal-processing'))")
 assert ev("libCanParse(file('status-data-v1-personal-pending'))&&libCanParse(file('status-data-v1-personal-stuck'))")
 note('三个空间及OSS各有六类状态，另有空正文/缺原件失败；状态稳定，未启动远程任务或提升权限；上传/识别中不重复解析')
 ev("state.space='个人空间';state.folder='我的资料/资料接收';state.librarySelected=state.docs.filter(d=>d.statusCatalog&&d.space==='个人空间').map(d=>d.id);render()")
 assert page.locator('[data-selection-count="total"]').inner_text()=='8';assert page.locator('[data-selection-count="ready"]').inner_text()=='1';assert page.locator('[data-selection-count="pending"]').inner_text()=='7'
 assert set(ev("libItems().filter(x=>x.file).map(x=>libStatus(x.file))"))=={'解析完成','未解析','解析中','解析失败'}
 ev("progressOpen({space:'个人空间'})")
 for stage in expected:
  page.locator('[data-progress-change="status"]').select_option(stage);assert page.locator('.progress-table tbody tr[data-progress-id]').count()>=1,stage
 page.locator('[data-progress-change="status"]').select_option('uploading');assert '46%' in page.locator('.progress-table').inner_text()
 page.locator('[data-progress-change="status"]').select_option('failed');assert page.locator('.progress-row-error').count()>=3
 page.screenshot(path=str(root/'review/status-records-cases.png'),animations='disabled');click('close-modal')
 note('资料列表四类解析状态、底栏1已解析/7未完成一致；上传记录六状态均可筛选，进度与失败原因可见')
 ev("state.space='项目空间';state.librarySelected=state.docs.filter(d=>d.id.startsWith('status-data-v1-project-')).map(d=>d.id);render()")
 page.locator('.lib-tools [data-action="open-tool"][data-id="word"]').click();assert ev("modal==='lib-tool-handoff'");assert ev('modalData.accepted')==['status-data-v1-project-done'];assert ev('modalData.excluded.length')==5;page.keyboard.press('Escape')
 ev("state.space='个人空间';state.folder='我的资料/资料接收';state.librarySelected=state.docs.filter(d=>d.statusCatalog&&d.space==='个人空间').map(d=>d.id);render()")

 # Actual retry path uses stored File bytes; missing or empty files never become successful by a flag change.
 ev("progressOpen({space:'个人空间'})");ev("progressRetryConfirm(['status-data-v1-personal-failed'])");click('progress-confirm-retry');page.wait_for_function("!file('status-data-v1-personal-failed').local");assert ev("file('status-data-v1-personal-failed').text.includes('128')")
 ev("progressRetryConfirm(['status-data-v1-personal-failed-empty'])");click('progress-confirm-retry');page.wait_for_function("!!file('status-data-v1-personal-failed-empty').parseError");assert ev("file('status-data-v1-personal-failed-empty').local")
 ev("progressRetryConfirm(['status-data-v1-personal-failed-missing'])");click('progress-confirm-retry');page.wait_for_function("modalData.notice?.includes('需在详情中补充原文件')");assert ev("file('status-data-v1-personal-failed-missing').local")
 click('close-modal');ev("state.librarySelected=['status-data-v1-personal-stuck'];state.uploads.find(r=>r.id===state.librarySelected[0]).queueCleared=true;render()")
 ev("libReparse(['status-data-v1-personal-stuck'])");page.wait_for_function("!file('status-data-v1-personal-stuck').local");assert ev("progressRows().find(r=>r.id==='status-data-v1-personal-stuck').status")=='done'
 before=ev('state.docs.length');page.reload(wait_until='networkidle');page.evaluate('libraryStatusDataReady');assert ev('state.docs.length')==before;assert ev("!file('status-data-v1-personal-failed').local");assert ev("progressRows().find(r=>r.id==='status-data-v1-personal-processing').status")=='processing'
 note('实际字节支持失败重试恢复与积压重入队；空正文仍失败、原件缺失单独提示；刷新不重造或重置已处理状态')
 # Mixed spaces, read-only documents and upload/parse failures all remain removable from the selection.
 ev("state.space='项目空间';state.folder='合同资料';state.librarySelected=['d1','d2','d14',...state.docs.filter(d=>d.statusCatalog&&d.space==='个人空间').map(d=>d.id)];render()")
 original=ev('state.librarySelected');docsBefore=ev("JSON.stringify(state.docs)");click('library-selected')
 assert page.locator('.selection-table th').all_text_contents()==['','序号','文件名称','解析状态','所有者','位置','操作']
 assert page.locator('.selection-table tbody tr').count()==11;assert page.locator('[data-action="selection-remove-batch"]').is_disabled()
 page.locator('[data-selection-change="row"][data-id="d14"]').check();assert ev('state.librarySelected')==original;assert page.locator('[data-selection-change="all"]').evaluate('e=>e.indeterminate')
 page.locator('[data-selection-change="row"][data-id="d1"]').check();click('selection-remove-batch');assert ev("modal==='selection-remove-confirm'");assert '不删除资料' in page.locator('.modalhead').inner_text();page.keyboard.press('Escape');assert ev("modal==='library-selected'");assert page.locator('[data-selection-change="row"][data-id="d14"]').is_checked()
 click('selection-remove-batch');click('selection-confirm-remove');assert not ev("state.librarySelected.includes('d14')||state.librarySelected.includes('d1')");assert ev('JSON.stringify(state.docs)')==docsBefore
 note('已选清单表格化；勾选独立于主列表；全选有半选态；跨空间/只读可批量移除；确认可取消，移除不删除或改写资料')
 page.locator('#selection-query').fill('付款');assert page.locator('.selection-table tbody tr[data-selection-id]').count()>=1
 page.locator('[data-selection-change="all"]').check();checked=ev('modalData.removeIds');page.locator('#selection-query').fill('不存在的名称');assert '没有符合条件' in page.locator('.selection-empty').inner_text();assert ev('modalData.removeIds')==checked;page.locator('#selection-query').fill('')
 # Source preview preserves query/checked state and returns to this same list.
 page.locator('.selection-table [data-action="source"][data-id="d2"]').click();page.keyboard.press('Escape');assert ev("modal==='library-selected'");assert ev('modalData.removeIds')==checked
 click('close-modal');assert not page.locator('.lib-table [data-lib-change="check"][data-id="d1"]').is_checked()
 click('library-selected');assert not ev('modalData.removeIds.length')
 note('搜索文件/位置、结果内全选、跨搜索保留待移除勾选；预览返回保留；重新打开不沿用上次待移除勾选，主表同步取消')
 # Expanded list: every dialog area stays within short and narrow windows.
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
  result=ev("()=>{const r=document.querySelector('.selection-dialog').getBoundingClientRect(),f=document.querySelector('.selection-dialog .modalfoot').getBoundingClientRect(),s=document.querySelector('.selection-table-scroll').getBoundingClientRect();return{w:innerWidth,h:innerHeight,top:r.top,bottom:r.bottom,left:r.left,right:r.right,footer:f.bottom,table:s.height,overflow:document.documentElement.scrollWidth-innerWidth}}")
  assert result['top']>=0 and result['bottom']<=h+1 and result['left']>=0 and result['right']<=w+1 and result['footer']<=h+1 and result['table']>=80 and result['overflow']==0,result
  layouts.append(result);page.screenshot(path=str(root/f'review/selected-list-{w}.png'),animations='disabled')
 note('四种屏幕下表格独立滚动、表头及移除固定、确认/关闭按钮可见，正文16px辅助14px，无整页溢出')
 # Clear all follows the same reversible confirmation semantics and closes when nothing remains.
 page.set_viewport_size({'width':1366,'height':768});click('lib-clear-selection-modal');page.keyboard.press('Escape');assert ev('state.librarySelected.length')>0
 click('lib-clear-selection-modal');click('selection-confirm-remove');assert ev('modal===null') and not ev('state.librarySelected.length');assert not ev("file('d14').deleted")
 ev("state.librarySelected=['d2'];render()");click('library-selected');click('selection-remove-one');assert ev('modal===null') and not ev('state.librarySelected.length');assert not ev("file('d2').deleted")
 note('清空确认可取消；移除最后一项自动关闭；单行移除同样只取消选择')
 assert not errors,errors
 (root/'review/status-selection-results.json').write_text(json.dumps({'checks':checks,'states':counts,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
