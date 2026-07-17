<script setup lang="ts">
import { ref, watch } from 'vue'
interface Props {
  show: boolean
  title?: string
  width?: string
}
const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '80%'
})
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()
const visible = ref(props.show)
watch(() => props.show, v => visible.value = v)
function close() {
  visible.value = false
  setTimeout(() => emit('update:show', false), 200)
}
</script>

<template>
  <view v-if="show" class="modal" @tap.self="close">
    <view class="modal__panel" :style="{ width }" @tap.stop>
      <view v-if="title" class="modal__header">
        <text class="modal__title">{{ title }}</text>
        <text class="modal__close" @tap="close">✕</text>
      </view>
      <view class="modal__body">
        <slot />
      </view>
      <view v-if="$slots.footer" class="modal__footer">
        <slot name="footer" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  animation: fadeIn 0.2s ease;
  &__panel {
    background: linear-gradient(135deg, #1a0f2e 0%, #2d1b4e 100%);
    border-radius: 32rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.25s ease;
  }
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24rpx 32rpx;
    border-bottom: 2rpx solid rgba(216, 150, 255, 0.1);
  }
  &__title { font-size: 32rpx; font-weight: 700; color: #ffffff; }
  &__close { font-size: 32rpx; color: #b8a8d4; padding: 8rpx 16rpx; }
  &__body { padding: 32rpx; overflow-y: auto; flex: 1; }
  &__footer { padding: 24rpx 32rpx; border-top: 2rpx solid rgba(216, 150, 255, 0.1); }
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(40rpx); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>
