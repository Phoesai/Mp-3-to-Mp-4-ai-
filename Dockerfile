# Multi-stage Dockerfile for Node.js + Express + Vite + FFmpeg Application
# Suitable for Google Cloud Run, Railway, Render, or Docker deployment

# --- Stage 1: Build Phase ---
FROM node:20-slim AS builder

WORKDIR /app

# Install system build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy full application code and build client assets
COPY . .
RUN npm run build

# --- Stage 2: Production Execution Stage ---
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install FFmpeg and required audio/video runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Copy build artifacts and dependencies from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src

# Create required temporary working directories
RUN mkdir -p temp/uploads temp/outputs temp/covers

# Expose HTTP port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.cjs"]
