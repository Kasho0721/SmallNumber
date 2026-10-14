"""【B 负责】诊断分析：规则算指标，LLM 把结果说成大白话。

原则：数字一律由代码计算，LLM 只负责解释，不让模型自己算数。
"""
import json

from .. import llm
from ..schemas import BusinessData, Diagnosis, Indicator, PolicyMatch


def _months(data: BusinessData) -> float:
    days = (data.period.end - data.period.start).days + 1
    return max(days / 30.4, 1)


def compute_indicators(data: BusinessData) -> list[Indicator]:
    inc = [t for t in data.transactions if t.direction == "收入"]
    exp = [t for t in data.transactions if t.direction == "支出"]
    revenue = sum(t.amount for t in inc)
    expense = sum(t.amount for t in exp)
    purchase = sum(t.amount for t in exp if t.category == "进货")
    taxes = data.taxes_paid
    tax_total = taxes.vat + taxes.surtaxes + taxes.income_tax + taxes.other
    months = _months(data)
    monthly_rev = revenue / months
    monthly_exp = expense / months

    out: list[Indicator] = []

    def add(key, name, value, unit, level, text):
        out.append(Indicator(key=key, name=name, value=None if value is None else round(value, 4),
                             unit=unit, level=level, explanation=text))

    if revenue == 0:
        add("revenue", "收入", None, "元", "数据不足", "还没有收入记录，无法分析。")
        return out

    add("monthly_revenue", "月均收入", monthly_rev, "元", "正常", f"这段时间平均每月收入约 {monthly_rev:,.0f} 元。")

    margin = (revenue - expense) / revenue
    add("profit_margin", "利润率", margin, "%",
        "预警" if margin < 0 else "关注" if margin < 0.1 else "正常",
        f"每收入 100 元，扣掉各项开支后大约剩 {margin*100:.0f} 元。")

    if purchase:
        gross = (revenue - purchase) / revenue
        add("gross_margin", "毛利率（扣进货）", gross, "%", "关注" if gross < 0.3 else "正常",
            f"只扣进货成本，每 100 元收入剩 {gross*100:.0f} 元。")

    # TODO(B)：按行业和纳税人类型给出参考区间，判断偏高或偏低
    add("tax_burden", "综合税负率", tax_total / revenue, "%", "正常",
        f"已缴税费占收入的 {tax_total/revenue*100:.2f}%。")

    no_inv_exp = sum(t.amount for t in exp if t.has_invoice is False)
    if expense:
        ratio = no_inv_exp / expense
        add("expense_no_invoice", "无票支出占比", ratio, "%", "关注" if ratio > 0.5 else "正常",
            f"有 {ratio*100:.0f}% 的支出没有取得发票。查账征收时，没有票据的成本可能无法在算税时扣除。")

    c = data.cash
    if c.cash_balance is not None and monthly_exp:
        cover = c.cash_balance / monthly_exp
        add("cash_cover", "现金可支撑月数", cover, "个月", "预警" if cover < 1 else "关注" if cover < 3 else "正常",
            f"按现在的开支，手上的钱大约能撑 {cover:.1f} 个月。")
    if c.monthly_debt_payment is not None:
        dsr = c.monthly_debt_payment / monthly_rev
        add("debt_pressure", "还款占收入比", dsr, "%", "预警" if dsr > 0.3 else "关注" if dsr > 0.15 else "正常",
            f"每月还款约占月收入的 {dsr*100:.0f}%。")

    # 增值税免税额度余量（小规模、按季 30 万）
    if data.profile.taxpayer_type == "小规模纳税人":
        quarter_rev = monthly_rev * 3
        add("vat_exempt_headroom", "距增值税免税额度", 300000 - quarter_rev, "元/季",
            "关注" if quarter_rev > 270000 else "正常",
            f"按季度算销售额约 {quarter_rev:,.0f} 元，免税额度是 30 万元。")

    return out


SUMMARY_SYSTEM = (
    "你在给一位没有财务背景的小店老板解读体检结果。用口语化中文，3 到 5 句话，"
    "只陈述指标反映的情况和可以了解的政策，不给经营或税务建议，不使用“建议您”。"
    "输出 JSON：{\"summary\": str, \"risks\": [str]}。"
)


def diagnose(data: BusinessData, matches: list[PolicyMatch]) -> Diagnosis:
    indicators = compute_indicators(data)
    risks = [f"{i.name}：{i.explanation}" for i in indicators if i.level in ("关注", "预警")]
    summary = "已根据您填写的信息完成体检。" + (f"有 {len(risks)} 项值得关注。" if risks else "各项指标暂未发现明显异常。")

    payload = json.dumps({
        "profile": data.profile.model_dump(),
        "indicators": [i.model_dump() for i in indicators],
        "policies": [{"title": m.policy.title, "status": m.status} for m in matches],
    }, ensure_ascii=False)
    result = llm.chat_json(SUMMARY_SYSTEM, payload)
    if result:
        summary = result.get("summary", summary)
        risks = result.get("risks", risks)

    return Diagnosis(period=data.period, summary=summary, indicators=indicators,
                     risks=risks, policy_matches=matches)
