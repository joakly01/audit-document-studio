"""Selection display has one primary home per context; temporary choices stay transactional."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path.cwd();errors=[];checks=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.on('pageerror',lambda e:errors.append(str(e)));g.set_default_timeout(15000)
 g.goto('http://127.0.0.1:8765/#library',wait_until='load');g.wait_for_function("typeof wnBase!=='undefined'");g.evaluate('libraryStatusDataReady')
 def ev(s):return g.evaluate(s)
 def act(a,**data):g.evaluate('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':data})
 ev("state.librarySelected=['d1','d3'];render()")
 assert g.locator('.audit-selection-inline').count()==1
 assert g.locator('[data-selection-count=total]').inner_text()=='2'
 act('library-selected');assert ev('modal')=='library-selected';assert g.locator('.selection-dialog tbody tr').count()==2;g.keyboard.press('Escape')
 checks.append('资料库底部保留唯一已选清单入口，可查看跨目录选择与正文解析状态')
 ev("nav('tool','extract');ws().ids=['d1','d3'];ws().preview='d1';render()")
 assert g.locator('.ew-ready').count()==0 and g.locator('.ef-apply-note').count()==0
 assert g.locator('.ew-scope-note').inner_text()=='已选 2 份资料'
 assert ev('JSON.stringify(state.librarySelected)')=='["d1","d3"]'
 # Existing tool files are reflected, editing a picker choice must not alter the tool until confirmed.
 act('add-tool-materials');assert ev('modalData.selected')==['d1','d3']
 assert g.locator('.picker-right h4').inner_text()=='已选资料 2 份'
 assert g.locator('[data-action=confirm-picker]').inner_text()=='确认选择'
 assert not any(x.isdigit() for x in g.locator('.modalfoot').inner_text())
 act('picker-unselect',id='d3');assert ev('modalData.selected')==['d1'];assert ev('ws().ids')==['d1','d3']
 g.keyboard.press('Escape');assert ev('ws().ids')==['d1','d3']
 act('add-tool-materials');act('picker-unselect',id='d3');act('confirm-picker');assert ev('ws().ids')==['d1']
 assert ev('state.librarySelected')==['d1','d3'];assert g.locator('.ew-scope-note').inner_text()=='已选 1 份资料'
 checks.append('弹窗右侧是完整待确认清单，确认选择才更新工具；取消恢复原选择，资料库勾选独立保留')
 # All-pages and outside-scope selections remain unchanged, without a second all-pages total in the status label.
 act('add-tool-materials');ev("modalData.space='个人空间';modalData.folder='我的资料';modalData.recursive=true;modalData.page=1;paintModal()")
 outside=ev('modalData.selected.filter(id=>!pickerRangeContext().all.includes(id))');act('picker-all')
 assert g.locator('[data-action=picker-all]').is_disabled();assert '当前范围全部' not in g.locator('.range-selected-description').inner_text()
 assert ev('pickerRangeContext().all.every(id=>modalData.selected.includes(id))')
 assert all(fid in ev('modalData.selected') for fid in outside)
 # Sticky total and compact footer work in short desktop and narrow layouts.
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});g.wait_for_timeout(100)
  r=ev("({w:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,footer:document.querySelector('.modalfoot').getBoundingClientRect().bottom,table:document.querySelector('.picker-center>.mixed-table').clientHeight})")
  assert r['overflow']==0 and r['footer']<=h+1,r
  if w>800:assert r['table']>=125,r
  layouts.append(r);g.screenshot(path=str(root/f'review/selection-homes-picker-{w}.png'))
 g.keyboard.press('Escape');g.set_viewport_size({'width':1366,'height':768})
 checks.append('全部页仅在选择按钮表达，跨范围保留，1366/1024×480/390布局和确认按钮可达')
 # Same list footer owns totals in other tools, including pagination and zero search matches.
 for toolid in ['word','theme','meeting','risk','timeline','contract','prepaid','engineering','bidding','association']:
  ev("nav('tool','"+toolid+"');loadSample();render()")
  assert not g.locator('.tw-command-actions>span').count()
  assert g.locator('.ew-scope-note').inner_text().startswith('已选 ')
  if toolid not in ['bidding','association']:
   before=ev('JSON.stringify(ws().ids)');g.locator('#tw-tree-query').fill('没有这个文件')
   assert '匹配 0 份' in g.locator('.ew-scope-note').inner_text();assert ev('JSON.stringify(ws().ids)')==before
   g.locator('#tw-tree-query').fill('')
  g.set_viewport_size({'width':390,'height':600});ev('render()')
  assert '已选资料' in g.locator('.tw-mobile-tabs').inner_text() or toolid=='association'
  assert g.locator('[data-action=tw-panel][data-panel=materials]').is_visible()
  g.set_viewport_size({'width':1366,'height':768})
 checks.append('其余10项工具的总数也收拢到左侧，手机保留资料页签数量；两表与招投标角色逻辑保持')
 ev("nav('tool','extract');ws().ids=state.docs.filter(d=>!d.deleted&&!d.local&&libReady(d)&&auditFileAccess(d).analyze).slice(0,51).map(d=>d.id);ws().preview=ws().ids[0];render()")
 ids=ev('ws().ids');assert len(ids)==51;assert '本页第 1–50 份' in g.locator('.ew-scope-note').inner_text()
 act('wn-files-next');assert '本页第 51 份' in g.locator('.ew-scope-note').inner_text();assert ev('ws().ids')==ids
 act('ef-remove-material',id=ids[-1]);assert len(ev('ws().ids'))==50
 assert g.locator('.ew-scope-note').inner_text()=='已选 50 份资料';assert g.locator('.ew-ready').count()==0
 g.screenshot(path=str(root/'review/selection-homes-extract.png'))
 checks.append('51份清单翻页不改变提取范围，逐项移除即时更新唯一总数')
 assert not errors,errors
 result={'checks':checks,'layouts':layouts,'errors':errors};(root/'review/selection-homes-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
