<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVersionStore } from '@/stores/version'
import { useSettingsStore } from '@/stores/settings'
import McCard from '@/components/mc-card.vue'
import McButton from '@/components/mc-button.vue'
import McBadge from '@/components/mc-badge.vue'
import { formatBytes, formatTime } from '@/utils/format'

const versionStore = useVersionStore()
const settingsStore = useSettingsStore()
const search = ref('')
const filterType = ref<'all' | 'release' | 'snapshot' | 'installed'>('installed')
const showSnapshots = ref(false)

onMounted(() => {
  if (!versionStore.manifest) versionStore.loadManifest()
})

const filteredVersions = computed(() => {
  let list = versionStore.manifest?.versions || []
  if (filterType.value === 'installed') {
    list = Object.values(versionStore.installed)
  } else if (filterType.value === 'release') {
    list = list.filter(v => v.type === 'release')
  } else if (filterType.value === 'snapshot') {
    list = list.filter(v => v.type === 'snapshot')
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(v => v.id.toLowerCase().includes(q))
  }
  return list.slice(0, 200)
})

function selectVersion(id: string) {
  versionStore.select(id)
  uni.showToast({ title: '已选择 ' + id, icon: 'success' })
}

function openVersion(id: string) {
  uni.navigateTo({ url: '/pages/versions/version-detail?id=' + id })
}

function clearDownloads() {
  versionStore.clearCompletedDownloads()
  uni.showToast({ title: '已清理', icon: 'success' })
}
</script>

<template>
  <view class="versions">
    <view class="versions__header">
      <view>
        <text class="versions__title">版本管理</text>
        <text class="versions__subtitle">已装 {{ Object.keys(versionStore.installed).length }} · 清单 {{ versionStore.manifest?.versions.length || 0 }}</text>
      </view>
      <McButton variant="secondary" size="sm" @click="versionStore.loadManifest(true)">🔄</McButton>
    </view>

    <view class="versions__filter">
      <view class="filter-tabs">
        <view
          v-for="t in [
            { v: 'installed', l: '已安装' },
            { v: 'release', l: '正式版' },
            { v: 'snapshot', l: '快照' }
          ]"
          :key="t.v"
          class="filter-tab"
          :class="{ 'is-active': filterType === t.v }"
          @tap="filterType = t.v as any"
        >{{ t.l }}</view>
      </view>
      <view class="filter-search">
        <input
          v-model="search"
          class="filter-search__input"
          placeholder="搜索版本 (如 1.21)"
        />
      </view>
    </view>

    <view v-if="versionStore.downloads.length" class="versions__downloads">
      <view class="versions__section-head">
        <text class="versions__section-title">下载任务</text>
        <text class="versions__section-action" @tap="clearDownloads">清理已完成</text>
      </view>
      <view v-for="d in versionStore.downloads" :key="d.id" class="dl-item">
        <view class="dl-item__head">
          <text class="dl-item__name">{{ d.name }}</text>
          <McBadge :status="d.status === 'downloading' ? 'starting' : d.status === 'completed' ? 'online' : d.status === 'error' ? 'error' : 'offline'" :text="d.status" />
        </view>
        <view class="dl-item__bar">
          <view class="dl-item__fill" :style="{ width: (d.downloaded / Math.max(d.total, 1) * 100) + '%' }" />
        </view>
        <text class="dl-item__sub">{{ formatBytes(d.downloaded) }} / {{ formatBytes(d.total) }} · {{ d.speed ? formatBytes(d.speed) + '/s' : '' }}</text>
      </view>
    </view>

    <view v-if="versionStore.manifestLoading" class="versions__loading">
      <view class="versions__spinner" />
      <text class="versions__loading-text">正在加载版本清单...</text>
    </view>

    <view v-else-if="filteredVersions.length === 0" class="versions__empty">
      <text class="versions__empty-icon">📦</text>
      <text class="versions__empty-title">暂无版本</text>
      <text class="versions__empty-sub">{{ filterType === 'installed' ? '还没有安装任何版本, 切换到正式版开始' : '试试其他筛选条件' }}</text>
    </view>

    <view v-else class="versions__list">
      <view
        v-for="v in filteredVersions"
        :key="v.id"
        class="version-item"
        :class="{ 'is-selected': v.id === versionStore.selectedId }"
        @tap="selectVersion(v.id)"
        @longpress="openVersion(v.id)"
      >
        <view class="version-item__head">
          <view class="version-item__icon" :class="{ 'is-snapshot': v.type === 'snapshot' }">
            <text>{{ v.type === 'snapshot' ? '⚡' : v.type === 'release' ? '⛏️' : '📜' }}</text>
          </view>
          <view class="version-item__main">
            <view class="version-item__name-row">
              <text class="version-item__name">{{ v.id }}</text>
              <text v-if="versionStore.installed[v.id]" class="version-item__installed">已装</text>
              <text v-else-if="v.id === versionStore.selectedId" class="version-item__installed is-sel">已选</text>
            </view>
            <text class="version-item__sub">{{ v.type }} · {{ formatTime(v.releaseTime) }}</text>
          </view>
          <view class="version-item__action" @tap.stop="openVersion(v.id)">
            <text>›</text>
          </view>
        </view>
        <view class="version-item__loader-tags">
          <text v-if="v.hasForge" class="loader-tag">Forge</text>
          <text v-if="v.hasFabric" class="loader-tag">Fabric</text>
          <text v-if="v.hasOptifine" class="loader-tag">OptiFine</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.versions {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; }
  &__title { font-size: 44rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 24rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__filter { margin-bottom: 24rpx; display: flex; flex-direction: column; gap: 16rpx; }
  &__section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
  &__section-title { font-size: 28rpx; color: #ffffff; font-weight: 700; }
  &__section-action { font-size: 24rpx; color: #d896ff; }
  &__downloads { margin-bottom: 24rpx; }
  &__loading { text-align: center; padding: 80rpx 0; }
  &__spinner {
    width: 48rpx; height: 48rpx; margin: 0 auto 16rpx;
    border: 4rpx solid rgba(216, 150, 255, 0.3);
    border-top-color: #d896ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  &__loading-text { font-size: 26rpx; color: #b8a8d4; }
  &__empty { text-align: center; padding: 100rpx 0; }
  &__empty-icon { font-size: 100rpx; display: block; margin-bottom: 16rpx; }
  &__empty-title { font-size: 32rpx; color: #ffffff; display: block; }
  &__empty-sub { font-size: 24rpx; color: #6a5a8a; display: block; margin-top: 8rpx; }
  &__list { display: flex; flex-direction: column; gap: 16rpx; }
}

.filter-tabs {
  display: flex; gap: 8rpx;
  background: rgba(45, 27, 78, 0.4);
  padding: 6rpx; border-radius: 16rpx;
}
.filter-tab {
  flex: 1; text-align: center;
  padding: 16rpx;
  font-size: 26rpx; color: #b8a8d4; font-weight: 600;
  border-radius: 12rpx;
  &.is-active {
    background: linear-gradient(135deg, #ffb7d5, #d896ff);
    color: #1a0f2e;
  }
}
.filter-search {
  background: rgba(15, 15, 26, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
  &__input {
    width: 100%; background: transparent; border: none; outline: none;
    font-size: 26rpx; color: #ffffff;
    font-family: inherit;
    &::placeholder { color: #6a5a8a; }
  }
}

.dl-item {
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.1);
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  &__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12rpx; }
  &__name { font-size: 26rpx; color: #ffffff; font-weight: 600; }
  &__bar { height: 8rpx; background: rgba(106, 90, 138, 0.3); border-radius: 4rpx; overflow: hidden; }
  &__fill { height: 100%; background: linear-gradient(90deg, #ffb7d5, #d896ff); border-radius: 4rpx; transition: width 0.3s; }
  &__sub { display: block; font-size: 22rpx; color: #6a5a8a; margin-top: 8rpx; }
}

.version-item {
  background: linear-gradient(135deg, rgba(45, 27, 78, 0.7), rgba(26, 15, 46, 0.7));
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 20rpx;
  padding: 20rpx;
  &.is-selected {
    border-color: #d896ff;
    box-shadow: 0 0 24rpx rgba(216, 150, 255, 0.3);
  }
  &__head { display: flex; align-items: center; gap: 16rpx; }
  &__icon {
    width: 72rpx; height: 72rpx;
    background: linear-gradient(135deg, #2d1b4e, #1a0f2e);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 36rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.2);
    flex-shrink: 0;
    &.is-snapshot { border-color: #fbbf24; }
  }
  &__main { flex: 1; min-width: 0; }
  &__name-row { display: flex; align-items: center; gap: 12rpx; }
  &__name { font-size: 30rpx; color: #ffffff; font-weight: 700; }
  &__installed {
    font-size: 20rpx; padding: 2rpx 12rpx;
    background: rgba(74, 222, 128, 0.2); color: #4ade80;
    border-radius: 9999rpx;
    &.is-sel { background: rgba(216, 150, 255, 0.2); color: #d896ff; }
  }
  &__sub { font-size: 22rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__action { font-size: 48rpx; color: #6a5a8a; padding: 0 8rpx; }
  &__loader-tags { display: flex; gap: 8rpx; margin-top: 12rpx; padding-left: 88rpx; }
}

.loader-tag {
  font-size: 20rpx; padding: 4rpx 12rpx;
  background: rgba(96, 165, 250, 0.2);
  color: #60a5fa;
  border-radius: 8rpx;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
