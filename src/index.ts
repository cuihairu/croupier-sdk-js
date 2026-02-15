/**
 * Croupier JavaScript SDK
 *
 * Provides function registration and invocation for the Croupier platform.
 * Note: This is a refactored version without gRPC dependencies.
 * Transport layer should be implemented separately.
 */

import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { TextDecoder, TextEncoder } from 'node:util';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
  agentAddr?: string;
  timeout?: number;
  serviceId?: string;
  serviceVersion?: string;
  heartbeatIntervalSeconds?: number;
  providerLang?: string;
  providerSdk?: string;
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
  payload?: Uint8Array;
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
  invoke(functionId: string, payload: string, metadata?: Record<string, string>): Promise<string>;
  startJob(functionId: string, payload: string, metadata?: Record<string, string>): string;
  streamJob(jobId: string): AsyncIterable<JobEvent>;
  cancelJob(jobId: string): boolean;
}

export class BasicClient implements CroupierClient {
  private readonly config: Required<ClientConfig>;
  private handlers: Map<string, FunctionHandler> = new Map();
  private descriptors: Map<string, FunctionDescriptor> = new Map();
  private jobStates: Map<string, JobState> = new Map();
  private connected = false;

  constructor(config: ClientConfig = {}) {
    this.config = {
      agentAddr: '127.0.0.1:19090',
      timeout: 30000,
      serviceId: `node-sdk-${randomUUID()}`,
      serviceVersion: '1.0.0',
      heartbeatIntervalSeconds: 60,
      providerLang: 'node',
      providerSdk: 'croupier-js-sdk',
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (this.handlers.size === 0) {
      throw new Error('Register at least one function before connecting.');
    }
    // TODO: Implement transport connection (NNG, etc.)
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
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
    metadata: Record<string, string> = {},
  ): Promise<string> {
    const handler = this.handlers.get(functionId);
    if (!handler) {
      throw new Error(`Function ${functionId} not found`);
    }
    const context = JSON.stringify(metadata);
    const result = await handler(context, payload);
    return result;
  }

  startJob(
    functionId: string,
    payload: string,
    metadata: Record<string, string> = {},
  ): string {
    const handler = this.handlers.get(functionId);
    if (!handler) {
      throw new Error(`Function ${functionId} not found`);
    }

    const jobId = `${functionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const state = new JobState();
    this.jobStates.set(jobId, state);

    state.push({
      type: 'started',
      message: 'job started',
      progress: 0,
      payload: new Uint8Array(),
    });

    const context = JSON.stringify(metadata);

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
          true,
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
          true,
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
        true,
      );
      this.jobStates.delete(jobId);
      return true;
    }
    return false;
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

export { BasicClient as default };
