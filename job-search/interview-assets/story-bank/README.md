# 项目故事库

项目故事不是把技术名词串成一段话，而是从真实业务问题出发，讲清楚本人做了什么、为什么这样做、结果如何，以及技术方案的边界。

## 每个故事建议包含

1. 业务背景与目标；
2. 触发问题和影响；
3. 本人职责和参与范围；
4. 方案设计与技术机制；
5. 关键实现和协作；
6. 结果与可核验证据；
7. 异常场景、方案取舍和复盘；
8. 60–90 秒表达稿；
9. 面试官可能追问的问题。

## 当前故事

- [文档安全编码生成与 Redis 并发控制](./security-code-generation-and-redis-concurrency.md)：围绕全局唯一编码、批量序号竞争、本地锁、Redis 分布式锁、计数器和数据库序号持久化展开。

项目原始素材见 [DMS 项目经历](../../profile/projects/document-management-system.md)。通用 Redis 原理见 [Redis 知识专题](../../knowledge/redis/cache-lock-counter-and-uniqueness.md)。
