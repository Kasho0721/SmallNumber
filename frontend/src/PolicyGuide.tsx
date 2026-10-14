import { useEffect, useState } from 'react'
import { api } from './api'
import { IconAlert, IconBack, IconCheck, IconExternal, IconPhone } from './icons'
import type { PolicyDetail, PolicyGuide, PolicyMatch } from './types'

// 只给办理指引和官方入口：不在应用里填申报数字，也不生成申报表
// 电子税务局的直达网址没核实过，先链到上海市税务局官网首页，从那里进入
const TAX_SITE = { name: '上海市税务局官网', url: 'https://shanghai.chinatax.gov.cn/' }
const CAUTION = '只提供指引，不代你填写或提交申报，以税务机关为准'

function Back({ onBack, label }: { onBack: () => void; label: string }) {
  return <button className="back" onClick={onBack}><IconBack />{label}</button>
}

export function PolicyGuideView({ guide, onBack, backLabel }: { guide: PolicyGuide; onBack: () => void; backLabel: string }) {
  const [done, setDone] = useState<boolean[]>(guide.steps.map(() => false))

  return (
    <section>
      <Back onBack={onBack} label={backLabel} />
      <h1 className="page-title">怎么办理</h1>
      <p className="page-sub">{guide.title}</p>

      <div className="card">
        <ol className="timeline">
          {guide.steps.map((s, i) => (
            <li key={i} className={done[i] ? 'ok' : ''}>
              <button className="num" aria-label={done[i] ? '标为没做' : '标为做完'}
                onClick={() => setDone(done.map((d, k) => (k === i ? !d : d)))}>{done[i] ? <IconCheck /> : i + 1}</button>
              <details>
                <summary>{s.title}</summary>
                <p className="step-detail">{s.detail}</p>
              </details>
            </li>
          ))}
        </ol>
      </div>

      <a className="btn btn-primary" href={TAX_SITE.url} target="_blank" rel="noreferrer">去{TAX_SITE.name}办理<IconExternal /></a>
      <a className="tel" href="tel:12366"><IconPhone />不会操作？打 12366</a>
      <p className="disclaimer center">{CAUTION}</p>
    </section>
  )
}

export function PolicyDetailView({ id, match, busy, backLabel, onBack, onGuide, onAsk }: {
  id: string; match?: PolicyMatch; busy: boolean; backLabel: string
  onBack: () => void; onGuide: (id: string) => void; onAsk: (q: string, policyId: string) => void
}) {
  const [p, setP] = useState<PolicyDetail | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.policy(id).then(setP).catch(e => setErr(String(e))) }, [id])

  if (err) return <section><Back onBack={onBack} label={backLabel} /><p className="err">没找到这条政策：{err}</p></section>
  if (!p) return <section><Back onBack={onBack} label={backLabel} /><p className="hint">正在打开…</p></section>

  const fits = match && match.status !== '不符合'
  return (
    <section>
      <Back onBack={onBack} label={backLabel} />
      <h1 className="page-title">{p.title}</h1>
      <p className="meta">
        {p.source_url ? <a href={p.source_url} target="_blank" rel="noreferrer">{p.source_name}</a> : p.source_name}
      </p>

      {match && (
        <div className={`verdict${fits ? '' : ' no'}`}>
          {fits ? <IconCheck /> : <IconAlert />}
          <div>
            <b>{fits ? '你可能适用' : '你可能不适用'}</b>
            {match.missing_info.length > 0 && <p>还要确认：{match.missing_info.join('、')}</p>}
          </div>
        </div>
      )}

      <div className="card">
        <p>{p.summary}</p>
        <details className="more">
          <summary>看原文条件</summary>
          <p>{p.conditions}</p>
        </details>
      </div>

      {p.has_guide && <button className="btn btn-primary" disabled={busy} onClick={() => onGuide(p.id)}>看看怎么办理</button>}
      <button className="btn btn-ghost" disabled={busy} onClick={() => onAsk(`${p.title}，对我的店适用吗？要满足什么条件？`, p.id)}>问问这条</button>
      <p className="disclaimer center">仅供参考，以税务机关官方解释为准</p>
    </section>
  )
}
