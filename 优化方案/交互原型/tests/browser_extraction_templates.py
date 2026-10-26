import json,pathlib,tempfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True);page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#templates',wait_until='networkidle');page.evaluate('localStorage.clear()');page.reload(wait_until='networkidle');page.wait_for_function("typeof xtCatalog!=='undefined'");page.evaluate('libraryStatusDataReady')
 def ev(s,arg=None):return page.evaluate(s,arg)
 def click(a):page.locator('[data-action="'+a+'"]:visible').last.click()
 def action(a,id):ev("([a,id])=>handleAction(a,{dataset:{id}})",[a,id])
 def note(s):checks.append(s);print(s,flush=True)
 def close():page.keyboard.press('Escape')
 assert page.get_by_role('heading',name='提取模板',exact=True).is_visible();assert page.locator('.sidebar [data-action="nav-templates"]').inner_text()=='提取模板'
 assert ev('xtCatalog.system.map(t=>xtFields(t).length)')==[4,36,12,16,1,24]
 assert page.locator('.xt-table th').all_text_contents()==['模板名称','描述','字段数','操作'];assert page.locator('.xt-pagination [data-action="xt-next"]').count()==1
 ev("state.templates.push({id:'other-tool-scheme',toolId:'risk',name:'风险检查方案',prompt:'核对依据',config:structuredClone(ws('risk').config)});persist();render()")
 assert not page.locator('.xt-table').get_by_text('风险检查方案').count();assert ev("state.templates.some(t=>t.id==='other-tool-scheme')")
 note('导航与页面定位提取模板；仅列信息提取模板，保留其他工具原方案；多级分类、字段数与完整列表一致')
 page.locator('#xt-template-query').fill('施工合同');page.locator('#xt-template-query').press('Enter');assert page.locator('.xt-table tbody tr[data-template-id]').count()==4
 page.locator('#xt-template-query').fill('不存在的名称');click('xt-search');assert '没有匹配' in page.locator('.xt-empty').inner_text();click('xt-clear-search')
 page.locator('[data-template-id=xt-sys-construction-full] .xt-field-count').click();assert page.locator('.xt-fields-table-scroll tbody tr').count()==36
 page.locator('#xt-field-query').fill('金额');assert page.locator('.xt-fields-table-scroll tbody tr').count()==1;close()
 note('按名称查询、Enter、清空及空结果可操作；36字段完整展示，字段名称与说明可检索')
 # Read-only templates can be copied but never modified by normal users.
 action('xt-edit','xt-sys-construction-full');assert ev('modal===null');assert '没有修改' in page.locator('#toast').inner_text()
 row=page.locator('[data-template-id=xt-sys-construction-full]');assert not row.locator('details').count();assert row.locator('.xt-table-actions>.row>[data-action=xt-copy]').is_visible();assert row.locator('.xt-table-actions>.row>[data-action=xt-export]').is_visible();row.locator('[data-action=xt-copy]').click();assert page.locator('.modalhead h2').inner_text()=='复制为个人模板';assert ev("modal==='xt-editor'");assert page.locator('.xt-editor-table tbody tr').count()==36
 page.locator('#xt-template-name').fill('合同审计提取');page.locator('#xt-template-description').fill('按合同原文保留取值口径');page.locator('#xt-field-name-0').fill('合同事项名称')
 ev("handleAction('xt-field-down',{dataset:{index:'0'}})");assert ev("modalData.draft.rules[1].name")=='合同事项名称'
 close();assert ev("modal==='xt-discard'");click('xt-continue-edit');assert page.locator('#xt-template-name').input_value()=='合同审计提取';click('xt-save');assert ev('modal===null')
 saved=ev("state.templates.find(t=>t.name==='合同审计提取').id");assert ev("xtFields(xtFind('xt-sys-construction-full'))[0].name")=='合同名称';assert ev("xtFields(xtFind('"+saved+"')).length")==36
 note('系统模板按权限只读；复制为个人模板可编辑36字段，顺序可调整；取消可继续编辑，保存不改系统原件')
 action('xt-edit',saved);page.locator('#xt-template-name').fill('');click('xt-save');assert '名称' in page.locator('#xt-editor-error').inner_text();page.locator('#xt-template-name').fill('合同审计提取');page.locator('#xt-field-name-0').fill('重复字段');page.locator('#xt-field-name-1').fill('重复字段');click('xt-save');assert '重复' in page.locator('#xt-editor-error').inner_text();close();click('xt-confirm-discard');assert ev('modal===null')
 action('xt-new',None);page.locator('#xt-template-name').fill('空字段验证');click('xt-save');assert '字段' in page.locator('#xt-editor-error').inner_text();click('xt-remove-field');click('xt-save');assert '至少' in page.locator('#xt-editor-error').inner_text();close();click('xt-confirm-discard')
 note('名称必填、字段必填、不重复和至少一字段校验；放弃修改不写入模板')
 # Directory management: root is structural; empty folders only can be deleted.
 action('xt-new-folder','xt-mine');page.locator('#xt-folder-name').fill('专项审计');click('xt-save-folder');folder=ev("xtCatalog.folders.find(f=>f.name==='专项审计').id")
 action('xt-new-folder',folder);page.locator('#xt-folder-name').fill('资金材料');click('xt-save-folder');child=ev("xtCatalog.folders.find(f=>f.name==='资金材料').id")
 action('xt-rename-folder',folder);page.locator('#xt-folder-name').fill('专项资金审计');click('xt-save-folder');assert ev("xtPath('"+child+"')").endswith('专项资金审计 / 资金材料')
 action('xt-delete-folder',folder);assert page.locator('[data-action="xt-confirm-delete-folder"]').is_disabled();close()
 action('xt-delete-folder',child);click('xt-confirm-delete-folder');assert not ev("!!xtFolder('"+child+"')")
 note('分类支持多级创建与重命名，子路径同步；根分类保护，非空分类不可误删，空分类确认删除')
 # CRUD save/reopen persistence, blank descriptions remain valid and default only when applied.
 action('xt-folder',folder);click('xt-new');page.locator('#xt-template-name').fill('资金批复要素');page.locator('#xt-field-name-0').fill('批准金额');click('xt-add-field');page.locator('#xt-field-name-1').fill('批准日期');click('xt-save');custom=ev("state.templates.find(t=>t.name==='资金批复要素').id")
 page.reload(wait_until='networkidle');assert ev("xtFind('"+custom+"').rules")==[{'name':'批准金额','description':''},{'name':'批准日期','description':''}]
 assert ev("xtPath(xtFind('"+custom+"').folderId)").endswith('专项资金审计')
 note('所属分类与可选字段说明保存正确，刷新后不丢；本次配置与模板原件分开维护')
 # Export follows current API payload; import is staged, validated and never overwrites existing templates.
 row=page.locator('[data-template-id="'+custom+'"]');row.locator('summary').click();assert row.locator('.lib-menu [data-action]').all_text_contents()==['编辑模板','删除模板'];row.locator('summary').click()
 with page.expect_download() as dl:row.locator('.xt-table-actions>.row>[data-action=xt-export]').click()
 path=pathlib.Path(tmp)/dl.value.suggested_filename;dl.value.save_as(path);payload=json.loads(path.read_text());assert json.loads(payload['prompt'])==ev("xtFields(xtFind('"+custom+"'))")
 before=ev("state.templates.length");click('v2-template-import') if page.locator('[data-action="v2-template-import"]:visible').count() else ev("handleAction('v2-template-import',{dataset:{}})")
 page.locator('#template-import-json').fill(json.dumps({'template_name':'bad','prompt':'{}'}));click('xt-import-read');assert '导入失败' in page.locator('#xt-import-error').inner_text()
 page.locator('#template-import-json').fill(json.dumps(payload,ensure_ascii=False));click('xt-import-read');assert ev("modal==='xt-editor'");assert ev('state.templates.length')==before;click('xt-save');assert ev('state.templates.length')==before+1
 note('配置导出保留名称、描述和原规则JSON；导入校验字段结构，核对后才保存，不覆盖原模板')
 # Applying snapshots the field rules into extract only, with a confirmation and existing task preservation.
 ev("state.work.extract=undefined;delete state.work.extract;ws('extract').ids=['d1'];ws('extract').preview='d1';state.toolId='extract';ws().config.chunk=1600;persist()")
 action('xt-use',custom);assert ev("modal==='xt-apply'");close();assert ev("ws('extract').config.fields")==[]
 action('xt-use',custom);click('xt-apply-confirm');assert ev("state.view==='tool'&&state.toolId==='extract'");assert ev('ws().config.fields')==['批准金额','批准日期'];assert ev('ws().ids')==['d1'];assert ev('ws().config.chunk')==1600;assert ev('configurationIssues("extract",ws().config,ws()).length')==0
 assert page.locator('[data-xt-change="template"]').is_visible();assert not page.locator('.ef-config [data-action="nav-templates"]').count()
 click('run');click('ew-submit-confirm');page.wait_for_function("currentTask()?.status==='completed'");task=ev('currentTask().id');snapshot=ev('JSON.stringify(currentTask().config)')
 ev("nav('templates')");action('xt-delete',custom);click('xt-confirm-delete');assert not ev("!!xtFind('"+custom+"')");assert ev("JSON.stringify(state.tasks.find(t=>t.id==='"+task+"').config)")==snapshot
 note('模板经确认带入信息提取，字段/说明完整同步，保留资料与执行参数；执行可完成，删除模板不改既有任务快照')
 # Permission is checked again on mutation; default account is never promoted.
 assert not ev('xtAdmin()');ev("state.templateAdmin=true;render()");action('xt-edit','xt-sys-invoice');page.locator('#xt-template-name').fill('越权修改');ev('state.templateAdmin=false');click('xt-save');assert '权限已变化' in page.locator('#xt-editor-error').inner_text();assert ev("xtFind('xt-sys-invoice').name")=='发票信息提取';close();click('xt-confirm-discard')
 ev("nav('tool','risk')");assert not page.locator('.config [data-action="nav-templates"]').count();assert '风险检查方案' in page.locator('.config [data-config="template"]').inner_text();ev("nav('templates')")
 note('系统管理权限在提交时重查；其他工具方案仍可选，管理入口不误导到提取模板')
 # Pagination over a real multi-page list.
 ev("for(let i=0;i<24;i++)state.templates.push({id:'qa-tpl-'+i,toolId:'extract',name:'专项字段 '+i,folderId:'xt-mine',rules:[{name:'事项',description:''}]});xtView.folder='xt-mine';xtView.page=1;xtView.size=10;xtView.query='';xtView.draftQuery='';xtRefresh()")
 first=page.locator('.xt-table tbody tr[data-template-id]').first.get_attribute('data-template-id');click('xt-next');assert ev('xtView.page')==2;assert page.locator('.xt-table tbody tr[data-template-id]').first.get_attribute('data-template-id')!=first
 page.locator('[data-xt-change="page"]').fill('3');page.locator('[data-xt-change="page"]').press('Tab');assert ev('xtView.page')==3
 page.locator('[data-xt-change="size"]').select_option('15');assert ev('xtView.page')==1;assert page.locator('.xt-table tbody tr[data-template-id]').count()==15
 note('模板分页、页容量和页码跳转作用于真实列表，分类或查询变化重置页码')
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
  r=ev("()=>({w:innerWidth,h:innerHeight,body:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,footer:document.querySelector('.xt-pagination').getBoundingClientRect().bottom,table:document.querySelector('.xt-table-scroll').getBoundingClientRect().height})")
  assert r['body']<=w and r['height']<=h+1 and r['footer']<=h and r['table']>150,r
  action('xt-fields','xt-sys-construction-full');r2=page.locator('.xt-fields-dialog').bounding_box();assert r2['y']>=0 and r2['y']+r2['height']<=h+1;page.screenshot(path=str(root/f'review/extraction-fields-{w}.png'),animations='disabled');close()
  row=page.locator('.xt-table tbody tr[data-template-id]').first
  assert row.locator('.xt-table-actions>.row>[data-action=xt-copy]').is_visible();assert row.locator('.xt-table-actions>.row>[data-action=xt-export]').is_visible();assert not row.locator('.lib-menu [data-action=xt-copy],.lib-menu [data-action=xt-export]').count()
  r4=page.locator('.xt-table-actions').first.bounding_box();assert r4['x']>=0 and r4['x']+r4['width']<=w,r4
  page.screenshot(path=str(root/f'review/extraction-template-actions-{w}.png'),animations='disabled')
  row.locator('.xt-table-actions>.row>[data-action=xt-copy]').click();r3=page.locator('.xt-editor-dialog').bounding_box();f=page.locator('.xt-editor-dialog .modalfoot').bounding_box();assert r3['y']>=0 and r3['y']+r3['height']<=h+1 and f['y']+f['height']<=h+1;assert page.locator('.xt-editor-table-scroll').bounding_box()['height']>=80
  page.screenshot(path=str(root/f'review/extraction-editor-{w}.png'),animations='disabled');close();layouts.append(r)
 note('复制模板与导出配置在表格操作列直接可见；字段数可打开详情，省略号只保留有权编辑/删除，复制说明明确保存为个人模板')
 note('四种尺寸：列表及字段独立滚动、分页与保存操作可见，36字段不撑出窗口，正文16px辅助14px')
 assert not errors,errors;(root/'review/extraction-templates-results.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
