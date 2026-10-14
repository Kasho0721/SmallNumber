import { useState } from 'react'
import { formatValue, indicatorQuestion, policyQuestion, reportQuestions, riskQuestion } from './ask'
import { IconAlert, IconArrow, IconChat, IconGift, IconPulse } from './icons'
import type { Diagnosis, Indicator } from './types'

const chipClass: Record<Indicator['level'], string> = { 正常: 'ok', 关注: 'warn', 预警: 'bad', 数据不足: '' }

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
  const r = 50, c = 2 * Math.PI * r
  const color = score == null ? '#fff' : score >= 85 ? '#9ff0d8' : score >= 65 ? '#ffd58a' : '#ffab98'
  return (
    <div className="ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - (score ?? 0) / 100)} style={{ transition: 'stroke-dashoffset .8s' }} />
      </svg>
      <div className="ring-num"><div><b>{score ?? '—'}</b><span>健康分</span></div></div>
    </div>
  )
}

function AskLink({ onClick, disabled, children = '问问相关政策' }: { onClick: () => void; disabled: boolean; children?: string }) {
  return (
    <button className="ask-link" disabled={disabled} onClick={e => { e.stopPropagation(); onClick() }}>
      <IconChat />{children}<IconArrow />
    </button>
  )
}

export function Report({ report, busy, onGuide, onStart, onAsk }: {
  report: Diagnosis | null; busy: boolean; onGuide: (policyId: string) => void; onStart: () => void
  onAsk: (question: string, policyId?: string) => void
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
  const verdict = score == null ? '数据还不够' : count('预警') ? `${count('预警')} 项需要重点关注` : count('关注') ? '有几处要留意' : '整体状态不错'

  return (
    <section>
      <div className="dash">
        <div className="dash-top">
          <Ring score={score} />
          <div>
            <p className="dash-verdict">{verdict}</p>
            <div className="dash-counts">
              <span><i style={{ background: '#9ff0d8' }} />正常 {count('正常')} 项</span>
              <span><i style={{ background: '#ffd58a' }} />关注 {count('关注')} 项</span>
              <span><i style={{ background: '#ffab98' }} />预警 {count('预警')} 项</span>
            </div>
          </div>
        </div>
        <p className="dash-summary">{report.summary}</p>
        <p className="dash-note">健康分按各项指标的红黄绿等级折算，仅供参考。</p>
      </div>

      {report.risks.length > 0 && (
        <div className="card">
          <h2><span className="card-icon" style={{ color: 'var(--warn)' }}><IconAlert /></span>值得留意</h2>
          {report.risks.map((r, k) => (
            <div key={k} className="risk">
              <IconAlert />
              <div>
                <span>{r}</span>
                <AskLink disabled={busy} onClick={() => onAsk(riskQuestion(r))}>和交税有关吗？问问</AskLink>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="section-title">各项指标<small>点一下看说明</small></h3>
      <div className="inds">
        {report.indicators.map(i => {
          const [v, unit] = formatValue(i)
          const isOpen = open === i.key
          const q = indicatorQuestion(i)
          const toggle = () => setOpen(isOpen ? null : i.key)
          return (
            <div key={i.key} role="button" tabIndex={0} className={`ind lv-${i.level}${isOpen ? ' open' : ''}`}
              onClick={toggle} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle())}
              aria-expanded={isOpen}>
              <span className="ind-name">{i.name}</span>
              <span className="ind-val">{v}{unit && <small>{unit}</small>}</span>
              <span className={`chip ${chipClass[i.level]}`}>{i.level}</span>
              {isOpen && (
                <span className="ind-exp">
                  {i.explanation}
                  {q && <AskLink disabled={busy} onClick={() => onAsk(q)} />}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <h3 className="section-title">可能用得上的优惠<small>{matches.length} 项</small></h3>
      <div className="card">
        {matches.length === 0 && <p className="hint">暂时没有匹配到优惠政策。</p>}
        {matches.map(m => (
          <div key={m.policy.id} className="policy">
            <div className="policy-head">
              <b>{m.policy.title}</b>
              <span className={`chip ${m.policy.region === '上海' ? 'accent' : m.status === '符合' ? 'ok' : 'brand'}`}>
                {m.policy.region === '上海' ? '上海' : m.status}
              </span>
            </div>
            <p>{m.reason}</p>
            <p className="src">依据：{m.policy.source_name}</p>
            <div className="policy-actions">
              <button className="btn btn-soft" disabled={busy} onClick={() => onGuide(m.policy.id)}>
                <IconGift />怎么办理<IconArrow />
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => onAsk(policyQuestion(m.policy.title), m.policy.id)}>
                <IconChat />问问这条
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2><span className="card-icon"><IconChat /></span>对报告有疑问？</h2>
        <p className="hint">回答会结合你这份体检的数据，并标出依据的文件。</p>
        <div className="suggests" style={{ marginTop: 12, marginBottom: 0 }}>
          {reportQuestions(report).map(s => (
            <button key={s.q} disabled={busy} onClick={() => onAsk(s.q, s.policyId)}>{s.q}</button>
          ))}
        </div>
      </div>

      <p className="disclaimer">{report.disclaimer}</p>
    </section>
  )
}
