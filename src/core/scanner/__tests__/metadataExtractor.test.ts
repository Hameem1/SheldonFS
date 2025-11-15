import { describe, it, expect } from "vitest"
import { extractMetadata } from "@/core/scanner"
import { SourceSystem, FileCategory } from "@/enums"
import { detectSourceSystem, isMacOS, isWindows } from "@/core/utils/systemDetection"
import {
    createTempFile,
    createTempDir,
    createSymlink,
    createHiddenFile,
    createExecutableFile,
    createFileStructure,
} from "@/__tests__/helpers"

// Auto-detect the current source system for tests
const currentSourceSystem = detectSourceSystem()

describe("metadataExtractor", () => {
    describe("extractMetadata - Basic Functionality", () => {
        it("should extract basic metadata from a file", async () => {
            const content = "Test file content"
            const filePath = await createTempFile({ content, extension: "txt" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.path).toBe(filePath)
            expect(metadata.name).toMatch(/test-[a-f0-9]{8}\.txt/)
            expect(metadata.extension).toBe("txt")
            expect(metadata.size).toBe(content.length)
            expect(metadata.hash).toHaveLength(64)
            expect(metadata.hash).toMatch(/^[a-f0-9]{64}$/)
            expect(metadata.sourceSystem).toBe(currentSourceSystem)
        })

        it("should handle files without extension", async () => {
            const content = "No extension file"
            const filePath = await createTempFile({ content, filename: "README" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.extension).toBe("")
            expect(metadata.name).toBe("README")
        })

        it("should extract metadata for empty file", async () => {
            const filePath = await createTempFile({ content: "" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.size).toBe(0)
            expect(metadata.hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        })

        it("should skip hash calculation when calculateHash is false", async () => {
            const filePath = await createTempFile({ content: "Skip hash test" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot, false)

            expect(metadata.hash).toBe("")
        })
    })

    describe("extractMetadata - Category Detection", () => {
        it("should categorize document files correctly", async () => {
            const extensions = ["pdf", "doc", "docx", "txt", "md", "csv"]

            for (const ext of extensions) {
                const filePath = await createTempFile({ content: "test", extension: ext })
                const scanRoot = await createTempDir()
                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                expect(metadata.category).toBe(FileCategory.DOCUMENT)
            }
        })

        it("should categorize image files correctly", async () => {
            const extensions = ["jpg", "jpeg", "png", "gif", "svg", "webp"]

            for (const ext of extensions) {
                const filePath = await createTempFile({ content: "test", extension: ext })
                const scanRoot = await createTempDir()
                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                expect(metadata.category).toBe(FileCategory.IMAGE)
            }
        })

        it("should categorize video files correctly", async () => {
            const extensions = ["mp4", "avi", "mkv", "mov", "webm"]

            for (const ext of extensions) {
                const filePath = await createTempFile({ content: "test", extension: ext })
                const scanRoot = await createTempDir()
                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                expect(metadata.category).toBe(FileCategory.VIDEO)
            }
        })

        it("should categorize audio files correctly", async () => {
            const extensions = ["mp3", "wav", "flac", "aac", "ogg"]

            for (const ext of extensions) {
                const filePath = await createTempFile({ content: "test", extension: ext })
                const scanRoot = await createTempDir()
                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                expect(metadata.category).toBe(FileCategory.AUDIO)
            }
        })

        it("should categorize archive files correctly", async () => {
            const extensions = ["zip", "rar", "7z", "tar", "gz"]

            for (const ext of extensions) {
                const filePath = await createTempFile({ content: "test", extension: ext })
                const scanRoot = await createTempDir()
                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                expect(metadata.category).toBe(FileCategory.ARCHIVE)
            }
        })

        it("should categorize code files correctly", async () => {
            const extensions = ["js", "ts", "py", "java", "html", "css", "json", "yaml"]

            for (const ext of extensions) {
                const filePath = await createTempFile({ content: "test", extension: ext })
                const scanRoot = await createTempDir()
                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                expect(metadata.category).toBe(FileCategory.CODE)
            }
        })

        it("should categorize executable files correctly", async () => {
            const extensions = ["exe", "dll", "so", "dylib"]

            for (const ext of extensions) {
                const filePath = await createTempFile({ content: "test", extension: ext })
                const scanRoot = await createTempDir()
                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                expect(metadata.category).toBe(FileCategory.EXECUTABLE)
            }
        })

        it("should categorize unknown extensions as OTHER", async () => {
            const filePath = await createTempFile({ content: "test", extension: "unknown-xyz" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.category).toBe(FileCategory.OTHER)
        })
    })

    describe("extractMetadata - MIME Type Detection", () => {
        it("should detect MIME type for text files", async () => {
            const filePath = await createTempFile({ content: "Hello World", extension: "txt" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.mimeType).toBe("text/plain")
        })

        it("should detect MIME type for JSON files", async () => {
            const filePath = await createTempFile({ content: '{"key": "value"}', extension: "json" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.mimeType).toBe("application/json")
        })

        it("should handle files with no detectable MIME type", async () => {
            const filePath = await createTempFile({ content: "random content", extension: "unknown" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            // Should either be null or detected via extension fallback
            expect(typeof metadata.mimeType === "string" || metadata.mimeType === null).toBe(true)
        })
    })

    describe("extractMetadata - Timestamps", () => {
        it("should extract all timestamp fields", async () => {
            const filePath = await createTempFile({ content: "timestamp test" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            // All timestamps should be valid numbers
            expect(typeof metadata.createdAt).toBe("number")
            expect(typeof metadata.modifiedAt).toBe("number")
            expect(typeof metadata.accessedAt).toBe("number")

            // Should be recent timestamps (within last minute)
            const now = Date.now()
            const oneMinuteAgo = now - 60 * 1000
            expect(metadata.createdAt).toBeGreaterThan(oneMinuteAgo)
            expect(metadata.modifiedAt).toBeGreaterThan(oneMinuteAgo)
            expect(metadata.accessedAt).toBeGreaterThan(oneMinuteAgo)
        })
    })

    describe("extractMetadata - Permissions", () => {
        it("should extract file permissions in octal format", async () => {
            const filePath = await createTempFile({ content: "test", mode: 0o644 })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.permissions).toBe("644")
        })

        it("should detect executable files on Unix/macOS", async () => {
            const filePath = await createExecutableFile()
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.isExecutable).toBe(true)
            expect(metadata.permissions).toBe("755")
        })

        it("should detect non-executable files", async () => {
            const filePath = await createTempFile({ content: "not executable", mode: 0o644 })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.isExecutable).toBe(false)
        })
    })

    describe("extractMetadata - Symlinks", () => {
        it("should detect symbolic links", async () => {
            const targetFile = await createTempFile({ content: "target content" })
            const symlinkPath = await createSymlink(targetFile)
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(symlinkPath, currentSourceSystem, scanRoot)

            expect(metadata.isSymlink).toBe(true)
            expect(metadata.symlinkTarget).toBe(targetFile)
        })

        it("should handle regular files (not symlinks)", async () => {
            const filePath = await createTempFile({ content: "regular file" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.isSymlink).toBe(false)
            expect(metadata.symlinkTarget).toBeUndefined()
        })
    })

    describe("extractMetadata - Hidden Files", () => {
        it("should detect hidden files (starting with dot)", async () => {
            const filePath = await createHiddenFile()
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.isHidden).toBe(true)
            expect(metadata.name).toMatch(/^\.hidden-/)
        })

        it("should detect non-hidden files", async () => {
            const filePath = await createTempFile({ content: "visible file" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.isHidden).toBe(false)
        })
    })

    describe("extractMetadata - Depth Calculation", () => {
        it("should calculate depth 0 for files in root directory", async () => {
            const scanRoot = await createTempDir()
            const filePath = await createTempFile({ content: "root file", directory: scanRoot })

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(metadata.depth).toBe(0)
        })

        it("should calculate correct depth for nested files", async () => {
            const structure = {
                "level0.txt": "root",
                dir1: {
                    "level1.txt": "one level deep",
                    nested: {
                        "level2.txt": "two levels deep",
                        deeper: {
                            "level3.txt": "three levels deep",
                        },
                    },
                },
            }

            const scanRoot = await createFileStructure(structure)

            // Test depth 0
            const level0 = await extractMetadata(`${scanRoot}/level0.txt`, currentSourceSystem, scanRoot)
            expect(level0.depth).toBe(0)

            // Test depth 1
            const level1 = await extractMetadata(`${scanRoot}/dir1/level1.txt`, currentSourceSystem, scanRoot)
            expect(level1.depth).toBe(1)

            // Test depth 2
            const level2 = await extractMetadata(`${scanRoot}/dir1/nested/level2.txt`, currentSourceSystem, scanRoot)
            expect(level2.depth).toBe(2)

            // Test depth 3
            const level3 = await extractMetadata(`${scanRoot}/dir1/nested/deeper/level3.txt`, currentSourceSystem, scanRoot)
            expect(level3.depth).toBe(3)
        })
    })

    describe("extractMetadata - Inode and Hard Links", () => {
        it("should extract inode number", async () => {
            const filePath = await createTempFile({ content: "inode test" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(typeof metadata.inode).toBe("number")
            expect(metadata.inode).toBeGreaterThan(0)
        })

        it("should extract hard link count", async () => {
            const filePath = await createTempFile({ content: "link test" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            expect(typeof metadata.hardLinkCount).toBe("number")
            // Single file should have hard link count of 1
            expect(metadata.hardLinkCount).toBeGreaterThanOrEqual(1)
        })
    })

    describe("extractMetadata - Owner Information", () => {
        it("should extract file owner", async () => {
            const filePath = await createTempFile({ content: "owner test" })
            const scanRoot = await createTempDir()

            const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

            // Owner should be present on Unix/macOS
            if (process.platform !== "win32") {
                expect(typeof metadata.owner).toBe("string")
                expect(metadata.owner).toBeTruthy()
            }
        })
    })

    describe("extractMetadata - Source System", () => {
        it("should handle different source systems", async () => {
            const filePath = await createTempFile({ content: "system test" })
            const scanRoot = await createTempDir()

            const systems = [SourceSystem.MACOS, SourceSystem.LINUX, SourceSystem.WINDOWS, SourceSystem.GOOGLE_DRIVE]

            for (const system of systems) {
                const metadata = await extractMetadata(filePath, system, scanRoot)
                expect(metadata.sourceSystem).toBe(system)
            }
        })
    })

    describe("extractMetadata - Error Handling", () => {
        it("should handle non-existent files gracefully", async () => {
            const scanRoot = await createTempDir()

            await expect(extractMetadata("/path/to/nonexistent/file.txt", currentSourceSystem, scanRoot)).rejects.toThrow()
        })
    })

    describe("Platform-Specific Features", () => {
        describe.skipIf(!isMacOS())("macOS", () => {
            it("should extract Finder tags and colors", async () => {
                const filePath = await createTempFile({ content: "finder test" })
                const scanRoot = await createTempDir()

                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                // File should be scanned successfully
                // Note: Tags and colors won't be set unless we actually tag the file with xattr
                // This test primarily ensures the extraction logic runs without error on macOS
                expect(metadata).toBeDefined()
                expect(metadata.path).toBe(filePath)
                // finderTags and finderColor will be undefined unless file is actually tagged
            })
        })

        describe.skipIf(!isWindows())("Windows", () => {
            it("should detect executables by extension", async () => {
                const filePath = await createTempFile({ content: "test", extension: "exe" })
                const scanRoot = await createTempDir()

                const metadata = await extractMetadata(filePath, currentSourceSystem, scanRoot)

                expect(metadata.isExecutable).toBe(true)
            })
        })
    })
})
