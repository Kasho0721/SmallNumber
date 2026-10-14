import type { Diagnosis, Indicator } from './types'

// 报告和问政策共用：把体检结果变成可以直接问的问题

const pct = new Set(['profit_margin', 'gross_margin', 'tax_burden', 'expense_no_invoice', 'debt_pressure'])

export function formatValue(i: Indicator): [string, string] {
  if (i.value == null) return ['—', '']
  if (pct.has(i.key)) return [(i.value * 100).toFixed(1), '%']
  return [i.value < 10 ? i.value.toFixed(1) : Math.round(i.value).toLocaleString(), i.unit]
}

// 只有和交税有关的指标才给“问政策”入口；现金、还款这类政策库里没有对应条目
const indicatorAsk: Record<string, (v: string) => string> = {
  monthly_revenue: v => `我月均收入 ${v}，要交增值税吗？`,
  profit_margin: v => `我的利润率是 ${v}，经营所得个税有什么优惠？`,
  tax_burden: v => `我的综合税负率是 ${v}，还能享受哪些减免？`,
  expense_no_invoice: v => `我有 ${v} 的支出没有发票，对交税有什么影响？`,
  vat_exempt_headroom: v => `我离增值税免税额度还差 ${v}，超过了会怎样？`,
}

export function indicatorQuestion(i: Indicator): string | null {
  const q = indicatorAsk[i.key]
  if (!q || i.value == null) return null
  const [v, unit] = formatValue(i)
  return q(unit === '%' ? `${v}%` : `${v} ${unit}`)
}

export function policyQuestion(title: string) {
  return `${title}，对我的店适用吗？要满足什么条件？`
}

export function riskQuestion(risk: string) {
  return `体检提示“${risk}”，这和交税有关系吗？`
}

export const genericQuestions = [
  '我是个体户，一个月卖 8 万要交增值税吗？',
  '小规模纳税人城建税怎么交？',
  '个体户经营所得有什么减半优惠？',
]

// 按这家店的报告挑 3 个最值得问的问题：先问亮了黄灯红灯的，再问免税额度，再问最相关的优惠
export function reportQuestions(r: Diagnosis | null): { q: string; policyId?: string }[] {
  if (!r) return genericQuestions.map(q => ({ q }))
  const out: { q: string; policyId?: string }[] = []
  const rank = { 预警: 0, 关注: 1, 正常: 2, 数据不足: 3 }
  for (const i of [...r.indicators].sort((a, b) => rank[a.level] - rank[b.level])) {
    if (i.level === '正常' && i.key !== 'vat_exempt_headroom') continue
    const q = indicatorQuestion(i)
    if (q) out.push({ q })
  }
  for (const m of r.policy_matches.filter(m => m.status !== '不符合')) {
    out.push({ q: policyQuestion(m.policy.title), policyId: m.policy.id })
  }
  return out.slice(0, 3)
}
