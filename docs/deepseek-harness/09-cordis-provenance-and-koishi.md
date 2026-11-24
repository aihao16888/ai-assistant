# 09｜Cordis 上游来源与 Koishi 证据边界

> 本篇只处理来源核查。它不推断 DeepSeek 团队内部未公开的技术决策。

## 1. 先给结论

目前可以确认：

1. DeepSeek Harness 使用 Cordis 作为底层插件框架；
2. DeepSeek Harness 将 Cordis 源码以 vendoring 方式放入自己的仓库；
3. DeepSeek 的 vendor manifest 将 Cordis 上游项目指向 cordiverse/cordis，并记录了上游版本和 Git Commit；
4. Cordis 与 Koishi 生态有明确的历史联系；
5. **目前没有直接证据证明 DeepSeek 官方声明“我们的 Harness 设计参考了 Koishi”。**

第 5 点是最需要守住的证据边界。

## 2. DeepSeek 官方明确记录了什么？

DeepSeek Harness 仓库的 vendor/README.md 说明，Cordis 及其基础库以源码 vendoring 的方式复制到 Harness monorepo，而不是简单地从 npm 安装一个外部运行包。

当前核查快照中，Cordis 对应记录为：

| 字段 | 官方记录 |
|---|---|
| DSH 内部包名 | @deepseek-ai/cordis |
| 上游包名 | cordis |
| 上游仓库 | https://github.com/cordiverse/cordis |
| 上游版本 | 4.0.0-rc.12 |
| 上游 Commit | 01b396240ce47cf2779c40af9bc445bb748fe112 |

vendor manifest 还记录了其他 Cordis 相关包，例如 Loader、Include、HMR 等。

这能够证明：**DeepSeek Harness 的直接代码来源是 Cordis 上游仓库，并且官方通过固定版本和 Commit 管理 vendored 源码。**

它不能单独证明 DeepSeek 团队最初为什么选择 Cordis，也不能证明他们研究过哪一篇 Koishi 文章。

## 3. Cordis 与 Koishi 的历史关系

Koishi 官方历史资料显示：

- Koishi 的开发始于 2019 年；
- Koishi v1 在 2020 年发布，已经使用插件系统和事件模型；
- 后续版本逐步加入生命周期、热重载和 Service；
- Koishi 4.7.1 的官方发布记录明确宣布发布新的核心包 Cordis，作为 Koishi 的底层框架，提供上下文、插件系统和事件模型。

这说明 Cordis 的发展与 Koishi 项目有直接历史联系。

Koishi 官方设计文章《Disposable Plugin System》进一步解释了可逆插件系统的设计问题：

- 插件注册资源后，需要能够清理；
- 如果没有对应卸载 API，复杂系统容易留下无法回收的资源；
- 插件依赖应由依赖关系表达，而不是依赖手工加载顺序；
- 可逆性有助于热重载、替换组件和资源追踪。

这篇文章是理解 Cordis 设计背景的重要一手资料。

但它的证据用途是解释 Koishi / Cordis 生态的设计思想，不是证明 DeepSeek 团队在开发 Harness 时参考了这篇文章。

## 4. 三个不同层次的判断

| 判断 | 证据 | 结论 |
|---|---|---|
| DeepSeek Harness 使用 Cordis | DeepSeek 官方架构文档、源码和 vendor manifest | 可以确认 |
| DSH vendored Cordis 来自 cordiverse/cordis | vendor manifest 记录上游仓库、版本和 Commit | 可以确认 |
| Cordis 与 Koishi 有历史联系 | Koishi 官方历史、4.7.1 发布记录、Cordis 官方设计文章 | 可以确认 |
| DeepSeek 官方明确说“参考 Koishi” | 本次核查的官方产品页、架构文档、Cordis 文档和 vendor manifest 未发现直接声明 | 不能确认 |
| DeepSeek 团队内部选择 Cordis 的完整决策过程 | 没有找到公开的完整决策记录 | 不应推断 |

## 5. 建议在其他文档中如何表述？

可以写：

> DeepSeek Harness 使用的 Cordis 直接来自 cordiverse/cordis，DeepSeek 官方 vendor manifest 记录了上游版本和 Commit。Cordis 与 Koishi 项目有明确的历史联系，Koishi 官方资料可以帮助理解其可逆插件系统的设计背景。但目前没有直接证据证明 DeepSeek 官方明确声明参考了 Koishi。

不应该写：

- DeepSeek 官方确认参考了 Koishi；
- DeepSeek 按照 Koishi 的设计文档实现 Harness；
- DeepSeek 采用 Cordis 的具体内部原因就是 Koishi 的某项设计。

这些说法超出了现有证据。

## 6. 本篇应掌握的结论

**代码来源、历史关系和设计影响是三个不同的问题。**

- vendor manifest 证明直接代码来源；
- Koishi 官方资料解释 Cordis 的历史与设计背景；
- DeepSeek 的设计动机必须有 DeepSeek 自己的直接证据。

没有直接证据时，应保留“待考察”，而不是用合理推测补齐故事。

## 7. 一手资料

- [DeepSeek Harness vendor/README.md（固定快照）](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/README.md)
- [Cordis 上游仓库](https://github.com/cordiverse/cordis)
- [Koishi 官方 History](https://koishi.chat/en-US/about/history)
- [Koishi 4.7.1 发布记录](https://github.com/koishijs/koishi/discussions/691)
- [Koishi 官方设计文章：Disposable Plugin System](https://koishi.chat/en-US/cookbook/design/disposable)

**下一篇：** [10｜术语表与参考资料](./10-glossary-and-source-register.md)，集中核对术语、来源和版本基线。
