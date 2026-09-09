import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Expose GEMINI_API_KEY to the frontend via VITE_ prefix
process.env.VITE_GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
console.log(`[Vite Config] GEMINI_API_KEY detectada: ${process.env.VITE_GEMINI_API_KEY ? 'SÍ' : 'NO'}`);

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY),
    'process.env.API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY),
    'process.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY),
  },
  server: {
    port: 3000,
    strictPort: true,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});