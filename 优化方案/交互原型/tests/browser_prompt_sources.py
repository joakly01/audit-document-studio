"""Default selection, library classification and personal prompt reuse."""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("AUDIT_UI_URL", "http://127.0.0.1:8765")
checks, errors = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1366, "height": 768})
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL + "/#tool/timeline", wait_until="load")
    page.wait_for_function("typeof PG_GROUPS!=='undefined'")

    def ev(code, arg=None):
        return page.evaluate(code, arg)

    def action(name, **data):
        return ev("x=>handleAction(x.name,{dataset:x.data})", {"name": name, "data": data})

    def note(text):
        checks.append(text)
        print(text, flush=True)

    expected = ["公共提示词 / 场景提示词", "公共提示词 / 功能提示词",
                "公共提示词 / 系统提示词", "机构提示词", "个人提示词"]
    for tool in ev("PG_IDS"):
        ev("id=>{nav('tool',id);if(id==='bidding')ws().modes=['tender','bid','joint'];if(id==='contract'&&typeof cwView!=='undefined')cwView.tab='options';render();}", tool)
        for stage in ev("pgDefs().map(d=>d[0])"):
            if tool == "bidding":
                action("ba-stage", stage=stage)
            if tool == "engineering" and ev("typeof egView!=='undefined'"):
                action("eg-stage", stage=stage)
            select = page.locator('[data-pg-prompt="' + stage + '"]')
            assert select.input_value() == "system", (tool, stage)
            assert select.locator("optgroup").evaluate_all("els=>els.map(e=>e.label)") == expected
            assert "系统默认" in select.locator('option:checked').inner_text()
            assert "公共提示词 / 系统提示词" in select.locator("..").inner_text()
    note("九项工具各阶段默认选中公共 / 系统提示词；完整展示公共三类、机构、个人来源")

    # Real saved prompt workflow: no injected personal fixture required.
    ev("nav('tool','timeline')")
    action("aw-prompt", stage="timeline")
    page.locator("#prompt-editor").fill("按审计进点、决策审批、资金支付日期整理事项，保留原文依据。")
    assert page.locator("#aw-prompt-template").input_value() == "current"
    action("aw-store-prompt")
    page.locator("#aw-scheme-name").fill("我的资金支付时间线")
    action("aw-store-confirm")
    record = ev("state.templates.find(t=>t.name==='我的资金支付时间线')")
    assert record["scope"] == "personal" and record["stage"] == "timeline"
    assert record["functionType"] == "timeline_analysis"
    action("aw-prompt-save")
    select = page.locator('[data-pg-prompt="timeline"]')
    assert select.input_value() == "p:" + record["id"]
    assert select.locator('option:checked').locator("..").get_attribute("label") == "个人提示词"
    selected = ev("JSON.stringify(ws().config)")
    page.reload(wait_until="load")
    page.wait_for_function("typeof PG_GROUPS!=='undefined'")
    assert ev("JSON.stringify(ws().config)") == selected
    assert page.locator('[data-pg-prompt="timeline"]').input_value() == "p:" + record["id"]
    page.locator('[data-pg-prompt="timeline"]').select_option("system")
    page.locator('[data-pg-prompt="timeline"]').select_option("p:" + record["id"])
    assert "资金支付日期" in ev("ws().config.stages.timeline.content")
    note("编辑、另存个人提示词、重新选择及刷新恢复均正确；未把个人选择重置为系统默认")

    ev("""()=>{
      const base={kind:'prompt',function_type:'timeline_analysis',content:'核对时间与事项。'};
      state.templates.push(
        {...base,id:'source-scene',name:'审计进点场景',scope:'public',category:'scenario',backendId:701},
        {...base,id:'source-function',name:'事项梳理',scope:'public',category:'function'},
        {...base,id:'source-org',name:'本机构时间线规范',space_type:'org',backendId:703},
        {...base,id:'source-disabled',name:'已停用',status:'disabled'},
        {...base,id:'source-denied',name:'无使用权限',canUse:false},
        {...base,id:'source-other-tool',name:'其他工具',toolId:'theme'},
        {...base,id:'source-other-type',name:'其他功能',function_type:'meeting_minutes'}
      );render();
    }""")
    select = page.locator('[data-pg-prompt="timeline"]')
    for key, group in [("scene", expected[0]), ("function", expected[1]), ("org", expected[3])]:
        option = select.locator('option[value="p:source-' + key + '"]')
        assert option.locator("..").get_attribute("label") == group
    for key in ["disabled", "denied", "other-tool", "other-type"]:
        assert select.locator('option[value="p:source-' + key + '"]').count() == 0
    select.select_option("p:source-org")
    fragment = ev("configurationFragment('timeline',ws().config)")
    assert fragment["prompt_id"] == 703 and fragment["prompt"] == "核对时间与事项。"
    note("公共子类与机构来源正确；按功能类型过滤，停用及无权限项不显示，选择后保留实际提示词ID")

    # Prompt changes with local risk rules remain reviewable.
    ev("""()=>{nav('tool','risk');state.templates.push({id:'risk-personal-source',kind:'prompt',
      scope:'personal',toolId:'risk',stage:'risk',functionType:'risk-point-analysis',
      name:'采购合规检查',prompt:'按采购规则检查。',promptConfig:{riskNodes:[
      {id:'procurement-1',name:'采购审批',path:'采购 / 审批',description:'核对采购审批。'}],
      checks:['采购审批']}});render();}""")
    snapshot = ev("JSON.stringify(ws().config)")
    page.locator('[data-pg-prompt="risk"]').select_option("p:risk-personal-source")
    assert ev("modal") == "pg-prompt-confirm"
    assert ev("JSON.stringify(ws().config)") == snapshot
    action("close-modal")
    assert page.locator('[data-pg-prompt="risk"]').input_value() == "system"
    page.locator('[data-pg-prompt="risk"]').select_option("p:risk-personal-source")
    action("pg-confirm-prompt")
    assert ev("ws().config.riskNodes[0].id") == "procurement-1"
    assert ev("ws().config.stages.risk.scope") == "personal"
    note("个人风险提示词连同配套风险点先确认；取消恢复选项，确认后只应用当前阶段")

    # Historical prompts can be deleted from the library without changing a task.
    ev("""()=>{const config=structuredClone(ws().config),t={id:'prompt-source-snapshot',
      toolId:'risk',name:'来源核对',status:'completed',ids:[],successIds:[],failedIds:[],
      config,result:[]};state.tasks.push(t);ws().taskId=t.id;state.templates=
      state.templates.filter(t=>t.id!=='risk-personal-source');render();
      handleAction('tr-config',{dataset:{id:t.id}});}""")
    snapshot = ev("JSON.stringify(currentTask())")
    assert page.locator('[data-pg-prompt="risk"]').is_disabled()
    assert page.locator('[data-pg-prompt="risk"]').input_value() == "current"
    assert "采购合规检查" in page.locator('[data-pg-prompt="risk"] option:checked').inner_text()
    assert ev("JSON.stringify(currentTask())") == snapshot
    note("库记录不可见时仍展示执行快照的名称与正文，历史任务保持只读")

    ev("nav('tool','timeline')")
    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        page.set_viewport_size({"width": width, "height": height})
        ev("render()")
        if width <= 900:
            action("tw-panel", panel="config")
        assert ev("document.documentElement.scrollWidth<=innerWidth")
        page.screenshot(path=str(ROOT / "review" / f"prompt-sources-{width}.png"))
    assert not errors, errors
    (ROOT / "review" / "prompt-sources-checks.json").write_text(
        json.dumps({"checks": checks, "errors": errors}, ensure_ascii=False, indent=2))
    browser.close()
