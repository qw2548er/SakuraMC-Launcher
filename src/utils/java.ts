/**
 * Java 运行时检测与下载
 */

export interface JvmInfo {
  version: number  // e.g. 8, 11, 17, 21
  vendor: 'adoptium' | 'azul' | 'oracle' | 'microsoft' | 'bellsoft'
  path: string
  bit: 32 | 64
}

/**
 * 根据 Minecraft 版本推荐 Java 版本
 * MC 版本格式为 "1.X.Y",需要用 X (minor) 来判断而非 major (1)
 * - MC 1.21+ 需要 Java 21
 * - MC 1.17-1.20.4 需要 Java 17
 * - MC 1.16 及更早需要 Java 8
 */
export function recommendJavaVersion(mcVersion: string): number {
  const v = parseVersion(mcVersion)
  // MC 版本格式为 "1.X.Y",major 永远是 1,需用 minor 判断
  const major = v.major === 1 ? v.minor : v.major
  if (major >= 21) return 21
  if (major >= 17) return 17
  return 8
}

function parseVersion(s: string): { major: number; minor: number; patch: number } {
  const parts = s.split('.').map(p => parseInt(p, 10) || 0)
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 }
}

/**
 * 获取 Adoptium Temurin JRE 下载链接
 * 使用 Adoptium API 动态获取最新版本
 */
export async function getAdoptiumDownloadUrl(version: number, platform: 'windows' | 'linux' | 'macos' = 'linux', arch: 'amd64' | 'arm64' = 'arm64'): Promise<string> {
  // Adoptium API: https://api.adoptium.net/v3/assets/latest/{feature_version}/hotspot
  const osMap: Record<string, string> = {
    windows: 'windows',
    linux: 'linux',
    macos: 'mac'
  }
  const archMap: Record<string, string> = {
    amd64: 'x64',
    arm64: 'aarch64'
  }
  try {
    const res: any = await uni.request({
      url: `https://api.adoptium.net/v3/assets/latest/${version}/hotspot?architecture=${archMap[arch]}&image_type=jre&os=${osMap[platform]}`
    })
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data[0].binary.package.link
    }
  } catch (e) {
    console.warn('[Java] 获取 Adoptium 下载链接失败:', e)
  }
  // Fallback: 返回 Adoptium 官网下载页
  return `https://adoptium.net/temurin/releases/?version=${version}&os=${osMap[platform]}&arch=${archMap[arch]}&package=jre`
}

/**
 * 获取 Azul Zulu JRE 下载链接
 */
export async function getAzulDownloadUrl(version: number, platform: 'windows' | 'linux' | 'macos' = 'linux', arch: 'amd64' | 'arm64' = 'arm64'): Promise<string> {
  const osMap: Record<string, string> = {
    windows: 'windows',
    linux: 'linux',
    macos: 'macos'
  }
  const archMap: Record<string, string> = {
    amd64: 'x86_64',
    arm64: 'aarch64'
  }
  try {
    const res: any = await uni.request({
      url: `https://api.azul.com/metadata/v1/zulu/packages/?java_version=${version}&os=${osMap[platform]}&arch=${archMap[arch]}&java_package_type=jre&latest=true&release_status=ga&cert_level=tck&page_size=1`
    })
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data[0].download_url
    }
  } catch (e) {
    console.warn('[Java] 获取 Azul 下载链接失败:', e)
  }
  return `https://www.azul.com/downloads/?version=java-${version}-lts&os=${osMap[platform]}&architecture=${archMap[arch]}&package=jre`
}

/**
 * 检测系统已安装的 Java (APP-PLUS 端扫描常见路径)
 */
export async function detectSystemJava(): Promise<JvmInfo[]> {
  const list: JvmInfo[] = []
  // #ifdef APP-PLUS
  try {
    const fs = plus.io.getFileSystemManager()
    const commonPaths = [
      '/storage/emulated/0/SakuraMC/java',
      '/data/data/com.sakura.mc/files/java'
    ]
    for (const basePath of commonPaths) {
      try {
        const entries = fs.readdirSync({ dirPath: basePath })
        for (const entry of entries) {
          const name = entry.name || entry
          const javaPath = `${basePath}/${name}/bin/java`
          try {
            fs.accessSync(javaPath)
            const versionMatch = name.match(/jre(\d+)/i) || name.match(/java(\d+)/i)
            const version = versionMatch ? parseInt(versionMatch[1], 10) : 8
            list.push({
              version,
              vendor: 'adoptium',
              path: javaPath,
              bit: 64
            })
          } catch { /* 文件不存在,跳过 */ }
        }
      } catch { /* 目录不存在,跳过 */ }
    }
  } catch (e) {
    console.warn('[Java] 检测系统 Java 失败:', e)
  }
  // #endif
  return list
}

export function buildJvmMemoryConfig(min: number, max: number) {
  return {
    min: Math.max(512, Math.min(min, max - 512)),
    max: Math.max(1024, max),
    recommended: { min: 1024, max: 2048 }
  }
}
