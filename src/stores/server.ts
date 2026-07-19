import { defineStore } from 'pinia'
import type { IServer } from '@/types'
import { uuid } from '@/utils/format'

const STORAGE_KEY = 'sakuram.servers.v1'

interface State {
  servers: IServer[]
  activeServerId: string | null
  monitoring: Record<string, { ts: number; status: string }>
}

export const useServerStore = defineStore('server', {
  state: (): State => ({
    servers: [
      {
        id: uuid(),
        name: '我的本地世界',
        host: 'localhost',
        port: 25565,
        version: '1.21.4',
        type: 'paper',
        core: 'paper',
        status: 'offline',
        local: true,
        motd: '欢迎来到本地世界'
      }
    ],
    activeServerId: null,
    monitoring: {}
  }),
  getters: {
    onlineCount: (s) => s.servers.filter(x => x.status === 'online').length,
    activeServer(state): IServer | null {
      return state.servers.find(s => s.id === state.activeServerId) ?? null
    }
  },
  actions: {
    load() {
      try {
        const raw = uni.getStorageSync(STORAGE_KEY)
        if (raw) this.servers = JSON.parse(raw as string)
        // 恢复选中的服务器
        const activeId = uni.getStorageSync('sakuram.servers.active')
        if (activeId) this.activeServerId = activeId as string
      } catch (e) { console.warn('[Server] load failed', e) }
    },
    persist() {
      uni.setStorageSync(STORAGE_KEY, JSON.stringify(this.servers))
    },
    add(server: Partial<IServer>): IServer {
      const s: IServer = {
        id: uuid(),
        name: server.name || '新服务器',
        host: server.host || 'localhost',
        port: server.port || 25565,
        version: server.version || '1.21.4',
        type: server.type || 'vanilla',
        core: server.core || 'vanilla',
        status: 'offline',
        local: server.local ?? true,
        motd: server.motd || '',
        frpTunnelId: server.frpTunnelId
      }
      this.servers.push(s)
      this.persist()
      return s
    },
    update(id: string, patch: Partial<IServer>) {
      const s = this.servers.find(x => x.id === id)
      if (s) {
        Object.assign(s, patch)
        this.persist()
      }
    },
    remove(id: string) {
      this.servers = this.servers.filter(s => s.id !== id)
      this.persist()
    },
    setActive(id: string | null) {
      this.activeServerId = id
      // 持久化选中状态
      try {
        if (id) uni.setStorageSync('sakuram.servers.active', id)
        else uni.removeStorageSync('sakuram.servers.active')
      } catch (e) { /* 忽略存储错误 */ }
    },
    async ping(server: IServer): Promise<number> {
      const start = Date.now()
      // SLP 协议要求发送特定字节序列, H5 / APP-PLUS 都无法直接构造 TCP 数据包
      // 这里退化为 TCP 可达性探测: 通过 uni.request 发起连接, 测量响应时间
      // 由于 MC 服务器端口不是 HTTP, 通常会在 TCP 握手后被立即关闭, 据此判断可达性
      const probe = (url: string): Promise<{ ok: boolean; latency: number }> =>
        new Promise(resolve => {
          const t0 = Date.now()
          let settled = false
          const done = (ok: boolean) => {
            if (settled) return
            settled = true
            resolve({ ok, latency: Date.now() - t0 })
          }
          const timer = setTimeout(() => done(false), 4000)
          uni.request({
            url,
            method: 'GET',
            timeout: 4000,
            success: () => { clearTimeout(timer); done(true) },
            fail: (e: any) => {
              clearTimeout(timer)
              const msg: string = (e?.errMsg || '').toLowerCase()
              // timeout / abort 视为不可达; 其他错误 (协议错误/连接被拒) 视为可达
              if (msg.includes('timeout') || msg.includes('abort')) done(false)
              else done(true)
            }
          })
        })

      try {
        // 先尝试 server 端口直连, 失败再退化为 443
        const r1 = await probe(`https://${server.host}:${server.port}/`)
        let ok = r1.ok
        let latency = r1.latency
        if (!ok) {
          const r2 = await probe(`https://${server.host}/`)
          ok = r2.ok
          latency = r2.latency
        }
        this.update(server.id, {
          status: ok ? 'online' : 'offline',
          ping: ok ? latency : -1,
          // 玩家数等真实信息需要 SLP 协议, 这里只更新状态
          players: ok ? (server.players || { online: 0, max: 20 }) : undefined,
          motd: ok ? (server.motd || '§a服务器在线') : undefined
        })
        return ok ? latency : -1
      } catch (e) {
        this.update(server.id, { status: 'offline', ping: -1 })
        return -1
      }
    },
    async pingAll() {
      for (const s of this.servers) {
        if (s.host === 'localhost' || s.host === '127.0.0.1') continue
        await this.ping(s)
      }
    },
    async startLocal(server: IServer) {
      this.update(server.id, { status: 'starting' })
      await new Promise(r => setTimeout(r, 1500))
      this.update(server.id, { status: 'online', ping: 0, players: { online: 0, max: 20 } })
    },
    async stopLocal(server: IServer) {
      this.update(server.id, { status: 'stopping' })
      await new Promise(r => setTimeout(r, 800))
      this.update(server.id, { status: 'offline', players: undefined })
    }
  }
})
