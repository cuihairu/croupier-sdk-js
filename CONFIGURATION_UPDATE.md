# JavaScript SDK 配置项补充总结

## ✅ 完成的工作

已成功为 JavaScript SDK 补充了 **10 个配置项**，使其与 Java 和 C++ SDK 对齐。

## 新增配置项

### 1. 游戏上下文 (Game Context)

```typescript
gameId?: string;      // 游戏标识符
env?: string;          // 环境标识（默认: 'production'）
```

**用途：** 标识服务所属的游戏和运行环境

**示例：**
```typescript
const client = new CroupierClient({
  gameId: 'game-123',
  env: 'staging'
});
```

### 2. TLS 配置 (TLS Configuration)

```typescript
insecure?: boolean;   // 是否禁用 TLS 验证（默认: false）
certFile?: string;     // 客户端证书文件路径
keyFile?: string;      // 客户端私钥文件路径
caFile?: string;       // CA 证书文件路径
```

**用途：** 配置安全传输层

**示例：**
```typescript
const client = new CroupierClient({
  certFile: '/path/to/client.crt',
  keyFile: '/path/to/client.key',
  caFile: '/path/to/ca.crt'
});

// 或用于开发环境（不推荐用于生产）：
const client = new CroupierClient({
  insecure: true  // 跳过 TLS 验证
});
```

### 3. 认证配置 (Authentication)

```typescript
authToken?: string;                    // Bearer token
headers?: Record<string, string>;      // 自定义 HTTP 头
```

**用途：** 支持自定义认证机制

**示例：**
```typescript
const client = new CroupierClient({
  authToken: 'Bearer my-secret-token',
  headers: {
    'X-Custom-Header': 'value',
    'X-Api-Key': 'api-key-123'
  }
});
```

### 4. 重连配置 (Reconnection)

```typescript
autoReconnect?: boolean;       // 是否自动重连（默认: true）
reconnectInterval?: number;   // 重连间隔毫秒（默认: 5000）
```

**用途：** 配置断线重连行为

**示例：**
```typescript
const client = new CroupierClient({
  autoReconnect: true,
  reconnectInterval: 10000  // 10 秒后重连
});
```

### 5. 文件传输配置 (File Transfer)

```typescript
enableFileTransfer?: boolean;  // 启用文件传输（默认: false）
maxFileSize?: number;          // 最大文件大小（默认: 10485760 = 10MB）
```

**用途：** 控制文件传输功能

**示例：**
```typescript
const client = new CroupierClient({
  enableFileTransfer: true,
  maxFileSize: 52428800  // 50 MB
});
```

## 完整的 ClientConfig 接口

```typescript
export interface ClientConfig {
  // === Connection ===
  agentAddr?: string;           // Agent 地址（默认: 'tcp://127.0.0.1:19090'）
  timeout?: number;             // 超时时间毫秒（默认: 30000）

  // === Service Identity ===
  serviceId?: string;           // 服务 ID（默认: 自动生成 UUID）
  serviceVersion?: string;      // 服务版本（默认: '1.0.0'）

  // === Game Context ===
  gameId?: string;              // 游戏标识符（默认: ''）
  env?: string;                 // 环境标识（默认: 'production'）

  // === Heartbeat ===
  heartbeatIntervalSeconds?: number;  // 心跳间隔秒数（默认: 60）

  // === Provider Info ===
  providerLang?: string;        // 提供者语言（默认: 'node'）
  providerSdk?: string;         // 提供者 SDK（默认: 'croupier-js-sdk'）

  // === TLS Configuration ===
  insecure?: boolean;           // 禁用 TLS 验证（默认: false）
  certFile?: string;            // 客户端证书路径
  keyFile?: string;             // 客户端私钥路径
  caFile?: string;              // CA 证书路径

  // === Authentication ===
  authToken?: string;           // Bearer token
  headers?: Record<string, string>;  // 自定义 HTTP 头

  // === Reconnection ===
  autoReconnect?: boolean;      // 自动重连（默认: true）
  reconnectInterval?: number;   // 重连间隔毫秒（默认: 5000）

  // === File Transfer ===
  enableFileTransfer?: boolean;  // 启用文件传输（默认: false）
  maxFileSize?: number;         // 最大文件大小（默认: 10485760）
}
```

## 注册请求更新

`getRegisterRequest()` 方法现在包含所有新配置项：

```typescript
{
  serviceId: string;
  version: string;
  rpcAddr: string;

  // 新增字段
  gameId?: string;
  env: string;
  insecure: boolean;
  certFile?: string;
  keyFile?: string;
  caFile?: string;
  authToken?: string;
  headers?: Record<string, string>;
  autoReconnect: boolean;
  reconnectInterval: number;
  enableFileTransfer: boolean;
  maxFileSize: number;

  functions: FunctionDescriptor[];
}
```

## 测试结果

✅ **所有测试通过** (132 个测试)

```bash
Test Suites: 4 passed, 4 total
Tests:       132 passed, 132 total
Time:        1.467 s
```

测试覆盖：
- ✅ 基本客户端功能
- ✅ 函数注册和调用
- ✅ 作业管理
- ✅ NNG 传输层
- ✅ 线程/调度器

## 配置项使用示例

### 开发环境配置

```typescript
const devClient = new CroupierClient({
  agentAddr: 'tcp://localhost:19090',
  env: 'development',
  insecure: true,  // 跳过 TLS 验证
  autoReconnect: true,
  reconnectInterval: 2000,
});
```

### 生产环境配置

```typescript
const prodClient = new CroupierClient({
  agentAddr: 'tcp://prod-agent.example.com:19090',
  gameId: 'my-game-prod',
  env: 'production',

  // TLS 配置
  certFile: '/etc/ssl/client.crt',
  keyFile: '/etc/ssl/client.key',
  caFile: '/etc/ssl/ca.crt',

  // 认证
  authToken: 'Bearer prod-token-xyz',

  // 重连
  autoReconnect: true,
  reconnectInterval: 5000,

  // 文件传输
  enableFileTransfer: true,
  maxFileSize: 52428800,  // 50 MB
});
```

### 最小化配置

```typescript
const client = new CroupierClient({
  agentAddr: 'tcp://127.0.0.1:19090'
});
```

## 向后兼容性

✅ **完全向后兼容**

- 所有新配置项都是可选的
- 提供合理的默认值
- 现有代码无需修改即可工作

## 功能对齐状态

更新后，JavaScript SDK 现在与 Java 和 C++ SDK **完全对齐**：

| 配置项 | JavaScript | Java | C++ | 状态 |
|--------|-----------|------|-----|------|
| gameId | ✅ | ✅ | ✅ | ✅ 对齐 |
| env | ✅ | ✅ | ✅ | ✅ 对齐 |
| TLS 配置 | ✅ | ✅ | ✅ | ✅ 对齐 |
| 认证 | ✅ | ✅ | ✅ | ✅ 对齐 |
| 重连 | ✅ | ✅ | ✅ | ✅ 对齐 |
| 文件传输 | ✅ | ✅ | ✅ | ✅ 对齐 |

## 下一步

所有三个 SDK 的配置项现已对齐。后续可以：
1. 为新配置项添加集成测试
2. 更新文档说明各个配置项的用法
3. 在示例代码中展示配置最佳实践
