import React, { useState } from 'react';
import { GeneratedImage } from '../types';
import {
  Download,
  Sparkles,
  Maximize2,
  X,
  Copy,
  Check,
  Image as ImageIcon,
} from 'lucide-react';

interface ImageViewerProps {
  image: GeneratedImage;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ image }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(image.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = image.url;
    a.download = `aix-generated-image-${Date.now()}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="my-3 rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl max-w-xl group transition-all hover:border-indigo-500/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-indigo-500/20 text-indigo-400">
            <ImageIcon className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-200">AI Generated Image</span>
          {image.aspectRatio && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
              {image.aspectRatio}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyPrompt}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Copy Image Prompt"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Download Image"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Expand Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Image Render */}
      <div className="relative bg-slate-950 flex items-center justify-center overflow-hidden min-h-[220px]">
        <img
          src={image.url}
          alt={image.prompt}
          referrerPolicy="no-referrer"
          className="w-full h-auto object-cover max-h-[480px] group-hover:scale-[1.01] transition-transform duration-300 cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        />
      </div>

      {/* Prompt Caption Footer */}
      <div className="p-3 bg-slate-900 text-xs text-slate-300 border-t border-slate-800">
        <p className="line-clamp-2 italic text-slate-400">"{image.prompt}"</p>
      </div>

      {/* Fullscreen Zoom Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-800 shadow-xl"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-5xl max-h-[90vh] flex flex-col items-center gap-4">
            <img
              src={image.url}
              alt={image.prompt}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-slate-800"
            />
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-200 font-medium max-w-2xl px-4">{image.prompt}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <Download className="w-4 h-4" /> Download High-Res Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
