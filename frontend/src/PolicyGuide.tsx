import { useState } from 'react'
import type { PolicyGuide } from './types'

const money = (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PolicyGuideView({ guide, onBack }: { guide: PolicyGuide; onBack: () => void }) {
  // 每一步有确认问题时，勾选后才展开下一步，引导老板一步步走完
  const [done, setDone] = useState<boolean[]>(guide.steps.map(() => false))
  const firstOpen = done.findIndex((d, i) => !d && guide.steps[i].check)
  const visible = firstOpen === -1 ? guide.steps.length : firstOpen + 1
  const finished = firstOpen === -1

  return (
    <section>
      <button className="link" onClick={onBack}>‹ 返回体检报告</button>
      <div className="card">
        <h2>{guide.title}</h2>
        <p className="hint">在哪办：{guide.where}</p>
        <div className="progress"><div style={{ width: `${(Math.min(visible, guide.steps.length) / guide.steps.length) * 100}%` }} /></div>
      </div>

      {guide.steps.slice(0, visible).map((s, i) => (
        <div key={i} className="card step">
          <h2><span className="num">{i + 1}</span>{s.title}</h2>
          <p>{s.detail}</p>
          {s.fields.length > 0 && (
            <table className="fields">
              <thead><tr><th>栏次</th><th>填什么</th><th>参考金额</th></tr></thead>
              <tbody>
                {s.fields.map((f, j) => (
                  <tr key={j}>
                    <td>{f.line}</td>
                    <td>{f.label}{f.note && <small>{f.note}</small>}</td>
                    <td className="amt">{f.value == null ? '系统预填' : money(f.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {s.fields[0] && <p className="src">表：{[...new Set(s.fields.map(f => f.form))].join('；')}</p>}
          {s.check && (
            <label className="check">
              <input type="checkbox" checked={done[i]}
                onChange={e => setDone(done.map((d, k) => (k === i ? e.target.checked : d)))} />
              {s.check}
            </label>
          )}
        </div>
      ))}

      {finished && <div className="card done">都完成了。下次申报期记得再来体检一次。</div>}

      <div className="card">
        <h2>相关文件下载</h2>
        {guide.downloads.map(d => (
          <a key={d.url} className="dl" href={d.url} target="_blank" rel="noreferrer">
            {d.name}{d.note && <small>{d.note}</small>}
          </a>
        ))}
      </div>
      <p className="disclaimer">{guide.caution}</p>
    </section>
  )
}
