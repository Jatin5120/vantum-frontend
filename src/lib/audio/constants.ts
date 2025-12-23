/**
 * Audio Constants
 * Centralized audio-related constants
 */

export const AUDIO_CONSTANTS = {
  // Default sample rate (16kHz for voice)
  DEFAULT_SAMPLE_RATE: 16000,

  // Audio format
  CHANNEL_COUNT: 1, // Mono
  BIT_DEPTH: 16, // 16-bit PCM

  // Buffer sizes
  CAPTURE_BUFFER_SIZE: 4096, // Samples (~256ms at 16kHz)

  // Audio context settings
  AUDIO_CONTEXT_OPTIONS: {
    sampleRate: 16000,
  } as AudioContextOptions,

  // Default language
  DEFAULT_LANGUAGE: 'en-US',
} as const;

