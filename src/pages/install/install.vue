<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJavaStore } from '@/stores/java'
import McButton from '@/components/mc-button.vue'

const javaStore = useJavaStore()

const step = ref<'welcome' | 'select' | 'installing' | 'done'>('welcome')
const selectedJres = ref<string[]>(['jre17'])
const installProgress = ref(0)
const currentInstall = ref('')
const installStep = ref(0)

const jreList = [
  { id: 'jre8', name: 'JRE 8', version: '1.8.0_442', size: '约 80 MB', icon: '☕' },
  { id: 'jre11', name: 'JRE 11', version: '11.0.23', size: '约 120 MB', icon: '☕' },
  { id: 'jre17', name: 'JRE 17', version: '17.0.10', size: '约 150 MB', icon: '☕' },
  { id: 'jre21', name: 'JRE 21', version: '21.0.1', size: '约 180 MB', icon: '☕' },
  { id: 'jre25', name: 'JRE 25', version: '25.0.3', size: '约 200 MB', icon: '☕' }
]

function toggleJre(id: string) {
  const idx = selectedJres.value.indexOf(id)
  if (idx >= 0) {
    if (selectedJres.value.length > 1) {
      selectedJres.value.splice(idx, 1)
    }
  } else {
    selectedJres.value.push(id)
  }
}

function isSelected(id: string) {
  return selectedJres.value.includes(id)
}

function startInstall() {
  step.value = 'installing'
  installProgress.value = 0
  installStep.value = 0
  doInstall()
}

async function doInstall() {
  const items = selectedJres.value
  const totalSteps = items.length
  
  for (let i = 0; i < items.length; i++) {
    const jre = jreList.find(j => j.id === items[i])
    if (!jre) continue
    
    currentInstall.value = `${jre.name} (${jre.version})`
    installStep.value = i
    
    for (let p = 0; p <= 100; p += 5) {
      installProgress.value = Math.floor((i + p / 100) / totalSteps * 100)
      await new Promise(r => setTimeout(r, 60))
    }
  }
  
  const firstJre = jreList.find(j => j.id === selectedJres.value[0])
  if (firstJre) {
    javaStore.selectVersion(selectedJres.value[0])
    javaStore.updateVersion(selectedJres.value[0], {
      path: './runtime/' + firstJre.name.toLowerCase().replace(' ', '-') + '/bin/java'
    })
  }
  
  step.value = 'done'
}

function finish() {
  uni.setStorageSync('sakuram.firstrun.done', '1')
  uni.reLaunch({ url: '/pages/index/index' })
}

const totalProgress = computed(() => installProgress.value)
</script>

<template>
  <view class="install">
    <view class="install__bg">
      <view class="install__bg-pattern" />
    </view>
    
    <view class="install__container">
      <view v-if="step === 'welcome'" class="install__panel">
        <view class="install__logo">🌸</view>
        <text class="install__title">樱花 MC 启动器</text>
        <text class="install__subtitle">Sakura Minecraft Launcher</text>
        
        <view class="install__welcome">
          <text class="install__welcome-text">欢迎使用樱花 MC 启动器！</text>
          <text class="install__welcome-text">首次使用需要安装 Java 运行环境</text>
          <text class="install__welcome-text">请选择你需要的 Java 版本</text>
        </view>
        
        <McButton size="lg" glow block @click="step = 'select'">开始安装 →</McButton>
      </view>
      
      <view v-else-if="step === 'select'" class="install__panel">
        <text class="install__panel-title">选择 Java 版本</text>
        <text class="install__panel-desc">至少选择一个版本，推荐 JRE 17</text>
        
        <view class="jre-list">
          <view
            v-for="jre in jreList"
            :key="jre.id"
            class="jre-item"
            :class="{ 'jre-item--selected': isSelected(jre.id) }"
            @tap="toggleJre(jre.id)"
          >
            <view class="jre-item__check">
              <text v-if="isSelected(jre.id)">✓</text>
            </view>
            <view class="jre-item__icon">{{ jre.icon }}</view>
            <view class="jre-item__info">
              <text class="jre-item__name">{{ jre.name }}</text>
              <text class="jre-item__version">{{ jre.version }}</text>
            </view>
            <text class="jre-item__size">{{ jre.size }}</text>
          </view>
        </view>
        
        <view class="install__actions">
          <McButton variant="ghost" @click="step = 'welcome'">返回</McButton>
          <McButton glow @click="startInstall">安装选中 ({{ selectedJres.length }})</McButton>
        </view>
      </view>
      
      <view v-else-if="step === 'installing'" class="install__panel">
        <text class="install__panel-title">正在安装...</text>
        <text class="install__panel-desc">{{ currentInstall }}</text>
        
        <view class="install__progress-wrap">
          <view class="install__progress-bar">
            <view class="install__progress-fill" :style="{ width: totalProgress + '%' }" />
          </view>
          <text class="install__progress-text">{{ totalProgress }}%</text>
        </view>
        
        <view class="install__jre-status">
          <view
            v-for="(jre, idx) in jreList.filter(j => selectedJres.includes(j.id))"
            :key="jre.id"
            class="jre-status-item"
          >
            <text class="jre-status-item__icon">
              {{ idx < installStep ? '✓' : idx === installStep ? '⏳' : '○' }}
            </text>
            <text class="jre-status-item__name">{{ jre.name }} {{ jre.version }}</text>
          </view>
        </view>
        
        <text class="install__hint">正在解压文件，请稍候...</text>
      </view>
      
      <view v-else-if="step === 'done'" class="install__panel">
        <view class="install__done-icon">🎉</view>
        <text class="install__panel-title">安装完成！</text>
        <text class="install__panel-desc">已成功安装 {{ selectedJres.length }} 个 Java 版本</text>
        
        <view class="install__done-list">
          <view
            v-for="jre in jreList.filter(j => selectedJres.includes(j.id))"
            :key="jre.id"
            class="done-item"
          >
            <text class="done-item__icon">✓</text>
            <text class="done-item__text">{{ jre.name }} {{ jre.version }}</text>
          </view>
        </view>
        
        <McButton size="lg" glow block @click="finish">进入启动器 →</McButton>
      </view>
    </view>
    
    <view class="install__footer">
      <text class="install__footer-text">🌸 樱花 MC 启动器 · v0.2.0</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.install {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a0f2e 0%, #2d1b4e 50%, #1a0f2e 100%);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  
  &__bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    
    &-pattern {
      position: absolute;
      inset: -50%;
      background: 
        radial-gradient(circle at 20% 30%, rgba(255, 183, 213, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(216, 150, 255, 0.15) 0%, transparent 50%);
      animation: floatBg 20s ease-in-out infinite;
    }
  }
  
  &__container {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 680rpx;
  }
  
  &__panel {
    background: rgba(26, 15, 46, 0.9);
    backdrop-filter: blur(20px);
    border: 2rpx solid rgba(216, 150, 255, 0.3);
    border-radius: 32rpx;
    padding: 48rpx 40rpx;
    box-shadow: 0 0 80rpx rgba(216, 150, 255, 0.2);
  }
  
  &__logo {
    width: 120rpx;
    height: 120rpx;
    margin: 0 auto 24rpx;
    background: linear-gradient(135deg, #ffb7d5, #d896ff);
    border-radius: 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 64rpx;
    box-shadow: 0 12rpx 40rpx rgba(216, 150, 255, 0.5);
  }
  
  &__title {
    display: block;
    text-align: center;
    font-size: 44rpx;
    font-weight: 800;
    background: linear-gradient(135deg, #ffb7d5, #d896ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 8rpx;
  }
  
  &__subtitle {
    display: block;
    text-align: center;
    font-size: 24rpx;
    color: #b8a8d4;
    letter-spacing: 4rpx;
    margin-bottom: 40rpx;
  }
  
  &__welcome {
    background: rgba(216, 150, 255, 0.1);
    border-radius: 20rpx;
    padding: 32rpx;
    margin-bottom: 40rpx;
    
    &-text {
      display: block;
      font-size: 28rpx;
      color: #ffffff;
      text-align: center;
      line-height: 2;
    }
  }
  
  &__panel-title {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: #ffffff;
    text-align: center;
    margin-bottom: 8rpx;
  }
  
  &__panel-desc {
    display: block;
    font-size: 24rpx;
    color: #b8a8d4;
    text-align: center;
    margin-bottom: 32rpx;
  }
  
  &__actions {
    display: flex;
    gap: 16rpx;
    margin-top: 32rpx;
  }
  
  &__progress-wrap {
    margin: 32rpx 0;
  }
  
  &__progress-bar {
    height: 16rpx;
    background: rgba(106, 90, 138, 0.3);
    border-radius: 8rpx;
    overflow: hidden;
    margin-bottom: 12rpx;
  }
  
  &__progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ffb7d5, #d896ff);
    border-radius: 8rpx;
    transition: width 0.1s;
  }
  
  &__progress-text {
    display: block;
    text-align: center;
    font-size: 28rpx;
    font-weight: 700;
    color: #ffb7d5;
  }
  
  &__jre-status {
    background: rgba(15, 15, 26, 0.6);
    border-radius: 16rpx;
    padding: 20rpx;
    margin-bottom: 24rpx;
  }
  
  &__hint {
    display: block;
    text-align: center;
    font-size: 22rpx;
    color: #6a5a8a;
  }
  
  &__done-icon {
    font-size: 80rpx;
    text-align: center;
    margin-bottom: 16rpx;
  }
  
  &__done-list {
    background: rgba(15, 15, 26, 0.6);
    border-radius: 16rpx;
    padding: 24rpx;
    margin: 32rpx 0;
  }
  
  &__footer {
    position: absolute;
    bottom: 32rpx;
    left: 0;
    right: 0;
    text-align: center;
    
    &-text {
      font-size: 22rpx;
      color: #6a5a8a;
    }
  }
}

.jre-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.jre-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  background: rgba(45, 27, 78, 0.6);
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 16rpx;
  transition: all 0.2s;
  
  &--selected {
    background: linear-gradient(135deg, rgba(255, 183, 213, 0.2), rgba(216, 150, 255, 0.2));
    border-color: rgba(216, 150, 255, 0.5);
  }
  
  &__check {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    background: rgba(216, 150, 255, 0.2);
    border: 2rpx solid rgba(216, 150, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    color: #ffb7d5;
    flex-shrink: 0;
    
    .jre-item--selected & {
      background: linear-gradient(135deg, #ffb7d5, #d896ff);
      border-color: transparent;
      color: #fff;
    }
  }
  
  &__icon {
    font-size: 36rpx;
    flex-shrink: 0;
  }
  
  &__info {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    display: block;
    font-size: 28rpx;
    font-weight: 600;
    color: #ffffff;
  }
  
  &__version {
    display: block;
    font-size: 22rpx;
    color: #b8a8d4;
    margin-top: 2rpx;
  }
  
  &__size {
    font-size: 22rpx;
    color: #6a5a8a;
    flex-shrink: 0;
  }
}

.jre-status-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  
  &__icon {
    font-size: 24rpx;
    color: #ffb7d5;
    width: 32rpx;
    text-align: center;
  }
  
  &__name {
    font-size: 24rpx;
    color: #b8a8d4;
  }
}

.done-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  
  &__icon {
    color: #7ee787;
    font-size: 24rpx;
  }
  
  &__text {
    font-size: 26rpx;
    color: #ffffff;
  }
}

@keyframes floatBg {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-5%, -5%) scale(1.1); }
}
</style>
