<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFrpStore } from '@/stores/frp'
import McCard from '@/components/mc-card.vue'
import McButton from '@/components/mc-button.vue'
import McBadge from '@/components/mc-badge.vue'
import McModal from '@/components/mc-modal.vue'
import McInput from '@/components/mc-input.vue'
import McPicker from '@/components/mc-picker.vue'
import McSwitch from '@/components/mc-switch.vue'
import { formatBytes, copyText, relativeTime } from '@/utils/format'
import { TUNNEL_PRESETS, getFrpcBinaryUrl } from '@/utils/frpc'

const frpStore = useFrpStore()

const showLoginModal = ref(false)
const loginUsername = ref('')
const loginPassword = ref('')
const showTunnelModal = ref(false)
const editingId = ref<number | null>(null)
const tunnelDraft = ref({
  name: '',
  type: 'tcp' as 'tcp' | 'udp' | 'http' | 'https',
  node: 0,
  localIp: '127.0.0.1',
  localPort: 25565,
  remotePort: 0,
  domain: '',
  useCompression: true,
  useEncryption: false
})
const showPresetModal = ref(false)
const showFrpcModal = ref(false)
const frpcInfo = ref({ url: '', os: '' })
const showLogsModal = ref(false)
const logsTunnelId = ref<number | null>(null)

onShow(() => {
  if (frpStore.isLoggedIn) frpStore.refreshAll()
})

async function doLogin() {
  if (!loginUsername.value || !loginPassword.value) {
    uni.showToast({ title: '请输入账号密码', icon: 'none' })
    return
  }
  try {
    await frpStore.login(loginUsername.value, loginPassword.value)
    showLoginModal.value = false
    loginPassword.value = ''
    uni.showToast({ title: '登录成功', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e.message || '登录失败', icon: 'none' })
  }
}

async function doLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出樱花穿透账号吗?',
    success: r => {
      if (r.confirm) {
        frpStore.logout()
        uni.showToast({ title: '已退出', icon: 'success' })
      }
    }
  })
}

function openNewTunnel() {
  editingId.value = null
  tunnelDraft.value = {
    name: '',
    type: 'tcp',
    node: frpStore.nodes[0]?.id || 0,
    localIp: '127.0.0.1',
    localPort: 25565,
    remotePort: 0,
    domain: '',
    useCompression: true,
    useEncryption: false
  }
  showTunnelModal.value = true
}

function openEditTunnel(id: number) {
  const t = frpStore.tunnels.find(x => x.id === id)
  if (!t) return
  editingId.value = id
  tunnelDraft.value = {
    name: t.name,
    type: t.type,
    node: t.node,
    localIp: t.localIp,
    localPort: t.localPort,
    remotePort: t.remotePort || 0,
    domain: t.domain || '',
    useCompression: t.useCompression,
    useEncryption: t.useEncryption
  }
  showTunnelModal.value = true
}

function pickPreset(preset: typeof TUNNEL_PRESETS[0]) {
  tunnelDraft.value.name = preset.name
  tunnelDraft.value.localPort = preset.localPort
  tunnelDraft.value.type = preset.type
  showPresetModal.value = false
}

async function saveTunnel() {
  if (!tunnelDraft.value.name) {
    uni.showToast({ title: '请输入隧道名', icon: 'none' })
    return
  }
  if (!tunnelDraft.value.node) {
    uni.showToast({ title: '请选择节点', icon: 'none' })
    return
  }
  if (tunnelDraft.value.type === 'tcp' || tunnelDraft.value.type === 'udp') {
    if (!tunnelDraft.value.remotePort) {
      uni.showToast({ title: '请填写远端端口', icon: 'none' })
      return
    }
  }
  if (tunnelDraft.value.type === 'http' || tunnelDraft.value.type === 'https') {
    if (!tunnelDraft.value.domain) {
      uni.showToast({ title: '请填写域名', icon: 'none' })
      return
    }
  }
  try {
    if (editingId.value) {
      await frpStore.updateTunnel(editingId.value, tunnelDraft.value)
      uni.showToast({ title: '已更新', icon: 'success' })
    } else {
      await frpStore.createTunnel(tunnelDraft.value)
      uni.showToast({ title: '已创建', icon: 'success' })
    }
    showTunnelModal.value = false
  } catch (e: any) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

async function deleteTunnel(id: number, name: string) {
  uni.showModal({
    title: '删除隧道',
    content: `确定删除 "${name}" 吗?`,
    confirmColor: '#f87171',
    success: async r => {
      if (r.confirm) {
        try {
          await frpStore.deleteTunnel(id)
          uni.showToast({ title: '已删除', icon: 'success' })
        } catch (e: any) {
          uni.showToast({ title: e.message, icon: 'none' })
        }
      }
    }
  })
}

function startTunnel(id: number) {
  frpStore.markRunning(id)
  frpStore.appendLog(id, 'frpc 启动成功')
  setTimeout(() => frpStore.appendLog(id, '正在与节点建立连接...'), 600)
  setTimeout(() => frpStore.appendLog(id, '✓ 隧道已建立'), 1500)
  uni.showToast({ title: 'frpc 已启动 (模拟)', icon: 'success' })
}

function stopTunnel(id: number) {
  frpStore.markStopped(id)
  uni.showToast({ title: 'frpc 已停止', icon: 'none' })
}

function showLogs(id: number) {
  logsTunnelId.value = id
  showLogsModal.value = true
}

function showFrpc() {
  frpcInfo.value = { url: getFrpcBinaryUrl(), os: navigator?.userAgent || 'unknown' }
  showFrpcModal.value = true
}

function copyFrpcUrl() {
  copyText(frpcInfo.value.url)
  uni.showToast({ title: '已复制', icon: 'success' })
}

const tunnelTypeOptions = [
  { label: 'TCP', value: 'tcp', icon: '🔌' },
  { label: 'UDP', value: 'udp', icon: '📡' },
  { label: 'HTTP', value: 'http', icon: '🌐' },
  { label: 'HTTPS', value: 'https', icon: '🔒' }
]

const nodeOptions = computed(() => frpStore.nodes.map(n => ({
  label: n.name,
  value: n.id,
  desc: n.flag ? `${n.flag} ${n.region || ''}` : undefined
})))

const trafficPercent = computed(() => {
  if (!frpStore.traffic?.total) return 0
  return Math.min(100, frpStore.traffic.used / frpStore.traffic.total * 100)
})
</script>

<template>
  <view class="frp">
    <view class="frp__header">
      <view>
        <text class="frp__title">樱花穿透</text>
        <text class="frp__subtitle">Sakura NAT-FRP · 跨端联机</text>
      </view>
      <view class="frp__actions">
        <McButton v-if="frpStore.isLoggedIn" variant="ghost" size="sm" @click="showFrpc">⬇ frpc</McButton>
        <McButton v-if="frpStore.isLoggedIn" variant="ghost" size="sm" @click="frpStore.refreshAll()">🔄</McButton>
      </view>
    </view>

    <view v-if="!frpStore.isLoggedIn" class="frp__login-prompt">
      <view class="login-card">
        <text class="login-card__icon">🌸</text>
        <text class="login-card__title">登录樱花穿透</text>
        <text class="login-card__desc">支持 frp 节点中转, 0 成本内网穿透, MC 联机神器</text>
        <text class="login-card__desc">没有账号?<text class="login-card__link" @tap="uni.navigateTo({url: '/pages/settings/settings'})">前往注册</text></text>
        <McButton size="lg" glow block @click="showLoginModal = true">🔐 登录</McButton>
      </view>
    </view>

    <template v-else>
      <McCard glow>
        <view class="user-info">
          <view class="user-info__avatar">🌸</view>
          <view class="user-info__main">
            <text class="user-info__name">{{ frpStore.account?.userInfo?.username || frpStore.account?.username }}</text>
            <text class="user-info__sub">UID: {{ frpStore.account?.userInfo?.id || '-' }} · 登录于 {{ frpStore.account ? relativeTime(frpStore.account.loginAt) : '-' }}</text>
            <McButton variant="ghost" size="sm" @click="doLogout">退出登录</McButton>
          </view>
        </view>
        <view v-if="frpStore.traffic" class="traffic">
          <view class="traffic__head">
            <text class="traffic__label">本月流量</text>
            <text class="traffic__val">{{ formatBytes(frpStore.traffic.used) }} / {{ formatBytes(frpStore.traffic.total) }}</text>
          </view>
          <view class="traffic__bar">
            <view class="traffic__fill" :style="{ width: trafficPercent + '%' }" />
          </view>
        </view>
      </McCard>

      <view class="frp__section">
        <view class="frp__section-head">
          <text class="frp__section-title">我的隧道 ({{ frpStore.tunnels.length }})</text>
          <McButton size="sm" @click="openNewTunnel">+ 新建</McButton>
        </view>

        <view v-if="frpStore.tunnels.length === 0" class="frp__empty">
          <text class="frp__empty-icon">🌐</text>
          <text class="frp__empty-text">还没有隧道</text>
          <text class="frp__empty-sub">创建一条隧道, 把本地 MC 服务器暴露到公网</text>
          <McButton @click="openNewTunnel">创建第一条隧道</McButton>
        </view>

        <view v-else class="tunnel-list">
          <view v-for="t in frpStore.tunnels" :key="t.id" class="tunnel-item">
            <view class="tunnel-item__head">
              <view class="tunnel-item__icon" :class="`is-${t.type}`">
                <text>{{ t.type === 'tcp' ? '🔌' : t.type === 'udp' ? '📡' : t.type === 'http' ? '🌐' : '🔒' }}</text>
              </view>
              <view class="tunnel-item__main">
                <text class="tunnel-item__name">{{ t.name }}</text>
                <text class="tunnel-item__sub">{{ t.type.toUpperCase() }} · 节点 #{{ t.node }} {{ t.nodeName || '' }}</text>
                <text class="tunnel-item__sub">本地 {{ t.localIp }}:{{ t.localPort }} → 远端 {{ t.remotePort || t.domain || '-' }}</text>
              </view>
              <McBadge :status="t.online ? 'online' : 'offline'" :text="t.online ? '在线' : '离线'" />
            </view>
            <view class="tunnel-item__meta">
              <text class="tunnel-item__traffic">↓ {{ formatBytes(t.trafficIn || 0) }} · ↑ {{ formatBytes(t.trafficOut || 0) }}</text>
            </view>
            <view class="tunnel-item__actions">
              <McButton v-if="!frpStore.runningTunnels[t.id]" size="sm" variant="success" @click="startTunnel(t.id)">▶ 启动 frpc</McButton>
              <McButton v-else size="sm" variant="danger" @click="stopTunnel(t.id)">⏹ 停止</McButton>
              <McButton v-if="frpStore.runningTunnels[t.id]" size="sm" variant="ghost" @click="showLogs(t.id)">📋 日志</McButton>
              <McButton size="sm" variant="ghost" @click="openEditTunnel(t.id)">✏️ 编辑</McButton>
              <McButton size="sm" variant="danger" @click="deleteTunnel(t.id, t.name)">🗑️</McButton>
            </view>
          </view>
        </view>
      </view>

      <view class="frp__section">
        <view class="frp__section-head">
          <text class="frp__section-title">节点列表 ({{ frpStore.nodes.length }})</text>
        </view>
        <view class="node-list">
          <view v-for="n in frpStore.nodes.slice(0, 8)" :key="n.id" class="node-item">
            <view class="node-item__icon">
              <text>{{ n.flag || '🌐' }}</text>
            </view>
            <view class="node-item__main">
              <text class="node-item__name">{{ n.name }}</text>
              <text class="node-item__sub">{{ n.hostname }}:{{ n.port }} · {{ n.bandwidth ? n.bandwidth + 'Mbps' : '' }}</text>
            </view>
            <McBadge :status="n.status" />
          </view>
        </view>
      </view>
    </template>

    <!-- 登录弹窗 -->
    <McModal v-model:show="showLoginModal" title="登录樱花穿透" width="90%">
      <view class="login-form">
        <McInput v-model="loginUsername" label="账号" placeholder="用户名" />
        <McInput v-model="loginPassword" type="password" label="密码" placeholder="密码" />
        <text class="login-form__tip">输入 natfrp.com 注册的账号密码</text>
      </view>
      <template #footer>
        <view class="login-form__actions">
          <McButton variant="ghost" @click="showLoginModal = false">取消</McButton>
          <McButton :loading="frpStore.loading" @click="doLogin">登录</McButton>
        </view>
      </template>
    </McModal>

    <!-- 隧道编辑弹窗 -->
    <McModal v-model:show="showTunnelModal" :title="editingId ? '编辑隧道' : '新建隧道'" width="90%">
      <view class="tunnel-form">
        <McInput v-model="tunnelDraft.name" label="隧道名称" placeholder="我的MC服务器" />

        <text class="tunnel-form__label">快速预设</text>
        <view class="tunnel-form__presets">
          <view
            v-for="p in TUNNEL_PRESETS"
            :key="p.name"
            class="preset-chip"
            @tap="pickPreset(p)"
          >
            <text class="preset-chip__name">{{ p.name }}</text>
            <text class="preset-chip__port">{{ p.localPort }}</text>
          </view>
        </view>

        <text class="tunnel-form__label">协议类型</text>
        <McPicker v-model="tunnelDraft.type" :options="tunnelTypeOptions" :block="false" />

        <text class="tunnel-form__label">节点</text>
        <McPicker v-model="tunnelDraft.node" :options="nodeOptions" :block="false" />

        <McInput v-model="tunnelDraft.localIp" label="本地 IP" placeholder="127.0.0.1" />
        <McInput v-model="tunnelDraft.localPort" type="number" label="本地端口" placeholder="25565" />

        <McInput
          v-if="tunnelDraft.type === 'tcp' || tunnelDraft.type === 'udp'"
          v-model="tunnelDraft.remotePort"
          type="number"
          label="远端端口"
          placeholder="0 = 随机分配"
        />

        <McInput
          v-if="tunnelDraft.type === 'http' || tunnelDraft.type === 'https'"
          v-model="tunnelDraft.domain"
          label="自定义域名"
          placeholder="example.com"
        />

        <view class="tunnel-form__switches">
          <McSwitch v-model="tunnelDraft.useCompression" label="数据压缩" desc="减小流量但增加CPU" />
          <McSwitch v-model="tunnelDraft.useEncryption" label="加密传输" desc="更安全但稍慢" />
        </view>
      </view>
      <template #footer>
        <view class="tunnel-form__actions">
          <McButton variant="ghost" @click="showTunnelModal = false">取消</McButton>
          <McButton @click="saveTunnel">保存</McButton>
        </view>
      </template>
    </McModal>

    <!-- frpc 下载 -->
    <McModal v-model:show="showFrpcModal" title="下载 frpc" width="90%">
      <view class="frpc-modal">
        <text class="frpc-modal__title">frpc 客户端</text>
        <text class="frpc-modal__desc">在本地 PC/服务器上下载并运行 frpc, 通过配置文件连接樱花穿透节点</text>
        <view class="frpc-modal__url">
          <text class="frpc-modal__url-text" user-select="text">{{ frpcInfo.url }}</text>
          <McButton size="sm" @click="copyFrpcUrl">📋 复制</McButton>
        </view>
        <text class="frpc-modal__tip">支持的平台: Windows / Linux / macOS / Android</text>
        <text class="frpc-modal__tip">下载后解压, 在樱花穿透 App 的「隧道列表」可一键拉取配置</text>
      </view>
    </McModal>

    <!-- 日志 -->
    <McModal v-model:show="showLogsModal" title="frpc 日志" width="90%">
      <view class="logs-modal">
        <view class="logs-modal__box">
          <text v-for="(line, i) in frpStore.runningTunnels[logsTunnelId || 0]?.logs || []" :key="i" class="logs-modal__line">{{ line }}</text>
          <text v-if="!frpStore.runningTunnels[logsTunnelId || 0]" class="logs-modal__empty">暂无日志</text>
        </view>
      </view>
    </McModal>
  </view>
</template>

<style lang="scss" scoped>
.frp {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
  &__actions { display: flex; gap: 8rpx; }
  &__title { font-size: 44rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 24rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__login-prompt { padding: 60rpx 0; }
  &__section { margin-top: 24rpx; }
  &__section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
  &__section-title { font-size: 28rpx; color: #ffffff; font-weight: 700; }
  &__empty { text-align: center; padding: 60rpx 0; }
  &__empty-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
  &__empty-text { font-size: 28rpx; color: #ffffff; display: block; }
  &__empty-sub { font-size: 22rpx; color: #6a5a8a; display: block; margin: 8rpx 0 24rpx; }
}

.login-card {
  background: linear-gradient(135deg, rgba(45, 27, 78, 0.7), rgba(26, 15, 46, 0.7));
  border: 2rpx solid rgba(216, 150, 255, 0.2);
  border-radius: 32rpx;
  padding: 60rpx 40rpx;
  text-align: center;
  &__icon { font-size: 100rpx; display: block; margin-bottom: 24rpx; }
  &__title { font-size: 40rpx; font-weight: 700; color: #ffffff; display: block; }
  &__desc { font-size: 26rpx; color: #b8a8d4; display: block; margin: 12rpx 0; line-height: 1.6; }
  &__link { color: #d896ff; text-decoration: underline; margin-left: 8rpx; }
}

.user-info {
  display: flex; align-items: center; gap: 16rpx;
  &__avatar {
    width: 96rpx; height: 96rpx;
    background: linear-gradient(135deg, #ffb7d5, #d896ff);
    border-radius: 24rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 48rpx;
  }
  &__main { flex: 1; }
  &__name { font-size: 30rpx; color: #ffffff; font-weight: 700; display: block; }
  &__sub { font-size: 22rpx; color: #b8a8d4; display: block; margin: 4rpx 0 8rpx; }
}

.traffic {
  margin-top: 16rpx;
  &__head { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
  &__label { font-size: 24rpx; color: #b8a8d4; }
  &__val { font-size: 24rpx; color: #ffb7d5; font-weight: 600; }
  &__bar { height: 12rpx; background: rgba(106, 90, 138, 0.3); border-radius: 6rpx; overflow: hidden; }
  &__fill { height: 100%; background: linear-gradient(90deg, #ffb7d5, #d896ff); border-radius: 6rpx; transition: width 0.3s; }
}

.tunnel-list { display: flex; flex-direction: column; gap: 16rpx; }
.tunnel-item {
  background: linear-gradient(135deg, rgba(45, 27, 78, 0.7), rgba(26, 15, 46, 0.7));
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 20rpx;
  padding: 20rpx;
  &__head { display: flex; align-items: center; gap: 16rpx; }
  &__icon {
    width: 72rpx; height: 72rpx;
    background: linear-gradient(135deg, #2d1b4e, #1a0f2e);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 32rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
    flex-shrink: 0;
    &.is-tcp { border-color: rgba(96, 165, 250, 0.4); }
    &.is-udp { border-color: rgba(74, 222, 128, 0.4); }
    &.is-http, &.is-https { border-color: rgba(251, 191, 36, 0.4); }
  }
  &__main { flex: 1; min-width: 0; }
  &__name { font-size: 28rpx; color: #ffffff; font-weight: 700; }
  &__sub { font-size: 22rpx; color: #b8a8d4; display: block; margin-top: 2rpx; }
  &__meta { padding: 12rpx 0; }
  &__traffic { font-size: 22rpx; color: #6a5a8a; }
  &__actions { display: flex; gap: 8rpx; flex-wrap: wrap; }
}

.node-list { display: flex; flex-direction: column; gap: 12rpx; }
.node-item {
  display: flex; align-items: center; gap: 16rpx;
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.1);
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  &__icon {
    width: 60rpx; height: 60rpx;
    background: rgba(15, 15, 26, 0.6);
    border-radius: 12rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 28rpx;
  }
  &__main { flex: 1; }
  &__name { font-size: 26rpx; color: #ffffff; font-weight: 600; }
  &__sub { font-size: 22rpx; color: #6a5a8a; display: block; margin-top: 2rpx; }
}

.login-form {
  display: flex; flex-direction: column; gap: 16rpx;
  &__tip { font-size: 22rpx; color: #6a5a8a; margin-top: 8rpx; }
  &__actions { display: flex; gap: 16rpx; }
}

.tunnel-form {
  display: flex; flex-direction: column; gap: 16rpx;
  &__label { font-size: 26rpx; color: #b8a8d4; font-weight: 600; margin-top: 8rpx; }
  &__presets { display: flex; flex-wrap: wrap; gap: 8rpx; }
  &__switches { margin-top: 8rpx; }
  &__actions { display: flex; gap: 16rpx; }
}

.preset-chip {
  display: flex; align-items: center; gap: 8rpx;
  padding: 8rpx 16rpx;
  background: rgba(216, 150, 255, 0.1);
  border: 2rpx solid rgba(216, 150, 255, 0.2);
  border-radius: 9999rpx;
  &__name { font-size: 22rpx; color: #d896ff; font-weight: 600; }
  &__port { font-size: 22rpx; color: #b8a8d4; }
}

.frpc-modal {
  &__title { font-size: 28rpx; color: #ffffff; font-weight: 700; display: block; margin-bottom: 8rpx; }
  &__desc { font-size: 24rpx; color: #b8a8d4; display: block; margin-bottom: 16rpx; line-height: 1.5; }
  &__url {
    display: flex; align-items: center; gap: 12rpx;
    background: rgba(15, 15, 26, 0.6);
    padding: 16rpx 20rpx; border-radius: 12rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
    margin-bottom: 16rpx;
  }
  &__url-text { flex: 1; font-size: 22rpx; color: #ffb7d5; word-break: break-all; font-family: monospace; }
  &__tip { font-size: 22rpx; color: #6a5a8a; display: block; line-height: 1.6; }
}

.logs-modal {
  &__box {
    background: #000; padding: 16rpx;
    border-radius: 12rpx;
    height: 500rpx; overflow-y: auto;
    font-family: monospace;
  }
  &__line { display: block; font-size: 22rpx; color: #4ade80; line-height: 1.6; }
  &__empty { display: block; font-size: 24rpx; color: #6a5a8a; }
}
</style>
