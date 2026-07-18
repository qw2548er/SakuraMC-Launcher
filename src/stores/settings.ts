import { defineStore } from 'pinia'
import type { ISettings, DownloadSource } from '@/types'
import { detectPlatform } from '@/utils/format'

const STORAGE_KEY = 'sakuram.settings.v1'

const defaultSettings: ISettings = {
  javaPath: '',
  defaultMemory: 2048,
  maxMemory: 4096,
  minMemory: 1024,
  downloadSource: 'bmcl' as DownloadSource,
  gameDir: '/storage/emulated/0/SakuraMC/.minecraft',
  versionsDir: '/storage/emulated/0/SakuraMC/.minecraft/versions',
  modsDir: '/storage/emulated/0/SakuraMC/.minecraft/mods',
  resourcepacksDir: '/storage/emulated/0/SakuraMC/.minecraft/resourcepacks',
  savesDir: '/storage/emulated/0/SakuraMC/.minecraft/saves',
  screenshotsDir: '/storage/emulated/0/SakuraMC/.minecraft/screenshots',
  logsDir: '/storage/emulated/0/SakuraMC/.minecraft/logs',
  shaderpacksDir: '/storage/emulated/0/SakuraMC/.minecraft/shaderpacks',
  showSnapshots: false,
  showOldVersions: false,
  fullscreen: true,
  autoJoinServer: false,
  theme: 'dark',
  language: 'zh-CN',
  frpcBinaryPath: '',
  frpcLogLevel: 'info',
  ignoredVersion: '',
  autoCheckUpdate: true,
  customJvmArgs: '',
  customGameArgs: '',
  windowWidth: 854,
  windowHeight: 480,
  serverAddress: '',
  javaArgs: ''
}

export const useSettingsStore = defineStore('settings', {
  state: (): ISettings => ({ ...defaultSettings }),
  getters: {
    platform: () => detectPlatform(),
    downloadBase(): string {
      return this.downloadSource === 'mojang' ? 'https://piston-meta.mojang.com'
        : this.downloadSource === 'mcbbs' ? 'https://download.mcbbs.net'
        : 'https://bmclapi2.bangbang93.com'
    }
  },
  actions: {
    load() {
      try {
        const raw = uni.getStorageSync(STORAGE_KEY)
        if (raw) Object.assign(this, JSON.parse(raw as string))
      } catch (e) {
        console.warn('[Settings] load failed', e)
      }
    },
    save() {
      try {
        uni.setStorageSync(STORAGE_KEY, JSON.stringify(this.$state))
      } catch (e) {
        console.warn('[Settings] save failed', e)
      }
    },
    update(patch: Partial<ISettings>) {
      Object.assign(this, patch)
      this.save()
    },
    reset() {
      Object.assign(this, defaultSettings)
      this.save()
    }
  }
})
