# 02｜DeepSeek Harness 的运行架构与组合机制

> 更新日期：2026-11-24｜归属：DeepSeek Harness 专题｜关联任务：从 Harness 原理到 Agent 开发与业务系统集成

> 前置：阅读 [01｜产品定位与基本概念](./01-positioning-and-concepts.md)。  
> 本篇只解释 Harness 内部如何组成和运行，不展开插件代码细节。

## 1. “一切皆插件”究竟是什么意思？

DeepSeek Harness 的官方架构文档明确指出，产品的主要能力都由插件提供，包括：

- 模型适配器；
- 工具注册表；
- Session / 会话日志；
- Agent Loop；
- Skills；
- Sandbox；
- Storage；
- Schedule；
- UI。

这些插件通过 Cordis 的 Service 和 Event 协作。某项能力可以在配置层被选择、替换或扩展。

这意味着 Harness 不把某个具体 Agent Loop、模型适配器或工具集合写死在一个不可替换的核心里。

但要注意两个边界：

1. Cordis 是插件运行框架，不是 Agent 本身。
2. “一切皆插件”指 Harness 内部能力的组织方式，不要求企业已有的 Java、数据库或业务平台都改造成 Cordis Plugin。

## 2. 从启动配置到运行时插件树

可以把一次 Harness 启动理解为：读取一个 Profile，按顺序合并多个配置层，最终得到一棵需要挂载的插件树。

~~~text
dsh 启动命令
    ↓
选择 Profile
    ↓
按顺序合并配置层
    ├── Profile 选择的 Bundle
    ├── Profile 自己的 cordis.patch.yml
    ├── Home 级 cordis.patch.yml
    └── 命令行 --patch overlay
    ↓
Loader 解析插件条目和依赖
    ↓
Cordis 挂载插件、等待依赖服务就绪
    ↓
形成当前运行时插件树
~~~

## 3. Profile、Bundle、Patch 分别是什么？

这三个概念不能混为一谈。

| 概念 | 作用 | 应该怎样理解 |
|---|---|---|
| Profile | 描述一套具名运行组合 | 当前以什么应用模式启动、由哪些组合包构成 |
| Bundle | 分发一组插件配置层及其代码 | 一份可安装、可组合的能力包 |
| Patch | 对插件配置条目进行插入或覆盖 | 在已有组合上增加或替换某些插件 |

### Profile

Profile 位于 Harness Home 下，是一套可启动的具名组合。官方随附的 Profile 包括：

- web
- headless
- sdk
- sdk-minimal
- acp

它们服务于不同的运行入口，不应把 Profile 误认为一个业务 Skill 或某个模型。

### Bundle

Bundle 是 Cordis 配置项及其挂载代码的分发格式。它通常由一个 npm 包提供，使用 package.json 中的 dsh.bundle 字段声明自己的 Patch 文件。

### Patch

Patch 通过条目 id 定位插件配置，可以插入新条目，也可以覆盖已有条目。需要特别注意：覆盖目标条目时，Patch 会替换该条目的整个 config 值，不是对各字段做任意深度合并。

## 4. 配置层的优先顺序

官方架构文档给出的顺序是：

1. Profile 中按顺序列出的 Bundle Patch；
2. Profile 自己的 cordis.patch.yml；
3. Home 级 cordis.patch.yml；
4. 命令行传入的 --patch overlay，按参数顺序应用。

后应用的配置层可以覆盖前面的条目。

这让用户可以在不修改第三方 Bundle 源码的情况下覆盖其配置，但也意味着编写 Patch 时必须理解目标条目的完整配置结构。

可以通过以下命令检查最终配置树，而不是凭印象猜测：

~~~bash
dsh --profile web --dump-config
~~~

实际命令和可用 Profile 应以当前安装版本的 CLI 文档为准。

## 5. 一次 Agent 任务在运行时发生什么？

简化后的运行链路如下：

~~~text
用户输入
  ↓
Session 接收并记录输入
  ↓
Agent Loop 组装模型请求
  ↓
LLM Adapter 请求 Model
  ↓
Model 返回文本或 Tool Call
  ↓
Tool 执行流水线
  ├── pre-execute：策略检查
  ├── execute：执行动作
  ├── post-execute：处理结果
  └── result：记录和观察结果
  ↓
结果进入 Session
  ↓
需要继续时进入下一 Step
  ↓
Agent 结束本次 Turn
~~~

这里有两个重要概念：

- **Step**：一次模型请求及其触发的工具调用。
- **Turn**：从接收一组任务输入到该轮工作结束，内部可以包含多个 Step。

Harness 的 Session 日志记录模型可见的输入、工具调用和结果，供会话展示、恢复和回放使用。具体事件名称与时序属于易变的实现细节，应以固定版本的架构文档为准。

## 6. 这套架构带来的实际价值

| 设计 | 解决的问题 |
|---|---|
| 插件化 | 能力可独立增加、替换和移除 |
| Service / Event | 插件之间通过契约协作，减少对具体实现的耦合 |
| Profile / Bundle | 一套能力组合可以被安装、复用和版本化 |
| Patch | 用户可以在不修改上游包的情况下覆盖配置 |
| Session 日志 | 任务过程可以检查、恢复和回放 |

它也有成本：插件依赖、配置覆盖、版本兼容和运行时生命周期都会增加学习和维护要求。不能因为“插件化”听起来灵活，就忽略组合复杂度。

## 7. 本篇应掌握的结论

- 运行中的 DSH 是由插件组成的运行时树。
- Profile 选择一套运行组合，Bundle 负责分发组合层，Patch 负责插入或覆盖配置。
- Cordis 管理插件加载、卸载和依赖，不负责模型推理或企业业务规则。
- 需要理解配置层顺序，才能正确开发和安装插件。
- 基础业务能力可以作为外部服务提供，不必全部塞进 Harness 内部。

## 8. 官方来源

- [DeepSeek Harness 架构文档（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/architecture.zh.md)
- [DeepSeek Harness CLI 参考（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/apps/cli/README.zh.md)

**下一篇：** [03｜Cordis 插件模型与生命周期](./03-cordis-plugin-model.md)。从概念层面解释插件、Context、Service、inject、Event 和 Effect。


## 更新记录

- 2026-11-24：按编号学习路径拆分原单文件，补充官方来源核查并明确技术边界。
