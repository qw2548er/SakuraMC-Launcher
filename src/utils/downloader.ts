/**
 * 通用下载工具 (uni.downloadFile 实现,跨平台兼容)
 */
import { formatSpeed } from './format'

export interface DownloadOptions {
  url: string
  savePath?: string
  onProgress?: (downloaded: number, total: number, speed: number) => void
  onSuccess?: (path: string) => void | Promise<void>
  onError?: (err: Error) => void
  headers?: Record<string, string>
  timeout?: number
  /** 返回的 task 句柄,可用于 abort() 取消下载 */
  _taskHandle?: { abort: () => void }
}

export async function downloadFile(opts: DownloadOptions): Promise<string> {
  if (!opts.url) {
    throw new Error('下载地址为空')
  }

  // #ifdef APP-PLUS
  return appDownload(opts)
  // #endif

  // #ifdef H5
  return h5Download(opts)
  // #endif

  // #ifdef ELECTRON
  return electronDownload(opts)
  // #endif

  return h5Download(opts)
}

/** 异步调用 onSuccess 回调,确保 Promise 被正确 await */
async function callOnSuccess(opts: DownloadOptions, filePath: string): Promise<void> {
  if (opts.onSuccess) {
    try {
      await opts.onSuccess(filePath)
    } catch (e) {
      // 回调内的错误不影响主流程,但需要报告
      console.warn('[downloader] onSuccess 回调执行出错:', e)
    }
  }
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

    // 暴露 abort 句柄供外部取消
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

function h5Download(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let lastTime = Date.now()
    let lastLoaded = 0
    let settled = false

    const task = uni.downloadFile({
      url: opts.url,
      timeout: opts.timeout || 600000,
      success: async (res: any) => {
        if (settled) return
        settled = true
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const filePath = res.tempFilePath || ''
          await callOnSuccess(opts, filePath)
          resolve(filePath)
        } else {
          fallbackOpenUrl(opts.url, resolve, reject, opts)
        }
      },
      fail: (err: any) => {
        if (settled) return
        settled = true
        fallbackOpenUrl(opts.url, resolve, reject, opts)
      }
    })

    // 暴露 abort 句柄供外部取消
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

async function fallbackOpenUrl(
  url: string,
  resolve: (v: string) => void,
  reject: (e: Error) => void,
  opts: DownloadOptions
) {
  const filename = opts.savePath || url.split('/').pop() || 'download'
  // #ifdef H5
  try {
    if (typeof document === 'undefined') throw new Error('no DOM')
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    await callOnSuccess(opts, filename)
    resolve(filename)
    return
  } catch (e: any) {
    try {
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank')
        await callOnSuccess(opts, '')
        resolve('')
        return
      }
    } catch { /* fall through to error */ }
    const err = new Error('下载失败: ' + (e?.message || '无法打开下载链接'))
    opts.onError?.(err)
    reject(err)
    return
  }
  // #endif
  // #ifndef H5
  // 非 H5 环境(小程序等)没有 DOM, 直接报错
  const err = new Error('下载失败: 当前环境不支持下载')
  opts.onError?.(err)
  reject(err)
  // #endif
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

    // 暴露 abort 句柄供外部取消
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
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
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
    // #endif
    // #ifndef APP-PLUS
    resolve()
    // #endif
  })
}