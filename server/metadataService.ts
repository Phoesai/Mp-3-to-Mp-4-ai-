import { parseFile } from 'music-metadata';
import fs from 'fs';
import path from 'path';
import { AudioMetadata } from '../src/types.js';

function isTempName(name: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim();
  if (!clean) return true;
  if (/^audio[-_\s]?\d{10,}[-_\s]?\d+$/i.test(clean)) return true;
  if (/^(file|upload|tmp)[-_\s]?\d{10,}/i.test(clean)) return true;
  if (/^\d{10,}$/.test(clean)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) return true;
  return false;
}

function smartTitleCase(str: string): string {
  if (!str) return '';

  const knownAcronyms = new Set([
    'DJ', 'EDM', 'MV', 'HQ', 'TV', 'FM', 'UK', 'US', 'EP', 'LP', 'MP3', 'ID', 'AI', 'VS', 'VIP', '4K', 'HD', 'FEAT', 'FT'
  ]);

  const minorWords = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'with'
  ]);

  const words = str.split(/\s+/);
  return words.map((word, idx) => {
    if (!word) return '';
    const upper = word.toUpperCase();

    if (knownAcronyms.has(upper)) return upper;
    if (/^[A-Z0-9]{2,4}$/.test(word)) return word;

    const lower = word.toLowerCase();
    if (idx > 0 && idx < words.length - 1 && minorWords.has(lower)) {
      return lower;
    }

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

function cleanFilename(filename: string): { title: string | null; artist: string | null } {
  if (!filename) return { title: null, artist: null };

  let base = filename.replace(/^.*[\\/]/, '');
  base = base.replace(/\.(mp3|wav|m4a|flac|aac|ogg|wma|aiff)$/i, '').trim();

  if (isTempName(base)) return { title: null, artist: null };

  base = base
    .replace(/\[\s*(official|audio|video|music video|lyric|lyrics|hd|4k|320kbps|128kbps|hq|remastered|full song|free download|out now|[^\s\]]+\.com|[^\s\]]+\.net|[^\s\]]+\.org)\s*\]/gi, '')
    .replace(/\(\s*(official|audio|video|music video|lyric|lyrics|hd|4k|320kbps|128kbps|hq|remastered|full song|free download|out now|[^\s\)]+\.com|[^\s\)]+\.net|[^\s\)]+\.org)\s*\)/gi, '')
    .replace(/(official music video|official audio|official video|lyric video|320kbps|hq audio)/gi, '');

  base = base.replace(/^\s*\d{1,3}\s*[-._\s]+\s*/, '');
  base = base.replace(/_/g, ' ');
  base = base.replace(/\s+/g, ' ').trim();

  if (!base || isTempName(base)) return { title: null, artist: null };

  let rawArtist: string | null = null;
  let rawTitle: string | null = null;

  const dashMatch = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dashMatch) {
    rawArtist = dashMatch[1].trim();
    rawTitle = dashMatch[2].trim();
  } else {
    rawTitle = base.trim();
  }

  const cleanTitle = rawTitle ? smartTitleCase(rawTitle) : null;
  const cleanArtist = rawArtist ? smartTitleCase(rawArtist) : null;

  return {
    title: cleanTitle && !isTempName(cleanTitle) ? cleanTitle : null,
    artist: cleanArtist && !isTempName(cleanArtist) ? cleanArtist : null,
  };
}

export async function extractMetadata(filePath: string, originalName?: string): Promise<AudioMetadata> {
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

    const fileClean = originalName ? cleanFilename(originalName) : { title: null, artist: null };

    const rawId3Title = common.title ? String(common.title).trim() : null;
    const rawId3Artist = common.artist ? String(common.artist).trim() : null;
    const rawId3Album = common.album ? String(common.album).trim() : null;

    const id3Title = rawId3Title && !isTempName(rawId3Title) ? rawId3Title : null;
    const id3Artist = rawId3Artist && !isTempName(rawId3Artist) ? rawId3Artist : null;
    const id3Album = rawId3Album && !isTempName(rawId3Album) ? rawId3Album : null;

    const finalTitle = id3Title || fileClean.title || 'Untitled Track';
    const finalArtist = id3Artist || fileClean.artist || 'Unknown Artist';
    const finalAlbum = id3Album || '';

    return {
      title: finalTitle,
      artist: finalArtist,
      album: finalAlbum,
      duration: Math.round(format.duration || 0),
      year: common.year,
      genre: common.genre ? common.genre.join(', ') : undefined,
      hasCoverArt,
      coverArtDataUrl,
      fileSize: stats.size,
    };
  } catch (error) {
    console.error('Error extracting ID3 tags on server:', error);
    const fileClean = originalName ? cleanFilename(originalName) : { title: null, artist: null };
    
    return {
      title: fileClean.title || 'Untitled Track',
      artist: fileClean.artist || 'Unknown Artist',
      album: '',
      duration: 0,
      hasCoverArt: false,
      fileSize: stats.size,
    };
  }
}
