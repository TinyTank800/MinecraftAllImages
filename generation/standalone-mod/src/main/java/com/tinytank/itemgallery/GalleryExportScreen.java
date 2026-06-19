package com.tinytank.itemgallery;

import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.systems.RenderSystem;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.ItemEnchantments;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.NbtOps;
import net.minecraft.nbt.Tag;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import org.jetbrains.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import net.minecraft.core.component.DataComponentPatch;

/**
 * A temporary screen that exports one icon per frame.
 *
 * <p>Each frame it draws the next entry over a black and a white background at the top-left of the
 * screen, reads both back from the main framebuffer, recovers true color + alpha (so translucent
 * items like glass come out correctly), hashes the result and writes a PNG. When the queue is empty
 * it writes the gallery manifest/changes files and closes.
 *
 * <p>In {@code variants} mode it iterates the creative search tab, capturing every component variant
 * of every item (light levels, potions, enchanted books, tipped arrows, banners, ...), with each
 * variant getting a stable {@code name__<hash>.png} filename.
 */
@Environment(EnvType.CLIENT)
public class GalleryExportScreen extends Screen {

    private static final Logger LOGGER = LoggerFactory.getLogger("itemgalleryexporter");

    // The item is rendered over each of these (opaque ARGB) backgrounds so true alpha can be recovered.
    private static final int BG_BLACK = 0xFF000000;
    private static final int BG_WHITE = 0xFFFFFFFF;

    @FunctionalInterface
    private interface Drawer {
        void draw(GuiGraphics guiGraphics);
    }

    private record Task(String fileBaseName, String displayName, Drawer drawer) {
    }

    private final String version;
    private final int scale;

    private final File galleryRoot;
    private final File versionDir;
    private final Deque<Task> queue = new ArrayDeque<>();
    private final Map<String, String> hashes = new TreeMap<>();
    private final Map<String, String> names = new TreeMap<>();
    private final int total;
    private int processed = 0;
    private int failures = 0;
    private boolean started = false;
    private boolean done = false;

    // Reused full-framebuffer scratch image so we don't allocate one per pass per item.
    @Nullable
    private NativeImage fullCapture = null;

    public GalleryExportScreen(String version, int scale, @Nullable String namespace, boolean variants) {
        super(Component.literal("Item Gallery Export"));
        this.version = version;
        this.scale = scale;

        this.galleryRoot = new File(Minecraft.getInstance().gameDirectory, "gallery-export");
        this.versionDir = new File(this.galleryRoot, version);
        this.versionDir.mkdirs();

        if (variants) {
            buildVariantTasks(namespace);
        } else {
            buildDefaultTasks(namespace);
        }
        this.total = this.queue.size();
        LOGGER.info("[ItemGallery] Queued {} icons ({}) for export to {}",
                this.total, variants ? "variants" : "default", this.versionDir.getAbsolutePath());
    }

    /** One default stack per registered item (complete, one icon each). */
    private void buildDefaultTasks(@Nullable String namespace) {
        Minecraft mc = Minecraft.getInstance();
        HolderLookup.Provider registryAccess = mc.level.registryAccess();
        for (Map.Entry<ResourceKey<Item>, Item> entry : BuiltInRegistries.ITEM.entrySet()) {
            ResourceLocation id = entry.getKey().location();
            if (namespace != null && !id.getNamespace().equals(namespace)) {
                continue;
            }
            ItemStack stack = new ItemStack(entry.getValue());
            String name = galleryName(id);
            String label = displayLabel(id, stack, registryAccess);
            this.names.put(name + ".png", label);
            this.queue.add(new Task(name, label, g -> g.renderItem(stack, 0, 0)));
        }
    }

    /** Every component variant from the creative search tab, plus any registry items not covered. */
    private void buildVariantTasks(@Nullable String namespace) {
        Minecraft mc = Minecraft.getInstance();
        HolderLookup.Provider registryAccess = mc.level.registryAccess();

        CreativeModeTabs.tryRebuildTabContents(
                mc.level.enabledFeatures(),
                mc.options.operatorItemsTab().get(),
                registryAccess);

        Set<String> usedNames = new HashSet<>();
        Set<Item> seenItems = new HashSet<>();

        for (ItemStack stack : CreativeModeTabs.searchTab().getSearchTabDisplayItems()) {
            ResourceLocation id = BuiltInRegistries.ITEM.getKey(stack.getItem());
            if (namespace != null && !id.getNamespace().equals(namespace)) {
                continue;
            }
            seenItems.add(stack.getItem());
            String name = variantName(id, stack, registryAccess);
            if (!usedNames.add(name)) {
                continue; // duplicate variant
            }
            ItemStack captured = stack.copy();
            String label = displayLabel(id, captured, registryAccess);
            this.names.put(name + ".png", label);
            this.queue.add(new Task(name, label, g -> g.renderItem(captured, 0, 0)));
        }

        // Include items that aren't in the search tab (air, technical blocks, ...) as default stacks.
        for (Map.Entry<ResourceKey<Item>, Item> entry : BuiltInRegistries.ITEM.entrySet()) {
            ResourceLocation id = entry.getKey().location();
            if (namespace != null && !id.getNamespace().equals(namespace)) {
                continue;
            }
            if (seenItems.contains(entry.getValue())) {
                continue;
            }
            String name = galleryName(id);
            if (!usedNames.add(name)) {
                continue;
            }
            ItemStack stack = new ItemStack(entry.getValue());
            String label = displayLabel(id, stack, registryAccess);
            this.names.put(name + ".png", label);
            this.queue.add(new Task(name, label, g -> g.renderItem(stack, 0, 0)));
        }
    }

    /** Base name for an empty stack, or {@code base__<slug>__<hash>} when the stack carries data components. */
    private static String variantName(ResourceLocation id, ItemStack stack, HolderLookup.Provider registryAccess) {
        String base = galleryName(id);
        DataComponentPatch patch = stack.getComponentsPatch();
        if (patch.isEmpty()) {
            return base;
        }
        String serialized;
        try {
            Tag tag = DataComponentPatch.CODEC
                    .encodeStart(registryAccess.createSerializationContext(NbtOps.INSTANCE), patch)
                    .getOrThrow();
            serialized = tag.toString();
        } catch (Exception e) {
            serialized = patch.toString();
        }
        String hash = ImageExport.md5Hex(serialized).substring(0, 8);
        String slug = slugifyDisplayName(displayLabel(id, stack, registryAccess));
        if (slug.isEmpty() || slug.equals(base)) {
            return base + "__" + hash;
        }
        return base + "__" + slug + "__" + hash;
    }

    /** Readable hover name, with extra detail for generic enchanted books. */
    private static String displayLabel(ResourceLocation id, ItemStack stack, HolderLookup.Provider registryAccess) {
        String hover = stack.getHoverName().getString();
        if ("minecraft".equals(id.getNamespace()) && "enchanted_book".equals(id.getPath())) {
            ItemEnchantments enchants = stack.get(DataComponents.STORED_ENCHANTMENTS);
            if (enchants != null && !enchants.isEmpty()) {
                String detail = enchants.entrySet().stream()
                        .map(entry -> Enchantment.getFullname(entry.getKey(), entry.getIntValue()).getString())
                        .collect(Collectors.joining(", "));
                if (!detail.isEmpty()) {
                    return "Enchanted Book (" + detail + ")";
                }
            }
        }
        return hover;
    }

    /** Lowercase slug for embedding variant info in filenames (max 48 chars). */
    private static String slugifyDisplayName(String display) {
        String slug = display.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "")
                .replaceAll("_+", "_");
        if (slug.length() > 48) {
            slug = slug.substring(0, 48).replaceAll("_+$", "");
        }
        return slug;
    }

    /** Plain item path for vanilla, {@code namespace__path} for modded, to avoid collisions. */
    private static String galleryName(ResourceLocation id) {
        if ("minecraft".equals(id.getNamespace())) {
            return id.getPath();
        }
        return id.getNamespace() + "__" + id.getPath();
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    @Override
    public boolean shouldCloseOnEsc() {
        // Prevent an accidental Escape from aborting a long export and leaving a partial directory
        // with no manifest/hashes/changes files.
        return false;
    }

    @Override
    public void removed() {
        if (this.fullCapture != null) {
            this.fullCapture.close();
            this.fullCapture = null;
        }
        super.removed();
    }

    @Override
    public void render(GuiGraphics guiGraphics, int mouseX, int mouseY, float partialTick) {
        guiGraphics.fill(0, 0, this.width, this.height, 0xFF101010);
        guiGraphics.drawCenteredString(this.font,
                done ? "Finishing..." : ("Exporting " + processed + " / " + total),
                this.width / 2, this.height / 2, 0xFFFFFFFF);

        if (done) {
            return;
        }
        if (!started) {
            started = true;
            LOGGER.info("[ItemGallery] render() running, beginning export of {} icons...", total);
        }
        if (queue.isEmpty()) {
            finish();
            return;
        }

        Task task = queue.poll();
        try {
            exportOne(guiGraphics, task);
        } catch (Throwable t) {
            failures++;
            if (failures <= 5) {
                LOGGER.error("[ItemGallery] Failed to export {}", task.fileBaseName(), t);
            }
        }
        processed++;
        if (processed % 250 == 0) {
            LOGGER.info("[ItemGallery] Progress {} / {} ({} written, {} failures)",
                    processed, total, hashes.size(), failures);
        }
    }

    private void exportOne(GuiGraphics guiGraphics, Task task) throws Exception {
        Minecraft mc = Minecraft.getInstance();
        RenderTarget rt = mc.getMainRenderTarget();
        if (this.scale > rt.width || this.scale > rt.height) {
            return; // window smaller than icon size
        }

        double guiScale = mc.getWindow().getGuiScale();
        // Scale the 16x16 GUI-unit drawing so it occupies exactly `scale` physical pixels.
        float k = (float) (this.scale / (16.0 * guiScale));
        int coverGui = (int) Math.ceil(this.scale / guiScale) + 1;

        NativeImage overBlack = capturePass(guiGraphics, task.drawer(), BG_BLACK, k, coverGui, rt);
        NativeImage overWhite = capturePass(guiGraphics, task.drawer(), BG_WHITE, k, coverGui, rt);
        try {
            String hash = ImageExport.unmixHashAndWrite(
                    overBlack, overWhite, this.scale, new File(this.versionDir, task.fileBaseName() + ".png"));
            this.hashes.put(task.fileBaseName() + ".png", hash);
        } finally {
            overBlack.close();
            overWhite.close();
        }
    }

    /** Draws the task over the given background, reads back the top-left crop, returns it. */
    private NativeImage capturePass(GuiGraphics guiGraphics, Drawer drawer, int bgArgb, float k, int coverGui, RenderTarget rt) {
        guiGraphics.fill(0, 0, coverGui, coverGui, bgArgb);
        guiGraphics.pose().pushPose();
        guiGraphics.pose().scale(k, k, 1.0F);
        drawer.draw(guiGraphics);
        guiGraphics.pose().popPose();

        guiGraphics.flush();

        NativeImage full = fullCapture(rt);
        RenderSystem.bindTexture(rt.getColorTextureId());
        full.downloadTexture(0, false);
        full.flipY();
        return ImageExport.crop(full, this.scale);
    }

    /** Lazily allocates (and reuses) the full-framebuffer scratch image, reallocating only on resize. */
    private NativeImage fullCapture(RenderTarget rt) {
        if (this.fullCapture == null
                || this.fullCapture.getWidth() != rt.width
                || this.fullCapture.getHeight() != rt.height) {
            if (this.fullCapture != null) {
                this.fullCapture.close();
            }
            this.fullCapture = new NativeImage(rt.width, rt.height, false);
        }
        return this.fullCapture;
    }

    private void finish() {
        done = true;
        Minecraft mc = Minecraft.getInstance();
        try {
            File previousDir = GalleryManifest.detectPreviousVersionDir(this.galleryRoot, this.version);
            boolean isBase = previousDir == null;

            GalleryManifest.writeManifest(this.versionDir, this.version, isBase, new ArrayList<>(this.hashes.keySet()));
            GalleryManifest.writeHashes(this.versionDir, this.hashes);
            GalleryManifest.writeNames(this.versionDir, this.names);

            String message;
            if (previousDir != null) {
                Map<String, String> previousHashes = GalleryManifest.readHashes(previousDir);
                int totalChanges = GalleryManifest.writeChanges(
                        this.versionDir, this.version, previousDir.getName(), this.hashes, previousHashes);
                message = "Exported " + this.hashes.size() + " icons to " + this.versionDir.getAbsolutePath()
                        + " (" + totalChanges + " changes vs " + previousDir.getName() + ")";
            } else {
                message = "Exported " + this.hashes.size() + " icons to " + this.versionDir.getAbsolutePath()
                        + " (base version, no changes.json)";
            }
            LOGGER.info("[ItemGallery] {}", message);
            mc.gui.getChat().addMessage(Component.literal(message));
        } catch (Exception e) {
            LOGGER.error("[ItemGallery] Export finalize failed", e);
            mc.gui.getChat().addMessage(Component.literal("Item gallery export failed: " + e.getMessage()));
        }
        mc.setScreen(null);
    }
}
