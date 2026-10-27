import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { service } from '@/services/service'
import type { FileQuery, Folder, Material } from '@/domain/types'

export const spaces = [{value:'PUBLIC',label:'公共空间'},{value:'PERSONAL',label:'个人空间'},{value:'PROJECT',label:'项目空间'}]
export function messageOf(error:unknown) { return error instanceof Error ? error.message : '请求失败，请稍后重试。' }
export function formatSize(bytes:number) { if(!Number.isFinite(bytes)||bytes<=0)return '—';return bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:bytes>=1024?`${(bytes/1024).toFixed(1)} KB`:`${bytes} B` }
export function flattenFolders(nodes:Folder[]):Folder[] {return nodes.flatMap(node=>[node,...flattenFolders(node.children||[])])}
export function folderTree(nodes:Folder[]):Folder[] {
 if(nodes.some(n=>n.children?.length))return nodes
 const copy=new Map(nodes.map(n=>[n.id,{...n,children:[] as Folder[]}]))
 const roots:Folder[]=[]
 for(const node of copy.values()){const parent=node.parentId?copy.get(node.parentId):undefined;if(parent&&parent.id!==node.id)parent.children!.push(node);else roots.push(node)}
 return roots
}
export function useFileBrowser() {
 const query=reactive<FileQuery>({space:'PUBLIC',keyword:'',includeDescendants:false,page:1,size:20})
 const folders=ref<Folder[]>([]),files=ref<Material[]>([]),total=ref(0),loading=ref(false),folderLoading=ref(false),error=ref(''),folderError=ref('')
 let controller:AbortController|undefined, folderVersion=0
 const currentFolder=computed(()=>flattenFolders(folders.value).find(f=>f.id===query.folderId))
 const currentPath=computed(()=>`${spaces.find(s=>s.value===query.space)?.label||query.space}${currentFolder.value?` / ${currentFolder.value.path||currentFolder.value.name}`:''}`)
 async function loadFiles(){controller?.abort();controller=new AbortController();const active=controller;loading.value=true;error.value='';try{const response=await service.listFiles({...query},active.signal);if(active!==controller)return;files.value=response.items;total.value=response.total}catch(e){if(!active.signal.aborted)error.value=messageOf(e)}finally{if(active===controller)loading.value=false}}
 async function loadFolders(){const version=++folderVersion;folderLoading.value=true;folderError.value='';try{const data=await service.listFolders(query.space);if(version===folderVersion)folders.value=folderTree(data)}catch(e){if(version===folderVersion)folderError.value=messageOf(e)}finally{if(version===folderVersion)folderLoading.value=false}}
 async function changeSpace(space:string){query.space=space;query.folderId=undefined;query.page=1;await Promise.all([loadFolders(),loadFiles()])}
 function chooseFolder(folder:Folder){query.folderId=folder.id;query.page=1;void loadFiles()}
 function search(){query.page=1;void loadFiles()}
 function changePage(page:number){query.page=page;void loadFiles()}
 function changeSize(size:number){query.size=size;query.page=1;void loadFiles()}
 async function initialize(){await Promise.all([loadFolders(),loadFiles()])}
 onBeforeUnmount(()=>controller?.abort())
 return {query,folders,files,total,loading,folderLoading,error,folderError,currentPath,currentFolder,loadFiles,loadFolders,initialize,changeSpace,chooseFolder,search,changePage,changeSize}
}
