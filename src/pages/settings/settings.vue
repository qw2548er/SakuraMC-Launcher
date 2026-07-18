<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAccountStore } from '@/stores/account'
import { useFrpStore } from '@/stores/frp'
import { useVersionStore } from '@/stores/version'
import { useJavaStore } from '@/stores/java'
import { APP_VERSION } from '@/utils/updater'
import { detectPlatform, formatBytes } from '@/utils/format'
import { getDefaultGameDir, getDefaultLauncherDir } from '@/utils/path'
import { recommendJavaVersion } from '@/utils/java'

const settingsStore = useSettingsStore()
const accountStore = useAccountStore()
const frpStore = useFrpStore()
const versionStore = useVersionStore()
const javaStore = useJavaStore()

const activeTab = ref('game')

const tabs = [
  { id: 'game', label: '游戏设置', icon: '🎮' },
  { id: 'version', label: '管理版本', icon: '📦' },
  { id: 'auto', label: '自动安装', icon: '🔧' },
  { id: 'custom', label: '自定义', icon: '⚙️' }
]

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
  // #ifdef APP-PLUS
  try {
    plus.io.openFile(path)
  } catch (e: any) {
    uni.showToast({ title: '无法打开该路径', icon: 'none' })
  }
  // #endif
  // #ifndef APP-PLUS
  uni.showToast({ title: '仅手机端支持打开文件夹', icon: 'none' })
  // #endif
}

const totalMemory = computed(() => {
  // #ifdef APP-PLUS
  return plus.device.memory * 1024 || 4096
  // #endif
  // #ifdef H5
  const ua = navigator.userAgent
  if (platform.value === 'windows') return 8192
  if (platform.value === 'android') return 4096
  return 8192
  // #endif
  return 8192
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

function autoDetectJava() {
  uni.showToast({ title: '请手动选择或输入', icon: 'none' })
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
  settingsStore.update({ minMemory: memMin.value, maxMemory: memMax.value })
  showMemoryModal.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

const sourceOptions = [
  { label: 'Mojang 官方', value: 'mojang' },
  { label: 'BMCL 镜像', value: 'bmcl' },
  { label: 'MCBBS 镜像', value: 'mcbbs' }
]

function openVersions() {
  uni.navigateTo({ url: '/pages/versions/versions' })
}

function openDownload() {
  uni.navigateTo({ url: '/pages/download/download' })
}

function clearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '将删除下载缓存和临时文件，不会删除游戏存档和配置',
    success: r => {
      if (r.confirm) {
        uni.showToast({ title: '已清除', icon: 'success' })
      }
    }
  })
}

function clearAll() {
  uni.showModal({
    title: '清除全部数据',
    content: '将删除所有本地数据，包括账号、配置、下载记录，不可恢复！',
    confirmColor: '#f87171',
    success: r => {
      if (r.confirm) {
        try {
          uni.clearStorageSync()
          uni.showToast({ title: '已清除, 请重启', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: '清除失败', icon: 'none' })
        }
      }
    }
  })
}

const recommendedJava = computed(() => {
  if (!versionStore.selectedId) return 17
  return recommendJavaVersion(versionStore.selectedId)
})

function selectJavaVersion(ver: string) {
  javaStore.selectVersion(ver)
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
          
          <view class="setting-item">
            <view class="setting-item__icon">🌐</view>
            <view class="setting-item__main">
              <text class="setting-item__label">下载源</text>
              <text class="setting-item__value">{{ sourceOptions.find(o => o.value === settingsStore.downloadSource)?.label }}</text>
            </view>
          </view>
          
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
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🧵</view>
            <view class="setting-item__main">
              <text class="setting-item__label">自动安装 Fabric</text>
              <text class="setting-item__value">安装版本后自动安装 Fabric</text>
            </view>
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🎀</view>
            <view class="setting-item__main">
              <text class="setting-item__label">自动安装 OptiFine</text>
              <text class="setting-item__value">安装版本后自动安装 OptiFine</text>
            </view>
          </view>
        </view>
        
        <view class="setting-section">
          <text class="setting-section__title">Mod 加载器</text>
          
          <view class="setting-item">
            <view class="setting-item__icon">🔩</view>
            <view class="setting-item__main">
              <text class="setting-item__label">Forge</text>
              <text class="setting-item__value">最流行的 Mod 加载器</text>
            </view>
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🧶</view>
            <view class="setting-item__main">
              <text class="setting-item__label">Fabric</text>
              <text class="setting-item__value">轻量级 Mod 加载器</text>
            </view>
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🪡</view>
            <view class="setting-item__main">
              <text class="setting-item__label">Quilt</text>
              <text class="setting-item__value">Fabric 的分支版本</text>
            </view>
          </view>
        </view>
      </view>
      
      <view v-if="activeTab === 'custom'" class="settings__panel">
        <view class="setting-section">
          <text class="setting-section__title">外观</text>
          
          <view class="setting-item">
            <view class="setting-item__icon">🎨</view>
            <view class="setting-item__main">
              <text class="setting-item__label">主题</text>
              <text class="setting-item__value">樱花粉</text>
            </view>
          </view>
          
          <view class="setting-item">
            <view class="setting-item__icon">🌐</view>
            <view class="setting-item__main">
              <text class="setting-item__label">语言</text>
              <text class="setting-item__value">简体中文</text>
            </view>
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
        
        <view class="settings__about">
          <text class="settings__about-logo">🌸</text>
          <text class="settings__about-name">樱花 MC 启动器</text>
          <text class="settings__about-version">v{{ APP_VERSION }}</text>
          <text class="settings__about-desc">内嵌樱花穿透完整功能</text>
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
            :key="java.version"
            class="java-version-item"
            :class="{ 'java-version-item--selected': settingsStore.javaPath === java.path }"
            @tap="selectJavaVersion(java.version)"
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
