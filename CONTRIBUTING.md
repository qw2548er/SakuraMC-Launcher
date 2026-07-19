# 🤝 贡献指南

感谢你对樱花 MC 启动器的关注！欢迎通过 Issue / Pull Request 参与建设。

## 🌸 行为准则

- 友善、尊重、包容
- 对事不对人
- 欢迎新手提问，耐心解答

## 🚀 快速上手

### 环境准备
- Node.js >= 18
- npm / pnpm 任一
- Android Studio (如需构建 APK)
- Git

### 开发流程
```bash
# 1. Fork 并克隆仓库
git clone https://github.com/<你的用户名>/SakuraMC-Launcher.git
cd SakuraMC-Launcher

# 2. 添加上游
git remote add upstream https://github.com/qw2548er/SakuraMC-Launcher.git

# 3. 安装依赖
npm install

# 4. 创建特性分支
git checkout -b feat/your-feature

# 5. 启动开发服务器
npm run dev:h5

# 6. 提交修改 (参考下方 Commit 规范)
git commit -m "feat: 新增 XXX 功能"

# 7. 推送并创建 PR
git push origin feat/your-feature
```

## 📝 Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <description>

[optional body]
```

### Type
| type | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式 (不影响逻辑) |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖 |
| `ci` | CI 配置 |
| `revert` | 回滚 |

### 示例
```
feat(mods): 支持整合包导入 Modrinth 格式
fix(launch): 修复 Java 路径含空格导致启动失败
docs: 更新 README 至 v0.5.0
chore(deps): 升级 vite 到 5.x
```

## 🛠️ 开发约定

### 代码风格
- TypeScript strict 模式
- 使用 `<script setup lang="ts">`
- 组件命名 PascalCase，工具函数 camelCase
- SCSS 嵌套不超过 4 层
- 单行不超过 120 字符

### 命名约定
| 类型 | 前缀 | 示例 |
|------|------|------|
| 公共组件 | `mc-` | `mc-button.vue` |
| 页面目录 | 小写 | `pages/versions/` |
| Store | `use*Store` | `useVersionStore` |
| 工具函数 | camelCase | `formatBytes()` |
| 常量 | UPPER_SNAKE | `APP_VERSION` |
| 类型 | PascalCase | `IVersion` / `TResult` |

### 条件编译
跨平台代码用 uni-app 条件编译：
```typescript
// #ifdef APP-PLUS
// 仅 App 端执行
// #endif

// #ifdef H5
// 仅 H5 端执行
// #endif

// #ifndef APP-PLUS
// 非 App 端执行
// #endif
```

### 状态管理
- 使用 Pinia 组合式 API
- 数据持久化用 `uni.setStorageSync` / `uni.getStorageSync`
- Store 命名 `use<Name>Store`，文件放在 `src/stores/`

### 添加新页面
1. 在 `src/pages/<name>/` 下创建 `<name>.vue`
2. 在 `src/pages.json` 的 `pages` 数组添加路由
3. 跳转：`uni.navigateTo({ url: '/pages/<name>/<name>' })`

### 添加新组件
1. 放在 `src/components/`
2. 命名 `mc-` 前缀
3. 使用 `<script setup lang="ts">` + SCSS scoped

## ✅ PR 自检清单

提交 PR 前请确认：

- [ ] 代码能通过 `npm run type-check`
- [ ] 代码能通过 `npm run build:h5`
- [ ] Commit message 符合规范
- [ ] 没有引入新的大体积依赖
- [ ] 没有泄漏 Token / 密钥 / 个人信息
- [ ] 如果新增页面，已注册路由
- [ ] 如果新增功能，已在 README / CHANGELOG 更新说明
- [ ] 如果修复 Bug，已在 PR 描述写明复现步骤

## 🐛 报告 Bug

请使用 [Bug Report 模板](.github/ISSUE_TEMPLATE/bug_report.md) 提交 Issue，并附上：

- 复现步骤
- 期望行为
- 实际行为
- 设备信息 (Android 版本 / 浏览器 / App 版本)
- 启动日志 (如有)

## 💡 提议新功能

请使用 [Feature Request 模板](.github/ISSUE_TEMPLATE/feature_request.md) 提交 Issue，说明：

- 使用场景
- 期望的交互方式
- 是否有参考的同类产品

## 🌸 樱花主题色

主色调（开发 UI 时参考）：

| 用途 | 颜色 |
|------|------|
| 主色 | `#ffb7d5` (樱花粉) |
| 辅色 | `#d896ff` (紫) |
| 成功 | `#52c41a` |
| 警告 | `#faad14` |
| 错误 | `#ff4d4f` |
| 信息 | `#1890ff` |

## 📬 联系

- Issue: https://github.com/qw2548er/SakuraMC-Launcher/issues
- Discussion: https://github.com/qw2548er/SakuraMC-Launcher/discussions

再次感谢你的贡献！🌸
