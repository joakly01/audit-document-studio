/** Signed URLs remain transient: never persist them with the selected material. */
export function sourcePreviewUrl(value:string|undefined,base:string,allowed=true):string {
 if(!value||!allowed)return ''
 try {const url=new URL(value,base);return !url.username&&!url.password&&['http:','https:','blob:'].includes(url.protocol)?url.href:''}catch{return ''}
}
