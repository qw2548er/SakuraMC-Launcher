#!/usr/bin/env bash
# ============================================================
# 樱花 MC 启动器 - Android APK 一键打包脚本
# 用法: ./build-apk.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🌸 樱花 MC 启动器 - Android APK 构建脚本"
echo "=========================================="
echo ""

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 未检测到 Java, 请先安装 JDK 17"
    echo "   macOS: brew install openjdk@17"
    echo "   Ubuntu: sudo apt install openjdk-17-jdk"
    echo "   Windows: https://adoptium.net/"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -oP '\d+' | head -1)
echo "✅ Java 版本: $JAVA_VERSION"

if [ "$JAVA_VERSION" -gt 17 ]; then
    echo "⚠️  警告: Java $JAVA_VERSION 可能与 Android Gradle 不兼容"
    echo "   建议使用 Java 17 (LTS)"
fi

# 检查 Android SDK
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    echo ""
    echo "❌ 未检测到 Android SDK"
    echo ""
    echo "安装步骤:"
    echo "  1. 下载 Android Studio: https://developer.android.com/studio"
    echo "  2. 打开 SDK Manager, 安装:"
    echo "     - Android SDK Platform 33"
    echo "     - Android SDK Build-Tools 33.0.0"
    echo "     - Android SDK Platform-Tools"
    echo "  3. 设置环境变量:"
    echo "     export ANDROID_HOME=\$HOME/Android/Sdk"
    echo "     export PATH=\$PATH:\$ANDROID_HOME/tools:\$ANDROID_HOME/platform-tools"
    exit 1
fi

echo "✅ Android SDK: ${ANDROID_HOME:-$ANDROID_SDK_ROOT}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js, 请先安装 Node.js >= 18"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# 构建 H5
echo ""
echo "📦 第一步: 构建 H5 版本..."
cd "$PROJECT_ROOT"

if [ ! -d "node_modules" ]; then
    echo "  安装项目依赖..."
    npm install --legacy-peer-deps
fi

npm run build:h5

echo ""
echo "📱 第二步: 准备 Cordova 工程..."
cd "$SCRIPT_DIR"

# 复制 H5 产物
rm -rf www
mkdir -p www
cp -r "$PROJECT_ROOT/dist/build/h5/"* www/

# 安装 Cordova
if ! command -v cordova &> /dev/null; then
    echo "  安装 Cordova CLI..."
    npm install -g cordova
fi

# 添加 Android 平台 (如果还没加)
if [ ! -d "platforms/android" ]; then
    echo "  添加 Android 平台..."
    cordova platform add android --no-interactive
fi

# 构建 APK
echo ""
echo "🔨 第三步: 构建 Debug APK..."
cordova build android --debug

APK_PATH="platforms/android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    OUTPUT_DIR="$PROJECT_DIR/dist"
    mkdir -p "$OUTPUT_DIR"
    cp "$APK_PATH" "$OUTPUT_DIR/樱花MC启动器-0.1.0-android.apk"
    
    echo ""
    echo "✅ 构建成功!"
    echo "📂 APK 路径: $OUTPUT_DIR/樱花MC启动器-0.1.0-android.apk"
    echo "📦 文件大小: $(du -h "$OUTPUT_DIR/樱花MC启动器-0.1.0-android.apk" | cut -f1)"
else
    echo "❌ 构建失败, 未找到 APK 文件"
    exit 1
fi
