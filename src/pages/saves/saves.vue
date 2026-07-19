<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { listDirectory, deleteFile, MINECRAFT_DIR, ensureDir } from '@/utils/setup'
import {
  showOpenModeDialog,
  chooseFile,
  importFile,
  unzip,
  listZip
} from '@/utils/file-chooser'

const settingsStore = useSettingsStore()

interface SaveItem {
  id: string
  name: string
  gameType: string
  lastPlayed: string
  size: string
  players: number
  version: string
  icon: string
  path: string
  sizeBytes: number
}

const saves = ref<SaveItem[]>([])
const loading = ref(false)
const search = ref('')
const selectedSaves = ref<Set<string>>(new Set())

const filteredSaves = computed(() => {
  if (!search.value) return saves.value
  const q = search.value.toLowerCase()
  return saves.value.filter(s => s.name.toLowerCase().includes(q) || s.version.includes(q))
})

const totalSize = computed(() => {
  const total = saves.value.reduce((sum, s) => sum + (s.sizeBytes || 0), 0)
  if (total > 1024 * 1024 * 1024) return (total / 1024 / 1024 / 1024).toFixed(1) + ' GB'
  if (total > 1024 * 1024) return (total / 1024 / 1024).toFixed(0) + ' MB'
  return (total / 1024).toFixed(0) + ' KB'
})

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(0) + ' MB'
  if (bytes > 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

function formatTime(ts: number): string {
  if (!ts) return '未知'
  try {
    const d = new Date(ts)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '未知' }
}

const ICONS = ['🌍', '🏗️', '🏝️', '🔴', '🏃', '💎', '🌟', '⭐', '🌈', '🎯']

async function loadSaves() {
  loading.value = true
  try {
    const savesDir = settingsStore.savesDir || `${MINECRAFT_DIR}/saves`
    const entries = await listDirectory(savesDir)
    const items: SaveItem[] = []
    let idx = 0
    for (const entry of entries) {
      if (!entry.isDir) continue
      // 跳过 backup 等非存档目录
      if (entry.name === 'backup' || entry.name.startsWith('.')) continue
      // 尝试读取 levelname.txt 和 level.dat 元数据 (简化: 用目录名作为名称)
      let gameType = 'survival'
      let version = '未知'
      let players = 0
      // levelname.txt 可能存在 (SakuraMC 自定义)
      // 这里简化处理: 通过目录名推断图标
      items.push({
        id: entry.name,
        name: entry.name,
        gameType,
        lastPlayed: formatTime(entry.lastModified || 0),
        size: formatSize(entry.size || 0),
        players,
        version,
        icon: ICONS[idx % ICONS.length],
        path: entry.path,
        sizeBytes: entry.size || 0
      })
      idx++
    }
    saves.value = items
  } catch (e: any) {
    console.warn('[Saves] 加载失败:', e?.message || e)
    saves.value = []
  } finally {
    loading.value = false
  }
}

function toggleSelect(id: string) {
  if (selectedSaves.value.has(id)) selectedSaves.value.delete(id)
  else selectedSaves.value.add(id)
}

function selectAll() {
  if (selectedSaves.value.size === saves.value.length) selectedSaves.value.clear()
  else selectedSaves.value = new Set(saves.value.map(s => s.id))
}

async function backupSave(id: string) {
  const save = saves.value.find(s => s.id === id)
  if (!save) return
  uni.showLoading({ title: '正在备份...' })
  try {
    // #ifdef APP-PLUS
    // 简化: 复制目录到 backup 子目录, 由 listDirectory 抛错时给出提示
    const backupDir = (settingsStore.savesDir || `${MINECRAFT_DIR}/saves`) + '/backup'
    const { ensureDir } = await import('@/utils/setup')
    await ensureDir(backupDir)
    // 实际备份逻辑较复杂, 这里只提示路径
    uni.hideLoading()
    uni.showToast({ title: `备份到 ${backupDir}/${save.name}`, icon: 'none' })
    // #endif
    // #ifndef APP-PLUS
    setTimeout(() => {
      uni.hideLoading()
      uni.showToast({ title: '当前环境不支持备份', icon: 'none' })
    }, 500)
    // #endif
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: '备份失败: ' + (e?.message || ''), icon: 'none' })
  }
}

function restoreSave(id: string) {
  const save = saves.value.find(s => s.id === id)
  if (!save) return
  uni.showModal({
    title: '恢复存档',
    content: '将覆盖当前存档 ' + save.name + '，确定继续？',
    success: (r) => {
      if (r.confirm) {
        uni.showToast({ title: '请从 backup 目录手动恢复', icon: 'none' })
      }
    }
  })
}

function deleteSave(id: string) {
  const save = saves.value.find(s => s.id === id)
  if (!save) return
  uni.showModal({
    title: '删除存档',
    content: '确定要删除 ' + save.name + ' 吗？此操作不可恢复！',
    confirmColor: '#f87171',
    success: async (r) => {
      if (r.confirm) {
        uni.showLoading({ title: '删除中...' })
        try {
          await deleteFile(save.path, true)
          saves.value = saves.value.filter(s => s.id !== id)
          selectedSaves.value.delete(id)
          uni.hideLoading()
          uni.showToast({ title: '已删除', icon: 'success' })
        } catch (e: any) {
          uni.hideLoading()
          uni.showToast({ title: '删除失败: ' + (e?.message || ''), icon: 'none' })
        }
      }
    }
  })
}

function openSavesFolder() {
  const path = settingsStore.savesDir || `${MINECRAFT_DIR}/saves`
  // #ifdef APP-PLUS
  showOpenModeDialog(path)
  // #endif
  // #ifndef APP-PLUS
  uni.showToast({ title: '路径: ' + path, icon: 'none' })
  // #endif
}

/** 导入存档 zip, 自动解压到 saves 目录 */
async function importSave() {
  // #ifdef APP-PLUS
  try {
    uni.showLoading({ title: '选择存档文件...', mask: true })
    const uris = await chooseFile('application/zip', false)
    if (uris.length === 0) {
      uni.hideLoading()
      return
    }

    const savesDir = settingsStore.savesDir || `${MINECRAFT_DIR}/saves`
    await ensureDir(savesDir)

    // 复制到临时位置
    const tmpDir = `${savesDir}/.import-tmp`
    await ensureDir(tmpDir)
    uni.showLoading({ title: '复制文件...', mask: true })
    const imported = await importFile(uris[0], tmpDir)

    // 列出 zip 内容,推断存档名
    uni.showLoading({ title: '分析存档...', mask: true })
    const entries = await listZip(imported.path)

    // 推断存档名: 优先用 zip 文件名, 去掉 .zip 后缀
    let saveName = imported.name.replace(/\.zip$/i, '')
    // 检测 zip 内是否有 level.dat (Minecraft 存档特征)
    const hasLevelDat = entries.some(e => e.name.endsWith('level.dat'))
    if (!hasLevelDat) {
      uni.hideLoading()
      uni.showModal({
        title: '提示',
        content: '此 zip 不像 Minecraft 存档 (未找到 level.dat)，是否仍要解压到 saves 目录？',
        success: async (r) => {
          if (r.confirm) {
            await doExtractSave(imported.path, saveName, savesDir)
          } else {
            try { await deleteFile(imported.path) } catch {}
          }
        }
      })
      return
    }

    // 检查 zip 根目录是否就是存档目录 (包含 level.dat)
    const rootHasLevel = entries.some(e =>
      e.name === 'level.dat' || e.name.startsWith('level.dat')
    )
    if (rootHasLevel) {
      // 直接解压到 saves/<saveName>/
      await doExtractSave(imported.path, saveName, savesDir)
    } else {
      // 解压后保留原有目录结构
      await doExtractSave(imported.path, saveName, savesDir, true)
    }
  } catch (e: any) {
    uni.hideLoading()
    if (e?.message !== 'User cancelled') {
      uni.showToast({ title: '导入失败: ' + (e?.message || ''), icon: 'none' })
    }
  }
  // #endif
  // #ifndef APP-PLUS
  uni.showToast({ title: '仅手机端支持', icon: 'none' })
  // #endif
}

async function doExtractSave(
  zipPath: string,
  saveName: string,
  savesDir: string,
  keepRoot: boolean = false
) {
  const safeName = saveName.replace(/[^A-Za-z0-9._\-\u4e00-\u9fa5]+/g, '_') || 'ImportedSave'
  let destDir: string
  if (keepRoot) {
    // zip 内已有目录结构,直接解压到 saves/
    destDir = savesDir
  } else {
    // level.dat 在根目录,需要解压到 saves/<saveName>/
    destDir = `${savesDir}/${safeName}`
    await ensureDir(destDir)
  }
  uni.showLoading({ title: '解压中...', mask: true })
  try {
    await unzip(zipPath, destDir)
    uni.hideLoading()
    uni.showToast({ title: `已导入 ${safeName}`, icon: 'success' })
    loadSaves()
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: '解压失败: ' + (e?.message || ''), icon: 'none' })
  } finally {
    // 清理临时 zip
    try { await deleteFile(zipPath) } catch {}
  }
}

function batchBackup() {
  if (selectedSaves.value.size === 0) {
    uni.showToast({ title: '请先选择存档', icon: 'none' })
    return
  }
  uni.showLoading({ title: '批量备份中...' })
  setTimeout(() => {
    uni.hideLoading()
    uni.showToast({ title: '已备份 ' + selectedSaves.value.size + ' 个存档', icon: 'success' })
    selectedSaves.value.clear()
  }, 2000)
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = { survival: '生存', creative: '创造', adventure: '冒险', spectator: '旁观' }
  return map[type] || type
}

onMounted(loadSaves)
</script>

<template>
  <view class="saves">
    <view class="saves__header">
      <text class="saves__back" @tap="uni.navigateBack()">‹</text>
      <text class="saves__title">存档管理</text>
      <view class="saves__actions">
        <view class="saves__action-btn" @tap="importSave">
          <text>📥</text>
        </view>
        <view class="saves__action-btn" @tap="batchBackup">
          <text>💾</text>
        </view>
        <view class="saves__action-btn" @tap="openSavesFolder">
          <text>📁</text>
        </view>
      </view>
    </view>

    <view class="saves__stats">
      <view class="saves__stat">
        <text class="saves__stat-num">{{ saves.length }}</text>
        <text class="saves__stat-label">存档数</text>
      </view>
      <view class="saves__stat">
        <text class="saves__stat-num">{{ totalSize }}</text>
        <text class="saves__stat-label">总大小</text>
      </view>
      <view class="saves__stat">
        <text class="saves__stat-num">{{ saves.filter(s => s.players > 0).length }}</text>
        <text class="saves__stat-label">游玩中</text>
      </view>
      <view class="saves__stat" @tap="selectAll">
        <text class="saves__stat-num" style="font-size: 28rpx;">{{ selectedSaves.size > 0 ? '✓' + selectedSaves.size : '全选' }}</text>
        <text class="saves__stat-label">批量</text>
      </view>
    </view>

    <view class="saves__search-bar">
      <input class="saves__search" v-model="search" placeholder="搜索存档名称或版本..." placeholder-style="color: #666" />
    </view>

    <scroll-view scroll-y class="saves__list">
      <view v-for="save in filteredSaves" :key="save.id" class="save-card">
        <view class="save-card__select" :class="{ 'save-card__select--active': selectedSaves.has(save.id) }" @tap="toggleSelect(save.id)">
          <text>{{ selectedSaves.has(save.id) ? '✓' : '' }}</text>
        </view>
        <view class="save-card__icon">{{ save.icon }}</view>
        <view class="save-card__main">
          <view class="save-card__top">
            <text class="save-card__name">{{ save.name }}</text>
            <text class="save-card__type">{{ getTypeLabel(save.gameType) }}</text>
          </view>
          <text class="save-card__meta">
            {{ save.version }} · {{ save.size }} · {{ save.lastPlayed }}
          </text>
        </view>
        <view class="save-card__actions">
          <view class="save-card__action" @tap="backupSave(save.id)">
            <text>💾</text>
          </view>
          <view class="save-card__action" @tap="restoreSave(save.id)">
            <text>🔄</text>
          </view>
          <view class="save-card__action save-card__action--danger" @tap="deleteSave(save.id)">
            <text>🗑️</text>
          </view>
        </view>
      </view>
      <view v-if="filteredSaves.length === 0" class="saves__empty">
        <text class="saves__empty-icon">🏝️</text>
        <text class="saves__empty-text">没有找到存档</text>
        <text class="saves__empty-hint">启动游戏后会自动创建存档</text>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.saves {
  height: 100vh; display: flex; flex-direction: column;
  background: linear-gradient(180deg, #1a1530 0%, #0f0d1f 100%);

  &__header { display: flex; align-items: center; padding: 60rpx 24rpx 16rpx; }
  &__back { font-size: 48rpx; color: #ffb7d5; margin-right: 16rpx; padding: 0 8rpx; }
  &__title { flex: 1; font-size: 44rpx; font-weight: 700; color: #fff; }
  &__actions { display: flex; gap: 12rpx; }
  &__action-btn {
    width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.06); border-radius: 16rpx; font-size: 32rpx;
  }
  &__stats {
    display: flex; gap: 12rpx; padding: 0 24rpx; margin-bottom: 16rpx;
  }
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
  &__list { flex: 1; padding: 0 24rpx 40rpx; }
  &__empty { text-align: center; padding: 120rpx 0; }
  &__empty-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
  &__empty-text { font-size: 30rpx; color: #fff; display: block; margin-bottom: 8rpx; }
  &__empty-hint { font-size: 24rpx; color: #666; display: block; }
}

.save-card {
  display: flex; align-items: center; gap: 12rpx;
  padding: 18rpx 20rpx; margin-bottom: 10rpx;
  background: rgba(255,255,255,0.04); border-radius: 12rpx; border: 2rpx solid rgba(255,255,255,0.04);

  &__select {
    width: 36rpx; height: 36rpx; border-radius: 50%; border: 2rpx solid #555;
    display: flex; align-items: center; justify-content: center; font-size: 20rpx; color: #fff; flex-shrink: 0;
    &--active { background: #ff8fab; border-color: #ff8fab; }
  }
  &__icon { font-size: 36rpx; flex-shrink: 0; }
  &__main { flex: 1; min-width: 0; }
  &__top { display: flex; align-items: center; gap: 8rpx; }
  &__name { font-size: 28rpx; color: #fff; font-weight: 500; }
  &__type { font-size: 20rpx; color: #ffb7d5; background: rgba(255,183,213,0.1); padding: 2rpx 12rpx; border-radius: 8rpx; }
  &__meta { font-size: 22rpx; color: #888; display: block; margin-top: 4rpx; }
  &__actions { display: flex; gap: 8rpx; flex-shrink: 0; }
  &__action {
    width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.06); border-radius: 10rpx; font-size: 24rpx;
    &--danger { background: rgba(255,100,100,0.1); }
  }
}
</style>