"""【C 负责】政策库：存储、检索、按经营数据匹配。

当前是种子政策 + 规则匹配，保证流程能跑通。
TODO(C)：
  1. 扩充政策库（国家税务总局、财政部、地方税务局官网），每条保留原文出处；
  2. 检索已改为按问题打分取 top-k（retrieve()），可以再换成向量检索；
  3. 定时抓取更新脚本（scripts/update_policies.py），演示时能手动触发一次。
"""
import json
import math
import re
from datetime import date
from pathlib import Path
from typing import Optional

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
    months = data.period.months
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
        elif p.id == "sh-urban-construction-tax":
            if prof.region and "上海" in prof.region:
                status, reason = "符合", "登记地在上海，城建税按地址适用 7%/5%/1% 税率。"
            else:
                reason = "仅适用于上海纳税人。"
        else:
            status, reason = "可能符合", "TODO(C)：补充匹配规则或交给 LLM 判断。"
        out.append(PolicyMatch(policy=p, status=status, reason=reason, missing_info=missing))
    return out


ASK_SYSTEM = (
    "你是财税政策查询助手，回答对象是没有财务背景的小店老板。只根据给出的政策条目回答，"
    "用口语化中文，先直接回答问题，再说明依据，不超过 250 字。"
    "如果给出了“这家店的情况”，要结合其中的数字说明政策和这家店的关系；数字只能原样引用，不要自己计算新的数字。"
    "条目里没有的内容回答“政策库中暂未收录，请咨询当地税务机关（12366）”。"
    "只说明政策规定和可能适用的情况，不提供个人化建议，不使用“建议您”。"
    "最后单独一行以“依据：”开头，列出引用的文件名称和文号。"
)

TOP_K = 3


def _bigrams(text: str) -> set[str]:
    t = re.sub(r"[\s，。、；：“”（）《》?？!！]", "", text)
    return {t[i:i + 2] for i in range(len(t) - 1)}


def retrieve(query: str, policies: list[Policy], k: int = TOP_K, boost: Optional[dict[str, float]] = None) -> list[Policy]:
    """按问题检索最相关的 k 条政策：字符二元组按 IDF 加权打分，标题命中加倍。

    中文不分词也能用；“城建”“发票”这类少见的词权重高，“纳税人”这类到处都有的词权重低。
    boost 用于把“这家店符合的政策”和用户点进来的那条政策往前排。
    """
    q = _bigrams(query)
    boost = boost or {}
    docs = [(_bigrams(p.title + p.tax_type), _bigrams(p.summary + p.conditions)) for p in policies]
    n = len(policies)
    df: dict[str, int] = {}
    for title, body in docs:
        for g in title | body:
            df[g] = df.get(g, 0) + 1
    idf = {g: math.log((n + 1) / (c + 0.5)) for g, c in df.items()}
    scored = []
    for p, (title, body) in zip(policies, docs):
        score = sum(idf[g] * (2 if g in title else 1) for g in q & (title | body)) + boost.get(p.id, 0)
        scored.append((score, p))
    scored.sort(key=lambda x: -x[0])
    return [p for _, p in scored[:k]]


def _wan(v: float) -> str:
    return f"{v / 10000:.1f} 万元" if v >= 10000 else f"{v:,.0f} 元"


def shop_context(data: BusinessData, matches: list[PolicyMatch]) -> tuple[str, list[str]]:
    """把这家店的体检数据整理成给模型看的上下文，以及给页面展示的几条要点。

    数字全部在这里由代码算好，模型只引用。
    """
    from .diagnosis import compute_indicators  # 避免循环引用

    prof = data.profile
    revenue = sum(t.amount for t in data.transactions if t.direction == "收入")
    months = data.period.months
    monthly = revenue / months
    indicators = compute_indicators(data)
    flagged = [i for i in indicators if i.level in ("关注", "预警")]
    ok = [m for m in matches if m.status != "不符合"]

    lines = [
        f"店名：{prof.name or '未填写'}；身份：{prof.entity_type}，{prof.taxpayer_type}，{prof.collection_method}；"
        f"地区：{prof.region or '未填写'}；行业：{prof.industry or '未填写'}",
        f"统计期间：{data.period.start} 至 {data.period.end}（{months} 个月），收入合计 {revenue:,.0f} 元，"
        f"月均 {monthly:,.0f} 元，折合季度销售额约 {monthly * 3:,.0f} 元",
        "体检指标：",
        *[f"- {i.name}（{i.level}）：{i.explanation}" for i in indicators],
        "政策匹配结果：",
        *[f"- {m.policy.title}：{m.status}。{m.reason}" for m in matches],
    ]
    facts = [f"{prof.entity_type} · {prof.taxpayer_type}", f"月均收入 {_wan(monthly)}"]
    if flagged:
        facts.append(f"{len(flagged)} 项需留意：" + "、".join(i.name for i in flagged))
    if ok:
        facts.append(f"可能适用 {len(ok)} 条优惠")
    return "\n".join(lines), facts


def ask(question: str, data: Optional[BusinessData] = None, policy_id: Optional[str] = None) -> dict:
    """政策问答：先检索相关条目，有体检数据时把这家店的情况一起交给模型，回答只引用检索到的条目。"""
    policies = load_policies()
    matches = match(data) if data and data.transactions else []
    boost = {m.policy.id: (2 if m.status == "符合" else 1) for m in matches if m.status != "不符合"}
    if policy_id:
        boost[policy_id] = boost.get(policy_id, 0) + 100
    hits = retrieve(question, policies, boost=boost)

    context = "\n\n".join(f"[{p.source_name}] {p.title}\n{p.summary}\n适用条件：{p.conditions}" for p in hits)
    prompt = f"政策条目：\n{context}\n\n"
    facts: list[str] = []
    if matches:
        shop, facts = shop_context(data, matches)
        prompt += f"这家店的情况：\n{shop}\n\n"
    answer = llm.chat(ASK_SYSTEM, prompt + f"问题：{question}")

    if not answer:  # 演示模式：没有模型时，用检索结果和匹配结果拼出回答
        status = {m.policy.id: m for m in matches}
        parts = ["（演示模式：未配置模型，以下是政策库里最相关的条目）"]
        for n, p in enumerate(hits, 1):
            parts.append(f"{n}. {p.title}：{p.summary}")
            if p.id in status:
                parts.append(f"   按您的数据：{status[p.id].status}。{status[p.id].reason}")
        answer = "\n".join(parts)

    return {
        "answer": answer,
        "sources": [{"id": p.id, "title": p.title, "source_name": p.source_name, "source_url": p.source_url} for p in hits],
        "shop_facts": facts,
    }
