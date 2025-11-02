import { stat, lstat, readlink } from "node:fs/promises"
import { basename, extname } from "node:path"
import { fileTypeFromFile } from "file-type"
import { FileCategory, SourceSystem } from "../types.js"
import type { FileMetadata } from "../types.js"
import { calculateFileHash } from "./hashCalculator.js"

/**
 * Extension to category mapping
 */
const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
    // Documents
    pdf: FileCategory.DOCUMENT,
    doc: FileCategory.DOCUMENT,
    docx: FileCategory.DOCUMENT,
    txt: FileCategory.DOCUMENT,
    rtf: FileCategory.DOCUMENT,
    odt: FileCategory.DOCUMENT,
    xls: FileCategory.DOCUMENT,
    xlsx: FileCategory.DOCUMENT,
    ppt: FileCategory.DOCUMENT,
    pptx: FileCategory.DOCUMENT,
    csv: FileCategory.DOCUMENT,
    md: FileCategory.DOCUMENT,

    // Images
    jpg: FileCategory.IMAGE,
    jpeg: FileCategory.IMAGE,
    png: FileCategory.IMAGE,
    gif: FileCategory.IMAGE,
    bmp: FileCategory.IMAGE,
    svg: FileCategory.IMAGE,
    webp: FileCategory.IMAGE,
    tiff: FileCategory.IMAGE,
    ico: FileCategory.IMAGE,
    heic: FileCategory.IMAGE,
    heif: FileCategory.IMAGE,

    // Videos
    mp4: FileCategory.VIDEO,
    avi: FileCategory.VIDEO,
    mkv: FileCategory.VIDEO,
    mov: FileCategory.VIDEO,
    wmv: FileCategory.VIDEO,
    flv: FileCategory.VIDEO,
    webm: FileCategory.VIDEO,
    m4v: FileCategory.VIDEO,
    mpg: FileCategory.VIDEO,
    mpeg: FileCategory.VIDEO,

    // Audio
    mp3: FileCategory.AUDIO,
    wav: FileCategory.AUDIO,
    flac: FileCategory.AUDIO,
    aac: FileCategory.AUDIO,
    ogg: FileCategory.AUDIO,
    wma: FileCategory.AUDIO,
    m4a: FileCategory.AUDIO,
    opus: FileCategory.AUDIO,

    // Archives
    zip: FileCategory.ARCHIVE,
    rar: FileCategory.ARCHIVE,
    "7z": FileCategory.ARCHIVE,
    tar: FileCategory.ARCHIVE,
    gz: FileCategory.ARCHIVE,
    bz2: FileCategory.ARCHIVE,
    xz: FileCategory.ARCHIVE,
    dmg: FileCategory.ARCHIVE,
    iso: FileCategory.ARCHIVE,

    // Code
    js: FileCategory.CODE,
    ts: FileCategory.CODE,
    jsx: FileCategory.CODE,
    tsx: FileCategory.CODE,
    py: FileCategory.CODE,
    java: FileCategory.CODE,
    c: FileCategory.CODE,
    cpp: FileCategory.CODE,
    h: FileCategory.CODE,
    cs: FileCategory.CODE,
    php: FileCategory.CODE,
    rb: FileCategory.CODE,
    go: FileCategory.CODE,
    rs: FileCategory.CODE,
    swift: FileCategory.CODE,
    kt: FileCategory.CODE,
    html: FileCategory.CODE,
    css: FileCategory.CODE,
    scss: FileCategory.CODE,
    json: FileCategory.CODE,
    xml: FileCategory.CODE,
    yaml: FileCategory.CODE,
    yml: FileCategory.CODE,
    sql: FileCategory.CODE,
    sh: FileCategory.CODE,

    // Executables
    exe: FileCategory.EXECUTABLE,
    dll: FileCategory.EXECUTABLE,
    so: FileCategory.EXECUTABLE,
    dylib: FileCategory.EXECUTABLE,
    app: FileCategory.EXECUTABLE,
    msi: FileCategory.EXECUTABLE,
}

/**
 * Determine file category based on extension and MIME type
 */
function categorizeFile(extension: string, mimeType: string | null): FileCategory {
    // First try extension mapping
    const categoryFromExt = EXTENSION_CATEGORY_MAP[extension.toLowerCase()]
    if (categoryFromExt) {
        return categoryFromExt
    }

    // If no extension match, try MIME type
    if (mimeType) {
        if (mimeType.startsWith("image/")) return FileCategory.IMAGE
        if (mimeType.startsWith("video/")) return FileCategory.VIDEO
        if (mimeType.startsWith("audio/")) return FileCategory.AUDIO
        if (mimeType.startsWith("text/")) return FileCategory.DOCUMENT
        if (mimeType.includes("pdf")) return FileCategory.DOCUMENT
        if (mimeType.includes("zip") || mimeType.includes("compressed")) return FileCategory.ARCHIVE
        if (mimeType.includes("executable")) return FileCategory.EXECUTABLE
    }

    return FileCategory.OTHER
}

/**
 * Convert file permissions to octal string format
 */
function permissionsToOctal(mode: number): string {
    return (mode & 0o777).toString(8)
}

/**
 * Extract metadata from a file
 *
 * @param filePath - Absolute path to the file
 * @param sourceSystem - Source system where file is located
 * @param calculateHash - Whether to calculate file hash (default: true)
 * @returns Promise resolving to FileMetadata
 */
export async function extractMetadata(filePath: string, sourceSystem: SourceSystem, calculateHash: boolean = true): Promise<FileMetadata> {
    // Use lstat to detect symlinks (stat follows symlinks, lstat doesn't)
    const stats = await lstat(filePath)
    const isSymlink = stats.isSymbolicLink()

    // Get actual file stats (following symlink if present)
    const fileStats = isSymlink ? await stat(filePath) : stats

    // Extract basic info
    const name = basename(filePath)
    const extension = extname(filePath).slice(1) // Remove leading dot

    // Get MIME type
    let mimeType: string | null = null
    try {
        const fileType = await fileTypeFromFile(filePath)
        mimeType = fileType?.mime ?? null
    } catch {
        // If MIME detection fails, continue without it
    }

    // Calculate hash if requested
    let hash = ""
    if (calculateHash && fileStats.isFile()) {
        try {
            hash = await calculateFileHash(filePath)
        } catch (error) {
            // If hash calculation fails, we'll leave it empty
            console.warn(`Failed to calculate hash for ${filePath}:`, error)
        }
    }

    // Get symlink target if applicable
    let symlinkTarget: string | undefined
    if (isSymlink) {
        try {
            symlinkTarget = await readlink(filePath)
        } catch {
            // If reading symlink fails, continue without it
        }
    }

    const metadata: FileMetadata = {
        path: filePath,
        name,
        extension,
        size: fileStats.size,
        hash,
        mimeType,
        category: categorizeFile(extension, mimeType),
        sourceSystem,
        createdAt: fileStats.birthtimeMs,
        modifiedAt: fileStats.mtimeMs,
        accessedAt: fileStats.atimeMs,
        isSymlink,
        symlinkTarget,
        permissions: permissionsToOctal(fileStats.mode),
    }

    return metadata
}
