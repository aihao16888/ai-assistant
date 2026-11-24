# 数据库：从 SQL 查询到事务并发，再到线上排障

> 优先级：P0 必须掌握  
> 掌握状态：待测评；目标 S3（能解释、定位、处理和验证）  
> 适用范围：MySQL InnoDB 与 PostgreSQL。具体行为必须结合数据库版本、存储引擎和配置确认。  
> 关联项目：DMS 数值字段与 Java 参数类型映射、编号表、SQL 查询和数据持久化。

## 先看这条主线

数据库问题通常不是孤立的“索引问题”或“事务问题”，而是这条链路：

~~~text
应用发出 SQL
    ↓
数据库解析 SQL、选择执行计划
    ↓
通过索引或表扫描找到数据
    ↓
读取或修改数据
    ↓
多个事务可能同时访问同一批数据
    ↓
数据库通过 MVCC、锁、约束和事务规则保证并发行为
    ↓
如果慢或结果不对，用执行计划、锁状态和事务状态定位
~~~

学数据库，必须能沿着这条链路解释问题。

## 1. 数据库首先要保证什么？

关系型数据库负责持久化数据，并提供查询、约束、事务和并发控制。

设计和排查时先确认四件事：

- **数据类型**：Java 属性、SQL 参数和数据库列的类型是否一致？
- **数据约束**：主键、唯一约束、非空约束是否表达了业务规则？
- **查询路径**：SQL 是通过索引定位，还是扫描大量数据？
- **并发规则**：多个事务同时读写时，彼此能看到什么、谁需要等待？

### 主键和唯一约束为什么重要？

假设安全编码必须唯一。仅在 Java 代码中先查询“编号是否存在”，再插入，并不能防止两个并发请求同时查到“不存在”。

正确性最终应该由数据库约束兜底：

~~~sql
CREATE TABLE document_code (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    CONSTRAINT uk_document_code UNIQUE (code)
);
~~~

两个请求即使同时尝试插入相同编码，也只能有一个成功；另一个会收到唯一约束冲突。应用需要捕获并按业务规则处理冲突。

**必须记住：** 应用层校验用于提前给出友好提示，数据库唯一约束用于最终保护数据正确性。

## 2. 为什么索引能让查询变快？

### 2.1 没有索引会发生什么？

例如：

~~~sql
SELECT id, status
FROM document
WHERE document_code = 'DOC-10001';
~~~

如果 document_code 没有合适索引，数据库可能逐行检查记录，判断是否匹配。这类访问通常称为全表扫描。

如果有合适的 B-tree 索引，数据库可以沿着有序的多层索引结构定位目标键值，再读取对应记录，通常不需要检查整张表。

**B-tree 索引可以理解为多层有序目录。** 根节点帮助定位范围，中间节点继续缩小范围，叶子层保存键值及定位记录所需的信息。它减少的是查找过程中需要访问的数据页，不是让查询成本变成零。

### 2.2 必须掌握的索引知识

| 知识点 | 你必须理解什么 | 什么时候用到 |
|---|---|---|
| B-tree 索引 | 有序结构如何帮助等值和范围查询 | 判断某个查询是否适合建立索引 |
| 选择性 | 一个字段能过滤掉多少记录 | 判断索引字段是否有区分度 |
| 联合索引 | 多列索引的字段顺序影响查询路径 | 同时按多个字段过滤或排序 |
| 最左前缀 | MySQL 联合索引通常利用从首列开始的连续前缀；PostgreSQL 也受前导列影响，但优化器规则不完全相同 | 判断查询条件是否能利用已有联合索引 |
| 覆盖索引 | 查询需要的列是否能直接从索引获得 | 减少额外的数据页访问 |
| 索引成本 | 索引占空间，并增加 INSERT/UPDATE/DELETE 的维护成本 | 判断是否值得增加索引 |

例如建立联合索引：

~~~sql
CREATE INDEX idx_document_status_created
ON document(status, created_at);
~~~

它通常更适合：

~~~sql
WHERE status = ?
WHERE status = ? AND created_at >= ?
~~~

不能仅凭“查询中出现了 created_at”就断言该索引一定能高效使用。还要看数据库类型、索引结构、条件选择性、统计信息和执行计划。

### 2.3 为什么建了索引，数据库仍可能不使用？

常见原因：

1. 查询返回表中很大比例的数据，扫描表可能更便宜。
2. 对索引列套函数或进行表达式计算，普通索引可能无法直接匹配。
3. 参数类型与列类型不一致，发生隐式转换；转换发生在列侧时可能影响索引条件。
4. 联合索引的查询条件不符合可利用的前导列。
5. 使用前置通配符，例如 LIKE '%abc'，普通 B-tree 索引通常无法直接定位开头。
6. 表很小，扫描全表比访问索引再回表更划算。
7. 统计信息不准确，优化器估算的数据量与实际情况偏差较大。

**不要背“有索引就一定走索引”。要用执行计划验证。**

## 3. SQL 为什么变慢？怎么定位？

先区分：接口慢不等于 SQL 慢。

一次请求可能耗时在：

- 应用线程池排队；
- 数据库连接池等待连接；
- SQL 执行；
- 锁等待；
- 网络传输；
- Java 业务处理或第三方调用。

### 3.1 第一轮排查

1. 确认接口、请求 ID、发生时间和影响范围。
2. 从应用日志找到对应 SQL 和参数。
3. 看数据库连接池是否有等待、活跃连接是否达到上限。
4. 区分 SQL 执行时间与等待锁的时间。
5. 再针对具体 SQL 查看执行计划。

### 3.2 EXPLAIN 怎么看？

MySQL：

~~~sql
EXPLAIN
SELECT id, status
FROM document
WHERE document_code = 'DOC-10001';
~~~

PostgreSQL：

~~~sql
EXPLAIN
SELECT id, status
FROM document
WHERE document_code = 'DOC-10001';
~~~

重点看：

- 使用了什么扫描方式；
- 选择了哪个索引；
- 预计扫描多少行；
- WHERE 条件在哪个节点过滤；
- JOIN 使用什么算法；
- 是否有排序、聚合或大量中间结果。

常见扫描方式：

| 计划节点 | 含义 | 需要关注 |
|---|---|---|
| Table Scan / Seq Scan | 扫描表中的记录 | 表大小、过滤比例；小表全表扫描可能完全合理 |
| Index Scan | 通过索引定位记录 | 索引选择性、回表数量 |
| Index Only Scan | 尽量直接从索引获得查询数据（PostgreSQL） | 是否仍需要访问堆表确认可见性 |
| Bitmap Index/Heap Scan | 先收集匹配位置，再批量访问数据页（PostgreSQL） | 匹配数量和堆表访问成本 |

MySQL 8.4 和 PostgreSQL 当前版本都支持 EXPLAIN ANALYZE 一类实际执行分析能力，但它不是纯静态查看：它会真实执行被分析的语句。尤其对 UPDATE/DELETE 等写操作，不能在生产环境随意执行。

### 3.3 执行计划怎么看出估算有问题？

比较优化器估算行数与实际行数：

- 估算 10 行，实际 100 万行：可能是统计信息、数据分布或条件相关性问题。
- 扫描大量记录后只留下极少结果：检查索引、过滤条件和字段类型。
- 大量 Nested Loop 循环：检查内外侧行数、连接条件和索引。
- 大量 Sort 或 Hash：检查排序、聚合、Join 数据量和内存使用。
- 执行计划很快但接口仍慢：继续检查连接池、网络、锁等待和应用处理时间。

## 4. 事务为什么存在？

事务把一组相关数据库操作作为一个工作单元。

例如转账：

~~~text
账户 A 扣款 100
    ↓
账户 B 增加 100
    ↓
提交事务
~~~

如果 A 已扣款而 B 没有到账，业务数据就不正确。事务要求这组操作按原子性规则一起提交或回滚。

### ACID 必须理解

- **Atomicity 原子性**：事务中的操作作为一个整体提交或回滚。
- **Consistency 一致性**：事务执行前后，数据库约束和业务不变量应保持成立；数据库不会自动替应用定义所有业务规则。
- **Isolation 隔离性**：并发事务之间按隔离规则控制可见性和冲突。
- **Durability 持久性**：事务提交成功后，数据库按其持久化承诺保存结果。

其中，隔离性是理解脏读、不可重复读、幻读和 MVCC 的入口。

## 5. 并发事务会产生什么问题？

假设有两个事务 T1 和 T2。它们几乎同时操作同一份数据。

### 5.1 脏读（Dirty Read）

发生过程：

~~~text
T1：把账户余额从 100 改成 50，但还没有提交
T2：读取余额，读到了 50
T1：发现业务失败，执行 ROLLBACK
~~~

T2 读到的 50 从未成为已提交数据。这就是脏读。

**核心问题：读到了其他事务尚未提交的修改。**

### 5.2 不可重复读（Non-repeatable Read）

发生过程：

~~~text
T1：第一次读取账户余额，得到 100
T2：把余额改为 80，并 COMMIT
T1：在同一个事务中再次读取余额，得到 80
~~~

同一个事务，两次读取同一行，结果不同。

**核心问题：同一行记录在两次读取之间被其他事务提交修改。**

### 5.3 幻读（Phantom Read）

发生过程：

~~~text
T1：查询所有 status = 'PENDING' 的订单，得到 3 条
T2：插入一条 status = 'PENDING' 的订单，并 COMMIT
T1：再次执行相同范围查询，得到 4 条
~~~

第二次查询多出了一条满足条件的新记录，看起来像“凭空出现”。

**核心问题：同一事务重复执行范围查询，符合条件的记录集合发生变化。**

它和不可重复读的区别：

- 不可重复读：之前读到的某一行，字段值被改了。
- 幻读：范围查询结果集合发生变化，可能多出或少了记录。

### 5.4 丢失更新（Lost Update）

这也是业务系统必须注意的并发问题：

~~~text
库存原来是 10

T1 读取库存 = 10
T2 读取库存 = 10
T1 计算后写入 9
T2 计算后写入 8

最终库存 = 8
~~~

T1 的更新被 T2 覆盖了。若业务原本希望扣两次库存，正确结果应该是 8；但若两边都基于旧值执行复杂读改写，也可能出现错误覆盖。

常见解决方式：

- 使用单条原子 SQL，例如 UPDATE ... SET stock = stock - 1 WHERE stock >= 1；
- 使用 SELECT ... FOR UPDATE 先锁定目标行；
- 使用版本号做乐观锁，例如 UPDATE ... WHERE version = ?；
- 使用唯一约束或业务约束保护最终状态。

不要把“数据库隔离级别能解决所有业务并发问题”当成结论。业务读改写逻辑仍需明确并发控制。

## 6. MVCC 是什么？为什么数据库需要它？

**MVCC = Multi-Version Concurrency Control，多版本并发控制。**

它的核心思想是：数据被修改时，不是让所有读取请求都只能等待最新版本，而是保留足够的信息，让读取事务能够按照自己的快照读取当时可见的数据版本。

### 6.1 不使用多版本会怎样？

如果所有读取都必须等待写入完成，或者所有写入都必须等待读取完成，读写并发时容易产生大量阻塞。

MVCC 的价值是：在符合隔离规则的普通一致性读取中，读取者可以读取一个可见版本，减少读写之间的互相阻塞。

### 6.2 先理解快照（Snapshot / Read View）

快照不是把整张表复制一份，而是数据库根据事务可见性规则判断：

- 哪些事务已经提交；
- 哪些事务当时还在执行；
- 哪些版本属于当前事务自己；
- 某条记录的哪个历史版本对当前读取可见。

因此，同一条数据可能存在多个物理或逻辑版本，事务读取时根据快照选择自己应该看到的版本。

### 6.3 MySQL InnoDB 如何实现？

MySQL InnoDB 使用 Undo Log 保存旧版本重建所需的信息，并通过 Read View 判断哪些版本对当前事务可见。

简化过程：

~~~text
记录当前值：余额 80
        ↓
事务 T2 将余额改成 50
        ↓
InnoDB 记录恢复旧版本所需的 Undo 信息
        ↓
事务 T1 按自己的 Read View 判断可见版本
        ↓
如果 T1 应该看到旧值，就沿版本链重建旧版本
~~~

Undo Log 不只是回滚用，也参与一致性读的历史版本重建。历史版本不再被任何活动快照需要后，数据库才可以清理相关旧版本。

### 6.4 PostgreSQL 如何实现？

PostgreSQL 通过保留行记录的多个 Tuple Version（元组版本）来支持 MVCC。每个 SQL 语句或事务根据 Snapshot 判断哪些版本可见。

旧版本不会在 UPDATE/DELETE 后立即全部消失；当不再需要它们时，需要由 VACUUM 等机制回收空间并维护表状态。

### 6.5 MVCC 不等于完全没有锁

必须记住：

- MVCC 主要解决读取时应该看到哪个版本的问题。
- UPDATE/DELETE 仍然需要协调对同一行的并发修改。
- SELECT FOR UPDATE 是锁定读取，不是普通快照读取。
- 唯一约束、外键约束、行锁和死锁仍然存在。
- MVCC 不能自动解决所有跨行的业务不变量。

**一句话：MVCC 解决“读哪个版本”，锁解决“谁可以修改或占用资源”，隔离级别决定事务之间允许出现什么现象。**

## 7. MySQL 与 PostgreSQL 如何处理隔离问题？

先记住两个默认值：

- MySQL InnoDB 默认：REPEATABLE READ。
- PostgreSQL 默认：READ COMMITTED。

### 7.1 四种隔离级别

| 隔离级别 | 核心含义 | 主要风险或代价 |
|---|---|---|
| READ UNCOMMITTED | 允许读取未提交数据 | 可能脏读，结果不可靠 |
| READ COMMITTED | 每条语句读取开始时已提交的数据 | 同一事务再次读取可能看到新提交，出现不可重复读和幻读 |
| REPEATABLE READ | 同一事务尽量保持稳定的读取视图 | 不同数据库实现不同；仍需关注写冲突和序列化异常 |
| SERIALIZABLE | 要求并发执行结果等价于某种串行执行 | 冲突时可能等待或回滚，应用需要处理重试 |

### 7.2 MySQL InnoDB 的关键行为

- 默认隔离级别是 REPEATABLE READ。
- 普通非锁定 SELECT 在同一事务中使用一致性快照；在 RR 下，同一事务的普通一致性读使用首次一致性读建立的快照。
- READ COMMITTED 下，每次一致性读会建立新的快照。
- 对范围条件的锁定读取、UPDATE 和 DELETE，InnoDB 在 RR 下可能使用 Gap Lock / Next-Key Lock，阻止其他事务向被保护的索引范围插入记录。
- READ COMMITTED 下通常不使用普通 Gap Lock 来防止幻读，因此范围内插入更容易发生。

**因此不能只说“MySQL RR 通过 MVCC 解决幻读”。** 普通一致性读依靠快照保持结果稳定；需要保护当前范围不被并发插入时，锁定读和 Next-Key Lock 又是另一条机制。

### 7.3 PostgreSQL 的关键行为

- 默认隔离级别是 READ COMMITTED。
- READ COMMITTED 下，每条 SQL 语句看到的是该语句开始时的快照；同一事务两次 SELECT 可能看到其他事务新提交的数据。
- REPEATABLE READ 使用事务级稳定快照，避免脏读、不可重复读和幻读。
- 但 REPEATABLE READ 仍可能出现 Serialization Anomaly（序列化异常），例如两个事务分别读取对方未修改的数据，再各自更新不同记录，最终共同破坏跨行约束。
- SERIALIZABLE 使用 Serializable Snapshot Isolation 等机制检测可能导致序列化异常的并发依赖；数据库可能中止其中一个事务，应用必须捕获并重试整个事务。

### 7.4 对照表：不要把两种数据库的行为混为一谈

| 问题 | MySQL InnoDB | PostgreSQL |
|---|---|---|
| 默认隔离级别 | REPEATABLE READ | READ COMMITTED |
| READ UNCOMMITTED | 可发生脏读 | 按 READ COMMITTED 处理，不发生脏读 |
| READ COMMITTED | 每次一致性读建立新快照 | 每条语句使用新快照 |
| REPEATABLE READ | 普通一致性读使用事务内稳定快照；锁定范围读可使用 Next-Key Lock | 事务使用稳定快照；不会发生幻读，但仍可能有序列化异常 |
| SERIALIZABLE | 更严格的锁定/串行化行为 | SSI 检测序列化异常，冲突时可能中止事务 |

这张表用于理解当前主流版本的基本行为，不代表所有数据库版本、配置和 SQL 语句的所有边界。实际排查必须先确认版本、隔离级别和语句类型。

## 8. 锁、死锁和并发更新怎么处理？

### 8.1 行锁

当两个事务同时修改同一行，数据库需要协调写入顺序。一个事务可能持有行锁，另一个事务等待。

### 8.2 SELECT FOR UPDATE

~~~sql
BEGIN;

SELECT stock
FROM product
WHERE id = 1001
FOR UPDATE;

UPDATE product
SET stock = stock - 1
WHERE id = 1001;

COMMIT;
~~~

它的目的不是“让查询更快”，而是先锁定目标记录，避免其他事务在当前事务完成前并发修改该行。

使用时要注意：

- 必须处于有效事务中；
- 锁持有到事务结束；
- 不要持锁执行很慢的远程调用；
- 多条记录加锁时尽量保持一致顺序；
- 事务失败时要正确回滚。

### 8.3 乐观锁

常见方式是增加 version 字段：

~~~sql
UPDATE product
SET stock = 9, version = version + 1
WHERE id = 1001 AND version = 7;
~~~

如果影响行数为 1，说明版本匹配，更新成功；如果为 0，说明数据已被其他事务修改，需要重新读取并按业务规则处理。

乐观锁适合冲突相对较少、允许检测冲突后重试的场景。

### 8.4 死锁是什么？

T1 持有 A，等待 B；T2 持有 B，等待 A。双方都无法继续，就形成死锁。

处理思路：

1. 先确认数据库报告的死锁事务和 SQL。
2. 找出双方持有的锁与等待的锁。
3. 检查多个事务获取资源的顺序是否不一致。
4. 缩短事务，避免事务内远程调用和长时间计算。
5. 统一多行更新顺序，必要时调整索引和锁范围。
6. 应用对数据库选择回滚的事务做好有限重试；重试必须具备幂等性。

**锁等待不一定是死锁。** 普通锁等待可能在持锁事务提交后恢复；死锁是等待关系形成环路，数据库通常会选择回滚其中一个事务。

## 9. MySQL / PostgreSQL 线上排查清单

### 9.1 慢 SQL

- [ ] 确认 SQL、参数、执行时间和影响范围。
- [ ] 确认数据库版本、表大小、索引和统计信息。
- [ ] 执行 EXPLAIN，检查扫描方式、索引、估算行数和 Join。
- [ ] 在安全环境中使用 EXPLAIN ANALYZE 对照实际行数和耗时。
- [ ] 检查类型转换、函数、排序、分页、N+1 和返回数据量。
- [ ] 修改后使用相同数据分布进行验证。

### 9.2 锁等待或事务卡住

MySQL 常用检查入口：

~~~sql
SHOW FULL PROCESSLIST;
SHOW ENGINE INNODB STATUS;
~~~

还可以检查 performance_schema 中的 data_locks 和 data_lock_waits（视版本与权限而定）。

PostgreSQL 常用检查入口：

~~~sql
SELECT pid, state, wait_event_type, wait_event,
       now() - query_start AS query_age, query
FROM pg_stat_activity
WHERE state <> 'idle';

SELECT pid, pg_blocking_pids(pid)
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
~~~

重点确认：

- 哪个事务持锁；
- 哪个事务在等待；
- 事务已经持续多久；
- 是否存在 idle in transaction；
- 是否有大批请求等待同一行或同一索引范围。

### 9.3 数据结果不正确

- [ ] 是否有并发读改写？
- [ ] 是否缺少唯一约束？
- [ ] 事务是否跨越了不该跨越的业务步骤？
- [ ] 隔离级别是否符合业务要求？
- [ ] 是否发生锁超时、死锁回滚后未正确重试？
- [ ] 是否存在 Redis 与数据库之间的双写不一致？

## 10. DMS 项目映射：已知事实与待核实边界

已知：编号相关字段在数据库中为数值类型，Java 对象中曾使用 String；调整为 Long 后，查询行为变得符合预期。

不能仅凭这个现象断言“隐式转换一定导致全表扫描”。必须补齐：

1. 实际数据库是 MySQL 还是 PostgreSQL，以及准确版本；
2. 表结构和字段类型；
3. Java 实体属性类型；
4. MyBatis/JDBC 实际绑定的参数类型；
5. 完整 SQL；
6. 字段索引；
7. 修改前后的执行计划和实际耗时。

排查路径：

~~~text
数据库列类型
    ↓
Java 属性类型
    ↓
MyBatis/JDBC 参数绑定类型
    ↓
最终 SQL 和参数
    ↓
EXPLAIN / 实际执行计划
    ↓
判断是否发生转换、索引是否使用
    ↓
修复类型映射并回归验证
~~~

这才是一个完整的数据库排障故事。没有执行计划，就不能把“索引失效”写成已证实的根因。

## 11. 必须掌握与重点理解

### P0：必须掌握，能用于日常开发和排障

- 数据类型、主键、唯一约束、非空约束；
- B-tree 索引、联合索引、选择性、覆盖索引；
- EXPLAIN 执行计划及常见扫描方式；
- SQL 慢查询定位步骤；
- 事务与 ACID；
- 脏读、不可重复读、幻读和丢失更新；
- MVCC 的目的、快照和版本可见性；
- MySQL InnoDB 与 PostgreSQL 默认隔离级别的区别；
- 行锁、SELECT FOR UPDATE、乐观锁、死锁；
- 参数类型不匹配和隐式转换的排查方式。

### P1：重点理解，能参与复杂问题分析

- Undo Log、Read View 和 PostgreSQL Tuple Version；
- MySQL Gap Lock / Next-Key Lock；
- PostgreSQL Snapshot Isolation、Serializable 与重试；
- 统计信息、执行计划估算偏差；
- 大分页、N+1、JOIN、排序和聚合；
- VACUUM、Undo 清理和长事务的影响；
- 连接池、锁监控和数据库性能指标。

## 12. 学完后的实操验收

不背答案，完成下面四项才算达到本专题目标：

1. **两会话事务实验**：自己操作两个数据库连接，复现脏读、不可重复读和幻读；再改变隔离级别，观察结果变化。
2. **MVCC 解释**：不看资料，画出 T1 读取旧版本、T2 更新并提交、T1 再次读取的过程；分别说明 MySQL InnoDB 和 PostgreSQL 的差异。
3. **SQL 计划分析**：准备一张有一定数据量的测试表，建立和删除索引，对比 EXPLAIN 计划；解释为什么优化器选择某种扫描方式。
4. **并发更新实验**：用两个事务同时修改库存或计数，分别使用普通读改写、原子 UPDATE、行锁和乐观锁，观察结果和冲突。

达到标准：能解释现象、说明原因、选择解决方案，并用数据库结果验证，不只是能背术语。

## 13. 官方资料

以下资料用于核对数据库版本相关行为，优先使用官方文档：

- [MySQL 8.4：InnoDB Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
- [MySQL 8.4：InnoDB Multi-Versioning](https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html)
- [MySQL 8.4：InnoDB Locking](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html)
- [MySQL 8.4：EXPLAIN](https://dev.mysql.com/doc/refman/8.4/en/explain.html)
- [PostgreSQL：Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL：MVCC Introduction](https://www.postgresql.org/docs/current/mvcc-intro.html)
- [PostgreSQL：Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)

> 本文按 2026-11-24 可查阅的 MySQL 8.4 与 PostgreSQL 当前官方文档整理。项目实际版本尚待确认。

