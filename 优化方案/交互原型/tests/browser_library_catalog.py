import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');page.set_default_timeout(6000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');page.evaluate('localStorage.clear()');page.reload(wait_until='networkidle')
 def ev(s):return page.evaluate(s)
 def note(s):checks.append(s);print(s,flush=True)
 counts=ev("()=>({files:state.docs.filter(d=>d.catalogSeed).length,dirs:state.directoryNodes.length,spaces:Object.fromEntries(SPACE_ORDER.map(s=>[s,state.docs.filter(d=>d.space===s).length])),ids:state.docs.map(d=>d.id)})")
 assert counts['files']>=100 and counts['dirs']>=70,counts
 assert len(counts['ids'])==len(set(counts['ids']))
 assert counts['spaces']['公共空间']>=60 and counts['spaces']['项目空间']>=40 and counts['spaces']['个人空间']>=8
 assert ev("directoryPaths('公共空间').some(p=>p==='山东省审计厅/地方金融报送资料/2025/地方金融机构/财务报表')")
 assert ev("inDirectory('公共空间','山东省审计厅',false).length>=2&&childDirectories('公共空间','山东省审计厅').length>=10")
 assert ev("inDirectory('项目空间','',false).length>=9&&childDirectories('项目空间','').length>=7")
 note('三类空间补充100余份资料、70余目录；多级机构/领域/年度/材料，同层文件和目录混排，ID唯一')
 # An existing browser receives the catalog once, preserving edits and deletion tombstones.
 ev("file('d1').name='设备合同已整理.pdf';file('catalog-20261018-001').name='报送目录已整理.xlsx';file('catalog-20261018-002').deleted=true;state.directoryNodes.push({space:'个人空间',path:'自建审计目录'});persist()")
 size=ev('state.docs.length');page.reload(wait_until='networkidle');assert ev('state.docs.length')==size
 assert ev("file('d1').name")=='设备合同已整理.pdf';assert ev("file('catalog-20261018-001').name")=='报送目录已整理.xlsx';assert ev("file('catalog-20261018-002').deleted")
 assert '自建审计目录' in ev("directoryPaths('个人空间')")
 # Migration marker must also prevent the reappearance of a removed empty branch.
 ev("state.directoryNodes=state.directoryNodes.filter(n=>!(n.space==='公共空间'&&n.path==='山东省审计厅/地方金融报送资料/2025/地方金融组织/财务报表'));persist()")
 page.reload(wait_until='networkidle');assert ev('state.docs.length')==size
 note('刷新不重复造数据，不覆盖已改名称、不恢复已删除文件，已有自建目录与数据保留')
 ev("state.space='项目空间';state.folder='全部资料';state.librarySelected=['d1','d2'];libraryPrefs.showFolders=true;libraryPrefs.showTools=true;render()")
 for w,h in [(1920,1080),(1440,900),(1366,768),(1280,600),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(160)
  data=ev("""()=>{const footer=document.querySelector('.lib-pagination').getBoundingClientRect(),bar=document.querySelector('.lib-toolbar').getBoundingClientRect(),table=document.querySelector('.lib-table-scroll')||document.querySelector('.lib-table').parentElement,folder=document.querySelector('.lib-folders'),tools=document.querySelector('.lib-tools');return{w:innerWidth,h:innerHeight,folder:folder.getBoundingClientRect().width,tools:tools.getBoundingClientRect().width,toolbar:bar.height,footer:footer.height,bottom:footer.bottom,table:table.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth};}""")
  assert data['overflow']==0 and data['toolbar']<=60 and data['bottom']<=h+1,data
  if w>1280:assert data['folder']==240 and data['tools']==260,data
  elif w>1050:assert data['folder']==220 and data['tools']==240,data
  elif w>760:assert data['folder']==190 and data['tools']==210,data
  assert not page.locator('.lib-tools .lib-scope-summary').count()
  text=page.locator('.audit-selection-inline').inner_text();assert all(label in text for label in ['已选文件','解析完成','解析未完成']) and '待处理' not in text
  assert '不代表工具分析进度' in page.locator('.audit-selection-inline').get_attribute('title')
  assert page.locator('.lib-pagination [data-selection-count="total"]').inner_text()=='2'
  assert page.locator('[data-selection-count="ready"]').inner_text()=='2'
  assert page.locator('[data-selection-count="pending"]').inner_text()=='0'
  footer=page.locator('.audit-selection-inline').bounding_box();assert footer['x']>=0 and footer['x']+footer['width']<=w+1,footer
  layouts.append(data);page.screenshot(path=str(root/f'review/library-catalog-{w}.png'),animations='disabled')
 note('六种屏幕下两侧适度加宽、工具箱无选中卡；统计在表格底部，数字突出，操作栏单行，分页不越屏')
 page.set_viewport_size({'width':1366,'height':768});page.locator('.audit-selection-inline').click();assert ev("modal==='library-selected'");assert '设备合同已整理' in page.locator('.modalbody').inner_text();page.keyboard.press('Escape')
 page.locator('.lib-pagination [data-action="library-clear"]').click();assert not ev('state.librarySelected.length');assert not page.locator('[data-selection-count="total"]').count()
 ev("state.space='公共空间';state.folder='山东省审计厅/地方金融报送资料/2025/地方金融机构';state.page=1;render()")
 assert page.locator('.lib-table tr.folder-entry').count()>=1;assert page.locator('.lib-table tr[data-file-id]').count()>=1
 assert not ev('state.libraryAdmin');assert page.locator('[data-action="upload"]').is_disabled()
 page.screenshot(path=str(root/'review/library-catalog-public.png'),animations='disabled')
 ev("state.space='项目空间';state.folder='合同资料/设备采购';state.librarySelected=state.docs.filter(d=>d.catalogSeed&&d.parseError).map(d=>d.id);render()")
 assert page.locator('[data-selection-count="pending"]').inner_text()=='1';assert '解析失败 1' in page.locator('.audit-selection-inline').get_attribute('title')
 note('底栏可打开/清空跨目录清单，异常包含在解析未完成中并有详细原因，公共资料原只读权限保持')
 # Resize preference remains adjustable and survives a refresh, without reseeding the catalog.
 ev("libSetFolderWidth(280);persist();render()")
 assert page.locator('.lib-folders').bounding_box()['width']==280
 page.reload(wait_until='networkidle');page.wait_for_selector('.lib-folders');assert page.locator('.lib-folders').bounding_box()['width']==280
 note('目录宽度仍可调整并保存；增加资料不授予管理员或写权限')
 assert not errors,errors
 (root/'review/library-catalog-results.json').write_text(json.dumps({'checks':checks,'catalog':counts,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
