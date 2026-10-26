import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];results=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':600},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#library',wait_until='load');page.wait_for_function("typeof wnBase!=='undefined'")
 for w,h in [(1440,900),(1366,768),(1280,600),(1024,600),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h})
  for selected in [False,True]:
   page.evaluate("state.librarySelected="+('["d1","d2"]' if selected else '[]')+';render()');page.wait_for_timeout(100)
   r=page.evaluate('''()=>{let rect=s=>document.querySelector(s).getBoundingClientRect();return{width:innerWidth,height:innerHeight,bodyHeight:document.documentElement.scrollHeight,bodyWidth:document.documentElement.scrollWidth,tableHeight:rect('.lib-table-scroll').height,tableTop:rect('.lib-table-scroll').top,pagerBottom:rect('.lib-pagination').bottom,headerHeight:document.querySelector('.lib-path-row')?rect('.lib-path-row').height:0,toolbarHeight:rect('.lib-toolbar').height,oldHeader:!!document.querySelector('.lib-commandbar'),rangeHeight:document.querySelector('.range-selection-bar')?.getBoundingClientRect().height||0,font:getComputedStyle(document.querySelector('.lib-toolbar .btn')).fontSize}}''')
   assert r['bodyHeight']<=h+1 and r['bodyWidth']<=w,r
   assert not r['oldHeader'] and r['headerHeight']==0 and r['toolbarHeight']<=60,r
   assert r['pagerBottom']<=h and r['tableTop']<=75+r['rangeHeight'] and r['font']=='16px',r
   assert r['rangeHeight']<=(160 if w<=600 else 100),r
   assert r['tableHeight']>=h-175-r['rangeHeight'],r
   header=page.locator('.lib-toolbar').bounding_box();upload=page.locator('.lib-toolbar [data-action="upload"]').bounding_box();assert upload is not None,{'layout':r,'upload':upload};assert upload['y']>=header['y'] and upload['y']+upload['height']<=header['y']+header['height']+1
   results.append({**r,'selected':selected})
   page.screenshot(path=str(root/f'review/dense-library-{w}x{h}-{int(selected)}.png'),animations='disabled')
 # A real iframe leaves 80px for the host's header. Its own viewport must scroll only the panes.
 page.set_viewport_size({'width':1366,'height':680});page.set_content('<div style="height:80px;font-size:16px">审计业务平台</div><iframe title="文档资料挖掘" src="http://127.0.0.1:8765/#library" style="position:absolute;top:80px;left:0;border:0;width:100%;height:calc(100vh - 80px)"></iframe>');frame=page.frame_locator('iframe');frame.locator('.audit-upload-split').wait_for();f=page.frames[1];f.wait_for_function("typeof auditUploadPlan!=='undefined'");r=f.evaluate('''()=>({height:innerHeight,body:document.documentElement.scrollHeight,pager:document.querySelector('.lib-pagination').getBoundingClientRect().bottom})''');assert r['height']==600 and r['body']<=600 and r['pager']<=600,r;results.append({'embedded':r});page.screenshot(path=str(root/'review/dense-library-in-framework.png'),animations='disabled');assert not errors,errors
 (root/'review/library-height-results.json').write_text(json.dumps({'layouts':results,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'layouts':len(results),'errors':errors}));b.close()
