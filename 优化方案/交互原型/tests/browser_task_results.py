"""Three explicit result operations, all business viewers, immutable configuration and real downloads."""
from pathlib import Path
import re,json,tempfile,zipfile
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[]
seed=re.search(r'ev\("""(.*?)"""\)',(root/'tests/browser_task_center.py').read_text(),re.S).group(1)
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1440,'height':900},accept_downloads=True,reduced_motion='reduce');g.set_default_timeout(10000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tasks',wait_until='load');g.wait_for_function("typeof aaBase!=='undefined'");g.evaluate('taskDemoReady');g.evaluate(seed)
 def ev(s,a=None):return g.evaluate(s,a)
 def act(a,**d):return ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def show(tid):ev("id=>{nav('tasks');tmView.mode='records';state.taskTool=id;tcView.group='all';state.taskPage=1;render()}",tid)
 snapshots=ev('Object.fromEntries(state.tasks.map(t=>[t.id,JSON.stringify(t.config)]))')
 for tid in ev('TOOLS.map(t=>t.id)'):
  show(tid);row=g.locator('[data-tc-row="test-'+tid+'"]');assert row.locator('.tr-action').all_inner_texts()==['查看结果','任务信息','导出数据']
  row.locator('[data-action=tr-result]').click();assert ev('state.toolId')==tid and ev('currentTask().id')=='test-'+tid;assert not ev('trMode()');assert not g.locator('.tr-detail-page').count()
  assert g.locator('.tr-result-only').count()==1;assert not g.locator('.ew-grid>.ew-materials,.workbench>.workset,.ef-mobile-tabs [data-panel=materials]').count()
  show(tid);row=g.locator('[data-tc-row="test-'+tid+'"]');assert row.locator('button').count()==4;assert not row.locator('.tc-actions .icon,.tc-row-more').count();row.locator('[data-action=tr-info]').click();assert ev('modal')=='tc-info';g.locator('[data-action=tc-info-tab][data-tab=config]').click();g.locator('[data-action=tr-config]').click();assert g.locator('.tr-config-page').is_visible();assert ev('isLocked()');assert ev('currentTask().id')=='test-'+tid
  assert not g.locator('.tr-config-page input:not([readonly]):not([disabled]),.tr-config-page textarea:not([readonly]):not([disabled]),.tr-config-page select:not([disabled])').count()
  assert not g.locator('.tr-config-page [data-action=run]').count();assert ev('JSON.stringify(currentTask().config)')==snapshots['test-'+tid]
  if tid=='association':g.locator('[data-action=v2-association]').click();assert ev('modal')=='v2-association';g.keyboard.press('Escape')
  if tid in ['extract','association']:
   g.reload(wait_until='load');g.wait_for_function("typeof thBase!=='undefined'");g.evaluate('taskDemoReady');g.locator('.tr-config-page').wait_for(state='visible');assert ev('currentTask().id')=='test-'+tid
  g.locator('[data-action=tr-sources]').click();assert ev('tcView.infoTab')=='sources';g.keyboard.press('Escape')
  g.locator('.tr-page-head [data-action=tr-download]').click();assert g.locator('.tr-download-page').is_visible();assert ev('currentTask().id')=='test-'+tid
  g.locator('[data-kind=main]').click();assert ev('modal')==('ew-export' if tid=='extract' else 'aw-export' if tid in ['word','meeting','risk','timeline','theme'] else 'export')
  if tid not in ['extract','word','meeting','risk','timeline','theme']:g.locator('#export-format').select_option('xlsx')
  with g.expect_download() as info:g.locator('[data-action=do-export]').click()
  target=Path(tmp)/(tid+'.xlsx');info.value.save_as(target)
  with zipfile.ZipFile(target) as z:
   assert 'xl/worksheets/sheet1.xml' in z.namelist()
   if tid in ['contract','bidding','prepaid','engineering','association']:assert '本次分析配置' in z.read('xl/workbook.xml').decode()
  assert ev('JSON.stringify(currentTask().config)')==snapshots['test-'+tid]
  checks.append(tid+': distinct results, read-only config, scope list and actual Excel')
 # Tool-specific secondary outputs are only downloadable after creation.
 act('tr-download',id='test-meeting');assert g.locator('[data-kind=risk]').is_disabled();assert g.locator('[data-kind=qa]').is_disabled()
 act('tr-result',id='test-meeting');ev('awReportGenerate(currentTask())');g.wait_for_function('currentTask().meetingRisk')
 act('tr-download',id='test-meeting');g.locator('[data-kind=risk]').click();assert g.locator('#aw-export-format').input_value()=='docx'
 with g.expect_download() as info:g.locator('[data-action=do-export]').click()
 report=Path(tmp)/'meeting.docx';info.value.save_as(report)
 with zipfile.ZipFile(report) as z:assert 'word/document.xml' in z.namelist()
 act('tr-download',id='test-word')
 with g.expect_download() as info:g.locator('[data-kind=cloud]').click()
 cloud=Path(tmp)/'cloud';info.value.save_as(cloud);assert cloud.read_bytes().startswith(b'\x89PNG') or b'<svg' in cloud.read_bytes()
 for tid,kind in [('contract','contract'),('prepaid','fee')]:
  act('tr-download',id='test-'+tid)
  if tid=='prepaid':
   assert g.locator('[data-kind=fee]').is_disabled();ev("Object.assign(currentTask(),{base:1000000,fee:12345,status:'completed',billing:{clause:'按照约定费率计算'}});render()")
  with g.expect_download() as info:g.locator('[data-kind='+kind+']').click()
  txt=Path(tmp)/(kind+'.txt');info.value.save_as(txt);assert len(txt.read_text())>50
 checks.append('会议报告Word、词云图片及合同/费用报告真实下载；未生成的报告和问答禁用')
 # States never expose a fictitious downloadable result.
 show('extract')
 for task in ['q','r','f','s']:
  row=g.locator('[data-tc-row='+task+']');assert row.locator('[data-action=tr-result]').is_disabled();assert row.locator('[data-action=tr-download]').is_disabled();assert row.locator('[data-action=tr-info]').is_enabled()
 act('tr-config',id='s');assert ev('isLocked()');g.locator('[data-action=tr-back]').click()
 # Config page does not replace a saved preparation draft.
 ev("nav('tool','extract');ws().config.taskName='保留我的新配置';persist()");act('tr-config',id='test-extract');ev("nav('tool','extract')");assert ev('currentTask()') is None;assert ev('ws().config.taskName')=='保留我的新配置';assert g.locator('.ew-materials').is_visible();assert not g.locator('.tr-result-only').count()
 # Recheck download permission at confirmation, not only while showing the list.
 act('tr-download',id='test-extract');g.locator('[data-kind=main]').click();ev('window.savedTrAccess=auditFileAccess;auditFileAccess=d=>({...savedTrAccess(d),download:false})');act('do-export');assert '权限' in g.locator('#toast').inner_text();ev('auditFileAccess=savedTrAccess');g.keyboard.press('Escape')
 layouts=[]
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});show('all');g.screenshot(path=str(root/f'review/task-results-{w}.png'));metrics=ev("({width:innerWidth,outer:document.documentElement.scrollWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,table:document.querySelector('.tc-table-scroll').clientHeight})");assert metrics['outer']<=w and metrics['scroll']<=h and metrics['table']>150,metrics;layouts.append(metrics)
  act('tr-config',id='test-extract');assert g.locator('.tr-config-page').is_visible();assert ev('document.documentElement.scrollWidth')<=w
  act('tr-download',id='test-extract');assert g.locator('[data-kind=main]').is_visible();assert ev('document.documentElement.scrollWidth')<=w
 assert not errors,errors
 report={'checks':checks,'layouts':layouts,'errors':errors};(root/'review/task-results-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));b.close()
