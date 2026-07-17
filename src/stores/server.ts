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
    },
    async ping(server: IServer): Promise<number> {
      const start = Date.now()
      return new Promise<number>(resolve => {
        // SLP 协议在 H5 中无法直接发送,使用模拟延迟
        setTimeout(() => {
          const latency = Math.floor(20 + Math.random() * 80)
          const online = Math.random() > 0.2
          this.update(server.id, {
            status: online ? 'online' : 'offline',
            ping: latency,
            players: online ? { online: Math.floor(Math.random() * 10), max: 20 } : undefined,
            motd: online ? '§a欢迎来到 §b樱花 §aMC §e服务器' : undefined
          })
          resolve(online ? latency : -1)
        }, 600 + Math.random() * 400)
      })
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
