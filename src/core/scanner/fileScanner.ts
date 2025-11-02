import fg from "fast-glob"
import { resolve } from "node:path"
import { stat } from "node:fs/promises"
import type { FileMetadata, ScanOptions, ScanResult, ScanError, ScanProgressCallback } from "../types.js"
import { extractMetadata } from "./metadataExtractor.js"

/**
 * Default patterns to exclude from scanning
 */
const DEFAULT_EXCLUDE_PATTERNS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.svn/**",
    "**/.hg/**",
    "**/Library/Caches/**",
    "**/AppData/Local/Temp/**",
    "**/$RECYCLE.BIN/**",
    "**/System Volume Information/**",
]

/**
 * FileScanner class for scanning directories and extracting file metadata
 */
export class FileScanner {
    private errors: ScanError[] = []
    private skipped = 0

    /**
     * Scan a directory and extract metadata for all files
     *
     * @param options - Scan options
     * @param onProgress - Optional progress callback
     * @returns Promise resolving to array of FileMetadata
     */
    async scan(options: ScanOptions, onProgress?: ScanProgressCallback): Promise<FileMetadata[]> {
        this.errors = []
        this.skipped = 0

        // Prepare exclude patterns
        const excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...(options.excludePatterns ?? [])]

        // Add hidden file pattern if needed
        if (!options.includeHidden) {
            excludePatterns.push("**/.*", "**/.*/**")
        }

        // Build glob pattern
        const pattern = resolve(options.path, "**/*")

        // Find all files
        const filePaths = await fg(pattern, {
            ignore: excludePatterns,
            onlyFiles: true,
            followSymbolicLinks: options.followSymlinks ?? false,
            absolute: true,
            dot: options.includeHidden ?? false,
        })

        const totalFiles = filePaths.length
        const fileMetadataList: FileMetadata[] = []
        let processedFiles = 0

        // Process each file
        for (const filePath of filePaths) {
            try {
                // Check file size if maxHashSize is set
                if (options.maxHashSize !== undefined) {
                    const fileStats = await stat(filePath)
                    if (fileStats.size > options.maxHashSize) {
                        this.skipped++
                        processedFiles++
                        onProgress?.(processedFiles, totalFiles, filePath)
                        continue
                    }
                }

                // Extract metadata
                const metadata = await extractMetadata(filePath, options.sourceSystem, options.calculateHashes ?? true)

                fileMetadataList.push(metadata)
            } catch (error) {
                // Record error and continue
                this.errors.push({
                    path: filePath,
                    message: error instanceof Error ? error.message : String(error),
                    code: (error as NodeJS.ErrnoException).code,
                })
            }

            processedFiles++
            onProgress?.(processedFiles, totalFiles, filePath)
        }

        return fileMetadataList
    }

    /**
     * Get scan results summary
     *
     * @param files - Array of scanned file metadata
     * @param duration - Scan duration in milliseconds
     * @returns ScanResult summary
     */
    getScanResult(files: FileMetadata[], duration: number): ScanResult {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0)

        return {
            totalFiles: files.length,
            totalSize,
            errors: this.errors,
            duration,
            skipped: this.skipped,
        }
    }

    /**
     * Perform a complete scan and return both metadata and results
     *
     * @param options - Scan options
     * @param onProgress - Optional progress callback
     * @returns Promise resolving to object with files and scan result
     */
    async scanWithResults(options: ScanOptions, onProgress?: ScanProgressCallback): Promise<{ files: FileMetadata[]; result: ScanResult }> {
        const startTime = Date.now()
        const files = await this.scan(options, onProgress)
        const duration = Date.now() - startTime
        const result = this.getScanResult(files, duration)

        return { files, result }
    }
}
