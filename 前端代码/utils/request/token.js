import Cookies from 'js-cookie'

export const TOKEN_KEY = 'agent-token'
export const setToken = (token, expires) => {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem("console_token", token)
  // Cookies.set(TOKEN_KEY, token, { expires: expires || 1 })
}

export const getToken = () => {
    // 优先从 sessionStorage 读取（当前标签页）
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (token) {
        return token
    }
    // 兜底从 localStorage 读取（新标签页场景）
    const fallbackToken = localStorage.getItem('console_token')
    if (fallbackToken) {
        // 同步到当前标签页的 sessionStorage，后续请求直接命中
        sessionStorage.setItem(TOKEN_KEY, fallbackToken)
        return fallbackToken
    }
    return null
}
