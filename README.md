# Croupier TypeScript/JavaScript SDK (NNG)

高性能的 TypeScript/JavaScript SDK，使用 NNG 替代 gRPC，实现轻量级的游戏函数注册和调用。

## 特性

- ✅ **轻量级** - nng.js vs grpc
- ✅ **高性能** - 低延迟通信
- ✅ **跨平台** - Node.js 18+
- ✅ **TypeScript** - 完整类型支持
- ✅ **易用** - Promise API，async/await

## 安装

```bash
npm install @croupier/sdk
```

或从源码构建：

```bash
git clone https://github.com/cuihairu/croupier.git
cd croupier/sdks/ts
npm install
npm run build
```

### 依赖

- Node.js 18+
- nng.js

## 快速开始

### 服务端 (函数注册)

```typescript
import { CroupierClient } from '@croupier/sdk';

const client = new CroupierClient({
  agentAddr: '127.0.0.1:19091',
  serviceId: 'ts-service',
});

client.registerFunction('player.get', (context, payload) => {
  return JSON.stringify({
    player_id: '123',
    name: 'Player One'
  });
});

await client.connect();
await client.serve();
```

### 客户端 (函数调用)

```typescript
import { Invoker } from '@croupier/sdk';

const invoker = new Invoker({
  agentAddr: '127.0.0.1:19091',
});

await invoker.connect();

const response = await invoker.invoke('player.get', 'player123');
console.log('Response:', response);

invoker.disconnect();
```

## 运行示例

1. **启动 Agent:**
   ```bash
   croupier-agent --config etc/agent.yaml
   ```

2. **构建并运行示例:**
   ```bash
   npm install
   npm run build
   node dist/examples/basic.js
   node dist/examples/invoker.js
   ```

## API 参考

### ClientConfig

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `agentAddr` | string | `"127.0.0.1:19091"` | Agent NNG 地址 |
| `localBind` | string | `"0.0.0.0:0"` | 本地服务绑定地址 |
| `timeoutSeconds` | number | `30` | 请求超时 |
| `serviceId` | string | `"ts-service"` | 服务标识 |
| `enableLogging` | boolean | `true` | 启用日志 |

### CroupierClient

| 方法 | 说明 |
|------|------|
| `registerFunction(id, handler)` | 注册函数 |
| `unregisterFunction(id)` | 取消注册函数 |
| `hasFunction(id)` | 检查函数是否已注册 |
| `getFunctionCount()` | 获取注册函数数量 |
| `connect()` | 连接到 Agent |
| `serve()` | 开始服务 |
| `stop()` | 停止服务 |
| `disconnect()` | 断开连接 |

### Invoker

| 方法 | 说明 |
|------|------|
| `connect()` | 连接到 Agent |
| `invoke(id, payload)` | 调用函数 |
| `startJob(id, payload)` | 启动异步任务 |
| `cancelJob(jobId)` | 取消任务 |
| `disconnect()` | 断开连接 |

## 协议格式

SDK 使用自定义协议格式，与 Go/C++/Python SDK 完全兼容：

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Message Format                               │
├─────────────────────────────────────────────────────────────────────┤
│  Header (8 bytes):                                                  │
│  ┌─────────┬──────────┬─────────────────┐                          │
│  │ Version │ MsgID    │ RequestID       │                          │
│  │ (1B)    │ (3B)     │ (4B)            │                          │
│  └─────────┴──────────┴─────────────────┘                          │
│                                                                     │
│  Body: protobuf / JSON serialized data                             │
└─────────────────────────────────────────────────────────────────────┘
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 监听模式
npm run watch

# 运行示例
npm run example
```

## 许可证

Apache License 2.0
