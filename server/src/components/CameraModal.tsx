import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, Flashlight, AlertCircle, Sparkles } from 'lucide-react';
import { Attachment } from '../types';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (attachment: Attachment, initialPromptText?: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>(
    'Describe and analyze what is visible in this captured photo in technical detail.'
  );

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async (mode: 'user' | 'environment') => {
    setErrorMessage(null);
    stopCamera();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setErrorMessage(
        'Unable to access camera device. Please verify camera permissions in your browser settings.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedDataUrl(dataUrl);
    }
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
  };

  const handleConfirmAttach = () => {
    if (!capturedDataUrl) return;

    const attachment: Attachment = {
      id: `cam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `camera_capture_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.jpg`,
      mimeType: 'image/jpeg',
      data: capturedDataUrl,
      size: Math.round(capturedDataUrl.length * 0.75),
    };

    onCapture(attachment, customPrompt);
    onClose();
    setCapturedDataUrl(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center shadow-md">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">
                Live Device Vision Capture
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                CAMERA OPTICS // REAL-TIME MULTIMODAL RESEARCH
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder or Snapshot Preview */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          {capturedDataUrl ? (
            <img
              src={capturedDataUrl}
              alt="Camera Capture Preview"
              className="w-full h-full object-contain max-h-[480px]"
            />
          ) : errorMessage ? (
            <div className="p-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
                {errorMessage}
              </p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl border border-zinc-700 text-xs font-mono"
              >
                Retry Camera Initialization
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover max-h-[480px]"
            />
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Floating Controls Overlay over live video */}
          {!capturedDataUrl && !errorMessage && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={handleFlipCamera}
                className="p-2 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-xl border border-zinc-700/80 backdrop-blur-md transition-all shadow-lg active:scale-95"
                title="Switch Front/Back Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-950 space-y-4">
          {capturedDataUrl ? (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                  PROMPT FOR CAPTURED IMAGE //
                </label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ask AIX Alpha what to do with this photo..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={handleRetake}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors"
                >
                  Retake Photo
                </button>

                <button
                  onClick={handleConfirmAttach}
                  className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Attach & Analyze Photo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-1">
              <button
                onClick={handleTakeSnapshot}
                disabled={!!errorMessage}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-30 border-4 border-zinc-800"
                title="Take Snapshot"
              >
                <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center">
                  <Camera className="w-5 h-5 text-black" />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
