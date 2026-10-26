<template>
  <div class="ocr-viewer">
    <div
      class="left-sidebar-shell resizable-left-sidebar"
      :style="{ width: leftSidebarWidth + 'px' }"
    >
      <OcrLeftSidebar
        ref="leftSidebarRef"
        :bindings="leftSidebarBindings"
        :mode="leftSidebarMode"
        :task-id="leftSidebarTaskId"
        :allow-mode-switch="false"
        compact-file-header
        layout-mode="full"
        enable-file-attachment
        merge-attachment-action
        truncate-file-name-by-css
        :preview-list-config="ocrPreviewListConfig"
        @mode-change="handleLeftSidebarModeChange"
        @attachment-change="handleAttachmentChange"
      />
    </div>
    <!-- 左侧与中间区域之间的宽度拖拽条（向右拖加宽左侧，向左拖收窄） -->
    <div
      class="resizer resizer-left"
      @mousedown="startLeftSidebarResize"
      title="拖拽调整宽度"
    >
      <el-icon class="resize-icon">
        <DArrowRight />
      </el-icon>
    </div>

    <!-- 原型：模拟批量进度（不调接口，仅本地定时器；仅开发环境挂载） -->
    <el-dialog
      v-if="mockBulkDevUiEnabled"
      v-model="mockBulkProgressVisible"
      width="560px"
      align-center
      destroy-on-close
      class="mock-bulk-progress-dialog"
      :show-close="true"
      title=""
      @closed="stopMockBulkProgressTimers"
    >
      <div class="mock-bulk-progress">
        <div class="mock-bulk-progress__header">
          <div class="mock-bulk-progress__title">
            <span class="mock-bulk-progress__title-text">
              {{ props.toolLabel }} [{{ mockBulkOpenTimeText }}] 执行中... {{ mockBulkElapsedText }}
            </span>
          </div>
          <el-tag
            :type="mockBulkOverallTagType"
            size="small"
            effect="plain"
          >
            {{ mockBulkOverallTagText }}
          </el-tag>
        </div>

        <div class="mock-bulk-progress__steps">
          <div
            v-for="row in mockBulkSimpleRows"
            :key="row.key"
            :class="['mock-bulk-row', `mock-bulk-row--${row.tone}`]"
          >
            <div class="mock-bulk-row__left">
              <el-icon v-if="row.tone === 'success'" class="mock-bulk-row__icon"><CircleCheck /></el-icon>
              <el-icon v-else-if="row.tone === 'running'" class="mock-bulk-row__icon is-loading"><Loading /></el-icon>
              <el-icon v-else class="mock-bulk-row__icon mock-bulk-row__icon--muted"><Clock /></el-icon>
              <span class="mock-bulk-row__label">{{ row.label }}</span>
            </div>
            <el-tag size="small" effect="plain" :type="row.tagType">{{ row.tagText }}</el-tag>
          </div>

          <div :class="['mock-bulk-row', 'mock-bulk-row--parent', `mock-bulk-row--${mockBulkParentTone}`]">
            <div class="mock-bulk-row__left">
              <el-icon v-if="mockBulkParentTone === 'success'" class="mock-bulk-row__icon"><CircleCheck /></el-icon>
              <el-icon v-else class="mock-bulk-row__icon is-loading"><Loading /></el-icon>
              <span class="mock-bulk-row__label">{{ props.toolLabel }}</span>
            </div>
            <div class="mock-bulk-row__right">
              <span v-if="mockBulkParentRatioText" class="mock-bulk-row__ratio">{{ mockBulkParentRatioText }}</span>
              <el-tag size="small" effect="plain" :type="mockBulkParentTagType">{{ mockBulkParentTagText }}</el-tag>
            </div>
          </div>

          <div class="mock-bulk-folder-shell">
            <el-collapse
              v-model="mockBulkActiveFolder"
              accordion
              class="mock-bulk-folder-collapse"
            >
              <el-collapse-item name="folder-a">
                <template #title>
                  <span class="mock-bulk-folder-title">
                    文件夹A / 合同资料
                    <span class="mock-bulk-folder-meta">{{ mockBulkFolderARatio }}</span>
                  </span>
                </template>
                <div class="mock-bulk-folder-body">
                  <div
                    v-for="f in mockBulkFilesFolderA"
                    :key="f.id"
                    :class="['mock-bulk-row', 'mock-bulk-row--child', `mock-bulk-row--${toneForMockStatus(f.status)}`]"
                  >
                    <div class="mock-bulk-row__left">
                      <el-icon v-if="f.status === 'done'" class="mock-bulk-row__icon"><CircleCheck /></el-icon>
                      <el-icon v-else-if="f.status === 'running'" class="mock-bulk-row__icon is-loading"><Loading /></el-icon>
                      <el-icon v-else class="mock-bulk-row__icon mock-bulk-row__icon--muted"><Clock /></el-icon>
                      <span class="mock-bulk-row__label">{{ f.name }}</span>
                    </div>
                    <el-tag size="small" effect="plain" :type="tagTypeForMockStatus(f.status)">{{ labelForMockStatus(f.status) }}</el-tag>
                  </div>
                </div>
              </el-collapse-item>

              <el-collapse-item name="folder-b">
                <template #title>
                  <span class="mock-bulk-folder-title">
                    文件夹B / 附件
                    <span class="mock-bulk-folder-meta">{{ mockBulkFolderBRatio }}</span>
                  </span>
                </template>
                <div class="mock-bulk-folder-body">
                  <div
                    v-for="f in mockBulkFilesFolderB"
                    :key="f.id"
                    :class="['mock-bulk-row', 'mock-bulk-row--child', `mock-bulk-row--${toneForMockStatus(f.status)}`]"
                  >
                    <div class="mock-bulk-row__left">
                      <el-icon v-if="f.status === 'done'" class="mock-bulk-row__icon"><CircleCheck /></el-icon>
                      <el-icon v-else-if="f.status === 'running'" class="mock-bulk-row__icon is-loading"><Loading /></el-icon>
                      <el-icon v-else class="mock-bulk-row__icon mock-bulk-row__icon--muted"><Clock /></el-icon>
                      <span class="mock-bulk-row__label">{{ f.name }}</span>
                    </div>
                    <el-tag size="small" effect="plain" :type="tagTypeForMockStatus(f.status)">{{ labelForMockStatus(f.status) }}</el-tag>
                  </div>
                </div>
              </el-collapse-item>

              <el-collapse-item name="loose">
                <template #title>
                  <span class="mock-bulk-folder-title">
                    零散文件（未归档）
                    <span class="mock-bulk-folder-meta">{{ mockBulkLooseRatio }}</span>
                  </span>
                </template>
                <div class="mock-bulk-folder-body">
                  <div
                    v-for="f in mockBulkFilesLoose"
                    :key="f.id"
                    :class="['mock-bulk-row', 'mock-bulk-row--child', `mock-bulk-row--${toneForMockStatus(f.status)}`]"
                  >
                    <div class="mock-bulk-row__left">
                      <el-icon v-if="f.status === 'done'" class="mock-bulk-row__icon"><CircleCheck /></el-icon>
                      <el-icon v-else-if="f.status === 'running'" class="mock-bulk-row__icon is-loading"><Loading /></el-icon>
                      <el-icon v-else class="mock-bulk-row__icon mock-bulk-row__icon--muted"><Clock /></el-icon>
                      <span class="mock-bulk-row__label">{{ f.name }}</span>
                    </div>
                    <el-tag size="small" effect="plain" :type="tagTypeForMockStatus(f.status)">{{ labelForMockStatus(f.status) }}</el-tag>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>

          <div :class="['mock-bulk-row', `mock-bulk-row--${mockBulkFinalTone}`]">
            <div class="mock-bulk-row__left">
              <el-icon v-if="mockBulkFinalTone === 'success'" class="mock-bulk-row__icon"><CircleCheck /></el-icon>
              <el-icon v-else-if="mockBulkFinalTone === 'running'" class="mock-bulk-row__icon is-loading"><Loading /></el-icon>
              <el-icon v-else class="mock-bulk-row__icon mock-bulk-row__icon--muted"><Clock /></el-icon>
              <span class="mock-bulk-row__label">完成</span>
            </div>
            <el-tag size="small" effect="plain" :type="mockBulkFinalTagType">{{ mockBulkFinalTagText }}</el-tag>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeMockBulkProgressDialog">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 中间文档查看器 -->
    <div v-show="showFilePreview" class="center-viewer">
      <!-- 顶部导航栏 -->
      <div v-if="!isFolderListPreviewMode" class="viewer-header ocr-column-head">
        <div class="page-controls">
          <el-button :icon="ZoomOut" circle size="small" @click="zoomOut" title="缩小" :disabled="pdfScale <= 0.5" />
          <el-button :icon="ZoomIn" circle size="small" @click="zoomIn" title="放大" :disabled="pdfScale >= 3" />
          <el-button :icon="FullScreen" circle size="small" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'" />
          <el-button :icon="Refresh" circle size="small" @click="refresh" />
          <el-button :icon="Download" circle size="small" @click="download" />
          <el-button v-if="currentHighlightedField" type="danger" size="small" @click="handleClearHighlight" plain>
            清除高亮
          </el-button>
        </div>
        <div class="viewer-header-actions">
          <el-button type="primary" :icon="List" size="small" @click="handleGoToTaskCenter">任务中心</el-button>
        </div>
      </div>
      <!-- 文档预览区域 -->
      <div class="document-area">
        <OcrFolderPreviewPanel
          v-if="isFolderListPreviewMode"
          :folder-name="currentFolderPreviewName"
          :display-total="folderPreviewDisplayTotal"
          :deleted-file-count="pendingDeleteRecords.files.length"
          :deleted-folder-count="pendingDeleteRecords.folders.length"
          :files="folderPreviewFilesEnriched"
          :loading="folderPreviewLoading"
          :is-remote="isCurrentFolderPreviewRemote"
          :total="folderPreviewTotal"
          :page-size="folderPreviewPageSize"
          :current-page="folderPreviewPage"
          :pending-delete-file-ids="pendingDeleteFileIds"
          @page-change="handleFolderPreviewPageChange"
          @delete-selected="handleDeleteSelectedFolderPreviewFiles"
          @restore-file="handleRestoreFolderPreviewFile"
          @view-file="handleViewFolderPreviewFile"
          @view-attachments="handleViewFolderPreviewAttachments"
        />
        <!-- PDF文档预览 -->
        <div v-else class="document-preview" ref="previewRef">
          <div v-if="currentFile && currentFile.type === 'pdf'" class="pdf-container-wrapper" ref="pdfContainerWrapperRef">
            <!-- Chrome 77 兼容模式：使用 iframe 预览 -->
            <div v-if="isOldChrome && pdfSource" class="pdf-container" style="width: 100%; height: 100%;">
              <iframe
                :src="pdfSource"
                style="width: 100%; height: 100%; border: none;"
                frameborder="0"
                @load="handlePdfRendered"
                @error="handlePdfError"
              />
            </div>
            <!-- 正常模式：使用 vue-office-pdf -->
            <div v-else v-loading="pdfLoading" class="pdf-container" :style="{ transform: `scale(${pdfScale})`, transformOrigin: 'top center' }">
              <vue-office-pdf
                v-if="pdfSource"
                :key="`pdf-${pdfSource}-${currentFile?.fileId || ''}`"
                ref="pdfViewerRef"
                :src="pdfSource"
                @rendered="handlePdfRendered"
                style="height: 100%; width: 100%"
                @error="handlePdfError"
              />
              <div v-else-if="pdfLoading" class="loading-container">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <p>正在加载PDF文档...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="请选择PDF文件" />
              </div>
            </div>
          </div>
          <div v-else-if="currentFile && (currentFile.type === 'docx' || currentFile.type === 'doc')" class="docx-container-wrapper">
            <div v-loading="docxLoading" class="docx-container">
              <!-- DOCX文件或DOC转换后的文件使用vue-office-docx -->
              <vue-office-docx
                v-if="docxSource && (currentFile.type === 'docx' || (currentFile.type === 'doc' && docxSource))"
                :src="docxSource"
                style="width: 100%; height: 100%;"
                @error="handleDocxError"
              />
              <!-- DOC文件使用Microsoft Office Online Viewer -->
              <iframe
                v-else-if="currentFile.type === 'doc' && docPreviewUrl && !docxSource"
                :src="docPreviewUrl"
                class="doc-preview-iframe"
                style="width: 100%; height: 100%; border: none;"
                frameborder="0"
              />
              <div
                v-else-if="currentFile.type === 'doc' && !docPreviewUrl && !docxSource"
                ref="docPreviewContainerRef"
                class="docx-preview-container"
                style="width: 100%; height: 100%; overflow: auto; padding: 20px; background: #fff;"
              />
              <div v-else-if="docxLoading" class="loading-container">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <p>正在加载Word文档...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="请选择Word文件" />
              </div>
            </div>
          </div>
          <!-- Excel文档预览 -->
          <div v-else-if="currentFile && (currentFile.type === 'xlsx' || currentFile.type === 'xlsm' || currentFile.type === 'xls')" class="excel-container-wrapper">
            <div v-loading="excelLoading" class="excel-container">
              <vue-office-excel
                v-if="excelSource"
                :src="excelSource"
                style="width: 100%; height: 100%;"
                :options="{ xls: true }"
                @error="handleExcelError"
              />
              <div v-else-if="excelLoading" class="loading-container">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <p>正在加载Excel文档...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="请选择Excel文件" />
              </div>
            </div>
          </div>
          <!-- CSV文件预览 -->
          <div v-else-if="currentFile && currentFile.type === 'csv'" class="csv-container-wrapper">
            <div v-loading="csvLoading" class="csv-container">
              <div v-if="csvData.length > 0" class="csv-preview">
                <el-table :data="csvData" max-height="100%" style="width: 100%">
                  <el-table-column
                    v-for="(col, index) in csvColumns"
                    :key="index"
                    :prop="col.prop"
                    :label="col.label"
                    :min-width="col.minWidth"
                    show-overflow-tooltip
                  />
                </el-table>
              </div>
              <div v-else-if="csvLoading" class="loading-container">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <p>正在加载CSV文件...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="请选择CSV文件" />
              </div>
            </div>
          </div>
          <!-- 文本文件预览 -->
          <div v-else-if="currentFile && currentFile.type === 'txt'" class="txt-container-wrapper">
            <div v-loading="txtLoading" class="txt-container">
              <pre v-if="txtContent" class="text-preview">{{ txtContent }}</pre>
              <div v-else-if="txtLoading" class="loading-container">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <p>正在加载文本文件...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="请选择文本文件" />
              </div>
            </div>
          </div>
          <!-- 图片预览 -->
          <div v-else-if="currentFile && currentFile.type === 'image' && currentFile.previewUrl" class="image-preview">
            <el-image
              :src="currentFile.previewUrl"
              :preview-src-list="[currentFile.previewUrl]"
              fit="contain"
              style="width: 100%; height: 100%;"
            />
          </div>
          <div v-else class="empty-preview">
            <el-empty description="请选择文件进行预览">
              <el-icon class="empty-icon" :size="80" color="#c0c4cc"><Document /></el-icon>
            </el-empty>
          </div>
        </div>

      </div>
    </div>

    <!-- 可调整宽度的分隔线（两个标签页都显示，文件预览显示时显示） -->
    <div
      v-show="showFilePreview"
      class="resizer"
      @mousedown="startResize"
      title="拖拽调整宽度"
    >
      <el-icon class="resize-icon">
        <DArrowLeft />
      </el-icon>
    </div>

    <!-- 右侧面板 -->
    <!-- 解析结果：显示提取结果和定位 -->
    <div
      class="right-sidebar resizable-sidebar"
      :class="{ 'right-sidebar-fullwidth': !showFilePreview }"
      v-show="viewerTab === 'parse'"
      :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
    >
      <!-- 标签页 -->
      <div class="sidebar-tabs ocr-column-head">
        <el-tabs v-model="viewerTab" @tab-change="handleTabChange">
          <el-tab-pane label="解析结果" name="parse"></el-tab-pane>
          <el-tab-pane label="功能配置" name="extract"></el-tab-pane>
        </el-tabs>
      </div>

      <div class="extraction-results">
        <div class="extraction-results-main">
          <div class="results-header">
            <h3>提取结果 ({{ extractionResults.length }}项)</h3>
            <div class="header-actions">
              <el-dropdown
                v-if="extractionResults && extractionResults.length > 0"
                @command="handleExportResults"
              >
                <el-button size="small" type="primary" :icon="Download">
                  导出结果
                  <el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="excel">导出为Excel</el-dropdown-item>
                    <el-dropdown-item command="csv">导出为CSV</el-dropdown-item>
                    <el-dropdown-item command="markdown">导出为Markdown</el-dropdown-item>
                    <el-dropdown-item command="json">导出为JSON</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button
                v-else
                size="small"
                type="primary"
                :icon="Download"
                disabled
              >
                导出结果
              </el-button>
              <!-- <el-button size="small" type="danger" plain @click="handleClearHighlight" :icon="Delete">
              清除定位样式
            </el-button> -->
            </div>
          </div>

          <div class="results-list">
          <div
            v-for="(item, index) in extractionResults"
            :key="item.id || index"
            :class="[
              'result-item',
              { 'highlighted': currentHighlightedField === item.name }
            ]"
            @click="handleLocateField(item)"
          >
            <div class="result-content">
              <!-- 字段名称和状态 -->
              <div class="result-header">
                <div class="result-field-name">
                  {{ item.name }}
                </div>
                <div class="result-status">
                  <el-tag
                    :type="getStatusTagType(item.isFound !== undefined ? (item.isFound ? 'success' : 'warning') : item.status)"
                    size="small"
                  >
                    {{ getStatusText(item.isFound !== undefined ? (item.isFound ? 'success' : 'warning') : item.status) }}
                  </el-tag>
                </div>
              </div>

              <!-- 提取结果值 -->
              <div class="result-value">
                <span>{{ item.fieldValue || '暂无' }}</span>
              </div>

              <!-- 证据信息（如果有） -->
              <div v-if="item.evidence" class="result-evidence" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e4e7ed;">
                <div style="font-size: 12px; color: #909399; margin-bottom: 4px;">证据：</div>
                <div style="font-size: 12px; color: #606266; line-height: 1.5;">{{ item.evidence }}</div>
              </div>

              <!-- 证据信息（如果有） -->
              <div v-if="item.evidence" class="result-evidence" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e4e7ed;">
                <div style="font-size: 12px; color: #909399; margin-bottom: 4px;">证据：</div>
                <div style="font-size: 12px; color: #606266; line-height: 1.5;">{{ item.evidence }}</div>
              </div>

              <!-- 置信度和定位按钮 -->
              <div class="result-metrics">
                <div class="result-confidence">
                  <el-progress
                    :percentage="item.confidence"
                    :stroke-width="6"
                    :show-text="false"
                    :color="getConfidenceColor(item.confidence)"
                  />
                  <span class="result-confidence-text">
                    {{ Math.round(item.confidence) }}%
                  </span>
                </div>

                <!-- 定位按钮 -->
                <!-- <el-button
                  size="small"
                  type="primary"
                  :loading="locating && currentLocatingField === item.name"
                  :disabled="!item.fieldValue || item.fieldValue.trim() === ''"
                  @click.stop="handleLocateField(item)"
                  :title="!item.fieldValue || item.fieldValue.trim() === '' ? '该字段无有效提取值，无法定位原文' : '点击定位原文'"
                >
                  <el-icon><Location /></el-icon>
                  定位原文
                </el-button> -->
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <el-empty
            v-if="extractionResults.length === 0"
            description="暂无提取结果"
            :image-size="100"
          />
        </div>
        </div>
      </div>
    </div>

    <!-- 功能配置：显示字段模式配置 -->
    <div
      class="right-sidebar resizable-sidebar"
      :class="{ 'right-sidebar-fullwidth': !showFilePreview }"
      v-show="viewerTab === 'extract'"
      :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
    >
      <!-- 配置区域（整体滚动，底部添加字段固定） -->
      <div class="config-container">
        <!-- 高级配置：附件合并与切片参数 -->
        <div class="config-section-block extract-advanced-config-wrapper">
          <div class="config-section-title">高级配置</div>
          <div class="extract-advanced-config">
            <el-form label-position="top" size="small" class="extract-advanced-form">
              <el-form-item label="附件内容合并到主文件" class="extract-advanced-form-item">
                <el-switch
                  v-model="mergeAttachments"
                  active-text="是"
                  inactive-text="否"
                  :disabled="isReadOnly || extracting"
                />
                <div class="config-hint">
                  开启后，信息提取时将主文件与所有附件内容合并成一个整体进行抽取
                </div>
              </el-form-item>

              <el-form-item label="切片字数" class="extract-advanced-form-item">
                <el-input-number
                  v-model="chunkSize"
                  :min="1000"
                  :max="maxChunkSizeLimit"
                  :step="1000"
                  :disabled="isReadOnly || extracting"
                  class="extract-advanced-number"
                />
                <div class="config-hint">建议 10000 ~ 30000</div>
              </el-form-item>

              <el-form-item label="冗余字数" class="extract-advanced-form-item">
                <el-input-number
                  v-model="chunkOverlap"
                  :min="0"
                  :max="5000"
                  :step="100"
                  :disabled="isReadOnly || extracting"
                  class="extract-advanced-number"
                />
                <div class="config-hint">相邻切片间的重叠字数</div>
              </el-form-item>
            </el-form>
          </div>
        </div>

        <!-- 选择模板（位于高级配置与抽取配置之间） -->
        <div class="config-section-block template-select-section">
          <div class="config-section-title">选择模板</div>
          <el-select
            v-model="selectedTemplate"
            placeholder="选择模板"
            size="default"
            :disabled="isReadOnly || extracting"
            @change="handleTemplateChange"
            @visible-change="handleTemplateSelectVisible"
            filterable
            :loading="templateLoading"
            @focus="handleTemplateSelectFocus"
            class="template-select-control"
            popper-class="template-select-dropdown"
            ref="templateSelectRef"
          >
            <template #prefix>
              <el-icon><Document /></el-icon>
            </template>
            <el-option
              v-for="template in templateOptions"
              :key="template.value"
              :label="template.label"
              :value="template.value"
            />
            <el-option
              label="➕ 新增模板"
              value="__add_template__"
              class="add-template-option floating-add-option"
            />
          </el-select>
        </div>

        <!-- 字段模式 -->
        <div class="config-section-block config-fields-panel">
          <div class="field-config-header">
            <div class="config-section-title field-config-title">
              <span>抽取配置</span>
              <el-icon v-if="!isReadOnly" class="edit-icon" @click="handleEditConfig"><Edit /></el-icon>
            </div>
            <div class="field-config-actions" v-show="!extracting">
              <el-button size="small" @click="handleExportConfig" :disabled="isReadOnly || !isTemplateSelected">导出配置</el-button>
              <el-button size="small" @click="handleDeleteTemplate" :disabled="isReadOnly || !isTemplateSelected">删除模板</el-button>
              <el-button size="small" type="primary" @click="handleSaveTemplate" :disabled="isReadOnly || !isTemplateSelected">存为模板</el-button>
            </div>
          </div>

          <div class="field-config-body">
            <div class="field-config-desc">
              通过添加字段并配置其名称、类型和描述来构建您的抽取规则,模型将按照您的抽取规则进行抽取。
            </div>

            <!-- 字段定义列表 -->
            <div class="field-definition-list">
              <!-- 已有字段列表 -->
              <div v-for="(field, index) in fieldDefinitions" :key="field.id" class="field-item">
              <div class="field-item-content">
                <div class="field-row">
                  <div class="field-label-col">
                    <span class="field-required-mark">*</span>
                    <span class="field-label-text">字段名称</span>
                  </div>
                  <el-input
                    v-model="field.name"
                    placeholder="请输入字段名称"
                    size="small"
                    class="field-input"
                    :disabled="isReadOnly || extracting"
                  />
                </div>
                <div class="field-row">
                  <div class="field-label-col">
                    <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
                    <span class="field-label-text">字段描述</span>
                  </div>
                  <el-input
                    v-model="field.description"
                    placeholder="对要抽取的字段进行描述"
                    size="small"
                    class="field-input"
                    :disabled="isReadOnly || extracting"
                  />
                </div>
              </div>
              <div class="field-item-action" v-show="!extracting">
                <el-button
                  type="danger"
                  size="small"
                  :icon="Delete"
                  @click="handleRemoveField(index)"
                  :disabled="isReadOnly"
                >
                  删除
                </el-button>
              </div>
            </div>

            <!-- 新增字段 -->
            <div class="field-item field-item-new" v-show="!extracting">
              <div class="field-item-content">
                <div class="field-row">
                  <div class="field-label-col">
                    <span class="field-required-mark">*</span>
                    <span class="field-label-text">字段名称</span>
                  </div>
                  <el-input
                    v-model="newField.name"
                    placeholder="请输入字段名称"
                    size="small"
                    class="field-input"
                    @keyup.enter="handleAddField"
                    :disabled="isReadOnly"
                  />
                </div>
                <div class="field-row">
                  <div class="field-label-col">
                    <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
                    <span class="field-label-text">字段描述</span>
                  </div>
                  <el-input
                    v-model="newField.description"
                    placeholder="对要抽取的字段进行描述"
                    size="small"
                    class="field-input"
                    @keyup.enter="handleAddField"
                    :disabled="isReadOnly"
                  />
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

      </div>

      <div v-show="!extracting" class="ocr-sidebar-footer config-add-field-bottom">
        <el-button class="ocr-select-files-btn ocr-footer-btn" @click="handleAddField" :disabled="isReadOnly">
          <el-icon><Plus /></el-icon>
          添加字段
        </el-button>
      </div>
    </div>
  </div>

  <!-- 文件上传组件（隐藏） -->
  <el-upload
    ref="uploadRef"
    class="hidden-upload"
    :auto-upload="false"
    :show-file-list="false"
    :on-change="handleFileChange"
    :before-upload="beforeUpload"
    multiple
    accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp"
  >
  </el-upload>

</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { useHomeStore } from '@/stores/home'

// 定义 props，支持从父组件传递参数
const props = defineProps({
  tool: {
    type: String,
    default: ''
  },
  files: {
    type: String,
    default: ''
  },
  names: {
    type: String,
    default: ''
  },
  eventKey: {
    type: String,
    default: ''
  },
  toolLabel: {
    type: String,
    default: '非结构化信息提取'
  }
})

const emit = defineEmits(['close-dialog'])

/** 组件是否仍挂载（关闭弹窗后迟到的批量创建响应不再触发父级轮询） */
const isViewerActive = ref(false)
/** 批量创建请求是否已作废（卸载/关弹窗后忽略迟到的 BatchExecuteByFilter 响应） */
let batchExecuteAborted = false
/** 当前进行中的 BatchExecuteByFilter 取消控制器 */
let activeBatchExecuteAbortController = null

/**
 * 作废进行中的 BatchExecuteByFilter 并通知父级停止轮询
 * @returns {void}
 */
const invalidateBatchExecute = () => {
  batchExecuteAborted = true
  isViewerActive.value = false
  if (activeBatchExecuteAbortController) {
    try {
      activeBatchExecuteAbortController.abort()
    } catch (e) {
      /* ignore */
    }
    activeBatchExecuteAbortController = null
  }
  emitFileManagerProgressStop()
}
import VueOfficePdf from '@vue-office/pdf'
import VueOfficeDocx from '@vue-office/docx'
import VueOfficeExcel from '@vue-office/excel'
import { renderAsync } from 'docx-preview'
import { DirectPDFStyleLocatorService } from '@/views/DemoAudit/contract-analysis-assistant-vue/components/OcrPosition/directPDFStyleLocatorService.js'
import { convertDocToDocxAPI, convertXlsToXlsxAPI, previewFileAPI, getPreviewFileAPI, getFileListAPI } from '@/api/fileManager.js'
import { batchLoadFileAttachmentsMap } from '@/views/file-manager-code/composables/batchLoadFileAttachments.js'
import { getPublicAndPrivateTemplatesAPI, getTemplateDetailAPI, exportTemplateConfigAPI, updateTemplateAPI, deleteTemplateAPI } from '@/api/template.js'
import { getTaskSchedulesAPI, batchExecuteByFilterAPI } from '@/api/task.js'
import { getDictItemsByCodeAPI } from '@/api/dict.js'
import { eventBus } from '@/utils/eventBus.js'
import { emitFileManagerProgressStop } from '@/views/file-manager-code/utils/fileManagerTaskProgressEvents.js'
import { buildToolBatchExecutePayload } from './composables/buildToolBatchExecutePayload.js'
import {
  runBatchExecuteWithTimeoutNav,
  openTaskCenterWithRefresh
} from './composables/batchExecuteTimeoutNav.js'
import { exportFn } from '@/utils/excel/export.js'
import OcrLeftSidebar from './components/OcrLeftSidebar.vue'
import OcrFolderPreviewPanel from './components/OcrFolderPreviewPanel.vue'
import {
  buildFolderFileListQueryParams,
  filterFilesByParsePolicy
} from './composables/ocrLeftSidebarTreeUtils.js'
import {
  Search,
  Document,
  Folder,
  Check,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ZoomIn,
  ZoomOut,
  FullScreen,
  Refresh,
  Download,
  Edit,
  Crop,
  DataLine,
  Loading,
  Delete,
  Plus,
  DArrowLeft,
  DArrowRight,
  List,
  Hide,
  View,
  CircleCheck,
  Clock
} from '@element-plus/icons-vue'

defineOptions({
  name: 'OcrViewer',
})

const route = useRoute()
const router = useRouter()
const homeStore = useHomeStore()


// 搜索关键词
const searchKeyword = ref('')

// 控制文件预览显隐
const showFilePreview = ref(true)

/** 仅开发环境展示「模拟进度」原型，避免生产构建带调试入口 */
const mockBulkDevUiEnabled = import.meta.env.DEV

/** 原型：模拟批量进度（不调接口） */
const MOCK_BULK_TICK_MS = 3000
const mockBulkProgressVisible = ref(false)
const mockBulkOpenTimeText = ref('')
const mockBulkElapsedSeconds = ref(0)
const mockBulkElapsedText = computed(() => `${mockBulkElapsedSeconds.value.toFixed(1)}s`)
let mockBulkTickTimer = null
let mockBulkElapsedTimer = null

const mockBulkFilePipeline = ref([])
const mockBulkActiveFolder = ref('folder-a')
const mockBulkFinishRowStarted = ref(false)
const mockBulkFinishRowDone = ref(false)

const mockBulkSimpleRows = computed(() => [
  { key: 'create', label: '创建任务', tone: 'success', tagText: '已完成', tagType: 'success' },
  { key: 'queue', label: '入队分发', tone: 'success', tagText: '已完成', tagType: 'success' }
])

const mockBulkFilesFolderA = computed(() =>
  mockBulkFilePipeline.value.filter((f) => f.folderKey === 'folder-a')
)
const mockBulkFilesFolderB = computed(() =>
  mockBulkFilePipeline.value.filter((f) => f.folderKey === 'folder-b')
)
const mockBulkFilesLoose = computed(() =>
  mockBulkFilePipeline.value.filter((f) => f.folderKey === 'loose')
)

const folderRatioText = (list) => {
  if (!list.length) return '0/0'
  const done = list.filter((f) => f.status === 'done').length
  return `${done}/${list.length}`
}

const mockBulkFolderARatio = computed(() => folderRatioText(mockBulkFilesFolderA.value))
const mockBulkFolderBRatio = computed(() => folderRatioText(mockBulkFilesFolderB.value))
const mockBulkLooseRatio = computed(() => folderRatioText(mockBulkFilesLoose.value))

const mockBulkParentRatioText = computed(() => {
  const list = mockBulkFilePipeline.value
  if (!list.length) return ''
  const done = list.filter((f) => f.status === 'done').length
  return `${done}/${list.length}`
})

const mockBulkParentTone = computed(() => {
  const list = mockBulkFilePipeline.value
  if (!list.length) return 'pending'
  return list.every((f) => f.status === 'done') ? 'success' : 'running'
})

const mockBulkParentTagText = computed(() =>
  mockBulkParentTone.value === 'success' ? '已完成' : '进行中'
)
const mockBulkParentTagType = computed(() =>
  mockBulkParentTone.value === 'success' ? 'success' : 'primary'
)

const mockBulkFinalTone = computed(() => {
  if (mockBulkFinishRowDone.value) return 'success'
  if (mockBulkFinishRowStarted.value) return 'running'
  return 'pending'
})
const mockBulkFinalTagText = computed(() => {
  if (mockBulkFinalTone.value === 'success') return '已完成'
  if (mockBulkFinalTone.value === 'running') return '进行中'
  return '待开始'
})
const mockBulkFinalTagType = computed(() => {
  if (mockBulkFinalTone.value === 'success') return 'success'
  if (mockBulkFinalTone.value === 'running') return 'primary'
  return 'info'
})

const mockBulkOverallTagText = computed(() =>
  mockBulkFinishRowDone.value ? '已完成' : '进行中'
)
const mockBulkOverallTagType = computed(() =>
  mockBulkFinishRowDone.value ? 'success' : 'primary'
)

const toneForMockStatus = (status) => {
  if (status === 'done') return 'success'
  if (status === 'running') return 'running'
  return 'pending'
}

const labelForMockStatus = (status) => {
  if (status === 'done') return '已完成'
  if (status === 'running') return '进行中'
  return '待开始'
}

const tagTypeForMockStatus = (status) => {
  if (status === 'done') return 'success'
  if (status === 'running') return 'primary'
  return 'info'
}

const formatMockBulkOpenTime = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const resetMockBulkPipeline = () => {
  mockBulkFilePipeline.value = [
    { id: 'f1', folderKey: 'folder-a', name: '人工智能.pdf', status: 'running' },
    { id: 'f2', folderKey: 'folder-a', name: '人工智能2.pdf', status: 'pending' },
    { id: 'f3', folderKey: 'folder-b', name: '附件-说明.docx', status: 'pending' },
    {
      id: 'f4',
      folderKey: 'loose',
      name: '零散报价单-用于原型演示的文件名略长.xlsx',
      status: 'pending'
    }
  ]
  mockBulkFinishRowStarted.value = false
  mockBulkFinishRowDone.value = false
  mockBulkActiveFolder.value = 'folder-a'
}

const stopMockBulkProgressTimers = () => {
  if (mockBulkTickTimer) {
    clearInterval(mockBulkTickTimer)
    mockBulkTickTimer = null
  }
  if (mockBulkElapsedTimer) {
    clearInterval(mockBulkElapsedTimer)
    mockBulkElapsedTimer = null
  }
}

const advanceMockBulkProgress = () => {
  if (!mockBulkProgressVisible.value) return
  const list = mockBulkFilePipeline.value
  const runningIdx = list.findIndex((f) => f.status === 'running')
  if (runningIdx >= 0) {
    list[runningIdx].status = 'done'
    const next = list.find((f) => f.status === 'pending')
    if (next) {
      next.status = 'running'
      mockBulkActiveFolder.value = next.folderKey
    }
    mockBulkFilePipeline.value = [...list]
    return
  }
  if (!mockBulkFinishRowStarted.value) {
    const allDone = list.length > 0 && list.every((f) => f.status === 'done')
    if (allDone) {
      mockBulkFinishRowStarted.value = true
    }
    return
  }
  if (mockBulkFinishRowStarted.value && !mockBulkFinishRowDone.value) {
    mockBulkFinishRowDone.value = true
    stopMockBulkProgressTimers()
  }
}

const openMockBulkProgressDialog = () => {
  if (!mockBulkDevUiEnabled) return
  stopMockBulkProgressTimers()
  resetMockBulkPipeline()
  mockBulkOpenTimeText.value = formatMockBulkOpenTime()
  mockBulkElapsedSeconds.value = 0
  mockBulkProgressVisible.value = true
  mockBulkElapsedTimer = setInterval(() => {
    mockBulkElapsedSeconds.value += 0.1
  }, 100)
  mockBulkTickTimer = setInterval(advanceMockBulkProgress, MOCK_BULK_TICK_MS)
}

const closeMockBulkProgressDialog = () => {
  mockBulkProgressVisible.value = false
  stopMockBulkProgressTimers()
}

// 文件列表
const fileList = ref([
  // { id: 1, name: '审计报告2024年度.pdf', type: 'pdf', previewUrl: '/审计报告2024年度.pdf', jsonUrl: '', selected: false },
  // { id: 2, name: '9-(OCR).pdf', type: 'pdf', previewUrl: '/9-(OCR).pdf', jsonUrl: '/9-(OCR).json', selected: false },
  // { id: 3, name: '演示合同.pdf', type: 'pdf', previewUrl: '/演示合同.pdf', jsonUrl: '', selected: false },
  // { id: 4, name: '项目预算方案.docx', type: 'docx', previewUrl: '/项目预算方案.docx', jsonUrl: '/项目预算方案.json', selected: false },
  // { id: 11, name: '演示文档.doc', type: 'doc', previewUrl: '/演示文档.doc', jsonUrl: '', selected: false },
  // { id: 5, name: '审计报告2023年度.pdf', type: 'pdf', previewUrl: '', selected: false },
  // { id: 6, name: '审计底稿-财务数据.pdf', type: 'pdf', previewUrl: '', selected: false },
  // { id: 7, name: '审计工作底稿.pdf', type: 'pdf', previewUrl: '', selected: false },
  // { id: 8, name: '审计计划书.pdf', type: 'pdf', previewUrl: '', selected: false },
  // { id: 9, name: '审计意见书.pdf', type: 'pdf', previewUrl: '', selected: false },
  // { id: 10, name: '审计证据资料.jpg', type: 'image', previewUrl: '', selected: false }
])

// 选中的文件ID列表
const selectedFiles = ref([])

// 过滤后的文件列表
const filteredFileList = computed(() => {
  if (!searchKeyword.value.trim()) {
    return fileList.value
  }
  const keyword = searchKeyword.value.trim().toLowerCase()
  return fileList.value.filter(file =>
    file.name.toLowerCase().includes(keyword)
  )
})

const currentFolderPreviewPath = ref('')
const currentFolderPreviewName = ref('')
/** 文件夹点击后接口返回的文件列表（中间区域展示） */
const currentFolderPreviewRemoteFiles = ref([])
/** 当前文件夹列表是否来自接口 */
const isCurrentFolderPreviewRemote = ref(false)
/** 文件夹列表接口加载状态 */
const folderPreviewLoading = ref(false)
/** 当前文件夹分页：当前页（后端从1开始） */
const folderPreviewPage = ref(1)
/** 当前文件夹分页：每页大小（接口单页上限 100） */
const folderPreviewPageSize = ref(100)
/** 当前文件夹分页：总条数 */
const folderPreviewTotal = ref(0)
/** 当前文件夹的 folder_id（用于翻页请求） */
const currentFolderPreviewFolderId = ref('')
const checkedFolderPaths = ref([])
const retainedEmptyFolderPaths = ref([])
/** 已为 SELF_AND_DESC 从 treeData 合并 children 的文件夹行数据，供左侧树展示子目录结构 */
const fileSelectEnrichedFolders = ref([])
const pendingDeleteRecords = ref({
  files: [],
  folders: []
})

/** 空间根节点路径（仅用于左侧树显示过滤，不作为真实业务文件夹） */
const VIRTUAL_SPACE_ROOT_PATHS = new Set(['个人空间', '公共空间', '根目录'])

const fileTreeProps = {
  value: 'treeKey',
  label: 'name',
  children: 'children'
}

const TREE_NAME_MAX_LENGTH = 24

/**
 * 获取文件所在目录路径
 * @param {Object} file 文件对象，可能包含 folderPath/path/directory 字段
 * @returns {string} 标准化目录路径，空字符串表示在根目录
 */
const getFileFolderPath = (file) => {
  if (!file) return ''
  const rawPath = file.folderPath || file.path || file.directory || ''
  return String(rawPath).replace(/\s*\/\s*/g, '/').replace(/^\/+|\/+$/g, '')
}

/**
 * 获取指定文件夹路径的父级路径列表
 * @param {string} folderPath 文件夹完整路径，如 a/b/c
 * @returns {Array<string>} 父级路径数组，如 [a, a/b]
 */
const getAncestorFolderPaths = (folderPath) => {
  const parts = String(folderPath || '').split('/').filter(Boolean)
  if (parts.length <= 1) {
    return []
  }
  const ancestors = []
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('/'))
  }
  return ancestors
}

/**
 * 从空节点保留集合中移除被删除的路径及其子路径
 * @param {Array<string>} deletedFolderPaths 删除的文件夹路径数组
 */
const clearRetainedFoldersByDeletedPaths = (deletedFolderPaths) => {
  const deletedSet = new Set((deletedFolderPaths || []).filter(Boolean))
  retainedEmptyFolderPaths.value = retainedEmptyFolderPaths.value.filter((path) => {
    return !Array.from(deletedSet).some(deletedPath => path === deletedPath || path.startsWith(`${deletedPath}/`))
  })
}

/**
 * 按文件列表保留其父级文件夹路径
 * @param {Array} files 文件对象数组，元素需包含 folderPath/path/directory 字段
 */
const retainAncestorFoldersByFiles = (files) => {
  if (!files || files.length === 0) {
    return
  }
  const retainedSet = new Set(retainedEmptyFolderPaths.value)
  files.forEach((file) => {
    const filePath = getFileFolderPath(file)
    getAncestorFolderPaths(filePath).forEach((path) => {
      if (!isVirtualSpaceRootPath(path)) {
        retainedSet.add(path)
      }
    })
  })
  retainedEmptyFolderPaths.value = Array.from(retainedSet)
}

/**
 * 规范化文件夹路径字符串，统一斜杠与空白（与 FileSelectDialog 的 folder_path 对齐）
 * @param {string} path 原始路径，可能含 " / " 分隔
 * @returns {string} 规范化后的路径
 */
function normalizeFolderPathForTree(path) {
  return String(path || '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

/**
 * 将路径拆分为目录层级数组
 * @param {string} path 文件夹路径
 * @returns {Array<string>} 各层目录名
 */
function pathToSegments(path) {
  return normalizeFolderPathForTree(path).split('/').map((s) => s.trim()).filter(Boolean)
}

/**
 * 判断路径是否为空间根节点（如“个人空间/公共空间/根目录”）
 * @param {string} folderPath 文件夹路径
 * @returns {boolean} true 表示为虚拟空间根节点，应避免渲染为普通目录
 */
function isVirtualSpaceRootPath(folderPath) {
  const segments = pathToSegments(folderPath)
  if (segments.length !== 1) {
    return false
  }
  return VIRTUAL_SPACE_ROOT_PATHS.has(segments[0])
}

/**
 * 在 FileSelectDialog 转换后的树（节点含 id/name/children）中按 folder_id 查找节点
 * @param {Array} nodes 树根数组
 * @param {string} folderId 目标文件夹 id
 * @returns {Object|null} 匹配节点或 null
 */
function findConvertedTreeNodeByFolderId(nodes, folderId) {
  if (!folderId || !nodes || !nodes.length) return null
  for (const n of nodes) {
    if (n.id === folderId) return n
    const found = findConvertedTreeNodeByFolderId(n.children || [], folderId)
    if (found) return found
  }
  return null
}

/**
 * 为 folders 中 scope 为 SELF_AND_DESC 的项从 treeRoots 挂载 treeChildren（深拷贝子树）
 * @param {Array} folders 选择结果中的 folders
 * @param {Array} treeRoots FileSelectDialog 返回的 treeData 根数组
 * @returns {Array} 每项含 treeChildren（数组，可能为空）
 */
function enrichFileSelectFoldersWithTreeChildren(folders, treeRoots) {
  const roots = Array.isArray(treeRoots) ? treeRoots : []
  return (folders || []).map((f) => {
    const row = { ...f }
    row.treeChildren = []
    if (f.scope === 'SELF_AND_DESC' && roots.length > 0) {
      const node = findConvertedTreeNodeByFolderId(roots, f.folder_id)
      if (node && Array.isArray(node.children) && node.children.length > 0) {
        row.treeChildren = JSON.parse(JSON.stringify(node.children))
      }
    }
    return row
  })
}

/**
 * 将弹窗树中的单节点转换为左侧文件树中的文件夹子树（递归）
 * @param {Object} dc 弹窗树节点，含 name、id、children
 * @param {string} parentFolderPathNormalized 父级已规范化路径
 * @returns {Object|null} 文件树文件夹节点
 */
function dialogTreeNodeToOurFolderSubtree(dc, parentFolderPathNormalized) {
  if (!dc) return null
  const name = String(dc.name || '').trim() || '未命名'
  const folderPath = parentFolderPathNormalized
    ? `${parentFolderPathNormalized}/${name}`
    : name
  const normalized = normalizeFolderPathForTree(folderPath)
  const children = []
  for (const ch of dc.children || []) {
    const sub = dialogTreeNodeToOurFolderSubtree(ch, normalized)
    if (sub) children.push(sub)
  }
  return {
    treeKey: `folder:${normalized}`,
    name,
    nodeType: 'folder',
    folderId: dc.id || '',
    folderPath: normalized,
    children
  }
}

/**
 * 将弹窗树中的子节点列表合并进已有文件夹节点（同 treeKey 则递归合并子级）
 * @param {Object} folderNode 左侧树中的文件夹节点
 * @param {Array} dialogChildren 弹窗树子节点数组
 * @param {string} parentFolderPathNormalized 当前文件夹已规范化路径
 */
function mergeDialogChildrenIntoFolderNode(folderNode, dialogChildren, parentFolderPathNormalized) {
  if (!folderNode || folderNode.nodeType !== 'folder' || !dialogChildren || !dialogChildren.length) {
    return
  }
  if (!folderNode.children) folderNode.children = []
  const byKey = new Map()
  folderNode.children.forEach((c) => {
    if (c && c.treeKey) byKey.set(c.treeKey, c)
  })
  for (const dc of dialogChildren) {
    const name = String(dc.name || '').trim() || '未命名'
    const childPath = parentFolderPathNormalized
      ? `${parentFolderPathNormalized}/${name}`
      : name
    const normalized = normalizeFolderPathForTree(childPath)
    const treeKey = `folder:${normalized}`
    const existing = byKey.get(treeKey)
    if (!existing) {
      const sub = dialogTreeNodeToOurFolderSubtree(dc, parentFolderPathNormalized)
      if (sub) {
        folderNode.children.push(sub)
        byKey.set(sub.treeKey, sub)
      }
    } else if (existing.nodeType === 'folder' && dc.children && dc.children.length > 0) {
      mergeDialogChildrenIntoFolderNode(existing, dc.children, existing.folderPath)
    }
  }
}

/**
 * 判断路径是否命中删除路径（包含自身与后代）
 * @param {string} targetPath 待判断路径
 * @param {Array<string>} deletedPaths 已删除路径列表（已规范化）
 * @returns {boolean} true 表示应视为已删除
 */
function isPathDeleted(targetPath, deletedPaths) {
  const normalizedTarget = normalizeFolderPathForTree(targetPath)
  return (deletedPaths || []).some((deletedPath) => (
    normalizedTarget === deletedPath || normalizedTarget.startsWith(`${deletedPath}/`)
  ))
}

/**
 * 递归裁剪 treeChildren 中已删除的目录节点
 * @param {Array} children 弹窗返回的子节点数组（name/id/children）
 * @param {string} parentPath 当前父级路径（已规范化）
 * @param {Array<string>} deletedPaths 已删除路径列表（已规范化）
 * @returns {Array} 过滤后的子节点数组
 */
function pruneDialogTreeChildrenByDeletedPaths(children, parentPath, deletedPaths) {
  const list = Array.isArray(children) ? children : []
  return list
    .map((child) => {
      const name = String(child && child.name ? child.name : '').trim()
      const childPath = normalizeFolderPathForTree(parentPath ? `${parentPath}/${name}` : name)
      if (!name || isPathDeleted(childPath, deletedPaths)) {
        return null
      }
      return {
        ...child,
        children: pruneDialogTreeChildrenByDeletedPaths(child.children || [], childPath, deletedPaths)
      }
    })
    .filter(Boolean)
}

/**
 * 删除文件夹后，清理已无文件/无选中项的保留空目录（避免父级目录残留显示）
 * @param {Array<string>} deletedFolderPaths 已删除的文件夹路径数组
 * @returns {void}
 */
const pruneRetainedEmptyFolderPathsAfterFolderDelete = (deletedFolderPaths) => {
  const deleted = (deletedFolderPaths || [])
    .map((path) => normalizeFolderPathForTree(path))
    .filter(Boolean)
  if (deleted.length === 0) {
    return
  }

  const selectedFolderPaths = new Set()
  ;(fileSelectEnrichedFolders.value || []).forEach((folder) => {
    const folderPath = normalizeFolderPathForTree(folder.folder_path || '')
    if (folderPath) {
      selectedFolderPaths.add(folderPath)
    }
  })

  const hasFilesUnderPath = (folderPath) => {
    return (fileList.value || []).some((file) => {
      const filePath = getFileFolderPath(file)
      return filePath === folderPath || filePath.startsWith(`${folderPath}/`)
    })
  }

  const hasSelectedFolderUnderPath = (folderPath) => {
    for (const selectedPath of selectedFolderPaths) {
      if (selectedPath === folderPath || selectedPath.startsWith(`${folderPath}/`)) {
        return true
      }
    }
    return false
  }

  retainedEmptyFolderPaths.value = (retainedEmptyFolderPaths.value || []).filter((retainedPath) => {
    const normalizedRetainedPath = normalizeFolderPathForTree(retainedPath)
    if (!normalizedRetainedPath || isPathDeleted(normalizedRetainedPath, deleted)) {
      return false
    }
    const isStrictAncestorOfDeleted = deleted.some((deletedPath) => (
      deletedPath.startsWith(`${normalizedRetainedPath}/`)
    ))
    if (!isStrictAncestorOfDeleted) {
      return true
    }
    return hasFilesUnderPath(normalizedRetainedPath) || hasSelectedFolderUnderPath(normalizedRetainedPath)
  })
}

/**
 * 删除文件夹后，同步清理左侧树“已选文件夹”数据源
 * @param {Array<string>} deletedFolderPaths 需要清理的文件夹路径数组
 */
const removeDeletedFoldersFromSelectionState = (deletedFolderPaths) => {
  const normalizedDeletedPaths = (deletedFolderPaths || [])
    .map((path) => normalizeFolderPathForTree(path))
    .filter(Boolean)
  if (normalizedDeletedPaths.length === 0) {
    return
  }

  fileSelectInitialFolders.value = (fileSelectInitialFolders.value || []).filter((folder) => {
    const folderPath = normalizeFolderPathForTree(folder.folder_path || '')
    return !isPathDeleted(folderPath, normalizedDeletedPaths)
  })

  fileSelectEnrichedFolders.value = (fileSelectEnrichedFolders.value || [])
    .filter((folder) => {
      const folderPath = normalizeFolderPathForTree(folder.folder_path || '')
      return !isPathDeleted(folderPath, normalizedDeletedPaths)
    })
    .map((folder) => {
      const folderPath = normalizeFolderPathForTree(folder.folder_path || '')
      return {
        ...folder,
        treeChildren: pruneDialogTreeChildrenByDeletedPaths(
          folder.treeChildren || [],
          folderPath,
          normalizedDeletedPaths
        )
      }
    })
}

/**
 * 构建左侧树数据：文件夹与文件均在根级平铺，文件不按目录挂在父文件夹下；SELF_AND_DESC 仅在其下嵌套 treeData 子目录
 * @param {Array} files 当前过滤后的文件列表
 * @param {Array} enrichedFolders 选择结果富集后的文件夹行（含 treeChildren）
 * @param {Array<string>} retainedPaths 删除文件后需保留显示的空目录路径
 * @returns {Array} 供 el-tree-v2 使用的根节点数组（顺序：选中文件夹 → 保留空目录 → 文件）
 */
function buildFlatLeftTreeData(files, enrichedFolders, retainedPaths) {
  const rootNodes = []
  const seenFolderPaths = new Set()

  ;(enrichedFolders || []).forEach((ef) => {
    const fp = normalizeFolderPathForTree(ef.folder_path || '')
    const folderId = ef.folder_id || fp
    const treeKey = `folder:sel:${folderId}`
    if (fp && seenFolderPaths.has(fp)) return
    if (fp) seenFolderPaths.add(fp)
    const folderNode = {
      treeKey,
      name: ef.folder_name || (pathToSegments(ef.folder_path).pop() || '文件夹'),
      nodeType: 'folder',
      folderId: ef.folder_id || '',
      folderPath: fp,
      children: []
    }
    if (ef.scope === 'SELF_AND_DESC' && ef.treeChildren && ef.treeChildren.length > 0) {
      mergeDialogChildrenIntoFolderNode(folderNode, ef.treeChildren, fp)
    }
    rootNodes.push(folderNode)
  })

  ;(retainedPaths || []).forEach((folderPath) => {
    const fp = normalizeFolderPathForTree(folderPath)
    if (!fp) return
    if (seenFolderPaths.has(fp)) return
    seenFolderPaths.add(fp)
    const segments = pathToSegments(fp)
    const name = segments.length ? segments[segments.length - 1] : fp
    rootNodes.push({
      treeKey: `folder:retained:${fp}`,
      name,
      nodeType: 'folder',
      folderId: '',
      folderPath: fp,
      children: []
    })
  })

  ;(files || []).forEach((file) => {
    const fileIdentifier = getFileIdentifier(file)
    const attachmentFileId = getAttachmentFileId(file)
    const attachments = attachmentFileId ? (fileAttachmentsMap.value[attachmentFileId] || []) : []
    file.attachmentCount = attachments.length
    file.attachments = attachments
    const children = mergeAttachments.value
      ? attachments.map((att) => ({
          treeKey: `attachment:${String(fileIdentifier)}:${att.attachment_id}`,
          name: att.name || '未命名附件',
          nodeType: 'attachment',
          sourceFile: att,
          parentFileId: fileIdentifier
        }))
      : []
    rootNodes.push({
      treeKey: `file:${String(fileIdentifier)}`,
      name: file.name || '未命名文件',
      nodeType: 'file',
      sourceFile: file,
      children
    })
  })

  return rootNodes
}

/**
 * 按关键字递归过滤左侧树节点（文件与文件夹均参与匹配）
 * @param {Object} node 左侧树节点，包含 nodeType/name/children 等字段
 * @param {string} keywordLower 小写关键字
 * @returns {Object|null} 命中则返回过滤后的节点，否则返回 null
 */
function filterLeftTreeNodeByKeyword(node, keywordLower) {
  if (!node) {
    return null
  }
  const selfName = String(node.name || '').toLowerCase()
  const selfMatched = selfName.includes(keywordLower)

  if (node.nodeType === 'file') {
    return selfMatched ? { ...node } : null
  }

  const children = Array.isArray(node.children) ? node.children : []
  const filteredChildren = children
    .map((child) => filterLeftTreeNodeByKeyword(child, keywordLower))
    .filter(Boolean)

  if (!selfMatched && filteredChildren.length === 0) {
    return null
  }

  return {
    ...node,
    children: filteredChildren
  }
}

/**
 * 为预览模式左侧树节点注入附件数量（供角标展示）
 * @param {Array<Object>} nodes 树节点列表
 * @returns {Array<Object>} 注入附件信息后的树节点
 */
const enrichPreviewTreeWithAttachments = (nodes) => {
  return (nodes || []).map((node) => {
    if (node.nodeType === 'file' && node.sourceFile) {
      const attachmentFileId = getAttachmentFileId(node.sourceFile)
      const attachments = attachmentFileId ? (fileAttachmentsMap.value[attachmentFileId] || []) : []
      return {
        ...node,
        sourceFile: {
          ...node.sourceFile,
          attachmentCount: attachments.length,
          attachments
        }
      }
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      return {
        ...node,
        children: enrichPreviewTreeWithAttachments(node.children)
      }
    }
    return node
  })
}

const fileTreeData = computed(() => {
  if (leftSidebarMode.value === 'preview' && previewOverrideTreeData.value) {
    const keyword = String(searchKeyword.value || '').trim().toLowerCase()
    const base = enrichPreviewTreeWithAttachments(previewOverrideTreeData.value)
    if (!keyword) {
      return base
    }
    return base
      .map((node) => filterLeftTreeNodeByKeyword(node, keyword))
      .filter(Boolean)
  }
  const baseTree = buildFlatLeftTreeData(
    filteredFileList.value,
    fileSelectEnrichedFolders.value,
    retainedEmptyFolderPaths.value
  )
  const keyword = String(searchKeyword.value || '').trim().toLowerCase()
  if (!keyword) {
    return baseTree
  }
  return baseTree
    .map((node) => filterLeftTreeNodeByKeyword(node, keyword))
    .filter(Boolean)
})
const isFolderListPreviewMode = computed(() => !!currentFolderPreviewPath.value)
const currentFolderPreviewFiles = computed(() => {
  if (!currentFolderPreviewPath.value) {
    return []
  }
  if (isCurrentFolderPreviewRemote.value) {
    return currentFolderPreviewRemoteFiles.value
  }
  return filterFilesByParsePolicy(
    filteredFileList.value.filter(file => getFileFolderPath(file) === currentFolderPreviewPath.value),
    allowUnparsed.value
  ).map(file => ({
      fileId: String(getFileIdentifier(file)),
      name: file.name || '未命名文件',
      type: file.type || '-',
      folderPath: getFileFolderPath(file) || '根目录',
      sourceFile: file
    }))
})

/** 文件夹预览列表（附带附件数量，供列表展示与操作） */
const folderPreviewFilesEnriched = computed(() => {
  return (currentFolderPreviewFiles.value || []).map((file) => {
    const fileId = String(file.fileId || file.file_id || file.file_uuid || getAttachmentFileId(file) || '')
    const attachments = fileId ? (fileAttachmentsMap.value[fileId] || []) : []
    return {
      ...file,
      attachmentCount: attachments.length
    }
  })
})

/**
 * 中间列表待删除文件ID集合（传给中间列表组件，用于禁用勾选与恢复按钮状态）
 * @param {void} _ 占位参数，无实际意义
 * @returns {Array<string>} 待删除文件ID数组
 */
const pendingDeleteFileIds = computed(() => (
  (pendingDeleteRecords.value.files || []).map(item => String(item.fileId))
))

/**
 * 文件夹列表头展示总数：接口模式取后端 total，本地模式取当前列表长度
 * @returns {number} 文件总数
 */
const folderPreviewDisplayTotal = computed(() => {
  if (isCurrentFolderPreviewRemote.value) {
    return Number(folderPreviewTotal.value || 0)
  }
  return currentFolderPreviewFiles.value.length
})

/**
 * 将接口文件行映射为中间文件夹预览列表项
 * @param {Object} rawFile 接口返回文件对象
 * @param {string} folderPath 文件夹路径文本
 * @returns {Object} 中间列表行对象
 */
const mapFolderPreviewRemoteFileRow = (rawFile, folderPath) => {
  const fileName = rawFile.file_name || rawFile.original_name || '未命名文件'
  return {
    fileId: String(rawFile.file_id || ''),
    name: fileName,
    type: getFileTypeFromExtension(fileName),
    folderPath: folderPath || currentFolderPreviewPath.value || '根目录',
    sourceFile: null
  }
}

/**
 * 按文件夹 ID 查询文件并渲染中间列表
 * @param {string} folderId 文件夹ID
 * @param {string} folderPath 文件夹路径（展示用）
 * @param {number} page 当前页，默认 1
 * @returns {Promise<void>} 异步完成
 */
const loadFolderPreviewFilesByFolderId = async (folderId, folderPath, page = 1) => {
  if (!folderId) {
    isCurrentFolderPreviewRemote.value = false
    currentFolderPreviewRemoteFiles.value = []
    folderPreviewTotal.value = 0
    folderPreviewPage.value = 1
    currentFolderPreviewFolderId.value = ''
    await refreshFileAttachments()
    return
  }
  currentFolderPreviewFolderId.value = folderId
  folderPreviewPage.value = page
  folderPreviewLoading.value = true
  try {
    const res = await getFileListAPI(
      buildFolderFileListQueryParams(
        {
          folder_id: folderId,
          page: page,
          page_size: folderPreviewPageSize.value
        },
        { allowUnparsed: allowUnparsed.value }
      )
    )
    if (res?.code === 200 && res?.data?.files) {
      folderPreviewTotal.value = Number(res.data.total || 0)
      currentFolderPreviewRemoteFiles.value = (res.data.files || [])
        .map((raw) => mapFolderPreviewRemoteFileRow(raw, folderPath))
    } else {
      folderPreviewTotal.value = 0
      currentFolderPreviewRemoteFiles.value = []
    }
    isCurrentFolderPreviewRemote.value = true
    await refreshFileAttachments()
  } catch (error) {
    console.error('文件夹列表加载失败:', error)
    folderPreviewTotal.value = 0
    currentFolderPreviewRemoteFiles.value = []
    isCurrentFolderPreviewRemote.value = true
    ElMessage.error('文件夹列表加载失败')
  } finally {
    folderPreviewLoading.value = false
  }
}

/**
 * 处理文件夹列表分页切换
 * @param {number} page 新页码（从1开始）
 * @returns {Promise<void>} 异步完成
 */
const handleFolderPreviewPageChange = async (page) => {
  if (!currentFolderPreviewFolderId.value) {
    return
  }
  await loadFolderPreviewFilesByFolderId(
    currentFolderPreviewFolderId.value,
    currentFolderPreviewPath.value,
    page
  )
}

/**
 * 收集当前树中可见文件夹路径
 * @param {Array} treeNodes 树节点数组，元素包含 nodeType/folderPath/children
 * @returns {Array<string>} 可见文件夹路径数组
 */
const collectVisibleFolderPaths = (treeNodes) => {
  const paths = []
  const travel = (nodes) => {
    if (!nodes || nodes.length === 0) {
      return
    }
    nodes.forEach((node) => {
      if (node && node.nodeType === 'folder' && node.folderPath) {
        paths.push(node.folderPath)
      }
      if (node && node.children && node.children.length > 0) {
        travel(node.children)
      }
    })
  }
  travel(treeNodes)
  return paths
}

const visibleFolderPaths = computed(() => collectVisibleFolderPaths(fileTreeData.value))

/**
 * 判断文件夹节点是否已勾选
 * @param {Object} treeNode 树节点对象，需包含 folderPath 字段
 * @returns {boolean} true 表示当前文件夹已勾选
 */
const isFolderChecked = (treeNode) => {
  if (!treeNode || treeNode.nodeType !== 'folder') {
    return false
  }
  return checkedFolderPaths.value.includes(treeNode.folderPath || '')
}

/**
 * 收集文件夹节点及其全部子文件夹路径
 * @param {Object} treeNode 文件夹树节点，包含 folderPath/children
 * @returns {Array<string>} 当前节点及其后代文件夹路径数组
 */
const collectFolderPathsFromNode = (treeNode) => {
  if (!treeNode || treeNode.nodeType !== 'folder') {
    return []
  }
  const pathList = []
  const travel = (node) => {
    if (!node || node.nodeType !== 'folder') {
      return
    }
    if (node.folderPath) {
      pathList.push(node.folderPath)
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        travel(child)
      })
    }
  }
  travel(treeNode)
  return pathList
}

/**
 * 处理文件夹勾选变更
 * @param {Object} treeNode 树节点对象，需包含 folderPath/name
 * @param {boolean} checked 勾选状态，true 为选中，false 为取消
 */
const handleFolderCheckChange = (treeNode, checked) => {
  if (!treeNode || treeNode.nodeType !== 'folder') {
    return
  }
  const allFolderPaths = collectFolderPathsFromNode(treeNode)
  if (allFolderPaths.length === 0) {
    return
  }
  if (checked) {
    const folderSet = new Set(checkedFolderPaths.value)
    allFolderPaths.forEach((path) => folderSet.add(path))
    checkedFolderPaths.value = Array.from(folderSet)
  } else {
    const removeSet = new Set(allFolderPaths)
    checkedFolderPaths.value = checkedFolderPaths.value.filter(path => !removeSet.has(path))
  }
}

/**
 * 记录待删除文件信息（用于后续提交后端）
 * @param {Array} files 文件对象数组，元素需包含 id/name/path 信息
 */
const recordPendingFileDeletes = (files) => {
  const existingKeys = new Set(
    pendingDeleteRecords.value.files.map(item => `${item.fileId}|${item.folderPath}`)
  )
  files.forEach((file) => {
    const rawFileId = getFileIdentifier(file)
    if (rawFileId === null || rawFileId === undefined || String(rawFileId).trim() === '') {
      return
    }
    const fileId = String(rawFileId)
    const folderPath = getFileFolderPath(file) || '根目录'
    const itemKey = `${fileId}|${folderPath}`
    if (!existingKeys.has(itemKey)) {
      const sourceFileSnapshot = file.sourceFile
        ? JSON.parse(JSON.stringify(file.sourceFile))
        : JSON.parse(JSON.stringify(file))
      pendingDeleteRecords.value.files.push({
        fileId,
        fileName: file.name || '未命名文件',
        folderPath,
        sourceFileSnapshot
      })
      existingKeys.add(itemKey)
    }
  })
}

/**
 * 记录待删除文件夹信息（用于后续提交后端）
 * @param {Array} folderList 文件夹对象数组，元素需包含 folderPath/name
 */
const recordPendingFolderDeletes = (folderList) => {
  const existingPaths = new Set(
    pendingDeleteRecords.value.folders.map(item => item.folderPath)
  )
  folderList.forEach((folder) => {
    const folderPath = folder.folderPath || ''
    if (folderPath && !existingPaths.has(folderPath)) {
      pendingDeleteRecords.value.folders.push({
        folderPath,
        folderName: folder.name || folderPath
      })
      existingPaths.add(folderPath)
    }
  })
}


/**
 * 统一执行文件删除后的本地状态清理
 * @param {Set<string>} deletedFileIds 已删除文件ID集合（字符串）
 */
const cleanupAfterFileDelete = (deletedFileIds) => {
  selectedFiles.value = selectedFiles.value.filter(fileId => !deletedFileIds.has(String(fileId)))

  if (currentFile.value && deletedFileIds.has(String(getFileIdentifier(currentFile.value)))) {
    currentFile.value = null
    pdfSource.value = null
    extractionResults.value = []
  }
}

/**
 * 删除文件夹预览区勾选文件（仅前端）
 * @param {Array<string>} selectedFileIds 中间表格传入的已勾选文件ID数组
 */
const handleDeleteSelectedFolderPreviewFiles = (selectedFileIds = []) => {
  const normalizedSelectedIds = (selectedFileIds || []).map(id => String(id)).filter(Boolean)
  if (normalizedSelectedIds.length === 0) {
    ElMessage.warning('请先勾选要删除的文件')
    return
  }

  ElMessageBox.confirm(
    `确定删除已勾选的 ${normalizedSelectedIds.length} 个文件吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const selectedIdSet = new Set(normalizedSelectedIds)
    const filesToDelete = currentFolderPreviewFiles.value
      .filter(item => selectedIdSet.has(String(item.fileId)))
      .map((item) => ({
        id: item.fileId,
        name: item.name,
        folderPath: item.folderPath || currentFolderPreviewPath.value || '根目录',
        sourceFile: item.sourceFile || null,
        type: item.type || getFileTypeFromExtension(item.name || '')
      }))
    retainAncestorFoldersByFiles(filesToDelete)
    recordPendingFileDeletes(filesToDelete)
    fileList.value = fileList.value.filter(file => !selectedIdSet.has(String(getFileIdentifier(file))))
    cleanupAfterFileDelete(selectedIdSet)
    ElMessage.success('已删除勾选文件（仅前端）')
  }).catch(() => {
  })
}

/**
 * 按文件夹路径删除本地文件
 * @param {Array<string>} folderPaths 文件夹路径数组，支持父级路径批量删除
 */
const deleteFilesByFolderPaths = (folderPaths) => {
  const normalizedPaths = folderPaths.filter(Boolean)
  if (normalizedPaths.length === 0) {
    return
  }
  const filesToDelete = fileList.value.filter((file) => {
    const path = getFileFolderPath(file)
    return normalizedPaths.some(folderPath => path === folderPath || path.startsWith(`${folderPath}/`))
  })
  const deletedIdSet = new Set(filesToDelete.map(file => String(getFileIdentifier(file))))
  recordPendingFileDeletes(filesToDelete)
  fileList.value = fileList.value.filter((file) => {
    const path = getFileFolderPath(file)
    return !normalizedPaths.some(folderPath => path === folderPath || path.startsWith(`${folderPath}/`))
  })
  cleanupAfterFileDelete(deletedIdSet)
}

/**
 * 删除单个文件夹节点（仅前端）
 * @param {Object} treeNode 树节点对象，需包含 folderPath/name
 */
const handleDeleteFolderNode = (treeNode) => {
  if (!treeNode || treeNode.nodeType !== 'folder') {
    return
  }
  const folderPath = treeNode.folderPath || ''
  if (!folderPath) {
    return
  }
  ElMessageBox.confirm(
    `确定删除文件夹 "${treeNode.name}" 及其下文件吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    clearRetainedFoldersByDeletedPaths([folderPath])
    removeDeletedFoldersFromSelectionState([folderPath])
    pruneRetainedEmptyFolderPathsAfterFolderDelete([folderPath])
    recordPendingFolderDeletes([{ folderPath, name: treeNode.name }])
    deleteFilesByFolderPaths([folderPath])
    checkedFolderPaths.value = checkedFolderPaths.value
      .filter(path => path !== folderPath && !path.startsWith(`${folderPath}/`))
    if (currentFolderPreviewPath.value === folderPath || currentFolderPreviewPath.value.startsWith(`${folderPath}/`)) {
      currentFolderPreviewPath.value = ''
      currentFolderPreviewName.value = ''
    }
    ElMessage.success('文件夹已删除（仅前端）')
  }).catch(() => {
  })
}

/**
 * 删除勾选文件夹（仅前端）
 */
const handleDeleteCheckedFolders = () => {
  if (checkedFolderPaths.value.length === 0) {
    ElMessage.warning('请先勾选文件夹')
    return
  }
  ElMessageBox.confirm(
    `确定删除已勾选的 ${checkedFolderPaths.value.length} 个文件夹及其下文件吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const pathsToDelete = [...checkedFolderPaths.value]
    clearRetainedFoldersByDeletedPaths(pathsToDelete)
    removeDeletedFoldersFromSelectionState(pathsToDelete)
    pruneRetainedEmptyFolderPathsAfterFolderDelete(pathsToDelete)
    const folderItems = pathsToDelete.map(path => ({
      folderPath: path,
      name: path.split('/').pop() || path
    }))
    recordPendingFolderDeletes(folderItems)
    deleteFilesByFolderPaths(pathsToDelete)
    if (currentFolderPreviewPath.value && pathsToDelete.some(path =>
      currentFolderPreviewPath.value === path || currentFolderPreviewPath.value.startsWith(`${path}/`)
    )) {
      currentFolderPreviewPath.value = ''
      currentFolderPreviewName.value = ''
    }
    checkedFolderPaths.value = []
    ElMessage.success('已删除勾选文件夹（仅前端）')
  }).catch(() => {
  })
}

/**
 * 由中间列表行构造可预览/可恢复的文件对象
 * @param {Object} rowData 中间列表行对象，需包含 fileId/name/type/folderPath/sourceFile
 * @returns {Object|null} 文件对象
 */
const buildRecoverableFileFromPreviewRow = (rowData) => {
  if (!rowData) {
    return null
  }
  const targetId = String(rowData.fileId || '')
  if (!targetId) {
    return null
  }
  if (rowData.sourceFile) {
    return JSON.parse(JSON.stringify(rowData.sourceFile))
  }
  const pendingRecord = (pendingDeleteRecords.value.files || [])
    .find((item) => String(item.fileId) === targetId)
  if (pendingRecord && pendingRecord.sourceFileSnapshot) {
    return JSON.parse(JSON.stringify(pendingRecord.sourceFileSnapshot))
  }
  const inferredType = (rowData.type && rowData.type !== '-')
    ? rowData.type
    : getFileTypeFromExtension(String(rowData.name || ''))
  const normalizedFolderPath = normalizeFolderPathForTree(
    rowData.folderPath || currentFolderPreviewPath.value || ''
  )
  return {
    id: targetId,
    fileId: targetId,
    name: rowData.name || '未命名文件',
    type: inferredType || 'pdf',
    folderPath: normalizedFolderPath,
    path: normalizedFolderPath,
    settings: null,
    selected: false
  }
}

/**
 * 恢复中间列表行对应的已删除文件（仅前端）
 * @param {Object} rowData 中间列表行对象，需包含 fileId 字段
 */
const handleRestoreFolderPreviewFile = (rowData) => {
  const targetId = String((rowData && rowData.fileId) || '')
  if (!targetId) {
    return
  }
  if (!isFilePendingDeleteById(targetId)) {
    return
  }
  pendingDeleteRecords.value.files = (pendingDeleteRecords.value.files || [])
    .filter((item) => String(item.fileId) !== targetId)
  ElMessage.success('文件已恢复（仅前端）')
}

/**
 * 查看中间列表行对应文件（等同左侧树点击查看）
 * @param {Object} rowData 中间列表行对象，需包含 fileId/sourceFile 信息
 */
const handleViewFolderPreviewFile = async (rowData) => {
  const targetId = String((rowData && rowData.fileId) || '')
  if (!targetId) {
    ElMessage.warning('文件信息不完整，无法查看')
    return
  }
  let sourceFile = rowData.sourceFile || null
  if (!sourceFile) {
    sourceFile = fileList.value.find((file) => String(getFileIdentifier(file)) === targetId) || null
  }
  if (!sourceFile) {
    sourceFile = buildRecoverableFileFromPreviewRow(rowData)
  }
  if (!sourceFile) {
    ElMessage.warning('文件信息不完整，无法查看')
    return
  }
  await handleTreeNodeClick({
    nodeType: 'file',
    sourceFile
  })
}

/**
 * 生成树节点显示名称
 * @param {string} nodeName 节点原始名称
 * @returns {string} 名称过长时返回以关键尾部为主的截断字符串
 */
const getTreeNodeDisplayName = (nodeName) => {
  const safeName = nodeName || ''
  if (safeName.length <= TREE_NAME_MAX_LENGTH) {
    return safeName
  }
  const splitIndex = safeName.lastIndexOf('-')
  const keywordPart = splitIndex > -1 && splitIndex < safeName.length - 1
    ? safeName.slice(splitIndex + 1)
    : safeName.slice(-(TREE_NAME_MAX_LENGTH - 3))
  const trimmedKeyword = keywordPart.slice(-(TREE_NAME_MAX_LENGTH - 3))
  return `...${trimmedKeyword}`
}

// 全选状态
const isAllSelected = computed({
  get: () => {
    const fileCount = filteredFileList.value.length
    const folderCount = visibleFolderPaths.value.length
    const totalCount = fileCount + folderCount
    if (totalCount === 0) return false
    const allFilesSelected = filteredFileList.value.every(file => isFileSelected(file))
    const allFoldersSelected = visibleFolderPaths.value.every(path => checkedFolderPaths.value.includes(path))
    return allFilesSelected && allFoldersSelected
  },
  set: (val) => {
    handleSelectAll(val)
  }
})

// 半选状态（部分选中）
const isIndeterminate = computed(() => {
  const selectedFileCount = filteredFileList.value.filter(file => isFileSelected(file)).length
  const selectedFolderCount = visibleFolderPaths.value
    .filter(path => checkedFolderPaths.value.includes(path))
    .length
  const selectedCount = selectedFileCount + selectedFolderCount
  const totalCount = filteredFileList.value.length + visibleFolderPaths.value.length
  return selectedCount > 0 && selectedCount < totalCount
})

/**
 * 判断单份功能配置是否已完整（与「批量设置」确认校验一致：模板/自定义字段/Prompt 非空）
 * @param {Object|null|undefined} settings 文件或文件夹上的 settings 快照
 * @returns {boolean} 为 true 表示可参与批量执行
 */
function isBatchSettingsContentComplete(settings) {
  if (!settings || settings.configured !== true) {
    return false
  }
  const mode = settings.mode || 'field'
  if (mode === 'prompt') {
    return !!(settings.prompt && String(settings.prompt).trim())
  }
  const template = settings.template
  if (template !== undefined && template !== null && String(template).trim() !== '') {
    return true
  }
  const fields = settings.fieldDefinitions || []
  if (fields.length === 0) {
    return false
  }
  return fields.every((f) => f && f.name && String(f.name).trim())
}

/**
 * 由右侧功能配置面板构建全局 settings 快照
 * @returns {Object} 与批量执行一致的 settings 结构
 */
const buildGlobalExtractSettingsSnapshot = () => {
  let template = ''
  let fields = []
  if (configMode.value === 'field') {
    if (selectedTemplate.value && selectedTemplate.value !== '__add_template__') {
      template = selectedTemplate.value
    }
    fields = JSON.parse(JSON.stringify(fieldDefinitions.value || []))
  }
  return {
    mode: configMode.value,
    prompt: configMode.value === 'prompt' ? extractPrompt.value : '',
    template,
    fieldDefinitions: fields,
    mergeAttachments: mergeAttachments.value,
    chunkSize: chunkSize.value,
    chunkOverlap: chunkOverlap.value,
    configured: true,
    configuredAt: new Date().toISOString()
  }
}

/**
 * 右侧功能配置是否已满足批量执行要求（全局一份配置）
 * @returns {boolean} 是否就绪
 */
const isGlobalExtractConfigReady = computed(() => {
  return isBatchSettingsContentComplete(buildGlobalExtractSettingsSnapshot())
})

/**
 * 将右侧全局配置写入全部文件与已知文件夹（仅前端）
 * @returns {boolean} 是否写入成功
 */
const applyGlobalExtractSettings = () => {
  const snapshot = buildGlobalExtractSettingsSnapshot()
  if (!isBatchSettingsContentComplete(snapshot)) {
    return false
  }
  // 校验切片字数是否超过数据字典上限
  if (typeof snapshot.chunkSize === 'number' && snapshot.chunkSize > maxChunkSizeLimit.value) {
    viewerTab.value = 'extract'
    ElMessage.warning(`切片字数不能超过数据字典上限 ${maxChunkSizeLimit.value}`)
    return false
  }
  const cloned = JSON.parse(JSON.stringify(snapshot))
  fileList.value.forEach((file, idx) => {
    fileList.value[idx].settings = JSON.parse(JSON.stringify(cloned))
  })
  getAllSidebarFolderPathsForExecute().forEach((path) => {
    folderBatchSettingsMap.value[path] = JSON.parse(JSON.stringify(cloned))
  })
  if (currentFile.value) {
    currentFile.value.settings = JSON.parse(JSON.stringify(cloned))
  }
  return true
}

// 获取模板的中文名称（与功能配置模板列表一致：优先从 templateOptions 取 label，再兜底默认映射）
const getTemplateName = (templateValue) => {
  if (!templateValue) return '默认模板'
  const opt = templateOptions.value.find(o => o.value === templateValue)
  if (opt && opt.label) return opt.label
  const templateMap = {
    'default': '默认模板',
    'contract': '合同提取模板',
    'invoice': '发票提取模板',
    'audit': '审计报告模板'
  }
  return templateMap[templateValue] || templateValue || '默认模板'
}

// 获取文件的唯一标识符（统一函数，确保一致性）
const getFileIdentifier = (file) => {
  if (!file) return null
  // 优先使用 id，如果 id 不存在或为 null/undefined，则使用 name
  const identifier = (file.id !== undefined && file.id !== null) ? file.id : file.name
  return identifier
}

// 判断文件是否被选中
const isFileSelected = (file) => {
  if (isFilePendingDelete(file)) {
    return false
  }
  const fileId = getFileIdentifier(file)
  return selectedFiles.value.includes(fileId)
}

/**
 * 判断 fileId 是否已在前端待删除列表中
 * @param {string|number} fileId 文件ID
 * @returns {boolean} true 表示该文件已标记待删除
 */
const isFilePendingDeleteById = (fileId) => {
  const target = String(fileId || '').trim()
  if (!target) return false
  return pendingDeleteRecords.value.files.some(item => String(item.fileId) === target)
}

/**
 * 判断文件对象是否已在前端待删除列表中
 * @param {Object} file 文件对象
 * @returns {boolean} true 表示该文件已标记待删除
 */
const isFilePendingDelete = (file) => {
  const id = getFileIdentifier(file)
  return isFilePendingDeleteById(id)
}

/**
 * 处理树节点点击
 * @param {Object} treeNode 树节点对象，包含 nodeType/sourceFile 等字段
 * @param {MouseEvent} event 点击事件对象，用于排除复选框点击
 */
const handleTreeNodeClick = async (treeNode, event) => {
  if (!treeNode) {
    return
  }

  if (treeNode.nodeType === 'folder') {
    if (currentFile.value && !isReadOnly.value) {
      saveCurrentSettings()
    }
    currentFolderPreviewPath.value = treeNode.folderPath || ''
    currentFolderPreviewName.value = treeNode.name || ''
    folderPreviewPage.value = 1
    await loadFolderPreviewFilesByFolderId(treeNode.folderId || '', treeNode.folderPath || '', 1)
    currentFile.value = null
    return
  }

  if (treeNode.nodeType !== 'file' || !treeNode.sourceFile) {
    return
  }

  currentFolderPreviewPath.value = ''
  currentFolderPreviewName.value = ''
  isCurrentFolderPreviewRemote.value = false
  currentFolderPreviewRemoteFiles.value = []
  folderPreviewTotal.value = 0
  folderPreviewPage.value = 1
  currentFolderPreviewFolderId.value = ''
  const eventTarget = event && event.target
  // 如果点击的是复选框区域，不处理
  if (eventTarget && eventTarget.closest && eventTarget.closest('.el-checkbox')) {
    return
  }
  // 点击文件项时选择文件
  selectFile(treeNode.sourceFile)
}

/**
 * 处理单个文件勾选
 * @param {Object} file 文件对象
 * @param {boolean} checked 当前勾选状态，true 为选中，false 为取消
 */
const handleFileSelect = (file, checked) => {
  if (isFilePendingDelete(file)) {
    return
  }
  const fileId = getFileIdentifier(file)
  if (checked) {
    if (!selectedFiles.value.includes(fileId)) {
      selectedFiles.value.push(fileId)
    }
  } else {
    const index = selectedFiles.value.indexOf(fileId)
    if (index > -1) {
      selectedFiles.value.splice(index, 1)
    }
  }
}

/**
 * 处理全选/取消全选
 * @param {boolean} checked 全选状态，true 表示全选过滤结果，false 表示取消
 */
const handleSelectAll = (checked) => {
  if (checked) {
    // 全选：将过滤后的所有文件ID添加到选中列表
    filteredFileList.value.forEach(file => {
      const fileId = getFileIdentifier(file)
      if (!selectedFiles.value.includes(fileId)) {
        selectedFiles.value.push(fileId)
      }
    })
    // 全选：将当前树中可见文件夹路径加入勾选
    const folderSet = new Set(checkedFolderPaths.value)
    visibleFolderPaths.value.forEach(path => folderSet.add(path))
    checkedFolderPaths.value = Array.from(folderSet)
  } else {
    // 取消全选：从选中列表中移除过滤后的所有文件ID
    const filteredIds = filteredFileList.value.map(file => getFileIdentifier(file))
    selectedFiles.value = selectedFiles.value.filter(id => !filteredIds.includes(id))
    // 取消全选：移除当前树中可见文件夹路径
    const visiblePathSet = new Set(visibleFolderPaths.value)
    checkedFolderPaths.value = checkedFolderPaths.value
      .filter(path => !visiblePathSet.has(path))
  }
}

// 去重函数：确保文件列表中不会有重复的文件名
const deduplicateFileList = () => {
  const seen = new Set()
  fileList.value = fileList.value.filter(file => {
    if (seen.has(file.name)) {
      return false // 如果已存在同名文件，过滤掉
    }
    seen.add(file.name)
    return true
  })
}

/**
 * 删除文件
 * @param {Object} file 需要删除的文件对象
 */
const handleDeleteFile = (file) => {
  ElMessageBox.confirm(
    `确定要删除文件 "${file.name}" 吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    retainAncestorFoldersByFiles([file])
    recordPendingFileDeletes([file])
    const deletedFileId = String(getFileIdentifier(file))
    fileList.value = fileList.value
      .filter(f => String(getFileIdentifier(f)) !== deletedFileId)
    cleanupAfterFileDelete(new Set([deletedFileId]))
    ElMessage.success('文件已删除（仅前端）')
  }).catch(() => {
    // 用户取消
  })
}

// 左侧附件：由 OcrLeftSidebar（enableFileAttachment）内置弹窗承载
const leftSidebarRef = ref(null)

/** 附件候选：左侧已选文件 + 当前文件夹预览列表（供绑定附件选择） */
const availableAttachmentFiles = computed(() => {
  const map = new Map()
  const appendCandidate = (file) => {
    const fileId = file?.file_id || file?.fileId || file?.file_uuid
    if (!fileId) return
    const normalizedId = String(fileId)
    if (map.has(normalizedId)) return
    map.set(normalizedId, {
      file_id: normalizedId,
      name: file.name || file.file_name || '未命名',
      size: file.size != null ? file.size : (file.file_size || 0)
    })
  }
  ;(fileList.value || []).forEach(appendCandidate)
  if (currentFolderPreviewPath.value) {
    ;(currentFolderPreviewFiles.value || []).forEach(appendCandidate)
  }
  return Array.from(map.values())
})

/**
 * 打开文件附件管理（文件夹预览等场景复用左侧公共组件弹窗）
 * @param {Object} file 文件对象
 * @returns {void}
 */
const handleViewAttachments = (file) => {
  const fileId = file && (file.fileId || file.file_uuid || file.file_id)
  if (!file || !fileId) {
    ElMessage.warning('该文件不支持附件管理')
    return
  }
  if (leftSidebarRef.value && typeof leftSidebarRef.value.openAttachmentDialog === 'function') {
    leftSidebarRef.value.openAttachmentDialog({
      ...file,
      fileId: String(fileId),
      file_id: String(fileId)
    })
    return
  }
  ElMessage.warning('附件管理不可用')
}

/**
 * 文件夹预览列表中打开附件管理
 * @param {Object} rowData 文件夹预览行
 */
const handleViewFolderPreviewAttachments = (rowData) => {
  if (!rowData || !rowData.fileId) {
    ElMessage.warning('该文件不支持附件管理')
    return
  }
  handleViewAttachments({
    fileId: String(rowData.fileId),
    name: rowData.name || '未命名文件'
  })
}

/**
 * 附件绑定变更后强制刷新对应主文件的附件数量
 * @param {string} fileId 主文件 ID
 * @returns {Promise<void>}
 */
const handleAttachmentChange = async (fileId) => {
  await refreshFileAttachments(fileId)
  if (currentFolderPreviewPath.value) {
    await refreshFileAttachments()
  }
}

const currentFile = ref(null)

// 中间查看器
const viewerTab = ref('extract') // 'parse' | 'extract'
const currentPage = ref(1)
const totalPages = ref(1)
const parseResult = ref(null)

// PDF相关
const pdfSource = ref(null)
const pdfLoading = ref(false)

// 检测浏览器版本（Chrome 77 及以下需要禁用 Worker）
const getChromeVersion = () => {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/)
  return match ? parseInt(match[1]) : null
}

const chromeVersion = getChromeVersion()
const isOldChrome = chromeVersion && chromeVersion <= 77

// 注意：vue-office-pdf 不支持 useWorker 选项，Worker 已在 main.js 中全局禁用
// 对于 Chrome 77，依赖全局配置即可，无需在此处设置选项
const pdfDocumentLoaded = ref(false)

// DOCX相关
const docxSource = ref(null)
const docxLoading = ref(false)
// DOC文件预览容器（使用docx-preview作为备用方案）
const docPreviewContainerRef = ref(null)
// DOC文件预览URL（使用Microsoft Office Online Viewer）
const docPreviewUrl = ref(null)

// Excel相关
const excelSource = ref(null)
const excelLoading = ref(false)

// CSV相关
const csvData = ref([])
const csvColumns = ref([])
const csvLoading = ref(false)

// 文本文件相关
const txtContent = ref('')
const txtLoading = ref(false)

const directStyleLocatorService = ref(null)
const pdfViewerRef = ref(null)
const pdfScale = ref(1) // PDF缩放比例
const isFullscreen = ref(false) // 是否全屏

// 左右侧栏宽度（默认一致，支持分别拖拽持久化）
const SIDEBAR_DEFAULT_WIDTH = 320
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'ocr-viewer-left-sidebar-width'
const RIGHT_SIDEBAR_WIDTH_STORAGE_KEY = 'ocr-viewer-sidebar-width'
/** 历史左栏默认宽度（与其它 OCR 子页共用 localStorage 时可能残留） */
const LEFT_SIDEBAR_LEGACY_DEFAULT_WIDTH = 240

/**
 * 解析侧栏宽度 localStorage 值
 * @param {string|null|undefined} raw 原始存储值
 * @returns {number|null} 有效像素宽度，无效时返回 null
 */
const parseSidebarWidth = (raw) => {
  if (raw == null || raw === '') return null
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 夹紧左侧侧栏宽度到允许区间
 * @param {number} width 目标宽度（像素）
 * @returns {number} 合法宽度
 */
const clampLeftSidebarWidth = (width) =>
  Math.min(LEFT_SIDEBAR_WIDTH_MAX, Math.max(LEFT_SIDEBAR_WIDTH_MIN, width))

const isResizing = ref(false) // 是否正在调整右侧分隔条大小
const startX = ref(0) // 拖拽开始的X坐标（右侧分隔条用）
const startWidth = ref(0) // 拖拽开始时的宽度（右侧分隔条用）
/** 左侧边栏允许的最小、最大宽度（像素） */
const LEFT_SIDEBAR_WIDTH_MIN = 260
const LEFT_SIDEBAR_WIDTH_MAX = 560
const fileSelectDialogVisible = ref(false) // 文件选择对话框显示状态
/** 弹窗回显：上次确认的文件夹列表（folders 在上方，展示 folder_name） */
const fileSelectInitialFolders = ref([])
/** 弹窗回显：上次确认的文件列表（files 在文件夹下方） */
const fileSelectInitialFiles = ref([])

// 文件选择对话框筛选参数（仅已解析；不限制文件后缀，全部类型可选）
const allowUnparsed = ref(false) // 未解析文件是否可选
const canSelectFileType = ref([]) // 空数组表示全部类型
const showParseStatus = ref(true) // 是否显示解析状态列

const savedRightWidth = parseSidebarWidth(localStorage.getItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY))
const rightSidebarWidth = ref(savedRightWidth ?? SIDEBAR_DEFAULT_WIDTH)

const savedLeftWidth = parseSidebarWidth(localStorage.getItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY))
let resolvedLeftWidth = savedLeftWidth ?? rightSidebarWidth.value
// 与其它页面共用的左栏 240 历史默认对齐为当前右栏宽度
if (savedLeftWidth === LEFT_SIDEBAR_LEGACY_DEFAULT_WIDTH && rightSidebarWidth.value !== savedLeftWidth) {
  resolvedLeftWidth = rightSidebarWidth.value
  localStorage.setItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, String(resolvedLeftWidth))
}
const leftSidebarWidth = ref(clampLeftSidebarWidth(resolvedLeftWidth))
const isResizingLeft = ref(false) // 是否正在通过左侧分隔条调整宽度
const leftResizeStartX = ref(0) // 左侧分隔条拖拽起始 clientX
const leftResizeStartWidth = ref(0) // 左侧分隔条拖拽起始宽度
/** 左侧公共组件模式：edit=编辑模式 preview=预览模式 */
const leftSidebarMode = ref('edit')
/** 预览模式任务ID（由 task_id 拉取左树内容） */
const leftSidebarTaskId = ref('')
/** 预览模式下 API 回填的左侧树数据 */
const previewOverrideTreeData = ref(null)

/**
 * 文本信息提取预览模式：按任务 ID 拉取执行列表的配置
 * @type {{ fetchList: Function, mapToTree: Function }}
 */
const ocrPreviewListConfig = {
  /**
   * 拉取任务调度详情
   * @param {{ taskId: string }} ctx 上下文，含 taskId
   * @returns {Promise<Object>} 接口响应
   */
  async fetchList({ taskId }) {
    return getTaskSchedulesAPI(taskId, {
      prefer_runtime: true,
      include_results: true
    })
  },
  /**
   * 将任务详情映射为左侧树节点
   * @param {Object} res 接口响应
   * @returns {Array<Object>} 树节点列表
   */
  mapToTree(res) {
    if (!res || res.code !== 200 || !res.data) {
      return []
    }
    const list = res.data.task_schedule_result_list
      || res.data.files
      || res.data.items
      || []
    return (list || []).map((item) => {
      const fileId = item.file_uuid || item.file_id || item.result_uuid || ''
      const fileName = item.file_name || item.original_name || '未命名文件'
      return {
        treeKey: `file:${fileId}`,
        name: fileName,
        nodeType: 'file',
        sourceFile: {
          ...item,
          name: fileName,
          file_id: fileId,
          execution_status: item.processing_status ?? item.task_status ?? item.status
        }
      }
    })
  }
}

/**
 * 预览模式写入左侧树（供 OcrLeftSidebar previewListConfig 回调）
 * @param {Array<Object>} treeNodes 树节点数组
 * @returns {void}
 */
const setPreviewFileTreeData = (treeNodes) => {
  previewOverrideTreeData.value = Array.isArray(treeNodes) ? treeNodes : []
}

/**
 * 左侧区域与关联弹窗绑定对象（供公共组件复用）
 * @param {void} _ 占位参数，无实际意义
 * @returns {Object} 左侧组件所需状态、方法与图标映射
 */
const leftSidebarBindings = computed(() => ({
  // 基础状态
  showFilePreview,
  searchKeyword,
  selectedFiles,
  checkedFolderPaths,
  fileTreeData,
  fileTreeProps,
  isAllSelected,
  isIndeterminate,
  hasBatchSettingsTargets,
  canBatchExecute,

  // 左树行为
  handleSelectFile,
  handleSelectAll,
  isFileActive,
  handleTreeNodeClick,
  isFolderChecked,
  handleFolderCheckChange,
  isFileSelected,
  isFilePendingDelete,
  handleFileSelect,
  getTreeNodeDisplayName,
  handleDeleteFile,
  handleDeleteFolderNode,
  handleDeleteCheckedFolders,
  handleBatchSettings,
  handleExecuteDialog,
  attachmentAvailableFiles: availableAttachmentFiles.value,
  onAttachmentChange: handleAttachmentChange,

  // 批量设置弹窗
  batchSettingsDialogVisible,
  batchSettingsFileList,
  batchSettingsTemplateMap,
  templateLoading,
  templateOptions,
  batchSettingsFieldMap,
  batchSettingsNewFieldMap,
  getTemplateName,
  handleBatchFieldModeChange,
  handleLoadFieldsFromTemplate,
  handleBatchRemoveField,
  handleBatchAddField,
  handleBatchSettingsCancel,
  handleBatchSettingsConfirm,

  // 批量执行弹窗
  batchRecognizeDialogVisible,
  batchFileList,
  taskName,
  taskRemark,
  handleBatchRecognizeCancel,
  executeSwitch,
  batchExtracting,

  // 文件选择弹窗
  fileSelectDialogVisible,
  fileSelectInitialFolders,
  fileSelectInitialFiles,
  allowUnparsed,
  canSelectFileType,
  showParseStatus,
  onFileSelectConfirm,

  // 预览模式展示信息
  previewTaskName: taskName,
  previewRuntimeNodes: batchTaskRuntimeNodes,
  setPreviewFileTreeData,

  // 图标
  icons: {
    Hide,
    View,
    Search,
    Document,
    Folder,
    Delete,
    Plus
  }
}))

/**
 * 处理左侧组件模式切换
 * @param {string} mode 目标模式，支持 edit 或 preview
 */
const handleLeftSidebarModeChange = (mode) => {
  leftSidebarMode.value = mode === 'preview' ? 'preview' : 'edit'
}

/**
 * 开始拖拽左侧分隔条以调整左侧面板宽度
 * @param {MouseEvent} e 鼠标按下事件，使用 clientX 作为拖拽起点横坐标
 */
const startLeftSidebarResize = (e) => {
  isResizingLeft.value = true
  leftResizeStartX.value = e.clientX
  leftResizeStartWidth.value = leftSidebarWidth.value
  document.addEventListener('mousemove', handleLeftSidebarResize)
  document.addEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.add('resizing')
}

/**
 * 拖拽过程中更新左侧面板宽度（向右拖加宽、向左拖收窄）
 * @param {MouseEvent} e 鼠标移动事件，通过 clientX 与起点差值计算新宽度
 */
const handleLeftSidebarResize = (e) => {
  if (!isResizingLeft.value) return
  const diff = e.clientX - leftResizeStartX.value
  const newWidth = leftResizeStartWidth.value + diff
  if (newWidth >= LEFT_SIDEBAR_WIDTH_MIN && newWidth <= LEFT_SIDEBAR_WIDTH_MAX) {
    leftSidebarWidth.value = newWidth
  }
}

/**
 * 结束左侧宽度拖拽：移除 document 监听、取消 body 拖拽样式，并将当前宽度写入 localStorage
 */
const stopLeftSidebarResize = () => {
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')
  localStorage.setItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, String(leftSidebarWidth.value))
}

// 开始调整宽度
const startResize = (e) => {
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = rightSidebarWidth.value

  // 添加事件监听
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  // 添加禁止选择类
  document.body.classList.add('resizing')
}

// 调整宽度过程
const handleResize = (e) => {
  if (!isResizing.value) return

  const diff = startX.value - e.clientX // 注意：向左拖拽是增加宽度，所以是减法
  const newWidth = startWidth.value + diff

  // 限制最小和最大宽度（最小300px，最大800px）
  if (newWidth >= 300 && newWidth <= 800) {
    rightSidebarWidth.value = newWidth
  }
}

// 结束调整宽度
const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.classList.remove('resizing')
  localStorage.setItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY, String(rightSidebarWidth.value))
}

// 右侧配置
const configMode = ref('field') // 'prompt' | 'field'
const extractPrompt = ref('请帮我结构化这个文件,结果以json形式返回')
const selectedTemplate = ref('')
// 信息提取扩展配置（附件合并、切片参数）
const mergeAttachments = ref(false)
const chunkSize = ref(12000)
const chunkOverlap = ref(200)
const maxChunkSizeLimit = ref(50000) // 数据字典读取的最大切片字数上限
// 恢复文件配置时跳过 watch(selectedTemplate) 中的 loadTemplate，避免异步 loadTemplate 覆盖已恢复的自定义字段
const isRestoringFileSettings = ref(false)

// 文件附件缓存：file_id -> 附件列表
const fileAttachmentsMap = ref({})
const loadingFileAttachments = ref(false)
const inFlightAttachmentFileIds = new Set()

// 获取文件的后端 file_id，用于加载附件（上传文件无 fileId，返回空）
const getAttachmentFileId = (file) => {
  if (!file) return ''
  return file.fileId || file.file_uuid || file.file_id || ''
}

// 加载已选文件、文件夹预览与预览模式左侧树的附件列表
/**
 * 刷新文件附件缓存并更新左侧树角标数量
 * @param {string|Array<string>|void} forceTarget 需要强制重新拉取的主文件 ID（单个或数组）
 * @returns {Promise<void>}
 */
const refreshFileAttachments = async (forceTarget) => {
  const folderPreviewFiles = currentFolderPreviewPath.value
    ? (currentFolderPreviewFiles.value || [])
    : []
  const files = [...(fileList.value || []), ...folderPreviewFiles]
  const previewTreeIds = []
  if (leftSidebarMode.value === 'preview' && previewOverrideTreeData.value) {
    const walkPreviewNodes = (nodes) => {
      ;(nodes || []).forEach((node) => {
        if (node.nodeType === 'file' && node.sourceFile) {
          const id = getAttachmentFileId(node.sourceFile)
          if (id) previewTreeIds.push(id)
        }
        if (node.children?.length) walkPreviewNodes(node.children)
      })
    }
    walkPreviewNodes(previewOverrideTreeData.value)
  }
  const fileIds = [...new Set([
    ...files.map(getAttachmentFileId).filter(Boolean),
    ...previewTreeIds
  ])]

  const forceFileIds = Array.isArray(forceTarget)
    ? forceTarget
    : (forceTarget ? [forceTarget] : [])
  const forceSet = new Set(forceFileIds.map((id) => String(id)).filter(Boolean))
  forceSet.forEach((fileId) => {
    inFlightAttachmentFileIds.delete(fileId)
    if (fileAttachmentsMap.value[fileId]) {
      const nextMap = { ...fileAttachmentsMap.value }
      delete nextMap[fileId]
      fileAttachmentsMap.value = nextMap
    }
  })

  const idsToFetch = fileIds.filter((id) => {
    const normalizedId = String(id)
    if (forceSet.has(normalizedId)) {
      return true
    }
    return !fileAttachmentsMap.value[normalizedId] && !inFlightAttachmentFileIds.has(normalizedId)
  })
  if (idsToFetch.length === 0) {
    return
  }

  idsToFetch.forEach((id) => inFlightAttachmentFileIds.add(String(id)))
  loadingFileAttachments.value = true
  try {
    fileAttachmentsMap.value = await batchLoadFileAttachmentsMap(
      idsToFetch,
      fileAttachmentsMap.value
    )
  } catch (error) {
    console.error('批量加载文件附件失败:', error)
    const nextMap = { ...fileAttachmentsMap.value }
    idsToFetch.forEach((fileId) => {
      const normalizedId = String(fileId)
      if (!Object.prototype.hasOwnProperty.call(nextMap, normalizedId)) {
        nextMap[normalizedId] = []
      }
    })
    fileAttachmentsMap.value = nextMap
  } finally {
    idsToFetch.forEach((id) => inFlightAttachmentFileIds.delete(String(id)))
    loadingFileAttachments.value = false
  }
}

// 文件列表或文件夹预览列表变化时自动加载附件
watch(
  () => {
    const listIds = (fileList.value || []).map((f) => getAttachmentFileId(f)).filter(Boolean).join(',')
    const folderIds = (currentFolderPreviewFiles.value || []).map((f) => getAttachmentFileId(f)).filter(Boolean).join(',')
    return `${listIds}|${folderIds}`
  },
  () => {
    refreshFileAttachments()
  },
  { immediate: true }
)

// 预览模式左侧树回填后，加载对应主文件附件
watch(
  () => {
    if (leftSidebarMode.value !== 'preview' || !previewOverrideTreeData.value) {
      return ''
    }
    const collectFileIds = (nodes) => {
      const ids = []
      ;(nodes || []).forEach((node) => {
        if (node.nodeType === 'file' && node.sourceFile) {
          const id = getAttachmentFileId(node.sourceFile)
          if (id) ids.push(id)
        }
        if (node.children?.length) {
          ids.push(...collectFileIds(node.children))
        }
      })
      return ids
    }
    return collectFileIds(previewOverrideTreeData.value).join(',')
  },
  () => {
    refreshFileAttachments()
  }
)

// 模板选择相关
const templateOptions = ref([]) // 模板选项列表
const templateLoading = ref(false) // 模板加载状态
const templatePage = ref(1) // 当前页码
const templatePageSize = ref(15) // 每页数量
const templateTotal = ref(0) // 总数量
const templateSearchKeyword = ref('') // 搜索关键词
const templateHasMore = ref(true) // 是否还有更多数据

// 加载数据字典中的信息提取配置（MAX_CHUNK_SIZE / OVERLAP）
const loadInfoExtractionConfig = async () => {
  try {
    const res = await getDictItemsByCodeAPI('INFO_EXTRACTION_CONFIG', { status: 1, tree: false })
    if (res.code === 200 && Array.isArray(res.data)) {
      const maxChunkItem = res.data.find(item => item.key_code === 'MAX_CHUNK_SIZE')
      const overlapItem = res.data.find(item => item.key_code === 'OVERLAP')
      if (maxChunkItem && maxChunkItem.value) {
        const parsed = parseInt(maxChunkItem.value, 10)
        if (!isNaN(parsed) && parsed > 0) {
          maxChunkSizeLimit.value = parsed
        }
      }
      if (overlapItem && overlapItem.value) {
        const parsed = parseInt(overlapItem.value, 10)
        if (!isNaN(parsed) && parsed >= 0) {
          chunkOverlap.value = parsed
        }
      }
    }
  } catch (error) {
    console.error('加载信息提取配置失败:', error)
  }
}

// 加载模板列表
const loadTemplates = async (page = 1, reset = false) => {
  if (templateLoading.value) return

  templateLoading.value = true
  try {
    const response = await getPublicAndPrivateTemplatesAPI({
      page: page,
      size: templatePageSize.value
    })

    if (response.code === 200 && response.data) {
      let templates = []
      let total = 0

      // 处理响应数据格式：后端返回 { code: 200, message: "...", data: { items: [...], total: ... } }
      if (response.data.items && Array.isArray(response.data.items)) {
        templates = response.data.items
        // 从 data 中获取 total，如果没有则使用 items 的长度
        total = response.data.total !== undefined ? response.data.total : templates.length
      } else if (Array.isArray(response.data)) {
        // 兼容直接返回数组的情况
        templates = response.data
        total = templates.length
      } else if (response.data.list && Array.isArray(response.data.list)) {
        // 兼容 list 字段的情况
        templates = response.data.list
        total = response.data.total !== undefined ? response.data.total : templates.length
      }

      // 转换数据格式，映射后端字段到前端需要的格式
      const newOptions = templates
        .filter(template => {
          // 过滤掉已删除的模板（del_flag === 1）
          return template.del_flag !== 1 && template.del_flag !== '1'
        })
        .map(template => ({
          label: template.template_name || template.name || '未命名模板',
          value: template.prompt_uuid || template.id || template.uuid || '',
          description: template.template_desc || template.description || '',
          // 保留原始数据，方便后续使用
          originalData: template
        }))

      if (reset) {
        templateOptions.value = newOptions
      } else {
        // 追加数据，去重（基于 value）
        const existingValues = new Set(templateOptions.value.map(opt => opt.value))
        newOptions.forEach(opt => {
          if (!existingValues.has(opt.value)) {
            templateOptions.value.push(opt)
          }
        })
      }

      templateTotal.value = total
      templatePage.value = page
      // 判断是否还有更多数据：当前已加载的数量小于总数
      templateHasMore.value = templateOptions.value.length < total
    } else {
      if (response.message) {
        ElMessage.warning(response.message)
      }
    }
  } catch (error) {
    console.error('加载模板列表失败:', error)
    ElMessage.error('加载模板列表失败: ' + (error.message || '未知错误'))
  } finally {
    templateLoading.value = false
  }
}

// 模板选择器引用
const templateSelectRef = ref(null)

// 处理模板下拉框显示/隐藏
const handleTemplateSelectVisible = (visible) => {
  if (visible) {
    if (templateOptions.value.length === 0) {
      // 首次打开时加载第一页数据
      loadTemplates(1, true)
    }
    // 添加滚动监听
    nextTick(() => {
      const dropdownEl = document.querySelector('.template-select-dropdown .el-select-dropdown__wrap')
      if (dropdownEl) {
        dropdownEl.addEventListener('scroll', handleTemplateDropdownScroll)
      }
    })
  } else {
    // 移除滚动监听
    const dropdownEl = document.querySelector('.template-select-dropdown .el-select-dropdown__wrap')
    if (dropdownEl) {
      dropdownEl.removeEventListener('scroll', handleTemplateDropdownScroll)
    }
  }
}

// 处理模板下拉框获得焦点
const handleTemplateSelectFocus = () => {
  if (templateOptions.value.length === 0) {
    loadTemplates(1, true)
  }
}

// 监听下拉框滚动，实现懒加载
const handleTemplateDropdownScroll = (event) => {
  const { target } = event
  const scrollTop = target.scrollTop
  const scrollHeight = target.scrollHeight
  const clientHeight = target.clientHeight

  // 滚动到底部附近时加载下一页
  if (scrollHeight - scrollTop - clientHeight < 50 && templateHasMore.value && !templateLoading.value) {
    loadTemplates(templatePage.value + 1, false)
  }
}

// 批量设置弹框相关
const batchSettingsDialogVisible = ref(false)
const batchSettingsMode = ref('field') // 'prompt' | 'field'
const batchSettingsPrompt = ref('')
// 统一配置：所有文件使用同一个字段模式配置
const batchSettingsTemplateMap = ref({ type: 'template', value: 'default' }) // { type: 'template'|'custom', value: templateName }
const batchSettingsFieldMap = ref([]) // 统一的自定义字段定义数组
const batchSettingsNewFieldMap = ref({ name: '', description: '' }) // 统一的新字段输入
const folderBatchSettingsMap = ref({})

// 批量执行弹框相关
const batchRecognizeDialogVisible = ref(false)
const batchConfigMode = ref('prompt') // 'prompt' | 'field'
const batchExtractPrompt = ref('')
const batchFileTemplateMap = ref({}) // { fileId: templateValue }
const batchExtracting = ref(false)
const taskName = ref('') // 任务名称
const taskRemark = ref('') // 任务备注

/** 预览模式左侧步骤树（任务详情反显） */
const batchTaskRuntimeNodes = ref([])

const hasBatchSettingsTargets = computed(() => {
  return selectedFiles.value.length > 0 || checkedFolderPaths.value.length > 0
})

/**
 * 收集左侧树内全部文件夹路径（批量执行不依赖勾选）
 * @returns {Array<string>} 路径列表
 */
const getAllSidebarFolderPathsForExecute = () => {
  const pathSet = new Set()
  const walk = (nodes) => {
    ;(nodes || []).forEach((node) => {
      if (node && node.nodeType === 'folder') {
        const fp = normalizeFolderPathForTree(node.folderPath || '')
        if (fp) pathSet.add(fp)
      }
      if (node && Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children)
      }
    })
  }
  walk(fileTreeData.value)
  ;(fileSelectEnrichedFolders.value || []).forEach((f) => {
    const fp = normalizeFolderPathForTree(f.folder_path || '')
    if (fp) pathSet.add(fp)
  })
  ;(fileSelectInitialFolders.value || []).forEach((f) => {
    const fp = normalizeFolderPathForTree(f.folder_path || '')
    if (fp) pathSet.add(fp)
  })
  return Array.from(pathSet)
}

/**
 * 左侧树内全部文件（批量执行范围，与勾选无关）
 * @returns {Array} 文件列表
 */
const getAllSidebarFilesForExecute = () => [...(fileList.value || [])]

/**
 * 左侧是否存在可批量执行的数据
 * @returns {boolean}
 */
const hasSidebarExecuteScope = computed(() => {
  return getAllSidebarFilesForExecute().length > 0 || getAllSidebarFolderPathsForExecute().length > 0
})

const canBatchExecute = computed(() => {
  return isGlobalExtractConfigReady.value && hasSidebarExecuteScope.value
})

/**
 * @deprecated 批量执行已改为全树范围，保留供旧批量设置弹窗逻辑引用
 * @returns {Array} 目标文件
 */
const getBatchSettingsTargetFiles = () => getAllSidebarFilesForExecute()

/**
 * 为批量弹框构建“文件夹-文件”树结构（默认展开）
 * @param {Array} files 文件数组，元素需包含 id/name/folderPath/settings
 * @param {Function} resolveFileSettings 文件设置解析函数，参数为 file，返回 settings
 * @returns {Array} 树形行数据
 */
/**
 * 为批量弹框构建树（folderPathsForScope 为空则用左侧树全部文件夹路径）
 * @param {Array} files 文件列表
 * @param {Function} resolveFileSettings 解析 settings
 * @param {Array<string>|null} folderPathsForScope 文件夹路径范围
 * @returns {Array} 树行
 */
/**
 * 批量弹窗展示用 settings（优先已落库，否则取右侧全局配置）
 * @param {Object|null} file 文件对象
 * @returns {Object|null} settings
 */
const resolveBatchPreviewSettings = (file) => {
  if (file && file.settings && file.settings.configured) {
    return file.settings
  }
  if (isGlobalExtractConfigReady.value) {
    return {
      ...buildGlobalExtractSettingsSnapshot(),
      configured: true
    }
  }
  return null
}

/**
 * 批量弹窗文件夹节点 settings
 * @param {string} folderPath 文件夹路径
 * @returns {Object|null} settings
 */
const resolveBatchPreviewFolderSettings = (folderPath) => {
  const fp = normalizeFolderPathForTree(folderPath)
  const fromMap = folderBatchSettingsMap.value[fp]
  if (fromMap && fromMap.configured) {
    return fromMap
  }
  if (isGlobalExtractConfigReady.value) {
    return {
      ...buildGlobalExtractSettingsSnapshot(),
      configured: true
    }
  }
  return null
}

const buildBatchDialogTreeRows = (files, resolveFileSettings, folderPathsForScope = null) => {
  const roots = []
  const folderMap = new Map()
  const fileKeySet = new Set()
  const checkedFolderPathsNormalized = (folderPathsForScope != null
    ? folderPathsForScope
    : getAllSidebarFolderPathsForExecute())
    .map((p) => normalizeFolderPathForTree(p))
    .filter(Boolean)
  const checkedFolderPathSet = new Set(checkedFolderPathsNormalized)

  /**
   * 查找“已勾选文件夹”中的最近父级路径（仅在勾选集合内匹配，不自动补父链）
   * @param {string} folderPath 文件夹路径
   * @returns {string} 最近已勾选父级路径，未命中返回空字符串
   */
  const findClosestCheckedAncestorPath = (folderPath) => {
    const normalizedPath = normalizeFolderPathForTree(folderPath)
    if (!normalizedPath) return ''
    const segments = pathToSegments(normalizedPath)
    for (let i = segments.length - 1; i > 0; i--) {
      const candidate = segments.slice(0, i).join('/')
      if (checkedFolderPathSet.has(candidate)) {
        return candidate
      }
    }
    return ''
  }

  // 第一步：只为“勾选文件夹”创建节点，不自动创建未勾选父级
  checkedFolderPathsNormalized.forEach((folderPath) => {
    const segments = pathToSegments(folderPath)
    const folderName = segments[segments.length - 1] || folderPath
    const folderMeta = findSelectedFolderMetaByPath(folderPath) || {}
    folderMap.set(folderPath, {
      rowKey: `folder:${folderPath}`,
      id: `folder:${folderPath}`,
      treeKey: `folder:${folderPath}`,
      name: folderName,
      type: 'folder',
      nodeType: 'folder',
      typeLabel: '文件夹',
      folderPath,
      folderId: folderMeta.folder_id || findFolderIdByPathFromFileTree(folderPath) || '',
      checked: true,
      settings: resolveBatchPreviewFolderSettings(folderPath),
      folderMeta: folderMeta || {},
      children: []
    })
  })

  // 第二步：仅在“勾选文件夹之间”建立父子关系
  checkedFolderPathsNormalized.forEach((folderPath) => {
    const node = folderMap.get(folderPath)
    if (!node) return
    const parentPath = findClosestCheckedAncestorPath(folderPath)
    if (parentPath && folderMap.has(parentPath)) {
      folderMap.get(parentPath).children.push(node)
    } else {
      roots.push(node)
    }
  })

  ;(files || []).forEach((file) => {
    const fileId = String(getFileIdentifier(file) || '')
    if (!fileId) return
    const filePath = normalizeFolderPathForTree(getFileFolderPath(file))
    const fileNode = {
      rowKey: `file:${fileId}`,
      id: fileId,
      treeKey: `file:${fileId}`,
      name: file.name || '未知文件',
      type: 'file',
      nodeType: 'file',
      typeLabel: '文件',
      fileId,
      folderPath: filePath,
      sourceFile: file,
      settings: resolveFileSettings
        ? resolveFileSettings(file)
        : resolveBatchPreviewSettings(file.sourceFile || file)
    }
    if (fileKeySet.has(fileNode.rowKey)) {
      return
    }
    fileKeySet.add(fileNode.rowKey)

    // 文件挂到最近的“已勾选文件夹”下；找不到就作为根节点显示
    let parentPath = ''
    if (filePath && checkedFolderPathSet.has(filePath)) {
      parentPath = filePath
    } else {
      const matched = checkedFolderPathsNormalized
        .filter((fp) => filePath === fp || filePath.startsWith(`${fp}/`))
        .sort((a, b) => b.length - a.length)
      parentPath = matched[0] || ''
    }
    const parentNode = parentPath ? folderMap.get(parentPath) : null
    if (parentNode) {
      parentNode.children.push(fileNode)
    } else {
      roots.push(fileNode)
    }
  })

  return roots
}

// 批量设置弹框中的树形列表（默认展开）
const batchSettingsFileList = computed(() => {
  const targetFiles = getBatchSettingsTargetFiles()
  return buildBatchDialogTreeRows(targetFiles, (file) => file.settings || null)
})

// 批量执行弹框中的树形列表（默认展开）
const batchFileList = computed(() => {
  const targetFiles = getAllSidebarFilesForExecute()
  const folderScope = getAllSidebarFolderPathsForExecute()
  return buildBatchDialogTreeRows(targetFiles, (file) => resolveBatchPreviewSettings(file), folderScope)
})

// 只读状态控制 - 右侧配置区域始终只读，用于展示任务执行结果
// 文档预览页面应该是可编辑的，只有在任务结果页面才是只读的
const isReadOnly = ref(false)
const extracting = ref(false)
const extractionResults = ref([])

// 加载计时器相关
const loadingElapsedTime = ref(0) // 已经过的秒数
const loadingText = ref('正在解析中... 0.0s') // 加载文本
let loadingTimer = null // 定时器引用
let loadingInstance = null // ElLoading 实例

// 字段定义
const fieldDefinitions = ref([])
const newField = ref({
  name: '',
  description: ''
})

// 计算属性：判断是否显示Excel导出选项
const showExcelExport = computed(() => {
  return configMode.value === 'field' && fieldDefinitions.value && fieldDefinitions.value.length > 0
})

// 判断是否选择了已有模板（UUID格式，不是默认模板名称）
const isTemplateSelected = computed(() => {
  if (!selectedTemplate.value || selectedTemplate.value === '') {
    return false
  }
  // 默认模板名称列表
  const defaultTemplates = ['construction', 'non-construction', 'contract', 'audit', 'invoice', 'default']
  // 如果不是默认模板名称，则认为是UUID格式的已有模板
  return !defaultTemplates.includes(selectedTemplate.value)
})

// 识别相关
const currentHighlightedField = ref(null)
const locating = ref(false)
const currentLocatingField = ref(null)

// 预览引用
const previewRef = ref(null) // 文档预览区域ref
const pdfContainerWrapperRef = ref(null) // PDF容器wrapper ref
const uploadRef = ref(null)

// 生成占位图片（Base64）
const generatePlaceholderImage = (text = '示例图片', width = 800, height = 1000) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // 绘制背景
  ctx.fillStyle = '#f5f7fa'
  ctx.fillRect(0, 0, width, height)

  // 绘制边框
  ctx.strokeStyle = '#e4e7ed'
  ctx.lineWidth = 2
  ctx.strokeRect(10, 10, width - 20, height - 20)

  // 绘制文字
  ctx.fillStyle = '#909399'
  ctx.font = '24px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2)

  return canvas.toDataURL('image/png')
}

// 初始化PDF定位服务
const initPDFLocatorService = () => {
  if (!directStyleLocatorService.value) {
    directStyleLocatorService.value = new DirectPDFStyleLocatorService({
      autoRestoreDelay: 30000,
      enableAutoRestore: false,
      debugMode: false
    })
  }
}


// PDF渲染完成回调
const handlePdfRendered = () => {
  pdfDocumentLoaded.value = true
  pdfLoading.value = false
}


// PDF加载错误回调
const handlePdfError = (error) => {
  console.error('PDF加载错误:', error)
  // 不阻止预览继续，只记录错误
  // 对于 Chrome 77 的 Worker 警告，这是预期的，不需要显示错误消息
  const errorMessage = error?.message || error?.toString() || ''
  const isWorkerError = errorMessage.includes('Worker') || errorMessage.includes('setup') || errorMessage.includes('polyfill')

  if (!isWorkerError) {
    // 只有非 Worker 相关错误才显示错误消息
    ElMessage.warning('PDF文档加载可能存在问题，但将继续尝试显示')
  }

  // 即使有错误，也允许继续尝试显示
  pdfLoading.value = false
  // 不设置 pdfSource 为 null，让组件继续尝试渲染
}

const handleDocxError = (error) => {
  console.error('DOCX加载错误:', error)
  // 检查当前文件类型，如果是 .doc 文件，给出友好提示
  if (currentFile.value && currentFile.value.type === 'doc') {
    ElMessage.warning({
      message: '.doc 格式文件预览不支持，建议转换为 .docx 格式后重新上传',
      duration: 5000
    })
  } else {
    ElMessage.error('Word文档加载失败，请检查文件路径')
  }
  docxLoading.value = false
}

const handleExcelError = (error) => {
  console.error('Excel加载错误:', error)
  ElMessage.error('Excel文档加载失败，请检查文件路径')
  excelLoading.value = false
}

// CSV文件处理函数
const decodeBufferToText = (buffer) => {
  const decoders = ['utf-8', 'gb18030', 'gbk']
  const looksGarbled = (text) => {
    if (text.indexOf('\uFFFD') !== -1) return true
    const nonPrintable = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length
    return nonPrintable > Math.max(5, text.length * 0.01)
  }
  for (let i = 0; i < decoders.length; i++) {
    try {
      const text = new TextDecoder(decoders[i], { fatal: false }).decode(buffer)
      if (!looksGarbled(text)) {
        return text
      }
    } catch (e) {
      // 忽略，尝试下一个编码
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch {
    return ''
  }
}

const stripBomAndNormalize = (text) => {
  if (text && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

const computeColumnWidths = (headers, rows) => {
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.font = '14px var(--el-font-family), Arial, Helvetica, sans-serif'
  const padding = 28
  const minCol = 80
  const maxCol = 480
  const calc = (text) => {
    if (text == null) return minCol
    const str = String(text)
    const metrics = ctx.measureText(str)
    return Math.min(maxCol, Math.max(minCol, Math.ceil(metrics.width) + padding))
  }
  const sampleSize = Math.min(100, rows.length)
  return headers.map(function(h, idx) {
    let width = calc(h)
    for (let i = 0; i < sampleSize; i++) {
      const v = rows[i] ? rows[i][h] : ''
      width = Math.max(width, calc(v))
    }
    return { prop: h, label: h, minWidth: width }
  })
}

const detectDelimiter = (text) => {
  const candidates = [',', ';', '\t', '|']
  const sampleLines = text.split('\n').slice(0, 10)
  let best = { delim: ',', score: -1 }
  for (let i = 0; i < candidates.length; i++) {
    const delim = candidates[i]
    const counts = sampleLines.map(function(l) { return (l === '' ? 0 : l.split(delim).length) }).filter(function(c) { return c > 1 })
    if (counts.length === 0) continue
    let sum = 0
    for (let j = 0; j < counts.length; j++) {
      sum += counts[j]
    }
    const avg = sum / counts.length
    let variance = 0
    for (let j = 0; j < counts.length; j++) {
      variance += (counts[j] - avg) * (counts[j] - avg)
    }
    variance = variance / counts.length
    const score = avg - variance
    if (score > best.score) best = { delim: delim, score: score }
  }
  return best.delim
}

const parseCSV = (csvText) => {
  if (!csvText) return { headers: [], data: [] }
  const delimiter = detectDelimiter(csvText)
  const records = []
  let currentField = ''
  let currentRecord = []
  let inQuotes = false
  const pushField = function() {
    let value = currentField
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
      value = value.slice(1, -1)
    }
    value = value.replace(/""/g, '"')
    currentRecord.push(value)
    currentField = ''
  }
  const pushRecord = function() {
    let allEmpty = true
    for (let i = 0; i < currentRecord.length; i++) {
      const v = currentRecord[i]
      if (v !== null && v !== undefined && v !== '') {
        allEmpty = false
        break
      }
    }
    if (!allEmpty) records.push(currentRecord)
    currentRecord = []
  }
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]
    const next = i + 1 < csvText.length ? csvText[i + 1] : ''
    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === delimiter) {
      pushField()
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      pushField()
      pushRecord()
      if (ch === '\r' && next === '\n') i++
      continue
    }
    currentField += ch
  }
  pushField()
  pushRecord()
  if (records.length === 0) return { headers: [], data: [] }
  const headerRow = records[0].map(function(h) { return (h || '').trim() })
  const normalizedHeaders = headerRow.map(function(h, idx) { return (h ? h : 'Column_' + (idx + 1)) })
  const data = records.slice(1).map(function(row) {
    const obj = {}
    for (let i = 0; i < normalizedHeaders.length; i++) {
      obj[normalizedHeaders[i]] = row[i] !== undefined ? row[i] : ''
    }
    return obj
  })
  return { headers: normalizedHeaders, data }
}

const loadCsvFile = async (file) => {
  try {
    let csvText = ''
    if (file.previewUrl && file.previewUrl.startsWith('data:')) {
      // Base64数据
      const response = await fetch(file.previewUrl)
      const blob = await response.blob()
      const buf = await blob.arrayBuffer()
      csvText = stripBomAndNormalize(decodeBufferToText(buf))
    } else if (file.previewUrl) {
      // URL
      const response = await fetch(file.previewUrl)
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status)
      }
      const buf = await response.arrayBuffer()
      csvText = stripBomAndNormalize(decodeBufferToText(buf))
    }
    const result = parseCSV(csvText)
    csvData.value = result.data
    csvColumns.value = computeColumnWidths(result.headers, result.data)
  } catch (e) {
    console.error('CSV加载失败:', e)
    csvData.value = []
    csvColumns.value = []
    throw e
  }
}

const loadTxtFile = async (file) => {
  try {
    // 如果文件有 fileId 但没有 previewUrl，先获取预览URL
    if (file.fileId && !file.previewUrl) {
      try {
        const previewRes = await previewFileAPI(file.fileId)
        if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
          file.previewUrl = previewRes.data.preview_url
          // 更新文件列表中的预览URL
          const fileIndex = fileList.value.findIndex(f => f.fileId === file.fileId)
          if (fileIndex !== -1) {
            fileList.value[fileIndex].previewUrl = previewRes.data.preview_url
          }
        }
      } catch (e) {
      }
    }

    if (file.previewUrl && file.previewUrl.startsWith('data:')) {
      const response = await fetch(file.previewUrl)
      const blob = await response.blob()
      txtContent.value = await blob.text()
    } else if (file.previewUrl) {
      const response = await fetch(file.previewUrl)
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status)
      }
      txtContent.value = await response.text()
    } else {
      txtContent.value = ''
    }
  } catch (e) {
    console.error('文本文件加载失败:', e)
    txtContent.value = ''
    throw e
  }
}

// DOCX文档高亮存储
const docxHighlights = ref([])

// 清除DOCX高亮
const clearDocxHighlights = () => {
  if (docxHighlights.value && docxHighlights.value.length > 0) {
    docxHighlights.value.forEach(function(highlight) {
      if (highlight.wrapper && highlight.parent && highlight.originalNode) {
        try {
          // 恢复原始文本节点
          highlight.parent.replaceChild(highlight.originalNode, highlight.wrapper)
        } catch (e) {
        }
      }
    })
    docxHighlights.value = []
  }
}

// DOCX字段定位
const handleLocateFieldInDocx = async (field) => {
  try {
    locating.value = true
    currentLocatingField.value = field.name
    currentHighlightedField.value = field.name

    // 清除之前的高亮
    clearDocxHighlights()

    // 等待DOM更新和DOCX渲染完成
    await nextTick()
    await new Promise(function(resolve) {
      setTimeout(resolve, 300)
    })
    await nextTick()
    await new Promise(function(resolve) {
      setTimeout(resolve, 500)
    })

    // 查找DOCX容器
    const docxContainer = document.querySelector('.docx-container')
    if (!docxContainer) {
      ElMessage.warning('Word文档尚未加载完成，请稍后再试')
      return
    }

    // 获取要查找的文本（去除多余的空白字符）
    let searchText = field.fieldValue.trim()
    if (!searchText) {
      ElMessage.warning('字段值为空，无法定位')
      return
    }

    // 规范化搜索文本：移除多余的空白字符，但保留单个空格
    searchText = searchText.replace(/\s+/g, ' ').trim()

    // 在文档中查找文本（过滤掉样式文本节点）
    const allTextNodes = []
    const walker = document.createTreeWalker(
      docxContainer,
      NodeFilter.SHOW_TEXT,
      {
            acceptNode: function(node) {
              // 过滤掉style标签和mark标签内的文本节点
              let parent = node.parentNode
              while (parent && parent !== docxContainer) {
                if (parent.tagName === 'STYLE' || parent.tagName === 'MARK') {
                  return NodeFilter.FILTER_REJECT
                }
                parent = parent.parentNode
              }
              return NodeFilter.FILTER_ACCEPT
            }
      }
    )

    let node
    while ((node = walker.nextNode())) {
      const text = node.textContent || ''
      // 只包含实际文档文本，排除CSS等
      if (text.trim().length > 0 && text.indexOf('{') === -1 && text.indexOf(':') === -1) {
        allTextNodes.push(node)
      }
    }

    // 查找包含目标文本的节点（支持跨节点匹配）
    const searchTextLower = searchText.toLowerCase()
    let found = false

    // 方法1：先尝试单节点完整匹配（仅在节点完整包含搜索文本时）
    for (let i = 0; i < allTextNodes.length; i++) {
      const textNode = allTextNodes[i]
      const nodeText = textNode.textContent || ''
      const nodeTextLower = nodeText.toLowerCase()

      // 只在节点完整包含搜索文本时才进行单节点匹配
      if (nodeTextLower.indexOf(searchTextLower) !== -1) {
        const parent = textNode.parentNode

        if (parent && parent.tagName && parent.tagName !== 'MARK' && parent.tagName !== 'SPAN' && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
          try {
          // 部分匹配，进行高亮处理
          const matchIndex = nodeTextLower.indexOf(searchTextLower)
          const textBefore = nodeText.substring(0, matchIndex)
          const textMatch = nodeText.substring(matchIndex, matchIndex + searchText.length)
          const textAfter = nodeText.substring(matchIndex + searchText.length)

          const fragment = document.createDocumentFragment()
          if (textBefore) {
            fragment.appendChild(document.createTextNode(textBefore))
          }

          const mark = document.createElement('mark')
          mark.style.backgroundColor = 'rgba(255, 193, 7, 0.4)'
          mark.style.padding = '2px 4px'
          mark.style.borderRadius = '2px'
          mark.style.fontWeight = 'bold'
          mark.className = 'docx-highlight'
          mark.textContent = textMatch
          fragment.appendChild(mark)

          if (textAfter) {
            fragment.appendChild(document.createTextNode(textAfter))
          }

            parent.replaceChild(fragment, textNode)

            // 保存高亮信息
            docxHighlights.value.push({
              wrapper: mark,
              parent: parent,
              originalNode: textNode
            })

            // 滚动到高亮位置
            setTimeout(function() {
              mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 200)

            found = true
            ElMessage.success('已定位到字段"' + field.name + '"的原文位置')
            break
          } catch (e) {
          }
        }
      }
    }

    // 方法2：如果单节点匹配失败，尝试跨节点匹配（使用文本节点序列）
    if (!found) {
      // 重新获取文本节点（避免已修改的节点影响）
      const freshTextNodes = []
      const freshWalker = document.createTreeWalker(
        docxContainer,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            let parent = node.parentNode
            while (parent && parent !== docxContainer) {
              if (parent.tagName === 'STYLE' || parent.tagName === 'MARK') {
                return NodeFilter.FILTER_REJECT
              }
              parent = parent.parentNode
            }
            return NodeFilter.FILTER_ACCEPT
          }
        }
      )

      let freshNode
      while ((freshNode = freshWalker.nextNode())) {
        const text = freshNode.textContent || ''
        if (text.trim().length > 0 && text.indexOf('{') === -1 && text.indexOf(':') === -1) {
          freshTextNodes.push(freshNode)
        }
      }

      // 构建文本节点序列的完整文本
      let fullTextFromNodes = ''
      const nodeInfos = [] // 存储节点信息，包括原始节点引用

      for (let i = 0; i < freshTextNodes.length; i++) {
        const textNode = freshTextNodes[i]
        const nodeText = textNode.textContent || ''
        nodeInfos.push({
          node: textNode,
          text: nodeText,
          length: nodeText.length,
          startIndex: fullTextFromNodes.length
        })
        fullTextFromNodes += nodeText
      }

      // 规范化两个文本以便匹配（将多个空白字符合并为一个空格）
      const normalizedFullText = fullTextFromNodes.replace(/\s+/g, ' ')
      const normalizedFullTextLower = normalizedFullText.toLowerCase()

      // 在规范化后的文本中查找匹配位置
      const matchStartIndexInNormalized = normalizedFullTextLower.indexOf(searchTextLower)
      if (matchStartIndexInNormalized !== -1) {
        // 计算规范化文本中匹配的结束位置
        const matchEndIndexInNormalized = matchStartIndexInNormalized + searchText.length

        // 将规范化文本中的位置映射回原始文本的位置
        // 策略：遍历原始文本，同时跟踪规范化文本的索引
        let originalStartIndex = 0
        let originalEndIndex = 0
        let normalizedIndex = 0
        let foundStart = false

        for (let i = 0; i < fullTextFromNodes.length; i++) {
          const char = fullTextFromNodes[i]
          const isWhitespace = /\s/.test(char)

          if (isWhitespace) {
            // 空白字符：如果这是连续空白中的第一个，计入规范化索引
            if (normalizedIndex === 0 || normalizedFullText[normalizedIndex - 1] !== ' ') {
              if (normalizedIndex === matchStartIndexInNormalized && !foundStart) {
                originalStartIndex = i
                foundStart = true
              }
              normalizedIndex++
              if (normalizedIndex === matchEndIndexInNormalized) {
                originalEndIndex = i + 1
                break
              }
            }
          } else {
            // 非空白字符
            if (normalizedIndex === matchStartIndexInNormalized && !foundStart) {
              originalStartIndex = i
              foundStart = true
            }
            normalizedIndex++
            if (normalizedIndex === matchEndIndexInNormalized) {
              originalEndIndex = i + 1
              break
            }
          }
        }

        const actualMatchStartIndex = originalStartIndex
        const actualMatchEndIndex = originalEndIndex

        // 计算匹配位置所在的文本节点
        let nodeCharCount = 0
        let firstMark = null

        // 先收集所有需要修改的节点信息，然后再统一修改（避免DOM变化影响计算）
        const nodesToReplace = []

        for (let i = 0; i < nodeInfos.length; i++) {
          const nodeInfo = nodeInfos[i]
          const nodeStartChar = nodeCharCount
          const nodeEndChar = nodeCharCount + nodeInfo.length

          // 如果匹配跨多个节点，需要处理每个节点
          if (nodeStartChar < actualMatchEndIndex && nodeEndChar > actualMatchStartIndex) {
            const parent = nodeInfo.node.parentNode
            if (parent && parent.tagName && parent.tagName !== 'MARK' && parent.tagName !== 'SPAN' && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
              // 确保节点还在DOM中
              if (parent.contains && parent.contains(nodeInfo.node)) {
                // 计算在当前节点中的匹配范围
                const localStartIndex = Math.max(0, actualMatchStartIndex - nodeStartChar)
                const localEndIndex = Math.min(nodeInfo.length, actualMatchEndIndex - nodeStartChar)

                if (localStartIndex < localEndIndex) {
                  nodesToReplace.push({
                    node: nodeInfo.node,
                    parent: parent,
                    beforeText: nodeInfo.text.substring(0, localStartIndex),
                    matchText: nodeInfo.text.substring(localStartIndex, localEndIndex),
                    afterText: nodeInfo.text.substring(localEndIndex),
                    isLast: nodeEndChar >= actualMatchEndIndex
                  })
                }
              }
            }
          }

          nodeCharCount += nodeInfo.length

          // 如果已经收集完所有匹配节点，跳出循环
          if (nodeEndChar >= actualMatchEndIndex) {
            break
          }
        }

        // 统一替换所有匹配的节点（从后往前替换，避免索引变化）
        if (nodesToReplace.length > 0) {
          for (let j = nodesToReplace.length - 1; j >= 0; j--) {
            const replaceInfo = nodesToReplace[j]
            const fragment = document.createDocumentFragment()

            if (replaceInfo.beforeText) {
              fragment.appendChild(document.createTextNode(replaceInfo.beforeText))
            }

            const mark = document.createElement('mark')
            mark.style.backgroundColor = 'rgba(255, 193, 7, 0.4)'
            mark.style.padding = '2px 4px'
            mark.style.borderRadius = '2px'
            mark.style.fontWeight = 'bold'
            mark.className = 'docx-highlight'
            mark.textContent = replaceInfo.matchText
            fragment.appendChild(mark)

            if (replaceInfo.afterText) {
              fragment.appendChild(document.createTextNode(replaceInfo.afterText))
            }

            try {
              // 检查节点是否还在DOM中
              if (replaceInfo.parent && replaceInfo.parent.contains(replaceInfo.node)) {
                replaceInfo.parent.replaceChild(fragment, replaceInfo.node)

                if (replaceInfo.isLast || !firstMark) {
                  firstMark = mark
                }

                docxHighlights.value.push({
                  wrapper: mark,
                  parent: replaceInfo.parent,
                  originalNode: replaceInfo.node
                })
              }
            } catch (e) {
            }
          }

          if (firstMark) {
            setTimeout(function() {
              firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 200)
            found = true
            ElMessage.success('已定位到字段"' + field.name + '"的原文位置')
          }
        }
      }
    }

    if (found) {
      // 消息已在上面显示
    } else {
      ElMessage.warning('未找到字段"' + field.name + '"的原文位置')
    }

  } catch (error) {
    console.error('DOCX定位失败:', error)
    ElMessage.error('定位失败: ' + (error.message || '未知错误'))
  } finally {
    locating.value = false
  }
}

// 加载JSON数据
const loadJsonData = async (jsonUrl, silent) => {
  try {
    const response = await fetch(jsonUrl)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const jsonData = await response.json()
    return jsonData
  } catch (error) {
    // silent 为 true 时不显示错误消息（用于自动加载JSON的情况）
    if (!silent) {
      console.error('加载JSON失败:', error)
      ElMessage.error('JSON文件加载失败')
    }
    return null
  }
}

// 解析JSON数据为识别结果
const parseJsonToExtractionResults = (jsonData) => {
  if (!jsonData) {
    return []
  }

  // 如果JSON是对象且包含metrics数组，则使用metrics
  // 如果包含pages数组，则使用pages
  let pages = []
  if (Array.isArray(jsonData)) {
    pages = jsonData
  } else if (jsonData.pages && Array.isArray(jsonData.pages)) {
    pages = jsonData.pages
  } else if (jsonData.metrics && Array.isArray(jsonData.metrics)) {
    pages = jsonData.metrics
  } else {
    return []
  }

  const results = []
  const fieldMap = new Map()

  // 遍历所有页面
  pages.forEach((page, pageIndex) => {
    if (!page.structured || !Array.isArray(page.structured)) {
      return
    }

    // 遍历结构化数据
    page.structured.forEach((block, blockIndex) => {
      if (!block.text || !block.pos) {
        return
      }

      // 提取文本内容
      const text = block.text.trim()
      if (!text || text.length < 2) {
        return
      }

      // 解析坐标（pos格式：[x1, y1, x2, y2, x3, y3, x4, y4]）
      const pos = block.pos
      if (!pos || pos.length < 8) {
        return
      }

      // 计算边界框
      const xs = [pos[0], pos[2], pos[4], pos[6]]
      const ys = [pos[1], pos[3], pos[5], pos[7]]
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const x2 = Math.max(...xs)
      const y2 = Math.max(...ys)
      const width = x2 - x
      const height = y2 - y

      // 根据文本内容判断字段类型（更智能的识别）
      let fieldName = ''
      const textLower = text.toLowerCase()

      // 标题类（outline_level > 0）
      if (block.outline_level && block.outline_level > 0) {
        fieldName = text.substring(0, 30) + (text.length > 30 ? '...' : '')
      } else if (text.match(/^[A-Z0-9-]{8,}$/)) {
        // 合同编号格式
        fieldName = '合同编号'
      } else if (text.includes('工程名称') || text.includes('项目名称')) {
        fieldName = '工程名称'
      } else if (text.includes('发包人') || (text.includes('甲方') && text.length < 50)) {
        fieldName = '发包人'
      } else if (text.includes('承包人') || (text.includes('乙方') && text.length < 50)) {
        fieldName = '承包人'
      } else if (text.match(/\d{4}年\d{1,2}月\d{1,2}日/) && text.includes('开工')) {
        fieldName = '计划开工日期'
      } else if (text.match(/\d{4}年\d{1,2}月\d{1,2}日/) && text.includes('竣工')) {
        fieldName = '计划竣工日期'
      } else if (text.match(/\d+天/) && (text.includes('工期') || text.includes('日历'))) {
        fieldName = '工期总日历天数'
      } else if (text.length > 50 && !fieldName) {
        // 长文本可能是工程名称或描述
        fieldName = '工程描述'
      } else {
        // 使用文本的前30个字符作为字段名
        fieldName = text.substring(0, 30).replace(/\s+/g, ' ') + (text.length > 30 ? '...' : '')
      }

      // 如果字段已存在，合并文本
      if (fieldMap.has(fieldName)) {
        const existing = fieldMap.get(fieldName)
        if (!existing.fieldValue.includes(text)) {
          existing.fieldValue += '\n' + text
        }
        // 更新置信度（取平均值）
        const newScore = (block.score || 0.9) * 100
        existing.confidence = Math.round((existing.confidence + newScore) / 2)
      } else {
        const result = {
          id: fieldMap.size + 1,
          name: fieldName,
          fieldValue: text,
          confidence: Math.round((block.score || 0.9) * 100),
          status: 'success',
          locationData: {
            page_number: page.page_id || (pageIndex + 1),
            x: x,
            y: y,
            width: width,
            height: height,
            pageWidth: page.page_image_width || page.width || 1190,
            pageHeight: page.page_image_height || page.height || 1684
          }
        }
        fieldMap.set(fieldName, result)
      }
    })
  })

  // 按页面和Y坐标排序
  const sortedResults = Array.from(fieldMap.values()).sort((a, b) => {
    if (a.locationData.page_number !== b.locationData.page_number) {
      return a.locationData.page_number - b.locationData.page_number
    }
    return a.locationData.y - b.locationData.y
  })

  return sortedResults
}

// 判断文件是否激活
const isFileActive = (file) => {
  if (!currentFile.value) {
    return false
  }
  // 优先使用 id 判断，如果没有 id 或 id 不匹配，再使用 name
  if (currentFile.value.id && file.id) {
    return currentFile.value.id === file.id
  }
  return currentFile.value.name === file.name
}

/**
 * 解析预览用文件类型（优先扩展名，避免 xlsx 等被误判为 text）
 * @param {Object} file 文件对象
 * @returns {string} 预览类型标识
 */
const resolvePreviewFileType = (file) => {
  const fileName = file?.name || file?.file_name || ''
  const fromExt = getFileTypeFromExtension(fileName)
  if (fromExt !== 'text') {
    return fromExt
  }
  const mime = String(file?.type || file?.mime_type || '').toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'application/msword') return 'doc'
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (mime === 'application/vnd.ms-excel') return 'xls'
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
  if (mime === 'application/vnd.ms-excel.sheet.macroenabled.12') return 'xlsm'
  if (mime === 'text/csv') return 'csv'
  if (mime === 'text/plain') return 'txt'
  if (mime.startsWith('image/')) return 'image'
  return fromExt
}

// 选择文件
const selectFile = async (file) => {
  currentFolderPreviewPath.value = ''
  currentFolderPreviewName.value = ''

  const resolvedType = resolvePreviewFileType(file)
  if (resolvedType && resolvedType !== file.type) {
    file.type = resolvedType
    const syncId = getFileIdentifier(file)
    if (syncId) {
      const fileIndex = fileList.value.findIndex((f) => String(getFileIdentifier(f)) === String(syncId))
      if (fileIndex !== -1) {
        fileList.value[fileIndex].type = resolvedType
      }
    }
  }

  // 清除所有文件的高亮状态
  fileList.value.forEach(function(f) {
    f.selected = false
  })

  // 设置当前文件为选中状态
  file.selected = true
  currentFile.value = file
  pdfDocumentLoaded.value = false
  extractionResults.value = []
  currentHighlightedField.value = null
  currentPage.value = 1 // 重置到第一页
  pdfScale.value = 1 // 重置缩放
  totalPages.value = 0 // 重置总页数

  // 重置PDF和DOCX源
  pdfSource.value = null
  docxSource.value = null
  docPreviewUrl.value = null
  excelSource.value = null
  csvData.value = []
  csvColumns.value = []
  // 清空DOC预览容器
  if (docPreviewContainerRef.value) {
    docPreviewContainerRef.value.innerHTML = ''
  }
  // 重置TXT内容
  txtContent.value = ''

  // 清除DOCX高亮
  clearDocxHighlights()

  // 清除PDF高亮
  if (directStyleLocatorService.value) {
    directStyleLocatorService.value.restoreAllOriginalStyles()
  }

  // 如果文件有 fileId 但没有 previewUrl，先获取预览URL（参考 Index.vue 的实现）
  if (file.fileId && !file.previewUrl) {
    try {
      const previewRes = await previewFileAPI(file.fileId)
      if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
        file.previewUrl = previewRes.data.preview_url
        // 更新文件列表中的预览URL
        const fileIndex = fileList.value.findIndex(f => f.fileId === file.fileId)
        if (fileIndex !== -1) {
          fileList.value[fileIndex].previewUrl = previewRes.data.preview_url
        }
      }
    } catch (e) {
    }
  }

  // 如果是PDF文件
  if (file.type === 'pdf') {
    pdfLoading.value = true
    // 先清空，确保组件重新渲染
    pdfSource.value = null
    await nextTick()

    try {
      // 加载PDF文件（使用获取到的预览URL）
      if (file.previewUrl) {
        // 等待 DOM 更新后再设置值，确保响应式追踪
        await nextTick()
        pdfSource.value = file.previewUrl
        // 再次等待，确保组件接收到新值
        await nextTick()
      } else {
        pdfSource.value = null
      }

      // 尝试加载对应的JSON文件（仅当明确配置了 jsonUrl 时）
      if (file.jsonUrl) {
        const jsonData = await loadJsonData(file.jsonUrl, false) // 显示错误消息
        if (jsonData) {
          // 解析JSON数据为识别结果
          extractionResults.value = parseJsonToExtractionResults(jsonData)
          // 更新总页数
          if (jsonData.total_page_number) {
            totalPages.value = jsonData.total_page_number
          } else if (Array.isArray(jsonData.metrics)) {
            totalPages.value = jsonData.metrics.length
          } else if (Array.isArray(jsonData)) {
            totalPages.value = jsonData.length
          }
          ElMessage.success(`已加载 ${extractionResults.value.length} 个识别结果`)
        }
      }
    } catch (error) {
      console.error('加载PDF失败:', error)
      // 即使加载失败，也尝试继续显示（可能是 Worker 相关警告）
      const errorMessage = error?.message || error?.toString() || ''
      const isWorkerError = errorMessage.includes('Worker') || errorMessage.includes('setup') || errorMessage.includes('polyfill')

      if (!isWorkerError) {
        // 只有非 Worker 相关错误才显示错误消息
        ElMessage.warning('PDF文件加载遇到问题，但将继续尝试显示')
      }
      // 不阻止预览，让组件继续尝试渲染
    } finally {
      pdfLoading.value = false
    }
  } else if (file.type === 'docx' || file.type === 'doc') {
    // DOCX/DOC文件
    docxLoading.value = true
    try {
      if (file.type === 'docx') {
        // DOCX文件使用vue-office-docx
        if (file.previewUrl) {
          docxSource.value = file.previewUrl
        } else {
          docxSource.value = null
        }
      } else if (file.type === 'doc') {
        // DOC文件使用后端转换服务转换为DOCX
        docxSource.value = null // 清空docx源
        docPreviewUrl.value = null // 清空预览URL

        try {
          ElMessage.info('正在转换 DOC 文件...')

          // 准备文件数据
          let fileToUpload = null
          let fileUrl = null

          if (file.raw) {
            // 如果有原始文件对象，直接使用
            fileToUpload = file.raw
          } else if (file.previewUrl) {
            // 如果有预览URL，使用URL方式
            if (file.previewUrl.startsWith('data:')) {
              // Data URL需要转换为File对象
              const base64Data = file.previewUrl.split(',')[1]
              const binaryString = atob(base64Data)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              const blob = new Blob([bytes], { type: 'application/msword' })
              fileToUpload = new File([blob], file.name || 'document.doc', { type: 'application/msword' })
            } else {
              // 普通URL
              fileUrl = file.previewUrl
            }
          }

          if (!fileToUpload && !fileUrl) {
            throw new Error('无法获取文件内容')
              }

          // 调用后端转换API
          const convertResponse = await convertDocToDocxAPI(fileToUpload, fileUrl)

          if (convertResponse.code === 200 && convertResponse.data) {
            const { file_id, preview_url } = convertResponse.data

            // 使用转换后的DOCX文件URL
            docxSource.value = preview_url

            ElMessage.success('DOC 文件转换成功')
          } else {
            console.error('转换失败，响应:', convertResponse)
            throw new Error(convertResponse.message || '转换失败')
              }
        } catch (docError) {
          console.error('DOC文件转换失败:', docError)
          docxSource.value = null
          docPreviewUrl.value = null

          // 尝试使用 docx-preview 直接预览（备用方案）
          try {
            if (file.previewUrl || file.raw) {
              ElMessage.info('尝试直接预览 DOC 文件...')

              // 等待 DOM 更新，确保 ref 可用
          await nextTick()

              // 再次等待一小段时间，确保 ref 已经渲染
              await new Promise(resolve => setTimeout(resolve, 200))

              // 获取预览容器元素（优先使用 ref，如果不可用则查询 DOM）
              let containerElement = docPreviewContainerRef.value
              if (!containerElement) {
                // 如果 ref 不可用，尝试从 DOM 中查找
                containerElement = document.querySelector('.docx-preview-container')
              }

              if (!containerElement) {
                throw new Error('预览容器未准备好，请稍后重试')
              }

              let arrayBuffer = null

              // 处理不同的数据格式
              if (file.previewUrl && file.previewUrl.startsWith('data:application/msword;base64,')) {
                // Data URL
                const base64 = file.previewUrl.split(',')[1]
                const binaryString = atob(base64)
                const len = binaryString.length
                const bytes = new Uint8Array(len)
                for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i)
                }
                arrayBuffer = bytes.buffer
              } else if (file.previewUrl && (file.previewUrl.startsWith('http://') || file.previewUrl.startsWith('https://'))) {
                // 完整URL
                const response = await fetch(file.previewUrl)
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
                arrayBuffer = await response.arrayBuffer()
              } else if (file.previewUrl && file.previewUrl.startsWith('/')) {
                // 相对路径，尝试从当前域名获取
                const fullUrl = window.location.origin + file.previewUrl
                const response = await fetch(fullUrl)
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
                arrayBuffer = await response.arrayBuffer()
              } else if (file.raw) {
                // 原始文件对象
                arrayBuffer = await file.raw.arrayBuffer()
              }

              if (arrayBuffer && containerElement) {
                // 验证 arrayBuffer 是否有效
                if (arrayBuffer.byteLength === 0) {
                  throw new Error('文件数据为空')
                }

                // 检查文件大小（DOC 文件通常至少有几个字节）
                if (arrayBuffer.byteLength < 100) {
                  throw new Error('文件数据过小，可能不是有效的 DOC 文件')
                }

            // 清空容器
                containerElement.innerHTML = ''

                // 尝试渲染，添加详细的错误处理
                try {
                  // docx-preview 主要支持 DOCX 格式，对 DOC 格式支持有限
                  // 如果文件是旧的 DOC 格式，可能会失败
                  await renderAsync(arrayBuffer, containerElement)

                  // 等待一下让渲染完成
                  await new Promise(resolve => setTimeout(resolve, 500))

                  // 检查是否成功渲染了内容
                  if (containerElement.children.length === 0 || containerElement.textContent.trim() === '') {
                    throw new Error('渲染后容器为空，docx-preview 可能不支持此 DOC 文件格式。建议转换为 DOCX 格式')
                  }

                  ElMessage.success('DOC 文件预览成功')
                  return // 成功预览，退出
            } catch (renderError) {
                  console.error('renderAsync 错误详情:', renderError)
                  // 提供更友好的错误信息
                  const errorMsg = renderError.message || '未知错误'
                  if (errorMsg.includes('childNodes') || errorMsg.includes('null')) {
                    throw new Error('docx-preview 不支持此 DOC 文件格式。docx-preview 库主要支持 DOCX 格式，对于旧的 DOC 格式支持有限。建议将文件转换为 DOCX 格式后重新上传')
                  }
                  throw new Error(`渲染失败: ${errorMsg}`)
            }
          } else {
                throw new Error('无法获取文件数据或容器不存在')
              }
          }
          } catch (previewError) {
            console.error('直接预览也失败:', previewError)
            // 如果直接预览也失败，显示错误信息
            await nextTick()
            await new Promise(resolve => setTimeout(resolve, 200))
            let containerElement = docPreviewContainerRef.value || document.querySelector('.docx-preview-container')
            if (containerElement) {
              containerElement.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #909399;">
                  <p style="font-size: 16px; margin-bottom: 10px;">.doc 格式文件预览失败</p>
                  <p style="font-size: 14px; color: #606266;">${previewError.message || docError.message || '请检查文件格式是否正确'}</p>
                  <p style="font-size: 12px; color: #909399; margin-top: 20px;">建议将文件转换为 .docx 格式后重新上传</p>
                </div>
              `
          }
            ElMessage.error('DOC文件预览失败: ' + (previewError.message || docError.message || '未知错误'))
            return
          }

          // 如果上面的备用方案也没有执行（比如没有 previewUrl），显示错误信息
          await nextTick()
          await new Promise(resolve => setTimeout(resolve, 200))
          let containerElement = docPreviewContainerRef.value || document.querySelector('.docx-preview-container')
          if (containerElement) {
            containerElement.innerHTML = `
              <div style="text-align: center; padding: 40px; color: #909399;">
                <p style="font-size: 16px; margin-bottom: 10px;">.doc 格式文件转换失败</p>
                <p style="font-size: 14px; color: #606266;">${docError.message || '请检查文件格式是否正确'}</p>
                <p style="font-size: 12px; color: #909399; margin-top: 20px;">建议将文件转换为 .docx 格式后重新上传</p>
              </div>
            `
          }
          ElMessage.error('DOC文件转换失败: ' + (docError.message || '未知错误'))
        }
      }

      // 尝试加载对应的JSON文件（仅当明确配置了 jsonUrl 时）
      if (file.jsonUrl) {
        try {
          const jsonData = await loadJsonData(file.jsonUrl, false) // 显示错误消息
          if (jsonData) {
            // 解析JSON数据为识别结果
            extractionResults.value = parseJsonToExtractionResults(jsonData)
            if (jsonData.total_page_number || jsonData.valid_page_number) {
              totalPages.value = jsonData.total_page_number || jsonData.valid_page_number
            } else if (Array.isArray(jsonData.pages)) {
              totalPages.value = jsonData.pages.length
            } else if (Array.isArray(jsonData.metrics)) {
              totalPages.value = jsonData.metrics.length
            } else if (Array.isArray(jsonData)) {
              totalPages.value = jsonData.length
            }
            ElMessage.success('已加载 ' + extractionResults.value.length + ' 个识别结果')
          }
        } catch (jsonError) {
          // JSON文件加载失败不影响预览，静默处理
        }
      }
    } catch (error) {
      console.error('加载Word文件失败:', error)
      ElMessage.error('Word文件加载失败')
    } finally {
      docxLoading.value = false
    }
  } else if (file.type === 'xlsx' || file.type === 'xlsm' || file.type === 'xls') {
    // Excel文件（支持 .xlsx, .xlsm, .xls）
    excelLoading.value = true
    try {
      // 如果是 XLS，需要先转换为 XLSX
      if (file.type === 'xls') {
        try {
          ElMessage.info('正在转换 XLS 文件...')
          let fileToUpload = null
          let fileUrl = null
          if (file.raw) {
            fileToUpload = file.raw
          } else if (file.previewUrl) {
            if (file.previewUrl.startsWith('data:')) {
              const base64Data = file.previewUrl.split(',')[1]
              const binaryString = atob(base64Data)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              const blob = new Blob([bytes], { type: 'application/vnd.ms-excel' })
              fileToUpload = new File([blob], file.name || 'document.xls', { type: 'application/vnd.ms-excel' })
            } else {
              fileUrl = file.previewUrl
            }
          }
          if (!fileToUpload && !fileUrl) {
            throw new Error('无法获取文件内容')
          }
          const convertResponse = await convertXlsToXlsxAPI(fileToUpload, fileUrl)
          if (convertResponse.code === 200 && convertResponse.data) {
            const { preview_url } = convertResponse.data
            excelSource.value = preview_url
            ElMessage.success('XLS 文件转换成功')
          } else {
            throw new Error(convertResponse.message || '转换失败')
          }
        } catch (xlsError) {
          console.error('XLS文件转换失败:', xlsError)
          ElMessage.error('XLS文件预览失败: ' + (xlsError.message || '未知错误'))
          excelSource.value = null
        }
        excelLoading.value = false
        return
      }

      if (file.previewUrl) {
        excelSource.value = file.previewUrl
      } else if (file.fileId) {
        // 如果有 fileId 但没有 previewUrl，尝试获取
        try {
          const previewRes = await previewFileAPI(file.fileId)
          if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
            file.previewUrl = previewRes.data.preview_url
            excelSource.value = previewRes.data.preview_url
            // 更新文件列表中的预览URL
            const fileIndex = fileList.value.findIndex(f => f.fileId === file.fileId)
            if (fileIndex !== -1) {
              fileList.value[fileIndex].previewUrl = previewRes.data.preview_url
            }
          } else {
            excelSource.value = null
          }
        } catch (e) {
          excelSource.value = null
        }
        if (!excelSource.value && file.fileId) {
          excelSource.value = getPreviewFileAPI(file.fileId)
        }
      } else {
        excelSource.value = null
      }
    } catch (error) {
      console.error('加载Excel失败:', error)
      ElMessage.error('Excel文件加载失败')
    } finally {
      excelLoading.value = false
    }
  } else if (file.type === 'txt') {
    // TXT文本文件
    txtLoading.value = true
    try {
      await loadTxtFile(file)
      ElMessage.success('文本文件加载成功')
    } catch (error) {
      console.error('加载文本文件失败:', error)
      ElMessage.error('文本文件加载失败')
      txtContent.value = ''
    } finally {
      txtLoading.value = false
    }
  } else if (file.type === 'image') {
    // 图片文件
    if (!file.previewUrl && file.fileId) {
      // 如果有 fileId 但没有 previewUrl，尝试获取
      try {
        const previewRes = await previewFileAPI(file.fileId)
        if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
          file.previewUrl = previewRes.data.preview_url
          // 更新文件列表中的预览URL
          const fileIndex = fileList.value.findIndex(f => f.fileId === file.fileId)
          if (fileIndex !== -1) {
            fileList.value[fileIndex].previewUrl = previewRes.data.preview_url
          }
        } else {
          // 如果获取失败，使用占位图
          file.previewUrl = generatePlaceholderImage(file.name.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, ''), 800, 1000)
        }
      } catch (e) {
        // 如果获取失败，使用占位图
        file.previewUrl = generatePlaceholderImage(file.name.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, ''), 800, 1000)
      }
    } else if (!file.previewUrl) {
      // 如果没有 fileId，使用占位图
      file.previewUrl = generatePlaceholderImage(file.name.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, ''), 800, 1000)
    }
  }
}

// 定位字段
const handleLocateField = async (field) => {
  if (!field.fieldValue || field.fieldValue.trim() === '') {
    ElMessage.warning('字段"' + field.name + '"无有效提取值，无法进行原文定位')
    return
  }

  if (!currentFile.value) {
    ElMessage.warning('当前文件不支持定位功能')
    return
  }

  // DOCX/DOC文件定位
  if (currentFile.value.type === 'docx' || currentFile.value.type === 'doc') {
    await handleLocateFieldInDocx(field)
    return
  }

  // PDF文件定位
  if (currentFile.value.type !== 'pdf') {
    ElMessage.warning('当前文件不支持定位功能')
    return
  }

  try {
    locating.value = true
    currentLocatingField.value = field.name
    currentHighlightedField.value = field.name

    // 等待PDF加载完成
    if (!pdfDocumentLoaded.value) {
      await new Promise((resolve) => {
        const checkLoaded = setInterval(() => {
          if (pdfDocumentLoaded.value) {
            clearInterval(checkLoaded)
            resolve()
          }
        }, 100)
      })
    }

    // 获取定位数据（从字段的locationData或从OCR数据中查找）
    let locationData = null

    // 获取PDF页面的实际尺寸（用于坐标转换）
    const getActualPageSize = async () => {
      // 等待PDF渲染完成
      await new Promise(resolve => setTimeout(resolve, 300))

      // 尝试从PDF容器获取实际尺寸
      const pdfContainer = document.querySelector('.vue-office-pdf-wrapper')
      if (pdfContainer) {
        // 查找当前页面的canvas
        const canvas = pdfContainer.querySelector('canvas')
        if (canvas) {
          // canvas的实际像素尺寸（更准确）
          const canvasWidth = canvas.width || canvas.offsetWidth
          const canvasHeight = canvas.height || canvas.offsetHeight

          if (canvasWidth > 0 && canvasHeight > 0) {
            return {
              width: canvasWidth,
              height: canvasHeight
            }
          }
        }

        // 备选：使用容器尺寸
        const rect = pdfContainer.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          return {
            width: rect.width,
            height: rect.height
          }
        }
      }

      // 默认：假设OCR坐标基于1190x1684（常见的OCR DPI 144下的A4尺寸）
      return {
        width: 1190,
        height: 1684
      }
    }

    const actualPageSize = await getActualPageSize()

    // 优先使用字段自带的locationData
    if (field.locationData) {
      locationData = {
        location_results: [{
          position_info: {
            page_number: field.locationData.page_number || 1,
            x: field.locationData.x || 0,
            y: field.locationData.y || 0,
            width: field.locationData.width || 100,
            height: field.locationData.height || 20
          },
          matched_text: field.fieldValue,
          confidence: field.confidence / 100,
          match_type: 'exact'
        }],
        pageWidth: field.locationData.pageWidth || actualPageSize.width,
        pageHeight: field.locationData.pageHeight || actualPageSize.height
      }
    }

    if (!locationData || !locationData.location_results || locationData.location_results.length === 0) {
      ElMessage.warning(`未找到字段"${field.name}"的定位数据`)
      return
    }

    // 初始化定位服务
    if (!directStyleLocatorService.value) {
      initPDFLocatorService()
      await nextTick()
    }

    if (!directStyleLocatorService.value) {
      throw new Error('PDF定位服务未初始化')
    }

    // 清除之前的高亮
    directStyleLocatorService.value.restoreAllOriginalStyles()

    // 等待一段时间确保PDF完全渲染
    await new Promise(resolve => setTimeout(resolve, 500))

    // 获取所有定位结果
    const locationResults = locationData.location_results

    // 跳转到第一个页面
    if (locationResults.length > 0) {
      const firstPage = locationResults[0].position_info.page_number || 1
      await directStyleLocatorService.value.jumpToPage(firstPage)

      // 等待页面跳转完成
      await new Promise(resolve => setTimeout(resolve, 300))

      // 为每个定位结果创建高亮
      for (const result of locationResults) {
        if (result.position_info) {
          // 优先使用locationData中的页面尺寸，其次使用从PDF获取的实际尺寸
          const pageWidth = (field.locationData && field.locationData.pageWidth) || (locationData && locationData.pageWidth) || 1190
          const pageHeight = (field.locationData && field.locationData.pageHeight) || (locationData && locationData.pageHeight) || 1684

          const position = {
            page: result.position_info.page_number || 1,
            x: result.position_info.x || 0,
            y: result.position_info.y || 0,
            width: result.position_info.width || 100,
            height: result.position_info.height || 20,
            pageWidth: pageWidth,
            pageHeight: pageHeight,
            text: result.matched_text || field.fieldValue,
            confidence: result.confidence || field.confidence / 100,
            type: 'text'
          }

          try {
            await directStyleLocatorService.value.highlightWithDirectStyleModification(position, {
              fieldName: field.name,
              confidence: result.confidence || field.confidence / 100,
              matchType: result.match_type || 'exact'
            })
          } catch (error) {
            console.error('高亮创建失败:', error)
          }
        }
      }

      ElMessage.success(`已定位字段"${field.name}"`)
    }
  } catch (error) {
    console.error('定位失败:', error)
    ElMessage.error('定位失败，请确保PDF已完全加载')
  } finally {
    locating.value = false
    currentLocatingField.value = null
  }
}

// 清除高亮
const handleClearHighlight = () => {
  // 清除PDF高亮
  if (directStyleLocatorService.value) {
    directStyleLocatorService.value.restoreAllOriginalStyles()
  }

  // 清除DOCX/DOC高亮
  if (currentFile.value && (currentFile.value.type === 'docx' || currentFile.value.type === 'doc')) {
    clearDocxHighlights()
  }

  currentHighlightedField.value = null
  ElMessage.success('已清除所有定位样式')
}

// 文件上传
const handleUpload = () => {
  if (uploadRef.value && uploadRef.value.$el) {
    const input = uploadRef.value.$el.querySelector('input')
    if (input) {
      input.click()
    }
  }
}

// 打开文件选择对话框
const handleSelectFile = () => {
  fileSelectDialogVisible.value = true
}

/**
 * 处理文件选择弹窗确认：支持 { folders, files, treeData }；SELF_AND_DESC 文件夹会从 treeData 匹配并合并 children 供左侧树展示
 * @param {Array|Object} payload 新格式为 { folders, files, treeData }；旧格式为 [{ file_id, file_name }, ...]
 */
const onFileSelectConfirm = async (payload) => {
  const folders = Array.isArray(payload) ? [] : (payload && payload.folders) ? payload.folders : []
  const fileItems = Array.isArray(payload) ? payload : (payload && payload.files) ? payload.files : []
  const treeRoots = Array.isArray(payload) ? null : (payload && payload.treeData != null ? payload.treeData : null)

  fileSelectEnrichedFolders.value = enrichFileSelectFoldersWithTreeChildren(folders, Array.isArray(treeRoots) ? treeRoots : [])

  fileSelectInitialFolders.value = folders.map((f) => ({
    folder_id: f.folder_id,
    folder_name: f.folder_name || '',
    folder_path: f.folder_path || '',
    scope: f.scope || 'SELF',
    eligible_count: f.eligible_count != null ? f.eligible_count : 0
  }))
  // 仅选择文件夹（files 为空）时保留现有 file_id 回传，保证二次打开弹窗可继续绑定已选文件夹
  const nextInitialFiles = (fileItems && fileItems.length > 0)
    ? fileItems
    : fileSelectInitialFiles.value
  fileSelectInitialFiles.value = nextInitialFiles.map((f) => ({
    file_id: f.file_id,
    file_name: f.file_name || '',
    folder_path: f.folder_path || ''
  }))

  if (folders.length === 0 && fileItems.length === 0) {
    return
  }

  try {
    // 将选中的文件合并进列表（文件夹范围保存在 fileSelectInitialFolders，供后续业务使用）
    const newFiles = []

    for (const item of fileItems) {
      // 检查文件是否已存在（根据 file_id 或 file_name）
      const exists = fileList.value.some(f => {
        return f.fileId === item.file_id || f.file_uuid === item.file_id || f.name === item.file_name
      })

      if (!exists) {
        // 根据文件名推断文件类型
        const fileName = item.file_name || ''
        const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''

        let fileType = 'text'
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
          fileType = 'image'
        } else if (ext === 'pdf') {
          fileType = 'pdf'
        } else if (ext === 'docx') {
          fileType = 'docx'
        } else if (ext === 'doc') {
          fileType = 'doc'
        } else if (ext === 'xlsx' || ext === 'xlsm') {
          fileType = ext === 'xlsm' ? 'xlsm' : 'xlsx'
        } else if (ext === 'xls') {
          fileType = 'xls'
        } else if (ext === 'csv') {
          fileType = 'csv'
        } else if (ext === 'txt') {
          fileType = 'txt'
        }

        // 创建文件对象（预览URL稍后通过API获取）
        const newFile = {
          id: item.file_id || Date.now() + Math.random(),
          name: fileName,
          type: fileType,
          previewUrl: '', // 初始为空，稍后通过API获取
          fileId: item.file_id, // 后端文件ID，用于后续操作
          file_uuid: item.file_id, // 兼容旧字段名
          file_size: item.file_size, // 文件大小（字节），供任务中心展示
          size: item.file_size,
          folderPath: item.folder_path || '',
          selected: false
        }

        newFiles.push(newFile)
        fileList.value.push(newFile)
      }
    }

    // 新增文件后仅自动选择第一个文件，预览URL由 selectFile 按需获取
    if (newFiles.length > 0) {
      const msgParts = []
      if (folders.length > 0) {
        msgParts.push(`${folders.length} 个文件夹`)
      }
      if (newFiles.length > 0) {
        msgParts.push(`新增 ${newFiles.length} 个文件`)
      }
      ElMessage.success(msgParts.length > 0 ? `已选择：${msgParts.join('，')}` : '已更新选择')

      // 自动选择并预览第一个新添加的文件
      const firstFile = newFiles[0]
      await selectFile(firstFile)
    } else {
      if (folders.length > 0) {
        ElMessage.success(`已选择 ${folders.length} 个文件夹`)
      } else {
        ElMessage.info('所选文件已存在于列表中')
      }
    }

    // 关闭对话框
    fileSelectDialogVisible.value = false
  } catch (error) {
    console.error('添加文件失败:', error)
    ElMessage.error('添加文件失败: ' + (error.message || '未知错误'))
  }
}

// 从文件扩展名获取文件类型（保留用于其他场景）
const getFileTypeFromExtension = (fileName) => {
  if (!fileName) return 'text'

  const ext = fileName.split('.').pop()?.toLowerCase()
  const extMap = {
    'pdf': 'pdf',
    'doc': 'doc',
    'docx': 'docx',
    'xls': 'xls',
    'xlsx': 'xlsx',
    'xlsm': 'xlsm',
    'csv': 'csv',
    'txt': 'txt',
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'gif': 'image',
    'bmp': 'image',
    'webp': 'image'
  }

  return extMap[ext] || 'text'
}

const beforeUpload = (file) => {
  const maxSize = 100 * 1024 * 1024 // 100MB
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过100MB')
    return false
  }
  return true
}

const handleFileChange = (file) => {
  // Element Plus upload组件的on-change事件参数格式：file对象包含raw属性
  if (!file || !file.raw) {
    console.error('文件对象格式错误:', file)
    ElMessage.error('文件读取失败，请重试')
    return false
  }

  // 支持的文件类型列表
  const supportedTypes = {
    // 图片类型
    images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],
    // 文档类型
    documents: [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
      'text/csv',
      'text/plain'
    ]
  }

  // 支持的文件扩展名
  const supportedExtensions = [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.xlsm',
    '.csv',
    '.txt',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'
  ]

  // 不支持的文件类型（需要特殊提示）
  const unsupportedTypes = {
    '.ppt': '.ppt（PowerPoint格式暂不支持）',
    '.pptx': '.pptx（PowerPoint格式暂不支持）',
    '.odt': '.odt（OpenDocument格式暂不支持）',
    '.rtf': '.rtf（RTF格式暂不支持）'
  }

  // 不支持的文件MIME类型映射
  const unsupportedMimeTypes = {
    'application/vnd.ms-powerpoint': '.ppt（PowerPoint格式暂不支持）',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx（PowerPoint格式暂不支持）',
    'application/vnd.oasis.opendocument.text': '.odt（OpenDocument格式暂不支持）',
    'application/rtf': '.rtf（RTF格式暂不支持）'
  }

  // 获取文件扩展名
  const fileName = file.name || ''
  const lastDotIndex = fileName.lastIndexOf('.')
  const fileExt = lastDotIndex !== -1 ? fileName.toLowerCase().substring(lastDotIndex) : ''
  const fileTypeLower = (file.type || '').toLowerCase()

  // 先通过扩展名检查是否为不支持的类型
  if (fileExt && unsupportedTypes[fileExt]) {
    ElMessage.warning('暂不支持' + unsupportedTypes[fileExt] + '，请使用支持的文档格式')
    return false
  }

  // 通过MIME类型检查是否为不支持的类型
  if (fileTypeLower && unsupportedMimeTypes[fileTypeLower]) {
    ElMessage.warning('暂不支持' + unsupportedMimeTypes[fileTypeLower] + '，请使用支持的文档格式')
    return false
  }

  // 检查是否为支持的图片类型
  var isSupportedImage = false
  for (let i = 0; i < supportedTypes.images.length; i++) {
    if (fileTypeLower.startsWith(supportedTypes.images[i].split('/')[0] + '/')) {
      isSupportedImage = true
      break
    }
  }

  // 检查是否为支持的文档类型
  var isSupportedDoc = false
  for (let i = 0; i < supportedTypes.documents.length; i++) {
    if (fileTypeLower === supportedTypes.documents[i].toLowerCase()) {
      isSupportedDoc = true
      break
    }
  }

  // 通过扩展名检查
  var isSupportedByExt = false
  for (let i = 0; i < supportedExtensions.length; i++) {
    if (fileExt === supportedExtensions[i].toLowerCase()) {
      isSupportedByExt = true
      break
    }
  }

  // 如果都不支持，提示用户
  if (!isSupportedImage && !isSupportedDoc && !isSupportedByExt) {
    const extName = fileExt || '该文件类型'
    ElMessage.warning('暂不支持' + extName + '格式，当前支持的格式：PDF、DOCX、XLSX、CSV、TXT、图片等')
    return false
  }

  // 确定文件类型
  var fileType = 'text'
  if (isSupportedImage || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].indexOf(fileExt.substring(1)) !== -1) {
    fileType = 'image'
  } else if (file.type === 'application/pdf' || fileExt === '.pdf') {
    fileType = 'pdf'
  } else if (file.type === 'application/msword' || fileExt === '.doc') {
    fileType = 'doc'
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExt === '.docx') {
    fileType = 'docx'
  } else if (file.type === 'application/vnd.ms-excel' || fileExt === '.xls') {
    fileType = 'xls'
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileExt === '.xlsx') {
    fileType = 'xlsx'
  } else if (file.type === 'application/vnd.ms-excel.sheet.macroEnabled.12' || fileExt === '.xlsm') {
    fileType = 'xlsm'
  } else if (file.type === 'text/csv' || fileExt === '.csv') {
    fileType = 'csv'
  } else if (file.type === 'text/plain' || fileExt === '.txt') {
    fileType = 'txt'
  }

  const newFile = {
    id: Date.now(),
    name: file.name,
    type: fileType,
    previewUrl: '',
    selected: false
  }

  // 使用Promise包装FileReader，确保文件读取完成后再添加到列表
  const readFile = function() {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader()
      reader.onload = function(e) {
        newFile.previewUrl = e.target.result
        resolve(newFile)
      }
      reader.onerror = function(e) {
        reject(new Error('文件读取失败'))
      }
      reader.readAsDataURL(file.raw)
    })
  }

  // 读取文件并添加到列表
  readFile().then(function(loadedFile) {
    fileList.value.unshift(loadedFile)
    selectFile(loadedFile)
    ElMessage.success('文件已选择')
  }).catch(function(error) {
    console.error('文件读取失败:', error)
    ElMessage.error('文件读取失败: ' + (error.message || '未知错误'))
  })

  return true
}

// 页码控制
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    scrollToPage(currentPage.value)
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    scrollToPage(currentPage.value)
  }
}

// 滚动到指定页面
const scrollToPage = (pageNumber) => {
  if (!pdfDocumentLoaded.value) {
    return
  }

  nextTick(() => {
      // 优先使用ref获取滚动容器
    let scrollContainer = previewRef.value
    if (!scrollContainer) {
      // 回退到使用querySelector
      scrollContainer = document.querySelector('.document-preview')
    }
    if (!scrollContainer) {
      return
    }

    // 查找PDF容器和页面元素
    const pdfContainer = document.querySelector('.vue-office-pdf-wrapper')
    if (!pdfContainer) {
      return
    }

    // 尝试多种选择器查找页面元素
    let pages = pdfContainer.querySelectorAll('canvas[data-page-number]')
    if (pages.length === 0) {
      pages = pdfContainer.querySelectorAll('canvas')
    }
    if (pages.length === 0) {
      pages = pdfContainer.querySelectorAll('.pdf-page')
    }
    if (pages.length === 0) {
      pages = pdfContainer.querySelectorAll('[data-page]')
    }
    if (pages.length === 0) {
      // 查找所有可能包含PDF页面的div
      pages = pdfContainer.querySelectorAll('div[style*="position"]')
    }

    if (pages.length === 0) {
      // 如果找不到页面元素，使用基于页数计算的方式
      const containerHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight
      const pageHeight = containerHeight / Math.max(totalPages.value, 1)
      const targetTop = (pageNumber - 1) * pageHeight

      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      })
      return
    }

    // 找到目标页面（页码从1开始，索引从0开始）
    const targetIndex = pageNumber - 1
    if (targetIndex >= 0 && targetIndex < pages.length) {
      const targetPage = pages[targetIndex]

      // 使用scrollIntoView方法（更可靠）
      targetPage.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      })
    } else {
      // 如果索引超出范围，尝试直接滚动
      const containerHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight
      const pageHeight = containerHeight / Math.max(totalPages.value, 1)
      const targetTop = (pageNumber - 1) * pageHeight

      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      })
    }
  })
}

// 监听页码变化
watch(currentPage, (newPage) => {
  if (pdfDocumentLoaded.value && newPage > 0 && newPage <= totalPages.value) {
    // 使用延迟确保DOM已更新
    setTimeout(() => {
      scrollToPage(newPage)
    }, 100)
  }
})

// 缩放控制
const zoomIn = () => {
  pdfScale.value = Math.min(pdfScale.value + 0.25, 3) // 最大放大3倍
  ElMessage.success(`已放大至 ${Math.round(pdfScale.value * 100)}%`)
}

const zoomOut = () => {
  pdfScale.value = Math.max(pdfScale.value - 0.25, 0.5) // 最小缩小至50%
  ElMessage.success(`已缩小至 ${Math.round(pdfScale.value * 100)}%`)
}

const zoomToFit = () => {
  pdfScale.value = 1 // 恢复原始大小
  ElMessage.success('已适应窗口大小')
}

// 全屏功能
const toggleFullscreen = () => {
  const pdfContainerWrapper = document.querySelector('.pdf-container-wrapper')
  if (!pdfContainerWrapper) {
    ElMessage.warning('未找到PDF容器')
    return
  }

  if (!isFullscreen.value) {
    // 进入全屏
    if (pdfContainerWrapper.requestFullscreen) {
      pdfContainerWrapper.requestFullscreen()
    } else if (pdfContainerWrapper.webkitRequestFullscreen) {
      pdfContainerWrapper.webkitRequestFullscreen()
    } else if (pdfContainerWrapper.mozRequestFullScreen) {
      pdfContainerWrapper.mozRequestFullScreen()
    } else if (pdfContainerWrapper.msRequestFullscreen) {
      pdfContainerWrapper.msRequestFullscreen()
    } else {
      ElMessage.warning('浏览器不支持全屏功能')
      return
    }
    isFullscreen.value = true
  } else {
    // 退出全屏
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen()
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen()
    }
    isFullscreen.value = false
  }
}

// 监听全屏状态变化
const handleFullscreenChange = () => {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  )
}

onMounted(() => {
  isViewerActive.value = true
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.addEventListener('mozfullscreenchange', handleFullscreenChange)
  document.addEventListener('MSFullscreenChange', handleFullscreenChange)

  // 初始化时加载模板列表
  loadTemplates(1, true)
  // 加载信息提取高级配置（切片字数、OVERLAP）
  loadInfoExtractionConfig()
})

onBeforeUnmount(() => {
  invalidateBatchExecute()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
  document.removeEventListener('MSFullscreenChange', handleFullscreenChange)

  // 清理宽度调整事件监听
  if (isResizing.value) {
    stopResize()
  }
  if (isResizingLeft.value) {
    stopLeftSidebarResize()
  }

  stopMockBulkProgressTimers()
})

const refresh = () => {
  if (currentFile.value) {
    selectFile(currentFile.value)
    ElMessage.success('已刷新')
  }
}

const download = () => {
  ElMessage.info('下载功能（演示模式）')
}

// 标签切换
const handleTabChange = (tab) => {
}

// 处理按钮 - 跳转任务中心
const handleGoToTaskCenter = () => {
  invalidateBatchExecute()
  emit('close-dialog')
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

// 处理按钮 - 返回文件管理
const handleGoToFileManager = () => {
  const basePath = '/file-manager'

  // 从 menuTree 中查找 file-manager 路由对应的菜单项，获取 menuId
  const menuItem = homeStore.findMenuItemByPath(basePath)
  let menuId = '750' // 默认值，如果查询不到则使用此值

  if (menuItem && menuItem.id) {
    menuId = String(menuItem.id)
  }

  const tabPath = `${basePath}?menuId=${menuId}`

  // 添加或激活标签页
  homeStore.addTab({
    id: 'file-manager',
    title: '文件管理',
    path: tabPath,
    name: '文件管理',
    meta: { title: '文件管理', keepAlive: true }
  })

  router.push(tabPath)
}

const handleChartRecognition = () => {
  ElMessage.info('图表识别功能（演示模式）')
}

const handleStampRecognition = () => {
  ElMessage.info('印章识别功能（演示模式）')
}

// 添加字段
const handleAddField = () => {
  if (!newField.value.name.trim()) {
    ElMessage.warning('请输入字段名称')
    return
  }

  fieldDefinitions.value.push({
    id: Date.now(),
    name: newField.value.name,
    description: newField.value.description
  })

  // 清空新字段输入
  newField.value = {
    name: '',
    description: ''
  }

  ElMessage.success('字段已添加')
}

// 删除字段
const handleRemoveField = (index) => {
  fieldDefinitions.value.splice(index, 1)
  ElMessage.success('字段已删除')
}

// 编辑配置
const handleEditConfig = () => {
  ElMessage.info('编辑配置')
}

// 导出配置
const handleExportConfig = async () => {
  // 检查是否选择了模板
  if (!selectedTemplate.value || selectedTemplate.value === '') {
    ElMessage.warning('请先选择模板')
    return
  }

  // 如果是默认模板（construction, non-construction等），使用本地导出
  if (['construction', 'non-construction', 'contract', 'audit', 'invoice', 'default'].includes(selectedTemplate.value)) {
    const config = {
      mode: configMode.value,
      prompt: extractPrompt.value,
      fields: fieldDefinitions.value
    }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'extraction-config.json'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('配置已导出')
    return
  }

  // 如果是 UUID，调用 API 导出
  try {
    const response = await exportTemplateConfigAPI(selectedTemplate.value)

    // 由于设置了 responseType: 'blob'，response.data 应该是 Blob 对象
    if (response && response.data instanceof Blob) {
      // 尝试从响应头获取文件名
      let fileName = 'template-config.json'

      // 如果响应头包含文件名
      if (response.headers) {
        const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition']
        if (disposition) {
          const fileNameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
          if (fileNameMatch && fileNameMatch[1]) {
            fileName = fileNameMatch[1].replace(/['"]/g, '')
            // 处理中文文件名编码（UTF-8''格式）
            if (fileName.includes("UTF-8''")) {
              fileName = decodeURIComponent(fileName.split("UTF-8''")[1] || fileName)
            } else if (fileName.startsWith('=')) {
              // 处理 =filename 格式
              fileName = decodeURIComponent(fileName.substring(1))
            }
          }
        }
      }

      // 创建下载链接并触发下载
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      ElMessage.success('配置已导出')
    } else if (response && response.code === 200 && response.data) {
      // 如果返回的是 JSON 格式（某些情况下可能不是 blob）
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template-config.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      ElMessage.success('配置已导出')
    } else {
      ElMessage.warning(response?.message || '导出失败：未返回有效数据')
    }
  } catch (error) {
    console.error('导出配置失败:', error)
    ElMessage.error('导出配置失败: ' + (error.message || '未知错误'))
  }
}

const handleDeleteTemplate = async () => {
  // 检查是否选择了模板
  if (!isTemplateSelected.value) {
    ElMessage.warning('请先选择要删除的模板')
    return
  }

  const templateUuid = selectedTemplate.value

  ElMessageBox.confirm('确定删除模板吗？删除后无法恢复。', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await deleteTemplateAPI(templateUuid)
      if (res.code === 200) {
        ElMessage.success('模板删除成功')
        // 清空模板选择
        selectedTemplate.value = ''
        fieldDefinitions.value = []
        extractPrompt.value = '请帮我结构化这个文件,结果以json形式返回'
        // 重新加载模板列表
        loadTemplates(1, true)
      } else {
        ElMessage.error(res.message || '删除模板失败')
      }
    } catch (error) {
      console.error('删除模板失败:', error)
      ElMessage.error(error.response?.data?.message || error.message || '删除模板失败')
    }
  }).catch(() => {})
}

const handleSaveTemplate = async () => {
  // 检查是否选择了模板
  if (!isTemplateSelected.value) {
    ElMessage.warning('请先选择要更新的模板')
    return
  }

  // 验证字段配置
  if (configMode.value === 'field' && fieldDefinitions.value.length === 0) {
    ElMessage.warning('请至少添加一个字段')
    return
  }

  // 验证字段名称
  if (configMode.value === 'field') {
    const emptyFields = fieldDefinitions.value.filter(f => !f.name || !f.name.trim())
    if (emptyFields.length > 0) {
      ElMessage.warning('请填写所有字段的名称')
      return
    }
  }

  const templateUuid = selectedTemplate.value

  // 从模板选项中查找当前模板的详细信息
  let currentTemplate = templateOptions.value.find(opt => opt.value === templateUuid)

  // 如果模板选项中没有详细信息，先获取模板详情
  if (!currentTemplate || !currentTemplate.originalData) {
    try {
      const detailRes = await getTemplateDetailAPI(templateUuid)
      if (detailRes.code === 200 && detailRes.data) {
        currentTemplate = {
          label: detailRes.data.template_name || '',
          description: detailRes.data.template_desc || '',
          originalData: detailRes.data
        }
      }
    } catch (e) {
    }
  }

  try {
    // 构建更新数据
    const updateData = {
      name: currentTemplate?.label || currentTemplate?.originalData?.template_name || '',
      description: currentTemplate?.description || currentTemplate?.originalData?.template_desc || '',
      rules: configMode.value === 'field' ? fieldDefinitions.value.map(field => ({
        name: field.name,
        description: field.description || '',
        type: field.type || 'String'
      })) : [],
      prompt: configMode.value === 'prompt' ? extractPrompt.value : '',
      template_type: configMode.value === 'field' ? '0' : '1',
      // 保持原有的文件夹信息
      folderId: currentTemplate?.originalData?.pid || null,
      path_uuid: currentTemplate?.originalData?.path_uuid || null,
      path_name: currentTemplate?.originalData?.path_name || null,
      category: currentTemplate?.originalData?.template_classification || 'personal'
    }

    const res = await updateTemplateAPI(templateUuid, updateData)
    if (res.code === 200) {
      ElMessage.success('模板更新成功')
      // 重新加载模板列表，确保数据同步
      loadTemplates(1, true)
    } else {
      ElMessage.error(res.message || '更新模板失败')
    }
  } catch (error) {
    console.error('更新模板失败:', error)
    ElMessage.error(error.response?.data?.message || error.message || '更新模板失败')
  }
}

// 加载模板
const loadTemplate = async (templateNameOrUuid) => {
  // 如果是默认模板名称（construction, non-construction, contract, audit等）
  if (['construction', 'non-construction', 'contract', 'audit', 'invoice', 'default'].includes(templateNameOrUuid)) {
    const saved = localStorage.getItem(`ocr_template_${templateNameOrUuid}`)
    if (saved) {
      try {
        const config = JSON.parse(saved)
        configMode.value = config.mode || 'field'
        extractPrompt.value = config.prompt || extractPrompt.value
        fieldDefinitions.value = config.fields || []
      } catch (e) {
        console.error('加载模板失败:', e)
        loadDefaultTemplate(templateNameOrUuid)
      }
    } else {
      // 加载默认模板
      loadDefaultTemplate(templateNameOrUuid)
    }
  } else {
    // 如果是 UUID，优先从下拉框数据中查找，避免重复请求
    const existingTemplate = templateOptions.value.find(opt => opt.value === templateNameOrUuid)

    if (existingTemplate && existingTemplate.originalData && existingTemplate.originalData.prompt) {
      // 使用下拉框中已有的数据
      try {
        const template = existingTemplate.originalData
        // 解析 prompt 字段中的字段配置（处理可能包含 \r\n 的 JSON 字符串）
        let rules = []
        try {
          if (template.prompt) {
            // 先清理可能的转义字符
            const cleanedPrompt = template.prompt.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
            rules = JSON.parse(cleanedPrompt)
          }
        } catch (e) {
          // 如果解析失败，尝试直接解析原始字符串
          try {
            rules = JSON.parse(template.prompt)
          } catch (e2) {
            console.error('二次解析也失败:', e2)
          }
        }

        // 设置字段定义
        if (Array.isArray(rules) && rules.length > 0) {
          fieldDefinitions.value = rules.map((rule, index) => ({
            id: rule.id || Date.now() + index,
            name: rule.name || '',
            description: rule.description || ''
          }))
        } else {
          fieldDefinitions.value = []
        }
        return
      } catch (error) {
      }
    }

    // 如果下拉框中没有数据或解析失败，从 API 加载模板详情
    try {
      const response = await getTemplateDetailAPI(templateNameOrUuid)
      if (response.code === 200 && response.data) {
        const template = response.data
        // 解析 prompt 字段中的字段配置
        let rules = []
        try {
          if (template.prompt) {
            // 处理可能包含转义字符的 JSON 字符串
            const cleanedPrompt = template.prompt.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
            rules = JSON.parse(cleanedPrompt)
          }
        } catch (e) {
          // 如果清理后解析失败，尝试直接解析
          try {
            rules = JSON.parse(template.prompt)
          } catch (e2) {
            console.error('二次解析也失败:', e2)
          }
        }

        // 设置字段定义
        if (Array.isArray(rules) && rules.length > 0) {
          fieldDefinitions.value = rules.map((rule, index) => ({
            id: rule.id || Date.now() + index,
            name: rule.name || '',
            description: rule.description || ''
          }))
        } else {
          fieldDefinitions.value = []
        }
      } else {
        ElMessage.warning(response.message || '加载模板失败')
      }
    } catch (error) {
      console.error('加载模板详情失败:', error)
      ElMessage.error('加载模板详情失败: ' + (error.message || '未知错误'))
    }
  }
}

// 匹配字段值（已接入真实实现，不再使用演示数据）
const matchFieldValue = (fieldName, fieldDescription) => {
  return null
}

// 加载默认模板
const loadDefaultTemplate = (templateName) => {
  if (templateName === 'contract') {
    fieldDefinitions.value = [
      { id: 1, name: '合同编号', description: '合同的唯一标识编号' },
      { id: 2, name: '工程名称', description: '工程的名称' },
      { id: 3, name: '发包人', description: '发包方名称' },
      { id: 4, name: '承包人', description: '承包方名称' },
      { id: 5, name: '计划开工日期', description: '计划开始施工的日期' },
      { id: 6, name: '计划竣工日期', description: '计划完成施工的日期' },
      { id: 7, name: '工期总日历天数', description: '工期总天数' }
    ]
  } else if (templateName === 'audit') {
    fieldDefinitions.value = [
      { id: 1, name: '报告标题', description: '审计报告的标题' },
      { id: 2, name: '报告年度', description: '审计报告所属年度' },
      { id: 3, name: '被审计单位', description: '被审计的单位名称' },
      { id: 4, name: '审计机构', description: '执行审计的机构名称' },
      { id: 5, name: '审计日期', description: '审计执行日期' },
      { id: 6, name: '审计意见', description: '审计意见或结论' }
    ]
  }
}

// 监听模板选择变化
watch(selectedTemplate, (newVal) => {
  // 恢复文件配置时跳过，避免 loadTemplate 覆盖已恢复的自定义字段（尤其 loadTemplate 异步完成时会覆盖）
  if (isRestoringFileSettings.value) return
  if (newVal) {
    loadTemplate(newVal)
  }
})

/**
 * 左侧栏批量执行上下文（供 buildToolBatchExecutePayload 使用）
 * @returns {Object} 上下文
 */
const getSidebarExecuteContext = () => ({
  files: fileList.value || [],
  fileTreeData: fileTreeData.value || [],
  fileSelectInitialFolders: fileSelectInitialFolders.value || [],
  fileSelectEnrichedFolders: fileSelectEnrichedFolders.value || []
})

// 执行弹框
const handleExecuteDialog = async () => {
  if (!hasSidebarExecuteScope.value) {
    ElMessage.warning('请先在左侧添加文件或文件夹')
    return
  }
  if (!isGlobalExtractConfigReady.value) {
    viewerTab.value = 'extract'
    ElMessage.warning('请先在右侧功能配置中完成抽取配置（选择模板或添加字段）')
    return
  }
  if (!applyGlobalExtractSettings()) {
    return
  }
  const formatDateTimeYMDHMS = (date = new Date()) => {
    const pad2 = (n) => String(n).padStart(2, '0')
    const yyyy = date.getFullYear()
    const MM = pad2(date.getMonth() + 1)
    const dd = pad2(date.getDate())
    const HH = pad2(date.getHours())
    const mm = pad2(date.getMinutes())
    const ss = pad2(date.getSeconds())
    return `${yyyy}年${MM}月${dd}日 ${HH}:${mm}:${ss}`
  }

  taskName.value = props.toolLabel + ' (' + formatDateTimeYMDHMS() + ')'
  taskRemark.value = ''
  batchRecognizeDialogVisible.value = true
}

/**
 * 批量执行：构建 exec_config（文件/文件夹均支持）
 * @param {Object} fileOrRow 文件或树节点
 * @returns {Object|null} exec 配置
 */
const buildExecConfigForBatch = (fileOrRow) => {
  if (fileOrRow && fileOrRow.nodeType === 'folder') {
    const path = normalizeFolderPathForTree(fileOrRow.folderPath || '')
    const settings = folderBatchSettingsMap.value[path] || buildGlobalExtractSettingsSnapshot()
    return buildExecConfigBySettings(settings)
  }
  const settings = fileOrRow?.settings || resolveBatchPreviewSettings(fileOrRow)
  return buildExecConfigBySettings(settings)
}

/**
 * 调用 BatchExecuteByFilter 创建任务（对齐工程项目）
 * @param {number} taskSwitch 1 立即执行 2 后台
 * @param {string} name 任务名称
 * @param {string} remark 任务备注
 * @returns {Promise<boolean>} 是否成功
 */
const runFileToPdfBatchExecute = async (taskSwitch, name, remark) => {
  if (!hasSidebarExecuteScope.value) {
    ElMessage.warning('请先在左侧添加文件或文件夹')
    return false
  }
  if (!name.trim()) {
    ElMessage.warning('请输入任务名称')
    return false
  }
  if (!applyGlobalExtractSettings()) {
    viewerTab.value = 'extract'
    ElMessage.warning('请先在右侧功能配置中完成抽取配置（选择模板或添加字段）')
    return false
  }

  const taskData = buildToolBatchExecutePayload({
    taskName: name,
    taskRemark: remark,
    toolLabel: props.toolLabel,
    bizType: 'fileToPdf',
    taskSwitch,
    buildExecConfig: buildExecConfigForBatch,
    sidebarContext: getSidebarExecuteContext(),
    parseStatus: ['parsed'],
    fileExtensions: []
  })

  const deletedFiles = (pendingDeleteRecords.value.files || []).map((item) => ({
    file_id: String(item.fileId || ''),
    folder_path: item.folderPath || ''
  })).filter((item) => item.file_id)
  if (deletedFiles.length > 0) {
    taskData.deleted_files = deletedFiles
  }

  batchExecuteAborted = false
  isViewerActive.value = true
  activeBatchExecuteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null

  let succeeded = false
  await runBatchExecuteWithTimeoutNav({
    taskName: name,
    requestFn: () => batchExecuteByFilterAPI(taskData, {
      signal: activeBatchExecuteAbortController ? activeBatchExecuteAbortController.signal : undefined
    }),
    openTaskCenter: () => {
      invalidateBatchExecute()
      emit('close-dialog')
      openTaskCenterWithRefresh(router, homeStore)
    },
    onError: (error) => {
      ElMessage.error('创建任务失败: ' + (error.message || '未知错误'))
    },
    onResponse: (response, { timeoutFallbackTriggered }) => {
      if (response.code === 200 || response.code === 201) {
        const taskUuid = response?.data?.task_uuid || response?.task_uuid || ''
        if (
          taskUuid &&
          props.eventKey &&
          !batchExecuteAborted &&
          isViewerActive.value &&
          !timeoutFallbackTriggered
        ) {
          eventBus.emit(props.eventKey, {
            taskUuid,
            taskName: name
          })
        }
        if (!timeoutFallbackTriggered) {
          ElMessage.success(`任务"${name}"创建成功`)
        }
        succeeded = true
        return
      }
      if (!timeoutFallbackTriggered) {
        ElMessage.error(response.message || '任务创建失败')
      } else {
        console.warn('超时兜底已触发，后续接口返回失败:', response)
      }
    }
  })
  return succeeded
}

const executeSwitch = async () => {
  batchExtracting.value = true
  try {
    const ok = await runFileToPdfBatchExecute(
      2,
      taskName.value.trim(),
      taskRemark.value.trim()
    )
    if (ok) {
      taskName.value = ''
      taskRemark.value = ''
      batchRecognizeDialogVisible.value = false
    }
  } finally {
    batchExtracting.value = false
  }
}

/**
 * 将 settings 转换为 BatchExecuteByFilter 的执行配置
 * @param {Object} settings 文件/文件夹设置
 * @returns {Object|null} { exec_mode, template_id?, custom_config? }
 */
const buildExecConfigBySettings = (settings) => {
  if (!settings || settings.configured !== true) {
    return null
  }
  const extraConfig = {
    merge_attachments: settings.mergeAttachments === true,
    chunk_size: typeof settings.chunkSize === 'number' ? settings.chunkSize : 12000,
    overlap: typeof settings.chunkOverlap === 'number' ? settings.chunkOverlap : 200
  }
  if (settings.mode === 'field') {
    if (settings.template && String(settings.template).trim()) {
      return {
        exec_mode: 'template',
        template_id: String(settings.template).trim(),
        custom_config: extraConfig
      }
    }
    const fields = (settings.fieldDefinitions || [])
      .filter((f) => f && f.name && String(f.name).trim())
      .map((f) => ({
        name: f.name || '',
        description: f.description || ''
      }))
    return {
      exec_mode: 'custom',
      custom_config: {
        mode: 'field',
        fields,
        ...extraConfig
      }
    }
  }
  return {
    exec_mode: 'custom',
    custom_config: {
      mode: 'prompt',
      prompt: settings.prompt || '',
      ...extraConfig
    }
  }
}

/**
 * 由 folderPath 在已选文件夹列表中找到 folder_id（优先匹配标准化路径）
 * @param {string} folderPath 文件夹路径
 * @returns {Object|null} 文件夹元信息
 */
const findSelectedFolderMetaByPath = (folderPath) => {
  const normalized = String(folderPath || '').replace(/\s*\/\s*/g, '/').replace(/^\/+|\/+$/g, '')
  const list = fileSelectInitialFolders.value || []
  let matched = list.find((f) => String(f.folder_path || '').replace(/\s*\/\s*/g, '/').replace(/^\/+|\/+$/g, '') === normalized)
  if (!matched) {
    matched = list.find((f) => String(f.folder_name || '') === String(folderPath || '').split('/').pop())
  }
  return matched || null
}

/**
 * 从左侧树按 folderPath 查找 folder_id（支持 SELF_AND_DESC 子目录节点）
 * @param {string} folderPath 文件夹路径（如：个人空间/会议纪要/临时文件）
 * @returns {string} 命中的 folder_id，未命中返回空字符串
 */
const findFolderIdByPathFromFileTree = (folderPath) => {
  const normalizedTarget = normalizeFolderPathForTree(folderPath)
  if (!normalizedTarget) {
    return ''
  }
  const stack = [...(fileTreeData.value || [])]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || node.nodeType !== 'folder') {
      continue
    }
    const nodePath = normalizeFolderPathForTree(node.folderPath || '')
    if (nodePath === normalizedTarget && node.folderId) {
      return String(node.folderId)
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children)
    }
  }
  return ''
}

const setResult = (response) => {
  // 解析后端返回的数据
  if (response && Array.isArray(response) && response.length > 0) {
    const resultData = response[0]

    // 解析 content 字段（JSON 字符串）
    if (resultData.disposal_result) {
      try {
        const contentData = JSON.parse(resultData.disposal_result)

        // 提取 final_result.items
        if (contentData.final_result && contentData.final_result.items && Array.isArray(contentData.final_result.items)) {
          // 将后端数据转换为前端展示格式
          extractionResults.value = contentData.final_result.items.map((item, index) => ({
            id: index + 1,
            name: item.name || '',
            fieldValue: item.value || '',
            confidence: 95, // 默认置信度，可以根据实际情况调整
            status: item.is_found ? 'success' : 'warning', // 根据 is_found 设置状态
            isFound: item.is_found || false,
            evidence: item.evidence || '',
            chunkId: item.chunk_id || '',
            description: item.description || '',
            evidenceList: item.evidence_list || []
          }))

          // 切换到解析结果标签页
          viewerTab.value = 'parse'
          extracting.value = false
        } else {
          ElMessage.warning('返回数据格式不正确')
          extracting.value = false
        }
      } catch (parseError) {
        console.error('解析返回数据失败:', parseError)
        ElMessage.error('解析返回数据失败')
        extracting.value = false
      }
    }
  }
}

const taskError = () => {
  extracting.value = false
}
defineExpose({
  setResult,
  taskError
})

/**
 * 保存设置：将右侧功能配置同步为全局配置（全部文件与文件夹共用）
 * @returns {void}
 */
const saveCurrentSettings = () => {
  if (isReadOnly.value) {
    return
  }
  applyGlobalExtractSettings()
}

// 暂存设置（不执行抽取）
const handleSaveSettings = () => {
  if (!currentFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }

  saveCurrentSettings()
  ElMessage.success('设置已暂存')
}

// 格式化设置保存时间
const formatSettingsTime = (timeString) => {
  if (!timeString) return ''
  try {
    const date = new Date(timeString)
    const now = new Date()
    const diff = now - date

    // 如果是一分钟内，显示"刚刚"
    if (diff < 60000) {
      return '刚刚'
    }
    // 如果是一小时内，显示分钟数
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}分钟前`
    }
    // 如果是一天内，显示小时数
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}小时前`
    }
    // 否则显示日期时间
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`
  } catch (error) {
    return ''
  }
}

// 防抖函数
const debounce = (fn, delay) => {
  let timer = null
  return function(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

// 自动将右侧全局配置同步到左侧树（防抖，无需选中文件）
const autoSaveSettings = debounce(() => {
  if (!isReadOnly.value && isGlobalExtractConfigReady.value) {
    applyGlobalExtractSettings()
  }
}, 1000)

// 监听提示词变化
watch(extractPrompt, () => {
  if (configMode.value === 'prompt' && !isReadOnly.value) {
    autoSaveSettings()
  }
})

// 监听字段定义变化
watch(fieldDefinitions, () => {
  if (configMode.value === 'field' && !isReadOnly.value) {
    autoSaveSettings()
  }
}, { deep: true })

// 模板/字段变更后立即尝试同步（配置就绪时）
watch([selectedTemplate, fieldDefinitions], () => {
  if (isRestoringFileSettings.value) return
  if (!isReadOnly.value && isGlobalExtractConfigReady.value) {
    applyGlobalExtractSettings()
  }
}, { deep: true })

// 处理模板选择变化（用户手动选择模板时触发）
const handleTemplateChange = (templateValue) => {
  // 如果选择的是"新增模板"，跳转到模板管理页面
  if (templateValue === '__add_template__') {
    // 使用 homeStore 添加标签页并跳转（与其他跳转函数保持一致）
    const basePath = '/template-management'

    // 从 menuTree 中查找 template-management 路由对应的菜单项，获取 menuId
    const menuItem = homeStore.findMenuItemByPath(basePath)
    let menuId = '752' // 默认值，如果查询不到则使用此值

    if (menuItem && menuItem.id) {
      menuId = String(menuItem.id)
    }

    // 构建带参数的路由路径
    const tabPath = `${basePath}?menuId=${menuId}`

    // 添加标签页（如果已存在会自动激活）
    homeStore.addTab({
      id: 'template-management',
      title: '模板管理',
      path: tabPath,
      name: '模板管理',
      meta: { title: '模板管理', keepAlive: true }
    })

    // 路由跳转（与 LeftMenu 中的实现保持一致）
    router.push(tabPath)

    // 重置下拉框的值
    nextTick(() => {
      selectedTemplate.value = ''
    })
    return
  }

  if (!currentFile.value || isReadOnly.value) {
    return
  }

  // 如果选择了模板，加载模板字段（直接加载，由 loadTemplate 覆盖，避免清空导致的竞态：暂存时 fieldDefinitions 仍为空）
  if (templateValue && templateValue !== '') {
    loadTemplate(templateValue)
  }
}

// 监听模板选择变化（字段模式）
watch(selectedTemplate, () => {
  if (configMode.value === 'field' && currentFile.value && !isReadOnly.value) {
    autoSaveSettings()
  }
})

// 工具函数
const formatResult = (result) => {
  return JSON.stringify(result, null, 2)
}

const copyResult = () => {
  if (parseResult.value) {
    navigator.clipboard.writeText(formatResult(parseResult.value))
    ElMessage.success('已复制到剪贴板')
  }
}

const getStatusTagType = (status) => {
  switch (status) {
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'error': return 'danger'
    default: return 'info'
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'success': return '准确'
    case 'warning': return '部分准确'
    case 'error': return '不准确'
    default: return '未知'
  }
}

const getConfidenceColor = (confidence) => {
  if (confidence >= 90) return '#52c41a'
  if (confidence >= 70) return '#faad14'
  return '#f5222d'
}

// 批量设置
const handleBatchSettings = async () => {
  if (!hasBatchSettingsTargets.value) {
    ElMessage.warning('请先勾选文件或文件夹')
    return
  }

  // 与右侧功能配置保持一致：打开弹框时若模板列表未加载则先加载
  if (templateOptions.value.length === 0) {
    await loadTemplates(1, true)
  }

  // 初始化批量设置对话框
  batchSettingsMode.value = 'field'
  batchSettingsPrompt.value = ''
  batchSettingsTemplateMap.value = { type: 'template', value: '' }
  batchSettingsFieldMap.value = []
  batchSettingsNewFieldMap.value = { name: '', description: '' }

  // 检查所有选中目标（文件 + 文件夹）的设置，如果配置统一则恢复该配置
  const files = getBatchSettingsTargetFiles()
  const selectedFolderSettings = (checkedFolderPaths.value || [])
    .map((folderPath) => folderBatchSettingsMap.value[folderPath])
    .filter((setting) => setting && setting.configured && setting.mode === 'field')
  const fileSettings = files
    .map((f) => f.settings)
    .filter((setting) => setting && setting.configured && setting.mode === 'field')
  const combinedSettings = [...selectedFolderSettings, ...fileSettings]

  if (combinedSettings.length > 0) {
    const firstSetting = combinedSettings[0]
    const allSame = combinedSettings.every((setting) => {
      if (firstSetting.template && setting.template) {
        return firstSetting.template === setting.template
      }
      const firstDefs = firstSetting.fieldDefinitions || []
      const currentDefs = setting.fieldDefinitions || []
      if (!firstSetting.template && !setting.template) {
        return JSON.stringify(firstDefs) === JSON.stringify(currentDefs)
      }
      return false
    })

    if (allSame) {
      if (firstSetting.template) {
        batchSettingsTemplateMap.value = {
          type: 'template',
          value: firstSetting.template
        }
      } else if (firstSetting.fieldDefinitions && firstSetting.fieldDefinitions.length > 0) {
        batchSettingsTemplateMap.value = {
          type: 'custom',
          value: ''
        }
        batchSettingsFieldMap.value = JSON.parse(JSON.stringify(firstSetting.fieldDefinitions))
      }
    }
  }

  batchSettingsDialogVisible.value = true
}

// 确认批量设置
const handleBatchSettingsConfirm = () => {
  const targetFiles = getBatchSettingsTargetFiles()
  if (!hasBatchSettingsTargets.value) {
    ElMessage.warning('请先勾选文件或文件夹')
    return
  }

  // 验证统一配置
  const setting = batchSettingsTemplateMap.value
  if (!setting) {
    ElMessage.warning('请选择字段配置方式')
    return
  }
  if (setting.type === 'template' && !setting.value) {
    ElMessage.warning('请选择模板')
    return
  } else if (setting.type === 'custom') {
    if (!batchSettingsFieldMap.value || batchSettingsFieldMap.value.length === 0) {
      ElMessage.warning('请至少添加一个自定义字段')
      return
    }
  }

  // 保存设置到选中的文件（所有文件使用相同配置）
  let template = ''
  let fieldDefinitions = []

  if (batchSettingsTemplateMap.value) {
    const setting = batchSettingsTemplateMap.value
    if (setting.type === 'template') {
      template = setting.value || ''
      fieldDefinitions = []
    } else if (setting.type === 'custom') {
      template = ''
      fieldDefinitions = JSON.parse(JSON.stringify(batchSettingsFieldMap.value || []))
    }
  }

  /**
   * 生成用于文件夹展示的批量设置快照
   * @param {void} _ 占位参数，无实际意义
   * @returns {Object} 文件夹行可复用的 settings 结构
   */
  const folderSettingSnapshot = {
    mode: batchSettingsMode.value,
    prompt: '',
    template: template,
    fieldDefinitions: JSON.parse(JSON.stringify(fieldDefinitions)),
    configured: true,
    configuredAt: new Date().toISOString()
  }

  if (checkedFolderPaths.value && checkedFolderPaths.value.length > 0) {
    const nextFolderSettingMap = { ...folderBatchSettingsMap.value }
    checkedFolderPaths.value.forEach((folderPath) => {
      nextFolderSettingMap[folderPath] = JSON.parse(JSON.stringify(folderSettingSnapshot))
    })
    folderBatchSettingsMap.value = nextFolderSettingMap
  }

  targetFiles.forEach((targetFile) => {
    const targetFileId = String(getFileIdentifier(targetFile))
    const fileIndex = fileList.value.findIndex(f => {
      const fileIdentifier = getFileIdentifier(f)
      return String(fileIdentifier) === targetFileId
    })

    if (fileIndex !== -1) {
      // 初始化settings对象（如果不存在）
      if (!fileList.value[fileIndex].settings) {
        fileList.value[fileIndex].settings = {}
      }

      // 保存设置信息（所有文件使用相同配置）
      fileList.value[fileIndex].settings = {
        mode: folderSettingSnapshot.mode,
        prompt: folderSettingSnapshot.prompt,
        template: folderSettingSnapshot.template,
        fieldDefinitions: JSON.parse(JSON.stringify(folderSettingSnapshot.fieldDefinitions)),
        configured: true,
        configuredAt: folderSettingSnapshot.configuredAt
      }
    }
  })

  // 若当前文件在批量选中列表中，同步右侧配置面板，避免后续 saveCurrentSettings 用旧配置覆盖批量设置
  if (currentFile.value) {
    const currentFileId = getFileIdentifier(currentFile.value)
    const currentInBatch = targetFiles.some(file => String(getFileIdentifier(file)) === String(currentFileId))
    if (currentInBatch) {
      configMode.value = batchSettingsMode.value
      selectedTemplate.value = template
      fieldDefinitions.value = JSON.parse(JSON.stringify(fieldDefinitions))
      extractPrompt.value = batchSettingsMode.value === 'prompt' ? batchSettingsPrompt.value : ''
    }
  }

  if (targetFiles.length > 0) {
    ElMessage.success(`已为 ${targetFiles.length} 个文件保存设置`)
  } else {
    ElMessage.success(`已记录 ${checkedFolderPaths.value.length} 个文件夹的批量设置`)
  }
  batchSettingsDialogVisible.value = false
}

// 取消批量设置
const handleBatchSettingsCancel = () => {
  batchSettingsDialogVisible.value = false
  // 重置状态
  batchSettingsMode.value = 'field'
  batchSettingsPrompt.value = ''
  batchSettingsTemplateMap.value = { type: 'template', value: 'construction' }
  batchSettingsFieldMap.value = []
  batchSettingsNewFieldMap.value = { name: '', description: '' }
}

// 批量设置：切换字段模式（模板/自定义）
const handleBatchFieldModeChange = () => {
  const setting = batchSettingsTemplateMap.value
  if (!setting) return

  if (setting.type === 'custom') {
    // 切换到自定义模式，初始化字段数组（如果不存在）
    if (!batchSettingsFieldMap.value) {
      batchSettingsFieldMap.value = []
    }
  } else if (setting.type === 'template') {
    // 切换到模板模式，清空自定义字段
    batchSettingsFieldMap.value = []
  }
}

// 批量设置：从模板加载字段到自定义字段编辑区（与功能配置模板列表一致，支持 API 模板 UUID）
const handleLoadFieldsFromTemplate = async (templateValue) => {
  if (!batchSettingsFieldMap.value) {
    batchSettingsFieldMap.value = []
  }

  // 优先从 templateOptions（与功能配置一致）中查找模板（UUID 或接口返回的模板）
  const existingTemplate = templateOptions.value.find(opt => opt.value === templateValue)
  if (existingTemplate && existingTemplate.originalData && existingTemplate.originalData.prompt) {
    try {
      const template = existingTemplate.originalData
      let rules = []
      try {
        const cleanedPrompt = (template.prompt || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
        rules = JSON.parse(cleanedPrompt)
      } catch (e) {
        try {
          rules = JSON.parse(template.prompt)
        } catch (e2) {
          console.error('解析模板 prompt 失败:', e2)
        }
      }
      if (Array.isArray(rules) && rules.length > 0) {
        rules.forEach(rule => {
          batchSettingsFieldMap.value.push({
            id: Date.now() + Math.random(),
            name: rule.name || '',
            description: rule.description || ''
          })
        })
        ElMessage.success(`已从模板加载 ${rules.length} 个字段`)
        return
      }
    } catch (e) {
      console.error('从模板加载字段失败:', e)
    }
  }

  // 兼容：从 localStorage 读取旧版默认模板名（default/contract/invoice/audit）
  const saved = localStorage.getItem(`ocr_template_${templateValue}`)
  if (saved) {
    try {
      const config = JSON.parse(saved)
      const templateFields = config.fields || []
      if (templateFields.length === 0) {
        loadDefaultTemplateFields(templateValue)
        return
      }
      templateFields.forEach(field => {
        batchSettingsFieldMap.value.push({
          id: Date.now() + Math.random(),
          name: field.name || '',
          description: field.description || ''
        })
      })
      ElMessage.success(`已从模板加载 ${templateFields.length} 个字段`)
    } catch (e) {
      console.error('加载模板失败:', e)
      loadDefaultTemplateFields(templateValue)
    }
  } else {
    loadDefaultTemplateFields(templateValue)
  }
}

// 获取默认模板的字段定义（纯函数，用于创建任务时填充 parameter_template，避免载荷为空）
const getDefaultTemplateFields = (templateName) => {
  if (templateName === 'default' || templateName === 'contract' || templateName === 'construction' || templateName === 'non-construction') {
    return [
      { name: '合同编号', description: '合同的唯一标识编号' },
      { name: '工程名称', description: '工程的名称' },
      { name: '发包人', description: '发包方名称' },
      { name: '承包人', description: '承包方名称' },
      { name: '计划开工日期', description: '计划开工的日期' },
      { name: '计划竣工日期', description: '计划竣工的日期' },
      { name: '工期总日历天数', description: '工期总日历天数' }
    ]
  }
  if (templateName === 'invoice') {
    return [
      { name: '发票号码', description: '发票的唯一编号' },
      { name: '开票日期', description: '发票开具日期' },
      { name: '金额', description: '发票金额' },
      { name: '税额', description: '发票税额' }
    ]
  }
  if (templateName === 'audit') {
    return [
      { name: '报告标题', description: '审计报告的标题' },
      { name: '报告年度', description: '审计报告所属年度' },
      { name: '被审计单位', description: '被审计的单位名称' },
      { name: '审计意见', description: '审计意见类型' }
    ]
  }
  return []
}

// 加载默认模板字段（前端原型用）
const loadDefaultTemplateFields = (templateName) => {
  if (!batchSettingsFieldMap.value) {
    batchSettingsFieldMap.value = []
  }

  let defaultFields = []

  if (templateName === 'default' || templateName === 'contract' || templateName === 'construction' || templateName === 'non-construction') {
    // 合同模板默认字段
    defaultFields = [
      { id: Date.now() + 1, name: '合同编号', description: '合同的唯一标识编号' },
      { id: Date.now() + 2, name: '工程名称', description: '工程的名称' },
      { id: Date.now() + 3, name: '发包人', description: '发包方名称' },
      { id: Date.now() + 4, name: '承包人', description: '承包方名称' },
      { id: Date.now() + 5, name: '计划开工日期', description: '计划开工的日期' },
      { id: Date.now() + 6, name: '计划竣工日期', description: '计划竣工的日期' },
      { id: Date.now() + 7, name: '工期总日历天数', description: '工期总日历天数' }
    ]
  } else if (templateName === 'invoice') {
    // 发票模板默认字段
    defaultFields = [
      { id: Date.now() + 1, name: '发票号码', description: '发票的唯一编号' },
      { id: Date.now() + 2, name: '开票日期', description: '发票开具日期' },
      { id: Date.now() + 3, name: '金额', description: '发票金额' },
      { id: Date.now() + 4, name: '税额', description: '发票税额' }
    ]
  } else if (templateName === 'audit') {
    // 审计报告模板默认字段
    defaultFields = [
      { id: Date.now() + 1, name: '报告标题', description: '审计报告的标题' },
      { id: Date.now() + 2, name: '报告年度', description: '审计报告所属年度' },
      { id: Date.now() + 3, name: '被审计单位', description: '被审计的单位名称' },
      { id: Date.now() + 4, name: '审计意见', description: '审计意见类型' }
    ]
  }

  // 追加到现有字段数组
  defaultFields.forEach(field => {
    batchSettingsFieldMap.value.push({
      id: Date.now() + Math.random(),
      name: field.name,
      description: field.description
    })
  })

  ElMessage.success(`已加载 ${defaultFields.length} 个默认字段`)
}

// 批量设置：添加字段
const handleBatchAddField = () => {
  const newField = batchSettingsNewFieldMap.value
  if (!newField || !newField.name.trim()) {
    ElMessage.warning('请输入字段名称')
    return
  }

  // 确保字段数组存在
  if (!batchSettingsFieldMap.value) {
    batchSettingsFieldMap.value = []
  }

  // 添加字段
  batchSettingsFieldMap.value.push({
    id: Date.now() + Math.random(),
    name: newField.name,
    description: newField.description || ''
  })

  // 清空新字段输入
  batchSettingsNewFieldMap.value = {
    name: '',
    description: ''
  }

  ElMessage.success('字段已添加')
}

// 批量设置：删除字段
const handleBatchRemoveField = (index) => {
  if (batchSettingsFieldMap.value && batchSettingsFieldMap.value[index]) {
    batchSettingsFieldMap.value.splice(index, 1)
    ElMessage.success('字段已删除')
  }
}

// 取消批量执行
const handleBatchRecognizeCancel = () => {
  batchRecognizeDialogVisible.value = false
  // 重置状态
  taskName.value = ''
  taskRemark.value = ''
}

// 导出解析结果
const handleExportResults = (format) => {
  if (extractionResults.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  if (format === 'excel') {
    exportToExcel()
  } else if (format === 'csv') {
    exportToCsv()
  } else if (format === 'markdown') {
    exportToMarkdown()
  } else if (format === 'json') {
    exportToJson()
  }
}

// 导出为Excel（表格格式）
const exportToExcel = () => {
  try {
    // 转换数据格式为表格
    const excelData = extractionResults.value.map(item => ({
      '字段名称': item.name || '',
      '字段值': item.fieldValue || '暂无',
      '置信度': item.confidence ? `${Math.round(item.confidence)}%` : '-',
      '状态': getStatusText(item.status) || '-'
    }))

    // 生成文件名
    const fileName = currentFile.value?.name
      ? currentFile.value.name.replace(/\.[^/.]+$/, '')
      : '提取结果'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fullFileName = `${fileName}_提取结果_${timestamp}`

    // 导出Excel
    exportFn([excelData], ['提取结果'], fullFileName)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请重试')
  }
}

// 导出为CSV
const exportToCsv = () => {
  try {
    // CSV表头
    const headers = ['字段名称', '字段值', '置信度', '状态']
    const csvRows = [headers.join(',')]

    // 添加数据行
    extractionResults.value.forEach(item => {
      const row = [
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${(item.fieldValue || '暂无').replace(/"/g, '""')}"`,
        `"${item.confidence ? `${Math.round(item.confidence)}%` : '-'}"`,
        `"${(getStatusText(item.status) || '-').replace(/"/g, '""')}"`
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')

    // 生成文件名
    const fileName = currentFile.value?.name
      ? currentFile.value.name.replace(/\.[^/.]+$/, '')
      : '提取结果'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fullFileName = `${fileName}_提取结果_${timestamp}.csv`

    // 下载文件
    downloadFile(csvContent, fullFileName, 'text/csv;charset=utf-8;')
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请重试')
  }
}

// 导出为Markdown
const exportToMarkdown = () => {
  try {
    let markdown = '# 提取结果\n\n'
    markdown += '| 字段名称 | 字段值 | 置信度 | 状态 |\n'
    markdown += '|---------|--------|--------|------|\n'

    extractionResults.value.forEach(item => {
      const fieldName = item.name || ''
      const fieldValue = item.fieldValue || '暂无'
      const confidence = item.confidence ? `${Math.round(item.confidence)}%` : '-'
      const status = getStatusText(item.status) || '-'
      markdown += `| ${fieldName} | ${fieldValue} | ${confidence} | ${status} |\n`
    })

    // 生成文件名
    const fileName = currentFile.value?.name
      ? currentFile.value.name.replace(/\.[^/.]+$/, '')
      : '提取结果'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fullFileName = `${fileName}_提取结果_${timestamp}.md`

    // 下载文件
    downloadFile(markdown, fullFileName, 'text/markdown')
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请重试')
  }
}

// 导出为JSON
const exportToJson = () => {
  try {
    const jsonData = JSON.stringify(extractionResults.value, null, 2)

    // 生成文件名
    const fileName = currentFile.value?.name
      ? currentFile.value.name.replace(/\.[^/.]+$/, '')
      : '提取结果'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fullFileName = `${fileName}_提取结果_${timestamp}.json`

    // 下载文件
    downloadFile(jsonData, fullFileName, 'application/json')
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请重试')
  }
}

// 通用文件下载函数
const downloadFile = (content, fileName, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 初始化
onMounted(async () => {
  // 已从路由/props 拉取列表并 await selectFile(首文件) 时置 true，避免末尾再 selectFile 一次导致 PDF 重复加载（易 OOM）
  let didInitialSelectFromPropsOrRoute = false
  retainedEmptyFolderPaths.value = []

  // 优先使用 props 参数，如果没有则使用路由参数
  const fileIds = props.files || route.query.files
  const fileNames = props.names || route.query.names
  const toolType = props.tool || route.query.tool

  if (fileIds && fileNames) {
    try {
      const ids = fileIds.split(',')
      const names = decodeURIComponent(fileNames).split(',')

      // 创建新文件列表
      const receivedFiles = []

      // 根据接收到的文件信息创建文件列表
      for (let index = 0; index < ids.length; index++) {
        const id = ids[index]
        const fileName = names[index] || '文件' + (index + 1)
        const parts = fileName.split('.')
        const ext = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : ''
        let fileType = 'text'
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].indexOf(ext) !== -1) {
          fileType = 'image'
        } else if (ext === 'pdf') {
          fileType = 'pdf'
        } else if (ext === 'doc') {
          fileType = 'doc'
        } else if (ext === 'docx') {
          fileType = 'docx'
        } else if (ext === 'xlsx' || ext === 'xlsm') {
          fileType = ext === 'xlsm' ? 'xlsm' : 'xlsx'
        } else if (ext === 'xls') {
          fileType = 'xls'
        } else if (ext === 'csv') {
          fileType = 'csv'
        } else if (ext === 'txt') {
          fileType = 'txt'
        }

        // 使用后端 file_id 作为 id，保证 getFileIdentifier 与创建任务时 file_uuid 一致（后端校验文件存在性）
        // 若使用自增数字作为 id，创建任务会传错 file_uuid 导致“文件不存在”
        const newFile = {
          id: id,
          name: fileName,
          type: fileType,
          previewUrl: '', // 初始为空，稍后通过API获取
          jsonUrl: '',
          selected: false,
          fileId: id,
          file_uuid: id // 兼容旧字段名
        }

        receivedFiles.push(newFile)
      }

      // 将接收到的文件添加到文件列表顶部
      if (receivedFiles.length > 0) {
        // 获取接收到的文件名称集合
        const receivedFileNames = new Set(receivedFiles.map(f => f.name))

        // 过滤掉fileList中与接收到的文件同名的文件（去重）
        const existingFiles = fileList.value.filter(file => !receivedFileNames.has(file.name))

        // 合并文件列表，接收到的文件在前面
        fileList.value = [...receivedFiles, ...existingFiles]

        // 仅自动选择并预览第一个文件，预览URL由 selectFile 按需获取
        const firstFile = receivedFiles[0]
        await selectFile(firstFile)
        didInitialSelectFromPropsOrRoute = true
      }
    } catch (error) {
      console.error('解析文件参数失败:', error)
    }
  }

  // 去重文件列表（移除重复的文件名）
  deduplicateFileList()

  // 默认选择第一个文件（未从 props/路由完成首文件选择时才执行，避免与上文重复触发 vue-office-pdf）
  if (fileList.value.length > 0 && !didInitialSelectFromPropsOrRoute) {
    await selectFile(fileList.value[0])
  }

  // 文档预览页面应该是可编辑的，允许用户进行功能配置操作
  // 只有在任务结果页面（有taskId参数）才是只读的
  // 这里检查路由参数，如果有taskId则只读，否则可编辑
  if (route.query.taskId) {
    isReadOnly.value = true
  } else {
    isReadOnly.value = false
  }
})
</script>

<style scoped>
.ocr-viewer {
  display: flex;
  align-items: stretch;
  height: calc(100vh - 100px);
  overflow: hidden;
  background: var(--sd-surface-1, #f4f4f4);
}

/* 左右侧栏底栏统一高度与顶部分割线，保证三栏底部对齐 */
.ocr-viewer :deep(.ocr-sidebar-footer),
.ocr-viewer .ocr-sidebar-footer {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
}

/* 三栏顶栏统一高度，底边线水平对齐 */
.ocr-column-head {
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
}

.ocr-outline-btn {
  width: 100%;
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--sd-primary, #195fb4);
  border: 1px solid var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
}

.ocr-outline-btn:hover,
.ocr-outline-btn:focus {
  color: var(--sd-primary-dark, #0f4a8c);
  border-color: var(--sd-primary-dark, #0f4a8c);
  background: var(--sd-primary-light, #e8f0f8);
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

.ocr-footer-btn {
  width: 100%;
  height: 32px;
  min-height: 32px;
}

/* 左侧面板外层：由 inline width 控制宽度；纵向 flex 让内层侧边栏 flex:1 能吃到与中间区一致的拉伸高度 */
.left-sidebar-shell {
  align-self: stretch;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  background: var(--sd-canvas, #ffffff);
}

.left-sidebar-shell.resizable-left-sidebar {
  transition: width 0s;
}

.file-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow-y: auto;
  min-height: 0;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.file-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-area {
  margin-bottom: 10px;
  padding: 0;
}

.upload-area {
  margin-bottom: 12px;
  padding: 0;
}

.file-list {
  position: relative;
  flex: 1;
  overflow: hidden;
  margin-bottom: 12px;
}

.select-all-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
  border-radius: 4px;
}

.selected-count {
  font-size: 12px;
  color: #909399;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  margin-bottom: 3px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  gap: 8px;
}

.file-item:hover {
  background: #f5f7fa;
}

.file-item.active {
  background: #ecf5ff;
  color: #409EFF;
}

.file-tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  box-sizing: border-box;
}

.file-tree-node .el-checkbox {
  margin-right: 8px;
}

.file-tree-node.active {
  background: #ecf5ff;
  color: #409EFF;
}

:deep(.el-tree-v2__row:hover) .file-tree-node {
  background: #f5f7fa;
}

:deep(.el-tree-v2__node) {
  width: 100%;
}

.batch-actions-bar {
  display: flex;
  flex-direction: column;
  /* padding: 10px 12px; */
  /* background: #f5f7fa; */
  /* border-bottom: 1px solid #e4e7ed; */
  gap: 8px;
}

.file-icon {
  margin-right: 6px;
  font-size: 16px;
}

.folder-icon {
  margin-right: 6px;
  font-size: 16px;
  color: #e6a23c;
}

.file-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-badge {
  margin-left: auto;
}

.storage-info {
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.storage-text {
  font-size: 11px;
  color: #909399;
}

/* 中间查看器 */
.center-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.viewer-header {
  position: sticky;
  top: 0;
  z-index: 100;
  justify-content: space-between;
  box-shadow: none;
  margin-bottom: 0;
}

.viewer-header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
}

.viewer-header-actions > * + * {
  margin-left: 8px;
}

.folder-list-header {
  padding: 10px 12px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
  flex-shrink: 0;
}

.folder-list-title-wrap {
  display: flex;
  align-items: center;
}

.folder-list-title {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.folder-list-count {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.folder-list-delete-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.page-controls {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.page-controls > * + * {
  margin-left: 6px;
}

.page-info {
  font-size: 13px;
  color: #303133;
  min-width: 55px;
  text-align: center;
}

/* 右侧面板标签页 */
.sidebar-tabs {
  flex-shrink: 0;
}

.sidebar-tabs.ocr-column-head {
  padding: 0 12px;
}

.sidebar-tabs.ocr-column-head :deep(.el-tabs__header) {
  margin: 0;
  height: 100%;
}

.sidebar-tabs.ocr-column-head :deep(.el-tabs__nav-wrap) {
  height: 100%;
}

.sidebar-tabs.ocr-column-head :deep(.el-tabs__nav-scroll) {
  height: 100%;
  display: flex;
  align-items: center;
}

.sidebar-tabs.ocr-column-head :deep(.el-tabs__item) {
  height: 32px;
  line-height: 32px;
  font-size: 14px;
  color: var(--sd-ink-muted, #525252);
}

.sidebar-tabs.ocr-column-head :deep(.el-tabs__item.is-active) {
  color: var(--sd-primary, #195fb4);
}

.sidebar-tabs.ocr-column-head :deep(.el-tabs__active-bar) {
  background-color: var(--sd-primary, #195fb4);
}

.viewer-links {
  margin-left: auto;
}

.document-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  margin-top: 0;
  padding-top: 0;
  border-top: 5px solid #e4e7ed;
}

.folder-list-content {
  flex: 1;
  min-height: 0;
  padding: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.folder-list-content :deep(.el-auto-resizer) {
  flex: 1;
}

.folder-list-table-wrap {
  flex: 1;
  min-height: 0;
}

.folder-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.folder-list-pagination {
  margin-top: 10px;
  text-align: right;
}

.folder-selection-bar {
  margin-bottom: 8px;
}

.folder-file-name-cell {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.folder-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-action-cell {
  display: flex;
  align-items: center;
}

.folder-action-cell > * + * {
  margin-left: 8px;
}

.new-feature-banner {
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  flex-shrink: 0;
}

.banner-content {
  display: flex;
  align-items: center;
}

.banner-title {
  font-size: 14px;
  font-weight: 500;
}

.banner-desc {
  margin-left: 12px;
  font-size: 12px;
  opacity: 0.9;
}

.process-buttons {
  display: none;
}

.document-preview {
  flex: 1;
  overflow-y: auto; /* 确保垂直滚动正常工作 */
  overflow-x: auto; /* 允许水平滚动（放大时可能需要） */
  padding: 0;
  background: #f5f7fa;
  display: flex;
  align-items: flex-start; /* 改为flex-start，确保内容从顶部开始 */
  justify-content: center;
  /* 确保滚轮事件可以正常工作 */
  -webkit-overflow-scrolling: touch;
}

.pdf-container-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.docx-container-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
}

.docx-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 20px;
  background: #fff;
}

.doc-html-content {
  width: 100%;
  max-width: 900px;
  padding: 40px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  line-height: 1.6;
  color: #333;
  overflow-y: auto;
}

.doc-html-content :deep(p) {
  margin: 12px 0;
}

.doc-html-content :deep(h1),
.doc-html-content :deep(h2),
.doc-html-content :deep(h3),
.doc-html-content :deep(h4),
.doc-html-content :deep(h5),
.doc-html-content :deep(h6) {
  margin-top: 20px;
  margin-bottom: 12px;
  font-weight: bold;
}

.doc-html-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.doc-html-content :deep(table td),
.doc-html-content :deep(table th) {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.doc-html-content :deep(table th) {
  background-color: #f5f5f5;
  font-weight: bold;
}

.doc-html-content :deep(ul),
.doc-html-content :deep(ol) {
  margin: 12px 0;
  padding-left: 30px;
}

.doc-html-content :deep(li) {
  margin: 6px 0;
}

.doc-html-content {
  width: 100%;
  max-width: 900px;
  padding: 40px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  line-height: 1.6;
  color: #333;
  overflow-y: auto;
}

.doc-html-content :deep(p) {
  margin: 12px 0;
}

.doc-html-content :deep(h1),
.doc-html-content :deep(h2),
.doc-html-content :deep(h3),
.doc-html-content :deep(h4),
.doc-html-content :deep(h5),
.doc-html-content :deep(h6) {
  margin-top: 20px;
  margin-bottom: 12px;
  font-weight: bold;
}

.doc-html-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.doc-html-content :deep(table td),
.doc-html-content :deep(table th) {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.doc-html-content :deep(table th) {
  background-color: #f5f5f5;
  font-weight: bold;
}

.doc-html-content :deep(ul),
.doc-html-content :deep(ol) {
  margin: 12px 0;
  padding-left: 30px;
}

.doc-html-content :deep(li) {
  margin: 6px 0;
}

.pdf-container {
  width: 100%;
  height: 100%;
  max-width: 1200px;
  max-height: 100%;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: visible; /* 改为visible，让内容可以滚动 */
  position: relative;
}

.loading-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #909399;
}

.image-preview {
  width: 100%;
  height: 100%;
  max-width: 800px;
  max-height: 1000px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: auto;
}

.empty-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-notice-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.doc-notice-content {
  max-width: 600px;
  text-align: center;
}

.excel-container-wrapper {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.excel-container {
  width: 100%;
  height: 100%;
  min-height: 600px;
}

.csv-container-wrapper {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.csv-container {
  width: 100%;
  height: 100%;
  padding: 8px;
}

.csv-preview {
  height: 100%;
  overflow: auto;
}

.txt-container-wrapper {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.txt-container {
  width: 100%;
  height: 100%;
  padding: 16px;
}

.text-preview {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #fff;
  padding: 16px;
  border-radius: 4px;
}


.empty-icon {
  margin-bottom: 20px;
}

.parse-result {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 300px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-content {
  margin: 0;
  padding: 16px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 250px;
  overflow-y: auto;
  background: #f5f7fa;
  border-radius: 4px;
}

/* 右侧配置面板 */
.right-sidebar {
  background: var(--sd-canvas, #ffffff);
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  align-self: stretch;
  min-height: 0;
}

/* 可调整宽度的右侧面板 */
.right-sidebar.resizable-sidebar {
  min-width: 260px;
  max-width: 700px;
  transition: width 0s; /* 拖拽时禁用过渡动画 */
  flex-shrink: 0; /* 防止被压缩 */
}

/* 文件预览隐藏时，右侧面板铺满剩余空间 */
.right-sidebar-fullwidth {
  flex: 1;
  max-width: none !important;
  min-width: 0 !important;
}

/* 分隔线（调整宽度） */
.resizer {
  width: 4px;
  background: #e4e7ed;
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10;
}

.resizer:hover {
  background: var(--sd-primary, #195fb4);
}

.resize-icon {
  font-size: 12px;
  color: var(--sd-ink-subtle, #8c8c8c);
  pointer-events: none;
}

.resizer:hover .resize-icon {
  color: var(--sd-primary, #195fb4);
}

/* 拖拽时的样式 */
:global(body.resizing) {
  user-select: none;
  cursor: col-resize;
}

:global(body.resizing) .resizer {
  background-color: var(--sd-primary, #195fb4);
  opacity: 1;
}

:global(body.resizing) .resize-icon {
  color: #fff;
}

.config-header {
  padding: 12px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.edit-icon {
  cursor: pointer;
  color: #909399;
  font-size: 16px;
}

.edit-icon:hover {
  color: var(--sd-primary, #195fb4);
}

.config-tabs {
  padding: 6px;
  border-bottom: 1px solid #e4e7ed;
}

.config-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow-y: auto;
}

/* 字段模式样式 */
.settings-status-banner {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  margin-bottom: 12px;
  background: var(--sd-primary-soft, #f0f7ff);
  border: 1px solid var(--sd-primary-light, #e8f0f8);
  border-radius: 4px;
  font-size: 13px;
  color: var(--sd-primary, #195fb4);
}

.settings-status-banner > * + * {
  margin-left: 8px;
}

.settings-status-banner--hint {
  background: #fdf6ec;
  border-color: #faecd8;
  color: #e6a23c;
}

.settings-status-banner .status-icon {
  font-size: 16px;
  color: #67c23a;
}

.settings-status-banner .status-text {
  flex: 1;
  font-weight: 500;
}

.settings-status-banner .status-time {
  font-size: 12px;
  color: #909399;
}

.field-mode-header {
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  box-sizing: border-box;
  flex-shrink: 0;
}

.field-mode-header.ocr-column-head {
  height: 56px;
  min-height: 56px;
  display: flex;
  align-items: center;
}

.config-container .settings-status-banner {
  margin: 0 0 12px;
}

.config-section-block {
  margin-bottom: 16px;
}

.config-section-block:last-child {
  margin-bottom: 12px;
}

.config-section-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  padding-left: 8px;
  border-left: 3px solid var(--sd-primary, #195fb4);
  line-height: 1.4;
  box-sizing: border-box;
}

.config-section-block .extract-advanced-config,
.config-section-block .template-select-control,
.config-section-block .field-config-body {
  width: 100%;
  box-sizing: border-box;
}

/* 模板选择下拉框样式 */
:deep(.template-select-dropdown) {
  .el-select-dropdown__list {
    padding-bottom: 50px; /* 为浮动选项留出空间 */
  }
}

/* 新增模板选项样式 - 浮动显示 */
:deep(.floating-add-option) {
  position: sticky !important;
  bottom: 0 !important;
  z-index: 10 !important;
  background: var(--sd-canvas, #ffffff) !important;
  border-top: 1px solid var(--sd-hairline, #e0e0e0) !important;
  margin-top: 4px !important;
  padding-top: 8px !important;
  color: var(--sd-primary, #195fb4) !important;
  font-weight: 500 !important;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1) !important;
}

:deep(.floating-add-option:hover) {
  background-color: var(--sd-primary-light, #e8f0f8) !important;
}

.mode-tabs {
  display: flex;
  gap: 0;
  align-items: center;
  background: #f5f7fa;
  border-radius: 4px;
}

.mode-label {
  padding: 6px 12px;
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.mode-tab {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  background: transparent;
  border: 1px solid transparent;
  transition: all 0.3s;
}

.mode-tab:hover {
  color: #409EFF;
}

.mode-tab.active {
  background: #fff;
  color: #303133;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.mode-tab.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.config-container {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 12px 0;
  background: var(--sd-canvas, #ffffff);
  box-sizing: border-box;
}

.extract-advanced-config {
  padding: 12px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  background: var(--sd-surface-1, #f4f4f4);
}

.extract-advanced-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.extract-advanced-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.extract-advanced-form :deep(.el-form-item__label) {
  padding-bottom: 4px;
  line-height: 1.4;
  white-space: normal;
  word-break: break-all;
}

.extract-advanced-form-item :deep(.el-form-item__content) {
  line-height: 1.4;
}

.extract-advanced-number {
  width: 100%;
  max-width: 180px;
}

.extract-advanced-config .config-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  line-height: 1.5;
  word-break: break-all;
}

.config-content-prompt {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow-y: auto;
  min-height: 0;
}

.config-content-field {
  display: block;
  background: var(--sd-canvas, #ffffff);
}

.config-fields-panel {
  margin-bottom: 12px;
}

.field-config-body {
  width: 100%;
  box-sizing: border-box;
}

.config-add-field-bottom {
  width: 100%;
}

.config-actions-bottom {
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  background: #fff;
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  margin-top: auto;
}

.field-config-header {
  margin-bottom: 8px;
}

.field-config-title {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.field-config-title > * + * {
  margin-left: 6px;
}

.field-config-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  width: 100%;
}

.field-config-actions > * {
  margin-left: 8px;
  margin-bottom: 8px;
}

.field-config-actions > *:first-child {
  margin-left: 0;
}

.field-config-desc {
  font-size: 11px;
  color: #909399;
  margin-bottom: 12px;
  line-height: 1.5;
}

.field-definition-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
}

.field-definition-list > * + * {
  margin-top: 10px;
}

.field-item {
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  background: var(--sd-canvas, #ffffff);
  padding: 12px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field-item > * + * {
  margin-top: 10px;
}

.field-item:hover {
  border-color: var(--sd-primary, #195fb4);
  box-shadow: 0 2px 8px rgba(25, 95, 180, 0.1);
}

.field-item-new {
  border-style: dashed;
  background: var(--sd-surface-1, #f4f4f4);
}

.field-item-new:hover {
  border-color: var(--sd-primary, #195fb4);
  background: var(--sd-primary-light, #e8f0f8);
}

.field-item-content {
  display: flex;
  flex-direction: column;
}

.field-item-content > * + * {
  margin-top: 10px;
}

.field-row {
  display: flex;
  align-items: center;
}

.field-label-col {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  width: 72px;
  padding-right: 10px;
  box-sizing: border-box;
  white-space: nowrap;
}

.field-label-text {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
}

.field-required-mark {
  flex-shrink: 0;
  width: 8px;
  margin-right: 2px;
  font-size: 12px;
  line-height: 1;
  color: #f56c6c;
  text-align: center;
}

.field-required-mark--empty {
  visibility: hidden;
}

.field-input {
  flex: 1;
  min-width: 0;
  width: auto;
}

.field-item-action {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #f0f2f5;
  margin-top: 4px;
}

.config-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
  line-height: 1.6;
}

.config-editor {
  margin-bottom: 12px;
}

.config-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.template-selector {
  margin-bottom: 16px;
}

.template-select-section {
  background: var(--sd-canvas, #ffffff);
}

.template-select-control {
  width: 100%;
}

.extract-button {
  margin-bottom: 16px;
}

/* 抽取结果展示 */
.extraction-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.extraction-results-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-runtime-execute-panel {
  flex-shrink: 0;
  max-height: 45%;
  overflow-y: auto;
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
  background: #fafafa;
}

.extraction-results.is-executing .task-runtime-execute-panel {
  flex: 1;
  max-height: none;
  border-bottom: none;
}

.task-runtime-elapsed {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 12px;
}

.task-runtime-spin {
  color: #409eff;
  flex-shrink: 0;
}

.results-header {
  padding: 12px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: flex-start;
  align-items: flex-start;
}

.results-header .header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.results-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.results-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.result-item {
  margin-bottom: 10px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.result-item:hover {
  background: #f5f7fa;
  border-color: #409EFF;
}

.result-item.highlighted {
  background: #ecf5ff;
  border-color: #409EFF;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-field-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.result-value {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  word-break: break-word;
}

.result-metrics {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.result-confidence {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.result-confidence-text {
  font-size: 11px;
  color: #909399;
  min-width: 35px;
}

.hidden-upload {
  display: none;
}

/* 模板分配弹框样式 */
.template-assign-content {
  padding: 0;
}

.assign-tip {
  margin-bottom: 0;
}

/* 响应式调整 */
@media (max-width: 1400px) {
  .right-sidebar {
    width: 340px;
  }
}

/* 批量执行弹框样式 */
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

.batch-file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.file-count {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.batch-mode-header {
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 12px;
}

.batch-config-prompt,
.batch-config-field {
  padding: 12px 0;
}

.batch-config-prompt .config-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
  line-height: 1.5;
  padding: 0 4px;
}

.batch-config-prompt .config-editor {
  margin-top: 12px;
}

.batch-config-field .field-config-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
  line-height: 1.5;
  padding: 0 4px;
}

/* 文件选择对话框样式 */
.file-select-dialog {
  .el-dialog__body {
    padding: 20px;
    max-height: 70vh;
    overflow-y: auto;
  }
}

.file-select-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-select-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.file-select-list {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  background: #fafbfc;
}

.file-select-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 原型：模拟批量进度弹层（纵向步骤 + 手风琴文件夹） */
.mock-bulk-progress-dialog .el-dialog__header {
  padding-bottom: 0;
}

.mock-bulk-progress-dialog .el-dialog__body {
  padding-top: 8px;
}

.mock-bulk-progress__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.mock-bulk-progress__title-text {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  line-height: 1.5;
}

.mock-bulk-progress__steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mock-bulk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid transparent;
}

.mock-bulk-row__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.mock-bulk-row__label {
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mock-bulk-row__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.mock-bulk-row__ratio {
  font-size: 13px;
  color: #606266;
}

.mock-bulk-row__icon {
  font-size: 18px;
}

.mock-bulk-row__icon--muted {
  color: #c0c4cc;
}

.mock-bulk-row--child {
  margin-left: 8px;
}

.mock-bulk-row--parent {
  font-weight: 600;
}

.mock-bulk-row--success {
  background: linear-gradient(90deg, #f0fff4 0%, #ffffff 100%);
  border-color: #b7eb8f;
}

.mock-bulk-row--success .mock-bulk-row__icon {
  color: #52c41a;
}

.mock-bulk-row--running {
  background: linear-gradient(90deg, #e6f4ff 0%, #ffffff 100%);
  border-color: #91caff;
}

.mock-bulk-row--running .mock-bulk-row__icon {
  color: #1677ff;
}

.mock-bulk-row--pending {
  background: #fafafa;
  border-color: #ebeef5;
}

.mock-bulk-folder-shell {
  border-radius: 10px;
  border: 1px solid #ebeef5;
  overflow: hidden;
  background: #fff;
}

.mock-bulk-folder-collapse {
  border: none;
}

.mock-bulk-folder-collapse :deep(.el-collapse-item__header) {
  padding: 0 12px;
  height: 44px;
  font-weight: 500;
}

.mock-bulk-folder-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.mock-bulk-folder-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}

.mock-bulk-folder-meta {
  font-size: 12px;
  color: #909399;
  font-weight: 400;
}

.mock-bulk-folder-body {
  max-height: 200px;
  overflow-y: auto;
  padding: 4px 8px 10px;
}
</style>
