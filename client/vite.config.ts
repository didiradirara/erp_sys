import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  server: { port: 5173, host: true },
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'util', 'process'], // ExcelJS가 참조할 수 있는 내장 모듈들
      globals: { Buffer: true, process: true }
    })
  ],
  optimizeDeps: {
    // exceljs를 사전 번들에 포함해서 런타임 에러 줄이기
    include: ['exceljs', 'file-saver']
  }
})
