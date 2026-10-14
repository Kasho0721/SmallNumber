import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { reportQuestions } from './ask'
import sample from './sample.json'
import { PolicyGuideView } from './PolicyGuide'
import { Report } from './Report'
import { IconAlert, IconArrow, IconBook, IconCamera, IconChat, IconGift, IconHelp, IconList, IconPulse } from './icons'
import type { AskTurn, BusinessData, Diagnosis, PolicyGuide } from './types'

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
  // 引导填写可以从报告或问政策进入，记下从哪来，返回时回到原处
  const [guide, setGuide] = useState<{ g: PolicyGuide; from: View } | null>(null)
  const [turns, setTurns] = useState<AskTurn[]>([])
  const [useShop, setUseShop] = useState(true)

  // label 是加载时显示的文字
  const withLabel = (label: string): Run => async fn => {
    setBusy(label); setMsg('')
    try { return await fn() } catch (e) { setMsg(String(e)) } finally { setBusy('') }
  }

  function go(v: View) { setView(v); setGuide(null); window.scrollTo(0, 0) }

  async function openGuide(id: string, from: View) {
    const g = await withLabel('正在生成办理步骤…')(() => api.guide(id, data))
    if (g) { setGuide({ g, from }); window.scrollTo(0, 0) }
  }

  // 报告里任何一处点“问问”，都带着问题跳到问政策，并把这家店的数据一起发给后端
  async function ask(question: string, policyId?: string) {
    const withShop = !!report && useShop
    setView('ask'); setGuide(null)
    const r = await withLabel('正在结合你的数据查政策…')(() => api.ask(question, withShop ? data : undefined, policyId))
    if (r) setTurns(t => [...t, { question, withShop, result: r }])
  }

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
        {guide ? (
          <PolicyGuideView guide={guide.g} backLabel={guide.from === 'ask' ? '返回问政策' : '返回体检报告'}
            onBack={() => { setGuide(null); window.scrollTo(0, 0) }} />
        ) : <>
          {view === 'intake' && (
            <Intake data={data} setData={setData} busy={!!busy} withLabel={withLabel}
              onDiagnose={async () => {
                const r = await withLabel('正在体检，请稍等…')(() => api.diagnose(data))
                if (r) { setReport(r); go('report') }
              }} />
          )}
          {view === 'report' && (
            <Report report={report} busy={!!busy} onStart={() => go('intake')} onAsk={ask}
              onGuide={id => openGuide(id, 'report')} />
          )}
          {view === 'ask' && (
            <Ask data={data} report={report} turns={turns} busy={!!busy} useShop={useShop} setUseShop={setUseShop}
              onAsk={ask} onGuide={id => openGuide(id, 'ask')} go={go} />
          )}
        </>}
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
      <p className="page-sub">拍好后会自动识别成一笔笔账。</p>

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
        }}><IconHelp />还缺什么信息？</button>
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

function Ask({ data, report, turns, busy, useShop, setUseShop, onAsk, onGuide, go }: {
  data: BusinessData; report: Diagnosis | null; turns: AskTurn[]; busy: boolean
  useShop: boolean; setUseShop: (v: boolean) => void
  onAsk: (q: string, policyId?: string) => void; onGuide: (id: string) => void; go: (v: View) => void
}) {
  const [q, setQ] = useState('')
  const last = useRef<HTMLDivElement>(null)
  // 有新回答时滚到它
  useEffect(() => { last.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [turns.length])

  const asked = new Set(turns.map(t => t.question))
  const suggests = reportQuestions(useShop ? report : null).filter(s => !asked.has(s.q))
  const p = data.profile
  const flagged = report?.indicators.filter(i => i.level === '关注' || i.level === '预警').length ?? 0

  return (
    <section>
      <h2 className="page-title">问政策</h2>
      <p className="page-sub">用大白话问就行，回答都会标出依据的文件。</p>

      {report ? (
        <div className={`card ctx${useShop ? '' : ' off'}`}>
          <div className="ctx-head">
            <IconPulse />
            <div>
              <b>{useShop ? `已结合「${p.name ?? '你的店'}」的体检数据` : '现在只按政策原文回答'}</b>
              <div className="ctx-chips">
                <span className="chip brand">{p.entity_type}</span>
                {p.taxpayer_type !== '不清楚' && <span className="chip brand">{p.taxpayer_type}</span>}
                {flagged > 0 && <span className="chip warn">{flagged} 项需留意</span>}
              </div>
            </div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={useShop} onChange={e => setUseShop(e.target.checked)} />
            回答时结合我的数据
          </label>
          <button className="ask-link" onClick={() => go('report')}>回到体检报告<IconArrow /></button>
        </div>
      ) : (
        <div className="card ctx off">
          <p className="hint">先做一次体检，回答就能结合你店里的收入、身份和体检结果。</p>
          <button className="ask-link" onClick={() => go('intake')}>去记账体检<IconArrow /></button>
        </div>
      )}

      {turns.map((t, k) => (
        <div key={k} ref={k === turns.length - 1 ? last : undefined} className="turn">
          <p className="q-bubble">{t.question}</p>
          <div className="card">
            <div className="bubble-row" style={{ marginTop: 0 }}>
              <div className="avatar">数</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="answer">{t.result.answer}</p>
                {t.withShop && t.result.shop_facts.length > 0 && (
                  <div className="ctx-chips used">
                    <span>结合了：</span>
                    {t.result.shop_facts.map(f => <span key={f} className="chip">{f}</span>)}
                  </div>
                )}
              </div>
            </div>
            <div className="srcs">
              <p className="srcs-title">依据的文件</p>
              {t.result.sources.map(s => (
                <div key={s.id} className="src-row">
                  <div>
                    {s.source_url
                      ? <a href={s.source_url} target="_blank" rel="noreferrer">{s.source_name}</a>
                      : <span>{s.source_name}</span>}
                    <small>{s.title}</small>
                  </div>
                  {s.has_guide && (
                    <button className="btn btn-soft" disabled={busy} onClick={() => onGuide(s.id)}><IconGift />怎么办理</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="card">
        <textarea value={q} onChange={e => setQ(e.target.value)} rows={3}
          placeholder={turns.length ? '还想问什么？' : '想问什么？比如：我要交增值税吗？'} />
        {suggests.length > 0 && (
          <div className="suggests">
            {suggests.map(s => <button key={s.q} disabled={busy} onClick={() => onAsk(s.q, s.policyId)}>{s.q}</button>)}
          </div>
        )}
        <button className="btn btn-primary" disabled={busy || !q.trim()}
          onClick={() => { onAsk(q.trim()); setQ('') }}>
          <IconChat />提问
        </button>
      </div>
    </section>
  )
}
