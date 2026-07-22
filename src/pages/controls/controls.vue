<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface KeyBinding {
  id: string
  name: string
  key: string
  category: string
}

interface ControlPreset {
  id: string
  name: string
  description: string
  bindings: KeyBinding[]
}

const presets = ref<ControlPreset[]>([])
const selectedPreset = ref<ControlPreset | null>(null)
const editingKey = ref<string | null>(null)
const newKey = ref('')

const defaultBindings: KeyBinding[] = [
  { id: 'forward', name: '前进', key: 'W', category: '移动' },
  { id: 'back', name: '后退', key: 'S', category: '移动' },
  { id: 'left', name: '左移', key: 'A', category: '移动' },
  { id: 'right', name: '右移', key: 'D', category: '移动' },
  { id: 'jump', name: '跳跃', key: '空格', category: '移动' },
  { id: 'sneak', name: '潜行', key: 'Shift', category: '移动' },
  { id: 'sprint', name: '疾跑', key: 'Ctrl', category: '移动' },
  { id: 'attack', name: '攻击/破坏', key: '鼠标左键', category: '交互' },
  { id: 'use', name: '使用/放置', key: '鼠标右键', category: '交互' },
  { id: 'pickBlock', name: '选取方块', key: '鼠标中键', category: '交互' },
  { id: 'inventory', name: '背包', key: 'E', category: '界面' },
  { id: 'crafting', name: '工作台', key: 'C', category: '界面' },
  { id: 'drop', name: '丢弃物品', key: 'Q', category: '物品' },
  { id: 'hotbar1', name: '快捷栏1', key: '1', category: '物品' },
  { id: 'hotbar2', name: '快捷栏2', key: '2', category: '物品' },
  { id: 'hotbar3', name: '快捷栏3', key: '3', category: '物品' },
  { id: 'hotbar4', name: '快捷栏4', key: '4', category: '物品' },
  { id: 'hotbar5', name: '快捷栏5', key: '5', category: '物品' },
  { id: 'hotbar6', name: '快捷栏6', key: '6', category: '物品' },
  { id: 'hotbar7', name: '快捷栏7', key: '7', category: '物品' },
  { id: 'hotbar8', name: '快捷栏8', key: '8', category: '物品' },
  { id: 'hotbar9', name: '快捷栏9', key: '9', category: '物品' },
  { id: 'chat', name: '聊天', key: 'T', category: '界面' },
  { id: 'command', name: '命令', key: '/', category: '界面' },
  { id: 'escape', name: '退出/暂停', key: 'Esc', category: '界面' },
  { id: 'fullscreen', name: '全屏', key: 'F11', category: '界面' },
  { id: 'screenshot', name: '截图', key: 'F2', category: '界面' },
  { id: 'togglePerspective', name: '切换视角', key: 'F5', category: '界面' },
  { id: 'advancements', name: '进度', key: 'L', category: '界面' },
]

const categories = ['移动', '交互', '界面', '物品']

async function loadPresets() {
  try {
    // #ifdef APP-PLUS
    const fileSystem = plus.io.getFileSystemManager()
    const presetDir = '/storage/emulated/0/MaoNingMC/control'

    try {
      const result = fileSystem.readdirSync({ dirPath: presetDir })
      const files: string[] = result.map((item: any) => item.name || item)
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = fileSystem.readFileSync(`${presetDir}/${file}`, 'utf-8')
          const preset = JSON.parse(content)
          presets.value.push(preset)
        }
      }
    } catch {
      // 目录不存在,创建
      fileSystem.mkdirSync({ dirPath: presetDir, recursive: true })
    }
    // #endif

    if (presets.value.length === 0) {
      presets.value.push({
        id: 'default',
        name: '默认布局',
        description: 'Minecraft 默认按键布局',
        bindings: [...defaultBindings]
      })
      await savePreset(presets.value[0])
    }

    selectedPreset.value = presets.value[0]
  } catch (e: any) {
    console.error('加载配置失败:', e)
    presets.value.push({
      id: 'default',
      name: '默认布局',
      description: 'Minecraft 默认按键布局',
      bindings: [...defaultBindings]
    })
    selectedPreset.value = presets.value[0]
  }
}

async function savePreset(preset: ControlPreset) {
  // #ifdef APP-PLUS
  try {
    const fileSystem = plus.io.getFileSystemManager()
    const presetDir = '/storage/emulated/0/MaoNingMC/control'
    try { fileSystem.accessSync(presetDir) }
    catch { fileSystem.mkdirSync({ dirPath: presetDir, recursive: true }) }
    fileSystem.writeFileSync(`${presetDir}/${preset.id}.json`, JSON.stringify(preset, null, 2), 'utf-8')
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (e: any) {
    console.error('保存配置失败:', e)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
  // #endif
  // #ifndef APP-PLUS
  // H5/小程序端用 localStorage 持久化
  try {
    uni.setStorageSync(`sakuram.control.${preset.id}`, JSON.stringify(preset))
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
  // #endif
}

async function deletePreset(preset: ControlPreset) {
  if (preset.id === 'default') {
    uni.showToast({ title: '不能删除默认布局', icon: 'none' })
    return
  }

  uni.showModal({
    title: '确认删除',
    content: `确定要删除"${preset.name}"吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          // #ifdef APP-PLUS
          const fileSystem = plus.io.getFileSystemManager()
          fileSystem.unlinkSync(`/storage/emulated/0/MaoNingMC/control/${preset.id}.json`)
          // #endif
          // #ifndef APP-PLUS
          uni.removeStorageSync(`sakuram.control.${preset.id}`)
          // #endif
          presets.value = presets.value.filter(p => p.id !== preset.id)
          selectedPreset.value = presets.value[0] || null
          uni.showToast({ title: '删除成功', icon: 'success' })
        } catch (e: any) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

function startEdit(keyId: string) {
  editingKey.value = keyId
  newKey.value = ''
}

function saveKeyBinding() {
  if (!editingKey.value || !newKey.value.trim()) return
  
  const binding = selectedPreset.value?.bindings.find(b => b.id === editingKey.value)
  if (binding) {
    binding.key = newKey.value.trim()
    savePreset(selectedPreset.value!)
  }
  editingKey.value = null
  newKey.value = ''
}

function cancelEdit() {
  editingKey.value = null
  newKey.value = ''
}

async function createNewPreset() {
  const now = Date.now().toString()
  const newPreset: ControlPreset = {
    id: `preset-${now}`,
    name: `新布局 ${presets.value.length + 1}`,
    description: '自定义按键布局',
    bindings: [...defaultBindings]
  }
  presets.value.push(newPreset)
  selectedPreset.value = newPreset
  await savePreset(newPreset)
}

function getBindingsByCategory(category: string) {
  return selectedPreset.value?.bindings.filter(b => b.category === category) || []
}

onMounted(() => {
  loadPresets()
})
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">按键布局</text>
      <view class="page-actions">
        <view class="btn btn--primary" @tap="createNewPreset">
          <text>+ 新建布局</text>
        </view>
      </view>
    </view>
    
    <view class="content">
      <view class="presets-section">
        <text class="section-title">布局列表</text>
        <view class="presets-list">
          <view 
            v-for="preset in presets" 
            :key="preset.id"
            class="preset-card"
            :class="{ 'preset-card--active': selectedPreset?.id === preset.id }"
            @tap="selectedPreset = preset"
          >
            <view class="preset-info">
              <text class="preset-name">{{ preset.name }}</text>
              <text class="preset-desc">{{ preset.description }}</text>
            </view>
            <view class="preset-actions">
              <text v-if="preset.id !== 'default'" class="preset-delete" @tap.stop="deletePreset(preset)">删除</text>
            </view>
          </view>
        </view>
      </view>
      
      <view v-if="selectedPreset" class="bindings-section">
        <view class="section-header">
          <text class="section-title">{{ selectedPreset.name }}</text>
          <view class="btn btn--secondary" @tap="savePreset(selectedPreset)">
            <text>保存修改</text>
          </view>
        </view>
        
        <view v-for="category in categories" :key="category" class="category-group">
          <text class="category-title">{{ category }}</text>
          <view class="bindings-grid">
            <view 
              v-for="binding in getBindingsByCategory(category)" 
              :key="binding.id"
              class="binding-item"
            >
              <text class="binding-name">{{ binding.name }}</text>
              <view class="binding-key">
                <text v-if="editingKey !== binding.id" @tap="startEdit(binding.id)">
                  {{ binding.key }}
                </text>
                <view v-else class="binding-edit">
                  <input 
                    v-model="newKey" 
                    placeholder="输入按键"
                    class="binding-input"
                    @confirm="saveKeyBinding"
                    focus
                  />
                  <text class="binding-confirm" @tap="saveKeyBinding">✓</text>
                  <text class="binding-cancel" @tap="cancelEdit">✕</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1a0f2e 0%, #0f0f1a 100%);
  padding-bottom: 120rpx;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 100rpx 32rpx 32rpx;
  background: rgba(255, 183, 213, 0.05);
}

.page-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #ffb7d5;
}

.page-actions {
  display: flex;
  gap: 16rpx;
}

.btn {
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  
  &--primary {
    background: linear-gradient(135deg, #ffb7d5, #ff8fab);
    color: #fff;
    font-weight: 600;
  }
  
  &--secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border: 2rpx solid rgba(255, 183, 213, 0.3);
  }
  
  &:active {
    opacity: 0.8;
  }
}

.content {
  padding: 24rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #ffb7d5;
  margin-bottom: 20rpx;
  display: block;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.presets-section {
  margin-bottom: 32rpx;
}

.presets-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.preset-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 183, 213, 0.15);
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &--active {
    border-color: #ffb7d5;
    background: rgba(255, 183, 213, 0.1);
  }
}

.preset-info {
  flex: 1;
}

.preset-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8rpx;
}

.preset-desc {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.4);
}

.preset-actions {
  margin-left: 16rpx;
}

.preset-delete {
  font-size: 24rpx;
  color: #ff6b6b;
  padding: 8rpx 16rpx;
}

.bindings-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16rpx;
  padding: 24rpx;
}

.category-group {
  margin-bottom: 24rpx;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.category-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: rgba(255, 183, 213, 0.8);
  margin-bottom: 16rpx;
  padding-left: 12rpx;
  border-left: 4rpx solid #ffb7d5;
}

.bindings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}

.binding-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.binding-name {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
}

.binding-key {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60rpx;
  background: rgba(255, 183, 213, 0.15);
  border-radius: 8rpx;
  
  text {
    font-size: 26rpx;
    color: #ffb7d5;
    font-weight: 600;
  }
}

.binding-edit {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.binding-input {
  flex: 1;
  height: 48rpx;
  background: rgba(0, 0, 0, 0.3);
  border: 2rpx solid #ffb7d5;
  border-radius: 8rpx;
  padding: 0 16rpx;
  font-size: 24rpx;
  color: #fff;
}

.binding-confirm {
  font-size: 28rpx;
  color: #52c41a;
  padding: 8rpx;
}

.binding-cancel {
  font-size: 28rpx;
  color: #ff6b6b;
  padding: 8rpx;
}
</style>