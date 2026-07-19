# 更新日志

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
