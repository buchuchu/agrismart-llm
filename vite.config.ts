import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This allows process.env.API_KEY to work in the browser for this specific demo setup
    // Note: In production, usually better to use import.meta.env.VITE_API_KEY, but this keeps compatibility with your current code.
    'process.env': process.env
  }
})