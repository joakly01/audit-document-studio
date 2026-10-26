"""Selectable page boundaries and browser-native Chinese IME composition."""
import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#library',wait_until='load');g.wait_for_function("typeof wnBase!=='undefined'");g.evaluate('libraryStatusDataReady');cdp=g.context.new_cdp_session(g)
 def ev(s,arg=None):return g.evaluate(s,arg)
 def act(action):g.locator('[data-action="'+action+'"]:visible').last.click()
 def ime(selector,text,model):
  el=g.locator(selector);el.focus();ev("s=>window.imeOriginal=document.querySelector(s)",selector);before=ev(model)
  cdp.send('Input.imeSetComposition',{'text':'he','selectionStart':2,'selectionEnd':2});cdp.send('Input.imeSetComposition',{'text':'hetong','selectionStart':6,'selectionEnd':6});assert ev('imeOriginal.isConnected');assert ev(model)==before
  ev("imeOriginal.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true}))");assert ev('imeOriginal.isConnected')
  cdp.send('Input.insertText',{'text':text});g.wait_for_timeout(40);assert g.locator(selector).input_value()==text;assert ev(model)==text;assert g.locator(selector).evaluate('e=>document.activeElement===e')
 ime('#library-folder-search','合同','folderQueries.library');g.locator('#library-folder-search').fill('');ime('#lib-file-query','年度','state.query');g.locator('#lib-file-query').fill('')
 # Browser variation without a non-composing final input is flushed once at compositionend.
 ev("const el=document.querySelector('#library-folder-search');el.focus();el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='caiwu';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));el.value='财务';el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'财务'}))");g.wait_for_timeout(50);assert ev('folderQueries.library')=='财务';g.locator('#library-folder-search').fill('')
 checks.append('Chromium实际IME引擎：资料管理目录/名称搜索可连续拼音输入、候选确认和回车选词，组合中输入节点/查询保持不变；兼容无末尾input的事件顺序')
 ev("nav('tool','extract');ws().ids=['d1','d2'];ws().preview='d1';render()");ime('#ew-tree-query','合同','ws().treeQuery');assert ev('ws().ids')==['d1','d2'];g.locator('#ew-tree-query').fill('')
 act('add-tool-materials');ev("modalData.space='项目空间';modalData.folder='全部资料';modalData.recursive=true;modalData.selected=[];paintModal()");ime('#picker-folder-search','合同','folderQueries.picker');assert ev('modal')=='picker';g.locator('#picker-folder-search').fill('');ime('#picker-query','合同','modalData.query');g.locator('#picker-query').fill('')
 checks.append('工具已添加目录、资料选择目录与文件搜索均能直接输入中文，输入不更改既有资料范围')
 c=ev('pickerRangeContext()');assert len(c['all'])>14 and len(c['page'])==7
 g.locator('[data-change=picker-page]').check();assert set(ev('modalData.selected'))==set(c['page']);assert '已选本页' in g.locator('.picker-range-selection').inner_text();act('picker-next');g.locator('[data-change=picker-check]').first.check();assert len(ev('modalData.selected'))==8;assert g.locator('[data-change=picker-page]').evaluate('e=>e.indeterminate')
 act('picker-all');assert set(ev('modalData.selected'))==set(c['all']);assert g.locator('[data-action=picker-all]').is_disabled();assert '已选全部页' in g.locator('[data-action=picker-all]').inner_text();g.screenshot(path=str(root/'review/picker-range-all-1366.png'),animations='disabled')
 # Current-range actions preserve selected documents in another space or search result.
 outside=ev("state.docs.find(d=>d.space==='个人空间'&&!d.deleted&&!d.local&&auditFileAccess(d).read).id");ev("id=>{modalData.selected.push(id);paintModal()}",outside);act('picker-range-keep-page');pageids=ev('pickerRangeContext().page');assert set(ev('modalData.selected'))==set(pageids+[outside]);act('picker-range-clear');assert ev('modalData.selected')==[outside]
 g.locator('#picker-query').fill('合同');filtered=ev('pickerRangeContext().all');act('picker-all');assert set(ev('modalData.selected'))==set(filtered+[outside]);assert all('合同' in ev('id=>file(id).name',i) for i in filtered)
 g.locator('#picker-query').fill('绝无此资料');assert g.locator('[data-action=picker-all]').is_disabled();assert g.locator('[data-change=picker-page]').is_disabled();assert len(ev('modalData.selected'))==len(filtered)+1;g.locator('#picker-query').fill('')
 # Permission changes are re-evaluated on the action, including already loaded pages.
 denied=ev('pickerRangeContext().all[0]');ev("id=>{const d=file(id),key=directoryKey(d.space,d.folder);window.deniedMeta=folderMeta[key];window.deniedKey=key;folderMeta[key]={permission:'NONE'};modalData.selected=[];paintModal()}",denied);act('picker-all');assert denied not in ev('modalData.selected');ev("if(deniedMeta)folderMeta[deniedKey]=deniedMeta;else delete folderMeta[deniedKey];paintModal()")
 checks.append('本页/全部页作用于真实混排分页；半选、跨页保留、仅保留本页/取消本范围保留其他范围；搜索与空结果、操作时权限复核')
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});g.wait_for_timeout(80);r=ev("({w:innerWidth,h:innerHeight,outer:document.documentElement.scrollWidth,dialog:document.querySelector('.modal').getBoundingClientRect().toJSON(),footer:document.querySelector('.modalfoot').getBoundingClientRect().bottom,pager:document.querySelector('.picker-center>.pagination').getBoundingClientRect().bottom,table:document.querySelector('.picker-center>.mixed-table').clientHeight})");assert r['outer']<=w and r['dialog']['top']>=0 and r['dialog']['bottom']<=h+1 and r['footer']<=h+1,r
  if w>800:assert r['pager']<=r['footer'] and r['table']>=125,r
  if w<801:
   g.locator('.picker-center>.pagination').scroll_into_view_if_needed();assert g.locator('.picker-center>.pagination').bounding_box()['y']<h;act('picker-next');assert ev("document.querySelector('.modalbody').scrollTop")>0
  g.screenshot(path=str(root/f'review/picker-range-all-{w}.png'),animations='disabled');layouts.append(r)
 g.set_viewport_size({'width':1366,'height':768});g.keyboard.press('Escape');assert ev('ws().ids')==['d1','d2']
 # Mixed pages include folders, and selecting the page never expands them implicitly.
 act('add-tool-materials');ev("modalData.space='项目空间';modalData.folder='全部资料';modalData.recursive=false;modalData.selected=[];paintModal()");mixed=ev('pickerItems().slice(0,7).map(x=>x.kind)');assert 'folder' in mixed;ids=ev('pickerRangeContext().page');assert len(ids)<7
 if ids:g.locator('[data-change=picker-page]').check();assert set(ev('modalData.selected'))==set(ids)
 else:assert g.locator('[data-change=picker-page]').is_disabled()
 g.keyboard.press('Escape');ev("nav('tool','association');startPicker({table:true,slot:'A',selected:[]});modalData.space='项目空间';modalData.folder='全部资料';modalData.recursive=true;paintModal()");assert not g.locator('[data-action=picker-all]').count();g.locator('[data-change=picker-check]').first.check();assert len(ev('modalData.selected'))==1;ev("handleAction('picker-all',{dataset:{}})");assert len(ev('modalData.selected'))==1;g.keyboard.press('Escape')
 ev("nav('templates')");ime('#xt-folder-query','发票','xtView.folderQuery');checks.append('文件夹不隐式展开、取消不污染原范围、选表仍单选；模板分类查找一并支持中文输入；三尺寸分页和确认操作可达')
 assert not errors,errors;result={'checks':checks,'layouts':layouts,'errors':errors};(root/'review/picker-range-ime-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
