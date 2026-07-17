# 樱花 MC 启动器 (Sakura MC Launcher)

> 一个跨平台 Minecraft Java 版启动器 + 完整樱花穿透 (Sakura Frp) 控制台
> 基于 Uniapp Vue3 + TypeScript + Pinia 构建, 一份代码同时支持 H5 浏览器与 Android/iOS 原生 App

![version](https://img.shields.io/badge/version-0.1.0-ffb7d5) ![uniapp](https://img.shields.io/badge/uniapp-Vue3-d896ff) ![license](https://img.shields.io/badge/license-MIT-4ade80)

## ✨ 功能特性

### 🎮 启动器核心
- ✅ **多账号系统** - 微软 OAuth (设备码流程) + 离线账号
- ✅ **皮肤预览** - 集成 mc-heads.net 头像/皮肤/披风
- ✅ **版本管理** - Mojang 官方 / BMCL 镜像 / MCBBS 镜像, 支持 1.7~1.21+ 全部版本
- ✅ **下载隔离** - 多版本并存, 独立游戏目录
- ✅ **启动命令生成** - 自动构造 JVM 参数, 复制或下载 .bat / .sh 启动脚本
- ✅ **JVM 调优** - G1GC 预设参数, 内存自定义

### 🧩 Mod 加载器
- ✅ **Forge** - 自动获取所有版本
- ✅ **Fabric** - Yarn + Loader 集成
- ✅ **Quilt** - Fabric 兼容分支
- ✅ **NeoForge** - Forge 1.20+ 分支
- ✅ **OptiFine** - 性能优化 Mod

### 🖥️ 服务器管理
- ✅ **本地服务器** - 一键启动, 状态监控
- ✅ **远程服务器** - SLP 协议测速, MOTD/在线人数
- ✅ **多类型支持** - Vanilla / Paper / Spigot / Forge / Fabric / Bedrock
- ✅ **穿透绑定** - 服务器与穿透隧道联动

### 🌸 樱花穿透 (完整集成)
- ✅ **账号登录** - natfrp.com API 完整对接
- ✅ **节点列表** - 全部节点 + 实时状态
- ✅ **节点测速** - 延迟检测
- ✅ **隧道管理** - 创建/编辑/删除/查询
- ✅ **预设模板** - MC Java/MC 基岩/RDP/SSH/MCSManager 一键
- ✅ **协议支持** - TCP / UDP / HTTP / HTTPS
- ✅ **流量查询** - 实时流量统计, 进度条可视化
- ✅ **配置文件** - 一键生成 frpc.ini / .toml
- ✅ **frpc 下载** - 跨平台二进制下载 (Win/Linux/Mac/Android)
- ✅ **启动命令** - 直接复制粘贴运行

### ⚙️ 设置
- ✅ **Java 路径** - 手动设置 / Temurin 一键下载
- ✅ **内存分配** - 最小/最大堆内存
- ✅ **下载源切换** - 三个镜像源
- ✅ **主题** - 深色/浅色/跟随系统
- ✅ **多语言** - 简中/繁中/英文
- ✅ **数据导出** - 一键备份全部配置
- ✅ **清空数据** - 一键重置

## 🏗️ 技术栈

- **框架**: Uniapp Vue3 + Composition API + TypeScript
- **状态管理**: Pinia 2.x
- **UI**: 自研组件库 (玻璃拟态风格, 樱花主题)
- **样式**: SCSS + 主题变量
- **构建**: Vite 5
- **目标平台**: H5 (主), 可编译 Android/iOS 原生

## 📂 项目结构

```
sakura-mc-launcher/
├── src/
│   ├── api/                    # API 封装
│   │   ├── mojang.ts          # 微软 OAuth + Mojang
│   │   ├── bmcl.ts            # BMCL/版本/Mod API
│   │   └── natfrp.ts          # 樱花穿透 API
│   ├── components/             # 公共组件
│   │   ├── mc-button.vue
│   │   ├── mc-card.vue
│   │   ├── mc-badge.vue
│   │   ├── mc-input.vue
│   │   ├── mc-picker.vue
│   │   ├── mc-switch.vue
│   │   ├── mc-modal.vue
│   │   └── game-icon.vue
│   ├── pages/                  # 页面
│   │   ├── index/             # 首页
│   │   ├── accounts/          # 账号
│   │   ├── versions/          # 版本
│   │   ├── mods/              # Mod
│   │   ├── servers/           # 服务器
│   │   ├── frp/               # 樱花穿透
│   │   └── settings/          # 设置
│   ├── stores/                 # Pinia stores
│   │   ├── account.ts
│   │   ├── version.ts
│   │   ├── server.ts
│   │   ├── frp.ts
│   │   └── settings.ts
│   ├── types/                  # TypeScript 类型
│   ├── utils/                  # 工具
│   │   ├── launcher.ts        # 启动命令生成
│   │   ├── downloader.ts      # 跨端下载
│   │   ├── frpc.ts            # frpc 配置生成
│   │   ├── java.ts            # Java 推荐
│   │   └── format.ts          # 通用工具
│   ├── static/                 # 静态资源
│   ├── App.vue                 # 根组件
│   ├── main.ts                 # 入口
│   ├── manifest.json           # Uniapp 应用配置
│   ├── pages.json              # 页面路由
│   └── uni.scss                # 全局样式
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- pnpm 或 npm

### 安装依赖
```bash
npm install
# 或
pnpm install
```

### 启动 H5 开发服务器
```bash
npm run dev:h5
```
打开 http://localhost:5173

### 编译发布

**H5 (Web 部署)**:
```bash
npm run build:h5
# 产物在 dist/build/h5
```

**Android 原生 App**:
```bash
npm run build:app-android
```

**iOS 原生 App**:
```bash
npm run build:app-ios
```

## 📱 平台差异

| 功能 | H5 浏览器 | Android/iOS App |
|------|----------|----------------|
| 启动游戏 | 生成命令 + 下载脚本 | 需原生插件 (后续) |
| 下载文件 | ✅ Blob 下载 | ✅ 文件系统 |
| frpc 进程 | ❌ 仅生成配置 | ✅ 可启动 frpc |
| 微软 OAuth | ✅ 设备码 | ✅ 设备码 |

## 🌸 樱花穿透使用流程

1. 在「穿透」页登录 natfrp 账号
2. 创建隧道 (可选 MC 预设, 自动填好端口 25565)
3. 选择节点 (建议用国内节点延迟低)
4. **H5 端**: 下载 frpc 二进制 + 配置文件 → 在 PC 上运行 `frpc -c tunnel.ini`
5. **App 端** (后续): 一键启动 frpc 进程
6. 把服务器地址分享给朋友, 即可联机

## 📸 截图

- 首页: 启动卡 + 账号/版本快速选择
- 账号: 微软 OAuth 设备码 + 离线账号
- 版本: 三种筛选 (已装/正式/快照) + Mod 加载器一键装
- 穿透: 流量条 + 隧道列表 + 节点测速

## 🛠️ 开发说明

### 添加新页面
1. 在 `src/pages/<name>/` 下创建 `<name>.vue`
2. 在 `src/pages.json` 的 `pages` 数组添加路径
3. 如需 Tab 页, 加入 `tabBar.list`

### 添加新组件
- 放在 `src/components/`
- 命名 `mc-` 前缀
- 使用 `<script setup lang="ts">` + SCSS scoped

### 状态管理
- 在 `src/stores/` 创建 `useXxxStore` 文件
- 使用 Pinia 组合式 API 风格
- 数据持久化通过 `uni.setStorageSync` / `uni.getStorageSync`

## 📄 License

MIT
