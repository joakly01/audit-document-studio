<template>
  <div class="tag-mgmt">
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="query.search" placeholder="搜索标签名/定义" clearable style="max-width: 220px" />
        <el-input v-model="query.tag_category" placeholder="标签分类" clearable style="max-width: 140px" />
        <el-select v-model="query.status" clearable placeholder="状态" style="width: 100px">
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" @click="loadList">查询</el-button>
        <el-button type="success" @click="openDialog()">新增标签</el-button>
      </div>
      <el-table :data="list" border size="small" style="width: 100%" v-loading="loading">
        <el-table-column prop="tag_name" label="标签名" min-width="120" />
        <el-table-column prop="tag_definition" label="标签定义" min-width="200" show-overflow-tooltip />
        <el-table-column prop="tag_category" label="标签分类" min-width="120" />
        <el-table-column prop="sort_order" label="排序" width="70" align="center" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'info'" size="small">
              {{ scope.row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="openDialog(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="total"
          v-model:page-size="query.size"
          v-model:current-page="query.page"
          :page-sizes="[10, 20, 50]"
          @current-change="loadList"
          @size-change="loadList"
        />
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialog.visible"
      :title="dialog.form.tag_def_id ? '编辑标签' : '新增标签'"
      width="520px"
      destroy-on-close
      @close="resetForm"
    >
      <el-form :model="dialog.form" label-width="100px">
        <el-form-item label="标签名" required>
          <el-input v-model="dialog.form.tag_name" placeholder="请输入标签名" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="标签定义">
          <el-input
            v-model="dialog.form.tag_definition"
            type="textarea"
            :rows="3"
            placeholder="请输入标签定义/描述"
            maxlength="4000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="标签分类">
          <el-input v-model="dialog.form.tag_category" placeholder="请输入标签分类" maxlength="100" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="dialog.form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="dialog.form.status" :active-value="1" :inactive-value="0" />
          <span class="ml-2">{{ dialog.form.status === 1 ? '启用' : '禁用' }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getTagDefinitionsAPI,
  createTagDefinitionAPI,
  updateTagDefinitionAPI,
  deleteTagDefinitionAPI
} from '@/api/fileManager.js'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({
  search: '',
  tag_category: '',
  status: null,
  page: 1,
  size: 20
})

const dialog = reactive({
  visible: false,
  submitting: false,
  form: {
    tag_def_id: '',
    tag_name: '',
    tag_definition: '',
    tag_category: '',
    sort_order: 0,
    status: 1
  }
})

const loadList = async () => {
  loading.value = true
  try {
    const params = {
      page: query.page,
      size: query.size
    }
    if (query.search) params.search = query.search
    if (query.tag_category) params.tag_category = query.tag_category
    if (query.status !== null && query.status !== '') params.status = query.status

    const res = await getTagDefinitionsAPI(params)
    if (res.code === 200 && res.data) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
    } else {
      list.value = []
      total.value = 0
    }
  } catch (e) {
    console.error('加载标签列表失败:', e)
    ElMessage.error(e.response?.data?.msg || '加载失败')
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const openDialog = (row) => {
  if (row) {
    dialog.form = {
      tag_def_id: row.tag_def_id,
      tag_name: row.tag_name,
      tag_definition: row.tag_definition || '',
      tag_category: row.tag_category || '',
      sort_order: row.sort_order ?? 0,
      status: row.status ?? 1
    }
  } else {
    dialog.form = {
      tag_def_id: '',
      tag_name: '',
      tag_definition: '',
      tag_category: '',
      sort_order: 0,
      status: 1
    }
  }
  dialog.visible = true
}

const resetForm = () => {
  dialog.form = {
    tag_def_id: '',
    tag_name: '',
    tag_definition: '',
    tag_category: '',
    sort_order: 0,
    status: 1
  }
}

const submitForm = async () => {
  const f = dialog.form
  if (!(f.tag_name || '').trim()) {
    ElMessage.warning('请输入标签名')
    return
  }
  dialog.submitting = true
  try {
    if (f.tag_def_id) {
      const res = await updateTagDefinitionAPI(f.tag_def_id, {
        tag_name: f.tag_name.trim(),
        tag_definition: f.tag_definition?.trim() || null,
        tag_category: f.tag_category?.trim() || null,
        sort_order: f.sort_order,
        status: f.status
      })
      if (res.code === 200) {
        ElMessage.success('更新成功')
        dialog.visible = false
        loadList()
      } else {
        ElMessage.error(res.msg || '更新失败')
      }
    } else {
      const res = await createTagDefinitionAPI({
        tag_name: f.tag_name.trim(),
        tag_definition: f.tag_definition?.trim() || null,
        tag_category: f.tag_category?.trim() || null,
        sort_order: f.sort_order,
        status: f.status
      })
      if (res.code === 200) {
        ElMessage.success('创建成功')
        dialog.visible = false
        loadList()
      } else {
        ElMessage.error(res.msg || '创建失败')
      }
    }
  } catch (e) {
    console.error('保存失败:', e)
    ElMessage.error(e.response?.data?.msg || '保存失败')
  } finally {
    dialog.submitting = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除标签「${row.tag_name}」？`, '提示', {
      type: 'warning'
    })
    const res = await deleteTagDefinitionAPI(row.tag_def_id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      loadList()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败:', e)
      ElMessage.error(e.response?.data?.msg || '删除失败')
    }
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.tag-mgmt {
  padding: 16px;
}
.toolbar {
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.ml-2 {
  margin-left: 8px;
}
</style>
