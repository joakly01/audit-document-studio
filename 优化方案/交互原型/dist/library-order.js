'use strict';
// Folder order changes positions only. Paths, parentage and document associations stay intact.
const folderOrderBase={render,handleAction};
let folderOrderDrag=null;
function folderOrderParent(path){return folderPath(path).split('/').slice(0,-1).join('/');}
function folderOrderClear(){folderOrderDrag=null;document.querySelectorAll('.folder-order-source,.folder-order-before,.folder-order-after').forEach(el=>el.classList.remove('folder-order-source','folder-order-before','folder-order-after'));}
function folderOrderAllowed(space,path){return state.view==='library'&&state.space===space&&!!folderPath(path)&&auditFolderAccess(space,path).order;}
function folderOrderCommit(space,source,target,after){
 if(!folderOrderAllowed(space,source)||!folderOrderAllowed(space,target)||source===target||folderOrderParent(source)!==folderOrderParent(target))return false;
 const siblings=childDirectories(space,folderOrderParent(source)),from=siblings.indexOf(source),to=siblings.indexOf(target);
 if(from<0||to<0)return false;
 const next=siblings.filter(path=>path!==source),insert=next.indexOf(target)+(after?1:0);next.splice(insert,0,source);
 if(next.every((path,i)=>path===siblings[i]))return false;
 const scroll=$('.lib-tree-scroll')?.scrollTop||0;
 next.forEach((path,i)=>{(folderMeta[directoryKey(space,path)]??={}).order=i+1;});
 persist();render();const tree=$('.lib-tree-scroll');if(tree)tree.scrollTop=scroll;
 toast('文件夹顺序已保存。');return true;
}
function folderOrderTarget(event){
 const row=event.target.closest?.('.lib-tree-scroll .dir-nav-line[data-order-path]');
 if(!row||!folderOrderDrag)return null;
 const {space,path}=folderOrderDrag,target=row.dataset.orderPath;
 if(!folderOrderAllowed(space,path)||!folderOrderAllowed(space,target)||path===target||folderOrderParent(path)!==folderOrderParent(target))return null;
 return{row,space,path,target,after:event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2};
}
render=function(){
 folderOrderClear();folderOrderBase.render();if(state.view!=='library')return;
 $$('.lib-tree-scroll .dir-nav-line').forEach(row=>{
  const name=row.querySelector('[data-action="folder"]'),path=folderPath(name?.dataset.id);
  if(!name||!folderOrderAllowed(state.space,path))return;
  row.dataset.orderPath=path;row.draggable=true;
  const grip=document.createElement('button');grip.className='folder-order-grip';grip.type='button';grip.title='拖动调整同级顺序；Alt + ↑ / ↓ 上移或下移';grip.setAttribute('aria-label','调整 '+folderName(path)+' 的同级顺序');
  grip.innerHTML=I('grip','icon-sm');
  grip.addEventListener('keydown',event=>{
   if(!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;
   event.preventDefault();const space=state.space,siblings=childDirectories(space,folderOrderParent(path)),i=siblings.indexOf(path),delta=event.key==='ArrowUp'?-1:1;
   if(i>=0&&siblings[i+delta])folderOrderCommit(space,path,siblings[i+delta],delta>0);
   [...document.querySelectorAll('[data-order-path]')].find(el=>el.dataset.orderPath===path)?.querySelector('.folder-order-grip')?.focus({preventScroll:true});
  });row.insertBefore(grip,row.lastElementChild);
 });
};
document.addEventListener('dragstart',event=>{
 const row=event.target.closest?.('.lib-tree-scroll .dir-nav-line[data-order-path]');if(!row)return;
 folderOrderClear();const path=row.dataset.orderPath;if(!folderOrderAllowed(state.space,path)){event.preventDefault();return;}
 folderOrderDrag={space:state.space,path};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-audit-folder-order',path);row.classList.add('folder-order-source');
});
document.addEventListener('dragover',event=>{
 document.querySelectorAll('.folder-order-before,.folder-order-after').forEach(el=>el.classList.remove('folder-order-before','folder-order-after'));
 const drop=folderOrderTarget(event);if(!drop)return;
 event.preventDefault();event.dataTransfer.dropEffect='move';drop.row.classList.add(drop.after?'folder-order-after':'folder-order-before');
 const tree=drop.row.closest('.lib-tree-scroll'),rect=tree.getBoundingClientRect();if(event.clientY<rect.top+28)tree.scrollTop-=12;else if(event.clientY>rect.bottom-28)tree.scrollTop+=12;
});
document.addEventListener('drop',event=>{const drop=folderOrderTarget(event);if(folderOrderDrag)event.preventDefault();folderOrderClear();if(drop)folderOrderCommit(drop.space,drop.path,drop.target,drop.after);});
document.addEventListener('dragend',folderOrderClear);
document.addEventListener('keydown',event=>{if(event.key==='Escape')folderOrderClear();});
handleAction=function(action,el){
 if(action==='lib-folder-up'||action==='lib-folder-down'){
  const {space,path}=modalData;if(!folderOrderAllowed(space,path))return;
  const siblings=childDirectories(space,folderOrderParent(path)),index=siblings.indexOf(path),delta=action==='lib-folder-up'?-1:1;
  if(index<0||!siblings[index+delta])return toast('已位于同级目录'+(delta<0?'顶部。':'底部。'));
  return folderOrderCommit(space,path,siblings[index+delta],delta>0);
 }
 return folderOrderBase.handleAction(action,el);
};
render();
