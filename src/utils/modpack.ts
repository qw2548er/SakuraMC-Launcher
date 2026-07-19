/**
 * 整合包导入工具
 * 支持 Modrinth (.mrpack)、 CurseForge (manifest.json) 与手工 zip 整合包
 *
 * 整合包结构:
 *  - Modrinth: modrinth.index.json + overrides/ + server-overrides/ + client-overrides/
 *  - CurseForge: manifest.json + mods/*.jar (或 overrides/)
 *  - 通用 zip: 直接放入 versions/<name>/ 下作为新版本目录
 */
import { MINECRAFT_DIR, ensureDir, deleteFile } from './setup'
import {
  chooseFile,
  importFile,
  unzip,
  listZip,
  mkdir,
  rename,
  type ZipEntry
} from './file-chooser'

export type ModpackFormat = 'modrinth' | 'curseforge' | 'plain'

export interface ModpackInfo {
  format: ModpackFormat
  name: string
  version?: string
  mcVersion: string
  modLoader?: { type: string; version?: string }
  mods: { file: string; sha1?: string; size?: number }[]
  overridesDir: string | null
}

export interface ImportProgress {
  step: string
  current: number
  total: number
}

export interface ImportResult {
  success: boolean
  format: ModpackFormat
  name: string
  destDir: string
  modCount: number
  error?: string
}

/** 选择并导入整合包 */
export async function importModpack(
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  // 1. 选择 zip 文件
  onProgress?.({ step: '选择文件', current: 0, total: 1 })
  const uris = await chooseFile('application/zip', false)
  if (uris.length === 0) {
    return { success: false, format: 'plain', name: '', destDir: '', modCount: 0, error: '未选择文件' }
  }

  // 2. 导入到临时目录
  onProgress?.({ step: '复制文件', current: 0, total: 1 })
  const tmpDir = `${MINECRAFT_DIR}/.modpack-tmp`
  await ensureDir(tmpDir)
  const imported = await importFile(uris[0], tmpDir)

  // 3. 列出 zip 内部条目, 判断格式
  onProgress?.({ step: '分析整合包', current: 0, total: 1 })
  const entries = await listZip(imported.path)
  const info = detectFormat(entries)

  // 4. 解压到目标目录
  const safeName = info.name.replace(/[^A-Za-z0-9._-]+/g, '_') || 'imported'
  let destDir: string
  if (info.format === 'plain') {
    destDir = `${MINECRAFT_DIR}/versions/${safeName}`
  } else {
    destDir = `${tmpDir}/${safeName}_unpacked`
  }
  await mkdir(destDir)
  onProgress?.({ step: '解压整合包', current: 0, total: 1 })
  await unzip(imported.path, destDir)

  // 5. 根据格式处理
  let result: ImportResult
  if (info.format === 'modrinth') {
    result = await installModrinth(destDir, info, onProgress)
  } else if (info.format === 'curseforge') {
    result = await installCurseforge(destDir, info, onProgress)
  } else {
    result = await installPlain(destDir, info, onProgress)
  }

  // 6. 清理临时 zip
  try { await deleteFile(imported.path) } catch {}

  return result
}

/** 列出 zip 内部条目, 识别整合包格式 */
function detectFormat(entries: ZipEntry[]): ModpackInfo {
  const hasModrinthIndex = entries.some(e => e.name === 'modrinth.index.json')
  const hasManifest = entries.some(e => e.name === 'manifest.json')

  if (hasModrinthIndex) {
    return {
      format: 'modrinth',
      name: 'ModrinthPack',
      mcVersion: '',
      mods: [],
      overridesDir: 'overrides'
    }
  }
  if (hasManifest) {
    return {
      format: 'curseforge',
      name: 'CurseForgePack',
      mcVersion: '',
      mods: [],
      overridesDir: 'overrides'
    }
  }
  // 通用 zip
  const baseName = entries[0]?.name.split('/')[0] || 'PlainPack'
  return {
    format: 'plain',
    name: baseName,
    mcVersion: '',
    mods: [],
    overridesDir: null
  }
}

/** 读取解压后的 JSON 文件 */
async function readJson(filePath: string): Promise<any> {
  // #ifdef APP-PLUS
  return new Promise((resolve, reject) => {
    try {
      const fs = plus.io.getFileSystemManager()
      fs.readFile({
        filePath,
        encoding: 'utf-8',
        success: (res: any) => {
          try { resolve(JSON.parse(res.data || '{}')) } catch (e: any) { reject(e) }
        },
        fail: (e: any) => reject(new Error(e.message))
      })
    } catch (e: any) {
      reject(e)
    }
  })
  // #endif
  // #ifndef APP-PLUS
  return {}
  // #endif
}

/** 安装 Modrinth 整合包 */
async function installModrinth(
  unpackedDir: string,
  info: ModpackInfo,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  try {
    onProgress?.({ step: '解析 modrinth.index.json', current: 0, total: 1 })
    const index = await readJson(`${unpackedDir}/modrinth.index.json`)
    const name = index.name || 'ModrinthPack'
    const mcVersion = index.dependencies?.minecraft || ''
    const modLoaderType = index.dependencies?.['fabric-loader'] ? 'fabric'
      : index.dependencies?.forge ? 'forge'
      : index.dependencies?.['quilt-loader'] ? 'quilt'
      : index.dependencies?.neoforge ? 'neoforge'
      : undefined
    const modLoaderVer = modLoaderType ? index.dependencies[modLoaderType === 'fabric' ? 'fabric-loader' : modLoaderType === 'quilt' ? 'quilt-loader' : modLoaderType] : undefined

    // 将 overrides/ 内容覆盖到 .minecraft/
    const overridesDir = `${unpackedDir}/overrides`
    onProgress?.({ step: '应用 overrides', current: 0, total: 1 })
    await copyOverrideToMc(overridesDir)

    // 下载 mods (这里只下载 URL 可访问的, 本地已有的跳过)
    const files: any[] = index.files || []
    const modsDir = `${MINECRAFT_DIR}/mods`
    await ensureDir(modsDir)
    onProgress?.({ step: '准备 mods', current: 0, total: files.length })

    // 由于下载需要网络, 这里只将 .mrpack 内已有的 mods 复制到 mods 目录
    // 真实下载留给 version store 的资源下载流程
    let installedMods = 0
    const modsInOverrides = `${overridesDir}/mods`
    try {
      const listed = await listDirEntries(modsInOverrides)
      for (const m of listed) {
        if (m.isFile && m.name.endsWith('.jar')) {
          const dest = `${modsDir}/${m.name}`
          try {
            await copyFileSafe(`${modsInOverrides}/${m.name}`, dest)
            installedMods++
          } catch (e) {
            console.warn('[Modpack] copy mod failed', m.name, e)
          }
        }
      }
    } catch (e) {
      // overrides 没有 mods 子目录
    }

    // 创建版本目录标识
    const versionId = `${mcVersion}-${name}`.replace(/\s+/g, '_')
    const versionDir = `${MINECRAFT_DIR}/versions/${versionId}`
    await ensureDir(versionDir)
    await writeVersionJson(versionDir, versionId, mcVersion, modLoaderType, modLoaderVer)

    // 清理解压目录
    try { await deleteFile(unpackedDir, true) } catch {}

    return {
      success: true,
      format: 'modrinth',
      name,
      destDir: versionDir,
      modCount: installedMods,
    }
  } catch (e: any) {
    return {
      success: false,
      format: 'modrinth',
      name: info.name,
      destDir: unpackedDir,
      modCount: 0,
      error: e.message
    }
  }
}

/** 安装 CurseForge 整合包 */
async function installCurseforge(
  unpackedDir: string,
  info: ModpackInfo,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  try {
    onProgress?.({ step: '解析 manifest.json', current: 0, total: 1 })
    const manifest = await readJson(`${unpackedDir}/manifest.json`)
    const name = manifest.name || 'CurseForgePack'
    const mcVersion = manifest.minecraft?.version || ''
    const modLoader = manifest.minecraft?.modLoaders?.[0]
    const modLoaderId = modLoader?.id || ''  // 例如 "fabric-0.15.7" 或 "forge-47.2.0"
    let modLoaderType: string | undefined
    let modLoaderVer: string | undefined
    if (modLoaderId) {
      const [t, v] = modLoaderId.split('-')
      modLoaderType = t
      modLoaderVer = v
    }

    // 应用 overrides/ 到 .minecraft/
    const overridesDir = `${unpackedDir}/overrides`
    onProgress?.({ step: '应用 overrides', current: 0, total: 1 })
    await copyOverrideToMc(overridesDir)

    // manifest 中的 mods 通常只有 projectID + fileID, 需要从 CurseForge API 下载
    // 这里只复制 overrides/mods 已有的 jar
    const modsDir = `${MINECRAFT_DIR}/mods`
    await ensureDir(modsDir)
    let installedMods = 0
    const modsInOverrides = `${overridesDir}/mods`
    try {
      const listed = await listDirEntries(modsInOverrides)
      for (const m of listed) {
        if (m.isFile && m.name.endsWith('.jar')) {
          const dest = `${modsDir}/${m.name}`
          try {
            await copyFileSafe(`${modsInOverrides}/${m.name}`, dest)
            installedMods++
          } catch (e) {
            console.warn('[Modpack] copy mod failed', m.name, e)
          }
        }
      }
    } catch (e) {
      // 没有 mods 子目录
    }

    // 创建版本目录
    const versionId = `${mcVersion}-${name}`.replace(/\s+/g, '_')
    const versionDir = `${MINECRAFT_DIR}/versions/${versionId}`
    await ensureDir(versionDir)
    await writeVersionJson(versionDir, versionId, mcVersion, modLoaderType, modLoaderVer)

    // 清理
    try { await deleteFile(unpackedDir, true) } catch {}

    return {
      success: true,
      format: 'curseforge',
      name,
      destDir: versionDir,
      modCount: installedMods
    }
  } catch (e: any) {
    return {
      success: false,
      format: 'curseforge',
      name: info.name,
      destDir: unpackedDir,
      modCount: 0,
      error: e.message
    }
  }
}

/** 安装通用 zip (作为新版本目录) */
async function installPlain(
  unpackedDir: string,
  info: ModpackInfo,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  onProgress?.({ step: '完成安装', current: 1, total: 1 })
  return {
    success: true,
    format: 'plain',
    name: info.name,
    destDir: unpackedDir,
    modCount: 0
  }
}

/** 将 overrides 目录递归复制到 .minecraft/ */
async function copyOverrideToMc(overridesDir: string): Promise<void> {
  // #ifdef APP-PLUS
  try {
    const fs = plus.io.getFileSystemManager()
    const access = () => copyDirRecursive(overridesDir, MINECRAFT_DIR)
    await new Promise<void>((resolve, reject) => {
      fs.access({
        path: overridesDir,
        success: () => resolve(),
        fail: () => resolve()  // 没有 overrides 也允许
      })
    })
    await access()
  } catch (e) {
    console.warn('[Modpack] copyOverrideToMc failed', e)
  }
  // #endif
}

/** 递归复制目录 */
async function copyDirRecursive(srcDir: string, destDir: string): Promise<void> {
  // #ifdef APP-PLUS
  const fs = plus.io.getFileSystemManager()
  await ensureDir(destDir)
  const entries = await listDirEntries(srcDir)
  for (const entry of entries) {
    const srcPath = `${srcDir}/${entry.name}`
    const destPath = `${destDir}/${entry.name}`
    if (entry.isDirectory) {
      await copyDirRecursive(srcPath, destPath)
    } else {
      try {
        await copyFileSafe(srcPath, destPath)
      } catch (e) {
        console.warn('[Modpack] copy file failed', srcPath, e)
      }
    }
  }
  // #endif
}

/** 列出目录条目 (含 isFile / isDirectory) */
function listDirEntries(dirPath: string): Promise<{ name: string; isFile: boolean; isDirectory: boolean }[]> {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    try {
      const fs = plus.io.getFileSystemManager()
      fs.readdir({
        dirPath,
        success: (res: any) => {
          const items: any[] = res.entries || res || []
          const result: { name: string; isFile: boolean; isDirectory: boolean }[] = []
          let pending = items.length
          if (pending === 0) { resolve(result); return }
          for (const it of items) {
            const name = it?.name || String(it)
            if (!name || name === '.' || name === '..') { pending--; if (pending === 0) resolve(result); continue }
            const fullPath = `${dirPath}/${name}`
            fs.stat({
              path: fullPath,
              success: (statRes: any) => {
                const stat = statRes.stats || statRes
                result.push({ name, isFile: !!stat.isFile, isDirectory: !!stat.isDirectory })
                pending--
                if (pending === 0) resolve(result)
              },
              fail: () => {
                result.push({ name, isFile: true, isDirectory: false })
                pending--
                if (pending === 0) resolve(result)
              }
            })
          }
        },
        fail: (e: any) => reject(new Error(e.message))
      })
    } catch (e: any) {
      reject(e)
    }
    // #endif
    // #ifndef APP-PLUS
    resolve([])
    // #endif
  })
}

/** 安全复制文件 (覆盖目标) */
function copyFileSafe(srcPath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    try {
      const fs = plus.io.getFileSystemManager()
      // 确保 dest 目录存在
      const destDir = destPath.substring(0, destPath.lastIndexOf('/'))
      fs.access({
        path: destDir,
        success: () => doCopy(),
        fail: () => {
          fs.mkdir({
            dirPath: destDir,
            recursive: true,
            success: doCopy,
            fail: (e: any) => reject(new Error(e.message))
          })
        }
      })
      function doCopy() {
        fs.copyFile({
          srcPath,
          destPath,
          success: () => resolve(),
          fail: (e: any) => reject(new Error(e.message))
        })
      }
    } catch (e: any) {
      reject(e)
    }
    // #endif
    // #ifndef APP-PLUS
    resolve()
    // #endif
  })
}

/** 写入版本 json 占位文件, 让启动器识别 */
function writeVersionJson(
  versionDir: string,
  versionId: string,
  mcVersion: string,
  modLoaderType?: string,
  modLoaderVer?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    try {
      const fs = plus.io.getFileSystemManager()
      const data = {
        id: versionId,
        time: new Date().toISOString(),
        releaseTime: new Date().toISOString(),
        type: 'release',
        mainClass: modLoaderType === 'fabric' ? 'net.fabricmc.loader.launch.knot.Client' : 'net.minecraft.client.main.Main',
        inheritsFrom: mcVersion,
        minecraftArguments: '--username ${auth_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --versionType ${version_type}',
        libraries: [],
        jar: mcVersion
      }
      fs.writeFile({
        filePath: `${versionDir}/${versionId}.json`,
        data: JSON.stringify(data, null, 2),
        encoding: 'utf-8',
        success: () => resolve(),
        fail: (e: any) => reject(new Error(e.message))
      })
    } catch (e: any) {
      reject(e)
    }
    // #endif
    // #ifndef APP-PLUS
    resolve()
    // #endif
  })
}
