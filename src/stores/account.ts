import { defineStore } from 'pinia'
import type { IAccount } from '@/types'
import { uuid, offlineUUID, getSkinFaceUrl, getSkinBodyUrl } from '@/utils/format'
import * as mojang from '@/api/mojang'

const STORAGE_KEY = 'sakuram.accounts.v1'
const SELECTED_KEY = 'sakuram.accounts.selected.v1'

interface State {
  accounts: IAccount[]
  selectedId: string | null
  loggingIn: boolean
  msLoginFlow: {
    deviceCode: string
    userCode: string
    verificationUri: string
    interval: number
    expiresAt: number
  } | null
  msLoginError: string | null
}

export const useAccountStore = defineStore('account', {
  state: (): State => ({
    accounts: [],
    selectedId: null,
    loggingIn: false,
    msLoginFlow: null,
    msLoginError: null
  }),
  getters: {
    selected(state): IAccount | null {
      return state.accounts.find(a => a.id === state.selectedId) ?? null
    },
    microsoftAccounts: (s) => s.accounts.filter(a => a.type === 'microsoft'),
    offlineAccounts: (s) => s.accounts.filter(a => a.type === 'offline')
  },
  actions: {
    load() {
      try {
        const raw = uni.getStorageSync(STORAGE_KEY)
        if (raw) this.accounts = JSON.parse(raw as string)
        const sel = uni.getStorageSync(SELECTED_KEY)
        if (sel) this.selectedId = sel as string
        if (this.accounts.length && !this.selectedId) {
          this.selectedId = this.accounts[0].id
        }
      } catch (e) {
        console.warn('[Account] load failed', e)
      }
    },
    persist() {
      try {
        uni.setStorageSync(STORAGE_KEY, JSON.stringify(this.accounts))
        uni.setStorageSync(SELECTED_KEY, this.selectedId || '')
      } catch (e) {
        console.warn('[Account] persist failed', e)
      }
    },
    addOffline(username: string): IAccount {
      const exist = this.accounts.find(a => a.type === 'offline' && a.username === username)
      if (exist) {
        this.selectedId = exist.id
        this.persist()
        return exist
      }
      const acc: IAccount = {
        id: uuid(),
        type: 'offline',
        username,
        uuid: offlineUUID(username),
        avatarUrl: getSkinFaceUrl(offlineUUID(username)),
        skinUrl: getSkinBodyUrl(offlineUUID(username)),
        createdAt: Date.now()
      }
      this.accounts.push(acc)
      if (!this.selectedId) this.selectedId = acc.id
      this.persist()
      return acc
    },
    select(id: string) {
      const acc = this.accounts.find(a => a.id === id)
      if (acc) {
        this.selectedId = id
        acc.lastUsedAt = Date.now()
        this.persist()
      }
    },
    remove(id: string) {
      this.accounts = this.accounts.filter(a => a.id !== id)
      if (this.selectedId === id) this.selectedId = this.accounts[0]?.id ?? null
      this.persist()
    },
    update(id: string, patch: Partial<IAccount>) {
      const acc = this.accounts.find(a => a.id === id)
      if (acc) {
        Object.assign(acc, patch)
        this.persist()
      }
    },
    async startMicrosoftLogin() {
      this.loggingIn = true
      this.msLoginError = null
      try {
        const r = await mojang.requestDeviceCode()
        this.msLoginFlow = {
          deviceCode: r.device_code,
          userCode: r.user_code,
          verificationUri: r.verification_uri,
          interval: r.interval,
          expiresAt: Date.now() + r.expires_in * 1000
        }
      } catch (e: any) {
        this.msLoginError = e.message
        throw e
      } finally {
        this.loggingIn = false
      }
    },
    async pollMicrosoftLogin(): Promise<'pending' | 'success' | 'expired' | 'error'> {
      if (!this.msLoginFlow) return 'error'
      if (Date.now() > this.msLoginFlow.expiresAt) {
        const f = this.msLoginFlow
        this.msLoginFlow = null
        this.msLoginError = '登录已过期, 请重试'
        return 'expired'
      }
      try {
        const r = await mojang.pollDeviceToken(this.msLoginFlow.deviceCode)
        const result = await mojang.microsoftLogin(r.access_token)
        if (!result.hasGame || !result.profile) {
          this.msLoginError = '该微软账号未拥有 Minecraft'
          return 'error'
        }
        const profile = result.profile
        const acc: IAccount = {
          id: uuid(),
          type: 'microsoft',
          username: profile.name,
          uuid: profile.id,
          accessToken: result.tokens.mcAccessToken,
          refreshToken: r.refresh_token,
          expiresAt: result.tokens.expiresAt,
          avatarUrl: getSkinFaceUrl(profile.id),
          skinUrl: getSkinBodyUrl(profile.id),
          createdAt: Date.now(),
          lastUsedAt: Date.now()
        }
        // 去重 (保留原 id 和 createdAt,只更新必要字段)
        const exist = this.accounts.find(a => a.type === 'microsoft' && a.uuid === profile.id)
        if (exist) {
          Object.assign(exist, { ...acc, id: exist.id, createdAt: exist.createdAt })
          this.selectedId = exist.id
        } else {
          this.accounts.push(acc)
          this.selectedId = acc.id
        }
        this.msLoginFlow = null
        this.persist()
        return 'success'
      } catch (e: any) {
        const msg = e?.message || ''
        // pollDeviceToken 现在会抛出包含 error code 的 Error
        if (msg.includes('authorization_pending')) return 'pending'
        if (msg.includes('slow_down')) {
          // 微软要求收到 slow_down 时增大轮询间隔
          if (this.msLoginFlow) this.msLoginFlow.interval += 5
          return 'pending'
        }
        if (msg.includes('expired_token')) {
          this.msLoginFlow = null
          this.msLoginError = '登录已过期'
          return 'expired'
        }
        if (msg.includes('access_denied')) {
          this.msLoginFlow = null
          this.msLoginError = '用户拒绝授权'
          return 'error'
        }
        this.msLoginError = msg
        return 'error'
      }
    },
    cancelMicrosoftLogin() {
      this.msLoginFlow = null
      this.msLoginError = null
    },
    async refreshMicrosoftToken(id: string): Promise<boolean> {
      const acc = this.accounts.find(a => a.id === id)
      if (!acc?.refreshToken) return false
      try {
        const t = await mojang.refreshMSToken(acc.refreshToken)
        if (!t?.access_token) return false
        const result = await mojang.microsoftLogin(t.access_token)
        if (!result?.tokens?.mcAccessToken) return false
        acc.accessToken = result.tokens.mcAccessToken
        // 保留旧 refreshToken 防止微软未返回新 token 时被覆盖为 undefined
        acc.refreshToken = t.refresh_token || acc.refreshToken
        acc.expiresAt = result.tokens.expiresAt
        this.persist()
        return true
      } catch (e: any) {
        console.warn('[Account] refresh failed:', e?.message || e)
        const msg = e?.message || ''
        // refresh_token 失效或被吊销: 清空所有 token, 标记需要重新登录
        if (/invalid_grant|invalid_request|invalid_client/i.test(msg)) {
          acc.accessToken = undefined
          acc.expiresAt = undefined
          // 关键修复: 同步清空 refreshToken, 避免下次启动又用失效的 token 刷新形成死循环
          acc.refreshToken = undefined
          // 标记需要重新登录 (前端可据此弹出引导)
          ;(acc as any).needRelogin = true
          this.persist()
        }
        return false
      }
    },
    /**
     * 在启动游戏前调用, 确保 Microsoft 账号的 access_token 仍有效
     * - 距过期 < 5 分钟: 主动刷新
     * - 已过期但有 refreshToken: 尝试刷新
     * - 刷新失败返回 false, 调用方应提示用户重新登录
     */
    async ensureFreshToken(id: string): Promise<boolean> {
      const acc = this.accounts.find(a => a.id === id)
      if (!acc) return false
      if (acc.type !== 'microsoft') return true // 离线账号无需刷新
      const now = Date.now()
      const REFRESH_WINDOW = 5 * 60 * 1000 // 5 分钟内将过期也刷新
      if (acc.expiresAt && acc.expiresAt - now > REFRESH_WINDOW) {
        return true // 仍然有效
      }
      if (!acc.refreshToken) {
        return false
      }
      return await this.refreshMicrosoftToken(id)
    }
  }
})
