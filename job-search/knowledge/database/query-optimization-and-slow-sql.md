# 数据库查询优化：从慢 SQL 定位到执行计划改造

> 优先级：P0 必须掌握  
> 掌握目标：S3——能从真实 SQL、参数和执行计划中定位主要成本，提出可验证的优化方案，并评估副作用。  
> 适用范围：MySQL 8.4 / InnoDB 与 PostgreSQL。不同版本、参数、数据分布和执行环境会影响计划。  
> 本文定位：数据库核心知识的独立专题，不是索引名词清单。

## 0. 查询优化到底在优化什么？

数据库执行一条查询，需要完成：

1. 找到符合条件的记录；
2. 读取查询需要的列；
3. 按关联条件组合多张表；
4. 执行排序、分组、聚合、去重；
5. 把结果返回给应用。

同一条 SQL 可以有多种执行方法：

- 扫描整张表，再过滤；
- 先走索引找到少量记录，再读取完整行；
- 先读取一张小表，再逐条查另一张表；
- 扫描两张表，再通过 Hash Join 组合；
- 先排序，再合并；
- 利用有序索引直接得到所需顺序。

优化器会根据 SQL 结构、索引、统计信息和成本模型，选择它认为成本较低的执行计划。

所以，查询优化真正要解决的是：

**当前执行计划为什么做了这么多工作？哪些工作是必要的，哪些工作可以通过更合适的访问路径、SQL 结构或数据组织方式减少？**

完整链路：

~~~text
业务请求 / SQL 模板 / 绑定参数
             ↓
定位最值得优化的查询
             ↓
确认真实耗时发生在哪一层
             ↓
EXPLAIN：优化器计划做什么
             ↓
EXPLAIN ANALYZE：实际做了多少工作
             ↓
比较估算行数与实际行数，定位成本放大的节点
             ↓
判断根因：扫描、回表、JOIN、排序、统计信息、锁等待……
             ↓
提出一个明确的优化假设
             ↓
修改 SQL / 索引 / 统计信息 / 查询方式
             ↓
相同数据和参数下重新测量
             ↓
检查并发、写入成本、资源消耗和业务结果
~~~

没有执行前基线和执行后验证，就不能说优化已经成功。

## 1. 第一步：确认慢在哪里，而不是看到接口慢就改 SQL

### 1.1 一次接口请求的耗时由什么组成？

~~~text
请求进入应用
  ↓
应用线程池排队
  ↓
业务代码执行
  ↓
等待数据库连接池分配连接
  ↓
SQL 发送到数据库
  ↓
数据库解析 / 规划 / 执行 / 锁等待 / 读取数据
  ↓
结果通过网络返回
  ↓
JDBC / MyBatis 映射结果
  ↓
Java 后续处理 / 调用其他服务
  ↓
响应返回
~~~

因此：

- 接口耗时 3 秒，不代表 SQL 执行了 3 秒；
- SQL 执行 30 毫秒，不代表接口只需要 30 毫秒；
- 数据库 CPU 很高，不一定是某一条 SQL 慢，也可能是大量高频 SQL 累积；
- SQL 执行时间短，但锁等待、连接池等待或结果传输可能很长。

**先拆分时间，再决定优化对象。**

### 1.2 先区分六类问题

| 类别 | 典型现象 | 应该先查什么 |
|---|---|---|
| SQL 执行成本高 | 数据库端执行时间长，CPU 或 I/O 高 | 慢查询、执行计划、实际行数、Buffers |
| 锁等待 | SQL 看起来没做多少工作，却迟迟不结束 | 阻塞事务、锁等待事件、长事务 |
| 连接池等待 | 应用日志显示获取连接耗时，数据库未必繁忙 | 连接池 active / idle / pending / timeout |
| 线程池排队 | 请求还没真正执行数据库操作就已经等待 | Java 线程池活跃数、队列长度、拒绝次数 |
| 结果集过大 | 数据库执行结束后，接口仍然很慢 | Rows_sent、返回列数、网络传输、对象映射 |
| 调用频率过高 | 单次 SQL 不慢，但数据库整体压力大 | SQL 调用次数、总耗时、N+1 查询、重复查询 |

### 1.3 不要只看平均耗时

假设三类 SQL：

| SQL | 调用次数 | 平均耗时 | 总耗时 |
|---|---:|---:|---:|
| A | 10 | 2 秒 | 20 秒 |
| B | 100,000 | 10 毫秒 | 1,000 秒 |
| C | 5 | 5 秒 | 25 秒 |

如果只看单次耗时，B 看起来很快；但它对数据库总负载的贡献最大。

排查时至少同时看：

- 调用次数（Calls）；
- 总耗时（Total Time）；
- 平均耗时（Mean / Average）；
- 最大耗时或 P95/P99（如果监控平台提供）；
- 扫描行数与返回行数；
- 错误次数；
- 锁等待和资源等待。

**优先处理“调用频率 × 单次成本”造成的总负载，不要只追求优化最慢的一条 SQL。**

### 1.4 如何找出真正值得优化的 SQL？

MySQL 可以从 Performance Schema 的语句摘要开始：

~~~sql
SELECT
    DIGEST_TEXT,
    COUNT_STAR,
    ROUND(SUM_TIMER_WAIT / 1000000000000, 2) AS total_seconds,
    ROUND(AVG_TIMER_WAIT / 1000000000000, 4) AS avg_seconds,
    SUM_ROWS_EXAMINED,
    SUM_ROWS_SENT
FROM performance_schema.events_statements_summary_by_digest
WHERE SCHEMA_NAME = DATABASE()
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 20;
~~~

注意：

- 这是按 SQL Digest 聚合的实例级统计，不是某个用户请求的完整耗时；
- SUM_ROWS_EXAMINED 和 SUM_ROWS_SENT 可以帮助识别“扫描很多、返回很少”的查询；
- Performance Schema 统计有采集范围和重置周期，先确认监控数据覆盖的时间段；
- 不要只按平均耗时排序，调用频率和总耗时同样重要。

MySQL 慢查询日志也可以作为入口：

~~~sql
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'min_examined_row_limit';
SHOW VARIABLES LIKE 'log_output';
~~~

慢查询日志按配置阈值记录 SQL，但它不是全部性能问题的完整画像。低于阈值但执行频率极高的 SQL 仍可能造成显著负载。

PostgreSQL 可以使用 pg_stat_statements 对 SQL 进行归一化聚合：

~~~sql
SELECT
    queryid,
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_ms,
    ROUND(mean_exec_time::numeric, 2) AS mean_ms,
    rows,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
~~~

pg_stat_statements 需要在实例中启用扩展，并且统计具有重置周期。它适合找出累计消耗高的 SQL；单条请求的端到端耗时仍需结合应用链路追踪。

## 2. 第二步：读懂执行计划——数据库到底准备怎么执行？

### 2.1 什么是执行计划？

执行计划（Execution Plan）是优化器针对一条 SQL 选择的操作步骤。

例如：

~~~sql
SELECT d.id, d.title, u.name
FROM document d
JOIN app_user u ON u.id = d.owner_id
WHERE d.tenant_id = 10
  AND d.status = 'PUBLISHED'
ORDER BY d.created_at DESC
LIMIT 20;
~~~

数据库需要决定：

1. 先访问 document 还是 app_user？
2. document 用全表扫描还是索引扫描？
3. owner_id 的关联采用哪种 JOIN 算法？
4. 是否需要额外排序？
5. 能不能利用索引顺序提前得到前 20 条？

这些选择组合起来就是执行计划。

### 2.2 执行计划是一棵树，要从下往上读

PostgreSQL 计划通常以树形节点展示；MySQL 8.4 的 EXPLAIN ANALYZE 也会使用 TREE 形式展示迭代器。

理解方法：

- 叶子节点：从表、索引或其他数据源取得原始记录；
- 中间节点：对记录过滤、JOIN、排序、聚合；
- 根节点：形成最终结果并返回。

读计划时不要只盯着最上面一行。应该先看数据从哪里来，再看中间做了多少处理，最后看结果如何形成。

### 2.3 EXPLAIN 与 EXPLAIN ANALYZE 有什么区别？

MySQL：

~~~sql
EXPLAIN FORMAT=TREE
SELECT ...;
~~~

~~~sql
EXPLAIN ANALYZE
SELECT ...;
~~~

PostgreSQL：

~~~sql
EXPLAIN
SELECT ...;
~~~

~~~sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ...;
~~~

区别：

| 命令 | 能看到什么 | 不能证明什么 |
|---|---|---|
| EXPLAIN | 优化器估算的计划、访问路径和成本 | 不能证明真实执行耗时和实际行数 |
| EXPLAIN ANALYZE | 真实执行后的节点耗时、实际行数、循环次数等 | 不能保证这次测量代表所有参数和并发环境 |
| PostgreSQL BUFFERS | 计划节点访问共享缓存、读取和临时块的情况 | shared read 不等于一定发生了物理磁盘读取，操作系统缓存仍可能命中 |

**安全边界：** EXPLAIN ANALYZE 会真实执行 SQL。SELECT 也可能消耗大量 CPU、I/O 和锁资源；UPDATE/DELETE 等语句会产生实际副作用。不要在生产环境随意执行未经评估的分析语句。PostgreSQL 对写操作可以使用事务回滚方式隔离部分数据修改，但仍需考虑序列、外部副作用和资源消耗；MySQL 也应遵守相应版本的执行限制和生产变更流程。

### 2.4 执行计划里最重要的不是“有没有 Index”，而是这些数字

以 PostgreSQL 计划节点为例：

~~~text
Index Scan using idx_document_tenant_status
  (cost=0.42..120.00 rows=100 width=80)
  (actual time=0.030..25.000 rows=50000 loops=1)
~~~

这是示意数据，不是实际项目输出。

| 字段 | 含义 | 应该如何理解 |
|---|---|---|
| cost | 优化器估算成本 | 是成本模型单位，不是毫秒 |
| rows | 估算输出行数 | 优化器认为该节点会返回多少行 |
| width | 估算每行平均字节宽度 | 会影响排序、Hash、传输等成本估算 |
| actual time | 实际节点执行时间 | 观察真实耗时；不同节点统计有包含关系，不要简单相加 |
| actual rows | 实际输出行数 | 与估算 rows 对比，判断估算是否偏离 |
| loops | 节点被执行的次数 | 循环节点要结合每次行数看总工作量 |

上面的计划估算 100 行，实际返回 50,000 行，说明优化器对该节点的数据量判断严重偏小。后续 JOIN、排序和聚合可能因此选错方案。

PostgreSQL 中，actual rows 是每次循环平均返回的行数；若 loops=1000，该节点总输出量级约为 actual rows × loops。不能只看一轮的 rows。

MySQL 8.4 的 TREE 计划也会显示估算 rows、实际 rows、loops 和迭代器耗时；要结合父子节点与循环次数判断真正工作量。

### 2.5 为什么不能看到全表扫描就立即加索引？

假设一张表只有 500 行，查询需要其中 300 行：

- 全表扫描只需要顺序读取少量数据页；
- 使用索引可能要先访问索引页，再访问大量分散的数据行；
- 索引查找的随机访问和回表成本可能高于扫描整张小表。

因此，优化器选择全表扫描可能是合理的。

另一个例子：表有 1,000 万行，查询需要其中 20 行。全表扫描就可能非常浪费，合适索引通常更有价值。

判断访问路径是否合理，必须同时看：

1. 表有多少行；
2. 查询条件能过滤掉多少行；
3. 最终返回多少行；
4. 是否需要回表；
5. 数据页访问是连续还是分散；
6. 结果是否还需要排序或 JOIN；
7. 实际执行计划和资源消耗。

**全表扫描不是错误，低效的总工作量才是问题。**

## 3. 第三步：从执行计划找到真正的成本来源

### 3.1 扫描行数远大于返回行数：过滤发生得太晚

假设一张表有 1,000 万行：

~~~sql
SELECT id, title
FROM document
WHERE tenant_id = 100
  AND status = 'PUBLISHED';
~~~

执行时：

- 扫描 1,000 万行；
- 过滤后只剩 200 行；
- 返回 200 行。

问题不在结果数量，而在数据库为了找到这 200 行做了太多工作。

先确认：

- tenant_id 和 status 是否有合适的索引；
- 两个条件的选择性；
- 是否存在联合索引；
- 优化器估算行数是否合理；
- SQL 是否在索引列上进行了函数或类型转换。

### 3.2 走了索引，为什么仍然很慢？——回表成本

以 MySQL InnoDB 为例：

- 主键索引的叶子节点保存整行数据；
- 二级索引叶子节点保存索引列及对应主键值；
- 如果查询列不在二级索引中，数据库通常还需要根据主键再访问聚簇索引，取得完整行数据，这就是常说的回表。

例如：

~~~sql
CREATE INDEX idx_document_status
ON document(status);

SELECT id, title, content, created_at
FROM document
WHERE status = 'PUBLISHED';
~~~

如果符合条件的记录很多，数据库可能先通过二级索引找到大量主键，再逐条访问聚簇索引读取 title、content、created_at。

即使执行计划显示使用了索引，也不代表访问成本低。

优化方向：

- 先判断条件是否足够有选择性；
- 如果只需要少量字段，避免 SELECT *；
- 对高频且稳定的查询，评估覆盖索引；
- 不要把大字段、低频字段盲目塞进宽索引；
- 如果查询需要返回大量记录，评估顺序扫描是否更划算。

PostgreSQL 的普通二级索引与 InnoDB 不同：索引与 Heap 表分开存储，普通 Index Scan 通常需要访问 Heap 获取行数据；Index Only Scan 能否真正减少 Heap 访问，还受 Visibility Map 和页面可见性状态影响。

因此，“覆盖索引”的物理实现不能在 MySQL 与 PostgreSQL 之间直接画等号。

### 3.3 为什么索引列上套函数容易变慢？

例如：

~~~sql
SELECT *
FROM document
WHERE DATE(created_at) = '2026-11-24';
~~~

如果有普通索引：

~~~sql
CREATE INDEX idx_document_created_at
ON document(created_at);
~~~

查询对 created_at 做了 DATE() 运算。数据库不一定能直接把普通索引中的原始时间值转换成目标日期范围来定位。

可以改写为半开区间：

~~~sql
SELECT *
FROM document
WHERE created_at >= '2026-11-24 00:00:00'
  AND created_at <  '2026-11-25 00:00:00';
~~~

这样可以直接对原始列做范围查找。

其他常见情况：

~~~sql
-- 对索引列进行计算
WHERE amount + 10 > 100

-- 前置通配符
WHERE name LIKE '%hardy'

-- 隐式类型转换
WHERE numeric_code = '10001'

-- 对时间列做函数
WHERE YEAR(created_at) = 2026
~~~

注意：

- 函数或表达式并不意味着绝对无法使用索引；表达式索引、生成列索引等设计可能适用；
- 隐式转换是否影响索引取决于数据库、数据类型和转换发生的位置；
- LIKE '%abc' 对普通 B-tree 前缀查找不友好，但全文检索、Trigram 等索引可能适合其他搜索需求。

不要机械地“删掉所有函数”，而是先确认执行计划，再选择普通索引、表达式索引、生成列或其他索引类型。

### 3.4 类型不匹配为什么要特别检查？

例如：

~~~sql
-- 表字段是 BIGINT
WHERE document_no = '10001'
~~~

应用可能把数字编号作为 String 传给 JDBC/MyBatis。

这可能触发数据库类型转换，也可能改变比较语义或索引可用性。不同数据库的转换规则不同，不能简单断言所有类型不匹配都会让索引失效。

正确排查顺序：

1. 查表字段真实类型；
2. 查 Java 实体属性类型；
3. 查 MyBatis 参数类型和 JDBC 实际绑定类型；
4. 查最终 SQL；
5. 查看 EXPLAIN 中的访问条件和过滤条件；
6. 对比参数类型修正前后的计划与耗时。

**只有执行计划或实际数据能够证明转换影响了访问路径，才能把它定为根因。**

## 4. 索引设计：不是给每个 WHERE 字段单独建索引

### 4.1 先从查询模式设计索引

假设后台列表经常执行：

~~~sql
SELECT id, title, status, created_at
FROM document
WHERE tenant_id = ?
  AND status = ?
  AND created_at >= ?
  AND created_at < ?
ORDER BY created_at DESC, id DESC
LIMIT 20;
~~~

这个查询有四个关键要求：

1. tenant_id 等值过滤；
2. status 等值过滤；
3. created_at 时间范围；
4. 按 created_at、id 倒序取前 20 条。

可以评估这样的联合索引：

~~~sql
CREATE INDEX idx_doc_tenant_status_created_id
ON document(tenant_id, status, created_at, id);
~~~

它的设计逻辑：

- 前两列用于等值定位；
- created_at 用于范围扫描；
- id 作为稳定排序的辅助列；
- 如果索引顺序能够满足 ORDER BY，可能避免额外排序；
- LIMIT 20 使数据库有机会在找到前 20 条合格记录后停止继续扫描。

是否最终采用，仍要用真实数据和执行计划验证。

### 4.2 联合索引的字段顺序为什么重要？

假设索引是：

~~~sql
(tenant_id, status, created_at)
~~~

MySQL B-tree 联合索引按字段顺序组织键值，通常能利用从最左侧开始的连续前缀。

可以理解为先按 tenant_id 排序，在相同 tenant_id 内按 status 排序，再在相同 tenant_id 和 status 内按 created_at 排序。

因此：

~~~sql
WHERE tenant_id = ?
~~~

~~~sql
WHERE tenant_id = ? AND status = ?
~~~

~~~sql
WHERE tenant_id = ? AND status = ? AND created_at >= ?
~~~

通常可以利用相应前缀。

但：

~~~sql
WHERE status = ?
~~~

不符合这个索引的最左前缀查找条件，通常不能直接按 status 定位一个连续的索引范围。

PostgreSQL B-tree 的多列索引也应考虑前导列约束，但其优化器和具体版本可能存在 Skip Scan 等能力，不能将 MySQL 的最左前缀规则不加区分地套用到 PostgreSQL。

### 4.3 联合索引字段顺序不能只背“高选择性字段放最前”

设计索引时要同时考虑：

- 查询中是否总会出现该字段；
- 等值条件还是范围条件；
- 是否需要按某字段排序；
- 是否存在多个不同查询模式；
- 字段选择性和数据分布；
- 是否能覆盖查询；
- 索引长度和写入维护成本。

例如多租户业务，tenant_id 虽然可能不是全表最具选择性的字段，但几乎所有列表查询都带 tenant_id，那么它放在前面可能更符合整体访问模式。

**联合索引的顺序是查询工作负载设计，不是背一个字段选择性排序公式。**

### 4.4 等值条件、范围条件和排序如何组合？

常见设计思路：

~~~text
等值过滤列 → 范围/排序列 → 必要的稳定排序列
~~~

原因：

- 等值条件先把查找范围缩小到某个前缀；
- 范围列确定扫描区间；
- 后续列可能帮助排序或提供覆盖信息；
- 一旦前面的某列进入范围扫描，后续列对查找范围的进一步缩小能力通常受到限制，但仍可能用于索引条件过滤或排序。

具体能否同时满足 WHERE 与 ORDER BY，要看索引方向、列顺序、条件形式、数据库实现和执行计划。

### 4.5 覆盖索引：为什么有时值得，有时不值得？

如果查询只读取：

~~~sql
SELECT id, status, created_at
FROM document
WHERE tenant_id = ?
  AND status = ?;
~~~

索引可能已经包含查询需要的所有列，数据库有机会避免额外读取整行。

PostgreSQL 可以通过 INCLUDE 把非搜索键列放入索引：

~~~sql
CREATE INDEX idx_doc_tenant_status
ON document(tenant_id, status)
INCLUDE (created_at);
~~~

MySQL 没有与 PostgreSQL INCLUDE 完全相同的语法；要实现覆盖，需要让所需列能够从索引记录中取得。

但不要为了覆盖所有查询建立一个包含十几个字段的超宽索引：

- 索引占用更多存储；
- 写入时维护成本更高；
- 缓存中可容纳的索引页减少；
- 大字段会明显放大索引体积；
- 可能出现多个重叠索引，增加优化器选择成本。

覆盖索引应服务于高频、稳定、价值明确的查询，而不是无差别堆字段。

### 4.6 索引越多越好吗？

不是。

每增加一个索引：

- INSERT 需要维护新索引；
- UPDATE 修改索引列时需要更新索引；
- DELETE 需要维护索引；
- 索引占用磁盘与缓存；
- 优化器要在更多候选访问路径中评估。

因此索引优化不是“索引数量最大化”，而是以真实查询工作负载为依据，保留收益明确的索引，合并重复或高度重叠的索引，并评估写入成本。

## 5. JOIN 优化：为什么多表查询可能突然变慢？

### 5.1 JOIN 的成本从哪里来？

假设：

- document 有 100 万条；
- app_user 有 10 万条；
- 每条 document 关联一个 owner。

~~~sql
SELECT d.id, d.title, u.name
FROM document d
JOIN app_user u ON u.id = d.owner_id
WHERE d.tenant_id = ?;
~~~

数据库要先确定：

- 哪张表先过滤；
- 每一步产生多少行；
- 用什么算法关联；
- 关联列是否存在合适索引；
- 关联结果会不会急剧膨胀。

如果过滤后 document 只剩 20 条，逐条通过 app_user 主键查找可能很高效。

如果过滤后 document 有 80 万条，逐条随机查找另一张表可能代价很高，Hash Join 或其他策略可能更合适。

### 5.2 三种常见 JOIN 算法

**Nested Loop Join（嵌套循环）**

~~~text
遍历外表每一行
    ↓
根据关联条件查找内表匹配记录
    ↓
组合结果
~~~

适合外侧结果集较小、内侧查找有高效索引的场景。

如果外侧实际返回 100 万行，内侧节点被循环执行 100 万次，就可能很贵。看计划时必须关注 loops。

**Hash Join（哈希连接）**

~~~text
扫描一侧数据，建立 Hash Table
    ↓
扫描另一侧数据
    ↓
根据 Join Key 查找 Hash Table
    ↓
输出匹配结果
~~~

适合较大数据集的等值连接。需要关注：

- 哪一侧作为 Hash Build；
- Hash Table 大小；
- 实际输入行数；
- 是否发生内存不足、分批或磁盘溢写；
- Join 后的结果是否大幅膨胀。

**Merge Join（归并连接）**

~~~text
两侧数据按 Join Key 排序
    ↓
同时向前扫描
    ↓
比较键值并组合匹配行
~~~

当输入已经有序或排序成本可接受时，可能很高效。若为了 Merge Join 先对大量数据排序，排序成本也要计入整体计划。

三种算法没有绝对的优劣。要看输入规模、索引、数据分布、排序状态、内存和实际计划。

### 5.3 JOIN 为什么会产生远超预期的结果？

如果一条 document 对应多个 attachment：

~~~sql
SELECT d.id, a.file_name
FROM document d
JOIN attachment a ON a.document_id = d.id;
~~~

一条 document 可能扩展成多条结果。

如果又关联多个一对多表，行数可能进一步乘大，造成：

- 大量中间结果；
- 排序和聚合成本增加；
- 返回数据量膨胀；
- 重复行或业务语义错误。

优化之前先确认关系基数：一对一、一对多、多对多。

如果业务只需要判断“是否存在附件”，可能用 EXISTS 更贴近需求：

~~~sql
SELECT d.id, d.title
FROM document d
WHERE EXISTS (
    SELECT 1
    FROM attachment a
    WHERE a.document_id = d.id
);
~~~

但不要机械地把 JOIN 全部改成 EXISTS。要先确认是否需要关联表字段、是否需要返回多条匹配记录，以及优化器最终采用的执行计划。

### 5.4 JOIN 列的类型为什么要一致？

关联列如果类型、长度、字符集或排序规则不一致，可能引入转换或影响索引匹配。

应检查：

- 两侧关联字段类型是否一致；
- 字符集和 collation 是否兼容；
- 两侧字段是否有合适索引；
- 是否存在函数包裹或隐式转换；
- 连接后实际行数是否符合业务基数。

不能简单地要求 JOIN 两侧都必须建立索引：Hash Join 等方案可能不依赖内侧索引。索引是否有价值要结合执行计划判断。

## 6. ORDER BY、GROUP BY 和临时结果为什么会成为瓶颈？

### 6.1 ORDER BY 不一定需要额外排序

例如：

~~~sql
SELECT id, title, created_at
FROM document
WHERE tenant_id = ?
ORDER BY created_at DESC, id DESC
LIMIT 20;
~~~

如果索引顺序与过滤和排序需求匹配，数据库可能沿索引顺序读取前 20 条，不需要对大量结果额外排序。

如果索引无法满足排序，数据库可能需要：

1. 找到符合 WHERE 的大量记录；
2. 对这些记录排序；
3. 再取前 20 条。

这时即使最终只返回 20 条，前面仍可能做了大量工作。

### 6.2 MySQL 的 Using filesort 不等于一定写磁盘

MySQL EXPLAIN 中的 Using filesort 表示需要额外排序操作，不应把它直接理解为“肯定使用磁盘文件”。

真正需要关注：

- 参与排序的行数；
- 排序字段和索引是否匹配；
- 排序是否能利用 LIMIT 提前停止；
- 是否发生磁盘临时文件或排序溢出；
- 排序前是否能先过滤更多数据。

### 6.3 GROUP BY / 聚合

例如：

~~~sql
SELECT status, COUNT(*)
FROM document
WHERE tenant_id = ?
GROUP BY status;
~~~

需要关注：

- WHERE 是否先缩小输入数据；
- 分组键是否有合适索引；
- 聚合算法和中间数据量；
- 是否使用临时表或 Hash Aggregate；
- 内存不足是否导致临时数据落盘；
- 是否真的需要对所有历史数据实时 COUNT。

如果业务只是展示统计数字，可以评估汇总表、缓存或异步统计，但必须考虑数据新鲜度和一致性，不能为了速度直接牺牲业务准确性。

## 7. 分页优化：为什么越往后翻越慢？

### 7.1 OFFSET 分页的成本

~~~sql
SELECT id, title, created_at
FROM document
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 100000;
~~~

即使最终只返回 20 条，数据库也可能需要先定位、扫描并跳过前面约 100,000 条记录，再返回后面的数据。

页码越深，跳过的记录越多，成本通常随之增长。

### 7.2 Keyset Pagination（游标/Seek 分页）

第一次查询：

~~~sql
SELECT id, title, created_at
FROM document
WHERE tenant_id = ?
ORDER BY created_at DESC, id DESC
LIMIT 20;
~~~

记录最后一条的 created_at 和 id。

下一页：

~~~sql
SELECT id, title, created_at
FROM document
WHERE tenant_id = ?
  AND (
      created_at < ?
      OR (created_at = ? AND id < ?)
  )
ORDER BY created_at DESC, id DESC
LIMIT 20;
~~~

对应索引可以评估：

~~~sql
CREATE INDEX idx_doc_tenant_created_id
ON document(tenant_id, created_at, id);
~~~

它不是先跳过前面 100,000 行，而是从上一页最后一条记录的位置继续向后读取。

必须注意：

- 排序必须稳定，通常增加唯一 ID 作为最后一个排序键；
- 游标字段的 NULL 语义需要明确；
- 查询条件和索引顺序要匹配；
- 数据持续变化时，需要定义分页一致性语义；
- Keyset 分页不擅长直接跳到任意页码，也不天然提供总页数。

## 8. 优化器为什么会选错计划？

### 8.1 优化器依赖统计信息估算

优化器需要估算：

- 表有多少行；
- 某个条件大约过滤多少行；
- 某个索引的基数；
- JOIN 后可能产生多少行；
- 排序、Hash 和数据读取需要多少成本。

如果估算偏差很大，可能选错访问路径或 JOIN 顺序。

### 8.2 统计信息为什么会不准确？

假设一个 status 字段有 100 万条数据：

- PUBLISHED：99 万条；
- DELETED：1 万条。

如果优化器不知道真实分布，可能错误估算 status = 'DELETED' 或 status = 'PUBLISHED' 的返回行数。

还有一种情况：

~~~sql
WHERE tenant_id = ?
  AND status = ?
~~~

tenant_id 和 status 并非独立分布。例如某个租户几乎全部是 PUBLISHED。优化器如果简单假设两个字段独立，可能低估或高估组合条件的选择性。

### 8.3 MySQL 如何更新统计信息？

~~~sql
ANALYZE TABLE document;
~~~

MySQL 8.4 还支持直方图：

~~~sql
ANALYZE TABLE document
UPDATE HISTOGRAM ON status WITH 100 BUCKETS;
~~~

直方图用于帮助优化器理解列值分布，尤其是没有合适索引时的过滤率估算。它不等于创建索引，也不能保证查询计划一定改善。

更新统计信息后必须重新检查 EXPLAIN 和实际执行表现。

### 8.4 PostgreSQL 如何更新统计信息？

~~~sql
ANALYZE document;
~~~

PostgreSQL 的 ANALYZE 收集列统计信息，供规划器估算选择性和行数。对于多列之间存在相关性的场景，可以评估扩展统计信息：

~~~sql
CREATE STATISTICS st_document_tenant_status
    (dependencies, mcv)
ON tenant_id, status
FROM document;

ANALYZE document;
~~~

扩展统计信息能帮助规划器理解部分列间相关性，但不是任意复杂条件都能精确估算。

### 8.5 为什么不要一上来 FORCE INDEX？

强制索引会把优化器的选择空间缩小。

如果当前数据分布、参数值或表规模发生变化，原来强制的索引可能不再合适。

正确顺序：

1. 确认统计信息；
2. 查看估算与实际行数；
3. 分析成本模型为何选择当前计划；
4. 验证索引设计和查询条件；
5. 在有充分证据、可回滚和持续监控的前提下，才考虑 Hint 或索引强制策略。

Hint 是最后的控制手段，不是替代分析的快捷键。

## 9. 常见 SQL 结构问题：需要知道原因，不是背口诀

### 9.1 SELECT * 为什么可能有问题？

- 读取了业务不需要的列；
- 增加数据页读取和网络传输；
- 增加 JDBC 对象映射成本；
- 让覆盖索引更难成立；
- 大字段可能显著放大结果集。

但如果业务确实需要完整记录，SELECT * 并不必然慢。重点是减少无意义的数据读取。

### 9.2 IN、EXISTS、JOIN 谁更快？

没有固定答案。

优化器可能对 IN、EXISTS 和部分子查询进行半连接等转换。要根据子查询返回规模、重复值、NULL 语义、关联列索引、最终需要哪些列和实际执行计划判断。

不能把“IN 一定慢”“EXISTS 一定快”写成规则。

### 9.3 OR 为什么有时会影响索引？

例如：

~~~sql
WHERE owner_id = ?
   OR creator_id = ?
~~~

两个条件可能需要不同索引。数据库可能选择 Index Merge、BitmapOr 或其他访问方式，也可能认为扫描表更便宜。

可评估：

- 是否有合适的单列索引；
- 是否适合拆成 UNION / UNION ALL；
- 拆分后是否会产生重复记录；
- 是否改变排序、LIMIT 和去重语义。

改写前先确认语义等价，不能为了使用索引而改变业务结果。

### 9.4 N+1 查询为什么会慢？

例如先查询 100 条 document，再在循环中为每条 document 查询 owner：

~~~text
1 次查询 document
+ 100 次查询 owner
= 101 次数据库往返
~~~

即使每条 SQL 只需要 2 毫秒，往返、连接占用、结果映射和调度成本也会累积。

可以评估 JOIN、批量 IN 查询或一次性预加载，但要注意 IN 列表大小、返回数据量、一对多关系导致的行膨胀、分页语义和 ORM 映射行为。

### 9.5 分区能不能解决慢查询？

分区主要帮助管理大表、按分区裁剪数据，以及某些维护和生命周期操作。

如果查询条件不能触发 Partition Pruning，或者查询仍需访问大部分分区，分区未必能加速查询。

分区不是索引的替代品，也不是所有大表的默认答案。

## 10. 一套可执行的慢 SQL 优化流程

### 阶段 A：确定问题范围

- [ ] 记录接口、SQL 模板、数据库实例和发生时间；
- [ ] 获取真实参数，注意脱敏；
- [ ] 明确是单次慢还是高频累积；
- [ ] 获取 P50/P95/P99、调用次数和错误率；
- [ ] 区分连接池等待、锁等待、SQL 执行和结果传输；
- [ ] 确认是否只在特定参数或特定租户下变慢。

### 阶段 B：收集基线

- [ ] 数据库版本、存储引擎和关键配置；
- [ ] 表结构、行数、数据分布；
- [ ] 索引定义和索引基数；
- [ ] 原始 SQL 与绑定参数类型；
- [ ] EXPLAIN 计划；
- [ ] 安全环境下的 EXPLAIN ANALYZE；
- [ ] CPU、I/O、Buffer、临时文件、锁等待等指标；
- [ ] 当前 SQL 的耗时和扫描行数。

基线必须保存，否则优化前后无法客观比较。

### 阶段 C：找到最贵的节点

按执行计划从叶子向上检查：

1. 最底层扫描读了多少行？
2. 过滤后剩余多少行？
3. 是否有大量回表？
4. JOIN 的输入行数和输出行数是否异常？
5. Nested Loop 的 loops 是否过大？
6. Sort / Hash 是否处理了过多数据？
7. 是否出现临时结果落盘？
8. 估算行数与实际行数是否严重偏离？
9. 最终返回数据是否过大？

不要把计划里第一个出现的 Index Scan 当成问题，也不要只看根节点总成本。

### 阶段 D：提出一个可验证的根因假设

例如：

- 假设 1：过滤条件缺少合适的联合索引，扫描行数过多；
- 假设 2：使用索引后回表次数过多，应该评估覆盖索引；
- 假设 3：统计信息过期导致估算错误；
- 假设 4：JOIN 外侧实际行数远超估算，Nested Loop 被放大；
- 假设 5：深分页导致跳过大量记录；
- 假设 6：接口慢的真正原因是连接池等待，而不是 SQL。

每次优先验证一个假设，避免同时修改 SQL、索引和数据库参数，导致无法判断哪个改动有效。

### 阶段 E：实施并对照验证

在相同或等价的数据集、参数、数据库配置和并发条件下，对比：

| 指标 | 优化前 | 优化后 |
|---|---:|---:|
| 执行计划 | 记录 | 记录 |
| 估算行数 / 实际行数 | 记录 | 记录 |
| 实际扫描与返回行数 | 记录 | 记录 |
| P50 / P95 / P99 | 记录 | 记录 |
| CPU / Buffer / I/O | 记录 | 记录 |
| 临时文件 / 排序 | 记录 | 记录 |
| 结果正确性 | 验证 | 验证 |
| INSERT / UPDATE 成本 | 记录 | 评估 |

注意：

- 热缓存与冷缓存结果不能直接混为一谈；
- 单次 EXPLAIN ANALYZE 不能代表并发生产负载；
- 新索引可能让 SELECT 变快，却让写入变慢；
- 统计信息、参数分布和数据库版本变化可能改变执行计划；
- 必须在灰度或可回滚流程中观察真实负载。

### 阶段 F：上线后持续观察

- 慢 SQL 是否真正下降；
- 高峰期 P95/P99 是否改善；
- 数据库 CPU、I/O 和连接数是否改善；
- 是否出现新的锁等待或写入瓶颈；
- 是否有其他查询因为新增索引而受影响；
- 是否需要保留或回滚变更。

**优化的终点不是 EXPLAIN 里出现了某个索引，而是业务指标和数据库资源消耗得到可验证的改善，且没有引入不可接受的副作用。**

## 11. MySQL 与 PostgreSQL 查询优化的差异，必须分开理解

| 主题 | MySQL 8.4 / InnoDB | PostgreSQL |
|---|---|---|
| 执行计划 | EXPLAIN，支持 TREE / JSON 等格式；EXPLAIN ANALYZE 展示迭代器实际执行 | EXPLAIN 展示计划树；EXPLAIN ANALYZE 可结合 BUFFERS 等选项 |
| 二级索引访问 | InnoDB 二级索引叶子保存主键值，必要时回聚簇索引取整行 | 普通索引与 Heap 分离，Index Scan 通常还需访问 Heap |
| 覆盖查询 | 通过索引包含所需列形成覆盖访问 | Index Only Scan，仍受 Visibility Map 和行可见性影响 |
| 多列统计 | 索引统计、直方图等 | 单列统计与 CREATE STATISTICS 扩展统计 |
| 排序 | 可利用索引满足 ORDER BY；否则可能 filesort | 可利用索引顺序；否则 Sort 节点 |
| 监控入口 | Slow Query Log、Performance Schema、sys schema | pg_stat_statements、pg_stat_activity、日志与统计视图 |
| 多列索引 | B-tree 左前缀是重要规则 | 需理解 B-tree 前导列规则与版本支持的 Skip Scan 等优化 |

不要把某一个数据库的执行计划字段、索引实现和优化规则照搬到另一个数据库。

## 12. DMS 项目中的真实问题：Java String 与数据库数值字段

已知事实：项目中编号相关字段在数据库中为数值类型，Java 对象曾使用 String；调整为 Long 后，查询行为符合预期。

但这只能说明类型映射调整后问题消失，不能直接证明根因就是索引失效。

应按以下步骤还原：

### 12.1 收集证据

- [ ] 表结构和列类型；
- [ ] 相关字段的索引定义；
- [ ] Java 实体字段类型；
- [ ] Mapper 方法参数类型；
- [ ] MyBatis TypeHandler / JDBC 实际绑定类型；
- [ ] 最终 SQL 和脱敏参数；
- [ ] 修改前后的 EXPLAIN；
- [ ] 修改前后的实际耗时和扫描行数。

### 12.2 比较执行计划

重点对照：

- 是否选择了同一个索引；
- 是否出现类型转换表达式；
- 索引条件（Index Condition）与过滤条件（Filter）有何变化；
- 估算行数是否变化；
- 实际扫描行数是否变化；
- 是否减少回表；
- 是否只是应用参数处理变化，而数据库执行计划并未变化。

### 12.3 最终结论必须分级

- **已证实根因**：有修改前后 SQL、参数类型、计划和实测证据。
- **高度可能**：类型映射与问题相关，但缺少完整执行计划或实测。
- **尚未证实**：只知道改成 Long 后表现正常。

项目复盘必须使用对应等级，不要把推测写成已证实的性能根因。

## 13. P0 必须掌握的查询优化能力

不是要求背所有优化器内部算法，而是必须能完成以下工作：

1. 区分接口慢、SQL 慢、锁等待、连接池等待和结果传输；
2. 从监控中找到高频、高总耗时或高 P95 的 SQL；
3. 能看懂 EXPLAIN / EXPLAIN ANALYZE 的计划树；
4. 能比较估算行数和实际行数；
5. 理解全表扫描、索引扫描、回表和覆盖索引；
6. 能根据真实查询模式设计联合索引，而不是盲目单列建索引；
7. 能分析 Nested Loop、Hash Join、Merge Join；
8. 能分析排序、聚合、分页和 N+1；
9. 能识别统计信息偏差和参数分布影响；
10. 能通过前后对照验证优化收益与写入副作用。

P1 重点理解：

- MySQL Optimizer Trace、Index Condition Pushdown、直方图；
- PostgreSQL Extended Statistics、Bitmap Scan、Visibility Map；
- 参数敏感计划、内存溢写、分区裁剪；
- 慢查询聚合、持续性能回归和容量分析。

## 14. 实操训练：必须自己跑出证据

仅阅读文档不算掌握。建议使用本地测试数据库，构造 100 万级或更大数据量（按本机资源调整），并保证数据分布具有代表性。

### 实验 1：全表扫描与索引扫描

- 创建 document 测试表；
- 准备高选择性和低选择性字段；
- 分别执行等值查询和范围查询；
- 对比无索引、有索引时的 EXPLAIN ANALYZE；
- 解释为什么某些条件下优化器仍然选择全表扫描。

### 实验 2：单列索引与联合索引

- 创建 tenant_id、status、created_at 字段；
- 对比单列索引和 (tenant_id, status, created_at, id)；
- 分别测试等值、范围、排序和组合条件；
- 改变字段顺序，观察计划变化；
- 说明哪些查询可以利用索引前缀。

### 实验 3：回表与覆盖索引

- 先查询索引外的大字段；
- 再只查询索引包含的列；
- MySQL 对比回表访问和覆盖访问；
- PostgreSQL 对比 Index Scan 与 Index Only Scan；
- 观察 PostgreSQL Visibility Map 对 Index Only Scan 的影响。

### 实验 4：JOIN 算法与行数膨胀

- 建立 document 和 attachment 两张表；
- 设计一对一和一对多数据；
- 分别执行 JOIN 和 EXISTS；
- 观察 Join 节点、输入输出行数、loops；
- 制造不合理数据分布，观察计划估算偏差。

### 实验 5：深分页与 Keyset 分页

- 使用 OFFSET 查询第 1 页、第 1000 页和更深页面；
- 使用 Keyset 方式查询同样位置附近的数据；
- 对比扫描量和耗时；
- 验证相同排序键值时是否可能漏数据或重复数据。

### 实验 6：统计信息导致的计划变化

- 构造倾斜分布的数据；
- 观察优化器估算行数；
- 更新统计信息或创建扩展统计信息；
- 对比执行计划；
- 解释为什么统计信息改善不等于所有查询都会变快。

### 实验 7：完整慢 SQL 优化案例

选择一条真实或模拟慢 SQL，提交一份小型优化记录：

~~~text
1. 问题现象和业务影响
2. SQL 模板与脱敏参数
3. 表结构、索引和数据规模
4. 优化前执行计划
5. 主要成本节点和根因证据
6. 优化假设
7. SQL / 索引改动
8. 优化后执行计划
9. 优化前后指标对照
10. 写入成本与其他副作用
11. 最终结论和未验证风险
~~~

达标标准：不是“加了索引，查询快了”，而是能说明原计划做了什么、为什么成本高、改动改变了什么，以及如何证明它更好。

## 15. 官方资料与查阅顺序

按“先会读计划，再理解访问路径，再研究优化器”的顺序阅读：

### 第一组：先掌握执行计划

- [MySQL 8.4：Understanding the Query Execution Plan](https://dev.mysql.com/doc/refman/8.4/en/execution-plan-information.html)
- [MySQL 8.4：EXPLAIN Statement / EXPLAIN ANALYZE](https://dev.mysql.com/doc/refman/8.4/en/explain.html)
- [PostgreSQL：Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [PostgreSQL：EXPLAIN Command](https://www.postgresql.org/docs/current/sql-explain.html)

### 第二组：理解索引和 SQL 访问路径

- [MySQL 8.4：How MySQL Uses Indexes](https://dev.mysql.com/doc/refman/8.4/en/mysql-indexes.html)
- [MySQL 8.4：Multiple-Column Indexes](https://dev.mysql.com/doc/refman/8.4/en/multiple-column-indexes.html)
- [MySQL 8.4：ORDER BY Optimization](https://dev.mysql.com/doc/refman/8.4/en/order-by-optimization.html)
- [MySQL 8.4：Index Condition Pushdown](https://dev.mysql.com/doc/refman/8.4/en/index-condition-pushdown-optimization.html)
- [PostgreSQL：Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL：Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
- [PostgreSQL：Index-Only Scans and Covering Indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)

### 第三组：理解统计信息和性能监控

- [MySQL 8.4：ANALYZE TABLE](https://dev.mysql.com/doc/refman/8.4/en/analyze-table.html)
- [MySQL 8.4：Optimizer Statistics](https://dev.mysql.com/doc/refman/8.4/en/optimizer-statistics.html)
- [MySQL 8.4：Slow Query Log](https://dev.mysql.com/doc/refman/8.4/en/slow-query-log.html)
- [MySQL 8.4：Performance Schema Statement Digests](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-statement-digests.html)
- [PostgreSQL：Planner Statistics](https://www.postgresql.org/docs/current/planner-stats.html)
- [PostgreSQL：ANALYZE](https://www.postgresql.org/docs/current/sql-analyze.html)
- [PostgreSQL：pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)

> 本文依据上述官方文档整理。具体命令、计划字段和优化器行为以实际部署版本为准；项目数据库类型和版本尚未核实。

## 16. 更新记录

- 2026-11-24：将原数据库总览中的“SQL 为什么变慢”扩展为独立查询优化专题。新增端到端耗时拆分、SQL 聚合定位、执行计划深读、扫描与回表、联合索引设计、JOIN 算法、排序与分页、统计信息、MySQL/PostgreSQL 差异、DMS 类型映射证据链和实操验收。原因：原章节只有现象罗列，无法支持真实 SQL 诊断和优化。
