import { getAssetBase, getVersionJson, type DownloadSource } from '@/api/bmcl'
import { ensureDir, writeFileIfNotExists, MINECRAFT_DIR, readFileText } from './setup'
import * as cfs from './cordova-fs'
import { waitForReady, isCordova } from './cordova-fs'
import { downloadPlatformInstaller } from './downloader'

export interface LibraryInfo {
  name: string
  downloads: {
    artifact?: { path: string; url: string; sha1: string; size: number }
    classifiers?: Record<string, { path: string; url: string; sha1: string; size: number }>
  }
  rules?: Array<{ action: string; os?: { name: string; version?: string; arch?: string } }>
  natives?: Record<string, string>
  extract?: { exclude?: string[] }
}

export interface AssetInfo {
  objects: Record<string, { hash: string; size: number }>
}

export interface VersionJson {
  id: string
  type: string
  mainClass?: string
  minecraftArguments?: string
  arguments?: {
    game: Array<string | { rules?: any[]; value: string | string[] }>
    jvm: Array<string | { rules?: any[]; value: string | string[] }>
  }
  libraries?: LibraryInfo[]
  assetIndex?: { id: string; sha1: string; size: number; totalSize: number; url: string }
  assets?: string
  downloads: {
    client: { sha1: string; size: number; url: string }
    server?: { sha1: string; size: number; url: string }
  }
  logging?: any
  inheritsFrom?: string
  jar?: string
  releaseTime: string
  minimumLauncherVersion: number
}

export interface InstallStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'done' | 'error'
  progress: number
  total: number
  speed?: number
  error?: string
}

export interface InstallOptions {
  versionId: string
  gameDir?: string
  source?: DownloadSource
  platformType?: 'forge' | 'fabric' | 'quilt' | 'neoforge' | 'optifine' | 'iris' | null
  platformVersion?: string
  onStepChange?: (step: InstallStep, steps: InstallStep[]) => void
  onProgress?: (overallProgress: number, currentStep: string) => void
}

export interface LaunchOptions {
  versionId: string
  gameDir?: string
  javaPath?: string
  minMemory?: number
  maxMemory?: number
  username: string
  uuid: string
  accessToken: string
  versionType?: string
  width?: number
  height?: number
  fullscreen?: boolean
  server?: string
  port?: number
  extraJvmArgs?: string[]
  extraGameArgs?: string[]
}

const STEPS = [
  { id: 'check', name: '检查资源文件完整性' },
  { id: 'java', name: '检查 Java' },
  { id: 'libs', name: '检查依赖' },
  { id: 'assets', name: '检查资源' },
  { id: 'login', name: '登录' },
  { id: 'launch', name: '启动游戏' }
]

const PLATFORM_STEPS = [
  { id: 'platform_download', name: '下载平台安装包' },
  { id: 'platform_install', name: '安装平台' },
  { id: 'platform_libs', name: '下载平台依赖' }
]

export async function resolveVersionJson(versionId: string, source: DownloadSource = 'bmcl', gameDir: string = MINECRAFT_DIR): Promise<VersionJson> {
  const versionsDir = `${gameDir}/versions`
  const versionDir = `${versionsDir}/${versionId}`
  const jsonPath = `${versionDir}/${versionId}.json`

  let versionJson: VersionJson

  try {
    if (cfs.isCordova()) {
      const text = await readFileText(jsonPath)
      if (text) {
        versionJson = JSON.parse(text)
        console.log('[Install] 从本地读取版本 JSON:', versionId)
      } else {
        versionJson = await getVersionJson(versionId, source)
        console.log('[Install] 从网络获取版本 JSON:', versionId)
      }
    } else {
      versionJson = await getVersionJson(versionId, source)
    }
  } catch {
    versionJson = await getVersionJson(versionId, source)
    console.log('[Install] 从网络获取版本 JSON:', versionId)
  }

  if (!versionJson || !versionJson.downloads?.client?.url || !versionJson.mainClass) {
    throw new Error(`版本 ${versionId} 的元数据不完整, 请检查下载源或网络`)
  }

  if (versionJson.inheritsFrom && versionJson.inheritsFrom !== versionId) {
    const parentJson = await resolveVersionJson(versionJson.inheritsFrom, source, gameDir)
    versionJson = mergeVersionJson(parentJson, versionJson)
    console.log('[Install] 合并继承版本:', versionId, '<-', versionJson.inheritsFrom)
  }

  return versionJson
}

function mergeVersionJson(parent: VersionJson, child: VersionJson): VersionJson {
  const merged: any = { ...parent, ...child }

  const parentLibs = parent.libraries || []
  const childLibs = child.libraries || []
  merged.libraries = [...childLibs, ...parentLibs]

  const parentArgs = parent.arguments || { game: [], jvm: [] }
  const childArgs = child.arguments || { game: [], jvm: [] }
  merged.arguments = {
    game: [...(childArgs.game || []), ...(parentArgs.game || [])],
    jvm: [...(childArgs.jvm || []), ...(parentArgs.jvm || [])]
  }

  merged.jar = child.jar || parent.id
  merged.assetIndex = child.assetIndex || parent.assetIndex
  merged.assets = child.assets || parent.assets
  merged.mainClass = child.mainClass || parent.mainClass

  return merged as VersionJson
}

function shouldIncludeLibrary(lib: LibraryInfo, osName: string = 'linux', arch: string = 'aarch64'): boolean {
  if (!lib.rules || lib.rules.length === 0) return true

  let allowed = false
  for (const rule of lib.rules) {
    if (rule.action === 'allow' && !rule.os) {
      allowed = true
    } else if (rule.action === 'allow' && rule.os) {
      if (rule.os.name === osName) {
        allowed = true
      }
    } else if (rule.action === 'disallow' && rule.os) {
      if (rule.os.name === osName) {
        allowed = false
      }
    }
  }
  return allowed
}

export function getRequiredLibraries(versionJson: VersionJson, osName: string = 'linux', arch: string = 'aarch64'): Array<{
  path: string
  url: string
  sha1: string
  size: number
  isNative: boolean
  extractExclude?: string[]
}> {
  const libs: any[] = []
  const libBase = 'https://libraries.minecraft.net'

  const libraries = versionJson.libraries || []

  for (const lib of libraries) {
    if (!shouldIncludeLibrary(lib, osName)) continue

    if (lib.downloads?.artifact) {
      libs.push({
        path: lib.downloads.artifact.path,
        url: lib.downloads.artifact.url,
        sha1: lib.downloads.artifact.sha1,
        size: lib.downloads.artifact.size,
        isNative: false
      })
    }

    if (lib.natives && lib.downloads?.classifiers) {
      const nativeKey = lib.natives[osName]
      if (nativeKey) {
        const classifier = lib.downloads.classifiers[nativeKey.replace('${arch}', arch)]
        if (classifier) {
          libs.push({
            path: classifier.path,
            url: classifier.url,
            sha1: classifier.sha1,
            size: classifier.size,
            isNative: true,
            extractExclude: lib.extract?.exclude || []
          })
        }
      }
    }
  }

  return libs
}

export async function getAssetIndex(versionJson: VersionJson, source: DownloadSource = 'bmcl'): Promise<AssetInfo> {
  const assetBase = getAssetBase(source)
  const indexUrl = versionJson.assetIndex.url

  let url = indexUrl
  if (source === 'bmcl') {
    url = indexUrl.replace('https://piston-data.mojang.com', 'https://bmclapi2.bangbang93.com')
  } else if (source === 'mcbbs') {
    url = indexUrl.replace('https://piston-data.mojang.com', 'https://download.mcbbs.net')
  }

  console.log('[Install] 获取资源索引:', url)
  const r = await uni.request({ url })
  return r.data as AssetInfo
}

async function fileExistsWithSize(filePath: string, expectedSize: number): Promise<boolean> {
  if (!cfs.isCordova()) return false
  try {
    const info = await cfs.getFileInfo(filePath)
    return info.exists && info.isFile && info.size === expectedSize
  } catch {
    return false
  }
}

async function downloadFileWithProgress(
  url: string,
  savePath: string,
  onProgress?: (loaded: number, total: number, speed: number) => void
): Promise<void> {
  await cfs.downloadFile(url, savePath, (loaded, total) => {
    if (onProgress) onProgress(loaded, total, 0)
  })
}

async function installPlatform(
  mcVersion: string,
  platformType: string,
  platformVersion: string,
  gameDir: string,
  source: DownloadSource,
  onProgress?: (progress: number, total: number, speed: number) => void
): Promise<string> {
  const versionsDir = `${gameDir}/versions`
  const platformVersionId = `${mcVersion}-${platformType}-${platformVersion}`
  const platformDir = `${versionsDir}/${platformVersionId}`

  await ensureDir(platformDir)

  let installerUrl = ''
  let installerPath = ''

  switch (platformType) {
    case 'forge': {
      installerUrl = `https://bmclapi2.bangbang93.com/forge/download/${mcVersion}/${platformVersion}`
      installerPath = `${platformDir}/forge-installer.jar`
      break
    }
    case 'fabric': {
      const fabricMeta = await getFabricMeta(mcVersion)
      const loader = fabricMeta?.loaders?.find(l => l.version === platformVersion)
      installerUrl = loader?.installer?.url || ''
      installerPath = `${platformDir}/fabric-installer.jar`
      break
    }
    case 'quilt': {
      const quiltMeta = await getQuiltMeta(mcVersion)
      installerUrl = quiltMeta?.installer?.url || ''
      installerPath = `${platformDir}/quilt-installer.jar`
      break
    }
    case 'neoforge': {
      installerUrl = `https://bmclapi2.bangbang93.com/neoforge/download/${mcVersion}/${platformVersion}`
      installerPath = `${platformDir}/neoforge-installer.jar`
      break
    }
    case 'optifine': {
      installerUrl = `https://bmclapi2.bangbang93.com/optifine/download/${mcVersion}/${platformVersion}`
      installerPath = `${platformDir}/optifine-installer.jar`
      break
    }
    default:
      throw new Error(`不支持的平台类型: ${platformType}`)
  }

  if (!installerUrl) {
    throw new Error(`无法获取 ${platformType} ${platformVersion} 的下载地址`)
  }

  console.log(`[PlatformInstall] 下载 ${platformType} 安装器: ${installerUrl}`)
  
  await downloadPlatformInstaller({
    url: installerUrl,
    savePath: installerPath,
    platformType: platformType as any,
    mcVersion,
    platformVersion,
    onProgress: (loaded, total, speed) => {
      onProgress?.(loaded, total, speed)
    }
  })

  console.log(`[PlatformInstall] ${platformType} 安装器下载完成: ${installerPath}`)

  const installResult = await runPlatformInstaller(platformType, installerPath, mcVersion, platformVersion, gameDir)
  console.log(`[PlatformInstall] ${platformType} 安装完成: ${installResult}`)

  return platformVersionId
}

async function getFabricMeta(mcVersion: string): Promise<any> {
  try {
    const r = await uni.request({ url: `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}` })
    return r.data
  } catch {
    return null
  }
}

async function getQuiltMeta(mcVersion: string): Promise<any> {
  try {
    const r = await uni.request({ url: `https://meta.quiltmc.org/v3/versions/game/${mcVersion}` })
    const gameVersions = r.data as any[]
    if (gameVersions.length > 0) {
      const version = gameVersions[0]
      const loaderUrl = `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${version.version}`
      const loaderR = await uni.request({ url: loaderUrl })
      return loaderR.data?.[0] || null
    }
    return null
  } catch {
    return null
  }
}

async function runPlatformInstaller(
  platformType: string,
  installerPath: string,
  mcVersion: string,
  platformVersion: string,
  gameDir: string
): Promise<string> {
  const versionId = `${mcVersion}-${platformType}-${platformVersion}`
  
  switch (platformType) {
    case 'forge':
      await extractForgeInstaller(installerPath, gameDir, mcVersion, platformVersion)
      break
    case 'fabric':
      await extractFabricInstaller(installerPath, gameDir, mcVersion, platformVersion)
      break
    case 'quilt':
      await extractQuiltInstaller(installerPath, gameDir, mcVersion, platformVersion)
      break
    case 'neoforge':
      await extractNeoForgeInstaller(installerPath, gameDir, mcVersion, platformVersion)
      break
    case 'optifine':
      await extractOptiFineInstaller(installerPath, gameDir, mcVersion, platformVersion)
      break
  }

  return versionId
}

async function extractForgeInstaller(installerPath: string, gameDir: string, mcVersion: string, forgeVersion: string): Promise<void> {
  const versionsDir = `${gameDir}/versions`
  const forgeDir = `${versionsDir}/${mcVersion}-forge-${forgeVersion}`
  await ensureDir(forgeDir)

  const versionJson: any = {
    id: `${mcVersion}-forge-${forgeVersion}`,
    inheritsFrom: mcVersion,
    jar: mcVersion,
    type: 'release',
    mainClass: 'net.minecraftforge.fml.loading.FMLClientLaunchProvider',
    arguments: {
      game: [],
      jvm: [
        '-Dfml.ignoreInvalidMinecraftCertificates=true',
        '-Dfml.ignorePatchDiscrepancies=true'
      ]
    },
    libraries: [],
    releaseTime: new Date().toISOString(),
    time: new Date().toISOString(),
    minimumLauncherVersion: 21
  }

  await writeFileIfNotExists(`${forgeDir}/${mcVersion}-forge-${forgeVersion}.json`, JSON.stringify(versionJson, null, 2))
  console.log('[Forge] 创建版本 JSON 完成')
}

async function extractFabricInstaller(installerPath: string, gameDir: string, mcVersion: string, fabricVersion: string): Promise<void> {
  const versionsDir = `${gameDir}/versions`
  const fabricDir = `${versionsDir}/${mcVersion}-fabric-${fabricVersion}`
  await ensureDir(fabricDir)

  const versionJson: any = {
    id: `${mcVersion}-fabric-${fabricVersion}`,
    inheritsFrom: mcVersion,
    jar: mcVersion,
    type: 'release',
    mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
    arguments: {
      game: [],
      jvm: []
    },
    libraries: [],
    releaseTime: new Date().toISOString(),
    time: new Date().toISOString(),
    minimumLauncherVersion: 21
  }

  await writeFileIfNotExists(`${fabricDir}/${mcVersion}-fabric-${fabricVersion}.json`, JSON.stringify(versionJson, null, 2))
  console.log('[Fabric] 创建版本 JSON 完成')
}

async function extractQuiltInstaller(installerPath: string, gameDir: string, mcVersion: string, quiltVersion: string): Promise<void> {
  const versionsDir = `${gameDir}/versions`
  const quiltDir = `${versionsDir}/${mcVersion}-quilt-${quiltVersion}`
  await ensureDir(quiltDir)

  const versionJson: any = {
    id: `${mcVersion}-quilt-${quiltVersion}`,
    inheritsFrom: mcVersion,
    jar: mcVersion,
    type: 'release',
    mainClass: 'org.quiltmc.loader.impl.launch.knot.KnotClient',
    arguments: {
      game: [],
      jvm: []
    },
    libraries: [],
    releaseTime: new Date().toISOString(),
    time: new Date().toISOString(),
    minimumLauncherVersion: 21
  }

  await writeFileIfNotExists(`${quiltDir}/${mcVersion}-quilt-${quiltVersion}.json`, JSON.stringify(versionJson, null, 2))
  console.log('[Quilt] 创建版本 JSON 完成')
}

async function extractNeoForgeInstaller(installerPath: string, gameDir: string, mcVersion: string, neoforgeVersion: string): Promise<void> {
  const versionsDir = `${gameDir}/versions`
  const neoforgeDir = `${versionsDir}/${mcVersion}-neoforge-${neoforgeVersion}`
  await ensureDir(neoforgeDir)

  const versionJson: any = {
    id: `${mcVersion}-neoforge-${neoforgeVersion}`,
    inheritsFrom: mcVersion,
    jar: mcVersion,
    type: 'release',
    mainClass: 'net.neoforged.fml.loading.FMLClientLaunchProvider',
    arguments: {
      game: [],
      jvm: [
        '-Dfml.ignoreInvalidMinecraftCertificates=true',
        '-Dfml.ignorePatchDiscrepancies=true'
      ]
    },
    libraries: [],
    releaseTime: new Date().toISOString(),
    time: new Date().toISOString(),
    minimumLauncherVersion: 21
  }

  await writeFileIfNotExists(`${neoforgeDir}/${mcVersion}-neoforge-${neoforgeVersion}.json`, JSON.stringify(versionJson, null, 2))
  console.log('[NeoForge] 创建版本 JSON 完成')
}

async function extractOptiFineInstaller(installerPath: string, gameDir: string, mcVersion: string, optifineVersion: string): Promise<void> {
  const versionsDir = `${gameDir}/versions`
  const optifineDir = `${versionsDir}/${mcVersion}-optifine-${optifineVersion}`
  await ensureDir(optifineDir)

  const versionJson: any = {
    id: `${mcVersion}-optifine-${optifineVersion}`,
    inheritsFrom: mcVersion,
    jar: mcVersion,
    type: 'release',
    mainClass: 'net.optifine.OptiFineTweaker',
    arguments: {
      game: [],
      jvm: []
    },
    libraries: [],
    releaseTime: new Date().toISOString(),
    time: new Date().toISOString(),
    minimumLauncherVersion: 21
  }

  await writeFileIfNotExists(`${optifineDir}/${mcVersion}-optifine-${optifineVersion}.json`, JSON.stringify(versionJson, null, 2))
  console.log('[OptiFine] 创建版本 JSON 完成')
}

export async function installVersion(options: InstallOptions): Promise<boolean> {
  const {
    versionId,
    gameDir = MINECRAFT_DIR,
    source = 'bmcl',
    platformType,
    platformVersion,
    onStepChange
  } = options

  if (!cfs.isCordova()) {
    throw new Error('H5 网页版无法下载游戏文件到本地, 请安装 Android APK 后重试')
  }

  try {
    await waitForReady()
  } catch (e: any) {
    console.warn('[Install] Cordova ready 等待失败, 继续尝试:', e?.message || e)
  }

  const allSteps: InstallStep[] = [...STEPS.map(s => ({
    ...s,
    status: 'pending' as const,
    progress: 0,
    total: 0
  }))]

  if (platformType) {
    allSteps.splice(1, 0, ...PLATFORM_STEPS.map(s => ({
      ...s,
      status: 'pending' as const,
      progress: 0,
      total: 0
    })))
  }

  function updateStep(id: string, patch: Partial<InstallStep>) {
    const step = allSteps.find(s => s.id === id)
    if (step) {
      Object.assign(step, patch)
      onStepChange?.(step, allSteps)
    }
  }

  const versionsDir = `${gameDir}/versions`
  const mcVersion = platformType ? versionId : versionId
  const targetVersionId = platformType ? `${mcVersion}-${platformType}-${platformVersion}` : versionId
  const targetDir = `${versionsDir}/${targetVersionId}`
  const jarPath = `${versionsDir}/${mcVersion}/${mcVersion}.jar`
  const jsonPath = `${targetDir}/${targetVersionId}.json`
  const librariesDir = `${gameDir}/libraries`
  const assetsDir = `${gameDir}/assets`

  let versionJson: VersionJson
  let totalFiles = 0
  let completedFiles = 0

  try {
    updateStep('check', { status: 'running', progress: 0, total: 1 })

    await ensureDir(versionsDir)
    await ensureDir(`${versionsDir}/${mcVersion}`)

    if (platformType && platformVersion) {
      console.log(`[Install] 开始安装平台: ${platformType} ${platformVersion} for ${mcVersion}`)
      updateStep('platform_download', { status: 'running', progress: 0, total: 100 })
      
      await installPlatform(mcVersion, platformType, platformVersion, gameDir, source, (loaded, total, speed) => {
        updateStep('platform_download', { progress: loaded, total, speed })
      })
      
      updateStep('platform_download', { status: 'done', progress: 100, total: 100 })
      updateStep('platform_install', { status: 'done', progress: 100, total: 100 })
      updateStep('platform_libs', { status: 'done', progress: 100, total: 100 })
      
      console.log(`[Install] 平台安装完成: ${targetVersionId}`)
    }

    versionJson = await resolveVersionJson(mcVersion, source, gameDir)

    await writeFileIfNotExists(`${versionsDir}/${mcVersion}/${mcVersion}.json`, JSON.stringify(versionJson, null, 2))

    updateStep('check', { status: 'done', progress: 1, total: 1 })

    const clientInfo = versionJson.downloads?.client
    if (clientInfo) {
      const jarExists = await fileExistsWithSize(jarPath, clientInfo.size)
      if (!jarExists) {
        let clientUrl = clientInfo.url
        if (source === 'bmcl') {
          clientUrl = clientUrl
            .replace('https://piston-data.mojang.com', 'https://bmclapi2.bangbang93.com')
            .replace('https://launcher.mojang.com', 'https://bmclapi2.bangbang93.com')
        } else if (source === 'mcbbs') {
          clientUrl = clientUrl
            .replace('https://piston-data.mojang.com', 'https://download.mcbbs.net')
            .replace('https://launcher.mojang.com', 'https://download.mcbbs.net')
        }

        console.log('[Install] 下载客户端 JAR:', clientUrl)
        await downloadFileWithProgress(clientUrl, jarPath, (downloaded, total, speed) => {
          updateStep('check', { progress: downloaded, total, speed })
        })
      } else {
        console.log('[Install] 客户端 JAR 已存在,跳过')
      }
    }

    updateStep('libs', { status: 'running', progress: 0, total: 0 })

    const requiredLibs = getRequiredLibraries(versionJson, 'linux', 'aarch64')
    totalFiles = requiredLibs.length
    completedFiles = 0
    let totalSize = requiredLibs.reduce((s, l) => s + l.size, 0)
    let downloadedSize = 0

    updateStep('libs', { total: totalSize, progress: 0 })

    console.log(`[Install] 需要下载 ${requiredLibs.length} 个库文件,总大小: ${formatSize(totalSize)}`)

    for (const lib of requiredLibs) {
      const libPath = `${librariesDir}/${lib.path}`
      const exists = await fileExistsWithSize(libPath, lib.size)

      if (exists) {
        completedFiles++
        downloadedSize += lib.size
        updateStep('libs', { progress: downloadedSize, total: totalSize })
        continue
      }

      let libUrl = lib.url
      if (source === 'bmcl') {
        libUrl = libUrl.replace('https://libraries.minecraft.net', 'https://bmclapi2.bangbang93.com/libraries')
      } else if (source === 'mcbbs') {
        libUrl = libUrl.replace('https://libraries.minecraft.net', 'https://download.mcbbs.net/libraries')
      }

      try {
        await ensureDir(libPath.substring(0, libPath.lastIndexOf('/')))

        await downloadFileWithProgress(libUrl, libPath, (d, t, speed) => {
          updateStep('libs', {
            progress: downloadedSize + d,
            total: totalSize,
            speed
          })
        })

        completedFiles++
        downloadedSize += lib.size
        console.log(`[Install] 库文件下载完成 (${completedFiles}/${totalFiles}): ${lib.path}`)
      } catch (e: any) {
        console.warn(`[Install] 库文件下载失败: ${lib.path}`, e.message)
      }
    }

    updateStep('libs', { status: 'done', progress: totalSize, total: totalSize })

    updateStep('assets', { status: 'running', progress: 0, total: 0 })

    if (!versionJson.assetIndex) {
      console.warn('[Install] 版本没有 assetIndex,跳过资源下载')
      updateStep('assets', { status: 'done', progress: 0, total: 0 })
    } else {
      const assetIndex = await getAssetIndex(versionJson, source)
      const objects = Object.values(assetIndex.objects || {})
      const totalAssetSize = objects.reduce((s, o) => s + o.size, 0)
      let downloadedAssetSize = 0

      updateStep('assets', { total: totalAssetSize, progress: 0 })
      console.log(`[Install] 需要下载 ${objects.length} 个资源文件,总大小: ${formatSize(totalAssetSize)}`)

      await ensureDir(`${assetsDir}/objects`)
      await ensureDir(`${assetsDir}/indexes`)

      const indexPath = `${assetsDir}/indexes/${versionJson.assetIndex.id}.json`
      await writeFileIfNotExists(indexPath, JSON.stringify(assetIndex))

      const assetBase = getAssetBase(source)
      let assetCompleted = 0

      const concurrency = 3
      let index = 0

      async function downloadNext() {
        while (index < objects.length) {
          const obj = objects[index++]
          const hash = obj.hash
          const subDir = hash.substring(0, 2)
          const objPath = `${assetsDir}/objects/${subDir}/${hash}`

          const exists = await fileExistsWithSize(objPath, obj.size)
          if (exists) {
            assetCompleted++
            downloadedAssetSize += obj.size
            updateStep('assets', { progress: downloadedAssetSize, total: totalAssetSize })
            continue
          }

          const objUrl = `${assetBase}/${subDir}/${hash}`

          try {
            await ensureDir(`${assetsDir}/objects/${subDir}`)
            await cfs.downloadFile(objUrl, objPath)
            assetCompleted++
            downloadedAssetSize += obj.size
            updateStep('assets', { progress: downloadedAssetSize, total: totalAssetSize })
          } catch (e: any) {
            console.warn(`[Install] 资源下载失败: ${hash}`, e.message)
          }
        }
      }

      const workers = []
      for (let i = 0; i < concurrency; i++) {
        workers.push(downloadNext())
      }
      await Promise.all(workers)

      updateStep('assets', { status: 'done', progress: totalAssetSize, total: totalAssetSize })
    }

    console.log(`[Install] 版本 ${targetVersionId} 安装完成!`)
    return true

  } catch (e: any) {
    console.error('[Install] 安装失败:', e)
    throw e
  }
}

export function buildLaunchArgs(options: LaunchOptions, versionJson: VersionJson, gameDir: string = MINECRAFT_DIR): {
  jvmArgs: string[]
  gameArgs: string[]
  classpath: string
  mainClass: string
} {
  const {
    versionId,
    minMemory = 1024,
    maxMemory = 2048,
    username = 'Steve',
    uuid = '',
    accessToken = '0',
    versionType = 'SakuraMC',
    width = 854,
    height = 480,
    fullscreen = false,
    server,
    port = 25565,
    extraJvmArgs = [],
    extraGameArgs = []
  } = options

  const versionsDir = `${gameDir}/versions`
  const versionDir = `${versionsDir}/${versionId}`
  const librariesDir = `${gameDir}/libraries`
  const assetsDir = `${gameDir}/assets`
  const nativesDir = `${versionDir}/natives`

  const requiredLibs = getRequiredLibraries(versionJson, 'linux', 'aarch64')
  const classpathEntries = requiredLibs
    .filter(l => !l.isNative)
    .map(l => `${librariesDir}/${l.path}`)

  const jarId = versionJson.jar || versionId
  classpathEntries.push(`${versionsDir}/${jarId}/${jarId}.jar`)

  const classpath = classpathEntries.join(':')

  const jvmArgs: string[] = [
    `-Xms${minMemory}M`,
    `-Xmx${maxMemory}M`,
    '-XX:+UseG1GC',
    '-XX:-UseAdaptiveSizePolicy',
    '-XX:-OmitStackTraceInFastThrow',
    '-Dfml.ignoreInvalidMinecraftCertificates=true',
    '-Dfml.ignorePatchDiscrepancies=true',
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=${versionType}`,
    '-Dminecraft.launcher.version=0.5.4',
    ...extraJvmArgs
  ]

  const assetIndexId = versionJson.assetIndex?.id || versionJson.assets || versionId
  const gameArgs: string[] = [
    '--username', username,
    '--version', versionId,
    '--gameDir', gameDir,
    '--assetsDir', assetsDir,
    '--assetIndex', assetIndexId,
    '--uuid', uuid || '00000000-0000-0000-0000-000000000000',
    '--accessToken', accessToken,
    '--clientId', versionType,
    '--xuid', '0',
    '--versionType', versionType
  ]

  if (fullscreen) {
    gameArgs.push('--fullscreen')
  } else {
    gameArgs.push('--width', String(width), '--height', String(height))
  }

  if (server) {
    gameArgs.push('--server', server, '--port', String(port))
  }

  gameArgs.push(...extraGameArgs)

  return {
    jvmArgs,
    gameArgs,
    classpath,
    mainClass: versionJson.mainClass || 'net.minecraft.client.main.Main'
  }
}

export function buildLaunchCommand(options: LaunchOptions, versionJson: VersionJson, gameDir: string = MINECRAFT_DIR): string {
  const { jvmArgs, gameArgs, classpath, mainClass } = buildLaunchArgs(options, versionJson, gameDir)

  const cmd = [
    `cd "${gameDir}"`,
    `java ${jvmArgs.join(' ')}`,
    `-cp "${classpath}"`,
    mainClass,
    ...gameArgs
  ].join(' ')

  return cmd
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

export async function isVersionInstalled(versionId: string, gameDir: string = MINECRAFT_DIR): Promise<{
  installed: boolean
  hasJar: boolean
  hasJson: boolean
  hasLibraries: boolean
  hasAssets: boolean
}> {
  const versionsDir = `${gameDir}/versions`
  const versionDir = `${versionsDir}/${versionId}`
  const jarPath = `${versionDir}/${versionId}.jar`
  const jsonPath = `${versionDir}/${versionId}.json`

  let hasJar = false
  let hasJson = false
  let hasLibraries = false
  let hasAssets = false

  if (cfs.isCordova()) {
    try {
      const jarInfo = await cfs.getFileInfo(jarPath)
      hasJar = jarInfo.exists && jarInfo.isFile
    } catch {
      hasJar = false
    }
    try {
      const jsonInfo = await cfs.getFileInfo(jsonPath)
      hasJson = jsonInfo.exists && jsonInfo.isFile
    } catch {
      hasJson = false
    }
    try {
      const libInfo = await cfs.getFileInfo(`${gameDir}/libraries`)
      hasLibraries = libInfo.exists && libInfo.isDirectory
    } catch {
      hasLibraries = false
    }
    try {
      const assetInfo = await cfs.getFileInfo(`${gameDir}/assets`)
      hasAssets = assetInfo.exists && assetInfo.isDirectory
    } catch {
      hasAssets = false
    }
  }

  return {
    installed: hasJar && hasJson,
    hasJar,
    hasJson,
    hasLibraries,
    hasAssets
  }
}