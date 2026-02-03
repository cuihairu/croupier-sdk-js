// Croupier TypeScript SDK - Basic Example
// Copyright (c) 2025 cuihairu
// Licensed under Apache License 2.0

import { CroupierClient, ClientConfig } from '../src/index.js';

async function main(): Promise<number> {
  console.log('='.repeat(40));
  console.log('  Croupier TypeScript SDK - Basic Example');
  console.log('='.repeat(40));

  // Configure client
  const config: ClientConfig = {
    agentAddr: '127.0.0.1:19091',
    serviceId: 'ts-basic-example',
    enableLogging: true,
    debugLogging: true,
  };

  // Create client
  const client = new CroupierClient(config);

  // Register functions
  console.log('\n--- Registering Functions ---');

  client.registerFunction('player.get', (context: string, payload: string) => {
    console.log(`[GetPlayer] Context: ${context}`);
    console.log(`[GetPlayer] Payload: ${payload}`);

    const playerId = payload;
    return JSON.stringify({
      player_id: playerId,
      name: 'Player One',
      level: 42,
      coins: 10000,
    });
  });

  console.log('✓ Registered: player.get');

  client.registerFunction('wallet.transfer', (context: string, payload: string) => {
    console.log(`[Transfer] Context: ${context}`);
    console.log(`[Transfer] Payload: ${payload}`);

    return JSON.stringify({
      status: 'success',
      message: 'Transfer completed',
      new_balance: 9500,
    });
  });

  console.log('✓ Registered: wallet.transfer');

  // Connect to agent
  console.log('\n--- Connecting to Agent ---');
  console.log(`Agent address: ${config.agentAddr}`);

  const connected = await client.connect();
  if (!connected) {
    console.log('\n✗ Failed to connect to Agent!');
    console.log('Make sure croupier-agent is running on', config.agentAddr);
    return 1;
  }

  console.log('✓ Connected successfully!');
  console.log(`  Local address: ${client.getLocalAddress()}`);
  console.log(`  Session ID: ${client.getSessionId()}`);
  console.log(`  Registered functions: ${client.getFunctionCount()}`);

  // Setup shutdown handler
  let shutdown = false;
  process.on('SIGINT', () => {
    if (shutdown) {
      process.exit(0);
    }
    shutdown = true;
    console.log('\n\nShutdown signal received...');
    client.stop();
  });

  // Start serving
  console.log('\n--- Serving Functions (Press Ctrl+C to stop) ---');
  console.log('='.repeat(40));

  try {
    await client.serve();
  } catch (error) {
    console.error('Serve error:', error);
  }

  // Cleanup
  console.log('\n--- Stopping ---');
  client.disconnect();
  console.log('✓ Stopped successfully!');

  return 0;
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
