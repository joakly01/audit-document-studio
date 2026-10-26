"""Space prefixes, real directory navigation, and understandable selected-file pagination."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path.cwd();errors=[];checks=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(15000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#library',wait_until='load');g.wait_for_function("typeof wnBase!=='undefined'");g.evaluate('libraryStatusDataReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def act(a,**d):return ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 for space in ['公共空间','项目空间','个人空间']:
  g.locator('[data-lib-change=space]').select_option(space)
  assert g.locator('.audit-location-label').inner_text()=='当前目录'
  crumbs=g.locator('.audit-current-path .folder-crumbs button');labels=crumbs.all_text_contents();assert labels[0]==space,(space,labels)
  if space=='项目空间':assert labels==['项目空间','园区改造项目'],labels
  folder=ev("s=>directoryPaths(s).find(p=>p.includes('/'))||directoryPaths(s)[0]",space)
  assert folder;act('folder',id=folder);labels=crumbs.all_text_contents();assert labels[0]==space and labels[-1]==folder.split('/')[-1],labels
  g.wait_for_timeout(80);prefix=crumbs.first.bounding_box();nav=g.locator('.audit-current-path .folder-crumbs').bounding_box();assert prefix['x']>=nav['x']-1 and prefix['x']+prefix['width']<=nav['x']+nav['width']+1,(prefix,nav)
  title=g.locator('.audit-current-path').get_attribute('title');assert title.startswith('当前目录：'+space) and folder.split('/')[-1] in title,title
  if space=='项目空间':assert '项目空间 / 园区改造项目 / ' in title,title
  # Real breadcrumb links keep existing relative directory IDs.
  parent='/'.join(folder.split('/')[:-1]);target=g.locator('.audit-current-path .folder-crumbs [data-id="'+(parent or '全部资料')+'"]')
  if not target.count():g.locator('[data-action=audit-directory-path]').click();g.locator('.audit-directory-parents [data-id="'+parent+'"]').last.click()
  else:target.last.click()
  assert ev('folderPath(state.folder)')==parent
  g.locator('.audit-current-path .folder-crumbs [data-id="全部资料"]').first.click();assert ev('folderPath(state.folder)')==''
 checks.append('三个空间根目录及下级路径均带空间名称，项目空间同时保留项目名称；当前目录文字/完整路径提示一致，父目录和根目录点击正确')
 ev("nav('templates')");assert g.locator('.audit-location-label').inner_text()=='当前目录'
 ev("nav('tool','extract');ws().ids=state.docs.filter(d=>!d.deleted&&!d.local&&libReady(d)&&auditFileAccess(d).analyze).slice(0,51).map(d=>d.id);ws().preview=ws().ids[0];render()")
 assert ev('ws().ids.length')==51;ids=ev('JSON.stringify(ws().ids)');preview=ev('ws().preview')
 assert g.locator('.ew-file').count()==50;assert g.locator('[data-action=wn-files-prev]').inner_text()=='上一页';assert g.locator('[data-action=wn-files-next]').inner_text()=='下一页'
 assert '本页第 1–50 份' in g.locator('.ew-materials .ew-scope-note').inner_text()
 g.locator('[data-action=wn-files-next]').click();assert g.locator('.ew-file').count()==1;assert '本页第 51 份' in g.locator('.ew-materials .ew-scope-note').inner_text();assert g.locator('[data-action=wn-files-next]').is_disabled();assert ev('JSON.stringify(ws().ids)')==ids;assert ev('ws().preview')==preview
 g.locator('[data-action=wn-files-prev]').click();assert g.locator('.ew-file').count()==50
 g.locator('[aria-label="资料页码"]').fill('2');g.locator('[aria-label="资料页码"]').press('Tab');assert g.locator('.ew-file').count()==1
 g.locator('[data-action=wn-locate]').click();assert g.locator('[aria-label="资料页码"]').input_value()=='1';assert ev('JSON.stringify(ws().ids)')==ids
 checks.append('51份临界场景：文字上一页/下一页、当前页/总页及本页第1–50份/第51份，页码跳转与定位正确，翻页不改变51份已选和当前原文')
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});ev("efView.panel='materials';render();document.getElementById('toast').classList.remove('show')")
  r=ev("({w:innerWidth,outer:document.documentElement.scrollWidth,pager:document.querySelector('.wn-material-pager').getBoundingClientRect().toJSON(),last:document.querySelector('[data-action=wn-locate]').getBoundingClientRect().right,tree:document.querySelector('.ew-tree').getBoundingClientRect().height})")
  assert r['outer']<=w and r['last']<=r['pager']['right']+1 and r['pager']['height']<=48 and r['tree']>=150,r
  layouts.append(r);g.screenshot(path=str(root/f'review/directory-paging-extract-{w}.png'))
 g.set_viewport_size({'width':1366,'height':768});ev("nav('library');state.space='项目空间';state.folder='合同资料/设备采购/技术附件';render()");g.wait_for_timeout(100);g.screenshot(path=str(root/'review/directory-paging-project-path.png'))
 g.wait_for_timeout(100);g.locator('[data-action=audit-directory-path]').click();assert ev("modal==='audit-directory-path'");assert '项目空间 / 园区改造项目 / 合同资料 / 设备采购 / 技术附件' in g.locator('.modalhead').inner_text()
 g.locator('.audit-directory-parents [data-action=folder][data-id="合同资料"]').click();assert ev("modal===null&&state.folder==='合同资料'")
 ev("nav('tool','extract');handleAction('add-tool-materials',{dataset:{}});modalData.space='项目空间';modalData.folder='合同资料';paintModal()")
 assert g.locator('.picker-center .folder-crumbs button').all_text_contents()[:2]==['项目空间','园区改造项目']
 checks.append('1366/1024×480/390分页单行无溢出；资料选择弹窗项目路径也带空间与项目名称')
 assert not errors,errors;(root/'review/directory-paging-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False));b.close()
