# MUHUB 站点巡查与自动修复运维手册

> 适用架构：阿里云 ESA（中国内地边缘接入）→ Vercel 源站
> 最后更新：2026-05-13

---

## 一、架构概览

```
用户浏览器
    │
    ▼
阿里云 ESA 边缘节点（muhub.cn / www.muhub.cn）
    │  CNAME 解析 → ESA 节点
    │  HTTPS 证书由 ESA 终止
    ▼
Vercel 源站：muhub-murex.vercel.app
    │  Next.js 应用
    ▼
MUHUB 业务逻辑
```

| 端点 | 预期行为 |
|------|---------|
| `https://www.muhub.cn` | HTTP 200，ESA 边缘缓存/回源 |
| `https://muhub.cn` | HTTP 301/308 → `https://www.muhub.cn/` |
| `https://muhub-murex.vercel.app` | HTTP 200，Vercel 直访 |

---

## 二、快速开始

### 2.1 安装（零依赖）

脚本仅使用 Node.js 内置模块（`https`、`dns`、`tls`、`fs`），**无需 npm install**。

```bash
# 确认 Node.js 版本 >= 16
node --version

# 单次检测
npm run monitor:muhub-site

# 持续监控模式（每 5 分钟一次）
npm run monitor:muhub-site:watch
```

### 2.2 package.json 脚本配置

在项目根目录 `package.json` 中添加：

```json
{
  "scripts": {
    "monitor:muhub-site": "node scripts/monitor-muhub-site.js",
    "monitor:muhub-site:watch": "node scripts/monitor-muhub-site.js --watch"
  }
}
```

---

## 三、环境变量配置

> ⚠️ **绝不在代码中硬编码任何密钥或 Webhook URL**

在项目根目录创建 `.env.monitor`（已加入 `.gitignore`）：

```bash
# ── 通知渠道（至少配置一个，否则仅写日志文件）──────────────

# 飞书机器人 Webhook
NOTIFY_FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx

# 企业微信机器人 Webhook
NOTIFY_WECOM_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx

# Telegram Bot（需自行创建 Bot 并获取 Chat ID）
NOTIFY_TELEGRAM_TOKEN=1234567890:AAXXXXXXXXXXXXXXXXXXXXXXXX
NOTIFY_TELEGRAM_CHAT_ID=-1001234567890

# ── 监控参数 ────────────────────────────────────────────────

# 检测间隔（毫秒），默认 300000（5 分钟）
MONITOR_INTERVAL_MS=300000

# 日志文件路径，默认 logs/muhub-monitor.log
LOG_FILE=logs/muhub-monitor.log
```

加载环境变量后运行：

```bash
# 方式一：手动加载
export $(cat .env.monitor | grep -v '^#' | xargs) && npm run monitor:muhub-site

# 方式二：使用 dotenv-cli（可选）
npx dotenv-cli -e .env.monitor -- npm run monitor:muhub-site
```

---

## 四、定时任务配置

### 4.1 Linux / macOS crontab（推荐生产使用）

```bash
# 编辑 crontab
crontab -e
```

添加以下内容（根据实际路径修改）：

```cron
# MUHUB 站点巡查：每 5 分钟执行一次
*/5 * * * * cd /path/to/muhub && node scripts/monitor-muhub-site.js >> logs/muhub-cron.log 2>&1

# 可选：每天 09:00 发送日报
0 9 * * * cd /path/to/muhub && node scripts/monitor-muhub-site.js >> logs/muhub-daily.log 2>&1
```

验证 crontab 是否生效：

```bash
crontab -l
tail -f logs/muhub-monitor.log
```

### 4.2 GitHub Actions 定时运行

创建 `.github/workflows/muhub-monitor.yml`：

```yaml
name: MUHUB 站点巡查

on:
  schedule:
    # UTC 时间，每 5 分钟（注意：GitHub Actions 最小间隔为 5 分钟）
    - cron: '*/5 * * * *'
  workflow_dispatch:  # 支持手动触发

jobs:
  monitor:
    runs-on: ubuntu-latest
    timeout-minutes: 3

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 运行站点巡查
        env:
          NOTIFY_FEISHU_WEBHOOK:  ${{ secrets.NOTIFY_FEISHU_WEBHOOK }}
          NOTIFY_WECOM_WEBHOOK:   ${{ secrets.NOTIFY_WECOM_WEBHOOK }}
          NOTIFY_TELEGRAM_TOKEN:  ${{ secrets.NOTIFY_TELEGRAM_TOKEN }}
          NOTIFY_TELEGRAM_CHAT_ID: ${{ secrets.NOTIFY_TELEGRAM_CHAT_ID }}
          LOG_FILE: /tmp/muhub-monitor.log
        run: node scripts/monitor-muhub-site.js

      - name: 上传日志（失败时）
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: monitor-log-${{ github.run_id }}
          path: /tmp/muhub-monitor.log
```

> **Secrets 配置方式**：GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret

---

## 五、故障类型与处理手册

### 5.1 故障类型速查表

| 故障类型 | 触发条件 | 影响层级 |
|---------|---------|---------|
| `DNS_NOT_ESA` | CNAME 未指向 ESA 节点 | 全站不可访问 |
| `ESA_REACHABLE_ORIGIN_FAIL` | ESA 正常但回源返回非 200 | 全站不可访问 |
| `VERCEL_UNREACHABLE` | Vercel 源站 5xx 或超时 | 全站不可访问 |
| `CERT_INVALID` | HTTPS 证书过期或 TLS 握手失败 | HTTPS 不可用 |
| `CERT_EXPIRING` | 证书剩余天数 < 30 天 | 预警，暂不影响 |
| `ROOT_REDIRECT_WRONG` | muhub.cn 未 301/308 跳转 | 根域名备案核查失败 |
| `NETWORK_TIMEOUT` | 多端点超时 | 可能是本地网络问题 |
| `HTTP_NON_200` | www 返回非 200 | 部分功能异常 |

### 5.2 逐类处理步骤

#### `DNS_NOT_ESA` — DNS 未指向 ESA

```bash
# 1. 本地验证
dig www.muhub.cn CNAME
dig www.muhub.cn A

# 2. 第三方验证（排除本地 DNS 缓存影响）
curl "https://dns.google/resolve?name=www.muhub.cn&type=CNAME"
```

人工操作：
1. 登录 [阿里云 DNS 控制台](https://dns.console.aliyun.com)
2. 找到 `muhub.cn` 域名，确认 `www` 子域名的 CNAME 记录
3. CNAME 值应为 ESA 分配的加速域名（格式类似 `xxx.esanetwork.com` 或 `xxx.aliyuncs.com`）
4. 若 CNAME 错误，修改后等待 TTL 刷新

#### `ESA_REACHABLE_ORIGIN_FAIL` — ESA 回源失败

1. 登录 [ESA 控制台](https://esa.console.aliyun.com)
2. 进入「加速域名」→ `www.muhub.cn` → 「回源配置」
3. 检查：
   - 源站类型：自定义域名
   - 源站地址：`muhub-murex.vercel.app`
   - 回源协议：HTTPS
   - 回源端口：443
   - **回源 Host**：`muhub-murex.vercel.app`（关键！不能是 `www.muhub.cn`）
4. 使用「ESA 诊断」→「节点网络测试」测试回源链路

#### `VERCEL_UNREACHABLE` — Vercel 源站不可达

```bash
# 直接访问 Vercel 源站
curl -I https://muhub-murex.vercel.app

# 查看 Vercel 状态
curl https://www.vercelstatus.com/api/v2/summary.json | python3 -m json.tool
```

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到 `muhub-murex` 项目，查看 Deployments 状态
3. 若部署失败，查看构建日志并修复
4. 若 Vercel 平台故障，在 ESA 控制台临时开启「回源失败缓存」

#### `CERT_INVALID` — 证书无效

```bash
# 检查证书详情
openssl s_client -connect www.muhub.cn:443 -servername www.muhub.cn 2>/dev/null | openssl x509 -noout -dates -issuer
```

1. 进入「ESA 控制台」→「证书管理」
2. 确认 `www.muhub.cn` 已关联有效证书
3. 若证书过期：在[数字证书管理服务](https://yundun.console.aliyun.com)申请新证书
4. 新证书申请后，在 ESA 重新绑定

#### `ROOT_REDIRECT_WRONG` — 根域名跳转异常

```bash
# 测试根域名跳转
curl -I https://muhub.cn
# 预期：HTTP/1.1 301  Location: https://www.muhub.cn/
```

在 ESA 控制台配置重定向规则（适用于 `muhub.cn`）：
```
条件：Host = muhub.cn
动作：URL 重定向
  类型：301
  目标 URL：https://www.muhub.cn${request_uri}
```

---

## 六、日志说明

### 日志格式

```
[2026-05-13 08:00:01 UTC] [OK   ] ✅ www.muhub.cn  HTTP 200  耗时 342ms
[2026-05-13 08:00:02 UTC] [WARN ] ⚠️  根域名跳转异常: 首跳 302 → http://www.muhub.cn/
[2026-05-13 08:00:03 UTC] [ERROR] ❌ Vercel 源站  网络错误: connect ETIMEDOUT
[2026-05-13 08:00:03 UTC] [ALERT] 🚨 [MUHUB 站点告警] ...
```

### 日志级别

| 级别 | 含义 |
|------|------|
| `INFO` | 普通过程信息 |
| `OK` | 检测项通过 |
| `WARN` | 检测异常但未达告警阈值 |
| `ERROR` | 检测失败 |
| `ALERT` | 连续失败达阈值，已触发告警通知 |

### 日志轮转（推荐）

使用 `logrotate`（Linux）：

```
# /etc/logrotate.d/muhub-monitor
/path/to/muhub/logs/muhub-monitor.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
```

---

## 七、备案接入核查检查清单

> 阿里云 ESA 要求通过备案核查的检测项

- [ ] `www.muhub.cn` HTTP 200，内容为正常页面
- [ ] `muhub.cn` → 301/308 跳转到 `https://www.muhub.cn/`
- [ ] 两个域名均已完成 ICP 备案
- [ ] 两个域名均已在 ESA 添加为加速域名
- [ ] ESA 节点已配置有效 HTTPS 证书
- [ ] 页面底部或网站公示 ICP 备案号（如：京ICP备XXXXXXXX号）
- [ ] 服务器/源站在中国大陆境内，或已通过 ESA 接入合规

---

## 八、常见问题

**Q: CNAME 已正确，但 `DNS_NOT_ESA` 告警持续出现？**

A: ESA 节点 CNAME 域名格式可能与脚本内置关键字不匹配。查看实际 CNAME 值，然后更新 `CONFIG.esaCnameKeywords` 数组中的关键字。

**Q: 在中国大陆服务器运行脚本，访问 Vercel 超时是否正常？**

A: 正常现象。Vercel 源站直连在中国大陆可能较慢或不稳定，这正是引入 ESA 的原因。若通过 `www.muhub.cn`（经过 ESA）可以正常访问，而 `vercel.app` 直连超时，属于预期行为。

**Q: GitHub Actions 的 5 分钟最小间隔如何处理？**

A: GitHub Actions 定时任务最小间隔就是 5 分钟，与本方案一致。若需要更高频率监控（如 1 分钟），建议改用专用 VPS 运行 crontab。

**Q: 如何测试告警通知是否配置正确？**

A: 临时将 `CONFIG.alertThreshold` 设为 `1`，然后断开网络运行脚本，触发告警后查看是否收到通知。测试完成后恢复为 `2`。

---

## 九、相关资源

- [阿里云 ESA 控制台](https://esa.console.aliyun.com)
- [阿里云 DNS 控制台](https://dns.console.aliyun.com)
- [数字证书管理服务](https://yundun.console.aliyun.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel 状态页](https://www.vercelstatus.com)
- [飞书机器人配置指南](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot)
- [企业微信机器人配置](https://developer.work.weixin.qq.com/document/path/91770)
