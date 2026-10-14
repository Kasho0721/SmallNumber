"""政策引导填写：把匹配到的政策变成一步步的办理清单，并按用户数据估算申报表上要填的数。

原则同诊断模块：数字由代码算，只做对照和指引，不替用户做决定。
原文摘录见 data/sources/，申报表填写说明来自上海市税务局下载中心。
"""
from typing import Callable, Optional

from ..schemas import BusinessData, Download, FillField, GuideStep, PolicyGuide
from .policy import load_policies

SH = "https://shanghai.chinatax.gov.cn"
VAT_FORM = "增值税及附加税费申报表（小规模纳税人适用）"
SURTAX_FORM = "附列资料（二）附加税费情况表"
IIT_FORM = "个人所得税经营所得纳税申报表（A表）"
WHERE = "上海市电子税务局（网页端或手机端），或到所在区的办税服务厅。不会操作可拨打 12366。"

VAT_DOWNLOADS = [
    Download(name="《增值税及附加税费申报表（小规模纳税人适用）》及其附列资料填写说明",
             url=f"{SH}/bsfw/xzzx/bgxz/sbzsl/202107/t459066.html",
             note="上海市税务局 · 下载中心 · 表格下载（2026-02-09 按增值税法更新）"),
    Download(name="申报表表样（主表）", url=f"{SH}/bsfw/xzzx/bgxz/sbzsl/202107/W020210730547869083806.png"),
    Download(name="申报表表样（附列资料）", url=f"{SH}/bsfw/xzzx/bgxz/sbzsl/202107/W020210730547869083348.png"),
    Download(name="申报表表样（附加税费情况表）", url=f"{SH}/bsfw/xzzx/bgxz/sbzsl/202107/W020210730547869092104.png"),
]
SURTAX_DOWNLOADS = [
    Download(name="关于城市维护建设税有关征收事项的公告（沪财发〔2021〕5号）",
             url=f"{SH}/zcfw/zcfgk/ykgf/202108/t460049.html", note="上海市城建税税率"),
    Download(name="关于延长该公告有效期的通知（沪财发〔2026〕6号）",
             url=f"{SH}/zcfw/zcfgk/ykgf/202608/t481199.html"),
]

# 上海城建税税率（沪财发〔2021〕5号）
URBAN_RATE = {"市区": 0.07, "镇": 0.05, "其他": 0.01}


def _revenue(d: BusinessData) -> float:
    return sum(t.amount for t in d.transactions if t.direction == "收入")


def _expense(d: BusinessData) -> float:
    return sum(t.amount for t in d.transactions if t.direction == "支出")


def _quarter_sales(d: BusinessData) -> float:
    return _revenue(d) / d.period.months * 3


def _vat_payable(d: BusinessData) -> float:
    q = _quarter_sales(d)
    return 0.0 if q <= 300000 else round(q / 1.01 * 0.01, 2)


def _is_individual(d: BusinessData) -> bool:
    return d.profile.entity_type == "个体工商户"


def _identity_step(d: BusinessData) -> GuideStep:
    return GuideStep(
        title="确认纳税人身份和申报周期",
        detail="登录电子税务局，在“我的信息 → 纳税人信息”里查看“增值税纳税人类型”和申报期限。"
               f"您填写的是：{d.profile.entity_type}、{d.profile.taxpayer_type}。",
        check="我是小规模纳税人，并且按季度申报增值税",
    )


def guide_vat_exempt(d: BusinessData) -> PolicyGuide:
    q = round(_quarter_sales(d), 2)
    ind = _is_individual(d)
    line_sales, line_tax = ("第11栏", "第19栏") if ind else ("第10栏", "第18栏")
    label_sales = "未达起征点销售额" if ind else "小微企业免税销售额"
    steps = [
        _identity_step(d),
        GuideStep(
            title="核对本季度销售额",
            detail=f"本季度销售额约 {q:,.0f} 元，免征额度是 30 万元/季度，"
                   + ("在额度内，本季度增值税可以免征。" if q <= 300000 else "已超过额度，请改看“减按1%征收”的引导。")
                   + " 出租不动产等收入另有规定，没有算在这里。",
            check="销售额已经和收款记录、发票核对过",
        ),
        GuideStep(
            title="填写增值税申报表",
            detail=f"{'个体工商户填第11栏和第19栏，不填第10栏。' if ind else '企业填第10栏和第18栏，不填第11栏。'}"
                   "申报表填的是不含税销售额，电子税务局会按您的开票和申报数据预填。",
            fields=[
                FillField(form=VAT_FORM, line=line_sales, label=label_sales, value=q,
                          note="按收款金额估算，以系统预填为准"),
                FillField(form=VAT_FORM, line=line_tax, label="未达起征点免税额" if ind else "小微企业免税额",
                          value=round(q * 0.03, 2), note=f"{line_sales} × 3%"),
                FillField(form=VAT_FORM, line="第15栏", label="本期应纳税额", value=0),
            ],
        ),
        GuideStep(
            title="附加税费",
            detail="增值税免征后，城建税、教育费附加、地方教育附加的计税依据为 0，也不用缴。",
            fields=[FillField(form=VAT_FORM, line="第23至25栏", label="附加税费本期应补（退）额", value=0)],
        ),
        GuideStep(
            title="提交申报并保存回执",
            detail="免税也要按期申报，不申报会算逾期。如果客户要增值税专用发票，"
                   "开专票的部分不能免税，需要按1%缴纳。",
            check="已经提交申报并保存了回执",
        ),
    ]
    return _guide("vat-small-exempt", steps, VAT_DOWNLOADS)


def guide_vat_1pct(d: BusinessData) -> PolicyGuide:
    q = _quarter_sales(d)
    sales = round(q / 1.01, 2)
    steps = [
        _identity_step(d),
        GuideStep(
            title="核对本季度销售额",
            detail=f"本季度销售额约 {q:,.0f} 元，" + ("超过了 30 万元的免征额度，" if q > 300000 else "目前在免征额度内，")
                   + "超过额度时，销售货物和服务按1%征收率缴纳增值税。出租、销售不动产不适用1%。",
            check="销售额已经和收款记录、发票核对过",
        ),
        GuideStep(
            title="填写增值税申报表",
            detail="1%征收率的销售额填第1栏。表上先按3%算出应纳税额（第15栏），再把少交的2%填在第16栏减征额。",
            fields=[
                FillField(form=VAT_FORM, line="第1栏", label="应征增值税不含税销售额（3%征收率）", value=sales,
                          note="含税收入 ÷ (1+1%)"),
                FillField(form=VAT_FORM, line="第15栏", label="本期应纳税额", value=round(sales * 0.03, 2), note="第1栏 × 3%"),
                FillField(form=VAT_FORM, line="第16栏", label="本期应纳税额减征额", value=round(sales * 0.02, 2), note="第1栏 × 2%"),
                FillField(form=VAT_FORM, line="实际缴纳", label="增值税", value=round(sales * 0.01, 2), note="第1栏 × 1%"),
            ],
        ),
        GuideStep(title="提交申报并缴款", detail="开发票时也要按1%征收率开具。", check="已经提交申报并缴款"),
    ]
    return _guide("vat-small-1pct", steps, VAT_DOWNLOADS)


def guide_six_taxes(d: BusinessData, policy_id: str = "six-taxes-two-fees-half") -> PolicyGuide:
    vat = _vat_payable(d)
    rate = URBAN_RATE["市区"]
    steps = [
        GuideStep(
            title="确认所在地类型",
            detail="上海的城建税按营业执照登记地址确定：市区7%，镇5%，其他1%。下面按“市区”估算。",
            check="我的登记地址在市区（不是请按镇5%或其他1%自行换算）",
        ),
        GuideStep(
            title="填写附加税费情况表",
            detail=(f"本季度应缴增值税约 {vat:,.2f} 元，附加税费以它为计税依据，再减半征收。"
                    if vat else "本季度增值税免征，附加税费的计税依据为 0，都不用缴。")
                   + "小规模纳税人的“六税两费”减半不填减免性质代码，系统按身份自动减征。",
            fields=[
                FillField(form=SURTAX_FORM, line="城市维护建设税", label="减半后应缴", value=round(vat * rate * 0.5, 2),
                          note="增值税 × 7% × 50%"),
                FillField(form=SURTAX_FORM, line="教育费附加", label="减半后应缴", value=round(vat * 0.03 * 0.5, 2),
                          note="增值税 × 3% × 50%"),
                FillField(form=SURTAX_FORM, line="地方教育附加", label="减半后应缴", value=round(vat * 0.02 * 0.5, 2),
                          note="增值税 × 2% × 50%"),
            ],
        ),
        GuideStep(
            title="其他“六税两费”",
            detail="签合同交的印花税、有自有房产的房产税和城镇土地使用税，同样减半，申报时系统会自动带出。",
            check="已经在申报时确认减征比例显示为 50%",
        ),
    ]
    return _guide(policy_id, steps, SURTAX_DOWNLOADS + VAT_DOWNLOADS[:1])


def _iit_tax(income: float) -> float:
    # 经营所得适用五级超额累进税率
    for limit, rate, quick in [(30000, .05, 0), (90000, .10, 1500), (300000, .20, 10500), (500000, .30, 40500)]:
        if income <= limit:
            return max(income * rate - quick, 0)
    return income * .35 - 65500


def guide_iit_half(d: BusinessData) -> PolicyGuide:
    downloads = [Download(name="国家税务总局公告2023年第12号（个体工商户减半征收个人所得税征管事项）",
                          url="https://fgk.chinatax.gov.cn/zcfgk/c100012/c5213596/content.html")]
    if d.profile.collection_method == "定期定额":
        steps = [GuideStep(
            title="不需要另外填写",
            detail="定期定额个体户由税务机关直接按减免后的税额划款，您只要确认扣款账户余额充足。",
            check="已核对扣款金额",
        )]
        return _guide("iit-individual-half", steps, downloads)

    profit = max(_revenue(d) - _expense(d), 0)
    tax = round(_iit_tax(profit), 2)
    no_invoice = sum(t.amount for t in d.transactions if t.direction == "支出" and t.has_invoice is False)
    steps = [
        GuideStep(
            title="确认征收方式",
            detail=f"您填写的是“{d.profile.collection_method}”。查账征收按账本利润算税，需要季度预缴、次年3月底前汇算。",
            check="我是查账征收的个体户",
        ),
        GuideStep(
            title="算出本期利润",
            detail=f"本期收入减支出约 {profit:,.0f} 元。其中有 {no_invoice:,.0f} 元支出没有票据，"
                   "没有合法凭证的成本可能不能扣除，利润会更高。如果您没有工资等其他收入，还可以减除每月 5000 元费用。",
            check="已经整理好成本费用的票据",
        ),
        GuideStep(
            title="填写经营所得申报表",
            detail="预缴按1月至本期末累计计算，下面只用本期数据估算。电子税务局会预填减免税额和《个人所得税减免税事项报告表》，核对后确认即可。",
            fields=[
                FillField(form=IIT_FORM, line="应纳税所得额", label="本期利润（估算）", value=profit, note="未扣减除费用"),
                FillField(form=IIT_FORM, line="应纳税额", label="按经营所得税率表计算", value=tax),
                FillField(form=IIT_FORM, line="减免税额", label="减半征收", value=round(tax * 0.5, 2), note="应纳税额 × 50%"),
                FillField(form="个人所得税减免税事项报告表", line="减免事项", label="个体工商户减半征收", value=None,
                          note="系统预填，确认即可"),
            ],
        ),
    ]
    return _guide("iit-individual-half", steps, downloads)


def guide_cit_small(d: BusinessData) -> PolicyGuide:
    steps = [
        GuideStep(title="确认三个条件",
                  detail="全年应纳税所得额不超过300万元、从业人数不超过300人、资产总额不超过5000万元，且不属于限制和禁止行业。",
                  check="三个条件都满足"),
        GuideStep(title="预缴申报时勾选",
                  detail="企业所得税季度预缴申报表里“小型微利企业”选“是”，系统按5%实际税负自动计算减免。",
                  fields=[FillField(form="企业所得税月（季）度预缴纳税申报表（A类）", line="小型微利企业", label="选择“是”", value=None)]),
    ]
    downloads = [Download(name="企业所得税年度纳税申报表（A类）",
                          url=f"{SH}/bsfw/xzzx/bgxz/sbzsl/202503/t475905.html", note="上海市税务局 · 下载中心")]
    return _guide("cit-small-profit", steps, downloads)


GUIDES: dict[str, Callable[[BusinessData], PolicyGuide]] = {
    "vat-small-exempt": guide_vat_exempt,
    "vat-small-1pct": guide_vat_1pct,
    "six-taxes-two-fees-half": guide_six_taxes,
    "sh-urban-construction-tax": lambda d: guide_six_taxes(d, "sh-urban-construction-tax"),
    "iit-individual-half": guide_iit_half,
    "cit-small-profit": guide_cit_small,
}


def _guide(policy_id: str, steps: list[GuideStep], downloads: list[Download]) -> PolicyGuide:
    title = next((p.title for p in load_policies() if p.id == policy_id), policy_id)
    return PolicyGuide(policy_id=policy_id, title=title, where=WHERE, steps=steps, downloads=downloads)


def build_guide(policy_id: str, data: BusinessData) -> Optional[PolicyGuide]:
    fn = GUIDES.get(policy_id)
    return fn(data) if fn else None
