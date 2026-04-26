# PRD：HackerNews CN（HN 中文镜像 + 中英切换）

## 1. 背景与目标

### 1.1 背景
- 数据源来自 Hacker News 官方 Firebase API（只读）。
- 本站提供 **中文阅读体验**（含评论翻译），并可 **随时切换英文原文**。

### 1.2 本期目标（v1）
- **列表页**：Top / New / Best / Ask / Show / Jobs 六个榜单浏览，分页展示。
- **详情页**：展示 story（标题、外链、元信息、正文）+ 完整评论树。
- **中英切换**：全站一键切换语言，URL 带语言前缀（`/zh`、`/en`）。
- **翻译缓存**：翻译结果落库（PostgreSQL），避免重复翻译与成本失控。
- **定时更新**：按固定周期同步榜单与内容，增量翻译。
- **部署**：Vercel。

### 1.3 非目标（v1 不做）
- 站内登录/注册/发帖/评论（HN API 不支持写入；站内社区功能留到 v2）。
- 站内搜索（v2）。
- 实时推送（WebSocket/SSE 全量实时）——本期用定时更新 + ISR。
- 多语言（除 zh/en 外）。

## 2. 技术栈（强制）

| 领域 | 选型 |
|---|---|
| 前端/全栈框架 | Next.js（App Router）+ TypeScript |
| UI 组件 | shadcn/ui（Radix + Tailwind） |
| 图标 | lucide-react |
| 数据库 | PostgreSQL |
| ORM | Drizzle ORM（推荐；若团队习惯 Prisma 也可，但需考虑 serverless 连接策略） |
| 翻译 | DashScope `qwen-mt-plus` |
| 数据源 | HN Firebase API：`https://hacker-news.firebaseio.com/v0/` |
| 定时任务 | Vercel Cron Jobs |
| 部署 | Vercel |
| 包管理 | pnpm |
| 规范 | ESLint + Prettier + TS strict |

## 3. 用户故事

- 作为用户，我想在中文页面快速浏览 HN 热门内容（标题/摘要/分数/评论数）。
- 作为用户，我想点进某条 story 看到中文正文与中文评论树。
- 作为用户，我想随时切换回英文原文核对翻译（单条评论也能查看原文）。
- 作为用户，我不希望页面因为“翻译中”而白屏卡死（至少能先看到原文/占位）。

## 4. 信息架构与路由（i18n）

### 4.1 语言路由（强制）
- 统一使用语言前缀：`/[lang]/...`，其中 `lang ∈ { zh, en }`。
- `/` 入口：根据 cookie `lang`（优先）或 `Accept-Language` 重定向到 `/zh` 或 `/en`。
- 切换语言：替换 URL 的 `[lang]` 段并写 cookie（默认有效期 180 天）。
- SEO：输出 `hreflang="zh-CN"` 与 `hreflang="en"` 的 alternate link。

### 4.2 页面清单（v1）
- `/{lang}/top?p=1`
- `/{lang}/new?p=1`
- `/{lang}/best?p=1`
- `/{lang}/ask?p=1`
- `/{lang}/show?p=1`
- `/{lang}/jobs?p=1`
- `/{lang}/item/{id}`：详情页 + 评论树
- `/{lang}/user/{username}`：用户页（只读）

## 5. 数据源（HN API）与约束

### 5.1 API 端点
基地址：`https://hacker-news.firebaseio.com/v0/`

- 榜单（返回 id 数组）：
  - `/topstories.json`
  - `/newstories.json`
  - `/beststories.json`
  - `/askstories.json`
  - `/showstories.json`
  - `/jobstories.json`
- 单条 item：
  - `/item/{id}.json`（story/comment/job/poll/pollopt）
- 用户：
  - `/user/{id}.json`

### 5.2 关键约束（必须按 HN 的数据结构适配）
- 榜单只给 id：需要自行批量拉 item。
- 评论树通过 `kids` 递归：需要逐层拉取并构建树。
- `title` / `text` 为 HTML：渲染与翻译均必须考虑 HTML 结构与 XSS。

## 6. 核心策略：翻译与缓存

### 6.1 核心原则
- **英文永远可用**：即使中文翻译缺失/失败，也必须能渲染英文原文（或至少标题/骨架）。
- **翻译必须可失效**：HN 内容可能被编辑/标记 dead/deleted；旧翻译不能长期“假正确”。
- **禁止整段 HTML 直接喂给模型**：必须解析 HTML，仅翻译可见文本节点（跳过 `pre/code`）。

### 6.2 翻译缓存有效性（source_hash）
- 对每条 item 计算 `source_hash = sha256(title || text_html)`。
- `translations.source_hash` 必须等于 `items.source_hash` 才视为有效；不相等则视为过期需重译。

### 6.3 分层翻译（控制成本）
- Tier 1（预翻）：榜单前 30 条 story 的 **title**（中文首屏体验）。
- Tier 2（懒翻）：用户访问详情页时，对 story 正文 + 当前可见评论批量翻译并落库。
- Tier 3（后台预翻，可选）：高热度 story（如 score/评论数阈值）预翻评论更深层。

## 7. 数据模型（PostgreSQL）

> 说明：字段名可按 ORM 习惯调整；以下为必须覆盖的语义与索引建议。

### 7.1 items（HN item 镜像）
- `id` (PK, int)
- `type` (text)：`story|comment|job|poll|pollopt`
- `by` (text), `time` (bigint)
- `parent` (int, nullable)：comment 的 parent
- `story_id` (int, nullable)：comment 所属根 story id（冗余加速查询）
- `kids` (jsonb)：int[]
- `url` (text, nullable), `score` (int, nullable)
- `title` (text, nullable)
- `text_html` (text, nullable)：原文 HTML（HN 的 `text`）
- `descendants` (int, nullable)
- `source_hash` (text, not null)
- `deleted` (bool), `dead` (bool)
- `fetched_at` (timestamptz)

索引建议：
- `index(items.type, items.time desc)`
- `index(items.parent)`
- `index(items.story_id)`

### 7.2 translations（翻译缓存）
- `item_id` (int)
- `lang` (text)：`zh`（预留扩展）
- `source_hash` (text)
- `title_translated` (text, nullable)
- `text_translated_html` (text, nullable)
- `model` (text)：固定 `qwen-mt-plus`
- `translated_at` (timestamptz)
- `PRIMARY KEY (item_id, lang)`

### 7.3 lists（榜单快照）
- `name` (text PK)：`top|new|best|ask|show|job`
- `ids` (jsonb)：int[]
- `updated_at` (timestamptz)

### 7.4 translation_jobs（用 Postgres 当队列）
- `id` (bigserial PK)
- `item_id` (int)
- `lang` (text)
- `priority` (int)：1=榜单预翻标题，2=用户访问懒翻，3=后台预翻
- `status` (text)：`pending|processing|done|failed`
- `attempts` (int default 0)
- `last_error` (text nullable)
- `created_at`, `started_at`, `finished_at` (timestamptz)

并发安全：
- worker 拉任务必须使用 `FOR UPDATE SKIP LOCKED`，避免多实例重复处理。

去重建议：
- 对 `(item_id, lang)` 建唯一约束（至少保证 `pending/processing` 不重复）。

### 7.5 phrase_cache（可选但强烈推荐，用于短句去重省钱）
- `text_hash` (text) + `lang` (text) 作为联合主键
- `translation` (text)
- `hits` (int)
- `updated_at` (timestamptz)

## 8. 定时更新（Vercel Cron）

### 8.1 Cron 任务
建议三条 cron（频率可按成本/效果调优）：
- `/api/cron/sync-lists`：每 6 小时同步榜单 id 列表
- `/api/cron/sync-items`：每小时补齐/刷新榜单相关 item 详情
- `/api/cron/translate-pending`：每小时消费翻译队列

鉴权：
- 所有 `/api/cron/*` 必须校验 `Authorization: Bearer ${CRON_SECRET}`。

### 8.2 sync-lists 行为
- 拉取 6 个榜单 ids，写入 `lists`（覆盖更新）。
- 对每个榜单前 30 条 story：若 items 缺失则拉取 `/item/{id}` 入库。
- 为榜单前 30 条 story 创建 `translation_jobs(lang='zh', priority=1)`（仅 title 翻译）。

### 8.3 sync-items 行为
- 对榜单中的 story 做“刷新”（如 `fetched_at` 超过 30 分钟则重拉）。
- 对 story 的 `kids` 评论按需补拉（优先 top-level kids；深层按访问触发）。
- 单次任务限制处理数量（例如 ≤200 items），并发限制（例如 20）。

### 8.4 translate-pending 行为
- 取 `pending` 的任务按 `priority desc, created_at asc` 消费，批量处理（例如 ≤50 jobs）。
- 翻译成功：写入 `translations` 并标记 job done。
- 翻译失败：`attempts+1`，记录 `last_error`；超过 3 次标记 failed，页面降级显示英文。

## 9. 翻译实现细节（qwen-mt-plus）

### 9.1 调用约束
- 使用 DashScope API Key：`DASHSCOPE_API_KEY`
- 模型：`qwen-mt-plus`
- 需要限流与重试（指数退避，最多 3 次）

### 9.2 HTML 翻译（强制流程）
1. 解析 `text_html`（例如使用 parse5）
2. 遍历 DOM：
   - 仅抽取 **可见文本节点**
   - 跳过 `pre` / `code`（代码块不翻）
3. 对抽取的文本片段批量翻译（优先短句 cache 命中）
4. 把翻译写回原 DOM 文本节点，序列化为 HTML
5. 产出 HTML 必须 sanitize（建议 DOMPurify）后再渲染/落库

### 9.3 “查看原文”
- story 与每条 comment 的中文块都提供 “查看原文” 控件（Popover/Collapsible）。
- 该控件直接展示 `items.text_html`（同样 sanitize）。

## 10. UI/交互规范（shadcn + lucide）

### 10.1 列表页（Top/New/Best/Ask/Show/Jobs）
- 行结构：
  - 第一行：序号 + 标题（外链）+ 域名
  - 第二行：`score points by {user} {time} | {comments}`
- 分页：每页 30 条，`?p=`；仅需 prev/next。

### 10.2 详情页（item）
- 顶部 story 卡片：标题、外链、by、时间、score、评论数
- 评论树：
  - 深度 > 3 默认折叠
  - 超过 200 条评论分页/分块渲染（避免 OOM）

### 10.3 语言切换
- 顶栏右侧 Toggle：`中 / EN`
- 切换保持当前路径与查询参数（只替换 lang 段）
- 写 cookie `lang`

### 10.4 图标（lucide）
建议使用：
- `Languages`：语言切换
- `ExternalLink`：外链跳转
- `ChevronRight/ChevronDown`：评论折叠/展开
- `Eye`：查看原文

## 11. 安全与合规

- **XSS 防护**：HN 的 `text` 为 HTML，翻译后同样是 HTML，必须 sanitize。
- 外链统一 `rel="noopener noreferrer nofollow"`。
- 保留 “View on HN” 链接到 `news.ycombinator.com/item?id=...`（透明与可验证）。
- HN API 请求设置明确 `User-Agent`（例如 `HackerNews-CN/1.0 (+https://your-domain)`）。

## 12. 性能与缓存（Vercel）

- 列表页：ISR `revalidate = 60`（可调）
- 详情页：ISR `revalidate = 120`（可调）
- 数据获取：
  - 榜单 ids 优先读 `lists` 表（而不是每次打 HN API）
  - item 详情优先读 `items` 表，缺失再回源 HN
- 冷翻译不阻塞首屏：
  - 中文缺失时先渲染英文 + “翻译中…”
  - 后台入队翻译，后续刷新/二次访问命中缓存

## 13. 环境变量

```
DATABASE_URL=postgres://...
DASHSCOPE_API_KEY=...
CRON_SECRET=...
HN_API_BASE=https://hacker-news.firebaseio.com/v0
NEXT_PUBLIC_SITE_URL=https://<your-domain>
```

## 14. 里程碑建议（MVP）

- Sprint 1：项目初始化（Next.js + shadcn + 路由骨架）+ 列表页英文
- Sprint 2：详情页英文 + 评论树递归/折叠
- Sprint 3：Postgres 接入（items/lists）+ cron 同步榜单
- Sprint 4：翻译管线（qwen-mt-plus + HTML 文本节点翻译 + translations 缓存）
- Sprint 5：中文/英文切换 + 查看原文 + UX 收尾

## 15. 验收标准（DoD）

- [ ] `/zh/top` 能看到中文标题列表（至少前 30）
- [ ] `/zh/item/{id}` 能看到中文正文与中文评论（深层可展开）
- [ ] 切换 `中/EN` URL 从 `/zh/...` 变 `/en/...`，内容随之变化
- [ ] 中文缺失不阻塞：至少能看到英文原文与翻译中占位
- [ ] Cron 生效：榜单与 items 会随时间更新（可在 DB 中观察 `updated_at/fetched_at`）
- [ ] 无重复翻译：同一条 item（同一 source_hash）不会被重复提交翻译
- [ ] HTML 渲染安全：所有 HTML 都被 sanitize

## 16. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| Vercel 函数超时 | cron 失败/不稳定 | 每次任务限量（items≤200、jobs≤50）+ 并发限制 |
| 翻译服务限流/失败 | 中文缺失 | 重试 + 队列 + 降级显示英文 |
| HTML 翻译破坏结构 | 渲染错乱/XSS | 强制 parse5 抽文本节点，不直翻 HTML；sanitize 双保险 |
| 评论量过大 | 渲染卡顿/内存爆 | 单页限制 200 + 分块/折叠策略 |
| 译文与原文不一致 | 用户不信任 | `source_hash` 失效机制 + “查看原文” |
