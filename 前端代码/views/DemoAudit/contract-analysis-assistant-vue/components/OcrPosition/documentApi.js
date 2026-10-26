/**
 * Vue版本的文档API服务
 * 提供文档上传、查询、删除等API接口调用功能
 * 
 * Author: AAP Development Team
 * Created: 2025-01-30
 * Version: 1.0.0 (Vue版本)
 */

// API基础配置
const API_BASE_URL = '/api/v1'

/**
 * 获取请求头
 */
const getHeaders = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token')
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  }
}

/**
 * API请求封装
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const config = {
    headers: getHeaders(),
    ...options
  }

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data

  } catch (error) {
    console.error('API请求失败:', { url, error })
    throw error
  }
}

/**
 * 文档API服务类
 */
export class DocumentApiService {
  /**
   * 获取文档预览
   */
  static async getDocumentPreview(documentId) {
    try {
      console.log('📄 获取文档预览:', documentId)
      const response = await apiRequest(`/documents/${documentId}/preview`)
      return response.data || response
    } catch (error) {
      console.error('❌ 获取文档预览失败:', error)
      throw error
    }
  }

  /**
   * 获取文档信息
   */
  static async getDocument(documentId) {
    try {
      const response = await apiRequest(`/documents/${documentId}`)
      return response.data || response
    } catch (error) {
      console.error('❌ 获取文档信息失败:', error)
      throw error
    }
  }

  /**
   * 获取文档列表
   */
  static async getDocumentList(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString()
      const endpoint = `/documents${queryString ? `?${queryString}` : ''}`
      const response = await apiRequest(endpoint)
      return response.data || response
    } catch (error) {
      console.error('❌ 获取文档列表失败:', error)
      throw error
    }
  }

  /**
   * 上传文档
   */
  static async uploadDocument(file, onProgress) {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100)
            onProgress(progress)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              resolve(response.data || response)
            } catch (error) {
              reject(new Error('解析响应失败'))
            }
          } else {
            reject(new Error(`上传失败: ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('网络错误'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('上传被取消'))
        })

        const token = localStorage.getItem('token') || localStorage.getItem('auth_token')
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }

        xhr.open('POST', `${API_BASE_URL}/documents/upload`)
        xhr.send(formData)
      })

    } catch (error) {
      console.error('❌ 上传文档失败:', error)
      throw error
    }
  }

  /**
   * 批量上传文档
   */
  static async batchUploadDocuments(files) {
    try {
      const formData = new FormData()
      files.forEach((file, index) => {
        formData.append(`files`, file)
      })

      const response = await fetch(`${API_BASE_URL}/documents/batch-upload`, {
        method: 'POST',
        headers: {
          'Authorization': getHeaders().Authorization
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`批量上传失败: ${response.status}`)
      }

      const data = await response.json()
      return data.data || data

    } catch (error) {
      console.error('❌ 批量上传文档失败:', error)
      throw error
    }
  }

  /**
   * 删除文档
   */
  static async deleteDocument(documentId) {
    try {
      await apiRequest(`/documents/${documentId}`, {
        method: 'DELETE'
      })
      console.log('✅ 文档删除成功:', documentId)
    } catch (error) {
      console.error('❌ 删除文档失败:', error)
      throw error
    }
  }

  /**
   * 更新文档状态
   */
  static async updateDocumentStatus(documentId, status) {
    try {
      const response = await apiRequest(`/documents/${documentId}/status`, {
        method: 'PUT',
        body: JSON.stringify(status)
      })
      return response.data || response
    } catch (error) {
      console.error('❌ 更新文档状态失败:', error)
      throw error
    }
  }

  /**
   * 获取支持的文件格式
   */
  static async getSupportedFormats() {
    try {
      const response = await apiRequest('/documents/supported-formats')
      return response.data || response
    } catch (error) {
      console.error('❌ 获取支持格式失败:', error)
      throw error
    }
  }

  /**
   * 获取文档转换状态
   */
  static async getConversionStatus(documentId) {
    try {
      const response = await apiRequest(`/documents/${documentId}/conversion-status`)
      return response.data || response
    } catch (error) {
      console.error('❌ 获取转换状态失败:', error)
      throw error
    }
  }

  /**
   * 清除文档预览缓存
   */
  static async clearDocumentPreviewCache(documentId) {
    try {
      await apiRequest(`/documents/${documentId}/preview/cache`, {
        method: 'DELETE'
      })
      console.log('✅ 预览缓存清除成功:', documentId)
    } catch (error) {
      console.error('❌ 清除预览缓存失败:', error)
      throw error
    }
  }

  /**
   * 获取预览统计信息
   */
  static async getPreviewStatistics() {
    try {
      const response = await apiRequest('/documents/preview/statistics')
      return response.data || response
    } catch (error) {
      console.error('❌ 获取预览统计失败:', error)
      throw error
    }
  }

  /**
   * 重置会话批次
   */
  static async resetSessionBatch() {
    try {
      const response = await apiRequest('/documents/session/reset-batch', {
        method: 'POST'
      })
      return response.data || response
    } catch (error) {
      console.error('❌ 重置会话批次失败:', error)
      throw error
    }
  }
}

/**
 * 文件上传工具类
 */
export class FileUploadUtils {
  /**
   * 验证文件格式
   */
  static validateFileFormat(file, allowedFormats = ['txt', 'doc', 'docx', 'pdf']) {
    if (!file || !file.name) return false
    
    const extension = file.name.split('.').pop()
    const lowerExtension = extension && extension.toLowerCase()
    return allowedFormats.includes(lowerExtension)
  }

  /**
   * 验证文件大小
   */
  static validateFileSize(file, maxSize = 50 * 1024 * 1024) { // 默认50MB
    return file && file.size <= maxSize
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 生成文件唯一标识
   */
  static generateFileKey(file) {
    return `${file.name}-${file.size}-${file.lastModified || Date.now()}`
  }

  /**
   * 开始新的会话批次
   */
  static async startNewSessionBatch() {
    try {
      const response = await apiRequest('/documents/session/start-batch', {
        method: 'POST'
      })
      return response
    } catch (error) {
      console.error('❌ 开始新会话批次失败:', error)
      throw error
    }
  }
}

export default DocumentApiService