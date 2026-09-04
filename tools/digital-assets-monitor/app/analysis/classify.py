"""分类与标注：机构类型、行政区域、资产类型、处置方式、重要度、标签。"""
import re
from app.config import get_keywords


def _has(text, patterns):
    text = (text or "").lower()
    for p in patterns:
        if p.lower() in text:
            return True
    return False


def classify_institution_type(text):
    kw = get_keywords().get("institution_types", {})
    order = ["纪检监察", "人民法院", "人民检察院", "公安机关", "财政部门",
             "产权交易所", "境外处置机构", "持有牌交易平台", "第三方处置公司", "律所/研究"]
    # 特例：纪检监察需先于公安等
    for tpe in order:
        if tpe in kw and _has(text, kw[tpe]):
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
    found = []
    for asset, patterns in kw.items():
        if _has(text, patterns):
            found.append(asset)
    # 去重逻辑：(稳定币)已含在"其他代币"关键词，但保留优先级
    return found or ["虚拟货币"]


def classify_disposal_method(text):
    kw = get_keywords().get("disposal_methods", {})
    # 高优先级匹配
    priority = ["境外持牌交易所变现", "司法拍卖/网络司法拍卖", "先驱处置", "试点/合作机制建设",
                "定向回收/协商回收", "委托第三方机构处置", "涉案管控/扣押"]
    for m in priority:
        if m in kw and _has(text, kw[m]):
            return m
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
