"""结构化抽取：金额、数量、机构名。数量必须与单位/币种紧邻，并保留原文证据。"""
import re

_ASSET_WORDS = (
    "比特币", "以太坊", "以太币", "泰达币", "虚拟货币", "虚拟币",
    "USDT", "USDC", "BTC", "ETH",
)
_ASSET_ALT = "|".join(_ASSET_WORDS)
_TICKER_ALT = r"BTC|ETH|USDT|USDC"
_HYPOTHETICAL_PREFIX = re.compile(
    r"(如果|若|假如|例如|比如|应当|可以|可|或)在?\s*$"
)
_ROLE_FILLER = re.compile(r"充分发挥\s*$")
# 年份、日期、法条、编号等不得当作数量
_NON_QUANTITY_AFTER = re.compile(
    r"^(年|月|日|条|号|页|期|章|款|届|项|号文|号公告|号决定)"
)
_DATE_AFTER = re.compile(r"^[-/.年]\d{1,2}([-/.月]\d{1,2})?")
_CASE_AFTER = re.compile(r"^[)）]\s*[\u4e00-\u9fa5A-Za-z]{0,6}(刑|民|执|赔|财)")


def _fmt_num(val):
    return float(f"{val:.2f}")


def _is_non_quantity_context(text, start, end):
    before = text[max(0, start - 2):start]
    after = text[end:end + 12]
    if _NON_QUANTITY_AFTER.match(after) or _DATE_AFTER.match(after) or _CASE_AFTER.match(after):
        return True
    if before.endswith("第") and after.startswith("条"):
        return True
    if re.search(r"第\s*$", before) and after.startswith("条"):
        return True
    return False


def _widen_evidence(text, start, end, must_contain):
    window_start = max(0, start - 16)
    window_end = min(len(text), end + 20)
    span = text[window_start:window_end].strip()
    for token in must_contain:
        if token and token not in span:
            return None
    return span


def extract_amount(text):
    """返回 (数值, 币种, 原文证据)。证据不足时三者均为 None。

    数量必须与明确单位或币种紧邻，例如「2026枚比特币」「144 枚 USDT」
    「2.5万枚以太币」「100 BTC」。年份、法条、编号不得作为数量。
    """
    if not text:
        return None, None, None
    compact = text.replace(",", "").replace("，", "")
    candidates = []

    coin_count = re.compile(
        rf"(?P<span>(?P<num>[0-9]+(?:\.[0-9]+)?)\s*(?P<wan>万)?\s*余?\s*枚\s*"
        rf"(?:涉案|罚没|的)?\s*(?P<asset>{_ASSET_ALT}))",
        re.I,
    )
    ticker_count = re.compile(
        rf"(?P<span>(?P<num>[0-9]+(?:\.[0-9]+)?)\s*(?P<wan>万)?\s*(?P<asset>{_TICKER_ALT})\b)",
        re.I,
    )
    coin_plain = re.compile(
        rf"(?P<span>(?P<num>[0-9]+(?:\.[0-9]+)?)\s*(?P<wan>万)?\s*(?P<asset>比特币|以太坊|以太币|泰达币))",
    )
    money = re.compile(
        r"(?P<span>(?P<num>[0-9]+(?:\.[0-9]+)?)\s*(?P<unit>亿美元|亿美金|亿元|万元|万美元|万美金|人民币|美元|美金|元))"
    )

    for rx, kind in (
        (coin_count, "枚"),
        (ticker_count, "枚"),
        (coin_plain, "枚"),
        (money, "money"),
    ):
        for m in rx.finditer(compact):
            start, end = m.start("span"), m.end("span")
            if _is_non_quantity_context(compact, start, end):
                continue
            val = float(m.group("num"))
            if m.groupdict().get("wan"):
                val *= 1e4
            asset = (m.groupdict().get("asset") or "").strip()
            unit = (m.groupdict().get("unit") or "").strip()
            if kind == "枚":
                currency = "枚"
                required = [m.group("num"), asset]
                if "枚" in m.group("span"):
                    required.append("枚")
            else:
                if "美元" in unit or "美金" in unit:
                    currency = "美元"
                    if "亿" in unit:
                        val *= 1e8
                    elif "万" in unit:
                        val *= 1e4
                else:
                    currency = "人民币"
                    if "亿" in unit:
                        val *= 1e8
                    elif "万" in unit:
                        val *= 1e4
                required = [m.group("num"), unit]
            evidence = _widen_evidence(compact, start, end, required)
            if not evidence:
                continue
            if kind == "枚" and not any(a.lower() in evidence.lower() for a in _ASSET_WORDS):
                continue
            if kind == "money" and not any(u in evidence for u in ("元", "人民币", "美元", "美金")):
                continue
            candidates.append((start, _fmt_num(val), currency, evidence))

    if not candidates:
        return None, None, None
    candidates.sort(key=lambda row: row[0])
    _, value, currency, evidence = candidates[0]
    return value, currency, evidence


def extract_institution(text):
    """抽取事件主体机构名。讨论、假设、作者单位片段不作为事件主体。"""
    if not text:
        return None
    patterns = [
        r"([\u4e00-\u9fa5]{2,12}(?:产权交易所|产权交易中心|文化产权交易所|数字资产交易所|金融资产交易中心|公共资源交易中心|股权交易中心|国际边境合作中心))",
        r"(北京产权交易所|公安部第一研究所|公安部第三研究所|中天锋|香港金融交易及服务有限公司|国富创新|哈希键|HashKey|OSL)",
        r"([\u4e00-\u9fa5]{2,16}(?:公安局|公安厅|公安分局|人民法院|人民检察院|纪委监委|财政厅|财政局))",
        r"([\u4e00-\u9fa5]{2,12}(?:处置服务中心|数字资产服务中心|律师事务所))",
    ]
    for pat in patterns:
        for m in re.finditer(pat, text):
            name = m.group(1)
            prefix = text[max(0, m.start() - 8):m.start()]
            if _HYPOTHETICAL_PREFIX.search(prefix) or _ROLE_FILLER.search(prefix):
                continue
            if name in ("法院", "检察", "人民检察院", "人民法院") and len(name) <= 6:
                # 裸机关通称，不足以证明具体事件主体
                if not re.search(r"(市|县|区|省|最高)", name):
                    continue
            if "充分发挥" in name:
                continue
            return name
    return None
