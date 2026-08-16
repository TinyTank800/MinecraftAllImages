plugins {
    // This plugin applies the correct loom variant based on the Minecraft version
    id("dev.kikugie.loom-back-compat")
}

// DO NOT set group = ...!
version = "${property("mod.version")}+${sc.current.version}"
base.archivesName = "itemgallery-exporter"

val requiredJava: JavaVersion = when {
    sc.current.parsed >= "26.1" -> JavaVersion.VERSION_25
    sc.current.parsed >= "1.20.5" -> JavaVersion.VERSION_21
    sc.current.parsed >= "1.18" -> JavaVersion.VERSION_17
    else -> JavaVersion.VERSION_16
}

repositories {
    mavenCentral()
}

dependencies {
    /**
     * Fetches only the required Fabric API modules to not waste time downloading all of them for each version.
     * @see <a href="https://github.com/FabricMC/fabric">List of Fabric API modules</a>
     */
    fun fapi(vararg modules: String) {
        for (it in modules) modImplementation(fabricApi.module(it, sc.properties["deps.fabric_api"]))
    }

    minecraft("com.mojang:minecraft:${sc.current.version}")
    // Applies Mojang Mappings on obfuscated versions
    loomx.applyMojangMappings()

    // Use `mod{dependency type}` even on 26.1+ - loom-back-compat converts them
    modImplementation("net.fabricmc:fabric-loader:${property("deps.fabric_loader")}")
    fapi("fabric-lifecycle-events-v1", "fabric-command-api-v2")
}

loom {
    fabricModJsonPath = rootProject.file("src/main/resources/fabric.mod.json")

    runConfigs.all {
        preferGradleTask = true
        generateRunConfig = true
        runDirectory = rootProject.file("run") // Shares the run directory between versions
    }
}

java {
    withSourcesJar()
    targetCompatibility = requiredJava
    sourceCompatibility = requiredJava

    toolchain {
        vendor = JvmVendorSpec.ADOPTIUM
        languageVersion = JavaLanguageVersion.of(requiredJava.majorVersion)
    }
}

// Compile every version from the stonecutter-generated source tree instead of the root src. The
// root src is the "active" (editable) version and is not a valid compile target for other versions:
// its version markers are comments and its replacements (e.g. GuiGraphics -> GuiGraphicsExtractor)
// are only applied by the generate task. The generated tree is complete and correct for each version.
sourceSets {
    main {
        java.setSrcDirs(listOf(file("build/generated/stonecutter/main/java")))
        resources.setSrcDirs(listOf(file("build/generated/stonecutter/main/resources")))
    }
}

tasks {
    named("compileJava") { dependsOn("stonecutterGenerate") }
    named("processResources") { dependsOn("stonecutterGenerate") }
    named("sourcesJar") { dependsOn("stonecutterGenerate") }
    named("jar") { dependsOn("stonecutterGenerate") }
    processResources {
        fun MutableMap<String, String>.register(key: String, property: String) {
            val value: String = sc.properties[property]
            inputs.property(key, value)
            set(key, value)
        }

        val props = buildMap {
            register("id", "mod.id")
            register("name", "mod.name")
            register("version", "mod.version")
            register("minecraft", "mod.mc_compat")
        }

        filesMatching("fabric.mod.json") { expand(props) }
    }

    jar {
        // Bundle the license into the jar if one is present.
        if (file("LICENSE").exists()) {
            from("LICENSE") {
                rename { "${it}_itemgalleryexporter" }
            }
        }
    }

    register<Copy>("buildAndCollect") {
        group = "build"
        description = "Builds mod jars and copies results to `build/libs/{mod version}/`"

        inputs.property("version", project.property("mod.version"))
        // loomx.mod(Sources)Jar returns the jar task for the applied loom variant
        from(loomx.modJar.flatMap { it.archiveFile }, loomx.modSourcesJar.flatMap { it.archiveFile })
        into(rootProject.layout.buildDirectory.file("libs/${project.property("mod.version")}"))
    }
}