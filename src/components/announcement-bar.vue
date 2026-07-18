<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  text?: string
  speed?: number
}
const props = withDefaults(defineProps<Props>(), {
  text: '欢迎使用樱花 MC 启动器 🌸',
  speed: 60
})

const scrollText = ref(props.text)
const isHover = ref(false)

function openGithub() {
  const url = 'https://github.com/qw2548er/SakuraMC-Launcher'
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(url)
  // #endif
}
</script>

<template>
  <view class="announcement" @tap="openGithub">
    <view class="announcement__icon">📢</view>
    <scroll-view
      scroll-x
      class="announcement__scroll"
      :scroll-with-animation="true"
    >
      <view class="announcement__text">
        {{ scrollText }}
      </view>
    </scroll-view>
    <view class="announcement__more">›</view>
  </view>
</template>

<style lang="scss" scoped>
.announcement {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  background: linear-gradient(135deg, rgba(255, 183, 213, 0.1), rgba(216, 150, 255, 0.1));
  border: 2rpx solid rgba(216, 150, 255, 0.2);
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  
  &__icon {
    font-size: 28rpx;
    flex-shrink: 0;
  }
  
  &__scroll {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
  }
  
  &__text {
    display: inline-block;
    font-size: 24rpx;
    color: #b8a8d4;
    line-height: 1.5;
    padding-right: 20rpx;
  }
  
  &__more {
    font-size: 32rpx;
    color: #6a5a8a;
    flex-shrink: 0;
  }
}
</style>
