<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVersionStore } from '@/stores/version'
import { useSettingsStore } from '@/stores/settings'
import { formatBytes, formatTime } from '@/utils/format'
import { downloadFile } from '@/utils/downloader'

interface ResourcePack {
  id: string
  name: string
  version: string
  description: string
  author: string
  downloads: number
  url: string
  size: number
  image: string
  installed: boolean
  enabled: boolean
}

const versionStore = useVersionStore()
const settingsStore = useSettingsStore()

const activeTab = ref('market')
const resourcePacks = ref<ResourcePack[]>([])
const installedPacks = ref<ResourcePack[]>([])
const loading = ref(false)
const searchQuery = ref('')

const tabs = [
  { id: 'market', label: '资源商店' },
  { id: 'installed', label: '已安装' }
]

const filteredPacks = computed(() => {
  if (!searchQuery.value) return resourcePacks.value
  const query = searchQuery.value.toLowerCase()
  return resourcePacks.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.description.toLowerCase().includes(query)
  )
})

const popularPacks: ResourcePack[] = [
  { id: '1', name: 'Faithful 32x', version: '1.21', description: '忠实还原原版材质，32x分辨率', author: 'Faithful Team', downloads: 12500000, url: '', size: 35, image: '', installed: false, enabled: false },
  { id: '2', name: 'Sodium Extra', version: '1.21', description: '优化型材质包，提升游戏性能', author: 'Sodium Team', downloads: 3200000, url: '', size: 12, image: '', installed: false, enabled: false },
  { id: '3', name: 'Vanilla Tweaks', version: '1.21', description: '原版增强材质，细节更丰富', author: 'Vanilla Tweaks', downloads: 8900000, url: '', size: 8, image: '', installed: false, enabled: false },
  { id: '4', name: 'Dokucraft', version: '1.20.1', description: '经典中世纪风格材质', author: 'Doku', downloads: 5600000, url: '', size: 45, image: '', installed: false, enabled: false },
  { id: '5', name: 'Modern HD', version: '1.21', description: '高清现代风格材质，128x分辨率', author: 'Modern Team', downloads: 2100000, url: '', size: 156, image: '', installed: false, enabled: false },
  { id: '6', name: 'Mizuno\'s 16 Craft', version: '1.20.1', description: '日式简约风格材质', author: 'Mizuno', downloads: 4300000, url: '', size: 28, image: '', installed: false, enabled: false },
  { id: '7', name: 'John Smith Legacy', version: '1.20.1', description: '经典写实风格材质', author: 'John Smith', downloads: 3800000, url: '', size: 52, image: '', installed: false, enabled: false },
  { id: '8', name: 'Chroma Hills', version: '1.20.1', description: '鲜艳色彩风格，64x分辨率', author: 'Chroma Team', downloads: 6100000, url: '', size: 89, image: '', installed: false, enabled: false }
]

onMounted(() => {
  resourcePacks.value = popularPacks
  loadInstalledPacks()
})

function loadInstalledPacks() {
  installedPacks.value = resourcePacks.value.filter(p => p.installed)
}

function togglePack(pack: ResourcePack) {
  pack.enabled = !pack.enabled
  uni.showToast({ title: pack.enabled ? '已启用' : '已禁用', icon: 'none' })
}

function installPack(pack: ResourcePack) {
  uni.showToast({ title: `开始下载 ${pack.name}`, icon: 'none' })
  
  const task = versionStore.addDownload({
    name: `资源包 - ${pack.name}`,
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

function uninstallPack(pack: ResourcePack) {
  pack.installed = false
  pack.enabled = false
  loadInstalledPacks()
  uni.showToast({ title: '已卸载', icon: 'none' })
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
      <text class="header__title">资源包管理</text>
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
          placeholder="搜索资源包..." 
          placeholder-class="search-box__placeholder"
        />
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
              <text>🎨</text>
            </view>
          </view>
          <view class="pack-card__info">
            <text class="pack-card__name">{{ pack.name }}</text>
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
            <text>🎨</text>
          </view>
          <view class="installed-item__info">
            <text class="installed-item__name">{{ pack.name }}</text>
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
          <text class="empty-state__icon">📦</text>
          <text class="empty-state__text">暂无已安装的资源包</text>
          <text class="empty-state__hint">去资源商店下载一些吧</text>
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
    margin-bottom: 20px;
  }
  
  &__content {
    position: relative;
    z-index: 10;
    padding: 0 20px;
    height: calc(100vh - 220px);
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
    background: linear-gradient(135deg, rgba(255, 183, 213, 0.2), rgba(255, 143, 171, 0.2));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
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
    background: rgba(255, 183, 213, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
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