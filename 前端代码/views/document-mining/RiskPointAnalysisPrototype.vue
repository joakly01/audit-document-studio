<template>
  <div
    class="risk-point-prototype"
    :class="{ 'risk-point-prototype--embedded': isSecondaryExecution }"
    v-loading="resultViewLoading"
    element-loading-text="加载任务结果..."
  >
    <!-- 上半区：配置与执行 -->
    <el-card
      class="risk-point-prototype__card"
      :class="{ 'risk-point-prototype__card--results-focus': analysisDone }"
      shadow="never"
    >
      <div class="risk-point-prototype__upper">
        <div class="left-sidebar-group">
          <div
            class="risk-point-prototype__pane risk-point-prototype__pane--files risk-point-prototype__files-sidebar left-sidebar-shell resizable-left-sidebar"
            :style="{ width: leftSidebarWidth + 'px' }"
          >
            <OcrLeftSidebar
              v-if="isResultViewMode"
              :bindings="taskPreviewSidebarBindings"
              mode="preview"
              :task-id="resolvedTaskId"
              :readonly="true"
              :allow-mode-switch="false"
              :hide-batch-execute="true"
              :show-preview-toggle="true"
              :allow-folder-click-in-preview="true"
              compact-file-header
              layout-mode="full"
              empty-description="暂无任务文件"
            />
            <OcrLeftSidebar
              v-else
              :bindings="leftSidebarBindings"
              layout-mode="tree-select"
              mode="edit"
              :readonly="false"
              :allow-mode-switch="false"
              :show-preview-toggle="true"
              compact-file-header
              empty-description="暂无文件，请点击「选择文件」添加"
            />
          </div>
          <div
            class="risk-point-prototype__resizer risk-point-prototype__resizer--left"
            title="拖拽调整宽度"
            @mousedown="startLeftSidebarResize"
          >
            <el-icon class="risk-point-prototype__resize-icon">
              <DArrowRight />
            </el-icon>
          </div>
        </div>

        <div
          v-show="showFilePreview || isFolderListPreviewMode"
          class="risk-point-prototype__center-viewer"
        >
          <OcrFolderPreviewPanel
            v-if="isFolderListPreviewMode"
            :folder-name="currentFolderPreviewName"
            :display-total="folderPreviewDisplayTotal"
            :deleted-file-count="pendingDeleteRecords.files.length"
            :deleted-folder-count="pendingDeleteRecords.folders.length"
            :files="currentFolderPreviewFiles"
            :loading="folderPreviewLoading"
            :is-remote="isCurrentFolderPreviewRemote"
            :total="folderPreviewTotal"
            :page-size="folderPreviewPageSize"
            :current-page="folderPreviewPage"
            :pending-delete-file-ids="pendingDeleteFileIds"
            :readonly="isResultViewMode"
            show-back-button
            back-button-text="返回"
            @back="handleFolderPreviewBack"
            @page-change="handleFolderPreviewPageChange"
            @delete-selected="handleDeleteSelectedFolderPreviewFiles"
            @restore-file="handleRestoreFolderPreviewFile"
            @view-file="handleViewFolderPreviewFile"
          />
          <PreviewFile
            v-else
            ref="previewFileRef"
            :current-file="currentPreviewFile"
            :current-highlighted-field="null"
            @refresh="handlePreviewRefresh"
            @download="handlePreviewDownload"
          />
        </div>

        <div
          v-show="showFilePreview || isFolderListPreviewMode"
          class="risk-point-prototype__resizer risk-point-prototype__resizer--rest"
          title="拖拽调整宽度"
          @mousedown="startResizeRest"
        >
          <el-icon class="risk-point-prototype__resize-icon">
            <DArrowLeft />
          </el-icon>
        </div>

        <div
          class="risk-point-prototype__rest"
          :class="{ 'risk-point-prototype__rest--narrow': showFilePreview || isFolderListPreviewMode }"
          :style="restPaneStyle"
        >
        <!-- 任务中心预览：Tab 切换解析结果 / 功能配置 -->
        <div
          v-if="isResultViewMode"
          class="risk-point-prototype__pane risk-point-prototype__pane--preview-tabbed"
        >
          <div class="risk-point-prototype__viewer-head ocr-column-head">
            <div class="risk-point-prototype__viewer-tabs">
              <el-tabs v-model="previewViewerTab">
                <el-tab-pane label="解析结果" name="parse" />
                <el-tab-pane label="功能配置" name="extract" />
              </el-tabs>
            </div>
            <div v-if="previewViewerTab === 'parse'" class="risk-point-prototype__viewer-head-actions">
              <el-button
                type="primary"
                plain
                size="small"
                :disabled="!filteredResults.length"
                @click="exportResults"
              >
                导出结果
              </el-button>
            </div>
          </div>

          <div
            v-show="previewViewerTab === 'parse'"
            class="risk-point-prototype__pane-body risk-point-prototype__pane-body--results"
          >
            <el-alert
              v-if="taskResultLoadError"
              type="error"
              :closable="false"
              show-icon
              class="risk-point-prototype__task-alert"
              :title="taskResultLoadError"
            />
            <el-alert
              v-else-if="awaitingTaskResults && !resultRows.length"
              type="info"
              :closable="false"
              show-icon
              class="risk-point-prototype__task-alert"
              title="任务执行中，请稍候；进度由任务中心统一展示，完成后将自动刷新结果。"
            />
            <el-input
              v-model="resultKeyword"
              clearable
              placeholder="搜索结果：风险点/文件名/描述/证据"
              class="risk-point-prototype__result-search"
            />
            <div class="risk-point-prototype__result-meta">
              <div>
                <el-tag size="small" type="info" effect="plain">
                  共 {{ configuredRiskPointCount }} 条
                </el-tag>
                <el-tag
                  size="small"
                  type="success"
                  effect="plain"
                  class="risk-point-prototype__result-meta-tag"
                >
                  命中 {{ hitResultCount }} 条
                </el-tag>
              </div>
            </div>
            <el-table
              v-if="filteredResults.length"
              v-show="false"
              :data="filteredResults"
              size="small"
              border
              class="risk-point-prototype__result-table"
            >
              <el-table-column prop="fileName" label="文件" min-width="140" show-overflow-tooltip />
              <el-table-column prop="riskPath" label="风险点" min-width="220" show-overflow-tooltip />
              <el-table-column prop="level" label="等级" width="70" />
              <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
              <el-table-column prop="evidence" label="证据" min-width="240" show-overflow-tooltip />
            </el-table>
            <el-tree
              v-if="configuredRiskPointCount > 0 || hitResultCount > 0"
              :data="resultDisplayTreeData"
              node-key="id"
              :props="treeProps"
              :default-expand-all="false"
              class="risk-point-prototype__result-tree"
            >
              <template #default="{ data }">
                <div class="risk-point-prototype__result-tree-node">
                  <span class="risk-point-prototype__result-tree-label">
                    <span>{{ data.label }}</span>
                    <el-tag
                      v-if="typeof data.count === 'number'"
                      size="small"
                      type="info"
                      effect="plain"
                      class="risk-point-prototype__result-tree-count risk-point-prototype__result-tree-count--clickable"
                      @click.stop="toggleActiveHitNode(data)"
                    >
                      {{ data.count }}
                    </el-tag>
                  </span>
                  <div
                    v-if="activeHitNodeId === data.id"
                    class="risk-point-prototype__hit-inline-card"
                  >
                    <div class="risk-point-prototype__hit-card-head">
                      <span class="risk-point-prototype__hit-card-title">命中明细</span>
                      <el-tag size="small" type="success" effect="plain">
                        {{ getHitDetailsForNode(data).length }} 条
                      </el-tag>
                    </div>
                    <div class="risk-point-prototype__hit-card-body">
                      <div
                        v-for="row in getHitDetailsForNode(data)"
                        :key="row.key"
                        class="risk-point-prototype__hit-file-card"
                      >
                        <div class="risk-point-prototype__hit-file-card-head">
                          <div class="risk-point-prototype__hit-card-file">
                            {{ row.fileName }}
                          </div>
                          <el-tag size="small" type="success" effect="plain">
                            {{ row.level || '—' }}
                          </el-tag>
                        </div>
                        <el-tooltip
                          :content="row.description || '—'"
                          placement="top-start"
                          :show-after="200"
                          popper-class="risk-point-prototype__hit-reason-tooltip"
                        >
                          <div class="risk-point-prototype__hit-card-reason">
                            {{ row.description || '—' }}
                          </div>
                        </el-tooltip>
                      </div>
                      <el-empty
                        v-if="!getHitDetailsForNode(data).length"
                        description="暂无命中"
                        :image-size="64"
                      />
                    </div>
                  </div>
                </div>
              </template>
            </el-tree>
            <el-empty
              v-else-if="showResultEmpty"
              description="未配置风险点且无命中结果"
              class="risk-point-prototype__result-empty"
            />
          </div>

          <div
            v-show="previewViewerTab === 'extract'"
            class="risk-point-prototype__pane-body risk-point-prototype__pane-body--config"
          >
            <div class="risk-point-prototype__config-section">
              <div class="risk-point-prototype__config-section-title">遍历方式</div>
              <el-radio-group
                class="risk-point-prototype__traverse-radio-group risk-point-prototype__traverse-radio-group--readonly"
                :model-value="taskViewTraverseMode || traverseMode || 'byFile'"
                disabled
                size="small"
              >
                <el-radio-button label="byFile">按文件遍历</el-radio-button>
                <el-radio-button label="byRisk">按风险点遍历</el-radio-button>
              </el-radio-group>
            </div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">选择提示词</span>
              </div>
              <el-input
                class="field-input-full"
                :model-value="taskViewPromptName || '—'"
                readonly
              />
            </div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">提示词内容（如何引导风险点分析？）</span>
              </div>
              <el-input
                :model-value="taskViewPromptText"
                type="textarea"
                readonly
                placeholder="未记录提示词正文"
                class="risk-point-prototype__config-readonly-textarea preserve-whitespace field-input-full"
              />
              <div
                v-if="taskViewPromptName && !String(taskViewPromptText || '').trim()"
                class="risk-point-prototype__task-prompt-empty"
              >
                （未记录提示词正文，仅展示模板名称）
              </div>
            </div>
          </div>
        </div>

        <template v-if="!isResultViewMode">
        <div class="risk-point-prototype__pane risk-point-prototype__pane--risk">
          <!-- 执行阶段：中间列为「选择风险点」 -->
          <template v-if="!analysisDone">
            <div class="risk-point-prototype__pane-head ocr-column-head">
              选择风险点
            </div>
            <div class="risk-point-prototype__pane-body">
            <el-tree-select
              v-model="selectedRiskIds"
              class="risk-point-prototype__risk-tree-select"
              :data="riskTreeData"
              :props="riskTreeSelectProps"
              node-key="id"
              show-checkbox
              multiple
              collapse-tags
              collapse-tags-tooltip
              filterable
              check-strictly
              :placeholder="riskTreeData.length ? '请选择风险点' : '当前提示词未配置风险点'"
            />
            <el-tree
              class="risk-point-prototype__tree"
              :data="selectedRiskTree"
              node-key="id"
              :props="treeProps"
              :default-expand-all="true"
              @node-click="handleClickRiskNode"
            >
              <template #default="{ data }">
                <span
                  :class="[
                    'risk-point-prototype__tree-label',
                    {
                      'risk-point-prototype__tree-label--active': focusedRiskId === data.id,
                      'risk-point-prototype__tree-label--hit': isRiskHitOnFocusedFile(data.id),
                    },
                  ]"
                >
                  {{ data.label }}
                  <el-popover
                    v-if="getRiskHitCount(data.id)"
                    trigger="hover"
                    placement="right"
                    width="260"
                    :offset="8"
                  >
                    <template #reference>
                      <el-tag
                        size="small"
                        type="danger"
                        effect="plain"
                        class="risk-point-prototype__tree-hit-tag"
                      >
                        {{ getRiskHitCount(data.id) }}
                      </el-tag>
                    </template>
                    <div class="risk-point-prototype__risk-popover">
                      <div class="risk-point-prototype__risk-popover-title">
                        命中文件（{{ getRiskHitCount(data.id) }}）
                      </div>
                      <div
                        v-for="row in getRiskHitDetails(data.id)"
                        :key="row.key"
                        class="risk-point-prototype__risk-popover-item"
                      >
                        <div class="risk-point-prototype__risk-popover-file">
                          {{ row.fileName }}
                        </div>
                        <div class="risk-point-prototype__risk-popover-desc">
                          {{ row.description }}
                        </div>
                      </div>
                    </div>
                  </el-popover>
                </span>
                <div
                  v-if="focusedRiskId === data.id && getRiskHitCount(data.id)"
                  class="risk-point-prototype__risk-detail risk-point-prototype__risk-detail--in-tree"
                >
                  <div class="risk-point-prototype__risk-detail-head">
                    命中详情
                  </div>
                  <div
                    v-for="row in getRiskHitDetails(data.id)"
                    :key="row.key"
                    class="risk-point-prototype__risk-detail-item"
                  >
                    <div class="risk-point-prototype__risk-detail-file">
                      {{ row.fileName }}
                    </div>
                    <div class="risk-point-prototype__risk-detail-text">
                      {{ row.description }}
                    </div>
                  </div>
                </div>
              </template>
            </el-tree>
            </div>
          </template>

          <!-- 结果阶段：中间列为「分析结果」 -->
          <template v-else>
            <div class="risk-point-prototype__results-block risk-point-prototype__results-block--inline">
              <div class="risk-point-prototype__results-block-head ocr-column-head">
                分析结果
              </div>
              <div class="risk-point-prototype__pane-body">
              <el-alert
                v-if="taskResultLoadError"
                type="error"
                :closable="false"
                show-icon
                class="risk-point-prototype__task-alert"
                :title="taskResultLoadError"
              />
              <el-alert
                v-else-if="awaitingTaskResults && !resultRows.length"
                type="info"
                :closable="false"
                show-icon
                class="risk-point-prototype__task-alert"
                title="任务执行中，请稍候；进度由任务中心统一展示，完成后将自动刷新结果。"
              />
              <el-input
                v-model="resultKeyword"
                clearable
                placeholder="搜索结果：风险点/文件名/描述/证据"
                class="risk-point-prototype__result-search"
              />
              <div class="risk-point-prototype__result-meta">
                <div>
                  <el-tag size="small" type="info" effect="plain">
                    共 {{ configuredRiskPointCount }} 条
                  </el-tag>
                  <el-tag
                    size="small"
                    type="success"
                    effect="plain"
                    class="risk-point-prototype__result-meta-tag"
                  >
                    命中 {{ hitResultCount }} 条
                  </el-tag>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  :disabled="!filteredResults.length"
                  @click="exportResults"
                >
                  导出结果
                </el-button>
              </div>
              <el-table
                v-if="filteredResults.length"
                v-show="false"
                :data="filteredResults"
                size="small"
                border
                class="risk-point-prototype__result-table"
              >
                <el-table-column prop="fileName" label="文件" min-width="140" show-overflow-tooltip />
                <el-table-column prop="riskPath" label="风险点" min-width="220" show-overflow-tooltip />
                <el-table-column prop="level" label="等级" width="70" />
                <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
                <el-table-column prop="evidence" label="证据" min-width="240" show-overflow-tooltip />
              </el-table>
              <el-tree
                v-if="configuredRiskPointCount > 0 || hitResultCount > 0"
                :data="resultDisplayTreeData"
                node-key="id"
                :props="treeProps"
                :default-expand-all="false"
                class="risk-point-prototype__result-tree"
              >
                <template #default="{ data }">
                  <div class="risk-point-prototype__result-tree-node">
                    <span class="risk-point-prototype__result-tree-label">
                      <span>{{ data.label }}</span>
                      <el-tag
                        v-if="typeof data.count === 'number'"
                        size="small"
                        type="info"
                        effect="plain"
                        class="risk-point-prototype__result-tree-count risk-point-prototype__result-tree-count--clickable"
                        @click.stop="toggleActiveHitNode(data)"
                      >
                        {{ data.count }}
                      </el-tag>
                    </span>
                    <div
                      v-if="activeHitNodeId === data.id"
                      class="risk-point-prototype__hit-inline-card"
                    >
                      <div class="risk-point-prototype__hit-card-head">
                        <span class="risk-point-prototype__hit-card-title">命中明细</span>
                        <el-tag size="small" type="success" effect="plain">
                          {{ getHitDetailsForNode(data).length }} 条
                        </el-tag>
                      </div>
                      <div class="risk-point-prototype__hit-card-body">
                        <div
                          v-for="row in getHitDetailsForNode(data)"
                          :key="row.key"
                          class="risk-point-prototype__hit-file-card"
                        >
                          <div class="risk-point-prototype__hit-file-card-head">
                            <div class="risk-point-prototype__hit-card-file">
                              {{ row.fileName }}
                            </div>
                            <el-tag size="small" type="success" effect="plain">
                              {{ row.level || '—' }}
                            </el-tag>
                          </div>
                          <el-tooltip
                            :content="row.description || '—'"
                            placement="top-start"
                            :show-after="200"
                            popper-class="risk-point-prototype__hit-reason-tooltip"
                          >
                            <div class="risk-point-prototype__hit-card-reason">
                              {{ row.description || '—' }}
                            </div>
                          </el-tooltip>
                        </div>
                        <el-empty
                          v-if="!getHitDetailsForNode(data).length"
                          description="暂无命中"
                          :image-size="64"
                        />
                      </div>
                    </div>
                  </div>
                </template>
              </el-tree>
              <el-empty
                v-else-if="showResultEmpty"
                description="未配置风险点且无命中结果"
                class="risk-point-prototype__result-empty"
              />
              </div>
            </div>
          </template>
        </div>

        <div
          v-if="showTaskConfigColumn"
          class="risk-point-prototype__pane risk-point-prototype__pane--config"
        >
          <template v-if="!analysisDone">
            <div class="risk-point-prototype__config-head ocr-column-head">
              <el-tooltip effect="light" placement="top" :max-width="300">
                <template #content>
                  <div class="risk-point-prototype__traverse-tooltip">
                    <p>
                      <strong>按文件遍历：</strong>
                      每次按单个文件，将当前勾选的全部风险点一起传入智能体，按文件维度聚合分析结果。
                    </p>
                    <p>
                      <strong>按风险点遍历：</strong>
                      每次按单个风险点，逐个文件进行分析（一个风险点 × 一个文件或文件片段），按「风险点 → 文件」维度聚合结果。
                    </p>
                  </div>
                </template>
                <el-icon class="risk-point-prototype__traverse-mode-help-icon" :size="14">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
              <el-radio-group
                class="risk-point-prototype__traverse-radio-group"
                v-model="traverseMode"
                size="small"
              >
                <el-radio-button label="byFile">按文件遍历</el-radio-button>
                <el-radio-button label="byRisk">按风险点遍历</el-radio-button>
              </el-radio-group>
            </div>

            <div
              class="risk-point-prototype__prompt-form-loading-wrap risk-point-prototype__pane-body"
              v-loading="promptTreeLoading"
              element-loading-text="正在加载提示词..."
            >
              <div class="field-block">
                <div class="field-label-col field-label-col--block">
                  <span class="field-label-text">选择提示词</span>
                </div>
                <el-tree-select
                  v-model="selectedPromptId"
                  class="field-input-full"
                  :data="promptTreeData"
                  :props="promptTreeSelectProps"
                  :render-after-expand="false"
                  node-key="id"
                  filterable
                  check-strictly
                  :check-on-click-node="true"
                  placeholder="请选择或搜索提示词"
                />
                <div v-if="!isResultViewMode" class="risk-point-prototype__selection-hints">
                  <span v-if="selectedPromptId" class="risk-point-prototype__hint">已选提示词 1 条</span>
                  <span v-if="checkedRiskLeaves.length" class="risk-point-prototype__hint">
                    已选风险点 {{ checkedRiskLeaves.length }} 个
                  </span>
                </div>
              </div>

              <div class="field-block">
                <div class="field-label-col field-label-col--block">
                  <span class="field-label-text">提示词内容（如何引导风险点分析？）</span>
                </div>
                <el-input
                  v-model="promptContent"
                  type="textarea"
                  class="risk-point-prototype__prompt-edit-textarea preserve-whitespace field-input-full"
                  placeholder="选中的提示词内容会汇总到这里，可在此基础上微调。"
                />
              </div>
            </div>
          </template>
          <template v-else>
            <div class="risk-point-prototype__config-head ocr-column-head">
              <el-tooltip effect="light" placement="top" :max-width="300">
                <template #content>
                  <div class="risk-point-prototype__traverse-tooltip">
                    <p>
                      <strong>按文件遍历：</strong>
                      每次按单个文件，将当前勾选的全部风险点一起传入智能体，按文件维度聚合分析结果。
                    </p>
                    <p>
                      <strong>按风险点遍历：</strong>
                      每次按单个风险点，逐个文件进行分析（一个风险点 × 一个文件或文件片段），按「风险点 → 文件」维度聚合结果。
                    </p>
                  </div>
                </template>
                <el-icon class="risk-point-prototype__traverse-mode-help-icon" :size="14">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
              <el-radio-group
                class="risk-point-prototype__traverse-radio-group"
                :model-value="taskViewTraverseMode || 'byFile'"
                disabled
                size="small"
              >
                <el-radio-button label="byFile">按文件遍历</el-radio-button>
                <el-radio-button label="byRisk">按风险点遍历</el-radio-button>
              </el-radio-group>
            </div>

            <div
              class="risk-point-prototype__prompt-form-loading-wrap risk-point-prototype__prompt-form-loading-wrap--readonly risk-point-prototype__pane-body"
            >
              <div class="field-block">
                <div class="field-label-col field-label-col--block">
                  <span class="field-label-text">选择提示词</span>
                </div>
                <el-input
                  class="field-input-full"
                  :model-value="taskViewPromptName || '—'"
                  readonly
                />
              </div>

              <div class="field-block">
                <div class="field-label-col field-label-col--block">
                  <span class="field-label-text">提示词内容（如何引导风险点分析？）</span>
                </div>
                <el-input
                  :model-value="taskViewPromptText"
                  type="textarea"
                  readonly
                  placeholder="未记录提示词正文"
                  class="risk-point-prototype__config-readonly-textarea field-input-full"
                />
                <div
                  v-if="taskViewPromptName && !String(taskViewPromptText || '').trim()"
                  class="risk-point-prototype__task-prompt-empty"
                >
                  （未记录提示词正文，仅展示模板名称）
                </div>
              </div>
            </div>
          </template>
        </div>
        </template>
        </div>
      </div>
    </el-card>
</div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { QuestionFilled, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import { getTaskSchedulesAPI, batchExecuteByFilterAPI } from '@/api/task'
import { previewFileAPI } from '@/api/fileManager.js'
import { getPromptTreeByFunctionTypeNewAPI } from '@/api/IcssPlatform/promptManagement.js'
import { eventBus } from '@/utils/eventBus.js'
import { useHomeStore } from '@/stores/home'
import PreviewFile from '@/views/file-manager-code/components/PreviewFile.vue'
import OcrLeftSidebar from '@/views/file-manager-code/components/OcrLeftSidebar.vue'
import OcrFolderPreviewPanel from '@/views/file-manager-code/components/OcrFolderPreviewPanel.vue'
import { useSimpleOcrLeftSidebar } from '@/views/file-manager-code/composables/useSimpleOcrLeftSidebar.js'
import { useOcrFolderPreview } from '@/views/file-manager-code/composables/useOcrFolderPreview.js'
import { useTaskCenterPreviewSidebar } from '@/views/file-manager-code/composables/useTaskCenterPreviewSidebar.js'
import { buildToolBatchExecutePayload } from '@/views/file-manager-code/composables/buildToolBatchExecutePayload.js'
import {
  openTaskCenterWithRefresh,
  runBatchExecuteWithTimeoutNav
} from '@/views/file-manager-code/composables/batchExecuteTimeoutNav.js'
import { getFileIdentifier } from '@/views/file-manager-code/composables/ocrLeftSidebarTreeUtils.js'

defineOptions({ name: 'RiskPointAnalysisPrototype' })

const props = defineProps({
  files: { type: String, default: '' },
  names: { type: String, default: '' },
  /** 独立路由进入时不展示关闭（无弹窗父级） */
  hideClose: { type: Boolean, default: false },
  /** 任务中心 / 结果回显：任务 UUID */
  taskId: { type: [String, Number], default: '' },
  fileId: { type: [String, Number], default: '' },
  isSecondaryExecution: { type: Boolean, default: false },
  /** 与任务中心进度遮罩联动，创建任务后 emit */
  eventKey: { type: String, default: '' },
  toolLabel: { type: String, default: '风险点分析' }
})

const emit = defineEmits(['close-dialog'])
const route = useRoute()
const router = useRouter()
const homeStore = useHomeStore()

const RISK_POINT_EXTENSIONS = ['.pdf', '.doc', '.docx']
const RISK_POINT_BIZ_TYPE = 'riskPointAnalysis'
const RISK_POINT_TASK_TYPE = 8
const RISK_POINT_TOOL_UUID = 'risk-point-analysis'

let batchExecuteAborted = false
let activeBatchExecuteAbortController = null
const isViewerActive = ref(true)

const resolvedTaskId = computed(() => {
  const fromProp = props.taskId != null && String(props.taskId).trim()
  if (fromProp) return String(props.taskId).trim()
  const q = route.query.taskId && String(route.query.taskId).trim()
  return q || ''
})

/** 按任务 UUID 进入：只读结果，隐藏配置与执行 */
const isResultViewMode = computed(() => !!resolvedTaskId.value)

const uploadedFiles = ref([])

/**
 * 将侧栏源文件映射为页面展示行
 * @param {Object} sourceFile 源文件
 * @returns {Object} 展示行
 */
const mapSourceFileToDisplayRow = (sourceFile) => {
  const id = String(getFileIdentifier(sourceFile) || '')
  const name = sourceFile.file_name || sourceFile.name || `文件_${id}`
  const ext = name.includes('.') ? String(name.split('.').pop()).toLowerCase() : '—'
  return { id, name, ext, sourceFile }
}

/**
 * 解析侧栏文件 ID（兼容任务预览 file_uuid）
 * @param {Object} sourceFile 源文件
 * @returns {string} 文件 ID
 */
const resolveSidebarFileId = (sourceFile) => {
  if (!sourceFile) return ''
  return String(
    getFileIdentifier(sourceFile)
    || sourceFile.file_uuid
    || sourceFile.result_uuid
    || sourceFile.file_id
    || ''
  )
}

/**
 * 侧栏文件点击：高亮结果并同步预览
 * @param {Object} sourceFile 源文件
 * @returns {Promise<void>}
 */
const handleSidebarFileClick = async (sourceFile) => {
  const fileId = resolveSidebarFileId(sourceFile)
  if (!fileId) return
  const row = mapSourceFileToDisplayRow(sourceFile)
  if (!selectedFileIds.value.includes(fileId)) {
    selectedFileIds.value = [...selectedFileIds.value, fileId]
  }
  focusedFileIds.value = [fileId]
  filterFileId.value = filterFileId.value === fileId ? '' : fileId
  focusedRiskId.value = null
  if (showFilePreview.value) {
    await selectFileForPreview(row)
  }
}

const sidebarCore = useSimpleOcrLeftSidebar({
  files: uploadedFiles,
  canSelectFileType: RISK_POINT_EXTENSIONS,
  toolLabel: props.toolLabel,
  allowUnparsed: false,
  onFileClick: async (sourceFile) => {
    await handleSidebarFileClick(sourceFile)
  },
  isFileActive: (file) => {
    const fileId = resolveSidebarFileId(file)
    return fileId && focusedFileIds.value.includes(fileId)
  },
  getCanBatchExecute: () => !isResultViewMode.value && isRiskPointConfigReady() && hasExecuteTargets.value,
  getGlobalBatchSettings: buildRiskPointGlobalBatchSettings,
  onBeforeOpenBatchDialog: validateRiskPointConfig,
  onBatchExecute: (taskSwitch, name, remark) => runRiskPointBatchExecute(taskSwitch, name, remark),
  onFilesRemoved: (removedIds) => {
    selectedFileIds.value = selectedFileIds.value.filter((id) => !removedIds.includes(String(id)))
    focusedFileIds.value = focusedFileIds.value.filter((id) => !removedIds.includes(String(id)))
    if (currentPreviewFile.value) {
      const curId = String(currentPreviewFile.value.id || '')
      if (curId && removedIds.includes(curId)) {
        currentPreviewFile.value = null
      }
    }
  },
  afterFileSelectConfirm: async () => {
    if ((uploadedFiles.value || []).length === 0) return
    showFilePreview.value = true
  }
})

const {
  leftSidebarBindings: sidebarBindingsBase,
  addFilesFromManager,
  getSidebarExecuteContext,
  hasExecuteTargets,
  showFilePreview
} = sidebarCore

const folderPreview = useOcrFolderPreview({
  files: uploadedFiles,
  selectedFiles: sidebarBindingsBase.selectedFiles,
  allowUnparsed: false,
  fileExtensions: RISK_POINT_EXTENSIONS,
  onViewFile: async (rowData) => {
    const sourceFile = rowData?.sourceFile || {
      file_id: rowData?.fileId,
      fileId: rowData?.fileId,
      name: rowData?.name,
      file_name: rowData?.name
    }
    clearFolderPreviewMode()
    showFilePreview.value = true
    await handleSidebarFileClick(sourceFile)
  },
  onClearPreview: () => {
    currentPreviewFile.value = null
  },
  isCurrentPreviewFileId: (fileId) =>
    currentPreviewFile.value && String(fileId) === String(currentPreviewFile.value.id)
})

const {
  pendingDeleteRecords,
  pendingDeleteFileIds,
  currentFolderPreviewName,
  currentFolderPreviewFiles,
  isFolderListPreviewMode,
  folderPreviewDisplayTotal,
  folderPreviewLoading,
  isCurrentFolderPreviewRemote,
  folderPreviewTotal,
  folderPreviewPageSize,
  folderPreviewPage,
  clearFolderPreviewMode,
  handleFolderPreviewPageChange,
  handleDeleteSelectedFolderPreviewFiles,
  handleRestoreFolderPreviewFile,
  handleViewFolderPreviewFile,
  handleFolderTreeNodeClick,
  isFilePendingDelete,
  buildDeletedFilesPayload
} = folderPreview

/**
 * 文件夹列表返回主视图
 * @returns {void}
 */
const handleFolderPreviewBack = () => {
  clearFolderPreviewMode()
}

/**
 * 任务中心详情：预览侧栏树节点点击
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} [event] 点击事件
 * @returns {Promise<void>}
 */
const handleTaskPreviewTreeNodeClick = async (treeNode, event) => {
  if (!treeNode) return
  if (treeNode.nodeType === 'folder') {
    await handleFolderTreeNodeClick(treeNode)
    showFilePreview.value = true
    return
  }
  if (treeNode.nodeType !== 'file') return
  clearFolderPreviewMode()
  const sourceFile = taskPreviewCore.resolveSourceFileFromTreeNode(treeNode)
  if (!sourceFile) return
  await handleSidebarFileClick(sourceFile)
  void event
}

const taskPreviewCore = useTaskCenterPreviewSidebar({
  taskId: resolvedTaskId,
  taskName: computed(() => props.toolLabel),
  showFilePreview,
  isFileActive: (file) => {
    const fileId = resolveSidebarFileId(file)
    return fileId && focusedFileIds.value.includes(fileId)
  },
  handleTreeNodeClick: handleTaskPreviewTreeNodeClick
})

const {
  taskPreviewSidebarBindings,
  loadTaskCenterPreviewSidebar
} = taskPreviewCore

/**
 * 编辑模式侧栏树节点点击
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} [event] 点击事件
 * @returns {Promise<void>}
 */
const handleSidebarTreeNodeClick = async (treeNode, event) => {
  if (!treeNode) return
  if (treeNode.nodeType === 'folder') {
    await handleFolderTreeNodeClick(treeNode)
    showFilePreview.value = true
    return
  }
  if (treeNode.nodeType !== 'file') return
  clearFolderPreviewMode()
  const sourceFile = treeNode.sourceFile
  if (!sourceFile) return
  await handleSidebarFileClick(sourceFile)
  void event
}

const leftSidebarBindings = computed(() => ({
  ...sidebarBindingsBase,
  handleTreeNodeClick: handleSidebarTreeNodeClick,
  isFilePendingDelete,
  previewTaskName: props.toolLabel
}))

/**
 * 构建风险点分析 exec_config
 * @returns {Object} exec 配置
 */
const buildRiskPointExecConfig = () => {
  const riskPoints = riskLeafOptions.value
    .filter((x) => checkedRiskLeaves.value.includes(x.id))
    .map((x) => ({
      id: x.id,
      path: x.label,
      label: x.label
    }))
  const selectedPromptNode = findPromptInTree(promptTreeData.value, selectedPromptId.value)
  const selectedPromptName = selectedPromptNode?.name ?? ''
  return {
    exec_mode: 'custom',
    custom_config: {
      parameter_settings: {
        mode: traverseMode.value,
        risk_points: riskPoints,
        prompt: promptContent.value,
        selected_prompt_id: selectedPromptId.value ?? null,
        selected_prompt_name: selectedPromptName,
        prompt_function_type: RISK_POINT_PROMPT_FUNCTION_TYPE
      },
      parameter_template: '',
      prompt_uuid: 'prompt'
    }
  }
}

/**
 * 批量弹窗展示的风险点配置摘要
 * @returns {Object|null} 配置摘要
 */
function buildRiskPointGlobalBatchSettings() {
  if (!isRiskPointConfigReady()) return null
  const selectedPromptNode = findPromptInTree(promptTreeData.value, selectedPromptId.value)
  const promptName = selectedPromptNode?.name || '风险点'
  const traverseLabel = traverseMode.value === 'byFile' ? '按文件遍历' : '按风险点遍历'
  const riskLabels = riskLeafOptions.value
    .filter((x) => checkedRiskLeaves.value.includes(x.id))
    .map((x) => x.label)
  const riskSummary = riskLabels.length <= 3
    ? riskLabels.join('、')
    : `${riskLabels.slice(0, 3).join('、')}等${riskLabels.length}项`
  const promptSnippet = String(promptContent.value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60)
  const promptTail = String(promptContent.value || '').trim().length > 60 ? '...' : ''
  return {
    configured: true,
    mode: 'riskPoint',
    summaryText: `提示词：${promptName}；遍历：${traverseLabel}；风险点：${riskSummary || `${checkedRiskLeaves.value.length}个`}${promptSnippet ? `；${promptSnippet}${promptTail}` : ''}`
  }
}

/**
 * 校验风险点分析配置是否就绪
 * @returns {boolean} 是否就绪
 */
function isRiskPointConfigReady() {
  return checkedRiskLeaves.value.length > 0 && !!promptContent.value.trim()
}

/**
 * 打开批量执行弹窗前校验
 * @returns {Promise<boolean>} 是否允许打开
 */
async function validateRiskPointConfig() {
  if (!hasExecuteTargets.value) {
    ElMessage.warning('请先在左侧添加文件或文件夹')
    return false
  }
  if (!checkedRiskLeaves.value.length) {
    ElMessage.warning('请至少选择一个风险点')
    return false
  }
  if (!promptContent.value.trim()) {
    ElMessage.warning('请先配置提示词内容')
    return false
  }
  return true
}

/**
 * 终止进行中的批量执行请求
 * @returns {void}
 */
const invalidateBatchExecute = () => {
  batchExecuteAborted = true
  if (activeBatchExecuteAbortController) {
    activeBatchExecuteAbortController.abort()
    activeBatchExecuteAbortController = null
  }
}

/**
 * 调用 BatchExecuteByFilter 创建风险点分析任务
 * @param {number} taskSwitch 任务开关
 * @param {string} name 任务名称
 * @param {string} remark 任务备注
 * @returns {Promise<boolean>} 是否成功
 */
const runRiskPointBatchExecute = async (taskSwitch, name, remark) => {
  if (!hasExecuteTargets.value) {
    ElMessage.warning('请先在左侧添加文件或文件夹')
    return false
  }
  if (!(await validateRiskPointConfig())) return false

  const selectedPromptNode = findPromptInTree(promptTreeData.value, selectedPromptId.value)
  const selectedPromptName = selectedPromptNode?.name ?? ''
  const taskNotes = composeRiskPointTaskNotes(
    selectedPromptId.value,
    selectedPromptName,
    promptContent.value,
    remark
  )

  const deletedFiles = buildDeletedFilesPayload()
  const taskDataPayload = buildToolBatchExecutePayload({
    taskName: name,
    taskRemark: taskNotes,
    toolLabel: props.toolLabel,
    bizType: RISK_POINT_BIZ_TYPE,
    taskType: RISK_POINT_TASK_TYPE,
    toolUuid: RISK_POINT_TOOL_UUID,
    taskSwitch,
    buildExecConfig: buildRiskPointExecConfig,
    sidebarContext: getSidebarExecuteContext(),
    parseStatus: ['parsed'],
    fileExtensions: RISK_POINT_EXTENSIONS
  })
  if (deletedFiles.length > 0) {
    taskDataPayload.deleted_files = deletedFiles
  }

  batchExecuteAborted = false
  isViewerActive.value = true
  activeBatchExecuteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null

  let succeeded = false
  executing.value = true
  try {
    await runBatchExecuteWithTimeoutNav({
      taskName: name,
      requestFn: () => batchExecuteByFilterAPI(taskDataPayload, {
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
            taskUuid
            && props.eventKey
            && !batchExecuteAborted
            && isViewerActive.value
            && !timeoutFallbackTriggered
          ) {
            eventBus.emit(props.eventKey, { taskUuid, taskName: name, taskOther: {} })
          }
          if (!timeoutFallbackTriggered) {
            ElMessage.success(`任务"${name}"创建成功`)
          }
          succeeded = true
          return
        }
        if (!timeoutFallbackTriggered) {
          ElMessage.error(response.message || '任务创建失败')
        }
      }
    })
  } finally {
    executing.value = false
  }
  return succeeded
}

/**
 * 从文件管理器预填文件到左侧树
 * @returns {Promise<void>}
 */
const handleFileManagerFiles = async () => {
  const filesParam = props.files || String(route.query.files || '')
  const namesParam = props.names || String(route.query.names || '')
  if (!filesParam) return

  const sep = filesParam.includes('||') ? '||' : ','
  const fileIds = filesParam.split(sep).filter(Boolean)
  const fileNames = namesParam ? namesParam.split(sep).filter(Boolean) : []
  if (fileIds.length === 0) return

  const rows = fileIds.map((id, index) => ({
    file_id: id,
    file_name: fileNames[index] || ''
  }))
  await addFilesFromManager(rows, { silent: props.isSecondaryExecution })
}

const resultViewLoading = ref(false)
const awaitingTaskResults = ref(false)
const taskResultLoadError = ref('')

/** 与主题分析 ConfigPanel 一致：tree-by-function-type 返回空间/分类/提示词条目（可选项含 isPrompt、content） */
const RISK_POINT_PROMPT_FUNCTION_TYPE = 'risk-point-analysis'

const promptTreeData = ref([])
const promptTreeLoading = ref(false)
/** tree-by-function-type 顶层 defaultPrompt：树上叶子可能不含 config，需与此合并后再赋给风险点 */
const promptTreeDefaultPrompt = ref(null)

const riskTreeSelectProps = { value: 'id', label: 'label', children: 'children' }

const promptTreeSelectProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data) => !data?.isPrompt,
}

const riskTreeRaw = [
  
]
const riskTreeData = ref(riskTreeRaw)

const treeProps = { label: 'label', children: 'children' }
const selectedPromptId = ref(null)
const selectedFileIds = ref([])
const promptContent = ref('')
const selectedRiskIds = ref([])

const executing = ref(false)
const analysisDone = ref(false)
/** 任务中心预览：右侧 Tab，默认解析结果 */
const previewViewerTab = ref('parse')

/** 任务回显：来自各文件行的 parameter_settings */
const taskViewPromptText = ref('')
const taskViewPromptName = ref('')
const taskViewTraverseMode = ref('')
/** 任务中心详情：从 parameter_settings.risk_points 聚合还原的已选风险点 */
const taskViewRiskPoints = ref([])
/** 任务中心进入时右侧配置栏：加载中也占位，避免与执行页列数不一致 */
const showTaskConfigColumn = computed(() => {
  if (!isResultViewMode.value) return true
  return (
    analysisDone.value ||
    !!taskResultLoadError.value ||
    awaitingTaskResults.value ||
    resultViewLoading.value
  )
})

/** 遍历方式：按文件遍历 / 按风险点遍历 */
const traverseMode = ref('byRisk')

const resultRows = ref([])
const resultKeyword = ref('')
const filterFileId = ref('')
const filterRiskId = ref('')
const activeHitNodeId = ref('')

/** 任务结果回显时的文件列表（预览侧栏由 taskPreview 承担） */
const manualFilesFromPicker = ref([])

const displayFiles = computed(() => {
  if (isResultViewMode.value) {
    return manualFilesFromPicker.value
  }
  return (uploadedFiles.value || [])
    .map(mapSourceFileToDisplayRow)
    .filter((f) => f.id)
})

const previewFileRef = ref(null)
const currentPreviewFile = ref(null)
/** fileId -> preview_url，与词云分析一致按需拉取 */
const previewUrlById = ref({})

const LEFT_SIDEBAR_WIDTH_MIN = 200
const LEFT_SIDEBAR_WIDTH_MAX = 560
const savedLeftW = localStorage.getItem('ocr-viewer-left-sidebar-width')
const parsedLeftSidebarW = savedLeftW ? parseInt(savedLeftW, 10) : NaN
const initialLeftSidebarW = Number.isFinite(parsedLeftSidebarW) ? parsedLeftSidebarW : 320
const leftSidebarWidth = ref(
  Math.min(LEFT_SIDEBAR_WIDTH_MAX, Math.max(LEFT_SIDEBAR_WIDTH_MIN, initialLeftSidebarW))
)
const isResizingLeft = ref(false)
const leftResizeStartX = ref(0)
const leftResizeStartWidth = ref(0)

const savedRestW = localStorage.getItem('risk-point-analysis-rest-width')
const restSidebarWidth = ref(
  savedRestW ? parseInt(savedRestW, 10) : 640,
)
const isResizingRest = ref(false)
const resizeRestStartX = ref(0)
const resizeRestStartWidth = ref(0)

const restPaneStyle = computed(() => {
  if (!showFilePreview.value && !isFolderListPreviewMode.value) return {}
  return { width: `${restSidebarWidth.value}px` }
})

async function selectFileForPreview(f) {
  if (!f?.id) return
  const fileName = f.name || ''
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
  }

  let previewUrl = previewUrlById.value[f.id] || ''
  if (f.id && !previewUrl) {
    try {
      const previewRes = await previewFileAPI(f.id)
      if (previewRes.code === 200 && previewRes.data?.preview_url) {
        previewUrl = previewRes.data.preview_url
        previewUrlById.value = { ...previewUrlById.value, [f.id]: previewUrl }
      }
    } catch (e) {
       
      console.warn('获取预览URL失败:', e)
    }
  }

  currentPreviewFile.value = {
    id: f.id,
    name: f.name,
    file_name: f.name,
    type: fileType,
    fileId: f.id,
    previewUrl,
  }
}

function handlePreviewRefresh() {
  if (currentPreviewFile.value && previewFileRef.value) {
    previewFileRef.value.loadFile(currentPreviewFile.value)
    ElMessage.success('已刷新')
  }
}

function handlePreviewDownload() {
  ElMessage.info('下载功能（演示模式）')
}

/**
 * 开始拖拽左侧分隔条以调整文件栏宽度
 * @param {MouseEvent} e 鼠标按下事件
 * @returns {void}
 */
function startLeftSidebarResize(e) {
  isResizingLeft.value = true
  leftResizeStartX.value = e.clientX
  leftResizeStartWidth.value = leftSidebarWidth.value
  document.addEventListener('mousemove', handleLeftSidebarResize)
  document.addEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.add('resizing')
  e.preventDefault()
}

/**
 * 拖拽过程中更新左侧文件栏宽度
 * @param {MouseEvent} e 鼠标移动事件
 * @returns {void}
 */
function handleLeftSidebarResize(e) {
  if (!isResizingLeft.value) return
  const diff = e.clientX - leftResizeStartX.value
  const newWidth = leftResizeStartWidth.value + diff
  if (newWidth >= LEFT_SIDEBAR_WIDTH_MIN && newWidth <= LEFT_SIDEBAR_WIDTH_MAX) {
    leftSidebarWidth.value = newWidth
  }
}

/**
 * 结束左侧宽度拖拽并持久化
 * @returns {void}
 */
function stopLeftSidebarResize() {
  const was = isResizingLeft.value
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')
  if (was) {
    localStorage.setItem('ocr-viewer-left-sidebar-width', String(leftSidebarWidth.value))
  }
}

function startResizeRest(e) {
  isResizingRest.value = true
  resizeRestStartX.value = e.clientX
  resizeRestStartWidth.value = restSidebarWidth.value
  document.addEventListener('mousemove', handleResizeRest)
  document.addEventListener('mouseup', stopResizeRest)
  document.body.classList.add('resizing')
}

function handleResizeRest(e) {
  if (!isResizingRest.value) return
  const diff = resizeRestStartX.value - e.clientX
  const newWidth = resizeRestStartWidth.value + diff
  if (newWidth >= 400 && newWidth <= 1000) {
    restSidebarWidth.value = newWidth
  }
}

function stopResizeRest() {
  const was = isResizingRest.value
  isResizingRest.value = false
  document.removeEventListener('mousemove', handleResizeRest)
  document.removeEventListener('mouseup', stopResizeRest)
  document.body.classList.remove('resizing')
  if (was) {
    localStorage.setItem('risk-point-analysis-rest-width', String(restSidebarWidth.value))
  }
}

const primaryFile = computed(() => {
  const list = displayFiles.value
  const first = selectedFileIds.value[0]
  if (first) {
    return list.find((x) => x.id === first) || null
  }
  return list[0] || null
})

const filterTree = (nodes, selectedIds) => {
  if (!selectedIds.length) return []
  const selectedSet = new Set(selectedIds)
  const walk = (arr) =>
    arr
      .map((n) => {
        const children = n.children ? walk(n.children) : []
        const selected = selectedSet.has(n.id)
        if (selected || children.length) {
          return { ...n, children }
        }
        return null
      })
      .filter(Boolean)
  return walk(nodes)
}

const selectedRiskTree = computed(() => filterTree(riskTreeData.value, checkedRiskLeaves.value))

const collectAllIdsFromTree = (nodes) => {
  const ids = []
  const walk = (arr) => {
    arr.forEach((n) => {
      ids.push(n.id)
      if (n.children && n.children.length) {
        walk(n.children)
      }
    })
  }
  walk(nodes)
  return ids
}

const findNodeByIdFromTree = (nodes, targetId) => {
  const idText = String(targetId)
  for (const node of nodes) {
    if (String(node.id) === idText) return node
    if (node.children && node.children.length) {
      const found = findNodeByIdFromTree(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

const expandSelectedRiskIdsToLeaves = (selectedIds, tree) => {
  const out = []
  selectedIds.forEach((id) => {
    const node = findNodeByIdFromTree(tree, id)
    if (!node) return
    if (node.children && node.children.length) {
      out.push(...collectLeafIdsFromTree([node]))
    } else {
      out.push(node.id)
    }
  })
  return Array.from(new Set(out.map((id) => String(id))))
}

const checkedRiskLeaves = computed(() => {
  const leaves = new Set(collectLeafIdsFromTree(riskTreeData.value))
  return expandSelectedRiskIdsToLeaves(selectedRiskIds.value, riskTreeData.value).filter((id) => leaves.has(id))
})

const riskLeafOptions = computed(() => {
  const out = []
  const walk = (nodes) => {
    nodes.forEach((n) => {
      if (n.children && n.children.length) {
        walk(n.children)
      } else {
        out.push({ id: n.id, label: n.label })
      }
    })
  }
  walk(riskTreeData.value)
  return out
})

const parsePromptConfig = (rawConfig) => {
  if (!rawConfig) return null
  if (typeof rawConfig === 'object') return rawConfig
  if (typeof rawConfig !== 'string') return null
  const text = rawConfig.trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (e) {
    console.warn('提示词 config 解析失败:', e)
    return null
  }
}

const parseRiskTextListToTree = (text, parentKey = 'risk-text') => {
  if (typeof text !== 'string') return []
  const list = text
    .split(/\r?\n|,|，|;|；/)
    .map((s) => s.trim())
    .filter(Boolean)
  return list.map((label, index) => ({ id: `${parentKey}-${index}`, label }))
}

const normalizeRiskTreeNodes = (nodes, parentKey = 'risk') => {
  if (!Array.isArray(nodes)) return []
  return nodes
    .map((node, index) => {
      const nodeData = node && typeof node === 'object'
        ? node
        : { label: String(node || '').trim() }
      const label = String(
        nodeData.label ??
        nodeData.name ??
        nodeData.title ??
        nodeData.text ??
        '',
      ).trim()
      if (!label) return null
      const id = String(
        nodeData.id ??
        nodeData.value ??
        nodeData.key ??
        nodeData.code ??
        `${parentKey}-${index}`,
      )
      const children = normalizeRiskTreeNodes(
        nodeData.children ??
        nodeData.nodes ??
        nodeData.items ??
        nodeData.list ??
        [],
        id,
      )
      return children.length ? { id, label, children } : { id, label }
    })
    .filter(Boolean)
}

const normalizeRiskCandidate = (candidate) => {
  if (candidate == null) return []
  if (Array.isArray(candidate)) return normalizeRiskTreeNodes(candidate)
  if (typeof candidate === 'string') {
    const text = candidate.trim()
    if (!text) return []
    const parsed = parsePromptConfig(text)
    if (parsed && parsed !== candidate) {
      return normalizeRiskCandidate(parsed)
    }
    return parseRiskTextListToTree(text)
  }
  if (typeof candidate === 'object') {
    const childArray = candidate.children ?? candidate.nodes ?? candidate.items ?? candidate.list ?? null
    if (Array.isArray(childArray)) {
      const normalized = normalizeRiskTreeNodes(childArray)
      if (normalized.length) return normalized
    }
    const selfNode = normalizeRiskTreeNodes([candidate])
    if (selfNode.length) return selfNode
  }
  return []
}

const findRiskTreeInObjectDeep = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 4) return []
  const entries = Object.entries(obj)
  for (const [key, value] of entries) {
    const keyText = String(key || '').toLowerCase()
    const hitRiskKey = keyText.includes('risk') || keyText.includes('point') || keyText.includes('风险')
    if (hitRiskKey) {
      const normalized = normalizeRiskCandidate(value)
      if (normalized.length) return normalized
    }
  }
  for (const [, value] of entries) {
    if (value && typeof value === 'object') {
      const deep = findRiskTreeInObjectDeep(value, depth + 1)
      if (deep.length) return deep
    }
  }
  return []
}

const pickRiskTreeFromConfig = (config) => {
  if (!config || typeof config !== 'object') return []
  // 兼容：部分提示词直接将风险点树数组保存到 config
  if (Array.isArray(config)) {
    return normalizeRiskTreeNodes(config)
  }
  const candidates = [
    config.risk_tree,
    config.riskTree,
    config.risk_points_tree,
    config.riskPointsTree,
    config.risk_points,
    config.riskPoints,
    config['风险点'],
    config['风险点列表'],
    config['风险点树'],
  ]
  for (const item of candidates) {
    const normalized = normalizeRiskCandidate(item)
    if (normalized.length) return normalized
  }
  return findRiskTreeInObjectDeep(config)
}

const pickSelectedRiskIdsFromConfig = (config) => {
  if (!config || typeof config !== 'object') return []
  const candidates = [
    config.selected_risk_ids,
    config.selectedRiskIds,
    config.checked_risk_ids,
    config.checkedRiskIds,
    config.risk_ids,
    config.riskIds,
  ]
  for (const ids of candidates) {
    if (Array.isArray(ids) && ids.length) {
      return ids.map((id) => String(id))
    }
    if (typeof ids === 'string' && ids.trim()) {
      return ids
        .split(/,|，|;|；/)
        .map((id) => id.trim())
        .filter(Boolean)
    }
  }
  return []
}

const getPromptNodeRiskConfig = (node) => {
  if (!node || typeof node !== 'object') return null
  const candidates = [
    node.config,
    node.prompt_config,
    node.promptConfig,
    node.parameter_settings,
    node.parameterSettings,
    node.extra?.config,
    node.meta?.config,
    node.options?.config,
  ]
  for (const item of candidates) {
    if (item != null && String(item).trim() !== '') return item
  }
  return null
}

const applyPromptRiskConfig = (rawConfig) => {
  const parsedConfig = parsePromptConfig(rawConfig)
  const configuredTree = pickRiskTreeFromConfig(parsedConfig)
  // 风险点完全由提示词 config 驱动：未配置时展示空态而非回退固定内置树
  riskTreeData.value = configuredTree

  const availableAllIds = new Set(collectAllIdsFromTree(riskTreeData.value).map((id) => String(id)))
  const configuredIds = pickSelectedRiskIdsFromConfig(parsedConfig).filter((id) => availableAllIds.has(id))
  if (configuredIds.length) {
    selectedRiskIds.value = configuredIds
  } else {
    selectedRiskIds.value = selectedRiskIds.value.filter((id) => availableAllIds.has(String(id)))
  }
}

const findPromptInTree = (nodes, id) => {
  if (!nodes || !Array.isArray(nodes) || id == null || id === '') return null
  for (const node of nodes) {
    if (node.isPrompt && (node.id === id || String(node.id) === String(id))) {
      return node
    }
    if (node.children && node.children.length > 0) {
      const found = findPromptInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

/** 先序遍历：第一条可作为树选择值的提示词叶子（isPrompt 且无子节点） */
const findFirstPromptLeafInTree = (nodes) => {
  if (!nodes || !Array.isArray(nodes)) return null
  for (const node of nodes) {
    const hasKids = Array.isArray(node.children) && node.children.length > 0
    if (node.isPrompt && !hasKids) {
      return node
    }
    if (hasKids) {
      const found = findFirstPromptLeafInTree(node.children)
      if (found) return found
    }
  }
  return null
}

/** 先序遍历第一个 isPrompt 节点（兜底：树上仅有非叶子提示词条目时） */
const findFirstPromptInTree = (nodes) => {
  if (!nodes || !Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (node.isPrompt) return node
    if (node.children?.length) {
      const found = findFirstPromptInTree(node.children)
      if (found) return found
    }
  }
  return null
}

const pickDefaultPromptIdFromTree = () => {
  const leaf = findFirstPromptLeafInTree(promptTreeData.value)
  if (leaf?.id != null) return leaf.id
  const any = findFirstPromptInTree(promptTreeData.value)
  return any?.id != null ? any.id : null
}

/** 主任务 TASK_NOTES 库字段仅约 100 字；完整提示词与选项见各子项 parameter_settings */
const RISK_POINT_TASK_NOTES_MAX = 100

const buildRiskPointTaskNotes = (selectedId, selectedName, promptText) => {
  const idStr = selectedId != null && selectedId !== '' ? String(selectedId) : '—'
  const nameShort = (selectedName || '').trim().slice(0, 18) || '未选模板'
  const snippet = (promptText || '').trim().replace(/\s+/g, ' ').slice(0, 36)
  let s = `风险点|id:${idStr}|${nameShort}`
  if (snippet) s += `|${snippet}`
  if (s.length > RISK_POINT_TASK_NOTES_MAX) {
    s = `${s.slice(0, RISK_POINT_TASK_NOTES_MAX - 3)}...`
  }
  return s
}

/** 合并结构化摘要与用户备注（与词云一致的可选备注），总长仍受库字段限制 */
const composeRiskPointTaskNotes = (selectedId, selectedName, promptText, userRemark) => {
  const base = buildRiskPointTaskNotes(selectedId, selectedName, promptText)
  const r = (userRemark || '').trim()
  if (!r) return base
  const combined = `${base} | ${r}`
  if (combined.length <= RISK_POINT_TASK_NOTES_MAX) return combined
  return `${combined.slice(0, RISK_POINT_TASK_NOTES_MAX - 3)}...`
}

const loadRiskPointPromptTree = async () => {
  promptTreeLoading.value = true
  try {
    const res = await getPromptTreeByFunctionTypeNewAPI(RISK_POINT_PROMPT_FUNCTION_TYPE)
    const data = res?.data
    promptTreeData.value = Array.isArray(data?.items) ? data.items : []
    /** 必须在设置 selectedPromptId 之前写入，保证 watch 里能合并 defaultPrompt 的 config */
    promptTreeDefaultPrompt.value = data?.defaultPrompt ?? null

    await nextTick()
    if (data?.defaultPrompt?.id != null) {
      const dpId = data.defaultPrompt.id
      if (findPromptInTree(promptTreeData.value, dpId)) {
        selectedPromptId.value = dpId
      } else {
        const fallbackId = pickDefaultPromptIdFromTree()
        if (fallbackId != null) selectedPromptId.value = fallbackId
      }
    } else {
      const firstLeafId = pickDefaultPromptIdFromTree()
      if (firstLeafId != null) selectedPromptId.value = firstLeafId
    }
  } catch (e) {
    console.error(e)
    promptTreeData.value = []
    promptTreeDefaultPrompt.value = null
    ElMessage.error('加载提示词失败')
  } finally {
    promptTreeLoading.value = false
  }
}

onMounted(async () => {
  if (resolvedTaskId.value) {
    await loadRiskTaskById()
    return
  }
  loadRiskPointPromptTree()
  if (props.files || route.query.files) {
    await handleFileManagerFiles()
  }
})

const collectLeafIdsFromTree = (nodes) => {
  const ids = []
  const walk = (arr) => {
    arr.forEach((n) => {
      if (n.children && n.children.length) {
        walk(n.children)
      } else {
        ids.push(n.id)
      }
    })
  }
  walk(nodes)
  return ids
}

const focusedFileIds = ref([])
const focusedRiskId = ref(null)

const riskHitCountMap = computed(() => {
  const map = new Map()
  resultRows.value.forEach((row) => {
    const prev = map.get(row.riskId) || 0
    map.set(row.riskId, prev + 1)
  })
  return map
})

const getRiskHitCount = (riskId) => riskHitCountMap.value.get(riskId) || 0

const riskHitDetailMap = computed(() => {
  const map = new Map()
  resultRows.value.forEach((row) => {
    if (!map.has(row.riskId)) {
      map.set(row.riskId, [])
    }
    map.get(row.riskId).push(row)
  })
  return map
})

const getRiskHitDetails = (riskId) => riskHitDetailMap.value.get(riskId) || []

function clearTaskViewMeta() {
  taskViewPromptText.value = ''
  taskViewPromptName.value = ''
  taskViewTraverseMode.value = ''
  taskViewRiskPoints.value = []
}

function normalizeConfiguredRiskPoint(point) {
  if (!point || typeof point !== 'object') return null
  const id = String(point.id ?? point.path ?? point.label ?? '').trim()
  if (!id) return null
  const label = String(point.label || point.path || id).trim()
  const path = String(point.path || point.label || label).trim()
  return { id, label, path }
}

/** 遍历全部 schedule 行聚合 risk_points（byRisk 模式每行仅 1 项） */
function collectRiskPointsFromScheduleList(list) {
  const map = new Map()
  for (const row of list || []) {
    const ps = parseRowParameterSettings(row)
    const points = ps?.risk_points
    if (!Array.isArray(points)) continue
    for (const raw of points) {
      const normalized = normalizeConfiguredRiskPoint(raw)
      if (!normalized) continue
      if (!map.has(normalized.id)) {
        map.set(normalized.id, normalized)
      }
    }
  }
  return [...map.values()]
}

function deriveRiskPointsFromResultRows(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const path = String(row.riskPath || '').trim()
    const id = String(row.riskId || path).trim()
    if (!id && !path) continue
    const key = id || path
    if (!map.has(key)) {
      map.set(key, { id: key, label: path || id, path: path || id })
    }
  }
  return [...map.values()]
}

function parseRowParameterSettings(row) {
  if (!row) return null
  const raw = row.parameter_settings ?? row.PARAMETER_SETTINGS
  if (raw == null || raw === '') return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

/** 从任务详情的 task_schedule_result_list 还原提示词、遍历方式与已选风险点 */
function applyTaskConfigFromScheduleResults(list) {
  clearTaskViewMeta()
  if (!Array.isArray(list) || !list.length) return
  taskViewRiskPoints.value = collectRiskPointsFromScheduleList(list)
  const first =
    list.find((r) => parseRowParameterSettings(r)) ?? list[0] ?? null
  const ps = parseRowParameterSettings(first)
  if (!ps || typeof ps !== 'object') return
  const p = ps.prompt
  if (p != null && String(p).trim()) {
    taskViewPromptText.value = String(p)
  }
  const pn = ps.selected_prompt_name
  if (pn != null && String(pn).trim()) {
    taskViewPromptName.value = String(pn)
  }
  const mode = ps.mode
  if (mode != null && String(mode).trim()) {
    taskViewTraverseMode.value = String(mode)
  }
}

/** 与轮询完成、任务中心 setResult 共用：schedule 结果行 -> 表格行 */
const parseResultListToRows = (list) => {
  const allItems = []
  if (!Array.isArray(list)) return []
  list.forEach((row) => {
    let content = row.content || row.DISPOSAL_RESULT || row.disposal_result
    if (typeof content === 'object' && content && content.data) {
      content = content.data
    }
    if (!content) return
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      const items = Array.isArray(parsed?.items) ? parsed.items : []
      allItems.push(...items)
    } catch {
      // 单条解析失败则跳过
    }
  })
  return allItems.map((it, idx) => ({
    key: `${it.file_id || ''}-${it.risk_id || ''}-${idx}`,
    fileId: it.file_id,
    fileName: it.file_name,
    riskId: it.risk_id,
    riskPath: it.risk_path,
    description: it.description,
    evidence: it.evidence,
    level: it.level,
    review: 'pending',
  }))
}

const buildFilesFromResultRows = (rows) => {
  const seen = new Map()
  for (const r of rows) {
    const id = r.fileId
    if (!id || seen.has(id)) continue
    const name = r.fileName || `文件_${id}`
    const ext = name.includes('.') ? String(name.split('.').pop()).toLowerCase() : ''
    seen.set(id, { id: String(id), name, ext: ext || '—' })
  }
  return [...seen.values()]
}

async function syncPreviewAfterTaskFiles(fileRows, options = {}) {
  const { openPreview = false } = options
  await nextTick()
  if (!fileRows.length) return
  showFilePreview.value = openPreview
  activeHitNodeId.value = ''
  const pref =
    props.fileId != null && String(props.fileId).trim()
      ? String(props.fileId).trim()
      : ''
  const target = pref ? fileRows.find((f) => f.id === pref) : null
  const first = target || fileRows[0]
  selectedFileIds.value = fileRows.map((f) => f.id)
  focusedFileIds.value = [first.id]
  if (openPreview) {
    await selectFileForPreview(first)
  } else {
    currentPreviewFile.value = null
  }
  await Promise.all(
    fileRows.map(async (row) => {
      if (!row.id || previewUrlById.value[row.id]) return
      try {
        const previewRes = await previewFileAPI(row.id)
        if (previewRes.code === 200 && previewRes.data?.preview_url) {
          previewUrlById.value = {
            ...previewUrlById.value,
            [row.id]: previewRes.data.preview_url,
          }
        }
      } catch (e) {
        console.warn(`获取文件 ${row.name} 预览URL失败:`, e)
      }
    }),
  )
}

function hydrateFromScheduleList(list) {
  const rows = parseResultListToRows(list)
  resultRows.value = rows
  analysisDone.value = true
  return rows
}

/** 任务中心轮询结束后由父级调用 */
const setResult = async (taskScheduleResultList) => {
  taskResultLoadError.value = ''
  awaitingTaskResults.value = false
  const list = taskScheduleResultList || []
  const rows = hydrateFromScheduleList(list)
  applyTaskConfigFromScheduleResults(list)
  manualFilesFromPicker.value = buildFilesFromResultRows(rows)
  await loadTaskCenterPreviewSidebar()
  await syncPreviewAfterTaskFiles(manualFilesFromPicker.value, {
    openPreview: false,
  })
}

const taskError = () => {
  awaitingTaskResults.value = false
  executing.value = false
}

defineExpose({
  setResult,
  taskError,
})

const loadRiskTaskById = async () => {
  const id = resolvedTaskId.value
  if (!id) return
  resultViewLoading.value = true
  taskResultLoadError.value = ''
  awaitingTaskResults.value = false
  activeHitNodeId.value = ''
  try {
    const res = await getTaskSchedulesAPI(id, {
      prefer_runtime: true,
      include_results: true,
      include_selection_summary: true
    })
    if (res.code !== 200 || !res.data) {
      taskResultLoadError.value = res.message || '获取任务详情失败'
      analysisDone.value = true
      resultRows.value = []
      clearTaskViewMeta()
      return
    }
    const td = res.data
    await loadTaskCenterPreviewSidebar(td)
    const st = Number(td.task_status)
    const resultList = td.task_schedule_result_list || []

    if (st === 3) {
      taskResultLoadError.value = td.task_notes || '任务处理失败'
      analysisDone.value = true
      resultRows.value = []
      manualFilesFromPicker.value = []
      applyTaskConfigFromScheduleResults(resultList)
      return
    }

    if (st !== 2) {
      analysisDone.value = true
      awaitingTaskResults.value = true
      resultRows.value = []
      manualFilesFromPicker.value = []
      applyTaskConfigFromScheduleResults(resultList)
      if (props.isSecondaryExecution && String(props.eventKey || '').trim()) {
        eventBus.emit(props.eventKey, {
          taskUuid: id,
          taskName: td.task_name || '风险点分析',
          taskOther: {},
        })
      }
      return
    }

    hydrateFromScheduleList(resultList)
    applyTaskConfigFromScheduleResults(resultList)
    manualFilesFromPicker.value = buildFilesFromResultRows(resultRows.value)
    await syncPreviewAfterTaskFiles(manualFilesFromPicker.value, {
      openPreview: false,
    })
  } catch (e) {
    console.error(e)
    taskResultLoadError.value = e?.message || '加载任务失败'
    analysisDone.value = true
    resultRows.value = []
    clearTaskViewMeta()
  } finally {
    resultViewLoading.value = false
  }
}

watch(resolvedTaskId, async (id, prev) => {
  if (!id || id === prev) return
  await loadRiskTaskById()
})

watch(showFilePreview, (v) => {
  if (!v) return
  nextTick(() => {
    const byFocus = displayFiles.value.find((f) => focusedFileIds.value.includes(f.id))
    const target = byFocus || primaryFile.value || displayFiles.value[0]
    if (target) {
      selectFileForPreview(target)
    }
  })
})

onBeforeUnmount(() => {
  isViewerActive.value = false
  invalidateBatchExecute()
  stopLeftSidebarResize()
  stopResizeRest()
})

const exportResults = () => {
  if (!filteredResults.value.length) {
    ElMessage.warning('当前没有可导出的结果')
    return
  }
  const header = ['文件', '风险点', '等级', '描述', '证据']
  const rows = filteredResults.value.map((r) => [
    r.fileName || '',
    r.riskPath || '',
    r.level || '',
    r.description || '',
    r.evidence || '',
  ])
  const csvLines = [header, ...rows].map((cols) =>
    cols
      .map((val) => {
        const s = String(val).replace(/"/g, '""')
        return `"${s}"`
      })
      .join(','),
  )
  const csvContent = '\uFEFF' + csvLines.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '风险点分析结果.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const handleClickRiskNode = (data) => {
  const id = data?.id
  if (!id) return
  focusedRiskId.value = id
  // 再次点击同一风险点则取消结果过滤，便于查看全量结果
  filterRiskId.value = filterRiskId.value === id ? '' : id
}

const isRiskHitOnFocusedFile = (riskId) => {
  if (!focusedFileIds.value.length) return false
  return resultRows.value.some(
    (row) => focusedFileIds.value.includes(row.fileId) && row.riskId === riskId,
  )
}

const filteredResults = computed(() => {
  let rows = resultRows.value
  const kw = String(resultKeyword.value || '').trim().toLowerCase()
  if (filterFileId.value) {
    rows = rows.filter((r) => r.fileId === filterFileId.value)
  }
  if (filterRiskId.value) {
    rows = rows.filter((r) => r.riskId === filterRiskId.value)
  }
  if (kw) {
    rows = rows.filter((r) => {
      const text = [
        r.fileName,
        r.riskPath,
        r.description,
        r.evidence,
        r.level,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return text.includes(kw)
    })
  }
  return rows
})

const configuredRiskPoints = computed(() => {
  if (taskViewRiskPoints.value.length) {
    return taskViewRiskPoints.value
  }
  if (isResultViewMode.value) {
    return deriveRiskPointsFromResultRows(resultRows.value)
  }
  return riskLeafOptions.value
    .filter((x) => checkedRiskLeaves.value.includes(x.id))
    .map((x) => ({ id: x.id, label: x.label, path: x.label }))
})

const configuredRiskPointCount = computed(() => configuredRiskPoints.value.length)

const hitResultCount = computed(() => filteredResults.value.length)

const showResultEmpty = computed(() => {
  if (taskResultLoadError.value || awaitingTaskResults.value) return false
  return configuredRiskPointCount.value === 0 && hitResultCount.value === 0
})

function normalizeRiskPath(riskPath) {
  const raw = String(riskPath || '')
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('/')
}

function buildRiskHitCountMaps(hitRows) {
  const byId = new Map()
  const byPath = new Map()
  for (const row of hitRows || []) {
    const riskId = String(row.riskId || '').trim()
    if (riskId) {
      byId.set(riskId, (byId.get(riskId) || 0) + 1)
    }
    const pathKey = normalizeRiskPath(row.riskPath)
    if (pathKey) {
      byPath.set(pathKey, (byPath.get(pathKey) || 0) + 1)
    }
  }
  return { byId, byPath }
}

function getHitCountForConfiguredPoint(point, hitMaps) {
  const riskId = String(point?.id || '').trim()
  if (riskId && hitMaps.byId.has(riskId)) {
    return hitMaps.byId.get(riskId)
  }
  const pathKey = normalizeRiskPath(point?.path || point?.label)
  return pathKey ? (hitMaps.byPath.get(pathKey) || 0) : 0
}

function clearRiskTreeIndex(nodes) {
  nodes.forEach((n) => {
    delete n.__index
    if (n.children && n.children.length) {
      clearRiskTreeIndex(n.children)
    }
  })
}

function aggregateRiskTreeCounts(nodes) {
  nodes.forEach((n) => {
    if (n.children && n.children.length) {
      aggregateRiskTreeCounts(n.children)
      n.count = n.children.reduce((sum, child) => sum + (Number(child.count) || 0), 0)
    }
  })
}

function buildRiskTreeFromConfiguredPoints(points, hitRows) {
  const hitMaps = buildRiskHitCountMaps(hitRows)
  const rootNodes = []
  const rootIndex = new Map()

  const ensureChild = (parentArr, parentIndex, id, label, pathKey) => {
    if (parentIndex.has(id)) return parentIndex.get(id)
    const node = { id, label, children: [], count: 0, pathKey }
    parentArr.push(node)
    parentIndex.set(id, node)
    node.__index = new Map()
    return node
  }

  for (const point of points || []) {
    const rawPath = String(point.path || point.label || '未分类')
    const parts = rawPath
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
    const pathParts = parts.length ? parts : ['未分类']
    const leafHitCount = getHitCountForConfiguredPoint(point, hitMaps)

    let currentArr = rootNodes
    let currentIndex = rootIndex
    let currentKey = ''

    pathParts.forEach((part, idx) => {
      currentKey = currentKey ? `${currentKey}/${part}` : part
      const node = ensureChild(currentArr, currentIndex, `risk:${currentKey}`, part, currentKey)
      if (idx === pathParts.length - 1) {
        node.count = leafHitCount
      }
      currentArr = node.children
      currentIndex = node.__index
    })
  }

  aggregateRiskTreeCounts(rootNodes)
  clearRiskTreeIndex(rootNodes)
  return rootNodes
}

function buildRiskTreeFromHitRows(rows) {
  if (!rows.length) return []

  const rootNodes = []
  const rootIndex = new Map()

  const ensureChild = (parentArr, parentIndex, id, label, pathKey) => {
    if (parentIndex.has(id)) return parentIndex.get(id)
    const node = { id, label, children: [], count: 0, pathKey }
    parentArr.push(node)
    parentIndex.set(id, node)
    node.__index = new Map()
    return node
  }

  rows.forEach((r) => {
    const rawPath = String(r.riskPath || '未分类')
    const parts = rawPath
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
    const pathParts = parts.length ? parts : ['未分类']

    let currentArr = rootNodes
    let currentIndex = rootIndex
    let currentKey = ''

    pathParts.forEach((p) => {
      currentKey = currentKey ? `${currentKey}/${p}` : p
      const node = ensureChild(currentArr, currentIndex, `risk:${currentKey}`, p, currentKey)
      node.count += 1
      currentArr = node.children
      currentIndex = node.__index
    })
  })

  clearRiskTreeIndex(rootNodes)
  return rootNodes
}

function filterRiskTreeByKeyword(nodes, keyword) {
  if (!keyword) return nodes
  const kw = keyword.toLowerCase()
  const walk = (arr) =>
    arr
      .map((node) => {
        const children = node.children && node.children.length ? walk(node.children) : []
        const labelHit = String(node.label || '').toLowerCase().includes(kw)
        const countHit = Number(node.count) > 0
        if (labelHit || countHit || children.length) {
          return { ...node, children }
        }
        return null
      })
      .filter(Boolean)
  return walk(nodes)
}

const resultDisplayTreeData = computed(() => {
  const points = configuredRiskPoints.value
  const hits = filteredResults.value
  let tree = []
  if (points.length) {
    tree = buildRiskTreeFromConfiguredPoints(points, hits)
  } else if (hits.length) {
    tree = buildRiskTreeFromHitRows(hits)
  }
  const kw = String(resultKeyword.value || '').trim()
  return filterRiskTreeByKeyword(tree, kw)
})

const resultTreeData = computed(() => buildRiskTreeFromHitRows(filteredResults.value))

const getHitDetailsForNode = (node) => {
  const pathKey = node?.pathKey
  if (!pathKey) return []
  const key = String(pathKey)
  return filteredResults.value.filter((r) => {
    const p = normalizeRiskPath(r.riskPath)
    return p === key || p.startsWith(`${key}/`)
  })
}

const toggleActiveHitNode = (node) => {
  const id = node?.id
  if (!id) return
  activeHitNodeId.value = activeHitNodeId.value === id ? '' : id
}

watch(
  displayFiles,
  (list) => {
    if (list.length && !selectedFileIds.value.length) {
      selectedFileIds.value = list.map((item) => item.id)
    }
  },
  { immediate: true },
)

watch(
  selectedFileIds,
  (ids) => {
    focusedFileIds.value = focusedFileIds.value.filter((id) => ids.includes(id))
  },
  { immediate: true },
)

/** 选中提示词后：正文与风险点 config 优先取树上节点，缺省时若与接口 defaultPrompt 同 id 则合并其 config/content */
const syncSelectedPromptFromTree = (id) => {
  if (id == null || id === '') {
    promptContent.value = ''
    applyPromptRiskConfig(null)
    return
  }
  const node = findPromptInTree(promptTreeData.value, id)
  const def = promptTreeDefaultPrompt.value
  const sameAsDefault =
    def != null && def.id != null && String(def.id) === String(id)
  const textFromNode = node?.content != null ? String(node.content) : ''
  const textFromDefault =
    sameAsDefault && def?.content != null ? String(def.content) : ''
  promptContent.value = textFromNode || textFromDefault
  const rawConfig =
    getPromptNodeRiskConfig(node) ??
    (sameAsDefault ? getPromptNodeRiskConfig(def) : null)
  applyPromptRiskConfig(rawConfig)
}

watch(selectedPromptId, syncSelectedPromptFromTree, { immediate: true })
</script>

<style scoped>
.risk-point-prototype {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--sd-surface-1, #f4f4f4);
  overflow: hidden;
  height: calc(100vh - 80px);
}

.risk-point-prototype--embedded {
  height: 100%;
  min-height: 0;
  padding: 0;
}

.risk-point-prototype :deep(.ocr-sidebar-footer) {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
}

.risk-point-prototype :deep(.file-actions-row) {
  display: flex;
  align-items: center;
  width: 100%;
}

.risk-point-prototype :deep(.file-actions-row > * + *) {
  margin-left: 8px;
}

.risk-point-prototype :deep(.file-actions-row .ocr-footer-btn),
.risk-point-prototype :deep(.file-actions-row .el-button) {
  flex: 1;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  box-sizing: border-box;
}

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

.risk-point-prototype__viewer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 0 12px;
  box-sizing: border-box;
}

.risk-point-prototype__viewer-tabs {
  flex: 1;
  min-width: 0;
}

.risk-point-prototype__viewer-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.risk-point-prototype__viewer-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.risk-point-prototype__viewer-head-actions {
  flex-shrink: 0;
  margin-left: 12px;
}

.risk-point-prototype__pane--preview-tabbed {
  flex: 1;
  min-width: 0;
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
}

.risk-point-prototype__pane-body--results {
  min-height: 0;
}

.risk-point-prototype__pane-body--config {
  min-height: 0;
}

.risk-point-prototype__config-section {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
}

.risk-point-prototype__config-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  margin-bottom: 10px;
}

.risk-point-prototype__config-readonly-textarea :deep(.el-textarea__inner) {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.6;
  color: #303133;
  background: var(--sd-surface-1, #f4f4f4);
}

.risk-point-prototype__config-head.ocr-column-head {
  justify-content: flex-start;
}

.risk-point-prototype__config-head.ocr-column-head > * + * {
  margin-left: 8px;
}

.risk-point-prototype__config-head .risk-point-prototype__traverse-radio-group {
  flex: 1;
  min-width: 0;
}

.risk-point-prototype__config-head .risk-point-prototype__traverse-mode-help-icon {
  flex-shrink: 0;
}

.field-block {
  margin-bottom: 16px;
}

.field-block:last-child {
  margin-bottom: 0;
}

.field-block > * + * {
  margin-top: 8px;
}

.field-block--compact {
  width: 100%;
  margin-bottom: 0;
}

.field-label-col--block {
  display: flex;
  align-items: center;
  width: auto;
}

.field-label-col--block > * + * {
  margin-left: 4px;
}

.field-label-text {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  line-height: 1.4;
}

.field-input-full {
  width: 100%;
}

.risk-point-prototype__traverse-tooltip {
  max-width: 280px;
  line-height: 1.55;
  font-size: 12px;
  color: #606266;
}

.risk-point-prototype__traverse-tooltip p {
  margin: 0;
}

.risk-point-prototype__traverse-tooltip p + p {
  margin-top: 8px;
}

.risk-point-prototype__traverse-tooltip strong {
  font-weight: 600;
}

.risk-point-prototype__task-alert {
  margin-bottom: 12px;
}

.risk-point-prototype__task-prompt-panel {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #f9fafb;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.risk-point-prototype__task-prompt-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.risk-point-prototype__task-prompt-meta {
  font-size: 12px;
  color: #606266;
  margin-bottom: 8px;
  line-height: 1.5;
}

.risk-point-prototype__task-prompt-textarea :deep(textarea) {
  font-size: 12px;
  line-height: 1.55;
  color: #303133;
}

.risk-point-prototype__task-prompt-empty {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.risk-point-prototype__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.risk-point-prototype__card {
  border: none;
  border-radius: 0;
  box-shadow: none;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  background: transparent;
}

.risk-point-prototype__card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  padding: 0 !important;
}

.risk-point-prototype__card--results-focus .risk-point-prototype__upper {
  flex: 1;
  min-height: 0;
  height: auto;
}

.risk-point-prototype__card--results-focus .risk-point-prototype__results-block {
  flex: 1;
  min-height: 0;
  height: auto;
}

.risk-point-prototype__card-title {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
}

.risk-point-prototype__upper {
  display: flex;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.left-sidebar-group {
  display: flex;
  flex-shrink: 0;
  align-self: stretch;
  min-height: 0;
}

.left-sidebar-shell {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
}

.left-sidebar-shell.resizable-left-sidebar {
  transition: width 0s;
}

.risk-point-prototype__center-viewer {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.risk-point-prototype__center-viewer :deep(.preview-file-wrapper) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.risk-point-prototype__resizer {
  width: 4px;
  background: var(--sd-hairline, #e0e0e0);
  cursor: col-resize;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  transition: background-color 0.2s;
  z-index: 10;
}

.risk-point-prototype__resizer--left {
  border-right: 1px solid var(--sd-hairline, #e0e0e0);
}

.risk-point-prototype__resizer--rest {
  width: 4px;
  cursor: col-resize;
}

.risk-point-prototype__resizer:hover {
  background: var(--sd-primary, #195fb4);
}

.risk-point-prototype__resize-icon {
  color: #909399;
  font-size: 12px;
  pointer-events: none;
}

.risk-point-prototype__resizer:hover .risk-point-prototype__resize-icon {
  color: var(--sd-primary, #195fb4);
}

.risk-point-prototype__rest {
  display: flex;
  align-items: stretch;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.risk-point-prototype__rest--narrow {
  flex: 0 0 auto;
}

.risk-point-prototype__pane {
  background: var(--sd-canvas, #ffffff);
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
  padding: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.risk-point-prototype__pane-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.risk-point-prototype__pane-body > * + * {
  margin-top: 8px;
}

.risk-point-prototype__pane--files.risk-point-prototype__files-sidebar {
  flex-shrink: 0;
  padding: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
  border-left: none;
}

.risk-point-prototype__pane--files.risk-point-prototype__files-sidebar :deep(.left-sidebar) {
  height: 100%;
  border: none;
  border-radius: 0;
}

.risk-point-prototype__file-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.risk-point-prototype__file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #f5f7fa;
}

.risk-point-prototype__file-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.risk-point-prototype__search-area {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.risk-point-prototype__upload-area {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.risk-point-prototype__file-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}

.risk-point-prototype__file-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  background: #fff;
}

.risk-point-prototype__file-item:hover {
  background: #f5f7fa;
  border-color: #e4e7ed;
}

.risk-point-prototype__file-item--active {
  background: var(--sd-primary-light, #e8f0f8);
  border-color: var(--sd-primary, #195fb4);
}

.risk-point-prototype__file-item--selected {
  background: rgba(25, 95, 180, 0.08);
}

.risk-point-prototype__file-doc-icon {
  color: var(--sd-primary, #195fb4);
  margin-right: 8px;
  font-size: 16px;
  flex-shrink: 0;
}

.risk-point-prototype__file-item-name {
  flex: 1;
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
}

.risk-point-prototype__file-item-badges {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.risk-point-prototype__file-item-badges > * + * {
  margin-left: 6px;
}

.risk-point-prototype__file-actions-bottom {
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
  background: #f5f7fa;
  flex-shrink: 0;
}

.risk-point-prototype__pane--risk {
  flex: 1.15;
  min-width: 240px;
}

.risk-point-prototype__pane--config {
  flex: 1;
  min-width: 280px;
  max-width: 520px;
}

.risk-point-prototype__rest > .risk-point-prototype__pane--config:only-child {
  max-width: none;
  flex: 1;
  min-width: 320px;
}

.risk-point-prototype__prompt-form-loading-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.risk-point-prototype__prompt-form-loading-wrap--readonly {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.risk-point-prototype__prompt-edit-textarea {
  flex: 1;
  min-height: 160px;
}

.risk-point-prototype__prompt-edit-textarea :deep(.el-textarea) {
  height: 100%;
}

.risk-point-prototype__prompt-edit-textarea :deep(textarea) {
  min-height: 160px;
  height: 100%;
}

.risk-point-prototype__config-readonly-textarea {
  flex: 1;
  min-height: 160px;
}

.risk-point-prototype__config-readonly-textarea :deep(textarea) {
  min-height: 160px !important;
  height: 100% !important;
}

.risk-point-prototype__results-block {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
  border-left: none;
  padding: 0;
}

.risk-point-prototype__results-block--inline {
  margin-top: 0;
}

.risk-point-prototype__results-block-head {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.risk-point-prototype__results-block-head.ocr-column-head {
  justify-content: flex-start;
}

.risk-point-prototype__pane-head {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 0;
}

.risk-point-prototype__pane-head.ocr-column-head {
  justify-content: flex-start;
}


.risk-point-prototype__preview-body {
  flex: 1;
  padding: 12px;
  background: #fff;
  border-radius: 4px;
  border: 1px dashed #dcdfe6;
}

.risk-point-prototype__preview-name {
  margin: 0 0 8px;
  font-weight: 500;
  color: #303133;
}

.risk-point-prototype__preview-placeholder {
  margin: 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
}

.risk-point-prototype__prompt-group {
  max-height: 120px;
  overflow: auto;
}

.risk-point-prototype__prompt-row {
  padding: 2px 0;
}

.risk-point-prototype__prompt-tree-select {
  width: 100%;
  margin-bottom: 8px;
}

.risk-point-prototype__traverse-radio-group :deep(.el-radio-button__inner:hover) {
  color: var(--sd-primary, #195fb4);
  border-color: var(--sd-primary, #195fb4);
  background-color: var(--sd-primary-light, #e8f0f8);
}

.risk-point-prototype__traverse-radio-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
  font-weight: 600;
  color: #ffffff;
  background: var(--sd-primary, #195fb4);
  border-color: var(--sd-primary, #195fb4);
  box-shadow: -1px 0 0 0 var(--sd-primary, #195fb4);
}

.risk-point-prototype__traverse-mode-help-icon {
  color: #909399;
  cursor: help;
  vertical-align: middle;
}

.risk-point-prototype__traverse-radio-group :deep(.el-radio-button__inner) {
  padding: 0 10px;
  height: 26px;
  line-height: 24px;
  font-size: 12px;
  text-align: center;
  font-weight: 500;
  color: var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
  border-color: var(--sd-primary, #195fb4);
  box-shadow: none;
  transition: all 0.2s ease;
}

.risk-point-prototype__traverse-radio-group :deep(.el-radio-button:not(.is-active) .el-radio-button__inner:hover) {
  background-color: var(--sd-primary-light, #e8f0f8);
  color: var(--sd-primary, #195fb4);
  border-color: var(--sd-primary, #195fb4);
}

.risk-point-prototype__traverse-radio-group :deep(.el-radio-button.is-disabled:not(.is-active) .el-radio-button__inner) {
  background-color: var(--sd-canvas, #ffffff);
  color: var(--sd-primary, #195fb4);
  border-color: var(--sd-primary, #195fb4);
  opacity: 1;
}

.risk-point-prototype__traverse-radio-group--readonly {
  width: 100%;
}

.risk-point-prototype__traverse-radio-group {
  white-space: nowrap;
  width: 100%;
  display: inline-flex;
}

.risk-point-prototype__risk-tree-select {
  width: 100%;
  margin-bottom: 8px;
}

.risk-point-prototype__result-search {
  margin-bottom: 8px;
}

.risk-point-prototype__result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.risk-point-prototype__result-meta-tag {
  margin-left: 8px;
}

.risk-point-prototype__result-table {
  flex: 1;
  overflow: auto;
}

.risk-point-prototype__result-tree {
  flex: 1;
  overflow: auto;
  background: #fff;
  padding: 8px;
  border-radius: 4px;
}

.risk-point-prototype__result-tree-node {
  padding: 2px 0;
  flex: 1;
  min-width: 0;
}

.risk-point-prototype__result-tree :deep(.el-tree-node__content) {
  min-width: 0;
  height: auto;
  align-items: flex-start;
}

.risk-point-prototype__result-tree-label {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.risk-point-prototype__result-tree-count {
  margin-left: 8px;
}

.risk-point-prototype__result-tree-count--clickable {
  cursor: pointer;
}

.risk-point-prototype__hit-card {
  border: none;
}

.risk-point-prototype__hit-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.risk-point-prototype__hit-card-title {
  font-weight: 600;
  color: #303133;
}

.risk-point-prototype__hit-card-body {
  --hit-card-estimate: 92px;
  display: flex;
  flex-wrap: wrap;
  margin: -4px;
  max-height: calc(5 * var(--hit-card-estimate) + 32px);
  overflow-y: auto;
  overflow-x: hidden;
}

.risk-point-prototype__hit-card-body > * {
  width: calc(50% - 8px);
  margin: 4px;
  box-sizing: border-box;
}

.risk-point-prototype__hit-card-file {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-point-prototype__hit-card-reason {
  width: 100%;
  min-width: 0;
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.risk-point-prototype__hit-inline-card {
  margin-top: 6px;
  padding: 8px 10px;
  background: #f9fafc;
  border-radius: 4px;
  border: 1px solid #ebeef5;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.risk-point-prototype__hit-file-card {
  background: #eef5ff;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  padding: 8px 10px;
  box-sizing: border-box;
  min-width: 0;
}

.risk-point-prototype__hit-file-card :deep(.el-tooltip__trigger) {
  display: block;
  max-width: 100%;
}

.risk-point-prototype__hit-file-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.risk-point-prototype__hit-file-card-head > * + * {
  margin-left: 8px;
}

@media (max-width: 900px) {
  .risk-point-prototype__hit-card-body > * {
    width: calc(100% - 8px);
  }
}

:global(.risk-point-prototype__hit-reason-tooltip) {
  max-width: min(420px, 85vw) !important;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}

.risk-point-prototype__result-empty {
  flex: 1;
}

.risk-point-prototype__tree {
  flex: 1;
  overflow: auto;
  background: #fff;
  padding: 8px;
  border-radius: 4px;
}

.risk-point-prototype__tree-label {
  display: inline-flex;
  align-items: center;
}

.risk-point-prototype__tree-label--active {
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
}

.risk-point-prototype__tree-label--hit {
  color: #f56c6c;
}

.risk-point-prototype__tree-hit-tag {
  margin-left: 4px;
}

.risk-point-prototype__risk-popover {
  font-size: 12px;
}

.risk-point-prototype__risk-popover-title {
  margin-bottom: 6px;
  color: #606266;
}

.risk-point-prototype__risk-popover-item + .risk-point-prototype__risk-popover-item {
  margin-top: 4px;
}

.risk-point-prototype__risk-popover-file {
  font-weight: 500;
  color: #303133;
}

.risk-point-prototype__risk-popover-desc {
  color: #909399;
}

.risk-point-prototype__risk-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}

.risk-point-prototype__risk-detail--in-tree {
  margin-top: 6px;
  margin-left: 20px;
  padding-top: 6px;
  border-top: 1px dashed #ebeef5;
}

.risk-point-prototype__risk-detail-head {
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}

.risk-point-prototype__risk-detail-item + .risk-point-prototype__risk-detail-item {
  margin-top: 6px;
}

.risk-point-prototype__risk-detail-file {
  font-size: 13px;
  color: #303133;
}

.risk-point-prototype__risk-detail-text {
  font-size: 12px;
  color: #909399;
}

.risk-point-prototype__selection-hints {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 6px;
}

.risk-point-prototype__selection-hints > * + * {
  margin-left: 12px;
}

.risk-point-prototype__hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

.risk-point-prototype__result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.risk-point-prototype__result-header > * + * {
  margin-left: 16px;
}

.risk-point-prototype__lower {
  display: flex;
  align-items: flex-start;
}

.risk-point-prototype__lower > * + * {
  margin-left: 16px;
}

.risk-point-prototype__filter-pane {
  width: 260px;
  flex-shrink: 0;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.risk-point-prototype__filter-block {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.risk-point-prototype__filter-block > * + * {
  margin-left: 8px;
}

.risk-point-prototype__filter-label {
  width: 48px;
  font-size: 13px;
  color: #606266;
}

.risk-point-prototype__filter-select {
  flex: 1;
  min-width: 0;
}

.risk-point-prototype__filter-tip {
  margin-top: 8px;
}

.risk-point-prototype__table-wrap {
  flex: 1;
  min-width: 0;
}

.risk-point-prototype__group-view {
  max-height: 480px;
  overflow: auto;
}

.risk-point-prototype__group-block {
  margin-bottom: 16px;
}

.risk-point-prototype__group-block > * + * {
  margin-top: 8px;
}

.risk-point-prototype__group-title {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  margin-bottom: 6px;
}

.risk-point-prototype__progress {
  padding: 8px 4px;
}

.risk-point-prototype__progress-header {
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;
}

.risk-point-prototype__center-viewer :deep(.preview-file-wrapper) {
  height: 100%;
  min-height: 280px;
}

:global(body.resizing) {
  user-select: none;
  cursor: col-resize !important;
}

:global(body.resizing) * {
  cursor: col-resize !important;
}

:global(body.resizing) .risk-point-prototype__resizer--left,
:global(body.resizing) .risk-point-prototype__resizer--rest {
  background-color: var(--sd-primary, #195fb4);
}
</style>
