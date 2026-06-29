# AGENTS.md

## 项目身份
- 类型：HLTV MCP 服务 Go 全栈
- 目标：Go 单二进制，MCP stdio + HTTP REST + React 管理面板
- 技术栈：Go 1.26, mark3labs/mcp-go, chi, goquery, uTLS (refraction-networking/utls v1.8.2 HelloIOS_Auto), React 19, React Router 7, Vite 8, chart.js, 自研设计系统 CSS tokens (Rajdhani/Inter/JetBrains Mono)
- 远端仓库：[ArcDent/HLTV-data](https://github.com/ArcDent/HLTV-data)

## 项目静态结构
```
├── main.go                  # MCP stdio + HTTP :8082 双 goroutine + graceful shutdown
├── Dockerfile               # 三阶段：node:22-alpine → golang:1.26-alpine → alpine:latest
├── .dockerignore            # 排除 node_modules/dist/binary/.git/docs/.superpowers
├── internal/
│   ├── types/               # 共享类型 + ToolError + 统一错误码常量
│   ├── config/              # 环境变量配置
│   ├── crypto/              # AES-256-GCM 加解密
│   ├── cache/               # TTL + stale + 并发合并
│   ├── client/              # HTTP + Firecrawl 客户端
│   │   ├── client.go        # FetchHTML (uTLS + retry + 统一错误码, doOnce 修 defer 泄漏)
│   │   └── transport.go     # uTLS transport builder (iOS Safari 指纹 + http2 DialTLSContext)
│   ├── scraper/             # fetchDoc + searchHLTV 共享 + 7 爬虫模块 + rankings
│   ├── localization/        # 26 队伍 + 98 选手中英映射
│   ├── normalizer/          # HLTV HTML → 标准化类型
│   ├── facade/              # 核心编排层（三层回退）+ CompareTeams
│   ├── summary/             # 中文摘要
│   ├── renderer/            # 中文格式化 MCP 输出（包级函数）
│   ├── mcp/                 # 9 MCP 工具
│   ├── http/                # chi router + REST API + SSE + SPA fallback
│   ├── storage/             # SQLite 持久化（migration + Store + CRUD）
│   └── translator/          # LLM 翻译（OpenAI 兼容 API）
├── frontend/                # React 19 + Vite 8 + 自研设计系统
│   └── src/
│       ├── api/client.ts    # API 客户端
│       ├── styles/          # tokens + base + components + animations (设计系统)
│       ├── components/      # TopBar, SubNav, Hamburger, Card, Badge, StatCard, EmptyState, LoadingSpinner, Drawer
│       ├── utils/cn.ts      # classname 合并
│       └── pages/           # Homepage, Matches, Teams, Players, News, Settings, PlayerDetail, TeamDetail, TeamComparison, NewsDetail
```

## 最近操作
- 2026-06-30：Docker 黑盒测试通过 — chrome-devtools 验证 5 主页面（首页/赛程/队伍/选手/新闻）+ 新闻详情交互；API 全 200（events/news/realtime/rankings/nicknames/translate/config/news/article）；Lighthouse 首页 a11y 93 / Best Practices 81 / SEO 82；performance trace LCP 868ms / CLS 0.02
- 2026-06-29：uTLS 重构完成 — transport.go (HelloIOS_Auto 指纹 + http2 自定义 DialTLSContext + iOS Safari UA) + client.go FetchHTML (retry + 统一错误码, doOnce 修复 defer 泄漏) + types.go 统一错误码 (NETWORK/READ/CHALLENGE/NOT_FOUND/SERVER/UNAVAILABLE + Retryable bool) + CF 检测签名 (Just a moment / cf-browser-verify / Attention Required / Enable JavaScript...)
- 2026-06-29：前端重设计完成 — Esports 暗色设计系统 (#0d1117 / #ff4655) 4 个 CSS 文件 + 9 组件 + 10 页面重写 + chart.js 雷达图 (PlayerDetail) + 移动端汉堡菜单 + /cache 路由移除 + Dashboard/Cache/legacy.css 删除
- 2026-06-29：Docker 构建修复 — npm ci 因 @emnapi 跨平台 optionalDependency lock 不匹配失败（Windows npm 11 lock 缺 linux 平台条目，alpine npm 10 期望）→ Dockerfile 改 `npm install --no-audit --no-fund`（不严格校验 lock，自动拉 linux 平台依赖）
- 2026-05-31：README.md 全面重写 — MaiCLI 风格，ASCII Logo + 徽章 + 8 章节结构；代码瘦身收敛 + 翻译长效化存储

## 关键发现

### uTLS + 统一错误码（2026-06-29）
- uTLS HelloIOS_Auto 指纹绕过 Cloudflare 浏览器挑战；http2.Transport 自定义 DialTLSContext 注入 uTLS 连接
- 统一错误码：NETWORK/READ/CHALLENGE/NOT_FOUND/SERVER/UNAVAILABLE，ToolError.Retryable bool 区分可重试
- CF 检测签名：`Just a moment` / `cf-browser-verify` / `Attention Required` / `Enable JavaScript and cookies to continue`（移除裸 `Cloudflare` 避免误判）
- FetchHTML 用 doOnce 闭包修复 defer 在 retry 循环中的资源泄漏

### Docker npm ci 跨平台坑（2026-06-29）
- @emnapi 是 WASM threads 后端包的 transitive optionalDependency，Windows npm 11 生成的 lock 缺 linux 平台条目
- alpine npm 10 的 `npm ci` 严格校验 lock 完整性 → 缺 @emnapi 报错
- 修复：Dockerfile 用 `npm install --no-audit --no-fund` 替代 `npm ci`（不严格校验 lock，自动解析平台 optional deps）
- 根因：本地 Windows 开发与 Docker linux 构建的 npm 版本 + 平台 optionalDependency lock 完整性差异

### 前端性能基线（2026-06-30 黑盒测试）
- 首页 LCP 868ms (TTFB 7ms, render delay 861ms) / CLS 0.02 — 良好
- JS bundle 501kB (>500kB 警告) — Cache insight 提示未长缓存，浪费 509.2kB；后续可 code-split 优化
- 搜索框缺 id/name（a11y issue，Lighthouse a11y 93 扣分项）
- 翻译器 KISS-Translator 正常加载（控制台 INFO）

### JSON 标签强制要求（2026-05-31 踩坑）
- Go `encoding/json` 对驼峰下划线混合字段匹配不可靠：`provider_url` 无法匹配 `ProviderURL`（`providerurl` ≠ `provider_url`），但 `model` 能匹配 `Model`
- 所有用于 JSON 编解码的结构体必须加 `json:"snake_case"` 标签，不可依赖默认匹配

### 代码收敛原则（2026-05-31）
- 不导出仅包内使用的符号（EventGroup/EventsResponse/TranslatePlaceholder 等）
- 空 struct 仅用于持有方法 = 应转为包级函数
- 两个 Search 函数结构相同仅差类型 = 提取通用 searchHLTV
- 仅测试调用的函数 = 死代码，删除并用公开 API 重写测试

### HLTV HTML 选择器（核心参考）
- **选手页**: `.playerNickname` / `.playerRealname` / `.playerTeam a[itemprop="text"]` / `.player-stat` > `.statsVal p b`(能力值) / `.stats-window`(maps数) / `.playerpage-matchbox`(近期比赛) / `.playerpage-match-result`(比分) / `.playerpage-match-date` / `.majorWinner b`(Major冠军数) / `.mvp-count`(MVP数) / `.all-time-stat` > `.stat` + `.description`(生涯战斗统计，旧版) / `.highlighted-stat` > `.stat` + `.description`(生涯概览，新版通用)
- **队伍页**: `h1.profile-team-name` / `.value.h-rank` / `.bodyshot-team a[href*='/player/']`(队员) / `.trophySection .trophyDescription[title]` / `.highlighted-stat`(胜率/连胜)
- **比赛链接**: `.playerpage-matchbox[href]` 正则 `/stats/matches/(\d+)/([^"\s]+)`
- **赛果**: `.result-con` > `.line-align.team1 .team` / `.result-score` / `.event-name`
- **赛程**: `.matches-list-section` > `.match-wrapper`(比赛容器，每场比赛唯一) > `.match`(可能嵌套两层) / `.match-team.team1/team2 .match-teamname`(队名) / `.match-event`(赛事名) / `.match-info`(时间/boN) / `.match-no-info`(无队伍时的占位描述)；`data-match-id` 属性获取比赛 ID；`.match-wrapper` 的 `team1`/`team2` 属性在队伍未定时为空
- **新闻**: `.newstext` / `.news-block p`(正文) — 不可用 `.Text()` 取整个容器
- **搜索**: `table tbody tr > a[href*='/player/']` 正则 `/player/(\d+)/(.+)`

### CF 分层
- **HTTP 直连可用**：`/player/`、`/team/`、`/search`、`/news/`
- **Firecrawl 回退**：`/matches`（HTTP 403 时自动回退，需 `FIRECRAWL_API_KEY`）
- **被 Cloudflare 封锁 (403)**：`/matches`、`/results`、`/`

### 三层回退 (Cache -> SQLite -> HLTV)
- **Type A**（player/team/news article detail）：`GetXxxCached` 方法内联三层逻辑，Tier 2 命中后后台 goroutine `refreshXxx` 更新缓存，调用 `broadcast` 推送 SSE 事件
- **Type B**（matches/events/news lists）：通过 `withCacheOrStore` 方法，Tier 1 检查缓存（含 stale），Tier 2 查询 SQLite（命中则回缓存 + 后台 `RunOnce` 刷新），Tier 3 直接爬取并存库
- `scrapeXxx` 辅助方法执行实际抓取并写入 SQLite（nil-store 安全）
- `store *storage.Store` 为 nil 时自动降级为 Cache-only 模式
- `notify` 回调桥接 facade -> SSEHub.Broadcast，用于前端实时刷新

### 缓存模式
- `PlayerDetail`/`TeamDetail`/`NewsArticle` 走三层回退 Type A，`withCacheOrStore` 用于 Type B
- `sync/atomic.Int64` 计数器，与 `sync/RWMutex` 无锁竞争

### nickname 覆盖层
- `internal/localization/overrides.go`：线程安全内存缓存 + JSON 持久化
- 空值语义 = 删除条目；写操作先更新内存再写磁盘
- API：`PUT /api/nicknames/team` 尝试解析 canonical（目录内队伍），否则直接按原始名称存储；`PUT /api/nicknames/player` 直接存储
- `BuildFullDict` 对目录队伍做别名展开 + 所有 override 添加直接 key-value 映射（确保非目录队伍昵称出现在赛程页面）

### React Router 路由切换
- 不同路由渲染同一组件类型时，React reconciliation 复用实例不重新挂载，内部 state 保留
- 修复方式：给组件添加 `key` 区分不同路由实例

### Go embed + Vite
- `//go:embed dist` 递归包含整个 dist 目录（含 `dist/assets/`）
- Vite build 将 JS/CSS 放在 `dist/assets/`，index.html 引用它们；outDir '../dist'

### 错误处理
- `ToolError` 直接实现 `error` 接口，删除独立的 `internal/errors` 包
- 错误创建直接 `&types.ToolError{Code: "...", Message: "..."}`

### 部署
- Docker 三阶段构建 → `ghcr.io/arcdent/hltv-data:latest`（alpine 基础镜像，~15MB binary）
- CI/CD：push main → GitHub Actions 自动构建
- 前端变更需 `vite build` + `go build` + 重启服务
- 本地测试镜像：`hltv-data:test`，`docker run -d -p 8082:8082 --name hltv-test hltv-data:test`

### 资源管理
- `Store.Close()` 在 graceful shutdown 中调用，停止 cleanup loop 并关闭 SQLite
- store 为 nil（降级模式）时跳过 Close

## 下一步
- 部署新镜像（含 uTLS 重构 + 前端重设计）到 ghcr.io，验证翻译长效化 + uTLS 抗 CF
- 前端优化：JS bundle code-split（>500kB 警告）、搜索框加 id/name 提升 a11y
- 考虑为 /results 页面也添加 Firecrawl 回退

## 进行中
- 无
