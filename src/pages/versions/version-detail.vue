<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useVersionStore } from '@/stores/version'
import { useSettingsStore } from '@/stores/settings'
import McCard from '@/components/mc-card.vue'
import McButton from '@/components/mc-button.vue'
import McBadge from '@/components/mc-badge.vue'
import { downloadFile, ensureDirectory } from '@/utils/downloader'
import { formatBytes, formatTime } from '@/utils/format'
import * as bmcl from '@/api/bmcl'
import { saveJsonToFile } from '@/stores/version'

const versionStore = useVersionStore()
const settingsStore = useSettingsStore()
const versionId = ref('')
const downloading = ref(false)
const showLoader = ref<'forge' | 'fabric' | 'quilt' | 'neoforge' | 'optifine' | null>(null)
const loaderVersion = ref('')

onLoad(async (q: any) => {
  versionId.value = q?.id || ''
  // 确保 manifest 已加载
  if (!versionStore.manifest) {
    await versionStore.loadManifest()
  }
  if (versionId.value) versionStore.loadModLoaders(versionId.value)
})

const currentVersion = computed(() => {
  if (!versionId.value) return null
  return versionStore.manifest?.versions.find(v => v.id === versionId.value)
})

const installed = computed(() => versionStore.installed[versionId.value])

const loaders = computed(() => versionStore.modLoaders[versionId.value] || [])
const loadingLoaders = computed(() => !!versionStore.loadingLoaders[versionId.value])

const filteredLoaders = computed(() => {
  if (!showLoader.value) return []
  return loaders.value.filter(l => l.type === showLoader.value)
})

async function downloadVersion() {
  if (!currentVersion.value) return
  if (versionStore.isDownloading(versionId.value)) {
    uni.showToast({ title: '该版本正在下载中', icon: 'none' })
    return
  }
  if (installed.value) {
    uni.showToast({ title: '该版本已安装', icon: 'none' })
    return
  }
  downloading.value = true
  try {
    const apiBase = bmcl.getApiBase(settingsStore.downloadSource)
    const versionTask = versionStore.addDownload({
      name: `Minecraft ${versionId.value} - 版本信息`,
      url: `${apiBase}/mc/game/version_manifest_v2.json`,
      total: 0,
      downloaded: 0,
      status: 'downloading'
    })
    let versionJson: any = null
    try {
      versionJson = await bmcl.getVersionJson(versionId.value, settingsStore.downloadSource)
      versionStore.updateDownload(versionTask.id, {
        status: 'completed',
        downloaded: 200000,
        total: 200000
      })
    } catch (e: any) {
      versionStore.updateDownload(versionTask.id, { status: 'error', error: e.message })
      uni.showToast({ title: '获取版本信息失败: ' + e.message, icon: 'none' })
      downloading.value = false
      return
    }
    const client = versionJson?.downloads?.client
    if (!client) {
      uni.showToast({ title: '版本信息无效', icon: 'none' })
      downloading.value = false
      return
    }
    let clientUrl = client.url
    if (settingsStore.downloadSource === 'bmcl') {
      const bmclBase = bmcl.getApiBase('bmcl')
      clientUrl = clientUrl
        .replace('https://launcher.mojang.com', bmclBase)
        .replace('https://piston-data.mojang.com', bmclBase)
    } else if (settingsStore.downloadSource === 'mcbbs') {
      const mcbbsBase = bmcl.getApiBase('mcbbs')
      clientUrl = clientUrl
        .replace('https://launcher.mojang.com', mcbbsBase)
        .replace('https://piston-data.mojang.com', mcbbsBase)
    }

    // 准备版本目录和保存路径
    const versionsDir = settingsStore.versionsDir || '/storage/emulated/0/SakuraMC/.minecraft/versions'
    const versionDir = `${versionsDir}/${versionId.value}`
    const jarPath = `${versionDir}/${versionId.value}.jar`
    const jsonPath = `${versionDir}/${versionId.value}.json`

    // 确保目录存在
    await ensureDirectory(versionDir)
    // 保存版本 JSON (启动游戏必需)
    await saveJsonToFile(jsonPath, versionJson)

    const jarTask = versionStore.addDownload({
      name: `Minecraft ${versionId.value} - 客户端`,
      url: clientUrl,
      total: client.size || 0,
      downloaded: 0,
      status: 'downloading'
    })
    try {
      await downloadFile({
        url: clientUrl,
        savePath: jarPath,
        onProgress: (downloaded, total, speed) => {
          versionStore.updateDownload(jarTask.id, {
            downloaded,
            total: total || client.size || 0,
            speed
          })
        }
      })
      // 下载完成,更新状态
      versionStore.updateDownload(jarTask.id, {
        status: 'completed',
        downloaded: client.size || 0,
        total: client.size || 0
      })
      const v = currentVersion.value
      if (v) {
        versionStore.markInstalled({
          ...v,
          installed: true,
          installedPath: jarPath,
          size: client.size
        })
      }
      versionStore.selectedId = versionId.value
      downloading.value = false
      uni.showToast({ title: '下载完成', icon: 'success' })
    } catch (e: any) {
      versionStore.updateDownload(jarTask.id, { status: 'error', error: e.message })
      downloading.value = false
      uni.showToast({ title: '下载失败: ' + e.message, icon: 'none' })
    }
  } catch (e: any) {
    downloading.value = false
    uni.showToast({ title: '下载失败: ' + (e.message || ''), icon: 'none' })
  }
}

function downloadModLoader(type: string, version: string) {
  if (!versionId.value) return
  // 根据加载器类型构造正确的下载 URL
  let url = ''
  const apiBase = bmcl.getApiBase(settingsStore.downloadSource)
  if (type === 'forge') {
    url = `${apiBase}/mc/forge/download?mcversion=${versionId.value}&version=${version}&category=installer&format=jar`
  } else if (type === 'optifine') {
    url = bmcl.getOptiFineDownloadUrl(version)
  } else if (type === 'fabric') {
    url = `https://meta.fabricmc.net/v2/versions/loader/${versionId.value}/${version}/profile/json`
  } else if (type === 'neoforge') {
    url = `${apiBase}/mc/neoforge/version/${version}/download`
  } else {
    url = `${apiBase}/mc/${type}/download?mcversion=${versionId.value}&version=${version}`
  }
  const task = versionStore.addDownload({
    name: `${type}-${version} for ${versionId.value}`,
    url,
    total: 30_000_000,
    downloaded: 0,
    status: 'downloading'
  })
  downloadFile({
    url,
    onProgress: (downloaded, total) => {
      versionStore.updateDownload(task.id, { downloaded, total: total || task.total })
    },
    onSuccess: () => {
      versionStore.updateDownload(task.id, { status: 'completed' })
      uni.showToast({ title: type + ' 安装完成', icon: 'success' })
    },
    onError: (e) => {
      versionStore.updateDownload(task.id, { status: 'error', error: e.message })
      uni.showToast({ title: type + ' 下载失败: ' + e.message, icon: 'none' })
    }
  })
}

function uninstall() {
  uni.showModal({
    title: '卸载版本',
    content: `确定要卸载 ${versionId.value} 吗?`,
    confirmColor: '#f87171',
    success: r => {
      if (r.confirm) {
        versionStore.markUninstalled(versionId.value)
        uni.navigateBack()
      }
    }
  })
}
</script>

<template>
  <view class="vd">
    <view v-if="!currentVersion" class="vd__empty">
      <text class="vd__empty-text">未找到版本</text>
    </view>

    <template v-else>
      <view class="vd__hero">
        <view class="vd__hero-icon">⛏️</view>
        <view>
          <text class="vd__title">Minecraft {{ versionId }}</text>
          <text class="vd__subtitle">{{ currentVersion.type }} · 发布于 {{ formatTime(currentVersion.releaseTime) }}</text>
        </view>
        <McBadge :status="installed ? 'online' : 'offline'" :text="installed ? '已安装' : '未安装'" />
      </view>

      <McCard title="下载" glow class="vd__section">
        <view v-if="!installed">
          <text class="vd__desc">从 {{ settingsStore.downloadSource.toUpperCase() }} 镜像下载版本 JSON 和客户端</text>
          <view class="vd__meta">
            <text class="vd__meta-item">📦 类型: {{ currentVersion.type }}</text>
            <text class="vd__meta-item">📅 发布时间: {{ formatTime(currentVersion.releaseTime) }}</text>
            <text class="vd__meta-item">🔗 来源: {{ settingsStore.downloadSource.toUpperCase() }}</text>
          </view>
          <McButton block size="lg" glow :loading="downloading" @click="downloadVersion">⬇ 立即下载</McButton>
        </view>
        <view v-else>
          <text class="vd__desc">✓ 已下载并标记为已安装</text>
          <text class="vd__path">路径: {{ installed.installedPath || './.minecraft/versions/' + versionId }}</text>
          <McButton variant="danger" block @click="uninstall">🗑️ 卸载</McButton>
        </view>
      </McCard>

      <McCard title="Mod 加载器" subtitle="安装后会自动生成对应的启动配置" class="vd__section">
        <view class="loader-tabs">
          <view
            v-for="t in [
              { v: 'forge', l: 'Forge', icon: '🔥' },
              { v: 'fabric', l: 'Fabric', icon: '⚙️' },
              { v: 'quilt', l: 'Quilt', icon: '🧵' },
              { v: 'neoforge', l: 'NeoForge', icon: '✨' },
              { v: 'optifine', l: 'OptiFine', icon: '👁️' }
            ]"
            :key="t.v"
            class="loader-tab"
            :class="{ 'is-active': showLoader === t.v }"
            @tap="showLoader = (showLoader === t.v ? null : t.v) as any"
          >
            <text class="loader-tab__icon">{{ t.icon }}</text>
            <text class="loader-tab__label">{{ t.l }}</text>
          </view>
        </view>

        <view v-if="loadingLoaders" class="vd__loader-loading">
          <view class="vd__spinner" />
          <text>正在加载 {{ showLoader }} 版本列表...</text>
        </view>

        <view v-else-if="showLoader && filteredLoaders.length" class="loader-list">
          <view v-for="ld in filteredLoaders" :key="ld.type + ld.version" class="loader-item" @tap="downloadModLoader(ld.type, ld.version)">
            <view>
              <text class="loader-item__name">{{ ld.type }} {{ ld.version }}</text>
              <text class="loader-item__sub">点击下载并安装</text>
            </view>
            <text class="loader-item__action">⬇</text>
          </view>
        </view>

        <view v-else-if="showLoader" class="vd__loader-empty">
          <text>暂无可用版本</text>
        </view>

        <view v-else class="vd__loader-tip">
          <text>💡 选择上方加载器查看可用版本</text>
        </view>
      </McCard>

      <McCard title="启动提示" class="vd__section">
        <text class="vd__tip">• 安装完版本和 Mod 后, 回到首页点击「启动游戏」</text>
        <text class="vd__tip">• 浏览器无法直接执行 Java, 请复制启动命令到 PC 终端运行</text>
        <text class="vd__tip">• 或下载启动脚本双击运行</text>
      </McCard>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.vd {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__empty { text-align: center; padding: 100rpx 0; }
  &__empty-text { font-size: 28rpx; color: #6a5a8a; }
  &__hero { display: flex; align-items: center; gap: 16rpx; margin-bottom: 24rpx; }
  &__hero-icon {
    width: 80rpx; height: 80rpx;
    background: linear-gradient(135deg, #2d1b4e, #1a0f2e);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 36rpx;
  }
  &__title { font-size: 36rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 22rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__section { margin-bottom: 24rpx; }
  &__desc { font-size: 26rpx; color: #b8a8d4; display: block; margin-bottom: 16rpx; line-height: 1.6; }
  &__meta {
    display: flex; flex-direction: column; gap: 8rpx;
    background: rgba(15, 15, 26, 0.4);
    padding: 16rpx; border-radius: 12rpx;
    margin-bottom: 16rpx;
  }
  &__meta-item { font-size: 22rpx; color: #b8a8d4; }
  &__path { display: block; font-size: 22rpx; color: #6a5a8a; margin-bottom: 16rpx; }
  &__loader-loading { text-align: center; padding: 40rpx 0; color: #b8a8d4; }
  &__loader-empty { text-align: center; padding: 40rpx 0; color: #6a5a8a; }
  &__loader-tip { text-align: center; padding: 40rpx 0; color: #6a5a8a; }
  &__spinner {
    display: inline-block; width: 32rpx; height: 32rpx;
    border: 4rpx solid rgba(216, 150, 255, 0.3);
    border-top-color: #d896ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 16rpx;
    vertical-align: middle;
  }
  &__tip { font-size: 24rpx; color: #b8a8d4; display: block; line-height: 1.7; }
}

.loader-tabs {
  display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 24rpx;
}
.loader-tab {
  display: flex; align-items: center; gap: 8rpx;
  padding: 12rpx 20rpx;
  background: rgba(15, 15, 26, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 12rpx;
  &.is-active {
    background: linear-gradient(135deg, rgba(255, 183, 213, 0.2), rgba(216, 150, 255, 0.2));
    border-color: #d896ff;
  }
  &__icon { font-size: 24rpx; }
  &__label { font-size: 24rpx; color: #ffffff; font-weight: 600; }
}

.loader-list { display: flex; flex-direction: column; gap: 12rpx; max-height: 600rpx; overflow-y: auto; }
.loader-item {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(15, 15, 26, 0.4);
  border: 2rpx solid rgba(216, 150, 255, 0.1);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  &__name { font-size: 26rpx; color: #ffffff; font-weight: 600; display: block; }
  &__sub { font-size: 22rpx; color: #6a5a8a; display: block; margin-top: 2rpx; }
  &__action { font-size: 32rpx; color: #d896ff; }
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
