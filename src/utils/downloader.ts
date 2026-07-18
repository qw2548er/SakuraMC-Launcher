/**
 * 通用下载工具 (uni.downloadFile 实现,跨平台兼容)
 */
import { formatSpeed } from './format'

export interface DownloadOptions {
  url: string
  savePath?: string
  onProgress?: (downloaded: number, total: number, speed: number) => void
  onSuccess?: (path: string) => void
  onError?: (err: Error) => void
  headers?: Record<string, string>
  timeout?: number
}

/**
 * 跨平台文件下载
 * - APP-PLUS (Android/iOS): 使用原生下载,不受 CORS 限制
 * - H5: 使用 uni.downloadFile (内部 XHR),若遇 CORS 则降级为浏览器直接打开
 * - Electron: 使用 uni.downloadFile
 */
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

  // fallback
  return h5Download(opts)
}

/**
 * APP-PLUS 下载 (Android/iOS 原生)
 */
function appDownload(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let lastTime = Date.now()
    let lastLoaded = 0

    const task = uni.downloadFile({
      url: opts.url,
      timeout: opts.timeout || 600000,
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const filePath = res.tempFilePath || res.filePath
          if (filePath) {
            opts.onSuccess?.(filePath)
            resolve(filePath)
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
        const msg = err?.errMsg || err?.message || '下载失败'
        const e = new Error(msg)
        opts.onError?.(e)
        reject(e)
      }
    })

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

/**
 * H5 下载 (浏览器环境)
 * 优先使用 uni.downloadFile,失败后降级为直接打开链接
 */
function h5Download(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let lastTime = Date.now()
    let lastLoaded = 0
    let settled = false

    const task = uni.downloadFile({
      url: opts.url,
      timeout: opts.timeout || 600000,
      success: (res: any) => {
        if (settled) return
        settled = true
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const filePath = res.tempFilePath || ''
          opts.onSuccess?.(filePath)
          resolve(filePath)
        } else {
          // CORS 或其他错误,降级为直接打开
          fallbackOpenUrl(opts.url, resolve, reject, opts)
        }
      },
      fail: (err: any) => {
        if (settled) return
        settled = true
        // uni.downloadFile 失败,可能是 CORS,降级为直接打开链接
        fallbackOpenUrl(opts.url, resolve, reject, opts)
      }
    })

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

/**
 * H5 降级方案: 直接在新窗口打开下载链接
 * 浏览器会自动处理下载,不受 CORS 限制
 */
function fallbackOpenUrl(
  url: string,
  resolve: (v: string) => void,
  reject: (e: Error) => void,
  opts: DownloadOptions
) {
  try {
    // 方式1: 创建隐藏的 a 标签触发下载
    const a = document.createElement('a')
    a.href = url
    a.download = opts.savePath || url.split('/').pop() || 'download'
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // 无法获取实际路径,但视为成功
    opts.onSuccess?.(opts.savePath || url.split('/').pop() || 'download')
    resolve(opts.savePath || url.split('/').pop() || 'download')
  } catch (e: any) {
    // 方式2: window.open
    try {
      window.open(url, '_blank')
      opts.onSuccess?.('')
      resolve('')
    } catch (e2: any) {
      const err = new Error('下载失败: ' + (e2.message || '无法打开下载链接'))
      opts.onError?.(err)
      reject(err)
    }
  }
}

/**
 * Electron 下载 (桌面端)
 */
function electronDownload(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let lastTime = Date.now()
    let lastLoaded = 0

    const task = uni.downloadFile({
      url: opts.url,
      timeout: opts.timeout || 600000,
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const filePath = res.tempFilePath || ''
          opts.onSuccess?.(filePath)
          resolve(filePath)
        } else {
          const err = new Error(`下载失败: HTTP ${res.statusCode}`)
          opts.onError?.(err)
          reject(err)
        }
      },
      fail: (err: any) => {
        const msg = err?.errMsg || err?.message || '下载失败'
        const e = new Error(msg)
        opts.onError?.(e)
        reject(e)
      }
    })

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

function extractFilename(url: string): string {
  try {
    return new URL(url, location.href).pathname.split('/').pop() || 'download'
  } catch {
    return 'download'
  }
}

/** 批量并发下载 */
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
