/** Host integration uses same-origin HttpOnly cookies by default. No credentials in URLs/storage. */
export class ServiceError extends Error {
  constructor(message:string, public status?:number, public code?:string) { super(message); this.name='ServiceError' }
}
export type RequestOptions = {method?:string;body?:unknown;params?:Record<string,unknown>;signal?:AbortSignal;blob?:boolean}
export type Requester = <T=any>(path:string,options?:RequestOptions)=>Promise<T>
let tokenProvider: (()=>string|Promise<string>)|undefined
/** The embedding application may supply an in-memory access-token provider. */
export function setTokenProvider(provider:()=>string|Promise<string>) { tokenProvider=provider }
export function createHttp(baseUrl='',fetcher:typeof fetch=fetch):Requester {
 return async <T=any>(path:string,options:RequestOptions={}):Promise<T> => {
  const query=new URLSearchParams()
  Object.entries(options.params||{}).forEach(([k,v])=>{ if(v!==undefined&&v!==null&&v!=='') query.set(k,Array.isArray(v)?v.join(','):String(v)) })
  const url=baseUrl.replace(/\/$/,'')+path+(query.size?`?${query}`:'')
  const headers:Record<string,string>={Accept:options.blob?'*/*':'application/json'}
  const token=await tokenProvider?.(); if(token)headers.Authorization=`Bearer ${token}`
  const form=typeof FormData!=='undefined'&&options.body instanceof FormData
  if(options.body!==undefined&&!form)headers['Content-Type']='application/json'
  let response:Response
  try { response=await fetcher(url,{method:options.method||'GET',credentials:'include',headers,body:options.body===undefined?undefined:form?options.body as FormData:JSON.stringify(options.body),signal:options.signal}) }
  catch(error) { if(error instanceof Error&&error.name==='AbortError')throw error; throw new ServiceError('无法连接业务服务，请检查网络或接口地址。提交超时后请先到分析记录确认，避免重复提交。') }
  if(!response.ok) {
   let message=response.status===401?'登录已过期，请在宿主系统重新登录。':response.status===403?'没有执行此操作的权限。':`请求失败（${response.status}），请重试。`
   try{const e=await response.json();message=e.message||e.detail||message}catch{}
   throw new ServiceError(String(message),response.status)
  }
  if(response.status===204)return undefined as T
  if(options.blob){if(response.headers.get('content-type')?.includes('text/html'))throw new ServiceError('导出接口返回了静态页面，请检查 API 代理配置。');if(response.headers.get('content-type')?.includes('application/json')){const b=await response.blob();try{const e=JSON.parse(await b.text());if(e.code&&![0,200,201].includes(Number(e.code)))throw new ServiceError(e.message||'导出失败')}catch(e){if(e instanceof ServiceError)throw e}return b as T}return await response.blob() as T}
  const contentType=response.headers.get('content-type')||''
  if(!contentType.includes('json'))throw new ServiceError('接口未返回 JSON 数据。请检查 API 代理配置，勿将静态页面当作接口响应。')
  const data=await response.json()
  if(data&&typeof data==='object'&&'code'in data&&![0,200,201,202].includes(Number(data.code))) throw new ServiceError(String(data.message||'业务处理失败'),response.status,String(data.code))
  return (data&&typeof data==='object'&&'code'in data&&'data'in data?data.data:data) as T
 }
}
export function unavailable(feature:string):never { throw new ServiceError(`${feature}的服务接口尚未配置，请完成接口对接后使用。`,undefined,'NOT_CONFIGURED') }
