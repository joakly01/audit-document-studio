"""Business workflow regression for the five shared analysis workspaces."""
import json,pathlib,tempfile,zipfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},accept_downloads=True,reduced_motion='reduce');g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tool/word',wait_until='load');g.wait_for_function("typeof aaBase!=='undefined'");g.evaluate('taskDemoReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def click(a):
  target=g.locator('[data-action="'+a+'"]:visible')
  if not target.count() and g.locator('.uc-command-more>summary:visible').count():g.locator('.uc-command-more>summary:visible').click()
  if not g.locator('[data-action="'+a+'"]:visible').count() and g.locator('.aa-settings:has([data-action="'+a+'"])>summary').count():g.locator('.aa-settings:has([data-action="'+a+'"])>summary').click()
  g.locator('[data-action="'+a+'"]:visible').last.click()
 def act(a,**kw):ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':kw})
 def note(s):checks.append(s);print(s,flush=True)
 def prep(t):ev("id=>{nav('tool',id);ws().taskId=null;loadSample();av().preview=false;av().folder=null;av().query='';av().treeQuery='';av().manage=false;ws().config.failure='none';ws().config.stageFailure='none';render()}",t)
 def submit():click('run');assert ev("modal==='aw-submit'");click('aw-submit-confirm');g.wait_for_function("currentTask()?.status!=='running'")
 def dl(fmt,action='export'):
  click('export' if action in ['download-meeting-risk','save-chat'] else action);g.locator('#aw-export-format').select_option(fmt)
  with g.expect_download() as d:click('do-export')
  target=pathlib.Path(tmp)/d.value.suggested_filename;d.value.save_as(target);assert target.stat().st_size>40;return target
 def close():g.keyboard.press('Escape')
 # Scope management never changes original files; adding files includes upload and folder entrypoints.
 assert g.locator('.tw-preview .ef-empty').is_visible();click('add-tool-materials');assert ev("modal==='picker'");assert '上传' in g.locator('#modal-root').inner_text();close();prep('word');material_count=ev('ws().ids.length');g.locator('[data-action="tw-remove"]').first.click();g.locator('[data-action="tw-remove"]').first.click();assert ev('ws().ids.length')==material_count-2;g.locator('#undo-toast').click();assert ev('ws().ids.length')==material_count-1
 g.locator('#tw-tree-query').fill('不存在');assert ev('ws().ids.length')==material_count-1;g.locator('#tw-tree-query').fill('')
 note('统一资料选择、文件夹/上传入口、逐项移出与撤销、查找不改变分析范围');prep('word')
 # Word-list import staged with independent conflict decisions, CRUD and required validation.
 ev("state.stopwords=['的','采购'];state.newwords=['专项资金'];render()");click('lexicon');act('aw-lex-import',kind='stop');g.locator('#aw-lex-text').fill('专项资金\n采购\n预算安排\n预算安排');click('aw-lex-preview');assert len(ev('modalData.rows.filter(r=>r.issue)'))==3;act('aw-import-decide',line='1',decision='overwrite');click('aw-lex-commit');assert not ev("state.stopwords.includes('预算安排')");click('aw-lex-save');assert ev("state.stopwords.filter(w=>w==='预算安排').length")==1;assert not ev("state.newwords.includes('专项资金')")
 click('lexicon');click('aw-lex-add');g.locator('#aw-word-value').fill('采购');click('aw-lex-word-save');assert '存在' in g.locator('#aw-word-error').inner_text();g.locator('#aw-word-value').fill('履约验收');g.locator('#aw-word-kind').select_option('user');click('aw-lex-word-save');click('aw-lex-save');assert ev("state.newwords.includes('履约验收')")
 click('run');g.locator('#aw-task-name').fill('');click('aw-submit-confirm');assert '名称' in g.locator('#aw-submit-error').inner_text();g.locator('#aw-task-name').fill('词频核验');click('aw-submit-words');act('v2-word-none',kind='stop');click('v2-save-editor');assert ev("modal==='aw-submit'");click('aw-submit-confirm');g.wait_for_function("currentTask()?.status==='completed'");snapshot=ev('JSON.stringify(currentTask().config)');task_id=ev('currentTask().id');words=ev('currentTask().stopwords');assert not words
 assert ev("currentTask().result.every(r=>r.count===Object.values(r.byFile).reduce((a,b)=>a+b,0))")
 g.locator('[data-wr-change="scope"]').select_option('d1');assert ev("awWordRows(currentTask()).every(r=>r.count===r.byFile.d1&&r.docs.length===1)");click('aw-clear');g.locator('[data-action="word-detail"]').first.click();word=ev('modalData.word');click('aw-review');g.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady");click('aw-locate');assert g.locator('.aw-evidence-mark').count()>0;close();assert ev("modal==='aw-word-detail'");click('aw-stop-word');close();assert ev('JSON.stringify(currentTask().config)')==snapshot
 for fmt in ['json','csv','markdown','xlsx']:
  f=dl(fmt)
  if fmt=='json':assert json.loads(f.read_text())['exec_config']['stop_words']==words
  if fmt=='xlsx':
   with zipfile.ZipFile(f) as z:assert 'xl/worksheets/sheet2.xml' in z.namelist()
 with g.expect_download() as d:click('aw-cloud-image')
 f=pathlib.Path(tmp)/'cloud.png';d.value.save_as(f);assert f.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
 act('new-analysis');assert ev('currentTask()') is None;assert ev('w=>ws().config.lexiconSelection.stop.includes(w)',word);assert ev('id=>JSON.stringify(state.tasks.find(t=>t.id===id).config)',task_id)==snapshot
 note('词库增改、导入冲突逐行覆盖、提交前选词；真实词频/文件范围、原文定位、历史词表快照与下次停用；四种明细和PNG导出')
 # Per-stage drafts, cancel/default and personal prompt copies stay independent.
 prep('meeting');old=ev('JSON.stringify(ws().config.stages)');act('aw-prompt',stage='regular');g.locator('#prompt-editor').fill('按会议记录提取决策人。');act('aw-prompt-tab',stage='risk');g.locator('#prompt-editor').fill('核对预算调整与授权。');act('aw-prompt-tab',stage='regular');assert '决策人' in g.locator('#prompt-editor').input_value();close();assert ev("modal==='aw-discard'");click('aw-continue');close();click('aw-discard');assert ev('JSON.stringify(ws().config.stages)')==old
 act('aw-prompt',stage='risk');g.locator('#prompt-editor').fill('只检查预算审批。');click('aw-store-prompt');g.locator('#aw-scheme-name').fill('会议预算核查提示词');click('aw-store-confirm');saved=ev("state.templates.find(t=>t.name==='会议预算核查提示词')");assert saved['toolId']=='meeting' and saved['stage']=='risk' and saved['prompt']=='只检查预算审批。' and 'config' not in saved;click('aw-prompt-save');assert ev('ws().config.stages.risk.content')==saved['prompt'];assert ev('ws().config.stages.regular.content')==json.loads(old)['regular']['content']
 note('独立环节提示词、跨页签草稿、放弃确认、系统原件保留与个人提示词副本，不保存整个工作区配置')
 # Meeting views retain all topic metadata and the original advanced filter editor.
 submit();meeting_id=ev('currentTask().id');meeting_config=ev('JSON.stringify(currentTask().config)');act('aw-meeting-view',id='all');assert g.locator('.aw-meeting-table tbody tr').count()==ev('currentTask().result.length');assert '列席' in g.locator('.aw-meeting-table').inner_text()
 click('meeting-filter');g.locator('[data-edit="from"]').fill('2026-03-01');click('v2-save-editor');assert ev('awMeetingFiltered(currentTask()).every(r=>r.date>="2026-03-01")');g.locator('[data-action="aw-review"]').first.click();idx=ev('modalData.index');assert ev('modalData.analysisTaskId')==meeting_id;assert g.locator('#aw-review-content').is_visible();close();click('aw-clear');click('aw-all-topics');g.locator('[data-aw-change="topics-doc"]').select_option('d3');assert ev("modalData.doc==='d3'");click('aw-topics-reset');
 with g.expect_download() as d:click('aw-export-topics')
 assert d.value.suggested_filename.endswith('.xlsx');g.locator('#modal-root [data-action="aw-review"]').first.click();close();assert ev("modal==='aw-all-topics'");close()
 act('meeting-tab',id='risk');click('aw-risk-prompt');g.locator('#prompt-editor').fill('核验重大决策授权、金额与落实证据。');click('aw-prompt-save');click('meeting-risk');g.wait_for_function('currentTask().meetingRisk');assert g.locator('#aw-report>section').count()==7;assert ev('JSON.stringify(currentTask().config)')==meeting_config
 for fmt in ['docx','json','xlsx','markdown']:
  f=dl(fmt,'download-meeting-risk')
  if fmt=='docx':
   with zipfile.ZipFile(f) as z:assert '七、核查建议' in z.read('word/document.xml').decode()
  if fmt=='json':assert '\n' in json.loads(f.read_text())['report']
 act('meeting-tab',id='qa');g.locator('#chat-question').fill('设备采购预算有哪些调整？');g.locator('#chat-question').press('Enter');g.wait_for_function('currentTask().chats.length===1');assert g.locator('.aw-answer-sources button').count()>0;assert not ev('av().questionDraft');assert json.loads(dl('json','save-chat').read_text())['chats'];click('clear-chat');click('confirm-clear-chat');assert not ev('currentTask().chats.length')
 note('会议/议题/清单视图、人员和金额筛选、全部议题导出与来源返回；七部分报告、独立风险要求、Word/Excel报告；问答发送/来源/保存/清空')
 # Risk point hierarchy, by-risk/by-file and findings/no-hit/insufficient states.
 prep('risk');click('aw-risk-none');assert any('风险点' in x for x in ev('validate(false)'));click('aw-risk-all');click('aw-risk-editor');act('aw-risk-add');last=ev('modalData.nodes.length-1');g.locator('[data-aw-risk="name"]').last.fill('付款授权核查');g.locator('[data-aw-risk="path"]').last.fill('资金管理 / 支付审批');g.locator('[data-aw-risk="description"]').last.fill('核对付款授权与审批依据。');click('aw-risk-save');g.locator('[data-aa-details=advanced]>summary').click();g.locator('[data-config="mode"]').select_option('逐文件检查全部关注点');assert ev('configurationFragment("risk",ws().config).custom_config.parameter_settings.mode')=='byFile';submit();assert g.locator('.aw-risk-items').count()>0;act('aw-risk-group',id='file');assert g.locator('.aw-group-head').count()==3;act('aa-risk-status',status='all');click('aw-collapse-all');assert not g.locator('.aw-risk-items').count();click('aw-expand-all');assert g.locator('.aw-risk-items').count();g.locator('[data-action="aw-review"]').first.click();assert '检查说明' in g.locator('#aw-review-content').inner_text();close();dl('xlsx')
 note('风险点层级、检查说明、全选与有效性校验；两种遍历顺序、按风险点/文件归组、状态筛选与原文证据')
 # Unknown/invalid dates never take the upload date; event details respond after expand-all.
 prep('timeline');assert ev("awCalendarDate('2026年2月30日')")=='';ev("state.docs.push({...structuredClone(file('d1')),id:'aw-undated',name:'事项记录.pdf',ext:'PDF',text:'审批资料已提交，尚未记载事项日期。',date:'2026-09-30',rawAvailable:false});ws().ids.push('aw-undated');render()");submit();assert ev("currentTask().result.find(r=>r.doc==='aw-undated').date")=='';click('aw-expand-all');first=g.locator('[data-action="aw-event"]').first;assert first.get_attribute('aria-expanded')=='true';first.click();assert g.locator('[data-action="aw-event"]').first.get_attribute('aria-expanded')=='false';click('aw-dates');g.locator('#aw-date-from').fill('2026-12-01');g.locator('#aw-date-to').fill('2026-01-01');click('aw-save-dates');assert '晚于' in g.locator('#aw-date-error').inner_text();g.locator('#aw-date-from').fill('2026-01-01');g.locator('#aw-date-to').fill('2026-12-31');click('aw-save-dates');assert '未提取到日期' not in g.locator('.aw-timeline').inner_text();click('aw-clear');act('aw-view',id='table');assert '未提取到日期' in g.locator('.aw-table').inner_text();dl('json')
 note('时间轴真实事项日期、未知/无效日期、日期范围校验、整体/单条展开、列表视图与导出')
 # Summary stage retry keeps successful extraction rows; execution failures/stop retain snapshots.
 prep('theme');ev("ws().config.stageFailure='fail';render()");submit();assert ev('currentTask().summaryFailed');base=ev('JSON.stringify(currentTask().result)');act('aw-view',id='base');assert g.locator('.aw-table tbody tr').count()==3;click('aw-summary-retry');g.wait_for_function('!currentTask().summaryFailed&&!currentTask().summaryGenerating');assert ev('JSON.stringify(currentTask().result)')==base
 act('new-analysis');ev("ws().config.failure='partial';ws().config.stageFailure='none';render()");submit();assert ev("currentTask().status==='partial'");click('retry-task');g.wait_for_function("currentTask().status==='completed'");act('new-analysis');click('run');click('aw-submit-confirm');click('stop-task');click('confirm-stop');assert ev("currentTask().status==='stopped'&&isLocked()");act('new-analysis');click('run');g.locator('#aw-execution').select_option('2');click('aw-submit-confirm');assert ev("state.view==='tasks'");g.wait_for_function("state.tasks[0].status==='completed'");ev('openTask(state.tasks[0].id)');assert g.locator('.aw-center').is_visible()
 note('两阶段主题归纳、仅重试失败归纳；共享部分失败重试、停止只读、任务中心和历史回看')
 ev('id=>openTask(id)',task_id)
 # Reuse completed tasks across tool routes and inspect key layouts at embedded sizes.
 for width,height in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':width,'height':height})
  for tid in ['word','meeting','risk','timeline','theme']:
   ev("id=>{openTask(state.tasks.find(t=>t.toolId===id&&t.status==='completed').id);configExpanded=false;av().tab='main';if(id==='meeting')ws().subtab='regular';render();document.getElementById('toast').classList.remove('show')}",tid)
   g.wait_for_timeout(80);r=ev("({tool:state.toolId,width:innerWidth,scroll:document.documentElement.scrollWidth,center:document.querySelector('.aw-center').clientHeight,header:document.querySelector('.aw-commandbar').clientHeight})");assert r['scroll']<=width,r
   if width>800:assert r['center']>250 and r['header']<=56,r
   assert ev("[...document.querySelectorAll('.aw-workspace [data-icon]')].every(el=>ICON_PATHS[el.dataset.icon]||['more','grip'].includes(el.dataset.icon))")
   layouts.append(r)
   if width==1366:g.screenshot(path=str(root/f'review/analysis-{tid}-1366.png'),animations='disabled')
   if tid!='word':
    if tid not in ['theme','meeting','risk']:click('aw-config')
    act('aw-prompt',stage=ev('PROMPT_STAGES[state.toolId][0][0]'));box=g.locator('.aw-prompt-dialog').bounding_box();assert box['y']>=0 and box['y']+box['height']<=height+1,box
    textarea=g.locator('#prompt-editor').bounding_box();footer=g.locator('.aw-prompt-dialog .modalfoot').bounding_box();assert textarea['y']+textarea['height']<=footer['y']+1,(textarea,footer);close()
    if tid not in ['theme','meeting','risk']:click('aw-config')
   if width==1024:g.screenshot(path=str(root/f'review/analysis-{tid}-1024.png'),animations='disabled')
 note('五工具1366/1024×480/390布局、核心区域和提示词弹窗操作区、全部图标有明确注册')
 assert not errors,errors
 (root/'review/analysis-workflow-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));b.close()
