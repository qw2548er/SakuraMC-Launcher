#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🌸 樱花 MC 启动器 - 桌面版一键构建脚本"
echo "============================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js, 请先安装 Node.js 18+"
    echo "   macOS: brew install node"
    echo "   Ubuntu: sudo apt install nodejs npm"
    exit 1
fi

echo "📦 第一步: 构建 H5 版本..."
cd "$PROJECT_ROOT"
if [ ! -d "node_modules" ]; then
    echo "  安装项目依赖..."
    npm install --legacy-peer-deps
fi
npm run build:h5

echo ""
echo "📁 第二步: 复制构建产物..."
cd "$SCRIPT_DIR"
rm -rf web
mkdir -p web
cp -r "$PROJECT_ROOT/dist/build/h5/"* web/

echo ""
echo "⚡ 第三步: 安装 Electron 依赖..."
if [ ! -d "node_modules" ]; then
    npm install
fi

echo ""
echo "🔨 第四步: 打包当前平台版本..."
OS=$(uname -s)
if [[ "$OS" == "Darwin" ]]; then
    PLATFORM="mac"
elif [[ "$OS" == "Linux" ]]; then
    PLATFORM="linux"
else
    PLATFORM="win"
fi

npm run dist:$PLATFORM

echo ""
echo "✅ 构建完成!"
echo "📂 输出目录: $SCRIPT_DIR/release/"
