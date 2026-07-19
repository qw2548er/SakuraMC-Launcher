// 通用类型定义
export interface IAccount {
  id: string
  type: 'microsoft' | 'offline' | 'yggdrasil'
  username: string
  uuid: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  avatarUrl?: string
  skinUrl?: string
  createdAt: number
  lastUsedAt?: number
}

export interface IGameVersion {
  id: string
  type: 'release' | 'snapshot' | 'modded' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
  installed?: boolean
  installedPath?: string
  iconUrl?: string
  size?: number
  hasForge?: boolean
  hasFabric?: boolean
  hasOptifine?: boolean
}

export interface IModLoader {
  type: 'forge' | 'fabric' | 'quilt' | 'optifine' | 'neoforge'
  version: string
  mcVersion: string
  installed: boolean
  installedPath?: string
}

export interface IServer {
  id: string
  name: string
  host: string
  port: number
  version: string
  type: 'vanilla' | 'paper' | 'spigot' | 'forge' | 'fabric' | 'bedrock'
  core: string
  iconUrl?: string
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'unknown'
  players?: { online: number; max: number; sample?: { name: string; id: string }[] }
  ping?: number
  motd?: string
  local?: boolean
  frpTunnelId?: number
}

export interface IFrpAccount {
  id: string
  username: string
  token: string
  loginAt: number
  expireAt?: number
  userInfo?: IFrpUserInfo
}

export interface IFrpUserInfo {
  id: number
  username: string
  email?: string
  bandwidth?: number
  traffic?: number
  usedTraffic?: number
  frpToken?: string
  group?: string
}

export interface IFrpNode {
  id: number
  name: string
  hostname: string
  port: number
  protocol: 'tcp' | 'udp' | 'http' | 'https'
  bandwidth?: number
  flag?: string
  region?: string
  status: 'online' | 'offline' | 'maintenance'
  latency?: number
  usedBandwidth?: number
  bandwidthLimit?: number
  allowChinese?: boolean
  group?: string
}

export interface IFrpTunnel {
  id: number
  name: string
  type: 'tcp' | 'udp' | 'http' | 'https'
  node: number
  nodeName?: string
  localIp: string
  localPort: number
  remotePort?: number
  domain?: string
  useCompression: boolean
  useEncryption: boolean
  status?: 'running' | 'stopped' | 'error'
  online?: boolean
  trafficIn?: number
  trafficOut?: number
  todayTrafficIn?: number
  todayTrafficOut?: number
}

export interface ISettings {
  javaPath: string
  defaultMemory: number
  maxMemory: number
  minMemory: number
  downloadSource: 'mojang' | 'bmcl' | 'mcbbs'
  // FCL 风格路径配置
  gameDir: string                    // 游戏主目录 (第一个路径名: SakuraMC 游戏目录)
  versionsDir: string                // 版本目录 (versions)
  modsDir: string                    // 模组目录 (mods)
  resourcepacksDir: string           // 资源包目录 (resourcepacks)
  savesDir: string                   // 存档目录 (saves)
  screenshotsDir: string             // 截图目录 (screenshots)
  logsDir: string                    // 日志目录 (logs)
  shaderpacksDir: string             // 光影包目录 (shaderpacks)
  showSnapshots: boolean
  showOldVersions: boolean
  fullscreen: boolean
  autoJoinServer: boolean
  autoInstallForge: boolean
  autoInstallFabric: boolean
  autoInstallOptifine: boolean
  theme: 'dark' | 'light' | 'auto'
  language: 'zh-CN' | 'zh-TW' | 'en-US'
  frpcBinaryPath: string
  frpcLogLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error'
  ignoredVersion: string
  autoCheckUpdate: boolean
  // 自定义 JVM 参数
  customJvmArgs: string
  customGameArgs: string
  windowWidth: number
  windowHeight: number
  serverAddress: string
  javaArgs: string
  // 启动器自定义背景图路径 (绝对路径)
  backgroundImagePath?: string
  // 是否使用自定义背景图
  useCustomBackground?: boolean
}

export interface IAppUpdate {
  version: string
  name: string
  body: string
  html_url: string
  published_at: string
  prerelease: boolean
  assets: {
    name: string
    browser_download_url: string
    size: number
  }[]
}

export interface IDownloadTask {
  id: string
  name: string
  url: string
  total: number
  downloaded: number
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error'
  error?: string
  savePath?: string
  speed?: number
  /** 是否正在校验 SHA1 */
  verifying?: boolean
  /** 是否已通过 SHA1 校验 */
  verified?: boolean
  /** 期望的 SHA1 (用于完整性校验) */
  expectedSha1?: string
}
