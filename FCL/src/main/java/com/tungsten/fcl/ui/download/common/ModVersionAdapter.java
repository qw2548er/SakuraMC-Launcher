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
import com.tungsten.fclcore.mod.LocalMod;
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
import com.tungsten.fcllibrary.component.view.FCLCheckBox;
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
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class ModVersionAdapter extends FCLAdapter {

    private final List<RemoteMod.Version> list;
    private final Callback callback;

    /**
     * 用户明确选择"跳过 / 不再提示"的下载项主键集合。
     * 用于避免失败弹窗"追着用户跑"：一旦某个失败项被加入到这里，
     * 在当前 Adapter 生命周期内，它不会再被算进失败重试对话中。
     */
    private final Set<String> permanentlyDismissedKeys = Collections.newSetFromMap(new ConcurrentHashMap<>());

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
                .setCancelable(true)
                .setPositiveButton(getContext().getString(R.string.mods_one_click_loader_mismatch_continue), (FCLAlertDialog.ButtonListener) onContinue::run)
                .setNegativeButton(getContext().getString(R.string.mods_one_click_loader_mismatch_cancel), (FCLAlertDialog.ButtonListener) () -> {
                    Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                })
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
                        showPlanDiagnosticIfNeeded(plan);
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

    private void showPlanDiagnosticIfNeeded(PlanResult plan) {
        if (plan.unresolvedDependencies == null || plan.unresolvedDependencies.isEmpty()) return;
        StringBuilder sb = new StringBuilder();
        int cap = Math.min(plan.unresolvedDependencies.size(), 5);
        for (int i = 0; i < cap; i++) {
            UnresolvedDependency ud = plan.unresolvedDependencies.get(i);
            sb.append("• ").append(ud.displayName);
            if (ud.reason != null) sb.append("（").append(ud.reason).append("）");
            sb.append("\n");
        }
        if (plan.unresolvedDependencies.size() > cap) {
            sb.append("... (").append(plan.unresolvedDependencies.size() - cap).append(" more)");
        }
        Toast.makeText(getContext(),
                getContext().getString(R.string.mods_one_click_plan_unresolved, plan.unresolvedDependencies.size(), sb.toString()),
                Toast.LENGTH_LONG).show();
    }

    private void showPlanDialog(PlanResult plan, RemoteMod.Version version) {
        final LayoutInflater inflater = LayoutInflater.from(getContext());

        // 1) Build a virtual "checkbox list" inside the dialog via FCLTextView + dynamic CheckBox children attached to scrollView.
        // Since FCLAlertDialog only exposes a text message, we build an editable View tree using a new LinearLayout and insert it into scrollView.
        final FCLAlertDialog dialog = new FCLAlertDialog.Builder(getContext())
                .setAlertLevel(FCLAlertDialog.AlertLevel.INFO)
                .setCancelable(true)
                .setTitle(getContext().getString(R.string.mods_one_click_plan_title))
                .setMessage("")
                .create();

        dialog.show();

        android.widget.ScrollView scrollView = dialog.findViewById(R.id.text_scroll);
        if (scrollView == null) {
            Toast.makeText(getContext(), "Cannot find scroll view in FCLAlertDialog, fallback to plain text", Toast.LENGTH_SHORT).show();
            showPlanDialogLegacy(plan, version);
            dialog.dismiss();
            return;
        }
        // If scrollView is filled with an FCLTextView by default, replace its content with a fresh LinearLayout (keep children of scrollView to 1)
        scrollView.removeAllViews();
        androidx.appcompat.widget.LinearLayoutCompat root = new androidx.appcompat.widget.LinearLayoutCompat(getContext());
        root.setOrientation(androidx.appcompat.widget.LinearLayoutCompat.VERTICAL);
        int padH = (int) android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 4, getContext().getResources().getDisplayMetrics());
        int padV = (int) android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 6, getContext().getResources().getDisplayMetrics());
        root.setPadding(padH, padV, padH, padV);

        // ① Banner
        FCLTextView banner = new FCLTextView(getContext());
        banner.setTextSize(12);
        banner.setText(getContext().getString(R.string.mods_one_click_relation_banner,
                plan.scannedNodeCount,
                StringUtils.isBlank(plan.gameVersion) ? "(unknown)" : plan.gameVersion,
                plan.matchedCount, plan.unmatchedCount,
                plan.maxDepthReached, plan.duplicatedNodeCount));
        banner.setLineSpacing(1.1f, 1.1f);
        root.addView(banner, new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // ② Summary line (file count + size)
        StringBuilder summarySb = new StringBuilder();
        summarySb.append(getContext().getString(R.string.mods_one_click_plan_summary,
                plan.downloadingCount, formatSize(plan.totalBytesEstimate)));
        if (plan.looseMatchedCount > 0) {
            summarySb.append("\n")
                    .append(getContext().getString(R.string.mods_one_click_plan_loose_matched, plan.looseMatchedCount));
        }
        FCLTextView summary = new FCLTextView(getContext());
        summary.setTextSize(12);
        summary.setText(summarySb.toString());
        androidx.appcompat.widget.LinearLayoutCompat.LayoutParams sLp = new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sLp.topMargin = padV;
        root.addView(summary, sLp);

        // ③ Matched PlanItem list (each row: checkbox + name + size + match badge + local hit)
        final ArrayList<PlanItem> matchedItemsList = new ArrayList<>(plan.items);
        final FCLCheckBox[] checkBoxes = new FCLCheckBox[matchedItemsList.size()];
        final Set<String> userDeselected = ConcurrentHashMap.newKeySet();
        for (int i = 0; i < matchedItemsList.size(); i++) {
            PlanItem item = matchedItemsList.get(i);
            androidx.appcompat.widget.LinearLayoutCompat row = new androidx.appcompat.widget.LinearLayoutCompat(getContext());
            row.setOrientation(androidx.appcompat.widget.LinearLayoutCompat.HORIZONTAL);
            androidx.appcompat.widget.LinearLayoutCompat.LayoutParams rowLp = new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rowLp.topMargin = padV;
            rowLp.bottomMargin = padV;
            row.setLayoutParams(rowLp);

            FCLCheckBox cb = new FCLCheckBox(getContext());
            cb.setChecked(item.defaultChecked);
            cb.setEnabled(!item.lockedCheck);
            checkBoxes[i] = cb;
            final int idx = i;
            cb.setOnCheckedChangeListener((buttonView, isChecked) -> {
                PlanItem pi = matchedItemsList.get(idx);
                if (pi == null) return;
                if (isChecked) userDeselected.remove(pi.id);
                else userDeselected.add(pi.id);
            });
            androidx.appcompat.widget.LinearLayoutCompat.LayoutParams cbLp = new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            cbLp.gravity = android.view.Gravity.CENTER_VERTICAL;
            row.addView(cb, cbLp);

            androidx.appcompat.widget.LinearLayoutCompat textCol = new androidx.appcompat.widget.LinearLayoutCompat(getContext());
            textCol.setOrientation(androidx.appcompat.widget.LinearLayoutCompat.VERTICAL);
            androidx.appcompat.widget.LinearLayoutCompat.LayoutParams tcLp = new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                    0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
            tcLp.leftMargin = padH;
            tcLp.gravity = android.view.Gravity.CENTER_VERTICAL;

            FCLTextView nameLine = new FCLTextView(getContext());
            nameLine.setTextSize(13);
            StringBuilder nm = new StringBuilder();
            if (item.isModItself) {
                nm.append("【").append(getContext().getString(R.string.mods_one_click_mod_itself_badge)).append("】");
            } else {
                switch (item.dependencyType) {
                    case REQUIRED: nm.append("【必须】"); break;
                    case TOOL: nm.append("【工具/前置】"); break;
                    case OPTIONAL: nm.append("【可选】"); break;
                    default: nm.append("【依赖】"); break;
                }
            }
            nm.append(item.displayName).append(" ").append(formatSize(item.sizeBytes));
            nameLine.setText(nm.toString());
            textCol.addView(nameLine, new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            FCLTextView subLine = new FCLTextView(getContext());
            subLine.setTextSize(11);
            StringBuilder sub = new StringBuilder();
            if (item.isModItself) {
                sub.append(version == null ? "" :
                        getContext().getString(R.string.mods_one_click_matched_badge,
                                version.getGameVersions() == null ? "-" : version.getGameVersions().toString(),
                                version.getLoaders() == null ? "-" : version.getLoaders().toString()));
            } else {
                if (item.looseMatched) {
                    sub.append(getContext().getString(R.string.mods_one_click_loose_badge,
                            StringUtils.isBlank(item.targetGameVersion) ? "-" : item.targetGameVersion,
                            StringUtils.isBlank(item.loaderBadge) ? "-" : item.loaderBadge));
                } else if (item.isMatched) {
                    sub.append(getContext().getString(R.string.mods_one_click_matched_badge,
                            StringUtils.isBlank(item.targetGameVersion) ? "-" : item.targetGameVersion,
                            StringUtils.isBlank(item.loaderBadge) ? "-" : item.loaderBadge));
                } else {
                    sub.append(getContext().getString(R.string.mods_one_click_unmatched_badge,
                            StringUtils.isBlank(item.targetGameVersion) ? "-" : item.targetGameVersion));
                }
            }
            if (item.localHit) sub.append("  |  ").append(getContext().getString(R.string.mods_one_click_plan_item_local_hit));
            subLine.setText(sub.toString());
            textCol.addView(subLine, new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            row.addView(textCol, tcLp);
            root.addView(row);
        }

        // ④ Unmatched dependencies section
        if (plan.unresolvedDependencies != null && !plan.unresolvedDependencies.isEmpty()) {
            FCLTextView umTitle = new FCLTextView(getContext());
            umTitle.setTextSize(12);
            androidx.appcompat.widget.LinearLayoutCompat.LayoutParams umTlp = new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            umTlp.topMargin = padV * 2;
            umTitle.setText(getContext().getString(R.string.mods_one_click_unmatched_section));
            root.addView(umTitle, umTlp);

            for (UnresolvedDependency ud : plan.unresolvedDependencies) {
                FCLTextView line = new FCLTextView(getContext());
                line.setTextSize(11);
                StringBuilder sb = new StringBuilder();
                sb.append("• ").append(ud.displayName);
                if (ud.dependencyType != null) {
                    switch (ud.dependencyType) {
                        case REQUIRED: sb.append("（必须）"); break;
                        case TOOL: sb.append("（工具/前置）"); break;
                        case OPTIONAL: sb.append("（可选）"); break;
                        default: break;
                    }
                }
                if (ud.targetGameVersion != null) {
                    sb.append(" — ").append(getContext().getString(R.string.mods_one_click_unmatched_badge, ud.targetGameVersion));
                }
                if (ud.reason != null) sb.append(" — ").append(ud.reason);
                line.setText(sb.toString());
                androidx.appcompat.widget.LinearLayoutCompat.LayoutParams lLp = new androidx.appcompat.widget.LinearLayoutCompat.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lLp.topMargin = padV / 2;
                root.addView(line, lLp);
            }
        }

        scrollView.addView(root, new android.view.ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Re-trigger the height check of FCLAlertDialog so it grows
        try {
            java.lang.reflect.Method m = FCLAlertDialog.class.getDeclaredMethod("checkHeight");
            m.setAccessible(true);
            m.invoke(dialog);
        } catch (Throwable ignore) {
            android.view.Window win = dialog.getWindow();
            if (win != null) {
                android.view.WindowManager.LayoutParams lp = win.getAttributes();
                lp.height = android.view.WindowManager.LayoutParams.WRAP_CONTENT;
                win.setAttributes(lp);
            }
        }

        // Re-configure buttons (default dialog already has 3 empty buttons; we need to re-set them with 4-button layout, but Alert only supports 4 via extra/neutral/positive/negative)
        dialog.setPositiveButton(getContext().getString(R.string.mods_one_click_btn_confirm_download), () -> {
            java.util.function.Predicate<PlanItem> filter = it -> {
                if (it.lockedCheck) return true; // REQUIRED/TOOL/mod itself always proceed
                if (userDeselected.contains(it.id)) return false;
                return checkBoxes[matchedItemsList.indexOf(it)].isChecked();
            };
            PlanResult filtered = PlanResult.ofFiltered(plan, filter);
            actuallyExecuteFlow(filtered, version);
        });
        dialog.setNeutralButton(getContext().getString(R.string.mods_one_click_btn_only_required), () -> {
            PlanResult filtered = PlanResult.ofFiltered(plan, it ->
                    it.isModItself || it.dependencyType == RemoteMod.DependencyType.REQUIRED || it.dependencyType == RemoteMod.DependencyType.TOOL);
            actuallyExecuteFlow(filtered, version);
        });
        dialog.setNegativeButton(getContext().getString(R.string.button_cancel), () -> {
            Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
        });
    }

    private void showPlanDialogLegacy(PlanResult plan, RemoteMod.Version version) {
        StringBuilder sb = new StringBuilder();
        sb.append(getContext().getString(R.string.mods_one_click_plan_summary,
                plan.downloadingCount, formatSize(plan.totalBytesEstimate)));
        if (plan.looseMatchedCount > 0) {
            sb.append("\n")
                    .append(getContext().getString(R.string.mods_one_click_plan_loose_matched, plan.looseMatchedCount));
        }
        sb.append("\n\n");
        for (PlanItem item : plan.items) {
            if (item.isModItself) {
                sb.append("• ")
                        .append(getContext().getString(R.string.mods_one_click_plan_item_mod, item.displayName, formatSize(item.sizeBytes)));
            } else {
                sb.append("• ")
                        .append(getContext().getString(R.string.mods_one_click_plan_item_dep, item.displayName, formatSize(item.sizeBytes)));
                if (item.looseMatched) {
                    sb.append(" — ").append(getContext().getString(R.string.mods_one_click_plan_item_loose_match));
                }
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
                .setCancelable(true)
                .setPositiveButton(getContext().getString(R.string.mods_one_click_btn_confirm_download), (FCLAlertDialog.ButtonListener) () -> actuallyExecuteFlow(plan, version))
                .setNeutralButton(getContext().getString(R.string.mods_one_click_btn_only_required), (FCLAlertDialog.ButtonListener) () -> {
                    PlanResult filtered = PlanResult.ofFiltered(plan, it ->
                            it.isModItself || it.dependencyType == RemoteMod.DependencyType.REQUIRED || it.dependencyType == RemoteMod.DependencyType.TOOL);
                    actuallyExecuteFlow(filtered, version);
                })
                .setNegativeButton(getContext().getString(R.string.button_cancel), (FCLAlertDialog.ButtonListener) () -> {
                    Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                })
                .create()
                .show();
    }

    private void actuallyExecuteFlow(PlanResult plan, RemoteMod.Version version) {
        if (plan.items == null || plan.items.isEmpty()) {
            Toast.makeText(getContext(), getContext().getString(R.string.mods_dependency_none_required), Toast.LENGTH_SHORT).show();
            return;
        }
        ConflictCheckResult conflicts = findConflicts(plan);
        if (conflicts.hasConflict()) {
            showConflictDialog(conflicts, () -> actuallyExecutePlan(plan, version, true));
        } else {
            actuallyExecutePlan(plan, version, false);
        }
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
                .setCancelable(true)
                .setPositiveButton(getContext().getString(R.string.mods_one_click_conflict_action_remove), (FCLAlertDialog.ButtonListener) onRemoveOldAndContinue::run)
                .setNegativeButton(getContext().getString(R.string.mods_one_click_conflict_action_keep), (FCLAlertDialog.ButtonListener) () -> actuallyExecutePlan(PlanResult.ofFiltered(conflicts.plan, item -> true), null, false))
                .setNeutralButton(getContext().getString(R.string.button_cancel), (FCLAlertDialog.ButtonListener) () -> {
                    Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                })
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
        List<PlanItem> itemsToDownload = plan.items.stream()
                .filter(it -> !it.localHit && it.task != null)
                .collect(Collectors.toList());
        if (itemsToDownload.isEmpty()) {
            Toast.makeText(getContext(), getContext().getString(R.string.install_success), Toast.LENGTH_SHORT).show();
            refreshModList();
            return;
        }
        runExecute(itemsToDownload, new HashSet<>(), version);
    }

    private void runExecute(List<PlanItem> items, Set<String> alreadyRetriedFailedNames, RemoteMod.Version version) {
        // 先过滤掉用户明确选择"跳过本次 / 不再提示"的失败项，避免被反复纠缠
        List<PlanItem> filteredItems = items.stream()
                .filter(it -> !permanentlyDismissedKeys.contains(it.id))
                .collect(Collectors.toList());
        if (filteredItems.isEmpty()) {
            Toast.makeText(getContext(), getContext().getString(R.string.mods_one_click_retry_all_skipped), Toast.LENGTH_SHORT).show();
            refreshModList();
            return;
        }

        List<FileDownloadTask> tasks = filteredItems.stream()
                .map(it -> it.task)
                .collect(Collectors.toList());
        TaskDialog taskDialog = new TaskDialog(getContext(), new TaskCancellationAction(AppCompatDialog::dismiss));
        taskDialog.setTitle(getContext().getString(R.string.message_downloading));
        Schedulers.androidUIThread().execute(() -> {
            AtomicInteger failedCount = new AtomicInteger(0);
            TaskExecutor executor = Task.allOf(tasks.toArray(new Task<?>[0]))
                    .whenComplete(Schedulers.androidUIThread(), (v, exception) -> {
                        if (exception != null) {
                            if (exception instanceof CancellationException) {
                                Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                                return;
                            }
                        }
                        // Track failures by matching PlanItem index with task index
                        int actualFailed = 0;
                        List<String> failedNames = new ArrayList<>();
                        List<PlanItem> failedItems = new ArrayList<>();
                        for (int i = 0; i < filteredItems.size(); i++) {
                            PlanItem pi = filteredItems.get(i);
                            FileDownloadTask t = tasks.get(i);
                            if (t != null && t.getException() != null) {
                                actualFailed++;
                                String nm = StringUtils.isBlank(t.getName()) ? pi.displayName : t.getName();
                                failedNames.add(nm);
                                failedItems.add(pi);
                            }
                        }
                        if (actualFailed == 0) {
                            Toast.makeText(getContext(), getContext().getString(R.string.install_success), Toast.LENGTH_SHORT).show();
                            refreshModList();
                            return;
                        }
                        int total = filteredItems.size();
                        List<String> toRetryNames = new ArrayList<>();
                        List<PlanItem> retryItems = new ArrayList<>();
                        Set<String> newRetriedSet = new HashSet<>(alreadyRetriedFailedNames);
                        for (PlanItem pi : failedItems) {
                            String key = pi.id;
                            toRetryNames.add(pi.displayName);
                            if (!newRetriedSet.contains(key)) {
                                retryItems.add(recreateItem(pi));
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
                        final List<PlanItem> finalRetryItems = retryItems;
                        final Set<String> finalFailedKeys = failedItems.stream()
                                .map(fi -> fi.id)
                                .collect(Collectors.toCollection(LinkedHashSet::new));
                        new FCLAlertDialog.Builder(getContext())
                                .setAlertLevel(FCLAlertDialog.AlertLevel.ALERT)
                                .setTitle(getContext().getString(R.string.install_failed))
                                .setMessage(msg.toString())
                                .setCancelable(true)
                                .setPositiveButton(getContext().getString(R.string.mods_one_click_retry_failed, finalActualFailed), (FCLAlertDialog.ButtonListener) () -> {
                                    if (finalRetryItems.isEmpty()) {
                                        Toast.makeText(getContext(), getContext().getString(R.string.message_cancelled), Toast.LENGTH_SHORT).show();
                                        return;
                                    }
                                    newRetriedSet.addAll(failedItems.stream().map(i -> i.id).collect(Collectors.toSet()));
                                    runExecute(finalRetryItems, newRetriedSet, version);
                                })
                                .setNegativeButton(getContext().getString(R.string.mods_one_click_retry_all), (FCLAlertDialog.ButtonListener) () -> {
                                    Set<String> empty = new HashSet<>();
                                    List<PlanItem> fresh = filteredItems.stream().map(this::recreateItem).collect(Collectors.toList());
                                    runExecute(fresh, empty, version);
                                })
                                .setNeutralButton(getContext().getString(R.string.mods_one_click_retry_skip), (FCLAlertDialog.ButtonListener) () -> {
                                    permanentlyDismissedKeys.addAll(finalFailedKeys);
                                    Toast.makeText(getContext(), getContext().getString(R.string.mods_one_click_retry_skip_ok, finalFailedKeys.size()), Toast.LENGTH_SHORT).show();
                                })
                                .create()
                                .show();
                    }).executor();
            taskDialog.setExecutor(executor);
            taskDialog.show();
            executor.start();
        });
    }

    private PlanItem recreateItem(PlanItem origin) {
        FileDownloadTask newTask = null;
        if (!origin.localHit) {
            try {
                RemoteMod.File remoteFile = origin.remoteFileSnapshot;
                if (remoteFile != null) {
                    newTask = new FileDownloadTask(
                            NetworkUtils.toURL(remoteFile.getUrl()),
                            origin.dest.toFile(),
                            remoteFile.getIntegrityCheck());
                    newTask.setName(origin.displayName);
                }
            } catch (Throwable thr) {
                Logging.LOG.log(Level.WARNING, "重建下载任务失败: " + origin.displayName, thr);
                newTask = origin.task;
            }
        }
        return new PlanItem(origin.id, origin.displayName, origin.sizeBytes, origin.localHit,
                origin.modId, origin.dest, newTask, origin.isModItself, origin.remoteFileSnapshot, origin.looseMatched,
                origin.dependencyType, origin.defaultChecked, origin.lockedCheck, origin.targetGameVersion, origin.loaderBadge, origin.isMatched);
    }

    private PlanResult buildPlan(RemoteMod.Version currentVersion) throws IOException {
        List<RemoteMod.Dependency> dependencies = (currentVersion.getDependencies() == null ? Collections.<RemoteMod.Dependency>emptyList() : currentVersion.getDependencies()).stream()
                .filter(d -> d.getType() != RemoteMod.DependencyType.INCOMPATIBLE
                        && d.getType() != RemoteMod.DependencyType.BROKEN
                        && d.getType() != RemoteMod.DependencyType.INCLUDE
                        && d.getType() != RemoteMod.DependencyType.EMBEDDED)
                .collect(Collectors.<RemoteMod.Dependency>toList());

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

        // visitedAllIds = 所有真正"摸过"的依赖 id（不管是否成功、是否命中）。用来统计"扫描了多少节点" + 避免树枝循环 & 重复。
        Set<String> visitedAllIds = new HashSet<>();
        Set<String> downloadedIds = new HashSet<>();
        List<PlanItem> items = new ArrayList<>();
        List<UnresolvedDependency> unresolved = Collections.synchronizedList(new ArrayList<>());
        int[] looseMatchedCounter = new int[1];
        int[] scannedNodeCounter = new int[1];
        int[] duplicatedCounter = new int[1];
        int[] maxDepthReached = new int[1];

        if (currentVersion != null) {
            String pseudoId = (currentVersion.getModid() == null ? "__current__" : currentVersion.getModid())
                    + ":" + (currentVersion.getVersion() == null ? "" : currentVersion.getVersion());
            scannedNodeCounter[0]++;
            visitedAllIds.add(pseudoId);
            if (!downloadedIds.contains(pseudoId)) {
                try {
                    Path dest = modsDir.resolve(currentVersion.getFile().getFilename());
                    long size = 0L;
                    boolean hit = isLocalFileValid(dest, currentVersion.getFile().getIntegrityCheck());
                    FileDownloadTask task = null;
                    if (!hit) {
                        task = new FileDownloadTask(
                                NetworkUtils.toURL(currentVersion.getFile().getUrl()),
                                dest.toFile(),
                                currentVersion.getFile().getIntegrityCheck());
                        task.setName(currentVersion.getName());
                    }
                    items.add(new PlanItem(pseudoId, currentVersion.getName(), size, hit, currentVersion.getModid(), dest, task, true, currentVersion.getFile(), false,
                            RemoteMod.DependencyType.REQUIRED, true, true, null, null, false));
                    downloadedIds.add(pseudoId);
                } catch (Throwable t) {
                    Logging.LOG.log(Level.WARNING, "规划模组本体失败: " + currentVersion.getName(), t);
                    unresolved.add(new UnresolvedDependency(currentVersion.getName() == null ? "(mod itself)" : currentVersion.getName(),
                            getContext().getString(R.string.mods_one_click_unmatched_reason_exception, String.valueOf(t.getMessage()))));
                }
            }
        }

        for (RemoteMod.Dependency dependency : dependencies) {
            planDependencyRecursively(dependency, currentGameVersion, currentLoaders, modsDir,
                    visitedAllIds, scannedNodeCounter, duplicatedCounter, maxDepthReached,
                    downloadedIds, items, unresolved, looseMatchedCounter, 1);
        }

        long totalBytesEstimate = 0L;
        int downloadingCount = 0;
        int matchedCount = 0;
        int unmatchedCount = 0;
        for (PlanItem it : items) {
            totalBytesEstimate += it.sizeBytes;
            if (!it.localHit) downloadingCount++;
            if (it.isModItself || it.isMatched) matchedCount++;
            else unmatchedCount++;
        }
        for (UnresolvedDependency u : unresolved) unmatchedCount++;
        return new PlanResult(items, downloadingCount, totalBytesEstimate, currentGameVersion, currentLoaders, modsDir,
                unresolved, looseMatchedCounter[0], matchedCount, unmatchedCount, dependencies.size(),
                scannedNodeCounter[0], duplicatedCounter[0], maxDepthReached[0]);
    }

    private void planDependencyRecursively(RemoteMod.Dependency dependency, String currentGameVersion,
                                           Set<ModLoaderType> currentLoaders, Path modsDir,
                                           Set<String> visitedAllIds, int[] scannedNodeCounter, int[] duplicatedCounter,
                                           int[] maxDepthReached,
                                           Set<String> downloadedIds, List<PlanItem> items,
                                           List<UnresolvedDependency> unresolved,
                                           int[] looseMatchedCounter, int depth) {
        // 不设深度上限（树枝插到底为止），但维护「当前递归栈」防止同一路径出现循环依赖导致死递归
        String dependencyId = dependency.getId();

        // 统计 + 去重：同一 dependencyId 在任何一层都只真正"处理一次"（树枝重复合并）
        if (visitedAllIds.contains(dependencyId)) {
            duplicatedCounter[0]++;
            return;
        }
        visitedAllIds.add(dependencyId);
        scannedNodeCounter[0]++;
        if (depth > maxDepthReached[0]) maxDepthReached[0] = depth;

        // 依赖类型：REQUIRED / TOOL 默认强制勾选且锁定；OPTIONAL 默认勾选但允许取消；其他一律不参与自动下载
        RemoteMod.DependencyType type = dependency.getType();
        if (type != RemoteMod.DependencyType.REQUIRED
                && type != RemoteMod.DependencyType.TOOL
                && type != RemoteMod.DependencyType.OPTIONAL) {
            return;
        }

        String dependencyId = dependency.getId();
        if (downloadedIds.contains(dependencyId)) return;

        // 注意：失败项绝对不要再写入 downloadedIds，否则会污染后续"兄弟姐妹依赖"，
        // 直接导致"明明有很多依赖，但只下一个"的 bug。
        try {
            RemoteMod mod = dependency.load();
            VersionSelection selection = selectBestDependencyVersion(
                    mod, currentGameVersion, currentLoaders, dependency.getRemoteModRepository());
            if (selection == null || selection.version.isEmpty()) {
                String display = mod.getTitle() == null ? dependencyId : mod.getTitle();
                UnresolvedDependency ud = new UnresolvedDependency(display,
                        getContext().getString(R.string.mods_one_click_unmatched_reason_no_version));
                ud.dependencyType = type;
                ud.targetGameVersion = currentGameVersion;
                unresolved.add(ud);
                downloadedIds.add(dependencyId); // 未找到合适版本 → 标记避免重复查询
                return;
            }
            RemoteMod.Version v = selection.version.get();
            Path dest = modsDir.resolve(v.getFile().getFilename());
            long size = 0L;
            boolean hit = isLocalFileValid(dest, v.getFile().getIntegrityCheck());
            FileDownloadTask task = null;
            if (!hit) {
                task = new FileDownloadTask(NetworkUtils.toURL(v.getFile().getUrl()), dest.toFile(), v.getFile().getIntegrityCheck());
                task.setName(v.getName());
            }
            // 若"完全忽略游戏版本、只按 ModLoader 选出"的候选 → 不再默认勾选，且允许用户自由勾选/取消（不再锁定）
            boolean looseBySelection = !selection.strict;
            if (looseBySelection) looseMatchedCounter[0]++;
            boolean gameVersionIgnored = selection.isIgnoringGameVersion;

            boolean defaultChecked;
            boolean lockedCheck;
            if (gameVersionIgnored) {
                // 游戏版本完全不匹配：不强推默认选中，交给用户自行决定
                defaultChecked = false;
                lockedCheck = false;
            } else if (type == RemoteMod.DependencyType.OPTIONAL) {
                defaultChecked = true;
                lockedCheck = false;
            } else {
                defaultChecked = true;
                lockedCheck = true;
            }
            String targetGameVersion = currentGameVersion;
            String loaderBadge = v.getLoaders() == null ? "-" : v.getLoaders().stream()
                    .map(Object::toString).collect(Collectors.joining(","));
            items.add(new PlanItem(dependencyId, v.getName(), size, hit, mod.getModID(), dest, task, false, v.getFile(),
                    looseBySelection, type, defaultChecked, lockedCheck, targetGameVersion, loaderBadge, !gameVersionIgnored));
            downloadedIds.add(dependencyId);

            List<RemoteMod.Dependency> nested = v.getDependencies();
            if (nested != null && !nested.isEmpty()) {
                for (RemoteMod.Dependency child : nested) {
                    if (child.getType() != RemoteMod.DependencyType.INCOMPATIBLE
                            && child.getType() != RemoteMod.DependencyType.BROKEN
                            && child.getType() != RemoteMod.DependencyType.INCLUDE
                            && child.getType() != RemoteMod.DependencyType.EMBEDDED) {
                        planDependencyRecursively(child, currentGameVersion, currentLoaders, modsDir,
                                visitedAllIds, scannedNodeCounter, duplicatedCounter, maxDepthReached,
                                downloadedIds, items, unresolved, looseMatchedCounter, depth + 1);
                    }
                }
            }
        } catch (Throwable t) {
            Logging.LOG.log(Level.WARNING, "规划依赖失败: " + dependencyId, t);
            // **不要**写入 downloadedIds，否则兄弟依赖会被牵连跳过；仅写入 unresolved 用于末尾诊断
            UnresolvedDependency ud = new UnresolvedDependency(dependencyId,
                    getContext().getString(R.string.mods_one_click_unmatched_reason_exception, String.valueOf(t.getMessage())));
            ud.dependencyType = dependency.getType();
            ud.targetGameVersion = currentGameVersion;
            unresolved.add(ud);
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
                LocalMod local = installed.getMod();
                if (local == null) continue;
                String id = local.getId();
                if (!item.modId.equalsIgnoreCase(id)) continue;
                if (installed.getFile() != null && item.dest != null && installed.getFile().equals(item.dest)) {
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

    private static final class VersionSelection {
        final Optional<RemoteMod.Version> version;
        final boolean strict;
        final boolean isIgnoringGameVersion;

        VersionSelection(Optional<RemoteMod.Version> version, boolean strict, boolean isIgnoringGameVersion) {
            this.version = version;
            this.strict = strict;
            this.isIgnoringGameVersion = isIgnoringGameVersion;
        }
    }

    private VersionSelection selectBestDependencyVersion(
            RemoteMod mod, String currentGameVersion, Set<ModLoaderType> currentLoaders,
            RemoteModRepository repository) throws IOException {
        try (Stream<RemoteMod.Version> stream = mod.getData().loadVersions(repository)) {
            List<RemoteMod.Version> allVersions = stream.collect(Collectors.toList());

            Logging.LOG.log(Level.INFO, "依赖 " + mod.getTitle() + " 共找到 " + allVersions.size() + " 个版本，开始对标 MC 版本: " + currentGameVersion
                    + "（正式版/Alpha/Beta 全部扫描，不做硬编码限制）");

            // 1) 严格对标：声明的游戏版本里精确包含 currentGameVersion（不分 Release/Alpha/Beta，全部扫描）
            Optional<RemoteMod.Version> strict = filterAndSelect(allVersions, currentGameVersion, currentLoaders, true, false);
            if (strict.isPresent()) {
                Logging.LOG.log(Level.INFO, "依赖 " + mod.getTitle() + " 严格对标命中: " + strict.get().getName());
                return new VersionSelection(strict, true, false);
            }

            // 2) 宽松游戏版本对标（允许 1.21 ↔ 1.21.0 / 26.1.2 ↔ 26.1.2.0 前缀匹配）
            Optional<RemoteMod.Version> looseGame = filterAndSelect(allVersions, currentGameVersion, currentLoaders, false, false);
            if (looseGame.isPresent()) {
                Logging.LOG.log(Level.WARNING, "依赖 " + mod.getTitle() + " 使用游戏版本宽松对标: " + looseGame.get().getName());
                return new VersionSelection(looseGame, false, false);
            }

            // 3) 绝不自动走"完全忽略游戏版本只按 ModLoader 兜底"分支（用户反馈会下错模组版本，不再自动选）
            //    但为了让用户在清单里能看见候选，把"完全忽略游戏版本"的结果也返回出来——但标记 isIgnoringGameVersion=true，
            //    由 buildPlan 决定是否把它作为"未命中关联的依赖"加入「未命中 Section」还是给个兜底候选并标「⚠️ 未命中关联，强行兜底」。
            Optional<RemoteMod.Version> loaderOnly = filterAndSelect(allVersions, currentGameVersion, currentLoaders, false, true);
            if (loaderOnly.isPresent()) {
                Logging.LOG.log(Level.WARNING, "依赖 " + mod.getTitle() + " 完全未命中当前游戏版本，返回 ModLoader 兜底候选供清单确认阶段用户手动决策（不自动勾选）");
                return new VersionSelection(loaderOnly, false, true);
            }

            Logging.LOG.log(Level.WARNING, "依赖 " + mod.getTitle() + " 在当前 MC 版本和 ModLoader 组合下没有任何可下载版本");
            return new VersionSelection(Optional.empty(), false, false);
        }
    }

    private Optional<RemoteMod.Version> filterAndSelect(
            List<RemoteMod.Version> versions, String gameVersion, Set<ModLoaderType> loaders,
            boolean strictGameVersion, boolean ignoreGameVersion) {
        Stream<RemoteMod.Version> stream = versions.stream();
        if (!ignoreGameVersion && !StringUtils.isBlank(gameVersion)) {
            if (strictGameVersion) {
                // 严格对标：声明的游戏版本集合中包含精确字符串（Release / Alpha / Beta 全扫描，不区分稳定性）
                stream = stream.filter(v -> v.getGameVersions() != null && v.getGameVersions().contains(gameVersion));
            } else {
                String normalizedTarget = normalizeGameVersion(gameVersion);
                stream = stream.filter(v -> {
                    if (v.getGameVersions() == null || v.getGameVersions().isEmpty()) return false;
                    for (String declared : v.getGameVersions()) {
                        String normalizedDeclared = normalizeGameVersion(declared);
                        if (normalizedDeclared.equals(normalizedTarget)) return true;
                        if (normalizedDeclared.startsWith(normalizedTarget + ".")) return true;
                        if (normalizedTarget.startsWith(normalizedDeclared + ".")) return true;
                    }
                    return false;
                });
            }
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
        // Release 优先于 Alpha/Beta，其次按发布时间倒序
        return stream
                .sorted(Comparator.comparing((RemoteMod.Version v) -> {
                    switch (v.getVersionType()) {
                        case Release:
                            return 0;
                        case Beta:
                            return 1;
                        case Alpha:
                            return 2;
                        default:
                            return 3;
                    }
                }).thenComparing(RemoteMod.Version::getDatePublished).reversed())
                .findFirst();
    }

    private static String normalizeGameVersion(String v) {
        if (v == null) return "";
        String s = v.trim();
        while (s.endsWith(".0")) s = s.substring(0, s.length() - 2);
        return s;
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

    public static final DateTimeFormatter FORMATTER = DateTimeFormatter
            .ofLocalizedDateTime(FormatStyle.MEDIUM)
            .withLocale(Locale.getDefault())
            .withZone(ZoneId.systemDefault());

    // === Small PODOs for plan flow ===

    private static final class UnresolvedDependency {
        final String displayName;
        final String reason;
        RemoteMod.DependencyType dependencyType;
        String targetGameVersion;

        UnresolvedDependency(String displayName, String reason) {
            this.displayName = displayName;
            this.reason = reason;
        }
    }

    private static class PlanItem {
        final String id;
        final String displayName;
        final long sizeBytes;
        final boolean localHit;
        final String modId;
        final Path dest;
        final FileDownloadTask task;
        final boolean isModItself;
        final RemoteMod.File remoteFileSnapshot;
        final boolean looseMatched;
        final RemoteMod.DependencyType dependencyType;
        final boolean defaultChecked;
        final boolean lockedCheck;
        final String targetGameVersion;
        final String loaderBadge;
        final boolean isMatched;

        PlanItem(String id, String displayName, long sizeBytes, boolean localHit, String modId, Path dest, FileDownloadTask task, boolean isModItself, RemoteMod.File remoteFileSnapshot) {
            this(id, displayName, sizeBytes, localHit, modId, dest, task, isModItself, remoteFileSnapshot, false);
        }

        PlanItem(String id, String displayName, long sizeBytes, boolean localHit, String modId, Path dest, FileDownloadTask task, boolean isModItself, RemoteMod.File remoteFileSnapshot, boolean looseMatched) {
            this(id, displayName, sizeBytes, localHit, modId, dest, task, isModItself, remoteFileSnapshot, looseMatched,
                    RemoteMod.DependencyType.REQUIRED, true, true, null, null, true);
        }

        PlanItem(String id, String displayName, long sizeBytes, boolean localHit, String modId, Path dest, FileDownloadTask task, boolean isModItself, RemoteMod.File remoteFileSnapshot, boolean looseMatched,
                 RemoteMod.DependencyType dependencyType, boolean defaultChecked, boolean lockedCheck, String targetGameVersion, String loaderBadge, boolean isMatched) {
            this.id = id;
            this.displayName = displayName;
            this.sizeBytes = sizeBytes;
            this.localHit = localHit;
            this.modId = modId;
            this.dest = dest;
            this.task = task;
            this.isModItself = isModItself;
            this.remoteFileSnapshot = remoteFileSnapshot;
            this.looseMatched = looseMatched;
            this.dependencyType = dependencyType;
            this.defaultChecked = defaultChecked;
            this.lockedCheck = lockedCheck;
            this.targetGameVersion = targetGameVersion;
            this.loaderBadge = loaderBadge;
            this.isMatched = isMatched;
        }
    }

    private static class PlanResult {
        final List<PlanItem> items;
        final int downloadingCount;
        final long totalBytesEstimate;
        final String gameVersion;
        final Set<ModLoaderType> loaders;
        final Path modsDir;
        final List<UnresolvedDependency> unresolvedDependencies;
        final int looseMatchedCount;
        final int matchedCount;
        final int unmatchedCount;
        final int rawDependencyDeclaredCount;
        final int scannedNodeCount;
        final int duplicatedNodeCount;
        final int maxDepthReached;

        PlanResult(List<PlanItem> items, int downloadingCount, long totalBytesEstimate, String gameVersion, Set<ModLoaderType> loaders, Path modsDir,
                   List<UnresolvedDependency> unresolvedDependencies, int looseMatchedCount) {
            this(items, downloadingCount, totalBytesEstimate, gameVersion, loaders, modsDir, unresolvedDependencies, looseMatchedCount,
                    0, 0, 0, 0, 0, 0);
        }

        PlanResult(List<PlanItem> items, int downloadingCount, long totalBytesEstimate, String gameVersion, Set<ModLoaderType> loaders, Path modsDir,
                   List<UnresolvedDependency> unresolvedDependencies, int looseMatchedCount,
                   int matchedCount, int unmatchedCount, int rawDependencyDeclaredCount) {
            this(items, downloadingCount, totalBytesEstimate, gameVersion, loaders, modsDir, unresolvedDependencies, looseMatchedCount,
                    matchedCount, unmatchedCount, rawDependencyDeclaredCount, 0, 0, 0);
        }

        PlanResult(List<PlanItem> items, int downloadingCount, long totalBytesEstimate, String gameVersion, Set<ModLoaderType> loaders, Path modsDir,
                   List<UnresolvedDependency> unresolvedDependencies, int looseMatchedCount,
                   int matchedCount, int unmatchedCount, int rawDependencyDeclaredCount,
                   int scannedNodeCount, int duplicatedNodeCount, int maxDepthReached) {
            this.items = items;
            this.downloadingCount = downloadingCount;
            this.totalBytesEstimate = totalBytesEstimate;
            this.gameVersion = gameVersion;
            this.loaders = loaders;
            this.modsDir = modsDir;
            this.unresolvedDependencies = unresolvedDependencies;
            this.looseMatchedCount = looseMatchedCount;
            this.matchedCount = matchedCount;
            this.unmatchedCount = unmatchedCount;
            this.rawDependencyDeclaredCount = rawDependencyDeclaredCount;
            this.scannedNodeCount = scannedNodeCount;
            this.duplicatedNodeCount = duplicatedNodeCount;
            this.maxDepthReached = maxDepthReached;
        }

        static PlanResult ofFiltered(PlanResult origin, java.util.function.Predicate<PlanItem> keep) {
            List<PlanItem> kept = origin.items.stream().filter(keep).collect(Collectors.toList());
            int down = 0;
            long total = 0L;
            for (PlanItem it : kept) {
                if (!it.localHit) down++;
                total += it.sizeBytes;
            }
            int matched = 0;
            int unmatched = 0;
            for (PlanItem it : kept) {
                if (it.isModItself || it.isMatched) matched++;
                else unmatched++;
            }
            if (origin.unresolvedDependencies != null) unmatched += origin.unresolvedDependencies.size();
            return new PlanResult(kept, down, total, origin.gameVersion, origin.loaders, origin.modsDir,
                    origin.unresolvedDependencies, origin.looseMatchedCount, matched, unmatched, origin.rawDependencyDeclaredCount,
                    origin.scannedNodeCount, origin.duplicatedNodeCount, origin.maxDepthReached);
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

    private static final class ConflictCheckResult {
        final PlanResult plan;
        final List<ConflictItem> conflicts;

        ConflictCheckResult(PlanResult plan, List<ConflictItem> conflicts) {
            this.plan = plan;
            this.conflicts = conflicts;
        }

        boolean hasConflict() {
            return conflicts != null && !conflicts.isEmpty();
        }
    }
}
