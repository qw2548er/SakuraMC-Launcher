<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useVersionStore } from '@/stores/version'
import { useJavaStore } from '@/stores/java'
import { APP_VERSION } from '@/utils/updater'
import { detectPlatform, formatBytes } from '@/utils/format'
import { getDefaultGameDir, getDefaultLauncherDir } from '@/utils/path'
import { recommendJavaVersion, detectSystemJava } from '@/utils/java'
import { deleteFile, ensureDir, MINECRAFT_DIR, LAUNCHER_CACHE_DIR, SAKURA_ROOT } from '@/utils/setup'
import { showOpenModeDialog, chooseAndImportImage } from '@/utils/file-chooser'

const settingsStore = useSettingsStore()
const versionStore = useVersionStore()
const javaStore = useJavaStore()

const activeTab = ref('game')

const tabs = [
  { id: 'game', label: '游戏设置', icon: '🎮' },
  { id: 'version', label: '管理版本', icon: '📦' },
  { id: 'auto', label: '自动安装', icon: '🔧' },
  { id: 'custom', label: '自定义', icon: '⚙️' }
]

// 下载源 picker
const sourceOptions = [
  { label: 'Mojang 官方', value: 'mojang' },
  { label: 'BMCL 镜像', value: 'bmcl' },
  { label: 'MCBBS 镜像', value: 'mcbbs' }
]
const sourceIndex = computed(() => sourceOptions.findIndex(o => o.value === settingsStore.downloadSource))

function onSourceChange(e: any) {
  const idx = e?.detail?.value
  if (typeof idx === 'number' && sourceOptions[idx]) {
    const v = sourceOptions[idx].value as 'mojang' | 'bmcl' | 'mcbbs'
    settingsStore.update({ downloadSource: v })
    versionStore.clearManifest()
    uni.showToast({ title: '已切换为 ' + sourceOptions[idx].label, icon: 'success' })
  }
}

// 主题 picker
const themeOptions = [
  { label: '跟随系统', value: 'auto' },
  { label: '樱花粉 (深色)', value: 'dark' },
  { label: '樱花粉 (浅色)', value: 'light' }
]
const themeIndex = computed(() => themeOptions.findIndex(o => o.value === settingsStore.theme))

function onThemeChange(e: any) {
  const idx = e?.detail?.value
  if (typeof idx === 'number' && themeOptions[idx]) {
    settingsStore.update({ theme: themeOptions[idx].value as 'dark' | 'light' | 'auto' })
    uni.showToast({ title: '主题已切换', icon: 'success' })
  }
}

// 语言 picker
const langOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'English', value: 'en-US' }
]
const langIndex = computed(() => langOptions.findIndex(o => o.value === settingsStore.language))

function onLangChange(e: any) {
  const idx = e?.detail?.value
  if (typeof idx === 'number' && langOptions[idx]) {
    settingsStore.update({ language: langOptions[idx].value as 'zh-CN' | 'zh-TW' | 'en-US' })
    uni.showToast({ title: '语言已切换', icon: 'success' })
  }
}

// 窗口大小
const showWindowModal = ref(false)
const winWidth = ref(settingsStore.windowWidth)
const winHeight = ref(settingsStore.windowHeight)

function openWindowModal() {
  winWidth.value = settingsStore.windowWidth
  winHeight.value = settingsStore.windowHeight
  showWindowModal.value = true
}

function saveWindowSize() {
  const w = Math.max(640, Math.round(winWidth.value))
  const h = Math.max(480, Math.round(winHeight.value))
  settingsStore.update({ windowWidth: w, windowHeight: h })
  showWindowModal.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

// 自定义参数
const showJvmModal = ref(false)
const jvmArgsDraft = ref('')

function openJvmModal() {
  jvmArgsDraft.value = settingsStore.customJvmArgs
  showJvmModal.value = true
}

function saveJvmArgs() {
  settingsStore.update({ customJvmArgs: jvmArgsDraft.value })
  showJvmModal.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

const showGameArgsModal = ref(false)
const gameArgsDraft = ref('')

function openGameArgsModal() {
  gameArgsDraft.value = settingsStore.customGameArgs
  showGameArgsModal.value = true
}

function saveGameArgs() {
  settingsStore.update({ customGameArgs: gameArgsDraft.value })
  showGameArgsModal.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

const platform = computed(() => detectPlatform())
const defaultGameDir = computed(() => getDefaultGameDir())
const defaultLauncherDir = computed(() => getDefaultLauncherDir())

const showGameDirModal = ref(false)
const gameDirDraft = ref('')

const showJavaModal = ref(false)
const javaPathDraft = ref('')

const showMemoryModal = ref(false)
const memMin = ref(settingsStore.minMemory)
const memMax = ref(settingsStore.maxMemory)
const memSlider = ref(settingsStore.maxMemory)

// 路径配置
const showPathModal = ref(false)
const pathConfigKey = ref('')
const pathConfigLabel = ref('')
const pathConfigDraft = ref('')

const pathConfigs = computed(() => [
  { key: 'gameDir', label: 'SakuraMC 游戏目录', icon: '📁', value: settingsStore.gameDir || defaultGameDir.value },
  { key: 'versionsDir', label: '版本目录', icon: '📦', value: settingsStore.versionsDir || `${settingsStore.gameDir || defaultGameDir.value}/versions` },
  { key: 'modsDir', label: '模组目录', icon: '🧩', value: settingsStore.modsDir || `${settingsStore.gameDir || defaultGameDir.value}/mods` },
  { key: 'resourcepacksDir', label: '资源包目录', icon: '🎨', value: settingsStore.resourcepacksDir || `${settingsStore.gameDir || defaultGameDir.value}/resourcepacks` },
  { key: 'savesDir', label: '存档目录', icon: '💾', value: settingsStore.savesDir || `${settingsStore.gameDir || defaultGameDir.value}/saves` },
  { key: 'screenshotsDir', label: '截图目录', icon: '📷', value: settingsStore.screenshotsDir || `${settingsStore.gameDir || defaultGameDir.value}/screenshots` },
  { key: 'logsDir', label: '日志目录', icon: '📝', value: settingsStore.logsDir || `${settingsStore.gameDir || defaultGameDir.value}/logs` },
  { key: 'shaderpacksDir', label: '光影包目录', icon: '✨', value: settingsStore.shaderpacksDir || `${settingsStore.gameDir || defaultGameDir.value}/shaderpacks` }
])

function openPathConfig(key: string, label: string) {
  pathConfigKey.value = key
  pathConfigLabel.value = label
  const current = (settingsStore as any)[key]
  const defaultVal = pathConfigs.value.find(p => p.key === key)?.value || ''
  pathConfigDraft.value = current || defaultVal
  showPathModal.value = true
}

function savePathConfig() {
  if (pathConfigKey.value && pathConfigDraft.value) {
    settingsStore.update({ [pathConfigKey.value]: pathConfigDraft.value } as any)
    uni.showToast({ title: '路径已保存', icon: 'success' })
  }
  showPathModal.value = false
}

function openFolder(path: string) {
  if (!path) return
  // #ifdef APP-PLUS
  showOpenModeDialog(path)
  // #endif
  // #ifndef APP-PLUS
  uni.showToast({ title: '仅手机端支持打开文件夹', icon: 'none' })
  // #endif
}

/** 选择自定义背景图 */
async function chooseBackgroundImage() {
  // #ifdef APP-PLUS
  try {
    uni.showLoading({ title: '选择图片...', mask: true })
    const bgDir = `${SAKURA_ROOT}/config/backgrounds`
    await ensureDir(bgDir)
    const imported = await chooseAndImportImage(bgDir, 'background.png')
    uni.hideLoading()
    if (imported) {
      settingsStore.update({
        backgroundImagePath: imported.path,
        useCustomBackground: true
      })
      uni.showToast({ title: '背景图已设置', icon: 'success' })
    } else {
      uni.showToast({ title: '未选择图片', icon: 'none' })
    }
  } catch (e: any) {
    uni.hideLoading()
    if (e?.message !== 'User cancelled') {
      uni.showToast({ title: '设置失败: ' + (e?.message || ''), icon: 'none' })
    }
  }
  // #endif
  // #ifndef APP-PLUS
  uni.showToast({ title: '仅手机端支持', icon: 'none' })
  // #endif
}

/** 清除自定义背景图 */
function clearBackgroundImage() {
  uni.showModal({
    title: '清除背景图',
    content: '确定要清除自定义背景图，恢复默认背景吗？',
    success: (r) => {
      if (r.confirm) {
        settingsStore.update({
          backgroundImagePath: '',
          useCustomBackground: false
        })
        uni.showToast({ title: '已恢复默认', icon: 'success' })
      }
    }
  })
}

const totalMemory = computed(() => {
  // #ifdef APP-PLUS
  try {
    // plus.device.memory 不存在,使用 uni.getSystemInfoSync 获取设备内存
    const info = uni.getSystemInfoSync()
    // 部分平台提供 totalMemory 字段 (单位 MB)
    if ((info as any).memorySize) {
      // memorySize 可能是字节,转换为 MB
      const mem = (info as any).memorySize
      return mem > 1024 * 1024 ? Math.floor(mem / (1024 * 1024)) : Math.floor(mem)
    }
    // 根据设备型号推断内存 (保守值)
    const model = (info.model || '').toLowerCase()
    if (model.includes('phone')) return 6144  // 手机默认 6GB
    if (model.includes('pad')) return 8192    // 平板默认 8GB
    return 6144
  } catch (e) {
    return 4096
  }
  // #endif
  // #ifndef APP-PLUS
  // H5 等环境根据平台推断
  if (platform.value === 'windows') return 8192
  if (platform.value === 'android') return 4096
  return 8192
  // #endif
})

function openGameDirModal() {
  gameDirDraft.value = settingsStore.gameDir || defaultGameDir.value
  showGameDirModal.value = true
}

function saveGameDir() {
  settingsStore.update({ gameDir: gameDirDraft.value })
  showGameDirModal.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

function resetGameDir() {
  gameDirDraft.value = defaultGameDir.value
}

function openJavaModal() {
  javaPathDraft.value = settingsStore.javaPath
  showJavaModal.value = true
}

function saveJava() {
  settingsStore.update({ javaPath: javaPathDraft.value })
  showJavaModal.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

function openMemoryModal() {
  memMin.value = settingsStore.minMemory
  memMax.value = settingsStore.maxMemory
  memSlider.value = settingsStore.maxMemory
  showMemoryModal.value = true
}

function onMemSliderChange(e: any) {
  memSlider.value = e.detail.value
  memMax.value = e.detail.value
}

function saveMemory() {
  if (memMin.value < 256) memMin.value = 256
  if (memMax.value < memMin.value + 256) memMax.value = memMin.value + 256
  // 不超过系统总内存
  const total = totalMemory.value
  if (memMax.value > total) memMax.value = total
  if (memMin.value > memMax.value - 256) memMin.value = Math.max(256, memMax.value - 256)
  settingsStore.update({ minMemory: memMin.value, maxMemory: memMax.value })
  showMemoryModal.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

function openVersions() {
  uni.navigateTo({ url: '/pages/versions/versions' })
}

function openDownload() {
  uni.navigateTo({ url: '/pages/download/download' })
}

async function clearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '将删除下载缓存和临时文件，不会删除游戏存档和配置',
    success: async r => {
      if (!r.confirm) return
      uni.showLoading({ title: '清除中...' })
      try {
        // #ifdef APP-PLUS
        // 清除下载缓存目录
        try {
          await deleteFile(LAUNCHER_CACHE_DIR, true)
          await ensureDir(LAUNCHER_CACHE_DIR)
        } catch (e) { /* 目录可能不存在, 忽略 */ }
        // 清除 assets 下载缓存 (保留 assets 本体, 仅清临时)
        try {
          await deleteFile(`${MINECRAFT_DIR}/assets/temp`, true)
        } catch (e) { /* ignore */ }
        // 清除 uni 自带缓存
        try {
          // @ts-ignore
          if (uni.clearStorageSync) uni.clearStorageSync()
        } catch (e) { /* ignore */ }
        uni.hideLoading()
        uni.showToast({ title: '缓存已清除', icon: 'success' })
        // #endif
        // #ifndef APP-PLUS
        uni.clearStorageSync()
        uni.hideLoading()
        uni.showToast({ title: '本地存储已清除', icon: 'success' })
        // #endif
      } catch (e: any) {
        uni.hideLoading()
        uni.showToast({ title: '清除失败: ' + (e?.message || ''), icon: 'none' })
      }
    }
  })
}

function clearAll() {
  uni.showModal({
    title: '清除全部数据',
    content: '将删除所有本地数据，包括账号、配置、下载记录，不可恢复！',
    confirmColor: '#f87171',
    success: async r => {
      if (!r.confirm) return
      uni.showLoading({ title: '清除中...' })
      try {
        // 先清 storage
        try {
          uni.clearStorageSync()
        } catch (e) { /* ignore */ }
        // #ifdef APP-PLUS
        // 尝试删除游戏目录中的配置文件 (保留存档)
        try {
          // 清除 options.txt、servers.dat 等
          const files = ['options.txt', 'servers.dat', 'config', 'launcher_profiles.json']
          for (const f of files) {
            try {
              await deleteFile(`${MINECRAFT_DIR}/${f}`, true)
            } catch { /* 不存在则跳过 */ }
          }
        } catch (e) { /* ignore */ }
        // #endif
        uni.hideLoading()
        uni.showToast({ title: '已清除, 请重启', icon: 'success' })
      } catch (e: any) {
        uni.hideLoading()
        uni.showToast({ title: '清除失败: ' + (e?.message || ''), icon: 'none' })
      }
    }
  })
}

// 自动检测系统 Java
async function autoDetectJava() {
  uni.showLoading({ title: '检测中...' })
  try {
    const javas = await detectSystemJava()
    uni.hideLoading()
    if (javas.length === 0) {
      uni.showToast({ title: '未检测到 Java', icon: 'none' })
      return
    }
    // 将检测到的 Java 加入 javaStore
    let added = 0
    for (const j of javas) {
      const major = j.version || 0
      const id = `sys-java${major}-${j.bit || 64}-${j.vendor || 'unknown'}`
      if (!javaStore.versions.find(v => v.id === id)) {
        javaStore.addVersion({
          id,
          name: `Java ${major} (系统)`,
          version: `${major}`,
          majorVersion: major,
          path: j.path,
          architecture: j.bit === 64 ? 'x64' : 'x86',
          type: 'jre'
        })
        added++
      }
    }
    uni.showToast({ title: `检测到 ${javas.length} 个, 新增 ${added} 个`, icon: 'success' })
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: '检测失败: ' + (e?.message || ''), icon: 'none' })
  }
}

const recommendedJava = computed(() => {
  if (!versionStore.selectedId) return 17
  return recommendJavaVersion(versionStore.selectedId)
})

function selectJavaVersion(id: string) {
  javaStore.selectVersion(id)
  settingsStore.update({ javaPath: javaStore.selectedVersion?.path || '' })
  uni.showToast({ title: '已切换', icon: 'success' })
}
</script>

<template>
  <view class="settings">
    <view class="settings__header">
      <text class="settings__title">设置</text>
    </view>
    
    <view class="settings__tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.id"
        class="settings__tab"
        :class="{ 'settings__tab--active': activeTab === tab.id }"
        @tap="activeTab = tab.id"
      >
        <text class="settings__tab-text">{{ tab.label }}</text>
      </view>
      <view class="settings__tab-indicator" :style="{ left: (tabs.findIndex(t => t.id === activeTab) * 25) + '%' }" />
    </view>
    
    <scroll-view scroll-y class="settings__content">
      <view v-if="activeTab === 'game'" class="settings__panel">
        <view class="setting-section">
          <text class="setting-section__title">游戏</text>
          
          <view class="setting-item" @tap="openGameDirModal">
            <view class="setting-item__icon">📁</view>
            <view class="setting-item__main">
              <text class="setting-item__label">游戏目录</text>
              <text class="setting-item__value">{{ settingsStore.gameDir || defaultGameDir }}</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
          
          <view class="setting-item" @tap="openVersions">
            <view class="setting-item__icon">📦</view>
            <view class="setting-item__main">
              <text class="setting-item__label">版本隔离</text>
              <text class="setting-item__value">{{ versionStore.selectedId || '未选择版本' }}</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🎯</view>
            <view class="setting-item__main">
              <text class="setting-item__label">启动后自动加入服务器</text>
            </view>
            <switch 
              :checked="settingsStore.autoJoinServer" 
              color="#ff8fab"
              @change="settingsStore.update({ autoJoinServer: $event.detail.value })"
            />
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">Java</text>
          
          <view class="setting-item" @tap="openJavaModal">
            <view class="setting-item__icon">☕</view>
            <view class="setting-item__main">
              <text class="setting-item__label">Java 路径</text>
              <text class="setting-item__value">{{ settingsStore.javaPath || '自动选择' }}</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
          
          <view class="setting-item" @tap="openMemoryModal">
            <view class="setting-item__icon">💾</view>
            <view class="setting-item__main">
              <text class="setting-item__label">内存设置</text>
              <text class="setting-item__value">最大 {{ formatBytes(settingsStore.maxMemory * 1024 * 1024) }}</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">⚡</view>
            <view class="setting-item__main">
              <text class="setting-item__label">推荐 Java 版本</text>
              <text class="setting-item__value">Java {{ recommendedJava }} (Temurin)</text>
            </view>
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">窗口</text>
          
          <view class="setting-item">
            <view class="setting-item__icon">🖥️</view>
            <view class="setting-item__main">
              <text class="setting-item__label">全屏启动</text>
            </view>
            <switch 
              :checked="settingsStore.fullscreen" 
              color="#ff8fab"
              @change="settingsStore.update({ fullscreen: $event.detail.value })"
            />
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">路径配置</text>
          <view 
            v-for="cfg in pathConfigs" 
            :key="cfg.key"
            class="setting-item setting-item--double"
          >
            <view class="setting-item__left" @tap="openPathConfig(cfg.key, cfg.label)">
              <view class="setting-item__icon">{{ cfg.icon }}</view>
              <view class="setting-item__main">
                <text class="setting-item__label">{{ cfg.label }}</text>
                <text class="setting-item__value">{{ cfg.value }}</text>
              </view>
              <text class="setting-item__arrow">›</text>
            </view>
            <view class="setting-item__right">
              <text class="setting-item__action" @tap="openFolder(cfg.value)">打开</text>
            </view>
          </view>
        </view>
      </view>
      
      <view v-if="activeTab === 'version'" class="settings__panel">
        <view class="setting-section">
          <text class="setting-section__title">版本管理</text>
          
          <view class="setting-item" @tap="openVersions">
            <view class="setting-item__icon">📋</view>
            <view class="setting-item__main">
              <text class="setting-item__label">版本列表</text>
              <text class="setting-item__value">已安装 {{ Object.keys(versionStore.installed).length }} 个版本</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
          
          <view class="setting-item" @tap="openDownload">
            <view class="setting-item__icon">⬇️</view>
            <view class="setting-item__main">
              <text class="setting-item__label">下载新版本</text>
              <text class="setting-item__value">从官方源下载</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🔬</view>
            <view class="setting-item__main">
              <text class="setting-item__label">显示快照版本</text>
            </view>
            <switch 
              :checked="settingsStore.showSnapshots" 
              color="#ff8fab"
              @change="settingsStore.update({ showSnapshots: $event.detail.value })"
            />
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">📜</view>
            <view class="setting-item__main">
              <text class="setting-item__label">显示远古版本</text>
            </view>
            <switch 
              :checked="settingsStore.showOldVersions" 
              color="#ff8fab"
              @change="settingsStore.update({ showOldVersions: $event.detail.value })"
            />
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">下载</text>
          
          <picker mode="selector" :range="sourceOptions" range-key="label" :value="sourceIndex" @change="onSourceChange">
            <view class="setting-item">
              <view class="setting-item__icon">🌐</view>
              <view class="setting-item__main">
                <text class="setting-item__label">下载源</text>
                <text class="setting-item__value">{{ sourceOptions[sourceIndex]?.label || sourceOptions[0].label }}</text>
              </view>
              <text class="setting-item__arrow">›</text>
            </view>
          </picker>
          
          <view class="setting-item" @tap="clearCache">
            <view class="setting-item__icon">🗑️</view>
            <view class="setting-item__main">
              <text class="setting-item__label">清除下载缓存</text>
              <text class="setting-item__value">删除临时下载文件</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
        </view>
      </view>
      
      <view v-if="activeTab === 'auto'" class="settings__panel">
        <view class="setting-section">
          <text class="setting-section__title">自动安装</text>
          
          <view class="setting-item">
            <view class="setting-item__icon">🔧</view>
            <view class="setting-item__main">
              <text class="setting-item__label">自动安装 Forge</text>
              <text class="setting-item__value">安装版本后自动安装 Forge</text>
            </view>
            <switch
              :checked="settingsStore.autoInstallForge"
              color="#ff8fab"
              @change="settingsStore.update({ autoInstallForge: $event.detail.value })"
            />
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🧵</view>
            <view class="setting-item__main">
              <text class="setting-item__label">自动安装 Fabric</text>
              <text class="setting-item__value">安装版本后自动安装 Fabric</text>
            </view>
            <switch
              :checked="settingsStore.autoInstallFabric"
              color="#ff8fab"
              @change="settingsStore.update({ autoInstallFabric: $event.detail.value })"
            />
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🎀</view>
            <view class="setting-item__main">
              <text class="setting-item__label">自动安装 OptiFine</text>
              <text class="setting-item__value">安装版本后自动安装 OptiFine</text>
            </view>
            <switch
              :checked="settingsStore.autoInstallOptifine"
              color="#ff8fab"
              @change="settingsStore.update({ autoInstallOptifine: $event.detail.value })"
            />
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">Java</text>
          
          <view class="setting-item" @tap="autoDetectJava">
            <view class="setting-item__icon">🔍</view>
            <view class="setting-item__main">
              <text class="setting-item__label">扫描系统 Java</text>
              <text class="setting-item__value">自动检测系统已安装的 Java</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">窗口</text>
          
          <view class="setting-item" @tap="openWindowModal">
            <view class="setting-item__icon">🪟</view>
            <view class="setting-item__main">
              <text class="setting-item__label">窗口大小</text>
              <text class="setting-item__value">{{ settingsStore.windowWidth }} × {{ settingsStore.windowHeight }}</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">自定义参数</text>
          
          <view class="setting-item" @tap="openJvmModal">
            <view class="setting-item__icon">⚙️</view>
            <view class="setting-item__main">
              <text class="setting-item__label">JVM 参数</text>
              <text class="setting-item__value">{{ settingsStore.customJvmArgs || '无' }}</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
          
          <view class="setting-item" @tap="openGameArgsModal">
            <view class="setting-item__icon">🎮</view>
            <view class="setting-item__main">
              <text class="setting-item__label">游戏参数</text>
              <text class="setting-item__value">{{ settingsStore.customGameArgs || '无' }}</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
        </view>
      </view>
      
      <view v-if="activeTab === 'custom'" class="settings__panel">
        <view class="setting-section">
          <text class="setting-section__title">外观</text>
          
          <picker mode="selector" :range="themeOptions" range-key="label" :value="themeIndex" @change="onThemeChange">
            <view class="setting-item">
              <view class="setting-item__icon">🎨</view>
              <view class="setting-item__main">
                <text class="setting-item__label">主题</text>
                <text class="setting-item__value">{{ themeOptions[themeIndex]?.label || themeOptions[0].label }}</text>
              </view>
              <text class="setting-item__arrow">›</text>
            </view>
          </picker>
          
          <picker mode="selector" :range="langOptions" range-key="label" :value="langIndex" @change="onLangChange">
            <view class="setting-item">
              <view class="setting-item__icon">🌐</view>
              <view class="setting-item__main">
                <text class="setting-item__label">语言</text>
                <text class="setting-item__value">{{ langOptions[langIndex]?.label || langOptions[0].label }}</text>
              </view>
              <text class="setting-item__arrow">›</text>
            </view>
          </picker>

          <view class="setting-item">
            <view class="setting-item__icon">🖼️</view>
            <view class="setting-item__main">
              <text class="setting-item__label">自定义背景图</text>
              <text class="setting-item__value">{{ settingsStore.useCustomBackground ? '已启用' : '未启用' }}</text>
            </view>
            <switch
              :checked="settingsStore.useCustomBackground"
              color="#ff8fab"
              @change="settingsStore.update({ useCustomBackground: $event.detail.value })"
            />
          </view>

          <view class="setting-item" @tap="chooseBackgroundImage">
            <view class="setting-item__icon">📁</view>
            <view class="setting-item__main">
              <text class="setting-item__label">选择背景图</text>
              <text class="setting-item__value">{{ settingsStore.backgroundImagePath || '未选择' }}</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>

          <view v-if="settingsStore.backgroundImagePath" class="setting-item" @tap="clearBackgroundImage">
            <view class="setting-item__icon">🗑️</view>
            <view class="setting-item__main">
              <text class="setting-item__label" style="color: #ff6b6b">清除背景图</text>
              <text class="setting-item__value">恢复默认背景</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">启动器</text>
          
          <view class="setting-item">
            <view class="setting-item__icon">🔄</view>
            <view class="setting-item__main">
              <text class="setting-item__label">自动检查更新</text>
            </view>
            <switch 
              :checked="settingsStore.autoCheckUpdate" 
              color="#ff8fab"
              @change="settingsStore.update({ autoCheckUpdate: $event.detail.value })"
            />
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">📁</view>
            <view class="setting-item__main">
              <text class="setting-item__label">启动器目录</text>
              <text class="setting-item__value">{{ defaultLauncherDir }}</text>
            </view>
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">📝</view>
            <view class="setting-item__main">
              <text class="setting-item__label">版本号</text>
              <text class="setting-item__value">v{{ APP_VERSION }}</text>
            </view>
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">数据</text>
          
          <view class="setting-item" @tap="clearAll">
            <view class="setting-item__icon">⚠️</view>
            <view class="setting-item__main">
              <text class="setting-item__label" style="color: #ff6b6b">清除全部数据</text>
              <text class="setting-item__value">重置启动器所有数据</text>
            </view>
            <text class="setting-item__arrow">›</text>
          </view>
        </view>
        
        <view class="settings__about" @tap="uni.navigateTo({ url: '/pages/about/about' })">
          <text class="settings__about-logo">🌸</text>
          <text class="settings__about-name">樱花 MC 启动器</text>
          <text class="settings__about-version">v{{ APP_VERSION }}</text>
          <text class="settings__about-desc">内嵌樱花穿透完整功能 · 点击查看关于</text>
        </view>
      </view>
    </scroll-view>
    
    <view v-if="showGameDirModal" class="modal-mask" @tap="showGameDirModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">游戏目录</text>
        <text class="modal-panel__desc">设置 Minecraft 游戏文件存放目录</text>
        
        <view class="modal-field">
          <text class="modal-field__label">目录路径</text>
          <input 
            class="modal-field__input" 
            v-model="gameDirDraft"
            placeholder="输入游戏目录路径"
          />
        </view>
        
        <view class="modal-hint">
          <text>默认: {{ defaultGameDir }}</text>
        </view>
        
        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="resetGameDir">
            <text>恢复默认</text>
          </view>
          <view class="modal-btn modal-btn--ghost" @tap="showGameDirModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn modal-btn--primary" @tap="saveGameDir">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>
    
    <view v-if="showJavaModal" class="modal-mask" @tap="showJavaModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">Java 路径</text>
        <text class="modal-panel__desc">设置 Java 可执行文件路径</text>
        
        <view class="modal-field">
          <text class="modal-field__label">Java 路径</text>
          <input 
            class="modal-field__input" 
            v-model="javaPathDraft"
            placeholder="留空自动选择"
          />
        </view>
        
        <view class="java-versions">
          <text class="java-versions__title">内置 Java 版本</text>
          <view
            v-for="java in javaStore.versions"
            :key="java.id"
            class="java-version-item"
            :class="{ 'java-version-item--selected': javaStore.selectedId === java.id }"
            @tap="selectJavaVersion(java.id)"
          >
            <text class="java-version-item__name">{{ java.name }}</text>
            <text class="java-version-item__ver">{{ java.version }}</text>
          </view>
        </view>
        
        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="showJavaModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn modal-btn--primary" @tap="saveJava">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>
    
    <view v-if="showMemoryModal" class="modal-mask" @tap="showMemoryModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">内存设置</text>
        <text class="modal-panel__desc">分配给 Minecraft 的最大内存</text>
        
        <view class="memory-display">
          <text class="memory-display__value">{{ memMax }} MB</text>
          <text class="memory-display__hint">约 {{ (memMax / 1024).toFixed(1) }} GB</text>
        </view>
        
        <slider 
          class="memory-slider"
          :min="512" 
          :max="totalMemory" 
          :step="256"
          :value="memSlider"
          activeColor="#ff8fab"
          backgroundColor="rgba(255,255,255,0.1)"
          block-color="#ff8fab"
          @change="onMemSliderChange"
        />
        
        <view class="memory-marks">
          <text>512MB</text>
          <text>{{ totalMemory }}MB</text>
        </view>
        
        <view class="modal-hint">
          <text>推荐: 4GB (4096MB) 以上</text>
        </view>
        
        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="showMemoryModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn modal-btn--primary" @tap="saveMemory">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>
    
    <view v-if="showPathModal" class="modal-mask" @tap="showPathModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">{{ pathConfigLabel }}</text>
        <text class="modal-panel__desc">设置路径，留空使用默认值</text>
        
        <view class="modal-field">
          <text class="modal-field__label">目录路径</text>
          <input 
            class="modal-field__input" 
            v-model="pathConfigDraft"
            :placeholder="'输入' + pathConfigLabel + '路径'"
          />
        </view>
        
        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="showPathModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn modal-btn--primary" @tap="savePathConfig">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="showWindowModal" class="modal-mask" @tap="showWindowModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">窗口大小</text>
        <text class="modal-panel__desc">设置 Minecraft 启动窗口分辨率</text>

        <view class="modal-field">
          <text class="modal-field__label">宽度 (px)</text>
          <input
            class="modal-field__input"
            type="number"
            v-model="winWidth"
            placeholder="例如 854"
          />
        </view>

        <view class="modal-field">
          <text class="modal-field__label">高度 (px)</text>
          <input
            class="modal-field__input"
            type="number"
            v-model="winHeight"
            placeholder="例如 480"
          />
        </view>

        <view class="modal-hint">
          <text>最小 640×480</text>
        </view>

        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="showWindowModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn modal-btn--primary" @tap="saveWindowSize">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="showJvmModal" class="modal-mask" @tap="showJvmModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">JVM 参数</text>
        <text class="modal-panel__desc">自定义 Java 虚拟机启动参数</text>

        <view class="modal-field">
          <textarea
            class="modal-field__textarea"
            v-model="jvmArgsDraft"
            placeholder="例如: -XX:+UseG1GC -Xss2M"
          />
        </view>

        <view class="modal-hint">
          <text>每行一个参数，留空使用默认值</text>
        </view>

        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="showJvmModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn modal-btn--primary" @tap="saveJvmArgs">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="showGameArgsModal" class="modal-mask" @tap="showGameArgsModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">游戏参数</text>
        <text class="modal-panel__desc">自定义 Minecraft 游戏启动参数</text>

        <view class="modal-field">
          <textarea
            class="modal-field__textarea"
            v-model="gameArgsDraft"
            placeholder="例如: --fullscreen --version 1.21.1"
          />
        </view>

        <view class="modal-hint">
          <text>每行一个参数，留空使用默认值</text>
        </view>

        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="showGameArgsModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn modal-btn--primary" @tap="saveGameArgs">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.settings {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1530 0%, #0f0d1f 100%);
  
  &__header {
    padding: 60rpx 32rpx 20rpx;
  }
  
  &__title {
    font-size: 48rpx;
    font-weight: 700;
    color: #fff;
  }
  
  &__tabs {
    display: flex;
    position: relative;
    padding: 0 16rpx;
    margin-bottom: 16rpx;
  }
  
  &__tab {
    flex: 1;
    text-align: center;
    padding: 20rpx 0;
    position: relative;
    z-index: 1;
    
    &--active .settings__tab-text {
      color: #ffb7d5;
      font-weight: 600;
    }
  }
  
  &__tab-text {
    font-size: 26rpx;
    color: #888;
    transition: color 0.3s;
  }
  
  &__tab-indicator {
    position: absolute;
    bottom: 0;
    width: 25%;
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
  
  &__about {
    text-align: center;
    padding: 60rpx 0 40rpx;
  }
  
  &__about-logo {
    font-size: 80rpx;
    display: block;
    margin-bottom: 16rpx;
  }
  
  &__about-name {
    font-size: 32rpx;
    color: #fff;
    font-weight: 700;
    display: block;
  }
  
  &__about-version {
    font-size: 24rpx;
    color: #ffb7d5;
    display: block;
    margin: 8rpx 0;
  }
  
  &__about-desc {
    font-size: 22rpx;
    color: #666;
    display: block;
  }
}

.setting-section {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  padding: 8rpx 20rpx;
  
  &__title {
    font-size: 24rpx;
    color: #ffb7d5;
    font-weight: 600;
    display: block;
    padding: 16rpx 0 8rpx;
  }
}

.setting-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 2rpx solid rgba(255, 255, 255, 0.04);
  
  &:last-child { border-bottom: none; }
  
  &__icon {
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    margin-right: 16rpx;
    background: rgba(255, 183, 213, 0.1);
    border-radius: 12rpx;
  }
  
  &__main {
    flex: 1;
    min-width: 0;
  }
  
  &__label {
    font-size: 28rpx;
    color: #fff;
    display: block;
  }
  
  &__value {
    font-size: 22rpx;
    color: #888;
    display: block;
    margin-top: 4rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  &__arrow {
    font-size: 36rpx;
    color: #555;
    margin-left: 12rpx;
  }
  
  &--double {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    &__left {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
    }
    
    &__right {
      margin-left: 16rpx;
    }
    
    &__action {
      font-size: 26rpx;
      color: #ffb7d5;
      padding: 12rpx 24rpx;
      background: rgba(255, 183, 213, 0.1);
      border-radius: 8rpx;
    }
  }
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.modal-panel {
  background: #1e1a2e;
  border-radius: 20rpx;
  width: 100%;
  max-width: 600rpx;
  padding: 32rpx;
  border: 2rpx solid rgba(255, 183, 213, 0.2);
  
  &__title {
    font-size: 34rpx;
    font-weight: 700;
    color: #fff;
    display: block;
  }
  
  &__desc {
    font-size: 24rpx;
    color: #888;
    display: block;
    margin-top: 8rpx;
    margin-bottom: 24rpx;
  }
}

.modal-field {
  margin-bottom: 20rpx;
  
  &__label {
    font-size: 24rpx;
    color: #aaa;
    display: block;
    margin-bottom: 8rpx;
  }
  
  &__input {
    width: 100%;
    height: 80rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    color: #fff;
    box-sizing: border-box;
  }

  &__textarea {
    width: 100%;
    height: 180rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12rpx;
    padding: 16rpx 20rpx;
    font-size: 26rpx;
    color: #fff;
    box-sizing: border-box;
  }
}

.modal-hint {
  font-size: 22rpx;
  color: #666;
  margin-bottom: 24rpx;
}

.modal-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.modal-btn {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  font-size: 28rpx;
  
  &--ghost {
    background: rgba(255, 255, 255, 0.08);
    color: #aaa;
  }
  
  &--primary {
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    color: #fff;
    font-weight: 600;
  }
  
  &:active {
    opacity: 0.8;
  }
}

.java-versions {
  margin: 16rpx 0;
  
  &__title {
    font-size: 24rpx;
    color: #ffb7d5;
    display: block;
    margin-bottom: 12rpx;
  }
}

.java-version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10rpx;
  margin-bottom: 8rpx;
  border: 2rpx solid transparent;
  
  &--selected {
    border-color: #ff8fab;
    background: rgba(255, 183, 213, 0.1);
  }
  
  &__name {
    font-size: 26rpx;
    color: #fff;
  }
  
  &__ver {
    font-size: 22rpx;
    color: #888;
  }
}

.memory-display {
  text-align: center;
  margin: 24rpx 0;
  
  &__value {
    font-size: 56rpx;
    font-weight: 700;
    color: #ffb7d5;
    display: block;
  }
  
  &__hint {
    font-size: 24rpx;
    color: #888;
    display: block;
    margin-top: 4rpx;
  }
}

.memory-slider {
  margin: 16rpx 0;
}

.memory-marks {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  color: #666;
  margin-bottom: 16rpx;
}
</style>
