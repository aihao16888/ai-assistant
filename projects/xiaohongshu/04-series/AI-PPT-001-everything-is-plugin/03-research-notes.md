# 阶段 B｜Cordis Runtime 与 Loader 机制研究笔记

- 日期：2026-11-28
- 项目：[AI-PPT-001｜DeepSeek Harness：Everything is a Plugin](./brief.md)
- 研究地图：[阶段 A](./00-stage-a-research-map.md)
- 固定官方版本：deepseek-ai/deepseek-harness @ 4b399c39a6d1479cd84ca591b4d7c88e24d38a96
- 本阶段状态：**源码与测试静态审查完成；未执行本地运行实验**
- 执行边界：通过 GitHub 读取固定 Commit 的源码和测试；没有启动用户本机 Codex CLI，没有修改上游仓库，也没有声称运行过测试。

---

## 1. 先用通俗的话理解：插件是怎么工作的

可以把 DeepSeek Harness 想成一个由很多能力模块共同组成的工作环境。模型适配器负责把请求交给模型，工具插件负责向 Agent 提供工具，会话插件负责管理对话记录，Agent Loop 负责推动一次次模型调用和工具执行。它们不是直接写死在一个庞大的核心类里，而是以 Cordis 插件的形式进入同一个运行环境。

Cordis 负责管理这些插件：插件启动时拿到自己的 Context；如果需要别的能力，就通过 inject 声明依赖；提供能力的插件会把 Service 注册到 Context。依赖齐全后，插件才启动。服务消失或替换时，依赖它的插件会进入卸载或重新加载流程。插件注册的服务、事件监听和其他副作用会归属于它自己的生命周期，卸载时由 Cordis 撤销或调用清理函数。

Loader 则负责把配置文件里的插件条目变成真正运行的插件实例。它导入模块、处理配置、创建 Fiber，并把配置中额外声明的依赖交给 Cordis。这样，最终运行的 Harness 就是由配置、插件、服务依赖和生命周期共同组成的，而不是一个只能整体替换的黑盒。

**这段解释是基于本阶段源码的概括，不代表所有产品能力都已逐个追踪。**

## 2. 本阶段实际检查了什么

### 2.1 Cordis Runtime 源码

| 文件 | 本阶段核对内容 |
|---|---|
| vendor/cordis/src/registry.ts | Plugin 入口形态、Inject、RegistryService、ctx.plugin / ctx.inject |
| vendor/cordis/src/fiber.ts | Fiber 状态、创建、依赖刷新、reload/unload、Effect 和 dispose |
| vendor/cordis/src/context.ts | Root Context、子 Context、extend、isolate |
| vendor/cordis/src/service.ts | Service 基类如何注册服务 |
| vendor/cordis/src/reflect.ts | Context 属性代理、get/provide、服务解析、依赖通知 |
| vendor/cordis/src/events.ts | Event 分发模式、监听器注册和生命周期 |

### 2.2 Loader 源码

| 文件 | 本阶段核对内容 |
|---|---|
| vendor/loader/src/index.ts | Loader 服务、internal/plugin 监听、Entry 关联和 inject 合并 |
| vendor/loader/src/config/entry.ts | 模块导入、配置更新、禁用和插件 Fiber 创建 |
| vendor/loader/src/config/tree.ts | EntryTree、创建/更新/移除、模块导入 |
| vendor/loader/src/config/group.ts | EntryGroup、Group 插件和子条目管理 |

### 2.3 测试代码

| 测试 | 重点核对 |
|---|---|
| scripts/cordis-core-lifecycle.spec.ts | 加载中更新、激活失败清理、Provider/Consumer 卸载顺序、隔离、事件 |
| scripts/cordis-core-rc12.spec.ts | 隔离边界、PENDING/FAILED Fiber dispose、事件错误 |
| scripts/cordis-loader-rc9.spec.ts | Entry 参数校验、YAML 解析、模块导入失败 |
| packages/boot/app-boot/tests/user-patches.spec.ts | 配置插值等待依赖、Provider 替换、失败恢复、异步资源释放 |
| packages/boot/app-boot/tests/config-reload.spec.ts | Include 刷新、Patch 叠加和配置重载 |

**测试边界：** 本阶段阅读了测试实现和断言，没有在本地执行这些测试。下文标记为 TEST 的内容表示固定版本测试代码明确断言了该行为，不代表本轮重新运行得到 PASS。

## 3. Plugin、Registry 和 Fiber：插件不是一个简单的函数调用

### 3.1 官方实现支持三种入口形态

固定版本的 Registry 定义了三种 Plugin 入口：

1. Function：接收 ctx 和 config 的函数；
2. Object：包含 apply(ctx, config) 方法的对象；
3. Constructor：接收 ctx 和 config 的类构造器。

插件元数据还可以声明 name、Config、inject、provide 和 intercept。

证据：
- [registry.ts L91-L145](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/registry.ts#L91-L145)

### 3.2 Registry 和 Fiber 各自负责什么

- RegistryService：识别插件入口、维护插件运行记录、创建 Fiber、管理同一插件回调对应的 Fiber 集合。
- Fiber：代表某一次插件挂载实例，跟踪当前 Context、依赖实现、状态、配置、Effect 和清理过程。

Registry 的内部 Map 以解析后的 callback 函数作为运行记录的 key；一个 Runtime 可以持有多个 Fiber。因此，不能把“插件定义”“插件运行记录”和“某次插件实例”当成同一个对象。

证据：
- [registry.ts L195-L267](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/registry.ts#L195-L267)
- [registry.ts L300-L337](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/registry.ts#L300-L337)
- [fiber.ts L208-L231](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L208-L231)

### 3.3 ctx.plugin() 创建插件实例

从固定版本代码可还原出以下步骤：

1. Registry 解析插件入口，拒绝不支持的形态；
2. 检查当前 Fiber 是否仍可创建子插件；
3. 查找或创建共享 Runtime 记录；
4. 创建新的 Fiber，并为它创建继承父 Context 的子 Context；
5. 将子 Fiber 的 disposer 注册到父 Fiber 的 Effect 中，形成父子生命周期所有权；
6. 发出 internal/plugin 通知；
7. 通知完成后，再检查并刷新 inject 依赖；
8. 依赖齐全后进入加载流程，执行插件函数、对象 apply 或类构造逻辑。

这里有一个对 Loader 很关键的细节：Fiber 构造期间会先发出 internal/plugin，再解析依赖。Loader 正是通过这个通知把配置条目的 inject 合并进 Fiber。因此，不能把 Fiber 的依赖检查简单理解成“构造函数一开始就检查完所有依赖”。

证据：
- [registry.ts L316-L335](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/registry.ts#L316-L335)
- [fiber.ts L256-L347](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L256-L347)
- [loader/index.ts L149-L155](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/index.ts#L149-L155)

### 3.4 类插件与 Service 子类

Registry 对类插件会实例化对象，运行实例初始化钩子，再调用 Service.init 对应的初始化入口（如果存在）。Service 基类则在构造时通过 ctx.reflect.provide 注册一个具名服务。

因此，一个 Service 子类可以同时承担两个角色：
- 它是一个被 Cordis 挂载和管理生命周期的类插件；
- 它通过 Service 构造逻辑向其他插件提供一个具名服务。

但 Plugin 和 Service 仍不是同义词：函数插件也可以提供服务；一个插件也可以只消费服务而不提供服务。

证据：
- [fiber.ts L272-L287](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L272-L287)
- [service.ts L6-L12](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/service.ts#L6-L12)
- [service.ts L35-L61](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/service.ts#L35-L61)

## 4. Context、Service 和 inject：能力怎样被提供和消费

### 4.1 Context 是什么

Root Context 创建时安装 ReflectService、RegistryService、EventsService 和 LoggerService，并把 Context 包装为 Proxy。子 Context 通过 extend 继承父 Context 的属性，但可以覆盖自己的元数据和 Fiber。

Context.isolate(name, label) 可以为某个服务建立独立解析作用域。隔离作用域不会自动回退到父级或注入视图中的同名服务；这避免隔离区域意外拿到外层实现。

证据：
- [context.ts L72-L85](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/context.ts#L72-L85)
- [context.ts L92-L130](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/context.ts#L92-L130)
- [reflect.ts L176-L206](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L176-L206)

### 4.2 Service 如何注册

Service 基类的构造函数调用 ctx.reflect.provide(name, this, check)。底层 ReflectService 将服务实现记录为 Impl，记录服务名称、提供者 Context、所属 Fiber、隔离标签和依赖者集合。

提供服务时：
- 服务名称在同一隔离作用域中不能重复注册；
- 服务实现归属当前 Fiber；
- 提供方 Fiber 处于 ACTIVE 时，注册服务会通知依赖者；
- disposer 运行时，服务从当前可见 store 中撤销，并通知依赖者重新计算依赖；
- 清理逻辑会等待依赖者完成 teardown，再完成提供方的资源清理。

证据：
- [service.ts L35-L61](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/service.ts#L35-L61)
- [reflect.ts L115-L132](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L115-L132)
- [reflect.ts L303-L349](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L303-L349)

### 4.3 ctx.service 直接访问与 ctx.get 的区别

Context Proxy 对 ctx 上的服务属性访问会检查当前 Fiber 的依赖声明。没有 inject 声明时，直接读取 ctx.service 会报错。

ctx.get(name) 则是通过 ReflectService 读取服务，不要求 inject；默认 strict 模式只返回提供方 Fiber 当前 ACTIVE 的实现，没有可用实现时返回 undefined。

这解释了官方文档中的可选依赖写法：

- 必需依赖：声明 inject，框架保证 apply 执行时服务已经可用；
- 可选依赖：不声明 inject，在使用点用 ctx.get() 查询，并处理 undefined。

**重要区别：** ctx.get() 不会像 inject 一样把服务变化登记为 Fiber 的依赖，也不能据此推断服务出现后插件会自动重新执行。这是由两条不同的代码路径推导出的分析。

证据：
- [reflect.ts L8-L19](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L8-L19)
- [reflect.ts L262-L279](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L262-L279)
- [服务与依赖文档 §必需依赖与可选依赖](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/framework/service.zh.md#L87-L109)

### 4.4 inject 如何驱动 Fiber 激活

inject 接受数组或服务名到拦截配置的映射。映射中的值是服务拦截配置，不代表该服务本身是可选依赖。官方服务文档明确说明，可选依赖应使用 ctx.get()。

Fiber 将 inject 解析为服务名映射，然后：
1. 对每个必需服务查找可用 Impl；
2. 把依赖服务的 Impl UID 组合成当前 epoch；
3. 只要有一个依赖缺失，目标 epoch 就是 INACTIVE，Fiber 保持 PENDING；
4. 所有依赖可用时，Fiber 进入 LOADING 并执行插件；
5. 依赖实现变化时，epoch 改变，触发 unload/reload；
6. 服务提供方撤销时，ReflectService.notify 重新检查依赖者。

证据：
- [registry.ts L12-L19](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/registry.ts#L12-L19)
- [fiber.ts L602-L667](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L602-L667)
- [reflect.ts L357-L375](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L357-L375)

### 4.5 一个重要边界：正常依赖恢复与 FAILED 恢复不是一回事

官方服务文档说明：一个已经正常运行的插件，如果必需服务消失，会自动 dispose；服务重新出现时会自动重新加载。

但测试还揭示了一个重要边界：如果 Consumer 在某次激活过程中因 Provider 配置/初始化失败而进入 FAILED，之后 Provider 恢复，并不保证这个 FAILED Fiber 自动恢复。固定版本测试明确断言：需要对失败 Fiber 执行一次显式 update，才会重新尝试。

因此，不能简单把规则讲成“Provider 一恢复，所有 Consumer 都一定自动恢复”。

证据：
- [fiber.ts L652-L667](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L652-L667)：已有错误时不会直接推进 epoch；
- [fiber.ts L703-L731](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L703-L731)：加载失败记录错误；
- [fiber.ts L805-L840](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L805-L840)：update 清除错误并触发更新；
- [user-patches.spec.ts L206-L267](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/boot/app-boot/tests/user-patches.spec.ts#L206-L267)：测试断言 Provider 恢复后，FAILED Consumer 需要显式 update。

## 5. Fiber 生命周期与 Effect：谁创建，谁负责清理

### 5.1 Fiber 状态

固定版本定义了六种状态：

| 状态 | 含义 |
|---|---|
| PENDING | 等待必需服务 |
| LOADING | 插件回调正在执行 |
| ACTIVE | 插件已加载并提供能力 |
| FAILED | 配置或插件启动失败 |
| UNLOADING | 正在执行清理 |
| DISPOSED | Fiber 已移除，不能重启 |

证据：[fiber.ts L169-L184](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L169-L184)。

### 5.2 Effect 如何工作

ctx.effect(execute) 会立即执行 execute，并收集它返回的 disposer。支持：
- 一个同步 disposer；
- Promise 形式的异步 disposer；
- 迭代器逐步 yield 多个 disposer；
- 异步迭代器逐步 yield disposer。

Effect 的 disposer 被调用时，内部收集的 disposer 按逆序执行；异步清理会被等待。插件卸载时，Fiber 会清理自己持有的 Effect。

需要准确表达两个层次：
- 每个 Effect 内部的清理函数按逆序调用；
- Fiber 卸载时会等待各个顶层 Effect 清理任务完成，但源码使用 Promise.all 汇总，不应把它描述成所有顶层异步清理严格全局串行完成。

证据：
- [fiber.ts L98-L123](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L98-L123)
- [fiber.ts L430-L469](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L430-L469)
- [fiber.ts L734-L752](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L734-L752)

### 5.3 哪些操作自动归属 Effect

源码明确将以下操作放入当前 Fiber 的 Effect 生命周期：
- ctx.provide 注册服务；
- ctx.on 注册事件监听；
- ctx.accessor 创建 Context 属性；
- ctx.mixin 创建 Context 方法映射；
- ctx.plugin 创建子插件，并由父 Fiber 持有子 Fiber 的 disposer。

外部资源（例如定时器、文件 watcher、连接、子进程）不是 Cordis 自动理解的对象。插件作者需要通过 ctx.effect() 返回清理函数，显式告诉框架如何释放它们。

证据：
- [reflect.ts L303-L349](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L303-L349)
- [events.ts L267-L310](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/events.ts#L267-L310)
- [reflect.ts L385-L429](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L385-L429)
- [fiber.ts L292-L325](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L292-L325)

### 5.4 Provider 为什么不会在 Consumer 清理前消失

这是 Cordis 生命周期里最值得讲清楚的细节之一。

假设 Consumer 依赖 Provider 提供的 Service：

1. Provider 开始卸载；
2. Consumer 收到服务变化通知，进入自己的卸载流程；
3. Provider 在 _unload 中检查自己提供的服务是否仍有 dependents；
4. 只要还有 Consumer 没有完成 teardown，Provider 就等待；
5. Consumer 的清理完成后，依赖关系解除；
6. Provider 才继续清理自己的 Effect 和服务资源。

这意味着 Consumer 的 teardown 期间仍可以访问旧 Provider 的服务，避免清理代码访问已经先行销毁的资源。

固定版本测试专门验证：Consumer 的异步 disposer 尚未完成时，Provider 资源仍保持可用；Consumer 完成后才执行 Provider 清理。

证据：
- [fiber.ts L734-L759](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L734-L759)
- [reflect.ts L333-L347](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/reflect.ts#L333-L347)
- [cordis-core-lifecycle.spec.ts L74-L100](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/scripts/cordis-core-lifecycle.spec.ts#L74-L100)

### 5.5 Harness 本地 vendored 修改不能忽略

DeepSeek Harness 并非直接使用未经修改的 Cordis 上游代码。

vendor/README.md 记录：
- V6 对 Fiber 生命周期做了本地硬化：Effect 在 setup 执行前就登记给 owner；同步 setup 失败时回滚已收集的 cleanup；异步清理在完成前保持 owner 可见；UNLOADING 阶段拒绝新增 Effect；子 Fiber 在发布通知前先完成父级 disposer 所有权登记。
- V15 调整 Core、Loader、Include 和 HMR 的配置访问与提交。
- V25 调整 Loader 生命周期：组合更新前刷新依赖；禁用条目等待 dispose；失败 Fiber 在修正输入或依赖后需要显式 update。

这意味着“Cordis 上游文档怎么写”不等于“DeepSeek Harness 固定版本实际怎么运行”。本次分享必须优先讲 Harness 固定 Commit 的 vendored 行为。

证据：
- [vendor/README.md L36-L37](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/README.md#L36-L37)
- [vendor/README.md L42-L48](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/README.md#L42-L48)
- [fiber.ts L545-L576](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L545-L576)

V6 的源码和 vendor 变更说明已核对，但本阶段没有专门运行重入卸载压力测试；这类并发边界仍保留为后续可选验证项。

## 6. Event：不仅是通知，还有串行决策与中间件

Cordis 的事件服务提供多种语义，不应把它们统称为“发布订阅”：

| 方法 | 执行方式 | 典型用途 |
|---|---|---|
| emit | 同步逐个调用，不等待返回的 Promise | 轻量通知 |
| parallel | 并发执行，等待全部完成；失败时汇总为 AggregateError | 并行观察/处理 |
| serial | 按顺序 await，遇到 bail 值停止 | 有顺序的异步处理 |
| bail | 同步按顺序执行，遇到 bail 值停止 | 同步判断 |
| waterfall | 外层 listener 包裹 next，形成中间件链 | 修改、拦截或委托默认行为 |

Waterfall 中 listener 不调用 next()，就会阻止后续 listener 和最终默认行为；同一个 listener 重复调用 next() 会抛错。

事件监听器属于注册它的 Fiber，Fiber 卸载时自动移除。once 则在首次触发时主动注销自己。

证据：
- [events.ts L187-L265](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/events.ts#L187-L265)
- [events.ts L267-L327](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/events.ts#L267-L327)

## 7. Loader：配置条目怎样成为真正的插件

### 7.1 Loader 自己也是一个插件/服务

Loader 作为可挂载的运行单元创建 EntryTree，并将自己注册为 ctx.loader 服务。它提供内置模块解析、配置树和条目管理能力。

证据：
- [loader/index.ts L72-L103](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/index.ts#L72-L103)

### 7.2 EntryTree、EntryGroup 和 Entry 的分工

- EntryTree：维护一棵插件配置条目树，负责 ID、查找、创建、更新、移除和模块导入；
- EntryGroup：管理一组子 Entry，并将配置列表变化协调到具体 Entry；
- Entry：对应一个配置条目，持有 Context、配置和最终创建的 Fiber。

配置树中的 name 可以指向普通模块，也可以使用 cordis: 前缀指向 Loader 内置插件。

证据：
- [tree.ts L80-L123](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/tree.ts#L80-L123)
- [tree.ts L141-L170](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/tree.ts#L141-L170)
- [tree.ts L222-L237](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/tree.ts#L222-L237)
- [group.ts L7-L36](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/group.ts#L7-L36)

### 7.3 Entry 如何启动插件

固定版本的 Entry.init() 过程：

1. EntryTree.import 根据 name 导入插件模块或解析 cordis: builtin；
2. Loader 规范化 default export；
3. Entry 更新自己的 Context；
4. Loader 输出 apply 日志；
5. 调用 ctx.registry.plugin(plugin, config)，创建 Cordis Fiber；
6. Fiber 构造期间触发 internal/plugin；
7. Loader 监听该事件，将 Entry 关联到 Fiber，并将 EntryOptions.inject 合并进 Fiber.inject；
8. Fiber 再根据完整依赖集判断是否可以激活。

证据：
- [entry.ts L250-L277](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/entry.ts#L250-L277)
- [loader/index.ts L149-L155](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/index.ts#L149-L155)
- [fiber.ts L327-L347](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/src/fiber.ts#L327-L347)

### 7.4 配置变化和禁用

Entry.update() 会合并新配置：
- disabled 时等待 Fiber.dispose 完成；
- active Fiber 的配置变化可能走特殊的 volatile-only 更新；
- 普通配置或 Context 变化会进入 patch-context 和 Fiber.update/restart 流程；
- Entry.init() 负责导入和启动尚未运行的插件。

这不是简单地“修改 YAML 后重新读一次”。Loader 要协调配置解析、服务依赖、Fiber 生命周期和文件来源位置。

证据：
- [entry.ts L118-L129](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/entry.ts#L118-L129)
- [entry.ts L137-L170](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/entry.ts#L137-L170)
- [entry.ts L250-L277](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/loader/src/config/entry.ts#L250-L277)

## 8. 当前可确认的运行流程图

~~~mermaid
flowchart TD
    A["Profile / Bundle / Patch 形成配置层"] --> B["Loader / EntryTree"]
    B --> C["Entry 导入模块、解析配置"]
    C --> D["Registry.plugin(plugin, config)"]
    D --> E["创建 Fiber 和子 Context"]
    E --> F["internal/plugin 通知"]
    F --> G["Loader 关联 Entry 并合并 inject"]
    G --> H{"所有必需 Service 可用？"}
    H -- 否 --> I["PENDING：等待服务变化"]
    I --> H
    H -- 是 --> J["LOADING：执行插件"]
    J --> K["ACTIVE：提供 Service / 注册 Event / Effect"]
    K --> L{"依赖、配置或卸载发生变化？"}
    L -- 否 --> K
    L -- 是 --> M["UNLOADING：Consumer 先清理"]
    M --> N["等待依赖者 teardown"]
    N --> O["撤销 Service / Effect / Event"]
    O --> P{"目标依赖是否仍可用？"}
    P -- 是 --> J
    P -- 否 --> I
~~~

图中的 Profile / Bundle / Patch 到 Loader 的组合方向来自 Harness 架构和 App Boot 文档；本阶段没有完整追踪 Profile 的所有解析与优先级代码。该部分在图中只表示配置层入口，不代表 Profile 机制已完成研究。

## 9. 关键结论与证据等级

| 结论 | 证据等级 | 证据 | 能证明什么 | 不能据此推断什么 |
|---|---|---|---|---|
| 插件入口支持 Function、Object、Constructor | SOURCE | registry.ts L91-L145 | 三种入口形态及元数据 | 不是所有 npm 包都自动是插件 |
| 每次挂载对应 Fiber，Runtime 可共享 | SOURCE | registry.ts L195-L337；fiber.ts L208-L231 | 注册记录和实例的区别 | 不代表插件进程隔离 |
| Context 通过 Proxy 解析服务 | SOURCE | context.ts L72-L109；reflect.ts L176-L206 | 服务访问和子 Context 机制 | 不代表操作系统沙箱 |
| inject 使必需服务成为激活条件 | OFFICIAL + SOURCE | service.zh.md L87-L109；fiber.ts L639-L667 | 依赖缺失时等待，依赖变化时重算 | 不代表可选依赖也自动跟踪 |
| ctx.get 可查询可选服务 | OFFICIAL + SOURCE | service.zh.md L89-L100；reflect.ts L262-L279 | 可选查询路径 | 不代表服务出现时自动重跑 |
| Provider 清理等待依赖者 teardown | SOURCE + TEST | fiber.ts L734-L759；core-lifecycle.spec.ts L74-L100 | 旧服务在 Consumer 清理完成前保持可用 | 不代表所有外部资源都自动可清理 |
| Event 监听归属 Fiber | SOURCE | events.ts L267-L310 | unload 时注销 listener | 不代表 emit 会等待异步 listener |
| Waterfall 可拦截后续链 | SOURCE | events.ts L240-L265 | next 控制后续链和默认行为 | 不代表所有事件都应使用 waterfall |
| Loader 将配置条目变成 Fiber | SOURCE | entry.ts L250-L277；loader/index.ts L149-L155 | 模块导入、Entry 关联、inject 合并 | 不代表 Profile/Bundle 的全部解析已审查 |
| FAILED Consumer 不一定随 Provider 恢复自动恢复 | TEST + SOURCE | user-patches.spec.ts L206-L267；fiber.ts L652-L667 | 失败激活后需要显式 update 的边界 | 不代表正常 PENDING Consumer 不会自动恢复 |
| Harness 修改了 vendored Cordis 生命周期 | OFFICIAL + SOURCE | vendor/README.md L36-L48；fiber.ts L545-L576 | 本地补丁和实现位置 | 尚未实测每个并发边界 |

## 10. 本阶段仍未解决的问题

1. **V6 重入卸载的运行验证：** 已核对变更说明和实现，但没有在本地构造 reentrant setup/dispose 场景运行。
2. **Event 模式的失败边界：** 已读实现和部分测试，尚未逐一验证异步 listener 在 emit、parallel、serial 等模式下的错误处理差异。
3. **HMR：** 本阶段只知道 Loader/Include 与 HMR 的连接点，未追踪模块替换、配置文件 watcher 和 Profile reload 的完整链路。
4. **Profile / Bundle / Patch：** 已确认是配置组合层，但没有完整追踪其加载优先级、补丁合并和 Profile 重组流程。
5. **真实产品插件：** 尚未选择一个最终案例，也未把本阶段的 Cordis 机制映射到具体产品插件。
6. **运行证据：** 本轮没有在本地执行项目或测试；目前证据来自固定版本源码和测试断言。

这些问题不会被伪装成已解决。若阶段 C 的案例需要其中某项，再做针对性补查；不需要的部分不扩大范围。

## 11. 阶段 B 验收结论

| 验收项 | 结果 | 说明 |
|---|---|---|
| Plugin / Registry / Fiber 职责 | 通过 | 已追踪入口形态、Runtime 和 Fiber |
| Context / Service / inject | 通过 | 已追踪服务注册、依赖刷新和隔离边界 |
| Effect / dispose / 所有权 | 通过（静态） | 已追踪源码与 Provider/Consumer 测试；V6 并发边界未运行 |
| Event | 通过（静态） | 已确认五种分发语义和 listener Effect 所有权 |
| Loader / Entry / EntryTree | 通过 | 已追踪配置条目如何导入并创建 Fiber |
| 测试证据 | 通过（已读未运行） | 已核对具体断言，不把测试名当结果 |
| 实际运行验证 | 未执行 | 当前证据足以回答核心流程；并发边界保留 OPEN |

**阶段 B 结论：源码与测试静态研究达到进入阶段 C 的条件。** 这不等于本地运行测试通过，也不代表所有 Cordis 边界都已覆盖。

## 12. 下一阶段：阶段 C｜选择并追踪真实产品插件

下一阶段不再扩大 Cordis 通用机制研究，而是把已理解的抽象放进 DeepSeek Harness 产品代码中。

先比较以下候选：
- Bash 三角色组合：最能体现 Service Definition / Provider / Consumer 和 Provider 替换；
- LLM Provider Adapter：最能体现模型适配器如何接入统一 LLM 服务；
- Agent Loop：最能体现核心运行能力本身也是插件，但复杂度较高。

当前初步判断：**Bash 三角色组合最容易让听众看懂“定义能力—提供实现—消费能力—替换实现”的关系**；但它不是单个插件，阶段 C 仍需比较依赖、源码范围和测试后再定最终案例。

阶段 C 输出到 04-source-trace.md，记录候选比较、选择理由、实际配置入口、源码调用链、测试证据和适用边界。

## 更新记录

- 2026-11-28：完成阶段 B 的固定版本源码与测试静态审查；明确 Plugin/Runtime/Fiber、Context/Service/inject、Effect 所有权、Event 语义和 Loader Entry 创建流程。没有执行本地测试或运行实验。
