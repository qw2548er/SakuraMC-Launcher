# 🌸 樱花 MC 启动器 (SakuraMC Launcher)
# 依赖许可证声明

## 项目许可证
本项目采用 MIT License 许可证。

## 第三方依赖许可证

### 核心运行时依赖

| 依赖名称 | 许可证 | 来源 |
|----------|--------|------|
| PojavLauncher | GNU LGPL | https://github.com/PojavLauncherTeam/PojavLauncher |
| OpenJDK | GNU GPLv2 | https://openjdk.org/ |
| LWJGL3 | BSD-3-Clause | https://lwjgl.org/ |
| LWJGLX (LWJGL2 API compatibility layer for LWJGL3) | Unknown | https://github.com/LWJGLX/LWJGLX |

### 图形与渲染依赖

| 依赖名称 | 许可证 | 来源 |
|----------|--------|------|
| GL4ES | MIT License | https://github.com/ptitSeb/gl4es |
| NG-GL4ES (Krypton Wrapper) | Unknown | PojavLauncher 内部组件 |
| ANGLE | All Rights Reserved | https://chromium.googlesource.com/angle/angle |
| Mesa 3D Graphics Library | MIT License | https://www.mesa3d.org/ |
| libepoxy | MIT License | https://github.com/anholt/libepoxy |
| virglrenderer | MIT License | https://gitlab.freedesktop.org/virgl/virglrenderer |

### 音频依赖

| 依赖名称 | 许可证 | 来源 |
|----------|--------|------|
| OpenAL-Soft | GNU GPLv2 | https://openal-soft.org/ |
| oboe | Apache License 2.0 | https://github.com/google/oboe |
| pfffft | All Rights Reserved | https://bitbucket.org/jpommier/pffft |

### 系统与工具依赖

| 依赖名称 | 许可证 | 来源 |
|----------|--------|------|
| Android Support Libraries | Apache License 2.0 | Google |
| bhook (Used for exit code trapping) | MIT License | https://github.com/frida/bhook |

### Apache Cordova 插件

| 插件名称 | 许可证 |
|----------|--------|
| cordova-plugin-file | Apache License 2.0 |
| cordova-plugin-inappbrowser | Apache License 2.0 |
| cordova-plugin-statusbar | Apache License 2.0 |
| cordova-plugin-whitelist | Apache License 2.0 |

---

## 许可证详细信息

### MIT License
MIT License

Copyright (c) [year] [copyright holders]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Apache License 2.0
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

### GNU LGPL
GNU Lesser General Public License
Version 3, 29 June 2007

### GNU GPLv2
GNU General Public License
Version 2, June 1991

### BSD-3-Clause
BSD 3-Clause License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

---

**注意**: 本项目集成了多个开源库，使用时请遵守各自的许可证条款。

## 依赖说明

本启动器基于 PojavLauncher 项目的核心技术实现，以下为各依赖的简要说明：

1. **PojavLauncher**: 在 Android 上运行 Minecraft Java 版的核心引擎
2. **GL4ES**: OpenGL ES 到 OpenGL 的转换层，使 Minecraft 能在 Android 上运行
3. **ANGLE**: WebGL 实现，提供高性能的图形渲染
4. **OpenJDK**: Java 运行时环境
5. **LWJGL3**: Lightweight Java Game Library，Minecraft 使用的游戏开发库
6. **Mesa 3D**: 开源图形库，提供软件渲染能力
7. **OpenAL-Soft**: 开源音频库，处理游戏音效
8. **oboe**: Google 官方音频库，提供低延迟音频播放
9. **bhook**: 用于捕获进程退出码
10. **libepoxy**: OpenGL 扩展库
11. **virglrenderer**: 虚拟 GPU 渲染器
12. **pfffft**: 快速傅里叶变换库