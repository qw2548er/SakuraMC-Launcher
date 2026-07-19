<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVersionStore } from '@/stores/version'
import { useSettingsStore } from '@/stores/settings'
import { formatBytes, formatTime } from '@/utils/format'
import { importModpack } from '@/utils/modpack'

const versionStore = useVersionStore()
const settingsStore = useSettingsStore()
const search = ref('')
const activeTab = ref<'installed' | 'download'>('installed')
const filterType = ref<'all' | 'release' | 'snapshot'>('release')
const importing = ref(false)
const importStep = ref('')

onMounted(() => {
  versionStore.load()
  if (!versionStore.manifest) versionStore.loadManifest()
})

const installedList = computed(() => {
  return Object.values(versionStore.installed)
})

const remoteVersions = computed(() => {
  let list = versionStore.manifest?.versions || []
  if (filterType.value === 'release') {
    list = list.filter(v => v.type === 'release')
  } else if (filterType.value === 'snapshot') {
    list = list.filter(v => v.type === 'snapshot')
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(v => v.id.toLowerCase().includes(q))
  }
  return list.slice(0, 100)
})

function isInstalled(id: string): boolean {
  return !!versionStore.installed[id]
}

function selectVersion(id: string) {
  versionStore.select(id)
  uni.showToast({ title: '已选择 ' + id, icon: 'success' })
  setTimeout(() => uni.navigateBack(), 500)
}

function installVersion(id: string) {
  uni.showModal({
    title: '下载版本',
    content: `确定要下载 Minecraft ${id} 吗？`,
    success: (res) => {
      if (res.confirm) {
        versionStore.download(id)
        uni.showToast({ title: '开始下载', icon: 'none' })
        activeTab.value = 'installed'
      }
    }
  })
}

function deleteVersion(id: string) {
  uni.showModal({
    title: '删除版本',
    content: `确定要删除 Minecraft ${id} 吗？存档不会被删除。`,
    confirmColor: '#ff6b6b',
    success: (res) => {
      if (res.confirm) {
        versionStore.uninstall(id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function cancelDownload(id: string) {
  versionStore.cancelDownload(id)
}

function importPack() {
  if (importing.value) return
  uni.showActionSheet({
    itemList: ['导入整合包 (.mrpack/.zip)', '取消'],
    success: async (res) => {
      if (res.tapIndex !== 0) return
      importing.value = true
      uni.showLoading({ title: '准备导入...', mask: true })
      try {
        const result = await importModpack((p) => {
          importStep.value = p.step
          uni.showLoading({ title: p.step, mask: true })
        })
        uni.hideLoading()
        if (result.success) {
          uni.showToast({
            title: `导入成功: ${result.name} (${result.format})\n已安装 ${result.modCount} 个 Mod`,
            icon: 'none',
            duration: 3000
          })
          versionStore.load()
        } else {
          uni.showToast({
            title: '导入失败: ' + (result.error || '未知错误'),
            icon: 'none',
            duration: 3000
          })
        }
      } catch (e: any) {
        uni.hideLoading()
        if (e?.message !== 'User cancelled' && e?.message !== '未选择文件') {
          uni.showToast({ title: '导入失败: ' + (e?.message || ''), icon: 'none' })
        }
      } finally {
        importing.value = false
        importStep.value = ''
      }
    }
  })
}

function getDownloadTasksForVersion(versionId: string) {
  return versionStore.downloads.filter(d => d.name.includes(versionId))
}

function getDownloadStatus(versionId: string): string {
  const tasks = getDownloadTasksForVersion(versionId)
  if (tasks.length === 0) return 'idle'
  const active = tasks.find(t => t.status === 'downloading')
  if (active) return 'downloading'
  const done = tasks.find(t => t.status === 'completed')
  if (done) return 'done'
  const err = tasks.find(t => t.status === 'error')
  if (err) return 'error'
  return 'pending'
}

function getDownloadProgress(versionId: string): number {
  const tasks = getDownloadTasksForVersion(versionId)
  if (tasks.length === 0) return 0
  const total = tasks.reduce((a, t) => a + t.total, 0)
  const done = tasks.reduce((a, t) => a + t.downloaded, 0)
  return total ? Math.floor(done * 100 / total) : 0
}
</script>

<template>
  <view class="versions">
    <view class="versions__header">
      <text class="versions__back" @tap="uni.navigateBack()">‹</text>
      <text class="versions__title">版本管理</text>
      <view class="versions__header-actions">
        <text class="versions__header-btn" @tap="importPack">📦</text>
      </view>
    </view>
    
    <view class="versions__tabs">
      <view 
        class="versions__tab"
        :class="{ 'versions__tab--active': activeTab === 'installed' }"
        @tap="activeTab = 'installed'"
      >
        <text>已安装</text>
        <text class="versions__tab-count">{{ installedList.length }}</text>
      </view>
      <view 
        class="versions__tab"
        :class="{ 'versions__tab--active': activeTab === 'download' }"
        @tap="activeTab = 'download'"
      >
        <text>可下载</text>
        <text class="versions__tab-count">{{ versionStore.manifest?.versions.length || 0 }}</text>
      </view>
      <view class="versions__tab-indicator" :style="{ left: activeTab === 'installed' ? '0%' : '50%' }" />
    </view>
    
    <scroll-view scroll-y class="versions__content">
      <view v-if="activeTab === 'installed'" class="versions__panel">
        <view v-if="installedList.length === 0" class="versions__empty">
          <text class="versions__empty-icon">📦</text>
          <text class="versions__empty-text">还没有安装任何版本</text>
          <text class="versions__empty-hint">去「可下载」里安装一个吧</text>
        </view>
        
        <view 
          v-for="ver in installedList" 
          :key="ver.id"
          class="version-card"
          @tap="selectVersion(ver.id)"
        >
          <view class="version-card__icon">
            <text>🎮</text>
          </view>
          <view class="version-card__main">
            <text class="version-card__name">{{ ver.id }}</text>
            <text class="version-card__info">
              {{ ver.type === 'release' ? '正式版' : ver.type === 'snapshot' ? '快照版' : ver.type }}
              · {{ ver.releaseTime ? formatTime(ver.releaseTime) : '' }}
            </text>
          </view>
          <view class="version-card__actions">
            <view class="version-card__delete" @tap.stop="deleteVersion(ver.id)">
              <text>删除</text>
            </view>
          </view>
        </view>
        
        <view v-if="versionStore.downloads.length > 0" class="downloads-section">
          <text class="downloads-section__title">下载任务</text>
          
          <view 
            v-for="task in versionStore.downloads" 
            :key="task.id"
            class="download-item"
          >
            <view class="download-item__head">
              <text class="download-item__name">{{ task.name }}</text>
              <text 
                class="download-item__status"
                :class="{ 'download-item__status--loading': task.status === 'downloading' }"
              >
                {{ task.status === 'downloading' ? '下载中' : task.status === 'completed' ? '已完成' : task.status === 'error' ? '失败' : '等待中' }}
              </text>
            </view>
            <view class="download-item__bar">
              <view 
                class="download-item__bar-fill" 
                :style="{ width: (task.total ? Math.floor(task.downloaded * 100 / task.total) : 0) + '%' }"
                :class="{ 'download-item__bar-fill--error': task.status === 'error' }"
              />
            </view>
            <view class="download-item__info">
              <text>{{ task.total ? Math.floor(task.downloaded * 100 / task.total) : 0 }}%</text>
              <text v-if="task.status === 'downloading'" class="download-item__cancel" @tap="cancelDownload(task.name.replace('Minecraft ', ''))">取消</text>
            </view>
          </view>
        </view>
      </view>
      
      <view v-if="activeTab === 'download'" class="versions__panel">
        <view class="versions__filters">
          <input 
            class="versions__search" 
            v-model="search" 
            placeholder="搜索版本..."
            placeholder-style="color: #666"
          />
          <view class="versions__filter-row">
            <view 
              class="filter-chip"
              :class="{ 'filter-chip--active': filterType === 'release' }"
              @tap="filterType = 'release'"
            >
              <text>正式版</text>
            </view>
            <view 
              class="filter-chip"
              :class="{ 'filter-chip--active': filterType === 'snapshot' }"
              @tap="filterType = 'snapshot'"
            >
              <text>快照版</text>
            </view>
            <view 
              class="filter-chip"
              :class="{ 'filter-chip--active': filterType === 'all' }"
              @tap="filterType = 'all'"
            >
              <text>全部</text>
            </view>
          </view>
        </view>
        
        <view class="versions__list">
          <view 
            v-for="ver in remoteVersions" 
            :key="ver.id"
            class="version-card"
          >
            <view class="version-card__icon">
              <text>{{ ver.type === 'release' ? '🎮' : '🧪' }}</text>
            </view>
            <view class="version-card__main">
              <text class="version-card__name">{{ ver.id }}</text>
              <text class="version-card__info">
                {{ ver.type === 'release' ? '正式版' : '快照版' }}
                · {{ ver.releaseTime ? formatTime(ver.releaseTime) : '' }}
              </text>
            </view>
            <view class="version-card__actions">
              <view 
                v-if="isInstalled(ver.id)" 
                class="version-card__installed"
                @tap="selectVersion(ver.id)"
              >
                <text>已安装</text>
              </view>
              <view 
                v-else 
                class="version-card__install"
                @tap="installVersion(ver.id)"
              >
                <text>安装</text>
              </view>
            </view>
          </view>
        </view>
        
        <view class="versions__loadmore">
          <text>仅显示前 100 个版本</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.versions {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1530 0%, #0f0d1f 100%);
  
  &__header {
    display: flex;
    align-items: center;
    padding: 60rpx 24rpx 16rpx;
  }

  &__header-actions {
    margin-left: auto;
    display: flex;
    gap: 12rpx;
  }

  &__header-btn {
    font-size: 36rpx;
    padding: 8rpx 16rpx;
  }
  
  &__back {
    font-size: 48rpx;
    color: #ffb7d5;
    margin-right: 16rpx;
    padding: 0 8rpx;
  }
  
  &__title {
    font-size: 44rpx;
    font-weight: 700;
    color: #fff;
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
  
  &__filters {
    margin-bottom: 16rpx;
  }
  
  &__search {
    width: 100%;
    height: 72rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    color: #fff;
    box-sizing: border-box;
    margin-bottom: 16rpx;
  }
  
  &__filter-row {
    display: flex;
    gap: 12rpx;
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
  
  &__list {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }
  
  &__loadmore {
    text-align: center;
    padding: 32rpx 0;
    font-size: 22rpx;
    color: #555;
  }
}

.filter-chip {
  padding: 12rpx 24rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 20rpx;
  font-size: 24rpx;
  color: #888;
  
  &--active {
    background: rgba(255, 183, 213, 0.2);
    color: #ffb7d5;
  }
}

.version-card {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14rpx;
  margin-bottom: 12rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.04);
  transition: all 0.2s;
  
  &:active {
    background: rgba(255, 255, 255, 0.06);
    transform: scale(0.99);
  }
  
  &__icon {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36rpx;
    background: rgba(255, 183, 213, 0.1);
    border-radius: 14rpx;
    margin-right: 16rpx;
  }
  
  &__main {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    font-size: 28rpx;
    color: #fff;
    font-weight: 600;
    display: block;
  }
  
  &__info {
    font-size: 22rpx;
    color: #888;
    display: block;
    margin-top: 4rpx;
  }
  
  &__actions {
    flex-shrink: 0;
  }
  
  &__install {
    padding: 12rpx 28rpx;
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    border-radius: 10rpx;
    font-size: 24rpx;
    color: #fff;
    font-weight: 600;
  }
  
  &__installed {
    padding: 12rpx 24rpx;
    background: rgba(82, 196, 26, 0.15);
    border-radius: 10rpx;
    font-size: 24rpx;
    color: #52c41a;
  }
  
  &__delete {
    padding: 12rpx 24rpx;
    background: rgba(255, 107, 107, 0.15);
    border-radius: 10rpx;
    font-size: 24rpx;
    color: #ff6b6b;
  }
}

.downloads-section {
  margin-top: 24rpx;
  
  &__title {
    font-size: 26rpx;
    color: #ffb7d5;
    font-weight: 600;
    display: block;
    margin-bottom: 16rpx;
  }
}

.download-item {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 12rpx;
  
  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12rpx;
  }
  
  &__name {
    font-size: 26rpx;
    color: #fff;
    font-weight: 500;
  }
  
  &__status {
    font-size: 22rpx;
    color: #888;
    
    &--loading {
      color: #ffb7d5;
    }
  }
  
  &__bar {
    height: 8rpx;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4rpx;
    overflow: hidden;
  }
  
  &__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #ffb7d5, #ff8fab);
    border-radius: 4rpx;
    transition: width 0.3s;
    
    &--error {
      background: #ff6b6b;
    }
  }
  
  &__info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8rpx;
    font-size: 22rpx;
    color: #666;
  }
  
  &__cancel {
    color: #ff6b6b;
    padding: 4rpx 8rpx;
  }
}
</style>
