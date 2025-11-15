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
            // Note: Could further detect if it's Ubuntu specifically, but for now
            // we'll use UBUNTU as the general Linux source system
            return SourceSystem.UBUNTU
        case "win32":
            return SourceSystem.WINDOWS
        default:
            // Fallback to UBUNTU for unknown Unix-like systems
            return SourceSystem.UBUNTU
    }
}

/**
 * Check if the current platform is macOS
 */
export const isMacOS = (): boolean => process.platform === "darwin"

/**
 * Check if the current platform is Windows
 */
export const isWindows = (): boolean => process.platform === "win32"

/**
 * Check if the current platform is Linux
 */
export const isLinux = (): boolean => process.platform === "linux"
