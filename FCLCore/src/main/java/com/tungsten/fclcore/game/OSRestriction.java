/*
 * Hello Minecraft! Launcher
 * Copyright (C) 2020  huangyuhui <huanghongxun2008@126.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package com.tungsten.fclcore.game;

import com.tungsten.fclcore.util.platform.OperatingSystem;

public final class OSRestriction {

    private final OperatingSystem name;
    private final String version;
    private final String arch;

    public OSRestriction() {
        this(OperatingSystem.UNKNOWN);
    }

    public OSRestriction(OperatingSystem name) {
        this(name, null);
    }

    public OSRestriction(OperatingSystem name, String version) {
        this(name, version, null);
    }

    public OSRestriction(OperatingSystem name, String version, String arch) {
        this.name = name;
        this.version = version;
        this.arch = arch;
    }

    public OperatingSystem getName() {
        return name;
    }

    public String getVersion() {
        return version;
    }

    public String getArch() {
        return arch;
    }

    public boolean allow() {
        OperatingSystem current = getCurrentOperatingSystem();

        if (name != null && name != OperatingSystem.UNKNOWN) {
            if (name != current) {
                return false;
            }
        }

        if (version != null && !version.isEmpty()) {
            String currentVersion = System.getProperty("os.version", "");
            if (!currentVersion.startsWith(version)) {
                return false;
            }
        }

        if (arch != null && !arch.isEmpty()) {
            String currentArch = System.getProperty("os.arch", "");
            if (!currentArch.equals(arch) && !currentArch.contains(arch)) {
                return false;
            }
        }

        return true;
    }

    public static OperatingSystem getCurrentOperatingSystem() {
        String osName = System.getProperty("os.name", "").toLowerCase(java.util.Locale.ROOT);
        if (osName.contains("win")) {
            return OperatingSystem.WINDOWS;
        }
        if (osName.contains("mac") || osName.contains("darwin") || osName.contains("osx") || osName.contains("os x")) {
            return OperatingSystem.OSX;
        }
        if (osName.contains("linux") || osName.contains("nix") || osName.contains("nux") || osName.contains("aix") || osName.contains("android") || osName.contains("sunos") || osName.contains("solaris")) {
            return OperatingSystem.LINUX;
        }
        return OperatingSystem.LINUX;
    }

}
