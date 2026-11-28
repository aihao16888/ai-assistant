# 阶段 C｜真实产品插件案例追踪（C1 候选比较）

- 项目：[AI-PPT-001｜DeepSeek Harness：Everything is a Plugin](./brief.md)
- 研究计划：[01-stage-one-research-plan.md](./01-stage-one-research-plan.md)
- AI Agent 研究执行任务书：[02-first-round-agent-task.md](./02-first-round-agent-task.md)
- 前置研究：[00-stage-a-research-map.md](./00-stage-a-research-map.md) · [03-research-notes.md](./03-research-notes.md)
- 本次日期：2026-11-28
- DeepSeek Harness 固定 Commit：4b399c39a6d1479cd84ca591b4d7c88e24d38a96
- 当前状态：**C1 候选比较已完成；推荐 Bash 能力 seam；C2 深入追踪尚未开始，等待用户确认**
- 证据边界：本文件记录固定版本文档、源码入口和测试入口的定向静态调查；没有运行测试，没有声称已验证完整运行行为。

---

## 1. C1 要解决的问题

阶段 B 已经解释 Cordis Runtime 与 Loader 的通用机制，但这还不足以让听众理解它们在 DeepSeek Harness 产品中的实际作用。

C1 要从真实产品实现中选择一个主案例。选择时不只看哪个包最核心，而是看它能否清楚展示：

1. 产品组合如何声明和加载插件；
2. 插件如何依赖 Service Definition；
3. Provider 如何提供具体能力；
4. Consumer 如何在不依赖具体 Provider 的情况下使用能力；
5. 更换 Provider 时，哪些部分保持不变、哪些依赖需要随之改变；
6. 关键行为是否有源码和测试证据。

本次只完成候选筛选，不把候选比较误写成完整源码审查。

## 2. 候选 A｜Bash 能力 seam

### 2.1 官方资料为何值得优先研究

官方开发实践文档专门用 Bash 说明 Service Definition / Service Provider / Consumer 三种角色：

- Service Definition：dsh-shell；
- Service Provider：dsh-bash-local；
- Consumer：dsh-tool-bash。

官方术语表进一步把 packages/shell 定义为 capability seam 的规范范例，并明确列出两个 Provider：dsh-bash-local 与 dsh-bash-sandbox。一个 seam 是完整的可替换能力，不是其中某一个角色。

资料：

- [能力的三种角色设计](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/practice/index.zh.md)
- [官方术语表：capability-seam](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/glossary.zh.md)
- [Shell 能力家族](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/README.zh.md)

### 2.2 已核对的源码结构

| 角色 | 固定版本实现 | 已确认的源码事实 |
|---|---|---|
| Service Definition | packages/shell/shell/src/index.ts | ShellExecutor 继承 Cordis Service，并以 shell 为服务名注册 ctx.shell |
| 本地 Provider | packages/shell/bash-local/src/index.ts | LocalBashExecutor 继承 ShellExecutor，依赖 subprocess |
| 沙箱 Provider | packages/shell/bash-sandbox/src/index.ts | SandboxBashExecutor 继承 LocalBashExecutor，额外依赖 subprocess、sandbox、sandboxPolicy |
| Consumer | packages/shell/tool-bash/src/index.ts | tool-bash 声明依赖 tools、shell、systemPrompt、shellEnv、workingDirectory；通过 ctx.shell.execute 执行命令 |

关键源码：

- [ShellExecutor 定义](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/shell/src/index.ts#L32-L97)
- [LocalBashExecutor](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/bash-local/src/index.ts#L88-L120)
- [SandboxBashExecutor](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/bash-sandbox/src/index.ts#L36-L92)
- [tool-bash 插件入口与依赖](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/tool-bash/src/index.ts#L32-L40)
- [tool-bash 消费 ctx.shell](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/tool-bash/src/index.ts#L246-L260)

### 2.3 一个重要发现：入门示例与实际产品组合不同

官方三角色教程以 dsh-bash-local 作为 Provider，便于解释基本关系。

但固定版本的 Base Bundle 在 POSIX 环境实际组合的是：

- dsh-sandbox-local；
- dsh-sandbox-policy；
- dsh-bash-sandbox；
- dsh-tool-bash。

配置入口：[packages/bundle/base/cordis.patch.yml](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/bundle/base/cordis.patch.yml#L245-L290)。

因此，后续 C2 应以真实 Base Bundle 的 dsh-bash-sandbox 路径为主，dsh-bash-local 作为可替换 Provider 对照，而不能把教程中的最小示例误说成产品实际挂载的完整组合。

还需要讲清楚：

- dsh-bash-local 以 Harness 进程自身权限执行命令，本身不提供隔离；
- dsh-bash-sandbox 继承本地执行器的进程机制，并通过 ctx.sandbox.confine 包装命令；
- 沙箱 Provider 需要额外的 sandbox 和 sandboxPolicy 服务；
- dsh-tool-bash 面向统一的 ctx.shell 能力，不直接依赖某个具体执行器。

Shell 包文档还明确要求每个 Context 只选择一个执行器实现；同时挂载两个会因为重复注册服务而在加载期失败。这是一个很好的依赖和组合边界案例。

### 2.4 测试入口已定位，但尚未审查具体断言

- [bash-local executor.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/bash-local/tests/executor.spec.ts)
- [bash-sandbox sandbox.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/bash-sandbox/tests/sandbox.spec.ts)
- [bash-sandbox partial-landlock.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/bash-sandbox/tests/partial-landlock.spec.ts)
- [tool-bash tools.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell/tool-bash/tests/tools.spec.ts)

C1 只确认这些测试入口存在，尚未逐条检查 Arrange / Act / Assert，也没有运行它们。C2 应只挑选能够证明核心 seam 关系、Provider 行为和 Consumer 调用的必要断言。

### 2.5 复杂度与风险

优势：

- 官方明确将其作为三角色能力设计的规范案例；
- Service Definition、Provider、Consumer 的职责边界清晰；
- 有两个 Provider 可供比较；
- 产品组合配置、源码和测试入口均已找到；
- 核心解释不需要调用真实模型 API。

风险：

- 不能把 dsh-bash-local、dsh-bash-sandbox、dsh-shell 误说成三个完全对等、都需要独立挂载的运行插件；
- 沙箱执行器还涉及 subprocess、sandbox、sandboxPolicy；
- tool-bash 还涉及 tools、jobs、approval、shellEnv 和 workingDirectory 等周边服务；
- 不能把本地执行器描述成沙箱执行器；
- 不能把文件访问隔离扩大描述成网络隔离或完整操作系统沙箱。

范围控制方法：C2 只追踪 ctx.shell seam、Base Bundle 实际 Provider 和 tool-bash Consumer。只有解释这条链路必需时，才展开 subprocess、sandboxPolicy 等依赖；不研究整个作业系统或所有沙箱实现。

## 3. 候选 B｜LLM Provider Adapter

### 3.1 已核对的主要机制

候选包：packages/llm/llm-pi-ai。

固定版本源码显示：

- 插件声明 inject = llm；
- 一个插件实例可以管理多个 Provider 路由；
- 通过 ctx.llm.registerAdapter 注册适配器；
- 配置变化时可更新路由注册；
- 支持 pi-ai 目录、自定义网关、凭据、登录、模型发现、请求头、流式转换和回放处理。

资料：

- [dsh-llm-pi-ai README](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm-pi-ai/README.zh.md)
- [插件入口](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm-pi-ai/src/index.ts)
- [适配器实现](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm-pi-ai/src/adapter.ts)
- [配置实现](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm-pi-ai/src/config.ts)
- [LLM Service](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm/src/index.ts)

### 3.2 价值

它可以展示插件如何向统一的 LLM Service 注册不同模型提供方，以及如何把不同协议和模型目录适配到统一请求接口。

这对解释模型适配器的可扩展性很有价值。

### 3.3 为什么暂不选为主案例

它的主要复杂度不只是 Cordis 插件机制，还包括：

- pi-ai 第三方库的模型与协议抽象；
- 多 Provider 路由和配置解析；
- credentials、authorization 和 OAuth；
- 模型目录发现；
- 请求图片处理、流式转换和历史回放；
- 动态配置和注册原子替换。

已定位的核心源码模块（index、adapter、config、discovery、auth）合计约 2,100 行；仅已定位的 adapter、loader-composition、dynamic-config、discovery 测试文件就有约 2,500 行。

这并不意味着不能研究，而是如果把它作为第一个真实案例，容易把分享主题从插件机制带偏到模型协议适配器的实现细节。

后续可以把它作为补充例子，说明统一 Service 如何承载多个模型 Provider。

### 3.4 测试入口

- [adapter.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm-pi-ai/tests/adapter.spec.ts)
- [loader-composition.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm-pi-ai/tests/loader-composition.spec.ts)
- [dynamic-config.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm-pi-ai/tests/dynamic-config.spec.ts)
- [discovery.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/llm-pi-ai/tests/discovery.spec.ts)

这些文件尚未进行完整断言审查或运行。

## 4. 候选 C｜Agent Loop

### 4.1 已核对的主要机制

候选包：packages/core/agent-loop。

固定版本源码显示：

- AgentLoop 是一个 Cordis Service；
- 它声明依赖 agents、sessions、llm、tools、systemPrompt、sessionProjections 六个服务；
- 它向 ctx.agents 注册 AgentFactory；
- 它管理 Agent 创建、恢复、轮次驱动、Session 持久化和卸载。

资料：

- [Agent Loop README](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/agent-loop/README.zh.md)
- [AgentLoop 入口](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/agent-loop/src/index.ts)
- [Agent 驱动实现](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/agent-loop/src/agent.ts)
- [Inbox 实现](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/agent-loop/src/inbox.ts)

### 4.2 价值

这是三个候选中最能直接说明“核心执行循环本身也可以作为插件”的案例。

官方架构明确把 Agent Loop 设计成可替换的驱动器；扩展插件依赖公开 Agent Service，而不是直接依赖具体 Loop 实现。

### 4.3 为什么暂不选为主案例

Agent Loop 的实际职责非常多：

- 创建和恢复 Agent；
- 管理 Session 写句柄；
- 处理持久化历史；
- 驱动模型请求与流式响应；
- 组织工具调用和并发；
- 管理 Inbox；
- 处理取消、失败、重试和 teardown；
- 与系统提示词、投影注册表等服务协作。

已定位的四个核心源码文件（index、agent、inbox、runtime-context）合计约 1,900 行；loop、cancel、contract-regressions 三个已定位测试文件合计约 4,700 行。

它是很好的后续专题，但作为本次第一份真实产品案例，研究范围过大，容易让听众把重点放在 Agent Loop 内部状态机，而不是 Everything is a Plugin 的插件组合机制。

### 4.4 测试入口

- [loop.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/agent-loop/tests/loop.spec.ts)
- [cancel.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/agent-loop/tests/cancel.spec.ts)
- [contract-regressions.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/agent-loop/tests/contract-regressions.spec.ts)

这些文件尚未进行完整断言审查或运行。

## 5. 三个候选的比较

| 维度 | Bash 能力 seam | LLM Provider Adapter | Agent Loop |
|---|---|---|---|
| 与插件化主题的关联 | 很高 | 高 | 很高 |
| Definition / Provider / Consumer 展示 | 最清楚 | 主要是 Adapter 注册 | 不是本次最直接的展示方式 |
| Provider 替换示例 | 两个执行器实现同一 ctx.shell | 多路由和多个适配器 | Loop 驱动器可替换 |
| 产品配置入口 | 清晰 | 清晰但配置复杂 | 清晰 |
| 源码范围可控性 | 中，可严格收敛 | 中低 | 低 |
| 主要额外知识 | subprocess、sandbox | 模型协议、凭据、目录和流式转换 | Agent、Session、持久化、工具、Inbox |
| 无真实模型 API 的研究 | 可以 | 可以用 mock HTTP 做定向测试 | 可以用 MockAdapter 做定向测试 |
| 最适合本次主案例 | **推荐** | 暂不作为主案例 | 暂不作为主案例 |

选择依据不是哪个案例最简单，而是哪个案例最能让听众看懂插件机制，同时又能把研究范围控制在可验证的边界内。

## 6. C1 结论与建议

**推荐将 Bash 能力 seam 作为阶段 C 的主案例。**

注意，后续研究对象不是单独的 dsh-bash-local，也不是单独的 dsh-tool-bash，而是完整能力关系：

- dsh-shell：Service Definition；
- dsh-bash-local / dsh-bash-sandbox：可替换的 Provider；
- dsh-tool-bash：Consumer。

C2 应以 Base Bundle 实际挂载的 dsh-bash-sandbox 为主线，使用 dsh-bash-local 作为替换对照。

这样可以围绕一个具体问题展开：

> 为什么模型侧的 Bash 工具不需要知道命令最终是在本地执行，还是通过沙箱执行？这种替换依赖什么契约，又有哪些额外依赖和限制？

这将成为后续技术分享中最容易被听众理解、也最容易通过源码和测试证明的案例。

## 7. C2 建议研究范围（尚未执行）

用户确认选择后，再开始以下工作：

1. 从 Base Bundle 的实际配置定位 shell Provider 和 tool Consumer；
2. 追踪 Loader 如何导入配置项并创建对应 Fiber；
3. 核对 ShellExecutor 如何注册 ctx.shell；
4. 核对 dsh-bash-sandbox 如何继承本地执行机制并增加 sandbox 约束；
5. 核对 dsh-tool-bash 如何注入并消费 ctx.shell；
6. 对比 dsh-bash-local 与 dsh-bash-sandbox 的依赖差异；
7. 选取最少量的测试断言，分别证明服务注册、Provider 行为和 Consumer 调用；
8. 区分 Cordis 通用机制、Harness 组合逻辑和 Bash 插件自身实现；
9. 记录源码能够证明和不能证明的内容。

### C2 明确不做

- 不研究完整 subprocess 子系统；
- 不研究所有 Sandbox Provider 和平台 runner；
- 不研究全部 jobs / approval 工作流；
- 不研究 PowerShell 和持久化 Shell；
- 不开发新插件；
- 不调用真实模型 API；
- 不制作 PPT；
- 不提前生成小红书笔记。

如果追踪过程中发现必须扩大范围，先说明新增问题、必要文件和预期证据，不自动扩展。

## 8. 当前证据与状态

| 项目 | 状态 |
|---|---|
| 固定版本 | 已使用统一 Commit |
| 三个候选官方资料 | 已定位 |
| 三个候选核心源码 | 已定位并定向阅读 |
| Bash 实际产品组合 | 已定位 |
| 候选测试入口 | 已定位 |
| 测试具体断言 | 尚未完成审查 |
| 本地测试运行 | 未执行 |
| 真实运行观察 | 未执行 |
| 最终案例 | 推荐 Bash 能力 seam，等待用户确认 |
| C2 深入追踪 | 尚未开始 |

**C1 结论：候选比较完成。阶段 C 尚未完成。**

用户确认后进入 C2；C2 完成后整理完整的 04-source-trace.md，提交 test 分支并停止等待审核。

## 更新记录

- 2026-11-28：基于 DeepSeek Harness 固定 Commit 完成 Bash 能力 seam、LLM Provider Adapter、Agent Loop 三个候选的定向资料与源码入口比较；推荐 Bash 能力 seam；未运行测试，未进行真实运行观察；等待用户确认后进入 C2。
