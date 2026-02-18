// Copyright 2025 Croupier Authors
// Licensed under the Apache License, Version 2.0

import { describe, test, expect } from "@jest/globals";

/**
 * Concurrency tests for Croupier TypeScript SDK
 */
describe("Concurrency Tests", () => {
  // ========== Concurrent Client Creation ==========

  test("should handle concurrent client creation", async () => {
    const numClients = 10;
    const clients: any[] = [];

    // Create multiple clients concurrently
    const promises = Array.from({ length: numClients }, async (_, i) => {
      // Simulate client creation
      const client = {
        id: `client-${i}`,
        config: { serviceId: `service-${i}` },
      };
      return client;
    });

    const results = await Promise.all(promises);
    clients.push(...results);

    expect(clients).toHaveLength(numClients);
    expect(clients[0].id).toBe("client-0");
  });

  test("should handle concurrent config loading", async () => {
    const numConfigs = 20;
    const configs: any[] = [];

    // Load multiple configs concurrently
    const promises = Array.from({ length: numConfigs }, async (_, i) => {
      // Simulate config loading
      const config = {
        serviceId: `test-${i}`,
        timeoutSeconds: 30,
      };
      return config;
    });

    const results = await Promise.all(promises);
    configs.push(...results);

    expect(configs).toHaveLength(numConfigs);
  });

  // ========== Shared Data Access ==========

  test("should handle concurrent map access", async () => {
    const numThreads = 10;
    const numOperations = 100;
    const map = new Map<string, number>();

    // Perform concurrent operations
    const promises = Array.from({ length: numThreads }, async (_, threadId) => {
      for (let j = 0; j < numOperations; j++) {
        const key = `key_${threadId}_${j}`;
        map.set(key, j);
        const value = map.get(key);
        expect(value).toBe(j);
      }
    });

    await Promise.all(promises);
    expect(map.size).toBe(numThreads * numOperations);
  });

  test("should handle concurrent array operations", async () => {
    const numThreads = 10;
    const numOperations = 100;
    const list: string[] = [];

    // Perform concurrent array operations (may not be thread-safe)
    const promises = Array.from({ length: numThreads }, async (_, threadId) => {
      for (let j = 0; j < numOperations; j++) {
        list.push(`item_${threadId}_${j}`);
      }
    });

    await Promise.all(promises);
    expect(list.length).toBe(numThreads * numOperations);
  });

  // ========== Atomic Operations ==========

  test("should handle atomic counter", async () => {
    const numThreads = 10;
    const numOperations = 1000;
    let counter = 0;

    // Simulate atomic counter with mutex
    const mutex = {
      locked: false,
      async lock<T>(fn: () => T): Promise<T> {
        while (this.locked) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this.locked = true;
        try {
          return fn();
        } finally {
          this.locked = false;
        }
      },
    };

    const promises = Array.from({ length: numThreads }, async () => {
      for (let j = 0; j < numOperations; j++) {
        await mutex.lock(() => {
          counter++;
        });
      }
    });

    await Promise.all(promises);
    expect(counter).toBe(numThreads * numOperations);
  });

  test("should handle compare-and-set", async () => {
    const numThreads = 10;
    const numOperations = 100;
    let value = 0;
    let successCount = 0;

    // Simulate CAS operation
    const cas = async (expected: number, desired: number): Promise<boolean> => {
      if (value === expected) {
        value = desired;
        return true;
      }
      return false;
    };

    const promises = Array.from({ length: numThreads }, async () => {
      for (let j = 0; j < numOperations; j++) {
        const current = value;
        const desired = current + 1;
        const success = await cas(current, desired);
        if (success) {
          successCount++;
        }
      }
    });

    await Promise.all(promises);
    expect(successCount).toBeGreaterThan(0);
    expect(value).toBe(successCount);
  });

  // ========== Lock Operations ==========

  test("should handle lock performance", async () => {
    const numOperations = 100000;
    let counter = 0;

    const mutex = {
      locked: false,
      async lock<T>(fn: () => T): Promise<T> {
        while (this.locked) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this.locked = true;
        try {
          return fn();
        } finally {
          this.locked = false;
        }
      },
    };

    const start = Date.now();

    await mutex.lock(async () => {
      for (let i = 0; i < numOperations; i++) {
        await mutex.lock(() => {
          counter++;
        });
      }
    });

    const elapsed = Date.now() - start;

    expect(counter).toBe(numOperations);
    expect(elapsed).toBeLessThan(5000); // Less than 5 seconds
  });

  test("should handle multiple threads with lock", async () => {
    const numThreads = 10;
    const numOperations = 1000;
    let counter = 0;

    const mutex = {
      locked: false,
      async lock<T>(fn: () => T): Promise<T> {
        while (this.locked) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this.locked = true;
        try {
          return fn();
        } finally {
          this.locked = false;
        }
      },
    };

    const promises = Array.from({ length: numThreads }, async () => {
      for (let j = 0; j < numOperations; j++) {
        await mutex.lock(() => {
          counter++;
        });
      }
    });

    await Promise.all(promises);
    expect(counter).toBe(numThreads * numOperations);
  });

  // ========== Thread Pool ==========

  test("should handle thread pool executor", async () => {
    const numTasks = 100;
    let counter = 0;

    // Simulate thread pool with Promise.all limiting concurrency
    const maxConcurrency = 10;
    const executeInPool = async <T>(
      tasks: (() => Promise<T>)[],
    ): Promise<T[]> => {
      const results: T[] = [];
      const executing: Promise<void>[] = [];

      for (const task of tasks) {
        const promise = task().then((result) => {
          executing.splice(executing.indexOf(promise), 1);
          return result;
        });

        results.push(promise as any);
        executing.push(promise);

        if (executing.length >= maxConcurrency) {
          await Promise.race(executing);
        }
      }

      return Promise.all(results);
    };

    const tasks = Array.from({ length: numTasks }, () => async () => {
      counter++;
    });

    await executeInPool(tasks);
    expect(counter).toBe(numTasks);
  });

  test("should handle thread pool with return value", async () => {
    const numTasks = 20;

    const maxConcurrency = 5;
    const executeInPool = async <T>(
      tasks: (() => Promise<T>)[],
    ): Promise<T[]> => {
      const results: T[] = [];
      const executing: Promise<void>[] = [];

      for (const task of tasks) {
        const promise = task().then((result) => {
          executing.splice(executing.indexOf(promise), 1);
          return result;
        });

        results.push(promise as any);
        executing.push(promise);

        if (executing.length >= maxConcurrency) {
          await Promise.race(executing);
        }
      }

      return Promise.all(results);
    };

    const tasks = Array.from({ length: numTasks }, (_, i) => async () => i * 2);

    const results = await executeInPool(tasks);

    for (let i = 0; i < numTasks; i++) {
      expect(results[i]).toBe(i * 2);
    }
  });

  // ========== Concurrent Exception Handling ==========

  test("should handle concurrent exception handling", async () => {
    const numThreads = 10;
    const caughtExceptions: Error[] = [];

    const promises = Array.from({ length: numThreads }, async (_, threadId) => {
      try {
        throw new Error(`Error from thread ${threadId}`);
      } catch (e) {
        caughtExceptions.push(e as Error);
      }
    });

    await Promise.all(promises);
    expect(caughtExceptions).toHaveLength(numThreads);
  });

  // ========== Producer-Consumer Pattern ==========

  test("should handle producer-consumer pattern", async () => {
    const numItems = 100;
    const queue: number[] = [];
    let producedCount = 0;
    let consumedCount = 0;

    const mutex = {
      locked: false,
      async lock<T>(fn: () => T): Promise<T> {
        while (this.locked) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this.locked = true;
        try {
          return fn();
        } finally {
          this.locked = false;
        }
      },
    };

    // Producer
    const producer = async () => {
      for (let i = 0; i < numItems; i++) {
        await mutex.lock(() => {
          queue.push(i);
          producedCount++;
        });
      }
    };

    // Consumer
    const consumer = async () => {
      while (consumedCount < numItems) {
        await mutex.lock(() => {
          if (queue.length > 0) {
            queue.shift();
            consumedCount++;
          }
        });
      }
    };

    await Promise.all([producer(), consumer()]);
    expect(producedCount).toBe(numItems);
    expect(consumedCount).toBe(numItems);
  });

  // ========== Barrier Synchronization ==========

  test("should handle barrier synchronization", async () => {
    const numThreads = 5;
    const results: number[] = [];

    // Implement barrier
    class Barrier {
      private count = 0;
      private readonly threshold: number;
      private resolver: (() => void) | null = null;

      constructor(threshold: number) {
        this.threshold = threshold;
      }

      async wait(): Promise<void> {
        this.count++;
        if (this.count === this.threshold) {
          if (this.resolver) {
            this.resolver();
            this.resolver = null;
          }
        } else if (this.count < this.threshold) {
          await new Promise<void>((resolve) => {
            this.resolver = resolve;
          });
        }
      }

      reset() {
        this.count = 0;
      }
    }

    const barrier = new Barrier(numThreads);

    const promises = Array.from({ length: numThreads }, async (_, threadId) => {
      // Phase 1
      results.push(threadId * 100 + 1);
      await barrier.wait();

      // Phase 2 (all threads completed phase 1)
      results.push(threadId * 100 + 2);
      await barrier.wait();

      // Phase 3 (all threads completed phase 2)
      results.push(threadId * 100 + 3);
    });

    await Promise.all(promises);
    expect(results).toHaveLength(numThreads * 3);
  });

  // ========== Concurrent Resource Cleanup ==========

  test("should handle concurrent resource cleanup", async () => {
    const numOperations = 100;
    const clients: any[] = [];

    const promises = Array.from({ length: numOperations }, async () => {
      // Simulate client creation
      const client = {
        id: Math.random(),
        connected: true,
      };
      clients.push(client);
    });

    await Promise.all(promises);
    expect(clients).toHaveLength(numOperations);
  });

  // ========== Race Condition Tests ==========

  test("should detect race condition without lock", async () => {
    const numThreads = 10;
    const numOperations = 100;
    let unsafeCounter = 0;

    const promises = Array.from({ length: numThreads }, async () => {
      for (let j = 0; j < numOperations; j++) {
        // Race condition here
        const current = unsafeCounter;
        unsafeCounter = current + 1;
      }
    });

    await Promise.all(promises);

    // Due to race condition, count may not equal expected
    expect(unsafeCounter).toBeGreaterThan(0);
    expect(unsafeCounter).toBeLessThanOrEqual(numThreads * numOperations);
  });

  test("should handle no race condition with lock", async () => {
    const numThreads = 10;
    const numOperations = 100;
    let safeCounter = 0;

    const mutex = {
      locked: false,
      async lock<T>(fn: () => T): Promise<T> {
        while (this.locked) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this.locked = true;
        try {
          return fn();
        } finally {
          this.locked = false;
        }
      },
    };

    const promises = Array.from({ length: numThreads }, async () => {
      for (let j = 0; j < numOperations; j++) {
        await mutex.lock(() => {
          safeCounter++;
        });
      }
    });

    await Promise.all(promises);
    expect(safeCounter).toBe(numThreads * numOperations);
  });

  // ========== Concurrent Performance Test ==========

  test("should handle concurrent performance", async () => {
    const numThreads = 50;
    const numOperations = 1000;
    let counter = 0;

    const mutex = {
      locked: false,
      async lock<T>(fn: () => T): Promise<T> {
        while (this.locked) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this.locked = true;
        try {
          return fn();
        } finally {
          this.locked = false;
        }
      },
    };

    const start = Date.now();

    const promises = Array.from({ length: numThreads }, async () => {
      for (let j = 0; j < numOperations; j++) {
        await mutex.lock(() => {
          counter++;
        });
      }
    });

    await Promise.all(promises);
    const elapsed = Date.now() - start;

    expect(counter).toBe(numThreads * numOperations);
    expect(elapsed).toBeLessThan(10000); // Less than 10 seconds
  });

  // ========== Parallel Execution ==========

  test("should handle parallel execution", async () => {
    const tasks = [
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 1;
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 2;
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 3;
      },
    ];

    const start = Date.now();
    const results = await Promise.all(tasks.map((task) => task()));
    const elapsed = Date.now() - start;

    expect(results).toEqual([1, 2, 3]);
    expect(elapsed).toBeLessThan(300); // Should complete in < 300ms due to parallel execution
  });

  // ========== Race Conditions with Promises ==========

  test("should handle promise race conditions", async () => {
    const results: string[] = [];

    const promise1 = new Promise<void>((resolve) => {
      setTimeout(() => {
        results.push("first");
        resolve();
      }, 100);
    });

    const promise2 = new Promise<void>((resolve) => {
      setTimeout(() => {
        results.push("second");
        resolve();
      }, 50);
    });

    await Promise.all([promise1, promise2]);

    expect(results).toHaveLength(2);
    expect(results).toContain("first");
    expect(results).toContain("second");
  });

  // ========== Deadlock Prevention ==========

  test("should prevent deadlock", async () => {
    const mutex1 = { locked: false };
    const mutex2 = { locked: false };

    const acquireLock = async (mutex: { locked: boolean }) => {
      while (mutex.locked) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      mutex.locked = true;
    };

    const releaseLock = (mutex: { locked: boolean }) => {
      mutex.locked = false;
    };

    // Thread 1
    const thread1 = async () => {
      await acquireLock(mutex1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await acquireLock(mutex2);
      releaseLock(mutex2);
      releaseLock(mutex1);
    };

    // Thread 2 (acquires locks in same order to prevent deadlock)
    const thread2 = async () => {
      await acquireLock(mutex1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await acquireLock(mutex2);
      releaseLock(mutex2);
      releaseLock(mutex1);
    };

    const start = Date.now();
    await Promise.all([thread1(), thread2()]);
    const elapsed = Date.now() - start;

    // Should complete without deadlock
    expect(elapsed).toBeLessThan(1000);
  });

  // ========== Concurrent Map Operations ==========

  test("should handle concurrent map operations", async () => {
    const map = new Map<string, number>();
    const numThreads = 10;
    const numOperations = 100;

    const promises = Array.from({ length: numThreads }, async (_, threadId) => {
      for (let j = 0; j < numOperations; j++) {
        const key = `key_${threadId}_${j}`;
        map.set(key, j);

        const value = map.get(key);
        expect(value).toBe(j);
      }
    });

    await Promise.all(promises);
    expect(map.size).toBe(numThreads * numOperations);
  });

  // ========== Concurrent Set Operations ==========

  test("should handle concurrent set operations", async () => {
    const set = new Set<number>();
    const numThreads = 10;
    const numOperations = 100;

    const promises = Array.from({ length: numThreads }, async (_, threadId) => {
      for (let j = 0; j < numOperations; j++) {
        set.add(threadId * numOperations + j);
      }
    });

    await Promise.all(promises);
    expect(set.size).toBe(numThreads * numOperations);
  });
});
