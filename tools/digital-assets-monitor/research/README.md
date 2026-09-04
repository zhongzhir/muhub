# 全国信源建设工作目录

本目录是候选资料与发现任务，不是生产已接入信源列表。

- institution_candidates.csv / json：官方目录中的机构名称及证据；旧名单需核对更名、存续与官网。
- administrative_baseline_2024.json：从民政部官方2024年区划表提取，不能称为2026年最新区划。
- national_discovery_tasks.csv：公安按行政区划和交易机构按31省建立的待执行调查任务，任务数不是机构数。
- province_coverage.csv：全国覆盖缺口；候选不计入已验证或采集成功。
- build_initial_registry.py：重建首批官方基准，会刷新当前目录下上述文件；不修改线上数据库或sources.json。

原始证据：
- https://gat.ln.gov.cn/gat/gsgawz50/index.shtml
- https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html
- https://wap.sasac.gov.cn/n2588030/n2588944/c16420921/content.html （2021名单，仅历史发现入口）
- https://www.nda.gov.cn/sjj/zhuanti/ztszzh/0902/20240830165252149196874_pc.html （2024名单）
- 技术交易机构的科技部证据链接记录在候选行中。

当前进度及后续验收见 ../docs/NATIONAL_SOURCE_PLAN.md。
