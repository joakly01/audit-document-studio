"""All result viewers offer one explicit editable rerun without changing historical results."""
from pathlib import Path
import json
import os
import tempfile

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("AUDIT_UI_URL", "http://127.0.0.1:8765")
checks, errors, layouts = [], [], []


with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1366, "height": 768}, accept_downloads=True, reduced_motion="reduce")
    page.set_default_timeout(12000)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL + "/#tasks", wait_until="load")
    page.wait_for_function("typeof raBase !== 'undefined'")
    page.evaluate("taskDemoReady")

    def ev(script, data=None):
        return page.evaluate(script, data)

    def act(action, **data):
        return ev("x=>handleAction(x.action,{dataset:x.data})", {"action": action, "data": data})

    def click(action):
        page.locator('[data-action="' + action + '"]:visible').last.click()

    def note(text):
        checks.append(text)
        print(text, flush=True)

    def old_task(task_id):
        return ev("id=>JSON.stringify(state.tasks.find(t=>t.id===id))", task_id)

    # Build valid tool-specific snapshots; source selection and complex inputs use existing preparation.
    ev("""()=>{
      for(const meta of TOOLS){
        nav('tool',meta.id);ws().taskId=null;loadSample();const w=ws();
        w.config.failure='none';w.config.stageFailure='none';
        if(meta.id==='extract'){
          w.config.fields=[...meta.fields];
          w.config.fieldDefs=meta.fields.map(name=>({name,description:'摘录'+name+'并保留来源。'}));
          w.config.extractionTemplateChoiceVersion=1;
        }
        const t={id:'ra-old-'+meta.id,toolId:meta.id,name:meta.name+'首次核对',
          notes:'核对审批、金额和原文依据。',ids:[...w.ids],config:structuredClone(w.config),
          status:'completed',progress:100,phase:'分析完成',created:'2026-10-23T01:00:00Z',
          successIds:[...w.ids],failedIds:[],projects:structuredClone(w.projects),
          modes:[...w.modes],tableA:w.tableA,tableB:w.tableB,
          tableAName:w.tableAName,tableBName:w.tableBName,
          stopwords:['的','以及'],newwords:['专项资金'],attachments:{},chats:[]};
        if(meta.id==='word')t.config.lexiconSelection={stop:null,user:null};
        if(meta.id==='meeting'){
          t.riskReportConfig={...structuredClone(t.config.stages.risk),content:'已生成报告采用的风险要求。'};
          t.riskStageDraft={...structuredClone(t.config.stages.risk),content:'审计人员调整后尚未执行的风险要求。'};
        }
        ensureTaskStructure(t);t.result=makeResult(t);
        if(meta.id==='prepaid')Object.assign(t,{status:'completed',base:1000000,fee:15000,
          phase:'费用计算报告已生成',billing:structuredClone(feeClauses.find(f=>f.id==='d9'))});
        state.tasks=state.tasks.filter(item=>item.id!==t.id);state.tasks.push(t);
      }
      state.stopwords=['当前全局停用词'];state.newwords=['当前全局新词'];
      persist();nav('tasks');
    }""")

    def show_result(task_id):
        ev("id=>{openTask(id);ws().subtab=state.toolId==='meeting'?'regular':'main';render();}", task_id)
        assert page.locator(".ra-result-commandbar").is_visible()
        assert ev("currentTask().id") == task_id

    def expected_settings(task_id):
        return ev("""id=>{
          const t=state.tasks.find(t=>t.id===id), c=structuredClone(t.config);
          if(t.toolId==='word')c.lexiconSelection={stop:[...t.stopwords],user:[...t.newwords]};
          if(t.toolId==='meeting')c.stages.risk=structuredClone(t.riskStageDraft||t.riskReportConfig||c.stages.risk);
          return configurationFragment(t.toolId,c);
        }""", task_id)

    def export_result(tool):
        click("export")
        selector = "#ew-export-format" if tool == "extract" else "#aw-export-format" if tool in ["word", "theme", "timeline", "risk", "meeting"] else "#export-format"
        page.locator(selector).select_option("json")
        with page.expect_download() as event:
            click("do-export")
        target = Path(tmp) / (tool + ".json")
        event.value.save_as(target)
        exported = json.loads(target.read_text(encoding="utf-8-sig"))
        assert exported and target.stat().st_size > 100
        return exported

    def assert_sources(before):
        for key in ["ids", "projects", "modes", "tableA", "tableB", "tableAName", "tableBName"]:
            assert ev("key=>ws()[key]??null", key) == before.get(key), (ev("state.toolId"), key)

    for tool in ev("TOOLS.map(t=>t.id)"):
        task_id = "ra-old-" + tool
        show_result(task_id)
        snapshot = old_task(task_id)
        source = ev("structuredClone(currentTask())")
        expected = expected_settings(task_id)
        task_count = ev("state.tasks.length")
        assert page.locator('.ra-result-commandbar [data-action]').all_inner_texts() == ['再次分析', '导出'], tool
        assert page.locator('.ra-result-commandbar [data-action="export"]').count() == 1, tool
        assert not page.locator('[data-action="aw-config"], [data-action="ew-config"], [data-action="toggle-config"]').count(), tool
        assert not page.locator('.ew-grid>.ew-materials, .workbench>.workset').count(), tool
        assert not page.locator('.result-actions [data-action="export"]').count(), tool
        export_result(tool)
        assert old_task(task_id) == snapshot, tool

        # Rerun is a transition into preparation, never a request submission.
        page.locator('.ra-result-commandbar [data-action="new-analysis"]').click()
        assert ev("currentTask()") is None, tool
        assert not ev("isLocked()"), tool
        assert ev("state.tasks.length") == task_count, tool
        assert not ev("trMode()"), tool
        assert page.url.endswith("#tool/" + tool), (tool, page.url)
        assert ev("configurationFragment(state.toolId,ws().config)") == expected, tool
        assert_sources(source)
        assert old_task(task_id) == snapshot, tool
        assert page.locator('aside.config input:not([readonly]):not([disabled]), aside.config textarea:not([readonly]):not([disabled]), aside.config select:not([disabled])').count(), tool
        if tool == "word":
            assert ev("ws().config.lexiconSelection.stop") == source["stopwords"]
            assert ev("ws().config.lexiconSelection.user") == source["newwords"]
            page.locator('[data-wc-config="top"]').fill("50")
            assert ev("ws().config.top") == 50
        elif tool == "extract":
            page.locator('[data-ef-input="description"]').first.fill("调整后保留合同原始单位及审批依据。")
            assert ev("ws().config.fieldDefs[0].description") == "调整后保留合同原始单位及审批依据。"
        else:
            if tool == "contract":
                page.locator('[data-action="cw-tab"][data-tab="options"]').click()
            page.locator('.pg-stage-card [data-action="aw-prompt"]').first.click()
            content = page.locator("#prompt-editor").input_value()
            page.locator("#prompt-editor").fill(content + "\n补充核对本次付款审批依据。")
            click("aw-prompt-save")
            assert "补充核对" in ev("ws().config.stages[pgDefs()[0][0]].content")
        assert old_task(task_id) == snapshot, tool
        assert not ev("validate(false)"), (tool, ev("validate(false)"))

        # A second explicit action submits a new immutable task with the edited setup.
        click("run")
        assert ev("state.tasks.length") == task_count, tool
        submit = "ew-submit-confirm" if tool == "extract" else "aw-submit-confirm" if tool in ["word", "theme", "timeline", "risk", "meeting"] else "tw-submit-confirm"
        name_id = "#ew-task-name" if tool == "extract" else "#aw-task-name" if submit == "aw-submit-confirm" else "#tw-task-name"
        page.locator(name_id).fill("调整后再次核对-" + tool)
        click(submit)
        page.wait_for_function("currentTask()?.status!=='running'")
        assert ev("state.tasks.length") == task_count + 1, tool
        assert ev("currentTask().id") != task_id, tool
        assert ev("currentTask().name") == "调整后再次核对-" + tool, tool
        assert old_task(task_id) == snapshot, tool
        if tool == "prepaid":
            assert ev("currentTask().status") == "awaiting"
            assert page.locator('[data-action="calculate-fee"]').is_visible()
            page.locator("#fee-base").fill("1000000")
            click("calculate-fee")
            page.wait_for_function("currentTask()?.status==='completed'")
        else:
            assert ev("currentTask().status") == "completed", (tool, ev("currentTask()"))
        assert old_task(task_id) == snapshot, tool
        note(tool + "：结果页动作统一，沿用设置和资料后可编辑，明确提交新任务且旧结果完整保留")

    # If no unexecuted risk draft exists, use the requirements behind the generated report.
    ev("""()=>{
      const t=structuredClone(state.tasks.find(t=>t.id==='ra-old-meeting'));
      t.id='ra-meeting-report-only';delete t.riskStageDraft;state.tasks.push(t);openTask(t.id);render();
    }""")
    snapshot = old_task("ra-meeting-report-only")
    click("new-analysis")
    assert ev("ws().config.stages.risk.content") == "已生成报告采用的风险要求。"
    assert old_task("ra-meeting-report-only") == snapshot
    note("会议重新分析优先继承尚未执行的风险要求，没有草稿时沿用已生成风险报告的要求")

    # The final commandbar must not remove recovery operations from unfinished tasks.
    ev("""()=>{
      const original=state.tasks.find(t=>t.id==='ra-old-extract');
      for(const status of ['failed','partial','stopped','running']){
        const t=structuredClone(original);t.id='ra-status-'+status;t.status=status;
        t.config.failure='none';t.config.stageFailure='none';
        t.successIds=status==='partial'?t.ids.slice(0,-1):[];
        t.failedIds=['failed','partial'].includes(status)?t.ids.filter(id=>!t.successIds.includes(id)):[];
        t.result=status==='partial'?t.result.filter(r=>t.successIds.includes(r.doc)):[];
        t.phase=status==='running'?'正在提取资料':status==='stopped'?'已停止':'部分资料读取失败';
        if(status==='running'){t.demoSnapshot=true;t.progress=36;}
        state.tasks.push(t);
      }
    }""")
    for status in ["failed", "partial"]:
        task_id = "ra-status-" + status
        show_result(task_id)
        task_count = ev("state.tasks.length")
        config = ev("JSON.stringify(currentTask().config)")
        assert page.locator('[data-action="retry-task"]:visible').count() >= 1
        click("retry-task")
        page.wait_for_function("currentTask()?.status==='completed'")
        assert ev("currentTask().id") == task_id and ev("state.tasks.length") == task_count
        assert ev("JSON.stringify(currentTask().config)") == config
    ev("openTask('ra-status-running');render()")
    assert page.locator('[data-action="stop-task"]:visible').count() >= 1
    click("stop-task")
    click("confirm-stop")
    assert ev("currentTask().status") == "stopped"
    show_result("ra-status-stopped")
    assert page.locator('[data-action="new-analysis"]:visible').count() == 1
    if page.locator('[data-action="export"]').count():
        assert page.locator('[data-action="export"]').is_disabled()
    note("失败与部分失败保留原任务重试；运行中仍可停止，已停止任务仅经明确再次分析继续")

    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        page.set_viewport_size({"width": width, "height": height})
        for tool in ["extract", "meeting", "contract", "association"]:
            show_result("ra-old-" + tool)
            ev("document.getElementById('toast').classList.remove('show')")
            bar = page.locator(".ra-result-commandbar").bounding_box()
            metric = ev("""()=>({tool:state.toolId,width:innerWidth,height:innerHeight,
              scrollWidth:document.documentElement.scrollWidth})""")
            assert metric["scrollWidth"] <= width, metric
            assert bar["y"] >= 0 and bar["x"] + bar["width"] <= width + 1, bar
            assert page.locator('.ra-result-commandbar [data-action="new-analysis"]').is_visible()
            assert page.locator('.ra-result-commandbar [data-action="export"]').is_visible()
            assert page.locator('.ra-result-commandbar [data-action]').all_inner_texts() == ['再次分析', '导出'], metric
            layouts.append(metric)
            page.screenshot(path=str(ROOT / "review" / f"result-reanalysis-{tool}-{width}.png"), animations="disabled")
    note("提取、会议、合同与两表结果页在三种屏幕尺寸下动作可见且无横向溢出")

    assert not errors, errors
    result = {"checks": checks, "layouts": layouts, "errors": errors}
    (ROOT / "review" / "result-reanalysis-checks.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False), flush=True)
    browser.close()
