/**
 * MessagePack Utilities
 * Serialization and deserialization for WebSocket communication
 */

import { pack, unpack } from 'msgpackr';
import { v7 as uuidv7 } from 'uuid';
import {
  VOICECHAT_EVENTS,
  type EventMessage,
  type AudioStartPayload,
  type AudioChunkPayload,
  type UnpackedMessage,
} from '@Jatin5120/vantum-shared';

/**
 * Generate a UUID v7 (time-ordered, sortable)
 */
export function generateEventId(): string {
  return uuidv7();
}

/**
 * Pack an event message to MessagePack binary
 */
export function packEvent<T>(event: EventMessage<T>): Uint8Array {
  return pack(event);
}

/**
 * Unpack MessagePack binary to event message
 */
export function unpackEvent(data: ArrayBuffer | Uint8Array): UnpackedMessage {
  const uint8Array = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return unpack(uint8Array) as UnpackedMessage;
}

/**
 * Result of packing an event (includes eventId for tracking)
 */
export interface PackedEvent {
  data: Uint8Array;
  eventId: string;
}

/**
 * Pack audio.start event
 * @param payload - Audio start payload
 * @param sessionId - Session ID (required, received from connection.ack)
 * @returns Packed event with data and eventId
 */
export function packAudioStart(
  payload: AudioStartPayload,
  sessionId: string
): PackedEvent {
  const eventId = generateEventId();
  const data = packEvent({
    eventType: VOICECHAT_EVENTS.AUDIO_START,
    eventId,
    sessionId,
    payload,
  });
  return { data, eventId };
}

/**
 * Pack audio.chunk event
 * @param payload - Audio chunk payload
 * @param sessionId - Session ID (required, received from connection.ack)
 * @returns Packed event with data and eventId
 */
export function packAudioChunk(
  payload: AudioChunkPayload,
  sessionId: string
): PackedEvent {
  const eventId = generateEventId();
  const data = packEvent({
    eventType: VOICECHAT_EVENTS.AUDIO_CHUNK,
    eventId,
    sessionId,
    payload,
  });
  return { data, eventId };
}

/**
 * Pack audio.end event
 * @param sessionId - Session ID (required, received from connection.ack)
 * @returns Packed event with data and eventId
 */
export function packAudioEnd(sessionId: string): PackedEvent {
  const eventId = generateEventId();
  const data = packEvent({
    eventType: VOICECHAT_EVENTS.AUDIO_END,
    eventId,
    sessionId,
    payload: {},
  });
  return { data, eventId };
}

