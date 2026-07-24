# AI Music Video Creator - Production & Cloud Run Deployment Guide

This guide details step-by-step instructions for deploying the **AI Music Video Creator** to production cloud platforms (Google Cloud Run, Railway, Render, and Vercel) while maintaining low operational cost, copyright-safe visual generation, and high reliability.

---

## 📁 1. Repository Structure & GitHub Setup

The project supports both **Monorepo** (single container hosting both API & Frontend) and **Separate Service** architecture (FastAPI Backend + Next.js Frontend).

### Recommended Project Layout (Monorepo Structure)
```
ai-music-video-creator/
├── Dockerfile                  # Fullstack Node.js + FFmpeg Container
├── .dockerignore
├── .gitignore
├── .env.example
├── DEPLOYMENT.md
├── package.json
├── server.ts                   # Express Backend with FFmpeg & Gemini AI integration
├── server/
│   ├── metadataService.ts      # ID3 metadata parser
│   ├── geminiService.ts        # AI cover art & prompt generation engine
│   ├── ffmpegService.ts        # FFmpeg audio visualization & video renderer
│   └── fileCleanup.ts          # Automatic temp file purge scheduler
├── src/                        # React Frontend
│   ├── App.tsx                 # Main wizard flow (Upload -> Edit -> Result)
│   ├── components/             # UI Step components
│   └── types.ts
├── backend/                    # Python FastAPI alternative (if separating services)
│   ├── main.py
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── routers/
│   ├── services/
│   └── utils/
│       └── file_cleanup.py
└── frontend/                   # Standalone Next.js alternative
    ├── Dockerfile
    ├── .dockerignore
    └── package.json
```

---

## 🔑 2. Environment Variables Reference

### Backend Configuration (`.env` or Cloud Secret Manager)

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `AIzaSy...` | **Required.** Google Gemini API key for AI cover art and prompt engineering. |
| `PORT` | `3000` or `8000` | Port for the HTTP server (`3000` default on Cloud Run). |
| `TEMP_DIR` | `./temp` | Temporary working directory for video rendering and audio files. |
| `MAX_FILE_SIZE` | `52428800` | Maximum allowed audio file upload size in bytes (e.g. `50MB`). |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app` | Comma-separated list of allowed origin URLs for browser security. |

### Frontend Configuration (`.env.local` or Vercel Build Vars)

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://backend-service-xyz.a.run.app` | The public HTTPS URL of the deployed backend service. |

---

## 🐳 3. Dockerization & FFmpeg Setup

The container must have `ffmpeg` installed to execute video encoding, audio spectrum visualization, and intro slate merging.

### Building & Testing Docker Image Locally

```bash
# 1. Build local container image
docker build -t ai-music-video-creator:latest .

# 2. Run container locally with your Gemini API Key
docker run -d \
  -p 3000:3000 \
  -e GEMINI_API_KEY="your-gemini-api-key" \
  --name music-video-app \
  ai-music-video-creator:latest

# 3. Test application locally
curl -I http://localhost:3000/api/health
```

---

## 🚀 4. Cloud Deployment Instructions

### Option A: Google Cloud Run (Recommended for MVP)

Google Cloud Run is ideal for serverless execution: zero cost when idle, auto-scaling up to CPU demand during video rendering.

#### Step 1: Install & Initialize Google Cloud SDK
```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

#### Step 2: Enable Required Cloud Services
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

#### Step 3: Deploy Fullstack Container to Cloud Run
```bash
gcloud run deploy ai-music-video-creator \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600 \
  --set-env-vars "GEMINI_API_KEY=your_gemini_api_key_here,NODE_ENV=production"
```

*Note: `--memory 2Gi` and `--cpu 2` ensure fast FFmpeg video encoding times.*

---

### Option B: Railway / Render Deployment

1. **Connect GitHub Repository**: Link your GitHub repo in Railway or Render dashboard.
2. **Select Container Build**: The platform automatically detects `Dockerfile`.
3. **Environment Variables**: Add `GEMINI_API_KEY` in environment variables settings.
4. **Resources Allocation**: Select at least 1GB to 2GB RAM for smooth FFmpeg video rendering.

---

### Option C: Decoupled Deployment (FastAPI on Cloud Run + Next.js on Vercel)

#### Deploy Python FastAPI Backend to Cloud Run
```bash
cd backend
gcloud run deploy music-video-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --set-env-vars "GEMINI_API_KEY=your_gemini_api_key,CORS_ORIGINS=https://your-app.vercel.app"
```

#### Deploy Next.js Frontend to Vercel
1. Import `frontend/` repository into Vercel.
2. Set Environment Variable:
   - `NEXT_PUBLIC_API_URL` = `https://music-video-backend-xyz.a.run.app`
3. Click **Deploy**.

---

## 🧹 5. Ephemeral Disk Cleanup & Memory Strategy

Cloud Run containers share memory and disk space (default 2GB). Since audio/video rendering writes files to `./temp`, stale files must be automatically purged.

### Automatic Purge Implementation
- **Startup Cleanup**: The server purges any leftovers upon boot.
- **Background Scheduler**: A timer runs every 15 minutes, deleting temporary uploads, generated cover images, and MP4 videos older than 1 hour (`60 * 60 * 1000 ms`).

To verify background cleanup status:
```bash
gcloud run logs read --service=ai-music-video-creator --limit=50
```

---

## 🔒 6. CORS & Security Best Practices

1. **Origin Verification**: When serving separate frontend/backend domains, set `CORS_ORIGINS` to prevent unauthorized domain requests.
2. **API Key Isolation**: The `GEMINI_API_KEY` stays exclusively on the server side; it is **never** sent to the client browser.
3. **Upload File Validation**: Audio uploads strictly validate MIME types (`audio/mpeg`, `audio/wav`, `audio/mp4`) and enforce a 50MB maximum size ceiling.

---

## 🧪 7. Post-Deployment Verification Checklist

Follow this checklist after deployment to confirm end-to-end functionality:

| Test Step | Verification Action | Expected Outcome |
| :--- | :--- | :--- |
| **1. Health Check** | Visit `https://your-app.run.app/api/health` | Returns `{"status":"ok"}` with HTTP 200 |
| **2. Audio Upload & ID3 Parsing** | Upload a sample MP3 track | Session created, ID3 title/artist tags parsed automatically |
| **3. AI Cover Generation** | Select style (e.g. Cyberpunk) & click "Generate Artwork" | Gemini Imagen generates a high-res cover image in ~3-5 seconds |
| **4. FFmpeg Video Render** | Click "Generate Video" | Progress bar updates from 0% -> 100%, status changes to `complete` |
| **5. Preview & Download** | Click Play on HTML5 video player and "Download MP4" | Video plays with audio, spectrum visualizer, and MP4 downloads cleanly |
| **6. Disk Cleanup Test** | Check server logs after 1 hour | Log outputs `Purged stale temporary files` |

---

## 🛠️ Maintenance & Troubleshooting

- **FFmpeg missing font error**: Ensure `fonts-freefont-ttf` or `fontconfig` is installed in Docker image.
- **Out of memory error**: Increase Cloud Run memory to `4Gi` for long audio files (>10 minutes).
- **Gemini quota error**: Verify API Key in Google AI Studio dashboard and check quotas for `imagen-3.0-generate-002`.
