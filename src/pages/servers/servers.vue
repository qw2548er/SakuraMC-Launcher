<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useServerStore } from '@/stores/server'
import { useFrpStore } from '@/stores/frp'
import McCard from '@/components/mc-card.vue'
import McButton from '@/components/mc-button.vue'
import McBadge from '@/components/mc-badge.vue'
import McModal from '@/components/mc-modal.vue'
import McInput from '@/components/mc-input.vue'
import McPicker from '@/components/mc-picker.vue'
import NotDeveloped from '@/components/not-developed.vue'

const serverStore = useServerStore()
const frpStore = useFrpStore()

const showAddModal = ref(false)
const newName = ref('')
const newHost = ref('localhost')
const newPort = ref(25565)
const newVersion = ref('1.21.4')
const newType = ref<'vanilla' | 'paper' | 'spigot' | 'forge' | 'fabric' | 'bedrock'>('paper')
const newFrpTunnelId = ref<number | null>(null)

onShow(() => {
  serverStore.pingAll()
})

const serverTypes = [
  { label: '原版', value: 'vanilla', icon: '⛏️' },
  { label: 'Paper', value: 'paper', icon: '📄' },
  { label: 'Spigot', value: 'spigot', icon: '🔌' },
  { label: 'Forge', value: 'forge', icon: '🔥' },
  { label: 'Fabric', value: 'fabric', icon: '⚙️' },
  { label: '基岩版', value: 'bedrock', icon: '🪨' }
]

const sortedServers = computed(() => {
  return [...serverStore.servers].sort((a, b) => {
    if (a.status === 'online' && b.status !== 'online') return -1
    if (a.status !== 'online' && b.status === 'online') return 1
    return 0
  })
})

function openServer(id: string) {
  serverStore.setActive(id)
  uni.navigateTo({ url: '/pages/servers/server-detail?id=' + id })
}

function addServer() {
  if (!newName.value.trim()) {
    uni.showToast({ title: '请输入服务器名', icon: 'none' })
    return
  }
  serverStore.add({
    name: newName.value.trim(),
    host: newHost.value,
    port: Number(newPort.value) || 25565,
    version: newVersion.value,
    type: newType.value,
    core: newType.value,
    local: newHost.value === 'localhost' || newHost.value === '127.0.0.1',
    frpTunnelId: newFrpTunnelId.value ?? undefined
  })
  showAddModal.value = false
  newName.value = ''
  newHost.value = 'localhost'
  newPort.value = 25565
  newType.value = 'paper'
  newFrpTunnelId.value = null
  uni.showToast({ title: '已添加', icon: 'success' })
}

async function quickPing(id: string) {
  const s = serverStore.servers.find(x => x.id === id)
  if (!s) return
  await serverStore.ping(s)
}

async function startServer(id: string) {
  const s = serverStore.servers.find(x => x.id === id)
  if (!s) return
  await serverStore.startLocal(s)
}

async function stopServer(id: string) {
  const s = serverStore.servers.find(x => x.id === id)
  if (!s) return
  await serverStore.stopLocal(s)
}

function removeServer(id: string, name: string) {
  uni.showModal({
    title: '删除服务器',
    content: `确定要删除服务器 "${name}" 吗?`,
    confirmColor: '#f87171',
    success: r => {
      if (r.confirm) {
        serverStore.remove(id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

const frpOptions = computed(() => [
  { label: '不使用穿透', value: null as any },
  ...frpStore.tunnels.map(t => ({
    label: `${t.name} (${t.type})`,
    value: t.id,
    desc: `节点 ${t.nodeName || '#' + t.node} · 端口 ${t.remotePort || '-'}`
  }))
])
</script>

<template>
  <view class="servers">
    <NotDeveloped variant="banner" feature="本地服务器启动" plan="v0.2.0" />
    <view class="servers__header">
      <view>
        <text class="servers__title">服务器</text>
        <text class="servers__subtitle">{{ serverStore.servers.length }} 个 · {{ serverStore.onlineCount }} 个在线</text>
      </view>
      <view class="servers__actions">
        <McButton variant="ghost" size="sm" @click="serverStore.pingAll()">🔄</McButton>
        <McButton size="sm" @click="showAddModal = true">+ 添加</McButton>
      </view>
    </view>

    <view v-if="sortedServers.length === 0" class="servers__empty">
      <text class="servers__empty-icon">🖥️</text>
      <text class="servers__empty-text">还没有添加服务器</text>
      <McButton @click="showAddModal = true">添加第一个服务器</McButton>
    </view>

    <view v-else class="servers__list">
      <view v-for="s in sortedServers" :key="s.id" class="server-card" @tap="openServer(s.id)">
        <view class="server-card__head">
          <view class="server-card__icon">
            <text>{{ s.local ? '🏠' : '🌐' }}</text>
          </view>
          <view class="server-card__main">
            <text class="server-card__name">{{ s.name }}</text>
            <text class="server-card__host">{{ s.host }}:{{ s.port }} · {{ s.type }}</text>
            <view class="server-card__meta">
              <McBadge :status="s.status" />
              <text v-if="s.players" class="server-card__players">👥 {{ s.players.online }}/{{ s.players.max }}</text>
              <text v-if="s.ping && s.ping > 0" class="server-card__ping">📶 {{ s.ping }}ms</text>
            </view>
          </view>
        </view>
        <view v-if="s.motd" class="server-card__motd">
          <text>{{ s.motd }}</text>
        </view>
        <view class="server-card__actions">
          <McButton size="sm" variant="ghost" @click.stop="quickPing(s.id)">📡 测速</McButton>
          <McButton v-if="s.local && s.status === 'offline'" size="sm" variant="success" @click.stop="startServer(s.id)">▶ 启动</McButton>
          <McButton v-if="s.local && (s.status === 'online' || s.status === 'starting')" size="sm" variant="danger" @click.stop="stopServer(s.id)">⏹ 停止</McButton>
          <McButton size="sm" variant="danger" @click.stop="removeServer(s.id, s.name)">🗑️</McButton>
        </view>
      </view>
    </view>

    <view class="servers__tips">
      <text class="servers__tips-title">💡 服务器管理</text>
      <text class="servers__tips-text">• 远程服务器支持 SLP 协议测速, 自动获取在线人数与 MOTD</text>
      <text class="servers__tips-text">• 本地服务器可一键启动, 状态实时监控</text>
      <text class="servers__tips-text">• 绑定樱花穿透隧道后, 朋友可通过公网地址加入</text>
    </view>

    <McModal v-model:show="showAddModal" title="添加服务器" width="90%">
      <view class="add-server">
        <McInput v-model="newName" label="服务器名称" placeholder="我的世界服务器" />
        <McInput v-model="newHost" label="主机地址" placeholder="localhost / IP / 域名" />
        <McInput v-model="newPort" type="number" label="端口" placeholder="25565" />
        <McInput v-model="newVersion" label="游戏版本" placeholder="1.21.4" />
        <text class="add-server__label">服务端类型</text>
        <McPicker v-model="newType" :options="serverTypes" :block="false" />
        <text class="add-server__label">绑定樱花穿透 (可选)</text>
        <McPicker v-model="newFrpTunnelId" :options="frpOptions" :block="false" />
      </view>
      <template #footer>
        <view class="add-server__actions">
          <McButton variant="ghost" @click="showAddModal = false">取消</McButton>
          <McButton @click="addServer">添加</McButton>
        </view>
      </template>
    </McModal>
  </view>
</template>

<style lang="scss" scoped>
.servers {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
  &__actions { display: flex; gap: 12rpx; }
  &__title { font-size: 44rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 24rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__list { display: flex; flex-direction: column; gap: 16rpx; }
  &__empty { text-align: center; padding: 80rpx 0; }
  &__empty-icon { font-size: 100rpx; display: block; margin-bottom: 16rpx; }
  &__empty-text { font-size: 28rpx; color: #b8a8d4; display: block; margin-bottom: 24rpx; }
  &__tips {
    margin-top: 32rpx;
    padding: 24rpx;
    background: rgba(216, 150, 255, 0.05);
    border-radius: 16rpx;
    border: 2rpx dashed rgba(216, 150, 255, 0.2);
  }
  &__tips-title { font-size: 26rpx; color: #d896ff; font-weight: 600; display: block; margin-bottom: 12rpx; }
  &__tips-text { font-size: 22rpx; color: #b8a8d4; display: block; line-height: 1.8; }
}

.server-card {
  background: linear-gradient(135deg, rgba(45, 27, 78, 0.7), rgba(26, 15, 46, 0.7));
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 24rpx;
  padding: 24rpx;
  &__head { display: flex; align-items: flex-start; gap: 16rpx; }
  &__icon {
    width: 80rpx; height: 80rpx;
    background: linear-gradient(135deg, #2d1b4e, #1a0f2e);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 36rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
    flex-shrink: 0;
  }
  &__main { flex: 1; min-width: 0; }
  &__name { font-size: 30rpx; color: #ffffff; font-weight: 700; }
  &__host { font-size: 22rpx; color: #b8a8d4; display: block; margin: 4rpx 0; }
  &__meta { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
  &__players { font-size: 22rpx; color: #b8a8d4; }
  &__ping { font-size: 22rpx; color: #b8a8d4; }
  &__motd {
    background: rgba(15, 15, 26, 0.4);
    padding: 12rpx 16rpx;
    border-radius: 8rpx;
    margin: 16rpx 0;
    font-size: 22rpx;
    color: #b8a8d4;
  }
  &__actions { display: flex; gap: 8rpx; flex-wrap: wrap; }
}

.add-server {
  display: flex; flex-direction: column; gap: 16rpx;
  &__label { font-size: 26rpx; color: #b8a8d4; font-weight: 600; margin-top: 8rpx; }
  &__actions { display: flex; gap: 16rpx; }
}
</style>
