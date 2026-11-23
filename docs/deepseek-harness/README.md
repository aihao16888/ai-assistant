# DeepSeek Harness：产品思想、Cordis 架构与 Agent 扩展方式

> 研究笔记｜更新日期：2026-11-23  
> 目标：从产品背景、底层架构和扩展机制三个层面理解 DeepSeek Harness，并明确企业业务系统如何接入不同 Agent 宿主。  
> 研究原则：区分官方明确说明、上游项目可验证的历史证据、以及基于证据的工程分析；不把推断写成官方结论。

---

## 0. 先给结论

1. **DeepSeek Harness 是 Agent Harness 产品与运行平台。** 模型负责推理，Harness 提供工具、执行环境、上下文、会话、任务控制和持续运行能力。
2. **Cordis 是 DeepSeek Harness 内部使用的插件框架。** 它负责插件挂载、服务依赖、上下文、事件和可逆副作用；它不是模型、MCP、业务系统，也不是操作系统级沙箱。
3. **“一切皆插件”首先描述的是 Harness 自身的内部架构。** 模型适配器、工具注册表、会话日志、Agent Loop、沙箱、存储、调度和 UI 等能力由插件提供，能够在配置层组合、替换和扩展。
4. **不同 Agent 产品里的 Plugin 不是统一的二进制或代码标准。** Cordis Plugin、Codex Plugin、Claude Code Plugin 的宿主接口和包结构不同，不能把一个平台的插件直接安装到另一个平台。
5. **Tool、MCP、Skill、Plugin 是不同层次。** Tool 是一个可调用动作；MCP 是客户端与外部服务之间的协议；Skill 是指导模型完成任务的工作方法；Plugin 是由宿主定义的扩展/分发单元，可以把前述能力组织在一起。
6. **企业不需要把整个业务系统重写成插件。** 更合理的做法是保留原有业务系统，在其上增加面向 Agent 的业务能力接口（例如 MCP Server），再按不同宿主的规范制作薄适配包。

---

## 1. DeepSeek Harness 是什么：Model 与 Harness 的分工

DeepSeek 官方使用公式：

**Agent = Model + Harness**

这里的 Model 是负责理解、推理和生成下一步动作的模型；Harness 则提供模型在真实环境中持续工作的执行条件。

模型本身不会天然拥有某台电脑的文件权限、Shell、浏览器、数据库连接、会话持久化、后台任务调度或业务系统身份。它需要一个应用运行环境把这些能力提供出来，并在模型请求、工具执行、结果回传和后续推理之间进行编排。

可以把职责拆成：

| 层次 | 主要职责 | 例子 |
|---|---|---|
| Model | 理解意图、推理、规划、选择动作 | 生成工具调用、解释结果 |
| Agent Loop / Runtime | 驱动模型与工具反复交互，管理一轮任务 | 请求模型、执行工具、继续下一步 |
| Execution Environment | 提供真实操作能力与边界 | 文件系统、Shell、Browser、Sandbox |
| Context / Session | 管理模型可见上下文和执行历史 | 系统提示、会话事件、恢复与回放 |
| Extension Mechanism | 组织、替换和扩展运行能力 | Cordis Plugin、Bundle、Profile |

**关键点：Harness 不是另一个模型，也不等于工具集合。** 它是把模型、工具、环境、状态和控制机制组织成可运行 Agent 的应用层与运行层。

官方产品页把 Harness 的价值描述为：让 Agent 理解环境、使用工具，并在真实场景中持续工作。

来源：
- [DeepSeek Harness 官方产品页](https://www.deepseek.com/harness/zh/)
- [DeepSeek Harness 架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.zh.md)

## 2. “一切皆插件”在 DeepSeek Harness 中究竟是什么意思

DeepSeek 官方产品页明确写出：

- 模型、工具、技能、会话、沙箱、存储、循环、调度、UI 等 Agent 能力均由插件组合而成；
- Cordis 内核只负责插件加载、卸载和依赖关系，不承载 Agent 的具体能力；
- 插件通过 Cordis 服务与事件协作；
- 开发者可以在配置层选择、替换或扩展能力，而不必修改 Harness 源码。

这句话的适用范围首先是 **DeepSeek Harness 自身的产品架构**。

例如，Harness 的 Agent Loop 本身也可以是插件；模型适配器也可以是插件；Session 持久化实现也可以是插件。它不是“所有外部软件都必须变成 Cordis Plugin”，也不是“每个 API 都要做成一个插件”。

更准确的理解：

> Harness 将自身的主要能力拆成可挂载的插件组件；Cordis 管理这些组件的生命周期和协作；配置层决定某个 Profile 最终由哪些组件组成。

官方架构文档进一步说明：
- 运行中的 DSH 是一棵插件树；
- Profile 是具名组装，声明要叠加哪些 Bundle、安装哪些外部插件，以及用户自己的配置 Patch；
- Bundle 是 Cordis 配置项及其挂载代码的分发格式；
- Profile、Bundle 和 Patch 共同决定最终运行时组合。

因此，“一切皆插件”是一个**产品内部的模块化和可组合架构原则**，不是说所有业务软件都要改写成同一种插件代码。

来源：
- [官方产品页：一切皆插件](https://www.deepseek.com/harness/zh/)
- [官方架构：Cordis、Profile 与 Bundle](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.zh.md)

## 3. Cordis 的角色：Harness 内部的插件运行框架

### 3.1 Cordis 负责什么

Cordis 是 DeepSeek Harness 底层使用的插件框架。Harness 官方文档描述，插件向共享 Context 提供 Service、类型化 Event 和可逆副作用。

它主要负责：

- 挂载和卸载插件；
- 管理插件所声明的服务依赖；
- 提供共享 Context，让插件按服务键访问能力，而不是导入另一个插件的具体实现；
- 管理插件注册的事件监听器和其他副作用；
- 在插件卸载时撤销由该插件拥有的注册；
- 配合 Loader、配置 Patch 和 HMR 组织插件树。

### 3.2 Cordis 不负责什么

Cordis 本身不负责：

- 模型推理；
- 决定 Agent 的业务目标；
- 实现具体的文档管理、审批或项目管理逻辑；
- 定义 MCP 协议；
- 自动提供操作系统级安全沙箱；
- 保证模型的推理结果正确；
- 自动撤销已经发生的外部业务动作，例如已经发出的邮件或已经审批通过的文档。

因此，“Cordis 管理插件”是正确的，但不能把它理解成整个 Agent Runtime。它是 Runtime 的基础组件之一；Agent Loop、Tool、Session、Sandbox 等具体能力由其他插件实现。

### 3.3 Cordis 的核心概念

| 概念 | 专业解释 | 直观理解 |
|---|---|---|
| Plugin | 可由 Cordis 挂载的组件 | 一个可加入运行系统的模块 |
| Context | 插件运行时的上下文与服务容器 | 插件访问受管理能力的入口 |
| Service | 插件向 Context 提供的能力接口 | 其他模块可以使用的服务 |
| inject | 声明需要哪些 Service | “我依赖这些能力，准备好后再启动我” |
| Event | 插件之间的事件通信 | “发生了某件事，关心者可以监听” |
| Effect / disposer | 记录副作用及其撤销方式 | 插件退出时把自己注册的资源收回来 |
| Loader / Patch | 加载和组合插件配置 | 决定这次运行由哪些插件组成 |

### 3.4 两个核心设计维度

Cordis 论文将问题概括为两个正交维度：

**Temporal Composability（时间可组合性）**

组件可以被加载、运行、移除；移除时，运行时能够撤销该组件造成的副作用。这里的副作用包括服务注册、事件监听、定时器、连接等运行时资源。

**Spatial Composability（空间可组合性）**

组件能够声明自己依赖哪些其他组件提供的能力，并对依赖的出现或消失作出响应。这里的“空间”不是地理空间或物理世界，而是同一软件运行环境中的组件关系。

合起来就是：组件不但可以拆分，还能在运行期间动态加入和退出；系统知道谁依赖谁，也能管理退出时的清理。

### 3.5 用一个最小例子理解

假设：
- Plugin A 提供 DocumentService；
- Plugin B 声明依赖 DocumentService；
- Plugin B 使用该服务注册一个文档查询 Tool。

当 A 被卸载时，B 不应该继续调用一个已经不存在的服务；B 所拥有的 Tool 注册和监听器也应随其卸载而清理。新的 Provider 再次提供兼容服务后，依赖关系可以重新满足。

这就是 Cordis 的插件依赖与生命周期管理。

### 3.6 Cordis 与 Java Spring 的关系

可以用 Spring 做类比，但不能认为两者完全相同：

| Java / Spring 常见概念 | Cordis 对应概念 |
|---|---|
| IoC Container / ApplicationContext | Context |
| Bean / Service Provider | Plugin 提供的 Service |
| Dependency Injection | inject |
| Application Event | Event |
| Bean destroy callback / resource cleanup | Effect / disposer |
| Spring Configuration / Module | Plugin、Loader、配置组合 |

Spring 也能做模块化、事件、生命周期和动态扩展；差异在于 Cordis 把插件运行期间的依赖变化、卸载和副作用撤销作为核心抽象。Cordis 的思路可以用其他语言实现，不依赖 TypeScript 语法；但 DeepSeek Harness 当前的 Cordis 插件开发接口是 TypeScript/Node.js 生态。

来源：
- [DeepSeek Harness Cordis Primer](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.zh.md)
- [DeepSeek Harness Cordis Tutorial](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/index.zh.md)
- [Cordis 上游仓库](https://github.com/cordiverse/cordis)
- [Cordis 论文：A Programming Paradigm for Spatiotemporal Composability](https://arxiv.org/abs/2608.25512)

## 4. 重要的来源核查：DeepSeek 是否直接引用了 Koishi？

这是本研究特别核查的问题。结论必须谨慎表述。

### 4.1 本次查到的直接证据

DeepSeek Harness 仓库的 vendor/README.md 明确说明，Cordis 源码被 vendored 到 DeepSeek Harness 仓库中，并在 Manifest 中记录了：

- DSH 内部包名：@deepseek-ai/cordis；
- 上游项目：https://github.com/cordiverse/cordis；
- 上游版本；
- 对应的上游 Git Commit。

这证明 DeepSeek 直接采用的代码来源是 Cordis 上游仓库 cordiverse/cordis，并且通过固定版本/Commit 管理 vendored 源码。

### 4.2 DeepSeek 是否在自己的文档中直接引用 Koishi？

本次检查了：
- DeepSeek Harness 官方产品页；
- docs/architecture.zh.md；
- docs/cordis-primer.zh.md；
- vendor/README.md；
- 仓库默认分支中对 “Koishi” 的代码/文件检索。

在上述核查范围内，没有发现 DeepSeek 官方文档直接引用 Koishi、链接 Koishi 项目，或明确写出“本项目设计参考 Koishi”。

因此，不能写成“DeepSeek 官方明确说明参考 Koishi”。这句话没有得到官方材料支持。

### 4.3 为什么仍然可以追溯到 Koishi 生态？

Koishi 自己的官方历史记录显示：

- Koishi 最初于 2019 年开始开发；
- v1 于 2020 年 1 月发布，已经有插件系统、事件模型和中间件；
- v2 引入应用级资源管理和生命周期钩子；
- v3 引入 Adapter/Bot 抽象和插件热重载；
- v4 引入 Service，以类似 IoC/DI 的方式管理功能。

Koishi 4.7.1 的发布记录明确宣布发布 Cordis 核心包，作为 Koishi 的底层框架，提供 Context、插件系统和事件模型。

Koishi 官方设计文章《Disposable Plugin System》进一步解释了 Cordis 的设计动机：普通插件注册的资源未必有对应的卸载 API；插件卸载后可能残留事件监听、定时任务、服务等资源；如果无法可靠回收，复杂系统往往只能重启。Cordis 因此强调可逆性、资源回收和插件依赖管理。

Cordis 上游仓库的 package metadata 将作者列为 Shigma。Koishi 的历史与设计文章，是理解 Cordis 早期背景的重要一手资料。

### 4.4 证据等级与最终表述

| 判断 | 证据等级 | 是否可以这样说 |
|---|---|---|
| DeepSeek Harness 使用 Cordis | DeepSeek 官方文档和源码 | 可以确认 |
| DSH vendored 的 Cordis 来自 cordiverse/cordis | DeepSeek vendor manifest | 可以确认 |
| Cordis 与 Koishi 项目历史密切相关 | Koishi 官方历史、发布记录、设计文章及 Cordis 包元数据 | 可以确认 |
| DeepSeek 官方明确说“参考 Koishi” | 本次检查未找到直接声明 | 不可以这样说 |
| DeepSeek 选用 Cordis 的内部决策过程 | 未见完整官方披露 | 只能作为工程分析，不能冒充官方事实 |

**最严谨的结论：DeepSeek 明确采用了上游 Cordis；Cordis 有 Koishi 生态的历史来源和设计背景。但在本次核查范围内，没有证据证明 DeepSeek 官方直接引用或明确声明参考了 Koishi。**

来源：
- [DeepSeek Harness vendor/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md)
- [Koishi 官方 History](https://koishi.chat/en-US/about/history)
- [Koishi 4.7.1 发布记录](https://github.com/koishijs/koishi/discussions/691)
- [Koishi 官方设计文章：Disposable Plugin System](https://koishi.chat/en-US/cookbook/design/disposable)
- [Cordis 上游 package.json](https://github.com/cordiverse/cordis/blob/main/packages/core/package.json)

## 5. Plugin、Tool、MCP、Skill：它们不是同一层次

这些概念在不同 Agent 平台中会一起出现，因此容易被混淆。

| 概念 | 本质 | 主要回答的问题 | 示例 |
|---|---|---|---|
| Plugin | 宿主平台定义的扩展/分发单元 | 如何把一组能力安装、启用、更新和分发？ | Document Management Plugin |
| Tool | 可被 Agent 调用的具体操作 | Agent 能执行什么动作？ | search_documents |
| MCP | Host/Client 与 Server 之间的协议 | Agent 应用如何发现并调用外部能力？ | Document MCP Server |
| Skill | 工作流程、规则、知识和指令 | Agent 应该怎样完成一个任务？ | Document Approval Workflow |
| API | 软件系统提供的程序接口 | 一个软件如何调用另一个软件？ | Spring Boot REST API |

### 5.1 Tool

Tool 是具体动作，通常包含名称、描述、参数 Schema 和执行逻辑。

例如：
- search_documents
- get_document_detail
- upload_document
- submit_document_for_approval

Tool 可以是宿主内部原生注册的，也可以由 MCP Server 提供。

### 5.2 MCP

MCP 是协议，不是某个工具，也不是一个插件包。

MCP Host 是 Agent 应用；MCP Client 负责连接某个 MCP Server；MCP Server 可以暴露：
- Tools：可执行动作；
- Resources：可读取的数据和上下文；
- Prompts：可复用的提示模板。

同一个 MCP Server 可以被多个支持 MCP 的 Agent Host 连接。MCP 解决的是互操作和能力发现/调用协议，不替代业务系统自身的权限和规则。

### 5.3 Skill

Skill 是面向模型的工作方法说明。它告诉模型：
- 什么时候使用某项能力；
- 任务需要哪些步骤；
- 哪些信息必须先检查；
- 如何组合多个 Tools；
- 出现异常或信息不完整时怎么处理；
- 最终结果应该怎样呈现。

Skill 不等于后端权限。Skill 是指导模型的说明，真正的授权和业务约束必须由服务端强制执行。

### 5.4 Plugin

Plugin 是宿主平台定义的打包/加载边界。它可以包含一个或多个 Skills、MCP Server 配置、Hooks、Agents、UI 或宿主专属代码。

因此：
- Tool 可以由 Plugin 注册；
- MCP Server 可以作为 Plugin 的一部分被配置；
- Skill 可以被 Plugin 打包；
- 但 Tool、MCP、Skill 本身并不天然等于 Plugin。

---

## 6. 为什么不同 Agent 平台的 Plugin 不能直接通用？

“Plugin”不是所有平台共享的统一二进制格式。它是各个宿主产品自己的扩展契约。

### 6.1 DeepSeek Harness

DSH 的原生 Plugin 是 Cordis 可挂载的运行时模块。插件作者使用 TypeScript，通过 Context、Service、inject、Event、Effect 等机制与 Harness 内部能力协作。

它可以注册 DSH 原生 Tool、Service、Hook 或 UI 扩展。

### 6.2 Codex / OpenAI Agent Plugins

OpenAI 当前的插件文档将 Plugin 定义为可安装和分发的包，可以组合 Skills、MCP Server 配置，以及特定运行环境支持的 Hooks、UI 等能力。它有自己的 Manifest 和目录结构。

它不是 Cordis Plugin，也不需要实现 DSH 的 apply(ctx)。

### 6.3 Claude Code

Claude Code Plugin 是一个由 Claude Code 安装和加载的目录单元，通常有 .claude-plugin/plugin.json，可以包含：
- Skills；
- Agents；
- Hooks；
- MCP Servers；
- 其他组件。

它也不是 Cordis Plugin。

### 6.4 跨平台复用策略

不应追求“一个原生插件包直接安装到所有平台”。更合理的架构是：

1. 共享一套与宿主无关的业务 API / MCP Server；
2. 共享或适配 Skill 的业务流程内容；
3. 按 DSH、Codex、Claude Code 各自的规范制作薄包装；
4. 宿主特有的 UI、Hook、生命周期代码分别实现。

这样复用的是业务能力和协议，而不是假设三个宿主的插件运行时完全相同。

来源：
- [OpenAI Plugins：插件架构](https://developers.openai.com/plugins/concepts/plugins)
- [OpenAI Plugins：打包插件](https://developers.openai.com/plugins/build/plugins)
- [Claude Code Plugins Overview](https://code.claude.com/docs/en/plugins)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture)

## 7. 企业复杂业务系统如何面向 Agent 开放？

以现有 Spring Boot 文档管理平台为例。

### 7.1 不要把整个系统搬进 Agent

原有系统继续保留：
- Web 前端；
- Spring Boot 后端；
- 数据库；
- 文件存储；
- 版本管理；
- 审批工作流；
- 用户和权限体系。

新增的是一层 Agent-facing Integration Layer（面向 Agent 的接入层）。

建议架构：

~~~text
员工
 ├── 原有 Web 前端
 └── Agent Host（DeepSeek Harness / Codex / Claude Code）
              |
          MCP Client
              |
       Document MCP Server
              |
     Agent-facing Application Service
              |
     原有 Spring Boot Service / API
              |
     数据库 / 文件存储 / 审批工作流
~~~

### 7.2 不要把 100 个 CRUD API 原样暴露给模型

前端 API 通常是按页面、表单和 CRUD 操作设计的；Agent 工具应该按业务意图设计。

不建议把所有底层 API 直接变成大量细碎工具。

可以先提炼出少量业务能力：

| 业务能力 | Agent Tool 示例 |
|---|---|
| 文档检索 | search_documents |
| 文档详情 | get_document_details |
| 版本比较 | compare_document_versions |
| 上传文档 | upload_document |
| 审批任务查询 | list_my_pending_approvals |
| 审批材料准备 | prepare_document_approval |
| 提交审批 | submit_document_for_approval |
| 查询审批状态 | get_approval_status |

一个 Tool 内部可以组合多个现有 Service/API。模型不应该自己拼接一堆底层 HTTP 请求。

### 7.3 如何让 Agent 理解业务任务

至少需要四层：

1. **业务语义**：解释项目、文档、版本、审批、角色、状态之间的关系。
2. **业务 Tools**：提供名称、描述、输入输出 Schema 清晰的业务动作。
3. **Skills / Workflow**：说明如何把多个 Tool 组合成一个任务流程。
4. **后端规则**：强制执行身份、权限、状态校验、事务、幂等和审计。

Agent 负责理解意图和组织步骤；后端负责保证业务操作合法、正确。

### 7.4 安全边界

尤其是上传、删除、提交审批、批准和驳回等写操作：
- 以当前员工身份执行，不能让所有员工共享一个高权限服务账号；
- 后端重新校验员工、部门、项目和文档权限；
- 高风险写操作要有明确的用户确认；
- 记录操作人、请求参数、时间、结果和关联业务 ID；
- 对重试和重复提交提供幂等保护；
- 文件上传下载应通过受控文件服务处理，不应把大文件二进制塞进模型文本上下文；
- 长任务应返回可追踪任务 ID，而不是让模型假定请求已经完成。

### 7.5 一个业务能力如何被多个平台使用

假设 Document MCP Server 已经提供工具：

~~~text
Document MCP Server
  ├── search_documents
  ├── get_document_details
  ├── compare_document_versions
  ├── upload_document
  └── submit_document_for_approval
~~~

那么：
- DSH 使用 MCP Client Plugin 连接它；
- Codex 通过自身支持的 MCP 配置/Plugin 包装连接它；
- Claude Code 通过 .mcp.json 或其 Plugin 结构连接它。

真正复用的是 Document MCP Server 和后端业务服务，不是把一个 Cordis Plugin 原封不动安装到三个宿主。

### 7.6 推荐实施顺序

1. 只读试点：文档搜索、详情、版本和审批状态查询；
2. 身份与权限：验证不同员工只能看到自己有权访问的数据；
3. 低风险写操作：上传、补充元数据、创建版本；
4. 高风险工作流：提交审批、批准、驳回，增加确认和审计；
5. Skills：沉淀企业真实流程、材料检查和异常处理；
6. 宿主适配：先接入一个 Agent Host，稳定后再适配其他平台。

---

## 8. 对“一切皆插件”和“软件已死”的判断

“一切皆插件”不等于“所有软件都要消失”。

更准确的变化是：

- 传统软件仍然提供稳定的数据、业务规则、流程和界面；
- Agent Host 提供自然语言交互、任务拆解和跨系统编排；
- Tool/MCP 提供可调用的业务能力；
- Skill 提供流程知识；
- Plugin 把能力组织成特定宿主可安装、管理和分发的扩展。

一个企业业务系统可以同时服务：
- 人类用户：通过 Web 页面、表单、可视化工作台；
- Agent 用户：通过受控业务工具和任务流程。

因此，未来不是“不要做软件，只做插件”，而是**软件需要同时设计面向人的交互界面和面向 Agent 的能力接口**。

---

## 9. 关键术语速查

| 术语 | 一句话 |
|---|---|
| Harness | 让模型在真实环境中持续执行任务的应用和运行基础设施 |
| Cordis | DSH 使用的插件组合与生命周期管理框架 |
| Plugin | 宿主定义的扩展和分发单元 |
| Bundle | DSH 用来分发 Cordis 配置与插件代码的组合包 |
| Profile | DSH 的具名运行组合方案 |
| Context | Cordis 插件访问服务和管理副作用的上下文 |
| Service | 插件向其他插件提供的能力接口 |
| inject | 声明插件依赖哪些服务 |
| Effect | 记录副作用及其清理/撤销操作 |
| Tool | Agent 可调用的具体动作 |
| MCP | Agent Host/Client 与外部 Server 之间的协议 |
| Skill | 指导模型如何完成可复用任务的说明和资源 |
| Agent-facing API | 按业务语义设计、供 Agent 调用的业务接口 |

---

## 10. 参考资料与证据范围

以下优先列一手资料。DeepSeek 当前代码和文档仍在迭代，引用的 GitHub master 链接是本次核查时的版本；后续应以实际 Commit 为准。

### A. DeepSeek 官方资料

1. [DeepSeek Harness 官方产品页](https://www.deepseek.com/harness/zh/)  
   产品定位、“一切皆插件”、Cordis 内核职责、运行模式。
2. [DeepSeek Harness Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.zh.md)  
   Cordis、Profile、Bundle、核心包、事件域、会话日志和能力扩展点。
3. [Cordis Primer](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.zh.md)  
   Plugin、Context、Service、inject、Event、Effect。
4. [Cordis Tutorial](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/index.zh.md)  
   从第一个插件、Effect、Service、Event 到真实 Harness Tool 的实践。
5. [Vendored Packages Manifest](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md)  
   Cordis 的上游仓库、版本、Commit 和本地修改记录。
6. [Extension Cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)  
   Tool Plugin、Hook Plugin、MCP、Skill、Memory、Schedule、UI 等扩展形态。

### B. Cordis / Koishi 来源资料

7. [Cordis 上游仓库](https://github.com/cordiverse/cordis)  
   Cordis 的独立上游项目。
8. [Cordis core package metadata](https://github.com/cordiverse/cordis/blob/main/packages/core/package.json)  
   包的仓库位置和作者元数据。
9. [Koishi History](https://koishi.chat/en-US/about/history)  
   Koishi 从 2019 年起的演进，包括插件系统、生命周期、热重载和 Service。
10. [Koishi 4.7.1 Release](https://github.com/koishijs/koishi/discussions/691)  
    发布 Cordis 核心包的历史记录。
11. [Disposable Plugin System](https://koishi.chat/en-US/cookbook/design/disposable)  
    Cordis 设计者对可逆插件系统、资源回收、Context 和依赖关系的解释。
12. [A Programming Paradigm for Spatiotemporal Composability](https://arxiv.org/abs/2608.25512)  
    Cordis 的时空可组合性理论形式化。

### C. Agent Plugin / MCP 官方资料

13. [OpenAI Plugin Architecture](https://developers.openai.com/plugins/concepts/plugins)  
    Skills、MCP Server、UI 与 Plugin 的关系。
14. [OpenAI Package Your Plugin](https://developers.openai.com/plugins/build/plugins)  
    OpenAI/Codex 侧的插件清单和打包方式。
15. [Claude Code Plugin Overview](https://code.claude.com/docs/en/plugins)  
    Claude Code 插件目录、Skills、Agents、Hooks 和 MCP Servers。
16. [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture)  
    MCP Host、Client、Server、Tools、Resources、Prompts 和传输层。

---

## 11. 本文结论的边界

- 本文没有声称 DeepSeek 官方明确引用 Koishi；本次查验只确认 DeepSeek vendored 的直接上游是 Cordis。
- 本文没有把 Cordis 说成 MCP 或安全沙箱。
- 本文没有把三个 Agent 平台的 Plugin 说成同一种技术格式。
- 本文提出的企业文档管理接入架构是基于官方能力边界作出的工程建议，不是 DeepSeek 官方承诺的企业产品方案。
- 在真实企业实施前，仍需对具体 Agent Host 的插件 API、认证、权限、文件传输、审计、运行隔离和版本兼容性做专项验证。
