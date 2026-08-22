import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Convert SVG to PNG using ffmpeg or generate via canvas/pure script
function runCmd(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited with ${code}: ${err}`));
    });
  });
}

async function generatePngIcons() {
  const svgPath = path.join(publicDir, 'favicon.svg');
  const icon192 = path.join(publicDir, 'icon-192.png');
  const icon512 = path.join(publicDir, 'icon-512.png');
  const iconMaskable192 = path.join(publicDir, 'icon-maskable-192.png');
  const iconMaskable512 = path.join(publicDir, 'icon-maskable-512.png');
  const appleTouchIcon = path.join(publicDir, 'apple-touch-icon.png');

  console.log('Generating PNG icons from SVG using FFmpeg...');
  try {
    await runCmd('ffmpeg', ['-y', '-i', svgPath, '-vf', 'scale=192:192', icon192]);
    await runCmd('ffmpeg', ['-y', '-i', svgPath, '-vf', 'scale=512:512', icon512]);
    await runCmd('ffmpeg', ['-y', '-i', svgPath, '-vf', 'scale=192:192', iconMaskable192]);
    await runCmd('ffmpeg', ['-y', '-i', svgPath, '-vf', 'scale=512:512', iconMaskable512]);
    await runCmd('ffmpeg', ['-y', '-i', svgPath, '-vf', 'scale=180:180', appleTouchIcon]);
    console.log('Successfully generated all PWA icons!');
  } catch (err: any) {
    console.error('Error generating icons via ffmpeg SVG:', err.message);
    // Fallback: Generate PNG directly via FFmpeg color/filter synthesis
    console.log('Generating icons via FFmpeg filter fallback...');
    const generateFallback = async (size: number, outPath: string) => {
      const filter = [
        `color=c=0x0f172a:s=${size}x${size}:d=1[bg]`,
        `[bg]drawbox=x=0:y=0:w=${size}:h=${size}:color=0x00f2fe@0.4:t=${Math.max(2, Math.floor(size * 0.02))}[b1]`,
        `[b1]drawtext=text='MV':fontcolor=0x00f2fe:fontsize=${Math.floor(size * 0.35)}:x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=0x8b5cf6@0.8:shadowx=3:shadowy=3[out]`
      ].join(';');
      await runCmd('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=0x0f172a:s=${size}x${size}:d=1`, '-filter_complex', filter, '-frames:v', '1', outPath]);
    };

    await generateFallback(192, icon192);
    await generateFallback(512, icon512);
    await generateFallback(192, iconMaskable192);
    await generateFallback(512, iconMaskable512);
    await generateFallback(180, appleTouchIcon);
    console.log('Fallback icons generated successfully!');
  }
}

generatePngIcons();
