import { useState } from 'react'
import { api } from './api'
import sample from './sample.json'
import type { BusinessData, Diagnosis } from './types'

type View = 'intake' | 'report' | 'ask'

const empty: BusinessData = {
  profile: { entity_type: '个体工商户', taxpayer_type: '不清楚', collection_method: '不清楚' },
  period: { start: '2026-07-01', end: '2026-09-30' },
  transactions: [],
  taxes_paid: { vat: 0, surtaxes: 0, income_tax: 0, other: 0 },
  cash: {},
  missing_fields: [],
}

export default function App() {
  const [view, setView] = useState<View>('intake')
  const [data, setData] = useState<BusinessData>(empty)
  const [report, setReport] = useState<Diagnosis | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true); setMsg('')
    try { return await fn() } catch (e) { setMsg(String(e)) } finally { setBusy(false) }
  }

  return (
    <div className="app">
      <header>
        <h1>小企有数</h1>
        <p>小微商户财税体检</p>
      </header>
      <nav>
        {(['intake', 'report', 'ask'] as View[]).map(v => (
          <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
            {{ intake: '录入', report: '体检报告', ask: '问政策' }[v]}
          </button>
        ))}
      </nav>
      {msg && <div className="err">{msg}</div>}
      <main>
        {view === 'intake' && (
          <Intake data={data} setData={setData} busy={busy} run={run}
            onDiagnose={async () => {
              const r = await run(() => api.diagnose(data))
              if (r) { setReport(r); setView('report') }
            }} />
        )}
        {view === 'report' && <Report report={report} />}
        {view === 'ask' && <Ask run={run} busy={busy} />}
      </main>
    </div>
  )
}

function Intake({ data, setData, busy, run, onDiagnose }: {
  data: BusinessData; setData: (d: BusinessData) => void; busy: boolean
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>; onDiagnose: () => void
}) {
  const [question, setQuestion] = useState<string | null>(null)
  const income = data.transactions.filter(t => t.direction === '收入').reduce((s, t) => s + t.amount, 0)
  const expense = data.transactions.filter(t => t.direction === '支出').reduce((s, t) => s + t.amount, 0)

  // TODO(A)：把这里做成对话式录入，用户的口语回答交给后端解析后写回 data
  return (
    <section>
      <div className="card">
        <h2>1. 拍照记账</h2>
        <p className="hint">拍收款截图、进货单、手写账本都可以。</p>
        <input type="file" accept="image/*" capture="environment" disabled={busy}
          onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return
            const r = await run(() => api.extract(f))
            if (r) {
              setData({ ...data, transactions: [...data.transactions, ...r.transactions] })
              if (!r.llm) alert('演示模式：后端没有配置模型，暂不能识别图片。')
            }
          }} />
        <button className="link" onClick={() => setData(sample as BusinessData)}>或者载入示例数据（张姐早餐店）</button>
      </div>

      <div className="card">
        <h2>2. 已录入</h2>
        <p>{data.profile.name ?? '未命名'} · {data.profile.entity_type} · {data.profile.taxpayer_type}</p>
        <p>{data.transactions.length} 笔记录，收入 {income.toLocaleString()} 元，支出 {expense.toLocaleString()} 元</p>
        <button disabled={busy} onClick={async () => {
          const r = await run(() => api.nextQuestion(data))
          setQuestion(r?.next ? r.next.question : '信息已经齐了，可以开始体检。')
        }}>还缺什么？</button>
        {question && <p className="bubble">{question}</p>}
      </div>

      <button className="primary" disabled={busy || !data.transactions.length} onClick={onDiagnose}>
        {busy ? '处理中…' : '开始体检'}
      </button>
    </section>
  )
}

const pct = new Set(['profit_margin', 'gross_margin', 'tax_burden', 'expense_no_invoice', 'debt_pressure'])

function Report({ report }: { report: Diagnosis | null }) {
  if (!report) return <p className="hint">先在“录入”页填写信息并开始体检。</p>
  const matches = report.policy_matches.filter(m => m.status !== '不符合')
  return (
    <section>
      <div className="card"><h2>总体情况</h2><p>{report.summary}</p></div>
      <div className="card">
        <h2>指标</h2>
        {report.indicators.map(i => (
          <div key={i.key} className={`ind lv-${i.level}`}>
            <div className="row">
              <span>{i.name}</span>
              <b>{i.value == null ? '—' : pct.has(i.key) ? `${(i.value * 100).toFixed(1)}%` : `${i.value < 10 ? i.value.toFixed(1) : Math.round(i.value).toLocaleString()} ${i.unit}`}</b>
              <em>{i.level}</em>
            </div>
            <p>{i.explanation}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>可能适用的优惠政策</h2>
        {matches.map(m => (
          <div key={m.policy.id} className="policy">
            <div className="row"><b>{m.policy.title}</b><em>{m.status}</em></div>
            <p>{m.reason}</p>
            <p className="src">依据：{m.policy.source_name}</p>
          </div>
        ))}
      </div>
      <p className="disclaimer">{report.disclaimer}</p>
    </section>
  )
}

function Ask({ run, busy }: { run: <T>(fn: () => Promise<T>) => Promise<T | undefined>; busy: boolean }) {
  const [q, setQ] = useState('我是个体户，一个月卖 8 万要交增值税吗？')
  const [a, setA] = useState<Awaited<ReturnType<typeof api.ask>> | null>(null)
  return (
    <section>
      <div className="card">
        <textarea value={q} onChange={e => setQ(e.target.value)} rows={3} />
        <button className="primary" disabled={busy} onClick={async () => setA((await run(() => api.ask(q))) ?? null)}>提问</button>
      </div>
      {a && (
        <div className="card">
          <p style={{ whiteSpace: 'pre-wrap' }}>{a.answer}</p>
          <p className="src">参考：{a.sources.map(s => s.source_name).filter((v, i, arr) => arr.indexOf(v) === i).join('；')}</p>
        </div>
      )}
    </section>
  )
}
