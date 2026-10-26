"""Bidding preparation keeps project roles and prompt-bound rules at scale."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("AUDIT_UI_URL", "http://127.0.0.1:8765")
checks, errors, layouts = [], [], []
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1366, "height": 768}, accept_downloads=True)
    page.set_default_timeout(15000)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL + "/#tool/bidding", wait_until="load")
    page.wait_for_function("typeof baBase!=='undefined'")

    def ev(code, arg=None):
        return page.evaluate(code, arg)

    def action(name, **data):
        return ev("x=>handleAction(x.name,{dataset:x.data})", {"name": name, "data": data})

    def click(name):
        page.locator('[data-action="' + name + '"]:visible').last.click()

    def note(text):
        checks.append(text)
        print(text, flush=True)

    assert page.locator(".ba-layout").count() == 1
    assert not page.locator("#ef-raw-content,.tw-preview,.ba-config input[type=checkbox][data-change=risk-check]").count()
    assert ev("BA_MODES.map(([k])=>baRules(ws().config,k).length)") == [7, 1, 7]
    ev("loadSample()")
    assert ev("validate(false)") == []
    initial = ev("JSON.stringify(ws().projects)")
    ids = ev("[...ws().ids]")
    for mode in ["tender", "bid"]:
        page.locator('[data-ba-change="mode"][value="' + mode + '"]').check()
    assert ev("ws().modes") == ["tender", "bid", "joint"]
    assert ev("JSON.stringify(ws().projects)") == initial
    assert ev("ws().ids") == ids
    for mode in ["tender", "bid", "joint"]:
        click_mode = page.locator('[data-action="ba-stage"][data-stage="' + mode + '"]')
        click_mode.click()
        assert page.locator('[data-pg-prompt="' + mode + '"]').input_value() == "system"
    for mode in ["tender", "bid"]:
        page.locator('[data-ba-change="mode"][value="' + mode + '"]').uncheck()
    page.locator('[data-ba-change="mode"][value="joint"]').click()
    assert ev("ws().modes") == ["joint"]
    note("两栏准备页取消常驻原文；三模式独立多选和查看，切换不改变项目、单位与文件，至少保留一种模式")

    # Original tender selection is single-document replacement.
    original_tender = ev("[...baProject().tender]")
    page.locator('[data-action="pick-bid"][data-role="tender"]').click()
    ev("""()=>{const d=file('d7');modalData.space=d.space;modalData.folder=d.folder;
      modalData.query='';modalData.recursive=true;modalData.page=1;paintModal();}""")
    assert page.locator('[data-change="picker-check"][data-id="d7"]').get_attribute("type") == "radio"
    assert not page.locator('#modal-root [data-action="picker-all"],#modal-root [data-change="picker-page"]').count()
    page.locator('[data-change="picker-check"][data-id="d7"]').check()
    assert ev("modalData.selected") == ["d7"]
    click("close-modal")
    assert ev("baProject().tender") == original_tender
    page.locator('[data-action="pick-bid"][data-role="tender"]').click()
    ev("modalData.selected=['d7'];paintModal()")
    click("confirm-picker")
    assert ev("baProject().tender") == ["d7"]
    ev("loadSample()")
    note("招标文件单选并替换原关联；取消保持原配置，投标文件仍按单位支持多选与跨页选择")

    # Undo must restore the file's actual business role, not only selected IDs.
    ev("""()=>{window.baUndoFixture={ids:[...ws().ids],projects:structuredClone(ws().projects),
      unassigned:[...(ws().unassigned||[])],preview:ws().preview};
      ws().unassigned=['d1'];syncBidIds();render();}""")
    for remove_action, doc_id in [("remove-file", "d6"), ("tw-remove", "d7"), ("remove-file", "d1")]:
        ev("id=>{ws().preview=id;render();}", doc_id)
        before_remove = ev("""JSON.stringify({ids:ws().ids,projects:ws().projects,
          unassigned:ws().unassigned,preview:ws().preview})""")
        action(remove_action, id=doc_id)
        assert doc_id not in ev("ws().ids"), (remove_action, doc_id)
        assert not ev("""id=>ws().projects.some(p=>p.tender.includes(id)||
          p.bidders.some(b=>b.files.includes(id)))""", doc_id)
        assert doc_id not in ev("ws().unassigned"), (remove_action, doc_id)
        assert ev("id=>!file(id).deleted", doc_id)
        page.locator("#undo-toast").click()
        after_undo = ev("""JSON.stringify({ids:ws().ids,projects:ws().projects,
          unassigned:ws().unassigned,preview:ws().preview})""")
        assert after_undo == before_remove, (remove_action, doc_id)
    before_role_remove = ev("""JSON.stringify({ids:ws().ids,projects:ws().projects,
      unassigned:ws().unassigned,preview:ws().preview})""")
    page.locator('[data-action="remove-bidfile"][data-id="d7"]').click()
    assert not ev("ws().projects[0].bidders[0].files.includes('d7')")
    page.locator("#undo-toast").click()
    assert ev("""JSON.stringify({ids:ws().ids,projects:ws().projects,
      unassigned:ws().unassigned,preview:ws().preview})""") == before_role_remove
    ev("Object.assign(ws(),structuredClone(baUndoFixture));render()")
    assert ev("JSON.stringify(ws().projects)") == initial
    assert ev("ws().ids") == ids
    note("移除招标、投标及待归组资料后撤销，完整还原项目/单位角色、已选ID、待分配清单及预览；原文件保留")

    # Named project and bidder creation; cancel leaves scope unchanged.
    click("add-project")
    assert ev("modal") == "bam-entity"
    click("close-modal")
    assert ev("JSON.stringify(ws().projects)") == initial
    click("add-project")
    page.locator('#bam-entity-name').fill("审计业务平台采购项目")
    click("bam-save-entity")
    assert ev("baProject().name") == "审计业务平台采购项目"
    assert ev("validate(false)") == []
    empty_id = ev("baProject().id")
    ev("baProject().tender=['d6'];syncBidIds();render()")
    assert any("投标文件" in x for x in ev("validate(false)"))
    click("add-bidder")
    page.locator('#bam-entity-name').fill("审计信息技术有限公司")
    click("bam-save-entity")
    assert ev("baProject().bidders[0].name") == "审计信息技术有限公司"
    action("remove-project", id=empty_id)
    assert ev("JSON.stringify(ws().projects)") == initial
    assert ev("ws().ids") == ids
    ev("ws().projects.push({id:'blank-placeholder',name:'',tender:[],bidders:[]});ws().projects[0].name='';render()")
    assert "请填写项目名称" in ev("validate(false)")
    ev("ws().projects.pop();ws().projects[0].name='设备采购项目';render()")
    page.locator('.ba-file [data-action="source"]').first.click()
    assert ev("modal") == "source"
    assert page.locator(".file-preview-pane").count() == 2
    page.keyboard.press("Escape")
    note("填写名称后新增项目、单位与文件关联；未配置的空项目不影响已就绪项目，有文件的未完整项目仍拦截；原文保留双栏按需查看")

    # The prompt owns the whole rule list; search and pagination never narrow execution.
    ev("""()=>{state.templates.push({id:'ba-large-personal',kind:'prompt',scope:'personal',
      toolId:'bidding',stage:'joint',functionType:'Bidding_Analysis',name:'个人联合核查',
      prompt:'逐项执行以下检查，保留规则编号与证据。',promptConfig:{bidding:{joint:{
      templateId:'personal-joint',ruleIds:Array.from({length:1000},(_,i)=>'custom-'+i),
      rules:Array.from({length:1000},(_,i)=>({id:'custom-'+i,name:'检查规则 '+i,
      description:'核对第 '+i+' 项招标要求与投标响应，保留原文位置。'}))}}}});render();}""")
    snapshot = ev("JSON.stringify(ws().config)")
    page.locator('[data-pg-prompt="joint"]').select_option("p:ba-large-personal")
    assert ev("modal") == "pg-prompt-confirm"
    assert ev("JSON.stringify(ws().config)") == snapshot
    click("close-modal")
    assert page.locator('[data-pg-prompt="joint"]').input_value() == "system"
    page.locator('[data-pg-prompt="joint"]').select_option("p:ba-large-personal")
    click("pg-confirm-prompt")
    assert page.locator(".ba-rule-table tbody tr").count() == 20
    original_payload = ev("configurationFragment('bidding',ws().config)")
    assert len(original_payload["mode_configs"][0]["rule_ids"]) == 1000
    assert original_payload["mode_configs"][0]["mode"] == "joint_only"
    assert original_payload["projects"][0]["bidding_file"]["file_uuid"] == "d6"
    assert len(original_payload["projects"][0]["tender_companies"]) == 2
    page.locator("#ba-rule-query").fill("999")
    assert page.locator(".ba-rule-table tbody tr").count() == 1
    assert "检查规则 999" in page.locator(".ba-rule-table").inner_text()
    assert ev("configurationFragment('bidding',ws().config)") == original_payload
    page.locator('.ba-rule-table [data-action="ba-rule-detail"]').first.click()
    assert "第 999 项" in page.locator(".ba-rule-detail").inner_text()
    click("ba-detail-prompt")
    assert ev("modal") == "aw-prompt"
    page.locator("#prompt-editor").fill("逐项核对全部规则，明确招投标响应差异与原文证据。")
    click("aw-prompt-save")
    assert len(ev("baRules(ws().config,'joint')")) == 1000
    assert ev("ws().config.stages.joint.customized")
    page.locator("#ba-rule-query").fill("")
    page.locator('[data-ba-change="size"]').select_option("50")
    assert page.locator(".ba-rule-table tbody tr").count() == 50
    click("ba-rule-page")
    assert "检查规则 50" in page.locator(".ba-rule-table").inner_text()
    note("1000项提示词配套规则完整保留，检索、分页与详情只影响浏览；编辑正文不丢规则ID，切换配套规则先确认")

    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        page.set_viewport_size({"width": width, "height": height})
        ev("render();document.getElementById('toast').classList.remove('show')")
        if width <= 800:
            click("ba-panel")
        metric = ev("""()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,
          table:document.querySelector('.ba-rule-table-wrap').getBoundingClientRect().toJSON(),
          pager:document.querySelector('.ba-rule-pager').getBoundingClientRect().toJSON()})""")
        assert metric["scroll"] <= width, metric
        assert metric["table"]["height"] >= 70, metric
        assert metric["pager"]["bottom"] <= height + 1, metric
        layouts.append(metric)
        page.screenshot(path=str(ROOT / "review" / f"bidding-rules-{width}.png"))
    note("1366、1024×480及390×600下规则列表独立滚动，分页可见；小屏切换资料与规则，无横向溢出")

    page.set_viewport_size({"width": 1366, "height": 768})
    final_payload = ev("configurationFragment('bidding',ws().config)")
    click("run")
    assert ev("modal") == "tw-submit"
    page.locator("#tw-task-name").fill("联合检查执行快照")
    click("tw-submit-confirm")
    page.wait_for_function("currentTask()?.status==='completed'", timeout=25000)
    task_id = ev("currentTask().id")
    assert ev("currentTask().configFragment") == final_payload
    assert ev("currentTask().result.length") > 0
    assert not page.locator(".ba-materials").count()
    snapshot = ev("JSON.stringify(currentTask())")
    action("tr-config", id=task_id)
    assert page.locator('[data-pg-prompt="joint"]').is_disabled()
    assert page.locator('[data-ba-change="mode"]').first.is_disabled()
    action("ba-rule-detail", stage="joint", id="custom-999")
    assert not page.locator('[data-action="ba-detail-prompt"]').count()
    page.keyboard.press("Escape")
    assert ev("JSON.stringify(currentTask())") == snapshot
    action("new-analysis")
    assert page.locator(".ba-workspace").is_visible()
    assert ev("ws().taskId") is None
    assert len(ev("baRules(ws().config,'joint')")) == 1000
    assert ev("JSON.stringify(state.tasks.find(t=>t.id==='" + task_id + "'))") == snapshot
    note("实际提交保留模式、提示词正文、全部规则ID与项目文件；任务信息只读，再次分析保留配置并不改原记录")
    assert not errors, errors
    (ROOT / "review" / "bidding-workflow-checks.json").write_text(
        json.dumps({"checks": checks, "layouts": layouts, "errors": errors}, ensure_ascii=False, indent=2))
    browser.close()
