/**
 * OCR位置定位组件导出
 * 
 * Author: AAP Development Team
 * Created: 2025-01-30
 * Version: 1.0.0
 */

// Vue版本的组件
import DocumentLocator from './DocumentLocator.vue'
import { DirectPDFStyleLocatorService } from './directPDFStyleLocatorService.js'
import DocumentApiService, { FileUploadUtils } from './documentApi.js'

// React版本的组件（保持兼容）
import ReactDocumentLocator from './react/DocumentLocator.tsx'
import { DirectPDFStyleLocatorService as ReactDirectPDFStyleLocatorService } from './react/directPDFStyleLocatorService.ts'
import ReactDocumentApiService from './react/documentApi.ts'

export {
  // Vue版本
  DocumentLocator,
  DirectPDFStyleLocatorService,
  DocumentApiService,
  FileUploadUtils,
  
  // React版本（兼容性导出）
  ReactDocumentLocator,
  ReactDirectPDFStyleLocatorService,
  ReactDocumentApiService
}

// 默认导出Vue版本
export default DocumentLocator