import { stat, lstat, readlink } from "node:fs/promises"
import { basename, extname, relative, sep } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { userInfo } from "node:os"
import { fileTypeFromFile } from "file-type"
import mime from "mime"
import { FileCategory, SourceSystem } from "@/enums"
import type { FileMetadata } from "@/types"
import { calculateFileHash } from "./hashCalculator"

const execFileAsync = promisify(execFile)

// Cache for UID to username mapping to avoid repeated system calls
const uidToUsernameCache = new Map<number, string>()

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
const categorizeFile = (extension: string, mimeType: string | null): FileCategory => {
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
const permissionsToOctal = (mode: number): string => {
    return (mode & 0o777).toString(8)
}

/**
 * Check if a file is hidden
 * On Unix/macOS: files starting with '.'
 * On Windows: would need to check file attributes (future enhancement)
 */
const isFileHidden = (fileName: string): boolean => {
    // TODO: Add Windows support - check FILE_ATTRIBUTE_HIDDEN using fs.stat() or Windows API
    // On Windows, need to check: (stats.mode & 0x2) for hidden attribute
    // May require platform-specific implementation or a library like 'is-hidden-file'
    return fileName.startsWith(".")
}

/**
 * Check if a file is executable
 * On Unix/macOS: checks execute permission bits
 * On Windows: checks file extension
 */
const isFileExecutable = (mode: number, fileName: string): boolean => {
    if (process.platform === "win32") {
        // On Windows, check file extension
        const executableExtensions = [".exe", ".bat", ".cmd", ".com", ".msi", ".ps1", ".vbs", ".wsf"]
        const lowerName = fileName.toLowerCase()
        return executableExtensions.some((ext) => lowerName.endsWith(ext))
    }

    // On Unix/macOS, check if any execute bit is set (user, group, or other)
    // 0o111 = 001 001 001 (execute bit for user, group, other)
    return (mode & 0o111) !== 0
}

/**
 * Calculate depth from scan root directory
 * Depth 0 = file in root directory
 * Depth 1 = file one level deep, etc.
 */
const calculateDepth = (filePath: string, scanRoot: string): number => {
    const relativePath = relative(scanRoot, filePath)
    if (!relativePath || relativePath === ".") return 0

    // Count directory separators in the relative path
    const parts = relativePath.split(sep)
    // Subtract 1 because the last part is the filename
    return parts.length - 1
}

/**
 * Extract macOS Finder tags and color from extended attributes
 * Returns undefined if not on macOS or if no tags exist
 */
const extractMacOSFinderTags = async (filePath: string): Promise<{ tags?: string[]; color?: string }> => {
    // Only try on macOS
    if (process.platform !== "darwin") {
        return {}
    }

    try {
        // Read the Finder tags extended attribute
        const { stdout } = await execFileAsync("xattr", ["-p", "com.apple.metadata:_kMDItemUserTags", filePath])

        // Parse XML plist output
        // Format: <plist><array><string>Tag1</string><string>Tag2\n6</string></array></plist>
        // Tag names may include color codes like "TagName\n6" where 6 is the color code
        const stringMatches = stdout.matchAll(/<string>([^<]+)<\/string>/g)
        if (!stringMatches) return {}

        const tags: string[] = []
        let color: string | undefined

        for (const match of stringMatches) {
            const tagData = match[1]?.trim()
            if (!tagData) continue

            // Check if tag includes color code (format: "TagName\n6")
            const parts = tagData.split("\n")
            const tagName = parts[0]?.trim()
            const colorCode = parts[1]?.trim()

            if (tagName) {
                tags.push(tagName)

                // Extract color if present (macOS uses color codes 1-7)
                if (colorCode && colorCode !== "0") {
                    const colorMap: Record<string, string> = {
                        "1": "Gray",
                        "2": "Green",
                        "3": "Purple",
                        "4": "Blue",
                        "5": "Yellow",
                        "6": "Red",
                        "7": "Orange",
                    }
                    color = colorMap[colorCode] || "Unknown"
                }
            }
        }

        return {
            tags: tags.length > 0 ? tags : undefined,
            color,
        }
    } catch {
        // File has no tags or xattr failed
        return {}
    }
}

/**
 * Get the username for a given UID
 * Uses caching to avoid repeated system lookups
 */
const getOwnerName = async (uid: number): Promise<string | undefined> => {
    // Check cache first
    if (uidToUsernameCache.has(uid)) {
        return uidToUsernameCache.get(uid)
    }

    try {
        // Check if this is the current user (fast check)
        const currentUser = userInfo()
        if (currentUser.uid === uid) {
            uidToUsernameCache.set(uid, currentUser.username)
            return currentUser.username
        }

        // On Unix/macOS, use 'id' command to get username from UID
        if (process.platform !== "win32") {
            const { stdout } = await execFileAsync("id", ["-un", uid.toString()])
            const username = stdout.trim()
            if (username) {
                uidToUsernameCache.set(uid, username)
                return username
            }
        }

        // TODO: Add Windows support - use Windows API to get username from SID
        // For now, fall back to just the UID/SID number
        return undefined
    } catch {
        // If lookup fails, return undefined (we'll omit the field)
        return undefined
    }
}

/**
 * Extract metadata from a file
 *
 * @param filePath - Absolute path to the file
 * @param sourceSystem - Source system where file is located
 * @param scanRootPath - Root directory being scanned (for depth calculation)
 * @param calculateHash - Whether to calculate file hash (default: true)
 * @returns Promise resolving to FileMetadata
 */
export const extractMetadata = async (
    filePath: string,
    sourceSystem: SourceSystem,
    scanRootPath: string,
    calculateHash: boolean = true
): Promise<FileMetadata> => {
    // Use lstat to detect symlinks (stat follows symlinks, lstat doesn't)
    const stats = await lstat(filePath)
    const isSymlink = stats.isSymbolicLink()

    // Get actual file stats (following symlink if present)
    const fileStats = isSymlink ? await stat(filePath) : stats

    // Extract basic info
    const name = basename(filePath)
    const extension = extname(filePath).slice(1) // Remove leading dot

    // Get MIME type (try file-type first, then fallback to mime package for text files)
    let mimeType: string | null = null
    try {
        const fileType = await fileTypeFromFile(filePath)
        mimeType = fileType?.mime ?? null
    } catch {
        // If MIME detection fails, continue without it
    }

    // Fallback to extension-based MIME type lookup for text files
    if (!mimeType && extension) {
        mimeType = mime.getType(extension)
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

    // Extract macOS Finder tags and color (if on macOS)
    const { tags: finderTags, color: finderColor } = await extractMacOSFinderTags(filePath)

    // Get file owner username from UID
    const owner = await getOwnerName(fileStats.uid)

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
        owner,
        isHidden: isFileHidden(name),
        depth: calculateDepth(filePath, scanRootPath),
        finderTags,
        finderColor,
        inode: fileStats.ino,
        hardLinkCount: fileStats.nlink,
        isExecutable: isFileExecutable(fileStats.mode, name),
    }

    return metadata
}
