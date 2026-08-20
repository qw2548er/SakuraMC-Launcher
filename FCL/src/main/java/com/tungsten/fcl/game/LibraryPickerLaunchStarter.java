package com.tungsten.fcl.game;

import android.app.Activity;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;

import com.tungsten.fcl.R;
import com.tungsten.fclauncher.utils.FCLPath;
import com.tungsten.fclcore.download.DefaultDependencyManager;
import com.tungsten.fclcore.download.game.LibraryClassifier;
import com.tungsten.fclcore.download.game.LibrarySelectionStore;
import com.tungsten.fclcore.game.JavaVersion;
import com.tungsten.fclcore.game.Library;
import com.tungsten.fclcore.game.Version;
import com.tungsten.fclcore.task.Schedulers;
import com.tungsten.fclcore.task.Task;
import com.tungsten.fclcore.task.TaskExecutor;
import com.tungsten.fclcore.task.TaskListener;
import com.tungsten.fclcore.util.Lang;
import com.tungsten.fcl.FCLApplication;
import com.tungsten.fcl.ui.TaskDialog;
import com.tungsten.fcl.ui.download.common.LibraryPickerDialog;
import com.tungsten.fcl.util.TaskCancellationAction;
import com.tungsten.fcllibrary.component.dialog.FCLAlertDialog;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Level;

import static com.tungsten.fcl.game.LauncherHelper.LOG;

/**
 * 把「依赖选择 + 后续启动」从 {@link LauncherHelper#launch0()} 抽出来的独立辅助类。
 *
 * <p>核心职责：
 * <ul>
 *   <li>生命周期保护：所有持有 Context/Dialog 的地方都用 {@link WeakReference}，
 *       切后台或 Activity.finishing() 时绝不强引用，防止泄漏。</li>
 *   <li>取消 fallback：用户取消依赖选择框时，默认走「全量下载」分支，
 *       保证「点了取消还能继续启动」。</li>
 *   <li>设置开关：读取 {@code launcher.show_library_picker}，默认 {@code false}，
 *       高级用户手动开启后才弹选择框。</li>
 * </ul>
 *
 * <p>调用方式：LauncherHelper 中原来的 inline 分类/弹框整块替换为
 * <pre> new LibraryPickerLaunchStarter(...).run();</pre>
 */
public final class LibraryPickerLaunchStarter {

    /** SharedPreferences 里「启动前显示依赖选择」的 key，默认 false。 */
    public static final String PREF_KEY_SHOW_LIBRARY_PICKER = "show_library_picker";
    /** 同 LibraryPickerDialog 约定的缓存文件名（保持一致，写入/读取同一个文件）。 */
    private static final String RULES_CACHE_FILE = "library_classifier_rules_cache.json";
    private static final String RULES_ASSET = "game/library_classifier_rules.json";

    private final WeakReference<Context> contextRef;
    private final WeakReference<TaskDialog> launchingStepsPaneRef;
    private final FCLGameRepository repository;
    private final DefaultDependencyManager dependencyManager;
    private final Version resolvedVersion;
    private final VersionSetting setting;
    private final String selectedVersion;
    private final Optional<String> gameVersion;
    private final boolean integrityCheck;
    private final Continuation continuation;

    public interface Continuation {
        /**
         * 依赖选择结束（或被跳过）后，把控制权交回 LauncherHelper，继续后续 TaskExecutor。
         *
         * @param librarySubset 用户最终勾选的下载子集；{@code null} 表示不启用选择功能、走全量下载。
         */
        void continueWith(JavaVersion javaVersion, List<Library> librarySubset);
    }

    public LibraryPickerLaunchStarter(Context context,
                                      TaskDialog launchingStepsPane,
                                      FCLGameRepository repository,
                                      DefaultDependencyManager dependencyManager,
                                      Version resolvedVersion,
                                      VersionSetting setting,
                                      String selectedVersion,
                                      Optional<String> gameVersion,
                                      boolean integrityCheck,
                                      Continuation continuation) {
        this.contextRef = new WeakReference<>(Objects.requireNonNull(context));
        this.launchingStepsPaneRef = new WeakReference<>(Objects.requireNonNull(launchingStepsPane));
        this.repository = Objects.requireNonNull(repository);
        this.dependencyManager = Objects.requireNonNull(dependencyManager);
        this.resolvedVersion = Objects.requireNonNull(resolvedVersion);
        this.setting = Objects.requireNonNull(setting);
        this.selectedVersion = Objects.requireNonNull(selectedVersion);
        this.gameVersion = gameVersion;
        this.integrityCheck = integrityCheck;
        this.continuation = Objects.requireNonNull(continuation);
    }

    /** Java 预检查通过后，从这里决定：跳过? 弹框? 还是直接全量? */
    public void afterJavaCheckSucceeded(JavaVersion javaVersion) {
        if (isNotAlive()) return;
        if (setting.isNotCheckGame()) {
            // 不检查游戏文件 → 完全跳过选择
            dispatchContinue(javaVersion, null);
            return;
        }
        if (!shouldShowPicker()) {
            // 设置关闭 → 走原来的全量下载
            dispatchContinue(javaVersion, null);
            return;
        }
        // 需要弹选择框：后台做分类，再切 UI 检查生命周期后弹
        final AtomicReference<Object[]> classifyResult = new AtomicReference<>();
        final Context appCtx = contextRef.get() == null ? null : contextRef.get().getApplicationContext();
        Task.supplyAsync(() -> {
            // ---------- 0) 预先注入规则（FilesDir 缓存优先 + assets fallback） ----------
            // 必须放在 classifyLibraries() 之前，否则分类会先走硬编码兜底，造成「分类结果 ≠ Dialog 展示分类」的不一致
            if (appCtx != null) {
                Path cachedRulesFile = null;
                try {
                    File filesDir = appCtx.getFilesDir();
                    if (filesDir != null) {
                        cachedRulesFile = Paths.get(filesDir.getAbsolutePath(), RULES_CACHE_FILE);
                    }
                } catch (Throwable ignore) { cachedRulesFile = null; }
                InputStream fallback = null;
                try {
                    try {
                        fallback = appCtx.getAssets().open(RULES_ASSET);
                    } catch (IOException e) {
                        LOG.log(Level.WARNING, "Assets rules not found: " + RULES_ASSET, e);
                        fallback = null;
                    }
                    // 同步注入（当前已在后台线程）；失败 LibraryClassifier 内部会保留硬编码兜底
                    LibraryClassifier.injectRules(cachedRulesFile, fallback);
                } catch (Throwable t) {
                    LOG.log(Level.WARNING, "Pre-inject library rules failed, keep hardcoded", t);
                } finally {
                    if (fallback != null) {
                        try { fallback.close(); } catch (IOException ignore) {}
                    }
                }
            }
            // ---------- 1) 分类（此时 activeRules 已经被上面注入过，和后续 Dialog 展示保持一致） ----------
            LibraryClassifier.Classification cls = dependencyManager.classifyLibraries(resolvedVersion, integrityCheck);
            LibrarySelectionStore store = dependencyManager.librarySelectionStore();
            classifyResult.set(new Object[]{cls, store});
            return null;
        }).whenComplete(err -> Schedulers.androidUIThread().execute(() -> {
            if (isNotAlive()) return;
            if (err != null) {
                LOG.log(Level.WARNING, "Classify libraries failed, fallback to full download", err);
                dispatchContinue(javaVersion, null);
                return;
            }
            Object[] pair = classifyResult.get();
            if (pair == null) {
                dispatchContinue(javaVersion, null);
                return;
            }
            LibraryClassifier.Classification cls = (LibraryClassifier.Classification) pair[0];
            LibrarySelectionStore store = (LibrarySelectionStore) pair[1];
            Context ctx = contextRef.get();
            if (ctx == null) {
                dispatchContinue(javaVersion, null);
                return;
            }
            LibraryPickerDialog.showFor(ctx, selectedVersion, cls, store, new LibraryPickerDialog.Callback() {
                @Override
                public void onConfirm(Set<String> selectedKeys) {
                    List<Library> subset = dependencyManager.applyUserSelection(resolvedVersion, integrityCheck, selectedKeys);
                    dispatchContinue(javaVersion, subset);
                }

                @Override
                public void onCancel() {
                    // 用户取消时 fallback 全量下载，确保还能继续启动
                    dispatchContinue(javaVersion, null);
                }
            });
        }));
    }

    /** Java 预检查失败：统一走 LauncherHelper 的错误展示分支。 */
    public void afterJavaCheckFailed(Exception ex) {
        TaskDialog pane = launchingStepsPaneRef.get();
        if (pane != null) pane.dismiss();
        if (ex == null || ex instanceof CancellationException) return;
        Context ctx = contextRef.get();
        if (ctx == null || isNotAlive()) return;
        Schedulers.androidUIThread().execute(() -> {
            if (isNotAlive()) return;
            FCLAlertDialog.Builder builder = new FCLAlertDialog.Builder(ctx);
            builder.setAlertLevel(FCLAlertDialog.AlertLevel.ALERT);
            builder.setCancelable(false);
            builder.setTitle(ctx.getString(R.string.launch_failed));
            String msg = (ex instanceof IllegalArgumentException)
                    ? ctx.getString(R.string.exception_no_suitable_java)
                    : com.tungsten.fclcore.util.StringUtils.getStackTrace(ex);
            builder.setMessage(msg);
            builder.setNegativeButton(ctx.getString(com.tungsten.fcllibrary.R.string.dialog_positive), null);
            builder.create().show();
        });
    }

    private void dispatchContinue(JavaVersion javaVersion, List<Library> librarySubset) {
        if (isNotAlive()) {
            // Activity 已死，但 continuation 仍然会启动后续 Task，继续让它执行也无妨
        }
        continuation.continueWith(javaVersion, librarySubset);
    }

    /** 设置项：启动前是否显示依赖选择。默认关闭（普通用户无感）。 */
    public static boolean shouldShowPicker(Context context) {
        if (context == null) return false;
        SharedPreferences sp = context.getSharedPreferences("launcher", Context.MODE_PRIVATE);
        return sp.getBoolean(PREF_KEY_SHOW_LIBRARY_PICKER, false);
    }

    public static void setShouldShowPicker(Context context, boolean enabled) {
        if (context == null) return;
        context.getSharedPreferences("launcher", Context.MODE_PRIVATE)
                .edit()
                .putBoolean(PREF_KEY_SHOW_LIBRARY_PICKER, enabled)
                .apply();
    }

    private boolean shouldShowPicker() {
        return shouldShowPicker(contextRef.get());
    }

    /** 生命周期保护：Activity 不存在 / finishing / destroyed → 返回 true，后续所有 UI 操作全部跳过。 */
    private boolean isNotAlive() {
        Context ctx = contextRef.get();
        if (ctx == null) return true;
        Activity a = unwrapActivity(ctx);
        if (a == null) return false; // 纯 Service / App context 保守放行
        return a.isFinishing() || isDestroyedCompat(a);
    }

    private static Activity unwrapActivity(Context ctx) {
        if (ctx instanceof Activity) return (Activity) ctx;
        if (ctx instanceof ContextWrapper) return unwrapActivity(((ContextWrapper) ctx).getBaseContext());
        return null;
    }

    private static boolean isDestroyedCompat(Activity a) {
        try {
            return a.isDestroyed();
        } catch (NoSuchMethodError ignore) {
            return false;
        }
    }
}
