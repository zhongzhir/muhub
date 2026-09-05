# 阿里云部署指南 · 数字资产处置情报驾驶舱

本指南用于将该工具部署到阿里云 ECS，通过**正式网站的二级域名**以 HTTPS 提供**邀请访问**（不对外开放），供内部与合作伙伴展示使用。

> 前置条件
> - 一台阿里云 ECS（建议 2C4G 及以上），已安装 **Docker** 与 **Docker Compose**
> - 一个已通过工信部备案的**正式网站一级域名**（例如 `example.com`）
> - 准备一个**二级域名**用于本系统（例如 `monitor.example.com`），并在域名解析处添加 A 记录指向 ECS 公网 IP
> - 阿里云 SSL 证书（免费版即可）用于 HTTPS

---

## 1. 解析二级域名（阿里云 DNS）

1. 打开「云解析 DNS」→ 选中你的域名 `example.com`。
2. 添加一条记录：
   - 记录类型：`A`
   - 主机记录：`monitor`（即 `monitor.example.com`）
   - 记录值：ECS 公网 IP
3. 等待解析生效（`ping monitor.example.com` 能解析到 IP 即成功）。

## 2. 安装 Docker / Docker Compose

```bash
curl -fsSL https://get.docker.com | bash -s docker
sudo systemctl enable --now docker
# 安装 compose 插件（新版 docker 自带 compose 命令）
docker compose version
```

## 3. 上传项目并完成配置

将 `工具` 目录整体上传到服务器，例如 `/opt/dzs`：

```bash
sudo mkdir -p /opt/dzs && sudo chown -R $USER /opt/dzs
# 用 scp / 阿里云 ECS 助手上传后解压
```

进入部署目录，复制并编辑环境变量：

```bash
cd /opt/dzs/deploy
cp .env.example .env
vim .env
```

在 `.env` 中：
- 设置 `SESSION_SECRET=` 为一段足够长的随机字符串（用于签发访问会话令牌）
- 设置 `INVITE_CODES=` 为你的邀请码（可多个，用英文逗号分隔；**对外展示前务必替换默认值**）
- 时区保持 `Asia/Shanghai`

## 4. 调整信息源与配置（可选）

应用默认配置位于 `config/`：

- `config/settings.json`：服务端口、每日扫描时间、会话时长、扫描超时等。
- `config/sources.json`：可增删信息源；各源已内置通用选择器。
- `config/keywords.json`：关键词、分类、检索 query，可扩展。

> 服务器在境内网络，可正常访问 .cn 政府/交易所站点。首次部署后建议运行信息源探测脚本，按输出微调个别源的选择器：
>
> ```bash
> cd /opt/dzs
> python scripts/check_sources.py
> ```

## 5. 构建并启动

```bash
cd /opt/dzs/deploy
docker compose up -d --build
docker compose ps        # 应看到 dzs-cockpit 处于 Up/healthy
```

应用监听在 `127.0.0.1:18080`（仅本机回环），由 Nginx 对外提供 HTTPS。

## 6. 配置 Nginx（HTTPS 二级域名）

安装 Nginx 并启用反向代理配置文件：

```bash
sudo apt update && sudo apt install -y nginx
```

1. 将 CA/B、证书下载（阿里云「数字证书管理服务」→ 申请/下载 Nginx 格式证书），上传到 `/etc/nginx/certs/`：
   - `monitor.example.com.pem`
   - `monitor.example.com.key`

```
# 目录结构示例
/etc/nginx/certs/monitor.example.com.pem
/etc/nginx/certs/monitor.example.com.key
```

2. 复制 `deploy/nginx/digital-assets-monitor.conf` 到 Nginx 站点目录，并替换其中的 `<二级域名>`：

```bash
sudo cp /opt/dzs/deploy/nginx/digital-assets-monitor.conf /etc/nginx/sites-available/dzs
sudo sed -i 's/<二级域名>/monitor.example.com/g' /etc/nginx/sites-available/dzs
sudo ln -sf /etc/nginx/sites-available/dzs /etc/nginx/sites-enabled/dzs
sudo nginx -t && sudo systemctl reload nginx
```

## 7. 配置安全组与防火墙

- 在 **专有网络 → 安全组** 添加入方向放行 `80`、`443`（对公网）。
- 服务器防火墙：
  ```bash
  sudo ufw allow 80,443/tcp && sudo ufw enable
  ```
- `127.0.0.1:18080` 不对外暴露，仅本机 Nginx 反向代理，安全。

## 8. 进入系统

浏览器访问 `https://monitor.example.com` → 输入 `.env` 中设置的**邀请码**登录。

## 9. 每日自动扫描

仅运行单个应用进程，内置定时器默认每周五 19:00（Asia/Shanghai）扫描。不要再配置额外 cron，以免多个进程同时采集。手动扫描为后台任务，界面自动查询进度。

## 10. 备份与升级

- 数据（SQLite）持久化在 `data/`，定期备份 `data/monitor.db`。
- 升级：拉取新代码后重新 `docker compose up -d --build`，数据卷保持不变。

## 常见问题

- **登录提示邀请码无效**：核对 `.env` 的 `INVITE_CODES` 与安全组放行；确认未使用默认值。
- **浏览器提示不安全**：证书路径/文件名与 nginx 配置不一致，或 `nginx -t` 报错。
- **没有情报新增/日报为空**：属正常（无新消息不报告）。可先在管理驾驶舱点「立即扫描」验证采集，或查看「数据源与运行」页的健康度与扫描日志。
- **个别信息源抓取失败**：多为站点结构/反爬变化，运行 `python scripts/check_sources.py` 查看，按输出微调 `config/sources.json` 中的选择器。
