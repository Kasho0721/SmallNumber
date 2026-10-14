// 首次启动时选的生意类型和 AI 模型，存在本机浏览器里，不上传
export interface ModelChoice {
  id: 'default' | 'custom'
  baseUrl?: string
  apiKey?: string
  model?: string
}
export interface Settings { industry: string; model: ModelChoice }

export const PRESET_INDUSTRIES = ['餐饮小吃', '零售便利店', '理发美容', '维修服务', '网店电商', '家政保洁', '设计工作室', '菜摊水果']

// 默认：用后端 .env 里配好的模型。自定义：用户自己填 OpenAI 兼容接口
export const MODELS: { id: ModelChoice['id']; name: string; desc: string }[] = [
  { id: 'default', name: '默认', desc: '不用设置' },
  { id: 'custom', name: '自定义', desc: '填自己的接口和密钥' },
]

const KEY = 'xqys.settings'

export function loadSettings(): Settings | null {
  try {
    const s = localStorage.getItem(KEY)
    if (!s) return null
    const v: Settings = JSON.parse(s)
    // 早期版本有 DeepSeek、通义千问两个预设，已删掉，按默认处理
    if (v.model.id !== 'custom') v.model = { id: 'default' }
    return v
  } catch { return null }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 无痕模式存不了，本次会话照常用 */ }
  current = s
}

let current: Settings | null = loadSettings()

// 发给后端的模型请求头；选默认时不带，后端用 .env 的配置
export function modelHeaders(): Record<string, string> {
  const m = current?.model
  if (!m || m.id !== 'custom' || !m.baseUrl || !m.model || !m.apiKey) return {}
  return { 'X-LLM-Base-URL': m.baseUrl, 'X-LLM-API-Key': m.apiKey, 'X-LLM-Model': m.model }
}

export function modelHeadersFor(m: ModelChoice) {
  const saved = current
  current = { industry: '', model: m }
  try { return modelHeaders() } finally { current = saved }
}
