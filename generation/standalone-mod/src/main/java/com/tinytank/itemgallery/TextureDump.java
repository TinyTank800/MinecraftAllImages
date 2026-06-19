package com.tinytank.itemgallery;

import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.packs.resources.Resource;
import net.minecraft.server.packs.resources.ResourceManager;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.Map;

/**
 * Dumps raw texture PNGs straight from the loaded resource packs. This is the easy, reliable way to
 * grab particle textures, fluid textures, or any other texture category, since they already exist as
 * transparent PNGs on disk/in resource packs (no rendering required).
 *
 * <p>Note: textures are copied verbatim. Some (e.g. animated particles, {@code water_still}) are
 * vertical strips of frames, and fluid textures are grayscale and biome-tinted at render time, so
 * they will look un-tinted here.
 */
public final class TextureDump {

    private TextureDump() {
    }

    /**
     * Copies every {@code .png} under {@code textures/<subPath>} into
     * {@code <versionDir>/dumped/<namespace>/<relative-path>}.
     *
     * @return the number of textures written.
     */
    public static int dump(File versionDir, ResourceManager resourceManager, String subPath) throws IOException {
        String root = "textures/" + subPath;
        Map<ResourceLocation, Resource> resources =
                resourceManager.listResources(root, location -> location.getPath().endsWith(".png"));

        int count = 0;
        for (Map.Entry<ResourceLocation, Resource> entry : resources.entrySet()) {
            ResourceLocation location = entry.getKey();
            // textures/particle/flame.png -> particle/flame.png
            String relative = location.getPath().substring("textures/".length());
            File out = new File(versionDir, "dumped/" + location.getNamespace() + "/" + relative);
            File parent = out.getParentFile();
            if (parent != null) {
                parent.mkdirs();
            }
            try (InputStream in = entry.getValue().open()) {
                Files.write(out.toPath(), in.readAllBytes());
            }
            copyMcmetaIfPresent(resourceManager, location, out);
            count++;
        }
        return count;
    }

    private static void copyMcmetaIfPresent(ResourceManager resourceManager, ResourceLocation pngLocation, File pngOut)
            throws IOException {
        ResourceLocation mcmetaLocation = ResourceLocation.fromNamespaceAndPath(
                pngLocation.getNamespace(), pngLocation.getPath() + ".mcmeta");
        Resource mcmeta = resourceManager.getResource(mcmetaLocation).orElse(null);
        if (mcmeta == null) {
            return;
        }
        File mcmetaOut = new File(pngOut.getAbsolutePath() + ".mcmeta");
        try (InputStream in = mcmeta.open()) {
            Files.write(mcmetaOut.toPath(), in.readAllBytes());
        }
    }
}
