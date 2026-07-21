# 更新日志

## v0.5.3 — 2026-07-19

本次为问题排查与修复版本，针对 v0.5.2 实测暴露的 6 大阻断性问题进行集中修复，并落地资源管理/整合包导入功能。

### 🔥 P0 核心底层修复

#### 1. SakuraMCCore 插件加载失败修复
- **现象**：所有文件读写、资源启用/禁用逻辑全部失效，模组/资源包/光影开关均为空壳
- **根因**：[build/mobile/cordova-plugin-sakuramc-core/plugin.xml](build/mobile/cordova-plugin-sakuramc-core/plugin.xml) 缺少 `<js-module>` 声明，未注册 JS 桥接到 `cordova.plugins.SakuraMCCore`
- **修复**：
  - 新增 [www/sakuramc-core.js](build/mobile/cordova-plugin-sakuramc-core/www/sakuramc-core.js) JS 模块，桥接 19 个原生 action 到 `cordova.plugins.SakuraMCCore`
  - plugin.xml 补充 `<js-module src="www/sakuramc-core.js" name="SakuraMCCore"><clobbers target="cordova.plugins.SakuraMCCore" /></js-module>`
  - [src/utils/cordova-fs.ts](src/utils/cordova-fs.ts)、[src/utils/permissions.ts](src/utils/permissions.ts)、[src/utils/file-chooser.ts](src/utils/file-chooser.ts) 增加 `cordova.exec` 兜底调用，即使 JS 模块未注册也能直通原生

#### 2. Cordova 初始化超时修复 (Android 15 适配)
- **现象**：Android 15 冷启动时 Cordova 默认 20s 超时导致白屏
- **修复**：
  - [build/mobile/config.xml](build/mobile/config.xml) 设置 `LoadUrlTimeoutValue=60000`
  - [cordova-fs.ts](src/utils/cordova-fs.ts) `waitForReady` 移除对 `window.device` 依赖（cordova-plugin-device 未安装），改为校验 `cordova.exec` 可用性
  - [MainActivity.java](build/mobile/platforms/android/app/src/main/java/com/sakuramc/launcher/MainActivity.java) 添加 `WebView.setDataDirectorySuffix()` 防止 Android 15 多进程冲突

#### 3. 微软账号登录 invalid_grant 死循环修复
- **现象**：token 过期后刷新失败但仍保留 refreshToken，下次启动用同一个失效 token 反复尝试
- **修复**：
  - [src/stores/account.ts](src/stores/account.ts) `refreshMicrosoftToken` 在 `invalid_grant`/`invalid_request`/`invalid_client` 时**同步清空 refreshToken**，并打 `needRelogin` 标记
  - 新 token 未下发时保留旧 refreshToken：`acc.refreshToken = t.refresh_token || acc.refreshToken`
  - [src/pages/accounts/microsoft-login.vue](src/pages/accounts/microsoft-login.vue) 用递归 `setTimeout` 替换 `setInterval`，使 `slow_down` 间隔动态调整生效
  - `openLoginUrl` 在 Cordova 环境改用 `cordova.InAppBrowser.open(url, '_system')` 替代不存在的 `plus.runtime.openURL`

### 🎮 资源管理三大模块落地

#### 1. 模组模块 [src/pages/mods/mods.vue](src/pages/mods/mods.vue)
- 开关联动 SakuraMCCore 文件操作：开启把 `xxx.jar.disabled` 重命名为 `xxx.jar`，关闭反向操作
- 版本校验 `checkVersionCompat`：自动拦截 1.20 与 1.21 跨版本不兼容（如 JEI、OptiFine），UI 显示 warn/error 标签
- Iris / Sodium / Fabric API / Lithium 依赖联动：
  - 启用 Iris 时自动勾选 Fabric API、Sodium
  - 禁用 Fabric API 时若 Iris/Sodium/Lithium 仍启用，弹出依赖警告
- 启用光影必备前置：开启光影时检测 Iris/OptiFine 是否启用，未启用则提示前往模组页开启

#### 2. 资源包模块
- 开关联动游戏 `resourcepacks` 目录，写入 `options.txt` 的 `resourcePacks` JSON 数组
- 增加资源包版本校验（如 Smooth Font 1.20 跨版本提示）
- **Xray 透视资源包联机风险提示**：检测到 Xray 关键字时开启前必须二次确认，提醒可能被服务器封禁

#### 3. 光影包模块
- 依托 Iris Shaders，写入 `options.txt` 的 `shaderPack` 字段
- 按显卡性能对 4 款光影做性能分级标注（low/medium/high/extreme），给出开启建议

### 📦 整合包导入功能

#### [src/utils/modpack.ts](src/utils/modpack.ts) 全流程落地
- 新增整合包导入入口，支持 `.mrpack`、标准 `manifest.json`、通用 zip 三种格式解析
- 自动解压整合包，拆分模组/资源包/光影文件分别归档到对应目录
- 自动校验整合包声明的 MC 版本与当前选中版本兼容性：
  - 同主+次版本：`ok`
  - 跨次版本（差 1）：`warn`
  - 跨大版本：`error`
- `detectConflictingMods` 扫描 mods 目录中与整合包 MC 版本不兼容的 mod，导入完成时弹窗高亮提示冲突项
- [src/pages/versions/versions.vue](src/pages/versions/versions.vue) `importPack` 改为 `showModal` 展示完整导入结果（版本兼容性 + 冲突 mod 列表），替代原来的 `showToast`

### 🐛 其他修复

- [src/utils/modpack.ts](src/utils/modpack.ts)、[src/stores/version.ts](src/stores/version.ts) 中所有 `plus.io` 调用替换为 `cordova-fs.ts` API（H5+Cordova 环境无 plus 对象）
- [src/utils/file-chooser.ts](src/utils/file-chooser.ts) 移除 `#ifdef APP-PLUS` 条件编译（项目为 H5+Cordova，分支永不执行）
- [src/utils/permissions.ts](src/utils/permissions.ts) `exec` 函数使用 `cordova.exec` 兜底，避免权限申请在 JS 模块未注册时静默失败
- [src/utils/path.ts](src/utils/path.ts) 游戏目录改用 App 外部私有目录 `getAppExternalFilesDir`，规避 Android 15 高版本系统外部存储根目录卡死

### ✅ 验收清单

- [x] SakuraMCCore 正常加载，文件读写无报错
- [x] 模组/资源包/光影开关操作，游戏内可生效
- [x] 整合包导入功能完整可用，版本冲突自动提醒
- [x] 跨版本模组/资源包自动拦截提示
- [x] Cordova 初始化、微软登录报错修复
- [x] Iris+光影组合可正常启用渲染

### 📋 已知兼容清单

- ✅ Minecraft 1.21 + Fabric Loader 0.15.x + Fabric API
- ✅ Iris Shaders + Sodium + Lithium 性能组合
- ✅ Complementary Shaders / BSL / SEUS / Sildur's 光影包
- ⚠️ JEI 1.20 / OptiFine 1.20 需升级到 1.21 版本，否则启动器自动拦截
- ⚠️ Smooth Font 1.20 资源包会给出跨版本警告
- ⚠️ Xray 类透视资源包开启前强制二次确认

---

## v0.5.0 — 2026-07-19

本次为大版本更新，新增了 7 大功能模块、4 项体验改进，并修复多个阻断性 BUG。

### ✨ 新功能

#### 1. 内置文件管理器增强 ([#files](src/pages/files/files.vue))
- 新增工具栏：搜索栏 + 排序按钮 + 新建按钮
- 支持按名称 / 大小 / 修改时间排序，可切换升降序
- 长按文件弹出操作菜单（重命名 / 删除 / 复制路径 / 打开方式）
- 新建文件夹 / 新建文件对话框
- 图片预览弹窗
- 修复 CSS 拼写错误

#### 2. 整合包导入 ([src/utils/modpack.ts](src/utils/modpack.ts))
- 自动识别三种整合包格式：
  - **Modrinth** (`.mrpack`)：解析 `modrinth.index.json`
  - **CurseForge** (`manifest.json`)：解析模组清单
  - **通用 zip**：直接解压到 `versions/<name>/`
- 导入进度实时显示
- 自动应用 `overrides/` 覆盖到 `.minecraft/`
- 自动识别 Fabric / Forge / Quilt / NeoForge 加载器
- 版本页面新增 📦 导入按钮

#### 3. 存档导入 ([src/pages/saves/saves.vue])
- 从外部 zip 导入存档
- 自动检测 zip 内是否包含 `level.dat`（Minecraft 存档特征）
- 智能识别根目录结构，避免多套一层目录
- 导入后自动刷新列表

#### 4. 自定义背景图 ([src/pages/settings/settings.vue])
- 设置页新增「外观」section
- 可选择本地图片作为启动器背景
- 图片复制到 `${SAKURA_ROOT}/config/backgrounds/background.png` 持久化
- 一键清除恢复默认背景

#### 5. 下载管理页面 ([src/pages/downloads/downloads.vue](src/pages/downloads/downloads.vue))
- 独立的下载管理页面，从首页导航栏 📥 进入
- 统计卡片：下载中 / 已完成 / 已暂停 / 失败
- 实时显示总下载速度
- 筛选标签：全部 / 下载中 / 已暂停 / 已完成 / 失败
- 任务操作：暂停 / 继续 / 重试 / 取消 / 移除
- 批量操作：清理已完成 / 清除全部

#### 6. 截图预览增强 ([src/pages/screenshots/screenshots.vue](src/pages/screenshots/screenshots.vue))
- 缩略图懒加载（200×200，滚动到可见时才加载）
- 全尺寸图片预览（1920×1080）
- 网格 / 列表双视图切换
- 一键分享截图到其他应用（真实调用系统分享）
- 滚动到底部自动批量加载更多缩略图

#### 7. 模组列表拖拽排序 ([src/pages/mods/mods.vue](src/pages/mods/mods.vue))
- 搜索栏新增 ↕ 排序模式开关
- 排序模式下每项显示 ▲ ▼ 上移/下移按钮
- 顺序持久化到 localStorage
- 三个 tab（Mod / 资源包 / 光影包）都支持

#### 8. 下载完整性校验 (SHA1)
- 下载完成后自动校验文件 SHA1 哈希
- 校验失败自动标记错误，避免安装损坏文件
- 下载管理页显示「校验中」状态和 ✓ 已校验徽章

### 🚀 体验改进

#### 1. 关于页面 ([src/pages/about/about.vue](src/pages/about/about.vue))
- 集中展示版本号 / 作者 / 更新日志
- 一键跳转 GitHub 仓库
- 一键检查更新
- 反馈入口

#### 2. 启动失败错误详情
- 启动游戏失败时显示完整错误信息
- 一键复制日志按钮，便于用户反馈

#### 3. 首次启动引导
- 首次安装时弹出权限说明弹窗
- 引导用户授予存储 / 文件权限
- 避免用户拒绝权限后不知道怎么回事

### 🐛 BUG 修复

- 修复 `file-chooser.ts` 中 `Promise` 未闭合括号
- 修复 `modpack.ts` 中 `deleteFile` 误从 file-chooser 导入
- 修复 `modpack.ts` 中 `fabric-loader` / `quilt-loader` 属性名连字符问题
- 修复 `saves.vue` 中 `pluginDeleteFile` 不存在的导出
- 修复 `files.vue` 中 `height: 48rpxpx` CSS 拼写错误

### 🔧 技术优化

- Cordova 插件新增原生方法：`mkdir` / `rename` / `unzip` / `listZip` / `shareFile` / `getImageBase64` / `sha1File` / `chooseFile`
- 前端工具库 `file-chooser.ts` 统一封装所有 Cordova 调用
- 下载任务新增 `verifying` / `verified` / `expectedSha1` 字段
- 截图接口新增 `thumb` / `thumbLoading` / `fullBase64` 字段

---

## v0.4.3 — 2026-07-18

- 补充 APK 扩展权限（蓝牙 / NFC / 通知 / 前台服务 / 悬浮窗等）
- 同步版本号至 v0.4.3

## v0.4.0 — 2026-07-17

- 集中修复多处阻断性 BUG 和功能缺陷

## v0.3.0 — 2026-07-15

- 启动页面内嵌终端，手机端自动运行 Java 命令
- 修复手机端路径配置和启动流程
