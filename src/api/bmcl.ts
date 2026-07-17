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
  const base = getApiBase(source)
  const url = base.includes('piston') ? `${base}/v1/products/internetsv2` : base
  const target = source === 'mojang' ? `${MOJANG_BASE}/v1/products/internetsv2` : `${BMCL_BASE}/mc/game/version_manifest_v2.json`
  return uni.request({ url: target }).then((r: any) => r.data)
}

/** 版本清单 (v2) */
export async function getVersionManifestV2(source: DownloadSource = 'bmcl') {
  const target = source === 'mojang'
    ? `${MOJANG_BASE}/v1/products/internetsv2`
    : `${BMCL_BASE}/mc/game/version_manifest_v2.json`
  return uni.request({ url: target }).then((r: any) => r.data)
}

/** 单个版本 manifest */
export async function getVersionJson(versionId: string, source: DownloadSource = 'bmcl') {
  // 1. 先获取清单
  const manifest = await getVersionManifest(source)
  const v = manifest.versions.find((x: any) => x.id === versionId)
  if (!v) throw new Error(`版本不存在: ${versionId}`)
  // 2. 下载版本 json (走镜像)
  let jsonUrl = v.url
  if (source === 'bmcl' && jsonUrl.includes('piston-meta.mojang.com')) {
    jsonUrl = jsonUrl.replace('https://piston-meta.mojang.com', BMCL_BASE + '/mc')
  } else if (source === 'mcbbs' && jsonUrl.includes('piston-meta.mojang.com')) {
    jsonUrl = jsonUrl.replace('https://piston-meta.mojang.com', MCBBS_BASE + '/mc')
  }
  return uni.request({ url: jsonUrl }).then((r: any) => r.data)
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
