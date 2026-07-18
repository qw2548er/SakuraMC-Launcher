import { defineStore } from 'pinia'

const STORAGE_KEY = 'sakuramc.java.v1'

export interface JavaVersion {
  id: string
  name: string
  path: string
  version: string
  architecture: string
  type: 'jre' | 'jdk'
  majorVersion: number
}

const defaultJavaVersions: JavaVersion[] = [
  { id: 'jre8', name: 'JRE 8', path: '', version: '1.8.0', architecture: '64-bit', type: 'jre', majorVersion: 8 },
  { id: 'jre17', name: 'JRE 17', path: '', version: '17.0.0', architecture: '64-bit', type: 'jre', majorVersion: 17 },
  { id: 'jre21', name: 'JRE 21', path: '', version: '21.0.0', architecture: '64-bit', type: 'jre', majorVersion: 21 }
]

export const useJavaStore = defineStore('java', {
  state: () => ({
    versions: [...defaultJavaVersions],
    selectedId: 'jre21' as string
  }),
  getters: {
    selectedVersion(state): JavaVersion | undefined {
      return state.versions.find(v => v.id === state.selectedId)
    },
    hasJavaPath(): boolean {
      return !!this.selectedVersion?.path
    }
  },
  actions: {
    load() {
      try {
        const raw = uni.getStorageSync(STORAGE_KEY)
        if (raw) {
          const data = JSON.parse(raw as string)
          if (data.versions) this.versions = data.versions
          if (data.selectedId) this.selectedId = data.selectedId
        }
      } catch (e) {
        console.warn('[Java] load failed', e)
      }
    },
    save() {
      try {
        uni.setStorageSync(STORAGE_KEY, JSON.stringify({
          versions: this.versions,
          selectedId: this.selectedId
        }))
      } catch (e) {
        console.warn('[Java] save failed', e)
      }
    },
    selectVersion(id: string) {
      this.selectedId = id
      this.save()
    },
    updateVersion(id: string, patch: Partial<JavaVersion>) {
      const idx = this.versions.findIndex(v => v.id === id)
      if (idx >= 0) {
        this.versions[idx] = { ...this.versions[idx], ...patch }
        this.save()
      }
    },
    addVersion(v: JavaVersion) {
      this.versions.push(v)
      this.save()
    },
    removeVersion(id: string) {
      this.versions = this.versions.filter(v => v.id !== id)
      if (this.selectedId === id && this.versions.length > 0) {
        this.selectedId = this.versions[0].id
      }
      this.save()
    }
  }
})
