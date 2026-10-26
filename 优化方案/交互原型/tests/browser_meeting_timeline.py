"""Meeting timeline hierarchy, cross-meeting trace, shared filters and bounded layouts."""
from pathlib import Path
import json,tempfile
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},accept_downloads=True,reduced_motion='reduce');g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tool/meeting',wait_until='load');g.wait_for_function("typeof mtBase!=='undefined'");g.evaluate('meetingTimelineDemoReady')
 def ev(s):return g.evaluate(s)
 def act(action,**d):return g.evaluate('x=>handleAction(x.a,{dataset:x.d})',{'a':action,'d':d})
 def click(a):g.locator('[data-action='+a+']:visible').first.click()
 ev("handleAction('mt-demo',{dataset:{}})");g.wait_for_selector('.mt-workspace');demo=ev('currentTask().id');snapshot=ev('JSON.stringify(currentTask().config)')
 assert ev("av('meeting').meetingView")=='meetings';assert ev('mtMeetings(currentTask().result).length')==8;assert g.locator('.aa-result-heading .tag').inner_text()=='演示';assert g.locator('.mt-date-group').count()==7
 assert g.locator('.mt-date-head time').all_text_contents()==ev('mtDates(currentTask().result).map(d=>d.date||"日期未提取")');assert '2 次会议' in g.locator('.mt-date-head').nth(2).inner_text();assert g.locator('.mt-agenda-row').count()==3
 click('mt-collapse');assert g.locator('.mt-meeting').count()==0;click('mt-expand');assert g.locator('.mt-meeting').count()==8;assert g.locator('.mt-agenda-row').count()==24
 g.locator('.mt-meeting-head').first.click();assert g.locator('.mt-date-head').first.get_attribute('aria-expanded')=='true';assert g.locator('.mt-agenda-row').count()==21;g.locator('.mt-meeting-head').first.click()
 checks.append('默认会议时间轴；日期、会议独立展开；同日两场独立保留；未知日期单独置后')
 before=ev("awExportableRows(currentTask(),'filtered').length");topic=g.locator('[data-action=mt-topic]').first.get_attribute('data-topic');g.locator('[data-action=mt-topic]').first.click();assert g.locator('.mt-agenda-row.is-match').count()==6;assert g.locator('.mt-detail-card').count()==6;assert ev("awExportableRows(currentTask(),'filtered').length")==before
 ev("document.getElementById('mt-axis-scroll').scrollTop=99999");g.locator('[data-action=mt-topic]').first.click();g.wait_for_timeout(100);assert ev("(()=>{const a=document.getElementById('mt-axis-scroll'),r=document.querySelector('.mt-agenda-row.is-match');return Math.abs(r.getBoundingClientRect().top-a.getBoundingClientRect().top-12)<3})()")
 g.locator('.mt-agenda-row:not(.is-match)').first.click();assert g.locator('.mt-topic-groups>.active').count()==1;assert g.locator('.mt-detail-card.is-focused').count()==1;assert ev('mtState(currentTask()).topic')!=topic;assert g.locator('.mt-detail-head').inner_text().startswith('聚类详情');click('mt-clear-topic');assert g.locator('.mt-detail-head').inner_text().startswith('当前会议')
 checks.append('同类议题跨会议展开/高亮、重复定位、时间轴反选类别与详情；联动不改变筛选导出范围')
 # Shared people filter includes observers; keyword includes topicName and supports safe expressions.
 ev("window.mtDemo=currentTask();const first=currentTask().result[0];window.mtObserver=first.observers.split('、')[0];window.mtExpected=currentTask().result.filter(r=>(r.participants+' '+r.observers).includes(mtObserver)).length;currentTask().meetingFilters={participants:mtObserver,from:'',to:'',min:'',max:'',keywords:'',regex:false};render()")
 assert ev('awMeetingFiltered(currentTask()).length')==ev('mtExpected');assert ev('awMeetingFiltered(currentTask()).length')>0;assert g.locator('.mt-detail-card').count()>0
 ev("currentTask().meetingFilters={participants:'',from:'',to:'',min:'',max:'',keywords:'年度资金计划与支付前提',regex:false};render()")
 assert ev('awMeetingFiltered(currentTask()).length')==1;assert g.locator('.mt-meeting').count()==1
 click('export');g.locator('#aw-export-format').select_option('json');g.locator('#aw-export-scope').select_option('filtered')
 with g.expect_download() as d:click('do-export')
 path=Path(tmp)/d.value.suggested_filename;d.value.save_as(path);data=json.loads(path.read_text());assert len(data['results'])==1;assert data['results'][0]['topicName']=='年度资金计划与支付前提'
 ev("currentTask().meetingFilters={participants:'',from:'',to:'',min:'0',max:'0',keywords:'',regex:false};render()")
 assert ev('awMeetingFiltered(currentTask()).every(r=>parseFloat(r.amount)===0)');act('aw-clear');assert ev('awMeetingFiltered(currentTask()).length')==24
 # A file with two meetings must retain both identities, and visible context shares the same scope.
 ev("av().resultScope='meeting-timeline-demo-doc-v1-03';render()");assert ev('mtMeetings(awMeetingFiltered(currentTask())).length')==2;assert g.locator('.mt-date-group').count()==1;assert '2 次会议' in g.locator('.mt-date-head').inner_text();act('aw-clear')
 checks.append('人员含列席、名称关键词、金额未知不当零处理；筛选/时间轴/类别/详情/导出一致；同文件多会议不合并')
 # Many dates and long meetings are progressively rendered; selecting a late topic crosses pages and reveals its row.
 ev("window.mtLarge=structuredClone(currentTask());mtLarge.id='mt-large-test';mtLarge.demo=false;mtLarge.result=Array.from({length:120},(_,i)=>({...structuredClone(mtDemo.result[i%24]),meetingId:'large-'+Math.floor(i/6),date:'2026-05-'+String(Math.floor(i/6)+1).padStart(2,'0'),title:'第'+Math.floor(i/6)+'次专题会议',topic:'同类事项'+i%13,topicName:'项目议题'+i,extraFields:{责任部门:'项目办公室',要求时限:i===119?'2026-12-31':''}}));mtLarge.result[119].topic='远端跟进事项';state.tasks.push(mtLarge);openTask(mtLarge.id);render()")
 assert g.locator('.mt-date-group').count()==8;assert g.locator('.mt-meeting').count()<=8;assert g.locator('.mt-agenda-row').count()<=10
 act('mt-topic',topic='远端跟进事项');assert ev('mtState(currentTask()).page')==3;assert g.locator('.mt-agenda-row.is-match').count()==1;assert g.locator('.mt-agenda-row.is-match').get_attribute('data-index')=='119';assert '项目议题119' in g.locator('.mt-detail-card').inner_text();assert '2026-12-31' in g.locator('.mt-detail-card').inner_text()
 g.locator('[data-mt-change=order]').select_option('asc');assert ev('mtState(currentTask()).order')=='asc';assert '远端跟进事项' in g.locator('.mt-topic-groups').inner_text();act('mt-collapse');assert g.locator('.mt-meeting').count()==0;act('mt-expand');assert g.locator('.mt-meeting').count()==4
 checks.append('120项议题、20日期分页与渐进显示；选中跨页议题自动展开并定位，完整保留动态字段及议题数量排序')
 # Desktop and small embedded viewports keep navigation, content and source review accessible.
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});act('tr-result',id=demo);act('aw-meeting-view',id='meetings');act('mt-topic',topic='预算调整与资金支付');ev("document.getElementById('toast').classList.remove('show')")
  m=ev("({w:innerWidth,h:innerHeight,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,pane:document.querySelector('.mt-workspace').clientHeight})");assert m['width']<=w and m['height']<=h,m;assert m['pane']>=140,m;layouts.append(m);g.screenshot(path=str(root/f'review/meeting-timeline-trace-{w}.png'))
  if h<=600:
   g.locator('[data-mt-change=topic]').select_option('整改与责任落实');assert ev('mtState(currentTask()).topic')=='整改与责任落实';g.locator('[data-mt-change=topic]').select_option('预算调整与资金支付')
  if w<700:
   assert g.locator('.mt-detail-pane').is_visible();act('mt-pane',pane='timeline');assert g.locator('.mt-axis-pane').is_visible();act('mt-pane',pane='detail')
  assert g.locator('.mt-detail-head').is_visible();assert g.locator('.mt-detail-scroll').bounding_box()['height']>50;g.locator('.mt-detail-card [data-action=aw-review]').first.click();assert g.locator('#aw-review-content').is_visible();assert '责任部门' in g.locator('#aw-review-content').inner_text();g.keyboard.press('Escape');assert g.locator('.mt-detail-head').is_visible()
 assert ev('JSON.stringify(currentTask().config)')==snapshot;assert g.locator('.aw-command-actions [data-action]').all_inner_texts()==['导出'];assert not errors,errors
 checks.append('1366、1024×480、390屏宽无外层溢出；手机切换阅读区；原文详情及完整执行配置保留')
 report={'checks':checks,'layouts':layouts,'errors':errors};(root/'review/meeting-timeline-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));b.close()
