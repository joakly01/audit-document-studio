import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle')
 def ev(s):return page.evaluate(s)
 ev("""()=>{state.space='个人空间';state.folder='排序/A';state.directoryNodes.push(...['排序','排序/A','排序/B','排序/C','排序/A/下级','另一个目录','另一个目录/下级'].map(path=>({space:'个人空间',path})));state.librarySelected=[state.docs[0].id];persist();render();}""")
 assert page.locator('[data-order-path]').count()==0
 checks.append('普通用户没有拖动与排序操作')
 ev('state.libraryAdmin=true;render()')
 def row(path):return page.locator('[data-order-path="'+path+'"]')
 def drag(source,target,after=False):
  page.evaluate("""({source,target,after})=>{const find=p=>[...document.querySelectorAll('[data-order-path]')].find(r=>r.dataset.orderPath===p),s=find(source),t=find(target),dt=new DataTransfer();s.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));const r=t.getBoundingClientRect(),y=after?r.bottom-2:r.top+2;t.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:y}));t.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:y}));s.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));}""",{'source':source,'target':target,'after':after})
 before=ev('JSON.stringify({docs:state.docs,selected:state.librarySelected,folder:state.folder})')
 ev("treeClosed.add('library::个人空间::另一个目录')")
 drag('排序/C','排序/A')
 assert ev("childDirectories('个人空间','排序')")==['排序/C','排序/A','排序/B']
 assert before==ev('JSON.stringify({docs:state.docs,selected:state.librarySelected,folder:state.folder})')
 assert ev("treeClosed.has('library::个人空间::另一个目录')")
 drag('排序/C','排序/B',True)
 assert ev("childDirectories('个人空间','排序')")==['排序/A','排序/B','排序/C']
 checks.append('同级向前/向后排序，当前目录、资料关联、选择与展开状态不变')
 drag('排序/A','排序/A/下级');assert ev("childDirectories('个人空间','排序')")==['排序/A','排序/B','排序/C']
 drag('排序/A','排序/A');assert ev("childDirectories('个人空间','排序')")==['排序/A','排序/B','排序/C']
 checks.append('禁止跨层级、拖入目录以及自身投放')
 ev("folderQueries.library='C';render()")
 # Hidden siblings are included even when the displayed folder tree is filtered.
 ev("folderOrderCommit('个人空间','排序/C','排序/A',false)")
 assert ev("childDirectories('个人空间','排序')")==['排序/C','排序/A','排序/B']
 ev("folderQueries.library='';render()")
 page.reload(wait_until='networkidle');assert ev("childDirectories('个人空间','排序')")==['排序/C','排序/A','排序/B']
 ev("state.libraryAdmin=true;state.space='个人空间';render()")
 checks.append('筛选时不丢隐藏同级，刷新后保存排序')
 row('排序/C').locator('.folder-order-grip').press('Alt+ArrowDown')
 assert ev("childDirectories('个人空间','排序')")==['排序/A','排序/C','排序/B']
 ev("openModal('lib-folder-menu',{space:'个人空间',path:'排序/C'})")
 page.locator('[data-action="lib-folder-down"]:visible').click()
 assert ev("childDirectories('个人空间','排序')")==['排序/A','排序/B','排序/C']
 ev('closeModal()')
 checks.append('键盘与菜单上下移使用同一排序规则')
 # A real native browser drag verifies the event wiring beyond synthetic events.
 row('排序/C').drag_to(row('排序/A'),target_position={'x':70,'y':3})
 assert ev("childDirectories('个人空间','排序')")==['排序/C','排序/A','排序/B']
 checks.append('浏览器实际拖拽成功')
 ev("state.space='项目空间';render()")
 assert page.locator('[data-order-path]').count()==0
 assert not ev("auditFolderAccess('项目空间','合同资料').order")
 ev("state.space='公共空间';state.directoryNodes.push({space:'公共空间',path:'归档甲'},{space:'公共空间',path:'归档乙'});folderMeta[directoryKey('公共空间','归档甲')]={source:'OSS',permission:'READ'};render()")
 assert not ev("auditFolderAccess('公共空间','归档甲').upload")
 assert row('归档甲').get_attribute('draggable')=='true'
 drag('归档乙','归档甲');assert ev("childDirectories('公共空间','').indexOf('归档乙')<childDirectories('公共空间','').indexOf('归档甲')")
 checks.append('项目空间不开放未支持的排序；公共归档目录排序不赋予内容写权限')
 before=ev('JSON.stringify(folderMeta)')
 ev("""()=>{const s=[...document.querySelectorAll('[data-order-path]')].find(r=>r.dataset.orderPath==='归档甲');window.orderDt=new DataTransfer();s.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:orderDt}));state.libraryAdmin=false;const t=[...document.querySelectorAll('[data-order-path]')].find(r=>r.dataset.orderPath==='归档乙');t.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:orderDt,clientY:t.getBoundingClientRect().top}));}""")
 assert before==ev('JSON.stringify(folderMeta)')
 assert page.locator('.folder-order-source,.folder-order-before,.folder-order-after').count()==0
 checks.append('拖动途中失去权限则拒绝保存并清除提示')
 ev("state.libraryAdmin=true;state.space='个人空间';render()")
 drag('排序','另一个目录')
 assert ev("childDirectories('个人空间','').indexOf('排序')<childDirectories('个人空间','').indexOf('另一个目录')")
 snapshot=ev('JSON.stringify(folderMeta)')
 ev("""()=>{const t=document.querySelector('[data-order-path]'),dt=new DataTransfer();dt.items.add(new File(['text'],'资料.txt',{type:'text/plain'}));t.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));t.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}""")
 assert snapshot==ev('JSON.stringify(folderMeta)')
 ev("""()=>{const s=document.querySelector('[data-order-path]');s.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:new DataTransfer()}));}""")
 page.keyboard.press('Escape');assert not ev('folderOrderDrag');assert snapshot==ev('JSON.stringify(folderMeta)')
 checks.append('根层同级可排序，外部文件与取消拖动不改变顺序')
 ev("state.libraryAdmin=true;state.space='个人空间';render()")
 for w,h in [(1366,768),(1024,768)]:
  page.set_viewport_size({'width':w,'height':h});page.screenshot(path=str(root/'review'/f'folder-order-{w}.png'),full_page=True)
  assert ev('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 (root/'review/folder-order-checks.json').write_text(json.dumps({'passed':checks,'pageErrors':errors},ensure_ascii=False,indent=2))
 print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False));b.close()
