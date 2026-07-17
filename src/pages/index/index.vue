<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAccountStore } from '@/stores/account'
import { useVersionStore } from '@/stores/version'
import { useServerStore } from '@/stores/server'
import { useFrpStore } from '@/stores/frp'
import { useSettingsStore } from '@/stores/settings'
import McButton from '@/components/mc-button.vue'
import McCard from '@/components/mc-card.vue'
import McBadge from '@/components/mc-badge.vue'
import GameIcon from '@/components/game-icon.vue'
import { buildLaunchCommand, buildSingleLine, buildBatchScript, buildShellScript } from '@/utils/launcher'
import { copyText, downloadFile, formatBytes, relativeTime } from '@/utils/format'

const accountStore = useAccountStore()
const versionStore = useVersionStore()
const serverStore = useServerStore()
const frpStore = useFrpStore()
const settingsStore = useSettingsStore()

const showLaunchModal = ref(false)
const showCommand = ref('')

onShow(() => {
  if (!versionStore.manifest) versionStore.loadManifest()
  serverStore.pingAll()
})

const selectedVersion = computed(() => versionStore.selected)
const selectedAccount = computed(() => accountStore.selected)
const onlineServers = computed(() => serverStore.servers.filter(s => s.status === 'online').length)
const frpStatus = computed(() => frpStore.isLoggedIn ? (frpStore.tunnels.filter(t => t.online).length + '/' + frpStore.tunnels.length) : '未登录')
const totalMemory = computed(() => settingsStore.maxMemory)
const activeDownloads = computed(() => versionStore.activeDownloads)

function chooseAccount() {
  uni.navigateTo({ url: '/pages/accounts/accounts' })
}
function chooseVersion() {
  uni.navigateTo({ url: '/pages/versions/versions' })
}
function openServer() {
  uni.navigateTo({ url: '/pages/servers/servers' })
}
function openFrp() {
  uni.switchTab({ url: '/pages/frp/frp' })
}

function startGame() {
  if (!selectedAccount.value) {
    uni.showToast({ title: '请先选择账号', icon: 'none' })
    return
  }
  if (!selectedVersion.value) {
    uni.showToast({ title: '请先选择游戏版本', icon: 'none' })
    return
  }
  if (!selectedVersion.value.installed) {
    uni.showModal({
      title: '需要先安装',
      content: `版本 ${selectedVersion.value.id} 还未下载, 是否前往下载?`,
      confirmText: '去下载',
      success: r => {
        if (r.confirm) uni.navigateTo({ url: '/pages/versions/version-detail?id=' + selectedVersion.value.id })
      }
    })
    return
  }
  // 生成启动命令
  const cmd = buildLaunchCommand({
    account: selectedAccount.value,
    version: selectedVersion.value,
    gameDir: settingsStore.gameDir,
    javaPath: settingsStore.javaPath || 'java',
    memory: { min: settingsStore.minMemory, max: settingsStore.maxMemory },
    jvmArgs: ['-XX:+UnlockExperimentalVMOptions', '-XX:+UseG1GC', '-XX:G1NewSizePercent=20', '-XX:G1ReservePercent=20', '-XX:MaxGCPauseMillis=50', '-XX:G1MixedGCCountTarget=4'],
    gameArgs: [],
    fullscreen: settingsStore.fullscreen
  })
  showCommand.value = buildSingleLine(cmd)
  showLaunchModal.value = true
}

function copyCmd() {
  copyText(showCommand.value)
  uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
}
function downloadBat() {
  if (!selectedAccount.value || !selectedVersion.value) return
  const cmd = buildLaunchCommand({
    account: selectedAccount.value,
    version: selectedVersion.value,
    gameDir: settingsStore.gameDir,
    javaPath: settingsStore.javaPath || 'java',
    memory: { min: settingsStore.minMemory, max: settingsStore.maxMemory },
    jvmArgs: [],
    gameArgs: [],
    fullscreen: settingsStore.fullscreen
  })
  const script = buildBatchScript(cmd, selectedVersion.value.id)
  downloadFile(`start-${selectedVersion.value.id}.bat`, script)
  uni.showToast({ title: '已下载 .bat 启动脚本', icon: 'success' })
}
function downloadSh() {
  if (!selectedAccount.value || !selectedVersion.value) return
  const cmd = buildLaunchCommand({
    account: selectedAccount.value,
    version: selectedVersion.value,
    gameDir: settingsStore.gameDir,
    javaPath: settingsStore.javaPath || 'java',
    memory: { min: settingsStore.minMemory, max: settingsStore.maxMemory },
    jvmArgs: [],
    gameArgs: [],
    fullscreen: settingsStore.fullscreen
  })
  const script = buildShellScript(cmd, selectedVersion.value.id)
  downloadFile(`start-${selectedVersion.value.id}.sh`, script)
  uni.showToast({ title: '已下载 .sh 启动脚本', icon: 'success' })
}

onMounted(() => {
  versionStore.loadManifest()
})
</script>

<template>
  <view class="home">
    <view class="home__hero">
      <view class="home__bg">
        <view class="home__petal home__petal--1">🌸</view>
        <view class="home__petal home__petal--2">🌸</view>
        <view class="home__petal home__petal--3">🌸</view>
      </view>
      <view class="home__top">
        <view class="home__brand">
          <view class="home__logo">🌸</view>
          <view>
            <text class="home__title gradient-text">樱花 MC 启动器</text>
            <text class="home__subtitle">Sakura · Minecraft · NAT-FRP</text>
          </view>
        </view>
        <view class="home__top-right">
          <text class="home__version-tag">v0.1.0</text>
        </view>
      </view>

      <McCard glow class="home__launch">
        <view class="launch-row">
          <view class="launch-row__icon" @tap="chooseAccount">
            <GameIcon v-if="selectedAccount" :uuid="selectedAccount.uuid" :size="100" variant="head" bordered />
            <view v-else class="launch-row__placeholder">
              <text>👤</text>
            </view>
          </view>
          <view class="launch-row__main">
            <text class="launch-row__label">当前账号</text>
            <text class="launch-row__value">{{ selectedAccount?.username || '点击登录' }}</text>
            <text class="launch-row__sub">{{ selectedAccount?.type === 'microsoft' ? '微软账号' : selectedAccount?.type === 'offline' ? '离线账号' : '未登录' }}</text>
          </view>
          <text class="launch-row__chevron">›</text>
        </view>

        <view class="launch-row" @tap="chooseVersion">
          <view class="launch-row__icon">
            <view class="launch-row__version-icon">⛏️</view>
          </view>
          <view class="launch-row__main">
            <text class="launch-row__label">游戏版本</text>
            <text class="launch-row__value">{{ selectedVersion?.id || '未选择' }} <text v-if="selectedVersion" class="launch-row__type">[{{ selectedVersion.type }}]</text></text>
            <text class="launch-row__sub">{{ selectedVersion?.installed ? '已安装 · 可启动' : '未下载' }}</text>
          </view>
          <text class="launch-row__chevron">›</text>
        </view>

        <view class="launch-row" @tap="openServer">
          <view class="launch-row__icon">
            <view class="launch-row__server-icon">🖥️</view>
          </view>
          <view class="launch-row__main">
            <text class="launch-row__label">快速联机</text>
            <text class="launch-row__value">{{ serverStore.servers.length }} 个服务器 · {{ onlineServers }} 个在线</text>
            <text class="launch-row__sub">进入服务器管理</text>
          </view>
          <text class="launch-row__chevron">›</text>
        </view>

        <view class="home__cta">
          <McButton size="lg" glow block @click="startGame">▶ 启动游戏</McButton>
          <text class="home__cta-tip">H5 端将生成启动命令 / 脚本, PC 端下载后双击运行</text>
        </view>
      </McCard>
    </view>

    <view class="home__content">
      <view class="home__section">
        <text class="home__section-title">快速访问</text>
        <view class="quick-grid">
          <view class="quick-tile" @tap="chooseAccount">
            <view class="quick-tile__icon">👤</view>
            <text class="quick-tile__label">账号</text>
            <text class="quick-tile__sub">{{ accountStore.accounts.length }} 个</text>
          </view>
          <view class="quick-tile" @tap="chooseVersion">
            <view class="quick-tile__icon">📦</view>
            <text class="quick-tile__label">版本</text>
            <text class="quick-tile__sub">{{ Object.keys(versionStore.installed).length }} 已装</text>
          </view>
          <view class="quick-tile" @tap="openFrp">
            <view class="quick-tile__icon">🌐</view>
            <text class="quick-tile__label">穿透</text>
            <text class="quick-tile__sub">{{ frpStatus }}</text>
          </view>
          <view class="quick-tile" @tap="openServer">
            <view class="quick-tile__icon">🖥️</view>
            <text class="quick-tile__label">服务器</text>
            <text class="quick-tile__sub">{{ onlineServers }} 在线</text>
          </view>
        </view>
      </view>

      <view v-if="activeDownloads.length" class="home__section">
        <view class="home__section-header">
          <text class="home__section-title">下载任务 ({{ activeDownloads.length }})</text>
          <text class="home__section-link" @tap="chooseVersion">查看全部</text>
        </view>
        <view v-for="d in activeDownloads" :key="d.id" class="download-item">
          <view class="download-item__head">
            <text class="download-item__name">{{ d.name }}</text>
            <text class="download-item__pct">{{ Math.floor(d.downloaded / Math.max(d.total, 1) * 100) }}%</text>
          </view>
          <view class="download-item__bar">
            <view class="download-item__fill" :style="{ width: (d.downloaded / Math.max(d.total, 1) * 100) + '%' }" />
          </view>
          <text class="download-item__sub">{{ formatBytes(d.downloaded) }} / {{ formatBytes(d.total) }}</text>
        </view>
      </view>

      <view class="home__section">
        <view class="home__section-header">
          <text class="home__section-title">服务器状态</text>
          <text class="home__section-link" @tap="openServer">管理</text>
        </view>
        <view v-for="s in serverStore.servers.slice(0, 3)" :key="s.id" class="server-item" @tap="openServer">
          <view class="server-item__main">
            <text class="server-item__name">{{ s.name }}</text>
            <text class="server-item__host">{{ s.host }}:{{ s.port }} · {{ s.type }}</text>
          </view>
          <McBadge :status="s.status" />
        </view>
      </view>

      <view v-if="frpStore.isLoggedIn" class="home__section">
        <view class="home__section-header">
          <text class="home__section-title">樱花穿透</text>
          <text class="home__section-link" @tap="openFrp">详情</text>
        </view>
        <view class="frp-stat">
          <text class="frp-stat__label">账号</text>
          <text class="frp-stat__value">{{ frpStore.account?.userInfo?.username || frpStore.account?.username }}</text>
        </view>
        <view v-if="frpStore.traffic" class="frp-stat">
          <text class="frp-stat__label">流量</text>
          <text class="frp-stat__value">{{ formatBytes(frpStore.traffic.used) }} / {{ formatBytes(frpStore.traffic.total) }}</text>
        </view>
        <view class="frp-stat">
          <text class="frp-stat__label">活跃隧道</text>
          <text class="frp-stat__value">{{ frpStore.onlineTunnels.length }} / {{ frpStore.tunnels.length }}</text>
        </view>
      </view>

      <view class="home__footer">
        <text class="home__footer-text">樱花穿透 © 2024 · Made with 💖 for MC</text>
        <text class="home__footer-text">Powered by Uniapp Vue3</text>
      </view>
    </view>

    <view v-if="showLaunchModal" class="home__modal" @tap.self="showLaunchModal = false">
      <view class="home__modal-panel">
        <view class="home__modal-header">
          <text class="home__modal-title">启动命令</text>
          <text class="home__modal-close" @tap="showLaunchModal = false">✕</text>
        </view>
        <view class="home__modal-body">
          <text class="home__modal-tip">请在 PC 上打开终端,粘贴并执行以下命令,或下载启动脚本双击运行:</text>
          <view class="home__modal-cmd-box">
            <text class="home__modal-cmd" user-select="text">{{ showCommand }}</text>
          </view>
          <view class="home__modal-actions">
            <McButton variant="primary" block @click="copyCmd">📋 复制命令</McButton>
            <McButton variant="secondary" block @click="downloadBat">💾 下载 .bat 启动脚本</McButton>
            <McButton variant="ghost" block @click="downloadSh">💾 下载 .sh 启动脚本</McButton>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  background: linear-gradient(180deg, #1a0f2e 0%, #0f0f1a 100%);
  position: relative;
  overflow: hidden;
  &__bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  &__petal {
    position: absolute;
    font-size: 60rpx;
    opacity: 0.15;
    animation: float 8s ease-in-out infinite;
    &--1 { top: 80rpx; left: 40rpx; animation-delay: 0s; }
    &--2 { top: 200rpx; right: 60rpx; animation-delay: 2s; }
    &--3 { top: 480rpx; left: 80rpx; animation-delay: 4s; }
  }
  &__hero { padding: 60rpx 32rpx 0; position: relative; }
  &__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32rpx; }
  &__brand { display: flex; align-items: center; gap: 16rpx; }
  &__logo {
    width: 80rpx; height: 80rpx;
    background: linear-gradient(135deg, #ffb7d5, #d896ff);
    border-radius: 24rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 44rpx;
    box-shadow: 0 8rpx 24rpx rgba(216, 150, 255, 0.4);
  }
  &__title { font-size: 40rpx; font-weight: 700; display: block; }
  &__subtitle { font-size: 22rpx; color: #b8a8d4; display: block; }
  &__version-tag {
    font-size: 22rpx;
    color: #6a5a8a;
    padding: 6rpx 16rpx;
    background: rgba(106, 90, 138, 0.2);
    border-radius: 9999rpx;
  }
  &__cta { margin-top: 24rpx; }
  &__cta-tip { display: block; font-size: 22rpx; color: #6a5a8a; text-align: center; margin-top: 12rpx; }
  &__content { padding: 32rpx; padding-bottom: 180rpx; }
  &__section { margin-bottom: 32rpx; }
  &__section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
  &__section-title { font-size: 30rpx; font-weight: 700; color: #ffffff; }
  &__section-link { font-size: 24rpx; color: #d896ff; }
  &__footer { text-align: center; padding: 40rpx 0; }
  &__footer-text { display: block; font-size: 22rpx; color: #6a5a8a; line-height: 1.6; }
  &__modal {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
    z-index: 999; display: flex; align-items: center; justify-content: center; padding: 32rpx;
  }
  &__modal-panel {
    background: #1a0f2e; border: 2rpx solid rgba(216, 150, 255, 0.2);
    border-radius: 32rpx; max-width: 720rpx; width: 100%; max-height: 85vh; overflow: hidden;
    display: flex; flex-direction: column;
  }
  &__modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 24rpx 32rpx; border-bottom: 2rpx solid rgba(216, 150, 255, 0.1);
  }
  &__modal-title { font-size: 32rpx; font-weight: 700; color: #ffffff; }
  &__modal-close { font-size: 32rpx; color: #b8a8d4; padding: 8rpx 16rpx; }
  &__modal-body { padding: 32rpx; overflow-y: auto; }
  &__modal-tip { display: block; font-size: 24rpx; color: #b8a8d4; margin-bottom: 16rpx; line-height: 1.6; }
  &__modal-cmd-box {
    background: #0f0f1a; padding: 24rpx; border-radius: 16rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.1);
    max-height: 360rpx; overflow-y: auto;
  }
  &__modal-cmd { font-size: 22rpx; color: #b8a8d4; font-family: monospace; word-break: break-all; line-height: 1.6; }
  &__modal-actions { display: flex; flex-direction: column; gap: 16rpx; margin-top: 24rpx; }
}

.launch-row {
  display: flex; align-items: center; gap: 24rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid rgba(216, 150, 255, 0.08);
  &:last-of-type { border-bottom: none; }
  &__icon { width: 100rpx; height: 100rpx; flex-shrink: 0; }
  &__placeholder {
    width: 100rpx; height: 100rpx;
    background: rgba(45, 27, 78, 0.6);
    border: 2rpx dashed rgba(216, 150, 255, 0.3);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 40rpx;
  }
  &__version-icon, &__server-icon {
    width: 100rpx; height: 100rpx;
    background: linear-gradient(135deg, #2d1b4e, #1a0f2e);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 48rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
  }
  &__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
  &__label { font-size: 22rpx; color: #b8a8d4; }
  &__value { font-size: 32rpx; color: #ffffff; font-weight: 700; }
  &__type { font-size: 22rpx; color: #d896ff; font-weight: 400; }
  &__sub { font-size: 22rpx; color: #6a5a8a; }
  &__chevron { font-size: 48rpx; color: #6a5a8a; flex-shrink: 0; }
}

.quick-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}
.quick-tile {
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 20rpx;
  padding: 24rpx 12rpx;
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  &__icon { font-size: 48rpx; }
  &__label { font-size: 24rpx; color: #ffffff; font-weight: 600; }
  &__sub { font-size: 20rpx; color: #6a5a8a; }
}

.download-item {
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.1);
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  &__head { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
  &__name { font-size: 26rpx; color: #ffffff; font-weight: 600; }
  &__pct { font-size: 24rpx; color: #d896ff; font-weight: 700; }
  &__bar { height: 8rpx; background: rgba(106, 90, 138, 0.3); border-radius: 4rpx; overflow: hidden; }
  &__fill { height: 100%; background: linear-gradient(90deg, #ffb7d5, #d896ff); border-radius: 4rpx; transition: width 0.3s; }
  &__sub { display: block; font-size: 22rpx; color: #6a5a8a; margin-top: 8rpx; }
}

.server-item {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.1);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  &__name { font-size: 28rpx; color: #ffffff; font-weight: 600; }
  &__host { font-size: 22rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
}

.frp-stat {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16rpx 24rpx;
  background: rgba(45, 27, 78, 0.4);
  border-radius: 12rpx;
  margin-bottom: 8rpx;
  &__label { font-size: 26rpx; color: #b8a8d4; }
  &__value { font-size: 26rpx; color: #ffffff; font-weight: 600; }
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0); }
  50% { transform: translateY(-40rpx) rotate(180deg); }
}
</style>
