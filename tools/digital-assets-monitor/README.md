# 数字资产处置情报驾驶舱 (Digital Asset Disposal Intelligence Cockpit)

盯住「数字资产 / 虚拟货币处置」赛道的成品化情报监测工具。面向公安、法院、纪委监委、检察机关、财政罚没、产权/文交所数字资产挂牌、招投标、行业媒体与国际执法罚没等动态，每日扫描、无需手动浏览，**有新增才报告**，并以**管理驾驶舱**风格做可视化与统计分析。支持邀请码访问（不对外开放），可部署于阿里云，供内部与合作伙伴展示。

---

## 一、监控口径（信息源）

| 类别 | 关注点 | 主要源 |
|---|---|---|
| 公安机关 | 罚没财物处理、涉案虚拟货币查扣与变现 | 公安部、各地公安厅局、北京市局法青苑 |
| 人民法院 | 执行局涉案虚拟货币处置、网络司法拍卖 | 最高法、中国法院网、各地高院 |
| 纪委监委 | 收缴资产处置 | 中央纪委国家监委网站 |
| 人民检察院 | 涉案财物管理、指导案例 | 最高检 |
| 财政部门 | 罚没财物管理办法、上缴国库 | 财政部、省财政厅 |
| 产权/文交所 | 数字资产公开挂牌处置 | 北京产权交易所(北交互联)、山西/江西/安徽/广西/湖北华中/海南海文交/青岛等 |
| 招投标 | 数字资产处置招标/采购公告 | 中国政府采购网、全国公共资源交易平台 |
| 媒体/行业 | 首创模式、案例剖析 | 经济日报、21财经、财新、澎湃、新浪财经、金色财经、Odaily、链捕手 |
| 国际 | 美/欧/韩等执法罚没虚拟货币 | USMS、DOJ、OFAC/SEC/CFTC、Europol、Chainalysis |

合规背景参考：银发[2021]237号、财政部《罚没财物管理办法》、最高法网络司法拍卖规定、最高法指导案例199号。

## 二、技术架构

- 后端：**Python + FastAPI**，SQLite 存储（`data/monitor.db`），APScheduler 每日定时扫描。
- 采集：RSS + 定向网页爬虫 + 多引擎检索回溯（Bing 国际/中国站、DuckDuckGo），全部失败容错、记录健康度。
- 分析：自动分类（主体类型/行政区域/资产类型/处置方式/重要度/标签）、金额与机构抽取、中文简短分析。
- 前端：**自研高端暗色主题 + ECharts**（本地内置 `echarts.min.js`，离线可用）。含登录、KPI、趋势、主体/资产/处置/地域分布、信息源覆盖矩阵、来源排行、高价值情报、最新日报、情报入库与筛选、数据源健康度与扫描日志。
- 访问：邀请码 + HMAC 会话令牌，服务不对外开放。

## 三、快速开始（本地）

```bash
cd 工具
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# 生成数据 + 启动
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

启动前必须设置环境变量 `SESSION_SECRET`（至少 32 位随机字符）和 `INVITE_CODES`；没有内置有效邀请码。浏览器打开 `http://127.0.0.1:8000`，使用自行配置的邀请码登录。

首次启动为空数据库。原种子数据仅为未核实的演示素材（包含相对日期及首页链接），默认禁用，不用于生产。点击「立即扫描」或等待每日定时扫描采集公开信息。

## 四、目录结构

```
工具/
├─ config/            # settings / sources / keywords（源清单、关键词、分类、定时、邀请码）
├─ app/
│  ├─ main.py         # FastAPI 入口
│  ├─ database.py     # SQLite schema
│  ├─ config.py       # 配置加载
│  ├─ security.py     # 邀请码鉴权
│  ├─ report.py       # 日报（无新消息不报告）
│  ├─ scheduler.py    # 每日定时扫描
│  ├─ seed.py         # 种子数据
│  ├─ api/routes.py   # REST 接口
│  ├─ scraper/        # base / rss / web / search / pipeline
│  └─ analysis/       # classify / extract / summarize / stats
├─ static/            # 驾驶舱前端（index.html + css + js + 本地 echarts）
├─ scripts/           # run_scanner / generate_report / seed_data / check_sources
├─ deploy/            # Dockerfile / docker-compose / nginx / .env.example / 阿里云部署指南
├─ tests/             # 冒烟测试
└─ data/              # monitor.db（运行时生成）+ 日志
```

## 五、常用命令

```bash
# 单次扫描（结果 + 是否生成日报）
python scripts/run_scanner.py

# 查看/强制生成日报
python scripts/generate_report.py [--force]

# 追加/重置种子数据
python scripts/seed_data.py [--reset]

# 探测各信息源可达性与可解析性（部署后调优选择器）
python scripts/check_sources.py

# 冒烟测试（认证 + 核心接口）
python tests/smoke_test.py
```

## 六、阿里云部署

见 `deploy/deploy-guide.md`（二级域名 + Nginx HTTPS + Docker Compose + 邀请访问 + 首次源探测）。

## 七、产品要点

- **无新消息不报告**：每日扫描后若无新增情报则不生成日报，驾驶舱提示「今日无新增，按规则不生成」。
- **设计感与产品品质**：暗色数据驾驶舱、渐变高亮、KPI 卡片、多图表矩阵、可折叠详情，适合合作伙伴演示。
- **信息覆盖范围**：以「检索回溯 + RSS + 定向爬虫」三维采集，扩大覆盖；无法保证查全，受站点反爬和页面结构影响；源健康度可观测。
- **可持续运营**：数据源、关键词、分类均为外置 JSON 配置，可按赛道动态增删。

---

> 免责声明：本工具用于公开情报的收集、整理与分析，采集内容均来自公开渠道，用于内部监测与研究。
