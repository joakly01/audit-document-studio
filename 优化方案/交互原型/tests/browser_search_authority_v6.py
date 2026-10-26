import json,pathlib,zipfile,io
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True);page.set_default_timeout(7000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765',wait_until='networkidle');page.evaluate('localStorage.clear()');page.reload(wait_until='networkidle')
 def ev(code):return page.evaluate(code)
 def click(action,extra=''):
  selector='[data-action="'+action+'"]'+extra
  if not page.locator(selector+':visible').count():
   parent=page.locator('.lib-toolbar details').filter(has=page.locator(selector)).last
   if parent.count():parent.locator('summary').click()
  page.locator(selector+':visible').last.click()
 def note(text):checks.append(text);print(text,flush=True)
 # Source-backed folder policy matrix.
 result=ev("""()=>{const out={};function set(space,path,meta){folderMeta[directoryKey(space,path)]=meta;return auditFolderAccess(space,path);}out.project=auditFolderAccess('项目空间','');out.personal=set('个人空间','个人目录',{permission:'FULL',is_creator:true});out.publicManager=set('公共空间','授权目录',{permission:'FULL',can_delegate:false,is_creator:false,is_granted_to_user:true});out.publicDelegate=set('公共空间','分权目录',{permission:'FULL',can_delegate:true,is_creator:false,is_granted_to_user:true});out.publicOwner=set('公共空间','本人目录',{permission:'FULL',can_delegate:false,is_creator:true});out.none=set('公共空间','无权限目录',{permission:'NONE'});out.year=set('项目空间','2026',{permission:'FULL',node_type:'YEAR'});out.unit=set('项目空间','2026/被审计单位',{permission:'FULL',node_type:'UNIT'});out.group=set('项目空间','小组',{permission:'FULL',node_type:'GROUP',user_permissions:['DOWNLOAD','IMPORT_FOLDER','UPLOAD']});out.reference=set('项目空间','引用目录',{permission:'READ',reference:{space:'公共空间',path:'制度资料'},user_permissions:['DOWNLOAD','REMOVE_REF_FOLDER']});out.ossParent=set('公共空间','归档',{permission:'READ',source:'OSS'});out.ossChild=set('公共空间','归档/下级',{permission:'FULL',is_creator:true});return out;}""")
 assert result['project']['create'] and result['project']['import'] and not result['project']['upload'] and not result['project']['grant']
 assert result['personal']['create'] and not result['personal']['grant']
 assert not result['publicManager']['grant'] and not result['publicManager']['delete'] and not result['publicManager']['rename']
 assert result['publicDelegate']['grant'] and not result['publicDelegate']['delete']
 assert result['publicOwner']['rename'] and result['publicOwner']['delete'] and result['publicOwner']['bindProject'] and not result['publicOwner']['bindOrg']
 assert not result['none']['read'];assert not result['year']['create'] and not result['unit']['upload']
 assert result['group']['create'] and result['group']['import'] and not result['group']['upload'] and not result['group']['rename']
 assert result['reference']['removeReference'] and not result['reference']['upload'] and not result['reference']['grant']
 assert not result['ossChild']['upload'] and not result['ossChild']['rename']
 note('权限矩阵：个人/公共/项目、年度/单位/小组、管理与分权、引用/OSS祖先规则')
 ev("""()=>{folderMeta={};state.space='项目空间';state.folder='合同资料';const defaults={space:'项目空间',folder:'合同资料',type:'PDF',date:'2026-10-18',size:'2 KB',local:false};state.docs.push({...defaults,id:'s1',name:'验收付款合同.pdf',text:'开头\\n验收付款\\n'+('应核对合同与凭证。\\n'.repeat(240))+'验收付款\\n第三次验收。<img src=x onerror=alert(1)>'},{...defaults,id:'s2',name:'工程付款记录.docx',type:'DOCX',text:'工程付款合同。付款金额128万元。'},{...defaults,id:'s3',name:'待解析合同.pdf',text:'',local:true});state.librarySelected=['s1','s2','s3'];render();} """)
 # Text search has a single visible entry; bulk actions follow selection.
 assert not page.locator('.lib-toolbar>[data-action="lib-search"]').count()
 assert page.locator('.lib-toolbar [data-action="lib-search"]').count()==1;assert page.locator('.lib-overflow-panel [data-action="lib-search"]').count()==1;assert page.locator('.lib-toolbar summary').filter(has_text='更多').count()==1
 click('lib-search');assert ev('modalData.ids')==['s1','s2','s3'];assert '1 份资料尚未完成解析' in page.locator('.modalbody').inner_text()
 page.locator('#lib-text-query').fill('验收');click('lib-search-run');page.wait_for_function('modalData.hits!==null&&!modalData.busy')
 assert ev('modalData.hits[0].count')==3 and ev('modalData.hits.length')==1
 assert page.locator('.v6-source-scroll mark.current').inner_text()=='验收'
 click('v6-match-next');assert ev('modalData.matchIndex')==1
 page.locator('[data-v6-change="view-mode"]').select_option('full');assert page.locator('.v6-source-scroll mark').count()==3;assert page.locator('.v6-source-scroll img').count()==0
 click('v6-match-next');click('v6-match-next');assert ev('modalData.matchIndex')==0
 click('source','[data-id="s1"]');page.keyboard.press('Escape');assert ev("modal==='lib-search'")
 page.screenshot(path=str(root/'review/v6-search-matches.png'),animations='disabled')
 note('文本检索单一可见入口、独立范围、待解析提示、多处命中、上下文与全文高亮、安全原文返回')
 # Picker cancel is a transactional return to search, including the results and selection.
 page.locator('[data-v6-change="search-all"]').check();before=ev('JSON.stringify({ids:modalData.ids,hits:modalData.hits,selected:modalData.selected})')
 click('lib-search-pick');assert ev("modal==='picker'");page.keyboard.press('Escape');assert ev("modal==='lib-search'");assert before==ev('JSON.stringify({ids:modalData.ids,hits:modalData.hits,selected:modalData.selected})')
 note('检索资料选择器取消返回，保持原范围、结果与勾选')
 # Export must include complete document contents, not just a matching snippet.
 with page.expect_download() as d:click('lib-search-export','[data-format="xlsx"]')
 xbytes=list(pathlib.Path(d.value.path()).read_bytes());sheet=page.evaluate('(bytes)=>{const wb=XLSX.read(new Uint8Array(bytes),{type:"array"});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});}',xbytes)
 assert '第三次验收' in sheet[1][-1] and len(sheet[1][-1])>2000
 with page.expect_download() as d:click('lib-search-export','[data-format="word"]')
 assert d.value.suggested_filename.endswith('.zip')
 with zipfile.ZipFile(d.value.path()) as z:
  docs=[n for n in z.namelist() if n.endswith('.docx')];assert len(docs)==1
  with zipfile.ZipFile(io.BytesIO(z.read(docs[0]))) as word:assert '第三次验收' in word.read('word/document.xml').decode()
 note('Excel完整正文、Word逐文件DOCX打包，保留资料路径，不仅导出命中摘要')
 # Only marked search result enters the tool; main selection remains unchanged.
 original=ev('state.librarySelected');page.locator('[data-v6-change="search-tool"]').select_option('extract');assert ev('ws().ids')==['s1'];assert ev('state.librarySelected')==original;assert page.locator('[data-action="add-tool-materials"]').is_visible()
 note('检索结果带入分析仅使用勾选文件，不夹带主列表其他已选资料')
 click('nav-library');click('lib-search');click('lib-search-clear');assert ev('modalData.ids')==original and ev('modalData.hits') is None
 page.locator('[data-v6-change="regex"]').check();page.locator('#lib-text-query').fill('付款|验收');click('lib-search-run');page.wait_for_function('modalData.hits!==null&&!modalData.busy');assert ev('modalData.hits.length')==2
 page.locator('#lib-text-query').fill('[');assert page.locator('.v6-keyword-notice').is_visible();click('lib-search-run');page.wait_for_function('!modalData.busy');assert '正则表达式无效' in page.locator('#lib-error').inner_text()
 page.locator('#lib-text-query').fill('不存在的关键字');click('lib-search-run');page.wait_for_function('!modalData.busy');assert ev('modalData.hits')==[] and ev('modalData.ids')==original
 click('lib-search-clear');assert ev('modalData.ids')==original;click('v6-search-clear-scope');assert ev('modalData.ids')==[] and ev('state.librarySelected')==original;page.keyboard.press('Escape')
 note('正则、无效表达式、零匹配、修改检索词提示、清空检索/清空资料分别处理')
 # Public management is not delegation. Project and personal scopes do not expose grants.
 ev("state.space='项目空间';state.folder='合同资料';render()");click('lib-folder-menu','[data-path="合同资料"]');assert not page.locator('[data-action="lib-permissions"]:visible').count();click('v6-access');assert '权限由审计项目角色确定' in page.locator('.modalbody').inner_text();ev("handleAction('lib-permissions',{dataset:{}})");assert ev("modal==='v6-access'");page.keyboard.press('Escape')
 ev("state.space='公共空间';state.folder='制度资料';folderMeta[directoryKey('公共空间','制度资料')]={permission:'FULL',is_creator:false,is_granted_to_user:true,can_delegate:true};render()");click('v6-access');click('lib-permissions');page.locator('#v6-grantee').select_option('audit-user-lm');page.locator('#lib-grant-level').select_option('MANAGE');page.locator('#v6-grantee').select_option('audit-user-lm');page.locator('#lib-grant-delegate').check();click('lib-save-grant')
 g=ev("libMeta('公共空间','制度资料').grants[0]");assert g['grantee_id']=='audit-user-lm' and g['can_delegate'] and not g['include_org_descendants']
 page.locator('#lib-grant-type').select_option('ORG');page.locator('#v6-grantee').select_option('audit-org-engineering');page.locator('#lib-grant-descendants').check();click('lib-save-grant');assert ev("libMeta('公共空间','制度资料').grants[1].include_org_descendants")
 page.screenshot(path=str(root/'review/v6-public-delegation.png'),animations='disabled')
 click('lib-revoke','[data-index="0"]');page.keyboard.press('Escape');assert ev("libMeta('公共空间','制度资料').grants.length")==2
 # Revoking delegation while dialog is open blocks save callbacks.
 ev("folderMeta[directoryKey('公共空间','制度资料')].can_delegate=false;handleAction('lib-save-grant',{dataset:{}})");assert ev("libMeta('公共空间','制度资料').grants.length")==2;page.keyboard.press('Escape')
 note('公共空间独立分权入口、授权对象ID选择、管理可分权、机构后代范围、撤销确认及权限重查')
 # Ownership versus ordinary manager: no other-user rename/delete, OSS always immutable.
 r=ev("""()=>{folderMeta[directoryKey('公共空间','制度资料')]={permission:'FULL',is_creator:false,is_granted_to_user:true,can_delegate:false};const base={id:'x',space:'公共空间',folder:'制度资料',type:'PDF',local:false};return{other:auditFileAccess({...base,uploader_id:'someone-else'}),mine:auditFileAccess({...base,uploader_id:'current-user'}),oss:auditFileAccess({...base,uploader_id:'current-user',is_oss:true})};}""")
 assert not r['other']['rename'] and not r['other']['delete'];assert r['mine']['rename'] and r['mine']['delete'];assert not r['oss']['rename'] and not r['oss']['delete']
 ev("folderMeta[directoryKey('项目空间','合同资料')]={permission:'NONE'};state.space='项目空间';state.folder='合同资料';render();handleAction('source',{dataset:{id:'s1'}})");assert not ev("modal==='source'")
 click('lib-search');assert ev('modalData.ids')==[];page.keyboard.press('Escape')
 note('文件所有人例外、普通管理者不越权修改他人文件、OSS不可修改、无权文件不能预览或检索')
 # Recheck read/download at export, not only when selecting.
 ev("folderMeta={};state.space='项目空间';state.folder='合同资料';state.librarySelected=['s1'];render()");click('lib-search');page.locator('[data-v6-change="search-all"]').check();ev("file('s1').can_download=false;libSearchExport('xlsx')");assert '无下载权限' in page.locator('#lib-error').inner_text();page.keyboard.press('Escape')
 note('导出时再次检查下载权限')
 # Layouts: dense desktop, compact narrow screen, usable mobile search.
 ev("clearTimeout(toastTimer);document.getElementById('toast').classList.remove('show')")
 for width,height in [(1440,900),(1366,768),(1024,600),(390,844)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(80);assert ev('document.documentElement.scrollWidth<=innerWidth');click('lib-search');page.locator('#lib-text-query').fill('验收');click('lib-search-run');page.wait_for_function('!modalData.busy');page.screenshot(path=str(root/f'review/v6-search-{width}.png'),full_page=True,animations='disabled');assert page.locator('#lib-text-query').is_visible();page.keyboard.press('Escape')
 note('1440/1366/1024/390下资料管理与文本检索无整页横向溢出')
 assert not errors,errors
 (root/'review/v6-search-authority-results.json').write_text(json.dumps({'checks':checks,'browser_errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'passed':len(checks),'errors':errors},ensure_ascii=False));b.close()
