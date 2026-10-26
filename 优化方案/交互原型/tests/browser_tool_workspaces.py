"""Preparation must preserve distinct business configuration, previews, selection and task contexts."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
root=Path.cwd();errors=[];checks=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},accept_downloads=True,reduced_motion='reduce');g.set_default_timeout(12000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto(os.environ.get('AUDIT_UI_URL','http://127.0.0.1:8765')+'/#tool/word',wait_until='networkidle');g.wait_for_load_state('load');g.wait_for_function("typeof twBase!=='undefined'");g.evaluate('libraryStatusDataReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def act(a,**d):ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def click(a):g.locator('[data-action="'+a+'"]:visible').last.click()
 def prep(t):ev("id=>{nav('tool',id);loadSample();ws().config.failure='none';render()}",t)
 def close():g.keyboard.press('Escape')
 # Dedicated parameters and editors still use the original payload contracts.
 controls={'word':'v2-word-selection','meeting':'aw-prompt','risk':'aw-risk-editor','timeline':'aw-prompt','theme':'aw-prompt','contract':'v2-rules','engineering':'v2-engineering','association':'v2-association','prepaid':'v2-stage','bidding':'v2-stage'}
 for t,action in controls.items():
  prep(t);assert g.locator('.tw-config').is_visible();assert g.locator('.tw-materials').is_visible();assert not g.locator('.tw-config [data-action=nav-templates]').count();assert not g.locator('.tw-workspace .ew-material-table').count()
  snapshot=ev('JSON.stringify(configurationFragment(state.toolId,ws().config))');g.locator('.tw-config [data-action="'+action+'"]').first.click();assert ev('modal') is not None;close();assert ev('JSON.stringify(configurationFragment(state.toolId,ws().config))')==snapshot,(t,'cancel changed configuration')
  for w,h in [(1366,768),(1024,480),(390,600)]:
   g.set_viewport_size({'width':w,'height':h});ev('render()');r=ev("({tool:state.toolId,w:innerWidth,scroll:document.documentElement.scrollWidth,head:document.querySelector('.tw-commandbar').clientHeight,panels:[...document.querySelectorAll('.tw-grid>*')].map(n=>({w:n.clientWidth,h:n.clientHeight}))})");assert r['scroll']<=w,r
   if w>900:assert abs(r['panels'][0]['w']-r['panels'][2]['w'])<=1 and r['panels'][1]['h']>=350 and r['head']<=56,r
   else:
    assert 400<=r['panels'][0]['h']<=500,r
    click('tw-panel') # last tab is configuration
    assert g.locator('.tw-config').is_visible();act('tw-panel',panel='materials')
   layouts.append(r)
  g.set_viewport_size({'width':1366,'height':768});ev('render()');g.wait_for_timeout(700);g.screenshot(path=str(root/f'review/tool-workspace-{t}.png'),animations='disabled')
 checks.append('10项工具三栏对齐，业务配置与编辑取消不变；1366/1024×480/390均无横向溢出，左右等宽，桌面操作栏不超过56px')
 # Native previews and config edits preserve loaded PDF/Word/table sessions.
 for t,fid,kind in [('word','d1','pdf'),('meeting','d3','docx'),('engineering','d10','table')]:
  prep(t);ev("id=>{ws().preview=id;render()}",fid);g.wait_for_function("document.querySelector('#ef-raw-content')?.dataset.rawReady",timeout=25000);assert ev("document.querySelector('#ef-raw-content').dataset.rawReady")==kind
  ev("window.__keptRoot=document.querySelector('#ef-raw-content');window.__keptSession=activeFilePreview;render()")
  assert ev("window.__keptRoot===document.querySelector('#ef-raw-content')&&window.__keptSession===activeFilePreview")
  act('tw-preview-tab',tab='parsed');assert g.locator('#tw-parsed-content').is_visible();act('tw-preview-tab',tab='original');assert g.locator('#ef-raw-content').is_visible()
 checks.append('PDF/Word/Excel原文件与解析文本切换，配置重绘保持原预览节点和会话，不重复加载原件')
 prep('word');ids=ev('ws().ids');g.locator('#tw-tree-query').fill('文件不存在');assert ev('ws().ids')==ids;g.locator('#tw-tree-query').fill('');g.locator('[data-action=tw-remove]').first.click();assert len(ev('ws().ids'))==len(ids)-1;g.locator('#undo-toast').click();assert ev('ws().ids')==ids
 # Shared attachment association must not add the attachment to main scope implicitly.
 prep('word');ev("ws().ids=['d1','d3'];file('d1').attachments=[];render()");act('attachments',id='d1');click('pick-attachment');assert ev("modal==='ef-select-attachments'");g.locator('[data-ea-change=file]').first.check();click('ea-confirm');assert ev("file('d1').attachments")==['d3'];assert ev('ws().ids')==['d1','d3'];close()
 # Ready/type/permission gating with current-page vs all-page selection.
 prep('meeting');click('add-tool-materials');ev("modalData.space='项目空间';modalData.folder='全部资料';modalData.recursive=true;modalData.selected=[];paintModal()");assert g.locator('[data-action=picker-all]').count();act('picker-all');assert ev('modalData.selected.every(id=>libReady(file(id))&&!libEligible(file(id),state.toolId)&&auditFileAccess(file(id)).analyze)');assert g.locator('[data-change=picker-page]').get_attribute('aria-label')=='选择本页可选文件，不含文件夹';close()
 checks.append('查找不改变范围，逐项移出/撤销，附件关联不替换主文件；选择弹窗保留本页/全部页并校验解析状态、类型和分析权限')
 # Bidding grouping lives alongside inline preview without losing project/role operations.
 prep('bidding');click('tw-bid-groups');assert g.locator('[data-action=add-project]').is_visible();old=ev('ws().projects.length');click('add-project');assert ev('ws().projects.length')==old+1;assert g.locator('[data-action=pick-bid]').count();assert g.locator('[data-action=add-bidder]').count();close();ev("ws().projects=ws().projects.slice(0,1);syncBidIds();render()")
 prep('association');assert ev("['A','B'].every(slot=>!!ws()['table'+slot])");click('v2-association');assert g.locator('[data-edit="perRow"]').count();assert g.locator('[data-edit^="locks."]').count()==4;assert g.locator('[data-action=v2-hard-add]').count()==2;close()
 checks.append('招投标新增项目、单位及角色资料仍可管理；两表独立选择、字段映射、批量上限、四项锁定和单字段/组合硬规则保留')
 # Real execution goes through original lifecycle; history vs fresh preparation stays separate for every tool.
 for t in controls:
  prep(t);before=ev('JSON.stringify(configurationFragment(state.toolId,ws().config))');click('run');assert ev('modal')==('aw-submit' if t in ['word','meeting','risk','timeline','theme'] else 'tw-submit');click('aw-submit-confirm' if t in ['word','meeting','risk','timeline','theme'] else 'tw-submit-confirm');g.wait_for_function("currentTask()?.status!=='running'");tid=ev('currentTask().id');assert g.url.endswith('/'+tid),(t,g.url);assert ev('currentTask().configFragment') is not None
  historical=ev('JSON.stringify(currentTask())');ev("newAnalysis();ws().config.taskName='未提交草稿';render()");draft=ev('JSON.stringify({ids:ws().ids,config:ws().config,projects:ws().projects,tableA:ws().tableA,tableB:ws().tableB})');ev('id=>openTask(id)',tid);assert ev('isLocked()');g.reload(wait_until='networkidle');g.wait_for_load_state('load');g.wait_for_function("typeof twBase!=='undefined'");ev('libraryStatusDataReady');assert ev('currentTask().id')==tid
  ev('id=>nav("tool",id)',t);assert ev('currentTask()') is None;assert ev('JSON.stringify({ids:ws().ids,config:ws().config,projects:ws().projects,tableA:ws().tableA,tableB:ws().tableB})')==draft;assert ev('id=>JSON.stringify(state.tasks.find(t=>t.id===id))',tid)==historical
 checks.append('10种工具真实走既有提交、任务进度及专用结果；历史链接刷新正确，默认入口还原未提交草稿，项目/双表/配置快照完整保留')
 assert not errors,errors
 result={'checks':checks,'layouts':layouts,'errors':errors};(root/'review/tool-workspaces-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
