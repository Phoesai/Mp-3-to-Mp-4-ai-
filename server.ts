import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import { extractMetadata } from './server/metadataService.js';
import { generateAiCoverArt } from './server/geminiService.js';
import { renderMusicVideo } from './server/ffmpegService.js';
import { startFileCleanupScheduler } from './server/fileCleanup.js';
import { VideoSettings, GenerationStatus, AudioMetadata } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create required temporary working directories
const TEMP_DIR = path.join(process.cwd(), 'temp');
const UPLOADS_DIR = path.join(TEMP_DIR, 'uploads');
const OUTPUTS_DIR = path.join(TEMP_DIR, 'outputs');
const COVERS_DIR = path.join(TEMP_DIR, 'covers');

[TEMP_DIR, UPLOADS_DIR, OUTPUTS_DIR, COVERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for uploaded audio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, `audio_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('audio') || file.originalname.match(/\.(mp3|wav|m4a|aac|ogg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, WAV, M4A, AAC, OGG) are allowed!'));
    }
  }
});

// In-memory session database for active generation tasks
interface SessionData {
  sessionId: string;
  audioPath: string;
  metadata: AudioMetadata;
  coverPath: string | null;
  outputPath: string | null;
  status: GenerationStatus;
}

const sessions = new Map<string, SessionData>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API ROUTE 1: Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', copyrightSafe: true, timestamp: new Date().toISOString() });
  });

  // API ROUTE 2: Upload MP3 & Extract Metadata
  app.post('/api/upload', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }

      const filePath = req.file.path;
      const sessionId = path.basename(filePath, path.extname(filePath)).replace('audio_', '');

      // Extract ID3 tags using music-metadata service
      const metadata = await extractMetadata(filePath);

      let coverPath: string | null = null;
      if (metadata.hasCoverArt && metadata.coverArtDataUrl) {
        // Save extracted cover art to temp covers folder
        const base64Data = metadata.coverArtDataUrl.replace(/^data:image\/\w+;base64,/, '');
        coverPath = path.join(COVERS_DIR, `cover_${sessionId}.jpg`);
        await fs.promises.writeFile(coverPath, Buffer.from(base64Data, 'base64'));
      }

      const session: SessionData = {
        sessionId,
        audioPath: filePath,
        metadata,
        coverPath,
        outputPath: null,
        status: {
          sessionId,
          stage: 'idle',
          progress: 0,
          message: 'Audio file uploaded and ID3 tags extracted successfully.',
          logs: ['Audio file uploaded', `Extracted title: "${metadata.title}" by ${metadata.artist}`],
        }
      };

      sessions.set(sessionId, session);

      res.json({
        sessionId,
        originalName: req.file.originalname,
        metadata,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to process uploaded file' });
    }
  });

  // API ROUTE 3: Generate AI Cover Art
  app.post('/api/generate-cover', async (req, res) => {
    try {
      const { sessionId, title, artist, genre, artStyle, style, customPrompt } = req.body;
      if (!sessionId || !sessions.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid or expired session ID' });
      }

      const selectedArtStyle = artStyle || style || 'cinematic';
      const coverPath = path.join(COVERS_DIR, `ai_cover_${sessionId}.jpg`);
      const result = await generateAiCoverArt(title, artist, genre, selectedArtStyle, customPrompt, coverPath);

      if (result.success && result.filePath) {
        const session = sessions.get(sessionId)!;
        session.coverPath = result.filePath;
        res.json({ success: true, coverArtDataUrl: result.dataUrl, promptUsed: result.promptUsed });
      } else {
        res.status(400).json({ error: result.error || 'Failed to generate AI Cover Art', promptUsed: result.promptUsed });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Server error generating cover art' });
    }
  });

  // API ROUTE 4: Trigger FFmpeg Video Generation
  app.post('/api/generate', async (req, res) => {
    try {
      const { sessionId, settings } = req.body as { sessionId: string; settings: VideoSettings };

      if (!sessionId || !sessions.has(sessionId)) {
        return res.status(400).json({ error: 'Session not found. Please upload an MP3 file first.' });
      }

      const session = sessions.get(sessionId)!;

      // Handle base64 cover art provided directly from user/custom upload
      if (settings.coverArtDataUrl && settings.coverArtDataUrl.startsWith('data:image')) {
        const base64Data = settings.coverArtDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const customCoverPath = path.join(COVERS_DIR, `user_cover_${sessionId}.jpg`);
        await fs.promises.writeFile(customCoverPath, Buffer.from(base64Data, 'base64'));
        session.coverPath = customCoverPath;
      }

      const outputVideoPath = path.join(OUTPUTS_DIR, `video_${sessionId}.mp4`);
      session.outputPath = outputVideoPath;

      // Reset status for rendering job
      session.status = {
        sessionId,
        stage: 'analyzing',
        progress: 5,
        message: 'Initializing FFmpeg video rendering engine...',
        logs: ['Job started', 'Validated audio track and metadata settings'],
        outputUrl: `/api/preview/${sessionId}`,
        downloadUrl: `/api/download/${sessionId}`,
      };

      // Respond immediately to avoid HTTP timeout; rendering runs asynchronously
      res.json({
        success: true,
        sessionId,
        statusUrl: `/api/status/${sessionId}`,
        previewUrl: `/api/preview/${sessionId}`,
        downloadUrl: `/api/download/${sessionId}`,
      });

      // Execute background video render
      renderMusicVideo(
        sessionId,
        session.audioPath,
        settings,
        session.metadata.duration,
        session.coverPath,
        outputVideoPath,
        (statusPartial) => {
          session.status = {
            ...session.status,
            ...statusPartial,
            logs: statusPartial.logs ? [...session.status.logs, ...statusPartial.logs] : session.status.logs,
          };
        }
      ).catch((err) => {
        console.error('Error during video rendering:', err);
        session.status.stage = 'error';
        session.status.message = `Rendering failed: ${err.message}`;
        session.status.error = err.message;
        session.status.logs.push(`ERROR: ${err.message}`);
      });

    } catch (err: any) {
      console.error('Generate route error:', err);
      res.status(500).json({ error: err.message || 'Failed to start video generation' });
    }
  });

  // API ROUTE 5: Get Generation Progress & Status
  app.get('/api/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!sessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessions.get(sessionId)!;
    res.json(session.status);
  });

  // API ROUTE 6: Download Output MP4 Video
  app.get('/api/download/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!sessions.has(sessionId)) {
      return res.status(404).send('Session not found');
    }
    const session = sessions.get(sessionId)!;
    if (!session.outputPath || !fs.existsSync(session.outputPath)) {
      return res.status(404).send('Video file not found or generation not complete');
    }

    const titleSanitized = (session.metadata.title || 'video').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${titleSanitized}_official_video.mp4`;

    res.download(session.outputPath, filename);
  });

  // API ROUTE 7: Stream/Preview MP4 Video
  app.get('/api/preview/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!sessions.has(sessionId)) {
      return res.status(404).send('Session not found');
    }
    const session = sessions.get(sessionId)!;
    if (!session.outputPath || !fs.existsSync(session.outputPath)) {
      return res.status(404).send('Video file not found or rendering in progress');
    }

    const stat = fs.statSync(session.outputPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(session.outputPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(session.outputPath).pipe(res);
    }
  });

  // Periodic Cleanup Task (Cleans files older than 1 hour, runs every 15 mins)
  startFileCleanupScheduler(TEMP_DIR, 15 * 60 * 1000, 60 * 60 * 1000);

  // Vite middleware or static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Music Video Creator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
