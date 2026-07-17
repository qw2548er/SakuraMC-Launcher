/**
 * Java 运行时检测与下载
 */
import type { IDownloadTask } from '@/types'

export interface JvmInfo {
  version: number  // e.g. 8, 11, 17, 21
  vendor: 'adoptium' | 'azul' | 'oracle' | 'microsoft' | 'bellsoft'
  path: string
  bit: 32 | 64
}

export function recommendJavaVersion(mcVersion: string): number {
  const v = parseVersion(mcVersion)
  if (v.major >= 21) return 21
  if (v.major >= 17) return 17
  return 8
}

function parseVersion(s: string): { major: number; minor: number; patch: number } {
  const parts = s.split('.').map(p => parseInt(p, 10) || 0)
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 }
}

export function getAdoptiumDownloadUrl(version: number, platform: 'windows' | 'linux' | 'macos' = 'windows', arch: 'amd64' | 'arm64' = 'amd64'): string {
  const ext = platform === 'windows' ? 'zip' : 'tar.gz'
  return `https://github.com/adoptium/temurin${version}-binaries/releases/download/jdk-${version}%2B35/OpenJDK${version}U-jdk_${platform}_${arch}_hotspot_35_39.${ext}`
}

export function getAzulDownloadUrl(version: number, platform: 'windows' | 'linux' | 'macos' = 'windows', arch: 'amd64' | 'arm64' = 'amd64'): string {
  const ext = platform === 'windows' ? 'zip' : 'tar.gz'
  return `https://cdn.azul.com/zulu/bin/zulu${version}-ca-jdk${version}.0.1-linux_x64.tar.gz`
}

export async function detectSystemJava(): Promise<JvmInfo[]> {
  const list: JvmInfo[] = []
  // 浏览器无法枚举本地 java,只能让用户填写
  if (typeof window === 'undefined') return list
  // 尝试从 userAgent 推断
  return list
}

export function buildJvmMemoryConfig(min: number, max: number) {
  return {
    min: Math.max(512, Math.min(min, max - 512)),
    max: Math.max(1024, max),
    recommended: { min: 1024, max: 2048 }
  }
}
