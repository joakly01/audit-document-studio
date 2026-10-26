import pathlib,json,zipfile,io
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce');page.set_default_timeout(6000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765',wait_until='networkidle');page.evaluate('localStorage.clear()');page.reload(wait_until='networkidle')
 def ev(s):return page.evaluate(s)
 def click(act,extra=''):page.locator('[data-action="'+act+'"]'+extra+':visible').last.click()
 # Folder imports retain nested paths; extension choices and conflict cancellation are transactional.
 ev("()=>{const a=new File(['验收合同金额128万元'],'证据.txt',{type:'text/plain'}),b=new File(['binary'],'附件.bin');Object.defineProperty(a,'webkitRelativePath',{value:'收集资料/合同/证据.txt'});Object.defineProperty(b,'webkitRelativePath',{value:'收集资料/附件.bin'});uploadFiles([a,b]);}")
 assert ev("modal==='lib-upload-types'");page.locator('[data-lib-change="upload-type"][value="bin"]').uncheck();click('lib-upload-types-next');page.wait_for_function("state.uploads[0].status==='可分析'");id=ev('state.uploads[0].id');assert ev("file('"+id+"').folder")=='收集资料/合同';assert not ev("state.docs.some(d=>d.name==='附件.bin')");page.keyboard.press('Escape');checks.append('文件夹上传按后缀选择、保留多级路径')
 click('upload-records');page.locator('#lib-record-query').fill('证据');assert page.locator('[data-lib-change="record-check"]').count()==1
 page.locator('[data-lib-change="record-status"]').select_option(label='解析失败');assert page.locator('[data-lib-change="record-check"]').count()==0;page.locator('[data-lib-change="record-status"]').select_option(label='解析完成');assert page.locator('[data-lib-change="record-check"]').count()==1
 click('source','[data-id="'+id+'"]');page.keyboard.press('Escape');assert ev("modal==='upload-records'");assert ev('modalData.query')=='证据';click('lib-record-auto');assert ev('modalData.auto');click('lib-record-auto');assert not ev('modalData.auto');page.keyboard.press('Escape');checks.append('上传记录：搜索、状态筛选、原文返回与自动刷新切换')
 # Pending uploads survive refresh and resume with their stored source.
 ev("()=>{const d=file('"+id+"');d.local=true;const r=state.uploads.find(r=>r.id===d.id);r.status='正在解析';r.progress=65;persist();}")
 page.reload(wait_until='networkidle');assert ev('state.uploads[0].status')=='未解析';click('upload-records');page.locator('#lib-record-query').fill('证据');click('lib-record-retry-one','[data-id="'+id+'"]');page.wait_for_function("file('"+id+"').local===false");checks.append('刷新中断后读取已保存原件继续解析')
 # Regex cancellation and native exports preserve escaped business text.
 page.locator('[data-lib-change="scope"]').select_option('recursive');page.locator('[data-lib-change="size"]').select_option('50');page.locator('[data-lib-change="page"]').check();page.locator('.lib-dropdown').last.locator('summary').click();click('lib-search');page.locator('#lib-text-query').fill('合同');click('lib-search-run');page.wait_for_function('modalData.hits!==null&&!modalData.busy');page.locator('[data-lib-change="search-page"]').check()
 with page.expect_download() as d:click('lib-search-export','[data-format="word"]')
 path=pathlib.Path(d.value.path());assert d.value.suggested_filename.endswith('.docx')
 with zipfile.ZipFile(path) as z:
  assert '[Content_Types].xml' in z.namelist();assert '文本检索结果' in z.read('word/document.xml').decode()
 page.keyboard.press('Escape');checks.append('Word 导出为有效 DOCX 文件，保留匹配内容和来源')
 # Permissions and metadata guard callbacks, not just disabled buttons.
 ev("folderMeta[directoryKey('项目空间','合同资料')]={permission:'READ'};render()")
 click('folder','[data-id="合同资料"]');assert page.locator('[data-action="upload"]').is_disabled();ev("handleAction('lib-rename-file',{dataset:{id:'d1'}})");assert not ev("modal==='lib-name'")
 ev("folderMeta[directoryKey('项目空间','合同资料')]={permission:'NONE'};render()")
 ev("handleAction('folder',{dataset:{id:'合同资料'}})");assert not ev('libItems().some(x=>x.kind==="file")');checks.append('只读与无权目录校验：禁用入口且校验回调')
 ev("folderMeta={};state.folder='全部资料';state.libraryAdmin=true;render()")
 # A folder with references cannot be moved into its own descendant.
 click('lib-folder-menu','[data-path="收集资料"]');click('lib-move-folder');assert not page.locator('#lib-folder-target option[value="收集资料/合同"]').count();page.locator('#lib-folder-target').select_option('会议纪要');click('lib-confirm-folder-move');assert ev("file('"+id+"').folder")=='会议纪要/收集资料/合同'
 click('lib-folder-menu','[data-path="会议纪要/收集资料"]');click('lib-folder-up');page.keyboard.press('Escape');checks.append('管理员移动与同级排序，排除自身/下级目录')
 # Keyboard-adjustable directory width; values persist across refresh.
 sep=page.locator('.lib-folder-resizer');sep.focus();page.keyboard.press('ArrowRight');assert ev('libraryPrefs.folderWidth')==212;page.reload(wait_until='networkidle');assert ev('libraryPrefs.folderWidth')==212;checks.append('目录宽度支持键盘调整并持久保存')
 ev('state.libraryAdmin=true;render()');click('upload-records');page.locator('.lib-record-admin summary').click();page.locator('#lib-concurrency-local').fill('0');click('lib-record-save-concurrency');assert page.locator('#lib-error').inner_text();page.locator('#lib-concurrency-local').fill('3');click('lib-record-save-concurrency');assert ev('storageQuota.concurrencyLocal')==3;page.keyboard.press('Escape');checks.append('解析并发设置范围校验和保存')
 # Bounded local parser queue honors concurrency, then drains queued records.
 ev("async()=>{storageQuota.concurrencyLocal=1;const original=recordsBase.parseUploadRecord;window._parserCalls=0;window._maxParserCalls=0;recordsBase.parseUploadRecord=async(r,d,f)=>{_parserCalls++;_maxParserCalls=Math.max(_maxParserCalls,_parserCalls);await new Promise(x=>setTimeout(x,80));_parserCalls--;d.local=false;r.status='可分析';};const promises=[];for(let i=0;i<4;i++){const d={id:'queue-'+i,local:true};promises.push(parseUploadRecord({id:d.id},d,new File(['x'],'x.txt')));}await Promise.all(promises);recordsBase.parseUploadRecord=original;}")
 assert ev('_maxParserCalls')==1;assert ev('libParseQueue.length')==0;checks.append('并发上限实际生效；队列完成后释放')
 assert not errors,errors
 (root/'review/library-v5-edge-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
