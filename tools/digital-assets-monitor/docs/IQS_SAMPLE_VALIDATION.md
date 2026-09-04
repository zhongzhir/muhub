# IQS小样本验证

用户授权：2026-09-04，同意最多10次验证。不是生产付费批量采集授权。

脚本 scripts/probe_iqs.py 独立于定时采集：每次最多两个查询，累计尝试上限10；发请求前通过Linux文件锁和fsync持久化计数（/var/lib/digital-assets-monitor/iqs-probe-attempts.txt），失败和超时也消耗次数，不自动重试。不删除/重置计数。不能绕过上限重新创建预算文件。实际用量以阿里云账单为准。

固定LiteAdvanced，关闭summary/markdownText/rerankScore，不调用增值API。当前官方单价12元/千次，10次约0.12元；控制台开通的套餐或其他费用不包含在此估算中。开通页面若要求购买额外套餐，先停止并报告。

IQS_API_KEY只写服务器 /etc/digital-assets-monitor.env，不上传、不打印。脚本仅输出公开结果样本和计数，原始样本保存在受限文件中，不自动入库。

官方依据：
- https://help.aliyun.com/zh/document_detail/2883041.html
- https://help.aliyun.com/zh/document_detail/2862023.html
- https://help.aliyun.com/zh/document_detail/2869993.html

官方开通说明提示试用额度耗尽或期限结束可能转正式计费，不能把试用视为无限免费；本脚本独立限制10次。全国批量接入另行确定预算、检索质量、配额和开通条件。

同批修复：已有HTML搜索引擎连续3次失败或无可用结果后暂停10分钟（并发在途请求可能仍完成）；直接网页采集先于搜索运行。这些改变尚需部署。
