<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useFrpStore } from '@/stores/frp'
import McCard from '@/components/mc-card.vue'
import McButton from '@/components/mc-button.vue'
import McInput from '@/components/mc-input.vue'
import McPicker from '@/components/mc-picker.vue'
import McSwitch from '@/components/mc-switch.vue'
import { generateFrpcIni, generateFrpcCommand } from '@/utils/frpc'
import { downloadFile, copyText } from '@/utils/format'

const frpStore = useFrpStore()
const tunnelId = ref(0)
const format = ref<'ini' | 'toml' | 'json'>('ini')

onLoad((q: any) => {
  tunnelId.value = Number(q?.id) || 0
})

const tunnel = computed(() => frpStore.tunnels.find(t => t.id === tunnelId.value))
const node = computed(() => tunnel.value ? frpStore.nodeById(tunnel.value.node) : null)

const iniContent = computed(() => {
  if (!tunnel.value || !node.value) return ''
  return generateFrpcIni(node.value, tunnel.value, frpStore.account?.token || 'YOUR_TOKEN')
})
const tomlContent = computed(() => {
  if (!tunnel.value || !node.value) return ''
  return tomlFromIni(iniContent.value)
})

function tomlFromIni(ini: string): string {
  // 简单转换 ini -> toml (frpc 0.52+ 使用 toml)
  const lines = ini.split('\n')
  let result = ''
  let inCommon = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const section = line.match(/^\[(.+)\]$/)
    if (section) {
      inCommon = section[1] === 'common'
      result += `\n[${section[1]}]\n`
      continue
    }
    const kv = line.match(/^(\S+)\s*=\s*(.+)$/)
    if (kv) {
      const v = kv[2].trim().replace(/^"(.*)"$/, '$1')
      result += `${kv[1]} = "${v}"\n`
    }
  }
  return result.trim() + '\n'
}

const config = computed(() => {
  if (format.value === 'toml') return tomlContent.value
  return iniContent.value
})

const command = computed(() => {
  return generateFrpcCommand(`./${(tunnel.value?.name || 'tunnel')}.${format.value}`)
})

function copyConfig() {
  copyText(config.value)
  uni.showToast({ title: '已复制配置', icon: 'success' })
}
function copyCommand() {
  copyText(command.value)
  uni.showToast({ title: '已复制命令', icon: 'success' })
}
function downloadConfig() {
  const name = (tunnel.value?.name || 'tunnel') + '.' + format.value
  downloadFile(name, config.value)
}
</script>

<template>
  <view class="te">
    <view v-if="!tunnel" class="te__empty">
      <text>未找到隧道</text>
    </view>
    <template v-else>
      <McCard glow>
        <view class="te__head">
          <text class="te__name">{{ tunnel.name }}</text>
          <text class="te__sub">{{ tunnel.type.toUpperCase() }} · 节点 {{ node?.name || '#' + tunnel.node }}</text>
          <text class="te__sub">本地 {{ tunnel.localIp }}:{{ tunnel.localPort }} → 远端 {{ tunnel.remotePort || tunnel.domain || '-' }}</text>
        </view>
      </McCard>

      <McCard title="配置文件格式" class="te__section">
        <McPicker v-model="format" :options="[
          { label: 'INI', value: 'ini', icon: '📄' },
          { label: 'TOML', value: 'toml', icon: '🆎' }
        ]" :block="false" />
      </McCard>

      <McCard title="frpc 配置文件" subtitle="保存为 tunnel.ini / tunnel.toml" class="te__section">
        <view class="code-box">
          <text class="code-box__text" user-select="text">{{ config }}</text>
        </view>
        <view class="te__actions">
          <McButton size="sm" @click="copyConfig">📋 复制</McButton>
          <McButton size="sm" variant="secondary" @click="downloadConfig">💾 下载</McButton>
        </view>
      </McCard>

      <McCard title="启动命令" class="te__section">
        <view class="code-box">
          <text class="code-box__text" user-select="text">{{ command }}</text>
        </view>
        <view class="te__actions">
          <McButton size="sm" @click="copyCommand">📋 复制命令</McButton>
        </view>
        <text class="te__tip">1. 下载配置文件到 frpc 所在目录</text>
        <text class="te__tip">2. 在命令行执行上述启动命令</text>
        <text class="te__tip">3. 看到 "start proxy success" 即表示成功</text>
      </McCard>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.te {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__empty { text-align: center; padding: 100rpx 0; color: #6a5a8a; }
  &__head { padding: 16rpx 0; }
  &__name { font-size: 36rpx; color: #ffffff; font-weight: 700; display: block; }
  &__sub { font-size: 24rpx; color: #b8a8d4; display: block; margin-top: 6rpx; }
  &__section { margin-top: 24rpx; }
  &__actions { display: flex; gap: 12rpx; margin-top: 16rpx; }
  &__tip { display: block; font-size: 24rpx; color: #b8a8d4; line-height: 1.7; }
}

.code-box {
  background: #000; padding: 16rpx;
  border-radius: 12rpx;
  max-height: 600rpx; overflow: auto;
  &__text { font-size: 22rpx; color: #4ade80; font-family: monospace; line-height: 1.5; white-space: pre; }
}
</style>
