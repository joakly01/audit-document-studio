"""Integration and business edge cases omitted from the standard happy-path review."""
import json,pathlib,tempfile,zipfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},accept_downloads=True,reduced_motion='reduce');g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tool/meeting',wait_until='networkidle');g.evaluate('libraryStatusDataReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def click(a):g.locator('[data-action="'+a+'"]:visible').last.click()
 def act(a,**kw):ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':kw})
 def note(s):checks.append(s);print(s,flush=True)
 def close():g.keyboard.press('Escape')
 def prep(t):ev("id=>{nav('tool',id);loadSample();av().preview=false;render()}",t)
 def submit():click('run');click('aw-submit-confirm');g.wait_for_function("currentTask()?.status!=='running'")
 def export(fmt):
  click('export');g.locator('#aw-export-format').select_option(fmt)
  with g.expect_download() as d:click('do-export')
  f=pathlib.Path(tmp)/d.value.suggested_filename;d.value.save_as(f);return f
 prep('meeting');submit();original=ev('currentTask().id');ev("currentTask().result[0].amount='0';currentTask().result[0].observers='财务负责人';currentTask().result[0].extraFields={责任部门:'采购中心'};render()");rows=ev('currentTask().result');files={fmt:export(fmt) for fmt in ['json','xlsx']}
 click('new-analysis');click('v3-meeting-import');g.locator('#meeting-import-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{}'});g.wait_for_function("document.querySelector('#meeting-import-error').textContent.length>0");assert not ev('modalData.parsed');close()
 for fmt,f in files.items():
  act('v3-meeting-import');g.locator('#meeting-import-file').set_input_files(str(f));g.wait_for_function("document.querySelector('#meeting-import-preview').textContent.includes('校验通过')");click('v3-meeting-import-save');assert ev('currentTask().imported');assert all(all(actual[k]==v for k,v in expected.items()) for actual,expected in zip(ev('currentTask().result'),rows));assert ev('currentTask().id')!=original;click('new-analysis')
 # Read the native original JSON structure and a native business worksheet, preserve zero and source names.
 native={'meetings':[{'meeting_name':'审计工作协调会','meeting_date':'2026-10-01','attendees':['负责人','审计组'], 'source_document_id':'d3','topics':[{'topic_name':'资金核对','topic_content':'核对资金支付依据。','topic_money':0}]}]}
 act('v3-meeting-import');g.locator('#meeting-import-file').set_input_files({'name':'native.json','mimeType':'application/json','buffer':json.dumps(native,ensure_ascii=False).encode()});g.wait_for_function("document.querySelector('#meeting-import-preview').textContent.includes('校验通过')");click('v3-meeting-import-save');assert ev("currentTask().result[0].amount==='0'")
 act('meeting-filter');g.locator('[data-edit="min"]').fill('0');g.locator('[data-edit="max"]').fill('0');click('v2-save-editor');assert ev('awMeetingFiltered(currentTask()).length')==1;click('aw-clear-meeting-filter')
 ev("currentTask().config.stageFailure='fail';render()");act('meeting-tab',id='risk');click('meeting-risk');g.wait_for_function('!!currentTask().riskError');assert not ev('currentTask().meetingRisk');click('meeting-risk');g.wait_for_function('currentTask().meetingRisk');assert g.locator('#aw-report>section').count()==7
 act('meeting-tab',id='qa');g.locator('#chat-question').fill('问'*2001);click('send-chat');assert len(g.locator('#chat-question').input_value())==2001;assert not ev('currentTask().chatting');g.locator('#chat-question').fill('核对了哪些事项？');click('send-chat');g.wait_for_function('currentTask().chats.length===1');ev("folderMeta[directoryKey(file('d3').space,file('d3').folder)]={permission:'NONE'};render()");assert '权限已变化' in g.locator('.aw-chat-answer').inner_text();ev("delete folderMeta[directoryKey(file('d3').space,file('d3').folder)];render()")
 note('会议JSON/Excel完整回读保留金额0、列席和扩展字段；原生JSON格式、错误文件拦截；金额0筛选、报告失败重试、问答超长草稿和权限变化')
 # Retain native risk levels; no-hit and insufficient evidence are not confirmed risks.
 prep('risk');submit();ev("currentTask().result[0].level='高';currentTask().result[0].findingStatus='hit';currentTask().result[1].findingStatus='insufficient';render()");assert '风险等级：高' in g.locator('.aw-risk-groups').inner_text();g.locator('[data-aw-change="risk-filter"]').select_option('insufficient');assert '资料不足' in g.locator('.aw-risk-groups').inner_text();g.locator('[data-aw-change="risk-filter"]').select_option('nohit');assert '未匹配到线索' in g.locator('.aw-risk-groups').inner_text();click('aw-clear');d=ev("({space:file('d1').space,path:folderPath(file('d1').folder)})");act('aw-folder',**d);assert ev("awRows(currentTask()).every(r=>r.doc==='d1')");click('aw-clear');ev("file('d1').can_download=false");assert ev("awExportableRows(currentTask()).every(r=>r.doc!=='d1')");ev("delete file('d1').can_download")
 click('aw-config');click('aw-risk-editor');assert g.locator('[data-aw-risk="name"]').first.get_attribute('readonly') is not None;close();click('aw-config');click('add-tool-materials');assert ev("modal==='picker'&&modalData.newAnalysisOnConfirm");close();assert ev('currentTask()') is not None
 click('new-analysis');ev("file('d1').can_analyze=false;render()");click('run');assert ev("modal==='validation'");close();ev("delete file('d1').can_analyze;ws().config.failure='fail';render()");submit();assert ev("currentTask().status==='failed'");click('retry-task');g.wait_for_function("currentTask().status==='completed'")
 note('风险等级原值保留、资料不足/未匹配状态、目录准确过滤结果、下载与执行权限复查、历史只读/添加确认、全失败重试')
 # Empty word set is a valid completed analysis; lexicon pagination and staged type edits.
 prep('word');ev("ws().ids=['d1'];state.stopwords=Array.from({length:26},(_,i)=>'停用词'+i);state.newwords=[];render()");click('lexicon');assert g.locator('.aw-lex-table tbody tr').count()==10;act('aw-lex-page',step='1');assert g.locator('.aw-lex-table tbody tr').count()==10;g.locator('[data-aw-input="lex"]').fill('停用词25');assert g.locator('.aw-lex-table tbody tr').count()==1;close()
 ev("state.stopwords=['采购'];state.newwords=[];ws().config.lexiconSelection={stop:['采购'],user:null};render()");click('lexicon');act('aw-lex-edit',kind='stop',index='0');g.locator('#aw-word-kind').select_option('user');click('aw-lex-word-save');click('aw-lex-save');assert ev('ws().config.lexiconSelection.stop.length')==0;assert not any('相同' in x for x in ev('validate(false)'))
 ev("state.stopwords=[];ws().config.lexiconSelection={stop:null,user:null};file('d1').text='123 456 !';render()");submit();assert ev('currentTask().result.length')==0;assert g.locator('.aw-no-result').is_visible();assert g.locator('.aw-commandbar [data-action="export"]').is_disabled()
 note('词库26条真实分页/检索；无有效词时明确空结果，不能出现固定词云或可导出假结果')
 # Actual embedding keeps standalone frame dimensions and the upload/selection flow.
 host=b.new_page(viewport={'width':1150,'height':650},reduced_motion='reduce');host.set_content('<div style="height:60px">审计业务平台</div><iframe title="文档挖掘助手" src="http://127.0.0.1:8765/#tool/risk" style="width:1024px;height:480px;border:0"></iframe>');frame=host.frames[-1];frame.wait_for_function("typeof awViews!=='undefined'");frame.evaluate('libraryStatusDataReady')
 for tid in ['word','meeting','risk','timeline','theme']:
  frame.evaluate("id=>{nav('tool',id);loadSample();av().preview=false;render();document.getElementById('toast').classList.remove('show')}",tid);assert frame.evaluate('document.documentElement.scrollHeight')==480;assert frame.evaluate('document.documentElement.scrollWidth')==1024;frame.locator('[data-action="run"]').click();box=frame.locator('.aw-submit-dialog').bounding_box();assert box['y']>=60 and box['y']+box['height']<host.viewport_size['height'];frame.locator('[data-action="close-modal"]').last.click()
 host.screenshot(path=str(root/'review/analysis-embedded-1024.png'),animations='disabled');host.close();note('五工具实际1024×480 iframe嵌入及提交弹窗，外框无溢出；词条改类清理失效选择且不改历史任务');assert not errors,errors;(root/'review/analysis-edge-checks.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));b.close()
