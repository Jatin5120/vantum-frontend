/**
 * Audio Playback Utilities
 * Handle TTS audio playback from server
 */

import { logger } from '../utils/logger';
import { AUDIO_CONSTANTS } from './constants';

/**
 * Queued audio chunk
 */
interface QueuedChunk {
  audio: Uint8Array;
  utteranceId: string;
  sampleRate: number;
  timestamp: number; // For ordering
}

/**
 * Audio playback manager
 */
export class AudioPlayback {
  private audioContext: AudioContext | null = null;
  private audioQueue: QueuedChunk[] = [];
  private activeSources: AudioBufferSourceNode[] = [];
  private isPlaying = false;
  private currentUtteranceId: string | null = null;
  private sampleRate: number = AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE;
  private isProcessingQueue = false;

  /**
   * Initialize audio context
   * Handles browser autoplay policies and context lifecycle
   */
  private async initAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        ...AUDIO_CONSTANTS.AUDIO_CONTEXT_OPTIONS,
        sampleRate: this.sampleRate,
      });
    }

    // Resume if suspended (browser autoplay policy)
    // Some browsers suspend AudioContext until user interaction
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        logger.debug('AudioContext resumed from suspended state');
      } catch (error) {
        logger.error('Failed to resume AudioContext', error);
        throw new Error('Failed to resume audio context. User interaction may be required.');
      }
    }

    // Handle context state changes
    if (this.audioContext.state === 'closed') {
      // Context was closed, create a new one
      logger.warn('AudioContext was closed, creating new context');
      this.audioContext = new AudioContext({
        ...AUDIO_CONSTANTS.AUDIO_CONTEXT_OPTIONS,
        sampleRate: this.sampleRate,
      });
    }

    return this.audioContext;
  }

  /**
   * Play PCM audio chunk
   * Chunks are queued and played in order by utteranceId (UUIDv7 is time-ordered)
   */
  async playChunk(
    audioData: Uint8Array,
    sampleRate: number,
    utteranceId: string
  ): Promise<void> {
    // If this is a new utterance, stop current playback and clear queue
    if (this.currentUtteranceId !== utteranceId) {
      this.stop();
      this.currentUtteranceId = utteranceId;
      this.sampleRate = sampleRate;
    }

    // Add chunk to queue (sorted by utteranceId for ordering)
    const chunk: QueuedChunk = {
      audio: audioData,
      utteranceId,
      sampleRate,
      timestamp: Date.now(), // Fallback ordering if UUID comparison fails
    };

    this.audioQueue.push(chunk);
    
    // Sort queue by utteranceId (UUIDv7 is time-ordered, so string comparison works)
    this.audioQueue.sort((a, b) => {
      if (a.utteranceId < b.utteranceId) return -1;
      if (a.utteranceId > b.utteranceId) return 1;
      return a.timestamp - b.timestamp; // Fallback to timestamp
    });

    // Start processing queue if not already processing
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process audio queue
   * Plays chunks sequentially, waiting for each to finish before playing the next
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return; // Already processing
    }

    this.isProcessingQueue = true;

    while (this.audioQueue.length > 0 && this.currentUtteranceId !== null) {
      const chunk = this.audioQueue.shift();
      if (!chunk) {
        break;
      }

      // Skip chunks from different utterances
      if (chunk.utteranceId !== this.currentUtteranceId) {
        continue;
      }

      try {
        // Play chunk and wait for it to finish
        await this.playChunkImmediately(chunk.audio, chunk.sampleRate);
      } catch (error) {
        logger.error('Error playing audio chunk', error, { utteranceId: chunk.utteranceId });
        // Continue with next chunk
      }
    }

    this.isProcessingQueue = false;
    this.isPlaying = false;
  }

  /**
   * Play a single audio chunk immediately
   * Returns a promise that resolves when the chunk finishes playing
   */
  private async playChunkImmediately(
    audioData: Uint8Array,
    sampleRate: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.initAudioContext()
        .then((context) => {
          // Validate inputs
          if (!audioData || audioData.length === 0) {
            reject(new Error('Audio data is empty'));
            return;
          }

          // Validate sample rate
          if (!Number.isFinite(sampleRate) || sampleRate <= 0 || sampleRate > 192000) {
            logger.error('Invalid sample rate', undefined, { sampleRate, audioDataLength: audioData.length });
            reject(new Error(`Invalid sample rate: ${sampleRate}`));
            return;
          }

          // Int16 PCM requires even number of bytes (2 bytes per sample)
          let processedAudioData = audioData;
          if (audioData.length % 2 !== 0) {
            logger.warn('Audio data length is not even, truncating last byte', { audioDataLength: audioData.length });
            processedAudioData = audioData.slice(0, audioData.length - 1);
          }

          // Convert Uint8Array (Int16 PCM) to Float32Array
          // CRITICAL: Slice the buffer to ensure correct byte alignment and position
          // MessagePack returns a view into the larger message buffer, so we must
          // extract only the audio data portion starting at byteOffset
          const buffer = processedAudioData.buffer.slice(
            processedAudioData.byteOffset,
            processedAudioData.byteOffset + processedAudioData.byteLength
          );
          const int16Array = new Int16Array(buffer);
          const float32Array = new Float32Array(int16Array.length);

          for (let i = 0; i < int16Array.length; i++) {
            // Convert 16-bit integer to float [-1, 1]
            // Use symmetric normalization: divide by 32768.0 for all values
            const normalized = int16Array[i] / 32768.0;
            // Clamp to [-1, 1] to prevent any edge cases
            float32Array[i] = Math.max(-1.0, Math.min(1.0, normalized));
          }

          // Validate float32Array doesn't contain NaN or Infinity
          for (let i = 0; i < float32Array.length; i++) {
            if (!Number.isFinite(float32Array[i])) {
              logger.error('Non-finite value detected in audio data', undefined, {
                index: i,
                value: float32Array[i],
                int16Value: int16Array[i],
              });
              reject(new Error(`Non-finite audio value at index ${i}: ${float32Array[i]}`));
              return;
            }
          }

          // Validate buffer length
          if (float32Array.length === 0) {
            reject(new Error('Audio buffer is empty after conversion'));
            return;
          }

          // Create AudioBuffer
          const audioBuffer = context.createBuffer(
            1, // Mono
            float32Array.length,
            sampleRate
          );

          // Copy data to buffer
          audioBuffer.copyToChannel(float32Array, 0);

          // Create source and play
          const source = context.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(context.destination);
          
          // Track active source
          this.activeSources.push(source);
          this.isPlaying = true;

          // Clean up when finished
          source.onended = () => {
            // Remove from active sources
            const index = this.activeSources.indexOf(source);
            if (index > -1) {
              this.activeSources.splice(index, 1);
            }

            // Resolve promise to continue queue processing
            resolve();
          };

          try {
            source.start(0);
          } catch (error) {
            // Remove from active sources
            const index = this.activeSources.indexOf(source);
            if (index > -1) {
              this.activeSources.splice(index, 1);
            }
            reject(error);
          }
        })
        .catch(reject);
    });
  }

  /**
   * Stop current playback
   */
  stop(): void {
    // Stop all active sources
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (error) {
        // Source might already be stopped or not started
        // This is expected and safe to ignore
        logger.debug('Error stopping audio source (expected)', { error: error instanceof Error ? error.message : String(error) });
      }
    });
    this.activeSources = [];

    // Clear queue
    this.audioQueue = [];
    
    // Reset state
    this.isPlaying = false;
    this.currentUtteranceId = null;
    this.isProcessingQueue = false;
  }

  /**
   * Cleanup and close audio context
   * Should be called when AudioPlayback is no longer needed
   */
  async destroy(): Promise<void> {
    this.stop();

    if (this.audioContext) {
      try {
        // Close the audio context to free resources
        await this.audioContext.close();
        logger.debug('AudioContext closed');
      } catch (error) {
        logger.error('Error closing AudioContext', error);
      }
      this.audioContext = null;
    }
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current utterance ID
   */
  getCurrentUtteranceId(): string | null {
    return this.currentUtteranceId;
  }
}

