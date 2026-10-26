import json,pathlib,tempfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 folder=pathlib.Path(tmp)/'审计资料';(folder/'合同'/'附件').mkdir(parents=True);(folder/'会议').mkdir()
 payload={'说明.txt':'审计收集资料清单','合同/同名.txt':'合同金额100万元','合同/附件/验收.txt':'项目验收记录','会议/同名.txt':'会议决议','归档.zip':'压缩文件','脚本.exe':'程序','过程.log':'日志','Thumbs.db':'系统缩略图','.DS_Store':'系统元数据','无后缀':'无后缀审计资料'}
 for name,content in payload.items():(folder/name).write_text(content)
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},accept_downloads=True);page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)))
 def ev(s):return page.evaluate(s)
 def click(a):page.locator('[data-action="'+a+'"]:visible').last.click()
 def record(s):checks.append(s);print(len(checks),s,flush=True)
 def fresh():
  page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');ev('localStorage.clear()');page.reload(wait_until='networkidle');ev("state.view='library';state.space='个人空间';state.folder='全部资料';render();window.showDirectoryPicker=undefined")
 def pick():
  if not page.locator('#folder-input').count():click('upload')
  with page.expect_file_chooser() as chooser:click('upload-folder')
  assert chooser.value.is_multiple();chooser.value.set_files(str(folder))
 fresh()
 assert not page.locator('.audit-upload-menu').count()
 click('upload')
 with page.expect_file_chooser() as chooser:click('upload-folder')
 chooser.value.set_files(str(folder));assert ev("modal==='lib-upload-types'")
 assert ev('modalData.files.length')==10
 assert ev("modalData.selected.includes('txt')&&!modalData.selected.includes('zip')&&!modalData.selected.includes('exe')&&!modalData.selected.includes('log')&&!modalData.selected.includes('__system__')")
 assert not ev("directoryPaths(state.space).includes('审计资料')")
 record('统一上传入口的弹窗可选择文件夹；按类型筛选，压缩/执行/临时/系统文件默认不选，确认前无资料写入')
 click('lib-upload-types-next');page.wait_for_function("state.uploads.filter(u=>!u.statusCatalog).length===5&&state.uploads.filter(u=>!u.statusCatalog).every(u=>['可分析','解析失败'].includes(u.status))")
 docs=ev("state.docs.filter(d=>d.folder.startsWith('审计资料')).map(d=>({id:d.id,name:d.name,folder:d.folder,text:d.text}))")
 assert len(docs)==5;assert {d['folder'] for d in docs}=={'审计资料','审计资料/合同','审计资料/合同/附件','审计资料/会议'}
 assert len([d for d in docs if d['name']=='同名.txt'])==2
 uid=next(d['id'] for d in docs if d['folder']=='审计资料/合同');assert '100' in ev("file('"+uid+"').text")
 record('多级目录完整保留；根层文件与子文件夹混排；不同子目录同名文件分别保存')
 page.screenshot(path=str(root/'review/folder-upload-complete.png'))
 click('close-modal');page.reload(wait_until='networkidle');assert '审计资料/合同/附件' in ev("directoryPaths('个人空间')")
 ev('window.showDirectoryPicker=undefined');pick();assert ev("modal==='audit-upload-merge'");click('close-modal');assert len(ev("state.docs.filter(d=>!d.deleted&&d.folder.startsWith('审计资料'))"))==5
 pick();click('audit-upload-merge-next');click('lib-upload-types-next');assert ev("modal==='lib-upload-conflicts'");assert len(ev('modalData.entries.filter(e=>e.oldId)'))==5
 click('lib-upload-conflicts-confirm');assert len(ev("state.docs.filter(d=>!d.deleted&&d.folder.startsWith('审计资料'))"))==5
 record('刷新后目录和原件保留；同名目录先提示合并；重名按完整路径检测；全部跳过不产生重复文件')
 (folder/'合同'/'同名.txt').write_text('合同更新为200万元')
 pick();click('audit-upload-merge-next');click('lib-upload-types-next')
 page.locator('[data-lib-change="conflict"]').filter().nth(next(i for i,e in enumerate(ev('modalData.entries.filter(e=>e.oldId||e.duplicate)')) if e['name']=='审计资料/合同/同名.txt')).select_option('replace')
 click('lib-upload-conflicts-confirm');page.wait_for_function("state.uploads[0].status==='可分析'");new=ev("state.docs.find(d=>!d.deleted&&d.name==='同名.txt'&&d.folder==='审计资料/合同')")
 assert new['id']!=uid and '200' in new['text'];assert ev("file('"+uid+"').deleted")
 click('close-modal');ev("state.folder='审计资料/合同';render()")
 with page.expect_download() as d:click('lib-download')
 assert pathlib.Path(d.value.path()).read_text()=='合同更新为200万元'
 record('可单独覆盖一个重名文件；原版本留给历史引用；下载为新版本真实字节')
 ev("state.folder='全部资料';render();folderMeta[directoryKey(state.space,'审计资料/合同')]={permission:'READ'}")
 pick();click('audit-upload-merge-next');click('lib-upload-types-next');assert ev("modal==='audit-upload-issues'");assert '权限' in page.locator('.modalbody').inner_text();click('close-modal')
 ev("delete folderMeta[directoryKey(state.space,'审计资料/合同')]")
 record('合并上传逐个子目录复核权限，不能绕过只读目录')
 pick();click('audit-upload-merge-next');click('audit-upload-preset') if False else None
 page.locator('[data-action="audit-upload-preset"][data-preset="none"]').click();assert '仅创建目录' in page.locator('.modalfoot').inner_text();click('lib-upload-types-next');assert ev('modal===null')
 record('类型全不选仍可按原流程仅创建目录结构')
 # Native directory API preserves empty branches. Real File objects pass through parsing and persistence.
 ev("""window.showDirectoryPicker=async()=>({kind:'directory',name:'空目录核验',async *values(){yield {kind:'directory',name:'空子目录',async *values(){}};yield {kind:'file',name:'清单.txt',async getFile(){return new File(['资料清单'],'清单.txt',{type:'text/plain'})}}}})""")
 click('upload');click('upload-folder');page.wait_for_function("modal==='lib-upload-types'");click('lib-upload-types-next');page.wait_for_function("state.uploads[0].status==='可分析'");assert '空目录核验/空子目录' in ev('directoryPaths(state.space)');click('close-modal');page.reload(wait_until='networkidle');assert '空目录核验/空子目录' in ev('directoryPaths(state.space)')
 record('目录选择API保留空子目录，刷新后仍存在')
 # Fallback picker can choose the same directory again; cancel never changes data.
 ev('window.showDirectoryPicker=undefined');pick();click('close-modal');pick();assert ev("modal==='audit-upload-merge'");click('close-modal')
 record('兼容目录选择器重复选择同一文件夹，取消不创建目录或上传文件')
 ev("state.space='公共空间';state.folder='全部资料';render()")
 assert page.locator('[data-action="upload"]').is_disabled();assert not page.locator('.audit-upload-menu').count()
 record('只读空间的文件上传和文件夹上传遵守同一权限')
 fresh();ev("state.docs.push({id:'folder-name-collision',space:state.space,folder:'根目录',name:'审计资料',type:'TXT',size:'1 KB'});render()")
 pick();click('lib-upload-types-next');assert ev("modal==='audit-upload-issues'");assert '同名文件' in page.locator('.modalbody').inner_text();assert not ev("directoryPaths(state.space).includes('审计资料')");click('close-modal')
 ev("state.docs=state.docs.filter(d=>d.id!=='folder-name-collision');state.directoryNodes.push({space:state.space,path:'同名.txt'});render()")
 click('upload');page.locator('#upload-input').set_input_files({'name':'同名.txt','mimeType':'text/plain','buffer':b'1'});assert ev("modal==='audit-upload-issues'");assert '同名文件夹' in page.locator('.modalbody').inner_text();click('close-modal')
 record('文件/文件夹名称相撞时明确阻止，不覆盖目录')
 click('upload');ev("uploadFiles([{name:'超限.txt',size:100*1024*1024+1}])");assert ev("modal==='audit-upload-issues'");assert '100MB' in page.locator('.modalbody').inner_text();click('close-modal')
 record('单文件上限与原代码一致为100MB，超限在入库前提示')
 fresh();ev("nav('tool','extract')")
 click('add-tool-materials');page.locator('[data-change="picker-space"]').select_option('个人空间');click('audit-picker-upload');pick();assert ev("modal==='lib-upload-types'");click('close-modal');assert ev("modal==='picker'")
 record('工具内添加资料仍可进入文件夹上传流程')
 fresh();page.screenshot(path=str(root/'review/folder-upload-entry.png'));assert not page.locator('.audit-upload-menu').count()
 for width,height in [(1366,768),(1024,600),(390,844)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100);assert ev('document.documentElement.scrollWidth<=innerWidth');assert not page.locator('.lib-commandbar').count();assert not page.locator('.lib-path-row').count();assert page.locator('.lib-toolbar').bounding_box()['height']<=60
 assert not errors,errors
 record('上传主操作保持单行，低分辨率无页面横向溢出，仅保留一个上传入口')
 (root/'review/folder-upload-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));b.close()
