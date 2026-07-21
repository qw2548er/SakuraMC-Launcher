import type { IAccount, IGameVersion, ISettings } from '@/types'
import { detectPlatform } from '@/utils/format'
import { resolveVersionJson, buildLaunchArgs as buildInstallLaunchArgs, type VersionJson } from '@/utils/install'

export interface LaunchContext {
  account: IAccount
  version: IGameVersion
  gameDir: string
  javaPath: string
  memory: { min: number; max: number }
  jvmArgs: string[]
  gameArgs: string[]
  resolution?: { width: number; height: number }
  fullscreen: boolean
}

export interface LaunchCommand {
  javaArgs: string[]
  classpath: string
  mainClass: string
  nativePath: string
  minecraftArgs: string[]
  fullCommand: string[]
  os: 'windows' | 'linux' | 'macos'
}

export interface LaunchResult {
  success: boolean
  command?: LaunchCommand
  error?: string
  exitCode?: number
}

export interface JavaInfo {
  path: string
  version: string
  arch: string
  vendor: string
}

export async function buildLaunchCommand(ctx: LaunchContext, gameDir: string = './.minecraft'): Promise<LaunchCommand> {
  const os = detectPlatform()
  const isWin = os === 'windows'
  const separator = isWin ? ';' : ':'
  
  let versionJson: VersionJson | null = null
  try {
    versionJson = await resolveVersionJson(ctx.version.id, 'bmcl', gameDir)
  } catch {
    console.warn('[Launcher] 无法获取版本 JSON, 使用默认配置')
  }

  const mainClass = versionJson?.mainClass || 'net.minecraft.client.main.Main'
  const assetsDir = `${gameDir}/assets`
  const libDir = `${gameDir}/libraries`
  const nativesDir = `${gameDir}/versions/${ctx.version.id}/natives`

  let classpath = ''
  if (versionJson) {
    const { classpath: cp } = buildInstallLaunchArgs({
      versionId: ctx.version.id,
      gameDir,
      minMemory: ctx.memory.min,
      maxMemory: ctx.memory.max,
      username: ctx.account.username,
      uuid: ctx.account.uuid,
      accessToken: ctx.account.accessToken || '0',
      versionType: ctx.version.type,
      width: ctx.resolution?.width || 854,
      height: ctx.resolution?.height || 480,
      fullscreen: ctx.fullscreen
    }, versionJson, gameDir)
    classpath = cp
  } else {
    classpath = [
      `${libDir}/*`,
      `${gameDir}/versions/${ctx.version.id}/${ctx.version.id}.jar`
    ].join(separator)
  }

  const javaArgs: string[] = [
    `-Xms${ctx.memory.min}M`,
    `-Xmx${ctx.memory.max}M`,
    '-XX:+UseG1GC',
    '-XX:-UseAdaptiveSizePolicy',
    '-XX:-OmitStackTraceInFastThrow',
    '-Dfml.ignoreInvalidMinecraftCertificates=true',
    '-Dfml.ignorePatchDiscrepancies=true',
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=sakuram`,
    `-Dminecraft.launcher.version=0.5.4`,
    `-Dfile.encoding=UTF-8`,
    `-Dsun.stdout.encoding=UTF-8`,
    `-Dsun.stderr.encoding=UTF-8`,
    `-Dminecraft.client.jar=./versions/${ctx.version.id}/${ctx.version.id}.jar`,
    ...ctx.jvmArgs
  ]

  const assetIndexId = versionJson?.assetIndex?.id || versionJson?.assets || ctx.version.id
  
  const mcArgs: string[] = [
    '--username', ctx.account.username,
    '--version', ctx.version.id,
    '--gameDir', gameDir,
    '--assetsDir', assetsDir,
    '--assetIndex', assetIndexId,
    '--uuid', ctx.account.uuid,
    '--accessToken', ctx.account.accessToken || '0',
    '--userType', ctx.account.type === 'microsoft' ? 'msa' : 'mojang',
    '--versionType', ctx.version.type,
    ...ctx.gameArgs
  ]

  if (ctx.fullscreen) {
    mcArgs.push('--fullscreen')
  } else if (ctx.resolution) {
    mcArgs.push('--width', String(ctx.resolution.width))
    mcArgs.push('--height', String(ctx.resolution.height))
  }

  return {
    javaArgs,
    classpath,
    mainClass,
    nativePath: nativesDir,
    minecraftArgs: mcArgs,
    fullCommand: [ctx.javaPath || 'java', ...javaArgs, '-cp', classpath, mainClass, ...mcArgs],
    os: os === 'android' || os === 'ios' || os === 'web' ? (isWin ? 'windows' : 'linux') : (os as any)
  }
}

export function buildBatchScript(cmd: LaunchCommand, mcVersion: string): string {
  return `@echo off
chcp 65001 >nul
title 樱花 MC 启动器 - ${mcVersion}
echo 启动 Minecraft ${mcVersion}...
echo.
${cmd.fullCommand.map(c => `"${c}"`).join(' ')}
pause
`
}

export function buildShellScript(cmd: LaunchCommand, mcVersion: string): string {
  return `#!/bin/bash
export LANG=en_US.UTF-8
echo "启动 Minecraft ${mcVersion}..."
${cmd.fullCommand.map(c => `"${c}"`).join(' ')}
`
}

export function buildSingleLine(cmd: LaunchCommand): string {
  return cmd.fullCommand.map(c => /\s/.test(c) ? `"${c}"` : c).join(' ')
}

export async function detectJava(): Promise<JavaInfo | null> {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    try {
      const system = plus.android.importClass('android.os.SystemProperties')
      const javaHome = system.get('java.home', '')
      if (javaHome) {
        resolve({
          path: javaHome,
          version: '17',
          arch: 'aarch64',
          vendor: 'Android Runtime'
        })
      } else {
        resolve(null)
      }
    } catch {
      resolve(null)
    }
    // #endif
    // #ifndef APP-PLUS
    resolve({
      path: '/usr/bin/java',
      version: '17',
      arch: 'aarch64',
      vendor: 'OpenJDK'
    })
    // #endif
  })
}

export async function validateJava(javaPath: string): Promise<{ valid: boolean; version?: string; error?: string }> {
  try {
    // #ifdef APP-PLUS
    return { valid: true, version: '17' }
    // #endif
    // #ifndef APP-PLUS
    return { valid: true, version: '17' }
    // #endif
  } catch {
    return { valid: false, error: '无法验证 Java 版本' }
  }
}

export function getRecommendedMemory(): { min: number; max: number } {
  // #ifdef APP-PLUS
  try {
    const activity = plus.android.runtimeMainActivity()
    const memoryInfo = plus.android.newObject('android.app.ActivityManager$MemoryInfo')
    const activityManager = activity.getSystemService('activity')
    activityManager.getMemoryInfo(memoryInfo)
    const totalMem = memoryInfo.totalMem / (1024 * 1024)
    const maxMemory = Math.floor(totalMem * 0.6)
    const minMemory = Math.floor(maxMemory * 0.5)
    return { min: Math.max(minMemory, 512), max: Math.max(maxMemory, 1024) }
  } catch {
    return { min: 1024, max: 2048 }
  }
  // #endif
  // #ifndef APP-PLUS
  return { min: 1024, max: 4096 }
  // #endif
}

export async function validateLaunchRequirements(ctx: LaunchContext): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  if (!ctx.account || !ctx.account.username) {
    errors.push('请选择一个账号')
  }

  if (!ctx.version || !ctx.version.id) {
    errors.push('请选择一个游戏版本')
  }

  if (!ctx.version?.installed) {
    errors.push('游戏版本尚未安装')
  }

  if (ctx.memory.min > ctx.memory.max) {
    errors.push('最小内存不能大于最大内存')
  }

  if (ctx.memory.max < 512) {
    errors.push('最大内存不能小于 512MB')
  }

  const javaValid = await validateJava(ctx.javaPath)
  if (!javaValid.valid) {
    errors.push(`Java 验证失败: ${javaValid.error}`)
  }

  return { valid: errors.length === 0, errors }
}

export async function launchGame(ctx: LaunchContext, gameDir: string = './.minecraft'): Promise<LaunchResult> {
  const validation = await validateLaunchRequirements(ctx)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') }
  }

  try {
    const cmd = await buildLaunchCommand(ctx, gameDir)
    console.log('[Launcher] 生成启动命令:', cmd.fullCommand.join(' '))
    return { success: true, command: cmd }
  } catch (e: any) {
    console.error('[Launcher] 生成启动命令失败:', e)
    return { success: false, error: e.message }
  }
}