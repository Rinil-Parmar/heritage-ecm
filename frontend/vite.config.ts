import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api/v1': {
          target: env.ECM_BACKEND_ORIGIN || 'http://127.0.0.1:8001',
        },
        '/api': {
          changeOrigin: true,
          secure: true,
          target: env.ECM_API_ORIGIN || 'https://archeoecm.cs.uwindsor.ca',
        },
      },
    },
  }
})
