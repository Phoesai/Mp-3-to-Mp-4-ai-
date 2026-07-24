import React from 'react';
import { Download, Play, ShieldCheck, Film, RefreshCw, CheckCircle2, Share2, Sparkles, Youtube } from 'lucide-react';
import { VideoSettings } from '../types';

interface VideoPlayerProps {
  sessionId: string;
  settings: VideoSettings;
  fileSize?: number;
  onReset: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  sessionId,
  settings,
  fileSize,
  onReset,
}) => {
  const previewUrl = `/api/preview/${sessionId}`;
  const downloadUrl = `/api/download/${sessionId}`;

  const formattedSize = fileSize ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Your Music Video is Ready!</h2>
            <p className="text-xs text-slate-400">Copyright-Safe H.264 MP4 with hardcoded branding</p>
          </div>
        </div>

        <button
          onClick={onReset}
          className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Create Another Video</span>
        </button>
      </div>

      {/* Video Preview Player */}
      <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video max-w-4xl mx-auto shadow-2xl flex items-center justify-center">
        <video
          src={previewUrl}
          controls
          autoPlay
          className="w-full h-full object-contain"
          poster={settings.coverArtDataUrl}
        >
          Your browser does not support HTML5 video preview.
        </video>
      </div>

      {/* Download Action & Specs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="md:col-span-2 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Details</span>
            <h3 className="text-lg font-bold text-white mt-1">{settings.title}</h3>
            <p className="text-xs text-slate-300 font-medium">{settings.artist} • <span className="text-cyan-400">{settings.channelName}</span></p>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <a
              href={downloadUrl}
              download
              className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download MP4 Video</span>
            </a>
          </div>
        </div>

        {/* Media Specs Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Technical Specs</span>
          <div className="flex justify-between py-1 border-b border-slate-900">
            <span className="text-slate-400">Resolution</span>
            <span className="text-white font-mono">{settings.aspectRatio === '16:9' ? '1920x1080 (1080p)' : settings.aspectRatio === '9:16' ? '1080x1920' : '1080x1080'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-900">
            <span className="text-slate-400">Video Codec</span>
            <span className="text-white font-mono">H.264 (AVC)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-900">
            <span className="text-slate-400">Audio Codec</span>
            <span className="text-white font-mono">AAC / Passthrough</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">File Size</span>
            <span className="text-emerald-400 font-mono font-semibold">{formattedSize}</span>
          </div>
        </div>
      </div>

      {/* Copyright Safety Assurance Checklist */}
      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
        <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>YouTube Content ID & Copyright Safety Checklist</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero external third-party stock clips used</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Overlaid permanent Channel Name & Song Title</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Generated artwork & dynamic audio spectrum</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Custom FFmpeg render fingerprint & intro slate</span>
          </div>
        </div>
      </div>
    </div>
  );
};
