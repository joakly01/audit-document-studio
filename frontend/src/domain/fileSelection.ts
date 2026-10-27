import type { Material } from './types'
export function isMaterialSelectable(file:Material, parsedOnly=true, extensions:string[]=[]):boolean {
 return file.canAnalyze!==false && (!parsedOnly||file.parseStatus==='parsed') && (!extensions.length||extensions.map(x=>x.toLowerCase().replace(/^\./,'')).includes(file.extension.toLowerCase().replace(/^\./,'')))
}
export function mergeSelection(existing:Material[], additions:Material[], multiple=true):Material[] {
 if(!multiple)return additions.slice(-1)
 return [...new Map([...existing,...additions].map(file=>[file.id,file])).values()]
}
export function togglePageSelection(existing:Material[], page:Material[], checked:boolean):Material[] {
 if(checked)return mergeSelection(existing,page)
 const ids=new Set(page.map(f=>f.id));return existing.filter(f=>!ids.has(f.id))
}
export function reconcileSelection(selected:Material[], available:Material[], parsedOnly=true, extensions:string[]=[]){
 const valid=new Map(available.filter(file=>isMaterialSelectable(file,parsedOnly,extensions)).map(file=>[file.id,file]));
 return {files:selected.filter(file=>valid.has(file.id)).map(file=>valid.get(file.id)!),removed:selected.filter(file=>!valid.has(file.id))}
}
