package com.tungsten.fcl.ui.download.common;

import android.animation.AnimatorInflater;
import android.annotation.SuppressLint;
import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatDialog;

import com.mio.util.AnimUtil;
import com.tungsten.fcl.R;
import com.tungsten.fcl.setting.Profile;
import com.tungsten.fcl.setting.Profiles;
import com.tungsten.fcl.ui.TaskDialog;
import com.tungsten.fcl.ui.manage.ManagePageManager;
import com.tungsten.fcl.util.TaskCancellationAction;
import com.tungsten.fclcore.download.LibraryAnalyzer;
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
import com.tungsten.fclcore.util.StringUtils;
import com.tungsten.fclcore.util.io.NetworkUtils;
import com.tungsten.fcllibrary.component.FCLAdapter;
import com.tungsten.fcllibrary.component.dialog.FCLAlertDialog;
import com.tungsten.fcllibrary.component.theme.ThemeEngine;
import com.tungsten.fcllibrary.component.view.FCLButton;
import com.tungsten.fcllibrary.component.view.FCLLinearLayout;
import com.tungsten.fcllibrary.component.view.FCLTextView;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class ModVersionAdapter extends FCLAdapter {

    private final List<RemoteMod.Version> list;
    private final Callback callback;

    public ModVersionAdapter(Context context, List<RemoteMod.Version> list, Callback callback) {
        super(context);
        this.list = list;
        this.callback = callback;
    }

    private static class ViewHolder {
        FCLLinearLayout parent;
        FCLTextView name;
        FCLTextView tag;
        FCLTextView date;
        FCLButton downloadDependencies;
    }

    @Override
    public int getCount() {
        return list.size();
    }

    @Override
    public Object getItem(int i) {
        return list.get(i);
    }

    @Override
    public View getView(int i, View view, ViewGroup viewGroup) {
        final ViewHolder viewHolder;
        if (view == null) {
            viewHolder = new ViewHolder();
            view = LayoutInflater.from(getContext()).inflate(R.layout.item_mod_version, null);
            viewHolder.parent = view.findViewById(R.id.parent);
            viewHolder.name = view.findViewById(R.id.name);
            viewHolder.tag = view.findViewById(R.id.tag);
            viewHolder.date = view.findViewById(R.id.date);
            viewHolder.downloadDependencies = view.findViewById(R.id.download_dependencies);
            viewHolder.parent.setStateListAnimator(AnimatorInflater.loadStateListAnimator(getContext(), com.tungsten.fcllibrary.R.xml.anim_scale));
            view.setTag(viewHolder);
        } else {
            viewHolder = (ViewHolder) view.getTag();
        }
        RemoteMod.Version version = list.get(i);
        viewHolder.parent.setOnClickListener(v -> callback.onItemSelect(version));
        viewHolder.name.setText(version.getName());
        viewHolder.tag.setText(getTag(getContext(), version));
        viewHolder.date.setText(FORMATTER.format(version.getDatePublished()));
        AnimUtil.playTranslationX(view, ThemeEngine.getInstance().getTheme().getAnimationSpeed() * 30L, -100f, 0f).start();

        setupDependencyButton(viewHolder, version);

        return view;
    }

    private void setupDependencyButton(ViewHolder viewHolder, RemoteMod.Version version) {
        // Always enable the one-click button now — it downloads the mod itself even if there are 0 deps.
        viewHolder.downloadDependencies.setVisibility(View.VISIBLE);
        viewHolder.downloadDependencies.setEnabled(true);
        viewHolder.downloadDependencies.setText(getContext().getString(R.string.button_one_click_download_deps));
        viewHolder.downloadDependencies.setOnClickListener(v -> startOneClickDownloadFlow(version));
    }

    private void startOneClickDownloadFlow(RemoteMod.Version version) {
        // P2-9 Step 1: Validate the current version matches game-version + mod-loader.
        checkCurrentVersionCompatibility(version, () -> runPlanAndConfirm(version));
    }

    private void checkCurrentVersionCompatibility(RemoteMod.Version version, Runnable onContinue) {
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
        boolean gameVersionOk = StringUtils.isBlank(currentGameVersion)
                || (version.getGameVersions() != null && version.getGameVersions().contains(currentGameVersion));
        boolean loaderOk = currentLoaders.isEmpty() || (version.getLoaders() != null && version.getLoaders().stream()
                .anyMatch(currentLoaders::contains));
        if (gameVersionOk && loaderOk) {
            onContinue.run();
            return;
        }
        String declaredGame = version.getGameVersions() == null ? "[]" : version.getGameVersions().toString();
        String declaredLoaders = version.getLoaders() == null ? "[]" : version.getLoaders().toString();
        String currentGame = StringUtils.isBlank(currentGameVersion) ? "(unknown)" : currentGameVersion;
        String currentLoader = currentLoaders.isEmpty() ? "(unknown)" : currentLoaders.toString();
        new FCLAlertDialog.Builder(getContext())
                .setAlertLevel(FCLAlertDialog.AlertLevel.ALERT)
                .setTitle(getContext().getString(R.string.mods_one_click_loader_mismatch_title))
                .setMessage(getContext().getString(R.string.mods_one_click_loader_mismatch_desc,
                        version.getName(),
                        declaredGame,
                        declaredLoaders,
                        currentGame,
                        currentLoader))
                .setCancelable(false)
                .setPositiveButton(getContext().getString(R.string.mods_one_click_loader_mismatch_continue), onContinue)
                .setNegativeButton(null)
                .create()
                .show();
    }

    private void runPlanAndConfirm(RemoteMod.Version version) {
        TaskDialog planDialog = new TaskDialog(getContext(), new TaskCancellationAction(AppCompatDialog::dismiss));
        planDialog.setTitle(getContext().getString(R.string.mods_check_updates));
        Schedulers.androidUIThread().execute(() -> {
            final PlanResult[] holder = new PlanResult[1];
            TaskExecutor executor = Task.supplyAsync(() -> buildPlan(version))
                    .whenComplete(Schedulers.androidUIThread(), (plan, exception) -> {
                        planDialog.dismiss();
                        if (exception != null) {
                            if (exception instanceof CancellationException) {
                                Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                            } else {
                                Logging.LOG.log(Level.WARNING, "构建一键下载清单失败", exception);
                                Toast.makeText(getContext(), getContext().getString(R.string.download_failed_refresh), Toast.LENGTH_SHORT).show();
                            }
                            return;
                        }
                        holder[0] = plan;
                        if (plan.items.isEmpty()) {
                            Toast.makeText(getContext(), getContext().getString(R.string.mods_dependency_none_required), Toast.LENGTH_SHORT).show();
                            return;
                        }
                        showPlanDialog(plan, version);
                    }).executor();
            planDialog.setExecutor(executor);
            planDialog.show();
            executor.start();
        });
    }

    private void showPlanDialog(PlanResult plan, RemoteMod.Version version) {
        StringBuilder sb = new StringBuilder();
        sb.append(getContext().getString(R.string.mods_one_click_plan_summary,
                plan.downloadingCount, formatSize(plan.totalBytesEstimate)));
        sb.append("\n\n");
        for (PlanItem item : plan.items) {
            if (item.isModItself) {
                sb.append("• ")
                        .append(getContext().getString(R.string.mods_one_click_plan_item_mod, item.displayName, formatSize(item.sizeBytes)));
            } else {
                sb.append("• ")
                        .append(getContext().getString(R.string.mods_one_click_plan_item_dep, item.displayName, formatSize(item.sizeBytes)));
            }
            if (item.localHit) {
                sb.append(" — ").append(getContext().getString(R.string.mods_one_click_plan_item_local_hit));
            }
            sb.append("\n");
        }
        new FCLAlertDialog.Builder(getContext())
                .setAlertLevel(FCLAlertDialog.AlertLevel.INFO)
                .setTitle(getContext().getString(R.string.mods_one_click_plan_title))
                .setMessage(sb.toString())
                .setCancelable(false)
                .setPositiveButton(getContext().getString(R.string.button_download), () -> {
                    ConflictCheckResult conflicts = findConflicts(plan);
                    if (conflicts.hasConflict()) {
                        showConflictDialog(conflicts, () -> actuallyExecutePlan(plan, version, true));
                    } else {
                        actuallyExecutePlan(plan, version, false);
                    }
                })
                .setNegativeButton(null)
                .create()
                .show();
    }

    private void showConflictDialog(ConflictCheckResult conflicts, Runnable onRemoveOldAndContinue) {
        StringBuilder sb = new StringBuilder();
        boolean first = true;
        for (ConflictItem c : conflicts.conflicts) {
            if (!first) sb.append("\n\n");
            first = false;
            sb.append(getContext().getString(R.string.mods_one_click_conflict_desc,
                    c.modId,
                    c.installed == null ? "(unknown)" : c.installed.getName() + " / " + c.installed.getFileName(),
                    c.toDownload));
        }
        new FCLAlertDialog.Builder(getContext())
                .setAlertLevel(FCLAlertDialog.AlertLevel.ALERT)
                .setTitle(getContext().getString(R.string.mods_one_click_conflict_title))
                .setMessage(sb.toString())
                .setCancelable(false)
                .setPositiveButton(getContext().getString(R.string.mods_one_click_conflict_action_remove), onRemoveOldAndContinue)
                .setNegativeButton(getContext().getString(R.string.mods_one_click_conflict_action_keep), () -> actuallyExecutePlan(PlanResult.ofFiltered(conflicts.plan, item -> true), null, false))
                .create()
                .show();
    }

    private void actuallyExecutePlan(PlanResult plan, RemoteMod.Version version, boolean removeConflictOldVersionsFirst) {
        if (removeConflictOldVersionsFirst) {
            removeConflictingLocalVersions(plan);
        }
        executeTaskBatchWithRetry(plan, version);
    }

    private void removeConflictingLocalVersions(PlanResult plan) {
        ConflictCheckResult conflicts = findConflicts(plan);
        Profile profile = Profiles.getSelectedProfile();
        String selectedVersion = profile.getSelectedVersion();
        if (!profile.getRepository().hasVersion(selectedVersion)) return;
        ModManager modManager = profile.getRepository().getModManager(selectedVersion);
        List<LocalModFile> toRemove = new ArrayList<>();
        for (ConflictItem c : conflicts.conflicts) {
            if (c.installed != null) {
                toRemove.add(c.installed);
            }
        }
        if (toRemove.isEmpty()) return;
        try {
            modManager.removeMods(toRemove.toArray(new LocalModFile[0]));
        } catch (Throwable t) {
            Logging.LOG.log(Level.WARNING, "删除冲突的旧版本失败（继续下载，可能导致双版本冲突）", t);
        }
    }

    private void executeTaskBatchWithRetry(PlanResult plan, RemoteMod.Version version) {
        List<FileDownloadTask> tasks = plan.items.stream()
                .filter(it -> !it.localHit)
                .map(it -> it.task)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
        if (tasks.isEmpty()) {
            Toast.makeText(getContext(), getContext().getString(R.string.install_success), Toast.LENGTH_SHORT).show();
            refreshModList();
            return;
        }
        runExecute(tasks, new HashSet<>(), version);
    }

    private void runExecute(List<FileDownloadTask> tasks, Set<String> alreadyRetriedFailedNames, RemoteMod.Version version) {
        TaskDialog taskDialog = new TaskDialog(getContext(), new TaskCancellationAction(AppCompatDialog::dismiss));
        taskDialog.setTitle(getContext().getString(R.string.message_downloading));
        Schedulers.androidUIThread().execute(() -> {
            final String[] failed = new String[1];
            AtomicInteger failedCount = new AtomicInteger(0);
            TaskExecutor executor = Task.allOf(tasks)
                    .whenComplete(Schedulers.androidUIThread(), (v, exception) -> {
                        if (exception != null) {
                            if (exception instanceof CancellationException) {
                                Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                                return;
                            }
                        }
                        // Collect failed file-download subtasks by looking at FileDownloadTask internal exception is hard.
                        // Fallback: use any explicit per-task name list recorded by Task#exception and aggregate failure via executor counter
                        int actualFailed = 0;
                        List<String> failedNames = new ArrayList<>();
                        for (FileDownloadTask t : tasks) {
                            if (t.getException() != null) {
                                actualFailed++;
                                failedNames.add(StringUtils.isBlank(t.getName()) ? t.toString() : t.getName());
                            }
                        }
                        if (actualFailed == 0) {
                            Toast.makeText(getContext(), getContext().getString(R.string.install_success), Toast.LENGTH_SHORT).show();
                            refreshModList();
                            return;
                        }
                        int total = tasks.size();
                        List<String> toRetryNames = new ArrayList<>();
                        List<FileDownloadTask> retryTasks = new ArrayList<>();
                        Set<String> newRetriedSet = new HashSet<>(alreadyRetriedFailedNames);
                        for (FileDownloadTask t : tasks) {
                            if (t.getException() != null) {
                                String key = StringUtils.isBlank(t.getName()) ? t.toString() : t.getName();
                                toRetryNames.add(key);
                                if (!newRetriedSet.contains(key)) {
                                    retryTasks.add(recreateTask(t));
                                }
                            }
                        }
                        StringBuilder msg = new StringBuilder();
                        msg.append(getContext().getString(R.string.mods_one_click_failed_some, actualFailed, total))
                                .append("\n\n");
                        for (int i = 0; i < Math.min(toRetryNames.size(), 8); i++) {
                            msg.append("• ").append(toRetryNames.get(i)).append("\n");
                        }
                        if (toRetryNames.size() > 8) {
                            msg.append("... (").append(toRetryNames.size() - 8).append(" more)");
                        }
                        final int finalActualFailed = actualFailed;
                        List<FileDownloadTask> finalRetryTasks = retryTasks;
                        new FCLAlertDialog.Builder(getContext())
                                .setAlertLevel(FCLAlertDialog.AlertLevel.ALERT)
                                .setTitle(getContext().getString(R.string.install_failed))
                                .setMessage(msg.toString())
                                .setCancelable(false)
                                .setPositiveButton(getContext().getString(R.string.mods_one_click_retry_failed, finalActualFailed), () -> {
                                    if (finalRetryTasks.isEmpty()) {
                                        Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                                        return;
                                    }
                                    newRetriedSet.addAll(toRetryNames);
                                    runExecute(finalRetryTasks, newRetriedSet, version);
                                })
                                .setNegativeButton(getContext().getString(R.string.mods_one_click_retry_all), () -> {
                                    Set<String> empty = new HashSet<>();
                                    List<FileDownloadTask> fresh = tasks.stream().map(this::recreateTask).collect(Collectors.toList());
                                    runExecute(fresh, empty, version);
                                })
                                .create()
                                .show();
                    }).executor();
            taskDialog.setExecutor(executor);
            taskDialog.show();
            executor.start();
        });
    }

    private FileDownloadTask recreateTask(FileDownloadTask t) {
        try {
            FileDownloadTask copy = new FileDownloadTask(t.getUrl(), t.getDest(), t.getIntegrityCheck());
            copy.setName(t.getName());
            return copy;
        } catch (Throwable thr) {
            return t;
        }
    }

    private PlanResult buildPlan(RemoteMod.Version currentVersion) throws IOException {
        List<RemoteMod.Dependency> dependencies = (currentVersion.getDependencies() == null ? Collections.emptyList() : currentVersion.getDependencies()).stream()
                .filter(d -> d.getType() == RemoteMod.DependencyType.REQUIRED
                        || d.getType() == RemoteMod.DependencyType.TOOL)
                .collect(Collectors.toList());

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

        Path runDirectory = profile.getRepository().hasVersion(selectedVersion)
                ? profile.getRepository().getRunDirectory(selectedVersion).toPath()
                : profile.getRepository().getBaseDirectory().toPath();
        Path modsDir = runDirectory.resolve("mods");

        Set<String> downloadedIds = new HashSet<>();
        List<PlanItem> items = new ArrayList<>();

        if (currentVersion != null) {
            String pseudoId = (currentVersion.getModId() == null ? "__current__" : currentVersion.getModId())
                    + ":" + (currentVersion.getVersion() == null ? "" : currentVersion.getVersion());
            if (!downloadedIds.contains(pseudoId)) {
                try {
                    Path dest = modsDir.resolve(currentVersion.getFile().getFilename());
                    long size = currentVersion.getFile().getSize() == null ? 0L : currentVersion.getFile().getSize();
                    boolean hit = isLocalFileValid(dest, currentVersion.getFile().getIntegrityCheck());
                    FileDownloadTask task = null;
                    if (!hit) {
                        task = new FileDownloadTask(
                                NetworkUtils.toURL(currentVersion.getFile().getUrl()),
                                dest.toFile(),
                                currentVersion.getFile().getIntegrityCheck());
                        task.setName(currentVersion.getName());
                    }
                    items.add(new PlanItem(pseudoId, currentVersion.getName(), size, hit, currentVersion.getModId(), dest, task, true));
                    downloadedIds.add(pseudoId);
                    List<RemoteMod.Dependency> nested = currentVersion.getDependencies();
                    if (nested != null && !nested.isEmpty()) {
                        for (RemoteMod.Dependency d : nested) {
                            planDependencyRecursively(d, currentGameVersion, currentLoaders, modsDir, downloadedIds, items, 1);
                        }
                    }
                } catch (Throwable t) {
                    Logging.LOG.log(Level.WARNING, "规划模组本体失败: " + currentVersion.getName(), t);
                }
            }
        }

        for (RemoteMod.Dependency dependency : dependencies) {
            planDependencyRecursively(dependency, currentGameVersion, currentLoaders, modsDir, downloadedIds, items, 0);
        }

        long totalBytesEstimate = 0L;
        int downloadingCount = 0;
        for (PlanItem it : items) {
            totalBytesEstimate += it.sizeBytes;
            if (!it.localHit) downloadingCount++;
        }
        return new PlanResult(items, downloadingCount, totalBytesEstimate, currentGameVersion, currentLoaders, modsDir);
    }

    private void planDependencyRecursively(RemoteMod.Dependency dependency, String currentGameVersion,
                                           Set<ModLoaderType> currentLoaders, Path modsDir,
                                           Set<String> downloadedIds, List<PlanItem> items, int depth) {
        String dependencyId = dependency.getId();
        if (downloadedIds.contains(dependencyId)) return;
        try {
            RemoteMod mod = dependency.load();
            Optional<RemoteMod.Version> bestVersion = selectBestDependencyVersion(
                    mod, currentGameVersion, currentLoaders, dependency.getRemoteModRepository());
            if (bestVersion.isEmpty()) {
                downloadedIds.add(dependencyId);
                return;
            }
            RemoteMod.Version v = bestVersion.get();
            Path dest = modsDir.resolve(v.getFile().getFilename());
            long size = v.getFile().getSize() == null ? 0L : v.getFile().getSize();
            boolean hit = isLocalFileValid(dest, v.getFile().getIntegrityCheck());
            FileDownloadTask task = null;
            if (!hit) {
                task = new FileDownloadTask(NetworkUtils.toURL(v.getFile().getUrl()), dest.toFile(), v.getFile().getIntegrityCheck());
                task.setName(v.getName());
            }
            items.add(new PlanItem(dependencyId, v.getName(), size, hit, mod.getId(), dest, task, false));
            downloadedIds.add(dependencyId);
            List<RemoteMod.Dependency> nested = v.getDependencies();
            if (nested != null && !nested.isEmpty()) {
                for (RemoteMod.Dependency child : nested) {
                    if (child.getType() == RemoteMod.DependencyType.REQUIRED || child.getType() == RemoteMod.DependencyType.TOOL) {
                        planDependencyRecursively(child, currentGameVersion, currentLoaders, modsDir, downloadedIds, items, depth + 1);
                    }
                }
            }
        } catch (Throwable t) {
            Logging.LOG.log(Level.WARNING, "规划依赖失败: " + dependencyId, t);
            downloadedIds.add(dependencyId);
        }
    }

    private ConflictCheckResult findConflicts(PlanResult plan) {
        Profile profile = Profiles.getSelectedProfile();
        String selectedVersion = profile.getSelectedVersion();
        List<ConflictItem> conflicts = new ArrayList<>();
        if (!profile.getRepository().hasVersion(selectedVersion)) {
            return new ConflictCheckResult(plan, conflicts);
        }
        ModManager modManager = profile.getRepository().getModManager(selectedVersion);
        List<LocalModFile> localMods;
        try {
            localMods = modManager.getMods();
        } catch (Throwable t) {
            Logging.LOG.log(Level.WARNING, "读取本地模组列表失败，跳过冲突检测", t);
            return new ConflictCheckResult(plan, conflicts);
        }
        for (PlanItem item : plan.items) {
            if (item.localHit) continue;
            if (StringUtils.isBlank(item.modId)) continue;
            for (LocalModFile installed : localMods) {
                LocalModFile.LocalMod local = installed.getLocalMod();
                if (local == null) continue;
                String id = local.getId();
                if (!item.modId.equalsIgnoreCase(id)) continue;
                // Skip if target path equals the installed path (same file overwrite — safe)
                if (installed.getFile() != null && item.dest != null && installed.getFile().toPath().equals(item.dest)) {
                    continue;
                }
                conflicts.add(new ConflictItem(item.modId, installed, item.displayName + " @ " + item.dest.getFileName()));
            }
        }
        return new ConflictCheckResult(plan, conflicts);
    }

    private void refreshModList() {
        try {
            ManagePageManager manager = ManagePageManager.getInstance();
            if (manager != null) {
                manager.getModListPage().refresh();
            } else {
                Logging.LOG.log(Level.INFO, "ManagePageManager 未初始化，跳过模组列表刷新");
            }
        } catch (Throwable t) {
            Logging.LOG.log(Level.WARNING, "刷新模组列表失败", t);
        }
    }

    private static String formatSize(long bytes) {
        if (bytes <= 0L) return "?";
        double b = bytes;
        String[] units = {"B", "KB", "MB", "GB"};
        int u = 0;
        while (b >= 1024 && u < units.length - 1) {
            b /= 1024;
            u++;
        }
        return String.format(Locale.ROOT, "%.1f %s", b, units[u]);
    }

    private boolean isLocalFileValid(Path dest, FileDownloadTask.IntegrityCheck integrityCheck) {
        try {
            if (dest == null || !Files.exists(dest)) {
                return false;
            }
            if (integrityCheck == null) {
                return false;
            }
            String localHash = DigestUtils.digestToString(integrityCheck.getAlgorithm(), dest);
            return integrityCheck.getChecksum().equalsIgnoreCase(localHash);
        } catch (Throwable e) {
            Logging.LOG.log(Level.WARNING, "本地文件哈希校验失败: " + dest, e);
            return false;
        }
    }

    private Optional<RemoteMod.Version> selectBestDependencyVersion(
            RemoteMod mod, String currentGameVersion, Set<ModLoaderType> currentLoaders,
            RemoteModRepository repository) throws IOException {
        Stream<RemoteMod.Version> stream = mod.getData().loadVersions(repository);
        List<RemoteMod.Version> allVersions = stream.collect(Collectors.toList());

        Logging.LOG.log(Level.INFO, "依赖 " + mod.getTitle() + " 共找到 " + allVersions.size() + " 个版本，开始严格匹配游戏版本: " + currentGameVersion);

        for (RemoteMod.Version v : allVersions) {
            Logging.LOG.log(Level.FINE, "  候选版本: " + v.getName() + ", 支持游戏版本: " + v.getGameVersions() + ", 加载器: " + v.getLoaders());
        }

        Optional<RemoteMod.Version> result = filterAndSelect(allVersions, currentGameVersion, currentLoaders);

        if (result.isEmpty()) {
            Logging.LOG.log(Level.WARNING, "依赖 " + mod.getTitle() + " 未找到与游戏版本 " + currentGameVersion + " 严格匹配的版本，跳过下载（避免下载不兼容版本）");
        } else {
            Logging.LOG.log(Level.INFO, "依赖 " + mod.getTitle() + " 选中版本: " + result.get().getName() + " (游戏版本: " + result.get().getGameVersions() + ")");
        }

        return result;
    }

    private Optional<RemoteMod.Version> filterAndSelect(
            List<RemoteMod.Version> versions, String gameVersion, Set<ModLoaderType> loaders) {
        Stream<RemoteMod.Version> stream = versions.stream();
        if (!StringUtils.isBlank(gameVersion)) {
            stream = stream.filter(v -> v.getGameVersions() != null && v.getGameVersions().contains(gameVersion));
        }
        if (loaders != null && !loaders.isEmpty()) {
            stream = stream.filter(v -> {
                if (v.getLoaders() == null) return false;
                for (ModLoaderType loader : v.getLoaders()) {
                    if (loaders.contains(loader)) {
                        return true;
                    }
                }
                return false;
            });
        }
        return stream.max(Comparator.comparing(RemoteMod.Version::getDatePublished));
    }

    public static String getTag(Context context, RemoteMod.Version version) {
        StringBuilder stringBuilder = new StringBuilder();
        switch (version.getVersionType()) {
            case Beta:
            case Alpha:
                stringBuilder.append(context.getString(R.string.version_game_snapshot));
                break;
            default:
                stringBuilder.append(context.getString(R.string.version_game_release));
                break;
        }
        for (ModLoaderType modLoaderType : version.getLoaders()) {
            switch (modLoaderType) {
                case FORGE:
                    stringBuilder.append("   ").append(context.getString(R.string.install_installer_forge));
                    break;
                case NEO_FORGED:
                    stringBuilder.append("   ").append(context.getString(R.string.install_installer_neoforge));
                    break;
                case FABRIC:
                    stringBuilder.append("   ").append(context.getString(R.string.install_installer_fabric));
                    break;
                case LITE_LOADER:
                    stringBuilder.append("   ").append(context.getString(R.string.install_installer_liteloader));
                    break;
                case QUILT:
                    stringBuilder.append("   ").append(context.getString(R.string.install_installer_quilt));
                    break;
                case NEO_FORGE:
                    stringBuilder.append("   ").append(context.getString(R.string.install_installer_neoforge));
                    break;
                case CLEANROOM:
                    stringBuilder.append("   ").append(context.getString(R.string.install_installer_cleanroom));
                    break;
                case UNKNOWN:
                default:
                    break;
            }
        }
        return stringBuilder.toString();
    }

    public interface Callback {
        void onItemSelect(RemoteMod.Version version);
    }

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter
            .ofLocalizedDateTime(FormatStyle.MEDIUM)
            .withLocale(Locale.getDefault())
            .withZone(ZoneId.systemDefault());

    // === Small PODOs for plan flow ===

    private static class PlanItem {
        final String id;
        final String displayName;
        final long sizeBytes;
        final boolean localHit;
        final String modId;
        final Path dest;
        final FileDownloadTask task;
        final boolean isModItself;

        PlanItem(String id, String displayName, long sizeBytes, boolean localHit, String modId, Path dest, FileDownloadTask task, boolean isModItself) {
            this.id = id;
            this.displayName = displayName;
            this.sizeBytes = sizeBytes;
            this.localHit = localHit;
            this.modId = modId;
            this.dest = dest;
            this.task = task;
            this.isModItself = isModItself;
        }
    }

    private static class PlanResult {
        final List<PlanItem> items;
        final int downloadingCount;
        final long totalBytesEstimate;
        final String gameVersion;
        final Set<ModLoaderType> loaders;
        final Path modsDir;

        PlanResult(List<PlanItem> items, int downloadingCount, long totalBytesEstimate, String gameVersion, Set<ModLoaderType> loaders, Path modsDir) {
            this.items = items;
            this.downloadingCount = downloadingCount;
            this.totalBytesEstimate = totalBytesEstimate;
            this.gameVersion = gameVersion;
            this.loaders = loaders;
            this.modsDir = modsDir;
        }

        static PlanResult ofFiltered(PlanResult origin, java.util.function.Predicate<PlanItem> keep) {
            List<PlanItem> kept = origin.items.stream().filter(keep).collect(Collectors.toList());
            int down = 0;
            long total = 0L;
            for (PlanItem it : kept) {
                if (!it.localHit) down++;
                total += it.sizeBytes;
            }
            return new PlanResult(kept, down, total, origin.gameVersion, origin.loaders, origin.modsDir);
        }
    }

    private static class ConflictItem {
        final String modId;
        final LocalModFile installed;
        final String toDownload;

        ConflictItem(String modId, LocalModFile installed, String toDownload) {
            this.modId = modId;
            this.installed = installed;
            this.toDownload = toDownload;
        }
    }

    private static class ConflictCheckResult {
        final PlanResult plan;
        final List<ConflictItem> conflicts;

        ConflictCheckResult(PlanResult plan, List<ConflictItem> conflicts) {
            this.plan = plan;
            this.conflicts = conflicts;
        }

        boolean hasConflict() {
            return !conflicts.isEmpty();
        }
    }
}
