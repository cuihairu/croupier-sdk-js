/**
 * NNG Transport Layer for Croupier JavaScript SDK.
 *
 * Implements the NNG (nanomsg-next-gen) based transport for communication
 * with Croupier Agent using REQ/REP pattern.
 */

import * as nng from 'nng';
import {
  HEADER_SIZE,
  ParsedMessage,
  getResponseMsgId,
  newMessage,
  parseMessage,
} from './protocol';

/**
 * NNG-based transport client using REQ/REP pattern.
 */
export class NNGTransport {
  private address: string;
  private timeoutMs: number;
  private socket: nng.Socket | null = null;
  private connected: boolean = false;
  private requestId: number = 0;

  constructor(address: string = 'tcp://127.0.0.1:19090', timeoutMs: number = 30000) {
    this.address = address;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Connect to the NNG server (Agent).
   */
  connect(): void {
    if (this.connected) {
      return;
    }

    this.socket = nng.socket('req');
    this.socket.setOption('nng/RecvTimeout', this.timeoutMs);
    this.socket.setOption('nng/SendTimeout', this.timeoutMs);
    this.socket.dial(this.address);
    this.connected = true;
  }

  /**
   * Close the connection.
   */
  close(): void {
    if (!this.connected) {
      return;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connected = false;
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send a request and wait for response.
   *
   * @param msgType Protocol message type (e.g., MSG_INVOKE_REQUEST)
   * @param data Protobuf serialized request body
   * @returns Pair of [responseMsgType, responseData]
   */
  call(msgType: number, data: Buffer): [number, Buffer] {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected');
    }

    // Generate request ID
    this.requestId = (this.requestId + 1) >>> 0;

    // Build message with protocol header
    const message = newMessage(msgType, this.requestId, data);

    // Send request
    this.socket.send(message);

    // Receive response
    const response = this.socket.recv() as Buffer;

    // Parse response
    const parsed: ParsedMessage = parseMessage(response);

    // Verify response type
    const expectedRespType = getResponseMsgId(msgType);
    if (parsed.msgId !== expectedRespType) {
      throw new Error(
        `Unexpected response type: expected 0x${expectedRespType.toString(16)}, ` +
          `got 0x${parsed.msgId.toString(16)}`
      );
    }

    return [parsed.msgId, parsed.body];
  }
}

/**
 * NNG-based server using REP/REQ pattern.
 */
export class NNGServer {
  private address: string;
  private timeoutMs: number;
  private socket: nng.Socket | null = null;
  private running: boolean = false;
  private handler: ((msgType: number, reqId: number, body: Buffer) => Buffer) | null = null;

  constructor(address: string = 'tcp://127.0.0.1:19090', timeoutMs: number = 30000) {
    this.address = address;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Set the message handler.
   */
  setHandler(handler: (msgType: number, reqId: number, body: Buffer) => Buffer): void {
    this.handler = handler;
  }

  /**
   * Start the server.
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.socket = nng.socket('rep');
    this.socket.setOption('nng/RecvTimeout', 1000); // 1 second for responsive shutdown
    this.socket.listen(this.address);
    this.running = true;

    // Start server loop in background
    setImmediate(() => this.serveLoop());
  }

  /**
   * Stop the server.
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Check if server is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  private serveLoop(): void {
    if (!this.running || !this.socket) {
      return;
    }

    try {
      const data = this.socket.recv() as Buffer;
      const parsed = parseMessage(data);

      // Handle request
      let responseBody: Buffer = Buffer.alloc(0);
      if (this.handler) {
        try {
          responseBody = this.handler(parsed.msgId, parsed.reqId, parsed.body);
        } catch (e) {
          console.error('Handler error:', e);
        }
      }

      // Build response
      const respMsgType = getResponseMsgId(parsed.msgId);
      const response = newMessage(respMsgType, parsed.reqId, responseBody);

      // Send response
      this.socket.send(response);
    } catch (e) {
      // Timeout is expected for responsive shutdown
      if (this.running) {
        // Continue serving
      }
    }

    // Continue loop
    if (this.running) {
      setImmediate(() => this.serveLoop());
    }
  }
}
