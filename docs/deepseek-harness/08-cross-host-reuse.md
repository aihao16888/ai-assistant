# 08｜跨 Agent Host 的复用策略

> 本篇回答：同一套业务能力能否同时服务 DeepSeek Harness、Codex 和 Claude Code？

## 1. 先区分“复用能力”和“复用插件”

不同 Agent Host 的 Plugin 不是同一种运行时格式。

即使几个平台都叫 Plugin，它们的入口、清单、生命周期、权限和安装方式也可能完全不同。

| 宿主 | 原生扩展形态 | 典型入口 / 清单 |
|---|---|---|
| DeepSeek Harness | Cordis Plugin + Bundle | TypeScript / JavaScript ESM、apply(ctx)、package.json 中的 dsh.bundle、cordis.patch.yml |
| ChatGPT / Codex | OpenAI Agent Plugin | plugin.json、skills、MCP Server 配置、可选 UI 和 Hooks |
| Claude Code | Claude Code Plugin | .claude-plugin/plugin.json、skills、agents、hooks、.mcp.json |

因此，不能把一个 DSH Cordis Plugin 直接安装到 Codex 或 Claude Code，也不能把其他平台的 Plugin Manifest 当成 Cordis 配置。

## 2. 哪些部分可以真正复用？

最值得复用的是宿主无关的业务能力：

~~~text
             Java Application Service
                      ↑
                Java MCP Server
                 /     |                      /      |              DSH MCP Client  Codex   Claude Code
            ↑          ↑          ↑
       DSH Profile   OpenAI     Claude Plugin
       /可选 Plugin  Plugin     /Settings
~~~

| 资产 | 跨宿主复用程度 | 说明 |
|---|---|---|
| Java Application Service | 高 | 与 Agent Host 无关 |
| Java MCP Server | 高 | 支持相同 MCP 传输和能力的客户端可连接 |
| Tool 名称、输入输出契约 | 高 | 应保持稳定，但各宿主呈现和策略不同 |
| Skill 工作流程正文 | 部分 | 可以共享核心 Markdown 内容，但需要核对 frontmatter、目录和调用规则 |
| DSH Cordis Plugin | 低 | 依赖 Cordis Context、Service、inject 和 DSH 生命周期 |
| Codex / OpenAI Plugin Manifest | 低 | 只对对应宿主的扩展机制生效 |
| Claude Code Plugin Manifest | 低 | 只对 Claude Code 的插件加载机制生效 |
| UI、Hook、权限配置 | 低 | 需要按宿主重新实现和验证 |

## 3. 三个平台的 Plugin 有什么区别？

### DeepSeek Harness

原生插件是 Cordis 插件，使用 apply(ctx) 接入 Harness 服务。分发时使用 Bundle 和 Profile 组合机制。

它可以注册 Tool、Service、Event、Skill Provider，也可以通过 mcpManager.register() 注册插件生命周期内拥有的 MCP Server。

### ChatGPT / Codex

OpenAI 当前的 Agent Plugins 将 Skills、MCP Server 和可选界面组合成可安装的插件包。Codex 还支持运行环境相关的 Hooks 等能力。

其插件包使用自己的 plugin.json 和组件目录约定。ChatGPT 与 Codex 共用插件目录，但部分能力仍然依赖具体产品表面和执行环境。

### Claude Code

Claude Code Plugin 使用自己的目录与清单：

~~~text
document-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── document-approval/
│       └── SKILL.md
├── agents/
├── hooks/
└── .mcp.json
~~~

具体组件按 Claude Code 的插件规范加载。

## 4. 推荐的跨平台架构

对于一个企业文档管理平台，建议把资产拆成三层：

### 第一层：业务能力层

- Spring Boot Application Service；
- 业务规则和权限；
- 数据库、文件存储；
- 事务、审计、幂等。

### 第二层：协议层

- Java MCP Server；
- 稳定的 Tool Schema；
- 用户身份认证；
- 统一错误和返回值。

### 第三层：宿主适配层

- DSH：MCP Manager 配置，必要时再开发 Cordis Plugin；
- Codex：MCP 配置或 OpenAI Plugin；
- Claude Code：MCP 配置或 Claude Code Plugin。

每个宿主可以拥有自己的 Skill、Hook、UI 和权限策略，但不应该复制 Java 业务规则。

## 5. 不要过早追求一个插件包通吃所有平台

建议按以下顺序推进：

1. 先把业务能力和 MCP Server 做稳定；
2. 在一个 Agent Host 中完成完整业务闭环；
3. 把重复的任务方法整理为 Skill；
4. 再为第二个 Host 编写薄适配层；
5. 比较工具调用、权限、用户确认和结果呈现的差异。

这样复用的是业务能力和协议，而不是强行统一所有宿主的插件运行时。

## 6. 本篇应掌握的结论

- MCP Server 是跨 Host 复用业务能力的主要边界。
- Skill 的流程内容可以部分复用，但需要按宿主核对格式和调用语义。
- 原生 Plugin、Hook、UI 和 Manifest 必须按宿主适配。
- DSH 已有 MCP Manager，基础接入不需要自定义 DSH Plugin。

## 7. 官方参考资料

- [OpenAI Plugins：插件架构](https://developers.openai.com/plugins/concepts/plugins)
- [OpenAI Plugins：Skills](https://developers.openai.com/plugins/concepts/skills)
- [OpenAI Plugins：打包插件](https://developers.openai.com/plugins/build/plugins)
- [Claude Code 官方插件仓库结构](https://github.com/anthropics/claude-code/blob/main/plugins/README.md)
- [Claude Code 官方插件目录](https://github.com/anthropics/claude-plugins-official)
- [DeepSeek Harness 插件发布规范（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/publish.zh.md)

**下一篇：** [09｜Cordis 上游来源与 Koishi 证据边界](./09-cordis-provenance-and-koishi.md)。回到最初的来源问题，严格区分代码来源、历史背景和设计动机。
