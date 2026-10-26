"""Contract categories, full rule editing and audit-result evidence remain usable."""
from pathlib import Path
import json
import os
import tempfile
import traceback
import zipfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("AUDIT_UI_URL", "http://127.0.0.1:8765")
checks, failures, errors, layouts = [], [], [], []


class Session:
    def __init__(self, browser):
        self.context = browser.new_context(viewport={"width": 1366, "height": 768}, accept_downloads=True)
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)
        self.page.on("pageerror", lambda error: errors.append(str(error)))
        self.page.route("**/api/**", lambda route: route.abort())
        self.page.goto(URL + "/#tool/contract", wait_until="load")
        self.page.wait_for_function("typeof cwBase!=='undefined'")
        self.ev("loadSample()")

    def ev(self, code, arg=None):
        return self.page.evaluate(code, arg)

    def action(self, name, **data):
        return self.ev("x=>handleAction(x.name,{dataset:x.data})", {"name": name, "data": data})

    def click(self, name):
        self.page.locator('[data-action="' + name + '"]:visible').last.click()

    def category(self, name):
        self.page.locator('[data-cw-change="category"]').select_option(name)

    def fill_rule(self, title="付款资料核对"):
        values = {"title": title, "description": "摘录付款条件并核对所附付款凭证。",
                  "laws": "本次合同付款约定及提供的内部制度。", "judgment": "依据完整时按约定核对；依据不足时保留待核验。"}
        for key, value in values.items():
            self.page.locator('[data-cw-edit="' + key + '"]').fill(value)

    def reveal_format(self):
        details = self.page.locator("details.cw-extraction-format")
        if details.get_attribute("open") is None:
            details.locator("summary").click()

    def execute(self, name="合同交互验证"):
        self.click("run")
        assert self.ev("modal") == "tw-submit"
        self.page.locator("#tw-task-name").fill(name)
        self.click("tw-submit-confirm")
        self.page.wait_for_function("currentTask()?.status==='completed'", timeout=25000)

    def close(self):
        self.context.close()


def auto_semantics(s):
    s.category("自动")
    s.ev("""()=>{const c=ws().config;c.autoAnalysis=false;c.contractRules=[{
      title:'历史手动规则，不应在自动类别执行',description:'旧规则',laws:'旧依据',judgment:'旧标准',
      format:'compliance',expected:'',enabled:true}];c.checks=[c.contractRules[0].title];
      c.stages.compliance.content='';c.stages.information.content='';render();}""")
    assert not s.page.locator('[data-pg-prompt], .cw-rule-table').count()
    assert s.ev("validate(false)") == []
    payload = s.ev("configurationFragment('contract',ws().config)")
    assert payload["exec_mode"] == "custom"
    cfg = payload["custom_config"]
    assert cfg["contract_category"] == "auto" and cfg["button"] == 0
    assert cfg["parameter_settings"] == {"button": 0}
    assert cfg["parameter_template"] == '{"rules": []}' and cfg["prompt_uuid"] == "prompt"
    s.execute("自动类别保留原执行分支")
    assert s.ev("currentTask().configFragment") == payload
    assert not s.ev("currentTask().result.some(r=>r.check==='历史手动规则，不应在自动类别执行')")
    assert not s.page.locator(".cw-materials,.ew-grid>.ew-materials,.workbench>.workset").count()


def manual_rules_and_categories(s):
    s.ev("""()=>{const c=ws().config;c.contractRules=[];c.checks=[];c.contractRuleSets={};
      c.cwTypeKey=c.contractType;}""")
    s.category("施工类合同")
    s.ev("""()=>{const c=ws().config;c.contractRules=[];c.checks=[];c.autoAnalysis=false;
      c.stages.compliance.content='';c.stages.information.content='';render();}""")
    assert any("规则" in x for x in s.ev("validate(false)"))
    s.page.locator('[data-cw-change="auto"]').check()
    assert s.ev("validate(false)") == []
    s.page.locator('[data-cw-change="auto"]').uncheck()
    s.click("cw-rule-new")
    s.click("cw-rule-save")
    assert "请填写" in s.page.locator("#cw-rule-error").inner_text()
    s.fill_rule("施工付款条件核对")
    s.click("cw-rule-save")
    assert s.ev("ws().config.checks") == ["施工付款条件核对"]
    before = s.ev("JSON.stringify(ws().config.contractRules)")
    s.action("cw-rule", index="0")
    s.page.locator('[data-cw-edit="description"]').fill("取消时不应生效")
    s.click("close-modal")
    assert s.ev("JSON.stringify(ws().config.contractRules)") == before
    s.category("非施工类合同")
    s.click("cw-rule-new")
    s.fill_rule("非施工交付核对")
    s.click("cw-rule-save")
    assert s.ev("ws().config.checks") == ["非施工交付核对"]
    s.category("施工类合同")
    assert s.ev("ws().config.checks") == ["施工付款条件核对"]
    s.action("cw-rule", index="0")
    s.click("cw-rule-delete")
    assert s.ev("modal") == "cw-rule-delete-confirm"
    s.click("close-modal")
    assert s.ev("modal") == "cw-rule"
    assert s.ev("ws().config.contractRules.length") == 1
    s.click("cw-rule-delete")
    s.click("cw-rule-delete-confirm")
    assert s.ev("ws().config.contractRules.length") == 0
    s.category("非施工类合同")
    assert s.ev("ws().config.checks") == ["非施工交付核对"]


def format_buffers(s):
    s.category("施工类合同")
    s.click("cw-rule-new")
    s.fill_rule("多字段内容与文本缓冲")
    s.reveal_format()
    s.page.locator('[data-cw-edit="expected"]').fill("保留付款条件完整原文。")
    s.page.locator('[data-cw-change="format"]').select_option("completeness")
    s.click("cw-pair-add")
    s.page.locator('[data-cw-pair="key"]').last.fill("付款期限")
    s.page.locator('[data-cw-pair="value"]').last.fill("提取约定的付款时间。")
    s.page.locator('[data-cw-change="format"]').select_option("compliance")
    assert s.page.locator('[data-cw-edit="expected"]').input_value() == "保留付款条件完整原文。"
    s.page.locator('[data-cw-change="format"]').select_option("completeness")
    assert s.page.locator('[data-cw-pair="key"]').last.input_value() == "付款期限"
    assert s.page.locator('[data-cw-pair="value"]').last.input_value() == "提取约定的付款时间。"
    s.click("cw-rule-save")
    rule_index = s.ev("ws().config.contractRules.findIndex(r=>r.title==='多字段内容与文本缓冲')")
    cfg = s.ev("configurationFragment('contract',ws().config).custom_config.parameter_settings")
    saved = next(r for r in cfg["information_extraction"] if r["title"] == "多字段内容与文本缓冲")
    assert saved["extracted_value"] == {"付款期限": "提取约定的付款时间。"}
    for auxiliary in ["expected", "format", "data_format", "extracted_value_compliance", "extracted_value_completeness"]:
        assert auxiliary not in saved
    s.action("cw-rule", index=str(rule_index))
    s.page.locator('[data-cw-change="format"]').select_option("compliance")
    assert s.page.locator('[data-cw-edit="expected"]').input_value() == "保留付款条件完整原文。"
    s.click("cw-rule-save")
    s.action("cw-rule", index=str(rule_index))
    s.reveal_format()
    s.page.locator('[data-cw-change="format"]').select_option("completeness")
    assert s.page.locator('[data-cw-pair="key"]').last.input_value() == "付款期限"


def volume_and_scope(s):
    s.category("施工类合同")
    s.ev("""()=>{const c=ws().config;c.contractRules=Array.from({length:1000},(_,i)=>({
      title:'检查事项 '+i,description:'核对事项 '+i+' 的合同约定与所附资料。',laws:'合同约定。',
      judgment:'按已提供约定核对，不足时待核验。',format:'compliance',expected:'提取原文',enabled:true}));
      c.checks=c.contractRules.map(r=>r.title);cwView.query='';cwView.page=1;cwView.size=20;render();}""")
    assert s.page.locator(".cw-rule-table tbody tr").count() == 20
    s.page.locator('[data-cw-change="rule-page"]').uncheck()
    assert s.ev("ws().config.checks.length") == 980
    assert s.ev("ws().config.checks.includes('检查事项 999')")
    s.page.locator("#cw-rule-query").fill("999")
    assert s.page.locator(".cw-rule-table tbody tr").count() == 1
    s.page.locator('[data-cw-change="rule"]').uncheck()
    assert s.ev("ws().config.checks.length") == 979
    assert not s.ev("ws().config.checks.includes('检查事项 999')")
    assert s.ev("ws().config.checks.includes('检查事项 998')")
    payload = s.ev("configurationFragment('contract',ws().config)")
    assert len(payload["custom_config"]["parameter_settings"]["information_extraction"]) == 979
    s.click("cw-rule-all")
    assert s.ev("ws().config.checks.length") == 1000
    s.page.locator("#cw-rule-query").fill("")
    s.page.locator('[data-cw-change="rule-size"]').select_option("50")
    assert s.page.locator(".cw-rule-table tbody tr").count() == 50
    s.action("cw-rule-page", step="1")
    assert "检查事项 50" in s.page.locator(".cw-rule-table").inner_text()
    assert s.ev("ws().config.checks.length") == 1000
    for width, height in [(1366, 768), (1024, 480), (390, 600)]:
        s.page.set_viewport_size({"width": width, "height": height})
        s.ev("render();document.getElementById('toast').classList.remove('show')")
        if width <= 900:
            s.action("cw-panel", panel="config")
        metric = s.ev("""()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
          table:document.querySelector('.cw-rule-list .cw-table-scroll').getBoundingClientRect().toJSON(),
          pager:document.querySelector('.cw-rule-list .cw-pager').getBoundingClientRect().toJSON()})""")
        assert metric["scrollWidth"] <= width, metric
        assert metric["table"]["height"] >= 65, metric
        assert metric["pager"]["bottom"] <= height + 1, metric
        layouts.append(metric)
        s.page.screenshot(path=str(ROOT / "review" / f"contract-rules-{width}.png"))


def result_evidence_and_report(s):
    s.category("自动")
    s.execute("合同结果语义验证")
    s.ev("""()=>{const t=currentTask();t.config.contractType='施工类合同';
      t.config.contractRules=[{title:'付款约定',description:'核对付款',laws:'合同付款条款',
      judgment:'按约定核对',format:'compliance',expected:'原文',enabled:true}];t.config.checks=['付款约定'];
      t.result=[
      {doc:'d1',check:'布尔不符合',extracted_value:false,result:false,laws_and_regulations:'合同付款条款',judgment_rule:'需具备审批材料',analysis:'本次缺少支持资料。'},
      {doc:'d1',check:'零值核对',extracted_value:0,result:'True',criteria:'合同约定',analysis:'原文金额为零。'},
      {doc:'d1',check:'对象字段核对',extracted_value:{金额:0,已取得材料:false},result:'False',laws_and_regulations:'技术附件约定',judgment_rule:'核对金额和材料',analysis:'两个字段需要继续核验。',advice:'向业务部门补充材料。'},
      {doc:'d1',check:'仅已提取',extracted_value:'原文条款已摘录',judgment:'已提取',criteria:'合同原文',analysis:'摘录不是合规结论。'},
      {doc:'d1',check:'资料不足',extracted_value:'未取得附件',judgment:'资料不足',criteria:'合同附件',analysis:'无法作出判断。'},
      {doc:'d1',check:'字符串不符合',extracted_value:'付款早于约定时间',result:'False',criteria:'合同约定',analysis:'需核对实际支付凭证。'},
      {doc:'d1',check:'补充自动分析',extracted_value:'补充查找出的待核验内容',judgment:'待核验',autoAnalysis:true,criteria:'合同约定'}];render();}""")
    states = s.ev("cwNormalize(currentTask()).map(r=>({title:r.title,value:r.value,state:cwResultState(r)}))")
    assert states[0]["value"] is False and states[0]["state"] == "needs"
    assert states[1]["value"] == 0 and states[1]["state"] == "clear"
    assert states[2]["value"] == {"金额": 0, "已取得材料": False} and states[2]["state"] == "needs"
    assert states[3]["state"] == "unknown"
    assert states[4]["state"] == "insufficient"
    assert states[5]["state"] == "needs"
    snapshot = s.ev("JSON.stringify(currentTask())")
    s.action("cw-result-detail", index="2")
    assert s.page.locator(".cw-values dd").all_inner_texts() == ["0", "false"]
    body = s.page.locator("#ie-result-body").inner_text()
    for text in ["技术附件约定", "核对金额和材料", "两个字段需要继续核验", "补充材料"]:
        assert text in body, (text, body)
    assert s.ev("modal") == "source" and s.ev("modalData.ieReview")
    assert s.page.locator(".file-preview-pane").count() == 2
    assert s.page.locator('[data-ie-change="source"]').input_value() == "d1"
    s.page.locator('[data-action="ie-content"][data-tab="parsed"]').click()
    assert s.page.locator("#preview-parsed-content").is_visible()
    s.page.locator('[data-action="ie-content"][data-tab="finding"]').click()
    assert "技术附件约定" in s.page.locator("#ie-result-body").inner_text()
    s.page.keyboard.press("Escape")
    assert s.ev("modal") is None
    assert s.ev("JSON.stringify(currentTask())") == snapshot
    s.page.locator('[data-cw-change="result-status"]').select_option("unknown")
    assert s.page.locator(".cw-result-table tbody tr").count() == 1
    assert "仅已提取" in s.page.locator(".cw-result-table").inner_text()
    s.click("cw-result-reset")
    exported = s.ev("exportRows(currentTask(),'all')")
    assert len(exported) == 8
    assert exported[1][2] == "false" and exported[2][2] == "0"
    assert '"已取得材料": false' in exported[3][2]
    s.click("contract-report")
    s.page.wait_for_function("modal==='contract-report'")
    with tempfile.TemporaryDirectory() as tmp, s.page.expect_download() as event:
        s.click("cw-report-word")
        download = event.value
        target = Path(tmp) / download.suggested_filename
        download.save_as(target)
        assert target.suffix == ".docx"
        with zipfile.ZipFile(target) as z:
            assert z.testzip() is None
            text = z.read("word/document.xml").decode("utf-8")
            for fragment in ["技术附件约定", "合同结果语义验证", "false"]:
                assert fragment in text


def history_and_reanalysis(s):
    s.category("施工类合同")
    s.ev("""()=>{const c=ws().config;c.contractRules=[{title:'历史规则',description:'完整说明',
      laws:'合同约定',judgment:'按约定核验',format:'compliance',expected:'保留原文',enabled:true}];
      c.checks=['历史规则'];render();}""")
    s.execute("合同规则历史快照")
    task_id = s.ev("currentTask().id")
    snapshot = s.ev("JSON.stringify(currentTask())")
    s.action("tr-config", id=task_id)
    assert s.page.locator('[data-cw-change="category"]').is_disabled()
    assert s.page.locator('[data-cw-change="auto"]').is_disabled()
    assert s.page.locator('[data-cw-change="rule"]').is_disabled()
    s.action("cw-rule", index="0")
    assert s.page.locator('[data-cw-edit="title"]').get_attribute("readonly") is not None
    assert not s.page.locator('[data-action="cw-rule-save"],[data-action="cw-rule-delete"]').count()
    s.page.keyboard.press("Escape")
    assert s.ev("JSON.stringify(currentTask())") == snapshot
    s.action("new-analysis")
    assert s.ev("currentTask()") is None
    assert s.page.locator(".cw-workspace").is_visible()
    assert s.ev("ws().config.checks") == ["历史规则"]
    assert s.ev("id=>JSON.stringify(state.tasks.find(t=>t.id===id))", task_id) == snapshot


def result_source_boundaries(s):
    s.category("自动")
    s.execute("合同结果来源边界")
    s.ev("""()=>{const t=currentTask();t.ids=['d1'];t.successIds=['d1'];t.config.merge=true;
      t.attachments={d1:['d12']};t.result=[
      {doc:'d1',check:'自动分析文本保留',autoAnalysisText:'AUTO-TEXT-KEPT：仅返回说明文本也必须完整呈现。'},
      {doc:'d2',check:'TASK-OUTSIDE-BLOCKED',extracted_value:'OUTSIDE-PRIMARY-SECRET',result:'False'},
      {doc:'d1',refs:['d2'],check:'EXTERNAL-REF-BLOCKED',extracted_value:'OUTSIDE-REFERENCE-SECRET',result:'False'},
      {doc:'d1',refs:['d12'],check:'ATTACHMENT-ALLOWED',extracted_value:'合法技术附件支持本条核验。',result:'True'},
      {doc:'d12',check:'ATTACHMENT-DOC-ALLOWED',extracted_value:'附件作为本次分析的来源资料。',result:'True'}
      ];render();}""")
    normalized = s.ev("cwNormalize(currentTask()).map(r=>({title:r.title,valid:r.scopeValid,readable:cwReadable(r),value:r.value,analysis:r.analysis}))")
    assert normalized[0]["value"].startswith("AUTO-TEXT-KEPT")
    assert normalized[0]["analysis"].startswith("AUTO-TEXT-KEPT")
    assert normalized[0]["valid"] and normalized[0]["readable"]
    assert not normalized[1]["valid"] and not normalized[1]["readable"]
    assert not normalized[2]["valid"] and not normalized[2]["readable"]
    assert all(r["valid"] and r["readable"] for r in normalized[3:])
    visible = s.page.locator(".cw-results").inner_text()
    assert "AUTO-TEXT-KEPT" in visible and "ATTACHMENT-ALLOWED" in visible
    for forbidden in ["TASK-OUTSIDE-BLOCKED", "EXTERNAL-REF-BLOCKED", "OUTSIDE-PRIMARY-SECRET", "OUTSIDE-REFERENCE-SECRET"]:
        assert forbidden not in visible
    assert s.page.locator('.cw-result-filters option[value="d2"]').count() == 0
    s.action("cw-result-detail", index="1")
    assert s.ev("modal") is None
    assert "关联资料或权限已变化" in s.page.locator("#toast").inner_text()
    assert "OUTSIDE-PRIMARY-SECRET" not in s.page.locator("#modal-root").inner_text()
    s.action("cw-result-detail", index="3")
    assert s.ev("modal") == "source" and s.ev("modalData.ieReview")
    assert s.ev("ieCurrent().sources") == ["d1", "d12"]
    s.page.locator('[data-ie-change="source"]').select_option("d12")
    assert s.ev("modalData.id") == "d12"
    assert "合法技术附件支持本条核验" in s.page.locator("#ie-result-body").inner_text()
    s.page.keyboard.press("Escape")
    assert s.ev("modal") is None
    rows = s.ev("exportRows(currentTask(),'all')")
    report = s.ev("cwReportText(currentTask())")
    assert len(rows) == 4
    assert {r[1] for r in rows[1:]} == {"自动分析文本保留", "ATTACHMENT-ALLOWED", "ATTACHMENT-DOC-ALLOWED"}
    assert "AUTO-TEXT-KEPT" in report and "ATTACHMENT-ALLOWED" in report
    for forbidden in ["OUTSIDE-PRIMARY-SECRET", "OUTSIDE-REFERENCE-SECRET"]:
        assert forbidden not in json.dumps(rows, ensure_ascii=False) and forbidden not in report
    s.click("export")
    s.page.locator("#export-format").select_option("json")
    with tempfile.TemporaryDirectory() as tmp, s.page.expect_download() as event:
        s.click("do-export")
        download = event.value
        target = Path(tmp) / download.suggested_filename
        download.save_as(target)
        text = target.read_text(encoding="utf-8-sig")
        payload = json.loads(text)
        assert len(payload["results"]) == 3
        for forbidden in ["TASK-OUTSIDE-BLOCKED", "EXTERNAL-REF-BLOCKED", "OUTSIDE-PRIMARY-SECRET", "OUTSIDE-REFERENCE-SECRET"]:
            assert forbidden not in text
        assert "AUTO-TEXT-KEPT" in text and "ATTACHMENT-ALLOWED" in text
    # A recorded attachment excluded from execution cannot become evidence simply
    # because the user has permission to read it elsewhere in the document library.
    s.ev("currentTask().config.merge=false;render()")
    assert s.ev("cwFiltered(currentTask()).map(r=>r.title)") == ["自动分析文本保留"]
    assert len(s.ev("exportRows(currentTask(),'all')")) == 2


cases = [
    ("自动类别保留原始自动分支：无手工提示词/规则要求、button=0可执行，忽略留存的手动规则", auto_semantics),
    ("手动类别保留无规则补充分析、四字段校验、分类草稿、编辑取消和删除确认", manual_rules_and_categories),
    ("文本与键值对象来回切换、保存重开保留双缓冲，提交剥离全部UI辅助字段", format_buffers),
    ("1000条规则分页检索与本页勾选保留其他页，全部选择和请求范围完整，小屏分页可达", volume_and_scope),
    ("结果保留字符串/对象/0/false与判断语义、依据原文返回、完整导出及Word报告", result_evidence_and_report),
    ("自动分析纯文本保留，任务外显式来源在页面/详情/表格/JSON/报告均隔离，已参与分析附件可核验", result_source_boundaries),
    ("历史规则只读、资料和配置可沿用再分析，原任务快照保持不变", history_and_reanalysis),
]
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox"])
    for label, case in cases:
        session = None
        try:
            session = Session(browser)
            case(session)
            checks.append(label)
            print("PASS " + label, flush=True)
        except Exception as exc:
            detail = traceback.format_exc()
            failures.append({"case": label, "error": detail})
            print("FAIL " + label + "\n" + detail, flush=True)
            if session:
                session.page.screenshot(path=str(ROOT / "review" / ("contract-failure-" + str(len(failures)) + ".png")))
        finally:
            if session:
                session.close()
    browser.close()

report = {"checks": checks, "failures": failures, "errors": errors, "layouts": layouts}
(ROOT / "review" / "contract-workflow-checks.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False), flush=True)
assert not failures and not errors, (failures, errors)
