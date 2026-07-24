import { parseFile } from 'music-metadata';
import fs from 'fs';
import path from 'path';
import { AudioMetadata } from '../src/types.js';

export async function extractMetadata(filePath: string): Promise<AudioMetadata> {
  const stats = await fs.promises.stat(filePath);
  
  try {
    const metadata = await parseFile(filePath);
    const common = metadata.common;
    const format = metadata.format;

    let coverArtDataUrl: string | undefined = undefined;
    let hasCoverArt = false;

    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      const base64 = Buffer.from(picture.data).toString('base64');
      const mime = picture.format || 'image/jpeg';
      coverArtDataUrl = `data:${mime};base64,${base64}`;
      hasCoverArt = true;
    }

    const filename = path.basename(filePath);
    // Fallback title from filename if ID3 title is missing
    const defaultTitle = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

    return {
      title: common.title || defaultTitle || 'Unknown Title',
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      duration: Math.round(format.duration || 0),
      year: common.year,
      genre: common.genre ? common.genre.join(', ') : undefined,
      hasCoverArt,
      coverArtDataUrl,
      fileSize: stats.size,
    };
  } catch (error) {
    console.error('Error extracting ID3 tags:', error);
    const filename = path.basename(filePath);
    const defaultTitle = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    
    return {
      title: defaultTitle || 'Unknown Title',
      artist: 'Unknown Artist',
      album: 'Single',
      duration: 0,
      hasCoverArt: false,
      fileSize: stats.size,
    };
  }
}
