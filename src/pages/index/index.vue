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
const activeTab = ref('game')
const showLaunchModal = ref(false)
const showCommand = ref('')
const showUpdateModal = ref(false)
const latestUpdate = ref<IAppUpdate | null>(null)
const showAnnouncement = ref(true)

const navItems = [
  { id: 'home', icon: '🏠', label: '首页' },
  { id: 'settings', icon: '⚙️', label: '设置' },
  { id: 'download', icon: '📦', label: '下载' },
  { id: 'mods', icon: '🧩', label: '模组' },
  { id: 'frp', icon: '🌐', label: '穿透' },
  { id: 'account', icon: '👤', label: '账号' }
]

const tabs = [
  { id: 'game', label: '游戏设置' },
  { id: 'version', label: '管理版本' },
  { id: 'auto', label: '自动安装' },
  { id: 'custom', label: '自定义' }
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
      activeTab.value = 'game'
      break
    case 'download':
      uni.navigateTo({ url: '/pages/versions/versions' })
      break
    case 'mods':
      uni.navigateTo({ url: '/pages/mods/mods' })
      break
    case 'frp':
      uni.navigateTo({ url: '/pages/frp/frp' })
      break
    case 'account':
      uni.navigateTo({ url: '/pages/accounts/accounts' })
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
  activeNav.value = 'settings'
  activeTab.value = 'game'
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
      <view class="home__bg-image" />
      <view class="home__bg-overlay" />
    </view>
    
    <view class="home__layout">
      <view class="home__sidebar">
        <view class="sidebar-logo">🌸</view>
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
        <view class="sidebar-spacer" />
        <view class="sidebar-item sidebar-item--bottom" @tap="openSettings">
          <text class="sidebar-item__icon">⚙️</text>
        </view>
      </view>
      
      <view class="home__main">
        <view v-if="showAnnouncement && activeNav === 'home'" class="home__announcement">
          <view class="announcement-header">
            <text class="announcement__title">📢 公告：关于 v0.2.0</text>
            <view class="announcement__close" @tap="showAnnouncement = false">不再显示</view>
          </view>
          <text class="announcement__text">樱花 MC 启动器 v0.2.0 发布啦！全新界面设计，内置 Java 运行环境，新增樱花穿透功能，点击查看更多更新内容。</text>
        </view>
        
        <view v-if="activeNav === 'home'" class="home__content">
          <view class="panel">
            <view class="panel__header">
              <text class="panel__title">快速访问</text>
            </view>
            <view class="panel__body">
              <view class="quick-grid">
                <view class="quick-tile" @tap="chooseAccount">
                  <view class="quick-tile__icon">👤</view>
                  <view class="quick-tile__info">
                    <text class="quick-tile__label">账号</text>
                    <text class="quick-tile__sub">{{ accountStore.accounts.length }} 个账号</text>
                  </view>
                </view>
                <view class="quick-tile" @tap="chooseVersion">
                  <view class="quick-tile__icon">📦</view>
                  <view class="quick-tile__info">
                    <text class="quick-tile__label">版本</text>
                    <text class="quick-tile__sub">{{ Object.keys(versionStore.installed).length }} 已安装</text>
                  </view>
                </view>
                <view class="quick-tile" @tap="openMods">
                  <view class="quick-tile__icon">🧩</view>
                  <view class="quick-tile__info">
                    <text class="quick-tile__label">模组</text>
                    <text class="quick-tile__sub">模组管理</text>
                  </view>
                </view>
                <view class="quick-tile" @tap="openFrp">
                  <view class="quick-tile__icon">🌐</view>
                  <view class="quick-tile__info">
                    <text class="quick-tile__label">穿透</text>
                    <text class="quick-tile__sub">{{ frpStatus }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
          
          <view v-if="activeDownloads.length" class="panel">
            <view class="panel__header">
              <text class="panel__title">下载任务</text>
              <text class="panel__action" @tap="chooseVersion">{{ activeDownloads.length }} 个进行中</text>
            </view>
            <view class="panel__body">
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
          </view>
        </view>
        
        <view v-if="activeNav === 'settings'" class="home__content">
          <view class="panel">
            <view class="panel__tabs">
              <view
                v-for="tab in tabs"
                :key="tab.id"
                class="panel__tab"
                :class="{ 'panel__tab--active': activeTab === tab.id }"
                @tap="activeTab = tab.id"
              >
                <text>{{ tab.label }}</text>
              </view>
            </view>
            
            <view v-if="activeTab === 'game'" class="panel__body">
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
                  <text class="setting-row__label">Java 路径</text>
                  <text class="setting-row__value">{{ selectedJava?.name || '自动选择' }}</text>
                </view>
                <text class="setting-row__arrow">›</text>
              </view>
              <view class="setting-row">
                <view class="setting-row__main">
                  <text class="setting-row__label">最大内存</text>
                  <text class="setting-row__value">{{ settingsStore.maxMemory }} MB</text>
                </view>
                <text class="setting-row__arrow">›</text>
              </view>
              <view class="setting-row">
                <view class="setting-row__main">
                  <text class="setting-row__label">最小内存</text>
                  <text class="setting-row__value">{{ settingsStore.minMemory }} MB</text>
                </view>
                <text class="setting-row__arrow">›</text>
              </view>
              <view class="setting-row">
                <view class="setting-row__main">
                  <text class="setting-row__label">窗口大小</text>
                  <text class="setting-row__value">854 x 480</text>
                </view>
                <text class="setting-row__arrow">›</text>
              </view>
            </view>
            
            <view v-else class="panel__body panel__body--empty">
              <NotDeveloped feature="该设置页" />
            </view>
          </view>
        </view>
      </view>
      
      <view class="home__right">
        <view class="player-card">
          <view class="player-card__avatar" @tap="chooseAccount">
            <GameIcon v-if="selectedAccount" :uuid="selectedAccount.uuid" :size="100" variant="head" />
            <view v-else class="player-card__avatar-placeholder">
              <text>👤</text>
            </view>
          </view>
          <view class="player-card__info">
            <text class="player-card__name">{{ selectedAccount?.username || '微软账户' }}</text>
            <text class="player-card__type" @tap="chooseAccount">点击切换账号</text>
          </view>
        </view>
        
        <view class="launch-card">
          <NotDeveloped variant="banner" feature="游戏启动" plan="v0.2.0" />
          <McButton size="lg" glow block @click="startGame" class="launch-btn">
            🎮 启动游戏
          </McButton>
          
          <view class="version-selector" @tap="chooseVersion">
            <view class="version-selector__icon">⛏️</view>
            <view class="version-selector__info">
              <text class="version-selector__name">{{ selectedVersion?.id || '未选择版本' }}</text>
              <text class="version-selector__type">{{ selectedVersion?.type || '点击选择游戏版本' }}</text>
            </view>
            <text class="version-selector__arrow">›</text>
          </view>
          
          <view class="launch-links">
            <text class="launch-link" @tap="chooseVersion">管理版本</text>
            <text class="launch-link" @tap="openMods">模组管理</text>
            <text class="launch-link" @tap="openSettings">游戏设置</text>
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
    
    &-image {
      position: absolute;
      inset: 0;
      background: 
        linear-gradient(135deg, rgba(255, 183, 213, 0.15) 0%, rgba(255, 143, 171, 0.1) 50%, rgba(200, 130, 255, 0.15) 100%),
        linear-gradient(180deg, #1a0a14 0%, #2d1520 30%, #1f0d18 100%);
    }
    
    &-overlay {
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(ellipse at 30% 20%, rgba(255, 183, 213, 0.12) 0%, transparent 55%),
        radial-gradient(ellipse at 75% 85%, rgba(200, 130, 255, 0.1) 0%, transparent 50%);
    }
  }
  
  &__layout {
    display: flex;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }
  
  &__sidebar {
    width: 80rpx;
    flex-shrink: 0;
    background: rgba(30, 12, 22, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-right: 2rpx solid rgba(255, 183, 213, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24rpx 0;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 10;
  }
  
  &__main {
    flex: 1;
    margin-left: 80rpx;
    margin-right: 340rpx;
    padding: 28rpx 32rpx 32rpx;
    min-height: 100vh;
    overflow-y: auto;
  }
  
  &__right {
    width: 340rpx;
    flex-shrink: 0;
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    padding: 28rpx 24rpx 32rpx;
    gap: 20rpx;
    z-index: 10;
  }
  
  &__announcement {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 2rpx solid rgba(255, 183, 213, 0.25);
    border-radius: 16rpx;
    padding: 20rpx 24rpx;
    margin-bottom: 24rpx;
  }
  
  &__content {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }
  
  &__modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32rpx;
  }
  
  &__modal-panel {
    background: rgba(30, 12, 22, 0.95);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 2rpx solid rgba(255, 183, 213, 0.25);
    border-radius: 20rpx;
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
    border-bottom: 2rpx solid rgba(255, 183, 213, 0.15);
  }
  
  &__modal-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #fff;
  }
  
  &__modal-close {
    font-size: 32rpx;
    color: rgba(255, 255, 255, 0.5);
    padding: 8rpx 16rpx;
  }
  
  &__modal-body {
    padding: 32rpx;
    overflow-y: auto;
  }
  
  &__modal-tip {
    display: block;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 16rpx;
    line-height: 1.6;
  }
  
  &__modal-cmd-box {
    background: rgba(0, 0, 0, 0.4);
    padding: 24rpx;
    border-radius: 12rpx;
    border: 2rpx solid rgba(255, 183, 213, 0.15);
    max-height: 360rpx;
    overflow-y: auto;
  }
  
  &__modal-cmd {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.7);
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

.sidebar-logo {
  font-size: 40rpx;
  margin-bottom: 24rpx;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 183, 213, 0.3), rgba(255, 143, 171, 0.3));
  border-radius: 16rpx;
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  width: 100%;
  align-items: center;
}

.sidebar-spacer {
  flex: 1;
}

.sidebar-item {
  width: 60rpx;
  height: 60rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &--active {
    background: linear-gradient(135deg, rgba(255, 183, 213, 0.35), rgba(255, 143, 171, 0.35));
    box-shadow: 0 4rpx 16rpx rgba(255, 143, 171, 0.3);
  }
  
  &__icon {
    font-size: 28rpx;
  }
  
  &--bottom {
    margin-top: auto;
  }
}

.announcement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.announcement__title {
  font-size: 26rpx;
  font-weight: 600;
  color: #ffb7d5;
}

.announcement__text {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

.announcement__close {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.4);
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.06);
}

.panel {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2rpx solid rgba(255, 183, 213, 0.2);
  border-radius: 18rpx;
  overflow: hidden;
  
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 24rpx;
    border-bottom: 2rpx solid rgba(255, 183, 213, 0.12);
  }
  
  &__title {
    font-size: 28rpx;
    font-weight: 600;
    color: #fff;
  }
  
  &__action {
    font-size: 22rpx;
    color: #ffb7d5;
  }
  
  &__body {
    padding: 20rpx 24rpx;
  }
  
  &__body--empty {
    padding: 60rpx 24rpx;
  }
  
  &__tabs {
    display: flex;
    padding: 0 16rpx;
    border-bottom: 2rpx solid rgba(255, 183, 213, 0.12);
    gap: 8rpx;
  }
  
  &__tab {
    padding: 18rpx 20rpx;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.5);
    position: relative;
    transition: all 0.2s;
    
    text {
      color: inherit;
    }
    
    &--active {
      color: #ffb7d5;
      font-weight: 600;
      
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 20rpx;
        right: 20rpx;
        height: 4rpx;
        background: linear-gradient(90deg, #ffb7d5, #ff8fab);
        border-radius: 2rpx;
      }
    }
  }
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.quick-tile {
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 183, 213, 0.15);
  border-radius: 14rpx;
  padding: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  transition: all 0.2s;
  
  &:active {
    background: rgba(255, 183, 213, 0.15);
    transform: scale(0.98);
  }
  
  &__icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 12rpx;
    background: linear-gradient(135deg, rgba(255, 183, 213, 0.3), rgba(255, 143, 171, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    flex-shrink: 0;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__label {
    display: block;
    font-size: 26rpx;
    color: #fff;
    font-weight: 600;
    margin-bottom: 4rpx;
  }
  
  &__sub {
    display: block;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.5);
  }
}

.download-item {
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 183, 213, 0.1);
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 12rpx;
  
  &:last-child { margin-bottom: 0; }
  
  &__head { display: flex; justify-content: space-between; margin-bottom: 10rpx; }
  &__name { font-size: 24rpx; color: #fff; font-weight: 500; }
  &__pct { font-size: 22rpx; color: #ffb7d5; font-weight: 600; }
  &__bar { height: 8rpx; background: rgba(255, 255, 255, 0.1); border-radius: 4rpx; overflow: hidden; }
  &__fill { height: 100%; background: linear-gradient(90deg, #ffb7d5, #ff8fab); border-radius: 4rpx; transition: width 0.3s; }
  &__sub { display: block; font-size: 20rpx; color: rgba(255, 255, 255, 0.4); margin-top: 8rpx; }
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 0;
  border-bottom: 2rpx solid rgba(255, 183, 213, 0.08);
  
  &:last-child { border-bottom: none; }
  
  &__main { flex: 1; min-width: 0; }
  &__label { font-size: 24rpx; color: rgba(255, 255, 255, 0.6); display: block; }
  &__value { font-size: 26rpx; color: #fff; font-weight: 500; display: block; margin-top: 4rpx; }
  &__arrow { font-size: 32rpx; color: rgba(255, 255, 255, 0.3); flex-shrink: 0; }
}

.player-card {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2rpx solid rgba(255, 183, 213, 0.2);
  border-radius: 18rpx;
  padding: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  
  &__avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    overflow: hidden;
    border: 3rpx solid rgba(255, 183, 213, 0.5);
    flex-shrink: 0;
    box-shadow: 0 4rpx 16rpx rgba(255, 143, 171, 0.3);
    
    image {
      width: 100%;
      height: 100%;
    }
  }
  
  &__avatar-placeholder {
    width: 100%;
    height: 100%;
    background: rgba(255, 183, 213, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36rpx;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 28rpx;
    font-weight: 600;
    color: #fff;
    margin-bottom: 4rpx;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  &__type {
    display: block;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.5);
  }
}

.launch-card {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2rpx solid rgba(255, 183, 213, 0.2);
  border-radius: 18rpx;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  flex: 1;
}

.launch-btn {
  margin-bottom: 4rpx !important;
}

.version-selector {
  display: flex;
  align-items: center;
  gap: 14rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 183, 213, 0.15);
  border-radius: 14rpx;
  padding: 14rpx 16rpx;
  
  &__icon {
    font-size: 32rpx;
    flex-shrink: 0;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 24rpx;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  &__type {
    display: block;
    font-size: 20rpx;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 2rpx;
  }
  
  &__arrow {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
}

.launch-links {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-top: 8rpx;
}

.launch-link {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.5);
  padding: 10rpx 4rpx;
  
  &:active {
    color: #ffb7d5;
  }
}
</style>
