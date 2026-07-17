<script setup lang="ts">
import { ref, computed } from 'vue'
interface Props {
  modelValue: boolean
  label?: string
  desc?: string
  disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), { label: '', desc: '', disabled: false })
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <view class="switch-row" :class="{ 'is-disabled': disabled }" @tap="toggle">
    <view class="switch-row__text">
      <text class="switch-row__label">{{ label }}</text>
      <text v-if="desc" class="switch-row__desc">{{ desc }}</text>
    </view>
    <view class="switch-row__track" :class="{ 'is-on': modelValue }">
      <view class="switch-row__thumb" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  &.is-disabled { opacity: 0.5; }
  &__text { display: flex; flex-direction: column; gap: 4rpx; flex: 1; }
  &__label { font-size: 28rpx; color: #ffffff; }
  &__desc { font-size: 22rpx; color: #b8a8d4; }
  &__track {
    width: 80rpx;
    height: 44rpx;
    background: rgba(106, 90, 138, 0.4);
    border-radius: 9999rpx;
    position: relative;
    transition: all 0.2s;
    flex-shrink: 0;
    &.is-on { background: linear-gradient(135deg, #ffb7d5, #d896ff); }
  }
  &__thumb {
    position: absolute;
    top: 4rpx;
    left: 4rpx;
    width: 36rpx;
    height: 36rpx;
    background: #ffffff;
    border-radius: 50%;
    transition: all 0.2s;
    box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.3);
  }
  &__track.is-on &__thumb {
    left: 40rpx;
  }
}
</style>
