<template>
  <div class="left-sidebar">
    <div class="file-header ocr-column-head" :class="{ 'file-header--compact': compactFileHeader }">
      <template v-if="compactFileHeader">
        <div class="file-header-toolbar">
          <div class="sd-search-box ocr-file-search">
            <el-icon class="sd-search-icon"><component :is="bindings.icons.Search" /></el-icon>
            <input
              :value="bindings.searchKeyword.value"
              type="text"
              placeholder="搜索文件"
              class="sd-search-input"
              @input="handleSearchInput"
            />
          </div>
          <el-tooltip
            v-if="showPreviewToggle"
            :content="bindings.showFilePreview.value ? '隐藏文件预览' : '显示文件预览'"
            placement="bottom"
          >
            <el-button
              :icon="bindings.showFilePreview.value ? bindings.icons.Hide : bindings.icons.View"
              circle
              size="small"
              class="file-preview-toggle-btn"
              @click="bindings.showFilePreview.value = !bindings.showFilePreview.value"
            />
          </el-tooltip>
        </div>
      </template>
      <template v-else>
        <span v-if="showPanelTitle" class="file-title">{{ panelTitle }}</span>
        <div class="left-header-actions">
          <el-button
            v-if="allowModeSwitch"
            size="small"
            text
            type="primary"
            @click="handleToggleMode"
          >
            {{ isPreviewMode ? '切到编辑' : '切到预览' }}
          </el-button>
          <el-tooltip
            v-if="showPreviewToggle"
            :content="bindings.showFilePreview.value ? '隐藏文件预览' : '显示文件预览'"
            placement="bottom"
          >
            <el-button
              :icon="bindings.showFilePreview.value ? bindings.icons.Hide : bindings.icons.View"
              circle
              size="small"
              @click="bindings.showFilePreview.value = !bindings.showFilePreview.value"
            />
          </el-tooltip>
        </div>
      </template>
    </div>

    <div class="file-section">
      <div v-if="!compactFileHeader" class="search-area">
        <div class="sd-search-box ocr-file-search">
          <el-icon class="sd-search-icon"><component :is="bindings.icons.Search" /></el-icon>
          <input
            :value="bindings.searchKeyword.value"
            type="text"
            placeholder="搜索文件"
            class="sd-search-input"
            @input="handleSearchInput"
          />
        </div>
      </div>

      <div v-if="isPreviewMode" class="preview-result-filter">
        <el-button
          size="small"
          :type="previewStatusFilter === 'all' ? 'primary' : 'default'"
          plain
          @click="previewStatusFilter = 'all'"
        >
          共{{ previewStatusStats.total }}
        </el-button>
        <el-tooltip content="成功" placement="top">
          <el-button
            size="small"
            :type="previewStatusFilter === 'success' ? 'success' : 'default'"
            plain
            @click="previewStatusFilter = 'success'"
          >
            <span class="status-dot status-success"></span>{{ previewStatusStats.success }}
          </el-button>
        </el-tooltip>
        <el-tooltip content="失败" placement="top">
          <el-button
            size="small"
            :type="previewStatusFilter === 'failed' ? 'danger' : 'default'"
            plain
            @click="previewStatusFilter = 'failed'"
          >
            <span class="status-dot status-failed"></span>{{ previewStatusStats.failed }}
          </el-button>
        </el-tooltip>
        <el-tooltip content="执行中" placement="top">
          <el-button
            size="small"
            :type="previewStatusFilter === 'running' ? 'warning' : 'default'"
            plain
            @click="previewStatusFilter = 'running'"
          >
            <span class="status-dot status-running"></span>{{ previewStatusStats.running }}
          </el-button>
        </el-tooltip>
        <el-dropdown
          v-if="canPreviewDownload"
          trigger="hover"
          @command="handlePreviewDownloadCommand"
        >
          <el-button size="small" plain :loading="previewDownloadLoading">
            <el-icon v-if="!previewDownloadLoading"><Download /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in previewDownloadOptions"
                :key="item.command"
                :command="item.command"
              >
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div
        v-if="supportsTreeCheckboxes && !isPreviewMode && displayTreeData.length > 0"
        class="batch-actions-bar"
      >
        <div style="display: flex; align-items: center; justify-content: space-between; ">
          <el-checkbox
            v-model="bindings.isAllSelected.value"
            @change="bindings.handleSelectAll"
            :indeterminate="bindings.isIndeterminate.value"
            style="margin-right: 0;"
          >
            全选
          </el-checkbox>
          <span class="selected-count" v-if="bindings.selectedFiles.value.length > 0">
            已选择 {{ bindings.selectedFiles.value.length }} 个文件
          </span>
        </div>
      </div>

      <div class="file-list">
        <el-auto-resizer v-if="displayTreeData.length > 0">
          <template #default="{ height }">
            <el-tree-v2
              :key="fileTreeRenderKey"
              :data="displayTreeData"
              :props="bindings.fileTreeProps"
              :height="height"
              :item-size="34"
              :default-expanded-keys="previewExpandedKeys"
              @node-expand="handlePreviewTreeNodeExpand"
              @node-collapse="handlePreviewTreeNodeCollapse"
            >
              <template #default="{ data }">
                <div
                  :class="[
                    'file-tree-node',
                    {
                      active: data.nodeType === 'file' && bindings.isFileActive(data.sourceFile),
                      'file-tree-node--compact-actions': mergeAttachmentAction && data.nodeType === 'file'
                    }
                  ]"
                  @click="handleTreeNodeClickByMode(data, $event)"
                >
                  <div
                    class="file-tree-node-body"
                    :class="{ 'file-tree-node-body--compact': mergeAttachmentAction && data.nodeType === 'file' }"
                  >
                    <div class="file-tree-node-leading">
                      <el-checkbox
                        v-if="supportsTreeCheckboxes && !isPreviewMode && data.nodeType === 'folder'"
                        :model-value="bindings.isFolderChecked(data)"
                        @change="(checked) => bindings.handleFolderCheckChange(data, checked)"
                        @click.stop
                      />
                      <el-checkbox
                        v-if="supportsTreeCheckboxes && !isPreviewMode && data.nodeType === 'file'"
                        :model-value="bindings.isFileSelected(data.sourceFile)"
                        :disabled="bindings.isFilePendingDelete(data.sourceFile)"
                        @change="(checked) => bindings.handleFileSelect(data.sourceFile, checked)"
                        @click.stop
                      />
                      <el-icon v-if="data.nodeType === 'file'" class="file-icon">
                        <component :is="bindings.icons.Document" />
                      </el-icon>
                      <el-icon v-else-if="data.nodeType === 'attachment'" class="attachment-file-icon">
                        <Paperclip />
                      </el-icon>
                      <el-icon v-else class="folder-icon">
                        <component :is="bindings.icons.Folder" />
                      </el-icon>
                      <div class="file-name-wrap">
                        <el-tooltip :content="data.name" placement="top" :show-after="400">
                          <span class="file-name">{{ resolveTreeNodeDisplayName(data.name) }}</span>
                        </el-tooltip>
                      </div>
                    </div>
                    <div
                      v-if="data.nodeType === 'file' && (
                        (layoutMode === 'full' && data.sourceFile && data.sourceFile.settings && data.sourceFile.settings.configured)
                        || isPreviewMode
                      )"
                      :class="[
                        'file-tree-node-meta',
                        { 'file-tree-node-meta--compact': mergeAttachmentAction }
                      ]"
                    >
                      <span
                        v-if="layoutMode === 'full' && data.sourceFile && data.sourceFile.settings && data.sourceFile.settings.configured"
                        class="settings-badge"
                        :class="{ 'settings-badge--inline': mergeAttachmentAction }"
                      >
                        <el-tag
                          :type="data.sourceFile.settings.mode === 'prompt' ? 'primary' : 'success'"
                          size="small"
                          effect="plain"
                        >
                          {{ data.sourceFile.settings.mode === 'prompt' ? 'Prompt' : '字段' }}
                        </el-tag>
                      </span>
                      <el-tag
                        v-if="isPreviewMode"
                        :type="getPreviewStatusTagType(data)"
                        size="small"
                        effect="plain"
                        class="preview-status-tag"
                        :class="{ 'preview-status-tag--inline': mergeAttachmentAction }"
                      >
                        {{ getPreviewStatusLabel(data) }}
                      </el-tag>
                    </div>
                    <span
                      v-if="!mergeAttachmentAction && data.nodeType === 'file' && data.sourceFile && data.sourceFile.attachmentCount > 0"
                      class="attachment-badge"
                      :title="`附件 ${data.sourceFile.attachmentCount} 个`"
                    >
                      <el-icon size="12"><Paperclip /></el-icon>
                      <span style="margin-left: 2px;">{{ data.sourceFile.attachmentCount }}</span>
                    </span>
                    <el-button
                      v-if="!mergeAttachmentAction && data.nodeType === 'file' && shouldShowAttachmentButtonForFile(data.sourceFile)"
                      type="primary"
                      :icon="Paperclip"
                      size="small"
                      text
                      class="file-tree-node-legacy-btn"
                      @click.stop="handleAttachmentButtonClick(data.sourceFile)"
                      title="查看附件"
                    />
                    <el-button
                      v-if="!mergeAttachmentAction && !readonly && !isPreviewMode && data.nodeType === 'file'"
                      type="danger"
                      :icon="bindings.icons.Delete"
                      size="small"
                      text
                      class="file-tree-node-legacy-btn file-tree-node-legacy-btn--delete"
                      @click.stop="bindings.handleDeleteFile(data.sourceFile)"
                      title="删除文件"
                    />
                    <el-button
                      v-if="supportsTreeCheckboxes && !isPreviewMode && data.nodeType === 'folder'"
                      type="danger"
                      :icon="bindings.icons.Delete"
                      size="small"
                      text
                      class="file-tree-node-legacy-btn file-tree-node-legacy-btn--folder"
                      @click.stop="bindings.handleDeleteFolderNode(data)"
                      title="删除文件夹"
                    />
                  </div>
                  <div
                    v-if="data.nodeType === 'file' && mergeAttachmentAction && shouldShowFileNodeActionsForFile(data.sourceFile)"
                    class="file-tree-node-actions"
                  >
                    <span
                      v-if="shouldShowAttachmentButtonForFile(data.sourceFile)"
                      class="attachment-action-slot"
                    >
                      <el-button
                        type="primary"
                        :icon="Paperclip"
                        size="small"
                        text
                        class="node-action-btn"
                        :title="getAttachmentActionTitle(data.sourceFile)"
                        @click.stop="handleAttachmentButtonClick(data.sourceFile)"
                      />
                      <span
                        v-if="data.sourceFile && data.sourceFile.attachmentCount > 0"
                        class="attachment-merged-btn__badge"
                      >{{ data.sourceFile.attachmentCount }}</span>
                    </span>
                    <el-button
                      v-if="!readonly && !isPreviewMode"
                      type="danger"
                      :icon="bindings.icons.Delete"
                      size="small"
                      text
                      class="node-action-btn"
                      title="删除文件"
                      @click.stop="bindings.handleDeleteFile(data.sourceFile)"
                    />
                  </div>
                </div>
              </template>
            </el-tree-v2>
          </template>
        </el-auto-resizer>
        <el-empty
          v-if="displayTreeData.length === 0"
          :description="emptyDescription"
          :image-size="80"
          style="padding: 20px 0;"
        />
      </div>

      <div v-if="supportsTreeCheckboxes && !isPreviewMode && bindings.checkedFolderPaths.value.length > 0" class="folder-selection-bar">
        <span class="selected-count">已勾选 {{ bindings.checkedFolderPaths.value.length }} 个文件夹</span>
        <el-button
          size="small"
          type="danger"
          plain
          @click="bindings.handleDeleteCheckedFolders()"
          style="width: 100%; margin-top: 6px;"
        >
          删除勾选文件夹（前端）
        </el-button>
      </div>
    </div>

    <div v-if="!isPreviewMode" class="file-actions-bottom ocr-sidebar-footer">
      <div class="file-actions-row">
        <el-button
          v-if="showSelectFileButton"
          class="ocr-select-files-btn ocr-footer-btn"
          @click="bindings.handleSelectFile()"
        >
          {{ selectButtonText }}
        </el-button>
        <slot name="footer">
          <el-button
            v-if="!hideBatchExecute"
            type="primary"
            class="ocr-batch-execute-btn ocr-footer-btn"
            @click="bindings.handleExecuteDialog()"
            :disabled="!bindings.canBatchExecute.value"
            :title="bindings.canBatchExecute.value ? '批量执行（处理左侧树全部文件与文件夹）' : '请先完成右侧功能配置，并确保左侧有文件或文件夹'"
          >
            批量执行
          </el-button>
        </slot>
      </div>
    </div>

    <div v-else class="preview-task-footer">
      <div class="task-meta-item">
        <span class="task-meta-label">任务名称：</span>
        <span class="task-meta-value">{{ previewTaskName }}</span>
      </div>
      <div class="task-meta-item">
        <span class="task-meta-label">任务ID：</span>
        <span class="task-meta-value">{{ taskId || '-' }}</span>
      </div>
    </div>
  </div>

  <el-dialog
    v-if="showBatchSettingsDialog"
    v-model="bindings.batchSettingsDialogVisible.value"
    title="批量设置"
    width="900px"
    :close-on-click-modal="false"
    class="batch-settings-dialog"
  >
    <div class="batch-settings-content">
      <div class="batch-config-field">
        <div class="field-config-desc">
          所有文件将统一使用以下字段配置。选择自定义字段时，可以点击"从模板加载"将模板字段添加到编辑区。
        </div>
        <div class="batch-file-list" style="margin-top: 20px;">
          <el-table
            :data="bindings.batchSettingsFileList.value"
            row-key="rowKey"
            :tree-props="{ children: 'children' }"
            default-expand-all
            border
            max-height="200"
            style="margin-top: 10px;"
          >
            <el-table-column prop="name" label="名称" min-width="300" />
            <el-table-column prop="typeLabel" label="类型" width="120" />
            <el-table-column label="设置模式" width="120">
              <template #default="{ row }">
                <el-tag
                  v-if="row.settings && row.settings.configured"
                  :type="getBatchSettingsModeTagType(row.settings)"
                  size="small"
                >
                  {{ getBatchSettingsModeLabel(row.settings) }}
                </el-tag>
                <span v-else style="color: #909399;">未设置</span>
              </template>
            </el-table-column>
            <el-table-column label="设置内容" min-width="300">
              <template #default="{ row }">
                <div v-if="row.settings && row.settings.configured" style="color: #606266;">
                  <template v-if="row.settings.mode === 'engineering'">
                    <span>{{ getBatchSettingsContentText(row.settings) }}</span>
                  </template>
                  <template v-else-if="row.settings.mode === 'riskPoint'">
                    <span>{{ getBatchSettingsContentText(row.settings) }}</span>
                  </template>
                  <template v-else-if="row.settings.mode === 'prompt'">
                    <span>{{ row.settings.prompt || '-' }}</span>
                  </template>
                  <template v-else-if="row.settings.template">
                    <span>模板：{{ bindings.getTemplateName(row.settings.template) }}</span>
                  </template>
                  <template v-else-if="row.settings.fieldDefinitions && row.settings.fieldDefinitions.length > 0">
                    <span>自定义字段：{{ row.settings.fieldDefinitions.map(f => f.name || '未命名字段').filter(Boolean).join('、') }}</span>
                  </template>
                  <template v-else>
                    <span>未配置</span>
                  </template>
                </div>
                <span v-else style="color: #909399;">-</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="unified-field-config" style="margin-top: 20px; border: 1px solid #e4e7ed; border-radius: 4px; padding: 16px;">
          <div style="margin-bottom: 16px;">
            <el-radio-group
              v-model="bindings.batchSettingsTemplateMap.value.type"
              size="default"
              @change="bindings.handleBatchFieldModeChange"
            >
              <el-radio-button label="template">使用模板</el-radio-button>
              <el-radio-button label="custom">自定义字段</el-radio-button>
            </el-radio-group>
          </div>
          <div v-if="bindings.batchSettingsTemplateMap.value.type === 'template'" class="template-mode">
            <el-select
              v-model="bindings.batchSettingsTemplateMap.value.value"
              placeholder="选择模板"
              size="default"
              style="width: 100%;"
              filterable
              :loading="bindings.templateLoading.value"
            >
              <el-option
                v-for="template in bindings.templateOptions.value"
                :key="template.value"
                :label="template.label"
                :value="template.value"
              />
            </el-select>
          </div>
          <div v-if="bindings.batchSettingsTemplateMap.value.type === 'custom'" class="custom-mode">
            <div style="margin-bottom: 12px;">
              <el-dropdown @command="(templateValue) => bindings.handleLoadFieldsFromTemplate(templateValue)">
                <el-button size="small" type="primary" plain :loading="bindings.templateLoading.value">
                  <el-icon><component :is="bindings.icons.Plus" /></el-icon>
                  从模板加载字段
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="template in bindings.templateOptions.value"
                      :key="template.value"
                      :command="template.value"
                    >
                      {{ template.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="field-definition-list" v-if="bindings.batchSettingsFieldMap.value.length > 0">
              <div v-for="(field, fieldIndex) in bindings.batchSettingsFieldMap.value" :key="field.id || fieldIndex" class="field-item" style="margin-bottom: 12px; padding: 12px; background: #f5f7fa; border-radius: 4px;">
                <div class="field-item-content">
                  <div class="field-row" style="display: flex; gap: 12px; margin-bottom: 8px;">
                    <div style="flex: 1;">
                      <div class="field-label" style="font-size: 12px; color: #606266; margin-bottom: 4px;">字段名称 *</div>
                      <el-input v-model="field.name" placeholder="请输入字段名称" size="small" style="width: 100%;" />
                    </div>
                    <div style="width: 80px;">
                      <el-button
                        type="danger"
                        size="small"
                        :icon="bindings.icons.Delete"
                        @click="bindings.handleBatchRemoveField(fieldIndex)"
                      >
                        删除
                      </el-button>
                    </div>
                  </div>
                  <div class="field-row">
                    <div class="field-label" style="font-size: 12px; color: #606266; margin-bottom: 4px;">字段描述</div>
                    <el-input v-model="field.description" placeholder="对要抽取的字段进行描述" size="small" />
                  </div>
                </div>
              </div>
            </div>
            <div class="field-item field-item-new" style="margin-bottom: 12px; padding: 12px; background: #fafafa; border: 1px dashed #dcdfe6; border-radius: 4px;">
              <div class="field-item-content">
                <div class="field-row" style="display: flex; gap: 12px; margin-bottom: 8px;">
                  <div style="flex: 1;">
                    <div class="field-label" style="font-size: 12px; color: #606266; margin-bottom: 4px;">字段名称 *</div>
                    <el-input
                      v-model="bindings.batchSettingsNewFieldMap.value.name"
                      placeholder="请输入字段名称"
                      size="small"
                      style="width: 100%;"
                      @keyup.enter="bindings.handleBatchAddField"
                    />
                  </div>
                </div>
                <div class="field-row">
                  <div class="field-label" style="font-size: 12px; color: #606266; margin-bottom: 4px;">字段描述</div>
                  <el-input
                    v-model="bindings.batchSettingsNewFieldMap.value.description"
                    placeholder="对要抽取的字段进行描述"
                    size="small"
                    @keyup.enter="bindings.handleBatchAddField"
                  />
                </div>
              </div>
            </div>
            <div class="add-field-button">
              <el-button type="primary" plain size="small" @click="bindings.handleBatchAddField">
                <el-icon><component :is="bindings.icons.Plus" /></el-icon>
                添加字段
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="bindings.handleBatchSettingsCancel">取消</el-button>
        <el-button type="primary" @click="bindings.handleBatchSettingsConfirm">
          确认保存
        </el-button>
      </span>
    </template>
  </el-dialog>

  <el-dialog
    v-if="showBatchRecognizeDialog"
    v-model="bindings.batchRecognizeDialogVisible.value"
    title="批量执行"
    width="900px"
    :close-on-click-modal="false"
    class="batch-recognize-dialog"
    @close="handleBatchRecognizeDialogClose"
  >
    <div class="batch-recognize-content">
      <div class="task-params-section" style="margin-bottom: 20px;">
        <el-form :model="{ taskName: bindings.taskName.value, taskRemark: bindings.taskRemark.value }" label-width="100px">
          <el-form-item label="任务名称" required>
            <el-input
              v-model="bindings.taskName.value"
              placeholder="请输入任务名称"
              maxlength="100"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="任务备注">
            <el-input
              v-model="bindings.taskRemark.value"
              type="textarea"
              :rows="3"
              placeholder="请输入任务备注（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>
      <div class="batch-file-list">
        <el-table
          :data="bindings.batchFileList.value"
          row-key="rowKey"
          :tree-props="{ children: 'children' }"
          default-expand-all
          border
          max-height="300"
          style="margin-top: 10px;"
        >
          <el-table-column prop="name" label="名称" min-width="250" />
          <el-table-column prop="typeLabel" label="类型" width="120" />
          <el-table-column label="设置模式" width="120">
            <template #default="{ row }">
              <el-tag
                v-if="row.settings && row.settings.configured"
                :type="getBatchSettingsModeTagType(row.settings)"
                size="small"
              >
                {{ getBatchSettingsModeLabel(row.settings) }}
              </el-tag>
              <span v-else style="color: #909399;">未设置</span>
            </template>
          </el-table-column>
          <el-table-column label="设置内容" min-width="300">
            <template #default="{ row }">
              <div v-if="row.settings && row.settings.configured">
                <div v-if="row.settings.mode === 'engineering'" style="color: #606266;">
                  <span>{{ getBatchSettingsContentText(row.settings) }}</span>
                </div>
                <div v-else-if="row.settings.mode === 'riskPoint'" style="color: #606266;">
                  <span>{{ getBatchSettingsContentText(row.settings) }}</span>
                </div>
                <div v-else-if="row.settings.mode === 'prompt'">
                  <el-popover
                    v-if="row.settings.prompt && row.settings.prompt.length > 50"
                    placement="top"
                    width="400"
                    trigger="hover"
                  >
                    <template #reference>
                      <span style="color: #606266; cursor: pointer;">
                        {{ row.settings.prompt.substring(0, 50) }}...
                      </span>
                    </template>
                    <div style="word-break: break-word; white-space: pre-wrap;">
                      {{ row.settings.prompt }}
                    </div>
                  </el-popover>
                  <span v-else style="color: #606266;">{{ row.settings.prompt }}</span>
                </div>
                <div v-else-if="row.settings.mode === 'field'">
                  <div style="color: #606266;">
                    <template v-if="row.settings.template">
                      <span>模板：{{ bindings.getTemplateName(row.settings.template) }}</span>
                    </template>
                    <template v-else-if="row.settings.fieldDefinitions && row.settings.fieldDefinitions.length > 0">
                      <span>自定义字段：</span>
                      <span>
                        <template v-if="row.settings.fieldDefinitions.length <= 3">
                          {{ row.settings.fieldDefinitions.map(f => f.name || '未命名字段').filter(Boolean).join('、') }}
                        </template>
                        <template v-else>
                          {{ row.settings.fieldDefinitions.slice(0, 3).map(f => f.name || '未命名字段').filter(Boolean).join('、') }}...
                        </template>
                      </span>
                    </template>
                    <template v-else>
                      <span>未配置</span>
                    </template>
                  </div>
                </div>
              </div>
              <span v-else style="color: #909399;">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleBatchRecognizeCancelClick">取消</el-button>
        <el-button type="primary" @click="handleBatchExecuteConfirmClick" :loading="batchExecuteConfirmLoading">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>

  <FileSelectDialog
    v-if="!isPreviewMode && !readonly"
    v-model="bindings.fileSelectDialogVisible.value"
    :return-object="true"
    :initial-selected-folders="bindings.fileSelectInitialFolders.value"
    :initial-selected-files="bindings.fileSelectInitialFiles.value"
    :allow-unparsed="fileSelectAllowUnparsed"
    :can-select-file-type="fileSelectCanSelectFileType"
    :show-parse-status="fileSelectShowParseStatus"
    @confirm="handleFileSelectConfirm"
  />

  <template v-if="enableFileAttachment">
    <el-dialog
      v-model="attachmentDialogVisible"
      :title="`查看附件 - ${attachmentDisplayFileName}（共 ${attachmentList.length} 个）`"
      width="720px"
      :close-on-click-modal="false"
      class="ocr-sidebar-attachment-dialog"
      @close="closeAttachmentDialog"
    >
      <div v-if="attachmentLoading" class="attachment-loading">
        <el-skeleton :rows="3" animated />
      </div>
      <div v-else-if="attachmentList.length === 0" class="attachment-empty">
        <el-empty description="暂无附件" />
      </div>
      <div v-else class="attachment-table-wrap">
        <el-table
          :data="attachmentList"
          border
          stripe
          max-height="400"
          class="sd-table--clean attachment-list-table"
        >
          <el-table-column label="文件名" min-width="280">
            <template #default="{ row }">
              <div class="attachment-name-cell">
                <el-icon class="attachment-icon"><Document /></el-icon>
                <el-tooltip :content="row.name" placement="top" :show-after="400">
                  <span class="attachment-name-text">{{ row.name }}</span>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" :width="attachmentDialogReadonly ? 100 : 160" align="center" fixed="right">
            <template #default="{ row, $index }">
              <div class="attachment-op-cell">
                <el-button
                  v-if="row.file_id"
                  type="primary"
                  link
                  size="small"
                  @click="handlePreviewAttachment(row)"
                >查看原文</el-button>
                <el-button
                  v-if="!attachmentDialogReadonly"
                  type="danger"
                  link
                  size="small"
                  :icon="Delete"
                  @click="removeAttachment($index)"
                >移除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <div class="attachment-dialog-footer">
          <el-button @click="closeAttachmentDialog">关闭</el-button>
          <el-button
            v-if="!attachmentDialogReadonly"
            type="primary"
            @click="openSelectDialog"
          >
            <el-icon><Plus /></el-icon>添加附件
          </el-button>
        </div>
      </template>
    </el-dialog>

    <AttachmentSelectDialog
      v-model:visible="selectDialogVisible"
      :available-files="attachmentAvailableFiles"
      :exclude-file-ids="excludeFileIds"
      @confirm="handleAddAttachments"
    />

    <el-dialog
      v-model="previewDialogVisible"
      :title="previewFileName || '查看原文'"
      width="90%"
      top="5vh"
      destroy-on-close
      append-to-body
      class="attachment-preview-dialog"
      @closed="resetPreviewState"
    >
      <div
        v-loading="previewLoading"
        class="attachment-preview-body"
      >
        <div
          v-if="previewFileType === 'image' && previewFileData"
          class="image-preview-wrapper"
        >
          <el-image
            :src="previewFileData"
            :preview-src-list="[previewFileData]"
            fit="contain"
            style="width: 100%; height: 100%; min-height: 500px;"
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
        <el-empty v-else-if="!previewLoading" description="暂无可预览内容" />
      </div>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </template>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import FileSelectDialog from '@/components/common/FileSelectDialog.vue'
import AttachmentSelectDialog from './AttachmentSelectDialog.vue'
import FilePreview from '@/components/FilePreview.vue'
import { useOcrSidebarAttachment } from '../composables/useOcrSidebarAttachment.js'
import { Download, Paperclip, Document, Delete, Plus } from '@element-plus/icons-vue'

const props = defineProps({
  bindings: {
    type: Object,
    required: true
  },
  mode: {
    type: String,
    default: 'edit'
  },
  taskId: {
    type: String,
    default: ''
  },
  allowModeSwitch: {
    type: Boolean,
    default: false
  },
  allowFolderClickInPreview: {
    type: Boolean,
    default: true
  },
  panelTitle: {
    type: String,
    default: '文件'
  },
  /** 是否显示顶栏标题（panelTitle） */
  showPanelTitle: {
    type: Boolean,
    default: true
  },
  /** 紧凑顶栏：搜索框与预览显隐按钮同一行，不展示标题区 */
  compactFileHeader: {
    type: Boolean,
    default: false
  },
  selectButtonText: {
    type: String,
    default: '选择文件'
  },
  emptyDescription: {
    type: String,
    default: '未找到匹配的文件'
  },
  /** 隐藏底部默认「批量执行」按钮（业务页可用 #footer 插槽覆盖） */
  hideBatchExecute: {
    type: Boolean,
    default: false
  },
  /** @deprecated 为 true 时隐藏底部批量执行 */
  hideBatchActions: {
    type: Boolean,
    default: false
  },
  /** full=信息提取；tree-select=文件夹树+勾选（会议纪要）；simple=仅扁平文件列表 */
  layoutMode: {
    type: String,
    default: 'full'
  },
  /** 只读：隐藏选择/删除 */
  readonly: {
    type: Boolean,
    default: false
  },
  /** 是否显示中间预览区显隐按钮 */
  showPreviewToggle: {
    type: Boolean,
    default: true
  },
  /**
   * 预览模式下列表拉取配置
   * @typedef {Object} PreviewListConfig
   * @property {(ctx: { taskId: string }) => Promise<any>} fetchList 拉取原始数据
   * @property {(raw: any, ctx: { taskId: string }) => Array} [mapToTree] 转为左侧树节点
   */
  previewListConfig: {
    type: Object,
    default: null
  },
  /**
   * 选择文件弹窗：未解析文件是否可选（false=仅已解析，与 FileSelectDialog 一致）
   * bindings.allowUnparsed 存在时优先使用 bindings
   */
  allowUnparsed: {
    type: Boolean,
    default: false
  },
  /** 选择文件弹窗：是否显示解析状态列 */
  showParseStatus: {
    type: Boolean,
    default: true
  },
  /**
   * 是否合并附件数量角标与「查看/绑定附件」为同一按钮，并将操作列右对齐（默认关闭，不影响其他工具）
   */
  mergeAttachmentAction: {
    type: Boolean,
    default: false
  },
  /**
   * 是否使用 CSS 尾部省略显示文件名（默认关闭，沿用 bindings.getTreeNodeDisplayName 截断逻辑）
   */
  truncateFileNameByCss: {
    type: Boolean,
    default: false
  },
  /**
   * 是否启用左侧文件「绑定附件」能力（内置附件管理弹窗，默认关闭）
   */
  enableFileAttachment: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['mode-change', 'attachment-change'])

const attachmentDialogVisible = ref(false)
const attachmentDialogFileId = ref('')
const attachmentDialogFileName = ref('')

const previewStatusFilter = ref('all')
const currentMode = ref(props.mode)
const batchExecuteConfirmLoading = ref(false)
const previewListLoading = ref(false)
/** 预览树已展开节点 key（data 刷新时回传给 el-tree-v2，避免自动收起） */
const previewExpandedKeys = ref([])

watch(
  () => props.mode,
  (val) => {
    currentMode.value = val || 'edit'
  }
)

/**
 * 解析树节点用于展开态的 key（与 el-tree-v2 props.value 对齐）
 * @param {Object} treeNode 树节点数据
 * @returns {string|number|null} 节点 key
 */
function resolvePreviewTreeNodeKey(treeNode) {
  if (!treeNode) return null
  const propsMap = (props.bindings && props.bindings.fileTreeProps) || {}
  const valueKey = propsMap.value || 'treeKey'
  const key = treeNode[valueKey]
  if (key === undefined || key === null || key === '') {
    return null
  }
  return key
}

/**
 * 记录预览树节点展开
 * @param {Object} treeNode 展开的树节点数据
 * @returns {void}
 */
function handlePreviewTreeNodeExpand(treeNode) {
  const key = resolvePreviewTreeNodeKey(treeNode)
  if (key === null) return
  if (!previewExpandedKeys.value.includes(key)) {
    previewExpandedKeys.value = previewExpandedKeys.value.concat(key)
  }
}

/**
 * 记录预览树节点收起
 * @param {Object} treeNode 收起的树节点数据
 * @returns {void}
 */
function handlePreviewTreeNodeCollapse(treeNode) {
  const key = resolvePreviewTreeNodeKey(treeNode)
  if (key === null) return
  previewExpandedKeys.value = previewExpandedKeys.value.filter((item) => item !== key)
}

watch(
  () => props.taskId,
  () => {
    previewExpandedKeys.value = []
  }
)

const isPreviewMode = computed(() => currentMode.value === 'preview')

/** 附件弹窗是否只读（预览模式） */
const attachmentDialogReadonly = computed(() => {
  if (isPreviewMode.value) {
    return true
  }
  return !!props.readonly
})

/**
 * 附件候选文件列表（由父级 bindings.attachmentAvailableFiles 提供）
 * @returns {Array<Object>} 候选文件
 */
const attachmentAvailableFiles = computed(() => {
  const fromBinding = props.bindings && props.bindings.attachmentAvailableFiles
  if (Array.isArray(fromBinding)) {
    return fromBinding
  }
  if (fromBinding && Array.isArray(fromBinding.value)) {
    return fromBinding.value
  }
  return []
})

/**
 * 附件列表变更后通知父级刷新对应主文件附件数量
 * @param {string} fileId 主文件 ID
 * @returns {void}
 */
function handleAttachmentListChange(fileId) {
  emit('attachment-change', fileId)
  const handler = props.bindings && props.bindings.onAttachmentChange
  if (typeof handler === 'function') {
    handler(fileId)
  }
}

/** 内置附件管理（查看原文 / 移除 / 关闭 / 添加附件 / 预览） */
const {
  attachmentList,
  loading: attachmentLoading,
  selectDialogVisible,
  previewDialogVisible,
  previewLoading,
  previewFileName,
  previewFileType,
  previewFileData,
  displayFileName: attachmentDisplayFileName,
  excludeFileIds,
  handlePreviewAttachment,
  removeAttachment,
  openSelectDialog,
  handleAddAttachments,
  closeAttachmentDialog,
  resetPreviewState
} = useOcrSidebarAttachment({
  visible: attachmentDialogVisible,
  fileId: attachmentDialogFileId,
  fileName: attachmentDialogFileName,
  availableFiles: attachmentAvailableFiles,
  readonly: attachmentDialogReadonly,
  onChange: handleAttachmentListChange
})

/** 是否具备附件能力（编辑态可绑定 / 预览态可查看） */
const canShowAttachmentButton = computed(() => {
  if (props.enableFileAttachment) {
    if (isPreviewMode.value) {
      return true
    }
    return !props.readonly
  }
  if (typeof props.bindings?.handleViewAttachments !== 'function') {
    return false
  }
  if (isPreviewMode.value) {
    return true
  }
  return !props.readonly
})

/**
 * 判断某文件行是否展示附件按钮
 * @param {Object|null} sourceFile 源文件对象
 * @returns {boolean} 是否展示
 */
function shouldShowAttachmentButtonForFile(sourceFile) {
  if (!canShowAttachmentButton.value) {
    return false
  }
  if (isPreviewMode.value || attachmentDialogReadonly.value) {
    const count = sourceFile && sourceFile.attachmentCount ? Number(sourceFile.attachmentCount) : 0
    return count > 0
  }
  return true
}

/**
 * 判断文件行是否展示右侧操作区（附件 / 删除）
 * @param {Object|null} sourceFile 源文件对象
 * @returns {boolean} 是否展示
 */
function shouldShowFileNodeActionsForFile(sourceFile) {
  return shouldShowAttachmentButtonForFile(sourceFile) || (!props.readonly && !isPreviewMode.value)
}

/**
 * 打开附件管理弹窗
 * @param {Object|null} sourceFile 源文件对象
 * @returns {void}
 */
function openAttachmentDialog(sourceFile) {
  const fileId = sourceFile && (sourceFile.fileId || sourceFile.file_uuid || sourceFile.file_id)
  if (!sourceFile || !fileId) {
    return
  }
  attachmentDialogFileId.value = String(fileId)
  attachmentDialogFileName.value = sourceFile.name || sourceFile.file_name || '未命名文件'
  attachmentDialogVisible.value = true
}

/**
 * 解析树节点展示名称（支持 CSS 尾部省略或沿用 bindings 截断）
 * @param {string} nodeName 节点原始名称
 * @returns {string} 展示用文件名
 */
function resolveTreeNodeDisplayName(nodeName) {
  const safeName = nodeName || ''
  if (props.truncateFileNameByCss) {
    return safeName
  }
  const resolver = props.bindings && props.bindings.getTreeNodeDisplayName
  if (typeof resolver === 'function') {
    return resolver(safeName)
  }
  return safeName
}

/**
 * 点击左侧文件行「查看/绑定附件」按钮
 * @param {Object|null} sourceFile 源文件对象
 * @returns {void}
 */
function handleAttachmentButtonClick(sourceFile) {
  if (props.enableFileAttachment) {
    openAttachmentDialog(sourceFile)
    return
  }
  if (typeof props.bindings?.handleViewAttachments !== 'function') {
    return
  }
  props.bindings.handleViewAttachments(sourceFile)
}

defineExpose({
  openAttachmentDialog
})

/**
 * 获取合并附件按钮的 tooltip 文案
 * @param {Object|null} sourceFile 源文件对象
 * @returns {string} 提示文案
 */
function getAttachmentActionTitle(sourceFile) {
  const count = sourceFile && sourceFile.attachmentCount ? sourceFile.attachmentCount : 0
  if (count > 0) {
    return `附件 ${count} 个，点击查看/管理`
  }
  return '绑定附件'
}

/**
 * 是否在底部展示「选择文件」按钮
 * @returns {boolean} 编辑态且非只读时展示
 */
const showSelectFileButton = computed(() => {
  if (isPreviewMode.value || props.readonly) return false
  return props.layoutMode === 'full' || props.layoutMode === 'tree-select'
})

/**
 * 搜索框输入同步到 bindings
 * @param {Event} event - input 事件
 */
const handleSearchInput = (event) => {
  if (props.bindings?.searchKeyword) {
    props.bindings.searchKeyword.value = event.target.value
  }
}

/**
 * 选择文件弹窗：是否允许选未解析（bindings 优先，默认仅已解析）
 * @returns {boolean} 是否允许未解析
 */
const fileSelectAllowUnparsed = computed(() => {
  const fromBinding = props.bindings && props.bindings.allowUnparsed
  if (fromBinding && typeof fromBinding.value !== 'undefined') {
    return !!fromBinding.value
  }
  return props.allowUnparsed === true
})

/**
 * 选择文件弹窗：是否显示解析状态列
 * @returns {boolean} 是否显示
 */
const fileSelectShowParseStatus = computed(() => {
  const fromBinding = props.bindings && props.bindings.showParseStatus
  if (fromBinding && typeof fromBinding.value !== 'undefined') {
    return !!fromBinding.value
  }
  return props.showParseStatus !== false
})

/**
 * 选择文件弹窗：可选文件后缀
 * @returns {Array<string>} 后缀列表
 */
const fileSelectCanSelectFileType = computed(() => {
  const fromBinding = props.bindings && props.bindings.canSelectFileType
  if (fromBinding && Array.isArray(fromBinding.value)) {
    return fromBinding.value
  }
  return []
})

/** 是否隐藏底部默认批量执行 */
const hideBatchExecute = computed(() => {
  if (props.hideBatchExecute) return true
  return !!props.hideBatchActions
})

/** 是否展示 OCR 批量设置弹窗（仅 full 且父级提供 bindings） */
const showBatchSettingsDialog = computed(() => {
  if (props.layoutMode !== 'full' || isPreviewMode.value) return false
  const visible = props.bindings && props.bindings.batchSettingsDialogVisible
  return !!(visible && typeof visible.value !== 'undefined')
})

/** 是否展示批量执行弹窗（full / tree-select 且父级提供 bindings） */
const showBatchRecognizeDialog = computed(() => {
  if (isPreviewMode.value) return false
  if (props.layoutMode !== 'full' && props.layoutMode !== 'tree-select') return false
  const visible = props.bindings && props.bindings.batchRecognizeDialogVisible
  return !!(visible && typeof visible.value !== 'undefined')
})

/** 文件树重渲染 key（选择文件确认后递增，避免 el-tree-v2 patch 异常） */
const fileTreeRenderKey = computed(() => {
  const keyRef = props.bindings && props.bindings.fileTreeRenderKey
  return keyRef && keyRef.value != null ? keyRef.value : 0
})

/**
 * 文件选择弹窗确认（转发至 bindings，支持 async）。
 * 所有 viewer 共享的统一入口：无论 confirm handler 是 defaultOnFileSelectConfirm
 * 还是页面自实现，最后都会触发一次自动全选，避免用户回到侧栏再手动勾选。
 * @param {Array|Object} payload 选择结果
 * @returns {Promise<void>}
 */
const handleFileSelectConfirm = async (payload) => {
  const handler = props.bindings && props.bindings.onFileSelectConfirm
  if (typeof handler === 'function') {
    await handler(payload)
  }
  // 等下游 handler 把 enrichedFolders/files 写入 reactivity 后再勾选
  await nextTick()
  const selectAll = props.bindings && props.bindings.handleSelectAll
  if (typeof selectAll === 'function') {
    selectAll(true)
  }
}

/** full / tree-select 显示文件夹与文件勾选 */
const supportsTreeCheckboxes = computed(() => (
  props.layoutMode === 'full' || props.layoutMode === 'tree-select'
))

const flatPreviewFileNodes = computed(() => {
  const nodes = []
  const walk = (treeNodes) => {
    ;(treeNodes || []).forEach((node) => {
      if (!node) return
      if (node.nodeType === 'file') {
        nodes.push(node)
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children)
      }
    })
  }
  walk(props.bindings.fileTreeData.value || [])
  return nodes
})

const previewStatusStats = computed(() => {
  const stats = { total: 0, success: 0, failed: 0, running: 0 }
  flatPreviewFileNodes.value.forEach((node) => {
    stats.total += 1
    const status = getPreviewStatusKey(node)
    if (status === 'success') stats.success += 1
    else if (status === 'failed') stats.failed += 1
    else if (status === 'running') stats.running += 1
  })
  return stats
})

const displayTreeData = computed(() => {
  const statusMatched = (node) => getPreviewStatusKey(node) === previewStatusFilter.value
  const filterNode = (node) => {
    if (!node) return null
    if (node.nodeType === 'file') {
      return statusMatched(node) ? { ...node } : null
    }
    const children = (node.children || [])
      .map((child) => filterNode(child))
      .filter(Boolean)
    if (children.length === 0) {
      return null
    }
    return {
      ...node,
      children
    }
  }

  const sourceData = (!isPreviewMode.value || previewStatusFilter.value === 'all')
    ? (props.bindings.fileTreeData.value || [])
    : (props.bindings.fileTreeData.value || []).map((node) => filterNode(node)).filter(Boolean)

  // 根据"高级配置"中的附件合并开关，为主文件注入真实附件子节点
  const shouldShowAttachments = props.bindings && props.bindings.mergeAttachments === true
  const injectAttachments = (nodes) => {
    return (nodes || []).map(node => {
      if (shouldShowAttachments && node.nodeType === 'file' && node.sourceFile) {
        const attachments = node.sourceFile.attachments || []
        if (attachments.length === 0) {
          if (node.children && node.children.length > 0) {
            return { ...node, children: injectAttachments(node.children) }
          }
          return node
        }
        const attachmentNodes = attachments.map((att, index) => ({
          treeKey: `${node.treeKey}-att-${att.attachment_id || index}`,
          name: att.name || '未命名',
          nodeType: 'attachment',
          parentFileName: node.name,
          parentFileId: node.sourceFile?.file_id || node.treeKey,
          sourceAttachment: att
        }))
        return { ...node, children: attachmentNodes }
      }
      if (node.children && node.children.length > 0) {
        return { ...node, children: injectAttachments(node.children) }
      }
      return node
    })
  }

  return injectAttachments(sourceData)
})

const previewTaskName = computed(() => {
  const fromBinding = props.bindings.previewTaskName
  if (fromBinding && fromBinding.value !== undefined) {
    return fromBinding.value || '-'
  }
  return '-'
})

const canPreviewDownload = computed(() => (
  !!(props.bindings && typeof props.bindings.handleDownloadAllResults === 'function')
))

const previewDownloadLoading = computed(() => {
  const loadingRef = props.bindings && props.bindings.bulkExportLoading
  return !!(loadingRef && loadingRef.value)
})

const PREVIEW_DOWNLOAD_LABELS = {
  json: '下载为JSON（ZIP）',
  markdown: '下载为Markdown（ZIP）',
  xlsx: '下载为Excel（ZIP）'
}

/** 预览模式下载菜单项（bindings.previewDownloadFormats 可覆盖，如工程项目仅 Excel） */
const previewDownloadOptions = computed(() => {
  const fromBinding = props.bindings && props.bindings.previewDownloadFormats
  const formats = Array.isArray(fromBinding) && fromBinding.length
    ? fromBinding
    : ['json', 'markdown', 'xlsx']
  return formats.map((command) => ({
    command,
    label:
      (props.bindings && props.bindings.previewDownloadLabels && props.bindings.previewDownloadLabels[command])
      || (command === 'xlsx' && formats.length === 1 ? '批量导出 Excel（ZIP）' : null)
      || PREVIEW_DOWNLOAD_LABELS[command]
      || command
  }))
})

/**
 * 解析文件节点运行结果状态（成功/失败/执行中）
 * @param {Object} treeNode 树节点，需包含 sourceFile
 * @returns {string} 标准状态键 success/failed/running
 */
function getPreviewStatusKey(treeNode) {
  const src = treeNode && treeNode.sourceFile ? treeNode.sourceFile : {}
  const raw = src.execution_status ?? src.processing_status ?? src.task_status ?? src.status ?? src.execute_status
  const text = String(raw == null ? '' : raw).toLowerCase()
  if (['2', 'success', 'completed', 'done', 'finished', 'succeeded'].includes(text)) {
    return 'success'
  }
  if (['3', 'fail', 'failed', 'error', 'exception'].includes(text)) {
    return 'failed'
  }
  return 'running'
}

/**
 * 获取预览状态文案
 * @param {Object} treeNode 树节点，需包含 sourceFile
 * @returns {string} 状态文案
 */
function getPreviewStatusLabel(treeNode) {
  const key = getPreviewStatusKey(treeNode)
  if (key === 'success') return '已完成'
  if (key === 'failed') return '失败'
  return '执行中'
}

/**
 * 获取预览状态标签类型
 * @param {Object} treeNode 树节点，需包含 sourceFile
 * @returns {string} el-tag 类型
 */
function getPreviewStatusTagType(treeNode) {
  const key = getPreviewStatusKey(treeNode)
  if (key === 'success') return 'success'
  if (key === 'failed') return 'danger'
  return 'warning'
}

/**
 * 批量弹窗「设置模式」标签类型
 * @param {Object|null} settings 行 settings
 * @returns {string} el-tag type
 */
function getBatchSettingsModeTagType(settings) {
  if (!settings || !settings.configured) return 'info'
  if (settings.mode === 'prompt') return 'primary'
  if (settings.mode === 'engineering') return 'warning'
  if (settings.mode === 'riskPoint') return 'warning'
  return 'success'
}

/**
 * 批量弹窗「设置模式」文案
 * @param {Object|null} settings 行 settings
 * @returns {string} 模式文案
 */
function getBatchSettingsModeLabel(settings) {
  if (!settings || !settings.configured) return '未设置'
  if (settings.mode === 'prompt') return 'Prompt模式'
  if (settings.mode === 'engineering') return '提示词配置'
  if (settings.mode === 'riskPoint') return '风险点分析'
  return '字段模式'
}

/**
 * 批量弹窗「设置内容」摘要（工程项目等全局提示词）
 * @param {Object|null} settings 行 settings
 * @returns {string} 内容摘要
 */
function getBatchSettingsContentText(settings) {
  if (!settings || !settings.configured) return ''
  if (settings.mode === 'engineering') {
    if (settings.summaryText) return settings.summaryText
    const repeat = settings.engineering_repeat_project || {}
    const sub = settings.engineering_sub_project || {}
    const parts = []
    if (repeat.key || repeat.prompt) parts.push('重复项目已配置')
    if (sub.key || sub.prompt) parts.push('主子项目已配置')
    return parts.join('；') || '提示词已配置'
  }
  if (settings.mode === 'riskPoint') {
    return settings.summaryText || '-'
  }
  if (settings.mode === 'prompt') {
    return settings.prompt || '-'
  }
  if (settings.template) {
    const getName = props.bindings && props.bindings.getTemplateName
    const name = typeof getName === 'function' ? getName(settings.template) : settings.template
    return `模板：${name || settings.template}`
  }
  if (settings.fieldDefinitions && settings.fieldDefinitions.length > 0) {
    return `自定义字段：${settings.fieldDefinitions.map((f) => f.name || '未命名字段').filter(Boolean).join('、')}`
  }
  return '未配置'
}

/**
 * 处理预览模式下“下载全部结果”命令
 * @param {string} format 下载格式，支持 json/markdown/xlsx
 */
function handlePreviewDownloadCommand(format) {
  if (!canPreviewDownload.value) {
    return
  }
  props.bindings.handleDownloadAllResults(format)
}

/**
 * 根据模式控制树节点点击行为（预览模式可禁用文件夹点击）
 * @param {Object} treeNode 当前点击树节点，包含 nodeType/sourceFile/folderPath 等字段
 * @param {MouseEvent} event 点击事件对象
 */
function handleTreeNodeClickByMode(treeNode, event) {
  if (!treeNode) {
    return
  }
  // 附件节点不响应点击事件
  if (treeNode.nodeType === 'attachment') {
    return
  }
  if (
    isPreviewMode.value
    && treeNode.nodeType === 'folder'
    && props.allowFolderClickInPreview === false
  ) {
    return
  }
  if (props.bindings && typeof props.bindings.handleTreeNodeClick === 'function') {
    props.bindings.handleTreeNodeClick(treeNode, event)
  }
}

/**
 * 切换左侧组件模式（编辑/预览）
 */
function handleToggleMode() {
  currentMode.value = currentMode.value === 'preview' ? 'edit' : 'preview'
  emit('mode-change', currentMode.value)
}

/**
 * 重置“批量执行-确认”按钮加载状态
 * @param {void} _ 占位参数，无实际意义
 * @returns {void}
 */
function resetBatchExecuteConfirmLoading() {
  batchExecuteConfirmLoading.value = false
}

/**
 * 点击批量执行弹窗“取消”
 * @param {MouseEvent} clickEvent 取消按钮点击事件对象
 * @returns {void}
 */
function handleBatchRecognizeCancelClick(clickEvent) {
  void clickEvent
  resetBatchExecuteConfirmLoading()
  if (props.bindings && typeof props.bindings.handleBatchRecognizeCancel === 'function') {
    props.bindings.handleBatchRecognizeCancel()
  }
}

/**
 * 批量执行弹窗关闭时处理（右上角关闭/外部控制关闭）
 * @param {void} _ 占位参数，无实际意义
 * @returns {void}
 */
function handleBatchRecognizeDialogClose() {
  resetBatchExecuteConfirmLoading()
}

/**
 * 点击批量执行弹窗“确定”，设置按钮加载并防止重复点击
 * @param {MouseEvent} clickEvent 确认按钮点击事件对象
 * @returns {Promise<void>} 异步完成
 */
async function handleBatchExecuteConfirmClick(clickEvent) {
  void clickEvent
  if (batchExecuteConfirmLoading.value) {
    return
  }
  batchExecuteConfirmLoading.value = true
  try {
    if (props.bindings && typeof props.bindings.executeSwitch === 'function') {
      const runResult = props.bindings.executeSwitch()
      if (runResult && typeof runResult.then === 'function') {
        await runResult
      }
    }
  } catch (error) {
    console.error('批量执行触发失败:', error)
    resetBatchExecuteConfirmLoading()
    return
  }
  if (!props.bindings?.batchRecognizeDialogVisible?.value) {
    resetBatchExecuteConfirmLoading()
  }
}

/**
 * 预览模式下按 previewListConfig 拉取左侧文件树
 * @param {string} taskId 任务或分析 ID
 * @returns {Promise<void>}
 */
async function loadPreviewListByConfig(taskId) {
  const cfg = props.previewListConfig
  if (!cfg || typeof cfg.fetchList !== 'function' || !taskId) {
    return
  }
  const setter = props.bindings?.setPreviewFileTreeData
  if (typeof setter !== 'function') {
    return
  }
  previewListLoading.value = true
  try {
    const raw = await cfg.fetchList({ taskId })
    const tree = typeof cfg.mapToTree === 'function'
      ? cfg.mapToTree(raw, { taskId })
      : (Array.isArray(raw) ? raw : [])
    setter(tree)
  } catch (error) {
    console.error('[OcrLeftSidebar] 预览列表加载失败:', error)
    setter([])
  } finally {
    previewListLoading.value = false
  }
}

watch(
  () => [isPreviewMode.value, props.taskId, props.previewListConfig],
  ([previewMode, taskId]) => {
    if (!previewMode) {
      return
    }
    loadPreviewListByConfig(taskId)
  },
  { immediate: true }
)

watch(
  () => props.bindings?.batchRecognizeDialogVisible?.value,
  (dialogVisible) => {
    if (!dialogVisible) {
      resetBatchExecuteConfirmLoading()
    }
  }
)
</script>

<style scoped>
.left-header-actions {
  display: flex;
  align-items: center;
}

.left-header-actions > * + * {
  margin-left: 6px;
}

.left-sidebar {
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  background: var(--sd-canvas, #ffffff);
  border-right: 1px solid var(--sd-hairline, #e0e0e0);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow-y: auto;
  min-height: 0;
}

.ocr-column-head {
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
}

.file-header {
  margin-bottom: 0;
}

.file-header--compact {
  justify-content: flex-start;
}

.file-header-toolbar {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.file-header-toolbar > * + * {
  margin-left: 8px;
}

.file-header-toolbar .ocr-file-search {
  flex: 1;
  min-width: 0;
}

.file-preview-toggle-btn {
  flex-shrink: 0;
}

.left-header-actions {
  display: flex;
  align-items: center;
}

.left-header-actions > * + * {
  margin-left: 4px;
}

.ocr-select-files-btn {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--sd-primary, #195fb4);
  border: 1px solid var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
}

.ocr-select-files-btn:hover,
.ocr-select-files-btn:focus {
  color: var(--sd-primary-dark, #0f4a8c);
  border-color: var(--sd-primary-dark, #0f4a8c);
  background: var(--sd-primary-light, #e8f0f8);
}

.ocr-batch-execute-btn {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
}

.file-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.search-area {
  margin-bottom: 10px;
  padding: 0;
}

.ocr-file-search {
  width: 100%;
  max-width: none;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 0 10px 0 32px;
  box-sizing: border-box;
}

.ocr-file-search .sd-search-icon {
  left: 10px;
  margin-top: -7px;
  font-size: 14px;
}

.ocr-file-search .sd-search-input {
  height: 30px;
  line-height: 30px;
  font-size: 14px;
}

.file-list {
  position: relative;
  flex: 1;
  overflow: hidden;
  margin-bottom: 12px;
}

.file-list :deep(.el-tree) {
  width: 100%;
}

.file-list :deep(.el-vl__wrapper),
.file-list :deep(.el-tree-virtual-list) {
  width: 100%;
}

.file-list :deep(.el-tree-v2__node) {
  width: 100%;
  box-sizing: border-box;
}

.file-list :deep(.el-tree-v2__row) {
  width: 100% !important;
  box-sizing: border-box;
  padding-right: 6px;
}

.file-list :deep(.el-tree-node) {
  width: 100%;
  box-sizing: border-box;
}

.file-list :deep(.el-tree-node__content) {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding-right: 2px;
  overflow: hidden;
}

.file-list :deep(.el-tree-node__expand-icon.is-leaf) {
  width: 0;
  min-width: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  visibility: hidden;
}

.selected-count {
  font-size: 12px;
  color: #909399;
}

.file-tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 4px 0;
  border-radius: 0;
  cursor: pointer;
  box-sizing: border-box;
  color: var(--sd-ink-muted, #525252);
}

.file-tree-node--compact-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  align-items: center;
  padding-right: 0;
}

.file-tree-node-body {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.file-tree-node-body--compact {
  grid-column: 1;
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.file-tree-node-body--compact .file-tree-node-leading {
  flex: 1 1 0%;
  min-width: 0;
  overflow: hidden;
}

.file-tree-node-meta {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
}

.file-tree-node-meta > * + * {
  margin-left: 4px;
}

.file-tree-node-meta--compact {
  padding-left: 8px;
}

.file-tree-node-leading {
  display: flex;
  align-items: center;
  flex: 1 1 0%;
  min-width: 0;
  overflow: hidden;
}

.file-name-wrap {
  flex: 1 1 0%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.file-tree-node-leading :deep(.el-tooltip__trigger) {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
}

.file-tree-node.active {
  background: var(--sd-primary-light, #e8f0f8);
  color: var(--sd-primary, #195fb4);
}

:deep(.el-tree-v2__row:hover) .file-tree-node {
  background: var(--sd-surface-1, #f4f4f4);
}

.file-tree-node-leading .el-checkbox {
  margin-right: 8px;
}

.batch-actions-bar {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

.batch-actions-bar > * + * {
  margin-top: 8px;
}

.preview-result-filter {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.preview-result-filter > * + * {
  margin-left: 8px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}

.status-success {
  background: #67c23a;
}

.status-failed {
  background: #f56c6c;
}

.status-running {
  background: #e6a23c;
}

.file-icon {
  margin-right: 6px;
  font-size: 16px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--sd-ink-subtle, #8c8c8c);
}

.folder-icon {
  margin-right: 6px;
  font-size: 16px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--sd-primary, #195fb4);
}

.file-tree-node.active .file-icon,
.file-tree-node.active .folder-icon {
  color: var(--sd-primary, #195fb4);
}

.attachment-file-icon {
  margin-right: 6px;
  font-size: 14px;
  color: #909399;
}

.file-name {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: keep-all;
  text-align: left;
  box-sizing: border-box;
}

.settings-badge {
  flex-shrink: 0;
}

.settings-badge--inline {
  margin-left: 0;
}

.file-tree-node-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  width: 72px;
  min-width: 72px;
  box-sizing: border-box;
  padding-right: 4px;
  overflow: visible;
}

.file-tree-node--compact-actions .file-tree-node-actions {
  grid-column: 2;
}

.file-tree-node-actions > * + * {
  margin-left: 2px;
}

.attachment-action-slot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.node-action-btn {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.node-action-btn :deep(.el-icon) {
  font-size: 16px;
}

.attachment-merged-btn__badge {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  box-sizing: border-box;
  pointer-events: none;
  background: var(--sd-primary-light, #e8f0f8);
  color: var(--sd-primary, #195fb4);
  border: 1px solid var(--sd-primary, #195fb4);
}

.file-tree-node-legacy-btn {
  flex-shrink: 0;
}

.file-tree-node-body .file-tree-node-legacy-btn:first-of-type {
  margin-left: auto;
}

.file-tree-node-legacy-btn--delete {
  margin-left: 0;
}

.file-tree-node-legacy-btn--folder {
  margin-left: auto;
}

.attachment-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 1px 6px;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 10px;
  font-size: 11px;
  color: #409eff;
  cursor: default;
  flex-shrink: 0;
}

.preview-status-tag {
  flex-shrink: 0;
}

.preview-status-tag--inline {
  margin-left: 0;
}

.file-actions-bottom {
  width: 100%;
}

.file-actions-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.file-actions-row > * + * {
  margin-left: 8px;
}

.file-actions-row .ocr-footer-btn,
.file-actions-row :deep(.el-button) {
  flex: 1;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  box-sizing: border-box;
}

.attachment-loading {
  padding: 16px 0;
}

.attachment-empty {
  padding: 24px 0;
}

.attachment-table-wrap {
  width: 100%;
}

.attachment-name-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}

.attachment-name-cell > * + * {
  margin-left: 8px;
}

.attachment-icon {
  font-size: 16px;
  color: #909399;
  flex-shrink: 0;
}

.attachment-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-op-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.attachment-op-cell > * + * {
  margin-left: 8px;
}

.attachment-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.attachment-dialog-footer > * + * {
  margin-left: 12px;
}

.attachment-preview-body {
  min-height: 500px;
}

.image-preview-wrapper {
  min-height: 500px;
}

.preview-task-footer {
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
}

.task-meta-item {
  font-size: 12px;
  color: #606266;
  margin-bottom: 6px;
  word-break: break-all;
}

.task-meta-label {
  color: #909399;
}

.folder-selection-bar {
  margin-bottom: 8px;
}

.batch-recognize-dialog {
  .el-dialog__body {
    padding: 20px;
    max-height: 70vh;
    overflow-y: auto;
  }
}

.batch-recognize-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.batch-file-list {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  background: #fafbfc;
}

.batch-config-field .field-config-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
  line-height: 1.5;
  padding: 0 4px;
}
</style>
