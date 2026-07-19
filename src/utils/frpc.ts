/**
 * frpc 进程管理 (H5 端为模拟控制,实际进程需在 PC 端启动)
 * 真实部署建议: PC 端用 Tauri/Electron 包装, 移动端用 WebSocket 连接 PC 客户端
 */
import type { IFrpTunnel, IFrpNode } from '@/types'
import { getFrpcDownloadUrl, NATFRP_BASE } from '@/api/natfrp'
import { detectPlatform } from './format'

export interface FrpcConfig {
  serverAddr: string
  serverPort: number
  token: string
  tunnels: IFrpTunnel[]
  logLevel: string
}

export function generateFrpcIni(node: IFrpNode, tunnel: IFrpTunnel, userToken: string): string {
  const commonLines = [
    '[common]',
    `server_addr = ${node.hostname}`,
    `server_port = ${node.port}`,
    `token = ${userToken}`,
    'log_level = info',
    'log_file = ./frpc.log',
    'log_max_days = 3'
  ]
  if (tunnel.useCompression) commonLines.push('use_compression = true')
  if (tunnel.useEncryption) commonLines.push('use_encryption = true')

  const tunnelLines = [
    '',
    `[${tunnel.name}]`,
    `type = ${tunnel.type}`,
    `local_ip = ${tunnel.localIp}`,
    `local_port = ${tunnel.localPort}`
  ]
  if (tunnel.type === 'tcp' || tunnel.type === 'udp') {
    tunnelLines.push(`remote_port = ${tunnel.remotePort || 0}`)
  }
  if (tunnel.type === 'http' || tunnel.type === 'https') {
    tunnelLines.push(`custom_domains = ${tunnel.domain || ''}`)
  }

  return commonLines.concat(tunnelLines).join('\n') + '\n'
}

/** 生成 frpc 启动命令 */
export function generateFrpcCommand(iniPath: string, binaryPath: string = 'frpc'): string {
  return `${binaryPath} -c ${iniPath}`
}

/** 樱花 frpc 二进制下载 URL
 * iOS 端无法直接运行 frpc, 返回 PC 端 (windows amd64) 下载链接供用户在 PC 上下载
 */
export function getFrpcBinaryUrl(): string {
  const platform = detectPlatform()
  if (platform === 'android') {
    return getFrpcDownloadUrl('android', 'arm64')
  }
  if (platform === 'ios') {
    // iOS 无法运行 frpc, 引导用户在 PC 上下载
    return getFrpcDownloadUrl('windows', 'amd64')
  }
  if (platform === 'windows' || platform === 'macos' || platform === 'linux') {
    return getFrpcDownloadUrl(platform, 'amd64')
  }
  return getFrpcDownloadUrl('linux', 'amd64')
}

/** 检测 frpc 二进制是否可用 (H5 端只能给提示) */
export function checkFrpcAvailable(): boolean {
  // 浏览器内无 fs,只能提示用户
  return false
}

/** 生成隧道对外可访问的地址 */
export function getTunnelAddress(node: IFrpNode, tunnel: IFrpTunnel): string {
  if (tunnel.type === 'http' || tunnel.type === 'https') {
    return `${tunnel.domain || 'unset'}.${node.hostname.split('.')[0]}.frp.natfrp.cloud`
  }
  return `${node.hostname}:${tunnel.remotePort || 0}`
}

/** MC 服务器穿透快查表 */
export const TUNNEL_PRESETS = [
  { name: 'MC Java版', localPort: 25565, type: 'tcp' as const, note: 'Minecraft Java版默认端口' },
  { name: 'MC 基岩版', localPort: 19132, type: 'udp' as const, note: 'Minecraft Bedrock默认端口' },
  { name: 'Web 管理', localPort: 8080, type: 'http' as const, note: 'HTTP Web 服务' },
  { name: 'RDP 远程', localPort: 3389, type: 'tcp' as const, note: 'Windows 远程桌面' },
  { name: 'SSH', localPort: 22, type: 'tcp' as const, note: 'Linux SSH' },
  { name: 'MCSManager', localPort: 23333, type: 'tcp' as const, note: 'MCSManager 面板' }
]

export { NATFRP_BASE }
