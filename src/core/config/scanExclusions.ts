/**
 * Default file and directory patterns to exclude from scanning
 * These are common directories that should typically be ignored during file system scans
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
    // Version control systems
    "**/.git/**",
    "**/.svn/**",
    "**/.hg/**",

    // Dependencies and build artifacts
    "**/node_modules/**",

    // System caches and temporary files
    "**/Library/Caches/**", // macOS
    "**/AppData/Local/Temp/**", // Windows
    "**/$RECYCLE.BIN/**", // Windows Recycle Bin
    "**/System Volume Information/**", // Windows system folder
] as const
