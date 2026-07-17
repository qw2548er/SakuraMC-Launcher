@echo off
chcp 65001 >nul
echo ==========================================
echo   樱花 MC 启动器 - Windows 一键打包脚本
echo ==========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js, 请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 构建 H5 版本...
cd /d "%~dp0\..\.."
if not exist "node_modules" (
    echo  安装项目依赖...
    npm install --legacy-peer-deps
)
call npm run build:h5
if %errorlevel% neq 0 (
    echo [错误] H5 构建失败
    pause
    exit /b 1
)

echo.
echo [2/4] 复制构建产物...
cd /d "%~dp0"
if exist "web" rmdir /s /q "web"
mkdir "web"
xcopy /e /y /q "..\..\dist\build\h5\*" "web\" >nul

echo.
echo [3/4] 安装 Electron 依赖...
if not exist "node_modules" (
    call npm install
)
if %errorlevel% neq 0 (
    echo [错误] Electron 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [4/4] 打包 Windows 版...
call npm run dist:win
if %errorlevel% neq 0 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   打包完成!
echo   输出目录: build\desktop\release\
echo ==========================================
echo.
explorer "release"
pause
