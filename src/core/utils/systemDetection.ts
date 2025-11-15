import { SourceSystem } from "@/enums"

/**
 * Detect the current operating system and map it to SourceSystem enum
 * @returns SourceSystem enum value for the current platform
 */
export const detectSourceSystem = (): SourceSystem => {
    switch (process.platform) {
        case "darwin":
            return SourceSystem.MACOS
        case "linux":
            return SourceSystem.LINUX
        case "win32":
            return SourceSystem.WINDOWS
        default:
            // Fallback to LINUX for unknown Unix-like systems
            return SourceSystem.LINUX
    }
}

/**
 * Check if the current platform is macOS
 */
export const isMacOS = (): boolean => {
    return detectSourceSystem() === SourceSystem.MACOS
}

/**
 * Check if the current platform is Windows
 */
export const isWindows = (): boolean => {
    return detectSourceSystem() === SourceSystem.WINDOWS
}

/**
 * Check if the current platform is Linux
 */
export const isLinux = (): boolean => {
    return detectSourceSystem() === SourceSystem.LINUX
}
