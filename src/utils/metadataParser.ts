import { AudioMetadata } from '../types';

export function isTempName(name: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim();
  if (!clean) return true;
  if (/^audio[-_\s]?\d{10,}[-_\s]?\d+$/i.test(clean)) return true;
  if (/^(file|upload|tmp)[-_\s]?\d{10,}/i.test(clean)) return true;
  if (/^\d{10,}$/.test(clean)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) return true;
  return false;
}

export function smartTitleCase(str: string): string {
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

    if (knownAcronyms.has(upper)) {
      return upper;
    }

    if (/^[A-Z0-9]{2,4}$/.test(word)) {
      return word;
    }

    const lower = word.toLowerCase();
    if (idx > 0 && idx < words.length - 1 && minorWords.has(lower)) {
      return lower;
    }

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

export interface CleanedFilenameResult {
  title: string | null;
  artist: string | null;
  isTemp: boolean;
}

export function cleanFilename(filename: string): CleanedFilenameResult {
  if (!filename) {
    return { title: null, artist: null, isTemp: true };
  }

  // Strip path if present
  let base = filename.replace(/^.*[\\/]/, '');

  // Strip audio extension
  base = base.replace(/\.(mp3|wav|m4a|flac|aac|ogg|wma|aiff)$/i, '').trim();

  // Guard: check if temp name
  if (isTempName(base)) {
    return { title: null, artist: null, isTemp: true };
  }

  // Remove junk patterns: (Official Music Video), [HQ], 320kbps, website names, [4K], etc.
  base = base
    .replace(/\[\s*(official|audio|video|music video|lyric|lyrics|hd|4k|320kbps|128kbps|hq|remastered|full song|free download|out now|[^\s\]]+\.com|[^\s\]]+\.net|[^\s\]]+\.org)\s*\]/gi, '')
    .replace(/\(\s*(official|audio|video|music video|lyric|lyrics|hd|4k|320kbps|128kbps|hq|remastered|full song|free download|out now|[^\s\)]+\.com|[^\s\)]+\.net|[^\s\)]+\.org)\s*\)/gi, '')
    .replace(/(official music video|official audio|official video|lyric video|320kbps|hq audio)/gi, '');

  // Strip leading track numbers: "04 ", "04. ", "04 - ", "04_"
  base = base.replace(/^\s*\d{1,3}\s*[-._\s]+\s*/, '');

  // Convert underscores to spaces
  base = base.replace(/_/g, ' ');

  // Collapse double/multiple spaces
  base = base.replace(/\s+/g, ' ').trim();

  if (!base || isTempName(base)) {
    return { title: null, artist: null, isTemp: true };
  }

  // Split "Artist - Title" if dash present
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
    isTemp: false,
  };
}

export interface ClientId3Result {
  title?: string;
  artist?: string;
  album?: string;
  coverArtDataUrl?: string;
}

export async function readClientSideId3Tags(file: File): Promise<ClientId3Result> {
  return new Promise((resolve) => {
    let hasResolved = false;
    const timer = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        resolve({});
      }
    }, 5000);

    const safeResolve = (res: ClientId3Result) => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timer);
        resolve(res);
      }
    };

    import('jsmediatags/dist/jsmediatags.min.js')
      .then((jsmediatagsModule) => {
        const jsmediatags = jsmediatagsModule.default || jsmediatagsModule;
        if (!jsmediatags || typeof jsmediatags.read !== 'function') {
          safeResolve({});
          return;
        }

        jsmediatags.read(file, {
          onSuccess: (tag: any) => {
            try {
              const tags = tag.tags || {};
              const rawTitle = tags.title ? String(tags.title).trim() : undefined;
              const rawArtist = tags.artist ? String(tags.artist).trim() : undefined;
              const rawAlbum = tags.album ? String(tags.album).trim() : undefined;

              const title = rawTitle && !isTempName(rawTitle) ? rawTitle : undefined;
              const artist = rawArtist && !isTempName(rawArtist) ? rawArtist : undefined;
              const album = rawAlbum && !isTempName(rawAlbum) ? rawAlbum : undefined;

              let coverArtDataUrl: string | undefined = undefined;
              if (tags.picture) {
                const { data, format } = tags.picture;
                let binary = '';
                const bytes = new Uint8Array(data);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binary);
                const mime = format || 'image/jpeg';
                coverArtDataUrl = `data:${mime};base64,${base64}`;
              }

              safeResolve({ title, artist, album, coverArtDataUrl });
            } catch (err) {
              safeResolve({});
            }
          },
          onError: () => {
            safeResolve({});
          },
        });
      })
      .catch(() => {
        safeResolve({});
      });
  });
}

/**
 * Resolves metadata using Priority Order: ID3 tag > cleaned filename > "Untitled Track"
 */
export async function extractClientAudioMetadata(file: File): Promise<AudioMetadata> {
  const [id3Result] = await Promise.all([
    readClientSideId3Tags(file),
  ]);

  const fileClean = cleanFilename(file.name);

  // Priority Order: ID3 tag > cleaned filename > Fallback
  const finalTitle = (id3Result.title && !isTempName(id3Result.title))
    ? id3Result.title
    : (fileClean.title && !isTempName(fileClean.title))
    ? fileClean.title
    : 'Untitled Track';

  const finalArtist = (id3Result.artist && !isTempName(id3Result.artist))
    ? id3Result.artist
    : (fileClean.artist && !isTempName(fileClean.artist))
    ? fileClean.artist
    : 'Unknown Artist';

  const finalAlbum = (id3Result.album && !isTempName(id3Result.album))
    ? id3Result.album
    : '';

  const hasCoverArt = !!id3Result.coverArtDataUrl;

  return {
    title: finalTitle,
    artist: finalArtist,
    album: finalAlbum,
    duration: 0,
    hasCoverArt,
    coverArtDataUrl: id3Result.coverArtDataUrl,
    fileSize: file.size,
  };
}
