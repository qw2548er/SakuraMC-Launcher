<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

interface Screenshot {
  id: string
  name: string
  size: string
  date: string
  resolution: string
  previewColor: string
}

const screenshots = ref<Screenshot[]>([
  { id: '1', name: '2026-07-18_14.30.25', size: '2.4 MB', date: '2026-07-18 14:30', resolution: '1920×1080', previewColor: '#4a7c59' },
  { id: '2', name: '2026-07-18_12.15.10', size: '1.8 MB', date: '2026-07-18 12:15', resolution: '1920×1080', previewColor: '#7c5a4a' },
  { id: '3', name: '2026-07-17_20.05.33', size: '3.1 MB', date: '2026-07-17 20:05', resolution: '1920×1080', previewColor: '#4a5a7c' },
  { id: '4', name: '2026-07-17_16.42.18', size: '2.2 MB', date: '2026-07-17 16:42', resolution: '2560×1440', previewColor: '#7c6a4a' },
  { id: '5', name: '2026-07-16_22.10.05', size: '1.5 MB', date: '2026-07-16 22:10', resolution: '1920×1080', previewColor: '#5a7c4a' },
  { id: '6', name: '2026-07-16_19.30.00', size: '4.2 MB', date: '2026-07-16 19:30', resolution: '3840×2160', previewColor: '#4a7c7c' },
  { id: '7', name: '2026-07-15_14.55.22', size: '2.0 MB', date: '2026-07-15 14:55', resolution: '1920×1080', previewColor: '#7c4a5a' },
  { id: '8', name: '2026-07-15_11.20.45', size: '1.9 MB', date: '2026-07-15 11:20', resolution: '1920×1080', previewColor: '#6a6a4a' },
  { id: '9', name: '2026-07-14_18.15.30', size: '2.8 MB', date: '2026-07-14 18:15', resolution: '1920×1080', previewColor: '#5a4a7c' },
  { id: '10', name: '2026-07-14_10.00.00', size: '3.5 MB', date: '2026-07-14 10:00', resolution: '2560×1440', previewColor: '#4a6a7c' },
])

const search = ref('')
const selectedView = ref<'grid' | 'list'>('grid')
const previewScreenshot = ref<Screenshot | null>(null)
const showPreview = ref(false)

const filteredScreenshots = computed(() => {
  if (!search.value) return screenshots.value
  const q = search.value.toLowerCase()
  return screenshots.value.filter(s => s.name.toLowerCase().includes(q) || s.date.includes(q))
})

const totalSize = computed(() => {
  const total = screenshots.value.reduce((sum, s) => sum + parseFloat(s.size), 0)
  return total.toFixed(1) + ' MB'
})

function openPreview(ss: Screenshot) {
  previewScreenshot.value = ss
  showPreview.value = true
}

function closePreview() {
  showPreview.value = false
  previewScreenshot.value = null
}

function deleteScreenshot(id: string) {
  const ss = screenshots.value.find(s => s.id === id)
  if (!ss) return
  uni.showModal({
    title: '删除截图',
    content: '确定删除 ' + ss.name + '？',
    success: (r) => {
      if (r.confirm) {
        screenshots.value = screenshots.value.filter(s => s.id !== id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function openScreenshotsFolder() {
  const path = settingsStore.screenshotsDir || (settingsStore.gameDir ? settingsStore.gameDir + '/screenshots' : '')
  uni.showToast({ title: path ? '路径: ' + path : '请在设置中配置路径', icon: 'none' })
}

function shareScreenshot(ss: Screenshot) {
  uni.showToast({ title: ss.name + ' 已复制到剪贴板', icon: 'success' })
  uni.setClipboardData({ data: ss.name, showToast: false })
}
</script>

<template>
  <view class="screenshots">
    <view class="screenshots__header">
      <text class="screenshots__back" @tap="uni.navigateBack()">‹</text>
      <text class="screenshots__title">截图浏览</text>
      <view class="screenshots__actions">
        <view class="screenshots__action-btn" :class="{ 'screenshots__action-btn--active': selectedView === 'grid' }" @tap="selectedView = 'grid'">
          <text>⊞</text>
        </view>
        <view class="screenshots__action-btn" :class="{ 'screenshots__action-btn--active': selectedView === 'list' }" @tap="selectedView = 'list'">
          <text>☰</text>
        </view>
        <view class="screenshots__action-btn" @tap="openScreenshotsFolder">
          <text>📁</text>
        </view>
      </view>
    </view>

    <view class="screenshots__stats">
      <view class="screenshots__stat">
        <text class="screenshots__stat-num">{{ screenshots.length }}</text>
        <text class="screenshots__stat-label">截图数</text>
      </view>
      <view class="screenshots__stat">
        <text class="screenshots__stat-num">{{ totalSize }}</text>
        <text class="screenshots__stat-label">总大小</text>
      </view>
    </view>

    <view class="screenshots__search-bar">
      <input class="screenshots__search" v-model="search" placeholder="搜索截图..." placeholder-style="color: #666" />
    </view>

    <!-- 网格视图 -->
    <scroll-view scroll-y class="screenshots__content" v-if="selectedView === 'grid'">
      <view class="screenshots__grid">
        <view v-for="ss in filteredScreenshots" :key="ss.id" class="screenshot-card" @tap="openPreview(ss)">
          <view class="screenshot-card__preview" :style="{ background: ss.previewColor }">
            <text class="screenshot-card__placeholder">📷</text>
          </view>
          <view class="screenshot-card__info">
            <text class="screenshot-card__name">{{ ss.name.substring(0, 18) }}...</text>
            <text class="screenshot-card__meta">{{ ss.resolution }}</text>
          </view>
          <view class="screenshot-card__overlay" @tap.stop="deleteScreenshot(ss.id)">
            <text>🗑️</text>
          </view>
        </view>
      </view>
      <view v-if="filteredScreenshots.length === 0" class="screenshots__empty">
        <text class="screenshots__empty-icon">📷</text>
        <text class="screenshots__empty-text">没有截图</text>
        <text class="screenshots__empty-hint">按 F2 即可截图</text>
      </view>
    </scroll-view>

    <!-- 列表视图 -->
    <scroll-view scroll-y class="screenshots__content" v-if="selectedView === 'list'">
      <view v-for="ss in filteredScreenshots" :key="ss.id" class="screenshot-row" @tap="openPreview(ss)">
        <view class="screenshot-row__preview" :style="{ background: ss.previewColor }">
          <text>📷</text>
        </view>
        <view class="screenshot-row__main">
          <text class="screenshot-row__name">{{ ss.name }}</text>
          <text class="screenshot-row__meta">{{ ss.date }} · {{ ss.size }} · {{ ss.resolution }}</text>
        </view>
        <view class="screenshot-row__actions">
          <view class="screenshot-row__action" @tap.stop="shareScreenshot(ss)">
            <text>📋</text>
          </view>
          <view class="screenshot-row__action screenshot-row__action--danger" @tap.stop="deleteScreenshot(ss.id)">
            <text>🗑️</text>
          </view>
        </view>
      </view>
      <view v-if="filteredScreenshots.length === 0" class="screenshots__empty">
        <text class="screenshots__empty-icon">📷</text>
        <text class="screenshots__empty-text">没有截图</text>
        <text class="screenshots__empty-hint">按 F2 即可截图</text>
      </view>
    </scroll-view>

    <!-- 预览弹窗 -->
    <view v-if="showPreview && previewScreenshot" class="screenshots__preview-overlay" @tap="closePreview">
      <view class="screenshots__preview-modal" @tap.stop>
        <view class="screenshots__preview-image" :style="{ background: previewScreenshot.previewColor }">
          <text class="screenshots__preview-icon">📷</text>
          <text class="screenshots__preview-icon-text">{{ previewScreenshot.name }}</text>
        </view>
        <view class="screenshots__preview-info">
          <text class="screenshots__preview-name">{{ previewScreenshot.name }}</text>
          <text class="screenshots__preview-meta">{{ previewScreenshot.date }} · {{ previewScreenshot.size }} · {{ previewScreenshot.resolution }}</text>
        </view>
        <view class="screenshots__preview-actions">
          <view class="screenshots__preview-btn" @tap="deleteScreenshot(previewScreenshot.id); closePreview()">
            <text>🗑️ 删除</text>
          </view>
          <view class="screenshots__preview-btn" @tap="shareScreenshot(previewScreenshot); closePreview()">
            <text>📋 复制名称</text>
          </view>
          <view class="screenshots__preview-btn screenshots__preview-btn--close" @tap="closePreview">
            <text>关闭</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.screenshots {
  height: 100vh; display: flex; flex-direction: column;
  background: linear-gradient(180deg, #1a1530 0%, #0f0d1f 100%);

  &__header { display: flex; align-items: center; padding: 60rpx 24rpx 16rpx; }
  &__back { font-size: 48rpx; color: #ffb7d5; margin-right: 16rpx; padding: 0 8rpx; }
  &__title { flex: 1; font-size: 44rpx; font-weight: 700; color: #fff; }
  &__actions { display: flex; gap: 12rpx; }
  &__action-btn {
    width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.06); border-radius: 16rpx; font-size: 32rpx;
    &--active { background: rgba(255,183,213,0.15); color: #ffb7d5; }
  }
  &__stats { display: flex; gap: 12rpx; padding: 0 24rpx; margin-bottom: 16rpx; }
  &__stat {
    flex: 1; text-align: center; padding: 16rpx 8rpx;
    background: rgba(255,255,255,0.04); border-radius: 12rpx; border: 2rpx solid rgba(255,183,213,0.08);
  }
  &__stat-num { font-size: 36rpx; color: #ffb7d5; font-weight: 700; display: block; }
  &__stat-label { font-size: 22rpx; color: #888; display: block; margin-top: 4rpx; }
  &__search-bar { padding: 0 24rpx; margin-bottom: 12rpx; }
  &__search {
    height: 72rpx; background: rgba(255,255,255,0.06); border-radius: 12rpx;
    padding: 0 20rpx; font-size: 28rpx; color: #fff; box-sizing: border-box;
  }
  &__content { flex: 1; padding: 0 24rpx 40rpx; }
  &__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12rpx; }
  &__empty { text-align: center; padding: 120rpx 0; grid-column: 1/-1; }
  &__empty-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
  &__empty-text { font-size: 30rpx; color: #fff; display: block; margin-bottom: 8rpx; }
  &__empty-hint { font-size: 24rpx; color: #666; display: block; }

  &__preview-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000;
    display: flex; align-items: center; justify-content: center; padding: 32rpx;
  }
  &__preview-modal {
    background: #1a1530; border-radius: 20rpx; width: 100%; max-width: 600rpx;
    overflow: hidden; border: 2rpx solid rgba(255,183,213,0.2);
  }
  &__preview-image {
    height: 400rpx; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16rpx;
  }
  &__preview-icon { font-size: 100rpx; }
  &__preview-icon-text { font-size: 24rpx; color: rgba(255,255,255,0.6); }
  &__preview-info { padding: 20rpx; }
  &__preview-name { font-size: 28rpx; color: #fff; display: block; font-weight: 500; }
  &__preview-meta { font-size: 22rpx; color: #888; display: block; margin-top: 4rpx; }
  &__preview-actions { display: flex; gap: 12rpx; padding: 0 20rpx 20rpx; }
  &__preview-btn {
    flex: 1; padding: 16rpx; text-align: center; border-radius: 12rpx;
    background: rgba(255,255,255,0.06); font-size: 24rpx; color: #fff;
    &--close { background: rgba(255,183,213,0.15); color: #ffb7d5; }
  }
}

.screenshot-card {
  position: relative; border-radius: 12rpx; overflow: hidden;
  background: rgba(255,255,255,0.04); border: 2rpx solid rgba(255,255,255,0.04);

  &__preview { height: 180rpx; display: flex; align-items: center; justify-content: center; }
  &__placeholder { font-size: 48rpx; }
  &__info { padding: 12rpx; }
  &__name { font-size: 22rpx; color: #fff; display: block; }
  &__meta { font-size: 20rpx; color: #888; display: block; margin-top: 2rpx; }
  &__overlay {
    position: absolute; top: 8rpx; right: 8rpx; width: 48rpx; height: 48rpx;
    background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s; font-size: 22rpx;
  }
  &:active &__overlay { opacity: 1; }
}

.screenshot-row {
  display: flex; align-items: center; gap: 12rpx; padding: 16rpx;
  background: rgba(255,255,255,0.04); border-radius: 12rpx; margin-bottom: 8rpx;
  border: 2rpx solid rgba(255,255,255,0.04);

  &__preview {
    width: 72rpx; height: 72rpx; border-radius: 10rpx;
    display: flex; align-items: center; justify-content: center; font-size: 32rpx; flex-shrink: 0;
  }
  &__main { flex: 1; min-width: 0; }
  &__name { font-size: 26rpx; color: #fff; display: block; }
  &__meta { font-size: 22rpx; color: #888; display: block; margin-top: 2rpx; }
  &__actions { display: flex; gap: 8rpx; }
  &__action {
    width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.06); border-radius: 10rpx; font-size: 22rpx;
    &--danger { background: rgba(255,100,100,0.1); }
  }
}
</style>