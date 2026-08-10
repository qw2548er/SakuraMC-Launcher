package com.tungsten.fclcore.download.game;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.logging.Level;

import static com.tungsten.fclcore.util.Logging.LOG;

/**
 * 记住每个 Minecraft 版本的依赖勾选结果。
 *
 * <p>存储格式：{baseDir}/library_selections.json
 * <pre>
 * {
 *   "version id": {
 *     "selected": ["groupId:artifactId:version", ...],
 *     "schema": 1
 *   }
 * }
 * </pre>
 */
public final class LibrarySelectionStore {

    private static final String FILE_NAME = "library_selections.json";
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Type MAP_TYPE = new TypeToken<Map<String, Entry>>() {}.getType();

    public static final class Entry {
        public Set<String> selected = new HashSet<>();
        public int schema = 1;
    }

    private final Path file;
    private Map<String, Entry> cache = new LinkedHashMap<>();
    private boolean loaded = false;

    public LibrarySelectionStore(Path baseDirectory) {
        this.file = baseDirectory.resolve(FILE_NAME);
    }

    private void loadIfNeeded() {
        if (loaded) return;
        loaded = true;
        if (!Files.exists(file)) {
            cache = new LinkedHashMap<>();
            return;
        }
        try {
            String raw = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
            Map<String, Entry> parsed = GSON.fromJson(raw, MAP_TYPE);
            cache = parsed == null ? new LinkedHashMap<>() : new LinkedHashMap<>(parsed);
        } catch (IOException | RuntimeException e) {
            LOG.log(Level.WARNING, "Failed to load " + file + ", starting from empty", e);
            cache = new LinkedHashMap<>();
        }
    }

    public synchronized Set<String> loadSelection(String versionId, Set<String> defaultIfMissing) {
        loadIfNeeded();
        Entry entry = cache.get(versionId);
        if (entry == null || entry.selected == null) {
            return defaultIfMissing == null ? Collections.emptySet() : new HashSet<>(defaultIfMissing);
        }
        return new HashSet<>(entry.selected);
    }

    public synchronized void saveSelection(String versionId, Set<String> selectedKeys) {
        loadIfNeeded();
        Entry entry = cache.computeIfAbsent(versionId, k -> new Entry());
        entry.selected = new HashSet<>(selectedKeys == null ? Collections.emptySet() : selectedKeys);
        entry.schema = 1;
        saveNow();
    }

    public synchronized void clear(String versionId) {
        loadIfNeeded();
        if (cache.remove(versionId) != null) saveNow();
    }

    private void saveNow() {
        try {
            Path parent = file.getParent();
            if (parent != null && !Files.exists(parent)) Files.createDirectories(parent);
            String json = GSON.toJson(cache);
            Files.write(file, json.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            LOG.log(Level.WARNING, "Failed to write " + file, e);
        }
    }
}
