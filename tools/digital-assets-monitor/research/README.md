# 全国信源建设工作目录

本目录是候选资料与发现任务，不是生产已接入信源列表。

- institution_candidates.csv / json：官方目录中的机构名称及证据；旧名单需核对更名、存续与官网。
- administrative_baseline_2024.json：从民政部官方2024年区划表提取，不能称为2026年最新区划。
- national_discovery_tasks.csv：公安按行政区划和交易机构按31省建立的待执行调查任务，任务数不是机构数。
- province_coverage.csv：全国覆盖缺口；候选不计入已验证或采集成功。
- build_initial_registry.py：重建首批官方基准，会刷新当前目录下上述文件；不修改线上数据库或sources.json。
- audit_channel_templates.py：对候选官网做可断点续跑的公开HTTP批量审计，并按CMS/页面结构聚类。默认不启用采集、不验证端点。
- public_resource_platform_candidates.json：31省区市及兵团公共资源交易平台候选，不是已接入来源。
- batch_audit/public_resource_platform/：2026-09-05公共资源省级入口审计结果。channel_audit_results.json为逐渠道记录，channel_template_groups.json为模板分组，channel_promotion_candidates.json仅表示可进入下一轮严格验证。
- audit_police_channels.py：公安候选门户探活与显式公安链接收获，不升级采集状态。

原始证据：
- https://gat.ln.gov.cn/gat/gsgawz50/index.shtml
- https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html
- https://wap.sasac.gov.cn/n2588030/n2588944/c16420921/content.html （2021名单，仅历史发现入口）
- https://www.nda.gov.cn/sjj/zhuanti/ztszzh/0902/20240830165252149196874_pc.html （2024名单）
- 技术交易机构的科技部证据链接记录在候选行中。

当前进度及后续验收见 ../docs/NATIONAL_SOURCE_PLAN.md。
