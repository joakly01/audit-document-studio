/**
 * 项目空间 - 前端 Mock 数据
 * 用途：file-manager-code 页面原型阶段，模拟 PROJECT 空间树结构
 * 结构：年份 → 项目 → 项目资料(OSS) / 小组 → 小组资料(OSS) / 自定义文件夹
 * 后续切换真实接口时，只需替换 loadFolderTree 中的 Mock 调用
 */

// ==================== 项目空间树结构 Mock ====================

const mockProjectSpaceTree = [
  {
    id: 'year_2026',
    name: '2026年',
    folder_type: 'PROJECT',
    node_type: 'YEAR',
    permission: 'READ',
    children: [
      {
        id: 'proj_2026_001',
        name: '2026年度财政审计',
        folder_type: 'PROJECT',
        node_type: 'PROJECT',
        project_code: 'SJ-2026-001',
        permission: 'FULL',
        children: [
          {
            id: 'oss_proj_doc_2026_001',
            name: '项目资料（智能作业平台推送）',
            folder_type: 'PROJECT',
            node_type: 'FOLDER',
            permission: 'READ',
            is_oss_folder: true,
            children: []
          },
          {
            id: 'grp_2026_001_01',
            name: '第一审计小组',
            folder_type: 'PROJECT',
            node_type: 'FOLDER',
            permission: 'FULL',
            children: [
              {
                id: 'oss_group_doc_2026_001_01',
                name: '小组资料（智能作业平台推送）',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'READ',
                is_oss_folder: true,
                children: []
              },
              {
                id: 'folder_2026_001_01_a',
                name: '审计底稿',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'FULL',
                children: []
              },
              {
                id: 'folder_2026_001_01_b',
                name: '取证资料',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'FULL',
                children: []
              }
            ]
          },
          {
            id: 'grp_2026_001_02',
            name: '第二审计小组',
            folder_type: 'PROJECT',
            node_type: 'GROUP',
            permission: 'READ',
            children: [
              {
                id: 'oss_group_doc_2026_001_02',
                name: '小组资料（智能作业平台推送）',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'READ',
                is_oss_folder: true,
                children: []
              },
              {
                id: 'folder_2026_001_02_a',
                name: '工作记录',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'READ',
                children: []
              }
            ]
          }
        ]
      },
      {
        id: 'proj_2026_002',
        name: '某单位经济责任审计',
        folder_type: 'PROJECT',
        node_type: 'PROJECT',
        project_code: 'SJ-2026-002',
        permission: 'FULL',
        children: [
          {
            id: 'oss_proj_doc_2026_002',
            name: '项目资料（智能作业平台推送）',
            folder_type: 'PROJECT',
            node_type: 'FOLDER',
            permission: 'READ',
            is_oss_folder: true,
            children: []
          },
          {
            id: 'grp_2026_002_01',
            name: '审计组',
            folder_type: 'PROJECT',
            node_type: 'GROUP',
            permission: 'FULL',
            children: [
              {
                id: 'oss_group_doc_2026_002_01',
                name: '小组资料（智能作业平台推送）',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'READ',
                is_oss_folder: true,
                children: []
              },
              {
                id: 'folder_2026_002_01_a',
                name: '财务资料',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'FULL',
                children: []
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'year_2025',
    name: '2025年',
    folder_type: 'PROJECT',
    node_type: 'YEAR',
    permission: 'READ',
    children: [
      {
        id: 'proj_2025_001',
        name: '2025年度预算执行审计',
        folder_type: 'PROJECT',
        node_type: 'PROJECT',
        project_code: 'SJ-2025-001',
        permission: 'READ',
        children: [
          {
            id: 'oss_proj_doc_2025_001',
            name: '项目资料（智能作业平台推送）',
            folder_type: 'PROJECT',
            node_type: 'FOLDER',
            permission: 'READ',
            is_oss_folder: true,
            children: []
          },
          {
            id: 'grp_2025_001_01',
            name: '审计小组',
            folder_type: 'PROJECT',
            node_type: 'GROUP',
            permission: 'READ',
            children: [
              {
                id: 'oss_group_doc_2025_001_01',
                name: '小组资料（智能作业平台推送）',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'READ',
                is_oss_folder: true,
                children: []
              },
              {
                id: 'folder_2025_001_01_a',
                name: '审计报告',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'READ',
                children: []
              }
            ]
          }
        ]
      },
      {
        id: 'proj_2025_002',
        name: '某某项目专项审计',
        folder_type: 'PROJECT',
        node_type: 'PROJECT',
        project_code: 'SJ-2025-002',
        permission: 'FULL',
        children: [
          {
            id: 'oss_proj_doc_2025_002',
            name: '项目资料（智能作业平台推送）',
            folder_type: 'PROJECT',
            node_type: 'FOLDER',
            permission: 'READ',
            is_oss_folder: true,
            children: []
          },
          {
            id: 'ref_folder_001',
            name: '引入-政策法规库',
            folder_type: 'PROJECT',
            node_type: 'FOLDER',
            permission: 'READ',
            is_reference: true,
            ref_target_id: 'public_folder_001',
            ref_target_space: 'PUBLIC',
            children: []
          },
          {
            id: 'grp_2025_002_01',
            name: '现场组',
            folder_type: 'PROJECT',
            node_type: 'GROUP',
            permission: 'FULL',
            children: [
              {
                id: 'oss_group_doc_2025_002_01',
                name: '小组资料（智能作业平台推送）',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'READ',
                is_oss_folder: true,
                children: []
              },
              {
                id: 'folder_2025_002_01_a',
                name: '现场资料',
                folder_type: 'PROJECT',
                node_type: 'FOLDER',
                permission: 'FULL',
                children: []
              }
            ]
          }
        ]
      }
    ]
  }
]

// ==================== Mock API 封装 ====================

/**
 * 获取项目空间文件夹树（Mock）
 * 后续替换为真实接口：GET /api/v1/file-manager/folder-tree?space_type=PROJECT
 */
export const getProjectSpaceTreeMockAPI = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 200,
        message: 'success',
        data: JSON.parse(JSON.stringify(mockProjectSpaceTree))
      })
    }, 300)
  })
}

/**
 * 获取当前用户在指定项目下的角色与权限（Mock）
 * 后续替换为真实接口：GET /api/v1/project-space/roles/me?project_id=xxx
 */
export const getUserProjectRoleMockAPI = (params) => {
  // 模拟：proj_2026_001 / proj_2026_002 / proj_2025_002 返回 FULL 权限，其他返回 READ
  const projectId = params?.project_id || ''
  const isFull = projectId === 'proj_2026_001' || projectId === 'proj_2026_002' || projectId === 'proj_2025_002'
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 200,
        message: 'success',
        data: {
          role_code: isFull ? 'ZHUSHEN' : 'SHENJI_PERSON',
          role_name: isFull ? '主审' : '审计人员',
          permissions: isFull
            ? ['UPLOAD', 'DOWNLOAD', 'DELETE', 'MANAGE', 'MANAGE_PROJECT', 'IMPORT_FOLDER', 'REMOVE_REF_FOLDER']
            : ['DOWNLOAD']
        }
      })
    }, 200)
  })
}

/**
 * 引入外部文件夹到项目空间（Mock）
 * 后续替换为真实接口：POST /api/v1/project-space/folder-references
 */
export const importFolderMockAPI = (data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 200,
        message: 'success',
        data: {
          ref_id: `ref_${Date.now()}`,
          target_folder_id: data.target_folder_id,
          source_folder_id: data.source_folder_id,
          source_space_type: data.source_space_type
        }
      })
    }, 200)
  })
}

/**
 * 取消引入（Mock）
 * 后续替换为真实接口：DELETE /api/v1/project-space/folder-references/{ref_id}
 */
export const removeFolderReferenceMockAPI = (refId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ code: 200, message: 'success' })
    }, 200)
  })
}

/**
 * 接口四：根据项目ID获取审计小组信息（Mock）
 * 后续替换为真实接口：GET /api/v1/project-space/groups?project_id=xxx
 */
export const getProjectGroupsMockAPI = (params) => {
  const projectId = params?.project_id || ''
  // 模拟数据：根据项目ID返回对应的小组
  const mockGroupsMap = {
    'proj_2026_001': [
      { group_id: 'grp_2026_001_01', name: '第一审计小组', leader_name: '示例人员18', member_count: 5 },
      { group_id: 'grp_2026_001_02', name: '第二审计小组', leader_name: '示例人员19', member_count: 3 }
    ],
    'proj_2026_002': [
      { group_id: 'grp_2026_002_01', name: '审计组', leader_name: '示例人员20', member_count: 4 }
    ],
    'proj_2025_001': [
      { group_id: 'grp_2025_001_01', name: '审计小组', leader_name: '示例人员21', member_count: 2 }
    ],
    'proj_2025_002': [
      { group_id: 'grp_2025_002_01', name: '现场组', leader_name: '示例人员22', member_count: 6 }
    ]
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 200,
        message: 'success',
        data: {
          project_id: projectId,
          groups: mockGroupsMap[projectId] || []
        }
      })
    }, 200)
  })
}

// ==================== 数据字典配置参考（project_role）====================

/**
 * 项目角色权限映射（供前端判断使用）
 * 与数据字典 project_role 的 value 字段对应
 */
export const projectRolePermissionMap = {
  ZHUSHEN: ['UPLOAD', 'DOWNLOAD', 'DELETE', 'MANAGE', 'MANAGE_PROJECT', 'IMPORT_FOLDER', 'REMOVE_REF_FOLDER'],
  SHENJI_ZUZHANG: ['UPLOAD', 'DOWNLOAD', 'DELETE', 'MANAGE', 'IMPORT_FOLDER', 'REMOVE_REF_FOLDER'],
  SHENJI_VICE_ZUZHANG: ['UPLOAD', 'DOWNLOAD', 'DELETE', 'MANAGE'],
  SHENJI_XIAOZUZHANG: ['UPLOAD', 'DOWNLOAD', 'DELETE', 'MANAGE'],
  SHENJI_PERSON: ['UPLOAD', 'DOWNLOAD'],
  XIANCHANG_FUZEREN: ['UPLOAD', 'DOWNLOAD', 'DELETE', 'MANAGE'],
  JIGUAN_ADMIN: ['UPLOAD', 'DOWNLOAD', 'DELETE', 'MANAGE', 'MANAGE_PROJECT', 'IMPORT_FOLDER', 'REMOVE_REF_FOLDER'],
  SHENLI_MAIN_FUZEREN: ['DOWNLOAD'],
  SHENLI_FUZEREN: ['DOWNLOAD'],
  SHENLI_PERSON: ['DOWNLOAD'],
  LINGDAO: ['DOWNLOAD'],
  SI_LINGDAO: ['DOWNLOAD'],
  // 分管局领导（UUID 作为 key）
  'ef345089bc134f31b4bb3c35fc72cf4f': ['DOWNLOAD'],
  ZHENGGAI_ADMIN: ['DOWNLOAD'],
  ZHENGGAI_PERSON: ['DOWNLOAD'],
  ZHENGGAI_VIEW_PERSON: ['DOWNLOAD'],
  YISONG_PERSON: ['DOWNLOAD'],
  XIAOHAO_PERSON: ['DOWNLOAD']
}

export default {
  getProjectSpaceTreeMockAPI,
  getUserProjectRoleMockAPI,
  importFolderMockAPI,
  removeFolderReferenceMockAPI,
  getProjectGroupsMockAPI,
  projectRolePermissionMap
}
