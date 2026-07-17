<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useVersionStore } from '@/stores/version'
import McCard from '@/components/mc-card.vue'
import McButton from '@/components/mc-button.vue'
import McInput from '@/components/mc-input.vue'
import McModal from '@/components/mc-modal.vue'
import GameIcon from '@/components/game-icon.vue'
import { isValidMCUsername, relativeTime } from '@/utils/format'

const accountStore = useAccountStore()
const versionStore = useVersionStore()

const showAddModal = ref(false)
const newUsername = ref('')
const usernameError = ref('')
const showMicrosoftInfo = ref(false)

function selectAccount(id: string) {
  accountStore.select(id)
  uni.showToast({ title: '已选择', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 400)
}

function addOffline() {
  const name = newUsername.value.trim()
  if (!isValidMCUsername(name)) {
    usernameError.value = '用户名必须 3-16 位, 只能包含字母、数字、下划线'
    return
  }
  usernameError.value = ''
  accountStore.addOffline(name)
  newUsername.value = ''
  showAddModal.value = false
  uni.showToast({ title: '离线账号已添加', icon: 'success' })
}

function removeAccount(id: string, name: string) {
  uni.showModal({
    title: '删除账号',
    content: `确定要删除账号 "${name}" 吗?`,
    confirmColor: '#f87171',
    success: r => {
      if (r.confirm) {
        accountStore.remove(id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function gotoMicrosoftLogin() {
  uni.navigateTo({ url: '/pages/accounts/microsoft-login' })
}

const sortedAccounts = computed(() => {
  return [...accountStore.accounts].sort((a, b) => {
    if (a.id === accountStore.selectedId) return -1
    if (b.id === accountStore.selectedId) return 1
    return (b.lastUsedAt || b.createdAt) - (a.lastUsedAt || a.createdAt)
  })
})
</script>

<template>
  <view class="accounts">
    <view class="accounts__hero">
      <text class="accounts__title">账号管理</text>
      <text class="accounts__subtitle">支持微软账号、离线账号, 共 {{ accountStore.accounts.length }} 个</text>
    </view>

    <view class="accounts__add-row">
      <McCard padding="sm">
        <view class="add-row">
          <view class="add-row__item" @tap="showAddModal = true">
            <view class="add-row__icon">➕</view>
            <view>
              <text class="add-row__label">添加离线账号</text>
              <text class="add-row__sub">不需要正版验证, 立即可用</text>
            </view>
          </view>
          <view class="add-row__item" @tap="gotoMicrosoftLogin">
            <view class="add-row__icon add-row__icon--ms">⊞</view>
            <view>
              <text class="add-row__label">登录微软账号</text>
              <text class="add-row__sub">正版 Java 版, 需设备码授权</text>
            </view>
          </view>
        </view>
      </McCard>
    </view>

    <view v-if="accountStore.accounts.length === 0" class="accounts__empty">
      <text class="accounts__empty-icon">🌸</text>
      <text class="accounts__empty-title">还没有账号</text>
      <text class="accounts__empty-sub">添加离线账号或登录微软账号</text>
    </view>

    <view v-else class="accounts__list">
      <view
        v-for="acc in sortedAccounts"
        :key="acc.id"
        class="account-item"
        :class="{ 'is-selected': acc.id === accountStore.selectedId }"
        @tap="selectAccount(acc.id)"
      >
        <GameIcon :uuid="acc.uuid" :size="120" variant="head" bordered />
        <view class="account-item__main">
          <view class="account-item__name-row">
            <text class="account-item__name">{{ acc.username }}</text>
            <text v-if="acc.id === accountStore.selectedId" class="account-item__check">✓</text>
          </view>
          <text class="account-item__type">
            <text v-if="acc.type === 'microsoft'" class="account-item__tag account-item__tag--ms">微软</text>
            <text v-else-if="acc.type === 'offline'" class="account-item__tag">离线</text>
            <text v-else class="account-item__tag">{{ acc.type }}</text>
          </text>
          <text class="account-item__sub">UUID: {{ acc.uuid.slice(0, 8) }}...</text>
          <text class="account-item__sub" v-if="acc.lastUsedAt">{{ relativeTime(acc.lastUsedAt) }}</text>
        </view>
        <view class="account-item__action" @tap.stop="removeAccount(acc.id, acc.username)">
          <text>🗑️</text>
        </view>
      </view>
    </view>

    <view class="accounts__tips">
      <text class="accounts__tips-title">💡 提示</text>
      <text class="accounts__tips-text">1. 离线账号仅供单机/朋友服娱乐, 无法进入正版服务器</text>
      <text class="accounts__tips-text">2. 微软 OAuth 采用 Microsoft 官方设备码流程, 在 PC/手机浏览器均可完成</text>
      <text class="accounts__tips-text">3. 账号信息仅保存在本地浏览器, 不上传服务器</text>
    </view>

    <McModal v-model:show="showAddModal" title="添加离线账号" width="90%">
      <view class="add-modal">
        <text class="add-modal__desc">离线账号无需密码, 输入游戏内显示的用户名即可</text>
        <McInput
          v-model="newUsername"
          label="用户名"
          placeholder="Steve"
          :maxlength="16"
          :clearable="true"
        />
        <text v-if="usernameError" class="add-modal__error">{{ usernameError }}</text>
        <text class="add-modal__hint">3-16 位, 字母/数字/下划线</text>
      </view>
      <template #footer>
        <view class="add-modal__actions">
          <McButton variant="ghost" @click="showAddModal = false">取消</McButton>
          <McButton @click="addOffline">添加</McButton>
        </view>
      </template>
    </McModal>
  </view>
</template>

<style lang="scss" scoped>
.accounts {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 32rpx;
  padding-bottom: 180rpx;
  &__hero { margin-bottom: 32rpx; }
  &__title { font-size: 48rpx; font-weight: 700; color: #ffffff; display: block; }
  &__subtitle { font-size: 26rpx; color: #b8a8d4; display: block; margin-top: 8rpx; }
  &__add-row { margin-bottom: 24rpx; }
  &__empty {
    text-align: center; padding: 120rpx 0;
  }
  &__empty-icon { font-size: 120rpx; display: block; margin-bottom: 16rpx; }
  &__empty-title { font-size: 32rpx; color: #ffffff; display: block; }
  &__empty-sub { font-size: 24rpx; color: #6a5a8a; display: block; margin-top: 8rpx; }
  &__list { display: flex; flex-direction: column; gap: 16rpx; }
  &__tips {
    margin-top: 32rpx;
    padding: 24rpx;
    background: rgba(216, 150, 255, 0.05);
    border-radius: 16rpx;
    border: 2rpx dashed rgba(216, 150, 255, 0.2);
  }
  &__tips-title { font-size: 26rpx; color: #d896ff; font-weight: 600; display: block; margin-bottom: 12rpx; }
  &__tips-text { font-size: 22rpx; color: #b8a8d4; display: block; line-height: 1.8; }
}

.add-row {
  display: flex; gap: 16rpx;
  &__item {
    flex: 1; display: flex; align-items: center; gap: 16rpx;
    padding: 20rpx;
    background: rgba(15, 15, 26, 0.6);
    border-radius: 16rpx;
    border: 2rpx solid rgba(216, 150, 255, 0.15);
  }
  &__icon {
    width: 72rpx; height: 72rpx;
    background: linear-gradient(135deg, #ffb7d5, #d896ff);
    border-radius: 16rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 32rpx; color: #1a0f2e;
    flex-shrink: 0;
    &--ms { background: linear-gradient(135deg, #60a5fa, #a78bfa); }
  }
  &__label { font-size: 26rpx; color: #ffffff; font-weight: 600; display: block; }
  &__sub { font-size: 22rpx; color: #b8a8d4; display: block; margin-top: 2rpx; }
}

.account-item {
  display: flex; align-items: center; gap: 24rpx;
  background: linear-gradient(135deg, rgba(45, 27, 78, 0.7), rgba(26, 15, 46, 0.7));
  border: 2rpx solid rgba(216, 150, 255, 0.15);
  border-radius: 24rpx;
  padding: 24rpx;
  &.is-selected {
    border-color: #d896ff;
    box-shadow: 0 0 24rpx rgba(216, 150, 255, 0.3);
  }
  &__main { flex: 1; min-width: 0; }
  &__name-row { display: flex; align-items: center; gap: 12rpx; }
  &__name { font-size: 32rpx; color: #ffffff; font-weight: 700; }
  &__check {
    color: #4ade80; font-size: 24rpx;
    background: rgba(74, 222, 128, 0.2);
    padding: 2rpx 12rpx; border-radius: 9999rpx;
  }
  &__type { display: block; margin: 8rpx 0; }
  &__tag {
    font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 8rpx;
    background: rgba(106, 90, 138, 0.2); color: #b8a8d4;
    &--ms { background: rgba(96, 165, 250, 0.2); color: #60a5fa; }
  }
  &__sub { font-size: 20rpx; color: #6a5a8a; display: block; line-height: 1.4; }
  &__action { padding: 12rpx; font-size: 32rpx; }
}

.add-modal {
  &__desc { font-size: 26rpx; color: #b8a8d4; display: block; margin-bottom: 24rpx; line-height: 1.5; }
  &__error { display: block; color: #f87171; font-size: 24rpx; margin-top: 8rpx; }
  &__hint { display: block; color: #6a5a8a; font-size: 22rpx; margin-top: 8rpx; }
  &__actions { display: flex; gap: 16rpx; }
}
</style>
