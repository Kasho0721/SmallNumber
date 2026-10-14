"""【C 负责】政策库：存储、检索、按经营数据匹配。

当前是种子政策 + 规则匹配，保证流程能跑通。
TODO(C)：
  1. 扩充政策库（国家税务总局、财政部、地方税务局官网），每条保留原文出处；
  2. 向量检索（RAG），支持用户自由提问并带出处回答（见 ask()）；
  3. 定时抓取更新脚本（scripts/update_policies.py），演示时能手动触发一次。
"""
import json
from datetime import date
from pathlib import Path

from .. import llm
from ..schemas import BusinessData, Policy, PolicyMatch

DATA = Path(__file__).resolve().parent.parent / "data" / "policies.json"


def load_policies() -> list[Policy]:
    return [Policy(**p) for p in json.loads(DATA.read_text(encoding="utf-8"))]


def _active(p: Policy, on: date) -> bool:
    return (p.effective_from is None or p.effective_from <= on) and (p.effective_to is None or on <= p.effective_to)


def match(data: BusinessData) -> list[PolicyMatch]:
    prof = data.profile
    revenue = sum(t.amount for t in data.transactions if t.direction == "收入")
    months = max(((data.period.end - data.period.start).days + 1) / 30.4, 1)
    monthly = revenue / months
    small = prof.taxpayer_type == "小规模纳税人"
    out: list[PolicyMatch] = []

    for p in load_policies():
        if not _active(p, data.period.end):
            continue
        status, reason, missing = "不符合", "", []
        if p.id == "vat-small-exempt":
            if prof.taxpayer_type == "不清楚":
                status, missing = "可能符合", ["纳税人类型"]
                reason = f"月均销售额约 {monthly:,.0f} 元，需先确认是否为小规模纳税人。"
            elif small:
                status = "符合" if monthly <= 100000 else "不符合"
                reason = f"小规模纳税人，月均销售额约 {monthly:,.0f} 元（额度 10 万元/月）。"
        elif p.id == "vat-small-1pct":
            if small and monthly > 100000:
                status, reason = "符合", "小规模纳税人且销售额超过免税额度，超出部分可按 1% 征收。"
            elif small:
                status, reason = "不符合", "销售额在免税额度内，暂不涉及。"
        elif p.id == "six-taxes-two-fees-half":
            if small or prof.entity_type == "个体工商户":
                status, reason = "符合", f"身份为{prof.entity_type}/{prof.taxpayer_type}。"
        elif p.id == "iit-individual-half":
            if prof.entity_type == "个体工商户":
                status, reason = "符合", "个体工商户经营所得适用。"
                if prof.collection_method == "定期定额":
                    reason += "定期定额户一般由税务机关在核定时直接体现。"
        elif p.id == "cit-small-profit":
            if prof.entity_type == "小微企业":
                status, reason = "可能符合", "需结合年度应纳税所得额、从业人数、资产总额判断。"
                missing = ["年度应纳税所得额"]
            else:
                reason = "适用于企业，个体工商户不缴企业所得税。"
        else:
            status, reason = "可能符合", "TODO(C)：补充匹配规则或交给 LLM 判断。"
        out.append(PolicyMatch(policy=p, status=status, reason=reason, missing_info=missing))
    return out


ASK_SYSTEM = (
    "你是财税政策查询助手。只根据给出的政策条目回答，回答末尾列出引用的文件名称和文号。"
    "条目里没有的内容回答“政策库中暂未收录，请咨询当地税务机关（12366）”。不提供个人化建议。"
)


def ask(question: str) -> dict:
    """政策问答。TODO(C)：把“全部塞进上下文”换成向量检索 top-k。"""
    policies = load_policies()
    context = "\n\n".join(f"[{p.source_name}] {p.title}\n{p.conditions}" for p in policies)
    answer = llm.chat(ASK_SYSTEM, f"政策条目：\n{context}\n\n问题：{question}")
    return {
        "answer": answer or "（演示模式：未配置模型，以下为相关政策条目）",
        "sources": [{"title": p.title, "source_name": p.source_name} for p in policies],
    }
