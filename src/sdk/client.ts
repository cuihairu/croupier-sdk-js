// Croupier TypeScript SDK - Main Client Interface
// Copyright (c) 2025 cuihairu
// Licensed under Apache License 2.0

import { Client, ClientConfig as TransportClientConfig } from '../transport/client.js';
import { Server, ServerConfig, RequestHandler } from '../transport/server.js';
import { MessageType, stringToBytes, bytesToString, jsonToBytes, bytesToJson } from '../protocol/message.js';

/**
 * Function descriptor
 */
export interface FunctionDescriptor {
  id: string;
  version?: string;
  name?: string;
  description?: string;
}

/**
 * Function handler type
 */
export type FunctionHandler = (context: string, payload: string) => string | Promise<string>;

/**
 * Client configuration
 */
export interface ClientConfig {
  agentAddr?: string;
  localBind?: string;
  timeoutSeconds?: number;
  serviceId?: string;
  serviceVersion?: string;
  insecure?: boolean;
  enableLogging?: boolean;
  debugLogging?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<ClientConfig, 'insecure'>> & { insecure: boolean } = {
  agentAddr: '127.0.0.1:19091',
  localBind: '0.0.0.0:0',
  timeoutSeconds: 30,
  serviceId: 'ts-service',
  serviceVersion: '1.0.0',
  insecure: true,
  enableLogging: true,
  debugLogging: false,
};

/**
 * Registered function info
 */
interface FunctionInfo {
  handler: FunctionHandler;
  descriptor: FunctionDescriptor;
}

/**
 * Main Croupier SDK client for TypeScript/JavaScript
 *
 * Manages connection to Agent, function registration, and request handling.
 *
 * @example
 * ```ts
 * const client = new CroupierClient();
 *
 * client.registerFunction('player.get', (context, payload) => {
 *   return JSON.stringify({ player_id: '123', name: 'Player One' });
 * });
 *
 * await client.connect();
 * await client.serve();
 * ```
 */
export class CroupierClient {
  private config: Required<ClientConfig>;
  private handlers = new Map<string, FunctionInfo>();
  private connected = false;
  private running = false;
  private localAddress = '';
  private sessionId = '';
  private client: Client | null = null;
  private server: Server | null = null;

  constructor(config: ClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ClientConfig>;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Check if serving
   */
  get isServing(): boolean {
    return this.running;
  }

  /**
   * Get local server address (after connect)
   */
  getLocalAddress(): string {
    return this.localAddress;
  }

  /**
   * Get session ID (after registration)
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Register a function
   *
   * @param functionId Function identifier
   * @param handler Function handler
   * @param descriptor Optional function descriptor
   */
  registerFunction(
    functionId: string,
    handler: FunctionHandler,
    descriptor: Partial<FunctionDescriptor> = {}
  ): void {
    if (this.running) {
      throw new Error('Cannot register functions while serving');
    }

    const desc: FunctionDescriptor = {
      id: functionId,
      version: '1.0.0',
      name: functionId,
      description: '',
      ...descriptor,
    };

    this.handlers.set(functionId, { handler, descriptor });
    this.log(`Registered function: ${functionId}`);
  }

  /**
   * Unregister a function
   */
  unregisterFunction(functionId: string): boolean {
    if (this.running) {
      return false;
    }

    const result = this.handlers.delete(functionId);
    if (result) {
      this.log(`Unregistered function: ${functionId}`);
    }
    return result;
  }

  /**
   * Check if function is registered
   */
  hasFunction(functionId: string): boolean {
    return this.handlers.has(functionId);
  }

  /**
   * Get number of registered functions
   */
  getFunctionCount(): number {
    return this.handlers.size;
  }

  /**
   * Connect to Agent and start local server
   */
  async connect(): Promise<boolean> {
    if (this.connected) {
      return true;
    }

    this.log(`Connecting to Agent: ${this.config.agentAddr}`);

    // Start local server
    if (!this.startLocalServer()) {
      this.log('Failed to start local server');
      return false;
    }

    // Connect to agent
    const transportConfig: TransportClientConfig = {
      address: this.config.agentAddr,
      recvTimeout: this.config.timeoutSeconds * 1000,
    };

    this.client = new Client(transportConfig);

    const clientConnected = await this.client.connect();
    if (!clientConnected) {
      this.log('Failed to connect to agent');
      this.stopLocalServer();
      return false;
    }

    // Register with agent
    if (!await this.registerWithAgent()) {
      this.log('Failed to register with agent');
      this.client.disconnect();
      this.stopLocalServer();
      return false;
    }

    this.connected = true;
    this.log('Connected successfully!');
    this.debug(`Local address: ${this.localAddress}`);
    this.debug(`Session ID: ${this.sessionId}`);

    return true;
  }

  /**
   * Disconnect from Agent and stop local server
   */
  disconnect(): void {
    this.connected = false;
    this.running = false;
    this.stopLocalServer();

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    this.log('Disconnected');
  }

  /**
   * Start serving (blocking)
   *
   * Note: This returns immediately; actual serving happens in background.
   * Use stop() to stop serving.
   */
  async serve(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    this.running = true;
    this.log(`Serving ${this.handlers.size} functions...`);

    // Note: Server is already running in background from startLocalServer
    // This just marks the client as serving

    // Keep alive loop
    while (this.running) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Stop serving
   */
  stop(): void {
    this.running = false;
    this.log('Stopped serving');
  }

  /**
   * Start local server
   */
  private startLocalServer(): boolean {
    try {
      const serverConfig: ServerConfig = {
        bindAddress: this.config.localBind,
      };

      this.server = new Server(serverConfig);

      const handler: RequestHandler = async (msgId, reqId, body) => {
        return this.handleRequest(msgId, reqId, body);
      };

      this.server.startAsync(handler);

      this.localAddress = this.config.localBind;
      return true;
    } catch (error) {
      this.debug(`Failed to start local server: ${error}`);
      return false;
    }
  }

  /**
   * Stop local server
   */
  private stopLocalServer(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  /**
   * Register with Agent
   */
  private async registerWithAgent(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    // Build register request
    const functions = Array.from(this.handlers.values()).map(info => ({
      id: info.descriptor.id,
      version: info.descriptor.version,
      name: info.descriptor.name,
    }));

    const requestObj = {
      service_id: this.config.serviceId,
      version: this.config.serviceVersion,
      rpc_addr: this.localAddress,
      functions,
    };

    const request = jsonToBytes(requestObj);

    const response = await this.client.call(MessageType.REGISTER_CLIENT_REQUEST, request);

    if (!response) {
      return false;
    }

    // Generate session ID
    this.sessionId = `session_${Date.now()}`;
    return true;
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(msgId: number, reqId: number, body: Uint8Array): Promise<Uint8Array> {
    try {
      // Parse request
      const request = bytesToJson<{ function_id?: string; payload?: string }>(body);
      if (!request) {
        return stringToBytes(JSON.stringify({ error: 'Invalid request' }));
      }

      const functionId = request.function_id || '';
      const payload = request.payload || '';

      // Find handler
      const info = this.handlers.get(functionId);
      if (!info) {
        return stringToBytes(JSON.stringify({ error: `Function not found: ${functionId}` }));
      }

      // Call handler
      const context = JSON.stringify({ game_id: 'default', env: 'dev' });
      const response = await info.handler(context, payload);

      return stringToBytes(response);
    } catch (error) {
      this.debug(`Request handler error: ${error}`);
      return stringToBytes(JSON.stringify({ error: String(error) }));
    }
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[Croupier] ${message}`);
    }
  }

  /**
   * Log debug message
   */
  private debug(message: string): void {
    if (this.config.enableLogging && this.config.debugLogging) {
      console.debug(`[Croupier DEBUG] ${message}`);
    }
  }
}

/**
 * Invoker for calling functions on Agent
 */
export class Invoker {
  private config: ClientConfig;
  private client: Client | null = null;
  private connected = false;

  constructor(config: ClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ClientConfig>;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Connect to Agent
   */
  async connect(): Promise<boolean> {
    if (this.connected) {
      return true;
    }

    const transportConfig: TransportClientConfig = {
      address: this.config.agentAddr,
      recvTimeout: this.config.timeoutSeconds * 1000,
    };

    this.client = new Client(transportConfig);
    this.connected = await this.client.connect();

    return this.connected;
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.connected = false;
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  /**
   * Invoke a function synchronously
   *
   * @param functionId Target function ID
   * @param payload Request payload (JSON string or object)
   * @returns Response string or null on failure
   */
  async invoke(functionId: string, payload: string | object): Promise<string | null> {
    if (!this.connected || !this.client) {
      console.error('[Croupier] Not connected');
      return null;
    }

    // Build request
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const requestObj = {
      function_id: functionId,
      payload: payloadStr,
    };

    const request = jsonToBytes(requestObj);

    const response = await this.client.call(MessageType.INVOKE_REQUEST, request);

    if (!response) {
      return null;
    }

    return bytesToString(response);
  }

  /**
   * Start an async job
   *
   * @param functionId Target function ID
   * @param payload Request payload
   * @returns Job ID or null on failure
   */
  async startJob(functionId: string, payload: string | object): Promise<string | null> {
    if (!this.connected || !this.client) {
      console.error('[Croupier] Not connected');
      return null;
    }

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const requestObj = {
      function_id: functionId,
      payload: payloadStr,
    };

    const request = jsonToBytes(requestObj);

    const response = await this.client.call(MessageType.START_JOB_REQUEST, request);

    if (!response) {
      return null;
    }

    // Generate job ID
    return `job_${Date.now()}`;
  }

  /**
   * Cancel a job
   *
   * @param jobId Job ID to cancel
   * @returns True on success
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.connected || !this.client) {
      return false;
    }

    const requestObj = { job_id: jobId };
    const request = jsonToBytes(requestObj);

    const response = await this.client.call(MessageType.CANCEL_JOB_REQUEST, request);

    return response !== null;
  }
}

/**
 * Helper to use client with automatic cleanup
 */
export async function withClient<T>(
  config: ClientConfig,
  fn: (client: CroupierClient) => Promise<T>
): Promise<T> {
  const client = new CroupierClient(config);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    client.disconnect();
  }
}
