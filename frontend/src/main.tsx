import { Component, StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 页面出错时把错误写在屏幕上，而不是白屏；常见原因是旧版本存下的设置，可以一键清掉
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="app bare" style={{ paddingTop: 40 }}>
        <h1 className="page-title">页面出错了</h1>
        <pre className="crash">{String(error.stack || error)}</pre>
        <button className="btn btn-primary" onClick={() => {
          try { localStorage.removeItem('xqys.settings') } catch { /* 存储不可用时直接刷新 */ }
          location.reload()
        }}>清除设置并重新打开</button>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
