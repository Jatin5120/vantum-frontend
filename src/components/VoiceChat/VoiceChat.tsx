/**
 * VoiceChat Component
 * Main voice chat interface
 */

import { useState, useCallback, useMemo } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useAudioCapture } from "../../hooks/useAudioCapture";
import { useAudioPlayback } from "../../hooks/useAudioPlayback";
import { ConnectionStatus } from "./ConnectionStatus";
import { logger } from "../../lib/utils/logger";
import { AUDIO_CONSTANTS } from "../../lib/audio/constants";
import {
  packAudioStart,
  packAudioChunk,
  packAudioEnd,
  type ResponseChunkPayload,
  type ResponseStartPayload,
  type ResponseCompletePayload,
  type ResponseInterruptPayload,
  type ResponseStopPayload,
  VOICECHAT_EVENTS,
  type SocketEventHandler,
  eventBus,
} from "../../lib/websocket";

export function VoiceChat() {
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Audio playback hook
  const { playChunk, stop: stopPlayback } = useAudioPlayback();

  // Create event handlers
  const handlers = useMemo(() => {
    const handlerMap = new Map<string, SocketEventHandler>();

    // Connection ACK handler (internal, handled by manager but we register to avoid warnings)
    handlerMap.set(VOICECHAT_EVENTS.CONNECTION_ACK, {
      handle: async () => {
        // Connection ACK is handled internally by SocketManager
        // This handler just prevents "Unhandled event type" warnings
      },
    });

    // Response Start handler
    handlerMap.set(VOICECHAT_EVENTS.RESPONSE_START, {
      handle: async (data, _eventType, manager, unpackedMessage) => {
        const message =
          unpackedMessage ||
          manager.decodeMessagePack<{
            payload: ResponseStartPayload;
          }>(data);
        const payload = message.payload as ResponseStartPayload;
        logger.info("Response started", {
          utteranceId: payload.utteranceId,
          timestamp: payload.timestamp,
        });
        stopPlayback();
        // Publish to event bus
        eventBus.emit("responseStart", {
          utteranceId: payload.utteranceId,
          timestamp: payload.timestamp,
        });
      },
    });

    // Response Chunk handler
    handlerMap.set(VOICECHAT_EVENTS.RESPONSE_CHUNK, {
      handle: async (data, _eventType, manager, unpackedMessage) => {
        const message =
          unpackedMessage ||
          manager.decodeMessagePack<{
            payload: ResponseChunkPayload;
          }>(data);
        const payload = message.payload as ResponseChunkPayload;

        // Validate and sanitize sampleRate
        let sampleRate = payload.sampleRate;
        if (
          !Number.isFinite(sampleRate) ||
          sampleRate <= 0 ||
          sampleRate > 192000
        ) {
          logger.warn("Invalid sampleRate in response chunk, using default", {
            receivedSampleRate: payload.sampleRate,
            defaultSampleRate: AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE,
            utteranceId: payload.utteranceId,
          });
          sampleRate = AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE;
        }

        // Validate audio data
        if (!payload.audio || payload.audio.length === 0) {
          logger.error("Empty audio data in response chunk", {
            utteranceId: payload.utteranceId,
          });
          return;
        }

        // Ensure audio data is Uint8Array (MessagePack should return this, but validate)
        // CRITICAL: Always create a copy to avoid issues with MessagePack buffer views
        let audioData: Uint8Array;
        const rawAudio = payload.audio as unknown;
        if (rawAudio instanceof Uint8Array) {
          // Create a copy to ensure we have independent data (MessagePack may return a view)
          audioData = new Uint8Array(rawAudio);
        } else if (rawAudio instanceof ArrayBuffer) {
          audioData = new Uint8Array(rawAudio);
        } else if (ArrayBuffer.isView(rawAudio)) {
          const view = rawAudio as ArrayBufferView;
          // Create a copy from the view
          audioData = new Uint8Array(
            view.buffer.slice(
              view.byteOffset,
              view.byteOffset + view.byteLength
            )
          );
        } else {
          logger.error("Invalid audio data type in response chunk", {
            utteranceId: payload.utteranceId,
            audioType: typeof rawAudio,
            audioConstructor: (rawAudio as { constructor?: { name?: string } })
              ?.constructor?.name,
          });
          return;
        }

        logger.info("Response chunk received", {
          utteranceId: payload.utteranceId,
          audioLength: audioData.length,
          sampleRate: sampleRate,
        });

        playChunk(audioData, sampleRate, payload.utteranceId).catch((err) => {
          logger.error("Error playing audio chunk", err, {
            utteranceId: payload.utteranceId,
            sampleRate: sampleRate,
            audioLength: audioData.length,
          });
          setError("Failed to play audio");
        });
        // Publish to event bus
        eventBus.emit("responseChunk", {
          audio: audioData,
          utteranceId: payload.utteranceId,
          sampleRate: sampleRate,
        });
      },
    });

    // Response Complete handler
    handlerMap.set(VOICECHAT_EVENTS.RESPONSE_COMPLETE, {
      handle: async (data, _eventType, manager, unpackedMessage) => {
        const message =
          unpackedMessage ||
          manager.decodeMessagePack<{
            payload: ResponseCompletePayload;
          }>(data);
        const payload = message.payload as ResponseCompletePayload;
        logger.info("Response complete", { utteranceId: payload.utteranceId });
        // Publish to event bus
        eventBus.emit("responseComplete", {
          utteranceId: payload.utteranceId,
        });
      },
    });

    // Response Interrupt handler
    handlerMap.set(VOICECHAT_EVENTS.RESPONSE_INTERRUPT, {
      handle: async (data, _eventType, manager, unpackedMessage) => {
        const message =
          unpackedMessage ||
          manager.decodeMessagePack<{
            payload: ResponseInterruptPayload;
          }>(data);
        const payload = message.payload as ResponseInterruptPayload;
        logger.info("Response interrupted", {
          utteranceId: payload.utteranceId,
          timestamp: payload.timestamp,
        });
        stopPlayback(); // Stop current audio playback
        // Publish to event bus
        eventBus.emit("responseInterrupt", {
          utteranceId: payload.utteranceId,
          timestamp: payload.timestamp,
        });
      },
    });

    // Response Stop handler
    handlerMap.set(VOICECHAT_EVENTS.RESPONSE_STOP, {
      handle: async (data, _eventType, manager, unpackedMessage) => {
        const message =
          unpackedMessage ||
          manager.decodeMessagePack<{
            payload: ResponseStopPayload;
          }>(data);
        const payload = message.payload as ResponseStopPayload;
        logger.info("Response stopped", {
          utteranceId: payload.utteranceId,
          timestamp: payload.timestamp,
        });
        stopPlayback(); // Stop current audio playback
        // Publish to event bus
        eventBus.emit("responseStop", {
          utteranceId: payload.utteranceId,
          timestamp: payload.timestamp,
        });
      },
    });

    // Error handler (for error events ending with .error)
    handlerMap.set("error", {
      handle: async (data, _eventType, manager, unpackedMessage) => {
        const message =
          unpackedMessage ||
          manager.decodeMessagePack<{
            payload: { message: string };
            requestType?: string;
          }>(data);
        const payload = message.payload as { message?: string } | undefined;
        const errorMessage = payload?.message || "Unknown error";
        const code =
          (message as { requestType?: string }).requestType || "ERROR";
        logger.error("WebSocket error", undefined, {
          code,
          message: errorMessage,
        });
        setError(`${code}: ${errorMessage}`);
        // Publish to event bus (timestamp will be added by event bus)
        eventBus.emit("error", {
          message: errorMessage,
          code,
          timestamp: 0, // Will be set by event handler
        });
      },
    });

    return handlerMap;
  }, [playChunk, stopPlayback]);

  // WebSocket hook with handler registry
  const {
    connectionState,
    sessionId,
    connect,
    disconnect,
    sendMessagePack,
    sendMessagePackWithAck,
    isConnected,
  } = useWebSocket({
    handlers,
  });

  // Audio capture hook
  const { isCapturing, hasPermission, startCapture, stopCapture } =
    useAudioCapture({ sampleRate: AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE });

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    if (isCapturing) {
      stopCapture();
      setIsRecording(false);

      // Send audio.end event with ACK tracking (sessionId is required per protocol)
      if (isConnected() && sessionId) {
        const { eventId } = packAudioEnd(sessionId);
        try {
          const ack = await sendMessagePackWithAck(
            {
              eventType: VOICECHAT_EVENTS.AUDIO_END,
              eventId,
              sessionId,
              payload: {},
            },
            10000 // 10 second timeout
          );
          logger.info("Audio end ACK received", { eventId: ack.eventId });
        } catch (err) {
          logger.error("Error sending audio.end or receiving ACK", err, {
            sessionId,
          });
          setError("Failed to send audio.end or receive acknowledgment");
        }
      }
    }
  }, [
    isCapturing,
    stopCapture,
    isConnected,
    sendMessagePackWithAck,
    sessionId,
  ]);

  // Handle connect/disconnect
  const handleConnect = useCallback(() => {
    setError(null);
    connect();
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    }
    disconnect();
  }, [disconnect, isRecording, handleStopRecording]);

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    if (!isConnected()) {
      setError("Not connected to server");
      return;
    }

    if (!sessionId) {
      setError(
        "Session ID not available. Please wait for connection acknowledgment."
      );
      return;
    }

    try {
      setError(null);

      // Start audio capture first to get actual sample rate
      const actualSampleRate = await startCapture(async (chunk) => {
        if (isConnected() && sessionId) {
          const { eventId } = packAudioChunk(
            {
              audio: chunk,
              isMuted: false,
            },
            sessionId
          );
          try {
            await sendMessagePack({
              eventType: VOICECHAT_EVENTS.AUDIO_CHUNK,
              eventId,
              sessionId,
              payload: {
                audio: chunk,
                isMuted: false,
              },
            });
          } catch (err) {
            logger.error("Error sending audio chunk", err, { sessionId });
          }
        }
      });

      logger.info("Audio capture started with actual sample rate", {
        actualSampleRate,
        requestedSampleRate: AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE,
      });

      // Send audio.start event with actual sample rate and ACK tracking
      const { eventId } = packAudioStart(
        {
          samplingRate: actualSampleRate,
          language: AUDIO_CONSTANTS.DEFAULT_LANGUAGE,
        },
        sessionId
      );
      try {
        const ack = await sendMessagePackWithAck(
          {
            eventType: VOICECHAT_EVENTS.AUDIO_START,
            eventId,
            sessionId,
            payload: {
              samplingRate: actualSampleRate,
              language: AUDIO_CONSTANTS.DEFAULT_LANGUAGE,
            },
          },
          10000 // 10 second timeout
        );
        logger.info("Audio start ACK received", { eventId: ack.eventId });
      } catch (err) {
        logger.error("Failed to receive ACK for audio.start", err, {
          sessionId,
        });
        // Stop capture if ACK fails
        stopCapture();
        setError("Failed to receive acknowledgment from server");
        return;
      }

      setIsRecording(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start recording";
      setError(errorMessage);
      logger.error("Error starting recording", err, { sessionId });
    }
  }, [
    isConnected,
    sendMessagePack,
    sendMessagePackWithAck,
    startCapture,
    sessionId,
  ]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white text-center">
          Vantum Voice Chat
        </h1>

        {/* Connection Status */}
        <div className="mb-6">
          <ConnectionStatus
            state={connectionState}
            error={error || undefined}
          />
        </div>

        {/* Session Info */}
        {sessionId && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Session: {sessionId}
          </div>
        )}

        {/* Permission Status */}
        {hasPermission === false && (
          <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded text-yellow-800 dark:text-yellow-200">
            Microphone permission denied. Please allow microphone access.
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 rounded text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Connection Controls */}
          <div className="flex gap-4">
            {connectionState === "disconnected" ||
            connectionState === "error" ? (
              <button
                onClick={handleConnect}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Connect
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Recording Controls */}
          {connectionState === "connected" && (
            <div className="flex gap-4">
              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  disabled={
                    (!hasPermission && hasPermission !== null) || !sessionId
                  }
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  title={
                    !sessionId
                      ? "Waiting for connection acknowledgment..."
                      : undefined
                  }
                >
                  {!sessionId ? "Waiting for Session..." : "Start Recording"}
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Stop Recording
                </button>
              )}
            </div>
          )}

          {/* Status Info */}
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <div>Connection: {connectionState}</div>
            {isRecording && <div>Recording...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
