"""简报分析：由结构化字段生成简洁的分析评述文本。"""
from app.analysis.classify import _has


def build_analysis(title, text, institution_type, region, asset_types, disposal_method,
                   amount_value, amount_currency):
    parts = []
    if institution_type and institution_type != "其他":
        parts.append(f"涉及主体为{institution_type}。")
    if region:
        parts.append(f"落地地域：{region}。")
    if asset_types and asset_types != ["虚拟货币"]:
        parts.append("资产类型：" + "、".join(asset_types) + "。")
    if disposal_method and disposal_method != "其他":
        parts.append(f"处置方式：{disposal_method}。")
    if amount_value:
        unit = "枚" if amount_currency == "枚" else (amount_currency or "人民币")
        parts.append(f"涉及量/金额：{amount_value:,.0f} {unit}。")
    if _has(text, ["试点", "首创", "首个", "首次", "第一例", "框架协议", "签约", "揭牌", "新渠道", "新模式"]):
        parts.append("呈现机制/模式创新信号，值得关注其复制推广与合规走向。")
    elif _has(text, ["挂牌", "拍卖", "招标", "公告", "变卖"]):
        parts.append("属公开处置动作，关注价格形成与机构承接情况。")
    if not parts:
        parts.append("相关司法/行政处置动态，需结合上下文研判。")
    return "".join(parts)


def default_summary(content, length=180):
    if not content:
        return ""
    t = content.replace("\n", " ").strip()
    return (t[:length] + "…") if len(t) > length else t
