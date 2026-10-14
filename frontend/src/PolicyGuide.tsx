import { useEffect, useState } from 'react'
import { api } from './api'
import { IconAlert, IconBack, IconCheck, IconDownload, IconExternal, IconLandmark, IconPhone } from './icons'
import type { PolicyDetail, PolicyGuide, PolicyMatch } from './types'

// 只给办理指引和官方入口：不在应用里填申报数字，也不生成申报表
const TAX_SITE = { name: '国家税务总局上海市税务局', note: '从官网首页进入电子税务局办理', url: 'https://shanghai.chinatax.gov.cn/' }
const CAUTION = '本页只提供办理指引，不代你填写或提交申报，也不构成税务建议。具体以电子税务局和税务机关的要求为准。'

function Back({ onBack, label }: { onBack: () => void; label: string }) {
  return <button className="back" onClick={onBack}><IconBack />{label}</button>
}

export function PolicyGuideView({ guide, onBack, backLabel }: { guide: PolicyGuide; onBack: () => void; backLabel: string }) {
  const [done, setDone] = useState<boolean[]>(guide.steps.map(() => false))

  return (
    <section>
      <Back onBack={onBack} label={backLabel} />
      <h1 className="page-title">{guide.title}怎么办</h1>
      <p className="page-sub">按下面几步，到电子税务局自己办理。</p>

      <div className="card">
        <ol className="timeline">
          {guide.steps.map((s, i) => (
            <li key={i} className={done[i] ? 'ok' : ''}>
              <span className="num">{done[i] ? <IconCheck /> : i + 1}</span>
              <div>
                <h2>{s.title}</h2>
                <p className="step-detail">{s.detail}</p>
                {s.check && (
                  <label className={`check${done[i] ? ' done' : ''}`}>
                    <input type="checkbox" checked={done[i]}
                      onChange={e => setDone(done.map((d, k) => (k === i ? e.target.checked : d)))} />
                    {s.check}
                  </label>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <a className="card link-card" href={TAX_SITE.url} target="_blank" rel="noreferrer">
        <IconLandmark />
        <div><b>{TAX_SITE.name}</b><small>{TAX_SITE.note} · shanghai.chinatax.gov.cn</small></div>
        <IconExternal />
      </a>
      <a className="tel" href="tel:12366"><IconPhone />有疑问可拨打 12366 纳税服务热线</a>

      {guide.downloads.length > 0 && (
        <div className="card">
          <h2><span className="card-icon"><IconDownload /></span>官方文件</h2>
          {guide.downloads.map(d => (
            <a key={d.url} className="dl" href={d.url} target="_blank" rel="noreferrer">
              <div>{d.name}{d.note && <small>{d.note}</small>}</div>
              <IconExternal />
            </a>
          ))}
        </div>
      )}

      <div className="note-bar warn"><IconAlert /><span>{CAUTION}</span></div>
      <a className="btn btn-primary" href={TAX_SITE.url} target="_blank" rel="noreferrer">前往电子税务局<IconExternal /></a>
      <p className="disclaimer center">仅供参考，以税务机关官方解释为准</p>
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
        {p.effective_from && <><br />有效期：{p.effective_from} 至 {p.effective_to ?? '今后'}</>}
      </p>

      {match && (
        <div className={`verdict${fits ? '' : ' no'}`}>
          {fits ? <IconCheck /> : <IconAlert />}
          <div>
            <b>{fits ? '你可能适用' : '按你现在的数据，可能不适用'}</b>
            <p>{match.reason}</p>
            {match.missing_info.length > 0 && <p>还需要确认：{match.missing_info.join('、')}</p>}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="mini-title">说的是什么</h3>
        <p>{p.summary}</p>
        <h3 className="mini-title">适用条件</h3>
        <p>{p.conditions}</p>
        <h3 className="mini-title">税种和地区</h3>
        <p>{p.tax_type} · {p.region}</p>
      </div>

      <p className="disclaimer center">仅供参考，以税务机关官方解释为准</p>
      {p.has_guide && <button className="btn btn-primary" disabled={busy} onClick={() => onGuide(p.id)}>看看怎么办理</button>}
      <button className="btn btn-ghost" disabled={busy} onClick={() => onAsk(`${p.title}，对我的店适用吗？要满足什么条件？`, p.id)}>问问这条政策</button>
    </section>
  )
}
