# hltv-utls-fetch

纯本地抓取 HLTV 原始界面 HTML 的方案，绕过 Cloudflare 的 TLS 指纹封锁。

**不用 firecrawl、不用代理、不用无头浏览器、不用第三方 API。**

## 为什么需要

HLTV 在 Cloudflare 之后，用 Go `net/http` 或 curl 请求 `/matches`、`/results`、`/` 等端点返回 403。封锁发生在 **TLS 握手层**（JA3/JA4 指纹），伪装 HTTP 头无效。

## 方案

用 [`refraction-networking/utls`](https://github.com/refraction-networking/utls) 伪装 **iOS Safari** 的 TLS `ClientHello`。实测（2026-06）这是唯一能过 `/matches` 的指纹，全 7 端点 200，响应 0.27-1.5s。

## 运行

```powershell
# 国内必须设代理（proxy.golang.org 被墙）
go env -w GOPROXY=https://goproxy.cn,direct

cd hltv-utls-fetch
go run ./examples/
```

输出：

```
https://www.hltv.org/matches                  HTTP=200  1.20s  size=871120   blocked=false
https://www.hltv.org/results                  HTTP=200  0.68s  size=365626   blocked=false
https://www.hltv.org/                         HTTP=200  1.08s  size=259327   blocked=false
...
```

加 `--save` 可 dump HTML 到本地：`go run ./examples/ --save`

## 作为库使用

```go
import "github.com/arcdent/hltv-mcp/hltv-utls-fetch/hltvfetch"

f := hltvfetch.New(hltvfetch.WithTimeout(15*time.Second), hltvfetch.WithRetries(3))
body, err := f.Fetch(context.Background(), "/matches")
```

## 结构

```
hltv-utls-fetch/
├── README.md              # 本文件
├── IMPLEMENTATION.md      # 详细实现文档（根因分析、踩坑、对比、接入指南）
├── go.mod                 # 独立 module
├── hltvfetch/fetcher.go   # 可复用 library（选项、重试、错误分类）
└── examples/main.go       # 可直接 go run 的验证程序
```

## 关键技术点

- **必须用 `http2.Transport`**，不能用 `http.Transport` + `ConfigureTransports`（HLTV 全站 h2，后者会报 "malformed HTTP response"）
- **UA 必须匹配指纹**：iOS TLS 指纹 + iOS Safari UA，桌面 Chrome UA 会触发交叉校验 403
- **检测 challenge 页**：HTTP 200 也可能是 "Just a moment..." 挑战页

详见 [IMPLEMENTATION.md](IMPLEMENTATION.md)。

## 要求

- Go 1.23+
- 国内：`GOPROXY=https://goproxy.cn,direct`
