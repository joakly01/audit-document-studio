import pathlib,json,re,zipfile,io
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];source=(root.parents[1]/'前端代码/views/file-manager-code/Index.vue').read_text();checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True);page.set_default_timeout(6000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765',wait_until='networkidle')
 def ev(code):return page.evaluate(code)
 def click(act,extra=''):page.locator('[data-action="'+act+'"]'+extra+':visible').last.click()
 names=['isProjectSpaceFixedNode','isOssFolder','showNoPermissionAssignIcon','canCreateFolder','canRenameFolder','canDeleteFolder','canManagePermission','canBindProject','canBindOrg','canImportFolder','canRemoveRefFolder','canViewProjectGroups']
 functions=[]
 for name in names:
  start=source.index('const '+name+' = ');end=source.index('\n}\n',start)+2;functions.append(source[start:end])
 script='()=>{const isSuperFileAdmin=()=>state.libraryAdmin===true;'+ '\n'.join(functions)+'\nreturn {canCreateFolder,canRenameFolder,canDeleteFolder,canManagePermission,canBindProject,canBindOrg,canImportFolder,canRemoveRefFolder,canViewProjectGroups};}'
 ev('window.originalPolicy=('+script+')()')
 result=ev("""()=>{const cases=[];for(const space of ['个人空间','公共空间','项目空间'])for(const admin of [false,true])for(const permission of ['NONE','READ','FULL'])for(const creator of [false,true]){const code=AUDIT_SPACE_CODES[space],path='权限校对';const meta={permission,is_creator:creator,is_super_admin:admin,is_granted_to_user:!creator,can_delegate:!creator,folder_type:code,node_type:'FOLDER',user_permissions:code==='PROJECT'?['DOWNLOAD','MANAGE_PROJECT','IMPORT_FOLDER','REMOVE_REF_FOLDER']:[]};folderMeta[directoryKey(space,path)]=meta;state.libraryAdmin=admin;const actual=auditFolderAccess(space,path),pairs={create:'canCreateFolder',rename:'canRenameFolder',delete:'canDeleteFolder',grant:'canManagePermission',bindProject:'canBindProject',bindOrg:'canBindOrg',import:'canImportFolder',removeReference:'canRemoveRefFolder',groups:'canViewProjectGroups'};for(const [key,fn] of Object.entries(pairs)){if(!['READ','FULL'].includes(permission))continue;if(key==='bindProject'&&space!=='公共空间')continue;const expected=originalPolicy[fn](meta);if(actual[key]!==expected)cases.push({space,admin,permission,creator,key,expected,actual:actual[key]});}}state.libraryAdmin=false;folderMeta={};return cases;}""")
 assert not result,result
 checks.append('将原源码权限函数直接载入，对比个人/公共/项目空间的角色、查看/管理、创建者/受授权者组合')
 ev("()=>{state.space='项目空间';state.folder='合同资料';const base={space:'项目空间',folder:'合同资料',type:'PDF',date:'2026-10-18',size:'1 KB'};state.docs.push({...base,id:'unicode-case',name:'命中校验.pdf',text:'验收验收\\nAudit AUDIT audit'},{...base,id:'long-doc',name:'长正文.pdf',text:'验收'+('正文'.repeat(18000))+'正文结尾'},{...base,id:'regex-slow',name:'长文本.pdf',text:'a'.repeat(24000)+'!'});state.librarySelected=['unicode-case'];render();}")
 click('lib-search');page.locator('[data-v6-change="regex"]').check();page.locator('#lib-text-query').fill('(?=验收)');click('lib-search-run');page.wait_for_function('!modalData.busy');assert ev('modalData.hits[0].count')==2;assert page.locator('.v6-source-scroll mark').count()==2
 page.locator('#lib-text-query').fill('audit');click('lib-search-run');page.wait_for_function('!modalData.busy');assert ev('modalData.hits[0].count')==3
 page.locator('[data-v6-change="case"]').check();click('lib-search-run');page.wait_for_function('!modalData.busy');assert ev('modalData.hits[0].count')==1
 checks.append('零宽正则不死循环，大小写选项生效')
 page.keyboard.press('Escape');ev("state.librarySelected=['regex-slow'];render()");click('lib-search');page.locator('[data-v6-change="regex"]').check();page.locator('#lib-text-query').fill('(a+)+$');click('lib-search-run');page.wait_for_function('!modalData.busy',timeout=7000);assert '耗时过长' in page.locator('#lib-error').inner_text();assert page.locator('#lib-text-query').is_enabled()
 click('lib-search-run');click('v6-search-stop');assert not ev('modalData.busy');assert '取消' in page.locator('#lib-error').inner_text();page.keyboard.press('Escape');checks.append('耗时正则在独立线程超时退出，可主动取消，页面保持响应')
 ev("state.librarySelected=['long-doc','unicode-case'];render()");click('lib-search');page.locator('[data-v6-change="search-all"]').check()
 with page.expect_download() as d:click('lib-search-export','[data-format="xlsx"]')
 rows=page.evaluate('(bytes)=>{const wb=XLSX.read(new Uint8Array(bytes),{type:"array"});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});}',list(pathlib.Path(d.value.path()).read_bytes()))
 assert len([r for r in rows[1:] if r[1]=='长正文.pdf'])==2
 assert ''.join(r[-1] for r in rows[1:] if r[1]=='长正文.pdf')==ev("file('long-doc').text")
 with page.expect_download() as d:click('lib-search-export','[data-format="word"]')
 with zipfile.ZipFile(d.value.path()) as z:
  docs=[n for n in z.namelist() if n.endswith('.docx')];assert len(docs)==2
  for name in docs:
   with zipfile.ZipFile(io.BytesIO(z.read(name))) as docx:assert 'word/document.xml' in docx.namelist()
 page.keyboard.press('Escape');checks.append('超过Excel单元格上限的正文分段保存不截断，多文件Word逐份导出有效DOCX')
 # Restricted viewer can select/read/analyze, but cannot mutate referenced files; cancellation leaves source intact.
 ev("state.libraryAdmin=false;state.space='项目空间';state.folder='全部资料';render()");click('lib-folder-menu','[data-path=""]');click('lib-import-folder');click('lib-confirm-import');ref=ev('state.folder');assert not ev('auditFolderAccess().upload') and ev('auditFolderAccess().removeReference');assert page.locator('[data-action="upload"]').is_disabled();click('lib-folder-menu','[data-path="'+ref+'"]');click('lib-remove-reference');click('lib-confirm-remove-reference');assert not ev("file('d14').deleted")
 checks.append('项目节点可引入但不能上传，引用目录只读，取消引入不删除源资料')
 # File owner on READ directory remains an explicit original-code exception; regular managers cannot rename other files.
 r=ev("""()=>{folderMeta[directoryKey('公共空间','所有者目录')]={permission:'READ',is_creator:false};return auditFileAccess({id:'mine',space:'公共空间',folder:'所有者目录',uploader_id:'current-user',local:false});}""")
 assert r['rename'] and r['delete'] and not r['attachments'];checks.append('保留原代码的上传者文件操作例外，同时附件写入不随文件所有权放宽')
 assert not errors,errors
 (root/'review/v6-authority-edge-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
