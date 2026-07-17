<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  uuid: string
  size?: number
  variant?: 'face' | 'body' | 'cape' | 'head' | 'avatar'
  radius?: string
  bordered?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  size: 80,
  variant: 'face',
  radius: '16rpx',
  bordered: false
})

const url = computed(() => {
  const u = props.uuid
  switch (props.variant) {
    case 'body': return `https://mc-heads.net/body/${u}`
    case 'cape': return `https://mc-heads.net/cape/${u}`
    case 'head': return `https://mc-heads.net/head/${u}`
    case 'avatar': return `https://mc-heads.net/avatar/${u}/${props.size * 2}.png`
    case 'face':
    default: return `https://mc-heads.net/avatar/${u}/${props.size * 2}.png`
  }
})

const fallback = computed(() => {
  const u = props.uuid || '0'
  let h = 0
  for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0
  const hue = h % 360
  const initials = (u.slice(0, 2)).toUpperCase()
  return { hue, initials }
})
</script>

<template>
  <view
    class="game-icon"
    :class="{ 'is-bordered': bordered }"
    :style="{ width: size + 'rpx', height: size + 'rpx', borderRadius: radius }"
  >
    <image
      v-if="uuid"
      :src="url"
      mode="aspectFit"
      :style="{ width: size + 'rpx', height: size + 'rpx', borderRadius: radius }"
      @error="(e: any) => { (e?.target || e)?.style && ((e.target.style.display = 'none')) }"
    />
    <view v-if="!uuid" class="game-icon__fallback" :style="{ background: `hsl(${fallback.hue}, 50%, 35%)`, borderRadius: radius, width: size + 'rpx', height: size + 'rpx' }">
      <text class="game-icon__initial">{{ fallback.initials }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.game-icon {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  &.is-bordered {
    border: 2rpx solid rgba(216, 150, 255, 0.3);
    box-shadow: 0 0 12rpx rgba(216, 150, 255, 0.2);
  }
}
.game-icon__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}
.game-icon__initial {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.4);
}
</style>
