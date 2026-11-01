import React, { useState } from 'react';
import { GeneratedVideo } from '../types';
import { Video, Play, Pause, Download, Maximize2, Sparkles, RefreshCw } from 'lucide-react';

interface VideoViewerProps {
  video: GeneratedVideo;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({ video }) => {
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <div className="my-3 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl max-w-xl group">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-500/20 text-purple-400">
            <Video className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-200">{video.title || 'AI Animated Video'}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-800 font-mono">
            Motion AI
          </span>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative bg-slate-950 flex items-center justify-center overflow-hidden min-h-[220px]">
        <video
          src={video.videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-auto object-cover max-h-[480px]"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      {/* Caption */}
      <div className="p-3 bg-slate-900 text-xs text-slate-300 border-t border-slate-800">
        <p className="line-clamp-2 italic text-slate-400">"{video.prompt}"</p>
      </div>
    </div>
  );
};
