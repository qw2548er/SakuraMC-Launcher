<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAccountStore } from '@/stores/account'
import { useFrpStore } from '@/stores/frp'
import McCard from '@/components/mc-card.vue'
import McButton from '@/components/mc-button.vue'
import McInput from '@/components/mc-input.vue'
import McPicker from '@/components/mc-picker.vue'
import McSwitch from '@/components/mc-switch.vue'
import McModal from '@/components/mc-modal.vue'
import { detectPlatform, formatBytes, copyText } from '@/utils/format'
import { buildJvmMemoryConfig, recommendJavaVersion, getAdoptiumDownloadUrl } from '@/utils/java'
import { useVersionStore } from '@/stores/version'

const settingsStore = useSettingsStore()
const accountStore = useAccountStore()
const frpStore = useFrpStore()
const versionStore = useVersionStore()

const showJavaModal = ref(false)
const javaPathDraft = ref('')
const showMemoryModal = ref(false)
const memMin = ref(settingsStore.minMemory)
const memMax = ref(settingsStore.maxMemory)

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
  uni.showToast({ title: '浏览器内无法检测, 请手动填写', icon: 'none' })
}
function openMemoryModal() {
  memMin.value = settingsStore.minMemory
  memMax.value = settingsStore.maxMemory
  showMemoryModal.value = true
}
function saveMemory() {
  if (memMin.value < 256) memMin.value = 256
  if (memMax.value < memMin.value + 256) memMax.value = memMin.value + 256
  settingsStore.update({ minMemory: memMin.value, maxMemory: memMax.value })
  showMemoryModal.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

const sourceOptions = [
  { label: 'Mojang 官方', value: 'mojang', desc: '原版下载, 速度一般' },
  { label: 'BMCL 镜像', value: 'bmcl', desc: '国内推荐, 速度快' },
  { label: 'MCBBS 镜像', value: 'mcbbs', desc: 'MCBBS 论坛镜像' }
]

const platform = computed(() => detectPlatform())

const javaDownloadUrl = computed(() => {
  const v = settingsStore.selectedVersion ? recommendJavaVersion(settingsStore.selectedVersion) : 17
  return getAdoptiumDownloadUrl(v, platform.value === 'macos' ? 'macos' : platform.value === 'linux' ? 'linux' : 'windows')
})

function recommendJava() {
  if (versionStore.selectedId) {
    const v = recommendJavaVersion(versionStore.selectedId)
    uni.showModal({
      title: '推荐 Java 版本',
      content: `Minecraft ${versionStore.selectedId} 推荐使用 Java ${v}, 已为你复制下载链接`,
      success: () => copyText(javaDownloadUrl.value)
    })
  }
}

function clearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '将删除所有本地数据, 包括账号、服务器、隧道配置, 不可恢复',
    confirmColor: '#f87171',
    success: r => {
      if (r.confirm) {
        try {
          uni.clearStorageSync()
          uni.showToast({ title: '已清除, 请重启', icon: 'success' })
          setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 1000)
        } catch (e) {
          uni.showToast({ title: '清除失败', icon: 'none' })
        }
      }
    }
  })
}

function exportConfig() {
  const config = {
    settings: settingsStore.$state,
    accounts: accountStore.accounts,
    version: '0.1.0',
    exportTime: Date.now()
  }
  const json = JSON.stringify(config, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sakuram-config-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  uni.showToast({ title: '已导出', icon: 'success' })
}
</script>

<template>
  <view class="settings">
    <view class="settings__head">
      <text class="settings__title">设置</text>
      <text class="settings__subtitle">v0.1.5 · {{ platform }}</text>
    </view>

    <McCard title="启动器" glow>
      <view class="setting-row" @tap="openJavaModal">
        <view class="setting-row__main">
          <text class="setting-row__label">Java 路径</text>
          <text class="setting-row__value">{{ settingsStore.javaPath || '未设置 (使用系统 java)' }}</text>
        </view>
        <text class="setting-row__arrow">›</text>
      </view>
      <view class="setting-row" @tap="openMemoryModal">
        <view class="setting-row__main">
          <text class="setting-row__label">内存分配</text>
          <text class="setting-row__value">最小 {{ formatBytes(settingsStore.minMemory * 1024 * 1024) }} · 最大 {{ formatBytes(settingsStore.maxMemory * 1024 * 1024) }}</text>
        </view>
        <text class="setting-row__arrow">›</text>
      </view>
      <view class="setting-row" @tap="recommendJava">
        <view class="setting-row__main">
          <text class="setting-row__label">下载 Java 运行时</text>
          <text class="setting-row__value">推荐 Java {{ settingsStore.selectedVersion ? '' : '' }} - Temurin</text>
        </view>
        <text class="setting-row__arrow">›</text>
      </view>
      <McSwitch v-model="settingsStore.autoCheckUpdate" label="自动检查更新" desc="启动时检测新版本" />
    </McCard>

    <McCard title="下载" class="settings__section">
      <text class="settings__label">下载源</text>
      <McPicker v-model="settingsStore.downloadSource" :options="sourceOptions" :block="false" />
      <McSwitch v-model="settingsStore.showSnapshots" label="显示快照版本" desc="包含 1.21-rc 之类的测试版" />
    </McCard>

    <McCard title="游戏" class="settings__section">
      <McSwitch v-model="settingsStore.fullscreen" label="全屏启动" desc="MC 启动时全屏" />
      <McSwitch v-model="settingsStore.autoJoinServer" label="自动加入服务器" desc="启动后自动连接上次服" />
      <view class="setting-row" @tap="uni.showToast({ title: '请在 PC 端设置, 此处仅展示', icon: 'none' })">
        <view class="setting-row__main">
          <text class="setting-row__label">游戏目录</text>
          <text class="setting-row__value">{{ settingsStore.gameDir || '默认 (~/.minecraft)' }}</text>
        </view>
        <text class="setting-row__arrow">›</text>
      </view>
    </McCard>

    <McCard title="外观" class="settings__section">
      <text class="settings__label">主题</text>
      <McPicker
        v-model="settingsStore.theme"
        :options="[
          { label: '深色', value: 'dark', icon: '🌙' },
          { label: '浅色', value: 'light', icon: '☀️' },
          { label: '跟随系统', value: 'auto', icon: '⚙️' }
        ]"
        :block="false"
      />
      <text class="settings__label">语言</text>
      <McPicker
        v-model="settingsStore.language"
        :options="[
          { label: '简体中文', value: 'zh-CN' },
          { label: '繁體中文', value: 'zh-TW' },
          { label: 'English', value: 'en-US' }
        ]"
        :block="false"
      />
    </McCard>

    <McCard title="樱花穿透" class="settings__section">
      <view class="setting-row">
        <view class="setting-row__main">
          <text class="setting-row__label">登录状态</text>
          <text class="setting-row__value">{{ frpStore.isLoggedIn ? frpStore.account?.username : '未登录' }}</text>
        </view>
      </view>
      <text class="settings__label">frpc 日志级别</text>
      <McPicker
        v-model="settingsStore.frpcLogLevel"
        :options="[
          { label: 'Trace', value: 'trace' },
          { label: 'Debug', value: 'debug' },
          { label: 'Info', value: 'info' },
          { label: 'Warn', value: 'warn' },
          { label: 'Error', value: 'error' }
        ]"
        :block="false"
      />
    </McCard>

    <McCard title="数据" class="settings__section">
      <view class="setting-row" @tap="exportConfig">
        <view class="setting-row__main">
          <text class="setting-row__label">导出配置</text>
          <text class="setting-row__value">导出所有配置为 JSON 文件</text>
        </view>
        <text class="setting-row__arrow">›</text>
      </view>
      <view class="setting-row" @tap="clearCache">
        <view class="setting-row__main">
          <text class="setting-row__label" style="color: #f87171">清除全部数据</text>
          <text class="setting-row__value">重置启动器, 慎用</text>
        </view>
        <text class="setting-row__arrow">›</text>
      </view>
    </McCard>

    <view class="settings__about">
      <text class="settings__about-logo">🌸</text>
      <text class="settings__about-name">樱花 MC 启动器</text>
      <text class="settings__about-version">v0.1.5 · {{ new Date().getFullYear() }}</text>
      <text class="settings__about-desc">基于 Uniapp Vue3 + TypeScript 构建</text>
      <text class="settings__about-desc">内嵌樱花穿透 (natfrp.com) 完整功能</text>
      <text class="settings__about-desc">Powered by 💖</text>
    </view>

    <McModal v-model:show="showJavaModal" title="Java 路径" width="90%">
      <view>
        <text class="modal-form__desc">设置 Java 可执行文件的绝对路径, 留空将使用系统 PATH 中的 java</text>
        <McInput v-model="javaPathDraft" label="Java 路径" placeholder="C:\Program Files\Java\jdk-17\bin\java.exe" />
        <text class="modal-form__hint">PC 端示例: C:\Program Files\Eclipse Adoptium\jdk-17.0.10.7-hotspot\bin\java.exe</text>
        <text class="modal-form__hint">Linux/macOS 示例: /usr/lib/jvm/java-17-openjdk-amd64/bin/java</text>
        <view class="modal-form__row">
          <McButton variant="ghost" @click="autoDetectJava">🔍 自动检测</McButton>
        </view>
      </view>
      <template #footer>
        <view class="modal-form__actions">
          <McButton variant="ghost" @click="showJavaModal = false">取消</McButton>
          <McButton @click="saveJava">保存</McButton>
        </view>
      </template>
    </McModal>

    <McModal v-model:show="showMemoryModal" title="内存分配" width="90%">
      <view>
        <text class="modal-form__desc">分配给 Minecraft 的堆内存, 1G = 1024MB</text>
        <text class="modal-form__label">最小内存 (MB)</text>
        <McInput v-model="memMin" type="number" placeholder="1024" />
        <text class="modal-form__label">最大内存 (MB)</text>
        <McInput v-model="memMax" type="number" placeholder="4096" />
        <text class="modal-form__hint">• 推荐配置: 1.20+ 用 4G, Mod 服用 6-8G</text>
        <text class="modal-form__hint">• 最大不要超过物理内存的 75%</text>
        <text class="modal-form__hint">• 32 位 Java 最大 1.5G, 64 位无限制</text>
      </view>
      <template #footer>
        <view class="modal-form__actions">
          <McButton variant="ghost" @click="showMemoryModal = false">取消</McButton>
          <McButton @click="saveMemory">保存</McButton>
        </view>
      </template>
    </McModal>
  </view>
</template>

<style lang="scss" scoped>
.settings {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__head { margin-bottom: 24rpx; }
  &__title { font-size: 44rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 24rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__section { margin-top: 24rpx; }
  &__label { display: block; font-size: 26rpx; color: #b8a8d4; font-weight: 600; margin: 16rpx 0 8rpx; }
  &__about {
    text-align: center; padding: 60rpx 0;
  }
  &__about-logo { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
  &__about-name { font-size: 32rpx; color: #ffffff; font-weight: 700; display: block; }
  &__about-version { font-size: 22rpx; color: #6a5a8a; display: block; margin: 4rpx 0 16rpx; }
  &__about-desc { font-size: 22rpx; color: #b8a8d4; display: block; line-height: 1.6; }
}

.setting-row {
  display: flex; align-items: center; gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid rgba(216, 150, 255, 0.05);
  &:last-child { border-bottom: none; }
  &__main { flex: 1; }
  &__label { font-size: 28rpx; color: #ffffff; display: block; }
  &__value { font-size: 22rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__arrow { font-size: 40rpx; color: #6a5a8a; }
}

.modal-form {
  &__desc { display: block; font-size: 24rpx; color: #b8a8d4; margin-bottom: 16rpx; line-height: 1.6; }
  &__label { display: block; font-size: 26rpx; color: #b8a8d4; font-weight: 600; margin: 12rpx 0 8rpx; }
  &__hint { display: block; font-size: 22rpx; color: #6a5a8a; margin-top: 8rpx; line-height: 1.6; }
  &__actions { display: flex; gap: 16rpx; }
  &__row { margin-top: 12rpx; }
}
</style>
