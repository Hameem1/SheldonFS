import { describe, it, expect, beforeEach } from "vitest"
import { FileScanner } from "../fileScanner"
import { SourceSystem, FileCategory } from "@/enums"
import type { ScanOptions, ScanProgressCallback } from "@/types"
import { createTempDir, createTempFile, createFileStructure, createHiddenFile, detectSourceSystem } from "@/__tests__/helpers"

// Auto-detect the current source system for tests
const currentSourceSystem = detectSourceSystem()

describe("FileScanner", () => {
    let scanner: FileScanner

    beforeEach(() => {
        scanner = new FileScanner()
    })

    describe("scan - Basic Functionality", () => {
        it("should scan empty directory", async () => {
            const scanPath = await createTempDir()

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const files = await scanner.scan(options)

            expect(files).toEqual([])
        })

        it("should scan directory with single file", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "single file", directory: scanPath })

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const files = await scanner.scan(options)

            expect(files).toHaveLength(1)
            expect(files[0]?.name).toMatch(/test-[a-f0-9]{8}\.txt/)
            expect(files[0]?.size).toBe(11) // "single file" = 11 bytes
            expect(files[0]?.sourceSystem).toBe(currentSourceSystem)
        })

        it("should scan nested directory structure", async () => {
            const structure = {
                "file1.txt": "content1",
                "file2.txt": "content2",
                dir1: {
                    "file3.txt": "content3",
                    nested: {
                        "file4.txt": "content4",
                        "file5.txt": "content5",
                    },
                },
                dir2: {
                    "file6.txt": "content6",
                },
            }

            const scanPath = await createFileStructure(structure)

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const files = await scanner.scan(options)

            expect(files).toHaveLength(6)

            // Verify all files were found
            const fileNames = files.map((f) => f.name).sort()
            expect(fileNames).toEqual(["file1.txt", "file2.txt", "file3.txt", "file4.txt", "file5.txt", "file6.txt"])
        })
    })

    describe("scan - Hidden Files", () => {
        it("should exclude hidden files by default", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "visible", directory: scanPath })
            await createHiddenFile("hidden content", scanPath)

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const files = await scanner.scan(options)

            // Should only find the visible file
            expect(files).toHaveLength(1)
            expect(files[0]?.isHidden).toBe(false)
        })

        it("should include hidden files when includeHidden is true", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "visible", directory: scanPath })
            await createHiddenFile("hidden content", scanPath)

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
                includeHidden: true,
            }

            const files = await scanner.scan(options)

            // Should find both files
            expect(files).toHaveLength(2)

            const hiddenFiles = files.filter((f) => f.isHidden)
            const visibleFiles = files.filter((f) => !f.isHidden)

            expect(hiddenFiles).toHaveLength(1)
            expect(visibleFiles).toHaveLength(1)
        })
    })

    describe("scan - Exclusion Patterns", () => {
        it("should respect default exclusion patterns", async () => {
            const structure = {
                "normal.txt": "include this",
                node_modules: {
                    "package.json": "exclude this",
                },
                ".git": {
                    config: "exclude this",
                },
            }

            const scanPath = await createFileStructure(structure)

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
                includeHidden: true, // Allow hidden files, but still exclude .git
            }

            const files = await scanner.scan(options)

            // Should only find normal.txt (node_modules and .git are excluded by default)
            expect(files).toHaveLength(1)
            expect(files[0]?.name).toBe("normal.txt")
        })

        it("should respect custom exclusion patterns", async () => {
            const structure = {
                "include.txt": "include",
                "exclude.log": "exclude",
                "data.json": "include",
                logs: {
                    "app.log": "exclude",
                },
            }

            const scanPath = await createFileStructure(structure)

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
                excludePatterns: ["**/*.log", "**/logs/**"],
            }

            const files = await scanner.scan(options)

            // Should only find .txt and .json files (exclude .log and logs/)
            expect(files).toHaveLength(2)

            const fileNames = files.map((f) => f.name).sort()
            expect(fileNames).toEqual(["data.json", "include.txt"])
        })
    })

    describe("scan - Hash Calculation", () => {
        it("should calculate hashes by default", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "hash me", directory: scanPath })

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const files = await scanner.scan(options)

            expect(files).toHaveLength(1)
            expect(files[0]?.hash).toHaveLength(64)
            expect(files[0]?.hash).toMatch(/^[a-f0-9]{64}$/)
        })

        it("should skip hash calculation when calculateHashes is false", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "no hash", directory: scanPath })

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
                calculateHashes: false,
            }

            const files = await scanner.scan(options)

            expect(files).toHaveLength(1)
            expect(files[0]?.hash).toBe("")
        })

        it("should skip files larger than maxHashSize", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "small", directory: scanPath, filename: "small.txt" })
            await createTempFile({ content: "x".repeat(1000), directory: scanPath, filename: "large.txt" })

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
                maxHashSize: 500, // Only hash files smaller than 500 bytes
            }

            const files = await scanner.scan(options)

            // Should only return the small file
            expect(files).toHaveLength(1)
            expect(files[0]?.name).toBe("small.txt")
        })
    })

    describe("scan - Progress Callback", () => {
        it("should call progress callback during scan", async () => {
            const structure = {
                "file1.txt": "one",
                "file2.txt": "two",
                "file3.txt": "three",
            }

            const scanPath = await createFileStructure(structure)

            const progressCalls: Array<{ current: number; total: number; file: string }> = []
            const onProgress: ScanProgressCallback = (current, total, currentFile) => {
                progressCalls.push({ current, total, file: currentFile })
            }

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            await scanner.scan(options, onProgress)

            // Should have called progress callback 3 times (once per file)
            expect(progressCalls).toHaveLength(3)

            // Verify progress increments correctly
            expect(progressCalls[0]?.current).toBe(1)
            expect(progressCalls[1]?.current).toBe(2)
            expect(progressCalls[2]?.current).toBe(3)

            // Total should be consistent
            expect(progressCalls[0]?.total).toBe(3)
            expect(progressCalls[1]?.total).toBe(3)
            expect(progressCalls[2]?.total).toBe(3)
        })

        it("should work without progress callback", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "test", directory: scanPath })

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            // Should not throw when no callback provided
            const files = await scanner.scan(options)
            expect(files).toHaveLength(1)
        })
    })

    describe("getScanResult", () => {
        it("should generate correct scan result summary", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "x".repeat(100), directory: scanPath })
            await createTempFile({ content: "y".repeat(200), directory: scanPath })

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const files = await scanner.scan(options)
            const result = scanner.getScanResult(files, 1000) // 1000ms duration

            expect(result.totalFiles).toBe(2)
            expect(result.totalSize).toBe(300) // 100 + 200 bytes
            expect(result.duration).toBe(1000)
            expect(result.errors).toEqual([])
            expect(result.skipped).toBe(0)
        })

        it("should track skipped files in scan result", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "small", directory: scanPath })
            await createTempFile({ content: "x".repeat(1000), directory: scanPath })

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
                maxHashSize: 500,
            }

            const files = await scanner.scan(options)
            const result = scanner.getScanResult(files, 500)

            expect(result.totalFiles).toBe(1) // Only small file
            expect(result.skipped).toBe(1) // One file skipped due to size
        })
    })

    describe("scanWithResults", () => {
        it("should return both files and scan results", async () => {
            const structure = {
                "file1.txt": "content1",
                "file2.txt": "content2",
            }

            const scanPath = await createFileStructure(structure)

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const { files, result } = await scanner.scanWithResults(options)

            expect(files).toHaveLength(2)
            expect(result.totalFiles).toBe(2)
            expect(result.duration).toBeGreaterThan(0)
            expect(result.totalSize).toBeGreaterThan(0)
        })

        it("should measure scan duration accurately", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "test", directory: scanPath })

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const { result } = await scanner.scanWithResults(options)

            // Duration should be measured and be a positive number
            expect(result.duration).toBeGreaterThan(0)
            expect(result.duration).toBeLessThan(10000) // Should complete in under 10 seconds
        })
    })

    describe("scan - File Categories", () => {
        it("should correctly categorize various file types", async () => {
            const structure = {
                "document.pdf": "pdf content",
                "image.png": "png content",
                "video.mp4": "mp4 content",
                "audio.mp3": "mp3 content",
                "archive.zip": "zip content",
                "script.js": "js content",
            }

            const scanPath = await createFileStructure(structure)

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
                calculateHashes: false, // Speed up test
            }

            const files = await scanner.scan(options)

            expect(files).toHaveLength(6)

            // Find and verify each category
            const pdfFile = files.find((f) => f.name === "document.pdf")
            const pngFile = files.find((f) => f.name === "image.png")
            const mp4File = files.find((f) => f.name === "video.mp4")
            const mp3File = files.find((f) => f.name === "audio.mp3")
            const zipFile = files.find((f) => f.name === "archive.zip")
            const jsFile = files.find((f) => f.name === "script.js")

            expect(pdfFile?.category).toBe(FileCategory.DOCUMENT)
            expect(pngFile?.category).toBe(FileCategory.IMAGE)
            expect(mp4File?.category).toBe(FileCategory.VIDEO)
            expect(mp3File?.category).toBe(FileCategory.AUDIO)
            expect(zipFile?.category).toBe(FileCategory.ARCHIVE)
            expect(jsFile?.category).toBe(FileCategory.CODE)
        })
    })

    describe("scan - Depth Tracking", () => {
        it("should track file depth correctly in nested structure", async () => {
            const structure = {
                "root.txt": "depth 0",
                level1: {
                    "file1.txt": "depth 1",
                    level2: {
                        "file2.txt": "depth 2",
                    },
                },
            }

            const scanPath = await createFileStructure(structure)

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
                calculateHashes: false,
            }

            const files = await scanner.scan(options)

            expect(files).toHaveLength(3)

            const rootFile = files.find((f) => f.name === "root.txt")
            const file1 = files.find((f) => f.name === "file1.txt")
            const file2 = files.find((f) => f.name === "file2.txt")

            expect(rootFile?.depth).toBe(0)
            expect(file1?.depth).toBe(1)
            expect(file2?.depth).toBe(2)
        })
    })

    describe("scan - Error Handling", () => {
        it("should handle non-existent directory gracefully", async () => {
            const options: ScanOptions = {
                path: "/path/to/nonexistent/directory",
                sourceSystem: currentSourceSystem,
            }

            // fast-glob returns empty array for non-existent paths rather than throwing
            const files = await scanner.scan(options)
            expect(files).toEqual([])
        })
    })

    describe("scan - Source System Types", () => {
        it("should handle all source system types", async () => {
            const scanPath = await createTempDir()
            await createTempFile({ content: "test", directory: scanPath })

            const systems = [SourceSystem.MACOS, SourceSystem.UBUNTU, SourceSystem.WINDOWS, SourceSystem.GOOGLE_DRIVE]

            for (const system of systems) {
                const options: ScanOptions = {
                    path: scanPath,
                    sourceSystem: system,
                    calculateHashes: false,
                }

                const files = await scanner.scan(options)

                expect(files).toHaveLength(1)
                expect(files[0]?.sourceSystem).toBe(system)
            }
        })
    })

    describe("scan - Performance", () => {
        it("should handle scanning multiple files efficiently", async () => {
            const scanPath = await createTempDir()

            // Create 50 small files
            for (let i = 0; i < 50; i++) {
                await createTempFile({
                    content: `File ${i} content`,
                    directory: scanPath,
                    filename: `file${i}.txt`,
                })
            }

            const options: ScanOptions = {
                path: scanPath,
                sourceSystem: currentSourceSystem,
            }

            const startTime = Date.now()
            const files = await scanner.scan(options)
            const duration = Date.now() - startTime

            expect(files).toHaveLength(50)
            // Should complete in reasonable time (< 5 seconds for 50 files)
            expect(duration).toBeLessThan(5000)
        })
    })
})
