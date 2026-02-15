/**
 * NNG Transport Layer for Croupier JavaScript SDK.
 *
 * Implements the NNG (nanomsg-next-gen) based transport for communication
 * with Croupier Agent using REQ/REP pattern.
 *
 * Uses the '@rustup/nng' npm package for NNG bindings.
 */

import { Socket, SocketOptions } from '@rustup/nng';
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
  private socket: Socket | null = null;
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

    const options: SocketOptions = {
      recvTimeout: this.timeoutMs,
      sendTimeout: this.timeoutMs,
    };

    this.socket = new Socket(options);
    this.socket.connect(this.address);
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
    return this.connected && (this.socket?.connected() ?? false);
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

    // Send request and receive response (NNG REQ/REP is synchronous)
    const response = this.socket.send(message);

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
  private disposable: ReturnType<typeof Socket.recvMessage> | null = null;
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

    const options: SocketOptions = {
      recvTimeout: this.timeoutMs,
      sendTimeout: this.timeoutMs,
    };

    this.disposable = Socket.recvMessage(
      this.address,
      options,
      (data: Buffer): Buffer => {
        // Parse incoming message
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

        // Build and return response
        const respMsgType = getResponseMsgId(parsed.msgId);
        return newMessage(respMsgType, parsed.reqId, responseBody);
      }
    );

    this.running = true;
  }

  /**
   * Stop the server.
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.disposable) {
      this.disposable.dispose();
      this.disposable = null;
    }
  }

  /**
   * Check if server is running.
   */
  isRunning(): boolean {
    return this.running;
  }
}
