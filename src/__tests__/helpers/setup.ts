/**
 * Vitest setup file
 * Runs before all tests to configure the testing environment
 */

import { afterEach } from "vitest"
import { cleanupTempFiles } from "./cleanup"

// Clean up any temporary files after each test
afterEach(async () => {
    await cleanupTempFiles()
})
