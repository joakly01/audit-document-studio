"""Business exports restore full meeting data and native meeting results remain supported."""
from pathlib import Path
import base64,json,tempfile
from playwright.sync_api import sync_playwright
root=Path.cwd();errors=[];checks=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},accept_downloads=True);g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tool/meeting',wait_until='load');g.wait_for_function("typeof aaBase!=='undefined'");g.evaluate('taskDemoReady')
 def ev(s):return g.evaluate(s)
 def act(a,**d):return g.evaluate('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def click(a):g.locator('[data-action='+a+']:visible').last.click()
 def prep():ev("nav('tool','meeting');ws().taskId=null;render()")
 act('tr-result',id='demo-task-v1-meeting-0');task=ev('currentTask().id');ev("currentTask().result[0].amount='0';currentTask().result[0].observers='财务负责人';currentTask().result[0].extraFields={责任部门:'采购中心'};render()");original=ev('currentTask().result');files={}
 for fmt in ['json','xlsx']:
  click('export');g.locator('#aw-export-format').select_option(fmt)
  with g.expect_download() as info:click('do-export')
  f=Path(tmp)/('meeting.'+fmt);info.value.save_as(f);files[fmt]=f
 prep();click('v3-meeting-import');g.locator('#meeting-import-file').set_input_files({'name':'错误结果.json','mimeType':'application/json','buffer':b'{}'});g.wait_for_function("document.querySelector('#meeting-import-error').textContent.length>0");assert g.locator('[data-action=v3-meeting-import-save]').is_disabled();g.keyboard.press('Escape')
 for fmt,f in files.items():
  prep();click('v3-meeting-import');g.locator('#meeting-import-file').set_input_files(str(f));g.wait_for_function("document.querySelector('#meeting-import-preview').textContent.includes('校验通过')");click('v3-meeting-import-save');assert ev('currentTask().imported');assert ev('currentTask().id')!=task;actual=ev('currentTask().result');assert len(actual)==len(original);assert all(all(row.get(k)==value for k,value in expected.items()) for row,expected in zip(actual,original)),{'format':fmt,'expected':original[0],'actual':actual[0]};act('aw-meeting-view',id='all');assert '责任部门' in g.locator('.aw-meeting-table thead').inner_text();assert '财务负责人' in g.locator('.aw-meeting-table').inner_text();assert g.locator('.aa-business-tabs').is_visible()
 native={'meetings':[{'meeting_name':'项目资金协调会','meeting_date':'2026-10-01','attendees':['审计组','项目负责人'],'source_document_id':'d3','topics':[{'topic_name':'资金审批','topic_content':'核对资金支付审批依据。','topic_money':0}]}]}
 prep();click('v3-meeting-import');g.locator('#meeting-import-file').set_input_files({'name':'原系统结果.json','mimeType':'application/json','buffer':json.dumps(native,ensure_ascii=False).encode()});g.wait_for_function("document.querySelector('#meeting-import-preview').textContent.includes('校验通过')");click('v3-meeting-import-save');assert ev('currentTask().result[0].amount')=='0';assert g.locator('.aa-business-tabs').is_visible()
 # A source document may contain multiple meetings; the workbook must preserve each meeting identity.
 g.evaluate('meetingTimelineDemoReady');act('tr-result',id=ev('MEETING_TIMELINE_DEMO_TASK_ID'));demo_rows=ev('currentTask().result');assert ev('new Set(currentTask().result.map(awMeetingIdentity)).size')==8;assert ev('new Set(currentTask().result.map(r=>r.doc)).size')<8
 click('export');g.locator('#aw-export-format').select_option('xlsx')
 with g.expect_download() as info:click('do-export')
 demo_file=Path(tmp)/'meeting-multiple-per-source.xlsx';info.value.save_as(demo_file)
 workbook=g.evaluate("s=>{const wb=XLSX.read(Uint8Array.from(atob(s),c=>c.charCodeAt(0)),{type:'array'});return {meetings:XLSX.utils.sheet_to_json(wb.Sheets['会议信息'],{header:1,defval:''}),rows:XLSX.utils.sheet_to_json(wb.Sheets['分析明细'],{header:1,defval:''})};}",base64.b64encode(demo_file.read_bytes()).decode());assert len(workbook['meetings'])==9;assert len(workbook['rows'])==len(demo_rows)+1
 prep();click('v3-meeting-import');g.locator('#meeting-import-file').set_input_files(str(demo_file));g.wait_for_function("document.querySelector('#meeting-import-preview').textContent.includes('校验通过')");click('v3-meeting-import-save');assert ev('new Set(currentTask().result.map(awMeetingIdentity)).size')==8;assert len(ev('currentTask().result'))==len(demo_rows);assert not errors,errors
 checks=['JSON和含归档数据的Excel完整导出回读，保留金额0、列席人员、扩展字段与原任务','原系统会议JSON导入及错误文件校验，结果仍可继续风险分析和问答','同一原件内多场会议身份保留：演示Excel含8行会议信息，24项议题完整回读'];report={'checks':checks,'errors':errors};(root/'review/meeting-import-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));b.close()
