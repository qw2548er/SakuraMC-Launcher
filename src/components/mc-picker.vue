<script setup lang="ts">
import { computed } from 'vue'
interface Props {
  modelValue: any
  options: { label: string; value: any; desc?: string; icon?: string }[]
  block?: boolean
  multi?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  block: true,
  multi: false
})
const emit = defineEmits<{ (e: 'update:modelValue', v: any): void }>()

const val = computed(() => props.modelValue)

function pick(opt: any) {
  if (props.multi) {
    const arr = Array.isArray(val.value) ? [...val.value] : []
    const i = arr.indexOf(opt.value)
    if (i >= 0) arr.splice(i, 1)
    else arr.push(opt.value)
    emit('update:modelValue', arr)
  } else {
    emit('update:modelValue', opt.value)
  }
}

function isActive(v: any) {
  if (props.multi) return Array.isArray(val.value) && val.value.includes(v)
  return val.value === v
}
</script>

<template>
  <view class="picker" :class="{ 'is-block': block }">
    <view
      v-for="opt in options"
      :key="opt.value"
      class="picker__item"
      :class="{ 'is-active': isActive(opt.value) }"
      @tap="pick(opt.value)"
    >
      <text v-if="opt.icon" class="picker__icon">{{ opt.icon }}</text>
      <view class="picker__text-wrap">
        <text class="picker__label">{{ opt.label }}</text>
        <text v-if="opt.desc" class="picker__desc">{{ opt.desc }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.picker {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  &.is-block { width: 100%; }
  &__item {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 16rpx 24rpx;
    background: rgba(15, 15, 26, 0.6);
    border: 2rpx solid rgba(216, 150, 255, 0.15);
    border-radius: 16rpx;
    transition: all 0.2s;
    &.is-active {
      background: linear-gradient(135deg, rgba(255, 183, 213, 0.2), rgba(216, 150, 255, 0.2));
      border-color: #d896ff;
    }
  }
  &__icon { font-size: 28rpx; }
  &__label { font-size: 28rpx; color: #ffffff; font-weight: 600; }
  &__desc { font-size: 22rpx; color: #b8a8d4; }
}
</style>
