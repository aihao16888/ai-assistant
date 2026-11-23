# Java 后端工程师求职与面试知识库

> 初始版本：v0.2  
> 建立日期：2026-11-23  
> 当前状态：**待用户审计**  
> 核心目标：把真实项目经历、岗位招聘要求、技术原理和面试复盘沉淀为可持续复用的个人求职资产。

## 1. 这个知识库解决什么问题？

本目录不是某一家公司的临时面试笔记，而是长期维护的求职知识库。它需要回答四个问题：

1. **企业要什么？** 收集不同公司的招聘要求，保留原文并提炼岗位能力。
2. **我做过什么？** 整理真实项目、个人职责、技术使用场景和可核验结果。
3. **我是否真正理解？** 对项目涉及的技术建立有解释、有例子、有边界的知识材料。
4. **面对某家公司还差什么？** 将招聘要求与个人素材、技术掌握程度进行匹配，形成专项准备和面试复盘。

不把这四类内容混写在同一篇文档中。招聘原文、个人经历、通用技术原理和岗位分析分别维护，再通过岗位专项准备文档建立关联。

## 2. 目录结构

~~~text
docs/java-backend-interview/
├── README.md
├── 01-document-code-generation-and-redis-concurrency.md  # 早期专题原稿，暂时保留
├── company-requirements/                # 公司招聘要求库
│   ├── README.md
│   └── nuoyin-intelligent/
│       └── backend-development-engineer.md
├── candidate-materials/                 # 个人经历素材库
│   ├── README.md
│   ├── projects/
│   │   └── document-management-system.md
│   └── technology-stack-inventory.md
├── technical-knowledge/                 # 通用技术知识库
│   ├── README.md
│   ├── java/
│   │   └── concurrency-and-locks.md
│   ├── redis/
│   │   └── cache-lock-counter-and-uniqueness.md
│   ├── database/
│   │   └── mysql-postgresql-and-sql-performance.md
│   ├── messaging/
│   │   └── rabbitmq-and-oa-approval-sync.md
│   └── microservices/
│       └── distributed-deployment-and-data-consistency.md
└── preparation-records/                 # 每家公司独立的准备与复盘
    ├── README.md
    └── nuoyin-intelligent/
        └── backend-engineer.md
~~~

## 3. 四类资料的边界

| 资料类别 | 记录什么 | 不应该记录什么 |
|---|---|---|
| 公司招聘要求 | 招聘原文、岗位职责、任职资格、明确要求 | 把我们的推断写成公司原话 |
| 个人经历素材 | 系统背景、本人职责、真实业务问题、实际技术使用 | 团队做过但本人未参与的内容 |
| 技术知识 | 概念、原理、工作机制、使用条件、异常边界、项目映射 | 只罗列名词或只写验收口号 |
| 岗位专项准备 | JD 匹配、差距、复习顺序、模拟问题、面试复盘 | 复制整份通用知识库，造成多处重复维护 |

## 4. 知识点优先级与掌握状态

### 4.1 优先级：决定先学什么

| 等级 | 含义 | 要达到的能力 |
|---|---|---|
| **P0 必须掌握** | 岗位核心能力，或真实项目中的关键技术 | 能解释原理、结合项目讲实现、分析异常和取舍，并回答连续追问 |
| **P1 重点理解** | 招聘要求明确涉及，或项目相关但不是当前最核心的深度考点 | 能解释解决的问题、基本机制、适用场景、主要优缺点 |
| **P2 了解即可** | 当前岗位的次要要求或暂时没有实践的扩展技术 | 能说明概念、用途和与已有技术的关系，不冒充项目经验 |

优先级不是技术本身的绝对重要程度，而是结合当前目标岗位、真实项目和学习投入做出的准备排序。换一家公司后可以调整。

### 4.2 掌握状态：决定目前学到什么程度

| 状态 | 名称 | 判定依据 |
|---|---|---|
| **S0** | 未学习 | 尚未系统学习，无法独立解释 |
| **S1** | 初步理解 | 看过资料或实际接触过，能说出基本用途，但解释不完整 |
| **S2** | 能够讲解 | 不依赖资料，能解释核心原理、流程和项目使用方式 |
| **S3** | 能应对追问 | 能分析失败场景、边界条件、替代方案和技术取舍 |
| **S4** | 有项目证据 | 能用本人参与的代码、配置、SQL、日志、测试或脱敏运行记录证明实践 |

S4 不等于“理论上最高级”，而是表示有真实实践证据。一个知识点可以是 P0/S1，也可以是 P1/S4。

**初始状态只是待审计估计，不是对用户能力的最终评价。** 用户审计后再修订。

## 5. 每个技术知识专题的统一结构

每篇技术专题都应包含：

1. 一句话结论：先说清楚它解决什么问题。
2. 专业定义：使用准确的技术术语解释。
3. 工作机制：按执行顺序解释内部发生了什么。
4. 大白话解释：把专业原理翻译成容易理解的语言。
5. 项目映射：说明 DMS 或其他项目中对应的业务场景。
6. 关键问题与答案：给出可以直接练习的面试回答。
7. 追问与边界：覆盖异常、并发、失败恢复和方案取舍。
8. 优先级、掌握状态和验收标准：验收标准必须对应前面已经解释的知识，不能只写“能够回答”。
9. 待核实项：区分项目事实与尚未确认的实现细节。

## 6. 事实与证据规则

每条项目材料都使用以下标签：

- **已确认**：用户明确描述过的项目事实。
- **待核实**：目前只有概括描述，尚未核对代码、配置、数据库或实际流程。
- **技术解释**：根据通用技术原理进行的说明，不代表项目一定采用了该实现。
- **分析推断**：根据招聘要求推断的可能考察方向，不是企业明确承诺的面试题。

禁止：
- 把“系统使用了某技术”直接写成“本人独立设计并实现”；
- 把建议采用的可靠性方案写成项目现状；
- 编造 QPS、耗时、数据量、性能提升比例或故障恢复结果；
- 把看过、听过、用过和能够独立设计混为一谈；
- 把 Docker、Kubernetes、Kafka、MongoDB 等未确认的实践写成个人项目经验。

## 7. 当前资料入口

### 公司招聘要求
- [诺因智能｜后端开发工程师](./company-requirements/nuoyin-intelligent/backend-development-engineer.md)

### 个人经历素材
- [个人经历素材库说明](./candidate-materials/README.md)
- [文档管理系统项目素材](./candidate-materials/projects/document-management-system.md)
- [个人技术栈盘点](./candidate-materials/technology-stack-inventory.md)

### 技术知识
- [技术知识库总览](./technical-knowledge/README.md)
- [Java 并发与锁](./technical-knowledge/java/concurrency-and-locks.md)
- [Redis 缓存、分布式锁与唯一序号](./technical-knowledge/redis/cache-lock-counter-and-uniqueness.md)
- [MySQL、PostgreSQL 与 SQL 调优](./technical-knowledge/database/mysql-postgresql-and-sql-performance.md)
- [RabbitMQ 与 OA 审批同步](./technical-knowledge/messaging/rabbitmq-and-oa-approval-sync.md)
- [微服务、多实例部署与数据一致性](./technical-knowledge/microservices/distributed-deployment-and-data-consistency.md)

### 岗位专项准备
- [专项准备目录说明](./preparation-records/README.md)
- [诺因智能｜后端工程师专项准备](./preparation-records/nuoyin-intelligent/backend-engineer.md)

### 历史材料
- [早期安全编码与 Redis 并发专题原稿](./01-document-code-generation-and-redis-concurrency.md)

## 8. 当前阶段的审计任务

请优先审计以下内容：

- [ ] 诺因智能招聘原文是否准确，有没有漏项或误读。
- [ ] DMS 项目事实是否符合实际，特别是本人职责与系统整体职责的边界。
- [ ] Redis 序号生成、重复提交防护的技术解释是否符合实际实现。
- [ ] RabbitMQ 消息从 OA 到 DMS、再到第三方的链路是否准确。
- [ ] MySQL/PostgreSQL 的类型映射问题是否准确描述。
- [ ] 三台服务器是否属于同一服务的多实例，还是不同服务/角色的部署。
- [ ] P0/P1/P2 的优先级是否合理。
- [ ] 各知识点的解释是否足够准确、深入，能否作为学习材料使用。

本版本是结构和内容的第一轮草稿，**待用户逐项审计，不视为最终定稿**。

---

## 维护记录

- 2026-11-23：建立求职知识库初始结构；录入诺因智能后端开发工程师岗位；建立 DMS 项目素材、技术栈盘点、Java/Redis/数据库/RabbitMQ/微服务知识专题及岗位专项准备初稿。
