import React, { useRef, useState } from 'react';
import { Upload, Music, FileAudio, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { AudioMetadata } from '../types';
import { extractClientAudioMetadata } from '../utils/metadataParser';

interface AudioUploaderProps {
  onAudioUploaded: (data: { sessionId: string; metadata: AudioMetadata; file: File; isPending?: boolean }) => void;
  isLoading: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAudioUploaded, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    if (!file.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)) {
      setUploadError('Please select a valid audio file (MP3, WAV, M4A, AAC, OGG, FLAC)');
      return;
    }

    setUploadError(null);
    setCurrentFile(file);
    setIsAnalyzing(true);

    // Rule 5: Run client-side ID3 tag reading & filename cleaning immediately in file onChange handler before/during upload
    let clientMetadata: AudioMetadata | null = null;
    try {
      clientMetadata = await extractClientAudioMetadata(file);
      onAudioUploaded({
        sessionId: '',
        metadata: clientMetadata,
        file,
        isPending: true,
      });
    } catch (err) {
      console.error('Client metadata extraction error:', err);
    }

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to upload audio file');
      }

      const data = await response.json();
      
      // Merge server metadata (e.g. duration, server coverPath) with client metadata
      const mergedMetadata: AudioMetadata = {
        title: clientMetadata?.title || data.metadata?.title || 'Untitled Track',
        artist: clientMetadata?.artist || data.metadata?.artist || 'Unknown Artist',
        album: clientMetadata?.album || data.metadata?.album || '',
        duration: data.metadata?.duration || clientMetadata?.duration || 0,
        genre: data.metadata?.genre || clientMetadata?.genre,
        hasCoverArt: clientMetadata?.hasCoverArt || data.metadata?.hasCoverArt || false,
        coverArtDataUrl: clientMetadata?.coverArtDataUrl || data.metadata?.coverArtDataUrl,
        fileSize: file.size,
      };

      onAudioUploaded({
        sessionId: data.sessionId,
        metadata: mergedMetadata,
        file,
        isPending: false,
      });
    } catch (err: any) {
      setUploadError(err.message || 'Error processing uploaded audio');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">1. Select Audio Track</h2>
            <p className="text-xs text-slate-400">Upload your original MP3 file to extract ID3 metadata</p>
          </div>
        </div>
        {currentFile && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Audio Loaded
          </span>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-cyan-500 bg-cyan-500/5'
            : currentFile
            ? 'border-slate-700 bg-slate-950/50 hover:border-slate-600'
            : 'border-slate-800 bg-slate-950/30 hover:border-cyan-500/50 hover:bg-slate-950/60'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/ogg,audio/flac"
          className="hidden"
        />

        {isLoading || isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
            <p className="text-sm font-medium text-white">Analyzing Audio & Extracting ID3 Tags...</p>
            <p className="text-xs text-slate-400 mt-1">Reading Title, Artist, Album & embedded cover art</p>
          </div>
        ) : currentFile ? (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
              <FileAudio className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white max-w-md truncate">{currentFile.name}</p>
            <p className="text-xs text-slate-400 mt-1">
              {(currentFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace file
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mb-3 group-hover:text-cyan-400 group-hover:scale-105 transition-all">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-white mb-1">
              Drag & Drop your MP3 file here or <span className="text-cyan-400 underline">Browse</span>
            </p>
            <p className="text-xs text-slate-400">Supports MP3, WAV, M4A, FLAC up to 50MB</p>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="mt-3 flex items-center space-x-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};
