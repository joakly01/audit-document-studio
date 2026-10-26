import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1366,'height':768},accept_downloads=True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_default_timeout(6000)
 def click(act,attrs=''):
  selector='[data-action="'+act+'"]'+attrs
  if not page.locator(selector+':visible').count():
   parent=page.locator('.lib-toolbar details').filter(has=page.locator(selector)).last
   if parent.count():parent.locator('summary').click()
  page.locator(selector+':visible').last.click()
 def open_filter():
  summary=page.locator('.lib-main-filter>summary')
  (summary if summary.is_visible() else page.locator('.lib-overflow>summary')).click()
 def scope(value):
  control=page.locator('[data-lib-change="scope"]')
  if not control.is_visible():page.locator('.lib-toolbar details').filter(has=control).last.locator('summary').click()
  control.select_option(value)
 def ev(s):return page.evaluate(s)
 def fresh():
  page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');ev('localStorage.clear()');page.reload(wait_until='networkidle')
 fresh()
 assert page.locator('.lib-table tr.folder-entry').count()==4
 assert page.locator('.lib-table [data-file-id="d2"]').count()==1
 assert not page.locator('.lib-commandbar').count();assert not page.locator('.lib-path-row').count()
 assert page.locator('.lib-toolbar').bounding_box()['height']<=64
 assert ev('document.documentElement.scrollWidth<=innerWidth')
 print('check',len(checks)+1,flush=True);checks.append('目录与文件同层；顶部压缩；表格局部滚动')
 click('lib-create-folder');page.locator('#lib-name').fill('审计底稿');click('lib-save-name')
 assert ev("state.folder==='审计底稿'")
 click('lib-folder-menu','[data-path="审计底稿"]');click('lib-create-at');page.locator('#lib-name').fill('合同核查');page.keyboard.press('Enter')
 assert ev("state.folder==='审计底稿/合同核查'")
 click('upload');content='合同审计资料\n合同金额128万元。尚未完成验收，应补充验收记录。'
 page.locator('#upload-input').set_input_files({'name':'审计核查.txt','mimeType':'text/plain','buffer':content.encode()})
 page.wait_for_function("state.uploads[0].status==='可分析'");uid=ev('state.uploads[0].id');page.keyboard.press('Escape')
 assert ev("file('"+uid+"').folder==='审计底稿/合同核查'")
 page.locator('[data-lib-change="check"][data-id="'+uid+'"]').check()
 page.locator('[data-action="folder"][data-id="全部资料"]').first.click()
 assert uid in ev('state.librarySelected')
 click('lib-folder-menu','[data-path="审计底稿"]');click('lib-rename-folder');page.locator('#lib-name').fill('审计工作底稿');click('lib-save-name')
 assert ev("file('"+uid+"').folder==='审计工作底稿/合同核查'")
 click('folder','[data-id="审计工作底稿/合同核查"]')
 click('file-detail','[data-id="'+uid+'"]');click('lib-rename-file','[data-id="'+uid+'"]');page.locator('#lib-name').fill('合同核验.txt');click('lib-save-name')
 assert ev("file('"+uid+"').name==='合同核验.txt'")
 click('file-detail','[data-id="'+uid+'"]');click('lib-rename-file','[data-id="'+uid+'"]');page.locator('#lib-name').fill('合同核验.pdf');click('lib-save-name');assert '扩展名' in page.locator('#lib-error').inner_text();page.keyboard.press('Escape')
 print('check',len(checks)+1,flush=True);checks.append('嵌套创建、文件与目录重命名、子路径迁移、禁止篡改扩展名、跨目录选择')
 with page.expect_download() as d:click('lib-download','[data-id="'+uid+'"]')
 assert pathlib.Path(d.value.path()).read_bytes()==content.encode()
 page.reload(wait_until='networkidle');click('folder','[data-id="审计工作底稿/合同核查"]')
 with page.expect_download() as d:click('lib-download','[data-id="'+uid+'"]')
 assert pathlib.Path(d.value.path()).read_bytes()==content.encode()
 print('check',len(checks)+1,flush=True);checks.append('原始上传字节下载；刷新后仍可下载')
 click('upload');page.locator('#upload-input').set_input_files({'name':'合同核验.txt','mimeType':'text/plain','buffer':'新版本内容'.encode()});assert ev("modal==='lib-upload-conflicts'");click('lib-upload-conflicts-confirm');assert ev("file('"+uid+"').text")==content
 click('upload');page.locator('#upload-input').set_input_files({'name':'合同核验.txt','mimeType':'text/plain','buffer':'新版本内容'.encode()});page.locator('[data-lib-change="conflict"]').select_option('replace');click('lib-upload-conflicts-confirm');page.wait_for_function("state.uploads[0].status==='可分析'");uid2=ev('state.uploads[0].id');assert uid!=uid2 and ev("file('"+uid+"').text")==content;assert ev("file('"+uid+"').deleted");page.keyboard.press('Escape')
 print('check',len(checks)+1,flush=True);checks.append('重名跳过与覆盖；旧版本保留给历史引用')
 click('lib-move-file','[data-id="'+uid2+'"]') if page.locator('[data-action="lib-move-file"][data-id="'+uid2+'"]').count() else click('file-detail','[data-id="'+uid2+'"]')
 if ev("modal==='file-detail'"):click('lib-move-file','[data-id="'+uid2+'"]')
 page.locator('#lib-move-space').select_option('个人空间');page.locator('#lib-move-target').select_option('');click('lib-confirm-move');assert ev("file('"+uid2+"').space==='个人空间'")
 print('check',len(checks)+1,flush=True);checks.append('文件移动到指定空间、目录')
 page.locator('[data-lib-change="space"]').select_option('项目空间');click('folder','[data-id="合同资料"]')
 click('lib-attachments','[data-id="d1"]');click('lib-pick-attachment');page.locator('[data-v3-change="picker-scope"]').select_option('recursive');page.locator('#picker-query').fill('设备技术附件');page.locator('[data-change="picker-check"][data-id="d12"]').check();click('confirm-picker');assert 'd12' in ev("file('d1').attachments")
 click('lib-attachments','[data-id="d1"]');click('source','[data-id="d12"]');page.keyboard.press('Escape');assert ev("modal==='lib-attachments'");click('lib-unlink','[data-id="d12"]');assert not ev("file('d12').deleted");page.keyboard.press('Escape')
 print('check',len(checks)+1,flush=True);checks.append('附件跨目录关联、原文返回与移除关联不删原件')
 ev("state.space='公共空间';state.folder='制度资料';folderMeta[directoryKey('公共空间','制度资料')]={permission:'FULL',can_delegate:true,is_creator:false};render()")
 click('v6-access');click('lib-permissions');page.locator('#lib-grant-type').select_option('ORG');page.locator('#v6-grantee').select_option('audit-org-engineering');page.locator('#lib-grant-descendants').check();click('lib-save-grant');assert '工程审计处' in page.locator('.modalbody').inner_text();click('lib-revoke');click('lib-permissions-back');assert '工程审计处' in page.locator('.modalbody').inner_text();click('lib-revoke');click('lib-revoke-confirm');assert not ev("libMeta('公共空间','制度资料').grants.length");page.keyboard.press('Escape');page.locator('[data-lib-change="space"]').select_option('项目空间')
 print('check',len(checks)+1,flush=True);checks.append('用户/机构授权、下级机构范围、撤销前确认与取消')
 click('lib-folder-menu','[data-path=""]');click('lib-import-folder');assert page.locator('#lib-reference-path option').count()>0;click('lib-confirm-import');ref=ev('state.folder');assert not ev('libWritable()');assert page.locator('[data-action="upload"]').is_disabled();assert not ev("file('d14').deleted")
 refids=ev("state.docs.filter(d=>d.refSourceId&&!d.deleted).map(d=>d.id)")
 assert refids
 # References remain live when the source changes.
 ev("file('d14').text='更新后的制度条款';render()")
 assert ev("state.docs.find(d=>d.refSourceId==='d14').text")=='更新后的制度条款'
 click('lib-folder-menu','[data-path="'+ref+'"]');click('lib-remove-reference');click('lib-confirm-remove-reference');assert not ev("file('d14').deleted");assert ref not in ev("directoryPaths('项目空间')")
 page.locator('[data-lib-change="space"]').select_option('公共空间');assert page.locator('[data-action="upload"]').is_disabled()
 scope('recursive');click('file-detail','[data-id="d14"]');assert page.locator('[data-action="lib-rename-file"]').first.is_disabled();page.keyboard.press('Escape')
 print('check',len(checks)+1,flush=True);checks.append('引用目录只读、源内容更新、取消引入保留原件；公共空间只读')
 fresh();scope('recursive')
 page.locator('[data-lib-change="size"]').select_option('20');page.locator('[data-lib-change="page"]').check();assert len(ev('state.librarySelected'))==17
 click('library-selected');click('source','[data-id="d1"]');page.keyboard.press('Escape');assert ev("modal==='library-selected'");page.keyboard.press('Escape')
 # File type / parse-state filters do not change selected scope.
 open_filter();page.locator('[data-lib-change="type"]').select_option('xlsx');assert page.locator('.lib-table tbody tr').count()==2;assert len(ev('state.librarySelected'))==17
 open_filter();click('lib-reset');assert not page.locator('[data-action="lib-columns"]').count();assert page.locator('.lib-col-owner').is_visible();page.locator('.lib-overflow>summary').click();assert not page.locator('[data-lib-change="sort"]').count();page.keyboard.press('Escape')
 click('lib-toggle-tools');assert not page.locator('.lib-tools').is_visible();click('lib-toggle-tools');click('lib-toggle-folders');assert not page.locator('.lib-folders').is_visible();click('lib-toggle-folders')
 print('check',len(checks)+1,flush=True);checks.append('跨页全选、已选返回、类型过滤、固定业务列、移除列表排序、两侧折叠；筛选不改分析范围')
 click('lib-search');page.locator('#lib-text-query').fill('合同');click('lib-search-run');page.wait_for_function("modalData.hits!==null&&!modalData.busy");assert ev('modalData.hits.length')>0
 page.locator('[data-v6-change="search-all"]').check()
 with page.expect_download() as d:click('lib-search-export','[data-format="xlsx"]')
 assert pathlib.Path(d.value.path()).stat().st_size>100
 page.locator('[data-v6-change="regex"]').check();page.locator('#lib-text-query').fill('[');click('lib-search-run');page.wait_for_function('!modalData.busy');assert '正则表达式无效' in page.locator('#lib-error').inner_text();page.keyboard.press('Escape')
 print('check',len(checks)+1,flush=True);checks.append('正文检索、原文核验、勾选导出 Excel、无效正则反馈')
 click('open-tool','[data-id="meeting"]');assert ev("modal==='lib-tool-handoff'");before=ev('state.librarySelected');assert ev('modalData.accepted.length')>0;click('lib-confirm-handoff');assert ev("state.view==='tool'");assert len(ev('ws().ids'))<17;assert ev('state.librarySelected')==before;assert page.locator('[data-action="add-tool-materials"]').is_visible()
 print('check',len(checks)+1,flush=True);checks.append('工具前检查格式与解析状态，确认后仅带入适用资料，已选清单保留')
 fresh();click('lib-create-folder');page.locator('#lib-name').fill('待解析资料');click('lib-save-name');click('upload');page.locator('#upload-input').set_input_files({'name':'不支持.bin','mimeType':'application/octet-stream','buffer':b'123'});page.wait_for_function("state.uploads[0].status==='解析失败'");failed=ev('state.uploads[0].id');page.keyboard.press('Escape');page.locator('[data-lib-change="check"]').check();click('lib-reparse');assert ev("modal==='lib-reparse'");click('lib-confirm-reparse');page.wait_for_function("state.uploads[0].status==='解析失败'");assert ev("file('"+failed+"').parseError")
 click('file-detail','[data-id="'+failed+'"]');click('lib-delete-file');page.keyboard.press('Escape');assert not ev("file('"+failed+"').deleted");click('file-detail','[data-id="'+failed+'"]');click('lib-delete-file');click('lib-confirm-delete');assert ev("file('"+failed+"').deleted")
 click('lib-folder-menu','[data-path="待解析资料"]');click('lib-delete-folder');click('lib-confirm-delete');assert '待解析资料' not in ev("directoryPaths('项目空间')")
 print('check',len(checks)+1,flush=True);checks.append('解析失败可选择与重试；删除需确认；空目录可删除')
 # Original admin-only abilities stay gated, and can use the same frontend flows.
 ev("state.libraryAdmin=true;state.space='公共空间';state.folder='制度资料';render()");click('lib-folder-menu','[data-path="制度资料"]');click('public-bind-project');page.locator('#v6-bound-project').select_option('project-audit-renovation');click('lib-save-bind');click('lib-folder-menu','[data-path="制度资料"]');click('public-bind-org');page.locator('#v6-bound-org').select_option('audit-org-engineering');click('lib-save-bind');assert ev("libMeta('公共空间','制度资料').boundOrg")== '市审计局 / 工程审计处'
 click('lib-storage');page.locator('#lib-quota').fill('0');click('lib-save-quota');assert page.locator('#lib-error').inner_text();page.locator('#lib-quota').fill('8');click('lib-save-quota');assert ev('storageQuota.personal')==8;page.keyboard.press('Escape')
 print('check',len(checks)+1,flush=True);checks.append('管理员绑定机构/项目、额度校验；普通用户不出现管理员入口')
 fresh()
 for width,height in [(1440,900),(1366,768),(1024,600),(390,844)]:
  page.set_viewport_size({'width':width,'height':height});page.screenshot(path=str(root/f'review/v5-library-{width}.png'),full_page=True,animations='disabled');assert ev('document.documentElement.scrollWidth<=innerWidth'),width
 print('check',len(checks)+1,flush=True);checks.append('1440、1366、1024、390 宽度无页面横向溢出')
 assert not errors,errors
 (root/'review/library-v5-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
 print(json.dumps({'checks':len(checks),'errors':errors},ensure_ascii=False));b.close()
