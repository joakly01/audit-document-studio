import pathlib,json
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#library',wait_until='load');page.wait_for_function("typeof wnBase!=='undefined'");page.evaluate('libraryStatusDataReady')
 def ev(s):return page.evaluate(s)
 def click(a):page.locator('[data-action="'+a+'"]:visible').last.click()
 def note(s):checks.append(s);print(s,flush=True)
 ev("state.space='个人空间';state.folder='我的资料';state.libraryRecursive=true;state.query='';state.librarySelected=['d1'];libraryPrefs.pageSize=10;state.page=1;render()")
 allids=ev('rangeSelectionContext().all');first=ev('rangeSelectionContext().page');assert len(allids)>10;assert page.locator('[data-action=range-select-all]').is_visible();assert page.locator('.range-table-top').bounding_box()['y']<page.locator('.lib-table-scroll').bounding_box()['y']
 page.locator('[data-lib-change="page"]').check();assert set(ev('state.librarySelected'))==set(first+['d1']);assert '已选本页' in page.locator('.range-selection-bar').inner_text();assert page.locator('.range-page-label').inner_text()=='本页'
 page.locator('[data-lib-change="check"]').first.uncheck();assert page.locator('[data-lib-change="page"]').evaluate('e=>e.indeterminate');page.locator('[data-lib-change="page"]').check()
 note('表头明确“本页”，全选只影响本页；取消单项显示半选，保留其他目录已选')
 click('range-select-all');assert set(ev('state.librarySelected'))==set(allids+['d1']);assert page.locator('[data-action=range-select-all]').is_disabled();assert '已选全部页' in page.locator('[data-action=range-select-all]').inner_text();click('lib-next');assert page.locator('[data-lib-change="page"]').is_checked();second=ev('rangeSelectionContext().page');click('range-keep-page');assert set(ev('state.librarySelected'))==set(second+['d1']);assert not set(first)&set(second)
 note('选择全部页使用当前范围所有文件；翻页勾选一致；仅保留本页仅清除此范围的其他页')
 ev("state.query='合同';state.page=1;render()");filtered=ev('rangeSelectionContext().all');before=set(ev('state.librarySelected'));assert len(filtered)>0
 # Initiate a page selection and expand only to matching files, preserving prior selections.
 page.locator('[data-lib-change="page"]').check();ev("handleAction('range-select-all',{dataset:{}})");assert set(ev('state.librarySelected'))==before|set(filtered)
 click('range-clear');assert set(ev('state.librarySelected'))==(before-set(filtered));assert page.locator('[data-action=range-select-all]').is_visible();assert page.locator('.range-table-top').bounding_box()['y']<page.locator('.lib-table-scroll').bounding_box()['y']
 note('全部页受目录、子目录范围、名称和筛选约束；取消本范围不误清空其他范围已选')
 ev("state.query='';state.librarySelected=[];state.page=1;render()");page.locator('[data-lib-change="page"]').check();click('range-select-all')
 for w,h in [(1366,768),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100);r=ev("()=>({height:innerHeight,bottom:document.querySelector('.lib-pagination').getBoundingClientRect().bottom,table:document.querySelector('.lib-table-scroll').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth})");assert r['bottom']<=h+1 and r['table']>=100 and r['overflow']==0,r
  page.screenshot(path=str(root/f'review/selection-range-{w}.png'),animations='disabled')
 note('全部页操作始终位于表格上方，范围切换清楚；低分辨率表格与分页仍可用，无整页横向溢出')
 assert not errors,errors;(root/'review/selection-range-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));b.close()
