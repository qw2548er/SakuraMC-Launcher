<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  SAKURA_ROOT,
  MINECRAFT_DIR,
  listDirectory,
  readFileText,
  deleteFile,
  getDirectoryInfo
} from '@/utils/setup'
import { formatBytes } from '@/utils/format'

interface FileItem {
  name: string
  path: string
  isDir: boolean
  size: number
  lastModified: number
}

const currentPath = ref(SAKURA_ROOT)
const files = ref<FileItem[]>([])
const loading = ref(false)
const showFileViewer = ref(false)
const viewingFile = ref<{ name: string; content: string; path: string } | null>(null)
const showInfo = ref(false)
const dirInfo = getDirectoryInfo()

const pathSegments = computed(() => {
  const relative = currentPath.value.replace(SAKURA_ROOT, '')
  const segments = relative.split('/').filter(s => s.length > 0)
  return [
    { name: 'SakuraMC', path: SAKURA_ROOT },
    ...segments.map((seg, i) => ({
      name: seg,
      path: `${SAKURA_ROOT}/${segments.slice(0, i + 1).join('/')}`
    }))
  ]
})

async function loadFiles(path: string) {
  loading.value = true
  currentPath.value = path
  try {
    const result = await listDirectory(path)
    files.value = result
  } catch (e: any) {
    uni.showToast({ title: e.message || '读取失败', icon: 'none' })
    files.value = []
  } finally {
    loading.value = false
  }
}

function navigateTo(item: FileItem) {
  if (item.isDir) {
    loadFiles(item.path)
  } else {
    viewFile(item)
  }
}

async function viewFile(item: FileItem) {
  // 只能查看文本文件
  const ext = item.name.split('.').pop()?.toLowerCase()
  const textExts = ['txt', 'json', 'log', 'xml', 'md', 'yml', 'yaml', 'properties', 'cfg', 'conf', 'ini', 'sh', 'bat', 'js', 'ts', 'css', 'html']
  if (!ext || !textExts.includes(ext)) {
    uni.showToast({ title: '不支持预览此文件类型', icon: 'none' })
    return
  }
  
  try {
    const content = await readFileText(item.path)
    viewingFile.value = { name: item.name, content, path: item.path }
    showFileViewer.value = true
  } catch (e: any) {
    uni.showToast({ title: e.message || '读取文件失败', icon: 'none' })
  }
}

function navigateToSegment(path: string) {
  loadFiles(path)
}

function goBack() {
  if (currentPath.value === SAKURA_ROOT) return
  const parent = currentPath.value.substring(0, currentPath.value.lastIndexOf('/'))
  if (parent.length >= SAKURA_ROOT.length) {
    loadFiles(parent)
  }
}

function quickNavigate(path: string) {
  loadFiles(path)
  showInfo.value = false
}

function deleteItem(item: FileItem) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除 "${item.name}" 吗？此操作不可恢复！`,
    confirmColor: '#ff6b6b',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteFile(item.path)
          uni.showToast({ title: '已删除', icon: 'success' })
          loadFiles(currentPath.value)
        } catch (e: any) {
          uni.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      }
    }
  })
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  loadFiles(SAKURA_ROOT)
})

onShow(() => {
  if (currentPath.value) {
    loadFiles(currentPath.value)
  }
})
</script>

<template>
  <view class="page">
    <view class="page-header">
      <view class="header-left">
        <text class="back-btn" v-if="currentPath !== SAKURA_ROOT" @tap="goBack">‹</text>
        <text class="page-title">文件管理</text>
      </view>
      <view class="header-actions">
        <text class="action-btn" @tap="showInfo = true">📁</text>
        <text class="action-btn" @tap="loadFiles(currentPath)">🔄</text>
      </view>
    </view>
    
    <view class="breadcrumb">
      <view 
        v-for="(seg, i) in pathSegments" 
        :key="seg.path"
        class="breadcrumb__item"
      >
        <text 
          class="breadcrumb__name"
          :class="{ 'breadcrumb__name--active': i === pathSegments.length - 1 }"
          @tap="navigateToSegment(seg.path)"
        >{{ seg.name }}</text>
        <text v-if="i < pathSegments.length - 1" class="breadcrumb__sep">/</text>
      </view>
    </view>
    
    <scroll-view scroll-y class="file-list" @refresherrefresh="loadFiles(currentPath)" :refresher-enabled="true" :refresher-triggered="loading">
      <view v-if="loading" class="empty">
        <text>加载中...</text>
      </view>
      
      <view v-else-if="files.length === 0" class="empty">
        <text class="empty-icon">📂</text>
        <text class="empty-text">空文件夹</text>
      </view>
      
      <view v-else>
        <view 
          v-for="item in files" 
          :key="item.path"
          class="file-item"
          :class="{ 'file-item--dir': item.isDir }"
          @tap="navigateTo(item)"
          @longpress="deleteItem(item)"
        >
          <view class="file-item__icon">
            <text v-if="item.isDir">📁</text>
            <text v-else>{{ getFileIcon(item.name) }}</text>
          </view>
          <view class="file-item__info">
            <text class="file-item__name">{{ item.name }}</text>
            <text class="file-item__meta">
              {{ item.isDir ? '文件夹' : formatBytes(item.size) }} · {{ formatTime(item.lastModified) }}
            </text>
          </view>
          <text v-if="!item.isDir" class="file-item__view">👁</text>
        </view>
      </view>
    </scroll-view>
    
    <view v-if="showFileViewer && viewingFile" class="viewer-mask" @tap="showFileViewer = false">
      <view class="viewer-panel" @tap.stop>
        <view class="viewer-header">
          <text class="viewer-title">{{ viewingFile.name }}</text>
          <text class="viewer-close" @tap="showFileViewer = false">✕</text>
        </view>
        <scroll-view scroll-y class="viewer-content">
          <text class="viewer-text" user-select="true">{{ viewingFile.content }}</text>
        </scroll-view>
        <view class="viewer-actions">
          <view class="viewer-btn" @tap="copyContent(viewingFile.content)">
            <text>📋 复制</text>
          </view>
          <view class="viewer-btn viewer-btn--primary" @tap="showFileViewer = false">
            <text>关闭</text>
          </view>
        </view>
      </view>
    </view>
    
    <view v-if="showInfo" class="info-mask" @tap="showInfo = false">
      <view class="info-panel" @tap.stop>
        <view class="info-header">
          <text class="info-title">快速跳转</text>
          <text class="info-close" @tap="showInfo = false">✕</text>
        </view>
        <scroll-view scroll-y class="info-list">
          <view 
            v-for="dir in dirInfo" 
            :key="dir.path"
            class="info-item"
            :class="{ 'info-item--important': dir.important }"
            @tap="quickNavigate(dir.path)"
          >
            <view class="info-item__icon">{{ dir.icon }}</view>
            <view class="info-item__main">
              <text class="info-item__name">{{ dir.name }}</text>
              <text class="info-item__desc">{{ dir.description }}</text>
            </view>
            <view v-if="dir.important" class="info-item__badge">重要</view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script lang="ts">
function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  const icons: Record<string, string> = {
    'json': '📄',
    'txt': '📄',
    'log': '📋',
    'jar': '☕',
    'png': '🖼️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'zip': '🗜️',
    'rar': '🗜️',
    '7z': '🗜️',
    'dat': '📊',
    'nbt': '🗺️',
    'mca': '🌍',
    'mclevel': '🌍',
    'xml': '📋',
    'md': '📝',
    'sh': '⚡',
    'bat': '⚡',
    'js': '⚡',
    'ts': '⚡',
    'properties': '⚙️',
    'cfg': '⚙️',
    'yml': '⚙️',
    'yaml': '⚙️'
  }
  return icons[ext || ''] || '📄'
}

function copyContent(text: string) {
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'success' })
  })
}
</script>

<style lang="scss" scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a0f2e 0%, #0f0f1a 100%);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 100rpx 32rpx 24rpx;
  background: rgba(255, 183, 213, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.back-btn {
  font-size: 48rpx;
  color: #ffb7d5;
  padding: 0 16rpx;
}

.page-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #ffb7d5;
}

.header-actions {
  display: flex;
  gap: 16rpx;
}

.action-btn {
  font-size: 36rpx;
  padding: 8rpx 16rpx;
}

.breadcrumb {
  padding: 20rpx 32rpx;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4rpx;
  border-bottom: 2rpx solid rgba(255, 183, 213, 0.1);
  
  &__item {
    display: flex;
    align-items: center;
  }
  
  &__name {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.5);
    
    &--active {
      color: #ffb7d5;
      font-weight: 600;
    }
  }
  
  &__sep {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.3);
    margin: 0 8rpx;
  }
}

.file-list {
  flex: 1;
  padding: 16rpx 0;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  
  &-icon {
    font-size: 80rpx;
    margin-bottom: 16rpx;
  }
  
  &-text {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.3);
  }
}

.file-item {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid rgba(255, 255, 255, 0.04);
  
  &:active {
    background: rgba(255, 183, 213, 0.05);
  }
  
  &--dir {
    .file-item__name {
      color: #ffb7d5;
      font-weight: 600;
    }
  }
  
  &__icon {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36rpx;
    margin-right: 20rpx;
    background: rgba(255, 183, 213, 0.08);
    border-radius: 12rpx;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 28rpx;
    color: #fff;
    margin-bottom: 4rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  &__meta {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.4);
  }
  
  &__view {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.3);
    padding: 8rpx 16rpx;
  }
}

.viewer-mask, .info-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  backdrop-filter: blur(12px);
}

.viewer-panel, .info-panel {
  background: rgba(20, 18, 30, 0.95);
  border: 2rpx solid rgba(255, 183, 213, 0.3);
  border-radius: 20rpx;
  width: 100%;
  max-width: 600rpx;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.viewer-header, .info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid rgba(255, 183, 213, 0.15);
}

.viewer-title, .info-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffb7d5;
}

.viewer-close, .info-close {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.4);
  padding: 8rpx 16rpx;
}

.viewer-content {
  flex: 1;
  padding: 24rpx 32rpx;
}

.viewer-text {
  font-size: 24rpx;
  color: #52c41a;
  font-family: 'Consolas', 'Monaco', monospace;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.viewer-actions {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  border-top: 2rpx solid rgba(255, 183, 213, 0.15);
}

.viewer-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  font-size: 28rpx;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  
  &--primary {
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    color: #fff;
    font-weight: 600;
  }
  
  &:active {
    opacity: 0.8;
  }
}

.info-list {
  flex: 1;
  padding: 16rpx 24rpx;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 20rpx;
  border-radius: 12rpx;
  margin-bottom: 8rpx;
  
  &:active {
    background: rgba(255, 183, 213, 0.1);
  }
  
  &--important {
    background: rgba(255, 183, 213, 0.05);
  }
  
  &__icon {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    margin-right: 20rpx;
    background: rgba(255, 183, 213, 0.1);
    border-radius: 12rpx;
  }
  
  &__main {
    flex: 1;
  }
  
  &__name {
    display: block;
    font-size: 28rpx;
    color: #fff;
    font-weight: 600;
    margin-bottom: 4rpx;
  }
  
  &__desc {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.4);
  }
  
  &__badge {
    font-size: 20rpx;
    color: #ffb7d5;
    background: rgba(255, 183, 213, 0.15);
    padding: 6rpx 12rpx;
    border-radius: 6rpx;
  }
}
</style>
