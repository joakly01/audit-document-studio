'use strict';
// A copied analysis edits its own links; ordinary library links retain their existing behavior.
function raAttachmentIds(d,task=currentTask()){
 if(!d)return [];
 if(state.view==='tool'){
  if(task)return [...new Set(Array.isArray(task.attachments?.[d.id])?task.attachments[d.id]:[])];
  const overrides=ws().attachmentOverrides;
  if(overrides&&typeof overrides==='object'&&!Array.isArray(overrides)){
   // Original task inputs have explicit entries; newly added files start from their current links.
   if(!Object.prototype.hasOwnProperty.call(overrides,d.id))overrides[d.id]=[...new Set(Array.isArray(d.attachments)?d.attachments:[])];
   return [...new Set(Array.isArray(overrides[d.id])?overrides[d.id]:[])];
  }
 }
 return [...new Set(Array.isArray(d.attachments)?d.attachments:[])];
}
function raSetAttachmentIds(d,ids){
 if(!d)return false;
 const next=[...new Set(Array.isArray(ids)?ids:[])];
 if(state.view==='tool'){
  if(currentTask())return false;
  const overrides=ws().attachmentOverrides;
  if(overrides&&typeof overrides==='object'&&!Array.isArray(overrides)){overrides[d.id]=next;return true;}
 }
 d.attachments=next;return true;
}
