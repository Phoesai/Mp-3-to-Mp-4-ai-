import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

export const STYLE_PROMPT_TEMPLATES: Record<string, string> = {
  cinematic: 'Dramatic anamorphic lighting, deep shadows, cinematic atmospheric mood, high contrast, movie scene aesthetic, dark rich color grading, detailed digital painting.',
  fantasy: 'Ethereal dreamscape, glowing mystical magical elements, floating light particles, enchanting forest or sky background, soft magical lighting, fantasy digital artwork.',
  anime: 'Vibrant cel-shaded Japanese animation style, dreamy sky with fluffy clouds, stylized anime landscape aesthetic, rich saturated color palette, clean studio visual.',
  relaxing: 'Lofi pastel color palette, serene calm ocean sunset, minimalistic soft gradient backdrop, tranquil aesthetic, smooth gentle light, chill beat artwork.',
  cyberpunk: 'Neon magenta and electric cyan glow, rain-slicked futuristic cityscape reflection, dark retro-futuristic synthwave vibe, vibrant holographic lighting effects.',
  minimal: 'Clean geometric abstract composition, high fashion monochrome with a single bold accent color, modern flat design layout, spacious negative space.',
};

/**
 * Builds a copyright-safe, highly descriptive prompt for AI Cover Art generation
 */
export function generateCoverPrompt(
  artStyle: string = 'cinematic',
  title: string,
  artist: string,
  genre?: string,
  customPrompt?: string
): string {
  const selectedStyle = artStyle.toLowerCase();
  const styleDescription = STYLE_PROMPT_TEMPLATES[selectedStyle] || STYLE_PROMPT_TEMPLATES['cinematic'];

  // Mandatory copyright safety instructions
  const crSafetyDirective = '100% original, non-copyright-infringing visual artwork. No text, no logos, no trademarked characters or copyrighted brand imagery.';

  if (customPrompt && customPrompt.trim().length > 0) {
    return `Original album cover art inspired by song "${title}" by "${artist}". ${customPrompt.trim()}. Style cues: ${styleDescription}. ${crSafetyDirective} High resolution, 4k digital graphic.`;
  }

  return `Original high-quality album cover art for track titled "${title}" by "${artist}". ${genre ? `Music genre: ${genre}.` : ''} Visual style: ${styleDescription}. Mood: creative visual interpretation of the track title. ${crSafetyDirective} Square 1:1 format, vibrant composition.`;
}

export async function generateAiCoverArt(
  title: string,
  artist: string,
  genre?: string,
  artStyle: string = 'cinematic',
  customPrompt?: string,
  outputPath?: string
): Promise<{ success: boolean; dataUrl?: string; filePath?: string; promptUsed?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = generateCoverPrompt(artStyle, title, artist, genre, customPrompt);

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      success: false,
      promptUsed: prompt,
      error: 'Gemini API key is not configured. Fallback to procedural background graphics.',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Call Imagen model via GenAI SDK
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      const dataUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

      if (outputPath) {
        const buffer = Buffer.from(base64ImageBytes, 'base64');
        await fs.promises.writeFile(outputPath, buffer);
      }

      return {
        success: true,
        dataUrl,
        filePath: outputPath,
        promptUsed: prompt,
      };
    } else {
      return { success: false, promptUsed: prompt, error: 'No image returned from Gemini Imagen' };
    }
  } catch (err: any) {
    console.error('Error generating AI Cover Art with Gemini:', err.message || err);
    return {
      success: false,
      promptUsed: prompt,
      error: err.message || 'Failed to generate AI Cover Art',
    };
  }
}
