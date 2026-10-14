import { useState } from 'react'
import { formatValue, indicatorQuestion, riskQuestion } from './ask'
import { IconAlertCircle, IconArrow, IconPulse } from './icons'
import type { Diagnosis, Indicator } from './types'

const chipClass: Record<Indicator['level'], string> = { 正常: 'ok', 关注: 'warn', 预警: 'bad', 数据不足: '' }
const levelLabel: Record<Indicator['level'], string> = { 正常: '良好', 关注: '留意', 预警: '需关注', 数据不足: '数据不足' }

// 健康分只在前端由指标等级折算，便于一眼看懂；后端没有这个字段
function healthScore(inds: Indicator[]) {
  const pts = { 正常: 100, 关注: 60, 预警: 0 } as Record<string, number>
  const rated = inds.filter(i => i.level in pts)
  if (!rated.length) return null
  const avg = Math.round(rated.reduce((s, i) => s + pts[i.level], 0) / rated.length)
  // 有预警时分数不超过 64，避免“90 分”却有红灯
  return rated.some(i => i.level === '预警') ? Math.min(avg, 64) : rated.some(i => i.level === '关注') ? Math.min(avg, 84) : avg
}

function Ring({ score }: { score: number | null }) {
  const r = 52, c = 2 * Math.PI * r
  const tone = score == null ? 'none' : score >= 85 ? 'ok' : score >= 65 ? 'warn' : 'bad'
  const label = { none: '数据不足', ok: '良好', warn: '一般', bad: '需关注' }[tone]
  return (
    <div className={`ring tone-${tone}`}>
      <svg viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} className="ring-track" />
        <circle cx="64" cy="64" r={r} className="ring-bar" strokeDasharray={c} strokeDashoffset={c * (1 - (score ?? 0) / 100)} />
      </svg>
      <div className="ring-num"><div><b>{score ?? '—'}</b><small>分</small><span>{label}</span></div></div>
    </div>
  )
}

function AskLink({ onClick, disabled, children = '问问这个' }: { onClick: () => void; disabled: boolean; children?: string }) {
  return (
    <button className="ask-link" disabled={disabled} onClick={e => { e.stopPropagation(); onClick() }}>
      {children}<IconArrow />
    </button>
  )
}

// “现金可支撑月数：按现在的开支……”拆成标题和说明
function splitRisk(r: string): [string, string] {
  const i = r.indexOf('：')
  return i > 0 ? [r.slice(0, i), r.slice(i + 1)] : [r, '']
}

export function Report({ report, period, busy, onStart, onAsk, onPolicy }: {
  report: Diagnosis | null; period: string; busy: boolean; onStart: () => void
  onAsk: (question: string, policyId?: string) => void; onPolicy: (policyId: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)

  if (!report) return (
    <div className="empty">
      <div className="empty-icon"><IconPulse /></div>
      <h2>还没有体检报告</h2>
      <p>先记几笔账，再点“开始体检”。</p>
      <button className="btn btn-primary" onClick={onStart}>去记账</button>
    </div>
  )

  const matches = report.policy_matches.filter(m => m.status !== '不符合')
  const score = healthScore(report.indicators)
  const count = (lv: Indicator['level']) => report.indicators.filter(i => i.level === lv).length

  return (
    <section>
      <h1 className="page-title">生意体检报告</h1>
      <p className="page-sub">{period}</p>

      <div className="card dash">
        <Ring score={score} />
        <div className="dash-counts">
          <span className="chip ok">良好 {count('正常')}</span>
          <span className="chip warn">留意 {count('关注')}</span>
          <span className="chip bad">需关注 {count('预警')}</span>
        </div>
      </div>

      {report.risks.map((r, k) => {
        const [title, text] = splitRisk(r)
        return (
          <div key={k} className="alert">
            <IconAlertCircle />
            <div>
              <h2>{title}</h2>
              {text && <p>{text}</p>}
              <AskLink disabled={busy} onClick={() => onAsk(riskQuestion(r))}>问问怎么办</AskLink>
            </div>
          </div>
        )
      })}

      <h3 className="section-title">各项指标<small>点开看说明</small></h3>
      <div className="inds">
        {report.indicators.map(i => {
          const [v, unit] = formatValue(i)
          const isOpen = open === i.key
          const q = indicatorQuestion(i)
          const toggle = () => setOpen(isOpen ? null : i.key)
          return (
            <div key={i.key} role="button" tabIndex={0} className={`ind${isOpen ? ' open' : ''}`}
              onClick={toggle} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle())}
              aria-expanded={isOpen}>
              <div className="ind-top">
                <span className="ind-name">{i.name}</span>
                <span className={`chip ${chipClass[i.level]}`}>{levelLabel[i.level]}</span>
              </div>
              <span className={`ind-val${(v + unit).length > 7 ? ' long' : ''}`}>{v}{unit && <small>{unit}</small>}</span>
              {isOpen && <span className="ind-exp">{i.explanation}</span>}
              {isOpen && q && <AskLink disabled={busy} onClick={() => onAsk(q)} />}
            </div>
          )
        })}
      </div>

      {matches.length > 0 && <>
        <h3 className="section-title">可能用得上的优惠</h3>
        <div className="card list">
          {matches.map(m => (
            <button key={m.policy.id} className="row-link" onClick={() => onPolicy(m.policy.id)}>
              <b>{m.policy.title}</b>
              <IconArrow />
            </button>
          ))}
        </div>
      </>}

      <p className="disclaimer center">仅供参考，以税务机关官方解释为准</p>
    </section>
  )
}
