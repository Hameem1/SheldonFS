import { mkdir, writeFile, symlink, chmod } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import { registerTempPath } from "./cleanup"

/**
 * Generate a unique temporary directory name
 */
const generateTempDirName = (): string => {
    const randomSuffix = randomBytes(8).toString("hex")
    return `sheldonfs-test-${randomSuffix}`
}

/**
 * Create a temporary directory for tests
 * Automatically registers for cleanup after tests
 */
export const createTempDir = async (): Promise<string> => {
    const tempDirPath = join(tmpdir(), generateTempDirName())
    await mkdir(tempDirPath, { recursive: true })
    registerTempPath(tempDirPath)
    return tempDirPath
}

/**
 * Create a temporary file with specified content
 */
export const createTempFile = async (options: {
    content: string | Buffer
    extension?: string
    filename?: string
    directory?: string
    mode?: number // File permissions (e.g., 0o755 for executable)
}): Promise<string> => {
    const { content, extension = "txt", filename, directory, mode } = options

    // Use provided directory or create a new temp directory
    const dir = directory ?? (await createTempDir())

    // Generate filename
    const name = filename ?? `test-${randomBytes(4).toString("hex")}.${extension}`
    const filePath = join(dir, name)

    // Write file
    await writeFile(filePath, content)

    // Set permissions if specified
    if (mode !== undefined) {
        await chmod(filePath, mode)
    }

    return filePath
}

/**
 * Create a nested directory structure with files
 * Example structure:
 * {
 *   "file1.txt": "content1",
 *   "dir1": {
 *     "file2.txt": "content2",
 *     "nested": {
 *       "file3.txt": "content3"
 *     }
 *   }
 * }
 */
export const createFileStructure = async (
    structure: Record<string, string | Record<string, unknown>>,
    baseDir?: string
): Promise<string> => {
    const rootDir = baseDir ?? (await createTempDir())

    const createRecursive = async (currentStructure: Record<string, unknown>, currentDir: string): Promise<void> => {
        for (const [name, value] of Object.entries(currentStructure)) {
            const fullPath = join(currentDir, name)

            if (typeof value === "string") {
                // It's a file
                await writeFile(fullPath, value)
            } else if (typeof value === "object" && value !== null) {
                // It's a directory
                await mkdir(fullPath, { recursive: true })
                await createRecursive(value as Record<string, unknown>, fullPath)
            }
        }
    }

    await createRecursive(structure, rootDir)
    return rootDir
}

/**
 * Create a symbolic link for testing
 */
export const createSymlink = async (targetPath: string, linkPath?: string): Promise<string> => {
    const dir = linkPath ? join(linkPath, "..") : await createTempDir()
    const symlinkPath = linkPath ?? join(dir, `symlink-${randomBytes(4).toString("hex")}`)

    await symlink(targetPath, symlinkPath)
    return symlinkPath
}

/**
 * Create a file with specific size (filled with repeating content)
 */
export const createFileWithSize = async (sizeInBytes: number, directory?: string): Promise<string> => {
    // Create content that repeats to fill the size
    const baseContent = "0123456789abcdef" // 16 bytes
    const repetitions = Math.ceil(sizeInBytes / baseContent.length)
    const content = baseContent.repeat(repetitions).slice(0, sizeInBytes)

    return createTempFile({
        content,
        extension: "txt",
        directory,
    })
}

/**
 * Create a hidden file (starts with dot on Unix)
 */
export const createHiddenFile = async (content: string = "hidden", directory?: string): Promise<string> => {
    return createTempFile({
        content,
        filename: `.hidden-${randomBytes(4).toString("hex")}.txt`,
        directory,
    })
}

/**
 * Create an executable file (Unix/macOS)
 */
export const createExecutableFile = async (content: string = "#!/bin/bash\necho test", directory?: string): Promise<string> => {
    return createTempFile({
        content,
        extension: "sh",
        directory,
        mode: 0o755, // rwxr-xr-x
    })
}
