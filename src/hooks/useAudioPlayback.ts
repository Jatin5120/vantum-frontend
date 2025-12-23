/**
 * useAudioPlayback Hook
 * React hook for managing audio playback
 */

import { useRef, useCallback, useEffect } from 'react';
import { AudioPlayback } from '../lib/audio';

export function useAudioPlayback() {
  const playbackRef = useRef<AudioPlayback | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackRef.current) {
        playbackRef.current.destroy().catch((error) => {
          console.error('Error destroying AudioPlayback:', error);
        });
        playbackRef.current = null;
      }
    };
  }, []);

  const playChunk = useCallback(
    async (audioData: Uint8Array, sampleRate: number, utteranceId: string) => {
      if (!playbackRef.current) {
        playbackRef.current = new AudioPlayback();
      }

      await playbackRef.current.playChunk(audioData, sampleRate, utteranceId);
    },
    []
  );

  const stop = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.stop();
    }
  }, []);

  const getIsPlaying = useCallback((): boolean => {
    return playbackRef.current?.getIsPlaying() ?? false;
  }, []);

  return {
    playChunk,
    stop,
    getIsPlaying,
  };
}

