import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

/** action-bar + section-title + padding */
const FULLSCREEN_HEIGHT_OFFSET = 130

export function useResultTableFullscreen() {
  const isFullscreen = ref(false)
  const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)

  const updateViewportHeight = () => {
    viewportHeight.value = window.innerHeight
  }

  const tableHeight = computed(() => {
    if (!isFullscreen.value) return undefined
    return Math.max(viewportHeight.value - FULLSCREEN_HEIGHT_OFFSET, 320)
  })

  const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value
    if (isFullscreen.value) {
      updateViewportHeight()
      ElMessage.success('已进入全屏模式，按 ESC 或点击按钮退出')
    }
  }

  const handleKeydown = (e) => {
    if (e.key === 'Escape' && isFullscreen.value) {
      isFullscreen.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
    window.addEventListener('resize', updateViewportHeight)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', updateViewportHeight)
  })

  return { isFullscreen, tableHeight, toggleFullscreen }
}
