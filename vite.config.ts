import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // relative, so the same build works at /<repo>/ and /<repo>/preview/
  base: './',
  plugins: [react(), tailwindcss()],
})
