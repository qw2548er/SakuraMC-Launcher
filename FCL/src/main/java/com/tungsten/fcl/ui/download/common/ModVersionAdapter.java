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
import com.tungsten.fcl.util.TaskCancellationAction;
import com.tungsten.fclcore.download.LibraryAnalyzer;
import com.tungsten.fclcore.mod.ModLoaderType;
import com.tungsten.fclcore.mod.RemoteMod;
import com.tungsten.fclcore.task.FileDownloadTask;
import com.tungsten.fclcore.task.Schedulers;
import com.tungsten.fclcore.task.Task;
import com.tungsten.fclcore.task.TaskExecutor;
import com.tungsten.fclcore.util.io.NetworkUtils;
import com.tungsten.fcllibrary.component.FCLAdapter;
import com.tungsten.fcllibrary.component.theme.ThemeEngine;
import com.tungsten.fcllibrary.component.view.FCLButton;
import com.tungsten.fcllibrary.component.view.FCLLinearLayout;
import com.tungsten.fcllibrary.component.view.FCLTextView;

import java.io.IOException;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CancellationException;
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
        viewHolder.downloadDependencies.setText(getContext().getString(R.string.button_download_dependencies));
        viewHolder.downloadDependencies.setOnClickListener(v -> downloadDependencies(version));
    }

    private void downloadDependencies(RemoteMod.Version version) {
        List<RemoteMod.Dependency> dependencies = version.getDependencies().stream()
                .filter(d -> d.getType() == RemoteMod.DependencyType.REQUIRED
                        || d.getType() == RemoteMod.DependencyType.TOOL)
                .collect(Collectors.toList());

        if (dependencies.isEmpty()) {
            Toast.makeText(getContext(), getContext().getString(R.string.mods_dependency_none_required), Toast.LENGTH_SHORT).show();
            return;
        }

        TaskDialog taskDialog = new TaskDialog(getContext(), new TaskCancellationAction(AppCompatDialog::dismiss));
        taskDialog.setTitle(getContext().getString(R.string.message_downloading));
        Schedulers.androidUIThread().execute(() -> {
            TaskExecutor executor = Task.supplyAsync(() -> buildDependencyDownloadTasks(dependencies))
                    .thenComposeAsync(tasks -> Task.allOf(tasks))
                    .whenComplete(Schedulers.androidUIThread(), (result, exception) -> {
                        if (exception != null) {
                            if (exception instanceof CancellationException) {
                                Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                            } else {
                                Toast.makeText(getContext(), getContext().getString(R.string.download_failed_refresh), Toast.LENGTH_SHORT).show();
                            }
                        } else {
                            Toast.makeText(getContext(), getContext().getString(R.string.message_success), Toast.LENGTH_SHORT).show();
                        }
                    }).executor();
            taskDialog.setExecutor(executor);
            taskDialog.show();
            executor.start();
        });
    }

    private List<Task<?>> buildDependencyDownloadTasks(List<RemoteMod.Dependency> dependencies) throws IOException {
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

        List<Task<?>> tasks = new ArrayList<>();
        for (RemoteMod.Dependency dependency : dependencies) {
            RemoteMod mod = dependency.load();
            Optional<RemoteMod.Version> bestVersion = selectBestDependencyVersion(mod, currentGameVersion, currentLoaders);
            if (bestVersion.isPresent()) {
                RemoteMod.Version v = bestVersion.get();
                Path dest = modsDir.resolve(v.getFile().getFilename());
                FileDownloadTask task = new FileDownloadTask(NetworkUtils.toURL(v.getFile().getUrl()), dest.toFile(), v.getFile().getIntegrityCheck());
                task.setName(v.getName());
                tasks.add(task);
            }
        }
        return tasks;
    }

    private Optional<RemoteMod.Version> selectBestDependencyVersion(RemoteMod mod, String currentGameVersion, Set<ModLoaderType> currentLoaders) throws IOException {
        Stream<RemoteMod.Version> stream = mod.getData().loadVersions(null);
        if (!currentGameVersion.isEmpty()) {
            stream = stream.filter(v -> v.getGameVersions().contains(currentGameVersion));
        }
        if (!currentLoaders.isEmpty()) {
            stream = stream.filter(v -> {
                for (ModLoaderType loader : v.getLoaders()) {
                    if (currentLoaders.contains(loader)) {
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
