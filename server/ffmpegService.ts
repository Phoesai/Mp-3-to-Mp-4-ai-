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
 * Spawns an external command (ffmpeg/ffprobe) and streams stdout/stderr line by line
 */
export function runCommand(cmd: string, args: string[], onLog: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmdStr = `${cmd} ${args.map(a => (a.includes(' ') || a.includes(':') || a.includes(';') ? `"${a}"` : a)).join(' ')}`;
    onLog(`[CMD] ${cmdStr}`);

    const proc = spawn(cmd, args);
    let stderrBuffer = '';
    const recentStderrLines: string[] = [];

    const processChunk = (data: Buffer) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split(/\r?\n/);
      // Keep incomplete trailing line in buffer
      stderrBuffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().length > 0) {
          recentStderrLines.push(line);
          if (recentStderrLines.length > 50) {
            recentStderrLines.shift();
          }
          onLog(line);
        }
      }
    };

    proc.stderr.on('data', processChunk);
    proc.stdout.on('data', processChunk);

    proc.on('close', (code) => {
      if (stderrBuffer.trim().length > 0) {
        const finalLine = stderrBuffer.trim();
        recentStderrLines.push(finalLine);
        onLog(finalLine);
        stderrBuffer = '';
      }

      if (code === 0) {
        resolve();
      } else {
        const errDetail = recentStderrLines.slice(-15).join('\n') || 'No stderr output captured';
        reject(new Error(`${cmd} process failed with exit code ${code}:\n${errDetail}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start ${cmd} process: ${err.message}`));
    });
  });
}

/**
 * Convenience wrapper for running FFmpeg commands
 */
export function runFfmpegCommand(args: string[], onLog: (line: string) => void): Promise<void> {
  return runCommand('ffmpeg', args, onLog);
}

/**
 * Robust duration probe: tries ffprobe first, then falls back to decoding with ffmpeg
 */
export async function probeAudioDuration(audioPath: string, onLog: (line: string) => void): Promise<number> {
  const absPath = path.resolve(audioPath);
  onLog(`[PROBE] Probing audio duration for: ${absPath}`);

  // METHOD 1: ffprobe
  const ffprobeArgs = [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    absPath
  ];

  try {
    let rawStdout = '';
    await new Promise<void>((resolve, reject) => {
      const cmdStr = `ffprobe ${ffprobeArgs.join(' ')}`;
      onLog(`[CMD] ${cmdStr}`);

      const proc = spawn('ffprobe', ffprobeArgs);
      proc.stdout.on('data', d => { rawStdout += d.toString(); });
      proc.stderr.on('data', d => {
        const str = d.toString();
        str.split(/\r?\n/).forEach(l => { if (l.trim()) onLog(`[ffprobe stderr] ${l.trim()}`); });
      });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffprobe exited with code ${code}`));
      });
      proc.on('error', err => reject(err));
    });

    const durationStr = rawStdout.trim();
    onLog(`[PROBE STDOUT] ffprobe output: "${durationStr}"`);
    const parsedDuration = parseFloat(durationStr);

    if (!isNaN(parsedDuration) && parsedDuration > 0) {
      onLog(`[PROBE SUCCESS] Audio duration detected via ffprobe: ${parsedDuration.toFixed(2)} seconds`);
      return parsedDuration;
    } else {
      onLog(`[PROBE NOTICE] ffprobe returned non-positive value ("${durationStr}"), attempting ffmpeg decode fallback...`);
    }
  } catch (err: any) {
    onLog(`[PROBE WARNING] ffprobe failed: ${err.message}. Attempting ffmpeg decode fallback...`);
  }

  // METHOD 2: Fallback decoding ffmpeg -i <file> -f null -
  onLog(`[PROBE FALLBACK] Decoding audio stream with ffmpeg to parse exact duration...`);
  const fallbackArgs = ['-i', absPath, '-f', 'null', '-'];

  let maxTimeSeconds = 0;
  try {
    await runFfmpegCommand(fallbackArgs, (line) => {
      onLog(line);
      const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/) || line.match(/time=(\d+\.\d+)/);
      if (timeMatch) {
        if (timeMatch.length === 4) {
          const hrs = parseFloat(timeMatch[1]);
          const mins = parseFloat(timeMatch[2]);
          const secs = parseFloat(timeMatch[3]);
          const totalSecs = hrs * 3600 + mins * 60 + secs;
          if (totalSecs > maxTimeSeconds) maxTimeSeconds = totalSecs;
        } else if (timeMatch.length === 2) {
          const totalSecs = parseFloat(timeMatch[1]);
          if (totalSecs > maxTimeSeconds) maxTimeSeconds = totalSecs;
        }
      }
    });

    if (maxTimeSeconds > 0) {
      onLog(`[PROBE SUCCESS] Audio duration detected via ffmpeg decode fallback: ${maxTimeSeconds.toFixed(2)} seconds`);
      return maxTimeSeconds;
    }
  } catch (err: any) {
    onLog(`[PROBE ERROR] Fallback ffmpeg decode failed: ${err.message}`);
  }

  return 0;
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
  // 1. VALIDATE INPUT FILE
  const absAudioPath = path.resolve(audioPath);
  updateStatus({
    stage: 'analyzing',
    progress: 5,
    message: 'Validating input audio file & path...',
    logs: ['Initializing rendering pipeline', `Resolving audio file path: ${absAudioPath}`],
  });

  if (!fs.existsSync(absAudioPath)) {
    const errMsg = `Uploaded audio file does not exist at path: ${absAudioPath}`;
    updateStatus({ stage: 'error', message: errMsg, logs: [`ERROR: ${errMsg}`] });
    throw new Error(errMsg);
  }

  const audioStat = await fs.promises.stat(absAudioPath);
  updateStatus({
    logs: [`Validated audio file exists - Byte size: ${audioStat.size} bytes (${(audioStat.size / (1024 * 1024)).toFixed(2)} MB)`],
  });

  if (audioStat.size === 0) {
    const errMsg = `Uploaded audio file is empty (0 bytes) at path: ${absAudioPath}`;
    updateStatus({ stage: 'error', message: errMsg, logs: [`ERROR: ${errMsg}`] });
    throw new Error(errMsg);
  }

  // 2. DURATION PROBE & FAIL FAST GUARD
  updateStatus({
    stage: 'analyzing',
    progress: 10,
    message: 'Probing audio duration with ffprobe & ffmpeg fallback...',
  });

  const verifiedDuration = await probeAudioDuration(absAudioPath, (line) => {
    updateStatus({ logs: [line] });
  });

  if (verifiedDuration <= 0) {
    const failMsg = 'Could not read audio duration - the uploaded file may be empty or corrupt';
    updateStatus({ stage: 'error', message: failMsg, logs: [`ERROR: ${failMsg}`] });
    throw new Error(failMsg);
  }

  const mainDuration = verifiedDuration;
  updateStatus({
    stage: 'preparing_visuals',
    progress: 15,
    message: 'Preparing graphic elements & visual layout...',
    logs: [`Verified audio duration: ${mainDuration.toFixed(2)} seconds`],
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

  // 3. STEP ONE: Render Intro Slate if enabled
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
      updateStatus({ logs: [line] });
    });
  }

  // 4. STEP TWO: Render Main Video with Audio
  updateStatus({
    stage: 'encoding_main',
    progress: 40,
    message: 'Encoding main video with audio visualizer & text overlays...',
    logs: [`Generating video style: ${settings.style}`],
  });

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
      '-i', absAudioPath,
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
      '-i', absAudioPath,
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
      '-i', absAudioPath,
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
      updateStatus({ progress: pct, message: `Encoding video: ${pct}% complete...`, logs: [logLine] });
    } else {
      updateStatus({ logs: [logLine] });
    }
  });

  // 5. STEP THREE: Concatenate Intro + Main Video if intro is enabled
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

    await runFfmpegCommand(concatArgs, (line) => {
      updateStatus({ logs: [line] });
    });

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
