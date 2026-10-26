"""All business result routes, lifecycle, merge artifacts, permissions and embedded layout."""
from pathlib import Path
import json,tempfile,zipfile
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1440,'height':900},accept_downloads=True,reduced_motion='reduce');g.set_default_timeout(12000);g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tasks',wait_until='networkidle');g.evaluate('libraryStatusDataReady')
 def ev(s,a=None):return g.evaluate(s,a)
 def act(a,**d):ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def click(a):g.locator('[data-action="'+a+'"]:visible').last.click()
 def close():g.keyboard.press('Escape')
 ev("""() => {state.tasks=[];for(const meta of TOOLS){nav('tool',meta.id);ws().taskId=null;loadSample();const w=ws();if(meta.id==='extract'){w.config.fields=[...meta.fields];w.config.fieldDefs=meta.fields.map(name=>({name,description:'提取'+name}));}const t={id:'test-'+meta.id,toolId:meta.id,name:({extract:'园区改造合同关键字段',word:'财政资料词频统计',meeting:'局务会议议题梳理',theme:'财政支出事项归纳',prepaid:'监理合同费用测算',bidding:'设备采购招投标检查',risk:'专项资金支付风险检查',timeline:'项目审批实施时间轴',contract:'采购合同条款检查',engineering:'项目台账关系核对',association:'资金安排与项目台账关联'})[meta.id],notes:'2026年度专项审计',ids:[...w.ids],config:structuredClone(w.config),status:meta.id==='prepaid'?'awaiting':'completed',progress:100,phase:meta.id==='prepaid'?'待填写计费基数':'分析完成',created:'2026-10-19T01:30:00Z',successIds:[...w.ids],failedIds:[],projects:structuredClone(w.projects),modes:[...w.modes],tableA:w.tableA,tableB:w.tableB,tableAName:w.tableAName,tableBName:w.tableBName,stopwords:['的'],newwords:[],attachments:{},chats:[]};ensureTaskStructure(t);t.result=makeResult(t);state.tasks.push(t);}const clone=(id,status,name)=>{const t=structuredClone(state.tasks.find(t=>t.toolId==='extract'));Object.assign(t,{id,status,name,phase:status==='queued'?'等待开始':status==='running'?'正在按本次配置提取信息':'用户终止任务',progress:status==='running'?36:0,successIds:[],failedIds:[],result:[]});state.tasks.unshift(t);return t;};clone('q','queued','工程批复信息提取');clone('r','running','预算执行资料提取');clone('s','stopped','采购补充资料提取');const f=clone('f','failed','合同资料提取失败');f.failedIds=[...f.ids];f.error='部分资料读取超时，请核对后重试。';const part=structuredClone(state.tasks.find(t=>t.id==='test-extract'));Object.assign(part,{id:'partial',name:'合同字段提取（部分完成）',status:'partial',phase:'部分文件分析失败',successIds:part.ids.slice(0,-1),failedIds:part.ids.slice(-1)});part.result=part.result.filter(r=>part.successIds.includes(r.doc));state.tasks.unshift(part);const theme=structuredClone(state.tasks.find(t=>t.toolId==='theme'));Object.assign(theme,{id:'theme-fail',name:'基础信息已提取，归纳待重试',status:'partial',summaryFailed:true,phase:'基础信息已提取，主题归纳失败'});state.tasks.unshift(theme);nav('tasks');persist();} """)
 assert g.locator('.tc-page').is_visible();assert ev("tcResolve({task_type:10,biz_type:'biddingAnalysis'})")=='bidding';assert ev('tcResolve({task_type:10})') is None;assert ev("tcResolve({task_type:10,biz_type:'prepaidExpenses'})")=='prepaid'
 assert '处理进度待更新' in ev("tcProgress({ids:[],status:'running',progress:null})");assert '整体进度 0%' not in ev("tcProgress({ids:[],status:'running',progress:null})");assert 'aria-valuenow' not in ev("tcProgress({ids:[],status:'running'})")
 checks.append('11种工具独立结果路由；task_type=10依据业务类型区分招投标与待摊费用，未知类型不误开其他结果')
 # Actual row actions open each existing business workspace.
 for tid in ev('TOOLS.map(t=>t.id)'):
  ev("id=>{state.taskTool=id;state.taskStatus='all';state.taskQuery='';tcView.group='all';state.taskPage=1;render()}",tid)
  g.locator('[data-tc-row="test-'+tid+'"] [data-action=tc-open]').last.click();assert ev('state.view')=='tool';assert ev('state.toolId')==tid;assert ev('currentTask().id')=='test-'+tid
  assert g.locator('.ew-results,.aw-center,.result-area,.work-main,.workspace-main,.workbench,.workspace').count()>0
  ev("nav('tasks')");assert ev('state.taskTool')==tid
 checks.append('列表查看结果分别进入11个工具的既有业务页面；返回任务中心保留筛选条件')
 act('tc-reset');act('tc-group',group='attention');assert '基础信息' in g.locator('.tc-table').inner_text();assert '填写计费基数' in g.locator('.tc-table').inner_text();act('tc-info',id='f');assert '读取超时' in g.locator('.tc-info-dialog').inner_text();act('tc-info-tab',tab='sources');assert '分析失败' in g.locator('.tc-info-dialog').inner_text();act('tc-info-tab',tab='config');assert '提取字段' in g.locator('.tc-info-dialog').inner_text();close();act('tc-notes',id='test-extract');g.locator('#tc-notes').fill('合同价款与付款条件核验');click('tc-notes-save');assert ev("state.tasks.find(t=>t.id==='test-extract').notes")=='合同价款与付款条件核验'
 act('tc-stop',id='q');click('tc-stop-confirm');assert ev("state.tasks.find(t=>t.id==='q').status")=='stopped';assert ev("state.tasks.find(t=>t.id==='q').ids.length")>0
 ev("openTask('theme-fail')");act('aw-summary-retry');act('tc-stop',id='theme-fail');click('tc-stop-confirm');g.wait_for_timeout(1000);assert ev("state.tasks.find(t=>t.id==='theme-fail').status")=='stopped';assert ev("tcLabel(state.tasks.find(t=>t.id==='theme-fail'))[0]")=='已终止';assert not ev("tcAttention(state.tasks.find(t=>t.id==='theme-fail'))");ev("nav('tasks')")
 checks.append('排队可终止且保留资料；失败原因、文件分析状态、只读配置与任务备注可查看或修改')
 # All tool types can merge; different fields in extraction form a union, results remain intact.
 ev("tcView.group='all';state.taskTool='extract';render();window.before=JSON.stringify(state.tasks.find(t=>t.id==='test-extract').result);const t=structuredClone(state.tasks.find(t=>t.id==='test-extract'));t.id='extract-other';t.name='付款条件补充提取';t.config.fields=['付款条件'];t.config.fieldDefs=[{name:'付款条件',description:'合同付款约定'}];t.result=t.result.map(r=>({...r,items:[{field_name:'付款条件',extracted:'按合同执行',is_found:true}],values:['按合同执行']}));state.tasks.unshift(t);render()")
 g.locator('[data-tc-check=test-extract]').check();g.locator('[data-tc-check=extract-other]').check();assert ev('taskChecked.length')==2
 assert ev("!tcSelectable(state.tasks.find(t=>t.id==='test-word'))")
 click('merge-export');assert ev("modal==='tc-merge'");assert '付款条件' in g.locator('.tc-mapping-scroll').inner_text();g.locator('[data-tc-format=sql]').check();g.locator('[data-tc-draft=size]').fill('2');g.locator('[data-tc-map=scope]').select_option('export');g.locator('[data-tc-mapping="0"]').fill('source_task');click('tc-merge-submit');g.wait_for_function("state.tasks[0].kind==='merge-export'&&state.tasks[0].status==='completed'");mid=ev('state.tasks[0].id');assert ev("JSON.stringify(state.tasks.find(t=>t.id==='test-extract').result)===before")
 act('tr-download',id=mid);assert '建表.sql' in g.locator('.tc-export-dialog').inner_text()
 with g.expect_download() as d:click('tc-export-zip')
 target=Path(tmp)/'merged.zip';d.value.save_as(target)
 with zipfile.ZipFile(target) as z:
  assert any(n.endswith('.xlsx') for n in z.namelist());sql=next(n for n in z.namelist() if n.endswith('建表.sql'));assert 'source_task' in z.read(sql).decode();excel=next(n for n in z.namelist() if n.endswith('.xlsx'))
  inner=Path(tmp)/'out.xlsx';inner.write_bytes(z.read(excel))
  with zipfile.ZipFile(inner) as x:assert 'xl/worksheets/sheet1.xml' in x.namelist()
 ev("id=>{const t=state.tasks.find(t=>t.id===id);t.expiresAt='2020-01-01T00:00:00Z';paintModal()}",mid);act('tc-artifact',id=mid,index='0');assert '有效期' in g.locator('#toast').inner_text();click('tc-export-refresh');assert ev("id=>new Date(state.tasks.find(t=>t.id===id).expiresAt)>new Date()",mid);ev("id=>{const t=state.tasks.find(t=>t.id===id);t.status='failed';t.error='文件生成中断';paintModal()}",mid);click('tc-export-retry');g.wait_for_function("state.tasks[0].status==='completed'");assert ev('state.tasks[0].retryCount')==1;close();assert ev("tcSelectable(state.tasks.find(t=>t.id==='test-word'))")
 checks.append('跨页同工具合并、不同字段取并集、字段映射与分文件；独立导出任务可下载真实Excel、神通DDL/INSERT及ZIP，保留来源结果；有效期刷新和失败重试')
 # Permission withdrawal rechecked at download, separate from immutable task data.
 ev("id=>{window.mergeTask=state.tasks.find(t=>t.id===id);window.originalTcAccess=auditFileAccess;auditFileAccess=d=>({...originalTcAccess(d),download:false})}",mid);act('tc-result',id=mid);act('tc-export-zip',id=mid);assert '权限' in g.locator('#toast').inner_text();ev('auditFileAccess=originalTcAccess');close()
 checks.append('合并前、提交时、下载时重新核对源资料权限；失权时不能凭旧快照导出')
 # Responsive layout and keyboard-accessible menus, no outer overflow or undersized text.
 act('tc-reset');ev("document.getElementById('toast').classList.remove('show')")
 for w,h in [(1440,900),(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});ev('render()');r=ev("({w:innerWidth,h:innerHeight,outer:document.documentElement.scrollWidth,scroll:document.documentElement.scrollHeight,table:document.querySelector('.tc-table-scroll').getBoundingClientRect().height,header:document.querySelector('.tc-header').getBoundingClientRect().height})");assert r['outer']<=w and r['scroll']==h,r;assert r['table']>=130,r;layouts.append(r)
  ev("document.querySelector('.tc-table-scroll').scrollLeft=9999");assert not g.locator('.tc-row-more').count();g.locator('[data-action=tr-info]').first.click();box=g.locator('.tc-info-dialog,.tc-export-dialog').bounding_box();assert box['y']>=0 and box['x']+box['width']<=w+1,box;g.keyboard.press('Escape');assert not g.locator('.tc-info-dialog,.tc-export-dialog').count();ev("document.querySelector('.tc-table-scroll').scrollLeft=0")
  g.screenshot(path=str(root/f'review/task-center-{w}.png'),animations='disabled')
  act('tc-info',id='theme-fail');box=g.locator('.tc-info-dialog').bounding_box();assert box['y']>=0 and box['y']+box['height']<=h+1;close()
 assert ev("[...document.querySelectorAll('.tc-page [data-icon]')].every(e=>ICON_PATHS[e.dataset.icon]||e.dataset.icon==='more')"),ev("[...document.querySelectorAll('.tc-page [data-icon]')].map(e=>e.dataset.icon).filter(n=>!ICON_PATHS[n])")
 assert not errors,errors
 checks.append('四种尺寸含1024×480嵌入界面，过滤和分页固定、表格内部滚动、操作菜单不被截断、任务信息弹窗可操作')
 (root/'review/task-center-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False));b.close()
