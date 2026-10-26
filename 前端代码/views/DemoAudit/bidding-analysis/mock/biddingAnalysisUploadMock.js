/** 招投标分析配置页 — 空项目结构（无原型预填文件） */

/** 单个空投标单位（无预填公司名、无文件） */
export const createEmptyTenderCompany = (projectId, companyId) => ({
  id: companyId ?? `${projectId}-1`,
  name: '',
  files: [],
})

/** 单个空项目：无招标文件，1 条空投标单位表单 */
export const createEmptyProject = (projectId, companyId) => ({
  id: projectId,
  name: '',
  biddingFile: null,
  tenderCompanies: [createEmptyTenderCompany(projectId, companyId)],
})

/** 从招标文件名推断项目名称（兜底；正式环境由 Dify 解析接口返回） */
export const inferProjectNameFromBiddingFile = (file) => {
  if (!file?.name) return '未命名项目'
  const base = file.name.replace(/\.(pdf|doc|docx|zip|txt|wps)$/i, '').trim()
  if (!base) return '未命名项目'
  if (/招标项目$/.test(base)) return base
  if (/招标文件/.test(base)) {
    return base.replace(/招标文件/g, '招标项目').replace(/-+$/, '') || '未命名项目'
  }
  return `${base}招标项目`
}
