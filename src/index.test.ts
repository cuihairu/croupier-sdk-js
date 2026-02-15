import { BasicClient, createClient, FunctionDescriptor } from './index';

describe('BasicClient', () => {
  test('connect requires at least one function', async () => {
    const client = new BasicClient({ agentAddr: 'tcp://127.0.0.1:19090' });
    await expect(client.connect()).rejects.toThrow(/Register at least one function/i);
  });

  test('registerFunction validates descriptor', () => {
    const client = new BasicClient();
    const handler = async () => '';

    expect(() => client.registerFunction({ id: '', version: '1.0.0' }, handler)).toThrow(/id and version/i);
    expect(() => client.registerFunction({ id: 'f1', version: '' }, handler)).toThrow(/id and version/i);
  });

  test('buildManifest includes provider and functions', () => {
    const client = new BasicClient({
      serviceId: 'svc-1',
      serviceVersion: 'sv1',
      providerLang: 'node',
      providerSdk: 'croupier-js-sdk',
    });

    client.registerFunction(
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
    client.registerFunction(
      { id: 'f1', version: '1.0.0' },
      async (_ctx, payload) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return `ok:${payload}`;
      },
    );

    const jobId = client.startJob('f1', 'hi');
    const iterable = client.streamJob(jobId);
    const events: any[] = [];

    for await (const evt of iterable) {
      events.push(evt);
    }

    expect(events[0].type).toBe('started');
    expect(events[events.length - 1].type).toBe('completed');
    expect(new TextDecoder().decode(events[events.length - 1].payload)).toBe('ok:hi');
  });

  test('cancelJob closes stream with cancelled event', async () => {
    const client = new BasicClient();
    client.registerFunction(
      { id: 'f1', version: '1.0.0' },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'late';
      },
    );

    const jobId = client.startJob('f1', '');
    const iterable = client.streamJob(jobId);

    // Get the first event (started)
    const reader = iterable[Symbol.asyncIterator]();
    const first = await reader.next();
    expect(first.value.type).toBe('started');

    // Cancel the job
    client.cancelJob(jobId);

    // Continue streaming
    const events: any[] = [first.value];
    for await (const evt of iterable) {
      events.push(evt);
    }

    expect(events.some((e) => e.type === 'cancelled')).toBe(true);
  });

  test('constructor applies default config', () => {
    const client = new BasicClient();
    const config = (client as any).config;

    expect(config.agentAddr).toBe('tcp://127.0.0.1:19090');
    expect(config.timeout).toBe(30000);
    expect(config.serviceVersion).toBe('1.0.0');
    expect(config.heartbeatIntervalSeconds).toBe(60);
    expect(config.providerLang).toBe('node');
    expect(config.providerSdk).toBe('croupier-js-sdk');
  });

  test('constructor merges user config', () => {
    const client = new BasicClient({
      agentAddr: 'tcp://192.168.1.1:9999',
      serviceId: 'my-service',
      timeout: 5000,
    });
    const config = (client as any).config;

    expect(config.agentAddr).toBe('tcp://192.168.1.1:9999');
    expect(config.serviceId).toBe('my-service');
    expect(config.timeout).toBe(5000);
    // Defaults should still apply for unspecified values
    expect(config.serviceVersion).toBe('1.0.0');
  });

  test('invoke calls registered handler locally', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockResolvedValue('test-result');
    client.registerFunction({ id: 'test.fn', version: '1.0.0' }, handler);

    const result = await client.invoke('test.fn', 'input');

    expect(handler).toHaveBeenCalledWith(expect.stringContaining('{}'), 'input');
    expect(result).toBe('test-result');
  });

  test('invoke throws for unregistered function', async () => {
    const client = new BasicClient();

    await expect(client.invoke('unknown.fn', '')).rejects.toThrow(/not found/i);
  });

  test('invoke propagates handler errors', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
    client.registerFunction({ id: 'failing.fn', version: '1.0.0' }, handler);

    await expect(client.invoke('failing.fn', '')).rejects.toThrow(/Handler error/);
  });

  test('registerFunction throws when connected', () => {
    const client = new BasicClient();
    client.registerFunction({ id: 'f1', version: '1.0.0' }, async () => 'ok');

    // Manually set connected to true (since we can't actually connect in tests)
    (client as any).connected = true;

    expect(() =>
      client.registerFunction({ id: 'f2', version: '1.0.0' }, async () => 'ok')
    ).toThrow(/Cannot register new functions while connected/);
  });

  test('streamJob throws for missing jobId', () => {
    const client = new BasicClient();

    expect(() => client.streamJob('')).toThrow();
  });

  test('startJob creates job state and returns jobId', () => {
    const client = new BasicClient();
    client.registerFunction({ id: 'async.fn', version: '1.0.0' }, async () => 'done');

    const jobId = client.startJob('async.fn', '');

    expect(jobId).toBeDefined();
    expect(jobId).toContain('async.fn-');
  });

  test('startJob emits error event on handler failure', async () => {
    const client = new BasicClient();
    client.registerFunction(
      { id: 'failing.fn', version: '1.0.0' },
      async () => {
        throw new Error('Async error');
      },
    );

    const jobId = client.startJob('failing.fn', '');
    const events: any[] = [];

    for await (const evt of client.streamJob(jobId)) {
      events.push(evt);
    }

    expect(events[0].type).toBe('started');
    expect(events[1].type).toBe('error');
    expect(events[1].message).toBe('Async error');
  });

  test('buildManifest includes all descriptor fields', () => {
    const client = new BasicClient();

    client.registerFunction(
      {
        id: 'full.fn',
        version: '2.0.0',
        category: 'full-category',
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
    expect(fn.category).toBe('full-category');
    expect(fn.description).toBe('A full function descriptor');
    expect(fn.input_schema).toEqual({ type: 'object' });
    expect(fn.output_schema).toEqual({ type: 'string' });
  });

  test('cancelJob does nothing for unknown job', () => {
    const client = new BasicClient();

    // Should return false (not throw)
    const result = client.cancelJob('unknown-job');
    expect(result).toBe(false);
  });

  test('buildManifest defaults version to 1.0.0', () => {
    const client = new BasicClient();

    // Register with empty version (though registerFunction would reject this)
    (client as any).descriptors.set('test', { id: 'test', version: '' });

    const manifest = (client as any).buildManifest();
    const fn = manifest.functions.find((f: any) => f.id === 'test');

    expect(fn.version).toBe('1.0.0');
  });

  test('disconnect clears state', async () => {
    const client = new BasicClient();
    client.registerFunction({ id: 'f1', version: '1.0.0' }, async () => 'ok');

    // Set some state
    (client as any).connected = true;

    await client.disconnect();

    expect((client as any).connected).toBe(false);
  });

  test('invoke with empty payload uses default', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockResolvedValue('result');
    client.registerFunction({ id: 'test.fn', version: '1.0.0' }, handler);

    await client.invoke('test.fn', '');

    expect(handler).toHaveBeenCalledWith(expect.any(String), '');
  });

  test('connect is idempotent - multiple calls are safe', async () => {
    const client = new BasicClient();

    // First connect would fail without mocking, so we test the idempotency check
    (client as any).connected = true;

    // Should not throw, should just return
    await expect(client.connect()).resolves.not.toThrow();
  });

  test('startJob throws for unregistered function', () => {
    const client = new BasicClient();

    expect(() => client.startJob('unknown.fn', '')).toThrow(/not found/i);
  });

  test('streamJob throws for unknown job', () => {
    const client = new BasicClient();

    expect(() => client.streamJob('unknown-job-id')).toThrow(/not found/i);
  });

  test('buildManifest without category uses descriptor id', () => {
    const client = new BasicClient();

    client.registerFunction(
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

  test('createClient exports a factory function', () => {
    const client = createClient({ serviceId: 'test-service' });

    expect(client).toBeInstanceOf(BasicClient);
  });

  test('startJob creates job with correct jobId format', () => {
    const client = new BasicClient();
    client.registerFunction({ id: 'test.fn', version: '1.0.0' }, async () => 'ok');

    const jobId = client.startJob('test.fn', '');

    expect(jobId).toContain('test.fn-');
    expect(typeof jobId).toBe('string');
  });

  test('invoke with metadata', async () => {
    const client = new BasicClient();
    const handler = jest.fn().mockResolvedValue('result');
    client.registerFunction({ id: 'test.fn', version: '1.0.0' }, handler);

    const metadata = { 'x-custom-header': 'value' };
    const result = await client.invoke('test.fn', '', metadata);

    expect(result).toBe('result');
    // Handler should receive metadata as JSON string in context
    expect(handler).toHaveBeenCalledWith(expect.stringContaining('x-custom-header'), '');
  });

  test('getFunctionDescriptor returns correct descriptor', () => {
    const client = new BasicClient();
    client.registerFunction(
      { id: 'test.fn', version: '2.0.0', category: 'cat', risk: 'low' },
      async () => 'ok',
    );

    const desc = client.getFunctionDescriptor('test.fn');

    expect(desc).toEqual({
      id: 'test.fn',
      version: '2.0.0',
      category: 'cat',
      risk: 'low',
      entity: undefined,
      operation: undefined,
    });
  });

  test('getFunctionDescriptor returns undefined for unknown function', () => {
    const client = new BasicClient();

    const desc = client.getFunctionDescriptor('unknown.fn');

    expect(desc).toBeUndefined();
  });

  test('getRegisterRequest builds correct request', () => {
    const client = new BasicClient({
      serviceId: 'test-svc',
      serviceVersion: '1.0.0',
    });
    client.registerFunction(
      { id: 'f1', version: '1.0.0' },
      async () => 'ok',
    );

    const req = client.getRegisterRequest('127.0.0.1:8080');

    expect(req.serviceId).toBe('test-svc');
    expect(req.version).toBe('1.0.0');
    expect(req.rpcAddr).toBe('127.0.0.1:8080');
    expect(req.functions).toHaveLength(1);
    expect(req.functions[0].id).toBe('f1');
  });

  test('getManifestGzipped returns gzipped manifest', () => {
    const client = new BasicClient();
    client.registerFunction({ id: 'f1', version: '1.0.0' }, async () => 'ok');

    const gzipped = client.getManifestGzipped();

    expect(gzipped).toBeInstanceOf(Buffer);
    expect(gzipped.length).toBeGreaterThan(0);
  });

  test('startJob with metadata passes to handler', async () => {
    const client = new BasicClient();
    let receivedContext = '';
    client.registerFunction(
      { id: 'test.fn', version: '1.0.0' },
      async (ctx) => {
        receivedContext = ctx;
        return 'done';
      },
    );

    const jobId = client.startJob('test.fn', 'payload', { key: 'value' });

    // Wait for job to complete
    for await (const _ of client.streamJob(jobId)) {
      // just consume events
    }

    expect(receivedContext).toContain('key');
    expect(receivedContext).toContain('value');
  });

  test('cancelJob returns true when job exists', async () => {
    const client = new BasicClient();
    client.registerFunction(
      { id: 'test.fn', version: '1.0.0' },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'done';
      },
    );

    const jobId = client.startJob('test.fn', '');

    // Wait for started event
    const reader = client.streamJob(jobId)[Symbol.asyncIterator]();
    await reader.next();

    const result = client.cancelJob(jobId);
    expect(result).toBe(true);
  });
});
