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
import UpdateModal from '@/components/update-modal.vue'
import LaunchProgress from '@/components/launch-progress.vue'
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
const showLaunchProgress = ref(false)
const showUpdateModal = ref(false)
const latestUpdate = ref<IAppUpdate | null>(null)
const showAnnouncement = ref(true)

const navItems = [
  { id: 'home', icon: '🏠', label: '首页' },
  { id: 'account', icon: '👤', label: '账号' },
  { id: 'version', icon: '📦', label: '版本' },
  { id: 'mods', icon: '🧩', label: '模组' },
  { id: 'server', icon: '🖥️', label: '服务器' },
  { id: 'frp', icon: '🌐', label: '穿透' },
  { id: 'controls', icon: '⌨️', label: '按键' },
  { id: 'settings', icon: '⚙️', label: '设置' }
]

const tabs = [
  { id: 'game', label: '游戏设置' },
  { id: 'version', label: '管理版本' },
  { id: 'auto', label: '自动安装' },
  { id: 'custom', label: '自定义' }
]

onShow(() => {
  versionStore.load()
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
    case 'version':
      uni.navigateTo({ url: '/pages/versions/versions' })
      break
    case 'mods':
      uni.navigateTo({ url: '/pages/mods/mods' })
      break
    case 'server':
      uni.navigateTo({ url: '/pages/servers/servers' })
      break
    case 'frp':
      uni.navigateTo({ url: '/pages/frp/frp' })
      break
    case 'account':
      uni.navigateTo({ url: '/pages/accounts/accounts' })
      break
    case 'settings':
      uni.navigateTo({ url: '/pages/settings/settings' })
      break
    case 'controls':
      uni.navigateTo({ url: '/pages/controls/controls' })
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
  uni.navigateTo({ url: '/pages/frp/frp' })
}
function openSettings() {
  activeNav.value = 'home'
  activeTab.value = 'game'
}
function openMods() {
  uni.navigateTo({ url: '/pages/mods/mods' })
}
function openSaves() {
  uni.navigateTo({ url: '/pages/saves/saves' })
}
function openLogs() {
  uni.navigateTo({ url: '/pages/logs/logs' })
}
function openScreenshots() {
  uni.navigateTo({ url: '/pages/screenshots/screenshots' })
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
  showLaunchProgress.value = true
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
  versionStore.load()
  versionStore.loadManifest()
  javaStore.load()
  settingsStore.load()
  setTimeout(doCheckUpdate, 2000)
})
</script>

<template>
  <view class="home">
    <UpdateModal v-model:show="showUpdateModal" :update="latestUpdate" @ignore="ignoreUpdate" />
    <LaunchProgress v-if="showLaunchProgress" @close="showLaunchProgress = false" />
    
    <view class="home__bg">
      <view class="home__bg-image" />
      <view class="home__bg-vignette" />
    </view>
    
    <view class="home__layout">
      <view class="home__sidebar">
        <view class="sidebar-logo">
          <text class="sidebar-logo__icon">🌸</text>
        </view>
        
        <view class="sidebar-divider" />
        
        <view class="sidebar-list">
          <view
            v-for="item in navItems"
            :key="item.id"
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeNav === item.id }"
            @tap="navigateTo(item.id)"
          >
            <text class="sidebar-item__icon">{{ item.icon }}</text>
            <view v-if="activeNav === item.id" class="sidebar-item__tooltip">
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>
      </view>
      
      <view class="home__main">
        <view v-if="showAnnouncement" class="home__announcement">
          <view class="announcement__icon">📢</view>
          <view class="announcement__content">
            <text class="announcement__title">关于 v0.2.x</text>
            <text class="announcement__text">全新界面设计，内置 Java 运行环境，新增樱花穿透功能</text>
          </view>
          <view class="announcement__close" @tap="showAnnouncement = false">✕</view>
        </view>
        
        <view class="home__content">
          <view class="panel">
            <view class="panel__header">
              <text class="panel__title">快速访问</text>
            </view>
            <view class="panel__body">
              <view class="quick-grid">
                <view class="quick-card" @tap="chooseAccount">
                  <view class="quick-card__icon">👤</view>
                  <view class="quick-card__info">
                    <text class="quick-card__label">账号管理</text>
                    <text class="quick-card__value">{{ accountStore.accounts.length }} 个账号</text>
                  </view>
                  <text class="quick-card__arrow">›</text>
                </view>
                <view class="quick-card" @tap="chooseVersion">
                  <view class="quick-card__icon">📦</view>
                  <view class="quick-card__info">
                    <text class="quick-card__label">版本管理</text>
                    <text class="quick-card__value">{{ Object.keys(versionStore.installed).length }} 已安装</text>
                  </view>
                  <text class="quick-card__arrow">›</text>
                </view>
                <view class="quick-card" @tap="openMods">
                  <view class="quick-card__icon">🧩</view>
                  <view class="quick-card__info">
                    <text class="quick-card__label">模组管理</text>
                    <text class="quick-card__value">Mods & 整合包</text>
                  </view>
                  <text class="quick-card__arrow">›</text>
                </view>
                <view class="quick-card" @tap="openFrp">
                  <view class="quick-card__icon">🌐</view>
                  <view class="quick-card__info">
                    <text class="quick-card__label">樱花穿透</text>
                    <text class="quick-card__value">{{ frpStatus }}</text>
                  </view>
                  <text class="quick-card__arrow">›</text>
                </view>
                <view class="quick-card" @tap="openSaves">
                  <view class="quick-card__icon">🏝️</view>
                  <view class="quick-card__info">
                    <text class="quick-card__label">存档管理</text>
                    <text class="quick-card__value">备份 & 恢复</text>
                  </view>
                  <text class="quick-card__arrow">›</text>
                </view>
                <view class="quick-card" @tap="openLogs">
                  <view class="quick-card__icon">📝</view>
                  <view class="quick-card__info">
                    <text class="quick-card__label">日志查看器</text>
                    <text class="quick-card__value">启动日志 & 错误</text>
                  </view>
                  <text class="quick-card__arrow">›</text>
                </view>
                <view class="quick-card" @tap="openScreenshots">
                  <view class="quick-card__icon">📷</view>
                  <view class="quick-card__info">
                    <text class="quick-card__label">截图浏览</text>
                    <text class="quick-card__value">浏览游戏截图</text>
                  </view>
                  <text class="quick-card__arrow">›</text>
                </view>
              </view>
            </view>
          </view>
          
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
              <view class="setting-list">
                <view class="setting-item" @tap="chooseAccount">
                  <view class="setting-item__icon">👤</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">当前账号</text>
                    <text class="setting-item__value">{{ selectedAccount?.username || '未设置' }}</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
                <view class="setting-item" @tap="chooseVersion">
                  <view class="setting-item__icon">⛏️</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">游戏版本</text>
                    <text class="setting-item__value">{{ selectedVersion?.id || '未选择' }}</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
                <view class="setting-item" @tap="openSettings">
                  <view class="setting-item__icon">☕</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">Java 路径</text>
                    <text class="setting-item__value">{{ selectedJava?.name || '自动选择' }}</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
                <view class="setting-item">
                  <view class="setting-item__icon">💾</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">最大内存</text>
                    <text class="setting-item__value">{{ settingsStore.maxMemory }} MB</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
                <view class="setting-item">
                  <view class="setting-item__icon">📐</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">窗口大小</text>
                    <text class="setting-item__value">854 × 480</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
              </view>
            </view>
            
            <view v-else-if="activeTab === 'version'" class="panel__body">
              <view class="setting-list">
                <view class="setting-item" @tap="chooseVersion">
                  <view class="setting-item__icon">📋</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">已安装版本</text>
                    <text class="setting-item__value">{{ Object.keys(versionStore.installed).length }} 个</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
                <view class="setting-item" @tap="chooseVersion">
                  <view class="setting-item__icon">⬇️</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">下载新版本</text>
                    <text class="setting-item__value">从官方源下载</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
                <view class="setting-item">
                  <view class="setting-item__icon">🔬</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">显示快照版本</text>
                  </view>
                  <switch :checked="settingsStore.showSnapshots" color="#ff8fab" style="transform: scale(0.7)" />
                </view>
              </view>
            </view>
            
            <view v-else-if="activeTab === 'auto'" class="panel__body">
              <view class="setting-list">
                <view class="setting-item">
                  <view class="setting-item__icon">🔩</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">自动安装 Forge</text>
                    <text class="setting-item__value">安装版本后自动安装</text>
                  </view>
                </view>
                <view class="setting-item">
                  <view class="setting-item__icon">🧵</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">自动安装 Fabric</text>
                    <text class="setting-item__value">安装版本后自动安装</text>
                  </view>
                </view>
                <view class="setting-item">
                  <view class="setting-item__icon">🎀</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">自动安装 OptiFine</text>
                    <text class="setting-item__value">安装版本后自动安装</text>
                  </view>
                </view>
              </view>
            </view>
            
            <view v-else class="panel__body">
              <view class="setting-list">
                <view class="setting-item" @tap="openSettings">
                  <view class="setting-item__icon">🎨</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">主题</text>
                    <text class="setting-item__value">樱花粉</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
                <view class="setting-item">
                  <view class="setting-item__icon">🔄</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">自动检查更新</text>
                  </view>
                  <switch :checked="settingsStore.autoCheckUpdate" color="#ff8fab" style="transform: scale(0.7)" />
                </view>
                <view class="setting-item" @tap="openSettings">
                  <view class="setting-item__icon">📁</view>
                  <view class="setting-item__main">
                    <text class="setting-item__label">游戏目录</text>
                    <text class="setting-item__value">{{ settingsStore.gameDir || '默认' }}</text>
                  </view>
                  <text class="setting-item__arrow">›</text>
                </view>
              </view>
            </view>
          </view>
          
          <view v-if="activeDownloads.length" class="panel">
            <view class="panel__header">
              <text class="panel__title">下载任务</text>
              <text class="panel__badge">{{ activeDownloads.length }}</text>
            </view>
            <view class="panel__body">
              <view v-for="d in activeDownloads" :key="d.id" class="download-item">
                <view class="download-item__info">
                  <text class="download-item__name">{{ d.name }}</text>
                  <text class="download-item__size">{{ formatBytes(d.downloaded) }} / {{ formatBytes(d.total) }}</text>
                </view>
                <view class="download-item__progress">
                  <view class="download-item__bar">
                    <view class="download-item__fill" :style="{ width: (d.downloaded / Math.max(d.total, 1) * 100) + '%' }" />
                  </view>
                  <text class="download-item__pct">{{ Math.floor(d.downloaded / Math.max(d.total, 1) * 100) }}%</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
      
      <view class="home__right">
        <view class="user-card">
          <view class="user-card__avatar" @tap="chooseAccount">
            <GameIcon v-if="selectedAccount" :uuid="selectedAccount.uuid" :size="120" variant="head" />
            <view v-else class="user-card__avatar-placeholder">
              <text>👤</text>
            </view>
          </view>
          <view class="user-card__info">
            <text class="user-card__name">{{ selectedAccount?.username || '微软账户' }}</text>
            <text class="user-card__type" @tap="chooseAccount">点击切换账号 →</text>
          </view>
        </view>
        
        <view class="launch-card">
          <McButton size="xl" glow block @click="startGame" class="launch-btn">
            <text class="launch-btn__text">启动游戏</text>
          </McButton>
          
          <view class="version-row" @tap="chooseVersion">
            <view class="version-row__icon">⛏️</view>
            <view class="version-row__main">
              <text class="version-row__name">{{ selectedVersion?.id || '未选择版本' }}</text>
              <text class="version-row__type">{{ selectedVersion?.type || '点击选择游戏版本' }}</text>
            </view>
            <text class="version-row__arrow">›</text>
          </view>
          
          <view class="launch-divider" />
          
          <view class="launch-links">
            <view class="launch-link" @tap="chooseVersion">
              <text class="launch-link__icon">📦</text>
              <text class="launch-link__text">管理版本</text>
            </view>
            <view class="launch-link" @tap="openMods">
              <text class="launch-link__icon">🧩</text>
              <text class="launch-link__text">模组管理</text>
            </view>
            <view class="launch-link" @tap="openServer">
              <text class="launch-link__icon">🖥️</text>
              <text class="launch-link__text">服务器</text>
            </view>
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
        linear-gradient(180deg, #1a0a14 0%, #2d1520 40%, #1f0d18 100%);
    }
    
    &-vignette {
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255, 183, 213, 0.08) 0%, transparent 70%),
        radial-gradient(ellipse 60% 40% at 80% 100%, rgba(200, 130, 255, 0.06) 0%, transparent 70%);
    }
  }
  
  &__layout {
    display: flex;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }
  
  &__sidebar {
    width: 72px;
    flex-shrink: 0;
    background: rgba(20, 8, 15, 0.8);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-right: 1px solid rgba(255, 183, 213, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 10;
  }
  
  &__main {
    flex: 1;
    margin-left: 72px;
    margin-right: 320px;
    padding: 24px 28px 28px;
    min-height: 100vh;
    overflow-y: auto;
  }
  
  &__right {
    width: 320px;
    flex-shrink: 0;
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    padding: 24px 20px 24px;
    gap: 16px;
    z-index: 10;
  }
  
  &__announcement {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 183, 213, 0.1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 183, 213, 0.2);
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 20px;
  }
  
  &__content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  &__modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  
  &__modal-panel {
    background: rgba(30, 12, 22, 0.95);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid rgba(255, 183, 213, 0.2);
    border-radius: 16px;
    max-width: 560px;
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
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 183, 213, 0.1);
  }
  
  &__modal-title {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }
  
  &__modal-close {
    font-size: 18px;
    color: rgba(255, 255, 255, 0.4);
    padding: 4px 10px;
    cursor: pointer;
  }
  
  &__modal-body {
    padding: 24px;
    overflow-y: auto;
  }
  
  &__modal-tip {
    display: block;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 14px;
    line-height: 1.6;
  }
  
  &__modal-cmd-box {
    background: rgba(0, 0, 0, 0.4);
    padding: 18px;
    border-radius: 10px;
    border: 1px solid rgba(255, 183, 213, 0.12);
    max-height: 280px;
    overflow-y: auto;
  }
  
  &__modal-cmd {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.65);
    font-family: monospace;
    word-break: break-all;
    line-height: 1.7;
  }
  
  &__modal-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 20px;
  }
}

.sidebar-logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 183, 213, 0.25), rgba(255, 143, 171, 0.25));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  
  &__icon {
    font-size: 24px;
  }
}

.sidebar-divider {
  width: 32px;
  height: 1px;
  background: rgba(255, 183, 213, 0.15);
  margin: 8px 0;
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  align-items: center;
  padding-top: 4px;
}

.sidebar-spacer {
  flex: 1;
}

.sidebar-item {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
  
  &:active {
    transform: scale(0.95);
  }
  
  &--active {
    background: linear-gradient(135deg, rgba(255, 183, 213, 0.3), rgba(255, 143, 171, 0.3));
    box-shadow: 0 2px 12px rgba(255, 143, 171, 0.25);
    
    .sidebar-item__icon {
      transform: scale(1.1);
    }
  }
  
  &__icon {
    font-size: 20px;
    transition: transform 0.2s ease;
  }
  
  &__tooltip {
    position: absolute;
    left: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: rgba(30, 12, 22, 0.95);
    border: 1px solid rgba(255, 183, 213, 0.2);
    border-radius: 8px;
    padding: 6px 12px;
    white-space: nowrap;
    z-index: 100;
    
    text {
      font-size: 12px;
      color: #fff;
    }
    
    &::before {
      content: '';
      position: absolute;
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      border: 5px solid transparent;
      border-right-color: rgba(255, 183, 213, 0.2);
    }
  }
}

.announcement {
  &__icon {
    font-size: 20px;
    flex-shrink: 0;
  }
  
  &__content {
    flex: 1;
    min-width: 0;
  }
  
  &__title {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #ffb7d5;
    margin-bottom: 2px;
  }
  
  &__text {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
  }
  
  &__close {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.35);
    padding: 4px 8px;
    flex-shrink: 0;
    cursor: pointer;
  }
}

.panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 183, 213, 0.15);
  border-radius: 14px;
  overflow: hidden;
  
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 183, 213, 0.08);
  }
  
  &__title {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
  }
  
  &__badge {
    font-size: 12px;
    color: #fff;
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    padding: 2px 10px;
    border-radius: 20px;
    font-weight: 600;
  }
  
  &__body {
    padding: 16px 20px;
  }
  
  &__body--empty {
    padding: 48px 20px;
  }
  
  &__tabs {
    display: flex;
    padding: 0 12px;
    border-bottom: 1px solid rgba(255, 183, 213, 0.08);
    gap: 4px;
  }
  
  &__tab {
    padding: 14px 16px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.45);
    position: relative;
    transition: all 0.2s ease;
    cursor: pointer;
    
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
        left: 16px;
        right: 16px;
        height: 2px;
        background: linear-gradient(90deg, #ffb7d5, #ff8fab);
        border-radius: 2px;
      }
    }
  }
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.quick-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 183, 213, 0.1);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
  
  &:active {
    background: rgba(255, 183, 213, 0.1);
    border-color: rgba(255, 183, 213, 0.25);
    transform: scale(0.98);
  }
  
  &__icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(255, 183, 213, 0.25), rgba(255, 143, 171, 0.25));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__label {
    display: block;
    font-size: 14px;
    color: #fff;
    font-weight: 600;
    margin-bottom: 2px;
  }
  
  &__value {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
  }
  
  &__arrow {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.25);
    flex-shrink: 0;
  }
}

.setting-list {
  display: flex;
  flex-direction: column;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255, 183, 213, 0.06);
  
  &:last-child {
    border-bottom: none;
  }
  
  &__icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 183, 213, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }
  
  &__main {
    flex: 1;
    min-width: 0;
  }
  
  &__label {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    display: block;
  }
  
  &__value {
    font-size: 14px;
    color: #fff;
    font-weight: 500;
    display: block;
    margin-top: 2px;
  }
  
  &__arrow {
    font-size: 22px;
    color: rgba(255, 255, 255, 0.25);
    flex-shrink: 0;
  }
}

.download-item {
  margin-bottom: 14px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  &__info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  &__name {
    font-size: 13px;
    color: #fff;
    font-weight: 500;
  }
  
  &__size {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
  
  &__progress {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  &__bar {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }
  
  &__fill {
    height: 100%;
    background: linear-gradient(90deg, #ffb7d5, #ff8fab);
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  
  &__pct {
    font-size: 12px;
    color: #ffb7d5;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 40px;
    text-align: right;
  }
}

.user-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 183, 213, 0.15);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  
  &__avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255, 183, 213, 0.5);
    flex-shrink: 0;
    box-shadow: 0 2px 12px rgba(255, 143, 171, 0.25);
    
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
    font-size: 28px;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  &__type {
    display: block;
    font-size: 12px;
    color: #ffb7d5;
    opacity: 0.8;
  }
}

.launch-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 183, 213, 0.15);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}

.launch-btn {
  width: 100% !important;
  
  &__text {
    font-size: 18px;
    font-weight: 700;
  }
}

.version-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 183, 213, 0.12);
  border-radius: 10px;
  padding: 12px 14px;
  
  &__icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  
  &__main {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  &__type {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
    margin-top: 1px;
  }
  
  &__arrow {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
}

.launch-divider {
  height: 1px;
  background: rgba(255, 183, 213, 0.1);
  margin: 4px 0;
}

.launch-links {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.launch-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:active {
    background: rgba(255, 183, 213, 0.1);
  }
  
  &__icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }
  
  &__text {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
  }
}
</style>
