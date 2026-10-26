'use strict';
// Keep the original folder-upload sequence; production maps this plan to the existing batch/session APIs.
const auditUploadBase={library,uploadFiles,libUploadCommit,modalContent,handleAction,uploadModal,closeModal,uploadRefresh};
let auditUploadPlan=null,auditFolderPicking=false,auditUploadPickerReturn=null;
const auditArchiveTypes=['rar','zip','7z','tar','gz','bz2','xz'];
const auditExecutableTypes=['exe','dll','sys','bat','cmd','sh'];
const auditDocumentTypes=['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','md'];
const auditExcludedTypes=[...auditArchiveTypes,...auditExecutableTypes,'tmp','log','__system__'];
const auditUploadRelative=f=>f.relativePath||f.webkitRelativePath||f.name;
function auditUploadType(f){if(['Thumbs.db','.DS_Store'].includes(f.name))return '__system__';const dot=f.name.lastIndexOf('.');return dot>0?f.name.slice(dot+1).toLowerCase():'__none__';}
function auditUploadCanonical(space,path){const existing=directoryPaths(space);let current='';for(const part of folderPath(path).split('/').filter(Boolean)){const next=[current,part].filter(Boolean).join('/');current=existing.find(p=>p.toLowerCase()===next.toLowerCase())||next;}return current;}
function auditUploadTargetFolder(f,space=state.space,parent=folderPath(state.folder)){return auditUploadCanonical(space,[parent,...auditUploadRelative(f).split('/').slice(0,-1)].filter(Boolean).join('/'));}
function auditUploadTarget(){return{space:state.space,path:folderPath(state.folder)};}
function auditUploadStillHere(plan){return plan.target.space===state.space&&plan.target.path===folderPath(state.folder);}
function auditUploadGuard(plan,files,overwrite=[]){
 const target=plan?.target||auditUploadTarget(),issues=[];
 if(plan&&!auditUploadStillHere(plan))return[{path:'上传位置',reason:'当前目录已变化，请重新选择上传位置。'}];
 if(!auditFolderAccess(target.space,target.path).upload)return[{path:target.path||target.space,reason:'当前目录没有上传权限。'}];
 const dirs=(plan?.dirs||[]).map(p=>auditUploadCanonical(target.space,[target.path,p].filter(Boolean).join('/')));
 const existing=directoryPaths(target.space),docs=state.docs.filter(d=>!d.deleted&&d.space===target.space);
 const key=(p,n)=>[folderPath(p),n].filter(Boolean).join('/').toLowerCase();
 for(const path of dirs){
  if(docs.some(d=>key(d.folder,d.name)===path.toLowerCase()))issues.push({path,reason:'已有同名文件，无法创建文件夹。'});
  if(!auditFolderAccess(target.space,path).upload)issues.push({path,reason:'此子目录只读或没有上传权限。'});
  if(!existing.includes(path)){let parent=path.split('/').slice(0,-1).join('/');while(parent&&!existing.includes(parent))parent=parent.split('/').slice(0,-1).join('/');if(!auditFolderAccess(target.space,parent).create)issues.push({path,reason:'没有在上级目录新建文件夹的权限。'});}
 }
 for(const f of files){const path=auditUploadTargetFolder(f,target.space,target.path),relative=auditUploadRelative(f),parts=relative.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||/[\\\x00-\x1f]/.test(p)))issues.push({path:relative,reason:'文件路径无效，请检查名称。'});
  if(f.size>100*1024*1024)issues.push({path:relative,reason:'单文件不能超过100MB。'});
  if(!auditFolderAccess(target.space,path).upload)issues.push({path:relative,reason:'目标子目录没有上传权限。'});
  if(existing.some(p=>p.toLowerCase()===key(path,f.name))||dirs.some(p=>p.toLowerCase()===key(path,f.name)))issues.push({path:relative,reason:'已有同名文件夹，请先调整文件或目录名称。'});
 }
 for(const id of overwrite){const d=file(id);if(!d||!auditFileAccess(d).delete)issues.push({path:d?.name||id,reason:'没有覆盖此文件的权限，请改为跳过。'});}
 if(target.space==='个人空间'){const used=docs.filter(d=>!d.refSourceId&&!overwrite.includes(d.id)).reduce((n,d)=>n+libSize(d),0);if(used+files.reduce((n,f)=>n+f.size,0)>storageQuota.personal*1073741824)issues.push({path:'个人空间',reason:'存储额度不足，请整理资料或联系文件管理员。'});}
 return issues.filter((x,i,a)=>a.findIndex(y=>y.path===x.path&&y.reason===x.reason)===i);
}
function auditUploadIssues(issues,back){openModal('audit-upload-issues',{issues,back});}
function auditUploadCreateDirectories(plan){if(!plan)return;const space=plan.target.space;for(const relative of plan.dirs){const path=auditUploadCanonical(space,[plan.target.path,relative].filter(Boolean).join('/'));if(!state.directoryNodes.some(n=>n.space===space&&n.path===path))state.directoryNodes.push({space,path});}persist();}
function auditFolderTypes(plan){auditUploadPlan=plan;const types=[...new Set(plan.files.map(auditUploadType))];openModal('lib-upload-types',{files:plan.files,types,selected:types.filter(t=>!auditExcludedTypes.includes(t)),plan});}
function auditFolderBegin(files,paths=[],target=auditUploadTarget()){
 const dirs=new Set(paths);files.forEach(f=>{const parts=auditUploadRelative(f).split('/');for(let i=1;i<parts.length;i++)dirs.add(parts.slice(0,i).join('/'));});
 const plan={files:[...files],dirs:[...dirs],target};
 if(!files.length&&!dirs.size){toast('文件夹为空，没有可上传的资料。');return;}
 if(!auditUploadStillHere(plan)||!auditFolderAccess(target.space,target.path).upload){toast('上传位置或权限已变化，请重新选择目录。');return;}
 const roots=[...new Set([...dirs].map(p=>p.split('/')[0]))],existing=directoryPaths(target.space),merges=roots.filter(r=>existing.some(p=>p.toLowerCase()===[target.path,r].filter(Boolean).join('/').toLowerCase()));
 auditUploadPlan=plan;
 if(merges.length)openModal('audit-upload-merge',{plan,merges});else auditFolderTypes(plan);
}
uploadFiles=function(files){const arr=[...files];if(!arr.length)return;if(arr.some(f=>auditUploadRelative(f).includes('/'))){auditFolderBegin(arr);return;}auditUploadPlan=null;const issues=auditUploadGuard(null,arr);if(issues.length){auditUploadIssues(issues,{type:'upload',data:{items:[]}});return;}auditUploadBase.uploadFiles(arr);};
libUploadCommit=function(files,overwrite=[]){const plan=auditUploadPlan,issues=auditUploadGuard(plan,files,overwrite);if(issues.length){auditUploadIssues(issues,plan?{type:'lib-upload-types',data:{plan,files:plan.files,types:[...new Set(plan.files.map(auditUploadType))],selected:[...new Set(files.map(auditUploadType))]}}:{type:'upload',data:{items:[]}});return;}auditUploadBase.libUploadCommit(files,overwrite);auditUploadCreateDirectories(plan);auditUploadPlan=null;};
async function auditReadHandle(handle,path,files,dirs){dirs.add(path);for await(const entry of handle.values()){const relative=path+'/'+entry.name;if(entry.kind==='directory')await auditReadHandle(entry,relative,files,dirs);else{const f=await entry.getFile();f.relativePath=relative;files.push(f);}}}
async function auditChooseFolder(){
 if(auditFolderPicking)return;if(!auditFolderAccess().upload){toast('当前目录没有上传权限。');return;}
 if(modal!=='upload')openModal('upload',{items:[]});
 const target=auditUploadTarget();auditFolderPicking=true;
 try{if(window.showDirectoryPicker){try{const handle=await window.showDirectoryPicker({mode:'read'}),files=[],dirs=new Set();await auditReadHandle(handle,handle.name,files,dirs);if(!files.length&&dirs.size===1){toast('文件夹为空，没有可上传的资料。');return;}auditFolderBegin(files,[...dirs],target);return;}catch(err){if(err.name==='AbortError')return;if(!['SecurityError','NotAllowedError','TypeError'].includes(err.name)){toast('无法读取文件夹，请检查访问权限后重试。');return;}}}
  const input=$('#folder-input');if(!input||!('webkitdirectory' in input)){toast('此浏览器不支持文件夹上传，请使用支持目录选择的浏览器。');return;}input.value='';input.click();
 }finally{auditFolderPicking=false;}
}
library=function(){const root=document.createElement('div');root.innerHTML=auditUploadBase.library();const upload=root.querySelector('.lib-top-actions [data-action="upload"]');if(upload){const split=document.createElement('div');split.className='audit-upload-split';upload.before(split);split.append(upload);root.querySelector('.lib-path-row>.row:last-child')?.append(split);}root.querySelector('.lib-commandbar')?.remove();root.querySelector('.v7-list-title')?.setAttribute('role','heading');root.querySelector('.v7-list-title')?.setAttribute('aria-level','1');root.querySelector('.library-v5')?.setAttribute('aria-label','资料管理');root.querySelector('.lib-workspace')?.classList.toggle('mobile-tools-open',!!libraryPrefs.mobileToolsOpen);if(innerWidth<=760){const button=root.querySelector('.lib-overflow [data-action="lib-toggle-tools"]');if(button)button.innerHTML=I('toolbox','icon-sm')+(libraryPrefs.mobileToolsOpen?'收起分析工具':'展开分析工具');}
 root.querySelectorAll('.lib-table tbody tr').forEach(row=>{const cell=row.children[4];if(!cell)return;cell.classList.add('lib-location-cell');if(row.classList.contains('folder-entry')){const parent=folderPath(row.dataset.folderPath).split('/').slice(0,-1).join('/');cell.textContent=state.space+' / '+(parent||'根目录');}cell.title=cell.textContent;});
 const bar=root.querySelector('.lib-toolbar'),header=root.querySelector('.lib-path-row'),more=bar?.querySelector('.lib-overflow'),panel=more?.querySelector('.lib-overflow-panel');
 if(bar&&header&&more){const crumbs=header.querySelector('.folder-crumbs'),path=document.createElement('div');path.className='audit-current-path';path.setAttribute('aria-label','当前目录');path.title='当前目录：'+(crumbs?[...crumbs.querySelectorAll('button')].map(n=>n.textContent.trim()).join(' / '):state.space+' / '+(folderPath(state.folder)||'根目录'));const label=document.createElement('span');label.className='audit-location-label';label.textContent='当前目录';path.append(label);if(crumbs)path.append(crumbs);const search=bar.querySelector('.search'),scope=bar.querySelector('.lib-scope-select'),filter=bar.querySelector('.lib-main-filter'),split=header.querySelector('.audit-upload-split'),text=bar.querySelector('[data-action="lib-search"]');
  if(text){const group=document.createElement('section');group.className='lib-text-search-actions';text.className='btn ghost sm';text.title='检索资料正文，支持关键词和正则表达式';group.innerHTML='<div class="lib-menu-label">检索与记录</div>';group.append(text);group.insertAdjacentHTML('beforeend',B(I('uploadHistory','icon-sm')+'上传记录','upload-records','ghost sm'));panel.prepend(group);}
  const selection=header.querySelector('.lib-header-selection'),footer=root.querySelector('.lib-pagination>span');if(selection&&footer){footer.className='audit-pagination-summary';const total=document.createElement('span');total.className='audit-total-count';total.textContent=footer.textContent.split(' · ')[0];footer.replaceChildren(total,selection);}
  const upload=split?.querySelector('[data-action="upload"]');if(upload){upload.innerHTML=I('upload','icon-sm')+'<span class="audit-upload-label-long">上传</span><span class="audit-upload-label-short">上传</span>';upload.setAttribute('aria-label','上传');}
  bar.replaceChildren(...[path,search,scope,filter,split,more].filter(Boolean));{const view=panel.querySelector('.lib-view-actions');view?.insertAdjacentHTML('beforeend',B(I('folderTree','icon-sm')+(innerWidth<=760&&libraryPrefs.mobileFolderOpen?'收起资料目录':'展开资料目录'),'lib-toggle-folders','ghost sm audit-directory-menu-toggle'));}bar.setAttribute('aria-label','当前目录与资料操作');header.remove();
 }
 return root.innerHTML;};
uploadModal=function(){
 const items=modalData.items||[],done=items.filter(r=>r.status==='可分析').length,failed=items.filter(r=>r.status==='解析失败').length,running=items.length-done-failed;
 const zone='<div class="audit-upload-drop" id="upload-drop"><span class="audit-upload-drop-icon">'+I('upload')+'</span><h3>拖入文件或文件夹</h3><p>支持多文件，选择后自动上传 · 单文件不超过 100MB</p><div class="audit-upload-choices">'+B(I('file','icon-sm')+'选择文件','audit-upload-pick','primary')+B(I('folder','icon-sm')+'选择文件夹','upload-folder')+'</div><span class="audit-upload-folder-hint">上传文件夹将保留子目录，可筛选需要的文件类型</span><input type="file" multiple id="upload-input" hidden><input type="file" webkitdirectory directory multiple id="folder-input" hidden></div>';
 const rows=items.length?'<section class="audit-upload-current"><div class="audit-upload-current-head"><h3>本次上传 <strong>'+items.length+'</strong> 个文件</h3><span>完成 <b class="green">'+done+'</b>'+(running?' · 处理中 <b>'+running+'</b>':'')+(failed?' · 失败 <b class="red">'+failed+'</b>':'')+'</span></div><div class="audit-upload-current-list">'+items.map(r=>'<div class="audit-upload-item upload-row"><div class="audit-upload-file-icon">'+I('file')+'</div><div class="audit-upload-item-main"><div class="audit-upload-item-heading"><span title="'+E(r.name)+'">'+E(r.name)+'</span>'+tag(r.status==='可分析'?'解析完成':r.status,r.status==='解析失败'?'red':r.status==='可分析'?'green':'blue')+'</div><div class="audit-upload-item-path" title="'+E(r.target)+'">'+E(r.target)+'</div>'+(r.error?'<p class="audit-upload-item-error">'+E(r.error)+'</p>':'')+(r.status==='可分析'?'':'<div class="bar"><i style="width:'+Math.max(0,Math.min(100,r.progress||0))+'%"></i></div>')+'</div>'+(r.status==='解析失败'?A('重试','retry-upload','data-id="'+E(r.id)+'"'):'')+'</div>').join('')+'</div></section>':'';
 return modalFrame('上传资料','上传到：'+E(state.space+' / '+(folderPath(state.folder)||'根目录')),zone+rows,'<span class="audit-upload-footer-note">'+(running?'关闭窗口后，已提交任务继续处理。':items.length?'上传与解析结果已保存在上传记录中。':'文件夹层级、同名文件将在上传前检查。')+'</span><div class="row">'+B(I('uploadHistory','icon-sm')+'上传记录','upload-records','ghost')+B(items.length&&!running?'完成':'关闭','close-modal',items.length?'primary':'')+'</div>','audit-upload-dialog');
};
modalContent=function(){const d=modalData;
 if(modal==='audit-directory-path'){const root=document.createElement('div');root.innerHTML=folderCrumbs(d.space,d.path,'library');const links=[...root.querySelectorAll('button')];return modalFrame('当前目录',E(links.map(n=>n.textContent.trim()).join(' / ')),'<div class="audit-directory-parents">'+links.map((n,i)=>'<div style="padding-left:'+i*12+'px">'+n.outerHTML+'</div>').join('')+'</div>',B('关闭','close-modal'),'medium');}

 if(modal==='audit-upload-merge')return modalFrame('文件夹已存在','上传到 '+E(d.plan.target.space+' / '+(d.plan.target.path||'根目录')),'<p>当前目录已有文件夹 '+d.merges.map(n=>'「'+E(n)+'」').join('、')+'。继续上传将合并目录，已有文件会单独核对重名。</p>',B('取消','close-modal')+B('继续并筛选文件','audit-upload-merge-next','primary'),'medium');
 if(modal==='lib-upload-types'&&d.plan){const chosen=d.files.filter(f=>d.selected.includes(auditUploadType(f))),rows=d.types.map(type=>{const files=d.files.filter(f=>auditUploadType(f)===type),name=type==='__none__'?'无后缀':type==='__system__'?'系统隐藏文件':type.toUpperCase();return['<input type="checkbox" aria-label="上传 '+E(name)+' 文件" data-audit-upload-type="'+E(type)+'" '+(d.selected.includes(type)?'checked':'')+'>',E(name),files.length,libFormat(files.reduce((n,f)=>n+f.size,0)),'<div class="folder-type-names">'+files.slice(0,3).map(f=>'<div title="'+E(auditUploadRelative(f))+'">'+E(auditUploadRelative(f))+'</div>').join('')+'</div>'+(files.length>3?A('查看全部 '+files.length+' 个文件','audit-folder-file-list','data-type="'+E(type)+'"'):'')];});
  return modalFrame('上传文件夹 · 筛选文件','目标：'+E(d.plan.target.space+' / '+(d.plan.target.path||'根目录')),'<div class="audit-upload-summary"><strong>'+d.plan.dirs.length+' 个文件夹 · '+d.files.length+' 个文件</strong><span class="hint">保留原目录层级；压缩包、可执行文件及临时文件默认不选。</span></div><div class="row audit-upload-presets">'+[['docs','仅文档'],['archives','排除压缩包'],['executables','排除可执行文件'],['all','全选'],['none','全不选']].map(([v,n])=>B(n,'audit-upload-preset','sm','data-preset="'+v+'"')).join('')+'</div>'+'<div class="folder-type-table">'+simpleTable(['上传','文件类型','数量','大小','文件名称 / 相对路径'],rows,true)+'</div>'+'<p class="hint mt" aria-live="polite">已选 '+chosen.length+' 个文件 · '+libFormat(chosen.reduce((n,f)=>n+f.size,0))+(chosen.length?'':'；仅创建文件夹结构')+'</p>',B('取消','close-modal')+B(chosen.length?'继续上传':'仅创建目录','lib-upload-types-next','primary'),'folder-types-dialog');
 }
 if(modal==='audit-upload-issues')return modalFrame('请检查上传资料','尚未上传，请处理以下问题后重试。',simpleTable(['文件或目录','原因'],d.issues.map(x=>[E(x.path),E(x.reason)]),true),B('取消','close-modal')+B('返回调整','audit-upload-back','primary'),'medium');
 const html=auditUploadBase.modalContent();
 if(modal==='picker'){const node=document.createElement('div');node.innerHTML=html;const actions=node.querySelector('.picker-center .browser-toolbar>.row')||node.querySelector('.picker-center .browser-toolbar'),a=auditFolderAccess(d.space,d.folder);actions?.insertAdjacentHTML('beforeend',B(I('upload','icon-sm')+'上传','audit-picker-upload','sm',a.upload?'':'disabled title="'+E(a.reason)+'"'));return node.innerHTML;}
 return html;
};
handleAction=function(action,el){
 if(action==='audit-directory-path'){openModal('audit-directory-path',{space:state.space,path:state.folder});return;}
 if(action==='folder'&&modal==='audit-directory-path')closeModal();
 if(action==='audit-upload-pick'){$('#upload-input')?.click();return;}
 if(action==='lib-toggle-tools'&&innerWidth<=760){libraryPrefs.mobileToolsOpen=!libraryPrefs.mobileToolsOpen;render();return;}
 if(action==='audit-picker-upload'){if(!auditFolderAccess(modalData.space,modalData.folder).upload)return;const picker=modalData;auditUploadPickerReturn={data:picker,space:state.space,folder:state.folder};state.space=picker.space;state.folder=picker.folder;auditUploadPlan=null;openModal('upload',{items:[]});return;}
 if(action==='audit-upload-folder'||action==='upload-folder'){auditChooseFolder();return;}
 if(action==='upload'||action==='audit-upload-files'){auditUploadPlan=null;return auditUploadBase.handleAction('upload',el);}
 if(action==='audit-upload-merge-next'){auditFolderTypes(modalData.plan);return;}
 if(action==='audit-upload-back'){const back=modalData.back;auditUploadPlan=back.data.plan||null;openModal(back.type,back.data);return;}
 if(action==='audit-upload-preset'){const d=modalData,p=el.dataset.preset;d.selected=d.types.filter(t=>p==='all'||p==='docs'&&auditDocumentTypes.includes(t)||p==='archives'&&d.selected.includes(t)&&!auditArchiveTypes.includes(t)||p==='executables'&&d.selected.includes(t)&&!auditExecutableTypes.includes(t));paintModal();return;}
 if(action==='lib-upload-conflicts-confirm'&&auditUploadPlan&&modalData.entries.every(e=>e.choice==='skip')){const issues=auditUploadGuard(auditUploadPlan,[]);if(issues.length){auditUploadIssues(issues,{type:'lib-upload-conflicts',data:modalData});return;}auditUploadCreateDirectories(auditUploadPlan);auditUploadPlan=null;}
 if(action==='lib-upload-types-next'&&modalData.plan){const d=modalData,files=d.files.filter(f=>d.selected.includes(auditUploadType(f))),issues=auditUploadGuard(d.plan,files);if(issues.length){auditUploadIssues(issues,{type:modal,data:d});return;}auditUploadPlan=d.plan;if(!files.length){auditUploadCreateDirectories(d.plan);auditUploadPlan=null;closeModal();render();toast('目录结构已创建，没有文件需要上传。');return;}libUploadConflicts(files);return;}
 return auditUploadBase.handleAction(action,el);
};
window.addEventListener('change',e=>{const el=e.target;if(el.hasAttribute('data-audit-upload-type')){e.stopImmediatePropagation();modalData.selected=el.checked?[...new Set([...modalData.selected,el.dataset.auditUploadType])]:modalData.selected.filter(t=>t!==el.dataset.auditUploadType);paintModal();return;}if(['folder-input','upload-input'].includes(el.id)){e.stopImmediatePropagation();const files=[...el.files];el.value='';uploadFiles(files);}},true);
async function auditReadDroppedEntry(entry,path,files,dirs){if(entry.isFile){const f=await new Promise((resolve,reject)=>entry.file(resolve,reject));f.relativePath=path;files.push(f);}else{dirs.add(path);const reader=entry.createReader();for(;;){const entries=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!entries.length)break;for(const child of entries)await auditReadDroppedEntry(child,path+'/'+child.name,files,dirs);}}}
window.addEventListener('drop',async e=>{if(!e.target.closest('#upload-drop'))return;const entries=[...e.dataTransfer.items].map(item=>item.webkitGetAsEntry?.()).filter(Boolean);if(!entries.some(entry=>entry.isDirectory))return;e.preventDefault();e.stopImmediatePropagation();const target=auditUploadTarget(),files=[],dirs=new Set();try{for(const entry of entries)await auditReadDroppedEntry(entry,entry.name,files,dirs);auditFolderBegin(files,[...dirs],target);}catch{toast('无法读取拖入的文件夹，请通过“选择文件夹”重新选择。');}},true);
closeModal=function(){if(auditUploadPickerReturn&&['upload','upload-records','lib-upload-types','lib-upload-conflicts','audit-upload-merge','audit-upload-issues'].includes(modal)){const back=auditUploadPickerReturn;if(recordsAutoTimer){clearInterval(recordsAutoTimer);recordsAutoTimer=null;}auditUploadPickerReturn=null;auditUploadPlan=null;state.space=back.space;state.folder=back.folder;openModal('picker',back.data);persist();return;}auditUploadBase.closeModal();};
uploadRefresh=function(){auditUploadBase.uploadRefresh();if(modal==='picker')paintModal();};

const auditCrumbNodes=new WeakMap();
function auditFitCrumbs(crumbs){
 if(!crumbs?.isConnected)return;
 if(!auditCrumbNodes.has(crumbs))auditCrumbNodes.set(crumbs,[...crumbs.childNodes]);
 crumbs.replaceChildren(...auditCrumbNodes.get(crumbs));
 const links=[...crumbs.querySelectorAll('button')];links.forEach(n=>{n.title=n.textContent.trim();n.classList.remove('audit-crumb-last');});
 if(links.length>2&&crumbs.scrollWidth>crumbs.clientWidth+1){const separator=()=>document.createRange().createContextualFragment(I('chevron','icon-sm'));crumbs.replaceChildren(links[0],separator(),document.createRange().createContextualFragment(A('…','audit-directory-path','aria-label="查看完整目录与上级目录" title="查看完整目录与上级目录"')),separator(),links.at(-1));}
 links.at(-1)?.classList.add('audit-crumb-last');crumbs.scrollLeft=0;
}
// The merged bar prioritizes location, file-name search, upload and overflow.
v9BindToolbar=function(){
 v9ToolbarObserver?.disconnect();const files=$('.lib-files'),bar=files?.querySelector('.lib-toolbar');if(!bar)return;
 const filter=bar.querySelector('.lib-main-filter'),filterPanel=filter.querySelector('.lib-filter'),fields=bar.querySelector('.lib-overflow-filter-fields'),section=fields.parentElement,scope=bar.querySelector('.lib-scope-select'),label=document.createElement('label');label.className='lib-scope-field';label.hidden=!!scope?.hidden;label.append('浏览范围');
 const adapt=()=>{const crumbs=bar.querySelector('.audit-current-path .folder-crumbs');if(crumbs)requestAnimationFrame(()=>{auditFitCrumbs(crumbs);});const width=files.getBoundingClientRect().width;const mode=width>=900?'wide':width>=720?'medium':'narrow';if(files.dataset.toolbarMode===mode)return;files.dataset.toolbarMode=mode;bar.querySelectorAll('details[open]').forEach(d=>d.open=false);
  if(mode==='wide'){bar.insertBefore(scope,filter);label.remove();}else{label.append(scope);filterPanel.prepend(label);}
  if(mode==='narrow'){while(filterPanel.firstChild)fields.append(filterPanel.firstChild);filter.hidden=true;section.hidden=false;}else{while(fields.firstChild)filterPanel.append(fields.firstChild);filter.hidden=false;section.hidden=true;if(mode==='wide'){bar.insertBefore(scope,filter);label.remove();}}
  bar.querySelector('.lib-overflow>summary').classList.toggle('has-filter',mode==='narrow'&&!!(libraryFilters.status||libraryFilters.type));
 };adapt();const crumbs=bar.querySelector('.audit-current-path .folder-crumbs');if(crumbs)auditFitCrumbs(crumbs);v9ToolbarObserver=new ResizeObserver(adapt);v9ToolbarObserver.observe(files);
};
render();
