/**
 * Shared types for AI Music Video Creator
 */

export interface AudioMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  year?: number;
  genre?: string;
  hasCoverArt: boolean;
  coverArtDataUrl?: string;
  fileSize: number;
}

export type VideoStyle = 'visualizer' | 'kenburns' | 'gradient_loop' | 'minimal_spectrum';
export type ArtStyle = 'cinematic' | 'fantasy' | 'anime' | 'relaxing' | 'cyberpunk' | 'minimal';
export type AspectRatio = '16:9' | '9:16' | '1:1';

export interface VideoSettings {
  style: VideoStyle;
  artStyle: ArtStyle;
  aspectRatio: AspectRatio;
  title: string;
  artist: string;
  channelName: string;
  album?: string;
  addIntro: boolean;
  introTitle?: string;
  visualizerColor: string;
  backgroundColor: string;
  accentColor: string;
  coverArtDataUrl?: string;
  useAiCover: boolean;
  aiPrompt?: string;
}

export type GenerationStage = 
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'preparing_visuals'
  | 'rendering_intro'
  | 'encoding_main'
  | 'stitching'
  | 'complete'
  | 'error';

export interface GenerationStatus {
  sessionId: string;
  stage: GenerationStage;
  progress: number; // 0 to 100
  message: string;
  logs: string[];
  outputUrl?: string;
  downloadUrl?: string;
  error?: string;
  duration?: number;
  fileSize?: number;
}

export interface UploadResponse {
  sessionId: string;
  originalName: string;
  metadata: AudioMetadata;
}
