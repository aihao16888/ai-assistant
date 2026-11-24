# 01｜DeepSeek Harness 的产品定位与基本概念

> 阅读位置：第一篇。先建立 Model、Agent、Harness 的边界，再进入内部架构。

## 1. 先给结论

DeepSeek 官方将 Agent 概括为：

**Agent = Model + Harness**

这不是说 Agent 只由两个代码包组成，而是强调：模型负责理解、推理和生成动作；Harness 为模型提供可观察的环境、工具、执行循环、上下文、会话和控制机制，使它能够持续完成任务。

DeepSeek Harness 是 DeepSeek 开源的 Agent Harness 运行平台。它不是一个新的基础模型，也不是面向普通用户的 DeepSeek Chat 应用。

## 2. 先把四个容易混淆的对象分开

| 对象 | 它是什么 | 主要职责 |
|---|---|---|
| Model | 大语言模型 | 理解输入、推理、规划、生成文本或工具调用 |
| Harness | Agent 运行与控制环境 | 管理上下文、工具、执行循环、会话、权限和运行状态 |
| Agent | 在具体环境中执行任务的整体 | Model 与 Harness 协作后的运行实体 |
| Agent Host / App | 用户实际使用的应用或宿主 | 提供交互入口、配置、连接和呈现 |

另外，DeepSeek App、DeepSeek API 和 DeepSeek Harness 也不是同一个产品入口：

- **DeepSeek App**：面向终端用户的助手产品。
- **DeepSeek API**：让开发者通过接口调用模型能力。
- **DeepSeek Harness**：面向 Harness / Agent 开发者的开源运行平台。

不能因为三者都与 DeepSeek 有关，就把 App 的功能、API 的计费方式或 Harness 的插件能力混为一谈。

## 3. Harness 到底补足了模型的什么能力？

单独的模型不会天然拥有当前电脑的文件权限、Shell、浏览器、数据库连接、业务系统身份或持久化会话。它只能使用当前请求中提供的信息，并输出下一步内容。

Harness 需要解决以下问题：

| 问题 | Harness 需要提供的能力 |
|---|---|
| 模型能看到什么？ | 系统指令、会话上下文、文件和外部数据的组织 |
| 模型能做什么？ | Tool、MCP 等可调用能力 |
| 如何持续执行？ | Agent Loop：模型请求、工具执行、结果回传、继续推理 |
| 如何记住过程？ | Session、事件日志、恢复与回放 |
| 如何约束动作？ | 权限、审批、沙箱、超时和取消 |
| 如何扩展能力？ | Plugin、Service、Skill、Profile 等组合机制 |
| 人如何使用？ | Web、Desktop、CLI 等交互界面 |

可以用一条简化链路理解：

~~~text
用户提出任务
    ↓
Harness 组织指令、上下文和可用工具
    ↓
Model 推理并决定下一步
    ↓
Harness 校验并执行工具调用
    ↓
工具结果回到会话
    ↓
Model 继续推理，直到任务结束或被停止
~~~

模型负责推理，不意味着所有事情都应该交给模型判断。权限、参数校验、事务、幂等、审计和业务规则应由确定性的程序承担。

## 4. DeepSeek Harness 的核心定位

DeepSeek 官方产品页强调三件事：

1. **一切皆插件**：模型、工具、技能、会话、沙箱、存储、循环、调度和 UI 等能力由插件组合提供。
2. **Cordis 内核管理插件**：内核负责插件加载、卸载和依赖关系，不直接承载 Agent 的具体业务能力。
3. **配置层自由组合**：开发者可以在配置层选择、替换或扩展能力，而不必修改 Harness 源码。

这三个点是理解后续章节的入口。不要把“一切皆插件”误读成“所有外部软件都必须改写成 DeepSeek Harness 插件”。它首先描述的是 Harness 自身的内部架构。

## 5. DeepSeek Harness 目前的成熟度

DeepSeek Harness 官方仓库将项目标记为**开发者预览**，并明确提示核心插件和基础 API 会持续迭代，未来可能出现破坏兼容性的变化。

因此：

- 学习架构和验证技术路线是合适的；
- 开发原生插件时应锁定版本并核对官方文档；
- 不应假设当前 API 已经是长期稳定的企业级兼容接口；
- 生产部署前需要单独验证升级、权限、数据持久化和故障恢复。

## 6. 本篇应掌握的结论

读完本篇，应该能清楚回答：

- Model 负责推理，Harness 负责提供运行环境与控制机制。
- Agent 是两者协作形成的任务执行整体。
- DeepSeek Harness 是运行平台，不是 DeepSeek 模型本身。
- “一切皆插件”描述的是 Harness 内部能力的模块化与组合方式。
- 企业原有系统不必重写成 Harness 插件；后续可以通过 MCP 等接口向 Agent 开放能力。

## 7. 官方来源

- [DeepSeek Harness 官方产品页](https://www.deepseek.com/harness/zh/)
- [DeepSeek Harness 官方仓库 README（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/README.zh.md)

**下一篇：** [02｜运行架构与组合机制](./02-runtime-architecture.md)。理解 Harness 内部为什么采用插件化，以及 Profile、Bundle、Patch 如何组成运行时。
