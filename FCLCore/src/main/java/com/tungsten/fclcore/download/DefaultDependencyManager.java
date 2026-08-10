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
package com.tungsten.fclcore.download;

import com.tungsten.fclcore.download.cleanroom.CleanroomInstallTask;
import com.tungsten.fclcore.download.forge.ForgeInstallTask;
import com.tungsten.fclcore.download.game.GameAssetDownloadTask;
import com.tungsten.fclcore.download.game.GameDownloadTask;
import com.tungsten.fclcore.download.game.GameLibrariesTask;
import com.tungsten.fclcore.download.game.LibraryClassifier;
import com.tungsten.fclcore.download.game.LibrarySelectionStore;
import com.tungsten.fclcore.download.neoforge.NeoForgeInstallTask;
import com.tungsten.fclcore.download.optifine.OptiFineInstallTask;
import com.tungsten.fclcore.game.Artifact;
import com.tungsten.fclcore.game.DefaultGameRepository;
import com.tungsten.fclcore.game.Library;
import com.tungsten.fclcore.game.Version;
import com.tungsten.fclcore.task.Task;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Note: This class has no state.
 */
public class DefaultDependencyManager extends AbstractDependencyManager {

    private final DefaultGameRepository repository;
    private final DownloadProvider downloadProvider;
    private final DefaultCacheRepository cacheRepository;

    public DefaultDependencyManager(DefaultGameRepository repository, DownloadProvider downloadProvider, DefaultCacheRepository cacheRepository) {
        this.repository = repository;
        this.downloadProvider = downloadProvider;
        this.cacheRepository = cacheRepository;
    }

    @Override
    public DefaultGameRepository getGameRepository() {
        return repository;
    }

    @Override
    public DownloadProvider getDownloadProvider() {
        return downloadProvider;
    }

    @Override
    public DefaultCacheRepository getCacheRepository() {
        return cacheRepository;
    }

    @Override
    public GameBuilder gameBuilder() {
        return new DefaultGameBuilder(this);
    }

    @Override
    public Task<?> checkGameCompletionAsync(Version version, boolean integrityCheck) {
        return checkGameCompletionAsync(version, integrityCheck, null);
    }

    /**
     * 完整启动前校验（版本 Jar + Patch + Asset + Libraries），
     * 其中 libraries 部分允许传入用户选择后的 subset 来做「可选依赖下载」。
     *
     * @param librarySubset 若为 {@code null} 则等价于原方法（下载全部适用的库）
     */
    public Task<?> checkGameCompletionAsync(Version version, boolean integrityCheck, List<Library> librarySubset) {
        Task<?> librariesTask = librarySubset == null
                ? new GameLibrariesTask(this, version, integrityCheck)
                : new GameLibrariesTask(this, version, integrityCheck, librarySubset);
        return Task.allOf(
                Task.composeAsync(() -> {
                    File versionJar = repository.getVersionJar(version);
                    if (!versionJar.exists() || versionJar.length() == 0)
                        return new GameDownloadTask(this, null, version);
                    else
                        return null;
                }).thenComposeAsync(checkPatchCompletionAsync(version, integrityCheck)),
                new GameAssetDownloadTask(this, version, GameAssetDownloadTask.DOWNLOAD_INDEX_IF_NECESSARY, integrityCheck),
                librariesTask
        );
    }

    @Override
    public Task<?> checkLibraryCompletionAsync(Version version, boolean integrityCheck) {
        return new GameLibrariesTask(this, version, integrityCheck, version.getLibraries());
    }

    /**
     * 与 {@link #checkLibraryCompletionAsync} 等价，但允许外部先读取完整 libraries 列表、
     * 通过 UI 让用户勾选哪些要下，再传入「用户选择后的 subset」执行实际下载。
     *
     * @param selectedSubset 经过过滤后的 libraries 子集；若传入 {@code null} 则与原方法完全等价
     */
    public Task<?> checkLibraryCompletionAsync(Version version, boolean integrityCheck, List<Library> selectedSubset) {
        if (selectedSubset == null) {
            return checkLibraryCompletionAsync(version, integrityCheck);
        }
        return new GameLibrariesTask(this, version, integrityCheck, selectedSubset);
    }

    /** 对某版本的 libraries 做分类（不执行任何下载）。返回值直接供 UI 使用。 */
    public LibraryClassifier.Classification classifyLibraries(Version version, boolean integrityCheck) {
        List<Library> all = filterForEnvironment(version.getLibraries());
        return LibraryClassifier.classify(all, library -> !GameLibrariesTask.shouldDownloadLibrary(repository, version, library, integrityCheck));
    }

    /** 按平台 rules 做一次预过滤，只保留当前系统适用的库。 */
    public List<Library> filterForEnvironment(List<Library> libraries) {
        List<Library> out = new ArrayList<>(libraries.size());
        for (Library lib : libraries) {
            if (lib.appliesToCurrentEnvironment()) {
                out.add(lib);
            }
        }
        return out;
    }

    /** 选择持久化存储（每版本记住用户勾选）。 */
    public LibrarySelectionStore librarySelectionStore() {
        Path base = repository.getBaseDirectory().toPath();
        return new LibrarySelectionStore(base);
    }

    /** 仅用于 checkGameCompletionAsync：把 MUST + 用户上次勾选合并成最终下载子集。 */
    public List<Library> applyUserSelection(Version version, boolean integrityCheck, Set<String> selectedKeys) {
        LibraryClassifier.Classification cls = classifyLibraries(version, integrityCheck);
        return cls.filterForDownload(selectedKeys == null ? cls.defaultSelection() : selectedKeys);
    }

    @Override
    public Task<?> checkPatchCompletionAsync(Version version, boolean integrityCheck) {
        return Task.composeAsync(() -> {
            List<Task<?>> tasks = new ArrayList<>(0);

            String gameVersion = repository.getGameVersion(version).orElse(null);
            if (gameVersion == null) return null;

            Version original = repository.getVersion(version.getId());
            Version resolved = original.resolvePreservingPatches(repository);

            LibraryAnalyzer analyzer = LibraryAnalyzer.analyze(resolved, gameVersion);
            for (LibraryAnalyzer.LibraryType type : LibraryAnalyzer.LibraryType.values()) {
                if (!analyzer.has(type))
                    continue;

                if (type == LibraryAnalyzer.LibraryType.OPTIFINE) {
                    String optifinePatchVersion = analyzer.getVersion(type)
                            .map(optifineVersion -> {
                                Matcher matcher = Pattern.compile("^([0-9.]+)_(?<optifine>HD_.+)$").matcher(optifineVersion);
                                return matcher.find() ? matcher.group("optifine") : optifineVersion;
                            })
                            .orElseGet(() -> resolved.getPatches().stream()
                                    .filter(patch -> "optifine".equals(patch.getId()))
                                    .findAny()
                                    .map(Version::getVersion)
                                    .orElse(null));

                    boolean needsReInstallation = version.getLibraries().stream()
                            .anyMatch(library -> !library.hasDownloadURL()
                                    && "optifine".equals(library.getGroupId())
                                    && GameLibrariesTask.shouldDownloadLibrary(repository, version, library, integrityCheck));

                    if (needsReInstallation) {
                        Library installer = new Library(new Artifact("optifine", "OptiFine", gameVersion + "_" + optifinePatchVersion, "installer"));
                        if (GameLibrariesTask.shouldDownloadLibrary(repository, version, installer, integrityCheck)) {
                            tasks.add(installLibraryAsync(gameVersion, original, "optifine", optifinePatchVersion));
                        } else {
                            tasks.add(OptiFineInstallTask.install(this, original, repository.getLibraryFile(version, installer).toPath()));
                        }
                    }
                }
            }

            return Task.allOf(tasks);
        });
    }

    @Override
    public Task<Version> installLibraryAsync(String gameVersion, Version baseVersion, String libraryId, String libraryVersion) {
        if (baseVersion.isResolved()) throw new IllegalArgumentException("Version should not be resolved");

        VersionList<?> versionList = getVersionList(libraryId);
        return Task.fromCompletableFuture(versionList.loadAsync(gameVersion))
                .thenComposeAsync(() -> installLibraryAsync(baseVersion, versionList.getVersion(gameVersion, libraryVersion)
                        .orElseThrow(() -> new IOException("Remote library " + libraryId + " has no version " + libraryVersion))))
                .withStage(String.format("fcl.install.%s:%s", libraryId, libraryVersion));
    }

    @Override
    public Task<Version> installLibraryAsync(Version baseVersion, RemoteVersion libraryVersion) {
        if (baseVersion.isResolved()) throw new IllegalArgumentException("Version should not be resolved");

        AtomicReference<Version> removedLibraryVersion = new AtomicReference<>();

        return removeLibraryAsync(baseVersion.resolvePreservingPatches(repository), libraryVersion.getLibraryId())
                .thenComposeAsync(version -> {
                    removedLibraryVersion.set(version);
                    return libraryVersion.getInstallTask(this, version);
                })
                .thenApplyAsync(patch -> {
                    if (patch == null) {
                        return removedLibraryVersion.get();
                    } else {
                        return removedLibraryVersion.get().addPatch(patch);
                    }
                })
                .withStage(String.format("fcl.install.%s:%s", libraryVersion.getLibraryId(), libraryVersion.getSelfVersion()));
    }

    public Task<Version> installLibraryAsync(Version oldVersion, Path installer) {
        if (oldVersion.isResolved()) throw new IllegalArgumentException("Version should not be resolved");

        return Task
                .composeAsync(() -> {
                    try {
                        return CleanroomInstallTask.install(this, oldVersion, installer);
                    } catch (IOException ignore) {
                    }

                    try {
                        return NeoForgeInstallTask.install(this, oldVersion, installer);
                    } catch (IOException ignore) {
                    }

                    try {
                        return ForgeInstallTask.install(this, oldVersion, installer);
                    } catch (IOException ignore) {
                    }

                    try {
                        return OptiFineInstallTask.install(this, oldVersion, installer);
                    } catch (IOException ignore) {
                    }

                    throw new UnsupportedLibraryInstallerException();
                })
                .thenApplyAsync(oldVersion::addPatch);
    }

    public static class UnsupportedLibraryInstallerException extends Exception {
    }

    /**
     * Remove installed library.
     * Will try to remove libraries and patches.
     *
     * @param version not resolved version
     * @param libraryId forge/liteloader/optifine/fabric
     * @return task to remove the specified library
     */
    public Task<Version> removeLibraryAsync(Version version, String libraryId) {
        // MaintainTask requires version that does not inherits from any version.
        // If we want to remove a library in dependent version, we should keep the dependents not changed
        // So resolving this game version to preserve all information in this version.json is necessary.
        if (version.isResolved())
            throw new IllegalArgumentException("removeLibraryWithoutSavingAsync requires non-resolved version");
        Version independentVersion = version.resolvePreservingPatches(repository);
        String gameVersion = repository.getGameVersion(independentVersion).orElse(null);

        return Task.supplyAsync(() -> LibraryAnalyzer.analyze(independentVersion, gameVersion).removeLibrary(libraryId).build());
    }

}
