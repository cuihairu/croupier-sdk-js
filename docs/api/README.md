# API 参考

## ClientConfig

```typescript
interface ClientConfig {
  agentAddr: string;
  gameId: string;
  env?: string;
  serviceId?: string;
  insecure?: boolean;
  timeout?: number;
}
```

## CroupierClient

```typescript
class CroupierClient {
  constructor(config: ClientConfig);

  registerFunction(
    descriptor: FunctionDescriptor,
    handler: FunctionHandler
  ): void;

  connect(): Promise<void>;
  serve(): Promise<void>;
  close(): Promise<void>;
}
```

## FunctionDescriptor

```typescript
interface FunctionDescriptor {
  id: string;
  version: string;
  name?: string;
  description?: string;
}
```

## FunctionHandler

```typescript
type FunctionHandler = (
  context: CallContext,
  payload: unknown
) => Promise<unknown> | unknown;
```
