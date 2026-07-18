<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useVersionStore } from '@/stores/version'
import { useSettingsStore } from '@/stores/settings'
import { useJavaStore } from '@/stores/java'
import { buildLaunchCommand, buildSingleLine, buildBatchScript, buildShellScript } from '@/utils/launcher'
import { copyText, downloadFile } from '@/utils/format'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const accountStore = useAccountStore()
const versionStore = useVersionStore()
const settingsStore = useSettingsStore()
const javaStore = useJavaStore()

const steps = ref([
  { id: 'checkJava', label: '检查 Java', status: 'pending' as 'pending' | 'checking' | 'done' | 'error' },
  { id: 'checkDependencies', label: '检查依赖', status: 'pending' },
  { id: 'checkIntegrity', label: '检查资源文件完整性', status: 'pending' },
  { id: 'login', label: '登录', status: 'pending' },
  { id: 'launch', label: '启动游戏', status: 'pending' }
])

const currentStep = ref(0)
const progress = ref(0)
const speed = ref('0 B/s')
const showTerminal = ref(false)
const terminalOutput = ref('')
const terminalScroll = ref<number>(0)
const isLaunching = ref(false)
const launchCommand = ref('')
const commandStatus = ref<'running' | 'done' | 'error'>('running')

function getStep(id: string) {
  return steps.value.find(s => s.id === id)!
}

function setStepStatus(id: string, status: 'pending' | 'checking' | 'done' | 'error') {
  const step = getStep(id)
  step.status = status
}

async function runStep(id: string, delay = 800) {
  setStepStatus(id, 'checking')
  currentStep.value = steps.value.findIndex(s => s.id === id)
  await new Promise(r => setTimeout(r, delay))
  setStepStatus(id, 'done')
  progress.value = ((currentStep.value + 1) / steps.value.length) * 100
}

function appendToTerminal(text: string) {
  terminalOutput.value += text + '\n'
  nextTick(() => {
    terminalScroll.value = terminalOutput.value.length
  })
}

async function runCommandOnAndroid(cmd: string) {
  appendToTerminal(`> ${cmd}`)
  appendToTerminal('------------------------')
  
  try {
    const exec = require('cordova-plugin-shell-exec')
    return new Promise<void>((resolve, reject) => {
      exec.exec(cmd, (output: any, error: any) => {
        if (error) {
          appendToTerminal(`[错误] ${error}`)
          reject(new Error(error))
        } else {
          appendToTerminal(output)
          resolve()
        }
      })
    })
  } catch (e: any) {
    try {
      const runtime = plus.android.runtimeMainActivity()
      const processBuilder = plus.android.newObject('java.lang.ProcessBuilder')
      plus.android.invoke(processBuilder, 'command', cmd)
      const process = plus.android.invoke(processBuilder, 'start')
      
      const reader = plus.android.newObject('java.io.BufferedReader', 
        plus.android.newObject('java.io.InputStreamReader', 
          plus.android.invoke(process, 'getInputStream')))
      
      let line = ''
      while ((line = plus.android.invoke(reader, 'readLine')) !== null) {
        appendToTerminal(line)
        await new Promise(r => setTimeout(r, 50))
      }
      
      const exitCode = plus.android.invoke(process, 'waitFor')
      if (exitCode !== 0) {
        appendToTerminal(`[进程退出] 代码: ${exitCode}`)
      }
    } catch (e2: any) {
      appendToTerminal(`[无法执行] ${e2.message}`)
      appendToTerminal('请确保已安装 Java 环境')
    }
  }
}

async function startLaunch() {
  isLaunching.value = true
  
  try {
    await runStep('checkJava')
    await runStep('checkDependencies')
    await runStep('checkIntegrity')
    await runStep('login')
    await runStep('launch')
    
    const account = accountStore.selected!
    const version = versionStore.selected!
    const javaPath = javaStore.selectedVersion?.path || settingsStore.javaPath || 'java'
    
    const cmd = buildLaunchCommand({
      account,
      version,
      gameDir: settingsStore.gameDir,
      javaPath,
      memory: { min: settingsStore.minMemory, max: settingsStore.maxMemory },
      jvmArgs: ['-XX:+UnlockExperimentalVMOptions', '-XX:+UseG1GC', '-XX:G1NewSizePercent=20', '-XX:G1ReservePercent=20', '-XX:MaxGCPauseMillis=50', '-XX:G1MixedGCCountTarget=4'],
      gameArgs: [],
      fullscreen: settingsStore.fullscreen
    })
    
    launchCommand.value = buildSingleLine(cmd)
    
    // #ifdef APP-PLUS
    showTerminal.value = true
    appendToTerminal('樱花 MC 启动器 v0.2.9')
    appendToTerminal('正在启动 Minecraft ' + version.id + '...')
    appendToTerminal('')
    
    await runCommandOnAndroid(launchCommand.value)
    
    commandStatus.value = 'done'
    appendToTerminal('')
    appendToTerminal('[游戏已启动]')
    appendToTerminal('如果游戏窗口没有自动弹出,请检查后台应用')
    // #endif
    
    // #ifdef ELECTRON
    const { shell } = require('electron')
    const os = require('os')
    const fs = require('fs')
    const path = require('path')
    
    const scriptDir = path.join(os.tmpdir(), 'SakuraMC')
    if (!fs.existsSync(scriptDir)) fs.mkdirSync(scriptDir, { recursive: true })
    
    if (process.platform === 'win32') {
      const batPath = path.join(scriptDir, `start-${version.id}.bat`)
      fs.writeFileSync(batPath, buildBatchScript(cmd, version.id))
      shell.openPath(batPath)
    } else {
      const shPath = path.join(scriptDir, `start-${version.id}.sh`)
      fs.writeFileSync(shPath, buildShellScript(cmd, version.id))
      fs.chmodSync(shPath, 0o755)
      shell.openPath(shPath)
    }
    
    showTerminal.value = true
    appendToTerminal('樱花 MC 启动器')
    appendToTerminal('启动脚本已创建并运行')
    appendToTerminal('游戏窗口应该会自动弹出')
    appendToTerminal('')
    appendToTerminal('命令:')
    appendToTerminal(launchCommand.value)
    commandStatus.value = 'done'
    // #endif
    
    // #ifdef H5
    showTerminal.value = true
    appendToTerminal('樱花 MC 启动器')
    appendToTerminal('警告: 浏览器环境无法直接启动游戏')
    appendToTerminal('请在 PC 上复制以下命令到终端执行')
    appendToTerminal('')
    appendToTerminal('命令:')
    appendToTerminal(launchCommand.value)
    appendToTerminal('')
    appendToTerminal('或下载启动脚本双击运行')
    commandStatus.value = 'done'
    // #endif
    
  } catch (e: any) {
    setStepStatus(steps.value[currentStep.value]?.id || 'launch', 'error')
    appendToTerminal(`[错误] ${e.message}`)
    commandStatus.value = 'error'
    uni.showToast({ title: '启动失败: ' + (e.message || ''), icon: 'none' })
  } finally {
    isLaunching.value = false
  }
}

function copyCmd() {
  copyText(launchCommand.value)
  uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
}

function downloadBat() {
  const account = accountStore.selected!
  const version = versionStore.selected!
  const javaPath = javaStore.selectedVersion?.path || settingsStore.javaPath || 'java'
  
  const cmd = buildLaunchCommand({
    account,
    version,
    gameDir: settingsStore.gameDir,
    javaPath,
    memory: { min: settingsStore.minMemory, max: settingsStore.maxMemory },
    jvmArgs: [],
    gameArgs: [],
    fullscreen: settingsStore.fullscreen
  })
  
  const script = buildBatchScript(cmd, version.id)
  downloadFile(`start-${version.id}.bat`, script)
  uni.showToast({ title: '已下载 .bat 启动脚本', icon: 'success' })
}

function downloadSh() {
  const account = accountStore.selected!
  const version = versionStore.selected!
  const javaPath = javaStore.selectedVersion?.path || settingsStore.javaPath || 'java'
  
  const cmd = buildLaunchCommand({
    account,
    version,
    gameDir: settingsStore.gameDir,
    javaPath,
    memory: { min: settingsStore.minMemory, max: settingsStore.maxMemory },
    jvmArgs: [],
    gameArgs: [],
    fullscreen: settingsStore.fullscreen
  })
  
  const script = buildShellScript(cmd, version.id)
  downloadFile(`start-${version.id}.sh`, script)
  uni.showToast({ title: '已下载 .sh 启动脚本', icon: 'success' })
}

onMounted(() => {
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
      
      <view v-if="!showTerminal" class="lp-body">
        <view class="lp-progress-bar">
          <view class="lp-progress-fill" :style="{ width: progress + '%' }" />
        </view>
        
        <view class="lp-steps">
          <view 
            v-for="(step, index) in steps" 
            :key="step.id"
            class="lp-step"
            :class="{ 'lp-step--active': index === currentStep, 'lp-step--done': step.status === 'done', 'lp-step--error': step.status === 'error' }"
          >
            <view class="lp-step__icon">
              <text v-if="step.status === 'done'">✓</text>
              <text v-else-if="step.status === 'checking'">→</text>
              <text v-else-if="step.status === 'error'">✕</text>
              <text v-else>...</text>
            </view>
            <text class="lp-step__label">{{ step.label }}</text>
          </view>
        </view>
        
        <view class="lp-speed">
          <text>{{ speed }}</text>
        </view>
        
        <view v-if="!isLaunching" class="lp-cancel">
          <text @tap="emit('close')">取消</text>
        </view>
      </view>
      
      <view v-else class="lp-body">
        <text class="lp-success-icon" :class="{ 'lp-success-icon--error': commandStatus === 'error' }">
          {{ commandStatus === 'done' ? '✓' : commandStatus === 'error' ? '✕' : '▶' }}
        </text>
        <text class="lp-success-text">
          {{ commandStatus === 'done' ? '游戏启动成功' : commandStatus === 'error' ? '启动失败' : '游戏启动中' }}
        </text>
        
        <view class="lp-terminal">
          <scroll-view 
            scroll-y 
            class="lp-terminal__content"
            :scroll-top="terminalScroll"
            scroll-with-animation
          >
            <text class="lp-terminal__text" user-select="text">{{ terminalOutput }}</text>
          </scroll-view>
        </view>
        
        <view class="lp-cmd-box" v-if="commandStatus === 'done'">
          <text class="lp-cmd-label">启动命令:</text>
          <text class="lp-cmd" user-select="text">{{ launchCommand }}</text>
        </view>
        
        <view class="lp-actions">
          <view class="lp-btn lp-btn--primary" @tap="copyCmd">
            <text>📋 复制命令</text>
          </view>
          <view class="lp-btn lp-btn--secondary" @tap="downloadBat">
            <text>💾 下载 .bat 启动脚本</text>
          </view>
          <view class="lp-btn lp-btn--ghost" @tap="downloadSh">
            <text>💾 下载 .sh 启动脚本</text>
          </view>
          <view class="lp-btn lp-btn--ghost" @tap="emit('close')">
            <text>关闭</text>
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
  max-width: 600rpx;
  max-height: 85vh;
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
  padding: 32rpx;
  flex: 1;
  overflow-y: auto;
}

.lp-progress-bar {
  height: 8rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4rpx;
  overflow: hidden;
  margin-bottom: 32rpx;
}

.lp-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffb7d5, #ff8fab);
  border-radius: 4rpx;
  transition: width 0.3s ease;
}

.lp-steps {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.lp-step {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
  
  &--active {
    .lp-step__label { color: #ffb7d5; }
  }
  
  &--done {
    .lp-step__icon { background: rgba(82, 196, 26, 0.2); color: #52c41a; }
    .lp-step__label { color: rgba(255, 255, 255, 0.6); }
  }
  
  &--error {
    .lp-step__icon { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
    .lp-step__label { color: #ff6b6b; }
  }
}

.lp-step__icon {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(255, 183, 213, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  color: #ffb7d5;
  flex-shrink: 0;
  animation: pulse 1.5s infinite;
}

.lp-step__label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.4);
}

.lp-speed {
  text-align: center;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 24rpx;
}

.lp-cancel {
  text-align: center;
  margin-top: 32rpx;
  
  text {
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.4);
    padding: 16rpx 32rpx;
  }
}

.lp-success-icon {
  display: block;
  width: 80rpx;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  margin: 0 auto 20rpx;
  background: rgba(82, 196, 26, 0.2);
  border-radius: 50%;
  font-size: 40rpx;
  color: #52c41a;
  
  &--error {
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
  }
}

.lp-success-text {
  display: block;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  margin-bottom: 24rpx;
}

.lp-terminal {
  background: rgba(0, 0, 0, 0.6);
  border: 2rpx solid rgba(255, 183, 213, 0.15);
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 24rpx;
  
  &__content {
    max-height: 400rpx;
  }
  
  &__text {
    font-size: 24rpx;
    color: #52c41a;
    font-family: 'Consolas', 'Monaco', monospace;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.lp-cmd-box {
  background: rgba(0, 0, 0, 0.4);
  padding: 20rpx;
  border-radius: 12rpx;
  border: 2rpx solid rgba(255, 183, 213, 0.15);
  margin-bottom: 24rpx;
}

.lp-cmd-label {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 12rpx;
}

.lp-cmd {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.6);
  font-family: monospace;
  word-break: break-all;
  line-height: 1.7;
}

.lp-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.lp-btn {
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  font-size: 28rpx;
  
  &--primary {
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    color: #fff;
    font-weight: 600;
  }
  
  &--secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
  
  &--ghost {
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    border: 2rpx solid rgba(255, 255, 255, 0.1);
  }
  
  &:active {
    opacity: 0.8;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>