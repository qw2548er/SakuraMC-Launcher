/**
 * Mojang API 与微软 OAuth
 * 微软登录采用 Device Code Flow,前端只需要:
 *  1) POST https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode
 *  2) 用户去 https://microsoft.com/devicelogin 输入 user_code
 *  3) 轮询 POST https://login.microsoftonline.com/consumers/oauth2/v2.0/token
 *  4) 拿到 access_token 后调用 Xbox Live + XSTS + Minecraft API
 */

const MS_TENANT = 'consumers'
// 注: 生产环境需在 Azure 申请自己的 client_id 并替换
// 此处为占位, MVP 阶段会显示登录错误提示用户
const MS_CLIENT_ID = '00000000-0000-0000-0000-000000000000'
const MS_SCOPE = 'offline_access XboxLive.signin'
const MS_DEVICE_CODE_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/devicecode`
const MS_TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`
const XBL_AUTH_URL = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_AUTH_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const MC_LOGIN_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile'
const MC_ENTITLEMENTS_URL = 'https://api.minecraftservices.com/entitlements/mcstore'
const MOJANG_API = 'https://api.mojang.com'
const MOJANG_SESSIONSERVER = 'https://sessionserver.mojang.com'

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
  message: string
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

export interface MCProfile {
  id: string
  name: string
  skins?: { id: string; state: string; url: string; variant?: string }[]
  capes?: { id: string; state: string; url: string; alias?: string }[]
}

export interface AuthTokenPair {
  msAccessToken: string
  msRefreshToken: string
  expiresAt: number
  xblToken: string
  xstsToken: string
  userHash: string
  mcAccessToken: string
  expiresIn: number
}

/** 第一步: 请求设备码 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  return uni.request({
    url: MS_DEVICE_CODE_URL,
    method: 'POST',
    header: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `client_id=${MS_CLIENT_ID}&scope=${encodeURIComponent(MS_SCOPE)}`
  }).then((res: any) => res.data as DeviceCodeResponse)
}

/** 第二步: 轮询 token */
export async function pollDeviceToken(deviceCode: string): Promise<TokenResponse> {
  return uni.request({
    url: MS_TOKEN_URL,
    method: 'POST',
    header: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=${MS_CLIENT_ID}&device_code=${deviceCode}`
  }).then((res: any) => res.data as TokenResponse)
}

/** 第三步: 用 MS token 换 XBL */
export async function authenticateXBL(msAccessToken: string): Promise<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }> {
  return uni.request({
    url: XBL_AUTH_URL,
    method: 'POST',
    header: { 'Content-Type': 'application/json', Accept: 'application/json' },
    data: {
      Properties: {
        AuthMethod: 'RPC',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    }
  }).then((res: any) => res.data)
}

/** 第四步: 用 XBL 换 XSTS */
export async function authenticateXSTS(xblToken: string): Promise<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }> {
  return uni.request({
    url: XSTS_AUTH_URL,
    method: 'POST',
    header: { 'Content-Type': 'application/json', Accept: 'application/json' },
    data: {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rpc://api.minecraftservices.com/',
      TokenType: 'JWT'
    }
  }).then((res: any) => res.data)
}

/** 第五步: 用 XSTS 换 MC token */
export async function authenticateMC(userHash: string, xstsToken: string): Promise<{ access_token: string; expires_in: number }> {
  return uni.request({
    url: MC_LOGIN_URL,
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: { identityToken: `XBL3.0 x=${userHash};${xstsToken}` }
  }).then((res: any) => res.data)
}

/** 第六步: 检查账号是否拥有 MC */
export async function checkMCEntitlements(mcToken: string): Promise<{ items: { name: string; signature: string }[] }> {
  return uni.request({
    url: MC_ENTITLEMENTS_URL,
    header: { Authorization: `Bearer ${mcToken}` }
  }).then((res: any) => res.data)
}

/** 第七步: 获取 MC 档案 */
export async function getMCProfile(mcToken: string): Promise<MCProfile> {
  return uni.request({
    url: MC_PROFILE_URL,
    header: { Authorization: `Bearer ${mcToken}` }
  }).then((res: any) => res.data as MCProfile)
}

/** 完整微软登录流程 */
export async function microsoftLogin(msAccessToken: string): Promise<{ profile: MCProfile; tokens: AuthTokenPair; hasGame: boolean }> {
  const xbl = await authenticateXBL(msAccessToken)
  const xblToken = xbl.Token
  const userHash = xbl.DisplayClaims.xui[0].uhs
  const xsts = await authenticateXSTS(xblToken)
  const xstsToken = xsts.Token
  const mcAuth = await authenticateMC(userHash, xstsToken)
  const mcAccessToken = mcAuth.access_token
  const ent = await checkMCEntitlements(mcAccessToken)
  const hasGame = ent.items?.some(i => i.name === 'game_minecraft') ?? false
  const profile = hasGame ? await getMCProfile(mcAccessToken) : null
  return {
    profile: profile as unknown as MCProfile,
    hasGame,
    tokens: {
      msAccessToken,
      msRefreshToken: '',
      expiresAt: Date.now() + mcAuth.expires_in * 1000,
      xblToken,
      xstsToken,
      userHash,
      mcAccessToken,
      expiresIn: mcAuth.expires_in
    }
  }
}

/** 用 refresh_token 续期 */
export async function refreshMSToken(refreshToken: string): Promise<TokenResponse> {
  return uni.request({
    url: MS_TOKEN_URL,
    method: 'POST',
    header: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `client_id=${MS_CLIENT_ID}&grant_type=refresh_token&refresh_token=${refreshToken}&scope=${encodeURIComponent(MS_SCOPE)}`
  }).then((res: any) => res.data as TokenResponse)
}

/** 离线 UUID (稳定,基于用户名生成) */
export function offlineUUID(username: string): string {
  // 简化版: 使用固定命名空间 + SHA-1 替代方案 (不依赖加密库)
  // 实际 UUID 来自 Mojang 的离线算法,这里使用确定性的伪UUID
  const ns = 'OfflinePlayer:'
  const full = ns + username
  let h1 = 0x811c9dc5
  for (let i = 0; i < full.length; i++) {
    h1 ^= full.charCodeAt(i)
    h1 = (h1 + ((h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24))) >>> 0
  }
  const hex = h1.toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-${hex.slice(0, 4)}-${hex}${hex.slice(0, 4)}`.slice(0, 36)
}

/** 微软皮肤渲染 URL (minecraftcapes.net / crafatar.com / mineskin) */
export function getSkinFaceUrl(uuid: string, size = 64): string {
  return `https://mc-heads.net/avatar/${uuid}/${size}.png`
}
export function getSkinBodyUrl(uuid: string): string {
  return `https://mc-heads.net/body/${uuid}`
}
export function getCapeUrl(uuid: string): string {
  return `https://mc-heads.net/cape/${uuid}`
}

/** Mojang 公会 API */
export const mojang = {
  status(): Promise<{ [key: string]: string }> {
    return uni.request({ url: 'https://status.mojang.com/check' }).then((r: any) => r.data[0])
  },
  versionManifest(): Promise<any> {
    return uni.request({ url: `${MOJANG_API}/updates/minecraft/version_manifest_v2.json` }).then((r: any) => r.data)
  }
}
