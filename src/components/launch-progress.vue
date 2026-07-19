<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useVersionStore } from '@/stores/version'
import { useSettingsStore } from '@/stores/settings'
import { useJavaStore } from '@/stores/java'
import { 
  installVersion, 
  resolveVersionJson, 
  buildLaunchCommand,
  isVersionInstalled,
  type InstallStep 
} from '@/utils/install'
import { MINECRAFT_DIR, ensureDir } from '@/utils/setup'
import { formatBytes, copyText } from '@/utils/format'
import { APP_VERSION } from '@/utils/updater'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const accountStore = useAccountStore()
const versionStore = useVersionStore()
const settingsStore = useSettingsStore()
const javaStore = useJavaStore()

const steps = ref<InstallStep[]>([
  { id: 'check', name: '检查资源文件完整性', status: 'pending', progress: 0, total: 0 },
  { id: 'java', name: '检查 Java', status: 'pending', progress: 0, total: 0 },
  { id: 'libs', name: '检查依赖', status: 'pending', progress: 0, total: 0 },
  { id: 'assets', name: '检查资源', status: 'pending', progress: 0, total: 0 },
  { id: 'login', name: '登录', status: 'pending', progress: 0, total: 0 },
  { id: 'launch', name: '启动游戏', status: 'pending', progress: 0, total: 0 }
])

const currentStepIndex = ref(0)
const showTerminal = ref(false)
const terminalOutput = ref('')
const terminalScroll = ref<number>(0)
const isLaunching = ref(false)
const commandStatus = ref<'running' | 'done' | 'error'>('running')
const speedDisplay = ref('0.0 B/s')

const overallProgress = computed(() => {
  const done = steps.value.filter(s => s.status === 'done').length
  const total = steps.value.length
  return Math.floor((done / total) * 100)
})

const currentStepName = computed(() => {
  const current = steps.value.find(s => s.status === 'running')
  return current?.name || '准备中...'
})

function getStep(id: string) {
  return steps.value.find(s => s.id === id)!
}

function setStepStatus(id: string, status: 'pending' | 'running' | 'done' | 'error', extra: Partial<InstallStep> = {}) {
  const step = getStep(id)
  step.status = status
  Object.assign(step, extra)
  if (status === 'running') {
    currentStepIndex.value = steps.value.findIndex(s => s.id === id)
  }
}

function appendToTerminal(text: string) {
  terminalOutput.value += text + '\n'
  nextTick(() => {
    terminalScroll.value = terminalOutput.value.length * 20
  })
}

async function extractNatives(versionJson: any, gameDir: string) {
  // #ifdef APP-PLUS
  try {
    const fs = plus.io.getFileSystemManager()
    const versionId = versionJson.id
    const nativesDir = `${gameDir}/versions/${versionId}/natives`
    const librariesDir = `${gameDir}/libraries`
    
    await ensureDir(nativesDir)
    
    const libs = versionJson.libraries || []
    for (const lib of libs) {
      if (lib.natives && lib.natives.linux && lib.downloads?.classifiers) {
        const nativeKey = lib.natives.linux.replace('${arch}', 'aarch64')
        const classifier = lib.downloads.classifiers[nativeKey]
        if (classifier) {
          const libPath = `${librariesDir}/${classifier.path}`
          try {
            fs.accessSync(libPath)
            appendToTerminal(`  - 提取 natives: ${classifier.path}`)
            const unzip = plus.android.newObject('java.util.zip.ZipFile', libPath)
            const entries = plus.android.invoke(unzip, 'entries')
            while (plus.android.invoke(entries, 'hasMoreElements')) {
              const entry = plus.android.invoke(entries, 'nextElement')
              const entryName = plus.android.invoke(entry, 'getName')
              if (!lib.extract?.exclude?.includes(entryName)) {
                const destPath = `${nativesDir}/${entryName}`
                const destDir = destPath.substring(0, destPath.lastIndexOf('/'))
                try { fs.accessSync(destDir) } catch { fs.mkdirSync({ dirPath: destDir, recursive: true }) }
                const is = plus.android.invoke(unzip, 'getInputStream', entry)
                const os = plus.android.newObject('java.io.FileOutputStream', destPath)
                const buffer = plus.android.newObject('byte[1024]')
                let len = 0
                while ((len = plus.android.invoke(is, 'read', buffer)) != -1) {
                  plus.android.invoke(os, 'write', buffer, 0, len)
                }
                plus.android.invoke(os, 'close')
                plus.android.invoke(is, 'close')
              }
            }
            plus.android.invoke(unzip, 'close')
          } catch (e: any) {
            appendToTerminal(`  - 跳过缺失的 natives: ${classifier.path}`)
          }
        }
      }
    }
    appendToTerminal('✓ Natives 提取完成')
  } catch (e: any) {
    appendToTerminal(`[警告] Natives 提取失败: ${e.message}`)
  }
  // #endif
}

async function runCommandOnAndroid(cmd: string, versionJson: any, gameDir: string) {
  appendToTerminal(`> ${cmd}`)
  appendToTerminal('------------------------')
  
  await extractNatives(versionJson, gameDir)
  
  try {
    // 尝试通过 Cordova shell 插件执行
    const exec = (window as any).cordova?.plugins?.shell?.exec
    if (exec) {
      appendToTerminal('[信息] 使用 Cordova Shell 插件执行...')
      return new Promise<void>((resolve) => {
        exec(cmd, (output: any, error: any) => {
          if (error) {
            appendToTerminal(`[错误] ${error}`)
          } else if (output) {
            appendToTerminal(output)
          }
          appendToTerminal('[信息] 命令已发送')
          resolve()
        })
      })
    }
    throw new Error('无 shell 执行插件')
  } catch (e: any) {
    try {
      // 备用: 使用 plus.android 直接调用 (非阻塞方式)
      appendToTerminal('[信息] 使用 plus.android API 执行...')
      const processBuilder = plus.android.newObject('java.lang.ProcessBuilder', ['sh', '-c', cmd])
      plus.android.invoke(processBuilder, 'redirectErrorStream', true)
      
      const env = plus.android.invoke(processBuilder, 'environment')
      plus.android.invoke(env, 'put', 'LD_LIBRARY_PATH', `${gameDir}/versions/${versionJson.id}/natives`)
      
      const process = plus.android.invoke(processBuilder, 'start')
      appendToTerminal(`[信息] 游戏进程已启动 (PID: ${plus.android.invoke(process, 'pid')})`)
      
      // 异步读取输出,不阻塞主进程
      setTimeout(() => {
        try {
          const reader = plus.android.newObject('java.io.BufferedReader', 
            plus.android.newObject('java.io.InputStreamReader', 
              plus.android.invoke(process, 'getInputStream')))
          
          let line: string | null = ''
          let lineCount = 0
          const readLine = () => {
            try {
              if ((line = plus.android.invoke(reader, 'readLine')) !== null && lineCount < 200) {
                appendToTerminal(line)
                lineCount++
                setTimeout(readLine, 100)
              } else {
                plus.android.invoke(reader, 'close')
              }
            } catch {
              // 忽略读取错误
            }
          }
          readLine()
        } catch {
          // 忽略读取错误
        }
      }, 500)
      
    } catch (e2: any) {
      appendToTerminal(`[无法执行] ${e2.message}`)
      appendToTerminal('')
      appendToTerminal('提示: 由于技术限制,当前版本无法直接启动游戏')
      appendToTerminal('但所有游戏文件已下载到 /storage/emulated/0/SakuraMC/.minecraft/')
      appendToTerminal('你可以使用 FoldCraftLauncher (FCL) 等启动器直接导入运行')
    }
  }
}

async function startLaunch() {
  isLaunching.value = true
  
  try {
    const version = versionStore.selected
    if (!version) {
      throw new Error('未选择游戏版本')
    }
    
    const gameDir = settingsStore.gameDir || MINECRAFT_DIR
    const source = (settingsStore.downloadSource as any) || 'bmcl'
    
    appendToTerminal('樱花 MC 启动器')
    appendToTerminal(`版本: ${version.id}`)
    appendToTerminal(`游戏目录: ${gameDir}`)
    appendToTerminal('')
    
    // ===== Step 1: 检查资源文件完整性 =====
    setStepStatus('check', 'running')
    appendToTerminal('[1/6] 检查资源文件完整性...')
    
    const installed = await isVersionInstalled(version.id, gameDir)
    
    if (!installed.hasJar) {
      appendToTerminal('  - 客户端 JAR: 缺失')
    } else {
      appendToTerminal('  - 客户端 JAR: 存在')
    }
    
    if (!installed.hasJson) {
      appendToTerminal('  - 版本 JSON: 缺失')
    } else {
      appendToTerminal('  - 版本 JSON: 存在')
    }
    
    if (!installed.hasLibraries) {
      appendToTerminal('  - 依赖库: 缺失 (将自动下载)')
    } else {
      appendToTerminal('  - 依赖库: 存在')
    }
    
    if (!installed.hasAssets) {
      appendToTerminal('  - 资源文件: 缺失 (将自动下载)')
    } else {
      appendToTerminal('  - 资源文件: 存在')
    }
    
    setStepStatus('check', 'done', { progress: 1, total: 1 })
    
    // ===== Step 2: 检查 Java =====
    setStepStatus('java', 'running')
    appendToTerminal('[2/6] 检查 Java 环境...')
    
    const javaPath = javaStore.selectedVersion?.path || settingsStore.javaPath || ''
    
    if (javaPath) {
      appendToTerminal(`  - Java 路径: ${javaPath}`)
    } else {
      appendToTerminal('  - Java 路径: 未配置 (使用系统默认)')
    }
    
    setStepStatus('java', 'done', { progress: 1, total: 1 })
    
    // ===== Step 3-4: 安装/检查依赖和资源 =====
    appendToTerminal('开始完整安装流程 (自动下载缺失的文件)...')
    appendToTerminal('')
    
    try {
      await installVersion({
        versionId: version.id,
        gameDir,
        source,
        onStepChange: (step, allSteps) => {
          // 更新 UI 步骤状态
          if (step.id === 'libs') {
            setStepStatus('libs', step.status === 'done' ? 'done' : 'running', {
              progress: step.progress,
              total: step.total,
              speed: step.speed
            })
            if (step.speed) {
              speedDisplay.value = formatBytes(step.speed || 0) + '/s'
            }
          } else if (step.id === 'assets') {
            setStepStatus('assets', step.status === 'done' ? 'done' : 'running', {
              progress: step.progress,
              total: step.total,
              speed: step.speed
            })
            if (step.speed) {
              speedDisplay.value = formatBytes(step.speed || 0) + '/s'
            }
          }
        }
      })
      
      // 确保 libs 和 assets 步骤标记完成
      if (getStep('libs').status !== 'done') {
        setStepStatus('libs', 'done')
      }
      if (getStep('assets').status !== 'done') {
        setStepStatus('assets', 'done')
      }
      
      appendToTerminal('')
      appendToTerminal('✓ 所有资源文件已就绪')
      appendToTerminal('')
    } catch (e: any) {
      appendToTerminal(`[警告] 资源下载部分失败: ${e.message}`)
      appendToTerminal('将尝试继续启动 (可能缺少部分文件)')
      appendToTerminal('')
      // 标记为 done 继续走流程
      setStepStatus('libs', 'done')
      setStepStatus('assets', 'done')
    }
    
    // ===== Step 5: 登录 =====
    setStepStatus('login', 'running')
    appendToTerminal('[5/6] 登录验证...')

    const account = accountStore.selected
    if (account && account.username) {
      appendToTerminal(`  - 用户名: ${account.username}`)
      appendToTerminal(`  - 类型: ${account.type === 'microsoft' ? '微软正版' : account.type === 'offline' ? '离线' : account.type}`)
      // 微软账号: 启动前确保 token 仍有效, 必要时自动刷新
      if (account.type === 'microsoft' && account.id) {
        try {
          appendToTerminal('  - 正在检查 token 有效性...')
          const ok = await accountStore.ensureFreshToken(account.id)
          if (ok) {
            appendToTerminal('  - token 已就绪')
          } else {
            appendToTerminal('  - [警告] token 已过期且无法自动刷新, 启动后可能无法进入正版服务器')
          }
        } catch (e: any) {
          appendToTerminal('  - [警告] token 刷新异常: ' + (e?.message || e))
        }
      }
    } else {
      appendToTerminal('  - 未登录,使用离线模式 (Steve)')
    }

    setStepStatus('login', 'done', { progress: 1, total: 1 })
    
    // ===== Step 6: 启动游戏 =====
    setStepStatus('launch', 'running')
    appendToTerminal('[6/6] 启动游戏...')
    appendToTerminal('')
    
    // 获取版本 JSON (用于生成启动参数)
    let versionJson
    try {
      versionJson = await resolveVersionJson(version.id, source, gameDir)
    } catch (e: any) {
      appendToTerminal(`[警告] 无法获取版本 JSON: ${e.message}`)
      appendToTerminal('使用简化参数启动')
    }
    
    const username = account?.username || 'Steve'
    const uuid = account?.uuid || '00000000-0000-0000-0000-000000000000'
    const accessToken = (account as any)?.accessToken || '0'
    
    if (versionJson) {
      const launchCmd = buildLaunchCommand({
        versionId: version.id,
        gameDir,
        javaPath,
        minMemory: settingsStore.minMemory,
        maxMemory: settingsStore.maxMemory,
        username,
        uuid,
        accessToken,
        versionType: 'SakuraMC',
        width: 854,
        height: 480,
        fullscreen: false,
        extraJvmArgs: [],
        extraGameArgs: []
      }, versionJson, gameDir)
      
      appendToTerminal('主类: ' + versionJson.mainClass)
      appendToTerminal('内存: ' + settingsStore.minMemory + 'M / ' + settingsStore.maxMemory + 'M')
      appendToTerminal('')
      appendToTerminal('----- 启动参数 -----')
      
      // 输出所有参数
      const args = launchCmd.split(' ')
      let currentLine = ''
      for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('-') || i === 0) {
          if (currentLine) appendToTerminal('  ' + currentLine)
          currentLine = args[i]
        } else {
          currentLine += ' ' + args[i]
        }
      }
      if (currentLine) appendToTerminal('  ' + currentLine)
      
      appendToTerminal('')
      appendToTerminal('----- 开始执行 -----')
      
      // #ifdef APP-PLUS
      showTerminal.value = true
      await runCommandOnAndroid(launchCmd, versionJson, gameDir)
      // #endif
      
      // #ifndef APP-PLUS
      appendToTerminal('')
      appendToTerminal('⚠️  当前环境无法直接执行 Java 命令')
      appendToTerminal('请安装 Android APK 或 Windows 桌面版')
      appendToTerminal('')
      appendToTerminal('所有游戏文件已保存到:')
      appendToTerminal('  ' + gameDir)
      appendToTerminal('')
      appendToTerminal('你可以使用 FoldCraftLauncher (FCL) 等启动器')
      appendToTerminal('将游戏目录设置为上述路径即可直接运行')
      // #endif
    }
    
    setStepStatus('launch', 'done')
    commandStatus.value = 'done'
    showTerminal.value = true
    
    appendToTerminal('')
    appendToTerminal('========================')
    appendToTerminal('启动流程完成')
    appendToTerminal('========================')
    
  } catch (e: any) {
    const currentStep = steps.value.find(s => s.status === 'running')
    if (currentStep) {
      setStepStatus(currentStep.id, 'error')
    }
    const errMsg = e?.message || String(e) || '未知错误'
    const errStack = e?.stack ? '\n\nStack:\n' + e.stack : ''
    appendToTerminal(`[错误] ${errMsg}`)
    if (errStack) appendToTerminal(errStack)
    appendToTerminal(`[出错步骤] ${currentStep?.name || '未知'}`)
    appendToTerminal(`[时间] ${new Date().toLocaleString()}`)
    appendToTerminal('')
    appendToTerminal('点击下方「复制日志」按钮可一键复制完整日志，便于反馈问题')
    commandStatus.value = 'error'
    showTerminal.value = true
    // 显示详细错误弹窗, 而不是简单 toast
    uni.showModal({
      title: '启动失败',
      content: `步骤: ${currentStep?.name || '未知'}\n错误: ${errMsg}\n\n点击「复制日志」可一键复制完整终端输出，便于反馈问题。`,
      confirmText: '复制日志',
      cancelText: '关闭',
      success: (r) => {
        if (r.confirm) copyLaunchLog()
      }
    })
  } finally {
    isLaunching.value = false
  }
}

/** 复制完整启动日志到剪贴板 */
async function copyLaunchLog() {
  const header = `===== SakuraMC 启动日志 =====\n版本: v${APP_VERSION}\n时间: ${new Date().toLocaleString()}\n设备: ${getPlatform()}\n============================\n\n`
  const log = header + terminalOutput.value
  const ok = await copyText(log)
  if (ok) {
    uni.showToast({ title: '日志已复制到剪贴板', icon: 'success' })
  } else {
    uni.showToast({ title: '复制失败', icon: 'none' })
  }
}

/** 获取平台信息 */
function getPlatform(): string {
  try {
    const info = uni.getSystemInfoSync()
    return `${info.platform} ${info.system || ''} ${info.model || ''}`.trim()
  } catch {
    return 'unknown'
  }
}

onMounted(() => {
  showTerminal.value = true // 直接显示终端,像 FCL 一样
  startLaunch()
})
</script>

<template>
  <view class="lp-mask" @tap.self="emit('close')">
    <view class="lp-panel">
      <view class="lp-header">
        <text class="lp-title">启动游戏</text>
        <text class="lp-close" @tap="emit('close')">✕</text>
      </view>
      
      <view class="lp-body">
        <!-- 步骤列表 (FCL 风格) -->
        <view class="lp-steps">
          <view 
            v-for="(step, index) in steps" 
            :key="step.id"
            class="lp-step"
            :class="{ 
              'lp-step--active': step.status === 'running', 
              'lp-step--done': step.status === 'done', 
              'lp-step--error': step.status === 'error' 
            }"
          >
            <view class="lp-step__icon">
              <text v-if="step.status === 'done'">✓</text>
              <text v-else-if="step.status === 'running'">→</text>
              <text v-else-if="step.status === 'error'">✕</text>
              <text v-else>·</text>
            </view>
            <view class="lp-step__main">
              <text class="lp-step__name">{{ step.name }}</text>
              <view v-if="step.status === 'running' && step.total > 0" class="lp-step__progress">
                <view class="lp-step__progress-bar">
                  <view 
                    class="lp-step__progress-fill" 
                    :style="{ width: (step.progress / step.total * 100) + '%' }" 
                  />
                </view>
                <text class="lp-step__progress-text">
                  {{ formatBytes(step.progress) }} / {{ formatBytes(step.total) }}
                </text>
              </view>
            </view>
          </view>
        </view>
        
        <!-- 速度显示 -->
        <view v-if="speedDisplay" class="lp-speed">
          <text>速度: {{ speedDisplay }}</text>
        </view>
        
        <!-- 终端输出 -->
        <view class="lp-terminal">
          <scroll-view 
            scroll-y 
            class="lp-terminal__content"
            :scroll-top="terminalScroll"
            scroll-with-animation
          >
            <text class="lp-terminal__text" user-select="true">{{ terminalOutput }}</text>
          </scroll-view>
        </view>
        
        <!-- 底部按钮 -->
        <view class="lp-actions">
          <view class="lp-btn lp-btn--ghost" @tap="copyLaunchLog">
            <text>📋 复制日志</text>
          </view>
          <view class="lp-btn" @tap="emit('close')">
            <text>{{ commandStatus === 'done' ? '关闭' : commandStatus === 'error' ? '关闭' : '取消' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.lp-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  backdrop-filter: blur(12px);
}

.lp-panel {
  background: rgba(20, 18, 30, 0.95);
  border: 2rpx solid rgba(255, 183, 213, 0.3);
  border-radius: 20rpx;
  width: 100%;
  max-width: 650rpx;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid rgba(255, 183, 213, 0.15);
  flex-shrink: 0;
}

.lp-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffb7d5;
}

.lp-close {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.4);
  padding: 8rpx 16rpx;
}

.lp-body {
  padding: 24rpx;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.lp-steps {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.lp-step {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  
  &--active {
    background: rgba(255, 183, 213, 0.08);
    
    .lp-step__name {
      color: #ffb7d5;
      font-weight: 600;
    }
    
    .lp-step__icon {
      background: rgba(255, 183, 213, 0.2);
      color: #ffb7d5;
    }
  }
  
  &--done {
    .lp-step__icon {
      background: rgba(82, 196, 26, 0.15);
      color: #52c41a;
    }
    
    .lp-step__name {
      color: rgba(255, 255, 255, 0.5);
    }
  }
  
  &--error {
    .lp-step__icon {
      background: rgba(255, 107, 107, 0.15);
      color: #ff6b6b;
    }
    
    .lp-step__name {
      color: #ff6b6b;
    }
  }
  
  &__icon {
    width: 36rpx;
    height: 36rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18rpx;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
    margin-top: 2rpx;
  }
  
  &__main {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 6rpx;
  }
  
  &__progress {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }
  
  &__progress-bar {
    flex: 1;
    height: 6rpx;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3rpx;
    overflow: hidden;
  }
  
  &__progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ffb7d5, #ff8fab);
    border-radius: 3rpx;
    transition: width 0.2s ease;
  }
  
  &__progress-text {
    font-size: 20rpx;
    color: rgba(255, 255, 255, 0.4);
    white-space: nowrap;
  }
}

.lp-speed {
  text-align: right;
  margin-bottom: 16rpx;
  
  text {
    font-size: 22rpx;
    color: rgba(255, 183, 213, 0.6);
  }
}

.lp-terminal {
  flex: 1;
  background: rgba(0, 0, 0, 0.6);
  border: 2rpx solid rgba(255, 183, 213, 0.15);
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 20rpx;
  min-height: 300rpx;
  
  &__content {
    height: 350rpx;
  }
  
  &__text {
    font-size: 22rpx;
    color: #52c41a;
    font-family: 'Consolas', 'Monaco', monospace;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.lp-actions {
  display: flex;
  gap: 16rpx;
}

.lp-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  font-size: 28rpx;
  background: linear-gradient(135deg, #ffb7d5, #ff8fab);
  color: #fff;
  font-weight: 600;

  &--ghost {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
    flex: 0 0 auto;
    padding: 0 24rpx;
    min-width: 180rpx;
  }

  &:active {
    opacity: 0.8;
  }
}
</style>
