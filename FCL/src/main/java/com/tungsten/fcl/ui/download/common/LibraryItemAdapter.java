package com.tungsten.fcl.ui.download.common;

import android.content.Context;
import android.content.res.ColorStateList;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CompoundButton;

import com.tungsten.fcl.R;
import com.tungsten.fclcore.download.game.LibraryClassifier;
import com.tungsten.fcllibrary.component.FCLAdapter;
import com.tungsten.fcllibrary.component.view.FCLCheckBox;
import com.tungsten.fcllibrary.component.view.FCLLinearLayout;
import com.tungsten.fcllibrary.component.view.FCLTextView;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 单分类下的 Library 列表 Adapter。
 * MUST 分类强制勾选，不可取消；RECOMMENDED / OPTIONAL 允许用户点击切换。
 */
public class LibraryItemAdapter extends FCLAdapter {

    private final List<LibraryClassifier.Entry> entries;
    private final Set<String> selectedKeys;
    private final CategoryTint tint;
    private final boolean allowToggle;

    /** 某一条的勾选状态发生变化时回调（可用于更新摘要大小）。 */
    private Runnable onSelectionChanged;

    public LibraryItemAdapter(Context context,
                              List<LibraryClassifier.Entry> entries,
                              Set<String> selectedKeys,
                              CategoryTint tint,
                              boolean allowToggle) {
        super(context);
        this.entries = entries == null ? new ArrayList<>() : entries;
        this.selectedKeys = selectedKeys == null ? new HashSet<>() : selectedKeys;
        this.tint = tint;
        this.allowToggle = allowToggle;
    }

    public void setOnSelectionChanged(Runnable r) {
        this.onSelectionChanged = r;
    }

    public int countChecked() {
        int c = 0;
        for (LibraryClassifier.Entry e : entries) {
            if (!e.isAlreadyPresent() && selectedKeys.contains(e.getKey())) c++;
        }
        return c;
    }

    public long bytesChecked() {
        long s = 0;
        for (LibraryClassifier.Entry e : entries) {
            if (!e.isAlreadyPresent() && selectedKeys.contains(e.getKey())) s += Math.max(0, e.getSize());
        }
        return s;
    }

    /** 把本分类下所有可勾选的项全部选中。 */
    public void selectAllToggleable() {
        if (!allowToggle) return;
        for (LibraryClassifier.Entry e : entries) {
            if (!e.isAlreadyPresent()) selectedKeys.add(e.getKey());
        }
        notifyDataSetChanged();
    }

    public void applySelection(Collection<String> keys) {
        // MUST：不受外部 selection 限制，强制勾选
        for (LibraryClassifier.Entry e : entries) {
            if (!allowToggle) {
                selectedKeys.add(e.getKey());
            } else {
                if (keys.contains(e.getKey())) selectedKeys.add(e.getKey());
                else selectedKeys.remove(e.getKey());
            }
        }
        notifyDataSetChanged();
    }

    @Override
    public int getCount() {
        return entries.size();
    }

    @Override
    public Object getItem(int i) {
        return entries.get(i);
    }

    private static class ViewHolder {
        FCLLinearLayout parent;
        View categoryBar;
        FCLCheckBox check;
        FCLTextView name;
        FCLTextView subtitle;
    }

    @Override
    public View getView(int i, View view, ViewGroup viewGroup) {
        final ViewHolder vh;
        if (view == null) {
            vh = new ViewHolder();
            view = LayoutInflater.from(getContext()).inflate(R.layout.item_dependency, null);
            vh.parent = view.findViewById(R.id.parent);
            vh.categoryBar = view.findViewById(R.id.category_bar);
            vh.check = view.findViewById(R.id.check);
            vh.name = view.findViewById(R.id.name);
            vh.subtitle = view.findViewById(R.id.subtitle);
            view.setTag(vh);
        } else {
            vh = (ViewHolder) view.getTag();
        }

        LibraryClassifier.Entry entry = entries.get(i);
        vh.name.setText(entry.getTitle());

        // 分类色块
        vh.categoryBar.setBackgroundColor(tint.barColor);
        vh.categoryBar.setVisibility(View.VISIBLE);

        // 副标题：大小 + （本地已存在）提示
        String sizeText = humanReadableBytes(entry.getSize());
        if (entry.isAlreadyPresent()) {
            vh.subtitle.setText(sizeText + "  " + getContext().getString(R.string.library_picker_hint_present));
            vh.subtitle.setTextColor(getContext().getResources().getColor(R.color.library_present_hint));
        } else {
            vh.subtitle.setText(sizeText);
            // 恢复默认主题色
            vh.subtitle.setTextColor(tint.textColorHint);
        }

        // 勾选状态
        boolean checked;
        if (!allowToggle) {
            // MUST：强制勾选，始终为 true
            checked = true;
            selectedKeys.add(entry.getKey());
        } else {
            checked = selectedKeys.contains(entry.getKey());
        }
        vh.check.setOnCheckedChangeListener(null);
        vh.check.setChecked(checked);

        // 交互：MUST 灰掉；已存在的勾选项虽然显示为选中，但用户一般不需要关心
        boolean interactive = allowToggle && !entry.isAlreadyPresent();
        vh.check.setEnabled(interactive);
        vh.check.setClickable(interactive);

        // CheckBox 按钮色调随分类
        try {
            vh.check.setButtonTintList(ColorStateList.valueOf(tint.barColor));
        } catch (Throwable ignore) {
        }

        vh.check.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                if (!allowToggle) {
                    // 再次兜底，防止手滑
                    if (!buttonView.isChecked()) buttonView.setChecked(true);
                    return;
                }
                if (entry.isAlreadyPresent()) return;
                if (isChecked) selectedKeys.add(entry.getKey());
                else selectedKeys.remove(entry.getKey());
                if (onSelectionChanged != null) {
                    onSelectionChanged.run();
                }
            }
        });

        // 整行点击也可切换（更友好）
        vh.parent.setOnClickListener(v -> {
            if (!allowToggle) return;
            if (entry.isAlreadyPresent()) return;
            boolean now = !selectedKeys.contains(entry.getKey());
            if (now) selectedKeys.add(entry.getKey());
            else selectedKeys.remove(entry.getKey());
            vh.check.setOnCheckedChangeListener(null);
            vh.check.setChecked(now);
            vh.check.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
                @Override
                public void onCheckedChanged(CompoundButton bv, boolean ic) {
                    if (!allowToggle) {
                        if (!bv.isChecked()) bv.setChecked(true);
                        return;
                    }
                    if (entry.isAlreadyPresent()) return;
                    if (ic) selectedKeys.add(entry.getKey());
                    else selectedKeys.remove(entry.getKey());
                    if (onSelectionChanged != null) onSelectionChanged.run();
                }
            });
            if (onSelectionChanged != null) onSelectionChanged.run();
        });

        return view;
    }

    private static String humanReadableBytes(long bytes) {
        if (bytes < 0) bytes = 0;
        if (bytes < 1024) return bytes + " B";
        double v = bytes;
        String[] units = {"KB", "MB", "GB", "TB"};
        int idx = -1;
        do { v /= 1024.0; idx++; } while (v >= 1024 && idx < units.length - 1);
        return String.format(Locale.ROOT, "%.2f %s", v, units[idx]);
    }

    /** 三种分类对应的颜色（从 context 取）。 */
    public static final class CategoryTint {
        public final int barColor;
        public final int textColorHint;

        public CategoryTint(int barColor, int textColorHint) {
            this.barColor = barColor;
            this.textColorHint = textColorHint;
        }
    }
}
