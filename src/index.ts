/**
 * Croupier JavaScript SDK
 *
 * Provides function registration and invocation for the Croupier platform.
 * Uses NNG (nanomsg-next-gen) for transport layer.
 */

import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { TextDecoder, TextEncoder } from 'node:util';
import { NNGTransport } from './transport';
import {
  MSG_INVOKE_REQUEST,
  MSG_INVOKE_RESPONSE,
  MSG_START_JOB_REQUEST,
  MSG_START_JOB_RESPONSE,
} from './protocol';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Configuration for retrying failed invocations with exponential backoff.
 *
 * When enabled, the client will automatically retry failed invocations
 * using an exponential backoff strategy with jitter to prevent thundering
 * herd problems.
 *
 * @example
 * ```typescript
 * const retryConfig: RetryConfig = {
 *   enabled: true,
 *   maxAttempts: 3,
 *   initialDelayMs: 100,
 *   maxDelayMs: 5000,
 *   backoffMultiplier: 2.0,
 *   jitterFactor: 0.1,
 *   retryableStatusCodes: [14, 13, 2, 10, 4]
 * };
 * ```
 */
export interface RetryConfig {
  /**
   * Whether retry is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Maximum number of retry attempts.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial retry delay in milliseconds.
   * @default 100
   */
  initialDelayMs?: number;

  /**
   * Maximum retry delay in milliseconds.
   * @default 5000
   */
  maxDelayMs?: number;

  /**
   * Backoff multiplier for exponential backoff.
   * @default 2.0
   */
  backoffMultiplier?: number;

  /**
   * Jitter factor (0-1) for adding randomness to delays.
   * @default 0.1
   */
  jitterFactor?: number;

  /**
   * List of status codes that should trigger a retry.
   * Default codes: UNAVAILABLE(14), INTERNAL(13), UNKNOWN(2), ABORTED(10), DEADLINE_EXCEEDED(4)
   */
  retryableStatusCodes?: number[];
}

/**
 * Configuration for automatic reconnection with exponential backoff.
 *
 * When enabled, the client will automatically attempt to reconnect
 * after connection failures using an exponential backoff strategy with
 * jitter to prevent thundering herd problems.
 *
 * @example
 * ```typescript
 * const reconnectConfig: ReconnectConfig = {
 *   enabled: true,
 *   maxAttempts: 0,  // Infinite retries
 *   initialDelayMs: 1000,  // 1 second
 *   maxDelayMs: 30000,  // 30 seconds
 *   backoffMultiplier: 2.0,
 *   jitterFactor: 0.2
 * };
 * ```
 */
export interface ReconnectConfig {
  /**
   * Whether automatic reconnection is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Maximum number of reconnection attempts (0 = infinite retries).
   * @default 0
   */
  maxAttempts?: number;

  /**
   * Initial reconnection delay in milliseconds.
   * @default 1000
   */
  initialDelayMs?: number;

  /**
   * Maximum reconnection delay in milliseconds.
   * @default 30000
   */
  maxDelayMs?: number;

  /**
   * Backoff multiplier for exponential backoff.
   * @default 2.0
   */
  backoffMultiplier?: number;

  /**
   * Jitter factor (0-1) for adding randomness to delays.
   * @default 0.2
   */
  jitterFactor?: number;
}

/**
 * Options for invoking a function.
 *
 * @example
 * ```typescript
 * const options: InvokeOptions = {
 *   idempotencyKey: 'unique-key-123',
 *   timeout: 5000,
 *   headers: {
 *     'X-Request-ID': 'req-456',
 *     'X-Game-ID': 'my-game'
 *   },
 *   retry: {
 *     maxAttempts: 3
 *   }
 * };
 * ```
 */
export interface InvokeOptions {
  /**
   * Unique key for idempotent requests.
   *
   * Requests with the same idempotency key will return the same result,
   * preventing duplicate executions.
   */
  idempotencyKey?: string;

  /**
   * Per-invocation timeout in milliseconds.
   *
   * If not specified, uses the client-level timeout.
   */
  timeout?: number;

  /**
   * Retry configuration for the invocation.
   */
  retry?: RetryConfig;

  /**
   * Custom headers/metadata for the invocation.
   */
  headers?: Record<string, string>;
}

export interface FunctionDescriptor {
  id: string;
  version: string;
  name?: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  category?: string;
  risk?: string;
  entity?: string;
  operation?: string;
}

export interface FunctionHandler {
  (context: string, payload: string): Promise<string> | string;
}

export interface ClientConfig {
  // === Connection ===
  agentAddr?: string;
  timeout?: number;

  // === Service Identity ===
  serviceId?: string;
  serviceVersion?: string;

  // === Game Context ===
  gameId?: string;
  env?: string;

  // === Heartbeat ===
  heartbeatIntervalSeconds?: number;

  // === Provider Info ===
  providerLang?: string;
  providerSdk?: string;

  // === TLS Configuration ===
  insecure?: boolean;
  certFile?: string;
  keyFile?: string;
  caFile?: string;

  // === Authentication ===
  authToken?: string;
  headers?: Record<string, string>;

  // === Reconnection ===
  autoReconnect?: boolean;
  reconnectInterval?: number;
  reconnect?: ReconnectConfig;

  // === Retry ===
  retry?: RetryConfig;

  // === File Transfer ===
  enableFileTransfer?: boolean;
  maxFileSize?: number;
}

interface LocalFunctionDescriptor {
  id: string;
  version: string;
  category?: string;
  risk?: string;
  entity?: string;
  operation?: string;
}

interface JobEvent {
  type: string;
  message?: string;
  progress?: number;
  payload: Uint8Array;
}

class JobState {
  private queue: JobEvent[] = [];
  private waiting: Array<(value: JobEvent | null) => void> = [];
  private closed = false;

  push(event: JobEvent, close = false): void {
    if (this.closed) {
      return;
    }
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve?.(event);
    } else {
      this.queue.push(event);
    }
    if (close) {
      this.close();
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    while (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve?.(null);
    }
  }

  async *stream(): AsyncIterable<JobEvent> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift() as JobEvent;
        continue;
      }
      if (this.closed) {
        break;
      }
      const next = await new Promise<JobEvent | null>((resolve) => this.waiting.push(resolve));
      if (!next) {
        break;
      }
      yield next;
    }
  }
}

export interface CroupierClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  registerFunction(descriptor: FunctionDescriptor, handler: FunctionHandler): void;
  invoke(functionId: string, payload: string, optionsOrMetadata?: InvokeOptions | Record<string, string>): Promise<string>;
  startJob(functionId: string, payload: string, optionsOrMetadata?: InvokeOptions | Record<string, string>): string;
  streamJob(jobId: string): AsyncIterable<JobEvent>;
  cancelJob(jobId: string): boolean;
  serve(): Promise<void>;
  serveAsync(): Promise<void>;
}

export class BasicClient implements CroupierClient {
  private readonly config: Required<ClientConfig>;
  private handlers: Map<string, FunctionHandler> = new Map();
  private descriptors: Map<string, FunctionDescriptor> = new Map();
  private jobStates: Map<string, JobState> = new Map();
  private transport: NNGTransport | null = null;
  private connected = false;

  constructor(config: ClientConfig = {}) {
    this.config = {
      // Connection
      agentAddr: 'tcp://127.0.0.1:19090',
      timeout: 30000,

      // Service Identity
      serviceId: `node-sdk-${randomUUID()}`,
      serviceVersion: '1.0.0',

      // Game Context
      gameId: '',
      env: 'production',

      // Heartbeat
      heartbeatIntervalSeconds: 60,

      // Provider Info
      providerLang: 'node',
      providerSdk: 'croupier-js-sdk',

      // TLS (defaults: secure TLS)
      insecure: false,
      certFile: '',
      keyFile: '',
      caFile: '',

      // Authentication
      authToken: '',
      headers: {},

      // Reconnection
      autoReconnect: true,
      reconnectInterval: 5000,

      // Retry
      // File Transfer
      enableFileTransfer: false,
      maxFileSize: 10485760, // 10 MB default

      ...config,

      // Deep merge for nested objects
      reconnect: {
        enabled: true,
        maxAttempts: 0,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2.0,
        jitterFactor: 0.2,
        ...config.reconnect,
      },
      retry: {
        enabled: true,
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2.0,
        jitterFactor: 0.1,
        retryableStatusCodes: [14, 13, 2, 10, 4],
        ...config.retry,
      },
    };
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (this.handlers.size === 0) {
      throw new Error('Register at least one function before connecting.');
    }

    this.transport = new NNGTransport(this.config.agentAddr, this.config.timeout);
    this.transport.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.connected = false;
  }

  async serve(): Promise<void> {
    // Connect if not already connected
    if (!this.connected) {
      await this.connect();
    }

    // Keep serving indefinitely
    return new Promise<void>((resolve, reject) => {
      // Handle graceful shutdown
      const cleanup = () => {
        this.disconnect().catch((err) => {
          console.error('Error during disconnect:', err);
        });
      };

      // Setup process handlers for graceful shutdown
      if (process.listenerCount('SIGINT') === 0) {
        process.once('SIGINT', () => {
          console.log('\nReceived SIGINT, shutting down gracefully...');
          cleanup();
          resolve();
        });
      }

      if (process.listenerCount('SIGTERM') === 0) {
        process.once('SIGTERM', () => {
          console.log('Received SIGTERM, shutting down gracefully...');
          cleanup();
          resolve();
        });
      }

      // Log that we're serving
      console.log(`Croupier client serving at ${this.config.agentAddr}`);
      console.log(`Service: ${this.config.serviceId} @ ${this.config.serviceVersion}`);
      console.log(`Registered functions: ${this.handlers.size}`);
      console.log('Press Ctrl+C to stop...');
    });
  }

  async serveAsync(): Promise<void> {
    // Same as serve(), but with explicit async documentation
    return this.serve();
  }

  registerFunction(descriptor: FunctionDescriptor, handler: FunctionHandler): void {
    if (this.connected) {
      throw new Error('Cannot register new functions while connected. Disconnect first.');
    }
    if (!descriptor.id || !descriptor.version) {
      throw new Error('Function descriptor must include id and version.');
    }
    this.descriptors.set(descriptor.id, descriptor);
    this.handlers.set(descriptor.id, handler);
  }

  getFunctionDescriptor(functionId: string): LocalFunctionDescriptor | undefined {
    const desc = this.descriptors.get(functionId);
    if (!desc) {
      return undefined;
    }
    return {
      id: desc.id,
      version: desc.version,
      category: desc.category,
      risk: desc.risk,
      entity: desc.entity,
      operation: desc.operation,
    };
  }

  getRegisterRequest(rpcAddr = '') {
    return {
      serviceId: this.config.serviceId,
      version: this.config.serviceVersion,
      rpcAddr,
      // Game context
      gameId: this.config.gameId || undefined,
      env: this.config.env,
      // TLS configuration
      insecure: this.config.insecure,
      certFile: this.config.certFile || undefined,
      keyFile: this.config.keyFile || undefined,
      caFile: this.config.caFile || undefined,
      // Authentication
      authToken: this.config.authToken || undefined,
      headers: Object.keys(this.config.headers).length > 0 ? this.config.headers : undefined,
      // Reconnection
      autoReconnect: this.config.autoReconnect,
      reconnectInterval: this.config.reconnectInterval,
      // File transfer
      enableFileTransfer: this.config.enableFileTransfer,
      maxFileSize: this.config.maxFileSize,
      // Functions
      functions: Array.from(this.descriptors.values()).map((desc) => ({
        id: desc.id,
        version: desc.version,
        category: desc.category || '',
        risk: desc.risk || '',
        entity: desc.entity || '',
        operation: desc.operation || '',
      })),
    };
  }

  async invoke(
    functionId: string,
    payload: string,
    optionsOrMetadata: InvokeOptions | Record<string, string> = {}
  ): Promise<string> {
    const handler = this.handlers.get(functionId);
    if (!handler) {
      throw new Error(`Function ${functionId} not found`);
    }

    // Normalize options to InvokeOptions
    let options: InvokeOptions;
    if (this.isInvokeOptions(optionsOrMetadata)) {
      options = optionsOrMetadata;
    } else {
      options = { headers: optionsOrMetadata };
    }

    // Merge with client-level retry config
    const retryConfig = {
      ...this.config.retry,
      ...options.retry,
    };

    // Use per-invocation timeout if specified, otherwise use client-level timeout
    const timeout = options.timeout ?? this.config.timeout;

    const metadata = options.headers || {};

    // If transport is connected, use remote invocation
    if (this.connected && this.transport) {
      const requestData = Buffer.from(
        JSON.stringify({
          function_id: functionId,
          payload: encoder.encode(payload),
          metadata,
          idempotency_key: options.idempotencyKey,
          timeout,
          retry_config: retryConfig,
        })
      );
      const [, responseData] = this.transport.call(MSG_INVOKE_REQUEST, requestData);
      return decoder.decode(responseData);
    }

    // Local invocation
    const context = JSON.stringify({
      ...metadata,
      ...(options.idempotencyKey && { idempotency_key: options.idempotencyKey }),
      timeout,
    });

    const result = await handler(context, payload);
    return result;
  }

  startJob(
    functionId: string,
    payload: string,
    optionsOrMetadata: InvokeOptions | Record<string, string> = {}
  ): string {
    const handler = this.handlers.get(functionId);
    if (!handler) {
      throw new Error(`Function ${functionId} not found`);
    }

    // Normalize options to InvokeOptions
    let options: InvokeOptions;
    if (this.isInvokeOptions(optionsOrMetadata)) {
      options = optionsOrMetadata;
    } else {
      options = { headers: optionsOrMetadata };
    }

    // Merge with client-level retry config
    const retryConfig = {
      ...this.config.retry,
      ...options.retry,
    };

    // Use per-invocation timeout if specified, otherwise use client-level timeout
    const timeout = options.timeout ?? this.config.timeout;

    const metadata = options.headers || {};

    const jobId = `${functionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const state = new JobState();
    this.jobStates.set(jobId, state);

    state.push({
      type: 'started',
      message: 'job started',
      progress: 0,
      payload: new Uint8Array(),
    });

    const context = JSON.stringify({
      ...metadata,
      ...(options.idempotencyKey && { idempotency_key: options.idempotencyKey }),
      timeout,
    });

    setImmediate(async () => {
      try {
        const result = await handler(context, payload);
        state.push(
          {
            type: 'completed',
            message: 'job completed',
            progress: 100,
            payload: encoder.encode(result ?? ''),
          },
          true
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Handler failed';
        state.push(
          {
            type: 'error',
            message,
            progress: 0,
            payload: new Uint8Array(),
          },
          true
        );
      } finally {
        this.jobStates.delete(jobId);
      }
    });

    return jobId;
  }

  streamJob(jobId: string): AsyncIterable<JobEvent> {
    const state = this.jobStates.get(jobId);
    if (!state) {
      throw new Error(`Job ${jobId} not found`);
    }
    return state.stream();
  }

  cancelJob(jobId: string): boolean {
    const state = this.jobStates.get(jobId);
    if (state) {
      state.push(
        {
          type: 'cancelled',
          message: 'job cancelled',
          progress: 0,
          payload: new Uint8Array(),
        },
        true
      );
      this.jobStates.delete(jobId);
      return true;
    }
    return false;
  }

  /**
   * Type guard to check if an object is InvokeOptions.
   *
   * Checks for presence of InvokeOptions-specific fields (retry, idempotencyKey, timeout)
   * that would not typically be in a simple metadata object.
   */
  private isInvokeOptions(obj: InvokeOptions | Record<string, string>): obj is InvokeOptions {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    // Check if any InvokeOptions-specific field is present
    return 'retry' in obj || 'idempotencyKey' in obj || 'timeout' in obj;
  }

  buildManifest() {
    const functions = Array.from(this.descriptors.values()).map((desc) => ({
      id: desc.id,
      version: desc.version || '1.0.0',
      category: desc.category,
      description: desc.description,
      input_schema: desc.input_schema,
      output_schema: desc.output_schema,
    }));

    return {
      provider: {
        id: this.config.serviceId,
        version: this.config.serviceVersion,
        lang: this.config.providerLang,
        sdk: this.config.providerSdk,
      },
      functions,
    };
  }

  getManifestGzipped(): Buffer {
    const manifest = this.buildManifest();
    return gzipSync(Buffer.from(JSON.stringify(manifest)));
  }
}

export function createClient(config?: ClientConfig): CroupierClient {
  return new BasicClient(config);
}

// Export protocol and transport
export * from './protocol';
export * from './transport';

export { BasicClient as default };
