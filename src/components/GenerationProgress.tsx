import React, { useState } from 'react';
import { Loader2, Terminal, CheckCircle2, AlertCircle, Film, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { GenerationStatus } from '../types';

interface GenerationProgressProps {
  status: GenerationStatus;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({ status }) => {
  const [showLogs, setShowLogs] = useState(false);

  const stages = [
    { id: 'analyzing', name: '1. Audio Analysis' },
    { id: 'preparing_visuals', name: '2. Artwork Setup' },
    { id: 'rendering_intro', name: '3. Intro Slate' },
    { id: 'encoding_main', name: '4. FFmpeg Encoding' },
    { id: 'complete', name: '5. Ready' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          {status.stage === 'complete' ? (
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : status.stage === 'error' ? (
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-white">Rendering Music Video...</h2>
            <p className="text-xs text-slate-400">{status.message}</p>
          </div>
        </div>

        <span className="text-lg font-bold font-mono text-cyan-400">
          {status.progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800">
        <div
          className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(5, status.progress)}%` }}
        />
      </div>

      {/* Stage Stepper */}
      <div className="grid grid-cols-5 gap-1 pt-1">
        {stages.map((stg) => {
          const isCurrent = status.stage === stg.id;
          const isPast = status.progress >= 100 || (stg.id === 'analyzing' && status.progress > 10) || (stg.id === 'preparing_visuals' && status.progress > 25) || (stg.id === 'rendering_intro' && status.progress > 40) || (stg.id === 'encoding_main' && status.progress > 90);

          return (
            <div
              key={stg.id}
              className={`p-2 rounded-lg border text-center transition-all ${
                isCurrent
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 font-semibold'
                  : isPast
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  : 'border-slate-800/80 bg-slate-950/40 text-slate-500'
              }`}
            >
              <p className="text-[10px] truncate">{stg.name}</p>
            </div>
          );
        })}
      </div>

      {/* Expandable FFmpeg Logs */}
      <div className="pt-2">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white py-1"
        >
          <span className="flex items-center gap-1.5 font-mono">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            Live FFmpeg Console Logs ({status.logs.length})
          </span>
          {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showLogs && (
          <div className="mt-2 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
            {status.logs.map((log, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <span className="text-slate-600 shrink-0">[{idx + 1}]</span>
                <span className="break-all">{log}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
