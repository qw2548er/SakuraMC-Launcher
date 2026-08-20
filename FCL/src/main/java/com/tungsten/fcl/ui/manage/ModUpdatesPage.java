package com.tungsten.fcl.ui.manage;

import static com.tungsten.fclcore.util.Pair.pair;

import android.content.Context;
import android.content.res.ColorStateList;
import android.os.Environment;
import android.view.View;
import android.widget.ListView;
import android.widget.Toast;

import com.tungsten.fcl.R;
import com.tungsten.fcl.setting.Profile;
import com.tungsten.fcl.setting.Profiles;
import com.tungsten.fcl.ui.TaskDialog;
import com.tungsten.fcl.util.TaskCancellationAction;
import com.tungsten.fclcore.download.LibraryAnalyzer;
import com.tungsten.fclcore.fakefx.beans.property.BooleanProperty;
import com.tungsten.fclcore.fakefx.beans.property.SimpleBooleanProperty;
import com.tungsten.fclcore.fakefx.beans.property.SimpleStringProperty;
import com.tungsten.fclcore.fakefx.beans.property.StringProperty;
import com.tungsten.fclcore.fakefx.collections.FXCollections;
import com.tungsten.fclcore.fakefx.collections.ObservableList;
import com.tungsten.fclcore.mod.LocalModFile;
import com.tungsten.fclcore.mod.ModLoaderType;
import com.tungsten.fclcore.mod.ModManager;
import com.tungsten.fclcore.mod.RemoteMod;
import com.tungsten.fclcore.mod.RemoteModRepository;
import com.tungsten.fclcore.task.FileDownloadTask;
import com.tungsten.fclcore.task.Schedulers;
import com.tungsten.fclcore.task.Task;
import com.tungsten.fclcore.task.TaskExecutor;
import com.tungsten.fclcore.util.DigestUtils;
import com.tungsten.fclcore.util.Logging;
import com.tungsten.fclcore.util.Pair;
import com.tungsten.fclcore.util.StringUtils;
import com.tungsten.fclcore.util.io.CSVTable;
import com.tungsten.fclcore.util.io.NetworkUtils;
import com.tungsten.fcllibrary.component.dialog.FCLAlertDialog;
import com.tungsten.fcllibrary.component.theme.ThemeEngine;
import com.tungsten.fcllibrary.component.ui.FCLTempPage;
import com.tungsten.fcllibrary.component.view.FCLButton;
import com.tungsten.fcllibrary.component.view.FCLUILayout;

import java.io.File;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.logging.Level;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class ModUpdatesPage extends FCLTempPage implements View.OnClickListener {

    private final ModListPage modListPage;
    private final ModManager modManager;
    private final ObservableList<ModUpdateObject> objects;

    private ListView listView;
    private FCLButton export;
    private FCLButton update;
    private FCLButton updateWithout;
    private FCLButton cancel;

    public ModUpdatesPage(Context context, int id, FCLUILayout parent, int resId, ModListPage modListPage, ModManager modManager, List<LocalModFile.ModUpdate> list) {
        super(context, id, parent, resId);
        this.modListPage = modListPage;
        this.modManager = modManager;
        this.objects = FXCollections.observableList(list.stream().map(it -> new ModUpdateObject(getContext(), it)).collect(Collectors.toList()));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        listView = findViewById(R.id.list);
        ThemeEngine.getInstance().registerEvent(listView, () -> listView.setBackgroundTintList(new ColorStateList(new int[][]{{}}, new int[]{ThemeEngine.getInstance().getTheme().getLtColor()})));
        export = findViewById(R.id.export);
        update = findViewById(R.id.update);
        updateWithout = findViewById(R.id.update_without);
        cancel = findViewById(R.id.cancel);
        export.setOnClickListener(this);
        update.setOnClickListener(this);
        updateWithout.setOnClickListener(this);
        cancel.setOnClickListener(this);
        updateWithout.setSelected(true);
    }

    @Override
    public void onStart() {
        super.onStart();
        listView.setAdapter(new ModUpdateListAdapter(getContext(), objects));
    }

    @Override
    public Task<?> refresh(Object... param) {
        return null;
    }

    @Override
    public void onRestart() {

    }

    @Override
    public void onClick(View v) {
        if (v == export) {
            exportList();
        }
        if (v == update) {
            updateMods(true);
        }
        if (v == updateWithout) {
            updateMods(false);
        }
        if (v == cancel) {
            ManagePageManager.getInstance().dismissCurrentTempPage();
        }
    }

    private void updateMods(boolean keepOldVersion) {
        ModUpdateTask task = new ModUpdateTask(
                modManager,
                objects.stream()
                        .filter(o -> o.enabled.get())
                        .map(object -> pair(object.data.getLocalMod(), object.data.getCandidates().get(0)))
                        .collect(Collectors.toList()), keepOldVersion);
        TaskDialog taskDialog = new TaskDialog(getContext(), TaskCancellationAction.NORMAL);
        taskDialog.setTitle(getContext().getString(R.string.mods_check_updates_update));
        TaskExecutor executor = task.whenComplete(Schedulers.androidUIThread(), exception -> {
            ManagePageManager.getInstance().dismissCurrentTempPage();
            modListPage.refresh();
            boolean hasExtraDeps = !task.getExtraDepsInstalled().isEmpty();
            if (!task.getFailedMods().isEmpty()) {
                FCLAlertDialog.Builder builder = new FCLAlertDialog.Builder(getContext());
                builder.setAlertLevel(FCLAlertDialog.AlertLevel.ALERT);
                builder.setCancelable(false);
                builder.setTitle(getContext().getString(R.string.install_failed));
                StringBuilder msg = new StringBuilder();
                msg.append(getContext().getString(R.string.mods_check_updates_failed))
                        .append("\n")
                        .append(task.getFailedMods().stream().map(LocalModFile::getFileName).collect(Collectors.joining("\n")));
                if (hasExtraDeps) {
                    msg.append("\n\n")
                            .append(getContext().getString(R.string.mods_check_updates_extra_deps_ok))
                            .append("\n")
                            .append(String.join("\n", task.getExtraDepsInstalled()));
                }
                builder.setMessage(msg.toString());
                builder.setNegativeButton(getContext().getString(com.tungsten.fcllibrary.R.string.dialog_positive), null);
                builder.create().show();
            } else if (exception == null) {
                FCLAlertDialog.Builder builder = new FCLAlertDialog.Builder(getContext());
                builder.setAlertLevel(FCLAlertDialog.AlertLevel.INFO);
                builder.setCancelable(false);
                if (hasExtraDeps) {
                    StringBuilder msg = new StringBuilder();
                    msg.append(getContext().getString(R.string.install_success))
                            .append("\n\n")
                            .append(getContext().getString(R.string.mods_check_updates_extra_deps_ok))
                            .append("\n")
                            .append(String.join("\n", task.getExtraDepsInstalled()));
                    builder.setMessage(msg.toString());
                } else {
                    builder.setMessage(getContext().getString(R.string.install_success));
                }
                builder.setNegativeButton(getContext().getString(com.tungsten.fcllibrary.R.string.dialog_positive), null);
                builder.create().show();
            }
        }).executor();
        taskDialog.setExecutor(executor);
        taskDialog.show();
        executor.start();
    }

    private void exportList() {
        Path path = new File(Environment.getExternalStorageDirectory().getAbsolutePath() + "/FCL", "fcl-mod-update-list-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH-mm-ss")) + ".csv").toPath();

        TaskDialog taskDialog = new TaskDialog(getContext(), TaskCancellationAction.NORMAL);
        taskDialog.setTitle(getContext().getString(R.string.button_export));
        TaskExecutor executor = Task.runAsync(() -> {
            CSVTable csvTable = CSVTable.createEmpty();

            csvTable.set(0, 0, "Source File Name");
            csvTable.set(1, 0, "Current Version");
            csvTable.set(2, 0, "Target Version");
            csvTable.set(3, 0, "Update Source");

            for (int i = 0; i < objects.size(); i++) {
                csvTable.set(0, i + 1, objects.get(i).fileName.get());
                csvTable.set(1, i + 1, objects.get(i).currentVersion.get());
                csvTable.set(2, i + 1, objects.get(i).targetVersion.get());
                csvTable.set(3, i + 1, objects.get(i).source.get());
            }

            csvTable.write(Files.newOutputStream(path));
        }).whenComplete(Schedulers.androidUIThread(), exception -> {
            FCLAlertDialog.Builder builder = new FCLAlertDialog.Builder(getContext());
            if (exception == null) {
                builder.setAlertLevel(FCLAlertDialog.AlertLevel.INFO);
                builder.setCancelable(false);
                builder.setTitle(getContext().getString(R.string.message_success));
                builder.setMessage(path.toString());
            } else {
                builder.setAlertLevel(FCLAlertDialog.AlertLevel.ALERT);
                builder.setCancelable(false);
                builder.setTitle(getContext().getString(R.string.message_error));
                builder.setMessage(exception.getMessage());
            }
            builder.setNegativeButton(getContext().getString(com.tungsten.fcllibrary.R.string.dialog_positive), null);
            builder.create().show();
        }).executor();
        taskDialog.setExecutor(executor);
        taskDialog.show();
        executor.start();
    }

    public static final class ModUpdateObject {
        final LocalModFile.ModUpdate data;
        final BooleanProperty enabled = new SimpleBooleanProperty();
        final StringProperty fileName = new SimpleStringProperty();
        final StringProperty currentVersion = new SimpleStringProperty();
        final StringProperty targetVersion = new SimpleStringProperty();
        final StringProperty source = new SimpleStringProperty();

        public ModUpdateObject(Context context, LocalModFile.ModUpdate data) {
            this.data = data;

            enabled.set(!data.getLocalMod().getModManager().isDisabled(data.getLocalMod().getFile()));
            fileName.set(data.getLocalMod().getFileName());
            currentVersion.set(data.getCurrentVersion().getVersion());
            targetVersion.set(data.getCandidates().get(0).getVersion());
            switch (data.getCurrentVersion().getSelf().getType()) {
                case CURSEFORGE:
                    source.set(context.getString(com.tungsten.fcl.R.string.mods_curseforge));
                    break;
                case MODRINTH:
                    source.set(context.getString(com.tungsten.fcl.R.string.mods_modrinth));
            }
        }

        public boolean isEnabled() {
            return enabled.get();
        }

        public BooleanProperty enabledProperty() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled.set(enabled);
        }

        public String getFileName() {
            return fileName.get();
        }

        public StringProperty fileNameProperty() {
            return fileName;
        }

        public void setFileName(String fileName) {
            this.fileName.set(fileName);
        }

        public String getCurrentVersion() {
            return currentVersion.get();
        }

        public StringProperty currentVersionProperty() {
            return currentVersion;
        }

        public void setCurrentVersion(String currentVersion) {
            this.currentVersion.set(currentVersion);
        }

        public String getTargetVersion() {
            return targetVersion.get();
        }

        public StringProperty targetVersionProperty() {
            return targetVersion;
        }

        public void setTargetVersion(String targetVersion) {
            this.targetVersion.set(targetVersion);
        }

        public String getSource() {
            return source.get();
        }

        public StringProperty sourceProperty() {
            return source;
        }

        public void setSource(String source) {
            this.source.set(source);
        }
    }

    public static class ModUpdateTask extends Task<Void> {
        private final Collection<Task<?>> dependents;
        private final List<LocalModFile> failedMods = new ArrayList<>();
        private final List<String> extraDepsInstalled = new ArrayList<>();

        ModUpdateTask(ModManager modManager, List<Pair<LocalModFile, RemoteMod.Version>> mods, boolean keepOldVersion) {
            setStage("mods.check_updates.update");

            Profile profile = Profiles.getSelectedProfile();
            String selectedVersion = profile.getSelectedVersion();
            String currentGameVersion = "";
            Set<ModLoaderType> currentLoaders = Collections.emptySet();
            if (profile.getRepository().hasVersion(selectedVersion)) {
                LibraryAnalyzer analyzer = LibraryAnalyzer.analyze(
                        profile.getRepository().getResolvedPreservingPatchesVersion(selectedVersion),
                        selectedVersion);
                currentLoaders = analyzer.getModLoaders();
                currentGameVersion = analyzer.getVersion(LibraryAnalyzer.LibraryType.MINECRAFT).orElse("");
            }
            final String gameVersionFinal = currentGameVersion;
            final Set<ModLoaderType> loadersFinal = currentLoaders;

            Path runDirectory = profile.getRepository().hasVersion(selectedVersion)
                    ? profile.getRepository().getRunDirectory(selectedVersion).toPath()
                    : profile.getRepository().getBaseDirectory().toPath();
            Path modsDir = runDirectory.resolve("mods");

            // Collect all FileDownloadTasks with de-duplication keyed by (modId:version) or dest path
            List<PlannedDownload> plan = new ArrayList<>();
            Set<String> plannedKeys = new HashSet<>();
            Set<Path> plannedDests = new HashSet<>();

            // First, add the updated mods themselves
            List<RemoteMod.Version> versionsToUpdate = new ArrayList<>();
            for (Pair<LocalModFile, RemoteMod.Version> mod : mods) {
                RemoteMod.Version remote = mod.getValue();
                versionsToUpdate.add(remote);
                try {
                    String fileName = remote.getFile().getFilename();
                    Path dest = modsDir.resolve(fileName);
                    String key = (remote.getModid() == null ? "" : remote.getModid()) + ":" + (remote.getVersion() == null ? "" : remote.getVersion());
                    if (!plannedKeys.contains(key) && !plannedDests.contains(dest)) {
                        boolean localHit = isLocalFileValid(dest, remote.getFile().getIntegrityCheck());
                        FileDownloadTask task = null;
                        if (!localHit) {
                            task = new FileDownloadTask(
                                    NetworkUtils.toURL(remote.getFile().getUrl()),
                                    dest.toFile(),
                                    remote.getFile().getIntegrityCheck());
                            task.setName(remote.getName());
                        }
                        long size = 0L; // RemoteMod.File does not expose size
                        plan.add(new PlannedDownload(key, remote.getName(), size, localHit, remote.getModid(), dest, task));
                        plannedKeys.add(key);
                        plannedDests.add(dest);
                    }
                } catch (Throwable t) {
                    Logging.LOG.log(Level.WARNING, "规划更新模组失败: " + remote.getName(), t);
                }
            }

            // Second, for each updated version, walk its REQUIRED/TOOL dependencies recursively and add missing ones
            Set<String> depVisited = new HashSet<>(plannedKeys);
            for (RemoteMod.Version v : versionsToUpdate) {
                try {
                    List<RemoteMod.Dependency> deps = v.getDependencies();
                    if (deps != null && !deps.isEmpty()) {
                        for (RemoteMod.Dependency d : deps) {
                            resolveDependencyRecursively(d, gameVersionFinal, loadersFinal, modsDir, depVisited, plan, plannedDests, 0);
                        }
                    }
                } catch (Throwable t) {
                    Logging.LOG.log(Level.WARNING, "收集更新模组的依赖失败: " + v.getName(), t);
                }
            }

            getProperties().put("total", plan.size());

            this.dependents = new ArrayList<>();
            // Build dependent tasks in the order of original mods list first
            for (int i = 0; i < mods.size(); i++) {
                final Pair<LocalModFile, RemoteMod.Version> mod = mods.get(i);
                final LocalModFile local = mod.getKey();
                final RemoteMod.Version remote = mod.getValue();
                final int idx = i;
                boolean isDisabled = local.getModManager().isDisabled(local.getFile());
                final String finalFileName = isDisabled
                        ? remote.getFile().getFilename() + ModManager.DISABLED_EXTENSION
                        : remote.getFile().getFilename();
                final Path finalDest = modsDir.resolve(finalFileName);
                final boolean alreadyLocal = isLocalFileValid(finalDest, remote.getFile().getIntegrityCheck());
                final boolean finalIsDisabled = isDisabled;

                dependents.add(Task
                        .runAsync(Schedulers.androidUIThread(), () -> local.setOld(true))
                        .thenComposeAsync(() -> {
                            if (alreadyLocal) return Task.completed(null);
                            FileDownloadTask dl = new FileDownloadTask(
                                    NetworkUtils.toURL(remote.getFile().getUrl()),
                                    finalDest.toFile(),
                                    remote.getFile().getIntegrityCheck());
                            dl.setName(remote.getName());
                            return dl;
                        })
                        .whenComplete(Schedulers.androidUIThread(), exception -> {
                            if (exception != null) {
                                // restore state if failed
                                local.setOld(false);
                                if (finalIsDisabled)
                                    local.disable();
                                failedMods.add(local);
                            } else {
                                // Keep disabled state consistent: if the old mod was disabled, also disable the newly downloaded file
                                if (finalIsDisabled) {
                                    try {
                                        // Try to re-apply disabled state by using ModManager#disable
                                        // (File already ends with .disabled, so this is usually a no-op re-assert)
                                    } catch (Throwable ignored) {
                                    }
                                }
                                if (!keepOldVersion) {
                                    local.getFile().toFile().delete();
                                }
                            }
                        })
                        .withCounter("mods.check_updates.update"));
            }

            // Add dependency download tasks (extra dependencies, not the main mods)
            for (PlannedDownload p : plan) {
                if (p.localHit || p.task == null) continue;
                // Skip if already covered by an updated mod (detect by checking original versions list)
                boolean alreadyCovered = false;
                for (RemoteMod.Version v : versionsToUpdate) {
                    if (p.dest != null && v.getFile() != null
                            && p.dest.getFileName() != null
                            && p.dest.getFileName().toString().equals(v.getFile().getFilename())) {
                        alreadyCovered = true;
                        break;
                    }
                }
                if (alreadyCovered) continue;
                final PlannedDownload pp = p;
                dependents.add(Task.runAsync(() -> {
                    // placeholder: nothing before download
                }).thenComposeAsync(() -> pp.task).whenComplete(Schedulers.androidUIThread(), (res, ex) -> {
                    if (ex == null) {
                        extraDepsInstalled.add(pp.displayName);
                    } else {
                        Logging.LOG.log(Level.WARNING, "下载依赖失败: " + pp.displayName, ex);
                    }
                }).withCounter("mods.check_updates.update"));
            }
        }

        private void resolveDependencyRecursively(RemoteMod.Dependency dependency,
                                                  String currentGameVersion,
                                                  Set<ModLoaderType> currentLoaders,
                                                  Path modsDir,
                                                  Set<String> visited,
                                                  List<PlannedDownload> plan,
                                                  Set<Path> plannedDests,
                                                  int depth) {
            String dependencyId = dependency.getId();
            if (visited.contains(dependencyId)) return;
            visited.add(dependencyId);
            if (dependency.getType() != RemoteMod.DependencyType.REQUIRED
                    && dependency.getType() != RemoteMod.DependencyType.TOOL) {
                return;
            }
            if (depth > 4) return; // safety: avoid extremely deep chains
            try {
                RemoteMod mod = dependency.load();
                Optional<RemoteMod.Version> best = selectBestDependencyVersion(
                        mod, currentGameVersion, currentLoaders, dependency.getRemoteModRepository());
                if (best.isEmpty()) return;
                RemoteMod.Version v = best.get();
                Path dest = modsDir.resolve(v.getFile().getFilename());
                String key = (mod.getModid() == null ? dependencyId : mod.getModid()) + ":" + (v.getVersion() == null ? "" : v.getVersion());
                if (plannedDests.contains(dest)) return;
                boolean localHit = isLocalFileValid(dest, v.getFile().getIntegrityCheck());
                FileDownloadTask task = null;
                if (!localHit) {
                    task = new FileDownloadTask(NetworkUtils.toURL(v.getFile().getUrl()), dest.toFile(), v.getFile().getIntegrityCheck());
                    task.setName(v.getName());
                }
                long size = 0L; // RemoteMod.File does not expose size
                plan.add(new PlannedDownload(key, v.getName(), size, localHit, mod.getModid(), dest, task));
                plannedDests.add(dest);
                // Recurse into nested dependencies
                List<RemoteMod.Dependency> nested = v.getDependencies();
                if (nested != null && !nested.isEmpty()) {
                    for (RemoteMod.Dependency child : nested) {
                        resolveDependencyRecursively(child, currentGameVersion, currentLoaders, modsDir, visited, plan, plannedDests, depth + 1);
                    }
                }
            } catch (Throwable t) {
                Logging.LOG.log(Level.WARNING, "规划依赖失败 (批量更新): " + dependencyId, t);
            }
        }

        private Optional<RemoteMod.Version> selectBestDependencyVersion(
                RemoteMod mod, String currentGameVersion, Set<ModLoaderType> currentLoaders,
                RemoteModRepository repository) throws Exception {
            try (Stream<RemoteMod.Version> stream = mod.getData().loadVersions(repository)) {
                List<RemoteMod.Version> versions = stream.collect(Collectors.toList());
                // Strict match: game version intersection
                List<RemoteMod.Version> gameMatched = versions;
                if (!StringUtils.isBlank(currentGameVersion)) {
                    gameMatched = versions.stream()
                            .filter(v -> v.getGameVersions() != null && v.getGameVersions().contains(currentGameVersion))
                            .collect(Collectors.toList());
                }
                if (!gameMatched.isEmpty()) {
                    versions = gameMatched;
                }
                // Loader match if we have current loaders
                if (currentLoaders != null && !currentLoaders.isEmpty()) {
                    List<RemoteMod.Version> loaderMatched = versions.stream()
                            .filter(v -> {
                                if (v.getLoaders() == null || v.getLoaders().isEmpty()) return true;
                                for (ModLoaderType l : v.getLoaders()) {
                                    if (currentLoaders.contains(l)) return true;
                                }
                                return false;
                            })
                            .collect(Collectors.toList());
                    if (!loaderMatched.isEmpty()) {
                        versions = loaderMatched;
                    }
                }
                return versions.stream().max(Comparator.comparing(RemoteMod.Version::getDatePublished));
            }
        }

        private static boolean isLocalFileValid(Path dest, FileDownloadTask.IntegrityCheck integrityCheck) {
            try {
                if (dest == null || !Files.exists(dest)) return false;
                if (integrityCheck == null) return false;
                String localHash = DigestUtils.digestToString(integrityCheck.getAlgorithm(), dest);
                return integrityCheck.getChecksum().equalsIgnoreCase(localHash);
            } catch (Throwable t) {
                return false;
            }
        }

        public List<LocalModFile> getFailedMods() {
            return failedMods;
        }

        public List<String> getExtraDepsInstalled() {
            return extraDepsInstalled;
        }

        private static class PlannedDownload {
            final String key;
            final String displayName;
            final long sizeBytes;
            final boolean localHit;
            final String modId;
            final Path dest;
            final FileDownloadTask task;

            PlannedDownload(String key, String displayName, long sizeBytes, boolean localHit,
                            String modId, Path dest, FileDownloadTask task) {
                this.key = key;
                this.displayName = displayName;
                this.sizeBytes = sizeBytes;
                this.localHit = localHit;
                this.modId = modId;
                this.dest = dest;
                this.task = task;
            }
        }

        @Override
        public Collection<Task<?>> getDependents() {
            return dependents;
        }

        @Override
        public boolean doPreExecute() {
            return true;
        }

        @Override
        public void preExecute() {
            notifyPropertiesChanged();
        }

        @Override
        public boolean isRelyingOnDependents() {
            return false;
        }

        @Override
        public void execute() throws Exception {
            if (!isDependentsSucceeded())
                throw getException();
        }
    }
}
