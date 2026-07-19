/**
 * Minecraft 启动器核心: 生成启动命令
 * 浏览器无法直接执行 Java 程序,这里生成启动脚本供 PC 端下载
 */
import type { IAccount, IGameVersion, ISettings } from '@/types'
import { detectPlatform } from '@/utils/format'

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

/**
 * 构造启动参数
 */
export function buildLaunchCommand(ctx: LaunchContext): LaunchCommand {
  const os = detectPlatform()
  const isWin = os === 'windows'
  const separator = isWin ? ';' : ':'
  const gameDir = ctx.gameDir || `./.minecraft/versions/${ctx.version.id}`
  const assetsDir = `./.minecraft/assets`
  const libDir = `./.minecraft/libraries`
  const nativesDir = `./.minecraft/versions/${ctx.version.id}/natives`

  const classpath = [
    `${libDir}/*`,
    `./.minecraft/versions/${ctx.version.id}/${ctx.version.id}.jar`
  ].join(separator)

  const javaArgs: string[] = [
    `-Xms${ctx.memory.min}M`,
    `-Xmx${ctx.memory.max}M`,
    ...ctx.jvmArgs,
    `-Dminecraft.launcher.brand=sakuram`,
    `-Dminecraft.launcher.version=0.5.1`,
    `-Dfile.encoding=UTF-8`,
    `-Dsun.stdout.encoding=UTF-8`,
    `-Dsun.stderr.encoding=UTF-8`,
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.client.jar=./versions/${ctx.version.id}/${ctx.version.id}.jar`
  ]

  const mcArgs: string[] = [
    '--username', ctx.account.username,
    '--version', ctx.version.id,
    '--gameDir', gameDir,
    '--assetsDir', assetsDir,
    '--assetIndex', ctx.version.id,
    '--uuid', ctx.account.uuid,
    '--accessToken', ctx.account.accessToken || '0',
    '--userType', ctx.account.type === 'microsoft' ? 'msa' : 'mojang',
    '--versionType', ctx.version.type
  ]

  if (ctx.fullscreen) mcArgs.push('--fullscreen')
  if (ctx.resolution) {
    mcArgs.push('--width', String(ctx.resolution.width))
    mcArgs.push('--height', String(ctx.resolution.height))
  }
  mcArgs.push(...ctx.gameArgs)

  const mainClass = 'net.minecraft.client.main.Main'

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

/** 生成 .bat 启动脚本 */
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

/** 生成 .sh 启动脚本 */
export function buildShellScript(cmd: LaunchCommand, mcVersion: string): string {
  return `#!/bin/bash
export LANG=en_US.UTF-8
echo "启动 Minecraft ${mcVersion}..."
${cmd.fullCommand.map(c => `"${c}"`).join(' ')}
`
}

/** 生成可直接复制运行的命令行 */
export function buildSingleLine(cmd: LaunchCommand): string {
  return cmd.fullCommand.map(c => /\s/.test(c) ? `"${c}"` : c).join(' ')
}
