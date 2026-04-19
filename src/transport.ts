/**
 * TCP Transport Layer for Croupier JavaScript SDK.
 *
 * Implements TCP-based transport for communication
 * with Croupier Agent using request/response pattern.
 */

import * as net from "net";
import {
  HEADER_SIZE,
  ParsedMessage,
  getResponseMsgId,
  newMessage,
  parseMessage,
} from "./protocol";

/**
 * TCP-based transport client.
 */
export class TCPTransport {
  private address: string;
  private timeoutMs: number;
  private client: net.Socket | null = null;
  private connected: boolean = false;
  private requestId: number = 0;

  constructor(address: string = "127.0.0.1:19090", timeoutMs: number = 30000) {
    this.address = address;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Connect to the TCP server (Agent).
   */
  connect(): void {
    if (this.connected) {
      return;
    }

    this.client = new net.Socket();
    this.client.setTimeout(this.timeoutMs);

    // Sync connection for compatibility
    const [host, portStr] = this.address.split(":");
    const port = parseInt(portStr, 10);

    let connected = false;
    let error: Error | null = null;

    this.client.on("connect", () => {
      connected = true;
    });

    this.client.on("error", (err) => {
      error = err;
    });

    this.client.connect(port, host);

    // Small wait for connection
    const start = Date.now();
    while (!connected && !error && Date.now() - start < this.timeoutMs) {
      // Busy wait for sync behavior
    }

    if (error) {
      throw error;
    }

    if (!connected) {
      throw new Error("Connection timeout");
    }

    this.connected = true;
  }

  /**
   * Close the connection.
   */
  close(): void {
    if (!this.connected) {
      return;
    }

    if (this.client) {
      this.client.destroy();
      this.client = null;
    }

    this.connected = false;
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected && (this.client?.readyState === "open" || false);
  }

  /**
   * Send a request and wait for response.
   *
   * @param msgType Protocol message type (e.g., MSG_INVOKE_REQUEST)
   * @param data Protobuf serialized request body
   * @returns Pair of [responseMsgType, responseData]
   */
  call(msgType: number, data: Buffer): [number, Buffer] {
    if (!this.connected || !this.client) {
      throw new Error("Not connected");
    }

    // Generate request ID
    this.requestId = (this.requestId + 1) >>> 0;

    // Build message with protocol header
    const message = newMessage(msgType, this.requestId, data);

    // Prepend 4-byte length prefix
    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32BE(message.length, 0);
    const fullMessage = Buffer.concat([lengthPrefix, message]);

    // Send request
    this.client.write(fullMessage);

    // Receive response
    const response = this.receive();

    // Parse response
    const parsed: ParsedMessage = parseMessage(response);

    // Verify response type
    const expectedRespType = getResponseMsgId(msgType);
    if (parsed.msgId !== expectedRespType) {
      throw new Error(
        `Unexpected response type: expected 0x${expectedRespType.toString(16)}, ` +
          `got 0x${parsed.msgId.toString(16)}`,
      );
    }

    return [parsed.msgId, parsed.body];
  }

  /**
   * Receive a message with length prefix.
   */
  private receive(): Buffer {
    if (!this.client) {
      throw new Error("Not connected");
    }

    // Read 4-byte length prefix
    const lengthPrefix = this.readExactly(4);
    const length = lengthPrefix.readUInt32BE(0);

    // Read message body
    return this.readExactly(length);
  }

  /**
   * Read exactly n bytes from the socket.
   */
  private readExactly(n: number): Buffer {
    if (!this.client) {
      throw new Error("Not connected");
    }

    const chunks: Buffer[] = [];
    let remaining = n;

    while (remaining > 0) {
      const chunk = this.client.read();
      if (chunk) {
        chunks.push(chunk);
        remaining -= chunk.length;
      } else {
        // Wait for data
        const start = Date.now();
        while (!this.client.readableLength && Date.now() - start < 100) {
          // Busy wait
        }
      }
    }

    return Buffer.concat(chunks);
  }
}

/**
 * TCP-based server.
 */
export class TCPServer {
  private address: string;
  private timeoutMs: number;
  private server: net.Server | null = null;
  private running: boolean = false;
  private handler:
    | ((msgType: number, reqId: number, body: Buffer) => Buffer)
    | null = null;

  constructor(address: string = "127.0.0.1:19090", timeoutMs: number = 30000) {
    this.address = address;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Set the message handler.
   */
  setHandler(
    handler: (msgType: number, reqId: number, body: Buffer) => Buffer,
  ): void {
    this.handler = handler;
  }

  /**
   * Start the server.
   */
  start(): void {
    if (this.running) {
      return;
    }

    const [host, portStr] = this.address.split(":");
    const port = parseInt(portStr, 10);

    this.server = net.createServer((socket) => {
      socket.setTimeout(this.timeoutMs);

      socket.on("data", (data: Buffer) => {
        try {
          // Read length prefix (4 bytes)
          if (data.length < 4) {
            return;
          }

          const length = data.readUInt32BE(0);
          if (data.length < 4 + length) {
            return;
          }

          const message = data.subarray(4, 4 + length);
          const parsed = parseMessage(message);

          // Handle request
          let responseBody: Buffer = Buffer.alloc(0);
          if (this.handler) {
            try {
              responseBody = this.handler(
                parsed.msgId,
                parsed.reqId,
                parsed.body,
              );
            } catch (e) {
              console.error("Handler error:", e);
            }
          }

          // Build and return response
          const respMsgType = getResponseMsgId(parsed.msgId);
          const response = newMessage(respMsgType, parsed.reqId, responseBody);

          // Prepend length prefix
          const lengthPrefix = Buffer.alloc(4);
          lengthPrefix.writeUInt32BE(response.length, 0);
          const fullResponse = Buffer.concat([lengthPrefix, response]);

          socket.write(fullResponse);
        } catch (e) {
          console.error("Server error:", e);
        }
      });

      socket.on("error", (err) => {
        console.error("Socket error:", err);
      });
    });

    this.server.listen(port, host);
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

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Check if server is running.
   */
  isRunning(): boolean {
    return this.running;
  }
}
