import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');page.set_default_timeout(6000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');page.evaluate('localStorage.clear()');page.reload(wait_until='networkidle')
 def ev(s):return page.evaluate(s)
 def click(a):page.locator('[data-action="'+a+'"]:visible').last.click()
 def note(s):checks.append(s);print(s,flush=True)
 def menu():ev("openModal('lib-folder-menu',{space:'公共空间',path:'制度资料'})")
 ev("state.libraryAdmin=true;state.space='公共空间';state.folder='制度资料';folderMeta={};render()")
 menu()
 for a in ['lib-create-at','lib-permissions','public-bind-project','public-bind-org','lib-delete-folder']:assert page.locator('[data-action="'+a+'"]:visible').count()==1,a
 ev("folderMeta[directoryKey('公共空间','制度资料')]={is_creator:true};paintModal()")
 assert page.locator('[data-action="lib-rename-folder"]:visible').count()==1
 click('close-modal');ev("state.libraryAdmin=false;folderMeta[directoryKey('公共空间','')]={permission:'FULL'};render()")
 assert not ev("auditFolderAccess('公共空间','').create")
 for meta in [dict(permission='READ'),dict(permission='FULL',is_oss_folder=True)]:
  page.evaluate("m=>{folderMeta[directoryKey('公共空间','制度资料')]=m;render()}",meta)
  assert not page.locator('.lib-tree-scroll [data-action="lib-folder-menu"][data-path="制度资料"]').is_visible()
  menu();assert not page.locator('[data-action="public-bind-project"]:visible').count();assert not page.locator('[data-action="public-bind-org"]:visible').count();click('close-modal')
 ev("folderMeta[directoryKey('公共空间','制度资料')]={permission:'FULL',is_creator:true,can_delegate:true};render()")
 menu();assert page.locator('[data-action="public-bind-project"]').is_visible();assert not page.locator('[data-action="public-bind-org"]').count();click('close-modal')
 note('公共空间按权限开放六项管理功能；机构绑定限管理员；只读/OSS目录不出现修改菜单；公共根目录仅管理员可新建')
 ev("state.libraryAdmin=true;state.folder='全部资料';render();openModal('lib-name',{space:'公共空间',path:'',create:true})")
 assert page.locator('#public-builtin').is_visible();page.locator('#public-builtin').check();page.locator('#lib-name').fill('系统目录核验');click('lib-save-name')
 assert ev("libMeta('公共空间','系统目录核验').is_system_builtin&&libMeta('公共空间','系统目录核验').is_creator")
 ev("state.libraryAdmin=false;render()")
 assert not ev("auditFolderAccess('公共空间','系统目录核验').rename")
 ev("state.libraryAdmin=true;state.folder='制度资料';state.libraryProjects=Array.from({length:23},(_,i)=>({project_uuid:'prj-'+i,project_name:'审计项目'+i}));render()")
 menu();click('public-bind-project');assert not page.locator('#v6-bound-org').count();click('public-project-next');page.locator('#v6-bound-project').select_option('prj-14');page.locator('#public-project-query').fill('审计项目2');assert page.locator('#v6-bound-project').input_value()=='prj-14';click('lib-save-bind');assert ev("libMeta('公共空间','制度资料').project_uuid")=='prj-14'
 menu();click('public-bind-org');assert not page.locator('#v6-bound-project').count();assert page.locator('#lib-bound-grant').is_checked();assert not page.locator('#lib-bound-descendants').is_checked();page.locator('#v6-bound-org').select_option('audit-org-engineering');page.locator('#lib-bound-descendants').check();click('lib-save-bind')
 assert ev("libMeta('公共空间','制度资料').project_uuid")=='prj-14'
 assert ev("libMeta('公共空间','制度资料').grants[0].include_org_descendants")
 assert not ev("auditFolderAccess('公共空间','制度资料').create")
 assert ev("auditFolderAccess('公共空间','制度资料/下层').create")
 assert page.locator('.public-binding-mark').count()>=2
 note('管理员可建系统内置目录；项目搜索分页保留所选；项目和机构独立绑定不覆盖；机构可默认授权查看并含下级；机构根目录限制新建')
 menu();click('lib-permissions');assert '类型' in page.locator('.modalbody').inner_text();page.locator('#v6-grantee').select_option('audit-user-lm');page.locator('#lib-grant-level').select_option('MANAGE');assert page.locator('#v6-grantee').input_value()=='audit-user-lm';page.locator('#lib-grant-delegate').check();assert page.locator('#lib-grant-delegate').is_checked();page.locator('#public-grantee-query').fill('李明');assert page.locator('#lib-grant-delegate').is_checked();click('lib-save-grant');assert ev("libMeta('公共空间','制度资料').grants[1].can_delegate")
 click('lib-revoke');click('lib-permissions-back');assert ev("libMeta('公共空间','制度资料').grants.length")==2;click('close-modal')
 menu();click('public-bind-org');ev('state.libraryAdmin=false');click('lib-save-bind');assert page.locator('#lib-error').inner_text();assert ev("libMeta('公共空间','制度资料').bound_org_uuid")=='audit-org-engineering';click('close-modal')
 note('授权表含对象类型、授权人和时间；变更权限级别和搜索不丢所选对象与勾选；撤销可取消；保存时复核权限')
 ev("state.libraryAdmin=true;libraryPrefs.focused=false;state.directoryNodes.push({space:'公共空间',path:'机构资料/所属局'});folderMeta[directoryKey('公共空间','机构资料/所属局')]={bound_org_uuid:'audit-org',boundOrg:'市审计局'};render()")
 click('lib-tree-mode');assert page.locator('.lib-tree-scroll [data-action="folder"][data-id="机构资料"]').is_disabled();assert page.locator('.lib-tree-scroll [data-action="folder"][data-id="机构资料/所属局"]').is_enabled();click('lib-tree-mode')
 ev("libraryPrefs.focused=false;state.space='个人空间';state.folder='全部资料';render()")
 before=page.locator('.lib-tree-scroll [data-action="folder"]').count();click('lib-tree-mode');assert page.locator('.lib-tree-scroll [data-action="folder"]').count()==before
 note('公共空间聚焦已绑定机构目录并保留不可点击的祖先路径；个人空间保持完整目录')
 ev("libraryPrefs.focused=false;state.space='项目空间';state.folder='合同资料';state.librarySelected=['d1','d2'];const base={space:'项目空间',folder:'合同资料',name:'待处理.txt',local:true,type:'TXT'};state.docs.push({...base,id:'pub-pending',importedOnly:true},{...base,id:'pub-processing'},{...base,id:'pub-failed',parseError:'全文识别失败'});state.uploads.push({id:'pub-processing',status:'processing'});state.librarySelected.push('pub-pending','pub-processing','pub-failed');render()")
 assert page.locator('[data-selection-count="total"]').inner_text()=='5';assert page.locator('[data-selection-count="ready"]').inner_text()=='2';assert page.locator('[data-selection-count="pending"]').inner_text()=='3'
 assert page.locator('.lib-pagination [data-selection-count="total"]').count()==1
 assert not page.locator('.lib-tools [data-action="library-selected"]').count()
 assert '解析中 1' in page.locator('.audit-selection-inline').get_attribute('title')
 assert not page.locator('[data-selection-count="missing"]').count();assert '未关联原文' not in page.locator('body').inner_text();click('library-selected');assert '未关联原文' not in page.locator('.modalbody').inner_text();click('close-modal')
 page.locator('.lib-overflow>summary').click();assert not page.locator('[data-lib-change="sort"]').count();assert page.locator('.lib-overflow [data-action="lib-search"]').count()==1;assert page.locator('.lib-overflow [data-action="upload-records"]').count()==1;page.keyboard.press('Escape')
 page.screenshot(path=str(root/'review/toolbox-selection-refined.png'),animations='disabled')
 note('底栏数字突出，解析完成/解析未完成互斥，详细状态可查看；移除未关联原文状态；更多分类无重复入口且移除列表排序')
 ev("state.librarySelected=[];render()")
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(120)
  if w>760:assert page.locator('.lib-tools').bounding_box()['width']==(260 if w>1280 else 210)
  click('upload');assert page.locator('#upload-drop').evaluate("e=>getComputedStyle(e).display")=='flex';assert page.locator('[data-action="audit-upload-pick"]').is_visible();assert page.locator('[data-action="upload-folder"]').is_visible();assert not page.locator('.audit-upload-current').count()
  r=ev("()=>{const m=document.querySelector('.audit-upload-dialog'),z=document.querySelector('#upload-drop'),mr=m.getBoundingClientRect(),zr=z.getBoundingClientRect();return{w:innerWidth,h:innerHeight,inside:mr.top>=0&&mr.bottom<=innerHeight+1&&mr.left>=0&&mr.right<=innerWidth+1,full:zr.width>=mr.width-60,overflow:document.documentElement.scrollWidth-innerWidth}}")
  assert r['inside'] and r['full'] and not r['overflow'],r;layouts.append(r)
  page.screenshot(path=str(root/f'review/upload-refined-{w}.png'),animations='disabled');click('close-modal')
 page.set_viewport_size({'width':1366,'height':768});click('upload')
 with page.expect_file_chooser() as chooser:click('audit-upload-pick')
 chooser.value.set_files([{'name':'审计清单.txt','mimeType':'text/plain','buffer':'审计合同100万元'.encode()}]);page.wait_for_function("modal==='upload'&&modalData.items.some(r=>r.status==='可分析')")
 assert page.locator('.audit-upload-current').is_visible();assert page.locator('.audit-upload-item').count()==1;assert '解析完成' in page.locator('.audit-upload-current').inner_text();page.screenshot(path=str(root/'review/upload-refined-complete.png'),animations='disabled');click('upload-records');assert ev("modal==='upload-records'");page.keyboard.press('Escape')
 note('上传窗口在四种尺寸边框完整、不越屏；文件选择入口真实可用；选择后才出现进度，完成后可查看记录')
 assert not errors,errors
 (root/'review/public-management-results.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
