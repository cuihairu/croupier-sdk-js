// Croupier TypeScript SDK - Main Entry Point
// Copyright (c) 2025 cuihairu
// Licensed under Apache License 2.0

/**
 * Croupier TypeScript/JavaScript SDK
 *
 * @example
 * ```ts
 * import { CroupierClient } from '@croupier/sdk';
 *
 * const client = new CroupierClient();
 *
 * client.registerFunction('player.get', (context, payload) => {
 *   return '{"player_id": "123", "name": "Player One"}';
 * });
 *
 * await client.connect();
 * await client.serve();
 * ```
 */

// Protocol layer
export * from './protocol/message.js';

// Transport layer
export * from './transport/client.js';
export * from './transport/server.js';

// SDK layer
export * from './sdk/client.js';
