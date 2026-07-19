# 🌸 樱花 MC 启动器 (SakuraMC Launcher)

> 一个跨平台 Minecraft Java 版启动器 + 完整樱花穿透 (Sakura Frp) 控制台  
> 基于 uni-app Vue3 + TypeScript + Pinia 构建，一份代码同时支持 H5 浏览器与 Android 原生 App

![version](https://img.shields.io/badge/version-0.5.0-ffb7d5?logo=github)
![uniapp](https://img.shields.io/badge/uni--app-Vue3-d896ff?logo=vuedotjs)
![typescript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![license](https://img.shields.io/github/license/qw2548er/SakuraMC-Launcher?color=4ade80)
![build](https://img.shields.io/github/actions/workflow/status/qw2548er/SakuraMC-Launcher/release.yml?label=构建状态&logo=githubactions&logoColor=white)
![release](https://img.shields.io/github/v/release/qw2548er/SakuraMC-Launcher?include_prereleases&color=ff69b4&logo=github)
![downloads](https://img.shields.io/github/downloads/qw2548er/SakuraMC-Launcher/total?color=9b59b6&logo=github)
![stars](https://img.shields.io/github/stars/qw2548er/SakuraMC-Launcher?style=social)

---

## 📦 下载安装

**最新版本**: [v0.5.0](https://github.com/qw2548er/SakuraMC-Launcher/releases/tag/v0.5.0)

| 平台 | 下载 | 说明 |
|------|------|------|
| 📱 Android | [APK](https://github.com/qw2548er/SakuraMC-Launcher/releases/latest) | Cordova 打包，支持 Android 5.0+ |
| 🌐 H5 网页版 | [在线预览 / 下载 zip](https://github.com/qw2548er/SakuraMC-Launcher/releases/latest) | 浏览器直接用，免安装 |
| 🪟 Windows | 规划中 | Electron 桌面端 (v0.6.0 计划) |

> Android 用户下载 APK 后请允许「安装未知来源应用」。首次启动会请求存储权限用于管理游戏文件。

---

## ✨ 核心功能

### 🎮 启动器核心
- ✅ **多账号系统** — 微软 OAuth (设备码流程) + 离线账号，自动生成稳定 UUID
- ✅ **皮肤预览** — 集成 crafatar 头像/皮肤/披风
- ✅ **版本管理** — Mojang 官方 / BMCL 镜像 / MCBBS 镜像，支持 1.7~1.21+ 全部版本
- ✅ **下载管理** — 多任务并发、暂停/恢复/取消、SHA1 校验、断点续传
- ✅ **启动命令生成** — 自动构造 JVM 参数，复制或下载 .bat / .sh 启动脚本
- ✅ **JVM 调优** — G1GC 预设参数，内存自定义
- ✅ **启动失败诊断** — 详细错误堆栈 + 一键复制日志

### 🧩 Mod 与整合包
- ✅ **Mod 加载器** — Forge / Fabric / Quilt / NeoForge / OptiFine 全支持
- ✅ **Mod 管理** — 列表浏览、拖拽排序、一键启用/禁用
- ✅ **整合包导入** — Modrinth / CurseForge / 通用 zip 格式自动识别

### 🖥️ 服务器管理
- ✅ **远程服务器** — SLP 协议测速，MOTD / 在线人数 / 延迟
- ✅ **多类型支持** — Vanilla / Paper / Spigot / Forge / Fabric / Bedrock
- ✅ **穿透绑定** — 服务器与樱花穿透隧道联动

### 🌸 樱花穿透 (完整集成)
- ✅ **账号登录** — natfrp.com API 完整对接
- ✅ **节点列表** — 全部节点 + 实时状态 + 延迟检测
- ✅ **隧道管理** — 创建 / 编辑 / 删除 / 查询
- ✅ **预设模板** — MC Java / MC 基岩 / RDP / SSH / MCSManager 一键
- ✅ **协议支持** — TCP / UDP / HTTP / HTTPS
- ✅ **流量查询** — 实时流量统计，进度条可视化
- ✅ **配置文件** — 一键生成 frpc.ini / .toml
- ✅ **frpc 下载** — 跨平台二进制下载 (Win / Linux / Mac / Android)

### 📁 文件与存档
- ✅ **文件管理器** — 浏览 / 搜索 / 排序 / 新建 / 重命名 / 图片预览，内置 + 外部双引擎
- ✅ **存档管理** — 备份 / 恢复 / 导入
- ✅ **截图浏览** — 懒加载 + 全尺寸预览 + 分享
- ✅ **日志查看** — 启动日志 / 错误日志一键查看

### ⚙️ 设置
- ✅ **Java 路径** — 手动设置 / Temurin 一键下载 / 自动检测
- ✅ **内存分配** — 最小 / 最大堆内存
- ✅ **下载源切换** — Mojang / BMCL / MCBBS 三镜像
- ✅ **主题** — 深色 / 浅色 / 跟随系统 + 自定义背景图
- ✅ **多语言** — 简中 / 繁中 / 英文
- ✅ **数据导出** — 一键备份全部配置
- ✅ **首次启动引导** — 权限说明 + 快速上手

---

## 🏗️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | uni-app Vue3 + Composition API + TypeScript |
| 状态管理 | Pinia 2.x |
| UI | 自研组件库 (玻璃拟态 + 樱花主题) |
| 样式 | SCSS + CSS 变量主题 |
| 构建 | Vite 5 |
| 移动端 | Cordova + 自研原生插件 (Shell / 文件选择 / 本地 HTTP / WebView 配置) |
| 桌面端 | Electron (规划中) |
| 目标平台 | H5 / Android / iOS / Windows / macOS / Linux |

---

## 📂 项目结构

```
SakuraMC-Launcher/
├── src/
│   ├── api/                    # API 封装
│   │   ├── mojang.ts          # 微软 OAuth + Mojang
│   │   ├── bmcl.ts            # BMCL / 版本 / Mod API
│   │   └── natfrp.ts          # 樱花穿透 API
│   ├── components/             # 公共组件 (mc-button / mc-card / ...)
│   ├── pages/                  # 页面
│   │   ├── index/             # 首页
│   │   ├── accounts/          # 账号
│   │   ├── versions/          # 版本管理
│   │   ├── mods/              # Mod 管理
│   │   ├── servers/           # 服务器
│   │   ├── frp/               # 樱花穿透
│   │   ├── files/             # 文件管理器
│   │   ├── saves/             # 存档管理
│   │   ├── screenshots/       # 截图浏览
│   │   ├── downloads/         # 下载管理
│   │   ├── logs/              # 日志查看
│   │   ├── controls/          # 按键映射
│   │   ├── about/             # 关于页面
│   │   └── settings/          # 设置
│   ├── stores/                 # Pinia stores
│   ├── utils/                  # 工具 (launcher / downloader / frpc / java / modpack ...)
│   ├── types/                  # TypeScript 类型
│   └── static/                 # 静态资源
├── build/
│   ├── mobile/                 # Cordova Android 构建配置 + 自研插件
│   │   ├── cordova-plugin-sakuramc-core/    # 核心原生能力
│   │   ├── cordova-plugin-local-httpd/      # 本地 HTTP 服务
│   │   └── cordova-plugin-webview-config/   # WebView 配置
│   └── desktop/                # Electron 桌面端 (规划中)
├── scripts/                    # 构建脚本
├── .github/workflows/          # CI/CD
├── CHANGELOG.md                # 更新日志
└── package.json
```

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- npm / pnpm / yarn 任一

### 安装依赖
```bash
npm install
```

### 启动 H5 开发服务器
```bash
npm run dev:h5
```
浏览器打开 http://localhost:5173

### 构建产物

```bash
# H5 网页版 (产物: dist/build/h5)
npm run build:h5

# Android App (需要 Cordova 环境 + Android SDK)
npm run build:app-android
```

---

## 📱 平台差异

| 功能 | H5 浏览器 | Android App |
|------|----------|-------------|
| 启动游戏 | 生成命令 + 下载脚本 | 调用 Java 进程启动 |
| 下载文件 | Blob 下载 | 文件系统直写 |
| frpc 进程 | 仅生成配置 + 脚本 | 一键启动 frpc |
| 微软 OAuth | 设备码流程 | 设备码流程 |
| 文件管理 | 浏览器沙箱受限 | 完整文件系统 |
| 权限 | 无需 | 存储权限运行时请求 |

---

## 🌸 樱花穿透使用流程

1. 在「穿透」页登录 natfrp 账号
2. 创建隧道（可选 MC 预设，自动填好端口 25565）
3. 选择节点（建议国内节点延迟低）
4. **H5 端**：下载 frpc 二进制 + 配置文件 → PC 上运行 `frpc -c tunnel.ini`
5. **App 端**：直接点「启动」一键运行 frpc
6. 把隧道地址分享给朋友，即可联机

---

## 🛠️ 开发说明

### 添加新页面
1. 在 `src/pages/<name>/` 下创建 `<name>.vue`
2. 在 `src/pages.json` 的 `pages` 数组添加路由
3. 使用 `uni.navigateTo({ url: '/pages/<name>/<name>' })` 跳转

### 添加新组件
- 放在 `src/components/`
- 命名 `mc-` 前缀
- 使用 `<script setup lang="ts">` + SCSS scoped

### 状态管理
- 在 `src/stores/` 创建 `useXxxStore`
- 使用 Pinia 组合式 API 风格
- 持久化通过 `uni.setStorageSync` / `uni.getStorageSync`

### 条件编译
```typescript
// #ifdef APP-PLUS    // 仅 App 端
// #ifdef H5          // 仅 H5 端
// #ifndef APP-PLUS   // 非 App 端
```

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 📋 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)

### 最新版本 v0.5.0
- 🆕 关于页面 + GitHub 入口
- 🆕 首次启动引导
- 🆕 启动失败错误详情 + 一键复制日志
- 🆕 文件管理器增强（搜索/排序/新建/重命名/图片预览）
- 🆕 整合包导入（Modrinth / CurseForge / 通用 zip）
- 🆕 下载管理（暂停/恢复/取消/SHA1 校验）
- 🆕 截图懒加载 + 全尺寸预览 + 分享
- 🆕 Mod 列表拖拽排序
- 🆕 背景图自定义
- 🛠️ 版本号同步 + CHANGELOG

---

## 🤝 贡献

欢迎 Issue / PR。请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

感谢所有贡献者：

[![Contributors](https://contrib.rocks/image?repo=qw2548er/SakuraMC-Launcher)](https://github.com/qw2548er/SakuraMC-Launcher/graphs/contributors)

---

## 📄 License

[MIT](./LICENSE) © 2024-2026 SakuraMC Launcher Contributors

---

## ⚠️ 免责声明

本项目仅供学习交流使用。Minecraft 是 Mojang AB 的商标，本项目与 Mojang / Microsoft 无任何关联。樱花穿透 (natfrp.com) 是第三方服务，使用需遵守其服务条款。请通过官方渠道购买 Minecraft 正版账号。
