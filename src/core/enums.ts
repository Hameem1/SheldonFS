/**
 * Enums for SheldonFS
 * These are runtime constructs that compile to JavaScript objects
 */

/**
 * Source system where a file is located
 */
export enum SourceSystem {
    WINDOWS = "windows",
    UBUNTU = "ubuntu",
    MACOS = "macos",
    GOOGLE_DRIVE = "google_drive",
}

/**
 * File category based on type
 */
export enum FileCategory {
    DOCUMENT = "document",
    IMAGE = "image",
    VIDEO = "video",
    AUDIO = "audio",
    ARCHIVE = "archive",
    CODE = "code",
    EXECUTABLE = "executable",
    SYSTEM = "system",
    OTHER = "other",
}
