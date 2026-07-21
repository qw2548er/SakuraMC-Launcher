/**
 * 文件选择、管理与操作工具
 * 通过系统文件管理器选择文件、打开外部文件管理器、解压、分享等
 */

export interface ImportedFile {
  path: string
  name: string
  size: number
}

export interface FileInfo {
  exists: boolean
  isDirectory: boolean
  isFile: boolean
  name: string
  path: string
  size: number
  lastModified: number
  canRead: boolean
  canWrite: boolean
}

export interface ZipEntry {
  name: string
  size: number
  isDirectory: boolean
}

export interface UnzipResult {
  success: boolean
  fileCount: number
  destDir: string
}

export interface ImageData {
  base64: string
  width: number
  height: number
}

interface CordovaFileOps {
  openExternalFileManager(path: string, success: (res: number) => void, error: (msg: string) => void): void
  chooseFile(acceptType: string, multiple: boolean, success: (res: string[]) => void, error: (msg: string) => void): void
  importFile(uri: string, destDir: string, success: (res: ImportedFile) => void, error: (msg: string) => void): void
  getFileInfo(path: string, success: (res: FileInfo) => void, error: (msg: string) => void): void
  mkdir(path: string, success: (res: number) => void, error: (msg: string) => void): void
  rename(oldPath: string, newPath: string, success: (res: number) => void, error: (msg: string) => void): void
  unzip(zipPath: string, destDir: string, success: (res: UnzipResult) => void, error: (msg: string) => void): void
  listZip(zipPath: string, success: (res: ZipEntry[]) => void, error: (msg: string) => void): void
  shareFile(path: string, title: string, success: (res: number) => void, error: (msg: string) => void): void
  getImageBase64(path: string, maxWidth: number, maxHeight: number, success: (res: ImageData) => void, error: (msg: string) => void): void
  sha1File(path: string, success: (res: string) => void, error: (msg: string) => void): void
}

function getPlugin(): CordovaFileOps | null {
  try {
    const w = window as any
    if (w.cordova && w.cordova.plugins && w.cordova.plugins.SakuraMCCore) {
      return w.cordova.plugins.SakuraMCCore
    }
  } catch (e) {
    console.warn('[FileOps] getPlugin failed', e)
  }
  return null
}

async function exec<T>(action: string, args: any[] = []): Promise<T> {
  const { waitForReady } = await import('./cordova-fs')
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

/**
 * 打开系统外部文件管理器到指定路径
 */
export async function openExternalFileManager(path?: string): Promise<boolean> {
  try {
    const res = await exec<number>('openExternalFileManager', [path || ''])
    return res === 1
  } catch (e) {
    console.warn('[FileOps] openExternalFileManager failed:', e)
    return false
  }
}

/**
 * 调用系统文件选择器选择文件
 */
export async function chooseFile(acceptType: string = '*/*', multiple: boolean = false): Promise<string[]> {
  try {
    return await exec<string[]>('chooseFile', [acceptType, multiple])
  } catch (e) {
    console.warn('[FileOps] chooseFile failed:', e)
    throw e
  }
}

/**
 * 将选中的文件导入到目标目录
 */
export async function importFile(uri: string, destDir: string): Promise<ImportedFile> {
  try {
    return await exec<ImportedFile>('importFile', [uri, destDir])
  } catch (e) {
    console.warn('[FileOps] importFile failed:', e)
    throw e
  }
}

/**
 * 从外部选择并导入文件到指定目录
 */
export async function chooseAndImport(
  destDir: string,
  acceptType: string = '*/*',
  multiple: boolean = false
): Promise<ImportedFile[]> {
  const uris = await chooseFile(acceptType, multiple)
  const results: ImportedFile[] = []
  for (const uri of uris) {
    try {
      const imported = await importFile(uri, destDir)
      results.push(imported)
    } catch (e) {
      console.warn('[FileOps] import single file failed:', uri, e)
    }
  }
  return results
}

/**
 * 获取文件信息
 */
export async function getFileInfo(path: string): Promise<FileInfo | null> {
  try {
    return await exec<FileInfo>('getFileInfo', [path])
  } catch (e) {
    return null
  }
}

/**
 * 创建目录
 */
export async function mkdir(path: string): Promise<boolean> {
  try {
    const res = await exec<number>('mkdir', [path])
    return res === 1
  } catch (e) {
    console.warn('[FileOps] mkdir failed:', e)
    return false
  }
}

/**
 * 重命名文件或目录
 */
export async function rename(oldPath: string, newPath: string): Promise<boolean> {
  try {
    const res = await exec<number>('rename', [oldPath, newPath])
    return res === 1
  } catch (e) {
    console.warn('[FileOps] rename failed:', e)
    return false
  }
}

/**
 * 解压 zip 文件到指定目录
 */
export async function unzip(zipPath: string, destDir: string): Promise<UnzipResult> {
  try {
    return await exec<UnzipResult>('unzip', [zipPath, destDir])
  } catch (e) {
    console.warn('[FileOps] unzip failed:', e)
    throw e
  }
}

/**
 * 列出 zip 文件内部条目（预览）
 */
export async function listZip(zipPath: string): Promise<ZipEntry[]> {
  try {
    return await exec<ZipEntry[]>('listZip', [zipPath])
  } catch (e) {
    console.warn('[FileOps] listZip failed:', e)
    return []
  }
}

/**
 * 分享文件到其他应用
 */
export async function shareFile(path: string, title: string = '分享文件'): Promise<boolean> {
  try {
    const res = await exec<number>('shareFile', [path, title])
    return res === 1
  } catch (e) {
    console.warn('[FileOps] shareFile failed:', e)
    return false
  }
}

/**
 * 获取图片的 base64 数据（用于预览）
 */
export async function getImageBase64(path: string, maxWidth: number = 0, maxHeight: number = 0): Promise<ImageData | null> {
  try {
    return await exec<ImageData>('getImageBase64', [path, maxWidth, maxHeight])
  } catch (e) {
    console.warn('[FileOps] getImageBase64 failed:', e)
    return null
  }
}

/**
 * 计算文件的 SHA1 哈希
 */
export async function sha1File(path: string): Promise<string | null> {
  try {
    return await exec<string>('sha1File', [path])
  } catch (e) {
    console.warn('[FileOps] sha1File failed:', e)
    return null
  }
}

/**
 * 校验文件 SHA1
 */
export async function verifySha1(path: string, expectedSha1: string): Promise<boolean> {
  const actual = await sha1File(path)
  if (!actual) return false
  return actual.toLowerCase() === expectedSha1.toLowerCase()
}

/**
 * 打开方式选择弹窗（内置管理器 / 外部管理器）
 */
export function showOpenModeDialog(path: string): Promise<void> {
  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: ['用内置管理器打开', '用系统文件管理器打开'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // #ifdef APP-PLUS
          uni.navigateTo({
            url: `/pages/files/files?path=${encodeURIComponent(path)}`,
            success: () => resolve(),
            fail: () => resolve()
          })
          // #endif
          // #ifndef APP-PLUS
          uni.showToast({ title: '仅手机端支持', icon: 'none' })
          resolve()
          // #endif
        } else if (res.tapIndex === 1) {
          openExternalFileManager(path).finally(() => resolve())
        } else {
          resolve()
        }
      },
      fail: () => resolve()
    })
  })
}

/**
 * 选择并导入图片到指定目录（用于背景图等）
 */
export async function chooseAndImportImage(destDir: string, destFileName?: string): Promise<ImportedFile | null> {
  const uris = await chooseFile('image/*', false)
  if (uris.length === 0) return null
  const imported = await importFile(uris[0], destDir)
  if (destFileName && imported.path !== `${destDir}/${destFileName}`) {
    const newPath = `${destDir}/${destFileName}`
    const ok = await rename(imported.path, newPath)
    if (ok) {
      imported.path = newPath
      imported.name = destFileName
    }
  }
  return imported
}
