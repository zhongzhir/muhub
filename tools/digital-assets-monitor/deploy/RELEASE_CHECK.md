# 2026-09-04 发布检查

目标仓库：zhongzhir/muhub；独立目录 tools/digital-assets-monitor。
拟用域名：monitor.muhub.cn；独立回环端口：18080。

已修复：SQL 动态字段白名单、分页上限、默认认证密钥拒绝启动、登录限流、危险链接拦截、前端 HTTP 错误处理、手动扫描异步化及进程内互斥、RSS/网页/搜索失败识别、事务回滚后的新增计数、来源数量统计、币种统计、重复日报、相关性过滤、测试数据库隔离。

生产默认不注入种子数据。原种子素材并未逐条核实，不可作为真实新闻。默认邀请码和密钥已移除。数据、虚拟环境、真实 .env 不上传。

本地验证：流水线测试、API 冒烟、12 项安全回归通过。Windows Python 3.14 环境验证；Linux Docker 构建、服务器信息源可达性、DNS、HTTPS、每日任务尚待线上验证。

采集局限：无法保证查全；搜索查询部分失败时仍可能返回部分结果；网页日期提取依赖页面结构，未知日期保留为空；配置中的 lookback_days_search 尚未作为全源日期窗口实施。规则分类及金额抽取需人工复核。

部署要求：先检查现有 Nginx、端口和服务器资源，使用独立服务；单进程运行，不另设扫描 cron。设置随机 SESSION_SECRET 与 INVITE_CODES，创建 monitor DNS 记录并配置对应证书，nginx -t 后再 reload。不要重启 MUHUB 主站进程。

当前阻塞：Codex 浏览器工具因 CodexSandboxOffline SID 解析错误无法启动；现有 SSH 密钥被服务器拒绝。尚未修改服务器/DNS，尚未部署。
