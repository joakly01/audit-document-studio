"""Independent meeting timeline demo: drafts, real DOCX sources and seed persistence."""
from pathlib import Path
import json,tempfile,zipfile
from xml.etree import ElementTree as ET
from playwright.sync_api import sync_playwright

root=Path.cwd();checks=[];errors=[];sources=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True)
    g.set_default_timeout(15000)
    g.on('pageerror',lambda e:errors.append(str(e)))
    g.goto('http://127.0.0.1:8765/#tool/meeting',wait_until='load')
    g.wait_for_function("typeof meetingTimelineDemoReady!=='undefined'&&typeof mtBase!=='undefined'")
    seeded=g.evaluate('meetingTimelineDemoReady')
    def ev(s,arg=None):return g.evaluate(s,arg)
    def act(a,**d):return ev('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
    def click(a):g.locator('[data-action='+a+']:visible').last.click()
    def close():g.keyboard.press('Escape')
    # Use a real prepared source set and the editable business requirement dialog.
    ev('loadSample()')
    act('aw-prompt',stage='regular')
    g.locator('#prompt-editor').fill('请追踪预算调整、采购验收与责任落实，保留原文。')
    click('aw-prompt-save')
    ev("ws().config.similarityThreshold=87;ws().config.minClusterSize=3;persist();render()")
    before=ev("JSON.stringify({ids:ws().ids,preview:ws().preview,config:ws().config,projects:ws().projects,modes:ws().modes})")
    ev("handleAction('mt-demo',{dataset:{}})")
    g.wait_for_function('currentTask()?.id===MEETING_TIMELINE_DEMO_TASK_ID')
    assert ev('currentTask().result.length')==24
    assert ev('mtMeetings(currentTask().result).length')==8
    assert ev('currentTask().ids.length')==7
    assert ev('currentTask().demo')
    ev("nav('tool','meeting')")
    assert ev('currentTask()') is None
    after=ev("JSON.stringify({ids:ws().ids,preview:ws().preview,config:ws().config,projects:ws().projects,modes:ws().modes})")
    assert before==after,'Opening demo changed a preparation draft'
    checks.append('通过内部测试入口加载会议时间轴示例；返回会议分析后，资料、预览、完整配置与其他草稿字段保持一致')
    # Each result opens its own real source; the two same-day meetings share a real combined DOCX.
    ev("handleAction('mt-demo',{dataset:{}})")
    g.wait_for_function('currentTask()?.id===MEETING_TIMELINE_DEMO_TASK_ID')
    assets=ev('Object.values(MEETING_TIMELINE_DEMO_SOURCES)')
    for i,asset in enumerate(assets):
        index=ev('id=>currentTask().result.findIndex(r=>r.doc===id)',asset['id'])
        row=ev('i=>currentTask().result[i]',index)
        if i==0:
            g.locator('.mt-detail-card [data-action=aw-review]').first.click()
        else:act('aw-review',id=asset['id'],index=str(index))
        g.wait_for_function("document.querySelector('#preview-raw-content')?.dataset.rawReady==='docx'")
        assert ev('modalData.id')==asset['id']
        assert ev('activeFilePreview.file.name')==asset['name']
        frame=g.locator('#preview-raw-content iframe').content_frame
        text=frame.locator('body').inner_text()
        assert asset['title'] in text and row['title'] in text and row['excerpt'] in text
        assert row['participants'] in text and row['observers'] in text
        for linked in ev('id=>currentTask().result.filter(r=>r.doc===id)',asset['id']):
            assert linked['excerpt'] in text
        assert '2026年2月6日，园区建设中心召开第3次项目专题会议' not in text
        assert ev("auditFileAccess(file(modalData.id)).preview&&auditFileAccess(file(modalData.id)).download&&libReady(file(modalData.id))")
        with g.expect_download() as info:click('preview-download-original')
        download=info.value;assert download.suggested_filename==asset['name']
        path=Path(tmp)/download.suggested_filename;download.save_as(path)
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None
            doc=ET.fromstring(z.read('word/document.xml'))
            content=''.join(doc.itertext());assert row['excerpt'] in content
        sources.append({'id':asset['id'],'name':asset['name'],'rawReady':'docx','meetingCount':len(asset['meetingIds']),'bytes':path.stat().st_size})
        if i==2:g.screenshot(path=str(root/'review/meeting-timeline-source-combined.png'))
        close()
    checks.append('7份真实DOCX均可在原文栏渲染并下载；文件名、会议、摘录、参会及列席人员与结果一致；合并纪要包含两场会议，未错用旧d3源文件')
    # Mutating the seeded snapshot proves a reload does not replace a user's existing record.
    ev("currentTask().notes='演示记录保留验证';currentTask().config.stages.regular.content='演示要求保留验证';persist()")
    count=ev('state.tasks.length')
    g.reload(wait_until='load');ev('meetingTimelineDemoReady')
    assert ev('state.tasks.length')==count
    assert ev("meetingTimelineDemoTask().notes")=='演示记录保留验证'
    assert ev("meetingTimelineDemoTask().config.stages.regular.content")=='演示要求保留验证'
    assert ev('currentTask()?.id')==ev('MEETING_TIMELINE_DEMO_TASK_ID')
    checks.append('刷新保持演示记录备注和配置修改，不重复创建任务或资料；结果路由可恢复')
    # Delete through the actual task information/confirmation interface, then reload.
    ev("nav('tasks')")
    act('tr-info',id=ev('MEETING_TIMELINE_DEMO_TASK_ID'))
    click('delete-task');assert ev("modal==='confirm'")
    click('confirm-delete-task')
    assert ev('meetingTimelineDemoTask()') is None
    g.reload(wait_until='load');ev('meetingTimelineDemoReady')
    assert ev('meetingTimelineDemoTask()') is None,'Deleted demo was seeded again after refresh'
    assert ev('Object.keys(MEETING_TIMELINE_DEMO_SOURCES).every(id=>!!file(id))')
    ev("nav('tool','meeting')")
    assert ev('currentTask()') is None
    assert ev('ws().ids')==['d3','d4','d5'],{'actualIds':ev('ws().ids'),'draftIds':ev('ws().preparationDraft?.ids')}
    assert '追踪预算' in ev('ws().config.stages.regular.content')
    checks.append('通过任务信息删除演示后刷新不补回，原DOCX资料保留；原会议准备草稿仍可继续')
    assert not errors,errors
    report={'checks':checks,'sources':sources,'initialSeed':seeded,'errors':errors}
    (root/'review/meeting-timeline-sources-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False),flush=True)
    b.close()
