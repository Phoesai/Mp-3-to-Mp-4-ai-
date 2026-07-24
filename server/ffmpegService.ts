import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { VideoSettings, GenerationStatus } from '../src/types.js';

const FONT_PATH = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf';

/**
 * Escapes text for FFmpeg drawtext filter graph
 */
function escapeFfmpegText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%');
}

/**
 * Normalizes hex color string to FFmpeg compatible format (0xRRGGBB)
 */
function toFfmpegColor(hex: string): string {
  if (!hex) return '0x101020';
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  return `0x${clean}`;
}

/**
 * Generates an MP4 video from audio and user settings using FFmpeg
 */
export async function renderMusicVideo(
  sessionId: string,
  audioPath: string,
  settings: VideoSettings,
  audioDuration: number,
  coverImagePath: string | null,
  outputVideoPath: string,
  updateStatus: (statusPartial: Partial<GenerationStatus>) => void
): Promise<string> {
  updateStatus({
    stage: 'preparing_visuals',
    progress: 10,
    message: 'Preparing graphic elements & visual layout...',
    logs: ['Initializing rendering pipeline', `Audio duration: ${audioDuration} seconds`],
  });

  const tempDir = path.dirname(outputVideoPath);
  const mainVideoTempPath = path.join(tempDir, `main_${sessionId}.mp4`);
  const introVideoTempPath = path.join(tempDir, `intro_${sessionId}.mp4`);

  // Resolution setup
  let width = 1920;
  let height = 1080;
  if (settings.aspectRatio === '9:16') {
    width = 1080;
    height = 1920;
  } else if (settings.aspectRatio === '1:1') {
    width = 1080;
    height = 1080;
  }

  const escapedTitle = escapeFfmpegText(settings.title || 'Untitled Track');
  const escapedArtist = escapeFfmpegText(settings.artist || 'Unknown Artist');
  const escapedChannel = escapeFfmpegText(settings.channelName || 'Official Channel');
  const escapedIntroText = escapeFfmpegText(settings.introTitle || settings.channelName || 'PREMIERE');

  const bgColor = toFfmpegColor(settings.backgroundColor || '#0f172a');
  const visColor = settings.visualizerColor || '#00f2fe';
  const visFfmpegColor = toFfmpegColor(visColor);

  // 1. STEP ONE: Render Intro Slate if enabled
  if (settings.addIntro) {
    updateStatus({
      stage: 'rendering_intro',
      progress: 25,
      message: 'Rendering 5-second copyright-safe intro slate...',
      logs: ['Generating 5-second branded intro slate'],
    });

    const introDuration = 5;
    // Intro filtergraph: Gradient background + Animated waves + Channel name text overlay
    const introFilterGraph = [
      `color=c=${bgColor}:s=${width}x${height}:d=${introDuration}[bg]`,
      `aevalsrc=0:d=${introDuration}[silent_audio]`,
      `[silent_audio]showwaves=s=${width}x200:mode=line:colors=${visFfmpegColor}@0.8:rate=25[waves]`,
      `[bg][waves]overlay=x=0:y=${Math.floor(height * 0.75)}[bg_waves]`,
      `[bg_waves]drawtext=fontfile=${FONT_PATH}:text='${escapedIntroText}':fontcolor=white:fontsize=${Math.floor(width * 0.045)}:x=(w-text_w)/2:y=(h-text_h)/2-40:shadowcolor=black@0.6:shadowx=2:shadowy=2[t1]`,
      `[t1]drawtext=fontfile=${FONT_PATH}:text='OFFICIAL RELEASE':fontcolor=0xa0aec0:fontsize=${Math.floor(width * 0.02)}:x=(w-text_w)/2:y=(h-text_h)/2+40[intro_out]`
    ].join(';');

    const introArgs = [
      '-y',
      '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${width}x${height}:d=${introDuration}`,
      '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`,
      '-t', `${introDuration}`,
      '-filter_complex', introFilterGraph,
      '-map', '[intro_out]',
      '-map', '1:a',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-r', '25',
      introVideoTempPath
    ];

    await runFfmpegCommand(introArgs, (line) => {
      // Progress parsing
    });
  }

  // 2. STEP TWO: Render Main Video with Audio
  updateStatus({
    stage: 'encoding_main',
    progress: 40,
    message: 'Encoding main video with audio visualizer & text overlays...',
    logs: [`Generating video style: ${settings.style}`],
  });

  const mainDuration = audioDuration > 0 ? audioDuration : 10;
  let mainFfmpegArgs: string[] = [];

  // Determine Main Video Filter Graph based on selected style
  if (settings.style === 'visualizer' || settings.style === 'minimal_spectrum') {
    // AUDIO VISUALIZER STYLE
    let visMode = 'showwaves';
    if (settings.style === 'minimal_spectrum') {
      visMode = 'showfreqs';
    }

    const filterGraph = [
      // Input 0: Color background
      `color=c=${bgColor}:s=${width}x${height}:d=${mainDuration}[bg]`,
      // Visualizer from input 1 (audio)
      `[1:a]${visMode}=s=${Math.floor(width * 0.85)}x${Math.floor(height * 0.25)}:mode=line:colors=${visFfmpegColor}:rate=25[vis]`,
      // Overlay visualizer on background
      `[bg][vis]overlay=x=(W-w)/2:y=${Math.floor(height * 0.65)}[bg_vis]`,
      // Draw Channel Name (Top)
      `[bg_vis]drawtext=fontfile=${FONT_PATH}:text='${escapedChannel}':fontcolor=${visFfmpegColor}:fontsize=${Math.floor(width * 0.025)}:x=(w-text_w)/2:y=${Math.floor(height * 0.12)}:shadowcolor=black@0.8:shadowx=2:shadowy=2[t1]`,
      // Draw Song Title (Center)
      `[t1]drawtext=fontfile=${FONT_PATH}:text='${escapedTitle}':fontcolor=white:fontsize=${Math.floor(width * 0.048)}:x=(w-text_w)/2:y=(h-text_h)/2-50:shadowcolor=black@0.9:shadowx=3:shadowy=3[t2]`,
      // Draw Artist Name (Below Title)
      `[t2]drawtext=fontfile=${FONT_PATH}:text='${escapedArtist}':fontcolor=0xe2e8f0:fontsize=${Math.floor(width * 0.028)}:x=(w-text_w)/2:y=(h-text_h)/2+20:shadowcolor=black@0.8:shadowx=2:shadowy=2[main_out]`
    ].join(';');

    mainFfmpegArgs = [
      '-y',
      '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${width}x${height}:d=${mainDuration}`,
      '-i', audioPath,
      '-filter_complex', filterGraph,
      '-map', '[main_out]',
      '-map', '1:a',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-shortest',
      mainVideoTempPath
    ];
  } else if (settings.style === 'kenburns' && coverImagePath && fs.existsSync(coverImagePath)) {
    // KEN BURNS ANIMATED COVER ART STYLE
    const fps = 25;
    const totalFrames = Math.ceil(mainDuration * fps);

    const filterGraph = [
      // Scale cover image
      `[0:v]scale=${width * 2}:${height * 2},zoompan=z='min(zoom+0.0005,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}[bg]`,
      // Visualizer overlay at bottom
      `[1:a]showwaves=s=${Math.floor(width * 0.8)}x120:mode=line:colors=${visFfmpegColor}@0.9:rate=${fps}[vis]`,
      `[bg][vis]overlay=x=(W-w)/2:y=${Math.floor(height * 0.78)}[bg_vis]`,
      // Text Overlay
      `[bg_vis]drawtext=fontfile=${FONT_PATH}:text='${escapedChannel}':fontcolor=${visFfmpegColor}:fontsize=${Math.floor(width * 0.025)}:x=(w-text_w)/2:y=${Math.floor(height * 0.1)}:shadowcolor=black@0.9:shadowx=2:shadowy=2[t1]`,
      `[t1]drawtext=fontfile=${FONT_PATH}:text='${escapedTitle}':fontcolor=white:fontsize=${Math.floor(width * 0.045)}:x=(w-text_w)/2:y=${Math.floor(height * 0.58)}:shadowcolor=black@0.9:shadowx=3:shadowy=3[t2]`,
      `[t2]drawtext=fontfile=${FONT_PATH}:text='${escapedArtist}':fontcolor=0xe2e8f0:fontsize=${Math.floor(width * 0.028)}:x=(w-text_w)/2:y=${Math.floor(height * 0.65)}:shadowcolor=black@0.9:shadowx=2:shadowy=2[main_out]`
    ].join(';');

    mainFfmpegArgs = [
      '-y',
      '-loop', '1', '-i', coverImagePath,
      '-i', audioPath,
      '-filter_complex', filterGraph,
      '-map', '[main_out]',
      '-map', '1:a',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-shortest',
      mainVideoTempPath
    ];
  } else {
    // GRADIENT LOOP / DEFAULT FALLBACK STYLE
    const filterGraph = [
      `color=c=${bgColor}:s=${width}x${height}:d=${mainDuration}[bg]`,
      `[1:a]showspectrum=s=${width}x${Math.floor(height * 0.35)}:mode=combined:color=rainbow:scale=log[spec]`,
      `[bg][spec]overlay=x=0:y=${Math.floor(height * 0.65)}:format=auto[bg_spec]`,
      `[bg_spec]drawtext=fontfile=${FONT_PATH}:text='${escapedChannel}':fontcolor=${visFfmpegColor}:fontsize=${Math.floor(width * 0.028)}:x=(w-text_w)/2:y=${Math.floor(height * 0.15)}:shadowcolor=black@0.8:shadowx=2:shadowy=2[t1]`,
      `[t1]drawtext=fontfile=${FONT_PATH}:text='${escapedTitle}':fontcolor=white:fontsize=${Math.floor(width * 0.05)}:x=(w-text_w)/2:y=(h-text_h)/2-40:shadowcolor=black@0.9:shadowx=3:shadowy=3[t2]`,
      `[t2]drawtext=fontfile=${FONT_PATH}:text='${escapedArtist}':fontcolor=0xe2e8f0:fontsize=${Math.floor(width * 0.03)}:x=(w-text_w)/2:y=(h-text_h)/2+30:shadowcolor=black@0.8:shadowx=2:shadowy=2[main_out]`
    ].join(';');

    mainFfmpegArgs = [
      '-y',
      '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${width}x${height}:d=${mainDuration}`,
      '-i', audioPath,
      '-filter_complex', filterGraph,
      '-map', '[main_out]',
      '-map', '1:a',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-shortest',
      mainVideoTempPath
    ];
  }

  // Run Main Video Rendering
  await runFfmpegCommand(mainFfmpegArgs, (logLine) => {
    // Extract progress if available
    const timeMatch = logLine.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (timeMatch) {
      const hours = parseFloat(timeMatch[1]);
      const mins = parseFloat(timeMatch[2]);
      const secs = parseFloat(timeMatch[3]);
      const currentSecs = hours * 3600 + mins * 60 + secs;
      const pct = Math.min(90, Math.floor(40 + (currentSecs / mainDuration) * 50));
      updateStatus({ progress: pct, message: `Encoding video: ${pct}% complete...` });
    }
  });

  // 3. STEP THREE: Concatenate Intro + Main Video if intro is enabled
  if (settings.addIntro && fs.existsSync(introVideoTempPath)) {
    updateStatus({
      stage: 'stitching',
      progress: 92,
      message: 'Stitching intro slate with main music video...',
      logs: ['Merging intro slate and main video track'],
    });

    const concatListPath = path.join(tempDir, `concat_${sessionId}.txt`);
    const concatContent = `file '${introVideoTempPath.replace(/'/g, "'\\''")}'\nfile '${mainVideoTempPath.replace(/'/g, "'\\''")}'\n`;
    await fs.promises.writeFile(concatListPath, concatContent);

    const concatArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      outputVideoPath
    ];

    await runFfmpegCommand(concatArgs, () => {});

    // Clean temp chunk files
    try {
      await fs.promises.unlink(concatListPath);
      await fs.promises.unlink(introVideoTempPath);
      await fs.promises.unlink(mainVideoTempPath);
    } catch (e) {}
  } else {
    // Move main temp video to output destination
    await fs.promises.rename(mainVideoTempPath, outputVideoPath);
  }

  const stats = await fs.promises.stat(outputVideoPath);

  updateStatus({
    stage: 'complete',
    progress: 100,
    message: 'Music Video generated successfully! Ready to preview & download.',
    fileSize: stats.size,
    logs: ['Video rendering completed', `Output file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`],
  });

  return outputVideoPath;
}

/**
 * Spawns FFmpeg process and handles output/error logs
 */
function runFfmpegCommand(args: string[], onLog: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn('ffmpeg', args);

    ffmpegProcess.stderr.on('data', (data) => {
      const log = data.toString();
      onLog(log);
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process failed with exit code ${code}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      reject(err);
    });
  });
}
