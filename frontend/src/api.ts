import type { BusinessData, Diagnosis, Transaction } from './types'

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${url} ${r.status}`)
  return r.json()
}

export const api = {
  diagnose: (d: BusinessData) => post<Diagnosis>('/api/diagnose', d),
  nextQuestion: (d: BusinessData) => post<{ next: { field: string; question: string } | null }>('/api/intake/next-question', d),
  ask: (question: string) => post<{ answer: string; sources: { title: string; source_name: string }[] }>('/api/policy/ask', { question }),
  async extract(file: File): Promise<{ transactions: Transaction[]; llm: boolean }> {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/intake/extract', { method: 'POST', body: fd })
    if (!r.ok) throw new Error(`extract ${r.status}`)
    return r.json()
  },
}
