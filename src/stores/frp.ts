import { defineStore } from 'pinia'
import type { IFrpAccount, IFrpNode, IFrpTunnel } from '@/types'
import * as nat from '@/api/natfrp'

const STORAGE_KEY = 'sakuram.frp.v1'

interface State {
  account: IFrpAccount | null
  nodes: IFrpNode[]
  tunnels: IFrpTunnel[]
  traffic: { used: number; total: number; resetAt: number } | null
  loading: boolean
  error: string | null
  runningTunnels: Record<number, { pid: string; startTime: number; logs: string[] }>
}

export const useFrpStore = defineStore('frp', {
  state: (): State => ({
    account: null,
    nodes: [],
    tunnels: [],
    traffic: null,
    loading: false,
    error: null,
    runningTunnels: {}
  }),
  getters: {
    isLoggedIn: (s) => !!s.account?.token,
    onlineTunnels: (s) => s.tunnels.filter(t => t.online),
    offlineTunnels: (s) => s.tunnels.filter(t => !t.online),
    nodeById: (s) => (id: number) => s.nodes.find(n => n.id === id),
    tunnelById: (s) => (id: number) => s.tunnels.find(t => t.id === id)
  },
  actions: {
    load() {
      try {
        const raw = uni.getStorageSync(STORAGE_KEY)
        if (raw) {
          const data = JSON.parse(raw as string)
          this.account = data.account || null
          this.tunnels = data.tunnels || []
        }
      } catch (e) { console.warn('[Frp] load failed', e) }
    },
    persist() {
      try {
        uni.setStorageSync(STORAGE_KEY, JSON.stringify({
          account: this.account,
          tunnels: this.tunnels
        }))
      } catch (e) { console.warn('[Frp] persist failed', e) }
    },
    async login(username: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const r = await nat.login(username, password)
        this.account = {
          id: 'self',
          username,
          token: r.token,
          loginAt: Date.now(),
          expireAt: r.expire
        }
        this.persist()
        await this.refreshAll()
        return r
      } catch (e: any) {
        this.error = e.message
        throw e
      } finally {
        this.loading = false
      }
    },
    async logout() {
      if (!this.account) return
      try { await nat.logout(this.account.token) } catch {}
      this.account = null
      this.tunnels = []
      this.nodes = []
      this.traffic = null
      this.persist()
    },
    async refreshAll() {
      if (!this.account) return
      this.loading = true
      this.error = null
      try {
        const [info, traffic, nodes, tunnels] = await Promise.allSettled([
          nat.getUserInfo(this.account.token),
          nat.getTraffic(this.account.token),
          nat.getNodes(this.account.token),
          nat.getTunnels(this.account.token)
        ])
        if (info.status === 'fulfilled') {
          this.account.userInfo = info.value
        }
        if (traffic.status === 'fulfilled') {
          this.traffic = {
            used: traffic.value.used || 0,
            total: traffic.value.total || 0,
            resetAt: traffic.value.reset_at || 0
          }
        }
        if (nodes.status === 'fulfilled') {
          this.nodes = (Array.isArray(nodes.value) ? nodes.value : []).map((n: any) => ({
            id: n.id,
            name: n.name,
            hostname: n.hostname,
            port: n.port,
            protocol: n.protocol || 'tcp',
            bandwidth: n.bandwidth,
            flag: n.flag,
            region: n.region,
            status: n.status || 'online',
            group: n.group,
            allowChinese: n.allow_chinese
          }))
        }
        if (tunnels.status === 'fulfilled') {
          this.tunnels = (Array.isArray(tunnels.value) ? tunnels.value : []).map((t: any) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            node: t.node,
            nodeName: t.node_name,
            localIp: t.local_ip,
            localPort: t.local_port,
            remotePort: t.remote_port,
            domain: t.domain,
            useCompression: t.use_compression,
            useEncryption: t.use_encryption,
            online: t.online,
            trafficIn: t.traffic_in || 0,
            trafficOut: t.traffic_out || 0
          }))
        }
        this.persist()
      } catch (e: any) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },
    async createTunnel(data: Partial<IFrpTunnel>) {
      if (!this.account) throw new Error('未登录')
      const result: any = await nat.createTunnel(this.account.token, {
        name: data.name,
        type: data.type,
        node: data.node,
        local_ip: data.localIp,
        local_port: data.localPort,
        remote_port: data.remotePort,
        domain: data.domain,
        use_compression: data.useCompression,
        use_encryption: data.useEncryption
      } as any)
      await this.refreshAll()
      return result
    },
    async updateTunnel(id: number, data: Partial<IFrpTunnel>) {
      if (!this.account) throw new Error('未登录')
      await nat.updateTunnel(this.account.token, id, data as any)
      await this.refreshAll()
    },
    async deleteTunnel(id: number) {
      if (!this.account) throw new Error('未登录')
      await nat.deleteTunnel(this.account.token, id)
      this.tunnels = this.tunnels.filter(t => t.id !== id)
      this.persist()
    },
    async getTunnelConfig(id: number): Promise<string> {
      if (!this.account) throw new Error('未登录')
      const cfg: any = await nat.getTunnelConfig(this.account.token, id)
      return typeof cfg === 'string' ? cfg : JSON.stringify(cfg, null, 2)
    },
    markRunning(tunnelId: number) {
      this.runningTunnels[tunnelId] = {
        pid: 'sim-' + Math.random().toString(36).slice(2, 8),
        startTime: Date.now(),
        logs: [`[${new Date().toISOString()}] frpc 启动中...`, `[${new Date().toISOString()}] 正在连接节点...`]
      }
    },
    markStopped(tunnelId: number) {
      delete this.runningTunnels[tunnelId]
    },
    appendLog(tunnelId: number, log: string) {
      const t = this.runningTunnels[tunnelId]
      if (t) {
        t.logs.push(`[${new Date().toISOString()}] ${log}`)
        if (t.logs.length > 200) t.logs = t.logs.slice(-200)
      }
    },
    async pingNode(node: IFrpNode): Promise<number> {
      return nat.pingNode(node.hostname, node.port)
    }
  }
})
