# R1｜Everything is a Plugin：概念与官方设计表述研究任务

- 创建日期：2026-11-28
- 所属项目：[AI-PPT-001｜DeepSeek Harness：Everything is a Plugin](./brief.md)
- 执行依据：[第一阶段研究计划](./01-stage-one-research-plan.md)
- 任务状态：待 Agent 执行

---

## 一、你的角色与任务

你是一名负责技术研究和源码证据核验的 AI Agent。

请帮助研究者从“不熟悉 Everything is a Plugin”开始，先理解 DeepSeek Harness 官方所表达的插件化设计思想。

**本轮只做概念与官方文档研究，不做全仓库扫描，不做真实插件源码追踪，不制作 PPT。**

本轮研究的核心问题：

> DeepSeek Harness 所说的 Everything is a Plugin 究竟指什么？它在系统中处于什么层次？Cordis 如何组织插件之间的能力、依赖、事件和生命周期？

不要预先假定答案。必须从指定版本的官方资料中提取证据，再形成解释。

## 二、研究对象与版本冻结

官方仓库：

- https://github.com/deepseek-ai/deepseek-harness

执行开始时：

1. 读取仓库信息，确认默认分支；
2. 读取该分支当前 HEAD Commit；
3. 与现有资料记录的历史快照 4b399c39a6d1479cd84ca591b4d7c88e24d38a96 比较；
4. 选择一个固定 Commit 作为本轮唯一证据基线，并记录检查时间和 SHA；
5. 后续所有文档链接都必须指向这个固定 Commit，不得混用浮动分支链接或其他 Commit。

如果官方仓库当前 HEAD 与历史快照不同，不要静默覆盖历史记录。请说明变化，并以本轮固定快照开展研究。

## 三、限定阅读范围

本轮只允许优先读取以下 8 份文件：

1. README.zh.md
2. docs/architecture.zh.md
3. docs/cordis-primer.zh.md
4. docs/cordis-tutorial/index.zh.md
5. docs/cordis-tutorial/01-first-plugin.zh.md
6. docs/cordis-tutorial/02-lifecycle-and-effects.zh.md
7. docs/cordis-tutorial/03-services.zh.md
8. docs/cordis-tutorial/04-events.zh.md

不要因为发现其他目录或包名就继续扩展阅读。若这 8 份文件无法回答某个问题，将其列入“待后续源码验证”，不要在本轮擅自扩大范围。

现有工作区的 docs/deepseek-harness/ 可作为研究导航，但不是本轮结论的证据来源。所有重要结论都要回到本轮固定 Commit 的 DeepSeek Harness 官方文档核对。

## 四、必须回答的问题

### A. 概念与边界

1. 官方在哪里提出 Everything is a Plugin？原始表述具体覆盖哪些能力？
2. 这里的“一切”是指什么范围？它是不是指所有外部软件、所有函数、每个 API 都必须成为插件？
3. Everything is a Plugin 是产品内部架构原则、插件开发规范，还是对外部扩展生态的统一标准？请用证据区分。
4. DeepSeek Harness 与 Cordis 分别负责什么？哪些能力由 Cordis 管理，哪些能力由其他插件提供？

### B. 核心抽象

5. Cordis 所说的 Plugin 是什么？官方教程展示了哪些插件形态？
6. Context 是什么？它与 Service 有什么关系？
7. Service 由谁提供，其他插件如何消费？
8. inject 解决什么问题？它和普通的代码 import 有什么区别？
9. Event 与 Service 分别适合解决什么协作问题？
10. Effect / disposer 解决什么生命周期问题？

### C. 运行过程

11. 一个最小插件从配置到执行 apply(ctx)，文档描述的过程是什么？
12. 当插件依赖的 Service 尚未出现时会发生什么？
13. 插件卸载时，Cordis 会撤销哪些由它拥有的注册？
14. 哪些资源需要插件作者显式使用 ctx.effect() 管理？
15. 官方文档如何描述插件依赖服务消失、恢复以及重新加载的行为？

### D. 组合关系

16. Plugin、Cordis 配置项、Loader、Profile、Bundle、Patch 分别是什么？
17. 它们之间的关系如何描述，避免把“插件代码”“插件配置”和“插件分发包”混为一谈？
18. 一个运行环境最终由哪些配置和插件组合决定？

### E. 设计价值与代价

19. 从官方文档能够直接确认的设计价值有哪些？
20. 哪些收益是我们根据机制推导出来的工程分析？
21. 插件化带来了哪些需要关注的复杂度，例如依赖关系、命名、生命周期、错误诊断和调试？
22. 哪些问题本轮资料不足，必须留到后续源码追踪？

## 五、输出要求

请将本轮研究结果写入当前 AI Assistant 工作区的：

projects/xiaohongshu/04-series/AI-PPT-001-everything-is-plugin/03-research-notes.md

这是唯一允许新增或修改的输出文件。不要修改 DeepSeek Harness 上游仓库，不要修改工作区其他文档。

文档至少包含以下章节：

1. 本轮任务信息与固定 Commit；
2. 先给出 300～500 字的通俗解释；
3. Everything is a Plugin 的准确含义与适用边界；
4. Harness、Cordis、Plugin、Context、Service、inject、Event、Effect 的职责关系；
5. 插件加载、依赖、协作和卸载的文档级流程；
6. Plugin / 配置项 / Loader / Profile / Bundle / Patch 的关系；
7. 一张 Mermaid 架构关系图（图中只画本轮证据能够支持的关系）；
8. 关键结论与证据表；
9. 容易混淆的概念与反例；
10. 本轮仍未解决的问题；
11. 下一轮 R2 应该做什么。

证据表至少包含：

| 结论 | 证据等级 | 固定 Commit 文件 | 标题/符号/代码位置 | 证据支持的范围 | 不能据此推断的内容 |
|---|---|---|---|---|---|

## 六、证据与表述纪律

每条重要结论使用以下标记之一：

- OFFICIAL：官方文档直接说明；
- SOURCE：固定 Commit 源码直接证明；
- ANALYSIS：基于已确认事实的工程分析；
- OPEN：当前证据不足。

本轮限定在文档阅读范围，因此不要把文档描述伪装成源码已经验证。没有读取源码的内容，不得标记为 SOURCE。

严格遵守：

- 引用具体文件路径、章节标题；能够获取行号时记录行号；
- GitHub 链接必须包含本轮固定 Commit；
- 区分官方原话、中文解释和自己的工程分析；
- 不用“插件化一定提高性能”“插件一定能热插拔”等没有证据支持的绝对表述；
- 不把 Effect 的清理等同于数据库事务回滚或外部业务操作撤销；
- 不把 inject 说成普通静态 import；
- 不把 Event 说成所有插件协作的唯一方式；
- 不把 Cordis 等同于 Agent Loop、MCP 或操作系统沙箱；
- 若官方文档之间存在差异或歧义，明确指出，不自行补齐。

## 七、完成后自检

写入文件前，检查：

- 是否只读取了限定范围内的资料？
- 是否记录了本轮固定 Commit？
- 每个重要结论是否有对应来源？
- 是否把官方事实与工程分析分开？
- 是否明确回答“Everything is a Plugin 不意味着什么”？
- 是否仍然保持主题聚焦，没有扩展成整个 Harness 导览？
- 是否没有开始写 PPT 页面或视觉方案？
- 是否明确列出 R2 才能回答的问题？

完成后只汇报：

1. 03-research-notes.md 是否创建；
2. 本轮实际读取的 8 份文件及固定 Commit；
3. 主要结论摘要；
4. 未解决问题；
5. 是否满足 R1 验收条件。

不要声称完成了没有实际执行的运行实验或源码追踪。
