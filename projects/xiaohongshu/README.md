# 小红书运营项目

- 更新日期：2026-11-28
- 当前账号名称：**Hardy的AI折腾记**（缩短方案待讨论，未改名）
- 账号简介：见 [00 账号定位](00-account/README.md)
- 当前定位：**以 AI 应用为导向，把值得了解的 AI 技术讲明白**
- 当前阶段：AI 做 PPT 首个专题已确定；真实任务为 DeepSeek Harness 的 Everything is a Plugin 技术分享。阶段 A 问题地图、阶段 B Cordis Runtime/Loader 源码与测试静态审查已完成，下一步选择真实产品插件案例；研究通过后再做 HTML 原型和 Office PPTX。制作过程同步记录，PPT 验收后再筛选小红书笔记。
- 项目根目录：projects/xiaohongshu/

## 一、项目入口

1. [00 账号定位](00-account/README.md)：账号是谁、给谁看、名称与表达原则；
2. [冷启动准备度审计](00-account/launch-readiness-audit.md)：当前链路的实际状态和问题；
3. [01 平台研究](01-research/xiaohongshu-beginner-guide.md)：通用学习资料，作为参考；
4. [选题发现、专题研究与内容制作工作流](01-research/topic-discovery-and-content-workflow.md)：从外部信号到发布复盘的核心 SOP；
5. [首轮选题发现计划](01-research/first-round-topic-discovery-plan.md)：需求发现、实践发现、问题发现三条搜索路径及 12 个搜索种子；
6. [AI 做 PPT 专题研究](01-research/ai-ppt-series.md)：首个真实任务、双成果关系、28 个候选笔记标题和通用经验提取原则；
7. [Everything is a Plugin 实践任务书](04-series/AI-PPT-001-everything-is-plugin/brief.md)：本次技术分享的范围、研究问题和 HTML→PPTX 制作路线；
8. [阶段 A 研究问题地图](04-series/AI-PPT-001-everything-is-plugin/00-stage-a-research-map.md)：官方资料、概念边界、源码/测试入口；
9. [阶段 B 研究笔记](04-series/AI-PPT-001-everything-is-plugin/03-research-notes.md)：Cordis Runtime、Service/inject、Effect、Event、Loader 与测试证据；
10. [02 外部素材管理](02-sources/README.md)：OpenCLI、平台讨论、官方文档和来源记录；
11. [日常里的 AI](03-themes/ai-practice/README.md)：内容方向说明；
12. [候选选题池](03-themes/ai-practice/topic-backlog.md)：经过拆解、去重和初步判断的候选选题；
13. [真实应用案例池](03-themes/ai-practice/ideas.md)：自己的实际尝试，不是外部帖子收藏夹；
14. [04 单篇内容制作](04-series/README.md)：研究、案例、脚本和素材；
15. [05 发布与复盘](05-published/README.md)：记录真实发布情况；
16. 06-assets/：账号视觉素材和可复用资源。

---

## 二、目录结构

~~~text
projects/xiaohongshu/
├── README.md
├── 00-account/
│   ├── README.md
│   └── launch-readiness-audit.md
├── 01-research/
│   ├── xiaohongshu-beginner-guide.md
│   ├── xhs-deconstruct-and-write.md
│   ├── topic-discovery-and-content-workflow.md
│   └── first-round-topic-discovery-plan.md
├── 02-sources/
│   ├── README.md
│   └── xhs/
│       ├── ai-agent/
│       └── ai-job/
├── 03-themes/
│   ├── ai-practice/
│   │   ├── README.md
│   │   ├── topic-backlog.md
│   │   └── ideas.md
│   └── ai-agent/
├── 04-series/
│   ├── README.md
│   ├── A-001-jd-pitfall/
│   └── AI-PPT-001-everything-is-plugin/
│       ├── brief.md
│       ├── 00-stage-a-research-map.md
│       ├── 01-stage-one-research-plan.md
│       └── 02-first-round-agent-task.md
├── 05-published/
└── 06-assets/
~~~

## 三、账号讲什么

账号不是只讲抽象原理、堆砌术语的枯燥技术号，也不是简单罗列 AI 工具的目录。

**内容以 AI 应用为导向，同时把值得了解的 AI 技术讲明白。** 可以从生活、工作、学习、兴趣中的问题出发，展示 AI 怎样帮忙；也可以从 Agent、MCP、模型、工作流等技术能力出发，用普通人听得懂的例子解释它是什么、为什么有用、怎样使用和有哪些限制。

AI 求职是目前已经探索的一个应用案例，不代表账号主线。现有素材保留，是否制作由真实证据和用户价值决定。

**离技术越近，就离用户越远。** 这句话提醒我们避免脱离场景的术语堆砌，不是反对讲技术。

## 四、目录职责

| 目录 | 回答的问题 | 放什么 | 不放什么 |
|---|---|---|---|
| 00-account | 这个账号是谁、给谁看 | 定位、简介、名称、表达原则 | 对标数据、脚本 |
| 01-research | 平台、选题和内容怎样研究 | 平台认知、采集与制作 SOP、拆解方法 | 原始帖子收藏 |
| 02-sources | 外部资料说了什么 | 帖子、评论、官方文档、来源信息和摘要 | 未经判断的发布选题 |
| 03-themes | 哪些选题值得考虑、自己有哪些案例 | 候选选题池、真实应用案例池 | 原始外部素材、成片 |
| 04-series | 这一篇具体怎么做 | 单篇 brief、research、case log、script、assets | 平台研究总则 |
| 05-published | 发出去之后怎么样 | 发布链接、真实数据、评论、复盘 | 草稿 |
| 06-assets | 哪些视觉东西可以复用 | 头像、横幅、贴纸、素材 | 选题决策 |

## 五、从发现到发布的工作链路

~~~text
需求发现 / 实践发现 / 问题发现（三条搜索路径）
  ↓
外部信号采集（OpenCLI 等）
  ↓
帖子拆解、需求信号提取
  ↓
聚类、去重、候选选题判断
  ↓
针对性专题研究
  ↓
选择或设计真实案例
  ↓
证据整理、确定单篇角度
  ↓
写作、视觉制作、事实审核
  ↓
真人发布、观察反馈
  ↓
评论和数据回流选题池
~~~

这是内部工作顺序，不是每篇公开笔记必须照抄的叙事模板。OpenCLI 负责有限只读采集，不替我们判断选题，也不用于自动运营账号。

## 六、选题发现的当前执行方法

首轮不预设 Excel、Agent、视频或其他应用为账号主线，也不把搜索路径当成固定栏目。先沿三条路径寻找真实任务：

- **需求发现：** 用户想让 AI 帮忙完成什么；
- **实践发现：** 别人已经用 AI 做成了什么；
- **问题发现：** 使用 AI 时有哪些失败、限制和未解决的问题。

具体 12 个搜索种子、采集边界和后续筛选方法见[首轮选题发现计划](01-research/first-round-topic-discovery-plan.md)。选题必须进一步落到具体任务、输入和最终交付物；先确定任务，再决定直接模型、现有软件功能、脚本、API 或 Agent 是否合适。

## 七、当前状态

| 环节 | 状态 | 说明 |
|---|---|---|
| 账号 | 基本完成 | 现用名称和简介已确定；名称缩短方案待讨论 |
| 内容定位 | 已明确 | AI 应用为导向，技术解释通俗易懂；不限定行业和场景 |
| 平台研究 | 已有资料 | 通用方法可参考，不把第三方经验当硬性规则 |
| 外部素材 | A2 和 B1 已试跑 | B1 横比三条查询、30 条不同笔记，优先选 AI 做 PPT。 [热度筛选](02-sources/xhs/b1-heat-screen-2026-11-28.md) |
| 候选选题 | 首个专题已确定具体任务 | AI 做 PPT 的真实任务确定为 DeepSeek Harness 的 Everything is a Plugin 技术分享；28 个标题是候选笔记池，不是发布配额。 [AI 做 PPT 专题](01-research/ai-ppt-series.md) |
| 真实案例 | 有一个求职案例 | 需核验真实效果；不是主线或默认首发 |
| 单篇制作 | 阶段 A、B 已完成 | [AI-PPT-001：Everything is a Plugin](04-series/AI-PPT-001-everything-is-plugin/brief.md)；已完成问题地图及 Cordis Runtime/Loader 静态研究，真实插件案例待追踪。HTML 原型和 Office PPTX 尚未开始。A-001 保留，是否制作待重新判断 |
| 发布与复盘 | 入口已建立 | 尚无真实发布数据 |
| 视觉素材 | 部分完成 | 新头像、横幅和贴纸待同步归档 |

## 八、维护规则

- 不预先设定固定栏目、内容比例或月度排期；
- 不要求每篇内容使用相同标题、开头、叙事结构或封面模板；
- 不为了填满选题池而制造未经验证的方向；
- 不把一个具体案例误当成账号主线；
- 外部帖子提供需求信号，不直接替代自己的实践和事实核验；
- 不把想法写成已验证体验，不编造效果和数据；
- 只在 test 分支继续更新，未经用户明确授权不合并到 main。

## 九、更新记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-11-25 | 建立小红书运营项目 | 将账号运营资料独立管理 |
| 2026-11-26 | 建立 AI Agent/AI 求职对标和 JD 草稿 | 先探索一个具体 AI 应用场景 |
| 2026-11-27 | 更新账号简介、视觉方向和内容档案 | 明确账号的个人表达 |
| 2026-11-27 | 修正为 AI 应用导向、技术通俗解释；取消固定内容线、比例和模板 | 避免将账号窄化为技术号或单一应用账号 |
| 2026-11-27 | 建立从外部信号、候选选题、研究、案例到写作的工作流 | 补齐内容生产链路 |
| 2026-11-27 | 增加三条发现路径和首轮 12 个搜索种子 | 从用户任务发现选题，不预设固定栏目或单一应用场景 |
| 2026-11-28 | 完成 A2 小红书试跑 | 保留回查原文的候补，首篇优先寻找热度证据更强的应用 |
| 2026-11-28 | 完成 B1 热度筛选 | 三个方向中 AI 做 PPT 获得最清楚的近期互动信号 |
| 2026-11-28 | 深化 AI 做 PPT 专题 | 补查实际需求，覆盖多种展示场景、初稿生成、内容表达、页面衔接及图文交付 |
| 2026-11-28 | 确定 Everything is a Plugin 技术分享为首个真实 PPT 任务 | 先完成专业技术分享，制作过程同步记录，之后将具体经验提炼为可迁移到业绩汇报、项目汇报和培训等场景的小红书笔记 |
| 2026-11-28 | 完成 AI-PPT-001 阶段 A 研究问题地图 | 核验官方固定版本，扩展资料地图，明确 Cordis Runtime、Loader、产品能力 seam 和真实插件的后续研究入口 |
| 2026-11-28 | 完成 AI-PPT-001 阶段 B 源码与测试静态审查 | 追踪 Cordis Plugin/Fiber/Service/inject/Effect/Event 与 Loader Entry，记录真实测试断言和未执行的运行验证边界 |
