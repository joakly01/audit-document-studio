import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layout=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle')
 assert page.locator('.file-pane .folder-entry').count()>0
 assert page.locator('.file-pane [data-file-id="d2"]').count()==1
 page.locator('.file-pane [data-change="library-page"]').check()
 assert page.evaluate('state.librarySelected')==['d2']
 page.locator('.file-pane [data-action="folder"][data-id="合同资料"]').first.click()
 assert page.locator('.file-pane .folder-entry').count()>=1
 assert page.locator('.file-pane [data-file-id="d1"]').count()==1
 page.locator('.file-pane [data-action="folder"][data-id="合同资料/设备采购"]').first.click()
 page.locator('[data-action="new-folder"]').click();page.locator('#modal-text').fill('补充资料');page.locator('[data-action="create-folder"]').click()
 assert page.evaluate('state.folder')=='合同资料/设备采购/补充资料'
 page.reload();assert page.evaluate("state.directoryNodes.some(x=>x.path==='合同资料/设备采购/补充资料')")
 checks.append('根目录与各层文件/文件夹混排，本页选择只选文件，嵌套空目录刷新保留')
 page.locator('[data-action="space"]').click();page.locator('[data-action="set-space"][data-id="个人空间"]').click()
 page.locator('[data-action="new-folder"]').click();page.locator('#modal-text').fill('补充资料');page.locator('[data-action="create-folder"]').click()
 assert page.evaluate('state.space')=='个人空间'
 assert page.evaluate("state.directoryNodes.some(x=>x.space==='个人空间'&&x.path==='补充资料')")
 checks.append('新建目录保留当前空间、同名目录按路径区分')
 page.goto('http://127.0.0.1:8765/#tool/extract')
 page.locator('.workset-top [data-action="picker"]').click();page.locator('[data-change="picker-space"]').select_option('项目空间')
 page.locator('[data-action="picker-directory"]').click();page.locator('[data-action="v3-range-direct"]').click()
 assert page.evaluate('modalData.selected')==['d2']
 page.locator('[data-action="v3-picker-clear"]').click()
 page.locator('[data-action="picker-directory"]').click();page.locator('[data-action="v3-range-recursive"]').click()
 assert page.evaluate('modalData.selected.length')==17
 page.locator('[data-action="v3-picker-clear"]').click()
 page.locator('.picker-center [data-action="picker-folder"][data-id="会议纪要"]').first.click()
 page.locator('[data-action="picker-directory"]').click();page.locator('[data-action="v3-range-direct"]').click()
 assert page.evaluate('modalData.selected')==['d3']
 page.locator('[data-action="picker-directory"]').click();page.locator('[data-action="v3-range-recursive"]').click()
 assert sorted(page.evaluate('modalData.selected'))==['d3','d4','d5']
 page.locator('.picker-center [data-action="source"]').click();page.keyboard.press('Escape')
 assert page.evaluate("modal==='picker'")
 assert page.evaluate('modalData.selected.length')==3
 assert page.evaluate('modalData.folder')=='会议纪要'
 page.locator('[data-change="picker-space"]').select_option('个人空间')
 page.locator('[data-v3-change="picker-scope"]').select_option('recursive')
 page.locator('[data-change="picker-check"]').check()
 assert page.evaluate('modalData.selected.length')==4
 page.locator('[data-action="confirm-picker"]').click()
 assert page.evaluate('ws().ids.length')==4
 checks.append('本级/递归范围严格区分，预览返回与跨空间选择保留，确认去重')
 assert page.locator('.workset [data-action="preview"][data-id="d5"]').is_visible()
 ids=page.evaluate('ws().ids.slice()')
 page.locator('#work-tree-search').fill('第7次')
 assert page.locator('.workset [data-action="preview"]').count()==1
 assert page.evaluate('ws().ids')==ids
 page.locator('#work-tree-search').fill('不存在的文件')
 assert page.evaluate('ws().ids')==ids
 page.locator('#work-tree-search').fill('')
 page.locator('[data-action="v3-toggle-dir"][data-key="work::项目空间::会议纪要"]').first.click()
 assert not page.locator('.workset [data-action="preview"][data-id="d5"]').count()
 assert page.evaluate('ws().ids')==ids
 page.locator('[data-action="v3-toggle-dir"][data-key="work::项目空间::会议纪要"]').first.click()
 checks.append('多级树展开/收起、资料过滤只影响查看，不改变执行范围')
 page.locator('[data-action="v3-folder-review"][data-path="会议纪要/专题会议"]').click()
 page.locator('[data-action="v3-manage-directory"]').click()
 assert sorted(page.evaluate('manageIds'))==['d4','d5']
 page.locator('[data-action="manage-remove"]').click();assert page.evaluate('ws().ids.length')==2
 page.locator('#undo-toast').click();assert page.evaluate('ws().ids')==ids
 checks.append('按目录管理纳入子级，批量移出可撤销，源文件保留')
 for tid in ['extract','word','theme','timeline','risk','meeting','contract','bidding','prepaid','engineering','association']:
  page.goto('http://127.0.0.1:8765/#tool/'+tid)
  page.evaluate('loadSample()')
  assert page.locator('[data-action="run"]').count()==1
  assert page.locator('.work-commandbar [data-action="run"]').is_visible()
  assert page.evaluate("document.querySelector('.workbench').getBoundingClientRect().top")==56
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),tid
 checks.append('11工具主操作统一右上、仅一个执行按钮、工作区顶端56px')
 page.goto('http://127.0.0.1:8765/#tool/contract');page.locator('[data-config="autoAnalysis"]').check()
 for name in ['合同主体','付款条件','验收约定','违约责任']:page.locator('[data-change="risk-check"][value="'+name+'"]').uncheck()
 assert page.evaluate('validate(false).length')==0
 page.locator('[data-action="run"]').click();page.wait_for_function("currentTask().status==='completed'")
 assert page.evaluate('currentTask().result.length')==1
 assert page.evaluate('currentTask().result[0].autoAnalysis')
 assert page.evaluate('currentTask().configFragment.parameter_settings.button')==1
 checks.append('合同自动分析开关、无规则模式、原参数button及结果快照保留')
 page.goto('http://127.0.0.1:8765/#tool/meeting');page.locator('[data-action="run"]').click();page.wait_for_function("currentTask().status==='completed'")
 page.locator('[data-action="export"]').click();page.locator('#export-format').select_option('json')
 with page.expect_download() as info:page.locator('[data-action="do-export"]').click()
 f=root/'review/v3-meeting-export.json';info.value.save_as(str(f))
 page.locator('[data-action="new-analysis"]').click();page.locator('[data-action="v3-meeting-import"]').click()
 page.locator('#meeting-import-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{}'})
 page.wait_for_function("document.querySelector('#meeting-import-error').textContent.length>0")
 assert page.locator('#meeting-import-error').inner_text()
 page.locator('#meeting-import-file').set_input_files(str(f));page.wait_for_selector('#meeting-import-preview:text("校验通过")')
 page.locator('[data-action="v3-meeting-import-save"]').click()
 assert page.evaluate('currentTask().imported')
 assert page.evaluate('currentTask().result.length')==6
 checks.append('会议结果JSON导出再导入、错误文件阻止、原任务不覆盖')
 for width,height in [(1366,768),(1280,720),(1024,600),(390,844)]:
  page.set_viewport_size({'width':width,'height':height})
  for route in ['library','tasks','templates','tool/extract','tool/bidding','tool/association','tool/meeting']:
   page.goto('http://127.0.0.1:8765/#'+route)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
  page.goto('http://127.0.0.1:8765/#tool/extract')
  m=page.evaluate("({width:innerWidth,height:innerHeight,workTop:document.querySelector('.workbench').getBoundingClientRect().top,run:document.querySelector('[data-action=run]').getBoundingClientRect().toJSON()})")
  assert m['run']['right']<=width and m['run']['bottom']<=height,m
  layout.append(m)
  page.screenshot(path=str(root/('review/v3-workspace-'+str(width)+'.png')),full_page=True,animations='disabled')
 checks.append('1366/1280/1024/390七类页面无整页溢出，主操作在视口内')
 page.set_viewport_size({'width':1366,'height':768});page.goto('http://127.0.0.1:8765/#library');page.screenshot(path=str(root/'review/v3-03-资料管理.png'),full_page=True,animations='disabled')
 page.goto('http://127.0.0.1:8765/#tool/extract');page.locator('.workset-top [data-action="picker"]').click();page.locator('[data-change="picker-space"]').select_option('项目空间');page.screenshot(path=str(root/'review/v3-02-多级选择.png'),full_page=True,animations='disabled')
 b.close()
(root/'review/workspace-v3-results.json').write_text(json.dumps({'checks':checks,'layout':layout,'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'checks':checks,'layout':layout,'errors':errors},ensure_ascii=False));assert not errors
