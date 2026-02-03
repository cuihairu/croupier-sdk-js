// Croupier TypeScript SDK - Protocol Layer
// Copyright (c) 2025 cuihairu
// Licensed under Apache License 2.0

/**
 * Message type constants (24 bits)
 */
export enum MessageType {
  // ControlService (0x01xx)
  REGISTER_REQUEST = 0x010101,
  REGISTER_RESPONSE = 0x010102,
  HEARTBEAT_REQUEST = 0x010103,
  HEARTBEAT_RESPONSE = 0x010104,

  // ClientService (0x02xx)
  REGISTER_CLIENT_REQUEST = 0x020101,
  REGISTER_CLIENT_RESPONSE = 0x020102,
  CLIENT_HEARTBEAT_REQUEST = 0x020103,
  CLIENT_HEARTBEAT_RESPONSE = 0x020104,

  // InvokerService (0x03xx)
  INVOKE_REQUEST = 0x030101,
  INVOKE_RESPONSE = 0x030102,
  START_JOB_REQUEST = 0x030103,
  START_JOB_RESPONSE = 0x030104,
  CANCEL_JOB_REQUEST = 0x030107,
  CANCEL_JOB_RESPONSE = 0x030108,

  // LocalControlService (0x05xx)
  REGISTER_LOCAL_REQUEST = 0x050101,
  REGISTER_LOCAL_RESPONSE = 0x050102,
  HEARTBEAT_LOCAL_REQUEST = 0x050103,
  HEARTBEAT_LOCAL_RESPONSE = 0x050104,
}

/**
 * Protocol constants
 */
export const VERSION_1 = 0x01;
export const HEADER_SIZE = 8; // Version(1) + MsgID(3) + RequestID(4)

/**
 * Message type name mapping
 */
const MESSAGE_TYPE_NAMES: Record<number, string> = {
  [MessageType.REGISTER_REQUEST]: 'RegisterRequest',
  [MessageType.REGISTER_RESPONSE]: 'RegisterResponse',
  [MessageType.HEARTBEAT_REQUEST]: 'HeartbeatRequest',
  [MessageType.HEARTBEAT_RESPONSE]: 'HeartbeatResponse',

  [MessageType.REGISTER_CLIENT_REQUEST]: 'RegisterClientRequest',
  [MessageType.REGISTER_CLIENT_RESPONSE]: 'RegisterClientResponse',
  [MessageType.CLIENT_HEARTBEAT_REQUEST]: 'ClientHeartbeatRequest',
  [MessageType.CLIENT_HEARTBEAT_RESPONSE]: 'ClientHeartbeatResponse',

  [MessageType.INVOKE_REQUEST]: 'InvokeRequest',
  [MessageType.INVOKE_RESPONSE]: 'InvokeResponse',
  [MessageType.START_JOB_REQUEST]: 'StartJobRequest',
  [MessageType.START_JOB_RESPONSE]: 'StartJobResponse',
  [MessageType.CANCEL_JOB_REQUEST]: 'CancelJobRequest',
  [MessageType.CANCEL_JOB_RESPONSE]: 'CancelJobResponse',

  [MessageType.REGISTER_LOCAL_REQUEST]: 'RegisterLocalRequest',
  [MessageType.REGISTER_LOCAL_RESPONSE]: 'RegisterLocalResponse',
  [MessageType.HEARTBEAT_LOCAL_REQUEST]: 'HeartbeatLocalRequest',
  [MessageType.HEARTBEAT_LOCAL_RESPONSE]: 'HeartbeatLocalResponse',
};

/**
 * Protocol message class
 *
 * Message Format:
 *   Header (8 bytes):
 *     Version (1 byte) | MsgID (3 bytes) | RequestID (4 bytes)
 *   Body: protobuf serialized data
 */
export class Message {
  constructor(
    public msgId: number = 0,
    public reqId: number = 0,
    public body: Uint8Array = new Uint8Array(0),
    public version: number = VERSION_1
  ) {}

  /**
   * Encode message to bytes
   */
  encode(): Uint8Array {
    const buffer = new Uint8Array(HEADER_SIZE + this.body.length);

    // Version (1 byte)
    buffer[0] = this.version;

    // MsgID (3 bytes, big-endian)
    buffer[1] = (this.msgId >> 16) & 0xff;
    buffer[2] = (this.msgId >> 8) & 0xff;
    buffer[3] = this.msgId & 0xff;

    // RequestID (4 bytes, big-endian)
    buffer[4] = (this.reqId >> 24) & 0xff;
    buffer[5] = (this.reqId >> 16) & 0xff;
    buffer[6] = (this.reqId >> 8) & 0xff;
    buffer[7] = this.reqId & 0xff;

    // Body
    if (this.body.length > 0) {
      buffer.set(this.body, HEADER_SIZE);
    }

    return buffer;
  }

  /**
   * Decode message from bytes
   */
  static decode(data: Uint8Array): Message | null {
    if (data.length < HEADER_SIZE) {
      return null;
    }

    const version = data[0];
    const msgId = ((data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
    const reqId = ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0;
    const body = data.length > HEADER_SIZE ? data.slice(HEADER_SIZE) : new Uint8Array(0);

    return new Message(msgId, reqId, body, version);
  }

  /**
   * Check if this is a request message
   */
  isRequest(): boolean {
    return (this.msgId & 1) === 1;
  }

  /**
   * Check if this is a response message
   */
  isResponse(): boolean {
    return (this.msgId & 1) === 0;
  }

  /**
   * Get the response message ID for this message
   */
  getResponseMsgId(): number {
    return this.msgId + 1;
  }

  /**
   * Get human-readable message type name
   */
  getMsgIdName(): string {
    return MESSAGE_TYPE_NAMES[this.msgId] || `Unknown(0x${this.msgId.toString(16).padStart(6, '0')})`;
  }

  /**
   * Get debug string representation
   */
  debugString(): string {
    return `Message{Ver=${this.version}, MsgID=0x${this.msgId.toString(16).padStart(6, '0')} (${this.getMsgIdName()}), ReqID=${this.reqId}, BodySize=${this.body.length}}`;
  }

  toString(): string {
    return this.debugString();
  }
}

/**
 * Create a request message
 */
export function createRequest(msgId: number, reqId: number, body: Uint8Array): Uint8Array {
  const msg = new Message(msgId, reqId, body);
  return msg.encode();
}

/**
 * Create a response message
 */
export function createResponse(msgId: number, reqId: number, body: Uint8Array): Uint8Array {
  const msg = new Message(msgId, reqId, body);
  return msg.encode();
}

/**
 * Parse a message buffer
 *
 * @returns [version, msgId, reqId, body] or null if invalid
 */
export function parseMessage(data: Uint8Array): [number, number, number, Uint8Array] | null {
  if (data.length < HEADER_SIZE) {
    return null;
  }

  const version = data[0];
  const msgId = ((data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
  const reqId = ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0;
  const body = data.length > HEADER_SIZE ? data.slice(HEADER_SIZE) : new Uint8Array(0);

  return [version, msgId, reqId, body];
}

/**
 * Get human-readable message type name
 */
export function getMessageTypeName(msgId: number): string {
  return MESSAGE_TYPE_NAMES[msgId] || `Unknown(0x${msgId.toString(16).padStart(6, '0')})`;
}

/**
 * Check if message ID is a request (odd number)
 */
export function isRequestMessage(msgId: number): boolean {
  return (msgId & 1) === 1;
}

/**
 * Check if message ID is a response (even number)
 */
export function isResponseMessage(msgId: number): boolean {
  return (msgId & 1) === 0;
}

/**
 * Get response message ID for a request
 */
export function getResponseMessageId(reqMsgId: number): number {
  return reqMsgId + 1;
}

/**
 * Convert string to Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Convert object to JSON bytes
 */
export function jsonToBytes(obj: unknown): Uint8Array {
  return stringToBytes(JSON.stringify(obj));
}

/**
 * Parse JSON from bytes
 */
export function bytesToJson<T = unknown>(bytes: Uint8Array): T | null {
  try {
    return JSON.parse(bytesToString(bytes)) as T;
  } catch {
    return null;
  }
}
