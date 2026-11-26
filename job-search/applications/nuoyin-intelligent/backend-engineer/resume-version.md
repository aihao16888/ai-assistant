# 诺因智能｜后端开发工程师简历版本

> 当前版本：v0.2  
> 建立日期：2026-11-26  
> 状态：**DMS 项目经历片段已形成，可供用户审计；完整简历尚未完成，不能直接视为最终投递稿。**

## 1. 版本信息

| 字段 | 内容 |
|---|---|
| 公司 | 诺因智能 |
| 岗位 | 后端开发工程师 |
| 版本 | v0.2（项目经历片段待审） |
| 基础事实来源 | [主简历事实底稿](../../../profile/master-resume.md) |
| 项目事实来源 | [DMS 完整项目素材](../../../profile/projects/document-management-system.md) |
| 通用简历项目经历 | [DMS 简历项目经历模块](../../../profile/resume-projects/document-management-system.md) |
| 岗位匹配依据 | [JD 匹配分析](./jd-match-analysis.md) |
| 调整理由 | [项目经历与简历调整记录](./project-experience-adjustment.md) |

## 2. 本岗位项目经历（可审计初稿）

**企业文档管理系统（DMS）｜Java 后端开发**  
**技术栈：** Java、Spring Boot、Redis、RabbitMQ、SQL  
**项目时间：** 待补充

- 参与企业文档管理平台后端开发与维护，涉及文档受控发布、OA 审批流转、安全编码生成及第三方系统集成。
- 针对同一文件短时间重复发起受控发布的问题，使用 Redis 记录文件标识并拦截重复请求，避免重复触发后续流程。
- 针对多个部门并发申请同一编号范围产生的序号竞争，结合 Java 本地锁与 Redis 分布式锁控制生成过程，利用 Redis 缓存并递增最新序号，再同步至数据库序号表，支撑单次约 50 个安全编码批量生成。
- 参与基于 RabbitMQ 的 OA 审批消息同步，DMS 根据审批节点及业务状态识别处理时机，并按业务条件向第三方系统同步数据。
- 排查编号查询中数据库数值字段与 Java String 参数类型不一致的问题，将查询参数调整为 Long，使查询恢复预期的等值匹配行为。

## 3. 每条简历内容对应的面试材料

| 简历条目 | 故事 ID | 面试材料 |
|---|---|---|
| 项目背景与职责 | DMS-01 | [DMS 项目素材 §5 的 60 秒介绍](../../../profile/projects/document-management-system.md) |
| Redis 防重 | DMS-02 | [Redis 重复提交防护](../../../interview-assets/story-bank/redis-duplicate-submission.md) |
| 安全编码并发生成 | DMS-03 | [安全编码生成与 Redis 并发控制](../../../interview-assets/story-bank/security-code-generation-and-redis-concurrency.md) |
| RabbitMQ 审批同步 | DMS-04 | [RabbitMQ 与 OA 审批节点同步](../../../interview-assets/story-bank/rabbitmq-oa-approval-sync.md) |
| 数据库类型与查询 | DMS-05 | [数据库类型映射与查询排查](../../../interview-assets/story-bank/database-type-mismatch-query.md) |

## 4. 当前版本的表达边界

- “参与”是当前保守措辞；用户确认具体模块职责后，再决定是否可以改为“负责”。
- MySQL / PostgreSQL 的具体使用范围尚未确认，因此项目技术栈暂写“SQL”，不把两个数据库产品都直接写成项目实践。
- 数据库案例只描述类型不一致及调整参数后的查询行为，不声称已经证明全表扫描、索引失效或性能提升。
- RabbitMQ 只描述已知的 OA → DMS 节点消息同步及 DMS 按条件向第三方同步，不补写未确认的 Exchange、Queue、ACK 或重试实现。
- Redis 防重不等同于完整业务幂等；安全编码并发控制的异常恢复细节仍待确认。
- 没有真实数据时不编造 QPS、耗时、成功率、故障率或性能提升比例。

## 5. 完整简历仍需补齐

- [ ] 姓名、联系方式、所在城市和求职意向。
- [ ] 学历、专业、毕业时间。
- [ ] 工作单位、岗位名称和准确起止时间。
- [ ] DMS 项目起止时间、本人负责模块及实际交付。
- [ ] 技术能力清单及真实掌握程度。
- [ ] 是否有其他值得保留的项目或工作成果。
- [ ] 最终简历版式、页数和导出格式。

**当前完成范围：** 本轮完成 DMS 项目经历的 5 条简历表达及逐条故事映射；尚未声称完整简历已经可以投递。
