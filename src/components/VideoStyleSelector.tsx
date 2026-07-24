import React from 'react';
import { Sliders, Monitor, Smartphone, Square, Activity, Sparkles, Play, ShieldAlert, Palette, Clock } from 'lucide-react';
import { VideoSettings, VideoStyle, AspectRatio } from '../types';

interface VideoStyleSelectorProps {
  settings: VideoSettings;
  onSettingsChange: (newSettings: VideoSettings) => void;
}

export const VideoStyleSelector: React.FC<VideoStyleSelectorProps> = ({
  settings,
  onSettingsChange,
}) => {
  const updateField = (field: keyof VideoSettings, value: any) => {
    onSettingsChange({
      ...settings,
      [field]: value,
    });
  };

  const styleOptions: { id: VideoStyle; name: string; desc: string; icon: React.ReactNode; tag: string }[] = [
    {
      id: 'visualizer',
      name: 'Audio Visualizer Waves',
      desc: 'Dynamic audio reactive waves overlaid on gradient backdrop with song text',
      icon: <Activity className="w-5 h-5 text-cyan-400" />,
      tag: 'Preferred CR-Safe',
    },
    {
      id: 'kenburns',
      name: 'Ken Burns Cover Art',
      desc: 'Cinematic zoom and pan movement on cover artwork with overlay text',
      icon: <Sparkles className="w-5 h-5 text-purple-400" />,
      tag: 'Motion Art',
    },
    {
      id: 'minimal_spectrum',
      name: 'Spectrum Frequency Bars',
      desc: 'Sleek equalizer spectrum bars with crisp typography watermark',
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      tag: 'Audio Spectrum',
    },
    {
      id: 'gradient_loop',
      name: 'Loop Gradient Backdrop',
      desc: 'Clean color shifting background with channel branding overlay',
      icon: <Palette className="w-5 h-5 text-amber-400" />,
      tag: 'Minimal',
    },
  ];

  const aspectRatios: { id: AspectRatio; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: '16:9', label: '16:9 Landscape', desc: 'YouTube / TV (1920x1080)', icon: <Monitor className="w-4 h-4" /> },
    { id: '9:16', label: '9:16 Portrait', desc: 'Shorts / TikTok (1080x1920)', icon: <Smartphone className="w-4 h-4" /> },
    { id: '1:1', label: '1:1 Square', desc: 'Instagram / Feed (1080x1080)', icon: <Square className="w-4 h-4" /> },
  ];

  const colorPresets = [
    { name: 'Cyan Neon', hex: '#00f2fe' },
    { name: 'Electric Pink', hex: '#ff007f' },
    { name: 'Golden Glow', hex: '#ffb700' },
    { name: 'Matrix Green', hex: '#00ff66' },
    { name: 'Violet Purple', hex: '#a855f7' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center space-x-2 pb-4 border-b border-slate-800">
        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">3. Video Style & Render Settings</h2>
          <p className="text-xs text-slate-400">Choose motion layout, aspect ratio, and branding options</p>
        </div>
      </div>

      {/* Style Grid */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-300">
          Video Visual Style
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {styleOptions.map((opt) => (
            <div
              key={opt.id}
              onClick={() => updateField('style', opt.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                settings.style === opt.id
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/5'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-slate-900">{opt.icon}</div>
                  <span className="text-sm font-semibold text-white">{opt.name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                  {opt.tag}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-300">
          Aspect Ratio / Destination Platform
        </label>
        <div className="grid grid-cols-3 gap-3">
          {aspectRatios.map((ar) => (
            <button
              key={ar.id}
              type="button"
              onClick={() => updateField('aspectRatio', ar.id)}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                settings.aspectRatio === ar.id
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="mb-1">{ar.icon}</div>
              <span className="text-xs font-semibold text-white">{ar.label}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">{ar.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5-Second Intro Slate Option */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-3">
        <input
          type="checkbox"
          id="addIntro"
          checked={settings.addIntro}
          onChange={(e) => updateField('addIntro', e.target.checked)}
          className="mt-1 w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-cyan-500 focus:ring-offset-slate-900"
        />
        <div className="flex-1">
          <label htmlFor="addIntro" className="text-xs font-semibold text-white cursor-pointer flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Add 5-Second Intro Slate (Recommended for CR Safety)
          </label>
          <p className="text-[11px] text-slate-400 mt-1">
            Inserts a 5-second branded opening showing Channel Name & visualizer bar before main song cover appears.
          </p>

          {settings.addIntro && (
            <div className="mt-3">
              <input
                type="text"
                value={settings.introTitle || ''}
                onChange={(e) => updateField('introTitle', e.target.value)}
                placeholder="Intro Header Text (e.g., OFFICIAL RELEASE)"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Color Customization */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-300">
          Visualizer Glow Color
        </label>
        <div className="flex items-center space-x-3">
          {colorPresets.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => updateField('visualizerColor', preset.hex)}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                settings.visualizerColor === preset.hex ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: preset.hex }}
              title={preset.name}
            />
          ))}
          <input
            type="color"
            value={settings.visualizerColor}
            onChange={(e) => updateField('visualizerColor', e.target.value)}
            className="w-8 h-8 rounded-lg bg-transparent border border-slate-700 cursor-pointer"
            title="Custom Color Picker"
          />
        </div>
      </div>
    </div>
  );
};
