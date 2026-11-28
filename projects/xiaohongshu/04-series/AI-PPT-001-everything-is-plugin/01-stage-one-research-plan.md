# AI-PPT-001｜Everything is a Plugin 研究与知识构建计划

- 更新日期：2026-11-28
- 项目：[brief.md](./brief.md)
- 阶段 A 成果：[研究问题地图](./00-stage-a-research-map.md)
- Agent 任务书：[02-first-round-agent-task.md](./02-first-round-agent-task.md)
- 当前状态：**阶段 A 已完成；下一步进入阶段 B**

---

## 1. 最终目标

这次任务不是简单阅读 DeepSeek Harness 文档，也不是开发一个插件。

我们要借助 AI Agent 完成一次有证据的技术调查，从“不知道 Everything is a Plugin 是什么”逐步走到能够独立理解、解释和分享：

1. 解释 Everything is a Plugin 的准确含义和适用边界；
2. 说明 Cordis 如何组织 Plugin、Context、Service、inject、Event、Effect 和 Fiber；
3. 从固定版本源码追踪真实运行过程；
4. 通过测试和必要的运行验证确认关键行为；
5. 结合真实产品插件说明设计如何落地；
6. 分析这种设计的收益、复杂度和适用边界；
7. 形成可用于 15–20 分钟内部技术分享的知识体系。

**最终价值：** 不止获得一份 PPT，而是获得一套可追溯、可复核、能回答问题的技术认知。

## 2. 研究主线

~~~text
不知道 Everything is a Plugin
        ↓
建立问题地图和资料地图
        ↓
理解 Cordis 运行时机制
        ↓
追踪真实产品插件
        ↓
分析设计价值与代价
        ↓
反向讲解、证据审核、知识验收
        ↓
设计 PPT 叙事与页面
        ↓
HTML 原型 → 审核 → 原生可编辑 PPTX
~~~

阶段 A–E 属于知识研究；PPT 内容策划和制作在研究通过后启动。

## 3. 分阶段执行与交付

### 阶段 A｜建立研究问题地图

**状态：已完成**

目标：
- 核验官方仓库和固定 Commit；
- 识别官方文档、API 参考、源码、测试和运行验证入口；
- 明确“Everything”指什么、不指什么；
- 区分 Plugin、Service、Context、Bundle、Profile、Patch 等概念；
- 建立后续研究问题和案例候选。

产出：
- 00-stage-a-research-map.md
- 更新后的研究计划和 Agent 任务书。

退出条件：
- 研究目标清楚；
- 关键问题可分阶段回答；
- 源码和测试入口明确；
- 没有把“文件清单”误当成研究目标。

### 阶段 B｜研究 Cordis Runtime 与 Loader 的真实机制

**状态：待执行**

目标：弄清一个插件从配置声明到加载、激活、依赖变化、卸载的实际过程。

研究重点：
- Plugin 入口形态、Registry 和 Fiber；
- Context、Service 注册与服务解析；
- inject 的依赖激活与 Provider 替换；
- Effect/disposer、父子插件所有权和异步清理；
- Event 的注册、分发和生命周期；
- Loader 配置项、插件树、Group/Include 和 HMR 的必要机制。

资料策略：
- 官方文档作为概念和契约入口；
- 固定 Commit 的 vendor 源码作为实际实现依据；
- 对应测试作为边界行为证据；
- 只有文档、源码、测试无法回答时，才做最小运行实验。

主要源码入口：
- vendor/cordis/src/context.ts、registry.ts、fiber.ts、service.ts、events.ts、reflect.ts
- vendor/loader/src/index.ts、config/entry.ts、config/tree.ts、config/group.ts、config/isolate.ts

测试入口：
- scripts/cordis-core-lifecycle.spec.ts
- scripts/cordis-core-api.spec.ts
- scripts/cordis-loader-resolve.spec.ts
- packages/boot/app-boot/tests/user-patches.spec.ts

产出：
- 03-research-notes.md 中的运行机制章节；
- 一张“配置声明 → Loader → Registry/Fiber → apply → Service/事件 → dispose”的初步流程图；
- 每个关键机制的源码和测试证据表。

退出条件：
- 能用源码解释关键机制；
- 测试证据没有被误读；
- 明确哪些行为尚未验证；
- 没有将上游 Cordis 行为直接当成 Harness 行为。

### 阶段 C｜追踪一个真实产品插件/能力 seam

**状态：待执行**

目标：将 Cordis 的抽象与 DeepSeek Harness 的真实产品实现连接起来。

先比较候选：
- 教程 greet-tool：适合作为最小辅助例子；
- Bash 三角色组合：Service Definition / Provider / Consumer，适合说明可替换能力；
- LLM Provider Adapter：适合说明模型适配器如何接入统一服务；
- Agent Loop：适合说明核心执行循环本身也可以是插件，但复杂度较高。

选择标准：
- 与 Everything is a Plugin 主旨直接相关；
- 代码范围可控；
- 依赖和注册入口容易追踪；
- 有对应测试；
- 能讲清楚加载、依赖、提供能力和卸载；
- 不需要真实 API Key 或外部服务才能理解核心链路。

产出：
- 04-source-trace.md；
- 候选比较表；
- 最终案例的配置入口、调用链、关键符号、依赖图和测试证据。

退出条件：
- 选定一个主案例；
- 能从组合入口追踪到插件行为；
- 能解释哪些是 Cordis 机制，哪些是插件自己的业务逻辑。

### 阶段 D｜分析设计价值、代价与适用边界

**状态：待执行**

目标：不把“插件化更灵活”当成未经论证的口号。

至少分析：
- 插件组合与配置替换解决了什么问题；
- Service Definition / Provider / Consumer 分离带来什么变化；
- inject 与生命周期协调怎样减少手工依赖管理；
- Effect/disposer 怎样约束副作用所有权；
- Event 怎样支持松耦合扩展；
- 依赖等待、PENDING、服务命名、调试、版本兼容和 HMR 带来哪些复杂度；
- 什么情况下插件化值得采用，什么情况下可能过度设计。

产出：
- 03-research-notes.md 中的设计分析章节；
- 一张收益/代价/适用边界对照表。

证据规则：
- 官方明确写出的目标标为 OFFICIAL；
- 源码行为标为 SOURCE；
- 测试断言标为 TEST；
- 运行观察标为 RUN；
- 工程推导标为 ANALYSIS；
- 证据不足标为 OPEN。

### 阶段 E｜反向讲解与知识验收

**状态：待执行**

目标：检验研究者是否真正理解，而不是只会引用 AI 生成的文档。

验收任务：
1. 不看原文，用 3–5 分钟解释 Everything is a Plugin；
2. 画出 Harness、Cordis、Plugin、Context、Service、Loader 和 Profile 之间的关系；
3. 用真实插件解释依赖和生命周期；
4. 回答 Provider 替换、依赖缺失、插件卸载和资源清理等问题；
5. 解释设计的收益、代价和不适用边界；
6. 对每条核心结论能指出证据位置。

产出：
- 03-research-notes.md 的通俗解释和验收记录；
- 最终架构图；
- 待讲解问题清单和已解决情况。

退出条件：
- 用户能够用自己的语言讲明白；
- 核心图示与源码证据一致；
- 没有把 OPEN 项目包装成确定事实。

## 4. 阶段完成后再进入 PPT

研究阶段通过验收后，才开始：

1. 确定听众、时长和讲解目标；
2. 形成 8–10 页左右的内容大纲（以研究结果为准，不为页数凑内容）；
3. 为每页定义核心观点、必要证据和图示；
4. 形成统一的 Slide Spec；
5. HTML Renderer 生成可浏览原型；
6. 审核内容、叙事、图示和视觉；
7. PPTX Renderer 生成原生可编辑 Office 页面；
8. 对 HTML 与 PPTX 分别验收。

HTML 与 PPTX 共用内容和页面设计定义，但不承诺像素级 1:1；PPTX 需要针对 PowerPoint 的原生对象重新实现和检查。

## 5. 资料与证据策略

### 资料不是固定的八份文档

官方 README、架构文档和 Cordis 教程是入口，不是封闭清单。研究范围应根据问题扩展到：
- 官方 API 参考；
- 产品包 README；
- 固定 Commit 源码；
- 对应测试；
- 必要的最小运行实验；
- 官方 README 引用的理论论文。

扩展资料必须回答当前研究问题，不能为了“资料多”而增加阅读量。

### 固定版本

- 仓库：deepseek-ai/deepseek-harness
- 默认分支：master
- 本轮固定 SHA：4b399c39a6d1479cd84ca591b4d7c88e24d38a96

Cordis 的上游来源和 Harness 本地修改见官方固定版本中的 vendor/README.md。研究实际行为必须以 Harness vendored 源码为准。

### 证据等级

| 标签 | 含义 |
|---|---|
| OFFICIAL | 官方文档直接说明 |
| SOURCE | 固定 Commit 源码直接证明 |
| TEST | 固定 Commit 测试断言覆盖 |
| RUN | 明确环境下实际运行观察 |
| ANALYSIS | 基于上述证据形成的工程解释 |
| OPEN | 证据不足或存在歧义 |

每个核心结论记录来源、文件路径、章节/符号/行号、固定 Commit 链接、证据支持范围和不能推断的内容。

## 6. 分阶段提交规则

用户要求每个阶段完成后再更新云仓库，不把全部成果一次性堆上去。

因此：
- 每个阶段有独立目标、交付物和退出条件；
- 阶段未完成时不提前写成已完成；
- 阶段完成后先自检链接、证据和范围，再单独提交到 aihao16888/ai-assistant 的 test 分支；
- 每次提交只包含当前阶段及其必要索引更新；
- 不直接修改 main，不自动合并；
- 不把未经审核的阶段结果当作下一阶段的确定输入。

## 7. 当前状态

| 阶段 | 状态 | 结果 |
|---|---|---|
| A 问题地图 | 已完成 | 00-stage-a-research-map.md |
| B Runtime 机制 | 待执行 | 计划读取 Cordis/Loader 源码和测试 |
| C 真实插件案例 | 待执行 | 候选已列出，尚未选择 |
| D 价值与代价 | 待执行 | 等待 B/C 证据 |
| E 知识验收 | 待执行 | 等待研究结论 |

## 更新记录

- 2026-11-28：将原先“R1 只读 8 份官方文档”的安排升级为问题驱动的 A–E 研究路线；阶段 A 已完成并建立问题地图。明确每阶段独立验收、独立提交，禁止全仓库无差别扫描。
