/**
 * Android / App-PLUS 运行时权限管理
 */

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
  // #ifdef APP-PLUS
  try {
    const w = window as any
    if (w.cordova && w.cordova.plugins && w.cordova.plugins.SakuraMCCore) {
      return w.cordova.plugins.SakuraMCCore
    }
  } catch (e) {
    console.warn('[Permissions] getPlugin failed', e)
  }
  // #endif
  return null
}

function exec<T>(action: string, args: any[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    const plugin = getPlugin()
    if (!plugin) {
      reject(new Error('SakuraMCCore plugin not available'))
      return
    }
    ;(plugin as any)[action](...(args as any[]), resolve, reject)
  })
}

/**
 * 检查单一权限
 */
export async function checkPermission(name: string): Promise<boolean> {
  try {
    const res = await exec<number>('checkPermission', [name])
    return res === 1
  } catch {
    return false
  }
}

/**
 * 批量请求权限
 */
export async function requestPermissions(names: string[]): Promise<PermissionResult> {
  try {
    return await exec<PermissionResult>('requestPermissions', [names])
  } catch {
    return { allGranted: false, results: {} }
  }
}

/**
 * 请求 MANAGE_EXTERNAL_STORAGE（所有文件访问权限，Android 11+）
 */
export async function requestManageExternalStorage(): Promise<boolean> {
  try {
    const res = await exec<number>('requestManageExternalStorage')
    return res === 1
  } catch {
    return false
  }
}

/**
 * 检查 MANAGE_EXTERNAL_STORAGE
 */
export async function checkManageExternalStorage(): Promise<boolean> {
  try {
    const res = await exec<number>('checkManageExternalStorage')
    return res === 1
  } catch {
    return false
  }
}

/**
 * 打开应用设置页
 */
export async function openAppSettings(): Promise<void> {
  try {
    await exec<void>('openAppSettings')
  } catch (e) {
    console.warn('[Permissions] openAppSettings failed', e)
  }
}

/**
 * 获取 Android 平台信息
 */
export async function getPlatformInfo(): Promise<{ sdkInt: number; release: string; packageName: string } | null> {
  try {
    return await exec<{ sdkInt: number; release: string; packageName: string }>('getPlatformInfo')
  } catch {
    return null
  }
}

/**
 * 请求应用启动所需的核心权限（首页调用）
 */
export async function requestCorePermissions(): Promise<boolean> {
  // #ifndef APP-PLUS
  return true
  // #endif

  const info = await getPlatformInfo()
  if (!info) return false

  const sdk = info!.sdkInt

  // Android 13+ 使用媒体权限，Android 10 及以下使用传统存储权限
  const permissions: string[] = []
  if (sdk >= 33) {
    permissions.push('mediaImages', 'mediaVideo', 'mediaAudio')
  } else {
    permissions.push('storage', 'readStorage')
  }
  permissions.push('notifications')

  const res = await requestPermissions(permissions)

  // 对启动器来说，所有文件访问权限是核心，单独引导
  if (sdk >= 30) {
    const hasManage = await checkManageExternalStorage()
    if (!hasManage) {
      // 弹窗引导用户授权
      return new Promise((resolve) => {
        uni.showModal({
          title: '需要文件访问权限',
          content: '樱花 MC 启动器需要访问设备存储来管理 Minecraft 游戏文件、资源包和存档。请在设置中授予「所有文件访问权限」。',
          confirmText: '去授权',
          cancelText: '稍后再说',
          success: async (r) => {
            if (r.confirm) {
              const granted = await requestManageExternalStorage()
              resolve(granted && res.allGranted)
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

/**
 * 检查并请求核心权限（返回是否已获得关键权限）
 */
export async function ensureCorePermissions(): Promise<boolean> {
  // #ifndef APP-PLUS
  return true
  // #endif

  const info = await getPlatformInfo()
  if (!info) return false

  if (info!.sdkInt >= 30) {
    return await checkManageExternalStorage()
  }

  if (info!.sdkInt >= 33) {
    const imgs = await checkPermission('mediaImages')
    const videos = await checkPermission('mediaVideo')
    const audio = await checkPermission('mediaAudio')
    return imgs && videos && audio
  }

  return await checkPermission('storage')
}
