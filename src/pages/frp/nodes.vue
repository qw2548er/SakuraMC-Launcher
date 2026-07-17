<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFrpStore } from '@/stores/frp'
import McCard from '@/components/mc-card.vue'
import McBadge from '@/components/mc-badge.vue'

const frpStore = useFrpStore()
const loading = ref<Record<number, boolean>>({})
const pingResults = ref<Record<number, number>>({})

async function pingNode(id: number, host: string, port: number) {
  loading.value[id] = true
  try {
    const n = frpStore.nodes.find(x => x.id === id)
    if (n) {
      const ms = await frpStore.pingNode(n)
      pingResults.value[id] = ms
    }
  } finally {
    loading.value[id] = false
  }
}

const sortedNodes = computed(() => {
  return [...frpStore.nodes].sort((a, b) => {
    const pa = pingResults.value[a.id] ?? Infinity
    const pb = pingResults.value[b.id] ?? Infinity
    if (pa === Infinity && pb === Infinity) return a.name.localeCompare(b.name)
    if (pa === -1) return 1
    if (pb === -1) return -1
    return pa - pb
  })
})
</script>

<template>
  <view class="nodes">
    <view class="nodes__head">
      <text class="nodes__title">节点选择</text>
      <text class="nodes__subtitle">{{ frpStore.nodes.length }} 个可用节点</text>
    </view>

    <view class="nodes__list">
      <view v-for="n in sortedNodes" :key="n.id" class="node-row">
        <view class="node-row__icon">
          <text>{{ n.flag || '🌐' }}</text>
        </view>
        <view class="node-row__main">
          <text class="node-row__name">{{ n.name }}</text>
          <text class="node-row__sub">{{ n.hostname }}:{{ n.port }} · {{ n.bandwidth ? n.bandwidth + 'Mbps' : '' }}</text>
          <view class="node-row__meta">
            <McBadge :status="n.status" />
            <text v-if="pingResults[n.id] !== undefined" class="node-row__ping" :class="{ 'is-down': pingResults[n.id] === -1 }">
              {{ pingResults[n.id] === -1 ? '不可达' : pingResults[n.id] + 'ms' }}
            </text>
          </view>
        </view>
        <view class="node-row__action" @tap="pingNode(n.id, n.hostname, n.port)">
          <text v-if="loading[n.id]">⏳</text>
          <text v-else>📡</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.nodes {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__head { margin-bottom: 24rpx; }
  &__title { font-size: 44rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 24rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__list { display: flex; flex-direction: column; gap: 12rpx; }
}

.node-row {
  display: flex; align-items: center; gap: 16rpx;
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 20rpx;
  padding: 20rpx;
  &__icon {
    width: 72rpx; height: 72rpx;
    background: linear-gradient(135deg, #2d1b4e, #1a0f2e);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 32rpx;
  }
  &__main { flex: 1; min-width: 0; }
  &__name { font-size: 28rpx; color: #ffffff; font-weight: 700; }
  &__sub { font-size: 22rpx; color: #b8a8d4; display: block; margin-top: 2rpx; }
  &__meta { display: flex; align-items: center; gap: 12rpx; margin-top: 8rpx; }
  &__ping { font-size: 22rpx; color: #4ade80; font-weight: 600;
    &.is-down { color: #f87171; }
  }
  &__action { padding: 16rpx; font-size: 32rpx; }
}
</style>
