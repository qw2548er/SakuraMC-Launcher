import { defineStore } from 'pinia'
import type { IGameVersion, IModLoader, IDownloadTask } from '@/types'
import { uuid } from '@/utils/format'
import * as bmcl from '@/api/bmcl'
import { useSettingsStore } from './settings'
import { downloadFile } from '@/utils/downloader'

const STORAGE_KEY = 'sakuram.versions.v1'
const INSTALLED_KEY = 'sakuram.versions.installed.v1'

interface State {
  manifest: {
    latest: { release: string; snapshot: string }
    versions: IGameVersion[]
  } | null
  manifestLoading: boolean
  manifestError: string | null
  installed: Record<string, IGameVersion>
  selectedId: string | null
  downloads: IDownloadTask[]
  modLoaders: Record<string, IModLoader[]>
  loadingLoaders: Record<string, boolean>
}

export const useVersionStore = defineStore('version', {
  state: (): State => ({
    manifest: null,
    manifestLoading: false,
    manifestError: null,
    installed: {},
    selectedId: null,
    downloads: [],
    modLoaders: {},
    loadingLoaders: {}
  }),
  getters: {
    selected(state): IGameVersion | null {
      return state.selectedId ? state.installed[state.selectedId] || (state.manifest?.versions.find(v => v.id === state.selectedId) ?? null) : null
    },
    installedList(state): IGameVersion[] {
      return Object.values(state.installed).sort((a, b) => (b.releaseTime || '').localeCompare(a.releaseTime || ''))
    },
    releaseVersions(state): IGameVersion[] {
      return state.manifest?.versions.filter(v => v.type === 'release') ?? []
    },
    snapshotVersions(state): IGameVersion[] {
      return state.manifest?.versions.filter(v => v.type === 'snapshot') ?? []
    },
    activeDownloads: (s) => s.downloads.filter(d => d.status === 'downloading'),
    downloadProgress: (s) => {
      if (s.downloads.length === 0) return 0
      const active = s.downloads.filter(d => d.status === 'downloading' || d.status === 'completed')
      if (!active.length) return 0
      const total = active.reduce((a, d) => a + d.total, 0)
      const done = active.reduce((a, d) => a + d.downloaded, 0)
      return total ? Math.floor(done * 100 / total) : 0
    }
  },
  actions: {
    load() {
      try {
        const ins = uni.getStorageSync(INSTALLED_KEY)
        if (ins) this.installed = JSON.parse(ins as string)
        const sel = uni.getStorageSync('sakuram.versions.selected.v1')
        if (sel) this.selectedId = sel as string
        // 如果没有选中版本,但有已安装版本,自动选择第一个
        if (!this.selectedId) {
          const ids = Object.keys(this.installed)
          if (ids.length > 0) this.selectedId = ids[0]
        }
      } catch (e) { console.warn('[Version] load failed', e) }
    },
    persistInstalled() {
      uni.setStorageSync(INSTALLED_KEY, JSON.stringify(this.installed))
      uni.setStorageSync('sakuram.versions.selected.v1', this.selectedId || '')
    },
    async loadManifest(force = false) {
      if (this.manifest && !force) return
      this.manifestLoading = true
      this.manifestError = null
      try {
        const settings = useSettingsStore()
        const r = await bmcl.getVersionManifestV2(settings.downloadSource)
        this.manifest = {
          latest: r.latest,
          versions: r.versions
        }
      } catch (e: any) {
        this.manifestError = e.message
        // fallback 假数据
        if (!this.manifest) {
          this.manifest = {
            latest: { release: '1.21.4', snapshot: '1.21.4-rc1' },
            versions: fakeVersions()
          }
        }
      } finally {
        this.manifestLoading = false
      }
    },
    select(id: string) {
      this.selectedId = id
      this.persistInstalled()
    },
    markInstalled(v: IGameVersion) {
      v.installed = true
      this.installed[v.id] = v
      this.persistInstalled()
    },
    markUninstalled(id: string) {
      delete this.installed[id]
      this.persistInstalled()
    },
    addDownload(task: Omit<IDownloadTask, 'id'>) {
      const t: IDownloadTask = { id: uuid(), ...task }
      this.downloads.unshift(t)
      return t
    },
    updateDownload(id: string, patch: Partial<IDownloadTask>) {
      const t = this.downloads.find(d => d.id === id)
      if (t) Object.assign(t, patch)
    },
    removeDownload(id: string) {
      this.downloads = this.downloads.filter(d => d.id !== id)
    },
    clearCompletedDownloads() {
      this.downloads = this.downloads.filter(d => d.status !== 'completed')
    },
    isDownloading(versionId: string): boolean {
      return this.downloads.some(d => d.name.includes(versionId) && d.status === 'downloading')
    },
    /**
     * 下载并安装版本 (兼容 versions.vue 调用)
     */
    async download(versionId: string) {
      if (this.isDownloading(versionId)) {
        uni.showToast({ title: '该版本正在下载中', icon: 'none' })
        return
      }
      if (this.installed[versionId]) {
        uni.showToast({ title: '该版本已安装', icon: 'none' })
        return
      }
      const settings = useSettingsStore()
      const manifestVersion = this.manifest?.versions.find(v => v.id === versionId)
      if (!manifestVersion) {
        uni.showToast({ title: '版本信息不存在,请刷新版本列表', icon: 'none' })
        return
      }
      const task = this.addDownload({
        name: `Minecraft ${versionId}`,
        url: '',
        total: 0,
        downloaded: 0,
        status: 'downloading'
      })
      uni.showToast({ title: '正在获取版本信息...', icon: 'none', duration: 2000 })
      try {
        console.log('[Download] 开始下载版本:', versionId, '源:', settings.downloadSource)
        if (!this.manifest) {
          await this.loadManifest(true)
        }
        let versionJson: any = null
        let client: any = null
        let clientUrl: string = ''
        try {
          versionJson = await bmcl.getVersionJson(versionId, settings.downloadSource)
          console.log('[Download] 版本 JSON 获取成功:', versionId)
          client = versionJson?.downloads?.client
          if (!client?.url) {
            throw new Error('版本 JSON 中没有客户端下载地址')
          }
        } catch (e: any) {
          console.warn('[Download] 首选源获取失败,尝试直接构建下载地址:', e.message)
          clientUrl = await this.buildDirectDownloadUrl(versionId, settings.downloadSource)
          if (!clientUrl) {
            throw new Error('无法构建下载地址')
          }
          client = { url: clientUrl, size: 0 }
        }
        if (!clientUrl) {
          clientUrl = client.url
          if (settings.downloadSource === 'bmcl') {
            clientUrl = clientUrl
              .replace('https://launcher.mojang.com', 'https://bmclapi2.bangbang93.com')
              .replace('https://piston-data.mojang.com', 'https://bmclapi2.bangbang93.com')
          } else if (settings.downloadSource === 'mcbbs') {
            clientUrl = clientUrl
              .replace('https://launcher.mojang.com', 'https://download.mcbbs.net')
              .replace('https://piston-data.mojang.com', 'https://download.mcbbs.net')
          }
        }
        console.log('[Download] 客户端下载地址:', clientUrl)
        this.updateDownload(task.id, {
          url: clientUrl,
          total: client.size || 0
        })
        uni.showToast({ title: '开始下载 Minecraft ' + versionId, icon: 'none', duration: 2000 })
        await downloadFile({
          url: clientUrl,
          timeout: 600000,
          onProgress: (downloaded, total, speed) => {
            const realTotal = total || client.size || 0
            this.updateDownload(task.id, { downloaded, total: realTotal, speed })
          },
          onSuccess: (path) => {
            console.log('[Download] 下载完成,路径:', path)
            this.updateDownload(task.id, { status: 'completed', downloaded: client.size || 0, total: client.size || 0 })
            this.markInstalled({
              ...manifestVersion,
              installed: true,
              installedPath: path || `./.minecraft/versions/${versionId}`,
              size: client.size
            })
            // 下载完成后自动选为启动版本
            this.selectedId = versionId
            this.persistInstalled()
            uni.showToast({ title: 'Minecraft ' + versionId + ' 下载完成并自动选中', icon: 'success', duration: 3000 })
          },
          onError: (e) => {
            console.error('[Download] 下载失败:', e.message)
            this.updateDownload(task.id, { status: 'error', error: e.message })
            uni.showToast({ title: '下载失败: ' + e.message, icon: 'none', duration: 5000 })
          }
        })
      } catch (e: any) {
        console.error('[Download] 版本下载异常:', e)
        this.updateDownload(task.id, { status: 'error', error: e.message })
        uni.showToast({ title: '下载失败: ' + (e.message || '未知错误'), icon: 'none', duration: 5000 })
      }
    },
    async buildDirectDownloadUrl(versionId: string, source: string): Promise<string> {
      const bmclBase = 'https://bmclapi2.bangbang93.com'
      const mcbbsBase = 'https://download.mcbbs.net'
      try {
        const versionUrl = `${bmclBase}/mc/version/${versionId}`
        console.log('[Download] 尝试直接获取版本信息:', versionUrl)
        const r = await uni.request({ url: versionUrl })
        const v = r.data
        if (v?.downloads?.client?.url) {
          return v.downloads.client.url
        }
        if (v?.downloads?.client?.sha1) {
          const sha1 = v.downloads.client.sha1
          return `${bmclBase}/mc/download/${sha1}`
        }
      } catch (e) {
        console.warn('[Download] BMCL 直接获取失败:', e.message)
      }
      try {
        const mojangUrl = `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`
        const r = await uni.request({ url: mojangUrl })
        const manifest = r.data
        const version = manifest.versions.find((x: any) => x.id === versionId)
        if (version?.url) {
          const rv = await uni.request({ url: version.url })
          const v = rv.data
          if (v?.downloads?.client?.url) {
            let url = v.downloads.client.url
            if (source === 'bmcl') {
              url = url.replace('https://launcher.mojang.com', bmclBase)
              url = url.replace('https://piston-data.mojang.com', bmclBase)
            } else if (source === 'mcbbs') {
              url = url.replace('https://launcher.mojang.com', mcbbsBase)
              url = url.replace('https://piston-data.mojang.com', mcbbsBase)
            }
            return url
          }
        }
      } catch (e) {
        console.warn('[Download] Mojang 获取失败:', e.message)
      }
      return ''
    },

    async cancelDownload(versionId: string) {
      const tasks = this.downloads.filter(d => d.name.includes(versionId) && d.status === 'downloading')
      tasks.forEach(t => { t.status = 'error'; t.error = '已取消' })
      uni.showToast({ title: '已取消下载', icon: 'none' })
    },

    uninstall(id: string) {
      this.markUninstalled(id)
      uni.showToast({ title: '已删除版本', icon: 'success' })
    },

    async loadModLoaders(mcVersion: string) {
      this.loadingLoaders[mcVersion] = true
      try {
        const [forge, fabric, quilt, neoforge, optifine] = await Promise.allSettled([
          bmcl.getForgeVersionList(mcVersion),
          bmcl.getFabricLoaders(mcVersion),
          bmcl.getQuiltMeta(mcVersion),
          bmcl.getNeoForgeList(),
          bmcl.getOptiFineList(mcVersion)
        ])
        const loaders: IModLoader[] = []
        if (forge.status === 'fulfilled') {
          forge.value.slice(0, 20).forEach(f => loaders.push({ type: 'forge', version: f.version, mcVersion, installed: false }))
        }
        if (fabric.status === 'fulfilled') {
          fabric.value.slice(0, 20).forEach(f => loaders.push({ type: 'fabric', version: f.loader.version, mcVersion, installed: false }))
        }
        if (quilt.status === 'fulfilled') {
          (Array.isArray(quilt.value) ? quilt.value : []).slice(0, 20).forEach((q: any) => loaders.push({ type: 'quilt', version: q.loader?.version || q.version, mcVersion, installed: false }))
        }
        if (neoforge.status === 'fulfilled') {
          neoforge.value.filter(n => n.mcversion === mcVersion).slice(0, 20).forEach(n => loaders.push({ type: 'neoforge', version: n.version, mcVersion, installed: false }))
        }
        if (optifine.status === 'fulfilled') {
          optifine.value.slice(0, 10).forEach(o => loaders.push({ type: 'optifine', version: o.name, mcVersion, installed: false }))
        }
        this.modLoaders[mcVersion] = loaders
      } catch (e) {
        console.warn('[Version] loadModLoaders failed', e)
      } finally {
        this.loadingLoaders[mcVersion] = false
      }
    }
  }
})

function fakeVersions(): IGameVersion[] {
  const releases = [
    '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.1',
    '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5', '1.15.2', '1.14.4',
    '1.13.2', '1.12.2', '1.11.2', '1.10.2', '1.9.4', '1.8.9', '1.7.10'
  ]
  return releases.map((id, i) => ({
    id,
    type: 'release',
    url: '',
    time: '2024-01-01T00:00:00+00:00',
    releaseTime: new Date(Date.now() - i * 90 * 86400_000).toISOString()
  }))
}
