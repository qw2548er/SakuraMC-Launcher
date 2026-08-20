package com.tungsten.fcl.ui.download.common;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CompoundButton;
import android.widget.Filter;
import android.widget.Filterable;
import android.widget.ImageView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.tungsten.fcl.R;
import com.tungsten.fclcore.download.game.LibraryClassifier;
import com.tungsten.fcllibrary.component.view.FCLCheckBox;
import com.tungsten.fcllibrary.component.view.FCLLinearLayout;
import com.tungsten.fcllibrary.component.view.FCLTextView;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 依赖选择对话框的 RecyclerView 统一 Adapter。
 * <p>
 * 数据模型：
 * <pre>
 * [
 *   SectionHeader(MUST, entries=List<Entry>, expanded=true),
 *   EntryItem1(MUST),
 *   EntryItem2(MUST),
 *   ...
 *   SectionHeader(RECOMMENDED, expanded=true),
 *   EntryItem1(RECOMMENDED),
 *   ...
 *   SectionHeader(OPTIONAL, expanded=false),
 *   EntryItem1(OPTIONAL),
 *   ...
 * ]
 * </pre>
 *
 * <p>特性：
 * <ul>
 *   <li>支持 Section 展开/折叠（点击 header 切换）</li>
 *   <li>支持关键词搜索（Filterable），同时过滤出的每组显示 match/max 计数</li>
 *   <li>支持两种排序：名称 / 大小（大→小）</li>
 *   <li>必须依赖勾选禁用，强制选中；副标题展示 Top50 说明（如有）</li>
 * </ul>
 */
public class LibrarySectionedAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> implements Filterable {

    private static final int VIEW_TYPE_SECTION = 1;
    private static final int VIEW_TYPE_ITEM = 2;

    public enum SortMode {
        NAME, SIZE_DESC
    }

    public interface CollapseStateStore {
        boolean isExpanded(LibraryClassifier.Category category);
        void setExpanded(LibraryClassifier.Category category, boolean expanded);
    }

    /** 内存内默认折叠状态：必须/推荐 默认展开，可选 默认折叠。 */
    public static final CollapseStateStore DEFAULT_COLLAPSE = new CollapseStateStore() {
        private final Set<LibraryClassifier.Category> defaults = java.util.EnumSet.of(
                LibraryClassifier.Category.MUST, LibraryClassifier.Category.RECOMMENDED
        );
        private final Map<LibraryClassifier.Category, Boolean> overrides = new HashMap<>();

        @Override
        public boolean isExpanded(LibraryClassifier.Category category) {
            if (overrides.containsKey(category)) return overrides.get(category);
            return defaults.contains(category);
        }

        @Override
        public void setExpanded(LibraryClassifier.Category category, boolean expanded) {
            overrides.put(category, expanded);
        }
    };

    /** SP 文件名前缀与 SP 内 key 前缀。 */
    private static final String SP_COLLAPSE_FILE = "library_picker_collapse";
    private static final String SP_KEY_COLLAPSE_PREFIX = "ver:";

    /**
     * 基于 SharedPreferences 的持久化折叠状态存储；按版本 ID 独立记忆，不串。
     *
     * <p>SP 内存储结构：
     * <pre>
     *   "ver:{versionId}:MUST"        -> true/false
     *   "ver:{versionId}:RECOMMENDED" -> true/false
     *   "ver:{versionId}:OPTIONAL"    -> true/false
     * </pre>
     * 未写入时按默认：MUST/RECOMMENDED 展开，OPTIONAL 折叠。
     */
    public static CollapseStateStore newSpCollapseStore(Context context, String versionId) {
        final Context appCtx = context == null ? null : context.getApplicationContext();
        final String prefix = SP_KEY_COLLAPSE_PREFIX + (versionId == null ? "" : versionId) + ":";
        final Set<LibraryClassifier.Category> defaultExpanded = java.util.EnumSet.of(
                LibraryClassifier.Category.MUST, LibraryClassifier.Category.RECOMMENDED
        );
        return new CollapseStateStore() {
            private SharedPreferences sp() {
                return appCtx == null ? null : appCtx.getSharedPreferences(SP_COLLAPSE_FILE, Context.MODE_PRIVATE);
            }

            @Override
            public boolean isExpanded(LibraryClassifier.Category category) {
                SharedPreferences s = sp();
                if (s == null) return defaultExpanded.contains(category);
                return s.getBoolean(prefix + category.name(), defaultExpanded.contains(category));
            }

            @Override
            public void setExpanded(LibraryClassifier.Category category, boolean expanded) {
                SharedPreferences s = sp();
                if (s == null) return;
                s.edit().putBoolean(prefix + category.name(), expanded).apply();
            }
        };
    }

    private final Context context;
    private final LibraryClassifier.Classification classification;
    private final Set<String> selectedKeys;
    private final Map<String, String> descriptions; // coords -> 说明文案
    private final CollapseStateStore collapseStore;
    private final Runnable summaryUpdater;

    /** 用户当前勾选回调（用于「取消推荐」时弹窗前置检测等外部逻辑）。 */
    private Runnable onSelectionChanged;

    /** 排序模式（默认名称）。 */
    private SortMode sortMode = SortMode.NAME;

    /** 当前可见条目（包含 section 头 + item）。 */
    private final List<Object> flatItems = new ArrayList<>();

    /** 搜索后保留的条目（search 为空时与 flatItems 相同）。 */
    private final List<Object> displayItems = new ArrayList<>();

    private final Map<LibraryClassifier.Category, LibraryItemAdapter.CategoryTint> tints = new LinkedHashMap<>();

    public LibrarySectionedAdapter(Context context,
                                   LibraryClassifier.Classification classification,
                                   Set<String> selectedKeys,
                                   Map<String, String> descriptions,
                                   CollapseStateStore collapseStore,
                                   Runnable summaryUpdater) {
        this.context = context;
        this.classification = classification;
        this.selectedKeys = selectedKeys;
        this.descriptions = descriptions == null ? Collections.emptyMap() : descriptions;
        this.collapseStore = collapseStore == null ? DEFAULT_COLLAPSE : collapseStore;
        this.summaryUpdater = summaryUpdater;
        initTints();
        rebuild();
    }

    public void setOnSelectionChanged(Runnable r) { this.onSelectionChanged = r; }

    public SortMode getSortMode() { return sortMode; }
    public void setSortMode(SortMode mode) {
        if (this.sortMode == mode) return;
        this.sortMode = mode;
        rebuild();
    }

    /** 重建全部条目（排序/选择变化时调用）。 */
    public void rebuild() {
        flatItems.clear();
        List<LibraryClassifier.Entry> must = sortEntries(classification.getMust());
        List<LibraryClassifier.Entry> rec = sortEntries(classification.getRecommended());
        List<LibraryClassifier.Entry> opt = sortEntries(classification.getOptional());
        for (LibraryClassifier.Category cat : Arrays.asList(
                LibraryClassifier.Category.MUST,
                LibraryClassifier.Category.RECOMMENDED,
                LibraryClassifier.Category.OPTIONAL
        )) {
            List<LibraryClassifier.Entry> list;
            if (cat == LibraryClassifier.Category.MUST) list = must;
            else if (cat == LibraryClassifier.Category.RECOMMENDED) list = rec;
            else list = opt;
            flatItems.add(new SectionHeader(cat, list));
            if (collapseStore.isExpanded(cat)) {
                for (LibraryClassifier.Entry e : list) flatItems.add(new EntryItem(cat, e));
            }
        }
        // 当前没有正在搜索，直接把 flatItems 作为显示列表
        if (lastConstraint == null || lastConstraint.isEmpty()) {
            displayItems.clear();
            displayItems.addAll(flatItems);
        } else {
            filter.filter(lastConstraint);
            return;
        }
        notifyDataSetChanged();
    }

    /** 一键推荐：强制选中所有「推荐依赖（未存在）」。 */
    public void selectAllRecommendedToggleable() {
        for (LibraryClassifier.Entry e : classification.getRecommended()) {
            if (!e.isAlreadyPresent()) selectedKeys.add(e.getKey());
        }
        rebuild();
        fireSelectionChanged();
    }

    /** 一键精简：只保留 MUST（+ 已存在不算在内）。 */
    public void applyMinimalSelection() {
        Set<String> minimal = classification.minimalSelection();
        applySelection(minimal);
    }

    /** 恢复默认选择（MUST + 推荐 未存在）。 */
    public void applyDefaultSelection() {
        applySelection(classification.defaultSelection());
    }

    /** 按给定 keys 刷新勾选（MUST 强制保留）。 */
    public void applySelection(Collection<String> keys) {
        for (LibraryClassifier.Entry e : classification.getMust()) {
            selectedKeys.add(e.getKey());
        }
        for (LibraryClassifier.Entry e : classification.getRecommended()) {
            if (keys.contains(e.getKey())) selectedKeys.add(e.getKey());
            else selectedKeys.remove(e.getKey());
        }
        for (LibraryClassifier.Entry e : classification.getOptional()) {
            if (keys.contains(e.getKey())) selectedKeys.add(e.getKey());
            else selectedKeys.remove(e.getKey());
        }
        rebuild();
        fireSelectionChanged();
    }

    // ------- Filterable -------

    private final SearchFilter filter = new SearchFilter();
    private CharSequence lastConstraint = "";

    /** 200ms 搜索防抖：避免低端机上逐字全量遍历造成掉帧。 */
    private final Handler searchHandler = new Handler(Looper.getMainLooper());
    private final Runnable searchRunnable = () -> filter.filter(lastConstraint);

    @Override
    public Filter getFilter() { return filter; }

    public void setQuery(CharSequence q) {
        lastConstraint = q == null ? "" : q;
        searchHandler.removeCallbacks(searchRunnable);
        searchHandler.postDelayed(searchRunnable, 200);
    }

    // ------- RecyclerView.Adapter -------

    @Override
    public int getItemViewType(int position) {
        Object o = displayItems.get(position);
        return (o instanceof SectionHeader) ? VIEW_TYPE_SECTION : VIEW_TYPE_ITEM;
    }

    @Override
    public int getItemCount() { return displayItems.size(); }

    @NonNull
    @Override
    public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        if (viewType == VIEW_TYPE_SECTION) {
            View v = LayoutInflater.from(context).inflate(R.layout.item_dependency_section, parent, false);
            return new SectionVH(v);
        }
        View v = LayoutInflater.from(context).inflate(R.layout.item_dependency, parent, false);
        return new ItemVH(v);
    }

    @Override
    public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int position) {
        Object o = displayItems.get(position);
        if (holder instanceof SectionVH) bindSection((SectionVH) holder, (SectionHeader) o);
        else bindItem((ItemVH) holder, (EntryItem) o);
    }

    private void bindSection(SectionVH vh, SectionHeader sh) {
        LibraryClassifier.Category cat = sh.category;
        LibraryItemAdapter.CategoryTint tint = tints.get(cat);

        vh.title.setText(sectionTitle(cat));
        vh.title.setTextColor(tint.barColor);
        try {
            vh.badge.getBackground().setTint(tint.barColor);
        } catch (Throwable ignore) {}

        int countTotal = sh.allEntries.size();
        long bytesTotal = 0L;
        int countChecked = 0;
        long bytesChecked = 0L;
        long bytesPresent = 0L;
        for (LibraryClassifier.Entry e : sh.allEntries) {
            bytesTotal += Math.max(0, e.getSize());
            if (e.isAlreadyPresent()) {
                bytesPresent += Math.max(0, e.getSize());
                continue;
            }
            if (selectedKeys.contains(e.getKey())) {
                countChecked++;
                bytesChecked += Math.max(0, e.getSize());
            }
        }
        String summary = context.getString(R.string.library_picker_section_summary,
                countChecked, countTotal,
                LibraryClassifier.humanReadableBytes(bytesPresent),
                LibraryClassifier.humanReadableBytes(bytesChecked));
        vh.summary.setText(summary);
        vh.summary.setTextColor(tint.textColorHint);

        boolean expanded = collapseStore.isExpanded(cat);
        vh.expandIcon.setRotation(expanded ? 0f : 180f); // up → down
        vh.itemView.setOnClickListener(v -> {
            boolean now = !collapseStore.isExpanded(cat);
            collapseStore.setExpanded(cat, now);
            vh.expandIcon.animate().rotation(now ? 0f : 180f).start();
            // 就地增删 items 而不是整个列表 rebuild，动画更顺
            if (now) {
                int idx = displayItems.indexOf(sh);
                int insert = idx + 1;
                for (LibraryClassifier.Entry e : sh.allEntries) {
                    if (searchAccepts(e, lastConstraint)) {
                        displayItems.add(insert++, new EntryItem(cat, e));
                    }
                }
                notifyItemRangeInserted(idx + 1, insert - (idx + 1));
            } else {
                int idx = displayItems.indexOf(sh);
                int from = idx + 1, to = from;
                while (to < displayItems.size() && displayItems.get(to) instanceof EntryItem
                        && ((EntryItem) displayItems.get(to)).category == cat) to++;
                if (to > from) {
                    for (int i = to - 1; i >= from; i--) displayItems.remove(i);
                    notifyItemRangeRemoved(from, to - from);
                }
            }
        });
    }

    private void bindItem(ItemVH vh, EntryItem item) {
        LibraryClassifier.Entry entry = item.entry;
        LibraryItemAdapter.CategoryTint tint = tints.get(item.category);
        boolean allowToggle = item.category != LibraryClassifier.Category.MUST;

        vh.name.setText(entry.getTitle());
        vh.categoryBar.setBackgroundColor(tint.barColor);
        vh.categoryBar.setVisibility(View.VISIBLE);

        String sizeText = LibraryClassifier.humanReadableBytes(entry.getSize());
        String desc = descriptions.get(entry.getLibrary().getGroupId() + ":" + entry.getLibrary().getArtifactId());
        StringBuilder sb = new StringBuilder();
        sb.append(sizeText);
        if (!TextUtils.isEmpty(desc)) {
            sb.append("  ·  ").append(desc);
        }
        if (entry.isAlreadyPresent()) {
            sb.append("  · ").append(context.getString(R.string.library_picker_hint_present));
            vh.subtitle.setTextColor(context.getResources().getColor(R.color.library_present_hint));
        } else {
            vh.subtitle.setTextColor(tint.textColorHint);
        }
        vh.subtitle.setMaxLines(2);
        vh.subtitle.setEllipsize(TextUtils.TruncateAt.END);
        vh.subtitle.setText(sb.toString());

        // 勾选状态
        boolean checked;
        if (!allowToggle) {
            checked = true;
            selectedKeys.add(entry.getKey());
        } else {
            checked = selectedKeys.contains(entry.getKey());
        }
        vh.check.setOnCheckedChangeListener(null);
        vh.check.setChecked(checked);

        boolean interactive = allowToggle && !entry.isAlreadyPresent();
        vh.check.setEnabled(interactive);
        vh.check.setClickable(interactive);

        try {
            vh.check.setButtonTintList(ColorStateList.valueOf(tint.barColor));
        } catch (Throwable ignore) {}

        CompoundButton.OnCheckedChangeListener checkListener = new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                if (!allowToggle) {
                    if (!buttonView.isChecked()) buttonView.setChecked(true);
                    return;
                }
                if (entry.isAlreadyPresent()) return;
                if (isChecked) selectedKeys.add(entry.getKey());
                else selectedKeys.remove(entry.getKey());
                // 勾选变化需要同步刷新对应 Section 的 Summary
                invalidateSectionSummary(item.category);
                fireSelectionChanged();
            }
        };
        vh.check.setOnCheckedChangeListener(checkListener);

        vh.parent.setOnClickListener(v -> {
            if (!allowToggle) return;
            if (entry.isAlreadyPresent()) return;
            boolean now = !selectedKeys.contains(entry.getKey());
            if (now) selectedKeys.add(entry.getKey());
            else selectedKeys.remove(entry.getKey());
            vh.check.setOnCheckedChangeListener(null);
            vh.check.setChecked(now);
            vh.check.setOnCheckedChangeListener(checkListener);
            invalidateSectionSummary(item.category);
            fireSelectionChanged();
        });
    }

    /** 只刷新对应 section 头的 summary 文字（避免整个列表动画重置）。 */
    private void invalidateSectionSummary(LibraryClassifier.Category cat) {
        int n = displayItems.size();
        for (int i = 0; i < n; i++) {
            Object o = displayItems.get(i);
            if (o instanceof SectionHeader && ((SectionHeader) o).category == cat) {
                notifyItemChanged(i);
                break;
            }
        }
    }

    private void fireSelectionChanged() {
        if (onSelectionChanged != null) onSelectionChanged.run();
        if (summaryUpdater != null) summaryUpdater.run();
    }

    // ------- Utils -------

    private void initTints() {
        tints.put(LibraryClassifier.Category.MUST, new LibraryItemAdapter.CategoryTint(
                context.getResources().getColor(R.color.library_must_tint),
                context.getResources().getColor(R.color.primary_text)));
        tints.put(LibraryClassifier.Category.RECOMMENDED, new LibraryItemAdapter.CategoryTint(
                context.getResources().getColor(R.color.library_recommended_tint),
                context.getResources().getColor(R.color.primary_text)));
        tints.put(LibraryClassifier.Category.OPTIONAL, new LibraryItemAdapter.CategoryTint(
                context.getResources().getColor(R.color.library_optional_tint),
                context.getResources().getColor(R.color.primary_text)));
    }

    private List<LibraryClassifier.Entry> sortEntries(List<LibraryClassifier.Entry> entries) {
        List<LibraryClassifier.Entry> copy = new ArrayList<>(entries);
        if (sortMode == SortMode.SIZE_DESC) {
            copy.sort(Comparator.comparingLong((LibraryClassifier.Entry e) -> Math.max(0L, e.getSize())).reversed()
                    .thenComparing(LibraryClassifier.Entry::getTitle, String.CASE_INSENSITIVE_ORDER));
        } else {
            copy.sort(Comparator.comparing(LibraryClassifier.Entry::getTitle, String.CASE_INSENSITIVE_ORDER));
        }
        return copy;
    }

    private String sectionTitle(LibraryClassifier.Category cat) {
        if (cat == LibraryClassifier.Category.MUST)
            return context.getString(R.string.library_picker_category_must_line);
        if (cat == LibraryClassifier.Category.RECOMMENDED)
            return context.getString(R.string.library_picker_category_recommended_line);
        return context.getString(R.string.library_picker_category_optional_line);
    }

    private boolean searchAccepts(LibraryClassifier.Entry entry, CharSequence constraint) {
        if (constraint == null || constraint.length() == 0) return true;
        String q = constraint.toString().toLowerCase(Locale.ROOT).trim();
        if (q.isEmpty()) return true;
        String title = entry.getTitle().toLowerCase(Locale.ROOT);
        if (title.contains(q)) return true;
        String key = entry.getLibrary().getGroupId() + ":" + entry.getLibrary().getArtifactId();
        if (key.toLowerCase(Locale.ROOT).contains(q)) return true;
        String desc = descriptions.get(key);
        if (desc != null && desc.toLowerCase(Locale.ROOT).contains(q)) return true;
        return false;
    }

    // ------- Inner data objects -------

    static final class SectionHeader {
        final LibraryClassifier.Category category;
        final List<LibraryClassifier.Entry> allEntries;
        SectionHeader(LibraryClassifier.Category category, List<LibraryClassifier.Entry> allEntries) {
            this.category = category;
            this.allEntries = allEntries;
        }
    }

    static final class EntryItem {
        final LibraryClassifier.Category category;
        final LibraryClassifier.Entry entry;
        EntryItem(LibraryClassifier.Category category, LibraryClassifier.Entry entry) {
            this.category = category;
            this.entry = entry;
        }
    }

    // ------- ViewHolders -------

    static final class SectionVH extends RecyclerView.ViewHolder {
        final ImageView expandIcon;
        final ImageView badge;
        final FCLTextView title;
        final FCLTextView summary;

        SectionVH(View v) {
            super(v);
            expandIcon = v.findViewById(R.id.expand_icon);
            badge = v.findViewById(R.id.category_badge);
            title = v.findViewById(R.id.section_title);
            summary = v.findViewById(R.id.section_summary);
        }
    }

    static final class ItemVH extends RecyclerView.ViewHolder {
        final FCLLinearLayout parent;
        final View categoryBar;
        final FCLCheckBox check;
        final FCLTextView name;
        final FCLTextView subtitle;

        ItemVH(View v) {
            super(v);
            parent = v.findViewById(R.id.parent);
            categoryBar = v.findViewById(R.id.category_bar);
            check = v.findViewById(R.id.check);
            name = v.findViewById(R.id.name);
            subtitle = v.findViewById(R.id.subtitle);
        }
    }

    // ------- Search Filter -------

    private final class SearchFilter extends Filter {

        @Override
        protected FilterResults performFiltering(CharSequence constraint) {
            String c = constraint == null ? "" : constraint.toString().toLowerCase(Locale.ROOT).trim();
            FilterResults r = new FilterResults();
            List<Object> out = new ArrayList<>();
            for (Object o : flatItems) {
                if (o instanceof SectionHeader) {
                    SectionHeader sh = (SectionHeader) o;
                    // Section 头：仅在「该分类下至少一个 item 命中 q」时才保留
                    boolean any = false;
                    for (LibraryClassifier.Entry e : sh.allEntries) {
                        if (searchAccepts(e, c)) { any = true; break; }
                    }
                    if (any) {
                        out.add(sh);
                        if (collapseStore.isExpanded(sh.category)) {
                            for (LibraryClassifier.Entry e : sh.allEntries) {
                                if (searchAccepts(e, c)) out.add(new EntryItem(sh.category, e));
                            }
                        }
                    }
                }
            }
            r.values = out;
            r.count = out.size();
            return r;
        }

        @SuppressWarnings("unchecked")
        @Override
        protected void publishResults(CharSequence constraint, FilterResults results) {
            displayItems.clear();
            displayItems.addAll((List<Object>) results.values);
            notifyDataSetChanged();
        }
    }
}
