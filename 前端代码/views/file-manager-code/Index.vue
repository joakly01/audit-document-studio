<template>
  <div class="file-manager">
    <!-- 主体内容区 -->
    <div class="file-manager-body">
      <!-- 左侧导航栏 -->
      <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
        <div class="folder-tree-wrapper">
          <!-- 范围选择 + 文件夹搜索 -->
          <div class="tree-header">
            <div
              v-if="sidebarViewMode === 'focused'"
              class="fm-column-head fm-sidebar-head"
            >
              <FileManagerScopeSelector
                v-model="focusedScopeNodeId"
                :tree-data="focusedScopeTreeSelectData"
              />
            </div>
            <div
              class="fm-tree-search-row"
              :class="{ 'fm-column-head fm-sidebar-head': sidebarViewMode === 'full' }"
            >
              <div class="sd-search-box fm-folder-search">
                <el-icon class="sd-search-icon"><Search /></el-icon>
                <input
                  v-model="searchKeyword"
                  type="text"
                  placeholder="搜索文件夹"
                  class="sd-search-input"
                  @input="handleSearch"
                />
              </div>
              <el-tooltip content="刷新文件夹树" placement="bottom" :show-after="200">
                <el-button
                  circle
                  size="small"
                  class="fm-sidebar-refresh-btn"
                  :loading="treeRefreshLoading"
                  @click="handleRefreshTree"
                >
                  <el-icon><RefreshRight /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip
                :content="sidebarViewMode === 'full' ? '聚焦视图' : '完整树'"
                placement="bottom"
              >
                <el-button
                  link
                  class="fm-sidebar-view-toggle"
                  @click="toggleSidebarViewMode"
                >
                  <el-icon><Operation /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
<!--             第二行：三个 OSS 按钮
            <div class="tree-header-row tree-header-buttons" v-if="isSuperFileAdmin()">
              <el-tooltip content="同步 OSS 文件夹到本系统" placement="bottom">
                <el-button
                  type="primary"
                  size="small"
                  :icon="RefreshRight"
                  :loading="ossSyncLoading"
                  @click="handleOssSync"
                  class="oss-sync-btn"
                >
                  同步 OSS
                </el-button>
              </el-tooltip>
              <el-tooltip content="同步 OSS 文件到 WJGL_FILE_METADATA_OSS（需先同步文件夹）" placement="bottom">
                <el-button
                  type="success"
                  size="small"
                  :loading="ossSyncFilesLoading"
                  @click="handleOssSyncFiles"
                  class="oss-sync-files-btn"
                >
                  同步 OSS 文件
                </el-button>
              </el-tooltip>
              <el-tooltip content="仅对尚未生成 file_content 的 OSS 文件补全内容（含图走 OCR，其余本地抽取/解码），用于文件检索" placement="bottom">
                <el-button
                  type="warning"
                  size="small"
                  :loading="ossRefreshContentLoading"
                  @click="handleOssRefreshFileContent"
                  class="oss-refresh-content-btn"
                >
                  更新 OSS 文件内容
                </el-button>
              </el-tooltip>
            </div>-->
          </div>

          <!-- 文件夹树 -->
          <div class="folder-tree">
            <div v-if="folderLoading" class="tree-loading-panel">
              <el-skeleton :rows="8" animated />
            </div>
            <el-tree
              v-else
              ref="folderTreeRef"
              :data="displaySidebarTreeData"
              :props="{ label: 'name', children: 'children' }"
              :default-expanded-keys="expandedKeys"
              @node-click="handleFolderClick"
              :highlight-current="true"
              node-key="id"
              :current-node-key="folderTreeHighlightKey"
              :draggable="isSuperFileAdmin()"
              :allow-drag="(node) => !node.data.isSpaceRoot"
              :allow-drop="allowFolderDrop"
              @node-drop="handleFolderDrop"
            >
              <template #default="{ node, data }">
                <div
                  class="tree-node-content"
                  :class="{ 'is-disabled-node': data.disabled || data.org_node_is_virtual }"
                  :data-node-id="data.id"
                >
                  <div class="node-left">
                    <el-icon class="folder-icon" :class="getFolderIconClass(data)">
                      <component :is="getFolderIcon(data)" />
                    </el-icon>
                    <span class="node-label" :title="node.label">
                      {{ node.label }}
                      <!-- <span v-if="typeof data.file_count_recursive === 'number' && data.file_count_recursive >= 0" class="folder-file-count">
                        （{{ data.file_count_recursive }}）
                      </span> -->
                      </span>
                    <span class="node-left-tags">
                      <el-tag
                        v-if="!data.isSpaceRoot && (data.is_system_builtin === true || data.is_system_builtin === 1)"
                        type="info"
                        size="small"
                        effect="plain"
                        style="margin-left: 6px; vertical-align: middle;"
                      >
                        系统内置
                      </el-tag>
                      <!-- 引用文件夹标记 -->
                      <el-tag
                        v-if="data.is_reference"
                        type="success"
                        size="small"
                        effect="plain"
                        style="margin-left: 6px; vertical-align: middle;"
                      >
                        引用
                      </el-tag>
                      <!-- OSS 找不到对应文件夹时显示叹号 -->
                      <el-tooltip v-if="data.ossMissing" content="找不到对应的文件夹" placement="top">
                        <el-icon class="oss-missing-icon"><WarningFilled /></el-icon>
                      </el-tooltip>
                      <!-- 未分配权限提示（OSS 同步文件夹 或 无授权记录的旧文件夹） -->
                      <el-tooltip
                        v-if="showNoPermissionAssignIcon(data)"
                        content="未进行权限分配，当前仅有超级文件管理员能管理"
                        placement="top"
                      >
                        <el-icon class="no-permission-assign-icon"><User /></el-icon>
                      </el-tooltip>
                    </span>
                  </div>
                  <div class="node-right" @click.stop @mousedown.stop @mouseup.stop>
                    <!-- 权限图标：显示管理权限或查看权限（项目空间暂时关闭，避免与公共空间权限体系混淆） -->
                    <el-tooltip
                      v-if="!data.isSpaceRoot && data.folder_type !== 'PROJECT' && data.permission === 'FULL'"
                      content="管理权限"
                      placement="top"
                    >
                      <el-icon class="permission-icon permission-manage" :size="16">
                        <Setting />
                      </el-icon>
                    </el-tooltip>
                    <el-tooltip
                      v-if="!data.isSpaceRoot && data.folder_type !== 'PROJECT' && data.permission === 'READ'"
                      content="查看权限"
                      placement="top"
                    >
                      <el-icon class="permission-icon permission-read" :size="16">
                        <View />
                      </el-icon>
                    </el-tooltip>

                    <!-- 更多操作按钮（悬停显示） -->
                    <!-- 显示条件：只有FULL权限且（是创建者或超级管理员）或（是被授权用户且是该文件夹的直接授权）才显示 -->
                    <el-dropdown
                      v-if="!data.isSpaceRoot && canShowMoreButton(data)"
                      trigger="click"
                      @command="(cmd) => handleFolderAction(cmd, data)"
                      class="node-actions"
                    >
                      <el-icon class="dropdown-trigger" :size="16">
                        <MoreFilled />
                      </el-icon>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <!-- 项目根节点：查看审计小组 -->
                          <el-dropdown-item :command="'view-groups'" v-if="canViewProjectGroups(data)">
                            <el-icon><User /></el-icon>
                            <span style="margin-left: 4px;">查看审计小组</span>
                          </el-dropdown-item>
                          <el-dropdown-item :command="'create'" v-if="canCreateFolder(data)">
                            <el-icon><Plus /></el-icon>
                            <span style="margin-left: 4px;">新建文件夹</span>
                          </el-dropdown-item>
                          <el-dropdown-item :command="'rename'" v-if="canRenameFolder(data)">
                            <el-icon><Edit /></el-icon>
                            <span style="margin-left: 4px;">重命名</span>
                          </el-dropdown-item>
                          <!-- 项目空间：引入外部文件夹 -->
                          <el-dropdown-item :command="'import-folder'" v-if="canImportFolder(data)">
                            <el-icon><Link /></el-icon>
                            <span style="margin-left: 4px;">引入文件夹</span>
                          </el-dropdown-item>
                          <!-- 引用文件夹：取消引入 -->
                          <el-dropdown-item :command="'remove-ref'" v-if="canRemoveRefFolder(data)">
                            <el-icon><Close /></el-icon>
                            <span style="margin-left: 4px;">取消引入</span>
                          </el-dropdown-item>
                        <el-dropdown-item :command="'permission'" divided v-if="canManagePermission(data)">
                            <el-icon><User /></el-icon>
                            <span style="margin-left: 4px;">权限管理</span>
                          </el-dropdown-item>
                        <el-dropdown-item :command="'bind-project'" v-if="data.folder_type === 'PUBLIC' && canBindProject(data)">
                            <el-icon><Link /></el-icon>
                            <span style="margin-left: 4px;">绑定项目</span>
                          </el-dropdown-item>
                        <el-dropdown-item :command="'bind-org'" v-if="canBindOrg(data)">
                            <el-icon><OfficeBuilding /></el-icon>
                            <span style="margin-left: 4px;">绑定机构</span>
                          </el-dropdown-item>
                        <el-dropdown-item :command="'delete'" divided v-if="canDeleteFolder(data)">
                            <el-icon><Delete /></el-icon>
                            <span style="margin-left: 4px;">删除</span>
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                    <!-- 空间根节点的新建按钮 -->
                    <!-- 规则： -->
                    <!-- - PUBLIC：只有超级文件管理员可以在根节点创建 -->
                    <!-- - 其他空间类型（包括 PERSONAL 及未来新增空间）：根节点均允许当前用户创建 -->
                    <el-button
                      v-if="canCreateInSpace(data)"
                      size="small"
                      type="primary"
                      :icon="Plus"
                      circle
                      @click.stop="openCreateFolderDialog(null, data.folder_type)"
                      class="space-add-btn"
                    />
                    <!-- 项目绑定标识（图标展示） -->
                    <el-tooltip
                      v-if="data.project_uuid && data.folder_type === 'PUBLIC'"
                      :content="`已绑定项目：${data.project_name || '未知项目'}`"
                      placement="top"
                    >
                      <el-icon class="project-bound-icon" :size="16">
                        <Link />
                      </el-icon>
                    </el-tooltip>
                    <el-tooltip
                      v-if="data.bound_org_uuid && data.folder_type === 'PUBLIC'"
                      content="已绑定机构（机构根目录，不可在本层新建文件夹）"
                      placement="top"
                    >
                      <el-icon class="project-bound-icon" :size="16">
                        <OfficeBuilding />
                      </el-icon>
                    </el-tooltip>
                  </div>
                </div>
              </template>
            </el-tree>
          </div>

          <!-- 存储信息 -->
          <div class="storage-info">
            <div class="storage-header">
              <span class="storage-title">个人空间</span>
              <el-link
                type="primary"
                :underline="false"
                class="storage-link"
                @click="handleGoToUploadRecords"
              >
                上传记录
              </el-link>
              <el-link
                v-if="isSuperFileAdmin()"
                type="primary"
                :underline="false"
                class="storage-link"
                @click="handleStorageManagement"
              >
                管理
              </el-link>
            </div>
            <el-progress
              :percentage="storagePercentage"
              :color="storageProgressColor"
              :show-text="false"
              :stroke-width="6"
              class="storage-progress"
            />
            <div class="storage-text">
              <span>{{ formatStorage(storageUsed) }} / {{ formatStorage(storageTotal) }}</span>
              <span class="storage-percentage">{{ storagePercentageText }}</span>
            </div>
          </div>
        </div>
      </div>
      <!-- 拖拽分割条 -->
      <div class="resizer" @mousedown="onResizeMouseDown"></div>

      <!-- 中间主内容区 -->
      <div class="main-content">
        <div class="fm-toolbar">
          <div class="fm-column-head fm-main-head">
            <div class="fm-toolbar-actions">
              <el-tooltip
                v-if="currentFolderRefInfo?.isReference"
                :content="`引用自：公共空间 / ${getReferenceSourcePath()}`"
                placement="bottom"
              >
                <el-icon class="fm-ref-icon"><Link /></el-icon>
              </el-tooltip>
              <div class="sd-search-box fm-file-search">
                <el-icon class="sd-search-icon"><Search /></el-icon>
                <input
                  v-model="query.search"
                  type="text"
                  placeholder="搜索文件"
                  class="sd-search-input"
                  @keyup.enter="handleToolbarSearch"
                />
              </div>
              <el-popover placement="bottom-end" :width="300" trigger="click" popper-class="fm-filter-popover-wrap">
                <template #reference>
                  <el-button :type="hasActiveFilters ? 'primary' : 'default'" plain>
                    筛选
                  </el-button>
                </template>
                <div class="fm-filter-popover">
                  <el-select
                    v-model="query.parse_status"
                    placeholder="文档状态"
                    clearable
                    class="fm-filter-field"
                    @change="handleDocumentParseStatusChange"
                  >
                    <el-option label="全部状态" value="" />
                    <el-option
                      v-for="opt in parseStatusOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                  <el-dropdown class="fm-filter-field" @command="handleFilterCommand">
                    <el-button class="fm-filter-type-btn">
                      类型：{{ fileFilterLabel }}
                      <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="all">全部文件</el-dropdown-item>
                        <el-dropdown-item command="image" divided>图片</el-dropdown-item>
                        <el-dropdown-item command="ext:pdf">PDF</el-dropdown-item>
                        <el-dropdown-item command="ext:doc">Word（.doc）</el-dropdown-item>
                        <el-dropdown-item command="ext:docx">Word（.docx）</el-dropdown-item>
                        <el-dropdown-item command="ext:xls">Excel（.xls）</el-dropdown-item>
                        <el-dropdown-item command="ext:xlsx">Excel（.xlsx）</el-dropdown-item>
                        <el-dropdown-item command="ext:ppt">PPT（.ppt）</el-dropdown-item>
                        <el-dropdown-item command="ext:pptx">PPT（.pptx）</el-dropdown-item>
                        <el-dropdown-item command="ext:csv">CSV</el-dropdown-item>
                        <el-dropdown-item command="other" divided>其他</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-select
                    v-if="currentFolder"
                    v-model="query.recursive"
                    class="fm-filter-field"
                    @change="handleRecursiveChange"
                  >
                    <el-option label="本文件夹" :value="false" />
                    <el-option label="含子文件夹" :value="true" />
                  </el-select>
                </div>
              </el-popover>
              <el-dropdown
                :disabled="isReadOnlyFolder"
                trigger="click"
                @command="handleUploadCommand"
              >
                <el-button type="primary" :disabled="isReadOnlyFolder">
                  上传
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="file">上传文件</el-dropdown-item>
                    <el-dropdown-item command="folder" :disabled="!supportsWebkitDirectory">
                      {{ supportsWebkitDirectory ? '上传文件夹' : '上传文件夹（不支持）' }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button @click="handleGoToTaskCenter">
                任务中心
              </el-button>
              <el-dropdown trigger="click" @command="handleMoreActionCommand">
                <el-button>
                  更多
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="reparse" :disabled="selectedFiles.length === 0 || reparseLoading">
                      重新解析
                    </el-dropdown-item>
                    <el-dropdown-item command="batchDelete" :disabled="selectedFiles.length === 0 || batchDeleting">
                      批量删除
                    </el-dropdown-item>
                    <el-dropdown-item divided command="textSearch">文本检索</el-dropdown-item>
                    <el-dropdown-item :command="showToolbox ? 'hideToolbox' : 'showToolbox'">
                      {{ showToolbox ? '隐藏工具箱' : '显示工具箱' }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>

        <div class="fm-table-area">
        <!-- 空间/文件夹下都无文件时的空状态 -->
        <el-empty
          v-if="fileList.length === 0 && !loading"
          :description="currentFolder ? '该文件夹下暂无文件' : '当前空间下暂无文件'"
        >
          <el-button
            v-if="currentFolder && !isReadOnlyFolder"
            type="primary"
            @click="handleImport"
          >
            上传文件
          </el-button>
        </el-empty>
        <div v-else-if="loading" class="file-list-skeleton">
          <div v-for="idx in 12" :key="`file-sk-${idx}`" class="file-list-skeleton-row">
            <el-skeleton animated :rows="1" />
          </div>
        </div>
        <!-- 只要有文件数据（无论是空间模式还是文件夹模式），都展示表格 -->
        <!-- <div class="file-table-toolbar" style="margin-bottom: 8px; display: flex; align-items: center;">
          <el-button
            type="danger"
            size="small"
            style="margin-left: 8px;"
                :disabled="selectedFiles.length === 0 || batchDeleting || hasOssInSelected"
            :loading="batchDeleting"
            @click="handleBatchDelete"
          >
            批量删除
          </el-button>
          <el-button
            type="primary"
            size="small"
            style="margin-left: 8px;"
            @click="openTextSearchDialog"
          >
            文本检索
          </el-button>
          <span v-if="selectedFiles.length > 0" style="margin-left: 12px; color: #909399;">
            已选择 {{ selectedFiles.length }} 个文件
          </span>
        </div> -->
        <el-table
          v-else
          ref="tableRef"
          row-key="file_id"
          :data="fileList"
          style="width: 100%"
          height="100%"
          @row-click="handleRowClick"
          @selection-change="handleSelectionChange"
          :header-cell-style="{ background: 'var(--sd-surface-1, #f4f4f4)', color: 'var(--sd-ink, #161616)', fontWeight: '600', height: '48px' }"
          :row-style="{ height: '52px' }"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column label="名称" min-width="300">
          <template #default="{ row }">
            <div class="file-name-cell">
              <el-icon :size="24" :color="getFileIconColor(row.mime_type, row.original_name)" style="margin-right: 12px;">
                <component :is="getFileIcon(row.mime_type, row.original_name)" />
              </el-icon>
              <span
                class="file-name"
                @click.stop="handlePreview(row)"
              >
                {{ row.original_name }}
              </span>
            </div>
          </template>
        </el-table-column>
          <el-table-column label="文档状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="documentParseStatusTagType(row)"
              >
                {{ documentParseStatusLabel(row) }}
              </el-tag>
            </template>
          </el-table-column>
          <!-- SDSSJT-614: 暂时注释掉摘要列，后续统一删除 -->
          <!-- <el-table-column label="摘要" min-width="250">
          <template #default="{ row }">
            <div class="summary-cell">
              <span v-if="row.summary" class="summary-text" :title="row.summary">
                {{ row.summary.length > 50 ? row.summary.substring(0, 50) + '...' : row.summary }}
              </span>
              <span v-else-if="row.summary_status === 'processing'" class="summary-status">
                <el-icon class="is-loading"><Loading /></el-icon>
                生成中...
              </span>
              <span v-else-if="row.summary_status === 'failed'" class="summary-status error">
                生成失败
              </span>
              <span v-else class="summary-status">
                暂无摘要
              </span>
              <el-button
                v-if="row.summary && row.summary.length > 50"
                type="text"
                size="small"
                @click.stop="showFullSummary(row)"
                style="margin-left: 8px;"
              >
                查看完整
              </el-button>
            </div>
          </template>
        </el-table-column> -->
          <!-- SDSSJT-614: 暂时注释掉标签列，后续统一删除 -->
          <!-- <el-table-column label="标签" min-width="220">
          <template #default="{ row }">
            <div class="tags-cell">
              <template v-if="row.tags && row.tags.length">
                <el-tag
                  v-for="tag in row.tags"
                  :key="tag.tag_id"
                  :type="tag.tag_source === 'AI' ? 'success' : 'info'"
                  size="small"
                  style="margin-right: 4px; margin-bottom: 4px;"
                  closable
                  @close.stop="handleDeleteTag(row, tag)"
                >
                  {{ tag.tag_name }}
                </el-tag>
              </template>
              <span v-else class="tags-empty">暂无标签</span>
              <el-button
                v-if="canManageFile(row)"
                type="text"
                size="small"
                style="margin-left: 4px;"
                @click.stop="handleAddTag(row)"
              >
                添加
              </el-button>
              <el-button
                v-if="canManageFile(row)"
                type="text"
                size="small"
                style="margin-left: 4px;"
                @click.stop="handleGenerateTags(row)"
              >
                生成
              </el-button>
            </div>
          </template>
        </el-table-column> -->
          <el-table-column prop="uploader" label="所有者" width="150" />
        <el-table-column label="位置" width="200">
          <template #default="{ row }">
            <span>{{ getFileLocationLabel(row.folder_id) }}</span>
          </template>
        </el-table-column>
          <el-table-column label="上传时间" width="180" sortable prop="upload_time">
          <template #default="{ row }">
            {{ formatDateTime(row.upload_time) }}
          </template>
        </el-table-column>
          <el-table-column label="最近查看" width="180" sortable prop="last_view_time">
          <template #default="{ row }">
            {{ row.last_view_time ? formatDateTime(row.last_view_time) : '-' }}
          </template>
        </el-table-column>
          <el-table-column label="文档大小" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.file_size) }}
          </template>
        </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-tooltip
              content="下载"
              placement="top"
            >
              <el-button
                size="small"
                :icon="Download"
                @click.stop="handleDownload(row)"
              >
              </el-button>
            </el-tooltip>
            <el-tooltip
              content="重命名"
              placement="top"
            >
              <el-button
                size="small"
                :icon="Edit"
                :disabled="!canRenameFile(row)"
                @click.stop="openRenameFileDialog(row)"
              >
              </el-button>
            </el-tooltip>
            <el-tooltip
              content="查看附件"
              placement="top"
            >
              <el-button
                size="small"
                type="primary"
                :icon="Paperclip"
                @click.stop="openAttachmentDialog(row)"
              >
              </el-button>
            </el-tooltip>
                <!-- <el-button
                  size="small"
                  @click.stop="handleViewFileContent(row)"
                >
                  查看文件内容
                </el-button> -->
          </template>
          </el-table-column>
        </el-table>
        </div>
        <!-- 分页：对齐提示词管理底栏样式 -->
        <div class="pagination-section pagination-embedded" v-if="fileList.length > 0 && !loading">
          <div class="pagination-section-left">
            <span v-if="selectedFiles.length > 0" class="fm-selection-summary">
              已选 {{ selectedFiles.length }} 个
              <span class="fm-selection-detail">
                （完成 {{ selectedParsedDoneCount }}，未解析 {{ selectedUnparsedCount }}<template v-if="selectedParsingCount > 0">，解析中 {{ selectedParsingCount }}</template>）
              </span>
            </span>
          </div>
          <el-pagination
            v-model:current-page="query.page"
            v-model:page-size="query.size"
            :total="total"
            :background="true"
            layout="total, sizes, prev, pager, next"
            class="pagination-component"
            @current-change="loadFileList"
            @size-change="loadFileList"
          />
        </div>
      </div>

      <!-- 右侧工具箱 -->
      <div class="toolbox" v-show="showToolbox">
        <div class="fm-column-head fm-toolbox-head">
          <h3 class="toolbox-title">工具箱</h3>
          <el-button link :icon="Close" @click="showToolbox = false" />
        </div>

        <div class="toolbox-content">
          <!-- 工具按钮区域 -->
          <div class="toolbox-section">
            <div
              v-if="selectedFiles.length > 0"
              class="selected-files-tip selected-files-tip--clickable"
              role="button"
              tabindex="0"
              title="点击查看已选文件列表"
              @click="openSelectedFilesSummaryDialog"
              @keydown.enter.prevent="openSelectedFilesSummaryDialog"
              @keydown.space.prevent="openSelectedFilesSummaryDialog"
            >
              已选择 {{ selectedFiles.length }} 个文件，其中 {{ selectedParsedDoneCount }} 个已完成，{{
                selectedUnparsedCount
              }} 个未解析<span v-if="selectedParsingCount > 0">，{{ selectedParsingCount }} 个解析中</span>
            </div>
            <div v-if="functionGroups.length === 0" class="toolbox-empty">暂无可用工具</div>
            <div
              v-for="group in functionGroups"
              :key="group.code"
              class="toolbox-category"
            >
              <div class="toolbox-category-head">
                <span class="toolbox-category-title">{{ group.label }}</span>
              </div>
              <div class="tool-list">
                <div
                  v-for="(item, index) in group.tools"
                  :key="item.value"
                  class="tool-item"
                  @click="handleToolClick(item.value, item.label)"
                >
                  <div
                    class="tool-icon"
                    :style="{ background: functionColorMap[index % functionColorMap.length] }"
                  >
                    <img
                      :src="getFileManagerToolIconUrl(item.value, item.label)"
                      :alt="item.label"
                      @error="handleToolIconError($event, item)"
                    />
                  </div>
                  <span class="tool-text">{{ item.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 文件上传组件（隐藏） -->
    <el-upload
      ref="uploadRef"
      class="hidden-upload"
      :http-request="handleCustomUpload"
      :multiple="true"
      :show-file-list="false"
      :auto-upload="false"
      :before-upload="beforeUpload"
      @change="handleFileChange"
    >
    </el-upload>

    <input
      ref="folderInputRef"
      type="file"
      webkitdirectory
      directory
      style="display: none;"
      @change="handleFolderInputChange"
    />

    <el-dialog
      v-model="folderExtFilterVisible"
      title="文件夹上传 - 文件后缀筛选"
      width="700px"
      :close-on-click-modal="false"
    >
      <div class="folder-ext-filter-actions">
        <el-button size="small" @click="folderFilterExcludeArchives">排除压缩包</el-button>
        <el-button size="small" @click="folderFilterExcludeExecutables">排除可执行文件</el-button>
        <el-button size="small" @click="folderFilterDocsOnly">仅包含文档</el-button>
        <el-button size="small" @click="folderFilterSelectAll">全选</el-button>
        <el-button size="small" @click="folderFilterSelectNone">全不选</el-button>
      </div>
      <el-table :data="folderExtFilterList" border max-height="400" style="width: 100%;">
        <el-table-column label="包含" width="70" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row.included" @change="updateFolderFilterSummary" />
          </template>
        </el-table-column>
        <el-table-column prop="ext" label="后缀" width="140" />
        <el-table-column prop="count" label="文件数量" width="100" align="center" />
        <el-table-column label="总大小" width="120" align="center">
          <template #default="{ row }">
            {{ formatFileSize(row.totalSize) }}
          </template>
        </el-table-column>
        <el-table-column prop="sampleFiles" label="示例文件" min-width="200">
          <template #default="{ row }">
            {{ row.sampleFiles }}
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 12px; color: #606266; font-size: 14px;">
        筛选后：{{ folderFilterSummaryCount }} 个文件，共 {{ formatFileSize(folderFilterSummarySize) }}
      </div>
      <template #footer>
        <el-button @click="cancelFolderExtFilter">取消</el-button>
        <el-button type="primary" :loading="folderUploadProcessing" @click="confirmFolderExtFilter">确认筛选</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="folderDuplicateDialogVisible"
      :title="folderUploadRootExists ? '文件夹上传 - 目标文件夹已存在，请处理重复文件' : '文件夹上传 - 发现重名文件'"
      width="700px"
      top="5vh"
      class="folder-duplicate-dialog"
      :close-on-click-modal="false"
    >
      <div class="duplicate-files-list">
        <p v-if="folderUploadRootExists" class="duplicate-files-tip">
          当前目录下已存在同名文件夹，继续上传将合并文件。以下文件与目标位置已有文件重名，请选择处理方式。
        </p>
        <p v-else class="duplicate-files-tip">
          以下文件与目标路径下已有文件重名，请选择处理方式：
        </p>
        <div class="duplicate-actions-bar">
          <el-button size="small" @click="folderDuplicateAllOverwrite">全覆盖</el-button>
          <el-button size="small" @click="folderDuplicateAllSkip">全跳过</el-button>
        </div>
        <el-table :data="folderDuplicateFiles" max-height="280" border>
          <el-table-column prop="relativePath" label="文件路径" min-width="300" />
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-radio-group v-model="row.action" size="small">
                <el-radio-button label="upload">覆盖</el-radio-button>
                <el-radio-button label="skip">跳过</el-radio-button>
              </el-radio-group>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <div class="duplicate-dialog-footer">
          <el-button @click="cancelFolderDuplicateDialog">取消</el-button>
          <el-button type="primary" :loading="folderUploadProcessing" @click="confirmFolderDuplicateDialog">确认上传</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 重名文件处理对话框 -->
    <el-dialog
      v-model="duplicateDialogVisible"
      title="发现重名文件"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="duplicate-files-list">
        <p style="margin-bottom: 16px; color: #606266;">
          以下文件与现有文件重名，请选择处理方式：
        </p>
        <div class="duplicate-actions-bar" style="margin-bottom: 16px;">
          <el-button size="small" @click="applyAllOverwrite">全覆盖</el-button>
          <el-button size="small" @click="applyAllSkip">全跳过</el-button>
        </div>
        <el-table :data="duplicateFiles" max-height="300" border>
          <el-table-column prop="fileName" label="文件名" min-width="200" />
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-radio-group v-model="row.action" size="small">
                <el-radio-button label="upload">覆盖</el-radio-button>
                <el-radio-button label="skip">跳过</el-radio-button>
              </el-radio-group>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="cancelDuplicateDialog">取消上传</el-button>
        <el-button type="primary" @click="confirmDuplicateDialog">确认上传</el-button>
      </template>
    </el-dialog>

    <!-- 已选文件汇总（跨页勾选）：查看列表并从已选中移除，同步取消表格勾选 -->
    <el-dialog
      v-model="selectedFilesSummaryDialogVisible"
      title="已选文件"
      width="900px"
      destroy-on-close
    >
      <el-table
        ref="selectedFilesSummaryTableRef"
        row-key="file_id"
        :data="selectedFiles"
        border
        max-height="420"
        @selection-change="handleSelectedFilesSummaryTableSelectionChange"
      >
        <el-table-column
          type="selection"
          width="48"
          align="center"
          :selectable="summaryDialogRowSelectable"
        />
        <el-table-column type="index" label="#" width="50" align="center" />
        <el-table-column prop="original_name" label="文件名" min-width="180" show-overflow-tooltip />
        <el-table-column label="文档状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="documentParseStatusTagType(row)">
              {{ documentParseStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="uploader" label="所有者" width="120" show-overflow-tooltip />
        <el-table-column label="位置" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ getFileLocationLabel(row.folder_id) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="88" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="removeFileFromBatchSelection(row)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div
          style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;"
        >
          <span style="color: var(--el-text-color-secondary); font-size: 12px;">
            共 {{ selectedFiles.length }} 项。勾选后可批量从已选列表中移除（仅取消勾选，不调用删除接口）。
          </span>
          <div>
            <el-button
              type="danger"
              :disabled="selectedFilesSummaryTableSelection.length === 0"
              @click="handleBatchDeleteFromSummaryDialog"
            >
              批量移除
            </el-button>
            <el-button
              type="primary"
              style="margin-left: 8px;"
              @click="selectedFilesSummaryDialogVisible = false"
            >
              关闭
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 待摊费用：关弹窗后后台执行悬浮提示 -->
    <div
      v-if="prepaidBackgroundWatchVisible && !showDocumentPreviewDialog"
      class="prepaid-background-floating-ball"
      title="待摊费用执行中，点击打开"
      @click="handlePrepaidBackgroundBallClick"
    >
      <el-icon class="floating-ball-icon"><Loading /></el-icon>
      <span class="floating-ball-label">待摊费用</span>
    </div>

    <!-- 上传进度通知（非阻塞，显示在页面顶部） -->
    <div
      v-if="uploadTasks.length > 0"
      class="upload-notification-container"
      :class="{ 'upload-notification-container--collapsed': uploadPanelCollapsed }"
      :style="uploadPanelCollapsed ? uploadCollapsedBallStyle : undefined"
    >
      <div
        v-if="uploadPanelCollapsed"
        class="upload-notification-collapsed"
        title="拖动可移动，点击展开上传进度"
        @mousedown="handleUploadCollapsedBallMouseDown"
      >
        <el-icon
          class="upload-collapsed-icon"
          :class="{ 'upload-collapsed-icon--spinning': uploadActiveTaskCount > 0 }"
        >
          <Loading v-if="uploadActiveTaskCount > 0" />
          <Upload v-else />
        </el-icon>
        <span class="upload-collapsed-count">{{ uploadTasks.length }}</span>
      </div>
      <el-card v-else shadow="always" class="upload-notification-card">
        <template #header>
          <div class="upload-notification-header">
            <span>文件上传/处理中 ({{ uploadTasks.length }})</span>
            <div class="upload-notification-header-actions">
              <el-button text type="primary" size="small" @click="uploadPanelCollapsed = true">收起</el-button>
              <el-button text type="primary" size="small" @click="handleClearUploadTasks">清除</el-button>
            </div>
          </div>
        </template>
        <div class="upload-tasks-list">
          <div
            v-for="group in groupedUploadTasks.groups"
            :key="group.folderName"
            class="upload-folder-group"
          >
            <div class="folder-group-header">
              <el-icon style="margin-right: 4px;"><Folder /></el-icon>
              <span class="folder-group-name">{{ group.folderName }}</span>
              <span class="folder-group-progress">
                {{ group.tasks.filter(t => t.status === 'success').length }}/{{ group.tasks.length }}
              </span>
            </div>
            <div
              v-for="task in group.tasks"
              :key="task.id"
              class="upload-task-item upload-task-item--nested"
            >
              <div class="task-header">
                <span class="task-name">{{ task.fileName.split('/').pop() }}</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <el-icon
                    v-if="task.status === 'success' || task.status === 'error' || task.status === 'skipped'"
                    class="task-close"
                    @click="removeUploadTask(task.id)"
                  >
                    <Close />
                  </el-icon>
                </div>
              </div>
              <el-progress
                :percentage="task.progress"
                :status="task.status === 'error' ? 'exception' : task.status === 'success' ? 'success' : task.status === 'skipped' ? 'warning' : undefined"
                :stroke-width="6"
                style="margin-top: 8px;"
              />
              <div class="task-status-text" style="margin-top: 4px; font-size: 12px; color: var(--el-text-color-secondary);">
                <span v-if="task.status === 'skipped'" style="color: #E6A23C;">{{ task.skipReason || '文件路径已变更，已跳过' }}</span>
                <span v-else-if="task.status === 'error'">上传失败</span>
                <span v-else-if="task.status === 'success'">已完成</span>
                <span v-else-if="task.phase === 'processing'">{{ task.postUploadLabel || '服务器处理中…' }}</span>
                <span v-else>上传文件中…</span>
              </div>
              <div v-if="task.error" class="task-error">{{ task.error }}</div>
            </div>
          </div>
          <div
            v-for="task in groupedUploadTasks.standalone"
            :key="task.id"
            class="upload-task-item"
          >
            <div class="task-header">
              <span class="task-name">{{ task.fileName }}</span>
              <div style="display: flex; align-items: center; gap: 4px;">
                <el-icon
                  v-if="task.status === 'success' || task.status === 'error' || task.status === 'skipped'"
                  class="task-close"
                  @click="removeUploadTask(task.id)"
                >
                  <Close />
                </el-icon>
              </div>
            </div>
            <el-progress
              :percentage="task.progress"
              :status="task.status === 'error' ? 'exception' : task.status === 'success' ? 'success' : task.status === 'skipped' ? 'warning' : undefined"
              :stroke-width="6"
              style="margin-top: 8px;"
            />
            <div class="task-status-text" style="margin-top: 4px; font-size: 12px; color: var(--el-text-color-secondary);">
              <span v-if="task.status === 'skipped'" style="color: #E6A23C;">{{ task.skipReason || '文件路径已变更，已跳过' }}</span>
              <span v-else-if="task.status === 'error'">上传失败</span>
              <span v-else-if="task.status === 'success'">已完成</span>
              <span v-else-if="task.phase === 'processing'">{{ task.postUploadLabel || '服务器处理中…' }}</span>
              <span v-else>上传文件中…</span>
            </div>
            <div v-if="task.error" class="task-error">{{ task.error }}</div>
          </div>
        </div>
      </el-card>
    </div>

    <el-dialog
      v-model="uploadSummaryVisible"
      title="上传结果汇总"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-table :data="skippedFiles" border max-height="350">
        <el-table-column prop="relativePath" label="文件路径" min-width="300" />
        <el-table-column prop="skipReason" label="跳过原因" min-width="200" />
      </el-table>
      <template #footer>
        <el-button @click="retrySkippedFiles" type="primary">重试</el-button>
        <el-button @click="uploadSummaryVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 文件预览对话框：左栏原文件预览，右栏解析结果 Markdown（SDSSJT-873 改动二） -->
    <el-dialog
      v-model="showPreviewDialog"
      :title="previewFileName"
      width="90%"
      top="5vh"
      destroy-on-close
      append-to-body
      class="file-preview-dialog"
      @closed="resetPreviewParsedState"
    >
      <template #header>
        <div class="preview-dialog-header">
          <span class="el-dialog__title">{{ previewFileName }}</span>
          <el-dropdown
            trigger="hover"
            :disabled="!previewParsedMarkdownRaw || previewExportLoading"
            @command="handlePreviewExportCommand"
          >
            <el-button
              type="success"
              size="small"
              :loading="previewExportLoading"
              :disabled="!previewParsedMarkdownRaw"
            >
              <span>导出<i class="el-icon-arrow-down el-icon--right" style="margin-left: 4px;"></i></span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
                <el-dropdown-item command="word">导出 Word</el-dropdown-item>
                <el-dropdown-item command="markdown">导出 Markdown</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </template>
      <div class="preview-dialog-split">
        <div class="preview-dialog-pane preview-dialog-pane-left">
          <div class="preview-pane-title">文件预览</div>
          <el-scrollbar class="preview-pane-scrollbar" :height="previewPaneScrollHeight">
            <div v-if="previewFileType === 'image' && previewFileData" class="image-preview-wrapper">
              <el-image
                :src="previewFileData"
                :preview-src-list="[previewFileData]"
                fit="contain"
                style="width: 100%; min-height: 400px;"
                :preview-teleported="true"
              />
            </div>
            <FilePreview
              v-else-if="previewFileType && previewFileData"
              :file-type="previewFileType"
              :file-name="previewFileName"
              :file-data="previewFileData"
              :show-title="false"
            />
          </el-scrollbar>
        </div>
        <div class="preview-dialog-pane preview-dialog-pane-right" v-loading="previewParsedLoading">
          <div class="preview-pane-title">解析结果</div>
          <el-scrollbar class="preview-pane-scrollbar" :height="previewPaneScrollHeight">
            <div
              v-if="previewParsedMarkdownHtml"
              class="text-search-markdown-body preview-parsed-markdown"
              v-html="previewParsedMarkdownHtml"
            />
            <div v-else-if="!previewParsedLoading" class="preview-parsed-empty">
              暂无解析结果
            </div>
          </el-scrollbar>
        </div>
      </div>
    </el-dialog>

    <!-- 文件内容查看对话框（展示 WJGL_FILE_METADATA.FILE_CONTENT 文本） -->
    <el-dialog
      v-model="showFileContentDialog"
      :title="fileContentTitle"
      width="60%"
      top="10vh"
    >
      <el-scrollbar height="60vh">
        <div v-if="fileContentLoading" style="text-align: center; padding: 24px 0; color: var(--el-text-color-secondary);">
          正在加载文件内容，请稍候...
        </div>
        <div v-else>
          <div v-if="currentFileContent">
            <pre style="white-space: pre-wrap; word-break: break-all;">{{ currentFileContent }}</pre>
          </div>
          <div v-else style="text-align: center; padding: 24px 0; color: var(--el-text-color-secondary);">
            当前文件暂无识别内容（FILE_CONTENT 为空）
          </div>
        </div>
      </el-scrollbar>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showFileContentDialog = false">关 闭</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 新建文件夹对话框 -->
    <el-dialog
      v-model="createFolderDialogVisible"
      title="新建文件夹"
      width="400px"
      :close-on-click-modal="false"
    >
      <!-- 阻止回车触发表单默认提交导致页面刷新 -->
      <el-form
        :model="createFolderForm"
        label-width="80px"
        v-loading="createFolderLoading"
        @submit.prevent
      >
        <el-form-item label="创建位置">
          <el-tag type="info" class="create-folder-path-tag">
            {{
              getFolderPath(createFolderForm.parent_folder_id).join('/') ||
                getCurrentSpaceLabel() ||
                currentSpaceType ||
                '—'
            }}
          </el-tag>
        </el-form-item>
        <el-form-item label="文件夹名">
          <el-input
            v-model="createFolderForm.folder_name"
            placeholder="请输入文件夹名称"
            @keyup.enter.stop.prevent="handleCreateFolderConfirm"
          />
        </el-form-item>
        <!-- 项目空间不显示系统内置选项（项目空间权限由审计系统角色控制） -->
        <el-form-item v-if="isSuperFileAdmin() && currentSpaceType !== 'PROJECT'" label="系统内置">
          <el-radio-group v-model="createFolderForm.is_system_builtin">
            <el-radio :label="false">否</el-radio>
            <el-radio :label="true">是</el-radio>
          </el-radio-group>
          <div style="font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px;">
            系统内置文件夹仅超级文件管理员可重命名、删除或移动
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createFolderDialogVisible = false" :disabled="createFolderLoading">取 消</el-button>
          <el-button type="primary" @click="handleCreateFolderConfirm" :loading="createFolderLoading">
            确 定
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 重命名文件夹对话框 -->
    <el-dialog
      v-model="renameFolderDialogVisible"
      title="重命名文件夹"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="renameFolderForm" label-width="80px">
        <el-form-item label="新名称">
          <el-input
            v-model="renameFolderForm.folder_name"
            placeholder="请输入新的文件夹名称"
            @keyup.enter="handleRenameFolderConfirm"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="renameFolderDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleRenameFolderConfirm">
            确 定
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 重命名文件对话框 -->
    <el-dialog
      v-model="renameFileDialogVisible"
      title="重命名文件"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="renameFileForm" label-width="80px" v-loading="renameFileLoading">
        <el-form-item label="新名称">
          <el-input
            v-model="renameFileForm.file_name"
            placeholder="请输入新的文件名称"
            @keyup.enter="handleRenameFileConfirm"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="renameFileDialogVisible = false" :disabled="renameFileLoading">取 消</el-button>
          <el-button type="primary" @click="handleRenameFileConfirm" :loading="renameFileLoading">
            确 定
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 移动文件对话框 -->
    <el-dialog
      v-model="moveFileDialogVisible"
      title="移动文件"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="moveFileForm" label-width="80px" v-loading="moveFileLoading">
        <el-form-item label="目标文件夹">
          <el-tree
            :data="folderTreeData"
            :props="{ label: 'name', children: 'children' }"
            :default-expanded-keys="expandedKeys"
            @node-click="handleMoveFileTargetSelect"
            :highlight-current="true"
            node-key="id"
            :current-node-key="moveFileForm.target_folder_id"
            style="max-height: 300px; overflow-y: auto;"
          >
            <template #default="{ node, data }">
              <div class="tree-node-content">
                <div class="node-left">
                  <el-icon class="folder-icon" :class="getFolderIconClass(data.folder_type)">
                    <component :is="getFolderIcon(data.folder_type, data.isSpaceRoot)" />
                  </el-icon>
                  <span class="node-label">{{ node.label }}</span>
                </div>
              </div>
            </template>
          </el-tree>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="moveFileDialogVisible = false" :disabled="moveFileLoading">取 消</el-button>
          <el-button type="primary" @click="handleMoveFileConfirm" :loading="moveFileLoading" :disabled="!moveFileForm.target_folder_id">
            确 定
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 权限管理对话框 -->
    <el-dialog
      v-model="permissionDialogVisible"
      title="权限管理"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-loading="permissionLoading">
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #606266;">文件夹：{{ getFolderName(currentFolder) }}</span>
          <el-button type="primary" :icon="Plus" @click="openGrantPermissionDialog">授权</el-button>
        </div>

        <el-table :data="permissionList" border max-height="400">
          <el-table-column prop="grantee_name" label="被授权对象" width="200" />
          <el-table-column prop="grantee_type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.grantee_type === 'USER' ? 'success' : 'info'" size="small">
                {{ row.grantee_type === 'USER' ? '用户' : '机构' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="permission_type" label="权限级别" width="120">
            <template #default="{ row }">
              <el-tag
                :type="row.permission_type === 'DELEGATE' ? 'warning' : (row.permission_type === 'MANAGE' ? 'danger' : 'primary')"
                size="small"
              >
                {{ row.permission_type === 'DELEGATE' ? '分权' : (row.permission_type === 'MANAGE' ? '管理' : '查看') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="can_delegate" label="可分权" width="100">
            <template #default="{ row }">
              <el-tag :type="row.can_delegate ? 'success' : 'info'" size="small">
                {{ row.can_delegate ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="机构范围" width="100" align="center">
            <template #default="{ row }">
              <template v-if="row.grantee_type === 'ORG'">
                <el-tag v-if="row.include_org_descendants" type="warning" size="small">含下级</el-tag>
                <el-tag v-else type="info" size="small">本级</el-tag>
              </template>
              <span v-else style="color: #c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="grantor_name" label="授权人" width="120" />
          <el-table-column prop="granted_at" label="授权时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.granted_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button
                type="danger"
                size="small"
                text
                :loading="revokingPermissionId === row.permission_id"
                :disabled="revokingPermissionId === row.permission_id"
                @click="handleRevokePermission(row)"
              >
                撤销
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 授权权限对话框 -->
    <el-dialog
      v-model="grantPermissionDialogVisible"
      title="授权权限"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="grantPermissionForm" label-width="100px" v-loading="grantPermissionLoading">
        <el-form-item label="授权对象类型" required>
          <el-radio-group v-model="grantPermissionForm.grantee_type" @change="handleGranteeTypeChange">
            <el-radio label="USER">用户</el-radio>
            <el-radio label="ORG">机构</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="选择用户" v-if="grantPermissionForm.grantee_type === 'USER'" required>
          <el-select
            v-model="grantPermissionForm.grantee_id"
            filterable
            remote
            :remote-method="searchUsers"
            :loading="userSearchLoading"
            placeholder="请输入用户名搜索"
            style="width: 100%"
          >
            <el-option
              v-for="user in userSearchResults"
              :key="user.USERID"
              :label="user.FULL_NAME || user.USERID"
              :value="user.USERID"
            >
              <span>{{ user.FULL_NAME || user.USERID }}</span>
              <span style="color: #8492a6; font-size: 13px; margin-left: 8px;">({{ user.USERID }})</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="选择机构" v-if="grantPermissionForm.grantee_type === 'ORG'" required>
          <el-input
            v-model="selectedOrgName"
            placeholder="请选择机构"
            readonly
            style="width: 100%"
            @click="showOrgTreeDialog = true"
          >
            <template #suffix>
              <el-icon><ArrowDown /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item v-if="grantPermissionForm.grantee_type === 'ORG'" label="机构范围">
          <el-checkbox v-model="grantPermissionForm.include_org_descendants">
            允许该机构及其下级机构访问
          </el-checkbox>
        </el-form-item>
        <el-form-item label="权限级别" required>
          <el-radio-group v-model="grantPermissionForm.permission_type">
            <el-radio label="MANAGE">管理权限</el-radio>
            <el-radio label="READ">查看权限</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="可分权" v-if="grantPermissionForm.permission_type === 'MANAGE'">
          <el-switch v-model="grantPermissionForm.can_delegate" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px;">
            允许被授权对象继续授权给其他人
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="grantPermissionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleGrantPermissionConfirm" :loading="grantPermissionLoading">
          确 定
        </el-button>
      </template>
    </el-dialog>

    <!-- 机构树选择对话框（用于机构授权） -->
    <el-dialog
      v-model="showOrgTreeDialog"
      title="选择机构"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-tree
        :data="orgTreeData"
        :props="orgTreeProps"
        node-key="orguuid"
        :default-expand-all="false"
        :expand-on-click-node="true"
        highlight-current
        @node-click="handleOrgTreeNodeClick"
        style="max-height: 400px; overflow-y: auto;"
      >
        <template #default="{ node, data }">
          <span class="org-tree-node">
            <span>{{ data.cnname || data.orgname || '' }}</span>
          </span>
        </template>
      </el-tree>
      <template #footer>
        <el-button @click="showOrgTreeDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmOrgSelection" :disabled="!grantPermissionForm.grantee_id">
          确定
        </el-button>
      </template>
    </el-dialog>


    <!-- 绑定项目对话框 -->
    <el-dialog
      v-model="bindProjectDialogVisible"
      title="绑定项目"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="bindProjectForm" label-width="100px" v-loading="bindProjectLoading">
        <el-form-item label="文件夹">
          <el-tag type="info">{{ getFolderName(bindProjectForm.folder_id) }}</el-tag>
        </el-form-item>
        <el-form-item label="选择项目">
          <el-select
            v-model="bindProjectForm.project_uuid"
            filterable
            placeholder="请选择项目（留空表示解绑）"
            style="width: 100%"
            clearable
          >
            <el-option
              v-for="project in projectList"
              :key="project.project_uuid"
              :label="project.project_name"
              :value="project.project_uuid"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-text type="info" size="small">
            提示：选择项目后，该文件夹将关联到指定项目；留空表示解绑项目。
          </el-text>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindProjectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBindProjectConfirm" :loading="bindProjectLoading">
          确 定
        </el-button>
      </template>
    </el-dialog>

    <!-- 绑定机构对话框（仅超级文件管理员） -->
    <el-dialog
      v-model="bindOrgDialogVisible"
      title="绑定机构"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form :model="bindOrgForm" label-width="120px" v-loading="bindOrgLoading">
        <el-form-item label="文件夹">
          <el-tag type="info">{{ getFolderName(bindOrgForm.folder_id) }}</el-tag>
        </el-form-item>
        <el-form-item label="选择机构">
          <el-tree-select
            v-model="bindOrgForm.bound_org_uuid"
            :data="orgTreeData"
            :props="{ value: 'orguuid', label: 'cnname', children: 'children' }"
            placeholder="请选择机构（清空表示解绑）"
            check-strictly
            filterable
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="默认查看授权">
          <el-checkbox v-model="bindOrgForm.grant_read_to_org">绑定时为该机构写入「查看」权限</el-checkbox>
        </el-form-item>
        <el-form-item v-if="bindOrgForm.grant_read_to_org" label="查看范围">
          <el-checkbox v-model="bindOrgForm.grant_read_include_descendants">
            「查看」权限含下级机构
          </el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-text type="info" size="small">
            绑定后，该文件夹将作为机构根目录：其下不允许再直接新建子文件夹（可在更深层已有目录中管理）。聚焦视图下：个人空间仍全量展示；公共空间展示所有已绑定机构文件夹，若其上级未绑定则上级仅作路径展示且不可选；某绑定文件夹下若无更深层绑定则不再展开未绑定子项。
          </el-text>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindOrgDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBindOrgConfirm" :loading="bindOrgLoading">
          确 定
        </el-button>
      </template>
    </el-dialog>

    <!-- 存储空间管理对话框 -->
    <el-dialog
      v-model="showStorageDialog"
      title="存储空间管理"
      width="80%"
      top="5vh"
      destroy-on-close
      class="storage-management-dialog"
    >
      <el-tabs v-model="activeStorageTab">
        <!-- 公共空间统计 -->
        <el-tab-pane label="公共空间统计" name="public">
          <div v-loading="publicSpaceStatsLoading" style="min-height: 200px;">
            <div v-if="publicSpaceStats" style="padding: 20px;">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="公共空间文档总大小">
                  <span style="font-size: 18px; font-weight: bold; color: #409eff;">
                    {{ formatPublicSpaceTotalSize(publicSpaceStats.total_size || 0) }}
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <el-empty v-else-if="!publicSpaceStatsLoading" description="暂无数据" />
          </div>
        </el-tab-pane>

        <!-- 用户存储额度管理 -->
        <el-tab-pane label="用户存储额度管理" name="users">
          <div style="margin-top: 16px;">
            <el-text type="info" size="small" style="margin-bottom: 12px; display: block;">
              共 {{ usersStorageTotal }} 个用户，每个用户可单独设置存储额度
            </el-text>
          </div>
          <el-table
            :data="paginatedUsersStorageList"
            border
            size="default"
            style="width: 100%; margin-top: 8px"
            v-loading="usersStorageLoading"
            max-height="500"
            empty-text="暂无用户数据"
          >
            <el-table-column prop="user_name" label="用户名" min-width="150" />
            <el-table-column label="已使用空间" width="180">
              <template #default="scope">
                {{ formatUserStorageSize(scope.row.used) }}
              </template>
            </el-table-column>
            <el-table-column label="配置额度" width="150">
              <template #default="scope">
                {{ scope.row.limit_gb }} GB
              </template>
            </el-table-column>
            <el-table-column label="使用百分比" width="200">
              <template #default="scope">
                <el-progress
                  :percentage="scope.row.percentage"
                  :color="scope.row.percentage >= 90 ? '#f56c6c' : scope.row.percentage >= 70 ? '#e6a23c' : '#67c23a'"
                  :stroke-width="8"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="scope">
                <el-button size="small" type="primary" @click="openQuotaEditDialog(scope.row)">
                  编辑
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <!-- 分页组件 -->
          <el-pagination
            v-if="usersStorageList.length > 0"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="usersStorageTotal"
            v-model:page-size="usersStoragePageSize"
            v-model:current-page="usersStorageCurrentPage"
            :page-sizes="[10, 20, 50, 100]"
            @current-change="handleUsersStoragePageChange"
            @size-change="handleUsersStorageSizeChange"
            style="margin-top: 16px; justify-content: flex-end; display: flex;"
          />
        </el-tab-pane>
      </el-tabs>

      <!-- 编辑额度对话框 -->
      <el-dialog
        v-model="quotaEditDialog.visible"
        title="编辑用户存储额度"
        width="500px"
        append-to-body
      >
        <el-form
          :model="quotaEditDialog.form"
          label-width="120px"
          ref="quotaFormRef"
          :rules="{
            limit_gb: [
              { required: true, message: '请输入存储额度', trigger: 'blur' },
              { type: 'number', min: 0.01, message: '存储额度必须大于0', trigger: 'blur' }
            ]
          }"
        >
          <el-form-item label="用户名">
            <el-input
              v-model="quotaEditDialog.form.user_name"
              disabled
            />
          </el-form-item>

          <el-form-item label="存储额度（GB）" prop="limit_gb">
            <el-input-number
              v-model="quotaEditDialog.form.limit_gb"
              :min="0.01"
              :precision="2"
              :step="0.5"
              placeholder="请输入存储额度"
              style="width: 100%;"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="quotaEditDialog.visible = false">取消</el-button>
          <el-button type="primary" @click="submitQuotaEdit">确定</el-button>
        </template>
      </el-dialog>
    </el-dialog>


    <!-- 文档预览全屏弹窗 -->
    <el-dialog
      v-model="showDocumentPreviewDialog"
      :title="documentPreviewParams.toolLabel"
      fullscreen
      class="document-preview-fullscreen-dialog"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      destroy-on-close
      @closed="handleDocumentPreviewDialogClose"
    >
      <!-- 统一任务加载进度遮罩 -->
      <div
        v-if="taskProgressLoading"
        class="task-progress-overlay"
      >
        <div class="progress-dialog-container">
          <div class="progress-dialog-header">
            <div class="progress-dialog-left">
              <span class="progress-elapsed" v-if="taskProgressText">{{ taskProgressText }}</span>
            </div>
            <el-tag size="small">进行中</el-tag>
          </div>
          <TaskRuntimeProgressTree :nodes="taskProgressRuntimeNodes" />
          <div class="progress-dialog-footer">
            <el-button @click="dismissTaskProgressOverlay">关闭</el-button>
          </div>
        </div>
      </div>

      <OcrViewer
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'fileToPdf'"
        :files="documentPreviewParams.files"
        :toolLabel="documentPreviewParams.toolLabel"
        :names="documentPreviewParams.names"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <ContractViewer
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'contractCompleteness'"
        :files="documentPreviewParams.files"
        :toolLabel="documentPreviewParams.toolLabel"
        :names="documentPreviewParams.names"
        :is-secondary-execution="false"
        :analysis-task-id="documentPreviewParams.taskId || currentTaskUuid || ''"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <MeetingMinutesViewer
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'meetingMinutes'"
        :files="documentPreviewParams.files"
        :toolLabel="documentPreviewParams.toolLabel"
        :names="documentPreviewParams.names"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <WordCloudAnalysis
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'wordCloud'"
        :files="documentPreviewParams.files"
        :toolLabel="documentPreviewParams.toolLabel"
        :names="documentPreviewParams.names"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <EngineeringProjectViewer
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'engineeringProject'"
        :tool="documentPreviewParams.tool"
        :files="documentPreviewParams.files"
        :toolLabel="documentPreviewParams.toolLabel"
        :names="documentPreviewParams.names"
        :folder_id="documentPreviewParams.folder_id"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <associationDegreeTwoTables
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'associationDegreeTwoTables'"
        :tool="documentPreviewParams.tool"
        :files="documentPreviewParams.files"
        :toolLabel="documentPreviewParams.toolLabel"
        :names="documentPreviewParams.names"
        :folder_id="documentPreviewParams.folder_id"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <ThemeAnalysisViewer
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'themeAnalysis'"
        :tool="documentPreviewParams.tool"
        :files="documentPreviewParams.files"
        :toolLabel="documentPreviewParams.toolLabel"
        :names="documentPreviewParams.names"
        :folder_id="documentPreviewParams.folder_id"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <RiskPointAnalysisPrototype
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'riskPointAnalysis'"
        :files="documentPreviewParams.files"
        :names="documentPreviewParams.names"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <TimelineAnalysisViewer
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'timelineAnalysis'"
        :files="documentPreviewParams.files"
        :names="documentPreviewParams.names"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <BiddingAnalysis
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'biddingAnalysis'"
        :files="documentPreviewParams.files"
        :names="documentPreviewParams.names"
      />
      <PrepaidExpensesPrototype
        v-if="showDocumentPreviewDialog && documentPreviewParams.tool === 'prepaidExpenses'"
        :files="documentPreviewParams.files"
        :names="documentPreviewParams.names"
        :tool-label="documentPreviewParams.toolLabel"
        :task-id="documentPreviewParams.taskId || ''"
        :eventKey="'file-manager-progress-start'"
        ref="viewerRef"
        @close-dialog="handleDocumentPreviewDialogClose"
      />
      <!-- 任务进度悬浮球 -->
      <div
        v-if="taskProgressFloatingVisible"
        class="task-progress-floating-ball"
        @click="hideFloatingBallAndShowProgress"
      >
        <el-icon class="floating-ball-icon"><Loading /></el-icon>
        <span class="floating-ball-time">{{ taskProgressElapsedTime.toFixed(1) }}s</span>
      </div>
    </el-dialog>
    <!-- 文本检索对话框 -->
    <el-dialog
      v-model="textSearchDialogVisible"
      title="文本检索"
      fullscreen
      class="text-search-dialog-custom"
    >
      <div class="fm-text-search-toolbar">
        <span style="font-size: 14px;">搜索词（支持正则）：</span>
        <el-input
          v-model="textSearchKeyword"
          size="small"
          placeholder="请输入搜索词（支持正则表达式）"
          style="width: 260px;"
          clearable
        />
        <el-button
          type="primary"
          size="small"
          :loading="textSearchLoading"
          @click="handleDoTextSearch"
        >
          开始检索
        </el-button>
        <el-button
          v-if="textSearchHasSearched"
          type="default"
          size="small"
          @click="handleClearTextSearchResult"
        >
          清空检索
        </el-button>
        <el-button
          type="primary"
          size="small"
          @click="openTextSearchFileSelect"
        >
          选择文件
        </el-button>
        <el-button
          v-if="textSearchSelectedFiles.length > 0"
          type="default"
          size="small"
          @click="handleClearTextSearchFiles"
        >
          清空文件
        </el-button>
        <el-dropdown
          trigger="hover"
          :disabled="textSearchTableSelectedRows.length === 0 || textSearchExportLoading"
          @command="handleTextSearchExportCommand"
        >
          <el-button
            type="success"
            size="small"
            :loading="textSearchExportLoading"
            :disabled="textSearchTableSelectedRows.length === 0"
          >
            <span>导出<i class="el-icon-arrow-down el-icon--right" style="margin-left: 4px;"></i></span>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
              <el-dropdown-item command="word">导出 Word</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div
          class="toolbox-trigger-wrapper"
          @mouseenter="handleToolboxMouseEnter"
          @mouseleave="handleToolboxMouseLeave"
        >
          <el-button
            type="default"
            size="small"
            margin-left="10px"
            :disabled="textSearchTableSelectedRows.length === 0"
          >
            工具箱
          </el-button>

          <!-- 工具箱下拉菜单 -->
          <div
            v-show="showTextSearchToolbox"
            class="toolbox-dropdown"
            @mouseenter="handleToolboxMouseEnter"
            @mouseleave="handleToolboxMouseLeave"
          >
            <div class="toolbox-dropdown-box">
              <div class="toolbox-dropdown-content">
                <div v-if="textSearchTableSelectedRows.length > 0" class="selected-files-tip">
                  已勾选 {{ textSearchTableSelectedRows.length }} 个文件
                </div>
                <div v-else class="selected-files-tip" style="color: #909399;">
                  请先勾选文件
                </div>
                <div v-if="functionGroups.length === 0" class="toolbox-empty">暂无可用工具</div>
                <div
                  v-for="group in functionGroups"
                  :key="'ts-' + group.code"
                  class="toolbox-category"
                >
                  <div class="toolbox-category-head">
                    <span class="toolbox-category-title">{{ group.label }}</span>
                  </div>
                  <div class="tool-list">
                    <div
                      v-for="(item, index) in group.tools"
                      :key="item.value"
                      class="tool-item"
                      @click="handleTextSearchToolClick(item.value, item.label)"
                    >
                      <div
                        class="tool-icon"
                        :style="{ background: functionColorMap[index % functionColorMap.length] }"
                      >
                        <img
                          :src="getFileManagerToolIconUrl(item.value, item.label)"
                          :alt="item.label"
                          @error="handleToolIconError($event, item)"
                        />
                      </div>
                      <span class="tool-text">{{ item.label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span  style="font-size: 12px; color: #909399;">
        已勾选 {{ textSearchTableSelectedRows.length }} 个文件，
      </span>
      <span  style="font-size: 12px; color: #909399;">
        符合搜索条件 {{ textSearchMatchedFiles.length }} 个文件
      </span>
      <div class="text-search-main-split">
        <el-table
          ref="textSearchTableRef"
          :data="textSearchTableList"
          border
          row-key="file_id"
          style="width: 45%;"
          height="100%"
          highlight-current-row
          v-loading="textSearchLoading"
          :header-cell-style="{ background: '#f5f7fa', color: '#303133', fontWeight: '600', height: '50px' }"
          @row-click="handleTextSearchRowClick"
          @selection-change="handleTextSearchSelectionChange"
        >
          <el-table-column type="selection" width="55" align="center" />
          <el-table-column prop="file_name" label="文件名" min-width="160" show-overflow-tooltip />
          <el-table-column prop="folder_path" label="所在文件夹" min-width="200" show-overflow-tooltip />
          <el-table-column
            v-if="textSearchHasSearched"
            prop="match_count"
            label="查询结果"
            width="100"
            align="right"
          />
        </el-table>

        <div class="text-search-preview-content">
          <div style="margin-bottom: 8px; font-weight: 500; display: flex; align-items: center; justify-content: space-between;">
            <span>
              {{ textSearchPreviewIsSearchHighlight && textSearchKeyword.trim() ? '匹配结果' : '文件内容' }}
              <span v-if="textSearchPreviewFile">（{{ textSearchPreviewFile.file_name }}）</span>
            </span>
            <!-- <div style="display: flex; gap: 4px;">
              <el-tooltip content="下载结果" placement="top">
                <el-button type="primary" link size="small" @click="() => ElMessage.info('功能设计中')">
                  <el-icon><Download /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="下载源文件" placement="top">
                <el-button type="primary" link size="small" @click="() => ElMessage.info('功能设计中')">
                  <el-icon><Download /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="复制匹配结果" placement="top">
                <el-button type="primary" link size="small" @click="() => ElMessage.info('功能设计中')">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </el-tooltip>
            </div> -->
          </div>
          <div v-if="textSearchPreviewLoading" style="color: #909399; padding: 8px 0;">
            {{ textSearchKeyword.trim() ? '正在匹配，请稍候...' : '正在加载文件内容...' }}
          </div>
          <div
            v-else-if="textSearchPreviewFile"
          >
            <div
              v-if="textSearchPreviewMarkdownHtml"
              ref="textSearchPreviewContentRef"
              class="text-search-markdown-body"
              v-html="textSearchPreviewMarkdownHtml"
            />
            <span v-else style="color: #909399">（暂无文本内容）</span>
          </div>
          <div v-else style="color: #909399; padding: 8px 0;">
            请在左侧选择文件查看内容
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 文本检索使用的文件选择对话框（文本信息提取专用）-->
    <FileSelectDialog
      v-if="textSearchFileSelectVisible"
      v-model="textSearchFileSelectVisible"
      :initial-selected-files="textSearchSelectedFiles"
      :return-object="true"
      :allow-unparsed="textSearchAllowUnparsed"
      :can-select-file-type="textSearchCanSelectFileType"
      :show-parse-status="textSearchShowParseStatus"
      @confirm="handleTextSearchFileConfirm"
    />
    <el-dialog
      v-model="showUploadRecordsDialog"
      title="文件上传记录"
      fullscreen
      destroy-on-close
      append-to-body
    >
      <FileContentProgressPrototype />
    </el-dialog>

    <!-- 引入文件夹对话框（项目空间） -->
    <el-dialog
      v-model="importFolderDialogVisible"
      title="引入文件夹"
      width="600px"
      destroy-on-close
    >
      <div v-loading="importFolderLoading" style="min-height: 200px;">
        <el-tree
          ref="importFolderTreeRef"
          :data="publicFolderTreeDataForImport"
          :props="{ label: 'name', children: 'children' }"
          show-checkbox
          check-strictly
          node-key="id"
          @check-change="handleImportFolderCheck"
        />
      </div>
      <template #footer>
        <el-button @click="importFolderDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleImportFolderConfirm" :disabled="!selectedImportFolderId">确定引入</el-button>
      </template>
    </el-dialog>

    <!-- 查看审计小组对话框 -->
    <el-dialog
      v-model="projectGroupsDialogVisible"
      title="审计小组"
      width="700px"
      destroy-on-close
    >
      <el-table :data="currentProjectGroups" style="width: 100%">
        <el-table-column prop="group_name" label="小组名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="leader_name" label="组长" width="100" />
        <el-table-column prop="leader_role" label="组长角色" width="100" />
        <el-table-column prop="member_count" label="成员数" width="80" align="center" />
        <el-table-column prop="create_time" label="创建时间" width="180">
          <template #default="{ row }">
            {{ row.create_time ? formatDateTime(row.create_time) : '-' }}
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="projectGroupsDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="uploadRecoveryVisible"
      title="发现未完成的上传任务"
      width="700px"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <div v-for="record in uploadRecoveryRecords" :key="record.id" style="margin-bottom: 16px;">
        <template v-if="record.file_hash === 'folder_upload' && record.file_metadata_list && record.file_metadata_list.length > 0">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">
            文件夹：{{ record.root_folder_name || '未知文件夹' }}
          </div>
          <div style="font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 8px;">
            进度：{{ record.file_metadata_list.filter(f => f.uploaded || f.skipped).length }}/{{ record.file_metadata_list.length }} 个文件已处理
          </div>
          <el-tree
            :data="buildRecoveryTree(record.file_metadata_list, record.id, record.folder_id)"
            :default-expanded-keys="getPendingFolderKeys(record.file_metadata_list)"
            node-key="key"
            :props="{ label: 'label', children: 'children' }"
            style="max-height: 300px; overflow-y: auto;"
          >
            <template #default="{ data }">
              <span class="recovery-tree-node">
                <span class="recovery-tree-label" :title="data.title">{{ data.label }}</span>
                <el-tag v-if="data.status === 'uploaded'" type="success" size="small">已上传</el-tag>
                <el-tag v-else-if="data.status === 'skipped'" type="warning" size="small">已跳过</el-tag>
                <el-tag v-else-if="data.status === 'pending'" type="info" size="small">未上传</el-tag>
                <span v-if="data.skipReason" class="recovery-reason warning">{{ data.skipReason }}</span>
                <span v-if="data.failReason" class="recovery-reason danger">{{ data.failReason }}</span>
                <template v-if="data.status === 'pending' && data.isFile">
                  <el-button link size="small" type="primary" @click.stop="recoverSingleFileInFolder(data)">选择文件</el-button>
                  <el-button link size="small" @click.stop="skipSingleFileInFolder(data)">跳过</el-button>
                </template>
              </span>
            </template>
          </el-tree>
        </template>
        <template v-else>
          <div class="recovery-single-file-row">
            <span>{{ record.file_name }}（进度 {{ record.progress }}%）</span>
            <el-button size="small" type="primary" @click="openSingleFileRecoveryPicker(record)">选择文件</el-button>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="handleRecoveryAbandon">放弃</el-button>
        <el-button type="primary" @click="handleRecoveryContinue">继续上传</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="uploadRecoveryFileInputVisible"
      title="恢复文件上传"
      width="500px"
      :close-on-click-modal="false"
    >
      <p v-if="uploadRecoveryPendingFileRecord">
        请重新选择文件 <strong>{{ uploadRecoveryPendingFileRecord.file_name }}</strong> 以继续上传。
        <span v-if="uploadRecoveryFileQueueHint" style="display: block; margin-top: 8px; color: var(--el-text-color-secondary); font-size: 13px;">
          {{ uploadRecoveryFileQueueHint }}
        </span>
      </p>
      <input
        ref="uploadRecoveryFileInputRef"
        type="file"
        style="display: none;"
        @change="handleRecoveryFileSelect"
      />
      <template #footer>
        <el-button @click="skipCurrentSingleFileRecovery">跳过</el-button>
        <el-button @click="cancelSingleFileRecovery">取消</el-button>
        <el-button type="primary" @click="triggerSingleFileRecoveryPicker">选择文件</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="uploadRecoveryFolderInputVisible"
      title="恢复文件夹上传"
      width="500px"
      :close-on-click-modal="false"
    >
      <p>当前浏览器不支持目录访问 API，请重新选择<strong>与上次相同的本地文件夹</strong>以继续上传。</p>
      <div class="recovery-folder-picker">
        <input
          ref="uploadRecoveryFolderInputRef"
          type="file"
          webkitdirectory
          directory
          style="display: none;"
          @change="handleRecoveryFolderSelect"
        />
        <el-button type="primary" size="large" @click="triggerRecoveryFolderPicker">
          <el-icon><Folder /></el-icon>
          <span style="margin-left: 6px;">选择文件夹</span>
        </el-button>
        <span class="picker-hint">请选择与上次相同的本地文件夹</span>
      </div>
      <template #footer>
        <el-button @click="uploadRecoveryFolderInputVisible = false; uploadRecoveryPendingRecord = null">取消</el-button>
      </template>
    </el-dialog>

    <!-- 附件管理弹窗 -->
    <AttachmentListDialog
      v-model:visible="attachmentDialogVisible"
      :file-id="attachmentDialogFileId"
      :file-name="attachmentDialogFileName"
      :available-files="availableAttachmentFiles"
      @change="onAttachmentListChange"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox, ElNotification, ElLoading } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { eventBus } from '@/utils/eventBus.js'
import {
  FILE_MANAGER_PROGRESS_START,
  FILE_MANAGER_PROGRESS_STOP
} from '@/views/file-manager-code/utils/fileManagerTaskProgressEvents.js'
import {
  buildTaskRuntimeNodesDisplay,
  resolveScheduleTaskFailureMessage
} from '@/composables/useScheduleTaskProgress.js'
import FilePreview from '@/components/FilePreview.vue'
import OcrViewer from './OcrViewer.vue'
import ContractViewer from './ContractViewer.vue'
import WordCloudAnalysis from '@/views/word-cloud-analysis/Index.vue'
import EngineeringProjectViewer from './EngineeringProjectViewer.vue'
import AssociationDegreeTwoTables from './AssociationDegreeTwoTables.vue'
import ThemeAnalysisViewer from './ThemeAnalysisViewer.vue'
import RiskPointAnalysisPrototype from '@/views/document-mining/RiskPointAnalysisPrototype.vue'
import FileSelectDialog from '@/components/common/FileSelectDialog.vue'
import MeetingMinutesViewer from '@/views/DemoAudit/meeting-minutes-analysis/index.vue'
import TimelineAnalysisViewer from '@/views/DemoAudit/timeline-analysis/TimelineAnalysisViewer.vue'
import BiddingAnalysis from '@/views/DemoAudit/bidding-analysis/index.vue'
import ComingSoonView from '@/views/ComingSoon/IndexView.vue'
import PrepaidExpensesPrototype from '@/views/document-mining/PrepaidExpensesPrototype.vue'
import FileContentProgressPrototype from './FileContentProgressPrototype.vue'
import TaskRuntimeProgressTree from './components/contract/TaskRuntimeProgressTree.vue'
import AttachmentListDialog from './components/AttachmentListDialog.vue'
import FileManagerScopeSelector from './components/FileManagerScopeSelector.vue'
import { useRequest as useRequestUtil } from '@/utils/request/useRequest.js'
import {
  Search,
  Upload,
  Folder,
  Document,
  Picture,
  VideoCamera,
  ArrowDown,
  CircleCloseFilled,
  Loading,
  FolderOpened,
  Notebook,
  Link,
  Files,
  EditPen,
  Close,
  Promotion,
  DataAnalysis,
  Check,
  WarningFilled,
  RefreshRight,
  Menu,
  MoreFilled,
  Plus,
  Edit,
  Delete,
  User,
  OfficeBuilding,
  School,
  Setting,
  View,
  ScaleToOriginal,
  Download,
  CopyDocument,
  Operation,
  FolderAdd,
  Paperclip
} from '@element-plus/icons-vue'
// 导入API函数
import {
  getFolderTreeAPI,
  getFolderChildrenAPI,
  createFolderAPI,
  deleteFolderAPI,
  renameFolderAPI,
  getFileListAPI,
  uploadFileAPI,
  downloadFileAPI,
  deleteFileAPI,
  renameFileAPI,
  moveFileAPI,
  previewFileAPI,
  convertDocToDocxAPI,
  convertXlsToXlsxAPI,
  getMyPermissionAPI,
  getFolderPermissionsAPI,
  grantPermissionAPI,
  revokePermissionAPI,
  getProjectsAPI,
  bindProjectAPI,
  bindOrgAPI,
  updateFolderOrderAPI,
  getFileTagsAPI,
  generateFileTagsAPI,
  addFileTagAPI,
  deleteFileTagAPI,
  getPublicSpaceStatsAPI,
  getAllUsersStorageInfoAPI,
  setUserStorageQuotaAPI,
  getFileContentAPI,
  getFilesContentBatchAPI,
  textSearchCheckFilesAPI,
  syncOssFoldersAPI,
  syncOssFilesAPI,
  getOssFolderTreeAPI,
  refreshOssFileContentAPI,
  postRequeueByFileIdsAPI,
  batchCreateFoldersAPI,
  batchCheckUploadConflictsAPI,
  createFolderUploadSessionAPI,
  listFolderUploadSessionsAPI,
  updateFolderUploadFileStatusAPI,
  batchUpdateFolderUploadFileStatusAPI,
  deleteFolderUploadSessionAPI,
  deleteAllFolderUploadSessionsAPI
} from '@/api/fileManager.js'
import {
  initDB as initUploadCacheDB,
  saveUploadRecord,
  getUploadRecord,
  getIncompleteRecords,
  deleteUploadRecord,
  deleteAllIncompleteRecords,
  cleanupExpiredRecords,
  pruneCompletedUploadRecords,
  generateRecordId,
  detectPrivateMode
} from '@/utils/uploadCache.js'
import { exportFn } from '@/utils/excel/export.js'
import { exportTextSearchResultsAsZip, exportPlainTextDocxFile } from '@/utils/word/exportPlainTextDocx.js'
import { exportMarkdownFile } from '@/utils/markdown/exportMarkdownFile.js'
import MarkdownIt from 'markdown-it'
import markdownItGfmTables from '@/utils/markdownItGfmTables'
import { getTaskSchedulesAPI } from '@/api/task.js'
import { resolvePrepaidPollAction } from '@/views/document-mining/prepaidTaskProgressUtils.js'
import { getToken } from '@/utils/request/token.js'
import { getOrgTreeAPI, getCurrentUserOrgPathAPI } from '@/api/org.js'
import { getEnvConfig } from '../../../env.config.js'
import CryptoJS from 'crypto-js'
// OSS 原型 Mock 数据（同步时使用，优先使用真实导出的数据）
import ossFolderTreeReal from '@/mock/oss-folder-tree/oss_folder_tree_demo.json'
// 项目空间 API（已切换为真实接口）
import {
  getProjectSpaceTreeAPI,
  getUserProjectRoleBatchAPI,
  importFolderAPI,
  removeFolderReferenceAPI,
  getProjectGroupsAPI
} from '@/api/projectSpace.js'

defineOptions({
  name: 'FileManagerCode',
})

// 初始化路由
const router = useRouter()
const route = useRoute()

// 查询参数
const query = reactive({
  page: 1,
  size: 10,
  search: '', // 文件搜索关键词
  mime_type: '', // 文件类型筛选（如 image/、other）
  file_ext: '', // 按扩展名筛选（不含点，如 pdf、docx）
  /** 解析状态数值：'' | '0' | '1' | '2' | '3'，与 DB parse_status 及字典 file-parse-status 一致 */
  parse_status: '',
  uploader: '',
  /** 文件夹范围：false=本文件夹，true=本文件夹及子文件夹 */
  recursive: false
})

/** 筛选按钮上展示的当前条件 */
const fileFilterLabel = computed(() => {
  if (query.file_ext && String(query.file_ext).trim()) {
    return `.${String(query.file_ext).trim().toLowerCase()}`
  }
  if (query.mime_type === 'image/') return '图片'
  if (query.mime_type === 'other') return '其他'
  return '全部'
})

/** 是否存在已激活的筛选条件 */
const hasActiveFilters = computed(() => {
  return !!(
    (query.parse_status != null && String(query.parse_status).trim() !== '') ||
    query.mime_type ||
    query.file_ext ||
    (currentFolder.value && query.recursive)
  )
})

// 文件列表
const fileList = ref([])
const total = ref(0)
const loading = ref(false)

// 文件夹树数据
const folderTreeData = ref([])
// 文件空间类型列表（从数据字典 file_space_type 加载）
// 结构示例：[{ key_code: 'PUBLIC', label: '公共空间', sort_order: 10 }, ...]
const spaceList = ref([])
const folderLoading = ref(false)
const treeRefreshLoading = ref(false)
const currentFolder = ref(null)
// 当前空间类型（值为字典项的 key_code，例如 PUBLIC / PERSONAL / 其他扩展空间）
const currentSpaceType = ref('PERSONAL')
const expandedKeys = ref([]) // 默认展开的节点
const folderTreeRef = ref(null)
const createFolderLoading = ref(false) // 新建文件夹加载状态
const searchKeyword = ref('') // 搜索关键词
// 侧栏视图：full 完整多根树；focused 仅显示「范围选择器」选中的子树
const sidebarViewMode = ref('focused')
const focusedScopeNodeId = ref(null)

// OSS 同步原型相关状态
const ossSyncLoading = ref(false)
const ossSyncVersion = ref(0) // 同步次数
const ossPreviousPaths = ref(new Set()) // 上次同步时 OSS 中存在的路径，用于检测"减少"的文件夹
const ossSyncResult = ref(null) // { added: [], removed: [] } 同步结果提示

// 项目空间 - 引入文件夹相关状态
const importFolderDialogVisible = ref(false)
const importFolderLoading = ref(false)
const importFolderTargetId = ref(null)
const publicFolderTreeDataForImport = ref([])
const selectedImportFolderId = ref(null)
const importFolderTreeRef = ref(null)
// 当前选中文件夹的引用信息（用于引用文件夹反显）
const currentFolderRefInfo = ref(null) // { isReference: true, ref_target_id, ref_target_space }

// 查看审计小组对话框
const projectGroupsDialogVisible = ref(false)
const currentProjectGroups = ref([])

// 文本检索相关状态
const textSearchDialogVisible = ref(false)
const textSearchFileSelectVisible = ref(false)
const textSearchKeyword = ref('')
const textSearchSelectedFiles = ref([]) // 从文件选择对话框返回的文件列表
const textSearchSelectedFolders = ref([]) // 从文件选择对话框返回的文件夹列表（V2）
const textSearchAllowUnparsed = ref(false) // 未解析文件是否可选（由调用方控制）- 文本信息提取只选已解析文件
const textSearchCanSelectFileType = ref(['.pdf', '.doc', '.docx', '.txt']) // 可选文件后缀限制（由调用方控制）
const textSearchShowParseStatus = ref(true) // 是否显示解析状态列（由调用方控制）
const textSearchMatchedFiles = ref([]) // 后端预匹配后返回的文件列表
const textSearchHasSearched = ref(false) // 是否已执行过检索，用于决定下方表格显示“已选文件”还是“匹配结果”
const textSearchLoading = ref(false)
const textSearchExportLoading = ref(false)
const textSearchPreviewFile = ref(null)
const textSearchPreviewMarkdownHtml = ref('')
const textSearchPreviewIsSearchHighlight = ref(false)
const textSearchPreviewContentRef = ref(null)
const textSearchPreviewLoading = ref(false)

const textSearchMarkdownRenderer = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: false
})
textSearchMarkdownRenderer.use(markdownItGfmTables)
const showTextSearchToolbox = ref(false) // 控制工具箱下拉菜单显示
let toolboxCloseTimer = null // 工具箱关闭延迟定时器
// 缓存 file_id -> file_content，避免重复请求
const textSearchContentCache = new Map()
const textSearchTableRef = ref(null)
const textSearchSelectedIndex = ref(-1)
const textSearchTableSelectedRows = ref([]) // 表格勾选的数据

// 文本检索下方表格数据：未检索时显示已选文件，检索后显示匹配结果
const textSearchTableList = computed(() =>
  textSearchHasSearched.value ? textSearchMatchedFiles.value : textSearchSelectedFiles.value
)

// 表格首行预览：未检索下用于「进入弹框带列表 / 重选文件 / 清空检索结果」；检索成功后用于匹配列表首行（正则接口返回）
const schedulePreviewFirstTextSearchFile = () => {
  const tryFocus = (attemptsLeft) => {
    const list = textSearchTableList.value
    if (!list.length) return
    const tbl = textSearchTableRef.value
    if (tbl) {
      textSearchSelectedIndex.value = 0
      tbl.setCurrentRow(list[0])
      handleTextSearchRowClick(list[0])
      return
    }
    if (attemptsLeft <= 0) return
    nextTick(() => tryFocus(attemptsLeft - 1))
  }
  nextTick(() => {
    nextTick(() => tryFocus(12))
  })
}

// 关闭文本检索弹框时清空弹框内全部状态（下次进入为全新会话）
const resetTextSearchDialogState = () => {
  textSearchKeyword.value = ''
  textSearchFileSelectVisible.value = false
  textSearchSelectedFiles.value = []
  textSearchSelectedFolders.value = []
  textSearchMatchedFiles.value = []
  textSearchHasSearched.value = false
  textSearchLoading.value = false
  textSearchPreviewFile.value = null
  textSearchPreviewMarkdownHtml.value = ''
  textSearchPreviewIsSearchHighlight.value = false
  textSearchPreviewLoading.value = false
  textSearchSelectedIndex.value = -1
  textSearchContentCache.clear()
}

// 打开文本检索：先同步外部勾选，再打开；未检索下列表有数据时预览首行（触发点之一）
const openTextSearchDialog = () => {
  if (selectedFiles.value && selectedFiles.value.length > 0) {
    textSearchSelectedFiles.value = selectedFiles.value.map((f) => ({
      file_id: f.file_id,
      file_name: f.original_name || f.file_name || '',
      folder_path: f.folder_id ? getFileLocationLabel(f.folder_id) : (currentFolder.value ? getCurrentLocationLabel() : '')
    }))
    textSearchHasSearched.value = false
  }
  textSearchDialogVisible.value = true
  if (!textSearchHasSearched.value && textSearchSelectedFiles.value.length > 0) {
    schedulePreviewFirstTextSearchFile()
  }
}

import { useHomeStore } from '@/stores/home'
const homeStore = useHomeStore()
// 处理按钮 - 跳转任务中心
const handleGoToTaskCenter = () => {
  // 使用 homeStore 添加标签页并跳转（参考 LeftMenu 的实现方式）
  const basePath = '/task-center'

  // 从 menuTree 中查找 task-center 路由对应的菜单项，获取 menuId
  const menuItem = homeStore.findMenuItemByPath(basePath)
  let menuId = '751' // 默认值，如果查询不到则使用此值

  if (menuItem && menuItem.id) {
    menuId = String(menuItem.id)
  }

  // 构建带参数的路由路径
  const tabPath = `${basePath}?menuId=${menuId}`

  // 添加标签页（如果已存在会自动激活）
  homeStore.addTab({
    id: 'task-center',
    title: '任务中心',
    path: tabPath,
    name: '任务中心',
    meta: { title: '任务中心', keepAlive: true }
  })

  // 路由跳转（与 LeftMenu 中的实现保持一致）
  router.push(tabPath)
}

/**
 * 处理「更多」下拉菜单命令
 * @param {string} command - 菜单命令标识
 */
const handleMoreActionCommand = (command) => {
  if (command === 'reparse') {
    handleReparse()
    return
  }
  if (command === 'batchDelete') {
    handleBatchDelete()
    return
  }
  if (command === 'textSearch') {
    openTextSearchDialog()
    return
  }
  if (command === 'taskCenter') {
    handleGoToTaskCenter()
    return
  }
  if (command === 'showToolbox') {
    showToolbox.value = true
    return
  }
  if (command === 'hideToolbox') {
    showToolbox.value = false
  }
}

// 打开用于文本检索的文件选择对话框
const openTextSearchFileSelect = () => {
  console.log('[Index.vue] 打开文本信息提取文件选择对话框', {
    allowUnparsed: textSearchAllowUnparsed.value,
    canSelectFileType: textSearchCanSelectFileType.value,
    showParseStatus: textSearchShowParseStatus.value
  })
  textSearchFileSelectVisible.value = true
}

// 文件选择对话框确认：已选文件列表变化，未检索下预览首行（触发点之二）
const handleTextSearchFileConfirm = (payload) => {
  // V1: files[]
  // V2: { folders: [...], files: [...] }
  const files = Array.isArray(payload) ? payload : (payload?.files || [])
  const folders = Array.isArray(payload) ? [] : (payload?.folders || [])
  textSearchSelectedFiles.value = files || []
  textSearchSelectedFolders.value = folders || []
  textSearchHasSearched.value = false
  textSearchFileSelectVisible.value = false
  schedulePreviewFirstTextSearchFile()
}

// 清空文本检索已选文件
const handleClearTextSearchFiles = () => {
  textSearchSelectedFiles.value = []
  textSearchHasSearched.value = false
  textSearchPreviewFile.value = null
  textSearchPreviewMarkdownHtml.value = ''
  textSearchPreviewIsSearchHighlight.value = false
  textSearchSelectedIndex.value = -1
  textSearchMatchedFiles.value = []
  textSearchContentCache.clear()
  ElMessage.success('已清空已选文件')
}

// 清空检索结果：列表从匹配结果回到已选文件，未检索下预览首行（触发点之三）
const handleClearTextSearchResult = () => {
  textSearchHasSearched.value = false
  textSearchMatchedFiles.value = []
  textSearchKeyword.value = ''
  textSearchPreviewFile.value = null
  textSearchPreviewMarkdownHtml.value = ''
  textSearchPreviewIsSearchHighlight.value = false
  textSearchSelectedIndex.value = -1
  ElMessage.success('已清空搜索结果，显示全部已选文件')
  schedulePreviewFirstTextSearchFile()
}

// 文本检索：批量拉取 file_content 的上限（与后端 batch-content 一致）
const TEXT_SEARCH_BATCH_CONTENT_LIMIT = 100
// Excel 单单元格最大字符数（留少量余量）
const TEXT_SEARCH_EXCEL_CELL_MAX = 32700

/** 拉取文本检索导出所需的文件正文（优先缓存，否则 batch-content） */
const fetchTextSearchExportContents = async (list) => {
  const contentMap = new Map()
  const needFetch = []
  let failCount = 0

  for (const row of list) {
    if (textSearchContentCache.has(row.file_id)) {
      contentMap.set(row.file_id, textSearchContentCache.get(row.file_id))
    } else {
      needFetch.push(row.file_id)
    }
  }

  for (let i = 0; i < needFetch.length; i += TEXT_SEARCH_BATCH_CONTENT_LIMIT) {
    const chunk = needFetch.slice(i, i + TEXT_SEARCH_BATCH_CONTENT_LIMIT)
    try {
      const res = await getFilesContentBatchAPI({ file_ids: chunk })
      if (res?.code === 200 && Array.isArray(res?.data?.files)) {
        for (const fileItem of res.data.files) {
          const content = fileItem.found ? (fileItem.file_content ?? '') : ''
          contentMap.set(fileItem.file_id, content)
          textSearchContentCache.set(fileItem.file_id, content)
          if (!fileItem.found) {
            failCount += 1
          }
        }
      } else {
        failCount += chunk.length
        for (const fileId of chunk) {
          contentMap.set(fileId, '')
          textSearchContentCache.set(fileId, '')
        }
      }
    } catch {
      failCount += chunk.length
      for (const fileId of chunk) {
        contentMap.set(fileId, '')
        textSearchContentCache.set(fileId, '')
      }
    }
  }

  return { contentMap, failCount }
}

const handleTextSearchExportCommand = async (command) => {
  if (command === 'excel') {
    await handleExportTextSearchExcel()
  } else if (command === 'word') {
    await handleExportTextSearchDocx()
  }
}

// 文本检索：导出勾选文件为 Excel（浏览器直出下载，不经 MinIO）
const handleExportTextSearchExcel = async () => {
  const list = textSearchTableSelectedRows.value
  if (!list.length) {
    ElMessage.warning('请先选择要导出的文件')
    return
  }
  textSearchExportLoading.value = true
  try {
    const { contentMap, failCount } = await fetchTextSearchExportContents(list)
    const rows = list.map((row, i) => {
      const content = contentMap.get(row.file_id) ?? ''
      const truncated =
        content.length > TEXT_SEARCH_EXCEL_CELL_MAX
          ? `${content.slice(0, TEXT_SEARCH_EXCEL_CELL_MAX)}…(已截断)`
          : content
      return {
        序号: i + 1,
        文件名: row.file_name ?? '',
        文件路径: row.folder_path ?? '',
        文件内容: truncated
      }
    })
    const fileBase = `文档资料挖掘-文本检索-导出-${Date.now()}`
    exportFn([rows], ['文本检索导出'], fileBase)
    if (failCount > 0) {
      ElMessage.warning(`导出完成，有 ${failCount} 个文件内容获取失败，对应列为空`)
    } else {
      ElMessage.success('Excel 导出成功')
    }
  } catch (e) {
    console.error('文本检索导出 Excel 失败:', e)
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    textSearchExportLoading.value = false
  }
}

// 文本检索：导出勾选文件为 Word zip（浏览器直出下载，不经 MinIO）
const handleExportTextSearchDocx = async () => {
  const list = textSearchTableSelectedRows.value
  if (!list.length) {
    ElMessage.warning('请先选择要导出的文件')
    return
  }
  textSearchExportLoading.value = true
  try {
    const { contentMap, failCount } = await fetchTextSearchExportContents(list)
    const exportItems = list.map((row) => ({
      fileName: row.file_name ?? '',
      folderPath: row.folder_path ?? '',
      content: contentMap.get(row.file_id) ?? ''
    }))

    const zipName = `文档资料挖掘-文本检索-导出-${Date.now()}.zip`
    await exportTextSearchResultsAsZip(exportItems, zipName)

    if (failCount > 0) {
      ElMessage.warning(`导出完成，有 ${failCount} 个文件内容获取失败，对应 docx 为空`)
    } else {
      ElMessage.success(`已成功导出 ${list.length} 个 Word 文档`)
    }
  } catch (e) {
    console.error('文本检索导出 Word 失败:', e)
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    textSearchExportLoading.value = false
  }
}

// 执行文本检索：调用后端进行预匹配，只返回至少有一处匹配的文件
const handleDoTextSearch = async () => {
  const kw = (textSearchKeyword.value || '').trim()
  if (!kw) {
    ElMessage.warning('请输入搜索词（支持正则）')
    return
  }
  if (!textSearchSelectedFiles.value.length) {
    ElMessage.warning('请先选择要检索的文件')
    return
  }

  // 在前端先校验一次正则表达式语法，避免明显错误
  try {
    // 这里只是校验语法，不特别指定 flags

    new RegExp(kw)
  } catch (e) {
    ElMessage.error('无效的正则表达式，请检查后重试')
    return
  }

  const fileIds = textSearchSelectedFiles.value.map((f) => f.file_id).filter(Boolean)
  if (!fileIds.length) {
    ElMessage.warning('请选择有效的文件进行检索')
    return
  }

  textSearchLoading.value = true
  textSearchMatchedFiles.value = []
  textSearchPreviewFile.value = null
  textSearchPreviewMarkdownHtml.value = ''
  textSearchPreviewIsSearchHighlight.value = false
  textSearchPreviewLoading.value = false

  try {
    const res = await textSearchCheckFilesAPI({
      file_ids: fileIds,
      pattern: kw
    })
    if (res?.code === 200 && res?.data && Array.isArray(res.data.files)) {
      // 将后端返回的数据与本地文件选择信息合并，以补充 folder_path
      const metaMap = new Map(textSearchSelectedFiles.value.map((f) => [f.file_id, f]))
      textSearchMatchedFiles.value = res.data.files.map((f) => {
        const meta = metaMap.get(f.file_id) || {}
        return {
          file_id: f.file_id,
          file_name: f.file_name || meta.file_name || '',
          folder_path: meta.folder_path || '',
          match_count: f.match_count ?? 0
        }
      })
      textSearchHasSearched.value = true
      if (!textSearchMatchedFiles.value.length) {
        ElMessage.info('未在选中的文件中检索到匹配结果')
      } else {
        schedulePreviewFirstTextSearchFile()
      }
    } else {
      textSearchMatchedFiles.value = []
      textSearchHasSearched.value = true
      ElMessage.error(res?.msg || '文本检索失败')
    }
  } catch (error) {
    console.error('文本检索预匹配失败:', error)
    ElMessage.error(error?.response?.data?.msg || '文本检索预匹配失败')
  } finally {
    textSearchLoading.value = false
  }
}

// 键盘事件处理：上下方向键切换结果文件
const handleTextSearchKeydown = (e) => {
  if (!textSearchDialogVisible.value || !textSearchTableRef.value) return
  const list = textSearchTableList.value
  if (!list || list.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIndex = textSearchSelectedIndex.value < list.length - 1
      ? textSearchSelectedIndex.value + 1
      : 0
    selectTextSearchRowByIndex(nextIndex)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prevIndex = textSearchSelectedIndex.value > 0
      ? textSearchSelectedIndex.value - 1
      : list.length - 1
    selectTextSearchRowByIndex(prevIndex)
  }
}

// 按索引选中并加载预览
const selectTextSearchRowByIndex = (index) => {
  const list = textSearchTableList.value
  if (index < 0 || index >= list.length) return
  const row = list[index]
  textSearchSelectedIndex.value = index
  textSearchTableRef.value?.setCurrentRow(row)
  handleTextSearchRowClick(row)
}

// 文本检索右侧高亮展示用：转义后再包 mark，避免文件内容与 XSS
const escapeHtmlForTextSearch = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const renderTextSearchMarkdown = (content) => {
  const text = String(content ?? '')
  if (!text.trim()) return ''
  try {
    return textSearchMarkdownRenderer.render(text)
  } catch {
    return escapeHtmlForTextSearch(text).replace(/\n/g, '<br>')
  }
}

/** 在已渲染 Markdown 的 DOM 内对文本节点做正则高亮 */
const applyTextSearchHighlightInPreview = (container, keyword) => {
  if (!container || !keyword) return

  let regex
  try {
    regex = new RegExp(keyword, 'g')
  } catch {
    return
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes = []
  let node
  while ((node = walker.nextNode())) {
    if (node.parentElement && node.parentElement.tagName === 'MARK') continue
    textNodes.push(node)
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue || ''
    regex.lastIndex = 0
    if (!regex.test(text)) continue
    regex.lastIndex = 0

    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    let match
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
      }
      const mark = document.createElement('mark')
      mark.textContent = match[0]
      fragment.appendChild(mark)
      lastIndex = regex.lastIndex
      if (match.index === regex.lastIndex) regex.lastIndex++
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
    }
    textNode.parentNode?.replaceChild(fragment, textNode)
  }
}

// 表格勾选事件处理
const handleTextSearchSelectionChange = (selection) => {
  textSearchTableSelectedRows.value = selection
}

// 点击表格行：无搜索词时仅展示文件内容；有搜索词时拉取内容并正则高亮（安全拼接）
const handleTextSearchRowClick = async (row) => {
  if (!row || !row.file_id) return
  const list = textSearchTableList.value
  const idx = list.findIndex((f) => f.file_id === row.file_id)
  textSearchSelectedIndex.value = idx >= 0 ? idx : -1
  const kw = (textSearchKeyword.value || '').trim()

  textSearchPreviewFile.value = row
  textSearchPreviewLoading.value = true
  textSearchPreviewMarkdownHtml.value = ''
  textSearchPreviewIsSearchHighlight.value = false

  let content = textSearchContentCache.get(row.file_id)
  try {
    if (!content) {
      const res = await getFileContentAPI(row.file_id)
      if (res?.code === 200 && res?.data) {
        content = res.data.file_content || ''
        textSearchContentCache.set(row.file_id, content)
      } else {
        ElMessage.error(res?.msg || '获取文件内容失败')
        return
      }
    }

    const targetText = content
    textSearchPreviewMarkdownHtml.value = renderTextSearchMarkdown(targetText)

    if (!kw) return

    try {
      new RegExp(kw, 'g')
    } catch (e) {
      ElMessage.warning('前端正则解析失败，已显示原文')
      return
    }

    textSearchPreviewIsSearchHighlight.value = true
  } catch (error) {
    console.error('文本检索匹配失败:', error)
    ElMessage.error(error?.response?.data?.msg || '文本检索匹配失败')
  } finally {
    textSearchPreviewLoading.value = false
  }

  if (textSearchPreviewIsSearchHighlight.value && kw) {
    await nextTick()
    if (textSearchPreviewContentRef.value) {
      applyTextSearchHighlightInPreview(textSearchPreviewContentRef.value, kw)
    }
  }
}

// 文件夹对话框
const createFolderDialogVisible = ref(false)
const renameFolderDialogVisible = ref(false)
const createFolderForm = reactive({
  folder_name: '',
  parent_folder_id: null,
  is_system_builtin: false
})
const renameFolderForm = reactive({
  folder_name: ''
})

// 文件对话框
const renameFileDialogVisible = ref(false)
const moveFileDialogVisible = ref(false)
const renameFileForm = reactive({
  file_id: null,
  file_name: ''
})
const moveFileForm = reactive({
  file_id: null,
  target_folder_id: null
})
const renameFileLoading = ref(false)
const moveFileLoading = ref(false)

// 重名文件处理对话框
const duplicateDialogVisible = ref(false)
const duplicateFiles = ref([]) // [{ fileName, action: 'upload'|'skip' }]
const pendingFilesQueue = ref([]) // 待处理的文件队列

// 权限管理对话框
const permissionDialogVisible = ref(false)
const permissionLoading = ref(false)
const permissionList = ref([]) // 权限列表

// 授权权限对话框
const grantPermissionDialogVisible = ref(false)
const grantPermissionLoading = ref(false)
const grantPermissionForm = reactive({
  grantee_type: 'USER', // USER or ORG
  grantee_id: '',
  grantee_name: '',
  permission_type: 'READ', // FULL or READ
  can_delegate: false,
  include_org_descendants: false
})

// 用户搜索
const userSearchLoading = ref(false)
const userSearchResults = ref([])

// 机构列表（扁平化，用于兼容旧代码）
const orgList = ref([])
// 机构树数据（树形结构）
const orgTreeData = ref([])
/** 通过 GET /org/tree?rolecode=sjry（user_org 策略）解析出的用户所在单位 orguuid，供聚焦默认范围 */
const userLeafOrguuidFromSjry = ref(null)
let sjryOrgFetchPromise = null
/** manager/pkbadmin 完整子树，仅用于「根→用户叶子」路径计算；不依赖 ORG_TREE、不必先打开授权机构弹窗 */
const orgTreeForPathLookup = ref([])
let pathOrgTreeFetchPromise = null
/** GET /org/me/path：R1 根→叶 orguuid 列表；null 表示尚未拉取过 */
const userOrgAncestorUuidsFromApi = ref(null)
/** 同上接口返回的 leaf_orguuid，优先于 sjry 作为 getCurrentUserPrimaryOrguuid */
const userLeafOrguuidFromPathApi = ref(null)
let userOrgPathFetchPromise = null
// 机构树选择对话框显示状态
const showOrgTreeDialog = ref(false)
// 机构树属性配置
const orgTreeProps = {
  children: 'children',
  label: 'cnname'
}

// 绑定项目对话框
const bindProjectDialogVisible = ref(false)
const bindProjectLoading = ref(false)
const bindProjectForm = reactive({
  folder_id: null,
  project_uuid: null
})
const projectQuery = reactive({
  page: 1,
  page_size: 50,
  keyword: ''
})
const bindOrgDialogVisible = ref(false)
const bindOrgLoading = ref(false)
const bindOrgForm = reactive({
  folder_id: null,
  bound_org_uuid: null,
  grant_read_to_org: true,
  grant_read_include_descendants: false
})
const projectList = ref([]) // 项目列表

// 存储信息（当前仍采用前端默认配置，后续可通过个人空间接口动态加载）
const storageUsed = ref(0)
const storageTotal = ref(1024 * 1024 * 1024) // 默认 1GB

// 存储空间管理对话框
const showStorageDialog = ref(false)
const showUploadRecordsDialog = ref(false)
const activeStorageTab = ref('public') // 'public' 或 'users'
const publicSpaceStats = ref(null)
const publicSpaceStatsLoading = ref(false)
const usersStorageList = ref([])
const usersStorageLoading = ref(false)
const usersStorageCurrentPage = ref(1)
const usersStoragePageSize = ref(20)
const usersStorageTotal = ref(0)
const quotaEditDialog = reactive({
  visible: false,
  form: {
    user_id: '',
    user_name: '',
    limit_gb: 1.0
  }
})
const quotaFormRef = ref(null)

// 加载当前用户个人空间存储信息（用于左下角进度条）
// 使用动态导入，避免在构建期因为命名导出差异导致整页加载失败
const loadPersonalStorageInfo = async () => {
  try {
    const module = await import('@/api/fileManager.js')
    const apiFn = module.getPersonalStorageInfoAPI
    if (typeof apiFn !== 'function') {
      return
    }

    const res = await apiFn()
    if (res && res.code === 200 && res.data) {
      storageUsed.value = res.data.used || 0
      storageTotal.value = res.data.limit || (1024 * 1024 * 1024) // 默认 1GB
    }
  } catch (error) {
    // 统计信息加载失败不影响主流程，仅输出日志
    console.error('加载个人空间存储信息失败:', error)
  }
}

// 存储百分比计算
const storagePercentage = computed(() => {
  if (storageTotal.value === 0) return 0
  return Number(((storageUsed.value / storageTotal.value) * 100).toFixed(2))
})

// 存储百分比显示文本（xx.xx%格式）
const storagePercentageText = computed(() => {
  if (storageTotal.value === 0) return '0.00%'
  return ((storageUsed.value / storageTotal.value) * 100).toFixed(2) + '%'
})

// 存储进度条颜色
const storageProgressColor = computed(() => {
  const percentage = storagePercentage.value
  if (percentage >= 90) return '#f56c6c'
  if (percentage >= 70) return '#e6a23c'
  return '#409eff'
})

// 右侧工具箱
const showToolbox = ref(true)
const selectedFiles = ref([]) // 选中的文件列表
/** 已选文件汇总弹窗显隐 */
const selectedFilesSummaryDialogVisible = ref(false)
/** 已选文件弹窗内表格实例，用于清空勾选等 */
const selectedFilesSummaryTableRef = ref(null)
/** 已选文件弹窗表格当前勾选行（用于批量删除） */
const selectedFilesSummaryTableSelection = ref([])
const batchDeleting = ref(false) // 批量删除加载状态
const reparseLoading = ref(false) // 重新解析加载状态

// 文件预览对话框
const showPreviewDialog = ref(false)
const previewFileType = ref('')
const previewFileName = ref('')
const previewFileData = ref(null)
/** 当前预览行（用于右侧 parse_status 判断） */
const previewFileRow = ref(null)
const previewParsedMarkdownHtml = ref('')
/** 解析结果原始 Markdown 文本（导出用） */
const previewParsedMarkdownRaw = ref('')
const previewParsedLoading = ref(false)
/** 预览弹窗导出 loading（导出期间禁用导出按钮） */
const previewExportLoading = ref(false)
/** 双栏各自滚动区高度（预留给标题栏与弹窗头尾） */
const previewPaneScrollHeight = 'calc(90vh - 120px)'

const resetPreviewParsedState = () => {
  previewFileRow.value = null
  previewParsedMarkdownHtml.value = ''
  previewParsedMarkdownRaw.value = ''
  previewParsedLoading.value = false
  previewExportLoading.value = false
}

/** 右侧栏：解析完成则拉取 FILE_CONTENT 并 Markdown 渲染，否则展示「暂无解析结果」 */
const loadPreviewParsedContent = async (row) => {
  previewParsedMarkdownHtml.value = ''
  previewParsedMarkdownRaw.value = ''
  if (!row || !row.file_id) return
  // resolveStatusValue 在 setup 末尾解构，运行时已可用；解析完成 = '2'
  if (resolveStatusValue(row) !== '2') return

  const requestFileId = row.file_id
  previewParsedLoading.value = true
  try {
    const res = await getFileContentAPI(row.file_id)
    // 弹窗已切到其他文件则丢弃本次结果
    if (previewFileRow.value?.file_id !== requestFileId) return
    if (res?.code === 200 && res?.data) {
      const content = res.data.file_content || ''
      if (String(content).trim()) {
        previewParsedMarkdownRaw.value = content
        previewParsedMarkdownHtml.value = renderTextSearchMarkdown(content)
      }
    }
  } catch (error) {
    console.error('预览解析结果加载失败:', error)
  } finally {
    if (previewFileRow.value?.file_id === requestFileId) {
      previewParsedLoading.value = false
    }
  }
}

// 预览弹窗：导出解析结果（Excel / Word / Markdown）
const handlePreviewExportCommand = async (command) => {
  if (!previewParsedMarkdownRaw.value || previewExportLoading.value) return
  if (command === 'excel') exportPreviewAsExcel()
  else if (command === 'word') await exportPreviewAsWord()
  else if (command === 'markdown') await exportPreviewAsMarkdown()
}

// 预览弹窗：导出 Excel（单个 xlsx，行结构与文本检索导出一致）
const exportPreviewAsExcel = () => {
  const content = previewParsedMarkdownRaw.value
  const truncated =
    content.length > TEXT_SEARCH_EXCEL_CELL_MAX
      ? `${content.slice(0, TEXT_SEARCH_EXCEL_CELL_MAX)}…(已截断)`
      : content
  const rows = [{
    序号: 1,
    文件名: previewFileName.value,
    文件路径: previewFileRow.value?.folder_path ?? '',
    文件内容: truncated,
  }]
  const fileBase = `文档资料挖掘-导出-${Date.now()}`
  exportFn([rows], ['导出'], fileBase)
  ElMessage.success('Excel 导出成功')
}

// 预览弹窗：导出 Word（单文件场景直接下载 .docx，与文本检索导出一致为纯文本，不打 zip）
const exportPreviewAsWord = async () => {
  previewExportLoading.value = true
  try {
    await exportPlainTextDocxFile(previewFileName.value, previewParsedMarkdownRaw.value)
    ElMessage.success('已成功导出 Word 文档')
  } catch (e) {
    console.error('预览导出 Word 失败:', e)
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    previewExportLoading.value = false
  }
}

// 预览弹窗：导出 Markdown（单文件场景直接下载 .md，不打 zip）
const exportPreviewAsMarkdown = async () => {
  previewExportLoading.value = true
  try {
    exportMarkdownFile(previewFileName.value, previewParsedMarkdownRaw.value)
    ElMessage.success('已成功导出 Markdown 文件')
  } catch (e) {
    console.error('预览导出 Markdown 失败:', e)
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    previewExportLoading.value = false
  }
}

// 文件内容查看对话框（展示 FILE_CONTENT）
const showFileContentDialog = ref(false)
const fileContentTitle = ref('文件内容')
const currentFileContent = ref('')
const fileContentLoading = ref(false)

// 文档预览全屏弹窗
const showDocumentPreviewDialog = ref(false)
const documentPreviewParams = ref({
  tool: '',
  toolLabel: '',
  files: '',
  names: '',
  folder_id: '',
  /** 待摊费用等：批量执行创建的任务 UUID，用于阶段②继续执行 */
  taskId: ''
})

// 任务进度加载状态管理
const taskProgressLoading = ref(false)
const taskProgressElapsedTime = ref(0)
const taskProgressText = ref('任务执行中... 0.0s')
const taskProgressRuntimeNodes = ref([])
const currentTaskUuid = ref(null)
let taskProgressTimer = null
let taskProgressPollTimeout = null
/** 中止进行中的 GetTaskSchedules 请求，避免关闭弹窗后占用连接 */
let taskProgressAbortController = null
/** 每轮进度追踪递增，丢弃泄漏/重叠的 setInterval 与 await 之后的陈旧回调 */
let taskProgressPollToken = 0
/** 进度会话代次：finishTaskProgress 递增，陈旧 poll/emit 无法启动新轮询 */
let taskProgressSessionId = 0
const TASK_POLL_INTERVAL_MS = 2000
/** 待摊费用：阶段①完成提示去重 */
let prepaidProgressLastNotifiedPhase = ''
let prepaidProgressLastTaskUuid = ''

/** 待摊费用：关弹窗后后台追踪 */
let prepaidBackgroundPollToken = 0
let prepaidBackgroundPollTimeout = null
let prepaidBackgroundAbortController = null
const prepaidBackgroundNotifiedKeys = new Set()
const prepaidBackgroundWatchVisible = ref(false)
const PREPAID_BACKGROUND_POLL_MS = 2000
/** 待摊费用任务仍在执行，关弹窗后需后台追踪 */
let prepaidNeedsBackgroundWatch = false

// 悬浮球状态管理
const taskProgressFloatingVisible = ref(false)
const showFloatingBall = () => {
  taskProgressLoading.value = false
  taskProgressFloatingVisible.value = true
}
const hideFloatingBallAndShowProgress = () => {
  taskProgressFloatingVisible.value = false
  taskProgressLoading.value = true
}
/**
 * 关闭任务进度遮罩；待摊费用最小化为悬浮球并保留轮询，其他工具停止轮询
 * @returns {void}
 */
const dismissTaskProgressOverlay = () => {
  if (documentPreviewParams.value.tool === 'prepaidExpenses') {
    showFloatingBall()
    return
  }
  finishTaskProgress()
}

/**
 * 关闭任务进度遮罩并停止 GetTaskSchedules 轮询
 * @returns {void}
 */
const dismissTaskProgress = () => {
  finishTaskProgress()
}

// 文件上传
const uploadRef = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)
// 上传任务列表（支持多文件同时上传）
// status: uploading | success | error
// phase: upload(上传字节) | processing(等待服务端写存储+file_content) | done(完成)
const uploadTasks = ref([])
const uploadPanelCollapsed = ref(false)
const UPLOAD_COLLAPSED_BALL_SIZE = 48
const uploadCollapsedBallPos = ref(null)
let uploadCollapsedDragState = null

const getDefaultCollapsedBallPos = () => ({
  top: 20,
  left: Math.max(20, window.innerWidth - 20 - UPLOAD_COLLAPSED_BALL_SIZE)
})

const uploadCollapsedBallStyle = computed(() => {
  const pos = uploadCollapsedBallPos.value || getDefaultCollapsedBallPos()
  return {
    top: `${pos.top}px`,
    left: `${pos.left}px`,
    right: 'auto'
  }
})

const clampCollapsedBallPos = (top, left) => {
  const maxLeft = Math.max(0, window.innerWidth - UPLOAD_COLLAPSED_BALL_SIZE)
  const maxTop = Math.max(0, window.innerHeight - UPLOAD_COLLAPSED_BALL_SIZE)
  return {
    top: Math.min(Math.max(0, top), maxTop),
    left: Math.min(Math.max(0, left), maxLeft)
  }
}

const cleanupUploadCollapsedBallDrag = () => {
  uploadCollapsedDragState = null
  document.removeEventListener('mousemove', handleUploadCollapsedBallMouseMove)
  document.removeEventListener('mouseup', handleUploadCollapsedBallMouseUp)
}

const handleUploadCollapsedBallMouseMove = (e) => {
  if (!uploadCollapsedDragState) return
  const dx = e.clientX - uploadCollapsedDragState.startX
  const dy = e.clientY - uploadCollapsedDragState.startY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    uploadCollapsedDragState.moved = true
  }
  uploadCollapsedBallPos.value = clampCollapsedBallPos(
    uploadCollapsedDragState.startTop + dy,
    uploadCollapsedDragState.startLeft + dx
  )
}

const handleUploadCollapsedBallMouseUp = () => {
  if (!uploadCollapsedDragState) return
  const moved = uploadCollapsedDragState.moved
  cleanupUploadCollapsedBallDrag()
  if (!moved) {
    uploadPanelCollapsed.value = false
  }
}

const handleUploadCollapsedBallMouseDown = (e) => {
  if (e.button !== 0) return
  e.preventDefault()
  const pos = uploadCollapsedBallPos.value || getDefaultCollapsedBallPos()
  if (!uploadCollapsedBallPos.value) {
    uploadCollapsedBallPos.value = { ...pos }
  }
  uploadCollapsedDragState = {
    startX: e.clientX,
    startY: e.clientY,
    startTop: pos.top,
    startLeft: pos.left,
    moved: false
  }
  document.addEventListener('mousemove', handleUploadCollapsedBallMouseMove)
  document.addEventListener('mouseup', handleUploadCollapsedBallMouseUp)
}

watch(uploadPanelCollapsed, (collapsed) => {
  if (collapsed && !uploadCollapsedBallPos.value) {
    uploadCollapsedBallPos.value = getDefaultCollapsedBallPos()
  }
})

const uploadActiveTaskCount = computed(() =>
  uploadTasks.value.filter((t) => t.status === 'uploading').length
)

const groupedUploadTasks = computed(() => {
  const groups = []
  const folderMap = {}
  const standalone = []
  uploadTasks.value.forEach(task => {
    const rp = task.relativePath || ''
    if (rp && rp.includes('/')) {
      const parts = rp.split('/')
      const folderKey = parts.slice(0, parts.length - 1).join('/')
      if (!folderMap[folderKey]) {
        folderMap[folderKey] = {
          folderName: folderKey,
          tasks: []
        }
        groups.push(folderMap[folderKey])
      }
      folderMap[folderKey].tasks.push(task)
    } else {
      standalone.push(task)
    }
  })
  return { groups, standalone }
})

const uploadSummaryVisible = ref(false)
const skippedFiles = ref([])

const isPrivateMode = ref(false)
const uploadRecoveryVisible = ref(false)
const uploadRecoveryRecords = ref([])
const uploadRecoveryFileInputVisible = ref(false)
const uploadRecoveryPendingFileRecord = ref(null)
const uploadRecoveryPendingFileRecords = ref([])
const uploadRecoveryFileInputRef = ref(null)
const uploadRecoveryFolderInputVisible = ref(false)
const pendingSingleFileRecoveryInFolder = ref(null)

const uploadRecoveryFileQueueHint = computed(() => {
  const queue = uploadRecoveryPendingFileRecords.value
  const current = uploadRecoveryPendingFileRecord.value
  if (!current || queue.length <= 1) return ''
  const idx = queue.findIndex((r) => r.id === current.id)
  if (idx < 0) return ''
  return `待恢复 ${queue.length} 个文件，当前为第 ${idx + 1} 个。`
})
const uploadRecoveryPendingRecord = ref(null)
const uploadRecoveryFolderInputRef = ref(null)
const currentDirectoryHandle = ref(null)

/** 文件夹上传时取纯文件名（不含路径），避免 webkitdirectory 将相对路径写入 multipart filename */
const getUploadBaseName = (file, relativePath = '') => {
  const rp = relativePath || file?.webkitRelativePath || file?.relativePath || ''
  if (rp) {
    const base = rp.split('/').filter(Boolean).pop()
    if (base) return base
  }
  const name = file?.name || ''
  if (name.includes('/') || name.includes('\\')) {
    return name.split(/[/\\]/).pop()
  }
  return name
}

/** 重名检测统一按纯文件名（不含路径）比较，兼容历史数据中带路径前缀的 file_name */
const normalizeNameForDuplicateCheck = (name) => {
  if (!name) return ''
  const parts = String(name).replace(/\\/g, '/').split('/').filter(Boolean)
  return (parts[parts.length - 1] || '').toLowerCase()
}

const computeFileHash = (file) => {
  return new Promise((resolve, reject) => {
    const chunkSize = 2 * 1024 * 1024
    const chunks = Math.max(1, Math.ceil(file.size / chunkSize))
    let currentChunk = 0
    const reader = new FileReader()
    const sha256 = CryptoJS.algo.SHA256.create()

    const appendBuffer = (arrayBuffer) => {
      sha256.update(CryptoJS.lib.WordArray.create(arrayBuffer))
    }

    reader.onload = (e) => {
      try {
        appendBuffer(e.target.result)
        currentChunk++
        if (currentChunk < chunks) {
          loadNext()
        } else {
          resolve(sha256.finalize().toString(CryptoJS.enc.Hex))
        }
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = () => reject(reader.error)

    const loadNext = () => {
      const start = currentChunk * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      reader.readAsArrayBuffer(file.slice(start, end))
    }

    if (file.size === 0) {
      resolve(CryptoJS.SHA256('').toString(CryptoJS.enc.Hex))
      return
    }

    loadNext()
  })
}

const beforeUnloadHandler = (event) => {
  const hasUploading = uploadTasks.value.some(t => t.status === 'uploading')
  if (hasUploading) {
    event.preventDefault()
    event.returnValue = ''
  }
}

window.addEventListener('beforeunload', beforeUnloadHandler)

const updateBeforeUnloadListener = () => {
  const hasUploading = uploadTasks.value.some(t => t.status === 'uploading')
  if (!hasUploading) {
    window.removeEventListener('beforeunload', beforeUnloadHandler)
  } else {
    window.addEventListener('beforeunload', beforeUnloadHandler)
  }
}

/** 上传进度 100% 后、等待 HTTP 响应期间的说明（与后端是否调 OCR 大致一致） */
const getUploadPostProgressLabel = (fileName) => {
  const n = (fileName || '').toLowerCase()
  const dot = n.lastIndexOf('.')
  const ext = dot >= 0 ? n.slice(dot) : ''
  const localOnly = new Set([
    '.txt', '.csv', '.md', '.json', '.xml', '.html', '.htm', '.log',
    '.yml', '.yaml', '.properties', '.ini', '.tsv', '.xlsx', '.xlsm', '.svg'
  ])
  if (localOnly.has(ext)) {
    return '正在提取内容…'
  }
  const imageExt = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.heic', '.heif'
  ])
  if (imageExt.has(ext)) {
    return 'OCR 识别中…'
  }
  if (ext === '.doc' || ext === '.xls') {
    return 'OCR 识别中…'
  }
  if (ext === '.pdf') {
    return '正在处理 PDF…'
  }
  if (ext === '.docx' || ext === '.pptx' || ext === '.odt' || ext === '.ods' || ext === '.odp') {
    return '正在处理文档…'
  }
  return '服务器处理中…'
}

// 待上传文件队列（用于重名检查）
const pendingUploadFiles = ref([]) // [{ file, action: 'upload'|'skip'|'overwrite' }]
// 重名处理策略（全覆盖/全跳过）
const duplicateStrategy = ref(null) // 'all-overwrite' | 'all-skip' | null

// 表格引用
const tableRef = ref(null)

// 单文件删除加载状态（当前正在删除的文件ID）
const deletingFileId = ref(null)

// 附件弹窗相关
const attachmentDialogVisible = ref(false)
const attachmentDialogFileId = ref('')
const attachmentDialogFileName = ref('')

/** 附件候选：当前文件列表中的文件 */
const availableAttachmentFiles = computed(() => {
  return (fileList.value || [])
    .filter((f) => f && f.file_id)
    .map((f) => ({
      file_id: f.file_id,
      name: f.original_name || f.file_name || '未命名',
      size: f.file_size || 0
    }))
})

// 打开附件管理弹窗
const openAttachmentDialog = async (row) => {
  attachmentDialogFileId.value = row.file_id
  attachmentDialogFileName.value = row.original_name || row.file_name || '未命名文件'
  attachmentDialogVisible.value = true
}

// 附件列表变化（添加或移除后）刷新当前文件列表
const onAttachmentListChange = () => {
  // 若后续需要同步刷新左侧文件树等可扩展此处
}

// 公共空间文件总大小（字节），null 表示未计算，0 表示已计算但无文件
const publicSpaceTotalSize = ref(null)
/** 旧 merged-spaces 列表缓存清理占位（已无合并首屏，保留调用处兼容） */
const invalidateMergedSpacesCache = () => {}

/** loadFileList 并发序号：仅最新一次请求可写入 fileList / total，避免聚焦同步与个人空间首拉竞态覆盖 */
let loadFileListRequestSeq = 0
/** by-space 请求去重：同 key 在飞复用；短时间内同 key 重入直接跳过，避免首屏/切换并发重入 */
let bySpaceInFlight = null
let bySpaceInFlightKey = ''
let bySpaceLastHitAt = 0
const BY_SPACE_DEDUP_WINDOW_MS = 1200
// 左侧文件夹树宽度（可拖拽调整）
const sidebarWidth = ref(280)
let isResizing = false
let startX = 0
let startWidth = 0

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化公共空间文件总大小（小于1GB时用MB，大于等于1GB时用GB）
const formatPublicSpaceTotalSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 MB'
  const gb = 1024 * 1024 * 1024 // 1GB = 1024^3 字节
  const mb = 1024 * 1024 // 1MB = 1024^2 字节

  if (bytes >= gb) {
    // 大于等于1GB时，用GB显示
    return parseFloat((bytes / gb).toFixed(2)) + ' GB'
  } else {
    // 小于1GB时，用MB显示
    return parseFloat((bytes / mb).toFixed(2)) + ' MB'
  }
}

// 格式化存储大小
const formatStorage = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

// ==================== 存储空间管理功能 ====================

// 打开存储空间管理对话框
const handleStorageManagement = () => {
  showStorageDialog.value = true
  activeStorageTab.value = 'public'
  loadPublicSpaceStats()
  loadUsersStorageInfo()
}

// 跳转标签管理页面
const handleGoToTagManagement = () => {
  router.push('/tag-management')
}

/**
 * 打开文件上传记录弹窗（全屏）。
 * @param {void} 无参数。
 * @returns {void} 无返回值。
 */
const handleGoToUploadRecords = () => {
  showUploadRecordsDialog.value = true
}

// 加载公共空间统计
const loadPublicSpaceStats = async () => {
  publicSpaceStatsLoading.value = true
  try {
    const res = await getPublicSpaceStatsAPI()
    if (res.code === 200) {
      publicSpaceStats.value = res.data
    }
  } catch (error) {
    ElMessage.error('加载公共空间统计失败')
    console.error(error)
  } finally {
    publicSpaceStatsLoading.value = false
  }
}

// 加载所有用户存储信息
const loadUsersStorageInfo = async () => {
  usersStorageLoading.value = true
  try {
    const res = await getAllUsersStorageInfoAPI()

    if (res.code === 200) {
      const users = res.data || []
      usersStorageList.value = users
      usersStorageTotal.value = users.length
      // 重置到第一页
      usersStorageCurrentPage.value = 1

      if (users.length === 0) {
        ElMessage.warning('未获取到用户数据，请检查数据库中是否有用户')
      }
    } else {
      ElMessage.error(res.message || '加载用户存储信息失败')
    }
  } catch (error) {
    console.error('[用户存储管理] 加载用户存储信息异常:', error)
    console.error('[用户存储管理] 错误详情:', error.response || error.message)
    ElMessage.error('加载用户存储信息失败: ' + (error.message || '未知错误'))
  } finally {
    usersStorageLoading.value = false
  }
}

// 分页后的用户存储列表
const paginatedUsersStorageList = computed(() => {
  const start = (usersStorageCurrentPage.value - 1) * usersStoragePageSize.value
  const end = start + usersStoragePageSize.value
  return usersStorageList.value.slice(start, end)
})

// 分页变化处理
const handleUsersStoragePageChange = (page) => {
  usersStorageCurrentPage.value = page
}

// 每页数量变化处理
const handleUsersStorageSizeChange = (size) => {
  usersStoragePageSize.value = size
  usersStorageCurrentPage.value = 1 // 重置到第一页
}

// 打开编辑额度对话框
const openQuotaEditDialog = (row) => {
  quotaEditDialog.form = {
    user_id: row.user_id,
    user_name: row.user_name,
    limit_gb: row.limit_gb || 1.0
  }
  quotaEditDialog.visible = true
}

// 提交额度设置
const submitQuotaEdit = async () => {
  if (!quotaFormRef.value) return

  await quotaFormRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      await setUserStorageQuotaAPI(quotaEditDialog.form.user_id, quotaEditDialog.form.limit_gb)
      ElMessage.success('设置成功')
      quotaEditDialog.visible = false
      loadUsersStorageInfo()
    } catch (error) {
      ElMessage.error(error.message || '设置失败')
      console.error(error)
    }
  })
}

// 格式化用户存储大小
const formatUserStorageSize = (bytes) => {
  if (!bytes && bytes !== 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}
const getUnitFromBytes = (bytes) => {
  if (!bytes || bytes === 0) return 'B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return sizes[i] || 'B'
}

// 格式化存储日期
const formatStorageDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化日期时间
const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '-'
  const date = new Date(dateTimeStr)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return minutes <= 0 ? '刚刚' : `${minutes}分钟前`
    }
    return `${hours}小时前`
  } else if (days === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
}

// 获取文件扩展名
const getFileExtension = (fileName) => {
  if (!fileName) return ''
  const lastDot = fileName.lastIndexOf('.')
  return lastDot > -1 ? fileName.substring(lastDot + 1).toLowerCase() : ''
}

// 获取文件图标（参考腾讯文档风格）
const getFileIcon = (mimeType, fileName = '') => {
  const ext = getFileExtension(fileName)

  // 图片类型
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return Picture
  }

  // 视频类型
  if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) {
    return VideoCamera
  }

  // 音频类型
  if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return VideoCamera
  }

  // PDF文档 - 红色
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return Document
  }

  // Word文档 - 蓝色 (.doc, .docx)
  if (mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ['doc', 'docx'].includes(ext)) {
    return Document
  }

  // Excel表格 - 绿色 (.xls, .xlsx)
  if (mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      ['xls', 'xlsx', 'csv'].includes(ext)) {
    return FolderOpened
  }

  // PowerPoint演示文稿 - 橙色 (.ppt, .pptx)
  if (mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ['ppt', 'pptx'].includes(ext)) {
    return FolderOpened
  }

  // 文本文件
  if (mimeType?.startsWith('text/') || ['txt', 'md', 'log', 'ini', 'conf'].includes(ext)) {
    return Notebook
  }

  // 压缩文件
  if (mimeType === 'application/zip' ||
      mimeType === 'application/x-rar-compressed' ||
      mimeType === 'application/x-7z-compressed' ||
      mimeType === 'application/x-tar' ||
      mimeType === 'application/gzip' ||
      ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return Link
  }

  // 默认文档图标
  return Document
}

// 获取文件图标颜色（参考腾讯文档风格）
const getFileIconColor = (mimeType, fileName = '') => {
  const ext = getFileExtension(fileName)

  // 图片类型 - 绿色 #67C23A
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return '#67C23A'
  }

  // 视频类型 - 橙色 #E6A23C
  if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) {
    return '#E6A23C'
  }

  // 音频类型 - 紫色 #9C27B0
  if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return '#9C27B0'
  }

  // PDF文档 - 红色 #F56C6C
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return '#F56C6C'
  }

  // Word文档 - 蓝色 #409EFF
  if (mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ['doc', 'docx'].includes(ext)) {
    return '#409EFF'
  }

  // Excel表格 - 绿色 #67C23A
  if (mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      ['xls', 'xlsx', 'csv'].includes(ext)) {
    return '#67C23A'
  }

  // PowerPoint演示文稿 - 橙色 #E6A23C
  if (mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ['ppt', 'pptx'].includes(ext)) {
    return '#E6A23C'
  }

  // 文本文件 - 灰色 #909399
  if (mimeType?.startsWith('text/') || ['txt', 'md', 'log', 'ini', 'conf'].includes(ext)) {
    return '#909399'
  }

  // 压缩文件 - 棕色 #8B4513
  if (mimeType === 'application/zip' ||
      mimeType === 'application/x-rar-compressed' ||
      mimeType === 'application/x-7z-compressed' ||
      mimeType === 'application/x-tar' ||
      mimeType === 'application/gzip' ||
      ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return '#8B4513'
  }

  // 默认蓝色
  return '#409EFF'
}

// 加载文件空间类型（从数据字典 file_space_type 读取）
// 使用动态导入，避免在构建期因为命名导出差异导致整页加载失败
const loadSpaceTypes = async () => {
  try {
    const module = await import('@/api/fileManager.js')
    const apiFn = module.getFileSpaceTypesAPI

    let res = null

    if (typeof apiFn === 'function') {
      // 优先使用封装好的 API 函数
      res = await apiFn()
    } else {
      // 如果封装 API 不存在，则直接使用 fetch 调用数据字典接口
      try {
        const token = getToken()
        const resp = await fetch('/api/v1/dict-types/code/file_space_type/items?status=1&tree=false', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Agent-Token': token } : {})
          }
        })
        const json = await resp.json()
        res = json
      } catch (e) {
        res = null
      }
    }
    if (res.code === 200 && Array.isArray(res.data)) {
      // 按 sort_order 排序，越小越靠前
      const sorted = [...res.data].sort((a, b) => {
        const aOrder = typeof a.sort_order === 'number' ? a.sort_order : 0
        const bOrder = typeof b.sort_order === 'number' ? b.sort_order : 0
        return aOrder - bOrder
      })
      spaceList.value = sorted

      const codes = sorted.map(item => item.key_code).filter(Boolean)
      // 当前空间类型不在字典中时，默认优先个人空间，其次公共
      if (!codes.includes(currentSpaceType.value)) {
        if (codes.includes('PERSONAL')) {
          currentSpaceType.value = 'PERSONAL'
        } else if (codes.includes('PUBLIC')) {
          currentSpaceType.value = 'PUBLIC'
        } else if (codes.length > 0) {
          currentSpaceType.value = codes[0]
        }
      }
    } else {
      // 如果字典未配置，使用默认的公共/个人空间配置兜底
      spaceList.value = [
        { key_code: 'PUBLIC', label: '公共空间', sort_order: 10 },
        { key_code: 'PERSONAL', label: '个人空间', sort_order: 20 }
      ]
    }
  } catch (error) {
    console.error('加载文件空间类型失败:', error)
    // 出错时使用默认配置兜底，避免页面不可用
    if (spaceList.value.length === 0) {
      spaceList.value = [
        { key_code: 'PUBLIC', label: '公共空间', sort_order: 10 },
        { key_code: 'PERSONAL', label: '个人空间', sort_order: 20 }
      ]
    }
  }
}

// 原型：在 PUBLIC 空间下注入「示例客户单位 -> 定期报送资料」演示结构（若不存在）
const injectPrototypeDingqiBaoSong = (treeData) => {
  const publicSpace = treeData.find(n => n.id === 'space_PUBLIC' && n.folder_type === 'PUBLIC')
  if (!publicSpace || !publicSpace.children) return
  const hasDingqi = (nodes) => {
    for (const n of nodes) {
      if (n.name === '定期报送资料') return true
      if (n.children?.length && hasDingqi(n.children)) return true
    }
    return false
  }
  if (hasDingqi(publicSpace.children)) return
  const dingqiId = 'oss_proto_dingqi_demoAudit'
  const demoAuditId = 'oss_proto_demoAudit'
  const dingqiNode = {
    name: '定期报送资料',
    id: dingqiId,
    parent_folder_id: demoAuditId,
    folder_type: 'PUBLIC',
    isSpaceRoot: false,
    permission: 'FULL',
    can_delegate: true,
    is_creator: true,
    source: 'oss_proto',
    children: []
  }
  const demoAuditNode = {
    name: '示例客户单位',
    id: demoAuditId,
    parent_folder_id: null,
    folder_type: 'PUBLIC',
    isSpaceRoot: false,
    permission: 'FULL',
    can_delegate: true,
    is_creator: true,
    source: 'oss_proto',
    children: [dingqiNode]
  }
  publicSpace.children.unshift(demoAuditNode)
  expandedKeys.value.push(demoAuditId, dingqiId)
}

// 将 OSS 节点转为树节点格式（含权限字段）
const ossNodeToTreeNode = (ossNode, parentId, folderType, ossPathPrefix) => {
  const path = ossPathPrefix ? `${ossPathPrefix}/${ossNode.name}` : ossNode.name
  const id = `oss_${path.replace(/\//g, '_')}`
  const children = (ossNode.children || []).map(c => ossNodeToTreeNode(c, id, folderType, path))
  return {
    name: ossNode.name,
    id,
    parent_folder_id: parentId,
    folder_type: folderType,
    isSpaceRoot: false,
    permission: 'FULL',
    can_delegate: true,
    is_creator: true,
    source: 'oss',
    oss_path: path,
    ossMissing: false,
    children
  }
}

// 递归收集 OSS 树节点下所有 oss_path
const collectOssPaths = (nodes) => {
  const paths = new Set()
  const walk = (n) => {
    if (n.oss_path) paths.add(n.oss_path)
    ;(n.children || []).forEach(walk)
  }
  nodes.forEach(walk)
  return paths
}

// 递归收集 OSS 树中所有「定期报送资料」节点
const findAllDingqiInOss = (nodes, rootName, pathPrefix = '') => {
  const result = []
  for (const n of nodes || []) {
    const p = pathPrefix ? `${pathPrefix}/${n.name}` : (rootName ? `${rootName}/${n.name}` : n.name)
    if (n.name === '定期报送资料') {
      result.push({ path: p, node: n })
    }
    if (n.children?.length) {
      result.push(...findAllDingqiInOss(n.children, null, p))
    }
  }
  return result
}

// 确保前端树中存在指定路径（如 示例市甲审计局/市审计局本级/定期报送资料），返回 定期报送资料 节点
const ensurePathAndGetDingqi = (publicSpace, pathParts) => {
  if (!publicSpace?.children) return null
  let current = publicSpace
  const ids = []
  for (let i = 0; i < pathParts.length; i++) {
    const name = pathParts[i]
    let child = current.children?.find(c => c.name === name)
    if (!child) {
      const safeId = pathParts.slice(0, i + 1).join('_').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
      const nodeId = `oss_proto_${safeId}`
      child = {
        name,
        id: nodeId,
        parent_folder_id: ids[i - 1] || null,
        folder_type: 'PUBLIC',
        isSpaceRoot: false,
        permission: 'FULL',
        can_delegate: true,
        is_creator: true,
        source: 'oss_proto',
        children: []
      }
      if (!current.children) current.children = []
      current.children.push(child)
      expandedKeys.value.push(nodeId)
    }
    ids.push(child.id)
    current = child
  }
  return current
}

// 合并 OSS 数据到「定期报送资料」节点，并标记 ossMissing（支持递归查找 定期报送资料）
const mergeOssIntoTree = (treeData, ossData, previousPaths) => {
  const added = []
  const removed = []
  const allNewPaths = new Set()
  const publicSpace = treeData.find(n => n.id === 'space_PUBLIC')
  const rootName = ossData?.root || 'xxoss'

  const dingqiList = findAllDingqiInOss(ossData?.children || [], rootName)
  for (const { path: ossPath, node: ossDingqi } of dingqiList) {
    const pathWithoutDingqi = ossPath.replace(/\/定期报送资料$/, '')
    const pathParts = pathWithoutDingqi.replace(rootName + '/', '').split('/').filter(Boolean)
    pathParts.push('定期报送资料')
    const dingqiNode = ensurePathAndGetDingqi(publicSpace, pathParts)
    if (!dingqiNode) continue

    const newOssChildren = (ossDingqi?.children || []).map(c => ossNodeToTreeNode(c, dingqiNode.id, 'PUBLIC', ossPath))
    const newPaths = collectOssPaths(newOssChildren)
    newPaths.forEach(p => allNewPaths.add(p))
    const curOssChildren = (dingqiNode.children || []).filter(c => c.source === 'oss')
    const markMissing = (n) => ({ ...n, ossMissing: true, children: (n.children || []).map(markMissing) })
    const keptMissing = curOssChildren
      .filter(c => previousPaths.has(c.oss_path) && !newPaths.has(c.oss_path))
      .map(markMissing)
    curOssChildren.filter(c => previousPaths.has(c.oss_path) && !newPaths.has(c.oss_path)).forEach(c => removed.push(c.oss_path))
    newOssChildren.forEach(c => {
      if (!previousPaths.has(c.oss_path)) added.push(c.oss_path)
      const recurseAdd = n => { if (n.oss_path && !previousPaths.has(n.oss_path)) added.push(n.oss_path); (n.children || []).forEach(recurseAdd) }
      recurseAdd(c)
    })
    const nonOss = (dingqiNode.children || []).filter(c => c.source !== 'oss')
    dingqiNode.children = [...nonOss, ...keptMissing, ...newOssChildren]
  }
  return { added: [...new Set(added)], removed: [...new Set(removed)], newPaths: allNewPaths }
}

// 处理 OSS 同步按钮点击（同步到数据库并刷新树）
const handleOssSync = async () => {
  ossSyncLoading.value = true
  ossSyncResult.value = null
  try {
    const envConfig = getEnvConfig(import.meta.env.MODE || 'development')
    const ossDataSource = envConfig.ossDataSource || 'json'
    let treeData
    if (ossDataSource === 'api') {
      const res = await getOssFolderTreeAPI({ root_name: 'xxoss' })
      if (res.code !== 200 || !res.data) {
        ElMessage.error(res.msg || '获取 OSS 文件夹树失败')
        return
      }
      treeData = res.data
    } else {
      treeData = ossFolderTreeReal
    }
    const res = await syncOssFoldersAPI({ root: treeData.root, children: treeData.children })
    if (res.code !== 200) {
      ElMessage.error(res.msg || '同步失败')
      return
    }
    const { added = [], updated = [], removed = [] } = res.data || {}
    const msg = []
    if (added.length) msg.push(`新增 ${added.length} 个文件夹`)
    if (updated.length) msg.push(`更新 ${updated.length} 个文件夹`)
    if (removed.length) msg.push(`${removed.length} 个已移除`)
    if (msg.length) ElMessage.success(msg.join('；'))
    else ElMessage.success('同步完成')
    await loadFolderTree(null, true, { preserveExpanded: true, publicFirst: true })
  } catch (e) {
    console.error('OSS 同步失败:', e)
    ElMessage.error('同步失败：' + (e.message || '未知错误'))
  } finally {
    ossSyncLoading.value = false
  }
}

// 同步 OSS 文件到 WJGL_FILE_METADATA_OSS
const ossSyncFilesLoading = ref(false)
const handleOssSyncFiles = async () => {
  ossSyncFilesLoading.value = true
  try {
    const res = await syncOssFilesAPI()
    if (res.code === 200 && res.data) {
      const { added = 0, updated = 0, failed = 0 } = res.data
      ElMessage.success(`文件同步完成：新增 ${added}，更新 ${updated}，失败 ${failed}`)
      if (currentFolder.value) await loadFileList()
    } else {
      ElMessage.error(res.msg || '同步失败')
    }
  } catch (e) {
    console.error('OSS 文件同步失败:', e)
    ElMessage.error('同步失败：' + (e.message || '未知错误'))
  } finally {
    ossSyncFilesLoading.value = false
  }
}

// 更新 OSS 文件内容（批量 OCR 填充 file_content）
const ossRefreshContentLoading = ref(false)
const handleOssRefreshFileContent = async () => {
  ossRefreshContentLoading.value = true
  try {
    const res = await refreshOssFileContentAPI()
    if (res.code === 200 && res.data) {
      const d = res.data
      const enq = d.enqueued ?? d.processed ?? 0
      const fail = d.push_failed ?? d.failed ?? 0
      const {
        total = 0,
        total_empty = 0,
        skipped_has_content = 0,
        total_active = 0,
        truncated = false,
        max_enqueue = 20000,
      } = d
      let msg = `已入队 ${enq} 条（Worker 异步补全文），入队失败 ${fail}；本批 ${total} 条`
      if (total_empty) msg += `，尚缺全文共 ${total_empty} 条`
      msg += `；已有内容跳过 ${skipped_has_content}（未删除共 ${total_active}）`
      if (truncated) msg += `；仅入队前 ${max_enqueue} 条，请再次点击处理剩余`
      ElMessage.success(msg)
    } else {
      ElMessage.error(res.msg || '更新失败')
    }
  } catch (e) {
    console.error('更新 OSS 文件内容失败:', e)
    ElMessage.error('更新失败：' + (e.message || '未知错误'))
  } finally {
    ossRefreshContentLoading.value = false
  }
}

// 收集树中全部节点 id（用于校验展开 key 是否仍有效）
const collectAllTreeNodeIds = (nodes, acc = new Set()) => {
  for (const n of nodes || []) {
    if (n && n.id != null) acc.add(n.id)
    if (n.children?.length) collectAllTreeNodeIds(n.children, acc)
  }
  return acc
}

/** 合并展开 key：与 validIds 对齐，避免 el-tree 与接口 folder_id 的 number/string 不一致导致全部丢失 */
const addExpandedKeyIfStillInTree = (merged, validIds, k) => {
  if (k == null || k === '') return
  if (validIds.has(k)) {
    merged.add(k)
    return
  }
  for (const id of validIds) {
    if (id == k) {
      merged.add(id)
      return
    }
  }
}

// 从树根到目标文件夹 id 的路径（含空间根与目标），用于展开父链
const collectFolderKeyPath = (nodes, targetId, chain = []) => {
  for (const n of nodes || []) {
    const next = [...chain, n.id]
    if (n.id == targetId) return next
    if (n.children?.length) {
      const found = collectFolderKeyPath(n.children, targetId, next)
      if (found.length) return found
    }
  }
  return []
}

/** 在树数据中按 id 查找节点（用于本地插入后选中） */
const findFolderNodeById = (nodes, id) => {
  for (const n of nodes || []) {
    if (n.id == id) return n
    if (n.children?.length) {
      const f = findFolderNodeById(n.children, id)
      if (f) return f
    }
  }
  return null
}

/** 本地删除树节点（与知识库管理页一致，避免整树重拉导致展开收起） */
const deleteFolderFromTreeLocal = (nodes, folderId) => {
  if (!Array.isArray(nodes)) return false
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.id == folderId) {
      nodes.splice(i, 1)
      return true
    }
    if (node.children && deleteFolderFromTreeLocal(node.children, folderId)) {
      return true
    }
  }
  return false
}

/**
 * 将创建接口返回的数据插入 folderTreeData（不重新请求整棵树）
 * folderPayload: { folder_id, folder_name, folder_type }（与后端 success data 一致）
 */
const insertFolderNodeInFileTree = (treeRoots, folderPayload, parentFolderId) => {
  if (!folderPayload?.folder_id || !Array.isArray(treeRoots)) return false
  const spaceType = folderPayload.folder_type
  const spaceRoot = treeRoots.find((n) => n.isSpaceRoot && n.folder_type === spaceType)
  if (!spaceRoot) return false

  const newNode = {
    name: folderPayload.folder_name,
    id: folderPayload.folder_id,
    parent_folder_id: parentFolderId || null,
    folder_type: folderPayload.folder_type,
    project_uuid: folderPayload.project_uuid ?? null,
    project_name: folderPayload.project_name ?? null,
    isSpaceRoot: false,
    permission: 'FULL',
    can_delegate: true,
    is_creator: true,
    is_granted_to_user: false,
    is_super_admin: isSuperFileAdmin(),
    is_province_public: false,
    is_org_granted: false,
    created_at: folderPayload.created_at ?? null,
    grant_count: null,
    has_permission_grants: true,
    source: 'LOCAL',
    oss_path: null,
    show_no_permission_icon: false,
    is_system_builtin:
      folderPayload.is_system_builtin === true || folderPayload.is_system_builtin === 1,
    children: []
  }

  if (!parentFolderId) {
    if (!Array.isArray(spaceRoot.children)) spaceRoot.children = []
    spaceRoot.children.push(newNode)
    return true
  }

  const findParent = (list) => {
    if (!Array.isArray(list)) return null
    for (const n of list) {
      if (n.id == parentFolderId) return n
      if (n.children?.length) {
        const p = findParent(n.children)
        if (p) return p
      }
    }
    return null
  }
  const parent = findParent(spaceRoot.children || [])
  if (!parent) return false
  if (!Array.isArray(parent.children)) parent.children = []
  parent.children.push(newNode)
  return true
}

// 加载文件夹树（根据 spaceList 中的空间类型动态加载）
// showSidebarLoading：为 false 时不罩左侧整栏 loading（如创建成功后静默刷新）
// options.forceRefresh：为 true 时强制刷新后端缓存
// options.publicFirst：为 true 时先加载 PUBLIC 空间，再异步加载其他空间
const handleRefreshTree = async () => {
  if (treeRefreshLoading.value) return
  treeRefreshLoading.value = true
  try {
    await loadFolderTree(null, true, { preserveExpanded: true, forceRefresh: true })
  } finally {
    treeRefreshLoading.value = false
  }
}

// options.preserveExpanded：为 true 时尽量保持刷新前已展开的节点
// options.expandedKeysSnapshot：在侧栏 loading 等场景下 getExpandedKeys 不可靠时，传入删除/操作前缓存的展开 key
// options.expandParentFolderId / expandSpaceKeyCode：新建文件夹后展开父路径或空间根
// options.onlyCurrentSpaceType：仅刷新指定空间树（如 PERSONAL），合并进现有 folderTreeData
const loadFolderTree = async (projectUuid = null, showSidebarLoading = true, options = {}) => {
  // 防重复加载：如果正在加载中则直接忽略
  if (folderLoading.value) {
    return
  }
  const {
    preserveExpanded = false,
    expandParentFolderId = undefined,
    expandSpaceKeyCode = null,
    expandedKeysSnapshot = null,
    onlyCurrentSpaceType = null,
    forceRefresh = false,
    publicFirst = false
  } = options

  let savedExpandedKeys = []
  if (preserveExpanded) {
    if (Array.isArray(expandedKeysSnapshot)) {
      savedExpandedKeys = [...expandedKeysSnapshot]
    } else if (folderTreeRef.value?.getExpandedKeys) {
      savedExpandedKeys = [...folderTreeRef.value.getExpandedKeys()]
    } else {
      savedExpandedKeys = [...expandedKeys.value]
    }
  }

  if (showSidebarLoading) {
    folderLoading.value = true
  }
  try {
    // 确保已加载空间类型
    if (!spaceList.value || spaceList.value.length === 0) {
      await loadSpaceTypes()
    }

    const treeData = []
    const spaceRootKeys = []
    const partialTreeRefresh = !!(onlyCurrentSpaceType && folderTreeData.value?.length)
    const spacesToLoad = onlyCurrentSpaceType
      ? spaceList.value.filter(s => s.key_code === onlyCurrentSpaceType)
      : spaceList.value

    if (partialTreeRefresh) {
      treeData.push(...folderTreeData.value)
    }

    const assignSpaceRootNode = (rootNode, spaceKeyCode) => {
      if (partialTreeRefresh) {
        const slotIdx = treeData.findIndex(n => n.id === `space_${spaceKeyCode}`)
        if (slotIdx >= 0) {
          treeData[slotIdx] = rootNode
        } else {
          treeData.push(rootNode)
        }
      } else {
        treeData.push(rootNode)
        spaceRootKeys.push(rootNode.id)
      }
    }

    // 为单个空间构建请求
    const buildSpaceRequest = (space) => {
      const backendSpaceType =
        space.key_code === 'PUBLIC' || space.key_code === 'PERSONAL' || space.key_code === 'PROJECT'
          ? space.key_code
          : null

      if (!backendSpaceType) {
        return Promise.resolve({ code: 200, data: [] })
      }

      if (backendSpaceType === 'PROJECT') {
        return getProjectSpaceTreeAPI(forceRefresh ? { refresh: true } : undefined)
      }

      const params = {
        space_type: backendSpaceType,
        ...(forceRefresh ? { refresh: true } : {})
      }
      // 仅 PUBLIC 空间支持项目过滤
      if (backendSpaceType === 'PUBLIC' && projectUuid) {
        params.project_uuid = projectUuid
      }
      return getFolderTreeAPI(params)
    }

    // 处理单个空间的结果
    const processSpaceResult = async (res, space) => {
      const backendSpaceType =
        space.key_code === 'PUBLIC' || space.key_code === 'PERSONAL' || space.key_code === 'PROJECT'
          ? space.key_code
          : null

      if (!backendSpaceType) {
        const rootNode = {
          name: space.label || space.key_code,
          id: `space_${space.key_code}`,
          folder_type: space.key_code,
          isSpaceRoot: true,
          is_super_admin: false,
          children: []
        }
        assignSpaceRootNode(rootNode, space.key_code)
        return
      }

      if (backendSpaceType === 'PROJECT') {
        console.log('[perf] loadFolderTree PROJECT start')
        const perfStart = Date.now()
        const convertedChildren = convertTreeData(res.data || [], null, 'PROJECT')
        const rootNode = {
          name: space.label || space.key_code,
          id: `space_${space.key_code}`,
          folder_type: 'PROJECT',
          isSpaceRoot: true,
          is_super_admin: false,
          children: convertedChildren
        }
        // 为每个项目节点补充用户详细权限（后端返回 user_permissions 时直接复用，否则走批量查询）
        const projectNodes = []
        const collectProjects = (nodes) => {
          for (const n of nodes || []) {
            if (n.node_type === 'PROJECT') projectNodes.push(n)
            if (n.children?.length) collectProjects(n.children)
          }
        }
        collectProjects(convertedChildren)
        const projectIds = projectNodes.map(p => p.project_id || p.id)
        const allHavePermissions = projectNodes.length > 0 && projectNodes.every((p) => Array.isArray(p.user_permissions))
        if (projectIds.length > 0 && !allHavePermissions) {
          const roleBatchStart = Date.now()
          const res = await getUserProjectRoleBatchAPI({ project_ids: projectIds }).catch(() => null)
          console.log(`[perf] loadFolderTree PROJECT roleBatch duration_ms=${Date.now() - roleBatchStart}`)
          if (res && res.code === 200 && res.data) {
            for (const p of projectNodes) {
              const pid = p.project_id || p.id
              const roleData = res.data[pid]
              let permissions = (roleData && roleData.permissions) || []
              // 超级文件管理员赋予项目空间全部权限
              if (isSuperFileAdmin()) {
                permissions = ['DOWNLOAD', 'UPLOAD', 'DELETE', 'MANAGE', 'MANAGE_PROJECT', 'IMPORT_FOLDER', 'REMOVE_REF_FOLDER']
              }
              p.user_permissions = permissions
              // 将权限传递给所有子节点（包括引用文件夹）
              const propagatePermissions = (nodes) => {
                for (const n of nodes || []) {
                  n.user_permissions = permissions
                  if (n.children?.length) propagatePermissions(n.children)
                }
              }
              propagatePermissions(p.children)
            }
          }
        }
        assignSpaceRootNode(rootNode, space.key_code)
        console.log(`[perf] loadFolderTree PROJECT duration_ms=${Date.now() - perfStart}`)
        return
      }

      if (res.code !== 200 || !res.data) {
        const rootNode = {
          name: space.label || space.key_code,
          id: `space_${space.key_code}`,
          folder_type: backendSpaceType,
          isSpaceRoot: true,
          is_super_admin: false,
          children: []
        }
        assignSpaceRootNode(rootNode, space.key_code)
        return
      }

      const convertedChildren = convertTreeData(res.data, null)

      let isSuperAdmin = false

      // 仅对 PUBLIC 空间计算超级文件管理员标识（保持原有逻辑）
      if (backendSpaceType === 'PUBLIC') {
        const hasSuperAdminChild = convertedChildren.some(child => child.is_super_admin === true)

        let isSuperAdminFromToken = false
        try {
          const token = getToken()
          if (token) {
            const parts = token.split('.')
            if (parts.length === 3) {
              const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
              const payload = JSON.parse(payloadStr)
              const roleList = Array.isArray(payload.role) ? payload.role : []
              isSuperAdminFromToken = roleList.some((role) => {
                if (typeof role === 'string') {
                  return role === 'super_file_admin'
                }
                if (role && typeof role === 'object') {
                  return role.rolecode === 'super_file_admin'
                }
                return false
              })
            }
          }
        } catch (e) {
          // 解析 token 失败时忽略，不视为超级管理员
        }

        isSuperAdmin = isSuperAdminFromToken || hasSuperAdminChild
      }

      const rootNode = {
        name: space.label || space.key_code,
        id: `space_${space.key_code}`,
        folder_type: backendSpaceType,
        isSpaceRoot: true,
        is_super_admin: isSuperAdmin,
        children: convertedChildren
      }

      assignSpaceRootNode(rootNode, space.key_code)
    }

    // 渲染树并恢复展开状态
    const renderTree = async () => {
      if (partialTreeRefresh) {
        treeData.forEach(n => {
          if (n.isSpaceRoot) spaceRootKeys.push(n.id)
        })
      }

      folderTreeData.value = [...treeData]

      const validIds = collectAllTreeNodeIds(treeData)
      const merged = new Set(spaceRootKeys)
      if (preserveExpanded) {
        for (const k of savedExpandedKeys) {
          addExpandedKeyIfStillInTree(merged, validIds, k)
        }
      }
      if (expandParentFolderId != null && expandParentFolderId !== '') {
        for (const k of collectFolderKeyPath(treeData, expandParentFolderId)) {
          addExpandedKeyIfStillInTree(merged, validIds, k)
        }
      } else if (expandSpaceKeyCode != null && expandSpaceKeyCode !== '') {
        const sid = `space_${expandSpaceKeyCode}`
        addExpandedKeyIfStillInTree(merged, validIds, sid)
      }
      const mergedArr = [...merged]
      expandedKeys.value = mergedArr
      await nextTick()
      folderTreeRef.value?.setExpandedKeys?.(mergedArr)
    }

    if (publicFirst && !onlyCurrentSpaceType) {
      const publicSpaces = spacesToLoad.filter(s => s.key_code === 'PUBLIC')
      const otherSpaces = spacesToLoad.filter(s => s.key_code !== 'PUBLIC')

      // 先加载 PUBLIC 空间
      if (publicSpaces.length > 0) {
        const publicRequests = publicSpaces.map(buildSpaceRequest)
        const publicResults = await Promise.all(publicRequests)
        for (let i = 0; i < publicResults.length; i++) {
          await processSpaceResult(publicResults[i], publicSpaces[i])
        }
        await renderTree()
        if (showSidebarLoading) {
          folderLoading.value = false
        }
      }

      // 异步加载剩余空间
      if (otherSpaces.length > 0) {
        try {
          const otherRequests = otherSpaces.map(buildSpaceRequest)
          const otherResults = await Promise.all(otherRequests)
          for (let i = 0; i < otherResults.length; i++) {
            await processSpaceResult(otherResults[i], otherSpaces[i])
          }
          await renderTree()
        } catch (error) {
          console.error('加载其他空间文件夹失败:', error)
          ElMessage.error('加载其他空间文件夹失败')
        }
      }
    } else {
      // 为每个空间类型调用一次文件夹树接口（仅刷新指定空间时只请求该空间）
      const requests = spacesToLoad.map(buildSpaceRequest)
      const results = await Promise.all(requests)

      for (let i = 0; i < results.length; i++) {
        await processSpaceResult(results[i], spacesToLoad[i])
      }

      await renderTree()

      if (treeData.length === 0) {
        ElMessage.warning('未获取到文件夹数据')
      }
    }
  } catch (error) {
    console.error('加载文件夹树失败:', error)
    ElMessage.error('加载文件夹树失败')
    folderTreeData.value = []
  } finally {
    if (showSidebarLoading) {
      folderLoading.value = false
    }
  }
}

// 仅允许同级文件夹之间拖动排序，禁止通过拖拽改变层级
const allowFolderDrop = (draggingNode, dropNode, dropType) => {
  // 不允许拖成子节点
  if (dropType === 'inner') {
    return false
  }

  // 不允许拖到空间根节点本身的前后
  if (dropNode.data?.isSpaceRoot) {
    return false
  }

  const draggingParent = draggingNode.parent
  const dropParent = dropNode.parent

  // 缺少父节点信息时，直接禁止
  if (!draggingParent || !dropParent) {
    return false
  }

  // 只允许在同一个父节点下排序（同级目录）
  if (draggingParent !== dropParent) {
    return false
  }

  return true
}

// 打开新建文件夹对话框
const openCreateFolderDialog = (parentFolderId = null, spaceType = null) => {
  createFolderForm.folder_name = ''
  createFolderForm.is_system_builtin = false
  // 如果传入了父文件夹ID，使用它；否则使用当前选中的文件夹；都没有则在根目录创建
  createFolderForm.parent_folder_id = parentFolderId || currentFolder.value
  // 如果传入了空间类型，更新当前空间类型
  if (spaceType) {
    currentSpaceType.value = spaceType
  }
  createFolderDialogVisible.value = true
}

// 拖动文件夹排序（仅超级文件管理员）
const handleFolderDrop = async (draggingNode, dropNode, dropType) => {
  const parent = dropNode.parent
  if (!parent || !parent.childNodes) return
  const folderIds = parent.childNodes
    .filter(n => n.data && !n.data.isSpaceRoot && !String(n.data.id).startsWith('space_'))
    .map(n => n.data.id)
  if (folderIds.length === 0) return
  // 聚焦视图下，侧栏树可能是“多根”渲染：此时 parent 为虚拟根，parent.data 为空。
  // 需要从节点自身数据回推出 parent_folder_id / folder_type，否则拖拽排序会被提前 return。
  const parentData = parent.data || null
  const derivedSpaceType = dropNode?.data?.folder_type || draggingNode?.data?.folder_type
  const spaceType = parentData?.folder_type || derivedSpaceType
  if (!spaceType || (spaceType !== 'PUBLIC' && spaceType !== 'PERSONAL')) return
  const derivedParentFolderId =
    dropNode?.data?.parent_folder_id ?? draggingNode?.data?.parent_folder_id ?? null
  const parentFolderId =
    parentData?.isSpaceRoot ? null : (parentData?.id ?? derivedParentFolderId)
  try {
    const res = await updateFolderOrderAPI({
      parent_folder_id: parentFolderId,
      folder_ids: folderIds,
      space_type: spaceType
    })
    if (res.code === 200) {
      ElMessage.success('排序已更新')
    } else {
      ElMessage.error(res.msg || '排序更新失败')
      await loadFolderTree(null, true, { preserveExpanded: true })
    }
  } catch (error) {
    console.error('文件夹排序失败:', error)
    ElMessage.error(error.response?.data?.msg || '排序更新失败')
    await loadFolderTree(null, true, { preserveExpanded: true })
  }
}

// 确认新建文件夹
const handleCreateFolderConfirm = async () => {
  if (!createFolderForm.folder_name.trim()) {
    ElMessage.warning('请填写文件夹名称')
    return
  }

  createFolderLoading.value = true
  try {
    // 将当前“逻辑空间编码”转换为后端实际支持的空间类型
    const backendSpaceType = getBackendSpaceType(currentSpaceType.value)
    const parentForExpand = createFolderForm.parent_folder_id
    const spaceKeyForExpand = currentSpaceType.value

    const payload = {
      folder_name: createFolderForm.folder_name.trim(),
      parent_folder_id: createFolderForm.parent_folder_id,
      space_type: backendSpaceType,
      project_uuid: null,
      is_system_builtin: isSuperFileAdmin() && !!createFolderForm.is_system_builtin
    }
    const res = await createFolderAPI(payload)
    if (res.code === 200 || res.code === 201) {
      createFolderDialogVisible.value = false
      createFolderForm.folder_name = ''
      createFolderForm.parent_folder_id = null
      createFolderForm.is_system_builtin = false
      const folderPayload = res.data
      const inserted =
        folderPayload &&
        insertFolderNodeInFileTree(folderTreeData.value, folderPayload, parentForExpand)
      if (!inserted) {
        await loadFolderTree(null, false, {
          preserveExpanded: true,
          expandParentFolderId: parentForExpand,
          expandSpaceKeyCode:
            parentForExpand != null && parentForExpand !== '' ? null : spaceKeyForExpand
        })
      } else {
        await nextTick()
        if (folderTreeRef.value && typeof folderTreeRef.value.setCurrentKey === 'function') {
          folderTreeRef.value.setCurrentKey(folderPayload.folder_id)
        }
        const newNode = findFolderNodeById(folderTreeData.value, folderPayload.folder_id)
        if (newNode) {
          await handleFolderClick(newNode)
        }
      }
      await nextTick()
      await nextTick()
      ElMessage.success('添加文件夹成功')
    } else {
      ElMessage.error(res.msg || '创建文件夹失败')
    }
  } catch (error) {
    console.error('创建文件夹失败:', error)
    // 优化错误提示：针对文件夹重名的情况显示友好提示
    const errorData = error.response?.data
    const errorMsg = errorData?.msg || errorData?.detail || ''

    if (errorMsg.includes('同名文件夹') || errorMsg.includes('已存在')) {
      ElMessage.warning('文件夹名称重复，请使用其他名称')
    } else if (errorMsg) {
      ElMessage.error(errorMsg)
    } else {
      ElMessage.error('创建文件夹失败，请稍后重试')
    }
  } finally {
    createFolderLoading.value = false
  }
}

// 打开重命名文件夹对话框
const openRenameFolderDialog = () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择要重命名的文件夹')
    return
  }
  renameFolderForm.folder_name = getFolderName(currentFolder.value)
  renameFolderDialogVisible.value = true
}

// 确认重命名文件夹
const handleRenameFolderConfirm = async () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择要重命名的文件夹')
    return
  }
  if (!renameFolderForm.folder_name.trim()) {
    ElMessage.warning('请填写新的文件夹名称')
    return
  }
  try {
    const res = await renameFolderAPI(currentFolder.value, {
      folder_name: renameFolderForm.folder_name.trim()
    })
    if (res.code === 200) {
      ElMessage.success('重命名成功')
      renameFolderDialogVisible.value = false
      await loadFolderTree(null, true, { preserveExpanded: true })
    } else {
      ElMessage.error(res.msg || '重命名失败')
    }
  } catch (error) {
    console.error('重命名文件夹失败:', error)
    // 优化错误提示：针对文件夹重名的情况显示友好提示
    const errorData = error.response?.data
    const errorMsg = errorData?.msg || errorData?.detail || ''

    if (errorMsg.includes('同名文件夹') || errorMsg.includes('已存在')) {
      ElMessage.warning('文件夹名称重复，请使用其他名称')
    } else if (errorMsg) {
      ElMessage.error(errorMsg)
    } else {
      ElMessage.error('重命名失败，请稍后重试')
    }
  }
}

// 转换树数据格式（parentFolderId 用于拖动排序时传参）
const convertTreeData = (data, parentFolderId = null, defaultFolderType = null) => {
  if (!data || !Array.isArray(data)) return []
  return data.map(item => {
    // 递归处理子节点，传入当前项为父级
    const itemId = item.folder_id || item.id
    const children = item.children ? convertTreeData(item.children, itemId, defaultFolderType) : []

    // 子节点已由后端按 sort_order 排序，前端不再重排
    const converted = {
      name: item.folder_name || item.name,
      id: itemId,
      parent_folder_id: parentFolderId,
      folder_type: item.folder_type || defaultFolderType,
      project_uuid: item.project_uuid || null,
      project_id: item.project_id || null,
      project_name: item.project_name || null, // 项目名称
      isSpaceRoot: false,
      // 保留权限信息
      permission: item.permission || 'NONE',
      can_delegate: item.can_delegate || false,
      is_creator: item.is_creator || false,
      is_granted_to_user: item.is_granted_to_user || false,
      is_super_admin: item.is_super_admin || false,
      // 新增：来源与统计信息
      is_province_public: item.is_province_public || false,
      is_org_granted: item.is_org_granted || false,
      created_at: item.created_at || null, // 保留创建时间字段
      grant_count: item.grant_count ?? null, // 授权数量，0 表示未分配
      has_permission_grants: item.has_permission_grants ?? true,
      source: item.source || 'LOCAL', // OSS 同步的文件夹为 OSS
      oss_path: item.oss_path || null,
      show_no_permission_icon: item.show_no_permission_icon ?? false, // source!=LOCAL 时由后端根据权限记录计算
      is_system_builtin: item.is_system_builtin === true || item.is_system_builtin === 1,
      bound_org_uuid: item.bound_org_uuid || null,
      is_bound_org_folder: item.is_bound_org_folder === true,
      org_node_is_virtual: item.org_node_is_virtual === true,
      // 项目空间特有字段
      node_type: item.node_type || null, // YEAR / UNIT / PROJECT / GROUP / FOLDER / OSS
      is_oss_folder: item.is_oss_folder === true, // OSS 同步文件夹（只读）
      is_reference: item.is_reference || false,
      ref_target_id: item.ref_target_id || null,
      ref_target_space: item.ref_target_space || null,
      user_permissions: item.user_permissions || null,
      children: children
    }

    return converted
  })
}

// 文档解析状态（parse_status 0/1/2/3，展示名来自数据字典 file-parse-status）
const documentParseStatusTagType = (row) => getParseStatusTagType(row)
const documentParseStatusLabel = (row) => getParseStatusLabel(row)

// 加载文件列表
// - 未选文件夹 + 公共空间：GET files/by-space（含 total_file_size）
// - 未选文件夹 + 个人空间：不请求 by-space（首屏聚焦视图下由树选文件夹再 GET files，避免重接口）
// - 选中文件夹时：GET files，仅当前目录（不递归子文件夹）
const loadFileList = async () => {
  const mySeq = ++loadFileListRequestSeq
  const stale = () => mySeq !== loadFileListRequestSeq
  loading.value = true
  try {
    // 未选文件夹且无空间类型时，默认个人空间（不再调用 merged-spaces）
    if (!currentFolder.value && (currentSpaceType.value == null || currentSpaceType.value === '')) {
      currentSpaceType.value = 'PERSONAL'
    }

    // 1. 空间模式：仅公共空间在未选文件夹时走 by-space；个人空间/项目空间无选中文件夹时不拉全空间列表
    if (!currentFolder.value && currentSpaceType.value) {
      if (currentSpaceType.value === 'PERSONAL' || currentSpaceType.value === 'PROJECT') {
        fileList.value = []
        total.value = 0
        publicSpaceTotalSize.value = null
        return
      }
      try {
        const params = new URLSearchParams()
        params.append('space_type', currentSpaceType.value)
        params.append('page', String(query.page))
        params.append('page_size', String(query.size))
        if (query.search && query.search.trim()) {
          params.append('search', query.search.trim())
        }
        if (query.mime_type && query.mime_type.trim()) {
          params.append('mime_type', query.mime_type.trim())
        }
        if (query.file_ext && query.file_ext.trim()) {
          params.append('file_ext', query.file_ext.trim().toLowerCase())
        }
        if (query.parse_status != null && String(query.parse_status).trim() !== '') {
          params.append('parse_status', String(query.parse_status).trim())
        }
        if (currentSpaceType.value === 'PUBLIC') {
          params.append('include_total_file_size', 'true')
        }
        const bySpaceKey = params.toString()
        const nowMs = Date.now()
        if (
          bySpaceInFlight &&
          bySpaceInFlightKey === bySpaceKey
        ) {
          await bySpaceInFlight
          return
        }
        if (
          bySpaceInFlightKey === bySpaceKey &&
          nowMs - bySpaceLastHitAt < BY_SPACE_DEDUP_WINDOW_MS
        ) {
          return
        }
        bySpaceLastHitAt = nowMs

        const token = getToken()
        bySpaceInFlightKey = bySpaceKey
        bySpaceInFlight = fetch(`/api/v1/file-manager/files/by-space?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Agent-Token': token } : {})
          }
        }).then((resp) => resp.json())
        const res = await bySpaceInFlight
        if (stale()) return

        if (res.code === 200 && res.data) {
          const files = (res.data.files || []).map(file => ({
            file_id: file.file_id,
            original_name: file.file_name,
            mime_type: file.mime_type,
            file_size: file.file_size,
            uploader: file.uploader_name,
            uploader_id: file.uploader_id,
            upload_time: file.upload_time,
            folder_id: file.folder_id,
            is_oss: file.is_oss || false,
            parse_status: file.parse_status != null ? file.parse_status : 0,
            document_parse_status: file.document_parse_status || 'unparsed',
            summary: null,
            summary_status: null,
            last_view_time: null,
            tags: []
          }))
          fileList.value = files
          total.value = res.data.total || 0
          await loadTagsForFiles(files)
          if (stale()) return

          // 如果是公共空间，使用后端聚合的 total_file_size（与当前筛选条件一致）
          if (currentSpaceType.value === 'PUBLIC') {
            if (typeof res.data.total_file_size === 'number') {
              publicSpaceTotalSize.value = res.data.total_file_size
            } else {
              publicSpaceTotalSize.value = 0
            }
          } else {
            // 切换到非公共空间时，重置为 null，表示未计算
            publicSpaceTotalSize.value = null
          }
        } else {
          if (stale()) return
          fileList.value = []
          total.value = 0
          // 加载失败时，如果是公共空间，重置总大小；否则设为 null
          if (currentSpaceType.value === 'PUBLIC') {
            publicSpaceTotalSize.value = null // 加载失败，重置为未计算状态
          } else {
            publicSpaceTotalSize.value = null
          }
        }
      } catch (e) {
        if (stale()) return
        console.error('按空间加载文件列表失败:', e)
        ElMessage.error('加载文件列表失败')
        fileList.value = []
        total.value = 0
        // 加载失败时，如果是公共空间，重置总大小
        if (currentSpaceType.value === 'PUBLIC') {
          publicSpaceTotalSize.value = null
        }
      } finally {
        bySpaceInFlight = null
      }
      return
    }

    // 2. 文件夹模式：必须有选中文件夹
    if (!currentFolder.value) {
      if (fileList.value.length === 0 && total.value === 0) {
        fileList.value = []
        total.value = 0
      }
      return
    }

    const params = {
      page: query.page,
      page_size: query.size,
      recursive: query.recursive
    }
    // folder_id 始终要传（后端校验必填）
    params.folder_id = currentFolder.value
    // 引用文件夹额外传 ref_target_id，后端识别后走源文件夹权限
    if (currentFolderRefInfo.value?.isReference) {
      params.ref_target_id = currentFolderRefInfo.value.ref_target_id
      params.source_space_type = currentFolderRefInfo.value.ref_target_space
    }

    if (query.search && query.search.trim()) {
      params.search = query.search.trim()
    }
    if (query.mime_type && query.mime_type.trim()) {
      params.mime_type = query.mime_type.trim()
    }
    if (query.file_ext && query.file_ext.trim()) {
      params.file_ext = query.file_ext.trim().toLowerCase()
    }
    if (query.parse_status != null && String(query.parse_status).trim() !== '') {
      params.parse_status = String(query.parse_status).trim()
    }

    const res = await getFileListAPI(params)
    if (stale()) return

    if (res.code === 200 && res.data) {
      const files = (res.data.files || []).map(file => ({
        file_id: file.file_id,
        original_name: file.file_name,
        mime_type: file.mime_type,
        file_size: file.file_size,
        uploader: file.uploader_name,
        uploader_id: file.uploader_id,
        upload_time: file.upload_time,
        folder_id: file.folder_id,
        is_oss: file.is_oss || false,
        parse_status: file.parse_status != null ? file.parse_status : 0,
        document_parse_status: file.document_parse_status || 'unparsed',
        summary: null,
        summary_status: null,
        last_view_time: null,
        tags: []
      }))
      fileList.value = files
      total.value = res.data.total || 0
      await loadTagsForFiles(files)
      if (stale()) return
    } else {
      if (stale()) return
      ElMessage.error(res.msg || '获取文件列表失败')
      fileList.value = []
      total.value = 0
    }
  } catch (error) {
    if (!stale()) {
      console.error('加载文件列表失败:', error)
      ElMessage.error('加载文件列表失败')
      fileList.value = []
      total.value = 0
    }
  } finally {
    if (!stale()) {
      const seqWhenFinished = mySeq
      loading.value = false
      nextTick(() => {
        if (seqWhenFinished !== loadFileListRequestSeq) return
        restoreFileTableSelectionAfterListUpdate()
      })
    }
  }
}

// 为当前列表中的文件加载标签
const loadTagsForFiles = async (files) => {
  // if (!files || !files.length) return
  // try {
  //   const tasks = files.map(async (file) => {
  //     try {
  //       const res = await getFileTagsAPI(file.file_id)
  //       if (res.code === 200 && res.data && Array.isArray(res.data.tags)) {
  //         file.tags = res.data.tags
  //       } else {
  //         file.tags = []
  //       }
  //     } catch (e) {
  //       console.error('加载文件标签失败:', e)
  //       file.tags = []
  //     }
  //   })
  //   await Promise.all(tasks)
  // } catch (e) {
  //   console.error('批量加载文件标签失败:', e)
  // }
}


// 获取文件夹图标
const getFolderIcon = (data) => {
  if (data.isSpaceRoot) {
    // 根节点：公共/个人统一使用文件夹图标
    return Folder
  }
  // 省级公共文件夹
  if (data.folder_type === 'PUBLIC' && data.is_province_public) {
    return OfficeBuilding
  }
  // 通过机构授权可见的文件夹
  if (data.folder_type === 'PUBLIC' && data.is_org_granted) {
    return School
  }
  // 普通公共/个人空间文件夹
  return Folder
}

// 获取文件夹图标样式类
const getFolderIconClass = (data) => {
  if (data.isSpaceRoot) {
    return data.folder_type === 'PUBLIC' ? 'icon-public' : 'icon-personal'
  }
  if (data.folder_type === 'PUBLIC' && data.is_province_public) {
    return 'icon-public-province'
  }
  if (data.folder_type === 'PUBLIC' && data.is_org_granted) {
    return 'icon-public-org'
  }
  const classMap = {
    PUBLIC: 'icon-public',
    PERSONAL: 'icon-personal'
  }
  return classMap[data.folder_type] || 'icon-default'
}

// 获取文件夹类型文本
const getFolderTypeText = (folderType) => {
  const textMap = {
    'PUBLIC': '公共',
    'PERSONAL': '个人',
  }
  return textMap[folderType] || '未知'
}

// 获取文件夹标签类型
const getFolderTagType = (folderType) => {
  const tagMap = {
    'PUBLIC': 'info',
    'PERSONAL': 'warning',
  }
  return tagMap[folderType] || 'info'
}

// 过滤树数据（根据搜索关键词）
const filterTree = (nodes, keyword) => {
  if (!nodes || !Array.isArray(nodes)) {
    return []
  }

  return nodes
    .map(node => {
      const label = (node.name || '').toLowerCase()
      const matched = label.includes(keyword)
      const filteredChildren = node.children ? filterTree(node.children, keyword) : []

      if (matched || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        }
      }
      return null
    })
    .filter(node => node !== null)
}

function findNodeByIdInForest(nodes, id) {
  if (!nodes?.length || id == null || id === '') return null
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNodeByIdInForest(n.children || [], id)
    if (found) return found
  }
  return null
}

function deepCloneTreeNode(node) {
  if (!node) return null
  return {
    ...node,
    children: (node.children || []).map((c) => deepCloneTreeNode(c))
  }
}

function isFolderBoundToOrg(node) {
  if (!node || node.isSpaceRoot) return false
  return node.is_bound_org_folder === true || !!node.bound_org_uuid
}

/** 遍历公共空间根下所有文件夹节点（不含空间根自身） */
function walkPublicFolderNodesUnderRoot(nodes, visit) {
  if (!nodes?.length) return
  for (const n of nodes) {
    if (!n.isSpaceRoot) visit(n)
    walkPublicFolderNodesUnderRoot(n.children || [], visit)
  }
}

/** id -> 节点，仅公共空间根下文件夹 */
function buildPublicFolderIndexMap(pubRoot) {
  const map = new Map()
  walkPublicFolderNodesUnderRoot(pubRoot.children || [], (n) => {
    map.set(n.id, n)
  })
  return map
}

/**
 * 所有「已绑定机构」文件夹 id，以及通往它们的祖先 id 并集（未绑定父级在路径上也会被包含，用于展示但后续标 disabled）
 */
function collectVisiblePublicFolderIds(pubRoot) {
  const ids = new Set()
  const map = buildPublicFolderIndexMap(pubRoot)
  const boundIds = []
  walkPublicFolderNodesUnderRoot(pubRoot.children || [], (n) => {
    if (isFolderBoundToOrg(n)) boundIds.push(n.id)
  })
  for (const bid of boundIds) {
    let cur = bid
    while (cur) {
      ids.add(cur)
      const n = map.get(cur)
      if (!n) break
      cur = n.parent_folder_id || null
    }
  }
  return ids
}

/** 公共空间聚焦：仅保留 visibleIds 中的节点；未绑定且仅在路径上的节点 disabled；虚机构不可选 */
function buildPrunedPublicNodeForFocus(node, visibleIds) {
  if (!node || !visibleIds.has(node.id)) return null
  const rawChildren = node.children || []
  const children = rawChildren
    .map((c) => buildPrunedPublicNodeForFocus(c, visibleIds))
    .filter(Boolean)
  const bound = isFolderBoundToOrg(node)
  const disabled =
    node.org_node_is_virtual === true || (!node.isSpaceRoot && !bound)
  return {
    ...node,
    children,
    disabled
  }
}

/** 整棵公共空间聚焦树（含空间根，根可选） */
function buildPublicFocusedTree(pubNode) {
  if (!pubNode) return null
  const visibleIds = collectVisiblePublicFolderIds(pubNode)
  const base = { ...pubNode, children: [], disabled: false }
  base.children = (pubNode.children || [])
    .map((c) => buildPrunedPublicNodeForFocus(c, visibleIds))
    .filter(Boolean)
  return base
}

/** 以某一 PUBLIC 文件夹为根的聚焦子树（与下拉/侧栏规则一致） */
function buildPublicFocusedSubtreeFromNode(folderNode, pubRoot) {
  if (!folderNode || !pubRoot) return null
  const visibleIds = collectVisiblePublicFolderIds(pubRoot)
  return buildPrunedPublicNodeForFocus(folderNode, visibleIds)
}

/** 聚焦侧栏：不以范围节点为根，仅将其直接子节点作为多根；无子级时展示范围节点自身（仅有文件的叶子目录） */
function focusedSidebarRootsFromScopeRoot(scopeRoot) {
  if (!scopeRoot) return []
  const kids = scopeRoot.children || []
  if (!kids.length) {
    return [deepCloneTreeNode(scopeRoot)]
  }
  return kids.map((c) => deepCloneTreeNode(c))
}

/**
 * 与左侧聚焦树 `sidebarTreeRootsRaw` 同源的节点列表，深度优先选第一个可查看的文件夹 id
 *（与 `handleFolderClick` 的权限/禁用规则一致，用于首屏默认可展示第一个文件夹下文件）
 */
function findFirstViewableFolderInFocusedSidebarRoots(roots) {
  if (!roots?.length) return null
  for (const n of roots) {
    if (n.isSpaceRoot) {
      const sub = findFirstViewableFolderInFocusedSidebarRoots(n.children || [])
      if (sub) return sub
      continue
    }
    if (n.org_node_is_virtual === true) {
      const sub = findFirstViewableFolderInFocusedSidebarRoots(n.children || [])
      if (sub) return sub
      continue
    }
    if (n.disabled) {
      const sub = findFirstViewableFolderInFocusedSidebarRoots(n.children || [])
      if (sub) return sub
      continue
    }
    if (n.permission === 'NONE' || !n.permission) {
      const sub = findFirstViewableFolderInFocusedSidebarRoots(n.children || [])
      if (sub) return sub
      continue
    }
    return n.id
  }
  return null
}

/** 个人空间（及非 PUBLIC 的空间根）：聚焦下拉不过滤，仅虚机构节点不可选 */
function clonePersonalSpaceForScopeSelect(node) {
  if (!node) return null
  const children = (node.children || []).map((c) => clonePersonalSpaceForScopeSelect(c))
  return {
    ...node,
    children,
    disabled: node.org_node_is_virtual === true
  }
}

/** 项目空间范围选择器：只显示空间根，不展示下级节点（与个人空间一致） */
function buildProjectSpaceScopeTree(root) {
  if (!root) return null
  return { ...deepCloneTreeNode(root), children: [], disabled: false }
}

/** 聚焦范围下拉：保留各空间根；个人全量；公共为「所有绑定节点 + 通往其的祖先路径」，路径上未绑定不可选；项目空间仅显示根 */
function buildFocusedScopeTreeSelectRoots() {
  const roots = folderTreeData.value || []
  return roots
    .map((node) => {
      if (node.isSpaceRoot && node.folder_type === 'PUBLIC') {
        return buildPublicFocusedTree(node)
      }
      if (node.isSpaceRoot && node.folder_type === 'PROJECT') {
        return buildProjectSpaceScopeTree(node)
      }
      return clonePersonalSpaceForScopeSelect(deepCloneTreeNode(node))
    })
    .filter(Boolean)
    .flat()
}

function findFirstSelectableScopeNodeId(nodes) {
  if (!nodes?.length) return null
  for (const n of nodes) {
    if (!n.disabled) {
      return n.id
    }
    const sub = findFirstSelectableScopeNodeId(n.children || [])
    if (sub) return sub
  }
  return null
}

/**
 * 拉取 sjry 组织树（仅用户所在组织节点），写入 userLeafOrguuidFromSjry；可并发去重。
 * 多组织时取 org_tree 第一个节点的 orguuid。
 */
async function ensureUserLeafOrguuidFromSjry() {
  const cached = userLeafOrguuidFromSjry.value
  if (cached != null && String(cached).trim() !== '') return

  if (sjryOrgFetchPromise) {
    await sjryOrgFetchPromise
    return
  }

  sjryOrgFetchPromise = (async () => {
    try {
      const raw = localStorage.getItem('USER_INFO')
      if (!raw) {
        return
      }
      const u = JSON.parse(raw)
      const userid = u.user_id ?? u.userid
      if (!userid) {
        return
      }
      const res = await getOrgTreeAPI({ userid: String(userid), rolecode: 'sjry' })
      if (res.code !== 200 || !res.data) {
        return
      }
      const roots = normalizeOrgTreeRootsForLookup(res.data)
      const first = roots[0]
      const orguuid = first?.orguuid != null ? String(first.orguuid).trim() : ''
      if (orguuid) {
        userLeafOrguuidFromSjry.value = orguuid
      }
    } catch (e) {
      /* ignore */
    } finally {
      sjryOrgFetchPromise = null
    }
  })()

  await sjryOrgFetchPromise
}

/**
 * 拉取 /api/v1/org/me/path（与行为日志机构全路径同源），写入 ancestor 链与叶子 id。
 */
async function ensureUserOrgPathFromApi() {
  if (userOrgAncestorUuidsFromApi.value !== null) return
  if (userOrgPathFetchPromise) {
    await userOrgPathFetchPromise
    return
  }
  userOrgPathFetchPromise = (async () => {
    try {
      const res = await getCurrentUserOrgPathAPI()
      if (res.code === 200 && res.data) {
        const leaf = res.data.leaf_orguuid
        if (leaf != null && String(leaf).trim() !== '') {
          userLeafOrguuidFromPathApi.value = String(leaf).trim()
        } else {
          userLeafOrguuidFromPathApi.value = null
        }
        const raw = res.data.ancestor_orguuids
        const chain = Array.isArray(raw)
          ? raw.map((u) => String(u).trim()).filter(Boolean)
          : []
        if (chain.length > 0) {
          userOrgAncestorUuidsFromApi.value = chain
        } else if (userLeafOrguuidFromPathApi.value) {
          userOrgAncestorUuidsFromApi.value = [userLeafOrguuidFromPathApi.value]
        } else {
          userOrgAncestorUuidsFromApi.value = []
        }
      } else {
        userOrgAncestorUuidsFromApi.value = []
        userLeafOrguuidFromPathApi.value = null
      }
    } catch (e) {
      userOrgAncestorUuidsFromApi.value = []
      userLeafOrguuidFromPathApi.value = null
    } finally {
      userOrgPathFetchPromise = null
    }
  })()
  await userOrgPathFetchPromise
}

/** 当前用户主属机构 UUID，用于与文件夹 bound_org_uuid 匹配；优先 /org/me/path，其次 sjry，再 USER_INFO / JWT */
function getCurrentUserPrimaryOrguuid() {
  const fromPathApi = userLeafOrguuidFromPathApi.value
  if (fromPathApi != null && String(fromPathApi).trim() !== '') return String(fromPathApi).trim()
  const fromSjry = userLeafOrguuidFromSjry.value
  if (fromSjry != null && String(fromSjry).trim() !== '') return String(fromSjry).trim()
  try {
    const raw = localStorage.getItem('USER_INFO')
    if (raw) {
      const u = JSON.parse(raw)
      const fromUser =
        u.orguuid || u.org_uuid || u.organization_uuid || u.primary_orguuid || u.deptuuid
      if (fromUser && String(fromUser).trim()) return String(fromUser).trim()
    }
  } catch (e) {
    /* ignore */
  }
  try {
    const token = getToken()
    if (token) {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        const p = JSON.parse(payloadStr)
        const fromJwt =
          p.orguuid ||
          p.org_uuid ||
          p.orgUuid ||
          p.organization_uuid ||
          p.deptuuid ||
          p.belong_orguuid
        if (fromJwt && String(fromJwt).trim()) return String(fromJwt).trim()
      }
    }
  } catch (e) {
    /* ignore */
  }
  return null
}

/** 将接口/缓存中的 org 数据规范为树根数组 */
function normalizeOrgTreeRootsForLookup(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  const t = data.org_tree ?? data.orgTree
  if (Array.isArray(t)) return t
  if (t && typeof t === 'object') return [t]
  return []
}

/** 优先专用于路径的机构树，其次授权弹窗已加载的 orgTreeData，最后 ORG_TREE */
function getOrgTreeRootsForUserPathLookup() {
  if (orgTreeForPathLookup.value?.length) {
    return orgTreeForPathLookup.value
  }
  if (orgTreeData.value?.length) {
    return orgTreeData.value
  }
  try {
    const raw = localStorage.getItem('ORG_TREE')
    if (!raw) {
      return []
    }
    return normalizeOrgTreeRootsForLookup(JSON.parse(raw))
  } catch (e) {
    return []
  }
}

/** 从机构森林中得到从根到 leafOrguuid 的 orguuid 路径（含叶子），找不到返回 null */
function findOrguuidPathInForest(roots, leafOrguuid) {
  if (!roots?.length || !leafOrguuid) return null
  const target = String(leafOrguuid).trim()
  function walk(nodes, acc) {
    for (const n of nodes) {
      const id = n.orguuid != null ? String(n.orguuid).trim() : ''
      const next = id ? [...acc, id] : [...acc]
      if (id === target) return next
      if (n.children?.length) {
        const found = walk(n.children, next)
        if (found) return found
      }
    }
    return null
  }
  return walk(roots, [])
}

/** 聚焦范围树中所有「可选且已绑定机构」的文件夹（DFS 顺序） */
function collectSelectableBoundFoldersInScopeTree(nodes, acc = []) {
  if (!nodes?.length) return acc
  for (const n of nodes) {
    if (!n.disabled && n.bound_org_uuid) {
      const b = String(n.bound_org_uuid).trim()
      if (b) acc.push({ id: n.id, bound: b })
    }
    collectSelectableBoundFoldersInScopeTree(n.children || [], acc)
  }
  return acc
}

/** 聚焦范围树中第一个可选且 bound_org_uuid 与目标机构完全一致的文件夹 id（兜底） */
function findFirstSelectableBoundOrgMatchInScopeTree(nodes, orgUuid) {
  if (!orgUuid || !nodes?.length) return null
  const target = String(orgUuid).trim()
  for (const n of nodes) {
    if (!n.disabled && n.bound_org_uuid && String(n.bound_org_uuid).trim() === target) {
      return n.id
    }
    const sub = findFirstSelectableBoundOrgMatchInScopeTree(n.children || [], orgUuid)
    if (sub) return sub
  }
  return null
}

/**
 * 用户叶子机构往往比文件夹绑定层级更细：在用户「根→叶子」路径上，选 bound_org_uuid 落在该路径上且
 * 深度最大（离用户最近的上级）的可选绑定文件夹；无路径或无命中时再尝试与用户叶子完全匹配。
 */
function findBestBoundOrgFolderByUserOrgPath(scopeRoots, userLeafOrguuid) {
  if (!userLeafOrguuid || !scopeRoots?.length) {
    return null
  }
  const apiChain = userOrgAncestorUuidsFromApi.value
  let path = null
  if (Array.isArray(apiChain) && apiChain.length > 0) {
    path = apiChain
  } else {
    path = findOrguuidPathInForest(getOrgTreeRootsForUserPathLookup(), userLeafOrguuid)
  }
  if (path?.length) {
    const depthByUuid = new Map()
    path.forEach((uuid, i) => depthByUuid.set(uuid, i))
    const candidates = collectSelectableBoundFoldersInScopeTree(scopeRoots)
    let bestIdx = -1
    let bestId = null
    for (const { id, bound } of candidates) {
      const idx = depthByUuid.get(bound)
      if (idx === undefined) continue
      if (idx > bestIdx) {
        bestIdx = idx
        bestId = id
      }
    }
    if (bestId != null && bestId !== '') {
      return bestId
    }
  }
  return findFirstSelectableBoundOrgMatchInScopeTree(scopeRoots, userLeafOrguuid)
}

function findSpacePublicScopeNodeIdInRoots(nodes) {
  if (!nodes?.length) return null
  for (const n of nodes) {
    if (n.id === 'space_PUBLIC' && !n.disabled) return 'space_PUBLIC'
  }
  return null
}

/** 进入聚焦视图时默认范围：本人机构路径上最近的绑定文件夹 → 公共空间根 → 第一个可选 */
function pickDefaultFocusedScopeNodeId(scopeRoots) {
  const orgHit = getCurrentUserPrimaryOrguuid()
  if (orgHit) {
    const matched = findBestBoundOrgFolderByUserOrgPath(scopeRoots, orgHit)
    if (matched != null && matched !== '') {
      return matched
    }
  }
  const pub = findSpacePublicScopeNodeIdInRoots(scopeRoots)
  if (pub) {
    return pub
  }
  return findFirstSelectableScopeNodeId(scopeRoots)
}

function isSelectableInScopeTree(nodes, id) {
  if (id == null || id === '' || !nodes?.length) return false
  for (const n of nodes) {
    if (n.id === id && !n.disabled) return true
    if (isSelectableInScopeTree(n.children || [], id)) return true
  }
  return false
}

/**
 * 侧栏、范围内判断、同步当前目录：使用完整文件夹树子树（deepClone），与范围下拉的裁剪树分离。
 */
function getEffectiveScopeNodeForFocus(nodeId) {
  if (nodeId == null || nodeId === '') return null
  const pub = findNodeByIdInForest(folderTreeData.value, 'space_PUBLIC')
  if (nodeId === 'space_PUBLIC') {
    return pub ? deepCloneTreeNode(pub) : null
  }
  const found = findNodeByIdInForest(folderTreeData.value, nodeId)
  if (!found) return null
  return deepCloneTreeNode(found)
}

const focusedScopeTreeSelectData = computed(() => {
  if (sidebarViewMode.value !== 'focused') {
    return folderTreeData.value
  }
  return buildFocusedScopeTreeSelectRoots()
})

function isDescendantOfScopeNode(scopeNode, folderId) {
  if (!folderId || !scopeNode) return true
  if (scopeNode.id === folderId) return true
  for (const c of scopeNode.children || []) {
    if (isDescendantOfScopeNode(c, folderId)) return true
  }
  return false
}

// 聚焦模式：侧栏用完整树子节点（与下拉裁剪无关），便于浏览未绑定子文件夹
const sidebarTreeRootsRaw = computed(() => {
  if (sidebarViewMode.value !== 'focused') {
    return folderTreeData.value
  }
  if (focusedScopeNodeId.value == null || focusedScopeNodeId.value === '') {
    return []
  }
  let scopeRoot = null
  if (focusedScopeNodeId.value === 'space_PUBLIC') {
    const pub = findNodeByIdInForest(folderTreeData.value, 'space_PUBLIC')
    if (!pub) return []
    scopeRoot = deepCloneTreeNode(pub)
  } else {
    const found = findNodeByIdInForest(folderTreeData.value, focusedScopeNodeId.value)
    if (!found) return []
    scopeRoot = deepCloneTreeNode(found)
  }
  return focusedSidebarRootsFromScopeRoot(scopeRoot)
})

const displaySidebarTreeData = computed(() => {
  const roots = sidebarTreeRootsRaw.value
  if (!searchKeyword.value) {
    return roots
  }
  return filterTree(roots, searchKeyword.value.toLowerCase())
})

// 聚焦下范围根不在侧栏树中时，不高亮不存在的节点
const folderTreeHighlightKey = computed(() => {
  const id = currentFolder.value
  if (id == null || id === '') return undefined
  if (sidebarViewMode.value !== 'focused') return id
  return findNodeByIdInForest(sidebarTreeRootsRaw.value, id) ? id : undefined
})

// 处理搜索
const handleSearch = () => {
  const roots = sidebarTreeRootsRaw.value
  if (searchKeyword.value && roots.length > 0) {
    const allKeys = []
    const collectKeys = (nodes) => {
      nodes.forEach(node => {
        allKeys.push(node.id)
        if (node.children && node.children.length > 0) {
          collectKeys(node.children)
        }
      })
    }
    collectKeys(roots)
    expandedKeys.value = allKeys
  } else {
    expandedKeys.value = roots.map(node => node.id)
  }
}

// 左侧宽度拖拽
const onResizeMouseDown = (event) => {
  isResizing = true
  startX = event.clientX
  startWidth = sidebarWidth.value

  const onMouseMove = (e) => {
    if (!isResizing) return
    const delta = e.clientX - startX
    let newWidth = startWidth + delta
    // 限制最小/最大宽度
    if (newWidth < 280) newWidth = 280
    if (newWidth > 500) newWidth = 500
    sidebarWidth.value = newWidth
  }

  const onMouseUp = () => {
    isResizing = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// 获取文件夹名称
const getFolderName = (folderId) => {
  if (!folderId) return '根目录'

  // 递归查找文件夹名称
  const findFolder = (folders, id) => {
    for (const folder of folders) {
      if (folder.id === id) {
        return folder.name
      }
      if (folder.children && folder.children.length > 0) {
        const found = findFolder(folder.children, id)
        if (found) return found
      }
    }
    return null
  }

  return findFolder(folderTreeData.value, folderId) || '根目录'
}

// 将“逻辑空间编码”（数据字典中的 key_code）映射为后端实际支持的空间类型
// 当前后端只支持 PUBLIC / PERSONAL 两种空间类型：
// - PUBLIC：公共空间（带权限系统）
// - PERSONAL：个人空间（绝对私有）
// 其他新空间暂时复用 PERSONAL 的后端行为（仅影响权限/存储逻辑，不影响左侧展示名称）
const getBackendSpaceType = (spaceCode) => {
  if (spaceCode === 'PUBLIC') return 'PUBLIC'
  if (spaceCode === 'PERSONAL') return 'PERSONAL'
  if (spaceCode === 'PROJECT') return 'PROJECT'
  // 新增空间默认按个人空间处理，后续如需新增真实空间类型需同时扩展后端 FolderService 逻辑
  return 'PERSONAL'
}

// 判断当前空间根节点是否允许创建文件夹
// 规则：
// - PUBLIC：只有超级文件管理员可以在根节点创建
// - PERSONAL：当前用户可以在根节点创建
// - 其它新空间类型：暂不允许在根节点创建（仅作为预留入口）
const canCreateInSpace = (spaceNode) => {
  if (!spaceNode || !spaceNode.isSpaceRoot) return false
  if (spaceNode.folder_type === 'PUBLIC') {
    return !!spaceNode.is_super_admin
  }
  if (spaceNode.folder_type === 'PERSONAL') {
    return true
  }
  // PROJECT 空间根节点不允许手动创建（由同步产生）
  return false
}

// 文件空间类型映射：{ PUBLIC: '公共空间', PERSONAL: '个人空间', ... }
const spaceLabelMap = computed(() => {
  const map = {}
  spaceList.value.forEach((item) => {
    if (item && item.key_code) {
      map[item.key_code] = item.label || item.key_code
    }
  })
  return map
})

// 获取当前空间的显示名称（优先使用数据字典配置）
const getCurrentSpaceLabel = () => {
  if (!currentSpaceType.value) return ''
  return spaceLabelMap.value[currentSpaceType.value] || currentSpaceType.value
}

// 获取当前“位置”列展示的文本：空间名/文件夹名
const getCurrentLocationLabel = () => {
  const path = getFolderPath(currentFolder.value)
  // 确保始终返回完整路径，即使是在根节点时也显示空间名称
  if (path.length > 0) {
    return path.join('/')
  }
  // 如果没有路径，返回当前空间名称
  return getCurrentSpaceLabel() || ''
}

// 获取引用文件夹的源路径（在公共空间树中查找）
const getReferenceSourcePath = () => {
  if (!currentFolderRefInfo.value?.ref_target_id) return '未知路径'
  const targetId = currentFolderRefInfo.value.ref_target_id
  // 在公共空间树中查找源文件夹
  const publicSpaceNode = folderTreeData.value.find(n => n.folder_type === 'PUBLIC')
  if (!publicSpaceNode) return '未知路径'

  const findPath = (nodes, id, path) => {
    for (const n of nodes || []) {
      if (n.id === id) {
        return [...path, n.name]
      }
      if (n.children?.length) {
        const found = findPath(n.children, id, [...path, n.name])
        if (found) return found
      }
    }
    return null
  }

  const result = findPath(publicSpaceNode.children, targetId, [publicSpaceNode.name])
  return result ? result.join(' / ') : '未知路径'
}

// 获取当前文件夹的权限信息
const getCurrentFolderPermission = () => {
  if (!currentFolder.value) return null

  // 递归查找文件夹权限
  const findFolder = (folders, id) => {
    for (const folder of folders) {
      if (folder.id === id) {
        return folder.permission || 'NONE'
      }
      if (folder.children && folder.children.length > 0) {
        const found = findFolder(folder.children, id)
        if (found) return found
      }
    }
    return null
  }

  return findFolder(folderTreeData.value, currentFolder.value) || 'NONE'
}

// 判断当前文件夹是否为 OSS 文件夹或其子文件夹（需禁用上传/重命名/删除等）
const isOssFolderOrDescendant = computed(() => {
  if (!currentFolder.value) return false
  const folder = findFolderInTree(currentFolder.value)
  if (!folder) return false
  const checkOss = (node) => {
    const src = (node?.source || 'LOCAL').toUpperCase()
    if (src === 'OSS') return true
    if (node?.parent_folder_id) {
      const parent = findFolderInTree(node.parent_folder_id)
      return parent ? checkOss(parent) : false
    }
    return false
  }
  return checkOss(folder)
})

// 判断当前文件夹是否只有查看权限（READ），或为 OSS 映射文件夹（只读）
// 项目空间下超级文件管理员不是只读
const isReadOnlyFolder = computed(() => {
  const permission = getCurrentFolderPermission()
  const byPermission = permission === 'READ' || !permission || permission === 'NONE'
  // 引用文件夹禁止上传（引用文件夹是只读映射）
  if (currentFolderRefInfo.value?.isReference) {
    return true
  }
  // 项目空间下 PROJECT / GROUP / YEAR / UNIT 节点禁止直接上传文件
  const folder = findFolderInTree(currentFolder.value)
  if (
    folder?.folder_type === 'PROJECT' &&
    (folder?.node_type === 'PROJECT' ||
      folder?.node_type === 'GROUP' ||
      folder?.node_type === 'YEAR' ||
      folder?.node_type === 'UNIT')
  ) {
    return true
  }
  // 项目空间下超级文件管理员可以上传
  if (currentFolder.value?.folder_type === 'PROJECT' && isSuperFileAdmin()) {
    return false
  }
  return byPermission || isOssFolderOrDescendant.value
})

// 选中的文件中是否包含 OSS 文件（OSS 文件禁止批量删除）
const hasOssInSelected = computed(() => selectedFiles.value.some(f => f.is_oss))

/** 选中行中「解析完成」数量（与列表列 parsed 一致，展示文案为已完成） */
const selectedParsedDoneCount = computed(() =>
  selectedFiles.value.filter((f) => resolveStatusValue(f) === '2').length
)
/** 选中行中「未解析」数量 */
const selectedUnparsedCount = computed(() =>
  selectedFiles.value.filter((f) => resolveStatusValue(f) === '0').length
)
/** 选中行中「解析中」数量（用于补充说明） */
const selectedParsingCount = computed(() =>
  selectedFiles.value.filter((f) => resolveStatusValue(f) === '1').length
)

// 工具栏搜索：换条件时从第一页请求（与服务端分页一致）
const handleToolbarSearch = () => {
  query.page = 1
  loadFileList()
}

/**
 * 解析状态筛选变更：重置页码并刷新列表（query.parse_status 与接口 parse_status 一致，值为 0/1/2/3）
 * @param {string} val - 字典 value：'' | '0' | '1' | '2' | '3'
 */
const handleDocumentParseStatusChange = (val) => {
  if (val == null || val === undefined) {
    query.parse_status = ''
  }
  query.page = 1
  loadFileList()
}

// 筛选处理（扩展名与 MIME 类条件互斥）
const handleFilterCommand = (command) => {
  query.page = 1
  query.mime_type = ''
  query.file_ext = ''
  if (command === 'all') {
    // 已清空
  } else if (command === 'image') {
    query.mime_type = 'image/'
  } else if (command === 'other') {
    query.mime_type = 'other'
  } else if (typeof command === 'string' && command.startsWith('ext:')) {
    const ext = command.slice(4).trim().toLowerCase()
    if (ext) query.file_ext = ext
  }
  loadFileList()
}

// 文件夹点击
const handleFolderClick = async (data) => {
  // 如果是空间根节点，更新当前空间类型并取消选中
  if (data.isSpaceRoot) {
    updateCurrentSpaceType(data.folder_type)
    currentFolder.value = null
    currentFolderRefInfo.value = null
    query.page = 1
    // 点击空间根节点时，按空间递归加载该空间下所有可见文件
    await loadFileList()
    return
  }

  // 权限检查：如果用户对该文件夹没有权限（NONE），直接提示，不进行加载
  if (data.permission === 'NONE' || !data.permission) {
    ElMessage.warning('您没有查看此文件夹的权限')
    return
  }

  // 如果点击的是已选中的文件夹，则取消选中，回到当前空间根列表（默认个人空间）
  if (currentFolder.value === data.id) {
    currentFolder.value = null
    currentFolderRefInfo.value = null
    query.page = 1
    loadFileList()
    return
  }
  // 选中新文件夹，并更新当前空间类型
  updateCurrentSpaceType(data.folder_type)
  currentFolder.value = data.id
  // 记录引用信息（如果是引用文件夹）
  if (data.is_reference) {
    currentFolderRefInfo.value = {
      isReference: true,
      ref_target_id: data.ref_target_id,
      ref_target_space: data.ref_target_space
    }
  } else {
    currentFolderRefInfo.value = null
  }
  query.page = 1
  loadFileList()
}

// 权限检查方法
// 判断是否可以显示"更多"按钮
const canShowMoreButton = (data) => {
  // 如果是空间根节点，不显示
  if (data.isSpaceRoot) {
    return false
  }

  // OSS 同步文件夹（项目资料、小组资料）完全只读，不显示更多按钮
  if (isOssFolder(data)) {
    return false
  }

  // 年度、审计单位节点不显示更多按钮，因为其下不可操作
  if (data.folder_type === 'PROJECT' && (data.node_type === 'YEAR' || data.node_type === 'UNIT')) {
    return false
  }

  // 项目空间下超级文件管理员始终显示"更多"按钮
  if (data.folder_type === 'PROJECT' && isSuperFileAdmin()) {
    return true
  }

  // 项目空间的项目根节点和小组节点：有 MANAGE/MANAGE_PROJECT/IMPORT_FOLDER 权限时显示更多按钮
  if (data.folder_type === 'PROJECT' &&
    (data.node_type === 'PROJECT' || data.node_type === 'GROUP') &&
    (data.user_permissions?.includes('MANAGE') ||
     data.user_permissions?.includes('MANAGE_PROJECT') ||
     data.user_permissions?.includes('IMPORT_FOLDER'))) {
    return true
  }

  // 如果没有权限信息，默认不显示
  if (!data.permission) {
    return false
  }

  // 引用文件夹：有 REMOVE_REF_FOLDER 权限时显示更多按钮（用于"取消引入"）
  if (data.is_reference && data.user_permissions?.includes('REMOVE_REF_FOLDER')) {
    return true
  }

  // 只有FULL权限才显示"更多"按钮
  // 被授权用户也应该能看到"更多"按钮，以便进行创建文件夹等操作
  if (data.permission === 'FULL') {
    return true
  }

  return false
}

// 判断项目空间同步节点（不可操作：年份、审计单位、项目、小组）
const isProjectSpaceFixedNode = (data) => {
  if (data.folder_type !== 'PROJECT') return false
  const fixedTypes = ['YEAR', 'UNIT', 'PROJECT', 'GROUP']
  return fixedTypes.includes(data.node_type)
}

// 判断是否为 OSS 文件夹（智能作业平台推送，只读）
const isOssFolder = (data) => {
  return data.is_oss_folder === true
}

// 判断是否可以查看审计小组（仅项目根节点）
const canViewProjectGroups = (data) => {
  return data.folder_type === 'PROJECT' && data.node_type === 'PROJECT'
}

// 判断是否可以引入外部文件夹（项目空间的项目根节点和小组节点）
const canImportFolder = (data) => {
  if (data.folder_type !== 'PROJECT') return false
  if (isOssFolder(data)) return false
  // 项目根节点（PROJECT）和小组节点（GROUP）且 user_permissions 包含 IMPORT_FOLDER 才能引入
  return (data.node_type === 'PROJECT' || data.node_type === 'GROUP') &&
    data.user_permissions?.includes('IMPORT_FOLDER')
}

// 判断是否可以取消引入（引用文件夹）
const canRemoveRefFolder = (data) => {
  if (data.folder_type !== 'PROJECT') return false
  if (!data.is_reference) return false
  // user_permissions 包含 REMOVE_REF_FOLDER 才能取消引入
  return data.user_permissions?.includes('REMOVE_REF_FOLDER')
}

// 判断是否可以创建文件夹
// PROJECT 空间：年度节点、OSS 文件夹、引用文件夹不允许创建子文件夹
// 项目根节点（PROJECT）和小组节点（GROUP）允许创建子文件夹
const canCreateFolder = (data) => {
  if (data.bound_org_uuid) {
    return false
  }
  // OSS 文件夹不允许创建子文件夹
  if (isOssFolder(data)) {
    return false
  }
  // 引用文件夹不允许创建子文件夹
  if (data.is_reference) {
    return false
  }
  // PROJECT 空间：年度/审计单位节点不允许创建子文件夹，但项目根节点和小组节点允许
  if (data.folder_type === 'PROJECT' && (data.node_type === 'YEAR' || data.node_type === 'UNIT')) {
    return false
  }
  // 项目空间的 PROJECT/GROUP 节点：有 MANAGE/MANAGE_PROJECT/UPLOAD 权限可以创建
  if (data.folder_type === 'PROJECT' &&
      (data.node_type === 'PROJECT' || data.node_type === 'GROUP') &&
      (data.user_permissions?.includes('MANAGE') ||
       data.user_permissions?.includes('MANAGE_PROJECT') ||
       data.user_permissions?.includes('UPLOAD'))) {
    return true
  }

  // 项目空间下超级文件管理员可以创建文件夹
  if (data.folder_type === 'PROJECT' && isSuperFileAdmin()) {
    return true
  }

  return data.permission === 'FULL'
}

// 判断是否可以重命名文件夹
// PROJECT 空间：同步节点（年份/项目/小组）和 OSS 文件夹不允许重命名
// 超级文件管理员在项目空间的自定义文件夹下有特权
const canRenameFolder = (data) => {
  if (isProjectSpaceFixedNode(data) || isOssFolder(data)) {
    return false
  }
  const builtin = data.is_system_builtin === true || data.is_system_builtin === 1
  if (builtin) {
    return isSuperFileAdmin()
  }
  // 项目空间自定义文件夹：有 MANAGE/MANAGE_PROJECT 权限可以重命名
  if (data.folder_type === 'PROJECT' &&
      (data.user_permissions?.includes('MANAGE') || data.user_permissions?.includes('MANAGE_PROJECT'))) {
    return true
  }

  // 项目空间下超级文件管理员可以重命名自定义文件夹
  if (data.folder_type === 'PROJECT' && isSuperFileAdmin()) {
    return true
  }

  return data.is_creator === true
}

// 是否显示「未分配权限」图标（OSS 同步文件夹 或 无授权记录的旧文件夹）
// 对 source!=LOCAL 的文件夹：使用后端根据权限记录计算的 show_no_permission_icon
// 对 source=LOCAL 的旧文件夹：使用 grant_count / has_permission_grants
const showNoPermissionAssignIcon = (data) => {
  if (data.isSpaceRoot || data.folder_type !== 'PUBLIC') return false
  // source != 'LOCAL' 的文件夹：使用后端计算的 show_no_permission_icon（机构/用户授权，排除超级文件管理员）
  const src = (data.source || 'LOCAL').toUpperCase()
  if (src !== 'LOCAL') {
    return data.show_no_permission_icon === true
  }
  // 旧的未分配权限的文件夹（后端返回 grant_count 或 has_permission_grants）
  if (data.grant_count === 0 || data.has_permission_grants === false) return true
  return false
}

// 判断是否可以管理权限
const canManagePermission = (data) => {
  const builtin = data.is_system_builtin === true || data.is_system_builtin === 1
  if (builtin && !isSuperFileAdmin()) {
    return false
  }
  // 个人空间和项目空间不展示权限管理按钮（项目空间权限由审计系统角色控制）
  if (data.folder_type === 'PERSONAL' || data.folder_type === 'PROJECT') {
    return false
  }
  // 只有拥有分权权限的用户可以管理权限
  // 分权权限：permission === 'FULL' 且 can_delegate === true
  if (data.permission !== 'FULL' || !data.can_delegate) return false
  // 未分配权限的文件夹：仅超级文件管理员可管理
  if (showNoPermissionAssignIcon(data)) {
    return isSuperFileAdmin()
  }
  return true
}

// 判断是否可以绑定项目
const canBindProject = (data) => {
  const builtin = data.is_system_builtin === true || data.is_system_builtin === 1
  if (builtin) {
    return isSuperFileAdmin()
  }
  // 只有创建者或超级管理员可以绑定项目
  return data.permission === 'FULL' && (data.is_creator || data.is_super_admin)
}

const canBindOrg = (data) => {
  if (data.isSpaceRoot || data.folder_type !== 'PUBLIC') return false
  return isSuperFileAdmin()
}

// 判断是否可以删除文件夹
// PROJECT 空间：同步节点（年份/项目/小组）和 OSS 文件夹不允许删除
// 超级文件管理员在项目空间的自定义文件夹下有特权
const canDeleteFolder = (data) => {
  if (isProjectSpaceFixedNode(data) || isOssFolder(data)) {
    return false
  }
  const builtin = data.is_system_builtin === true || data.is_system_builtin === 1
  if (builtin) {
    return data.permission === 'FULL' && isSuperFileAdmin()
  }
  // 项目空间自定义文件夹：有 MANAGE/MANAGE_PROJECT 权限可以删除
  if (data.folder_type === 'PROJECT' &&
      (data.user_permissions?.includes('MANAGE') || data.user_permissions?.includes('MANAGE_PROJECT'))) {
    return true
  }

  // 项目空间下超级文件管理员可以删除自定义文件夹
  if (data.folder_type === 'PROJECT' && isSuperFileAdmin()) {
    return true
  }

  // 被授权用户不能删除被授权的文件夹（仅公共空间逻辑）
  if (data.folder_type !== 'PROJECT' && data.is_granted_to_user && !data.is_creator) {
    return false
  }

  // 只有创建者或超级管理员可以删除
  return data.permission === 'FULL' && (data.is_creator || data.is_super_admin)
}

// 文件夹操作（更多菜单）
const handleFolderAction = (command, data) => {
  if (command === 'view-groups') {
    // 查看审计小组：传入项目ID（SJS_GLS_DW_PROJECT.pk_id）
    openProjectGroupsDialog(data.project_id || data.id)
  } else if (command === 'create') {
    // 更新当前空间类型
    updateCurrentSpaceType(data.folder_type)
    openCreateFolderDialog(data.id, data.folder_type)
  } else if (command === 'rename') {
    // 先选中该文件夹并更新空间类型
    updateCurrentSpaceType(data.folder_type)
    currentFolder.value = data.id
    openRenameFolderDialog()
  } else if (command === 'import-folder') {
    // 引入外部文件夹到项目空间
    openImportFolderDialog(data.id)
  } else if (command === 'remove-ref') {
    // 取消引入（移除引用关系）
    ElMessageBox.confirm('确定取消引入该文件夹吗？', '提示', { type: 'warning' }).then(async () => {
      try {
        const res = await removeFolderReferenceAPI(data.id)
        if (res.code !== 200) {
          ElMessage.error(res.msg || '取消引入失败')
          return
        }
        // 从前端树中删除引用节点
        deleteFolderFromTreeLocal(folderTreeData.value, data.id)
        // 如果当前选中的是这个引用文件夹，清空文件列表
        if (currentFolder.value === data.id) {
          currentFolder.value = null
          currentFolderRefInfo.value = null
          fileList.value = []
          total.value = 0
        }
        ElMessage.success('已取消引入')
      } catch (e) {
        ElMessage.error('取消引入失败')
      }
    }).catch(() => {})
  } else if (command === 'permission') {
    // 先选中该文件夹并更新空间类型
    updateCurrentSpaceType(data.folder_type)
    currentFolder.value = data.id
    openPermissionDialog()
  } else if (command === 'bind-project') {
    // 先选中该文件夹并更新空间类型
    updateCurrentSpaceType(data.folder_type)
    currentFolder.value = data.id
    openBindProjectDialog()
  } else if (command === 'bind-org') {
    updateCurrentSpaceType(data.folder_type)
    currentFolder.value = data.id
    openBindOrgDialog()
  } else if (command === 'delete') {
    // 先选中该文件夹并更新空间类型
    updateCurrentSpaceType(data.folder_type)
    currentFolder.value = data.id
    handleDeleteFolder()
  }
}

// 打开引入文件夹对话框
const openImportFolderDialog = async (targetFolderId) => {
  importFolderTargetId.value = targetFolderId
  importFolderDialogVisible.value = true
  importFolderLoading.value = true
  selectedImportFolderId.value = null
  try {
    const res = await getFolderTreeAPI({ space_type: 'PUBLIC' })
    if (res.code === 200) {
      // 通过 convertTreeData 转换字段名，使 folder_name -> name 等，匹配 el-tree props
      publicFolderTreeDataForImport.value = convertTreeData(res.data || [], null, 'PUBLIC')
    }
  } catch (e) {
    ElMessage.error('加载公共空间文件夹失败')
  } finally {
    importFolderLoading.value = false
  }
}

// 打开查看审计小组对话框
const openProjectGroupsDialog = async (projectId) => {
  try {
    const res = await getProjectGroupsAPI({ project_id: projectId })
    if (res.code === 200 && res.data) {
      currentProjectGroups.value = res.data.groups || []
      projectGroupsDialogVisible.value = true
    } else {
      ElMessage.warning('暂无审计小组信息')
    }
  } catch (e) {
    ElMessage.error('获取审计小组失败')
  }
}

// 引入文件夹树选中变化
const handleImportFolderCheck = (data, checked) => {
  if (checked) {
    selectedImportFolderId.value = data.id
    importFolderTreeRef.value?.setCheckedKeys([data.id])
  } else {
    selectedImportFolderId.value = null
  }
}

// 确认引入文件夹
const handleImportFolderConfirm = async () => {
  if (!selectedImportFolderId.value || !importFolderTargetId.value) return
  try {
    const res = await importFolderAPI({
      target_folder_id: importFolderTargetId.value,
      source_folder_id: selectedImportFolderId.value,
      source_space_type: 'PUBLIC'
    })
    if (res.code !== 200) {
      ElMessage.error(res.msg || '引入失败')
      return
    }
    ElMessage.success('引入成功')
    importFolderDialogVisible.value = false

    // 在前端树中实时插入引用节点
    const targetNode = findFolderNodeById(folderTreeData.value, importFolderTargetId.value)
    const sourceNode = findFolderNodeById(publicFolderTreeDataForImport.value, selectedImportFolderId.value)
    if (targetNode && sourceNode) {
      if (!targetNode.children) targetNode.children = []
      // 从目标节点继承 user_permissions，确保引用文件夹也能显示"取消引入"按钮
      const parentPermissions = targetNode.user_permissions || []
      const refNode = {
        name: `引入-${sourceNode.name}`,
        id: res.data?.ref_id || `ref_${Date.now()}`,
        parent_folder_id: targetNode.id,
        folder_type: 'PROJECT',
        isSpaceRoot: false,
        permission: parentPermissions.includes('REMOVE_REF_FOLDER') ? 'FULL' : 'READ',
        user_permissions: parentPermissions,
        is_reference: true,
        ref_target_id: selectedImportFolderId.value,
        ref_target_space: 'PUBLIC',
        node_type: 'FOLDER',
        children: []
      }
      targetNode.children.push(refNode)
      // 展开目标节点，让新插入的引用节点可见
      expandedKeys.value = [...new Set([...expandedKeys.value, targetNode.id])]
      await nextTick()
      folderTreeRef.value?.setExpandedKeys?.(expandedKeys.value)
    }
  } catch (e) {
    ElMessage.error('引入失败')
  }
}

// 切换空间类型（当点击空间根节点时更新当前空间类型）
const updateCurrentSpaceType = (spaceType) => {
  currentSpaceType.value = spaceType
}

// 聚焦视图：根据树选范围同步当前文件夹与文件列表
const applyFocusedScopeSync = async () => {
  if (sidebarViewMode.value !== 'focused' || focusedScopeNodeId.value == null || focusedScopeNodeId.value === '') {
    return
  }
  const scopeNode = getEffectiveScopeNodeForFocus(focusedScopeNodeId.value)
  if (!scopeNode) return
  updateCurrentSpaceType(scopeNode.folder_type)
  if (currentFolder.value && !isDescendantOfScopeNode(scopeNode, currentFolder.value)) {
    currentFolder.value = null
  }
  query.page = 1
  if (currentFolder.value) {
    await loadFileList()
  } else {
    const sidebarRoots = focusedSidebarRootsFromScopeRoot(scopeNode)
    const firstInSidebar = findFirstViewableFolderInFocusedSidebarRoots(sidebarRoots)
    if (firstInSidebar) {
      currentFolder.value = firstInSidebar
      await loadFileList()
    } else if (scopeNode.isSpaceRoot) {
      await loadFileList()
    } else {
      currentFolder.value = scopeNode.id
      await loadFileList()
    }
  }
}

/**
 * 首屏在文件夹树就绪后再拉列表：聚焦模式下等 focusedScopeNodeId 由 watch 异步落盘，再 applyFocusedScopeSync；
 * 否则直接 loadFileList（默认个人空间）。避免与树并行请求导致后返回的旧数据覆盖新数据。
 */
const bootstrapInitialFileList = async () => {
  await nextTick()
  await nextTick()
  // 树未返回前 folderTree 可能仍为空，聚焦范围 ID 与树异步落盘，需等待以免误走 by-space
  const maxWaitMs = 10000
  const step = 30
  let elapsed = 0
  while (
    sidebarViewMode.value === 'focused' &&
    (focusedScopeNodeId.value == null || focusedScopeNodeId.value === '') &&
    elapsed < maxWaitMs
  ) {
    await new Promise((r) => setTimeout(r, step))
    elapsed += step
  }
  if (sidebarViewMode.value === 'focused' && focusedScopeNodeId.value) {
    await applyFocusedScopeSync()
    return
  }
  await loadFileList()
}

const toggleSidebarViewMode = async () => {
  if (sidebarViewMode.value === 'full') {
    await Promise.all([
      ensureUserOrgPathFromApi(),
      ensureUserLeafOrguuidFromSjry(),
      ensureOrgTreeForPathLookup()
    ])
    const scopeRoots = buildFocusedScopeTreeSelectRoots()
    const prevId = focusedScopeNodeId.value
    if (!(prevId != null && prevId !== '' && isSelectableInScopeTree(scopeRoots, prevId))) {
      const pick = pickDefaultFocusedScopeNodeId(scopeRoots)
      focusedScopeNodeId.value = pick != null && pick !== '' ? pick : null
    }
    sidebarViewMode.value = 'focused'
  } else {
    sidebarViewMode.value = 'full'
  }
}

watch(
  () => [sidebarViewMode.value, focusedScopeNodeId.value],
  () => {
    if (sidebarViewMode.value !== 'focused') return
    if (focusedScopeNodeId.value == null || focusedScopeNodeId.value === '') return
    nextTick(() => {
      applyFocusedScopeSync()
    })
  }
)

watch(
  () => ({
    mode: sidebarViewMode.value,
    tree: folderTreeData.value,
    scope: focusedScopeTreeSelectData.value
  }),
  () => {
    if (sidebarViewMode.value !== 'focused') return
    const tree = folderTreeData.value
    if (!tree?.length) {
      focusedScopeNodeId.value = null
      return
    }
    const scopeData = focusedScopeTreeSelectData.value || []
    if (!scopeData.length) {
      focusedScopeNodeId.value = null
      return
    }
    const id = focusedScopeNodeId.value
    if (id == null || id === '' || !isSelectableInScopeTree(scopeData, id)) {
      void (async () => {
        await Promise.all([
          ensureUserOrgPathFromApi(),
          ensureUserLeafOrguuidFromSjry(),
          ensureOrgTreeForPathLookup()
        ])
        if (sidebarViewMode.value !== 'focused') return
        const latest = focusedScopeTreeSelectData.value || []
        if (!latest.length) return
        const next = pickDefaultFocusedScopeNodeId(latest)
        focusedScopeNodeId.value = next != null && next !== '' ? next : null
      })()
    }
  },
  { deep: true }
)

// 删除文件夹
const handleDeleteFolder = () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择要删除的文件夹')
    return
  }

  const folderName = getFolderName(currentFolder.value)

  ElMessageBox.confirm(
    `确认删除文件夹「${folderName}」？该操作不可恢复，请谨慎操作。`,
    '提示',
    {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    }
  ).then(async () => {
    const folderIdToDelete = currentFolder.value
    const expandedSnapshot = folderTreeRef.value?.getExpandedKeys
      ? [...folderTreeRef.value.getExpandedKeys()]
      : [...expandedKeys.value]
    folderLoading.value = true
    let deleteSucceeded = false
    try {
      const res = await deleteFolderAPI(folderIdToDelete)
      if (res.code === 200) {
        currentFolder.value = null
        deleteSucceeded = true
      } else {
        ElMessage.error(res.msg || '删除文件夹失败')
      }
    } catch (error) {
      console.error('删除文件夹失败:', error)
      ElMessage.error(error.response?.data?.msg || '删除文件夹失败')
    } finally {
      folderLoading.value = false
    }
    if (!deleteSucceeded) return
    const removed = deleteFolderFromTreeLocal(folderTreeData.value, folderIdToDelete)
    if (!removed) {
      await loadFolderTree(null, false, {
        preserveExpanded: true,
        expandedKeysSnapshot: expandedSnapshot
      })
    }
    await loadFileList()
    await nextTick()
    await nextTick()
    ElMessage.success('删除文件夹成功')
    if (currentSpaceType.value === 'PERSONAL') {
      loadPersonalStorageInfo()
    }
  }).catch(() => {
    folderLoading.value = false
  })
}

// 打开重命名文件对话框
const openRenameFileDialog = (row) => {
  renameFileForm.file_id = row.file_id
  renameFileForm.file_name = row.original_name
  renameFileDialogVisible.value = true
}

// 确认重命名文件
const handleRenameFileConfirm = async () => {
  if (!renameFileForm.file_id) {
    ElMessage.warning('文件ID不存在')
    return
  }
  if (!renameFileForm.file_name.trim()) {
    ElMessage.warning('请填写新的文件名称')
    return
  }
  renameFileLoading.value = true
  try {
    const res = await renameFileAPI(renameFileForm.file_id, {
      file_name: renameFileForm.file_name.trim()
    })
    if (res.code === 200) {
      ElMessage.success('重命名文件成功')
      renameFileDialogVisible.value = false
      renameFileForm.file_id = null
      renameFileForm.file_name = ''
      invalidateMergedSpacesCache()
      await loadFileList()
    } else {
      ElMessage.error(res.msg || '重命名文件失败')
    }
  } catch (error) {
    console.error('重命名文件失败:', error)
    // 优化错误提示：针对文件重名的情况显示友好提示
    const errorData = error.response?.data
    const errorMsg = errorData?.msg || errorData?.detail || ''

    if (errorMsg.includes('同名文件') || errorMsg.includes('已存在')) {
      ElMessage.warning('文件名称重复，请使用其他名称')
    } else if (errorMsg) {
      ElMessage.error(errorMsg)
    } else {
      ElMessage.error('重命名文件失败，请稍后重试')
    }
  } finally {
    renameFileLoading.value = false
  }
}

// 打开移动文件对话框
const openMoveFileDialog = (row) => {
  moveFileForm.file_id = row.file_id
  moveFileForm.target_folder_id = null
  moveFileDialogVisible.value = true
}

// 选择移动文件的目标
const handleMoveFileTargetSelect = (data) => {
  // 不能移动到空间根节点
  if (data.isSpaceRoot) {
    ElMessage.warning('不能移动到空间根节点')
    return
  }
  moveFileForm.target_folder_id = data.id
}

// 确认移动文件
const handleMoveFileConfirm = async () => {
  if (!moveFileForm.file_id) {
    ElMessage.warning('文件ID不存在')
    return
  }
  if (!moveFileForm.target_folder_id) {
    ElMessage.warning('请选择目标文件夹')
    return
  }
  moveFileLoading.value = true
  try {
    const res = await moveFileAPI(moveFileForm.file_id, {
      target_folder_id: moveFileForm.target_folder_id
    })
    if (res.code === 200) {
      ElMessage.success('移动文件成功')
      moveFileDialogVisible.value = false
      moveFileForm.file_id = null
      moveFileForm.target_folder_id = null
      invalidateMergedSpacesCache()
      await loadFileList()
      await loadFolderTree(null, true, { preserveExpanded: true })
    } else {
      ElMessage.error(res.msg || '移动文件失败')
    }
  } catch (error) {
    console.error('移动文件失败:', error)
    // 优化错误提示：针对文件重名的情况显示友好提示
    const errorData = error.response?.data
    const errorMsg = errorData?.msg || errorData?.detail || ''

    if (errorMsg.includes('同名文件') || errorMsg.includes('已存在')) {
      ElMessage.warning('目标文件夹中已存在同名文件，请先重命名或删除')
    } else if (errorMsg) {
      ElMessage.error(errorMsg)
    } else {
      ElMessage.error('移动文件失败，请稍后重试')
    }
  } finally {
    moveFileLoading.value = false
  }
}

// 上传下拉菜单命令处理
const handleUploadCommand = (command) => {
  if (isReadOnlyFolder.value) return
  if (command === 'file') {
    handleImport()
  } else if (command === 'folder') {
    if (!supportsWebkitDirectory.value) {
      ElMessage.warning('当前浏览器不支持文件夹上传，请使用 Chrome/Edge 浏览器')
      return
    }
    handleFolderUploadClick()
  }
}

// 导入文件
const handleImport = () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择文件夹')
    return
  }

  // 尝试多种方式触发文件选择
  if (uploadRef.value) {
    // 方法1: 直接访问 $el
    const input1 = uploadRef.value.$el?.querySelector('input[type="file"]')
    if (input1) {
      input1.click()
      return
    }

    // 方法2: 访问 $el 的 firstElementChild
    const el = uploadRef.value.$el
    if (el) {
      const input2 = el.querySelector('input[type="file"]') || el.firstElementChild?.querySelector('input[type="file"]')
      if (input2) {
        input2.click()
        return
      }
    }

    // 方法3: 尝试访问 refs
    if (uploadRef.value.$refs && uploadRef.value.$refs.input) {
      uploadRef.value.$refs.input.click()
      return
    }

    console.error('无法找到上传组件的input元素', uploadRef.value)
  } else {
    console.error('上传组件引用不存在')
  }
}

// 上传前处理
const beforeUpload = (file) => {
  const maxSize = 100 * 1024 * 1024 // 100MB
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过100MB')
    return false
  }
  // 不在这里阻止上传，让 handleFileChange 处理重名检查
  return true
}

// 文件选择变化处理（用于重名检查）
let checkTimer = null
const handleFileChange = (file, fileList) => {
  // 如果对话框已打开，说明正在处理重名，不重复处理
  if (duplicateDialogVisible.value) {
    return
  }

  // 清除之前的定时器
  if (checkTimer) {
    clearTimeout(checkTimer)
  }

  // 等待文件列表稳定（el-upload 的 change 事件可能触发多次）
  checkTimer = setTimeout(() => {
    if (duplicateDialogVisible.value) {
      return
    }

    // 直接从 fileList 参数获取文件，而不是从 uploadComponent.uploadFiles
    // 因为设置了 :auto-upload="false"，文件不会自动添加到 uploadFiles
    if (!fileList || fileList.length === 0) {
      return
    }

    // 获取所有新添加的文件（状态为 ready 或未设置状态，或者没有 status 属性）
    const readyFiles = fileList.filter(f => {
      const status = f.status
      // 过滤掉已经上传成功或失败的文件
      return status !== 'success' && status !== 'fail'
    })

    if (readyFiles.length === 0) {
      return
    }

    // 检查重名（后端校验，处理完后再上传）
    checkDuplicateFiles(readyFiles)
  }, 200)
}

// 清除上传进度列表（需确认）
const handleClearUploadTasks = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清除上传进度列表吗？清除后仅隐藏进度展示，已在进行的上传请求不会中断。',
      '确认清除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    uploadTasks.value = []
  } catch {
    // 用户取消
  }
}

// 检查重名文件（调用后端 batch-check-upload-conflicts，确认后再上传）
const checkDuplicateFiles = async (files) => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择文件夹')
    if (uploadRef.value) {
      uploadRef.value.clearFiles()
    }
    return
  }

  let loadingInstance = null
  try {
    loadingInstance = ElLoading.service({
      lock: true,
      text: '正在检测文件是否重复...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    const fileNames = files
      .map((f) => f.name || f.raw?.name || '')
      .filter(Boolean)

    const res = await batchCheckUploadConflictsAPI({
      folder_items: [
        {
          folder_id: currentFolder.value,
          file_names: [...new Set(fileNames)]
        }
      ]
    })
    if (res.code !== 200 || !res.data) {
      throw new Error(res.msg || '检测文件重复失败')
    }

    const conflictResults = res.data.results || []
    const existingNames = new Set()
    conflictResults.forEach((r) => {
      ;(r.existing_file_names || []).forEach((n) => existingNames.add(normalizeNameForDuplicateCheck(n)))
      ;(r.existing_folder_names || []).forEach((n) => existingNames.add(String(n).toLowerCase()))
    })

    // 同文件夹内正在上传的文件仍在前端补充校验，避免并发选同名文件
    const uploadingFileNames = new Set(
      uploadTasks.value
        .filter((t) => t.folderId === currentFolder.value && t.status === 'uploading')
        .map((t) => normalizeNameForDuplicateCheck(t.fileName))
    )

    const duplicates = []
    const uniqueFiles = []

    files.forEach((file) => {
      const fileName = file.name || file.raw?.name || ''
      const normalized = normalizeNameForDuplicateCheck(fileName)
      if (!normalized) {
        return
      }

      if (existingNames.has(normalized) || uploadingFileNames.has(normalized)) {
        duplicates.push({
          fileName,
          file,
          action: 'upload'
        })
      } else {
        uniqueFiles.push(file)
      }
    })

    if (loadingInstance) {
      loadingInstance.close()
      loadingInstance = null
    }

    if (duplicates.length > 0) {
      duplicateFiles.value = duplicates
      pendingFilesQueue.value = uniqueFiles
      duplicateDialogVisible.value = true
      duplicateStrategy.value = null
    } else {
      processUploadFiles(files)
    }
  } catch (e) {
    console.error('检测文件重复异常:', e)
    ElMessage.error(e.message || '检测文件重复失败，请稍后重试')
    if (uploadRef.value) {
      uploadRef.value.clearFiles()
    }
  } finally {
    if (loadingInstance) {
      loadingInstance.close()
    }
  }
}

// 处理文件上传；overwriteLowerNames 为需覆盖同名的文件名小写集合（与重名弹窗「覆盖」一致）
const processUploadFiles = (files, overwriteLowerNames = null) => {
  if (!uploadRef.value || files.length === 0) {
    return
  }

  // 为每个文件创建上传任务
  files.forEach(file => {
    // file 可能是 el-upload 的 file 对象，需要获取 raw 属性
    const fileObj = file.raw || file
    if (fileObj instanceof File) {
      const lower = (fileObj.name || '').toLowerCase()
      const overwrite = Boolean(overwriteLowerNames && overwriteLowerNames.has(lower))
      handleCustomUpload({ file: fileObj, overwrite })
    }
  })

  // 清空上传组件的文件列表
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
}

// 全覆盖所有重名文件
const applyAllOverwrite = () => {
  duplicateFiles.value.forEach(item => {
    item.action = 'upload'
  })
  duplicateStrategy.value = 'all-overwrite'
}

// 全跳过所有重名文件
const applyAllSkip = () => {
  duplicateFiles.value.forEach(item => {
    item.action = 'skip'
  })
  duplicateStrategy.value = 'all-skip'
}

// 确认重名处理对话框
const confirmDuplicateDialog = () => {
  // 处理重名文件
  const filesToUpload = []
  const filesToSkip = []

  duplicateFiles.value.forEach(item => {
    if (item.action === 'upload') {
      filesToUpload.push(item.file)
    } else {
      filesToSkip.push(item.file)
    }
  })

  // 跳过文件提示
  if (filesToSkip.length > 0) {
    ElMessage.info(`已跳过 ${filesToSkip.length} 个重名文件`)
  }

  // 上传需要上传的文件（包括覆盖和新的）
  const allFilesToUpload = [...filesToUpload, ...pendingFilesQueue.value]
  if (allFilesToUpload.length > 0) {
    // 先关闭对话框
    duplicateDialogVisible.value = false
    const filesToProcess = [...allFilesToUpload]
    const overwriteLowerNames = new Set(
      duplicateFiles.value
        .filter((item) => item.action === 'upload')
        .map((item) => (item.fileName || '').toLowerCase())
        .filter(Boolean)
    )
    duplicateFiles.value = []
    pendingFilesQueue.value = []
    duplicateStrategy.value = null

    // 处理上传
    processUploadFiles(filesToProcess, overwriteLowerNames)
  } else {
    // 没有文件需要上传，直接关闭
    duplicateDialogVisible.value = false
    duplicateFiles.value = []
    pendingFilesQueue.value = []
    duplicateStrategy.value = null
  }

  // 清空上传组件的文件列表
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
}

// 取消重名处理对话框
const cancelDuplicateDialog = () => {
  duplicateDialogVisible.value = false
  duplicateFiles.value = []
  pendingFilesQueue.value = []
  duplicateStrategy.value = null

  // 清空上传组件的文件列表
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
}

// 校验本地文件是否仍可读取（Chrome 77 兼容：使用 FileReader 替代 blob.arrayBuffer）
const verifyFileAccessible = (file) => {
  return new Promise((resolve) => {
    try {
      const blob = file.slice(0, 1)
      const reader = new FileReader()
      reader.onload = () => resolve(true)
      reader.onerror = () => resolve(false)
      reader.readAsArrayBuffer(blob)
    } catch (e) {
      resolve(false)
    }
  })
}

const removeUploadTask = (taskId) => {
  const index = uploadTasks.value.findIndex(t => t.id === taskId)
  if (index > -1) {
    const removed = uploadTasks.value.splice(index, 1)[0]
    if (removed?.cacheId && !isPrivateMode.value) {
      deleteUploadRecord(removed.cacheId).catch(() => console.warn('删除上传缓存失败'))
    }
  }
}

// 自定义上传方法（异步，不阻塞UI）
const handleCustomUpload = async (options) => {
  const { file, overwrite = false, targetFolderId: specifiedFolderId } = options

  const targetFolderId = specifiedFolderId || currentFolder.value
  if (!targetFolderId) {
    ElMessage.warning('请先选择文件夹')
    return
  }

  const taskId = Date.now() + Math.random()
  const task = {
    id: taskId,
    fileName: file.name,
    folderId: targetFolderId,
    progress: 0,
    status: 'uploading',
    phase: 'upload',
    postUploadLabel: getUploadPostProgressLabel(file.name),
    error: null,
    skipReason: null,
    cacheId: ''
  }
  uploadTasks.value.push(task)
  uploading.value = true

  ;(async () => {
    try {
      await handleWholeUpload(taskId, file, targetFolderId, overwrite)
    } catch (error) {
      const currentTask = uploadTasks.value.find(t => t.id === taskId)
      if (currentTask && currentTask.status !== 'skipped') {
        currentTask.status = 'error'
        currentTask.phase = 'done'
        currentTask.error = error.response?.data?.msg || error.message || '文件上传失败'
        ElMessage.error(error.response?.data?.msg || error.message || '文件上传失败')
      }
    } finally {
      const hasUploading = uploadTasks.value.some(t => t.status === 'uploading')
      uploading.value = hasUploading
      updateBeforeUnloadListener()
    }
  })()
}

const handleWholeUpload = async (taskId, file, targetFolderId, overwrite) => {
  const accessible = await verifyFileAccessible(file)
  if (!accessible) {
    const currentTask = uploadTasks.value.find(t => t.id === taskId)
    if (currentTask) {
      currentTask.status = 'skipped'
      currentTask.phase = 'done'
      currentTask.skipReason = '文件路径已变更或已被删除'
    }
    return
  }

  let cacheId = ''
  if (!isPrivateMode.value) {
    try {
      const fileHash = await computeFileHash(file)
      cacheId = generateRecordId(fileHash, targetFolderId)
      const currentTask = uploadTasks.value.find(t => t.id === taskId)
      if (currentTask) currentTask.cacheId = cacheId
      await saveUploadRecord({
        id: cacheId,
        file_hash: fileHash,
        file_name: file.name,
        file_size: file.size,
        folder_id: targetFolderId,
        upload_type: 'whole',
        upload_id: '',
        uploaded_chunks: [],
        total_chunks: 0,
        progress: 0,
        status: 'uploading',
        overwrite,
        folder_structure: null,
        ext_filter_result: null,
        created_at: Date.now()
      })
    } catch {
      console.warn('写入上传缓存失败')
    }
  }

  const formData = new FormData()
  formData.append('folder_id', targetFolderId)
  formData.append('file', file)

  const res = await uploadFileAPI(
    formData,
    (progressEvent) => {
      if (progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        const currentTask = uploadTasks.value.find(t => t.id === taskId)
        if (currentTask) {
          currentTask.progress = progress
          if (progress === 100 && currentTask.phase === 'upload' && currentTask.status === 'uploading') {
            currentTask.phase = 'processing'
          }
        }
        if (!isPrivateMode.value && cacheId) {
          saveUploadRecord({
            id: cacheId,
            file_hash: '',
            file_name: file.name,
            file_size: file.size,
            folder_id: targetFolderId,
            upload_type: 'whole',
            upload_id: '',
            uploaded_chunks: [],
            total_chunks: 0,
            progress,
            status: 'uploading',
            overwrite,
            folder_structure: null,
            ext_filter_result: null,
            created_at: Date.now()
          }).catch(() => console.warn('更新上传缓存失败'))
        }
      }
    },
    { overwrite }
  )

  handleUploadResult(taskId, file, targetFolderId, res, overwrite, cacheId)
}

const handleUploadResult = (taskId, file, targetFolderId, res, overwrite, cacheId = '') => {
  const currentTask = uploadTasks.value.find(t => t.id === taskId)
  if (!currentTask) return

  if (res.code === 200 || res.code === 201) {
    currentTask.progress = 100
    currentTask.status = 'success'
    currentTask.phase = 'done'

    if (cacheId) {
      deleteUploadRecord(cacheId).catch(() => console.warn('删除上传缓存失败'))
    }

    ElMessage.success(`文件 "${file.name}"${overwrite ? ' 已覆盖上传' : ' 上传成功'}`)

    if (currentFolder.value === targetFolderId || (!currentFolder.value && currentSpaceType.value)) {
      invalidateMergedSpacesCache()
      if (!folderUploadBatchActive.value) {
        loadFileList()
      }
    }

    if (currentSpaceType.value === 'PERSONAL' && !folderUploadBatchActive.value) {
      loadPersonalStorageInfo()
    }

    setTimeout(() => {
      removeUploadTask(taskId)
    }, 3000)
  } else {
    currentTask.status = 'error'
    currentTask.phase = 'done'
    currentTask.error = res.msg || '文件上传失败'
    ElMessage.error(res.msg || '文件上传失败')
  }
}

// 查看文件内容（FILE_CONTENT）
const handleViewFileContent = async (row) => {
  if (!row || !row.file_id) {
    ElMessage.warning('无法获取文件ID，暂时无法查看内容')
    return
  }
  fileContentTitle.value = `文件内容 - ${row.original_name || row.file_name || ''}`
  showFileContentDialog.value = true
  fileContentLoading.value = true
  currentFileContent.value = ''
  try {
    const res = await getFileContentAPI(row.file_id)
    if (res.code === 200 && res.data) {
      currentFileContent.value = res.data.file_content || ''
    } else {
      ElMessage.error(res.msg || '获取文件内容失败')
    }
  } catch (error) {
    console.error('获取文件内容失败:', error)
    ElMessage.error(error.response?.data?.msg || '获取文件内容失败')
  } finally {
    fileContentLoading.value = false
  }
}

// 获取文件类型（根据mime_type和扩展名）
const getPreviewFileType = (row) => {
  const mimeType = row.mime_type || ''
  const fileName = row.original_name || ''
  const ext = getFileExtension(fileName)

  // 图片类型
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return 'image'
  }

  // PDF文档
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return 'pdf'
  }

  // Word文档（.wps 与 .doc 相同走 LibreOffice 转 docx 预览）
  if (mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ['doc', 'docx', 'wps'].includes(ext)) {
    return ext === 'docx' ? 'docx' : (ext === 'doc' || ext === 'wps' ? 'doc' : 'docx')
  }

  // Excel表格
  if (mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      ['xls', 'xlsx', 'xlsm'].includes(ext)) {
    return ext === 'xls' ? 'xls' : (ext === 'xlsm' ? 'xlsm' : 'xlsx')
  }

  // CSV文件
  if (ext === 'csv') {
    return 'csv'
  }

  // 文本文件
  if (mimeType.startsWith('text/') || ['txt', 'md', 'log'].includes(ext)) {
    return 'txt'
  }

  return null
}

// 预览文件
const handlePreview = async (row) => {
  try {
    const fileType = getPreviewFileType(row)

    if (!fileType) {
      ElMessage.info(`文件 "${row.original_name}" 不支持在线预览，请下载后查看`)
      return
    }

    // 从后端获取预览URL
    const res = await previewFileAPI(row.file_id)
    if (res.code !== 200 || !res.data || !res.data.preview_url) {
      ElMessage.error(res.msg || '获取预览链接失败')
      return
    }

    let previewUrl = res.data.preview_url
    let finalFileType = fileType

    // 如果是 DOC / WPS，需要先转换为 DOCX
    if (fileType === 'doc') {
      try {
        ElMessage.info('正在转换 DOC 文件...')
        const convertRes = await convertDocToDocxAPI(null, previewUrl)
        if (convertRes.code === 200 && convertRes.data && convertRes.data.preview_url) {
          previewUrl = convertRes.data.preview_url
          finalFileType = 'docx' // 转换为 DOCX 类型
          ElMessage.success('DOC 文件转换成功')
        } else {
          ElMessage.error('文档转换失败，请稍后重试')
          return
        }
      } catch (error) {
        console.error('DOC/WPS 转换失败:', error)
        ElMessage.error('文档转换失败: ' + (error.message || '未知错误'))
        return
      }
    }

    // 如果是 XLS，需要先转换为 XLSX
    if (fileType === 'xls') {
      try {
        ElMessage.info('正在转换 XLS 文件...')
        const convertRes = await convertXlsToXlsxAPI(null, previewUrl)
        if (convertRes.code === 200 && convertRes.data && convertRes.data.preview_url) {
          previewUrl = convertRes.data.preview_url
          finalFileType = 'xlsx' // 转换为 XLSX 类型
          ElMessage.success('XLS 文件转换成功')
        } else {
          ElMessage.error('表格转换失败，请稍后重试')
          return
        }
      } catch (error) {
        console.error('XLS 转换失败:', error)
        ElMessage.error('表格转换失败: ' + (error.message || '未知错误'))
        return
      }
    }

    // 设置预览数据
    previewFileName.value = row.original_name
    previewFileType.value = finalFileType
    previewFileRow.value = row
    previewFileData.value = previewUrl
    showPreviewDialog.value = true
    // 右侧解析结果与左侧预览并行加载（不阻塞弹窗打开）
    loadPreviewParsedContent(row)
  } catch (error) {
    ElMessage.error('预览文件失败')
    console.error(error)
  }
}

// 下载文件
const handleDownload = async (row) => {
  try {
    loading.value = true
    const res = await downloadFileAPI(row.file_id)
    if (res.code === 200 && res.data && res.data.download_url) {
      // 创建临时链接下载（强制下载，不在新标签页打开）
      const link = document.createElement('a')
      link.href = res.data.download_url
      link.download = res.data.file_name || row.original_name
      // 移除 target='_blank'，确保直接下载而不是预览
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      ElMessage.success('文件下载已开始')
    } else {
      ElMessage.error(res.msg || '获取下载链接失败')
    }
  } catch (error) {
    console.error('文件下载失败:', error)
    ElMessage.error(error.response?.data?.msg || '文件下载失败')
  } finally {
    loading.value = false
  }
}

// 删除文件
const handleDelete = (row) => {
  if (deletingFileId.value) {
    // 已有删除操作在进行中，避免重复点击
    return
  }
  ElMessageBox.confirm(
    `确认删除文件 "${row.original_name}"？`,
    '提示',
    {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    }
  ).then(async () => {
    deletingFileId.value = row.file_id
    try {
      const res = await deleteFileAPI(row.file_id)
      if (res.code === 200) {
        ElMessage.success(`文件 "${row.original_name}" 已删除`)
        invalidateMergedSpacesCache()
        loadFileList()
        // 如果当前是个人空间，删除文件后刷新个人空间存储统计
        if (currentSpaceType.value === 'PERSONAL') {
          loadPersonalStorageInfo()
        }
      } else {
        ElMessage.error(res.msg || '删除文件失败')
      }
    } catch (error) {
      console.error('删除文件失败:', error)
      ElMessage.error(error.response?.data?.msg || '删除文件失败')
    } finally {
      deletingFileId.value = null
    }
  }).catch(() => {
    deletingFileId.value = null
  })
}

// 批量删除文件
const handleBatchDelete = () => {
  if (!selectedFiles.value.length) {
    ElMessage.warning('请先选择要删除的文件')
    return
  }

  const names = selectedFiles.value.map(f => f.original_name).join('、')
  const displayNames = names.length > 200 ? names.slice(0, 200) + '...' : names

  ElMessageBox.confirm(
    `确认删除选中的 ${selectedFiles.value.length} 个文件？\n${displayNames}`,
    '批量删除',
    {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    }
  ).then(async () => {
    batchDeleting.value = true
    try {
      for (const file of selectedFiles.value) {
        const res = await deleteFileAPI(file.file_id)
        if (res.code !== 200) {
          throw new Error(res.msg || `删除文件 "${file.original_name}" 失败`)
        }
      }
      ElMessage.success('批量删除成功')
      selectedFiles.value = []
      invalidateMergedSpacesCache()
      loadFileList()
      // 如果当前是个人空间，批量删除文件后刷新个人空间存储统计
      if (currentSpaceType.value === 'PERSONAL') {
        loadPersonalStorageInfo()
      }
    } catch (error) {
      console.error('批量删除失败:', error)
      ElMessage.error(error.message || '批量删除失败')
    } finally {
      batchDeleting.value = false
    }
  }).catch(() => {
    batchDeleting.value = false
  })
}

/**
 * 重新解析选中的文件（将未解析/失败的文件重新入队 OCR）
 */
const handleReparse = async () => {
  if (!selectedFiles.value.length) {
    ElMessage.warning('请先选择要重新解析的文件')
    return
  }
  // 只处理未解析或解析失败的文件
  const unparsedFiles = selectedFiles.value.filter((f) => isReparseEligible(f))
  if (!unparsedFiles.length) {
    ElMessage.warning('选中的文件中没有可重新解析的文件（未解析、解析中或解析失败）')
    return
  }
  const names = unparsedFiles.map(f => f.original_name).join('、')
  const displayNames = names.length > 200 ? names.slice(0, 200) + '...' : names
  try {
    await ElMessageBox.confirm(
      `确认重新解析选中的 ${unparsedFiles.length} 个文件？\n${displayNames}`,
      '重新解析',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    )
  } catch {
    return
  }
  reparseLoading.value = true
  try {
    const space = currentSpaceType.value || 'PERSONAL'
    const res = await postRequeueByFileIdsAPI({
      file_ids: unparsedFiles.map(f => f.file_id),
      space
    })
    if (res.code === 200) {
      const data = res.data || {}
      const msgs = []
      if (data.enqueued > 0) msgs.push(`已入队 ${data.enqueued} 个`)
      if (data.not_found > 0) msgs.push(`未找到 ${data.not_found} 个`)
      if (data.max_retry_exceeded > 0) msgs.push(`超最大重试 ${data.max_retry_exceeded} 个`)
      if (data.push_failed > 0) msgs.push(`入队失败 ${data.push_failed} 个`)
      ElMessage.success(msgs.join('；') || '已处理')
      selectedFiles.value = []
      loadFileList()
    } else {
      ElMessage.error(res.msg || '重新解析失败')
    }
  } catch (error) {
    console.error('重新解析失败:', error)
    ElMessage.error(error.message || '重新解析失败')
  } finally {
    reparseLoading.value = false
  }
}

/**
 * 切换文件夹范围（本文件夹 / 本文件夹及子文件夹）
 */
const handleRecursiveChange = () => {
  query.page = 1
  loadFileList()
}

/**
 * 已选文件弹窗：将表格中勾选的多行从前端跨页已选列表移除，并同步主文件表与弹窗表格勾选状态；不调用删除接口。
 * 无参数；读取 selectedFilesSummaryTableSelection。
 * @returns {void}
 */
const handleBatchDeleteFromSummaryDialog = () => {
  const rows = selectedFilesSummaryTableSelection.value
  if (!rows || rows.length === 0) {
    ElMessage.warning('请先勾选要移除的文件')
    return
  }

  ElMessageBox.confirm(
    `确认从已选列表中移除勾选的 ${rows.length} 项？不会删除服务器上的文件。`,
    '批量移除',
    {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    }
  )
    .then(() => {
      const list = [...rows]
      for (const row of list) {
        removeFileFromBatchSelection(row)
      }
      selectedFilesSummaryTableSelection.value = []
      nextTick(() => {
        selectedFilesSummaryTableRef.value?.clearSelection()
      })
      ElMessage.success('已从已选列表移除')
    })
    .catch(() => {})
}

// 显示完整摘要
const showFullSummary = (row) => {
  ElMessageBox.alert(
    row.summary || '暂无摘要',
    `文件摘要 - ${row.original_name}`,
    {
      confirmButtonText: '关闭',
      type: 'info',
      customStyle: {
        width: '600px'
      }
    }
  )
}

// 行点击
const handleRowClick = (row) => {
  // 可以在这里处理行点击事件
}

/**
 * 文件列表表格加载完成后，按 selectedFiles 中已保存的 file_id 恢复当前页的勾选（与分页切换配合使用）。
 * 无参数；依赖组件内的 tableRef、fileList、selectedFiles。
 * @returns {void}
 */
const restoreFileTableSelectionAfterListUpdate = () => {
  const tb = tableRef.value
  const rows = fileList.value
  if (!tb || !rows.length) return
  const selectedIdSet = new Set(
    selectedFiles.value.map((f) => f.file_id).filter((id) => id != null && id !== '')
  )
  for (const row of rows) {
    if (row.file_id != null && row.file_id !== '' && selectedIdSet.has(row.file_id)) {
      tb.toggleRowSelection(row, true)
    }
  }
}

/**
 * 表格勾选变化：保留「非当前页」已选行，合并当前页勾选结果，实现跨分页多选记忆。
 * @param {Array<Record<string, any>>} selection Element Plus 传入的当前表格中已勾选行对象数组。
 * @returns {void}
 */
const handleSelectionChange = (selection) => {
  const pageIds = new Set(
    fileList.value.map((r) => r.file_id).filter((id) => id != null && id !== '')
  )
  const kept = selectedFiles.value.filter(
    (f) => f.file_id != null && f.file_id !== '' && !pageIds.has(f.file_id)
  )
  const merged = [...kept, ...selection]
  const byId = new Map()
  for (const f of merged) {
    if (f && f.file_id != null && f.file_id !== '') {
      byId.set(f.file_id, f)
    }
  }
  selectedFiles.value = Array.from(byId.values())
}

/**
 * 打开已选文件汇总弹窗（无已选时不开）。
 * 无参数。
 * @returns {void}
 */
const openSelectedFilesSummaryDialog = () => {
  if (selectedFiles.value.length === 0) return
  selectedFilesSummaryTableSelection.value = []
  selectedFilesSummaryDialogVisible.value = true
}

/**
 * 从跨页已选列表中移除指定文件；若该行在当前文件表格页内则同步取消勾选。
 * @param {Record<string, any>} file 文件行对象，需包含可比较的 file_id。
 * @returns {void}
 */
const removeFileFromBatchSelection = (file) => {
  const fid = file?.file_id
  if (fid == null || fid === '') return
  const fidStr = String(fid)
  const tb = tableRef.value
  const onPage = fileList.value.find((r) => String(r.file_id) === fidStr)
  if (tb && onPage) {
    tb.toggleRowSelection(onPage, false)
    nextTick(() => {
      if (selectedFiles.value.length === 0) {
        selectedFilesSummaryDialogVisible.value = false
      }
    })
  } else {
    selectedFiles.value = selectedFiles.value.filter((f) => String(f.file_id) !== fidStr)
    if (selectedFiles.value.length === 0) {
      selectedFilesSummaryDialogVisible.value = false
    }
  }
}

/**
 * 已选文件弹窗内表格勾选变化：记录当前勾选行供批量从已选列表移除。
 * @param {Array<Record<string, any>>} selection 弹窗表格中选中的行数组。
 * @returns {void}
 */
const handleSelectedFilesSummaryTableSelectionChange = (selection) => {
  selectedFilesSummaryTableSelection.value = selection
}

// 判断当前用户是否可以管理文件（用于控制标签操作按钮显示）
const canManageFile = (row) => {
  // 简化逻辑：只要当前文件夹具有管理权限，就认为可以管理文件
  if (!currentFolder.value) return false
  const folder = findFolderInTree(currentFolder.value)
  return folder && folder.permission === 'FULL'
}

// 获取当前用户ID
const getCurrentUserId = () => {
  try {
    // 修复：使用正确的 key 'USER_INFO'（大写），与登录时存储的 key 一致
    const userInfoStr = localStorage.getItem('USER_INFO')
    if (!userInfoStr) return null
    const userInfo = JSON.parse(userInfoStr)
    return userInfo.user_id || null
  } catch (e) {
    console.error('获取当前用户ID失败:', e)
    return null
  }
}

// 判断是否可以删除文件
// 只有文件的上传者，或者文件夹的创建者/超级管理员可以删除文件
// 空间模式（点击公共空间/个人空间根节点）：上传者可删除自己的文件，超级文件管理员可删除任意文件
// OSS 映射文件禁止删除
// 项目空间下超级文件管理员可以删除任何文件（OSS 除外）
const canDeleteFile = (row) => {
  if (row.is_oss) return false

  const currentUserId = getCurrentUserId()
  if (!currentUserId) return false

  // 检查是否是文件的上传者
  if (row.uploader_id === currentUserId) return true

  // 空间模式：无 currentFolder 时，仅上传者已在上面处理；超级文件管理员可删除任意文件
  if (!currentFolder.value && currentSpaceType.value) {
    return isSuperFileAdmin()
  }

  // 文件夹模式：项目空间下超级文件管理员可以删除任何文件
  const folder = findFolderInTree(currentFolder.value)
  if (folder && folder.folder_type === 'PROJECT' && isSuperFileAdmin()) {
    return true
  }

  // 文件夹模式：检查是否是文件夹的创建者或超级管理员
  if (folder && folder.permission === 'FULL' && (folder.is_creator || folder.is_super_admin)) {
    return true
  }

  return false
}

/**
 * 已选文件弹窗表格：行是否允许勾选（与主列表删除权限一致，OSS/无权限不可选）。
 * @param {Record<string, any>} row 文件行对象。
 * @returns {boolean} 是否允许勾选。
 */
/**
 * 已选文件弹窗表格行是否可出现勾选框：仅做列表移除时不限制（与是否可服务端删除无关）。
 * @param {Record<string, any>} row 表格行数据（未使用，保留与 el-table selectable 签名一致）
 * @returns {boolean} 恒为 true
 */
const summaryDialogRowSelectable = (row) => {
  void row
  return true
}

// 判断是否可以重命名文件
// 只有文件的上传者，或者文件夹的创建者/超级管理员可以重命名文件
// 空间模式（点击公共空间/个人空间根节点）：上传者可重命名自己的文件，超级文件管理员可重命名任意文件
// OSS 映射文件禁止重命名
const canRenameFile = (row) => {
  if (row.is_oss) return false

  const currentUserId = getCurrentUserId()
  if (!currentUserId) return false

  // 检查是否是文件的上传者
  if (row.uploader_id === currentUserId) return true

  // 空间模式：无 currentFolder 时，仅上传者已在上面处理；超级文件管理员可重命名任意文件
  if (!currentFolder.value && currentSpaceType.value) {
    return isSuperFileAdmin()
  }

  // 文件夹模式：检查是否是文件夹的创建者或超级管理员
  const folder = findFolderInTree(currentFolder.value)
  if (folder && folder.permission === 'FULL' && (folder.is_creator || folder.is_super_admin)) {
    return true
  }

  return false
}

// ==================== 权限管理功能 ====================

// 打开权限管理对话框
const openPermissionDialog = async () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择文件夹')
    return
  }

  // 先尝试加载权限列表，用于做权限校验；无权限时直接提示，而不是先弹出空弹框再报错
  permissionLoading.value = true
  try {
    const res = await getFolderPermissionsAPI(currentFolder.value)
    if (res.code === 200 && res.data) {
      permissionList.value = res.data.permissions || []
      permissionDialogVisible.value = true
    } else if (res.code === 403) {
      ElMessage.warning(res.msg || '当前文件夹没有分权/管理权限，无法查看权限列表')
      permissionList.value = []
    } else {
      ElMessage.error(res.msg || '获取权限列表失败')
      permissionList.value = []
    }
  } catch (error) {
    console.error('加载权限列表失败:', error)
    const status = error.response?.status
    if (status === 403) {
      // 后端返回403时，认为是没有查看/分权权限，直接在按钮点击处提示
      ElMessage.warning(
        error.response?.data?.detail ||
        error.response?.data?.msg ||
        '当前文件夹没有分权/管理权限，无法查看权限列表'
      )
    } else {
      ElMessage.error(error.response?.data?.msg || '加载权限列表失败')
    }
    permissionList.value = []
  } finally {
    permissionLoading.value = false
  }
}

// 加载权限列表
const loadPermissionList = async () => {
  if (!currentFolder.value) {
    return
  }

  permissionLoading.value = true
  try {
    const res = await getFolderPermissionsAPI(currentFolder.value)
    if (res.code === 200 && res.data) {
      permissionList.value = res.data.permissions || []
    } else {
      ElMessage.error(res.msg || '获取权限列表失败')
      permissionList.value = []
    }
  } catch (error) {
    console.error('加载权限列表失败:', error)
    ElMessage.error(error.response?.data?.msg || '加载权限列表失败')
    permissionList.value = []
  } finally {
    permissionLoading.value = false
  }
}

// 打开授权权限对话框
const openGrantPermissionDialog = () => {
  grantPermissionForm.grantee_type = 'USER'
  grantPermissionForm.grantee_id = ''
  grantPermissionForm.grantee_name = ''
  grantPermissionForm.permission_type = 'READ'  // MANAGE(管理), READ(查看)
  grantPermissionForm.can_delegate = false
  grantPermissionForm.include_org_descendants = false
  userSearchResults.value = []
  grantPermissionDialogVisible.value = true

  // 如果是机构类型，加载机构列表
  if (grantPermissionForm.grantee_type === 'ORG') {
    loadOrgList()
  }
}

// 搜索用户
const { request: requestUtil } = useRequestUtil()
const searchUsers = async (query) => {
  if (!query || query.trim().length < 2) {
    userSearchResults.value = []
    return
  }

  userSearchLoading.value = true
  try {
    // 调用用户列表API
    const res = await requestUtil({
      url: '/api/v1/user-login-names',
      method: 'get',
      params: {}
    })

    if (res.code === 200 && res.data) {
      // 过滤匹配的用户
      const keyword = query.toLowerCase()
      userSearchResults.value = res.data.filter(user => {
        const name = (user.FULL_NAME || '').toLowerCase()
        const userId = (user.USERID || '').toLowerCase()
        return name.includes(keyword) || userId.includes(keyword)
      }).slice(0, 20) // 限制显示20个结果
    } else {
      userSearchResults.value = []
    }
  } catch (error) {
    console.error('搜索用户失败:', error)
    userSearchResults.value = []
  } finally {
    userSearchLoading.value = false
  }
}

// 授权对象类型变化
const handleGranteeTypeChange = (type) => {
  grantPermissionForm.grantee_id = ''
  grantPermissionForm.grantee_name = ''
  grantPermissionForm.include_org_descendants = false
  if (type === 'ORG') {
    // 如果机构树数据为空，则加载
    if (orgTreeData.value.length === 0) {
      loadOrgList()
    }
  } else {
    userSearchResults.value = []
  }
}

// 判断当前用户是否为超级文件管理员
const isSuperFileAdmin = () => {
  try {
    const token = getToken()
    if (token) {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        const payload = JSON.parse(payloadStr)
        const roleList = Array.isArray(payload.role) ? payload.role : []
        return roleList.some((role) => {
          if (typeof role === 'string') {
            return role === 'super_file_admin'
          }
          if (role && typeof role === 'object') {
            return role.rolecode === 'super_file_admin'
          }
          return false
        })
      }
    }
  } catch (e) {
    // 解析 token 失败时忽略
  }
  return false
}

/**
 * 拉取 GET /api/v1/org/tree（manager 或 pkbadmin），写入 orgTreeForPathLookup，
 * 用于从「客户主管单位子树」中解析用户叶子到根的路径；与行为日志页无关。
 */
const ensureOrgTreeForPathLookup = async () => {
  if (orgTreeForPathLookup.value?.length) return
  if (pathOrgTreeFetchPromise) {
    await pathOrgTreeFetchPromise
    return
  }
  pathOrgTreeFetchPromise = (async () => {
    try {
      const userInfoStr = localStorage.getItem('USER_INFO')
      if (!userInfoStr) {
        return
      }
      const userInfo = JSON.parse(userInfoStr)
      const userid = userInfo.user_id
      if (!userid) {
        return
      }
      const rolecode = isSuperFileAdmin() ? 'manager' : 'pkbadmin'
      const res = await getOrgTreeAPI({ userid, rolecode })
      if (res.code === 200 && res.data?.org_tree?.length) {
        orgTreeForPathLookup.value = res.data.org_tree
      }
    } catch (e) {
      /* ignore */
    } finally {
      pathOrgTreeFetchPromise = null
    }
  })()
  await pathOrgTreeFetchPromise
}

// 加载机构列表（如果需要）
const loadOrgList = async () => {
  try {
    // 从localStorage获取当前用户信息
    const userInfoStr = localStorage.getItem('USER_INFO')
    if (!userInfoStr) {
      ElMessage.warning('无法获取用户信息，请重新登录')
      orgList.value = []
      orgTreeData.value = []
      return
    }

    const userInfo = JSON.parse(userInfoStr)
    const userid = userInfo.user_id

    if (!userid) {
      ElMessage.warning('用户ID不存在，请重新登录')
      orgList.value = []
      orgTreeData.value = []
      return
    }

    // 判断是否为超级文件管理员
    const isSuperAdmin = isSuperFileAdmin()

    // 根据用户角色决定使用哪个rolecode
    // 超级文件管理员：使用manager角色获取完整组织树
    // 其他用户：使用pkbadmin角色获取用户所在机构及下级机构
    const rolecode = isSuperAdmin ? 'manager' : 'pkbadmin'

    // 调用组织树API
    const res = await getOrgTreeAPI({
      userid: userid,
      rolecode: rolecode
    })

    if (res.code === 200 && res.data && res.data.org_tree) {
      // 保存树形结构数据
      orgTreeData.value = res.data.org_tree

      // 同时保留扁平化数据（用于兼容旧代码）
      const flattenOrgTree = (nodes) => {
        const result = []
        for (const node of nodes) {
          // 添加当前节点
          result.push({
            orguuid: node.orguuid,
            cnname: node.cnname || node.orgname || ''
          })
          // 递归处理子节点
          if (node.children && node.children.length > 0) {
            result.push(...flattenOrgTree(node.children))
          }
        }
        return result
      }

      orgList.value = flattenOrgTree(res.data.org_tree)
    } else {
      ElMessage.warning(res.msg || '获取机构列表失败')
      orgList.value = []
      orgTreeData.value = []
    }
  } catch (error) {
    console.error('加载机构列表失败:', error)
    ElMessage.error(error.response?.data?.msg || '加载机构列表失败')
    orgList.value = []
    orgTreeData.value = []
  }
}

// 选中机构名称（计算属性）
const selectedOrgName = computed(() => {
  if (!grantPermissionForm.grantee_id || grantPermissionForm.grantee_type !== 'ORG') {
    return ''
  }
  // 从扁平化列表中查找
  const org = orgList.value.find(o => o.orguuid === grantPermissionForm.grantee_id)
  return org ? org.cnname : ''
})

// 权限撤销加载状态（当前正在撤销的权限ID）
const revokingPermissionId = ref(null)

// 机构树节点点击处理
const handleOrgTreeNodeClick = (data) => {
  grantPermissionForm.grantee_id = data.orguuid
  grantPermissionForm.grantee_name = data.cnname || data.orgname || ''
}

// 确认机构选择
const confirmOrgSelection = () => {
  if (!grantPermissionForm.grantee_id) {
    ElMessage.warning('请选择机构')
    return
  }
  showOrgTreeDialog.value = false
}


// ==================== 项目绑定功能 ====================

// 打开绑定项目对话框
const openBindProjectDialog = async () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择文件夹')
    return
  }

  bindProjectForm.folder_id = currentFolder.value

  // 获取当前文件夹的项目UUID（如果有）
  const folder = findFolderInTree(currentFolder.value)
  bindProjectForm.project_uuid = folder?.project_uuid || null

  // 重置查询条件并加载项目列表（分页，避免一次性加载全部项目）
  projectQuery.page = 1
  projectQuery.keyword = ''
  await loadProjectList()

  bindProjectDialogVisible.value = true
}

const openBindOrgDialog = async () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择文件夹')
    return
  }
  bindOrgForm.folder_id = currentFolder.value
  const folder = findFolderInTree(currentFolder.value)
  bindOrgForm.bound_org_uuid = folder?.bound_org_uuid || null
  bindOrgForm.grant_read_to_org = true
  bindOrgForm.grant_read_include_descendants = false
  if (!orgTreeData.value?.length) {
    await loadOrgList()
  }
  bindOrgDialogVisible.value = true
}

const handleBindOrgConfirm = async () => {
  if (!bindOrgForm.folder_id) {
    ElMessage.warning('请先选择文件夹')
    return
  }
  bindOrgLoading.value = true
  try {
    const res = await bindOrgAPI(bindOrgForm.folder_id, {
      bound_org_uuid: bindOrgForm.bound_org_uuid || null,
      grant_read_to_org: bindOrgForm.grant_read_to_org,
      grant_read_include_descendants: bindOrgForm.grant_read_include_descendants
    })
    if (res.code === 200) {
      ElMessage.success(bindOrgForm.bound_org_uuid ? '绑定机构成功' : '解绑机构成功')
      bindOrgDialogVisible.value = false
      await loadFolderTree(null, true, { preserveExpanded: true })
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (error) {
    console.error('绑定机构失败:', error)
    ElMessage.error(error.response?.data?.msg || error.response?.data?.detail || '绑定机构失败')
  } finally {
    bindOrgLoading.value = false
  }
}

// 加载项目列表（分页）
const loadProjectList = async () => {
  try {
    const res = await getProjectsAPI({
      page: projectQuery.page,
      page_size: projectQuery.page_size,
      keyword: projectQuery.keyword || undefined
    })
    if (res.code === 200 && res.data) {
      projectList.value = res.data.projects || []
    } else {
      projectList.value = []
      ElMessage.error(res.msg || '获取项目列表失败')
    }
  } catch (error) {
    projectList.value = []
    console.error('加载项目列表失败:', error)
    ElMessage.error(error.response?.data?.msg || error.response?.data?.detail || '加载项目列表失败')
  }
}

// 查找文件夹在树中的节点
const findFolderInTree = (folderId) => {
  const findInNodes = (nodes) => {
    for (const node of nodes) {
      if (node.id === folderId) {
        return node
      }
      if (node.children && node.children.length > 0) {
        const found = findInNodes(node.children)
        if (found) return found
      }
    }
    return null
  }
  return findInNodes(folderTreeData.value)
}

// 查找文件夹所属的空间根节点
const findSpaceRoot = (folderId, folders = folderTreeData.value) => {
  for (const folder of folders) {
    if (folder.isSpaceRoot) {
      const checkInSpace = (node) => {
        if (node.id === folderId) return true
        if (node.children && node.children.length > 0) {
          return node.children.some(child => checkInSpace(child))
        }
        return false
      }
      if (checkInSpace(folder)) {
        return folder
      }
    }
    if (folder.children && folder.children.length > 0) {
      const found = findSpaceRoot(folderId, folder.children)
      if (found) return found
    }
  }
  return null
}

// 获取从根到当前文件夹的完整路径数组
const getFolderPath = (folderId, folders = folderTreeData.value, path = []) => {
  if (!folderId) {
    const spaceName = getCurrentSpaceLabel()
    return spaceName ? [spaceName] : []
  }
  for (const folder of folders) {
    if (folder.id === folderId) {
      const result = [...path, folder.name]
      if (folder.isSpaceRoot) {
        return result
      }
      const spaceNode = findSpaceRoot(folderId, folders)
      if (spaceNode) {
        return [spaceNode.name, ...result]
      }
      return result
    }
    if (folder.children && folder.children.length > 0) {
      const found = getFolderPath(folderId, folder.children, [...path, folder.name])
      if (found.length > 0) {
        return found
      }
    }
  }
  return []
}

// 获取当前文件夹的完整路径数组（用于面包屑）
const getCurrentFolderPath = computed(() => {
  return getFolderPath(currentFolder.value)
})

// 获取文件的完整路径（用于位置列显示）
const getFileLocationLabel = (folderId) => {
  // 根据文件的folder_id获取完整路径
  const path = getFolderPath(folderId)
  // 确保始终返回完整路径
  if (path.length > 0) {
    return path.join('/')
  }
  // 如果文件没有folder_id或路径为空，返回当前空间名称
  return getCurrentSpaceLabel() || ''
}

// 确认绑定项目
const handleBindProjectConfirm = async () => {
  if (!bindProjectForm.folder_id) {
    ElMessage.warning('请先选择文件夹')
    return
  }

  bindProjectLoading.value = true
  try {
    const res = await bindProjectAPI(bindProjectForm.folder_id, {
      project_uuid: bindProjectForm.project_uuid || null
    })

    if (res.code === 200) {
      ElMessage.success(bindProjectForm.project_uuid ? '绑定项目成功' : '解绑项目成功')
      bindProjectDialogVisible.value = false
      // 刷新文件夹树
      await loadFolderTree(null, true, { preserveExpanded: true })
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (error) {
    console.error('绑定项目失败:', error)
    ElMessage.error(error.response?.data?.msg || '绑定项目失败')
  } finally {
    bindProjectLoading.value = false
  }
}

// 确认授权权限
const handleGrantPermissionConfirm = async () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择文件夹')
    return
  }

  // 验证文件夹ID格式
  if (typeof currentFolder.value !== 'string' || currentFolder.value.trim() === '') {
    ElMessage.error('文件夹ID无效')
    console.error('无效的文件夹ID:', currentFolder.value)
    return
  }

  if (!grantPermissionForm.grantee_id) {
    ElMessage.warning('请选择授权对象')
    return
  }

  // 获取授权对象名称
  let granteeName = ''
  if (grantPermissionForm.grantee_type === 'USER') {
    const user = userSearchResults.value.find(u => u.USERID === grantPermissionForm.grantee_id)
    granteeName = user ? (user.FULL_NAME || user.USERID) : grantPermissionForm.grantee_id
  } else {
    const org = orgList.value.find(o => o.orguuid === grantPermissionForm.grantee_id)
    granteeName = org ? org.cnname : grantPermissionForm.grantee_id
  }

  grantPermissionLoading.value = true
  try {
    const folderId = currentFolder.value.trim()

    const res = await grantPermissionAPI(folderId, {
      grantee_type: grantPermissionForm.grantee_type,
      grantee_id: grantPermissionForm.grantee_id,
      grantee_name: granteeName,
      permission_type: grantPermissionForm.permission_type,
      can_delegate: grantPermissionForm.can_delegate,
      include_org_descendants:
        grantPermissionForm.grantee_type === 'ORG' ? grantPermissionForm.include_org_descendants : false
    })

    if (res.code === 200) {
      ElMessage.success(res.msg || '授权成功')
      grantPermissionDialogVisible.value = false
      await loadPermissionList()
    } else {
      ElMessage.error(res.msg || '授权失败')
    }
  } catch (error) {
    console.error('授权失败:', error)

    // 更详细的错误提示
    if (error.response?.status === 404) {
      const responseData = error.response?.data
      if (responseData && (responseData.detail || responseData.msg)) {
        const errorDetail = responseData.detail || responseData.msg || '操作失败'
        ElMessage.error(errorDetail)
      } else {
        const errorMsg = `接口不存在 (404)。\n` +
          `请求URL: ${error.config?.url}\n` +
          `请确认：\n` +
          `1. 后端服务已重启\n` +
          `2. 路由已正确注册：/api/v1/file-manager/folders/{folder_id}/permissions`
        ElMessage.error(errorMsg)
      }
    } else {
      ElMessage.error(error.response?.data?.msg || '授权失败')
    }
  } finally {
    grantPermissionLoading.value = false
  }
}

// 撤销权限
const handleRevokePermission = async (permission) => {
  if (!currentFolder.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认撤销 "${permission.grantee_name}" 的权限？`,
      '提示',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    )
    revokingPermissionId.value = permission.permission_id
    const res = await revokePermissionAPI(currentFolder.value, permission.permission_id)
    if (res.code === 200) {
      ElMessage.success('撤销权限成功')
      await loadPermissionList()
    } else {
      ElMessage.error(res.msg || '撤销权限失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('撤销权限失败:', error)
      ElMessage.error(error.response?.data?.msg || '撤销权限失败')
    }
  } finally {
    revokingPermissionId.value = null
  }
}

// 工具点击演示 - 打开OCR演示页面（新标签页）

// 获取工具名称
const getToolName = (toolType) => {
  const toolNames = {
    'fileToPdf': '非结构化信息提取',
    'contractCompleteness': '合同合规性分析',
    'contractRisk': '合同风险性分析',
    'meetingMinutes': '会议纪要分析',
    'riskPointAnalysis': '风险点分析',
    'timelineAnalysis': '时间轴分析',
    'engineeringProject': '工程项目数据一致性分析',
    'associationDegreeTwoTables': '两表项目关联度',
    'themeAnalysis': '主题归纳',
    'wordCloud': '词云分析',
    'prepaidExpenses': '待摊费用'
  }
  return toolNames[toolType] || '工具处理'
}

const handleToolClick = (toolType, toolLabel) => {
  const resolvedLabel = toolLabel ?? getToolName(toolType)
  finishTaskProgress()
  // if (toolType === 'wordCloud') {
  //   // 词云分析直接基于库表 FILE_CONTENT，不限制文件类型
  //   const ids = selectedFiles.value.map((f) => f.file_id).filter(Boolean)
  //   sessionStorage.setItem('wordCloudFileIds', JSON.stringify(ids))
  //   router.push({ name: 'WordCloudAnalysis', query: { t: String(Date.now()) } })
  //   return
  // }

  // 如果是会议纪要分析，过滤出 pdf、doc、docx 格式的文件
  let filteredFiles = selectedFiles.value
  if (toolType === 'meetingMinutes') {
    filteredFiles = selectedFiles.value.filter(file => {
      const fileName = file.original_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.pdf', '.doc', '.docx', '.wps'].includes(ext)
    })

    if (filteredFiles.length < selectedFiles.value.length) {
      ElMessage.warning('会议纪要分析仅支持 pdf、doc、docx、wps 格式的文件，已帮您过滤掉其他格式的文件')
    }
  }

  // 如果是合同完备性分析，过滤出 pdf、doc、docx 格式的文件
  if (toolType === 'contractCompleteness') {
    filteredFiles = selectedFiles.value.filter(file => {
      const fileName = file.original_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.pdf', '.doc', '.docx', '.wps'].includes(ext)
    })


    if (filteredFiles.length < selectedFiles.value.length) {
      ElMessage.warning('合同完备性分析仅支持 pdf、doc、docx、wps 格式的文件，已帮您过滤掉其他格式的文件')
    }
  }
  if (toolType === 'timelineAnalysis') {
    filteredFiles = selectedFiles.value.filter(file => {
      const fileName = file.original_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.pdf', '.doc', '.docx', '.wps'].includes(ext)
    })
    if (filteredFiles.length < selectedFiles.value.length) {
      ElMessage.warning('时间轴分析仅支持 pdf、doc、docx、wps 格式的文件，已帮您过滤掉其他格式的文件')
    }
  }
  if (toolType === 'engineeringProject' || toolType === 'associationDegreeTwoTables') {
    filteredFiles = selectedFiles.value.filter(file => {
      const fileName = file.original_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.xlsx', '.xls', '.csv'].includes(ext)
    })


    if (filteredFiles.length < selectedFiles.value.length) {
      ElMessage.warning(
        (toolType === 'engineeringProject' ? '工程项目数据一致性分析' : '两表项目关联度') + '仅支持 xlsx、xls、csv 格式的文件，已帮您过滤掉其他格式的文件'
      )
    }
  }

  // 待摊费用（原型）：与合同分析相同格式限制
  if (toolType === 'prepaidExpenses') {
    filteredFiles = selectedFiles.value.filter(file => {
      const fileName = file.original_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.pdf', '.doc', '.docx', '.wps'].includes(ext)
    })

    if (filteredFiles.length < selectedFiles.value.length) {
      ElMessage.warning('待摊费用仅支持 pdf、doc、docx、wps 格式的文件，已帮您过滤掉其他格式的文件')
    }
  }

  // 风险点分析：与合同合规性分析相同格式限制（原型）
  if (toolType === 'riskPointAnalysis') {
    filteredFiles = selectedFiles.value.filter(file => {
      const fileName = file.original_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.pdf', '.doc', '.docx'].includes(ext)
    })

    if (filteredFiles.length < selectedFiles.value.length) {
      ElMessage.warning('风险点分析仅支持 pdf、doc、docx 格式的文件，已帮您过滤掉其他格式的文件')
    }
  }

  // 构建路由参数，传递文件信息（如果有选中的文件则传递，否则为空）
  const fileIds = filteredFiles.length > 0 ? filteredFiles.map(f => f.file_id).join(',') : ''
  const fileNames = filteredFiles.length > 0 ? filteredFiles.map(f => f.original_name).join(',') : ''

  const newParams = {
    tool: toolType,
    toolLabel: resolvedLabel,
    files: fileIds,
    names: fileNames,
    taskId: ''
  }

  // 若弹窗已打开，先关闭再重开，确保子组件每次都能完整重建（onMounted 重新注入文件）
  if (showDocumentPreviewDialog.value) {
    showDocumentPreviewDialog.value = false
    nextTick(() => {
      documentPreviewParams.value = newParams
      showDocumentPreviewDialog.value = true
    })
  } else {
    // 设置文档预览参数
    documentPreviewParams.value = newParams
    // 打开全屏弹窗
    showDocumentPreviewDialog.value = true
  }
}

// ==================== 任务进度管理 ====================

/**
 * 判断是否为请求被主动取消导致的错误
 * @param {Error} error 捕获的异常
 * @returns {boolean} 是否为取消错误
 */
const isRequestAbortedError = (error) => {
  if (!error) return false
  if (error.name === 'CanceledError' || error.name === 'AbortError') return true
  if (error.code === 'ERR_CANCELED') return true
  return false
}

/**
 * 中止当前进行中的任务进度 HTTP 请求
 * @returns {void}
 */
const abortTaskProgressRequest = () => {
  if (taskProgressAbortController) {
    try {
      taskProgressAbortController.abort()
    } catch (e) {
      /* ignore */
    }
    taskProgressAbortController = null
  }
}

// 清理任务进度定时器
const clearTaskProgressTimers = () => {
  if (taskProgressTimer) {
    clearInterval(taskProgressTimer)
    taskProgressTimer = null
  }
  if (taskProgressPollTimeout) {
    clearTimeout(taskProgressPollTimeout)
    taskProgressPollTimeout = null
  }
  abortTaskProgressRequest()
}

/**
 * 串行调度下一次任务进度轮询（上一轮结束后再发请求，避免重叠占用连接）
 * @param {string} taskUuid 任务 UUID
 * @param {*} taskOther 子组件上下文
 * @param {number} pollToken 轮询代次
 * @param {number} [delayMs] 延迟毫秒
 * @returns {void}
 */
const scheduleTaskProgressPoll = (taskUuid, taskOther, pollToken, progressSession, delayMs = TASK_POLL_INTERVAL_MS) => {
  if (pollToken !== taskProgressPollToken) return
  if (progressSession !== taskProgressSessionId) return
  if (!showDocumentPreviewDialog.value) {
    finishTaskProgressForDialog()
    return
  }
  if (taskProgressPollTimeout) {
    clearTimeout(taskProgressPollTimeout)
  }
  taskProgressPollTimeout = setTimeout(() => {
    taskProgressPollTimeout = null
    pollTaskProgress(taskUuid, taskOther, pollToken, progressSession)
  }, delayMs)
}

// 完成任务加载
/**
 * 停止任务进度轮询（不清空已完成任务 UUID，避免合同分析等重入丢失报告上下文）
 * @returns {void}
 */
const clearTaskProgressPolling = () => {
  taskProgressSessionId++
  taskProgressPollToken++
  clearTaskProgressTimers()
  taskProgressLoading.value = false
  taskProgressFloatingVisible.value = false
  taskProgressText.value = ''
  taskProgressElapsedTime.value = 0
  taskProgressRuntimeNodes.value = []
}

/**
 * 停止任务进度轮询并清理状态
 * @param {{ clearTaskUuid?: boolean }} [options]
 * @returns {void}
 */
const finishTaskProgress = (options = {}) => {
  const { clearTaskUuid = true } = options
  clearTaskProgressPolling()
  if (clearTaskUuid) {
    currentTaskUuid.value = null
  }
}

/** 是否需要在关弹窗/任务完成后保留 taskId 与 currentTaskUuid（仅合同分析、待摊费用） */
const isTaskContextPersistTool = () => {
  const tool = documentPreviewParams.value.tool
  return tool === 'prepaidExpenses' || tool === 'contractCompleteness'
}

/**
 * 按当前工具决定是否保留任务 UUID 地结束进度轮询
 * @returns {void}
 */
const finishTaskProgressForDialog = () => {
  finishTaskProgress({ clearTaskUuid: !isTaskContextPersistTool() })
}

/**
 * 将任务 UUID 写入弹窗参数，供关弹窗后重开或报告状态恢复
 * @param {string} taskUuid 任务 UUID
 * @returns {void}
 */
const persistDocumentPreviewTaskId = (taskUuid) => {
  if (!taskUuid) return
  if (isTaskContextPersistTool()) {
    documentPreviewParams.value = {
      ...documentPreviewParams.value,
      taskId: taskUuid
    }
  }
}

/**
 * 清除弹窗参数中的任务 UUID（待摊费用失败后恢复可编辑配置）
 * @returns {void}
 */
const clearDocumentPreviewTaskId = () => {
  stopPrepaidBackgroundWatch()
  if (!documentPreviewParams.value.taskId) return
  documentPreviewParams.value = {
    ...documentPreviewParams.value,
    taskId: ''
  }
}

const stopPrepaidBackgroundWatch = () => {
  prepaidBackgroundPollToken++
  prepaidBackgroundWatchVisible.value = false
  if (prepaidBackgroundPollTimeout) {
    clearTimeout(prepaidBackgroundPollTimeout)
    prepaidBackgroundPollTimeout = null
  }
  if (prepaidBackgroundAbortController) {
    try {
      prepaidBackgroundAbortController.abort()
    } catch (_e) {
      /* ignore */
    }
    prepaidBackgroundAbortController = null
  }
}

const schedulePrepaidBackgroundPoll = (taskUuid, pollToken, delayMs = PREPAID_BACKGROUND_POLL_MS) => {
  if (pollToken !== prepaidBackgroundPollToken) return
  if (prepaidBackgroundPollTimeout) {
    clearTimeout(prepaidBackgroundPollTimeout)
  }
  prepaidBackgroundPollTimeout = setTimeout(() => {
    prepaidBackgroundPollTimeout = null
    pollPrepaidBackgroundWatch(taskUuid, pollToken)
  }, delayMs)
}

const reopenPrepaidDocumentPreview = (taskUuid) => {
  if (!taskUuid) return
  persistDocumentPreviewTaskId(taskUuid)
  if (documentPreviewParams.value.tool !== 'prepaidExpenses') {
    documentPreviewParams.value = {
      ...documentPreviewParams.value,
      tool: 'prepaidExpenses',
      toolLabel: documentPreviewParams.value.toolLabel || getToolName('prepaidExpenses')
    }
  }
  const alreadyOpen = showDocumentPreviewDialog.value
    && String(documentPreviewParams.value.taskId || '') === String(taskUuid)
  if (!alreadyOpen) {
    showDocumentPreviewDialog.value = true
  }
  nextTick(() => {
    viewerRef.value?.loadPrepaidTaskById?.()
  })
}

const notifyPrepaidBackgroundOnce = (key, notificationOptions) => {
  if (prepaidBackgroundNotifiedKeys.has(key)) return false
  prepaidBackgroundNotifiedKeys.add(key)
  ElNotification(notificationOptions)
  return true
}

const handlePrepaidBackgroundTerminal = async (action, td, resultList, taskUuid) => {
  prepaidNeedsBackgroundWatch = false
  stopPrepaidBackgroundWatch()
  if (action === 'phase1_done') {
    const key = `${taskUuid}:awaiting_billing_base`
    notifyPrepaidBackgroundOnce(key, {
      title: '待摊费用',
      message: '计费约定已提取，请填写计费基数后继续',
      type: 'info',
      duration: 8000
    })
    return
  }
  if (action === 'complete') {
    const key = `${taskUuid}:completed`
    notifyPrepaidBackgroundOnce(key, {
      title: '待摊费用',
      message: '费用计算已完成',
      type: 'success',
      duration: 8000
    })
    return
  }
  if (action === 'fail') {
    const key = `${taskUuid}:failed`
    notifyPrepaidBackgroundOnce(key, {
      title: '待摊费用',
      message: resolveScheduleTaskFailureMessage(td) || '任务处理失败',
      type: 'error',
      duration: 8000
    })
    clearDocumentPreviewTaskId()
  }
}

const pollPrepaidBackgroundWatch = async (taskUuid, pollToken) => {
  if (pollToken !== prepaidBackgroundPollToken) return
  if (!taskUuid) {
    stopPrepaidBackgroundWatch()
    return
  }

  if (prepaidBackgroundAbortController) {
    try {
      prepaidBackgroundAbortController.abort()
    } catch (_e) {
      /* ignore */
    }
  }
  if (typeof AbortController !== 'undefined') {
    prepaidBackgroundAbortController = new AbortController()
  }

  try {
    const detailRes = await getTaskSchedulesAPI(taskUuid, {
      prefer_runtime: true,
      include_results: true,
      include_result_details: true,
      include_task_steps: true,
      include_selection_summary: true,
      signal: prepaidBackgroundAbortController ? prepaidBackgroundAbortController.signal : undefined
    })
    if (pollToken !== prepaidBackgroundPollToken) return

    if (detailRes.code !== 200 || !detailRes.data) {
      const msg = String(detailRes?.message || '')
      if (detailRes?.code === 404 || msg.includes('不存在') || msg.includes('已删除')) {
        stopPrepaidBackgroundWatch()
      } else {
        schedulePrepaidBackgroundPoll(taskUuid, pollToken)
      }
      return
    }

    const td = detailRes.data
    const taskStatus = Number(td.task_status)
    const serverPrepaidPhase = String(td.prepaid_phase || '')
    const resultList = Array.isArray(td.task_schedule_result_list) ? td.task_schedule_result_list : []

    if (showDocumentPreviewDialog.value && documentPreviewParams.value.tool === 'prepaidExpenses') {
      viewerRef.value?.refreshFromTaskDetail?.(td, resultList)
    }

    const deferFinish = viewerRef.value?.shouldDeferPrepaidProgressFinish?.() === true
    const resolved = resolvePrepaidPollAction({
      taskStatus,
      serverPrepaidPhase,
      resultList,
      deferFinish,
      prepaidProgressLastNotifiedPhase
    })

    if (resolved.action === 'fail') {
      await handlePrepaidBackgroundTerminal('fail', td, resultList, taskUuid)
      return
    }
    if (resolved.action === 'complete') {
      await handlePrepaidBackgroundTerminal('complete', td, resultList, taskUuid)
      return
    }
    if (resolved.action === 'complete_pending_results') {
      schedulePrepaidBackgroundPoll(taskUuid, pollToken, 1500)
      return
    }
    if (resolved.action === 'phase1_done') {
      prepaidProgressLastNotifiedPhase = 'awaiting_billing_base'
      await handlePrepaidBackgroundTerminal('phase1_done', td, resultList, taskUuid)
      return
    }
    if (resolved.action === 'continue' || resolved.action === 'phase1_done_continue' || resolved.action === 'keep_polling') {
      schedulePrepaidBackgroundPoll(taskUuid, pollToken)
    }
  } catch (error) {
    if (isRequestAbortedError(error) || pollToken !== prepaidBackgroundPollToken) return
    console.error('[PrepaidBackground] 轮询失败:', error)
    schedulePrepaidBackgroundPoll(taskUuid, pollToken)
  }
}

const startPrepaidBackgroundWatch = (taskUuid) => {
  const uuid = String(taskUuid || '').trim()
  if (!uuid) return
  if (documentPreviewParams.value.tool !== 'prepaidExpenses') return
  stopPrepaidBackgroundWatch()
  const pollToken = ++prepaidBackgroundPollToken
  prepaidBackgroundWatchVisible.value = true
  pollPrepaidBackgroundWatch(uuid, pollToken)
}

const handlePrepaidBackgroundBallClick = () => {
  const taskUuid = String(documentPreviewParams.value.taskId || currentTaskUuid.value || '').trim()
  if (!taskUuid) return
  reopenPrepaidDocumentPreview(taskUuid)
}

const applyPrepaidForegroundPollResolution = async ({
  td,
  resultList,
  taskUuid,
  taskOther,
  pollToken,
  progressSession,
  serverPrepaidPhase,
  taskStatus
}) => {
  viewerRef.value?.refreshFromTaskDetail?.(td, resultList)
  const deferFinish = viewerRef.value?.shouldDeferPrepaidProgressFinish?.() === true

  const resolved = resolvePrepaidPollAction({
    taskStatus,
    serverPrepaidPhase,
    resultList,
    deferFinish,
    prepaidProgressLastNotifiedPhase
  })

  if (resolved.action === 'fail') {
    prepaidNeedsBackgroundWatch = false
    finishTaskProgress()
    clearDocumentPreviewTaskId()
    const errMsg = resolveScheduleTaskFailureMessage(td)
    ElMessage.error(errMsg)
    viewerRef.value?.taskError(errMsg)
    return true
  }

  if (resolved.action === 'complete') {
    prepaidNeedsBackgroundWatch = false
    finishTaskProgress({ clearTaskUuid: false })
    persistDocumentPreviewTaskId(taskUuid)
    ElMessage.success('任务执行完成')
    await viewerRef.value?.setResult?.(resultList, taskOther)
    return true
  }

  if (resolved.action === 'complete_pending_results') {
    scheduleTaskProgressPoll(taskUuid, taskOther, pollToken, progressSession, 1500)
    return true
  }

  if (resolved.action === 'continue' || resolved.action === 'phase1_done_continue') {
    scheduleTaskProgressPoll(taskUuid, taskOther, pollToken, progressSession)
    return true
  }

  if (resolved.action === 'phase1_done') {
    prepaidNeedsBackgroundWatch = false
    if (resolved.notifyPhase1) {
      prepaidProgressLastNotifiedPhase = 'awaiting_billing_base'
      finishTaskProgress({ clearTaskUuid: false })
      ElMessage.info('计费约定提取完成，请填写计费基数后点击执行')
    }
    return true
  }

  if (resolved.action === 'keep_polling') {
    scheduleTaskProgressPoll(taskUuid, taskOther, pollToken, progressSession)
    return true
  }

  return false
}

/**
 * 关闭功能弹窗时停止任务进度轮询
 * @returns {void}
 */
const handleDocumentPreviewDialogClose = () => {
  finishTaskProgressForDialog()
  showDocumentPreviewDialog.value = false
}

/**
 * 响应子组件发出的停止轮询事件
 * @returns {void}
 */
const handleTaskProgressStop = () => {
  finishTaskProgressForDialog()
}

// 开始任务进度追踪
const startTaskProgress = (taskUuid, taskName = '任务', taskOther) => {
  if (!showDocumentPreviewDialog.value) {
    return
  }

  if (!taskUuid) {
    ElMessage.error('未获取到任务标识')
    return
  }

  clearTaskProgressTimers()
  const pollToken = ++taskProgressPollToken
  const progressSession = taskProgressSessionId
  currentTaskUuid.value = taskUuid
  taskProgressLoading.value = true
  taskProgressElapsedTime.value = 0
  taskProgressText.value = `${taskName}执行中... 0.0s`
  taskProgressRuntimeNodes.value = []

  if (documentPreviewParams.value.tool === 'prepaidExpenses') {
    if (prepaidProgressLastTaskUuid !== taskUuid) {
      prepaidProgressLastNotifiedPhase = ''
      prepaidProgressLastTaskUuid = taskUuid
    }
  }

  // 启动计时器
  taskProgressTimer = setInterval(() => {
    if (progressSession !== taskProgressSessionId || !showDocumentPreviewDialog.value) {
      finishTaskProgressForDialog()
      return
    }
    taskProgressElapsedTime.value += 0.1
    taskProgressText.value = `${taskName}执行中... ${taskProgressElapsedTime.value.toFixed(1)}s`
  }, 100)

  pollTaskProgress(taskUuid, taskOther, pollToken, progressSession)
}

const viewerRef = ref(null)

// 轮询任务进度
const pollTaskProgress = async (taskUuid, taskOther, pollToken, progressSession) => {
  if (pollToken !== taskProgressPollToken) return
  if (progressSession !== taskProgressSessionId) return
  if (!showDocumentPreviewDialog.value) {
    finishTaskProgressForDialog()
    return
  }

  abortTaskProgressRequest()
  if (typeof AbortController !== 'undefined') {
    taskProgressAbortController = new AbortController()
  }

  try {
    const detailRes = await getTaskSchedulesAPI(taskUuid, {
      prefer_runtime: true,
      include_results: true,
      include_result_details: true,
      include_task_steps: true,
      include_selection_summary: true,
      signal: taskProgressAbortController ? taskProgressAbortController.signal : undefined
    })
    if (pollToken !== taskProgressPollToken || progressSession !== taskProgressSessionId) return

    if (detailRes.code !== 200 || !detailRes.data) {
      const msg = String(detailRes?.message || '')
      const isTerminatedLike =
        detailRes?.code === 404 ||
        msg.includes('不存在') ||
        msg.includes('已删除')
      if (isTerminatedLike) {
        finishTaskProgress()
        ElMessage.info('任务已终止，停止轮询')
      } else {
        scheduleTaskProgressPoll(taskUuid, taskOther, pollToken, progressSession)
      }
      return
    }

    const td = detailRes.data
    const taskStatus = Number(td.task_status)
    const bizType = String(td.biz_type || '')
    const prepaidPhase = String(td.prepaid_phase || '')
    const resultList = Array.isArray(td.task_schedule_result_list) ? td.task_schedule_result_list : []
    const fileStatuses = resultList.map((r) =>
      Number(r.processing_status ?? r.PROCESSING_STATUS ?? -1)
    )

    taskProgressRuntimeNodes.value = buildTaskRuntimeNodesDisplay(td)

    const isMeetingMinutesTask =
      bizType === 'meeting_minutes' ||
      documentPreviewParams.value.tool === 'meetingMinutes'

    // 待摊费用：阶段①完成时不调用 setResult，刷新详情并提示填写计费基数
    if (bizType === 'prepaidExpenses') {
      const serverPrepaidPhase = prepaidPhase
      const handled = await applyPrepaidForegroundPollResolution({
        td,
        resultList,
        taskUuid,
        taskOther,
        pollToken,
        progressSession,
        serverPrepaidPhase,
        taskStatus
      })
      if (handled) return
      scheduleTaskProgressPoll(taskUuid, taskOther, pollToken, progressSession)
      return
    }

    // 任务失败
    if (taskStatus === 3 || fileStatuses.some((s) => s === 3)) {
      finishTaskProgress()
      if (isTaskContextPersistTool()) {
        clearDocumentPreviewTaskId()
      }
      const errMsg = resolveScheduleTaskFailureMessage(td)
      ElMessage.error(errMsg)
      viewerRef.value?.taskError(errMsg)
      return
    }

    // 任务完成：会议纪要须等主任务 task_status=2（含聚类+风险分析），不可仅凭文件解析完成
    const allFilesSucceeded =
      fileStatuses.length > 0 && fileStatuses.every((s) => s === 2)
    const allTerminal =
      fileStatuses.length > 0 && fileStatuses.every((s) => s === 2 || s === 3)
    const taskCompleted = isMeetingMinutesTask
      ? taskStatus === 2
      : (taskStatus === 2 || allFilesSucceeded || allTerminal)
    if (taskCompleted) {
      if (isTaskContextPersistTool()) {
        finishTaskProgress({ clearTaskUuid: false })
        persistDocumentPreviewTaskId(taskUuid)
      } else {
        finishTaskProgress()
      }
      ElMessage.success('任务执行完成')
      viewerRef.value?.setResult(detailRes.data.task_schedule_result_list, taskOther)
      viewerRef.value?.setAnalysisContext?.({
        taskUuid,
        taskData: detailRes.data
      })
      return
    }

    scheduleTaskProgressPoll(taskUuid, taskOther, pollToken, progressSession)
  } catch (error) {
    if (isRequestAbortedError(error) || pollToken !== taskProgressPollToken || progressSession !== taskProgressSessionId) return

    const errMsg =
      String(error?.response?.data?.message || '') ||
      String(error?.message || '')
    if (errMsg.includes('不存在') || errMsg.includes('已删除')) {
      finishTaskProgress()
      ElMessage.info('任务已终止，停止轮询')
      return
    }
    console.error('查询任务进度失败:', error)
    scheduleTaskProgressPoll(taskUuid, taskOther, pollToken, progressSession)
  }
}

// 工具箱工具点击处理
const handleTextSearchToolClick = (toolType, toolLabel) => {
  const resolvedLabel = toolLabel ?? getToolName(toolType)
  // 关闭下拉菜单
  showTextSearchToolbox.value = false

  // 使用表格勾选的数据
  const selectedRows = textSearchTableSelectedRows.value
  if (!selectedRows.length) {
    ElMessage.warning('请先勾选要处理的文件')
    return
  }

  // 如果是会议纪要分析，过滤出 pdf、doc、docx 格式的文件
  let filteredFiles = selectedRows
  if (toolType === 'meetingMinutes') {
    filteredFiles = selectedRows.filter(file => {
      const fileName = file.file_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.pdf', '.doc', '.docx', '.wps'].includes(ext)
    })

    if (filteredFiles.length < selectedRows.length) {
      ElMessage.warning('会议纪要分析仅支持 pdf、doc、docx、wps 格式的文件，已帮您过滤掉其他格式的文件')
    }
  }

  // 如果是合同完备性分析，过滤出 pdf、doc、docx 格式的文件
  if (toolType === 'contractCompleteness') {
    filteredFiles = selectedRows.filter(file => {
      const fileName = file.file_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.pdf', '.doc', '.docx', '.wps'].includes(ext)
    })

    if (filteredFiles.length < selectedRows.length) {
      ElMessage.warning('合同完备性分析仅支持 pdf、doc、docx、wps 格式的文件，已帮您过滤掉其他格式的文件')
    }
  }

  if (toolType === 'riskPointAnalysis') {
    filteredFiles = selectedRows.filter(file => {
      const fileName = file.file_name || ''
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      return ['.pdf', '.doc', '.docx'].includes(ext)
    })

    if (filteredFiles.length < selectedRows.length) {
      ElMessage.warning('风险点分析仅支持 pdf、doc、docx 格式的文件，已帮您过滤掉其他格式的文件')
    }
  }

  // 如果没有符合条件的文件
  if (!filteredFiles.length) {
    ElMessage.warning('没有符合要求的文件可供处理')
    return
  }

  // 构建路由参数，传递文件信息
  const fileIds = filteredFiles.map(f => f.file_id).join(',')
  const fileNames = filteredFiles.map(f => f.file_name).join(',')

  finishTaskProgress()

  const newParams = {
    tool: toolType,
    toolLabel: resolvedLabel,
    files: fileIds,
    names: fileNames,
    taskId: ''
  }

  // 若弹窗已打开，先关闭再重开，确保清理旧任务进度并重建子组件
  if (showDocumentPreviewDialog.value) {
    showDocumentPreviewDialog.value = false
    nextTick(() => {
      documentPreviewParams.value = newParams
      showDocumentPreviewDialog.value = true
    })
  } else {
    documentPreviewParams.value = newParams
    showDocumentPreviewDialog.value = true
  }
}

// 工具箱鼠标进入处理
const handleToolboxMouseEnter = () => {
  // 清除关闭定时器
  clearTimeout(toolboxCloseTimer)
  toolboxCloseTimer = null
  showTextSearchToolbox.value = true
}

// 工具箱鼠标离开处理
const handleToolboxMouseLeave = () => {
  // 延迟关闭，给鼠标移动到下拉菜单的时间
  toolboxCloseTimer = setTimeout(() => {
    showTextSearchToolbox.value = false
  }, 500)
}

watch(textSearchDialogVisible, (visible) => {
  if (visible) {
    document.addEventListener('keydown', handleTextSearchKeydown)
  } else {
    document.removeEventListener('keydown', handleTextSearchKeydown)
    resetTextSearchDialogState()
  }
})

// 监听文档预览弹窗关闭：待摊费用未终态时转后台 Watch，其余停止轮询
watch(showDocumentPreviewDialog, (visible) => {
  if (visible) {
    stopPrepaidBackgroundWatch()
    return
  }
  const params = documentPreviewParams.value
  const taskUuid = String(params.taskId || currentTaskUuid.value || '').trim()
  const progressActive = taskProgressLoading.value || taskProgressFloatingVisible.value
  if (params.tool === 'prepaidExpenses' && taskUuid && (prepaidNeedsBackgroundWatch || progressActive)) {
    clearTaskProgressPolling()
    taskProgressLoading.value = false
    taskProgressFloatingVisible.value = false
    startPrepaidBackgroundWatch(taskUuid)
    return
  }
  prepaidNeedsBackgroundWatch = false
  finishTaskProgressForDialog()
})

/**
 * 离开任务中心路由时强制关闭功能弹窗并停止进度轮询
 * @param {string} path 当前路由路径
 * @returns {void}
 */
const handleRouteProgressCleanup = (path) => {
  if (!path || path.indexOf('/task-center') === -1) return
  if (!showDocumentPreviewDialog.value && !taskProgressLoading.value) return
  finishTaskProgress()
  showDocumentPreviewDialog.value = false
}

watch(() => route.fullPath, (path) => {
  handleRouteProgressCleanup(path)
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleTextSearchKeydown)
  window.removeEventListener('beforeunload', beforeUnloadHandler)
  cleanupUploadCollapsedBallDrag()
  if (toolboxCloseTimer) {
    clearTimeout(toolboxCloseTimer)
    toolboxCloseTimer = null
  }
  // 清理任务进度相关定时器（含 pollToken，避免卸载后仍有 await 回调写状态）
  finishTaskProgress()
  stopPrepaidBackgroundWatch()
  // 移除事件监听
  eventBus.off(FILE_MANAGER_PROGRESS_START, handleTaskProgressStart)
  eventBus.off(FILE_MANAGER_PROGRESS_STOP, handleTaskProgressStop)
})

import { useFileManagerFunctionList } from './composables/useFileManagerFunctionList.js'
import { getFileManagerToolIconUrl } from './composables/fileManagerToolUtils.js'
import riskPointAnalysisFallbackIcon from './iconKey/riskPointAnalysis.png'
import { useFileParseStatusDict } from './composables/useFileParseStatusDict.js'

const { functionGroups, loadFunctionList } = useFileManagerFunctionList()
const {
  options: parseStatusOptions,
  loadParseStatusDict,
  resolveStatusValue,
  getLabel: getParseStatusLabel,
  getTagType: getParseStatusTagType,
  isReparseEligible
} = useFileParseStatusDict()
const functionColorMap = ref(['#F56C6C', '#67C23A', '#409EFF', '#909399', '#E6A23C', '#9C27B0', '#00BCD4', '#FF9800', '#795548', '#607D8B'])

const handleToolIconError = (event, item) => {
  const label = String(item?.label || '')
  if (!label.includes('风险点')) return
  const img = event?.target
  if (!img || img.dataset.fallbackApplied === '1') return
  img.dataset.fallbackApplied = '1'
  img.src = riskPointAnalysisFallbackIcon
}

const checkUploadRecovery = async () => {
  try {
    isPrivateMode.value = await detectPrivateMode()
  } catch {
    isPrivateMode.value = true
  }

  if (isPrivateMode.value) return

  try {
    await initUploadCacheDB()
    await cleanupExpiredRecords()
    await pruneCompletedUploadRecords()
    const localRecords = await getIncompleteRecords()

    let serverSessions = []
    try {
      const res = await listFolderUploadSessionsAPI()
      if (res.code === 200 && res.data?.sessions) {
        serverSessions = res.data.sessions
      }
    } catch (e) {
      console.warn('查询服务端文件夹上传会话失败，将仅使用本地缓存:', e)
    }

    const mergedMap = new Map()
    localRecords.forEach(r => mergedMap.set(r.id, r))

    for (const session of serverSessions) {
      const cacheId = generateRecordId('folder_upload', session.parent_folder_id)
      const existing = mergedMap.get(cacheId) || null
      mergedMap.set(cacheId, serverSessionToRecoveryRecord(session, existing))
    }

    const records = Array.from(mergedMap.values())
    if (records.length > 0) {
      uploadRecoveryRecords.value = records
      uploadRecoveryVisible.value = true
    }
  } catch {
    console.warn('检测未完成上传记录失败')
  }
}

const handleRecoveryContinue = async () => {
  uploadRecoveryVisible.value = false
  const records = uploadRecoveryRecords.value
  const folderRecords = records.filter(r => r.file_hash === 'folder_upload' || (r.folder_structure && Object.keys(r.folder_structure).length > 0))
  const regularRecords = records.filter(r => r.file_hash !== 'folder_upload' && (!r.folder_structure || Object.keys(r.folder_structure).length === 0))

  if (regularRecords.length > 0) {
    uploadRecoveryPendingFileRecords.value = [...regularRecords]
    openNextSingleFileRecovery()
  }

  if (folderRecords.length > 0) {
    for (const record of folderRecords) {
      await recoverFolderUpload(record)
    }
  }
}

const removeRecoveryRecordFromList = (recordId) => {
  uploadRecoveryRecords.value = uploadRecoveryRecords.value.filter((r) => r.id !== recordId)
  uploadRecoveryPendingFileRecords.value = uploadRecoveryPendingFileRecords.value.filter(
    (r) => r.id !== recordId
  )
}

const openSingleFileRecoveryPicker = (record) => {
  pendingSingleFileRecoveryInFolder.value = null
  uploadRecoveryPendingFileRecords.value = [record]
  uploadRecoveryPendingFileRecord.value = record
  uploadRecoveryFileInputVisible.value = true
}

const openNextSingleFileRecovery = () => {
  pendingSingleFileRecoveryInFolder.value = null
  const queue = uploadRecoveryPendingFileRecords.value
  if (!queue.length) {
    uploadRecoveryPendingFileRecord.value = null
    uploadRecoveryFileInputVisible.value = false
    return
  }
  uploadRecoveryPendingFileRecord.value = queue[0]
  uploadRecoveryFileInputVisible.value = true
}

const triggerSingleFileRecoveryPicker = () => {
  pendingSingleFileRecoveryInFolder.value = null
  const input = uploadRecoveryFileInputRef.value
  if (!input) return
  input.value = ''
  input.click()
}

const skipCurrentSingleFileRecovery = async () => {
  const record = uploadRecoveryPendingFileRecord.value
  if (record?.id) {
    await deleteUploadRecord(record.id).catch(() => {})
    removeRecoveryRecordFromList(record.id)
  }
  uploadRecoveryPendingFileRecords.value = uploadRecoveryPendingFileRecords.value.filter(
    (r) => r.id !== record?.id
  )
  if (uploadRecoveryPendingFileRecords.value.length > 0) {
    openNextSingleFileRecovery()
  } else {
    uploadRecoveryPendingFileRecord.value = null
    uploadRecoveryFileInputVisible.value = false
    ElMessage.info('已跳过剩余待恢复文件')
  }
}

const cancelSingleFileRecovery = () => {
  uploadRecoveryPendingFileRecord.value = null
  uploadRecoveryPendingFileRecords.value = []
  uploadRecoveryFileInputVisible.value = false
}

const recoverSingleFileInFolder = (data) => {
  if (!data?.relativePath) return
  pendingSingleFileRecoveryInFolder.value = data
  let input = uploadRecoveryFileInputRef.value
  if (!input) {
    input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    const onceChange = (event) => {
      handleRecoveryFileSelect(event).finally(() => {
        if (input.parentNode) input.parentNode.removeChild(input)
      })
    }
    input.addEventListener('change', onceChange, { once: true })
    document.body.appendChild(input)
  }
  input.value = ''
  input.click()
}

const skipSingleFileInFolder = async (data) => {
  if (!data?.recordId || !data?.relativePath) return
  const record = uploadRecoveryRecords.value.find((r) => r.id === data.recordId)
  if (!record) return

  const meta = record.file_metadata_list.find((m) => m.relativePath === data.relativePath)
  if (meta) {
    meta.skipped = true
    meta.skipReason = '用户手动跳过'
  }
  await saveUploadRecord(record).catch(() => {})

  if (record.session_id) {
    await updateFolderUploadFileStatusAPI(record.session_id, {
      relative_path: data.relativePath,
      status: 'skipped',
      skip_reason: '用户手动跳过'
    }).catch(() => {})
  }

  const allDone = record.file_metadata_list.every((m) => m.uploaded || m.skipped)
  if (allDone) {
    await deleteUploadRecord(record.id).catch(() => {})
    if (record.session_id) {
      await deleteServerFolderUploadSession(record.session_id)
    }
    uploadRecoveryRecords.value = uploadRecoveryRecords.value.filter((r) => r.id !== record.id)
    if (uploadRecoveryRecords.value.length === 0) {
      uploadRecoveryVisible.value = false
    }
  }
}

const recoverFolderSingleFile = async (data, file) => {
  if (!data?.recordId || !data?.relativePath || !file) return
  const record = uploadRecoveryRecords.value.find((r) => r.id === data.recordId)
  if (!record) return

  const expectedName = data.label || data.relativePath.split('/').pop()
  if (file.name !== expectedName) {
    try {
      await ElMessageBox.confirm(
        `所选文件「${file.name}」与记录「${expectedName}」不一致，仍要继续上传吗？`,
        '文件名不一致',
        { type: 'warning', confirmButtonText: '继续上传', cancelButtonText: '重新选择' }
      )
    } catch {
      return
    }
  }

  const meta = record.file_metadata_list.find((m) => m.relativePath === data.relativePath)
  if (meta?.file_hash) {
    try {
      const currentHash = await computeFileHash(file)
      if (currentHash !== meta.file_hash) {
        await ElMessageBox.confirm(
          '所选文件内容已变更，仍要继续上传吗？',
          '文件内容不一致',
          { type: 'warning', confirmButtonText: '继续上传', cancelButtonText: '取消' }
        )
      }
    } catch {
      ElMessage.warning('校验文件内容失败，请重试')
      return
    }
  }

  const success = await uploadSingleFolderFile({
    file,
    folderId: data.folderId,
    relativePath: data.relativePath,
    overwrite: false
  })

  if (!success) return

  const cachedRecord = uploadRecoveryRecords.value.find((r) => r.id === data.recordId)
  if (cachedRecord) {
    const cachedMeta = cachedRecord.file_metadata_list.find((m) => m.relativePath === data.relativePath)
    if (cachedMeta) {
      cachedMeta.uploaded = true
      cachedMeta.failed = false
      cachedMeta.failReason = ''
    }
    const allDone = cachedRecord.file_metadata_list.every((m) => m.uploaded || m.skipped)
    if (allDone) {
      uploadRecoveryRecords.value = uploadRecoveryRecords.value.filter((r) => r.id !== data.recordId)
      if (uploadRecoveryRecords.value.length === 0) {
        uploadRecoveryVisible.value = false
      }
    }
  }
}

const recoverSingleFileUpload = async (record, file) => {
  if (!record?.folder_id) {
    ElMessage.warning('上传记录缺少目标文件夹，无法恢复')
    return
  }

  if (record.file_hash && record.file_hash !== 'folder_upload') {
    try {
      const hash = await computeFileHash(file)
      if (hash !== record.file_hash) {
        await ElMessageBox.confirm(
          '所选文件与上次上传记录不一致（内容哈希不同），仍要继续上传吗？',
          '文件不一致',
          { type: 'warning', confirmButtonText: '继续上传', cancelButtonText: '重新选择' }
        )
      }
    } catch {
      return
    }
  } else if (record.file_name && file.name !== record.file_name) {
    try {
      await ElMessageBox.confirm(
        `所选文件名「${file.name}」与记录「${record.file_name}」不一致，仍要继续上传吗？`,
        '文件名不一致',
        { type: 'warning', confirmButtonText: '继续上传', cancelButtonText: '重新选择' }
      )
    } catch {
      return
    }
  }

  handleCustomUpload({
    file,
    overwrite: !!record.overwrite,
    targetFolderId: record.folder_id
  })

  await deleteUploadRecord(record.id).catch(() => {})
  removeRecoveryRecordFromList(record.id)
  uploadRecoveryPendingFileRecords.value = uploadRecoveryPendingFileRecords.value.filter(
    (r) => r.id !== record.id
  )

  if (uploadRecoveryPendingFileRecords.value.length > 0) {
    openNextSingleFileRecovery()
  } else {
    uploadRecoveryPendingFileRecord.value = null
    uploadRecoveryFileInputVisible.value = false
  }
}

const handleRecoveryFileSelect = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return

  const file = files[0]
  event.target.value = ''

  const folderFileData = pendingSingleFileRecoveryInFolder.value
  if (folderFileData) {
    pendingSingleFileRecoveryInFolder.value = null
    await recoverFolderSingleFile(folderFileData, file)
    return
  }

  const record = uploadRecoveryPendingFileRecord.value
  if (!record) return
  await recoverSingleFileUpload(record, file)
}

const recoverFolderUpload = async (record) => {
  let loadingInstance = null
  try {
    loadingInstance = ElLoading.service({
      lock: true,
      text: '正在恢复文件夹上传...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    let dirHandle = isPersistableDirectoryHandle(record.directory_handle)
      ? record.directory_handle
      : null

    if (dirHandle) {
      try {
        let permission = await dirHandle.queryPermission({ mode: 'read' })
        if (permission !== 'granted') {
          permission = await dirHandle.requestPermission({ mode: 'read' })
        }
        if (permission === 'granted') {
          loadingInstance.close()
          loadingInstance = null
          await recoverFolderFromHandle(record, dirHandle)
          return
        }
      } catch (e) {
        console.warn('directory_handle 权限恢复失败:', e)
        dirHandle = null
      }
    }

    if (window.showDirectoryPicker) {
      loadingInstance.close()
      loadingInstance = null
      try {
        const picked = await window.showDirectoryPicker({ mode: 'read' })
        const expected = record.root_folder_name
        if (expected && picked.name !== expected) {
          try {
            await ElMessageBox.confirm(
              `所选文件夹「${picked.name}」与上次上传的「${expected}」不一致，继续可能导致部分文件无法匹配。是否继续？`,
              '文件夹不一致',
              { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
            )
          } catch {
            return
          }
        }
        record.directory_handle = picked
        await saveUploadRecord({ ...record, directory_handle: picked }).catch(() => {})
        await recoverFolderFromHandle(record, picked)
        return
      } catch (e) {
        if (e.name === 'AbortError') return
        console.warn('showDirectoryPicker 恢复失败:', e)
      }
    }

    loadingInstance.close()
    loadingInstance = null
    uploadRecoveryPendingRecord.value = record
    uploadRecoveryFolderInputVisible.value = true
  } finally {
    if (loadingInstance) {
      loadingInstance.close()
    }
  }
}

const recoverFolderFromHandle = async (record, dirHandle) => {
  try {
    const { files: rawFiles } = await readAllFilesFromHandle(dirHandle)
    const localFiles = rawFiles.map(file => {
      file.relativePath = `${dirHandle.name}/${file.relativePath}`
      return file
    })
    await recoverFolderWithLocalFiles(record, localFiles)
  } catch (e) {
    console.warn('从 directory_handle 读取文件失败', e)
    ElMessage.error('读取本地文件夹失败，请重试')
  }
}

const recoverFolderWithLocalFiles = async (record, localFiles) => {
  const metadata = record.file_metadata_list || []
  const folderIdMap = record.folder_structure || {}

  // 恢复时判断根文件夹是否已存在：folder_structure 中存在无斜杠的顶层路径即说明已创建
  const rootFolderPath = Object.keys(folderIdMap).find(path => !path.includes('/'))
  folderUploadRootExists.value = !!rootFolderPath

  if (metadata.length === 0) {
    ElMessage.warning('上传记录缺少文件元数据，无法恢复')
    return
  }

  const { matched, deleted } = matchFilesWithCache(localFiles, metadata)

  for (const meta of deleted) {
    if (!meta.uploaded && !meta.skipped) {
      meta.skipped = true
      meta.skipReason = '文件已删除'
    }
  }

  const pendingMatched = matched.filter(m => !m.meta.uploaded && !m.meta.skipped)

  // 校验文件内容是否变更：对缓存有 file_hash 的记录重新计算 hash 比对
  const changedFiles = []
  for (const item of pendingMatched) {
    if (item.meta.file_hash) {
      try {
        const currentHash = await computeFileHash(item.file)
        if (currentHash !== item.meta.file_hash) {
          item.meta.skipped = true
          item.meta.skipReason = '文件内容已变更，将跳过'
          changedFiles.push(item.meta.relativePath)
        }
      } catch {
        console.warn('恢复时计算文件 hash 失败:', item.meta.relativePath)
      }
    }
  }

  const validPendingMatched = pendingMatched.filter(m => !m.meta.skipped)

  if (changedFiles.length > 0) {
    ElMessage.warning(`${changedFiles.length} 个文件内容已变更，将跳过`)
  }

  const allMetadataDone = metadata.length > 0 && metadata.every(m => m.uploaded || m.skipped)
  if (allMetadataDone) {
    await deleteUploadRecord(record.id).catch(() => {})
    if (record.session_id) {
      await deleteServerFolderUploadSession(record.session_id)
    }
    ElMessage.success('该文件夹上传任务已全部完成')
    uploadRecoveryPendingRecord.value = null
    return
  }

  folderUploadSessionId.value = record.session_id || ''

  const recoverFolderFileMap = {}
  for (const { meta, file } of validPendingMatched) {
    const parts = meta.relativePath.split('/')
    const fileName = parts[parts.length - 1]
    let targetFolderId = record.folder_id
    if (parts.length >= 2) {
      const dirPath = parts.slice(0, parts.length - 1).join('/')
      targetFolderId = folderIdMap[dirPath] || record.folder_id
    }
    if (!recoverFolderFileMap[targetFolderId]) {
      recoverFolderFileMap[targetFolderId] = []
    }
    recoverFolderFileMap[targetFolderId].push({
      file,
      relativePath: meta.relativePath,
      fileName,
      folderId: targetFolderId
    })
  }

  let duplicateItems = []
  let fileItems = []
  try {
    const conflictResults = await fetchFolderUploadConflicts(recoverFolderFileMap)
    const classified = classifyFolderUploadByConflicts(recoverFolderFileMap, conflictResults)
    duplicateItems = classified.duplicates
    fileItems = classified.uniqueFiles.map(item => ({
      file: item.file,
      folderId: item.folderId,
      relativePath: item.relativePath,
      overwrite: false
    }))
  } catch (e) {
    console.error('恢复时检测文件重复失败:', e)
    ElMessage.error(e.message || '检测文件重复失败，请稍后重试')
    return
  }

  if (deleted.length > 0) {
    ElMessage.info(`${deleted.length} 个文件在本地已不存在，已跳过`)
  }

  currentFolder.value = record.folder_id
  folderUploadParentFolderId.value = record.folder_id
  folderUploadFolderIdMap.value = folderIdMap
  folderUploadRootFolderName.value = record.root_folder_name || ''
  currentDirectoryHandle.value = record.directory_handle || null

  await saveUploadRecord({ ...record, file_metadata_list: metadata }).catch(() => {})

  if (duplicateItems.length > 0) {
    folderDuplicateFiles.value = duplicateItems
    folderUploadPendingFiles.value = fileItems
    folderDuplicateDialogVisible.value = true
  } else if (fileItems.length === 0) {
    ElMessage.info('文件夹中的文件已全部上传完成或已跳过')
    await saveUploadRecord({ ...record, file_metadata_list: metadata, status: 'completed' }).catch(() => {})
    await deleteUploadRecord(record.id).catch(() => {})
    if (record.session_id) {
      await deleteServerFolderUploadSession(record.session_id)
    }
    uploadRecoveryPendingRecord.value = null
  } else {
    await startFolderFileUpload(fileItems)
    uploadRecoveryPendingRecord.value = null
  }
}

const handleRecoveryAbandon = async () => {
  uploadRecoveryVisible.value = false
  try {
    await deleteAllIncompleteRecords()
    await deleteAllFolderUploadSessionsAPI().catch(() => {})
    ElMessage.info('已放弃所有未完成的上传任务')
  } catch {
    console.warn('清理未完成上传记录失败')
  }
  uploadRecoveryRecords.value = []
}

const triggerRecoveryFolderPicker = () => {
  const input = uploadRecoveryFolderInputRef.value
  if (!input) return
  input.value = ''
  input.click()
}

const handleRecoveryFolderSelect = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return

  const record = uploadRecoveryPendingRecord.value
  if (!record) return

  uploadRecoveryFolderInputVisible.value = false

  const fileArray = Array.from(files)
  const localFiles = fileArray.map(file => {
    file.relativePath = file.webkitRelativePath || file.name
    return file
  })

  await recoverFolderWithLocalFiles(record, localFiles)
}

onMounted(async () => {
  // 默认个人空间；首屏列表在树（及聚焦范围 ID）就绪后再拉，避免与个人空间并行请求竞态覆盖

  // 先从数据字典加载空间类型，再并行拉文件夹树（文件列表在 bootstrapInitialFileList 中串行触发）
  await loadSpaceTypes()
  await Promise.all([loadFunctionList(), loadParseStatusDict()])
  // 加载当前用户个人空间的存储使用情况
  loadPersonalStorageInfo()

  // 先启动树加载，使聚焦模式下 bootstrap 能等到 focusedScopeNodeId，避免未选文件夹时误打 by-space
  void loadFolderTree(null, true, { preserveExpanded: true, publicFirst: true }).catch((e) => console.error('加载文件夹树失败:', e))
  await bootstrapInitialFileList()

  // 机构信息晚于首屏文件列表，减轻与 by-space/列表 的 DB 争抢
  void Promise.all([
    ensureUserOrgPathFromApi(),
    ensureUserLeafOrguuidFromSjry(),
    ensureOrgTreeForPathLookup()
  ]).catch((e) => console.error('加载机构信息失败:', e))
  // 监听子组件任务开始/停止事件
  eventBus.on(FILE_MANAGER_PROGRESS_START, handleTaskProgressStart)
  eventBus.on(FILE_MANAGER_PROGRESS_STOP, handleTaskProgressStop)

  void checkUploadRecovery()
})

/**
 * 处理子组件的任务开始通知（仅功能弹窗打开时生效）
 * @param {Object} payload 任务参数
 * @param {string} payload.taskUuid 任务 UUID
 * @param {string} [payload.taskName] 任务名称
 * @param {*} [payload.taskOther] 子组件上下文
 * @returns {void}
 */
const handleTaskProgressStart = ({ taskUuid, taskName, taskOther }) => {
  if (!showDocumentPreviewDialog.value) {
    return
  }
  if (taskUuid) {
    if (documentPreviewParams.value.tool === 'prepaidExpenses') {
      prepaidNeedsBackgroundWatch = true
    }
    persistDocumentPreviewTaskId(taskUuid)
    startTaskProgress(taskUuid, taskName || '任务', taskOther)
  }
}

const DEFAULT_EXCLUDE_EXTENSIONS = [
  '.rar', '.zip', '.7z', '.tar', '.gz', '.bz2', '.xz',
  '.exe', '.dll', '.sys', '.bat', '.cmd', '.sh',
  '.tmp', '.log', '.DS_Store'
]
const DEFAULT_EXCLUDE_FILENAMES = ['Thumbs.db', '.DS_Store']

const ARCHIVE_EXTENSIONS = ['.rar', '.zip', '.7z', '.tar', '.gz', '.bz2', '.xz']
const EXECUTABLE_EXTENSIONS = ['.exe', '.dll', '.sys', '.bat', '.cmd', '.sh']
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.md']

const supportsDirectoryUpload = computed(() => {
  return 'webkitdirectory' in document.createElement('input') || 'showDirectoryPicker' in window
})

const supportsWebkitDirectory = supportsDirectoryUpload

const folderInputRef = ref(null)
const folderExtFilterVisible = ref(false)
const folderExtFilterList = ref([])
const folderFilterSummaryCount = ref(0)
const folderFilterSummarySize = ref(0)
const folderDuplicateDialogVisible = ref(false)
const folderDuplicateFiles = ref([])
const folderUploadPendingFiles = ref([])
const folderUploadFolderIdMap = ref({})
const folderUploadOriginalItems = ref([])
const folderUploadRootFolderName = ref('')
const folderUploadRootExists = ref(false)
const folderUploadAllDirPaths = ref([])
const folderUploadParentFolderId = ref('')
const folderUploadProcessing = ref(false)
const folderUploadSessionId = ref('')
/** 文件夹批量上传进行中：抑制逐文件刷列表/树/Redis */
const folderUploadBatchActive = ref(false)
const folderUploadPendingSessionSync = new Map()

const sessionFileToMetadata = (fileItem) => ({
  name: fileItem.file_name,
  relativePath: fileItem.relative_path,
  size: fileItem.size || 0,
  type: '',
  lastModified: 0,
  folderId: fileItem.target_folder_id,
  file_hash: fileItem.file_hash || '',
  uploaded: fileItem.status === 'uploaded',
  skipped: fileItem.status === 'skipped',
  skipReason: fileItem.skip_reason || ''
})

const serverSessionToRecoveryRecord = (session, existingRecord = null) => ({
  id: generateRecordId('folder_upload', session.parent_folder_id),
  session_id: session.session_id,
  file_hash: 'folder_upload',
  file_name: '文件夹上传',
  file_size: (session.files || []).length,
  folder_id: session.parent_folder_id,
  upload_type: 'whole',
  upload_id: '',
  uploaded_chunks: [],
  total_chunks: 0,
  progress: 0,
  status: session.status || 'uploading',
  overwrite: false,
  folder_structure: session.folder_structure || {},
  ext_filter_result: null,
  file_metadata_list: (session.files || []).map(sessionFileToMetadata),
  directory_handle: existingRecord?.directory_handle || null,
  root_folder_name: session.root_folder_name || '',
  created_at: existingRecord?.created_at || (session.created_at ? session.created_at * 1000 : Date.now())
})

const metadataToSessionFile = (meta) => ({
  relative_path: meta.relativePath,
  file_name: meta.name,
  target_folder_id: meta.folderId,
  size: meta.size || 0,
  file_hash: meta.file_hash || '',
  status: meta.uploaded ? 'uploaded' : meta.skipped ? 'skipped' : 'pending',
  overwrite: false,
  skip_reason: meta.skipReason || ''
})

const createServerFolderUploadSession = async (parentFolderId, folderStructure, fileMetadataList, rootFolderName) => {
  if (!fileMetadataList?.length) return null
  try {
    const res = await createFolderUploadSessionAPI({
      parent_folder_id: parentFolderId,
      root_folder_name: rootFolderName || '',
      folder_structure: folderStructure || {},
      files: fileMetadataList.map(metadataToSessionFile)
    })
    if (res.code === 200 && res.data?.session_id) {
      folderUploadSessionId.value = res.data.session_id
      return res.data.session_id
    }
  } catch (e) {
    console.warn('创建文件夹上传 Redis 会话失败，将仅使用本地缓存:', e)
  }
  return null
}

const syncServerFolderUploadFileStatus = async (relativePath, updates) => {
  const sessionId = folderUploadSessionId.value
  if (!sessionId) return
  let status = 'pending'
  if (updates.uploaded) status = 'uploaded'
  else if (updates.skipped) status = 'skipped'
  try {
    await updateFolderUploadFileStatusAPI(sessionId, {
      relative_path: relativePath,
      status,
      skip_reason: updates.skipReason || undefined
    })
  } catch (e) {
    console.warn('同步文件夹上传状态到 Redis 失败:', e)
  }
}

const queueServerFolderUploadFileStatus = (relativePath, updates) => {
  folderUploadPendingSessionSync.set(relativePath, { ...updates, relativePath })
}

const flushServerFolderUploadSessionSync = async () => {
  const sessionId = folderUploadSessionId.value
  if (!sessionId || folderUploadPendingSessionSync.size === 0) return
  const files = Array.from(folderUploadPendingSessionSync.values()).map((item) => {
    let status = 'pending'
    if (item.uploaded) status = 'uploaded'
    else if (item.skipped) status = 'skipped'
    return {
      relative_path: item.relativePath,
      status,
      skip_reason: item.skipReason || undefined
    }
  })
  folderUploadPendingSessionSync.clear()
  try {
    await batchUpdateFolderUploadFileStatusAPI(sessionId, { files })
  } catch (e) {
    console.warn('批量同步文件夹上传状态到 Redis 失败:', e)
  }
}

const deleteServerFolderUploadSession = async (sessionId) => {
  const id = sessionId || folderUploadSessionId.value
  if (!id) return
  try {
    await deleteFolderUploadSessionAPI(id)
  } catch (e) {
    console.warn('删除文件夹上传 Redis 会话失败:', e)
  }
  if (folderUploadSessionId.value === id) {
    folderUploadSessionId.value = ''
  }
}

const getFolderUploadCacheId = () => {
  const parentId = folderUploadParentFolderId.value || currentFolder.value
  return parentId ? generateRecordId('folder_upload', parentId) : ''
}

const isPersistableDirectoryHandle = (handle) => (
  handle && typeof handle.queryPermission === 'function' && typeof handle.values === 'function'
)

/** 选择文件夹后立即持久化 directory_handle，刷新后可无感恢复 */
const persistFolderUploadDirectoryHandle = async (dirHandle, rootFolderName = '') => {
  if (!isPersistableDirectoryHandle(dirHandle) || isPrivateMode.value || !currentFolder.value) return
  const parentFolderId = currentFolder.value
  const cacheId = generateRecordId('folder_upload', parentFolderId)
  try {
    const existing = await getUploadRecord(cacheId).catch(() => null)
    await saveUploadRecord({
      id: cacheId,
      file_hash: 'folder_upload',
      file_name: '文件夹上传',
      file_size: existing?.file_size || 0,
      folder_id: parentFolderId,
      upload_type: 'whole',
      upload_id: '',
      uploaded_chunks: [],
      total_chunks: 0,
      progress: existing?.progress || 0,
      status: existing?.status || 'uploading',
      overwrite: false,
      folder_structure: existing?.folder_structure || {},
      ext_filter_result: null,
      file_metadata_list: existing?.file_metadata_list || [],
      directory_handle: dirHandle,
      root_folder_name: rootFolderName || dirHandle.name || existing?.root_folder_name || '',
      created_at: existing?.created_at || Date.now()
    })
  } catch {
    console.warn('持久化文件夹 directory_handle 失败')
  }
}

const readAllFilesFromHandle = async (dirHandle, path = '') => {
  const files = []
  const dirPaths = new Set()
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile()
      file.relativePath = path ? `${path}/${file.name}` : file.name
      files.push(file)
    } else if (entry.kind === 'directory') {
      const subPath = path ? `${path}/${entry.name}` : entry.name
      dirPaths.add(subPath)
      const { files: subFiles, dirPaths: subDirPaths } = await readAllFilesFromHandle(entry, subPath)
      files.push(...subFiles)
      subDirPaths.forEach(d => dirPaths.add(d))
    }
  }
  return { files, dirPaths }
}

const buildRecoveryTree = (fileMetadataList, recordId = '', parentFolderId = '') => {
  const root = { label: '根目录', children: [], status: 'folder', key: 'recovery-root' }
  const nodeMap = { '': root }

  const sorted = [...fileMetadataList].sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  sorted.forEach((meta, idx) => {
    const parts = meta.relativePath.split('/')
    let currentPath = ''
    let parentNode = root

    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i]
      currentPath = currentPath ? `${currentPath}/${dirName}` : dirName
      if (!nodeMap[currentPath]) {
        const dirNode = { label: dirName, children: [], status: 'folder', key: `dir-${currentPath}` }
        nodeMap[currentPath] = dirNode
        parentNode.children.push(dirNode)
      }
      parentNode = nodeMap[currentPath]
    }

    const status = meta.uploaded ? 'uploaded' : meta.skipped ? 'skipped' : 'pending'
    parentNode.children.push({
      label: meta.name,
      title: meta.relativePath,
      status,
      skipReason: meta.skipReason || '',
      failReason: meta.failReason || '',
      failAt: meta.failAt || 0,
      relativePath: meta.relativePath,
      recordId,
      folderId: meta.folderId || parentFolderId,
      isFile: true,
      key: `file-${idx}-${meta.relativePath}`
    })
  })

  return root.children.length === 1 && root.children[0].status === 'folder'
    ? root.children
    : root.children
}

const getPendingFolderKeys = (fileMetadataList) => {
  const keys = new Set()
  fileMetadataList.forEach((meta) => {
    if (!meta.uploaded && !meta.skipped) {
      const parts = meta.relativePath.split('/')
      let currentPath = ''
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
        keys.add(`dir-${currentPath}`)
      }
    }
  })
  return Array.from(keys)
}

const matchFilesWithCache = (localFiles, cachedMetadata) => {
  const getLocalPath = (f) => f.relativePath || f.webkitRelativePath || f.name
  const getFileName = (path) => {
    const parts = path.split('/')
    return parts[parts.length - 1]
  }

  const matched = []
  const unmatchedMeta = [...cachedMetadata]
  const availableLocal = [...localFiles]

  const tryMatch = (meta, localFile) => {
    matched.push({ meta, file: localFile })
    const metaIdx = unmatchedMeta.indexOf(meta)
    if (metaIdx > -1) unmatchedMeta.splice(metaIdx, 1)
    const localIdx = availableLocal.indexOf(localFile)
    if (localIdx > -1) availableLocal.splice(localIdx, 1)
  }

  // 1. relativePath 完全相等
  for (let i = unmatchedMeta.length - 1; i >= 0; i--) {
    const meta = unmatchedMeta[i]
    const localFile = availableLocal.find(f => getLocalPath(f) === meta.relativePath)
    if (localFile) tryMatch(meta, localFile)
  }

  // 2. 文件名完全相等（双方均唯一）
  for (let i = unmatchedMeta.length - 1; i >= 0; i--) {
    const meta = unmatchedMeta[i]
    const fileName = meta.name || getFileName(meta.relativePath)
    const nameMatches = availableLocal.filter(f => getFileName(getLocalPath(f)) === fileName)
    if (nameMatches.length === 1) {
      const metaSameName = unmatchedMeta.filter(m => (m.name || getFileName(m.relativePath)) === fileName)
      if (metaSameName.length === 1) tryMatch(meta, nameMatches[0])
    }
  }

  // 3. 文件名 + 文件大小相等
  for (let i = unmatchedMeta.length - 1; i >= 0; i--) {
    const meta = unmatchedMeta[i]
    const fileName = meta.name || getFileName(meta.relativePath)
    const localFile = availableLocal.find(f => {
      return getFileName(getLocalPath(f)) === fileName && f.size === meta.size
    })
    if (localFile) tryMatch(meta, localFile)
  }

  const deleted = [...unmatchedMeta]
  const matchedLocalPaths = new Set(matched.map(m => getLocalPath(m.file)))
  const newIgnored = localFiles.filter(f => !matchedLocalPaths.has(getLocalPath(f)))

  return { matched, deleted, newIgnored }
}

const handleFolderUploadClick = async () => {
  if (!currentFolder.value) {
    ElMessage.warning('请先选择文件夹')
    return
  }

  if (window.showDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' })
      currentDirectoryHandle.value = dirHandle
      await persistFolderUploadDirectoryHandle(dirHandle, dirHandle.name)
      const { files: rawFiles, dirPaths } = await readAllFilesFromHandle(dirHandle)
      if (rawFiles.length === 0 && dirPaths.size === 0) {
        ElMessage.warning('文件夹为空')
        currentDirectoryHandle.value = null
        return
      }
      const files = rawFiles.map(file => {
        file.relativePath = `${dirHandle.name}/${file.relativePath}`
        return file
      })
      const allDirPaths = new Set()
      dirPaths.forEach(p => allDirPaths.add(`${dirHandle.name}/${p}`))
      await processFolderFiles(files, dirHandle.name, allDirPaths)
      return
    } catch (e) {
      currentDirectoryHandle.value = null
      if (e.name === 'AbortError') return
    }
  }

  if (folderInputRef.value) {
    folderInputRef.value.value = ''
    folderInputRef.value.click()
  }
}

/** 获取指定文件夹下直接子文件夹名称（小写），优先用已加载的树，必要时回退 API */
const getDirectChildFolderNames = async (parentFolderId) => {
  const parent = findFolderInTree(parentFolderId)
  // 树中已找到父节点：即使 children 为空也表示无子文件夹，无需再请求 API
  if (parent) {
    return (parent.children || [])
      .filter(child => !child.isSpaceRoot && child.node_type !== 'FILE')
      .map(child => (child.name || child.folder_name || '').toLowerCase())
      .filter(Boolean)
  }
  // 仅当左侧树未包含该节点时（如聚焦视图未加载完整路径）才回退 API
  try {
    const res = await getFolderChildrenAPI(parentFolderId)
    if (res.code === 200 && res.data) {
      return (res.data || [])
        .map(child => (child.folder_name || child.name || '').toLowerCase())
        .filter(Boolean)
    }
  } catch (e) {
    console.warn('获取子文件夹列表失败:', e)
  }
  return []
}

const processFolderFiles = async (fileArray, rootFolderName, allDirPaths = new Set()) => {
  // 前置检测：根文件夹是否在当前目录下已存在
  let rootExists = false
  if (currentFolder.value && rootFolderName) {
    const childNames = await getDirectChildFolderNames(currentFolder.value)
    rootExists = childNames.includes(rootFolderName.toLowerCase())
  }

  if (rootExists) {
    try {
      await ElMessageBox.confirm(
        `当前目录下已存在文件夹「${rootFolderName}」，继续上传将合并到该文件夹中。是否继续？`,
        '文件夹已存在',
        { type: 'warning', confirmButtonText: '继续上传', cancelButtonText: '取消' }
      )
    } catch {
      if (folderInputRef.value) folderInputRef.value.value = ''
      currentDirectoryHandle.value = null
      return
    }
  }
  folderUploadRootExists.value = rootExists

  const extMap = {}
  const mergedDirPaths = new Set(allDirPaths)

  fileArray.forEach(file => {
    const relativePath = file.relativePath || file.webkitRelativePath || file.name
    const parts = relativePath.split('/')
    for (let i = 1; i < parts.length; i++) {
      mergedDirPaths.add(parts.slice(0, i).join('/'))
    }

    const fileName = file.name
    const dotIndex = fileName.lastIndexOf('.')
    let ext = ''
    if (dotIndex > 0) {
      ext = fileName.substring(dotIndex).toLowerCase()
    }

    const extKey = ext || '__NO_EXT__'
    if (!extMap[extKey]) {
      extMap[extKey] = {
        ext: extKey === '__NO_EXT__' ? '（无后缀）' : ext,
        extRaw: extKey,
        count: 0,
        totalSize: 0,
        included: !DEFAULT_EXCLUDE_EXTENSIONS.includes(ext) && !DEFAULT_EXCLUDE_FILENAMES.includes(fileName),
        sampleFiles: []
      }
    }
    extMap[extKey].count++
    extMap[extKey].totalSize += file.size
    if (extMap[extKey].sampleFiles.length < 3) {
      extMap[extKey].sampleFiles.push(relativePath)
    }
  })

  const list = Object.values(extMap).sort((a, b) => b.count - a.count)
  list.forEach(item => {
    item.sampleFiles = item.sampleFiles.join('、')
  })

  folderExtFilterList.value = list
  folderUploadPendingFiles.value = fileArray
  folderUploadRootFolderName.value = rootFolderName || ''
  folderUploadAllDirPaths.value = Array.from(mergedDirPaths)
  updateFolderFilterSummary()
  folderExtFilterVisible.value = true
}

const handleFolderInputChange = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return

  currentDirectoryHandle.value = null
  const fileArray = Array.from(files)
  const allDirPaths = new Set()
  fileArray.forEach(file => {
    const relativePath = file.relativePath || file.webkitRelativePath || file.name
    const parts = relativePath.split('/')
    for (let i = 1; i < parts.length; i++) {
      allDirPaths.add(parts.slice(0, i).join('/'))
    }
  })
  const rootName = fileArray.length > 0
    ? (fileArray[0].webkitRelativePath || fileArray[0].name).split('/')[0]
    : ''
  await processFolderFiles(fileArray, rootName, allDirPaths)
}

const updateFolderFilterSummary = () => {
  const includedExts = new Set(
    folderExtFilterList.value.filter(item => item.included).map(item => item.extRaw)
  )
  let count = 0
  let size = 0
  folderUploadPendingFiles.value.forEach(file => {
    const fileName = file.name
    const dotIndex = fileName.lastIndexOf('.')
    const ext = dotIndex > 0 ? fileName.substring(dotIndex).toLowerCase() : '__NO_EXT__'
    if (includedExts.has(ext)) {
      count++
      size += file.size
    }
  })
  folderFilterSummaryCount.value = count
  folderFilterSummarySize.value = size
}

const folderFilterExcludeArchives = () => {
  folderExtFilterList.value.forEach(item => {
    if (ARCHIVE_EXTENSIONS.includes(item.extRaw)) {
      item.included = false
    }
  })
  updateFolderFilterSummary()
}

const folderFilterExcludeExecutables = () => {
  folderExtFilterList.value.forEach(item => {
    if (EXECUTABLE_EXTENSIONS.includes(item.extRaw)) {
      item.included = false
    }
  })
  updateFolderFilterSummary()
}

const folderFilterDocsOnly = () => {
  folderExtFilterList.value.forEach(item => {
    item.included = DOCUMENT_EXTENSIONS.includes(item.extRaw)
  })
  updateFolderFilterSummary()
}

const folderFilterSelectAll = () => {
  folderExtFilterList.value.forEach(item => {
    item.included = true
  })
  updateFolderFilterSummary()
}

const folderFilterSelectNone = () => {
  folderExtFilterList.value.forEach(item => {
    item.included = false
  })
  updateFolderFilterSummary()
}

const cancelFolderExtFilter = () => {
  folderExtFilterVisible.value = false
  folderExtFilterList.value = []
  folderUploadPendingFiles.value = []
  folderFilterSummaryCount.value = 0
  folderFilterSummarySize.value = 0
  folderUploadRootExists.value = false
  folderUploadParentFolderId.value = ''
}

const confirmFolderExtFilter = async () => {
  if (folderUploadProcessing.value) return
  folderUploadProcessing.value = true

  try {
  const includedExts = new Set(
    folderExtFilterList.value.filter(item => item.included).map(item => item.extRaw)
  )
  const filteredFiles = folderUploadPendingFiles.value.filter(file => {
    const fileName = file.name
    const dotIndex = fileName.lastIndexOf('.')
    const ext = dotIndex > 0 ? fileName.substring(dotIndex).toLowerCase() : '__NO_EXT__'
    return includedExts.has(ext)
  })

  if (filteredFiles.length === 0) {
    const dirPaths = new Set(folderUploadAllDirPaths.value)
    const folderPaths = Array.from(dirPaths)
    if (folderPaths.length > 0) {
      try {
        const res = await batchCreateFoldersAPI({
          parent_folder_id: currentFolder.value,
          folder_paths: folderPaths
        })
        if (res.code === 200 && res.data) {
          ElMessage.success('目录结构已创建，没有文件需要上传')
        } else {
          ElMessage.error(res.msg || '创建文件夹结构失败')
        }
      } catch (error) {
        console.error('批量创建文件夹失败:', error)
        ElMessage.error(error.response?.data?.msg || '创建文件夹结构失败')
      }
    } else {
      ElMessage.warning('筛选后没有文件可上传')
    }
    folderExtFilterVisible.value = false
    return
  }

  folderExtFilterVisible.value = false
  folderUploadParentFolderId.value = currentFolder.value

  const dirPaths = new Set(folderUploadAllDirPaths.value)
  filteredFiles.forEach(file => {
    const relativePath = file.relativePath || file.webkitRelativePath || file.name
    const parts = relativePath.split('/')
    for (let i = 1; i < parts.length; i++) {
      dirPaths.add(parts.slice(0, i).join('/'))
    }
  })

  const folderPaths = Array.from(dirPaths)
  let folderIdMap = {}

  if (folderPaths.length > 0) {
    try {
      const res = await batchCreateFoldersAPI({
        parent_folder_id: currentFolder.value,
        folder_paths: folderPaths
      })

      if (res.code === 200 && res.data) {
        // 使用 all_folder_paths，它包含了所有文件夹的映射（包括已存在的）
        if (res.data.all_folder_paths) {
          Object.entries(res.data.all_folder_paths).forEach(([path, folderId]) => {
            folderIdMap[path] = folderId
          })
        } else if (res.data.created_folders) {
          // 兼容旧版本，只使用 created_folders
          res.data.created_folders.forEach(f => {
            folderIdMap[f.path] = f.folder_id
          })
        }
      } else {
        ElMessage.error(res.msg || '创建文件夹结构失败')
        return
      }
    } catch (error) {
      console.error('批量创建文件夹失败:', error)
      ElMessage.error(error.response?.data?.msg || '创建文件夹结构失败')
      return
    }
  }

  folderUploadFolderIdMap.value = folderIdMap
  await checkFolderDuplicateFiles(filteredFiles, folderIdMap)
  } finally {
    folderUploadProcessing.value = false
  }
}

const buildFolderFileMap = (files, folderIdMap) => {
  const folderFileMap = {}
  files.forEach(file => {
    const relativePath = file.relativePath || file.webkitRelativePath || file.name
    const parts = relativePath.split('/')
    const fileName = parts[parts.length - 1]
    let targetFolderId = currentFolder.value
    if (parts.length >= 2) {
      const dirPath = parts.slice(0, parts.length - 1).join('/')
      targetFolderId = folderIdMap[dirPath] || currentFolder.value
    }
    if (!folderFileMap[targetFolderId]) {
      folderFileMap[targetFolderId] = []
    }
    folderFileMap[targetFolderId].push({
      file,
      relativePath,
      fileName,
      folderId: targetFolderId
    })
  })
  return folderFileMap
}

const classifyFolderUploadByConflicts = (folderFileMap, conflictResults) => {
  const conflictMap = {}
  ;(conflictResults || []).forEach(r => {
    const set = new Set()
    ;(r.existing_file_names || []).forEach(n => set.add(normalizeNameForDuplicateCheck(n)))
    ;(r.existing_folder_names || []).forEach(n => set.add(String(n).toLowerCase()))
    conflictMap[r.folder_id] = set
  })

  const duplicates = []
  const uniqueFiles = []
  Object.values(folderFileMap).forEach(items => {
    items.forEach(item => {
      const existingNames = conflictMap[item.folderId] || new Set()
      const base = normalizeNameForDuplicateCheck(item.fileName)
      const baseFromPath = normalizeNameForDuplicateCheck(item.relativePath)
      if (existingNames.has(base) || existingNames.has(baseFromPath)) {
        duplicates.push({
          relativePath: item.relativePath,
          file: item.file,
          folderId: item.folderId,
          action: 'upload'
        })
      } else {
        uniqueFiles.push(item)
      }
    })
  })
  return { duplicates, uniqueFiles }
}

const fetchFolderUploadConflicts = async (folderFileMap) => {
  const folderItems = Object.entries(folderFileMap).map(([folderId, items]) => ({
    folder_id: folderId,
    file_names: [...new Set(items.map(i => i.fileName))]
  }))
  const res = await batchCheckUploadConflictsAPI({ folder_items: folderItems })
  if (res.code !== 200 || !res.data) {
    throw new Error(res.msg || '检测文件重复失败')
  }
  return res.data.results || []
}

const checkFolderDuplicateFiles = async (files, folderIdMap) => {
  let loadingInstance = null
  try {
    loadingInstance = ElLoading.service({
      lock: true,
      text: '正在检测文件是否重复...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    const folderFileMap = buildFolderFileMap(files, folderIdMap)
    const conflictResults = await fetchFolderUploadConflicts(folderFileMap)
    const { duplicates, uniqueFiles } = classifyFolderUploadByConflicts(folderFileMap, conflictResults)

    if (loadingInstance) {
      loadingInstance.close()
      loadingInstance = null
    }

    if (duplicates.length > 0) {
      folderDuplicateFiles.value = duplicates
      folderUploadPendingFiles.value = uniqueFiles
      folderDuplicateDialogVisible.value = true
    } else {
      folderUploadPendingFiles.value = uniqueFiles
      const fileItems = uniqueFiles.map(item => ({
        file: item.file,
        folderId: item.folderId,
        relativePath: item.relativePath,
        overwrite: false
      }))
      await startFolderFileUpload(fileItems)
    }
  } catch (e) {
    console.error('检测文件重复异常:', e)
    ElMessage.error(e.message || '检测文件重复失败，请稍后重试')
  } finally {
    if (loadingInstance) {
      loadingInstance.close()
    }
  }
}

const folderDuplicateAllOverwrite = () => {
  folderDuplicateFiles.value.forEach(item => {
    item.action = 'upload'
  })
}

const folderDuplicateAllSkip = () => {
  folderDuplicateFiles.value.forEach(item => {
    item.action = 'skip'
  })
}

const cancelFolderDuplicateDialog = () => {
  folderDuplicateDialogVisible.value = false
  folderDuplicateFiles.value = []
  folderUploadPendingFiles.value = []
  folderUploadFolderIdMap.value = {}
  folderUploadRootExists.value = false
  folderUploadParentFolderId.value = ''
}

const confirmFolderDuplicateDialog = async () => {
  if (folderUploadProcessing.value) return
  folderUploadProcessing.value = true

  try {
  const filesToUpload = []
  const filesToSkip = []

  folderDuplicateFiles.value.forEach(item => {
    if (item.action === 'upload') {
      filesToUpload.push({
        file: item.file,
        folderId: item.folderId,
        relativePath: item.relativePath,
        overwrite: true
      })
    } else {
      filesToSkip.push(item)
    }
  })

  if (filesToSkip.length > 0) {
    ElMessage.info(`已跳过 ${filesToSkip.length} 个重名文件`)
  }

  const allFiles = [...filesToUpload, ...folderUploadPendingFiles.value.map(item => ({
    file: item.file,
    folderId: item.folderId,
    relativePath: item.relativePath,
    overwrite: false
  }))]

  folderDuplicateDialogVisible.value = false
  folderDuplicateFiles.value = []
  folderUploadPendingFiles.value = []

  await startFolderFileUpload(allFiles)

  folderUploadFolderIdMap.value = {}
  folderUploadRootExists.value = false
  folderUploadParentFolderId.value = ''
  } finally {
    folderUploadProcessing.value = false
  }
}

/** 从 batch-create 映射中解析上传根目录 folder_id */
const resolveFolderUploadRootFolderId = () => {
  const map = folderUploadFolderIdMap.value || {}
  const rootName = folderUploadRootFolderName.value
  if (rootName && map[rootName]) {
    return map[rootName]
  }
  const topLevelPath = Object.keys(map).find(p => p && !p.includes('/'))
  return topLevelPath ? map[topLevelPath] : ''
}

/** 文件夹上传：刷新左侧树，可选定位到上传根目录 */
const refreshFolderTreeForUpload = async ({ parentFolderId, rootFolderId, navigateToRoot = false }) => {
  const expandId = parentFolderId || folderUploadParentFolderId.value || currentFolder.value
  if (!expandId) return
  try {
    await loadFolderTree(null, false, {
      preserveExpanded: true,
      expandParentFolderId: expandId,
      onlyCurrentSpaceType: currentSpaceType.value || null
    })
    if (navigateToRoot && rootFolderId) {
      await nextTick()
      if (folderTreeRef.value?.setCurrentKey) {
        folderTreeRef.value.setCurrentKey(rootFolderId)
      }
      const rootNode = findFolderNodeById(folderTreeData.value, rootFolderId)
      if (rootNode) {
        await handleFolderClick(rootNode)
      }
    }
  } catch (e) {
    console.warn('刷新文件夹树失败:', e)
  }
}

/** 文件夹上传全部完成后：刷新树与文件列表 */
const finalizeFolderUploadTreeRefresh = async ({ parentFolderId, rootFolderId }) => {
  const expandId = parentFolderId || folderUploadParentFolderId.value || currentFolder.value
  try {
    if (expandId) {
      await loadFolderTree(null, false, {
        preserveExpanded: true,
        expandParentFolderId: expandId,
        onlyCurrentSpaceType: currentSpaceType.value || null
      })
    }
    invalidateMergedSpacesCache()
    if (rootFolderId) {
      await nextTick()
      if (currentFolder.value === rootFolderId) {
        await loadFileList()
      } else {
        const rootNode = findFolderNodeById(folderTreeData.value, rootFolderId)
        if (rootNode) {
          await handleFolderClick(rootNode)
        } else if (currentFolder.value) {
          await loadFileList()
        }
      }
    } else if (currentFolder.value) {
      await loadFileList()
    }
    if (currentSpaceType.value === 'PERSONAL') {
      loadPersonalStorageInfo()
    }
  } catch (e) {
    console.warn('上传完成后刷新文件夹树失败:', e)
  }
}

const startFolderFileUpload = async (fileItems) => {
  folderUploadBatchActive.value = true
  folderUploadPendingSessionSync.clear()
  try {
    folderUploadOriginalItems.value = fileItems.map(item => ({ ...item }))
    if (!folderUploadParentFolderId.value && currentFolder.value) {
      folderUploadParentFolderId.value = currentFolder.value
    }

    const uploadParentFolderId = folderUploadParentFolderId.value || currentFolder.value
    const uploadRootFolderId = resolveFolderUploadRootFolderId()
    const hasFolderStructure = Object.keys(folderUploadFolderIdMap.value || {}).length > 0

    if (hasFolderStructure || uploadRootFolderId) {
      await refreshFolderTreeForUpload({
        parentFolderId: uploadParentFolderId,
        rootFolderId: uploadRootFolderId,
        navigateToRoot: !!uploadRootFolderId
      })
    }

    if (!isPrivateMode.value && fileItems.length > 0) {
    const parentFolderId = folderUploadParentFolderId.value || currentFolder.value
    const folderStructure = { ...folderUploadFolderIdMap.value }
    if (Object.keys(folderStructure).length > 0) {
      const cacheId = getFolderUploadCacheId()
      const fileMetadataList = await Promise.all(fileItems.map(async item => {
        const relativePath = item.relativePath || item.file?.name || ''
        const parts = relativePath.split('/')
        const fileName = parts[parts.length - 1]
        let targetFolderId = parentFolderId
        if (parts.length >= 2) {
          const dirPath = parts.slice(0, parts.length - 1).join('/')
          targetFolderId = folderStructure[dirPath] || parentFolderId
        }
        let fileHash = ''
        if (item.file && !isPrivateMode.value) {
          try {
            fileHash = await computeFileHash(item.file)
          } catch {
            console.warn('计算文件 hash 失败:', relativePath)
          }
        }
        return {
          name: fileName,
          relativePath,
          size: item.file?.size || 0,
          type: item.file?.type || '',
          lastModified: item.file?.lastModified || 0,
          folderId: targetFolderId,
          file_hash: fileHash,
          uploaded: false,
          skipped: false,
          skipReason: ''
        }
      }))
      const existingRecord = await getUploadRecord(cacheId).catch(() => null)
      const dirHandle = isPersistableDirectoryHandle(currentDirectoryHandle.value)
        ? currentDirectoryHandle.value
        : (isPersistableDirectoryHandle(existingRecord?.directory_handle) ? existingRecord.directory_handle : null)
      const recordToSave = {
        id: cacheId,
        file_hash: 'folder_upload',
        file_name: '文件夹上传',
        file_size: fileItems.length,
        folder_id: parentFolderId,
        upload_type: 'whole',
        upload_id: '',
        uploaded_chunks: [],
        total_chunks: 0,
        progress: 0,
        status: 'uploading',
        overwrite: false,
        folder_structure: folderStructure,
        ext_filter_result: null,
        file_metadata_list: existingRecord?.file_metadata_list || fileMetadataList,
        directory_handle: dirHandle,
        root_folder_name: existingRecord?.root_folder_name || folderUploadRootFolderName.value || '',
        session_id: existingRecord?.session_id || folderUploadSessionId.value || '',
        created_at: existingRecord?.created_at || Date.now()
      }
      if (!recordToSave.session_id) {
        const sessionId = await createServerFolderUploadSession(
          parentFolderId,
          folderStructure,
          recordToSave.file_metadata_list,
          recordToSave.root_folder_name
        )
        if (sessionId) {
          recordToSave.session_id = sessionId
        }
      } else {
        folderUploadSessionId.value = recordToSave.session_id
      }
      await saveUploadRecord(recordToSave)
    }
  }

  const folderGroups = {}
  fileItems.forEach(item => {
    const relativePath = item.relativePath || item.file?.name || ''
    const parts = relativePath.split('/')
    const folderKey = parts.length > 1 ? parts.slice(0, parts.length - 1).join('/') : '__ROOT__'
    if (!folderGroups[folderKey]) {
      folderGroups[folderKey] = []
    }
    folderGroups[folderKey].push(item)
  })

  const processedItems = []
  const folderSkipChecks = Object.values(folderGroups).map(async (items) => {
    if (items.length === 0) {
      processedItems.push(...items)
      return
    }
    const firstFile = items[0].file
    const accessible = await verifyFileAccessible(firstFile)
    if (!accessible) {
      items.forEach(item => {
        item.skipReason = '文件夹路径已变更'
      })
    }
    processedItems.push(...items)
  })

  await Promise.all(folderSkipChecks)

  const MAX_CONCURRENT = 3
  let currentIndex = 0
  let runningCount = 0
  let completedCount = 0
  const totalCount = processedItems.length

  await new Promise((resolve) => {
    const uploadNext = () => {
      while (runningCount < MAX_CONCURRENT && currentIndex < processedItems.length) {
        const item = processedItems[currentIndex++]
        runningCount++
        uploadSingleFolderFile(item).finally(() => {
          runningCount--
          completedCount++
          if (completedCount >= totalCount) {
            resolve()
            return
          }
          uploadNext()
        })
      }
    }

    uploadNext()
  })

    await flushServerFolderUploadSessionSync()
    await finalizeFolderUploadCache().catch(() => console.warn('清理文件夹上传缓存失败'))
    await finalizeFolderUploadTreeRefresh({
      parentFolderId: uploadParentFolderId,
      rootFolderId: uploadRootFolderId
    }).catch(() => console.warn('上传完成后刷新文件夹树失败'))
    const skipped = uploadTasks.value.filter(t => t.status === 'skipped' && t.relativePath)
    if (skipped.length > 0) {
      skippedFiles.value = skipped.map(t => ({
        id: t.id,
        relativePath: t.relativePath || t.fileName,
        skipReason: t.skipReason || '文件路径已变更，已跳过'
      }))
      uploadSummaryVisible.value = true
    }
  } finally {
    folderUploadBatchActive.value = false
    folderUploadPendingSessionSync.clear()
  }
}

const retrySkippedFiles = async () => {
  const retryItems = []
  skippedFiles.value.forEach(sf => {
    const task = uploadTasks.value.find(t => t.id === sf.id)
    if (task) {
      const index = uploadTasks.value.findIndex(t => t.id === sf.id)
      if (index > -1) {
        uploadTasks.value.splice(index, 1)
      }
    }
    const originalItem = folderUploadOriginalItems.value.find(
      item => (item.relativePath || item.file?.name) === sf.relativePath
    )
    if (originalItem) {
      retryItems.push({
        ...originalItem,
        skipReason: null
      })
    }
  })
  uploadSummaryVisible.value = false
  skippedFiles.value = []
  if (retryItems.length > 0) {
    await startFolderFileUpload(retryItems)
  }
}

const updateFolderCacheMetadata = async (relativePath, updates) => {
  try {
    const cacheId = getFolderUploadCacheId()
    if (!cacheId) return
    const record = await getUploadRecord(cacheId)
    if (record && record.file_metadata_list) {
      const meta = record.file_metadata_list.find(m => m.relativePath === relativePath)
      if (meta) {
        Object.assign(meta, updates)
        if (!record.directory_handle && isPersistableDirectoryHandle(currentDirectoryHandle.value)) {
          record.directory_handle = currentDirectoryHandle.value
        }
        const allDone = record.file_metadata_list.every(m => m.uploaded || m.skipped)
        if (allDone) {
          record.status = 'completed'
        }
        await saveUploadRecord(record)
        if (folderUploadBatchActive.value) {
          queueServerFolderUploadFileStatus(relativePath, updates)
        } else {
          await syncServerFolderUploadFileStatus(relativePath, updates)
          if (allDone) {
            await deleteUploadRecord(cacheId).catch(() => console.warn('删除已完成文件夹上传缓存失败'))
            if (record.session_id) {
              await deleteServerFolderUploadSession(record.session_id)
            }
          }
        }
      }
    }
  } catch {
    console.warn('更新文件夹上传缓存元数据失败')
  }
}

const finalizeFolderUploadCache = async () => {
  const cacheId = getFolderUploadCacheId()
  if (!cacheId) return
  try {
    const record = await getUploadRecord(cacheId)
    if (record?.file_metadata_list?.every(m => m.uploaded || m.skipped)) {
      await deleteUploadRecord(cacheId)
      if (record.session_id) {
        await deleteServerFolderUploadSession(record.session_id)
      }
    }
  } catch {
    console.warn('清理文件夹上传缓存失败')
  }
}

const uploadSingleFolderFile = async (item) => {
  const { file, folderId, relativePath, overwrite = false, skipReason: presetSkipReason } = item
  const targetFolderId = folderId || currentFolder.value

  const taskId = Date.now() + Math.random()
  const task = {
    id: taskId,
    fileName: (relativePath || file.name).split('/').pop(),
    folderId: targetFolderId,
    progress: 0,
    status: 'uploading',
    phase: 'upload',
    postUploadLabel: getUploadPostProgressLabel(file.name),
    error: null,
    skipReason: null,
    relativePath: relativePath || ''
  }
  uploadTasks.value.push(task)
  uploading.value = true

  if (presetSkipReason) {
    task.status = 'skipped'
    task.phase = 'done'
    task.skipReason = presetSkipReason
    await updateFolderCacheMetadata(relativePath || file.name, { skipped: true, skipReason: presetSkipReason })
    const hasUploading = uploadTasks.value.some(t => t.status === 'uploading')
    uploading.value = hasUploading
    return true
  }

  const accessible = await verifyFileAccessible(file)
  if (!accessible) {
    task.status = 'skipped'
    task.phase = 'done'
    task.skipReason = '文件路径已变更或已被删除'
    await updateFolderCacheMetadata(relativePath || file.name, { skipped: true, skipReason: '文件路径已变更或已被删除' })
    const hasUploading = uploadTasks.value.some(t => t.status === 'uploading')
    uploading.value = hasUploading
    return false
  }

  try {
    const formData = new FormData()
    formData.append('folder_id', targetFolderId)
    const pureFileName = getUploadBaseName(file, relativePath)
    const uploadFile = new File([file], pureFileName, { type: file.type, lastModified: file.lastModified })
    formData.append('file', uploadFile)

    const res = await uploadFileAPI(
      formData,
      (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          const currentTask = uploadTasks.value.find(t => t.id === taskId)
          if (currentTask) {
            currentTask.progress = progress
            if (progress === 100 && currentTask.phase === 'upload' && currentTask.status === 'uploading') {
              currentTask.phase = 'processing'
            }
          }
        }
      },
      { overwrite }
    )

    if (res.code === 200 || res.code === 201) {
      const currentTask = uploadTasks.value.find(t => t.id === taskId)
      if (currentTask) {
        currentTask.progress = 100
        currentTask.status = 'success'
        currentTask.phase = 'done'
      }

      ElMessage.success(`文件 "${(relativePath || file.name).split('/').pop()}"${overwrite ? ' 已覆盖上传' : ' 上传成功'}`)
      await updateFolderCacheMetadata(relativePath || file.name, { uploaded: true })

      if (!folderUploadBatchActive.value) {
        if (currentFolder.value === targetFolderId || (!currentFolder.value && currentSpaceType.value)) {
          invalidateMergedSpacesCache()
          loadFileList()
        }

        if (currentSpaceType.value === 'PERSONAL') {
          loadPersonalStorageInfo()
        }
      }

      setTimeout(() => {
        removeUploadTask(taskId)
      }, 3000)
      return true
    } else if (!overwrite && (res.msg && res.msg.includes('同名'))) {
      const retryFormData = new FormData()
      retryFormData.append('folder_id', targetFolderId)
      retryFormData.append('overwrite', 'true')
      const retryPureFileName = getUploadBaseName(file, relativePath)
      const retryUploadFile = new File([file], retryPureFileName, { type: file.type, lastModified: file.lastModified })
      retryFormData.append('file', retryUploadFile)

      const retryRes = await uploadFileAPI(
        retryFormData,
        (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            const currentTask = uploadTasks.value.find(t => t.id === taskId)
            if (currentTask) {
              currentTask.progress = progress
              if (progress === 100 && currentTask.phase === 'upload' && currentTask.status === 'uploading') {
                currentTask.phase = 'processing'
              }
            }
          }
        }
      )

      if (retryRes.code === 200 || retryRes.code === 201) {
        const currentTask = uploadTasks.value.find(t => t.id === taskId)
        if (currentTask) {
          currentTask.progress = 100
          currentTask.status = 'success'
          currentTask.phase = 'done'
        }
        ElMessage.success(`文件 "${(relativePath || file.name).split('/').pop()}" 已覆盖上传`)
        await updateFolderCacheMetadata(relativePath || file.name, { uploaded: true })
        if (!folderUploadBatchActive.value) {
          if (currentFolder.value === targetFolderId || (!currentFolder.value && currentSpaceType.value)) {
            invalidateMergedSpacesCache()
            loadFileList()
          }
          if (currentSpaceType.value === 'PERSONAL') {
            loadPersonalStorageInfo()
          }
        }
        setTimeout(() => {
          removeUploadTask(taskId)
        }, 3000)
        return true
      } else {
        const currentTask = uploadTasks.value.find(t => t.id === taskId)
        const failReason = retryRes.msg || '文件上传失败'
        if (currentTask) {
          currentTask.status = 'error'
          currentTask.phase = 'done'
          currentTask.error = failReason
        }
        await updateFolderCacheMetadata(relativePath || file.name, {
          uploaded: false,
          failed: true,
          failReason,
          failAt: Date.now()
        })
        ElMessage.error(failReason)
        return false
      }
    } else {
      const currentTask = uploadTasks.value.find(t => t.id === taskId)
      const failReason = res.msg || '文件上传失败'
      if (currentTask) {
        currentTask.status = 'error'
        currentTask.phase = 'done'
        currentTask.error = failReason
      }
      await updateFolderCacheMetadata(relativePath || file.name, {
        uploaded: false,
        failed: true,
        failReason,
        failAt: Date.now()
      })
      ElMessage.error(failReason)
      return false
    }
  } catch (error) {
    console.error('文件夹内文件上传失败:', error)
    const currentTask = uploadTasks.value.find(t => t.id === taskId)
    const failReason = error.response?.data?.msg || '文件上传失败'
    if (currentTask) {
      currentTask.status = 'error'
      currentTask.phase = 'done'
      currentTask.error = failReason
    }
    await updateFolderCacheMetadata(relativePath || file.name, {
      uploaded: false,
      failed: true,
      failReason,
      failAt: Date.now()
    })
    ElMessage.error(failReason)
    return false
  } finally {
    const hasUploading = uploadTasks.value.some(t => t.status === 'uploading')
    uploading.value = hasUploading
  }
}
</script>

<style scoped>
.file-manager {
  height: 100%;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  background: var(--sd-surface-1, #f4f4f4);
  --fm-column-head-height: 56px;
  --fm-column-head-padding-y: 5px;
}

.file-manager-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  background-color: transparent;
  box-sizing: border-box;
  min-height: 0;
}

.sidebar {
  flex-shrink: 0;
  height: calc(100vh - 36px);
  background: var(--sd-canvas, #ffffff);
  border-right: 1px solid var(--sd-hairline, #e0e0e0);
  box-shadow: var(--sd-shadow-sidebar);
}

.resizer {
  width: 4px;
  cursor: col-resize;
  flex-shrink: 0;
  background-color: var(--sd-hairline, #e0e0e0);
  align-self: stretch;
}

.resizer:hover {
  background-color: var(--sd-surface-2, #e0e0e0);
}

.folder-tree-wrapper {
  position: relative;
  background-color: var(--sd-canvas, #ffffff);
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tree-header {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

/* 三栏顶栏统一高度，底边线对齐；顶部留白避免贴页签 */
.fm-column-head {
  height: var(--fm-column-head-height, 56px);
  min-height: var(--fm-column-head-height, 56px);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding-top: var(--fm-column-head-padding-y, 5px);
  padding-bottom: var(--fm-column-head-padding-y, 5px);
  padding-left: 16px;
  padding-right: 16px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
}

.fm-sidebar-head {
  padding-left: 12px;
  padding-right: 12px;
}

.fm-sidebar-head .fm-scope-selector,
.fm-sidebar-head .fm-scope-selector .selector-trigger {
  width: 100%;
}

.fm-sidebar-head :deep(.selector-trigger) {
  padding-top: 6px;
  padding-bottom: 6px;
}

.fm-tree-search-row {
  display: flex;
  align-items: center;
  padding: 7px 12px;
}

.fm-tree-search-row.fm-column-head {
  padding-left: 12px;
  padding-right: 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.fm-tree-search-row:not(.fm-column-head) {
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.fm-tree-search-row > * + * {
  margin-left: 8px;
}

.fm-folder-search,
.fm-file-search {
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 0 10px 0 32px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.fm-folder-search {
  flex: 1;
  min-width: 0;
  max-width: none;
}

.fm-file-search {
  width: 200px;
  max-width: 240px;
}

.fm-folder-search .sd-search-icon,
.fm-file-search .sd-search-icon {
  left: 10px;
  margin-top: -7px;
  font-size: 14px;
}

.fm-folder-search .sd-search-input,
.fm-file-search .sd-search-input {
  height: 30px;
  line-height: 30px;
  font-size: 14px;
}

.fm-sidebar-view-toggle {
  flex-shrink: 0;
  padding: 4px;
  margin-left: 4px;
}

.create-folder-path-tag {
  white-space: normal;
  height: auto;
  max-width: 280px;
  word-break: break-word;
  line-height: 1.45;
}

/* 文本检索：Chrome 77 不支持 flex gap */
.fm-text-search-toolbar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.fm-text-search-toolbar > * + * {
  margin-left: 8px;
}

.text-search-main-split {
  display: flex;
  height: calc(100% - 75px);
}

.text-search-main-split > * + * {
  margin-left: 16px;
}

/* 旧 tree-header-row 保留给注释块内 OSS 按钮使用 */
.tree-header-row {
  display: flex;
  align-items: center;
}

.tree-header-row > * + * {
  margin-left: 8px;
}

.tree-header-buttons {
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  width: 100%;
  min-width: 0;
}

.fm-scope-tree-select {
  width: 100%;
}

.oss-sync-btn {
  flex-shrink: 0;
}

.oss-missing-icon {
  margin-left: 4px;
  color: #e6a23c;
  font-size: 14px;
  vertical-align: middle;
}

.no-permission-assign-icon {
  margin-left: 4px;
  color: #909399;
  font-size: 14px;
  vertical-align: middle;
}

.folder-tree {
  flex: 1;
  overflow: auto;
  min-width: 0;
  padding: 4px 8px 8px;
}

.tree-loading-panel {
  height: 100%;
  min-height: 160px;
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
}

.file-list-skeleton {
  flex: 1;
  min-height: 200px;
  overflow: auto;
  padding: 16px;
  background: var(--sd-canvas, #ffffff);
}

.file-list-skeleton-row {
  margin-bottom: 14px;
}

.file-list-skeleton-row:last-child {
  margin-bottom: 0;
}

/* Customize Element Plus Tree */
:deep(.el-tree) {
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: auto;
  min-height: 36px;
  line-height: 1.5;
  padding: 4px 8px;
  position: relative;
  pointer-events: auto;
  border-radius: 0;
  overflow: hidden;
}

:deep(.el-tree-node__content:hover) {
  background-color: var(--sd-surface-1, #f4f4f4);
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: var(--sd-primary-light, #e8f0f8);
  color: var(--sd-primary, #195fb4);
}

:deep(.el-tree-node.is-current > .el-tree-node__content .node-label) {
  color: var(--sd-primary, #195fb4);
  font-weight: 500;
}

:deep(.el-tree-node__label) {
  font-size: 14px;
}

.tree-node-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  min-height: 28px;
  min-width: 0;
  overflow: hidden;
}

.node-left {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.node-left > * + * {
  margin-left: 8px;
}

.folder-icon {
  font-size: 16px;
  flex-shrink: 0;
  color: var(--sd-primary, #195fb4);
}

.folder-icon.icon-public,
.folder-icon.icon-personal,
.folder-icon.icon-public-province,
.folder-icon.icon-public-org,
.folder-icon.icon-default {
  color: var(--sd-primary, #195fb4);
}

/* 权限图标样式 */
.permission-icon {
  margin-right: 4px;
  cursor: default;
  vertical-align: middle;
}

.permission-icon.permission-manage {
  color: var(--sd-primary, #195fb4);
}

.permission-icon.permission-read {
  color: var(--sd-ink-subtle, #8c8c8c);
}

.node-label {
  flex: 1;
  font-size: 14px;
  color: var(--sd-ink, #262626);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  min-width: 0;
}

.is-disabled-node .node-label {
  color: var(--sd-ink, #262626);
}

.node-left-tags {
  flex-shrink: 0;
}

.storage-info {
  padding: 14px 16px 16px;
  margin: 0;
  background: var(--sd-surface-1, #f4f4f4);
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
}

.storage-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.storage-header > * + * {
  margin-left: 12px;
}

.storage-link {
  font-size: 12px;
}

.storage-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-ink-muted, #525252);
  flex: 1;
}

.storage-progress {
  margin-bottom: 8px;
}

.storage-text {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--sd-ink-subtle, #8c8c8c);
  line-height: 1.5;
}

.storage-percentage {
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
}

.storage-management-content .toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.storage-management-content .toolbar > * + * {
  margin-left: 12px;
}

.node-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.node-right > * + * {
  margin-left: 4px;
}

.node-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background-color: #f4f4f5;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
}

/* 当节点悬停时显示按钮 */
.tree-node-content:hover .node-actions {
  opacity: 1;
}

/* 当按钮本身被悬停时也保持显示 */
.tree-node-content .node-actions:hover {
  opacity: 1;
}

.dropdown-trigger {
  color: #606266;
  transition: color 0.2s;
  transform: rotate(90deg);
}

.dropdown-trigger:hover {
  color: #409eff;
}

.space-add-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

/* 当节点悬停时显示按钮 */
.tree-node-content:hover .space-add-btn {
  opacity: 1;
}

/* 当按钮本身被悬停时也保持显示 */
.tree-node-content .space-add-btn:hover {
  opacity: 1;
}

.project-bound-icon {
  flex-shrink: 0;
  margin-left: 8px;
  margin-right: 4px;
  cursor: help;
  color: #E6A23C;
  vertical-align: middle;
}

.folder-tag {
  flex-shrink: 0;
  margin-left: 4px;
}

.toolbox {
  width: 280px;
  background: var(--sd-canvas, #ffffff);
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: var(--sd-shadow-sidebar);
}

.toolbox-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--sd-ink, #161616);
}

.close-icon {
  cursor: pointer;
  color: #909399;
  font-size: 18px;
}

.close-icon:hover {
  color: #303133;
}

.toolbox-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 8px 16px;
}

.toolbox-section {
  margin-bottom: 0;
}

.toolbox-empty {
  padding: 32px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--sd-ink-subtle, #8c8c8c);
}

.toolbox-category {
  margin-bottom: 4px;
}

.toolbox-category + .toolbox-category {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
}

.toolbox-category-head {
  display: flex;
  align-items: center;
  padding: 4px 10px 6px;
}

.toolbox-category-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--sd-ink-subtle, #8c8c8c);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 12px;
}

.agent-list {
  display: flex;
  flex-direction: column;
}

.agent-list > * + * {
  margin-top: 8px;
}

.agent-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.agent-item:hover {
  background: #f5f7fa;
  border-color: #409EFF;
}

.agent-icon {
  margin-right: 8px;
  color: #409EFF;
  font-size: 18px;
}

.agent-name {
  font-size: 14px;
  color: #303133;
}

.empty-tip {
  font-size: 12px;
  color: #909399;
  text-align: center;
  padding: 20px 0;
}

.tool-list {
  display: flex;
  flex-direction: column;
}

.tool-list > * + * {
  margin-top: 2px;
}

.tool-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: background-color 0.15s ease;
  background: transparent;
  box-shadow: none;
}

.tool-item:hover {
  background: var(--sd-primary-light, #e8f0f8);
  border: none;
  box-shadow: none;
  transform: none;
}

.tool-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  flex-shrink: 0;
}

.tool-icon .el-icon {
  font-size: 16px;
  color: #fff;
}

.tool-icon img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.tool-icon--risk-prototype {
  background: #909399;
}

.tool-text {
  font-size: 13px;
  color: var(--sd-ink, #161616);
  font-weight: 400;
  flex: 1;
  line-height: 1.4;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-item:hover .tool-text {
  color: var(--sd-primary, #195fb4);
}

.more-tools-btn {
  width: 100%;
  margin-top: 8px;
  text-align: center;
}

.selected-files-tip {
  padding: 6px 10px;
  margin-bottom: 10px;
  background: var(--sd-primary-light, #e8f0f8);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  font-size: 12px;
  color: var(--sd-primary, #195fb4);
  text-align: center;
  line-height: 1.4;
}

.selected-files-tip--clickable:hover {
  background: var(--sd-primary-soft-hover, #e0edff);
  border-color: var(--sd-primary, #195fb4);
}

.selected-files-tip--clickable {
  cursor: pointer;
  outline: none;
}

.tool-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tool-item-disabled:hover {
  background: transparent;
  border: none;
  transform: none;
  box-shadow: none;
}

/* 工具箱触发器包装器 */
.toolbox-trigger-wrapper {
  position: relative;
  display: inline-block;
}

/* 工具箱下拉菜单 */
.toolbox-dropdown {
  position: absolute;
  top: calc(100% - 5px);
  left: 0;
  width: 320px;
  z-index: 2000;
  animation: slideDown 0.3s ease-out;
}
.toolbox-dropdown-box {
  position: relative;
  top: 10px;
  left: 0;
  width: 320px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toolbox-dropdown-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #f5f7fa;
  border-radius: 8px 8px 0 0;
}

.toolbox-dropdown-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.toolbox-dropdown-content {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

/* 工具箱下拉菜单内的工具列表和工具项样式继承全局的 .tool-list 和 .tool-item */

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 36px);
  position: relative;
  background-color: var(--sd-canvas, #ffffff);
  overflow: hidden;
  min-width: 0;
}

.fm-toolbar {
  flex-shrink: 0;
  background: var(--sd-canvas, #ffffff);
}

.fm-main-head {
  justify-content: flex-end;
}

.fm-toolbox-head {
  justify-content: space-between;
}

.fm-ref-icon {
  flex-shrink: 0;
  color: var(--sd-primary, #195fb4);
  font-size: 14px;
}

.fm-toolbar-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.fm-toolbar-actions > * + * {
  margin-left: 8px;
}

.fm-selection-summary {
  font-size: 13px;
  color: var(--sd-ink-muted, #525252);
  line-height: 32px;
  white-space: nowrap;
}

.fm-selection-detail {
  color: var(--sd-ink-subtle, #8c8c8c);
}

.fm-filter-popover {
  display: flex;
  flex-direction: column;
}

.fm-filter-popover > * + * {
  margin-top: 10px;
}

.fm-filter-field {
  width: 100%;
}

.fm-filter-type-btn {
  width: 100%;
}

.fm-table-area {
  flex: 0.98;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  min-height: 0;
  background: var(--sd-canvas, #ffffff);
}

.file-name-cell {
  display: flex;
  align-items: center;
}

.file-name {
  cursor: pointer;
  color: var(--sd-primary, #195fb4);
  transition: color 0.2s;
}

.file-name:hover {
  color: var(--sd-primary-dark, #0f4a8c);
  text-decoration: underline;
}

.summary-cell {
  display: flex;
  align-items: center;
  color: #606266;
}

.summary-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-status {
  color: #909399;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.summary-status > * + * {
  margin-left: 4px;
}

.summary-status.error {
  color: #F56C6C;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
}

/* 上传通知区域 */
.upload-notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 3000;
  max-width: 400px;
  animation: slideInRight 0.3s ease-out;
}

.upload-notification-container--collapsed {
  top: auto;
  right: auto;
  max-width: none;
  animation: none;
}

.upload-notification-collapsed {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: move;
  position: relative;
  user-select: none;
}

.upload-notification-collapsed:hover {
  background: #f5f7fa;
}

.upload-collapsed-icon {
  font-size: 22px;
  color: #409eff;
}

.upload-collapsed-icon--spinning {
  animation: uploadCollapsedSpin 1.2s linear infinite;
}

@keyframes uploadCollapsedSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.upload-collapsed-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: #f56c6c;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.upload-notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-notification-header-actions > * + * {
  margin-left: 4px;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.upload-notification-card {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.upload-tasks-list {
  max-height: 400px;
  overflow-y: auto;
}

.upload-task-item {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.upload-task-item:last-child {
  border-bottom: none;
}

.upload-task-item--nested {
  padding-left: 12px;
}

.upload-folder-group {
  margin-bottom: 4px;
}

.upload-folder-group + .upload-folder-group {
  border-top: 1px solid #e4e7ed;
  padding-top: 4px;
}

.folder-group-header {
  display: flex;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 6px 8px;
  margin-bottom: 4px;
}

.folder-group-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-group-progress {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
  white-space: nowrap;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.task-name {
  font-size: 13px;
  color: #303133;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-close {
  cursor: pointer;
  color: #909399;
  font-size: 16px;
  margin-left: 8px;
}

.task-close:hover {
  color: #606266;
}

.task-error {
  margin-top: 4px;
  font-size: 12px;
  color: #F56C6C;
}

.upload-badge {
  margin-left: 4px;
}

/* 文件夹上传后缀筛选按钮区（Chrome 77 兼容，不使用 gap） */
.folder-ext-filter-actions {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.folder-ext-filter-actions > * {
  margin-right: 8px;
  margin-bottom: 8px;
}

.recovery-single-file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.recovery-single-file-row > * + * {
  margin-left: 12px;
}

.recovery-tree-node {
  display: flex;
  align-items: center;
  font-size: 13px;
  flex-wrap: wrap;
  gap: 6px;
}

.recovery-tree-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recovery-tree-node > * + * {
  margin-left: 0;
}

.recovery-reason {
  font-size: 12px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recovery-reason.warning {
  color: var(--el-color-warning);
}

.recovery-reason.danger {
  color: var(--el-color-danger);
}

.recovery-folder-picker {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-top: 16px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.recovery-folder-picker .el-button {
  min-width: 160px;
}

.recovery-folder-picker .picker-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 重名文件对话框样式 */
.duplicate-files-tip {
  margin-bottom: 16px;
  color: #606266;
  font-size: 14px;
  line-height: 1.5;
}

.duplicate-files-list {
  overflow: hidden;
}

.folder-duplicate-dialog :deep(.el-dialog__body) {
  max-height: 420px;
  overflow-y: auto;
  box-sizing: border-box;
}

.folder-duplicate-dialog :deep(.el-dialog__footer) {
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.duplicate-dialog-footer {
  text-align: right;
}

.duplicate-dialog-footer > * + * {
  margin-left: 12px;
}

.duplicate-actions-bar {
  display: flex;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.duplicate-actions-bar > * + * {
  margin-left: 8px;
}

.pagination-section {
  background: var(--sd-canvas, #ffffff);
  min-height: 56px;
  padding: 14px 24px;
  box-sizing: border-box;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.pagination-section-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  margin-right: 16px;
}

.pagination-component {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  line-height: 32px;
}

.pagination-component :deep(.el-pagination) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  line-height: 32px;
}

.pagination-component :deep(.el-pagination__total),
.pagination-component :deep(.el-pagination__sizes),
.pagination-component :deep(.el-pagination__jump) {
  display: inline-flex;
  align-items: center;
  height: 32px;
  line-height: 32px;
}

.pagination-component :deep(.el-pagination__sizes .el-select) {
  height: 32px;
}

.pagination-component :deep(.el-pagination__sizes .el-select .el-select__wrapper) {
  min-height: 32px;
  height: 32px;
  box-sizing: border-box;
}

.pagination-component :deep(.el-pagination__sizes .el-input__inner) {
  height: 32px;
  line-height: 32px;
}

.pagination-embedded :deep(.el-pagination.is-background .el-pager li.is-active) {
  background-color: var(--sd-primary, #195fb4);
}

.pagination-embedded :deep(.el-pagination.is-background .el-pager li:hover) {
  color: var(--sd-primary, #195fb4);
}

.pagination-embedded :deep(.el-pagination.is-background .btn-prev:hover),
.pagination-embedded :deep(.el-pagination.is-background .btn-next:hover) {
  color: var(--sd-primary, #195fb4);
}

.pagination-component :deep(.el-pagination .btn-prev),
.pagination-component :deep(.el-pagination .btn-next) {
  min-width: 32px;
  height: 32px;
  line-height: 32px;
  border-radius: 4px;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  font-size: 14px;
}

.pagination-component :deep(.el-pager li) {
  min-width: 32px;
  height: 32px;
  line-height: 32px;
  border-radius: 4px;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  font-size: 14px;
  margin: 0 4px;
}

.pagination-component :deep(.el-pager li.is-active) {
  color: #fff;
  background-color: var(--sd-primary, #195fb4);
  border-color: var(--sd-primary, #195fb4);
  font-weight: 600;
}

:deep(.el-empty) {
  padding: 40px 0;
}

.hidden-upload {
  display: none;
}

:deep(.el-table) {
  flex: 1;
}

:deep(.el-table__body-wrapper) {
  /* max-height removed to allow full height */
  overflow-y: auto;
}

:deep(.document-preview-fullscreen-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  margin: 0;
  max-height: 100vh;
}

:deep(.document-preview-fullscreen-dialog .el-dialog__body) {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.document-preview-fullscreen-dialog .el-dialog__body > .ocr-viewer) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

:deep(.document-preview-fullscreen-dialog .el-dialog__body > .word-cloud-page) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

:deep(.document-preview-fullscreen-dialog .el-dialog__body > .tla-container) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

:deep(.document-preview-fullscreen-dialog .el-dialog__body > .prepaid-expenses-prototype) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

:deep(.document-preview-fullscreen-dialog .el-dialog__body > .meeting-minutes-analysis-container) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

:deep(.document-preview-fullscreen-dialog .el-dialog__body > .risk-point-prototype) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

/* 任务进度遮罩层 */
.task-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.progress-dialog-container {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  width: 640px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.progress-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.progress-dialog-left {
  display: flex;
  align-items: center;
}

.progress-elapsed {
  color: #606266;
  font-size: 12px;
}

.progress-dialog-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

/* 任务进度悬浮球（Chrome 77：不用 flex gap） */
.task-progress-floating-ball {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2999;
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.task-progress-floating-ball > * + * {
  margin-left: 6px;
}

.task-progress-floating-ball:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.5);
}

.task-progress-floating-ball:active {
  transform: translateY(0);
}

.floating-ball-icon {
  font-size: 16px;
  color: #ffffff;
  animation: rotate 1s linear infinite;
}

.floating-ball-time {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  font-family: monospace;
}

.prepaid-background-floating-ball {
  position: fixed;
  right: 24px;
  bottom: 80px;
  z-index: 2998;
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.4);
  cursor: pointer;
  user-select: none;
}

.prepaid-background-floating-ball > * + * {
  margin-left: 6px;
}

.prepaid-background-floating-ball .floating-ball-label {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 文件预览弹窗自定义头部：左侧标题，右侧导出下拉（悬停展开），右侧留白避开关闭按钮 */
.preview-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-right: 32px;
}
</style>

<!-- append-to-body 预览弹窗须用非 scoped 样式，固定弹窗高度，双栏各自滚动 -->
<style lang="scss">
.file-preview-dialog.el-dialog {
  display: flex;
  flex-direction: column;
  height: 90vh !important;
  max-height: 90vh !important;
  margin-top: 5vh !important;
  overflow: hidden;
}

.file-preview-dialog.el-dialog > .el-dialog__header {
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.file-preview-dialog.el-dialog > .el-dialog__body {
  flex: 1;
  min-height: 0;
  padding: 0;
  height: calc(90vh - 54px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.file-preview-dialog .preview-dialog-split {
  flex: 1;
  min-height: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: row;
  padding: 12px;
  box-sizing: border-box;
  background: #f0f2f5;
  overflow: hidden;
}

.file-preview-dialog .preview-dialog-pane {
  flex: 1 1 0;
  width: 50%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #c0c4cc;
  border-radius: 4px;
  box-sizing: border-box;
  overflow: hidden;
}

.file-preview-dialog .preview-dialog-pane-left {
  margin-right: 8px;
}

.file-preview-dialog .preview-dialog-pane-right {
  margin-left: 0;
}

.file-preview-dialog .preview-pane-title {
  flex-shrink: 0;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.file-preview-dialog .preview-pane-scrollbar {
  flex: 1;
  min-height: 0;
}

.file-preview-dialog .preview-pane-scrollbar .el-scrollbar__wrap {
  overflow-x: hidden;
}

.file-preview-dialog .preview-pane-scrollbar .el-scrollbar__view {
  padding-bottom: 8px;
  box-sizing: border-box;
}

.file-preview-dialog .preview-dialog-pane-left .file-preview-container {
  height: auto;
  min-height: 100%;
  overflow: visible;
}

.file-preview-dialog .preview-dialog-pane-left .file-preview-container.is-embedded {
  overflow: visible;
}

.file-preview-dialog .preview-dialog-pane-left .file-preview-container.is-embedded .preview-wrapper {
  overflow: visible;
  height: auto;
}

.file-preview-dialog .preview-dialog-pane-left .file-preview-container iframe {
  min-height: calc(90vh - 160px);
}

.file-preview-dialog .image-preview-wrapper {
  padding: 8px;
  box-sizing: border-box;
}

.file-preview-dialog .preview-parsed-markdown {
  padding: 12px 16px 32px 16px;
  box-sizing: border-box;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  color: #303133;
}

.file-preview-dialog .preview-parsed-markdown p {
  margin: 0 0 12px 0;
}

.file-preview-dialog .preview-parsed-markdown p:last-child {
  margin-bottom: 16px;
}

.file-preview-dialog .preview-parsed-markdown table {
  display: block;
  width: 100%;
  overflow: auto;
  margin-bottom: 16px;
  border-spacing: 0;
  border-collapse: collapse;
}

.file-preview-dialog .preview-parsed-markdown table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}

.file-preview-dialog .preview-parsed-markdown table tr:nth-child(2n) {
  background-color: #f6f8fa;
}

.file-preview-dialog .preview-parsed-markdown table th,
.file-preview-dialog .preview-parsed-markdown table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.file-preview-dialog .preview-parsed-markdown table th {
  font-weight: 600;
}

.file-preview-dialog .preview-parsed-empty {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
  padding: 24px;
}
</style>

<style>
.text-search-dialog-custom{
  padding: 16px 0 0 0;
  display: flex;
  flex-direction: column;
}
.text-search-dialog-custom .el-dialog__header{
  padding-left: 16px;
  flex-shrink: 0;
}
.text-search-dialog-custom .el-dialog__body{
  height: 100%;
  padding: 10px 16px 0 16px;
  background: #f5f7fa;
}
.text-search-dialog-custom .text-search-preview-content{
  flex: 1;
  border: 1px solid #ebeef5;
  padding: 8px;
  height: 100%;
  overflow: auto;
}
.text-search-dialog-custom .text-search-preview-content,
.text-search-dialog-custom .el-table{
  border-radius: 5px;
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
  background: #fff;
}
.text-search-dialog-custom .text-search-markdown-body {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  color: #303133;
}
.text-search-dialog-custom .text-search-markdown-body p {
  margin: 0 0 12px 0;
}
.text-search-dialog-custom .text-search-markdown-body p:last-child {
  margin-bottom: 0;
}
.text-search-dialog-custom .text-search-markdown-body table {
  display: block;
  width: 100%;
  overflow: auto;
  margin-bottom: 16px;
  border-spacing: 0;
  border-collapse: collapse;
}
.text-search-dialog-custom .text-search-markdown-body table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}
.text-search-dialog-custom .text-search-markdown-body table tr:nth-child(2n) {
  background-color: #f6f8fa;
}
.text-search-dialog-custom .text-search-markdown-body table th,
.text-search-dialog-custom .text-search-markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}
.text-search-dialog-custom .text-search-markdown-body table th {
  font-weight: 600;
}
.text-search-dialog-custom .text-search-markdown-body mark {
  background-color: #ffe58f;
  padding: 0 2px;
}
</style>

<style>
.text-search-dialog-custom{
  padding: 16px 0 0 0;
  display: flex;
  flex-direction: column;
}
.text-search-dialog-custom .el-dialog__header{
  padding-left: 16px;
  flex-shrink: 0;
}
.text-search-dialog-custom .el-dialog__body{
  height: 100%;
  padding: 10px 16px 0 16px;
  background: #f5f7fa;
}
.text-search-dialog-custom .text-search-preview-content{
  flex: 1;
  border: 1px solid #ebeef5;
  padding: 8px;
  height: 100%;
  overflow: auto;
}
.text-search-dialog-custom .text-search-preview-content,
.text-search-dialog-custom .el-table{
  border-radius: 5px;
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
  background: #fff;
}
.text-search-dialog-custom .text-search-markdown-body {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  color: #303133;
}
.text-search-dialog-custom .text-search-markdown-body p {
  margin: 0 0 12px 0;
}
.text-search-dialog-custom .text-search-markdown-body p:last-child {
  margin-bottom: 0;
}
.text-search-dialog-custom .text-search-markdown-body table {
  display: block;
  width: 100%;
  overflow: auto;
  margin-bottom: 16px;
  border-spacing: 0;
  border-collapse: collapse;
}
.text-search-dialog-custom .text-search-markdown-body table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}
.text-search-dialog-custom .text-search-markdown-body table tr:nth-child(2n) {
  background-color: #f6f8fa;
}
.text-search-dialog-custom .text-search-markdown-body table th,
.text-search-dialog-custom .text-search-markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}
.text-search-dialog-custom .text-search-markdown-body table th {
  font-weight: 600;
}
.text-search-dialog-custom .text-search-markdown-body mark {
  background-color: #ffe58f;
  padding: 0 2px;
}
</style>
