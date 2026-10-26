import { service } from './index.js'

export const useRequest = () => {
  const request = (option) => {
    const {
      url,
      method,
      params,
      data,
      headersType,
      responseType,
      headers,
      onUploadProgress,
      signal,
      silentError,
    } = option

    // 如果是FormData，不要设置Content-Type，让浏览器自动设置（包括boundary）
    const isFormData = data instanceof FormData
    const requestHeaders = { ...headers }

    if (!isFormData) {
      // 非FormData时才设置Content-Type
      requestHeaders['Content-Type'] = headersType || 'application/json'
    }
    // 如果是FormData且headers中已指定Content-Type，则使用指定的（通常不应该手动设置）

    return service({
      url: url,
      method,
      params,
      data,
      responseType: responseType,
      headers: requestHeaders,
      onUploadProgress: onUploadProgress,
      signal,
      silentError,
    })
  }

  return {
    request
  }
}
