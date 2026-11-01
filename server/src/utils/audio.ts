/**
 * Utility for Speech Recognition (Voice Input) and Speech Synthesis / native TTS (Voice Output)
 */

// Check Web Speech API Support
export const isSpeechRecognitionSupported = (): boolean => {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
};

export const isSpeechSynthesisSupported = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

// Create Speech Recognition instance
export const createSpeechRecognizer = (
  onResult: (text: string, isFinal: boolean) => void,
  onError: (err: string) => void,
  onEnd: () => void
) => {
  if (!isSpeechRecognitionSupported()) {
    onError("Web Speech API is not supported in this browser.");
    return null;
  }

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      onResult(finalTranscript, true);
    } else if (interimTranscript) {
      onResult(interimTranscript, false);
    }
  };

  recognition.onerror = (event: any) => {
    onError(event.error || "Speech recognition error.");
  };

  recognition.onend = () => {
    onEnd();
  };

  return recognition;
};

// Speak text using native Web Speech API (server TTS is a v3 stub)
export const speakTextNative = (
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  rate = 1.0,
  pitch = 1.0
): Promise<void> => {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel(); // Stop current speech

    // Clean markdown tags out for TTS reading
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' [code block omitted] ')
      .replace(/\[C\]|\[~\]|\[\?\]/g, '')
      .replace(/[*_#`~]/g, '')
      .trim();

    if (!cleanText) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      onEnd?.();
      resolve();
    };

    utterance.onerror = () => {
      onEnd?.();
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
};

export const stopSpeech = () => {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
};

// PCM audio play utility for server TTS payloads
export const playPCMBase64Audio = async (base64Data: string, sampleRate = 24000): Promise<void> => {
  try {
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Convert Int16 PCM to Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass({ sampleRate });

    const buffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
    buffer.getChannelData(0).set(float32Array);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    return new Promise((resolve) => {
      source.onended = () => {
        audioCtx.close();
        resolve();
      };
      source.start(0);
    });
  } catch (err) {
    console.error("Failed to play PCM base64 audio:", err);
  }
};
