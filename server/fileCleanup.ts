import fs from 'fs';
import path from 'path';

/**
 * Periodically cleans up temporary files (uploads, outputs, covers) older than maxAgeMs.
 * Designed for Cloud Run / ephemeral environments to keep disk usage under limits.
 */
export function startFileCleanupScheduler(
  tempDir: string,
  intervalMs: number = 15 * 60 * 1000, // Run every 15 minutes
  maxAgeMs: number = 60 * 60 * 1000   // Delete files older than 1 hour
): NodeJS.Timeout {
  console.log(`[File Cleanup] Initializing scheduler for ${tempDir} (Interval: ${intervalMs / 1000}s, MaxAge: ${maxAgeMs / 1000}s)`);

  const runCleanup = () => {
    const now = Date.now();
    let deletedCount = 0;
    let freedBytes = 0;

    const cleanDirectory = (dirPath: string) => {
      if (!fs.existsSync(dirPath)) return;

      try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            cleanDirectory(filePath);
          } else {
            const ageMs = now - stat.mtimeMs;
            if (ageMs > maxAgeMs) {
              freedBytes += stat.size;
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          }
        }
      } catch (err) {
        console.error(`[File Cleanup] Error cleaning directory ${dirPath}:`, err);
      }
    };

    cleanDirectory(tempDir);

    if (deletedCount > 0) {
      console.log(`[File Cleanup] Purged ${deletedCount} stale temporary files, freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB`);
    }
  };

  // Run initial cleanup on startup
  runCleanup();

  // Return interval timer reference
  return setInterval(runCleanup, intervalMs);
}
