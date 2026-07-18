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
        <text class="update-modal__title">✨ 检测到新版本</text>
      </view>
      
      <view class="update-modal__info">
        <view class="update-modal__row">
          <text class="update-modal__label">版本</text>
          <text class="update-modal__value update-modal__version">v{{ update.version }}</text>
        </view>
        <view class="update-modal__row">
          <text class="update-modal__label">类型</text>
          <text class="update-modal__value">{{ update.prerelease ? '测试版' : '正式版' }}</text>
          <text class="update-modal__label" style="margin-left: 24rpx">日期</text>
          <text class="update-modal__value">{{ publishDate }}</text>
        </view>
      </view>

      <view class="update-modal__section">
        <text class="update-modal__section-title">📝 更新内容</text>
        <scroll-view scroll-y class="update-modal__body">
          <text class="update-modal__body-text">{{ bodyText || '暂无更新说明' }}</text>
        </scroll-view>
      </view>

      <view class="update-modal__actions">
        <view class="update-modal__action update-modal__action--ghost" @tap="ignore">
          <text>忽略此版本</text>
        </view>
        <McButton variant="ghost" @click="close">取消</McButton>
        <McButton glow @click="goUpdate">🎉 立即更新</McButton>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.update-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  
  &__panel {
    background: linear-gradient(135deg, #1a0f2e 0%, #2d1b4e 100%);
    border: 2rpx solid rgba(216, 150, 255, 0.3);
    border-radius: 28rpx;
    width: 100%;
    max-width: 640rpx;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 60rpx rgba(216, 150, 255, 0.3);
  }
  
  &__header {
    padding: 32rpx 32rpx 24rpx;
    text-align: center;
    border-bottom: 2rpx solid rgba(216, 150, 255, 0.1);
  }
  
  &__title {
    font-size: 36rpx;
    font-weight: 700;
    color: #ffffff;
    background: linear-gradient(135deg, #ffb7d5, #d896ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  &__info {
    padding: 24rpx 32rpx;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }
  
  &__row {
    display: flex;
    align-items: center;
    gap: 16rpx;
  }
  
  &__label {
    font-size: 24rpx;
    color: #b8a8d4;
    flex-shrink: 0;
  }
  
  &__value {
    font-size: 26rpx;
    color: #ffffff;
    font-weight: 600;
  }
  
  &__version {
    font-size: 32rpx;
    color: #ffb7d5;
  }
  
  &__section {
    padding: 0 32rpx 24rpx;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  
  &__section-title {
    font-size: 26rpx;
    color: #d896ff;
    font-weight: 600;
    margin-bottom: 12rpx;
  }
  
  &__body {
    flex: 1;
    background: rgba(15, 15, 26, 0.6);
    border-radius: 16rpx;
    padding: 20rpx;
    max-height: 360rpx;
  }
  
  &__body-text {
    font-size: 24rpx;
    color: #b8a8d4;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  
  &__actions {
    padding: 24rpx 32rpx 32rpx;
    display: flex;
    gap: 16rpx;
    align-items: center;
    border-top: 2rpx solid rgba(216, 150, 255, 0.1);
  }
  
  &__action {
    &--ghost {
      font-size: 24rpx;
      color: #6a5a8a;
      padding: 12rpx 16rpx;
    }
  }
}
</style>
