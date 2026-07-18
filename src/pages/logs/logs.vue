<script setup lang="ts">
import { ref, computed } from 'vue'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  id: string
  time: string
  level: LogLevel
  source: string
  message: string
}

const logs = ref<LogEntry[]>([
  { id: '1', time: '18:23:45', level: 'info', source: 'Minecraft', message: 'Loading Minecraft 1.21.1...' },
  { id: '2', time: '18:23:46', level: 'info', source: 'Minecraft', message: 'Vanilla Minecraft version: 1.21.1' },
  { id: '3', time: '18:23:47', level: 'info', source: 'Minecraft', message: 'OpenGL Version: 4.6.0 NVIDIA 546.17' },
  { id: '4', time: '18:23:48', level: 'warn', source: 'Fabric', message: 'Mod "sodium-extra" does not have a valid version range' },
  { id: '5', time: '18:23:49', level: 'info', source: 'Minecraft', message: 'Reloading ResourceManager: Default, Faithful 32x' },
  { id: '6', time: '18:23:50', level: 'info', source: 'Minecraft', message: 'Sound engine initializing' },
  { id: '7', time: '18:23:52', level: 'info', source: 'Minecraft', message: 'Created: 1024x512x4 minecraft:textures/atlas/blocks.png-atlas' },
  { id: '8', time: '18:23:55', level: 'info', source: 'Minecraft', message: 'Preparing start region for dimension minecraft:overworld' },
  { id: '9', time: '18:23:58', level: 'info', source: 'Minecraft', message: 'Changing view distance to 12, using 33 chunks' },
  { id: '10', time: '18:24:00', level: 'info', source: 'Minecraft', message: 'Setting default language: zh_cn' },
  { id: '11', time: '18:24:02', level: 'warn', source: 'Sodium', message: 'Skipping incompatibly named option: biome_blend_radius' },
  { id: '12', time: '18:24:05', level: 'info', source: 'Minecraft', message: 'Done! (24.5s) For help, type "help"' },
  { id: '13', time: '18:30:15', level: 'error', source: 'Minecraft', message: 'Ticking entity: java.lang.NullPointerException at entity.Tick()' },
  { id: '14', time: '18:30:16', level: 'error', source: 'Minecraft', message: 'Saved the game' },
  { id: '15', time: '18:30:16', level: 'info', source: 'Minecraft', message: 'Stopping!' },
])

const filterLevel = ref<LogLevel | 'all'>('all')
const search = ref('')
const autoScroll = ref(true)

const filteredLogs = computed(() => {
  let result = logs.value
  if (filterLevel.value !== 'all') {
    result = result.filter(l => l.level === filterLevel.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(l => l.message.toLowerCase().includes(q) || l.source.toLowerCase().includes(q))
  }
  return result
})

const logCounts = computed(() => ({
  all: logs.value.length,
  info: logs.value.filter(l => l.level === 'info').length,
  warn: logs.value.filter(l => l.level === 'warn').length,
  error: logs.value.filter(l => l.level === 'error').length,
}))

function getLevelClass(level: LogLevel) {
  return {
    'log-entry__level--info': level === 'info',
    'log-entry__level--warn': level === 'warn',
    'log-entry__level--error': level === 'error',
    'log-entry__level--debug': level === 'debug',
  }
}

function getLevelLabel(level: LogLevel) {
  const map: Record<LogLevel, string> = { info: 'INFO', warn: 'WARN', error: 'ERROR', debug: 'DEBUG' }
  return map[level]
}

function clearLogs() {
  uni.showModal({
    title: '清空日志',
    content: '确定清空所有日志？（仅清空客户端显示）',
    success: (r) => { if (r.confirm) logs.value = [] }
  })
}

function copyLogs() {
  const text = filteredLogs.value.map(l => `[${l.time}] [${l.source}/${l.level.toUpperCase()}] ${l.message}`).join('\n')
  uni.setClipboardData({ data: text, showToast: true })
}
</script>

<template>
  <view class="logs">
    <view class="logs__header">
      <text class="logs__back" @tap="uni.navigateBack()">‹</text>
      <text class="logs__title">日志查看器</text>
      <view class="logs__actions">
        <view class="logs__action-btn" @tap="copyLogs">
          <text>📋</text>
        </view>
        <view class="logs__action-btn" @tap="clearLogs">
          <text>🗑️</text>
        </view>
      </view>
    </view>

    <view class="logs__filter">
      <view class="logs__filter-tabs">
        <view class="logs__filter-tab" :class="{ 'logs__filter-tab--active': filterLevel === 'all' }" @tap="filterLevel = 'all'">
          <text>全部</text>
          <text class="logs__filter-count">{{ logCounts.all }}</text>
        </view>
        <view class="logs__filter-tab" :class="{ 'logs__filter-tab--active': filterLevel === 'info' }" @tap="filterLevel = 'info'">
          <text>信息</text>
          <text class="logs__filter-count logs__filter-count--info">{{ logCounts.info }}</text>
        </view>
        <view class="logs__filter-tab" :class="{ 'logs__filter-tab--active': filterLevel === 'warn' }" @tap="filterLevel = 'warn'">
          <text>警告</text>
          <text class="logs__filter-count logs__filter-count--warn">{{ logCounts.warn }}</text>
        </view>
        <view class="logs__filter-tab" :class="{ 'logs__filter-tab--active': filterLevel === 'error' }" @tap="filterLevel = 'error'">
          <text>错误</text>
          <text class="logs__filter-count logs__filter-count--error">{{ logCounts.error }}</text>
        </view>
      </view>
      <view class="logs__search-row">
        <input class="logs__search" v-model="search" placeholder="搜索日志内容..." placeholder-style="color: #666" />
        <view class="logs__auto-scroll" :class="{ 'logs__auto-scroll--on': autoScroll }" @tap="autoScroll = !autoScroll">
          <text>{{ autoScroll ? '自动滚动' : '手动' }}</text>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="logs__list" :scroll-into-view="autoScroll ? 'log-bottom' : undefined">
      <view 
        v-for="log in filteredLogs" 
        :key="log.id" 
        class="log-entry"
        :class="getLevelClass(log.level)"
      >
        <text class="log-entry__time">{{ log.time }}</text>
        <text class="log-entry__level" :class="getLevelClass(log.level)">{{ getLevelLabel(log.level) }}</text>
        <text class="log-entry__source">[{{ log.source }}]</text>
        <text class="log-entry__msg">{{ log.message }}</text>
      </view>
      <view id="log-bottom" />
      <view v-if="filteredLogs.length === 0" class="logs__empty">
        <text class="logs__empty-icon">📝</text>
        <text class="logs__empty-text">没有匹配的日志</text>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.logs {
  height: 100vh; display: flex; flex-direction: column;
  background: #0a0a14;

  &__header { display: flex; align-items: center; padding: 60rpx 24rpx 16rpx; }
  &__back { font-size: 48rpx; color: #ffb7d5; margin-right: 16rpx; padding: 0 8rpx; }
  &__title { flex: 1; font-size: 44rpx; font-weight: 700; color: #fff; }
  &__actions { display: flex; gap: 12rpx; }
  &__action-btn {
    width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.06); border-radius: 16rpx; font-size: 32rpx;
  }
  &__filter { padding: 0 24rpx 12rpx; }
  &__filter-tabs { display: flex; gap: 8rpx; margin-bottom: 12rpx; }
  &__filter-tab {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6rpx;
    padding: 12rpx 8rpx; font-size: 24rpx; color: #888;
    background: rgba(255,255,255,0.04); border-radius: 10rpx; border: 2rpx solid transparent;
    &--active { border-color: rgba(255,183,213,0.3); color: #ffb7d5; background: rgba(255,183,213,0.08); }
  }
  &__filter-count {
    font-size: 20rpx; background: rgba(255,255,255,0.08); padding: 2rpx 10rpx; border-radius: 12rpx;
    &--info { background: rgba(100,200,255,0.15); color: #64c8ff; }
    &--warn { background: rgba(255,200,100,0.15); color: #ffcc44; }
    &--error { background: rgba(255,100,100,0.15); color: #ff6464; }
  }
  &__search-row { display: flex; gap: 12rpx; }
  &__search {
    flex: 1; height: 64rpx; background: rgba(255,255,255,0.06); border-radius: 10rpx;
    padding: 0 20rpx; font-size: 26rpx; color: #fff; box-sizing: border-box;
  }
  &__auto-scroll {
    height: 64rpx; padding: 0 16rpx; display: flex; align-items: center; justify-content: center;
    border-radius: 10rpx; font-size: 22rpx; color: #888; background: rgba(255,255,255,0.06);
    &--on { color: #ffb7d5; background: rgba(255,183,213,0.1); }
  }
  &__list { flex: 1; padding: 0 24rpx 40rpx; font-family: monospace; }
  &__empty { text-align: center; padding: 120rpx 0; }
  &__empty-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
  &__empty-text { font-size: 30rpx; color: #fff; display: block; }
}

.log-entry {
  display: flex; gap: 8rpx; padding: 8rpx 0; font-size: 22rpx; line-height: 1.6;
  border-bottom: 2rpx solid rgba(255,255,255,0.02);

  &__time { color: #6a5a8a; flex-shrink: 0; }
  &__level { flex-shrink: 0; font-weight: 600; width: 48rpx; text-align: center; }
  &__level--info { color: #64c8ff; }
  &__level--warn { color: #ffcc44; }
  &__level--error { color: #ff6464; }
  &__level--debug { color: #888; }
  &__source { color: #b8a8d4; flex-shrink: 0; }
  &__msg { color: #ccc; flex: 1; }
}
</style>