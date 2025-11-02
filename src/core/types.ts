/**
 * Core types and interfaces for SheldonFS
 */

import type { SourceSystem, FileCategory } from "@/enums"

/**
 * Core metadata for a scanned file
 */
export interface FileMetadata {
    /** Absolute path to the file */
    path: string

    /** File name (without directory path) */
    name: string

    /** File extension (without dot, e.g., 'txt', 'jpg') */
    extension: string

    /** File size in bytes */
    size: number

    /** SHA256 hash of file contents */
    hash: string

    /** MIME type of the file */
    mimeType: string | null

    /** File category */
    category: FileCategory

    /** Source system where file was found */
    sourceSystem: SourceSystem

    /** File creation timestamp (ms since epoch) */
    createdAt: number

    /** File last modification timestamp (ms since epoch) */
    modifiedAt: number

    /** File last access timestamp (ms since epoch) */
    accessedAt: number

    /** Whether this is a symbolic link */
    isSymlink: boolean

    /** If symlink, the path it points to */
    symlinkTarget?: string

    /** File permissions in octal format (e.g., '755') */
    permissions?: string

    /** File owner (if available) */
    owner?: string
}

/**
 * Options for scanning files
 */
export interface ScanOptions {
    /** Directory path to scan */
    path: string

    /** Source system being scanned */
    sourceSystem: SourceSystem

    /** Patterns to exclude (glob patterns) */
    excludePatterns?: string[]

    /** Whether to follow symbolic links */
    followSymlinks?: boolean

    /** Whether to include hidden files */
    includeHidden?: boolean

    /** Maximum file size to hash (in bytes). Larger files will be skipped */
    maxHashSize?: number

    /** Whether to calculate hashes (can be disabled for faster initial scan) */
    calculateHashes?: boolean
}

/**
 * Result of a scan operation
 */
export interface ScanResult {
    /** Total files scanned */
    totalFiles: number

    /** Total size of all files (bytes) */
    totalSize: number

    /** Files that encountered errors */
    errors: ScanError[]

    /** Time taken for scan (ms) */
    duration: number

    /** Files that were skipped */
    skipped: number
}

/**
 * Error during scanning
 */
export interface ScanError {
    /** File path where error occurred */
    path: string

    /** Error message */
    message: string

    /** Error code (e.g., 'EACCES', 'ENOENT') */
    code?: string
}

/**
 * Progress callback for scan operations
 */
export type ScanProgressCallback = (current: number, total: number, currentFile: string) => void
