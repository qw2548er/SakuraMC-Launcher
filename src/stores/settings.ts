import { defineStore } from 'pinia'
import type { ISettings } from '@/types'
import type { DownloadSource } from '@/api/bmcl'
import { detectPlatform } from '@/utils/format'
import { isCordova } from '@/utils/cordova-fs'
import { getDefaultGameDirSync, getDefaultLauncherDirSync } from '@/utils/path'

const STORAGE_KEY = 'sakuram.settings.v1'

function buildDefaultPaths(): Partial<ISettings> {
  const base = getDefaultGameDirSync()
  return {
    gameDir: base,
    versionsDir: `${base}/versions`,
    modsDir: `${base}/mods`,
    resourcepacksDir: `${base}/resourcepacks`,
    savesDir: `${base}/saves`,
    screenshotsDir: `${base}/screenshots`,
    logsDir: `${base}/logs`,
    shaderpacksDir: `${base}/shaderpacks`
  }
}

const defaultSettings: ISettings = {
  javaPath: '',
  defaultMemory: 2048,
  maxMemory: 4096,
  minMemory: 1024,
  downloadSource: 'bmcl' as DownloadSource,
  ...buildDefaultPaths(),
  showSnapshots: false,
  showOldVersions: false,
  fullscreen: true,
  autoJoinServer: false,
  autoInstallForge: false,
  autoInstallFabric: false,
  autoInstallOptifine: false,
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
  javaArgs: '',
  backgroundImagePath: '',
  useCustomBackground: false
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
    async initAsync() {
      if (!isCordova()) return
      try {
        const baseGameDir = '/storage/emulated/0/MaoNingMC/.minecraft'
        const stored = uni.getStorageSync(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored as string)
          if (parsed.gameDir && !parsed.gameDir.includes('/storage/emulated/0/MaoNingMC')) {
            return
          }
        }
        if (!this.gameDir || !this.gameDir.includes('/storage/emulated/0/MaoNingMC')) {
          this.gameDir = baseGameDir
          this.versionsDir = `${baseGameDir}/versions`
          this.modsDir = `${baseGameDir}/mods`
          this.resourcepacksDir = `${baseGameDir}/resourcepacks`
          this.savesDir = `${baseGameDir}/saves`
          this.screenshotsDir = `${baseGameDir}/screenshots`
          this.logsDir = `${baseGameDir}/logs`
          this.shaderpacksDir = `${baseGameDir}/shaderpacks`
          this.save()
        }
      } catch (e) {
        console.warn('[Settings] initAsync failed', e)
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
