# DeepSeek Harness 与面向 Agent 的开发

本目录按学习顺序整理 DeepSeek Harness 的产品定位、运行架构、Cordis 插件机制、原生插件开发、Tool / Skill / MCP 能力边界，以及企业 Java 系统接入 Agent 的工程方法。

**README 只负责说明本目录的用途、阅读顺序和文档分工；具体知识分别写在编号专题中。**

## 阅读路径

### A. 先理解 Harness

| 顺序 | 文档 | 解决的问题 |
|---|---|---|
| 01 | [产品定位与基本概念](./01-positioning-and-concepts.md) | Harness 是什么，Model、Agent、Harness 分别负责什么？ |
| 02 | [运行架构与组合机制](./02-runtime-architecture.md) | “一切皆插件”具体指什么？Profile、Bundle、Patch 如何组成运行时？ |
| 03 | [Cordis 插件模型与生命周期](./03-cordis-plugin-model.md) | Plugin、Context、Service、inject、Event、Effect 如何协作？ |

### B. 再掌握扩展开发

| 顺序 | 文档 | 解决的问题 |
|---|---|---|
| 04 | [DeepSeek Harness 原生插件开发](./04-native-plugin-development.md) | 插件用什么语言、如何编写、配置、打包和安装？ |
| 05 | [Tool、Skill、MCP 与 Plugin 的边界](./05-tool-skill-mcp-boundaries.md) | 四个概念分别解决什么问题，如何组合？ |
| 06 | [DeepSeek Harness 的 MCP 接入机制](./06-dsh-mcp-integration.md) | Harness 如何连接外部 MCP Server，何时用 mcp-client 或 mcp-manager？ |

### C. 把现有业务系统接入 Agent

| 顺序 | 文档 | 解决的问题 |
|---|---|---|
| 07 | [Java / Spring Boot 业务系统接入](./07-java-spring-boot-integration.md) | 如何保留现有 Java 系统，通过 MCP 安全地向 Agent 开放业务能力？ |
| 08 | [跨 Agent Host 的复用策略](./08-cross-host-reuse.md) | 哪些能力可以跨平台复用，哪些必须按宿主适配？ |

### D. 核查来源与统一术语

| 顺序 | 文档 | 解决的问题 |
|---|---|---|
| 09 | [Cordis 上游来源与 Koishi 证据边界](./09-cordis-provenance-and-koishi.md) | DeepSeek 明确说明了什么，Koishi 材料能证明什么，不能证明什么？ |
| 10 | [术语表与参考资料](./10-glossary-and-source-register.md) | 统一术语、官方资料入口和本次研究的版本基线。 |

## 按目标阅读

- **第一次了解 DeepSeek Harness**：按 01 → 02 → 03 → 04 → 05 → 06 阅读。
- **只想把 Java 系统接入 Agent**：先读 01、02，再读 05 → 06 → 07。
- **准备开发 Harness 原生插件**：重点读 02 → 03 → 04 → 05 → 06。
- **准备同时支持多个 Agent Host**：读 05 → 07 → 08，并结合 10 核对各宿主的最新规范。
- **核查 Cordis 与 Koishi 的关系**：直接读 09；不要把历史背景当作 DeepSeek 的设计声明。

## 文档职责

- 本文件：目录说明、阅读顺序、文档边界。
- 01–03：解释产品与运行时基础，不展开具体业务集成。
- 04：只讲 DeepSeek Harness 原生 Cordis 插件的开发与分发。
- 05–06：讲清 Agent 能力概念，以及 Harness 自身如何接入 MCP。
- 07：给出 Java 企业业务系统的接入设计；这是工程方案，不是 DeepSeek 官方承诺。
- 08：比较不同 Agent Host 的扩展契约，明确复用边界。
- 09：只处理 Cordis 的来源证据和 Koishi 的证据边界。
- 10：集中维护术语、来源、版本和核查日期。

## 证据与表述规则

1. **DeepSeek 官方事实**：以 DeepSeek Harness 仓库、官方文档和对应固定 Commit 为准。
2. **上游项目事实**：以 Cordis、Koishi 等项目自己的仓库、发布记录和官方文档为准。
3. **工程建议**：明确标注为本目录的分析或建议，不写成 DeepSeek 官方要求。
4. **未找到直接证据**：写“本次核查未发现”，不将其扩大为“绝对不存在”。
5. **易变信息**：插件 API、MCP 传输、Spring AI 依赖和宿主插件规范必须注明核查基线；实施前重新核对版本。

## 研究基线

- DeepSeek Harness：官方仓库 master 分支固定快照，详见 [10-术语表与参考资料](./10-glossary-and-source-register.md)。
- 本目录定位：帮助读者从理解 Harness，逐步走到开发扩展和接入真实业务系统。
- 本目录不替代 DeepSeek Harness 官方开发文档；官方文档是接口和实现细节的最终依据。