# 06｜DeepSeek Harness 的 MCP 接入机制

> 更新日期：2026-11-24｜归属：DeepSeek Harness 专题｜关联任务：从 Harness 原理到 Agent 开发与业务系统集成

> 前置：[05｜Tool、Skill、MCP 与 Plugin 的边界](./05-tool-skill-mcp-boundaries.md)。  
> 本篇讲 DSH 自己已经提供什么，不重复介绍 MCP 通用协议。

## 1. 先给结论：连接 MCP Server 不一定需要自己写插件

DeepSeek Harness 已经提供 MCP Client 和 MCP Manager。

因此，常见的企业系统接入场景是：

1. Java 后端实现 MCP Server；
2. DeepSeek Harness 配置 MCP Manager；
3. MCP Manager 建立连接；
4. 服务端发布的工具被发现并注册到 Harness；
5. 模型可以像调用原生 Tool 一样调用这些能力。

只有在需要安装某个插件时自动注册 MCP Server、或需要扩展 Harness 内部行为时，才需要自己写 Cordis Plugin。

## 2. DSH 提供的两个 MCP 组件

| 组件 | 主要职责 | 适用场景 |
|---|---|---|
| dsh-mcp-client | 连接一台 MCP Server，并把其工具和资源接入 Harness | 服务器固定在 Profile 组合配置中 |
| dsh-mcp-manager | 管理一组运行时 MCP Server，支持配置、启停、探测、状态观察和插件注册 | 服务器需要在运行时动态管理 |

可以这样理解：

- **mcp-client** 是连接桥。
- **mcp-manager** 是服务器管理层，它会为每个启用的配置项挂载对应的 mcp-client 实例。

如果只是一个固定服务器，可以先用 mcp-client。需要在 Settings 中动态增加、修改、停用或删除服务器时，使用 mcp-manager 更合适。

## 3. 传输方式

当前 DSH MCP Client 文档列出的主要传输方式：

| 传输 | 适用场景 |
|---|---|
| stdio | 本地启动一个 MCP Server 进程，通过标准输入输出通信 |
| streamable-http | 连接远程或独立部署的 MCP Server |

对于已经部署在企业网络中的 Spring Boot 服务，通常优先考虑 Streamable HTTP。

## 4. 使用内置 MCP Manager 连接 Java 服务

假设 Java MCP Server 的地址为：

https://document.example.com/mcp

可以在 DSH Profile 的配置中加入：

~~~yaml
- id: mcp
  name: '@deepseek-ai/dsh-mcp-manager'
  inject: [credentials]
  config:
    servers:
      document_platform:
        transport: streamable-http
        url: https://document.example.com/mcp
        headers:
          Authorization: 'Bearer ${credential:DOC_PLATFORM_MCP_TOKEN}'
        enabled: true
~~~

其中：

- document_platform 是本地服务器名称；
- transport 指定 Streamable HTTP；
- url 是 MCP Server 的访问地址；
- headers 是连接请求头；
- credential 引用凭据提供方中的密钥，不应该把真实 Token 明文写进普通配置文件。

服务器连接后，工具名称会采用服务器限定的命名形式：

~~~text
mcp__document_platform__search_documents
mcp__document_platform__get_document_details
mcp__document_platform__compare_document_versions
~~~

这样，不同服务器即使都提供名为 search 的工具，也可以在不同 namespace 下共存。

## 5. 什么时候需要自定义 DSH Plugin？

假设你正在开发一个名为 dsh-document-platform 的插件，希望用户安装它时自动注册文档管理 MCP Server。

这时可以使用官方 mcp-manager 暴露的注册接口：

~~~typescript
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-mcp-manager'

export const name = 'document-platform'
export const inject = ['mcpManager']

export function apply(ctx: Context): void {
  ctx.mcpManager.register('document_platform', {
    transport: 'streamable-http',
    url: 'https://document.example.com/mcp',
    headers: {
      Authorization: 'Bearer ${credential:DOC_PLATFORM_MCP_TOKEN}'
    }
  })
}
~~~

这段插件代码只负责注册 MCP Server，不负责实现文档搜索、版本比较或审批业务。

注册会随插件生命周期存在；插件卸载时，管理器会撤销该注册并卸载对应服务器实例。

## 6. 凭据与认证边界

DSH 的凭据模板解决的是连接配置中密钥的保存和解析问题，不等于它替 Java 服务完成了用户授权。

必须区分：

- DSH 是否持有连接凭据；
- MCP Server 是否验证请求身份；
- Java 业务层是否判断当前用户能否访问某个项目或文档。

如果一个 Token 代表固定服务账号，那么所有使用该 Token 的请求在后端看到的可能都是同一个服务身份。多用户场景不能因此丢失实际员工身份。

企业接入应采用用户级 OAuth、受控 Token Exchange 或其他可信的身份委托方式，并由 Java 服务端强制校验业务权限。

## 7. DSH MCP 接入的当前边界

根据当前官方 mcp-client 文档：

- 外部 MCP Tools 可以被桥接为 Harness Tools；
- 可以读取支持的 MCP Resources；
- 工具列表变化会触发同步；
- 连接失败会影响对应服务器的工具可用性，并按配置执行重连；
- 可以配置 eager 或 on-demand 工具加载；
- MCP Prompt 模板当前不受支持。

不要把 MCP 协议的全部能力，直接等同于 DSH 当前客户端已经完整实现的能力。

## 8. 本篇应掌握的结论

对于 Java 业务系统：

- 不必先开发 TypeScript 插件；
- 先实现 Java MCP Server；
- 优先使用 DSH 内置 MCP Manager 连接；
- 只有需要宿主专属安装、自动注册或内部扩展时，才开发薄 Cordis Plugin；
- 身份认证和业务权限仍由 Java 后端负责。

## 9. 官方来源

- [DSH MCP Client（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/mcp/mcp-client/README.zh.md)
- [DSH MCP Manager（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/mcp/mcp-manager/README.zh.md)

**下一篇：** [07｜Java / Spring Boot 业务系统接入](./07-java-spring-boot-integration.md)。将连接配置进一步落实为现有 Java 项目的服务端架构。


## 更新记录

- 2026-11-24：按编号学习路径拆分原单文件，补充官方来源核查并明确技术边界。
