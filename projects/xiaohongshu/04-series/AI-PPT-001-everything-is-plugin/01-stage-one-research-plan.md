# AI-PPT-001｜Everything is a Plugin 研究与知识构建计划

- 更新日期：2026-11-28
- 项目：[brief.md](./brief.md)
- 阶段 A 成果：[研究问题地图](./00-stage-a-research-map.md)
- 阶段 B 成果：[Cordis Runtime 与 Loader 研究笔记](./03-research-notes.md)
- Agent 任务书：[02-first-round-agent-task.md](./02-first-round-agent-task.md)
- 当前状态：**阶段 A、B 已完成；下一步进入阶段 C**

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
A. 建立问题地图和资料地图
        ↓
B. 理解 Cordis Runtime 与 Loader
        ↓
C. 追踪真实产品插件
        ↓
D. 分析设计价值与代价
        ↓
E. 反向讲解、证据审核、知识验收
        ↓
设计 PPT 叙事与页面
        ↓
HTML 原型 → 审核 → 原生可编辑 PPTX
~~~

阶段 A–E 属于知识研究；PPT 内容策划和制作在研究通过后启动。

## 3. 分阶段执行与交付

### 阶段 A｜建立研究问题地图

**状态：已完成**

产出：00-stage-a-research-map.md。

完成内容：
- 核验官方仓库和固定 Commit；
- 识别官方文档、API 参考、源码、测试和运行验证入口；
- 明确“Everything”指什么、不指什么；
- 区分 Plugin、Service、Context、Bundle、Profile、Patch；
- 建立后续研究问题和真实插件候选。

### 阶段 B｜研究 Cordis Runtime 与 Loader 的真实机制

**状态：已完成（源码与测试静态审查）**

产出：03-research-notes.md。

完成内容：
- Plugin 入口、Registry、Runtime、Fiber；
- Context、Service、inject 和服务作用域；
- Effect、dispose、父子插件所有权；
- Event 五种分发模式；
- Loader、EntryTree、Entry 和 Fiber 创建；
- 通过固定版本测试代码核对 Provider/Consumer teardown、Provider 替换、FAILED 恢复等边界。

验证边界：
- 本阶段读取了固定版本源码和测试断言，没有在本地运行测试；
- V6 重入卸载等并发边界保留为 OPEN；
- 不将静态代码审查描述成 RUN 或测试 PASS。

### 阶段 C｜追踪一个真实产品插件/能力 seam

**状态：待执行**

目标：将 Cordis 抽象与 DeepSeek Harness 的真实产品实现连接起来。

候选：
- Bash 三角色组合：Service Definition / Provider / Consumer；
- LLM Provider Adapter：模型适配器接入统一 LLM 服务；
- Agent Loop：核心执行循环本身作为插件。

选择标准：
- 与 Everything is a Plugin 主旨直接相关；
- 代码范围可控；
- 依赖和注册入口清晰；
- 有对应测试；
- 能讲清加载、依赖、提供能力和卸载；
- 不需要真实 API Key 或外部服务才能理解核心链路。

产出：
- 04-source-trace.md；
- 候选比较表；
- 最终案例的配置入口、调用链、关键符号、依赖图和测试证据。

### 阶段 D｜分析设计价值、代价与适用边界

**状态：待执行**

基于 B/C 的证据分析：
- 插件组合与配置替换解决了什么问题；
- Service Definition / Provider / Consumer 分离带来什么变化；
- inject 与生命周期协调怎样管理依赖；
- Effect/disposer 怎样约束副作用所有权；
- Event 怎样支持松耦合扩展；
- PENDING、失败恢复、服务命名、调试、版本兼容和 HMR 带来哪些复杂度；
- 什么情况下插件化值得采用，什么情况下可能过度设计。

产出：更新 03-research-notes.md，加入收益、代价、适用边界和证据对照。

没有性能或效率基准时，不得声称插件化提升了性能或开发效率。

### 阶段 E｜反向讲解和知识验收

**状态：待执行**

必须能：
1. 不看原文，用 3–5 分钟解释 Everything is a Plugin；
2. 画出实际架构关系图；
3. 用真实插件解释加载、依赖、注册和卸载；
4. 解释 Provider 替换、依赖缺失、FAILED 恢复和资源清理；
5. 解释设计收益、代价和不适用边界；
6. 对核心结论指出源码/测试位置。

产出：更新 03-research-notes.md，记录通俗讲解、架构图、提问与回答、验收结果和仍开放的问题。

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

资料不是固定的八份文档。研究范围根据问题扩展到官方 API 参考、产品包 README、固定 Commit 源码、对应测试、必要的最小运行实验和官方引用的理论论文。

每次扩展资料都必须说明它回答了哪个问题，不能为了“资料多”而增加阅读量。

固定版本：
- 仓库：deepseek-ai/deepseek-harness
- 默认分支：master
- 本轮固定 SHA：4b399c39a6d1479cd84ca591b4d7c88e24d38a96

Cordis 的上游来源和 Harness 本地修改见固定版本中的 vendor/README.md。实际行为以 Harness vendored 源码为准。

证据等级：
- OFFICIAL：官方文档直接说明；
- SOURCE：固定 Commit 源码直接证明；
- TEST：固定 Commit 测试断言覆盖；
- RUN：明确环境下实际运行观察；
- ANALYSIS：基于上述证据形成的工程解释；
- OPEN：证据不足或存在歧义。

## 6. 分阶段提交规则

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
| B Runtime 机制 | 已完成（静态审查） | 03-research-notes.md |
| C 真实插件案例 | 待执行 | 候选待比较 |
| D 价值与代价 | 待执行 | 等待 C 的产品证据 |
| E 知识验收 | 待执行 | 等待研究结论 |

## 更新记录

- 2026-11-28：阶段 A 完成，建立问题地图。
- 2026-11-28：阶段 B 完成源码与测试静态审查；未执行本地测试，保留运行边界 OPEN；下一步进入阶段 C。
