import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#templates',wait_until='networkidle');page.evaluate('localStorage.clear()');page.reload(wait_until='networkidle');page.wait_for_function("typeof xtCatalog!=='undefined'");page.evaluate('libraryStatusDataReady')
 def ev(s,arg=None):return page.evaluate(s,arg)
 def action(a,id=None):ev("([a,id])=>handleAction(a,{dataset:{id}})",[a,id])
 def click(a):page.locator('[data-action="'+a+'"]:visible').last.click()
 def note(s):checks.append(s);print(s,flush=True)
 def close():page.keyboard.press('Escape')
 def metrics(selector):return ev("s=>{const e=document.querySelector(s),th=e.querySelector('th'),td=e.querySelector('tbody tr td');return {font:getComputedStyle(th).fontSize,background:getComputedStyle(th).backgroundColor,color:getComputedStyle(th).color,border:getComputedStyle(td).borderBottomColor,row:e.querySelector('tbody tr').getBoundingClientRect().height}}",selector)
 ev("nav('library')");base=metrics('.lib-table');ev("nav('templates')");current=metrics('.xt-table');assert all(current[k]==base[k] for k in ['font','background','color','border']),(base,current);assert abs(current['row']-base['row'])<12,(base,current)
 assert page.locator('.xt-toolbar').bounding_box()['height']<=60;assert page.locator('.xt-toolbar .audit-location-label').inner_text()=='当前目录';assert page.locator('.xt-table .btn.primary,.xt-table .btn.soft').count()==0
 page.screenshot(path=str(root/'review/templates-consistent-list.png'),animations='disabled');note('资料与模板表头字号、色彩和边框一致，行高接近；单行当前目录工具栏，列表操作使用一致的文字链接及实心省略号')
 # Folder filtering exposes ancestors while preserving saved collapse preferences.
 ev("xtView.closed=['xt-system','xt-invoice'];render()");page.locator('#xt-folder-query').fill('专用');assert page.locator('.xt-tree-name').all_text_contents()==['系统模板6','发票1','专用发票0'];assert ev('xtView.closed')==['xt-system','xt-invoice']
 page.locator('#xt-folder-query').fill('不存在的分类');assert page.locator('.xt-tree-empty').is_visible();page.locator('#xt-folder-query').fill('');assert not page.locator('.xt-tree-name[data-id="xt-invoice-special"]').count()
 action('xt-folder','xt-payments');assert page.locator('.xt-current-folder').inner_text().replace('\n','').endswith('票据核验');page.locator('.xt-current-folder [data-id="xt-mine"]').click();assert ev('xtView.folder')=='xt-mine';click('xt-refresh');assert ev('xtView.folder')=='xt-mine'
 note('分类搜索显示匹配节点及祖先，不改原展开状态；无匹配、清空、父级位置导航和刷新可用')
 # Existing edits preserve the listing scope, query, pagination and scroll position.
 ev("for(let i=0;i<25;i++)state.templates.push({id:'polish-'+i,toolId:'extract',name:'专项核验 '+i,description:'核对项目资料',folderId:'xt-mine',rules:[{name:'事项',description:''}]});xtView.folder='xt-mine';xtView.query='专项';xtView.draftQuery='专项';xtView.page=2;xtView.size=10;render()")
 page.locator('.xt-table-scroll').evaluate('e=>e.scrollTop=120');scroll=page.locator('.xt-table-scroll').evaluate('e=>e.scrollTop');id=page.locator('.xt-table tbody tr').last.get_attribute('data-template-id');action('xt-edit',id);page.locator('#xt-template-description').fill('保留当前查询的修改');click('xt-save')
 assert ev("xtView.folder==='xt-mine'&&xtView.query==='专项'&&xtView.page===2");assert abs(page.locator('.xt-table-scroll').evaluate('e=>e.scrollTop')-scroll)<=1
 note('编辑保存保留分类、名称筛选、当前页和列表滚动位置，不将用户带回第一页')
 # Large field arrays retain context during reordering and removing a row.
 action('xt-copy','xt-sys-construction-full');page.locator('.xt-editor-table-scroll').evaluate('e=>e.scrollTop=2100');before=page.locator('.xt-editor-table-scroll').evaluate('e=>e.scrollTop')
 ev("handleAction('xt-field-down',{dataset:{index:'25'}})");after=page.locator('.xt-editor-table-scroll').evaluate('e=>e.scrollTop');assert after>1000 and abs(after-before)<220,(before,after)
 ev("handleAction('xt-remove-field',{dataset:{index:'25'}})");assert page.locator('.xt-editor-table-scroll').evaluate('e=>e.scrollTop')>1000;close();click('xt-confirm-discard')
 note('36字段列表在下部调整顺序或删除后保留视野，键盘焦点跟随目标字段，未保存可放弃')
 # Long names/descriptions remain readable without stretching rows or clipping dialog controls.
 ev("state.templates.push({id:'polish-long',toolId:'extract',name:'专项资金审计提取模板'+('名称'*35),description:'核对批复与付款依据。'.repeat(300),folderId:'xt-mine',rules:[{name:'批准金额',description:''}]});xtView.folder='xt-mine';xtView.query='';xtView.draftQuery='';xtView.page=1;xtView.size=50;render()")
 row=page.locator('[data-template-id="polish-long"]');assert row.bounding_box()['height']<90;assert len(row.locator('.xt-template-description').get_attribute('title'))>1000
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
  r=ev("()=>({w:innerWidth,h:innerHeight,toolbar:document.querySelector('.xt-toolbar').getBoundingClientRect().height,footer:document.querySelector('.xt-pagination').getBoundingClientRect().bottom,bodyWidth:document.documentElement.scrollWidth,bodyHeight:document.documentElement.scrollHeight})");assert r['toolbar']<=60 and r['footer']<=h+1 and r['bodyWidth']<=w and r['bodyHeight']<=h+1,r
  action('xt-fields','polish-long');box=page.locator('.xt-fields-dialog').bounding_box();foot=page.locator('.xt-fields-dialog .modalfoot').bounding_box();assert box['y']>=0 and box['y']+box['height']<=h+1 and foot['y']+foot['height']<=h+1,(w,box,foot);close()
  page.screenshot(path=str(root/f'review/templates-consistent-{w}.png'),animations='disabled');layouts.append(r)
 note('长描述列表最多两行、详情可完整滚动；四种尺寸保持单行工具栏，分页和详情操作不超窗')
 assert not errors,errors;(root/'review/template-consistency-results.json').write_text(json.dumps({'checks':checks,'baseline':base,'current':current,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
