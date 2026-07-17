# 樱花 MC 启动器 - 桌面版打包说明

## 快速开始

```bash
cd build/desktop
npm install
npm start          # 开发模式运行 (需要 web 目录有构建产物)
npm run dist:win   # 打包 Windows 安装版 + 便携版
```

## 前提条件

1. 先在项目根目录构建 H5:
   ```bash
   npm run build:h5
   ```

2. 将构建产物复制到 `build/desktop/web/` 目录:
   ```bash
   cp -r dist/build/h5/* build/desktop/web/
   ```

3. 安装 Electron 依赖并打包:
   ```bash
   cd build/desktop
   npm install
   npm run dist:win
   ```

## 输出

- Windows 安装版: `release/樱花MC启动器-0.1.0-setup.exe`
- Windows 便携版: `release/樱花MC启动器-0.1.0.exe`
- macOS: `release/樱花MC启动器-0.1.0.dmg`
- Linux: `release/樱花MC启动器-0.1.0.AppImage`

## 功能

- ✅ 原生窗口运行 H5 启动器
- ✅ 真正调用 Java 启动 Minecraft (通过 node exec)
- ✅ 真正启动 frpc 进程 (通过 node spawn)
- ✅ 文件选择对话框
- ✅ 系统菜单 + 关于对话框
- ✅ 打开游戏目录
