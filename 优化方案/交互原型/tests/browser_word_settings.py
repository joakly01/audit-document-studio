"""Word configuration clarity, bounded word lists, staged maintenance and immutable task snapshots."""
from pathlib import Path
import tempfile,json
from playwright.sync_api import sync_playwright
root=Path.cwd();checks=[];errors=[];layouts=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);g=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce',accept_downloads=True);g.set_default_timeout(10000);g.on('pageerror',lambda e:(errors.append(str(e)),print('Browser error:',e.stack,flush=True)));g.goto('http://127.0.0.1:8765/#tool/word',wait_until='load');g.wait_for_function("typeof wcBase!=='undefined'");g.evaluate('taskDemoReady')
 def ev(s):return g.evaluate(s)
 def act(a,**d):return g.evaluate('x=>handleAction(x.a,{dataset:x.d})',{'a':a,'d':d})
 def click(a):g.locator('[data-action='+a+']:visible').last.click()
 ev("nav('tool','word');loadSample();state.stopwords=Array.from({length:85},(_,i)=>'排除词'+i);state.newwords=['专项资金','园区建设中心'];ws().config.lexiconSelection={stop:[],user:['专项资金']};render()")
 assert '设置统计规则' in g.locator('.wc-config').inner_text();assert g.locator('.wc-rule-card').count()==2
 act('wc-select',kind='stop');assert g.locator('.wc-choice-table tbody tr').count()==20;g.locator('[data-wc-change=page]').check();assert ev('editorDraft.stop.length')==20
 click('wc-page');assert '第 2 / 5 页' in g.locator('.wc-pagination').inner_text();click('wc-all');assert ev('editorDraft.stop.length')==85
 click('v2-word-none');assert not ev('editorDraft.stop.length')
 # A Chinese IME preedit must not rebuild the focused search box.
 g.locator('#wc-query').focus();ev("window.wcImeInput=document.getElementById('wc-query');wcImeInput.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));wcImeInput.value='排除词8';wcImeInput.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'排除词8'}))");assert ev('wcImeInput.isConnected');ev("wcImeInput.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'排除词8'}))");g.wait_for_function("modalData.query==='排除词8'");assert g.locator('.wc-choice-table tbody tr').count()==6
 click('wc-all');assert ev('editorDraft.stop.length')==6;assert not ev('ws().config.lexiconSelection.stop.length')
 # Maintenance is a draft. Canceling it returns to the original task selection.
 click('wc-manage');click('aw-lex-add');g.locator('#aw-word-value').fill('新排除词');click('aw-lex-word-save');assert not ev("state.stopwords.includes('新排除词')");g.keyboard.press('Escape');assert ev("modal==='aw-discard'");click('aw-discard');assert ev("modal==='v2-word-selection'");assert ev('editorDraft.stop.length')==6
 click('wc-manage');act('wc-kind',kind='user');click('aw-lex-import');g.locator('#aw-lex-text').fill('排除词8\n专项资金\n资金统筹');click('aw-lex-preview');assert ev('modalData.rows.filter(r=>r.issue).length')==2
 act('aw-import-decide',line='1',decision='overwrite');click('aw-lex-commit');assert not ev("state.newwords.includes('资金统筹')");click('aw-lex-save');assert ev("modal==='v2-word-selection'");assert ev("state.newwords.includes('资金统筹')&&!state.stopwords.includes('排除词8')");assert ev('editorDraft.stop.length')==5
 act('wc-kind',kind='user');g.locator('[data-wc-change=word][value=资金统筹]').check();click('v2-save-editor');assert ev("ws().config.lexiconSelection.user.includes('资金统筹')");assert ev('ws().config.lexiconSelection.stop.length')==5
 checks.append('85词分5页、本页与全部页选择、筛选保持勾选、中文输入法、取消与保存、跨类型冲突覆盖')
 click('lexicon');act('wc-kind',kind='user');click('aw-lex-import');g.locator('#aw-lex-file').set_input_files({'name':'新词.json','mimeType':'application/json','buffer':json.dumps({'user_dict_words':['预算绩效管理']}).encode()});g.wait_for_function("document.getElementById('aw-lex-text').value==='预算绩效管理'");assert '新词.json' in g.locator('#wc-file-name').inner_text();click('aw-lex-preview');click('aw-lex-commit');click('aw-lex-save');assert ev("state.newwords.includes('预算绩效管理')")
 click('lexicon')
 with g.expect_download() as info:click('aw-lex-export')
 target=Path(tmp)/'lexicon.json';info.value.save_as(target);assert '预算绩效管理' in json.loads(target.read_text())['user_dict_words'];g.keyboard.press('Escape')
 act('wc-top',value='50');assert ev('ws().config.top')==50;g.locator('#aw-top').fill('9');g.locator('#aw-top').dispatch_event('change');assert any('10' in s for s in ev('validate(false)'));act('wc-top',value='30')
 click('run');click('aw-submit-words');assert ev("modal==='v2-word-selection'");click('v2-save-editor');assert ev("modal==='aw-submit'");click('aw-submit-confirm');g.wait_for_function("currentTask()?.status==='completed'");snapshot=ev('JSON.stringify({config:currentTask().config,stop:currentTask().stopwords,user:currentTask().newwords})');task_id=ev('currentTask().id')
 click('v2-word-selection');assert not g.locator('.wc-selection-dialog input[type=checkbox]').count();assert not g.locator('[data-action=wc-manage]').count();g.keyboard.press('Escape');ev("state.stopwords.push('后续新增');state.newwords=[];persist()");assert ev('JSON.stringify({config:currentTask().config,stop:currentTask().stopwords,user:currentTask().newwords})')==snapshot
 checks.append('JSON文件导入、真实词库下载、展示词数校验、提交前选择、历史快照只读与词库隔离')
 # Dense lists and import controls remain within small embedded windows.
 for w,h in [(1366,768),(1024,480),(390,600)]:
  g.set_viewport_size({'width':w,'height':h});ev("nav('tool','word');ws().config.lexiconSelection={stop:[],user:[]};render()")
  if w<=900:act('tw-panel',panel='fields')
  act('wc-select',kind='stop');box=g.locator('.wc-dialog').bounding_box();assert box['y']>=0 and box['y']+box['height']<=h+1,(w,box);assert ev('document.documentElement.scrollWidth')<=w
  foot=g.locator('.wc-dialog .modalfoot').bounding_box();table=g.locator('.wc-table-scroll').bounding_box();assert table['height']>=65 and table['y']+table['height']<=foot['y']+1,(w,table,foot)
  g.screenshot(path=str(root/f'review/word-selection-{w}.png'));click('wc-manage');box=g.locator('.wc-dialog').bounding_box();assert box['y']>=0 and box['y']+box['height']<=h+1;assert g.locator('.aw-lex-table tbody tr').count()<=20
  g.screenshot(path=str(root/f'review/word-library-{w}.png'));click('aw-lex-import');box=g.locator('.wc-child-dialog').bounding_box();assert box['y']>=0 and box['y']+box['height']<=h+1;g.keyboard.press('Escape');g.keyboard.press('Escape');g.keyboard.press('Escape');layouts.append({'width':w,'height':h,'modal':box})
 assert not errors,errors
 (root/'review/word-settings-checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'layouts':layouts,'errors':errors},ensure_ascii=False));b.close()
