# 第一阶段｜理解 Everything is a Plugin：研究计划

- 更新日期：2026-11-28
- 关联项目：[AI-PPT-001｜DeepSeek Harness：Everything is a Plugin](./brief.md)
- 所属专题：[AI 做 PPT 专题研究](../../01-research/ai-ppt-series.md)
- 当前状态：研究计划已建立；首轮 Agent 研究尚未执行

---

## 1. 本阶段要完成什么

第一阶段不是制作 PPT，而是从“不熟悉这个概念”走到“能够准确解释它”。

本阶段需要回答：

> DeepSeek Harness 为什么把主要运行能力组织成插件？这里的 Plugin 究竟指什么？Cordis 如何让这些插件加载、共享能力、声明依赖、协作和卸载？

最终目标不是复述官方文档，而是形成一套自己能够讲清楚、并且每个重要技术结论都有来源依据的理解。

**阶段产出：** 一份可追溯的研究底稿、一张初步架构关系图、一份真实插件源码追踪记录，以及一次通俗解释验收。

**本阶段不产出：** PPT 大纲、HTML 幻灯片、Office PPTX 或小红书公开笔记。这些工作在研究通过后再启动。

## 2. 研究边界

### 2.1 本次聚焦

- Everything is a Plugin 的官方表述、实际含义和适用范围；
- DeepSeek Harness 与 Cordis 的职责边界；
- Plugin、Context、Service、inject 的关系；
- 插件加载、依赖等待、卸载和副作用清理；
- Event 在插件协作中的作用；
- 必要时理解 Profile、Bundle、Patch 如何决定最终插件组合；
- 选择一个真实内置插件，核对它如何进入运行环境、取得依赖并提供能力。

### 2.2 本次不做

- 不扫描或总结 DeepSeek Harness 全仓库；
- 不把所有子系统都纳入研究；
- 不把 Cordis Plugin、npm package、Bundle、Profile 配置项混为一个概念；
- 不把 Tool、MCP、Skill 当作 Plugin 的同义词；
- 不推断“DeepSeek 官方参考 Koishi”等没有直接证据的设计因果；
- 不把插件卸载描述成自动回滚外部业务事务；
- 不为了展示 Agent 能力而加入无关的 MCP、Java 或企业系统案例；
- 不开始 PPT 设计和视觉制作。

## 3. 研究执行顺序

研究分四轮推进。每轮有独立产出和检查点；上一轮结论未核实前，不扩大范围。

### R1｜概念与官方设计表述

**目的：** 先弄清楚官方说的“一切皆插件”具体指什么，以及这句话不能被扩大解释成什么。

首批只读资料：

1. DeepSeek Harness 仓库 README.zh.md
2. docs/architecture.zh.md
3. docs/cordis-primer.zh.md
4. docs/cordis-tutorial/index.zh.md
5. Cordis Tutorial 01-first-plugin.zh.md
6. Cordis Tutorial 02-lifecycle-and-effects.zh.md
7. Cordis Tutorial 03-services.zh.md
8. Cordis Tutorial 04-events.zh.md

需要形成的结论：

- 官方对 Everything is a Plugin 的原始表述是什么？
- 这句话描述的是 Harness 的哪一层？
- Harness、Cordis、Plugin、Context、Service 分别承担什么职责？
- 插件之间如何通过 Service / inject / Event 协作？
- 加载、卸载和 Effect 的关系是什么？
- Profile、Bundle、Patch 与插件分别是什么关系？
- 哪些内容是文档明确说明，哪些仍只是我们的解释？

**R1 产出：** 03-research-notes.md 的概念研究部分，包含术语关系表、初步架构图、证据表和待验证问题。

### R2｜通过最小教程建立运行直觉

**目的：** 不只“读懂定义”，还要理解最小插件实际如何运行。

以官方 Tutorial 01–04 为依据，按顺序理解：

1. 第一个插件：Loader 如何挂载插件，插件的 apply(ctx) 如何被调用；
2. 生命周期与 Effect：插件卸载时哪些注册会撤销，哪些资源需要 disposer；
3. Service 与 inject：提供方和消费方如何建立依赖，依赖缺失或消失时会发生什么；
4. Event：插件如何声明和监听事件，不同分发方式有什么语义差异。

如需实际运行示例，只在本地临时目录操作，不修改 DeepSeek Harness 上游仓库；先使用无需 API Key 的教程示例，不调用模型或外部业务服务。

**R2 产出：** 在 03-research-notes.md 中记录每个示例的输入、关键步骤、实际观察和理解修正。没有实际运行的内容必须标记为“文档阅读”，不能写成“已实测”。

### R3｜追踪一个真实内置插件

**目的：** 从教程过渡到真实 Harness 实现，证明概念在产品代码中如何落地。

先比较少量候选插件，选择一个最适合讲清楚以下链路的案例：

- 它从哪个配置或组合入口进入运行环境；
- 插件以什么形式被挂载；
- 它声明或等待哪些服务依赖；
- 初始化时注册了什么 Service、Tool、Event 或其他能力；
- 插件卸载时由谁负责清理；
- 哪些行为由 Cordis 管理，哪些是插件自身业务逻辑。

候选插件不能只按“代码最复杂”选择。优先选依赖关系清楚、注册入口明确、代码范围可控、能够支撑分享叙事的插件。

dsh-agent-loop 可以作为候选，但不预先指定为最终案例；应与更小的内置插件比较后再决定。

**R3 产出：** 04-source-trace.md，记录固定 Commit、候选比较、最终选择、关键文件、符号、调用关系和证据链接。

### R4｜反向讲解与知识验收

**目的：** 检验我们是否真正理解，而不是只会照着文档念。

要求研究者不看原文，尝试：

1. 用 3～5 分钟向没有读过该项目的同事解释 Everything is a Plugin；
2. 用一张图讲清 Harness、Cordis、插件和服务之间的关系；
3. 用一个真实插件解释加载、依赖、注册和卸载；
4. 解释这种设计带来的收益、代价和边界；
5. 回答“这是不是意味着所有软件、每个函数、每个 API 都必须做成插件？”

解释过程中出现无法回答的问题，回到证据补查，不用猜测填空。

**R4 产出：** 在 03-research-notes.md 末尾记录讲解提纲、答不上来的问题、修订后的通俗解释和验收结果。

## 4. 固定版本与证据规则

### 4.1 固定版本

现有 DeepSeek Harness 专题资料记录的历史参考快照为：

- 仓库：https://github.com/deepseek-ai/deepseek-harness
- 分支：master
- 已记录 Commit：4b399c39a6d1479cd84ca591b4d7c88e24d38a96

该 Commit 是现有资料的引用基线，不自动代表执行当天的最新版本。

R1 开始前必须重新读取官方仓库默认分支 HEAD，并记录：

- 默认分支名称；
- 检查时间；
- HEAD Commit SHA；
- 本轮最终采用的固定 Commit；
- 若与上述历史快照不同，说明差异及采用新快照的原因。

确定后，本轮所有官方文档和源码链接都必须指向同一个固定 Commit；不得混用 master 浮动链接与不同时间的源码。

### 4.2 证据等级

每项关键结论标记为以下一种：

| 标记 | 含义 | 使用规则 |
|---|---|---|
| OFFICIAL | 官方产品页或官方文档直接说明 | 可表述为“官方明确说明” |
| SOURCE | 固定 Commit 的源码直接证明 | 说明具体文件、符号和代码行为 |
| ANALYSIS | 根据多个已确认事实作出的解释 | 明确写成我们的分析，不冒充官方原话 |
| OPEN | 证据不足、尚未核实或存在歧义 | 保留为待验证问题 |

每个关键结论至少记录：结论、证据等级、来源文件、标题/符号/代码位置、固定 Commit 链接、证据能证明什么、不能证明什么。

不能只贴一个目录链接，也不能用其他版本的 README 代替固定 Commit 证据。

## 5. 预期文件与职责

本目录采用少量文件，不为每一轮建立大量零散文档：

~~~text
AI-PPT-001-everything-is-plugin/
├── brief.md                         # 真实任务、范围和最终交付要求
├── 01-stage-one-research-plan.md    # 第一阶段研究路线、边界和验收
├── 02-first-round-agent-task.md     # 可直接交给 Agent 执行的 R1 任务说明
├── 03-research-notes.md            # R1、R2、R4 的研究结果（研究后创建）
└── 04-source-trace.md              # R3 真实插件源码追踪（选定案例后创建）
~~~

现有 docs/deepseek-harness/ 是通用学习资料库，可以作为阅读导航和已有背景材料；本项目研究结果必须重新对照本次固定 Commit 核实，不直接复制既有结论作为证据。

## 6. 第一阶段完成标准

以下条件全部满足，才允许结束第一阶段：

- [ ] 能用通俗语言准确解释 Everything is a Plugin 及其适用边界；
- [ ] 能区分 Harness、Cordis、Plugin、Context、Service、inject、Event、Effect；
- [ ] 能解释插件加载、依赖等待、卸载和副作用清理；
- [ ] 能说明 Profile、Bundle、Patch 与插件组合的关系，且不混淆概念；
- [ ] 至少理解并记录官方 Tutorial 01–04 的关键机制；
- [ ] 追踪至少一个真实内置插件的关键实现链路；
- [ ] 重要结论有固定 Commit 下的官方文档或源码依据；
- [ ] 有一张与实际证据一致的架构关系图；
- [ ] 能在 3～5 分钟内独立讲清楚设计思想；
- [ ] 明确列出仍未证实的内容，不把它们写进 PPT 事实页。

**阶段出口：** 通过上述验收后，才进入 PPT 叙事设计和 03-ppt-outline.md；不能因为研究笔记写完就自动判定通过。

## 7. 当前待办

1. 执行 [02-first-round-agent-task.md](./02-first-round-agent-task.md)；
2. 审核 R1 研究结果与证据；
3. 通过后再推进 R2；
4. R2 完成后选定真实插件，进入 R3；
5. 最后进行 R4 反向讲解验收。

## 更新记录

- 2026-11-28：根据本次讨论建立第一阶段研究计划，明确 R1–R4、固定版本、证据等级、交付文件和阶段出口；当前仅完成计划，不代表已执行研究。
