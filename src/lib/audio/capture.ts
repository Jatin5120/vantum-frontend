/**
 * Audio Capture Utilities
 * Handle microphone audio capture and streaming
 */

import { logger } from '../utils/logger';
import { AUDIO_CONSTANTS } from './constants';

/**
 * Audio capture configuration
 */
export interface AudioCaptureConfig {
  sampleRate?: number;      // Default: 16000
  channelCount?: number;    // Default: 1 (mono)
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

const DEFAULT_CONFIG: Required<AudioCaptureConfig> = {
  sampleRate: AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE,
  channelCount: AUDIO_CONSTANTS.CHANNEL_COUNT,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/**
 * Get user media stream with audio constraints
 */
export async function getAudioStream(
  config: AudioCaptureConfig = {}
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: {
      sampleRate: config.sampleRate ?? DEFAULT_CONFIG.sampleRate,
      channelCount: config.channelCount ?? DEFAULT_CONFIG.channelCount,
      echoCancellation: config.echoCancellation ?? DEFAULT_CONFIG.echoCancellation,
      noiseSuppression: config.noiseSuppression ?? DEFAULT_CONFIG.noiseSuppression,
      autoGainControl: config.autoGainControl ?? DEFAULT_CONFIG.autoGainControl,
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone permission denied');
      }
      if (error.name === 'NotFoundError') {
        throw new Error('No microphone found');
      }
    }
    throw error;
  }
}

/**
 * Convert MediaStream to PCM audio chunks using AudioContext
 */
export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private onChunk: ((chunk: Uint8Array) => void) | null = null;
  private isCapturing = false;
  private hasLoggedFirstChunk = false;
  private chunkCount = 0;
  private actualSampleRate = 0;

  /**
   * Start capturing audio from stream
   * @returns The actual sample rate achieved by the browser
   */
  async start(
    stream: MediaStream,
    onChunk: (chunk: Uint8Array) => void,
    sampleRate: number = AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE
  ): Promise<number> {
    if (this.isCapturing) {
      throw new Error('Audio capture already started');
    }

    this.stream = stream;
    this.onChunk = onChunk;
    this.isCapturing = true;

    try {
      // Create AudioContext with desired sample rate
      this.audioContext = new AudioContext({ sampleRate });

      // Verify actual sample rate achieved
      this.actualSampleRate = this.audioContext.sampleRate;
      if (this.actualSampleRate !== sampleRate) {
        logger.warn('AudioContext sample rate mismatch', {
          requested: sampleRate,
          actual: this.actualSampleRate,
          note: 'Browser may not support exact resampling to 16kHz',
        });
      }
      logger.info('AudioContext created', {
        sampleRate: this.actualSampleRate,
        state: this.audioContext.state,
      });

      // Create source from MediaStream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // Create ScriptProcessorNode for processing audio chunks
      // Buffer size: 4096 samples (about 256ms at 16kHz)
      const bufferSize = AUDIO_CONSTANTS.CAPTURE_BUFFER_SIZE;
      this.processorNode = this.audioContext.createScriptProcessor(
        bufferSize,
        AUDIO_CONSTANTS.CHANNEL_COUNT, // Input channels (mono)
        AUDIO_CONSTANTS.CHANNEL_COUNT  // Output channels (mono)
      );

      // Process audio chunks
      this.processorNode.onaudioprocess = (event) => {
        if (!this.isCapturing) {
          return;
        }

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); // Mono channel

        this.chunkCount++;

        // Log first chunk for diagnostics
        if (!this.hasLoggedFirstChunk) {
          const rms = Math.sqrt(inputData.reduce((sum, s) => sum + s * s, 0) / inputData.length);
          logger.info('First audio chunk captured', {
            sampleRate: this.audioContext?.sampleRate,
            bufferLength: inputData.length,
            rms: rms.toFixed(4),
            isSilent: rms < 0.01,
            note: rms < 0.01 ? 'AUDIO IS SILENT - Check microphone!' : 'Audio detected',
          });
          this.hasLoggedFirstChunk = true;
        }

        // Convert Float32Array to Int16 PCM (16-bit)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp to [-1, 1] and convert to 16-bit integer
          // Use symmetric normalization: multiply by 32768.0 for all values
          // This matches the playback normalization (divide by 32768.0)
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = Math.round(sample * 32768.0);
          // Clamp to Int16 range to prevent overflow
          pcmData[i] = Math.max(-32768, Math.min(32767, pcmData[i]));
        }

        // Convert to Uint8Array for MessagePack
        const uint8Array = new Uint8Array(pcmData.buffer);
        this.onChunk?.(uint8Array);
      };

      // Connect nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      logger.info('Audio capture started', { sampleRate });

      return this.actualSampleRate;
    } catch (error) {
      this.isCapturing = false;
      throw error;
    }
  }

  /**
   * Stop capturing audio
   */
  stop(): void {
    if (!this.isCapturing) {
      return;
    }

    this.isCapturing = false;

    // Disconnect nodes
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Close AudioContext
    if (this.audioContext) {
      this.audioContext.close().catch((error) => {
        logger.error('Error closing AudioContext', error);
      });
      this.audioContext = null;
    }

    this.onChunk = null;
    // Reset diagnostic flags
    this.hasLoggedFirstChunk = false;
    this.chunkCount = 0;
    logger.info('Audio capture stopped');
  }

  /**
   * Check if currently capturing
   */
  getIsCapturing(): boolean {
    return this.isCapturing;
  }
}

