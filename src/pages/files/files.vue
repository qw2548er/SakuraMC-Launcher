<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import {
  SAKURA_ROOT,
  MINECRAFT_DIR,
  listDirectory,
  readFileText,
  deleteFile,
  getDirectoryInfo
} from '@/utils/setup'
import { formatBytes } from '@/utils/format'
import {
  openExternalFileManager,
  chooseAndImport,
  mkdir as pluginMkdir,
  rename as pluginRename,
  unzip,
  shareFile,
  getImageBase64
} from '@/utils/file-chooser'

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
const selectedItems = ref<Set<string>>(new Set())
const isSelectMode = ref(false)

// 搜索与排序
const searchKeyword = ref('')
const sortMode = ref<'name' | 'size' | 'time'>('name')
const sortAsc = ref(true)
const showSortMenu = ref(false)

// 新建/重命名对话框
const showCreateDialog = ref(false)
const createType = ref<'folder' | 'file'>('folder')
const createName = ref('')
const showRenameDialog = ref(false)
const renameTarget = ref<FileItem | null>(null)
const renameName = ref('')

// 图片预览
const showImagePreview = ref(false)
const previewImage = ref<{ name: string; base64: string } | null>(null)
const imageLoading = ref(false)

const filteredFiles = computed(() => {
  let result = [...files.value]
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    result = result.filter(f => f.name.toLowerCase().includes(kw))
  }
  const dir = sortAsc.value ? 1 : -1
  result.sort((a, b) => {
    // 文件夹始终排在前面
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    let cmp = 0
    if (sortMode.value === 'name') {
      cmp = a.name.localeCompare(b.name)
    } else if (sortMode.value === 'size') {
      cmp = a.size - b.size
    } else if (sortMode.value === 'time') {
      cmp = a.lastModified - b.lastModified
    }
    return cmp * dir
  })
  return result
})

const pathSegments = computed(() => {
  const relative = currentPath.value.replace(SAKURA_ROOT, '')
  const segments = relative.split('/').filter(s => s.length > 0)
  return [
    { name: 'MaoNingMC', path: SAKURA_ROOT },
    ...segments.map((seg, i) => ({
      name: seg,
      path: `${SAKURA_ROOT}/${segments.slice(0, i + 1).join('/')}`
    }))
  ]
})

const selectedCount = computed(() => selectedItems.value.size)

async function loadFiles(path: string) {
  loading.value = true
  currentPath.value = path
  selectedItems.value.clear()
  isSelectMode.value = false
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

function isSelected(item: FileItem): boolean {
  return selectedItems.value.has(item.path)
}

function toggleSelect(item: FileItem) {
  if (isSelected(item)) {
    selectedItems.value.delete(item.path)
  } else {
    selectedItems.value.add(item.path)
  }
  isSelectMode.value = selectedItems.value.size > 0
}

function navigateTo(item: FileItem) {
  if (isSelectMode.value) {
    toggleSelect(item)
    return
  }
  if (item.isDir) {
    loadFiles(item.path)
  } else {
    viewFile(item)
  }
}

async function viewFile(item: FileItem) {
  const ext = item.name.split('.').pop()?.toLowerCase()
  const textExts = ['txt', 'json', 'log', 'xml', 'md', 'yml', 'yaml', 'properties', 'cfg', 'conf', 'ini', 'sh', 'bat', 'js', 'ts', 'css', 'html']
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
  
  if (imageExts.includes(ext || '')) {
    await previewImageFile(item)
    return
  }
  
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

async function previewImageFile(item: FileItem) {
  imageLoading.value = true
  showImagePreview.value = true
  previewImage.value = { name: item.name, base64: '' }
  try {
    const data = await getImageBase64(item.path, 800, 0)
    if (data) {
      previewImage.value = { name: item.name, base64: data.base64 }
    } else {
      uni.showToast({ title: '图片加载失败', icon: 'none' })
      showImagePreview.value = false
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '图片加载失败', icon: 'none' })
    showImagePreview.value = false
  } finally {
    imageLoading.value = false
  }
}

function navigateToSegment(path: string) {
  loadFiles(path)
}

function goBack() {
  if (isSelectMode.value) {
    selectedItems.value.clear()
    isSelectMode.value = false
    return
  }
  if (currentPath.value === SAKURA_ROOT) {
    uni.navigateBack()
    return
  }
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

async function deleteSelected() {
  if (selectedItems.value.size === 0) return
  uni.showModal({
    title: '批量删除',
    content: `确定要删除选中的 ${selectedItems.value.size} 个文件/文件夹吗？此操作不可恢复！`,
    confirmColor: '#ff6b6b',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '删除中...' })
      try {
        const paths = Array.from(selectedItems.value)
        for (const path of paths) {
          await deleteFile(path, true)
        }
        uni.hideLoading()
        uni.showToast({ title: `已删除 ${paths.length} 项`, icon: 'success' })
        loadFiles(currentPath.value)
      } catch (e: any) {
        uni.hideLoading()
        uni.showToast({ title: e.message || '删除失败', icon: 'none' })
      }
    }
  })
}

function copySelectedPaths() {
  const paths = Array.from(selectedItems.value).join('\n')
  uni.setClipboardData({
    data: paths,
    success: () => {
      uni.showToast({ title: '路径已复制', icon: 'success' })
      selectedItems.value.clear()
      isSelectMode.value = false
    }
  })
}

function cancelSelect() {
  selectedItems.value.clear()
  isSelectMode.value = false
}

function openExternal() {
  openExternalFileManager(currentPath.value)
}

async function importFromExternal() {
  try {
    uni.showLoading({ title: '选择文件...' })
    const imported = await chooseAndImport(currentPath.value, '*/*', true)
    uni.hideLoading()
    if (imported.length > 0) {
      uni.showToast({ title: `已导入 ${imported.length} 个文件`, icon: 'success' })
      loadFiles(currentPath.value)
    } else {
      uni.showToast({ title: '未选择文件', icon: 'none' })
    }
  } catch (e: any) {
    uni.hideLoading()
    if (e?.message !== 'User cancelled') {
      uni.showToast({ title: '导入失败: ' + (e?.message || ''), icon: 'none' })
    }
  }
}

function openCreateDialog(type: 'folder' | 'file') {
  createType.value = type
  createName.value = ''
  showCreateDialog.value = true
}

async function confirmCreate() {
  const name = createName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }
  const newPath = `${currentPath.value}/${name}`
  try {
    if (createType.value === 'folder') {
      const ok = await pluginMkdir(newPath)
      if (!ok) throw new Error('创建失败')
    } else {
      // #ifdef APP-PLUS
      const fs = plus.io.getFileSystemManager()
      await new Promise<void>((resolve, reject) => {
        fs.writeFile({
          filePath: newPath,
          data: '',
          encoding: 'utf-8',
          success: () => resolve(),
          fail: (e: any) => reject(new Error(e.message))
        })
      })
      // #endif
    }
    showCreateDialog.value = false
    uni.showToast({ title: '已创建', icon: 'success' })
    loadFiles(currentPath.value)
  } catch (e: any) {
    uni.showToast({ title: e.message || '创建失败', icon: 'none' })
  }
}

function openRenameDialog(item: FileItem) {
  renameTarget.value = item
  renameName.value = item.name
  showRenameDialog.value = true
}

async function confirmRename() {
  if (!renameTarget.value) return
  const newName = renameName.value.trim()
  if (!newName || newName === renameTarget.value.name) {
    showRenameDialog.value = false
    return
  }
  const newPath = `${currentPath.value}/${newName}`
  try {
    const ok = await pluginRename(renameTarget.value.path, newPath)
    if (!ok) throw new Error('重命名失败')
    showRenameDialog.value = false
    uni.showToast({ title: '已重命名', icon: 'success' })
    loadFiles(currentPath.value)
  } catch (e: any) {
    uni.showToast({ title: e.message || '重命名失败', icon: 'none' })
  }
}

async function extractZip(item: FileItem) {
  const ext = item.name.split('.').pop()?.toLowerCase()
  if (ext !== 'zip') {
    uni.showToast({ title: '仅支持 zip 格式', icon: 'none' })
    return
  }
  uni.showModal({
    title: '解压文件',
    content: `解压 "${item.name}" 到当前目录？`,
    success: async (r) => {
      if (!r.confirm) return
      uni.showLoading({ title: '解压中...' })
      try {
        const destDir = `${currentPath.value}/${item.name.replace(/\.zip$/i, '')}`
        const result = await unzip(item.path, destDir)
        uni.hideLoading()
        uni.showToast({ title: `已解压 ${result.fileCount} 个文件`, icon: 'success' })
        loadFiles(currentPath.value)
      } catch (e: any) {
        uni.hideLoading()
        uni.showToast({ title: e.message || '解压失败', icon: 'none' })
      }
    }
  })
}

async function shareItem(item: FileItem) {
  const ok = await shareFile(item.path, '分享 ' + item.name)
  if (!ok) {
    uni.showToast({ title: '分享失败', icon: 'none' })
  }
}

function showItemActions(item: FileItem) {
  const actions = ['打开', '重命名', '分享', '删除']
  const ext = item.name.split('.').pop()?.toLowerCase()
  if (ext === 'zip') {
    actions.splice(1, 0, '解压到此处')
  }
  uni.showActionSheet({
    itemList: actions,
    success: (res) => {
      const action = actions[res.tapIndex]
      if (action === '打开') navigateTo(item)
      else if (action === '解压到此处') extractZip(item)
      else if (action === '重命名') openRenameDialog(item)
      else if (action === '分享') shareItem(item)
      else if (action === '删除') deleteItem(item)
    }
  })
}

function changeSortMode(mode: 'name' | 'size' | 'time') {
  if (sortMode.value === mode) {
    sortAsc.value = !sortAsc.value
  } else {
    sortMode.value = mode
    sortAsc.value = true
  }
  showSortMenu.value = false
}

function getSortLabel(): string {
  const labels = { name: '名称', size: '大小', time: '时间' }
  return `${labels[sortMode.value]} ${sortAsc.value ? '↑' : '↓'}`
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onLoad((options: any) => {
  if (options?.path) {
    try {
      const path = decodeURIComponent(options.path)
      if (path.startsWith('/')) {
        currentPath.value = path
      }
    } catch (e) {
      console.warn('[Files] Invalid path parameter')
    }
  }
})

onMounted(() => {
  loadFiles(currentPath.value)
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
        <text class="back-btn" @tap="goBack">‹</text>
        <text class="page-title">文件管理</text>
      </view>
      <view class="header-actions">
        <text class="action-btn" @tap="importFromExternal">📥</text>
        <text class="action-btn" @tap="openExternal">🔗</text>
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
    
    <view class="path-bar">
      <text class="path-bar__text">{{ currentPath }}</text>
    </view>

    <!-- 工具栏：搜索 + 排序 + 新建 -->
    <view class="toolbar">
      <view class="toolbar__search">
        <text class="toolbar__search-icon">🔍</text>
        <input
          class="toolbar__search-input"
          v-model="searchKeyword"
          placeholder="搜索当前目录..."
          placeholder-class="toolbar__search-ph"
          confirm-type="search"
        />
        <text v-if="searchKeyword" class="toolbar__search-clear" @tap="searchKeyword = ''">✕</text>
      </view>
      <view class="toolbar__btn" @tap="showSortMenu = !showSortMenu">
        <text class="toolbar__btn-icon">↕</text>
        <text class="toolbar__btn-text">{{ getSortLabel() }}</text>
      </view>
      <view class="toolbar__btn" @tap="openCreateDialog('folder')">
        <text class="toolbar__btn-icon">📁</text>
        <text class="toolbar__btn-text">新建</text>
      </view>
    </view>

    <!-- 排序菜单 -->
    <view v-if="showSortMenu" class="sort-menu-mask" @tap="showSortMenu = false">
      <view class="sort-menu" @tap.stop>
        <view class="sort-menu__item" @tap="changeSortMode('name')">
          <text>名称</text>
          <text v-if="sortMode === 'name'" class="sort-menu__mark">{{ sortAsc ? '↑' : '↓' }}</text>
        </view>
        <view class="sort-menu__item" @tap="changeSortMode('size')">
          <text>大小</text>
          <text v-if="sortMode === 'size'" class="sort-menu__mark">{{ sortAsc ? '↑' : '↓' }}</text>
        </view>
        <view class="sort-menu__item" @tap="changeSortMode('time')">
          <text>修改时间</text>
          <text v-if="sortMode === 'time'" class="sort-menu__mark">{{ sortAsc ? '↑' : '↓' }}</text>
        </view>
      </view>
    </view>

    <view v-if="isSelectMode" class="select-bar">
      <view class="select-bar__left">
        <text class="select-bar__count">已选 {{ selectedCount }} 项</text>
      </view>
      <view class="select-bar__actions">
        <text class="select-bar__btn" @tap="copySelectedPaths">复制路径</text>
        <text class="select-bar__btn select-bar__btn--danger" @tap="deleteSelected">删除</text>
        <text class="select-bar__btn select-bar__btn--primary" @tap="cancelSelect">取消</text>
      </view>
    </view>
    
    <scroll-view scroll-y class="file-list" @refresherrefresh="loadFiles(currentPath)" :refresher-enabled="true" :refresher-triggered="loading">
      <view v-if="loading" class="empty">
        <text>加载中...</text>
      </view>
      
      <view v-else-if="filteredFiles.length === 0" class="empty">
        <text class="empty-icon">📂</text>
        <text class="empty-text">{{ searchKeyword ? '未找到匹配的文件' : '空文件夹' }}</text>
      </view>

      <view v-else>
        <view
          v-for="item in filteredFiles"
          :key="item.path"
          class="file-item"
          :class="{
            'file-item--dir': item.isDir,
            'file-item--selected': isSelected(item),
            'file-item--selectable': isSelectMode
          }"
          @tap="navigateTo(item)"
          @longpress="showItemActions(item)"
        >
          <view class="file-item__checkbox" v-if="isSelectMode">
            <text v-if="isSelected(item)" class="checkbox-icon">✓</text>
          </view>
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
          <text v-if="!item.isDir && !isSelectMode" class="file-item__view">👁</text>
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

    <!-- 新建对话框 -->
    <view v-if="showCreateDialog" class="dialog-mask" @tap="showCreateDialog = false">
      <view class="dialog-panel" @tap.stop>
        <view class="dialog-header">
          <text class="dialog-title">{{ createType === 'folder' ? '新建文件夹' : '新建文件' }}</text>
          <text class="dialog-close" @tap="showCreateDialog = false">✕</text>
        </view>
        <view class="dialog-body">
          <input
            class="dialog-input"
            v-model="createName"
            :placeholder="createType === 'folder' ? '请输入文件夹名称' : '请输入文件名（含扩展名）'"
            placeholder-class="dialog-input-ph"
            :focus="showCreateDialog"
          />
        </view>
        <view class="dialog-actions">
          <view class="dialog-btn" @tap="showCreateDialog = false">
            <text>取消</text>
          </view>
          <view class="dialog-btn dialog-btn--primary" @tap="confirmCreate">
            <text>确定</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 重命名对话框 -->
    <view v-if="showRenameDialog && renameTarget" class="dialog-mask" @tap="showRenameDialog = false">
      <view class="dialog-panel" @tap.stop>
        <view class="dialog-header">
          <text class="dialog-title">重命名</text>
          <text class="dialog-close" @tap="showRenameDialog = false">✕</text>
        </view>
        <view class="dialog-body">
          <input
            class="dialog-input"
            v-model="renameName"
            placeholder="请输入新名称"
            placeholder-class="dialog-input-ph"
            :focus="showRenameDialog"
          />
        </view>
        <view class="dialog-actions">
          <view class="dialog-btn" @tap="showRenameDialog = false">
            <text>取消</text>
          </view>
          <view class="dialog-btn dialog-btn--primary" @tap="confirmRename">
            <text>确定</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 图片预览弹窗 -->
    <view v-if="showImagePreview" class="image-mask" @tap="showImagePreview = false">
      <view class="image-panel" @tap.stop>
        <view class="image-header">
          <text class="image-title">{{ previewImage?.name }}</text>
          <text class="image-close" @tap="showImagePreview = false">✕</text>
        </view>
        <view class="image-content">
          <view v-if="imageLoading" class="image-loading">
            <text>加载中...</text>
          </view>
          <image
            v-else-if="previewImage?.base64"
            class="image-preview"
            :src="previewImage.base64"
            mode="aspectFit"
          />
          <view v-else class="image-loading">
            <text>无法显示图片</text>
          </view>
        </view>
        <view class="image-actions">
          <view class="dialog-btn dialog-btn--primary" @tap="showImagePreview = false">
            <text>关闭</text>
          </view>
        </view>
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

.path-bar {
  padding: 12rpx 32rpx;
  background: rgba(0, 0, 0, 0.3);
  
  &__text {
    font-size: 22rpx;
    color: rgba(255, 183, 213, 0.7);
    font-family: 'Consolas', 'Monaco', monospace;
    word-break: break-all;
    display: block;
  }
}

.select-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 32rpx;
  background: rgba(255, 183, 213, 0.15);
  border-bottom: 2rpx solid rgba(255, 183, 213, 0.3);
  
  &__left {
    flex: 1;
  }
  
  &__count {
    font-size: 26rpx;
    color: #ffb7d5;
    font-weight: 600;
  }
  
  &__actions {
    display: flex;
    gap: 16rpx;
  }
  
  &__btn {
    font-size: 24rpx;
    color: #fff;
    padding: 10rpx 20rpx;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8rpx;
    
    &--danger {
      background: rgba(255, 107, 107, 0.3);
      color: #ff6b6b;
    }
    
    &--primary {
      background: linear-gradient(135deg, #ffb7d5, #ff8fab);
      color: #fff;
      font-weight: 600;
    }
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
  transition: background 0.2s;
  
  &:active {
    background: rgba(255, 183, 213, 0.05);
  }
  
  &--dir {
    .file-item__name {
      color: #ffb7d5;
      font-weight: 600;
    }
  }
  
  &--selected {
    background: rgba(255, 183, 213, 0.15);
    border-bottom-color: rgba(255, 183, 213, 0.2);
  }
  
  &__checkbox {
    width: 44rpx;
    height: 44rpx;
    border: 3rpx solid rgba(255, 183, 213, 0.5);
    border-radius: 8rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16rpx;
    flex-shrink: 0;
    
    .file-item--selected & {
      background: linear-gradient(135deg, #ffb7d5, #ff8fab);
      border-color: transparent;
    }
  }
  
  .checkbox-icon {
    font-size: 24rpx;
    color: #fff;
    font-weight: 700;
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
    flex-shrink: 0;
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
    flex-shrink: 0;
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

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 2rpx solid rgba(255, 183, 213, 0.08);

  &__search {
    flex: 1;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 32rpx;
    padding: 8rpx 20rpx;
    gap: 8rpx;
  }

  &__search-icon {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.4);
  }

  &__search-input {
    flex: 1;
    font-size: 26rpx;
    color: #fff;
    height: 48rpx;
  }

  &__search-ph {
    color: rgba(255, 255, 255, 0.3);
  }

  &__search-clear {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.4);
    padding: 4rpx 8rpx;
  }

  &__btn {
    display: flex;
    align-items: center;
    gap: 4rpx;
    padding: 8rpx 16rpx;
    background: rgba(255, 183, 213, 0.1);
    border-radius: 24rpx;

    &:active {
      background: rgba(255, 183, 213, 0.2);
    }
  }

  &__btn-icon {
    font-size: 24rpx;
    color: #ffb7d5;
  }

  &__btn-text {
    font-size: 22rpx;
    color: #ffb7d5;
  }
}

/* 排序菜单 */
.sort-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 800;
  background: transparent;
}

.sort-menu {
  position: absolute;
  top: 200rpx;
  right: 24rpx;
  width: 280rpx;
  background: rgba(20, 18, 30, 0.98);
  border: 2rpx solid rgba(255, 183, 213, 0.3);
  border-radius: 16rpx;
  padding: 8rpx 0;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.5);

  &__item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 28rpx;
    font-size: 26rpx;
    color: #fff;

    &:active {
      background: rgba(255, 183, 213, 0.1);
    }
  }

  &__mark {
    color: #ffb7d5;
    font-weight: 700;
  }
}

/* 通用对话框 */
.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  backdrop-filter: blur(8px);
}

.dialog-panel {
  background: rgba(20, 18, 30, 0.98);
  border: 2rpx solid rgba(255, 183, 213, 0.3);
  border-radius: 20rpx;
  width: 100%;
  max-width: 560rpx;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid rgba(255, 183, 213, 0.15);
}

.dialog-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffb7d5;
}

.dialog-close {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.4);
}

.dialog-body {
  padding: 24rpx 32rpx;
}

.dialog-input {
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 2rpx solid rgba(255, 183, 213, 0.2);
  border-radius: 12rpx;
  color: #fff;
  font-size: 28rpx;
  box-sizing: border-box;
}

.dialog-input-ph {
  color: rgba(255, 255, 255, 0.3);
}

.dialog-actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 32rpx 24rpx;
}

.dialog-btn {
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

/* 图片预览 */
.image-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}

.image-panel {
  background: rgba(20, 18, 30, 0.95);
  border: 2rpx solid rgba(255, 183, 213, 0.3);
  border-radius: 20rpx;
  width: 100%;
  max-width: 680rpx;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.image-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid rgba(255, 183, 213, 0.15);
}

.image-title {
  font-size: 28rpx;
  color: #ffb7d5;
  font-weight: 600;
}

.image-close {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.4);
}

.image-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
  min-height: 400rpx;
}

.image-loading {
  color: rgba(255, 255, 255, 0.5);
  font-size: 26rpx;
}

.image-preview {
  width: 100%;
  max-height: 70vh;
}

.image-actions {
  padding: 16rpx 32rpx 24rpx;
}
</style>
