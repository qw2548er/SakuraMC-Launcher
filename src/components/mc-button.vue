<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  icon?: string
  glow?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  block: false,
  disabled: false,
  loading: false,
  icon: '',
  glow: false
})
const emit = defineEmits<{ (e: 'click', ev: Event): void }>()

function onClick(ev: Event) {
  if (props.disabled || props.loading) return
  emit('click', ev)
}
</script>

<template>
  <button
    class="mc-btn"
    :class="[`mc-btn--${variant}`, `mc-btn--${size}`, { 'is-block': block, 'is-disabled': disabled, 'is-loading': loading, 'is-glow': glow }]"
    @click="onClick"
  >
    <view v-if="loading" class="mc-btn__spinner" />
    <text v-else-if="icon" class="mc-btn__icon">{{ icon }}</text>
    <text class="mc-btn__text"><slot /></text>
  </button>
</template>

<style lang="scss" scoped>
.mc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: none;
  border-radius: 16rpx;
  font-weight: 600;
  transition: all 0.2s;
  position: relative;
  white-space: nowrap;
  font-family: inherit;
  cursor: pointer;
  user-select: none;
  &--sm { font-size: 24rpx; padding: 12rpx 24rpx; min-height: 56rpx; }
  &--md { font-size: 28rpx; padding: 18rpx 36rpx; min-height: 76rpx; }
  &--lg { font-size: 32rpx; padding: 24rpx 48rpx; min-height: 92rpx; }
  &--primary {
    background: linear-gradient(135deg, #ffb7d5 0%, #d896ff 100%);
    color: #1a0f2e;
    box-shadow: 0 4rpx 16rpx rgba(255, 183, 213, 0.3);
  }
  &--secondary {
    background: rgba(216, 150, 255, 0.15);
    color: #d896ff;
    border: 2rpx solid rgba(216, 150, 255, 0.3);
  }
  &--ghost {
    background: transparent;
    color: #b8a8d4;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
  }
  &--danger {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
    border: 2rpx solid rgba(248, 113, 113, 0.3);
  }
  &--success {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
    border: 2rpx solid rgba(74, 222, 128, 0.3);
  }
  &.is-block { width: 100%; }
  &.is-disabled { opacity: 0.5; pointer-events: none; }
  &.is-glow::after {
    content: '';
    position: absolute;
    inset: -4rpx;
    border-radius: inherit;
    background: linear-gradient(135deg, #ffb7d5, #d896ff);
    z-index: -1;
    filter: blur(20rpx);
    opacity: 0.6;
  }
  &.is-loading { opacity: 0.7; }
  &:active { transform: scale(0.97); }
}

.mc-btn__spinner {
  width: 28rpx;
  height: 28rpx;
  border: 4rpx solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.mc-btn__icon { font-size: 1.2em; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
