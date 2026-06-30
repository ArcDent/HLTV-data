# HLTV-data 项目级 CLAUDE.md

> 本文件在全局 `~/.claude/CLAUDE.md` 基础上追加项目专属规则。全局约束（语言/MCP 路由/安全/记忆/任务收尾顺序）不在此重复，仅补项目特定内容。契约源为 AGENTS.md（静态结构/关键发现/最近操作）+ 代码；docs/ 已清空。

## 项目身份
- 类型：HLTV 数据 MCP 全栈服务（Go 单二进制 + React SPA）
- 技术栈：Go 1.26 + mark3labs/mcp-go + chi + goquery + uTLS(HelloIOS_Auto)；React 19 + Vite 8 + 自研设计系统（Rajdhani/Inter/JetBrains Mono）
- 远端：[ArcDent/HLTV-data](https://github.com/ArcDent/HLTV-data)
- 部署：Docker 三阶段构建 → 本地 `hltv-data:test` 镜像（手动 `docker run` 容器 `hltv-test`，:8082）；docker-compose.yml 默认拉 GHCR 镜像，本地测试改用 `build: .`

## 架构要点（详见 AGENTS.md）
- 三层回退：Cache(TTL+stale) → SQLite(`/data/hltv.db`) → HLTV scrape(uTLS 绕 CF)
- 后端 :8082（HTTP REST + SSE + SPA fallback），MCP stdio 同进程 goroutine
- `//go:embed dist` 嵌入前端；Vite `outDir '../dist'`
- DB 迁移 `internal/storage/migration.go`，当前 v3：`teams.logo` / `matches.team1_logo` / `matches.team2_logo`
- logo 三类 class：`teamlogo`（队伍页）/ `match-team-logo`(/matches) / `team-logo`(/results)；night-only 优先 > day-only > base；placeholder（`teamplaceholder`/`/dynamic-svg/`）跳过
- HLTV logo URL 含 imgix `s` 签名，不可合成；night-only 另有 `invert=true&sat=-100` + 不同签名，必须用真实 URL
- CF 分层：`/stats/players` 路径级防护严（uTLS+浏览器都过不了）→ handler `partial:true` 降级

## 关键路径
| 项 | 路径 |
|---|---|
| 入口 | `main.go`（MCP stdio + HTTP :8082 + graceful shutdown） |
| 类型 | `internal/types/types.go` |
| 抓取 | `internal/scraper/*.go`（uTLS FetchHTML 按 path 分流 transport） |
| 规范化 | `internal/normalizer/{team,match}.go` |
| 编排 | `internal/facade/*.go`（三层回退 + CompareTeams H2H：/results?team=X&team=Y + isDirectH2H） |
| 持久化 | `internal/storage/{migration,teams,matches}.go` |
| HTTP | `internal/http/*.go`（chi + SSE + SPA fallback） |
| 前端 | `frontend/src/{pages,components,api,hooks,styles}` |
| 设计系统 | `frontend/src/styles/tokens.css` |
| 队标组件 | `frontend/src/components/TeamLogo.tsx`（src 有值渲染 img，无则首字母渐变圈） |

## 代码约定（项目强约束）
- JSON 结构体必须加 `json:"snake_case"` 标签（驼峰下划线混合匹配不可靠）
- 不导出仅包内使用的符号；空 struct 仅持有方法 → 转包级函数；两函数仅差类型 → 提泛型（如 `translateTitles[T]`）
- 删除优先于新增，收敛优先于扩展；不为"未来可能需要"保留扩展点
- 装饰性字段（无读取者硬编码常量）/ 零赋值字段 = 死代码，删除
- 前端队标统一用 `<TeamLogo src name size [radius] [fallbackBg] />`，不要散落首字母逻辑
- 选手搜索 `item.name` 格式 `Ilya 'm0NESY' Osipov`；nickname 用正则 `'([^']+)'` 提取，real name 去引号段
- nullable TEXT 列用 `sql.NullString` 扫描；upsert 用 `COALESCE(NULLIF(excluded.X,''), table.X)` 非破坏性更新

## 开发联调
- 前端 dev：`npm --prefix frontend run dev`（:5173，Vite proxy `/api` → :8082）
- 后端本地：`go run .` 或 `go build -o hltv-mcp.exe . && ./hltv-mcp.exe`（:8082；若被 Docker 占用，先停容器或用临时端口）
- 预览/dev server 用 Claude_Preview MCP（`.claude/launch.json` 当前仅 frontend 配置）
- 前端调试用 chrome-devtools MCP；网络/控制台/元素审查
- 代码符号搜索用 serena MCP（当前目录是 git，可 activate）

## 收尾流程（强约束，每次代码变更落地必执行）

> 跑完此流程才算"完成"。**步骤 6 交给用户手动测试**——不要自证通过就收工。

1. **前端构建**：`npm --prefix frontend run build`（产物到 `dist/`，被 `//go:embed`）
2. **后端编译验证**：`go build ./...`
3. **重建 Docker 镜像**（含当前工作目录所有变更，含未提交）：
   ```
   docker build -t hltv-data:test .
   ```
4. **重启容器**（本地测试用 `hltv-data:test`，非 compose 的 GHCR 镜像）：
   ```
   docker stop hltv-test; docker rm hltv-test
   docker run -d --name hltv-test -p 8082:8082 -v ${PWD}/data:/data --restart unless-stopped hltv-data:test
   ```
   PowerShell 用 `${PWD}`；若用 `docker compose up -d --build`，需先把 compose.yml 的 `image:` 行换成 `build: .` 注释取消。
5. **健康检查**：`curl -s http://localhost:8082/api/health` 与 `/api/status`
6. **交付用户手动测试**：告知用户访问 http://localhost:8082 验证受影响功能；测完按用户指示保留或 `docker stop hltv-test && docker rm hltv-test`。**不自动停容器**——:8082 容器是用户环境。
7. **更新 AGENTS.md**：追加"最近操作"条目（日期 + 根因 + 修复 + 验证 + commit），保持 3-5 条
8. **目录整理**：按 `~/.claude/context/file-organization.md` 规则归位新文件

### 收尾触发判定
- 前端/后端代码变更 → 必跑步骤 1-6
- 纯文档/AGENTS.md 更新 → 跳过 1-4，直接 7
- 用户表达提交意图（commit/push/PR）→ 额外触发 README.md 刷新（全局规则）

## 当前状态（2026-06-30）
- **队标功能待生效**：前端 `TeamLogo` 组件 + 后端 logo 提取/持久化/migration v3 已就绪，但运行中容器 `hltv-test` 用 15:37 旧镜像 `hltv-data:test`，不含晚于 15:37 写入的 logo 代码 → **需执行上方收尾流程步骤 3-4 重建镜像才能生效**
- 选手对比搜索 nickname 显示已修复（已推送 cb3452c，用户确认测试通过）
- 未提交变更：6 个 `internal/*.go`（logo 链路）+ 5 个 `frontend/*.tsx` + `TeamLogo.tsx`（新）

## 依赖
- Go 1.26 / Node 22 / Docker
- 安装前告知用户；Python 用 uv，Node 用 npm，不全局安装
