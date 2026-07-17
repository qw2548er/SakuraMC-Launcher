<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useSettingsStore } from '@/stores/settings'
import { useAccountStore } from '@/stores/account'
import { useFrpStore } from '@/stores/frp'

onLaunch(() => {
  console.log('[App] onLaunch - 樱花 MC 启动器启动')
  const settings = useSettingsStore()
  const account = useAccountStore()
  const frp = useFrpStore()
  settings.load()
  account.load()
  frp.load()
})

onShow(() => {
  console.log('[App] onShow')
})

onHide(() => {
  console.log('[App] onHide')
})
</script>

<style lang="scss">
@import '@/uni.scss';

page {
  background: $bg-dark;
  color: $text-primary;
  font-size: 28rpx;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
}

.safe-top {
  padding-top: env(safe-area-inset-top);
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.safe-left {
  padding-left: env(safe-area-inset-left);
}

.safe-right {
  padding-right: env(safe-area-inset-right);
}

.safe-area {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

* {
  box-sizing: border-box;
}

::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.gradient-text {
  background: linear-gradient(135deg, $primary 0%, $primary-dark 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.glass-card {
  background: rgba(45, 27, 78, 0.6);
  backdrop-filter: blur(20rpx);
  border: 1rpx solid $border;
  border-radius: $radius-lg;
}

.flex { display: flex; }
.flex-col { display: flex; flex-direction: column; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.flex-1 { flex: 1; }
.gap-1 { gap: 8rpx; }
.gap-2 { gap: 16rpx; }
.gap-3 { gap: 24rpx; }
.gap-4 { gap: 32rpx; }

.text-xs { font-size: 22rpx; }
.text-sm { font-size: 26rpx; }
.text-base { font-size: 28rpx; }
.text-lg { font-size: 32rpx; }
.text-xl { font-size: 38rpx; }
.text-2xl { font-size: 44rpx; }
.text-3xl { font-size: 56rpx; }

.text-muted { color: $text-muted; }
.text-secondary { color: $text-secondary; }
.text-primary-c { color: $primary; }

.font-bold { font-weight: 700; }
.font-semi { font-weight: 600; }

.p-2 { padding: 16rpx; }
.p-3 { padding: 24rpx; }
.p-4 { padding: 32rpx; }
.px-3 { padding-left: 24rpx; padding-right: 24rpx; }
.py-2 { padding-top: 16rpx; padding-bottom: 16rpx; }
.py-3 { padding-top: 24rpx; padding-bottom: 24rpx; }
.mt-2 { margin-top: 16rpx; }
.mt-3 { margin-top: 24rpx; }
.mt-4 { margin-top: 32rpx; }
.mb-2 { margin-bottom: 16rpx; }
.mb-3 { margin-bottom: 24rpx; }
.mb-4 { margin-bottom: 32rpx; }

.w-full { width: 100%; }
.h-full { height: 100%; }

.rounded-md { border-radius: $radius-md; }
.rounded-lg { border-radius: $radius-lg; }
.rounded-xl { border-radius: $radius-xl; }
.rounded-full { border-radius: 9999rpx; }
</style>
