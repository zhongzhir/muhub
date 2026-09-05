"""把原文整理为可入库的结构化字段。无法证明的字段留空。"""
from app.analysis import classify, extract, summarize

NATURE_CASE = classify.NATURE_CASE
NATURE_POLICY = classify.NATURE_POLICY
NATURE_NOTICE = classify.NATURE_NOTICE
NATURE_EXPERIENCE = classify.NATURE_EXPERIENCE
NATURE_RISK = classify.NATURE_RISK
NATURE_RESEARCH = classify.NATURE_RESEARCH


def structure_item(title, text, url="", source_name="", source_category=""):
    """基于正文证据生成结构化结果。无证据的金额/事件属性全部置空。"""
    title = title or ""
    text = text or ""
    blob = f"{title} {text}".strip()
    nature = classify.classify_information_nature(
        title, text, url=url, source_name=source_name, source_category=source_category
    )
    amount_val, amount_cur, amount_ev = extract.extract_amount(blob)
    if not amount_ev:
        amount_val = amount_cur = amount_ev = None

    eventful = classify.allows_event_attributes(nature)
    if eventful:
        institution = extract.extract_institution(blob)
        institution_type = classify.classify_institution_type(blob)
        if institution_type == "其他":
            institution_type = None
        region = classify.classify_region(blob)
        method = classify.classify_disposal_method(blob)
        if method == "其他":
            method = None
    else:
        institution = None
        institution_type = None
        region = None
        method = None

    assets = classify.classify_asset_types(blob)
    importance = classify.classify_importance(blob, amount_val)
    tags = classify.make_tags(blob, institution_type, region, assets, method)
    if nature:
        tags = [nature] + [t for t in tags if t != nature]
    analysis = summarize.build_analysis(
        title,
        blob,
        institution_type,
        region,
        assets,
        method,
        amount_val,
        amount_cur,
        amount_evidence=amount_ev,
        information_nature=nature,
    )
    return {
        "information_nature": nature,
        "amount_value": amount_val,
        "amount_currency": amount_cur,
        "amount_evidence": amount_ev,
        "institution": institution,
        "institution_type": institution_type,
        "region": region,
        "disposal_method": method,
        "asset_types": assets,
        "importance": importance,
        "tags": tags,
        "analysis": analysis,
        "analysis_value_line": summarize.analysis_value_line(analysis),
    }
