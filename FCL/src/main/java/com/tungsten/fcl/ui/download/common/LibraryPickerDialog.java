package com.tungsten.fcl.ui.download.common;

import android.content.Context;
import android.content.res.AssetManager;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Filter;
import android.widget.ImageView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
import com.tungsten.fcl.R;
import com.tungsten.fclcore.download.game.LibraryClassifier;
import com.tungsten.fclcore.download.game.LibrarySelectionStore;
import com.tungsten.fclcore.util.Logging;
import com.tungsten.fcllibrary.component.dialog.FCLAlertDialog;
import com.tungsten.fcllibrary.component.dialog.FCLDialog;
import com.tungsten.fcllibrary.component.view.FCLButton;
import com.tungsten.fcllibrary.component.view.FCLEditText;
import com.tungsten.fcllibrary.component.view.FCLTextView;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Level;

/**
 * 依赖选择对话框（V2：单 RecyclerView + Section + 搜索 + 排序 + 一键精简 + 说明文案）。
 *
 * <p>使用方式：通过 {@link #showFor(Context, String, LibraryClassifier.Classification, LibrarySelectionStore, Callback)}
 * 在分类结果之上弹出选择框。用户点击确认 / 取消通过 {@link Callback} 回传。
 */
public class LibraryPickerDialog extends FCLDialog implements View.OnClickListener {

    private static final Gson GSON = new com.google.gson.GsonBuilder().disableHtmlEscaping().setLenient().create();
    private static final String DESCRIPTIONS_ASSET = "game/library_descriptions.json";
    private static final String RULES_ASSET = "game/library_classifier_rules.json";
    /** 本地缓存规则文件名（相对 Context.getFilesDir()）。 */
    private static final String RULES_CACHE_FILE = "library_classifier_rules_cache.json";

    private static final Handler UI_HANDLER = new Handler(Looper.getMainLooper());

    private final Callback callback;
    private final String versionId;
    private final LibraryClassifier.Classification classification;
    private final LibrarySelectionStore store;

    private FCLTextView titleView;
    private FCLTextView summaryView;
    private FCLEditText searchEdit;
    private FCLButton btnSort;
    private FCLButton btnMinimal;
    private ImageView btnMinimalHelp;
    private RecyclerView recycler;
    private FCLButton btnRecommended;
    private FCLButton btnReset;
    private FCLButton btnCancel;
    private FCLButton btnDownload;

    private LibrarySectionedAdapter adapter;
    private LibrarySectionedAdapter.SortMode currentSort = LibrarySectionedAdapter.SortMode.NAME;

    /** 当前用户勾选（共享给 adapter 操作）。 */
    private final Set<String> selectedKeys;

    /** 加载到的依赖说明（coords -> 说明）。 */
    private final Map<String, String> descriptions;

    // ------------------------------------------------------------------
    // 对外入口
    // ------------------------------------------------------------------

    /**
     * 后台线程加载「规则 + 说明文案」后切 UI 线程弹出对话框，避免主线程读 assets+解析 JSON 造成卡顿。
     *
     * <p>加载顺序与兜底策略：
     * <ol>
     *   <li>规则注入：优先读 FilesDir 缓存 JSON（未来远程下发写入路径）；若不存在/失败再读 assets 兜底；
     *       注入全程在后台线程。</li>
     *   <li>依赖说明文案：从 assets 读 library_descriptions.json，同在后台线程。</li>
     *   <li>全部加载完成 → 切 UI 线程 → new Dialog + show()。</li>
     * </ol>
     */
    public static LibraryPickerDialog showFor(@NonNull Context context,
                                              @NonNull String versionId,
                                              @NonNull LibraryClassifier.Classification classification,
                                              LibrarySelectionStore store,
                                              @NonNull Callback callback) {
        final Context appCtx = context.getApplicationContext();
        final java.util.concurrent.atomic.AtomicReference<LibraryPickerDialog> dlgRef =
                new java.util.concurrent.atomic.AtomicReference<>();

        // 后台线程：注入规则 + 加载 descriptions
        final Thread loader = new Thread(() -> {
            // ---- 1) 规则：FilesDir 缓存优先 + assets fallback ----
            Path cachedRulesFile = null;
            try {
                File filesDir = appCtx.getFilesDir();
                if (filesDir != null) {
                    cachedRulesFile = Paths.get(filesDir.getAbsolutePath(), RULES_CACHE_FILE);
                }
            } catch (Throwable ignore) {
                cachedRulesFile = null;
            }
            final Path finalCachedRulesFile = cachedRulesFile;
            final LibraryClassifier.InputStreamSupplier fallbackSupplier = () -> {
                try {
                    return appCtx.getAssets().open(RULES_ASSET);
                } catch (IOException e) {
                    Logging.LOG.log(Level.WARNING, "Assets rules not found: " + RULES_ASSET, e);
                    return null;
                }
            };
            // 同步执行一次注入（我们已经在后台线程里了）；失败则 LibraryClassifier 保留硬编码兜底
            try {
                InputStream fallback = null;
                try {
                    fallback = fallbackSupplier.open();
                    LibraryClassifier.injectRules(finalCachedRulesFile, fallback);
                } finally {
                    if (fallback != null) {
                        try { fallback.close(); } catch (IOException ignore) {}
                    }
                }
            } catch (Throwable t) {
                Logging.LOG.log(Level.WARNING, "Background rules inject failed, keep hardcoded", t);
            }

            // ---- 2) descriptions ----
            final Map<String, String> loadedDescriptions = loadDescriptionsBg(appCtx);

            // ---- 3) 切 UI 线程构造并展示 ----
            UI_HANDLER.post(() -> {
                LibraryPickerDialog dlg = new LibraryPickerDialog(
                        context, versionId, classification, store, callback, loadedDescriptions
                );
                dlgRef.set(dlg);
                dlg.show();
            });
        }, "LibraryPicker-Loader");
        loader.setDaemon(true);
        loader.start();

        return dlgRef.get(); // 立即返回 null 也可以，调用方一般不依赖返回值；show() 在 UI 线程稍后执行
    }

    /** 尝试从 assets 中加载并激活 library_classifier_rules.json（schema_version 1）。 */
    public static void injectRulesFromAssets(@NonNull Context context) {
        try {
            AssetManager am = context.getApplicationContext().getAssets();
            try (InputStream in = am.open(RULES_ASSET)) {
                LibraryClassifier.Rules rules = LibraryClassifier.loadRules(in);
                if (rules != null) LibraryClassifier.setActiveRules(rules);
            }
        } catch (IOException | RuntimeException e) {
            Logging.LOG.log(Level.WARNING, "Failed to inject library classifier rules from assets", e);
        }
    }

    public LibraryPickerDialog(@NonNull Context context,
                               @NonNull String versionId,
                               @NonNull LibraryClassifier.Classification classification,
                               LibrarySelectionStore store,
                               @NonNull Callback callback,
                               @NonNull Map<String, String> descriptions) {
        super(context);
        this.versionId = versionId;
        this.classification = classification;
        this.store = store;
        this.callback = callback;
        this.selectedKeys = new LinkedHashSet<>();
        this.descriptions = descriptions == null ? Collections.emptyMap() : descriptions;

        initSelection();

        setContentView(R.layout.dialog_library_picker);
        setCancelable(false);

        findViews();
        setupRecycler();
        setupSearchAndSort();
        bindButtons();
        updateSummary();
    }

    private void initSelection() {
        for (LibraryClassifier.Entry e : classification.getMust()) {
            selectedKeys.add(e.getKey());
        }
        Set<String> previous = store == null ? null : store.loadSelection(versionId, null);
        Set<String> defaults = classification.defaultSelection();
        if (previous != null && !previous.isEmpty()) {
            Set<String> allKeys = classification.allKeys();
            for (String k : previous) {
                if (allKeys.contains(k)) selectedKeys.add(k);
            }
            for (LibraryClassifier.Entry e : classification.getMust()) {
                selectedKeys.add(e.getKey());
            }
        } else {
            selectedKeys.addAll(defaults);
        }
    }

    /**
     * 后台线程可安全调用的描述加载器（不触碰任何 UI）。
     * 解析失败返回空 Map，调用方可直接安全使用。
     */
    private static Map<String, String> loadDescriptionsBg(Context appCtx) {
        try {
            AssetManager am = appCtx.getAssets();
            try (InputStream in = am.open(DESCRIPTIONS_ASSET);
                 Reader r = new InputStreamReader(in, StandardCharsets.UTF_8)) {
                JsonObject root = GSON.fromJson(r, JsonObject.class);
                if (root == null) return Collections.emptyMap();
                JsonElement d = root.get("descriptions");
                if (d == null || !d.isJsonObject()) return Collections.emptyMap();
                Type mapType = new TypeToken<Map<String, String>>(){}.getType();
                Map<String, String> m = GSON.fromJson(d, mapType);
                return m == null ? Collections.emptyMap() : m;
            }
        } catch (IOException | RuntimeException e) {
            Logging.LOG.log(Level.WARNING, "Failed to load library descriptions JSON", e);
            return Collections.emptyMap();
        }
    }

    private void findViews() {
        titleView = findViewById(R.id.title);
        summaryView = findViewById(R.id.summary);
        searchEdit = findViewById(R.id.search_edit);
        btnSort = findViewById(R.id.btn_sort);
        btnMinimal = findViewById(R.id.btn_minimal);
        btnMinimalHelp = findViewById(R.id.btn_minimal_help);
        recycler = findViewById(R.id.recycler);
        btnRecommended = findViewById(R.id.btn_recommended);
        btnReset = findViewById(R.id.btn_reset);
        btnCancel = findViewById(R.id.btn_cancel);
        btnDownload = findViewById(R.id.btn_download);
    }

    private void setupRecycler() {
        titleView.setText(getContext().getString(R.string.library_picker_title, versionId));
        // 版本独立的 SP 折叠状态存储：重启后记住 MUST/RECOMMENDED/OPTIONAL 各自的展开/折叠状态
        LibrarySectionedAdapter.CollapseStateStore collapseStore =
                LibrarySectionedAdapter.newSpCollapseStore(getContext(), versionId);
        adapter = new LibrarySectionedAdapter(
                getContext(),
                classification,
                selectedKeys,
                descriptions,
                collapseStore,
                this::updateSummary
        );
        adapter.setOnSelectionChanged(this::updateSummary);
        recycler.setLayoutManager(new LinearLayoutManager(getContext(), LinearLayoutManager.VERTICAL, false));
        recycler.setHasFixedSize(false);
        recycler.setAdapter(adapter);
    }

    private void setupSearchAndSort() {
        btnSort.setText(getContext().getString(
                currentSort == LibrarySectionedAdapter.SortMode.SIZE_DESC
                        ? R.string.library_picker_action_sort_name
                        : R.string.library_picker_action_sort_size));
        btnSort.setOnClickListener(v -> {
            currentSort = (currentSort == LibrarySectionedAdapter.SortMode.SIZE_DESC)
                    ? LibrarySectionedAdapter.SortMode.NAME
                    : LibrarySectionedAdapter.SortMode.SIZE_DESC;
            btnSort.setText(getContext().getString(
                    currentSort == LibrarySectionedAdapter.SortMode.SIZE_DESC
                            ? R.string.library_picker_action_sort_name
                            : R.string.library_picker_action_sort_size));
            adapter.setSortMode(currentSort);
        });
        btnMinimal.setOnClickListener(v -> {
            FCLAlertDialog.Builder b = new FCLAlertDialog.Builder(getContext());
            b.setAlertLevel(FCLAlertDialog.AlertLevel.ALERT);
            b.setCancelable(false);
            b.setTitle(getContext().getString(R.string.library_picker_action_minimal));
            b.setMessage(getContext().getString(R.string.library_picker_help_minimal));
            b.setPositiveButton(getContext().getString(R.string.mod_check_continue), (FCLAlertDialog.ButtonListener) () -> {
                adapter.applyMinimalSelection();
                updateSummary();
            });
            b.setNegativeButton(getContext().getString(R.string.button_cancel), null);
            b.create().show();
        });
        btnMinimalHelp.setOnClickListener(v -> {
            FCLAlertDialog.Builder b = new FCLAlertDialog.Builder(getContext());
            b.setAlertLevel(FCLAlertDialog.AlertLevel.INFO);
            b.setCancelable(true);
            b.setTitle(getContext().getString(R.string.help));
            b.setMessage(getContext().getString(R.string.library_picker_help_minimal));
            b.setPositiveButton(getContext().getString(R.string.button_cancel), null);
            b.create().show();
        });
        searchEdit.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                adapter.setQuery(s);
            }
            @Override public void afterTextChanged(Editable s) {}
        });
    }

    private void bindButtons() {
        btnRecommended.setOnClickListener(this);
        btnReset.setOnClickListener(this);
        btnCancel.setOnClickListener(this);
        btnDownload.setOnClickListener(this);
    }

    /**
     * 细化摘要：
     *  - 已选 X 项
     *  - 总计大小（所有非 present 的 selected 库 + present 加起来其实可以显示全量 total bytes）
     *  - 本地已存在（不管选没选，所有 present 的大小）
     *  - 还需下载（选中 + 非 present）
     */
    private void updateSummary() {
        int pickedCount = 0;
        long totalBytes = 0L;
        long presentBytes = 0L;
        long needDownloadBytes = 0L;

        List<LibraryClassifier.Entry> all = new ArrayList<>();
        all.addAll(classification.getMust());
        all.addAll(classification.getRecommended());
        all.addAll(classification.getOptional());
        for (LibraryClassifier.Entry e : all) {
            long size = Math.max(0L, e.getSize());
            totalBytes += size;
            if (e.isAlreadyPresent()) {
                presentBytes += size;
            } else {
                if (selectedKeys.contains(e.getKey())) {
                    pickedCount++;
                    needDownloadBytes += size;
                }
            }
        }
        summaryView.setText(getContext().getString(R.string.library_picker_summary,
                pickedCount,
                LibraryClassifier.humanReadableBytes(totalBytes),
                LibraryClassifier.humanReadableBytes(presentBytes),
                LibraryClassifier.humanReadableBytes(needDownloadBytes)));
    }

    @Override
    public void onClick(View v) {
        if (v == btnRecommended) {
            adapter.selectAllRecommendedToggleable();
            updateSummary();
        } else if (v == btnReset) {
            adapter.applyDefaultSelection();
            updateSummary();
        } else if (v == btnCancel) {
            callback.onCancel();
            dismiss();
        } else if (v == btnDownload) {
            boolean missingRecommended = false;
            for (LibraryClassifier.Entry e : classification.getRecommended()) {
                if (e.isAlreadyPresent()) continue;
                if (!selectedKeys.contains(e.getKey())) {
                    missingRecommended = true;
                    break;
                }
            }
            if (missingRecommended) {
                FCLAlertDialog.Builder b = new FCLAlertDialog.Builder(getContext());
                b.setAlertLevel(FCLAlertDialog.AlertLevel.ALERT);
                b.setCancelable(false);
                b.setTitle(getContext().getString(R.string.message_warning));
                b.setMessage(getContext().getString(R.string.library_picker_warn_recommended));
                b.setPositiveButton(getContext().getString(R.string.mod_check_continue), this::proceedConfirm);
                b.setNegativeButton(getContext().getString(R.string.button_cancel), null);
                b.create().show();
            } else {
                proceedConfirm();
            }
        }
    }

    private void proceedConfirm() {
        Set<String> actual = new LinkedHashSet<>();
        for (LibraryClassifier.Entry e : classification.getMust()) actual.add(e.getKey());
        for (LibraryClassifier.Entry e : classification.getRecommended()) {
            if (selectedKeys.contains(e.getKey())) actual.add(e.getKey());
        }
        for (LibraryClassifier.Entry e : classification.getOptional()) {
            if (selectedKeys.contains(e.getKey())) actual.add(e.getKey());
        }
        if (store != null) {
            store.saveSelection(versionId, actual);
        }
        callback.onConfirm(actual);
        dismiss();
    }

    public interface Callback {
        /** 用户点击「开始下载」。参数为「用户最终勾选的 key 集合」（MUST 永远包含）。 */
        void onConfirm(Set<String> selectedKeys);

        /** 用户点击「取消」或按返回键取消。 */
        void onCancel();
    }
}
