/**
 * Android 运行时权限管理 (Cordova 插件版)
 *
 * 注意: 本项目是 uni-app H5 + Cordova 打包, 不是 uni-app APP-PLUS,
 * 所以没有 plus 对象, 所有原生能力通过 SakuraMCCore 插件调用.
 */

import { isCordova, waitForReady } from './cordova-fs'

export interface PermissionResult {
  allGranted: boolean
  results: Record<string, boolean>
}

interface CordovaSakuraCore {
  checkPermission(permission: string, success: (res: number) => void, error: (msg: string) => void): void
  requestPermissions(permissions: string[], success: (res: PermissionResult) => void, error: (msg: string) => void): void
  requestManageExternalStorage(success: (res: number) => void, error: (msg: string) => void): void
  checkManageExternalStorage(success: (res: number) => void, error: (msg: string) => void): void
  openAppSettings(success: () => void, error: (msg: string) => void): void
  getPlatformInfo(success: (res: { sdkInt: number; release: string; packageName: string }) => void, error: (msg: string) => void): void
}

function getPlugin(): CordovaSakuraCore | null {
  if (!isCordova()) return null
  try {
    const w = window as any
    if (w.cordova && w.cordova.plugins && w.cordova.plugins.SakuraMCCore) {
      return w.cordova.plugins.SakuraMCCore
    }
  } catch (e) {
    console.warn('[Permissions] getPlugin failed', e)
  }
  return null
}

async function exec<T>(action: string, args: any[] = []): Promise<T> {
  await waitForReady().catch(() => {})
  return new Promise((resolve, reject) => {
    const w = window as any
    // 优先使用已注册的 JS 模块
    const plugin = getPlugin()
    if (plugin && typeof (plugin as any)[action] === 'function') {
      ;(plugin as any)[action](...args, resolve, reject)
      return
    }
    // 回退: 直接通过 cordova.exec 调用
    const execFn = w.cordova?.exec
    if (execFn) {
      execFn(resolve, reject, 'SakuraMCCore', action, args)
      return
    }
    reject(new Error('SakuraMCCore plugin not available (无 JS 模块且 cordova.exec 不存在)'))
  })
}

export async function checkPermission(name: string): Promise<boolean> {
  try {
    const res = await exec<number>('checkPermission', [name])
    return res === 1
  } catch {
    return false
  }
}

export async function requestPermissions(names: string[]): Promise<PermissionResult> {
  try {
    return await exec<PermissionResult>('requestPermissions', [names])
  } catch {
    return { allGranted: false, results: {} }
  }
}

export async function requestManageExternalStorage(): Promise<boolean> {
  try {
    const res = await exec<number>('requestManageExternalStorage')
    return res === 1
  } catch {
    return false
  }
}

export async function checkManageExternalStorage(): Promise<boolean> {
  try {
    const res = await exec<number>('checkManageExternalStorage')
    return res === 1
  } catch {
    return false
  }
}

export async function openAppSettings(): Promise<void> {
  try {
    await exec<void>('openAppSettings')
  } catch (e) {
    console.warn('[Permissions] openAppSettings failed', e)
  }
}

export async function getPlatformInfo(): Promise<{ sdkInt: number; release: string; packageName: string } | null> {
  try {
    return await exec<{ sdkInt: number; release: string; packageName: string }>('getPlatformInfo')
  } catch {
    return null
  }
}

/**
 * 请求应用启动所需的核心权限
 */
export async function requestCorePermissions(): Promise<boolean> {
  if (!isCordova()) return true

  const info = await getPlatformInfo()
  if (!info) return false

  const sdk = info.sdkInt
  const permissions: string[] = []
  if (sdk >= 33) {
    permissions.push('mediaImages', 'mediaVideo', 'mediaAudio')
  } else {
    permissions.push('storage', 'readStorage')
  }
  permissions.push('notifications')

  if (sdk >= 31) {
    permissions.push('bluetoothConnect', 'bluetoothScan')
  }

  const res = await requestPermissions(permissions)

  if (sdk >= 30) {
    const hasManage = await checkManageExternalStorage()
    if (!hasManage) {
      return new Promise((resolve) => {
        uni.showModal({
          title: '需要文件访问权限',
          content: '樱花 MC 启动器需要访问设备存储来管理 Minecraft 游戏文件、资源包和存档。请在设置中授予「所有文件访问权限」。',
          confirmText: '去授权',
          cancelText: '稍后再说',
          success: async (r) => {
            if (r.confirm) {
              const granted = await requestManageExternalStorage()
              if (granted) {
                resolve(true)
              } else {
                uni.showModal({
                  title: '权限未授予',
                  content: '需要存储权限才能读取游戏资源。请前往设置开启「所有文件访问权限」。',
                  confirmText: '去设置',
                  cancelText: '取消',
                  success: async (r2) => {
                    if (r2.confirm) {
                      await openAppSettings()
                    }
                    resolve(false)
                  }
                })
              }
            } else {
              resolve(res.allGranted)
            }
          }
        })
      })
    }
  }

  return res.allGranted
}

export async function ensureCorePermissions(): Promise<boolean> {
  if (!isCordova()) return true

  const info = await getPlatformInfo()
  if (!info) return false

  if (info.sdkInt >= 30) {
    return await checkManageExternalStorage()
  }
  if (info.sdkInt >= 33) {
    const imgs = await checkPermission('mediaImages')
    const videos = await checkPermission('mediaVideo')
    const audio = await checkPermission('mediaAudio')
    return imgs && videos && audio
  }
  return await checkPermission('storage')
}
