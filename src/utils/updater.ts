import type { IAppUpdate } from '@/types'

const GITHUB_API = 'https://api.github.com/repos/qw2548er/SakuraMC-Launcher/releases/latest'
const GITHUB_RELEASE = 'https://github.com/qw2548er/SakuraMC-Launcher/releases/latest'

export const APP_VERSION = '0.1.5'

function compareVersion(v1: string, v2: string): number {
  const a = v1.replace(/^v/, '').split('.').map(n => parseInt(n, 10))
  const b = v2.replace(/^v/, '').split('.').map(n => parseInt(n, 10))
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

export async function checkUpdate(): Promise<IAppUpdate | null> {
  try {
    const res: any = await uni.request({
      url: GITHUB_API,
      method: 'GET',
      timeout: 10000
    })
    const data = res.data
    if (!data || !data.tag_name) return null
    const latestVersion = data.tag_name.replace(/^v/, '')
    if (compareVersion(latestVersion, APP_VERSION) <= 0) {
      return null
    }
    return {
      version: latestVersion,
      name: data.name || `v${latestVersion}`,
      body: data.body || '',
      html_url: data.html_url || GITHUB_RELEASE,
      published_at: data.published_at || '',
      prerelease: data.prerelease || false,
      assets: (data.assets || []).map((a: any) => ({
        name: a.name,
        browser_download_url: a.browser_download_url,
        size: a.size
      }))
    }
  } catch (e) {
    console.warn('[Updater] 检查更新失败', e)
    return null
  }
}

export function openReleasePage() {
  const url = GITHUB_RELEASE
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(url, () => {
    uni.setClipboardData({ data: url })
    uni.showToast({ title: '链接已复制', icon: 'none' })
  })
  // #endif
}
