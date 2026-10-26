"""Word overview/detail/source/export share a scope; tasks expose exactly three text operations."""
from pathlib import Path
import json,tempfile,zipfile
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True);g.set_default_timeout(10000);g.on('pageerror',lambda e:(errors.append(str(e)),print(e.stack,flush=True)));g.goto('http://127.0.0.1:8765/#tasks',wait_until='load');g.wait_for_function("typeof wrBase!=='undefined'");g.evaluate('taskDemoReady')
 def ev(s):return g.evaluate(s)
 def act(a,**d):return g.evaluate('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def click(a):g.locator('[data-action='+a+']:visible').last.click()
 def close():g.keyboard.press('Escape')
 row=g.locator('[data-tc-row=demo-task-v1-word-0]');assert row.locator('.tc-actions button').all_inner_texts()==['查看结果','任务信息','导出数据'];assert not row.locator('.tc-actions .icon,.tc-row-more').count();row.locator('[data-action=tr-info]').click();assert ev("modal==='tc-info'");act('tc-info-tab',tab='config');assert '停用词' in g.locator('.tc-info-dialog').inner_text();click('tr-config');assert g.locator('.tr-config-page').is_visible();assert not ev('modal');click('tr-back')
 row=g.locator('[data-tc-row=demo-task-v1-word-0]');row.locator('[data-action=tr-result]').click();snapshot=ev('JSON.stringify(currentTask())');assert not g.locator('.ew-materials,.workset').count();assert g.locator('.wr-cloud button').count()==30;assert g.locator('.wr-frequency-table tbody tr').count()==20
 act('wr-word-page',step='1');assert g.locator('.wr-frequency-table tbody tr').count()==10
 g.locator('[data-wr-change=scope]').select_option('d1');g.wait_for_function("av('word').resultPage===1");assert ev("awWordRows(currentTask()).every(r=>r.count===r.byFile.d1&&r.docs.length===1)");assert '统计 1 份资料' in g.locator('.wr-task-name').inner_text()
 g.locator('#aw-result-query').fill('采购');assert ev("awWordRows(currentTask()).every(r=>r.word.includes('采购'))");assert g.locator('.wr-cloud button').count()==1
 click('aw-clear');g.locator('[data-wr-change=top]').fill('9');g.locator('[data-wr-change=top]').dispatch_event('change');assert '10' in g.locator('#wr-top-error').inner_text();assert ev('av().top') is None
 g.locator('[data-wr-change=top]').fill('50');g.locator('[data-wr-change=top]').dispatch_event('change');g.wait_for_function('av().top===50');assert g.locator('.wr-cloud button').count()==50
 g.locator('.wr-cloud [data-action=word-detail]').first.click();word=ev('modalData.word');assert g.locator('.wr-source-table tbody tr').count()>0
 g.locator('.wr-source-table [data-action=aw-review]').first.click();assert g.locator('#aw-review-content').is_visible();click('aw-locate');assert g.locator('.aw-evidence-mark').count()>0;close();assert ev("modal==='aw-word-detail'")
 click('aw-stop-word');assert g.locator('.wr-source-dialog .wr-stop').is_disabled();assert ev('JSON.stringify(currentTask())')==snapshot;close();assert g.locator('.wr-cloud button').count()==50
 # Export current filters with actual xlsx data; the historical task remains immutable.
 g.locator('#aw-result-query').fill('采购');click('export');g.locator('#aw-export-scope').select_option('filtered');g.locator('#aw-export-format').select_option('xlsx')
 with g.expect_download() as d:click('do-export')
 target=Path(tmp)/'filtered.xlsx';d.value.save_as(target)
 with zipfile.ZipFile(target) as z:assert '采购' in z.read('xl/worksheets/sheet1.xml').decode()
 assert ev('JSON.stringify(currentTask())')==snapshot;click('aw-clear')
 checks.append('三个纯文字操作、任务信息与完整配置、词云和分页明细同范围、单文件词频、词语搜索、数量校验、来源核对返回、停用下次生效及真实筛选导出')
 # Large returned results and many source files are bounded in tables and source dialogs.
 ev("""const t=structuredClone(currentTask());t.id='word-large';t.name='专项审计资料词频统计';t.ids=Array.from({length:31},(_,i)=>'wr-file-'+i);for(const id of t.ids)state.docs.push({...structuredClone(file('d1')),id,name:'专项资料'+id+'.txt',type:'TXT',text:'专项资金统筹与采购。'});t.successIds=[...t.ids];t.config.top=500;t.stopwords=[];t.newwords=[];t.result=Array.from({length:500},(_,i)=>({word:'专项词'+i,count:31*(500-i),docs:[...t.ids],byFile:Object.fromEntries(t.ids.map(id=>[id,500-i]))}));state.tasks.push(t);openTask(t.id)""")
 assert g.locator('.wr-frequency-table tbody tr').count()==20;assert g.locator('.wr-cloud button').count()==500
 g.locator('.wr-word-name').first.click();assert g.locator('.wr-source-table tbody tr').count()==10;act('wr-source-page',step='1');assert '2 / 4' in g.locator('.wr-source-dialog .wr-pagination').inner_text();g.locator('#wr-source-query').fill('wr-file-30');assert g.locator('.wr-source-table tbody tr').count()==1;close()
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});act('aw-view',id='both');ev("document.getElementById('toast').classList.remove('show')");assert ev('document.documentElement.scrollWidth')<=w
  if w>=1024:assert g.locator('.wr-word-body').bounding_box()['height']>190
  g.screenshot(path=str(root/f'review/word-result-{w}.png'));act('aw-view',id='frequency');assert not g.locator('.wr-cloud-panel').is_visible();assert g.locator('.wr-frequency-panel').is_visible();g.locator('.wr-word-name').first.click();box=g.locator('.wr-source-dialog').bounding_box();assert box['y']>=0 and box['y']+box['height']<=h+1,(w,box);close();layouts.append({'width':w,'height':h,'sources':box})
 g.locator('#aw-result-query').fill('不存在的词语');assert g.locator('.wr-no-results').is_visible();click('aw-clear');assert g.locator('.wr-word-body').is_visible()
 checks.append('500词明细与31份来源分页、三种视图、无结果恢复、1366/1024×480/390布局')
 assert not errors,errors
 report={'checks':checks,'layouts':layouts,'errors':errors};(root/'review/word-results-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));b.close()
