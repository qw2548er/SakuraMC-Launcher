<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useServerStore } from '@/stores/server'
import { useFrpStore } from '@/stores/frp'
import McCard from '@/components/mc-card.vue'
import McButton from '@/components/mc-button.vue'
import McBadge from '@/components/mc-badge.vue'
import { copyText, relativeTime } from '@/utils/format'

const serverStore = useServerStore()
const frpStore = useFrpStore()
const serverId = ref('')
const logs = ref<string[]>([])
const pingTimer = ref<ReturnType<typeof setInterval> | null>(null)

onLoad((q: any) => {
  serverId.value = q?.id || ''
  if (serverId.value) {
    serverStore.setActive(serverId.value)
    startMonitoring()
  }
})

const server = computed(() => serverStore.servers.find(s => s.id === serverId.value))
const tunnel = computed(() => {
  const tId = server.value?.frpTunnelId
  if (!tId) return null
  return frpStore.tunnels.find(t => t.id === tId)
})

const tunnelAddress = computed(() => {
  if (!tunnel.value) return null
  const node = frpStore.nodeById(tunnel.value.node)
  if (!node) return null
  if (tunnel.value.type === 'http' || tunnel.value.type === 'https') {
    return `${tunnel.value.domain || 'unset'}.${node.hostname.split('.')[0]}.frp.natfrp.cloud`
  }
  return `${node.hostname}:${tunnel.value.remotePort}`
})

function startMonitoring() {
  if (pingTimer.value) clearInterval(pingTimer.value)
  pingTimer.value = setInterval(() => {
    if (server.value) serverStore.ping(server.value)
  }, 10000)
}

onUnmounted(() => {
  if (pingTimer.value) clearInterval(pingTimer.value)
})

function appendLog(line: string) {
  logs.value.push(`[${new Date().toLocaleTimeString()}] ${line}`)
  if (logs.value.length > 200) logs.value = logs.value.slice(-200)
}

async function start() {
  if (!server.value) return
  appendLog(`启动服务器 ${server.value.name}...`)
  await serverStore.startLocal(server.value)
  appendLog('服务器已启动')
}

async function stop() {
  if (!server.value) return
  appendLog(`停止服务器...`)
  await serverStore.stopLocal(server.value)
  appendLog('服务器已停止')
}

async function ping() {
  if (!server.value) return
  appendLog('测速中...')
  const ms = await serverStore.ping(server.value)
  appendLog(ms > 0 ? `延迟 ${ms}ms` : '服务器离线')
}

function copyAddress() {
  if (tunnelAddress.value) {
    copyText(tunnelAddress.value)
    uni.showToast({ title: '已复制', icon: 'success' })
  }
}
</script>

<template>
  <view class="sd">
    <view v-if="!server" class="sd__empty">
      <text>未找到服务器</text>
    </view>

    <template v-else>
      <view class="sd__hero">
        <view class="sd__hero-icon">🖥️</view>
        <view class="sd__hero-main">
          <text class="sd__hero-name">{{ server.name }}</text>
          <text class="sd__hero-host">{{ server.host }}:{{ server.port }} · {{ server.type }}</text>
        </view>
        <McBadge :status="server.status" />
      </view>

      <McCard title="服务器信息" glow>
        <view class="info-row">
          <text class="info-row__label">地址</text>
          <text class="info-row__value">{{ server.host }}:{{ server.port }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">版本</text>
          <text class="info-row__value">{{ server.version }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">核心</text>
          <text class="info-row__value">{{ server.core }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">类型</text>
          <text class="info-row__value">{{ server.local ? '本地服务器' : '远程服务器' }}</text>
        </view>
        <view v-if="server.ping && server.ping > 0" class="info-row">
          <text class="info-row__label">延迟</text>
          <text class="info-row__value">{{ server.ping }}ms</text>
        </view>
        <view v-if="server.players" class="info-row">
          <text class="info-row__label">玩家</text>
          <text class="info-row__value">{{ server.players.online }} / {{ server.players.max }}</text>
        </view>
      </McCard>

      <view v-if="tunnel" class="sd__section">
        <McCard title="🐱 猫宁穿透" subtitle="朋友可使用此地址加入">
          <view class="tunnel-info">
            <text class="tunnel-info__label">公网地址</text>
            <view class="tunnel-info__addr">
              <text class="tunnel-info__value">{{ tunnelAddress }}</text>
              <text class="tunnel-info__copy" @tap="copyAddress">📋</text>
            </view>
            <text class="tunnel-info__sub">隧道: {{ tunnel.name }} · 节点: {{ tunnel.nodeName || '#' + tunnel.node }}</text>
            <text class="tunnel-info__sub" v-if="tunnel.type !== 'tcp'">协议: {{ tunnel.type }}</text>
          </view>
        </McCard>
      </view>

      <McCard title="控制台" class="sd__section">
        <view class="ctrl">
          <view class="ctrl__row">
            <McButton v-if="server.local && server.status === 'offline'" variant="success" @click="start">▶ 启动</McButton>
            <McButton v-if="server.local && (server.status === 'online' || server.status === 'starting')" variant="danger" @click="stop">⏹ 停止</McButton>
            <McButton variant="ghost" @click="ping">📡 测速</McButton>
          </view>
          <view class="ctrl__log">
            <text v-for="(line, i) in logs.slice(-30)" :key="i" class="ctrl__log-line">{{ line }}</text>
            <text v-if="!logs.length" class="ctrl__log-empty">暂无日志</text>
          </view>
        </view>
      </McCard>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.sd {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__empty { text-align: center; padding: 100rpx 0; color: #6a5a8a; }
  &__hero { display: flex; align-items: center; gap: 16rpx; margin-bottom: 24rpx; }
  &__hero-icon {
    width: 80rpx; height: 80rpx;
    background: linear-gradient(135deg, #2d1b4e, #1a0f2e);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 36rpx;
  }
  &__hero-main { flex: 1; min-width: 0; }
  &__hero-name { font-size: 36rpx; font-weight: 700; color: #ffffff; display: block; }
  &__hero-host { font-size: 22rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__section { margin-top: 24rpx; }
}

.info-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12rpx 0;
  border-bottom: 2rpx solid rgba(216, 150, 255, 0.05);
  &:last-child { border-bottom: none; }
  &__label { font-size: 26rpx; color: #b8a8d4; }
  &__value { font-size: 26rpx; color: #ffffff; font-weight: 600; }
}

.tunnel-info {
  &__label { font-size: 24rpx; color: #b8a8d4; display: block; margin-bottom: 8rpx; }
  &__addr {
    display: flex; align-items: center; gap: 12rpx;
    background: rgba(15, 15, 26, 0.6);
    padding: 16rpx 20rpx; border-radius: 12rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
  }
  &__value { flex: 1; font-size: 26rpx; color: #ffb7d5; font-weight: 600; word-break: break-all; }
  &__copy { font-size: 28rpx; padding: 4rpx 8rpx; }
  &__sub { font-size: 22rpx; color: #6a5a8a; display: block; margin-top: 8rpx; }
}

.ctrl {
  &__row { display: flex; gap: 12rpx; flex-wrap: wrap; margin-bottom: 16rpx; }
  &__log {
    background: #000; padding: 16rpx;
    border-radius: 12rpx;
    height: 400rpx;
    overflow-y: auto;
    font-family: monospace;
  }
  &__log-line { display: block; font-size: 22rpx; color: #4ade80; line-height: 1.6; }
  &__log-empty { display: block; font-size: 24rpx; color: #6a5a8a; }
}
</style>
