"""全组共用的数据格式（唯一来源）。

改这里的字段前先在群里说一声：录入、诊断、政策三个模块都依赖它。
金额单位统一为“元”，日期统一为 YYYY-MM-DD。
"""
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

EntityType = Literal["个体工商户", "小微企业", "其他"]
TaxpayerType = Literal["小规模纳税人", "一般纳税人", "不清楚"]
CollectionMethod = Literal["查账征收", "定期定额", "核定征收", "不清楚"]


# ---------- 1. 经营数据（录入模块产出，诊断和政策模块读取） ----------

class Profile(BaseModel):
    name: Optional[str] = Field(None, description="店名或企业名")
    entity_type: EntityType = "个体工商户"
    industry: Optional[str] = Field(None, description="行业，如 餐饮、零售、维修")
    region: Optional[str] = Field(None, description="省市，如 湖北省武汉市")
    taxpayer_type: TaxpayerType = "不清楚"
    collection_method: CollectionMethod = "不清楚"
    employees: Optional[int] = Field(None, description="从业人数（含老板）")
    total_assets: Optional[float] = Field(None, description="资产总额，元")


class Period(BaseModel):
    start: date
    end: date


class Transaction(BaseModel):
    date: date
    direction: Literal["收入", "支出"]
    amount: float = Field(..., ge=0, description="元，正数")
    category: str = Field(..., description="收入：销售/服务/其他；支出：进货/房租/工资/水电/税费/其他")
    counterparty: Optional[str] = None
    has_invoice: Optional[bool] = Field(None, description="是否开具或取得发票")
    source: Literal["拍照识别", "手动填写", "导入"] = "手动填写"
    note: Optional[str] = None


class TaxesPaid(BaseModel):
    vat: float = Field(0, description="增值税")
    surtaxes: float = Field(0, description="附加税费（城建税、教育费附加等）")
    income_tax: float = Field(0, description="个人所得税（经营所得）或企业所得税")
    other: float = 0


class CashPosition(BaseModel):
    cash_balance: Optional[float] = Field(None, description="期末现金和银行存款")
    debts: Optional[float] = Field(None, description="借款余额")
    monthly_debt_payment: Optional[float] = Field(None, description="每月还款额")
    receivables: Optional[float] = Field(None, description="别人欠我的")
    payables: Optional[float] = Field(None, description="我欠别人的（含货款）")


class BusinessData(BaseModel):
    profile: Profile
    period: Period
    transactions: list[Transaction] = []
    taxes_paid: TaxesPaid = TaxesPaid()
    cash: CashPosition = CashPosition()
    missing_fields: list[str] = Field(
        default_factory=list, description="录入模块标记的缺失字段，诊断时据此降低置信度"
    )


# ---------- 2. 政策（政策模块产出） ----------

class Policy(BaseModel):
    id: str
    title: str
    summary: str = Field(..., description="一两句话的通俗说明")
    tax_type: str = Field(..., description="增值税 / 个人所得税 / 企业所得税 / 六税两费 / 其他")
    conditions: str = Field(..., description="适用条件原文或摘录")
    source_name: str = Field(..., description="文件名称和文号")
    source_url: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


class PolicyMatch(BaseModel):
    policy: Policy
    status: Literal["符合", "可能符合", "不符合"]
    reason: str = Field(..., description="依据哪些数据得出该判断")
    missing_info: list[str] = []


# ---------- 3. 诊断结果（诊断模块产出） ----------

class Indicator(BaseModel):
    key: str
    name: str
    value: Optional[float]
    unit: str = ""
    level: Literal["正常", "关注", "预警", "数据不足"]
    explanation: str = Field(..., description="给老板看的通俗解释")


class Diagnosis(BaseModel):
    period: Period
    summary: str
    indicators: list[Indicator]
    risks: list[str] = []
    policy_matches: list[PolicyMatch] = []
    disclaimer: str = (
        "本结果基于您填写的信息自动生成，仅用于了解经营和财税状况，"
        "不构成税务或财务建议。具体办理请以税务机关解释为准，或咨询专业人员。"
    )
