<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  glow?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
  border?: boolean
}
withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  glow: false,
  padding: 'md',
  border: true
})
</script>

<template>
  <view class="mc-card" :class="[`mc-card--pad-${padding}`, { 'is-glow': glow, 'no-border': !border }]">
    <view v-if="title || subtitle || $slots.header" class="mc-card__header">
      <view v-if="title || subtitle" class="mc-card__title-wrap">
        <text v-if="title" class="mc-card__title">{{ title }}</text>
        <text v-if="subtitle" class="mc-card__subtitle">{{ subtitle }}</text>
      </view>
      <slot name="header" />
    </view>
    <view class="mc-card__body">
      <slot />
    </view>
    <view v-if="$slots.footer" class="mc-card__footer">
      <slot name="footer" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.mc-card {
  background: linear-gradient(135deg, rgba(45, 27, 78, 0.7) 0%, rgba(26, 15, 46, 0.7) 100%);
  backdrop-filter: blur(20rpx);
  border-radius: 24rpx;
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  position: relative;
  overflow: hidden;
  &.is-glow::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4rpx;
    background: linear-gradient(90deg, #ffb7d5, #d896ff);
  }
  &.no-border { border: none; }
  &--pad-none { padding: 0; }
  &--pad-sm { padding: 16rpx; }
  &--pad-md { padding: 24rpx; }
  &--pad-lg { padding: 32rpx; }
}
.mc-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.mc-card__title-wrap { display: flex; flex-direction: column; gap: 4rpx; flex: 1; }
.mc-card__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}
.mc-card__subtitle {
  font-size: 24rpx;
  color: #b8a8d4;
}
.mc-card__footer {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid rgba(216, 150, 255, 0.1);
}
</style>
