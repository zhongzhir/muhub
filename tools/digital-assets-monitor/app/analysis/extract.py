"""结构化抽取：金额、数量、机构名。"""
import re


def _fmt_money(m):
    return float(f"{m:.2f}")


def extract_amount(text):
    """返回 (金额数值, 币种)。币种人民币/美元。单位自动换算为基本单位。"""
    if not text:
        return None, None
    text = text.replace(",", "").replace("，", "")
    # 亿 / 万 / 千 单位人民币
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(亿元|亿欧元|亿美金|亿美元|亿)(人民币|元)?", text)
    if m:
        val = float(m.group(1))
        cur = m.group(3) or "人民币"
        if "美元" in m.group(2) or "美金" in m.group(2):
            cur = "美元"
        return _fmt_money(val * 1e8), cur
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(万欧元|万美金|万美元|万元)(人民币|元)?", text)
    if m:
        val = float(m.group(1))
        cur = m.group(3) or "人民币"
        if "美元" in m.group(2) or "美金" in m.group(2):
            cur = "美元"
        return _fmt_money(val * 1e4), cur
    # 枚数：BTC/ETH/USDT 枚数
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(万)?\s*(枚|枚(比特币|以太坊|泰达币)|个|枚虚拟)?\s*(比特币|以太币|泰达币|虚拟货币)?", text)
    if m and any(k in text for k in ["枚", "比特币", "以太", "泰达", "虚拟货币"]):
        val = float(m.group(1))
        if m.group(2) == "万":
            val *= 1e4
        return _fmt_money(val), "枚"
    return None, None


def extract_institution(text):
    """抽取交易/公司/机关名称。"""
    if not text:
        return None
    # 常见产权交易所/交易中心
    patterns = [
        r"([\u4e00-\u9fa5]{2,12}(?:产权交易所|产权交易中心|文化产权交易所|数字资产交易所|金融资产交易中心|公共资源交易中心|股权交易中心|国际边境合作中心))",
        r"(北京产权交易所|公安部第一研究所|公安部第三研究所|中天锋|香港金融交易及服务有限公司|国家富有限公司|国富创新|哈希键|HashKey|OSL)",
        r"([\u4e00-\u9fa5]{2,12}(?:公安局|公安厅|分局|人民法院|法院|监督检查|纪检|监委|检察院|检察(院)?|公安网安))",
        r"([\u4e00-\u9fa5]{2,12}(?:处置服务中心|数字资产服务中心|技术(?:服务|有限公司)|网络科技公司|律师事务所))",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            return m.group(1)
    return "(未识别机构)"
