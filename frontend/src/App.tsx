import { useState } from 'react'
import { api } from './api'
import sample from './sample.json'
import { PolicyGuideView } from './PolicyGuide'
import { Report } from './Report'
import { IconAlert, IconBook, IconCamera, IconChat, IconList, IconPulse, IconSpark } from './icons'
import type { BusinessData, Diagnosis, PolicyGuide } from './types'

type View = 'intake' | 'report' | 'ask'
export type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>

const empty: BusinessData = {
  profile: { entity_type: '个体工商户', taxpayer_type: '不清楚', collection_method: '不清楚' },
  period: { start: '2026-07-01', end: '2026-09-30' },
  transactions: [],
  taxes_paid: { vat: 0, surtaxes: 0, income_tax: 0, other: 0 },
  cash: {},
  missing_fields: [],
}

const tabs: { key: View; label: string; Icon: typeof IconBook }[] = [
  { key: 'intake', label: '记账', Icon: IconBook },
  { key: 'report', label: '体检报告', Icon: IconPulse },
  { key: 'ask', label: '问政策', Icon: IconChat },
]

export default function App() {
  const [view, setView] = useState<View>('intake')
  const [data, setData] = useState<BusinessData>(empty)
  const [report, setReport] = useState<Diagnosis | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [guide, setGuide] = useState<PolicyGuide | null>(null)

  // label 是加载时显示的文字
  const withLabel = (label: string): Run => async fn => {
    setBusy(label); setMsg('')
    try { return await fn() } catch (e) { setMsg(String(e)) } finally { setBusy('') }
  }

  function go(v: View) { setView(v); setGuide(null); window.scrollTo(0, 0) }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">数</div>
        <div>
          <h1>小企有数</h1>
          <p>小店老板的财税体检本</p>
        </div>
      </header>

      {msg && <div className="err"><IconAlert />出了点问题：{msg}</div>}

      <main>
        {view === 'intake' && (
          <Intake data={data} setData={setData} busy={!!busy} withLabel={withLabel}
            onDiagnose={async () => {
              const r = await withLabel('正在体检，请稍等…')(() => api.diagnose(data))
              if (r) { setReport(r); setGuide(null); go('report') }
            }} />
        )}
        {view === 'report' && (guide
          ? <PolicyGuideView guide={guide} onBack={() => { setGuide(null); window.scrollTo(0, 0) }} />
          : <Report report={report} busy={!!busy} onStart={() => go('intake')} onGuide={async id => {
              const g = await withLabel('正在生成办理步骤…')(() => api.guide(id, data))
              if (g) { setGuide(g); window.scrollTo(0, 0) }
            }} />)}
        {view === 'ask' && <Ask run={withLabel('正在查政策…')} busy={!!busy} />}
      </main>

      <nav className="tabbar">
        <div className="tabbar-inner">
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} className={view === key ? 'on' : ''} onClick={() => go(key)}>
              <Icon />
              {label}
              {key === 'report' && report && view !== 'report' && <i className="dot" />}
            </button>
          ))}
        </div>
      </nav>

      {busy && (
        <div className="loading" role="status">
          <div className="loading-box"><div className="spinner" />{busy}</div>
        </div>
      )}
    </div>
  )
}

function Intake({ data, setData, busy, withLabel, onDiagnose }: {
  data: BusinessData; setData: (d: BusinessData) => void; busy: boolean
  withLabel: (label: string) => Run; onDiagnose: () => void
}) {
  const [question, setQuestion] = useState<string | null>(null)
  const income = data.transactions.filter(t => t.direction === '收入').reduce((s, t) => s + t.amount, 0)
  const expense = data.transactions.filter(t => t.direction === '支出').reduce((s, t) => s + t.amount, 0)
  const p = data.profile

  // TODO(A)：把这里做成对话式录入，用户的口语回答交给后端解析后写回 data
  return (
    <section>
      <h2 className="page-title">记一记这段时间的账</h2>
      <p className="page-sub">拍几张照片就行，剩下的交给我们。</p>

      <div className="card">
        <h2><span className="card-icon"><IconCamera /></span>拍照记账</h2>
        <p className="hint">收款截图、进货单、手写账本都可以。</p>
        <label className={`upload${busy ? ' disabled' : ''}`}>
          <IconCamera />
          <b>点这里拍照</b>
          <span>也可以从相册里选</span>
          <input type="file" accept="image/*" capture="environment" disabled={busy}
            onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return
              e.target.value = ''
              const r = await withLabel('正在识别图片…')(() => api.extract(f))
              if (r) {
                setData({ ...data, transactions: [...data.transactions, ...r.transactions] })
                if (!r.llm) alert('演示模式：后端没有配置模型，暂不能识别图片。')
              }
            }} />
        </label>
        <button className="btn btn-ghost" onClick={() => setData(sample as BusinessData)}>
          没有照片？先看示例
        </button>
      </div>

      <div className="card">
        <h2><span className="card-icon"><IconList /></span>已经记下的</h2>
        <div className="shop">
          <b>{p.name ?? '还没填店名'}</b>
          <span className="chip brand">{p.entity_type}</span>
          {p.taxpayer_type !== '不清楚' && <span className="chip">{p.taxpayer_type}</span>}
        </div>
        <div className="stats">
          <div className="stat"><b>{data.transactions.length}</b><span>笔记录</span></div>
          <div className="stat in"><b>{wan(income)}</b><span>收入</span></div>
          <div className="stat out"><b>{wan(expense)}</b><span>支出</span></div>
        </div>
        <button className="btn btn-soft" disabled={busy} onClick={async () => {
          const r = await withLabel('看看还缺什么…')(() => api.nextQuestion(data))
          setQuestion(r?.next ? r.next.question : '信息已经齐了，可以开始体检。')
        }}><IconSpark />还缺什么信息？</button>
        {question && (
          <div className="bubble-row">
            <div className="avatar">数</div>
            <p className="bubble">{question}</p>
          </div>
        )}
      </div>

      <div className="cta-bar">
        <button className="btn btn-primary" disabled={busy || !data.transactions.length} onClick={onDiagnose}>
          <IconPulse />{data.transactions.length ? '开始体检' : '先记几笔账再体检'}
        </button>
      </div>
    </section>
  )
}

// 统计格子空间有限，过万显示“x.x 万”
function wan(v: number) {
  return v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toLocaleString()
}

const suggestions = [
  '我是个体户，一个月卖 8 万要交增值税吗？',
  '小规模纳税人城建税怎么交？',
  '个体户经营所得有什么减半优惠？',
]

function Ask({ run, busy }: { run: Run; busy: boolean }) {
  const [q, setQ] = useState(suggestions[0])
  const [a, setA] = useState<Awaited<ReturnType<typeof api.ask>> | null>(null)
  return (
    <section>
      <h2 className="page-title">问政策</h2>
      <p className="page-sub">用大白话问就行，回答都会标出依据的文件。</p>
      <div className="card">
        <textarea value={q} onChange={e => setQ(e.target.value)} rows={3} placeholder="想问什么？" />
        <div className="suggests">
          {suggestions.map(s => <button key={s} onClick={() => setQ(s)}>{s}</button>)}
        </div>
        <button className="btn btn-primary" disabled={busy || !q.trim()}
          onClick={async () => setA((await run(() => api.ask(q))) ?? null)}>
          <IconChat />提问
        </button>
      </div>
      {a && (
        <div className="card">
          <div className="bubble-row" style={{ marginTop: 0 }}>
            <div className="avatar">数</div>
            <div style={{ flex: 1 }}>
              <p className="answer">{a.answer}</p>
              <p className="src">依据：{a.sources.map(s => s.source_name).filter((v, i, arr) => arr.indexOf(v) === i).join('；')}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
