"""Stress navigation with many files and long text; viewing never narrows execution/export scope."""
from pathlib import Path
import json,time,base64
from playwright.sync_api import sync_playwright
root=Path.cwd();errors=[];checks=[];timings=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(15000);g.on('pageerror',lambda e:errors.append(str(e)))
 g.goto('http://127.0.0.1:8765/#tool/extract',wait_until='load');g.wait_for_function("typeof wnBase!=='undefined'");g.evaluate('libraryStatusDataReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def act(a,**d):return ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def click(a):g.locator('[data-action="'+a+'"]:visible').last.click()
 ev("""()=>{window.massDocs=Array.from({length:1500},(_,i)=>({...structuredClone(file('d1')),id:'mass-'+i,name:'专项审计资料-'+String(i+1).padStart(4,'0')+'.pdf',folder:i%2?'园区改造项目/合同资料':'园区改造项目/财务资料',attachments:[],text:'用于测试的解析内容。'}));state.docs.push(...massDocs);ws().ids=massDocs.map(d=>d.id);ws().preview=massDocs[0].id;render();}""")
 for toolid in ['extract','word','meeting','contract','engineering']:
  start=time.monotonic();ev("id=>{nav('tool',id);ws().taskId=null;ws().ids=massDocs.map(d=>d.id);ws().preview=massDocs[0].id;render()}",toolid);timings.append({'tool':toolid,'render_ms':round((time.monotonic()-start)*1000)})
  assert ev("document.querySelectorAll('.ew-file,.tw-file').length")==50
  assert ev('ws().ids.length')==1500
  click('wn-files-next');assert ev('wnMaterialView().page')==2
  assert ev('ws().preview')=='mass-0';assert ev('ws().ids.length')==1500
  click('wn-locate');assert ev('wnMaterialView().page')==1
  assert g.locator('.ew-file.active,.tw-file.active').is_visible()
  q=g.locator('#ew-tree-query' if toolid=='extract' else '#tw-tree-query');q.fill('1499');assert ev('wnMaterialView().total')==1;assert ev('ws().ids.length')==1500
  click('wn-locate');assert q.input_value()=='';assert ev('wnMaterialView().page')==1
  g.locator('[aria-label="资料页码"]').fill('30');g.locator('[aria-label="资料页码"]').press('Tab');assert ev('wnMaterialView().page')==30;assert g.locator('[data-action=wn-files-next]').is_disabled()
  before=ev('JSON.stringify(ws().ids)')
  g.locator('[data-action="ef-remove-material"],[data-action="tw-remove"]').first.click();assert ev('ws().ids.length')==1499;g.locator('#undo-toast').click();assert ev('JSON.stringify(ws().ids)')==before
 checks.append('1500份文件，5种工具清单每页50份；分页/查找/定位不改变执行范围，末页移出与撤销保留顺序')
 # Grouped bidding keeps roles and project assignments while paging visible files.
 ev("""()=>{nav('tool','bidding');const ids=massDocs.map(d=>d.id);ws().projects=[{id:'project-1',name:'项目一',tender:ids.slice(0,20),bidders:[{id:'bidder-1',name:'投标单位一',files:ids.slice(20,750)}]},{id:'project-2',name:'项目二',tender:ids.slice(750,770),bidders:[{id:'bidder-2',name:'投标单位二',files:ids.slice(770)}]}];ws().unassigned=[];syncBidIds();ws().preview=ids[0];render();window.bidSnapshot=JSON.stringify(ws().projects);}""")
 assert g.locator('.tw-file').count()==50;click('wn-files-next');assert g.locator('.tw-file').count()==50;assert ev('JSON.stringify(ws().projects)===bidSnapshot');assert ev('ws().ids.length')==1500
 checks.append('招投标1500份资料分页仍保留项目、招标和投标单位归属，完整分组及执行范围不变')
 # Searching a million-character body must find text beyond the displayed window, with escaped literal search.
 ev(r"""()=>{nav('tool','extract');ws().ids=['d1','d3'];ws().preview='d1';window.originalText=file('d1').text;file('d1').text='正文内容，核对金额和日期。\n'.repeat(60000)+'唯一尾部证据 [123].* 金额500万元\n';render();}""")
 click('ef-preview-tab') # parsed tab is last
 assert g.locator('#ef-parsed-content').is_visible()
 assert ev("document.querySelector('.wn-reader-body').textContent.length")<=6000
 assert ev("wnReader(file('d1')).starts.length")>100
 form=g.locator('#ef-parsed-content .wn-find');form.locator('input').fill('唯一尾部证据');form.locator('button[type=submit]').click()
 assert g.locator('#ef-parsed-content mark[data-current]').inner_text()=='唯一尾部证据';g.screenshot(path=str(root/'review/large-workloads-long-text.png'))
 assert ev("wnReader(file('d1')).page")==ev("wnReader(file('d1')).starts.length-1")
 assert ev("previewText(file('d1')).length")>800000
 form.locator('input').fill('[123].*');form.locator('button[type=submit]').click();assert g.locator('mark[data-current]').inner_text()=='[123].*'
 click('wn-text-clear');g.locator('[aria-label="正文阅读段"]').fill('25');g.locator('[aria-label="正文阅读段"]').press('Tab');assert ev("wnReader(file('d1')).page")==24
 ev("handleAction('preview',{dataset:{id:'d3'}});handleAction('preview',{dataset:{id:'d1'}})");assert g.locator('[aria-label="正文阅读段"]').input_value()=='25'
 # IME input is not re-rendered while composing.
 form=g.locator('#ef-parsed-content .wn-find');form.locator('input').evaluate("el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='金额';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'金额'}));window.composingField=el;}");assert ev('composingField.isConnected');form.locator('input').evaluate("el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'金额'}))");form.locator('button[type=submit]').click();assert g.locator('mark[data-current]').inner_text()=='金额'
 checks.append('约84万字正文按段渲染，全文查找到末尾及特殊符号；阅读段记忆、中文输入、完整正文保留')
 # Match spanning a display boundary is still discovered and visibly highlighted.
 ev("file('d1').text='甲'.repeat(5998)+'跨段关键字'+'乙'.repeat(9000);render()");form=g.locator('#ef-parsed-content .wn-find');form.locator('input').fill('跨段关键字');form.locator('button[type=submit]').click();assert ev("wnReader(file('d1')).hits")==[5998];assert g.locator('mark[data-current]').inner_text()=='跨段'
 # Create a real three-page PDF fixture without adding a production dependency.
 stream=b'BT /F1 12 Tf 72 720 Td (Audit evidence page) Tj ET'
 objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>']+[b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 7 0 R >>']*3+[b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream']
 pdf=b'%PDF-1.4\n';offsets=[0]
 for i,obj in enumerate(objects,1):offsets.append(len(pdf));pdf+=str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
 start=len(pdf);pdf+=b'xref\n0 8\n0000000000 65535 f \n'+b''.join((str(n).zfill(10)+' 00000 n \n').encode() for n in offsets[1:])+b'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n'+str(start).encode()+b'\n%%EOF'
 ev("base64=>{previewRelease();uploadSources.set('d1',new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'evidence.pdf',{type:'application/pdf'}));}",base64.b64encode(pdf).decode())
 # Returning to the same raw PDF retains real page / scale.

 ev("file('d1').text=originalText;ws().preview='d1';render();handleAction('ef-preview-tab',{dataset:{tab:'original'}})");g.wait_for_function("document.querySelector('#ef-raw-content')?.dataset.rawReady==='pdf'");pages=ev('activeFilePreview.pdf.numPages');assert pages==3;target=2
 g.locator('[data-preview-change=pdf-page]').fill(str(target));g.locator('[data-preview-change=pdf-page]').press('Tab');g.wait_for_function("document.querySelector('#ef-raw-content')?.dataset.rawReady==='pdf'");g.locator('[data-preview-change=pdf-zoom]').select_option('1.25');ev("handleAction('preview',{dataset:{id:'d3'}})");g.wait_for_timeout(200);ev("handleAction('preview',{dataset:{id:'d1'}})");g.wait_for_function("document.querySelector('#ef-raw-content')?.dataset.rawReady==='pdf'");assert ev('activeFilePreview.data.rawPage')==target;assert ev('activeFilePreview.data.rawZoom')=='1.25'
 checks.append('正文跨阅读段匹配不丢失；真实PDF切换文件后保留页码及缩放')
 # Source task documents have bounded rows and independent analysis status filtering.
 ev("""()=>{state.tasks.unshift({id:'mass-task',toolId:'extract',name:'大批量专项审计测试',ids:massDocs.map(d=>d.id),status:'partial',created:new Date().toISOString(),successIds:massDocs.slice(0,1400).map(d=>d.id),failedIds:massDocs.slice(1400,1475).map(d=>d.id),result:[],config:structuredClone(ws().config)});nav('tasks');handleAction('tc-info',{dataset:{id:'mass-task'}});handleAction('tc-info-tab',{dataset:{tab:'sources'}});}""")
 assert g.locator('.wn-task-source-table tbody tr').count()==50
 g.locator('[aria-label="工具分析状态"]').select_option('failed');assert '75 份' in g.locator('.wn-task-pager').inner_text();assert g.locator('.wn-task-source-table tbody tr').count()==50
 click('wn-task-next');assert g.locator('.wn-task-source-table tbody tr').count()==25
 g.locator('[aria-label="查找任务资料"]').fill('1475');g.locator('[data-wn-task-search] button[type=submit]').click();assert g.locator('.wn-task-source-table tbody tr').count()==1,ev("({doc:file('mass-1474'),access:auditFileAccess(file('mass-1474')),status:wnSourceStatus(state.tasks.find(t=>t.id==='mass-task'),'mass-1474'),view:wnTaskView(state.tasks.find(t=>t.id==='mass-task')),text:document.querySelector('.wn-task-pager').textContent,form:document.querySelector('[data-wn-task-search]').outerHTML})")
 assert '分析失败' in g.locator('.wn-task-source-table').inner_text();assert ev("state.tasks.find(t=>t.id==='mass-task').ids.length")==1500
 click('source');g.keyboard.press('Escape');assert ev("modal==='tc-info'");assert g.locator('[aria-label="查找任务资料"]').input_value()=='1475'
 g.set_viewport_size({'width':1024,'height':480});box=g.locator('.tc-info-dialog').bounding_box();assert box['y']>=0 and box['y']+box['height']<=481;g.screenshot(path=str(root/'review/large-workloads-task-sources.png'));assert g.locator('.wn-task-source-table').bounding_box()['height']>=95;assert g.locator('[data-action=wn-task-next]').is_visible()
 checks.append('1500份任务资料分页，75份失败项独立筛选、跨页查询，完整快照不变，1024×480弹窗可操作')
 g.keyboard.press('Escape')
 for width,height in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':width,'height':height});ev("nav('tool','extract');ws().ids=massDocs.map(d=>d.id);ws().preview=massDocs[0].id;efView.panel='materials';render()");assert ev('document.documentElement.scrollWidth')<=width
  assert g.locator('.wn-material-pager').is_visible()
  g.screenshot(path=str(root/f'review/large-workloads-files-{width}.png'))
 assert not errors,errors
 result={'checks':checks,'timings':timings,'errors':errors};(root/'review/large-workloads-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
