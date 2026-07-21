<script setup lang="ts">
import { ref, computed, onMounted, type Ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useVersionStore } from '@/stores/version'
import { listDirectory, MINECRAFT_DIR } from '@/utils/setup'
import { chooseAndImport, showOpenModeDialog } from '@/utils/file-chooser'
import {
  isCordova,
  waitForReady,
  renameFile,
  readTextFile,
  writeTextFile,
  fileExists,
  ensureDir
} from '@/utils/cordova-fs'

const settingsStore = useSettingsStore()
const versionStore = useVersionStore()
const activeTab = ref<'mods' | 'resourcepack' | 'shaderpack'>('mods')
const search = ref('')
const sortMode = ref(false)

// 当前选中的游戏版本 (用于版本校验)
const currentMcVersion = computed(() => {
  const v = versionStore.selected
  return v?.id || ''
})

// 排序持久化 key 前缀
const ORDER_KEY_PREFIX = 'sakuramc:order:'

// 保存当前三个列表的顺序到本地
function saveOrder() {
  try {
    uni.setStorageSync(ORDER_KEY_PREFIX + 'mods', modList.value.map((m: any) => m.id))
    uni.setStorageSync(ORDER_KEY_PREFIX + 'resourcepacks', resourcePacks.value.map((r: any) => r.id))
    uni.setStorageSync(ORDER_KEY_PREFIX + 'shaderpacks', shaderPacks.value.map((s: any) => s.id))
  } catch (e) {
    console.warn('[Mods] saveOrder failed:', e)
  }
}

// 应用本地保存的顺序
function applyOrder(list: Ref<any[]>, key: string) {
  try {
    const saved = uni.getStorageSync(ORDER_KEY_PREFIX + key)
    if (!Array.isArray(saved) || saved.length === 0) return
    const idToItem = new Map<string, any>()
    list.value.forEach((item: any) => idToItem.set(item.id, item))
    const ordered: any[] = []
    saved.forEach((id: string) => {
      const item = idToItem.get(id)
      if (item) {
        ordered.push(item)
        idToItem.delete(id)
      }
    })
    idToItem.forEach(item => ordered.push(item))
    list.value = ordered
  } catch (e) {
    console.warn('[Mods] applyOrder failed:', e)
  }
}

function toggleSortMode() {
  sortMode.value = !sortMode.value
  if (sortMode.value && search.value) search.value = ''
}

function moveItemByIndex(list: Ref<any[]>, filtered: any[], filteredIdx: number, direction: -1 | 1) {
  const item = filtered[filteredIdx]
  if (!item) return
  const realIdx = list.value.findIndex((i: any) => i.id === item.id)
  if (realIdx === -1) return
  const newIdx = realIdx + direction
  if (newIdx < 0 || newIdx >= list.value.length) return
  const arr = list.value
  ;[arr[realIdx], arr[newIdx]] = [arr[newIdx], arr[realIdx]]
  saveOrder()
}

// ============ 数据 ============

interface ModItem {
  id: string
  name: string
  version: string
  type: string
  enabled: boolean
  size: string
  mc: string
  path: string
  compat?: 'ok' | 'warn' | 'error'
}

interface PackItem {
  id: string
  name: string
  version: string
  enabled: boolean
  size: string
  desc: string
  path: string
  perf?: 'low' | 'medium' | 'high' | 'extreme'
  isXray?: boolean
  compat?: 'ok' | 'warn' | 'error'
}

const modList = ref<ModItem[]>([])
const resourcePacks = ref<PackItem[]>([])
const shaderPacks = ref<PackItem[]>([])

const filteredMods = computed(() => {
  if (!search.value) return modList.value
  const q = search.value.toLowerCase()
  return modList.value.filter(m => m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q))
})

const filteredResourcePacks = computed(() => {
  if (!search.value) return resourcePacks.value
  const q = search.value.toLowerCase()
  return resourcePacks.value.filter(r => r.name.toLowerCase().includes(q))
})

const filteredShaderPacks = computed(() => {
  if (!search.value) return shaderPacks.value
  const q = search.value.toLowerCase()
  return shaderPacks.value.filter(s => s.name.toLowerCase().includes(q))
})

// ============ 版本兼容性检查 ============

/**
 * 比较两个 MC 版本是否兼容
 * 简化策略: 主版本号 + 次版本号一致即视为兼容 (1.21.1 与 1.21 兼容)
 */
function checkVersionCompat(modMc: string, currentMc: string): 'ok' | 'warn' | 'error' {
  if (!modMc || modMc === '通用' || !currentMc) return 'ok'
  // 提取主版本.次版本
  const parseMajor = (v: string) => {
    const m = v.match(/^(\d+)\.(\d+)/)
    return m ? `${m[1]}.${m[2]}` : v
  }
  const modMajor = parseMajor(modMc)
  const curMajor = parseMajor(currentMc)
  if (modMajor === curMajor) return 'ok'
  // 跨大版本
  const modParts = modMajor.split('.').map(n => parseInt(n, 10))
  const curParts = curMajor.split('.').map(n => parseInt(n, 10))
  if (modParts[0] !== curParts[0]) return 'error'
  // 同一大版本, 次版本差 1
  if (Math.abs(modParts[1] - curParts[1]) === 1) return 'warn'
  return 'error'
}

// ============ Iris / Sodium / Fabric API 依赖联动 ============

// 识别关键模组
function isKeyMod(name: string, keyword: string): boolean {
  return name.toLowerCase().includes(keyword.toLowerCase())
}

const IRIS_KEYWORDS = ['iris']
const SODIUM_KEYWORDS = ['sodium']
const FABRIC_API_KEYWORDS = ['fabric-api', 'fabricapi', 'fabric api']
const LITHIUM_KEYWORDS = ['lithium']

function findModByKeywords(keywords: string[]): ModItem | undefined {
  return modList.value.find(m => keywords.some(k => isKeyMod(m.name, k)))
}

/**
 * 检查启用 Iris 时是否需要联动启用 Sodium / Fabric API
 * 返回提示消息数组
 */
async function checkIrisDependencies(): Promise<string[]> {
  const msgs: string[] = []
  const iris = findModByKeywords(IRIS_KEYWORDS)
  if (!iris || !iris.enabled) return msgs

  const fabricApi = findModByKeywords(FABRIC_API_KEYWORDS)
  if (fabricApi && !fabricApi.enabled) {
    const ok = await enableMod(fabricApi)
    if (ok) msgs.push('已自动启用 Fabric API (Iris 依赖)')
  } else if (!fabricApi) {
    msgs.push('⚠️ 未安装 Fabric API, Iris 可能无法工作')
  }

  const sodium = findModByKeywords(SODIUM_KEYWORDS)
  if (sodium && !sodium.enabled) {
    const ok = await enableMod(sodium)
    if (ok) msgs.push('已自动启用 Sodium (Iris 推荐搭配)')
  }
  return msgs
}

/**
 * 检查禁用 Fabric API 时是否警告
 */
function checkFabricApiDependencies(): string[] {
  const msgs: string[] = []
  const fabricApi = findModByKeywords(FABRIC_API_KEYWORDS)
  if (!fabricApi || fabricApi.enabled) return msgs

  const iris = findModByKeywords(IRIS_KEYWORDS)
  if (iris?.enabled) msgs.push('⚠️ Fabric API 已禁用, Iris 将无法工作')

  const sodium = findModByKeywords(SODIUM_KEYWORDS)
  if (sodium?.enabled) msgs.push('⚠️ Fabric API 已禁用, Sodium 将无法工作')

  const lithium = findModByKeywords(LITHIUM_KEYWORDS)
  if (lithium?.enabled) msgs.push('⚠️ Fabric API 已禁用, Lithium 将无法工作')

  return msgs
}

// ============ 模组开关 (通过 .disabled 后缀切换) ============

async function enableMod(mod: ModItem): Promise<boolean> {
  if (mod.enabled) return true
  // .jar.disabled -> .jar
  if (mod.path.endsWith('.disabled')) {
    const newPath = mod.path.replace(/\.disabled$/, '')
    try {
      await renameFile(mod.path, newPath)
      mod.path = newPath
      mod.enabled = true
      return true
    } catch (e) {
      console.warn('[Mods] enableMod failed:', e)
      return false
    }
  }
  mod.enabled = true
  return true
}

async function disableMod(mod: ModItem): Promise<boolean> {
  if (!mod.enabled) return true
  // .jar -> .jar.disabled
  if (!mod.path.endsWith('.disabled')) {
    const newPath = mod.path + '.disabled'
    try {
      await renameFile(mod.path, newPath)
      mod.path = newPath
      mod.enabled = false
      return true
    } catch (e) {
      console.warn('[Mods] disableMod failed:', e)
      return false
    }
  }
  mod.enabled = false
  return true
}

async function toggleItem(list: Ref<any[]>, id: string) {
  const item = list.value.find((i: any) => i.id === id)
  if (!item) return

  // Xray 资源包开启前警告
  if (list === resourcePacks && item.isXray && !item.enabled) {
    const confirmed = await new Promise<boolean>(resolve => {
      uni.showModal({
        title: '⚠️ 联机风险提示',
        content: '该资源包包含透视功能, 在多人服务器使用可能被判定为作弊并封禁账号。是否仍要启用?',
        confirmText: '仍要启用',
        cancelText: '取消',
        success: r => resolve(!!r.confirm)
      })
    })
    if (!confirmed) return
  }

  if (list === modList) {
    const target = item as ModItem
    const wasEnabled = target.enabled
    if (wasEnabled) {
      const ok = await disableMod(target)
      if (!ok) {
        uni.showToast({ title: '禁用失败', icon: 'none' })
        return
      }
      // 检查依赖警告
      const msgs = checkFabricApiDependencies()
      if (msgs.length > 0) {
        uni.showModal({
          title: '依赖提示',
          content: msgs.join('\n'),
          showCancel: false
        })
      }
    } else {
      const ok = await enableMod(target)
      if (!ok) {
        uni.showToast({ title: '启用失败', icon: 'none' })
        return
      }
      // 启用 Iris 时联动检查
      if (isKeyMod(target.name, 'iris')) {
        uni.showLoading({ title: '检查依赖...' })
        const msgs = await checkIrisDependencies()
        uni.hideLoading()
        if (msgs.length > 0) {
          uni.showToast({ title: msgs[0], icon: 'none', duration: 2500 })
        }
      }
    }
  } else if (list === resourcePacks) {
    await toggleResourcePack(item as PackItem)
  } else if (list === shaderPacks) {
    await toggleShaderPack(item as PackItem)
  }
}

// ============ 资源包开关 (写入 options.txt) ============

async function readOptionsTxt(): Promise<Record<string, string>> {
  const optionsPath = `${MINECRAFT_DIR}/options.txt`
  try {
    const content = await readTextFile(optionsPath)
    const map: Record<string, string> = {}
    content.split(/\r?\n/).forEach(line => {
      const idx = line.indexOf(':')
      if (idx > 0) map[line.slice(0, idx)] = line.slice(idx + 1)
    })
    return map
  } catch {
    return {}
  }
}

async function writeOptionsTxt(map: Record<string, string>): Promise<void> {
  const optionsPath = `${MINECRAFT_DIR}/options.txt`
  const content = Object.entries(map).map(([k, v]) => `${k}:${v}`).join('\n')
  await writeTextFile(optionsPath, content)
}

function parseResourcePackList(jsonStr: string): string[] {
  try {
    const arr = JSON.parse(jsonStr || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

async function toggleResourcePack(pack: PackItem): Promise<void> {
  try {
    const opts = await readOptionsTxt()
    let enabledList = parseResourcePackList(opts.resourcePacks || '[]')

    if (pack.enabled) {
      // 禁用: 从列表移除
      enabledList = enabledList.filter((p: string) => p !== `file/${pack.name}` && p !== pack.name)
      pack.enabled = false
    } else {
      // 启用: 添加到列表
      const packRef = `file/${pack.name}`
      if (!enabledList.includes(packRef)) enabledList.push(packRef)
      pack.enabled = true
    }

    opts.resourcePacks = JSON.stringify(enabledList)
    await writeOptionsTxt(opts)
    uni.showToast({ title: pack.enabled ? '已启用' : '已禁用', icon: 'success' })
  } catch (e: any) {
    console.warn('[Mods] toggleResourcePack failed:', e)
    // 回滚状态
    pack.enabled = !pack.enabled
    uni.showToast({ title: '操作失败: ' + (e?.message || ''), icon: 'none' })
  }
}

// ============ 光影包开关 (写入 options.txt 的 shaderPack 字段) ============

// 光影性能分级
function guessShaderPerformance(name: string): 'low' | 'medium' | 'high' | 'extreme' {
  const n = name.toLowerCase()
  if (n.includes('seus ptgi') || n.includes('seus renewed') || n.includes('ptgi')) return 'extreme'
  if (n.includes('bsl') || n.includes('continuum')) return 'high'
  if (n.includes('complementary') || n.includes('sildurs vibrant')) return 'medium'
  if (n.includes('sildurs') || n.includes('basic') || n.includes('light')) return 'low'
  return 'medium'
}

const PERF_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: '低性能要求', color: '#4ade80' },
  medium: { label: '中等性能', color: '#facc15' },
  high: { label: '高性能要求', color: '#fb923c' },
  extreme: { label: '极致性能要求', color: '#f87171' }
}

async function toggleShaderPack(pack: PackItem): Promise<void> {
  // 检查是否安装了光影加载器
  const iris = findModByKeywords(IRIS_KEYWORDS)
  const optifine = modList.value.find(m => isKeyMod(m.name, 'optifine'))
  if (!iris?.enabled && !optifine?.enabled) {
    uni.showModal({
      title: '需要光影加载器',
      content: '光影包需要安装并启用 Iris Shaders 或 OptiFine 才能生效。是否前往模组页面启用 Iris?',
      confirmText: '前往启用',
      cancelText: '取消',
      success: r => {
        if (r.confirm) {
          activeTab.value = 'mods'
        }
      }
    })
    return
  }

  try {
    const opts = await readOptionsTxt()

    if (pack.enabled) {
      // 禁用: 清空 shaderPack
      opts.shaderPack = ''
      opts.enableShaders = 'false'
      pack.enabled = false
    } else {
      // 启用: 先禁用其他光影包 (MC 只能启用一个)
      shaderPacks.value.forEach(s => { if (s.id !== pack.id) s.enabled = false })
      opts.shaderPack = pack.name
      opts.enableShaders = 'true'
      pack.enabled = true
    }

    await writeOptionsTxt(opts)
    uni.showToast({ title: pack.enabled ? '已启用光影' : '已关闭光影', icon: 'success' })
  } catch (e: any) {
    console.warn('[Mods] toggleShaderPack failed:', e)
    pack.enabled = !pack.enabled
    uni.showToast({ title: '操作失败: ' + (e?.message || ''), icon: 'none' })
  }
}

// ============ 加载列表 ============

async function loadMods() {
  if (!isCordova()) return
  try {
    await waitForReady().catch(() => {})
    const modsDir = settingsStore.modsDir || `${MINECRAFT_DIR}/mods`
    const entries = await listDirectory(modsDir)
    const jars = entries.filter(e => !e.isDir && /\.jar(\.disabled)?$/i.test(e.name))
    modList.value = jars.map(e => {
      const isDisabled = /\.disabled$/i.test(e.name)
      const baseName = e.name.replace(/\.jar(\.disabled)?$/i, '')
      const mcGuess = guessMcFromName(e.name)
      return {
        id: e.name,
        name: baseName,
        version: parseModVersion(e.name),
        type: guessModType(e.name),
        enabled: !isDisabled,
        size: e.size ? (e.size / 1024 / 1024).toFixed(1) + ' MB' : '未知',
        mc: mcGuess,
        path: `${modsDir}/${e.name}`,
        compat: checkVersionCompat(mcGuess, currentMcVersion.value)
      }
    })
    applyOrder(modList as Ref<any[]>, 'mods')
  } catch (e: any) {
    console.warn('[Mods] 加载 mods 失败:', e?.message || e)
    modList.value = []
  }
}

function guessModType(name: string): 'fabric' | 'forge' | 'quilt' | 'optifine' | 'neoforge' | 'unknown' {
  const n = name.toLowerCase()
  if (n.includes('optifine')) return 'optifine'
  if (n.includes('fabric')) return 'fabric'
  if (n.includes('neoforge')) return 'neoforge'
  if (n.includes('forge')) return 'forge'
  if (n.includes('quilt')) return 'quilt'
  return 'unknown'
}

function parseModVersion(name: string): string {
  const base = name.replace(/\.jar(\.disabled)?$/i, '')
  const m = base.match(/[-_]?(\d+\.\d+(?:\.\d+)?(?:\.\w+)?)$/)
  return m ? m[1] : '未知'
}

// 从文件名猜测 MC 版本 (例如 fabric-api-0.92.0+1.21.jar -> 1.21)
function guessMcFromName(name: string): string {
  const m = name.match(/\+?(\d+\.\d+(?:\.\d+)?)/)
  // 过滤掉明显的 mod 版本号 (如 0.92.0), 保留 1.20+ 的
  if (m) {
    const v = m[1]
    const major = parseInt(v.split('.')[0], 10)
    if (major >= 1) return v
  }
  return '通用'
}

async function loadResourcePacks() {
  if (!isCordova()) return
  try {
    await waitForReady().catch(() => {})
    const dir = settingsStore.resourcepacksDir || `${MINECRAFT_DIR}/resourcepacks`
    const entries = await listDirectory(dir)
    const packs = entries.filter(e => !e.isDir && /\.(zip|rar)$/i.test(e.name))
    const opts = await readOptionsTxt()
    const enabledList = parseResourcePackList(opts.resourcePacks || '[]')

    resourcePacks.value = packs.map(e => {
      const baseName = e.name.replace(/\.(zip|rar)$/i, '')
      const mcGuess = guessMcFromName(e.name)
      return {
        id: e.name,
        name: baseName,
        version: mcGuess,
        enabled: enabledList.includes(`file/${baseName}`) || enabledList.includes(baseName),
        size: e.size ? (e.size / 1024 / 1024).toFixed(1) + ' MB' : '未知',
        desc: isXrayPack(baseName) ? '⚠️ 透视资源包' : '资源包文件',
        path: `${dir}/${e.name}`,
        isXray: isXrayPack(baseName),
        compat: checkVersionCompat(mcGuess, currentMcVersion.value)
      }
    })
    applyOrder(resourcePacks as Ref<any[]>, 'resourcepacks')
  } catch (e: any) {
    console.warn('[Mods] 加载 resourcepacks 失败:', e?.message || e)
    resourcePacks.value = []
  }
}

function isXrayPack(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('xray') || n.includes('透视') || n.includes('x-ray')
}

async function loadShaderPacks() {
  if (!isCordova()) return
  try {
    await waitForReady().catch(() => {})
    const dir = settingsStore.shaderpacksDir || `${MINECRAFT_DIR}/shaderpacks`
    const entries = await listDirectory(dir)
    const packs = entries.filter(e => !e.isDir && /\.(zip|rar)$/i.test(e.name))
    const opts = await readOptionsTxt()
    const activeShader = opts.shaderPack || ''

    shaderPacks.value = packs.map(e => {
      const baseName = e.name.replace(/\.(zip|rar)$/i, '')
      return {
        id: e.name,
        name: baseName,
        version: '通用',
        enabled: activeShader === baseName,
        size: e.size ? (e.size / 1024 / 1024).toFixed(1) + ' MB' : '未知',
        desc: '光影包文件',
        path: `${dir}/${e.name}`,
        perf: guessShaderPerformance(baseName)
      }
    })
    applyOrder(shaderPacks as Ref<any[]>, 'shaderpacks')
  } catch (e: any) {
    console.warn('[Mods] 加载 shaderpacks 失败:', e?.message || e)
    shaderPacks.value = []
  }
}

async function loadAll() {
  await Promise.allSettled([loadMods(), loadResourcePacks(), loadShaderPacks()])
}

function addMod() {
  uni.showActionSheet({
    itemList: ['从文件导入 (.jar)', '用管理器打开目录'],
    success: (res) => {
      if (res.tapIndex === 0) importMods()
      else if (res.tapIndex === 1) openFolder('mods')
    }
  })
}

async function importMods() {
  try {
    const modsDir = settingsStore.modsDir || `${MINECRAFT_DIR}/mods`
    await ensureDir(modsDir).catch(() => {})
    uni.showLoading({ title: '选择文件...' })
    const imported = await chooseAndImport(modsDir, 'application/java-archive', true)
    uni.hideLoading()
    if (imported.length > 0) {
      uni.showToast({ title: `已导入 ${imported.length} 个 Mod`, icon: 'success' })
      loadMods()
    }
  } catch (e: any) {
    uni.hideLoading()
    if (e?.message !== 'User cancelled') {
      uni.showToast({ title: '导入失败: ' + (e?.message || ''), icon: 'none' })
    }
  }
}

function addResourcePack() {
  uni.showActionSheet({
    itemList: ['从文件导入 (.zip)', '用管理器打开目录'],
    success: (res) => {
      if (res.tapIndex === 0) importResourcePacks()
      else if (res.tapIndex === 1) openFolder('resourcepacks')
    }
  })
}

async function importResourcePacks() {
  try {
    const dir = settingsStore.resourcepacksDir || `${MINECRAFT_DIR}/resourcepacks`
    await ensureDir(dir).catch(() => {})
    uni.showLoading({ title: '选择文件...' })
    const imported = await chooseAndImport(dir, 'application/zip', true)
    uni.hideLoading()
    if (imported.length > 0) {
      uni.showToast({ title: `已导入 ${imported.length} 个资源包`, icon: 'success' })
      loadResourcePacks()
    }
  } catch (e: any) {
    uni.hideLoading()
    if (e?.message !== 'User cancelled') {
      uni.showToast({ title: '导入失败: ' + (e?.message || ''), icon: 'none' })
    }
  }
}

function addShaderPack() {
  uni.showActionSheet({
    itemList: ['从文件导入 (.zip)', '用管理器打开目录'],
    success: (res) => {
      if (res.tapIndex === 0) importShaderPacks()
      else if (res.tapIndex === 1) openFolder('shaderpacks')
    }
  })
}

async function importShaderPacks() {
  try {
    const dir = settingsStore.shaderpacksDir || `${MINECRAFT_DIR}/shaderpacks`
    await ensureDir(dir).catch(() => {})
    uni.showLoading({ title: '选择文件...' })
    const imported = await chooseAndImport(dir, 'application/zip', true)
    uni.hideLoading()
    if (imported.length > 0) {
      uni.showToast({ title: `已导入 ${imported.length} 个光影包`, icon: 'success' })
      loadShaderPacks()
    }
  } catch (e: any) {
    uni.hideLoading()
    if (e?.message !== 'User cancelled') {
      uni.showToast({ title: '导入失败: ' + (e?.message || ''), icon: 'none' })
    }
  }
}

function openFolder(folder: string) {
  const dirMap: Record<string, 'modsDir' | 'resourcepacksDir' | 'shaderpacksDir'> = {
    mods: 'modsDir',
    resourcepacks: 'resourcepacksDir',
    shaderpacks: 'shaderpacksDir'
  }
  const key = dirMap[folder]
  const path = key ? settingsStore[key] : ''
  const finalPath = path || `${MINECRAFT_DIR}/${folder}`
  if (isCordova()) {
    showOpenModeDialog(finalPath)
  } else {
    uni.showToast({ title: '路径: ' + finalPath, icon: 'none' })
  }
}

onMounted(() => {
  loadAll()
})

function getTypeLabel(type: string) {
  const map: Record<string, string> = { fabric: 'Fabric', forge: 'Forge', quilt: 'Quilt', optifine: 'OptiFine', neoforge: 'NeoForge' }
  return map[type] || type
}

function getCompatLabel(c?: string): string {
  if (c === 'error') return '⚠️ 版本不兼容'
  if (c === 'warn') return '⚠️ 跨版本'
  return ''
}
</script>

<template>
  <view class="mods">
    <view class="mods__header">
      <text class="mods__back" @tap="uni.navigateBack()">‹</text>
      <text class="mods__title">模组 & 资源包</text>
      <view class="mods__add" @tap="activeTab === 'mods' ? addMod() : activeTab === 'resourcepack' ? addResourcePack() : addShaderPack()">
        <text>+</text>
      </view>
    </view>
    
    <view class="mods__tabs">
      <view class="mods__tab" :class="{ 'mods__tab--active': activeTab === 'mods' }" @tap="activeTab = 'mods'">
        <text>Mod</text>
        <text class="mods__tab-count">{{ modList.length }}</text>
      </view>
      <view class="mods__tab" :class="{ 'mods__tab--active': activeTab === 'resourcepack' }" @tap="activeTab = 'resourcepack'">
        <text>资源包</text>
        <text class="mods__tab-count">{{ resourcePacks.length }}</text>
      </view>
      <view class="mods__tab" :class="{ 'mods__tab--active': activeTab === 'shaderpack' }" @tap="activeTab = 'shaderpack'">
        <text>光影包</text>
        <text class="mods__tab-count">{{ shaderPacks.length }}</text>
      </view>
      <view class="mods__tab-indicator" :style="{ left: activeTab === 'mods' ? '0%' : activeTab === 'resourcepack' ? '33.33%' : '66.66%' }" />
    </view>
    
    <view class="mods__search-bar">
      <input class="mods__search" v-model="search" :disabled="sortMode" :placeholder="sortMode ? '排序模式 (搜索已禁用)' : '搜索 ' + (activeTab === 'mods' ? 'Mod' : activeTab === 'resourcepack' ? '资源包' : '光影包') + '...'" placeholder-style="color: #666" />
      <view class="mods__folder-btn" :class="{ 'mods__folder-btn--active': sortMode }" @tap="toggleSortMode">
        <text>↕</text>
      </view>
      <view class="mods__folder-btn" @tap="openFolder(activeTab === 'mods' ? 'mods' : activeTab === 'resourcepack' ? 'resourcepacks' : 'shaderpacks')">
        <text>📁</text>
      </view>
    </view>
    
    <scroll-view scroll-y class="mods__content">
      <!-- Mod 列表 -->
      <view v-if="activeTab === 'mods'" class="mods__list">
        <view v-for="(mod, idx) in filteredMods" :key="mod.id" class="item-card" :class="{ 'item-card--sorting': sortMode, 'item-card--warn': mod.compat === 'warn', 'item-card--error': mod.compat === 'error' }">
          <view v-if="sortMode" class="item-card__sort">
            <text class="item-card__sort-btn" :class="{ 'item-card__sort-btn--disabled': idx === 0 }" @tap.stop="moveItemByIndex(modList, filteredMods, idx, -1)">▲</text>
            <text class="item-card__sort-btn" :class="{ 'item-card__sort-btn--disabled': idx === filteredMods.length - 1 }" @tap.stop="moveItemByIndex(modList, filteredMods, idx, 1)">▼</text>
          </view>
          <view class="item-card__icon" style="background: rgba(255,183,213,0.15)">🧩</view>
          <view class="item-card__main">
            <text class="item-card__name">{{ mod.name }}</text>
            <text class="item-card__info">{{ getTypeLabel(mod.type) }} · v{{ mod.version }} · {{ mod.size }}</text>
            <text class="item-card__mc" :class="{ 'item-card__mc--warn': mod.compat === 'warn', 'item-card__mc--error': mod.compat === 'error' }">MC {{ mod.mc }} {{ getCompatLabel(mod.compat) }}</text>
          </view>
          <switch :checked="mod.enabled" color="#ff8fab" @change="toggleItem(modList, mod.id)" />
        </view>
        <view v-if="filteredMods.length === 0" class="mods__empty">
          <text class="mods__empty-icon">🧩</text>
          <text class="mods__empty-text">还没有安装 Mod</text>
          <text class="mods__empty-hint">点击右上角 + 添加</text>
        </view>
      </view>

      <!-- 资源包列表 -->
      <view v-if="activeTab === 'resourcepack'" class="mods__list">
        <view v-for="(rp, idx) in filteredResourcePacks" :key="rp.id" class="item-card" :class="{ 'item-card--sorting': sortMode, 'item-card--xray': rp.isXray, 'item-card--warn': rp.compat === 'warn', 'item-card--error': rp.compat === 'error' }">
          <view v-if="sortMode" class="item-card__sort">
            <text class="item-card__sort-btn" :class="{ 'item-card__sort-btn--disabled': idx === 0 }" @tap.stop="moveItemByIndex(resourcePacks, filteredResourcePacks, idx, -1)">▲</text>
            <text class="item-card__sort-btn" :class="{ 'item-card__sort-btn--disabled': idx === filteredResourcePacks.length - 1 }" @tap.stop="moveItemByIndex(resourcePacks, filteredResourcePacks, idx, 1)">▼</text>
          </view>
          <view class="item-card__icon" style="background: rgba(100,200,255,0.15)">🎨</view>
          <view class="item-card__main">
            <text class="item-card__name">{{ rp.name }}<text v-if="rp.isXray" class="item-card__tag item-card__tag--danger">透视</text></text>
            <text class="item-card__info">{{ rp.desc }}</text>
            <text class="item-card__mc" :class="{ 'item-card__mc--warn': rp.compat === 'warn', 'item-card__mc--error': rp.compat === 'error' }">{{ rp.version }} · {{ rp.size }} {{ getCompatLabel(rp.compat) }}</text>
          </view>
          <switch :checked="rp.enabled" color="#8fbbff" @change="toggleItem(resourcePacks, rp.id)" />
        </view>
        <view v-if="filteredResourcePacks.length === 0" class="mods__empty">
          <text class="mods__empty-icon">🎨</text>
          <text class="mods__empty-text">还没有资源包</text>
          <text class="mods__empty-hint">点击右上角 + 添加资源包</text>
        </view>
      </view>

      <!-- 光影包列表 -->
      <view v-if="activeTab === 'shaderpack'" class="mods__list">
        <view v-for="(sp, idx) in filteredShaderPacks" :key="sp.id" class="item-card" :class="{ 'item-card--sorting': sortMode }">
          <view v-if="sortMode" class="item-card__sort">
            <text class="item-card__sort-btn" :class="{ 'item-card__sort-btn--disabled': idx === 0 }" @tap.stop="moveItemByIndex(shaderPacks, filteredShaderPacks, idx, -1)">▲</text>
            <text class="item-card__sort-btn" :class="{ 'item-card__sort-btn--disabled': idx === filteredShaderPacks.length - 1 }" @tap.stop="moveItemByIndex(shaderPacks, filteredShaderPacks, idx, 1)">▼</text>
          </view>
          <view class="item-card__icon" style="background: rgba(255,200,100,0.15)">☀️</view>
          <view class="item-card__main">
            <text class="item-card__name">{{ sp.name }}</text>
            <text class="item-card__info">{{ sp.desc }}</text>
            <text class="item-card__mc">
              {{ sp.version }} · {{ sp.size }}
              <text v-if="sp.perf" class="item-card__perf" :style="{ color: PERF_LABELS[sp.perf].color }"> · {{ PERF_LABELS[sp.perf].label }}</text>
            </text>
          </view>
          <switch :checked="sp.enabled" color="#ffcc44" @change="toggleItem(shaderPacks, sp.id)" />
        </view>
        <view v-if="filteredShaderPacks.length === 0" class="mods__empty">
          <text class="mods__empty-icon">☀️</text>
          <text class="mods__empty-text">还没有光影包</text>
          <text class="mods__empty-hint">点击右上角 + 添加光影包</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.mods {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1530 0%, #0f0d1f 100%);
  
  &__header {
    display: flex;
    align-items: center;
    padding: 60rpx 24rpx 16rpx;
  }
  &__back { font-size: 48rpx; color: #ffb7d5; margin-right: 16rpx; padding: 0 8rpx; }
  &__title { flex: 1; font-size: 44rpx; font-weight: 700; color: #fff; }
  &__add {
    width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #ffb7d5, #ff8fab); border-radius: 16rpx;
    font-size: 40rpx; color: #fff; font-weight: 300;
  }
  &__tabs { display: flex; position: relative; padding: 0 24rpx; margin-bottom: 12rpx; }
  &__tab {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8rpx;
    padding: 20rpx 0; font-size: 26rpx; color: #888; position: relative; z-index: 1;
    &--active { color: #ffb7d5; font-weight: 600; }
  }
  &__tab-count { font-size: 20rpx; background: rgba(255,255,255,0.1); padding: 2rpx 12rpx; border-radius: 20rpx; }
  &__tab-indicator {
    position: absolute; bottom: 0; width: 33.33%; height: 4rpx;
    background: linear-gradient(90deg, #ffb7d5, #ff8fab); border-radius: 2rpx; transition: left 0.3s;
  }
  &__search-bar {
    display: flex; gap: 12rpx; padding: 0 24rpx; margin-bottom: 12rpx;
  }
  &__search {
    flex: 1; height: 72rpx; background: rgba(255,255,255,0.06); border-radius: 12rpx;
    padding: 0 20rpx; font-size: 28rpx; color: #fff; box-sizing: border-box;
  }
  &__folder-btn {
    width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.06); border-radius: 12rpx; font-size: 32rpx;
    &--active {
      background: rgba(255,183,213,0.18);
      color: #ffb7d5;
    }
  }
  &__content { flex: 1; padding: 0 24rpx 40rpx; }
  &__list { display: flex; flex-direction: column; gap: 10rpx; }
  &__empty { text-align: center; padding: 120rpx 0; }
  &__empty-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
  &__empty-text { font-size: 30rpx; color: #fff; display: block; margin-bottom: 8rpx; }
  &__empty-hint { font-size: 24rpx; color: #666; display: block; }
}

.item-card {
  display: flex; align-items: center; padding: 18rpx 20rpx;
  background: rgba(255,255,255,0.04); border-radius: 12rpx; border: 2rpx solid rgba(255,255,255,0.04);

  &--sorting {
    border-color: rgba(255,183,213,0.25);
    background: rgba(255,183,213,0.05);
  }
  &--warn {
    border-color: rgba(251, 191, 36, 0.4);
    background: rgba(251, 191, 36, 0.06);
  }
  &--error {
    border-color: rgba(248, 113, 113, 0.4);
    background: rgba(248, 113, 113, 0.06);
  }
  &--xray {
    border-color: rgba(248, 113, 113, 0.3);
  }
  &__sort {
    display: flex; flex-direction: column; gap: 4rpx; margin-right: 12rpx; flex-shrink: 0;
  }
  &__sort-btn {
    width: 40rpx; height: 32rpx; display: flex; align-items: center; justify-content: center;
    font-size: 22rpx; color: #ffb7d5; background: rgba(255,183,213,0.1);
    border-radius: 6rpx; line-height: 1;
    &--disabled {
      color: #555; background: rgba(255,255,255,0.03);
    }
  }
  &__icon {
    width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center;
    font-size: 28rpx; border-radius: 12rpx; margin-right: 16rpx; flex-shrink: 0;
  }
  &__main { flex: 1; min-width: 0; }
  &__name { font-size: 28rpx; color: #fff; font-weight: 500; display: block; }
  &__info { font-size: 22rpx; color: #888; display: block; margin-top: 4rpx; }
  &__mc { font-size: 20rpx; color: #666; display: block; margin-top: 2rpx; }
  &__mc--warn { color: #fbbf24; }
  &__mc--error { color: #f87171; }
  &__tag {
    display: inline-block; font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 8rpx;
    margin-left: 8rpx; vertical-align: middle;
    &--danger {
      background: rgba(248, 113, 113, 0.2);
      color: #f87171;
      border: 1rpx solid rgba(248, 113, 113, 0.4);
    }
  }
  &__perf {
    font-size: 20rpx; font-weight: 500;
  }
}
</style>