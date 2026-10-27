import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 部署於 GitHub Pages 專案頁：https://evelynforever.github.io/evelynliu/
  base: '/evelynliu/',
})
