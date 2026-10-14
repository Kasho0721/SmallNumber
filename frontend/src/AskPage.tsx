import { useEffect, useRef, useState } from 'react'
import { reportQuestions } from './ask'
import { IconArrow, IconBot, IconFile, IconSend } from './icons'
import type { AskTurn, BusinessData, Diagnosis } from './types'

// 回答较长时先显示前几行，点“展开”看全文
function Answer({ text }: { text: string }) {
  const [full, setFull] = useState(false)
  const long = text.length > 90
  return <>
    <p className={`answer${long && !full ? ' clamp' : ''}`}>{text}</p>
    {long && <button className="link-btn" onClick={() => setFull(!full)}>{full ? '收起' : '展开全文'}</button>}
  </>
}

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
          <label className="toggle">
            <input type="checkbox" checked={useShop} onChange={e => setUseShop(e.target.checked)} />
            结合「{data.profile.name ?? '我的店'}」的体检数据
          </label>
        </div>
      ) : (
        <div className="ctx off">
          <span className="bot"><IconBot /></span>
          <div>
            <b>先体检，回答更贴近你的店</b>
            <button className="ask-link" onClick={onGoReport}>去记账<IconArrow /></button>
          </div>
        </div>
      )}

      <p className="fine center">仅供参考，以税务机关官方解释为准</p>

      {turns.length === 0 && (
        <div className="msg bot-msg">
          <span className="bot"><IconBot /></span>
          <p className="a-bubble">用大白话问就行。</p>
        </div>
      )}

      {turns.map((t, k) => (
        <div key={k} ref={k === turns.length - 1 ? last : undefined} className="turn">
          <p className="q-bubble">{t.question}</p>
          <div className="msg bot-msg">
            <span className="bot"><IconBot /></span>
            <div className="a-bubble">
              <Answer text={t.result.answer} />
              {t.result.sources.slice(0, 2).map(s => (
                <button key={s.id} className="cite" onClick={() => onPolicy(s.id)}>
                  <IconFile /><span>{s.source_name}</span><IconArrow />
                </button>
              ))}
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
