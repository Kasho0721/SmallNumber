import type { AskResult, BusinessData, Diagnosis, PolicyGuide, Transaction } from './types'

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${url} ${r.status}`)
  return r.json()
}

export const api = {
  diagnose: (d: BusinessData) => post<Diagnosis>('/api/diagnose', d),
  guide: (policyId: string, d: BusinessData) => post<PolicyGuide>(`/api/policy/${policyId}/guide`, d),
  nextQuestion: (d: BusinessData) => post<{ next: { field: string; question: string } | null }>('/api/intake/next-question', d),
  // 传 data 时回答会结合这家店的体检数据；policyId 是从报告里某条政策点进来的
  ask: (question: string, data?: BusinessData, policyId?: string) =>
    post<AskResult>('/api/policy/ask', { question, data, policy_id: policyId }),
  async extract(file: File): Promise<{ transactions: Transaction[]; llm: boolean }> {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/intake/extract', { method: 'POST', body: fd })
    if (!r.ok) throw new Error(`extract ${r.status}`)
    return r.json()
  },
}
