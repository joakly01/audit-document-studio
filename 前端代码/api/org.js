import { useRequest } from '@/utils/request/useRequest.js'
import { getEnvConfig } from '../../env.config.js'

const { request } = useRequest()
const currentEnv = import.meta.env.MODE || 'development'
const envConfig = getEnvConfig(currentEnv)

export const getOrgTreeAPI = (params) => {
  return request({
    url: '/api/v1/org/tree',
    method: 'get',
    params: params,
  })
}

export const getDemoAuditStdOrgTreeAPI = (params) => {
  const baseUrl = (envConfig.demoAuditStdApiBaseUrl || '').replace(/\/$/, '')
  const url = baseUrl ? `${baseUrl}/api/v1/org/tree` : '/api/v1/org/tree'
  return request({
    url,
    method: 'get',
    params: params,
  })
}

/** 当前用户机构：叶子 orguuid + R1 父链 [根…叶]，与行为日志 user_org_name 同源；需 Agent-Token */
export const getCurrentUserOrgPathAPI = () => {
  return request({
    url: '/api/v1/org/me/path',
    method: 'get',
  })
}
