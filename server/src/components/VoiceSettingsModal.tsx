import React, { useState, useEffect } from 'react';
import { X, Volume2, Mic, Settings2, Check } from 'lucide-react';
import { VoiceSettings } from '../types';
import { speakTextNative, stopSpeech } from '../utils/audio';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onSave: (settings: VoiceSettings) => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = useState<VoiceSettings>(settings);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleTestVoice = async () => {
    setIsPlayingTest(true);
    await speakTextNative(
      "AIX Alpha voice audio engine connected. Ready for seamless hands-free productivity on the go.",
      undefined,
      () => setIsPlayingTest(false),
      localSettings.speechRate,
      localSettings.speechPitch
    );
  };

  const handleSave = () => {
    stopSpeech();
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-black border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-mono">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-900 text-white border border-zinc-700">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Voice Synthesis Engine</h3>
              <p className="text-[11px] text-zinc-500">Configure real-time neural audio playback</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 bg-black">
          {/* Auto Read Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div>
              <p className="text-xs font-bold text-white uppercase">Auto-Read Responses</p>
              <p className="text-[11px] text-zinc-500">Automatically synthesize speech upon completion</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoReadResponses}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoReadResponses: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white peer-checked:after:bg-black"></div>
            </label>
          </div>

          {/* Voice Character */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Neural Voice Model
            </label>
            <select
              value={localSettings.preferredVoice}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, preferredVoice: e.target.value })
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors font-mono"
            >
              <option value="Kore">Kore (Balanced & Warm)</option>
              <option value="Zephyr">Zephyr (Light & Clear)</option>
              <option value="Puck">Puck (Energetic & Direct)</option>
              <option value="Fenrir">Fenrir (Deep & Resonant)</option>
              <option value="Charon">Charon (Calm & Academic)</option>
            </select>
          </div>

          {/* Speech Rate */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Synthesis Speed ({localSettings.speechRate}x)
              </label>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={localSettings.speechRate}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, speechRate: parseFloat(e.target.value) })
              }
              className="w-full accent-white bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Test Button */}
          <button
            onClick={handleTestVoice}
            disabled={isPlayingTest}
            className="w-full py-2.5 px-4 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-white text-xs font-mono font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Volume2 className={`w-4 h-4 ${isPlayingTest ? 'animate-bounce text-white' : 'text-zinc-400'}`} />
            {isPlayingTest ? 'SYNTHESIZING AUDIO...' : 'SAMPLE NEURAL AUDIO'}
          </button>
        </div>

        <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-3 font-mono">
          <button
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" /> APPLY CONFIG
          </button>
        </div>
      </div>
    </div>
  );
};
