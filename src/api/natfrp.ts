/**
 * 樱花穿透 (Sakura Frp / NATFRP) API
 * https://api.natfrp.com/v4/
 */

const NATFRP_BASE = 'https://api.natfrp.com/v4'
const NATFRP_HOST = 'https://natfrp.com'

export interface NatFrpApiResponse<T = any> {
  code: number
  msg?: string
  data?: T
  [k: string]: any
}

export class NatFrpError extends Error {
  code: number
  constructor(code: number, msg: string) {
    super(msg)
    this.code = code
  }
}

async function request<T = any>(path: string, options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: any; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers['Authorization'] = options.token
  return new Promise((resolve, reject) => {
    uni.request({
      url: NATFRP_BASE + path,
      method: options.method || 'GET',
      header: headers,
      data: options.body,
      timeout: 15000,
      success: (res: any) => {
        const body = res.data as NatFrpApiResponse<T>
        if (body && typeof body.code === 'number' && body.code !== 0) {
          reject(new NatFrpError(body.code, body.msg || `请求失败 code=${body.code}`))
        } else {
          resolve((body.data ?? body) as T)
        }
      },
      fail: (err: any) => reject(new Error(err.errMsg || '网络错误'))
    })
  })
}

/** 1. 用户登录 (账号+密码) */
export async function login(username: string, password: string): Promise<{ token: string; expire: number }> {
  return request<{ token: string; expire: number }>('/auth/login', {
    method: 'POST',
    body: { username, password }
  })
}

/** 2. 登出 */
export async function logout(token: string): Promise<void> {
  return request('/auth/logout', { method: 'POST', token })
}

/** 3. 用户信息 */
export async function getUserInfo(token: string) {
  return request('/user/info', { token })
}

/** 4. 流量信息 */
export async function getTraffic(token: string) {
  return request('/user/traffic', { token })
}

/** 5. 节点列表 */
export async function getNodes(token: string) {
  return request<any[]>('/nodes', { token })
}

/** 6. 我的隧道 */
export async function getTunnels(token: string) {
  return request<any[]>('/tunnels', { token })
}

/** 7. 创建隧道 */
export async function createTunnel(token: string, data: Partial<{
  name: string
  type: 'tcp' | 'udp' | 'http' | 'https'
  node: number
  local_ip: string
  local_port: number
  remote_port: number
  domain: string
  use_compression: boolean
  use_encryption: boolean
}>) {
  return request('/tunnels', { method: 'POST', token, body: data })
}

/** 8. 修改隧道 */
export async function updateTunnel(token: string, id: number, data: any) {
  return request(`/tunnels/${id}`, { method: 'PUT', token, body: data })
}

/** 9. 删除隧道 */
export async function deleteTunnel(token: string, id: number) {
  return request(`/tunnels/${id}`, { method: 'DELETE', token })
}

/** 10. 隧道配置 (生成 frpc 配置文件) */
export async function getTunnelConfig(token: string, id: number): Promise<any> {
  return request(`/tunnels/${id}/config`, { token })
}

/** 11. 单个节点 */
export async function getNode(token: string, id: number) {
  return request(`/nodes/${id}`, { token })
}

/** 12. 节点延迟测试 (H5 无法直连 udp, 使用 HTTP ping) */
export async function pingNode(host: string, port: number): Promise<number> {
  const start = Date.now()
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 3000)
      uni.request({
        url: `https://${host}:${port}/`,
        method: 'GET',
        timeout: 3000,
        success: () => { clearTimeout(t); resolve() },
        fail: (e: any) => { clearTimeout(t); reject(e) }
      })
    })
    return Date.now() - start
  } catch {
    return -1
  }
}

/** 13. 检查用户名 */
export async function checkUsername(name: string): Promise<boolean> {
  try {
    const r: any = await request(`/auth/check?username=${encodeURIComponent(name)}`)
    return !!r?.available
  } catch {
    return false
  }
}

/** 14. 注册 */
export async function register(data: { username: string; password: string; email: string; code: string }) {
  return request('/auth/register', { method: 'POST', body: data })
}

/** 15. 实时状态 (frpc 进程是否运行) - H5 端通过心跳上报 */
export async function reportStatus(token: string, tunnelId: number, status: { online: boolean; traffic_in: number; traffic_out: number }) {
  return request(`/tunnels/${tunnelId}/status`, { method: 'POST', token, body: status })
}

/** 16. 获取节点分组 */
export async function getGroups(token: string) {
  return request('/groups', { token })
}

/** 17. 远程 frpc 配置 (用于第三方客户端拉取) */
export async function getRemoteConfig(token: string) {
  return request('/config', { token })
}

/** 检测 frpc 二进制下载 URL */
export function getFrpcDownloadUrl(platform: 'windows' | 'linux' | 'darwin' | 'android', arch: 'amd64' | 'arm64' | '386' | 'arm' = 'amd64'): string {
  const ext = platform === 'windows' ? 'zip' : 'gz'
  const file = `frpc_${platform}_${arch}.${ext}`
  return `${NATFRP_HOST}/download/${file}`
}

/** frpc GitHub 镜像 (备用) */
export function getFrpcGithubRelease(platform: 'windows' | 'linux' | 'darwin' | 'android', arch: 'amd64' | 'arm64' | '386' | 'arm' = 'amd64'): string {
  const suffix = platform === 'windows' ? 'windows' : platform
  return `https://github.com/fatedier/frp/releases/latest/download/frp_${suffix}_${arch}.zip`
}

export { NATFRP_BASE, NATFRP_HOST }
