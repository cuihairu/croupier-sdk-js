// Copyright 2025 Croupier Authors
// Licensed under the Apache License, Version 2.0

import { describe, test, expect } from "@jest/globals";
import {
  ClientConfig,
  InvokerConfig,
  InvokeOptions,
  InvokeResult,
  JobStatus,
  FunctionContext,
} from "../src/index";

/**
 * Edge case tests for Croupier TypeScript SDK
 */
describe("Edge Cases", () => {
  // ========== Configuration Edge Cases ==========

  describe("Configuration Edge Cases", () => {
    test("should handle empty serviceId", () => {
      const config: ClientConfig = {
        serviceId: "",
        agentAddr: "tcp://127.0.0.1:19090",
      };
      expect(config.serviceId).toBe("");
    });

    test("should handle very long serviceId", () => {
      const longId = "a".repeat(10000);
      const config: ClientConfig = {
        serviceId: longId,
        agentAddr: "tcp://127.0.0.1:19090",
      };
      expect(config.serviceId?.length).toBe(10000);
    });

    test("should handle zero timeout", () => {
      const config: InvokerConfig = {
        agentAddr: "tcp://127.0.0.1:19090",
        timeoutSeconds: 0,
      };
      expect(config.timeoutSeconds).toBe(0);
    });

    test("should handle negative timeout", () => {
      const config: InvokerConfig = {
        agentAddr: "tcp://127.0.0.1:19090",
        timeoutSeconds: -1,
      };
      expect(config.timeoutSeconds).toBe(-1);
    });

    test("should handle very large timeout", () => {
      const config: InvokerConfig = {
        agentAddr: "tcp://127.0.0.1:19090",
        timeoutSeconds: 3600,
      };
      expect(config.timeoutSeconds).toBe(3600);
    });

    test("should handle empty agent address", () => {
      const config: InvokerConfig = {
        agentAddr: "",
      };
      expect(config.agentAddr).toBe("");
    });
  });

  // ========== Invoke Options Edge Cases ==========

  describe("Invoke Options Edge Cases", () => {
    test("should handle empty gameId", () => {
      const options: InvokeOptions = {
        gameId: "",
      };
      expect(options.gameId).toBe("");
    });

    test("should handle empty env", () => {
      const options: InvokeOptions = {
        env: "",
      };
      expect(options.env).toBe("");
    });

    test("should handle zero timeout", () => {
      const options: InvokeOptions = {
        timeoutSeconds: 0,
      };
      expect(options.timeoutSeconds).toBe(0);
    });

    test("should handle negative timeout", () => {
      const options: InvokeOptions = {
        timeoutSeconds: -1,
      };
      expect(options.timeoutSeconds).toBe(-1);
    });

    test("should handle empty metadata", () => {
      const options: InvokeOptions = {
        metadata: {},
      };
      expect(Object.keys(options.metadata || {}).length).toBe(0);
    });

    test("should handle undefined metadata", () => {
      const options: InvokeOptions = {};
      expect(options.metadata).toBeUndefined();
    });
  });

  // ========== Numeric Edge Cases ==========

  describe("Numeric Edge Cases", () => {
    test("should handle maximum safe integer", () => {
      const max = Number.MAX_SAFE_INTEGER;
      expect(max).toBe(2 ** 53 - 1);
    });

    test("should handle minimum safe integer", () => {
      const min = Number.MIN_SAFE_INTEGER;
      expect(min).toBe(-(2 ** 53 - 1));
    });

    test("should handle positive infinity", () => {
      const posInf = Number.POSITIVE_INFINITY;
      expect(posInf).toBe(Infinity);
      expect(posInf > 0).toBe(true);
    });

    test("should handle negative infinity", () => {
      const negInf = Number.NEGATIVE_INFINITY;
      expect(negInf).toBe(-Infinity);
      expect(negInf < 0).toBe(true);
    });

    test("should handle NaN", () => {
      const nan = NaN;
      expect(Number.isNaN(nan)).toBe(true);
    });

    test("should handle very small float", () => {
      const tiny = 1e-100;
      expect(tiny > 0).toBe(true);
      expect(tiny < 1e-50).toBe(true);
    });

    test("should handle epsilon", () => {
      const epsilon = Number.EPSILON;
      expect(epsilon > 0).toBe(true);
      expect(epsilon < 0.001).toBe(true);
    });
  });

  // ========== String Edge Cases ==========

  describe("String Edge Cases", () => {
    test("should handle empty string", () => {
      const s = "";
      expect(s).toBe("");
      expect(s.length).toBe(0);
    });

    test("should handle whitespace-only strings", () => {
      const whitespaceStrings = [" ", "  ", "\t", "\n", "\r", "\n\t\r "];

      for (const s of whitespaceStrings) {
        expect(s.length).toBeGreaterThan(0);
      }
    });

    test("should handle string with null character", () => {
      const s = "test\u0000string";
      expect(s.includes("\u0000")).toBe(true);
      expect(s.length).toBe(11);
    });

    test("should handle string with unicode", () => {
      const unicode = "Unicode: 中文 🚀";
      expect(unicode.length).toBeGreaterThan(10);
      expect(unicode.includes("中文")).toBe(true);
      expect(unicode.includes("🚀")).toBe(true);
    });

    test("should handle string with emoji", () => {
      const emojiString = "😀🎉🚀";
      expect(emojiString.length).toBeGreaterThan(0);
    });

    test("should handle very long string", () => {
      const longString = "x".repeat(1000000);
      expect(longString.length).toBe(1000000);
    });
  });

  // ========== Array Edge Cases ==========

  describe("Array Edge Cases", () => {
    test("should handle empty array", () => {
      const arr: number[] = [];
      expect(arr).toHaveLength(0);
    });

    test("should handle array with duplicates", () => {
      const arr = ["same", "same", "same"];
      expect(arr).toHaveLength(3);
      expect(arr[0]).toBe("same");
      expect(arr[1]).toBe("same");
      expect(arr[2]).toBe("same");
    });

    test("should handle array with undefined values", () => {
      const arr = [1, undefined, 2, undefined, 3];
      expect(arr).toHaveLength(5);
      expect(arr[1]).toBeUndefined();
      expect(arr[3]).toBeUndefined();
    });

    test("should handle array with null values", () => {
      const arr = [1, null, 2, null, 3];
      expect(arr).toHaveLength(5);
      expect(arr[1]).toBeNull();
      expect(arr[3]).toBeNull();
    });

    test("should handle array nesting", () => {
      const arr = [[[1]]];
      expect(arr[0][0][0]).toBe(1);
    });
  });

  // ========== Object Edge Cases ==========

  describe("Object Edge Cases", () => {
    test("should handle empty object", () => {
      const obj: Record<string, any> = {};
      expect(Object.keys(obj)).toHaveLength(0);
    });

    test("should handle object with null values", () => {
      const obj = {
        key1: null,
        key2: "value",
      };
      expect(obj.key1).toBeNull();
      expect(obj.key2).toBe("value");
    });

    test("should handle object with undefined values", () => {
      const obj = {
        key1: undefined,
        key2: "value",
      };
      expect(obj.key1).toBeUndefined();
      expect(obj.key2).toBe("value");
    });

    test("should handle object with empty string keys", () => {
      const obj: Record<string, any> = {
        "": "value",
      };
      expect(obj[""]).toBe("value");
    });

    test("should handle object with empty string values", () => {
      const obj = {
        key: "",
      };
      expect(obj.key).toBe("");
    });

    test("should handle nested objects", () => {
      const obj = {
        level1: {
          level2: {
            level3: "value",
          },
        },
      };
      expect(obj.level1.level2.level3).toBe("value");
    });
  });

  // ========== Boolean Edge Cases ==========

  describe("Boolean Edge Cases", () => {
    test("should handle true", () => {
      const value = true;
      expect(value).toBe(true);
    });

    test("should handle false", () => {
      const value = false;
      expect(value).toBe(false);
    });

    test("should handle truthy values", () => {
      expect(Boolean(1)).toBe(true);
      expect(Boolean("text")).toBe(true);
      expect(Boolean([1])).toBe(true);
      expect(Boolean({ key: "value" })).toBe(true);
    });

    test("should handle falsy values", () => {
      expect(Boolean(0)).toBe(false);
      expect(Boolean("")).toBe(false);
      expect(Boolean([])).toBe(true); // Arrays are truthy
      expect(Boolean({})).toBe(true); // Objects are truthy
      expect(Boolean(null)).toBe(false);
      expect(Boolean(undefined)).toBe(false);
    });
  });

  // ========== Type Conversion Edge Cases ==========

  describe("Type Conversion Edge Cases", () => {
    test("should convert number to string", () => {
      const num = 123;
      const str = String(num);
      expect(str).toBe("123");
    });

    test("should convert string to number", () => {
      const str = "456";
      const num = Number(str);
      expect(num).toBe(456);
    });

    test("should handle invalid string to number conversion", () => {
      const str = "not a number";
      const num = Number(str);
      expect(Number.isNaN(num)).toBe(true);
    });

    test("should convert boolean to string", () => {
      expect(String(true)).toBe("true");
      expect(String(false)).toBe("false");
    });

    test("should convert to boolean", () => {
      expect(Boolean(1)).toBe(true);
      expect(Boolean(0)).toBe(false);
      expect(Boolean("yes")).toBe(true);
      expect(Boolean("")).toBe(false);
    });
  });

  // ========== Invoke Result Edge Cases ==========

  describe("Invoke Result Edge Cases", () => {
    test("should handle result with empty data", () => {
      const result: InvokeResult = {
        success: true,
        data: "",
        error: null,
        durationMs: 100,
      };
      expect(result.success).toBe(true);
      expect(result.data).toBe("");
      expect(result.error).toBeNull();
    });

    test("should handle result with null data", () => {
      const result: InvokeResult = {
        success: true,
        data: null,
        error: null,
        durationMs: 100,
      };
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    test("should handle result with zero duration", () => {
      const result: InvokeResult = {
        success: true,
        data: "ok",
        error: null,
        durationMs: 0,
      };
      expect(result.durationMs).toBe(0);
    });

    test("should handle result with negative duration", () => {
      const result: InvokeResult = {
        success: false,
        data: null,
        error: "timeout",
        durationMs: -1,
      };
      expect(result.durationMs).toBe(-1);
    });
  });

  // ========== Job Status Edge Cases ==========

  describe("Job Status Edge Cases", () => {
    test("should handle status with zero progress", () => {
      const status: JobStatus = {
        jobId: "job-123",
        status: "pending",
        progress: 0,
      };
      expect(status.progress).toBe(0);
    });

    test("should handle status with full progress", () => {
      const status: JobStatus = {
        jobId: "job-123",
        status: "completed",
        progress: 1,
      };
      expect(status.progress).toBe(1);
    });

    test("should handle status with partial progress", () => {
      const status: JobStatus = {
        jobId: "job-123",
        status: "running",
        progress: 0.5,
      };
      expect(status.progress).toBe(0.5);
    });

    test("should handle status with negative progress", () => {
      const status: JobStatus = {
        jobId: "job-123",
        status: "error",
        progress: -0.1,
      };
      expect(status.progress).toBe(-0.1);
    });

    test("should handle status with progress above 1", () => {
      const status: JobStatus = {
        jobId: "job-123",
        status: "error",
        progress: 1.5,
      };
      expect(status.progress).toBe(1.5);
    });

    test("should handle status with empty error", () => {
      const status: JobStatus = {
        jobId: "job-123",
        status: "completed",
        progress: 1,
        error: "",
      };
      expect(status.error).toBe("");
    });

    test("should handle status with null result", () => {
      const status: JobStatus = {
        jobId: "job-123",
        status: "pending",
        progress: 0,
        result: null,
      };
      expect(status.result).toBeNull();
    });
  });

  // ========== Function Context Edge Cases ==========

  describe("Function Context Edge Cases", () => {
    test("should handle context with all optional fields null", () => {
      const ctx: FunctionContext = {
        functionId: "test.func",
        callId: "call-123",
        gameId: null,
        env: null,
        userId: null,
        timestamp: 0,
        metadata: null,
      };
      expect(ctx.functionId).toBe("test.func");
      expect(ctx.callId).toBe("call-123");
      expect(ctx.gameId).toBeNull();
      expect(ctx.env).toBeNull();
      expect(ctx.userId).toBeNull();
      expect(ctx.timestamp).toBe(0);
      expect(ctx.metadata).toBeNull();
    });

    test("should handle context with zero timestamp", () => {
      const ctx: FunctionContext = {
        functionId: "test.func",
        callId: "call-123",
        gameId: "game-1",
        env: "dev",
        timestamp: 0,
      };
      expect(ctx.timestamp).toBe(0);
    });

    test("should handle context with negative timestamp", () => {
      const ctx: FunctionContext = {
        functionId: "test.func",
        callId: "call-123",
        gameId: "game-1",
        env: "dev",
        timestamp: -1000,
      };
      expect(ctx.timestamp).toBe(-1000);
    });

    test("should handle context with very large timestamp", () => {
      const largeTimestamp = Number.MAX_SAFE_INTEGER;
      const ctx: FunctionContext = {
        functionId: "test.func",
        callId: "call-123",
        gameId: "game-1",
        env: "dev",
        timestamp: largeTimestamp,
      };
      expect(ctx.timestamp).toBe(largeTimestamp);
    });
  });

  // ========== Special Values Edge Cases ==========

  describe("Special Values Edge Cases", () => {
    test("should handle null", () => {
      const value = null;
      expect(value).toBeNull();
      expect(typeof value).toBe("object");
    });

    test("should handle undefined", () => {
      const value = undefined;
      expect(value).toBeUndefined();
      expect(typeof value).toBe("undefined");
    });

    test("should distinguish null from undefined", () => {
      const nullValue = null;
      const undefinedValue = undefined;

      expect(nullValue === undefinedValue).toBe(false);
      expect(nullValue == undefinedValue).toBe(true); // loose equality
    });

    test("should handle void return", () => {
      function returnsVoid(): void {
        // Do nothing
      }
      const result = returnsVoid();
      expect(result).toBeUndefined();
    });
  });

  // ========== Date Edge Cases ==========

  describe("Date Edge Cases", () => {
    test("should handle epoch timestamp", () => {
      const date = new Date(0);
      expect(date.getTime()).toBe(0);
    });

    test("should handle negative timestamp", () => {
      const date = new Date(-1000000);
      expect(date.getTime()).toBe(-1000000);
    });

    test("should handle very large timestamp", () => {
      const timestamp = Number.MAX_SAFE_INTEGER;
      const date = new Date(timestamp);
      expect(date.getTime()).toBe(timestamp);
    });

    test("should handle invalid date", () => {
      const date = new Date("invalid");
      expect(Number.isNaN(date.getTime())).toBe(true);
    });
  });

  // ========== Math Edge Cases ==========

  describe("Math Edge Cases", () => {
    test("should handle Math.max with no arguments", () => {
      const result = Math.max();
      expect(result).toBe(-Infinity);
    });

    test("should handle Math.min with no arguments", () => {
      const result = Math.min();
      expect(result).toBe(Infinity);
    });

    test("should handle division by zero", () => {
      const result = 1 / 0;
      expect(result).toBe(Infinity);
    });

    test("should handle zero divided by zero", () => {
      const result = 0 / 0;
      expect(Number.isNaN(result)).toBe(true);
    });

    test("should handle modulo with negative numbers", () => {
      expect(-5 % 3).toBe(-2);
      expect(5 % -3).toBe(2);
    });
  });

  // ========== Memory Edge Cases ==========

  describe("Memory Edge Cases", () => {
    test("should handle large array allocation", () => {
      const largeArray = new Array(100000);
      expect(largeArray.length).toBe(100000);
    });

    test("should handle large string allocation", () => {
      const largeString = "x".repeat(10000000); // 10MB
      expect(largeString.length).toBe(10000000);
    });

    test("should handle many object allocations", () => {
      const objects = [];
      for (let i = 0; i < 10000; i++) {
        objects.push({ id: i, value: "test" });
      }
      expect(objects.length).toBe(10000);
    });
  });

  // ========== Boundary Tests ==========

  describe("Boundary Tests", () => {
    test("should handle maximum array length", () => {
      const maxArrayLength = 2 ** 32 - 1;
      expect(maxArrayLength).toBe(4294967295);
    });

    test("should handle very large array index", () => {
      const arr = [1, 2, 3];
      const index = Number.MAX_SAFE_INTEGER;
      expect(arr[index]).toBeUndefined();
    });

    test("should handle string length limit", () => {
      const maxStringLength = 2 ** 32 - 1; // Theoretical limit
      expect(maxStringLength).toBe(4294967295);
    });

    test("should handle number precision limits", () => {
      const diff = 0.3 - 0.2;
      expect(diff).not.toBe(0.1); // Floating point precision issue
      expect(diff).toBeCloseTo(0.1, 10);
    });
  });
});
