<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVersionStore } from '@/stores/version'
import { useSettingsStore } from '@/stores/settings'
import { formatBytes, formatTime } from '@/utils/format'

interface ModPack {
  id: string
  name: string
  version: string
  mcVersion: string
  description: string
  author: string
  downloads: number
  url: string
  size: number
  platform: 'forge' | 'fabric' | 'quilt' | 'neoforge'
  modCount: number
  installed: boolean
  enabled: boolean
}

const versionStore = useVersionStore()
const settingsStore = useSettingsStore()

const activeTab = ref('market')
const modPacks = ref<ModPack[]>([])
const installedPacks = ref<ModPack[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedPlatform = ref<'all' | 'forge' | 'fabric' | 'quilt' | 'neoforge'>('all')

const tabs = [
  { id: 'market', label: '整合包商店' },
  { id: 'installed', label: '已安装' }
]

const platforms = [
  { id: 'all', label: '全部' },
  { id: 'forge', label: 'Forge' },
  { id: 'fabric', label: 'Fabric' },
  { id: 'quilt', label: 'Quilt' },
  { id: 'neoforge', label: 'NeoForge' }
]

const filteredPacks = computed(() => {
  let result = modPacks.value
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.description.toLowerCase().includes(query)
    )
  }
  
  if (selectedPlatform.value !== 'all') {
    result = result.filter(p => p.platform === selectedPlatform.value)
  }
  
  return result
})

const popularModPacks: ModPack[] = [
  { id: '1', name: 'RLCraft', version: '2.9.3', mcVersion: '1.12.2', description: '超难生存整合包，包含数百个模组', author: 'SparkofRaven', downloads: 28000000, url: '', size: 256, platform: 'forge', modCount: 165, installed: false, enabled: false },
  { id: '2', name: 'All the Mods 9', version: '1.15.0', mcVersion: '1.20.1', description: '包含所有热门模组的大型整合包', author: 'ATM Team', downloads: 12500000, url: '', size: 189, platform: 'forge', modCount: 280, installed: false, enabled: false },
  { id: '3', name: 'Fabric API Pack', version: '0.86.0', mcVersion: '1.21', description: 'Fabric 基础整合包，包含常用模组', author: 'Fabric Team', downloads: 8200000, url: '', size: 45, platform: 'fabric', modCount: 45, installed: false, enabled: false },
  { id: '4', name: 'SkyFactory 4', version: '4.2.0', mcVersion: '1.12.2', description: '空岛生存整合包，从零开始建造', author: 'Darkosto', downloads: 15600000, url: '', size: 128, platform: 'forge', modCount: 145, installed: false, enabled: false },
  { id: '5', name: 'EnigTech 2', version: '1.8.0', mcVersion: '1.18.2', description: '科技魔法整合包，复杂的科技树', author: 'EnigTech Team', downloads: 6100000, url: '', size: 215, platform: 'forge', modCount: 210, installed: false, enabled: false },
  { id: '6', name: 'Quilt Standard Library', version: '1.21', mcVersion: '1.21', description: 'Quilt 标准整合包，轻量级模组集合', author: 'Quilt Team', downloads: 3200000, url: '', size: 28, platform: 'quilt', modCount: 25, installed: false, enabled: false },
  { id: '7', name: 'Create: Above and Beyond', version: '1.5.0', mcVersion: '1.18.2', description: '以 Create 模组为核心的建造整合包', author: 'Create Team', downloads: 7800000, url: '', size: 156, platform: 'forge', modCount: 120, installed: false, enabled: false },
  { id: '8', name: 'Vault Hunters', version: '1.18.2', mcVersion: '1.18.2', description: '地牢探险整合包，收集神器挑战Boss', author: 'Vault Hunters', downloads: 9400000, url: '', size: 178, platform: 'forge', modCount: 155, installed: false, enabled: false },
  { id: '9', name: 'Better Minecraft', version: '1.20.1', mcVersion: '1.20.1', description: '增强原版体验的轻量整合包', author: 'BetterMC', downloads: 11200000, url: '', size: 89, platform: 'fabric', modCount: 85, installed: false, enabled: false },
  { id: '10', name: 'NeoForge Essentials', version: '1.21', mcVersion: '1.21', description: 'NeoForge 基础整合包，最新技术栈', author: 'NeoForge Team', downloads: 1800000, url: '', size: 56, platform: 'neoforge', modCount: 35, installed: false, enabled: false }
]

onMounted(() => {
  modPacks.value = popularModPacks
  loadInstalledPacks()
})

function loadInstalledPacks() {
  installedPacks.value = modPacks.value.filter(p => p.installed)
}

function installPack(pack: ModPack) {
  uni.showToast({ title: `开始下载 ${pack.name}`, icon: 'none' })
  
  const task = versionStore.addDownload({
    name: `整合包 - ${pack.name}`,
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

function uninstallPack(pack: ModPack) {
  pack.installed = false
  pack.enabled = false
  loadInstalledPacks()
  uni.showToast({ title: '已卸载', icon: 'none' })
}

function getPlatformBadge(platform: string) {
  switch (platform) {
    case 'forge': return { text: 'Forge', color: '#FF5722' }
    case 'fabric': return { text: 'Fabric', color: '#00BCD4' }
    case 'quilt': return { text: 'Quilt', color: '#9C27B0' }
    case 'neoforge': return { text: 'NeoForge', color: '#4CAF50' }
    default: return { text: '通用', color: '#ff8fab' }
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
      <text class="header__title">整合包管理</text>
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
          placeholder="搜索整合包..." 
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
              <text>📦</text>
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
            <view class="pack-card__version-row">
              <text class="pack-card__version">v{{ pack.version }}</text>
              <text class="pack-card__mcversion">MC {{ pack.mcVersion }}</text>
            </view>
            <text class="pack-card__desc">{{ pack.description }}</text>
            <view class="pack-card__meta">
              <text class="pack-card__author">{{ pack.author }}</text>
              <text class="pack-card__modcount">{{ pack.modCount }} 个模组</text>
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
            <text>📦</text>
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
            <text class="installed-item__version">v{{ pack.version }} | MC {{ pack.mcVersion }}</text>
            <text class="installed-item__modcount">{{ pack.modCount }} 个模组</text>
          </view>
          <view class="installed-item__uninstall" @tap="uninstallPack(pack)">
            <text>删除</text>
          </view>
        </view>
        
        <view v-if="installedPacks.length === 0" class="empty-state">
          <text class="empty-state__icon">📦</text>
          <text class="empty-state__text">暂无已安装的整合包</text>
          <text class="empty-state__hint">去整合包商店下载一些吧</text>
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
    background: linear-gradient(135deg, rgba(255, 143, 171, 0.2), rgba(156, 39, 176, 0.2));
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
    margin-bottom: 4px;
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
  
  &__version-row {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  }
  
  &__version {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 8px;
    border-radius: 6px;
  }
  
  &__mcversion {
    font-size: 11px;
    color: #ffb7d5;
    background: rgba(255, 183, 213, 0.1);
    padding: 2px 8px;
    border-radius: 6px;
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
    flex-wrap: wrap;
  }
  
  &__author {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }
  
  &__modcount {
    font-size: 11px;
    color: rgba(76, 175, 80, 0.8);
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
    background: rgba(255, 143, 171, 0.15);
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
    margin-bottom: 4px;
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
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 2px;
  }
  
  &__modcount {
    font-size: 11px;
    color: rgba(76, 175, 80, 0.8);
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