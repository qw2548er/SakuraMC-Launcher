/**
 * Minecraft 游戏安装与启动核心模块
 * 参考 FCL (FoldCraftLauncher) 的启动流程
 * 支持完整的资源下载、完整性校验、启动参数生成
 */

import { getAssetBase, getLibraryBase, getVersionJson, type DownloadSource } from '@/api/bmcl'
import { ensureDir, writeFileIfNotExists, MINECRAFT_DIR } from './setup'
import { downloadFile } from './downloader'

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

/**
 * 获取版本 JSON（支持继承版本如 Forge/Fabric）
 */
export async function resolveVersionJson(versionId: string, source: DownloadSource = 'bmcl', gameDir: string = MINECRAFT_DIR): Promise<VersionJson> {
  const versionsDir = `${gameDir}/versions`
  const versionDir = `${versionsDir}/${versionId}`
  const jsonPath = `${versionDir}/${versionId}.json`
  
  let versionJson: VersionJson
  
  // 先尝试读取本地文件
  try {
    // #ifdef APP-PLUS
    const fs = plus.io.getFileSystemManager()
    const res = fs.readFileSync(jsonPath, 'utf-8')
    versionJson = JSON.parse(res)
    console.log('[Install] 从本地读取版本 JSON:', versionId)
    // #endif
    // #ifndef APP-PLUS
    versionJson = await getVersionJson(versionId, source)
    // #endif
  } catch {
    // 本地没有,从网络获取
    versionJson = await getVersionJson(versionId, source)
    console.log('[Install] 从网络获取版本 JSON:', versionId)
  }
  
  // 如果有继承,递归合并
  if (versionJson.inheritsFrom && versionJson.inheritsFrom !== versionId) {
    const parentJson = await resolveVersionJson(versionJson.inheritsFrom, source, gameDir)
    versionJson = mergeVersionJson(parentJson, versionJson)
    console.log('[Install] 合并继承版本:', versionId, '<-', versionJson.inheritsFrom)
  }
  
  return versionJson
}

/**
 * 合并父子版本 JSON
 */
function mergeVersionJson(parent: VersionJson, child: VersionJson): VersionJson {
  const merged: any = { ...parent, ...child }
  
  // 合并 libraries (子版本在前,父版本在后)
  const parentLibs = parent.libraries || []
  const childLibs = child.libraries || []
  merged.libraries = [...childLibs, ...parentLibs]
  
  // 合并 arguments
  const parentArgs = parent.arguments || { game: [], jvm: [] }
  const childArgs = child.arguments || { game: [], jvm: [] }
  merged.arguments = {
    game: [...(childArgs.game || []), ...(parentArgs.game || [])],
    jvm: [...(childArgs.jvm || []), ...(parentArgs.jvm || [])]
  }
  
  // 子版本的 jar 优先,否则用父版本的 id
  merged.jar = child.jar || parent.id
  
  // assetIndex 用子版本的,没有就用父版本的
  merged.assetIndex = child.assetIndex || parent.assetIndex
  merged.assets = child.assets || parent.assets
  
  // mainClass 用子版本的
  merged.mainClass = child.mainClass || parent.mainClass
  
  return merged as VersionJson
}

/**
 * 检查库文件是否需要下载 (根据规则过滤)
 */
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

/**
 * 获取需要下载的库文件列表
 */
export function getRequiredLibraries(versionJson: VersionJson, osName: string = 'linux', arch: string = 'aarch64'): Array<{
  path: string
  url: string
  sha1: string
  size: number
  isNative: boolean
}> {
  const libs: any[] = []
  const libBase = 'https://libraries.minecraft.net'
  
  const libraries = versionJson.libraries || []
  
  for (const lib of libraries) {
    if (!shouldIncludeLibrary(lib, osName)) continue
    
    // 主 artifact
    if (lib.downloads?.artifact) {
      libs.push({
        path: lib.downloads.artifact.path,
        url: lib.downloads.artifact.url,
        sha1: lib.downloads.artifact.sha1,
        size: lib.downloads.artifact.size,
        isNative: false
      })
    }
    
    // natives
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

/**
 * 获取资源索引文件
 */
export async function getAssetIndex(versionJson: VersionJson, source: DownloadSource = 'bmcl'): Promise<AssetInfo> {
  const assetBase = getAssetBase(source)
  const indexUrl = versionJson.assetIndex.url
  
  // 转换为镜像源
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

/**
 * 检查文件是否存在且大小正确
 */
async function fileExistsWithSize(filePath: string, expectedSize: number): Promise<boolean> {
  // #ifdef APP-PLUS
  return new Promise((resolve) => {
    try {
      const fs = plus.io.getFileSystemManager()
      fs.stat({
        path: filePath,
        success: (res: any) => {
          // HTML5+ stat 回调返回 { stats: FileStat }, 但不同版本兼容
          const stat = res?.stats || res
          resolve(!!stat && stat.size === expectedSize)
        },
        fail: () => resolve(false)
      })
    } catch {
      resolve(false)
    }
  })
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

/**
 * 完整安装游戏版本 (下载所有必要资源)
 */
export async function installVersion(options: InstallOptions): Promise<boolean> {
  const {
    versionId,
    gameDir = MINECRAFT_DIR,
    source = 'bmcl',
    onStepChange,
    onProgress
  } = options
  
  const steps: InstallStep[] = STEPS.map(s => ({
    ...s,
    status: 'pending',
    progress: 0,
    total: 0
  }))
  
  function updateStep(id: string, patch: Partial<InstallStep>) {
    const step = steps.find(s => s.id === id)
    if (step) {
      Object.assign(step, patch)
      onStepChange?.(step, steps)
    }
  }
  
  const versionsDir = `${gameDir}/versions`
  const versionDir = `${versionsDir}/${versionId}`
  const jarPath = `${versionDir}/${versionId}.jar`
  const jsonPath = `${versionDir}/${versionId}.json`
  const librariesDir = `${gameDir}/libraries`
  const assetsDir = `${gameDir}/assets`
  
  let versionJson: VersionJson
  let totalFiles = 0
  let completedFiles = 0
  
  try {
    // ===== Step 1: 获取版本信息 =====
    updateStep('check', { status: 'running', progress: 0, total: 1 })
    
    await ensureDir(versionDir)
    versionJson = await resolveVersionJson(versionId, source, gameDir)
    
    // 保存版本 JSON
    await writeFileIfNotExists(jsonPath, JSON.stringify(versionJson, null, 2))
    
    updateStep('check', { status: 'done', progress: 1, total: 1 })
    
    // ===== Step 2: 下载客户端 JAR =====
    const clientInfo = versionJson.downloads?.client
    if (clientInfo) {
      const jarExists = await fileExistsWithSize(jarPath, clientInfo.size)
      if (!jarExists) {
        let clientUrl = clientInfo.url
        if (source === 'bmcl') {
          clientUrl = clientUrl.replace('https://piston-data.mojang.com', 'https://bmclapi2.bangbang93.com')
                           .replace('https://launcher.mojang.com', 'https://bmclapi2.bangbang93.com')
        } else if (source === 'mcbbs') {
          clientUrl = clientUrl.replace('https://piston-data.mojang.com', 'https://download.mcbbs.net')
                           .replace('https://launcher.mojang.com', 'https://download.mcbbs.net')
        }
        
        console.log('[Install] 下载客户端 JAR:', clientUrl)
        await downloadFile({
          url: clientUrl,
          savePath: jarPath,
          timeout: 600000,
          onProgress: (downloaded, total, speed) => {
            updateStep('check', { progress: downloaded, total, speed })
          }
        })
      } else {
        console.log('[Install] 客户端 JAR 已存在,跳过')
      }
    }
    
    // ===== Step 3: 下载 Libraries =====
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
      
      // 转换下载地址为镜像源
      let libUrl = lib.url
      if (source === 'bmcl') {
        libUrl = libUrl.replace('https://libraries.minecraft.net', 'https://bmclapi2.bangbang93.com/libraries')
      } else if (source === 'mcbbs') {
        libUrl = libUrl.replace('https://libraries.minecraft.net', 'https://download.mcbbs.net/libraries')
      }
      
      try {
        await ensureDir(libPath.substring(0, libPath.lastIndexOf('/')))
        
        await downloadFile({
          url: libUrl,
          savePath: libPath,
          timeout: 120000,
          onProgress: (d, t, speed) => {
            updateStep('libs', { 
              progress: downloadedSize + d, 
              total: totalSize,
              speed 
            })
          }
        })
        
        completedFiles++
        downloadedSize += lib.size
        console.log(`[Install] 库文件下载完成 (${completedFiles}/${totalFiles}): ${lib.path}`)
      } catch (e: any) {
        console.warn(`[Install] 库文件下载失败: ${lib.path}`, e.message)
        // 非关键文件失败不终止,继续下载其他的
      }
    }
    
    updateStep('libs', { status: 'done', progress: totalSize, total: totalSize })
    
    // ===== Step 4: 下载 Assets 资源 =====
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
      
      // 保存资源索引
      const indexPath = `${assetsDir}/indexes/${versionJson.assetIndex.id}.json`
      await writeFileIfNotExists(indexPath, JSON.stringify(assetIndex))
      
      const assetBase = getAssetBase(source)
      let assetCompleted = 0
      
      // 限制并发下载数量
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
            await downloadFile({
              url: objUrl,
              savePath: objPath,
              timeout: 60000
            })
            assetCompleted++
            downloadedAssetSize += obj.size
            updateStep('assets', { progress: downloadedAssetSize, total: totalAssetSize })
          } catch (e: any) {
            console.warn(`[Install] 资源下载失败: ${hash}`, e.message)
          }
        }
      }
      
      // 并发下载
      const workers = []
      for (let i = 0; i < concurrency; i++) {
        workers.push(downloadNext())
      }
      await Promise.all(workers)
      
      updateStep('assets', { status: 'done', progress: totalAssetSize, total: totalAssetSize })
    }
    
    console.log(`[Install] 版本 ${versionId} 安装完成!`)
    return true
    
  } catch (e: any) {
    console.error('[Install] 安装失败:', e)
    throw e
  }
}

/**
 * 生成启动命令行参数
 */
export function buildLaunchArgs(options: LaunchOptions, versionJson: VersionJson, gameDir: string = MINECRAFT_DIR): {
  jvmArgs: string[]
  gameArgs: string[]
  classpath: string
  mainClass: string
} {
  const {
    versionId,
    javaPath,
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
  
  // 构建 classpath
  const requiredLibs = getRequiredLibraries(versionJson, 'linux', 'aarch64')
  const classpathEntries = requiredLibs
    .filter(l => !l.isNative)
    .map(l => `${librariesDir}/${l.path}`)
  
  // 添加版本 jar
  const jarId = versionJson.jar || versionId
  classpathEntries.push(`${versionsDir}/${jarId}/${jarId}.jar`)
  
  const classpath = classpathEntries.join(':')
  
  // JVM 参数
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
    '-Dminecraft.launcher.version=0.3.2',
    ...extraJvmArgs
  ]
  
  // 游戏参数
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
    mainClass: versionJson.mainClass
  }
}

/**
 * 生成完整的 Java 启动命令
 */
export function buildLaunchCommand(options: LaunchOptions, versionJson: VersionJson, gameDir: string = MINECRAFT_DIR): string {
  const { jvmArgs, gameArgs, classpath, mainClass } = buildLaunchArgs(options, versionJson, gameDir)
  
  const mainClassToUse = mainClass || 'net.minecraft.client.main.Main'
  
  const cmd = [
    `cd "${gameDir}"`,
    `java ${jvmArgs.join(' ')}`,
    `-cp "${classpath}"`,
    mainClassToUse,
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

/**
 * 检查版本是否已完整安装
 */
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
  
  // #ifdef APP-PLUS
  const fs = plus.io.getFileSystemManager()
  hasJar = await new Promise(resolve => {
    try {
      fs.access({ path: jarPath, success: () => resolve(true), fail: () => resolve(false) })
    } catch { resolve(false) }
  })
  hasJson = await new Promise(resolve => {
    try {
      fs.access({ path: jsonPath, success: () => resolve(true), fail: () => resolve(false) })
    } catch { resolve(false) }
  })
  // #endif
  
  // 检查 libraries 和 assets 目录是否存在
  const libDir = `${gameDir}/libraries`
  const assetsDir = `${gameDir}/assets`
  
  // #ifdef APP-PLUS
  hasLibraries = await new Promise(resolve => {
    try {
      fs.access({ path: libDir, success: () => resolve(true), fail: () => resolve(false) })
    } catch { resolve(false) }
  })
  hasAssets = await new Promise(resolve => {
    try {
      fs.access({ path: assetsDir, success: () => resolve(true), fail: () => resolve(false) })
    } catch { resolve(false) }
  })
  // #endif
  
  return {
    installed: hasJar && hasJson,
    hasJar,
    hasJson,
    hasLibraries,
    hasAssets
  }
}
