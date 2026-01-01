import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './', // 配置相对路径，适配 GitHub Pages
  plugins: [
    tailwindcss(), // 放在 react() 前面或后面都可以，但必须存在
    react(),
  ],
})