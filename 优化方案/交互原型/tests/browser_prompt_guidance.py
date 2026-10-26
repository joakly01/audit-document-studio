"""Prompt-library choices stay local to their business step and preserve task snapshots."""
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
    page = browser.new_page(
        viewport={"width": 1366, "height": 768},
        accept_downloads=True,
        reduced_motion="reduce",
    )
    page.set_default_timeout(12000)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL + "/#tool/timeline", wait_until="load")
    page.wait_for_function("typeof pgBase !== 'undefined'")
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

    def prepare(tool):
        ev("""id=>{
          nav('tool',id); const w=ws(); w.taskId=null; loadSample();
          w.config.taskNotes='保留本次审计关注';
          if(id==='bidding') w.modes=['tender','bid','joint'];
          if(id==='contract'&&typeof cwView!=='undefined')cwView.tab='options';
          if(id==='engineering'&&typeof egView!=='undefined')egView.stage='duplicate';
          render();
        }""", tool)

    def state_before():
        return ev("""()=>({
          config:structuredClone(ws().config), ids:[...ws().ids],
          projects:structuredClone(ws().projects), modes:[...ws().modes],
          tableA:ws().tableA, tableB:ws().tableB
        })""")

    def assert_materials_unchanged(before):
        after = state_before()
        for key in ["ids", "projects", "modes", "tableA", "tableB"]:
            assert after[key] == before[key], (key, before[key], after[key])

    def unrelated(config):
        return {k: v for k, v in config.items() if k not in ["stages", "prompt", "template"]}

    def fixture(tool, stage, **extras):
        """Legacy saved records deliberately contain unrelated complete settings."""
        return ev("""x=>{
          const config=structuredClone(ws().config), id='pg-fixture-'+x.tool+'-'+x.stage;
          config.taskNotes='此备注不得通过提示词选择覆盖';
          config.mode='不应覆盖的遍历方式'; config.feeType=EXPENSE_TYPES.at(-1);
          config.similarityThreshold=17; config.minClusterSize=9;
          config.stages[x.stage]={...config.stages[x.stage],
            content:'按'+x.tool+'的'+x.stage+'要求核对审批依据，保留原文。',
            template:'个人'+x.tool+'-'+x.stage+'提示词',origin:'personal',customized:false};
          if(x.extras.engineering){
            config.engineering[x.stage].threshold=4.15;
            config.engineering[x.stage].additional='仅用于当前项目识别环节';
            const other=x.stage==='duplicate'?'parent':'duplicate';
            config.engineering[other].threshold=0.15;
          }
          if(x.extras.risk){
            config.riskNodes=[{id:'pg-risk-budget',name:'预算审批核验',
              path:'资金管理 / 预算审批',description:'核对预算审批与支付依据。'}];
            config.checks=['预算审批核验'];
          }
          if(x.extras.contract){
            config.contractRules=[{title:'不应替换的旧规则',description:'测试隔离',
              laws:'测试依据',judgment:'测试标准',format:'compliance',
              expected:'测试内容',enabled:true}];
            config.checks=['不应替换的旧规则'];
          }
          if(x.extras.association){config.association.full=4.8;
            config.association.partial=3.2;config.association.additional='对应表头后核对来源。';}
          if(x.extras.bidding){config.bidding={joint:{
            rules:[{id:'pg-joint-rule',name:'报价响应核对',description:'对照招标要求核对报价口径。'}],
            ruleIds:['pg-joint-rule']},tender:{rules:[{id:'pg-other-rule',name:'不应替换的另一环节'}],
            ruleIds:['pg-other-rule']}};}
          state.templates=state.templates.filter(t=>t.id!==id);
          state.templates.push({id,toolId:x.tool,stage:x.stage,
            name:config.stages[x.stage].template,prompt:config.stages[x.stage].content,
            config,version:1}); render(); return id;
        }""", {"tool": tool, "stage": stage, "extras": extras})

    def choose(stage, template_id):
        if ev("state.toolId==='bidding'&&typeof baBase!=='undefined'"):
            act("ba-stage", stage=stage)
        page.locator('[data-pg-stage-card="' + stage + '"] [data-pg-prompt="' + stage + '"]').select_option("p:" + template_id)

    def open_prompt(stage):
        act("aw-prompt", stage=stage)
        assert ev("modal==='aw-prompt'")
        assert page.locator("#prompt-editor").is_visible()

    # Every preparation surface names the real control, rather than a broad scheme.
    for tool in ["timeline", "theme", "meeting", "risk", "contract", "bidding", "prepaid", "engineering", "association"]:
        prepare(tool)
        assert not page.locator('aside.config [data-config="template"]').count(), tool
        assert not page.locator('aside.config [data-action="aw-save-scheme"], aside.config [data-action="save-template"]').count(), tool
        assert "分析方案" not in page.locator("aside.config").inner_text(), tool
        assert "使用方案" not in page.locator("aside.config").inner_text(), tool
        assert page.locator(".pg-config-files,.ba-setting-files,.eg-setting-files,.asw-settings").count() == 0, tool
        for stage in ev("selectedStages().map(s=>s[0])"):
            if tool == "bidding":
                act("ba-stage", stage=stage)
            if tool == "engineering":
                act("eg-stage", stage=stage)
            assert page.locator('[data-pg-stage-card="' + stage + '"]').count() == 1, (tool, stage)
            assert page.locator('[data-pg-prompt="' + stage + '"] option[value="system"]').count() == 1
    note("九个工具以业务环节选择提示词；没有全局分析方案或配置文件传输入口")

    # Ordinary prompt changes are text-only: no rules, file selection or sibling stage replacement.
    for tool, stage, flags in [
        ("timeline", "timeline", {}), ("theme", "extract", {}),
        ("theme", "summarize", {}), ("meeting", "regular", {}),
        ("contract", "compliance", {"contract": True}),
        ("prepaid", "agreement", {}),
    ]:
        prepare(tool)
        template_id = fixture(tool, stage, **flags)
        before = state_before()
        choose(stage, template_id)
        assert ev("modal") != "pg-prompt-confirm", (tool, stage)
        after = state_before()
        expected = ev("id=>state.templates.find(t=>t.id===id).config.stages", template_id)
        assert after["config"]["stages"][stage]["content"] == expected[stage]["content"]
        for key, value in before["config"]["stages"].items():
            if key != stage:
                assert after["config"]["stages"][key] == value, (tool, key)
        assert unrelated(after["config"]) == unrelated(before["config"]), tool
        assert_materials_unchanged(before)
    note("时间轴、主题两个环节、会议、合同与计费提示词独立应用；旧完整配置不覆盖资料、其他环节或业务参数")

    # Rules that belong to a prompt are explicit and local, with cancel before mutation.
    for tool, stage, flag, affected in [
        ("engineering", "duplicate", "engineering", "engineering"),
        ("risk", "risk", "risk", "riskNodes"),
        ("association", "compare", "association", "association"),
    ]:
        prepare(tool)
        template_id = fixture(tool, stage, **{flag: True})
        before = state_before()
        choose(stage, template_id)
        assert ev("modal==='pg-prompt-confirm'"), tool
        assert state_before() == before, tool
        click("close-modal")
        assert state_before() == before, tool
        choose(stage, template_id)
        click("pg-confirm-prompt")
        after = state_before()
        selected = ev("id=>state.templates.find(t=>t.id===id).config", template_id)
        if tool == "engineering":
            assert after["config"]["engineering"][stage] == selected["engineering"][stage]
            assert after["config"]["engineering"]["parent"] == before["config"]["engineering"]["parent"]
        else:
            assert after["config"][affected] == selected[affected]
        allowed = {"stages", "prompt", "template", affected}
        if tool == "risk":
            allowed.add("checks")
            assert after["config"]["checks"] == selected["checks"]
            assert after["config"]["mode"] == before["config"]["mode"]
        for key, value in before["config"].items():
            if key not in allowed:
                assert after["config"][key] == value, (tool, key)
        assert_materials_unchanged(before)
    note("工程识别、风险点和两表比较附带规则先确认；取消不修改，确认仅替换相关局部且不改变遍历方式或文件")

    prepare("bidding")
    template_id = fixture("bidding", "joint", bidding=True)
    before = state_before()
    choose("joint", template_id)
    assert ev("modal==='pg-prompt-confirm'")
    click("pg-confirm-prompt")
    after = state_before()
    assert after["config"]["stages"]["joint"]["ruleIds"] == ["pg-joint-rule"]
    assert after["config"]["stages"]["tender"] == before["config"]["stages"]["tender"]
    assert unrelated(after["config"]) == unrelated(before["config"])
    assert_materials_unchanged(before)
    note("招投标提示词只带入当前检查环节的规则，项目归组、单位、资料角色及其他环节保持不变")

    # Draft edits, default restoration and new personal prompts keep their scope.
    prepare("theme")
    original = state_before()
    open_prompt("extract")
    page.locator("#prompt-editor").fill("仅摘录决策日期、责任单位与审批依据。")
    act("aw-prompt-tab", stage="summarize")
    page.locator("#prompt-editor").fill("按相同审计事项归纳，并列明资料来源。")
    act("aw-prompt-tab", stage="extract")
    assert "决策日期" in page.locator("#prompt-editor").input_value()
    page.keyboard.press("Escape")
    if ev("modal==='aw-discard'"):
        click("aw-discard")
    assert state_before() == original
    open_prompt("extract")
    page.locator("#prompt-editor").fill("保存后重复使用的资料要点提取提示词。")
    click("aw-store-prompt")
    page.locator("#aw-scheme-name").fill("资料要点核对个人提示词")
    click("aw-store-confirm")
    saved = ev("state.templates.find(t=>t.name==='资料要点核对个人提示词')")
    assert saved and saved["toolId"] == "theme" and saved["stage"] == "extract"
    assert "config" not in saved, saved
    assert not any(key in saved.get("promptConfig", {}) for key in ["taskName", "taskNotes", "mode", "association", "engineering"])
    if ev("modal==='aw-prompt'"):
        click("aw-prompt-save")
    assert page.locator('[data-pg-prompt="extract"] option[value="p:' + saved["id"] + '"]').count() == 1
    assert ev("ws().config.stages.summarize.content") == original["config"]["stages"]["summarize"]["content"]
    before_restore = state_before()
    page.locator('[data-pg-prompt="extract"]').select_option("system")
    assert ev("ws().config.stages.extract.content") != before_restore["config"]["stages"]["extract"]["content"]
    assert unrelated(state_before()["config"]) == unrelated(before_restore["config"])
    note("跨环节编辑保留草稿；取消不应用；个人提示词独立保存可再次选择，恢复默认不改参数")

    prepare("engineering")
    open_prompt("duplicate")
    page.locator("#prompt-editor").fill("仅识别重复报送项目，核对名称、建设单位与投资金额。")
    click("aw-store-prompt")
    page.locator("#aw-scheme-name").fill("重复项目个人提示词")
    click("aw-store-confirm")
    saved_rules = ev("state.templates.find(t=>t.name==='重复项目个人提示词')")
    assert "config" not in saved_rules
    assert set(saved_rules["promptConfig"]) == {"engineering"}
    assert set(saved_rules["promptConfig"]["engineering"]) == {"duplicate"}
    click("aw-prompt-save")
    note("工程个人提示词仅保存当前识别环节的字段与评分规则，不携带其他环节或整个工作区")

    # Tool setting-file transfer is removed; normal configuration stays intact.
    removed = ['pg-import-settings','pg-validate-settings','pg-apply-settings',
               'aw-import-config','v2-export-config','ew-import',
               'v2-template-import','v2-template-import-save']
    for tool in ev("TOOLS.map(t=>t.id)"):
        prepare(tool)
        before = state_before()
        selector = ','.join('[data-action="'+a+'"]' for a in removed)
        assert not page.locator('.ew-workspace').locator(selector).count(), tool
        assert not page.locator('.pg-config-files,.ba-setting-files,.eg-setting-files,.asw-settings').count(), tool
        for action in removed:
            act(action)
            assert ev("modal") is None, (tool,action)
            assert state_before() == before, (tool,action)
    note("11工具无设置导入导出入口或空菜单；旧动作不打开弹窗、不更改资料和参数")

    prepare("word")
    act("lexicon")
    assert page.locator('[data-action="aw-lex-import"]').count()
    assert page.locator('[data-action="aw-lex-export"]').count()
    page.keyboard.press("Escape")
    ev("nav('templates')")
    assert page.locator('[data-action="xt-export"]').count()
    act("v2-template-import")
    assert ev("modal") == "xt-import"
    page.keyboard.press("Escape")
    note("词库批量导入导出和独立提取模板管理保持；个人提示词另存、配套规则和历史配置保留")

    # Execution snapshots stay read-only when opening task information.
    task_id = ev("""()=>{
      const t=structuredClone(state.tasks.find(t=>t.toolId==='meeting'&&t.status==='completed'));
      t.id='pg-readonly-task';t.config=structuredClone(ws('meeting').config);
      state.tasks.push(t);openTask(t.id);handleAction('tr-config',{dataset:{id:t.id}});return t.id;
    }""")
    snapshot = ev("JSON.stringify(currentTask().config)")
    assert page.locator(".tr-config-page").is_visible()
    assert page.locator('[data-pg-prompt="regular"]').is_disabled()
    open_prompt("regular")
    assert page.locator("#prompt-editor").get_attribute("readonly") is not None
    assert not page.locator('#modal-root [data-action="aw-prompt-save"]').count()
    page.keyboard.press("Escape")
    assert ev("JSON.stringify(currentTask().config)") == snapshot
    note("任务信息中的执行提示词只读，历史配置快照保持不变")

    # Small embedded frames retain readable controls and reachable dialog actions.
    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        page.set_viewport_size({"width": width, "height": height})
        for tool, stage in [("timeline", "timeline"), ("theme", "extract"), ("engineering", "duplicate")]:
            prepare(tool)
            if width <= 900:
                act("tw-panel", panel="config")
            ev("document.getElementById('toast').classList.remove('show')")
            metric = ev("""()=>({tool:state.toolId,width:innerWidth,height:innerHeight,
              scrollWidth:document.documentElement.scrollWidth,
              panel:document.querySelector('aside.config').getBoundingClientRect().toJSON()})""")
            assert metric["scrollWidth"] <= width, metric
            assert page.locator('[data-pg-prompt="' + stage + '"]').is_visible(), metric
            open_prompt(stage)
            dialog = page.locator(".aw-prompt-dialog").bounding_box()
            footer = page.locator(".aw-prompt-dialog .modalfoot").bounding_box()
            assert dialog["y"] >= 0 and dialog["y"] + dialog["height"] <= height + 1, dialog
            assert footer["y"] >= 0 and footer["y"] + footer["height"] <= height + 1, footer
            page.keyboard.press("Escape")
            layouts.append(metric)
            page.screenshot(path=str(ROOT / "review" / f"prompt-{tool}-{width}.png"), animations="disabled")
    note("时间轴、主题、工程在1366、1024×480和390屏宽下无横向溢出，提示词弹窗底部操作可达")

    assert not errors, errors
    result = {"checks": checks, "layouts": layouts, "errors": errors, "snapshotTask": task_id}
    (ROOT / "review" / "prompt-guidance-checks.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False), flush=True)
    browser.close()
