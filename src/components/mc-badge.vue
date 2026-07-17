<script setup lang="ts">
interface Props {
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'unknown' | 'running' | 'stopped' | 'error' | 'maintenance'
  text?: string
  size?: 'sm' | 'md'
  dot?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  text: '',
  size: 'md',
  dot: true
})

const labelMap: Record<string, string> = {
  online: '在线',
  offline: '离线',
  starting: '启动中',
  stopping: '停止中',
  unknown: '未知',
  running: '运行中',
  stopped: '已停止',
  error: '错误',
  maintenance: '维护'
}
</script>

<template>
  <view class="badge" :class="[`badge--${status}`, `badge--${size}`]">
    <view v-if="dot" class="badge__dot" />
    <text class="badge__text">{{ text || labelMap[status] || status }}</text>
  </view>
</template>

<style lang="scss" scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 16rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.05);
  &--sm { padding: 4rpx 12rpx; font-size: 20rpx; }
  &__dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 8rpx currentColor;
  }
  &--online, &--running { color: #4ade80; background: rgba(74, 222, 128, 0.1); }
  &--offline, &--stopped { color: #6a5a8a; background: rgba(106, 90, 138, 0.15); }
  &--starting, &--stopping { color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
  &--error { color: #f87171; background: rgba(248, 113, 113, 0.1); }
  &--maintenance { color: #60a5fa; background: rgba(96, 165, 250, 0.1); }
  &--unknown { color: #b8a8d4; background: rgba(184, 168, 212, 0.1); }
}
</style>
