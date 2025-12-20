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
});

