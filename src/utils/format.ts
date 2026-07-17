/**
 * 通用工具
 */

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec) + '/s'
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return `${m}分${rs}秒`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}时${rm}分`
}

export function formatTime(ts: number | string | Date): string {
  const d = new Date(ts)
  const pad = (n: number) => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function relativeTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}天前`
  return formatTime(ts)
}

export function copyText(text: string): Promise<boolean> {
  return new Promise(resolve => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => resolve(true)).catch(() => {
        fallbackCopy(text)
        resolve(true)
      })
    } else {
      fallbackCopy(text)
      resolve(true)
    }
  })
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } catch {}
  document.body.removeChild(ta)
}

export function downloadFile(filename: string, content: string | Blob) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export function isValidMCUsername(name: string): boolean {
  if (!name || name.length < 3 || name.length > 16) return false
  return /^[A-Za-z0-9_]+$/.test(name)
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay = 300): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

export function throttle<T extends (...args: any[]) => any>(fn: T, delay = 300): T {
  let last = 0
  return ((...args: any[]) => {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn(...args)
    }
  }) as T
}

export function detectPlatform(): 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'web' {
  if (typeof navigator === 'undefined') return 'web'
  const ua = navigator.userAgent.toLowerCase()
  if (/android/.test(ua)) return 'android'
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/windows/.test(ua)) return 'windows'
  if (/mac os/.test(ua)) return 'macos'
  if (/linux/.test(ua)) return 'linux'
  return 'web'
}

export function offlineUUID(username: string): string {
  // 基于用户名生成稳定的离线 UUID (类似 Mojang 离线模式算法)
  const str = 'OfflinePlayer:' + username
  let h1 = 0xdeadbeef ^ 0
  let h2 = 0x41c64e6d ^ 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const high = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
  const low = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
  const full = high + low
  return full.slice(0, 8) + '-' + full.slice(8, 12) + '-' + full.slice(12, 16) + '-' + full.slice(16, 20) + '-' + full.slice(20, 32)
}

export function getSkinFaceUrl(uuid: string): string {
  const cleanUuid = uuid.replace(/-/g, '')
  return `https://crafatar.com/avatars/${cleanUuid}?size=64&default=MHF_Steve`
}

export function getSkinBodyUrl(uuid: string): string {
  const cleanUuid = uuid.replace(/-/g, '')
  return `https://crafatar.com/renders/body/${cleanUuid}?scale=2&default=MHF_Steve`
}

export function detectArch(): 'amd64' | 'arm64' | '386' | 'arm' {
  if (typeof navigator === 'undefined') return 'amd64'
  // @ts-ignore
  const ua = navigator.userAgentData?.platform || navigator.platform || ''
  if (/arm64|aarch64/.test(ua)) return 'arm64'
  if (/arm/.test(ua)) return 'arm'
  return 'amd64'
}
