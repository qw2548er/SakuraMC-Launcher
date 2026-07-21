<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVersionStore } from '@/stores/version'
import { useSettingsStore } from '@/stores/settings'
import { formatBytes, formatTime } from '@/utils/format'

interface ShaderPack {
  id: string
  name: string
  version: string
  description: string
  author: string
  downloads: number
  url: string
  size: number
  platform: 'optifine' | 'iris' | 'both'
  installed: boolean
  enabled: boolean
}

const versionStore = useVersionStore()
const settingsStore = useSettingsStore()

const activeTab = ref('market')
const shaderPacks = ref<ShaderPack[]>([])
const installedPacks = ref<ShaderPack[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedPlatform = ref<'all' | 'optifine' | 'iris'>('all')

const tabs = [
  { id: 'market', label: '光影商店' },
  { id: 'installed', label: '已安装' }
]

const platforms = [
  { id: 'all', label: '全部' },
  { id: 'optifine', label: 'OptiFine' },
  { id: 'iris', label: 'Iris' }
]

const filteredPacks = computed(() => {
  let result = shaderPacks.value
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.description.toLowerCase().includes(query)
    )
  }
  
  if (selectedPlatform.value !== 'all') {
    result = result.filter(p => p.platform === selectedPlatform.value || p.platform === 'both')
  }
  
  return result
})

const popularShaders: ShaderPack[] = [
  { id: '1', name: 'SEUS PTGI', version: '1.21', description: '高端光线追踪光影，极致画质', author: 'Sonic Ether', downloads: 8500000, url: '', size: 128, platform: 'optifine', installed: false, enabled: false },
  { id: '2', name: 'BSL Shaders', version: '1.21', description: '平衡型光影，性能与画质兼顾', author: 'BSL Team', downloads: 15200000, url: '', size: 45, platform: 'both', installed: false, enabled: false },
  { id: '3', name: 'Complementary Shaders', version: '1.21', description: '互补光影，自然真实效果', author: 'Complementary', downloads: 6800000, url: '', size: 38, platform: 'both', installed: false, enabled: false },
  { id: '4', name: 'Sildur\'s Vibrant', version: '1.20.1', description: '鲜艳色彩光影，增强视觉效果', author: 'Sildur', downloads: 9300000, url: '', size: 56, platform: 'both', installed: false, enabled: false },
  { id: '5', name: 'Chocapic13', version: '1.20.1', description: '经典光影，柔和自然效果', author: 'Chocapic13', downloads: 4100000, url: '', size: 32, platform: 'both', installed: false, enabled: false },
  { id: '6', name: 'Kuda Shaders', version: '1.20.1', description: '高性能光影，低配也能流畅运行', author: 'Kuda', downloads: 7600000, url: '', size: 24, platform: 'optifine', installed: false, enabled: false },
  { id: '7', name: 'Ebin', version: '1.20.1', description: '简约风格光影，自然明亮', author: 'Ebin', downloads: 2800000, url: '', size: 18, platform: 'iris', installed: false, enabled: false },
  { id: '8', name: 'ProjectLUMA', version: '1.20.1', description: '电影级光影，极致氛围', author: 'LUMA Team', downloads: 3500000, url: '', size: 72, platform: 'both', installed: false, enabled: false }
]

onMounted(() => {
  shaderPacks.value = popularShaders
  loadInstalledPacks()
})

function loadInstalledPacks() {
  installedPacks.value = shaderPacks.value.filter(p => p.installed)
}

function togglePack(pack: ShaderPack) {
  pack.enabled = !pack.enabled
  uni.showToast({ title: pack.enabled ? '已启用' : '已禁用', icon: 'none' })
}

function installPack(pack: ShaderPack) {
  if (pack.platform === 'optifine' && !settingsStore.hasOptifine) {
    uni.showToast({ title: '需要先安装 OptiFine', icon: 'none' })
    return
  }
  
  if (pack.platform === 'iris' && !settingsStore.hasIris) {
    uni.showToast({ title: '需要先安装 Iris', icon: 'none' })
    return
  }
  
  uni.showToast({ title: `开始下载 ${pack.name}`, icon: 'none' })
  
  const task = versionStore.addDownload({
    name: `光影 - ${pack.name}`,
    url: pack.url,
    total: pack.size * 1024 * 1024,
    downloaded: 0,
    status: 'downloading'
  })
  
  pack.installed = true
  loadInstalledPacks()
  
  setTimeout(() => {
    versionStore.updateDownload(task.id, { status: 'completed', downloaded: pack.size * 1024 * 1024 })
    uni.showToast({ title: `${pack.name} 下载完成`, icon: 'success' })
  }, 2000)
}

function uninstallPack(pack: ShaderPack) {
  pack.installed = false
  pack.enabled = false
  loadInstalledPacks()
  uni.showToast({ title: '已卸载', icon: 'none' })
}

function getPlatformBadge(platform: string) {
  switch (platform) {
    case 'optifine': return { text: 'OptiFine', color: '#FFEB3B' }
    case 'iris': return { text: 'Iris', color: '#9C27B0' }
    default: return { text: '通用', color: '#4CAF50' }
  }
}

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <view class="page">
    <view class="page__bg">
      <view class="page__bg-gradient" />
    </view>
    
    <view class="page__header">
      <view class="header__back" @tap="goBack">
        <text>‹</text>
      </view>
      <text class="header__title">光影管理</text>
      <view class="header__placeholder" />
    </view>
    
    <view class="page__tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.id" 
        class="page__tab"
        :class="{ 'page__tab--active': activeTab === tab.id }"
        @tap="activeTab = tab.id"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>
    
    <view class="page__search">
      <view class="search-box">
        <text class="search-box__icon">🔍</text>
        <input 
          class="search-box__input" 
          v-model="searchQuery" 
          placeholder="搜索光影..." 
          placeholder-class="search-box__placeholder"
        />
      </view>
    </view>
    
    <view v-if="activeTab === 'market'" class="page__filters">
      <view class="filter-row">
        <view 
          v-for="platform in platforms" 
          :key="platform.id"
          class="filter-chip"
          :class="{ 'filter-chip--active': selectedPlatform === platform.id }"
          @tap="selectedPlatform = platform.id as any"
        >
          <text>{{ platform.label }}</text>
        </view>
      </view>
    </view>
    
    <scroll-view class="page__content" scroll-y :enhanced="true" :show-scrollbar="false">
      <view v-if="activeTab === 'market'" class="packs-grid">
        <view 
          v-for="pack in filteredPacks" 
          :key="pack.id" 
          class="pack-card"
        >
          <view class="pack-card__image">
            <view class="pack-card__image-placeholder">
              <text>✨</text>
            </view>
          </view>
          <view class="pack-card__info">
            <view class="pack-card__header">
              <text class="pack-card__name">{{ pack.name }}</text>
              <view 
                class="pack-card__platform"
                :style="{ background: getPlatformBadge(pack.platform).color + '20', color: getPlatformBadge(pack.platform).color }"
              >
                <text>{{ getPlatformBadge(pack.platform).text }}</text>
              </view>
            </view>
            <text class="pack-card__version">{{ pack.version }}</text>
            <text class="pack-card__desc">{{ pack.description }}</text>
            <view class="pack-card__meta">
              <text class="pack-card__author">{{ pack.author }}</text>
              <text class="pack-card__downloads">{{ (pack.downloads / 10000).toFixed(0) }}万下载</text>
            </view>
          </view>
          <view class="pack-card__actions">
            <McButton 
              v-if="!pack.installed" 
              size="sm" 
              @click="installPack(pack)"
              class="pack-card__btn"
            >
              <text>下载</text>
            </McButton>
            <view v-else class="pack-card__installed">
              <text>已安装</text>
            </view>
          </view>
        </view>
      </view>
      
      <view v-else class="installed-list">
        <view 
          v-for="pack in installedPacks" 
          :key="pack.id" 
          class="installed-item"
        >
          <view class="installed-item__icon">
            <text>✨</text>
          </view>
          <view class="installed-item__info">
            <view class="installed-item__header">
              <text class="installed-item__name">{{ pack.name }}</text>
              <view 
                class="installed-item__platform"
                :style="{ background: getPlatformBadge(pack.platform).color + '20', color: getPlatformBadge(pack.platform).color }"
              >
                <text>{{ getPlatformBadge(pack.platform).text }}</text>
              </view>
            </view>
            <text class="installed-item__version">{{ pack.version }}</text>
          </view>
          <switch 
            :checked="pack.enabled" 
            color="#ff8fab" 
            @change="togglePack(pack)"
          />
          <view class="installed-item__uninstall" @tap="uninstallPack(pack)">
            <text>删除</text>
          </view>
        </view>
        
        <view v-if="installedPacks.length === 0" class="empty-state">
          <text class="empty-state__icon">✨</text>
          <text class="empty-state__text">暂无已安装的光影</text>
          <text class="empty-state__hint">去光影商店下载一些吧</text>
        </view>
      </view>
      
      <view class="footer-space" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #0d0d14;
  position: relative;
  
  &__bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    
    &-gradient {
      background: linear-gradient(180deg, #1a0a14 0%, #2d1520 40%, #1f0d18 100%);
    }
  }
  
  &__header {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 60px 20px 16px;
  }
  
  &__tabs {
    position: relative;
    z-index: 10;
    display: flex;
    padding: 0 20px;
    gap: 4px;
    margin-bottom: 16px;
  }
  
  &__tab {
    flex: 1;
    padding: 12px;
    text-align: center;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.45);
    border-radius: 10px;
    transition: all 0.2s ease;
    
    text {
      color: inherit;
    }
    
    &--active {
      background: rgba(255, 183, 213, 0.15);
      color: #ffb7d5;
      font-weight: 600;
    }
  }
  
  &__search {
    position: relative;
    z-index: 10;
    padding: 0 20px;
    margin-bottom: 16px;
  }
  
  &__filters {
    position: relative;
    z-index: 10;
    padding: 0 20px;
    margin-bottom: 20px;
  }
  
  &__content {
    position: relative;
    z-index: 10;
    padding: 0 20px;
    height: calc(100vh - 260px);
  }
}

.header {
  &__back {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    color: rgba(255, 255, 255, 0.7);
  }
  
  &__title {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }
  
  &__placeholder {
    width: 40px;
  }
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 183, 213, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  
  &__icon {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.4);
  }
  
  &__input {
    flex: 1;
    font-size: 14px;
    color: #fff;
    background: transparent;
  }
  
  &__placeholder {
    color: rgba(255, 255, 255, 0.3);
  }
}

.filter-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 183, 213, 0.1);
  border-radius: 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
  
  text {
    color: inherit;
  }
  
  &--active {
    background: rgba(255, 183, 213, 0.15);
    border-color: rgba(255, 183, 213, 0.3);
    color: #ffb7d5;
  }
}

.packs-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pack-card {
  display: flex;
  gap: 14px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 183, 213, 0.1);
  border-radius: 14px;
  
  &__image {
    width: 72px;
    height: 72px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
  }
  
  &__image-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(156, 39, 176, 0.2), rgba(255, 143, 171, 0.2));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }
  
  &__name {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
  }
  
  &__platform {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
  }
  
  &__version {
    display: inline-block;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 8px;
    border-radius: 6px;
    margin-bottom: 6px;
  }
  
  &__desc {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  &__meta {
    display: flex;
    gap: 12px;
  }
  
  &__author {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }
  
  &__downloads {
    font-size: 11px;
    color: #ffb7d5;
  }
  
  &__actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  &__btn {
    min-width: 70px;
  }
  
  &__installed {
    padding: 8px 14px;
    background: rgba(76, 175, 80, 0.15);
    border-radius: 8px;
    
    text {
      font-size: 12px;
      color: #4caf50;
    }
  }
}

.installed-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.installed-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 183, 213, 0.1);
  border-radius: 12px;
  
  &__icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: rgba(156, 39, 176, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }
  
  &__name {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }
  
  &__platform {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
  }
  
  &__version {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
  
  &__uninstall {
    padding: 6px 12px;
    background: rgba(255, 87, 34, 0.15);
    border-radius: 6px;
    
    text {
      font-size: 12px;
      color: #ff5722;
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  
  &__icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  &__text {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 8px;
  }
  
  &__hint {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
  }
}

.footer-space {
  height: 40px;
}
</style>