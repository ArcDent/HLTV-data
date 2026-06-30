<!-- markdownlint-disable -->

<p align="center">
  <pre>
  ██╗  ██╗██╗  ████████╗██╗   ██╗       ██████╗  █████╗ ████████╗ █████╗ 
  ██║  ██║██║  ╚══██╔══╝██║   ██║       ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗
  ███████║██║     ██║   ██║   ██║       ██║  ██║███████║   ██║   ███████║
  ██╔══██║██║     ██║   ╚██╗ ██╔╝       ██║  ██║██╔══██║   ██║   ██╔══██║
  ██║  ██║███████╗██║    ╚████╔╝        ██████╔╝██║  ██║   ██║   ██║  ██║
  ╚═╝  ╚═╝╚══════╝╚═╝     ╚═══╝         ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝
          HLTV MCP Service — CS:GO / CS2 Data Gateway
  </pre>
</p>

<div align="center">

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-GHCR-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows%20|%20Linux%20|%20macOS-blue?style=for-the-badge)

**✨ Go 单二进制全栈 HLTV MCP 服务 ✨**

MCP stdio + HTTP REST + React 管理面板，让 CS:GO / CS2 赛事数据触手可及

[功能特性](#-功能特性) • [快速部署](#-快速部署) • [MCP 工具](#-mcp-工具) • [手动构建](#-手动构建) • [致谢](#-致谢)

</div>

---

## 项目简介

HLTV-data 是一个 Go 单二进制全栈 HLTV MCP 服务，将 HLTV.org 的赛事数据封装为 9 个 MCP 工具，并提供 REST API 和 React Web 管理面板。

> [!NOTE]
> **灵感来源**：[hltv-api](https://github.com/M3MONs/hltv-api)（Python Flask/Scrapy HLTV 爬虫 API）和 TypeScript MCP 服务。本项目使用 Go 完全重建，统一为单一二进制，去除外部 Python 依赖，增加 Web 管理面板。

### 为什么选择 HLTV-data？

单二进制部署，零运行时依赖。Docker 一鍵启动，3 秒即可在浏览器访问管理面板。

---

## 项目结构

```
HLTV-data/
├── main.go                        # MCP stdio + HTTP 双 goroutine 入口
├── Dockerfile                     # 三阶段构建（前端 → Go → 运行时）
├── docker-compose.yml             # Compose 快速启动
├── internal/
│   ├── types/              # 共享类型定义
│   ├── config/             # 环境变量配置
│   ├── crypto/             # AES-256-GCM 加解密（API Key 持久化）
│   ├── cache/              # 内存缓存（TTL + stale + 并发合并）
│   ├── client/             # uTLS (iOS Safari 指纹) CF 绕过
│   ├── scraper/            # 8 个 HLTV 爬虫模块 + 公共搜索解析
│   ├── localization/       # 中英文名称映射（26 队伍 + 98 选手）
│   ├── normalizer/         # HTML → 标准化数据结构
│   ├── facade/             # 核心编排层
│   ├── summary/            # 中文摘要生成
│   ├── renderer/           # 中文格式化输出
│   ├── mcp/                # 9 MCP 工具注册 + stdio 传输
│   ├── http/               # chi router + REST API + SPA fallback
│   ├── storage/            # SQLite 持久化（migration + Store + CRUD）
│   └── translator/         # LLM 翻译（OpenAI 兼容 API）
└── frontend/               # React 19 + Vite 8 + 自研设计系统 CSS tokens
    └── src/pages/          # 10 个页面（首页/赛程/队伍/选手/新闻 + 详情 + 设置）
```

---

## 部署之前需要注意

### 前置环境

| 依赖 | 版本 | 说明 |
|:-----|:-----|:-----|
| **Docker** | ≥ 20.10 | 推荐部署方式 |
| **Go** | ≥ 1.26 | 仅手动编译需要 |
| **Node.js** | ≥ 18 | 仅手动编译前端需要 |

### 翻译 LLM API（可选）

内置新闻标题自动翻译功能，支持 OpenAI 兼容 API。在 Web 管理面板 `http://localhost:8082` → **设置** 页面配置：

| 配置项 | 说明 |
|:-------|:-----|
| Provider URL | LLM API 地址（如 `https://api.openai.com/v1`） |
| API Key | API 密钥 |
| Model | 模型名称（如 `gpt-4o-mini`） |

支持 OpenAI、DeepSeek、Groq、Ollama 等所有 OpenAI 兼容接口。

---

## 功能特性

### 核心功能

| 功能 | 描述 |
|:-----|:-----|
| **9 个 MCP 工具** | 队伍/选手解析、赛程/赛果查询、实时/归档新闻 |
| **REST API** | 健康检查、搜索、赛程、新闻端点 |
| **Web 管理面板** | React 19 SPA，首页 / 赛程 / 队伍 / 选手 / 新闻 + 详情页 + 设置 |
| **SSE 实时推送** | 后端抓取完成后自动推送前端刷新 |
| **反爬虫** | uTLS iOS 指纹 + HTTP 直连绕过 Cloudflare |
| **中文输出** | 26 支队伍民间昵称 + 98 名选手中文简称 + 中文摘要 |

### 数据能力

| 特性 | 描述 |
|:-----|:-----|
| **三层回退** | 内存缓存 → SQLite 历史 → HLTV 实时抓取 |
| **自动过期** | 比赛 90 天 / 新闻 30 天 / 实时新闻 7 天自动清理 |
| **新闻翻译** | 接入 LLM API，标题自动翻译 + 正文一键翻译 |
| **别名编辑** | Web 面板支持队伍/选手别名在线编辑 |

---

## MCP 工具

| 工具名 | 作用 | 主要参数 |
|:-------|:-----|:---------|
| `resolve_team` | 解析队伍名称为 HLTV 身份候选 | `name`(必填), `exact`, `limit` |
| `resolve_player` | 解析选手名称为 HLTV 身份候选 | `name`(必填), `exact`, `limit` |
| `hltv_team_recent` | 查询队伍近况、近期战绩和即将到来的比赛 | `team_id`, `team_name`, `limit` |
| `hltv_player_recent` | 查询选手近况和统计数据 | `player_id`, `player_name`, `limit` |
| `hltv_results_recent` | 查询近期赛果（支持队伍/赛事筛选） | `team`, `event`, `limit`(1-20), `days`(1-30) |
| `hltv_matches_upcoming` | 查询即将到来的比赛 | `team_id`, `team`, `event`, `limit`(1-20), `days`(1-30) |
| `hltv_matches_today` | 查询今日全部赛程（亚洲时区） | 无参数 |
| `hltv_realtime_news` | 获取 HLTV 实时/最新新闻 | `limit`(1-50), `page`, `offset` |
| `hltv_news_digest` | 获取 HLTV 月度归档新闻 | `limit`, `tag`, `year`, `month`, `page` |

### WebUI 管理页面

启动后访问 `http://localhost:8082`：

| 页面 | 路由 | 功能 |
|:-----|:-----|:-----|
| **首页** | `/` | 今日精选 + 热门新闻 + 排名变动 |
| **赛程** | `/matches` | 赛程浏览（今日/即将/赛果），SSE 实时刷新 |
| **队伍** | `/teams` | 队伍搜索 + 对比 + 详情 |
| **选手** | `/players` | 选手搜索 + 详情（雷达图） |
| **新闻** | `/news` | 实时/归档新闻列表 + 详情弹层 + 翻译 |
| **设置** | `/settings` | 翻译 LLM 配置 + 别名编辑 |

---

## 快速部署

### Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/ArcDent/HLTV-data.git
cd HLTV-data

# 启动（从 GHCR 拉取预构建镜像）
docker compose up -d
```

浏览器访问 `http://localhost:8082`。

### Docker 直接启动

```bash
# Windows（PowerShell）
docker run -d --name hltv-mcp `
  -p 8082:8082 `
  -v hltv-data:/data `
  ghcr.io/arcdent/hltv-data:latest

# Linux / macOS / WSL
docker run -d --name hltv-mcp \
  -p 8082:8082 \
  -v hltv-data:/data \
  ghcr.io/arcdent/hltv-data:latest
```

### 更新镜像

```bash
# 拉取最新镜像
docker pull ghcr.io/arcdent/hltv-data:latest

# 停止旧容器 → 删除 → 启动新容器
docker rm -f hltv-mcp \
  && docker run -d --name hltv-mcp \
    -p 8082:8082 \
    -v hltv-data:/data \
    ghcr.io/arcdent/hltv-data:latest

# 一行更新
docker pull ghcr.io/arcdent/hltv-data:latest && docker rm -f hltv-mcp && docker run -d --name hltv-mcp -p 8082:8082 -v hltv-data:/data ghcr.io/arcdent/hltv-data:latest
```

### 自动同步

每次 push 到 main 分支，GitHub Actions 自动构建镜像推送至 GHCR。搭配系统计划任务实现自动更新：

**Windows（PowerShell 计划任务，以管理员运行）**

```powershell
$action = New-ScheduledTaskAction -Execute "docker" -Argument "run --rm -d --name hltv-mcp -p 8082:8082 -v hltv-data:/data ghcr.io/arcdent/hltv-data:latest"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName "HLTV-Auto-Update" -Action $action -Trigger $trigger -RunLevel Highest
```

**Linux（crontab）**

```bash
*/5 * * * * docker pull ghcr.io/arcdent/hltv-data:latest && docker rm -f hltv-mcp && docker run -d --name hltv-mcp -p 8082:8082 -v hltv-data:/data ghcr.io/arcdent/hltv-data:latest
```

---

## 作为 MCP 注册在 Agent 中

### 标准 MCP 客户端

Docker 部署后 MCP stdio 不可用（容器隔离）。如需 MCP 功能，使用手动编译启动。

**Claude Desktop / VS Code Copilot / Gemini CLI**：

```jsonc
{
  "mcpServers": {
    "hltv": {
      "command": "/path/to/hltv-mcp",
      "args": []
    }
  }
}
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|:-----|:-------|:-----|
| `HTTP_PORT` | `8082` | HTTP 监听端口 |
| `HTTP_HOST` | `0.0.0.0` | HTTP 监听地址 |
| `HLTV_DB_PATH` | `data/hltv.db` | SQLite 数据库路径 |
| `HLTV_DB_RETENTION_MATCHES` | `90` | 比赛数据保留天数 |
| `HLTV_DB_RETENTION_NEWS` | `30` | 新闻数据保留天数 |
| `HLTV_DB_RETENTION_REALTIME_NEWS` | `7` | 实时新闻数据保留天数 |
| `HLTV_HTTP_TIMEOUT_MS` | `8000` | HTTP 超时（毫秒） |
| `HLTV_RETRY_COUNT` | `2` | HTTP 重试次数 |
| `DEFAULT_RESULT_LIMIT` | `5` | 默认查询结果数 |

---

## 手动构建

### WSL / Linux 直接编译

```bash
git clone https://github.com/ArcDent/HLTV-data.git
cd HLTV-data

# 安装依赖
sudo apt install -y golang-go nodejs npm

# 构建前端
cd frontend && npm install && npm run build && cd ..

# 编译 Go
go build -o hltv-mcp .

# 启动
./hltv-mcp
```

### Windows 直接编译

```powershell
git clone https://github.com/ArcDent/HLTV-data.git
cd HLTV-data

# 构建前端
cd frontend; npm install; npm run build; cd ..

# 编译 Go
go build -o hltv-mcp.exe .

# 启动
.\hltv-mcp.exe
```

### Docker 从源码构建

```bash
git clone https://github.com/ArcDent/HLTV-data.git
cd HLTV-data
docker build -t hltv-mcp .
docker run -d --name hltv-mcp -p 8082:8082 -v hltv-data:/data hltv-mcp
```

### 端口管理

```bash
# 按端口杀进程
kill $(lsof -t -i:8082) 2>/dev/null || fuser -k 8082/tcp

# 按进程名杀
pkill -f hltv-mcp
```

### 运行测试

```bash
go test ./internal/... -v -timeout 30s
```

---

## REST API 速览

```bash
curl http://localhost:8082/api/health              # 健康检查
curl http://localhost:8082/api/status              # 服务状态
curl http://localhost:8082/api/matches/today       # 今日赛程
curl http://localhost:8082/api/search?q=Vitality   # 搜索
curl http://localhost:8082/api/news/realtime?limit=10  # 实时新闻
```

---

## 致谢

- [hltv-api](https://github.com/M3MONs/hltv-api) — 原始 Python HLTV 爬虫 API
- [mcp-go](https://github.com/mark3labs/mcp-go) — Go MCP SDK
- [goquery](https://github.com/PuerkitoBio/goquery) — HTML 解析
- [chi](https://github.com/go-chi/chi) — HTTP 路由
- [utls](https://github.com/refraction-networking/utls) — uTLS TLS 指纹库

---

<div align="center">

**Made with ❤️ by [ArcDent](https://github.com/ArcDent)**

**Star ⭐ 如果这个项目对你有帮助！**

</div>

<!-- markdownlint-restore -->
