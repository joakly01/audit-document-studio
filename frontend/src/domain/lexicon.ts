export interface LexiconEntry {word:string;kind:'stop'|'user';source?:string}
export function uniqueWords(text:string){return [...new Set(text.split(/[\n\r,，;；]+/).map(v=>v.trim()).filter(Boolean))]}
export function lexiconSignature(rows:LexiconEntry[]){return JSON.stringify(rows.map(r=>({word:r.word,kind:r.kind})).sort((a,b)=>a.word.localeCompare(b.word)))}
export function mergeLexicon(rows:LexiconEntry[],words:string[],kind:LexiconEntry['kind'],overwrite=false){const map=new Map(rows.map(r=>[r.word,{...r}]));for(const word of words){const old=map.get(word);if(!old||old.kind===kind||overwrite)map.set(word,{word,kind,source:old?.source||'manual'})}return [...map.values()]}
export function addSelectedWords(stopWords:string[],newWords:string[],selected:LexiconEntry[]){
 const stop=new Set(stopWords),user=new Set(newWords)
 for(const entry of selected){if(entry.kind==='stop'){stop.add(entry.word);user.delete(entry.word)}else{user.add(entry.word);stop.delete(entry.word)}}
 return {stopWords:[...stop],newWords:[...user]}
}
