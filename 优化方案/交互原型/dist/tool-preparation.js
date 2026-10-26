'use strict';
// Simple tools share a reading workspace; execution and results stay tool-specific.
const tlBase={workbench,configPanel,handleAction,twMountPreview,render,closeModal};
const TL_TOOLS={word:'分析资料',theme:'待归纳资料',timeline:'事项资料',risk:'核查资料',meeting:'会议资料',prepaid:'计费合同'};
const tlLayout={left:320,right:320};
try{const saved=JSON.parse(localStorage.getItem('audit-reading-layout-v1')||'{}');for(const side of ['left','right'])if(Number.isFinite(saved[side]))tlLayout[side]=Math.max(260,Math.min(420,saved[side]));}catch{}
let tlRetainedParsed=null,tlResizeObserver=null,tlDrag=null,tlResizeFrame=0;
function tlPreparing(){return state.view==='tool'&&Object.hasOwn(TL_TOOLS,state.toolId)&&!currentTask();}
function tlCanPreview(id){const seen=new Set();let d=file(id);while(d){const access=auditFileAccess(d);if(d.deleted||seen.has(d.id)||!access.read||!access.preview)return false;seen.add(d.id);if(!d.refSourceId)return true;d=file(d.refSourceId);}return false;}
function tlVisible(node){return !!node&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0;}
function tlSettingsLabel(){return TW_META[state.toolId][1];}
function tlTabs(className,withMaterials){const panel=tv().panel==='preview'?'preview':tv().panel==='config'?'config':'materials',items=[...(withMaterials?[['materials','已选资料 '+twDocs().length]]:[]),['preview','查看原文'],['config',['theme','timeline','meeting'].includes(state.toolId)?'设置提示词':'分析设置']];return '<nav class="'+className+'" aria-label="分析工作区">'+items.map(([key,label])=>B(label,'tl-panel',panel===key||!withMaterials&&panel==='materials'&&key==='config'?'active':'','data-panel="'+key+'"'+(key==='config'?' aria-label="'+E(tlSettingsLabel())+'" title="'+E(tlSettingsLabel())+'"':''))).join('')+'</nav>';}
function tlPreview(){
 const d=file(ws().preview),v=tv(),allowed=d&&tlCanPreview(d.id),retained=tlRetainedParsed?.id===d?.id;
 const controls=d?B(I('expand','icon-sm'),'source','ghost sm tw-icon','data-id="'+E(d.id)+'" aria-label="放大查看原文件与解析内容" title="放大查看" '+(allowed?'':'disabled')):'';
 const caption=d?'<div class="ef-preview-caption"><div><strong title="'+E(d.name)+'">'+E(d.name)+'</strong></div><div class="ef-preview-tabs" role="tablist" aria-label="预览内容">'+[['original','原文件'],['parsed','解析文本']].map(([key,label])=>'<button role="tab" aria-selected="'+(v.tab===key)+'" class="'+(v.tab===key?'active':'')+'" data-action="tw-preview-tab" data-tab="'+key+'">'+label+'</button>').join('')+'</div></div>':'';
 const empty='<div class="ef-empty"><span class="ef-empty-symbol">'+I('file')+'</span><h2>在这里查看资料原文</h2><p>添加资料后，点击左侧文件查看内容。</p></div>';
 const content=d?'<div class="ef-preview-content" id="ef-raw-content" '+(v.tab!=='original'?'hidden':'')+'>'+previewMessage(allowed?'正在打开原文件':'无原文预览权限',allowed?'':'可继续配置本次分析，或联系资料管理员。')+'</div><div class="ef-preview-content" id="tw-parsed-content" data-tl-doc="'+E(d.id)+'" '+(v.tab!=='parsed'?'hidden':'')+'>'+(v.tab==='parsed'&&!retained?(allowed?previewParsedMarkup(d):previewMessage('无原文预览权限','请联系资料管理员。')):'')+'</div>':empty;
 return '<main class="tl-preview-column ew-center aw-center"><section class="ef-preview tw-preview" aria-label="Step 2 查看原文">'+'<div class="ew-panel-head tw-panel-head tl-reader-toolbar"><h2><span class="tw-step">Step 2</span>查看原文</h2>'+caption+'<div class="tl-preview-actions">'+controls+'</div></div>'+content+'</section></main>';
}
function tlSeparator(side){return '<div class="tl-separator" role="separator" tabindex="0" aria-orientation="vertical" aria-label="调整'+(side==='left'?'资料栏':'设置栏')+'宽度" aria-valuemin="260" aria-valuemax="420" aria-valuenow="'+tlLayout[side]+'" data-tl-resize="'+side+'" title="拖动调整宽度，双击恢复；方向键微调"><span></span></div>';}
configPanel=function(){
 const html=tlBase.configPanel();if(!tlPreparing())return html;
 const root=document.createElement('div');root.innerHTML=html;const panel=root.querySelector('aside');if(!panel)return html;
 panel.classList.add('tl-config');const step=panel.querySelector('.tw-step');if(step)step.textContent='Step 3';panel.setAttribute('aria-label','Step 3 '+tlSettingsLabel());
 return root.innerHTML;
};
workbench=function(){
 if(!tlPreparing()){const html=tlBase.workbench();if(!efPreparing())return html;const root=document.createElement('div');root.innerHTML=html;const head=root.querySelector('.ef-preview-head'),caption=root.querySelector('.ef-preview-caption');if(head){head.classList.add('tl-reader-toolbar');if(caption)head.querySelector('h2').after(caption);}return root.innerHTML;}
 const docs=twDocs(),w=ws(),v=tv();v.previewHidden=false;if(!docs.some(d=>d.id===w.preview))w.preview=docs[0]?.id||null;
 const root=document.createElement('div');root.innerHTML=state.toolId==='prepaid'?pwMaterials():twMaterials();const materials=root.querySelector('aside');
 const head=materials.querySelector('.tw-panel-head');if(head)head.innerHTML='<h2><span class="tw-step">Step 1</span>'+TL_TOOLS[state.toolId]+'</h2>'+B('添加资料','add-tool-materials','soft sm');
 materials.querySelectorAll('[data-action="tw-preview"]').forEach(button=>{button.title='查看原文：'+(file(button.dataset.id)?.name||'');button.setAttribute('aria-pressed',String(button.dataset.id===w.preview));});
 const panel=v.panel==='preview'?'preview':v.panel==='config'?'config':'materials',header=document.createElement('div');header.innerHTML=twHeader();
 const verb={word:'开始统计',theme:'开始归纳',risk:'开始分析'}[state.toolId];if(verb)header.querySelector('[data-action="run"]').textContent=verb;
 return '<div class="ew-workspace tw-workspace tl-workspace" data-tl-tool="'+state.toolId+'">'+header.innerHTML+tlTabs('tl-mobile-tabs',true)+'<div class="tl-grid" data-tl-panel="'+panel+'" style="--tl-left:'+tlLayout.left+'px;--tl-right:'+tlLayout.right+'px">'+materials.outerHTML+tlSeparator('left')+tlTabs('tl-compact-tabs',false)+tlPreview()+tlSeparator('right')+configPanel()+'</div></div>';
};
twMountPreview=function(){
 if(!tlPreparing())return tlBase.twMountPreview();
 if(tv().tab!=='original'||!tlCanPreview(ws().preview)||!tlVisible($('#ef-raw-content')))return;
 return state.toolId==='prepaid'?pwBase.twMountPreview():tlBase.twMountPreview();
};
function tlRefreshPreview(){
 if(!tlPreparing()||tlDrag)return;twMountPreview();const s=activeFilePreview,root=$('#ef-raw-content');
 if(s?.pdf&&s.data.inline&&s.id===ws().preview&&tv().tab==='original'&&tlVisible(root)&&tlCanPreview(s.id)){
  const width=Math.round(root.clientWidth);if(width&&s.tlFitWidth!==width){s.tlFitWidth=width;if(s.data.rawZoom==='fit')previewPaintRaw(s);}
 }
}
closeModal=function(){const source=modal==='source'&&tlPreparing(),result=tlBase.closeModal();if(source&&modal!=='source')requestAnimationFrame(tlRefreshPreview);return result;};
function tlObserve(){tlResizeObserver?.disconnect();const node=$('.tl-preview-column');if(!node)return;tlResizeObserver=new ResizeObserver(()=>{cancelAnimationFrame(tlResizeFrame);tlResizeFrame=requestAnimationFrame(tlRefreshPreview);});tlResizeObserver.observe(node);}
render=function(){
 const preparing=tlPreparing(),id=preparing?ws().preview:null,parsed=preparing?$('#tw-parsed-content'):null;
 const keep=parsed&&parsed.dataset.tlDoc===id&&tlCanPreview(id),scroll=preparing?$('.tl-config>.pw-config-scroll')?.scrollTop||0:0;
 if(preparing&&activeFilePreview?.data.inline&&!tlCanPreview(id))previewRelease();
 if(keep){tlRetainedParsed={id,node:parsed};parsed.remove();}
 tlBase.render();
 if(keep){const fresh=$('#tw-parsed-content');if(tlPreparing()&&ws().preview===id&&tlCanPreview(id)&&fresh){fresh.replaceWith(parsed);parsed.hidden=tv().tab!=='parsed';}}
 tlRetainedParsed=null;
 if(tlPreparing()){const body=$('.tl-config>.pw-config-scroll');if(body)body.scrollTop=scroll;tlObserve();}else tlResizeObserver?.disconnect();
};
function tlShowPanel(panel){const v=tv();v.panel=panel;v.previewHidden=false;render();}
function tlWidth(side,value,save=false){
 const grid=$('.tl-grid');if(!grid)return;const other=side==='left'?'right':'left',otherWidth=grid.querySelector(side==='left'?'.tl-config':'.tw-materials')?.getBoundingClientRect().width||tlLayout[other],max=Math.min(420,grid.clientWidth*.34,grid.clientWidth-otherWidth-292);
 tlLayout[side]=Math.round(Math.max(260,Math.min(max,value)));grid.style.setProperty('--tl-'+side,tlLayout[side]+'px');grid.querySelector('[data-tl-resize="'+side+'"]')?.setAttribute('aria-valuenow',tlLayout[side]);
 if(save){try{localStorage.setItem('audit-reading-layout-v1',JSON.stringify(tlLayout));}catch{}tlRefreshPreview();}
}
handleAction=function(action,el){
 if(tlPreparing()){
  const d=el?.dataset||{};
  if(action==='source'&&d.id&&!tlCanPreview(d.id))return toast('当前没有此文件的原文预览权限。');
  if(['tl-panel','tw-panel','pw-panel'].includes(action)){tlShowPanel(d.panel==='preview'?'preview':d.panel==='config'?'config':'materials');return;}
  if(action==='tl-toggle-preview'){tlShowPanel('preview');return;}
  if(action==='tw-preview'||action==='preview'){if(!ws().ids.includes(d.id))return;ws().preview=d.id;tlShowPanel('preview');return;}
  if(action==='tw-preview-tab'){
   const v=tv();v.tab=d.tab==='parsed'?'parsed':'original';const raw=$('#ef-raw-content'),parsed=$('#tw-parsed-content');if(!raw||!parsed)return;
   raw.hidden=v.tab!=='original';parsed.hidden=v.tab!=='parsed';
   if(!tlCanPreview(ws().preview)){previewRelease();raw.innerHTML=parsed.innerHTML=previewMessage('无原文预览权限','请联系资料管理员。');}
   else if(v.tab==='parsed'&&!parsed.hasChildNodes())parsed.innerHTML=previewParsedMarkup(file(ws().preview));
   $$('.tw-preview [data-action="tw-preview-tab"]').forEach(n=>{const active=n.dataset.tab===v.tab;n.classList.toggle('active',active);n.setAttribute('aria-selected',String(active));});tlRefreshPreview();return;
  }
 }
 return tlBase.handleAction(action,el);
};
window.addEventListener('pointerdown',event=>{
 const handle=event.target.closest('[data-tl-resize]');if(!handle||!tlPreparing()||event.button!==0)return;
 const side=handle.dataset.tlResize,panel=$('.tl-grid').querySelector(side==='left'?'.tw-materials':'.tl-config');
 event.preventDefault();tlDrag={side,start:event.clientX,width:panel.getBoundingClientRect().width,pointer:event.pointerId,handle};handle.setPointerCapture?.(event.pointerId);handle.classList.add('is-dragging');document.body.classList.add('tl-resizing');
},true);
window.addEventListener('pointermove',event=>{if(!tlDrag||event.pointerId!==tlDrag.pointer)return;event.preventDefault();tlWidth(tlDrag.side,tlDrag.width+(event.clientX-tlDrag.start)*(tlDrag.side==='left'?1:-1));},true);
function tlEndDrag(event){if(!tlDrag||event.pointerId!==tlDrag.pointer)return;const {side,handle}=tlDrag;tlDrag=null;handle.classList.remove('is-dragging');document.body.classList.remove('tl-resizing');tlWidth(side,tlLayout[side],true);}
window.addEventListener('pointerup',tlEndDrag,true);window.addEventListener('pointercancel',tlEndDrag,true);
window.addEventListener('lostpointercapture',tlEndDrag,true);
window.addEventListener('blur',()=>{if(tlDrag)tlEndDrag({pointerId:tlDrag.pointer});});
window.addEventListener('keydown',event=>{const handle=event.target.closest('[data-tl-resize]');if(!handle||!tlPreparing()||!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();event.stopImmediatePropagation();const side=handle.dataset.tlResize,value=event.key==='Home'?320:tlLayout[side]+(event.key==='ArrowRight'?20:-20)*(side==='left'?1:-1);tlWidth(side,value,true);},true);
window.addEventListener('dblclick',event=>{const handle=event.target.closest('[data-tl-resize]');if(handle&&tlPreparing())tlWidth(handle.dataset.tlResize,320,true);},true);
render();
