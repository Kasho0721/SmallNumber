import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true 让同一 Wi-Fi 下的手机能直接打开
export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy: { '/api': 'http://localhost:8000' } },
})
