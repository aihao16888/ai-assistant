# 阶段 A｜Everything is a Plugin 研究问题地图

- 日期：2026-11-28
- 项目：[AI-PPT-001｜DeepSeek Harness：Everything is a Plugin](./brief.md)
- 阶段状态：**已完成问题地图；尚未进入核心机制的完整源码审查**
- 官方仓库：https://github.com/deepseek-ai/deepseek-harness
- 本次固定版本：master @ 4b399c39a6d1479cd84ca591b4d7c88e24d38a96

---

## 1. 阶段 A 要解决什么

阶段 A 不是把官方文档总结一遍，也不是马上阅读所有源码。它要先把研究目标、概念边界、资料入口、关键问题和后续验证路线建立起来。

这次技术分享最终要回答的不是“Cordis 有哪些 API”，而是：

> DeepSeek Harness 为什么采用 Everything is a Plugin？这个设计在运行时究竟如何工作？插件怎样提供能力、声明依赖、协作、替换和卸载？它解决了什么问题，又引入了哪些成本？

研究最终要把一个原本不了解该概念的人，带到能够：

1. 用通俗但准确的语言解释设计思想；
2. 画出产品架构和插件运行关系；
3. 从固定版本源码中追踪一个真实插件；
4. 用测试或实际运行验证关键行为；
5. 解释设计收益、限制和适用边界；
6. 面向同事完成一场有证据支撑的技术分享。

**价值不在于产出一篇长总结，而在于形成一套可以被讲解、质疑、核验和复用的知识资产。**

## 2. 官方仓库与版本核验

2026-11-28 重新读取官方 GitHub 仓库元数据和默认分支树：

| 项目 | 核验结果 |
|---|---|
| 仓库 | deepseek-ai/deepseek-harness |
| 默认分支 | master |
| 默认分支 HEAD | 4b399c39a6d1479cd84ca591b4d7c88e24d38a96 |
| 文件树路径数 | 26,160 |
| 文件树是否截断 | 否 |
| 与历史参考快照 | 一致 |

本轮先将上述 SHA 作为研究基线。后续若仓库出现新提交，不自动切换版本；本次分享的文档、源码、测试和运行证据都必须固定在同一个 Commit。

**重要边界：** 26,160 是文件树中的路径数量，不代表本轮逐一阅读了这些文件。我们只根据研究问题定位必要资料，禁止全仓库无差别阅读。

## 3. 阶段 A 已核对的官方资料

以下资料证明官方资料并不只有此前列出的 8 份。8 份只是入门入口，不应成为研究范围上限。

### 3.1 设计与概念

- [README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/README.zh.md)：项目定位，说明 DeepSeek Harness 是基于“一切皆插件”架构、由 Cordis 驱动的开源 Agent Harness。
- [docs/architecture.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/architecture.zh.md)：明确列出模型适配器、工具注册表、会话日志、Agent Loop 等产品组成均为插件；解释 Profile、Bundle、Patch、核心包和能力 seam。
- [docs/cordis-primer.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-primer.zh.md)：Cordis 的核心概念、事件分发、Loader 配置和实践规则。
- [Cordis Tutorial 01–07](https://github.com/deepseek-ai/deepseek-harness/tree/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-tutorial)：从第一个插件、生命周期、Service、Event、配置、组合/HMR，到接入真实 Harness 服务。
- Cordis API 参考：[Context](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-api/context.zh.md)、[Service](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-api/service.zh.md)、[Events](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-api/events.zh.md)、[Registry](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-api/registry.zh.md)：更细的 API 契约，不应只依赖 Primer 的压缩描述。

### 3.2 从开发者视角理解插件与能力

- [服务与依赖](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/framework/service.zh.md)：必需/可选依赖、服务提供与服务隔离。
- [事件系统](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/framework/events.zh.md)：事件模式、命名、监听器生命周期，以及 Cordis Event 与持久 Session Event 的区别。
- [能力的三种角色设计](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/practice/index.zh.md)：Service Definition、Service Provider、Consumer 的分离方式，并以 Bash 为例。
- [插件配置](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/config.zh.md)：Config Schema、校验和配置变化。
- [打包与安装插件](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/publish.zh.md)：明确区分 Bundle manifest 与 Profile manifest。
- [插件索引](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/guide/plugin-market.zh.md)：用于发现和安装组合包的索引，不等于 Cordis 运行时本身。

### 3.3 产品结构与实际案例入口

- [packages/README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/README.zh.md)：包分组总图。
- [packages/core/README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/README.zh.md)：Session、Tools、Agent、Agent Loop 等核心职责。
- [packages/llm/README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/llm/README.zh.md)：LLM 服务与 Provider Adapter 的分工。
- [packages/shell/README.zh.md](https://github.com/deepseek-ai/deepseek-harness/tree/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/shell)：Shell 能力定义及其执行器、工具消费者。
- [packages/boot/app-boot/README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/boot/app-boot/README.zh.md)：Profile 加载、Bundle 解析、Patch 叠加和 Loader 启动。
- [packages/bundle/README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/bundle/README.zh.md)：Profile 使用的可安装配置层。
- [packages/boot/plugin-manager/README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/boot/plugin-manager/README.zh.md)：运行中的 Profile 如何管理插件条目和组合包。

## 4. 当前建立的概念边界

以下是阶段 A 的工作模型。它用于指导后续验证，不应把所有分析都当作已经完成的源码结论。

### 4.1 “Everything” 应该如何理解

**官方明确说明（OFFICIAL）：** Harness 的产品组成包括模型适配器、工具注册表、会话日志和 Agent Loop；这些部分都以插件组织，因此可以从配置中替换。官方还明确写到，不存在需要通过打补丁扩展的特权内核，扩展方式是把插件挂载到其他插件旁边。

**当前解释（ANALYSIS）：** 这里的“一切”指 Harness 运行架构中主要、可组合的产品能力，不应扩大解释为“每个函数、每个 TypeScript 文件、每个 API、每个外部软件都必须成为插件”。

这个边界还要通过源码和包结构验证：例如 Core 包组里存在作为共享库使用、没有 ctx key 的 scope 原语；包、插件、服务和组合包不是同一层概念。

### 4.2 Plugin、Service 与 Context 不是同一个东西

- **Plugin：** 可由 Cordis 挂载、拥有生命周期和注册副作用的运行单元。官方教程展示 function、object（含 apply）和 class/Service 三种入口形态。
- **Context：** 插件运行时访问服务、事件和生命周期 API 的上下文；Context 也承担服务解析和作用域边界。
- **Service：** 插件向其他插件提供的具名能力，例如 ctx.tools、ctx.llm、ctx.agents。
- **inject：** 插件声明必须具备的服务依赖。满足后才激活；依赖变化会影响插件生命周期。它不是普通静态 import。
- **Event：** 插件之间不必直接知道彼此存在，也能发布通知、协作或拦截决策的机制。
- **Effect / disposer：** 将插件注册和外部资源清理绑定到所属生命周期；Cordis API 管理的注册可自动撤销，框架无法管理的资源需要插件用 effect/disposer 表达清理动作。
- **Fiber：** 一个插件实例的运行时记录与生命周期载体；其状态和依赖变化是后续源码研究的重点。

### 4.3 产品能力的三种角色

官方“能力的三种角色设计”将可替换能力拆成：

1. Service Definition：定义稳定的服务接口；
2. Service Provider：实现该服务；
3. Consumer：使用该服务，通常可能进一步向模型暴露工具。

Bash 示例：
- dsh-shell：定义 shell 服务；
- dsh-bash-local：提供本地 Bash 执行；
- dsh-tool-bash：消费 shell 服务并注册面向模型的 bash 工具。

更换 Provider 时，Definition 和 Consumer 可以保持不变。这是展示插件化“可组合、可替换”价值的候选案例。

### 4.4 运行时插件与分发/组合层要分开

| 概念 | 当前工作定义 | 需要避免的误解 |
|---|---|---|
| Cordis Plugin | 运行时可挂载单元 | 不等于一个 npm 包或一个 Marketplace 卡片 |
| Cordis 配置项 | Loader 插件树中的一条配置/挂载记录 | 不等于插件源码本身 |
| npm package | 代码和元数据的分发单元 | 一个包可以承载一个或多个运行时角色 |
| Bundle | 带有 Cordis 配置 Patch 层的可安装包 | 不等于一个运行时插件 |
| Profile | 具名运行环境组合，按顺序叠加 Bundle 和用户 Patch | 不等于 Bundle |
| Patch | 对插件树配置项进行插入、替换或覆盖的配置层 | 不等于插件实现 |
| Plugin Market Index | 列出可发现/安装 Bundle 的索引 | 不等于运行时注册表 |

Profile / Bundle / Patch 是理解“插件如何组成完整 Harness”的必要背景，但不能抢走本次分享的主线。

## 5. Cordis 的理论背景：两个需要验证的维度

DeepSeek Harness README 指向论文：

[A Programming Paradigm for Spatiotemporal Composability](https://arxiv.org/abs/2608.25512)

论文仓库：[cordiverse/paper](https://github.com/cordiverse/paper)。

论文摘要提出两个正交方向：

- **Temporal Composability（时间维度的可组合性）：** 一个组件退出时，如何撤销它自己的副作用，避免残留。
- **Spatial Composability（空间维度的可组合性）：** 组件依赖出现、消失或替换时，如何协调依赖方的激活与停用。

论文将其联系到可逆 Effect、响应式 Coeffect 和统一 Context，并在 Cordis 中实现相关机制。

**使用边界：** 论文是理解设计理论的主要背景材料，但它是 arXiv 预印本，不能直接代替对 DeepSeek Harness 固定版本实现的检查。后续需要将论文术语映射到实际 API、源码和测试，不能为了展示理论而让 PPT 变成 PL 论文讲解。

## 6. 后续研究问题地图

### Q1｜“一切皆插件”的准确范围
- 官方明确列举哪些能力？
- 为什么 Agent Loop 本身也可以作为插件？
- 哪些代码只是共享库、接口定义或工具函数，而不是插件？
- “插件化”描述的是运行时组成方式，还是对所有代码组织方式的要求？
- 它与普通模块化、依赖注入、扩展点设计有什么区别？

### Q2｜插件从声明到运行究竟发生什么
- 谁读取配置项、解析模块并创建插件实例？
- function / object / class 三种插件入口怎样统一处理？
- Registry、Fiber、Context 分别负责什么？
- apply 什么时候运行？失败会如何记录？
- PENDING、LOADING、ACTIVE、FAILED、UNLOADING、DISPOSED 等状态如何转换？

### Q3｜服务依赖如何驱动组合与替换
- Service 怎样注册到 Context？
- inject 如何声明硬依赖？可选依赖如何表达？
- 提供方晚于消费方出现时如何处理？
- 提供方卸载、替换或恢复时，消费方如何停用和重新激活？
- 服务命名、作用域隔离、多个 Provider 的约束是什么？

### Q4｜Effect、Event 与生命周期如何共同工作
- 哪些注册本身就是 Effect？
- 插件创建的定时器、连接、watcher 等资源怎样清理？
- 异步 disposer、父子插件、并发卸载如何处理？
- Event 的 emit / parallel / serial / bail / waterfall 各自是什么契约？
- 哪些事件用于观察，哪些事件用于修改或拦截决策？

### Q5｜Harness 如何把 Cordis 机制用于真实产品
- 模型适配器如何接入统一 LLM 服务？
- Tools、Session、Agent、Agent Loop 如何分工？
- Service Definition / Provider / Consumer 如何形成可替换能力 seam？
- 替换一个 Provider 时，Consumer 为什么不必改动？
- 哪个真实插件最适合做 PPT 案例？

### Q6｜插件树如何形成可运行的产品
- Loader 如何将配置文件变成插件树？
- Profile、Bundle、Patch 的准确关系是什么？
- HMR 如何卸载旧实例并重新挂载新实例？
- Profile 中不同 Bundle 和 Patch 的优先级如何决定最终配置？
- 插件管理器和 Plugin Market 管理的是哪一层对象？

### Q7｜设计收益、复杂度和适用边界
- 可替换性、独立演进、扩展性分别由什么机制支撑？
- 插件化增加了哪些依赖管理、生命周期、调试和诊断复杂度？
- 缺少 Provider 时的 PENDING 状态会带来什么可观测性问题？
- 什么场景适合这种插件模型，什么场景可能过度设计？
- 哪些结论是官方目标，哪些是我们的工程分析？

## 7. 后续资料入口与源码地图

### 7.1 Cordis Runtime

| 文件 | 初步职责 | 关键入口 |
|---|---|---|
| [context.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/context.ts) | Context、代理和子作用域 | Context class、extend、isolate、intercept |
| [registry.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/registry.ts) | Plugin 入口、Registry、inject、plugin() | Plugin types、RegistryService、inject、plugin |
| [fiber.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts) | 插件实例、Effect、状态和卸载 | FiberState、Fiber、effect/dispose |
| [service.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/service.ts) | Service 注册和服务实例 | Service constructor |
| [events.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/events.ts) | 事件监听和分发模式 | EventsService、on、emit、serial、waterfall |
| [reflect.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts) | Context 属性读取、服务解析 | locate、provide/get 相关逻辑 |

### 7.2 Loader 与插件树

| 文件 | 初步职责 |
|---|---|
| [vendor/loader/src/index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/index.ts) | Loader 插件、EntryTree 集成 |
| [vendor/loader/src/config/entry.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/entry.ts) | 单个插件配置项、模块导入和更新 |
| [vendor/loader/src/config/tree.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/tree.ts) | 插件树结构、创建、移动和移除 |
| [vendor/loader/src/config/group.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/group.ts) | 插件分组 |
| [vendor/loader/src/config/isolate.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/isolate.ts) | 服务作用域隔离 |

### 7.3 产品组合层

| 文件 | 初步职责 |
|---|---|
| [packages/boot/app-boot/src/profile.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/boot/app-boot/src/profile.ts) | Profile 发现、Bundle patch 层解析和组合 |
| [packages/boot/app-boot/src/profile-plugins.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/boot/app-boot/src/profile-plugins.ts) | Profile 已安装包与启用列表协调 |
| [packages/bundle/base/cordis.patch.yml](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/bundle/base/cordis.patch.yml) | 默认产品组合的实际配置树入口 |

### 7.4 测试入口

| 测试文件 | 候选验证问题 |
|---|---|
| [scripts/cordis-core-lifecycle.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/scripts/cordis-core-lifecycle.spec.ts) | Core 生命周期、依赖和配置更新行为 |
| [scripts/cordis-core-api.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/scripts/cordis-core-api.spec.ts) | 公开 Cordis API 参考与 vendored 声明一致性 |
| [scripts/cordis-loader-resolve.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/scripts/cordis-loader-resolve.spec.ts) | Loader 的模块解析与项目作用域 |
| [packages/boot/app-boot/tests/user-patches.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/boot/app-boot/tests/user-patches.spec.ts) | Patch、依赖等待、Provider 替换和卸载完成 |
| [packages/core/agent-loop/tests/resource-lifecycle.spec.ts](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/core/agent-loop/tests/resource-lifecycle.spec.ts) | Agent Loop 持有的资源与关闭过程 |

测试文件名只是证据入口。阶段 B/C 必须读取具体断言，确认它实际证明了什么，不能只凭测试名称下结论。

## 8. Vendored Cordis 的重要版本边界

DeepSeek Harness 的 [vendor/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/README.md) 说明：

- Cordis 源码以 vendor 方式放在 Harness 仓库中，由 Harness 固定版本并允许审计、打补丁；
- Cordis 上游来源 Commit 为 01b396240ce47cf2779c40af9bc445bb748fe112；
- Loader、Include、Group 等 vendored 包也有各自上游版本记录；
- Harness 对 vendored Cordis 和 Loader 存在本地修改。

特别需要在阶段 B 检查：

- **V6：** Fiber 生命周期硬化，涉及重入式卸载、异步 cleanup、UNLOADING 期间禁止新 effect、子 Fiber 所有权等；
- **V15：** Core、Loader、Include、HMR 之间的配置解析和提交行为；
- **V25：** Loader 生命周期适配，包括依赖刷新、禁用条目等待 dispose、失败 Fiber 的显式更新规则；
- 其他与实际追踪问题直接相关的本地修改。

因此：

**理论背景可以阅读 Cordis 论文和上游资料；DeepSeek Harness 的实际行为必须以这个固定 Harness Commit 内的 vendor 源码和测试为准。**

不能直接拿 Cordis 上游 master 的行为替代 Harness 实际实现。

## 9. 真实插件案例候选

当前不提前选定案例。阶段 C 按“讲得清楚、证据完整、范围可控”进行比较。

| 候选 | 可以说明什么 | 可能的问题 |
|---|---|---|
| Cordis Tutorial 的 greet-tool | 最小插件、inject、工具注册和事件观察 | 属于教学示例，不足以代表复杂产品 |
| Bash 三角色组合：dsh-shell / dsh-bash-local / dsh-tool-bash | Service Definition、Provider、Consumer、Provider 可替换 | 涉及多个插件，需讲清角色而不是只讲一个文件 |
| dsh-llm-pi-ai | LLM Provider Adapter 如何接入统一 LLM 服务 | 协议和模型路由细节可能分散注意力 |
| dsh-agent-loop | Agent Loop 本身如何作为可替换插件 | 代表性强，但实现范围和复杂度较高 |

阶段 C 应先比较候选的依赖数、关键文件数、生命周期路径、测试证据和分享价值，再确定一个主案例；必要时用一个小教程示例作辅助，不把多个案例都塞进 PPT。

## 10. 阶段 A 的结论与未解决事项

### 已完成

- 核验官方仓库默认分支与固定 SHA；
- 确认官方资料不止 8 份，建立了分层资料地图；
- 建立 Everything is a Plugin 的初步解释和概念边界；
- 区分 Plugin、Service、Context、配置项、npm package、Bundle、Profile、Patch；
- 找到 Cordis 理论论文；
- 找到 Cordis、Loader、Profile/Bundle 的核心源码和测试入口；
- 识别 Harness vendored Cordis 的本地修改，避免误用上游源码；
- 建立真实插件候选，不提前锁定复杂案例。

### 尚未完成

- 尚未完整追踪 Registry → Fiber → Context → Service 的运行调用链；
- 尚未完整核验 inject 对服务出现、消失、替换的处理；
- 尚未核验所有 effect/disposer 的异步与并发清理边界；
- 尚未通过具体测试断言验证关键行为；
- 尚未实际运行最小示例；
- 尚未选定真实产品插件；
- 尚未对设计收益与成本形成最终结论；
- 尚未开始 PPT 大纲或页面制作。

**阶段 A 不是“Everything is a Plugin 已经研究完成”。它只完成了研究地图和证据入口。**

## 11. 下一阶段：阶段 B｜研究 Cordis 的真实运行机制

下一阶段只聚焦 Cordis Runtime 和 Loader，不开始全产品案例分析。

建议按以下顺序：

1. 从 Plugin 入口和 Registry 开始：插件有哪些入口形态，如何创建 Fiber；
2. 追踪 Context 和 Service：服务如何注册、读取、隔离；
3. 追踪 inject：依赖如何决定 Fiber 激活，Provider 替换时发生什么；
4. 追踪 Effect 和 Fiber dispose：注册如何归属、清理如何等待、父子关系如何处理；
5. 追踪 Event：监听注册、分发模式、卸载时清理；
6. 阅读对应测试，逐项核实边界行为；
7. 只有源码和测试仍无法回答的问题，才设计最小、无 API Key 的运行验证。

阶段 B 的研究结果写入 03-research-notes.md。阶段 B 通过审核后，再进入阶段 C 选择真实插件。

## 更新记录

- 2026-11-28：完成阶段 A。根据固定 Commit 检查官方文档、包结构、Cordis vendor 记录、核心源码入口和测试入口；建立问题地图、概念边界与阶段 B 路线。没有执行真实插件运行实验，没有声称源码机制已经全部验证。
