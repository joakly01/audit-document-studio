"""Simple result headers, business theme wording, two-stage snapshots, native reports and exports."""
from pathlib import Path
import tempfile,json,zipfile
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True);g.set_default_timeout(10000);g.on('pageerror',lambda e:(errors.append(str(e)),print(e.stack,flush=True)));g.goto('http://127.0.0.1:8765/#tool/theme',wait_until='load');g.wait_for_function("typeof thBase!=='undefined'");g.evaluate('taskDemoReady')
 def ev(s):return g.evaluate(s)
 def act(a,**d):return g.evaluate('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def click(a):g.locator('[data-action='+a+']:visible').last.click()
 def close():g.keyboard.press('Escape')
 def result(tid):act('tr-result',id=tid)
 def dl(fmt,scope='all'):
  click('export');g.locator('#aw-export-format').select_option(fmt);g.locator('#aw-export-scope').select_option(scope)
  with g.expect_download() as info:click('do-export')
  path=Path(tmp)/(fmt+str(len(list(Path(tmp).iterdir())))+'.'+fmt);info.value.save_as(path);return path
 assert g.locator('[data-action=run]').inner_text()=='开始归纳';assert '资料要点' in g.locator('.th-config').inner_text();assert '归纳要求' in g.locator('.th-config').inner_text();assert '逐份摘录' in ev('ws().config.stages.extract.content')
 ev('loadSample()');act('aw-prompt',stage='extract');g.locator('#prompt-editor').fill('摘录事项、金额和来源。');act('aw-prompt-tab',stage='summarize');g.locator('#prompt-editor').fill('按采购付款和项目建设归类，标明来源及差异。');click('aw-prompt-save');assert ev('ws().config.stages.extract.content')=='摘录事项、金额和来源。';assert '归类' in ev('ws().config.stages.summarize.content')
 before=ev('JSON.stringify(ws().config.stages)');act('aw-prompt',stage='summarize');g.locator('#prompt-editor').fill('不保存的修改');close();assert ev("modal==='aw-discard'");click('aw-discard');assert ev('JSON.stringify(ws().config.stages)')==before
 click('run');assert g.locator('.modalhead h2').inner_text()=='开始主题归纳';assert g.locator('[data-action=aw-submit-confirm]').inner_text()=='确认归纳';click('aw-submit-confirm');g.wait_for_function("currentTask()?.status==='completed'");tid=ev('currentTask().id');snapshot=ev('JSON.stringify(currentTask().config)');rows=ev('JSON.stringify(currentTask().result)')
 assert g.locator('.aw-command-actions [data-action]').all_inner_texts()==['再次分析','导出'];assert not g.locator('.ew-materials,.workset').count();assert g.locator('.th-topic-card').count()>0
 g.locator('[data-th-change=topic]').select_option('设备采购');assert g.locator('.th-topic-card').count()==1;g.locator('[data-action=aw-review]').first.click();assert '资料要点' in g.locator('#aw-review-content').inner_text();close();click('aw-clear');act('aw-view',id='base');assert g.locator('.th-base-table tbody tr').count()==3;assert '资料要点' in g.locator('.th-base-table thead').inner_text()
 act('tr-download',id=tid);assert '主题汇总与资料要点' in g.locator('.tr-download-card').inner_text();assert '基础信息' not in g.locator('.tr-download-content').inner_text();result(tid)
 checks.append('准备页、要求编辑及提交采用业务表述；两阶段草稿保存/放弃；结果可再次分析或导出；主题筛选、资料要点、原文核对与成果名称')
 # Native report text must render as a report and be included in full exports.
 ev("currentTask().themeSummaryText='```markdown\\n## 采购付款\\n合同与会议均涉及设备采购，应核对预算与付款安排。\\n\\n<script>window.badTheme=true</script>\\n```';render()")
 act('aw-view',id='main');assert g.locator('.th-native-summary h3').inner_text()=='采购付款';assert ev('window.badTheme') is None
 with zipfile.ZipFile(dl('xlsx')) as z:
  book=z.read('xl/workbook.xml').decode();assert '主题汇总' in book and '资料要点' in book and '本次要求' in book
  assert '核对预算' in z.read('xl/worksheets/sheet2.xml').decode()
 full=json.loads(dl('json').read_text());assert '采购付款' in full['theme_summary'];assert len(full['results'])==3;assert 'stages' in full['config']
 filtered=json.loads(dl('json','d1').read_text());assert filtered['theme_summary'] is None;assert len(filtered['results'])==1
 assert '主题汇总' in dl('markdown').read_text();assert '资料要点' in dl('csv').read_text();assert ev('JSON.stringify(currentTask().config)')==snapshot
 # Permissions are rechecked for an aggregate report and at download confirmation.
 ev("window.thAccess=auditFileAccess;auditFileAccess=d=>({...thAccess(d),read:d?.id!=='d2'&&thAccess(d).read,download:d?.id!=='d2'&&thAccess(d).download});render()")
 assert not g.locator('.th-native-summary').count();assert '不可查看' in g.locator('.aw-results').inner_text();restricted=json.loads(dl('json').read_text());assert restricted['theme_summary'] is None;assert all(r['doc']!='d2' for r in restricted['results']);ev('auditFileAccess=thAccess;render()')
 checks.append('原主题Markdown安全展示；Excel/JSON/Markdown保留主题全文，单文件与CSV仅导出要点；聚合权限和历史配置快照')
 # Failed summarization retains extracted rows and retries only the second stage.
 ev("delete currentTask().themeSummaryText;currentTask().summaryFailed=true;currentTask().status='partial';currentTask().phase='归纳阶段失败';av().tab='main';render()")
 assert g.get_by_role('button',name='重试主题汇总',exact=True).count()==1;act('aw-view',id='base');assert g.locator('.th-base-table tbody tr').count()==3;click('aw-summary-retry');g.wait_for_function('!currentTask().summaryGenerating&&!currentTask().summaryFailed');assert ev('JSON.stringify(currentTask().result)')==rows;assert ev('JSON.stringify(currentTask().config)')==snapshot
 # Many themes and rows use bounded pages; switching tasks resets the previous topic selection.
 ev("window.realThemeTask=currentTask();const t=structuredClone(currentTask());t.id='theme-many';t.result=Array.from({length:45},(_,i)=>({...structuredClone(realThemeTask.result[i%3]),topic:'审计事项'+(i%12),excerpt:'第'+i+'条资料要点'}));state.tasks.push(t);openTask(t.id)")
 assert g.locator('.th-topic-card').count()==8;act('th-page',step='1');assert g.locator('.th-topic-card').count()==4;act('aw-view',id='base');assert g.locator('.th-base-table tbody tr').count()==20;g.locator('[data-th-change=topic]').select_option('审计事项2');ev("openTask(realThemeTask.id)");assert ev("!av().themeTopic");assert g.locator('.th-topic-card').count()==2
 checks.append('归纳失败保留要点、单独重试不改写资料；12主题与45条要点分页；跨任务筛选隔离')
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h})
  for tool in ['extract','word','theme']:
   result('demo-task-v1-'+tool+'-0');header=g.locator('.ew-command-actions' if tool=='extract' else '.aw-command-actions');assert header.locator('[data-action]').all_inner_texts()==['再次分析','导出'];assert not g.locator('.ef-mobile-tabs,.ew-materials,.workset').count();assert ev('document.documentElement.scrollWidth')<=w
   if tool=='theme':g.screenshot(path=str(root/f'review/theme-result-{w}.png'));act('aw-view',id='base');assert g.locator('.th-base-table').is_visible()
  ev("nav('tool','theme')")
  if w<=900:act('tw-panel',panel='config')
  assert g.locator('.th-config').is_visible(),(w,ev('tv().panel'),ev('currentTask()?.id'));act('aw-prompt',stage='summarize');box=g.locator('.th-prompt-dialog').bounding_box();assert box['y']>=0 and box['y']+box['height']<=h+1;close();layouts.append({'width':w,'height':h,'requirements':box})
 assert not errors,errors
 report={'checks':checks,'layouts':layouts,'errors':errors};(root/'review/theme-workflow-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));b.close()
