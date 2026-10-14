import { useState } from 'react'
import { api } from './api'
import { Ask } from './Ask'
import { Confirm, Home } from './Home'
import type { Scan } from './Home'
import { IconAlert, IconBook, IconChat, IconPulse } from './icons'
import { Onboarding } from './Onboarding'
import { PolicyDetailView, PolicyGuideView } from './PolicyGuide'
import { Report } from './Report'
import { loadSettings, saveSettings } from './settings'
import type { Settings } from './settings'
import type { AskTurn, BusinessData, Diagnosis, PolicyGuide } from './types'

type View = 'intake' | 'report' | 'ask'
export type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>

// 盖在标签页上面的二级页面：识别确认、政策详情、办理指引、设置。from 记下从哪个标签进来，返回时回到原处
type Sub =
  | { kind: 'confirm'; scan: Scan }
  | { kind: 'policy'; id: string; from: View }
  | { kind: 'guide'; g: PolicyGuide; from: View }
  | { kind: 'settings' }

const empty = (industry?: string): BusinessData => ({
  profile: { entity_type: '个体工商户', taxpayer_type: '不清楚', collection_method: '不清楚', industry },
  period: { start: '2026-07-01', end: '2026-09-30' },
  transactions: [],
  taxes_paid: { vat: 0, surtaxes: 0, income_tax: 0, other: 0 },
  cash: {},
  missing_fields: [],
})

const tabs: { key: View; label: string; Icon: typeof IconBook }[] = [
  { key: 'intake', label: '记账', Icon: IconBook },
  { key: 'report', label: '体检报告', Icon: IconPulse },
  { key: 'ask', label: '问政策', Icon: IconChat },
]

const backTo: Record<View, string> = { intake: '返回记账', report: '返回体检报告', ask: '返回问政策' }

function periodLabel(d: BusinessData) {
  const [y, m1] = d.period.start.split('-').map(Number)
  const m2 = Number(d.period.end.split('-')[1])
  return m1 === m2 ? `${y}年${m1}月` : `${y}年${m1}月 – ${m2}月`
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(loadSettings)
  const [view, setView] = useState<View>('intake')
  const [sub, setSub] = useState<Sub | null>(null)
  const [data, setData] = useState<BusinessData>(() => empty(settings?.industry))
  const [report, setReport] = useState<Diagnosis | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [turns, setTurns] = useState<AskTurn[]>([])
  const [useShop, setUseShop] = useState(true)

  // label 是加载时显示的文字
  const withLabel = (label: string): Run => async fn => {
    setBusy(label); setMsg('')
    try { return await fn() } catch (e) { setMsg(String(e)) } finally { setBusy('') }
  }

  function go(v: View) { setView(v); setSub(null); window.scrollTo(0, 0) }
  function open(s: Sub | null) { setSub(s); window.scrollTo(0, 0) }

  function finishSetup(s: Settings) {
    saveSettings(s); setSettings(s)
    setData(d => ({ ...d, profile: { ...d.profile, industry: s.industry } }))
    open(null)
  }

  async function scan(f: File) {
    const r = await withLabel('正在识别图片…')(() => api.extract(f))
    if (!r) return
    if (!r.llm) { setMsg('演示模式：后端没有配置模型，暂不能识别图片。可以先用示例账本试试。'); return }
    open({ kind: 'confirm', scan: { url: URL.createObjectURL(f), txs: r.transactions } })
  }

  async function openGuide(id: string, from: View) {
    const g = await withLabel('正在整理办理步骤…')(() => api.guide(id, data))
    if (g) open({ kind: 'guide', g, from })
  }

  // 报告里任何一处点“问问”，都带着问题跳到问政策，并把这家店的数据一起发给后端
  async function ask(question: string, policyId?: string) {
    const withShop = !!report && useShop
    setView('ask'); setSub(null)
    const r = await withLabel('正在结合你的数据查政策…')(() => api.ask(question, withShop ? data : undefined, policyId))
    if (r) setTurns(t => [...t, { question, withShop, result: r }])
  }

  if (!settings) return <div className="app bare"><Onboarding initial={null} onDone={finishSetup} /></div>
  if (sub?.kind === 'settings') return (
    <div className="app bare"><Onboarding initial={settings} onDone={finishSetup} onCancel={() => open(null)} /></div>
  )

  return (
    <div className="app">
      {msg && <div className="err"><IconAlert />{msg.startsWith('演示模式') ? msg : `出了点问题：${msg}`}</div>}

      <main>
        {sub?.kind === 'confirm' ? (
          <Confirm scan={sub.scan} onCancel={() => open(null)}
            onDone={txs => { setData(d => ({ ...d, transactions: [...d.transactions, ...txs] })); open(null) }} />
        ) : sub?.kind === 'policy' ? (
          <PolicyDetailView id={sub.id} busy={!!busy} backLabel={backTo[sub.from]}
            match={report?.policy_matches.find(m => m.policy.id === sub.id)}
            onBack={() => open(null)} onGuide={id => openGuide(id, sub.from)} onAsk={ask} />
        ) : sub?.kind === 'guide' ? (
          <PolicyGuideView guide={sub.g} backLabel={backTo[sub.from]} onBack={() => open(null)} />
        ) : <>
          {view === 'intake' && (
            <Home data={data} industry={settings.industry} busy={!!busy} onScan={scan}
              onSample={d => setData({ ...d, profile: { ...d.profile, industry: d.profile.industry ?? settings.industry } })}
              onSettings={() => open({ kind: 'settings' })}
              onDiagnose={async () => {
                const r = await withLabel('正在体检，请稍等…')(() => api.diagnose(data))
                if (r) { setReport(r); go('report') }
              }} />
          )}
          {view === 'report' && (
            <Report report={report} period={periodLabel(data)} busy={!!busy} onStart={() => go('intake')} onAsk={ask}
              onPolicy={id => open({ kind: 'policy', id, from: 'report' })} />
          )}
          {view === 'ask' && (
            <Ask data={data} report={report} turns={turns} busy={!!busy} useShop={useShop} setUseShop={setUseShop}
              onAsk={ask} onPolicy={id => open({ kind: 'policy', id, from: 'ask' })} onGoReport={() => go('intake')} />
          )}
        </>}
      </main>

      <nav className="tabbar">
        <div className="tabbar-inner">
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} className={view === key && !sub ? 'on' : ''} onClick={() => go(key)}>
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
