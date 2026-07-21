/**
 * Cordova 文件系统抽象层
 *
 * 由于本项目使用 uni-app H5 + Cordova 打包成 APK, 没有 plus 对象,
 * 所有原生文件操作必须通过 Cordova 插件完成.
 *
 * 此模块封装统一的文件系统 API, 上层代码无需关心底层是
 * SakuraMCCore 插件还是 cordova-plugin-file.
 */

let _deviceReady = false
let _deviceReadyPromise: Promise<void> | null = null

/** 
 * 平台检测: 是否运行在 Cordova WebView 中
 * 
 * 注意: window.cordova 对象在 deviceready 之前就存在,
 * 但插件需要等 deviceready 之后才能调用.
 */
export function isCordova(): boolean {
  try {
    const w = window as any
    // 多重检测: cordova 对象 / file:// 协议 (Cordova Android WebView) / document.URL 包含 android_asset
    if (w.cordova) return true
    if (typeof location !== 'undefined' && location.protocol === 'file:') return true
    if (typeof document !== 'undefined' && document.URL && document.URL.includes('android_asset')) return true
    return false
  } catch {
    return false
  }
}

/**
 * 检测 Cordova 是否已经 ready (deviceready 已触发)
 */
export function isCordovaReady(): boolean {
  if (!isCordova()) return false
  if (_deviceReady) return true
  try {
    const w = window as any
    // 不依赖 window.device (需要 cordova-plugin-device, 本项目未安装)
    // 只检查 deviceready 标记
    return !!(w.cordova && _deviceReady)
  } catch {
    return false
  }
}

/**
 * 等待 Cordova deviceready 事件
 * 如果已经 ready, 立即 resolve
 * 重复调用会返回同一个 Promise
 *
 * 默认超时 45 秒, Android 15 冷启动可能较慢
 */
export function waitForReady(timeout = 45000): Promise<void> {
  if (_deviceReadyPromise) return _deviceReadyPromise

  _deviceReadyPromise = new Promise((resolve, reject) => {
    if (!isCordova()) {
      reject(new Error('非 Cordova 环境'))
      return
    }
    if (_deviceReady) {
      resolve()
      return
    }

    const w = window as any
    const timer = setTimeout(() => {
      if (w.cordova && typeof w.cordova.exec === 'function') {
        console.warn('[CordovaFS] deviceready 超时, 但 cordova.exec 可用, 继续执行')
        _deviceReady = true
        resolve()
      } else {
        _deviceReadyPromise = null
        reject(new Error('Cordova 初始化超时 (cordova.exec 不可用)'))
      }
    }, timeout)

    const onReady = () => {
      clearTimeout(timer)
      _deviceReady = true
      resolve()
    }

    document.addEventListener('deviceready', onReady, { once: true } as any)

    let checks = 0
    const maxChecks = Math.floor(timeout / 300)
    const poll = setInterval(() => {
      checks++
      if (w.cordova && typeof w.cordova.exec === 'function') {
        console.warn('[CordovaFS] 轮询检测到 cordova.exec 可用, 提前 resolve')
        clearInterval(poll)
        clearTimeout(timer)
        _deviceReady = true
        resolve()
        return
      }
      if (checks > maxChecks) {
        clearInterval(poll)
      }
    }, 300)
  })

  return _deviceReadyPromise
}

/** 平台检测: 是否有 SakuraMCCore 插件 */
export function hasSakuraCore(): boolean {
  try {
    const w = window as any
    return !!(w.cordova?.plugins?.SakuraMCCore)
  } catch {
    return false
  }
}

/** @deprecated 请使用 waitForReady() */
export const waitForDeviceReady = waitForReady

/** 调用 SakuraMCCore 插件方法 */
async function coreExec<T>(action: string, args: any[] = []): Promise<T> {
  await waitForReady()
  return new Promise((resolve, reject) => {
    const w = window as any
    // 优先使用已注册的 JS 模块 (plugin.xml <js-module>)
    const plugin = w.cordova?.plugins?.SakuraMCCore
    if (plugin && typeof (plugin as any)[action] === 'function') {
      ;(plugin as any)[action](...args, resolve, reject)
      return
    }
    // 回退: 直接通过 cordova.exec 调用 (config.xml <feature> 注册即可)
    const exec = w.cordova?.exec
    if (exec) {
      exec(resolve, reject, 'SakuraMCCore', action, args)
      return
    }
    reject(new Error('SakuraMCCore 插件不可用 (无 JS 模块且 cordova.exec 不存在)'))
  })
}

/** 调用通用 cordova.exec */
async function rawExec<T>(service: string, action: string, args: any[] = []): Promise<T> {
  await waitForReady()
  return new Promise((resolve, reject) => {
    const w = window as any
    const exec = w.cordova?.exec
    if (!exec) {
      reject(new Error('cordova.exec 不可用'))
      return
    }
    exec(resolve, reject, service, action, args)
  })
}

// ============ 文件操作 ============

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

/**
 * 确保目录存在, 不存在则递归创建
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!isCordova()) {
    return
  }
  try {
    await coreExec<number>('mkdir', [dirPath])
  } catch (e: any) {
    // 目录已存在的情况视为成功
    if (e && String(e).includes('exist')) return
    // 某些情况下 mkdir 返回失败但目录实际存在
    const info = await getFileInfo(dirPath).catch(() => null)
    if (info?.exists && info.isDirectory) return
    throw new Error(`创建目录失败 ${dirPath}: ${e?.message || e}`)
  }
}

/**
 * 获取文件/目录信息
 */
export async function getFileInfo(path: string): Promise<FileInfo> {
  if (!isCordova()) {
    return { exists: false, isDirectory: false, isFile: false, name: '', path, size: 0, lastModified: 0, canRead: false, canWrite: false }
  }
  const info = await coreExec<any>('getFileInfo', [path])
  return {
    exists: !!info.exists,
    isDirectory: !!info.isDirectory,
    isFile: !!info.isFile,
    name: info.name || '',
    path: info.path || path,
    size: info.size || 0,
    lastModified: info.lastModified || 0,
    canRead: !!info.canRead,
    canWrite: !!info.canWrite
  }
}

/**
 * 判断文件/目录是否存在
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await getFileInfo(path)
    return info.exists
  } catch {
    return false
  }
}

/**
 * 写入文本文件
 * 由于 SakuraMCCore 插件没有 writeFile, 使用 cordova-plugin-file
 */
export async function writeTextFile(filePath: string, content: string): Promise<void> {
  if (!isCordova()) {
    return
  }
  // 用 cordova-plugin-file API
  const w = window as any
  const resolveLocalFileSystemURL = w.resolveLocalFileSystemURL || w.requestFileSystem
  if (!w.resolveLocalFileSystemURL) {
    // 没有 cordova-plugin-file, 退化为写入 Application 沙箱 (不推荐)
    try {
      localStorage.setItem('file_' + filePath, content)
    } catch {}
    return
  }

  return new Promise((resolve, reject) => {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    const name = filePath.substring(filePath.lastIndexOf('/') + 1)

    w.resolveLocalFileSystemURL(dir, (dirEntry: any) => {
      dirEntry.getFile(name, { create: true, exclusive: false }, (fileEntry: any) => {
        fileEntry.createWriter((writer: any) => {
          writer.onwriteend = () => resolve()
          writer.onerror = (e: any) => reject(new Error('写入失败: ' + e?.target?.error?.message || e))
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
          writer.write(blob)
        }, (e: any) => reject(new Error('createWriter 失败: ' + e?.message || e)))
      }, (e: any) => reject(new Error('getFile 失败: ' + e?.message || e)))
    }, (e: any) => reject(new Error('resolveLocalFileSystemURL 失败 (目录:' + dir + '): ' + (e?.message || e))))
  })
}

/**
 * 写入二进制文件 (ArrayBuffer / Blob)
 */
export async function writeBinaryFile(filePath: string, data: ArrayBuffer | Blob): Promise<void> {
  if (!isCordova()) {
    return
  }
  const w = window as any
  if (!w.resolveLocalFileSystemURL) {
    return
  }

  return new Promise((resolve, reject) => {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    const name = filePath.substring(filePath.lastIndexOf('/') + 1)

    w.resolveLocalFileSystemURL(dir, (dirEntry: any) => {
      dirEntry.getFile(name, { create: true, exclusive: false }, (fileEntry: any) => {
        fileEntry.createWriter((writer: any) => {
          writer.onwriteend = () => resolve()
          writer.onerror = (e: any) => reject(new Error('写入失败: ' + (e?.target?.error?.message || e)))
          const blob = data instanceof Blob ? data : new Blob([data])
          writer.write(blob)
        }, (e: any) => reject(new Error('createWriter 失败: ' + (e?.message || e))))
      }, (e: any) => reject(new Error('getFile 失败: ' + (e?.message || e))))
    }, (e: any) => reject(new Error('resolveLocalFileSystemURL 失败 (目录:' + dir + '): ' + (e?.message || e))))
  })
}

/**
 * 读取文本文件
 */
export async function readTextFile(filePath: string): Promise<string> {
  if (!isCordova()) {
    return ''
  }
  const w = window as any
  if (!w.resolveLocalFileSystemURL) {
    return ''
  }

  return new Promise((resolve, reject) => {
    w.resolveLocalFileSystemURL(filePath, (fileEntry: any) => {
      fileEntry.file((file: any) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('读取失败'))
        reader.readAsText(file, 'UTF-8')
      }, (e: any) => reject(new Error('file() 失败: ' + (e?.message || e))))
    }, (e: any) => reject(new Error('resolveLocalFileSystemURL 失败: ' + (e?.message || e))))
  })
}

/**
 * 读取二进制文件 (ArrayBuffer)
 */
export async function readBinaryFile(filePath: string): Promise<ArrayBuffer> {
  if (!isCordova()) {
    return new ArrayBuffer(0)
  }
  const w = window as any
  if (!w.resolveLocalFileSystemURL) {
    return new ArrayBuffer(0)
  }

  return new Promise((resolve, reject) => {
    w.resolveLocalFileSystemURL(filePath, (fileEntry: any) => {
      fileEntry.file((file: any) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => reject(new Error('读取失败'))
        reader.readAsArrayBuffer(file)
      }, (e: any) => reject(new Error('file() 失败: ' + (e?.message || e))))
    }, (e: any) => reject(new Error('resolveLocalFileSystemURL 失败: ' + (e?.message || e))))
  })
}

/**
 * 列出目录内容
 */
export async function listDirectory(dirPath: string): Promise<Array<{
  name: string
  path: string
  isDir: boolean
  size: number
  lastModified: number
}>> {
  if (!isCordova()) {
    return []
  }
  const w = window as any
  if (!w.resolveLocalFileSystemURL) {
    return []
  }

  return new Promise((resolve, reject) => {
    w.resolveLocalFileSystemURL(dirPath, (dirEntry: any) => {
      const reader = dirEntry.createReader()
      reader.readEntries((entries: any[]) => {
        const tasks: Promise<any>[] = entries
          .filter((e: any) => e.name !== '.' && e.name !== '..')
          .map((entry: any) => {
            return new Promise((res) => {
              entry.getMetadata(
                (meta: any) => {
                  res({
                    name: entry.name,
                    path: entry.fullPath.startsWith('file://') ? entry.fullPath : (dirPath + '/' + entry.name),
                    isDir: entry.isDirectory,
                    size: meta.size || 0,
                    lastModified: meta.modificationTime?.getTime() || 0
                  })
                },
                () => {
                  res({
                    name: entry.name,
                    path: entry.fullPath.startsWith('file://') ? entry.fullPath : (dirPath + '/' + entry.name),
                    isDir: entry.isDirectory,
                    size: 0,
                    lastModified: 0
                  })
                }
              )
            })
          })
        Promise.all(tasks).then(results => {
          results.sort((a: any, b: any) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          resolve(results)
        })
      }, (e: any) => reject(new Error('读取目录失败: ' + (e?.message || e))))
    }, (e: any) => reject(new Error('resolveLocalFileSystemURL 失败: ' + (e?.message || e))))
  })
}

/**
 * 删除文件或目录
 * 优先使用 SakuraMCCore 插件 (有 rename 但没有 delete), 退化为 cordova-plugin-file
 */
export async function deletePath(path: string, recursive = true): Promise<void> {
  if (!isCordova()) {
    return
  }
  const w = window as any
  if (!w.resolveLocalFileSystemURL) {
    return
  }

  return new Promise((resolve, reject) => {
    w.resolveLocalFileSystemURL(path, (entry: any) => {
      if (entry.isDirectory) {
        if (recursive) {
          entry.removeRecursively(() => resolve(), (e: any) => reject(new Error('删除目录失败: ' + (e?.message || e))))
        } else {
          entry.remove(() => resolve(), (e: any) => reject(new Error('删除目录失败: ' + (e?.message || e))))
        }
      } else {
        entry.remove(() => resolve(), (e: any) => reject(new Error('删除文件失败: ' + (e?.message || e))))
      }
    }, () => {
      // 路径不存在视为成功
      resolve()
    })
  })
}

/**
 * 重命名/移动文件
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  if (!isCordova()) {
    return
  }
  try {
    await coreExec<number>('rename', [oldPath, newPath])
  } catch (e: any) {
    throw new Error(`重命名失败: ${e?.message || e}`)
  }
}

/**
 * 解压 zip 文件
 */
export async function unzipFile(zipPath: string, destDir: string): Promise<{ success: boolean; fileCount: number; destDir: string }> {
  if (!isCordova()) {
    return { success: false, fileCount: 0, destDir }
  }
  return coreExec<any>('unzip', [zipPath, destDir])
}

/**
 * 列出 zip 文件内容
 */
export async function listZip(zipPath: string): Promise<Array<{ name: string; size: number; isDirectory: boolean }>> {
  if (!isCordova()) {
    return []
  }
  return coreExec<any[]>('listZip', [zipPath])
}

/**
 * 计算文件 SHA1
 */
export async function sha1File(filePath: string): Promise<string> {
  if (!isCordova()) {
    return ''
  }
  return coreExec<string>('sha1File', [filePath])
}

/**
 * 分享文件
 */
export async function shareFile(filePath: string, title: string = '分享'): Promise<void> {
  if (!isCordova()) {
    return
  }
  await coreExec<number>('shareFile', [filePath, title])
}

/**
 * 获取图片 Base64
 */
export async function getImageBase64(filePath: string, maxWidth = 0, maxHeight = 0): Promise<{ base64: string; width: number; height: number }> {
  if (!isCordova()) {
    return { base64: '', width: 0, height: 0 }
  }
  return coreExec<any>('getImageBase64', [filePath, maxWidth, maxHeight])
}

// ============ 下载 ============

/**
 * 下载远程文件到本地路径
 * 使用 cordova-plugin-file-transfer (如果可用), 否则用 XHR + writeBinaryFile
 */
export async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  if (!isCordova()) {
    throw new Error('H5 网页版无法下载游戏文件到本地, 请安装 Android APK 后重试')
  }

  await waitForReady()

  const w = window as any
  const FileTransfer = w.FileTransfer
  if (FileTransfer) {
    return new Promise((resolve, reject) => {
      const ft = new FileTransfer()
      if (onProgress) {
        ft.onprogress = (e: any) => {
          if (e.lengthComputable) {
            onProgress(e.loaded, e.total)
          }
        }
      }
      ft.download(
        encodeURI(url),
        destPath.startsWith('file://') ? destPath : 'file://' + destPath,
        (entry: any) => resolve(),
        (err: any) => reject(new Error('下载失败: ' + (err?.body || err?.exception || err?.source || url))),
        true // trustAllHosts
      )
    })
  }

  // 退化方案: XHR 下载 + writeBinaryFile
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`下载失败 (HTTP ${res.status}): ${url}`)
  }
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body?.getReader()
  if (!reader) {
    const blob = await res.blob()
    await writeBinaryFile(destPath, blob)
    return
  }

  const chunks: Uint8Array[] = []
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.length
      if (onProgress) onProgress(loaded, total)
    }
  }

  const ab = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    ab.set(chunk, offset)
    offset += chunk.length
  }
  await writeBinaryFile(destPath, ab.buffer)
}

// ============ 目录路径工具 ============

let _appFilesDir: string | null = null
let _appExternalFilesDir: string | null = null

/**
 * 获取应用私有文件目录 (内部存储, 不需要权限)
 * 对应 Android Context.getFilesDir()
 */
export async function getAppFilesDir(): Promise<string> {
  if (_appFilesDir) return _appFilesDir
  if (!isCordova()) {
    _appFilesDir = '/data/data/com.sakuramc.launcher/files'
    return _appFilesDir
  }
  try {
    const dir = await coreExec<string>('getAppFilesDir', [])
    if (dir) {
      _appFilesDir = dir
      return dir
    }
  } catch {
    // 插件不支持此方法, 走默认值
  }
  _appFilesDir = '/data/data/com.sakuramc.launcher/files'
  return _appFilesDir
}

/**
 * 获取应用外部私有目录 (外部存储, 不需要权限)
 * 对应 Android Context.getExternalFilesDir(null)
 * 路径类似: /storage/emulated/0/Android/data/com.sakuramc.launcher/files
 * 
 * 推荐游戏文件放这里, 高版本 Android 访问不会被卡
 */
export async function getAppExternalFilesDir(): Promise<string> {
  if (_appExternalFilesDir) return _appExternalFilesDir
  if (!isCordova()) {
    _appExternalFilesDir = '/storage/emulated/0/Android/data/com.sakuramc.launcher/files'
    return _appExternalFilesDir
  }
  try {
    const dir = await coreExec<string>('getAppExternalFilesDir', [])
    if (dir) {
      _appExternalFilesDir = dir
      return dir
    }
  } catch {
    // 插件不支持此方法, 走默认值
  }
  _appExternalFilesDir = '/storage/emulated/0/Android/data/com.sakuramc.launcher/files'
  return _appExternalFilesDir
}

/**
 * 获取外部存储根目录
 * 优先从 SakuraMCCore 获取, 否则使用默认值
 * 
 * 注意: 高版本 Android (10+) 访问此目录需要 MANAGE_EXTERNAL_STORAGE 权限
 * 推荐优先使用 getAppExternalFilesDir()
 */
export function getExternalStorageDir(): string {
  return '/storage/emulated/0'
}

/**
 * 打开外部文件管理器
 */
export async function openExternalFileManager(path?: string): Promise<boolean> {
  if (!isCordova() || !hasSakuraCore()) {
    return false
  }
  try {
    await coreExec<number>('openExternalFileManager', [path || ''])
    return true
  } catch {
    return false
  }
}

// ============ 兼容旧 API 的别名 ============
// 为了减少对现有代码的改动, 提供与 setup.ts 中一致的函数名

export const deleteFile = deletePath
