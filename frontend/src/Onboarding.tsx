import { useState } from 'react'
import { api } from './api'
import {
  IconBack, IconBag, IconCarrot, IconLock, IconPen, IconPlus, IconScissors, IconSpray, IconStore,
  IconTick, IconUtensils, IconWrench,
} from './icons'
import { MODELS, PRESET_INDUSTRIES, modelHeadersFor } from './settings'
import type { ModelChoice, Settings } from './settings'

const industryIcon = [IconUtensils, IconStore, IconScissors, IconWrench, IconBag, IconSpray, IconPen, IconCarrot]

// 首次启动两步：选生意类型，选 AI 模型。以后从记账页右上角的设置再进来改。
export function Onboarding({ initial, onDone, onCancel }: {
  initial: Settings | null; onDone: (s: Settings) => void; onCancel?: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const preset = initial && PRESET_INDUSTRIES.includes(initial.industry) ? initial.industry : null
  const [industry, setIndustry] = useState<string | null>(preset ?? (initial ? 'custom' : null))
  const [custom, setCustom] = useState(preset || !initial ? '' : initial.industry)
  const [model, setModel] = useState<ModelChoice>(initial?.model ?? { id: 'default' })
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' })

  const chosenIndustry = industry === 'custom' ? custom.trim() : industry
  const needsKey = model.id !== 'default'
  const modelReady = !needsKey || (!!model.apiKey?.trim() && (model.id !== 'custom' || (!!model.baseUrl?.trim() && !!model.model?.trim())))

  function pick(m: ModelChoice) { setModel(m); setTest({ state: 'idle' }) }

  async function runTest() {
    setTest({ state: 'busy' })
    try {
      const r = await api.testModel(modelHeadersFor(model))
      setTest(r.ok ? { state: 'ok' } : { state: 'fail', msg: r.error })
    } catch (e) { setTest({ state: 'fail', msg: String(e) }) }
  }

  if (step === 1) return (
    <section className="onb">
      <div className="onb-top">
        {onCancel ? <button className="back" onClick={onCancel}><IconBack />返回</button> : <span className="onb-hello">欢迎使用小企有数</span>}
        <span className="onb-step">1 / 2</span>
      </div>
      <h1 className="onb-title">你做的是什么生意？</h1>
      <p className="page-sub">选一个，体检会按你的行业来看。</p>
      <div className="biz-grid">
        {PRESET_INDUSTRIES.map((name, k) => {
          const Icon = industryIcon[k]
          return (
            <button key={name} className={`biz${industry === name ? ' on' : ''}`} onClick={() => setIndustry(name)}>
              <Icon /><span>{name}</span>{industry === name && <i className="biz-check"><IconTick /></i>}
            </button>
          )
        })}
      </div>
      <div className={`biz-custom${industry === 'custom' ? ' on' : ''}`}>
        <button className="biz biz-add" onClick={() => setIndustry('custom')}><IconPlus /><span>自定义</span></button>
        <label className="field">
          <input value={custom} placeholder="输入你的行业" onFocus={() => setIndustry('custom')}
            onChange={e => setCustom(e.target.value)} />
          <small>比如：宠物美容、打印店</small>
        </label>
      </div>
      <button className="btn btn-primary" disabled={!chosenIndustry} onClick={() => setStep(2)}>下一步</button>
      <p className="onb-note">以后可以在设置里改</p>
    </section>
  )

  return (
    <section className="onb">
      <div className="onb-top">
        <button className="back" onClick={() => setStep(1)}><IconBack />上一步</button>
        <span className="onb-step">2 / 2</span>
      </div>
      <h1 className="onb-title">选一个帮你分析的 AI</h1>
      <p className="page-sub">不同的模型，回答风格略有不同。</p>
      <div className="models">
        {MODELS.map(m => {
          const on = model.id === m.id
          return (
            <div key={m.id} className={`model${on ? ' on' : ''}`}>
              <button className="model-head" onClick={() => pick(on ? model : { id: m.id, baseUrl: model.baseUrl, model: model.model, apiKey: model.apiKey })}>
                <span className="model-text"><b>{m.name}</b><small>{m.desc}</small></span>
                <span className={`radio${on ? ' on' : ''}`}>{on && <IconTick />}</span>
              </button>
              {on && m.id !== 'default' && (
                <div className="model-form">
                  {m.id === 'custom' && <>
                    <label className="field-row"><span>接口地址</span>
                      <input value={model.baseUrl ?? ''} placeholder="https://api.example.com/v1" inputMode="url"
                        onChange={e => pick({ ...model, baseUrl: e.target.value })} /></label>
                    <label className="field-row"><span>模型名</span>
                      <input value={model.model ?? ''} placeholder="如 qwen-plus" onChange={e => pick({ ...model, model: e.target.value })} /></label>
                  </>}
                  <label className="field-row"><span>API 密钥</span>
                    <input value={model.apiKey ?? ''} placeholder="sk-…" type="password" autoComplete="off"
                      onChange={e => pick({ ...model, apiKey: e.target.value })} /></label>
                  <button className="link-btn" disabled={!modelReady || test.state === 'busy'} onClick={runTest}>
                    {test.state === 'busy' ? '正在测试…' : '测试连接'}
                  </button>
                  {test.state === 'ok' && <p className="test ok">连接成功</p>}
                  {test.state === 'fail' && <p className="test bad">连不上：{test.msg}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="note-bar"><IconLock /><span>你的账目只用来生成体检报告；密钥只保存在这台手机的浏览器里。</span></div>
      <button className="btn btn-primary" disabled={!modelReady}
        onClick={() => onDone({ industry: chosenIndustry!, model })}>开始使用</button>
    </section>
  )
}
