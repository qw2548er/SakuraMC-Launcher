<script setup lang="ts">
interface Props {
  variant?: 'badge' | 'overlay' | 'banner'
  feature?: string
  plan?: string
}
withDefaults(defineProps<Props>(), {
  variant: 'badge',
  feature: '',
  plan: '后续版本'
})
</script>

<template>
  <!-- 标签式: 放在按钮/标题旁边 -->
  <view v-if="variant === 'badge'" class="nd-badge">
    <text class="nd-badge__text">未开发</text>
  </view>

  <!-- 浮层式: 覆盖在某个区域上 -->
  <view v-else-if="variant === 'overlay'" class="nd-overlay">
    <view class="nd-overlay__inner">
      <text class="nd-overlay__icon">🚧</text>
      <text class="nd-overlay__title">{{ feature || '此功能' }}尚未开发</text>
      <text class="nd-overlay__plan">预计 {{ plan }} 实现</text>
      <text class="nd-overlay__desc">UI 框架已搭好, 等待后续版本实现真实逻辑</text>
    </view>
  </view>

  <!-- 横幅式: 整条提示 -->
  <view v-else class="nd-banner">
    <text class="nd-banner__icon">🚧</text>
    <view class="nd-banner__main">
      <text class="nd-banner__title">{{ feature || '此功能' }}尚未开发</text>
      <text class="nd-banner__sub">初代版本仅展示 UI, 计划 {{ plan }} 接入真实逻辑</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.nd-badge {
  display: inline-flex;
  align-items: center;
  padding: 2rpx 12rpx;
  background: rgba(251, 191, 36, 0.15);
  border: 1rpx solid rgba(251, 191, 36, 0.4);
  border-radius: 8rpx;
  &__text {
    font-size: 20rpx;
    color: #fbbf24;
    font-weight: 600;
  }
}

.nd-overlay {
  position: relative;
  width: 100%;
  min-height: 280rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(45, 27, 78, 0.3);
  border: 2rpx dashed rgba(251, 191, 36, 0.3);
  border-radius: 20rpx;
  padding: 32rpx 24rpx;
  &__inner {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
  }
  &__icon { font-size: 56rpx; display: block; }
  &__title {
    font-size: 28rpx;
    color: #fbbf24;
    font-weight: 700;
    display: block;
  }
  &__plan {
    font-size: 22rpx;
    color: #b8a8d4;
    display: block;
    margin-top: 4rpx;
  }
  &__desc {
    font-size: 20rpx;
    color: #6a5a8a;
    display: block;
    margin-top: 8rpx;
    line-height: 1.5;
  }
}

.nd-banner {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(216, 150, 255, 0.1));
  border: 2rpx solid rgba(251, 191, 36, 0.25);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin: 16rpx 0;
  &__icon { font-size: 40rpx; flex-shrink: 0; }
  &__main { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
  &__title {
    font-size: 26rpx;
    color: #fbbf24;
    font-weight: 700;
  }
  &__sub {
    font-size: 22rpx;
    color: #b8a8d4;
  }
}
</style>
