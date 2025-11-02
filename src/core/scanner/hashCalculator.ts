import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"

/**
 * Default chunk size for reading files (1MB)
 */
const DEFAULT_CHUNK_SIZE = 1024 * 1024

/**
 * Size of partial hash to read from beginning of file (100KB)
 * Used for quick comparison before full hash
 */
const PARTIAL_HASH_SIZE = 100 * 1024

/**
 * Calculate SHA256 hash of a file
 *
 * @param filePath - Path to the file
 * @returns Promise resolving to hex-encoded hash string
 */
export const calculateFileHash = async (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = createHash("sha256")
        const stream = createReadStream(filePath, {
            highWaterMark: DEFAULT_CHUNK_SIZE,
        })

        stream.on("data", (chunk) => {
            hash.update(chunk)
        })

        stream.on("end", () => {
            resolve(hash.digest("hex"))
        })

        stream.on("error", (error) => {
            reject(error)
        })
    })
}

/**
 * Calculate a partial hash from the beginning of a file
 * Useful for quickly comparing files before doing full hash
 *
 * @param filePath - Path to the file
 * @param maxBytes - Maximum bytes to read (default: 100KB)
 * @returns Promise resolving to hex-encoded partial hash
 */
export const calculatePartialHash = async (filePath: string, maxBytes: number = PARTIAL_HASH_SIZE): Promise<string> => {
    const fileStats = await stat(filePath)
    const bytesToRead = Math.min(fileStats.size, maxBytes)

    return new Promise((resolve, reject) => {
        const hash = createHash("sha256")
        const stream = createReadStream(filePath, {
            start: 0,
            end: bytesToRead - 1,
            highWaterMark: DEFAULT_CHUNK_SIZE,
        })

        stream.on("data", (chunk) => {
            hash.update(chunk)
        })

        stream.on("end", () => {
            resolve(hash.digest("hex"))
        })

        stream.on("error", (error) => {
            reject(error)
        })
    })
}

/**
 * Check if two files might be identical by comparing size and partial hash
 * Much faster than full hash comparison
 *
 * @param file1Path - Path to first file
 * @param file2Path - Path to second file
 * @returns Promise resolving to true if files might be identical
 */
export const quickCompare = async (file1Path: string, file2Path: string): Promise<boolean> => {
    // First compare sizes
    const [stat1, stat2] = await Promise.all([stat(file1Path), stat(file2Path)])

    if (stat1.size !== stat2.size) {
        return false
    }

    // If sizes match, compare partial hashes
    const [hash1, hash2] = await Promise.all([calculatePartialHash(file1Path), calculatePartialHash(file2Path)])

    return hash1 === hash2
}
