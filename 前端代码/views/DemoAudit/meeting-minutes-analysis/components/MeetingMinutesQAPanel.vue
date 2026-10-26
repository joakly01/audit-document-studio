<template>
  <div class="qa-panel">
    <!-- 对话区域 -->
    <div class="qa-panel__body">
      <!-- 开场白（无消息时显示） -->
      <div v-if="showWelcome" class="welcome-section">
        <div class="welcome-message">
          <div class="welcome-icon">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <div class="welcome-content">
            <div class="welcome-text">
              您好！我是您的会议分析助手。您可以针对已上传的会议纪要向我提问，例如：
            </div>
            <ul class="welcome-examples">
              <li>总结最近三次会议关于"预算"的讨论重点</li>
              <li>分析示例人员18在会议中的主要观点和建议</li>
              <li>列出所有待办事项及负责人</li>
            </ul>
          </div>
        </div>
      </div>

      <ChatBox
        ref="chatBoxRef"
        :chatKey="chatKey"
        agentType="chatflow"
        :customFetch="qaFetch"
        :chatInputConfig="{ placeholder: '输入您的问题，按 Enter 发送...' }"
        :exampleMessageList="exampleMessageList"
        :isFloatWindow="true"
        @receiveOngoing="handleReceiveOngoing"
        @receiveEnd="handleReceiveEnd"
      />

      <!-- sources 溯源卡片 -->
      <div v-if="sourcesData.length > 0" class="sources-section">
        <div class="sources-title">相关议题溯源（{{ sourcesData.length }} 条）</div>
        <div
          v-for="item in sourcesData"
          :key="item.topic_id"
          class="source-card"
        >
          <div class="source-card__topic-name">{{ item.topic_name }}</div>
          <div class="source-card__meta">
            <span>{{ item.meeting_name }}</span>
            <span v-if="item.meeting_date"> · {{ item.meeting_date }}</span>
            <span v-if="item.cluster_name"> · {{ item.cluster_name }}</span>
            <span v-if="item.rerank_score != null" class="source-card__score">
              相关度：{{ (item.rerank_score * 100).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { ChatDotRound } from '@element-plus/icons-vue'
import ChatBox from '@/components/DifyChat/chat/ChatBox.vue'
import { ElMessage } from 'element-plus'
const props = defineProps({
  analysisId: {
    type: String,
    default: ''
  },
  clusterVersionId: {
    type: String,
    default: ''
  }
})

// ==================== 状态 ====================
const chatBoxRef = ref(null)
const chatKey = ref(1)
// 多轮对话 ID（首次为 ''，由 Dify SSE 返回后写回）
const conversationId = ref('')

// 溯源数据（receiveEnd 后从 messageList 最后一条的 metadata.sources 取）
const sourcesData = ref([])

// 是否显示欢迎语（无消息时显示）
const showWelcome = computed(() => {
  if (!chatBoxRef.value) return true
  const messageList = chatBoxRef.value.getMessageList()
  return !messageList || messageList.length === 0
})

// ==================== 事件处理 ====================
// I-01：自定义 fetch 函数，指向后端深度问答接口
const qaFetch = (data) => {
  return fetch(`/api/v3/meeting-minutes/analyses/${props.analysisId}/qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Agent-Token': sessionStorage.getItem('agent-token')
    },
    body: JSON.stringify({
      question: data.query,
      cluster_version_id: props.clusterVersionId,
      conversation_id: conversationId.value  // 首次为 ''，后续传回 Dify 返回值
    })
  })
}

// I-02：receiveOngoing 中仅首条消息时写回 conversation_id
const handleReceiveOngoing = (message, isFirstMessage, moreInfo) => {
  if (isFirstMessage && moreInfo?.conversation_id) {
    conversationId.value = moreInfo.conversation_id
  }
}

// I-03：receiveEnd 后从 ChatBox messageList 最后一条的 metadata.sources 读取溯源数据
const handleReceiveEnd = (isError) => {
  if (isError) {
    return
  }
  // 通过 ChatBox ref 读取 messageList 最后一条消息的 metadata.sources
  if (chatBoxRef.value) {
    const messageList = chatBoxRef.value.getMessageList()
    if (messageList && messageList.length > 0) {
      const lastMessage = messageList[messageList.length - 1]
      if (lastMessage?.metadata?.sources && Array.isArray(lastMessage.metadata.sources)) {
        sourcesData.value = lastMessage.metadata.sources
      } else {
        sourcesData.value = []
      }
    }
  }
}

// I-02：切换分析记录时重置 conversationId 和 sourcesData
watch(
  () => props.analysisId,
  () => {
    conversationId.value = ''
    sourcesData.value = []
    // 重置 ChatBox 消息列表
    if (chatBoxRef.value) {
      chatBoxRef.value.clearMessageList()
    }
  }
)

import { getQAConversationAPI, updateQAConversationAPI } from '@/api/meetingMinutesAnalysis'

const exampleMessageList = ref([])

onMounted(() => {
  getConversation()
})

// 获取会话记录
const getConversation = () => {
  getQAConversationAPI(props.analysisId).then(res => {
    exampleMessageList.value = res.data.conversation
    chatKey.value++
  })
}

// 保存会话记录
const saveConversation = () => {
  const messageList = chatBoxRef.value.getMessageList()
  updateQAConversationAPI(props.analysisId, messageList).then(res => {
    if (res.code === 200) {
      ElMessage.success('保存成功')
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  })
}

const clearConversation = () => {
  chatBoxRef.value.clearMessageList()
}

defineExpose({
  saveConversation,
  clearConversation
})
</script>

<style scoped lang="scss">
.qa-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;

  // 覆盖 ChatBox 默认的 max-width，让输入框占满整个宽度
  :deep(.main-container) {
    max-width: none;
  }
}

.qa-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.qa-panel__title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.qa-panel__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 16px;
}

/* 欢迎语区域 */
.welcome-section {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
}

.welcome-message {
  display: flex;
  gap: 12px;
  max-width: 600px;
  width: 100%;
}

.welcome-icon {
  width: 36px;
  height: 36px;
  background: #ecf5ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .el-icon {
    font-size: 18px;
    color: #409eff;
  }
}

.welcome-content {
  flex: 1;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
}

.welcome-text {
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
  margin-bottom: 12px;
}

.welcome-examples {
  margin: 0;
  padding-left: 20px;

  li {
    font-size: 13px;
    color: #606266;
    line-height: 1.8;
    margin-bottom: 4px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

/* 溯源卡片区域 */
.sources-section {
  flex-shrink: 0;
  margin-top: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.sources-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.source-card {
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-bottom: 8px;
  transition: all 0.2s ease;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
  }
}

.source-card__topic-name {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
  margin-bottom: 6px;
  line-height: 1.4;
}

.source-card__meta {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

.source-card__score {
  margin-left: 8px;
  color: #67c23a;
  font-weight: 500;
}
</style>
