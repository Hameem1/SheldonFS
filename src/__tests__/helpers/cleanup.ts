import { rm } from "node:fs/promises"
import { existsSync } from "node:fs"

/**
 * Set of temporary paths created during tests
 * These will be cleaned up after each test
 */
const tempPaths = new Set<string>()

/**
 * Register a temporary path for cleanup
 * Should be called when creating temp files/directories
 */
export const registerTempPath = (path: string): void => {
    tempPaths.add(path)
}

/**
 * Clean up all registered temporary files and directories
 * Called automatically after each test via setup.ts
 */
export const cleanupTempFiles = async (): Promise<void> => {
    const cleanupPromises = Array.from(tempPaths).map(async (path) => {
        try {
            // Check if path exists before attempting to remove
            if (existsSync(path)) {
                await rm(path, { recursive: true, force: true })
            }
        } catch (error) {
            // Log but don't fail tests if cleanup fails
            console.warn(`Failed to clean up ${path}:`, error)
        }
    })

    await Promise.all(cleanupPromises)

    // Clear the set after cleanup
    tempPaths.clear()
}

/**
 * Manually clean up a specific path
 * Useful for cleaning up in the middle of a test
 */
export const cleanupPath = async (path: string): Promise<void> => {
    try {
        if (existsSync(path)) {
            await rm(path, { recursive: true, force: true })
        }
        tempPaths.delete(path)
    } catch (error) {
        console.warn(`Failed to clean up ${path}:`, error)
    }
}
