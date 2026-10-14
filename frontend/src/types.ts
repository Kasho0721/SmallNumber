// 与 backend/app/schemas.py 保持一致，改字段两边一起改
export type Direction = '收入' | '支出'

export interface Transaction {
  date: string
  direction: Direction
  amount: number
  category: string
  counterparty?: string | null
  has_invoice?: boolean | null
  source?: '拍照识别' | '手动填写' | '导入'
  note?: string | null
}

export interface Profile {
  name?: string | null
  entity_type: '个体工商户' | '小微企业' | '其他'
  industry?: string | null
  region?: string | null
  taxpayer_type: '小规模纳税人' | '一般纳税人' | '不清楚'
  collection_method: '查账征收' | '定期定额' | '核定征收' | '不清楚'
  employees?: number | null
  total_assets?: number | null
}

export interface BusinessData {
  profile: Profile
  period: { start: string; end: string }
  transactions: Transaction[]
  taxes_paid: { vat: number; surtaxes: number; income_tax: number; other: number }
  cash: {
    cash_balance?: number | null
    debts?: number | null
    monthly_debt_payment?: number | null
    receivables?: number | null
    payables?: number | null
  }
  missing_fields: string[]
}

export interface Indicator {
  key: string
  name: string
  value: number | null
  unit: string
  level: '正常' | '关注' | '预警' | '数据不足'
  explanation: string
}

export interface PolicyMatch {
  policy: { id: string; title: string; summary: string; region: string; source_name: string; source_url?: string | null }
  status: '符合' | '可能符合' | '不符合'
  reason: string
  missing_info: string[]
}

export interface Diagnosis {
  summary: string
  indicators: Indicator[]
  risks: string[]
  policy_matches: PolicyMatch[]
  disclaimer: string
}

export interface FillField { form: string; line: string; label: string; value: number | null; note: string }
export interface GuideStep { title: string; detail: string; check: string | null; fields: FillField[] }
export interface Download { name: string; url: string; note: string }
export interface PolicyGuide {
  policy_id: string
  title: string
  where: string
  steps: GuideStep[]
  downloads: Download[]
  caution: string
}

export interface AskSource { id: string; title: string; source_name: string; source_url?: string | null; has_guide: boolean }
// shop_facts：后端回答时实际用到的这家店的数据要点，页面上展示“结合了什么”
export interface AskResult { answer: string; sources: AskSource[]; shop_facts: string[] }
export interface AskTurn { question: string; withShop: boolean; result: AskResult }
