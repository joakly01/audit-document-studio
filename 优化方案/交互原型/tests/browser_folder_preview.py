import json,pathlib,tempfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True);page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');page.evaluate('localStorage.clear()');page.reload(wait_until='networkidle');page.evaluate('libraryStatusDataReady')
 def ev(s,arg=None):return page.evaluate(s,arg)
 def click(a):page.locator('[data-action="'+a+'"]:visible').last.click()
 def note(s):checks.append(s);print(s,flush=True)
 def source(fid,kind):
  ev("id=>handleAction('source',{dataset:{id}})",fid);page.wait_for_selector('#preview-raw-content[data-raw-ready="'+kind+'"]');assert page.locator('.file-preview-pane').count()==2
 assert not page.locator('.topbar').count();assert page.locator('.audit-location-label').inner_text()=='当前目录'
 ev("state.librarySelected=['d1'];render()")
 assert not page.locator('.lib-files [data-action="nav-tasks"]').count()
 assert not page.locator('.audit-current-path [data-icon="lock"]').count()
 page.locator('.sidebar [data-action="nav-tasks"]').click();assert ev("state.view==='tasks'");ev("nav('library')");assert ev('state.librarySelected')==['d1']
 page.set_viewport_size({'width':1024,'height':480});page.locator('.lib-overflow>summary').click();assert not page.locator('.lib-overflow [data-action="nav-tasks"]').count();page.locator('.lib-overflow>summary').click()
 note('全局面包屑栏移除；当前目录保留且不显示锁；操作栏及更多不设任务中心，左侧导航可进入并保留选择')
 page.set_viewport_size({'width':1366,'height':768});folder=pathlib.Path(tmp)/'审计资料';(folder/'合同').mkdir(parents=True);(folder/'会议').mkdir()
 for i in range(56):(folder/('合同' if i%2 else '会议')/('材料'+str(i)+'.txt')).write_text('原件'+str(i))
 (folder/'合同'/'同名.txt').write_text('合同');(folder/'会议'/'同名.txt').write_text('会议');(folder/'归档.zip').write_bytes(b'zip')
 ev("state.space='个人空间';state.folder='全部资料';render();window.showDirectoryPicker=undefined")
 page.locator('.audit-upload-menu>summary').click()
 with page.expect_file_chooser() as chooser:click('audit-upload-folder')
 chooser.value.set_files(str(folder));assert page.locator('.folder-type-table th').all_text_contents()==['上传','文件类型','数量','大小','文件名称 / 相对路径'];assert '审计资料/' in page.locator('.folder-type-names').first.inner_text()
 selected=ev('modalData.selected');click('audit-folder-file-list');assert page.locator('.folder-file-list tbody tr').count()==50;click('preview-folder-next');assert page.locator('.folder-file-list tbody tr').count()==8
 page.locator('#folder-file-query').fill('同名');assert page.locator('.folder-file-list tbody tr').count()==2;assert '合同/同名.txt' in page.locator('.folder-file-list').inner_text() and '会议/同名.txt' in page.locator('.folder-file-list').inner_text()
 click('close-modal');assert ev('modalData.selected')==selected
 for w,h in [(1366,768),(1024,480)]:
  page.set_viewport_size({'width':w,'height':h});r=page.locator('.folder-types-dialog').bounding_box();assert r['y']>=0 and r['y']+r['height']<=h+1
 page.screenshot(path=str(root/'review/folder-file-names.png'),animations='disabled');click('close-modal');note('文件夹按类型列出文件名和相对路径，完整清单可搜索/翻页，同名不同目录可区分，返回保留筛选')
 page.set_viewport_size({'width':1366,'height':768});source('d1','pdf');assert page.locator('canvas').evaluate('e=>e.width>0&&e.height>0');page.locator('[data-preview-change="pdf-zoom"]').select_option('1');page.wait_for_timeout(200);click('close-modal');assert ev('activeFilePreview===null')
 source('d3','docx');frame=page.frame_locator('.preview-docx-frame');assert '第3次' in frame.locator('#word-body').inner_text();assert page.locator('.preview-docx-frame').get_attribute('sandbox')=='allow-scripts';page.screenshot(path=str(root/'review/preview-word-dual.png'),animations='disabled');click('close-modal')
 source('d10','table');assert '860' in page.locator('.preview-sheet-grid').inner_text();click('close-modal');note('PDF使用真实页面并可缩放，Word保持原件版式且隔离渲染，Excel展示实际单元格；与解析内容同时可见')
 # The raw bytes must remain independent of parsed text, including pending and failed cases.
 ev("async()=>{const d={id:'qa-raw',name:'审阅原文.txt',type:'TXT',space:'个人空间',folder:'我的资料',date:'2026-10-18',local:false,text:'右侧解析结果，金额200万元。'};state.docs.push(d);await libStoreFile(d.id,new File(['左侧真实原件，金额100万元。<script>throw Error(1)</script>'],d.name,{type:'text/plain'}));}")
 source('qa-raw','text');assert '100万元' in page.locator('.preview-raw-text').inner_text() and '200万元' not in page.locator('.preview-raw-text').inner_text();assert '200万元' in page.locator('#preview-parsed-content').inner_text();assert page.locator('#preview-raw-content script').count()==0
 for fmt in ['md','word','xlsx']:
  page.locator('.preview-export>summary').click()
  with page.expect_download() as dl:page.locator('[data-action="preview-export"][data-format="'+fmt+'"]').click()
  path=pathlib.Path(tmp)/dl.value.suggested_filename;dl.value.save_as(path);assert path.stat().st_size>0
  if fmt=='md':assert '200万元' in path.read_text()
 click('close-modal');ev("file('qa-raw').local=true;file('qa-raw').parseError='正文识别失败'")
 source('qa-raw','text');assert '暂无解析内容' in page.locator('#preview-parsed-content').inner_text();assert page.locator('.preview-export>summary').get_attribute('aria-disabled')=='true';assert not page.locator('[data-action="preview-download-original"]').is_disabled();click('close-modal')
 ev("file('qa-raw').local=false;file('qa-raw').parseError=null;uploadSources.delete('qa-raw');libGetFile=async id=>id==='qa-raw'?null:previewBase.libGetFile(id)")
 ev("openModal('source',{id:'qa-raw'})");page.wait_for_function("document.querySelector('#preview-raw-content').innerText.includes('原始文件暂不可用')");assert '200万元' in page.locator('#preview-parsed-content').inner_text();click('close-modal');note('原件字节与解析内容独立；失败可看原件、缺原件可看正文；转义内容，三种格式导出可下载')
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});source('d3','docx')
  r=ev("()=>{const m=document.querySelector('.file-preview-dialog').getBoundingClientRect(),p=[...document.querySelectorAll('.file-preview-pane')].map(x=>x.getBoundingClientRect()),f=document.querySelector('.file-preview-dialog .modalfoot').getBoundingClientRect();return {w:innerWidth,h:innerHeight,top:m.top,bottom:m.bottom,right:m.right,left:m.left,footer:f.bottom,panes:p.map(x=>({left:x.left,right:x.right,height:x.height})),overflow:document.documentElement.scrollWidth-innerWidth}}")
  assert r['top']>=0 and r['bottom']<=h+1 and r['left']>=0 and r['right']<=w+1 and r['footer']<=h+1 and r['overflow']==0 and r['panes'][0]['right']<=r['panes'][1]['left']+1 and min(x['height'] for x in r['panes'])>150,r
  layouts.append(r);page.screenshot(path=str(root/f'review/preview-dual-{w}.png'),animations='disabled');click('close-modal')
 note('四种尺寸原件与解析内容始终两栏同时展示、各自滚动、底部按钮可见，无整页横向溢出')
 for fid in ['d1','d3','d10']:ev("id=>handleAction('source',{dataset:{id}})",fid);click('close-modal')
 page.wait_for_timeout(600);assert ev('activeFilePreview===null');assert not errors,errors
 note('快速切换和关闭无残留预览会话或脚本错误')
 (root/'review/folder-preview-test-results.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
