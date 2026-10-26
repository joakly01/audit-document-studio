"""Consistent top-of-table range controls and direct extraction guidance."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path.cwd();errors=[];checks=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(12000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#library',wait_until='load');g.wait_for_function("typeof wnBase!=='undefined'");g.evaluate('libraryStatusDataReady')
 def ev(s):return g.evaluate(s)
 def click(a):g.locator('[data-action="'+a+'"]:visible').last.click()
 def scope(context,value):g.locator('[data-directory-scope="'+context+'"]').set_checked(value=='recursive')
 ev("state.space='项目空间';state.folder='全部资料';state.libraryRecursive=false;state.librarySelected=[];render()")
 scope('library','recursive');assert ev('state.libraryRecursive');assert g.locator('[data-directory-scope=library]').is_checked()
 click('range-select-all');selected=ev('JSON.stringify(state.librarySelected)');assert ev('rangeSelectionContext().chosen.length===rangeSelectionContext().all.length');scope('library','direct');assert ev('JSON.stringify(state.librarySelected)')==selected
 g.locator('[data-directory-scope=library]').focus();g.keyboard.press('Space');assert ev('state.libraryRecursive');assert ev('JSON.stringify(state.librarySelected)')==selected
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});ev('render()');g.wait_for_timeout(100)
  r=ev("({w:innerWidth,outer:document.documentElement.scrollWidth,bar:document.querySelector('.range-table-top').getBoundingClientRect().toJSON(),table:document.querySelector('.lib-table-scroll').getBoundingClientRect().toJSON(),all:document.querySelector('[data-action=range-select-all]').getBoundingClientRect().toJSON(),footer:document.querySelector('.lib-pagination').getBoundingClientRect().bottom})")
  assert r['outer']<=w and r['all']['bottom']<=r['table']['top']+1 and r['footer']<=h+1 and r['table']['height']>=100,r;layouts.append(r)
  ev("document.getElementById('toast').classList.remove('show')");g.screenshot(path=str(root/f'review/selection-guidance-library-{w}.png'))
 assert not g.locator('.range-scope-switch').count();assert g.locator('.directory-file-scope').inner_text()=='包含下级文件夹'
 checks.append('资料管理：全部页始终在表格上方；目录下方用“包含下级文件夹”复选框，默认当前文件夹，勾选/键盘切换不丢跨范围选择')
 g.set_viewport_size({'width':1366,'height':768});ev("nav('tool','extract');ws().ids=state.docs.filter(d=>!d.deleted&&!d.local&&libReady(d)&&auditFileAccess(d).analyze).slice(0,51).map(d=>d.id);ws().preview=ws().ids[0];render()")
 assert ev('ws().ids.length')==51
 assert g.locator('.ef-material-intro').inner_text()=='点击“添加资料”选择文件，下方为已选资料。'
 assert g.locator('.ew-materials .ew-scope-note').inner_text().startswith('已选 51 份资料')
 assert g.locator('.ef-template label').inner_text()=='提取模板';assert '可选' not in g.locator('.ef-template').inner_text();assert g.locator('#ef-template-select').input_value()==''
 assert '选择模板载入字段' in g.locator('#ef-template-status').inner_text();assert '添加字段' in g.locator('#ef-template-status').inner_text();assert g.locator('[data-action=run]').is_disabled()
 ev("document.getElementById('toast').classList.remove('show')");g.wait_for_function("document.querySelector('#ef-raw-content')?.dataset.rawReady");g.screenshot(path=str(root/'review/selection-guidance-extract.png'))
 g.locator('#ew-tree-query').fill('合同');assert g.locator('.ew-materials .ew-scope-note').inner_text().startswith('已选 51 份资料 · 匹配');g.locator('#ew-tree-query').fill('')
 assert g.locator('.ew-materials .ew-scope-note').inner_text().startswith('已选 51 份资料')
 checks.append('信息提取：提示直接说明添加与已选，51份底部仅显示数量；查询后恢复简洁计数；模板默认空且明确模板/自定义字段两种入口')
 click('add-tool-materials');ev("modalData.space='项目空间';modalData.folder='全部资料';modalData.recursive=false;modalData.selected=[];paintModal()")
 scope('picker','recursive');assert ev('modalData.recursive');assert g.locator('[data-directory-scope=picker]').is_checked()
 click('picker-all');assert ev('pickerRangeContext().chosen.length===pickerRangeContext().all.length');chosen=ev('JSON.stringify(modalData.selected)');scope('picker','direct');assert ev('JSON.stringify(modalData.selected)')==chosen
 scope('picker','recursive')
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});g.wait_for_timeout(100)
  r=ev("({w:innerWidth,outer:document.documentElement.scrollWidth,table:document.querySelector('.picker-center>.mixed-table').getBoundingClientRect().toJSON(),all:document.querySelector('[data-action=picker-all]').getBoundingClientRect().toJSON(),footer:document.querySelector('.modalfoot').getBoundingClientRect().bottom})")
  assert r['outer']<=w and r['all']['bottom']<=r['table']['top']+1 and r['footer']<=h+1,r
  if w>800:assert r['table']['height']>=125,r
  layouts.append(r);g.screenshot(path=str(root/f'review/selection-guidance-picker-{w}.png'))
 checks.append('添加资料：全部页同样位于表格上方；范围切换保留已选、解析限制与页选；三尺寸含1024×480表格与确认操作可达')
 assert not errors,errors;(root/'review/selection-guidance-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
