# 03｜Cordis 插件模型与生命周期

> 更新日期：2026-11-24｜资料核查：2026-11-24｜归属：DeepSeek Harness 专题｜关联任务：从 Harness 原理到 Agent 开发与业务系统集成

> 前置：[02｜运行架构与组合机制](./02-runtime-architecture.md)。  
> 本篇讲 Cordis 的核心抽象；原生插件的完整开发步骤放在下一篇。

## 1. Cordis 是什么？

Cordis 是 DeepSeek Harness 底层使用的插件框架。它为插件提供共享 Context、Service 依赖、事件通信和可逆副作用管理。

它不负责：

- 模型推理；
- Agent 的业务目标；
- 具体文档、审批或项目管理逻辑；
- MCP 协议本身；
- 自动保证操作系统级安全；
- 撤销已经发生的外部业务动作。

因此，Cordis 是 Harness 运行时的插件基础设施之一，不等于整个 Harness。

## 2. 五个核心概念

| 概念 | 解释 | 直观理解 |
|---|---|---|
| Plugin | 一个可由 Cordis 挂载的模块 | 可加入或移除的功能单元 |
| Context | 插件运行时上下文 | 插件访问服务和管理自身副作用的入口 |
| Service | 通过稳定 key 提供的能力 | 其他插件可以依赖的服务接口 |
| inject | 声明所需 Service | “这些依赖准备好以后再启动我” |
| Event / Effect | 插件间通信与副作用管理 | 通知其他模块、记录需要清理的资源 |

## 3. Plugin：插件如何被加载？

DeepSeek Harness 官方教程给出的最小插件形式是导出一个 apply 函数：

~~~typescript
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello-plugin'

export function apply(ctx: Context) {
  console.log('plugin loaded')
}
~~~

插件被 Loader 加载时，Cordis 调用 apply，并把当前插件的 Context 交给它。

插件也支持对象形式和 Service 类形式。一般情况下，函数形式足够；当插件需要向其他插件提供一个服务时，可以采用 Service 形式。

## 4. Context：插件通过什么访问能力？

Context 是插件访问运行时服务和管理副作用的入口。

例如：

- ctx.tools：工具注册表；
- ctx.llm：模型适配相关服务；
- ctx.agents：Agent 注册与协调；
- ctx.sessions：会话相关服务。

插件应该依赖稳定的服务契约，而不是直接 import 另一个插件的内部实现文件。

这样 Provider 可以被替换，只要替代者仍然提供兼容的 Service。

## 5. inject：依赖关系如何表达？

如果插件 B 需要使用插件 A 提供的 DocumentService，B 应声明自己依赖这个 Service。

~~~typescript
export const name = 'document-query-tool'
export const inject = ['documentService']

export function apply(ctx: Context) {
  // 此处可以使用 ctx.documentService
}
~~~

Cordis 会等待所声明的依赖服务就绪后，再启动依赖它的插件。

所以插件加载顺序应由依赖关系表达，而不是依赖开发者手工排列一串启动顺序。

## 6. Event：插件之间如何协作？

Event 用于观察或干预运行时发生的事情。Cordis 区分不同分发语义：

| 模式 | 语义 |
|---|---|
| emit | 不等待监听器完成，按注册顺序通知 |
| waterfall | 监听器可以包装下游结果，也可以短路 |
| parallel | 等待所有监听器并行完成 |
| serial | 等待监听器按顺序完成 |
| bail | 依次检查，遇到 bail 值时停止 |

特别注意 waterfall：

- 调用 next()：委托给下游监听器；
- 下游结果会返回当前监听器；
- 当前监听器可以包装结果后再返回；
- 不调用 next()：直接短路后续流程。

这使权限策略、工具执行拦截和结果处理可以通过插件扩展，而不必直接修改核心执行循环。

## 7. Effect：为什么插件卸载时可以清理资源？

插件可能注册事件监听器、工具、定时器、连接等资源。如果只负责注册，不负责清理，反复加载和卸载后就可能留下资源泄漏或重复注册。

Cordis 的设计要求注册具有所有权，并能在所属插件卸载时撤销。

~~~typescript
import type { Context } from '@deepseek-ai/cordis'

export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(() => {
      console.log('heartbeat')
    }, 5000)

    return () => clearInterval(timer)
  })
}
~~~

上例中：

1. 插件加载时创建定时器；
2. effect 返回清理函数；
3. 插件卸载时，Cordis 执行清理函数；
4. 定时器不再继续运行。

通过 ctx 注册的工具和事件监听等资源，也会在所属插件卸载时被撤销。

**重要边界：** Cordis 的 disposer 清理的是插件拥有的运行时资源。它不会自动回滚已经提交的数据库事务、已经发送的邮件或已经完成的外部审批。外部业务动作的补偿和回滚必须由业务系统自己设计。

## 8. Cordis 与 Spring IoC 的关系

可以做有限类比，但不能认为两者完全相同。

| Spring | Cordis |
|---|---|
| ApplicationContext / IoC Container | Context |
| Bean 提供能力 | Plugin 提供 Service |
| Dependency Injection | inject |
| Application Event | Event |
| Bean 销毁回调 | Effect / disposer |
| 配置与模块装配 | Plugin / Loader / Patch |

Spring 也具备依赖注入、事件和资源销毁能力。Cordis 的突出特点是把插件动态加载、卸载、依赖变化和副作用回收作为运行时核心抽象。


### 补充：时间与空间可组合性

Cordis 上游论文使用两个维度解释插件组合：

- **时间可组合性（Temporal Composability）**：组件可以在运行期间加载、卸载；卸载时能够撤销其拥有的副作用。
- **空间可组合性（Spatial Composability）**：组件能够声明对其他组件提供的服务的依赖，运行时据此管理可见性和生命周期关系。

这里的“空间”不是地理空间，而是软件运行环境中的组件关系。两个维度合起来，强调的不只是代码拆分，还包括运行期间的动态组合和依赖管理。

这篇论文由 Yifan Shi、Wei Zhang、Tianyi Cui 署名，作者单位包含 Peking University 和 DeepSeek-AI；DeepSeek 官方产品页也直接链接到该论文。论文第 5.3 节以 Koishi 为案例，称 Koishi 是建立在 Cordis 上的开源聊天机器人框架；脚注说明 Koishi 使用 Cordis v3，而论文介绍 Cordis v4。

因此，这篇论文是与 DeepSeek-AI 有直接关联的 Cordis 理论资料，也明确把 Koishi 作为 Cordis 的生产案例。但它证明的是 Cordis 与 Koishi 的实际关系及研究案例，不足以证明 DeepSeek Harness 的设计是“参考 Koishi 后做出来的”。

另外，Cordis 的可逆性有明确边界：如果插件绕过受管理的 Context API，直接使用全局变量或未封装的底层 API，相关副作用可能无法被框架完整追踪和回收。因此，不能把 Cordis 描述成自动保证所有代码资源安全的机制。

来源：[A Programming Paradigm for Spatiotemporal Composability](https://arxiv.org/abs/2608.25512)。

## 9. 本篇应掌握的结论

- 插件通过 apply(ctx) 接入运行时。
- Context 是访问服务和管理副作用的入口。
- inject 声明依赖，避免依赖手工启动顺序。
- Event 让插件观察或干预运行过程。
- Effect / disposer 负责清理插件拥有的资源。
- 插件卸载不等于撤销外部业务事务。

## 10. 官方来源

- [Cordis 入门（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-primer.zh.md)
- [Cordis 实践教程目录（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-tutorial/index.zh.md)
- [第一个 Harness 插件（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/index.zh.md)

**下一篇：** [04｜DeepSeek Harness 原生插件开发](./04-native-plugin-development.md)。把这些概念落到 TypeScript / JavaScript 插件代码和安装包。


## 更新记录

- 2026-11-24：按编号学习路径拆分原单文件，补充官方来源核查并明确技术边界。
