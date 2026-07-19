/**
 * BMCLAPI 镜像 (中国大陆友好)
 * https://bmclapi2.bangbang93.com
 */

const BMCL_BASE = 'https://bmclapi2.bangbang93.com'
const MOJANG_BASE = 'https://piston-meta.mojang.com'
const MCBBS_BASE = 'https://download.mcbbs.net'

export type DownloadSource = 'mojang' | 'bmcl' | 'mcbbs'

export function getApiBase(source: DownloadSource): string {
  switch (source) {
    case 'bmcl': return BMCL_BASE
    case 'mcbbs': return MCBBS_BASE
    default: return MOJANG_BASE
  }
}

export function getAssetBase(source: DownloadSource): string {
  switch (source) {
    case 'bmcl': return BMCL_BASE
    case 'mcbbs': return MCBBS_BASE
    default: return 'https://resources.download.minecraft.net'
  }
}

export function getLibraryBase(source: DownloadSource): string {
  switch (source) {
    case 'bmcl': return BMCL_BASE + '/libraries'
    case 'mcbbs': return MCBBS_BASE + '/libraries'
    default: return 'https://libraries.minecraft.net'
  }
}

/** 版本清单 */
export async function getVersionManifest(source: DownloadSource = 'bmcl') {
  const target = source === 'mojang'
    ? `${MOJANG_BASE}/mc/game/version_manifest_v2.json`
    : `${BMCL_BASE}/mc/game/version_manifest_v2.json`
  return uni.request({ url: target }).then((r: any) => r.data)
}

/** 版本清单 (v2) */
export async function getVersionManifestV2(source: DownloadSource = 'bmcl') {
  const target = source === 'mojang'
    ? `${MOJANG_BASE}/mc/game/version_manifest_v2.json`
    : `${BMCL_BASE}/mc/game/version_manifest_v2.json`
  return uni.request({ url: target }).then((r: any) => r.data)
}

/** 单个版本 manifest */
export async function getVersionJson(versionId: string, source: DownloadSource = 'bmcl'): Promise<any> {
  const manifest = await getVersionManifest(source)
  const v = manifest.versions.find((x: any) => x.id === versionId)
  if (!v) throw new Error(`版本不存在: ${versionId}`)
  let jsonUrl = v.url
  let result: any = null
  if (source === 'bmcl' && jsonUrl.includes('piston-meta.mojang.com')) {
    jsonUrl = jsonUrl.replace('https://piston-meta.mojang.com', BMCL_BASE + '/mc')
    try {
      const r = await uni.request({ url: jsonUrl })
      result = normalizeVersionJson(r.data)
      if (!result?.downloads?.client?.url || !result?.mainClass) {
        throw new Error('BMCL 镜像数据不完整 (缺 mainClass 或 client.url)')
      }
    } catch (e: any) {
      console.warn('[BMCL] 镜像获取失败,回退到 Mojang:', e?.message || e)
      jsonUrl = v.url
      result = null
    }
  } else if (source === 'mcbbs' && jsonUrl.includes('piston-meta.mojang.com')) {
    jsonUrl = jsonUrl.replace('https://piston-meta.mojang.com', MCBBS_BASE + '/mc')
    try {
      const r = await uni.request({ url: jsonUrl })
      result = normalizeVersionJson(r.data)
      if (!result?.downloads?.client?.url || !result?.mainClass) {
        throw new Error('MCBBS 镜像数据不完整 (缺 mainClass 或 client.url)')
      }
    } catch (e: any) {
      console.warn('[MCBBS] 镜像获取失败,回退到 Mojang:', e?.message || e)
      jsonUrl = v.url
      result = null
    }
  }
  if (!result) {
    const r = await uni.request({ url: jsonUrl })
    result = normalizeVersionJson(r.data)
  }
  if (!result || !result.mainClass || !result.downloads?.client?.url) {
    throw new Error(`版本 JSON 数据不完整: ${versionId} (mainClass=${result?.mainClass}, hasClientUrl=${!!result?.downloads?.client?.url})`)
  }
  return result
}

/**
 * 规范化 version JSON
 * uni.request 在某些情况下不会自动 parse JSON, 返回字符串
 * 这里统一处理: 字符串 → 对象, 并校验关键字段
 */
function normalizeVersionJson(raw: any): any {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw
}

/** Fabric Loader 元数据 */
export async function getFabricMeta(mcVersion: string) {
  return uni.request({
    url: `https://meta.fabricmc.net/v2/versions/yarn/${mcVersion}`
  }).then((r: any) => r.data)
}

export async function getFabricLoaders(mcVersion: string) {
  return uni.request({
    url: `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`
  }).then((r: any) => r.data)
}

/** Forge 镜像 (BMCL) */
export async function getForgeList(mcVersion: string) {
  return uni.request({
    url: `${BMCL_BASE}/mc/forge/minecraft/${mcVersion}`
  }).then((r: any) => r.data as { name: string; build: number; version: string; modified: number; mcversion: string; files: any[] }[])
}

export async function getForgeInstaller(mcVersion: string, forgeVersion: string): Promise<string> {
  return `${BMCL_BASE}/mc/forge/download?mcversion=${mcVersion}&version=${forgeVersion}&format=jar&category=installer`
}

/** Forge 安装清单 JSON (BMCL) */
export async function getForgeVersionList(mcVersion: string) {
  return uni.request({
    url: `${BMCL_BASE}/mc/forge/minecraft/${mcVersion}/list`
  }).then((r: any) => r.data as { build: number; version: string }[])
}

/** Quilt Loader */
export async function getQuiltMeta(mcVersion: string) {
  return uni.request({
    url: `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`
  }).then((r: any) => r.data)
}

/** NeoForge */
export async function getNeoForgeList() {
  return uni.request({
    url: `${BMCL_BASE}/mc/neoforge/list`
  }).then((r: any) => r.data as { build: number; version: string; mcversion: string; modified: number }[])
}

/** OptiFine (BMCL) */
export async function getOptiFineList(mcVersion: string) {
  return uni.request({
    url: `${BMCL_BASE}/mc/optifine/${mcVersion}`
  }).then((r: any) => r.data as { name: string; filename: string; type: string; patch: string }[])
}

export async function getOptiFineDownloadUrl(filename: string) {
  return `${BMCL_BASE}/mc/optifine/${filename}`
}

/** 服务端核心 */
export async function getServerCore(type: 'paper' | 'spigot' | 'purpur' | 'vanilla' | 'fabric' | 'forge' | 'neoforge', mcVersion: string) {
  if (type === 'vanilla') {
    return `${getApiBase('mojang')}/v1/objects/${mcVersion}/minecraft_server.${mcVersion}.jar`
  }
  if (type === 'paper') {
    const builds = await uni.request({
      url: `https://api.papermc.io/v2/projects/paper/versions/${mcVersion}/builds`
    }).then((r: any) => r.data.builds)
    const latest = builds[builds.length - 1]
    return {
      url: `https://api.papermc.io/v2/projects/paper/versions/${mcVersion}/builds/${latest.build}/downloads/paper-${mcVersion}-${latest.build}.jar`,
      build: latest.build
    }
  }
  if (type === 'purpur') {
    const builds = await uni.request({
      url: `https://api.purpurmc.org/v2/purpur/${mcVersion}`
    }).then((r: any) => r.data.builds.latest)
    return {
      url: `https://api.purpurmc.org/v2/purpur/${mcVersion}/${builds}/download`,
      build: builds
    }
  }
  if (type === 'fabric') {
    return `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/stable/json`
  }
  if (type === 'forge') {
    return `${BMCL_BASE}/mc/forge/download?mcversion=${mcVersion}&category=server&format=jar`
  }
  throw new Error('Unsupported core type: ' + type)
}

/** mc-server.jar 镜像地址 */
export function getMojangJarUrl(versionJsonUrl: string): string {
  return versionJsonUrl.replace('/version_manifest_v2.json', '').includes('piston-meta')
    ? versionJsonUrl
    : versionJsonUrl
}
