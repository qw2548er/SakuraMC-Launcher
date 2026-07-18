<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const activeTab = ref<'mods' | 'resourcepack'>('mods')
const search = ref('')
const modList = ref([
  { id: '1', name: 'Fabric API', version: '0.92.0', type: 'fabric', enabled: true, size: '2.3 MB' },
  { id: '2', name: 'Sodium', version: '0.5.3', type: 'fabric', enabled: true, size: '1.2 MB' },
  { id: '3', name: 'Iris Shaders', version: '1.6.4', type: 'fabric', enabled: false, size: '3.1 MB' },
])

const filteredMods = computed(() => {
  if (!search.value) return modList.value
  const q = search.value.toLowerCase()
  return modList.value.filter(m => m.name.toLowerCase().includes(q))
})

function toggleMod(id: string) {
  const mod = modList.value.find(m => m.id === id)
  if (mod) mod.enabled = !mod.enabled
}

function addMod() {
  uni.showToast({ title: '从文件夹添加Mod', icon: 'none' })
}

function openModFolder() {
  uni.showToast({ title: '打开Mod文件夹', icon: 'none' })
}
</script>

<template>
  <view class="mods">
    <view class="mods__header">
      <text class="mods__back" @tap="uni.navigateBack()">‹</text>
      <text class="mods__title">模组管理</text>
      <view class="mods__add" @tap="addMod">
        <text>+</text>
      </view>
    </view>
    
    <view class="mods__tabs">
      <view 
        class="mods__tab"
        :class="{ 'mods__tab--active': activeTab === 'mods' }"
        @tap="activeTab = 'mods'"
      >
        <text>Mod</text>
        <text class="mods__tab-count">{{ modList.length }}</text>
      </view>
      <view 
        class="mods__tab"
        :class="{ 'mods__tab--active': activeTab === 'resourcepack' }"
        @tap="activeTab = 'resourcepack'"
      >
        <text>资源包</text>
        <text class="mods__tab-count">0</text>
      </view>
      <view class="mods__tab-indicator" :style="{ left: activeTab === 'mods' ? '0%' : '50%' }" />
    </view>
    
    <scroll-view scroll-y class="mods__content">
      <view v-if="activeTab === 'mods'" class="mods__panel">
        <view class="mods__search-bar">
          <input 
            class="mods__search" 
            v-model="search" 
            placeholder="搜索Mod..."
            placeholder-style="color: #666"
          />
          <view class="mods__folder-btn" @tap="openModFolder">
            <text>📁</text>
          </view>
        </view>
        
        <view class="mods__list">
          <view 
            v-for="mod in filteredMods" 
            :key="mod.id"
            class="mod-card"
          >
            <view class="mod-card__icon">🧩</view>
            <view class="mod-card__main">
              <text class="mod-card__name">{{ mod.name }}</text>
              <text class="mod-card__info">
                {{ mod.type === 'fabric' ? 'Fabric' : mod.type === 'forge' ? 'Forge' : mod.type }}
                · v{{ mod.version }} · {{ mod.size }}
              </text>
            </view>
            <switch 
              :checked="mod.enabled" 
              color="#ff8fab"
              @change="toggleMod(mod.id)"
            />
          </view>
        </view>
        
        <view v-if="filteredMods.length === 0" class="mods__empty">
          <text class="mods__empty-icon">🧩</text>
          <text class="mods__empty-text">还没有安装Mod</text>
          <text class="mods__empty-hint">点击右上角添加</text>
        </view>
      </view>
      
      <view v-if="activeTab === 'resourcepack'" class="mods__panel">
        <view class="mods__empty">
          <text class="mods__empty-icon">🎨</text>
          <text class="mods__empty-text">还没有资源包</text>
          <text class="mods__empty-hint">资源包功能即将推出</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.mods {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1530 0%, #0f0d1f 100%);
  
  &__header {
    display: flex;
    align-items: center;
    padding: 60rpx 24rpx 16rpx;
  }
  
  &__back {
    font-size: 48rpx;
    color: #ffb7d5;
    margin-right: 16rpx;
    padding: 0 8rpx;
  }
  
  &__title {
    flex: 1;
    font-size: 44rpx;
    font-weight: 700;
    color: #fff;
  }
  
  &__add {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    border-radius: 16rpx;
    font-size: 40rpx;
    color: #fff;
    font-weight: 300;
  }
  
  &__tabs {
    display: flex;
    position: relative;
    padding: 0 24rpx;
    margin-bottom: 16rpx;
  }
  
  &__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    padding: 20rpx 0;
    font-size: 28rpx;
    color: #888;
    position: relative;
    z-index: 1;
    
    &--active {
      color: #ffb7d5;
      font-weight: 600;
    }
  }
  
  &__tab-count {
    font-size: 22rpx;
    background: rgba(255, 255, 255, 0.1);
    padding: 2rpx 12rpx;
    border-radius: 20rpx;
  }
  
  &__tab-indicator {
    position: absolute;
    bottom: 0;
    width: 50%;
    height: 4rpx;
    background: linear-gradient(90deg, #ffb7d5, #ff8fab);
    border-radius: 2rpx;
    transition: left 0.3s;
  }
  
  &__content {
    flex: 1;
    padding: 0 24rpx 40rpx;
  }
  
  &__panel {
    padding-bottom: 40rpx;
  }
  
  &__search-bar {
    display: flex;
    gap: 12rpx;
    margin-bottom: 16rpx;
  }
  
  &__search {
    flex: 1;
    height: 72rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    color: #fff;
    box-sizing: border-box;
  }
  
  &__folder-btn {
    width: 72rpx;
    height: 72rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12rpx;
    font-size: 32rpx;
  }
  
  &__list {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
  }
  
  &__empty {
    text-align: center;
    padding: 120rpx 0;
  }
  
  &__empty-icon {
    font-size: 80rpx;
    display: block;
    margin-bottom: 16rpx;
  }
  
  &__empty-text {
    font-size: 30rpx;
    color: #fff;
    display: block;
    margin-bottom: 8rpx;
  }
  
  &__empty-hint {
    font-size: 24rpx;
    color: #666;
    display: block;
  }
}

.mod-card {
  display: flex;
  align-items: center;
  padding: 18rpx 20rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.04);
  
  &__icon {
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    background: rgba(255, 183, 213, 0.1);
    border-radius: 12rpx;
    margin-right: 16rpx;
  }
  
  &__main {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    font-size: 28rpx;
    color: #fff;
    font-weight: 500;
    display: block;
  }
  
  &__info {
    font-size: 22rpx;
    color: #888;
    display: block;
    margin-top: 4rpx;
  }
}
</style>
