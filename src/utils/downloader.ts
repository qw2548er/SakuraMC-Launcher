import { formatSpeed } from './format'
import { isCordova, waitForReady } from './cordova-fs'

export interface DownloadOptions {
  url: string
  savePath?: string
  onProgress?: (downloaded: number, total: number, speed: number) => void
  onSuccess?: (path: string) => void | Promise<void>
  onError?: (err: Error) => void
  headers?: Record<string, string>
  timeout?: number
  _taskHandle?: { abort: () => void }
}

export interface PlatformDownloadOptions extends DownloadOptions {
  platformType?: 'forge' | 'fabric' | 'quilt' | 'neoforge' | 'optifine' | 'iris'
  mcVersion?: string
  platformVersion?: string
}

export async function downloadFile(opts: DownloadOptions): Promise<string> {
  if (!opts.url) {
    throw new Error('下载地址为空')
  }

  if (isCordova()) {
    return cordovaDownload(opts)
  }

  // #ifdef APP-PLUS
  return appDownload(opts)
  // #endif

  // #ifdef ELECTRON
  return electronDownload(opts)
  // #endif

  throw new Error('当前环境不支持下载, 请安装 Android APK 后重试')
}

async function callOnSuccess(opts: DownloadOptions, filePath: string): Promise<void> {
  if (opts.onSuccess) {
    try {
      await opts.onSuccess(filePath)
    } catch (e) {
      console.warn('[downloader] onSuccess 回调执行出错:', e)
    }
  }
}

async function cordovaDownload(opts: DownloadOptions): Promise<string> {
  const { downloadFile: cordovaFsDownload } = await import('./cordova-fs')

  return new Promise((resolve, reject) => {
    let lastTime = Date.now()
    let lastLoaded = 0

    const onProgress = (loaded: number, total: number) => {
      const now = Date.now()
      const dt = (now - lastTime) / 1000
      const dl = loaded - lastLoaded
      const speed = dt > 0 ? dl / dt : 0
      lastTime = now
      lastLoaded = loaded
      opts.onProgress?.(loaded, total, speed)
    }

    const savePath = opts.savePath
    if (!savePath) {
      reject(new Error('Cordova 环境需要指定 savePath'))
      return
    }

    cordovaFsDownload(opts.url, savePath, onProgress)
      .then(async () => {
        await callOnSuccess(opts, savePath)
        resolve(savePath)
      })
      .catch((e: any) => {
        const msg = e?.message || e?.toString() || '下载失败'
        const err = new Error(msg)
        opts.onError?.(err)
        reject(err)
      })
  })
}

function appDownload(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let lastTime = Date.now()
    let lastLoaded = 0
    let settled = false

    const task = uni.downloadFile({
      url: opts.url,
      timeout: opts.timeout || 600000,
      filePath: opts.savePath,
      success: async (res: any) => {
        if (settled) return
        settled = true
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const filePath = res.filePath || res.tempFilePath
          if (filePath) {
            try {
              if (opts.savePath && filePath !== opts.savePath) {
                await copyFileToExternalStorage(filePath, opts.savePath)
                await callOnSuccess(opts, opts.savePath!)
                resolve(opts.savePath!)
              } else {
                await callOnSuccess(opts, filePath)
                resolve(filePath)
              }
            } catch (e: any) {
              opts.onError?.(e)
              reject(e)
            }
          } else {
            const err = new Error('下载完成但未获取到文件路径')
            opts.onError?.(err)
            reject(err)
          }
        } else {
          const err = new Error(`服务器返回错误: HTTP ${res.statusCode}`)
          opts.onError?.(err)
          reject(err)
        }
      },
      fail: (err: any) => {
        if (settled) return
        settled = true
        const msg = err?.errMsg || err?.message || '下载失败'
        const e = new Error(msg)
        opts.onError?.(e)
        reject(e)
      }
    })

    if (task && typeof task.abort === 'function') {
      opts._taskHandle = { abort: () => task.abort() }
    }

    if (task && task.onProgressUpdate && opts.onProgress) {
      task.onProgressUpdate((res: any) => {
        const now = Date.now()
        const dt = (now - lastTime) / 1000
        const dl = res.totalBytesWritten - lastLoaded
        const speed = dt > 0 ? dl / dt : 0
        lastTime = now
        lastLoaded = res.totalBytesWritten
        opts.onProgress?.(
          res.totalBytesWritten,
          res.totalBytesExpectedToWrite || 0,
          speed
        )
      })
    }
  })
}

async function copyFileToExternalStorage(srcPath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fileSystem = plus.io.getFileSystemManager()
    const destDir = destPath.substring(0, destPath.lastIndexOf('/'))

    fileSystem.access({
      path: destDir,
      success: () => {
        fileSystem.copyFile({
          srcPath,
          destPath,
          success: () => resolve(),
          fail: (e: any) => reject(new Error(`复制文件失败: ${e.message}`))
        })
      },
      fail: () => {
        fileSystem.mkdir({
          dirPath: destDir,
          recursive: true,
          success: () => {
            fileSystem.copyFile({
              srcPath,
              destPath,
              success: () => resolve(),
              fail: (e: any) => reject(new Error(`复制文件失败: ${e.message}`))
            })
          },
          fail: (e: any) => reject(new Error(`创建目录失败: ${e.message}`))
        })
      }
    })
  })
}

function electronDownload(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let lastTime = Date.now()
    let lastLoaded = 0
    let settled = false

    const task = uni.downloadFile({
      url: opts.url,
      timeout: opts.timeout || 600000,
      filePath: opts.savePath,
      success: async (res: any) => {
        if (settled) return
        settled = true
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const filePath = res.filePath || ''
          try {
            await callOnSuccess(opts, filePath)
            resolve(filePath)
          } catch (e: any) {
            opts.onError?.(e)
            reject(e)
          }
        } else {
          const err = new Error(`下载失败: HTTP ${res.statusCode}`)
          opts.onError?.(err)
          reject(err)
        }
      },
      fail: (err: any) => {
        if (settled) return
        settled = true
        const msg = err?.errMsg || err?.message || '下载失败'
        const e = new Error(msg)
        opts.onError?.(e)
        reject(e)
      }
    })

    if (task && typeof task.abort === 'function') {
      opts._taskHandle = { abort: () => task.abort() }
    }

    if (task && task.onProgressUpdate && opts.onProgress) {
      task.onProgressUpdate((res: any) => {
        const now = Date.now()
        const dt = (now - lastTime) / 1000
        const dl = res.totalBytesWritten - lastLoaded
        const speed = dt > 0 ? dl / dt : 0
        lastTime = now
        lastLoaded = res.totalBytesWritten
        opts.onProgress?.(
          res.totalBytesWritten,
          res.totalBytesExpectedToWrite || 0,
          speed
        )
      })
    }
  })
}

export async function batchDownload(
  tasks: DownloadOptions[],
  concurrency = 3,
  onTaskProgress?: (i: number, downloaded: number, total: number) => void
) {
  const results: Promise<string>[] = []
  const queue = tasks.map((t, i) => ({ t, i }))
  const running: Promise<any>[] = []
  while (queue.length || running.length) {
    while (running.length < concurrency && queue.length) {
      const { t, i } = queue.shift()!
      const p = downloadFile(t).then(p => {
        running.splice(running.indexOf(p), 1)
        return p
      }).catch(err => {
        running.splice(running.indexOf(p), 1)
        throw err
      })
      running.push(p)
      results[i] = p
    }
    if (running.length) await Promise.race(running)
  }
  return Promise.all(results)
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  if (isCordova()) {
    const { ensureDir } = await import('./cordova-fs')
    await ensureDir(dirPath)
    return
  }
  // #ifdef APP-PLUS
  return new Promise((resolve, reject) => {
    const fileSystem = plus.io.getFileSystemManager()
    fileSystem.access({
      path: dirPath,
      success: () => resolve(),
      fail: () => {
        fileSystem.mkdir({
          dirPath,
          recursive: true,
          success: () => resolve(),
          fail: (e: any) => reject(new Error(`创建目录失败: ${e.message}`))
        })
      }
    })
  })
  // #endif
  // #ifndef APP-PLUS
  resolve()
  // #endif
}

export async function downloadPlatformInstaller(opts: PlatformDownloadOptions): Promise<string> {
  await waitForReady()
  
  const { savePath, url, mcVersion, platformType, platformVersion, ...rest } = opts
  const finalOpts: DownloadOptions = {
    url: url!,
    savePath: savePath!,
    ...rest
  }
  
  console.log(`[PlatformDownload] 开始下载 ${platformType} ${platformVersion} for MC ${mcVersion}`)
  
  try {
    const result = await downloadFile(finalOpts)
    console.log(`[PlatformDownload] 下载完成: ${result}`)
    return result
  } catch (e: any) {
    console.error(`[PlatformDownload] 下载失败: ${e.message}`)
    throw new Error(`下载 ${platformType} 失败: ${e.message}`)
  }
}