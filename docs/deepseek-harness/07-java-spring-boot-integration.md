# 07｜Java / Spring Boot 业务系统如何接入 Agent

> 更新日期：2026-11-24｜归属：DeepSeek Harness 专题｜关联任务：从 Harness 原理到 Agent 开发与业务系统集成

> 本篇是面向企业后端工程的工程设计建议，不是 DeepSeek 官方规定的唯一接入架构。  
> 前置：[06｜DeepSeek Harness 的 MCP 接入机制](./06-dsh-mcp-integration.md)。

## 1. 先给结论

如果原有系统是 Java + Spring Boot，前端由 Vue 等技术负责页面展示，那么没有必要为了接入 DeepSeek Harness 把原有业务逻辑重写成 TypeScript 插件。

更合适的做法通常是：

**保留原有 Java 业务系统，在现有业务能力上增加 MCP Server 接入层，再由 Agent Host 通过 MCP 调用。**

~~~text
员工
 ├── 原有 Web 前端
 │       ↓
 │   Spring Boot REST API
 │
 └── Agent Host
         ↓
      MCP Client
         ↓
      Java MCP Server
         ↓
   原有 Application Service
         ↓
   Domain / Repository
         ↓
      数据库
~~~

这条链路里，MCP 是面向 Agent 的接入方式，Java Service 仍然是业务规则的最终执行者。

## 2. MCP Server 应该放在哪里？

有两种常见部署方式。

### 方案 A：放在现有 Spring Boot 应用中

在现有 Spring Boot 项目增加 MCP Server Starter 和一组 MCP Tool Bean。

优点：

- 可以直接复用原有 Application Service；
- 不需要复制业务逻辑；
- 事务和权限可以沿用现有后端体系；
- 部署和运维改动相对小。

适合先做只读能力试点。

### 方案 B：单独部署 MCP Adapter Service

单独建立一个 MCP 服务，通过内部 API 调用原有业务系统。

优点：

- MCP 接入层可以独立部署和升级；
- 可以单独控制网络边界和资源；
- 不需要让 Agent Host 直接接触原有业务应用入口。

代价：

- 增加服务间认证、调用链路和运维成本；
- 需要设计内部 API 的稳定性与超时；
- 不能在 MCP Adapter 中复制原有业务规则。

**建议：** 如果当前系统规模和安全边界允许，先在现有 Spring Boot 应用中增加 MCP 接入层。出现独立部署、网络隔离或扩展需求后，再拆成单独服务。

## 3. Java 项目如何实现 MCP Server？

Spring AI 提供 Spring Boot MCP Server Starter。

当前官方参考文档列出的 HTTP 方案包括：

| 现有应用技术栈 | Starter | Streamable HTTP 配置 |
|---|---|---|
| Spring MVC | spring-ai-starter-mcp-server-webmvc | spring.ai.mcp.server.protocol=STREAMABLE |
| Spring WebFlux | spring-ai-starter-mcp-server-webflux | spring.ai.mcp.server.protocol=STREAMABLE |

如果现有项目使用 spring-boot-starter-web（Spring MVC），通常先选 WebMVC Starter；不要为了接入 MCP 就无理由地把现有应用切换到 WebFlux。

依赖版本需要通过与你项目 Spring Boot 版本兼容的 Spring AI BOM 管理，不要直接复制其他项目的版本号。

## 4. 用业务 Service 实现 MCP Tool

假设原有系统已经有：

- DocumentApplicationService；
- ApprovalApplicationService；
- VersionApplicationService。

新增 MCP 层只负责把协议参数转换成业务方法调用。

示例：

~~~java
@Component
public class DocumentMcpTools {

    private final DocumentApplicationService documentService;

    public DocumentMcpTools(
        DocumentApplicationService documentService
    ) {
        this.documentService = documentService;
    }

    @McpTool(
        name = "search_documents",
        description = "根据项目和关键词搜索当前用户有权访问的文档"
    )
    public List<DocumentSummary> searchDocuments(
        @McpToolParam(
            description = "项目 ID",
            required = true
        )
        String projectId,

        @McpToolParam(
            description = "文档关键词",
            required = true
        )
        String keyword
    ) {
        return documentService.search(projectId, keyword);
    }
}
~~~

Spring AI 的注解扫描可以发现带有 MCP 注解的 Spring Bean，并将方法注册为 MCP Tool，自动生成输入 JSON Schema。

这里最重要的不是注解，而是分层：

~~~text
MCP Request
    ↓
DocumentMcpTools
    ↓
DocumentApplicationService
    ↓
Domain / Repository
~~~

不要在 MCP Tool 方法中直接拼 SQL，也不要复制一套与原有业务系统不同的审批规则。

## 5. Tool 应该按业务意图设计，而不是复制 CRUD

前端 REST API 往往按页面和表单设计；Agent Tool 应该按模型可以理解的业务目标设计。

例如：

| Tool | 作用 | 初期风险 |
|---|---|---|
| search_documents | 按项目和关键词搜索文档 | 低 |
| get_document_details | 获取文档详情 | 低 |
| compare_document_versions | 比较两个文档版本 | 低 |
| list_my_pending_approvals | 查询当前用户待办 | 低 |
| prepare_document_approval | 检查审批材料并生成清单 | 中 |
| submit_document_for_approval | 提交审批 | 高 |

设计 Tool 时要明确：

1. **名称和描述**：让模型知道何时调用。
2. **输入 Schema**：字段类型、必填、枚举、范围和业务约束。
3. **输出结构**：返回稳定的字段和状态，不要只返回一段模糊自然语言。
4. **数据边界**：限制查询范围、分页大小和敏感字段。
5. **错误语义**：区分未找到、无权限、状态不允许、参数错误和系统异常。
6. **幂等性**：对创建、上传、提交等写操作防止重复执行。

## 6. 身份与权限：最容易被忽略的风险

这是企业接入的关键问题。

Spring AI 官方文档明确提醒：HTTP MCP Server 默认不会自动提供认证和授权。只要客户端能够访问端点，就可能枚举和调用已注册的工具。

因此，不能只在 DSH 中填写一个 Authorization Header，就认为企业权限体系已经建立。

至少要完成：

- MCP HTTP Endpoint 的身份认证；
- Origin 校验，防范 DNS Rebinding；
- 当前员工、租户、部门和项目权限验证；
- 对文档、审批和文件资源的逐项授权；
- 写操作的审计与幂等控制；
- 敏感信息的最小化返回。

尤其不能让模型通过参数传入 userId，就冒充某个员工。

正确方式是：Java 服务从经过验证的身份凭据中取得当前 Principal，再执行权限检查。模型提供的项目 ID、文档 ID 也必须由服务端重新校验。

如果 DSH 使用固定服务 Token，那么后端看到的可能只是服务账号身份。多用户场景应设计用户级 OAuth、受控 Token Exchange 或其他可信身份委托机制。

## 7. 写操作应分阶段开放

不建议第一天就开放删除、审批通过和驳回。

建议分三阶段：

### 第一阶段：只读

- 文档搜索；
- 文档详情；
- 版本比较；
- 当前用户待办；
- 审批状态查询。

验收：不同用户只能读取自己有权访问的数据；查询结果可追溯；工具参数和结果稳定。

### 第二阶段：准备与低风险写入

- 准备材料；
- 上传文档；
- 创建新版本；
- 补充元数据。

验收：权限、文件校验、幂等和审计都在后端完成。

### 第三阶段：高风险业务动作

- 提交审批；
- 批准；
- 驳回；
- 删除或归档。

建议采用 Preview / Confirm / Execute 模式：

1. Agent 先调用准备工具；
2. 后端返回将执行的具体动作和影响范围；
3. 用户确认；
4. Agent 调用正式执行工具；
5. 后端再次校验权限、状态和幂等键；
6. 记录最终审计事件。

用户确认不能替代后端校验；后端校验也不能替代需要的人类审批。

## 8. Java MCP 接入后，原有前端还需要吗？

需要。

原有 Web 前端继续服务人类用户：

- 表单录入；
- 数据可视化；
- 复杂审批界面；
- 权限管理；
- 结果确认。

Agent Host 提供自然语言入口和任务编排。

两种入口最终调用同一套业务服务，但不应共用一个不受约束的管理员身份。

## 9. 本篇应掌握的结论

- 不需要把 Java 项目改写为 TypeScript 插件。
- MCP Server 可以作为现有 Spring Boot 应用的一层接入能力。
- MCP Tool 应调用原有 Application Service。
- 业务权限、事务、幂等和审计必须由 Java 后端保证。
- 第一阶段从只读能力开始，验证身份边界后再逐步开放写操作。

## 10. 官方参考资料

- [Spring AI MCP Server Boot Starter](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-server-boot-starter-docs.html)
- [Spring AI MCP Server Annotations](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-annotations-server.html)
- [Spring AI MCP Security](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-security.html)
- [DeepSeek Harness MCP Manager（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/mcp/mcp-manager/README.zh.md)

**下一篇：** [08｜跨 Agent Host 的复用策略](./08-cross-host-reuse.md)。同一套 Java MCP Server 如何被不同 Agent Host 使用。


## 更新记录

- 2026-11-24：按编号学习路径拆分原单文件，补充官方来源核查并明确技术边界。
