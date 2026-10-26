<template>
  <div class="task-center ocr-task-center">
    <div class="task-center-card">
      <!-- 筛选区 -->
      <div class="sd-panel-header task-center-toolbar">
        <el-form :inline="true" :model="filterForm" class="filter-form filter-form--medium task-center-filter-form">
          <el-form-item label="状态">
            <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 130px" @change="handleFilterChange">
              <el-option label="全部" :value="undefined" />
              <el-option label="未开始" :value="0" />
              <el-option label="进行中" :value="1" />
              <el-option label="已完成" :value="2" />
              <el-option label="失败" :value="3" />
            </el-select>
          </el-form-item>
          <!-- <el-form-item label="调用模式">
            <el-select v-model="filterForm.inputMode" placeholder="全部" clearable style="width: 140px" @change="handleFilterChange">
              <el-option label="全部" value="" />
              <el-option label="智能体调用" value="agent" />
              <el-option label="Prompt模式" value="prompt" />
              <el-option label="字段模式" value="field" />
            </el-select>
          </el-form-item> -->
          <el-form-item label="工具名称">
            <el-input
              v-model="filterForm.agentId"
              placeholder="搜索工具名称"
              clearable
              style="width: 172px"
              :prefix-icon="Search"
              @keyup.enter="handleFilterChange"
              @clear="handleFilterChange"
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="filterForm.search"
              placeholder="搜索任务名称"
              clearable
              style="width: 212px"
              :prefix-icon="Search"
              @keyup.enter="handleFilterChange"
              @clear="handleFilterChange"
            />
          </el-form-item>
          <el-form-item class="task-center-filter-form__actions">
            <el-button type="primary" :icon="Refresh" @click="handleRefresh">刷新</el-button>
            <el-button
              type="primary"
              plain
              class="merge-export-btn"
              :disabled="!canMergeExport"
              @click="openMergeExportDialog"
            >
              合并导出
            </el-button>
            <span v-if="mergeSelectedRows.length" class="merge-selected-tip">
              已选 <strong>{{ mergeSelectedRows.length }}</strong> 条
              <template v-if="mergeLockedAgentName">（{{ mergeLockedAgentName }}）</template>
            </span>
          </el-form-item>
        </el-form>
      </div>

      <!-- 表格 + 分页：flex 占位，避免表格固定高度把分页挤出视口 -->
      <div class="task-center-main">
      <div class="table-wrapper">
      <!-- 首屏/无数据加载：表格骨架屏 -->
      <div v-if="loading && !taskList.length" class="task-center-table-skeleton">
        <div class="task-center-table-skeleton__head">
          <el-skeleton animated :loading="true" :rows="0">
            <template #template>
              <div class="sk-table-head">
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--xs" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--xs" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--name" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--tool" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--status" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--progress" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--sm" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--time" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--remark" />
                <el-skeleton-item variant="text" class="sk-head-cell sk-head-cell--ops" />
              </div>
            </template>
          </el-skeleton>
        </div>
        <div
          v-for="rowIdx in TASK_CENTER_SKELETON_ROW_COUNT"
          :key="`task-center-sk-row-${rowIdx}`"
          class="task-center-table-skeleton__row"
        >
          <el-skeleton animated :loading="true" :rows="0">
            <template #template>
              <div class="sk-table-row">
                <el-skeleton-item variant="rect" class="sk-row-cell sk-row-cell--xs" />
                <el-skeleton-item variant="rect" class="sk-row-cell sk-row-cell--xs" />
                <el-skeleton-item variant="text" class="sk-row-cell sk-row-cell--name" />
                <el-skeleton-item variant="text" class="sk-row-cell sk-row-cell--tool" />
                <el-skeleton-item variant="rect" class="sk-row-cell sk-row-cell--status" />
                <div class="sk-row-cell sk-row-cell--progress">
                  <el-skeleton-item variant="text" class="sk-progress-line" />
                  <el-skeleton-item variant="rect" class="sk-progress-bar" />
                </div>
                <el-skeleton-item variant="text" class="sk-row-cell sk-row-cell--sm" />
                <el-skeleton-item variant="text" class="sk-row-cell sk-row-cell--time" />
                <el-skeleton-item variant="text" class="sk-row-cell sk-row-cell--remark" />
                <div class="sk-row-cell sk-row-cell--ops">
                  <el-skeleton-item variant="button" class="sk-op-btn" />
                  <el-skeleton-item variant="button" class="sk-op-btn" />
                </div>
              </div>
            </template>
          </el-skeleton>
        </div>
      </div>
      <el-table
        v-else
        ref="taskTableRef"
        :data="paginatedTasks"
        border
        stripe
        size="small"
        style="width: 100%"
        class="task-center-table sd-table--clean"
        height="100%"
        v-loading="loading"
        row-key="task_id"
        :empty-text="'暂无任务数据'"
        @selection-change="onMergeSelectionChange"
      >
        <el-table-column
          type="selection"
          width="48"
          fixed
          :selectable="mergeRowSelectable"
        />

        <el-table-column prop="task_name" label="任务名称" min-width="200">
          <template #default="scope">
            <span>{{ scope.row.task_name }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="agent_name" label="调用工具" min-width="120">
          <template #default="scope">
            <span class="agent-name-cell">
              <el-icon class="agent-icon"><User /></el-icon>
              <span class="agent-name-cell__text">{{ scope.row.agent_name }}</span>
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="任务状态" width="90">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="current_progress" label="文件处理进度" min-width="360" width="400">
          <template #default="scope">
            <div class="progress-cell">
              <div class="task-progress-main">
                <div class="task-progress-summary-line">
                  <span class="task-progress-summary-pref">
                    <el-icon class="task-progress-summary-prefix-icon"><Clock /></el-icon>
                    当前阶段
                  </span>
                  <strong
                    v-if="scope.row.progress_context?.stageIconKind === 'success'"
                    class="task-progress-summary-name task-progress-summary-name--done"
                  >
                    {{ scope.row.progress_context?.stageTitle || '整体进度' }}
                  </strong>
                  <span
                    v-else-if="scope.row.progress_context?.stageIconKind === 'failed'"
                    class="task-progress-summary-name task-progress-summary-name--failed"
                  >
                    {{ scope.row.progress_context?.stageTitle || '整体进度' }}
                  </span>
                  <span
                    v-else
                    class="task-progress-summary-name"
                  >
                    {{ scope.row.progress_context?.stageTitle || '整体进度' }}
                  </span>
                </div>
                <div class="task-progress-pills-row">
                  <span
                    v-if="scope.row.progress_context?.stageIconKind === 'success'"
                    class="task-progress-summary-pill task-progress-summary-pill--stage task-progress-summary-pill--stage-done"
                  >
                    <el-tooltip content="当前阶段进度" placement="top">
                      <span class="task-progress-pill-content">
                        <el-icon class="task-progress-summary-pill-icon"><CircleCheckFilled /></el-icon>
                        {{ scope.row.progress_context?.stageProgressPercent ?? 100 }}%
                      </span>
                    </el-tooltip>
                  </span>
                  <span
                    v-else-if="scope.row.progress_context?.stageIconKind === 'failed'"
                    class="task-progress-summary-pill task-progress-summary-pill--stage task-progress-summary-pill--stage-failed"
                  >
                    <el-tooltip content="当前阶段进度" placement="top">
                      <span class="task-progress-pill-content">
                        <el-icon class="task-progress-summary-pill-icon"><CircleCloseFilled /></el-icon>
                        {{ scope.row.progress_context?.stageProgressPercent ?? scope.row.progress_context?.file_progress_percent ?? scope.row.file_progress_percent }}%
                      </span>
                    </el-tooltip>
                  </span>
                  <span
                    v-else
                    class="task-progress-summary-pill task-progress-summary-pill--stage"
                  >
                    <el-tooltip content="当前阶段进度" placement="top">
                      <span class="task-progress-pill-content">
                        <el-icon class="task-progress-summary-pill-icon is-loading"><Loading /></el-icon>
                        {{ scope.row.progress_context?.stageProgressPercent ?? scope.row.progress_context?.file_progress_percent ?? scope.row.file_progress_percent }}%
                      </span>
                    </el-tooltip>
                  </span>
                  <span
                    v-if="scope.row.progress_context?.showFileBreakdown"
                    class="task-progress-summary-pill task-progress-summary-pill--files"
                  >
                    <el-tooltip content="当前阶段完成文件/总文件" placement="top">
                      <span class="task-progress-pill-content">
                        <el-icon class="task-progress-summary-pill-icon"><Document /></el-icon>
                        {{ scope.row.progress_context?.file_completed_count ?? scope.row.file_completed_count }}/{{ scope.row.progress_context?.file_total_count ?? scope.row.file_total_count }}
                      </span>
                    </el-tooltip>
                  </span>
                  <span class="task-progress-summary-pill task-progress-summary-pill--overall">
                    <el-tooltip content="整体进度" placement="top">
                      <span class="task-progress-pill-content">
                        <el-icon class="task-progress-summary-pill-icon"><Warning /></el-icon>
                        {{ scope.row.progress_context?.overallProgressPercent ?? (scope.row.progress_context?.file_progress_percent ?? scope.row.file_progress_percent) }}%
                      </span>
                    </el-tooltip>
                  </span>
                </div>
                <!-- 第三块：当前阶段文件进度条 + 统计数据 -->
                <template v-if="scope.row.progress_context?.showFileBreakdown">
                  <el-progress
                    class="task-progress-file-bar"
                    :percentage="scope.row.progress_context?.file_progress_percent ?? scope.row.file_progress_percent"
                    :stroke-width="8"
                    :show-text="false"
                  />
                  <div class="task-progress-stats">
                  <span class="task-stat-item task-stat-item--success">
                    <el-tooltip content="成功" placement="top">
                      <span class="task-stat-icon-trigger">
                        <el-icon class="task-stat-icon"><CircleCheckFilled /></el-icon>
                      </span>
                    </el-tooltip>
                    <span class="task-stat-value">{{ scope.row.progress_context?.file_success_count ?? scope.row.file_success_count }}</span>
                  </span>
                  <span class="task-stat-item task-stat-item--running">
                    <el-tooltip content="进行中" placement="top">
                      <span class="task-stat-icon-trigger">
                        <el-icon
                          class="task-stat-icon"
                          :class="{ 'is-loading': scope.row.status === 'processing' || (scope.row.progress_context?.file_processing_count ?? scope.row.file_processing_count) > 0 }"
                        >
                          <Loading />
                        </el-icon>
                      </span>
                    </el-tooltip>
                    <span class="task-stat-value">{{ scope.row.progress_context?.file_processing_count ?? scope.row.file_processing_count }}</span>
                  </span>
                  <span class="task-stat-item task-stat-item--failed">
                    <el-tooltip content="失败" placement="top">
                      <span class="task-stat-icon-trigger">
                        <el-icon class="task-stat-icon"><CircleCloseFilled /></el-icon>
                      </span>
                    </el-tooltip>
                    <span class="task-stat-value">{{ scope.row.progress_context?.file_failed_count ?? scope.row.file_failed_count }}</span>
                  </span>
                  <span class="task-stat-item task-stat-item--pending">
                    <el-tooltip content="等待" placement="top">
                      <span class="task-stat-icon-trigger">
                        <el-icon class="task-stat-icon"><Clock /></el-icon>
                      </span>
                    </el-tooltip>
                    <span class="task-stat-value">{{ scope.row.progress_context?.file_pending_count ?? scope.row.file_pending_count }}</span>
                  </span>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="file_count" label="文件个数" width="80">
          <template #default="scope">
            <span>{{ scope.row.file_total_count }} 个</span>
          </template>
        </el-table-column>

        <el-table-column prop="created_at" label="创建时间" width="160" sortable>
          <template #default="scope">
            {{ formatDateTime(scope.row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column prop="started_at" label="开始时间" width="150" show-overflow-tooltip>
          <template #default="scope">
            {{ formatDateTime(scope.row.started_at) }}
          </template>
        </el-table-column>

        <el-table-column prop="completed_at" label="结束时间" width="150" show-overflow-tooltip>
          <template #default="scope">
            {{ formatDateTime(scope.row.completed_at) }}
          </template>
        </el-table-column>

        <el-table-column prop="task_remark" label="任务备注" min-width="140" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.task_remark">{{ scope.row.task_remark }}</span>
            <span v-else class="task-center-cell-empty">-</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" fixed="right">
          <template #default="scope">
            <div class="operation-cell">
            <el-button
              size="small"
              type="primary"
              class="operation-cell-btn"
              @click="handleViewDetail(scope.row)"
            >
              详情
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              class="operation-cell-btn"
              @click="handleDeleteTask(scope.row)"
            >
              {{ scope.row.task_status === 0 || scope.row.task_status === 1 ? '终止' : '删除' }}
            </el-button>
            <el-button
              v-if="Number(scope.row.task_status) === 3 && !isTerminatingTask(scope.row)"
              size="small"
              type="warning"
              plain
              class="operation-cell-btn"
              :loading="isTaskRetryLoading(scope.row.task_id)"
              @click="handleRetryFailedTask(scope.row)"
            >
              重试
            </el-button>
            </div>
          </template>
        </el-table-column>

      </el-table>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-skeleton v-if="loading && !taskList.length" animated :loading="true" :rows="0">
          <template #template>
            <el-skeleton-item variant="text" class="task-center-pager-skeleton" />
          </template>
        </el-skeleton>
        <el-pagination
          v-else
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
      </div>
    </div>

    <!-- 查看结果对话框 -->
    <el-dialog
      v-model="resultDialog.visible"
      title="任务结果"
      width="900px"
      :close-on-click-modal="true"
    >
      <div v-if="resultDialog.task" class="result-dialog-content">
        <el-table :data="resultDialog.task.files" border size="small" style="width: 100%">
          <el-table-column prop="file_name" label="文件名" min-width="200">
            <template #default="scope">
              <el-icon class="file-icon"><Document /></el-icon>
              <span style="margin-left: 8px">{{ scope.row.file_name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="file_type" label="文件类型" width="100">
            <template #default="scope">
              <el-tag :type="getFileTypeTagType(scope.row.file_type)" size="small">
                {{ scope.row.file_type.toUpperCase() }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="file_size" label="文件大小" width="120">
            <template #default="scope">
              {{ formatFileSize(scope.row.file_size) }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="处理状态" width="100">
            <template #default="scope">
              <el-tag :type="getFileStatusType(scope.row.status)" size="small">
                {{ getFileStatusText(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="progress" label="进度" width="100">
            <template #default="scope">
              <span>{{ scope.row.progress }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                @click="handleViewFileResult(scope.row)"
                :disabled="scope.row.status !== 'completed' && scope.row.status !== 'failed'"
              >
                查看详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
    <!-- 会议纪要分析结果对话框 -->
    <el-dialog
      v-model="taskResultDialog.visible"
      title="任务详情"
      fullscreen
      class="task-detail-fullscreen-dialog"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <!-- 统一任务加载进度遮罩 -->
      <div
        v-if="taskProgressLoading"
        class="task-progress-overlay"
      >
        <div class="progress-dialog-container" style="overflow: auto;">
          <div class="progress-dialog-header">
            <div class="progress-dialog-left">
              <span class="progress-elapsed" v-if="taskProgressText">{{ taskProgressText }}</span>
            </div>
            <el-tag size="small">进行中</el-tag>
          </div>
          <TaskRuntimeProgressTree :nodes="taskProgressRuntimeNodes" />
          <div class="progress-dialog-footer">
            <el-button @click="showFloatingBall">关闭</el-button>
          </div>
        </div>
      </div>
      <div
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 1"
        class="task-detail-viewer-host"
      >
        <TaskResultViewer
          :task-id="taskResultDialog.taskId"
          :file-id="taskResultDialog.fileId"
          :is-secondary-execution="true"
          :eventKey="'task-center-progress-start'"
          ref="viewerRef"
          @close="taskResultDialog.visible = false"
        />
      </div>
      <div
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 2"
        class="task-detail-viewer-host"
      >
        <ContractViewer
          :task-id="taskResultDialog.taskId"
          :file-id="taskResultDialog.fileId"
          :is-secondary-execution="true"
          :hide-secondary-batch-execute="true"
          :eventKey="'task-center-progress-start'"
          ref="viewerRef"
          @close-dialog="taskResultDialog.visible = false"
        />
      </div>
      <WordCloudAnalysis
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 4"
        :task-id="taskResultDialog.taskId"
        :task-name="taskResultDialog.taskName"
        :file-id="taskResultDialog.fileId"
        :is-secondary-execution="true"
        :eventKey="'task-center-progress-start'"
        ref="viewerRef"
        @close-dialog="taskResultDialog.visible = false"
      />
      <MeetingMinutesViewer
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 7"
        :task-id="taskResultDialog.taskId"
        :file-id="taskResultDialog.fileId"
        :analysis-id="taskResultDialog.analysisId"
        :task-name="taskResultDialog.taskName"
        :task-status="taskResultDialog.taskStatus"
        :is-secondary-execution="true"
        :eventKey="'task-center-progress-start'"
        ref="viewerRef"
        @close-dialog="handleMeetingMinutesDetailClose"
      />
      <div
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 5"
        class="task-detail-viewer-host"
      >
        <ThemeAnalysisViewer
          :task-id="taskResultDialog.taskId"
          :files="taskResultDialog.files"
          :names="taskResultDialog.names"
          :eventKey="'task-center-progress-start'"
          ref="viewerRef"
          @close-dialog="taskResultDialog.visible = false"
        />
      </div>
      <div
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 8"
        class="task-detail-viewer-host"
      >
        <RiskPointAnalysisPrototype
          :task-id="taskResultDialog.taskId"
          :file-id="taskResultDialog.fileId"
          :is-secondary-execution="true"
          event-key="task-center-progress-start"
          ref="viewerRef"
          @close-dialog="taskResultDialog.visible = false"
        />
      </div>
      <div
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 10 && taskResultDialog.bizType === 'prepaidExpenses'"
        class="task-detail-viewer-host"
      >
        <PrepaidExpensesPrototype
          :task-id="taskResultDialog.taskId"
          :is-secondary-execution="true"
          event-key="task-center-progress-start"
          ref="viewerRef"
          @close-dialog="taskResultDialog.visible = false"
        />
      </div>
      <EngineeringProjectViewer
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 6"
        :task-id="taskResultDialog.taskId"
        :file-id="taskResultDialog.fileId"
        :is-secondary-execution="true"
        event-key="task-center-progress-start"
        ref="viewerRef"
        @close-dialog="taskResultDialog.visible = false"
      />
      <AssociationDegreeTwoTables
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 9"
        :task-id="taskResultDialog.taskId"
        :file-id="taskResultDialog.fileId"
        :is-secondary-execution="true"
        event-key="task-center-progress-start"
        ref="viewerRef"
        @close-dialog="taskResultDialog.visible = false"
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
      <TimelineAnalysisViewer
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 3"
        :task-id="taskResultDialog.taskId"
        :analysis-id="taskResultDialog.taskId"
        :task-name="taskResultDialog.taskName"
        :task-status="taskResultDialog.taskStatus"
        :is-secondary-execution="true"
        :eventKey="'task-center-progress-start'"
        ref="viewerRef"
        @close-dialog="taskResultDialog.visible = false"
      />
      <BiddingAnalysisViewer
        v-if="taskResultDialog.visible && taskResultDialog.taskType === 10 && taskResultDialog.bizType === 'biddingAnalysis'"
        :task-id="taskResultDialog.taskId"
        :analysis-id="taskResultDialog.analysisId || taskResultDialog.taskId"
        :task-name="taskResultDialog.taskName"
        :task-status="taskResultDialog.taskStatus"
        :is-secondary-execution="true"
        event-key="task-center-progress-start"
        ref="viewerRef"
        @close-dialog="taskResultDialog.visible = false"
      />
    </el-dialog>

    <!-- 多任务合并导出配置：提交走 MergeExportCreate，后台异步合并并上传 MinIO -->
    <el-dialog
      v-model="mergeExportDialogVisible"
      title="合并导出配置"
      width="860px"
      align-center
      append-to-body
      destroy-on-close
      class="sd-dialog sd-dialog-form merge-export-dialog"
    >
      <div class="sd-dialog-body-scroll merge-export-dialog__body">
        <div v-if="mergeSelectedRows.length" class="merge-export-dialog__summary">
          <div class="merge-export-summary-grid">
            <div class="merge-export-summary-item">
              <span class="merge-export-summary-item__label">已选任务</span>
              <span class="merge-export-summary-item__value">{{ mergeSelectedRows.length }} 条</span>
            </div>
            <div class="merge-export-summary-item">
              <span class="merge-export-summary-item__label">工具 UUID</span>
              <span class="merge-export-summary-item__value merge-export-summary-item__value--code">
                {{ mergeLockedAgentId || '—' }}
              </span>
            </div>
            <div class="merge-export-summary-item">
              <span class="merge-export-summary-item__label">文件总数</span>
              <span class="merge-export-summary-item__value">{{ mergeSelectedFileTotal }}</span>
            </div>
            <div class="merge-export-summary-item">
              <span class="merge-export-summary-item__label">成功 / 失败</span>
              <span class="merge-export-summary-item__value">
                <span class="merge-export-summary-item__success">{{ mergeSelectedFileSuccessTotal }}</span>
                <span class="merge-export-summary-item__sep">/</span>
                <span class="merge-export-summary-item__fail">{{ mergeSelectedFileFailedTotal }}</span>
              </span>
            </div>
          </div>
        </div>

        <el-form
          label-width="108px"
          label-position="right"
          size="default"
          class="sd-dialog-form-body merge-export-form"
        >
          <div class="merge-export-panel">
            <div class="sd-section-title">基本信息</div>
            <el-form-item label="任务名称">
              <el-input
                v-model="mergeExportTaskName"
                clearable
                placeholder="文本信息提取结果合并导出xxxx"
                maxlength="120"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="任务备注">
              <el-input
                v-model="mergeExportTaskRemark"
                type="textarea"
                :rows="2"
                placeholder="可选：填写该合并导出任务的业务说明"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
          </div>

          <div class="merge-export-panel">
            <div class="sd-section-title">导出设置</div>
            <el-form-item label="导出文件" class="merge-export-form-item--block">
              <div class="merge-export-file-cards">
                <div
                  class="merge-export-file-card"
                  :class="{ 'is-selected': mergeExportFiles.includes('excel') }"
                  role="checkbox"
                  :aria-checked="mergeExportFiles.includes('excel')"
                  tabindex="0"
                  @click="toggleMergeExportFile('excel')"
                  @keydown.enter.prevent="toggleMergeExportFile('excel')"
                  @keydown.space.prevent="toggleMergeExportFile('excel')"
                >
                  <span
                    class="merge-export-file-card__check"
                    :class="{ 'is-checked': mergeExportFiles.includes('excel') }"
                    aria-hidden="true"
                  >
                    <el-icon v-if="mergeExportFiles.includes('excel')">
                      <CircleCheckFilled />
                    </el-icon>
                  </span>
                  <div class="merge-export-file-card__body">
                    <div class="merge-export-file-card__title">合并结果（Excel）</div>
                    <div class="merge-export-file-card__desc">导出为 Excel 合并文件，支持分批</div>
                  </div>
                </div>
                <div
                  class="merge-export-file-card"
                  :class="{ 'is-selected': mergeExportFiles.includes('sql') }"
                  role="checkbox"
                  :aria-checked="mergeExportFiles.includes('sql')"
                  tabindex="0"
                  @click="toggleMergeExportFile('sql')"
                  @keydown.enter.prevent="toggleMergeExportFile('sql')"
                  @keydown.space.prevent="toggleMergeExportFile('sql')"
                >
                  <span
                    class="merge-export-file-card__check"
                    :class="{ 'is-checked': mergeExportFiles.includes('sql') }"
                    aria-hidden="true"
                  >
                    <el-icon v-if="mergeExportFiles.includes('sql')">
                      <CircleCheckFilled />
                    </el-icon>
                  </span>
                  <div class="merge-export-file-card__body">
                    <div class="merge-export-file-card__title">神通数据库</div>
                    <div class="merge-export-file-card__desc">建表 DDL + INSERT 分批 SQL</div>
                  </div>
                </div>
              </div>
            </el-form-item>
            <template v-if="mergeExportFiles.length">
              <el-form-item label="字段映射维度">
                <el-radio-group v-model="mergeMapScope" class="merge-export-map-scope-group">
                  <el-radio-button
                    v-for="s in availableMergeMapScopes"
                    :key="s"
                    :label="s"
                  >
                    {{ mergeMapScopeLabel(s) }}
                  </el-radio-button>
                </el-radio-group>
                <div class="merge-export-form__tip merge-export-form__tip--block">
                  导出字段/注释字段仅在勾选 SQL 时可用；Excel 表头仅在勾选 Excel 时可用。
                </div>
              </el-form-item>
              <el-form-item label="该维度语言">
                <el-radio-group v-model="currentScopeLang" class="merge-export-lang-group">
                  <el-radio label="zh">中文</el-radio>
                  <el-radio label="en">英文</el-radio>
                </el-radio-group>
                <div class="merge-export-form__tip merge-export-form__tip--block">
                  决定该维度导出使用哪一侧，且表格仅该侧可编辑。
                </div>
              </el-form-item>
            </template>
            <el-form-item v-if="mergeExportFiles.includes('sql')" label="数据库">
              <el-tag type="info" effect="plain" class="merge-export-db-tag">神通</el-tag>
            </el-form-item>
            <el-form-item v-if="mergeExportFiles.includes('excel')" label="Excel 分批">
              <div class="merge-export-form__control-row">
                <span class="merge-export-form__field-label">每文件最多行数</span>
                <el-input-number
                  v-model="mergeExcelRowsPerFile"
                  :min="1"
                  :max="1000000"
                  controls-position="right"
                  class="merge-export-form__number-input"
                />
              </div>
              <div class="merge-export-form__tip">默认等于当前已选任务文件总数（可改小以拆成多个文件）。</div>
            </el-form-item>
            <el-form-item v-if="mergeExportFiles.includes('sql')" label="SQL 分批">
              <div class="merge-export-form__control-row">
                <span class="merge-export-form__field-label">每文件最多行数</span>
                <el-input-number
                  v-model="mergeSqlRowsPerFile"
                  :min="1"
                  :max="1000000"
                  controls-position="right"
                  class="merge-export-form__number-input"
                />
              </div>
              <div class="merge-export-form__tip">
                建表 DDL 将单独输出为一个 <code>.sql</code> 文件，INSERT 按上式分批；默认等于已选任务文件总数。
              </div>
            </el-form-item>
            <el-form-item label="下载链接有效期">
              <div class="merge-export-form__control-row">
                <el-input-number
                  v-model="mergeFileExpireDays"
                  :min="1"
                  :max="7"
                  controls-position="right"
                  class="merge-export-form__number-input merge-export-form__number-input--short"
                />
                <span class="merge-export-form__suffix">天（预签名最长 7 天）</span>
              </div>
            </el-form-item>
            <div class="merge-export-notice">
              <strong>存储说明：</strong>导出文件保留 30 天，与预签名有效期无关；链接过期后可在任务详情中「刷新下载链接」。
            </div>
          </div>
        </el-form>

        <div class="merge-export-panel merge-export-panel--mapping">
          <div class="merge-export-dialog__table-toolbar">
            <div class="merge-export-dialog__table-head">
              <div class="sd-section-title merge-export-dialog__table-title">字段映射</div>
              <p class="merge-export-dialog__table-desc">
                从所选任务模板/自定义字段拉取，可修改；与导出语言一致时由后台用于列名。
              </p>
            </div>
            <div class="merge-export-dialog__table-actions">
              <el-button
                type="primary"
                plain
                :loading="mergeFieldsLoading"
                @click="loadMergeFieldMappingFromTasks"
              >
                从任务重新加载字段
              </el-button>
              <el-button @click="runMergeAutoDedupeAll">自动去重命名</el-button>
              <el-button @click="resetMergeFieldRowsFromBackup">恢复本次加载快照</el-button>
            </div>
          </div>
          <div
            v-if="mergeExportFiles.length"
            v-loading="mergeFieldsLoading"
            class="merge-field-table-wrap"
          >
            <el-table
              :data="mergeFieldRows"
              border
              size="small"
              max-height="260"
              stripe
              class="sd-table--clean merge-export-field-table"
              empty-text="暂无字段，请点击「从任务重新加载字段」"
            >
              <el-table-column type="index" label="序号" width="56" align="center" />
              <el-table-column label="英文字段" min-width="150">
                <template #default="{ row }">
                  <el-input
                    size="small"
                    :disabled="currentScopeLang !== 'en'"
                    :model-value="row[mergeMapScope].en"
                    @update:model-value="(v) => updateMergeRowCell(row, 'en', v)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="中文字段" min-width="150">
                <template #default="{ row }">
                  <el-input
                    size="small"
                    :disabled="currentScopeLang !== 'zh'"
                    :model-value="row[mergeMapScope].zh"
                    @update:model-value="(v) => updateMergeRowCell(row, 'zh', v)"
                  />
                </template>
              </el-table-column>
              <el-table-column prop="template_name" label="模板名称" min-width="120" show-overflow-tooltip />
            </el-table>
          </div>
          <div v-else class="merge-export-field-empty">请先勾选至少一种导出文件类型</div>
        </div>
      </div>
      <template #footer>
        <div class="sd-dialog-footer">
          <el-button class="sd-dialog-btn-cancel" @click="mergeExportDialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            class="sd-dialog-btn-primary"
            :loading="mergeSubmitLoading"
            :disabled="!mergeExportFiles.length"
            @click="submitMergeExport"
          >
            创建合并任务
          </el-button>
        </div>
      </template>
    </el-dialog>

    <MergeExportDetailDialog
      v-model:visible="mergeExportDetailDialog.visible"
      :task="mergeExportDetailDialog.task"
      @action-done="onMergeExportDetailActionDone"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, onActivated, nextTick, watch } from 'vue'

defineOptions({
  name: 'OcrTaskCenter'
})
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { Search, Refresh, Document, User, Loading, ArrowLeft, Warning, CircleCheckFilled, CircleCloseFilled, Clock } from '@element-plus/icons-vue'
import { getTaskPageListAPI, getTaskSchedulesAPI, getTaskStatusAPI, deleteTaskAPI, retryFailedResultsAPI, createMergeExportTaskAPI, batchMergeExportFieldSourcesAPI } from '@/api/task.js'
import { useBatchTaskPolling } from '@/composables/useTaskPolling.js'
import TaskResultViewer from './TaskResultViewer.vue'
import ContractViewer from '../file-manager-code/ContractViewer.vue'
import ThemeAnalysisViewer from '../file-manager-code/ThemeAnalysisViewer.vue'
import WordCloudAnalysis from '@/views/word-cloud-analysis/Index.vue'
import TaskRuntimeProgressTree from '../file-manager-code/components/contract/TaskRuntimeProgressTree.vue'
import MeetingMinutesViewer from '@/views/DemoAudit/meeting-minutes-analysis/index.vue'
import TimelineAnalysisViewer from '@/views/DemoAudit/timeline-analysis/TimelineAnalysisViewer.vue'
import BiddingAnalysisViewer from '@/views/DemoAudit/bidding-analysis/BiddingAnalysisViewer.vue'
import RiskPointAnalysisPrototype from '@/views/document-mining/RiskPointAnalysisPrototype.vue'
import PrepaidExpensesPrototype from '@/views/document-mining/PrepaidExpensesPrototype.vue'
import { resolvePrepaidPollAction } from '@/views/document-mining/prepaidTaskProgressUtils.js'
import { resolveScheduleTaskFailureMessage } from '@/composables/useScheduleTaskProgress.js'
import { buildTaskListProgressContext } from '@/utils/taskListProgressContext.js'
import EngineeringProjectViewer from '@/views/file-manager-code/EngineeringProjectViewer.vue'
import AssociationDegreeTwoTables from '@/views/file-manager-code/AssociationDegreeTwoTables.vue'
import MergeExportDetailDialog from './MergeExportDetailDialog.vue'
import {
  attachSelectionTreeToRuntimeNodes,
  resolveTaskDetailViewerType,
  resolveTaskDetailBizType
} from './taskCenterSelectionTreeUtils.js'

const router = useRouter()
const route = useRoute()

const applyProgressContext = (row) => {
  if (!row || typeof row !== 'object') return
  row.progress_context = buildTaskListProgressContext(row)
}

// 响应式数据
const loading = ref(false)
/** 任务中心表格骨架屏占位行数 */
const TASK_CENTER_SKELETON_ROW_COUNT = 10
const filterForm = reactive({
  status: '',
  inputMode: '',
  agentId: '',
  search: ''
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

const resultDialog = reactive({
  visible: false,
  task: null
})

// 任务列表数据
const taskList = ref([])
/** 合并导出任务详情（轻量弹框，展示配置与结果下载链接） */
const mergeExportDetailDialog = ref({
  visible: false,
  task: null
})

const taskTableRef = ref(null)
const mergeSelectedRows = ref([])
const mergeExportDialogVisible = ref(false)
const mergeExportFiles = ref(['excel', 'sql'])
const mergeExportTaskName = ref('')
const mergeExportTaskRemark = ref('')
const mergeFieldLang = ref('zh')
const mergeCommentFieldLang = ref('zh')
const mergeExcelHeaderLang = ref('zh')
const mergeExecuteMode = ref('immediate')
const mergeExcelRowsPerFile = ref(1)
const mergeSqlRowsPerFile = ref(1)
const mergeFileExpireDays = ref(7)
const mergeSubmitLoading = ref(false)
/** 当前编辑的映射维度：导出字段 / 注释字段 / Excel 表头（表格两列绑定该维度下的 zh、en） */
const mergeMapScope = ref('export')
/** 与当前维度绑定的「中文/英文」：既写入各维度 lang ref，也控制表格仅一侧可编辑 */
const currentScopeLang = computed({
  get() {
    const s = mergeMapScope.value
    if (s === 'export') return mergeFieldLang.value
    if (s === 'comment') return mergeCommentFieldLang.value
    return mergeExcelHeaderLang.value
  },
  set(v) {
    const s = mergeMapScope.value
    if (s === 'export') mergeFieldLang.value = v
    else if (s === 'comment') mergeCommentFieldLang.value = v
    else mergeExcelHeaderLang.value = v
  }
})
const mergeFieldsLoading = ref(false)
/** 聚合后的字段行（三套中英可编辑） */
const mergeFieldRows = ref([])
/** 打开弹窗或「重新加载示例」后的快照，用于「重置为默认」 */
const mergeFieldRowsBackup = ref([])

const MERGE_FALLBACK_FIELD_ROWS = () => [
  createMergeFieldRow({
    rowId: 'fb-1',
    templateIds: [],
    template_name: '示例',
    export: { zh: '甲方', en: 'party_a' },
    comment: { zh: '甲方（注释）', en: 'party_a_comment' },
    header: { zh: '甲方', en: 'party_a' }
  }),
  createMergeFieldRow({
    rowId: 'fb-2',
    templateIds: [],
    template_name: '示例',
    export: { zh: '乙方', en: 'party_b' },
    comment: { zh: '乙方（注释）', en: 'party_b_comment' },
    header: { zh: '乙方', en: 'party_b' }
  }),
  createMergeFieldRow({
    rowId: 'fb-3',
    templateIds: [],
    template_name: '示例',
    export: { zh: '合同金额', en: 'contract_amount' },
    comment: { zh: '合同金额（注释）', en: 'contract_amount_comment' },
    header: { zh: '合同金额', en: 'contract_amount' }
  })
]

function createMergeFieldRow(partial) {
  const ex = partial.export || {}
  const cm = partial.comment || {}
  const hd = partial.header || {}
  return {
    rowId: partial.rowId || `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    templateIds: Array.isArray(partial.templateIds) ? [...partial.templateIds] : [],
    template_name: partial.template_name || '',
    export: { zh: ex.zh ?? '', en: ex.en ?? '' },
    comment: { zh: cm.zh ?? '', en: cm.en ?? '' },
    header: { zh: hd.zh ?? '', en: hd.en ?? '' }
  }
}

function cloneMergeFieldRows(rows) {
  return (rows || []).map((r) => createMergeFieldRow(r))
}

/** 与列表 convertFileData 对齐：从单条 task_schedule_result 解析模板/自定义字段列表 */
function extractFieldDefinitionsFromTaskResult(file) {
  const out = []
  if (!file) return out
  const pushDef = (name, description, templateName) => {
    const n = String(name || '').trim()
    if (!n) return
    out.push({
      name: n,
      description: String(description || '').trim(),
      template_name: templateName || ''
    })
  }
  const templateName = file.template_name || ''

  try {
    if (file.parameter_settings) {
      const ps = typeof file.parameter_settings === 'string'
        ? JSON.parse(file.parameter_settings)
        : file.parameter_settings
      if (Array.isArray(ps)) {
        ps.forEach((f) =>
          pushDef(f?.name || f?.fieldName, f?.description || f?.fieldDescription, templateName)
        )
        if (out.length) return out
      }
      if (ps && typeof ps === 'object' && !Array.isArray(ps) && Array.isArray(ps.fieldDefinitions)) {
        ps.fieldDefinitions.forEach((f) =>
          pushDef(f.name || f.fieldName, f.description || f.fieldDescription, templateName)
        )
        if (out.length) return out
      }
      if (ps && typeof ps === 'object' && !Array.isArray(ps)) {
        const cc = ps.custom_config
        if (cc && typeof cc === 'object' && Array.isArray(cc.fields)) {
          cc.fields.forEach((f) =>
            pushDef(f?.name || f?.fieldName, f?.description || f?.fieldDescription, templateName)
          )
          if (out.length) return out
        }
      }
    }
  } catch {
    /* 继续尝试 parameter_template */
  }

  const pt = file.parameter_template
  if (pt == null || pt === '') return out
  if (Array.isArray(pt)) {
    pt.forEach((f) =>
      pushDef(f?.name || f?.fieldName, f?.description || f?.fieldDescription, templateName)
    )
    return out
  }
  if (typeof pt === 'string') {
    const trimmed = pt.trim()
    if (!trimmed.startsWith('[')) return out
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        parsed.forEach((f) =>
          pushDef(f?.name || f?.fieldName, f?.description || f?.fieldDescription, templateName)
        )
        return out
      }
    } catch {
      try {
        const normalized = trimmed.replace(/'/g, '"')
        const parsed = JSON.parse(normalized)
        if (Array.isArray(parsed)) {
          parsed.forEach((f) =>
            pushDef(f?.name || f?.fieldName, f?.description || f?.fieldDescription, templateName)
          )
        }
      } catch {
        /* ignore */
      }
    }
  }
  return out
}

function dedupeFieldDefinitionsByName(defs) {
  const map = new Map()
  for (const d of defs || []) {
    const k = String(d.name || '').trim()
    if (!k || map.has(k)) continue
    map.set(k, d)
  }
  return [...map.values()]
}

/** 生成默认英文标识：纯中文名时退化为 field_序号 */
function slugifyMergeExportIdent(text, idx) {
  const raw = String(text || '').trim()
  const ascii = raw
    .replace(/[^\x00-\x7F]+/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (ascii) return ascii.slice(0, 60)
  return `field_${idx}`
}

function buildMergeFieldRowsFromTaskDefinitions(defs) {
  const unique = dedupeFieldDefinitionsByName(defs)
  return unique.map((d, i) => {
    const idx = i + 1
    const zh = d.name
    const desc = d.description || ''
    const en = slugifyMergeExportIdent(zh, idx)
    const descSlug = desc ? slugifyMergeExportIdent(desc, idx) : ''
    return createMergeFieldRow({
      rowId: `task-field-${idx}-${en}`,
      templateIds: [],
      template_name: d.template_name || '',
      export: { zh, en },
      comment: { zh: desc || `${zh}（注释）`, en: descSlug || `${en}_comment` },
      header: { zh, en }
    })
  })
}

function buildMergeExportDefaultTaskName() {
  const pad = (x) => String(x).padStart(2, '0')
  const d = new Date()
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `文本信息提取结果合并导出${stamp}`
}

const toggleMergeExportFile = (k) => {
  const key = String(k)
  const cur = new Set(mergeExportFiles.value || [])
  if (cur.has(key)) cur.delete(key)
  else cur.add(key)
  mergeExportFiles.value = [...cur]
}

const availableMergeMapScopes = computed(() => {
  const out = []
  if (mergeExportFiles.value.includes('sql')) {
    out.push('export', 'comment')
  }
  if (mergeExportFiles.value.includes('excel')) {
    out.push('header')
  }
  return out
})

const mergeMapScopeLabel = (s) => {
  if (s === 'export') return '导出字段'
  if (s === 'comment') return '注释字段'
  return 'Excel 表头'
}

/** 同一维度+语言列内，重名依次追加 1、2、3…（首个保持原名） */
function applyNumericSuffixDedupe(rows, scope, lang) {
  const used = new Set()
  return (rows || []).map((row) => {
    const dim = { ...(row[scope] || { zh: '', en: '' }) }
    let v = String(dim[lang] || '').trim()
    if (!v) {
      v = lang === 'zh' ? '字段' : 'field'
    }
    let candidate = v
    let n = 0
    while (used.has(candidate)) {
      n += 1
      candidate = `${v}${n}`
    }
    used.add(candidate)
    dim[lang] = candidate
    return { ...row, [scope]: dim }
  })
}

const runMergeAutoDedupeAll = () => {
  let rows = cloneMergeFieldRows(mergeFieldRows.value)
  for (const scope of ['export', 'comment', 'header']) {
    for (const lang of ['zh', 'en']) {
      rows = applyNumericSuffixDedupe(rows, scope, lang)
    }
  }
  mergeFieldRows.value = rows
}

const resetMergeFieldRowsFromBackup = () => {
  if (!mergeFieldRowsBackup.value.length) {
    ElMessage.info('暂无快照，已恢复内置示例字段')
    mergeFieldRows.value = MERGE_FALLBACK_FIELD_ROWS()
    return
  }
  mergeFieldRows.value = cloneMergeFieldRows(mergeFieldRowsBackup.value)
  ElMessage.success('已恢复为本次打开弹窗时加载的字段')
}

const updateMergeRowCell = (row, lang, val) => {
  const s = mergeMapScope.value
  if (!row[s]) row[s] = { zh: '', en: '' }
  row[s][lang] = val
}

function buildSqlArtifactsPlaceholder(includeSql, totalPlaceholderRows, perFileRows) {
  if (!includeSql) return []
  const per = Math.max(1, Number(perFileRows) || 1)
  const total = Math.max(1, Number(totalPlaceholderRows) || 1)
  const insertFileCount = Math.max(1, Math.ceil(total / per))
  const stamp = Date.now()
  const artifacts = [
    {
      type: 'ddl',
      filename: `merge_export_${stamp}_ddl.sql`,
      note: 'CREATE TABLE（单文件，联调后生成真实 DDL）'
    }
  ]
  for (let i = 1; i <= insertFileCount; i += 1) {
    artifacts.push({
      type: 'insert',
      filename: `merge_export_${stamp}_insert_${String(i).padStart(3, '0')}.sql`,
      maxRows: per,
      partIndex: i,
      partTotal: insertFileCount,
      note: 'INSERT 分批（后台按实际导出行数生成文件）'
    })
  }
  return artifacts
}

/** 从所选各任务的详情中读取 parameter_template / fieldDefinitions，合并去重后填充映射表 */
const loadMergeFieldMappingFromTasks = async () => {
  if (!mergeSelectedRows.value.length) {
    ElMessage.warning('请先勾选至少 2 条任务并打开本弹窗')
    return
  }
  mergeFieldsLoading.value = true
  try {
    const allDefs = []
    let failedCount = 0
    const taskIds = mergeSelectedRows.value.map((r) => r.task_id)
    const res = await batchMergeExportFieldSourcesAPI(taskIds)
    if (res?.code !== 200) {
      ElMessage.error(res?.message || '批量加载字段来源失败')
      return
    }
    const items = res.data?.items || []
    for (const item of items) {
      if (!item?.accessible) {
        failedCount += 1
        continue
      }
      const list = item.task_schedule_result_list || []
      for (const file of list) {
        allDefs.push(...extractFieldDefinitionsFromTaskResult(file))
      }
    }
    const rows = buildMergeFieldRowsFromTaskDefinitions(allDefs)
    if (!rows.length) {
      const fb = MERGE_FALLBACK_FIELD_ROWS()
      mergeFieldRows.value = fb
      mergeFieldRowsBackup.value = cloneMergeFieldRows(fb)
      ElMessage.warning(
        failedCount
          ? `${failedCount} 个任务详情拉取失败或未包含字段列表；所选任务可能为 Prompt 模式。已使用内置示例字段，请手工调整。`
          : '未从任务中解析到字段模板（常见于 Prompt 模式）。已使用内置示例字段，请手工调整。'
      )
      return
    }
    mergeFieldRows.value = rows
    mergeFieldRowsBackup.value = cloneMergeFieldRows(rows)
    if (failedCount) {
      ElMessage.success(`已加载 ${rows.length} 个字段（${failedCount} 个任务详情未拉到或失败）`)
    } else {
      ElMessage.success(`已加载 ${rows.length} 个字段（来自所选任务的模板/自定义字段）`)
    }
  } finally {
    mergeFieldsLoading.value = false
  }
}

const mergeLockedAgentId = computed(() =>
  mergeSelectedRows.value.length ? (mergeSelectedRows.value[0].agent_id || '') : ''
)
const mergeLockedAgentName = computed(() =>
  mergeSelectedRows.value.length ? (mergeSelectedRows.value[0].agent_name || '') : ''
)

const mergeSelectedFileTotal = computed(() =>
  mergeSelectedRows.value.reduce((s, r) => s + (Number(r.file_total_count) || 0), 0)
)

const mergeSelectedFileSuccessTotal = computed(() =>
  mergeSelectedRows.value.reduce((s, r) => s + (Number(r.file_success_count) || 0), 0)
)

const mergeSelectedFileFailedTotal = computed(() =>
  mergeSelectedRows.value.reduce((s, r) => s + (Number(r.file_failed_count) || 0), 0)
)

/** 与已选第一条任务的「调用工具」一致时才允许勾选的行，避免混选不同工具 */
const mergeRowSelectable = (row) => {
  if (row?.is_merge_export_task) return false
  const sel = mergeSelectedRows.value
  if (!sel || sel.length === 0) return true
  const first = String(sel[0].agent_id || '')
  return String(row.agent_id || '') === first
}

const onMergeSelectionChange = (rows) => {
  mergeSelectedRows.value = rows
}

const canMergeExport = computed(() => mergeSelectedRows.value.length >= 2)

const clearMergeSelection = () => {
  mergeSelectedRows.value = []
  nextTick(() => {
    taskTableRef.value?.clearSelection()
  })
}

const openMergeExportDialog = async () => {
  if (!canMergeExport.value) {
    ElMessage.warning('请至少勾选 2 条任务')
    return
  }
  const agentIds = mergeSelectedRows.value.map((r) => String(r.agent_id || ''))
  if (new Set(agentIds).size > 1) {
    ElMessage.warning('仅支持与首次勾选相同「调用工具」的任务合并导出')
    return
  }
  const total = mergeSelectedRows.value.reduce((s, r) => s + (Number(r.file_total_count) || 0), 0)
  const def = Math.max(1, total || 1)
  mergeExcelRowsPerFile.value = def
  mergeSqlRowsPerFile.value = def
  mergeExportTaskName.value = buildMergeExportDefaultTaskName()
  mergeExportTaskRemark.value = ''
  // 默认优先：SQL -> export；否则 Excel -> header
  mergeMapScope.value = mergeExportFiles.value.includes('sql') ? 'export' : 'header'
  mergeExportDialogVisible.value = true
  await loadMergeFieldMappingFromTasks()
}

watch(
  () => [...mergeExportFiles.value],
  () => {
    const avail = availableMergeMapScopes.value
    if (!avail.includes(mergeMapScope.value)) {
      mergeMapScope.value = avail.includes('header') ? 'header' : (avail[0] || 'export')
    }
  }
)

const submitMergeExport = async () => {
  if (!mergeExportFiles.value.length) {
    ElMessage.warning('请至少选择一种导出文件')
    return
  }
  mergeSubmitLoading.value = true
  try {
    const totalPlaceholderRows = mergeSelectedFileTotal.value
    const sqlArtifacts = buildSqlArtifactsPlaceholder(
      mergeExportFiles.value.includes('sql'),
      totalPlaceholderRows,
      mergeSqlRowsPerFile.value
    )
    const fieldMappingSnapshot = cloneMergeFieldRows(mergeFieldRows.value)
    const payload = {
      task_name: String(mergeExportTaskName.value || '').trim() || buildMergeExportDefaultTaskName(),
      task_notes: String(mergeExportTaskRemark.value || '').trim() || undefined,
      task_uuids: mergeSelectedRows.value.map((r) => r.task_id),
      tool_uuid: mergeLockedAgentId.value,
      execute_mode: mergeExecuteMode.value,
      task_switch: mergeExecuteMode.value === 'immediate' ? 1 : 2,
      export: {
        files: [...mergeExportFiles.value],
        field_lang: mergeFieldLang.value,
        comment_field_lang: mergeCommentFieldLang.value,
        excel_header_lang: mergeExcelHeaderLang.value,
        excel_rows_per_file: mergeExportFiles.value.includes('excel') ? mergeExcelRowsPerFile.value : undefined,
        sql_rows_per_file: mergeExportFiles.value.includes('sql') ? mergeSqlRowsPerFile.value : undefined,
        sql_ddl_as_separate_file: true,
        sql_artifacts: sqlArtifacts,
        /** 三套中英字段映射，写入任务快照供后台合并导出使用 */
        field_mapping: fieldMappingSnapshot,
        mapping_edit_scope_used: mergeMapScope.value
      },
      file_expire_days: mergeFileExpireDays.value,
      /** 前端估算行数，供后台展示或校验参考 */
      export_row_estimate: totalPlaceholderRows
    }
    const res = await createMergeExportTaskAPI(payload)
    if (res?.code === 200) {
      ElMessage.success(res.message || '合并导出任务已创建，正在后台执行；完成后请刷新列表并在「详情」中下载')
      if (import.meta.env.DEV) {

        console.log('[merge-export] created', res.data, payload)
      }
      mergeExportDialogVisible.value = false
      clearMergeSelection()
      await loadTaskList()
    } else {
      ElMessage.error(res?.message || '创建合并导出任务失败')
    }
  } catch (e) {
    const d = e?.response?.data?.detail
    const msg = typeof d === 'string' ? d : (e?.response?.data?.message || e?.message || '创建合并导出任务失败')
    ElMessage.error(msg)
  } finally {
    mergeSubmitLoading.value = false
  }
}

const retryLoadingTaskIds = ref({})
const setTaskRetryLoading = (taskId, loadingState) => {
  retryLoadingTaskIds.value = {
    ...retryLoadingTaskIds.value,
    [taskId]: Boolean(loadingState)
  }
}
const isTaskRetryLoading = (taskId) => Boolean(retryLoadingTaskIds.value[taskId])

/** 重试成功后立即把列表行切为进行中，避免等 PageList 返回旧态 */
const applyTaskRowOptimisticRetry = (taskId, retryRes) => {
  const idx = taskList.value.findIndex((t) => t.task_id === taskId)
  if (idx < 0) return

  const row = taskList.value[idx]
  const retryKind = String(retryRes?.data?.retry_kind || '')
  const retryTotal = Number(retryRes?.data?.retry_total ?? 0) || 0

  const cleanRemark = String(row.task_remark || '')
    .replace(/（后台终止中）/g, '')
    .replace(/（用户终止任务）/g, '')
    .replace(/用户终止任务/g, '')
    .trim()

  row.task_status = 1
  row.status = 'processing'
  row.is_terminated = false
  row.task_remark = cleanRemark
  row.current_progress = '进行中'
  row.completed_at = ''

  if (row.biz_type === 'prepaidExpenses') {
    if (retryKind === 'restore_await') {
      row.prepaid_phase = 'awaiting_billing_base'
      row.file_failed_count = 0
      row.file_processing_count = 0
      row.file_pending_count = Math.max(0, Number(row.file_total_count) || 0)
    } else if (retryKind === 'extract') {
      row.prepaid_phase = 'pending_extract'
      row.file_failed_count = 0
      row.file_processing_count = Math.max(retryTotal, 1)
      row.file_pending_count = Math.max(0, (Number(row.file_total_count) || 0) - row.file_processing_count)
    } else {
      row.prepaid_phase = 'calculating'
      row.file_failed_count = 0
      row.file_processing_count = Math.max(retryTotal, 1)
      row.file_pending_count = Math.max(0, (Number(row.file_total_count) || 0) - row.file_processing_count)
    }
  } else {
    row.file_failed_count = 0
    row.file_processing_count = Math.max(retryTotal, 1)
    const total = Number(row.file_total_count) || 0
    const success = Number(row.file_success_count) || 0
    row.file_pending_count = Math.max(0, total - success - row.file_processing_count)
  }

  const completed = Number(row.file_success_count) + Number(row.file_processing_count) + Number(row.file_failed_count)
  const totalForPct = Number(row.file_total_count) || 0
  row.file_completed_count = Math.min(completed, totalForPct)
  row.file_progress_percent = totalForPct > 0
    ? Math.min(100, Math.round((row.file_completed_count / totalForPct) * 100))
    : 0

  applyProgressContext(row)
}

const refreshTaskRowAfterRetry = async (taskId) => {
  try {
    const res = await getTaskSchedulesAPI(taskId, {
      prefer_runtime: true,
      include_task_steps: true,
      include_progress_counts: true
    })
    if (res?.code !== 200 || !res?.data) return
    const idx = taskList.value.findIndex((t) => t.task_id === taskId)
    if (idx < 0) return
    const merged = convertTaskData(res.data)
    taskList.value[idx] = { ...taskList.value[idx], ...merged }
    applyProgressContext(taskList.value[idx])
  } catch (e) {
    console.warn('重试后刷新任务行失败:', e)
  }
}

// 批量任务轮询
const { isPolling: isTaskPolling, startPolling: startTaskPolling, stopPolling: stopTaskPolling, updateTaskIds } = useBatchTaskPolling({
  fetchStatusList: async (taskIds) => {
    if (!taskIds || taskIds.length === 0) {
      return { code: 200, data: { items: [], total: 0 } }
    }
    // 批量获取任务状态 - 只查询当前分页中的进行中的任务
    return await getTaskPageListAPI({
      page: pagination.page,
      size: pagination.size,
      processing_status: 1,
      include_results: false,
      include_selection_summary: false,
      include_task_steps: true,
      prefer_runtime: false,
      include_total: false,
      include_progress_counts: true
    })
  },
  interval: 5000, // 每5秒轮询一次
  onUpdate: (updatedTasks) => {
    updateTaskStatuses(updatedTasks)
  }
})

// ==================== 任务进度管理（统一进度遮罩） ====================
const taskProgressLoading = ref(false)
const taskProgressElapsedTime = ref(0)
const taskProgressText = ref('任务执行中... 0.0s')
const taskProgressRuntimeNodes = ref([])
const currentTaskUuid = ref(null)
let taskProgressTimer = null
let taskPollTimer = null
/** 每轮进度追踪递增，丢弃泄漏/重叠的 setInterval 与 await 之后的陈旧回调 */
let taskProgressPollToken = 0
const TASK_POLL_INTERVAL_MS = 2000
/** 待摊费用：阶段①完成提示去重 */
let prepaidProgressLastNotifiedPhase = ''
let prepaidProgressLastTaskUuid = ''

/** 待摊费用：关详情弹窗后后台追踪 */
let prepaidBackgroundPollToken = 0
let prepaidBackgroundPollTimeout = null
const prepaidBackgroundNotifiedKeys = new Set()
const prepaidBackgroundWatchVisible = ref(false)
const prepaidBackgroundTaskMeta = ref({ taskId: '', taskName: '', bizType: 'prepaidExpenses' })
const PREPAID_BACKGROUND_POLL_MS = 2000
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

// ==================== 任务进度管理 ====================

// 清理任务进度定时器
const clearTaskProgressTimers = () => {
  if (taskProgressTimer) {
    clearInterval(taskProgressTimer)
    taskProgressTimer = null
  }
  if (taskPollTimer) {
    clearInterval(taskPollTimer)
    taskPollTimer = null
  }
}

// 完成任务加载（任务真正完成/失败时调用，停止一切）
const finishTaskProgress = () => {
  taskProgressPollToken++
  clearTaskProgressTimers()
  taskProgressLoading.value = false
  taskProgressFloatingVisible.value = false
  taskProgressText.value = ''
  taskProgressElapsedTime.value = 0
  currentTaskUuid.value = null
}

// 用户手动取消遮罩（只隐藏 UI，轮询继续在后台跑）
const cancelTaskProgressOverlay = () => {
  // 停止计时器（UI已关闭不需要更新文字），但保留轮询 timer
  if (taskProgressTimer) {
    clearInterval(taskProgressTimer)
    taskProgressTimer = null
  }
  taskProgressLoading.value = false
  taskProgressFloatingVisible.value = false
  taskProgressText.value = ''
  taskProgressElapsedTime.value = 0
  // taskPollTimer 继续运行，完成后 pollTaskProgress 会自动调用 setResult
}

// 开始任务进度追踪
const startTaskProgress = (taskUuid, taskName = '任务', taskOther) => {
  console.log('taskOther', taskOther)

  if (!taskUuid) {
    ElMessage.error('未获取到任务标识')
    return
  }

  clearTaskProgressTimers()
  const pollToken = ++taskProgressPollToken
  currentTaskUuid.value = taskUuid
  taskProgressLoading.value = true
  taskProgressElapsedTime.value = 0
  taskProgressText.value = `${taskName}执行中... 0.0s`
  taskProgressRuntimeNodes.value = []
  if (prepaidProgressLastTaskUuid !== taskUuid) {
    prepaidProgressLastNotifiedPhase = ''
    prepaidProgressLastTaskUuid = taskUuid
  }

  // 启动计时器
  taskProgressTimer = setInterval(() => {
    taskProgressElapsedTime.value += 0.1
    taskProgressText.value = `${taskName}执行中... ${taskProgressElapsedTime.value.toFixed(1)}s`
  }, 100)

  // 立即执行一次轮询
  pollTaskProgress(taskUuid, taskOther, pollToken)

  // 启动轮询定时器
  taskPollTimer = setInterval(() => {
    pollTaskProgress(taskUuid, taskOther, pollToken)
  }, TASK_POLL_INTERVAL_MS)
}

const viewerRef = ref(null)

const stopPrepaidBackgroundWatch = () => {
  prepaidBackgroundPollToken++
  prepaidBackgroundWatchVisible.value = false
  if (prepaidBackgroundPollTimeout) {
    clearTimeout(prepaidBackgroundPollTimeout)
    prepaidBackgroundPollTimeout = null
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

const notifyPrepaidBackgroundOnce = (key, notificationOptions) => {
  if (prepaidBackgroundNotifiedKeys.has(key)) return false
  prepaidBackgroundNotifiedKeys.add(key)
  ElNotification(notificationOptions)
  return true
}

const reopenPrepaidTaskResultDialog = (taskUuid, taskName = '') => {
  if (!taskUuid) return
  const alreadyOpen = taskResultDialog.value.visible
    && taskResultDialog.value.bizType === 'prepaidExpenses'
    && String(taskResultDialog.value.taskId || '') === String(taskUuid)
  if (!alreadyOpen) {
    openTaskResultDialog({
      taskName: taskName || prepaidBackgroundTaskMeta.value.taskName || '待摊费用',
      taskType: 10,
      bizType: 'prepaidExpenses',
      taskId: taskUuid
    })
  }
  nextTick(() => {
    viewerRef.value?.loadPrepaidTaskById?.()
  })
}

const handlePrepaidBackgroundTerminal = async (action, td, resultList, taskUuid) => {
  prepaidNeedsBackgroundWatch = false
  stopPrepaidBackgroundWatch()
  const taskName = td?.task_name || prepaidBackgroundTaskMeta.value.taskName || '待摊费用'
  if (action === 'phase1_done') {
    notifyPrepaidBackgroundOnce(`${taskUuid}:awaiting_billing_base`, {
      title: '待摊费用',
      message: '计费约定已提取，请填写计费基数后继续',
      type: 'info',
      duration: 8000
    })
    return
  }
  if (action === 'complete') {
    notifyPrepaidBackgroundOnce(`${taskUuid}:completed`, {
      title: '待摊费用',
      message: '费用计算已完成',
      type: 'success',
      duration: 8000
    })
    return
  }
  if (action === 'fail') {
    notifyPrepaidBackgroundOnce(`${taskUuid}:failed`, {
      title: '待摊费用',
      message: resolveScheduleTaskFailureMessage(td) || '任务处理失败',
      type: 'error',
      duration: 8000
    })
  }
}

const pollPrepaidBackgroundWatch = async (taskUuid, pollToken) => {
  if (pollToken !== prepaidBackgroundPollToken) return
  if (!taskUuid) {
    stopPrepaidBackgroundWatch()
    return
  }

  try {
    const detailRes = await getTaskSchedulesAPI(taskUuid, {
      prefer_runtime: true,
      include_result_details: true,
      include_results: true,
      include_task_steps: true,
      include_selection_summary: true
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

    if (taskResultDialog.value.visible && taskResultDialog.value.bizType === 'prepaidExpenses') {
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
    if (pollToken !== prepaidBackgroundPollToken) return
    console.error('[PrepaidBackground] 轮询失败:', error)
    schedulePrepaidBackgroundPoll(taskUuid, pollToken)
  }
}

const startPrepaidBackgroundWatch = (taskUuid, meta = {}) => {
  const uuid = String(taskUuid || '').trim()
  if (!uuid) return
  prepaidBackgroundTaskMeta.value = {
    taskId: uuid,
    taskName: meta.taskName || prepaidBackgroundTaskMeta.value.taskName || '待摊费用',
    bizType: 'prepaidExpenses'
  }
  stopPrepaidBackgroundWatch()
  const pollToken = ++prepaidBackgroundPollToken
  prepaidBackgroundWatchVisible.value = true
  pollPrepaidBackgroundWatch(uuid, pollToken)
}

const applyPrepaidForegroundPollResolution = async ({
  td,
  resultList,
  taskUuid,
  taskOther,
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
    ElMessage.error(resolveScheduleTaskFailureMessage(td))
    viewerRef.value?.taskError?.()
    return true
  }

  if (resolved.action === 'complete') {
    prepaidNeedsBackgroundWatch = false
    finishTaskProgress()
    ElMessage.success('任务执行完成')
    await viewerRef.value?.setResult?.(resultList, taskOther)
    return true
  }

  if (resolved.action === 'complete_pending_results') {
    return true
  }

  if (resolved.action === 'continue' || resolved.action === 'phase1_done_continue' || resolved.action === 'keep_polling') {
    return true
  }

  if (resolved.action === 'phase1_done') {
    prepaidNeedsBackgroundWatch = false
    if (resolved.notifyPhase1) {
      prepaidProgressLastNotifiedPhase = 'awaiting_billing_base'
      finishTaskProgress()
      ElMessage.info('计费约定提取完成，请填写计费基数后点击执行')
    }
    return true
  }

  return false
}

// 轮询任务进度
const pollTaskProgress = async (taskUuid, taskOther, pollToken) => {
  if (pollToken !== taskProgressPollToken) return

  try {
    const isPrepaidPoll = taskResultDialog.value.bizType === 'prepaidExpenses'
    const isContractPoll = taskResultDialog.value.bizType === 'contractCompleteness'
    const detailRes = await getTaskSchedulesAPI(taskUuid, {
      prefer_runtime: true,
      include_result_details: isPrepaidPoll || isContractPoll,
      include_results: true,
      include_task_steps: true,
      include_selection_summary: true
    })
    if (pollToken !== taskProgressPollToken) return

    if (detailRes.code !== 200 || !detailRes.data) {
      const msg = String(detailRes?.message || '')
      const isTerminatedLike =
        detailRes?.code === 404 ||
        msg.includes('不存在') ||
        msg.includes('已删除')
      if (isTerminatedLike) {
        finishTaskProgress()
        ElMessage.info('任务已终止，停止轮询')
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

    // 获取运行时节点树
    const runtimeFromApi =
      Array.isArray(td.runtime_nodes) && td.runtime_nodes.length
        ? td.runtime_nodes
        : Array.isArray(td.step_tree)
          ? td.step_tree
          : []

    // 合并错误信息到运行时节点
    taskProgressRuntimeNodes.value = mergeRuntimeNodesWithErrors(td, runtimeFromApi)

    // 待摊费用：阶段①完成后刷新详情，等待用户填写计费基数
    if (bizType === 'prepaidExpenses') {
      const serverPrepaidPhase = prepaidPhase
      const handled = await applyPrepaidForegroundPollResolution({
        td,
        resultList,
        taskUuid,
        taskOther,
        serverPrepaidPhase,
        taskStatus
      })
      if (handled) return
      return
    }

    // 招投标分析：按规则完成数刷新详情，完成后结束进度轮询
    if (bizType === 'biddingAnalysis') {
      viewerRef.value?.refreshFromTaskDetail?.(td)
      if (taskStatus === 3) {
        finishTaskProgress()
        const errMsg = resolveScheduleTaskFailureMessage(td)
        ElMessage.error(errMsg)
        viewerRef.value?.taskError?.(errMsg)
        return
      }
      const ruleTotal = Number(td.rule_total) || 0
      const ruleDone = Number(td.rule_done) || 0
      const baStatus = String(td.ba_status || '')
      if (taskStatus === 2 || baStatus === 'SUCCESS' || (ruleTotal > 0 && ruleDone >= ruleTotal)) {
        finishTaskProgress()
        ElMessage.success('任务执行完成')
        return
      }
      return
    }

    // 信息提取等通用任务：轮询时仅就地刷新左侧文件状态，避免整树替换导致展开收起
    if (taskResultDialog.value.visible) {
      viewerRef.value?.refreshFromTaskDetail?.(td, resultList)
    }

    // 任务失败（不可用 task_notes：那是用户备注，不是系统失败原因）
    if (taskStatus === 3 || fileStatuses.some((s) => s === 3)) {
      finishTaskProgress()
      const errMsg = resolveScheduleTaskFailureMessage(td)
      ElMessage.error(errMsg)
      viewerRef.value?.taskError?.(errMsg)
      return
    }

    // 任务完成：task_status 可能滞后，以各文件 processing_status 全部完成为准
    const allFilesSucceeded =
      fileStatuses.length > 0 && fileStatuses.every((s) => s === 2)
    const allTerminal =
      fileStatuses.length > 0 && fileStatuses.every((s) => s === 2 || s === 3)
    if (taskStatus === 2 || allFilesSucceeded || allTerminal) {
      finishTaskProgress()
      ElMessage.success('任务执行完成')
      viewerRef.value?.setResult(detailRes.data.task_schedule_result_list, taskOther)
      viewerRef.value?.setAnalysisContext?.({
        taskUuid,
        taskData: detailRes.data
      })
      return
    }
  } catch (error) {
    const errMsg =
      String(error?.response?.data?.message || '') ||
      String(error?.message || '')
    if (errMsg.includes('不存在') || errMsg.includes('已删除')) {
      finishTaskProgress()
      ElMessage.info('任务已终止，停止轮询')
      return
    }
    console.error('查询任务进度失败:', error)
  }
}

// 将错误信息合并到运行时节点
const mergeRuntimeNodesWithErrors = (detail, nodes) => {
  const taskStepProgress = Array.isArray(detail.task_step_progress) ? detail.task_step_progress : []
  const taskStepByKey = new Map(
    taskStepProgress.map((s) => [s.step_key || s.key, s])
  )

  const resultList = Array.isArray(detail.task_schedule_result_list) ? detail.task_schedule_result_list : []
  const resultByUuid = new Map(
    resultList.map((r) => [r.result_uuid || r.RESULT_UUID || r.id, r])
  )

  const findFirstFailedError = (arr) => {
    if (!Array.isArray(arr)) return null
    for (const n of arr) {
      const err = n ? (n.error_message || n.ERROR_MESSAGE || null) : null
      if (Number(n.status) === 3 && err) return err
      const sub = findFirstFailedError(n && n.children)
      if (sub) return sub
    }
    return null
  }

  const collectFileItemStatuses = (nodes) => {
    const out = []
    if (!Array.isArray(nodes)) return out
    for (const n of nodes) {
      if (!n) continue
      if (n.node_type === 'file_item') {
        out.push(Number(n.status))
      } else if (Array.isArray(n.children) && n.children.length) {
        out.push(...collectFileItemStatuses(n.children))
      }
    }
    return out
  }

  const applyNode = (node) => {
    const merged = { ...node }
    merged.children = Array.isArray(merged.children) ? merged.children.map(applyNode) : []

    const nodeStatus = Number(merged.status)

    if (merged && merged.node_type === 'task_group') {
      const stepKey = merged.key || merged.step_key
      const step = taskStepByKey.get(stepKey)
      let err = step ? (step.error_message || step.ERROR_MESSAGE || null) : null

      if (nodeStatus === 3 && !err) {
        err = findFirstFailedError(merged.children)
      }
      if (nodeStatus === 3) merged.error_message = err
      // 运行态可能把步骤标成失败，但库表文件仍为未开始/进行中：与列表聚合一律不按失败展示
      const fileSts = collectFileItemStatuses(merged.children)
      const anyDone = fileSts.some((s) => s === 2)
      const anyRealFail = fileSts.some((s) => s === 3)
      if (
        nodeStatus === 3 &&
        !err &&
        fileSts.length > 0 &&
        !anyRealFail &&
        !anyDone
      ) {
        merged.status = 0
        merged.error_message = null
      }
    } else if (merged && merged.node_type === 'file_item') {
      const uuid = merged.key || merged.id
      const res = resultByUuid.get(uuid)
      if (res) {
        const ps = Number(res.processing_status ?? res.PROCESSING_STATUS)
        if (!Number.isNaN(ps)) {
          if (ps === 2 || ps === 3) {
            merged.status = ps
          } else if ((ps === 0 || ps === 1) && nodeStatus === 3) {
            merged.status = ps
          }
        }
        let err = res.error_message || res.ERROR_MESSAGE || null
        if (!err) {
          const fps = Array.isArray(res.file_step_progress) ? res.file_step_progress : []
          const failedStep = fps.find((x) => Number(x.status) === 3)
          if (failedStep) {
            err = failedStep.error_message || failedStep.ERROR_MESSAGE || null
          }
        }
        if (ps === 3) merged.error_message = err
      }
    }

    return merged
  }

  const mergedNodes = Array.isArray(nodes) ? nodes.map(applyNode) : []
  return attachSelectionTreeToRuntimeNodes(mergedNodes, detail)
}

// 状态映射：后端状态码 -> 前端状态字符串
const statusMap = {
  0: 'pending',      // 未开始
  1: 'processing',   // 进行中
  2: 'completed',    // 已完成
  3: 'failed'        // 失败
}

const isUserTerminatedTask = (taskLike) => {
  const taskStatus = Number(taskLike?.task_status)
  if (taskStatus !== 3) return false
  const notes = String(taskLike?.task_notes || taskLike?.task_remark || '')
  return notes.includes('用户终止任务')
}

const isTerminatingTask = (taskLike) => {
  const taskStatus = Number(taskLike?.task_status)
  if (taskStatus !== 3) return false
  const notes = String(taskLike?.task_notes || taskLike?.task_remark || '')
  return notes.includes('后台终止中')
}

// 转换后端任务数据为前端格式
const convertTaskData = (task) => {
  // 转换任务关联的文件列表（task_schedule_result_list）
  let files = []
  if (task.task_schedule_result_list && Array.isArray(task.task_schedule_result_list)) {
    files = task.task_schedule_result_list.map(convertFileData)
  }

  let selectionSummary = null
  try {
    if (task.selection_summary && typeof task.selection_summary === 'object') {
      selectionSummary = task.selection_summary
    } else if (task.selection_snapshot) {
      selectionSummary = typeof task.selection_snapshot === 'string'
        ? JSON.parse(task.selection_snapshot)
        : task.selection_snapshot
    }
  } catch (e) {
    console.warn('解析 selection snapshot 失败:', e)
  }

  const fileTotalCount = Number(task.file_total_count ?? task.file_num ?? files.length ?? 0) || 0
  let fileSuccessCount = Number(task.file_success_count ?? files.filter(f => f.processing_status === 2).length ?? 0) || 0
  let fileFailedCount = Number(task.file_failed_count ?? files.filter(f => f.processing_status === 3).length ?? 0) || 0
  const taskStatusNum = Number(task.task_status)
  // 历史数据：仅「已完成」主任务且 RESULT 行未写入终态时，聚合计数为 0 的回补（失败任务下文件常为 0/1，不可推断为全部失败）
  if (fileTotalCount > 0 && fileSuccessCount === 0 && fileFailedCount === 0 && taskStatusNum === 2) {
    fileSuccessCount = fileTotalCount
  }
  const fileCompletedCount = Number(
    task.file_completed_count ?? (fileSuccessCount + fileFailedCount)
  ) || 0
  let fileProcessingCount = Number(task.file_processing_count ?? files.filter(f => Number(f.processing_status) === 1).length ?? 0) || 0
  let filePendingCount = Number(task.file_pending_count ?? files.filter(f => Number(f.processing_status) === 0).length ?? 0) || 0
  const fileRemainingCount = Math.max(0, fileTotalCount - fileCompletedCount)
  if (fileProcessingCount + filePendingCount === 0 && fileRemainingCount > 0) {
    // 无明细场景下的保守推断：运行中任务把剩余量归为进行中，否则归为等待
    if (taskStatusNum === 1) {
      fileProcessingCount = fileRemainingCount
      filePendingCount = 0
    } else {
      fileProcessingCount = 0
      filePendingCount = fileRemainingCount
    }
  } else if (fileProcessingCount + filePendingCount > fileRemainingCount) {
    // 防御异常计数，避免显示超过总量
    const overflow = fileProcessingCount + filePendingCount - fileRemainingCount
    filePendingCount = Math.max(0, filePendingCount - overflow)
  }
  const safeCompletedCount = Math.min(fileCompletedCount, fileTotalCount)
  const fileProgressPercent = fileTotalCount > 0
    ? Math.min(100, Math.round((safeCompletedCount / fileTotalCount) * 100))
    : 0

  const isTerminated = isUserTerminatedTask(task)

  const isMergeExportTask =
    task.biz_type === 'mergeExport' || Number(task.task_type) === 98
  const mergeExportConfig =
    task.merge_export_config || selectionSummary?.merge_export_config || null
  const mergeSourceTasks =
    task.merge_source_tasks || selectionSummary?.merge_source_tasks || []
  const mergeResultFiles =
    task.merge_export_result_files || selectionSummary?.result_files || []
  const mergeProgress =
    task.merge_progress ?? selectionSummary?.merge_progress ?? null

  const out = {
    task_id: task.task_uuid,
    task_name: task.task_name || '',
    tool_uuid: task.tool_uuid || '',
    biz_type: task.biz_type || null,
    agent_id: task.tool_uuid || '',
    agent_name: task.tool_name || '',
    status: isTerminated ? 'terminated' : (statusMap[taskStatusNum] || 'pending'),
    task_status: task.task_status, // 保留原始状态码
    task_type: task.task_type,
    current_progress: isTerminated ? '已终止' : getProgressText(taskStatusNum),
    file_count: task.file_num || '0',
    file_total_count: fileTotalCount,
    file_success_count: fileSuccessCount,
    file_failed_count: fileFailedCount,
    file_completed_count: safeCompletedCount,
    file_processing_count: fileProcessingCount,
    file_pending_count: filePendingCount,
    file_progress_percent: fileProgressPercent,
    created_at: task.create_time || '',
    started_at: task.started_at || '',
    completed_at: task.completed_at || '',
    task_remark: task.task_notes || '',
    create_user_uuid: task.create_user_uuid || '',
    create_user_name: task.create_user_name || '',
    analysis_id: task.analysis_id || null,
    prepaid_phase: task.prepaid_phase || null,
    prepaid_context: task.prepaid_context || null,
    rule_done: Number(task.rule_done ?? 0) || 0,
    rule_total: Number(task.rule_total ?? 0) || 0,
    ba_status: task.ba_status || null,
    project_count: Number(task.project_count ?? 0) || 0,
    selection_summary: selectionSummary,
    task_step_progress: task.task_step_progress || [],
    is_terminated: isTerminated,
    is_merge_export_task: isMergeExportTask,
    merge_export_config: mergeExportConfig,
    merge_source_tasks: mergeSourceTasks,
    result_files: mergeResultFiles,
    merge_progress: mergeProgress
  }
  applyProgressContext(out)
  return out
}

// 转换后端文件数据为前端格式
const convertFileData = (file) => {
  // 解析参数设置（parameter_template 可能是字符串或对象）
  let settings = null
  try {
    if (file.parameter_settings) {
      const paramSettings = typeof file.parameter_settings === 'string'
        ? JSON.parse(file.parameter_settings)
        : file.parameter_settings
      settings = paramSettings
      if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
        const hasTemplate = settings.template && String(settings.template).trim()
        const hasPromptUuid = (file.PROMPT_UUID || file.prompt_uuid) && String(file.PROMPT_UUID || file.prompt_uuid).trim() !== 'prompt'
        settings = {
          ...settings,
          configured: settings.configured ?? true,
          mode: settings.mode || 'field',
          field_type: settings.field_type || (hasTemplate || hasPromptUuid ? 'template' : 'custom')
        }
      } else if (settings && Array.isArray(settings)) {
        settings = {
          mode: 'field',
          configured: true,
          field_type: 'custom',
          fieldDefinitions: settings.map(field => ({
            name: field.name || field.fieldName || '',
            description: field.description || field.fieldDescription || ''
          }))
        }
      }
    } else if (file.parameter_template !== undefined && file.parameter_template !== null) {
      // parameter_template 可能是字符串（JSON）或数组
      if (typeof file.parameter_template === 'string') {
        try {
          const parsed = JSON.parse(file.parameter_template)
          if (Array.isArray(parsed) && parsed.length > 0) {
            // JSON 解析结果为数组，说明是字段模式（无 parameter_settings 时无法区分 template/custom，默认 template）
            settings = {
              mode: 'field',
              configured: true,
              field_type: 'template',
              fieldDefinitions: parsed.map(field => ({
                name: field.name || field.fieldName || '',
                description: field.description || field.fieldDescription || ''
              }))
            }
          } else if (Array.isArray(parsed)) {
            settings = { mode: 'field', configured: true, field_type: 'template', fieldDefinitions: [] }
          } else if (parsed && typeof parsed === 'object') {
            settings = { ...parsed, configured: parsed.configured ?? true }
            if (!settings.mode && settings.prompt) settings.mode = 'prompt'
            else if (!settings.mode && settings.fieldDefinitions) settings.mode = 'field'
          } else {
            settings = { mode: 'prompt', prompt: file.parameter_template, configured: true }
          }
        } catch {
          // 后端可能用 Python repr 存储（单引号），尝试转为合法 JSON 再解析为字段模式
          const trimmed = String(file.parameter_template).trim()
          if (trimmed.startsWith('[') && (trimmed.includes("'name'") || trimmed.includes('"name"') || trimmed.includes("'description'"))) {
            try {
              // 安全替换：仅替换作为键名/值边界符的单引号，保留内容中的单引号
              const normalized = trimmed.replace(/(\w+)'\s*:/g, '$1":').replace(/'\s*:/g, '":').replace(/:\s*'([^']*?)'/g, ': "$1"')
              const parsed = JSON.parse(normalized)
              if (Array.isArray(parsed) && parsed.length > 0) {
                settings = {
                  mode: 'field',
                  configured: true,
                  field_type: 'template',
                  fieldDefinitions: parsed.map(field => ({
                    name: field.name || field.fieldName || '',
                    description: field.description || field.fieldDescription || ''
                  }))
                }
              } else if (Array.isArray(parsed)) {
                settings = { mode: 'field', configured: true, field_type: 'template', fieldDefinitions: [] }
              } else {
                settings = { mode: 'prompt', prompt: file.parameter_template, configured: true }
              }
            } catch (_) {
              settings = { mode: 'prompt', prompt: file.parameter_template, configured: true }
            }
          } else {
            // 纯文本，为 prompt 模式
            settings = {
              mode: 'prompt',
              prompt: file.parameter_template,
              configured: true
            }
          }
        }
      } else if (Array.isArray(file.parameter_template)) {
        // 如果是数组，说明是字段模式（无 parameter_settings 时默认 template）
        settings = {
          mode: 'field',
          configured: true,
          field_type: 'template',
          fieldDefinitions: file.parameter_template.map(field => ({
            name: field.name || field.fieldName || '',
            description: field.description || field.fieldDescription || ''
          }))
        }
      }
    }
  } catch (e) {
    console.warn('解析参数设置失败:', e)
  }

  // 后端返回的模板中文名，合并到 settings 便于展示
  if (file.template_name) {
    settings = settings ? { ...settings, template_name: file.template_name } : { template_name: file.template_name }
  }

  let sourceFolderPaths = []
  let sourceRefs = []
  try {
    let parsedSourceRefs = file.source_refs
    if (!parsedSourceRefs && file.parameter_settings) {
      let paramSettings = file.parameter_settings
      if (typeof paramSettings === 'string') {
        paramSettings = JSON.parse(paramSettings)
      }
      parsedSourceRefs = paramSettings?.source_refs
    }
    if (typeof parsedSourceRefs === 'string') {
      parsedSourceRefs = JSON.parse(parsedSourceRefs)
    }
    if (Array.isArray(parsedSourceRefs)) {
      sourceRefs = parsedSourceRefs
      sourceFolderPaths = parsedSourceRefs
        .filter(ref => ref && (ref.source_type === 'folder' || ref.folder_path || ref.source_name))
        .map(ref => ref.folder_path || ref.source_name || '')
        .filter(Boolean)
    }
  } catch (e) {
    console.warn('解析 source_refs 失败:', e)
  }

  return {
    file_id: file.file_uuid || file.result_uuid || '',
    file_name: file.file_name || '',
    file_type: (file.file_type || '').toLowerCase(),
    file_size: file.file_size || '0',
    status: statusMap[file.processing_status] || 'pending',
    processing_status: file.processing_status,
    error_message: file.error_message || file.ERROR_MESSAGE || '',
    file_url: file.file_url || file.FILE_URL || '',
    settings: settings,
    progress: getProgressText(file.processing_status),
    disposal_result: file.disposal_result || file.DISPOSAL_RESULT || '',
    result_uuid: file.result_uuid || file.RESULT_UUID || '', // 保存result_uuid
    file_step_progress: file.file_step_progress || [], // 文件级步骤（有则展示）
    source_folder_paths: sourceFolderPaths,
    source_refs: sourceRefs
  }
}

// 获取进度文本
const getProgressText = (status) => {
  const textMap = {
    0: '未开始',
    1: '进行中',
    2: '已完成',
    3: '失败'
  }
  return textMap[status] || '未知'
}

// 检查是否有进行中的任务
const hasProcessingTasks = () => {
  return taskList.value.some(task => task.status === 'processing' || task.task_status === 1)
}

// 获取进行中的任务ID列表
const getProcessingTaskIds = () => {
  return taskList.value
    .filter(task => task.status === 'processing' || task.task_status === 1)
    .map(task => task.task_id)
}

// 轮询增量同步字段（避免漏更 started_at / completed_at 等标量）
const TASK_LIST_POLL_SYNC_KEYS = [
  'status',
  'task_status',
  'biz_type',
  'current_progress',
  'file_total_count',
  'file_success_count',
  'file_failed_count',
  'file_completed_count',
  'file_processing_count',
  'file_pending_count',
  'file_progress_percent',
  'started_at',
  'completed_at',
  'task_step_progress',
  'prepaid_phase',
  'prepaid_context',
  'is_terminated',
  'task_remark'
]

// 更新任务状态（轮询回调）
const updateTaskStatuses = (updatedTasks) => {
  if (!updatedTasks || updatedTasks.length === 0) return

  updatedTasks.forEach(updatedTask => {
    const taskIndex = taskList.value.findIndex(t => t.task_id === updatedTask.task_uuid)
    if (taskIndex > -1) {
      const oldTask = taskList.value[taskIndex]
      const oldStatus = oldTask.status
      const newTaskData = convertTaskData(updatedTask)

      TASK_LIST_POLL_SYNC_KEYS.forEach((key) => {
        if (key === 'task_step_progress') {
          if (newTaskData.task_step_progress && newTaskData.task_step_progress.length > 0) {
            taskList.value[taskIndex].task_step_progress = newTaskData.task_step_progress
          }
          return
        }
        if (key === 'biz_type') {
          taskList.value[taskIndex].biz_type = newTaskData.biz_type || taskList.value[taskIndex].biz_type
          return
        }
        if (Object.prototype.hasOwnProperty.call(newTaskData, key)) {
          taskList.value[taskIndex][key] = newTaskData[key]
        }
      })
      if (oldTask.is_merge_export_task) {
        const mergedRow = convertTaskData(updatedTask)
        taskList.value[taskIndex].merge_progress = mergedRow.merge_progress
        taskList.value[taskIndex].merge_export_config = mergedRow.merge_export_config
        taskList.value[taskIndex].merge_source_tasks = mergedRow.merge_source_tasks
        taskList.value[taskIndex].result_files = mergedRow.result_files
        taskList.value[taskIndex].selection_summary = mergedRow.selection_summary
      }

      // 如果状态从进行中变为完成/失败，显示提示
      // 注意：若进度弹窗正在追踪该任务，由 pollTaskProgress 负责弹通知，此处跳过避免重复
      if (
        oldStatus === 'processing' &&
        (newTaskData.status === 'completed' || newTaskData.status === 'failed') &&
        currentTaskUuid.value !== newTaskData.task_id
      ) {
        const message = newTaskData.status === 'completed'
          ? `任务 "${newTaskData.task_name}" 已完成`
          : `任务 "${newTaskData.task_name}" 处理失败`
        ElMessage({
          message,
          type: newTaskData.status === 'completed' ? 'success' : 'error',
          duration: 3000
        })
      }

      applyProgressContext(taskList.value[taskIndex])
    }
  })
}

// 启动或停止轮询（根据任务状态）
const checkAndTogglePolling = () => {
  const processing = hasProcessingTasks()
  const processingIds = processing ? getProcessingTaskIds() : []
  if (processing) {
    if (!isTaskPolling.value) {
      startTaskPolling(processingIds)
    } else {
      updateTaskIds(processingIds)
    }
  } else {
    if (isTaskPolling.value) {
      stopTaskPolling()
    }
  }
}

// 加载任务列表
const loadTaskList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      size: pagination.size,
      include_results: false,
      include_selection_summary: false,
      include_task_steps: true,
      prefer_runtime: false,
      // 轻量聚合计数 + 任务级步骤：用于列表任务状态与「当前阶段」进度展示
      include_progress_counts: true
    }

    // 处理状态筛选（直接使用数字值）
    if (filterForm.status !== undefined && filterForm.status !== null && filterForm.status !== '') {
      params.processing_status = filterForm.status
    }

    // 工具名称筛选
    if (filterForm.agentId) {
      params.tool_name = filterForm.agentId
    }

    // 任务名称筛选
    if (filterForm.search) {
      params.task_name = filterForm.search
    }

    const res = await getTaskPageListAPI(params)

    if (res.code === 200 && res.data) {
      // 处理分页数据 - 根据图片中的数据结构，数据在 res.data.items 中
      let tasks = []
      if (res.data.items && Array.isArray(res.data.items)) {
        tasks = res.data.items
        // 过滤掉已删除的任务（del_flag === 1）
        tasks = tasks.filter(task => task.del_flag !== 1)
        pagination.total = res.data.total || tasks.length
      } else if (Array.isArray(res.data)) {
        tasks = res.data.filter(task => task.del_flag !== 1)
        pagination.total = tasks.length
      } else if (res.data.list && Array.isArray(res.data.list)) {
        tasks = res.data.list.filter(task => task.del_flag !== 1)
        pagination.total = res.data.total || res.data.total_count || tasks.length
      } else {
        tasks = []
        pagination.total = 0
      }

      // 转换数据格式
      let convertedTasks = tasks.map(convertTaskData)

      // 前端筛选：调用模式（如果后端不支持）
      if (filterForm.inputMode) {
        // 预留：需后端支持或拉取详情后再筛
      }

      taskList.value = convertedTasks

      // 检查是否需要启动轮询
      checkAndTogglePolling()
    } else {
      taskList.value = []
      pagination.total = 0
      ElMessage.error(res.message || '加载任务列表失败')
    }
  } catch (error) {
    console.error('加载任务列表失败:', error)
    ElMessage.error(error.message || '加载任务列表失败')
    taskList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
    clearMergeSelection()
  }
}

const paginatedTasks = computed(() => taskList.value)

// 文件类型标签类型
const getFileTypeTagType = (fileType) => {
  const typeMap = {
    pdf: 'danger',
    docx: 'primary',
    doc: 'primary',
    xlsx: 'success',
    xls: 'success',
    pptx: 'warning',
    ppt: 'warning',
    txt: 'info',
    md: 'info'
  }
  return typeMap[fileType] || 'info'
}

// 步骤相关函数（保留以备后用）
// const getStepIcon = (status) => {
//   if (status === 'processing') {
//     return Loading
//   } else if (status === 'completed') {
//     return Check
//   } else if (status === 'failed') {
//     return Close
//   }
//   return Clock
// }

// const getStepType = (status) => {
//   if (status === 'completed') {
//     return 'success'
//   } else if (status === 'failed') {
//     return 'danger'
//   } else if (status === 'processing') {
//     return 'primary'
//   }
//   return 'info'
// }

// const getStepColor = (status) => {
//   if (status === 'completed') {
//     return '#67c23a'
//   } else if (status === 'failed') {
//     return '#f56c6c'
//   } else if (status === 'processing') {
//     return '#409eff'
//   }
//   return '#909399'
// }

// const getStepTagType = (status) => {
//   if (status === 'completed') {
//     return 'success'
//   } else if (status === 'failed') {
//     return 'danger'
//   } else if (status === 'processing') {
//     return 'primary'
//   }
//   return 'info'
// }

// const getStepStatusText = (status) => {
//   const textMap = {
//     completed: '已完成',
//     processing: '进行中',
//     pending: '未开始',
//     failed: '失败'
//   }
//   return textMap[status] || status
// }

// 文件状态类型
const getFileStatusType = (status) => {
  const typeMap = {
    completed: 'success',
    processing: 'primary',
    pending: 'info',
    failed: 'danger'
  }
  return typeMap[status] || 'info'
}

// 文件状态文本
const getFileStatusText = (status) => {
  const textMap = {
    completed: '已完成',
    processing: '进行中',
    pending: '未开始',
    failed: '失败'
  }
  return textMap[status] || status
}


// 模拟进度更新（已移除，使用真实API）
// 如果需要实时更新进度，可以定期调用 loadTaskList

// 方法
const handleRefresh = () => {
  loadTaskList()
}

// 筛选条件改变
const handleFilterChange = () => {
  pagination.page = 1 // 重置到第一页
  loadTaskList()
}

// 查看详情 - 打开全屏弹窗
const taskResultDialog = ref({
  visible: false,
  taskId: null,
  taskType: null,
  bizType: null,
  analysisId: null,
  taskName: null,
  fileId: null,
  taskStatus: null
})

const openTaskResultDialog = (payload) => {
  taskResultDialog.value.visible = false
  taskResultDialog.value.taskType = null
  taskResultDialog.value.taskId = null
  taskResultDialog.value.bizType = null
  nextTick(() => {
    Object.assign(taskResultDialog.value, payload, { visible: true })
  })
}

/**
 * 会议纪要任务详情关闭：回到任务中心列表并刷新
 * @returns {void}
 */
const handleMeetingMinutesDetailClose = () => {
  taskResultDialog.value.visible = false
  loadTaskList()
}
const onMergeExportDetailActionDone = async () => {
  await loadTaskList()
  const tid = mergeExportDetailDialog.value.task?.task_id
  if (mergeExportDetailDialog.value.visible && tid) {
    try {
      const res = await getTaskSchedulesAPI(tid, {
        prefer_runtime: false,
        include_results: false,
        include_selection_summary: true,
        include_task_steps: false,
        include_step_tree: false
      })
      if (res?.code === 200 && res.data) {
        mergeExportDetailDialog.value.task = convertTaskData(res.data)
      }
    } catch (e) {
      console.warn('合并导出详情刷新失败', e)
    }
  }
}

// 查看详情 - 跳转到任务结果页面或会议纪要分析页面
// 主题归纳 / 合同完备性 / 非结构化信息提取等均走 /task-result（TaskResultViewer 已支持 joint_table）
const handleViewDetail = async (task) => {
  if (task.is_merge_export_task) {
    mergeExportDetailDialog.value = { visible: true, task: { ...task } }
    try {
      const res = await getTaskSchedulesAPI(task.task_id, {
        prefer_runtime: false,
        include_results: false,
        include_selection_summary: true,
        include_task_steps: false,
        include_step_tree: false
      })
      if (res?.code === 200 && res.data) {
        mergeExportDetailDialog.value.task = convertTaskData(res.data)
      }
    } catch (e) {
      console.warn('合并导出详情拉取失败，使用列表行数据', e)
    }
    return
  }

  // 会议纪要分析任务：跳转到会议纪要分析页面（只读模式）
  if (task.task_type === 7) {
    let analysisId = task.analysis_id

    // 如果列表中没有 analysis_id，尝试重新获取任务详情
    if (!analysisId) {
      try {
        const detailRes = await getTaskSchedulesAPI(task.task_id, {
          include_results: true,
          include_selection_summary: false,
          include_task_steps: false,
          prefer_runtime: false
        })
        if (detailRes?.code === 200 && detailRes?.data) {
          analysisId = detailRes.data.analysis_id
        }
      } catch (error) {
        console.error('获取会议纪要任务详情失败:', error)
      }
    }

    if (!analysisId) {
      ElMessage.warning('该会议纪要任务缺少分析ID，无法查看解析结果')
      return
    }

    taskResultDialog.value.analysisId = analysisId
    taskResultDialog.value.taskName = task.task_name || '会议纪要解析结果'
  }

  // 招投标分析任务：通过弹窗打开（biz_type=biddingAnalysis，task_type 同为 10）
  if (task.biz_type === 'biddingAnalysis') {
    openTaskResultDialog({
      taskName: task.task_name || '招投标分析结果',
      taskType: 10,
      bizType: 'biddingAnalysis',
      taskId: task.task_id,
      analysisId: task.analysis_id || task.task_id,
      taskStatus: task.task_status,
      fileId: null
    })
    return
  }

  // 待摊费用（task_type=10，与招投标共用 viewer 编号）
  if (task.biz_type === 'prepaidExpenses' || Number(task.task_type) === 10) {
    openTaskResultDialog({
      taskName: task.task_name || '待摊费用分析',
      taskType: 10,
      bizType: 'prepaidExpenses',
      taskId: task.task_id,
      analysisId: task.analysis_id || task.task_id,
      taskStatus: task.task_status,
      fileId: null
    })
    return
  }

  // 时间轴分析任务：通过弹窗打开（task_type=3）
  if (Number(task.task_type) === 3) {
    // 先关闭弹窗并重置状态，确保组件完整重建（避免 taskType/taskId 未变化时 v-if 不重新渲染）
    taskResultDialog.value.visible = false
    taskResultDialog.value.taskType = null
    taskResultDialog.value.taskId = null
    nextTick(() => {
      taskResultDialog.value.taskName = task.task_name || '时间轴分析结果'
      taskResultDialog.value.taskType = 3
      taskResultDialog.value.taskId = task.task_id
      taskResultDialog.value.taskStatus = task.task_status
      taskResultDialog.value.fileId = null
      taskResultDialog.value.visible = true
    })
    return
  }


  taskResultDialog.value.visible = true
  taskResultDialog.value.taskId = task.task_id
  taskResultDialog.value.taskType = resolveTaskDetailViewerType(task)
  taskResultDialog.value.bizType = resolveTaskDetailBizType(task)
  taskResultDialog.value.taskStatus = task.task_status
  taskResultDialog.value.taskName = task.task_name || ''
  taskResultDialog.value.fileId = null
  if (task.analysis_id) {
    taskResultDialog.value.analysisId = task.analysis_id
  }
}


import { useHomeStore } from '@/stores/home'

const homeStore = useHomeStore()
// 返回文件管理
const handleBackToFileManager = () => {
  // 设置为当前激活的页签
  homeStore.setActiveTab('/file-manager-code?menuId=2058')

  // 根据页签ID生成面包屑
  homeStore.generateBreadcrumbsFromMenu('2058')

  // 路由跳转
  router.push('/file-manager-code?menuId=2058')
}


const handleViewFileResult = (file) => {
  if (file.status !== 'completed') {
    ElMessage.warning('文件尚未处理完成，无法查看结果')
    return
  }
  // 跳转到任务结果页面
  router.push({
    path: '/task-result',
    query: {
      taskId: resultDialog.task.task_id,
      fileId: file.file_id
    }
  })
  resultDialog.visible = false
}

const handleDeleteTask = async (task) => {
  const isRunning = task.task_status === 0 || task.task_status === 1
  const title = isRunning ? '终止任务确认' : '删除任务确认'
  const message = isRunning
    ? '终止后任务将不再继续执行，并从任务中心列表中隐藏。是否确认终止该任务？'
    : '删除后任务将从任务中心列表中移除。是否确认删除该任务？'

  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: isRunning ? '确认终止' : '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteTaskAPI(task.task_id)
    if (res.code === 200) {
      ElMessage.success(res.message || (isRunning ? '终止任务成功' : '删除任务成功'))

      // 若当前正在追踪该任务进度，终止成功后立即停止轮询和进度 UI
      if (currentTaskUuid.value && String(currentTaskUuid.value) === String(task.task_id)) {
        finishTaskProgress()
      }

      if (isRunning) {
        // 终止后保留任务记录，只更新本地状态为“已终止”
        const idx = taskList.value.findIndex(t => t.task_id === task.task_id)
        if (idx > -1) {
          const currentNotes = String(taskList.value[idx].task_remark || '')
          taskList.value[idx].task_status = 3
          taskList.value[idx].status = 'terminated'
          taskList.value[idx].current_progress = '已终止'
          taskList.value[idx].is_terminated = true
          if (!currentNotes.includes('用户终止任务')) {
            taskList.value[idx].task_remark = `${currentNotes}（用户终止任务）`.trim()
          }
        } else {
          loadTaskList()
        }
      } else {
        // 删除已结束任务时，从当前列表中移除，避免整表刷新导致跳动
        const idx = taskList.value.findIndex(t => t.task_id === task.task_id)
        if (idx > -1) {
          taskList.value.splice(idx, 1)
          if (pagination.total > 0) {
            pagination.total -= 1
          }
        } else {
          // 回退方案：重新加载
          loadTaskList()
        }
      }

      // 删除/终止后同步更新批量轮询目标，避免继续轮询已终止任务
      const processingIds = getProcessingTaskIds()
      updateTaskIds(processingIds)
      if (processingIds.length === 0) {
        stopTaskPolling()
      }
    } else {
      ElMessage.error(res.message || (isRunning ? '终止任务失败' : '删除任务失败'))
    }
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      // 用户取消不提示错误
      console.error('删除/终止任务失败:', err)
      ElMessage.error(err?.message || (isRunning ? '终止任务失败' : '删除任务失败'))
    }
  }
}

const handleRetryFailedTask = async (task) => {
  if (Number(task.task_status) !== 3) {
    ElMessage.warning('仅失败任务支持重新执行')
    return
  }
  if (isTerminatingTask(task)) {
    ElMessage.warning('任务终止中，请稍后重试')
    return
  }
  const isPrepaid = task.biz_type === 'prepaidExpenses'
  try {
    if (!isPrepaid) {
      await ElMessageBox.confirm(
        '将对该任务中的失败文件发起批量重新执行，是否继续？',
        '重新执行确认',
        {
          confirmButtonText: '确认重试',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    }
    setTaskRetryLoading(task.task_id, true)

    const retryRes = await retryFailedResultsAPI(task.task_id)
    if (retryRes?.code === 200) {
      applyTaskRowOptimisticRetry(task.task_id, retryRes)
      checkAndTogglePolling()
      ElMessage.success(retryRes?.message || '已发起失败文件重试')
      setTaskRetryLoading(task.task_id, false)
      void refreshTaskRowAfterRetry(task.task_id).then(() => checkAndTogglePolling())
      void loadTaskList()
    } else if (retryRes?.message) {
      ElMessage.error(retryRes.message)
    }
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      console.error('失败任务重新执行失败:', err)
      if (!err?.response) {
        ElMessage.error(err?.message || '失败任务重新执行失败')
      }
    }
  } finally {
    setTaskRetryLoading(task.task_id, false)
  }
}

const handleSizeChange = () => {
  pagination.page = 1
  loadTaskList()
}

const handlePageChange = () => {
  loadTaskList()
}

// 状态类型映射
const getStatusType = (status) => {
  const typeMap = {
    pending: 'info',
    processing: 'primary',
    completed: 'success',
    failed: 'danger',
    terminated: 'warning'
  }
  return typeMap[status] || 'info'
}

// 状态文本映射
const getStatusText = (status) => {
  const textMap = {
    pending: '未开始',
    processing: '进行中',
    completed: '已完成',
    failed: '失败',
    terminated: '已终止'
  }
  return textMap[status] || status
}

// 格式化文件大小
const formatFileSize = (size) => {
  if (!size) return '0 B'
  const num = parseInt(size)
  if (isNaN(num)) return size
  if (num < 1024) return num + ' B'
  if (num < 1024 * 1024) return (num / 1024).toFixed(2) + ' KB'
  if (num < 1024 * 1024 * 1024) return (num / (1024 * 1024)).toFixed(2) + ' MB'
  return (num / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

// 格式化日期时间
const formatDateTime = (dateTime) => {
  if (!dateTime) return '-'
  return dateTime
}

import { eventBus } from '@/utils/eventBus.js'
// 监听任务详情弹窗关闭：待摊费用未终态时转后台 Watch
watch(() => taskResultDialog.value.visible, (visible) => {
  if (visible) {
    stopPrepaidBackgroundWatch()
    return
  }
  const dialog = taskResultDialog.value
  const taskUuid = String(dialog.taskId || currentTaskUuid.value || '').trim()
  const progressActive = taskProgressLoading.value || taskProgressFloatingVisible.value
  if (dialog.bizType === 'prepaidExpenses' && taskUuid && (prepaidNeedsBackgroundWatch || progressActive)) {
    if (progressActive) {
      clearTaskProgressTimers()
      taskProgressLoading.value = false
      taskProgressFloatingVisible.value = false
    }
    startPrepaidBackgroundWatch(taskUuid, { taskName: dialog.taskName })
    return
  }
  prepaidNeedsBackgroundWatch = false
  if (progressActive) {
    finishTaskProgress()
    taskProgressFloatingVisible.value = false
  }
})

// keep-alive 首次挂载时 onMounted + onActivated 都会触发，避免重复拉列表
let taskCenterActivatedOnce = false

// 生命周期
onMounted(() => {
  // 加载任务列表
  loadTaskList()
  // 监听子组件任务开始事件
  eventBus.on('task-center-progress-start', handleTaskProgressStart)
  eventBus.on('task-center-progress-stop', finishTaskProgress)
  nextTick(() => {
    if (route.query.highlight === 'merge') {
      document.querySelector('.merge-export-btn')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      ElMessage.info('请勾选多条任务后，再点击「合并导出」')
    }
  })
})

// 任务中心开启 keepAlive：再次切入页签时不会走 onMounted，需在激活时刷新列表
onActivated(() => {
  if (!taskCenterActivatedOnce) {
    taskCenterActivatedOnce = true
    return
  }
  loadTaskList()
})

// openTaskCenterWithRefresh 会带 refresh_ts；组件已激活时仅靠 onActivated 不会触发，需监听该参数
watch(
  () => route.query.refresh_ts,
  (ts, prev) => {
    if (ts && String(ts) !== String(prev || '')) {
      loadTaskList()
    }
  }
)

onUnmounted(() => {
  // 停止轮询（useBatchTaskPolling内部也会处理，这里双重保险）
  stopTaskPolling()
  finishTaskProgress()
  stopPrepaidBackgroundWatch()
  // 移除事件监听
  eventBus.off('task-center-progress-start', handleTaskProgressStart)
  eventBus.off('task-center-progress-stop', finishTaskProgress)
})
// 处理子组件的任务开始通知
const handleTaskProgressStart = ({ taskUuid, taskName, taskOther }) => {
  if (taskUuid) {
    if (taskResultDialog.value.bizType === 'prepaidExpenses') {
      prepaidNeedsBackgroundWatch = true
      prepaidBackgroundTaskMeta.value = {
        taskId: taskUuid,
        taskName: taskName || taskResultDialog.value.taskName || '待摊费用',
        bizType: 'prepaidExpenses'
      }
    }
    stopPrepaidBackgroundWatch()
    startTaskProgress(taskUuid, taskName || '任务', taskOther)
  }
}
</script>

<style scoped lang="scss">
// 会议纪要详情全屏展示
.meeting-minutes-detail-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  background: #fff;
  display: flex;
  flex-direction: column;

  .meeting-minutes-detail-header {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid #e4e7ed;
    background: #fff;
    flex-shrink: 0;
  }

  .meeting-minutes-detail-header > * + * {
    margin-left: 16px;
  }

  .meeting-minutes-detail-title {
    font-size: 16px;
    font-weight: 500;
    color: #303133;
  }

  .meeting-minutes-detail-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
}

:deep(.task-detail-fullscreen-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  margin: 0;
  max-height: 100vh;
}

:deep(.task-detail-fullscreen-dialog .el-dialog__body) {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.task-detail-viewer-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-center,
.task-center-card {
  height: 100%;
  min-height: 0;
}

.task-center-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-center {
  padding: 12px 16px;
  height: calc(100vh - 36px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--sd-surface-1, #f4f4f4);

  .task-center-card {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--sd-canvas, #ffffff);
    border: 1px solid var(--sd-hairline, #e0e0e0);
    border-radius: 4px;
    box-shadow: var(--sd-shadow-header, 0 1px 2px rgba(0, 0, 0, 0.04));

    .task-center-main {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0 12px 12px;
    }

    .task-center-toolbar {
      flex-wrap: wrap;
      padding: 12px 16px;
      box-shadow: none;
    }

    .task-center-filter-form {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      width: 100%;
      margin: 0;
    }

    .task-center-filter-form :deep(.el-form-item) {
      margin-bottom: 0;
      margin-right: 12px;
    }

    .task-center-filter-form__actions {
      margin-left: auto;
      margin-right: 0;
    }

    .task-center-filter-form__actions :deep(.el-button + .el-button) {
      margin-left: 8px;
    }

    .filter-form--medium {
      :deep(.el-input__wrapper) {
        min-height: 32px;
      }

      :deep(.el-select__wrapper) {
        min-height: 32px;
      }

      :deep(.el-button) {
        height: 32px;
        min-height: 32px;
        padding: 0 14px;
        font-size: 13px;
      }

      :deep(.el-form-item__label) {
        font-size: 13px;
        line-height: 32px;
      }

      :deep(.el-input__inner) {
        font-size: 13px;
      }
    }

    .merge-export-btn {
      margin-left: 0;
    }

    .merge-selected-tip {
      margin-left: 12px;
      font-size: 13px;
      color: #909399;
    }

    .merge-selected-tip strong {
      color: var(--sd-primary, #195fb4);
    }

    .table-wrapper {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .task-center-table-skeleton {
      height: 100%;
      display: flex;
      flex-direction: column;
      border: 1px solid #ebeef5;
      border-radius: 4px;
      background: #fff;
      overflow: hidden;
    }

    .task-center-table-skeleton__head {
      flex-shrink: 0;
      padding: 12px 16px;
      background: #fafafa;
      border-bottom: 1px solid #ebeef5;
    }

    .task-center-table-skeleton__row {
      flex-shrink: 0;
      padding: 14px 16px;
      border-bottom: 1px solid #f2f3f5;
    }

    .task-center-table-skeleton__row:last-child {
      border-bottom: none;
    }

    .sk-table-head,
    .sk-table-row {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .sk-table-head > * + *,
    .sk-table-row > * + * {
      margin-left: 12px;
    }

    .sk-head-cell--xs,
    .sk-row-cell--xs {
      width: 28px;
      flex-shrink: 0;
    }

    .sk-row-cell--xs {
      height: 16px;
    }

    .sk-head-cell--name,
    .sk-row-cell--name {
      width: 16%;
      min-width: 120px;
      flex-shrink: 0;
    }

    .sk-head-cell--tool,
    .sk-row-cell--tool {
      width: 10%;
      min-width: 88px;
      flex-shrink: 0;
    }

    .sk-head-cell--status,
    .sk-row-cell--status {
      width: 64px;
      height: 22px;
      flex-shrink: 0;
      border-radius: 4px;
    }

    .sk-head-cell--progress,
    .sk-row-cell--progress {
      flex: 1;
      min-width: 180px;
    }

    .sk-progress-line {
      width: 72%;
      height: 14px;
      margin-bottom: 8px;
    }

    .sk-progress-bar {
      width: 100%;
      height: 8px;
      border-radius: 4px;
    }

    .sk-head-cell--sm,
    .sk-row-cell--sm {
      width: 56px;
      flex-shrink: 0;
    }

    .sk-head-cell--time,
    .sk-row-cell--time {
      width: 128px;
      flex-shrink: 0;
    }

    .sk-head-cell--remark,
    .sk-row-cell--remark {
      width: 14%;
      min-width: 100px;
      flex-shrink: 0;
    }

    .sk-head-cell--ops,
    .sk-row-cell--ops {
      width: 148px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .sk-row-cell--ops > * + * {
      margin-left: 8px;
    }

    .sk-op-btn {
      width: 52px;
      height: 24px;
    }

    .task-center-table-skeleton :deep(.el-skeleton__item) {
      border-radius: 4px;
    }

    .task-center-table {
      height: 100%;
    }

    .agent-name-cell {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
    }

    .agent-name-cell__text {
      margin-left: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-center-cell-empty {
      color: #909399;
    }

    .operation-cell {
      display: flex;
      align-items: center;
      flex-wrap: nowrap;
      white-space: nowrap;
    }

    .operation-cell > * + * {
      margin-left: 8px;
    }

    .operation-cell :deep(.operation-cell-btn.el-button) {
      padding: 3px 5px;
      min-height: 24px;
      height: 24px;
      font-size: 12px;
    }

    .header-section {
      display: none;
    }

    .progress-cell {
      display: block;
      width: 100%;

      .task-progress-main {
        width: 100%;
        min-width: 0;
      }

      .task-progress-summary-line {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        width: 100%;
        font-size: 12px;
        line-height: 1.4;
        color: #606266;
        margin-bottom: 6px;
        overflow: hidden;
      }

      .task-progress-pills-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        margin-bottom: 6px;
      }

      .task-progress-pills-row > * {
        margin: 0 6px 4px 0;
      }

      .task-progress-summary-pref {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
      }

      .task-progress-summary-prefix-icon {
        margin-right: 4px;
        color: #909399;
      }

      .task-progress-summary-name {
        font-weight: 600;
        color: #303133;
        margin-left: 6px;
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .task-progress-summary-name--done {
        color: #67c23a;
      }

      .task-progress-summary-name--failed {
        color: #f56c6c;
      }

      .task-progress-summary-pill {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        height: 22px;
        padding: 0 8px;
        border-radius: 11px;
        border: 1px solid #dcdfe6;
        background: #f5f7fa;
        color: #606266;
        font-size: 12px;
      }

      .task-progress-summary-pill-icon {
        margin-right: 4px;
      }

      .task-progress-pill-content {
        display: inline-flex;
        align-items: center;
      }

      .task-progress-summary-pill--stage {
        border-color: var(--sd-primary-light, #e8f0f8);
        background: var(--sd-primary-light, #e8f0f8);
        color: var(--sd-primary, #195fb4);
      }

      .task-progress-summary-pill--stage-done {
        border-color: #e1f3d8;
        background: #f0f9eb;
        color: #67c23a;
      }

      .task-progress-summary-pill--stage-failed {
        border-color: #fde2e2;
        background: #fef0f0;
        color: #f56c6c;
      }

      .task-progress-summary-pill--files {
        border-color: #e4e7ed;
        background: #f4f4f5;
      }

      .task-progress-summary-pill--overall {
        border-color: var(--sd-hairline, #e0e0e0);
        background: var(--sd-surface-1, #f4f4f4);
        color: #303133;
        font-weight: 600;
      }

      .task-progress-count {
        color: #606266;
        font-size: 12px;
      }

      .task-progress-rate {
        color: #909399;
        font-size: 12px;
      }

      .task-progress-file-bar {
        margin-bottom: 6px;
      }

      .task-progress-stats {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        width: 100%;
        padding: 4px 6px;
        background: var(--sd-surface-1, #f4f4f4);
        border-radius: 4px;
      }

      .task-stat-item {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        min-width: 0;
        padding: 2px 0;
        font-size: 12px;
        line-height: 1;
        white-space: nowrap;
      }

      .task-stat-item + .task-stat-item {
        margin-left: 4px;
      }

      .task-stat-item .task-stat-icon-trigger {
        margin-right: 6px;
      }

      .task-stat-icon-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        cursor: default;
      }

      .task-stat-icon {
        font-size: 17px;
        vertical-align: middle;
      }

      .task-stat-value {
        font-weight: 600;
        font-size: 13px;
        min-width: 1.25em;
        color: #606266;
        letter-spacing: 0.02em;
      }

      .task-stat-item--success .task-stat-icon {
        color: #67c23a;
      }

      .task-stat-item--running .task-stat-icon {
        color: var(--sd-primary, #195fb4);
      }

      .task-stat-item--failed .task-stat-icon {
        color: #f56c6c;
      }

      .task-stat-item--pending .task-stat-icon {
        color: #909399;
      }
    }

    .file-icon,
    .agent-icon {
      font-size: 16px;
      color: #909399;
    }

    .pagination-wrapper {
      flex-shrink: 0;
      margin-top: 0;
      padding: 10px 0 0;
      border-top: 1px solid var(--sd-hairline, #e0e0e0);
      display: flex;
      justify-content: flex-end;
    }

    .pagination-wrapper :deep(.el-pagination.is-background .el-pager li.is-active) {
      background-color: var(--sd-primary, #195fb4);
    }

    .task-center-pager-skeleton {
      width: 320px;
      height: 32px;
    }

    .selection-folders-summary {
      margin-bottom: 12px;
      padding: 12px;
      border-radius: 6px;
      background: #ffffff;
      border: 1px solid #ebeef5;
    }

    .selection-folders-title {
      margin-bottom: 8px;
      color: #606266;
      font-size: 13px;
      font-weight: 500;
    }

    .selection-folders-tags :deep(.el-tag) + :deep(.el-tag) {
      margin-left: 6px;
    }

    .step-content {
      .step-name {
        font-weight: 500;
        margin-bottom: 4px;
        color: #303133;
      }
    }

    .input-params-cell {
      .input-params-content {
        display: flex;
        align-items: center;

        .agent-icon {
          font-size: 16px;
          color: #909399;
          margin-right: 8px;
        }

        .prompt-text {
          color: #606266;
          cursor: pointer;

          &:hover {
            color: var(--sd-primary, #195fb4);
          }
        }
      }
    }
  }
}

.result-dialog-content {
  .file-icon {
    font-size: 16px;
    color: #909399;
  }
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
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.progress-dialog-left {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.progress-elapsed {
  flex-shrink: 0;
  color: #606266;
  font-size: 12px;
}

.progress-dialog-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

/* 任务进度悬浮球 */
.task-progress-floating-ball {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2999;
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--sd-primary, #195fb4);
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(25, 95, 180, 0.35);
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.task-progress-floating-ball > * + * {
  margin-left: 6px;
}

.task-progress-floating-ball:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(25, 95, 180, 0.45);
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

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

<!-- 合并导出弹窗 teleport 到 body，使用非 scoped 样式确保生效 -->
<style lang="scss">
.merge-export-dialog.sd-dialog-form {
  .sd-dialog-body-scroll.merge-export-dialog__body {
    padding: 16px 24px 12px;
  }

  .merge-export-dialog__summary {
    margin-bottom: 16px;
    padding: 0;
    background: var(--sd-surface-1, #f4f4f4);
    border: 1px solid var(--sd-hairline, #e0e0e0);
    border-radius: 4px;
    overflow: hidden;
  }

  .merge-export-summary-grid {
    display: flex;
    flex-wrap: wrap;
  }

  .merge-export-summary-item {
    flex: 1 1 25%;
    min-width: 150px;
    padding: 12px 16px;
    box-sizing: border-box;
  }

  .merge-export-summary-item + .merge-export-summary-item {
    border-left: 1px solid var(--sd-hairline, #e0e0e0);
  }

  .merge-export-summary-item__label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--sd-ink-subtle, #8c8c8c);
  }

  .merge-export-summary-item__value {
    display: block;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--sd-ink, #161616);
    word-break: break-all;
  }

  .merge-export-summary-item__value--code {
    font-size: 12px;
    font-weight: 500;
    font-family: monospace;
    color: var(--sd-ink-muted, #525252);
  }

  .merge-export-summary-item__success {
    color: var(--sd-primary, #195fb4);
  }

  .merge-export-summary-item__fail {
    color: #c45656;
  }

  .merge-export-summary-item__sep {
    margin: 0 4px;
    color: var(--sd-ink-subtle, #8c8c8c);
    font-weight: 400;
  }

  .merge-export-panel {
    margin-bottom: 16px;
    padding: 16px 16px 4px;
    background: var(--sd-canvas, #ffffff);
    border: 1px solid var(--sd-hairline, #e0e0e0);
    border-radius: 4px;
    box-sizing: border-box;
  }

  .merge-export-panel .sd-section-title {
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--sd-hairline-soft, #ebebeb);
  }

  .merge-export-panel--mapping {
    margin-bottom: 0;
    padding-bottom: 12px;
  }

  .merge-export-form.sd-dialog-form-body .el-form-item {
    margin-bottom: 16px;
  }

  .merge-export-form-item--block .el-form-item__content {
    line-height: 1.4;
  }

  .merge-export-form__control-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  .merge-export-form__control-row > * + * {
    margin-left: 10px;
  }

  .merge-export-form__field-label,
  .merge-export-form__suffix {
    font-size: 13px;
    color: var(--sd-ink-muted, #525252);
    white-space: nowrap;
  }

  .merge-export-form__tip {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--sd-ink-subtle, #8c8c8c);
  }

  .merge-export-form__tip--block {
    margin-top: 8px;
  }

  .merge-export-form__tip code {
    padding: 0 4px;
    font-size: 12px;
    background: var(--sd-surface-1, #f4f4f4);
    border-radius: 2px;
  }

  .merge-export-form__number-input {
    width: 160px;
  }

  .merge-export-form__number-input--short {
    width: 112px;
  }

  .merge-export-form__number-input .el-input__wrapper {
    min-height: 32px;
  }

  .merge-export-db-tag {
    height: 28px;
    line-height: 26px;
    padding: 0 10px;
    font-size: 13px;
  }

  .merge-export-notice {
    margin: 4px 0 12px;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.55;
    color: var(--sd-ink-muted, #525252);
    background: var(--sd-surface-1, #f4f4f4);
    border: 1px solid var(--sd-hairline-soft, #ebebeb);
    border-radius: 4px;
  }

  .merge-export-notice strong {
    color: var(--sd-ink, #161616);
    font-weight: 600;
  }

  .merge-export-file-cards {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
  }

  .merge-export-file-card {
    display: flex;
    align-items: flex-start;
    flex: 1 1 calc(50% - 8px);
    min-width: 240px;
    margin-right: 16px;
    margin-bottom: 12px;
    padding: 12px 14px;
    cursor: pointer;
    user-select: none;
    background: var(--sd-canvas, #ffffff);
    border: 1px solid var(--sd-hairline, #e0e0e0);
    border-radius: 4px;
    box-sizing: border-box;
    transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  }

  .merge-export-file-card:nth-child(2n) {
    margin-right: 0;
  }

  .merge-export-file-card:hover {
    border-color: var(--sd-primary, #195fb4);
    background: var(--sd-primary-soft, #f0f7ff);
  }

  .merge-export-file-card.is-selected {
    border-color: var(--sd-primary, #195fb4);
    background: var(--sd-primary-light, #e8f0f8);
    box-shadow: 0 0 0 1px var(--sd-primary, #195fb4);
  }

  .merge-export-file-card__check {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    margin-right: 10px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--sd-hairline, #e0e0e0);
    border-radius: 2px;
    background: var(--sd-canvas, #ffffff);
    box-sizing: border-box;
    font-size: 12px;
    color: #ffffff;
  }

  .merge-export-file-card__check.is-checked {
    border-color: var(--sd-primary, #195fb4);
    background: var(--sd-primary, #195fb4);
  }

  .merge-export-file-card__body {
    flex: 1;
    min-width: 0;
  }

  .merge-export-file-card__title {
    margin-bottom: 4px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--sd-ink, #161616);
  }

  .merge-export-file-card__desc {
    font-size: 12px;
    line-height: 1.5;
    color: var(--sd-ink-subtle, #8c8c8c);
  }

  .merge-export-map-scope-group.el-radio-group {
    display: inline-flex;
    flex-wrap: wrap;
    padding: 4px;
    background: var(--sd-surface-1, #f4f4f4);
    border: 1px solid var(--sd-hairline-soft, #ebebeb);
    border-radius: 4px;
    box-sizing: border-box;
  }

  .merge-export-map-scope-group .el-radio-button__inner {
    height: 30px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 500;
    line-height: 28px;
    color: var(--sd-ink-muted, #525252);
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  .merge-export-map-scope-group .el-radio-button:not(.is-active) .el-radio-button__inner:hover {
    color: var(--sd-primary, #195fb4);
    background: var(--sd-canvas, #ffffff);
  }

  .merge-export-map-scope-group .el-radio-button.is-active .el-radio-button__inner,
  .merge-export-map-scope-group .el-radio-button__original-radio:checked + .el-radio-button__inner {
    color: #ffffff;
    font-weight: 600;
    background: var(--sd-primary, #195fb4);
    border-color: var(--sd-primary, #195fb4);
    box-shadow: none;
  }

  .merge-export-lang-group.el-radio-group {
    display: inline-flex;
    align-items: center;
  }

  .merge-export-lang-group .el-radio {
    margin-right: 20px;
  }

  .merge-export-lang-group .el-radio__label {
    font-size: 13px;
    color: var(--sd-ink-muted, #525252);
  }

  .merge-export-lang-group .el-radio__input.is-checked + .el-radio__label {
    color: var(--sd-primary, #195fb4);
    font-weight: 500;
  }

  .merge-export-dialog__table-toolbar {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--sd-hairline-soft, #ebebeb);
  }

  .merge-export-dialog__table-head {
    margin-bottom: 12px;
  }

  .merge-export-dialog__table-title {
    margin-bottom: 4px;
  }

  .merge-export-dialog__table-desc {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--sd-ink-subtle, #8c8c8c);
  }

  .merge-export-dialog__table-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .merge-export-dialog__table-actions > * {
    margin-bottom: 8px;
  }

  .merge-export-dialog__table-actions > * + * {
    margin-left: 8px;
  }

  .merge-export-dialog__table-actions .el-button {
    height: 32px;
    min-height: 32px;
    padding: 0 12px;
    font-size: 13px;
  }

  .merge-field-table-wrap {
    min-height: 100px;
  }

  .merge-export-field-empty {
    padding: 28px 12px;
    text-align: center;
    font-size: 13px;
    color: var(--sd-ink-subtle, #8c8c8c);
    background: var(--sd-surface-1, #f4f4f4);
    border: 1px dashed var(--sd-hairline, #e0e0e0);
    border-radius: 4px;
  }

  .merge-export-field-table.el-table .el-input.is-disabled .el-input__wrapper {
    background: var(--sd-surface-1, #f4f4f4);
  }

  .merge-export-field-table.el-table .el-input__wrapper {
    box-shadow: none;
    border: 1px solid var(--sd-hairline, #e0e0e0);
  }

  .merge-export-field-table.el-table .cell {
    padding: 6px 8px;
  }
}
</style>

