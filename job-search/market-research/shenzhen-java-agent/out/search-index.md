# 深圳 Java 后端与 AI Agent 岗位：搜索索引

> 采集日期：2026-11-26 至 2026-11-27  
> 数据源：Boss 直聘搜索切片，经本机 OpenCLI 读取。  
> 状态：列表索引按职位 ID 幂等去重，并应用完整薪资/经验区间过滤；职位要求统计见 [`requirements-summary.md`](./requirements-summary.md)。

- 搜索结果行：3570 条；范围内 728 条，去重后 81 个职位、68 个列表公司名。
- 筛选：月薪完整区间 20–40K，经验区间上限不超过 5 年。
- 已读取页码：1、2、3、4、5、6、7、8、9、10、11、12、13、14、15、16、17、18、19、20；分页状态：未穷尽，0 个筛选组合触及页数上限。
- 薪资/经验符合条件：81 个职位；已获得详情文本 63 个，另有 18 个待核实。
- 职位列表见 [`positions-index.csv`](./positions-index.csv)；详情全文和公司页面字段见 [`job-details.csv`](./job-details.csv)；公司汇总见 [`companies-index.csv`](./companies-index.csv)。
- 原始 JSONL 与来源记录见 [`raw/`](../raw/)。

本文件用于兼容旧索引入口；完整覆盖、统计口径和限制以 [`requirements-summary.md`](./requirements-summary.md) 为准。
