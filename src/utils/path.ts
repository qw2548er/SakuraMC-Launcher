import { detectPlatform } from './format'

export function getDefaultGameDir(): string {
  const platform = detectPlatform()

  // #ifdef APP-PLUS
  // APP-PLUS-ANDROID / APP-PLUS-IOS 不是 uni-app 标准条件编译指令
  // 改用 uni.getSystemInfoSync() 在运行时判断平台
  try {
    const info = uni.getSystemInfoSync()
    if (info.platform === 'ios') {
      // iOS 使用 plus.io 私有目录前缀
      return '_doc/SakuraMC/.minecraft'
    }
  } catch (e) { /* 忽略 */ }
  // Android 默认外部存储路径
  return '/storage/emulated/0/SakuraMC/.minecraft'
  // #endif

  // #ifndef APP-PLUS
  // H5 等环境根据 UA 判断平台显示默认路径
  if (platform === 'windows') return 'C:\\Users\\用户名\\.minecraft'
  if (platform === 'macos') return '~/Library/Application Support/minecraft'
  if (platform === 'linux') return '~/.minecraft'
  if (platform === 'android') return '/storage/emulated/0/SakuraMC/.minecraft'
  return '~/.minecraft'
  // #endif
}

export function getDefaultLauncherDir(): string {
  const platform = detectPlatform()

  // #ifdef APP-PLUS
  try {
    const info = uni.getSystemInfoSync()
    if (info.platform === 'ios') {
      return '_doc/SakuraMC'
    }
  } catch (e) { /* 忽略 */ }
  return '/storage/emulated/0/SakuraMC'
  // #endif

  // #ifndef APP-PLUS
  if (platform === 'windows') return 'C:\\Users\\用户名\\SakuraMC'
  if (platform === 'macos') return '~/Library/Application Support/SakuraMC'
  if (platform === 'linux') return '~/.sakuramc'
  if (platform === 'android') return '/storage/emulated/0/SakuraMC'
  return '~/.sakuramc'
  // #endif
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
