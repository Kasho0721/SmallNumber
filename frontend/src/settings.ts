// 首次启动时选的生意类型和 AI 模型，存在本机浏览器里，不上传
export interface ModelChoice {
  id: 'default' | 'deepseek' | 'qwen' | 'custom'
  baseUrl?: string
  apiKey?: string
  model?: string
}
export interface Settings { industry: string; model: ModelChoice }

export const PRESET_INDUSTRIES = ['餐饮小吃', '零售便利店', '理发美容', '维修服务', '网店电商', '家政保洁', '设计工作室', '菜摊水果']

// 推荐：用后端 .env 里配好的模型，不用填密钥。其余几个要用户自己的密钥。
// vision 为空表示这个模型不能识图，拍照识别时仍用推荐模型。
export const MODELS: { id: ModelChoice['id']; name: string; desc: string; baseUrl?: string; model?: string; vision?: string }[] = [
  { id: 'default', name: '推荐（默认）', desc: '不用设置，适合日常问答' },
  { id: 'deepseek', name: 'DeepSeek', desc: '擅长分析推理，回答更深入', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'qwen', name: '通义千问', desc: '中文理解强，适合政策解读', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', vision: 'qwen-vl-plus' },
  { id: 'custom', name: '自定义', desc: '填写 OpenAI 兼容的接口地址和密钥' },
]

const KEY = 'xqys.settings'

export function loadSettings(): Settings | null {
  try {
    const s = localStorage.getItem(KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 无痕模式存不了，本次会话照常用 */ }
  current = s
}

let current: Settings | null = loadSettings()

// 发给后端的模型请求头；选推荐时不带，后端用 .env 的配置
export function modelHeaders(forVision = false): Record<string, string> {
  const m = current?.model
  if (!m || m.id === 'default') return {}
  const preset = MODELS.find(p => p.id === m.id)
  const baseUrl = m.id === 'custom' ? m.baseUrl : preset?.baseUrl
  const model = m.id === 'custom' ? m.model : preset?.model
  if (!baseUrl || !model || !m.apiKey) return {}
  if (forVision && m.id !== 'custom' && !preset?.vision) return {}
  const h: Record<string, string> = { 'X-LLM-Base-URL': baseUrl, 'X-LLM-API-Key': m.apiKey, 'X-LLM-Model': model }
  if (preset?.vision) h['X-LLM-Vision-Model'] = preset.vision
  return h
}

export function modelHeadersFor(m: ModelChoice) {
  const saved = current
  current = { industry: '', model: m }
  try { return modelHeaders() } finally { current = saved }
}
