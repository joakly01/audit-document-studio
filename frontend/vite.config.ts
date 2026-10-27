import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig(({mode}) => {
 const env = loadEnv(mode, process.cwd(), '')
 return {
  plugins:[vue()],
  resolve:{alias:{'@':fileURLToPath(new URL('./src', import.meta.url))}},
  base:env.VITE_BASE_PATH || '/',
  server:{port:5173,proxy:env.API_PROXY_TARGET ? {'/api':{target:env.API_PROXY_TARGET,changeOrigin:true}} : undefined},
  build:{sourcemap:true,rollupOptions:{output:{manualChunks:{vue:['vue','vue-router','pinia'],ui:['element-plus']}}}}
 }
})
