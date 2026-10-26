from pathlib import Path
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1440,'height':900},accept_downloads=True);errors=[];g.on('pageerror',lambda e:(errors.append(str(e)),print('Browser error:',str(e),flush=True)));g.on('requestfailed',lambda r:print('Request failed:',r.url,r.failure,flush=True));g.goto('http://127.0.0.1:8765/#tasks',wait_until='load');g.wait_for_function("typeof taskDemoReady!=='undefined'");g.evaluate('taskDemoReady')
 print(g.evaluate('({count:state.tasks.length,tools:[...new Set(state.tasks.map(t=>t.toolId))],statuses:[...new Set(state.tasks.map(t=>t.status))]})'))
 assert g.evaluate('state.tasks.length')==30
 for tid in g.evaluate('TOOLS.map(t=>t.id)'):
  g.evaluate("id=>handleAction('tr-result',{dataset:{id:'demo-task-v1-'+id+'-0'}})",tid)
  assert g.locator('.tr-result-only').count()==1,tid
  g.evaluate("id=>handleAction('tr-config',{dataset:{id:'demo-task-v1-'+id+'-0'}})",tid);assert g.locator('.tr-config-page').is_visible()
  g.evaluate("id=>handleAction('tr-download',{dataset:{id:'demo-task-v1-'+id+'-0'}})",tid);assert g.locator('.tr-download-page').is_visible()
  assert not g.locator('[data-kind=main]').is_disabled(),tid
 g.evaluate("nav('tasks');state.taskTool='all';render()")
 for w,h in [(1440,900),(1366,768),(1024,480)]:
  g.set_viewport_size({'width':w,'height':h});g.evaluate('render()');assert g.evaluate('document.documentElement.scrollWidth')<=w
  g.screenshot(path=f'review/tasks-demo-{w}.png')
  print(w,g.locator('.tr-action').first.bounding_box())
 before=g.evaluate('state.tasks.map(t=>t.id)');g.reload(wait_until='networkidle');g.wait_for_function("typeof taskDemoReady!=='undefined'");g.evaluate('taskDemoReady');assert g.evaluate('state.tasks.map(t=>t.id)')==before
 assert g.evaluate("state.tasks.filter(t=>t.status==='queued').length")==2
 g.evaluate("nav('library');state.space='个人空间';state.folder='全部资料';render()");assert g.locator('.lib-toolbar [data-action=upload]').count()==1;assert not g.locator('.audit-upload-menu').count()
 g.locator('.lib-toolbar [data-action=upload]').click();assert g.get_by_role('button',name='选择文件',exact=True).is_visible();assert g.get_by_role('button',name='选择文件夹',exact=True).is_visible()
 g.keyboard.press('Escape')
 g.evaluate("state.tasks=state.tasks.filter(t=>t.id!=='demo-task-v1-word-1');ws('extract').config.taskName='保留我的配置';persist()")
 g.reload(wait_until='networkidle');g.wait_for_function("typeof taskDemoReady!=='undefined'");g.evaluate('taskDemoReady');assert g.evaluate('state.tasks.length')==29;assert g.evaluate("ws('extract').config.taskName")=='保留我的配置'
 assert not errors,errors
 print('Demo records, all 11 result/config/download pages, reload and unified upload verified.');b.close()
