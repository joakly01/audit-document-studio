"""Keep distinct calculation branches, submission destinations and immutable attachment snapshots."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
root=Path.cwd();errors=[];checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(12000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto(os.environ.get('AUDIT_UI_URL','http://127.0.0.1:8765')+'/#tool/prepaid',wait_until='networkidle');g.wait_for_load_state('load');g.wait_for_function("typeof twBase!=='undefined'");g.evaluate('libraryStatusDataReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def click(a):g.locator('[data-action="'+a+'"]:visible').last.click()
 def act(a,**d):ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 for idx,expected in enumerate([15000,18000,8000,120000,85000,48000]):
  ev("i=>{nav('tool','prepaid');ws().config.feeType=EXPENSE_TYPES[i];loadSample();render()}",idx);click('run');g.locator('#tw-task-name').fill('费用核对-'+str(idx));click('tw-submit-confirm');g.wait_for_function("currentTask()?.status==='awaiting'");assert ev('currentTask().name')=='费用核对-'+str(idx)
  g.locator('#fee-base').fill('0');click('calculate-fee');assert ev("currentTask().status==='awaiting'&&currentTask().fee==null");g.locator('#fee-base').fill('1000000');click('calculate-fee');g.wait_for_function("currentTask()?.status==='completed'");assert ev('currentTask().fee')==expected;assert str(expected) in ev("reportText(currentTask(),'费用计算报告')")
 checks.append('六类费用继续依据各合同的百分比或固定总价计算；无效基数不出报告，名称与约定保留')
 ev("nav('tool','contract');loadSample();render()");g.locator('[data-config=autoAnalysis]').check();g.locator('[data-config=merge]').check();click('run');g.locator('#tw-task-name').fill('采购合同核验');g.locator('#tw-task-notes').fill('重点核对附件与验收');g.locator('#tw-execution').select_option('2');click('tw-submit-confirm');assert ev("state.view==='tasks'");g.wait_for_function("state.tasks[0].status==='completed'");ev('openTask(state.tasks[0].id)');assert ev("currentTask().config.autoAnalysis&&currentTask().config.merge&&currentTask().config.executionMode===2");assert ev('currentTask().name')=='采购合同核验';assert '附件' in ev('currentTask().notes')
 checks.append('合同自动分析、附件合并与备注进入任务快照；可提交后前往任务中心，结果仍为合同检查页面')
 ev("nav('tool','word');loadSample();file('d1').attachments=['d3'];ws().preview='d1';render()");act('attachments',id='d1');g.locator('#modal-root [data-action=source]').first.click();g.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady",timeout=25000);g.keyboard.press('Escape');assert ev("modal==='attachments'");g.keyboard.press('Escape')
 ev("run()");g.wait_for_function("currentTask()?.status==='completed'");ev("file('d1').attachments=['d2'];render()");act('attachments',id='d1');assert '第3次专题会议纪要' in g.locator('#modal-root').inner_text();assert '第1次专题' not in g.locator('#modal-root').inner_text();assert not g.locator('#modal-root [data-action=pick-attachment]').count();assert not g.locator('#modal-root [data-action=unlink-attachment]').count();before=ev("JSON.stringify(file('d1').attachments)");act('unlink-attachment',main='d1',id='d2');assert ev("JSON.stringify(file('d1').attachments)")==before;g.keyboard.press('Escape')
 ev("file('d3').can_preview=false;render()");act('attachments',id='d1');assert not g.locator('#modal-root [data-action=source]').count()
 checks.append('其他工具附件支持关联与原件查看返回；历史显示执行时附件快照，修改入口关闭且直接动作也不能绕过，权限撤销后隐藏原文入口')
 assert not errors,errors
 result={'checks':checks,'errors':errors};(root/'review/tool-business-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
