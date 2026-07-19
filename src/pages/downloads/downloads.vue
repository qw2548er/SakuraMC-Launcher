<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVersionStore } from '@/stores/version'
import { formatBytes, formatSpeed } from '@/utils/format'

const versionStore = useVersionStore()

const filter = ref<'all' | 'active' | 'completed' | 'failed' | 'paused'>('all')

const filteredTasks = computed(() => {
  const list = versionStore.downloads
  if (filter.value === 'all') return list
  if (filter.value === 'active') return list.filter(t => t.status === 'downloading' || t.status === 'pending')
  if (filter.value === 'completed') return list.filter(t => t.status === 'completed')
  if (filter.value === 'failed') return list.filter(t => t.status === 'error')
  if (filter.value === 'paused') return list.filter(t => t.status === 'paused')
  return list
})

const stats = computed(() => {
  const tasks = versionStore.downloads
  return {
    total: tasks.length,
    active: tasks.filter(t => t.status === 'downloading' || t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'error').length,
    paused: tasks.filter(t => t.status === 'paused').length,
  }
})

const totalSpeed = computed(() => {
  return versionStore.downloads
    .filter(t => t.status === 'downloading')
    .reduce((sum, t) => sum + (t.speed || 0), 0)
})

function getStatusLabel(task: any): string {
  if (task.verifying) return '校验中'
  const map: Record<string, string> = {
    pending: '等待中',
    downloading: '下载中',
    paused: '已暂停',
    completed: '已完成',
    error: '失败'
  }
  return map[task.status] || task.status
}

function getStatusColor(task: any): string {
  if (task.verifying) return '#8fbbff'
  const map: Record<string, string> = {
    pending: '#888',
    downloading: '#ffb7d5',
    paused: '#facc15',
    completed: '#52c41a',
    error: '#ff6b6b'
  }
  return map[task.status] || '#888'
}

function getProgress(task: any): number {
  if (!task.total) return 0
  return Math.floor(task.downloaded * 100 / task.total)
}

function pauseTask(task: any) {
  versionStore.pauseDownload(task.id)
  uni.showToast({ title: '已暂停', icon: 'none' })
}

async function resumeTask(task: any) {
  uni.showLoading({ title: '恢复下载...' })
  try {
    await versionStore.resumeDownload(task.id)
    uni.hideLoading()
    uni.showToast({ title: '已恢复下载', icon: 'success' })
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: '恢复失败: ' + (e?.message || ''), icon: 'none' })
  }
}

function cancelTask(task: any) {
  uni.showModal({
    title: '取消下载',
    content: `确定要取消 "${task.name}" 吗？已下载的进度将丢失。`,
    confirmColor: '#ff6b6b',
    success: (r) => {
      if (r.confirm) {
        versionStore.cancelTask(task.id)
        uni.showToast({ title: '已取消', icon: 'none' })
      }
    }
  })
}

function retryTask(task: any) {
  const versionId = task.name.replace('Minecraft ', '')
  versionStore.cancelTask(task.id)
  setTimeout(() => {
    versionStore.download(versionId)
    uni.showToast({ title: '已开始重试', icon: 'success' })
  }, 300)
}

function clearCompleted() {
  uni.showModal({
    title: '清理已完成',
    content: '确定要清除所有已完成的下载任务吗？',
    success: (r) => {
      if (r.confirm) {
        versionStore.clearCompletedDownloads()
        uni.showToast({ title: '已清理', icon: 'success' })
      }
    }
  })
}

function clearFailed() {
  versionStore.clearFailedDownloads()
  uni.showToast({ title: '已清除失败任务', icon: 'success' })
}

function clearAll() {
  uni.showModal({
    title: '清除全部',
    content: '确定要清除所有下载任务吗？（不会删除已下载的文件）',
    confirmColor: '#ff6b6b',
    success: (r) => {
      if (r.confirm) {
        versionStore.downloads.forEach(t => versionStore.cancelTask(t.id))
        uni.showToast({ title: '已清除全部', icon: 'success' })
      }
    }
  })
}

let timer: any = null
onMounted(() => {
  versionStore.load()
  // 每 1 秒刷新一次 (下载进度本身在 store 中实时更新, 这里仅触发表单重渲染)
  timer = setInterval(() => {
    // no-op, computed 会自动更新
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <view class="downloads">
    <view class="downloads__header">
      <text class="downloads__back" @tap="uni.navigateBack()">‹</text>
      <text class="downloads__title">下载管理</text>
      <view class="downloads__actions">
        <text class="downloads__action" @tap="clearCompleted">🧹</text>
        <text class="downloads__action" @tap="clearAll">🗑️</text>
      </view>
    </view>

    <view class="downloads__stats">
      <view class="stat-card">
        <text class="stat-card__num">{{ stats.active }}</text>
        <text class="stat-card__label">下载中</text>
      </view>
      <view class="stat-card">
        <text class="stat-card__num">{{ stats.completed }}</text>
        <text class="stat-card__label">已完成</text>
      </view>
      <view class="stat-card">
        <text class="stat-card__num">{{ stats.paused }}</text>
        <text class="stat-card__label">已暂停</text>
      </view>
      <view class="stat-card">
        <text class="stat-card__num">{{ stats.failed }}</text>
        <text class="stat-card__label">失败</text>
      </view>
    </view>

    <view v-if="totalSpeed > 0" class="speed-bar">
      <text class="speed-bar__text">总速度: {{ formatSpeed(totalSpeed) }}</text>
    </view>

    <view class="filter-bar">
      <view
        v-for="opt in [
          { id: 'all', label: '全部' },
          { id: 'active', label: '下载中' },
          { id: 'paused', label: '已暂停' },
          { id: 'completed', label: '已完成' },
          { id: 'failed', label: '失败' }
        ]"
        :key="opt.id"
        class="filter-chip"
        :class="{ 'filter-chip--active': filter === opt.id }"
        @tap="filter = opt.id as any"
      >
        <text>{{ opt.label }}</text>
      </view>
    </view>

    <scroll-view scroll-y class="downloads__list">
      <view v-if="filteredTasks.length === 0" class="empty">
        <text class="empty__icon">📥</text>
        <text class="empty__text">暂无下载任务</text>
        <text class="empty__hint">去「版本管理」下载游戏版本</text>
      </view>

      <view
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-card"
      >
        <view class="task-card__head">
          <view class="task-card__name-wrap">
            <text class="task-card__name">{{ task.name }}</text>
            <text
              class="task-card__status"
              :style="{ color: getStatusColor(task) }"
            >
              {{ getStatusLabel(task) }}
            </text>
            <text v-if="task.verified" class="task-card__verified" title="SHA1 已校验">✓</text>
          </view>
          <text class="task-card__progress-text">{{ getProgress(task) }}%</text>
        </view>

        <view class="task-card__bar">
          <view
            class="task-card__bar-fill"
            :class="{
              'task-card__bar-fill--error': task.status === 'error',
              'task-card__bar-fill--paused': task.status === 'paused',
              'task-card__bar-fill--done': task.status === 'completed'
            }"
            :style="{ width: getProgress(task) + '%' }"
          />
        </view>

        <view class="task-card__meta">
          <text>{{ formatBytes(task.downloaded) }} / {{ task.total ? formatBytes(task.total) : '未知' }}</text>
          <text v-if="task.speed && task.status === 'downloading'">{{ formatSpeed(task.speed) }}</text>
          <text v-if="task.error" class="task-card__error">{{ task.error }}</text>
        </view>

        <view class="task-card__actions">
          <view
            v-if="task.status === 'downloading' || task.status === 'pending'"
            class="task-btn"
            @tap="pauseTask(task)"
          >
            <text>⏸ 暂停</text>
          </view>
          <view
            v-if="task.status === 'paused'"
            class="task-btn task-btn--primary"
            @tap="resumeTask(task)"
          >
            <text>▶ 继续</text>
          </view>
          <view
            v-if="task.status === 'error'"
            class="task-btn task-btn--primary"
            @tap="retryTask(task)"
          >
            <text>🔄 重试</text>
          </view>
          <view
            v-if="task.status !== 'completed'"
            class="task-btn task-btn--danger"
            @tap="cancelTask(task)"
          >
            <text>✕ 取消</text>
          </view>
          <view
            v-if="task.status === 'completed' || task.status === 'error'"
            class="task-btn"
            @tap="versionStore.removeDownload(task.id)"
          >
            <text>🗑 移除</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.downloads {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a0f2e 0%, #0f0f1a 100%);

  &__header {
    display: flex;
    align-items: center;
    padding: 100rpx 32rpx 24rpx;
  }

  &__back {
    font-size: 48rpx;
    color: #ffb7d5;
    margin-right: 16rpx;
    padding: 0 8rpx;
  }

  &__title {
    flex: 1;
    font-size: 40rpx;
    font-weight: 700;
    color: #ffb7d5;
  }

  &__actions {
    display: flex;
    gap: 16rpx;
  }

  &__action {
    font-size: 32rpx;
    padding: 8rpx 16rpx;
  }

  &__stats {
    display: flex;
    gap: 12rpx;
    padding: 0 24rpx 16rpx;
  }

  &__list {
    flex: 1;
    padding: 0 24rpx 40rpx;
  }
}

.stat-card {
  flex: 1;
  text-align: center;
  padding: 16rpx 8rpx;
  background: rgba(255, 183, 213, 0.06);
  border-radius: 12rpx;
  border: 2rpx solid rgba(255, 183, 213, 0.1);

  &__num {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: #ffb7d5;
  }

  &__label {
    display: block;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 4rpx;
  }
}

.speed-bar {
  margin: 0 24rpx 12rpx;
  padding: 12rpx 20rpx;
  background: rgba(82, 196, 26, 0.1);
  border-radius: 10rpx;
  border: 2rpx solid rgba(82, 196, 26, 0.2);

  &__text {
    font-size: 24rpx;
    color: #52c41a;
    font-weight: 600;
  }
}

.filter-bar {
  display: flex;
  gap: 8rpx;
  padding: 0 24rpx 16rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.filter-chip {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 24rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);

  &--active {
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    color: #fff;
    font-weight: 600;
  }
}

.empty {
  text-align: center;
  padding: 160rpx 0;

  &__icon {
    font-size: 80rpx;
    display: block;
    margin-bottom: 16rpx;
  }

  &__text {
    display: block;
    font-size: 30rpx;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 8rpx;
  }

  &__hint {
    display: block;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.3);
  }
}

.task-card {
  background: rgba(255, 255, 255, 0.04);
  border: 2rpx solid rgba(255, 183, 213, 0.08);
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12rpx;
  }

  &__name-wrap {
    display: flex;
    align-items: center;
    gap: 12rpx;
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 28rpx;
    color: #fff;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__status {
    font-size: 22rpx;
    font-weight: 600;
    flex-shrink: 0;
  }

  &__verified {
    font-size: 20rpx;
    color: #52c41a;
    background: rgba(82, 196, 26, 0.15);
    border-radius: 50%;
    width: 28rpx;
    height: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-weight: 700;
  }

  &__progress-text {
    font-size: 28rpx;
    color: #ffb7d5;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__bar {
    height: 12rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 6rpx;
    overflow: hidden;
    margin-bottom: 12rpx;
  }

  &__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #ffb7d5, #ff8fab);
    border-radius: 6rpx;
    transition: width 0.3s ease;

    &--error {
      background: linear-gradient(90deg, #ff6b6b, #ff4444);
    }

    &--paused {
      background: linear-gradient(90deg, #facc15, #fbbf24);
    }

    &--done {
      background: linear-gradient(90deg, #52c41a, #4ade80);
    }
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 12rpx;
    gap: 12rpx;
  }

  &__error {
    color: #ff6b6b;
    flex: 1;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    gap: 8rpx;
  }
}

.task-btn {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10rpx;
  font-size: 24rpx;
  color: #fff;

  &--primary {
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    color: #fff;
    font-weight: 600;
  }

  &--danger {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
  }

  &:active {
    opacity: 0.7;
  }
}
</style>
