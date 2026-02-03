// Croupier TypeScript SDK - Transport Client
// Copyright (c) 2025 cuihairu
// Licensed under Apache License 2.0

import * as nng from 'nng.js';
import { createRequest, parseMessage, MessageType } from '../protocol/message.js';

/**
 * Client configuration
 */
export interface ClientConfig {
  address?: string;
  dialTimeout?: number;
  sendTimeout?: number;
  recvTimeout?: number;
  enableTLS?: boolean;
}

/**
 * Call result
 */
export interface CallResult {
  success: boolean;
  body: Uint8Array;
  errorMsg: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ClientConfig> = {
  address: '127.0.0.1:19091',
  dialTimeout: 5000,
  sendTimeout: 5000,
  recvTimeout: 30000,
  enableTLS: false,
};

/**
 * NNG REQ client for Agent communication
 *
 * Uses nanomsg REQ/REP pattern for synchronous request/response.
 */
export class Client {
  private config: Required<ClientConfig>;
  private sock: nng.ReqSocket | null = null;
  private connected = false;
  private reqIdCounter = 0;

  constructor(config: ClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get configuration
   */
  getConfig(): ClientConfig {
    return { ...this.config };
  }

  /**
   * Connect to the server
   */
  async connect(): Promise<boolean> {
    if (this.connected) {
      return true;
    }

    try {
      this.sock = new nng.ReqSocket();
      this.sock.setReceiveTimeout(this.config.recvTimeout);
      this.sock.setSendTimeout(this.config.sendTimeout);

      const url = `tcp://${this.config.address}`;
      await this.sock.dial(url);

      this.connected = true;
      console.log(`[Croupier] Connected to ${url}`);
      return true;
    } catch (error) {
      console.error('[Croupier] Failed to connect:', error);
      return false;
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.connected = false;
    if (this.sock) {
      try {
        this.sock.close();
      } catch {
        // Ignore
      }
      this.sock = null;
    }
    console.log('[Croupier] Disconnected');
  }

  /**
   * Synchronous call - send request and wait for response
   *
   * @param msgId Message type ID
   * @param request Request body
   * @param timeoutMs Timeout in milliseconds (0 = use default)
   * @returns Response body or null on failure
   */
  async call(
    msgId: number,
    request: Uint8Array,
    timeoutMs?: number
  ): Promise<Uint8Array | null> {
    if (!this.connected || !this.sock) {
      console.error('[Croupier] Not connected');
      return null;
    }

    const reqId = this.nextReqId();

    // Create request message
    const data = createRequest(msgId, reqId, request);

    try {
      // Send request
      await this.sock.send(data);

      // Receive response
      const response = await this.sock.receive();

      // Parse response
      const parsed = parseMessage(response);
      if (!parsed) {
        console.error('[Croupier] Failed to parse response');
        return null;
      }

      const [version, respMsgId, respReqId, body] = parsed;

      // Verify request ID matches
      if (respReqId !== reqId) {
        console.warn(`[Croupier] Request ID mismatch: expected ${reqId}, got ${respReqId}`);
      }

      return body;
    } catch (error) {
      console.error('[Croupier] Call failed:', error);
      return null;
    }
  }

  /**
   * Asynchronous call with callback-style result
   */
  async callAsync(
    msgId: number,
    request: Uint8Array
  ): Promise<CallResult> {
    const body = await this.call(msgId, request);

    if (body === null) {
      return {
        success: false,
        body: new Uint8Array(0),
        errorMsg: 'Call failed',
      };
    }

    return {
      success: true,
      body,
      errorMsg: '',
    };
  }

  /**
   * Get next request ID
   */
  private nextReqId(): number {
    return ++this.reqIdCounter;
  }
}

/**
 * RAII helper for client connection
 */
export class ClientGuard {
  constructor(private client: Client) {}

  async close(): Promise<void> {
    this.client.disconnect();
  }
}

/**
 * Helper function to use client with automatic cleanup
 */
export async function withClient<T>(
  config: ClientConfig,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client(config);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    client.disconnect();
  }
}
