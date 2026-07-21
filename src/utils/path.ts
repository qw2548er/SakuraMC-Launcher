import { detectPlatform } from './format'
import { isCordova, getAppExternalFilesDir } from './cordova-fs'

const FALLBACK_ANDROID_DIR = '/storage/emulated/0/Android/data/com.sakuramc.launcher/files'

let _cachedGameDir: string | null = null
let _cachedLauncherDir: string | null = null

export function getDefaultGameDirSync(): string {
  if (_cachedGameDir) return _cachedGameDir
  const platform = detectPlatform()

  if (isCordova()) {
    try {
      const info = uni.getSystemInfoSync()
      if (info.platform === 'ios') {
        return '_doc/SakuraMC/.minecraft'
      }
    } catch (e) { /* 忽略 */ }
    return `${FALLBACK_ANDROID_DIR}/SakuraMC/.minecraft`
  }

  if (platform === 'windows') return 'C:\\Users\\用户名\\.minecraft'
  if (platform === 'macos') return '~/Library/Application Support/minecraft'
  if (platform === 'linux') return '~/.minecraft'
  if (platform === 'android') return `${FALLBACK_ANDROID_DIR}/SakuraMC/.minecraft`
  return '~/.minecraft'
}

export function getDefaultLauncherDirSync(): string {
  if (_cachedLauncherDir) return _cachedLauncherDir
  const platform = detectPlatform()

  if (isCordova()) {
    try {
      const info = uni.getSystemInfoSync()
      if (info.platform === 'ios') {
        return '_doc/SakuraMC'
      }
    } catch (e) { /* 忽略 */ }
    return `${FALLBACK_ANDROID_DIR}/SakuraMC`
  }

  if (platform === 'windows') return 'C:\\Users\\用户名\\SakuraMC'
  if (platform === 'macos') return '~/Library/Application Support/SakuraMC'
  if (platform === 'linux') return '~/.sakuramc'
  if (platform === 'android') return `${FALLBACK_ANDROID_DIR}/SakuraMC`
  return '~/.sakuramc'
}

export async function getDefaultGameDir(): Promise<string> {
  if (_cachedGameDir) return _cachedGameDir

  if (!isCordova()) {
    _cachedGameDir = getDefaultGameDirSync()
    return _cachedGameDir
  }

  try {
    const info = uni.getSystemInfoSync()
    if (info.platform === 'ios') {
      _cachedGameDir = '_doc/SakuraMC/.minecraft'
      return _cachedGameDir
    }
  } catch (e) { /* 忽略 */ }

  try {
    const extDir = await getAppExternalFilesDir()
    if (extDir) {
      _cachedGameDir = extDir + '/SakuraMC/.minecraft'
      return _cachedGameDir
    }
  } catch {
    // 忽略, 走 fallback
  }

  _cachedGameDir = getDefaultGameDirSync()
  return _cachedGameDir
}

export async function getDefaultLauncherDir(): Promise<string> {
  if (_cachedLauncherDir) return _cachedLauncherDir

  if (!isCordova()) {
    _cachedLauncherDir = getDefaultLauncherDirSync()
    return _cachedLauncherDir
  }

  try {
    const info = uni.getSystemInfoSync()
    if (info.platform === 'ios') {
      _cachedLauncherDir = '_doc/SakuraMC'
      return _cachedLauncherDir
    }
  } catch (e) { /* 忽略 */ }

  try {
    const extDir = await getAppExternalFilesDir()
    if (extDir) {
      _cachedLauncherDir = extDir + '/SakuraMC'
      return _cachedLauncherDir
    }
  } catch {
    // 忽略, 走 fallback
  }

  _cachedLauncherDir = getDefaultLauncherDirSync()
  return _cachedLauncherDir
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
