#!/usr/bin/env node

import { FileScanner } from "@/core/scanner"
import type { FileMetadata, ScanError } from "@/types"
import { SourceSystem } from "@/enums"

const main = async () => {
    console.log("SheldonFS - File Organization System")
    console.log("=====================================\n")

    // Get directory from command line args or use current directory
    const targetPath = process.argv[2] || process.cwd()

    console.log(`Scanning directory: ${targetPath}\n`)

    const scanner = new FileScanner()

    try {
        const { files, result } = await scanner.scanWithResults(
            {
                path: targetPath,
                sourceSystem: SourceSystem.MACOS,
                includeHidden: false,
                followSymlinks: false,
                calculateHashes: true,
            },
            (current: number, total: number, _currentFile: string) => {
                // Simple progress indicator
                if (current % 10 === 0 || current === total) {
                    process.stdout.write(`\rScanning: ${current}/${total} files...`)
                }
            }
        )

        console.log("\n\nScan Results:")
        console.log("=============")
        console.log(`Total files: ${result.totalFiles}`)
        console.log(`Total size: ${formatBytes(result.totalSize)}`)
        console.log(`Skipped: ${result.skipped}`)
        console.log(`Errors: ${result.errors.length}`)
        console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`)

        if (result.errors.length > 0) {
            console.log("\nErrors encountered:")
            result.errors.slice(0, 5).forEach((err: ScanError) => {
                console.log(`  - ${err.path}: ${err.message}`)
            })
            if (result.errors.length > 5) {
                console.log(`  ... and ${result.errors.length - 5} more`)
            }
        }

        // Show first 5 files as examples
        if (files.length > 0) {
            console.log("\nSample files:")
            files.slice(0, 5).forEach((file: FileMetadata) => {
                console.log(`\n  ${file.name}`)
                console.log(`    Path: ${file.path}`)
                console.log(`    Size: ${formatBytes(file.size)}`)
                console.log(`    Extension: ${file.extension || "none"}`)
                console.log(`    Type: ${file.mimeType || "unknown"}`)
                console.log(`    Category: ${file.category}`)
                console.log(`    Depth: ${file.depth}`)
                console.log(`    Hidden: ${file.isHidden}`)
                if (file.finderTags && file.finderTags.length > 0) {
                    console.log(`    Finder Tags: ${file.finderTags.join(", ")}`)
                }
                if (file.finderColor) {
                    console.log(`    Finder Color: ${file.finderColor}`)
                }
                console.log(`    Inode: ${file.inode}`)
                console.log(`    Hard Links: ${file.hardLinkCount}`)
                console.log(`    Executable: ${file.isExecutable}`)
                console.log(`    Hash: ${file.hash.substring(0, 16)}...`)
            })
            if (files.length > 5) {
                console.log(`\n  ... and ${files.length - 5} more files`)
            }
        }
    } catch (error) {
        console.error("Error during scan:", error)
        process.exit(1)
    }
}

/**
 * Format bytes to human-readable string
 */
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

main()
