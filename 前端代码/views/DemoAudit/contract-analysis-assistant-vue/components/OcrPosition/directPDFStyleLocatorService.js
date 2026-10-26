/**
 * Vue版本的直接修改PDF元素样式的定位服务
 * 
 * 该类负责直接修改PDF文档内容元素的样式，而非创建覆盖层。
 * 这种方式更自然，用户可以通过滚动查看完整的高亮内容，不受弹窗大小限制。
 * 
 * 主要功能：
 * 1. 通过坐标定位PDF内容元素
 * 2. 直接修改元素的CSS样式（背景色、边框等）
 * 3. 支持PDF页面跳转和自动滚动
 * 4. 管理样式的生命周期（应用、清除、手动恢复）
 * 5. 支持文本、图片、表格等不同类型内容的样式定制
 * 
 * Author: AAP Development Team
 * Created: 2025-01-30
 * Version: 1.0.0 (Vue版本)
 */

/**
 * 高亮样式配置
 */
const HIGHLIGHT_STYLES = {
  text: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    border: '1px solid rgba(255, 193, 7, 0.3)',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(255, 193, 7, 0.3)',
    padding: '2px 4px',
    transition: 'all 0.3s ease'
  },
  image: {
    border: '3px solid #28a745',
    borderRadius: '4px',
    boxShadow: '0 2px 12px rgba(40, 167, 69, 0.4)',
    transition: 'all 0.3s ease'
  },
  table: {
    backgroundColor: '#e7f3ff',
    border: '2px solid #007bff',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
    transition: 'all 0.3s ease'
  }
}

/**
 * PDF元素信息接口
 */
class PDFElementInfo {
  constructor(element, originalStyles, highlightId, elementType) {
    this.element = element
    this.originalStyles = originalStyles
    this.highlightId = highlightId
    this.elementType = elementType
    this.createdAt = new Date()
  }
}

/**
 * 直接修改PDF元素样式的定位服务类
 */
export class DirectPDFStyleLocatorService {
  constructor(config = {}) {
    /** PDF查看器实例引用 */
    this.pdfViewer = null
    
    /** PDF文档实例引用 */
    this.pdfDocument = null
    
    /** 当前被修改样式的元素记录 */
    this.modifiedElements = new Map()
    
    /** 临时高亮容器映射 */
    this.temporaryContainers = new Map()
    
    /** 样式修改历史记录 */
    this.styleModificationHistory = []
    
    /** 自动恢复样式的定时器ID */
    this.autoRestoreTimer = null
    
    /** 服务配置 */
    this.config = {
      autoRestoreDelay: 30000, // 30秒后自动恢复
      enableAutoRestore: true,
      highlightStyles: HIGHLIGHT_STYLES,
      debugMode: false,
      ...config
    }
    
    /** 服务状态 */
    this.state = {
      isActive: true,
      highlightCount: 0,
      lastHighlightTime: null,
      totalModifications: 0
    }
    
    /** 服务ID */
    this.serviceId = `pdf-locator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log('🎨 DirectPDFStyleLocatorService 初始化完成', {
      serviceId: this.serviceId,
      config: this.config
    })
  }

  /**
   * 通过直接样式修改进行高亮定位
   */
  async highlightWithDirectStyleModification(position, highlightInfo = {}) {
    try {
      console.log('🎯 开始直接样式修改高亮定位:', { position, highlightInfo })

      if (!this._validatePosition(position)) {
        throw new Error('无效的位置信息')
      }

      // 等待PDF容器准备就绪
      await this._waitForPDFContainer()

      // 根据内容类型选择不同的修改策略
      const contentType = position.type || 'text'
      
      switch (contentType) {
        case 'text':
          this._modifyTextElementStyle(position, highlightInfo)
          break
        case 'image':
          this._modifyImageElementStyle(position, highlightInfo)
          break
        case 'table':
          this._modifyTableElementStyle(position, highlightInfo)
          break
        default:
          // 默认使用文本处理方式
          this._modifyTextElementStyle(position, highlightInfo)
      }

      // 滚动到目标位置
      this._scrollToPosition(position)

      // 更新状态
      this.state.highlightCount++
      this.state.lastHighlightTime = new Date()
      this.state.totalModifications++

      // 设置自动恢复定时器
      if (this.config.enableAutoRestore) {
        this._setupAutoRestoreTimer()
      }

      console.log('✅ 直接样式修改高亮定位完成')

    } catch (error) {
      console.error('❌ 直接样式修改高亮定位失败:', error)
      // 创建临时高亮容器作为备选方案
      this._createTemporaryHighlightContainer(position, highlightInfo)
    }
  }

  /**
   * 修改文本元素样式
   */
  _modifyTextElementStyle(position, highlightInfo = {}) {
    try {
      console.log('📝 开始修改文本元素样式:', position)

      // 查找目标文本元素
      const textElements = this._findPDFElementsByPreciseCoordinates(position, this._getCurrentPageElement(position.page))
      
      if (textElements.length === 0) {
        console.warn('⚠️ 未找到匹配的文本元素，尝试备选方案')
        this._createTemporaryHighlightContainer(position, highlightInfo)
        return
      }

      console.log(`📝 找到 ${textElements.length} 个文本元素`)

      // 为每个找到的元素应用样式
      textElements.forEach((element, index) => {
        const highlightId = `text-highlight-${this.serviceId}-${Date.now()}-${index}`
        const originalStyles = this._saveOriginalStyles(element)
        
        // 应用高亮样式
        this._applyTextHighlightStyle(element, this._getEffectiveHighlightStyle(highlightInfo))
        
        // 记录修改信息
        const elementInfo = new PDFElementInfo(element, originalStyles, highlightId, 'text')
        this.modifiedElements.set(highlightId, elementInfo)
        
        console.log('✅ 文本元素样式修改完成:', { highlightId, element })
      })

    } catch (error) {
      console.error('❌ 修改文本元素样式失败:', error)
    }
  }

  /**
   * 创建临时高亮容器（备选方案）
   */
  _createTemporaryHighlightContainer(position, highlightInfo = {}) {
    try {
      console.log('🎨 创建临时高亮容器:', position)

      const pageContainer = this._getCurrentPageElement(position.page)
      if (!pageContainer) {
        console.error('❌ 未找到页面容器')
        return
      }

      // 计算容器位置
      const containerInfo = this._calculateContainerPosition(position, pageContainer)
      if (!containerInfo) {
        console.error('❌ 无法计算容器位置')
        return
      }

      // 创建高亮元素
      const style = this._getEffectiveHighlightStyle(highlightInfo)
      const highlightContainer = this._createHighlightElement(containerInfo, style, position.type || 'text')

      // 应用样式
      this._applyHighlightStyles(highlightContainer, style, position.type || 'text')

      // 添加到页面
      this._appendHighlightContainer(highlightContainer, pageContainer, position)

      // 记录临时容器
      this._recordTemporaryContainer(highlightContainer, position)

      console.log('✅ 临时高亮容器创建完成')

    } catch (error) {
      console.error('❌ 创建临时高亮容器失败:', error)
    }
  }

  /**
   * 计算容器位置
   */
  _calculateContainerPosition(position, pageContainer) {
    try {
      // 优先从canvas获取实际尺寸（更准确）
      let actualPageWidth = position.pageWidth || 595
      let actualPageHeight = position.pageHeight || 842
      
      const canvas = pageContainer.tagName === 'CANVAS' ? pageContainer : pageContainer.querySelector('canvas')
      if (canvas) {
        // canvas的实际尺寸（像素）
        const canvasWidth = canvas.width || canvas.offsetWidth
        const canvasHeight = canvas.height || canvas.offsetHeight
        
        // 如果canvas有尺寸，使用canvas尺寸作为参考
        if (canvasWidth > 0 && canvasHeight > 0) {
          // OCR坐标可能基于原始PDF尺寸，而canvas可能是缩放后的
          // 但我们使用canvas的实际尺寸进行转换
          actualPageWidth = canvasWidth
          actualPageHeight = canvasHeight
        }
      }
      
      const pageRect = pageContainer.getBoundingClientRect()
      const pageStyle = window.getComputedStyle(pageContainer)
      
      // 获取页面的实际内容区域
      const paddingLeft = parseFloat(pageStyle.paddingLeft) || 0
      const paddingTop = parseFloat(pageStyle.paddingTop) || 0
      
      // 计算相对位置（使用实际的页面尺寸进行比例转换）
      const scaleX = pageRect.width / actualPageWidth
      const scaleY = pageRect.height / actualPageHeight
      
      const relativeX = position.x * scaleX
      const relativeY = position.y * scaleY
      const relativeWidth = position.width * scaleX
      const relativeHeight = position.height * scaleY

      console.log('📐 坐标转换:', {
        ocrCoord: { x: position.x, y: position.y, width: position.width, height: position.height },
        pageSize: { width: actualPageWidth, height: actualPageHeight },
        displaySize: { width: pageRect.width, height: pageRect.height },
        scale: { x: scaleX, y: scaleY },
        result: { x: relativeX, y: relativeY, width: relativeWidth, height: relativeHeight }
      })

      return {
        left: paddingLeft + relativeX,
        top: paddingTop + relativeY,
        width: Math.max(relativeWidth, 20), // 最小宽度
        height: Math.max(relativeHeight, 16), // 最小高度
        pageRect,
        position
      }
    } catch (error) {
      console.error('❌ 计算容器位置失败:', error)
      return null
    }
  }

  /**
   * 创建高亮元素
   */
  _createHighlightElement(containerInfo, style, contentType) {
    const highlightContainer = document.createElement('div')
    highlightContainer.className = `pdf-highlight-container pdf-highlight-${contentType}`
    highlightContainer.style.position = 'absolute'
    highlightContainer.style.left = `${containerInfo.left}px`
    highlightContainer.style.top = `${containerInfo.top}px`
    highlightContainer.style.width = `${containerInfo.width}px`
    highlightContainer.style.height = `${containerInfo.height}px`
    highlightContainer.style.pointerEvents = 'none'
    highlightContainer.style.zIndex = '1000'
    
    return highlightContainer
  }

  /**
   * 应用高亮样式
   */
  _applyHighlightStyles(element, style, contentType) {
    if (style.backgroundColor) {
      element.style.backgroundColor = style.backgroundColor
    }
    if (style.border) {
      element.style.border = style.border
    }
    if (style.borderRadius) {
      element.style.borderRadius = style.borderRadius
    }
    if (style.boxShadow) {
      element.style.boxShadow = style.boxShadow
    }
    if (style.transition) {
      element.style.transition = style.transition
    }
  }

  /**
   * 添加高亮容器到页面
   */
  _appendHighlightContainer(highlightContainer, pageContainer, position) {
    try {
      pageContainer.style.position = 'relative'
      pageContainer.appendChild(highlightContainer)
    } catch (error) {
      console.error('❌ 添加高亮容器失败:', error)
    }
  }

  /**
   * 记录临时容器
   */
  _recordTemporaryContainer(container, position) {
    const containerId = `temp-container-${this.serviceId}-${Date.now()}`
    container.setAttribute('data-highlight-id', containerId)
    
    this.temporaryContainers.set(containerId, {
      element: container,
      position: position,
      createdAt: new Date(),
      type: position.type || 'text'
    })
  }

  /**
   * 跳转到指定页面
   */
  async jumpToPage(targetPage) {
    try {
      console.log('📄 跳转到页面:', targetPage)
      
      const pageElement = this._getCurrentPageElement(targetPage)
      if (pageElement) {
        pageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
        
        // 等待滚动完成
        await new Promise(resolve => setTimeout(resolve, 500))
        console.log('✅ 页面跳转完成')
      } else {
        console.warn('⚠️ 未找到目标页面元素')
      }
    } catch (error) {
      console.error('❌ 页面跳转失败:', error)
    }
  }

  /**
   * 滚动到位置
   */
  _scrollToPosition(position) {
    try {
      const pageElement = this._getCurrentPageElement(position.page)
      if (!pageElement) {
        console.warn('⚠️ 未找到页面元素，无法滚动')
        return
      }

      const scrollContainer = this._findScrollContainer()
      if (!scrollContainer) {
        console.warn('⚠️ 未找到滚动容器')
        return
      }

      const pageRect = pageElement.getBoundingClientRect()
      const containerRect = scrollContainer.getBoundingClientRect()
      
      // 计算目标位置在页面中的相对位置
      const relativeY = (position.y / (position.pageHeight || 842)) * pageRect.height
      const targetY = pageElement.offsetTop + relativeY - containerRect.height / 2

      scrollContainer.scrollTo({
        top: Math.max(0, targetY),
        behavior: 'smooth'
      })

      console.log('✅ 滚动到目标位置完成')
    } catch (error) {
      console.error('❌ 滚动到位置失败:', error)
    }
  }

  /**
   * 查找滚动容器
   */
  _findScrollContainer() {
    // 查找PDF容器
    const pdfContainer = document.querySelector('.document-locator-pdf-container')
    if (pdfContainer) {
      return pdfContainer
    }

    // 查找vue-office-pdf容器
    const vueOfficePdf = document.querySelector('.vue-office-pdf-wrapper')
    if (vueOfficePdf) {
      return vueOfficePdf
    }

    // 默认使用document.body
    return document.body
  }

  /**
   * 获取当前页面元素
   */
  _getCurrentPageElement(pageNumber) {
    try {
      console.log('🔍 查找页面元素，页码:', pageNumber)
      
      // 首先检查vue-office-pdf是否已渲染
      const vueOfficePdf = document.querySelector('.vue-office-pdf-wrapper')
      if (!vueOfficePdf) {
        console.warn('⚠️ vue-office-pdf容器未找到')
        return null
      }
  
      // 尝试多种选择器查找页面元素
      const selectors = [
        // vue-office-pdf 可能的页面选择器
        `.vue-office-pdf-wrapper`
      ]
  
      for (const selector of selectors) {
        const element = document.querySelector(selector)
        if (element && this._validatePageElement(element, pageNumber)) {
          console.log('✅ 找到页面元素:', { pageNumber, selector, element })
          return element
        }
      }
  
      // 如果没有找到特定页面，尝试查找所有canvas元素
      const allCanvases = vueOfficePdf.querySelectorAll('canvas')
      console.log(`🔍 找到 ${allCanvases.length} 个canvas元素`)
      
      if (allCanvases.length > 0) {
        // 如果页码在范围内，返回对应的canvas
        const targetIndex = pageNumber - 1
        if (targetIndex >= 0 && targetIndex < allCanvases.length) {
          const targetCanvas = allCanvases[targetIndex]
          console.log('✅ 使用索引找到页面元素:', { pageNumber, targetIndex, element: targetCanvas })
          return targetCanvas
        }
        
        // 否则返回第一个canvas作为备选
        console.log('⚠️ 使用第一个canvas作为备选')
        return allCanvases[0]
      }
  
      console.warn('⚠️ 未找到任何页面元素:', pageNumber)
      return null
    } catch (error) {
      console.error('❌ 获取页面元素失败:', error)
      return null
    }
  }

  /**
   * 验证页面元素
   */
  _validatePageElement(element, expectedPageNumber) {
    if (!element) return false
    
    // 检查元素是否可见
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return false
    }

    // 检查页面编号（如果有的话）
    const pageAttr = element.getAttribute('data-page') || 
                    element.getAttribute('data-page-number')
    if (pageAttr && parseInt(pageAttr) !== expectedPageNumber) {
      return false
    }

    return true
  }

  /**
   * 通过精确坐标查找PDF元素
   */
  _findPDFElementsByPreciseCoordinates(position, pageElement) {
    if (!pageElement) {
      console.warn('⚠️ 页面元素不存在')
      return []
    }

    try {
      // 优先从canvas获取实际尺寸
      let actualPageWidth = position.pageWidth || 595
      let actualPageHeight = position.pageHeight || 842
      
      const canvas = pageElement.tagName === 'CANVAS' ? pageElement : pageElement.querySelector('canvas')
      if (canvas) {
        const canvasWidth = canvas.width || canvas.offsetWidth
        const canvasHeight = canvas.height || canvas.offsetHeight
        if (canvasWidth > 0 && canvasHeight > 0) {
          actualPageWidth = canvasWidth
          actualPageHeight = canvasHeight
        }
      }
      
      const pageRect = pageElement.getBoundingClientRect()
      const elements = []

      // 计算目标区域（使用实际的页面尺寸进行比例转换）
      const scaleX = pageRect.width / actualPageWidth
      const scaleY = pageRect.height / actualPageHeight
      
      const targetX = position.x * scaleX
      const targetY = position.y * scaleY
      const targetWidth = position.width * scaleX
      const targetHeight = position.height * scaleY
      
      console.log('🔍 查找元素坐标转换:', {
        ocrCoord: { x: position.x, y: position.y, width: position.width, height: position.height },
        pageSize: { width: actualPageWidth, height: actualPageHeight },
        displaySize: { width: pageRect.width, height: pageRect.height },
        targetArea: { x: targetX, y: targetY, width: targetWidth, height: targetHeight }
      })

      // 查找页面内的所有文本元素
      const textElements = pageElement.querySelectorAll('span, div, p, text')
      
      for (const element of textElements) {
        const elementRect = element.getBoundingClientRect()
        const relativeRect = {
          left: elementRect.left - pageRect.left,
          top: elementRect.top - pageRect.top,
          width: elementRect.width,
          height: elementRect.height
        }

        // 检查是否在目标区域内
        if (this._isElementInTargetArea(relativeRect, {
          x: targetX,
          y: targetY,
          width: targetWidth,
          height: targetHeight
        })) {
          elements.push(element)
        }
      }

      console.log(`🔍 在坐标 (${targetX}, ${targetY}) 找到 ${elements.length} 个元素`)
      return elements

    } catch (error) {
      console.error('❌ 通过坐标查找元素失败:', error)
      return []
    }
  }

  /**
   * 检查元素是否在目标区域内
   */
  _isElementInTargetArea(elementRect, targetArea) {
    const tolerance = 10 // 容差值

    return (
      elementRect.left >= targetArea.x - tolerance &&
      elementRect.top >= targetArea.y - tolerance &&
      elementRect.left <= targetArea.x + targetArea.width + tolerance &&
      elementRect.top <= targetArea.y + targetArea.height + tolerance
    )
  }

  /**
   * 保存原始样式
   */
  _saveOriginalStyles(element) {
    const stylesToSave = [
      'backgroundColor', 'border', 'borderRadius', 'boxShadow', 
      'padding', 'margin', 'color', 'fontSize', 'fontWeight'
    ]
    
    const originalStyles = {}
    const computedStyle = window.getComputedStyle(element)
    
    stylesToSave.forEach(prop => {
      originalStyles[prop] = computedStyle[prop] || element.style[prop] || ''
    })
    
    return originalStyles
  }

  /**
   * 应用文本高亮样式
   */
  _applyTextHighlightStyle(element, style) {
    try {
      if (style.backgroundColor) {
        element.style.backgroundColor = style.backgroundColor
      }
      if (style.border) {
        element.style.border = style.border
      }
      if (style.borderRadius) {
        element.style.borderRadius = style.borderRadius
      }
      if (style.boxShadow) {
        element.style.boxShadow = style.boxShadow
      }
      if (style.padding) {
        element.style.padding = style.padding
      }
      if (style.transition) {
        element.style.transition = style.transition
      }

      // 确保元素可见
      element.style.position = 'relative'
      element.style.zIndex = '999'

      console.log('✅ 文本高亮样式应用完成')
    } catch (error) {
      console.error('❌ 应用文本高亮样式失败:', error)
    }
  }

  /**
   * 修改图片元素样式
   */
  _modifyImageElementStyle(position, highlightInfo = {}) {
    try {
      console.log('🖼️ 开始修改图片元素样式:', position)

      const imageElements = this._findImageElementsByCoordinates(position)
      
      if (imageElements.length === 0) {
        console.warn('⚠️ 未找到匹配的图片元素，使用备选方案')
        this._createTemporaryHighlightContainer(position, highlightInfo)
        return
      }

      imageElements.forEach((element, index) => {
        const highlightId = `image-highlight-${this.serviceId}-${Date.now()}-${index}`
        const originalStyles = this._saveOriginalStyles(element)
        
        this._applyImageHighlightStyle(element, this._getEffectiveImageStyle(highlightInfo))
        
        const elementInfo = new PDFElementInfo(element, originalStyles, highlightId, 'image')
        this.modifiedElements.set(highlightId, elementInfo)
      })

    } catch (error) {
      console.error('❌ 修改图片元素样式失败:', error)
    }
  }

  /**
   * 查找图片元素
   */
  _findImageElementsByCoordinates(position) {
    const pageElement = this._getCurrentPageElement(position.page)
    if (!pageElement) return []

    return Array.from(pageElement.querySelectorAll('img, canvas, svg'))
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
  }

  /**
   * 应用图片高亮样式
   */
  _applyImageHighlightStyle(element, style) {
    try {
      if (style.border) {
        element.style.border = style.border
      }
      if (style.borderRadius) {
        element.style.borderRadius = style.borderRadius
      }
      if (style.boxShadow) {
        element.style.boxShadow = style.boxShadow
      }
      if (style.transition) {
        element.style.transition = style.transition
      }

      element.style.position = 'relative'
      element.style.zIndex = '999'

      console.log('✅ 图片高亮样式应用完成')
    } catch (error) {
      console.error('❌ 应用图片高亮样式失败:', error)
    }
  }

  /**
   * 修改表格元素样式
   */
  _modifyTableElementStyle(position, highlightInfo = {}) {
    try {
      console.log('📊 开始修改表格元素样式:', position)

      const tableElements = this._findTableElementsByCoordinates(position)
      
      if (tableElements.length === 0) {
        console.warn('⚠️ 未找到匹配的表格元素，使用备选方案')
        this._createTemporaryHighlightContainer(position, highlightInfo)
        return
      }

      tableElements.forEach((element, index) => {
        const highlightId = `table-highlight-${this.serviceId}-${Date.now()}-${index}`
        const originalStyles = this._saveOriginalStyles(element)
        
        this._applyTableHighlightStyle(element, this._getEffectiveHighlightStyle(highlightInfo))
        
        const elementInfo = new PDFElementInfo(element, originalStyles, highlightId, 'table')
        this.modifiedElements.set(highlightId, elementInfo)
      })

    } catch (error) {
      console.error('❌ 修改表格元素样式失败:', error)
    }
  }

  /**
   * 查找表格元素
   */
  _findTableElementsByCoordinates(position) {
    const pageElement = this._getCurrentPageElement(position.page)
    if (!pageElement) return []

    return Array.from(pageElement.querySelectorAll('table, tr, td, th'))
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
  }

  /**
   * 应用表格高亮样式
   */
  _applyTableHighlightStyle(element, style) {
    try {
      if (style.backgroundColor) {
        element.style.backgroundColor = style.backgroundColor
      }
      if (style.border) {
        element.style.border = style.border
      }
      if (style.borderRadius) {
        element.style.borderRadius = style.borderRadius
      }
      if (style.boxShadow) {
        element.style.boxShadow = style.boxShadow
      }
      if (style.transition) {
        element.style.transition = style.transition
      }

      element.style.position = 'relative'
      element.style.zIndex = '999'

      console.log('✅ 表格高亮样式应用完成')
    } catch (error) {
      console.error('❌ 应用表格高亮样式失败:', error)
    }
  }

  /**
   * 获取有效的高亮样式
   */
  _getEffectiveHighlightStyle(highlightInfo = {}) {
    const baseStyle = { ...HIGHLIGHT_STYLES.text }
    
    // 根据置信度调整样式
    if (highlightInfo.confidence) {
      if (highlightInfo.confidence >= 90) {
        baseStyle.backgroundColor = '#d4edda'
        baseStyle.border = '1px solid #28a745'
      } else if (highlightInfo.confidence >= 70) {
        baseStyle.backgroundColor = '#fff3cd'
        baseStyle.border = '1px solid #ffc107'
      } else {
        baseStyle.backgroundColor = '#f8d7da'
        baseStyle.border = '1px solid #dc3545'
      }
    }

    return baseStyle
  }

  /**
   * 获取有效的图片样式
   */
  _getEffectiveImageStyle(highlightInfo = {}) {
    return { ...HIGHLIGHT_STYLES.image }
  }

  /**
   * 验证位置信息
   */
  _validatePosition(position) {
    return position && 
           typeof position.page === 'number' && 
           typeof position.x === 'number' && 
           typeof position.y === 'number' &&
           position.page > 0
  }

  /**
   * 等待PDF容器准备就绪
   */
  async _waitForPDFContainer(maxWait = 5000) {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWait) {
      const container = document.querySelector('.vue-office-pdf-wrapper, .document-locator-pdf-container')
      if (container) {
        return container
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    throw new Error('PDF容器未准备就绪')
  }

  /**
   * 恢复所有原始样式
   */
  restoreAllOriginalStyles() {
    try {
      console.log('🔄 开始恢复所有原始样式')

      // 恢复修改的元素样式
      this.modifiedElements.forEach((elementInfo, highlightId) => {
        this._restoreElementOriginalStyles(elementInfo.element, elementInfo.originalStyles)
      })
      this.modifiedElements.clear()

      // 移除临时容器
      this.temporaryContainers.forEach((containerInfo, containerId) => {
        this._removeTemporaryContainer(containerInfo.element)
      })
      this.temporaryContainers.clear()

      // 清除自动恢复定时器
      if (this.autoRestoreTimer) {
        clearTimeout(this.autoRestoreTimer)
        this.autoRestoreTimer = null
      }

      // 重置状态
      this.state.highlightCount = 0
      this.state.lastHighlightTime = null

      console.log('✅ 所有原始样式恢复完成')

    } catch (error) {
      console.error('❌ 恢复原始样式失败:', error)
    }
  }

  /**
   * 移除临时容器
   */
  _removeTemporaryContainer(container) {
    try {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    } catch (error) {
      console.error('❌ 移除临时容器失败:', error)
    }
  }

  /**
   * 恢复元素原始样式
   */
  _restoreElementOriginalStyles(element, originalStyles) {
    try {
      Object.keys(originalStyles).forEach(prop => {
        element.style[prop] = originalStyles[prop]
      })
    } catch (error) {
      console.error('❌ 恢复元素样式失败:', error)
    }
  }

  /**
   * 设置自动恢复定时器
   */
  _setupAutoRestoreTimer(delay) {
    if (this.autoRestoreTimer) {
      clearTimeout(this.autoRestoreTimer)
    }

    const restoreDelay = delay || this.config.autoRestoreDelay
    this.autoRestoreTimer = setTimeout(() => {
      console.log('⏰ 自动恢复样式触发')
      this.restoreAllOriginalStyles()
    }, restoreDelay)
  }

  /**
   * 销毁服务
   */
  destroy() {
    try {
      console.log('🗑️ 开始销毁DirectPDFStyleLocatorService')

      // 恢复所有样式
      this.restoreAllOriginalStyles()

      // 清除定时器
      if (this.autoRestoreTimer) {
        clearTimeout(this.autoRestoreTimer)
        this.autoRestoreTimer = null
      }

      // 清空所有引用
      this.pdfViewer = null
      this.pdfDocument = null
      this.modifiedElements.clear()
      this.temporaryContainers.clear()
      this.styleModificationHistory = []

      // 更新状态
      this.state.isActive = false

      console.log('✅ DirectPDFStyleLocatorService销毁完成')

    } catch (error) {
      console.error('❌ 销毁服务失败:', error)
    }
  }
}

export default DirectPDFStyleLocatorService