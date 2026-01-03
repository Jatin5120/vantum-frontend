/**
 * useAudioCapture Hook
 * React hook for managing audio capture
 */

import { useState, useRef, useCallback } from 'react';
import { getAudioStream, AudioCapture, type AudioCaptureConfig } from '../lib/audio';

export function useAudioCapture(config: AudioCaptureConfig = {}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);

  const startCapture = useCallback(
    async (onChunk: (chunk: Uint8Array) => void): Promise<number> => {
      try {
        setError(null);

        // Get audio stream
        const stream = await getAudioStream(config);
        streamRef.current = stream;
        setHasPermission(true);

        // Create audio capture instance
        const capture = new AudioCapture();
        captureRef.current = capture;

        // Start capturing and get actual sample rate
        const actualSampleRate = await capture.start(stream, onChunk, config.sampleRate);
        setIsCapturing(true);

        return actualSampleRate;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start audio capture';
        setError(errorMessage);
        setHasPermission(false);
        setIsCapturing(false);
        throw err;
      }
    },
    [config]
  );

  const stopCapture = useCallback(() => {
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsCapturing(false);
  }, []);

  return {
    isCapturing,
    error,
    hasPermission,
    startCapture,
    stopCapture,
  };
}

