# Java 后端技术知识库

> 目标：把技术原理讲清楚，并能映射到真实项目；不是只收集面试题答案。  
> 当前状态：已有第一批 Java、Redis、数据库、RabbitMQ 和分布式部署专题，整体待用户审计。

## 1. 知识专题的统一结构

每个专题尽量包含：

1. 一句话结论；
2. 专业术语和准确解释；
3. 内部工作机制与执行过程；
4. 大白话解释；
5. 与真实项目的映射；
6. 常见问题与参考答案；
7. 失败场景、边界条件和方案取舍；
8. P0/P1/P2 优先级、S0–S4 掌握状态和可检验的验收标准；
9. 项目事实待核实项。

## 2. 当前知识专题

### Java
- [Java 并发与锁](./java/concurrency-and-locks.md)

### Redis
- [Redis 缓存、分布式锁与唯一序号](./redis/cache-lock-counter-and-uniqueness.md)

### 数据库
- [MySQL、PostgreSQL 与 SQL 性能优化](./database/mysql-postgresql-and-sql-performance.md)

### 消息中间件
- [RabbitMQ 与 OA 审批节点同步](./messaging/rabbitmq-and-oa-approval-sync.md)

### 分布式系统与微服务
- [微服务、多实例部署与数据一致性](./distributed-systems/distributed-deployment-and-data-consistency.md)

## 3. 后续建议补充

以下是待建立的专题方向，不代表目前已有实际实践或完整学习材料：

- Spring Boot：IOC、AOP、自动配置、事务传播与失效场景；
- Java：集合、JVM、线程池、异常处理和常见设计原则；
- 数据库：索引结构、事务隔离、锁、MVCC、慢 SQL 和分页；
- Linux：日志检索、进程、端口、CPU/内存和磁盘排查；
- Git：分支模型、合并、冲突处理、rebase 与 revert；
- 消息队列：RabbitMQ 消息可靠性、重复消费、重试、死信与积压；
- Docker/Kubernetes：先建立概念认知，不写成个人项目经验。

## 4. 学习顺序

优先从真实项目遇到的问题出发，再扩展到通用原理。岗位专项目录引用本知识库，不要为每家公司复制一份相同技术说明。

## 5. 优先级与掌握状态

优先级：
- P0：必须掌握，能够解释原理、项目实现和异常追问；
- P1：重点理解，能够说明机制、场景、风险和主要取舍；
- P2：了解即可，能够说明概念和用途，不包装为项目实践。

掌握状态：
- S0：未学习；
- S1：初步理解；
- S2：能够独立讲解核心原理和流程；
- S3：能分析异常、边界和替代方案并应对追问；
- S4：有本人参与的项目证据或可核验实践材料。

优先级和掌握状态是两个独立维度。
