package com.tinytank.itemgallery;

import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import org.jetbrains.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;

/**
 * Standalone, dependency-free (Fabric API only) item icon exporter for the React item gallery.
 *
 * <p>Registers the client command:
 * <ul>
 *     <li>{@code /itemgallery export <version> [scale] [all]} - one icon per item (default stack)</li>
 *     <li>{@code /itemgallery variants <version> [scale] [all]} - every component variant
 *         (light levels, potions, enchanted books, tipped arrows, banners, ...) from the creative
 *         search tab; variants get {@code name__<slug>__<hash>.png} (or {@code name__<hash>.png})
 *         plus a readable {@code names.json}</li>
 *     <li>{@code /itemgallery dumptextures <version> [subpath]} - copy raw texture PNGs (default
 *         {@code particle}) straight from the loaded resources; handy for particles and fluid textures</li>
 * </ul>
 *
 * <p>Item output goes to {@code <minecraft>/gallery-export/<version>/} and matches the gallery's
 * expected {@code manifest.json} / {@code hashes.json} / {@code changes.json} layout. Dumped textures
 * go to {@code <minecraft>/gallery-export/<version>/dumped/}.
 */
public class ItemGalleryMod implements ClientModInitializer {

    private static final Logger LOGGER = LoggerFactory.getLogger("itemgalleryexporter");
    public static final int DEFAULT_SCALE = 32;

    // Set by the command, consumed on the next client tick so the chat screen has fully closed first.
    @Nullable
    private static volatile PendingExport pending = null;

    @Override
    public void onInitializeClient() {
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) ->
                dispatcher.register(ClientCommandManager.literal("itemgallery")
                        .then(buildExport("export", false))
                        .then(buildExport("variants", true))
                        .then(ClientCommandManager.literal("dumptextures")
                                .then(ClientCommandManager.argument("version", StringArgumentType.word())
                                        .executes(ctx -> dumpTextures(ctx.getSource(),
                                                StringArgumentType.getString(ctx, "version"), "particle"))
                                        .then(ClientCommandManager.argument("subpath", StringArgumentType.greedyString())
                                                .executes(ctx -> dumpTextures(ctx.getSource(),
                                                        StringArgumentType.getString(ctx, "version"),
                                                        StringArgumentType.getString(ctx, "subpath"))))))));

        // Open the export screen on the next client tick (after the chat screen has closed).
        ClientTickEvents.END_CLIENT_TICK.register(mc -> {
            PendingExport req = pending;
            if (req == null) {
                return;
            }
            pending = null;
            LOGGER.info("[ItemGallery] Opening export screen for {} (scale {}, namespace {}, variants {})",
                    req.version, req.scale, req.namespace == null ? "<all>" : req.namespace, req.variants);
            mc.setScreen(new GalleryExportScreen(req.version, req.scale, req.namespace, req.variants));
        });
    }

    private LiteralArgumentBuilder<FabricClientCommandSource> buildExport(String name, boolean variants) {
        return ClientCommandManager.literal(name)
                .then(ClientCommandManager.argument("version", StringArgumentType.word())
                        .executes(ctx -> start(ctx.getSource(),
                                StringArgumentType.getString(ctx, "version"), DEFAULT_SCALE, "minecraft", variants))
                        .then(ClientCommandManager.argument("scale", IntegerArgumentType.integer(1))
                                .executes(ctx -> start(ctx.getSource(),
                                        StringArgumentType.getString(ctx, "version"),
                                        IntegerArgumentType.getInteger(ctx, "scale"), "minecraft", variants))
                                .then(ClientCommandManager.literal("all")
                                        .executes(ctx -> start(ctx.getSource(),
                                                StringArgumentType.getString(ctx, "version"),
                                                IntegerArgumentType.getInteger(ctx, "scale"), null, variants)))));
    }

    private int start(FabricClientCommandSource source, String version, int scale, @Nullable String namespace, boolean variants) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.level == null) {
            source.sendError(Component.literal("Join a world first so items can be rendered."));
            return 0;
        }
        LOGGER.info("[ItemGallery] Command received: version={}, scale={}, namespace={}, variants={}",
                version, scale, namespace == null ? "<all>" : namespace, variants);
        pending = new PendingExport(version, scale, namespace, variants);
        source.sendFeedback(Component.literal("Starting item gallery " + (variants ? "variants " : "") + "export for "
                + version + " (scale " + scale + ", " + (namespace == null ? "all namespaces" : namespace) + ")..."));
        return 1;
    }

    private int dumpTextures(FabricClientCommandSource source, String version, String subPath) {
        Minecraft mc = Minecraft.getInstance();
        String cleaned = subPath.trim().replace('\\', '/').replaceAll("^/+|/+$", "");
        File versionDir = new File(new File(mc.gameDirectory, "gallery-export"), version);
        versionDir.mkdirs();
        try {
            int count = TextureDump.dump(versionDir, mc.getResourceManager(), cleaned);
            String message = "Dumped " + count + " textures from textures/" + cleaned
                    + " to " + new File(versionDir, "dumped").getAbsolutePath();
            LOGGER.info("[ItemGallery] {}", message);
            source.sendFeedback(Component.literal(message));
            return 1;
        } catch (Exception e) {
            LOGGER.error("[ItemGallery] Texture dump failed", e);
            source.sendError(Component.literal("Texture dump failed: " + e.getMessage()));
            return 0;
        }
    }

    private record PendingExport(String version, int scale, @Nullable String namespace, boolean variants) {
    }
}
