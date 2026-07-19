<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { listDirectory, readFileText, deleteFile, MINECRAFT_DIR } from '@/utils/setup'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  id: string
  time: string
  level: LogLevel
  source: string
  message: string
}

const settingsStore = useSettingsStore()
const logs = ref<LogEntry[]>([])
const availableFiles = ref<{ name: string; path: string }[]>([])
const currentFile = ref<string>('')
const loading = ref(false)
const filterLevel = ref<LogLevel | 'all'>('all')
const search = ref('')
const autoScroll = ref(true)

// 解析单行日志, 推断级别与来源
const LOG_PATTERN = /^\s*(?:(\d{2}:\d{2}:\d{2})\s+)?\[?(\w+)[/\]]+\s*\[?(INFO|WARN|WARNING|ERROR|DEBUG|TRACE)\]?\s*:?\s*(.*)$/i

function parseLine(line: string): LogEntry | null {
  if (!line.trim()) return null
  let time = ''
  let source = 'Minecraft'
  let level: LogLevel = 'info'
  let message = line

  const m = line.match(LOG_PATTERN)
  if (m) {
    if (m[1]) time = m[1]
    if (m[2]) source = m[2]
    const lv = (m[3] || '').toUpperCase()
    if (lv === 'WARN' || lv === 'WARNING') level = 'warn'
    else if (lv === 'ERROR') level = 'error'
    else if (lv === 'DEBUG' || lv === 'TRACE') level = 'debug'
    else level = 'info'
    message = m[4] || line
  } else {
    // 兜底: 提取时间戳
    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2})/)
    if (timeMatch) {
      time = timeMatch[1]
      message = line.substring(line.indexOf(time) + 8)
    }
    if (/error|exception|failed|fatal/i.test(line)) level = 'error'
    else if (/warn/i.test(line)) level = 'warn'
    else if (/debug|trace/i.test(line)) level = 'debug'
  }

  if (!time) {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  return {
    id: `${time}-${Math.random().toString(36).slice(2, 8)}`,
    time,
    level,
    source,
    message: message.trim()
  }
}

async function loadLogFiles() {
  loading.value = true
  try {
    const logsDir = settingsStore.logsDir || `${MINECRAFT_DIR}/logs`
    const entries = await listDirectory(logsDir)
    const files = entries
      .filter(e => !e.isDir && /\.log$/i.test(e.name))
      .map(e => ({ name: e.name, path: e.path }))
    availableFiles.value = files
    // 默认加载 latest.log, 若不存在则加载第一个
    const latest = files.find(f => f.name === 'latest.log') || files[0]
    if (latest) await loadLogFile(latest.path)
  } catch (e: any) {
    console.warn('[Logs] 加载日志目录失败:', e?.message || e)
    availableFiles.value = []
    logs.value = []
  } finally {
    loading.value = false
  }
}

async function loadLogFile(path: string) {
  loading.value = true
  currentFile.value = path
  try {
    const text = await readFileText(path)
    // 限制最多解析 2000 行, 避免内存压力
    const lines = text.split(/\r?\n/).slice(-2000)
    const entries: LogEntry[] = []
    for (const line of lines) {
      const entry = parseLine(line)
      if (entry) entries.push(entry)
    }
    logs.value = entries
  } catch (e: any) {
    console.warn('[Logs] 读取日志文件失败:', e?.message || e)
    logs.value = []
  } finally {
    loading.value = false
  }
}

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
    content: '确定清空当前日志文件内容？（不可恢复）',
    success: async (r) => {
      if (!r.confirm) return
      if (!currentFile.value) {
        logs.value = []
        return
      }
      // #ifdef APP-PLUS
      try {
        await deleteFile(currentFile.value)
        logs.value = []
        uni.showToast({ title: '已删除日志文件', icon: 'success' })
        await loadLogFiles()
      } catch (e: any) {
        uni.showToast({ title: '清空失败: ' + (e?.message || ''), icon: 'none' })
      }
      // #endif
      // #ifndef APP-PLUS
      logs.value = []
      uni.showToast({ title: '已清空显示', icon: 'none' })
      // #endif
    }
  })
}

async function copyLogs() {
  const text = filteredLogs.value.map(l => `[${l.time}] [${l.source}/${l.level.toUpperCase()}] ${l.message}`).join('\n')
  uni.setClipboardData({
    data: text,
    showToast: true,
    success: () => {},
    fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
  })
}

function switchFile(e: any) {
  const idx = e?.detail?.value
  if (typeof idx === 'number' && availableFiles.value[idx]) {
    loadLogFile(availableFiles.value[idx].path)
  }
}

onMounted(loadLogFiles)
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
      <view v-if="availableFiles.length > 0" class="logs__file-picker">
        <picker mode="selector" :range="availableFiles" range-key="name" @change="switchFile">
          <view class="logs__file-current">
            <text class="logs__file-icon">📄</text>
            <text class="logs__file-name">{{ currentFile ? currentFile.split('/').pop() : '选择日志文件' }}</text>
            <text class="logs__file-count">{{ availableFiles.length }} 个文件</text>
          </view>
        </picker>
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
  &__file-picker { margin-bottom: 12rpx; }
  &__file-current {
    display: flex; align-items: center; gap: 8rpx;
    padding: 12rpx 16rpx; background: rgba(255,255,255,0.06); border-radius: 10rpx;
  }
  &__file-icon { font-size: 26rpx; }
  &__file-name { flex: 1; font-size: 24rpx; color: #ffb7d5; }
  &__file-count { font-size: 22rpx; color: #888; }
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