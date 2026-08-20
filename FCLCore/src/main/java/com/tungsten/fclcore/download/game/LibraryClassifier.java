package com.tungsten.fclcore.download.game;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonSyntaxException;
import com.tungsten.fclcore.game.Library;
import com.tungsten.fclcore.util.Logging;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;

/**
 * 依赖三段式分类器。
 *
 * <p>规则严格对齐「依赖下载可选功能方案」：
 * <ul>
 *   <li>🔴 MUST — 必须依赖，强制下载，不可取消</li>
 *   <li>🟡 RECOMMENDED — 推荐依赖，默认勾选，可取消</li>
 *   <li>🟢 OPTIONAL — 可选依赖，默认不勾，可主动勾选</li>
 * </ul>
 */
public final class LibraryClassifier {

    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().setLenient().create();
    private static final Rules DEFAULT_HARDCODED_RULES;

    static {
        DEFAULT_HARDCODED_RULES = new Rules();
        DEFAULT_HARDCODED_RULES.schema_version = 0;
        DEFAULT_HARDCODED_RULES.version = "builtin";
        DEFAULT_HARDCODED_RULES.fallback_category = "RECOMMENDED";
    }

    /** 外部注入的规则来源，可为 null（此时只用硬编码兜底）。 */
    private static volatile Rules activeRules;
    /** 异步注入的进行中标记：防止多线程重复 IO。 */
    private static final AtomicBoolean asyncInjectInFlight = new AtomicBoolean(false);

    public enum Category {
        MUST,
        RECOMMENDED,
        OPTIONAL
    }

    /**
     * 从 JSON 输入流加载规则（schema_version 1）。
     * 加载失败返回 null，记录日志。调用方应使用 {@code null} 表示「继续用硬编码」。
     */
    public static Rules loadRules(InputStream in) {
        if (in == null) return null;
        try (Reader reader = new InputStreamReader(in, StandardCharsets.UTF_8)) {
            Rules rules = GSON.fromJson(reader, Rules.class);
            if (rules == null) return null;
            if (rules.must == null) rules.must = new RulesBucket();
            if (rules.recommended == null) rules.recommended = new RulesBucket();
            if (rules.optional == null) rules.optional = new RulesBucket();
            if (rules.excludes == null) rules.excludes = new Excludes();
            rules.normalize();
            return rules;
        } catch (JsonSyntaxException | IOException e) {
            Logging.LOG.log(Level.WARNING, "Failed to parse library classifier rules JSON", e);
            return null;
        }
    }

    /**
     * 从本地缓存路径加载规则；若路径不存在 / 解析失败则返回 null。
     * 这是留给「远程下发后写入本地缓存」的扩展接口。
     */
    public static Rules loadRulesFromFile(Path rulesFile) {
        if (rulesFile == null || !Files.isRegularFile(rulesFile)) return null;
        try (InputStream in = Files.newInputStream(rulesFile)) {
            return loadRules(in);
        } catch (IOException e) {
            Logging.LOG.log(Level.WARNING, "Failed to read cached library rules: " + rulesFile, e);
            return null;
        }
    }

    /**
     * 优先用本地缓存文件注入规则；缓存不可用时再回退到 fallbackStream（如 assets）。
     * 成功返回 true，失败返回 false（此时仍保留原 activeRules，通常是硬编码兜底）。
     */
    public static boolean injectRules(Path cachedRulesFile, InputStream fallbackStream) {
        Rules rules = loadRulesFromFile(cachedRulesFile);
        if (rules == null) rules = loadRules(fallbackStream);
        if (rules == null) return false;
        setActiveRules(rules);
        return true;
    }

    /**
     * 异步版本：在后台线程执行 {@link #injectRules(Path, InputStream)}；
     * 若已有一次注入在跑，则直接返回，不重复 IO。
     *
     * @param doneCallback 注入完成（无论成功失败）后切到调用方线程执行的回调；可传 null。
     */
    public static void injectRulesAsync(final Path cachedRulesFile,
                                        final InputStreamSupplier fallbackSupplier,
                                        final Runnable doneCallback) {
        if (!asyncInjectInFlight.compareAndSet(false, true)) return;
        final Thread t = new Thread(() -> {
            try {
                InputStream fallback = null;
                try {
                    if (fallbackSupplier != null) fallback = fallbackSupplier.open();
                    injectRules(cachedRulesFile, fallback);
                } catch (IOException e) {
                    Logging.LOG.log(Level.WARNING, "注入 LibraryClassifier 规则失败：读取 fallback 流或注入 IO 异常", e);
                } finally {
                    if (fallback != null) {
                        try { fallback.close(); } catch (IOException ignore) {}
                    }
                }
            } finally {
                asyncInjectInFlight.set(false);
                if (doneCallback != null) {
                    try { doneCallback.run(); } catch (Throwable ignore) {}
                }
            }
        }, "LibraryClassifier-AsyncRules");
        t.setDaemon(true);
        t.start();
    }

    @FunctionalInterface
    public interface InputStreamSupplier {
        InputStream open() throws IOException;
    }

    /** 注入并激活一套规则；传 null 表示恢复到硬编码兜底。 */
    public static void setActiveRules(Rules rules) {
        activeRules = rules;
    }

    /** 当前激活的规则；若未注入则返回硬编码 Rules（schema==0，表示仅用硬编码 categorizeHardcoded 执行）。 */
    public static Rules getActiveRules() {
        Rules r = activeRules;
        return r == null ? DEFAULT_HARDCODED_RULES : r;
    }

    public static final class Entry {
        private final Library library;
        private final Category category;
        private final String title;
        private final long size;
        private final boolean alreadyPresent;

        public Entry(Library library, Category category, String title, long size, boolean alreadyPresent) {
            this.library = library;
            this.category = category;
            this.title = title;
            this.size = size;
            this.alreadyPresent = alreadyPresent;
        }

        public Library getLibrary() { return library; }
        public Category getCategory() { return category; }
        public String getTitle() { return title; }
        public long getSize() { return size; }
        public boolean isAlreadyPresent() { return alreadyPresent; }

        /** 依赖唯一键，用于持久化用户选择。 */
        public String getKey() {
            return library.getName();
        }
    }

    public static final class Excludes {
        public List<String> coords_prefixes;
        public List<String> keywords;
    }

    public static final class RulesBucket {
        public List<String> coords_exact;
        public List<String> coords_prefixes;
        public List<String> artifact_ids_exact;
        public List<String> artifact_ids_prefixes;
        public List<String> keywords;
        /** 仅 MUST 用：是否把 platform-native 直接标 MUST。 */
        public Boolean natives;
        /** 仅 OPTIONAL 用：是否把 classifier 与当前环境不匹配的 native 标 OPTIONAL。 */
        public Boolean extra_natives_wrong_environment;

        void normalize() {
            if (coords_exact == null) coords_exact = Collections.emptyList();
            if (coords_prefixes == null) coords_prefixes = Collections.emptyList();
            if (artifact_ids_exact == null) artifact_ids_exact = Collections.emptyList();
            if (artifact_ids_prefixes == null) artifact_ids_prefixes = Collections.emptyList();
            if (keywords == null) keywords = Collections.emptyList();
            // 转小写，加速匹配
            for (int i = 0; i < coords_exact.size(); i++)
                coords_exact.set(i, s(coords_exact.get(i)));
            for (int i = 0; i < coords_prefixes.size(); i++)
                coords_prefixes.set(i, s(coords_prefixes.get(i)));
            for (int i = 0; i < artifact_ids_exact.size(); i++)
                artifact_ids_exact.set(i, s(artifact_ids_exact.get(i)));
            for (int i = 0; i < artifact_ids_prefixes.size(); i++)
                artifact_ids_prefixes.set(i, s(artifact_ids_prefixes.get(i)));
            for (int i = 0; i < keywords.size(); i++)
                keywords.set(i, s(keywords.get(i)));
        }
    }

    public static final class Rules {
        public int schema_version;
        public String version;
        public Excludes excludes;
        public RulesBucket must;
        public RulesBucket recommended;
        public RulesBucket optional;
        public String fallback_category;

        void normalize() {
            if (excludes == null) excludes = new Excludes();
            if (excludes.coords_prefixes == null) excludes.coords_prefixes = Collections.emptyList();
            if (excludes.keywords == null) excludes.keywords = Collections.emptyList();
            List<String> cp = new ArrayList<>(excludes.coords_prefixes.size());
            for (String x : excludes.coords_prefixes) cp.add(s(x));
            excludes.coords_prefixes = cp;
            List<String> kw = new ArrayList<>(excludes.keywords.size());
            for (String x : excludes.keywords) kw.add(s(x));
            excludes.keywords = kw;
            if (must == null) must = new RulesBucket();
            if (recommended == null) recommended = new RulesBucket();
            if (optional == null) optional = new RulesBucket();
            must.normalize();
            recommended.normalize();
            optional.normalize();
            fallback_category = fallback_category == null ? "RECOMMENDED" : fallback_category.toUpperCase(Locale.ROOT);
            if (!"MUST".equals(fallback_category) && !"RECOMMENDED".equals(fallback_category) && !"OPTIONAL".equals(fallback_category)) {
                fallback_category = "RECOMMENDED";
            }
        }
    }

    private LibraryClassifier() {}

    /**
     * 将库列表分类。
     *
     * @param libraries       扁平后的完整依赖列表（version.resolve 后）
     * @param presenceChecker 判断某库是否已存在且完整，返回 true 表示本地已有、不用下载
     * @return 分类结果，按 MUST / RECOMMENDED / OPTIONAL 顺序分组；每一组内部保持传入顺序
     */
    public static Classification classify(List<Library> libraries, PresenceChecker presenceChecker) {
        List<Entry> must = new ArrayList<>();
        List<Entry> recommended = new ArrayList<>();
        List<Entry> optional = new ArrayList<>();

        for (Library library : libraries) {
            Category c = categorize(library);
            long size = library.getDownload().getSize();
            if (size < 0) size = 0;
            boolean present = presenceChecker == null ? false : presenceChecker.isPresent(library);
            Entry entry = new Entry(library, c, buildTitle(library), size, present);

            switch (c) {
                case MUST: must.add(entry); break;
                case RECOMMENDED: recommended.add(entry); break;
                case OPTIONAL: optional.add(entry); break;
            }
        }
        return new Classification(must, recommended, optional);
    }

    public static Category categorize(Library library) {
        Rules rules = getActiveRules();
        String group = nvl(library.getGroupId()).toLowerCase(Locale.ROOT);
        String artifact = nvl(library.getArtifactId()).toLowerCase(Locale.ROOT);
        String coords = group + ":" + artifact;

        if (rules.schema_version >= 1) {
            // 0) excludes：命中则跳过 JSON 的 MUST/RECOMMENDED/OPTIONAL 规则，直接走 fallback
            if (matchAnyPrefix(rules.excludes.coords_prefixes, coords) || matchAnyKeyword(rules.excludes.keywords, coords, artifact)) {
                return categoryByName(rules.fallback_category);
            }

            // 1) MUST 桶：精确坐标 > 坐标前缀 > artifact 精确 > artifact 前缀 > 关键词 > natives 标记
            if (rules.must.coords_exact.contains(coords)) return Category.MUST;
            if (matchAnyPrefix(rules.must.coords_prefixes, coords)) return Category.MUST;
            if (rules.must.artifact_ids_exact.contains(artifact)) return Category.MUST;
            if (matchAnyPrefix(rules.must.artifact_ids_prefixes, artifact)) return Category.MUST;
            if (matchAnyKeyword(rules.must.keywords, coords, artifact)) return Category.MUST;
            if (Boolean.TRUE.equals(rules.must.natives) && library.isNative() && library.appliesToCurrentEnvironment()) {
                return Category.MUST;
            }

            // 2) RECOMMENDED 桶
            if (rules.recommended.coords_exact.contains(coords)) return Category.RECOMMENDED;
            if (matchAnyPrefix(rules.recommended.coords_prefixes, coords)) return Category.RECOMMENDED;
            if (rules.recommended.artifact_ids_exact.contains(artifact)) return Category.RECOMMENDED;
            if (matchAnyPrefix(rules.recommended.artifact_ids_prefixes, artifact)) return Category.RECOMMENDED;
            if (matchAnyKeyword(rules.recommended.keywords, coords, artifact)) return Category.RECOMMENDED;

            // 3) OPTIONAL 桶
            if (rules.optional.coords_exact.contains(coords)) return Category.OPTIONAL;
            if (matchAnyPrefix(rules.optional.coords_prefixes, coords)) return Category.OPTIONAL;
            if (rules.optional.artifact_ids_exact.contains(artifact)) return Category.OPTIONAL;
            if (matchAnyPrefix(rules.optional.artifact_ids_prefixes, artifact)) return Category.OPTIONAL;
            if (matchAnyKeyword(rules.optional.keywords, coords, artifact)) return Category.OPTIONAL;
            if (Boolean.TRUE.equals(rules.optional.extra_natives_wrong_environment)
                    && library.getClassifier() != null && !library.appliesToCurrentEnvironment()) {
                return Category.OPTIONAL;
            }

            // 4) JSON 规则没命中 → fallback
            return categoryByName(rules.fallback_category);
        }

        // 硬编码兜底（保持与历史版本完全一致，未注入 JSON 时走这里）
        return categorizeHardcoded(library, group, artifact, coords);
    }

    private static Category categorizeHardcoded(Library library, String group, String artifact, String coords) {
        if (group.startsWith("net.minecraft")) return Category.MUST;
        if (group.startsWith("com.mojang")) {
            if ("authlib".equals(artifact) || "realms".equals(artifact) || coords.startsWith("com.mojang:blocklist")
                    || coords.startsWith("com.mojang:authlib") || coords.startsWith("com.mojang:brigadier")
                    || coords.startsWith("com.mojang:datafixerupper") || coords.startsWith("com.mojang:javabridge")
                    || coords.startsWith("com.mojang:logging") || coords.startsWith("com.mojang:patch")
                    || coords.startsWith("com.mojang:realms") || coords.startsWith("com.mojang:text2speech")) {
                return Category.MUST;
            }
        }
        if (group.startsWith("org.lwjgl")) return Category.MUST;
        if (artifact.equals("log4j-api") || artifact.equals("log4j-core")
                || group.equals("org.apache.logging.log4j")) return Category.MUST;
        if (group.equals("com.google.guava") || artifact.equals("guava")) return Category.MUST;
        if (group.equals("com.google.code.gson") || artifact.equals("gson")) return Category.MUST;

        if (library.isNative()) {
            return Category.MUST;
        }

        if (artifact.contains("sound") || artifact.contains("audio")
                || coords.contains("paulscode") || coords.contains("soundengine")
                || coords.contains("truelicense")) {
            return Category.RECOMMENDED;
        }
        if (group.equals("org.apache.commons")) return Category.RECOMMENDED;
        if (artifact.equals("commons-io") || artifact.equals("commons-lang3")
                || artifact.equals("commons-lang") || artifact.equals("commons-text")
                || artifact.equals("commons-logging")) {
            return Category.RECOMMENDED;
        }
        if (group.equals("com.github.ben-manes.caffeine") || artifact.equals("caffeine")) {
            return Category.RECOMMENDED;
        }
        if (coords.startsWith("org.apache.httpcomponents")
                || coords.startsWith("io.netty")
                || coords.startsWith("org.slf4j")
                || coords.startsWith("org.jline")) {
            return Category.RECOMMENDED;
        }
        if (coords.contains("icu4j") || coords.contains("javassist")
                || coords.contains("fastutil") || coords.contains("oshi-core")
                || coords.contains("jna-platform") || coords.startsWith("net.java.dev.jna:jna:")) {
            return Category.RECOMMENDED;
        }

        if (artifact.contains("test") || artifact.contains("debug") || coords.contains("debug-")) {
            return Category.OPTIONAL;
        }
        if (coords.contains("voicechat") || coords.contains("voice-chat")
                || artifact.contains("voicechat") || coords.contains("mumble")
                || coords.contains("snapshot-support")) {
            return Category.OPTIONAL;
        }
        if (artifact.contains("legacy") || coords.contains("compat")
                || coords.contains("jinput-platform")
                || coords.contains("twitch-platform")) {
            return Category.OPTIONAL;
        }
        if (library.getClassifier() != null && !library.appliesToCurrentEnvironment()) {
            return Category.OPTIONAL;
        }

        return Category.RECOMMENDED;
    }

    private static Category categoryByName(String name) {
        if ("MUST".equals(name)) return Category.MUST;
        if ("OPTIONAL".equals(name)) return Category.OPTIONAL;
        return Category.RECOMMENDED;
    }

    private static boolean matchAnyPrefix(List<String> prefixes, String text) {
        if (prefixes == null || prefixes.isEmpty()) return false;
        for (String p : prefixes) if (text.startsWith(p)) return true;
        return false;
    }

    private static boolean matchAnyKeyword(List<String> keywords, String coords, String artifact) {
        if (keywords == null || keywords.isEmpty()) return false;
        for (String k : keywords) {
            if (coords.contains(k)) return true;
            if (!k.equals(artifact) && artifact.contains(k)) return true;
        }
        return false;
    }

    private static String s(String x) { return x == null ? "" : x.toLowerCase(Locale.ROOT); }

    private static String buildTitle(Library library) {
        return library.getName();
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    public interface PresenceChecker {
        boolean isPresent(Library library);
    }

    public static final class Classification {
        private final List<Entry> must;
        private final List<Entry> recommended;
        private final List<Entry> optional;

        public Classification(List<Entry> must, List<Entry> recommended, List<Entry> optional) {
            this.must = Collections.unmodifiableList(must);
            this.recommended = Collections.unmodifiableList(recommended);
            this.optional = Collections.unmodifiableList(optional);
        }

        public List<Entry> getMust() { return must; }
        public List<Entry> getRecommended() { return recommended; }
        public List<Entry> getOptional() { return optional; }

        public int totalCount() {
            return must.size() + recommended.size() + optional.size();
        }

        public long totalBytes() {
            long sum = 0;
            for (Entry e : must) sum += e.getSize();
            for (Entry e : recommended) sum += e.getSize();
            for (Entry e : optional) sum += e.getSize();
            return sum;
        }

        public long mustBytes() { return sumSize(must); }
        public long recommendedBytes() { return sumSize(recommended); }
        public long optionalBytes() { return sumSize(optional); }

        private static long sumSize(List<Entry> list) {
            long s = 0;
            for (Entry e : list) s += e.getSize();
            return s;
        }

        /** 默认勾选集合：MUST 全部 + RECOMMENDED 全部 - 已存在的。 */
        public Set<String> defaultSelection() {
            Set<String> out = new LinkedHashSet<>();
            for (Entry e : must) out.add(e.getKey());
            for (Entry e : recommended) {
                if (!e.isAlreadyPresent()) out.add(e.getKey());
            }
            return out;
        }

        /** 最小可启动集合：仅 MUST - 已存在的。 */
        public Set<String> minimalSelection() {
            Set<String> out = new LinkedHashSet<>();
            for (Entry e : must) {
                if (!e.isAlreadyPresent()) out.add(e.getKey());
            }
            return out;
        }

        /** 按选择过滤，得到下载队列（保留原始顺序）。 */
        public List<Library> filterForDownload(Set<String> selectedKeys) {
            List<Library> out = new ArrayList<>();
            for (Entry e : must) {
                // MUST 不管用户是否勾选都要加（安全兜底）
                if (!e.isAlreadyPresent()) out.add(e.getLibrary());
            }
            for (Entry e : recommended) {
                if (!e.isAlreadyPresent() && selectedKeys.contains(e.getKey())) out.add(e.getLibrary());
            }
            for (Entry e : optional) {
                if (!e.isAlreadyPresent() && selectedKeys.contains(e.getKey())) out.add(e.getLibrary());
            }
            return out;
        }

        /** 返回所有依赖键，便于持久化。 */
        public Set<String> allKeys() {
            Set<String> out = new LinkedHashSet<>();
            for (Entry e : must) out.add(e.getKey());
            for (Entry e : recommended) out.add(e.getKey());
            for (Entry e : optional) out.add(e.getKey());
            return out;
        }
    }

    public static String humanReadableBytes(long bytes) {
        if (bytes < 0) bytes = 0;
        if (bytes < 1024) return bytes + " B";
        double v = bytes;
        String[] units = {"KB", "MB", "GB", "TB"};
        int unitIdx = -1;
        do { v /= 1024.0; unitIdx++; } while (v >= 1024 && unitIdx < units.length - 1);
        return String.format(Locale.ROOT, "%.2f %s", v, units[unitIdx]);
    }
}
