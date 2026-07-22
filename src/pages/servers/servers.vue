<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useServerStore } from '@/stores/server'

const serverStore = useServerStore()
const showAddModal = ref(false)
const newName = ref('')
const newAddress = ref('')

onMounted(() => {
  serverStore.load()
})

function addServer() {
  if (!newName.value.trim() || !newAddress.value.trim()) {
    uni.showToast({ title: '请填写完整', icon: 'none' })
    return
  }
  serverStore.add({
    name: newName.value.trim(),
    host: newAddress.value.trim(),
    port: 25565
  })
  showAddModal.value = false
  newName.value = ''
  newAddress.value = ''
  uni.showToast({ title: '添加成功', icon: 'success' })
}

function removeServer(id: string) {
  uni.showModal({
    title: '删除服务器',
    content: '确定要删除这个服务器吗？',
    confirmColor: '#ff6b6b',
    success: (res) => {
      if (res.confirm) {
        serverStore.remove(id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function selectServer(id: string) {
  serverStore.setActive(id)
  serverStore.persist()
  uni.showToast({ title: '已选择', icon: 'success' })
}

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <view class="servers">
    <view class="servers__header">
      <text class="servers__back" @tap="goBack">‹</text>
      <text class="servers__title">服务器管理</text>
      <view class="servers__add" @tap="showAddModal = true">
        <text>+</text>
      </view>
    </view>
    
    <scroll-view scroll-y class="servers__content">
      <view v-if="serverStore.servers.length === 0" class="servers__empty">
        <text class="servers__empty-icon">🖥️</text>
        <text class="servers__empty-text">还没有添加服务器</text>
        <text class="servers__empty-hint">点击右上角添加</text>
      </view>
      
      <view class="servers__list">
        <view
          v-for="srv in serverStore.servers"
          :key="srv.id"
          class="server-card"
          :class="{ 'server-card--active': serverStore.activeServerId === srv.id }"
          @tap="selectServer(srv.id)"
        >
          <view class="server-card__icon">🖥️</view>
          <view class="server-card__main">
            <text class="server-card__name">{{ srv.name }}</text>
            <text class="server-card__address">{{ srv.host }}:{{ srv.port }}</text>
          </view>
          <view class="server-card__actions">
            <view class="server-card__delete" @tap.stop="removeServer(srv.id)">
              <text>删除</text>
            </view>
          </view>
        </view>
      </view>
      
      <view class="servers__tips">
        <text class="servers__tips-title">💡 提示</text>
        <text class="servers__tips-text">• 选择服务器后启动游戏会自动加入</text>
        <text class="servers__tips-text">• 支持添加多个服务器快速切换</text>
        <text class="servers__tips-text">• 使用猫宁穿透可以开服让朋友加入</text>
      </view>
    </scroll-view>
    
    <view v-if="showAddModal" class="modal-mask" @tap="showAddModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">添加服务器</text>
        <text class="modal-panel__desc">添加一个 Minecraft 服务器</text>
        
        <view class="form-field">
          <text class="form-field__label">服务器名称</text>
          <input 
            class="form-field__input"
            v-model="newName"
            placeholder="例如：我的服务器"
            placeholder-style="color: #666"
          />
        </view>
        
        <view class="form-field">
          <text class="form-field__label">服务器地址</text>
          <input 
            class="form-field__input"
            v-model="newAddress"
            placeholder="例如：mc.example.com"
            placeholder-style="color: #666"
          />
        </view>
        
        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="showAddModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn modal-btn--primary" @tap="addServer">
            <text>添加</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.servers {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1530 0%, #0f0d1f 100%);
  
  &__header {
    display: flex;
    align-items: center;
    padding: 60rpx 24rpx 16rpx;
  }
  
  &__back {
    font-size: 48rpx;
    color: #ffb7d5;
    margin-right: 16rpx;
    padding: 0 8rpx;
  }
  
  &__title {
    flex: 1;
    font-size: 44rpx;
    font-weight: 700;
    color: #fff;
  }
  
  &__add {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    border-radius: 16rpx;
    font-size: 40rpx;
    color: #fff;
    font-weight: 300;
  }
  
  &__content {
    flex: 1;
    padding: 0 24rpx 40rpx;
  }
  
  &__list {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }
  
  &__empty {
    text-align: center;
    padding: 120rpx 0;
  }
  
  &__empty-icon {
    font-size: 80rpx;
    display: block;
    margin-bottom: 16rpx;
  }
  
  &__empty-text {
    font-size: 30rpx;
    color: #fff;
    display: block;
    margin-bottom: 8rpx;
  }
  
  &__empty-hint {
    font-size: 24rpx;
    color: #666;
    display: block;
  }
  
  &__tips {
    margin-top: 32rpx;
    padding: 20rpx 24rpx;
    background: rgba(255, 183, 213, 0.08);
    border-radius: 12rpx;
    border: 2rpx solid rgba(255, 183, 213, 0.15);
  }
  
  &__tips-title {
    font-size: 26rpx;
    color: #ffb7d5;
    font-weight: 600;
    display: block;
    margin-bottom: 12rpx;
  }
  
  &__tips-text {
    font-size: 22rpx;
    color: #888;
    display: block;
    line-height: 1.8;
  }
}

.server-card {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.04);
  transition: all 0.2s;
  
  &--active {
    border-color: #ff8fab;
    background: rgba(255, 183, 213, 0.08);
  }
  
  &:active {
    transform: scale(0.99);
  }
  
  &__icon {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36rpx;
    background: rgba(255, 183, 213, 0.1);
    border-radius: 14rpx;
    margin-right: 16rpx;
  }
  
  &__main {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    font-size: 28rpx;
    color: #fff;
    font-weight: 600;
    display: block;
  }
  
  &__address {
    font-size: 22rpx;
    color: #888;
    display: block;
    margin-top: 4rpx;
    font-family: monospace;
  }
  
  &__actions {
    flex-shrink: 0;
  }
  
  &__delete {
    padding: 10rpx 20rpx;
    background: rgba(255, 107, 107, 0.15);
    border-radius: 10rpx;
    font-size: 22rpx;
    color: #ff6b6b;
  }
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.modal-panel {
  background: #1e1a2e;
  border-radius: 20rpx;
  width: 100%;
  max-width: 600rpx;
  padding: 32rpx;
  border: 2rpx solid rgba(255, 183, 213, 0.2);
  
  &__title {
    font-size: 34rpx;
    font-weight: 700;
    color: #fff;
    display: block;
  }
  
  &__desc {
    font-size: 24rpx;
    color: #888;
    display: block;
    margin-top: 8rpx;
    margin-bottom: 24rpx;
  }
}

.form-field {
  margin-bottom: 20rpx;
  
  &__label {
    font-size: 24rpx;
    color: #aaa;
    display: block;
    margin-bottom: 8rpx;
  }
  
  &__input {
    width: 100%;
    height: 80rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    color: #fff;
    box-sizing: border-box;
  }
}

.modal-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.modal-btn {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  font-size: 28rpx;
  
  &--ghost {
    background: rgba(255, 255, 255, 0.08);
    color: #aaa;
  }
  
  &--primary {
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    color: #fff;
    font-weight: 600;
  }
  
  &:active {
    opacity: 0.8;
  }
}
</style>
