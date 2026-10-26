"""Project ownership, named creation and large bidder lists keep the execution contract."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[];errors=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);q=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');q.set_default_timeout(12000);q.on('pageerror',lambda e:errors.append(str(e)))
 q.goto('http://127.0.0.1:8765/#tool/bidding');q.wait_for_function("typeof bamBase!=='undefined'")
 def ev(s,arg=None):return q.evaluate(s,arg)
 def click(action,attrs=''):q.locator('[data-action="'+action+'"]'+attrs+':visible').first.click()
 def payload():return ev("JSON.stringify(configurationFragment('bidding',ws().config))")
 def entity(action,name,attrs=''):
  click(action,attrs);assert ev('modal')=='bam-entity';q.locator('#bam-entity-name').fill(name);click('bam-save-entity');assert ev('modal') is None
 ev("loadSample();baView.bamOpenUnits={};baView.bamProjectClosed=false;render()")
 initial=payload();scope=ev('JSON.stringify(ws().projects)')
 click('add-project');click('bam-save-entity');assert q.locator('#bam-entity-error').inner_text()=='请填写项目名称';assert payload()==initial
 q.locator('#bam-entity-name').fill('取消创建');click('close-modal');assert payload()==initial and ev('JSON.stringify(ws().projects)')==scope
 entity('add-project','道路提升改造采购项目');pid=ev('baProject().id');assert ev('baProject().bidders.length')==0 and payload()==initial
 click('add-bidder');click('close-modal');assert ev('baProject().bidders.length')==0
 click('bam-edit-project');q.locator('#bam-entity-name').fill('不应保存');click('close-modal');assert ev('baProject().name')=='道路提升改造采购项目'
 click('bam-edit-project');q.locator('#bam-entity-name').evaluate("e=>{window.bamNameNode=e;e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='市政道路改造项目';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'市政道路改造项目'}));}")
 assert ev("document.getElementById('bam-entity-name')===window.bamNameNode")
 q.locator('#bam-entity-name').evaluate("e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:e.value}))")
 q.wait_for_timeout(30);q.locator('#bam-entity-name').press('Enter');assert ev('baProject().name')=='市政道路改造项目'
 checks.append('项目和单位先命名再新增；必填校验、取消无副作用、中文组合输入和回车保存正常')
 click('pick-bid','[data-role="tender"]');assert '市政道路改造项目' in q.locator('.modalhead').inner_text();assert '选择招标文件' in q.locator('.modalhead').inner_text()
 ev("modalData.selected=['d6'];paintModal()");click('confirm-picker');assert ev('baProject().tender')==['d6']
 entity('add-bidder','华信建设有限公司');assert ev('baProject().bidders[0].name')=='华信建设有限公司'
 click('pick-bid','[data-role="bid"]');assert '华信建设有限公司' in q.locator('.modalhead').inner_text();assert '市政道路改造项目' in q.locator('.modalhead').inner_text()
 assert q.locator('[data-action="picker-all"]').count()>0
 ev("modalData.selected=['d7','d8'];paintModal()");click('confirm-picker');assert ev('baProject().bidders[0].files')==['d7','d8']
 assert ev("configurationFragment('bidding',ws().config).projects[1].tender_companies[0].company_name")=='华信建设有限公司'
 before=payload();click('pick-bid','[data-role="tender"]');ev("modalData.selected=['d7'];paintModal()");click('close-modal');assert payload()==before
 click('bam-edit-unit');q.locator('#bam-entity-name').fill('华信市政建设有限公司');click('bam-save-entity');assert ev('baProject().bidders[0].files')==['d7','d8']
 checks.append('文件选择弹窗明确项目和投标单位；招标仍单选替换、投标多选跨页；更换取消保留原关联，重命名保留全部文件')
 # A source selected from the library can still be assigned to a project role.
 ev("ws().unassigned=['d1'];syncBidIds();render()")
 click('assign-bid');q.locator('#assign-role').select_option(pid+':bid:0');click('confirm-assign-bid');assert 'd1' in ev('baProject().bidders[0].files') and ev('ws().unassigned')==[]
 before=payload();click('bam-project','[data-id="'+pid+'"]');assert q.locator('[data-bam-project="'+pid+'"] .bam-project-body').count()==0
 click('bam-project','[data-id="p1"]');assert q.locator('[data-bam-project="p1"] .bam-project-body').count()==1
 click('bam-project','[data-id="'+pid+'"]');assert payload()==before
 unit=q.locator('[data-bam-unit="'+pid+':0"]');unit.locator('summary').click();is_open=unit.evaluate('n=>n.open');ev('render()');assert q.locator('[data-bam-unit="'+pid+':0"]').evaluate('n=>n.open')==is_open
 click('remove-project','[data-id="'+pid+'"]');q.locator('#undo-toast').click();assert payload()==before
 checks.append('项目切换与单位折叠不改变执行范围；待分配资料保留指定归属入口；移除项目可撤销且完整恢复角色')
 # Large fixture keeps unit pagination separate from the project execution scope.
 ev("""()=>{loadSample();baView.bamOpenUnits={};const p=baProject();p.name='办公楼维修改造项目';p.bidders=Array.from({length:27},(_,i)=>({name:'建设单位 '+(i+1),files:['d7','d8']}));ws().projects.push({id:'pending-demo',name:'道路提升改造项目',tender:[],bidders:[]});syncBidIds();baView.unitPage=1;render();}""")
 scaled=payload();assert q.locator('.bam-unit').count()==10
 q.locator('[data-action="ba-unit-page"][data-step="1"]').click();assert '建设单位 11' in q.locator('.bam-units').inner_text();assert payload()==scaled
 q.locator('#ba-unit-query').fill('建设单位 27');assert q.locator('.bam-unit').count()==1 and payload()==scaled
 q.locator('#ba-unit-query').fill('');assert q.locator('.bam-unit').count()==10
 for w,h in [(1366,768),(1024,480),(390,600)]:
  q.set_viewport_size({'width':w,'height':h});ev("baView.panel='materials';render();document.querySelector('#toast').classList.remove('show')")
  assert q.locator('.bam-materials').is_visible();assert q.locator('.bam-materials .ba-panel-head [data-action="add-project"]').is_visible()
  assert ev('document.documentElement.scrollWidth')<=w
  rect=q.locator('.ba-material-scroll').bounding_box();footer=q.locator('.ba-material-footer').bounding_box();assert rect['height']>150 and footer['y']+footer['height']<=h+1,(w,h,rect,footer)
  click('add-project');assert q.locator('#bam-entity-name').is_visible();q.screenshot(path=str(ROOT/'review'/f'bidding-project-name-{w}.png'));click('close-modal');assert payload()==scaled
  ev("document.querySelector('.ba-material-scroll').scrollTop=0")
  q.screenshot(path=str(ROOT/'review'/f'bidding-project-materials-{w}.png'));layouts.append({'width':w,'height':h,'scrollArea':rect,'footer':footer})
 checks.append('27家单位按10家分页、查找只影响展示；三尺寸添加、命名及资料归属层级可见，无横向溢出')
 assert not errors,errors
 (ROOT/'review/bidding-materials-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
print('\n'.join(checks))
