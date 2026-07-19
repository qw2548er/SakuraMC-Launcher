/**
 * SakuraMC 目录结构初始化工具
 * 在手机本地 /storage/emulated/0/SakuraMC/ 创建完整的目录结构
 * 包括 .minecraft 及其所有重要的子目录和文件
 *
 * 注意: 本项目使用 uni-app H5 + Cordova 打包 APK, 没有 plus 对象.
 * 所有文件操作通过 cordova-plugin-file 和 SakuraMCCore 插件完成.
 */

import * as cfs from './cordova-fs'

// 樱花 MC 启动器根目录
export const SAKURA_ROOT = '/storage/emulated/0/SakuraMC'

// .minecraft 游戏目录
export const MINECRAFT_DIR = `${SAKURA_ROOT}/.minecraft`

// 按键布局目录
export const CONTROL_DIR = `${SAKURA_ROOT}/control`

// Java 运行时目录
export const JAVA_DIR = `${SAKURA_ROOT}/java`

// 樱花穿透配置目录
export const FRP_DIR = `${SAKURA_ROOT}/frp`

// 启动器配置目录
export const LAUNCHER_CONFIG_DIR = `${SAKURA_ROOT}/config`

// 启动器缓存目录
export const LAUNCHER_CACHE_DIR = `${SAKURA_ROOT}/cache`

// 启动器日志目录
export const LAUNCHER_LOGS_DIR = `${SAKURA_ROOT}/logs`

// 皮肤目录
export const SKINS_DIR = `${SAKURA_ROOT}/skins`

// 下载临时目录
export const DOWNLOADS_DIR = `${SAKURA_ROOT}/downloads`

/**
 * .minecraft 目录下所有重要的子目录
 * 这些目录是 Minecraft 运行所必需的
 */
export const MINECRAFT_SUBDIRS = [
  'versions',
  'mods',
  'resourcepacks',
  'texturepacks',
  'saves',
  'screenshots',
  'logs',
  'shaderpacks',
  'config',
  'libraries',
  'assets',
  'assets/objects',
  'assets/indexes',
  'assets/virtual',
  'crash-reports',
  'schematics',
  'stat',
  'playerdata',
  'region',
  'data',
  'DIM-1',
  'DIM1',
  'backup',
  'servers',
  'local',
  'realms',
  'presets',
  'options',
  'fontpatcher',
  'jarmods',
  'coremods',
  'asm',
  'scripts',
  'launcher_profiles',
]

/**
 * 樱花 MC 根目录下所有重要的子目录
 */
export const SAKURA_SUBDIRS = [
  '.minecraft',
  'control',
  'java',
  'frp',
  'config',
  'cache',
  'logs',
  'skins',
  'downloads',
  'backups',
  'temp',
]

interface DefaultFile {
  path: string
  content: string
  description: string
}

export const DEFAULT_FILES: DefaultFile[] = [
  {
    path: 'launcher_profiles.json',
    content: JSON.stringify({
      profiles: {
        SakuraMC: {
          name: 'SakuraMC',
          type: 'custom',
          created: new Date().toISOString(),
          lastVersionId: '',
          javaDir: '',
          gameDir: MINECRAFT_DIR,
          resolution: { width: 1280, height: 720 },
          extraArguments: [],
          javaArgs: ['-Xmx2G', '-XX:+UseG1GC']
        }
      },
      selectedProfile: 'SakuraMC',
      clientToken: generateToken()
    }, null, 2),
    description: '启动器配置文件'
  },
  {
    path: 'options.txt',
    content: `# Minecraft 选项 - 由 SakuraMC 启动器生成
lang:zh_CN
chatScale:1.0
chatWidthScale:1.0
chatHeightUnfocused:0.44366197
chatHeightFocused:1.0
mipmapLevels:4
fullscreen:false
renderDistance:12
fov:70.0
gamma:0.5
saturation:0.0
bobView:true
anisotropicFiltering:1
ao:2
viewBobbing:true
attackIndicator:1
showSubtitles:false
fancyGraphics:true
ao:true
renderClouds:true
maxFps:120
particles:0
fboEnable:true
enableVsync:false
useVbo:true
glsl_version:110
grafity:false
hideGui:false
invertMouse:false
sensitivity:1.0
skipMultiplayerWarning:false
overrideWidth:0
overrideHeight:0
heldItemTooltips:true
advancedItemTooltips:false
pauseOnLostFocus:true
touchscreen:false
advancedOpengl:false
overrideFps:120
enableWeakAttacks:false
showInventoryAchievement:true
lastServer:
soundCategory_master:1.0
soundCategory_music:1.0
soundCategory_record:1.0
soundCategory_weather:1.0
soundCategory_block:1.0
soundCategory_hostile:1.0
soundCategory_neutral:1.0
soundCategory_player:1.0
soundCategory_ambient:1.0
soundCategory_voice:1.0
key_key.attack:-100
key_key.use:-99
key_key.forward:17
key_key.left:30
key_key.back:31
key_key.right:32
key_key.jump:57
key_key.sneak:42
key_key.drop:16
key_key.inventory:18
key_key.chat:20
key_key.playerlist:25
key_key.pickItem:-98
key_key.command:53
key_key.screenshot:60
key_key.togglePerspective:63
key_key.smoothCamera:65
key_key.fullscreen:87
key_key.spectatorOutlines:0
key_key.swapHands:33
key_key.saveToolbarActivator:46
key_key.loadToolbarActivator:45
key_key.advancements:38
key_key.hotbar.1:2
key_key.hotbar.2:3
key_key.hotbar.3:4
key_key.hotbar.4:5
key_key.hotbar.5:6
key_key.hotbar.6:7
key_key.hotbar.7:8
key_key.hotbar.8:9
key_key.hotbar.9:10
`,
    description: '游戏选项配置'
  },
  { path: 'servers.dat', content: JSON.stringify({ servers: [] }, null, 2), description: '服务器列表' },
  { path: 'realms_persistence.json', content: JSON.stringify({ pendingInvites: [], stage: 0 }, null, 2), description: 'Realms 持久化数据' },
  { path: 'usercache.json', content: '[]', description: '用户缓存' },
  { path: 'whitelist.json', content: '[]', description: '白名单' },
  { path: 'ops.json', content: '[]', description: '管理员列表' },
  { path: 'banned-players.json', content: '[]', description: '封禁玩家列表' },
  { path: 'banned-ips.json', content: '[]', description: '封禁 IP 列表' },
  { path: '.mcassetsroot', content: '', description: 'Minecraft 资源根标识' }
]

export const LAUNCHER_CONFIG_FILE = {
  path: `${LAUNCHER_CONFIG_DIR}/launcher.json`,
  content: JSON.stringify({
    name: 'SakuraMC',
    version: '0.5.1',
    createdAt: new Date().toISOString(),
    minecraftDir: MINECRAFT_DIR,
    controlDir: CONTROL_DIR,
    javaDir: JAVA_DIR,
    frpDir: FRP_DIR,
    downloadDir: DOWNLOADS_DIR,
    lastLaunchVersion: null,
    lastLaunchTime: null,
    totalLaunchCount: 0
  }, null, 2),
  description: '启动器主配置文件'
}

function generateToken(): string {
  let token = ''
  const chars = '0123456789abcdef'
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

/**
 * 确保目录存在,不存在则递归创建
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await cfs.ensureDir(dirPath)
}

/**
 * 写入文件 (如果不存在)
 */
export async function writeFileIfNotExists(filePath: string, content: string): Promise<void> {
  const exists = await cfs.fileExists(filePath)
  if (exists) return
  const dir = filePath.substring(0, filePath.lastIndexOf('/'))
  await cfs.ensureDir(dir)
  await cfs.writeTextFile(filePath, content)
}

/**
 * 初始化所有目录和文件
 */
export async function initializeSakuraMC(): Promise<{
  success: boolean
  createdDirs: string[]
  createdFiles: string[]
  errors: string[]
}> {
  const createdDirs: string[] = []
  const createdFiles: string[] = []
  const errors: string[] = []

  console.log('[Setup] 开始初始化 SakuraMC 目录结构...')

  for (const dir of SAKURA_SUBDIRS) {
    const fullPath = `${SAKURA_ROOT}/${dir}`
    try {
      await ensureDir(fullPath)
      createdDirs.push(fullPath)
    } catch (e: any) {
      errors.push(`目录创建失败 ${fullPath}: ${e.message}`)
    }
  }

  for (const dir of MINECRAFT_SUBDIRS) {
    const fullPath = `${MINECRAFT_DIR}/${dir}`
    try {
      await ensureDir(fullPath)
      createdDirs.push(fullPath)
    } catch (e: any) {
      errors.push(`子目录创建失败 ${fullPath}: ${e.message}`)
    }
  }

  for (const file of DEFAULT_FILES) {
    const fullPath = `${MINECRAFT_DIR}/${file.path}`
    try {
      await writeFileIfNotExists(fullPath, file.content)
      createdFiles.push(fullPath)
    } catch (e: any) {
      errors.push(`文件创建失败 ${fullPath}: ${e.message}`)
    }
  }

  try {
    await ensureDir(LAUNCHER_CONFIG_DIR)
    await writeFileIfNotExists(LAUNCHER_CONFIG_FILE.path, LAUNCHER_CONFIG_FILE.content)
    createdFiles.push(LAUNCHER_CONFIG_FILE.path)
  } catch (e: any) {
    errors.push(`启动器配置失败: ${e.message}`)
  }

  try {
    const versionsReadme = `${MINECRAFT_DIR}/versions/README.txt`
    await writeFileIfNotExists(versionsReadme, `SakuraMC 版本目录
========================

此目录用于存放 Minecraft 游戏版本文件。

每个版本都需要:
  <版本号>/
    <版本号>.jar    (游戏主程序)
    <版本号>.json   (版本元数据)

下载方法:
  1. 在软件中点击「版本」→ 选择版本 → 下载
  2. 手动下载后放入此目录

版本号示例:
  1.20.4
  1.20.4-Forge-47.2.0
  1.20.4-Fabric-0.15.7

只要此目录内有正确的游戏版本,就可以在启动器中点击「启动游戏」直接运行。

由 SakuraMC 启动器自动创建于 ${new Date().toLocaleString('zh-CN')}
`)
    createdFiles.push(versionsReadme)
  } catch (e: any) {
    errors.push(`版本说明创建失败: ${e.message}`)
  }

  try {
    const controlReadme = `${CONTROL_DIR}/README.txt`
    await writeFileIfNotExists(controlReadme, `SakuraMC 按键布局目录
========================

此目录用于存放按键布局配置文件 (JSON 格式)。

每个布局文件包含完整的按键绑定,可以在软件的「按键」页面中编辑。

文件命名建议:
  default.json       - 默认布局
  custom-1.json      - 自定义布局 1
  pvp.json           - PvP 布局
  builder.json       - 建筑布局

由 SakuraMC 启动器自动创建于 ${new Date().toLocaleString('zh-CN')}
`)
    createdFiles.push(controlReadme)
  } catch (e: any) {
    errors.push(`按键布局说明创建失败: ${e.message}`)
  }

  console.log(`[Setup] 初始化完成: 创建 ${createdDirs.length} 个目录, ${createdFiles.length} 个文件, ${errors.length} 个错误`)

  return {
    success: errors.length === 0,
    createdDirs,
    createdFiles,
    errors
  }
}

export function getDirectoryInfo() {
  return [
    { path: MINECRAFT_DIR, name: '.minecraft', icon: '🎮', description: 'Minecraft 游戏主目录', important: true },
    { path: `${MINECRAFT_DIR}/versions`, name: 'versions', icon: '📦', description: '游戏版本', important: true },
    { path: `${MINECRAFT_DIR}/mods`, name: 'mods', icon: '🧩', description: '模组', important: true },
    { path: `${MINECRAFT_DIR}/saves`, name: 'saves', icon: '💾', description: '游戏存档', important: true },
    { path: `${MINECRAFT_DIR}/resourcepacks`, name: 'resourcepacks', icon: '🎨', description: '资源包', important: true },
    { path: `${MINECRAFT_DIR}/shaderpacks`, name: 'shaderpacks', icon: '✨', description: '光影包', important: true },
    { path: `${MINECRAFT_DIR}/screenshots`, name: 'screenshots', icon: '📷', description: '游戏截图', important: true },
    { path: `${MINECRAFT_DIR}/logs`, name: 'logs', icon: '📝', description: '游戏日志', important: true },
    { path: `${MINECRAFT_DIR}/config`, name: 'config', icon: '⚙️', description: '模组配置文件', important: true },
    { path: `${MINECRAFT_DIR}/libraries`, name: 'libraries', icon: '📚', description: '依赖库', important: true },
    { path: `${MINECRAFT_DIR}/assets`, name: 'assets', icon: '🗂️', description: '游戏资源文件', important: true },
    { path: `${MINECRAFT_DIR}/crash-reports`, name: 'crash-reports', icon: '💥', description: '崩溃报告', important: false },
    { path: `${MINECRAFT_DIR}/schematics`, name: 'schematics', icon: '🏗️', description: '建筑图纸', important: false },
    { path: CONTROL_DIR, name: 'control', icon: '⌨️', description: '按键布局', important: true },
    { path: JAVA_DIR, name: 'java', icon: '☕', description: 'Java 运行时', important: true },
    { path: FRP_DIR, name: 'frp', icon: '🌐', description: '樱花穿透配置', important: true },
    { path: LAUNCHER_CONFIG_DIR, name: 'config', icon: '🔧', description: '启动器配置', important: true },
    { path: DOWNLOADS_DIR, name: 'downloads', icon: '⬇️', description: '下载临时目录', important: false },
    { path: SKINS_DIR, name: 'skins', icon: '👤', description: '皮肤', important: false }
  ]
}

export function isInitialized(): boolean {
  return uni.getStorageSync('sakuram.setup.done') === true
}

export function markInitialized() {
  uni.setStorageSync('sakuram.setup.done', true)
  uni.setStorageSync('sakuram.setup.time', Date.now())
}

/**
 * 列出目录内容
 */
export async function listDirectory(dirPath: string): Promise<Array<{
  name: string
  path: string
  isDir: boolean
  size: number
  lastModified: number
}>> {
  return cfs.listDirectory(dirPath)
}

/**
 * 读取文件内容
 */
export async function readFileText(filePath: string): Promise<string> {
  return cfs.readTextFile(filePath)
}

/**
 * 删除文件或目录
 */
export async function deleteFile(filePath: string, recursive: boolean = true): Promise<void> {
  await cfs.deletePath(filePath, recursive)
}
