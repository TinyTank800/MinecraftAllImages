plugins {
    id("dev.kikugie.stonecutter")
}

stonecutter active "26.2.x"

// See https://stonecutter.kikugie.dev/wiki/config/params
stonecutter parameters {
    replacements {
        string(current.parsed >= "1.21.11") {
            replace("ResourceLocation", "Identifier")
        }
        string(current.parsed >= "26.1") {
            replace("GuiGraphics", "GuiGraphicsExtractor")
        }
        string(current.parsed >= "26.1") {
            replace("ClientCommandManager", "ClientCommands")
        }
    }
}