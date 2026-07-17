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
        // 去重
        const exist = this.accounts.find(a => a.type === 'microsoft' && a.uuid === profile.id)
        if (exist) {
          Object.assign(exist, acc)
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
        if (msg.includes('authorization_pending')) return 'pending'
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
    async refreshMicrosoftToken(id: string) {
      const acc = this.accounts.find(a => a.id === id)
      if (!acc?.refreshToken) return
      try {
        const t = await mojang.refreshMSToken(acc.refreshToken)
        const result = await mojang.microsoftLogin(t.access_token)
        acc.accessToken = result.tokens.mcAccessToken
        acc.refreshToken = t.refresh_token
        acc.expiresAt = result.tokens.expiresAt
        this.persist()
      } catch (e) {
        console.warn('[Account] refresh failed', e)
      }
    }
  }
})
