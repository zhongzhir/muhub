"""简报分析：围绕数字资产处置回答信息性质、关系、工作价值与证据边界。"""
import re
from app.analysis.classify import (
    NATURE_CASE,
    NATURE_EXPERIENCE,
    NATURE_NOTICE,
    NATURE_POLICY,
    NATURE_RESEARCH,
    NATURE_RISK,
)


def analysis_value_line(analysis):
    if not analysis:
        return ""
    for line in str(analysis).splitlines():
        if line.startswith("对实际工作的价值"):
            return line.split("：", 1)[-1].rstrip("。")
    return str(analysis).splitlines()[0]


def _relation_sentence(title, text, nature, asset_types):
    blob = f"{title or ''} {text or ''}"
    assets = "、".join(asset_types or []) or "数字资产"
    if nature == NATURE_RESEARCH:
        if "跨境" in blob and any(k in blob for k in ("追赃", "没收", "返还")):
            return "属于跨境追赃法理与制度研究，讨论虚拟货币跨境转移对没收、返还与分享程序的影响。"
        return f"属于理论研究，从制度与程序层面讨论{assets}处置，而非披露一起具体处置案件。"
    if nature == NATURE_POLICY:
        if any(k in blob for k in ("查封", "扣押", "冻结", "涉案财物")):
            return "属于涉案财物处置制度建议，讨论范围认定、查扣冻程序与监督救济等规则完善方向。"
        return f"属于政策或制度指导，为{assets}处置提供规则与程序参考。"
    if nature == NATURE_NOTICE:
        return f"与{assets}公开处置、变现或交易安排直接相关。"
    if nature == NATURE_CASE:
        return f"属于具体案件信息，涉及{assets}在执法或司法程序中的处置。"
    if nature == NATURE_EXPERIENCE:
        return f"提供可借鉴的{assets}处置管理经验或协作机制。"
    if nature == NATURE_RISK:
        return f"提示与{assets}处置相关的行业或合规风险。"
    return f"与{assets}处置相关，需结合原文判断具体事件是否成立。"


def _value_sentence(title, text, nature):
    blob = f"{title or ''} {text or ''}"
    if "跨境" in blob and any(k in blob for k in ("没收", "返还", "分享")):
        return "提示虚拟货币跨境转移给没收、资产返还与分享机制带来的程序挑战。"
    if "区块链" in blob and any(k in blob for k in ("存证", "全流程")):
        return "提出范围认定、查扣冻程序、监督救济，以及利用区块链进行涉案虚拟财产全流程存证等方向。"
    if nature == NATURE_NOTICE:
        return "可关注公开处置进度、承接机构与合规变现路径。"
    if nature == NATURE_CASE:
        return "可关注案件程序节点、资产管控与后续处置依据。"
    if nature == NATURE_EXPERIENCE:
        return "可对照本地协作机制、保管与变现流程评估是否具备借鉴条件。"
    if nature == NATURE_RISK:
        return "宜核对其风险描述是否触及本单位正在办理的处置环节。"
    if nature in {NATURE_RESEARCH, NATURE_POLICY}:
        return "价值在于制度与程序参考，不能替代具体案件事实或成交结果。"
    return "需结合原文判断对实际处置工作的参考价值。"


def _evidence_boundary(text, amount_evidence, institution, region, disposal_method):
    blob = text or ""
    missing = []
    if not amount_evidence:
        missing.append("未披露具体资产数量")
    if not re_search_case_id(blob):
        missing.append("未披露案件编号")
    if not any(k in blob for k in ("成交", "拍出", "变现成功", "成交价", "成交额")):
        missing.append("未披露成交结果")
    extra = []
    if not institution:
        extra.append("未披露具体事件主体")
    if not region:
        extra.append("未披露事件地域")
    if not disposal_method:
        extra.append("未披露实际处置方式")
    body = "、".join(missing)
    if extra and (not institution or not disposal_method):
        body = body + "；" + "、".join(extra)
    return f"证据边界：{body}。"


def re_search_case_id(text):
    return bool(re.search(r"[（(]\d{4}[）)].{0,12}(刑|民|执)|案号", text or ""))


def build_analysis(title, text, institution_type, region, asset_types, disposal_method,
                   amount_value, amount_currency, amount_evidence=None, information_nature=None):
    from app.analysis.classify import classify_information_nature

    nature = information_nature or classify_information_nature(title, text)
    assets = asset_types if isinstance(asset_types, (list, tuple)) else (
        [asset_types] if asset_types else ["虚拟货币"]
    )
    lines = [
        f"信息性质：{nature}。",
        f"与数字资产处置的关系：{_relation_sentence(title, text, nature, assets)}",
        f"对实际工作的价值：{_value_sentence(title, text, nature)}",
        _evidence_boundary(f"{title or ''} {text or ''}", amount_evidence, institution_type, region, disposal_method),
    ]
    if amount_evidence and amount_value is not None:
        unit = "枚" if amount_currency == "枚" else (amount_currency or "")
        lines.append(f"数量/金额证据：{amount_evidence}（{amount_value:g}{unit}）。")
    return "\n".join(lines)


def default_summary(content, length=180):
    if not content:
        return ""
    t = content.replace("\n", " ").strip()
    return (t[:length] + "…") if len(t) > length else t
