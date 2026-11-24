# 05｜Tool、Skill、MCP 与 Plugin 的边界

> 更新日期：2026-11-24｜资料核查：2026-11-24｜归属：DeepSeek Harness 专题｜关联任务：从 Harness 原理到 Agent 开发与业务系统集成

> 本篇是从“理解 Harness”转向“面向 Agent 开发”的关键章节。四个概念不是同一层次，也不能互相替代。

## 1. 一张表先区分清楚

| 概念 | 本质 | 主要回答的问题 | 典型内容 |
|---|---|---|---|
| Tool | 一个可调用动作 | Agent 能执行什么？ | 搜索文档、查询审批状态 |
| Skill | 一套任务指令和工作方法 | Agent 应该怎样完成任务？ | 先检索、再比较、最后生成审批清单 |
| MCP | Host / Client 与外部 Server 的协议 | Agent 如何发现并调用外部能力？ | 连接远程文档 MCP Server |
| Plugin | 宿主定义的扩展和分发单元 | 如何把一组能力安装、配置和管理？ | DSH Cordis Bundle、Codex Plugin |

最容易记住的区分：

- Tool 是动作。
- Skill 是工作方法。
- MCP 是连接协议。
- Plugin 是宿主扩展与分发边界。

## 2. Tool：模型可以调用的具体动作

一个 Tool 通常包含：

- 名称；
- 描述；
- 输入参数 Schema；
- 执行逻辑；
- 规范化返回值；
- 错误语义。

例如：

~~~text
search_documents
get_document_details
compare_document_versions
list_pending_approvals
~~~

Tool 应该围绕一个清楚的业务目标设计，而不是把数据库表或所有 CRUD 接口不加区分地暴露给模型。

在 DeepSeek Harness 中，原生 Tool 可以通过 ctx.tools 注册；外部 MCP Server 暴露的 Tool 也可以被 MCP Client 桥接到 Harness 的工具系统。

## 3. Skill：告诉 Agent 怎样使用能力

Skill 主要提供可复用的任务指令、步骤、约束和结果要求。

例如，文档审批 Skill 可以说明：

1. 先确认用户要处理的项目；
2. 搜索该项目的有效文档；
3. 找到最新版本并比较上一版本；
4. 检查审批材料是否齐全；
5. 生成待补充材料清单；
6. 只有用户确认后才调用提交审批工具。

Skill 本身不应承担后端权限校验，也不应假装自己能执行不存在的动作。真正的数据读取、状态变更和授权仍然由 Tool 背后的业务服务完成。

### DeepSeek Harness 的 Skill 不是一个简单 Prompt 字段

当前 DSH 源码将 Skill 实现为一套独立能力：

- **Skill Registry**：通过 ctx.skills 管理 Skill；
- **Provider**：从本地目录、随包内容或其他来源发现 Skill；
- **Consumer**：负责展示目录和按需加载完整指令；
- **skill Tool**：为模型提供加载 Skill 正文的入口。

本地发现目录包括项目级 .dsh/skills、项目级 .agents/skills、自定义目录和用户目录等。模型通常先看到 Skill 名称与描述，在需要时再加载完整内容，而不是每轮都把所有 Skill 正文塞进上下文。

当前 DSH 还区分 modelInvocable 与 userInvocable 两种调用策略，控制 Skill 是否面向模型或用户开放。

## 4. MCP：把外部能力接入 Agent 的协议

MCP（Model Context Protocol）定义了客户端与服务器之间的交互方式。

典型角色：

- **MCP Host**：承载 Agent 的应用，例如 DeepSeek Harness；
- **MCP Client**：由 Host 使用，负责连接 MCP Server；
- **MCP Server**：向外提供工具、数据或其他协议能力。

MCP 协议包含的能力类型不止 Tool：

| MCP 能力 | 作用 |
|---|---|
| Tools | 可执行动作 |
| Resources | 可读取的数据和内容 |
| Prompts | 可复用的提示模板 |

但要注意：协议标准支持某项能力，不代表每个 MCP Client 都完整实现了它。当前 DeepSeek Harness 支持 MCP Tools 和按需读取 Resources；其 MCP Prompt 模板、人类输入 elicitation、task-based execution 和 resource subscriptions 当前不受支持。实施时要以具体 Host 的能力矩阵为准。

## 5. Plugin：宿主如何组织和分发扩展？

Plugin 是宿主产品定义的扩展契约，不是一个跨平台通用二进制格式。

在 DeepSeek Harness 中，原生 Plugin 是 Cordis 可挂载的模块，Bundle 是它的分发组合形式。

一个 DSH Plugin 可以注册 Tool、提供 Service、监听 Event、贡献 Skill Provider，或者注册一个由插件生命周期管理的 MCP Server。

但 MCP Server 本身不是 Cordis Plugin；Java MCP Server 也不会因为接入 Harness 就变成 TypeScript 插件。

## 6. 四者如何组合？

以文档审批为例：

~~~text
用户提出“准备项目 A 的审批材料”
    ↓
Skill：解释审批材料准备流程
    ↓
Agent 选择 Tool
    ↓
MCP Client 调用 Document MCP Server
    ↓
Java 后端执行查询和业务校验
    ↓
Tool 返回结构化结果
    ↓
Skill 指导 Agent 汇总缺失材料
    ↓
用户确认后再执行提交工具
~~~

这里：

- Skill 负责流程指导；
- Tool 负责具体动作；
- MCP 负责跨进程、跨语言连接；
- Plugin 负责宿主侧的扩展、配置和分发。

## 7. 设计时的判断方法

| 需求 | 优先考虑 |
|---|---|
| 需要执行一个明确动作 | Tool |
| 需要告诉模型如何组合多个动作 | Skill |
| 需要把外部服务能力接入 Agent | MCP |
| 需要为某个宿主打包、安装和管理一组扩展 | Plugin |
| 需要跨多个 Agent Host 复用业务能力 | 业务 API / MCP Server |
| 需要把业务权限强制落在服务端 | Java 后端权限与业务规则 |

## 8. 本篇应掌握的结论

不要把 Tool、Skill、MCP、Plugin 当成四种互斥的实现方案。它们解决的是不同层次的问题，可以组合使用。

## 9. 官方来源

- [DeepSeek Harness Skills 子系统（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/subsystems/skills.zh.md)
- [DeepSeek Harness Tool 扩展手册（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cookbook/extension-cookbook.zh.md)
- [DeepSeek Harness MCP Client（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/mcp/mcp-client/README.zh.md)
- [MCP 官方架构说明](https://modelcontextprotocol.io/docs/learn/architecture)

**下一篇：** [06｜DeepSeek Harness 的 MCP 接入机制](./06-dsh-mcp-integration.md)。把 MCP 的通用概念落实到 DSH 已有的客户端和服务器管理能力。


## 更新记录

- 2026-11-24：按编号学习路径拆分原单文件，补充官方来源核查并明确技术边界。
