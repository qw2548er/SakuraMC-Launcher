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
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -oP '\d+' | head -1)
echo "✅ Java 版本: $JAVA_VERSION"

# 检查 Android SDK
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    echo "❌ 未检测到 Android SDK"
    exit 1
fi

echo "✅ Android SDK: ${ANDROID_HOME:-$ANDROID_SDK_ROOT}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js"
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

# 复制 H5 产物到 www
rm -rf www
mkdir -p www
cp -r "$PROJECT_ROOT/dist/build/h5/"* www/

# 复制启动页
cp "$SCRIPT_DIR/launcher.html" www/launcher.html

# 安装 Cordova
if ! command -v cordova &> /dev/null; then
    echo "  安装 Cordova CLI..."
    npm install -g cordova
fi

# 安装本地 HTTP 服务器插件
if [ ! -d "plugins/cordova-plugin-local-httpd" ]; then
    echo "  安装本地 HTTP 服务器插件..."
    cordova plugin add "$SCRIPT_DIR/cordova-plugin-local-httpd" --no-interactive
fi

# 添加 Android 平台 (如果还没加)
if [ ! -d "platforms/android" ]; then
    echo "  添加 Android 平台..."
    cordova platform add android@13.0.0 --no-interactive
fi

# 构建 APK
echo ""
echo "🔨 第三步: 构建 Debug APK..."
cordova build android --debug

APK_PATH="platforms/android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    OUTPUT_DIR="$PROJECT_ROOT/dist"
    mkdir -p "$OUTPUT_DIR"
    cp "$APK_PATH" "$OUTPUT_DIR/SakuraMC-Launcher-v0.5.0-android.apk"

    echo ""
    echo "✅ 构建成功!"
    echo "📂 APK 路径: $OUTPUT_DIR/SakuraMC-Launcher-v0.5.0-android.apk"
    echo "📦 文件大小: $(du -h "$OUTPUT_DIR/SakuraMC-Launcher-v0.5.0-android.apk" | cut -f1)"
else
    echo "❌ 构建失败, 未找到 APK 文件"
    exit 1
fi
