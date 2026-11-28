# AI Agent 研究任务书｜Everything is a Plugin

- 更新日期：2026-11-28
- 项目：[AI-PPT-001｜DeepSeek Harness：Everything is a Plugin](./brief.md)
- 总体计划：[01-stage-one-research-plan.md](./01-stage-one-research-plan.md)
- 已完成阶段：[00-stage-a-research-map.md](./00-stage-a-research-map.md)
- 当前待执行：**阶段 B｜Cordis Runtime 与 Loader 机制研究**

---

## 1. 任务目标

你不是来写一份官方文档摘要，也不是来开发一个插件。

你的任务是帮助研究者完成一次有证据的技术调查：

> 从不了解 DeepSeek Harness 的 Everything is a Plugin 开始，研究它的设计思想、运行机制和真实产品实现，最终让研究者能够独立解释、画图、回答问题并完成内部技术分享。

研究成果必须回答：
- 它到底是什么，边界在哪里；
- 为什么采用这样的设计；
- 它在运行时如何实现；
- 插件如何提供能力、声明依赖、协作、替换和卸载；
- 这种设计有什么价值、代价和适用边界。

**研究目标是获得可解释、可验证的知识，不是完成固定数量的文档阅读，也不是尽可能多地扫描代码。**

## 2. 输入资料

开始任何阶段前，先阅读：

1. brief.md：真实任务、分享目标和范围；
2. 01-stage-one-research-plan.md：A–E 阶段路线、退出条件和提交规则；
3. 00-stage-a-research-map.md：已经核验的官方资料、概念边界、源码/测试入口和待研究问题。

官方仓库：
- https://github.com/deepseek-ai/deepseek-harness

本次固定 Commit：
- 4b399c39a6d1479cd84ca591b4d7c88e24d38a96

所有官方文档、源码、测试链接必须固定到该 Commit。不要使用浮动的 master 链接作为证据。不要混用不同 Commit 的文档和代码。

## 3. 研究方法

采用问题驱动的证据链，而不是按文件目录机械阅读：

1. 明确当前要回答的具体问题；
2. 从官方文档/API 参考找到概念和契约；
3. 从固定 Commit 源码定位真实实现；
4. 从对应测试检查边界行为和失败场景；
5. 只有文档、源码和测试仍无法回答时，才设计最小运行实验；
6. 用自己的语言解释结论；
7. 标明证据不能证明什么，保留仍然开放的问题。

资料范围可以扩展，但每次扩展都必须说明它回答了哪个问题。禁止为了“读完整个仓库”而扫描 26,160 个路径。

## 4. 研究范围与关键区别

### 4.1 研究主线

- Cordis Plugin、Context、Service、inject、Event、Effect、Fiber；
- Loader、插件树、配置项、Group/Include 和 HMR；
- Profile、Bundle、Patch 如何组成运行环境；
- Harness 的真实能力如何通过 Service Definition / Provider / Consumer 组织；
- 一个真实内置插件的加载、依赖、能力注册和卸载。

### 4.2 必须避免的概念混淆

- Plugin 不等于 Service；
- Plugin 不等于 npm package；
- Cordis 配置项不等于插件源码；
- Bundle 不等于运行时插件；
- Profile 不等于 Bundle；
- Patch 不等于插件实现；
- Plugin Market Index 中列出的可安装 Bundle，不等于 Cordis 运行时 Registry；
- inject 不等于普通静态 import；
- Event 不等于所有插件协作的唯一机制；
- Cordis 不等于 Agent Loop、MCP 或操作系统沙箱；
- Effect 清理不等于自动回滚数据库事务或外部业务操作。

### 4.3 不做的事情

- 不修改 DeepSeek Harness 上游仓库；
- 不开发一个正式产品插件；
- 不把整个 Harness 所有子系统都纳入本次 PPT；
- 不为了展示 Agent 能力加入无关的 MCP、Java 或企业案例；
- 不提前生成 PPT 页面；
- 不把推断写成官方事实；
- 不把没有运行的实验写成“已实测”。

如果需要动手验证，只能在本地临时目录创建最小示例，不改上游仓库；优先使用无需 API Key 的教程示例。

## 5. 分阶段任务

### 阶段 A｜问题地图（已完成，不要重复执行）

产出：00-stage-a-research-map.md。

已经完成：
- 固定版本核验；
- 官方资料分层；
- 概念边界初步模型；
- 源码与测试入口；
- 真实插件候选；
- 后续研究问题。

如发现新证据与地图冲突，先记录差异，再在相应阶段修订，不要无声覆盖。

### 阶段 B｜Cordis Runtime 与 Loader 机制（当前唯一执行任务）

**目标：** 从源码和测试中还原插件从声明、加载、依赖等待、激活、运行到卸载的机制。

#### B1. Plugin、Registry、Fiber

优先研究：
- vendor/cordis/src/registry.ts
- vendor/cordis/src/fiber.ts
- vendor/cordis/src/context.ts

回答：
- Plugin 支持哪些入口形态？
- ctx.plugin() 如何创建运行实例？
- Registry 负责什么，Fiber 负责什么？
- apply(ctx) 何时执行？
- 插件配置何时校验？
- Fiber 状态如何变化？
- 插件加载失败和配置失败分别如何表现？

#### B2. Context、Service 与 inject

优先研究：
- vendor/cordis/src/context.ts
- vendor/cordis/src/service.ts
- vendor/cordis/src/reflect.ts
- vendor/cordis/src/registry.ts

回答：
- Context 如何解析 ctx 上的服务属性？
- Service 如何注册和注销？
- inject 如何表达硬依赖？
- 缺少 Provider 时 Fiber 处于什么状态？
- Provider 后出现、消失或替换时，Consumer 如何处理？
- 可选依赖与服务隔离如何工作？
- 服务名称和多个 Provider 有哪些约束？

#### B3. Effect、Fiber dispose 与所有权

优先研究：
- vendor/cordis/src/fiber.ts
- vendor/cordis/src/registry.ts
- vendor/README.md 中与本次机制有关的本地修改

回答：
- 哪些 Cordis API 注册会自动成为 Effect？
- ctx.effect() 如何接管外部资源？
- disposer 何时运行，如何等待异步清理？
- 父插件与子插件如何建立所有权？
- 重入式卸载、卸载期间新增 Effect、清理失败会怎样？
- 哪些行为受 Harness 本地 V6 / V25 等修改影响？

#### B4. Event

优先研究：
- vendor/cordis/src/events.ts
- docs/cordis-tutorial/04-events.zh.md
- docs/cordis-api/events.zh.md

回答：
- emit、parallel、serial、bail、waterfall 的语义差异；
- ctx.on() 的监听器所有权和 disposer；
- 哪些事件适合通知，哪些适合决策拦截；
- waterfall 忘记调用 next() 会发生什么？

#### B5. Loader 与插件树

优先研究：
- vendor/loader/src/index.ts
- vendor/loader/src/config/entry.ts
- vendor/loader/src/config/tree.ts
- 需要时读取 group.ts、isolate.ts
- packages/boot/app-boot/src/profile.ts

回答：
- cordis.yml 中的一条配置如何成为插件实例？
- Loader 如何解析模块、校验 Config 和跟踪 Entry？
- Group、Include、Patch 分别负责什么？
- 配置变化如何触发更新或重新挂载？
- HMR 的范围和限制是什么？

#### B6. 测试证据

先读与具体问题对应的测试，不要一开始运行全仓库测试：
- scripts/cordis-core-lifecycle.spec.ts
- scripts/cordis-core-api.spec.ts
- scripts/cordis-loader-resolve.spec.ts
- packages/boot/app-boot/tests/user-patches.spec.ts

如发现某条结论缺少测试覆盖，明确标记，不要把测试文件存在本身当作行为已证明。

**B 阶段产出：**
- 创建或更新 03-research-notes.md；
- 写出插件加载与卸载流程；
- 写出服务依赖变化流程；
- 写出 Effect 所有权与清理流程；
- 写出 Event 分发对照；
- 每个关键结论带固定 Commit 源码和测试证据；
- 标记未验证和需要运行实验的问题。

B 阶段完成后暂停扩展，先审核结论，再单独提交 test 分支。

### 阶段 C｜真实产品插件追踪

**目标：** 从产品代码中选一个主案例，验证 Cordis 机制如何支撑真实能力。

候选见 00-stage-a-research-map.md：
- Tutorial greet-tool；
- Bash 三角色组合；
- LLM Provider Adapter；
- Agent Loop。

比较标准：
- 是否能说明 Everything is a Plugin；
- 依赖关系是否清晰；
- 源码范围是否可控；
- 是否有对应测试；
- 是否可以说明加载、依赖、提供能力、卸载；
- 是否适合 15–20 分钟技术分享。

不要预先认定 Agent Loop 必然最好，也不要为了案例数量同时深入多个大型子系统。

**C 阶段产出：** 04-source-trace.md，包含候选比较、选择理由、配置入口、关键文件、符号、调用链、依赖图、测试证据和局限。

### 阶段 D｜设计价值与代价分析

**目标：** 用已核实的 B/C 证据回答“为什么这样设计”和“付出了什么代价”。

分析：
- 插件组合与配置替换解决了什么问题；
- Service Definition / Provider / Consumer 分离带来什么变化；
- inject 与生命周期协调怎样减少手工依赖管理；
- Effect/disposer 怎样约束副作用所有权；
- Event 怎样支持松耦合扩展；
- 依赖等待、PENDING、服务命名、调试、版本兼容和 HMR 带来哪些复杂度。

将官方设计说明、源码事实、测试事实和工程分析分开。没有性能或效率基准时，不得声称插件化提升了性能或开发效率。

**D 阶段产出：** 更新 03-research-notes.md，加入收益、代价、适用边界和证据对照。

### 阶段 E｜反向讲解和知识验收

**目标：** 验证研究者是否真的理解。

必须能：
- 用 3–5 分钟解释 Everything is a Plugin；
- 画出实际架构关系图；
- 用真实插件解释加载、依赖、注册和卸载；
- 解释 Provider 替换；
- 解释设计收益、代价和边界；
- 对核心结论指出源码/测试位置。

无法回答的问题返回证据链补查。不能靠生成一段更流畅的文字掩盖理解缺口。

**E 阶段产出：** 更新 03-research-notes.md，记录通俗讲解、架构图、提问与回答、验收结果和仍开放的问题。

## 6. 证据规范

每个重要结论必须标记：

- OFFICIAL：官方文档直接说明；
- SOURCE：固定 Commit 源码直接证明；
- TEST：固定 Commit 测试断言覆盖；
- RUN：明确环境下实际运行观察；
- ANALYSIS：基于证据形成的工程解释；
- OPEN：证据不足或存在歧义。

每条记录包含：
- 结论；
- 证据等级；
- 文件路径；
- 章节/符号/行号；
- 固定 Commit URL；
- 证据支持的范围；
- 不能据此推断的内容。

禁止：
- 只贴仓库目录而不指向具体位置；
- 把文档描述冒充源码事实；
- 把测试名称冒充测试结论；
- 把推断写成官方动机；
- 把没有运行的实验写成 RUN；
- 混用上游 Cordis master 与 Harness vendored 版本。

## 7. 分阶段提交规则

每次只执行一个阶段。阶段完成后：
1. 检查研究范围是否符合计划；
2. 检查关键结论是否有证据；
3. 检查 Markdown 相对链接；
4. 更新阶段状态；
5. 只将当前阶段成果提交到 aihao16888/ai-assistant 的 test 分支；
6. 汇报固定 SHA、变更文件、完成与未完成事项。

不修改 main，不自动合并，不提前把未来阶段的预期结果写成已完成。

## 8. 当前执行指令

**现在只执行阶段 B。**

不要重新执行阶段 A，不要直接跳到阶段 C，不要开发插件，不要制作 PPT。

先从 Registry / Fiber / Context / Service / inject 开始，按问题需要扩展到 Event、Loader 和测试。完成 B 阶段研究笔记并审核后，再决定阶段 C 的真实插件案例。
