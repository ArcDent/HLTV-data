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
├── .dockerignore            # 排除 node_modules/dist/binary/.git/.superpowers
├── internal/
│   ├── types/               # 共享类型 + ToolError + 统一错误码常量
│   ├── config/              # 环境变量配置（CacheTTLTeam 300s / CacheTTLPlayerDetail 7天 等独立字段）
│   ├── crypto/              # AES-256-GCM 加解密
│   ├── cache/               # TTL + stale + 并发合并
│   ├── client/              # uTLS HTTP 客户端
│   │   ├── client.go        # FetchHTML (按 path 分流 transport: /stats/* 用 statsCli 桌面Chrome, 其他用 httpCli iOS Safari; doOnce 403 对 /stats/ 标 ErrChallenge+retryable:true, defer 泄漏已修)
│   │   └── transport.go     # newTransport(HelloIOS_Auto) + newStatsTransport(HelloChrome_Auto 桌面指纹) + UA 常量(iosUA/desktopChromeUA)
│   ├── scraper/             # fetchDoc + searchHLTV 共享 + 8 爬虫模块; rankings.go(.ranked-team.standard-box 选择器 + top30 截断); results.go(GetResultsByTeams 抓 /results?team=X&team=Y for H2H)
│   ├── localization/        # 26 队伍 + 98 选手中英映射
│   ├── normalizer/          # HLTV HTML → 标准化类型; match.go NormalizeMatches (Result 解析 score-won/score-loss class, team1 视角; 兼容 /results?team=X&team=Y 的 .team-cell .team1 .team 变体)
│   ├── facade/              # 核心编排层（三层回退）; CompareTeams (GetResultsByTeams+isDirectH2H+buildHeadToHead 主 H2H 源; buildComparison 仅组装 TeamA/TeamB); translateTitles[T] 泛型合并翻译
│   ├── summary/             # 中文摘要
│   ├── renderer/            # 中文格式化 MCP 输出（包级函数）
│   ├── mcp/                 # 9 MCP 工具
│   ├── http/                # chi router + REST API + SSE + SPA fallback; /api/cache GET/DELETE 在用
│   ├── storage/             # SQLite 持久化（migration + Store + CRUD）
│   └── translator/          # LLM 翻译（OpenAI 兼容 API）
├── frontend/                # React 19 + Vite 8 + 自研设计系统
│   └── src/
│       ├── api/client.ts    # API 客户端（cacheStats/clearCache 调 /cache）
│       ├── styles/          # tokens + base + components + animations (设计系统)
│       ├── components/      # TopBar, SubNav, Hamburger, Card, Badge, StatCard, EmptyState, LoadingSpinner, Drawer
│       ├── utils/cn.ts      # classname 合并
│       └── pages/           # Homepage, Matches, Teams, Players, News, Settings, PlayerDetail, TeamDetail, TeamComparison, NewsDetail
```
注：docs/ 已清空（utls-bypass 孤儿文档 + superpowers 过程文档全删，契约源为本文件 + 代码）。

## 最近操作
- 2026-07-01：归档新闻 link 重复 Bug 修复 + 代码收敛 — 用户反馈"点击归档新闻详情反复出现同一个新闻界面"。systematic-debugging Phase 1 根因：NormalizeNews 用 `s.Parent().Find("a").First()` 取 link，但 HLTV 归档结构是 `<a class="newsline article">` 包裹自身 `.newstext`（a 不能嵌套 a → Find 返回空），fallback `s.Parent().Parent().Find("a").Attr("href")` 取共享容器第一个 a 的 href → 所有归档新闻 link 都 = 第一条。firecrawl 抓真实 HLTV HTML 确认结构。Phase 4 修复：改 `s.Closest("a").Attr("href")` 单行取 item 自身 a 的 href，删错误 fallback；normalizer_test.go 补真实归档 HTML 结构断言 items[1].Link ≠ items[0].Link（原测试只断言 title、从未覆盖 link 提取，bug 漏网）。收敛：useSSE.ts 重写——callback 存 useRef（effect 仅依赖 [entity]，不再每次渲染重注册监听器）+ 删无调用者的通配符 `'*'` 监听死代码 + 删冗余 JSDoc；News.tsx/Matches.tsx useSSE 调用去内联箭头函数包装，直接传 useCallback 引用 `useSSE('news', fetchNews)`。验证：normalizer go test 通过；Docker 镜像 hltv-data:test 重建 + 容器 hltv-test 重启 :8082；/api/health ok；/api/news?limit=30 返回 30 items / 30 unique links / 无重复（store news 表 0 行无旧错误数据遮蔽，scrape 直走修复后 normalizer）。未提交（含 6 internal/*.go logo 链路 + 5 frontend tsx + TeamLogo.tsx + 本次 news.go/normalizer_test.go/useSSE.ts/News.tsx/Matches.tsx）
- 2026-06-30：队标显示根因诊断 + 创建项目级 .claude/CLAUDE.md — 用户反馈"队标没正常显示"。systematic-debugging 证据链：(1) `/api/teams/6667` 响应 profile 无 logo 字段；(2) DB schema_version=3 + teams.logo 列存在，但 teams 表 0 行（FaZe 数据来自实时 scrape）；(3) `docker exec grep` 二进制 night-only/teamplaceholder/pickLogoURL/profile-team-logo-container 全为 0 → 运行中容器 hltv-test 用 15:37 旧镜像 hltv-data:test，不含晚于 15:37 写入的 logo 代码（6 internal/*.go + 5 frontend tsx + TeamLogo.tsx 全未提交，`git diff HEAD --stat` 130 insertions）；(4) schema_version=3 系 prior session 本地新 exe 启动跑 migration 后 :8082 bind 失败退出所致，非运行容器所为。根因：旧 Docker 镜像。修复路径：重建镜像（含工作目录未提交变更）+ 重启容器。已创建 `.claude/CLAUDE.md`（项目身份/架构/关键路径/代码约定/开发联调/收尾流程含 docker 重建 + 交付手动测试）。交付用户手动执行 `docker build -t hltv-data:test .` → `docker stop/rm hltv-test` → `docker run -d --name hltv-test -p 8082:8082 -v ${PWD}/data:/data --restart unless-stopped hltv-data:test` → 浏览器 :8082 验证队标。Phase 4 验证：本地构建 `hltv-mcp-logo.exe` + 隔离实例（HLTV_DB_PATH=data/logo-test.db HTTP_PORT=8083，不影响 Docker :8082），`/api/teams/6667` 200 2656B in 1.77s（实时 scrape），响应 `profile.logo=https://img-cdn.hltv.org/teamlogo/OKLwq88GXjl5GQ48Y5SrvW.png?ixlib=java-2.1.0&w=50&s=0a0d65...`（真实 imgix 签名 URL，非 placeholder）+ `recent_matches[0].team1_logo/team2_logo` 两条 URL 正常 + `meta.partial:false` → logo 提取代码（pickLogoURL/decodeLogoSrc/isPlaceholderLogo + .profile-team-logo-container img.teamlogo 选择器）实证正确，重建镜像后队标必显示。已清理隔离 exe + logo-test.db + 响应文件
- 2026-06-30：对比页 B 标识改用 nickname 替代数字 ID（已推送 cb3452c）— 8b4feb2 用 `compareId`（数字 ID 11893）作 B 标识，用户反馈"我需要的是 donk zywoo 等和上一个 label 对齐的标识"，要昵称不要数字 ID。根因：onPick 已调 `api.getPlayer(pid)` 取 abilities 但丢弃了 `d.data.profile.name`（昵称），该字段与 A 标识 `p?.name`（如 "s1mple"）同源、getPlayer 响应已含。修复：`compareId: number|null` → `compareName: string`，onPick 改 `setCompareName(d?.data?.profile?.name ?? '')`，B dataset label `compareName || '选手 B'`、清除按钮 `清除对比 ({compareName})`、useEffect 依赖数组加 compareName 触发重渲染。PlayerDetail.tsx 5 处编辑（state 声明/B label/依赖数组/清除按钮 onClick+文案/onPick 实现）。chrome-devtools 验证（5173 dev + 8082 后端）：API `/api/players/11893` 返回 `profile.name=ZywOo` / `real_name=Mathieu Herbaut`（昵称 vs 全名区分正确）✓；UI 全流程 s1mple 详情→对比其他选手→搜 zywoo→点 ID 11893 后，清除按钮 DOM = "清除对比 (ZYWOO)"（nickname，`.button` CSS `text-transform:uppercase` 转大写，非 "ID 11893" 非 "Mathieu..."）✓；雷达图例为 canvas 像素渲染且 chart.js 4.x 实例不挂 canvas（`$chartjs` 仅 `{initial}` meta、`window.Chart` 未暴露）无法 DOM 读 label，但 B dataset label 与清除按钮共用同一 `compareName` state，数据流确定 = "ZywOo"，与 A label "s1mple" 对齐 ✓。已推送 origin/main（commit cb3452c，2 文件：PlayerDetail.tsx/AGENTS.md；.claude/settings.local.json 为本地权限配置未提交）
- 2026-06-30：前端 2 Bug 修复（手机搜索框 + 选手对比去全名）— (1) SearchableList.tsx:40 input 移除 `search-expand` class（components.css:105 `@media(max-width:768px){.search-expand{display:none}}` 本为 TopBar 顶部搜索栏设计，SearchableList 误用同一 class 致手机端页面搜索框被隐藏无法输入；TopBar 仍正确隐藏）；(2) PlayerDetail.tsx PlayerSelectionModal 列表项去 `item.name`（HLTV 搜索 scrapers.go:46 `link.Text()` 返回全名格式如 `Mathieu 'ZywOo' Herbaut`）只显 `ID {item.id}`，清除按钮/雷达图 B legend 去 compareName 显示。Claude_Preview + chrome-devtools 移动端模拟验证：搜索框 `display:block visible:true`；弹窗列表 s1mple 搜出 `ID 7998`/`ID 23609` 无全名。已 push origin/main（commit 6e782b8，4 文件：SearchableList.tsx/PlayerDetail.tsx/AGENTS.md/.claude/launch.json；.claude/settings.local.json 为本地权限配置未提交）
- 2026-06-30：代码文档瘦身收敛 — (1) 删 docs/utls-bypass-*.md + docs/superpowers/（plans/specs 9 篇过程文档）；(2) facade buildComparison 简化为 `return &TeamComparison{TeamA:*a,TeamB:*b}`（删 ~97 行错误死代码 H2H 逻辑：scrapeTeam 用 GetUpcoming 填 RecentMatches 是未来赛程非历史交手，扫它产出的 H2H 恒空/错误；主 H2H 由 CompareTeams 的 /results?team=a&team=b + isDirectH2H + buildHeadToHead 负责）；(3) 删 types.ToolMeta SchemaVersion（硬编码 "1.0" 无读取者）+ Notes（零赋值死字段）；(4) 修 facade GetTeamDetailCached/refreshTeam CacheTTLPlayerDetail→CacheTTLTeam bug（team detail 误用 7 天 TTL）；(5) 合并 translateNewTitles/translateNewRealtimeTitles 为泛型 translateTitles[T]（消除 ~38 行重复）；(6) 清理 types.go 错误码注释对已删 spec 的引用。go build ./... 通过；Docker 镜像 hltv-data:test 重建 + 容器 hltv-test 启动于 :8082，/api/health ok + /api/status 6/6 上游端点 ok（uTLS 抗 CF 正常），交用户手动测试；push origin/main（commit 642d3d9，25 commits 远端同步）

## 关键发现

### 代码文档瘦身收敛（2026-06-30）
- **buildComparison 死代码根因**：scrapeTeam 用 GetUpcoming（未来赛程）填 td.RecentMatches，不含 A vs B 历史交手；旧 buildComparison 扫 RecentMatches 产出的 H2H 恒为 nil 或把未来赛程当历史（winsA=winsB=0, recent 全 false）。CompareTeams 已用 /results?team=a&team=b + isDirectH2H + buildHeadToHead 作为主 H2H 源覆盖（line 362 调 buildComparison 组装，line 375 buildHeadToHead 设 cmp.HeadToHead）。故 buildComparison 简化为仅 `return &TeamComparison{TeamA:*a, TeamB:*b}`；/results 失败时 HeadToHead 保持 nil，前端 TeamComparison.tsx 已处理"暂无交手记录"空态。
- **CacheTTL bug**：GetTeamDetailCached + refreshTeam 误用 CacheTTLPlayerDetail（604800s=7天）缓存 team detail，应为 CacheTTLTeam（300s）。copy-paste bug，team detail 缓存过期过慢。
- **translate 泛型合并**：translateNewTitles/translateNewRealtimeTitles 仅差 items 类型 + store 方法（Has/Update NewsTitleZh vs RealtimeTitleZh），提取泛型包级函数 translateTitles[T any](f, items, extract, has, update)。Go 不支持泛型方法（receiver 不能有类型参数）故用包级函数；NewsItem.Title 字段与 Title() 方法名冲突故用 extract 闭包而非接口。
- **types.ToolMeta 死字段**：SchemaVersion 硬编码 "1.0" 无读取者（装饰性）；Notes []string 全代码库零赋值。皆删。StaleAgeSec/Stale 在 withCacheOrStore 在用，保留。
- **过程文档清理**：docs/utls-bypass-*.md 描述独立 hltv-utls-fetch 模块（主项目不存在，import 路径无效，implementation.md 自述"已回退未接入"）；docs/superpowers/plans|specs 是 brainstorming 过程文档，工作完成后 AGENTS.md 是真正契约源。全删，核心知识已沉淀在本文件 + internal/client 代码。

### 前端 3 Bug 修复（2026-06-30）
- **Issue 1 top20 放弃决策**：CF managed challenge（非 Turnstile，纯 JS 验证检测 webdriver）headless 浏览器无法自动通过、不发放 cf_clearance。用户决策放弃 top20 栏目，删前端榜单 UI + 后端整链死代码（handlers/players.go + scraper/stats.go + facade.GetPlayersTop/stats 字段 + types.PlayerStatsRow + router /api/players/top + client.ts getPlayersTop + Players.tsx 榜单 tab）。/stats/players 路径不再追究。
- **Issue 3 Modal fixed 失效根因**：Modal 在 SearchableList 内渲染，被 slideUp animation（`both` fill-mode 残留恒等 transform matrix）创建 containing block，把 position:fixed overlay 锁死。修复：Modal.tsx 用 createPortal 渲染到 document.body，脱离任何 transform 祖先。

### Round 2 后端根因（2026-06-30）
- **Issue 6A rankings 选择器失效**：HLTV 改版，旧选择器全 0。新选择器（live HTML 确认）：容器 `.ranked-team.standard-box`（前 30 主榜）/ `.position`("#N") / `.name` / `.points`(`\((\d+)`) / `a.moreLink[href*="/team/"]` / `.change`("+1"/"-1"/"-")。国家列 ranking 页已无，`Country` 留空（前端 `r.country || '—'` fallback）。
- **Issue 8 H2H 数据源**：`/results?team={aID}&team={bID}`（HLTV 原生双 team 过滤，**OR 逻辑**含 a 或 b 之一，~200 条），NormalizeMatches 解析，客户端过滤 isDirectH2H（team1==aName&&team2==bName 或反之），buildHeadToHead 填 HeadToHead。Vitality vs G2 得 3 场（dedup 后，MatchID 优先 + tuple fallback）。
- **Issue 5 /stats/players CF 路径级防护**：比 `/ranking/teams/`、`/results` 严，uTLS HelloIOS_Auto + 桌面 Chrome 指纹（HelloChrome_Auto + desktopChromeUA + Sec-Fetch-Site:none/Mode:navigate/Dest:document + Referer）仍 403；走 handler `partial:true` 降级，前端空态。**后续要真正绕过需 cookie jar + 无头浏览器预解 CF challenge 获取 cf_clearance 注入 uTLS client**。
- **bonus 修复**：NormalizeMatches 之前 Result 恒 OutcomeUnknown（`.result-score span` 的 `score-won`/`score-loss` class 未解析），resolve.go wins/losses 也恒 0；本次修复 Result 解析（team1 视角：team1 赢→OutcomeWin），队伍详情页胜场统计恢复正确。

### uTLS + 统一错误码（2026-06-29）
- uTLS HelloIOS_Auto 指纹绕过 Cloudflare 浏览器挑战；http2.Transport 自定义 DialTLSContext 注入 uTLS 连接
- 统一错误码：NETWORK/READ/CHALLENGE/NOT_FOUND/SERVER/UNAVAILABLE，ToolError.Retryable bool 区分可重试
- CF 检测签名：`Just a moment` / `cf-browser-verify` / `Attention Required` / `Enable JavaScript and cookies to continue`（移除裸 `Cloudflare` 避免误判）
- FetchHTML 用 doOnce 闭包修复 defer 在 retry 循环中的资源泄漏

### Docker npm ci 跨平台坑（2026-06-29）
- @emnapi 是 WASM threads 后端包的 transitive optionalDependency，Windows npm 11 生成的 lock 缺 linux 平台条目
- alpine npm 10 的 `npm ci` 严格校验 lock 完整性 → 缺 @emnapi 报错
- 修复：Dockerfile 用 `npm install --no-audit --no-fund` 替代 `npm ci`

### 前端性能基线（2026-06-30 黑盒测试）
- 首页 LCP 868ms / CLS 0.02 — 良好
- JS bundle 501kB (>500kB 警告) — 后续可 code-split 优化
- 搜索框缺 id/name（a11y issue，Lighthouse a11y 93 扣分项）

### JSON 标签强制要求（2026-05-31 踩坑）
- Go `encoding/json` 对驼峰下划线混合字段匹配不可靠：`provider_url` 无法匹配 `ProviderURL`
- 所有用于 JSON 编解码的结构体必须加 `json:"snake_case"` 标签

### 代码收敛原则（2026-05-31，2026-06-30 强化执行）
- 不导出仅包内使用的符号
- 空 struct 仅用于持有方法 = 应转为包级函数
- 两个函数结构相同仅差类型 = 提取通用泛型/包级函数（如 translateTitles[T]、searchHLTV）
- 仅测试调用的函数 = 死代码，删除并用公开 API 重写测试
- 装饰性字段（无读取者的硬编码常量）= 删除；零赋值字段 = 死字段删除
- 删除优先于新增，收敛优先于扩展；不为"未来可能需要"保留扩展点

### HLTV HTML 选择器（核心参考）
- **选手页**: `.playerNickname` / `.playerRealname` / `.playerTeam a[itemprop="text"]` / `.player-stat` > `.statsVal p b`(能力值) / `.stats-window`(maps数) / `.playerpage-matchbox`(近期比赛) / `.playerpage-match-result`(比分) / `.playerpage-match-date` / `.majorWinner b`(Major冠军数) / `.mvp-count`(MVP数) / `.highlighted-stat` > `.stat` + `.description`(生涯概览新版)
- **队伍页**: `h1.profile-team-name` / `.value.h-rank` / `.bodyshot-team a[href*='/player/']`(队员) / `.trophySection .trophyDescription[title]` / `.highlighted-stat`(胜率/连胜)
- **比赛链接**: `.playerpage-matchbox[href]` 正则 `/stats/matches/(\d+)/([^"\s]+)`
- **赛果**: `.result-con` > `.line-align.team1 .team` / `.result-score` / `.event-name`
- **赛程**: `.matches-list-section` > `.match-wrapper`(比赛容器唯一) > `.match` / `.match-team.team1/team2 .match-teamname` / `.match-event` / `.match-info` / `.match-no-info`；`data-match-id` 属性；`.match-wrapper` 的 `team1`/`team2` 属性在队伍未定时为空
- **新闻**: `.newstext` / `.news-block p`(正文)
- **搜索**: `table tbody tr > a[href*='/player/']` 正则 `/player/(\d+)/(.+)`

### CF 分层
- **HTTP 直连可用**：`/player/`、`/team/`、`/search`、`/news/`、`/ranking/teams/`、`/results`
- **uTLS 绕过 CF**：`/matches`、`/`、`/results?team=X&team=Y`（HelloIOS_Auto 指纹）
- **CF 路径级防护严（uTLS + 浏览器都过不了）**：`/stats/players`（走 handler `partial:true` 降级）

### 三层回退 (Cache -> SQLite -> HLTV)
- **Type A**（player/team/news article detail）：`GetXxxCached` 方法内联三层逻辑，Tier 2 命中后后台 goroutine `refreshXxx` 更新缓存，调用 `broadcast` 推送 SSE
- **Type B**（matches/events/news lists）：通过 `withCacheOrStore`，Tier 1 缓存（含 stale），Tier 2 SQLite（命中回缓存 + 后台 `RunOnce` 刷新），Tier 3 直接爬取并存库
- `store *storage.Store` 为 nil 时自动降级为 Cache-only

### nickname 覆盖层
- `internal/localization/overrides.go`：线程安全内存缓存 + JSON 持久化
- 空值语义 = 删除条目；API：`PUT /api/nicknames/team`（尝试解析 canonical 否则按原名存）/ `PUT /api/nicknames/player`（直接存）
- `BuildFullDict` 对目录队伍做别名展开 + override 直接 key-value 映射

### React Router 路由切换
- 不同路由渲染同组件类型时 reconciliation 复用实例不重新挂载，内部 state 保留；修复：给组件加 `key` 区分

### Go embed + Vite
- `//go:embed dist` 递归包含整个 dist；Vite build outDir '../dist'，index.html 引用 dist/assets/

### 错误处理
- `ToolError` 直接实现 `error` 接口，删除独立 `internal/errors` 包
- 错误创建直接 `&types.ToolError{Code: "...", Message: "..."}`

### 部署
- Docker 三阶段构建 → `ghcr.io/arcdent/hltv-data:latest`（alpine ~15MB binary）
- CI/CD：push main → GitHub Actions 自动构建
- 前端变更需 `vite build` + `go build` + 重启服务

### 资源管理
- `Store.Close()` 在 graceful shutdown 中调用；store 为 nil（降级模式）时跳过 Close

## 下一步
- 部署新镜像（含 uTLS 重构 + 前端重设计 + Round 2 后端根因修复 + top20 移除 + 瘦身收敛 + 队标 logo 链路）到 ghcr.io，验证翻译长效化 + uTLS 抗 CF + rankings/H2H 数据正确性 + team detail 缓存 TTL 修复后行为 + 队标显示
- 前端优化：JS bundle code-split（>500kB 警告）、搜索框加 id/name 提升 a11y
- 验证 /results 页面 uTLS 绕过稳定性

## 进行中
- 队标 + 归档新闻 link 修复已随镜像重建（hltv-data:test）+ 容器 hltv-test 重启生效于 :8082：logo 提取/持久化/migration v3 代码 + NormalizeNews Closest("a") 修复 + useSSE 收敛均已编入运行镜像；/api/health ok；/api/news?limit=30 返回 30 items / 30 unique links（归档新闻 link 重复 bug 已实证修复）。待用户浏览器 http://localhost:8082 手动验证：(1) 队标显示（TeamLogo 组件，队伍页 /matches /results）；(2) 归档新闻 tab 点击任意新闻详情，确认各自跳转正确新闻而非同一篇；选手对比 nickname 已测试通过
