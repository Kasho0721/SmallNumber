import { useEffect, useRef, useState } from 'react'
import { reportQuestions } from './ask'
import { IconArrow, IconBot, IconFile, IconSend } from './icons'
import type { AskTurn, BusinessData, Diagnosis } from './types'

export function Ask({ data, report, turns, busy, useShop, setUseShop, onAsk, onPolicy, onGoReport }: {
  data: BusinessData; report: Diagnosis | null; turns: AskTurn[]; busy: boolean
  useShop: boolean; setUseShop: (v: boolean) => void
  onAsk: (q: string, policyId?: string) => void; onPolicy: (id: string) => void; onGoReport: () => void
}) {
  const [q, setQ] = useState('')
  const last = useRef<HTMLDivElement>(null)
  // 有新回答时滚到它
  useEffect(() => { last.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [turns.length])

  const asked = new Set(turns.map(t => t.question))
  const suggests = reportQuestions(useShop ? report : null).filter(s => !asked.has(s.q)).slice(0, 2)
  const send = () => { if (q.trim()) { onAsk(q.trim()); setQ('') } }

  return (
    <section className="chat">
      <h1 className="page-title">问政策</h1>

      {report ? (
        <div className={`ctx${useShop ? '' : ' off'}`}>
          <span className="bot"><IconBot /></span>
          <div>
            <b>{useShop ? `已结合「${data.profile.name ?? '你的店'}」的体检数据` : '现在只按政策原文回答'}</b>
            <label className="toggle">
              <input type="checkbox" checked={useShop} onChange={e => setUseShop(e.target.checked)} />
              回答时结合我的数据
            </label>
          </div>
        </div>
      ) : (
        <div className="ctx off">
          <span className="bot"><IconBot /></span>
          <div>
            <b>先做一次体检，回答就能结合你店里的情况</b>
            <button className="ask-link" onClick={onGoReport}>去记账体检<IconArrow /></button>
          </div>
        </div>
      )}

      {turns.length === 0 && (
        <div className="msg bot-msg">
          <span className="bot"><IconBot /></span>
          <p className="a-bubble">用大白话问就行，比如“客户要我开发票，我能开吗？”。回答会标出依据的文件。</p>
        </div>
      )}

      {turns.map((t, k) => (
        <div key={k} ref={k === turns.length - 1 ? last : undefined} className="turn">
          <p className="q-bubble">{t.question}</p>
          <div className="msg bot-msg">
            <span className="bot"><IconBot /></span>
            <div className="a-bubble">
              <p className="answer">{t.result.answer}</p>
              {t.withShop && t.result.shop_facts.length > 0 && (
                <div className="ctx-chips">
                  <span>结合了：</span>
                  {t.result.shop_facts.map(f => <span key={f} className="chip">{f}</span>)}
                </div>
              )}
              {t.result.sources.map(s => (
                <button key={s.id} className="cite" onClick={() => onPolicy(s.id)}>
                  <IconFile /><span>{s.source_name}</span><IconArrow />
                </button>
              ))}
              <p className="fine">仅供参考，以税务机关官方解释为准</p>
            </div>
          </div>
        </div>
      ))}

      <div className="composer">
        {suggests.length > 0 && (
          <div className="pills">
            {suggests.map(s => <button key={s.q} disabled={busy} onClick={() => onAsk(s.q, s.policyId)}>{s.q}</button>)}
          </div>
        )}
        <div className="composer-row">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="有什么想问的？"
            onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && send()} />
          <button className="send" aria-label="提问" disabled={busy || !q.trim()} onClick={send}><IconSend /></button>
        </div>
      </div>
    </section>
  )
}
