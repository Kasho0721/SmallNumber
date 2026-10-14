"""【A 负责】引导录入：拍照识别票据 + 对话追问缺失信息，产出 BusinessData。"""
from typing import Optional

from .. import llm
from ..schemas import BusinessData, Transaction

EXTRACT_SYSTEM = (
    "你是小微商户的记账助手。从票据、收据、收款截图或手写账本照片中提取交易，"
    "只输出 JSON：{\"transactions\": [{date, direction(收入/支出), amount, category, counterparty, has_invoice, note}]}。"
    "看不清的字段填 null，不要编造。"
)


def extract_transactions(image: bytes, mime: str) -> list[Transaction]:
    data = llm.vision_json(EXTRACT_SYSTEM, image, mime, "请提取这张图片里的所有交易。")
    if data is None:
        return []  # 演示模式：没有模型时不识别
    out = []
    for t in data.get("transactions", []):
        t["source"] = "拍照识别"
        try:
            out.append(Transaction(**t))
        except Exception:
            continue  # TODO(A)：把解析失败的条目返回给前端让用户补全
    return out


# 必问字段：缺了会直接影响诊断或政策判断
REQUIRED = [
    ("profile.entity_type", "您是个体户还是公司？"),
    ("profile.taxpayer_type", "您是小规模纳税人还是一般纳税人？不清楚也没关系，营业执照办下来没特别申请过的一般是小规模。"),
    ("profile.collection_method", "税务局是按您的实际账本收税（查账征收），还是每月固定交一个数（定期定额）？"),
    ("profile.industry", "您主要做什么生意？比如早餐、便利店、修车。"),
    ("cash.cash_balance", "现在手上和银行卡里大概一共有多少钱可以用？"),
    ("cash.monthly_debt_payment", "每个月要还多少贷款或借款？没有就填 0。"),
]


def _get(data: BusinessData, path: str):
    obj = data
    for part in path.split("."):
        obj = getattr(obj, part, None)
    return obj


def next_question(data: BusinessData) -> Optional[dict]:
    """返回下一个要问用户的问题；都填完返回 None。

    TODO(A)：接入 llm.chat，让模型根据已填内容用更自然的口吻追问，并能解析用户的口语回答。
    """
    for path, question in REQUIRED:
        value = _get(data, path)
        if value in (None, "不清楚"):
            return {"field": path, "question": question}
    if not data.transactions:
        return {"field": "transactions", "question": "拍一下这段时间的收款记录、进货单或账本吧。"}
    return None
