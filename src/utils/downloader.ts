/**
 * 通用下载工具 (uni.request 实现)
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

/** H5 端下载: 利用 a[download] 或保存到 IndexedDB */
export async function downloadFile(opts: DownloadOptions): Promise<string> {
  if (typeof window !== 'undefined' && 'XMLHttpRequest' in window) {
    return h5Download(opts)
  }
  // #ifdef APP-PLUS
  return appDownload(opts)
  // #endif
  throw new Error('当前平台不支持下载')
}

function h5Download(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', opts.url, true)
    xhr.responseType = 'blob'
    if (opts.headers) {
      Object.entries(opts.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    }
    let lastTime = Date.now()
    let lastLoaded = 0
    xhr.onprogress = (e) => {
      const now = Date.now()
      const total = e.lengthComputable ? e.total : opts.onProgress ? 0 : 0
      const dt = (now - lastTime) / 1000
      const dl = e.loaded - lastLoaded
      const speed = dt > 0 ? dl / dt : 0
      lastTime = now
      lastLoaded = e.loaded
      opts.onProgress?.(e.loaded, total, speed)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response
        const url = URL.createObjectURL(blob)
        const filename = opts.savePath || extractFilename(opts.url)
        // 触发浏览器下载
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        opts.onSuccess?.(filename)
        resolve(filename)
      } else {
        const err = new Error(`下载失败: HTTP ${xhr.status}`)
        opts.onError?.(err)
        reject(err)
      }
    }
    xhr.onerror = () => {
      const err = new Error('网络错误')
      opts.onError?.(err)
      reject(err)
    }
    if (opts.timeout) xhr.timeout = opts.timeout
    xhr.send()
  })
}

function appDownload(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const dtask = plus.downloader.createDownload(opts.url, {
      filename: opts.savePath
    }, (path, status) => {
      if (status === 200) {
        opts.onSuccess?.(path)
        resolve(path)
      } else {
        const err = new Error('下载失败')
        opts.onError?.(err)
        reject(err)
      }
    })
    dtask.addEventListener('statechanged', (task, status) => {
      if (status === 'progress') {
        opts.onProgress?.(task.downloadedSize, task.totalSize, 0)
      }
    })
    dtask.start()
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
