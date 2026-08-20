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
import com.tungsten.fclcore.mod.ModLoaderType;
import com.tungsten.fclcore.mod.RemoteMod;
import com.tungsten.fclcore.mod.RemoteModRepository;
import com.tungsten.fclcore.task.FileDownloadTask;
import com.tungsten.fclcore.task.Schedulers;
import com.tungsten.fclcore.task.Task;
import com.tungsten.fclcore.task.TaskExecutor;
import com.tungsten.fclcore.util.DigestUtils;
import com.tungsten.fclcore.util.Logging;
import com.tungsten.fclcore.util.io.NetworkUtils;
import com.tungsten.fcllibrary.component.FCLAdapter;
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
        List<RemoteMod.Dependency> requiredDependencies = version.getDependencies().stream()
                .filter(d -> d.getType() == RemoteMod.DependencyType.REQUIRED
                        || d.getType() == RemoteMod.DependencyType.TOOL)
                .collect(Collectors.toList());

        if (requiredDependencies.isEmpty()) {
            viewHolder.downloadDependencies.setVisibility(View.GONE);
            return;
        }

        viewHolder.downloadDependencies.setVisibility(View.VISIBLE);
        viewHolder.downloadDependencies.setEnabled(true);
        viewHolder.downloadDependencies.setText(getContext().getString(R.string.button_one_click_download_deps));
        viewHolder.downloadDependencies.setOnClickListener(v -> downloadDependencies(version));
    }

    private void downloadDependencies(RemoteMod.Version version) {
        List<RemoteMod.Dependency> dependencies = version.getDependencies().stream()
                .filter(d -> d.getType() == RemoteMod.DependencyType.REQUIRED
                        || d.getType() == RemoteMod.DependencyType.TOOL)
                .collect(Collectors.toList());

        TaskDialog taskDialog = new TaskDialog(getContext(), new TaskCancellationAction(AppCompatDialog::dismiss));
        taskDialog.setTitle(getContext().getString(R.string.message_downloading));
        Schedulers.androidUIThread().execute(() -> {
            TaskExecutor executor = Task.supplyAsync(() -> buildDependencyDownloadTasks(version, dependencies))
                    .thenComposeAsync(tasks -> {
                        if (tasks.isEmpty()) {
                            // 本体本地已存在 + 所有依赖也都本地已存在：返回空 completed Task，避免 allOf 空列表歧义
                            return Task.completed(null);
                        }
                        return Task.allOf(tasks);
                    })
                    .whenComplete(Schedulers.androidUIThread(), (result, exception) -> {
                        if (exception != null) {
                            if (exception instanceof CancellationException) {
                                Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                            } else {
                                Logging.LOG.log(Level.WARNING, "依赖下载失败", exception);
                                Toast.makeText(getContext(), getContext().getString(R.string.download_failed_refresh), Toast.LENGTH_SHORT).show();
                            }
                        } else {
                            Toast.makeText(getContext(), getContext().getString(R.string.install_success), Toast.LENGTH_SHORT).show();
                            refreshModList();
                        }
                    }).executor();
            taskDialog.setExecutor(executor);
            taskDialog.show();
            executor.start();
        });
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

    private List<Task<?>> buildDependencyDownloadTasks(RemoteMod.Version currentVersion,
                                                       List<RemoteMod.Dependency> dependencies) throws IOException {
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

        Logging.LOG.log(Level.INFO, "开始构建一键下载任务（模组本体 + 依赖）: 游戏版本=" + currentGameVersion + ", 加载器=" + currentLoaders);

        Path runDirectory = profile.getRepository().hasVersion(selectedVersion)
                ? profile.getRepository().getRunDirectory(selectedVersion).toPath()
                : profile.getRepository().getBaseDirectory().toPath();
        Path modsDir = runDirectory.resolve("mods");

        Set<String> downloadedIds = new HashSet<>();
        List<Task<?>> tasks = new ArrayList<>();

        // 首先处理当前选中的模组本体（真正的"一键下载"：不只是依赖，还要下载模组本身）
        // 注意：下面所有依赖逻辑一律保持原样不动，仅额外处理本体
        if (currentVersion != null) {
            String pseudoId = (currentVersion.getModId() == null ? "__current__" : currentVersion.getModId())
                    + ":" + (currentVersion.getVersion() == null ? "" : currentVersion.getVersion());
            if (!downloadedIds.contains(pseudoId)) {
                try {
                    Logging.LOG.log(Level.INFO, "[0] 处理当前模组本体: " + currentVersion.getName() + " (" + pseudoId + ")");
                    Path dest = modsDir.resolve(currentVersion.getFile().getFilename());

                    if (isLocalFileValid(dest, currentVersion.getFile().getIntegrityCheck())) {
                        Logging.LOG.log(Level.INFO, "[0] 本地已存在且哈希匹配，跳过下载: " + currentVersion.getName());
                        downloadedIds.add(pseudoId);

                        List<RemoteMod.Dependency> nestedDependencies = currentVersion.getDependencies();
                        if (nestedDependencies != null && !nestedDependencies.isEmpty()) {
                            Logging.LOG.log(Level.INFO, "[0] 递归解析本体声明的 " + nestedDependencies.size() + " 个子依赖");
                            for (RemoteMod.Dependency nested : nestedDependencies) {
                                downloadDependencyRecursively(nested, currentGameVersion, currentLoaders,
                                        modsDir, downloadedIds, tasks, 1);
                            }
                        }
                    } else {
                        FileDownloadTask task = new FileDownloadTask(
                                NetworkUtils.toURL(currentVersion.getFile().getUrl()),
                                dest.toFile(),
                                currentVersion.getFile().getIntegrityCheck());
                        task.setName(currentVersion.getName());
                        tasks.add(task);
                        downloadedIds.add(pseudoId);
                        Logging.LOG.log(Level.INFO, "[0] 创建下载任务: " + currentVersion.getName() + " -> " + dest);

                        List<RemoteMod.Dependency> nestedDependencies = currentVersion.getDependencies();
                        if (nestedDependencies != null && !nestedDependencies.isEmpty()) {
                            Logging.LOG.log(Level.INFO, "[0] 递归解析本体声明的 " + nestedDependencies.size() + " 个子依赖");
                            for (RemoteMod.Dependency nested : nestedDependencies) {
                                downloadDependencyRecursively(nested, currentGameVersion, currentLoaders,
                                        modsDir, downloadedIds, tasks, 1);
                            }
                        }
                    }
                } catch (Throwable e) {
                    Logging.LOG.log(Level.WARNING, "[0] 处理当前模组本体失败: " + pseudoId, e);
                    // 不往 downloadedIds 里塞，留给依赖循环再试一次（概率极低）
                }
            }
        }

        for (RemoteMod.Dependency dependency : dependencies) {
            downloadDependencyRecursively(dependency, currentGameVersion, currentLoaders, modsDir, downloadedIds, tasks, 0);
        }

        Logging.LOG.log(Level.INFO, "依赖下载任务构建完成: 共 " + tasks.size() + " 个任务（含模组本体）");
        return tasks;
    }

    private void downloadDependencyRecursively(RemoteMod.Dependency dependency, String currentGameVersion,
                                                Set<ModLoaderType> currentLoaders, Path modsDir,
                                                Set<String> downloadedIds, List<Task<?>> tasks, int depth) {
        String dependencyId = dependency.getId();
        if (downloadedIds.contains(dependencyId)) {
            Logging.LOG.log(Level.FINE, "依赖已处理过，跳过: " + dependencyId);
            return;
        }

        try {
            RemoteMod mod = dependency.load();
            Logging.LOG.log(Level.INFO, "[" + "  ".repeat(depth) + "处理依赖: " + mod.getTitle() + " (" + dependencyId + ")");

            Optional<RemoteMod.Version> bestVersion = selectBestDependencyVersion(
                    mod, currentGameVersion, currentLoaders, dependency.getRemoteModRepository());

            if (bestVersion.isPresent()) {
                RemoteMod.Version v = bestVersion.get();
                Path dest = modsDir.resolve(v.getFile().getFilename());

                if (isLocalFileValid(dest, v.getFile().getIntegrityCheck())) {
                    Logging.LOG.log(Level.INFO, "[" + "  ".repeat(depth) + "本地已存在且哈希匹配，跳过下载: " + v.getName());
                    downloadedIds.add(dependencyId);

                    List<RemoteMod.Dependency> nestedDependencies = v.getDependencies();
                    if (nestedDependencies != null && !nestedDependencies.isEmpty()) {
                        Logging.LOG.log(Level.INFO, "[" + "  ".repeat(depth) + "递归下载 " + nestedDependencies.size() + " 个子依赖");
                        for (RemoteMod.Dependency nested : nestedDependencies) {
                            downloadDependencyRecursively(nested, currentGameVersion, currentLoaders,
                                    modsDir, downloadedIds, tasks, depth + 1);
                        }
                    }
                    return;
                }

                FileDownloadTask task = new FileDownloadTask(
                        NetworkUtils.toURL(v.getFile().getUrl()), dest.toFile(), v.getFile().getIntegrityCheck());
                task.setName(v.getName());
                tasks.add(task);
                downloadedIds.add(dependencyId);
                Logging.LOG.log(Level.INFO, "[" + "  ".repeat(depth) + "创建下载任务: " + v.getName() + " -> " + dest);

                List<RemoteMod.Dependency> nestedDependencies = v.getDependencies();
                if (nestedDependencies != null && !nestedDependencies.isEmpty()) {
                    Logging.LOG.log(Level.INFO, "[" + "  ".repeat(depth) + "递归下载 " + nestedDependencies.size() + " 个子依赖");
                    for (RemoteMod.Dependency nested : nestedDependencies) {
                        downloadDependencyRecursively(nested, currentGameVersion, currentLoaders,
                                modsDir, downloadedIds, tasks, depth + 1);
                    }
                }
            } else {
                Logging.LOG.log(Level.WARNING, "[" + "  ".repeat(depth) + "未找到与游戏版本 " + currentGameVersion + " 匹配的版本，跳过: " + mod.getTitle());
                downloadedIds.add(dependencyId);
            }
        } catch (Throwable e) {
            Logging.LOG.log(Level.WARNING, "[" + "  ".repeat(depth) + "处理依赖失败: " + dependencyId, e);
            downloadedIds.add(dependencyId);
        }
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
        if (!gameVersion.isEmpty()) {
            stream = stream.filter(v -> v.getGameVersions().contains(gameVersion));
        }
        if (!loaders.isEmpty()) {
            stream = stream.filter(v -> {
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
            }
        }
        return stringBuilder.toString();
    }

    public interface Callback {
        void onItemSelect(RemoteMod.Version version);
    }

    @SuppressLint("ConstantLocale")
    public static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.FULL).withLocale(Locale.getDefault()).withZone(ZoneId.systemDefault());
}
