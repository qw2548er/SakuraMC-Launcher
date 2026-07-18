<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAccountStore } from '@/stores/account'

const accountStore = useAccountStore()

const showAddModal = ref(false)
const addType = ref<'offline' | 'microsoft'>('offline')
const offlineName = ref('')

onMounted(() => {
  accountStore.load()
})

const accountList = computed(() => accountStore.accounts)

function selectAccount(id: string) {
  accountStore.select(id)
  uni.showToast({ title: '已切换账号', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 500)
}

function deleteAccount(id: string) {
  uni.showModal({
    title: '删除账号',
    content: '确定要删除这个账号吗？',
    confirmColor: '#ff6b6b',
    success: (res) => {
      if (res.confirm) {
        accountStore.remove(id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function openAddModal() {
  addType.value = 'offline'
  offlineName.value = ''
  showAddModal.value = true
}

function addOfflineAccount() {
  if (!offlineName.value.trim()) {
    uni.showToast({ title: '请输入玩家名', icon: 'none' })
    return
  }
  accountStore.addOffline(offlineName.value.trim())
  showAddModal.value = false
  uni.showToast({ title: '添加成功', icon: 'success' })
}

function addMicrosoftAccount() {
  uni.showToast({ title: '微软登录开发中', icon: 'none' })
}

function getSkinUrl(name: string): string {
  return `https://mc-heads.net/avatar/${name}/128`
}
</script>

<template>
  <view class="accounts">
    <view class="accounts__header">
      <text class="accounts__back" @tap="uni.navigateBack()">‹</text>
      <text class="accounts__title">账号管理</text>
      <view class="accounts__add" @tap="openAddModal">
        <text>+</text>
      </view>
    </view>
    
    <scroll-view scroll-y class="accounts__content">
      <view v-if="accountList.length === 0" class="accounts__empty">
        <text class="accounts__empty-icon">👤</text>
        <text class="accounts__empty-text">还没有添加账号</text>
        <text class="accounts__empty-hint">点击右上角添加</text>
      </view>
      
      <view 
        v-for="acc in accountList" 
        :key="acc.id"
        class="account-card"
        :class="{ 'account-card--active': accountStore.selectedId === acc.id }"
        @tap="selectAccount(acc.id)"
      >
        <image 
          class="account-card__avatar" 
          :src="getSkinUrl(acc.username)"
          mode="aspectFill"
        />
        <view class="account-card__main">
          <text class="account-card__name">{{ acc.username }}</text>
          <text class="account-card__type">
            {{ acc.type === 'microsoft' ? '微软账号' : '离线账号' }}
            <text v-if="accountStore.selectedId === acc.id" class="account-card__current"> · 当前</text>
          </text>
        </view>
        <view class="account-card__actions">
          <view class="account-card__delete" @tap.stop="deleteAccount(acc.id)">
            <text>删除</text>
          </view>
        </view>
      </view>
      
      <view class="accounts__tips">
        <text class="accounts__tips-title">💡 提示</text>
        <text class="accounts__tips-text">• 离线账号只能进入离线模式服务器</text>
        <text class="accounts__tips-text">• 微软账号可以进入正版服务器</text>
        <text class="accounts__tips-text">• 建议使用微软账号以获得完整体验</text>
      </view>
    </scroll-view>
    
    <view v-if="showAddModal" class="modal-mask" @tap="showAddModal = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-panel__title">添加账号</text>
        <text class="modal-panel__desc">选择要添加的账号类型</text>
        
        <view class="add-type-tabs">
          <view 
            class="add-type-tab"
            :class="{ 'add-type-tab--active': addType === 'offline' }"
            @tap="addType = 'offline'"
          >
            <text class="add-type-tab__icon">👤</text>
            <text class="add-type-tab__name">离线账号</text>
          </view>
          <view 
            class="add-type-tab"
            :class="{ 'add-type-tab--active': addType === 'microsoft' }"
            @tap="addType = 'microsoft'"
          >
            <text class="add-type-tab__icon">🪟</text>
            <text class="add-type-tab__name">微软账号</text>
          </view>
        </view>
        
        <view v-if="addType === 'offline'" class="add-offline">
          <text class="add-offline__label">玩家名</text>
          <input 
            class="add-offline__input"
            v-model="offlineName"
            placeholder="输入你的玩家名"
            placeholder-style="color: #666"
            maxlength="16"
          />
          <text class="add-offline__hint">只能包含字母、数字、下划线，最多16个字符</text>
        </view>
        
        <view v-if="addType === 'microsoft'" class="add-microsoft">
          <view class="add-microsoft__icon">🪟</view>
          <text class="add-microsoft__title">微软账号登录</text>
          <text class="add-microsoft__desc">使用微软账号登录，可进入正版服务器</text>
          <text class="add-microsoft__soon">即将推出...</text>
        </view>
        
        <view class="modal-actions">
          <view class="modal-btn modal-btn--ghost" @tap="showAddModal = false">
            <text>取消</text>
          </view>
          <view 
            class="modal-btn modal-btn--primary" 
            @tap="addType === 'offline' ? addOfflineAccount() : addMicrosoftAccount()"
          >
            <text>{{ addType === 'offline' ? '添加' : '登录' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.accounts {
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

.account-card {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14rpx;
  margin-bottom: 12rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.04);
  transition: all 0.2s;
  
  &--active {
    border-color: #ff8fab;
    background: rgba(255, 183, 213, 0.08);
  }
  
  &:active {
    transform: scale(0.99);
  }
  
  &__avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 16rpx;
    margin-right: 16rpx;
    background: rgba(255, 183, 213, 0.1);
  }
  
  &__main {
    flex: 1;
    min-width: 0;
  }
  
  &__name {
    font-size: 30rpx;
    color: #fff;
    font-weight: 600;
    display: block;
  }
  
  &__type {
    font-size: 22rpx;
    color: #888;
    display: block;
    margin-top: 4rpx;
  }
  
  &__current {
    color: #52c41a;
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

.add-type-tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.add-type-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 16rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14rpx;
  border: 2rpx solid transparent;
  transition: all 0.2s;
  
  &--active {
    border-color: #ff8fab;
    background: rgba(255, 183, 213, 0.1);
  }
  
  &__icon {
    font-size: 40rpx;
    margin-bottom: 8rpx;
  }
  
  &__name {
    font-size: 24rpx;
    color: #fff;
  }
}

.add-offline {
  margin-bottom: 24rpx;
  
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
  
  &__hint {
    font-size: 22rpx;
    color: #666;
    display: block;
    margin-top: 8rpx;
  }
}

.add-microsoft {
  text-align: center;
  padding: 40rpx 0;
  margin-bottom: 24rpx;
  
  &__icon {
    font-size: 64rpx;
    display: block;
    margin-bottom: 16rpx;
  }
  
  &__title {
    font-size: 30rpx;
    color: #fff;
    font-weight: 600;
    display: block;
  }
  
  &__desc {
    font-size: 24rpx;
    color: #888;
    display: block;
    margin: 8rpx 0;
  }
  
  &__soon {
    font-size: 22rpx;
    color: #ffb7d5;
    display: block;
    margin-top: 16rpx;
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
