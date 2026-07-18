import { defineStore } from 'pinia'
import type { IGameVersion, IModLoader, IDownloadTask } from '@/types'
import { uuid } from '@/utils/format'
import * as bmcl from '@/api/bmcl'
import { useSettingsStore } from './settings'

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
        if (!this.selectedId && this.installed['1.21']) this.selectedId = '1.21'
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
