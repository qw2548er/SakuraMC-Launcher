<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { IAppUpdate } from '@/types'
import { openReleasePage, getPlatformAsset } from '@/utils/updater'
import { formatTime, formatBytes } from '@/utils/format'
import McButton from '@/components/mc-button.vue'

interface Props {
  show: boolean
  update: IAppUpdate | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'ignore'): void
}>()

const downloadStatus = ref<'idle' | 'downloading' | 'done' | 'error'>('idle')
const downloadProgress = ref(0)
const downloadSize = ref({ downloaded: 0, total: 0 })
const downloadError = ref('')

const currentAsset = computed(() => {
  if (!props.update?.assets?.length) return null
  return getPlatformAsset(props.update.assets)
})

const publishDate = computed(() => {
  if (!props.update?.published_at) return ''
  return formatTime(props.update.published_at)
})

const bodyText = computed(() => {
  if (!props.update?.body) return ''
  return props.update.body
})

function close() {
  if (downloadStatus.value === 'downloading') {
    uni.showModal({
      title: '提示',
      content: '正在下载更新，确定要关闭吗？',
      success: (res) => {
        if (res.confirm) emit('update:show', false)
      }
    })
    return
  }
  emit('update:show', false)
}

function ignore() {
  emit('ignore')
  close()
}

function goGithub() {
  openReleasePage()
}

async function startDownload() {
  if (!currentAsset.value) {
    goGithub()
    return
  }
  
  downloadStatus.value = 'downloading'
  downloadProgress.value = 0
  downloadError.value = ''
  downloadSize.value = { downloaded: 0, total: currentAsset.value.size }
  
  try {
    // #ifdef H5
    const a = document.createElement('a')
    a.href = currentAsset.value.browser_download_url
    a.download = currentAsset.value.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    downloadStatus.value = 'done'
    // #endif
    
    // #ifdef APP-PLUS
    const dtask = plus.downloader.createDownload(
      currentAsset.value.browser_download_url,
      { filename: `_downloads/${currentAsset.value.name}` },
      (d, status) => {
        if (status === 200) {
          downloadStatus.value = 'done'
          downloadProgress.value = 100
          uni.showModal({
            title: '下载完成',
            content: '是否立即安装更新？',
            success: (res) => {
              if (res.confirm) {
                plus.runtime.install(d.filename, {}, () => {
                  plus.runtime.restart()
                }, (e: any) => {
                  uni.showToast({ title: '安装失败: ' + e.message, icon: 'none' })
                })
              }
            }
          })
        } else {
          downloadStatus.value = 'error'
          downloadError.value = '下载失败，请稍后重试'
        }
      }
    )
    
    dtask.addEventListener('statechanged', (task: any) => {
      if (task.state === 3 && task.totalSize > 0) {
        downloadProgress.value = Math.floor(task.downloadedSize / task.totalSize * 100)
        downloadSize.value = {
          downloaded: task.downloadedSize,
          total: task.totalSize
        }
      }
    })
    
    dtask.start()
    // #endif
  } catch (e: any) {
    downloadStatus.value = 'error'
    downloadError.value = e.message || '下载失败'
  }
}

watch(() => props.show, (val) => {
  if (!val && downloadStatus.value === 'downloading') {
    // 关闭时不重置，保持下载状态
  }
  if (val) {
    downloadStatus.value = 'idle'
    downloadProgress.value = 0
    downloadError.value = ''
  }
})
</script>

<template>
  <view v-if="show && update" class="update-modal" @tap.self="close">
    <view class="update-modal__panel">
      <view class="update-modal__header">
        <text class="update-modal__title">检测到可更新的版本</text>
        <text class="update-modal__close" @tap="close">✕</text>
      </view>
      
      <view class="update-modal__info">
        <view class="update-modal__info-row">
          <view class="update-modal__info-item">
            <text class="update-modal__info-label">版本</text>
            <text class="update-modal__info-value">{{ update.name || 'v' + update.version }}</text>
          </view>
          <view class="update-modal__info-item">
            <text class="update-modal__info-label">类型</text>
            <text class="update-modal__info-value">{{ update.prerelease ? '测试版' : '正式版' }}</text>
          </view>
        </view>
        <view class="update-modal__info-row">
          <view class="update-modal__info-item">
            <text class="update-modal__info-label">日期</text>
            <text class="update-modal__info-value">{{ publishDate }}</text>
          </view>
          <view v-if="currentAsset" class="update-modal__info-item">
            <text class="update-modal__info-label">大小</text>
            <text class="update-modal__info-value">{{ formatBytes(currentAsset.size) }}</text>
          </view>
        </view>
      </view>

      <view class="update-modal__section">
        <text class="update-modal__section-title">更新内容</text>
        <scroll-view scroll-y class="update-modal__body">
          <text class="update-modal__body-text">{{ bodyText || '暂无更新说明' }}</text>
        </scroll-view>
      </view>
      
      <view v-if="downloadStatus === 'downloading'" class="update-modal__download">
        <view class="download-header">
          <text class="download-title">正在下载...</text>
          <text class="download-pct">{{ downloadProgress }}%</text>
        </view>
        <view class="download-bar">
          <view class="download-bar__fill" :style="{ width: downloadProgress + '%' }" />
        </view>
        <text class="download-size">
          {{ formatBytes(downloadSize.downloaded) }} / {{ formatBytes(downloadSize.total) }}
        </text>
      </view>
      
      <view v-if="downloadStatus === 'done'" class="update-modal__download update-modal__download--done">
        <text class="download-done-icon">✅</text>
        <text class="download-done-text">下载完成</text>
      </view>
      
      <view v-if="downloadStatus === 'error'" class="update-modal__download update-modal__download--error">
        <text class="download-error-text">{{ downloadError }}</text>
      </view>

      <view class="update-modal__actions">
        <view class="update-modal__action update-modal__action--ignore" @tap="ignore">
          <text>忽略此版本</text>
        </view>
        <view class="update-modal__action update-modal__action--github" @tap="goGithub">
          <text>GitHub下载</text>
        </view>
        <view 
          class="update-modal__action update-modal__action--update" 
          @tap="downloadStatus === 'idle' ? startDownload() : (downloadStatus === 'done' ? goGithub() : null)"
          :class="{ 'update-modal__action--disabled': downloadStatus === 'downloading' }"
        >
          <text>{{ downloadStatus === 'idle' ? '立即更新' : downloadStatus === 'downloading' ? '下载中...' : downloadStatus === 'done' ? '打开文件' : '重试' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.update-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  
  &__panel {
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 2rpx solid rgba(255, 183, 213, 0.5);
    border-radius: 20rpx;
    width: 100%;
    max-width: 620rpx;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20rpx 60rpx rgba(255, 150, 200, 0.3);
  }
  
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 28rpx 32rpx 20rpx;
  }
  
  &__title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
  }
  
  &__close {
    font-size: 28rpx;
    color: #999;
    padding: 8rpx 12rpx;
  }
  
  &__info {
    padding: 0 32rpx 20rpx;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }
  
  &__info-row {
    display: flex;
    gap: 32rpx;
  }
  
  &__info-item {
    display: flex;
    align-items: baseline;
    gap: 10rpx;
  }
  
  &__info-label {
    font-size: 24rpx;
    color: #999;
    flex-shrink: 0;
  }
  
  &__info-value {
    font-size: 26rpx;
    color: #555;
    font-weight: 500;
  }
  
  &__section {
    padding: 0 32rpx 20rpx;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  
  &__section-title {
    font-size: 26rpx;
    color: #ff8fab;
    font-weight: 600;
    margin-bottom: 12rpx;
  }
  
  &__body {
    flex: 1;
    background: rgba(255, 183, 213, 0.15);
    border-radius: 12rpx;
    padding: 20rpx;
    max-height: 320rpx;
  }
  
  &__body-text {
    font-size: 24rpx;
    color: #666;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  
  &__download {
    margin: 0 32rpx 20rpx;
    padding: 20rpx;
    background: rgba(255, 183, 213, 0.15);
    border-radius: 12rpx;
    
    &--done {
      text-align: center;
    }
    
    &--error {
      background: rgba(255, 100, 100, 0.15);
    }
  }
  
  &__actions {
    padding: 16rpx 24rpx 28rpx;
    display: flex;
    gap: 12rpx;
    align-items: center;
    justify-content: center;
  }
  
  &__action {
    padding: 16rpx 28rpx;
    border-radius: 12rpx;
    font-size: 26rpx;
    text-align: center;
    transition: all 0.2s;
    
    &--ignore {
      color: #ff8fab;
      background: transparent;
      font-size: 24rpx;
      
      text {
        color: #ff8fab;
      }
    }
    
    &--github {
      color: #666;
      background: rgba(0, 0, 0, 0.06);
      
      text {
        color: #666;
      }
    }
    
    &--update {
      color: #fff;
      background: linear-gradient(135deg, #ffb7d5, #ff8fab);
      font-weight: 500;
      
      text {
        color: #fff;
      }
    }
    
    &--disabled {
      opacity: 0.6;
    }
    
    &:active {
      opacity: 0.8;
      transform: scale(0.98);
    }
  }
}

.download-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.download-title {
  font-size: 26rpx;
  color: #ff8fab;
  font-weight: 500;
}

.download-pct {
  font-size: 26rpx;
  color: #ff8fab;
  font-weight: 600;
}

.download-bar {
  height: 10rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 5rpx;
  overflow: hidden;
  
  &__fill {
    height: 100%;
    background: linear-gradient(90deg, #ffb7d5, #ff8fab);
    border-radius: 5rpx;
    transition: width 0.3s;
  }
}

.download-size {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 10rpx;
  text-align: right;
}

.download-done-icon {
  font-size: 48rpx;
  display: block;
  margin-bottom: 8rpx;
}

.download-done-text {
  font-size: 28rpx;
  color: #52c41a;
  font-weight: 500;
}

.download-error-text {
  font-size: 24rpx;
  color: #ff4d4f;
  text-align: center;
}
</style>
