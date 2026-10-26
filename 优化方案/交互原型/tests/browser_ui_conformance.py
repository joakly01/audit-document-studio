"""Current UI baseline: shared pages + all tools, preparation/results, constrained width and keyboard overflow."""
import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];records=[];checks=[];errors=[]
METRICS=r'''() => {const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>1&&r.height>1&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[hidden],.xt-sr-only')};const texts=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));const selector=e=>e.tagName.toLowerCase()+'.'+String(e.className?.baseVal??e.className).split(' ').slice(0,3).join('.');const bar=document.querySelector('.ew-commandbar,.work-commandbar'),buttons=bar?[...bar.querySelectorAll('.btn')].filter(e=>visible(e)&&!e.closest('.uc-command-menu')):[];return {view:state.view,tool:state.toolId,width:innerWidth,height:innerHeight,outerWidth:document.documentElement.scrollWidth,small:texts.filter(e=>parseFloat(getComputedStyle(e).fontSize)<14).map(e=>({selector:selector(e),text:e.textContent.slice(0,40),px:getComputedStyle(e).fontSize})),command:bar?{height:bar.getBoundingClientRect().height,buttons:buttons.map(e=>({text:e.textContent.trim(),font:parseFloat(getComputedStyle(e).fontSize),height:e.getBoundingClientRect().height,cy:(e.getBoundingClientRect().top+e.getBoundingClientRect().bottom)/2,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})),more:!!bar.querySelector('.uc-command-more:not([hidden])')}:null};}'''
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');g.wait_for_function("typeof ucBars!=='undefined'");g.evaluate('libraryStatusDataReady');ids=g.evaluate('TOOLS.map(t=>t.id)')
 def ev(s,a=None):return g.evaluate(s,a)
 def inspect(stage):
  g.wait_for_timeout(40);r=ev(METRICS);r['stage']=stage;assert not r['small'],r;assert r['outerWidth']<=r['width'],r
  if r['command']:
   c=r['command'];assert c['height']<=56,c
   for x in c['buttons']:assert x['font']>=16 and x['height']>=36 and x['left']>=0 and x['right']<=r['width']+1,x
   assert max(x['cy'] for x in c['buttons'])-min(x['cy'] for x in c['buttons'])<2,c
  records.append(r)
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h})
  for route in ['library','tasks','templates']+[f'tool/{id}' for id in ids]:
   ev("r=>{const [v,id]=r.split('/');nav(v,id);if(v==='tool')loadSample();render()}",route);inspect('preparation')
 checks.append('资料管理/任务/提取模板及11工具，三种尺寸共42个准备状态：可见业务文字≥14px、主命令16px且≥36px、操作单行、无整页横向溢出')
 # Run all tools using their own existing driver, then test result command overflow.
 g.set_viewport_size({'width':1366,'height':768})
 for id in ids:
  print('结果布局',id,flush=True)
  ev("id=>{nav('tool',id);loadSample();if(id==='extract'){openModal('xt-apply',{id:'sys-extract'});xtApply();}run()}",id);g.wait_for_function("currentTask()&&currentTask().status!=='running'")
  for w,h in [(1024,480),(390,600)]:g.set_viewport_size({'width':w,'height':h});inspect('result')
 # Native nodes are moved rather than duplicated; resize restores them and their commands.
 ev("openTask(state.tasks.find(t=>t.toolId==='word').id);render()");task=ev('currentTask().id');g.set_viewport_size({'width':390,'height':600});g.wait_for_timeout(100);more=g.locator('.uc-command-more:not([hidden])');assert more.count()==1;summary=more.locator('summary');summary.focus();g.keyboard.press('ArrowDown');assert more.get_attribute('open') is not None;assert ev("document.activeElement.closest('.uc-command-menu')!==null");box=more.locator('.uc-command-menu').bounding_box();assert box['x']>=0 and box['x']+box['width']<=390;g.keyboard.press('Escape');assert ev("document.activeElement.matches('.uc-command-more>summary')");assert ev('currentTask().id')==task
 for w in [1366,390,1024,390]:
  g.set_viewport_size({'width':w,'height':600});g.wait_for_timeout(70);assert g.locator('.aw-commandbar [data-action="new-analysis"]').count()==1;assert ev('currentTask().id')==task
 g.locator('.uc-command-more>summary:visible').click();g.locator('.uc-command-menu [data-action="nav-tasks"]').click();assert ev("state.view==='tasks'");ev('id=>openTask(id)',task);g.locator('[data-action="aw-config"]:visible').click();assert g.locator('.aw-config').is_visible();assert ev('currentTask().id')==task;ev("document.getElementById('toast').classList.remove('show')");g.screenshot(path=str(root/'review/ui-conformance-word-390.png'),animations='disabled')
 checks.append('11工具22个结果状态；窄屏真实节点收纳、伸缩无重复、配置入口有效；更多方向键进入、Esc关闭并返回焦点')
 # Shared measured color pairs; this is not a certification of arbitrary documents/charts.
 pairs=ev("() => {const box=document.createElement('div');box.innerHTML='<span class=\"tag green\">解析完成</span><span class=\"tag amber\">需核验</span><span class=\"tag red\">解析失败</span><span class=\"hint\">辅助说明</span><button class=\"btn primary\">开始分析</button>';box.style.background='white';document.body.append(box);const result=[...box.children].map(e=>({label:e.textContent,fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));box.remove();return result;}")
 def rgb(s):return [int(x) for x in __import__('re').findall(r'[\d.]+',s)[:3]]
 def luminance(c):
  a=[x/255 for x in c];a=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in a];return sum(x*w for x,w in zip(a,[.2126,.7152,.0722]))
 for x in pairs:
  fg=luminance(rgb(x['fg']));bg=luminance([255,255,255] if x['bg'].endswith(', 0)') else rgb(x['bg']));x['ratio']=(max(fg,bg)+.05)/(min(fg,bg)+.05);assert x['ratio']>=4.5,x
 checks.append('五组共用标签/辅助字/主按钮实际颜色对比度≥4.5，禁用与图表/上传原件不在该项认证范围')
 g.set_viewport_size({'width':1024,'height':480});ev("nav('tool','meeting');render()");ev("document.getElementById('toast').classList.remove('show')");g.screenshot(path=str(root/'review/ui-conformance-meeting-1024.png'),animations='disabled');assert not errors,errors
 (root/'review/ui-conformance-checks.json').write_text(json.dumps({'date':'2026-10-19','checks':checks,'states':records,'colorPairs':pairs,'errors':errors,'limits':['浏览器本地交互，未验证正式后台回执/服务端鉴权','颜色检查为列出的共用组合，非全系统无障碍认证']},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'states':len(records),'errors':errors},ensure_ascii=False));b.close()
