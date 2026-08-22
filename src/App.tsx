import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AudioUploader } from './components/AudioUploader';
import { MetadataEditor } from './components/MetadataEditor';
import { VideoStyleSelector } from './components/VideoStyleSelector';
import { GenerationProgress } from './components/GenerationProgress';
import { VideoPlayer } from './components/VideoPlayer';
import { AudioMetadata, VideoSettings, GenerationStatus } from './types';
import { Video, Play, Sparkles, ShieldCheck, Zap, Music2 } from 'lucide-react';

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);

  // Track user touched fields so manual edits are NEVER overwritten
  const [userTouched, setUserTouched] = useState({
    title: false,
    artist: false,
    album: false,
  });

  const [settings, setSettings] = useState<VideoSettings>({
    style: 'visualizer',
    artStyle: 'cinematic',
    aspectRatio: '16:9',
    title: '',
    artist: '',
    channelName: 'OFFICIAL MUSIC CHANNEL',
    album: '',
    addIntro: true,
    introTitle: 'PREMIERE RELEASE',
    visualizerColor: '#00f2fe',
    backgroundColor: '#0f172a',
    accentColor: '#a855f7',
    useAiCover: false,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);

  // Poll status when generation is active
  useEffect(() => {
    let interval: any = null;

    if (isGenerating && sessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${sessionId}`);
          if (res.ok) {
            const statusData: GenerationStatus = await res.json();
            setGenerationStatus(statusData);

            if (statusData.stage === 'complete') {
              setIsGenerating(false);
              clearInterval(interval);
            } else if (statusData.stage === 'error') {
              setIsGenerating(false);
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, sessionId]);

  const handleFieldTouched = (field: 'title' | 'artist' | 'album') => {
    setUserTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleAudioUploaded = (data: { sessionId: string; metadata: AudioMetadata; isPending?: boolean }) => {
    if (data.sessionId) {
      setSessionId(data.sessionId);
    }
    setMetadata(data.metadata);

    // Pre-fill settings with extracted metadata, respecting userTouched flags
    setSettings((prev) => ({
      ...prev,
      title: userTouched.title ? prev.title : (data.metadata.title || 'Untitled Track'),
      artist: userTouched.artist ? prev.artist : (data.metadata.artist || 'Unknown Artist'),
      album: userTouched.album ? prev.album : (data.metadata.album || ''),
      coverArtDataUrl: data.metadata.coverArtDataUrl || prev.coverArtDataUrl,
      useAiCover: data.metadata.coverArtDataUrl ? false : prev.useAiCover,
    }));
  };

  const handleStartGeneration = async () => {
    if (!sessionId) return;

    setIsGenerating(true);
    setGenerationStatus({
      sessionId,
      stage: 'analyzing',
      progress: 5,
      message: 'Starting FFmpeg processing job...',
      logs: ['Initiating video creation pipeline'],
    });

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          settings,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start video rendering');
      }
    } catch (err: any) {
      setIsGenerating(false);
      alert(`Generation Error: ${err.message}`);
    }
  };

  const handleReset = () => {
    setSessionId(null);
    setMetadata(null);
    setIsGenerating(false);
    setGenerationStatus(null);
    setUserTouched({ title: false, artist: false, album: false });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>Pure MP3 to Copyright-Safe Video Renderer</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Turn Any MP3 Into A <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">YouTube-Ready Music Video</span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Generate 100% copyright-safe music videos directly from your uploaded track. Extracts ID3 tags, overlays track text, generates dynamic audio spectrums & Ken Burns cover art without external stock clips.
          </p>
        </div>

        {/* STEP 1: Audio Upload */}
        <AudioUploader
          onAudioUploaded={handleAudioUploaded}
          isLoading={isLoadingUpload}
        />

        {/* STEP 2 & 3: Metadata Editor & Video Settings (Shown when metadata is available) */}
        {metadata && !generationStatus && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <MetadataEditor
              metadata={metadata}
              sessionId={sessionId || ''}
              settings={settings}
              onSettingsChange={setSettings}
              onFieldTouched={handleFieldTouched}
            />

            <VideoStyleSelector
              settings={settings}
              onSettingsChange={setSettings}
            />

            {/* Action Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Ready to Render Copyright-Safe Video
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Style: <span className="text-cyan-400 capitalize">{settings.style}</span> • Aspect: <span className="text-cyan-400">{settings.aspectRatio}</span> • Intro Slate: <span className="text-cyan-400">{settings.addIntro ? 'Enabled (5s)' : 'Disabled'}</span>
                </p>
              </div>

              <button
                onClick={handleStartGeneration}
                disabled={!sessionId}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:via-indigo-400 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Video className="w-4 h-4" />
                <span>Render Copyright-Safe Video</span>
              </button>
            </div>
          </div>
        )}

        {/* Rendering Progress View */}
        {generationStatus && generationStatus.stage !== 'complete' && (
          <GenerationProgress status={generationStatus} />
        )}

        {/* Completed Video Player View */}
        {generationStatus && generationStatus.stage === 'complete' && (
          <VideoPlayer
            sessionId={sessionId!}
            settings={settings}
            fileSize={generationStatus.fileSize}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>AI Music Video Creator • Copyright-Safe FFmpeg Video Engine</p>
      </footer>
    </div>
  );
}
