<script setup lang="ts">
import { ref, computed, onMounted, type Ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { listDirectory } from '@/utils/setup'
import { MINECRAFT_DIR } from '@/utils/setup'

const settingsStore = useSettingsStore()
const activeTab = ref<'mods' | 'resourcepack' | 'shaderpack'>('mods')
const search = ref('')

// Mod 数据
const modList = ref([
  { id: '1', name: 'Fabric API', version: '0.92.0', type: 'fabric', enabled: true, size: '2.3 MB', mc: '1.21' },
  { id: '2', name: 'Sodium', version: '0.5.3', type: 'fabric', enabled: true, size: '1.2 MB', mc: '1.21' },
  { id: '3', name: 'Iris Shaders', version: '1.6.4', type: 'fabric', enabled: false, size: '3.1 MB', mc: '1.21' },
  { id: '4', name: 'Lithium', version: '0.12.1', type: 'fabric', enabled: true, size: '0.8 MB', mc: '1.21' },
  { id: '5', name: 'JEI', version: '15.3.0', type: 'forge', enabled: false, size: '1.5 MB', mc: '1.20' },
  { id: '6', name: 'OptiFine', version: 'HD_U_I5', type: 'optifine', enabled: false, size: '4.2 MB', mc: '1.20' },
])

// 资源包数据
const resourcePacks = ref([
  { id: 'rp1', name: 'Faithful 32x', version: '1.21', enabled: true, size: '8.5 MB', desc: '经典原版风格高清材质' },
  { id: 'rp2', name: 'Xray Ultimate', version: '1.21', enabled: false, size: '0.3 MB', desc: '透视辅助资源包' },
  { id: 'rp3', name: 'Smooth Font', version: '1.20', enabled: true, size: '1.2 MB', desc: '字体平滑美化' },
])

// 光影包数据
const shaderPacks = ref([
  { id: 'sp1', name: 'Complementary Shaders', version: 'v4.6', enabled: true, size: '12.5 MB', desc: '色彩鲜艳, 性能优秀' },
  { id: 'sp2', name: 'BSL Shaders', version: 'v8.2', enabled: false, size: '15.3 MB', desc: '真实光影, 高度可定制' },
  { id: 'sp3', name: 'Sildurs Vibrant', version: 'v1.29', enabled: false, size: '9.8 MB', desc: '鲜艳色彩, 中等性能要求' },
  { id: 'sp4', name: 'SEUS PTGI', version: 'HRR 3', enabled: false, size: '28.1 MB', desc: '极致光影, 需要高性能显卡' },
])

const filteredMods = computed(() => {
  if (!search.value) return modList.value
  const q = search.value.toLowerCase()
  return modList.value.filter(m => m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q))
})

const filteredResourcePacks = computed(() => {
  if (!search.value) return resourcePacks.value
  const q = search.value.toLowerCase()
  return resourcePacks.value.filter(r => r.name.toLowerCase().includes(q))
})

const filteredShaderPacks = computed(() => {
  if (!search.value) return shaderPacks.value
  const q = search.value.toLowerCase()
  return shaderPacks.value.filter(s => s.name.toLowerCase().includes(q))
})

function toggleItem(list: Ref<any[]>, id: string) {
  const item = list.value.find((i: any) => i.id === id)
  if (item) item.enabled = !item.enabled
}

async function loadMods() {
  // #ifdef APP-PLUS
  try {
    const modsDir = settingsStore.modsDir || `${MINECRAFT_DIR}/mods`
    const entries = await listDirectory(modsDir)
    const jars = entries.filter(e => !e.isDir && /\.jar$/i.test(e.name))
    if (jars.length > 0) {
      modList.value = jars.map(e => ({
        id: e.name,
        name: e.name.replace(/\.jar$/i, ''),
        version: parseModVersion(e.name),
        type: guessModType(e.name),
        enabled: !e.name.startsWith('.'),
        size: e.size ? (e.size / 1024 / 1024).toFixed(1) + ' MB' : '未知',
        mc: '通用'
      }))
    } else {
      modList.value = []
    }
  } catch (e: any) {
    console.warn('[Mods] 加载 mods 失败:', e?.message || e)
    modList.value = []
  }
  // #endif
}

// 从文件名猜测 mod 类型
function guessModType(name: string): 'fabric' | 'forge' | 'quilt' | 'optifine' | 'neoforge' | 'unknown' {
  const n = name.toLowerCase()
  if (n.includes('optifine')) return 'optifine'
  if (n.includes('fabric')) return 'fabric'
  if (n.includes('neoforge')) return 'neoforge'
  if (n.includes('forge')) return 'forge'
  if (n.includes('quilt')) return 'quilt'
  return 'unknown'
}

// 从文件名尝试提取版本号 (例如 modname-1.2.3.jar -> 1.2.3)
function parseModVersion(name: string): string {
  const base = name.replace(/\.jar$/i, '')
  const m = base.match(/[-_]?(\d+\.\d+(?:\.\d+)?(?:\.\w+)?)$/)
  return m ? m[1] : '未知'
}

async function loadResourcePacks() {
  // #ifdef APP-PLUS
  try {
    const dir = settingsStore.resourcepacksDir || `${MINECRAFT_DIR}/resourcepacks`
    const entries = await listDirectory(dir)
    const packs = entries.filter(e => !e.isDir && /\.(zip|rar)$/i.test(e.name))
    resourcePacks.value = packs.map(e => ({
      id: e.name,
      name: e.name.replace(/\.(zip|rar)$/i, ''),
      version: '通用',
      enabled: !e.name.startsWith('.'),
      size: e.size ? (e.size / 1024 / 1024).toFixed(1) + ' MB' : '未知',
      desc: '资源包文件'
    }))
  } catch (e: any) {
    console.warn('[Mods] 加载 resourcepacks 失败:', e?.message || e)
    resourcePacks.value = []
  }
  // #endif
}

async function loadShaderPacks() {
  // #ifdef APP-PLUS
  try {
    const dir = settingsStore.shaderpacksDir || `${MINECRAFT_DIR}/shaderpacks`
    const entries = await listDirectory(dir)
    const packs = entries.filter(e => !e.isDir && /\.(zip|rar)$/i.test(e.name))
    shaderPacks.value = packs.map(e => ({
      id: e.name,
      name: e.name.replace(/\.(zip|rar)$/i, ''),
      version: '通用',
      enabled: !e.name.startsWith('.'),
      size: e.size ? (e.size / 1024 / 1024).toFixed(1) + ' MB' : '未知',
      desc: '光影包文件'
    }))
  } catch (e: any) {
    console.warn('[Mods] 加载 shaderpacks 失败:', e?.message || e)
    shaderPacks.value = []
  }
  // #endif
}

async function loadAll() {
  await Promise.allSettled([loadMods(), loadResourcePacks(), loadShaderPacks()])
}

function addMod() {
  uni.showModal({
    title: '添加 Mod',
    content: '请将 Mod 文件放入游戏目录下的 mods 文件夹中',
    success: () => {
      loadMods()
      uni.showToast({ title: '已刷新列表', icon: 'success' })
    }
  })
}

function addResourcePack() {
  uni.showModal({
    title: '添加资源包',
    content: '请将资源包文件放入 resourcepacks 文件夹中',
    success: () => {
      loadResourcePacks()
      uni.showToast({ title: '已刷新列表', icon: 'success' })
    }
  })
}

function addShaderPack() {
  uni.showModal({
    title: '添加光影包',
    content: '请将光影包文件放入 shaderpacks 文件夹中',
    success: () => {
      loadShaderPacks()
      uni.showToast({ title: '已刷新列表', icon: 'success' })
    }
  })
}

function openFolder(folder: string) {
  // 类型安全的字段映射
  const dirMap: Record<string, 'modsDir' | 'resourcepacksDir' | 'shaderpacksDir'> = {
    mods: 'modsDir',
    resourcepacks: 'resourcepacksDir',
    shaderpacks: 'shaderpacksDir'
  }
  const key = dirMap[folder]
  const path = key ? settingsStore[key] : ''
  const finalPath = path || (settingsStore.gameDir ? settingsStore.gameDir + '/' + folder : '')
  uni.showToast({ title: finalPath ? '路径: ' + finalPath : '请在设置中配置路径', icon: 'none' })
}

onMounted(() => {
  loadAll()
})

function getTypeLabel(type: string) {
  const map: Record<string, string> = { fabric: 'Fabric', forge: 'Forge', quilt: 'Quilt', optifine: 'OptiFine', neoforge: 'NeoForge' }
  return map[type] || type
}
</script>

<template>
  <view class="mods">
    <view class="mods__header">
      <text class="mods__back" @tap="uni.navigateBack()">‹</text>
      <text class="mods__title">模组 & 资源包</text>
      <view class="mods__add" @tap="activeTab === 'mods' ? addMod() : activeTab === 'resourcepack' ? addResourcePack() : addShaderPack()">
        <text>+</text>
      </view>
    </view>
    
    <view class="mods__tabs">
      <view class="mods__tab" :class="{ 'mods__tab--active': activeTab === 'mods' }" @tap="activeTab = 'mods'">
        <text>Mod</text>
        <text class="mods__tab-count">{{ modList.length }}</text>
      </view>
      <view class="mods__tab" :class="{ 'mods__tab--active': activeTab === 'resourcepack' }" @tap="activeTab = 'resourcepack'">
        <text>资源包</text>
        <text class="mods__tab-count">{{ resourcePacks.length }}</text>
      </view>
      <view class="mods__tab" :class="{ 'mods__tab--active': activeTab === 'shaderpack' }" @tap="activeTab = 'shaderpack'">
        <text>光影包</text>
        <text class="mods__tab-count">{{ shaderPacks.length }}</text>
      </view>
      <view class="mods__tab-indicator" :style="{ left: activeTab === 'mods' ? '0%' : activeTab === 'resourcepack' ? '33.33%' : '66.66%' }" />
    </view>
    
    <view class="mods__search-bar">
      <input class="mods__search" v-model="search" :placeholder="'搜索 ' + (activeTab === 'mods' ? 'Mod' : activeTab === 'resourcepack' ? '资源包' : '光影包') + '...'" placeholder-style="color: #666" />
      <view class="mods__folder-btn" @tap="openFolder(activeTab === 'mods' ? 'mods' : activeTab === 'resourcepack' ? 'resourcepacks' : 'shaderpacks')">
        <text>📁</text>
      </view>
    </view>
    
    <scroll-view scroll-y class="mods__content">
      <!-- Mod 列表 -->
      <view v-if="activeTab === 'mods'" class="mods__list">
        <view v-for="mod in filteredMods" :key="mod.id" class="item-card">
          <view class="item-card__icon" style="background: rgba(255,183,213,0.15)">🧩</view>
          <view class="item-card__main">
            <text class="item-card__name">{{ mod.name }}</text>
            <text class="item-card__info">{{ getTypeLabel(mod.type) }} · v{{ mod.version }} · {{ mod.size }}</text>
            <text class="item-card__mc">MC {{ mod.mc }}</text>
          </view>
          <switch :checked="mod.enabled" color="#ff8fab" @change="toggleItem(modList, mod.id)" />
        </view>
        <view v-if="filteredMods.length === 0" class="mods__empty">
          <text class="mods__empty-icon">🧩</text>
          <text class="mods__empty-text">还没有安装 Mod</text>
          <text class="mods__empty-hint">点击右上角 + 添加</text>
        </view>
      </view>
      
      <!-- 资源包列表 -->
      <view v-if="activeTab === 'resourcepack'" class="mods__list">
        <view v-for="rp in filteredResourcePacks" :key="rp.id" class="item-card">
          <view class="item-card__icon" style="background: rgba(100,200,255,0.15)">🎨</view>
          <view class="item-card__main">
            <text class="item-card__name">{{ rp.name }}</text>
            <text class="item-card__info">{{ rp.desc }}</text>
            <text class="item-card__mc">{{ rp.version }} · {{ rp.size }}</text>
          </view>
          <switch :checked="rp.enabled" color="#8fbbff" @change="toggleItem(resourcePacks, rp.id)" />
        </view>
        <view v-if="filteredResourcePacks.length === 0" class="mods__empty">
          <text class="mods__empty-icon">🎨</text>
          <text class="mods__empty-text">还没有资源包</text>
          <text class="mods__empty-hint">点击右上角 + 添加资源包</text>
        </view>
      </view>
      
      <!-- 光影包列表 -->
      <view v-if="activeTab === 'shaderpack'" class="mods__list">
        <view v-for="sp in filteredShaderPacks" :key="sp.id" class="item-card">
          <view class="item-card__icon" style="background: rgba(255,200,100,0.15)">☀️</view>
          <view class="item-card__main">
            <text class="item-card__name">{{ sp.name }}</text>
            <text class="item-card__info">{{ sp.desc }}</text>
            <text class="item-card__mc">{{ sp.version }} · {{ sp.size }}</text>
          </view>
          <switch :checked="sp.enabled" color="#ffcc44" @change="toggleItem(shaderPacks, sp.id)" />
        </view>
        <view v-if="filteredShaderPacks.length === 0" class="mods__empty">
          <text class="mods__empty-icon">☀️</text>
          <text class="mods__empty-text">还没有光影包</text>
          <text class="mods__empty-hint">点击右上角 + 添加光影包</text>
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
  &__back { font-size: 48rpx; color: #ffb7d5; margin-right: 16rpx; padding: 0 8rpx; }
  &__title { flex: 1; font-size: 44rpx; font-weight: 700; color: #fff; }
  &__add {
    width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #ffb7d5, #ff8fab); border-radius: 16rpx;
    font-size: 40rpx; color: #fff; font-weight: 300;
  }
  &__tabs { display: flex; position: relative; padding: 0 24rpx; margin-bottom: 12rpx; }
  &__tab {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8rpx;
    padding: 20rpx 0; font-size: 26rpx; color: #888; position: relative; z-index: 1;
    &--active { color: #ffb7d5; font-weight: 600; }
  }
  &__tab-count { font-size: 20rpx; background: rgba(255,255,255,0.1); padding: 2rpx 12rpx; border-radius: 20rpx; }
  &__tab-indicator {
    position: absolute; bottom: 0; width: 33.33%; height: 4rpx;
    background: linear-gradient(90deg, #ffb7d5, #ff8fab); border-radius: 2rpx; transition: left 0.3s;
  }
  &__search-bar {
    display: flex; gap: 12rpx; padding: 0 24rpx; margin-bottom: 12rpx;
  }
  &__search {
    flex: 1; height: 72rpx; background: rgba(255,255,255,0.06); border-radius: 12rpx;
    padding: 0 20rpx; font-size: 28rpx; color: #fff; box-sizing: border-box;
  }
  &__folder-btn {
    width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.06); border-radius: 12rpx; font-size: 32rpx;
  }
  &__content { flex: 1; padding: 0 24rpx 40rpx; }
  &__list { display: flex; flex-direction: column; gap: 10rpx; }
  &__empty { text-align: center; padding: 120rpx 0; }
  &__empty-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
  &__empty-text { font-size: 30rpx; color: #fff; display: block; margin-bottom: 8rpx; }
  &__empty-hint { font-size: 24rpx; color: #666; display: block; }
}

.item-card {
  display: flex; align-items: center; padding: 18rpx 20rpx;
  background: rgba(255,255,255,0.04); border-radius: 12rpx; border: 2rpx solid rgba(255,255,255,0.04);
  
  &__icon {
    width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center;
    font-size: 28rpx; border-radius: 12rpx; margin-right: 16rpx; flex-shrink: 0;
  }
  &__main { flex: 1; min-width: 0; }
  &__name { font-size: 28rpx; color: #fff; font-weight: 500; display: block; }
  &__info { font-size: 22rpx; color: #888; display: block; margin-top: 4rpx; }
  &__mc { font-size: 20rpx; color: #666; display: block; margin-top: 2rpx; }
}
</style>