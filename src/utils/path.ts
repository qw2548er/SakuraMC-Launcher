import { detectPlatform } from './format'

export function getDefaultGameDir(): string {
  const platform = detectPlatform()
  
  // #ifdef APP-PLUS
  // 移动端: /storage/emulated/0/SakuraMC/.minecraft
  // #ifdef APP-PLUS-ANDROID
  return '/storage/emulated/0/SakuraMC/.minecraft'
  // #endif
  // #ifdef APP-PLUS-IOS
  return 'SakuraMC/.minecraft'
  // #endif
  // #endif
  
  // #ifdef H5
  // H5 端根据 UA 判断平台显示默认路径
  if (platform === 'windows') return 'C:\\Users\\用户名\\.minecraft'
  if (platform === 'macos') return '~/Library/Application Support/minecraft'
  if (platform === 'linux') return '~/.minecraft'
  if (platform === 'android') return '/storage/emulated/0/SakuraMC/.minecraft'
  return '~/.minecraft'
  // #endif
  
  return '~/.minecraft'
}

export function getDefaultLauncherDir(): string {
  const platform = detectPlatform()
  
  // #ifdef APP-PLUS
  // #ifdef APP-PLUS-ANDROID
  return '/storage/emulated/0/SakuraMC'
  // #endif
  // #ifdef APP-PLUS-IOS
  return 'SakuraMC'
  // #endif
  // #endif
  
  // #ifdef H5
  if (platform === 'windows') return 'C:\\Users\\用户名\\SakuraMC'
  if (platform === 'macos') return '~/Library/Application Support/SakuraMC'
  if (platform === 'linux') return '~/.sakuramc'
  if (platform === 'android') return '/storage/emulated/0/SakuraMC'
  return '~/.sakuramc'
  // #endif
  
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
