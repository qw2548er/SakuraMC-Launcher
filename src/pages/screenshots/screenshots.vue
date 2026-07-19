<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { listDirectory, deleteFile, MINECRAFT_DIR } from '@/utils/setup'
import { showOpenModeDialog, getImageBase64, shareFile } from '@/utils/file-chooser'

const settingsStore = useSettingsStore()

interface Screenshot {
  id: string
  name: string
  size: string
  date: string
  resolution: string
  previewColor: string
  path: string
  sizeBytes: number
  /** 缩略图 base64 (懒加载) */
  thumb?: string
  /** 是否正在加载缩略图 */
  thumbLoading?: boolean
  /** 全尺寸 base64 (预览时加载) */
  fullBase64?: string
}

const screenshots = ref<Screenshot[]>([])
const loading = ref(false)
const search = ref('')
const selectedView = ref<'grid' | 'list'>('grid')
const previewScreenshot = ref<Screenshot | null>(null)
const showPreview = ref(false)

// 哈希生成颜色 (用文件名作为种子, 让占位色稳定)
function colorFromName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  const hue = Math.abs(h) % 360
  return `hsl(${hue}, 35%, 30%)`
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes > 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

function formatDate(ts: number): string {
  if (!ts) return '未知'
  try {
    const d = new Date(ts)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '未知' }
}

// 从文件名提取分辨率 (例如 2026-07-18_14.30.25.png 无法提取, 但保留通用解析)
function parseResolution(name: string): string {
  const m = name.match(/(\d{3,4})x(\d{3,4})/i)
  return m ? `${m[1]}×${m[2]}` : '截图'
}

async function loadScreenshots() {
  loading.value = true
  try {
    const dir = settingsStore.screenshotsDir || `${MINECRAFT_DIR}/screenshots`
    const entries = await listDirectory(dir)
    const items: Screenshot[] = entries
      .filter(e => !e.isDir && /\.(png|jpg|jpeg)$/i.test(e.name))
      .map(e => ({
        id: e.name,
        name: e.name.replace(/\.(png|jpg|jpeg)$/i, ''),
        size: formatSize(e.size || 0),
        date: formatDate(e.lastModified || 0),
        resolution: parseResolution(e.name),
        previewColor: colorFromName(e.name),
        path: e.path,
        sizeBytes: e.size || 0
      }))
      .sort((a, b) => b.name.localeCompare(a.name))
    screenshots.value = items
  } catch (e: any) {
    console.warn('[Screenshots] 加载失败:', e?.message || e)
    screenshots.value = []
  } finally {
    loading.value = false
  }
}

const filteredScreenshots = computed(() => {
  if (!search.value) return screenshots.value
  const q = search.value.toLowerCase()
  return screenshots.value.filter(s => s.name.toLowerCase().includes(q) || s.date.includes(q))
})

const totalSize = computed(() => {
  const total = screenshots.value.reduce((sum, s) => sum + (s.sizeBytes || 0), 0)
  return formatSize(total)
})

function openPreview(ss: Screenshot) {
  previewScreenshot.value = ss
  showPreview.value = true
  // 异步加载全尺寸图片
  if (!ss.fullBase64) {
    loadFullImage(ss)
  }
}

async function loadFullImage(ss: Screenshot) {
  if (!previewScreenshot.value || previewScreenshot.value.id !== ss.id) return
  try {
    const data = await getImageBase64(ss.path, 1920, 1080)
    if (data) {
      // 更新当前预览对象
      const target = screenshots.value.find(s => s.id === ss.id)
      if (target) target.fullBase64 = data.base64
      if (previewScreenshot.value?.id === ss.id) {
        previewScreenshot.value = { ...previewScreenshot.value, fullBase64: data.base64 }
      }
    }
  } catch (e: any) {
    console.warn('[Screenshots] loadFullImage failed:', e?.message)
  }
}

/** 懒加载缩略图 (滚动到可见时调用) */
async function loadThumb(ss: Screenshot) {
  if (ss.thumb || ss.thumbLoading) return
  const target = screenshots.value.find(s => s.id === ss.id)
  if (!target || target.thumb || target.thumbLoading) return
  target.thumbLoading = true
  try {
    const data = await getImageBase64(ss.path, 200, 200)
    if (data) {
      target.thumb = data.base64
    }
  } catch (e: any) {
    console.warn('[Screenshots] loadThumb failed:', ss.name, e?.message)
  } finally {
    target.thumbLoading = false
  }
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
    success: async (r) => {
      if (!r.confirm) return
      uni.showLoading({ title: '删除中...' })
      try {
        await deleteFile(ss.path, false)
        screenshots.value = screenshots.value.filter(s => s.id !== id)
        if (previewScreenshot.value?.id === id) closePreview()
        uni.hideLoading()
        uni.showToast({ title: '已删除', icon: 'success' })
      } catch (e: any) {
        uni.hideLoading()
        uni.showToast({ title: '删除失败: ' + (e?.message || ''), icon: 'none' })
      }
    }
  })
}

function openScreenshotsFolder() {
  const path = settingsStore.screenshotsDir || `${MINECRAFT_DIR}/screenshots`
  // #ifdef APP-PLUS
  showOpenModeDialog(path)
  // #endif
  // #ifndef APP-PLUS
  uni.showToast({ title: '路径: ' + path, icon: 'none' })
  // #endif
}

function shareScreenshot(ss: Screenshot) {
  // #ifdef APP-PLUS
  shareFile(ss.path, '分享截图 ' + ss.name).then((ok) => {
    if (!ok) {
      uni.showToast({ title: '分享失败', icon: 'none' })
    }
  })
  // #endif
  // #ifndef APP-PLUS
  uni.setClipboardData({
    data: ss.name,
    showToast: true,
    success: () => uni.showToast({ title: ss.name + ' 已复制', icon: 'success' }),
    fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
  })
  // #endif
}

function refreshList() {
  loadScreenshots()
}

/** 滚动到底部时, 批量加载剩余缩略图 (前 20 个) */
function loadMoreThumbs() {
  const unloaded = filteredScreenshots.value.filter(s => !s.thumb && !s.thumbLoading).slice(0, 8)
  unloaded.forEach(s => loadThumb(s))
}

onMounted(loadScreenshots)
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
    <scroll-view scroll-y class="screenshots__content" v-if="selectedView === 'grid'" @scrolltolower="loadMoreThumbs">
      <view class="screenshots__grid">
        <view v-for="ss in filteredScreenshots" :key="ss.id" class="screenshot-card" @tap="openPreview(ss)" @appear="loadThumb(ss)">
          <view class="screenshot-card__preview" :style="{ background: ss.thumb ? 'transparent' : ss.previewColor }">
            <image v-if="ss.thumb" class="screenshot-card__img" :src="ss.thumb" mode="aspectFill" />
            <text v-else class="screenshot-card__placeholder">{{ ss.thumbLoading ? '⏳' : '📷' }}</text>
          </view>
          <view class="screenshot-card__info">
            <text class="screenshot-card__name">{{ ss.name.length > 18 ? ss.name.substring(0, 18) + '...' : ss.name }}</text>
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
      <view v-for="ss in filteredScreenshots" :key="ss.id" class="screenshot-row" @tap="openPreview(ss)" @appear="loadThumb(ss)">
        <view class="screenshot-row__preview" :style="{ background: ss.thumb ? 'transparent' : ss.previewColor }">
          <image v-if="ss.thumb" class="screenshot-row__img" :src="ss.thumb" mode="aspectFill" />
          <text v-else>📷</text>
        </view>
        <view class="screenshot-row__main">
          <text class="screenshot-row__name">{{ ss.name }}</text>
          <text class="screenshot-row__meta">{{ ss.date }} · {{ ss.size }} · {{ ss.resolution }}</text>
        </view>
        <view class="screenshot-row__actions">
          <view class="screenshot-row__action" @tap.stop="shareScreenshot(ss)">
            <text>📤</text>
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
        <view class="screenshots__preview-image" :style="{ background: previewScreenshot.fullBase64 ? 'transparent' : previewScreenshot.previewColor }">
          <image v-if="previewScreenshot.fullBase64" class="screenshots__preview-img" :src="previewScreenshot.fullBase64" mode="aspectFit" />
          <template v-else>
            <text class="screenshots__preview-icon">⏳</text>
            <text class="screenshots__preview-icon-text">加载中... {{ previewScreenshot.name }}</text>
          </template>
        </view>
        <view class="screenshots__preview-info">
          <text class="screenshots__preview-name">{{ previewScreenshot.name }}</text>
          <text class="screenshots__preview-meta">{{ previewScreenshot.date }} · {{ previewScreenshot.size }} · {{ previewScreenshot.resolution }}</text>
        </view>
        <view class="screenshots__preview-actions">
          <view class="screenshots__preview-btn" @tap="deleteScreenshot(previewScreenshot.id); closePreview()">
            <text>🗑️ 删除</text>
          </view>
          <view class="screenshots__preview-btn" @tap="shareScreenshot(previewScreenshot)">
            <text>📤 分享</text>
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
    gap: 16rpx; position: relative;
  }
  &__preview-img { width: 100%; height: 100%; }
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

  &__preview { height: 180rpx; display: flex; align-items: center; justify-content: center; position: relative; }
  &__img { width: 100%; height: 100%; }
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
    overflow: hidden; position: relative;
  }
  &__img { width: 100%; height: 100%; }
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