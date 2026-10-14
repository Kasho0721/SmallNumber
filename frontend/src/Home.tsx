import { useEffect, useState } from 'react'
import { api } from './api'
import sample from './sample.json'
import { IconArrow, IconBack, IconCamera, IconMegaphone, IconPulse, IconReceipt, IconSettings, IconUpload } from './icons'
import type { BusinessData, Transaction } from './types'

export type Scan = { url: string; txs: Transaction[] }

// 2026-07-01 → 7月1日
const md = (s: string) => { const [, m, d] = s.split('-').map(Number); return `${m}月${d}日` }
const money = (v: number) => v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })

// 统计格子空间有限，过万显示“x.x 万”
function wan(v: number) {
  return v >= 10000 ? `${(v / 10000).toFixed(1)}万` : money(v)
}

export function Home({ data, industry, busy, onScan, onSample, onDiagnose, onSettings }: {
  data: BusinessData; industry: string; busy: boolean
  onScan: (f: File) => void; onSample: (d: BusinessData) => void; onDiagnose: () => void; onSettings: () => void
}) {
  const [missing, setMissing] = useState<string | null>(null)
  const txs = data.transactions
  const income = txs.filter(t => t.direction === '收入').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter(t => t.direction === '支出').reduce((s, t) => s + t.amount, 0)
  const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  const p = data.profile

  // 账目或店铺信息变了就重新问一次“还缺什么”，结果显示在橙色气泡里
  useEffect(() => {
    let live = true
    api.nextQuestion(data).then(r => live && setMissing(r.next?.question ?? null)).catch(() => {})
    return () => { live = false }
  }, [data])

  return (
    <section>
      <div className="home-head">
        <div>
          <h1 className="page-title">老板，你好</h1>
          <div className="shop">
            <b>{p.name ?? '我的小店'}</b>
            <span className="chip brand">{p.industry || industry}</span>
          </div>
        </div>
        <button className="icon-btn" aria-label="设置" onClick={onSettings}><IconSettings /></button>
      </div>

      <div className="card">
        <div className="card-row">
          <h2 style={{ marginBottom: 0 }}>这段时间收支</h2>
          <span className="muted-sm">{md(data.period.start)} – {md(data.period.end)}</span>
        </div>
        <div className="stats">
          <div className="stat"><b>{txs.length}<small>笔</small></b><span>记账笔数</span></div>
          <div className="stat in"><b>{wan(income)}</b><span>收入</span></div>
          <div className="stat out"><b>{wan(expense)}</b><span>支出</span></div>
        </div>
      </div>

      <label className={`btn btn-primary btn-big${busy ? ' disabled' : ''}`}>
        <IconCamera />拍照记一笔
        <input type="file" accept="image/*" capture="environment" disabled={busy} hidden
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onScan(f) }} />
      </label>
      <button className="btn btn-ghost" disabled={busy} onClick={() => onSample(sample as BusinessData)}>
        <IconUpload />没有照片？用示例账本试试
      </button>

      {missing && (
        <div className="nudge"><IconMegaphone /><span>{missing}</span></div>
      )}

      {recent.length > 0 && <>
        <h3 className="section-title">最近记账<small>共 {txs.length} 笔</small></h3>
        <div className="card list">
          {recent.map((t, k) => (
            <div key={k} className="tx">
              <span className="tx-icon"><IconReceipt /></span>
              <div className="tx-main">
                <b>{t.note || [t.category, t.counterparty].filter(Boolean).join(' · ')}</b>
                <small>{md(t.date)} · {t.category}</small>
              </div>
              <span className={`tx-amt ${t.direction === '收入' ? 'in' : 'out'}`}>
                {t.direction === '收入' ? '+' : '−'}¥{money(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </>}

      <button className="btn btn-soft" disabled={busy || !txs.length} onClick={onDiagnose}>
        <IconPulse />{txs.length ? '开始体检' : '先记几笔账再体检'}
      </button>
    </section>
  )
}

const CATEGORIES = ['进货', '房租', '水电', '工资', '平台佣金', '销售', '其他']

// 拍照识别后逐笔确认，用户改好再记进账本
export function Confirm({ scan, onDone, onCancel }: {
  scan: Scan; onDone: (txs: Transaction[]) => void; onCancel: () => void
}) {
  const [k, setK] = useState(0)
  const [kept, setKept] = useState<Transaction[]>([])
  const [t, setT] = useState<Transaction | undefined>(scan.txs[0])
  const n = scan.txs.length

  function next(keep: boolean) {
    const all = keep && t ? [...kept, { ...t, source: '拍照识别' as const }] : kept
    if (k + 1 >= n) { onDone(all); return }
    setKept(all); setK(k + 1); setT(scan.txs[k + 1])
  }

  return (
    <section>
      <div className="sub-head">
        <button className="back" onClick={onCancel}><IconBack />返回</button>
        <h1>识别结果确认</h1>
        <span className="muted-sm">{n > 1 ? `${k + 1} / ${n}` : ''}</span>
      </div>
      <div className="card scan-card">
        <img src={scan.url} alt="拍的票据" className="scan-img" />
        {!t && <p className="hint">没认出账目。换个角度、光线亮一点再拍一次试试。</p>}
      </div>
      {t && <>
        <div className="card form">
          <label className="form-row"><span>日期</span>
            <input type="date" value={t.date} onChange={e => setT({ ...t, date: e.target.value })} /></label>
          <label className="form-row"><span>金额</span>
            <span className="amt-input">¥<input type="number" inputMode="decimal" value={t.amount}
              onChange={e => setT({ ...t, amount: Number(e.target.value) })} /></span></label>
          <div className="form-row"><span>类别</span>
            <div className="cats">
              {[...new Set([t.category, ...CATEGORIES])].map(c => (
                <button key={c} className={`cat${t.category === c ? ' on' : ''}`} onClick={() => setT({ ...t, category: c })}>{c}</button>
              ))}
            </div>
          </div>
          <label className="form-row"><span>对方</span>
            <input value={t.counterparty ?? ''} placeholder="比如 某某批发部" onChange={e => setT({ ...t, counterparty: e.target.value })} /></label>
          <div className="form-row"><span>收入/支出</span>
            <div className="seg">
              {(['收入', '支出'] as const).map(d => (
                <button key={d} className={t.direction === d ? 'on' : ''} onClick={() => setT({ ...t, direction: d })}>{d}</button>
              ))}
            </div>
          </div>
        </div>
        <button className="btn btn-primary" disabled={!t.amount} onClick={() => next(true)}>
          {k + 1 < n ? <>确认，看下一笔<IconArrow /></> : '确认记账'}
        </button>
        <button className="btn btn-ghost" onClick={() => next(false)}>这笔不要</button>
      </>}
      {!t && <button className="btn btn-primary" onClick={onCancel}>回去重拍</button>}
    </section>
  )
}
