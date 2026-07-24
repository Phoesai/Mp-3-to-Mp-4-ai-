import os
import time
import logging
import threading
from pathlib import Path

logger = logging.getLogger("file_cleanup")
logging.basicConfig(level=logging.INFO)

def cleanup_stale_files(temp_dir: str, max_age_seconds: int = 3600):
    """
    Deletes files in temp_dir older than max_age_seconds (default 1 hour).
    Prevents disk space exhaustion on ephemeral Cloud Run / container instances.
    """
    temp_path = Path(temp_dir)
    if not temp_path.exists():
        return

    now = time.time()
    deleted_count = 0
    freed_bytes = 0

    for file_path in temp_path.glob("**/*"):
        if file_path.is_file():
            try:
              file_age = now - file_path.stat().st_mtime
              if file_age > max_age_seconds:
                  file_size = file_path.stat().st_size
                  file_path.unlink()
                  deleted_count += 1
                  freed_bytes += file_size
            except Exception as e:
                logger.error(f"Failed to delete {file_path}: {e}")

    if deleted_count > 0:
        logger.info(f"Purged {deleted_count} stale temp files. Freed {freed_bytes / (1024 * 1024):.2f} MB.")


class FileCleanupScheduler:
    """
    Runs background cleanup thread at specified intervals.
    """
    def __init__(self, temp_dir: str, interval_seconds: int = 900, max_age_seconds: int = 3600):
        self.temp_dir = temp_dir
        self.interval_seconds = interval_seconds
        self.max_age_seconds = max_age_seconds
        self._stop_event = threading.Event()
        self._thread = None

    def start(self):
        logger.info(f"Starting background file cleanup scheduler for {self.temp_dir}")
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        # Run immediate cleanup on startup
        cleanup_stale_files(self.temp_dir, self.max_age_seconds)
        while not self._stop_event.is_set():
            time.sleep(self.interval_seconds)
            if not self._stop_event.is_set():
                cleanup_stale_files(self.temp_dir, self.max_age_seconds)

    def stop(self):
        logger.info("Stopping file cleanup scheduler.")
        self._stop_event.set()


if __name__ == "__main__":
    # Self test
    cleanup_stale_files("./temp", max_age_seconds=3600)
