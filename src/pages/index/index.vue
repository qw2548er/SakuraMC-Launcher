<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAccountStore } from '@/stores/account'
import { useVersionStore } from '@/stores/version'
import { useServerStore } from '@/stores/server'
import { useFrpStore } from '@/stores/frp'
import { useSettingsStore } from '@/stores/settings'
import { useJavaStore } from '@/stores/java'
import McButton from '@/components/mc-button.vue'
import McCard from '@/components/mc-card.vue'
import McBadge from '@/components/mc-badge.vue'
import GameIcon from '@/components/game-icon.vue'
import NotDeveloped from '@/components/not-developed.vue'
import UpdateModal from '@/components/update-modal.vue'
import { buildLaunchCommand, buildSingleLine, buildBatchScript, buildShellScript } from '@/utils/launcher'
import { copyText, downloadFile, formatBytes, relativeTime } from '@/utils/format'
import { checkUpdate } from '@/utils/updater'
import type { IAppUpdate } from '@/types'

const accountStore = useAccountStore()
const versionStore = useVersionStore()
const serverStore = useServerStore()
const frpStore = useFrpStore()
const settingsStore = useSettingsStore()
const javaStore = useJavaStore()

const activeNav = ref('home')
const showLaunchModal = ref(false)
const showCommand = ref('')
const showUpdateModal = ref(false)
const latestUpdate = ref<IAppUpdate | null>(null)
const showAnnouncement = ref(true)

const navItems = [
  { id: 'home', icon: '🏠', label: '首页' },
  { id: 'settings', icon: '🔧', label: '设置' },
  { id: 'download', icon: '⬇️', label: '下载' },
  { id: 'plus', icon: '➕', label: '添加' },
  { id: 'frp', icon: '🌐', label: '穿透' },
  { id: 'about', icon: '⚙️', label: '关于' }
]

onShow(() => {
  if (!versionStore.manifest) versionStore.loadManifest()
  serverStore.pingAll()
})

const selectedVersion = computed(() => versionStore.selected)
const selectedAccount = computed(() => accountStore.selected)
const onlineServers = computed(() => serverStore.servers.filter(s => s.status === 'online').length)
const frpStatus = computed(() => frpStore.isLoggedIn ? (frpStore.tunnels.filter(t => t.online).length + '/' + frpStore.tunnels.length) : '未登录')
const activeDownloads = computed(() => versionStore.activeDownloads)
const selectedJava = computed(() => javaStore.selectedVersion)

function navigateTo(id: string) {
  activeNav.value = id
  switch (id) {
    case 'home':
      break
    case 'settings':
      uni.switchTab({ url: '/pages/settings/settings' })
      break
    case 'download':
      uni.navigateTo({ url: '/pages/versions/versions' })
      break
    case 'plus':
      uni.showToast({ title: '未开发', icon: 'none' })
      break
    case 'frp':
      uni.switchTab({ url: '/pages/frp/frp' })
      break
    case 'about':
      uni.switchTab({ url: '/pages/settings/settings' })
      break
  }
}

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
function openSettings() {
  uni.switchTab({ url: '/pages/settings/settings' })
}
function openMods() {
  uni.navigateTo({ url: '/pages/mods/mods' })
}

function startGame() {
  if (!selectedAccount.value) {
    uni.navigateTo({ url: '/pages/accounts/accounts' })
    uni.showToast({ title: '请先添加账号', icon: 'none' })
    return
  }
  if (!selectedVersion.value) {
    uni.navigateTo({ url: '/pages/versions/versions' })
    uni.showToast({ title: '请先选择游戏版本', icon: 'none' })
    return
  }
  if (!selectedVersion.value.installed) {
    uni.navigateTo({ url: '/pages/versions/version-detail?id=' + selectedVersion.value.id })
    uni.showToast({ title: '请先下载游戏版本', icon: 'none' })
    return
  }
  const javaPath = selectedJava.value?.path || settingsStore.javaPath || 'java'
  const cmd = buildLaunchCommand({
    account: selectedAccount.value,
    version: selectedVersion.value,
    gameDir: settingsStore.gameDir,
    javaPath,
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
  const javaPath = selectedJava.value?.path || settingsStore.javaPath || 'java'
  const cmd = buildLaunchCommand({
    account: selectedAccount.value,
    version: selectedVersion.value,
    gameDir: settingsStore.gameDir,
    javaPath,
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
  const javaPath = selectedJava.value?.path || settingsStore.javaPath || 'java'
  const cmd = buildLaunchCommand({
    account: selectedAccount.value,
    version: selectedVersion.value,
    gameDir: settingsStore.gameDir,
    javaPath,
    memory: { min: settingsStore.minMemory, max: settingsStore.maxMemory },
    jvmArgs: [],
    gameArgs: [],
    fullscreen: settingsStore.fullscreen
  })
  const script = buildShellScript(cmd, selectedVersion.value.id)
  downloadFile(`start-${selectedVersion.value.id}.sh`, script)
  uni.showToast({ title: '已下载 .sh 启动脚本', icon: 'success' })
}

function ignoreUpdate() {
  if (latestUpdate.value) {
    settingsStore.update({ ignoredVersion: latestUpdate.value.version })
  }
  showUpdateModal.value = false
}

async function doCheckUpdate() {
  if (!settingsStore.autoCheckUpdate) return
  const update = await checkUpdate()
  if (update && update.version !== settingsStore.ignoredVersion) {
    latestUpdate.value = update
    showUpdateModal.value = true
  }
}

onMounted(() => {
  versionStore.loadManifest()
  javaStore.load()
  settingsStore.load()
  setTimeout(doCheckUpdate, 2000)
})
</script>

<template>
  <view class="home">
    <UpdateModal v-model:show="showUpdateModal" :update="latestUpdate" @ignore="ignoreUpdate" />
    
    <view class="home__bg">
      <view class="home__bg-overlay" />
    </view>
    
    <view class="home__layout">
      <view class="home__sidebar">
        <view class="sidebar-list">
          <view
            v-for="item in navItems"
            :key="item.id"
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeNav === item.id }"
            @tap="navigateTo(item.id)"
          >
            <text class="sidebar-item__icon">{{ item.icon }}</text>
          </view>
        </view>
      </view>
      
      <view class="home__main">
        <view v-if="showAnnouncement" class="home__announcement">
          <view class="announcement-content">
            <text class="announcement__title">📢 公告：关于 v0.2.0</text>
            <text class="announcement__text">樱花 MC 启动器 v0.2.0 发布啦！全新界面设计，内置 Java 运行环境，新增樱花穿透功能，点击查看更多更新内容。</text>
          </view>
          <view class="announcement__close" @tap="showAnnouncement = false">✕</view>
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
              <view class="quick-tile" @tap="openMods">
                <view class="quick-tile__icon">🧩</view>
                <text class="quick-tile__label">模组</text>
                <text class="quick-tile__sub">Mods</text>
              </view>
              <view class="quick-tile" @tap="openFrp">
                <view class="quick-tile__icon">🌐</view>
                <text class="quick-tile__label">穿透</text>
                <text class="quick-tile__sub">{{ frpStatus }}</text>
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
              <text class="home__section-title">游戏设置</text>
            </view>
            <McCard>
              <view class="setting-row" @tap="chooseAccount">
                <view class="setting-row__main">
                  <text class="setting-row__label">当前账号</text>
                  <text class="setting-row__value">{{ selectedAccount?.username || '未设置' }}</text>
                </view>
                <text class="setting-row__arrow">›</text>
              </view>
              <view class="setting-row" @tap="chooseVersion">
                <view class="setting-row__main">
                  <text class="setting-row__label">游戏版本</text>
                  <text class="setting-row__value">{{ selectedVersion?.id || '未选择' }}</text>
                </view>
                <text class="setting-row__arrow">›</text>
              </view>
              <view class="setting-row" @tap="openSettings">
                <view class="setting-row__main">
                  <text class="setting-row__label">Java 版本</text>
                  <text class="setting-row__value">{{ selectedJava?.name || '未配置' }} · 自动选择</text>
                </view>
                <text class="setting-row__arrow">›</text>
              </view>
              <view class="setting-row" @tap="openSettings">
                <view class="setting-row__main">
                  <text class="setting-row__label">内存分配</text>
                  <text class="setting-row__value">最小 {{ formatBytes(settingsStore.minMemory * 1024 * 1024) }} · 最大 {{ formatBytes(settingsStore.maxMemory * 1024 * 1024) }}</text>
                </view>
                <text class="setting-row__arrow">›</text>
              </view>
            </McCard>
          </view>
          
          <view v-if="frpStore.isLoggedIn" class="home__section">
            <view class="home__section-header">
              <text class="home__section-title">樱花穿透</text>
              <text class="home__section-link" @tap="openFrp">详情</text>
            </view>
            <McCard>
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
            </McCard>
          </view>
        </view>
      </view>
      
      <view class="home__right">
        <view class="player-info">
          <view class="player-info__avatar" @tap="chooseAccount">
            <GameIcon v-if="selectedAccount" :uuid="selectedAccount.uuid" :size="120" variant="head" />
            <view v-else class="player-info__avatar-placeholder">
              <text>👤</text>
            </view>
          </view>
          <text class="player-info__name">{{ selectedAccount?.username || '微软账户' }}</text>
          <text class="player-info__hint" @tap="chooseAccount">点击切换账号</text>
        </view>
        
        <view class="launch-section">
          <NotDeveloped variant="banner" feature="游戏启动" plan="v0.2.0" />
          <McButton size="lg" glow block @click="startGame" class="launch-btn">
            🎮 启动游戏
          </McButton>
          <view class="launch-version" @tap="chooseVersion">
            <view class="launch-version__icon">⛏️</view>
            <view class="launch-version__info">
              <text class="launch-version__name">{{ selectedVersion?.id || '未选择版本' }}</text>
              <text class="launch-version__type">{{ selectedVersion?.type || '点击选择版本' }}</text>
            </view>
            <text class="launch-version__gear" @tap.stop="openSettings">⚙️</text>
          </view>
          <view class="launch-actions">
            <view class="launch-action" @tap="chooseVersion">
              <text class="launch-action__text">管理版本</text>
            </view>
            <view class="launch-action" @tap="openMods">
              <text class="launch-action__text">模组管理</text>
            </view>
          </view>
        </view>
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
  position: relative;
  overflow: hidden;
  
  &__bg {
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, #1a0f2e 0%, #2d1b4e 50%, #1a0f2e 100%);
    
    &-overlay {
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(circle at 30% 20%, rgba(255, 183, 213, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 70% 80%, rgba(216, 150, 255, 0.1) 0%, transparent 50%);
    }
  }
  
  &__layout {
    display: flex;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }
  
  &__sidebar {
    width: 100rpx;
    flex-shrink: 0;
    background: rgba(26, 15, 46, 0.8);
    backdrop-filter: blur(20px);
    border-right: 2rpx solid rgba(216, 150, 255, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32rpx 0;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 10;
  }
  
  &__main {
    flex: 1;
    margin-left: 100rpx;
    margin-right: 320rpx;
    padding: 24rpx 32rpx 32rpx;
    min-height: 100vh;
    overflow-y: auto;
  }
  
  &__right {
    width: 320rpx;
    flex-shrink: 0;
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(26, 15, 46, 0.6);
    backdrop-filter: blur(20px);
    border-left: 2rpx solid rgba(216, 150, 255, 0.1);
    display: flex;
    flex-direction: column;
    padding: 40rpx 24rpx 32rpx;
    z-index: 10;
  }
  
  &__announcement {
    background: rgba(255, 183, 213, 0.15);
    border: 2rpx solid rgba(255, 183, 213, 0.3);
    border-radius: 16rpx;
    padding: 20rpx 24rpx;
    margin-bottom: 24rpx;
    display: flex;
    align-items: flex-start;
    gap: 16rpx;
  }
  
  &__section {
    margin-bottom: 28rpx;
  }
  
  &__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;
  }
  
  &__section-title {
    font-size: 28rpx;
    font-weight: 700;
    color: #ffffff;
  }
  
  &__section-link {
    font-size: 24rpx;
    color: #ffb7d5;
  }
  
  &__modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32rpx;
  }
  
  &__modal-panel {
    background: #1a0f2e;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
    border-radius: 32rpx;
    max-width: 720rpx;
    width: 100%;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  &__modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24rpx 32rpx;
    border-bottom: 2rpx solid rgba(216, 150, 255, 0.1);
  }
  
  &__modal-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #ffffff;
  }
  
  &__modal-close {
    font-size: 32rpx;
    color: #b8a8d4;
    padding: 8rpx 16rpx;
  }
  
  &__modal-body {
    padding: 32rpx;
    overflow-y: auto;
  }
  
  &__modal-tip {
    display: block;
    font-size: 24rpx;
    color: #b8a8d4;
    margin-bottom: 16rpx;
    line-height: 1.6;
  }
  
  &__modal-cmd-box {
    background: #0f0f1a;
    padding: 24rpx;
    border-radius: 16rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.1);
    max-height: 360rpx;
    overflow-y: auto;
  }
  
  &__modal-cmd {
    font-size: 22rpx;
    color: #b8a8d4;
    font-family: monospace;
    word-break: break-all;
    line-height: 1.6;
  }
  
  &__modal-actions {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    margin-top: 24rpx;
  }
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  width: 100%;
  align-items: center;
}

.sidebar-item {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &--active {
    background: linear-gradient(135deg, rgba(255, 183, 213, 0.3), rgba(216, 150, 255, 0.3));
    box-shadow: 0 0 20rpx rgba(255, 183, 213, 0.3);
  }
  
  &__icon {
    font-size: 32rpx;
  }
}

.announcement-content {
  flex: 1;
  min-width: 0;
}

.announcement__title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #ffb7d5;
  margin-bottom: 8rpx;
}

.announcement__text {
  display: block;
  font-size: 24rpx;
  color: #b8a8d4;
  line-height: 1.5;
}

.announcement__close {
  font-size: 24rpx;
  color: #6a5a8a;
  padding: 4rpx 12rpx;
  flex-shrink: 0;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.quick-tile {
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 20rpx;
  padding: 24rpx 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  
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

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 2rpx solid rgba(216, 150, 255, 0.08);
  
  &:last-child { border-bottom: none; }
  
  &__main { flex: 1; min-width: 0; }
  &__label { font-size: 24rpx; color: #b8a8d4; display: block; }
  &__value { font-size: 28rpx; color: #ffffff; font-weight: 600; display: block; margin-top: 4rpx; }
  &__arrow { font-size: 32rpx; color: #6a5a8a; flex-shrink: 0; }
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32rpx;
  
  &__avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    overflow: hidden;
    border: 4rpx solid rgba(255, 183, 213, 0.5);
    margin-bottom: 16rpx;
    box-shadow: 0 0 30rpx rgba(255, 183, 213, 0.3);
    
    image {
      width: 100%;
      height: 100%;
    }
  }
  
  &__avatar-placeholder {
    width: 100%;
    height: 100%;
    background: rgba(45, 27, 78, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48rpx;
  }
  
  &__name {
    font-size: 30rpx;
    font-weight: 700;
    color: #ffb7d5;
    margin-bottom: 4rpx;
  }
  
  &__hint {
    font-size: 22rpx;
    color: #6a5a8a;
  }
}

.launch-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.launch-btn {
  margin-bottom: 8rpx !important;
}

.launch-version {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.2);
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  
  &__icon {
    font-size: 36rpx;
    flex-shrink: 0;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 26rpx;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  &__type {
    display: block;
    font-size: 20rpx;
    color: #6a5a8a;
    margin-top: 2rpx;
  }
  
  &__gear {
    font-size: 28rpx;
    flex-shrink: 0;
    padding: 8rpx;
  }
}

.launch-actions {
  display: flex;
  gap: 12rpx;
}

.launch-action {
  flex: 1;
  background: rgba(45, 27, 78, 0.4);
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 12rpx;
  padding: 16rpx;
  text-align: center;
  
  &__text {
    font-size: 22rpx;
    color: #b8a8d4;
  }
}

.frp-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 2rpx solid rgba(216, 150, 255, 0.08);
  
  &:last-child { border-bottom: none; }
  
  &__label { font-size: 26rpx; color: #b8a8d4; }
  &__value { font-size: 26rpx; color: #ffffff; font-weight: 600; }
}
</style>
