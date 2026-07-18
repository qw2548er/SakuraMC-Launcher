<script setup lang="ts">
import { computed } from 'vue'
import type { IAppUpdate } from '@/types'
import { openReleasePage } from '@/utils/updater'
import { formatTime } from '@/utils/format'
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

function close() {
  emit('update:show', false)
}
function ignore() {
  emit('ignore')
  close()
}
function goUpdate() {
  openReleasePage()
}

const publishDate = computed(() => {
  if (!props.update?.published_at) return ''
  return formatTime(props.update.published_at)
})

const bodyText = computed(() => {
  if (!props.update?.body) return ''
  return props.update.body
})
</script>

<template>
  <view v-if="show && update" class="update-modal" @tap.self="close">
    <view class="update-modal__panel">
      <view class="update-modal__header">
        <text class="update-modal__title">检测到可更新的版本</text>
      </view>
      
      <view class="update-modal__info">
        <view class="update-modal__row">
          <text class="update-modal__label">版本</text>
          <text class="update-modal__value">{{ update.name || 'v' + update.version }}</text>
          <text class="update-modal__label">类型</text>
          <text class="update-modal__value">{{ update.prerelease ? '测试版' : '正式版' }}</text>
        </view>
        <view class="update-modal__row">
          <text class="update-modal__label">日期</text>
          <text class="update-modal__value">{{ publishDate }}</text>
        </view>
      </view>

      <view class="update-modal__section">
        <text class="update-modal__section-title">描述</text>
        <scroll-view scroll-y class="update-modal__body">
          <text class="update-modal__body-text">{{ bodyText || '暂无更新说明' }}</text>
        </scroll-view>
      </view>

      <view class="update-modal__actions">
        <view class="update-modal__action update-modal__action--ignore" @tap="ignore">
          <text>忽略此版本</text>
        </view>
        <view class="update-modal__action update-modal__action--cancel" @tap="close">
          <text>取消</text>
        </view>
        <view class="update-modal__action update-modal__action--update" @tap="goUpdate">
          <text>更新</text>
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
    max-width: 600rpx;
    max-height: 75vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20rpx 60rpx rgba(255, 150, 200, 0.3);
  }
  
  &__header {
    padding: 28rpx 32rpx 20rpx;
    text-align: center;
    border-bottom: 2rpx solid rgba(255, 183, 213, 0.3);
  }
  
  &__title {
    font-size: 30rpx;
    font-weight: 500;
    color: #333;
  }
  
  &__info {
    padding: 20rpx 32rpx;
    display: flex;
    flex-direction: column;
    gap: 10rpx;
  }
  
  &__row {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }
  
  &__label {
    font-size: 24rpx;
    color: #999;
    flex-shrink: 0;
  }
  
  &__value {
    font-size: 24rpx;
    color: #555;
    font-weight: 500;
    flex-shrink: 0;
  }
  
  &__section {
    padding: 0 32rpx 20rpx;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  
  &__section-title {
    font-size: 24rpx;
    color: #ff8fab;
    font-weight: 500;
    margin-bottom: 10rpx;
  }
  
  &__body {
    flex: 1;
    background: rgba(255, 183, 213, 0.15);
    border-radius: 12rpx;
    padding: 16rpx;
    max-height: 300rpx;
  }
  
  &__body-text {
    font-size: 24rpx;
    color: #666;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  
  &__actions {
    padding: 16rpx 24rpx 28rpx;
    display: flex;
    gap: 12rpx;
    align-items: center;
    justify-content: center;
  }
  
  &__action {
    padding: 14rpx 28rpx;
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
    
    &--cancel {
      color: #888;
      background: rgba(255, 183, 213, 0.2);
      
      text {
        color: #888;
      }
    }
    
    &--update {
      color: #fff;
      background: linear-gradient(135deg, #ffb7d5, #ff8fab);
      
      text {
        color: #fff;
        font-weight: 500;
      }
    }
    
    &:active {
      opacity: 0.8;
      transform: scale(0.98);
    }
  }
}
</style>
