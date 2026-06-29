# HLTV 原始界面抓取实现文档

> 纯本地方案，绕过 Cloudflare 对 HLTV 的封锁，无需 firecrawl、无需代理、无需无头浏览器、无需第三方 API。

## 一、问题诊断

HLTV（`www.hltv.org`）位于 Cloudflare 之后。用 Go 标准 `net/http` 或 curl 请求关键端点时返回 **HTTP 403**：

| 端点 | curl 默认 TLS | Go net/http |
|------|--------------|-------------|
| `/matches` | 403 | 403 |
| `/results` | 403 | 403 |
| `/` | 403 | 403 |
| `/player/{id}` | 403 | 403 |

实测（2026-06-23，curl + 浏览器 headers）：

```
/matches -> 403 2.635s
/results -> 403 0.238s
```

即使把 `User-Agent`、`Accept`、`Sec-Fetch-*`、`Accept-Language` 等头全部伪装成 Chrome，**仍然 403**。

### 根因：TLS 指纹检测，不是 HTTP 头

Cloudflare 的拦截决策发生在 **TLS 握手层**，早于任何 HTTP 字节被读取：

1. 客户端发起 TCP 连接
2. 客户端发送 TLS `ClientHello`
3. Cloudflare 对 `ClientHello` 计算 **JA3/JA4 哈希**（MD5 of TLS版本+密码套件+扩展+椭圆曲线+EC点格式）
4. 与已知浏览器指纹库比对：匹配 Chrome/Firefox/iOS → 放行；匹配 Go/curl/Node → 拦截
5. TLS 握手完成
6. 客户端发 HTTP/2 SETTINGS + HEADERS
7. Cloudflare 校验 HTTP/2 指纹 + 头顺序
8. **此时才读取 `User-Agent`**，与第 3 步的指纹做交叉校验

所以"伪装 Chrome User-Agent"无效——决策在第 3 步已做出，User-Agent 在第 8 步只是确认。Go `crypto/tls` 和 curl（基于 OpenSSL）的 JA3 哈希在 Cloudflare 黑名单里。

### 交叉校验的额外约束

UA 必须与 TLS 指纹一致。用 iOS TLS 指纹 + 桌面 Chrome UA 会被交叉校验识破，返回 403。因此 **UA 要随指纹一起换**。

## 二、方案：uTLS 指纹伪装

### 核心库

[`github.com/refraction-networking/utls`](https://github.com/refraction-networking/utls) —— Go 标准 `crypto/tls` 的 fork，提供对 `ClientHello` 的低级控制，能精确复制真实浏览器的 TLS 握手特征。

它内置多种"鹦鹉"（parrot）预设：

| 预设 | 对应浏览器 |
|------|-----------|
| `HelloChrome_Auto` | 最新 Chrome（当前 Chrome 133） |
| `HelloFirefox_Auto` | 最新 Firefox（当前 Firefox 120） |
| `HelloIOS_Auto` | 最新 iOS Safari（当前 iOS 14） |
| `HelloSafari_Auto` | 最新 Safari |
| `HelloRandomizedALPN` | 随机化指纹 |

### 关键发现：HLTV 的指纹接受度实测

用 Go utls 对 7 个端点实测（2026-06-23，纯本地，无代理）：

| 指纹 | `/matches` | `/results` | `/` | `/player` | `/team` | `/news/archive` | `/search` |
|------|-----------|-----------|-----|----------|---------|----------------|-----------|
| `HelloFirefox_Auto`(120) | **403** | 200 | 200 | 200 | 200 | 200 | 200 |
| `HelloChrome_Auto`(133) | **403** | 200 | 200 | 200 | 200 | 200 | 200 |
| `HelloChrome_120_PQ` | **403** | — | — | — | — | — | — |
| `HelloChrome_115_PQ` | **403** | — | — | — | — | — | — |
| **`HelloIOS_Auto`** | **200** | **200** | **200** | **200** | **200** | **200** | **200** |
| `HelloSafari_Auto`(16.0) | **403** | — | — | — | — | — | — |
| `HelloRandomizedALPN` | **403** | — | — | — | — | — | — |

**唯一全端点通过的指纹是 `HelloIOS_Auto`**（iOS Safari）。`/matches` 是 Cloudflare 防护最严的端点，只有 iOS 指纹能过。原因推测：iOS Safari 的 JA3/JA4 + HTTP/2 指纹组合在 Cloudflare 的宽松白名单里（移动端流量大，误伤成本高）。

> Python 端用 `curl_cffi`（`impersonate="firefox135"` 或 `"chrome124"`）也能过 `/matches`，但稍旧 Chrome/Firefox 在 Go utls 里没有对应预设，故 Go 端选 iOS 指纹。

### 稳定性验证

`/matches` 连续 8 次（`HelloIOS_Auto`，连接复用）：

```
#1 HTTP=200  1.57s  size=841015  blocked=false  has_match_data=true
#2 HTTP=200  0.55s  size=852611  blocked=false  has_match_data=true
#3 HTTP=200  0.48s  size=852611  blocked=false  has_match_data=true
#4 HTTP=200  0.50s  size=852611  blocked=false  has_match_data=true
#5 HTTP=200  0.54s  size=852611  blocked=false  has_match_data=true
#6 HTTP=200  0.49s  size=852611  blocked=false  has_match_data=true
#7 HTTP=200  0.48s  size=852611  blocked=false  has_match_data=true
#8 HTTP=200  0.27s  size=852611  blocked=false  has_match_data=true
```

- 8/8 成功，响应体大小稳定（841-852KB，波动来自实时赛程变化）
- 首次 1.57s（含 TLS 握手），后续 0.27-0.55s（HTTP/2 连接复用）
- 含真实 `match-wrapper` 数据，非 challenge 页

### 响应时间

| 场景 | 耗时 |
|------|------|
| 首次请求（含 TLS 握手） | 1.2-1.6s |
| 后续请求（h2 连接复用） | **0.27-0.55s** |
| 大页面（/team 4.3MB） | ~1.5s |

远优于 firecrawl（实测 90s+），也优于 curl_cffi（1-4s）。

## 三、实现要点

### 3.1 必须用 `http2.Transport`，不能用 `http.Transport` + `ConfigureTransports`

**踩坑点**：HLTV 全站只协商 HTTP/2（ALPN `h2`）。如果用标准 `http.Transport` 配 `DialTLSContext` 返回 utls 连接，即使调了 `http2.ConfigureTransports`，仍然报：

```
net/http: HTTP/1.x transport connection broken: malformed HTTP response "\x00\x00\x12\x04..."
```

那串二进制是 HTTP/2 帧前缀（SETTINGS frame），被当成 HTTP/1.x 解析了。原因是 `http.Transport` 的 h2 升级路径不会接管我们自定义 `DialTLSContext` 返回连接的 ALPN 协商结果。

**正确做法**：直接用 `golang.org/x/net/http2` 的 `http2.Transport`，把 uTLS 拨号塞进 `DialTLSContext`：

```go
transport := &http2.Transport{
    AllowHTTP: false,
    DialTLSContext: func(ctx context.Context, network, addr string, _ *tls.Config) (net.Conn, error) {
        host, _, _ := net.SplitHostPort(addr)
        tcpConn, err := (&net.Dialer{Timeout: timeout}).DialContext(ctx, network, addr)
        if err != nil { return nil, err }
        uConn := tlsutls.UClient(tcpConn, &tlsutls.Config{ServerName: host}, tlsutls.HelloIOS_Auto)
        if err := uConn.HandshakeContext(ctx); err != nil {
            tcpConn.Close()
            return nil, err
        }
        return uConn, nil
    },
}
client := &http.Client{Timeout: timeout, Transport: transport}
```

### 3.2 UA 必须匹配指纹

用 `HelloIOS_Auto` 时，UA 必须是 iOS Safari：

```go
const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/605.1.15"
```

桌面 Chrome UA + iOS TLS 指纹 → Cloudflare 交叉校验失败 → 403。

### 3.3 检测 challenge 页

即使 HTTP 200，body 可能是 Cloudflare 的 "Just a moment..." 挑战页。必须显式检测：

```go
func isCloudflareBlock(body []byte) bool {
    s := string(body)
    return strings.Contains(s, "Just a moment") ||
        strings.Contains(s, "cf-browser-verify") ||
        strings.Contains(s, "Attention Required") ||
        strings.Contains(s, "Enable JavaScript and cookies to continue")
}
```

### 3.4 重试策略

- 5xx、网络错误、challenge 页 → 可重试（指数退避）
- 403/404 → 不可重试（指纹被封或路径不存在）
- 200 + 非 challenge body → 成功

## 四、代码结构

```
hltv-utls-fetch/
├── README.md                  # 快速上手
├── IMPLEMENTATION.md          # 本文档（详细实现）
├── go.mod                     # 独立 module（不依赖主项目）
├── hltvfetch/
│   └── fetcher.go             # 可复用 library：Fetcher + 选项 + 错误分类
└── examples/
    └── main.go                # 可直接 go run 的验证程序
```

### 4.1 `examples/main.go` —— 最小可用范例

7 个端点的全量验证，30 行核心逻辑。运行：

```powershell
$env:GOPROXY="https://goproxy.cn,direct"   # 国内必须，proxy.golang.org 被墙
go run ./examples/
# 加 --save 可把 HTML dump 到本地：go run ./examples/ --save
```

输出（实测）：

```
https://www.hltv.org/matches                  HTTP=200  1.20s  size=871120   blocked=false
https://www.hltv.org/results                  HTTP=200  0.68s  size=365626   blocked=false
https://www.hltv.org/                         HTTP=200  1.08s  size=259327   blocked=false
https://www.hltv.org/player/11893/zywoo       HTTP=200  1.43s  size=2521351  blocked=false
https://www.hltv.org/team/5378/vitality       HTTP=200  1.51s  size=4307942  blocked=false
https://www.hltv.org/news/archive             HTTP=200  1.08s  size=544404   blocked=false
https://www.hltv.org/search?query=vitality    HTTP=200  0.81s  size=207745   blocked=false
```

### 4.2 `hltvfetch/fetcher.go` —— 可复用包

封装好的 library，带选项、重试、上下文、错误分类：

```go
f := hltvfetch.New(
    hltvfetch.WithTimeout(15*time.Second),
    hltvfetch.WithRetries(3),
)
body, err := f.Fetch(context.Background(), "/matches")
if err != nil {
    var fe *hltvfetch.FetchError
    if errors.As(err, &fe) {
        fmt.Println(fe.Code, fe.Retryable) // NETWORK/CHALLENGE/NOT_FOUND/SERVER/UNAVAILABLE
    }
}
```

错误码：

| Code | 含义 | Retryable |
|------|------|-----------|
| `NETWORK` | TCP/TLS 拨号失败 | true |
| `READ` | 读响应体失败 | true |
| `CHALLENGE` | Cloudflare 挑战页 | true |
| `NOT_FOUND` | 403/404 | false |
| `SERVER` | 5xx | true |
| `UNAVAILABLE` | 重试耗尽 | true |

## 五、接入主项目的方式

本范例是独立 module，不修改主项目。若要接入 `internal/client`，按以下步骤（**当前已回退，未接入**）：

1. 主项目 `go get github.com/refraction-networking/utls@latest`
2. 在 `internal/client/` 加 `utls_transport.go`，提供 `newImpersonatingTransport(profile, timeout)`（代码见 `hltvfetch/fetcher.go` 的 `newTransport`）
3. `NewHltvClient` 把 `httpCli` 的 `Transport` 换成 `newImpersonatingTransport(tlsutls.HelloIOS_Auto, timeout)`
4. `FetchHTML` 的 UA 改成 iOS Safari UA
5. 保留 `isCloudflareBlock` 检测和重试逻辑

主项目的 Firecrawl 回退路径可保留作为二线（若未来 iOS 指纹也被封），但不再是主路径。

## 六、环境要求与常见问题

### Go 版本

需要 Go 1.23+（utls v1.8.2 要求）。本机验证用 Go 1.26.4。

### GOPROXY（国内）

`proxy.golang.org` 被墙，必须切国内代理：

```powershell
go env -w GOPROXY=https://goproxy.cn,direct
```

### 依赖

```
github.com/refraction-networking/utls v1.8.2   # TLS 指纹伪装
golang.org/x/net v0.52.0                        # http2.Transport
```

间接依赖：`andybalholm/brotli`、`klauspost/compress`、`golang.org/x/crypto`。

### 常见问题

**Q: 为什么不用 curl-cffi / Python 方案？**
A: 主项目是 Go。utls 是 Go 原生方案，性能更好（连接复用 0.27s），无 Python 进程开销。Python curl_cffi 可作为跨语言验证参考（见下方对比）。

**Q: iOS 指纹被封怎么办？**
A: 换 `WithProfile(tlsutls.HelloFirefox_Auto)` 试试（Firefox 对 `/results` 等仍有效，但 `/matches` 当前不行）。长期方案：监控 utls 上游更新（新浏览器版本预设），或加 FlareSolverr 本地无头浏览器做二线。本范例的 `WithProfile` 选项支持运行时切换。

**Q: 需要代理吗？**
A: 不需要。实测从国内直连 HLTV，iOS 指纹即可过。Cloudflare 拦的是指纹不是 IP（住宅 IP 不是必要条件）。但若同一 IP 高频请求触发限流，可加代理 + 降低频率。

**Q: 速率限制？**
A: 未实测上限。建议保持单连接复用（http2.Transport 自带连接池），请求间隔 ≥200ms，避免触发 Cloudflare 的行为分析。本范例的 `Fetcher` 共享一个 `*http.Client`，默认即连接复用。

**Q: 合规性？**
A: 抓取公开网页数据，仅用于个人/研究用途。遵守 HLTV ToS，控制频率，不商业转售。Cloudflare 的封锁是技术防护不是法律禁止，绕过 TLS 指纹检测本身在多数司法辖区不违法，但应尊重目标站点的访问频率要求。

## 七、与其它方案对比

| 方案 | 是否过 `/matches` | 响应时间 | 依赖 | 成本 |
|------|------------------|---------|------|------|
| Go net/http 默认 | ❌ 403 | — | 无 | 免费 |
| curl + 浏览器 headers | ❌ 403 | — | 无 | 免费 |
| **Go utls (iOS 指纹)** | **✅ 200** | **0.27-1.5s** | utls 库 | **免费** |
| Python curl_cffi (firefox135) | ✅ 200 | 1-4s | curl_cffi | 免费 |
| firecrawl | ✅ | 90s+ | API key | 付费/额度 |
| FlareSolverr（本地无头浏览器） | ✅ | 5-15s | Docker + Chrome | 免费但重 |
| 商业解锁服务（Scrape.do 等） | ✅ | 1-3s | API key | 付费 |

**结论**：Go utls + iOS 指纹是纯本地、零成本、最快、最稳定的方案。

## 八、验证记录

- 日期：2026-06-23
- 环境：Windows 11，Go 1.26.4，国内直连（无代理）
- 工具：`go run ./examples/`（本范例）
- 结果：7/7 端点 HTTP 200，连续 8 次 `/matches` 全成功，响应 0.27-1.5s

如需复现，进入 `hltv-utls-fetch/` 目录执行：

```powershell
go env -w GOPROXY=https://goproxy.cn,direct
go run ./examples/
```
