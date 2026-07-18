<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const saves = ref([
  { id: '1', name: '生存世界', gameType: 'survival', lastPlayed: '2026-07-18 14:30', size: '128 MB', players: 1, version: '1.21.1', icon: '🌍' },
  { id: '2', name: '创造测试', gameType: 'creative', lastPlayed: '2026-07-17 20:15', size: '45 MB', players: 0, version: '1.21.1', icon: '🏗️' },
  { id: '3', name: '空岛生存', gameType: 'survival', lastPlayed: '2026-07-15 09:00', size: '256 MB', players: 2, version: '1.20.4', icon: '🏝️' },
  { id: '4', name: '红石实验', gameType: 'creative', lastPlayed: '2026-07-10 16:45', size: '12 MB', players: 0, version: '1.21.1', icon: '🔴' },
  { id: '5', name: '跑酷地图', gameType: 'adventure', lastPlayed: '2026-07-05 11:20', size: '89 MB', players: 0, version: '1.20.4', icon: '🏃' },
])

const search = ref('')
const selectedSaves = ref<Set<string>>(new Set())

const filteredSaves = computed(() => {
  if (!search.value) return saves.value
  const q = search.value.toLowerCase()
  return saves.value.filter(s => s.name.toLowerCase().includes(q) || s.version.includes(q))
})

const totalSize = computed(() => {
  const total = saves.value.reduce((sum, s) => {
    const num = parseFloat(s.size)
    return sum + (s.size.includes('MB') ? num : num * 1024)
  }, 0)
  return total > 1024 ? (total / 1024).toFixed(1) + ' GB' : total.toFixed(0) + ' MB'
})

function toggleSelect(id: string) {
  if (selectedSaves.value.has(id)) selectedSaves.value.delete(id)
  else selectedSaves.value.add(id)
}

function selectAll() {
  if (selectedSaves.value.size === saves.value.length) selectedSaves.value.clear()
  else selectedSaves.value = new Set(saves.value.map(s => s.id))
}

function backupSave(id: string) {
  const save = saves.value.find(s => s.id === id)
  if (!save) return
  uni.showLoading({ title: '正在备份...' })
  setTimeout(() => {
    uni.hideLoading()
    uni.showToast({ title: save.name + ' 备份完成!', icon: 'success' })
  }, 1500)
}

function restoreSave(id: string) {
  const save = saves.value.find(s => s.id === id)
  if (!save) return
  uni.showModal({
    title: '恢复存档',
    content: '将覆盖当前存档 ' + save.name + '，确定继续？',
    success: (r) => {
      if (r.confirm) {
        uni.showLoading({ title: '正在恢复...' })
        setTimeout(() => {
          uni.hideLoading()
          uni.showToast({ title: '恢复完成!', icon: 'success' })
        }, 1000)
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
    success: (r) => {
      if (r.confirm) {
        saves.value = saves.value.filter(s => s.id !== id)
        selectedSaves.value.delete(id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function openSavesFolder() {
  const path = settingsStore.savesDir || (settingsStore.gameDir ? settingsStore.gameDir + '/saves' : '')
  uni.showToast({ title: path ? '路径: ' + path : '请在设置中配置路径', icon: 'none' })
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
</script>

<template>
  <view class="saves">
    <view class="saves__header">
      <text class="saves__back" @tap="uni.navigateBack()">‹</text>
      <text class="saves__title">存档管理</text>
      <view class="saves__actions">
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