"""Business records and monitoring share records but preserve separate actions and truthful runtime data."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[];layouts=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.set_default_timeout(12000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tasks',wait_until='load');g.wait_for_function("typeof tmBase!=='undefined'");g.evaluate('libraryStatusDataReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def act(a,**d):ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def close():g.keyboard.press('Escape')
 ev("""()=>{nav('tool','extract');loadSample();const w=ws();w.config.fieldDefs=[{name:'合同金额',description:'提取合同金额'}];const now=Date.now();const make=(id,status,extra={})=>({id,name:({q:'工程批复信息提取',r:'预算执行资料提取',stale:'采购合同关键字段提取',f:'资金拨付资料提取',done:'项目建设资料提取',await:'监理费用测算'})[id]||'审计资料提取 '+id,toolId:'extract',ids:['d1','d3'],config:structuredClone(w.config),status,created:new Date(now-3600000).toISOString(),progress:status==='running'?36:status==='completed'?100:null,successIds:status==='completed'?['d1','d3']:['d1'],failedIds:status==='failed'?['d3']:[],result:[],phase:status==='running'?'正在提取合同字段':'',...extra});state.tasks=[make('q','queued'),make('r','running',{startedAt:new Date(now-240000).toISOString(),lastProgressAt:new Date(now-10000).toISOString()}),make('stale','running',{startedAt:new Date(now-3600000).toISOString(),lastProgressAt:new Date(now-1200000).toISOString()}),make('f','failed',{error:'资料读取超时，请重试失败文件',lastProgressAt:new Date(now-60000).toISOString()}),make('done','completed'),make('await','awaiting',{toolId:'prepaid'}),...Array.from({length:15},(_,i)=>make('more-'+i,'queued'))];state.tasks.find(t=>t.id==='done').result=makeResult(state.tasks.find(t=>t.id==='done'));nav('tasks');tcView.size=10;render();}""")
 assert ev('tmView.mode')=='records';assert g.locator('.tc-table th').all_inner_texts()[4]=='分析成果'
 act('tc-open',id='r');assert ev('modal')=='tc-info';assert g.locator('.modalhead h2').inner_text()=='运行详情';assert not g.locator('[data-action=tc-result]').count();assert g.locator('.tc-info-dialog [data-action=tc-stop]').is_visible();close()
 ev("taskChecked=['done'];render()");act('tm-mode',mode='monitor');assert not g.locator('[data-tc-check]').count();assert not g.locator('[data-action=merge-export]').count();assert ev('taskChecked')==['done'];assert g.locator('[data-tc-row=r] .tc-actions button').all_inner_texts()==['查看结果','任务信息','导出数据'];assert not g.locator('.tc-actions .icon,.tc-row-more').count();assert '分析成果' not in g.locator('.tc-table thead').inner_text()
 assert '等待调度' in g.locator('[data-tc-row=q]').inner_text();assert '预计' not in g.locator('[data-tc-row=q]').inner_text();assert not g.locator('[data-tc-row=q] [role=progressbar]').count()
 act('tc-page',step='1');assert ev('state.taskPage')==2;assert len(g.locator('[data-tc-row]').all())==8
 act('tm-group',group='attention');assert set(ev("[...document.querySelectorAll('[data-tc-row]')].map(n=>n.dataset.tcRow)"))=={'stale','f'};assert '不代表任务已失败' in g.locator('[data-tc-row=stale]').inner_text();assert ev("state.tasks.find(t=>t.id==='stale').status")=='running'
 act('tm-info',id='f');assert '读取超时' in g.locator('.tc-info-dialog').inner_text();act('tc-info-tab',tab='sources');assert '分析失败' in g.locator('.tc-info-dialog').inner_text();act('tc-info-tab',tab='config');assert '提取字段' in g.locator('.tc-info-dialog').inner_text();close()
 checks.append('分析记录保留结果入口；运行监控独立显示排队、执行与异常，运行详情保留文件状态和只读配置，等待业务填写不误报故障')
 act('tm-group',group='queued');ev("Object.assign(state.tasks.find(t=>t.id==='q'),{queuePosition:3,estimatedWaitSeconds:180});render()");assert '前方 3 项任务' in g.locator('[data-tc-row=q]').inner_text();assert '预计等待 3分钟' in g.locator('[data-tc-row=q]').inner_text()
 ev("Object.assign(state.tasks.find(t=>t.id==='q'),{queuePosition:null,estimatedWaitSeconds:null});render()");assert '预计等待' not in g.locator('[data-tc-row=q]').inner_text()
 act('tm-info',id='q');act('tc-stop',id='q');act('tc-stop-confirm',id='q');assert ev("state.tasks.find(t=>t.id==='q').status")=='stopped';assert ev("state.tasks.find(t=>t.id==='q').ids.length")==2
 checks.append('未知排位、预计时间与更新时间不补造；仅真实进度更新时间超过10分钟提示待确认，不改变任务状态；排队终止保留输入')
 act('tm-mode',mode='records');assert g.locator('[data-action=merge-export]').is_visible();assert ev('taskChecked')==['done'];act('tc-open',id='done');assert ev('state.view')=='tool';assert ev('currentTask().id')=='done';ev("nav('tasks')");act('tm-mode',mode='monitor');act('tm-group',group='all')
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});ev('render()');r=ev("({w:innerWidth,h:innerHeight,outer:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,table:document.querySelector('.tc-table-scroll').clientHeight,footer:document.querySelector('.tc-pagination').getBoundingClientRect().bottom})");assert r['outer']<=w and r['height']==h and r['table']>=130 and r['footer']<=h,r;layouts.append(r)
  g.screenshot(path=str(root/f'review/task-monitor-{w}.png'))
 checks.append('切换视图保留合并选择；结果仍进入原业务工具；1366、1024×480、390布局内滚动，分页与切换入口可达')
 # Real local task ticks update an open monitoring dialog and reveal results on completion.
 ev("nav('tool','extract');loadSample();ws().config.failure='none';ws().config.fields=['合同金额'];ws().config.fieldDefs=[{name:'合同金额',description:'提取金额'}];render()")
 act('run');act('ew-submit-confirm');tid=ev('currentTask().id');ev("nav('tasks')");act('tm-info',id=tid)
 assert ev("id=>!!state.tasks.find(t=>t.id===id).startedAt",tid)
 g.wait_for_function("id=>state.tasks.find(t=>t.id===id).status==='completed'",arg=tid)
 assert g.locator('.tc-info-dialog [data-action=tc-result]').inner_text()=='去工具查看结果';assert not g.locator('.tc-info-dialog [data-action=tc-stop]').count()
 assert ev("id=>!!state.tasks.find(t=>t.id===id).completed",tid)
 before=ev("id=>state.tasks.find(t=>t.id===id).lastProgressAt",tid);close();act('tc-refresh');assert ev("id=>state.tasks.find(t=>t.id===id).lastProgressAt",tid)==before
 checks.append('实际执行时持续更新已打开的运行详情，结束后显示结果入口；记录本地真实执行时间，手动刷新不伪造进展')
 assert not errors,errors;(root/'review/task-monitor-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False));b.close()
