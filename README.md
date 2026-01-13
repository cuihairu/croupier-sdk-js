<p align="center">
  <h1 align="center">Croupier Node.js SDK</h1>
  <p align="center">
    <strong>TypeScript 优先的 Node.js SDK，用于 Croupier 游戏函数注册与执行系统</strong>
  </p>
</p>

<p align="center">
  <a href="https://github.com/cuihairu/croupier-sdk-js/actions/workflows/nightly.yml">
    <img src="https://github.com/cuihairu/croupier-sdk-js/actions/workflows/nightly.yml/badge.svg" alt="Nightly Build">
  </a>
  <a href="https://codecov.io/gh/cuihairu/croupier-sdk-js">
    <img src="https://codecov.io/gh/cuihairu/croupier-sdk-js/branch/main/graph/badge.svg" alt="Coverage">
  </a>
  <a href="https://www.apache.org/licenses/LICENSE-2.0">
    <img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License">
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-22+-339933.svg" alt="Node.js Version">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg" alt="TypeScript">
  </a>
</p>

<p align="center">
  <a href="#支持平台">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg" alt="Platform">
  </a>
  <a href="https://github.com/cuihairu/croupier">
    <img src="https://img.shields.io/badge/Main%20Project-Croupier-green.svg" alt="Main Project">
  </a>
</p>

---

## 📋 目录

- [简介](#简介)
- [主项目](#主项目)
- [其他语言 SDK](#其他语言-sdk)
- [支持平台](#支持平台)
- [核心特性](#核心特性)
- [快速开始](#快速开始)
- [使用示例](#使用示例)
- [架构设计](#架构设计)
- [API 参考](#api-参考)
- [开发指南](#开发指南)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 简介

Croupier Node.js SDK 是 [Croupier](https://github.com/cuihairu/croupier) 游戏后端平台的官方 Node.js/TypeScript 客户端实现。它提供了真实的 gRPC 管道、心跳与自动重连机制以及强类型的处理器注册系统。

## 主项目

| 项目 | 描述 | 链接 |
|------|------|------|
| **Croupier** | 游戏后端平台主项目 | [cuihairu/croupier](https://github.com/cuihairu/croupier) |
| **Croupier Proto** | 协议定义（Protobuf/gRPC） | [cuihairu/croupier-proto](https://github.com/cuihairu/croupier-proto) |

## 其他语言 SDK

| 语言 | 仓库 | Nightly | Release | Docs | Coverage |
| --- | --- | --- | --- | --- | --- |
| C++ | [croupier-sdk-cpp](https://github.com/cuihairu/croupier-sdk-cpp) | [![nightly](https://github.com/cuihairu/croupier-sdk-cpp/actions/workflows/nightly.yml/badge.svg)](https://github.com/cuihairu/croupier-sdk-cpp/actions/workflows/nightly.yml) | [![release](https://img.shields.io/github/v/release/cuihairu/croupier-sdk-cpp)](https://github.com/cuihairu/croupier-sdk-cpp/releases) | [![docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://cuihairu.github.io/croupier-sdk-cpp/) | [![codecov](https://codecov.io/gh/cuihairu/croupier-sdk-cpp/branch/main/graph/badge.svg)](https://codecov.io/gh/cuihairu/croupier-sdk-cpp) |
| Go | [croupier-sdk-go](https://github.com/cuihairu/croupier-sdk-go) | [![nightly](https://github.com/cuihairu/croupier-sdk-go/actions/workflows/nightly.yml/badge.svg)](https://github.com/cuihairu/croupier-sdk-go/actions/workflows/nightly.yml) | [![release](https://img.shields.io/github/v/release/cuihairu/croupier-sdk-go)](https://github.com/cuihairu/croupier-sdk-go/releases) | [![docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://cuihairu.github.io/croupier-sdk-go/) | [![codecov](https://codecov.io/gh/cuihairu/croupier-sdk-go/branch/main/graph/badge.svg)](https://codecov.io/gh/cuihairu/croupier-sdk-go) |
| Java | [croupier-sdk-java](https://github.com/cuihairu/croupier-sdk-java) | [![nightly](https://github.com/cuihairu/croupier-sdk-java/actions/workflows/nightly.yml/badge.svg)](https://github.com/cuihairu/croupier-sdk-java/actions/workflows/nightly.yml) | [![release](https://img.shields.io/github/v/release/cuihairu/croupier-sdk-java)](https://github.com/cuihairu/croupier-sdk-java/releases) | [![docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://cuihairu.github.io/croupier-sdk-java/) | [![codecov](https://codecov.io/gh/cuihairu/croupier-sdk-java/branch/main/graph/badge.svg)](https://codecov.io/gh/cuihairu/croupier-sdk-java) |
| Python | [croupier-sdk-python](https://github.com/cuihairu/croupier-sdk-python) | [![nightly](https://github.com/cuihairu/croupier-sdk-python/actions/workflows/nightly.yml/badge.svg)](https://github.com/cuihairu/croupier-sdk-python/actions/workflows/nightly.yml) | [![release](https://img.shields.io/github/v/release/cuihairu/croupier-sdk-python)](https://github.com/cuihairu/croupier-sdk-python/releases) | [![docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://cuihairu.github.io/croupier-sdk-python/) | [![codecov](https://codecov.io/gh/cuihairu/croupier-sdk-python/branch/main/graph/badge.svg)](https://codecov.io/gh/cuihairu/croupier-sdk-python) |
| C# | [croupier-sdk-csharp](https://github.com/cuihairu/croupier-sdk-csharp) | [![nightly](https://github.com/cuihairu/croupier-sdk-csharp/actions/workflows/nightly.yml/badge.svg)](https://github.com/cuihairu/croupier-sdk-csharp/actions/workflows/nightly.yml) | [![release](https://img.shields.io/github/v/release/cuihairu/croupier-sdk-csharp)](https://github.com/cuihairu/croupier-sdk-csharp/releases) | [![docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://cuihairu.github.io/croupier-sdk-csharp/) | [![codecov](https://codecov.io/gh/cuihairu/croupier-sdk-csharp/branch/main/graph/badge.svg)](https://codecov.io/gh/cuihairu/croupier-sdk-csharp) |
| Lua | [croupier-sdk-lua](https://github.com/cuihairu/croupier-sdk-lua) | - | - | [docs](https://github.com/cuihairu/croupier-sdk-cpp/blob/main/skynet/service/croupier_service.lua) | - |

## 支持平台

| 平台 | 架构 | 状态 |
|------|------|------|
| **Windows** | x64 | ✅ 支持 |
| **Linux** | x64, ARM64 | ✅ 支持 |
| **macOS** | x64, ARM64 (Apple Silicon) | ✅ 支持 |

## 核心特性

- 🛰️ **真实 gRPC 管道** - 启动本地 FunctionService gRPC 服务器并向 Agent 注册
- 🔁 **心跳与重连** - 保持会话活跃，瞬态故障后自动重试
- 📦 **处理器注册** - 强类型描述符，支持可选的 JSON Schema 元数据
- 🧪 **示例完备** - `examples/main.ts` 演示多处理器和载荷验证
- 📝 **TypeScript 优先** - 完整的类型定义，开发体验优秀

## 快速开始

### 系统要求

- **Node.js** ≥ 22
- **pnpm** ≥ 10（推荐使用 `package.json#packageManager` 指定版本）

### 安装

```bash
pnpm install
pnpm run build
```

### 基础使用

```ts
import { createClient, FunctionDescriptor, FunctionHandler } from './src';

const config = {
  agentAddr: '127.0.0.1:19090',
  controlAddr: '127.0.0.1:19100', // 可选：上传 provider manifest
  serviceId: 'inventory-service',
  serviceVersion: '1.2.3',
};

const client = createClient(config);

const addItem: FunctionHandler = async (_ctx, payload) => {
  const request = JSON.parse(payload);
  // ... 修改状态 ...
  return JSON.stringify({ status: 'ok', item_id: request.item_id });
};

const descriptor: FunctionDescriptor = {
  id: 'inventory.add_item',
  version: '1.0.0',
  description: '向玩家背包添加物品',
  input_schema: {
    type: 'object',
    required: ['player_id', 'item_id'],
    properties: {
      player_id: { type: 'string' },
      item_id: { type: 'string' },
      quantity: { type: 'number', default: 1 },
    },
  },
};

await client.registerFunction(descriptor, addItem);
await client.connect();

console.log('✅ inventory.add_item 已注册');
```

## 使用示例

### 运行示例应用

```bash
# 在项目根目录下
pnpm install
pnpm dev
```

示例注册三个处理器（`player.ban`、`wallet.transfer`、`shop.buy`）并记录调用日志。默认连接到 `127.0.0.1:19090` 的 Agent。

### 函数描述符

```ts
const descriptor: FunctionDescriptor = {
  id: 'player.ban',           // 函数 ID
  version: '1.0.0',           // 语义化版本
  description: '封禁玩家',     // 描述
  input_schema: {             // JSON Schema（可选）
    type: 'object',
    required: ['player_id', 'reason'],
    properties: {
      player_id: { type: 'string' },
      reason: { type: 'string' },
      duration: { type: 'number' },
    },
  },
};
```

### 函数处理器

```ts
const handler: FunctionHandler = async (context, payload) => {
  // context: 执行上下文
  // payload: JSON 字符串载荷
  const data = JSON.parse(payload);

  // 处理业务逻辑...

  return JSON.stringify({ status: 'success' });
};
```

## 架构设计

### 数据流

```
Game Server → Node.js SDK → Agent → Croupier Server
```

SDK 实现两层注册系统：
1. **SDK → Agent**: 使用 `LocalControlService`（来自 `local.proto`）
2. **Agent → Server**: 使用 `ControlService`（来自 `control.proto`）

### 项目结构

```
croupier-sdk-js/
├── src/                # SDK 源码（TypeScript）
├── generated/          # Protobuf/gRPC 绑定（connect-es）
├── examples/           # 端到端示例
├── dist/               # tsc 输出
└── package.json
```

## API 参考

### ClientConfig

```ts
interface ClientConfig {
  agentAddr: string;        // Agent gRPC 地址
  controlAddr?: string;     // 可选控制面地址（用于 manifest 上传）
  serviceId: string;        // 服务标识符
  serviceVersion: string;   // 服务版本
  gameId?: string;          // 游戏标识符
  env?: string;             // 环境（dev/staging/prod）
  insecure?: boolean;       // 使用不安全的 gRPC
}
```

### CroupierClient

```ts
interface CroupierClient {
  // 函数注册
  registerFunction(descriptor: FunctionDescriptor, handler: FunctionHandler): Promise<void>;

  // 连接管理
  connect(): Promise<void>;

  // 生命周期
  stop(): Promise<void>;
  close(): Promise<void>;

  // 状态
  isConnected(): boolean;
}
```

## 开发指南

### 构建命令

```bash
# 安装依赖
pnpm install

# 构建
pnpm run build

# 运行测试
pnpm test

# 运行示例
pnpm ts-node examples/main.ts
```

### 路线图

- Provider manifest 上传（通过 `ControlService.RegisterCapabilities`）
- 丰富的运行时指标 + 健康探针
- 一流的 CommonJS/ESM 双构建

## 贡献指南

1. 确保所有类型与 proto 定义对齐
2. 为新功能添加测试
3. 更新 API 变更的文档
4. 遵循 TypeScript 编码规范

欢迎贡献 - 如有任何问题，请提交 issue 或 PR！🧑‍💻

## 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

---

<p align="center">
  <a href="https://github.com/cuihairu/croupier">🏠 主项目</a> •
  <a href="https://github.com/cuihairu/croupier-sdk-js/issues">🐛 问题反馈</a> •
  <a href="https://github.com/cuihairu/croupier/discussions">💬 讨论区</a>
</p>
