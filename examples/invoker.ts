// Croupier TypeScript SDK - Invoker Example
// Copyright (c) 2025 cuihairu
// Licensed under Apache License 2.0

import { Invoker, ClientConfig } from '../src/index.js';

async function main(): Promise<number> {
  console.log('='.repeat(40));
  console.log('  Croupier TypeScript SDK - Invoker Example');
  console.log('='.repeat(40));

  // Configure invoker
  const config: ClientConfig = {
    agentAddr: '127.0.0.1:19091',
    enableLogging: true,
  };

  // Create invoker
  const invoker = new Invoker(config);

  // Connect
  console.log('\n--- Connecting to Agent ---');

  const connected = await invoker.connect();
  if (!connected) {
    console.log('\n✗ Failed to connect to Agent!');
    console.log('Make sure croupier-agent is running on', config.agentAddr);
    return 1;
  }

  console.log('✓ Connected successfully!');

  // Invoke a function
  console.log('\n--- Invoking Function ---');

  const functionId = 'player.get';
  const payload = 'player123';

  console.log(`Function: ${functionId}`);
  console.log(`Payload: ${payload}`);

  const response = await invoker.invoke(functionId, payload);

  if (response !== null) {
    console.log('✓ Invoke successful!');
    console.log(`Response: ${response}`);

    // Pretty print JSON response
    try {
      const data = JSON.parse(response);
      console.log('\nParsed response:');
      console.log(JSON.stringify(data, null, 2));
    } catch {
      // Not JSON
    }
  } else {
    console.log('✗ Invoke failed!');
  }

  // Disconnect
  console.log('\n--- Disconnecting ---');
  invoker.disconnect();
  console.log('✓ Disconnected!');

  return 0;
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
