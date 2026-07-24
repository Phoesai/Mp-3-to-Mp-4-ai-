import React, { useState } from 'react';
import { Tag, Sparkles, Image, RefreshCw, Wand2, ArrowLeftRight, Check, Upload, Film, Wand, Eye, Sunset, Zap, Layers } from 'lucide-react';
import { AudioMetadata, VideoSettings, ArtStyle } from '../types';

interface MetadataEditorProps {
  metadata: AudioMetadata;
  sessionId: string;
  settings: VideoSettings;
  onSettingsChange: (newSettings: VideoSettings) => void;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({
  metadata,
  sessionId,
  settings,
  onSettingsChange,
}) => {
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [coverSuccessMsg, setCoverSuccessMsg] = useState<string | null>(null);

  const handleTextChange = (field: keyof VideoSettings, value: any) => {
    onSettingsChange({
      ...settings,
      [field]: value,
    });
  };

  const artStylePresets: { id: ArtStyle; name: string; icon: React.ReactNode; desc: string; emoji: string }[] = [
    { id: 'cinematic', name: 'Cinematic', icon: <Film className="w-4 h-4 text-amber-400" />, desc: 'Dramatic lighting, movie poster aesthetic', emoji: '🎬' },
    { id: 'fantasy', name: 'Fantasy', icon: <Wand className="w-4 h-4 text-purple-400" />, desc: 'Ethereal, glowing elements, magical forest', emoji: '✨' },
    { id: 'anime', name: 'Anime', icon: <Eye className="w-4 h-4 text-pink-400" />, desc: 'Vibrant, cel-shaded, dreamy skies', emoji: '🌸' },
    { id: 'relaxing', name: 'Relaxing', icon: <Sunset className="w-4 h-4 text-teal-400" />, desc: 'Pastel, calm ocean, soft lofi vibe', emoji: '🌅' },
    { id: 'cyberpunk', name: 'Cyberpunk', icon: <Zap className="w-4 h-4 text-cyan-400" />, desc: 'Neon magenta/blue, synthwave, rain', emoji: '🌆' },
    { id: 'minimal', name: 'Minimal', icon: <Layers className="w-4 h-4 text-slate-300" />, desc: 'Flat geometric, monochrome + accent', emoji: '🔳' },
  ];

  const handleCleanMetadata = () => {
    let cleanTitle = settings.title
      .replace(/\.(mp3|wav|m4a|flac)$/i, '')
      .replace(/\[.*?(official|audio|video|lyrics|hd|4k).*?\]/gi, '')
      .replace(/\(.*?(official|audio|video|lyrics|320kbps).*?\)/gi, '')
      .replace(/^\d+[-_.\s]*/, '')
      .trim();

    let cleanArtist = settings.artist.trim();

    onSettingsChange({
      ...settings,
      title: cleanTitle || 'Untitled Track',
      artist: cleanArtist || 'Unknown Artist',
    });
  };

  const handleSwapTitleArtist = () => {
    onSettingsChange({
      ...settings,
      title: settings.artist,
      artist: settings.title,
    });
  };

  const handleGenerateAiCover = async (overrideStyle?: ArtStyle) => {
    const activeArtStyle = overrideStyle || settings.artStyle || 'cinematic';
    setIsGeneratingCover(true);
    setCoverSuccessMsg(null);

    try {
      const response = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          title: settings.title,
          artist: settings.artist,
          genre: metadata.genre,
          artStyle: activeArtStyle,
          customPrompt: aiPrompt || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate cover art');
      }

      if (data.coverArtDataUrl) {
        onSettingsChange({
          ...settings,
          artStyle: activeArtStyle,
          coverArtDataUrl: data.coverArtDataUrl,
          useAiCover: true,
        });
        setCoverSuccessMsg(`AI Cover generated in ${activeArtStyle.toUpperCase()} style!`);
      }
    } catch (err: any) {
      alert(`AI Cover Generation Notice: ${err.message}`);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onSettingsChange({
            ...settings,
            coverArtDataUrl: event.target.result as string,
            useAiCover: false,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">2. Edit Track Metadata & Visual Identity</h2>
            <p className="text-xs text-slate-400">Configure copyright-safe branding and generate AI cover art</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCleanMetadata}
            title="Clean artifact text like [Official Audio]"
            className="flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Clean Text</span>
          </button>
          <button
            onClick={handleSwapTitleArtist}
            title="Swap Title & Artist"
            className="flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
            <span>Swap</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Song Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Song Title <span className="text-cyan-400">*</span>
          </label>
          <input
            type="text"
            value={settings.title}
            onChange={(e) => handleTextChange('title', e.target.value)}
            placeholder="e.g. Neon Nights"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Artist Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Artist Name <span className="text-cyan-400">*</span>
          </label>
          <input
            type="text"
            value={settings.artist}
            onChange={(e) => handleTextChange('artist', e.target.value)}
            placeholder="e.g. Cyberwave"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Channel Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Channel / Brand Name <span className="text-cyan-400">*</span>
          </label>
          <input
            type="text"
            value={settings.channelName}
            onChange={(e) => handleTextChange('channelName', e.target.value)}
            placeholder="e.g. MY MUSIC STUDIO"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Album Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Album Name
          </label>
          <input
            type="text"
            value={settings.album || ''}
            onChange={(e) => handleTextChange('album', e.target.value)}
            placeholder="e.g. Midnight Beats EP"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* AI Visual Style Selector */}
      <div className="pt-2 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-300">
            Select Visual Art Style (Gemini AI Cover)
          </label>
          <span className="text-[10px] text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800">
            ✓ 100% Royalty Free & CR Safe
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {artStylePresets.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => handleTextChange('artStyle', style.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.artStyle === style.id
                  ? 'border-purple-500 bg-purple-500/10 shadow-md shadow-purple-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{style.emoji}</span> {style.name}
                </span>
                {settings.artStyle === style.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">{style.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cover Art Preview & Generation Controls */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cover Art Preview */}
          <div className="flex flex-col items-center justify-center p-3 bg-slate-950 rounded-xl border border-slate-800">
            {settings.coverArtDataUrl ? (
              <img
                src={settings.coverArtDataUrl}
                alt="Cover Art"
                className="w-32 h-32 object-cover rounded-lg shadow-md mb-2 border border-slate-700"
              />
            ) : (
              <div className="w-32 h-32 rounded-lg bg-gradient-to-br from-cyan-900/40 via-purple-900/40 to-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-500 mb-2">
                <Image className="w-8 h-8 mb-1" />
                <span className="text-[10px]">Procedural Art</span>
              </div>
            )}
            <span className="text-[11px] text-slate-400 font-medium text-center">
              {settings.coverArtDataUrl ? `Active Cover (${settings.artStyle || 'cinematic'})` : 'Procedural Background'}
            </span>
          </div>

          {/* AI Prompt Generator Panel */}
          <div className="md:col-span-2 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Generate Cover Art ({settings.artStyle?.toUpperCase() || 'CINEMATIC'})
              </span>
              <label className="cursor-pointer text-[11px] text-cyan-400 hover:underline flex items-center gap-1">
                <Upload className="w-3 h-3" />
                Upload Custom File
                <input type="file" accept="image/*" onChange={handleCustomImageUpload} className="hidden" />
              </label>
            </div>

            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Optional prompt customization (e.g. glowing purple horizon, floating geometry)"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />

            <button
              onClick={() => handleGenerateAiCover()}
              disabled={isGeneratingCover}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-md"
            >
              {isGeneratingCover ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Engineering Prompt & Generating Image...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Artwork with Gemini Imagen</span>
                </>
              )}
            </button>

            {coverSuccessMsg && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> {coverSuccessMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
