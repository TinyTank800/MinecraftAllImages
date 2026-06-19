package com.tinytank.itemgallery;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
import org.jetbrains.annotations.Nullable;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Writes the gallery-compatible {@code manifest.json}, {@code hashes.json} and {@code changes.json}
 * files, and diffs a freshly exported version against the most recent previous export.
 */
public final class GalleryManifest {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create();
    private static final Type HASHES_TYPE = new TypeToken<Map<String, String>>() {
    }.getType();

    public static final String MANIFEST_FILE = "manifest.json";
    public static final String CHANGES_FILE = "changes.json";
    public static final String HASHES_FILE = "hashes.json";

    private GalleryManifest() {
    }

    /** Numeric dotted-version comparison (e.g. {@code 1.21.6} vs {@code 1.21.10}). */
    public static int compareVersions(String a, String b) {
        String[] partsA = a.split("\\.");
        String[] partsB = b.split("\\.");
        int len = Math.max(partsA.length, partsB.length);
        for (int i = 0; i < len; i++) {
            Integer numA = tryParse(i < partsA.length ? partsA[i] : "0");
            Integer numB = tryParse(i < partsB.length ? partsB[i] : "0");
            int cmp;
            if (numA != null && numB != null) {
                cmp = Integer.compare(numA, numB);
            } else {
                cmp = (i < partsA.length ? partsA[i] : "0").compareTo(i < partsB.length ? partsB[i] : "0");
            }
            if (cmp != 0) {
                return cmp;
            }
        }
        return 0;
    }

    @Nullable
    private static Integer tryParse(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Finds the highest previously-exported version directory (a sibling containing a
     * {@code hashes.json}) that is strictly lower than {@code currentVersion}.
     */
    @Nullable
    public static File detectPreviousVersionDir(File galleryRoot, String currentVersion) {
        File[] candidates = galleryRoot.listFiles(File::isDirectory);
        if (candidates == null) {
            return null;
        }
        File best = null;
        String bestVersion = null;
        for (File dir : candidates) {
            String name = dir.getName();
            if (name.equals(currentVersion) || !new File(dir, HASHES_FILE).isFile()) {
                continue;
            }
            if (compareVersions(name, currentVersion) >= 0) {
                continue;
            }
            if (bestVersion == null || compareVersions(name, bestVersion) > 0) {
                best = dir;
                bestVersion = name;
            }
        }
        return best;
    }

    public static void writeManifest(File versionDir, String version, boolean isBase, List<String> images) throws IOException {
        List<String> sorted = new ArrayList<>(images);
        Collections.sort(sorted);
        JsonObject json = new JsonObject();
        json.addProperty("version", version);
        json.addProperty("isBase", isBase);
        json.add("images", toArray(sorted));
        writeJson(new File(versionDir, MANIFEST_FILE), json);
    }

    public static void writeHashes(File versionDir, Map<String, String> hashes) throws IOException {
        writeJson(new File(versionDir, HASHES_FILE), GSON.toJsonTree(new TreeMap<>(hashes)));
    }

    /** Writes {@code names.json}: maps each image file to a human-readable display name. */
    public static void writeNames(File versionDir, Map<String, String> names) throws IOException {
        if (names.isEmpty()) {
            return;
        }
        writeJson(new File(versionDir, "names.json"), GSON.toJsonTree(new TreeMap<>(names)));
    }

    public static Map<String, String> readHashes(File versionDir) throws IOException {
        File file = new File(versionDir, HASHES_FILE);
        if (!file.isFile()) {
            return new LinkedHashMap<>();
        }
        String content = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
        Map<String, String> parsed = GSON.fromJson(content, HASHES_TYPE);
        return parsed != null ? parsed : new LinkedHashMap<>();
    }

    /**
     * Diffs current vs previous hashes and writes {@code changes.json}.
     *
     * @return total number of changes written.
     */
    public static int writeChanges(File versionDir, String version, String previousVersion,
                                   Map<String, String> currentHashes, Map<String, String> previousHashes) throws IOException {
        List<String> added = new ArrayList<>();
        List<String> modified = new ArrayList<>();
        List<String> removed = new ArrayList<>();

        for (Map.Entry<String, String> entry : currentHashes.entrySet()) {
            String file = entry.getKey();
            if (!previousHashes.containsKey(file)) {
                added.add(file);
            } else if (!previousHashes.get(file).equals(entry.getValue())) {
                modified.add(file);
            }
        }
        for (String file : previousHashes.keySet()) {
            if (!currentHashes.containsKey(file)) {
                removed.add(file);
            }
        }

        Collections.sort(added);
        Collections.sort(modified);
        Collections.sort(removed);

        JsonObject json = new JsonObject();
        json.addProperty("version", version);
        json.addProperty("previousVersion", previousVersion);
        json.add("added", toArray(added));
        json.add("modified", toArray(modified));
        json.add("removed", toArray(removed));
        int total = added.size() + modified.size() + removed.size();
        json.addProperty("totalChanges", total);
        json.addProperty("createdAt", Instant.now().toString());
        writeJson(new File(versionDir, CHANGES_FILE), json);
        return total;
    }

    private static JsonArray toArray(List<String> values) {
        JsonArray array = new JsonArray();
        for (String value : values) {
            array.add(value);
        }
        return array;
    }

    private static void writeJson(File file, JsonElement json) throws IOException {
        Files.write(file.toPath(), GSON.toJson(json).getBytes(StandardCharsets.UTF_8));
    }
}
