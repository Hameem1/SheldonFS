import { FileCategory } from "@/enums"

/**
 * Mapping of file extensions to categories
 * This serves as the single source of truth for supported file extensions
 * Organized by category for better maintainability
 */
export const EXTENSION_CATEGORIES = {
    [FileCategory.DOCUMENT]: ["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "ppt", "pptx", "csv", "md"],

    [FileCategory.IMAGE]: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "tiff", "ico", "heic", "heif"],

    [FileCategory.VIDEO]: ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v", "mpg", "mpeg"],

    [FileCategory.AUDIO]: ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a", "opus"],

    [FileCategory.ARCHIVE]: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "dmg", "iso"],

    [FileCategory.CODE]: [
        "js",
        "ts",
        "jsx",
        "tsx",
        "py",
        "java",
        "c",
        "cpp",
        "h",
        "cs",
        "php",
        "rb",
        "go",
        "rs",
        "swift",
        "kt",
        "html",
        "css",
        "scss",
        "json",
        "xml",
        "yaml",
        "yml",
        "sql",
        "sh",
    ],

    [FileCategory.EXECUTABLE]: ["exe", "dll", "so", "dylib", "app", "msi"],
} as const

/**
 * Build a flat lookup map from extension to category
 * Used for O(1) category lookups by extension
 *
 * @returns Record mapping extension string to FileCategory
 */
export const buildExtensionCategoryMap = (): Record<string, FileCategory> => {
    const map: Record<string, FileCategory> = {}

    for (const [category, extensions] of Object.entries(EXTENSION_CATEGORIES)) {
        for (const ext of extensions) {
            map[ext.toLowerCase()] = category as FileCategory
        }
    }

    return map
}

/**
 * Pre-built extension to category lookup map
 * Use this for fast O(1) lookups
 */
export const EXTENSION_CATEGORY_MAP = buildExtensionCategoryMap()
