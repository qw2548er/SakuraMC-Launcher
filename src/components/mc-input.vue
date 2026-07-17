<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  modelValue: number | string
  type?: 'text' | 'number' | 'password'
  placeholder?: string
  label?: string
  prefix?: string
  suffix?: string
  disabled?: boolean
  maxlength?: number
  block?: boolean
  clearable?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  label: '',
  prefix: '',
  suffix: '',
  disabled: false,
  maxlength: 100,
  block: true,
  clearable: false
})
const emit = defineEmits<{ (e: 'update:modelValue', v: string | number): void }>()

const focused = ref(false)
const val = ref(props.modelValue)

function onInput(e: any) {
  const v = e?.detail?.value ?? e
  val.value = v
  emit('update:modelValue', v)
}
function onClear() {
  val.value = ''
  emit('update:modelValue', '')
}
</script>

<template>
  <view class="input" :class="{ 'is-block': block, 'is-focused': focused, 'is-disabled': disabled }">
    <text v-if="label" class="input__label">{{ label }}</text>
    <view class="input__inner">
      <text v-if="prefix" class="input__prefix">{{ prefix }}</text>
      <input
        class="input__field"
        :type="type"
        :value="String(val)"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        @input="onInput"
        @focus="focused = true"
        @blur="focused = false"
      />
      <text v-if="clearable && val && !disabled" class="input__clear" @tap="onClear">✕</text>
      <text v-if="suffix" class="input__suffix">{{ suffix }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.input {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  &.is-block { width: 100%; }
  &.is-disabled { opacity: 0.5; }
  &__label {
    font-size: 26rpx;
    font-weight: 600;
    color: #b8a8d4;
    padding-left: 4rpx;
  }
  &__inner {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 18rpx 24rpx;
    background: rgba(15, 15, 26, 0.6);
    border: 2rpx solid rgba(216, 150, 255, 0.15);
    border-radius: 16rpx;
    transition: all 0.2s;
  }
  &.is-focused &__inner {
    border-color: #d896ff;
    background: rgba(45, 27, 78, 0.4);
  }
  &__prefix, &__suffix {
    font-size: 28rpx;
    color: #b8a8d4;
    flex-shrink: 0;
  }
  &__clear {
    color: #6a5a8a;
    font-size: 24rpx;
    padding: 4rpx 8rpx;
  }
  &__field {
    flex: 1;
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 28rpx;
    outline: none;
    font-family: inherit;
    min-width: 0;
  }
}
</style>
