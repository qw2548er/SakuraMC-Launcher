<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import McButton from '@/components/mc-button.vue'
import McCard from '@/components/mc-card.vue'
import { copyText } from '@/utils/format'

const accountStore = useAccountStore()
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)
const step = ref<'idle' | 'waiting' | 'success' | 'expired' | 'error'>('idle')
const elapsed = ref(0)

async function startLogin() {
  step.value = 'waiting'
  elapsed.value = 0
  try {
    await accountStore.startMicrosoftLogin()
    // 立即开始轮询
    pollTimer.value = setInterval(async () => {
      elapsed.value += accountStore.msLoginFlow?.interval || 5
      const status = await accountStore.pollMicrosoftLogin()
      if (status === 'success') {
        step.value = 'success'
        stopPolling()
        uni.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 1200)
      } else if (status === 'expired' || status === 'error') {
        step.value = status
        stopPolling()
      }
    }, (accountStore.msLoginFlow?.interval || 5) * 1000)
  } catch (e: any) {
    step.value = 'error'
  }
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

function cancel() {
  stopPolling()
  accountStore.cancelMicrosoftLogin()
  step.value = 'idle'
}

function copyCode() {
  if (accountStore.msLoginFlow?.userCode) {
    copyText(accountStore.msLoginFlow.userCode)
    uni.showToast({ title: '已复制', icon: 'success' })
  }
}

function openLoginUrl() {
  const url = accountStore.msLoginFlow?.verificationUri || 'https://microsoft.com/devicelogin'
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(url, () => uni.showToast({ title: '打开失败, 请手动访问', icon: 'none' }))
  // #endif
}

onUnmounted(stopPolling)
</script>

<template>
  <view class="ms-login">
    <view v-if="step === 'idle'" class="ms-login__idle">
      <view class="ms-login__hero">
        <view class="ms-login__logo">⊞</view>
        <text class="ms-login__title">微软账号登录</text>
        <text class="ms-login__subtitle">使用 Microsoft OAuth 设备码流程</text>
      </view>
      <McCard>
        <text class="ms-login__section">登录步骤</text>
        <text class="ms-login__step">1. 点击下方"开始登录"</text>
        <text class="ms-login__step">2. 页面会显示一个 9 位字母数字代码</text>
        <text class="ms-login__step">3. 打开 microsoft.com/devicelogin (新窗口)</text>
        <text class="ms-login__step">4. 输入刚才显示的代码</text>
        <text class="ms-login__step">5. 用你的微软账号登录并授权</text>
        <text class="ms-login__step">6. 等待 5-10 秒自动完成</text>
      </McCard>
      <McCard class="ms-login__notice">
        <text class="ms-login__notice-title">⚠️ 重要提示</text>
        <text class="ms-login__notice-text">该微软账号必须已经拥有 Minecraft Java 版才能登录成功</text>
        <text class="ms-login__notice-text">Token 仅保存在本地, 不会上传到任何服务器</text>
        <text class="ms-login__notice-text">设备码有效期 15 分钟, 超时需重新开始</text>
      </McCard>
      <view class="ms-login__action">
        <McButton size="lg" glow block @click="startLogin">开始登录</McButton>
      </view>
    </view>

    <view v-else-if="step === 'waiting' && accountStore.msLoginFlow" class="ms-login__waiting">
      <McCard glow>
        <text class="ms-login__card-title">请在新窗口输入以下代码</text>
        <view class="ms-login__code-box" @tap="copyCode">
          <text class="ms-login__code">{{ accountStore.msLoginFlow.userCode }}</text>
          <text class="ms-login__code-tap">点击复制</text>
        </view>
        <view class="ms-login__open-row">
          <McButton block @click="openLoginUrl">🌐 打开 microsoft.com/devicelogin</McButton>
        </view>
        <view class="ms-login__status">
          <view class="ms-login__spinner" />
          <text class="ms-login__status-text">等待授权... {{ elapsed }}s</text>
        </view>
      </McCard>
      <view class="ms-login__action">
        <McButton variant="ghost" block @click="cancel">取消登录</McButton>
      </view>
    </view>

    <view v-else-if="step === 'success'" class="ms-login__result is-success">
      <text class="ms-login__result-icon">✅</text>
      <text class="ms-login__result-title">登录成功</text>
      <text class="ms-login__result-sub">正在跳回账号列表...</text>
    </view>

    <view v-else-if="step === 'expired' || step === 'error'" class="ms-login__result is-error">
      <text class="ms-login__result-icon">❌</text>
      <text class="ms-login__result-title">{{ step === 'expired' ? '登录已过期' : '登录失败' }}</text>
      <text class="ms-login__result-sub">{{ accountStore.msLoginError || '未知错误' }}</text>
      <view class="ms-login__action">
        <McButton @click="step = 'idle'">重试</McButton>
        <McButton variant="ghost" @click="uni.navigateBack()">返回</McButton>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ms-login {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  &__hero { text-align: center; padding: 60rpx 0; }
  &__logo {
    width: 160rpx; height: 160rpx;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    border-radius: 32rpx;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 80rpx; color: #ffffff;
    box-shadow: 0 8rpx 32rpx rgba(96, 165, 250, 0.4);
    margin-bottom: 24rpx;
  }
  &__title { font-size: 40rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 24rpx; color: #b8a8d4; display: block; margin-top: 8rpx; }
  &__section { font-size: 28rpx; color: #ffffff; font-weight: 700; display: block; margin-bottom: 16rpx; }
  &__step { font-size: 26rpx; color: #b8a8d4; display: block; line-height: 1.8; padding-left: 8rpx; }
  &__action { margin-top: 32rpx; display: flex; flex-direction: column; gap: 16rpx; }
  &__notice {
    margin-top: 24rpx;
    background: rgba(251, 191, 36, 0.08);
    border-color: rgba(251, 191, 36, 0.3);
  }
  &__notice-title { font-size: 26rpx; color: #fbbf24; font-weight: 700; display: block; margin-bottom: 12rpx; }
  &__notice-text { font-size: 24rpx; color: #b8a8d4; display: block; line-height: 1.7; }
  &__card-title { font-size: 28rpx; color: #ffffff; font-weight: 700; display: block; text-align: center; margin-bottom: 24rpx; }
  &__code-box {
    background: rgba(15, 15, 26, 0.8);
    border: 2rpx dashed #d896ff;
    border-radius: 16rpx;
    padding: 32rpx 24rpx;
    text-align: center;
    margin-bottom: 24rpx;
  }
  &__code {
    font-size: 64rpx;
    font-weight: 700;
    color: #ffb7d5;
    letter-spacing: 8rpx;
    font-family: monospace;
    display: block;
  }
  &__code-tap { font-size: 22rpx; color: #6a5a8a; display: block; margin-top: 8rpx; }
  &__open-row { margin-bottom: 24rpx; }
  &__status { display: flex; align-items: center; justify-content: center; gap: 16rpx; padding: 16rpx 0; }
  &__spinner {
    width: 24rpx; height: 24rpx;
    border: 4rpx solid rgba(216, 150, 255, 0.3);
    border-top-color: #d896ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  &__status-text { font-size: 26rpx; color: #b8a8d4; }
  &__result { text-align: center; padding: 120rpx 32rpx; }
  &__result-icon { font-size: 120rpx; display: block; margin-bottom: 24rpx; }
  &__result-title { font-size: 40rpx; color: #ffffff; font-weight: 700; display: block; }
  &__result-sub { font-size: 26rpx; color: #b8a8d4; display: block; margin: 12rpx 0 32rpx; }
  &__result.is-error &__result-title { color: #f87171; }
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
