"""Read-only browser review of the released prototype. Uses a fresh context."""
from pathlib import Path
import json, time, re
from playwright.sync_api import sync_playwright

OUT=Path(__file__).resolve().parent
OUT.mkdir(exist_ok=True,parents=True)
URL='http://127.0.0.1:8875'
report={'date':'2026-10-25','assetVersion':'20261024.80','scope':'Local static prototype; no business backend or AI quality tested','views':[],'errors':[],'assertions':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.goto(URL+'/#library',wait_until='load')
    page.wait_for_function("typeof bfMeta==='function' || typeof tlPreparing==='function'")
    page.evaluate('async()=>{await taskDemoReady;await libraryStatusDataReady;return true}')
    tools=page.evaluate('TOOLS.map(t=>({id:t.id,name:t.name}))')
    for t in tools:
        page.evaluate('id=>{nav("tool",id);loadSample();document.querySelector("#toast")?.classList.remove("show")}',t['id'])
        for width,height in [(1440,900),(1024,480),(390,600)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('render()')
            page.wait_for_timeout(100)
            metrics=page.evaluate('''()=>({bodyWidth:document.documentElement.scrollWidth,viewport:innerWidth,
                headings:[...document.querySelectorAll('#app h1,#app h2')].filter(n=>n.getBoundingClientRect().height).map(n=>n.textContent.trim()),
                collapse:[...document.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().height&&/收起原文/.test(n.textContent)).length,
                importExport:[...document.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().height&&/^(导入设置|导出设置|导入配置|导出配置)$/.test(n.textContent.trim())).length})''')
            report['views'].append({'tool':t['id'],'width':width,'height':height,**metrics})
            assert metrics['bodyWidth']<=width+1,(t['id'],metrics)
            assert not metrics['collapse'],t['id']
            assert not metrics['importExport'],t['id']
            if width==1440 and t['id'] in ['extract','meeting','bidding','contract','engineering','association']:
                page.screenshot(path=str(OUT/(t['id']+'-prepare.png')),animations='disabled')
        report['assertions'].append(t['name']+'：三个尺寸页面无横向溢出，无收起原文和工具设置导入导出入口')
    page.set_viewport_size({'width':1440,'height':900})
    for name in ['library','tasks','templates']:
        page.evaluate('x=>nav(x)',name)
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUT/(name+'.png')),animations='disabled')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),name
    for t in tools:
        task=page.evaluate('id=>state.tasks.find(t=>tcResolve(t)===id&&t.status==="completed"&&!tcMerge(t))?.id',t['id'])
        if not task:
            report['assertions'].append(t['name']+'：无已完成演示记录，本次未执行新任务；结果流程引用既有专项回归')
            continue
        before=page.evaluate('id=>JSON.stringify(state.tasks.find(t=>t.id===id))',task)
        page.evaluate('id=>openTask(id)',task)
        page.wait_for_timeout(120)
        result=page.evaluate('''()=>({materials:[...document.querySelectorAll('.tw-materials,.ew-materials,.ef-materials')].filter(n=>n.getBoundingClientRect().height>0).length,
            reanalysis:[...document.querySelectorAll('[data-action="new-analysis"]')].filter(n=>n.getBoundingClientRect().height>0).map(n=>n.textContent.trim()),
            export:[...document.querySelectorAll('[data-action="export"]')].filter(n=>n.getBoundingClientRect().height>0).length,
            overflow:document.documentElement.scrollWidth>innerWidth+1})''')
        assert result['materials']==0,(t['id'],result)
        assert result['reanalysis']==['再次分析'],(t['id'],result)
        assert not result['overflow'],(t['id'],result)
        after=page.evaluate('id=>JSON.stringify(state.tasks.find(t=>t.id===id))',task)
        assert before==after,t['id']
        report['assertions'].append(t['name']+'：打开历史结果不改快照，无资料清单，保留再次分析')
        if t['id'] in ['meeting','contract','bidding','extract']:
            page.screenshot(path=str(OUT/(t['id']+'-result.png')),animations='disabled')
    browser.close()
assert not report['errors'],report['errors']
(OUT/'current-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'views':len(report['views']),'assertions':len(report['assertions']),'errors':report['errors']},ensure_ascii=False))
