// Croupier TypeScript SDK - Transport Server
// Copyright (c) 2025 cuihairu
// Licensed under Apache License 2.0

import * as nng from 'nng.js';
import { createResponse, parseMessage, getResponseMessageId } from '../protocol/message.js';

/**
 * Server configuration
 */
export interface ServerConfig {
  bindAddress?: string;
  recvTimeout?: number;
  sendTimeout?: number;
  enableTLS?: boolean;
}

/**
 * Request handler callback
 */
export type RequestHandler = (
  msgId: number,
  reqId: number,
  request: Uint8Array
) => Uint8Array | Promise<Uint8Array>;

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ServerConfig> = {
  bindAddress: '0.0.0.0:19091',
  recvTimeout: 30000,
  sendTimeout: 5000,
  enableTLS: false,
};

/**
 * NNG REP server for receiving requests
 *
 * Uses nanomsg REQ/REP pattern to handle incoming requests.
 */
export class Server {
  private config: Required<ServerConfig>;
  private sock: nng.RepSocket | null = null;
  private running = false;
  private boundAddress = '';

  constructor(config: ServerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if server is running
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Get actual bound address (after start)
   */
  getBoundAddress(): string {
    return this.boundAddress;
  }

  /**
   * Get configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Start the server (blocking)
   *
   * @param handler Request handler callback
   * @returns Promise that resolves when server stops
   */
  async start(handler: RequestHandler): Promise<void> {
    if (this.running) {
      throw new Error('Server already running');
    }

    try {
      this.sock = new nng.RepSocket();
      this.sock.setReceiveTimeout(this.config.recvTimeout);
      this.sock.setSendTimeout(this.config.sendTimeout);

      const url = `tcp://${this.config.bindAddress}`;
      await this.sock.listen(url);

      this.running = true;
      this.boundAddress = this.config.bindAddress;
      console.log(`[Croupier] Server listening on ${url}`);

      // Serve loop
      while (this.running) {
        try {
          // Receive request
          const data = await this.sock.receive();

          // Parse message
          const parsed = parseMessage(data);
          if (!parsed) {
            console.warn('[Croupier] Failed to parse message');
            continue;
          }

          const [version, msgId, reqId, body] = parsed;

          // Handle request
          let response_body: Uint8Array;
          try {
            response_body = await handler(msgId, reqId, body);
          } catch (error) {
            console.error('[Croupier] Handler error:', error);
            response_body = new Uint8Array(0);
          }

          // Send response
          const responseMsgId = getResponseMessageId(msgId);
          const response = createResponse(responseMsgId, reqId, response_body);

          await this.sock.send(response);
        } catch (error) {
          if (this.running) {
            // Timeout or other error, continue serving
            continue;
          }
          break;
        }
      }
    } catch (error) {
      console.error('[Croupier] Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Start server in background
   *
   * @param handler Request handler callback
   */
  startAsync(handler: RequestHandler): void {
    if (this.running) {
      return;
    }

    this.start(handler).catch((error) => {
      console.error('[Croupier] Server error:', error);
    });
  }

  /**
   * Stop the server
   */
  stop(): void {
    this.running = false;
    if (this.sock) {
      try {
        this.sock.close();
      } catch {
        // Ignore
      }
      this.sock = null;
    }
    console.log('[Croupier] Server stopped');
  }
}

/**
 * RAII helper for server lifetime
 */
export class ServerGuard {
  constructor(private server: Server) {}

  close(): void {
    this.server.stop();
  }
}

/**
 * Helper function to run server with automatic cleanup
 */
export async function withServer<T>(
  config: ServerConfig,
  handler: RequestHandler,
  fn: (server: Server) => Promise<T>
): Promise<T> {
  const server = new Server(config);
  try {
    // Start server in background
    server.startAsync(handler);

    // Run the function
    return await fn(server);
  } finally {
    server.stop();
  }
}
