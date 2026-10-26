"""Verify actual meeting filter controls, draft isolation and terminology."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path.cwd();errors=[];checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');g.on('pageerror',lambda e:errors.append(str(e)));g.goto('http://127.0.0.1:8765/#tool/meeting',wait_until='load');g.wait_for_function("typeof mtBase!=='undefined'");g.evaluate('meetingTimelineDemoReady')
 def ev(s):return g.evaluate(s)
 def click(a):g.locator('[data-action='+a+']:visible').first.click()
 ev("handleAction('mt-demo',{dataset:{}})");g.wait_for_selector('.mt-workspace');assert '议题聚类' in g.locator('.aa-viewbar').inner_text();assert g.locator('.mt-topic-panel h3').inner_text().startswith('议题聚类');snapshot=ev('JSON.stringify(currentTask().config)')
 click('meeting-filter');assert g.locator('.modalhead h2').inner_text()=='筛选条件';assert g.locator('[data-edit]').count()==7
 g.locator('[data-edit=participants]').fill('陈静');g.locator('[data-edit=from]').fill('2026-01-08');g.locator('[data-edit=to]').fill('2026-01-22');g.locator('[data-edit=min]').fill('120');g.locator('[data-edit=max]').fill('128');g.locator('[data-edit=keywords]').fill('预算');click('v2-save-editor')
 assert not ev('modal');expected=ev("currentTask().result.filter(r=>(r.participants+' '+r.observers).includes('陈静')&&r.date>='2026-01-08'&&r.date<='2026-01-22'&&parseFloat(r.amount)>=120&&parseFloat(r.amount)<=128&&[r.topic,r.topicName,r.excerpt].join(' ').includes('预算')).length")
 assert expected>0;assert ev('awMeetingFiltered(currentTask()).length')==expected;assert g.locator('.mt-filter-chip').count()==4;assert g.locator('[data-action=meeting-filter]').inner_text()=='筛选条件 · 4';assert ev("awExportableRows(currentTask(),'filtered').length")==expected
 click('meeting-filter');g.locator('[data-edit=keywords]').fill('不存在的议题');click('close-modal');assert ev('awMeetingFiltered(currentTask()).length')==expected
 click('meeting-filter');g.locator('[data-edit=min]').fill('200');g.locator('[data-edit=max]').fill('100');click('v2-save-editor');assert ev("modal==='v2-meeting-filter'");assert g.locator('#editor-error').inner_text();assert ev('awMeetingFiltered(currentTask()).length')==expected
 click('v2-reset-meeting-filter');assert ev('awMeetingFiltered(currentTask()).length')==expected;click('v2-save-editor');assert ev('awMeetingFiltered(currentTask()).length')==24;assert not g.locator('.mt-filter-chip').count()
 checks.append('实际筛选弹窗：四类组合条件、人员含列席、筛选摘要与导出一致；取消和非法范围不改原结果，清空确认后恢复')
 click('meeting-filter');g.locator('[data-edit=keywords]').fill('^年度资金计划');g.locator('.aa-regex>summary').click();g.locator('[data-edit=regex]').check();click('v2-save-editor');assert ev('awMeetingFiltered(currentTask()).length')==1;assert '关键词（正则）' in g.locator('.mt-filter-summary').inner_text();click('aw-clear')
 checks.append('保留正则表达式功能与原有业务术语，关键词覆盖议题名称/内容/聚类名称')
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});click('meeting-filter');rect=g.locator('.modal').bounding_box();foot=g.locator('.modalfoot').bounding_box();assert rect['y']>=0 and rect['y']+rect['height']<=h+1;assert foot['y']+foot['height']<=h+1;assert ev('document.documentElement.scrollWidth')<=w;g.screenshot(path=str(root/f'review/meeting-filter-dialog-{w}.png'));click('close-modal')
 assert ev('JSON.stringify(currentTask().config)')==snapshot;assert not errors,errors;checks.append('1366、1024×480、390下筛选窗口与底部操作可达；执行配置保持不变');report={'checks':checks,'errors':errors};(root/'review/meeting-filter-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));b.close()
