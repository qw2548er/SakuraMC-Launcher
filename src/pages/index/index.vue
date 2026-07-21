<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAccountStore } from '@/stores/account'
import { useVersionStore } from '@/stores/version'
import { useServerStore } from '@/stores/server'
import { useSettingsStore } from '@/stores/settings'
import { useJavaStore } from '@/stores/java'
import McButton from '@/components/mc-button.vue'
import GameIcon from '@/components/game-icon.vue'
import UpdateModal from '@/components/update-modal.vue'
import LaunchProgress from '@/components/launch-progress.vue'
import OnboardingModal, { shouldShowOnboarding } from '@/components/onboarding-modal.vue'
import { formatBytes, formatTime } from '@/utils/format'
import { checkUpdate } from '@/utils/updater'
import { requestCorePermissions } from '@/utils/permissions'
import { isCordova, waitForReady } from '@/utils/cordova-fs'
import type { IAppUpdate } from '@/types'

const accountStore = useAccountStore()
const versionStore = useVersionStore()
const serverStore = useServerStore()
const settingsStore = useSettingsStore()
const javaStore = useJavaStore()

const showLaunchProgress = ref(false)
const showUpdateModal = ref(false)
const latestUpdate = ref<IAppUpdate | null>(null)
const showOnboarding = ref(false)
const showPlatformPanel = ref(false)
const selectedMcVersion = ref('')

const quickItems = [
  { id: 'versions', icon: '📦', label: '版本管理', badge: computed(() => Object.keys(versionStore.installed).length) },
  { id: 'mods', icon: '🧩', label: '模组管理', badge: null },
  { id: 'modpacks', icon: '📦', label: '整合包', badge: null },
  { id: 'resourcepacks', icon: '🎨', label: '资源包', badge: null },
  { id: 'shaders', icon: '✨', label: '光影', badge: null },
  { id: 'servers', icon: '🖥️', label: '服务器', badge: computed(() => serverStore.servers.filter(s => s.status === 'online').length) },
  { id: 'saves', icon: '🏝️', label: '存档管理', badge: null },
  { id: 'settings', icon: '⚙️', label: '设置', badge: null }
]

const platformTypes = [
  { type: 'forge', label: 'Forge', color: '#FF5722', icon: '🔥' },
  { type: 'fabric', label: 'Fabric', color: '#00BCD4', icon: '🧵' },
  { type: 'quilt', label: 'Quilt', color: '#9C27B0', icon: '🎀' },
  { type: 'neoforge', label: 'NeoForge', color: '#4CAF50', icon: '🌿' },
  { type: 'optifine', label: 'OptiFine', color: '#FFEB3B', icon: '🔮' }
]

onShow(() => {
  versionStore.load()
  if (!versionStore.manifest) versionStore.loadManifest()
  serverStore.pingAll()
})

onMounted(() => {
  if (shouldShowOnboarding()) {
    showOnboarding.value = true
  } else {
    if (isCordova()) {
      setTimeout(() => {
        waitForReady().then(() => {
          settingsStore.initAsync()
          requestCorePermissions().catch(() => {})
        }).catch(() => {})
      }, 1200)
    }
  }
  
  versionStore.load()
  versionStore.loadManifest()
  javaStore.load()
  settingsStore.load()
  setTimeout(() => checkUpdate().then(u => {
    if (u && u.version !== settingsStore.ignoredVersion) {
      latestUpdate.value = u
      showUpdateModal.value = true
    }
  }), 2000)
})

const selectedVersion = computed(() => versionStore.selected)
const selectedAccount = computed(() => accountStore.selected)
const activeDownloads = computed(() => versionStore.activeDownloads)
const selectedJava = computed(() => javaStore.selectedVersion)
const downloadSpeed = computed(() => {
  return activeDownloads.value.reduce((sum, d) => sum + (d.speed || 0), 0)
})

function navigateTo(id: string) {
  switch (id) {
    case 'versions':
      uni.navigateTo({ url: '/pages/versions/versions' })
      break
    case 'mods':
      uni.navigateTo({ url: '/pages/mods/mods' })
      break
    case 'modpacks':
      uni.navigateTo({ url: '/pages/modpacks/modpacks' })
      break
    case 'resourcepacks':
      uni.navigateTo({ url: '/pages/resourcepacks/resourcepacks' })
      break
    case 'shaders':
      uni.navigateTo({ url: '/pages/shaders/shaders' })
      break
    case 'servers':
      uni.navigateTo({ url: '/pages/servers/servers' })
      break
    case 'saves':
      uni.navigateTo({ url: '/pages/saves/saves' })
      break
    case 'settings':
      uni.navigateTo({ url: '/pages/settings/settings' })
      break
  }
}

function chooseAccount() {
  uni.navigateTo({ url: '/pages/accounts/accounts' })
}

function chooseVersion() {
  uni.navigateTo({ url: '/pages/versions/versions' })
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

function openPlatformPanel() {
  if (selectedVersion.value) {
    const parts = selectedVersion.value.id.split('-')
    selectedMcVersion.value = parts[0] || ''
  }
  showPlatformPanel.value = true
}

function installPlatform(type: string) {
  if (!selectedMcVersion.value) return
  
  versionStore.loadModLoaders(selectedMcVersion.value).then(() => {
    const loaders = versionStore.modLoaders[selectedMcVersion.value] || []
    const platformLoader = loaders.find(l => l.type === type)
    
    if (platformLoader) {
      versionStore.installPlatform(selectedMcVersion.value, type as any, platformLoader.version)
      showPlatformPanel.value = false
    } else {
      uni.showToast({ title: `未找到 ${type} 版本`, icon: 'none' })
    }
  })
}

function getPlatformBadge(version: any) {
  const badges = []
  if (version?.hasForge) badges.push({ text: 'Forge', color: '#FF5722' })
  if (version?.hasFabric) badges.push({ text: 'Fabric', color: '#00BCD4' })
  if (version?.hasOptifine) badges.push({ text: 'OptiFine', color: '#FFEB3B' })
  return badges
}

function ignoreUpdate() {
  if (latestUpdate.value) {
    settingsStore.update({ ignoredVersion: latestUpdate.value.version })
  }
  showUpdateModal.value = false
}
</script>

<template>
  <view class="launcher">
    <UpdateModal v-model:show="showUpdateModal" :update="latestUpdate" @ignore="ignoreUpdate" />
    <LaunchProgress v-if="showLaunchProgress" @close="showLaunchProgress = false" />
    <OnboardingModal v-if="showOnboarding" @close="showOnboarding = false" />
    
    <view class="launcher__bg">
      <view class="launcher__bg-gradient" />
      <view class="launcher__bg-noise" />
    </view>
    
    <view class="launcher__header">
      <view class="header__logo">
        <text class="logo__icon">🌸</text>
        <text class="logo__text">樱花 MC</text>
      </view>
      <view class="header__account" @tap="chooseAccount">
        <GameIcon v-if="selectedAccount" :uuid="selectedAccount.uuid" :size="40" variant="head" />
        <view v-else class="header__account-placeholder">
          <text>👤</text>
        </view>
      </view>
    </view>
    
    <scroll-view class="launcher__content" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="hero-card">
        <view class="hero-card__header">
          <view class="hero-card__version" @tap="chooseVersion">
            <view class="version__icon">⛏️</view>
            <view class="version__info">
              <text class="version__label">游戏版本</text>
              <text class="version__value">{{ selectedVersion?.id || '未选择版本' }}</text>
            </view>
            <text class="version__arrow">›</text>
          </view>
          <view 
            v-if="getPlatformBadge(selectedVersion).length > 0" 
            class="hero-card__platforms"
          >
            <view 
              v-for="badge in getPlatformBadge(selectedVersion)" 
              :key="badge.text" 
              class="platform-badge"
              :style="{ background: badge.color + '20', borderColor: badge.color + '40', color: badge.color }"
            >
              <text>{{ badge.text }}</text>
            </view>
          </view>
        </view>
        
        <McButton size="xl" glow block @click="startGame" class="hero-card__launch-btn">
          <text class="launch-btn__icon">▶</text>
          <text class="launch-btn__text">启动游戏</text>
        </McButton>
        
        <view class="hero-card__settings">
          <view class="setting-item" @tap="chooseAccount">
            <text class="setting-item__icon">👤</text>
            <text class="setting-item__label">账号</text>
            <text class="setting-item__value">{{ selectedAccount?.username || '未登录' }}</text>
          </view>
          <view class="setting-item" @tap="openPlatformPanel">
            <text class="setting-item__icon">🔧</text>
            <text class="setting-item__label">平台</text>
            <text class="setting-item__value">{{ getPlatformBadge(selectedVersion).length > 0 ? '已安装' : '安装平台' }}</text>
          </view>
          <view class="setting-item">
            <text class="setting-item__icon">☕</text>
            <text class="setting-item__label">Java</text>
            <text class="setting-item__value">{{ selectedJava?.name || '自动' }}</text>
          </view>
          <view class="setting-item">
            <text class="setting-item__icon">💾</text>
            <text class="setting-item__label">内存</text>
            <text class="setting-item__value">{{ settingsStore.maxMemory }} MB</text>
          </view>
        </view>
      </view>
      
      <view v-if="activeDownloads.length > 0" class="download-section">
        <view class="section-header">
          <text class="section-header__title">下载中</text>
          <text class="section-header__subtitle">{{ downloadSpeed > 0 ? formatBytes(downloadSpeed) + '/s' : '等待中' }}</text>
        </view>
        <view class="download-list">
          <view v-for="task in activeDownloads" :key="task.id" class="download-card">
            <view class="download-card__info">
              <text class="download-card__name">{{ task.name }}</text>
              <text class="download-card__progress-text">
                {{ formatBytes(task.downloaded) }} / {{ formatBytes(task.total) }}
                <text v-if="task.speed > 0">({{ formatBytes(task.speed) }}/s)</text>
              </text>
            </view>
            <view class="download-card__progress-bar">
              <view 
                class="progress-bar__fill" 
                :style="{ width: (task.downloaded / Math.max(task.total, 1) * 100) + '%' }"
              />
            </view>
            <view class="download-card__actions">
              <text class="download-card__percentage">{{ Math.floor(task.downloaded / Math.max(task.total, 1) * 100) }}%</text>
              <view class="download-card__cancel" @tap="versionStore.cancelTask(task.id)">
                <text>✕</text>
              </view>
            </view>
          </view>
        </view>
      </view>
      
      <view class="quick-section">
        <view class="section-header">
          <text class="section-header__title">快速访问</text>
        </view>
        <view class="quick-grid">
          <view 
            v-for="item in quickItems" 
            :key="item.id" 
            class="quick-item"
            @tap="navigateTo(item.id)"
          >
            <view class="quick-item__icon">
              <text>{{ item.icon }}</text>
              <view v-if="item.badge && typeof item.badge === 'number' && item.badge > 0" class="quick-item__badge">
                <text>{{ item.badge }}</text>
              </view>
            </view>
            <text class="quick-item__label">{{ item.label }}</text>
          </view>
        </view>
      </view>
      
      <view class="info-section">
        <view class="info-card">
          <view class="info-card__icon">📢</view>
          <view class="info-card__content">
            <text class="info-card__title">樱花 MC 启动器 v0.5.4</text>
            <text class="info-card__desc">支持 Forge / Fabric / Quilt / NeoForge / OptiFine 平台依赖</text>
          </view>
        </view>
      </view>
      
      <view class="footer-space" />
    </scroll-view>
    
    <view v-if="showPlatformPanel" class="platform-modal" @tap="showPlatformPanel = false">
      <view class="platform-modal__content" @tap.stop>
        <view class="platform-modal__header">
          <text class="platform-modal__title">安装平台依赖</text>
          <text class="platform-modal__subtitle">当前版本: {{ selectedMcVersion }}</text>
          <view class="platform-modal__close" @tap="showPlatformPanel = false">
            <text>✕</text>
          </view>
        </view>
        <view class="platform-modal__list">
          <view 
            v-for="platform in platformTypes" 
            :key="platform.type"
            class="platform-item"
            @tap="installPlatform(platform.type)"
          >
            <view class="platform-item__icon" :style="{ background: platform.color + '20' }">
              <text>{{ platform.icon }}</text>
            </view>
            <view class="platform-item__info">
              <text class="platform-item__name">{{ platform.label }}</text>
              <text class="platform-item__desc">为 {{ selectedMcVersion }} 安装 {{ platform.label }}</text>
            </view>
            <view class="platform-item__arrow">
              <text>›</text>
            </view>
          </view>
        </view>
        <view class="platform-modal__tips">
          <text>💡 提示：部分平台可能需要先安装基础游戏版本</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.launcher {
  min-height: 100vh;
  background: #0d0d14;
  position: relative;
  overflow: hidden;
  
  &__bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    
    &-gradient {
      position: absolute;
      inset: 0;
      background: 
        linear-gradient(180deg, #1a0a14 0%, #2d1520 40%, #1f0d18 100%);
    }
    
    &-noise {
      position: absolute;
      inset: 0;
      opacity: 0.03;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    }
  }
  
  &__header {
    position: relative;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 60px 24px 20px;
    background: linear-gradient(180deg, rgba(13, 13, 20, 0.9) 0%, transparent 100%);
  }
  
  &__content {
    position: relative;
    z-index: 10;
    padding: 0 20px;
    height: calc(100vh - 100px);
  }
}

.header {
  &__logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  &__account {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255, 183, 213, 0.4);
    box-shadow: 0 2px 12px rgba(255, 143, 171, 0.2);
    
    image {
      width: 100%;
      height: 100%;
    }
  }
  
  &__account-placeholder {
    width: 100%;
    height: 100%;
    background: rgba(255, 183, 213, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
}

.logo {
  &__icon {
    font-size: 28px;
  }
  
  &__text {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 1px;
  }
}

.hero-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 183, 213, 0.15);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
  
  &__header {
    margin-bottom: 20px;
  }
  
  &__version {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 12px;
    margin-bottom: 12px;
  }
  
  &__platforms {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  &__launch-btn {
    margin-bottom: 16px;
    height: 56px;
    
    &::before {
      background: linear-gradient(135deg, #ff8fab, #ffb7d5);
    }
  }
  
  &__settings {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}

.version {
  &__icon {
    font-size: 24px;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__label {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 2px;
  }
  
  &__value {
    display: block;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  &__arrow {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.3);
  }
}

.platform-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid;
  
  text {
    font-size: 11px;
    font-weight: 600;
  }
}

.launch-btn {
  &__icon {
    font-size: 18px;
    margin-right: 8px;
  }
  
  &__text {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }
}

.setting-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  
  &__icon {
    font-size: 18px;
    margin-bottom: 4px;
  }
  
  &__label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 2px;
  }
  
  &__value {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  
  &__title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }
  
  &__subtitle {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
}

.download-section {
  margin-bottom: 20px;
}

.download-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.download-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 183, 213, 0.1);
  border-radius: 14px;
  padding: 14px;
  
  &__info {
    margin-bottom: 10px;
  }
  
  &__name {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 4px;
  }
  
  &__progress-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
    
    text {
      color: #ffb7d5;
    }
  }
  
  &__progress-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 10px;
  }
  
  &__actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  &__percentage {
    font-size: 12px;
    font-weight: 600;
    color: #ffb7d5;
  }
  
  &__cancel {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    
    text {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    }
  }
}

.progress-bar {
  &__fill {
    height: 100%;
    background: linear-gradient(90deg, #ff8fab, #ffb7d5);
    border-radius: 3px;
    transition: width 0.3s ease;
  }
}

.quick-section {
  margin-bottom: 20px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 183, 213, 0.1);
  border-radius: 14px;
  transition: all 0.2s ease;
  
  &:active {
    background: rgba(255, 183, 213, 0.1);
    border-color: rgba(255, 183, 213, 0.3);
    transform: scale(0.96);
  }
  
  &__icon {
    position: relative;
    font-size: 26px;
    margin-bottom: 8px;
  }
  
  &__badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: linear-gradient(135deg, #ff8fab, #ffb7d5);
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    text {
      font-size: 10px;
      font-weight: 700;
      color: #fff;
    }
  }
  
  &__label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  }
}

.info-section {
  margin-bottom: 20px;
}

.info-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 183, 213, 0.08);
  border: 1px solid rgba(255, 183, 213, 0.15);
  border-radius: 14px;
  
  &__icon {
    font-size: 20px;
    flex-shrink: 0;
  }
  
  &__content {
    flex: 1;
  }
  
  &__title {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #ffb7d5;
    margin-bottom: 4px;
  }
  
  &__desc {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.5;
  }
}

.footer-space {
  height: 40px;
}

.platform-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  
  &__content {
    width: 100%;
    max-height: 80vh;
    background: linear-gradient(180deg, #1a0a14, #130810);
    border-radius: 24px 24px 0 0;
    padding: 24px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
    overflow-y: auto;
  }
  
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  
  &__title {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }
  
  &__subtitle {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    margin-left: 8px;
  }
  
  &__close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    
    text {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.5);
    }
  }
  
  &__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }
  
  &__tips {
    padding: 14px;
    background: rgba(255, 183, 213, 0.08);
    border-radius: 10px;
    
    text {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.6;
    }
  }
}

.platform-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 183, 213, 0.1);
  border-radius: 14px;
  transition: all 0.2s ease;
  
  &:active {
    background: rgba(255, 183, 213, 0.1);
    border-color: rgba(255, 183, 213, 0.3);
  }
  
  &__icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 2px;
  }
  
  &__desc {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.4;
  }
  
  &__arrow {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.3);
  }
}
</style>