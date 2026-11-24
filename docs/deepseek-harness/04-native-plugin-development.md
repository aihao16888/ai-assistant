# 04｜DeepSeek Harness 原生插件开发

> 更新日期：2026-11-24｜归属：DeepSeek Harness 专题｜关联任务：从 Harness 原理到 Agent 开发与业务系统集成

> 前置：[03｜Cordis 插件模型与生命周期](./03-cordis-plugin-model.md)。  
> 本篇只讲 DeepSeek Harness 原生 Cordis Plugin，不讲 Java MCP Server。

## 1. 原生插件使用什么语言？

DeepSeek Harness 官方入门文档明确规定：原生插件是导出 apply 函数的 TypeScript 模块。

准确区分：

- **开发教程**：使用 TypeScript 和 Cordis 类型。
- **运行时**：Node.js 生态。
- **可分发插件入口**：可以使用 JavaScript ESM。
- **Java**：不是 DeepSeek Harness 原生 Cordis Plugin 的运行时语言。

因此，不能把原有 Spring Boot 项目改成一个 Java Cordis 插件。Java 业务系统可以通过 MCP Server 等协议向 Harness 提供能力，后文会单独讲解。

## 2. 最小插件结构

~~~typescript
import type { Context } from '@deepseek-ai/cordis'

export const name = 'document-plugin'

export function apply(ctx: Context) {
  console.log('document plugin loaded')
}
~~~

需要使用 Harness 已有服务时，声明 inject：

~~~typescript
import type { Context } from '@deepseek-ai/cordis'

export const name = 'document-tool-plugin'
export const inject = ['tools']

export function apply(ctx: Context) {
  // tools 服务就绪后再注册工具
}
~~~

这里的 name 是插件标识；inject 声明依赖；apply 是加载入口。

## 3. 插件如何注册 Tool？

官方工具教程使用 ctx.tools.register() 和 defineTool()。

~~~typescript
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'The name to greet'
      }
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [
        { type: 'text', text: value }
      ]
    },
    async execute(args) {
      return 'Hello, ' + args.name + '!'
    }
  }))
}
~~~

关键字段：

| 字段 | 作用 |
|---|---|
| name | 模型调用的工具名称 |
| description | 告诉模型这个工具能做什么 |
| parameters | 定义输入参数和约束 |
| output.schema | 定义规范化返回值 |
| output.render | 将规范化结果转成模型可见内容 |
| execute | 真正执行工具逻辑 |

不要只给工具一个名字。模型是否能正确使用工具，很大程度取决于 description、参数 Schema、返回值和错误语义是否清晰。

生产工具还要处理取消信号、超时、权限策略、异常分类和结果大小。具体契约见官方工具编写参考。

## 4. 插件配置如何设计？

不同部署可能使用不同的地址、超时、开关或重试次数时，应将这些值设计成配置字段，而不是硬编码在代码里。

官方教程使用 Schemastery 定义 Config：

~~~typescript
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'document-plugin'

export interface Config {
  apiBaseUrl: string
  timeoutMs: number
}

export const Config = Schema.object({
  apiBaseUrl: Schema.string().required(),
  timeoutMs: Schema.number().default(30000)
})

export function apply(ctx: Context, config: Config) {
  console.log(config.apiBaseUrl)
}
~~~

配置由 Cordis 在插件加载时校验，并填充默认值。配置错误应在加载时明确失败，不要等到模型调用工具时才暴露。

## 5. 本地开发：先用 Patch 加载

官方入门教程先创建本地插件文件，再通过 cordis.yml 将插件插入 Web Profile。

示意配置：

~~~yaml
- insert:
    - id: document-plugin
      name: /absolute/path/to/document-plugin/src/index.ts
~~~

然后启动：

~~~bash
pnpm dsh web --patch ./scratch-plugin/cordis.yml
~~~

这里的绝对路径是本地开发示例。实际路径必须替换成自己的项目路径。

本地开发阶段先验证：

1. 插件是否被加载；
2. inject 服务是否可用；
3. Tool 是否出现在模型工具列表；
4. 模型能否正确调用；
5. 插件卸载或配置重载后，注册是否清理。

## 6. 如何打包为可安装 Bundle？

官方发布教程将 Bundle 与 Profile 分开：

- Bundle：作者编写并分发的插件组合包；
- Profile：用户实际启动的一套组合。

一个最小 Bundle 目录可以是：

~~~text
dsh-document-plugin/
├── package.json
├── cordis.patch.yml
└── index.js
~~~

package.json 示例：

~~~json
{
  "name": "dsh-document-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
~~~

cordis.patch.yml 示例：

~~~yaml
- insert:
    - id: document-plugin
      name: dsh-document-plugin
~~~

安装到 Profile：

~~~bash
dsh plugin --profile demo add ./dsh-document-plugin
~~~

Bundle 的 patch 会进入 Profile 的组合层，随后由 Harness 加载其中声明的插件。

## 7. TypeScript 插件发布时要注意什么？

本地源码运行和可分发包不是同一个场景。

官方发布教程指出：

- Git 安装拉取的是源码；
- 如果包的入口依赖构建产物，作者需要提供安装时构建流程；
- pnpm 10 对依赖构建脚本需要显式授权；
- npm 发布或交付预构建 tarball，可以避免用户在安装时运行该包的构建脚本。

安装时授权构建意味着允许包代码在宿主机器上执行。只对可信来源授权，并固定 Git Commit；不要把这类脚本误认为运行在 Agent 沙箱内。

## 8. 什么时候需要自定义 DSH Plugin？

不是每个外部系统都需要一个自定义 Cordis Plugin。

- 只是连接一个 MCP Server：优先使用 Harness 已有的 MCP Client / MCP Manager。
- 需要在插件安装时自动注册 MCP Server：可以开发一个薄的 Cordis Plugin。
- 需要扩展 Harness 内部 Tool、Service、Hook 或 UI：才考虑更完整的原生插件。

不要为了“插件化”而把已有业务逻辑复制到 TypeScript 插件里。

## 9. 本篇应掌握的结论

- 原生 DSH Plugin 使用 TypeScript / JavaScript ESM，运行在 Node.js 生态。
- apply(ctx) 是插件入口，inject 声明依赖。
- Tool 通过 ctx.tools.register() 注册。
- 可配置项使用 Schema 声明并校验。
- 本地开发可用 Patch，分发时使用 Bundle。
- Java 业务系统不需要重写成 Cordis Plugin。

## 10. 官方来源

- [第一个插件（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/index.zh.md)
- [开发一个工具（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/tool.zh.md)
- [插件配置（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/config.zh.md)
- [打包与安装插件（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/user/develop/basic/publish.zh.md)
- [工具编写参考（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/docs/cookbook/adding-a-tool.zh.md)

**下一篇：** [05｜Tool、Skill、MCP 与 Plugin 的边界](./05-tool-skill-mcp-boundaries.md)。先把能力概念区分清楚，再研究 Harness 如何连接外部 MCP Server。


## 更新记录

- 2026-11-24：按编号学习路径拆分原单文件，补充官方来源核查并明确技术边界。
