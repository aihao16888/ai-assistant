# 10｜术语表与参考资料

> 更新日期：2026-11-24｜归属：DeepSeek Harness 专题｜关联任务：从 Harness 原理到 Agent 开发与业务系统集成

> 本篇是整个目录的术语和来源索引。若正文与官方实现不一致，以对应固定版本的官方文档和源码为准。

## 1. 核心术语

| 术语 | 本目录中的含义 |
|---|---|
| Model | 负责理解、推理和生成动作的模型 |
| Agent | Model 与 Harness 协作后形成的任务执行整体 |
| Harness | 组织模型、工具、上下文、循环、会话和执行控制的运行环境 |
| Agent Host | 承载 Agent 的应用或宿主 |
| Cordis | DeepSeek Harness 使用的插件加载、依赖和生命周期框架 |
| Plugin | 宿主定义的扩展单元 |
| Context | Cordis 插件访问服务和管理副作用的上下文 |
| Service | 通过稳定 key 提供的能力接口 |
| inject | 插件声明依赖的 Service |
| Event | 插件间观察或干预运行过程的事件 |
| Effect / disposer | 插件注册副作用及对应的清理方式 |
| Profile | DSH 的具名运行组合 |
| Bundle | DSH 的插件配置与代码分发单元 |
| Patch | 对 Cordis 插件条目进行插入或覆盖的配置层 |
| Tool | Agent 可以调用的具体动作 |
| Skill | 指导 Agent 完成可复用任务的指令和资源 |
| MCP | Host / Client 与外部 Server 交互的开放协议 |
| MCP Host | 承载 MCP Client 的 Agent 应用 |
| MCP Client | 连接 MCP Server 并桥接能力的客户端 |
| MCP Server | 对外提供 Tools、Resources、Prompts 等能力的服务 |
| Streamable HTTP | MCP 的 HTTP 传输方式，适用于独立部署的远程服务 |

## 2. 证据等级

本目录使用以下表述规则：

| 等级 | 含义 | 写法 |
|---|---|---|
| 官方明确 | 官方产品页、文档或源码直接说明 | “官方文档明确说明……” |
| 上游证据 | 上游项目自己的仓库、发布记录或文档 | “上游项目记录显示……” |
| 工程分析 | 根据多个已确认事实推导出的建议 | “本目录建议……” |
| 未证实 | 缺少直接来源，或来源无法证明目标结论 | “本次核查未发现直接证据……” |

不要将工程建议写成 DeepSeek 官方要求，也不要把历史关联写成设计影响声明。

## 3. DeepSeek Harness 版本基线

本目录本轮核查采用的 DeepSeek Harness 官方仓库快照：

- 仓库：https://github.com/deepseek-ai/deepseek-harness
- 分支：master
- 固定 Commit：4b399c39a6d1479cd84ca591b4d7c88e24d38a96
- 核查日期：2026-11-24

固定 Commit 的作用是让本目录中的代码和文档引用可复查。DeepSeek Harness 当前处于开发者预览阶段，后续接口可能变化。实际开发前应重新核对最新版本，不能直接假设本目录中的配置和 API 永远有效。

## 4. DeepSeek Harness 官方资料

| 资料 | 用途 |
|---|---|
| [官方产品页](https://www.deepseek.com/harness/zh/) | 产品定位、Agent = Model + Harness、一切皆插件 |
| [仓库 README](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/README.zh.md) | 开发者预览状态、运行方式 |
| [架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/architecture.zh.md) | Cordis、Profile、Bundle、Patch、Agent Loop |
| [Cordis 入门](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-primer.zh.md) | Context、Service、inject、Event、Effect |
| [Cordis 教程目录](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cordis-tutorial/index.zh.md) | 从第一个插件到真实 Harness Tool 的实践路径 |
| [第一个插件](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/index.zh.md) | 原生插件入口、inject 和生命周期 |
| [工具开发](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/tool.zh.md) | defineTool 与工具注册 |
| [插件配置](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/config.zh.md) | Schema、配置验证与 HMR |
| [插件打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/publish.zh.md) | Bundle、Profile、npm 包和安装 |
| [Tool 编写参考](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cookbook/adding-a-tool.zh.md) | Tool 参数、返回值、错误和执行策略 |
| [Skills 子系统](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/subsystems/skills.zh.md) | Skill Provider、Registry、目录发现和按需加载 |
| [MCP Client](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/mcp/mcp-client/README.zh.md) | 外部 MCP Server 连接、工具桥接和传输 |
| [MCP Manager](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/mcp/mcp-manager/README.zh.md) | 运行时服务器管理、凭据和插件注册 |
| [Vendored Packages Manifest](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/README.md) | Cordis 上游来源、版本和 Commit |

## 5. Cordis / Koishi 资料

| 资料 | 用途 |
|---|---|
| [Cordis 上游仓库](https://github.com/cordiverse/cordis) | 上游代码 |
| [Koishi History](https://koishi.chat/en-US/about/history) | Koishi 从早期版本到 Service 的演进历史 |
| [Koishi 4.7.1 发布记录](https://github.com/koishijs/koishi/discussions/691) | 官方宣布发布 Cordis 核心包 |
| [Disposable Plugin System](https://koishi.chat/en-US/cookbook/design/disposable) | Koishi 官方对可逆插件系统和资源回收的设计说明 |

这些资料可以证明 Cordis 与 Koishi 生态的历史关系，不能单独证明 DeepSeek 的内部设计动机。

## 6. MCP 与 Java 参考资料

| 资料 | 用途 |
|---|---|
| [MCP 官方架构](https://modelcontextprotocol.io/docs/learn/architecture) | Host、Client、Server 和能力模型 |
| [Spring AI MCP Server Starter](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-server-boot-starter-docs.html) | Spring Boot MCP Server 的 Starter、传输与安全 |
| [Spring AI MCP Server Annotations](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-annotations-server.html) | @McpTool、@McpResource 等注解 |
| [Spring AI MCP Security](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-security.html) | HTTP MCP Server 的安全配置 |

Spring AI 的在线参考文档会随版本变化。项目实施时要核对 Spring Boot、Spring AI BOM、MCP Java SDK 和传输协议的兼容关系。

## 7. 跨宿主插件资料

| 宿主 | 官方资料 | 核查重点 |
|---|---|---|
| ChatGPT / Codex | [OpenAI Plugin Architecture](https://developers.openai.com/plugins/concepts/plugins) | Plugin、Skills、MCP Server 和可选 UI |
| ChatGPT / Codex | [OpenAI Package Your Plugin](https://developers.openai.com/plugins/build/plugins) | plugin.json、skills、mcp.json 和分发 |
| Claude Code | [Claude Code Plugin Repository](https://github.com/anthropics/claude-code/blob/main/plugins/README.md) | plugin.json、skills、agents、hooks、MCP 配置 |
| Claude Code | [Official Plugin Directory](https://github.com/anthropics/claude-plugins-official) | 插件目录与实际组件结构 |

## 8. 更新维护规则

当 DeepSeek Harness、Spring AI 或 Agent Host 的官方接口发生变化时：

1. 先核对新的官方文档和版本；
2. 明确变化影响哪些章节；
3. 修改具体专题，不把所有内容重新塞回 README；
4. 更新本文件的固定版本、Commit 和核查日期；
5. 检查 README 阅读链接和各篇前后关系；
6. 保留“官方事实”和“工程建议”的区分。

本目录的目标是建立可持续维护的学习资料，而不是把某个时间点的实现细节写成永久不变的标准。


## 更新记录

- 2026-11-24：按编号学习路径拆分原单文件，补充官方来源核查并明确技术边界。
