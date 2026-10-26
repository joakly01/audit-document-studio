import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');page.set_default_timeout(7000);page.on('pageerror',lambda e:errors.append(str(e)))
 def ev(s):return page.evaluate(s)
 def click(a,attrs=''):
  selector='[data-action="'+a+'"]'+attrs
  if not page.locator(selector+':visible').count():
   parent=page.locator('.progress-head-more').filter(has=page.locator(selector)).last
   if parent.count():parent.locator('summary').click()
  page.locator(selector+':visible').last.click()
 def check(s):checks.append(s);print(len(checks),s,flush=True)
 page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');ev('localStorage.clear()');page.reload(wait_until='networkidle');page.wait_for_function("typeof progressRows==='function'");ev('libraryStatusDataReady')
 ev("""async()=>{
  state.docs=state.docs.filter(d=>!d.statusCatalog&&!d.catalogSeed);state.uploads=state.uploads.filter(r=>!r.statusCatalog);
  window.seedProgress=(id,name,space,status,extra={})=>{const doc={id,name,type:'TXT',space,folder:space==='个人空间'?'审计核查':'资料归档',local:status!=='done',owner:'当前用户',text:status==='done'?'已完成的审计全文':undefined,parseError:status==='failed'?'识别服务返回失败':null,date:'2026-10-18',size:'1 KB',...extra};state.docs.push(doc);state.uploads.push({id,name,status:status==='uploading'?'正在上传':status==='processing'?'正在解析':status==='done'?'可分析':status==='failed'?'解析失败':status==='stuck'?'已停止':'未解析',contentStatus:status,progress:status==='uploading'?45:status==='done'?100:20,updatedAt:'2026-10-18T01:02:03.000Z',bucket:'audit-original'});return doc;};
  seedProgress('r-fail','失败资料.txt','个人空间','failed');seedProgress('r-stuck','积压资料.txt','个人空间','stuck');seedProgress('r-upload','上传中资料.txt','个人空间','uploading');seedProgress('r-process','识别中资料.txt','个人空间','processing');seedProgress('r-done','完成资料.txt','个人空间','done');seedProgress('r-other','其他用户的私人文件.txt','个人空间','done',{uploader_id:'other-user'});seedProgress('r-oss','OSS缺失全文.txt','公共空间','failed',{source:'OSS'});seedProgress('r-ossbusy','OSS正在识别.txt','公共空间','processing',{source:'OSS'});seedProgress('r-ossdone','OSS已有全文.txt','公共空间','done',{source:'OSS'});seedProgress('r-badspace','不应出现的私人OSS.txt','个人空间','failed',{source:'OSS'});seedProgress('r-noauth','不可见记录.txt','公共空间','failed',{folder:'无权目录'});folderMeta[directoryKey('公共空间','无权目录')]={permission:'NONE'};
  for(let n=0;n<35;n++)seedProgress('r-page-'+n,'分页核查-'+n+'.txt','个人空间','done');
  await libStoreFile('r-fail',new File(['真实审计核验全文'],'失败资料.txt',{type:'text/plain'}));await libStoreFile('r-oss',new File(['OSS归档识别全文'],'OSS缺失全文.txt',{type:'text/plain'}));state.space='个人空间';state.folder='全部资料';render();persist();
 }""")
 click('upload-records');assert page.locator('.progress-stat').count()==5
 assert not ev("progressRows('全部空间').some(r=>['r-other','r-badspace','r-noauth'].includes(r.id))")
 assert not page.locator('[data-action="progress-admin"]').count();assert not page.locator('[data-action="lib-record-fill"]').count()
 assert page.locator('[aria-label="上传记录状态"] option').all_text_contents()==['全部状态','上传中','排队中','识别中','已完成','失败','积压','失败 / 积压']
 assert '本人' in page.locator('.progress-scope').inner_text()
 ev("(()=>{const d=seedProgress('r-raw','后台状态资料.txt','个人空间','done',{file_id:'original-file-uuid'}),r=state.uploads.find(r=>r.id==='r-raw');r.contentStatus=null;r.status='failed';r.updated_at='2026-10-17T01:02:03Z';delete r.updatedAt;})()");assert ev("progressRows('个人空间').find(r=>r.id==='r-raw').status==='failed'&&progressRows('个人空间').find(r=>r.id==='r-raw').fileId==='original-file-uuid'&&progressTime('2026-10-17T01:02:03Z')==='2026-10-17 09:02:03'")
 check('原六类状态、五项汇总、本人范围及查看权限核对；OSS仅公共空间；普通用户无服务管理入口')
 page.locator('[aria-label="上传记录每页数量"]').select_option('10');assert page.locator('.progress-table tbody tr').count()==10
 page.locator('[data-progress-change="page-check"]').check();assert len(ev('modalData.selected'))==10;click('lib-record-next');page.locator('[data-progress-change="page-check"]').check();assert len(ev('modalData.selected'))==20
 page.locator('#progress-page-jump').fill('3');click('progress-jump');assert ev('modalData.page')==3
 page.locator('#progress-page-jump').fill('999');click('progress-jump');assert ev('modalData.page')==3
 click('lib-record-space','[data-space="公共空间"]');assert page.locator('[aria-label="上传记录来源"]').is_visible();page.locator('[aria-label="上传记录来源"]').select_option('OSS');assert ev('progressFiltered().every(r=>r.source==="OSS")')
 click('lib-record-space','[data-space="个人空间"]');assert ev('modalData.page')==3 and len(ev('modalData.selected'))==20
 check('10/15/20/30/50/100条页容量、页码跳转、跨页全选；各空间独立保留筛选/页码/勾选')
 # Real timer tick keeps unsent input drafts and the current selection.
 page.clock.install();click('lib-record-auto');before=ev('modalData.refreshCount||0');page.locator('#lib-record-query').fill('失败资料');page.clock.run_for(8100);assert ev('modalData.refreshCount')>before;assert page.locator('#lib-record-query').input_value()=='失败资料' and ev('modalData.query')==''
 page.locator('#lib-record-query').press('Enter');assert page.locator('.progress-table tbody tr').count()==1;assert '失败资料.txt' in page.locator('.progress-table tbody').inner_text();click('lib-record-auto');assert ev('recordsAutoTimer===null')
 page.locator('#lib-record-query').fill('');click('progress-search');click('progress-stat','[data-status="problem"]');assert ev('progressFiltered().every(r=>["failed","stuck"].includes(r.status))');page.locator('[aria-label="上传记录状态"]').select_option('')
 check('查询支持Enter；统计卡筛选失败/积压；8秒自动刷新真实触发，输入草稿与选择不丢，停止后清理计时器')
 click('progress-detail','[data-id="r-upload"]');assert '上传45%' in page.locator('.progress-timeline').inner_text().replace('\n','');assert 'audit-original' in page.locator('.modalbody').inner_text();assert 'r-upload' in page.locator('.modalbody').inner_text();assert not page.locator('[data-action="progress-open"]').count();page.keyboard.press('Escape')
 click('progress-detail','[data-id="r-done"]');click('progress-open');assert ev("modal==='source'");page.keyboard.press('Escape');assert ev("modal==='progress-detail'");page.keyboard.press('Escape');assert ev("modal==='upload-records'")
 check('上传百分比与全文识别分阶段展示；文件ID/存储桶/目录/更新时间在详情；仅完成可看全文，返回保留记录状态')
 ev("modalData.selected=['r-fail','r-done','r-process'];paintModal()");click('lib-record-retry');assert ev('modalData.ids')==['r-fail'] and ev('modalData.skipped')==2;page.keyboard.press('Escape');assert ev("progressRows('个人空间').find(r=>r.id==='r-fail').status")== 'failed'
 click('lib-record-retry');click('progress-confirm-retry');page.clock.run_for(20);page.wait_for_function("progressRows('个人空间').find(r=>r.id==='r-fail').status==='done'");assert ev("file('r-fail').text")=='真实审计核验全文';assert '已入队 1' in page.locator('.progress-notice').inner_text()
 check('批量重新识别需确认；跳过完成/识别中记录；取消不改任务；实际文件重新解析后才成为完成')
 ev("modalData.selected=['r-stuck'];paintModal()");click('lib-record-retry');click('progress-confirm-retry');page.clock.run_for(20);page.wait_for_function('!!modalData.notice&&modalData.notice.includes("需在详情")');assert ev("progressRows('个人空间').find(r=>r.id==='r-stuck').status")== 'stuck'
 click('progress-detail','[data-id="r-stuck"]');click('progress-reselect');page.locator('#progress-source-file').set_input_files({'name':'错误文件.txt','mimeType':'text/plain','buffer':b'abc'});assert '名称或大小不一致' in page.locator('#lib-error').inner_text();page.locator('#progress-source-file').set_input_files({'name':'积压资料.txt','mimeType':'text/plain','buffer':'积压核查资料原文'.encode()});page.clock.run_for(20);page.wait_for_function("progressRows('个人空间').find(r=>r.id==='r-stuck').status==='done'")
 check('原文件缺失不虚报成功；补充原文件校验名称/大小/权限，可恢复解析')
 ev("async()=>{seedProgress('r-local-empty','本地缺失全文.txt','个人空间','failed');await libStoreFile('r-local-empty',new File(['本地正文补全完成'],'本地缺失全文.txt',{type:'text/plain'}));modalData.query=modalData.queryDraft='无匹配条件';paintModal();}");click('progress-local-fill');assert ev('modalData.ids')==['r-local-empty'];assert '不含 OSS' in page.locator('.modalhead').inner_text();click('progress-confirm-retry');page.clock.run_for(20);page.wait_for_function("progressRows('个人空间').find(r=>r.id==='r-local-empty').status==='done'");assert ev("file('r-local-empty').text")=='本地正文补全完成'
 check('本地空全文批量补全保留，按当前空间和权限处理，不混入OSS、不受文件名筛选影响')
 click('lib-record-space','[data-space="公共空间"]');ev("state.libraryAdmin=true;paintModal()");assert page.locator('[data-action="lib-record-fill"]').is_visible()
 page.locator('#lib-record-query').fill('不存在的文件');click('progress-search');assert ev('progressFiltered().length')==0
 click('lib-record-fill');assert '不受当前筛选影响' in page.locator('.modalhead').inner_text();assert ev('modalData.ids')==['r-oss'];assert ev('modalData.skipped')==1
 click('progress-confirm-retry');page.clock.run_for(20);page.wait_for_function("progressRows('公共空间').find(r=>r.id==='r-oss').status==='done'");assert ev("file('r-oss').text")=='OSS归档识别全文'
 check('OSS补全文覆盖公共空间缺全文资料，不受筛选影响，不重复加入识别中任务，返回可用结果')
 click('progress-admin');assert page.locator('#lib-concurrency-local').get_attribute('max')=='4';assert page.locator('#lib-concurrency-oss').get_attribute('max')=='32';old=ev('storageQuota.concurrencyLocal');page.locator('#lib-concurrency-local').fill('5');click('lib-record-save-concurrency');assert '上限' in page.locator('#lib-error').inner_text();assert ev('storageQuota.concurrencyLocal')==old
 page.locator('#lib-concurrency-local').fill('1');page.locator('#lib-concurrency-oss').fill('1');click('lib-record-save-concurrency');assert ev('storageQuota.concurrencyLocal===1&&storageQuota.concurrencyOss===1')
 check('仅管理员修改并发；沿用后台可变上限，本地默认最大4/OSS32；越界不保存，保存驱动实际队列')
 # Hold real parsing promises, so clearing a pending queue can be distinguished from cancelling active work.
 ev("""()=>{window.progressResolvers=[];for(const [id,source] of [['q1','LOCAL'],['q2','LOCAL'],['q3','LOCAL'],['qo1','OSS'],['qo2','OSS']]){const d=seedProgress(id,id+'.txt',source==='OSS'?'公共空间':'个人空间','pending',{source}),r=state.uploads.find(x=>x.id===id),f=new File(['正文'],id+'.txt',{type:'text/plain'});r.contentStatus=null;f.text=()=>new Promise(resolve=>progressResolvers.push(resolve));uploadSources.set(id,f);parseUploadRecord(r,d,f);}paintModal();}""")
 assert ev('libParseActive.LOCAL===1&&libParseActive.OSS===1') and ev('libParseQueue.length')==3
 click('progress-admin');click('lib-record-clear');page.locator('[data-progress-change="clear"][value="OSS"]').uncheck();click('lib-record-confirm-clear');assert ev('libParseQueue.length')==1 and ev('libParseActive.LOCAL===1&&libParseActive.OSS===1');assert ev("file('q2').deleted!==true&&state.uploads.find(r=>r.id==='q2').queueCleared===true");assert '本地 2 条' in page.locator('.progress-notice').inner_text()
 click('progress-admin');click('lib-record-clear');page.locator('[data-progress-change="clear"][value="LOCAL"]').uncheck();page.locator('[data-progress-change="clear"][value="OSS"]').uncheck();click('lib-record-confirm-clear');assert '至少选择一项' in page.locator('#lib-error').inner_text()
 page.locator('[data-progress-change="clear"][value="OSS"]').check();page.locator('[data-progress-change="clear"][value="processing"]').check();page.locator('[data-progress-change="clear"][value="failed"]').check();click('lib-record-confirm-clear');assert ev('libParseQueue.length')==0;assert ev('libParseActive.LOCAL===1&&libParseActive.OSS===1');ev("progressResolvers.forEach(resolve=>resolve('真实识别正文'))");page.clock.run_for(30);page.wait_for_function('libParseActive.LOCAL===0&&libParseActive.OSS===0');assert ev("file('q1').text==='真实识别正文'&&file('qo1').text==='真实识别正文'")
 assert ev("progressRows('全部空间').filter(r=>['q2','q3','qo2'].includes(r.id)).every(r=>r.status==='stuck')")
 check('清空四类队列选项完整且作用于全部空间；只清待识别，保留原件/失败原因，运行中任务继续真正完成')
 click('progress-admin');click('lib-record-clear');ev('state.libraryAdmin=false');click('lib-record-confirm-clear');assert '没有服务管理权限' in page.locator('#lib-error').inner_text();page.keyboard.press('Escape');assert ev("modal==='upload-records'");assert not page.locator('[data-action="progress-admin"]').count()
 page.locator('.progress-head-more>summary').click();page.keyboard.press('Escape');assert ev("modal==='upload-records'&&!document.querySelector('.progress-head-more').open");click('lib-record-auto');page.keyboard.press('Escape');assert ev('recordsAutoTimer===null');click('upload-records');assert page.locator('[aria-label="上传记录每页数量"]').input_value()=='10';page.keyboard.press('Escape')
 check('操作提交前重查管理员权限；Esc返回与关闭清理刷新计时器；页容量偏好重新打开仍保留')
 # Read-only responsive checks use all metadata columns with independent table scrolling.
 for width,height in [(1440,900),(1366,768),(1024,480),(390,600)]:
  page.set_viewport_size({'width':width,'height':height});ev("state.space='公共空间';state.libraryAdmin=true;handleAction('upload-records',{})");page.clock.run_for(10)
  r=ev("()=>{const a=document.querySelector('.progress-dialog').getBoundingClientRect(),t=document.querySelector('.progress-table-scroll').getBoundingClientRect(),f=document.querySelector('.progress-pagination').getBoundingClientRect();return{dialog:a.height,top:a.top,bottom:a.bottom,table:t.height,footer:f.bottom,overflow:document.documentElement.scrollWidth-innerWidth}}")
  assert r['top']>=0 and r['bottom']<=height and r['footer']<=height and r['table']>=100 and r['overflow']==0,r
  page.screenshot(path=str(root/f'review/upload-records-{width}.png'),animations='disabled');page.keyboard.press('Escape')
 check('1440/1366/1024×480/390可操作，记录表独立滚动、分页可见，无整页横向溢出')
 assert not errors,errors;(root/'review/upload-records-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'passed':len(checks),'errors':errors},ensure_ascii=False));b.close()
