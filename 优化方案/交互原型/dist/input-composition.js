'use strict';
// Register before application listeners: rebuilding an input during IME preedit ends composition.
(() => {
 let active=null;
 const editable=target=>target instanceof Element&&target.matches('input,textarea,[contenteditable="true"]');
 window.addEventListener('compositionstart',event=>{
  if(editable(event.target))active={target:event.target,ended:false,committed:false};
 },true);
 window.addEventListener('input',event=>{
  if(!editable(event.target))return;
  if(event.isComposing||(active?.target===event.target&&!active.ended)){
   event.stopImmediatePropagation();
   return;
  }
  if(active?.target===event.target&&active.ended)active.committed=true;
 },true);
 window.addEventListener('compositionend',event=>{
  if(!editable(event.target))return;
  const session=active?.target===event.target?active:{target:event.target,committed:false};
  active=session;session.ended=true;
  // Some browsers send the final input after compositionend, others send it beforehand.
  setTimeout(()=>{
   if(active!==session)return;
   if(!session.committed&&session.target.isConnected){
    session.target.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertCompositionText',data:event.data||null,isComposing:false}));
   }
   if(active===session)active=null;
  },0);
 },true);
 window.addEventListener('keydown',event=>{
  if(editable(event.target)&&(event.isComposing||event.keyCode===229||(active?.target===event.target&&!active.ended)))event.stopImmediatePropagation();
 },true);
})();
