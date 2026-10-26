import { defineStore } from 'pinia'
import { buildTabIconFromMenuItem } from '@/views/DemoAudit/home-update/menu/methods/tabIconFromMenu.js'

export const useHomeStore = defineStore('home', {
  state: () => ({
    // ==================== 系统配置 ====================
    // 当前用户ID（用于localStorage隔离）
    userId: '',

    // localStorage key前缀
    STORAGE_PREFIX: 'app_',

    // 最大保留用户数量
    MAX_USERS: 5,

    // 首页配置（常驻）
    homeConfig: {
      title: '首页',
      path: '/home',
      id: 'home-tab',
      name: 'FirstHome',
      meta: { title: '首页', keepAlive: true }
    },

    // 缓存白名单：在白名单中的组件名称不会被缓存
    // 所有不在此名单中的组件都会自动缓存
    cacheWhitelist: [
      // 示例：如果某个页面不需要缓存，在这里添加其组件名称
      // 'SomeComponentName',
    ],

    // 路由实例（从外部注入）
    router: null,

    // ==================== 左侧菜单相关 ====================
    // 菜单显示状态
    menuVisible: false,
    // 菜单是否固定（固定后常驻左侧，不固定则以抽屉形式展开）
    menuPinned: true,
    // 菜单是否折叠（仅在固定状态下生效，从未登录过时默认收起）
    menuCollapsed: true,
    // 菜单树数据（由外部传入或从路由生成）
    menuTree: [],
    // 当前选中的菜单项key
    selectedMenuKey: '',
    // 展开的菜单项keys（用于多级菜单）
    openMenuKeys: [],
    // 取消固定前的展开keys（用于恢复展开状态）
    beforePinnedOpenKeys: [],

    // ==================== 面包屑相关 ====================
    // 面包屑列表 [{id: 'xxx', name: '首页', path: '/home', meta: {...}}]
    breadcrumbs: [],

    // ==================== 菜单映射表（优化查找性能）====================
    // 路径到ID的映射 { '/system/user': 'menu-123' }
    pathToIdMap: {},
    // ID到面包屑路径的映射 { 'menu-123': [{ id, name, path, meta }, ...] }
    idToBreadcrumbsMap: {},

    // ==================== 页签相关 ====================
    // 页签列表 [{id: 'xxx', title: '首页', path: '/home', name: 'FirstHome', pinned: false, meta: {...}}]
    tabs: [],
    // 当前激活的页签path
    activeTabPath: '',
    // 当前激活的页签id
    activeTabId: '',
    // 预留：页面缓存的组件名称列表（用于keep-alive的include）
    cachedViews: ['FirstHome'],

    // 路由懒加载 chunk 下载中：内容区遮罩，避免页签已切换仍显示旧页面
    routeNavigating: false,
    pendingRoutePath: '',
  }),

  getters: {
    // 获取所有固定的页签
    pinnedTabs: (state) => state.tabs.filter(tab => tab.pinned),

    // 获取所有未固定的页签
    unpinnedTabs: (state) => state.tabs.filter(tab => !tab.pinned),

    // 检查菜单是否应该显示（显示状态为true，或固定状态为true）
    shouldShowMenu: (state) => state.menuVisible || state.menuPinned,
  },

  actions: {
    // ==================== 系统初始化 ====================

    /**
     * 设置当前用户ID
     * @param {string} userId - 用户ID
     */
    setUserId(userId) {
      if (this.userId === userId) return

      this.userId = userId
      console.log('设置用户ID:', userId)

      // 记录用户最后访问时间
      if (userId) {
        this.recordUserAccess(userId)
      }

      // 清理旧用户数据（保留最近5个用户）
      this.cleanOldUserData()

      // 重新加载当前用户的数据
      this.restoreMenuPinned()
      this.restoreTabsFromStorage()
      this.initHomeTab()
    },

    /**
     * 注入路由实例
     * @param {Router} routerInstance - Vue Router 实例
     */
    setRouter(routerInstance) {
      this.router = routerInstance
    },

    /**
     * 获取带用户ID的localStorage key
     * @param {string} key - 原始key
     * @returns {string} 带用户ID的key
     */
    getStorageKey(key) {
      if (!this.userId) {
        console.warn('用户ID未设置，使用默认key:', key)
        return key
      }
      return `${this.STORAGE_PREFIX}${key}_${this.userId}`
    },

    /**
     * 记录用户最后访问时间
     * @param {string} userId - 用户ID
     */
    recordUserAccess(userId) {
      try {
        const accessKey = `${this.STORAGE_PREFIX}userAccess`
        const accessData = JSON.parse(localStorage.getItem(accessKey) || '{}')
        accessData[userId] = Date.now()
        localStorage.setItem(accessKey, JSON.stringify(accessData))
        console.log('记录用户访问时间:', userId, new Date(accessData[userId]))
      } catch (error) {
        console.error('记录用户访问时间失败:', error)
      }
    },

    /**
     * 清理旧用户数据（保留最近MAX_USERS个用户）
     */
    cleanOldUserData() {
      try {
        const accessKey = `${this.STORAGE_PREFIX}userAccess`
        const accessData = JSON.parse(localStorage.getItem(accessKey) || '{}')

        // 获取所有用户及其访问时间
        const userList = Object.entries(accessData)
          .map(([userId, timestamp]) => ({ userId, timestamp }))
          .sort((a, b) => b.timestamp - a.timestamp) // 按时间倒序

        console.log('当前用户列表:', userList)

        // 如果用户数超过最大限制，删除最旧的用户数据
        if (userList.length > this.MAX_USERS) {
          const usersToRemove = userList.slice(this.MAX_USERS)
          console.log('需要清理的用户:', usersToRemove)

          usersToRemove.forEach(({ userId }) => {
            // 删除该用户的所有缓存数据
            const keysToRemove = [
              `${this.STORAGE_PREFIX}homeTabs_${userId}`,
              `${this.STORAGE_PREFIX}menuPinned_${userId}`,
              `${this.STORAGE_PREFIX}menuCollapsed_${userId}`
            ]

            keysToRemove.forEach(key => {
              localStorage.removeItem(key)
              console.log('删除缓存:', key)
            })

            // 从访问记录中删除
            delete accessData[userId]
          })

          // 更新访问记录
          localStorage.setItem(accessKey, JSON.stringify(accessData))
          console.log('清理完成，剩余用户数:', Object.keys(accessData).length)
        }
      } catch (error) {
        console.error('清理旧用户数据失败:', error)
      }
    },

    /**
     * 解析路由路径对应的 keep-alive 组件名及是否应缓存
     * @param {string} path - 路由路径
     * @returns {{ componentName: string|null, shouldCache: boolean }}
     */
    resolveRouteCacheInfo(path) {
      if (!path) {
        return { componentName: null, shouldCache: false }
      }

      const cleanPath = String(path).split('?')[0].split('#')[0]
      const homeCleanPath = this.homeConfig.path.split('?')[0]

      if (cleanPath === homeCleanPath || cleanPath === '/home') {
        return {
          componentName: this.homeConfig.name,
          shouldCache: this.homeConfig.meta?.keepAlive !== false
        }
      }

      if (!this.router) {
        return { componentName: null, shouldCache: false }
      }

      try {
        const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
        const resolved = this.router.resolve(normalizedPath)
        const matchedRecord = resolved.matched[resolved.matched.length - 1]
        const componentName = resolved.name || matchedRecord?.name || null
        const shouldCache = resolved.meta?.keepAlive !== false
        return { componentName, shouldCache }
      } catch (error) {
        console.warn('解析路由缓存信息失败:', path, error)
        const componentName = this._matchComponentNameByPathString(path)
        return { componentName, shouldCache: !!componentName }
      }
    },

    /**
     * 根据路径获取路由配置中的组件名称（须与页面 defineOptions.name 一致）
     * @param {string} path - 路由路径
     * @returns {string|null} 组件名称
     */
    getComponentNameByPath(path) {
      return this.resolveRouteCacheInfo(path).componentName
    },

    /**
     * 路径字符串兜底匹配（router.resolve 失败时使用）
     * @param {string} path - 路由路径
     * @returns {string|null} 组件名称
     */
    _matchComponentNameByPathString(path) {
      if (!this.router) return null

      const cleanPath = String(path).split('?')[0].split('#')[0]
      const normalizedCleanPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`

      const routes = this.router.options.routes
      for (const route of routes) {
        if (route.children) {
          for (const child of route.children) {
            const childPath = child.path.startsWith('/')
              ? child.path
              : `${route.path === '/' ? '' : route.path}/${child.path}`

            if (
              childPath === normalizedCleanPath
              || childPath === cleanPath
              || `/${child.path}` === normalizedCleanPath
            ) {
              return child.name || null
            }
          }
        }

        if (route.path === normalizedCleanPath || route.path === cleanPath) {
          return route.name || null
        }
      }

      return null
    },

    // ==================== 左侧菜单操作 ====================

    /**
     * 设置菜单显示状态
     * @param {boolean} visible - 是否显示
     */
    setMenuVisible(visible) {
      this.menuVisible = visible
    },

    /**
     * 切换菜单显示状态
     */
    toggleMenuVisible() {
      this.menuVisible = !this.menuVisible
    },

    /**
     * 设置菜单固定状态
     * @param {boolean} pinned - 是否固定
     */
    setMenuPinned(pinned) {
      const wasPinned = this.menuPinned
      this.menuPinned = pinned

      if (pinned && !wasPinned) {
        // 固定时：保存当前展开状态，然后折叠菜单
        this.beforePinnedOpenKeys = [...this.openMenuKeys]
        this.menuCollapsed = true
        this.openMenuKeys = []
      } else if (!pinned && wasPinned) {
        // 取消固定时：恢复折叠状态，并按当前路由展开所在分支
        this.menuCollapsed = false
        const path = this.router?.currentRoute?.value?.fullPath || ''
        this.syncMenuStateFromRoute(path)
      }

      // 保存到localStorage（带用户ID）
      const pinnedKey = this.getStorageKey('menuPinned')
      const collapsedKey = this.getStorageKey('menuCollapsed')
      localStorage.setItem(pinnedKey, JSON.stringify(pinned))
      localStorage.setItem(collapsedKey, JSON.stringify(this.menuCollapsed))
    },

    /**
     * 切换菜单固定状态
     */
    toggleMenuPinned() {
      this.setMenuPinned(!this.menuPinned)
    },

    /**
     * 设置菜单折叠状态（仅在固定状态下生效）
     * @param {boolean} collapsed - 是否折叠
     */
    setMenuCollapsed(collapsed) {
      if (this.menuPinned) {
        const wasCollapsed = this.menuCollapsed
        this.menuCollapsed = collapsed
        if (collapsed) {
          // 折叠时清空展开keys
          this.openMenuKeys = []
        } else if (wasCollapsed && !collapsed) {
          const path = this.router?.currentRoute?.value?.fullPath || ''
          this.syncMenuStateFromRoute(path)
        }
        // 保存到localStorage（带用户ID）
        const collapsedKey = this.getStorageKey('menuCollapsed')
        localStorage.setItem(collapsedKey, JSON.stringify(collapsed))
      }
    },

    /**
     * 切换菜单折叠状态
     */
    toggleMenuCollapsed() {
      this.setMenuCollapsed(!this.menuCollapsed)
    },

    /**
     * 设置菜单树数据
     * @param {Array} tree - 菜单树数据
     */
    /**
     * 设置菜单树并生成映射表
     * @param {Array} tree - 菜单树数据
     */
    setMenuTree(tree) {
      this.menuTree = tree
      // 生成映射表
      this.buildMenuMaps()
    },

    /**
     * 构建菜单映射表
     * - pathToIdMap: 路径 → ID
     * - idToBreadcrumbsMap: ID → 面包屑路径数组
     */
    buildMenuMaps() {
      this.pathToIdMap = {}
      this.idToBreadcrumbsMap = {}

      // 递归遍历菜单树
      const traverse = (items, breadcrumbPath = []) => {
        if (!items || !Array.isArray(items)) return

        for (const item of items) {
          // 获取路由路径（优先 router_url，其次 navurl）
          const routePath = item.router_url || item.navurl

          if (routePath && item.id) {
            // 分离路径和参数
            const [cleanPath, queryString] = routePath.split('?')

            // 构建当前节点的面包屑路径
            const currentBreadcrumb = {
              id: item.id,
              name: item.name || item.label || '未命名',
              path: routePath,  // 使用完整路径（包含参数）
              meta: item.meta || {}
            }

            const currentPath = [...breadcrumbPath, currentBreadcrumb]

            // 建立映射关系
            // 对于带参数的路径，使用完整路径作为 key
            const mapKey = routePath  // 使用完整路径（包含 reallyName 等参数）
            this.pathToIdMap[mapKey] = item.id

            // 如果没有参数，也建立一个 cleanPath 的映射（向后兼容）
            if (!queryString) {
              this.pathToIdMap[cleanPath] = item.id
            }

            this.idToBreadcrumbsMap[item.id] = currentPath

            // 递归处理子节点
            if (item.children && item.children.length > 0) {
              traverse(item.children, currentPath)
            }
          } else if (item.children && item.children.length > 0) {
            const currentBreadcrumb = {
              id: item.id,
              name: item.name || item.label || '未命名',
              noPath: true
            }
            const currentPath = [...breadcrumbPath, currentBreadcrumb]
            traverse(item.children, currentPath)
          }
        }
      }
      // 添加首页映射
      const homeCleanPath = this.homeConfig.path.split('?')[0]
      this.pathToIdMap[homeCleanPath] = this.homeConfig.id
      this.idToBreadcrumbsMap[this.homeConfig.id] = [{
        id: this.homeConfig.id,
        name: this.homeConfig.title,
        path: homeCleanPath,
        meta: this.homeConfig.meta
      }]

      // 开始遍历
      traverse(this.menuTree)

      console.log('菜单映射表已生成:')
      console.log('- pathToIdMap:', this.pathToIdMap)
      console.log('- idToBreadcrumbsMap:', this.idToBreadcrumbsMap)
    },

    /**
     * 注册免权限路由（home-suggest-menu 字典 circumvent=true）
     * 写入 pathToIdMap / idToBreadcrumbsMap，使无菜单权限的用户也可打开页签并跳转
     * @param {Object} payload - 路由注册信息
     * @param {string} payload.path - 完整路由路径（含查询参数）
     * @param {string|number} payload.id - 菜单 ID（通常来自 menuId 参数）
     * @param {string} payload.title - 页签/面包屑标题
     * @param {Object} [payload.meta] - 附加 meta
     */
    registerCircumventRoute({ path, id, title, meta = {} }) {
      if (!path || id == null || String(id).trim() === '') return

      const menuId = String(id)
      if (this.pathToIdMap[path]) return

      const routeMeta = { ...meta, circumvent: true }
      const breadcrumbItem = {
        id: menuId,
        name: title || '未命名',
        path,
        meta: routeMeta
      }

      this.pathToIdMap[path] = menuId
      const cleanPath = path.split('?')[0]
      if (cleanPath && cleanPath !== path && !this.pathToIdMap[cleanPath]) {
        this.pathToIdMap[cleanPath] = menuId
      }

      if (!this.idToBreadcrumbsMap[menuId]) {
        this.idToBreadcrumbsMap[menuId] = [breadcrumbItem]
      }
    },

    /**
     * 根据路径或 ID 获取免权限注册的虚拟菜单项
     * @param {string} pathOrId - 路由路径或 menuId
     * @returns {Object|null} 虚拟菜单项，非 circumvent 路由返回 null
     */
    getCircumventMenuItem(pathOrId) {
      if (!pathOrId) return null

      let menuId = null
      if (this.idToBreadcrumbsMap[pathOrId]) {
        menuId = pathOrId
      } else if (this.pathToIdMap[pathOrId]) {
        menuId = this.pathToIdMap[pathOrId]
      } else {
        const cleanPath = pathOrId.split('?')[0]
        if (this.pathToIdMap[cleanPath]) {
          menuId = this.pathToIdMap[cleanPath]
        }
      }

      if (!menuId) return null

      const crumbs = this.idToBreadcrumbsMap[menuId]
      const last = crumbs && crumbs.length ? crumbs[crumbs.length - 1] : null
      if (!last || !last.meta || !last.meta.circumvent) return null

      return {
        id: menuId,
        name: last.name,
        label: last.name,
        router_url: last.path,
        navurl: last.path,
        meta: last.meta
      }
    },

    /**
     * 设置当前选中的菜单项
     * @param {string} key - 菜单项key
     */
    setSelectedMenuKey(key) {
      this.selectedMenuKey = key
    },

    /**
     * 设置展开的菜单项keys
     * @param {Array} keys - 菜单项keys数组
     */
    setOpenMenuKeys(keys) {
      this.openMenuKeys = keys
    },

    /**
     * 从localStorage恢复菜单固定状态和折叠状态
     */
    restoreMenuPinned() {
      const pinnedKey = this.getStorageKey('menuPinned')
      const collapsedKey = this.getStorageKey('menuCollapsed')

      const storedPinned = localStorage.getItem(pinnedKey)
      const storedCollapsed = localStorage.getItem(collapsedKey)

      console.log('storedPinned', storedPinned)
      console.log('storedCollapsed', storedCollapsed)
      // 判断是否是首次登录（两个缓存都不存在）
      const isFirstLogin = storedPinned === null && storedCollapsed === null

      if (isFirstLogin) {
        // 首次登录：设置默认状态（固定 + 收起）
        console.log('🎯 首次登录，设置默认菜单状态：固定 + 收起')
        this.menuPinned = true
        this.menuCollapsed = true
        this.menuVisible = false

        // 保存默认状态到 localStorage
        localStorage.setItem(pinnedKey, JSON.stringify(true))
        localStorage.setItem(collapsedKey, JSON.stringify(true))
      } else {
        // 非首次登录：恢复缓存状态
        if (storedPinned !== null) {
          this.menuPinned = JSON.parse(storedPinned)
          console.log('恢复菜单固定状态:', this.menuPinned)
        }

        if (storedCollapsed !== null) {
          this.menuCollapsed = JSON.parse(storedCollapsed)
          console.log('恢复菜单折叠状态:', this.menuCollapsed)
        }
      }
    },

    /**
     * 获取所有第一级菜单的keys（用于默认全部展开）
     * @param {Array} tree - 菜单树
     * @returns {Array} 第一级有子菜单的项的keys
     */
    getAllFirstLevelKeys(tree) {
      const keys = []
      const collectKeys = (items, level = 1) => {
        items.forEach(item => {
          if (item.children && item.children.length > 0) {
            keys.push(item.id || item.path)
            // 递归收集所有层级的keys
            if (item.children) {
              collectKeys(item.children, level + 1)
            }
          }
        })
      }
      collectKeys(tree)
      return keys
    },

    /**
     * 初始化菜单展开状态（根据当前路由展开所在分支，手风琴模式）
     */
    initMenuOpenKeys() {
      const path = this.router?.currentRoute?.value?.fullPath
        || this.router?.currentRoute?.value?.path
        || ''
      this.syncMenuStateFromRoute(path)
    },

    /**
     * 在菜单树中按 ID 查找节点
     * @param {Array} items - 菜单树节点列表
     * @param {string|number} targetId - 目标菜单 ID
     * @returns {Object|null} 匹配的菜单节点
     */
    findMenuTreeNodeById(items, targetId) {
      if (!items || !Array.isArray(items) || targetId == null) return null
      for (const item of items) {
        if (String(item.id) === String(targetId)) {
          return item
        }
        if (item.children && item.children.length > 0) {
          const found = this.findMenuTreeNodeById(item.children, targetId)
          if (found) return found
        }
      }
      return null
    },

    /**
     * 根据当前路由同步菜单选中项，并确保当前路由祖先菜单处于展开（合并进已有展开，不关闭其它已展开项）
     * @param {string} pathOrId - 路由 fullPath 或菜单 ID
     */
    syncMenuStateFromRoute(pathOrId) {
      if (!pathOrId || !this.menuTree || this.menuTree.length === 0) {
        return
      }

      const fullPath = String(pathOrId)
      const cleanPath = fullPath.split('?')[0]
      const prevOpenKeys = [...(this.openMenuKeys || [])].map(String)

      let menuId = null
      if (this.pathToIdMap[fullPath]) {
        menuId = this.pathToIdMap[fullPath]
      } else if (this.pathToIdMap[cleanPath]) {
        menuId = this.pathToIdMap[cleanPath]
      } else if (this.idToBreadcrumbsMap[fullPath]) {
        menuId = fullPath
      } else if (this.idToBreadcrumbsMap[cleanPath]) {
        menuId = cleanPath
      }

      if (!menuId) {
        return
      }

      const menuItem = this.findMenuItemByPath(menuId)
      if (!menuItem) {
        return
      }

      const activeIndex = menuItem.router_url || menuItem.navurl || ''
      if (activeIndex) {
        this.selectedMenuKey = activeIndex
      }

      const breadcrumbs = this.idToBreadcrumbsMap[menuItem.id] || []
      const branchKeys = []

      for (let i = 0; i < breadcrumbs.length - 1; i++) {
        const crumb = breadcrumbs[i]
        const node = this.findMenuTreeNodeById(this.menuTree, crumb.id)
        if (node && node.children && node.children.length > 0) {
          const submenuIndex = node.id != null ? node.id : node.path
          if (submenuIndex != null) {
            const keyStr = String(submenuIndex)
            if (branchKeys.indexOf(keyStr) === -1) {
              branchKeys.push(keyStr)
            }
          }
        }
      }

      // 合并：保留用户已展开项，仅补齐当前路由祖先
      const openKeys = [...prevOpenKeys]
      branchKeys.forEach((keyStr) => {
        if (openKeys.indexOf(keyStr) === -1) {
          openKeys.push(keyStr)
        }
      })

      this.openMenuKeys = openKeys
    },

    // ==================== 面包屑操作 ====================

    /**
     * 设置面包屑
     * @param {Array} breadcrumbs - 面包屑数组 [{name: '首页', path: '/home', meta: {...}}]
     */
    setBreadcrumbs(breadcrumbs) {
      this.breadcrumbs = breadcrumbs
    },

    /**
     * 初始化面包屑（设置为首页）
     */
    initBreadcrumbs() {
      this.breadcrumbs = [
        { name: this.homeConfig.title, path: this.homeConfig.path, meta: this.homeConfig.meta }
      ]
    },

    /**
     * 根据路由信息生成面包屑
     * @param {Object} route - 当前路由对象
     */
    generateBreadcrumbs(route) {
      const breadcrumbs = []

      if (route.matched && route.matched.length > 0) {
        route.matched.forEach(match => {
          if (match.meta && match.meta.title) {
            breadcrumbs.push({
              name: match.meta.title,
              path: match.path,
              meta: match.meta
            })
          }
        })
      }

      this.breadcrumbs = breadcrumbs
    },

    /**
     * 从菜单树中查找菜单项
     * @param {String} path - 菜单路径或ID
     * @returns {Object|null} 菜单项
     */
    /**
     * 根据路径或ID查找菜单项（使用映射表优化性能）
     * @param {String} pathOrId - 菜单路径或ID
     * @returns {Object|null} 菜单项对象
     */
    findMenuItemByPath(pathOrId) {
      if (!pathOrId) return null

      // 去除路径参数
      const cleanPath = pathOrId.split('?')[0]

      let menuId = null

      // 1. 如果传入的是 ID，直接使用
      if (this.idToBreadcrumbsMap[pathOrId]) {
        menuId = pathOrId
      }
      // 2. 如果传入的是路径，通过映射表获取 ID
      else if (this.pathToIdMap[cleanPath]) {
        menuId = this.pathToIdMap[cleanPath]
      }

      // 3. 通过 ID 在菜单树中查找完整的菜单项
      if (menuId) {
        const findInTree = (items, targetId) => {
          for (const item of items) {
            if (item.id === targetId) {
              return item
            }
            if (item.children && item.children.length > 0) {
              const found = findInTree(item.children, targetId)
              if (found) return found
            }
          }
          return null
        }

        // 先检查首页
        if (menuId === this.homeConfig.id) {
          return {
            id: this.homeConfig.id,
            name: this.homeConfig.title,
            router_url: this.homeConfig.path,
            path: this.homeConfig.path,
            meta: this.homeConfig.meta
          }
        }

        return findInTree(this.menuTree, menuId)
      }

      return null
    },

    /**
     * 根据菜单项生成面包屑路径
     * @param {String} path - 菜单路径或ID
     * @returns {Array} 面包屑数组
     */
    /**
     * 根据菜单ID或路径生成面包屑（使用映射表优化性能）
     * @param {string} idOrPath - 菜单项的ID或路径(router_url/navurl)
     */
    generateBreadcrumbsFromMenu(idOrPath) {
      if (!idOrPath) {
        this.breadcrumbs = []
        return this.breadcrumbs
      }

      // 去除路径参数
      // const cleanPath = idOrPath.split('?')[0]

      let breadcrumbData = null

      // 1. 尝试通过 ID 直接获取面包屑数据
      if (this.idToBreadcrumbsMap[idOrPath]) {
        breadcrumbData = this.idToBreadcrumbsMap[idOrPath]
      }
      // 2. 尝试通过路径获取ID，再获取面包屑数据
      else if (this.pathToIdMap[idOrPath]) {
        const menuId = this.pathToIdMap[idOrPath]
        breadcrumbData = this.idToBreadcrumbsMap[menuId]
      }
      // 3. 如果映射表中没有，说明可能是直接输入的URL或特殊情况
      else {
        console.warn('未在映射表中找到对应的面包屑数据:', idOrPath)
        this.breadcrumbs = []
        return this.breadcrumbs
      }

      // 设置面包屑
      this.breadcrumbs = breadcrumbData ? [...breadcrumbData] : []
      return this.breadcrumbs
    },

    /**
     * 清空面包屑
     */
    clearBreadcrumbs() {
      this.breadcrumbs = []
    },

    // ==================== 页签操作 ====================

    /**
     * 初始化首页页签（常驻，不可关闭，不可锁定）
     */
    initHomeTab() {
      // 检查首页是否已存在
      const homeExists = this.tabs.some(t => t.isHome)

      if (!homeExists) {
        // 首页始终在最前面
        this.tabs.unshift({
          id: this.homeConfig.path,  // 首页使用path作为id
          title: this.homeConfig.title,
          path: this.homeConfig.path,
          name: this.homeConfig.name,
          pinned: false,
          isHome: true,  // 标记为首页
          meta: this.homeConfig.meta,
          tabIcon: buildTabIconFromMenuItem({
            name: this.homeConfig.title,
            label: this.homeConfig.title
          })
        })
      }

      // 如果没有激活的页签，激活首页
      if (!this.activeTabPath) {
        this.activeTabPath = this.homeConfig.path
        this.activeTabId = this.homeConfig.path
      }
    },

    /**
     * 添加页签
     * @param {Object} tab - 页签对象 {id, title, path, name, meta}
     * 注意：tab.name 是页签显示的标题，不是组件名称
     */
    addTab(tab) {
      // 如果是首页，只需激活
      if (tab.path === this.homeConfig.path) {
        this.activeTabPath = this.homeConfig.path
        this.activeTabId = this.homeConfig.path  // 首页使用path作为id
        // 首页默认需要缓存（使用配置中的组件名称）
        if (this.homeConfig.name) {
          this.addCachedView(this.homeConfig.name)
        }
        return
      }

      // 通过id检查是否已存在
      const existIndex = this.tabs.findIndex(t => t.id === tab.id)
      const { componentName, shouldCache } = this.resolveRouteCacheInfo(tab.path)

      if (existIndex === -1) {
        this.tabs.push({
          id: tab.id,
          title: tab.title || tab.meta?.title || '未命名',
          path: tab.path,
          name: tab.name,
          componentName: componentName,
          pinned: false,
          isHome: false,
          meta: tab.meta || {},
          tabIcon: tab.tabIcon || null
        })

        if (componentName && shouldCache) {
          this.addCachedView(componentName)
        }
      } else {
        const existTab = this.tabs[existIndex]
        // 菜单路由升级时同步页签 path（如 comingSoon → file-chunking）
        if (tab.path && existTab.path !== tab.path) {
          existTab.path = tab.path
        }
        if (tab.title) {
          existTab.title = tab.title
        }
        if (componentName) {
          if (!existTab.componentName) {
            existTab.componentName = componentName
          }
          if (shouldCache) {
            this.addCachedView(existTab.componentName || componentName)
          }
        }
      }

      // 设置为当前激活页签
      this.activeTabPath = tab.path
      this.activeTabId = tab.id

      // 保存到localStorage
      this.saveTabsToStorage()
    },

    /**
     * 移除页签
     * @param {string} id - 页签ID
     * @returns {string|null} 返回应该跳转到的路径（如果移除的是当前页签）
     */
    removeTab(id) {
      const index = this.tabs.findIndex(t => t.id === id)
      if (index === -1) return null

      // 不允许删除首页
      if (this.tabs[index].isHome) {
        return null
      }

      // 不允许删除固定的页签
      if (this.tabs[index].pinned) {
        return null
      }

      // 如果删除的是当前激活的页签，需要切换到其他页签
      let targetPath = null
      let targetId = null
      if (this.activeTabId === id) {
        // 优先切换到右边的页签，如果没有则切换到左边
        if (index < this.tabs.length - 1) {
          targetPath = this.tabs[index + 1].path
          targetId = this.tabs[index + 1].id
        } else if (index > 0) {
          targetPath = this.tabs[index - 1].path
          targetId = this.tabs[index - 1].id
        }
      }

      // 保存要删除的tab信息（用于删除缓存）
      const removedTab = this.tabs[index]

      // 移除页签
      this.tabs.splice(index, 1)

      // 如果需要切换页签，更新activeTabPath和activeTabId
      if (targetPath) {
        this.activeTabPath = targetPath
        this.activeTabId = targetId
      }

      // 移除缓存（使用组件名称）
      if (removedTab && removedTab.componentName) {
        this.removeCachedView(removedTab.componentName)
      }

      // 保存到localStorage
      this.saveTabsToStorage()

      return targetPath
    },

    /**
     * 切换页签固定状态
     * @param {string} id - 页签ID
     */
    toggleTabPinned(id) {
      const tab = this.tabs.find(t => t.id === id)

      // 首页不允许固定/取消固定
      if (tab && !tab.isHome) {
        tab.pinned = !tab.pinned

        // 固定的页签排序到首页后面
        this.tabs.sort((a, b) => {
          // 首页始终在最前
          if (a.isHome) return -1
          if (b.isHome) return 1
          // 固定的在非固定的前面
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return 0
        })

        // 保存到localStorage
        this.saveTabsToStorage()
      }
    },

    /**
     * 设置当前激活的页签
     * @param {string} path - 页签路径
     * @param {string} id - 页签ID
     */
    setActiveTab(path, id) {
      this.activeTabPath = path
      this.activeTabId = id || path

      const tab = this.tabs.find(t => t.id === id || t.path === path)
      if (!tab) return

      if (!tab.componentName) {
        const { componentName } = this.resolveRouteCacheInfo(tab.path)
        if (componentName) {
          tab.componentName = componentName
        }
      }

      if (tab.componentName) {
        const { shouldCache } = this.resolveRouteCacheInfo(tab.path)
        if (shouldCache) {
          this.addCachedView(tab.componentName)
        }
      }
    },

    /**
     * 更新页签排序（用于拖拽排序）
     * @param {Array} newTabs - 新的页签数组
     */
    updateTabsOrder(newTabs) {
      // 确保首页始终在最前面
      const homeTab = newTabs.find(t => t.isHome)
      const otherTabs = newTabs.filter(t => !t.isHome)

      if (homeTab) {
        this.tabs = [homeTab, ...otherTabs]
      } else {
        this.tabs = newTabs
      }

      // 保存到localStorage
      this.saveTabsToStorage()
    },

    /**
     * 关闭其他页签
     * @param {string} path - 要保留的页签路径
     */
    closeOtherTabs(path) {
      // 保留固定的页签和指定的页签
      this.tabs = this.tabs.filter(t => t.isHome || t.pinned || t.path === path || t.id === path)

      // 更新缓存（根据白名单）
      this.updateCachedViews()

      // 保存到localStorage
      this.saveTabsToStorage()
    },

    /**
     * 关闭左侧页签
     * @param {string} id - 当前页签ID
     */
    closeLeftTabs(id) {
      const index = this.tabs.findIndex(t => t.id === id)
      if (index === -1) return

      // 保留首页、固定的页签和当前页签右侧的页签
      this.tabs = this.tabs.filter((t, i) => t.isHome || t.pinned || i >= index)

      // 更新缓存
      this.updateCachedViews()

      // 保存到localStorage
      this.saveTabsToStorage()
    },

    /**
     * 关闭右侧页签
     * @param {string} id - 当前页签ID
     */
    closeRightTabs(id) {
      const index = this.tabs.findIndex(t => t.id === id)
      if (index === -1) return

      // 保留首页、固定的页签和当前页签左侧的页签
      this.tabs = this.tabs.filter((t, i) => t.isHome || t.pinned || i <= index)

      // 更新缓存
      this.updateCachedViews()

      // 保存到localStorage
      this.saveTabsToStorage()
    },

    /**
     * 关闭所有页签
     */
    closeAllTabs() {
      // 只保留首页和固定的页签
      this.tabs = this.tabs.filter(t => t.isHome || t.pinned)

      // 切换到首页
      this.activeTabPath = this.homeConfig.path

      // 更新缓存
      this.updateCachedViews()

      // 保存到localStorage
      this.saveTabsToStorage()
    },

    // ==================== 页面缓存操作（预留） ====================

    /**
     * 添加页面缓存
     * @param {string} name - 组件name
     */
    addCachedView(name) {
      if (!name || this.cachedViews.includes(name)) return
      this.cachedViews.push(name)
    },

    /**
     * 移除页面缓存
     * @param {string} name - 组件name
     */
    removeCachedView(name) {
      const index = this.cachedViews.findIndex(v => v === name)
      if (index !== -1) {
        this.cachedViews.splice(index, 1)
      }
    },

    /**
     * 刷新页面（移除缓存后重新添加）
     * @param {string} tabId - 页签ID
     * @returns {Object|null} 返回 { componentName, needReAdd } 或 null
     */
    refreshTab(tabId) {
      const tab = this.tabs.find(t => t.id === tabId)
      if (!tab || !tab.componentName) {
        console.warn('无法刷新页签，未找到对应的组件名称:', tabId)
        return null
      }

      // 先从缓存中移除（使用组件名称）
      this.removeCachedView(tab.componentName)

      // 返回组件名称和是否需要重新添加到缓存（根据白名单判断）
      return {
        componentName: tab.componentName
      }
    },

    /**
     * 根据当前页签与路由 keepAlive 配置同步 cachedViews
     */
    syncCachedViewsFromTabs() {
      const names = new Set()

      if (this.homeConfig.name && this.homeConfig.meta?.keepAlive !== false) {
        names.add(this.homeConfig.name)
      }

      this.tabs.forEach((tab) => {
        if (!tab.path) return
        const { componentName, shouldCache } = this.resolveRouteCacheInfo(tab.path)
        const cacheName = tab.componentName || componentName
        if (cacheName && shouldCache) {
          names.add(cacheName)
        }
      })

      this.cachedViews = [...names]
    },

    /**
     * 更新缓存的页面列表（根据tabs自动更新）
     */
    updateCachedViews() {
      this.syncCachedViewsFromTabs()
    },

    /**
     * 清空所有页面缓存
     */
    clearAllCachedViews() {
      this.cachedViews = []
    },

    // ==================== 持久化操作 ====================

    /**
     * 保存页签到localStorage
     */
    /**
     * 标记路由导航开始（懒加载 chunk 下载阶段展示内容区 loading）
     * @param {string} [path]
     */
    beginRouteNavigation(path = '') {
      this.routeNavigating = true
      this.pendingRoutePath = path || ''
    },

    /**
     * 路由导航结束
     */
    endRouteNavigation() {
      this.routeNavigating = false
      this.pendingRoutePath = ''
    },

    saveTabsToStorage() {
      if (this._saveTabsTimer) {
        clearTimeout(this._saveTabsTimer)
      }
      this._saveTabsTimer = setTimeout(() => {
        this._saveTabsTimer = null
        this._persistTabsToStorageImmediate()
      }, 0)
    },

    _persistTabsToStorageImmediate() {
      try {
        const tabsData = {
          tabs: this.tabs,
          activeTabPath: this.activeTabPath,
          activeTabId: this.activeTabId,
          cachedViews: this.cachedViews
        }
        const tabsKey = this.getStorageKey('homeTabs')
        localStorage.setItem(tabsKey, JSON.stringify(tabsData))
      } catch (error) {
        console.error('保存页签到localStorage失败:', error)
      }
    },

    /**
     * 从localStorage恢复页签
     */
    restoreTabsFromStorage() {
      try {
        const tabsKey = this.getStorageKey('homeTabs')
        const stored = localStorage.getItem(tabsKey)
        if (stored) {
          const tabsData = JSON.parse(stored)
          this.tabs = (tabsData.tabs || []).map((tab) => {
            if (tab.componentName || !tab.path) {
              return tab
            }
            const { componentName } = this.resolveRouteCacheInfo(tab.path)
            return componentName ? { ...tab, componentName } : tab
          })
          this.activeTabPath = tabsData.activeTabPath || ''
          this.activeTabId = tabsData.activeTabId || ''
          this.cachedViews = tabsData.cachedViews || []
          this.syncCachedViewsFromTabs()
          console.log('恢复页签数据:', tabsKey, tabsData)
        } else {
          console.log('未找到页签缓存:', tabsKey)
        }
      } catch (error) {
        console.error('从localStorage恢复页签失败:', error)
        // 恢复失败时清空数据
        this.tabs = []
        this.activeTabPath = ''
        this.activeTabId = ''
        this.cachedViews = []
      }
    },

    /**
     * 初始化store（从localStorage恢复数据）
     * 注意：需要先调用setUserId设置用户ID
     */
    initialize() {
      if (!this.userId) {
        console.warn('初始化store时用户ID未设置，请先调用setUserId')
      }

      this.restoreMenuPinned()
      this.restoreTabsFromStorage()

      // 确保首页页签存在
      this.initHomeTab()

      // 初始化面包屑为首页
      this.initBreadcrumbs()

      console.log('Store初始化完成，用户ID:', this.userId)
    },

    /**
     * 重置所有状态（保留左侧菜单固定/折叠的 localStorage，退出登录后下次仍按偏好恢复）
     */
    reset() {
      this.menuVisible = false
      this.menuPinned = true
      this.menuCollapsed = true
      this.menuTree = []
      this.selectedMenuKey = ''
      this.openMenuKeys = []
      this.beforePinnedOpenKeys = []
      this.breadcrumbs = []
      this.tabs = []
      this.activeTabPath = ''
      this.activeTabId = ''
      this.cachedViews = []

      // 仅清除页签缓存；菜单展开/收起偏好不清理
      if (this.userId) {
        const tabsKey = this.getStorageKey('homeTabs')
        localStorage.removeItem(tabsKey)
        console.log('清除用户页签缓存（保留菜单折叠偏好）:', this.userId)
      }
    },

    /**
     * 清除所有用户的缓存数据（谨慎使用）
     */
    clearAllUserData() {
      try {
        const allKeys = Object.keys(localStorage)
        const appKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX))

        appKeys.forEach(key => {
          localStorage.removeItem(key)
        })

        console.log('已清除所有用户缓存数据，共', appKeys.length, '条')
      } catch (error) {
        console.error('清除所有用户数据失败:', error)
      }
    }
  }
})

