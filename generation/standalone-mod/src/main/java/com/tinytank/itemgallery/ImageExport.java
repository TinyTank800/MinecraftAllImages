package com.tinytank.itemgallery;

import com.mojang.blaze3d.platform.NativeImage;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Recovers true color + alpha for each icon pixel from two captures of the same item rendered over
 * a black and a white background, then hashes and writes the PNG.
 *
 * <p>For a pixel with straight color {@code F} and coverage/alpha {@code a} composited over a
 * background {@code B} (standard src-over blending): {@code O = F*a + B*(1-a)}.
 * Capturing over black ({@code B=0}) and white ({@code B=255}) gives:
 * <pre>
 *   O_black = F*a
 *   O_white = F*a + 255*(1-a)
 *   =>  a = 1 - (O_white - O_black)/255
 *   =>  F = O_black / a
 * </pre>
 * This correctly handles translucent items (glass, ice, slime, ...) and anti-aliased edges, unlike
 * a single-background color key.
 */
@Environment(EnvType.CLIENT)
public final class ImageExport {

    private ImageExport() {
    }

    /** Crops the top-left {@code scale x scale} region of a full framebuffer capture into a new image. */
    public static NativeImage crop(NativeImage full, int scale) {
        NativeImage cropped = new NativeImage(scale, scale, false);
        for (int y = 0; y < scale; y++) {
            for (int x = 0; x < scale; x++) {
                cropped.setPixelRGBA(x, y, full.getPixelRGBA(x, y));
            }
        }
        return cropped;
    }

    /**
     * Combines the over-black and over-white captures into a straight-alpha image, hashes the
     * pixels, and writes the PNG.
     *
     * @return the MD5 hex hash of the final RGBA pixels (used to diff versions)
     */
    public static String unmixHashAndWrite(NativeImage overBlack, NativeImage overWhite, int scale, File out) throws IOException {
        NativeImage image = new NativeImage(scale, scale, false);
        try {
            for (int y = 0; y < scale; y++) {
                for (int x = 0; x < scale; x++) {
                    image.setPixelRGBA(x, y, unmixPixel(overBlack.getPixelRGBA(x, y), overWhite.getPixelRGBA(x, y)));
                }
            }
            String hash = hashPixels(image, scale);
            image.writeToFile(out);
            return hash;
        } finally {
            image.close();
        }
    }

    /**
     * Un-mixes one pixel. Inputs are NativeImage ABGR ints captured over black and white backgrounds
     * (their own alpha is ignored, since the framebuffer is opaque). Returns a straight-alpha ABGR int.
     */
    private static int unmixPixel(int black, int white) {
        int rb = black & 0xFF, gb = (black >>> 8) & 0xFF, bb = (black >>> 16) & 0xFF;
        int rw = white & 0xFF, gw = (white >>> 8) & 0xFF, bw = (white >>> 16) & 0xFF;

        // (O_white - O_black) ~= 255 * (1 - a) per channel; average the three for stability.
        int diff = ((rw - rb) + (gw - gb) + (bw - bb));
        double oneMinusA = clamp01(diff / (3.0 * 255.0));
        double a = 1.0 - oneMinusA;

        if (a <= 0.0001) {
            return 0; // fully transparent
        }

        // O_black = F * a  =>  F = O_black / a  (un-premultiply to straight color)
        int r = clamp255((int) Math.round(rb / a));
        int g = clamp255((int) Math.round(gb / a));
        int b = clamp255((int) Math.round(bb / a));
        int alpha = clamp255((int) Math.round(a * 255.0));

        return (alpha << 24) | (b << 16) | (g << 8) | r;
    }

    private static double clamp01(double v) {
        return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    private static int clamp255(int v) {
        return v < 0 ? 0 : (v > 255 ? 255 : v);
    }

    private static String hashPixels(NativeImage image, int scale) {
        byte[] bytes = new byte[scale * scale * 4];
        int i = 0;
        for (int y = 0; y < scale; y++) {
            for (int x = 0; x < scale; x++) {
                int color = image.getPixelRGBA(x, y);
                bytes[i++] = (byte) ((color >> 24) & 0xFF);
                bytes[i++] = (byte) ((color >> 16) & 0xFF);
                bytes[i++] = (byte) ((color >> 8) & 0xFF);
                bytes[i++] = (byte) (color & 0xFF);
            }
        }
        return md5Hex(bytes);
    }

    /** MD5 hex of a string (used to derive stable, unique filename suffixes for item variants). */
    public static String md5Hex(String text) {
        return md5Hex(text.getBytes(StandardCharsets.UTF_8));
    }

    private static String md5Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 not available", e);
        }
    }
}
