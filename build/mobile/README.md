# 樱花 MC 启动器 - 手机版打包说明 (Android)

## 方法一: Cordova 打包 (推荐, 命令行)

### 前提条件
- Node.js >= 18
- Java 8+ (JDK)
- Android SDK (API 33+)
- Gradle

### 步骤

1. 先构建 H5 版本:
   ```bash
   cd ../../
   npm run build:h5
   ```

2. 复制构建产物到 www 目录:
   ```bash
   mkdir -p www
   cp -r ../../dist/build/h5/* www/
   ```

3. 安装 Cordova:
   ```bash
   npm install -g cordova
   ```

4. 添加 Android 平台:
   ```bash
   cordova platform add android
   ```

5. 构建 debug APK:
   ```bash
   cordova build android --debug
   ```

6. 构建 release APK (需签名):
   ```bash
   cordova build android --release -- --keystore=your.keystore --storePassword=xxx --alias=alias --password=xxx
   ```

7. 输出路径:
   ```
   platforms/android/app/build/outputs/apk/release/app-release.apk
   ```

## 方法二: HBuilderX 打包 (推荐给不熟悉命令行的用户)

1. 下载安装 HBuilderX: https://www.dcloud.io/hbuilderx.html
2. 打开 HBuilderX, 文件 → 导入 → 从本地目录导入 → 选择项目根目录
3. 选择项目根目录 → 右键 → 发行 → 原生App-云打包
4. 填写打包信息:
   - 应用名称: 樱花MC启动器
   - 版本号: 0.1.0
   - 证书: 可以用公共证书快速测试
5. 等待云端打包完成, 下载 APK

## 方法三: 直接使用 H5 PWA (最简单)

用 Chrome / 系统浏览器打开 H5 页面 → 添加到主屏幕 → 像 App 一样使用

## 功能说明

手机版主要功能:
- ✅ 樱花穿透账号管理 (登录/隧道/节点/流量)
- ✅ 远程服务器监控 (SLP 测速/MOTD)
- ✅ 版本管理与 Mod 加载器信息查看
- ✅ 启动命令生成与复制
- ✅ frpc 配置文件生成与下载

注意: 手机端无法直接启动 Minecraft Java 版游戏 (需要 PC 端)，但可以：
- 远程管理本地服务器
- 配置樱花穿透隧道
- 查看服务器状态
- 生成启动命令发给电脑
