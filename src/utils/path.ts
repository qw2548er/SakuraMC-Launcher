import { detectPlatform } from './format'
import { isCordova } from './cordova-fs'

export function getDefaultGameDir(): string {
  const platform = detectPlatform()

  if (isCordova()) {
    try {
      const info = uni.getSystemInfoSync()
      if (info.platform === 'ios') {
        return '_doc/SakuraMC/.minecraft'
      }
    } catch (e) { /* 忽略 */ }
    return '/storage/emulated/0/SakuraMC/.minecraft'
  }

  if (platform === 'windows') return 'C:\\Users\\用户名\\.minecraft'
  if (platform === 'macos') return '~/Library/Application Support/minecraft'
  if (platform === 'linux') return '~/.minecraft'
  if (platform === 'android') return '/storage/emulated/0/SakuraMC/.minecraft'
  return '~/.minecraft'
}

export function getDefaultLauncherDir(): string {
  const platform = detectPlatform()

  if (isCordova()) {
    try {
      const info = uni.getSystemInfoSync()
      if (info.platform === 'ios') {
        return '_doc/SakuraMC'
      }
    } catch (e) { /* 忽略 */ }
    return '/storage/emulated/0/SakuraMC'
  }

  if (platform === 'windows') return 'C:\\Users\\用户名\\SakuraMC'
  if (platform === 'macos') return '~/Library/Application Support/SakuraMC'
  if (platform === 'linux') return '~/.sakuramc'
  if (platform === 'android') return '/storage/emulated/0/SakuraMC'
  return '~/.sakuramc'
}

export function getVersionsDir(gameDir: string): string {
  return `${gameDir}/versions`
}

export function getLibrariesDir(gameDir: string): string {
  return `${gameDir}/libraries`
}

export function getAssetsDir(gameDir: string): string {
  return `${gameDir}/assets`
}

export function getModsDir(gameDir: string): string {
  return `${gameDir}/mods`
}

export function getResourcePacksDir(gameDir: string): string {
  return `${gameDir}/resourcepacks`
}

export function getSavesDir(gameDir: string): string {
  return `${gameDir}/saves`
}

export function getLogsDir(gameDir: string): string {
  return `${gameDir}/logs`
}
