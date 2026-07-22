<script lang="ts">
/** 检查是否需要显示引导 */
export function shouldShowOnboarding(): boolean {
  try {
    return !uni.getStorageSync('sakuramc.onboarding.v1.done')
  } catch {
    return true
  }
}
</script>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { APP_VERSION } from '@/utils/updater'
import { requestCorePermissions } from '@/utils/permissions'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const STORAGE_KEY = 'sakuramc.onboarding.v1.done'

const current = ref(0)
const requesting = ref(false)

const slides = [
  {
    icon: '🐱',
    title: '欢迎使用猫宁MC启动器',
    subtitle: `v${APP_VERSION}`,
    body: '跨平台 Minecraft Java 版启动器\n内嵌猫宁穿透完整功能\n支持整合包导入、模组管理、截图浏览等',
    accent: '#ff9f43'
  },
  {
    icon: '📂',
    title: '存储权限',
    body: '启动器需要读写设备存储来:\n  • 下载游戏文件到 /MaoNingMC/.minecraft/\n  • 导入整合包、模组、存档\n  • 保存截图、日志、配置\n\n请允许「所有文件访问权限」以获得完整体验。',
    accent: '#8fbbff'
  },
  {
    icon: '🔐',
    title: '其他权限',
    body: '为提供完整功能,启动器还会请求:\n  • 通知权限 — 下载进度通知\n  • 网络权限 — 下载游戏 / 在线验证\n  • 前台服务 — 后台下载保活\n\n您可以随时在系统设置中管理这些权限。',
    accent: '#ffcc44'
  },
  {
    icon: '🎮',
    title: '快速上手',
    body: '1. 在「账号」中添加离线 / 微软账号\n2. 在「版本」中下载游戏版本\n3. 在「模组」中导入模组 / 整合包\n4. 回到首页点击「启动游戏」\n\n遇到问题可在「设置 → 关于」反馈。',
    accent: '#52c41a'
  }
]

const currentSlide = computed(() => slides[current.value])
const isLast = computed(() => current.value === slides.length - 1)
const progressDots = computed(() => slides.map((_, i) => i === current.value))

function next() {
  if (isLast.value) {
    finish()
  } else {
    current.value++
  }
}

function prev() {
  if (current.value > 0) current.value--
}

function skip() {
  finish()
}

async function finish() {
  if (requesting.value) return
  requesting.value = true
  // 最后一页时主动请求权限
  try {
    // #ifdef APP-PLUS
    await requestCorePermissions().catch(() => {})
    // #endif
  } finally {
    try {
      uni.setStorageSync(STORAGE_KEY, true)
    } catch {}
    requesting.value = false
    emit('close')
  }
}
</script>

<template>
  <view class="ob-mask" @tap.self="skip">
    <view class="ob-panel" @tap.stop>
      <!-- 顶部进度 -->
      <view class="ob-progress">
        <view
          v-for="(active, i) in progressDots"
          :key="i"
          class="ob-progress__dot"
          :class="{ 'ob-progress__dot--active': active }"
          :style="active ? { background: currentSlide.accent } : {}"
        />
      </view>

      <!-- 内容区 -->
      <view class="ob-content">
        <view class="ob-icon" :style="{ background: currentSlide.accent + '20' }">
          <text :style="{ color: currentSlide.accent }">{{ currentSlide.icon }}</text>
        </view>
        <text class="ob-title">{{ currentSlide.title }}</text>
        <text v-if="currentSlide.subtitle" class="ob-subtitle" :style="{ color: currentSlide.accent }">{{ currentSlide.subtitle }}</text>
        <text class="ob-body">{{ currentSlide.body }}</text>
      </view>

      <!-- 底部按钮 -->
      <view class="ob-actions">
        <view v-if="!isLast" class="ob-btn ob-btn--ghost" @tap="skip">
          <text>{{ requesting ? '请稍候...' : '跳过' }}</text>
        </view>
        <view v-if="current > 0 && !isLast" class="ob-btn ob-btn--ghost" @tap="prev">
          <text>上一步</text>
        </view>
        <view class="ob-btn ob-btn--primary" :style="{ background: currentSlide.accent }" @tap="next">
          <text>{{ isLast ? (requesting ? '授权中...' : '授权并开始') : '下一步' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ob-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  backdrop-filter: blur(12px);
}

.ob-panel {
  background: linear-gradient(180deg, rgba(30, 25, 50, 0.98), rgba(15, 13, 31, 0.98));
  border: 2rpx solid rgba(255, 183, 213, 0.3);
  border-radius: 24rpx;
  width: 100%;
  max-width: 640rpx;
  padding: 40rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.6);
}

.ob-progress {
  display: flex;
  justify-content: center;
  gap: 12rpx;
  margin-bottom: 40rpx;

  &__dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    transition: all 0.3s ease;

    &--active {
      width: 48rpx;
      border-radius: 8rpx;
    }
  }
}

.ob-content {
  flex: 1;
  text-align: center;
  padding: 24rpx 16rpx 40rpx;
}

.ob-icon {
  width: 140rpx;
  height: 140rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24rpx;
  font-size: 72rpx;
  line-height: 1;
}

.ob-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8rpx;
}

.ob-subtitle {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  opacity: 0.9;
}

.ob-body {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.7;
  text-align: left;
  white-space: pre-wrap;
  margin-top: 16rpx;
}

.ob-actions {
  display: flex;
  gap: 12rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid rgba(255, 255, 255, 0.06);
}

.ob-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 600;

  &--ghost {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    flex: 0 0 auto;
    padding: 0 24rpx;
    min-width: 160rpx;
    font-weight: 500;
  }

  &--primary {
    color: #fff;
    flex: 1;

    &:active {
      opacity: 0.85;
    }
  }
}
</style>
