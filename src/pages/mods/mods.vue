<script setup lang="ts">
import { useVersionStore } from '@/stores/version'
import McCard from '@/components/mc-card.vue'
import NotDeveloped from '@/components/not-developed.vue'

const versionStore = useVersionStore()

// 这个页面是 Mod 加载器统一管理页面, MVP 简化为引导到版本详情
function openVersion(id: string) {
  uni.navigateTo({ url: '/pages/versions/version-detail?id=' + id })
}
</script>

<template>
  <view class="mods">
    <NotDeveloped variant="banner" feature="Mod 下载与管理" plan="v0.4.0" />
    <view class="mods__header">
      <text class="mods__title">Mod 管理</text>
      <text class="mods__subtitle">Forge / Fabric / Quilt / OptiFine 统一管理</text>
    </view>

    <McCard>
      <text class="mods__tip">💡 提示</text>
      <text class="mods__line">Mod 加载器在「版本详情」中按版本安装, 请先选择游戏版本</text>
    </McCard>

    <view v-if="versionStore.selectedId" class="mods__current">
      <McCard title="当前选择" glow>
        <view class="current-row" @tap="openVersion(versionStore.selectedId)">
          <view>
            <text class="current-row__name">Minecraft {{ versionStore.selectedId }}</text>
            <text class="current-row__sub">点击查看 Mod 加载器</text>
          </view>
          <text class="current-row__arrow">›</text>
        </view>
      </McCard>
    </view>

    <view v-else class="mods__empty">
      <text class="mods__empty-icon">🧩</text>
      <text class="mods__empty-text">请先在「版本」页选择一个游戏版本</text>
      <view class="mods__link" @tap="uni.switchTab({ url: '/pages/versions/versions' })">前往版本管理</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.mods {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  &__header { margin-bottom: 24rpx; }
  &__title { font-size: 44rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 24rpx; color: #b8a8d4; display: block; margin-top: 4rpx; }
  &__tip { font-size: 26rpx; color: #d896ff; font-weight: 600; display: block; margin-bottom: 8rpx; }
  &__line { font-size: 24rpx; color: #b8a8d4; display: block; line-height: 1.6; }
  &__current { margin-top: 24rpx; }
  &__empty { text-align: center; padding: 100rpx 0; }
  &__empty-icon { font-size: 100rpx; display: block; margin-bottom: 16rpx; }
  &__empty-text { font-size: 26rpx; color: #6a5a8a; display: block; }
  &__link {
    display: inline-block; margin-top: 16rpx;
    color: #d896ff; font-size: 26rpx;
    padding: 12rpx 24rpx;
    background: rgba(216, 150, 255, 0.1);
    border-radius: 16rpx;
  }
}
.current-row {
  display: flex; align-items: center; justify-content: space-between;
  &__name { font-size: 30rpx; color: #ffffff; font-weight: 600; display: block; }
  &__sub { font-size: 22rpx; color: #6a5a8a; display: block; margin-top: 4rpx; }
  &__arrow { font-size: 48rpx; color: #6a5a8a; }
}
</style>
