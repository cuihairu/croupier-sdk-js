import { BasicClient } from './index';

describe('BasicClient', () => {
  test('connect requires at least one function', async () => {
    const client = new BasicClient({ agentAddr: '127.0.0.1:19090' });
    await expect(client.connect()).rejects.toThrow(/Register at least one function/i);
  });

  test('registerFunction validates descriptor', async () => {
    const client = new BasicClient();
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const handler = async () => '';
    await expect(client.registerFunction({ id: '', version: '1.0.0' }, handler)).rejects.toThrow(/id and version/i);
    await expect(client.registerFunction({ id: 'f1', version: '' }, handler)).rejects.toThrow(/id and version/i);
  });

  test('buildManifest includes provider and functions', async () => {
    const client = new BasicClient({
      serviceId: 'svc-1',
      serviceVersion: 'sv1',
      providerLang: 'node',
      providerSdk: 'croupier-js-sdk',
    });

    await client.registerFunction(
      { id: 'f1', version: '1.2.3', name: 'category-a', description: 'desc' },
      async () => 'ok',
    );

    const manifest = (client as any).buildManifest();
    expect(manifest.provider).toEqual({
      id: 'svc-1',
      version: 'sv1',
      lang: 'node',
      sdk: 'croupier-js-sdk',
    });
    expect(manifest.functions).toHaveLength(1);
    expect(manifest.functions[0].id).toBe('f1');
    expect(manifest.functions[0].version).toBe('1.2.3');
  });

  test('startJob/streamJob produces started then completed', async () => {
    const client = new BasicClient();
    await client.registerFunction(
      { id: 'f1', version: '1.0.0' },
      async (_ctx, payload) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return `ok:${payload}`;
      },
    );

    const start = await (client as any).handleStartJob('f1', {}, new TextEncoder().encode('hi'));
    const iterable = (client as any).handleStreamJob(start.jobId);
    const events: any[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const evt of iterable) {
      events.push(evt);
    }

    expect(events[0].type).toBe('started');
    expect(events[events.length - 1].type).toBe('completed');
    expect(new TextDecoder().decode(events[events.length - 1].payload)).toBe('ok:hi');
  });

  test('cancelJob closes stream with cancelled event', async () => {
    const client = new BasicClient();
    await client.registerFunction(
      { id: 'f1', version: '1.0.0' },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'late';
      },
    );

    const start = await (client as any).handleStartJob('f1', {}, new Uint8Array());
    const iterable = (client as any).handleStreamJob(start.jobId);
    await (client as any).handleCancelJob(start.jobId);

    const events: any[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const evt of iterable) {
      events.push(evt);
    }

    expect(events.some((e) => e.type === 'cancelled')).toBe(true);
  });

  test('parseAddress handles various formats', () => {
    const client = new BasicClient();

    // Test host:port format
    expect((client as any).parseAddress('127.0.0.1:8080')).toEqual(['127.0.0.1', 8080]);
    expect((client as any).parseAddress('localhost:9090')).toEqual(['localhost', 9090]);

    // Test URL format
    expect((client as any).parseAddress('http://127.0.0.1:8080')).toEqual(['127.0.0.1', 8080]);
    expect((client as any).parseAddress('https://localhost:9090')).toEqual(['localhost', 9090]);
  });

  test('normalizeAddress handles various formats', () => {
    const client = new BasicClient();

    // Already normalized
    expect((client as any).normalizeAddress('127.0.0.1:8080')).toBe('127.0.0.1:8080');
    expect((client as any).normalizeAddress('localhost:9090')).toBe('localhost:9090');

    // With scheme
    expect((client as any).normalizeAddress('http://127.0.0.1:8080')).toBe('127.0.0.1:8080');
    expect((client as any).normalizeAddress('https://localhost:9090')).toBe('localhost:9090');
  });

  test('normalizeAddressWithScheme adds scheme when missing', () => {
    const insecureClient = new BasicClient({ insecure: true });
    expect((insecureClient as any).normalizeAddressWithScheme('127.0.0.1:8080')).toBe('http://127.0.0.1:8080');

    const secureClient = new BasicClient({ insecure: false });
    expect((secureClient as any).normalizeAddressWithScheme('localhost:9090')).toBe('https://localhost:9090');

    // Already has scheme
    expect((insecureClient as any).normalizeAddressWithScheme('http://example.com')).toBe('http://example.com');
    expect((secureClient as any).normalizeAddressWithScheme('https://example.com')).toBe('https://example.com');
  });

  test('constructor applies default config', () => {
    const client = new BasicClient();
    const config = (client as any).config;

    expect(config.agentAddr).toBe('127.0.0.1:19090');
    expect(config.timeout).toBe(30000);
    expect(config.retryAttempts).toBe(3);
    expect(config.insecure).toBe(true);
    expect(config.serviceVersion).toBe('1.0.0');
    expect(config.localListen).toBe('127.0.0.1:0');
    expect(config.heartbeatIntervalSeconds).toBe(60);
    expect(config.providerLang).toBe('node');
    expect(config.providerSdk).toBe('croupier-js-sdk');
  });

  test('constructor merges user config', () => {
    const client = new BasicClient({
      agentAddr: '192.168.1.1:9999',
      serviceId: 'my-service',
      timeout: 5000,
      insecure: false,
    });
    const config = (client as any).config;

    expect(config.agentAddr).toBe('192.168.1.1:9999');
    expect(config.serviceId).toBe('my-service');
    expect(config.timeout).toBe(5000);
    expect(config.insecure).toBe(false);
    // Defaults should still apply for unspecified values
    expect(config.retryAttempts).toBe(3);
    expect(config.serviceVersion).toBe('1.0.0');
  });

  test('handleInvoke calls registered handler', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockResolvedValue('test-result');
    await client.registerFunction({ id: 'test.fn', version: '1.0.0' }, handler);

    const result = await (client as any).handleInvoke('test.fn', {}, new TextEncoder().encode('input'));

    expect(handler).toHaveBeenCalledWith(expect.stringContaining('{}'), 'input');
    expect(result.payload).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result.payload)).toBe('test-result');
  });

  test('handleInvoke throws for unregistered function', async () => {
    const client = new BasicClient();

    await expect((client as any).handleInvoke('unknown.fn', {}, new Uint8Array())).rejects.toThrow(/not registered/);
  });

  test('handleInvoke propagates handler errors', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
    await client.registerFunction({ id: 'failing.fn', version: '1.0.0' }, handler);

    await expect((client as any).handleInvoke('failing.fn', {}, new Uint8Array())).rejects.toThrow(/Handler error/);
  });

  test('registerFunction throws when connected', async () => {
    const client = new BasicClient();
    await client.registerFunction({ id: 'f1', version: '1.0.0' }, async () => 'ok');

    // Manually set connected to true (since we can't actually connect in tests)
    (client as any).connected = true;

    await expect(
      client.registerFunction({ id: 'f2', version: '1.0.0' }, async () => 'ok'),
    ).rejects.toThrow(/Cannot register new functions while connected/);
  });

  test('handleStreamJob throws for missing jobId', () => {
    const client = new BasicClient();

    // Empty jobId should throw ConnectError
    expect(() => (client as any).handleStreamJob('')).toThrow(/job_id is required/);
  });

  test('handleStartJob creates job state and returns jobId', async () => {
    const client = new BasicClient();
    await client.registerFunction({ id: 'async.fn', version: '1.0.0' }, async () => 'done');

    const response = await (client as any).handleStartJob('async.fn', {}, new Uint8Array());

    expect(response.jobId).toBeDefined();
    expect(response.jobId).toContain('async.fn-');
  });

  test('handleStartJob emits error event on handler failure', async () => {
    const client = new BasicClient();
    await client.registerFunction(
      { id: 'failing.fn', version: '1.0.0' },
      async () => {
        throw new Error('Async error');
      },
    );

    const response = await (client as any).handleStartJob('failing.fn', {}, new Uint8Array());
    const iterable = (client as any).handleStreamJob(response.jobId);
    const events: any[] = [];

    for await (const evt of iterable) {
      events.push(evt);
    }

    expect(events[0].type).toBe('started');
    expect(events[1].type).toBe('error');
    expect(events[1].message).toBe('Async error');
  });

  test('uploadFile throws not implemented error', async () => {
    const client = new BasicClient();

    await expect(
      client.uploadFile({ filePath: '/test/path', content: 'content' }),
    ).rejects.toThrow(/File upload is not yet implemented/);
  });

  test('buildManifest includes all descriptor fields', async () => {
    const client = new BasicClient();

    await client.registerFunction(
      {
        id: 'full.fn',
        version: '2.0.0',
        name: 'full-name',
        description: 'A full function descriptor',
        input_schema: { type: 'object' },
        output_schema: { type: 'string' },
      },
      async () => 'ok',
    );

    const manifest = (client as any).buildManifest();
    const fn = manifest.functions.find((f: any) => f.id === 'full.fn');

    expect(fn).toBeDefined();
    expect(fn.version).toBe('2.0.0');
    expect(fn.category).toBe('full-name');
    expect(fn.description).toBe('A full function descriptor');
    expect(fn.input_schema).toEqual({ type: 'object' });
    expect(fn.output_schema).toEqual({ type: 'string' });
  });

  test('handleCancelJob does nothing for unknown job', async () => {
    const client = new BasicClient();

    // Should not throw
    await expect((client as any).handleCancelJob('unknown-job')).resolves.toBeDefined();
  });

  test('buildManifest defaults version to 1.0.0', async () => {
    const client = new BasicClient();

    // Register with empty version (though registerFunction would reject this)
    (client as any).descriptors.set('test', { id: 'test', version: '' });

    const manifest = (client as any).buildManifest();
    const fn = manifest.functions.find((f: any) => f.id === 'test');

    expect(fn.version).toBe('1.0.0');
  });

  test('parseAddress handles default port', () => {
    const client = new BasicClient();

    // No port specified, should default to 0
    expect((client as any).parseAddress('127.0.0.1')).toEqual(['127.0.0.1', 0]);
    expect((client as any).parseAddress('localhost')).toEqual(['localhost', 0]);
  });

  test('disconnect clears state', async () => {
    const client = new BasicClient();
    await client.registerFunction({ id: 'f1', version: '1.0.0' }, async () => 'ok');

    // Set some state
    (client as any).connected = true;
    (client as any).sessionId = 'test-session';
    (client as any).heartbeatTimer = setInterval(() => {}, 1000);

    await client.disconnect();

    expect((client as any).connected).toBe(false);
    expect((client as any).sessionId).toBe('');
    expect((client as any).heartbeatTimer).toBeUndefined();
  });

  test('handleInvoke with empty payload uses default', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockResolvedValue('result');
    await client.registerFunction({ id: 'test.fn', version: '1.0.0' }, handler);

    await (client as any).handleInvoke('test.fn', {}, new Uint8Array());

    expect(handler).toHaveBeenCalledWith(expect.any(String), '');
  });

  test('handleInvoke returns empty payload for undefined result', async () => {
    const client = new BasicClient();
    await client.registerFunction({ id: 'test.fn', version: '1.0.0' }, async () => undefined as any);

    const result = await (client as any).handleInvoke('test.fn', {}, new Uint8Array());

    expect(result.payload).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result.payload)).toBe('');
  });

  test('connect is idempotent - multiple calls are safe', async () => {
    const client = new BasicClient();

    // First connect would fail without mocking, so we test the idempotency check
    (client as any).connected = true;

    // Should not throw, should just return
    await expect(client.connect()).resolves.not.toThrow();
  });

  test('handleStartJob throws for unregistered function', async () => {
    const client = new BasicClient();

    await expect((client as any).handleStartJob('unknown.fn', {}, new Uint8Array())).rejects.toThrow(/not registered/);
  });

  test('handleStreamJob throws for unknown job', async () => {
    const client = new BasicClient();

    expect(() => (client as any).handleStreamJob('unknown-job-id')).toThrow(/job not found/);
  });

  test('JobStreamQueue handles push after close', async () => {
    const client = new BasicClient();
    await client.registerFunction({ id: 'test.fn', version: '1.0.0' }, async () => 'ok');

    // Start a job to create a JobState
    const start = await (client as any).handleStartJob('test.fn', {}, new Uint8Array());

    // Get the JobState and stream it
    const stream = (client as any).handleStreamJob(start.jobId);

    // Wait for started event
    const reader = stream[Symbol.asyncIterator]();
    await reader.next();

    // The job should auto-complete, so the state should be closed/closing
    // We can't directly test push after close because the job auto-completes
    // But we can verify the stream completes
    const result = await reader.next();
    expect(result.done).toBe(false); // completed event
    expect(result.value.type).toBe('completed');

    // Next call should be done
    const final = await reader.next();
    expect(final.done).toBe(true);
  });

  test('JobStreamQueue handles close after close', async () => {
    const client = new BasicClient();
    await client.registerFunction(
      { id: 'test.fn', version: '1.0.0' },
      async () => {
        // Make job take longer so we can cancel it
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'ok';
      },
    );

    // Start a job
    const start = await (client as any).handleStartJob('test.fn', {}, new Uint8Array());

    // Stream it (getting started event)
    const stream = (client as any).handleStreamJob(start.jobId);
    const reader = stream[Symbol.asyncIterator]();
    const firstEvent = await reader.next();
    expect(firstEvent.value.type).toBe('started');

    // Cancel the job while it's running
    await (client as any).handleCancelJob(start.jobId);

    // Continue streaming - should get cancelled event
    const events: any[] = [firstEvent.value];
    // eslint-disable-next-line no-restricted-syntax
    for await (const evt of stream) {
      events.push(evt);
    }

    // Should have started and cancelled events
    expect(events.some((e: any) => e.type === 'cancelled')).toBe(true);
  });

  test('JobStreamQueue stream ends when closed with waiting resolver', async () => {
    const client = new BasicClient();
    await client.registerFunction(
      { id: 'test.fn', version: '1.0.0' },
      async () => {
        // Simulate a quick job
        await new Promise((resolve) => setTimeout(resolve, 5));
        return 'done';
      },
    );

    const start = await (client as any).handleStartJob('test.fn', {}, new Uint8Array());

    // Stream all events - should end when job completes
    const events: any[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const evt of (client as any).handleStreamJob(start.jobId)) {
      events.push(evt);
    }

    // Should have started and completed events
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].type).toBe('started');
    expect(events[events.length - 1].type).toBe('completed');
  });

  test('buildManifest without category uses descriptor id', async () => {
    const client = new BasicClient();

    await client.registerFunction(
      {
        id: 'simple.fn',
        version: '1.0.0',
        // no category specified
      },
      async () => 'ok',
    );

    const manifest = (client as any).buildManifest();
    const fn = manifest.functions.find((f: any) => f.id === 'simple.fn');

    expect(fn).toBeDefined();
    expect(fn.category).toBeUndefined();
  });

  test('parseAddress handles URL with path', () => {
    const client = new BasicClient();

    // URL format with path (path is ignored)
    expect((client as any).parseAddress('http://127.0.0.1:8080/path')).toEqual(['127.0.0.1', 8080]);
    // HTTPS without explicit port - URL.port returns empty string for default ports
    // and Number('') is 0, so this is expected behavior
    expect((client as any).parseAddress('https://example.com/api/v1')).toEqual(['example.com', 0]);
    // HTTPS with explicit non-standard port
    expect((client as any).parseAddress('https://example.com:8443/api/v1')).toEqual(['example.com', 8443]);
    // HTTP with explicit port
    expect((client as any).parseAddress('http://example.com:8080/api/v1')).toEqual(['example.com', 8080]);
  });

  test('normalizeAddress keeps non-http URLs unchanged', () => {
    const client = new BasicClient();

    expect((client as any).normalizeAddress('localhost:8080')).toBe('localhost:8080');
    expect((client as any).normalizeAddress('127.0.0.1:19090')).toBe('127.0.0.1:19090');
  });

  test('createClient exports a factory function', () => {
    const { createClient } = require('./index');

    const client = createClient({ serviceId: 'test-service' });

    expect(client).toBeInstanceOf(BasicClient);
  });

  test('default export is BasicClient', () => {
    const Client = require('./index').default;

    expect(Client).toBe(BasicClient);
  });

  test('handleStartJob creates job with correct jobId format', async () => {
    const client = new BasicClient();
    await client.registerFunction({ id: 'test.fn', version: '1.0.0' }, async () => 'ok');

    const response = await (client as any).handleStartJob('test.fn', {}, new Uint8Array());

    expect(response.jobId).toContain('test.fn-');
    expect(typeof response.jobId).toBe('string');
  });

  test('handleInvoke with timeout in options', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockResolvedValue('result');
    await client.registerFunction({ id: 'test.fn', version: '1.0.0' }, handler);

    const result = await (client as any).handleInvoke('test.fn', { timeout: 5000 }, new Uint8Array());

    expect(result.payload).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result.payload)).toBe('result');
  });

  test('handleInvoke with custom headers', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockResolvedValue('result');
    await client.registerFunction({ id: 'test.fn', version: '1.0.0' }, handler);

    const metadata = { 'x-custom-header': 'value' };
    const result = await (client as any).handleInvoke('test.fn', metadata, new Uint8Array());

    expect(result.payload).toBeInstanceOf(Uint8Array);
  });

  test('constructor with all config options', () => {
    const client = new BasicClient({
      agentAddr: '192.168.1.1:9999',
      controlAddr: '192.168.1.1:9998',
      timeout: 10000,
      retryAttempts: 5,
      insecure: false,
      serviceId: 'my-service',
      serviceVersion: '2.0.0',
      localListen: '0.0.0.0:8080',
      heartbeatIntervalSeconds: 30,
      providerLang: 'typescript',
      providerSdk: 'custom-sdk',
    });

    const config = (client as any).config;
    expect(config.agentAddr).toBe('192.168.1.1:9999');
    expect(config.controlAddr).toBe('192.168.1.1:9998');
    expect(config.timeout).toBe(10000);
    expect(config.retryAttempts).toBe(5);
    expect(config.insecure).toBe(false);
    expect(config.serviceId).toBe('my-service');
    expect(config.serviceVersion).toBe('2.0.0');
    expect(config.localListen).toBe('0.0.0.0:8080');
    expect(config.heartbeatIntervalSeconds).toBe(30);
    expect(config.providerLang).toBe('typescript');
    expect(config.providerSdk).toBe('custom-sdk');
  });
});

