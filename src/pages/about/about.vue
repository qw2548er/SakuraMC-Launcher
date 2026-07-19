<script setup lang="ts">
import { ref } from 'vue'
import { APP_VERSION, checkUpdate, openReleasePage } from '@/utils/updater'
import { copyText } from '@/utils/format'

const GITHUB_REPO = 'https://github.com/qw2548er/SakuraMC-Launcher'
const GITHUB_ISSUES = 'https://github.com/qw2548er/SakuraMC-Launcher/issues/new'
const GITHUB_RELEASES = 'https://github.com/qw2548er/SakuraMC-Launcher/releases'

const checking = ref(false)
const lastCheckResult = ref<'up-to-date' | 'has-update' | 'failed' | null>(null)
const latestVersion = ref('')

async function doCheckUpdate() {
  if (checking.value) return
  checking.value = true
  lastCheckResult.value = null
  uni.showLoading({ title: '检查中...', mask: true })
  try {
    const update = await checkUpdate()
    uni.hideLoading()
    if (update) {
      lastCheckResult.value = 'has-update'
      latestVersion.value = update.version
      uni.showModal({
        title: '发现新版本',
        content: `新版本 v${update.version} 已发布\n\n${(update.body || '').slice(0, 200)}${update.body && update.body.length > 200 ? '...' : ''}`,
        confirmText: '前往下载',
        cancelText: '稍后',
        success: (r) => {
          if (r.confirm) openReleasePage()
        }
      })
    } else {
      lastCheckResult.value = 'up-to-date'
      uni.showToast({ title: '当前已是最新版本', icon: 'success' })
    }
  } catch (e: any) {
    lastCheckResult.value = 'failed'
    uni.hideLoading()
    uni.showToast({ title: '检查失败: ' + (e?.message || '网络错误'), icon: 'none' })
  } finally {
    checking.value = false
  }
}

function openGitHub() {
  // #ifdef H5
  window.open(GITHUB_REPO, '_blank')
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(GITHUB_REPO, () => {
    copyText(GITHUB_REPO)
    uni.showToast({ title: '链接已复制到剪贴板', icon: 'none' })
  })
  // #endif
}

function openIssues() {
  // #ifdef H5
  window.open(GITHUB_ISSUES, '_blank')
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(GITHUB_ISSUES, () => {
    copyText(GITHUB_ISSUES)
    uni.showToast({ title: '链接已复制到剪贴板', icon: 'none' })
  })
  // #endif
}

function openReleases() {
  // #ifdef H5
  window.open(GITHUB_RELEASES, '_blank')
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(GITHUB_RELEASES, () => {
    copyText(GITHUB_RELEASES)
    uni.showToast({ title: '链接已复制到剪贴板', icon: 'none' })
  })
  // #endif
}

function copyRepoLink() {
  copyText(GITHUB_REPO)
  uni.showToast({ title: '已复制仓库地址', icon: 'success' })
}

const features = [
  { icon: '🎮', title: '游戏启动', desc: '支持离线 / 微软 / 外置登录，Java 运行环境内置' },
  { icon: '📦', title: '版本管理', desc: '一键下载安装，支持整合包导入 (Modrinth / CurseForge)' },
  { icon: '🧩', title: '模组管理', desc: 'Mod / 资源包 / 光影包管理，支持拖拽排序' },
  { icon: '📁', title: '文件管理', desc: '内置 + 外部双重文件管理器，支持压缩解压' },
  { icon: '📥', title: '下载管理', desc: '暂停 / 继续 / 重试，SHA1 完整性校验' },
  { icon: '🌐', title: '樱花穿透', desc: '内网穿透，无需公网 IP 即可联机' },
  { icon: '🖥️', title: '服务器', desc: '快速添加常用服务器，一键加入' },
  { icon: '📷', title: '截图浏览', desc: '懒加载缩略图，全尺寸预览，一键分享' },
]

const techStack = [
  'uni-app', 'Vue 3', 'TypeScript', 'Pinia', 'Cordova', 'Vite'
]
</script>

<template>
  <view class="about">
    <view class="about__header">
      <text class="about__back" @tap="uni.navigateBack()">‹</text>
      <text class="about__title">关于</text>
      <view class="about__placeholder" />
    </view>

    <scroll-view scroll-y class="about__content">
      <!-- 应用信息卡 -->
      <view class="hero">
        <view class="hero__logo">🌸</view>
        <text class="hero__name">樱花 MC 启动器</text>
        <text class="hero__version">v{{ APP_VERSION }}</text>
        <text class="hero__slogan">跨平台 Minecraft Java 版启动器</text>
        <view class="hero__tags">
          <text v-for="tech in techStack" :key="tech" class="hero__tag">{{ tech }}</text>
        </view>
      </view>

      <!-- 检查更新 -->
      <view class="section">
        <view class="section__title">更新</view>
        <view class="section__body">
          <view class="action-row" @tap="doCheckUpdate">
            <text class="action-row__icon">🔄</text>
            <view class="action-row__main">
              <text class="action-row__label">{{ checking ? '检查中...' : '检查更新' }}</text>
              <text v-if="lastCheckResult === 'up-to-date'" class="action-row__desc action-row__desc--ok">✓ 已是最新版本</text>
              <text v-else-if="lastCheckResult === 'has-update'" class="action-row__desc action-row__desc--warn">发现新版本 v{{ latestVersion }}</text>
              <text v-else class="action-row__desc">点击检查 GitHub 上是否有新版本</text>
            </view>
            <text class="action-row__arrow">›</text>
          </view>
          <view class="action-row" @tap="openReleases">
            <text class="action-row__icon">📋</text>
            <view class="action-row__main">
              <text class="action-row__label">查看更新日志</text>
              <text class="action-row__desc">所有历史版本变更记录</text>
            </view>
            <text class="action-row__arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 功能特性 -->
      <view class="section">
        <view class="section__title">功能特性</view>
        <view class="section__body">
          <view v-for="f in features" :key="f.title" class="feature-row">
            <text class="feature-row__icon">{{ f.icon }}</text>
            <view class="feature-row__main">
              <text class="feature-row__title">{{ f.title }}</text>
              <text class="feature-row__desc">{{ f.desc }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 链接 -->
      <view class="section">
        <view class="section__title">链接</view>
        <view class="section__body">
          <view class="action-row" @tap="openGitHub">
            <text class="action-row__icon">🐙</text>
            <view class="action-row__main">
              <text class="action-row__label">GitHub 仓库</text>
              <text class="action-row__desc">qw2548er/SakuraMC-Launcher</text>
            </view>
            <text class="action-row__arrow">›</text>
          </view>
          <view class="action-row" @tap="copyRepoLink">
            <text class="action-row__icon">📋</text>
            <view class="action-row__main">
              <text class="action-row__label">复制仓库地址</text>
              <text class="action-row__desc">分享给好友</text>
            </view>
            <text class="action-row__arrow">›</text>
          </view>
          <view class="action-row" @tap="openIssues">
            <text class="action-row__icon">🐛</text>
            <view class="action-row__main">
              <text class="action-row__label">反馈问题 / 建议</text>
              <text class="action-row__desc">提交 Issue 帮助我们改进</text>
            </view>
            <text class="action-row__arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 关于作者 -->
      <view class="section">
        <view class="section__title">开发者</view>
        <view class="section__body">
          <view class="info-row">
            <text class="info-row__label">团队</text>
            <text class="info-row__value">SakuraMC Team</text>
          </view>
          <view class="info-row">
            <text class="info-row__label">协议</text>
            <text class="info-row__value">MIT License</text>
          </view>
          <view class="info-row">
            <text class="info-row__label">技术栈</text>
            <text class="info-row__value">uni-app + Vue 3 + TypeScript</text>
          </view>
          <view class="info-row">
            <text class="info-row__label">目标平台</text>
            <text class="info-row__value">Android / iOS / H5</text>
          </view>
        </view>
      </view>

      <!-- 免责声明 -->
      <view class="disclaimer">
        <text class="disclaimer__title">⚠️ 免责声明</text>
        <text class="disclaimer__text">
本启动器为开源项目，仅供学习和交流使用。Minecraft 版权归 Mojang / Microsoft 所有，请通过官方渠道购买正版游戏。使用本启动器产生的任何问题，开发者不承担任何责任。
        </text>
      </view>

      <view class="about__footer">
        <text class="about__footer-text">Made with 💖 by SakuraMC Team</text>
        <text class="about__footer-text">© 2026 SakuraMC. All rights reserved.</text>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.about {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1530 0%, #0f0d1f 100%);

  &__header {
    display: flex;
    align-items: center;
    padding: 60rpx 24rpx 16rpx;
  }
  &__back { font-size: 48rpx; color: #ffb7d5; margin-right: 16rpx; padding: 0 8rpx; }
  &__title { flex: 1; font-size: 44rpx; font-weight: 700; color: #fff; }
  &__placeholder { width: 64rpx; }
  &__content { flex: 1; padding: 0 24rpx 60rpx; }
  &__footer {
    text-align: center;
    padding: 32rpx 0 24rpx;
    opacity: 0.5;
  }
  &__footer-text {
    display: block;
    font-size: 22rpx;
    color: #fff;
    line-height: 1.6;
  }
}

.hero {
  text-align: center;
  padding: 40rpx 24rpx 32rpx;
  background: linear-gradient(135deg, rgba(255,183,213,0.12), rgba(255,143,171,0.06));
  border-radius: 20rpx;
  border: 2rpx solid rgba(255,183,213,0.15);
  margin-bottom: 24rpx;

  &__logo {
    font-size: 96rpx;
    line-height: 1;
    margin-bottom: 16rpx;
  }
  &__name {
    display: block;
    font-size: 36rpx;
    color: #fff;
    font-weight: 700;
    margin-bottom: 6rpx;
  }
  &__version {
    display: inline-block;
    font-size: 24rpx;
    color: #ffb7d5;
    background: rgba(255,183,213,0.15);
    padding: 4rpx 16rpx;
    border-radius: 20rpx;
    margin-bottom: 12rpx;
  }
  &__slogan {
    display: block;
    font-size: 24rpx;
    color: rgba(255,255,255,0.6);
    margin-bottom: 16rpx;
  }
  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx;
    justify-content: center;
  }
  &__tag {
    font-size: 20rpx;
    color: rgba(255,255,255,0.7);
    background: rgba(255,255,255,0.06);
    padding: 4rpx 14rpx;
    border-radius: 16rpx;
  }
}

.section {
  margin-bottom: 24rpx;

  &__title {
    font-size: 26rpx;
    color: rgba(255,255,255,0.5);
    font-weight: 600;
    padding: 0 12rpx 12rpx;
  }
  &__body {
    background: rgba(255,255,255,0.04);
    border-radius: 16rpx;
    border: 2rpx solid rgba(255,255,255,0.04);
    overflow: hidden;
  }
}

.action-row {
  display: flex;
  align-items: center;
  padding: 24rpx 20rpx;
  border-bottom: 2rpx solid rgba(255,255,255,0.04);

  &:last-child { border-bottom: none; }
  &:active { background: rgba(255,255,255,0.04); }

  &__icon { font-size: 32rpx; margin-right: 16rpx; flex-shrink: 0; }
  &__main { flex: 1; min-width: 0; }
  &__label {
    display: block;
    font-size: 28rpx;
    color: #fff;
    font-weight: 500;
  }
  &__desc {
    display: block;
    font-size: 22rpx;
    color: rgba(255,255,255,0.5);
    margin-top: 4rpx;
    &--ok { color: #52c41a; }
    &--warn { color: #ffb7d5; }
  }
  &__arrow { font-size: 32rpx; color: rgba(255,255,255,0.3); flex-shrink: 0; }
}

.feature-row {
  display: flex;
  align-items: flex-start;
  padding: 18rpx 20rpx;
  border-bottom: 2rpx solid rgba(255,255,255,0.04);

  &:last-child { border-bottom: none; }

  &__icon { font-size: 32rpx; margin-right: 16rpx; flex-shrink: 0; line-height: 1.4; }
  &__main { flex: 1; min-width: 0; }
  &__title {
    display: block;
    font-size: 26rpx;
    color: #fff;
    font-weight: 500;
  }
  &__desc {
    display: block;
    font-size: 22rpx;
    color: rgba(255,255,255,0.5);
    margin-top: 2rpx;
  }
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 20rpx;
  border-bottom: 2rpx solid rgba(255,255,255,0.04);

  &:last-child { border-bottom: none; }

  &__label { font-size: 26rpx; color: rgba(255,255,255,0.6); }
  &__value { font-size: 26rpx; color: #fff; }
}

.disclaimer {
  margin: 24rpx 0;
  padding: 20rpx;
  background: rgba(255,200,100,0.06);
  border-radius: 12rpx;
  border: 2rpx solid rgba(255,200,100,0.15);

  &__title {
    display: block;
    font-size: 24rpx;
    color: #ffcc44;
    font-weight: 600;
    margin-bottom: 8rpx;
  }
  &__text {
    display: block;
    font-size: 22rpx;
    color: rgba(255,255,255,0.6);
    line-height: 1.6;
  }
}
</style>
