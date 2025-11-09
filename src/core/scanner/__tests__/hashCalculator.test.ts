import { describe, it, expect } from "vitest"
import { calculateFileHash, calculatePartialHash, quickCompare } from "../hashCalculator"
import { createTempFile, createFileWithSize } from "@/__tests__/helpers/fileGenerator"

describe("hashCalculator", () => {
    describe("calculateFileHash", () => {
        it("should calculate correct SHA256 hash for known content", async () => {
            const content = "Hello, World!"
            const expectedHash = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"

            const filePath = await createTempFile({ content })
            const hash = await calculateFileHash(filePath)

            expect(hash).toBe(expectedHash)
        })

        it("should calculate hash for empty file", async () => {
            // SHA256 hash of empty string
            const expectedHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

            const filePath = await createTempFile({ content: "" })
            const hash = await calculateFileHash(filePath)

            expect(hash).toBe(expectedHash)
        })

        it("should calculate hash for binary content", async () => {
            const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd])

            const filePath = await createTempFile({ content: buffer })
            const hash = await calculateFileHash(filePath)

            // SHA256 produces 64 character hex string
            expect(hash).toHaveLength(64)
            expect(hash).toMatch(/^[a-f0-9]{64}$/)
        })

        it("should handle large files efficiently", async () => {
            // Create a 5MB file
            const filePath = await createFileWithSize(5 * 1024 * 1024)

            const startTime = Date.now()
            const hash = await calculateFileHash(filePath)
            const duration = Date.now() - startTime

            // Should complete in reasonable time (< 1 second for 5MB)
            expect(duration).toBeLessThan(1000)
            expect(hash).toHaveLength(64)
            expect(hash).toMatch(/^[a-f0-9]{64}$/)
        })

        it("should throw error for non-existent file", async () => {
            await expect(calculateFileHash("/path/to/nonexistent/file.txt")).rejects.toThrow()
        })
    })

    describe("calculatePartialHash", () => {
        it("should calculate partial hash for small file", async () => {
            const content = "Hello, World!"
            const filePath = await createTempFile({ content })

            const partialHash = await calculatePartialHash(filePath)

            // For files smaller than 100KB, partial hash should equal full hash
            const fullHash = await calculateFileHash(filePath)
            expect(partialHash).toBe(fullHash)
        })

        it("should calculate partial hash for large file", async () => {
            // Create a 200KB file (larger than default 100KB partial hash size)
            const filePath = await createFileWithSize(200 * 1024)

            const partialHash = await calculatePartialHash(filePath)
            const fullHash = await calculateFileHash(filePath)

            // Partial hash should be different from full hash
            expect(partialHash).not.toBe(fullHash)
            expect(partialHash).toHaveLength(64)
            expect(partialHash).toMatch(/^[a-f0-9]{64}$/)
        })

        it("should respect custom maxBytes parameter", async () => {
            const content = "A".repeat(1000) // 1000 bytes
            const filePath = await createTempFile({ content })

            // Hash only first 100 bytes
            const partialHash100 = await calculatePartialHash(filePath, 100)
            // Hash only first 500 bytes
            const partialHash500 = await calculatePartialHash(filePath, 500)
            // Full hash
            const fullHash = await calculateFileHash(filePath)

            // All should be different
            expect(partialHash100).not.toBe(partialHash500)
            expect(partialHash500).not.toBe(fullHash)
            expect(partialHash100).not.toBe(fullHash)
        })

        it("should handle empty file", async () => {
            const filePath = await createTempFile({ content: "" })
            const partialHash = await calculatePartialHash(filePath)

            // Should match empty string hash
            const expectedHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            expect(partialHash).toBe(expectedHash)
        })
    })

    describe("quickCompare", () => {
        it("should return true for identical files", async () => {
            const content = "Identical content"
            const file1 = await createTempFile({ content })
            const file2 = await createTempFile({ content })

            const result = await quickCompare(file1, file2)

            expect(result).toBe(true)
        })

        it("should return false for files with different sizes", async () => {
            const file1 = await createTempFile({ content: "Short" })
            const file2 = await createTempFile({ content: "Much longer content" })

            const result = await quickCompare(file1, file2)

            expect(result).toBe(false)
        })

        it("should return false for files with same size but different content", async () => {
            const file1 = await createTempFile({ content: "AAAAA" }) // 5 bytes
            const file2 = await createTempFile({ content: "BBBBB" }) // 5 bytes

            const result = await quickCompare(file1, file2)

            expect(result).toBe(false)
        })

        it("should return true for large identical files", async () => {
            // Create two 200KB files with same content
            const size = 200 * 1024
            const file1 = await createFileWithSize(size)
            const file2 = await createFileWithSize(size)

            const result = await quickCompare(file1, file2)

            // quickCompare uses partial hash, so if first 100KB match and sizes match, should return true
            expect(result).toBe(true)
        })

        it("should be faster than full hash comparison", async () => {
            // Create large files (5MB each)
            const size = 5 * 1024 * 1024
            const file1 = await createFileWithSize(size)
            const file2 = await createFileWithSize(size)

            // Time quickCompare
            const quickStart = Date.now()
            await quickCompare(file1, file2)
            const quickDuration = Date.now() - quickStart

            // Time full hash comparison
            const fullStart = Date.now()
            await calculateFileHash(file1)
            await calculateFileHash(file2)
            const fullDuration = Date.now() - fullStart

            // Quick compare should be significantly faster
            expect(quickDuration).toBeLessThan(fullDuration)
        })

        it("should handle empty files", async () => {
            const file1 = await createTempFile({ content: "" })
            const file2 = await createTempFile({ content: "" })

            const result = await quickCompare(file1, file2)

            expect(result).toBe(true)
        })
    })
})
