import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');page.set_default_timeout(6000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle')
 page.wait_for_function("typeof auditUploadPlan!=='undefined'")
 def ev(code):return page.evaluate(code)
 def more():page.locator('.lib-overflow>summary').click()
 for w,h in [(1440,900),(1366,768),(1280,720),(1024,768),(390,844)]:
  page.set_viewport_size({'width':w,'height':h})
  for selected in [False,True]:
   ev("navCollapsed=false;libraryPrefs.showFolders=true;libraryPrefs.showTools=true;state.librarySelected="+('["d1","d2"]' if selected else '[]')+';render()');page.wait_for_timeout(150)
   result=ev('''()=>{const bar=document.querySelector('.lib-toolbar'),items=[...bar.children].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height),boxes=items.map(e=>e.getBoundingClientRect()),selection=document.querySelector('.lib-path-row');return{width:innerWidth,mode:document.querySelector('.lib-files').dataset.toolbarMode,height:bar.getBoundingClientRect().height,single:boxes.every(r=>Math.abs((r.top+r.bottom)-(boxes[0].top+boxes[0].bottom))<3),inside:boxes.every(r=>r.right<=bar.getBoundingClientRect().right&&r.left>=bar.getBoundingClientRect().left),selectionHeight:selection?selection.getBoundingClientRect().height:0,overflow:document.documentElement.scrollWidth-innerWidth};}''')
   assert result['single'] and result['inside'] and result['height']<=60 and result['selectionHeight']==0 and result['overflow']==0,result
   assert not page.locator('.lib-path-row .tag').count()
   assert not page.locator('.lib-selection').count()
   assert page.locator('.lib-toolbar [data-action="lib-search"]').count()==1
   assert page.locator('.lib-table [data-action="lib-folder-menu"]').first.inner_text()==''
   assert page.locator('.lib-table [data-action="lib-folder-menu"]').first.is_visible()
   more();assert page.locator('.lib-overflow-panel').is_visible()
   assert page.locator('[data-action="lib-move-selected"]').is_enabled()==selected
   assert page.locator('[data-action="lib-delete-selected"]').is_enabled()==selected
   panel=page.locator('.lib-overflow-panel').bounding_box();assert panel['x']>=0 and panel['x']+panel['width']<=w+1 and panel['y']+panel['height']<=h+1,panel
   page.keyboard.press('Escape');assert not ev("document.querySelector('.lib-overflow').open")
   layouts.append({**result,'selected':selected});page.screenshot(path=str(root/'review'/f'compact-actions-{w}-{int(selected)}.png'),full_page=True)
 checks.append('5种宽度、选中与未选中10组：操作栏单行、没有独立排序行、浮层不越屏、没有项目/权限标签或大管理按钮')
 # Resize the live page repeatedly: the same form elements move and retain their values.
 page.set_viewport_size({'width':390,'height':844});ev("state.librarySelected=[];render()");more()
 page.locator('[data-lib-change="scope"]').select_option('recursive');more();page.locator('[data-lib-change="type"]').select_option('pdf')
 for w in [1366,1024,390,1440]:
  page.set_viewport_size({'width':w,'height':768});page.wait_for_timeout(100)
  assert page.locator('[data-lib-change="scope"]').count()==1
  assert page.locator('[data-lib-change="type"]').count()==1
  assert page.locator('[data-lib-change="scope"]').input_value()=='recursive'
  assert page.locator('[data-lib-change="type"]').input_value()=='pdf'
 checks.append('实时缩放时范围与筛选移动到更多，不丢值、不重复DOM')
 ev("libraryFilters.type='';state.libraryRecursive=false;state.space='公共空间';state.folder='制度资料';render()")
 assert not page.locator('.lib-path-row .tag').count()
 assert not page.locator('.lib-selection').count();assert page.locator('.lib-readonly-indicator').is_visible()
 more();page.locator('[data-action="v6-access"]:visible').click();assert ev("modal==='v6-access'");assert '权限' in page.locator('.modalhead').inner_text();page.keyboard.press('Escape')
 checks.append('权限仍可在更多查看，只读用简洁锁图标提示')
 ev("state.space='项目空间';state.folder='合同资料';state.librarySelected=['d1'];render()")
 more();page.locator('[data-action="lib-move-selected"]:visible').click();assert ev("modal==='lib-move'");page.keyboard.press('Escape')
 more();page.locator('[data-action="lib-delete-selected"]:visible').click();assert ev("modal==='lib-delete'");page.keyboard.press('Escape');assert not ev("file('d1').deleted")
 more();page.locator('.lib-overflow [data-action="lib-toggle-tools"]:visible').click();assert not page.locator('.lib-tools').is_visible();more();page.locator('.lib-overflow [data-action="lib-toggle-tools"]:visible').click();assert page.locator('.lib-tools').is_visible()
 checks.append('移动与删除保持确认；取消不改资料；工具区收起后可恢复')
 page.locator('.lib-overflow>summary').focus();page.keyboard.press('ArrowDown');assert ev("document.querySelector('.lib-overflow').open");page.keyboard.press('Escape');assert ev("document.activeElement.matches('.lib-overflow>summary')")
 more();page.locator('.lib-table th').nth(1).click();assert not ev("document.querySelector('.lib-overflow').open")
 checks.append('菜单支持键盘进入、Esc返回焦点和点击外部关闭')
 assert not errors,errors
 (root/'review/compact-actions-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
