"""分类与标注：机构类型、行政区域、资产类型、处置方式、重要度、标签。"""
import re
from app.config import get_keywords

NATURE_CASE = "案件信息"
NATURE_POLICY = "政策或制度指导"
NATURE_NOTICE = "处置公告或交易机会"
NATURE_EXPERIENCE = "可借鉴的管理经验"
NATURE_RISK = "行业风险信号"
NATURE_RESEARCH = "理论研究"

_GENERIC_ASSETS = ["虚拟货币", "虚拟币", "数字货币", "加密资产", "数字资产", "加密货币", "代币"]
_HYPOTHETICAL_INST = re.compile(
    r"(如果|若|假如|例如|比如|应当|可以|可|或)在?.{0,12}(法院|检察|公安|纪委|监委)"
)
_ROLE_FILLER_INST = re.compile(r"充分发挥.{0,10}(检察|法院|公安|纪委)")


def _has(text, patterns):
    text = (text or "").lower()
    for p in patterns:
        if p.lower() in text:
            return True
    return False


def _event_institution_text(text):
    t = text or ""
    t = _HYPOTHETICAL_INST.sub("", t)
    t = _ROLE_FILLER_INST.sub("", t)
    return t


_FORMAL_NOTICE = re.compile(r"(挂牌公告|成交公告|拍卖公告|转让公告|竞价公告|中标公告)")
_CASE_FACT = re.compile(r"(判决|裁定|被告人|案号|刑初|刑终|犯罪嫌疑人)")
_COMPLETED_ACTION = re.compile(
    r"(首次成功处置|成功变现|回流入境|经.{0,12}持牌交易所变现|已扣押|查获|"
    r"公开挂牌|已经成交|成交价)"
)
_NAMED_SUBJECT = re.compile(r"(公安局|公安厅|人民法院|检察院|产权交易所|财政厅|财政局|监委)")
_ASSET_OBJECT = re.compile(r"(比特币|以太坊|以太币|泰达币|虚拟货币|数字资产|USDT|USDC|BTC|ETH)")
_DISCUSSION = re.compile(r"(研究|理论|法理|分析|探讨|建议|制度|机制|应当|可以|本文|若干问题)")
_RESEARCH_SIGNAL = re.compile(r"(研究|理论|法理|分析|探讨|若干问题|本文)")
_POLICY_SIGNAL = re.compile(r"(制度|机制|建议|应当|可以|完善程序|管理办法|指导意见)")


def _has_notice_evidence(title, text):
    """处置公告必须有正式公告标题，或已发生动作 + 具体主体 + 对象。"""
    blob = f"{title or ''}\n{text or ''}"
    if _FORMAL_NOTICE.search(title or "") or _FORMAL_NOTICE.search(blob):
        return True
    return bool(_COMPLETED_ACTION.search(blob) and _NAMED_SUBJECT.search(blob) and _ASSET_OBJECT.search(blob))


def classify_information_nature(title, text, url="", source_name="", source_category=""):
    """区分案件、公告、政策、研究等，避免把讨论文包装成处置事件。"""
    title = title or ""
    text = text or ""
    url = (url or "").lower()
    blob = f"{title}\n{text}"
    source_blob = f"{source_name or ''} {source_category or ''}"
    notice = _has_notice_evidence(title, text)
    case = bool(_CASE_FACT.search(blob))

    if "/llyj/" in url or "理论研究" in blob or "理论研究" in source_blob:
        if any(k in title for k in ("完善程序", "质效", "制度建议", "机制")):
            return NATURE_POLICY
        return NATURE_RESEARCH
    if any(k in title for k in ("法理", "双重意蕴", "理论研究")):
        return NATURE_RESEARCH
    if _FORMAL_NOTICE.search(title) or _FORMAL_NOTICE.search(blob):
        return NATURE_NOTICE
    if case:
        return NATURE_CASE
    if notice:
        return NATURE_NOTICE
    if re.search(r"签署.{0,12}框架协议", blob):
        return NATURE_EXPERIENCE
    if re.search(r"(管理办法|指导意见|工作通知|印发.*办法|制度建设)", blob):
        return NATURE_POLICY
    if _DISCUSSION.search(blob):
        if _RESEARCH_SIGNAL.search(title) or _RESEARCH_SIGNAL.search(blob):
            return NATURE_RESEARCH
        if _POLICY_SIGNAL.search(blob):
            return NATURE_POLICY
        return NATURE_RESEARCH
    if re.search(r"(风险预警|行业风险|洗钱风险)", blob):
        return NATURE_RISK
    return NATURE_POLICY


def allows_event_attributes(nature):
    """仅案件、处置公告和可核实的实践经验允许填写事件主体/地域/处置方式。"""
    return nature in {NATURE_CASE, NATURE_NOTICE, NATURE_EXPERIENCE}


def classify_institution_type(text):
    kw = get_keywords().get("institution_types", {})
    scoped = _event_institution_text(text)
    order = ["纪委监委", "纪检监察", "人民法院", "人民检察院", "公安机关", "财政部门",
             "产权交易所", "境外处置机构", "持牌交易平台", "持有牌交易平台", "第三方处置公司", "律所/研究"]
    for tpe in order:
        if tpe not in kw:
            continue
        patterns = [p for p in kw[tpe] if p not in ("检察", "反诈")]
        if tpe == "人民检察院":
            patterns = [p for p in patterns if p in ("检察院", "人民检察院")] or ["检察院", "人民检察院"]
        if tpe == "人民法院":
            patterns = [p for p in patterns if p != "法庭"]
        if _has(scoped, patterns):
            return tpe
    return "其他"


def classify_source_category(text):
    item_text = (text or "").lower()
    if _has(text, ["境外", "美国", "法警局", "司法部", "欧洲刑警", "chainalysis", "海外", "hk", "香港"]):
        return "国际" if _has(text, ["usms", "doj", "europol", "chainalysis", "美国", "司法部", "法警局", "境外证券", "hong kong", "hk"] + ["美国", "欧洲", "日本", "韩国"]) else "其他"
    return None


_REGIONS = [
    "北京", "上海", "天津", "重庆",
    "广东", "深圳", "广州", "浙江", "杭州", "温州", "江苏", "苏州", "南京",
    "山东", "青岛", "山西", "安徽", "广西", "江西", "河南", "湖北", "武汉",
    "湖南", "四川", "成都", "贵州", "云南", "陕西", "西安", "甘肃", "新疆",
    "黑龙江", "吉林", "辽宁", "海南", "福建", "厦门", "内蒙古", "宁夏", "青海", "西藏", "香港",
]


def classify_region(text):
    found = [r for r in _REGIONS if r in (text or "")]
    if not found:
        return None
    # 优先返回省会/细粒度
    order = ["深圳", "广州", "杭州", "温州", "苏州", "南京", "青岛", "武汉", "成都", "西安",
             "北京", "上海", "天津", "重庆", "广东", "浙江", "江苏", "山东", "山西", "安徽",
             "广西", "江西", "河南", "湖北", "湖南", "四川", "贵州", "云南", "陕西", "甘肃",
             "新疆", "黑龙江", "吉林", "辽宁", "海南", "福建", "厦门", "内蒙古", "宁夏", "青海", "西藏", "香港"]
    for r in order:
        if r in found:
            return r
    return found[0]


def classify_asset_types(text):
    kw = get_keywords().get("asset_types", {})
    specific = []
    other_coin = False
    generic = False
    generic_l = {g.lower() for g in _GENERIC_ASSETS}
    for asset, patterns in kw.items():
        if asset in ("BTC", "ETH", "USDT", "USDC", "稳定币"):
            if _has(text, patterns):
                specific.append(asset)
            continue
        extra = [p for p in patterns if p.lower() not in generic_l]
        if extra and _has(text, extra):
            other_coin = True
        if _has(text, [p for p in patterns if p.lower() in generic_l]):
            generic = True
    if specific:
        return specific
    if other_coin:
        return ["其他代币"]
    if generic:
        return ["虚拟货币"]
    return ["虚拟货币"]


def classify_disposal_method(text):
    t = text or ""
    if (("持牌交易所" in t) or ("持牌虚拟资产" in t) or ("持牌数字资产" in t)) and any(
        k in t for k in ("变现", "结汇", "回流入境", "处置")
    ):
        return "境外持牌交易所变现"
    if any(k in t for k in ("司法拍卖", "网络司法拍卖")):
        return "司法拍卖/网络司法拍卖"
    if any(k in t for k in ("委托处置", "受托处置", "代为处置")) or (
        "委托" in t and "第三方" in t and "处置" in t
    ):
        return "委托第三方机构处置"
    if any(k in t for k in ("协商回收", "定向回收", "商户回收", "发行方回收")):
        return "定向回收/协商回收"
    if any(k in t for k in ("先行处置", "先行变现", "提前变现")):
        return "先行处置"
    if any(k in t for k in ("框架协议", "合作备忘录", "试点机构", "揭牌")):
        return "试点/合作机制建设"
    if any(k in t for k in ("已扣押", "扣押了", "查获", "扣押涉案", "收缴涉案", "查扣涉案")):
        return "涉案管控/扣押"
    return "其他"


def importance_score(text):
    kw = get_keywords().get("importance_flags", {}).get("high", [])
    hits = sum(1 for p in kw if p in (text or ""))
    return hits


def classify_importance(text, amount_value=None):
    score = importance_score(text)
    if amount_value and amount_value >= 100_000_000:
        return "high"
    if score >= 2 or amount_value and amount_value >= 10_000_000:
        return "high"
    if score >= 1:
        return "medium"
    return "low"


def make_tags(text, institution_type, region, asset_types, disposal_method):
    tags = set()
    if institution_type and institution_type != "其他":
        tags.add(institution_type)
    if region:
        tags.add(region)
    for a in asset_types[:2]:
        tags.add(a)
    if disposal_method and disposal_method != "其他":
        tags.add(disposal_method)
    for term in get_keywords().get("interest_terms", []):
        if term in (text or ""):
            tags.add(term)
    return [t for t in tags if t]


# 赛道强相关词表：用于把关，过滤无关新闻（如 AI/互联网/时政等噪音）。
RELEVANT_TERMS = [
    "虚拟货币", "虚拟币", "数字货币", "加密货币", "加密资产", "数字资产", "虚拟资产",
    "比特币", "以太坊", "以太币", "泰达币", "稳定币", "代币", "usdt", "btc", "eth", "nft",
    "涉案", "罚没", "罚没", "没收", "收缴", "查扣", "扣押", "冻结", "追缴", "变现", "处置", "上缴国库",
    "公安", "法院", "纪委", "监委", "纪检", "检察", "执行局", "司法拍卖", "网络司法拍卖", "涉案款",
    "产权交易", "文交所", "产权交易所", "交易所", "挂牌", "拍卖", "招标", "结算", "结汇",
    "刑事", "洗钱", "传销", "非法经营", "诈骗", "资金盘", "非法集资", "冻结账户",
    "forfeit", "confiscat", "seiz", "laund", "bitcoin", "crypto", "digital asset", "coin", "virtual currency", "auction", "mint", "satoshi", "tether", "usdt", "ofac", "usms", "doj",
]


def is_relevant(text):
    """判断文本是否与赛道相关（命中至少一处强相关词）。"""
    t = (text or "").lower()
    assets = ["虚拟货币", "虚拟币", "数字货币", "加密货币", "加密资产", "数字资产", "虚拟资产", "比特币", "以太", "泰达币", "稳定币", "代币", "bitcoin", "crypto", "digital asset", "virtual currency", "tether"]
    asset_match = any(k in t for k in assets) or bool(re.search(r"\b(?:btc|eth|usdt|usdc|nft)\b", t))
    disposal = ["处置", "涉案", "罚没", "没收", "收缴", "查扣", "扣押", "追缴", "司法", "变现", "洗钱", "刑事", "拍卖", "招标", "执法", "forfeit", "confiscat", "seiz", "laund", "auction", "enforcement", "disposal"]
    return asset_match and any(k in t for k in disposal)
